-- Mock transport: deliver approved messages inside the database at commit time, so sending
-- no longer depends on the n8n delivery schedule (which is disabled to save execution quota).
create or replace function app_private.mock_deliver_now(p_outbox_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_o public.delivery_outbox; v_m public.messages; v_case public.retention_cases; v_delay interval;
begin
  select * into v_o from public.delivery_outbox where id=p_outbox_id for update;
  if not found or v_o.status<>'queued' then return; end if;
  select * into v_m from public.messages where id=v_o.message_id for update;
  if v_m.current_revision<>v_o.revision or v_m.approval_status<>'approved' then return; end if;
  if not exists(select 1 from public.conversations where id=v_m.conversation_id and status='open' and transport='mock') then return; end if;
  select * into v_case from public.retention_cases where id=v_m.case_id for update;
  update public.delivery_outbox set status='sent',sent_at=now(),provider_receipt='mock:'||id::text,
    attempt_count=attempt_count+1,lease_token=null,lease_until=null where id=v_o.id returning * into v_o;
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
end $$;

create or replace function app_private.mock_deliver_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.mock_deliver_now(new.id);
  return null;
end $$;

drop trigger if exists delivery_outbox_mock_deliver on public.delivery_outbox;
create constraint trigger delivery_outbox_mock_deliver after insert on public.delivery_outbox
  deferrable initially deferred for each row execute function app_private.mock_deliver_trigger();

-- Deliver messages already waiting in the queue.
select app_private.mock_deliver_now(id) from public.delivery_outbox where status='queued' order by created_at;
