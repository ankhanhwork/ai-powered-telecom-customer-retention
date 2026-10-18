-- Public RPC contract. All sensitive writes run in database transactions.
-- Never supply reviewer/user IDs from the browser: derive identity from auth.uid().
create function app_private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.staff_members where user_id = auth.uid() and active)
$$;
create function app_private.is_supervisor() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.staff_members where user_id = auth.uid()
    and active and role = 'supervisor')
$$;
create function app_private.can_read_case(p_case uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.retention_cases c join public.staff_members s
    on s.user_id = auth.uid() and s.active
    where c.id = p_case and (s.role = 'supervisor' or c.assigned_agent_id = s.user_id))
$$;
create function app_private.can_read_customer(p_customer uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app_private.is_supervisor() or exists(select 1 from public.retention_cases c
    where c.customer_id = p_customer and app_private.can_read_case(c.id))
$$;
create function app_private.require_staff(p_case uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.can_read_case(p_case) then raise exception 'Case access denied' using errcode='42501'; end if;
  return auth.uid();
end $$;
create function app_private.require_worker() returns void
language plpgsql set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Worker access required' using errcode='42501';
  end if;
end $$;
create function app_private.require_portal(p_conversation uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_customer uuid;
begin
  select cv.customer_id into v_customer from public.conversations cv
    join public.customer_portal_users u on u.customer_id = cv.customer_id
    where cv.id = p_conversation and u.user_id = auth.uid() and u.active;
  if v_customer is null then raise exception 'Conversation access denied' using errcode='42501'; end if;
  return v_customer;
end $$;
create function app_private.assert_contact(p_case uuid, p_channel text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_customer uuid; v_settings public.workspace_settings; v_local timestamp;
begin
  if not exists(select 1 from public.retention_cases c
    join public.contact_preferences p on p.customer_id = c.customer_id and p.channel = p_channel
    where c.id = p_case and c.case_status <> 'closed'
      and p.contact_allowed and p.opt_out_at is null) then
    raise exception 'Contact not allowed or case closed';
  end if;
  select customer_id into v_customer from public.retention_cases where id=p_case;
  perform 1 from public.customers where id=v_customer for update;
  select * into v_settings from public.workspace_settings where singleton;
  v_local:=now() at time zone 'Asia/Ho_Chi_Minh';
  if v_settings.contact_window_start is not null and
    (v_local::time<v_settings.contact_window_start or v_local::time>=v_settings.contact_window_end) then
    raise exception 'Outside configured contact hours'; end if;
  if v_settings.contact_cooldown>interval '0 seconds' and exists(
    select 1 from public.messages m join public.retention_cases c on c.id=m.case_id
    where c.customer_id=v_customer and m.direction='outbound' and m.delivery_status='sent'
      and m.sent_at>now()-v_settings.contact_cooldown) then raise exception 'Contact cooldown applies'; end if;
  if v_settings.daily_contact_limit is not null and (select count(*) from public.messages m
    join public.retention_cases c on c.id=m.case_id where c.customer_id=v_customer and m.direction='outbound'
      and m.delivery_status='sent' and (m.sent_at at time zone 'Asia/Ho_Chi_Minh')::date=v_local::date)
      >=v_settings.daily_contact_limit then raise exception 'Daily contact limit reached'; end if;
end $$;
create function app_private.assert_offer(p_customer uuid, p_offer uuid, p_reviewer uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_offer is null then return; end if;
  if not exists(select 1 from public.offers o
    join public.customer_offer_eligibility e on e.offer_id = o.id and e.customer_id = p_customer
    join public.staff_members s on s.user_id = p_reviewer and s.active
    where o.id = p_offer and o.active and now() >= o.valid_from and now() < o.valid_until
      and e.eligible and e.valid_until > now()
      and (not o.requires_supervisor or s.role = 'supervisor')) then
    raise exception 'Offer unavailable, ineligible or requires supervisor';
  end if;
end $$;
create function app_private.cancel_pending(p_case uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.delivery_outbox o set status='cancelled', error_code=p_reason,
    lease_token=null, lease_until=null
    from public.messages m where m.id=o.message_id and m.case_id=p_case
      and o.status in ('queued','sending');
  update public.messages set delivery_status='cancelled', approval_status='draft'
    where case_id=p_case and delivery_status in ('queued','sending');
  update public.follow_up_tasks set status='cancelled' where case_id=p_case and status in ('pending','due')
    and (p_reason <> 'customer_replied' or task_type='no_reply');
end $$;

create function public.retention_assign_case(p_case_id uuid, p_agent_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.is_supervisor() then raise exception 'Supervisor required' using errcode='42501'; end if;
  perform 1 from public.retention_cases where id=p_case_id for update;
  if not found then raise exception 'Case not found'; end if;
  if not exists(select 1 from public.staff_members where user_id=p_agent_id and active) then
    raise exception 'Active staff member required'; end if;
  update public.retention_cases set assigned_agent_id=p_agent_id, updated_at=now() where id=p_case_id;
  update public.follow_up_tasks set assigned_agent_id=p_agent_id
    where case_id=p_case_id and status in ('pending','due');
  insert into public.interaction_events(case_id,event_type,actor_user_id,metadata)
    values(p_case_id,'case.assigned',auth.uid(),jsonb_build_object('assigned_agent_id',p_agent_id));
  insert into public.notifications(recipient_user_id,case_id,type,title,idempotency_key)
    values(p_agent_id,p_case_id,'case_assigned','Case assigned',gen_random_uuid()::text);
end $$;

create function public.retention_save_draft(p_case_id uuid, p_body text, p_request_key text,
  p_channel text default 'Zalo', p_message_id uuid default null,
  p_expected_revision integer default null, p_offer_id uuid default null,
  p_internal boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_case public.retention_cases; v_message public.messages;
  v_revision public.message_revisions; v_conv uuid; v_id uuid; v_rev integer;
begin
  select * into v_case from public.retention_cases where id=p_case_id for update;
  v_actor := app_private.require_staff(p_case_id);
  if v_case.case_status='closed' then raise exception 'Case is closed'; end if;
  if p_request_key is null or length(btrim(p_request_key))=0 then raise exception 'Request key required'; end if;
  if p_body is null or length(btrim(p_body)) not between 1 and 10000 then raise exception 'Invalid message body'; end if;
  select r.* into v_revision from public.message_revisions r
    join public.messages m on m.id=r.message_id where r.request_key=p_request_key and m.case_id=p_case_id;
  if found then
    if v_revision.body <> p_body or v_revision.offer_id is distinct from p_offer_id then
      raise exception 'Request key already used with different content'; end if;
    if not exists(select 1 from public.messages m join public.conversations cv on cv.id=m.conversation_id
      where m.id=v_revision.message_id and cv.selected_channel=p_channel and (m.direction='internal')=p_internal
        and (p_message_id is null or m.id=p_message_id)) then raise exception 'Request key metadata conflict'; end if;
    return jsonb_build_object('message_id',v_revision.message_id,'revision',v_revision.revision);
  end if;
  if p_message_id is null then
    insert into public.conversations(case_id,customer_id,selected_channel)
      values(p_case_id,v_case.customer_id,p_channel)
      on conflict(case_id,selected_channel) do update set selected_channel=excluded.selected_channel
      returning id into v_conv;
    insert into public.messages(case_id,conversation_id,sender_type,sender_user_id,direction,visibility)
      values(p_case_id,v_conv,'agent',v_actor,
        case when p_internal then 'internal' else 'outbound' end,
        case when p_internal then 'internal' else 'external' end) returning id into v_id;
    v_rev := 1;
  else
    select * into v_message from public.messages where id=p_message_id and case_id=p_case_id for update;
    if not found or v_message.direction='inbound' or v_message.sent_at is not null then raise exception 'Message cannot be edited'; end if;
    if v_message.current_revision is distinct from p_expected_revision then raise exception 'Revision conflict'; end if;
    if (v_message.direction='internal') <> p_internal then raise exception 'Message visibility cannot change'; end if;
    if not exists(select 1 from public.conversations where id=v_message.conversation_id and selected_channel=p_channel) then
      raise exception 'Create a new message to change channel'; end if;
    v_id:=p_message_id; v_rev:=v_message.current_revision+1;
    update public.delivery_outbox set status='cancelled',error_code='revision_changed',lease_token=null,lease_until=null
      where message_id=v_id and status in ('queued','sending');
    update public.messages set current_revision=v_rev,approval_status='draft',delivery_status='not_queued'
      where id=v_id;
  end if;
  insert into public.message_revisions(message_id,revision,body,content_hash,offer_id,created_by,request_key)
    values(v_id,v_rev,p_body,encode(sha256(convert_to(p_body,'UTF8')),'hex'),p_offer_id,v_actor,p_request_key);
  insert into public.interaction_events(case_id,message_id,event_type,actor_user_id,metadata)
    values(p_case_id,v_id,'message.drafted',v_actor,jsonb_build_object('revision',v_rev));
  return jsonb_build_object('message_id',v_id,'revision',v_rev);
end $$;

create function public.retention_review_message(p_message_id uuid, p_revision integer,
  p_decision text, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_case public.retention_cases; v_m public.messages; v_r public.message_revisions;
  v_actor uuid; v_channel text; v_approval uuid; v_outbox uuid;
begin
  select case_id into v_case.id from public.messages where id=p_message_id;
  select * into v_case from public.retention_cases where id=v_case.id for update;
  v_actor:=app_private.require_staff(v_case.id);
  select * into v_m from public.messages where id=p_message_id for update;
  if v_m.direction <> 'outbound' or v_m.current_revision <> p_revision or v_m.sent_at is not null then
    raise exception 'Outbound current unsent revision required'; end if;
  if p_decision not in ('approved','rejected') or p_decision is null then raise exception 'Invalid decision'; end if;
  if v_m.delivery_status='sending' then raise exception 'Delivery in progress'; end if;
  select * into v_r from public.message_revisions where message_id=p_message_id and revision=p_revision;
  select selected_channel into v_channel from public.conversations where id=v_m.conversation_id and status='open';
  if v_channel is null then raise exception 'Conversation is closed'; end if;
  if p_decision='approved' then
    perform app_private.assert_contact(v_case.id,v_channel);
    perform app_private.assert_offer(v_case.customer_id,v_r.offer_id,v_actor);
    select id into v_outbox from public.delivery_outbox where message_id=p_message_id
      and revision=p_revision and channel=v_channel and status in ('queued','sent');
    if found then return jsonb_build_object('outbox_id',v_outbox,'status','already_queued'); end if;
  end if;
  insert into public.message_approvals(message_id,revision,content_hash,reviewer_id,decision,reason)
    values(p_message_id,p_revision,v_r.content_hash,v_actor,p_decision,p_reason) returning id into v_approval;
  if p_decision='rejected' then
    update public.delivery_outbox set status='cancelled',error_code='rejected'
      where message_id=p_message_id and status='queued';
    update public.messages set approval_status='rejected',delivery_status='not_queued' where id=p_message_id;
  else
    insert into public.delivery_outbox(message_id,revision,content_hash,approval_id,channel,idempotency_key)
      values(p_message_id,p_revision,v_r.content_hash,v_approval,v_channel,
        p_message_id::text||':'||p_revision||':'||v_channel)
      on conflict(message_id,revision,channel) do update set approval_id=excluded.approval_id,
        status='queued',next_attempt_at=now(),error_code=null,lease_token=null,lease_until=null,
        attempt_count=0 returning id into v_outbox;
    update public.messages set approval_status='approved',delivery_status='queued' where id=p_message_id;
  end if;
  insert into public.interaction_events(case_id,message_id,event_type,actor_user_id,metadata)
    values(v_case.id,p_message_id,'message.'||p_decision,v_actor,jsonb_build_object('revision',p_revision));
  return jsonb_build_object('approval_id',v_approval,'outbox_id',v_outbox,'decision',p_decision);
end $$;

create function public.retention_claim_delivery() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_case uuid; v_o public.delivery_outbox; v_m public.messages; v_s public.workspace_settings;
begin
  perform app_private.require_worker();
  select * into v_s from public.workspace_settings where singleton;
  select c.id into v_case from public.retention_cases c where exists(
    select 1 from public.messages m join public.delivery_outbox o on o.message_id=m.id
    where m.case_id=c.id and ((o.status='queued' and o.next_attempt_at<=now())
      or (o.status='sending' and o.lease_until<now()))) order by c.created_at
    limit 1 for update of c skip locked;
  if v_case is null then return null; end if;
  select o.* into v_o from public.delivery_outbox o join public.messages m on m.id=o.message_id
    where m.case_id=v_case and ((o.status='queued' and o.next_attempt_at<=now())
      or (o.status='sending' and o.lease_until<now())) order by o.created_at limit 1;
  select * into v_m from public.messages where id=v_o.message_id for update;
  perform 1 from public.delivery_outbox where id=v_o.id for update;
  if v_o.attempt_count>=v_s.max_delivery_attempts then
    update public.delivery_outbox set status='failed',error_code='attempts_exhausted',lease_token=null,lease_until=null where id=v_o.id;
    update public.messages set delivery_status='failed' where id=v_m.id;
    return jsonb_build_object('status','failed','outbox_id',v_o.id);
  end if;
  update public.delivery_outbox set status='sending',attempt_count=attempt_count+1,
    lease_token=gen_random_uuid(),lease_until=now()+v_s.delivery_lease where id=v_o.id returning * into v_o;
  update public.messages set delivery_status='sending' where id=v_m.id;
  return jsonb_build_object('outbox_id',v_o.id,'lease_token',v_o.lease_token,
    'message_id',v_o.message_id,'revision',v_o.revision,'transport','mock');
end $$;

create function public.retention_deliver_mock(p_outbox_id uuid, p_lease_token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_case public.retention_cases; v_o public.delivery_outbox; v_m public.messages;
  v_r public.message_revisions; v_reviewer uuid; v_delay interval;
begin
  perform app_private.require_worker();
  select c.* into v_case from public.retention_cases c join public.messages m on m.case_id=c.id
    join public.delivery_outbox o on o.message_id=m.id where o.id=p_outbox_id for update of c;
  select m.* into v_m from public.messages m join public.delivery_outbox o on o.message_id=m.id
    where o.id=p_outbox_id for update of m;
  select * into v_o from public.delivery_outbox where id=p_outbox_id for update;
  if not found then raise exception 'Outbox not found'; end if;
  if v_o.status='sent' then return jsonb_build_object('status','sent','receipt',v_o.provider_receipt); end if;
  if v_o.status <> 'sending' or v_o.lease_token is distinct from p_lease_token
    or v_o.lease_until<=now() then raise exception 'Invalid or expired delivery lease'; end if;
  if v_m.current_revision<>v_o.revision or v_m.approval_status<>'approved' then raise exception 'Approval is stale'; end if;
  if not exists(select 1 from public.conversations where id=v_m.conversation_id and status='open' and transport='mock') then
    raise exception 'Open mock conversation required'; end if;
  select reviewer_id into v_reviewer from public.message_approvals where id=v_o.approval_id;
  if not exists(select 1 from public.staff_members s where s.user_id=v_reviewer and s.active
    and (s.role='supervisor' or v_case.assigned_agent_id=v_reviewer)) then
    raise exception 'Reviewer no longer authorized'; end if;
  select * into v_r from public.message_revisions where message_id=v_o.message_id and revision=v_o.revision;
  begin
    perform app_private.assert_contact(v_case.id,v_o.channel);
    perform app_private.assert_offer(v_case.customer_id,v_r.offer_id,v_reviewer);
  exception when raise_exception then
    update public.delivery_outbox set status='cancelled',error_code='policy_changed',lease_token=null,lease_until=null where id=v_o.id;
    update public.messages set delivery_status='cancelled',approval_status='draft' where id=v_m.id;
    return jsonb_build_object('status','cancelled','reason','policy_changed');
  end;
  update public.delivery_outbox set status='sent',sent_at=now(),provider_receipt='mock:'||id::text,
    lease_token=null,lease_until=null where id=v_o.id returning * into v_o;
  update public.messages set delivery_status='sent',sent_at=now(),sent_revision=v_o.revision where id=v_m.id;
  update public.retention_cases set case_status='waiting_customer',contact_result='contacted',
    last_contact_at=now(),updated_at=now() where id=v_case.id;
  update public.follow_up_tasks set status='cancelled' where case_id=v_case.id and task_type='no_reply' and status in ('pending','due');
  select follow_up_delay into v_delay from public.workspace_settings where singleton;
  insert into public.follow_up_tasks(case_id,source_message_id,task_type,due_at,assigned_agent_id,idempotency_key)
    values(v_case.id,v_m.id,'no_reply',now()+v_delay,v_case.assigned_agent_id,'no_reply:'||v_m.id)
    on conflict(idempotency_key) do nothing;
  insert into public.interaction_events(case_id,message_id,event_type,channel,provider_event_id)
    values(v_case.id,v_m.id,'message.sent',v_o.channel,v_o.provider_receipt);
  return jsonb_build_object('status','sent','receipt',v_o.provider_receipt);
end $$;

create function public.retention_fail_delivery(p_outbox_id uuid,p_lease_token uuid,
  p_error_code text,p_retryable boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_o public.delivery_outbox; v_case uuid; v_limit integer;
begin
  perform app_private.require_worker();
  select m.case_id into v_case from public.messages m join public.delivery_outbox o on o.message_id=m.id where o.id=p_outbox_id;
  perform 1 from public.retention_cases where id=v_case for update;
  select * into v_o from public.delivery_outbox where id=p_outbox_id for update;
  if v_o.status<>'sending' or v_o.lease_token is distinct from p_lease_token then raise exception 'Invalid delivery lease'; end if;
  select max_delivery_attempts into v_limit from public.workspace_settings where singleton;
  update public.delivery_outbox set status=case when p_retryable and attempt_count<v_limit then 'queued' else 'failed' end,
    next_attempt_at=now()+make_interval(secs=>least(300,10*power(2,attempt_count)::integer)),
    error_code=left(p_error_code,100),lease_token=null,lease_until=null where id=p_outbox_id returning * into v_o;
  update public.messages set delivery_status=case when v_o.status='queued' then 'queued' else 'failed' end where id=v_o.message_id;
  if v_o.status='failed' then
    insert into public.notifications(recipient_user_id,case_id,type,title,idempotency_key)
      select assigned_agent_id,id,'delivery_failed','Message delivery failed','delivery_failed:'||p_outbox_id
      from public.retention_cases where id=v_case and assigned_agent_id is not null on conflict(idempotency_key) do nothing;
  end if;
end $$;
