-- Minimal DB-backed durable job queue: one job per persona session (Phase 6).
-- Leases + heartbeats let a worker restart or stall without losing or
-- double-running a job; `select ... for update skip locked` is the claim.

create type job_status as enum ('pending', 'leased', 'completed', 'failed', 'cancelled');

create table jobs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  session_id uuid not null references persona_sessions(id) on delete cascade,
  status job_status not null default 'pending',
  attempt integer not null default 0,
  max_attempts integer not null default 3,
  available_at timestamptz not null default now(),
  leased_by text,
  leased_until timestamptz,
  last_heartbeat_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id)
);
create index jobs_claimable_idx on jobs(status, available_at) where status = 'pending';
create index jobs_leased_until_idx on jobs(leased_until) where status = 'leased';
