-- Rolling calendar-month inference; no training labels or outbound execution.
alter table public.prediction_runs drop constraint prediction_runs_check;
alter table public.prediction_runs add constraint prediction_runs_schedule check (extract(day from target_period_start) in (1,11,21));
alter table public.prediction_runs add column target_period_end_exclusive date generated always as ((target_period_start + interval '1 month')::date) stored;
alter table public.churn_predictions add column target_period_end_exclusive date generated always as ((target_period_start + interval '1 month')::date) stored;
alter table public.retention_cases add column target_period_end_exclusive date generated always as ((target_period_start + interval '1 month')::date) stored;
alter table public.customer_snapshots drop constraint customer_snapshots_snapshot_basis_check;
alter table public.customer_snapshots alter column snapshot_basis set default 'synthetic_rolling_month';
alter table public.customer_snapshots add constraint customer_snapshots_snapshot_basis_check check (snapshot_basis in ('synthetic_month_end','synthetic_rolling_month'));
insert into app_private.feature_contracts(dataset_version,feature_names,model_sha256,explanation_version,group_ids) values ('synthetic_rolling_month_v5',array['disconnect_count_30d','outage_minutes_30d','evening_speed_ratio_30d','service_issue_days_30d','usage_gb_7d','usage_gb_30d','usage_change_pct_30d','inactive_days_14d','monthly_fee_vnd','fee_change_pct_30d','overdue_days','overdue_amount_vnd','billing_mode','prepaid_days_remaining','promo_days_remaining','support_contacts_30d','unresolved_tickets_30d','repeat_contacts_30d','avg_resolution_hours_90d','tenure_months','plan_speed_mbps','plan_change_requests_30d','oldest_open_ticket_days','consecutive_issue_months','usage_change_pct_7d','disconnect_count_7d','outage_minutes_7d','evening_speed_ratio_7d','service_issue_days_7d','inactive_days_7d','support_contacts_7d','repeat_contacts_7d','opened_tickets_7d','unresolved_tickets_7d','avg_resolution_hours_7d','plan_change_requests_7d','disconnect_count_14d','outage_minutes_14d','evening_speed_ratio_14d','service_issue_days_14d','usage_gb_14d','support_contacts_14d','repeat_contacts_14d','opened_tickets_14d','unresolved_tickets_14d','avg_resolution_hours_14d','plan_change_requests_14d','inactive_days_30d','opened_tickets_30d','avg_resolution_hours_30d','disconnect_count_60d','outage_minutes_60d','evening_speed_ratio_60d','service_issue_days_60d','usage_gb_60d','inactive_days_60d','support_contacts_60d','repeat_contacts_60d','opened_tickets_60d','unresolved_tickets_60d','avg_resolution_hours_60d','plan_change_requests_60d','disconnect_count_90d','outage_minutes_90d','evening_speed_ratio_90d','service_issue_days_90d','usage_gb_90d','inactive_days_90d','support_contacts_90d','repeat_contacts_90d','opened_tickets_90d','unresolved_tickets_90d','plan_change_requests_90d','usage_change_pct_14d','usage_change_pct_60d','usage_change_pct_90d','fee_change_pct_60d','fee_change_pct_90d','due_invoice_count_30d','late_invoice_count_30d','late_invoice_rate_30d','observed_delay_mean_days_30d','observed_delay_max_days_30d','late_paid_invoice_count_30d','on_time_paid_invoice_rate_30d','unpaid_overdue_invoice_count_30d','unpaid_overdue_amount_vnd_30d','due_cohort_paid_ratio_30d','payment_count_30d','paid_amount_vnd_30d','due_invoice_count_60d','late_invoice_count_60d','late_invoice_rate_60d','observed_delay_mean_days_60d','observed_delay_max_days_60d','late_paid_invoice_count_60d','on_time_paid_invoice_rate_60d','unpaid_overdue_invoice_count_60d','unpaid_overdue_amount_vnd_60d','due_cohort_paid_ratio_60d','payment_count_60d','paid_amount_vnd_60d','due_invoice_count_90d','late_invoice_count_90d','late_invoice_rate_90d','observed_delay_mean_days_90d','observed_delay_max_days_90d','late_paid_invoice_count_90d','on_time_paid_invoice_rate_90d','unpaid_overdue_invoice_count_90d','unpaid_overdue_amount_vnd_90d','due_cohort_paid_ratio_90d','payment_count_90d','paid_amount_vnd_90d','current_overdue_invoice_count','current_overdue_days_mean','current_overdue_amount_to_fee','days_since_last_payment','last_payment_delay_days','consecutive_late_invoice_count','delay_change_recent3_vs_previous3_days','late_rate_change_recent3_vs_previous3','current_overdue_count_ge_7d','current_overdue_count_ge_30d','current_overdue_count_ge_60d','current_overdue_amount_ge_30d_vnd','current_overdue_amount_ge_60d_vnd'],'881dc8ed7252389256e2c2fd20fb3c558c74e0fdbc43165f02946059ee6217a4','lightgbm_tuned_127_groups_v5',array['connection_quality','support_experience','payment_overdue','usage_engagement','renewal_promotion','plan_pricing_relationship']);
create or replace function public.retention_ingest_prediction(p_run jsonb,p_customer_ref text,p_features jsonb,
  p_prediction jsonb,p_context jsonb default null,p_profile jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_names text[]; v_keys text[]; v_run public.prediction_runs;
  v_customer uuid; v_snap public.customer_snapshots; v_p public.churn_predictions;
  v_case uuid; v_prob numeric; v_job uuid; v_hash text; v_driver jsonb; v_fact jsonb;
  v_contract app_private.feature_contracts;
begin
  perform app_private.require_worker();
  if p_run is null or jsonb_typeof(p_run)<>'object' or p_prediction is null
    or jsonb_typeof(p_prediction)<>'object' or p_features is null or jsonb_typeof(p_features)<>'object' then
    raise exception 'Object payloads required'; end if;
  if coalesce((p_run->>'is_synthetic')::boolean,false) is not true then raise exception 'Synthetic demo contract required'; end if;
  select array_agg(x order by x) into v_names from app_private.feature_contracts c,
    unnest(c.feature_names) x where c.dataset_version=p_run->>'dataset_version';
  select array_agg(x order by x) into v_keys from jsonb_object_keys(p_features) x;
  if v_names is null or v_names is distinct from v_keys then raise exception 'Expected exactly the registered 127 features'; end if;
  if exists(select 1 from jsonb_each(p_features) f where
    (f.key='billing_mode' and f.value not in ('null'::jsonb,'"Prepaid"'::jsonb,'"Postpaid"'::jsonb))
    or (f.key<>'billing_mode' and jsonb_typeof(f.value) not in ('number','null'))) then
    raise exception 'Feature values must be numeric/null or the registered billing category'; end if;
  -- Known model metadata and date/probability must be supplied, never defaulted.
  if p_run ? 'target_period_end_exclusive' and (p_run->>'target_period_end_exclusive')::date is distinct from ((p_run->>'target_period_start')::date+interval '1 month')::date then raise exception 'Rolling window end mismatch'; end if;
  v_prob:=(p_prediction->>'churn_probability')::numeric;
  if v_prob is null then raise exception 'Probability required'; end if;
  insert into public.prediction_runs(run_key,dataset_version,model_version,calibration_version,
    snapshot_date,target_period_start,source_sha256,is_synthetic)
    values(p_run->>'run_key',p_run->>'dataset_version',p_run->>'model_version',p_run->>'calibration_version',
      (p_run->>'snapshot_date')::date,(p_run->>'target_period_start')::date,p_run->>'source_sha256',true)
    on conflict(run_key) do nothing;
  select * into v_run from public.prediction_runs where run_key=p_run->>'run_key' for update;
  if v_run.dataset_version is distinct from p_run->>'dataset_version'
    or v_run.model_version is distinct from p_run->>'model_version'
    or v_run.calibration_version is distinct from p_run->>'calibration_version'
    or v_run.source_sha256 is distinct from p_run->>'source_sha256'
    or v_run.snapshot_date is distinct from (p_run->>'snapshot_date')::date
    or v_run.target_period_start is distinct from (p_run->>'target_period_start')::date then
    raise exception 'Run key metadata conflict'; end if;
  insert into public.customers(customer_ref,source_dataset,is_synthetic,display_name,contract_ref,
    plan_name,monthly_fee,currency,billing_mode,tenure_months,profile_source)
    values(p_customer_ref,v_run.dataset_version,true,p_profile->>'display_name',p_profile->>'contract_ref',
      p_profile->>'plan_name',(p_profile->>'monthly_fee')::numeric,coalesce(p_profile->>'currency','VND'),
      p_profile->>'billing_mode',(p_profile->>'tenure_months')::integer,'synthetic_demo')
    on conflict(source_dataset,customer_ref) do nothing;
  select id into v_customer from public.customers where customer_ref=p_customer_ref and source_dataset=v_run.dataset_version;
  insert into public.customer_snapshots(customer_id,snapshot_date,dataset_version,features)
    values(v_customer,v_run.snapshot_date,v_run.dataset_version,p_features)
    on conflict(customer_id,snapshot_date,dataset_version) do nothing;
  select * into v_snap from public.customer_snapshots where customer_id=v_customer
    and snapshot_date=v_run.snapshot_date and dataset_version=v_run.dataset_version;
  if v_snap.features is distinct from p_features then raise exception 'Frozen snapshot conflict'; end if;
  insert into public.churn_predictions(customer_id,snapshot_id,run_id,snapshot_date,target_period_start,
    raw_probability,churn_probability,explanations_status,explanation_version)
    values(v_customer,v_snap.id,v_run.id,v_run.snapshot_date,v_run.target_period_start,
      (p_prediction->>'raw_probability')::numeric,v_prob,p_prediction->>'explanations_status',p_prediction->>'explanation_version')
    on conflict(run_id,customer_id) do nothing;
  select * into v_p from public.churn_predictions where run_id=v_run.id and customer_id=v_customer;
  if v_p.churn_probability is distinct from v_prob or v_p.raw_probability is distinct from (p_prediction->>'raw_probability')::numeric
    or v_p.explanation_version is distinct from p_prediction->>'explanation_version'
    or v_p.explanations_status is distinct from p_prediction->>'explanations_status' then raise exception 'Frozen prediction conflict'; end if;
  if p_context is not null then
    select * into v_contract from app_private.feature_contracts where dataset_version=v_run.dataset_version;
    if jsonb_typeof(p_context)<>'object' or
      exists(select 1 from jsonb_object_keys(p_context) k where k not in
        ('customer_id','snapshot_date','target_period_start','target_period_end_exclusive','model_version','model_sha256','explanation_version',
         'shap_method','shap_output_space','base_value','churn_probability','calibrator_method','is_synthetic',
         'label_status','title','drivers','explanation_source','requires_staff_review','customer_outbound_allowed'))
      or p_context->>'customer_id' is distinct from p_customer_ref
      or (p_context->>'snapshot_date')::date is distinct from v_run.snapshot_date
      or (p_context->>'target_period_start')::date is distinct from v_run.target_period_start
      or (p_context ? 'target_period_end_exclusive' and (p_context->>'target_period_end_exclusive')::date is distinct from v_run.target_period_end_exclusive)
      or p_context->>'model_version' is distinct from v_run.model_version
      or p_context->>'model_sha256' is distinct from v_contract.model_sha256
      or p_context->>'explanation_version' is distinct from v_contract.explanation_version
      or p_context->>'explanation_version' is distinct from v_p.explanation_version
      or (p_context->>'churn_probability')::numeric is distinct from v_prob
      or p_context->>'label_status' is distinct from 'Unknown'
      or (p_context->>'requires_staff_review')::boolean is distinct from true
      or (p_context->>'customer_outbound_allowed')::boolean is distinct from false
      or (p_context->>'is_synthetic')::boolean is distinct from true
      or jsonb_typeof(p_context->'drivers') is distinct from 'array' then raise exception 'Care context contract mismatch'; end if;
    if jsonb_array_length(p_context->'drivers')>3 then raise exception 'At most three positive driver groups'; end if;
    for v_driver in select * from jsonb_array_elements(p_context->'drivers') loop
      if jsonb_typeof(v_driver)<>'object' or ((v_driver->>'group_id')=any(v_contract.group_ids)) is distinct from true
        or (v_driver->>'requires_staff_review')::boolean is distinct from true
        or jsonb_typeof(v_driver->'facts') is distinct from 'array'
        or exists(select 1 from jsonb_object_keys(v_driver) k where k not in
          ('rank','group_id','group_name','contribution_log_odds','facts','evidence_status',
           'supports_customer_situation_claim','explanation_draft','suggested_action','requires_staff_review')) then
        raise exception 'Driver contract mismatch'; end if;
      if p_features->>'billing_mode'='Prepaid' and v_driver->>'group_id'='payment_overdue'
        and ((v_driver->>'supports_customer_situation_claim')::boolean is distinct from false
          or coalesce(v_driver->>'evidence_status','') not like 'Not applicable%') then
        raise exception 'Prepaid billing is not evidence of overdue postpaid debt'; end if;
      for v_fact in select * from jsonb_array_elements(v_driver->'facts') loop
        if jsonb_typeof(v_fact)<>'object' or ((v_fact->>'feature')=any(v_names)) is distinct from true
          or exists(select 1 from jsonb_object_keys(v_fact) k where k not in
            ('feature','label','value','unit','window_days','family','missing','model_contribution_log_odds','observation')) then
          raise exception 'Fact must reference whitelisted feature'; end if;
      end loop;
    end loop;
    insert into public.prediction_contexts(prediction_id,explanation_version,context)
      values(v_p.id,v_p.explanation_version,p_context) on conflict(prediction_id,explanation_version) do nothing;
    if not exists(select 1 from public.prediction_contexts where prediction_id=v_p.id
      and explanation_version=v_p.explanation_version and context=p_context) then raise exception 'Frozen context conflict'; end if;
  end if;
  if v_prob>0.5 then
    insert into public.retention_cases(customer_id,prediction_id,target_period_start,priority)
      values(v_customer,v_p.id,v_run.target_period_start,case when v_prob>=0.75 then 'high' else 'normal' end)
      on conflict(customer_id,target_period_start) do nothing;
    select id into v_case from public.retention_cases where customer_id=v_customer and target_period_start=v_run.target_period_start;
    -- AI is requested explicitly by staff, never by batch ingestion.
  end if;
  return jsonb_build_object('customer_id',v_customer,'prediction_id',v_p.id,'case_id',v_case);
end $$;
create or replace view public.retention_care_queue with (security_invoker=true) as
select c.id as case_id,c.customer_id,cu.customer_ref,cu.display_name,cu.contract_ref,
  cu.plan_name,cu.monthly_fee,cu.currency,c.target_period_start,c.case_status,c.contact_result,
  c.priority,c.due_at,c.created_at,c.last_contact_at,c.assigned_agent_id,s.display_name as case_owner,
  p.churn_probability,p.churn_score,p.explanations_status,cu.is_synthetic,
  (select count(*) from public.support_requests sr where sr.case_id=c.id and sr.handoff_status='sent') as support_referrals,
  (select count(*) from public.messages m where m.case_id=c.id and m.direction='outbound' and m.approval_status in ('draft','pending_approval')) as pending_drafts,
  (select count(*) from public.follow_up_tasks t where t.case_id=c.id and t.status in ('pending','due') and t.due_at<=now()) as due_tasks,
  case c.case_status when 'new' then 'intake' when 'closed' then 'care_completed'
    when 'resolving_request' then 'resolution' else 'outreach' end as care_stage,
  (select o.churned from public.retention_outcomes o where o.case_id=c.id
    and o.window_start=c.target_period_start
    and o.window_end=c.target_period_end_exclusive-1
    and o.observed_at>=(c.target_period_end_exclusive::timestamp at time zone 'Asia/Ho_Chi_Minh')
    order by o.updated_at desc limit 1) as outcome_churned, c.target_period_end_exclusive
from public.retention_cases c join public.customers cu on cu.id=c.customer_id
  join public.churn_predictions p on p.id=c.prediction_id
  left join public.staff_members s on s.user_id=c.assigned_agent_id;
create or replace function public.retention_record_outcome(p_case_id uuid,p_churned boolean,p_source text,
  p_is_simulated boolean,p_observed_at timestamptz default null,p_evidence_ref text default null,
  p_offer_accepted boolean default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_case public.retention_cases; v_end date; v_id uuid;
begin
  select * into v_case from public.retention_cases where id=p_case_id for update;
  perform app_private.require_staff(p_case_id);
  v_end:=v_case.target_period_end_exclusive-1;
  if not p_is_simulated and exists(select 1 from public.customers where id=v_case.customer_id and is_synthetic) then
    raise exception 'Synthetic customer requires simulated outcome flag'; end if;
  if p_churned is not null and (p_observed_at is null or p_evidence_ref is null or
    p_observed_at>now() or p_observed_at < ((v_end+1)::timestamp at time zone 'Asia/Ho_Chi_Minh')) then
    raise exception 'Observed outcome requires evidence after the complete target period'; end if;
  insert into public.retention_outcomes(case_id,window_start,window_end,churned,offer_accepted,
    observed_at,source,evidence_ref,is_simulated,recorded_by)
    values(p_case_id,v_case.target_period_start,v_end,p_churned,p_offer_accepted,p_observed_at,
      p_source,p_evidence_ref,p_is_simulated,auth.uid())
    on conflict(case_id,window_start,window_end) do update set churned=excluded.churned,
      offer_accepted=excluded.offer_accepted,observed_at=excluded.observed_at,source=excluded.source,
      evidence_ref=excluded.evidence_ref,is_simulated=excluded.is_simulated,recorded_by=auth.uid(),updated_at=now()
    returning id into v_id;
  insert into public.interaction_events(case_id,event_type,actor_user_id,metadata)
    values(p_case_id,'outcome.recorded',auth.uid(),jsonb_build_object('outcome_id',v_id,'churned',p_churned,'is_simulated',p_is_simulated));
  return v_id;
end $$;
create or replace function public.retention_worker_context(p_job_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_job public.automation_jobs; v_case public.retention_cases; v_context jsonb;
begin
  perform app_private.require_worker();
  select * into v_job from public.automation_jobs where id=p_job_id and status='queued';
  if not found then raise exception 'Job is not pending'; end if;
  select * into v_case from public.retention_cases where id=v_job.case_id;
  select context into v_context from public.prediction_contexts where prediction_id=v_case.prediction_id order by created_at desc limit 1;
  -- Deliberately omit feature vectors, score, raw SHAP, labels and generator audit.
  -- Customer text is untrusted content, never an instruction to override policy.
  return jsonb_build_object('snapshot_date',(select snapshot_date from public.churn_predictions where id=v_case.prediction_id),'target_period_start',v_case.target_period_start,'target_period_end_exclusive',v_case.target_period_end_exclusive,'requested_at',v_job.created_at,'current_time',now(),'rewrite_instructions',v_job.rewrite_instructions,'rewrite_source_text',v_job.rewrite_source_text,'case_id',v_case.id,'care_stage',v_case.case_status,'contact_result',v_case.contact_result,'requested_output',case when split_part(v_job.request_key,':',1)='manual' then split_part(v_job.request_key,':',2) else 'care_pack' end,'language','English','requires_staff_review',true,
    'customer',(select jsonb_build_object('display_name',display_name,'plan_name',plan_name,
      'monthly_fee',monthly_fee,'currency',currency,'billing_mode',billing_mode,'tenure_months',tenure_months)
      from public.customers where id=v_case.customer_id),
    'driver_groups',coalesce((select jsonb_agg(jsonb_build_object('rank',d->'rank','group_name',d->'group_name',
      'evidence_status',d->'evidence_status','supports_customer_situation_claim',d->'supports_customer_situation_claim',
      'suggested_action',d->'suggested_action','facts',coalesce((select jsonb_agg(jsonb_build_object('label',f->'label',
        'value',f->'value','unit',f->'unit','missing',f->'missing','observation',f->'observation'))
        from jsonb_array_elements(d->'facts') f),'[]'))) from jsonb_array_elements(v_context->'drivers') d),'[]'),
    'eligible_offers',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'title',o.title,'description',o.description,
      'requires_supervisor',o.requires_supervisor)) from public.offers o join public.customer_offer_eligibility e on e.offer_id=o.id
      where e.customer_id=v_case.customer_id and e.eligible and e.valid_until>now()
        and o.active and o.valid_from<=now() and o.valid_until>now()),'[]'),
    'conversation',coalesce((select jsonb_agg(jsonb_build_object('direction',m.direction,'body',r.body,'created_at',m.created_at,'sent_at',m.sent_at)
      order by coalesce(m.sent_at,m.created_at),m.id) from public.messages m join public.message_revisions r on r.message_id=m.id
        and r.revision=case when m.direction='outbound' then m.sent_revision else m.current_revision end
      where m.case_id=v_case.id and m.visibility='external' and
        (m.direction='inbound' or (m.direction='outbound' and m.delivery_status='sent'))),'[]'));
end $$;
notify pgrst, 'reload schema';

-- Private staging/recovery only; no Data API or worker grants.
create table app_private.v5_import_stage(customer_ref text primary key,payload jsonb not null check(jsonb_typeof(payload)='object'));
alter table app_private.v5_import_stage enable row level security;
revoke all on app_private.v5_import_stage from public,anon,authenticated,service_role;
create table app_private.v4_demo_backup(table_name text primary key,payload jsonb not null,captured_at timestamptz not null default now());
alter table app_private.v4_demo_backup enable row level security;
revoke all on app_private.v4_demo_backup from public,anon,authenticated,service_role;
