-- Admin-only controlled demo replacement; source payloads already staged and validated.
-- Keep Auth users, staff, workspace settings and offers. Backup all old public rows.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
do $$
declare t record; item record; p jsonb; selected public.retention_cases; agent uuid; portal uuid;
begin
 if (select count(*) from app_private.v5_import_stage)<>2705 then raise exception 'Expected 2705 staged customers'; end if;
 if (select count(*) from app_private.v5_import_stage where (payload->'p_prediction'->>'churn_probability')::numeric>0.5)<>207 then raise exception 'Expected 207 alerts'; end if;
 if exists(select 1 from public.customers where not is_synthetic or source_dataset<>'synthetic_monthend_v4_strong_signal') then raise exception 'Refuse to erase non-v4 demo data'; end if;
 if exists(select 1 from app_private.v4_demo_backup) then raise exception 'Backup already captured; inspect before retry'; end if;
 lock table public.customer_portal_users,public.customer_offer_eligibility,public.ai_recommendations,public.conversations,
 public.contact_preferences,public.messages,public.message_revisions,public.message_approvals,public.delivery_outbox,
 public.interaction_events,public.follow_up_tasks,public.notifications,public.support_requests,public.retention_outcomes,
 public.intervention_costs,public.automation_jobs,public.retention_cases,public.prediction_contexts,
 public.churn_predictions,public.customer_snapshots,public.prediction_runs,public.customers in share row exclusive mode;
 for t in select tablename from pg_tables where schemaname='public' order by tablename loop
  execute format('insert into app_private.v4_demo_backup(table_name,payload) select %L,coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from public.%I x',t.tablename,t.tablename);
 end loop;
 truncate public.customer_portal_users,public.customer_offer_eligibility,public.ai_recommendations,public.conversations,
 public.contact_preferences,public.messages,public.message_revisions,public.message_approvals,public.delivery_outbox,
 public.interaction_events,public.follow_up_tasks,public.notifications,public.support_requests,public.retention_outcomes,
 public.intervention_costs,public.automation_jobs,public.retention_cases,public.prediction_contexts,
 public.churn_predictions,public.customer_snapshots,public.prediction_runs,public.customers;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 for item in select payload from app_private.v5_import_stage order by customer_ref loop
  p:=item.payload;
  perform public.retention_ingest_prediction(p->'p_run',p->>'p_customer_ref',p->'p_features',p->'p_prediction',p->'p_context',p->'p_profile');
 end loop;
 -- Preserve any existing consent/opt-out for matching fictional customers; never grant new consent.
 insert into public.contact_preferences(customer_id,channel,contact_allowed,opt_out_at,consent_basis,evidence_ref,updated_at)
 select c.id,pref->>'channel',(pref->>'contact_allowed')::boolean,(pref->>'opt_out_at')::timestamptz,
  pref->>'consent_basis',pref->>'evidence_ref',(pref->>'updated_at')::timestamptz
 from app_private.v4_demo_backup b cross join lateral jsonb_array_elements(b.payload) pref
 join app_private.v4_demo_backup old on old.table_name='customers'
 cross join lateral jsonb_array_elements(old.payload) oc
 join public.customers c on c.customer_ref=oc->>'customer_ref'
 where b.table_name='contact_preferences' and oc->>'id'=pref->>'customer_id';
 select user_id into agent from public.staff_members where active and role='agent' order by user_id limit 1;
 select (u->>'user_id')::uuid into portal from app_private.v4_demo_backup b cross join lateral jsonb_array_elements(b.payload) u where b.table_name='customer_portal_users' limit 1;
 select c.* into selected from public.retention_cases c join public.churn_predictions p on p.id=c.prediction_id order by p.churn_probability desc,c.id limit 1;
 if agent is not null then update public.retention_cases set assigned_agent_id=agent where id=selected.id; end if;
 if portal is not null then
  insert into public.customer_portal_users(user_id,customer_id) values(portal,selected.customer_id);
  insert into public.conversations(case_id,customer_id,selected_channel) values(selected.id,selected.customer_id,'Zalo');
 end if;
 if (select count(*) from public.customers)<>2705 or (select count(*) from public.retention_cases)<>207
  or (select count(*) from public.prediction_contexts)<>2705 then raise exception 'Cutover reconciliation failed'; end if;
 if exists(select 1 from public.customers where source_dataset<>'synthetic_rolling_month_v5') then raise exception 'Old active data remains'; end if;
 if exists(select 1 from public.automation_jobs) or exists(select 1 from public.delivery_outbox) then raise exception 'Unexpected automated work'; end if;
end $$;
commit;
select (select count(*) from public.customers) as customers,(select count(*) from public.retention_cases) as cases,
 (select count(*) from app_private.v4_demo_backup) as backup_tables,(select count(*) from public.staff_members) as staff;
