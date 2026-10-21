-- Removes the outbound contact gate (permission, closed case, hours, cooldown, daily limit).
create or replace function app_private.assert_contact(p_case uuid, p_channel text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- Contact gate removed: staff can send on any channel at any time.
  return;
end $$;
