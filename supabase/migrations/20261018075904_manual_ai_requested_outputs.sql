create or replace function public.retention_complete_job(p_job_id uuid,
  p_action text,p_rationale text,p_message_body text,p_generation_mode text,
  p_model_version text,p_prompt_version text,p_call_script text default null,
  p_missing_fields jsonb default '[]',p_offer_id uuid default null,
  p_prediction_context_id uuid default null,p_channel text default 'Zalo') returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_job public.automation_jobs; v_case public.retention_cases; v_rec uuid; v_conv uuid; v_message uuid; v_output text;
begin
  perform app_private.require_worker();
  select c.* into v_case from public.retention_cases c join public.automation_jobs j on j.case_id=c.id
    where j.id=p_job_id for update of c;
  select * into v_job from public.automation_jobs where id=p_job_id for update;
  if v_job.status='completed' then
    select id into v_rec from public.ai_recommendations where request_key=v_job.request_key;
    select id into v_message from public.messages where recommendation_id=v_rec;
    return jsonb_build_object('status','completed','recommendation_id',v_rec,'message_id',v_message,'revision',case when v_message is null then null else 1 end);
  end if;
  if v_job.id is null or v_job.status<>'queued' then raise exception 'Job is not pending'; end if;
  if v_case.case_status='closed' then raise exception 'Case closed'; end if;
  if p_prediction_context_id is not null and not exists(select 1 from public.prediction_contexts
    where id=p_prediction_context_id and prediction_id=v_case.prediction_id) then raise exception 'Context mismatch'; end if;
  if p_offer_id is not null and not exists(select 1 from public.customer_offer_eligibility e
    join public.offers o on o.id=e.offer_id where e.customer_id=v_case.customer_id and e.offer_id=p_offer_id
      and e.eligible and e.valid_until>now() and o.active and o.valid_from<=now() and o.valid_until>now()) then
    raise exception 'Offer unavailable or ineligible'; end if;
  v_output:=case when split_part(v_job.request_key,':',1)='manual' then split_part(v_job.request_key,':',2) else 'care_pack' end;
  if v_output='call_script' and nullif(btrim(p_call_script),'') is null then raise exception 'Call script required'; end if;
  if v_output in ('call_script','explanation') and p_message_body is not null then raise exception 'This request must not create an outbound message'; end if;
  if nullif(btrim(p_rationale),'') is null then raise exception 'Rationale required'; end if;
  insert into public.ai_recommendations(case_id,prediction_context_id,request_key,action,offer_id,
    rationale,call_script,missing_fields,generation_mode,model_version,prompt_version)
    values(v_case.id,p_prediction_context_id,v_job.request_key,p_action,p_offer_id,p_rationale,
      p_call_script,p_missing_fields,p_generation_mode,p_model_version,p_prompt_version) returning id into v_rec;
  if v_output not in ('call_script','explanation') then
  insert into public.conversations(case_id,customer_id,selected_channel) values(v_case.id,v_case.customer_id,p_channel)
    on conflict(case_id,selected_channel) do update set selected_channel=excluded.selected_channel returning id into v_conv;
  insert into public.messages(case_id,conversation_id,sender_type,direction,visibility,ai_generated,recommendation_id)
    values(v_case.id,v_conv,'ai','outbound','external',true,v_rec) returning id into v_message;
  insert into public.message_revisions(message_id,revision,body,content_hash,offer_id,request_key)
    values(v_message,1,p_message_body,encode(sha256(convert_to(p_message_body,'UTF8')),'hex'),p_offer_id,'job:'||v_job.id);
  end if;
  update public.automation_jobs set status='completed',completed_at=now() where id=v_job.id;
  insert into public.interaction_events(case_id,message_id,event_type,metadata)
    values(v_case.id,v_message,'recommendation.drafted',jsonb_build_object('recommendation_id',v_rec,'generation_mode',p_generation_mode));
  return jsonb_build_object('status','completed','recommendation_id',v_rec,'message_id',v_message,'revision',case when v_message is null then null else 1 end);
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
  return jsonb_build_object('case_id',v_case.id,'requested_output',case when split_part(v_job.request_key,':',1)='manual' then split_part(v_job.request_key,':',2) else 'care_pack' end,'language','English','requires_staff_review',true,
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
    'conversation',coalesce((select jsonb_agg(jsonb_build_object('direction',m.direction,'body',r.body,'created_at',m.created_at)
      order by m.created_at,m.id) from public.messages m join public.message_revisions r on r.message_id=m.id
        and r.revision=case when m.direction='outbound' then m.sent_revision else m.current_revision end
      where m.case_id=v_case.id and m.visibility='external' and
        (m.direction='inbound' or (m.direction='outbound' and m.delivery_status='sent'))),'[]'));
end $$;
notify pgrst, 'reload schema';
