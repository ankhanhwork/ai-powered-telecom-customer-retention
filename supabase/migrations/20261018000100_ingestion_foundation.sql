-- Phase 1: prediction ingestion only. Run once on a new Supabase project.
-- No source data, credentials, offers, messages, approvals or outbound actions.
-- SQL Editor: select and run this entire file. Do not rerun after success.
-- GitHub/CLI: use this file as a versioned migration instead of applying twice.

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  customer_ref text not null check (length(btrim(customer_ref)) > 0),
  source_dataset text not null check (length(btrim(source_dataset)) > 0),
  is_synthetic boolean not null,
  created_at timestamptz not null default now(),
  unique (source_dataset, customer_ref)
);

create table public.prediction_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique check (length(btrim(run_key)) > 0),
  dataset_version text not null,
  model_version text not null,
  calibration_version text not null,
  snapshot_date date not null,
  target_period_start date not null,
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  is_synthetic boolean not null,
  created_at timestamptz not null default now(),
  -- Demo contract: month-end snapshot predicts the next calendar month.
  check (target_period_start = (date_trunc('month', snapshot_date::timestamp)
    + interval '1 month')::date),
  check (snapshot_date = target_period_start - 1),
  unique (id, snapshot_date, target_period_start)
);

create table public.customer_snapshots (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  snapshot_date date not null,
  dataset_version text not null,
  snapshot_basis text not null default 'synthetic_month_end'
    check (snapshot_basis = 'synthetic_month_end'),
  -- Do not store training labels or private generator audit here.
  -- The importer must enforce ml/config.json's feature whitelist.
  features jsonb not null default '{}'::jsonb
    check (jsonb_typeof(features) = 'object'),
  created_at timestamptz not null default now(),
  unique (customer_id, snapshot_date, dataset_version),
  unique (id, customer_id, snapshot_date)
);

create table public.churn_predictions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  snapshot_id uuid not null,
  run_id uuid not null,
  snapshot_date date not null,
  target_period_start date not null,
  raw_probability numeric not null check (raw_probability between 0 and 1),
  churn_probability numeric not null check (churn_probability between 0 and 1),
  churn_score numeric generated always as (churn_probability * 1000) stored,
  company_gt_500 boolean generated always as (churn_probability > 0.5) stored,
  explanations_status text not null,
  explanation_version text,
  -- Prediction is not an observed retention/churn outcome.
  created_at timestamptz not null default now(),
  foreign key (snapshot_id, customer_id, snapshot_date)
    references public.customer_snapshots(id, customer_id, snapshot_date),
  foreign key (run_id, snapshot_date, target_period_start)
    references public.prediction_runs(id, snapshot_date, target_period_start),
  unique (run_id, customer_id),
  unique (id, customer_id, target_period_start)
);

create table public.prediction_contexts (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid not null references public.churn_predictions(id),
  explanation_version text not null,
  -- Internal care context from explanations/care_context.jsonl only.
  -- LLM/customer output must be separately filtered; this is not a portal table.
  context jsonb not null check (jsonb_typeof(context) = 'object'),
  requires_staff_review boolean not null default true check (requires_staff_review),
  customer_outbound_allowed boolean not null default false
    check (not customer_outbound_allowed),
  created_at timestamptz not null default now(),
  unique (prediction_id, explanation_version)
);

create table public.retention_cases (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  prediction_id uuid not null,
  target_period_start date not null,
  -- Assignments must later pass staff-role/ownership checks via server/RPC.
  assigned_agent_id uuid references auth.users(id),
  case_status text not null default 'new'
    check (case_status in ('new', 'in_progress', 'waiting_customer', 'closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  foreign key (prediction_id, customer_id, target_period_start)
    references public.churn_predictions(id, customer_id, target_period_start),
  unique (customer_id, target_period_start),
  check ((case_status = 'closed') = (closed_at is not null))
);

create index customer_snapshots_customer_idx on public.customer_snapshots(customer_id);
create index churn_predictions_snapshot_idx on public.churn_predictions(snapshot_id);
create index retention_cases_prediction_idx on public.retention_cases(prediction_id);
create index retention_cases_queue_idx
  on public.retention_cases(assigned_agent_id, case_status, created_at);

-- Deny browser access until ownership policies are implemented and tested.
-- service_role is for trusted server/n8n credentials only, never the frontend.
alter table public.customers enable row level security;
alter table public.prediction_runs enable row level security;
alter table public.customer_snapshots enable row level security;
alter table public.churn_predictions enable row level security;
alter table public.prediction_contexts enable row level security;
alter table public.retention_cases enable row level security;

revoke all on table public.customers, public.prediction_runs,
  public.customer_snapshots, public.churn_predictions,
  public.prediction_contexts, public.retention_cases
  from public, anon, authenticated;
grant select, insert, update, delete on table public.customers,
  public.prediction_runs, public.customer_snapshots, public.churn_predictions,
  public.prediction_contexts, public.retention_cases to service_role;

-- Private file archive; no storage.objects policies are added.
-- Only trusted server credentials/dashboard administrators can upload for now.
insert into storage.buckets (id, name, public)
values ('retention-datasets', 'retention-datasets', false);

comment on table public.prediction_contexts is
  'Internal model explanations and care drafts. Not approved outbound content.';
comment on table public.retention_cases is
  'Operational case state only. Closing a case does not establish a retention outcome.';
