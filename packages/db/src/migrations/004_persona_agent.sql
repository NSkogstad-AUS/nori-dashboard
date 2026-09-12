create type session_failure_kind as enum ('model_failure', 'infrastructure_failure');

alter table persona_sessions
  add column failure_kind session_failure_kind,
  add column failure_message text;

create type persona_report_outcome as enum ('task_success', 'task_failure');

create table persona_reports (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  session_id uuid not null unique references persona_sessions(id) on delete cascade,
  outcome persona_report_outcome not null,
  summary text not null,
  model_provider text not null,
  model_id text not null,
  prompt_version text not null,
  input_tokens integer not null check (input_tokens >= 0),
  output_tokens integer not null check (output_tokens >= 0),
  cost_usd numeric(10, 6) not null check (cost_usd >= 0),
  created_at timestamptz not null default now()
);
create index persona_reports_run_id_idx on persona_reports(run_id);

create table persona_report_steps (
  report_id uuid not null references persona_reports(id) on delete cascade,
  step_id uuid not null references steps(id) on delete cascade,
  primary key (report_id, step_id)
);
