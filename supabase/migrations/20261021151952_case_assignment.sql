-- Supervisor-approved assignment; preview is read-only, confirmation is atomic.
alter table public.workspace_settings
 add column assignment_daily_limit integer not null default 20 check(assignment_daily_limit between 1 and 500),
 add column assignment_open_limit integer not null default 40 check(assignment_open_limit between 1 and 500),
 add column assignment_weights jsonb not null default '{"continuity":40,"experience":30,"load":30}',
 add column assignment_cursor uuid references public.staff_members(user_id),
 add column assignment_version integer not null default 1;

create table public.assignment_runs(
 id uuid primary key default gen_random_uuid(),
 request_key text not null unique check(length(request_key) between 1 and 128),
 actor_user_id uuid not null references public.staff_members(user_id),
 payload_hash text not null,
 config jsonb not null,
 result jsonb not null default '{}',
 created_at timestamptz not null default now()
);
alter table public.assignment_runs enable row level security;
revoke all on public.assignment_runs from public,anon,authenticated,service_role;
grant select on public.assignment_runs to authenticated,service_role;
create policy assignment_supervisor on public.assignment_runs for select to authenticated
 using((select app_private.is_supervisor()) and actor_user_id=(select auth.uid()));

alter table public.notifications alter column case_id drop not null,
 add column assignment_run_id uuid references public.assignment_runs(id);
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
 check(type in ('new_message','follow_up_due','delivery_failed','case_assigned','case_assignment_batch')),
 add constraint notification_assignment_target check(
 (type='case_assignment_batch' and case_id is null and assignment_run_id is not null) or
 (type<>'case_assignment_batch' and case_id is not null and assignment_run_id is null));
drop policy notifications_own on public.notifications;
create policy notifications_own on public.notifications for select to authenticated using(
 recipient_user_id=(select auth.uid()) and (select app_private.is_staff()) and
 (type='case_assignment_batch' or app_private.can_read_case(case_id)));
create index assignment_events_daily_idx on public.interaction_events(occurred_at,case_id)
 where event_type='case.assigned';
create index assignment_runs_actor_idx on public.assignment_runs(actor_user_id,created_at);
create index notifications_assignment_run_idx on public.notifications(assignment_run_id) where assignment_run_id is not null;

create function app_private.assignment_region() returns text
language plpgsql stable security definer set search_path='' as $$
declare v_region text;
begin
 select region into v_region from public.staff_members where user_id=auth.uid() and active and role='supervisor';
 if not found then raise exception 'Supervisor required' using errcode='42501'; end if;
 return v_region;
end $$;

create function app_private.assignment_weights_valid(p_weights jsonb) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(p_weights)='object' and
  jsonb_typeof(p_weights->'continuity')='number' and jsonb_typeof(p_weights->'experience')='number'
  and jsonb_typeof(p_weights->'load')='number' and
  (p_weights->>'continuity')::numeric between 0 and 100 and
  (p_weights->>'experience')::numeric between 0 and 100 and
  (p_weights->>'load')::numeric between 0 and 100 and
  (p_weights->>'continuity')::numeric+(p_weights->>'experience')::numeric+(p_weights->>'load')::numeric=100,false)
$$;

alter table public.workspace_settings add constraint assignment_weights_check
 check(app_private.assignment_weights_valid(assignment_weights));

-- Same authoritative state for the modal, read-only previews and commit rechecks.
create function app_private.assignment_state() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_region text; v_state jsonb;
begin
 v_region:=app_private.assignment_region();
 with case_data as (
  select c.*,cu.display_name,cu.contract_ref,cu.is_synthetic,p.churn_probability,
   coalesce(pc.context->'drivers'->0->>'group_id',case marker.metadata->>'primary_issue'
    when 'Connection quality' then 'connection_quality' when 'Support experience' then 'support_experience'
    when 'Billing & payments' then 'payment_overdue' when 'Usage & engagement' then 'usage_engagement'
    when 'Renewal & promotions' then 'renewal_promotion' when 'Plan & pricing' then 'plan_pricing_relationship' end) group_id,
   coalesce(pc.context->'drivers'->0->>'group_name',marker.metadata->>'primary_issue') group_name
  from public.retention_cases c join public.customers cu on cu.id=c.customer_id
  join public.churn_predictions p on p.id=c.prediction_id
  left join public.prediction_contexts pc on pc.prediction_id=p.id and pc.explanation_version=p.explanation_version
  left join lateral(select e.metadata from public.interaction_events e where e.case_id=c.id
   and e.event_type='care.issue_recorded' and e.metadata->>'is_simulated'='true'
   order by e.occurred_at desc,e.id limit 1) marker on true
  where cu.region=v_region
 ), activity as (
  select distinct e.case_id,c.customer_id,c.group_id,c.case_status,c.is_synthetic,
   coalesce(e.actor_user_id,approval.reviewer_id,m.sender_user_id) agent_id,e.occurred_at
  from public.interaction_events e join case_data c on c.id=e.case_id
  left join public.messages m on m.id=e.message_id
  left join lateral(select a.reviewer_id from public.message_approvals a where a.message_id=m.id
   and a.revision=m.sent_revision and a.decision='approved' order by a.decided_at desc,a.id limit 1) approval on true
  where e.event_type in ('message.sent','call.answered','call.no_answer')
   and e.occurred_at<=now() and e.occurred_at>=now()-interval '90 days'
 ), experience as (
  select agent_id,group_id,count(distinct case_id)::int n from activity
  where case_status='closed' and group_id is not null and agent_id is not null group by 1,2
 ), capacities as (
  select s.user_id id,s.display_name name,s.active,
   (select count(*)::int from public.retention_cases c where c.assigned_agent_id=s.user_id and c.case_status<>'closed') open,
   (select count(distinct e.case_id)::int from public.interaction_events e where e.event_type='case.assigned'
    and e.metadata->>'assigned_agent_id'=s.user_id::text
    and e.occurred_at>=((now() at time zone 'Asia/Ho_Chi_Minh')::date::timestamp at time zone 'Asia/Ho_Chi_Minh')
    and e.occurred_at<(((now() at time zone 'Asia/Ho_Chi_Minh')::date+1)::timestamp at time zone 'Asia/Ho_Chi_Minh')) today,
   coalesce((select jsonb_object_agg(x.group_id,x.n) from experience x where x.agent_id=s.user_id),'{}') experience
  from public.staff_members s where s.role='agent' and s.active and s.region=v_region
 ) select jsonb_build_object(
  'agents',coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from capacities a),'[]'),
  'cases',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'customer',c.customer_id,
   'name',coalesce(c.display_name,c.contract_ref),'ref',c.contract_ref,'owner',c.assigned_agent_id,
   'start',c.target_period_start,'end',c.target_period_end_exclusive,'stage',c.case_status,'created_at',c.created_at,
   'risk',c.churn_probability,'group',c.group_id,'groupName',c.group_name,
   'previousAgent',(select a.agent_id from activity a where a.customer_id=c.customer_id and a.agent_id is not null
    order by a.occurred_at desc,a.case_id limit 1),
   'blocked',case when exists(select 1 from public.retention_cases other where other.customer_id=c.customer_id
    and other.id<>c.id and other.case_status<>'closed' and other.assigned_agent_id is not null)
    then 'Existing active case — review owner' end) order by c.churn_probability desc,c.created_at,c.id) from case_data c),'[]'),
  'limits',jsonb_build_object('daily',s.assignment_daily_limit,'open',s.assignment_open_limit),
  'weights',s.assignment_weights,'cursor',s.assignment_cursor,'version',s.assignment_version,
  'localDay',(now() at time zone 'Asia/Ho_Chi_Minh')::date,'as_of',now(),
  'simulated_history',exists(select 1 from activity where is_synthetic),
  'history_days',90,'local_fixture',false)
 into v_state from public.workspace_settings s where singleton;
 return v_state;
end $$;

create function public.retention_agent_capacity() returns jsonb
language sql stable security invoker set search_path='' as $$ select app_private.assignment_state() $$;

create function public.retention_assignment_settings(p_daily integer,p_open integer,p_weights jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform app_private.assignment_region();
 if p_daily is null or p_open is null or p_daily not between 1 and 500 or p_open not between 1 and 500
  or not app_private.assignment_weights_valid(p_weights) then raise exception 'Invalid capacity limits or weights (total must be 100%%)'; end if;
 perform pg_advisory_xact_lock(74121,1);
 update public.workspace_settings set assignment_daily_limit=p_daily,assignment_open_limit=p_open,
  assignment_weights=p_weights,assignment_version=assignment_version+1,updated_at=now() where singleton;
 return app_private.assignment_state();
end $$;

-- Pure planner: no reservations, cursor changes or writes during Preview.
create function app_private.assignment_plan(p_state jsonb,p_config jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare v_agents jsonb:=p_state->'agents'; v_selected jsonb:=p_config->'selectedIds';
 v_method text:=p_config->>'method'; v_weights jsonb:=coalesce(p_config->'weights',p_state->'weights');
 v_daily int:=(p_state->'limits'->>'daily')::int; v_open int:=(p_state->'limits'->>'open')::int;
 v_cursor text:=p_state->>'cursor'; c jsonb; a jsonb; best jsonb; best_score numeric; best_components jsonb;
 continuity numeric; experience numeric; load numeric; score numeric; max_experience numeric;
 recipient text; overridden boolean; proposals jsonb:='[]'; remaining jsonb:='[]'; eligible int:=0; why text;
begin
 if v_method is null or v_method not in ('manual','round_robin','weighted') then raise exception 'Choose an assignment method'; end if;
 if jsonb_typeof(v_selected) is distinct from 'array' or jsonb_array_length(v_selected)=0 then raise exception 'Select at least one active agent'; end if;
 if (select count(*)<>count(distinct value) from jsonb_array_elements_text(v_selected)) or exists(
  select 1 from jsonb_array_elements_text(v_selected) selected(id) where not exists(select 1 from jsonb_array_elements(v_agents) candidate(value) where candidate.value->>'id'=selected.id))
  then raise exception 'Active staff member required in this region' using errcode='42501'; end if;
 if not app_private.assignment_weights_valid(v_weights) then raise exception 'Weights must be between 0 and 100 and total 100%%'; end if;
 if p_config->'limits' is distinct from p_state->'limits' then raise exception 'Save capacity settings before preview'; end if;
 if jsonb_typeof(coalesce(p_config->'overrides','{}'))<>'object' then raise exception 'Invalid owner overrides'; end if;
 if not exists(select 1 from jsonb_array_elements(p_state->'cases') candidate(value) where candidate.value->>'start'=p_config->>'period') then raise exception 'Prediction period not found'; end if;
 select coalesce(jsonb_agg(value order by value->>'id'),'[]') into v_agents from jsonb_array_elements(v_agents) where v_selected ? (value->>'id');
 for c in select value from jsonb_array_elements(p_state->'cases') where value->>'start'=p_config->>'period'
  and value->>'owner' is null and value->>'stage'<>'closed' and (value->>'risk')::numeric>0.5
  order by (value->>'risk')::numeric desc,(value->>'created_at')::timestamptz,value->>'id' loop
  eligible:=eligible+1; best:=null; best_score:=null; recipient:=null; best_components:=null;
  if c->>'blocked' is not null then remaining:=remaining||jsonb_build_array(c||jsonb_build_object('reason',c->>'blocked'));continue;end if;
  overridden:=coalesce(p_config->'overrides','{}') ? (c->>'id');
  if overridden or v_method='manual' then recipient:=p_config->'overrides'->>(c->>'id');
  elsif v_method='round_robin' then
   select value->>'id' into recipient from jsonb_array_elements(v_agents) where (value->>'today')::int<v_daily and (value->>'open')::int<v_open
    order by case when v_cursor is null or value->>'id'>v_cursor then 0 else 1 end,value->>'id' limit 1;
  end if;
  select coalesce(max(coalesce((value->'experience'->>(c->>'group'))::numeric,0)),0) into max_experience
   from jsonb_array_elements(v_agents) where (value->>'today')::int<v_daily and (value->>'open')::int<v_open;
  for a in select value from jsonb_array_elements(v_agents) where (value->>'today')::int<v_daily and (value->>'open')::int<v_open
   order by (value->>'open')::int,(value->>'today')::int,value->>'id' loop
   if (overridden or v_method<>'weighted') and (recipient is null or a->>'id'<>recipient) then continue; end if;
   continuity:=case when c->>'previousAgent'=a->>'id' then 1 else 0 end;
   experience:=case when max_experience>0 then coalesce((a->'experience'->>(c->>'group'))::numeric,0)/max_experience else 0 end;
   load:=1-(a->>'open')::numeric/v_open;
   score:=continuity*(v_weights->>'continuity')::numeric+experience*(v_weights->>'experience')::numeric+load*(v_weights->>'load')::numeric;
   if best is null or score>best_score then best:=a;best_score:=score;best_components:=jsonb_build_object('continuity',continuity,'experience',experience,'load',load);end if;
  end loop;
  if best is null then
   why:=case when v_method='manual' and recipient is null then 'No agent selected' when overridden then 'Selected agent is unavailable or at capacity' else 'All selected agents are at capacity' end;
   remaining:=remaining||jsonb_build_array(c||jsonb_build_object('reason',why));continue;
  end if;
  why:=case when v_method='weighted' then
   case when (best_components->>'continuity')::int=1 then 'Previously cared for this customer · ' else '' end||
   coalesce(best->'experience'->>(c->>'group'),'0')||' past '||coalesce(c->>'groupName','matching')||' cases · '||(best->>'open')||'/'||v_open||' open'
   else case when overridden or v_method='manual' then 'Chosen by supervisor' else 'Next agent in rotation' end||' · '||(best->>'today')||'/'||v_daily||' today · '||(best->>'open')||'/'||v_open||' open' end;
  proposals:=proposals||jsonb_build_array(c||jsonb_build_object('agentId',best->>'id','agentName',best->>'name',
   'score',case when v_method='weighted' then best_score end,'components',best_components,'reason',why,'override',overridden and v_method<>'manual'));
  select jsonb_agg(case when value->>'id'=best->>'id' then value||jsonb_build_object('open',(value->>'open')::int+1,'today',(value->>'today')::int+1) else value end order by value->>'id') into v_agents from jsonb_array_elements(v_agents);
  if v_method='round_robin' then v_cursor:=best->>'id';end if;
 end loop;
 return jsonb_build_object('proposals',proposals,'remaining',remaining,'agents',v_agents,'eligible',eligible,'cursor',v_cursor,
  'config',p_config,'version',p_state->'version','localDay',p_state->'localDay','previewCursor',p_state->'cursor','simulated_history',p_state->'simulated_history');
end $$;

create function public.retention_preview_assignment(p_config jsonb) returns jsonb
language sql stable security invoker set search_path='' as $$
 select app_private.assignment_plan(app_private.assignment_state(),p_config)
$$;

-- All manual and batch writes take the same transaction lock before case locks.
create function app_private.apply_case_assignment(p_case uuid,p_agent uuid,p_mode text,p_run uuid,
 p_metadata jsonb,p_expected_owner uuid,p_check_owner boolean,p_reason text default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare c public.retention_cases; v_settings public.workspace_settings; v_region text; v_today int; v_open int; v_received boolean;
begin
 v_region:=app_private.assignment_region();perform pg_advisory_xact_lock(74121,1);
 if p_agent is not null then
  perform 1 from public.staff_members where user_id=p_agent and role='agent' and active and region=v_region for share;
  if not found then raise exception 'Active staff member required in this region' using errcode='42501';end if;
 end if;
 select rc.* into c from public.retention_cases rc join public.customers cu on cu.id=rc.customer_id
  where rc.id=p_case and cu.region=v_region for update of rc;
 if not found then raise exception 'Case not found';end if;
 if p_check_owner and c.assigned_agent_id is distinct from p_expected_owner then raise exception 'Case owner changed; refresh before assigning';end if;
 if c.case_status='closed' then raise exception 'Case closed';end if;
 if c.assigned_agent_id is not distinct from p_agent then return false;end if;
 if p_agent is null and coalesce(length(btrim(p_reason)),0)=0 then raise exception 'Reason required to unassign';end if;
 select * into v_settings from public.workspace_settings where singleton;
 if p_agent is not null then
  select count(*)::int into v_open from public.retention_cases where assigned_agent_id=p_agent and case_status<>'closed';
  select count(distinct e.case_id)::int into v_today from public.interaction_events e where e.event_type='case.assigned'
   and e.metadata->>'assigned_agent_id'=p_agent::text
   and e.occurred_at>=((now() at time zone 'Asia/Ho_Chi_Minh')::date::timestamp at time zone 'Asia/Ho_Chi_Minh')
   and e.occurred_at<(((now() at time zone 'Asia/Ho_Chi_Minh')::date+1)::timestamp at time zone 'Asia/Ho_Chi_Minh');
  select exists(select 1 from public.interaction_events e where e.case_id=p_case and e.event_type='case.assigned'
   and e.metadata->>'assigned_agent_id'=p_agent::text and (e.occurred_at at time zone 'Asia/Ho_Chi_Minh')::date=(now() at time zone 'Asia/Ho_Chi_Minh')::date) into v_received;
  if not v_received and v_today>=v_settings.assignment_daily_limit then raise exception 'Daily assignment limit reached';end if;
  if v_open>=v_settings.assignment_open_limit then raise exception 'Open case limit reached';end if;
 end if;
 update public.retention_cases set assigned_agent_id=p_agent,updated_at=now() where id=p_case;
 update public.follow_up_tasks set assigned_agent_id=p_agent where case_id=p_case and status in ('pending','due');
 insert into public.interaction_events(case_id,event_type,actor_user_id,metadata)
  values(p_case,case when p_agent is null then 'case.unassigned' else 'case.assigned' end,auth.uid(),
   coalesce(p_metadata,'{}')||jsonb_build_object('old_agent_id',c.assigned_agent_id,'assigned_agent_id',p_agent,'mode',p_mode,'run_id',p_run,'reason',p_reason,'assignment_version',1));
 if p_agent is not null and p_run is null then
  insert into public.notifications(recipient_user_id,case_id,type,title,idempotency_key)
   values(p_agent,p_case,'case_assigned','Case assigned',gen_random_uuid()::text);
 end if;
 return true;
end $$;

create or replace function public.retention_assign_case(p_case_id uuid,p_agent_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin perform app_private.apply_case_assignment(p_case_id,p_agent_id,'manual',null,'{}',null,false);end $$;

create function public.retention_change_assignment(p_case_id uuid,p_agent_id uuid,p_expected_owner uuid,p_reason text default null) returns void
language plpgsql security definer set search_path='' as $$
begin perform app_private.apply_case_assignment(p_case_id,p_agent_id,'manual',null,'{}',p_expected_owner,true,p_reason);end $$;

create function public.retention_confirm_assignment(p_request_key text,p_preview jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_state jsonb; v_config jsonb:=p_preview->'config'; v_row jsonb; v_plan jsonb; v_case jsonb; v_one jsonb;
 v_hash text; v_run public.assignment_runs; v_result jsonb; v_rows jsonb:='[]'; v_skipped jsonb:='[]'; v_remaining jsonb;
 v_id uuid; v_agent uuid; v_cursor uuid; v_region text; n int;
begin
 v_region:=app_private.assignment_region();
 if p_request_key is null or length(p_request_key) not between 1 and 128 or jsonb_typeof(p_preview->'proposals') is distinct from 'array'
  or jsonb_array_length(p_preview->'proposals') not between 1 and 1000 then raise exception 'Invalid confirmation payload (1–1000 cases required)';end if;
 if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(p_preview->'proposals')) then raise exception 'Duplicate case in confirmation';end if;
 v_hash:=encode(sha256(convert_to(jsonb_build_object('config',v_config,'rows',p_preview->'proposals','version',p_preview->'version','day',p_preview->'localDay','cursor',p_preview->'previewCursor')::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(74121,1);
 select * into v_run from public.assignment_runs where request_key=p_request_key;
 if found then
  if v_run.actor_user_id<>auth.uid() or v_run.payload_hash<>v_hash then raise exception 'Request key already used for another confirmation';end if;
  return v_run.result;
 end if;
 -- Staff locks precede sorted case locks, matching the manual path.
 perform 1 from public.staff_members where role='agent' and region=v_region order by user_id for share;
 perform 1 from public.retention_cases where id in(select (value->>'id')::uuid from jsonb_array_elements(p_preview->'proposals')) order by id for update;
 v_state:=app_private.assignment_state();
 if p_preview->'version' is distinct from v_state->'version' or p_preview->'localDay' is distinct from v_state->'localDay'
  or (v_config->>'method'='round_robin' and p_preview->'previewCursor' is distinct from v_state->'cursor') then raise exception 'Assignment settings, day or rotation changed; preview again';end if;
 -- Validate configuration even if every proposed case is already assigned.
 perform app_private.assignment_plan(v_state,v_config);
 insert into public.assignment_runs(request_key,actor_user_id,payload_hash,config) values(p_request_key,auth.uid(),v_hash,v_config) returning * into v_run;
 if exists(select 1 from jsonb_array_elements(p_preview->'proposals') submitted where not exists(
  select 1 from jsonb_array_elements(v_state->'cases') candidate where candidate->>'id'=submitted->>'id'
   and candidate->>'start'=v_config->>'period' and (candidate->>'risk')::numeric>0.5))
  then raise exception 'Case outside selected alert period' using errcode='42501';end if;
 for v_row in select submitted.value from jsonb_array_elements(p_preview->'proposals') submitted
  join public.retention_cases rc on rc.id=(submitted.value->>'id')::uuid
  join public.churn_predictions cp on cp.id=rc.prediction_id
  order by cp.churn_probability desc,rc.created_at,rc.id loop
  v_id:=(v_row->>'id')::uuid;v_agent:=(v_row->>'agentId')::uuid;
  if v_agent is null or not (v_config->'selectedIds' ? v_agent::text) then raise exception 'Recipient is not a selected agent';end if;
  select value into v_case from jsonb_array_elements(v_state->'cases') where value->>'id'=v_id::text;
  if v_case is null or v_case->>'start'<>v_config->>'period' or (v_case->>'risk')::numeric<=0.5 then raise exception 'Case outside selected alert period' using errcode='42501';end if;
  if v_case->>'owner' is not null or v_case->>'stage'='closed' then
   v_skipped:=v_skipped||jsonb_build_array(v_case||jsonb_build_object('reason','Case is already assigned or closed'));continue;
  end if;
  -- Re-score the approved recipient; never reroute to a different person.
  v_one:=jsonb_set(v_state,'{cases}',jsonb_build_array(v_case));
  v_plan:=app_private.assignment_plan(v_one,v_config||jsonb_build_object('overrides',jsonb_build_object(v_id::text,v_agent)));
  if jsonb_array_length(v_plan->'proposals')=0 then v_skipped:=v_skipped||(v_plan->'remaining');continue;end if;
  v_row:=v_plan->'proposals'->0;
  perform app_private.apply_case_assignment(v_id,v_agent,v_config->>'method',v_run.id,
   jsonb_build_object('score',v_row->'score','components',v_row->'components','routing_reason',v_row->>'reason',
    'simulated_history',v_state->'simulated_history','supervisor_override',coalesce((v_config->'overrides') ? v_id::text,false)),null,true);
  v_rows:=v_rows||jsonb_build_array(v_row);
  -- Re-read includes any case status changes and the successful assignment just written.
  v_state:=app_private.assignment_state();
  if v_config->>'method'='round_robin' then v_cursor:=v_agent;end if;
 end loop;
 if v_cursor is not null then update public.workspace_settings set assignment_cursor=v_cursor where singleton;end if;
 select coalesce(jsonb_agg(value),'[]') into v_remaining from jsonb_array_elements(v_state->'cases')
  where value->>'start'=v_config->>'period' and value->>'owner' is null and value->>'stage'<>'closed' and (value->>'risk')::numeric>0.5;
 v_result:=jsonb_build_object('run_id',v_run.id,'proposals',v_rows,'skipped',v_skipped,'remaining',v_remaining,
  'agents',v_state->'agents','cursor',coalesce(v_cursor,(v_state->>'cursor')::uuid),'simulated_history',v_state->'simulated_history');
 for v_row in select value from jsonb_array_elements(v_state->'agents') loop
  select count(*)::int into n from jsonb_array_elements(v_rows) where value->>'agentId'=v_row->>'id';
  if n>0 then insert into public.notifications(recipient_user_id,type,title,idempotency_key,assignment_run_id)
   values((v_row->>'id')::uuid,'case_assignment_batch','You have '||n||' new cases','assignment:'||v_run.id||':'||(v_row->>'id'),v_run.id);end if;
 end loop;
 update public.assignment_runs set result=v_result where id=v_run.id;
 return v_result;
end $$;

create or replace function public.retention_mark_notification_read(p_notification_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.notifications set read_at=coalesce(read_at,now()) where id=p_notification_id
  and recipient_user_id=auth.uid() and app_private.is_staff()
  and (type='case_assignment_batch' or app_private.can_read_case(case_id));
 if not found then raise exception 'Notification access denied' using errcode='42501';end if;
end $$;

revoke all on function app_private.assignment_region(),app_private.assignment_weights_valid(jsonb),app_private.assignment_state(),
 app_private.assignment_plan(jsonb,jsonb),app_private.apply_case_assignment(uuid,uuid,text,uuid,jsonb,uuid,boolean,text) from public,anon,authenticated,service_role;
-- Invoker wrappers can execute only the guarded read helpers, never the private write helper.
grant execute on function app_private.assignment_state(),app_private.assignment_plan(jsonb,jsonb),app_private.assignment_weights_valid(jsonb) to authenticated;
revoke all on function public.retention_agent_capacity(),public.retention_assignment_settings(integer,integer,jsonb),
 public.retention_preview_assignment(jsonb),public.retention_confirm_assignment(text,jsonb),
 public.retention_change_assignment(uuid,uuid,uuid,text),public.retention_assign_case(uuid,uuid),public.retention_mark_notification_read(uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.retention_agent_capacity(),public.retention_assignment_settings(integer,integer,jsonb),
 public.retention_preview_assignment(jsonb),public.retention_confirm_assignment(text,jsonb),
 public.retention_change_assignment(uuid,uuid,uuid,text),public.retention_assign_case(uuid,uuid),public.retention_mark_notification_read(uuid) to authenticated;
notify pgrst,'reload schema';
