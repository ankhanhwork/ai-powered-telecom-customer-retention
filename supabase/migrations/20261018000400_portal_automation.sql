create function app_private.notify_case(p_case uuid,p_type text,p_title text,p_key text,p_event uuid default null)
returns void language sql security definer set search_path='' as $$
  insert into public.notifications(recipient_user_id,case_id,type,title,idempotency_key,source_event_id)
    select s.user_id,c.id,p_type,p_title,p_key||':'||s.user_id,p_event
    from public.retention_cases c join public.staff_members s on s.active and
      (s.user_id=c.assigned_agent_id or (c.assigned_agent_id is null and s.role='supervisor'))
    where c.id=p_case on conflict(idempotency_key) do nothing
$$;

create function public.retention_portal_threads() returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('conversation_id',cv.id,
    'channel',cv.selected_channel,'transport',cv.transport,'status',cv.status,
    'display_name',c.display_name) order by cv.created_at),'[]')
  from public.conversations cv join public.customer_portal_users u on u.customer_id=cv.customer_id
    join public.customers c on c.id=cv.customer_id where u.user_id=auth.uid() and u.active
$$;
create function public.retention_portal_thread(p_conversation_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_customer uuid; v_result jsonb;
begin
  v_customer:=app_private.require_portal(p_conversation_id);
  select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'direction',m.direction,
    'body',r.body,'created_at',m.created_at,'sent_at',m.sent_at)
    order by coalesce(m.sent_at,m.created_at),m.id),'[]') into v_result
    from public.messages m join public.message_revisions r on r.message_id=m.id
      and r.revision=case when m.direction='outbound' then m.sent_revision else m.current_revision end
    where m.conversation_id=p_conversation_id and m.visibility='external'
      and (m.direction='inbound' or (m.direction='outbound' and m.delivery_status='sent'));
  return jsonb_build_object('conversation_id',p_conversation_id,'messages',v_result,'transport','mock');
end $$;
create function public.retention_portal_send(p_conversation_id uuid,p_body text,p_event_key text) returns uuid
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
create function public.retention_opt_out(p_conversation_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_customer uuid; v_conv public.conversations;
begin
  v_customer:=app_private.require_portal(p_conversation_id);
  select * into v_conv from public.conversations where id=p_conversation_id;
  perform 1 from public.retention_cases where id=v_conv.case_id for update;
  insert into public.contact_preferences(customer_id,channel,contact_allowed,opt_out_at,consent_basis,evidence_ref)
    values(v_customer,v_conv.selected_channel,false,now(),'customer_opt_out','portal:'||auth.uid())
    on conflict(customer_id,channel) do update set contact_allowed=false,opt_out_at=now(),
      consent_basis=excluded.consent_basis,evidence_ref=excluded.evidence_ref,updated_at=now();
  perform app_private.cancel_pending(v_conv.case_id,'opt_out');
  update public.automation_jobs set status='cancelled' where case_id=v_conv.case_id and status='queued';
  insert into public.interaction_events(case_id,event_type,actor_user_id,channel)
    values(v_conv.case_id,'contact.opted_out',auth.uid(),v_conv.selected_channel);
end $$;

create function public.retention_request_recommendation(p_case_id uuid,p_request_key text,
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
-- shortcut: one n8n AI workflow for the demo; overlapping runs may repeat an LLM
-- call, but completion is idempotent. Add claiming only when parallel workers are needed.
create function public.retention_pending_jobs(p_limit integer default 10,p_output text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  perform app_private.require_worker();
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid limit'; end if;
  if p_output is not null and p_output not in ('message','call_script','explanation') then raise exception 'Invalid output'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(j) order by j.created_at,j.id),'[]') from (
    select j.* from public.automation_jobs j join public.retention_cases c on c.id=j.case_id
    where j.status='queued' and c.case_status<>'closed' and (p_output is null or split_part(j.request_key,':',2)=p_output) order by j.created_at,j.id limit p_limit) j);
end $$;
create function public.retention_complete_job(p_job_id uuid,
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
-- Call only after n8n's configured retries are exhausted. Details stay in n8n.
create function public.retention_fail_job(p_job_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform app_private.require_worker();
  perform 1 from public.retention_cases c join public.automation_jobs j on j.case_id=c.id
    where j.id=p_job_id for update of c;
  if not found then raise exception 'Job not found'; end if;
  update public.automation_jobs set status='failed' where id=p_job_id and status='queued';
end $$;

create function public.retention_schedule_reminder(p_case_id uuid,p_due_at timestamptz,p_request_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_case public.retention_cases; v_id uuid;
begin
  select * into v_case from public.retention_cases where id=p_case_id for update;
  perform app_private.require_staff(p_case_id);
  if v_case.case_status='closed' or p_due_at is null or p_due_at<=now() then raise exception 'Future reminder for open case required'; end if;
  insert into public.follow_up_tasks(case_id,task_type,due_at,assigned_agent_id,idempotency_key)
    values(p_case_id,'manual_reminder',p_due_at,v_case.assigned_agent_id,p_request_key)
    on conflict(idempotency_key) do nothing returning id into v_id;
  if v_id is null then select id into v_id from public.follow_up_tasks where idempotency_key=p_request_key and case_id=p_case_id;
    if v_id is null then raise exception 'Request key conflict'; end if; end if;
  update public.retention_cases set due_at=(select min(due_at) from public.follow_up_tasks
    where case_id=p_case_id and status in ('pending','due')),updated_at=now() where id=p_case_id;
  return v_id;
end $$;
create function public.retention_process_followups(p_limit integer default 100) returns integer
language plpgsql security definer set search_path='' as $$
declare v_case public.retention_cases; v_task public.follow_up_tasks; v_n integer:=0;
begin
  perform app_private.require_worker();
  if p_limit not between 1 and 500 then raise exception 'Invalid limit'; end if;
  for v_case in select c.* from public.retention_cases c where exists(select 1 from public.follow_up_tasks t
    where t.case_id=c.id and t.status='pending' and t.due_at<=now())
    order by c.created_at limit p_limit for update of c skip locked loop
    for v_task in select * from public.follow_up_tasks where case_id=v_case.id and status='pending' and due_at<=now() for update loop
      if v_case.case_status='closed' or (v_task.task_type='no_reply' and not exists(
        select 1 from public.messages m join public.conversations cv on cv.id=m.conversation_id
          join public.contact_preferences p on p.customer_id=cv.customer_id and p.channel=cv.selected_channel
        where m.id=v_task.source_message_id and m.delivery_status='sent' and p.contact_allowed and p.opt_out_at is null
          and not exists(select 1 from public.messages i where i.case_id=v_case.id and i.direction='inbound' and i.created_at>=m.sent_at)
          and not exists(select 1 from public.messages o where o.case_id=v_case.id and o.direction='outbound' and o.sent_at>m.sent_at))) then
        update public.follow_up_tasks set status='cancelled' where id=v_task.id;
      else
        update public.follow_up_tasks set status='due' where id=v_task.id;
        perform app_private.notify_case(v_case.id,'follow_up_due','Follow-up due','follow_up:'||v_task.id);
        v_n:=v_n+1;
      end if;
    end loop;
  end loop;
  return v_n;
end $$;
create function public.retention_complete_task(p_task_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_case uuid;
begin
  select case_id into v_case from public.follow_up_tasks where id=p_task_id;
  perform 1 from public.retention_cases where id=v_case for update;
  perform app_private.require_staff(v_case);
  update public.follow_up_tasks set status='completed',completed_at=now() where id=p_task_id and status in ('pending','due');
end $$;
create function public.retention_mark_notification_read(p_notification_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  update public.notifications set read_at=coalesce(read_at,now()) where id=p_notification_id
    and recipient_user_id=auth.uid() and app_private.can_read_case(case_id);
  if not found then raise exception 'Notification access denied' using errcode='42501'; end if;
end $$;

create function public.retention_request_support(p_case_id uuid,p_body text,p_request_key text,
  p_preferred_contact_time text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_old public.support_requests;
begin
  perform 1 from public.retention_cases where id=p_case_id and case_status<>'closed' for update;
  if not found then raise exception 'Case closed'; end if;
  perform app_private.require_staff(p_case_id);
  insert into public.support_requests(case_id,requested_by,request_body,preferred_contact_time,idempotency_key)
    values(p_case_id,auth.uid(),p_body,p_preferred_contact_time,p_request_key)
    on conflict(idempotency_key) do nothing returning id into v_id;
  if v_id is null then select * into v_old from public.support_requests where idempotency_key=p_request_key;
    if v_old.case_id<>p_case_id or v_old.request_body<>p_body or v_old.preferred_contact_time is distinct from p_preferred_contact_time then
      raise exception 'Request key conflict'; end if; v_id:=v_old.id; end if;
  return v_id;
end $$;
create function public.retention_process_support(p_limit integer default 100) returns integer
language plpgsql security definer set search_path='' as $$
declare v_r public.support_requests; v_c public.retention_cases; v_n integer:=0;
begin
  perform app_private.require_worker();
  if p_limit not between 1 and 500 then raise exception 'Invalid limit'; end if;
  for v_c in select c.* from public.retention_cases c where c.case_status<>'closed' and exists(
    select 1 from public.support_requests r where r.case_id=c.id and r.handoff_status='queued')
    order by c.created_at limit p_limit for update of c skip locked loop
    for v_r in select * from public.support_requests where case_id=v_c.id and handoff_status='queued' for update loop
      update public.support_requests set handoff_status='sent',sent_at=now(),external_receipt='mock-support:'||id where id=v_r.id;
      insert into public.interaction_events(case_id,event_type,actor_user_id,metadata)
        values(v_r.case_id,'support.requested',v_r.requested_by,jsonb_build_object('request_id',v_r.id,'transport','mock'));
      v_n:=v_n+1;
    end loop;
  end loop;
  return v_n;
end $$;

create function public.retention_update_case(p_case_id uuid,p_status text,p_contact_result text,
  p_close_reason text default null) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.retention_cases where id=p_case_id for update;
  perform app_private.require_staff(p_case_id);
  update public.retention_cases set case_status=p_status,contact_result=p_contact_result,
    closed_at=case when p_status='closed' then coalesce(closed_at,now()) else null end,
    close_reason=case when p_status='closed' then p_close_reason else null end,updated_at=now() where id=p_case_id;
  if p_status='closed' then
    perform app_private.cancel_pending(p_case_id,'case_closed');
    update public.automation_jobs set status='cancelled' where case_id=p_case_id and status='queued';
    update public.support_requests set handoff_status='cancelled' where case_id=p_case_id and handoff_status='queued';
  end if;
  insert into public.interaction_events(case_id,event_type,actor_user_id,metadata)
    values(p_case_id,'case.updated',auth.uid(),jsonb_build_object('status',p_status,'contact_result',p_contact_result));
end $$;
create function public.retention_record_outcome(p_case_id uuid,p_churned boolean,p_source text,
  p_is_simulated boolean,p_observed_at timestamptz default null,p_evidence_ref text default null,
  p_offer_accepted boolean default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_case public.retention_cases; v_end date; v_id uuid;
begin
  select * into v_case from public.retention_cases where id=p_case_id for update;
  perform app_private.require_staff(p_case_id);
  v_end:=(v_case.target_period_start+interval '1 month')::date-1;
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
create function public.retention_record_cost(p_case_id uuid,p_amount numeric,p_currency text,
  p_cost_type text,p_source text,p_is_simulated boolean,p_request_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_old public.intervention_costs;
begin
  perform 1 from public.retention_cases where id=p_case_id for update;
  perform app_private.require_staff(p_case_id);
  if not p_is_simulated and exists(select 1 from public.retention_cases c join public.customers cu
    on cu.id=c.customer_id where c.id=p_case_id and cu.is_synthetic) then
    raise exception 'Synthetic customer requires simulated cost flag'; end if;
  insert into public.intervention_costs(case_id,amount,currency,cost_type,source,is_simulated,idempotency_key)
    values(p_case_id,p_amount,p_currency,p_cost_type,p_source,p_is_simulated,p_request_key)
    on conflict(idempotency_key) do nothing returning id into v_id;
  if v_id is null then select * into v_old from public.intervention_costs where idempotency_key=p_request_key;
    if v_old.case_id<>p_case_id or v_old.amount<>p_amount or v_old.currency<>p_currency
      or v_old.cost_type<>p_cost_type or v_old.source<>p_source or v_old.is_simulated<>p_is_simulated then
      raise exception 'Request key conflict'; end if; v_id:=v_old.id; end if;
  return v_id;
end $$;
create function public.retention_update_settings(p_follow_up_hours numeric) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not app_private.is_supervisor() then raise exception 'Supervisor required' using errcode='42501'; end if;
  if p_follow_up_hours is null or p_follow_up_hours not between 0.01 and 720 then raise exception 'Invalid delay'; end if;
  update public.workspace_settings set follow_up_delay=make_interval(secs=>(p_follow_up_hours*3600)::double precision),
    delay_is_proposed=false,updated_at=now() where singleton;
  -- Existing task deadlines remain the recorded deadline; affects future sends.
end $$;
