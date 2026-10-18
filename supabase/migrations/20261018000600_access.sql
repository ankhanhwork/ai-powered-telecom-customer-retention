-- RLS + grants are both necessary. Staff writes only through RPC.
do $$ declare t text; begin
  foreach t in array array['customers','prediction_runs','customer_snapshots','churn_predictions',
    'prediction_contexts','retention_cases','staff_members','customer_portal_users','workspace_settings',
    'offers','customer_offer_eligibility','ai_recommendations','conversations','contact_preferences',
    'messages','message_revisions','message_approvals','delivery_outbox','interaction_events',
    'follow_up_tasks','notifications','support_requests','retention_outcomes','intervention_costs','automation_jobs'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role',t);
    execute format('grant select on table public.%I to authenticated, service_role',t);
  end loop;
end $$;
create policy staff_directory on public.staff_members for select to authenticated
  using (app_private.is_staff());
create policy own_portal_mapping on public.customer_portal_users for select to authenticated
  using (user_id=auth.uid() or app_private.is_supervisor());
create policy settings_staff on public.workspace_settings for select to authenticated using (app_private.is_staff());
create policy offers_staff on public.offers for select to authenticated using (app_private.is_staff());
create policy cases_staff on public.retention_cases for select to authenticated using (app_private.can_read_case(id));
create policy customers_staff on public.customers for select to authenticated using (app_private.can_read_customer(id));
create policy snapshots_staff on public.customer_snapshots for select to authenticated using (app_private.can_read_customer(customer_id));
create policy predictions_staff on public.churn_predictions for select to authenticated using (app_private.can_read_customer(customer_id));
create policy runs_staff on public.prediction_runs for select to authenticated using (app_private.is_staff());
create policy context_staff on public.prediction_contexts for select to authenticated using (
  exists(select 1 from public.churn_predictions p where p.id=prediction_id and app_private.can_read_customer(p.customer_id)));
create policy eligibility_staff on public.customer_offer_eligibility for select to authenticated using (app_private.can_read_customer(customer_id));
create policy preferences_staff on public.contact_preferences for select to authenticated using (app_private.can_read_customer(customer_id));
do $$ declare t text; begin
  foreach t in array array['ai_recommendations','conversations','messages','interaction_events',
    'follow_up_tasks','support_requests','retention_outcomes','intervention_costs','automation_jobs'] loop
    execute format('create policy case_staff on public.%I for select to authenticated using (app_private.can_read_case(case_id))',t);
  end loop;
end $$;
create policy revisions_staff on public.message_revisions for select to authenticated using (
  exists(select 1 from public.messages m where m.id=message_id and app_private.can_read_case(m.case_id)));
create policy approvals_staff on public.message_approvals for select to authenticated using (
  exists(select 1 from public.messages m where m.id=message_id and app_private.can_read_case(m.case_id)));
create policy outbox_staff on public.delivery_outbox for select to authenticated using (
  exists(select 1 from public.messages m where m.id=message_id and app_private.can_read_case(m.case_id)));
create policy notifications_own on public.notifications for select to authenticated using (
  recipient_user_id=auth.uid() and app_private.can_read_case(case_id));

-- Portal reads use filtered RPC only: no draft, internal note, score or SHAP leakage.
-- No anonymous access, even to RPC.
revoke all on all functions in schema app_private from public,anon,authenticated,service_role;
grant usage on schema app_private to authenticated;
grant execute on function app_private.is_staff(),app_private.is_supervisor(),
  app_private.can_read_case(uuid),app_private.can_read_customer(uuid) to authenticated;

do $$ declare f record; v_worker text[]:=array[
  'retention_claim_delivery','retention_deliver_mock','retention_fail_delivery',
  'retention_pending_jobs','retention_complete_job','retention_fail_job',
  'retention_process_followups','retention_process_support','retention_ingest_prediction','retention_set_demo_consent'];
begin
  for f in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'retention\_%' escape '\' loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f.oid::regprocedure);
    execute format('grant execute on function %s to %I',f.oid::regprocedure,
      case when f.proname=any(v_worker) then 'service_role' else 'authenticated' end);
  end loop;
end $$;

-- Queue reads respect the base tables' RLS. No SECURITY DEFINER view.
create view public.retention_care_queue with (security_invoker=true) as
select c.id as case_id,c.customer_id,cu.customer_ref,cu.display_name,cu.contract_ref,
  cu.plan_name,cu.monthly_fee,cu.currency,c.target_period_start,c.case_status,c.contact_result,
  c.priority,c.due_at,c.created_at,c.last_contact_at,c.assigned_agent_id,s.display_name as case_owner,
  p.churn_probability,p.churn_score,p.explanations_status,cu.is_synthetic,
  (select count(*) from public.support_requests sr where sr.case_id=c.id and sr.handoff_status='sent') as support_referrals,
  (select count(*) from public.messages m where m.case_id=c.id and m.direction='outbound' and m.approval_status in ('draft','pending_approval')) as pending_drafts,
  (select count(*) from public.follow_up_tasks t where t.case_id=c.id and t.status in ('pending','due') and t.due_at<=now()) as due_tasks
from public.retention_cases c join public.customers cu on cu.id=c.customer_id
  join public.churn_predictions p on p.id=c.prediction_id
  left join public.staff_members s on s.user_id=c.assigned_agent_id;
revoke all on public.retention_care_queue from public,anon;
grant select on public.retention_care_queue to authenticated,service_role;

create function public.retention_metrics(p_target_period date) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare v_result jsonb;
begin
  if not app_private.is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
  -- RLS naturally scopes an agent to their cases; supervisor sees the workspace.
  select jsonb_build_object('target_period_start',p_target_period,'cases',count(*),
    'closed_cases',count(*) filter(where c.case_status='closed'),
    'contacted_cases',count(*) filter(where c.contact_result='contacted'),
    'unknown_outcomes',(select count(*) from public.retention_cases x left join public.retention_outcomes o
      on o.case_id=x.id where x.target_period_start=p_target_period and o.churned is null),
    'observed_churned',(select count(*) from public.retention_outcomes o join public.retention_cases x on x.id=o.case_id
      where x.target_period_start=p_target_period and o.churned=true),
    'observed_active',(select count(*) from public.retention_outcomes o join public.retention_cases x on x.id=o.case_id
      where x.target_period_start=p_target_period and o.churned=false),
    'costs_by_currency',coalesce((select jsonb_agg(z) from (select k.currency,k.is_simulated,sum(k.amount) as amount
      from public.intervention_costs k join public.retention_cases x on x.id=k.case_id
      where x.target_period_start=p_target_period group by k.currency,k.is_simulated) z),'[]'),
    'synthetic_cases',count(*) filter(where cu.is_synthetic)) into v_result
  from public.retention_cases c join public.customers cu on cu.id=c.customer_id
    where c.target_period_start=p_target_period;
  return v_result;
end $$;
revoke all on function public.retention_metrics(date) from public,anon,service_role;
grant execute on function public.retention_metrics(date) to authenticated;
