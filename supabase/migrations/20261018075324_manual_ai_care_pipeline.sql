-- Explicit staff AI requests; care progress and observed outcomes remain separate.
alter table public.retention_cases drop constraint retention_cases_case_status_check;
alter table public.retention_cases add constraint retention_cases_case_status_check check(case_status in ('new','in_progress','waiting_customer','resolving_request','closed'));


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
        ('customer_id','snapshot_date','target_period_start','model_version','model_sha256','explanation_version',
         'shap_method','shap_output_space','base_value','churn_probability','calibrator_method','is_synthetic',
         'label_status','title','drivers','explanation_source','requires_staff_review','customer_outbound_allowed'))
      or p_context->>'customer_id' is distinct from p_customer_ref
      or (p_context->>'snapshot_date')::date is distinct from v_run.snapshot_date
      or (p_context->>'target_period_start')::date is distinct from v_run.target_period_start
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

create or replace function public.retention_portal_send(p_conversation_id uuid,p_body text,p_event_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_customer uuid; v_conv public.conversations; v_id uuid; v_event uuid; v_old public.messages;
begin
  v_customer:=app_private.require_portal(p_conversation_id);
  select * into v_conv from public.conversations where id=p_conversation_id;
  perform 1 from public.retention_cases where id=v_conv.case_id for update;
  if v_conv.status<>'open' or exists(select 1 from public.retention_cases where id=v_conv.case_id and case_status='closed') then
    raise exception 'Conversation closed'; end if;
  if p_event_key is null or length(btrim(p_event_key))=0 then raise exception 'Event key required'; end if;
  select m.* into v_old from public.interaction_events e join public.messages m on m.id=e.message_id
    where e.channel=v_conv.selected_channel and e.provider_event_id='portal:'||p_event_key;
  if found then
    if v_old.conversation_id<>p_conversation_id or v_old.sender_user_id<>auth.uid()
      or not exists(select 1 from public.message_revisions where message_id=v_old.id and body=p_body) then
      raise exception 'Event key conflict'; end if;
    return v_old.id;
  end if;
  insert into public.messages(case_id,conversation_id,sender_type,sender_user_id,direction,visibility,approval_status,delivery_status)
    values(v_conv.case_id,p_conversation_id,'customer',auth.uid(),'inbound','external','not_required','received') returning id into v_id;
  insert into public.message_revisions(message_id,revision,body,content_hash,created_by,request_key)
    values(v_id,1,p_body,encode(sha256(convert_to(p_body,'UTF8')),'hex'),auth.uid(),'portal:'||p_event_key);
  insert into public.interaction_events(case_id,message_id,event_type,actor_user_id,channel,provider_event_id)
    values(v_conv.case_id,v_id,'message.received',auth.uid(),v_conv.selected_channel,'portal:'||p_event_key) returning id into v_event;
  perform app_private.cancel_pending(v_conv.case_id,'customer_replied');
  update public.automation_jobs set status='cancelled' where case_id=v_conv.case_id and status='queued';
  update public.retention_cases set case_status='in_progress',contact_result='contacted',updated_at=now() where id=v_conv.case_id;
  perform app_private.notify_case(v_conv.case_id,'new_message','New customer message','inbound:'||v_id,v_event);
  -- A reply notifies staff; another AI draft requires a staff request.
  return v_id;
end $$;

update public.automation_jobs set status='cancelled' where status='queued' and (request_key like 'initial:%' or request_key like 'inbound:%');

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
    and o.window_end=(c.target_period_start+interval '1 month')::date-1
    and o.observed_at>=((c.target_period_start+interval '1 month')::timestamp at time zone 'Asia/Ho_Chi_Minh')
    order by o.updated_at desc limit 1) as outcome_churned
from public.retention_cases c join public.customers cu on cu.id=c.customer_id
  join public.churn_predictions p on p.id=c.prediction_id
  left join public.staff_members s on s.user_id=c.assigned_agent_id;

notify pgrst, 'reload schema';