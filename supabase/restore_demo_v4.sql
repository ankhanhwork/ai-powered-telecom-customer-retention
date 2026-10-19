-- Admin-only recovery from the private pre-v5 snapshot. Keep n8n timers disabled.
-- Restores old demo customer/care data; keeps current Auth, staff, settings/offers.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
do $$
declare t record; f jsonb; fks jsonb; columns text;
begin
 if (select count(*) from app_private.v4_demo_backup)<>25 then raise exception 'Expected complete 25-table backup'; end if;
 if exists(select 1 from public.customers where not is_synthetic or source_dataset<>'synthetic_rolling_month_v5') then raise exception 'Refuse to replace non-v5 data'; end if;
 select jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,'name',conname,'deferrable',condeferrable,'deferred',condeferred))
 into fks from pg_constraint where contype='f' and connamespace='public'::regnamespace;
 for f in select * from jsonb_array_elements(fks) loop
  execute format('alter table %s alter constraint %I deferrable initially deferred',f->>'table',f->>'name');
 end loop;
 truncate public.customer_portal_users,public.customer_offer_eligibility,public.ai_recommendations,public.conversations,
 public.contact_preferences,public.messages,public.message_revisions,public.message_approvals,public.delivery_outbox,
 public.interaction_events,public.follow_up_tasks,public.notifications,public.support_requests,public.retention_outcomes,
 public.intervention_costs,public.automation_jobs,public.retention_cases,public.prediction_contexts,
 public.churn_predictions,public.customer_snapshots,public.prediction_runs,public.customers;
 for t in select table_name,payload from app_private.v4_demo_backup
  where table_name not in ('staff_members','workspace_settings','offers') order by table_name loop
  select string_agg(quote_ident(attname),',' order by attnum) into columns from pg_attribute
   where attrelid=('public.'||quote_ident(t.table_name))::regclass and attnum>0 and not attisdropped and attgenerated='';
  execute format('insert into public.%I(%s) select %s from jsonb_populate_recordset(null::public.%I,$1)',t.table_name,columns,columns,t.table_name) using t.payload;
 end loop;
 set constraints all immediate;
 for f in select * from jsonb_array_elements(fks) loop
  execute format('alter table %s alter constraint %I %s %s',f->>'table',f->>'name',
   case when (f->>'deferrable')::boolean then 'deferrable' else 'not deferrable' end,
   case when (f->>'deferred')::boolean then 'initially deferred' else 'initially immediate' end);
 end loop;
end $$;
commit;
select source_dataset,count(*) from public.customers group by source_dataset;
