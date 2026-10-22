-- Demo only. Run as the SQL Editor administrator, AFTER setup.sql and the demo import.
-- Assumption for the demo: synthetic customers contact the agent through the shared Zalo channel,
-- so Zalo is a permitted channel for them. Transport stays simulated; nothing is sent to Zalo.
-- Existing rows are never changed, so a recorded opt-out is preserved (on conflict do nothing).
begin;
insert into public.contact_preferences(customer_id,channel,contact_allowed,opt_out_at,consent_basis,evidence_ref)
select distinct c.customer_id,'Zalo',true,null,'demo_zalo_inbound_assumption','demo:customer-contacts-via-zalo'
from public.retention_cases c join public.customers cu on cu.id=c.customer_id
where cu.is_synthetic
on conflict(customer_id,channel) do nothing;

select count(*) filter (where contact_allowed and opt_out_at is null) as zalo_allowed,
       count(*) filter (where opt_out_at is not null) as zalo_opted_out
from public.contact_preferences where channel='Zalo';
commit;
