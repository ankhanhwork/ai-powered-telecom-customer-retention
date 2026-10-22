-- Admin-only template. prepare_dashboard.py embeds the private pre-seed backup.
-- Refuses rollback if a user has added activity to any seeded case.
begin;
set local lock_timeout='5s';
lock table public.retention_cases,public.messages,public.message_revisions,public.message_approvals,
 public.delivery_outbox,public.interaction_events,public.follow_up_tasks,public.support_requests,public.retention_outcomes,
 public.conversations,public.churn_predictions,public.customer_snapshots,public.customers in share row exclusive mode;
create temp table dashboard_rollback_cases on commit drop as
 select distinct case_id from public.interaction_events where metadata->>'seed_version'='dashboard-v1';
create temp table dashboard_rollback_snapshots on commit drop as
 select p.snapshot_id from public.churn_predictions p join public.prediction_runs r on r.id=p.run_id
 where r.run_key like 'dashboard-v1:%';
create temp table dashboard_rollback_messages on commit drop as
 select message_id from public.message_revisions where request_key like 'dashboard-v1:%';
create temp table dashboard_rollback_customers on commit drop as
 select distinct c.customer_id from public.retention_cases c
 where c.id in(select case_id from dashboard_rollback_cases)
 and c.customer_id not in(select (x->>'id')::uuid from jsonb_array_elements(__BACKUP__::jsonb->'customer_map') x);
do $$ begin
 if exists(select 1 from public.interaction_events e join dashboard_rollback_cases c on c.case_id=e.case_id
  where coalesce(e.metadata->>'seed_version','')<>'dashboard-v1') then
  raise exception 'New staff activity exists; review before rollback'; end if;
end $$;
alter table public.message_revisions disable trigger immutable_revisions;
alter table public.message_approvals disable trigger immutable_approvals;
alter table public.interaction_events disable trigger immutable_events;
delete from public.delivery_outbox where idempotency_key like 'dashboard-v1:%';
delete from public.message_approvals where message_id in(select message_id from dashboard_rollback_messages);
delete from public.message_revisions where message_id in(select message_id from dashboard_rollback_messages);
delete from public.interaction_events where metadata->>'seed_version'='dashboard-v1';
delete from public.follow_up_tasks where idempotency_key like 'dashboard-v1:%';
delete from public.support_requests where idempotency_key like 'dashboard-v1:%';
delete from public.messages where id in(select message_id from dashboard_rollback_messages);
delete from public.retention_outcomes where source='dashboard-v1:frozen-v5-labels';
delete from public.conversations where case_id in(select case_id from dashboard_rollback_cases);
set constraints all immediate;
alter table public.message_revisions enable trigger immutable_revisions;
alter table public.message_approvals enable trigger immutable_approvals;
alter table public.interaction_events enable trigger immutable_events;
do $$ declare c public.retention_cases; begin
 for c in select * from jsonb_populate_recordset(null::public.retention_cases,__BACKUP__::jsonb->'cases') loop
  update public.retention_cases set assigned_agent_id=c.assigned_agent_id,case_status=c.case_status,
   created_at=c.created_at,closed_at=c.closed_at,contact_result=c.contact_result,priority=c.priority,
   due_at=c.due_at,last_contact_at=c.last_contact_at,close_reason=c.close_reason,updated_at=c.updated_at
   where id=c.id and id in(select case_id from dashboard_rollback_cases);
 end loop;
end $$;
delete from public.retention_cases where target_period_start in('2026-08-01','2026-09-01')
 and id in(select case_id from dashboard_rollback_cases);
delete from public.churn_predictions where run_id in(select id from public.prediction_runs where run_key like 'dashboard-v1:%');
delete from public.customer_snapshots where id in(select snapshot_id from dashboard_rollback_snapshots);
delete from public.prediction_runs where run_key like 'dashboard-v1:%';
delete from public.customers where id in(select customer_id from dashboard_rollback_customers)
 and not exists(select 1 from public.churn_predictions p where p.customer_id=customers.id);
delete from public.staff_members where user_id in(select value::uuid from jsonb_array_elements_text(__STAFF__::jsonb));
delete from auth.users where id in(select value::uuid from jsonb_array_elements_text(__STAFF__::jsonb))
 and raw_app_meta_data->>'dashboard_roster_only'='true';
commit;
