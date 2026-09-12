-- Entities from plan/IMPLEMENTATION_PLAN.md section 5.
-- Every tenant-owned table carries workspace_id; ownership is never inferred
-- from the request, only from server-side lookups against these tables.

create extension if not exists pgcrypto;

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create type membership_role as enum ('owner', 'member');

create table memberships (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id text not null,
  role membership_role not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create type website_authorization_status as enum ('unverified', 'owner_verified', 'fixture');

create table websites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  display_name text not null,
  origin text not null,
  authorization_status website_authorization_status not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, origin)
);
create index websites_workspace_id_idx on websites(workspace_id);

create table personas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version integer not null default 1,
  emoji text not null,
  goal text not null,
  behavior text not null,
  device jsonb not null,
  limitations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (name, version)
);

create type run_state as enum (
  'queued', 'running', 'analysing', 'completed', 'completed_with_errors', 'failed', 'cancelled'
);
create type cancel_request_state as enum ('none', 'cancel_requested', 'cancelled');

create table runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  website_id uuid not null references websites(id) on delete cascade,
  url text not null,
  task text not null,
  allowed_origins jsonb not null,
  limits jsonb not null,
  state run_state not null default 'queued',
  cancel_request_state cancel_request_state not null default 'none',
  idempotency_key text not null,
  cost_total_usd numeric(10, 4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);
create index runs_workspace_id_idx on runs(workspace_id);
create index runs_website_id_idx on runs(website_id);
create index runs_state_idx on runs(state);

create type session_state as enum (
  'queued', 'starting', 'exploring', 'analysing', 'completed', 'failed', 'cancelled'
);

create table persona_sessions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  persona_id uuid not null references personas(id),
  persona_version integer not null,
  attempt integer not null default 0,
  device jsonb not null,
  state session_state not null default 'queued',
  heartbeat_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index persona_sessions_run_id_idx on persona_sessions(run_id);
create index persona_sessions_state_idx on persona_sessions(state);

create type step_action as enum ('navigate', 'click', 'scroll', 'type', 'wait', 'capture', 'finish');
create type step_outcome as enum ('success', 'error', 'blocked');

create table steps (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references persona_sessions(id) on delete cascade,
  sequence integer not null,
  action step_action not null,
  outcome step_outcome not null,
  url_before text,
  url_after text,
  observation text,
  created_at timestamptz not null default now(),
  unique (session_id, sequence)
);
create index steps_session_id_idx on steps(session_id);

create type artifact_content_type as enum ('image/png', 'image/jpeg');

create table artifacts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references persona_sessions(id) on delete cascade,
  step_id uuid references steps(id) on delete set null,
  storage_key text not null,
  content_type artifact_content_type not null,
  width integer not null,
  height integer not null,
  redacted boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index artifacts_session_id_idx on artifacts(session_id);
create index artifacts_step_id_idx on artifacts(step_id);
create index artifacts_expires_at_idx on artifacts(expires_at);

create table step_artifacts (
  step_id uuid not null references steps(id) on delete cascade,
  artifact_id uuid not null references artifacts(id) on delete cascade,
  primary key (step_id, artifact_id)
);

create type finding_category as enum (
  'functional_issue', 'navigation_friction', 'clarity', 'accessibility_signal', 'performance_observation'
);
create type finding_severity as enum ('low', 'moderate', 'high');

create table findings (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  category finding_category not null,
  severity finding_severity not null,
  confidence numeric(3, 2) not null check (confidence >= 0 and confidence <= 1),
  title text not null,
  observed_fact text not null,
  inferred_explanation text,
  recommendation text not null,
  reproduction_steps jsonb not null,
  created_at timestamptz not null default now()
);
create index findings_run_id_idx on findings(run_id);

create table finding_sessions (
  finding_id uuid not null references findings(id) on delete cascade,
  session_id uuid not null references persona_sessions(id) on delete cascade,
  primary key (finding_id, session_id)
);

create table finding_steps (
  finding_id uuid not null references findings(id) on delete cascade,
  step_id uuid not null references steps(id) on delete cascade,
  primary key (finding_id, step_id)
);

create table finding_artifacts (
  finding_id uuid not null references findings(id) on delete cascade,
  artifact_id uuid not null references artifacts(id) on delete cascade,
  primary key (finding_id, artifact_id)
);

create type run_event_type as enum (
  'run.status', 'session.status', 'step.started', 'step.completed',
  'artifact.ready', 'finding.created', 'session.error', 'run.finished'
);

create table run_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  session_id uuid references persona_sessions(id) on delete cascade,
  sequence bigint not null,
  type run_event_type not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (run_id, sequence)
);
create index run_events_run_id_idx on run_events(run_id);
