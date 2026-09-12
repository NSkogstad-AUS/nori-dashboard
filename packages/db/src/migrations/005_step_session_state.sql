-- Records which session state was active when a step was recorded, so the live progress tracker
-- (see plan/PHASE_5_PLAN.md's session log) can bucket a session's steps by stage ("exploring",
-- "analysing", ...) without guessing from step sequence order. The worker already knows the
-- session's current state at every appendStep call site (see apps/worker/src/run-session.ts), so
-- this is recorded at insert time rather than inferred after the fact.
--
-- Default 'exploring' only backfills the handful of pre-existing rows from Phase 4/5 test runs
-- (which were all recorded during that state); every new insert supplies the real value
-- explicitly via packages/db/src/queries/steps.ts's appendStep.

alter table steps add column session_state session_state not null default 'exploring';
