-- Complete the foundation without dropping or replacing existing data.
create schema app_private;
revoke all on schema app_private from public;

create table public.staff_members (
  user_id uuid primary key references auth.users(id),
  display_name text not null check (length(btrim(display_name)) > 0),
  role text not null check (role in ('agent', 'supervisor')),
  active boolean not null default true,
  region text not null default 'Binh Duong',
  created_at timestamptz not null default now()
);
create table public.customer_portal_users (
  user_id uuid primary key references auth.users(id),
  customer_id uuid not null references public.customers(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index portal_customer_idx on public.customer_portal_users(customer_id);

alter table public.customers
  add column display_name text,
  add column contract_ref text,
  add column plan_name text,
  add column monthly_fee numeric check (monthly_fee >= 0),
  add column currency text not null default 'VND' check (currency ~ '^[A-Z]{3}$'),
  add column billing_mode text check (billing_mode in ('Prepaid', 'Postpaid')),
  add column tenure_months integer check (tenure_months >= 0),
  add column region text not null default 'Binh Duong',
  add column profile_source text not null default 'synthetic_demo';
alter table public.retention_cases
  add constraint case_staff_fk foreign key (assigned_agent_id)
    references public.staff_members(user_id),
  add column contact_result text not null default 'not_contacted'
    check (contact_result in ('not_contacted', 'no_answer', 'contacted', 'wrong_contact')),
  add column priority text not null default 'normal'
    check (priority in ('high', 'normal', 'low')),
  add column due_at timestamptz,
  add column last_contact_at timestamptz,
  add column close_reason text,
  add column updated_at timestamptz not null default now(),
  add constraint case_customer_unique unique (id, customer_id);

create table public.workspace_settings (
  singleton boolean primary key default true check (singleton),
  follow_up_delay interval not null default interval '3 hours'
    check (follow_up_delay > interval '0 seconds'),
  delay_is_proposed boolean not null default true,
  contact_cooldown interval not null default interval '0 seconds' check (contact_cooldown >= interval '0 seconds'),
  daily_contact_limit integer check (daily_contact_limit > 0),
  contact_window_start time,
  contact_window_end time,
  max_delivery_attempts integer not null default 3 check (max_delivery_attempts between 1 and 10),
  delivery_lease interval not null default interval '2 minutes'
    check (delivery_lease > interval '0 seconds'),
  updated_at timestamptz not null default now(),
  check ((contact_window_start is null) = (contact_window_end is null)),
  check (contact_window_start is null or contact_window_start < contact_window_end)
);
insert into public.workspace_settings(singleton) values (true);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  version integer not null check (version > 0),
  title text not null,
  description text not null,
  eligibility_rules jsonb not null default '{}' check (jsonb_typeof(eligibility_rules) = 'object'),
  unit_cost numeric not null check (unit_cost >= 0),
  currency text not null default 'VND' check (currency ~ '^[A-Z]{3}$'),
  valid_from timestamptz not null,
  valid_until timestamptz not null check (valid_until > valid_from),
  active boolean not null default false,
  requires_supervisor boolean not null default true,
  created_at timestamptz not null default now(),
  unique(code, version)
);
create table public.customer_offer_eligibility (
  customer_id uuid not null references public.customers(id),
  offer_id uuid not null references public.offers(id),
  eligible boolean not null,
  reason text not null,
  evaluated_at timestamptz not null default now(),
  valid_until timestamptz not null,
  rule_version text not null,
  primary key(customer_id, offer_id),
  check (valid_until > evaluated_at)
);
create table public.ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.retention_cases(id),
  prediction_context_id uuid references public.prediction_contexts(id),
  request_key text not null unique,
  action text not null,
  offer_id uuid references public.offers(id),
  rationale text not null,
  call_script text,
  missing_fields jsonb not null default '[]' check (jsonb_typeof(missing_fields) = 'array'),
  generation_mode text not null check (generation_mode in ('fixture', 'template', 'llm')),
  model_version text not null,
  prompt_version text not null,
  status text not null default 'draft' check (status in ('draft', 'superseded', 'failed')),
  created_at timestamptz not null default now(),
  unique(id, case_id)
);
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  customer_id uuid not null,
  selected_channel text not null default 'Zalo' check (selected_channel in ('Zalo','Messenger','Portal')),
  transport text not null default 'mock' check (transport = 'mock'),
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  foreign key(case_id, customer_id) references public.retention_cases(id, customer_id),
  unique(case_id, selected_channel),
  unique(id, case_id)
);
create table public.contact_preferences (
  customer_id uuid not null references public.customers(id),
  channel text not null check (channel in ('Zalo','Messenger','Portal')),
  contact_allowed boolean not null default false,
  opt_out_at timestamptz,
  consent_basis text not null,
  evidence_ref text not null,
  updated_at timestamptz not null default now(),
  primary key(customer_id, channel),
  check (not contact_allowed or opt_out_at is null)
);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  conversation_id uuid not null,
  sender_type text not null check (sender_type in ('customer','agent','ai','system')),
  sender_user_id uuid references auth.users(id),
  direction text not null check (direction in ('inbound','outbound','internal')),
  visibility text not null check (visibility in ('external','internal')),
  ai_generated boolean not null default false,
  recommendation_id uuid,
  current_revision integer not null default 1 check (current_revision > 0),
  sent_revision integer,
  approval_status text not null default 'draft'
    check (approval_status in ('draft','pending_approval','approved','rejected','not_required')),
  delivery_status text not null default 'not_queued'
    check (delivery_status in ('not_queued','queued','sending','sent','failed','cancelled','received')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  foreign key(conversation_id, case_id) references public.conversations(id, case_id),
  foreign key(recommendation_id, case_id) references public.ai_recommendations(id, case_id),
  unique(id, case_id),
  check ((direction = 'internal') = (visibility = 'internal')),
  check ((direction = 'inbound') = (sender_type = 'customer')),
  check (direction <> 'inbound' or (approval_status = 'not_required' and delivery_status = 'received')),
  check (delivery_status <> 'sent' or
    (sent_at is not null and sent_revision is not null and approval_status = 'approved'))
);
create table public.message_revisions (
  message_id uuid not null references public.messages(id),
  revision integer not null check (revision > 0),
  body text not null check (length(btrim(body)) between 1 and 10000),
  request_key text not null unique,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  offer_id uuid references public.offers(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  primary key(message_id, revision),
  unique(message_id, revision, content_hash),
  check (content_hash = encode(sha256(convert_to(body, 'UTF8')), 'hex'))
);
alter table public.messages add constraint current_revision_fk
  foreign key(id, current_revision) references public.message_revisions(message_id, revision)
  deferrable initially deferred;
alter table public.messages add constraint sent_revision_fk
  foreign key(id, sent_revision) references public.message_revisions(message_id, revision)
  deferrable initially deferred;
create table public.message_approvals (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null,
  revision integer not null,
  content_hash text not null,
  reviewer_id uuid not null references public.staff_members(user_id),
  decision text not null check (decision in ('approved','rejected')),
  reason text,
  decided_at timestamptz not null default now(),
  foreign key(message_id, revision, content_hash)
    references public.message_revisions(message_id, revision, content_hash),
  unique(id, message_id, revision, content_hash, decision)
);
create table public.delivery_outbox (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null,
  revision integer not null,
  content_hash text not null,
  approval_id uuid not null,
  decision text not null default 'approved' check (decision = 'approved'),
  channel text not null check (channel in ('Zalo','Messenger','Portal')),
  idempotency_key text not null unique,
  status text not null default 'queued' check (status in ('queued','sending','sent','failed','cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  provider_receipt text unique,
  error_code text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  foreign key(approval_id, message_id, revision, content_hash, decision)
    references public.message_approvals(id, message_id, revision, content_hash, decision),
  unique(message_id, revision, channel),
  check (status <> 'sent' or (provider_receipt is not null and sent_at is not null)),
  check (status <> 'sending' or (lease_token is not null and lease_until is not null))
);
create table public.interaction_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.retention_cases(id),
  message_id uuid,
  event_type text not null,
  actor_user_id uuid references auth.users(id),
  occurred_at timestamptz not null default now(),
  channel text check (channel in ('Zalo','Messenger','Portal')),
  provider_event_id text,
  correlation_id uuid not null default gen_random_uuid(),
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object'),
  foreign key(message_id, case_id) references public.messages(id, case_id),
  unique(channel, provider_event_id)
);
create table public.follow_up_tasks (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.retention_cases(id),
  source_message_id uuid,
  task_type text not null check (task_type in ('no_reply','manual_reminder','first_contact')),
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','due','completed','cancelled')),
  assigned_agent_id uuid references public.staff_members(user_id),
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key(source_message_id, case_id) references public.messages(id, case_id)
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.staff_members(user_id),
  case_id uuid not null references public.retention_cases(id),
  source_event_id uuid references public.interaction_events(id),
  type text not null check (type in ('new_message','follow_up_due','delivery_failed','case_assigned')),
  title text not null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.retention_cases(id),
  requested_by uuid not null references public.staff_members(user_id),
  request_body text not null check (length(btrim(request_body)) between 1 and 10000),
  preferred_contact_time text,
  handoff_status text not null default 'queued' check (handoff_status in ('queued','sent','failed','cancelled')),
  transport text not null default 'mock' check (transport = 'mock'),
  idempotency_key text not null unique,
  external_receipt text unique,
  error_code text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  check (handoff_status <> 'sent' or (sent_at is not null and external_receipt is not null))
);
create table public.retention_outcomes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.retention_cases(id),
  window_start date not null,
  window_end date not null check (window_end >= window_start),
  churned boolean,
  offer_accepted boolean,
  observed_at timestamptz,
  source text not null,
  evidence_ref text,
  is_simulated boolean not null,
  recorded_by uuid references public.staff_members(user_id),
  updated_at timestamptz not null default now(),
  unique(case_id, window_start, window_end),
  check (churned is null or (observed_at is not null and evidence_ref is not null))
);
-- Costs belong to individual interventions, avoiding repeated totals per outcome.
create table public.intervention_costs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.retention_cases(id),
  amount numeric not null check (amount >= 0),
  currency text not null default 'VND' check (currency ~ '^[A-Z]{3}$'),
  cost_type text not null check (cost_type in ('contact','offer','support','other')),
  source text not null,
  is_simulated boolean not null,
  idempotency_key text not null unique,
  recorded_at timestamptz not null default now()
);
-- Durable requests/results only; n8n owns AI execution, retries and error logs.
create table public.automation_jobs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.retention_cases(id),
  job_type text not null check (job_type in ('recommendation','reply_draft')),
  request_key text not null unique,
  rewrite_instructions text check(length(rewrite_instructions)<=2000),
  rewrite_source_text text check(length(rewrite_source_text)<=10000),
  status text not null default 'queued' check (status in ('queued','completed','failed','cancelled')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index recommendations_case_idx on public.ai_recommendations(case_id, created_at);
create index conversations_customer_idx on public.conversations(customer_id);
create index messages_thread_idx on public.messages(conversation_id, created_at, id);
create index messages_case_idx on public.messages(case_id);
create index approvals_message_idx on public.message_approvals(message_id, revision);
create index outbox_worker_idx on public.delivery_outbox(status, next_attempt_at, lease_until);
create index events_case_idx on public.interaction_events(case_id, occurred_at);
create index follow_up_worker_idx on public.follow_up_tasks(status, due_at);
create index notifications_recipient_idx on public.notifications(recipient_user_id, read_at, created_at);
create index support_worker_idx on public.support_requests(handoff_status, created_at);
create index jobs_worker_idx on public.automation_jobs(status, created_at);

-- Immutable revisions/approval/event history, including for trusted worker DML.
create function app_private.prevent_history_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin raise exception 'History rows are immutable; create a new revision/event'; end $$;
create trigger immutable_revisions before update or delete on public.message_revisions
  for each row execute function app_private.prevent_history_mutation();
create trigger immutable_approvals before update or delete on public.message_approvals
  for each row execute function app_private.prevent_history_mutation();
create trigger immutable_events before update or delete on public.interaction_events
  for each row execute function app_private.prevent_history_mutation();
