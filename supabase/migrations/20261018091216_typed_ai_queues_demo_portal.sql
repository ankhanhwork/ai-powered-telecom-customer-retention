-- Separate queues by requested output; defaults preserve existing callers.
drop function if exists public.retention_pending_jobs(integer);
create or replace function public.retention_pending_jobs(p_limit integer default 10,p_output text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform app_private.require_worker();
 if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid limit'; end if;
 if p_output is not null and p_output not in ('message','call_script','explanation') then raise exception 'Invalid output'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(j) order by j.created_at,j.id),'[]') from (
 select j.* from public.automation_jobs j join public.retention_cases c on c.id=j.case_id
 where j.status='queued' and c.case_status<>'closed'
 and (p_output is null or split_part(j.request_key,':',2)=p_output)
 order by j.created_at,j.id limit p_limit) j);
end $$;
revoke all on function public.retention_pending_jobs(integer,text) from public,anon,authenticated;
grant execute on function public.retention_pending_jobs(integer,text) to service_role;

-- Only the reserved, provisioned demo account can switch synthetic recipients.
create or replace function app_private.can_demo_portal(p_conversation uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users a join public.customer_portal_users u on u.user_id=a.id and u.active
 where a.id=auth.uid() and a.email='customer@retention.example')
 and exists(select 1 from public.conversations cv
 join public.customers cu on cu.id=cv.customer_id
 join public.retention_cases c on c.id=cv.case_id
 where cv.id=p_conversation and cv.transport='mock' and cu.profile_source='synthetic_demo' and cu.is_synthetic
 and c.case_status in ('in_progress','waiting_customer')
 and exists(select 1 from public.messages m where m.conversation_id=cv.id
 and m.direction='outbound' and m.visibility='external' and m.delivery_status='sent'))
$$;
revoke all on function app_private.can_demo_portal(uuid) from public,anon;
create or replace function app_private.require_portal(p_conversation uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_customer uuid;
begin
 select cv.customer_id into v_customer from public.conversations cv
 where cv.id=p_conversation and (
 exists(select 1 from public.customer_portal_users u where u.customer_id=cv.customer_id and u.user_id=auth.uid() and u.active)
 or app_private.can_demo_portal(cv.id));
 if v_customer is null then raise exception 'Conversation access denied' using errcode='42501'; end if;
 return v_customer;
end $$;
create or replace function public.retention_portal_threads() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('conversation_id',cv.id,
 'channel',cv.selected_channel,'transport',cv.transport,'status',cv.status,
 'display_name',c.display_name) order by cv.created_at),'[]')
 from public.conversations cv join public.customers c on c.id=cv.customer_id
 where exists(select 1 from public.customer_portal_users u where u.customer_id=cv.customer_id and u.user_id=auth.uid() and u.active)
 or app_private.can_demo_portal(cv.id)
$$;
notify pgrst,'reload schema';
