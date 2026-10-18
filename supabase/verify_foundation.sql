-- Historical six-table check ONLY. After full setup use verify_workspace.sql.
-- Read-only verification, run AFTER the initial migration in SQL Editor.
-- Expect six tables, all rls_enabled=true and browser_has_any_privilege=false.
select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       (has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
        or has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE'))
        as browser_has_any_privilege,
       has_table_privilege('service_role', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
        as worker_has_privilege
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and c.relname in ('customers', 'prediction_runs', 'customer_snapshots',
    'churn_predictions', 'prediction_contexts', 'retention_cases')
order by c.relname;

-- Expect one row with public=false.
select id, name, public from storage.buckets where id = 'retention-datasets';

-- Inspect FK, uniqueness, probability, date and case-state constraints.
select conrelid::regclass as table_name, conname,
       pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in ('public.customers'::regclass,
  'public.prediction_runs'::regclass, 'public.customer_snapshots'::regclass,
  'public.churn_predictions'::regclass, 'public.prediction_contexts'::regclass,
  'public.retention_cases'::regclass)
order by conrelid::regclass::text, conname;
