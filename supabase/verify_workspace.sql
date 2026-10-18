-- Run after setup.sql. This file only reads catalogs/data.
-- Expect tables=25, rls_tables=25, anon_table_privileges=0,
-- authenticated_direct_writes=0, worker_direct_writes=0, private_bucket=true.
with workspace_tables as (
  select c.oid,c.relname,c.relrowsecurity from pg_class c
  where c.relnamespace='public'::regnamespace and c.relkind='r'
    and c.relname in ('customers','prediction_runs','customer_snapshots','churn_predictions',
      'prediction_contexts','retention_cases','staff_members','customer_portal_users','workspace_settings',
      'offers','customer_offer_eligibility','ai_recommendations','conversations','contact_preferences',
      'messages','message_revisions','message_approvals','delivery_outbox','interaction_events',
      'follow_up_tasks','notifications','support_requests','retention_outcomes','intervention_costs','automation_jobs')
)
select count(*) as tables,count(*) filter(where relrowsecurity) as rls_tables,
  count(*) filter(where has_table_privilege('anon',oid,'SELECT,INSERT,UPDATE,DELETE')) as anon_table_privileges,
  count(*) filter(where has_table_privilege('authenticated',oid,'INSERT,UPDATE,DELETE')) as authenticated_direct_writes,
  count(*) filter(where has_table_privilege('service_role',oid,'INSERT,UPDATE,DELETE')) as worker_direct_writes,
  (select not public from storage.buckets where id='retention-datasets') as private_bucket
from workspace_tables;

select table_name,column_name,data_type,is_nullable
from information_schema.columns where table_schema='public' order by table_name,ordinal_position;

-- Read policies must exist for all 25 tables. Portal only reads via filtered RPC.
select tablename,policyname,roles,cmd from pg_policies where schemaname='public' order by tablename,policyname;

-- Public/anon must not execute retention_* functions. Worker/staff separation.
select p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as user_execute,
  has_function_privilege('service_role',p.oid,'EXECUTE') as worker_execute
from pg_proc p where p.pronamespace='public'::regnamespace
  and p.proname like 'retention\_%' escape '\' order by p.proname;

select (select count(*) from public.customers) as customers,
  (select count(*) from public.churn_predictions) as predictions,
  (select count(*) from public.retention_cases) as cases,
  (select count(*) from public.staff_members) as staff,
  (select count(*) from public.customer_portal_users) as portal_mappings;
