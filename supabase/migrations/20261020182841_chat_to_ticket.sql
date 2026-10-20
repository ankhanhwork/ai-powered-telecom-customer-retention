-- Chat-only AI drafts share support handoff storage; only staff may submit.
alter table public.support_requests drop constraint support_requests_handoff_status_check;
alter table public.support_requests
 add constraint support_requests_handoff_status_check check(handoff_status in ('draft','queued','sent','failed','cancelled')),
 add column category text check(category in ('connection_issue','billing','plan_change','cancellation','other')),
 add column priority text check(priority in ('low','normal','high')),
 add column department text check(department in ('Technical Support','Billing','Customer Retention','Customer Service')),
 add column repeat_issue text not null default 'unknown' check(repeat_issue in ('yes','no','unknown')),
 add column churn_concern text not null default 'unknown' check(churn_concern in ('explicit','not_observed','unknown')),
 add column missing_fields jsonb not null default '[]' check(jsonb_typeof(missing_fields)='array'),
 add column evidence jsonb not null default '[]' check(jsonb_typeof(evidence)='array'),
 add column source_messages jsonb not null default '[]' check(jsonb_typeof(source_messages)='array'),
 add column source_job_id uuid unique references public.automation_jobs(id),
 add column version integer not null default 1 check(version>0),
 add column updated_at timestamptz not null default now(),
 add column submitted_by uuid references public.staff_members(user_id),
 add column submitted_at timestamptz,
 add column model_version text;
alter table public.automation_jobs add column ticket_input jsonb;

create function app_private.ticket_department(p_category text) returns text
language sql immutable set search_path='' as $$
 select case p_category when 'connection_issue' then 'Technical Support' when 'billing' then 'Billing'
 when 'plan_change' then 'Customer Retention' when 'cancellation' then 'Customer Retention' when 'other' then 'Customer Service' end $$;

create function app_private.ticket_conversation(p_case_id uuid) returns jsonb
language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'direction',m.direction,'body',r.body,
  'created_at',m.created_at,'sent_at',m.sent_at) order by coalesce(m.sent_at,m.created_at),m.id),'[]')
 from public.messages m join public.message_revisions r on r.message_id=m.id
 and r.revision=case when m.direction='outbound' then m.sent_revision else m.current_revision end
 where m.case_id=p_case_id and m.visibility='external' and
 (m.direction='inbound' or (m.direction='outbound' and m.delivery_status='sent')) $$;

create function app_private.validate_ticket(p_ticket jsonb,p_source jsonb default null) returns void
language plpgsql set search_path='' as $$
declare e jsonb; f jsonb;
begin
 if p_ticket is null or jsonb_typeof(p_ticket)<>'object' or
 exists(select 1 from jsonb_object_keys(p_ticket) k where k not in
 ('description','category','priority','repeat_issue','churn_concern','missing_fields','evidence','preferred_contact_time')) then raise exception 'Invalid ticket schema'; end if;
 if jsonb_typeof(p_ticket->'description') is distinct from 'string' or length(btrim(p_ticket->>'description')) not between 1 and 10000 then raise exception 'Description required (max 10000 characters)'; end if;
 if p_ticket->>'category' is not null and app_private.ticket_department(p_ticket->>'category') is null then raise exception 'Invalid category'; end if;
 if p_ticket->>'priority' is not null and p_ticket->>'priority' not in ('low','normal','high') then raise exception 'Invalid priority'; end if;
 if coalesce(p_ticket->>'repeat_issue','unknown') not in ('yes','no','unknown') or
 coalesce(p_ticket->>'churn_concern','unknown') not in ('explicit','not_observed','unknown') then raise exception 'Invalid conversation flags'; end if;
 if p_ticket->>'preferred_contact_time' is not null and (jsonb_typeof(p_ticket->'preferred_contact_time')<>'string' or length(p_ticket->>'preferred_contact_time')>500) then raise exception 'Invalid contact time'; end if;
 if jsonb_typeof(coalesce(p_ticket->'missing_fields','[]')) is distinct from 'array' or jsonb_typeof(coalesce(p_ticket->'evidence','[]')) is distinct from 'array' then raise exception 'Invalid ticket arrays'; end if;
 if jsonb_array_length(coalesce(p_ticket->'missing_fields','[]'))>20 or jsonb_array_length(coalesce(p_ticket->'evidence','[]'))>20 then raise exception 'Too many ticket details'; end if;
 for f in select * from jsonb_array_elements(coalesce(p_ticket->'missing_fields','[]')) loop
  if jsonb_typeof(f)<>'string' or length(btrim(f#>>'{}')) not between 1 and 500 then raise exception 'Invalid missing field'; end if;
 end loop;
 for e in select * from jsonb_array_elements(coalesce(p_ticket->'evidence','[]')) loop
  if jsonb_typeof(e)<>'object' or e->>'field' is null or e->>'field' not in ('description','priority','repeat_issue','churn_concern') or
   jsonb_typeof(e->'quote') is distinct from 'string' or length(btrim(e->>'quote')) not between 1 and 1000 or e->>'message_id' is null then raise exception 'Invalid ticket evidence'; end if;
  if p_source is not null and not exists(select 1 from jsonb_array_elements(p_source) m
   where m->>'id'=e->>'message_id' and m->>'direction'='inbound' and position(e->>'quote' in m->>'body')>0) then raise exception 'Evidence must quote a source customer message'; end if;
 end loop;
 if p_source is not null then
  if p_ticket->>'repeat_issue' in ('yes','no') and not exists(select 1 from jsonb_array_elements(coalesce(p_ticket->'evidence','[]')) ev where ev->>'field'='repeat_issue') then raise exception 'Repeat issue evidence required'; end if;
  if p_ticket->>'priority'='high' and not exists(select 1 from jsonb_array_elements(coalesce(p_ticket->'evidence','[]')) ev where ev->>'field'='priority') then raise exception 'High priority evidence required'; end if;
  if p_ticket->>'churn_concern'='explicit' and not exists(select 1 from jsonb_array_elements(coalesce(p_ticket->'evidence','[]')) ev where ev->>'field'='churn_concern') then raise exception 'Churn concern evidence required'; end if;
 end if;
end $$;

create function public.retention_request_ticket(p_case_id uuid,p_request_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_source jsonb; v_id uuid;
begin
 perform 1 from public.retention_cases where id=p_case_id and case_status<>'closed' for update;
 if not found then raise exception 'Case closed'; end if;
 perform app_private.require_staff(p_case_id);
 if p_request_key is null or p_request_key not like 'manual:ticket:%' then raise exception 'Ticket request key required'; end if;
 v_source:=app_private.ticket_conversation(p_case_id);
 if not exists(select 1 from jsonb_array_elements(v_source) m where m->>'direction'='inbound') then raise exception 'Customer chat required before generating a ticket'; end if;
 if length(v_source::text)>150000 then raise exception 'Conversation exceeds the demo AI context limit; create a manual draft'; end if;
 v_id:=public.retention_request_recommendation(p_case_id,p_request_key);
 update public.automation_jobs set ticket_input=jsonb_build_object('conversation',v_source,'requested_by',auth.uid())
 where id=v_id and status='queued' and ticket_input is null;
 return v_id;
end $$;

create function public.retention_ticket_context(p_job_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.automation_jobs;
begin
 perform app_private.require_worker();
 select * into j from public.automation_jobs where id=p_job_id and status='queued' and request_key like 'manual:ticket:%';
 if j.id is null or j.ticket_input is null then raise exception 'Ticket job is not pending'; end if;
 return jsonb_build_object('conversation',j.ticket_input->'conversation','language','English',
 'categories',jsonb_build_object('connection_issue','Technical Support','billing','Billing','plan_change','Customer Retention','cancellation','Customer Retention','other','Customer Service'),
 'requires_staff_review',true);
end $$;

create function public.retention_complete_ticket(p_job_id uuid,p_ticket jsonb,p_model_version text) returns uuid
language plpgsql security definer set search_path='' as $$
declare j public.automation_jobs; v_id uuid;
begin
 perform app_private.require_worker();
 perform 1 from public.retention_cases c join public.automation_jobs aj on aj.case_id=c.id where aj.id=p_job_id and c.case_status<>'closed' for update of c;
 if not found then raise exception 'Case closed or job missing'; end if;
 select * into j from public.automation_jobs where id=p_job_id for update;
 if j.request_key not like 'manual:ticket:%' or j.ticket_input is null then raise exception 'Not a ticket request'; end if;
 if j.status='completed' then select id into v_id from public.support_requests where source_job_id=j.id; return v_id; end if;
 if j.status<>'queued' or j.claimed_at is null then raise exception 'Ticket job must be claimed'; end if;
 perform app_private.validate_ticket(p_ticket,j.ticket_input->'conversation');
 if nullif(btrim(p_model_version),'') is null or length(p_model_version)>200 then raise exception 'Model version required'; end if;
 insert into public.support_requests(case_id,requested_by,request_body,preferred_contact_time,idempotency_key,handoff_status,
  category,priority,department,repeat_issue,churn_concern,missing_fields,evidence,source_messages,source_job_id,model_version)
 values(j.case_id,(j.ticket_input->>'requested_by')::uuid,p_ticket->>'description',p_ticket->>'preferred_contact_time','ticket-job:'||j.id,'draft',
 p_ticket->>'category',p_ticket->>'priority',app_private.ticket_department(p_ticket->>'category'),coalesce(p_ticket->>'repeat_issue','unknown'),
 coalesce(p_ticket->>'churn_concern','unknown'),coalesce(p_ticket->'missing_fields','[]'),coalesce(p_ticket->'evidence','[]'),j.ticket_input->'conversation',j.id,p_model_version)
 returning id into v_id;
 update public.automation_jobs set status='completed',completed_at=now() where id=j.id;
 insert into public.interaction_events(case_id,event_type,metadata) values(j.case_id,'ticket.drafted',jsonb_build_object('ticket_id',v_id,'job_id',j.id));
 return v_id;
end $$;

create function public.retention_save_ticket(p_case_id uuid,p_ticket jsonb,p_request_key text,
 p_ticket_id uuid default null,p_expected_version integer default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.support_requests; v_actor uuid;
begin
 perform 1 from public.retention_cases where id=p_case_id and case_status<>'closed' for update;
 if not found then raise exception 'Case closed'; end if;
 v_actor:=app_private.require_staff(p_case_id);
 perform app_private.validate_ticket(p_ticket);
 if nullif(btrim(p_request_key),'') is null or length(p_request_key)>200 then raise exception 'Request key required'; end if;
 if p_ticket_id is null then
  select * into r from public.support_requests where idempotency_key=p_request_key;
  if r.id is not null then
   if r.case_id<>p_case_id or r.request_body is distinct from p_ticket->>'description' or r.category is distinct from p_ticket->>'category' or r.priority is distinct from p_ticket->>'priority' or r.repeat_issue is distinct from coalesce(p_ticket->>'repeat_issue','unknown') or r.churn_concern is distinct from coalesce(p_ticket->>'churn_concern','unknown') or r.preferred_contact_time is distinct from p_ticket->>'preferred_contact_time' or r.missing_fields is distinct from coalesce(p_ticket->'missing_fields','[]') then raise exception 'Request key conflict'; end if;
   return to_jsonb(r);
  end if;
  insert into public.support_requests(case_id,requested_by,request_body,idempotency_key,handoff_status)
   values(p_case_id,v_actor,p_ticket->>'description',p_request_key,'draft') returning * into r;
 else
  select * into r from public.support_requests where id=p_ticket_id and case_id=p_case_id for update;
  if r.id is null or r.handoff_status<>'draft' then raise exception 'Ticket is not an editable draft'; end if;
  if p_expected_version is distinct from r.version then raise exception 'Ticket changed. Reload before saving'; end if;
 end if;
 update public.support_requests set request_body=p_ticket->>'description',category=p_ticket->>'category',priority=p_ticket->>'priority',
 department=app_private.ticket_department(p_ticket->>'category'),repeat_issue=coalesce(p_ticket->>'repeat_issue','unknown'),churn_concern=coalesce(p_ticket->>'churn_concern','unknown'),
 missing_fields=coalesce(p_ticket->'missing_fields','[]'),preferred_contact_time=p_ticket->>'preferred_contact_time',
 updated_at=now(),version=case when p_ticket_id is null then version else version+1 end where id=r.id returning * into r;
 insert into public.interaction_events(case_id,event_type,actor_user_id,metadata) values(p_case_id,'ticket.saved',v_actor,jsonb_build_object('ticket_id',r.id,'version',r.version));
 return to_jsonb(r);
end $$;

create function public.retention_submit_ticket(p_ticket_id uuid,p_expected_version integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.support_requests; v_case uuid; v_actor uuid;
begin
 select case_id into v_case from public.support_requests where id=p_ticket_id;
 v_actor:=app_private.require_staff(v_case);
 perform 1 from public.retention_cases where id=v_case and case_status<>'closed' for update;
 if not found then raise exception 'Case closed'; end if;
 select * into r from public.support_requests where id=p_ticket_id for update;
 if p_expected_version is distinct from r.version then raise exception 'Ticket changed. Reload before submitting'; end if;
 if r.submitted_at is not null then return to_jsonb(r); end if;
 if r.handoff_status<>'draft' or r.category is null or r.priority is null or r.department is null then raise exception 'Complete and save required fields before submitting'; end if;
 update public.support_requests set handoff_status='queued',submitted_by=v_actor,submitted_at=now(),updated_at=now() where id=r.id returning * into r;
 insert into public.interaction_events(case_id,event_type,actor_user_id,metadata) values(v_case,'ticket.submitted',v_actor,jsonb_build_object('ticket_id',r.id,'version',r.version));
 return to_jsonb(r);
end $$;

revoke all on function app_private.ticket_department(text),app_private.ticket_conversation(uuid),app_private.validate_ticket(jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.retention_request_ticket(uuid,text),public.retention_ticket_context(uuid),public.retention_complete_ticket(uuid,jsonb,text),public.retention_save_ticket(uuid,jsonb,text,uuid,integer),public.retention_submit_ticket(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.retention_request_ticket(uuid,text),public.retention_save_ticket(uuid,jsonb,text,uuid,integer),public.retention_submit_ticket(uuid,integer) to authenticated;
grant execute on function public.retention_ticket_context(uuid),public.retention_complete_ticket(uuid,jsonb,text) to service_role;
notify pgrst,'reload schema';
