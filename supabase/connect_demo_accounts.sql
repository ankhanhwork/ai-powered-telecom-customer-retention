-- Run AFTER setup.sql and the demo import, as the SQL Editor administrator.
-- First create these three Auth users in Authentication > Users > Add user:
-- supervisor@retention.example, agent@retention.example, customer@retention.example
-- Use your own strong passwords; confirm the accounts via the admin interface.
-- Reserved .example addresses are demo identities, not email recipients.
-- This script never creates Auth users or stores their passwords.
begin;
do $$
declare v_supervisor uuid; v_agent uuid; v_portal uuid; v_case public.retention_cases;
begin
  select id into v_supervisor from auth.users where lower(email)='supervisor@retention.example';
  select id into v_agent from auth.users where lower(email)='agent@retention.example';
  select id into v_portal from auth.users where lower(email)='customer@retention.example';
  if v_supervisor is null or v_agent is null or v_portal is null then
    raise exception 'Create and confirm the three demo users in Supabase Auth first'; end if;
  insert into public.staff_members(user_id,display_name,role)
    values(v_supervisor,'Demo Supervisor','supervisor'),(v_agent,'Demo Agent','agent')
    on conflict(user_id) do update set display_name=excluded.display_name,role=excluded.role,active=true;
  select c.* into v_case from public.retention_cases c join public.churn_predictions p on p.id=c.prediction_id
    join public.customers cu on cu.id=c.customer_id where cu.is_synthetic and c.case_status<>'closed'
    order by p.churn_probability desc,cu.customer_ref limit 1 for update of c;
  if not found then raise exception 'Import a demo batch with at least one score >500 first'; end if;
  update public.retention_cases set assigned_agent_id=v_agent,updated_at=now() where id=v_case.id;
  insert into public.customer_portal_users(user_id,customer_id) values(v_portal,v_case.customer_id)
    on conflict(user_id) do update set customer_id=excluded.customer_id,active=true;
  insert into public.conversations(case_id,customer_id,selected_channel)
    values(v_case.id,v_case.customer_id,'Zalo') on conflict(case_id,selected_channel) do nothing;
end $$;
commit;
-- Confirms mappings without exposing passwords or keys.
select s.display_name,s.role,s.active from public.staff_members s order by role;
select c.customer_ref,cv.id as conversation_id from public.customer_portal_users u
  join public.customers c on c.id=u.customer_id join public.conversations cv on cv.customer_id=c.id
  where u.user_id=(select id from auth.users where lower(email)='customer@retention.example');
