-- Count a distinct case/Agent/day consistently after unassign and reassignment.
create or replace function app_private.assignment_state() returns jsonb
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
   'receivedToday',coalesce((select jsonb_agg(distinct e.metadata->>'assigned_agent_id') from public.interaction_events e
    where e.case_id=c.id and e.event_type='case.assigned' and e.metadata->>'assigned_agent_id' is not null
     and (e.occurred_at at time zone 'Asia/Ho_Chi_Minh')::date=(now() at time zone 'Asia/Ho_Chi_Minh')::date),'[]'),
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

create or replace function app_private.assignment_plan(p_state jsonb,p_config jsonb) returns jsonb
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
   select value->>'id' into recipient from jsonb_array_elements(v_agents) where ((value->>'today')::int<v_daily or coalesce(c->'receivedToday','[]') ? (value->>'id')) and (value->>'open')::int<v_open
    order by case when v_cursor is null or value->>'id'>v_cursor then 0 else 1 end,value->>'id' limit 1;
  end if;
  select coalesce(max(coalesce((value->'experience'->>(c->>'group'))::numeric,0)),0) into max_experience
   from jsonb_array_elements(v_agents) where ((value->>'today')::int<v_daily or coalesce(c->'receivedToday','[]') ? (value->>'id')) and (value->>'open')::int<v_open;
  for a in select value from jsonb_array_elements(v_agents) where ((value->>'today')::int<v_daily or coalesce(c->'receivedToday','[]') ? (value->>'id')) and (value->>'open')::int<v_open
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
  select jsonb_agg(case when value->>'id'=best->>'id' then value||jsonb_build_object('open',(value->>'open')::int+1,'today',(value->>'today')::int+case when coalesce(c->'receivedToday','[]') ? (value->>'id') then 0 else 1 end) else value end order by value->>'id') into v_agents from jsonb_array_elements(v_agents);
  if v_method='round_robin' then v_cursor:=best->>'id';end if;
 end loop;
 return jsonb_build_object('proposals',proposals,'remaining',remaining,'agents',v_agents,'eligible',eligible,'cursor',v_cursor,
  'config',p_config,'version',p_state->'version','localDay',p_state->'localDay','previewCursor',p_state->'cursor','simulated_history',p_state->'simulated_history');
end $$;
notify pgrst,'reload schema';
