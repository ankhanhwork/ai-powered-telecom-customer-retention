-- Prevent repeated UI requests and overlapping executions from repeating model calls.
alter table public.automation_jobs add column if not exists claimed_at timestamptz;
alter table public.ai_recommendations add column if not exists used_at timestamptz;
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
  select id,case_id into v_id,v_old_case from public.automation_jobs where request_key=p_request_key;
  if found then
    if v_old_case<>p_case_id or not exists(select 1 from public.automation_jobs where id=v_id and rewrite_instructions is not distinct from v_instructions and rewrite_source_text is not distinct from v_source) then raise exception 'Request key conflict'; end if;
    return v_id;
  end if;
  update public.automation_jobs set status='failed',completed_at=now()
    where case_id=p_case_id and status='queued' and claimed_at<now()-interval '5 minutes';
  if split_part(p_request_key,':',1)='manual' then
    select id into v_id from public.automation_jobs where case_id=p_case_id
      and split_part(request_key,':',1)='manual' and split_part(request_key,':',2)=split_part(p_request_key,':',2)
      and (status='queued' or (status='completed' and completed_at>now()-interval '15 seconds'
        and rewrite_instructions is not distinct from v_instructions and rewrite_source_text is not distinct from v_source))
      order by created_at desc limit 1;
    if found then return v_id; end if;
  end if;
  insert into public.automation_jobs(case_id,job_type,request_key,rewrite_instructions,rewrite_source_text)
    values(p_case_id,'recommendation',p_request_key,v_instructions,v_source) returning id into v_id;
  return v_id;
end $$;

create or replace function public.retention_pending_jobs(p_limit integer default 10,p_output text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform app_private.require_worker();
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid limit'; end if;
  if p_output is not null and p_output not in ('message','call_script','explanation') then raise exception 'Invalid output'; end if;
  update public.automation_jobs set status='failed',completed_at=now() where status='queued' and claimed_at<now()-interval '5 minutes';
  return (select coalesce(jsonb_agg(to_jsonb(j) order by j.created_at,j.id),'[]') from (
    select j.* from public.automation_jobs j join public.retention_cases c on c.id=j.case_id
    where j.status='queued' and j.claimed_at is null and c.case_status<>'closed' and (p_output is null or split_part(j.request_key,':',2)=p_output) order by j.created_at,j.id limit p_limit) j);
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
  return jsonb_build_object('snapshot_date',(select snapshot_date from public.churn_predictions where id=v_case.prediction_id),'target_period_start',v_case.target_period_start,'requested_at',v_job.created_at,'current_time',now(),'rewrite_instructions',v_job.rewrite_instructions,'rewrite_source_text',v_job.rewrite_source_text,'case_id',v_case.id,'care_stage',v_case.case_status,'contact_result',v_case.contact_result,'requested_output',case when split_part(v_job.request_key,':',1)='manual' then split_part(v_job.request_key,':',2) else 'care_pack' end,'language','English','requires_staff_review',true,
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

create or replace function public.retention_claim_ai_request(p_job_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_job public.automation_jobs;
begin
 perform app_private.require_worker();
 perform 1 from public.retention_cases c join public.automation_jobs j on j.case_id=c.id
   where j.id=p_job_id and c.case_status<>'closed' for update of c;
 if not found then return '[]'::jsonb; end if;
 update public.automation_jobs set claimed_at=now() where id=p_job_id and status='queued' and claimed_at is null returning * into v_job;
 if not found then return '[]'::jsonb; end if;
 return jsonb_build_array(to_jsonb(v_job));
end $$;
revoke all on function public.retention_claim_ai_request(uuid) from public,anon,authenticated;
grant execute on function public.retention_claim_ai_request(uuid) to service_role;


create or replace function public.retention_mark_script_used(p_recommendation_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_case uuid;
begin
 select case_id into v_case from public.ai_recommendations where id=p_recommendation_id
   and request_key like 'manual:call_script:%' and call_script is not null;
 if not found then raise exception 'Call script not found'; end if;
 perform 1 from public.retention_cases where id=v_case for update;
 perform app_private.require_staff(v_case);
 update public.ai_recommendations set used_at=coalesce(used_at,now()) where id=p_recommendation_id;
end $$;
revoke all on function public.retention_mark_script_used(uuid) from public,anon,service_role;
grant execute on function public.retention_mark_script_used(uuid) to authenticated;

notify pgrst,'reload schema';
