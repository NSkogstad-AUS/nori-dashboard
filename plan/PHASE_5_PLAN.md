# Phase 5 Plan — One real persona agent, end to end

Created: 12 September 2026
Status: Implementation complete; live Claude acceptance pending a configured API key.
Parent: [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md), Phase 5 checklist.

## Purpose

Phase 5 replaces Phase 4's fixed click script with one model-selected persona loop while retaining
the deterministic Playwright executor and all network controls. The first persona is Alex, a
first-time visitor. The first task remains the owned fixture's newsletter subscription.

## Decisions

- Anthropic's official TypeScript SDK drives action selection. The default model is
  `claude-sonnet-5`, configurable with `ANTHROPIC_MODEL`.
- Claude receives a compact current-page observation and screenshot, then must call one strict
  `browser_action` tool. It never receives direct Playwright or network access.
- Website text is untrusted input. It cannot change origins, reveal credentials, authorize
  uploads, purchases, messages, or other external side effects.
- Reasoning is not persisted. Reports retain only concise observations, actions, evidence IDs,
  model/prompt versions, token usage, outcome, summary, and calculated cost.
- A task failure is a completed persona report with `task_failure`. Invalid model output and loop
  failures are `model_failure`; browser, storage, database, and runtime failures are
  `infrastructure_failure`.

## Checklist

- [x] Define versioned persona, page-observation, bounded-action, decision, usage, and report
      contracts.
- [x] Seed the real Alex persona independently of the Phase 4 system runner.
- [x] Build a DOM observation containing URL, title, bounded visible text, actionable element IDs,
      accessible labels, type, role, and disabled state, plus an optional screenshot.
- [x] Add the official Anthropic adapter with a strict `browser_action` tool and versioned system
      prompt.
- [x] Validate every model action against the current observation and Phase 4 navigation policy.
- [x] Execute navigate, click, scroll, type, wait, capture, and finish deterministically in
      Playwright.
- [x] Block password/file/hidden input, unknown or disabled elements, unsafe navigation, downloads,
      and non-fixture execution.
- [x] Enforce action, wall-clock, repeat-loop, token-cost, and cancellation limits.
- [x] Persist action steps, screenshots, run cost, failure classification, and an evidence-linked
      persona report.
- [x] Add a claimed-job Chromium integration test proving Alex completes the fixture task and the
      report reconciles with stored steps.
- [x] Add policy tests for prompt-injection text, invalid actions, sensitive typing, repeated
      actions, and the hard cost cap.
- [ ] Run the same fixture journey through the live Anthropic API. The local `.env` currently has
      the placeholder `ANTHROPIC_API_KEY`, so this external acceptance check cannot run yet.

## Acceptance gate

The deterministic adapter integration passes: a real browser session observes the owned fixture,
selects and executes actions through the model boundary, confirms the visible success state, and
stores an evidence-linked report. Phase 5 becomes complete when the same path passes once with the
live Anthropic adapter and configured key using:

```bash
npm run dev:fixture-site
npm run run-agent-fixture --workspace=apps/worker
```

## Session notes

### 2026-09-12 — Implementation

Added the Phase 5 contracts, Anthropic tool-use adapter, prompt boundary, loop controller,
Playwright action executor, Alex seed, database migration and queries, claimed-job integration,
and one-shot fixture CLI. Automated coverage passes with an injected deterministic model at the
same interface used by the Anthropic adapter. The live run was attempted, but stopped before any
API request because `ANTHROPIC_API_KEY` is still the example placeholder.

### 2026-09-12 (continued) — Real run creation + live progress tracker

User asked for a live progress tracker on the Journeys page: stage "boxes" with the currently-
active stage shown as a large featured card, and dot-point sub-steps tracked within each stage.
Investigation found the Journeys page was still 100% fixture-data-driven (no connection to any
real run), and there was no way to create a real run from the UI at all — `NewRunDialog` only
showed a fixture toast, never called any API. Built both, plus two prerequisite fixes:

- **Fixed a real bug in `apps/worker/src/main.ts`'s `processJob`**: the fixture-mode gate ("Phase
  4 deterministic actions are disabled outside explicit fixture mode") ran unconditionally, before
  the branch that checks `options.model` — so a real, model-driven session against a real public
  website was killed immediately unless `WORKER_FIXTURE_MODE=true` (which also disables SSRF
  protection). The gate now only applies when `!options.model` (i.e. only the Phase 4 fixed script,
  which is genuinely hard-coded to the fixture site's DOM, needs it) — a model-driven session
  proceeds in strict mode, relying correctly on `navigationOptions.allowPrivateTargets` (false by
  default) rather than this second, overly-broad gate.
- **Seeded the 3 remaining fixture personas** (Jamie/Sam/Riley — only Alex existed as a real DB
  row before this) as real rows via a new `ensurePersonaFromSeed` helper in
  `packages/db/src/queries/personas.ts`, called once at worker startup
  (`apps/worker/src/main.ts`'s `ensureRemainingPersonas`), using the exact goal/behavior/device
  data already in `apps/web/src/fixtures/personas.ts`.
- **Added `session_state` to `steps`** (new migration `005_step_session_state.sql`,
  `stepSchema` gains `sessionState: SessionState`) so a step can be bucketed by which session
  stage was active when it was recorded, without inferring it after the fact. Every step recorded
  in `apps/worker/src/run-session.ts` is factually `'exploring'` (the browser-driving code only
  ever runs during that stage — `'analysing'` happens afterward, outside that file, when the
  report is produced), so `recordStep` there hard-codes it rather than threading a stale
  `session.state` through (the `session` object `processJob` passes in predates the state
  transitions it makes locally, since `updateSessionState`'s return value is discarded).
- **New DB queries**: `listSessionsForRun` (persona-sessions.ts — a run can have up to 3 sessions,
  no query listed them by run before this), `listPersonas` (personas.ts — needed once the frontend
  had to resolve real persona ids; see below).
- **New API routes**: `POST /api/runs` (validates `createRunRequestSchema`, verifies the website
  belongs to the caller's workspace, creates one persona session + job per requested persona, using
  the exact same `createRun`/`createPersonaSession`/`enqueueJob` sequence
  `run-fixture-job.ts` already used for CLI-seeded runs); `GET /api/runs/[id]/progress`
  (workspace-scoped, returns the run plus each session's steps and persona report — polled by the
  tracker); `GET /api/personas` (not workspace-scoped, since personas aren't — see below).
- **Real gap found mid-implementation, not in the original plan**: `NewRunDialog`'s persona picker
  used fixture UUIDs (`crypto.randomUUID()` generated fresh at module load in
  `apps/web/src/fixtures/ids.ts`), which never match a real `personas.id` (those come from
  Postgres's `gen_random_uuid()`). Submitting a real run with a fixture persona id would 404 at
  `getPersonaById`. Fixed by adding `GET /api/personas` and fetching real personas client-side in
  `AppShellFrame`, matched to the dialog's existing emoji/label UI by list order — not by trying to
  make the ids match, which isn't possible across two independently-generated UUID sources.
- **`AppShellFrame.handleNewRunSubmit`** now really POSTs to `/api/runs` (previously only showed a
  fixture toast and never called anything), using the current `selectedWebsiteId` from
  `WorkspaceContext`, a generated `idempotencyKey`, and a default explore-and-report `task` string
  (the dialog doesn't collect a task description yet — out of this scope). On success, navigates to
  `/journeys?runId=<runId>` instead of the previous bare `/runs`.
- **`OverviewAtlas`'s existing empty 3-card resizable row became the live tracker** (new
  `LiveRunTracker` component in `journeys-client.tsx`, rendered instead of `OverviewAtlas` only
  when a `?runId=` query param is present — `OverviewAtlas` itself is untouched, so fixture mode's
  view stays visibly separate from real-run mode per the master plan's own checklist item). Reused
  the grid/CSS exactly as built (`.overview-flow`'s `grid-template-columns` is hardcoded for
  exactly 3 cards + 2 arrows) by mapping the 3 real working session stages
  (`starting`/`exploring`/`analysing`) onto the 3 cards — `queued` has no step content yet, and a
  terminal outcome (`completed`/`failed`/`cancelled`) is shown as a status line above the row
  rather than forced into a 4th card, per explicit user confirmation. Polls
  `GET /api/runs/[runId]/progress` every 2s while non-terminal. Added
  `.overview-flow-card-content` and an `.expanded` accent-border/glow treatment to
  `packages/ui/src/styles/components.css`, since the placeholder cards never previously rendered
  any content.
- **Next.js build fix**: `useSearchParams()` (used to read `?runId=`) requires a `<Suspense>`
  boundary in the App Router or the entire page opts out of static generation with a hard build
  error — wrapped `JourneysClient` in `apps/web/src/app/journeys/page.tsx`.
- Checks actually run: `npm run typecheck`/`lint`/`build` all pass at the repo root (build output
  confirms `/api/personas`, `/api/runs`, `/api/runs/[id]/progress` all compile, `/journeys` builds
  cleanly with the Suspense fix). Re-ran the full `npm run test:integration` suite (43 tests
  including Phase 4/5's existing coverage) after the `session_state` migration and `appendStep`
  signature change — all still pass, no regressions. Applied migration `005` against real local
  Postgres. Ran the worker end-to-end against a freshly seeded fixture job (fixture mode, since no
  `ANTHROPIC_API_KEY` is configured in this environment): confirmed all 4 personas now exist as
  real rows, every recorded step has `session_state = 'exploring'` as expected, and directly
  exercised the progress route's underlying query chain (`getRunByIdUnscoped` +
  `listSessionsForRun` + `listStepsForSession` + `getPersonaReportBySessionId`) to confirm its JSON
  shape matches exactly what `LiveRunTracker` expects. Started the web dev server and confirmed
  `/api/personas`, `/api/runs`, `/api/runs/[id]/progress`, and `/journeys?runId=...` all respond
  through middleware correctly (401/redirect-to-sign-in behavior, no 500s or stack traces) without
  a real signed-in session to test further.
- Failures/limitations: real end-to-end browser click-testing ("sign in, add a website, click New
  Run, watch the tracker advance live") still cannot be exercised in this environment without a
  real Clerk session and a browser — verified as far as possible via direct query-chain testing and
  route-level smoke tests instead. The live Anthropic-API acceptance run noted in the previous
  session note is still outstanding (no `ANTHROPIC_API_KEY` configured here either) — the fixture-
  mode gate fix in this session doesn't change that, it only fixes the *separate* bug that would
  have blocked a real (non-fixture) run even once a key is configured.
- Next concrete task: get a real Clerk session + `ANTHROPIC_API_KEY` into a real browser to
  actually click through "sign in → add a website → New Run → watch the tracker" end to end, which
  would also satisfy the outstanding live-Anthropic acceptance check from the previous session note.
