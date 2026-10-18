-- Staff rewrite requests retain instructions and the selected source text.
alter table public.automation_jobs
  add column if not exists rewrite_instructions text check(length(rewrite_instructions)<=2000),
  add column if not exists rewrite_source_text text check(length(rewrite_source_text)<=10000);
drop function if exists public.retention_request_recommendation(uuid,text);


create or replace function public.retention_request_recommendation(p_case_id uuid,p_request_key text,
  p_instructions text default null,p_source_text text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_old_case uuid; v_instructions text:=nullif(btrim(p_instructions),''); v_source text:=nullif(btrim(p_source_text),'');
begin
  perform 1 from public.retention_cases where id=p_case_id and case_status<>'closed' for update;
  if not found then raise exception 'Case closed'; end if;
  perform app_private.require_staff(p_case_id);
  if length(p_instructions)>2000 or length(p_source_text)>10000 then raise exception 'Rewrite instructions or source text too long'; end if;
  if v_source is not null and v_instructions is null then raise exception 'Rewrite instructions required'; end if;
  if v_instructions is not null and (split_part(p_request_key,':',1)<>'manual' or split_part(p_request_key,':',2) not in ('message','call_script')) then
    raise exception 'Rewrite is only supported for message or call script requests'; end if;
  insert into public.automation_jobs(case_id,job_type,request_key,rewrite_instructions,rewrite_source_text)
    values(p_case_id,'recommendation',p_request_key,v_instructions,v_source) on conflict(request_key) do nothing returning id into v_id;
  if v_id is null then
    select id,case_id into v_id,v_old_case from public.automation_jobs where request_key=p_request_key;
    if v_old_case<>p_case_id or not exists(select 1 from public.automation_jobs where id=v_id and rewrite_instructions is not distinct from v_instructions and rewrite_source_text is not distinct from v_source) then raise exception 'Request key conflict'; end if;
  end if;
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
  return jsonb_build_object('rewrite_instructions',v_job.rewrite_instructions,'rewrite_source_text',v_job.rewrite_source_text,'case_id',v_case.id,'requested_output',case when split_part(v_job.request_key,':',1)='manual' then split_part(v_job.request_key,':',2) else 'care_pack' end,'language','English','requires_staff_review',true,
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

revoke all on function public.retention_request_recommendation(uuid,text,text,text) from public,anon,service_role;
grant execute on function public.retention_request_recommendation(uuid,text,text,text) to authenticated;
notify pgrst, 'reload schema';