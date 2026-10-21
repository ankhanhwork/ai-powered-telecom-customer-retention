-- Read-only Supervisor API. Invoker privileges preserve RLS on every source.
create or replace function public.retention_supervisor_dashboard() returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
 if not app_private.is_supervisor() then
  raise exception 'Supervisor access required' using errcode='42501';
 end if;
 return jsonb_build_object(
  'as_of',now(),'local_fixture',false,
  'staff',(select coalesce(jsonb_agg(jsonb_build_object('id',user_id,'name',display_name) order by display_name),'[]') from public.staff_members),
  'cases',(select coalesce(jsonb_agg(jsonb_build_object(
   'id',c.id,'customer',c.customer_id,'ref',cu.contract_ref,'owner',c.assigned_agent_id,
   'start',c.target_period_start,'end',c.target_period_end_exclusive,'stage',c.case_status,
   'created_at',c.created_at,'score',p.churn_score,'priority',c.priority,
   'outcome',(select o.churned from public.retention_outcomes o where o.case_id=c.id
      and o.window_start=c.target_period_start and o.window_end=c.target_period_end_exclusive-1
      and o.observed_at>=c.target_period_end_exclusive::timestamp at time zone 'Asia/Ho_Chi_Minh'
      order by o.updated_at desc limit 1),
   'primary_issue',coalesce(
     (select e.metadata->>'primary_issue' from public.interaction_events e where e.case_id=c.id
       and e.event_type='care.issue_recorded' order by e.occurred_at desc,e.id limit 1),
     (select case r.category when 'connection_issue' then 'Connection quality' when 'billing' then 'Billing & payments'
       when 'plan_change' then 'Plan & pricing' when 'cancellation' then 'Cancellation request' else 'Other issues' end
       from public.support_requests r where r.case_id=c.id and r.handoff_status in ('queued','sent','failed')
       order by coalesce(r.submitted_at,r.created_at) desc,r.id limit 1),'Unclassified')) order by c.id),'[]')
    from public.retention_cases c join public.customers cu on cu.id=c.customer_id
    join public.churn_predictions p on p.id=c.prediction_id),
  'events',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'case_id',e.case_id,
    'type',case e.event_type when 'message.sent' then 'sent' when 'message.received' then 'reply'
      when 'case.closed' then 'closed' when 'delivery.failed' then 'delivery_failed' end,
    'at',e.occurred_at,'actor',coalesce(e.actor_user_id,a.reviewer_id)) order by e.occurred_at,e.id),'[]')
    from public.interaction_events e
    left join public.messages m on m.id=e.message_id
    left join public.delivery_outbox b on b.message_id=m.id and b.revision=m.sent_revision
    left join public.message_approvals a on a.id=b.approval_id
    where e.event_type in ('message.sent','message.received','case.closed','delivery.failed')),
  'tasks',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'case_id',case_id,'owner',assigned_agent_id,
    'due_at',due_at,'status',status)),'[]') from public.follow_up_tasks),
  'tickets',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'case_id',case_id,
    'actor',coalesce(submitted_by,requested_by),'category',coalesce(category,'Unclassified'),
    'status',handoff_status,'at',coalesce(submitted_at,sent_at,created_at))),'[]') from public.support_requests)
 );
end $$;
revoke all on function public.retention_supervisor_dashboard() from public,anon,service_role;
grant execute on function public.retention_supervisor_dashboard() to authenticated;
notify pgrst,'reload schema';
