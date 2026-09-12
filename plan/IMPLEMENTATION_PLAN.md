# Nori — Product Implementation Plan

Created: 12 September 2026
Status: Planning only. No production functionality has been implemented by this plan.

## 1. Purpose and working rules

Build Nori: an AI usability consultant that explores authorized websites through different personas, records what happens, identifies potential bugs and usability friction, and produces evidence-linked recommendations.

The core journey is:

**Website URL → task and personas → browser exploration → journey overview / live view → evidence-backed report.**

Use this file as the implementation checklist, not just a specification:

1. Work through phases in order. Do not skip a phase's acceptance gate.
2. Check a task only when its implementation and required verification are complete.
3. Keep each change focused; avoid simultaneously replacing the design and building the agent system.
4. Record decisions in the decision log below. Mark unresolved choices explicitly.
5. At the end of each work session, update the handoff section with completed work, checks, blockers, and the next concrete task.
6. Never present fixture data, simulated recordings, or model guesses as actual test results.
7. Preserve the existing prototypes until the replacement passes visual and functional review.
8. Treat the defaults in this plan as proposals, not as already-installed infrastructure or approved vendors.

## 2. Current state and design baseline

Inspected starting point:

- This repository currently contains inspiration folders, not an application/backend scaffold.
- Dashboard prototype: `/Users/nicolaiskogstad/PROJECTS_WEBSITES/nori-dashboard`.
- Homepage prototype: `/Users/nicolaiskogstad/PROJECTS_WEBSITES/nori-website`.
- Dashboard files are static HTML, CSS, and JavaScript. Their runs, findings, playback frames, and screenshots are fictional/in-memory.
- Chosen direction: **01 / Journey Atlas**. The five-way design comparison is no longer needed.
- Preserve the rounded attached-perspective shelf, emoji persona pills, issue markers, connected journey steps, and floating **Overview / Live view** controls.
- Preserve Home, Journeys, Runs, and Websites navigation and the existing new-run entry point.
- Color reference: homepage Soft Spectrum, balancing pink, coral, lavender, and sky blue. Use neutral reading surfaces and dark text; do not return to a mostly orange/yellow or pale purple dashboard.
- Live view should follow the selected persona. Captured moments should open the corresponding evidence and journey step.

Do not migrate old concept-specific CSS and simulated behavior wholesale. Extract the selected visual system into reusable components.

## 3. Scope and boundaries

### First usable release

- Save and revisit websites inside an authenticated workspace.
- Create a run with a URL, explicit task, one to three personas, device settings, and safe execution limits.
- Explore owner-authorized public/staging pages with isolated browsers.
- Record timestamped actions, screenshots, final URLs, and relevant browser errors.
- Display real progress, persona paths, and near-live screenshot updates.
- Cancel runs, inspect failures, and view completed evidence-linked reports.
- Persist results across reloads and enforce workspace-level access control.

### Not in the first release

- Automatically deploying fixes or modifying customer source code.
- Purchases, payments, messages, destructive actions, or unrestricted form submissions.
- Arbitrary authenticated-site access, uploaded cookies, production credentials, or CAPTCHA bypass.
- Full video/WebRTC streaming if refreshed screenshots satisfy the first live-view experience.
- Mobile native apps, billing, team-role administration, and custom persona marketplaces.
- Claims that simulated personas represent real user research or certify accessibility.

Use a controlled fixture website for workflows requiring account creation or other side effects. Public-page testing remains conservative by default.

## 4. Proposed architecture

Recommended starting shape, to confirm before scaffolding:

- **Web application:** React and TypeScript; a server-capable framework such as Next.js for dashboard routes and authenticated API endpoints.
- **API/control layer:** owns validation, authorization, run creation, cancellation, persistence, and event delivery. Never executes long browser jobs inside a web request.
- **Worker:** separate Node/TypeScript process using Playwright for browser execution, with schema-validated model actions behind a provider adapter.
- **Database:** PostgreSQL for workspaces, websites, runs, sessions, steps, findings, and durable event ordering.
- **Queue:** durable job queue with leases/heartbeats; choose a maintained database-backed implementation first, or Redis-backed queue if the hosting environment warrants it. Do not invent an in-memory production queue.
- **Artifact storage:** private object storage for screenshots and optional later recordings. Local storage may be used only for local development.
- **Updates:** server-sent events for status/action updates; authenticated image retrieval or short-lived signed URLs for screenshots. Cancellation uses an authenticated API request.
- **Deployment:** web and workers run separately; workers require a browser-compatible sandbox and restrictive outbound network policy.

### Suggested source layout

```text
nori-hackathon/
  plan/IMPLEMENTATION_PLAN.md
  apps/web/                 dashboard, authenticated API, event endpoint
  apps/worker/              job consumer, browser runner, analysis pipeline
  packages/contracts/      shared schemas and event types
  packages/db/             database schema, migrations, queries
  packages/agent/          model adapter, persona prompts, action policy
  packages/ui/             selected Nori components and design tokens
  tests/fixtures/site/     controlled website with known failures
  tests/integration/       worker/API/database tests
  tests/e2e/               complete user journeys
  docs/                    setup, architecture, security, operating guide
```

Keep packages only where useful; a smaller initial scaffold is acceptable. Verify current official documentation, package compatibility, and hosting constraints before pinning versions.

## 5. Contracts to agree before connecting components

### Data model

Every tenant-owned record must carry a workspace identifier; do not rely on the browser to supply or enforce ownership.

| Entity | Required information |
| --- | --- |
| Workspace / Membership | Identity, owner/member relationship, access boundary |
| Website | Workspace, display name, canonical origin, authorization record, timestamps |
| Persona | Versioned name, emoji, goal-relevant behavior, device/input settings, limitations |
| Run | Website, URL, task, allowed origins, limits, state, idempotency key, cost totals |
| Persona session | Run, persona snapshot, attempt, browser/device settings, state, heartbeat |
| Step | Session, sequence, action, outcome, timestamp, URL before/after, evidence references |
| Artifact | Session/step, private storage key, content type, dimensions, redaction status, expiry |
| Finding | Evidence-linked observation, category, severity, confidence, reproduction, recommendation |
| Run event | Run/session, monotonic sequence, type, safe payload, timestamp |

### State machines

- Run: `queued → running → analysing → completed`.
- Additional terminal outcomes: `completed_with_errors`, `failed`, `cancelled`.
- Cancellation request: `cancel_requested`, followed by bounded cleanup and `cancelled` acknowledgement.
- Persona session: `queued → starting → exploring → analysing → completed`, with explicit failed/cancelled alternatives.
- Define which transitions are legal, who owns them, and how mixed session outcomes produce the run outcome.
- A browser session failure must never look like a passed test or a zero-issue success.

### API sketch

- `POST /api/websites`, `GET /api/websites`, `GET /api/websites/:id`.
- `POST /api/runs`: validate request, persist snapshots, enqueue idempotently, return `202` with run ID.
- `GET /api/runs`: pagination and website/status filters.
- `GET /api/runs/:id`: durable state, sessions, and summary.
- `POST /api/runs/:id/cancel`: authorize and request cancellation idempotently.
- `GET /api/runs/:id/events`: ordered event stream with reconnect cursor.
- `GET /api/sessions/:id/steps` and `GET /api/sessions/:id/artifacts`.
- `GET /api/runs/:id/findings` and `GET /api/findings/:id`.
- `POST /api/sessions/:id/captures`: request a worker-owned capture, subject to rate limits.
- Authenticated artifact access and run deletion endpoints, with documented retention behavior.

### Event types

Define versioned schemas for `run.status`, `session.status`, `step.started`, `step.completed`, `artifact.ready`, `finding.created`, `session.error`, and `run.finished`.

Every event needs a stable ID, run ID, optional session ID, ordered sequence, timestamp, and validated payload. Persist events before delivery. Never stream secrets, full model prompts, or private reasoning; expose concise action descriptions and observations instead.

## 6. Step-by-step implementation

### Phase 0 — Freeze the brief and resolve deployment constraints

- [ ] Confirm the first task type: recommended starting point is discovering and comparing a product's public plans.
- [ ] Confirm what website authorization is required. Recommended hosted-release default: owner verification; local development uses owned fixtures.
- [ ] Confirm hosting, database, artifact storage, queue, authentication, and model provider.
- [ ] Confirm runtime limits, spending cap, screenshot retention, and screenshot refresh expectations.
- [ ] Record selected stack and versions in the decision log.
- [ ] Save the selected prototype as a reference without overwriting it.
- [ ] Create a short visual checklist for desktop/mobile, persona selection, overview, live view, and reports.

**Gate:** Scope, safety policy, architecture, and acceptance criteria are explicit. No unresolved assumption is silently implemented as product behavior.

### Phase 1 — Scaffold a runnable project

- [x] Create the chosen source layout and dependency lockfile.
- [x] Add formatting, linting, type checking, test scripts, and a root development guide.
- [x] Add `.env.example` containing variable names and descriptions, never credentials.
- [x] Configure local database, queue, and private artifact storage. _(Postgres via docker-compose; DB-backed `jobs` table with lease/heartbeat columns; local-disk artifact storage dir for dev only, per `.env.example`. Queue polling and object storage are not implemented yet — this only configures the tables/paths, not the runtime logic, which lands in later phases.)_
- [x] Add health checks for the web process and worker.
- [x] Establish shared request/response/event schemas and structured error codes.
- [x] Add CI checks for types, lint, tests, and production build. _(No test step yet — no tests exist to run. CI runs typecheck, lint, and build; a test step will be added once Phase 4 introduces the fixture site and tests/integration coverage.)_

**Gate:** A fresh checkout starts using documented instructions, with no manually edited source files or committed secrets.

### Phase 2 — Turn the chosen design into application components

Detailed working plan: [PHASE_2_PLAN.md](./PHASE_2_PLAN.md). Work through that document's
checklist; the items below are the summary view.

- [ ] Extract Soft Spectrum tokens: colors, gradients, text contrast, radii, spacing, shadows, and motion.
- [ ] Build AppShell, Sidebar, WebsiteSwitcher, PageHeader, and floating quick actions.
- [ ] Build PersonaShelf, PersonaPill, JourneyViewSwitch, JourneyStage, and JourneyStep.
- [ ] Build RunCard, NewRunDialog, FindingDrawer, BrowserViewport, PlaybackControls, and CaptureStrip.
- [ ] Replace full-page string rendering with stateful components that preserve focus and scrolling.
- [ ] Keep fixture mode visibly separate from real-run mode.
- [ ] Implement loading, empty, error, unavailable-artifact, and permission-denied states.
- [ ] Verify keyboard navigation, dialog focus restoration, screen-reader labels, and reduced motion.
- [ ] Keep diagrams scrollable on narrow screens without making the whole page overflow.

**Gate:** The selected visual direction and interactions survive the migration. No new five-concept selector is introduced.

### Phase 3 — Identity, database, and website tracking

Detailed working plan: [PHASE_3_PLAN.md](./PHASE_3_PLAN.md). Work through that document's
checklist; the items below are the summary view.

- [x] Implement authentication and workspace membership checks. _(Clerk; one personal workspace
  per Clerk user, no multi-user/organization concept; middleware + `requireWorkspace()`
  resource-level checks in every API route. Originally built on Clerk Organizations, reverted —
  see the decision log below.)_
- [x] Add migrations for the entities above, foreign keys, indexes, and uniqueness constraints.
  _(Already scaffolded in Phase 1's `001_init.sql`/`002_queue.sql`; Phase 3 added
  `003_clerk_user_link.sql` and ran all three against real Postgres for the first time.)_
- [x] Build website creation, validation, listing views. _(`NewWebsiteDialog` + `POST
  /api/websites`, `GET /api/websites`, `websites/page.tsx` as a Server Component.)_ Detail view
  (`GET /api/websites/:id`) exists as an API route but has no dedicated page UI yet — deferred,
  not blocking the gate.
- [ ] Implement the agreed ownership/authorization process and show its status in the UI.
  _(`authorization_status` exists in the schema/API response but isn't surfaced in the UI yet —
  deferred; not required for this phase's literal gate.)_
- [ ] Load run cards and website counts from the database, not hard-coded examples. _(Explicitly
  deferred to a later phase — see [PHASE_3_PLAN.md](./PHASE_3_PLAN.md) section 1's scope
  boundary; runs stay fixture-backed this phase, only websites moved to real data.)_
- [x] Test that one workspace cannot access another workspace's runs, events, or artifacts.
  _(`tests/integration/workspace-isolation.test.ts`, scoped to websites specifically since runs/
  events/artifacts aren't real yet — verified to actually catch a broken-isolation regression.)_

**Gate:** Websites persist across reloads, and cross-workspace access is rejected server-side.
Both satisfied — see [PHASE_3_PLAN.md](./PHASE_3_PLAN.md) section 6 for verification detail.

### Phase 4 — Safe deterministic browser execution

Implement this before letting a model control arbitrary navigation.

Detailed working plan: [PHASE_4_PLAN.md](./PHASE_4_PLAN.md). Work through that document's
checklist; the items below are the summary view.

- [ ] Build an owned fixture site with clear success paths, broken links, a confusing CTA, keyboard-focus issues, and delayed/error pages.
- [ ] Start one browser job in an isolated environment with a fresh browser context.
- [ ] Restrict navigation and outbound traffic to approved public origins or explicitly isolated development fixtures.
- [ ] Block loopback, private/link-local addresses, cloud metadata endpoints, unsafe schemes, credentials in URLs, and non-approved ports.
- [ ] Validate redirects and DNS resolution, including IPv6 and rebinding scenarios. Enforce restrictions at the network boundary, not just on the initial URL.
- [ ] Apply the same outbound restrictions to subresources, popups, WebSockets, and other browser requests; prevent uncontrolled downloads.
- [ ] Configure timeouts, action limits, memory/CPU limits, and cancellation polling.
- [ ] Prohibit destructive or externally consequential actions. Only allow safe fixture submissions during development.
- [ ] Record a deterministic click/scroll/type sequence with real screenshots and structured errors.
- [ ] Close contexts and destroy worker resources on success, error, timeout, or cancellation.

**Gate:** A real browser completes the fixture task and produces inspectable artifacts. Security tests demonstrate blocked internal/private targets before accepting user-submitted URLs.

### Phase 5 — One real persona agent, end to end

- [ ] Define a versioned persona schema focused on behavior and goals, not stereotypes.
- [ ] Construct an observation from the current page, actionable elements, current URL, and optional screenshot.
- [ ] Define a bounded action schema: navigate, click, scroll, type into allowed fields, wait, capture, finish.
- [ ] Validate each model action against current browser state and server-side policy before executing it.
- [ ] Keep website content untrusted: page text cannot change system policy, request credentials, override allowed domains, or authorize side effects.
- [ ] Separate action choice from deterministic execution and observation storage.
- [ ] Limit steps, elapsed time, model tokens, and cost; detect loops and repeated failed actions.
- [ ] Store persona/model/prompt versions and reproducibility metadata without storing private chain-of-thought.
- [ ] Distinguish task success, task failure, model failure, and infrastructure failure.
- [ ] Connect one submitted run to one persisted persona session and one real report.

**Gate:** Nori can explain one actual fixture journey using recorded steps and screenshots. It does not fabricate evidence or continue indefinitely.

### Phase 6 — Durable jobs and multiple personas

- [ ] Queue each persona session as a separate job with bounded concurrency.
- [ ] Isolate cookies, storage, browser state, and execution budgets between personas.
- [ ] Implement leases, heartbeats, stalled-worker detection, and safe retries.
- [ ] Preserve attempts and prevent duplicate execution from producing duplicate findings or billing totals.
- [ ] Implement idempotent run creation and cancellation.
- [ ] Aggregate partial outcomes when one persona fails and others finish.
- [ ] Persist progress and resume the UI after reload; a worker restart must not erase run history.

**Gate:** A three-persona run completes or reports partial failure accurately. Cancellation and worker crashes do not leave browsers running or runs stuck forever.

### Phase 7 — Real overview paths and persona selection

- [ ] Build paths from persisted steps, preserving each persona's actual order and branches.
- [ ] Do not force every website into Discover / Explore / Sign up / Get started; derive or label stages from the recorded task.
- [ ] Connect persona selection to the correct session and corresponding issues.
- [ ] Populate issue markers from recorded findings; show analysis-pending states before counts exist.
- [ ] Support all-persona overview, selected-persona trace, and issues-only filtering.
- [ ] Open each step's screenshot, action, URL, timestamp, and observation.

**Gate:** Overview paths and issue counts reconcile with database records, including uneven path lengths and failed sessions.

### Phase 8 — Live transmission and captured moments

- [ ] Emit real status and action events from the worker to the persisted event stream.
- [ ] Implement authenticated SSE with cursor-based reconnect, deduplication, and a database refresh fallback.
- [ ] Capture screenshots after meaningful actions and on a capped interval during exploration; start with a proposed 2–5 second refresh budget and measure overhead.
- [ ] Publish an artifact-ready event only after private upload and redaction are complete.
- [ ] Show the selected persona's latest screenshot, current action, last-update time, and connection state.
- [ ] Clearly distinguish Running, Waiting, Disconnected, Reconnecting, Failed, Cancelled, and Completed.
- [ ] Switching personas must switch both feed and capture strip without stale frames from the previous session.
- [ ] Let users open historical captures and return to the latest frame.
- [ ] Separate viewer playback from agent execution: pausing replay must not imply pausing the actual browser agent.
- [ ] A manual capture requests a new worker screenshot or reports unavailability; do not silently return an old frame as new.
- [ ] Use authenticated requests or short-lived artifact links; recover gracefully from link expiry.
- [ ] Provide a readable alternative description for screenshots and status changes.

**Gate:** Two real sessions can be observed independently. Frames are timestamped, refresh within the agreed budget, and remain correctly associated through reconnects and persona switching.

### Phase 9 — Analysis and evidence-backed reports

- [ ] Feed the analyser recorded actions, browser errors, screenshots, and concise observations—not invented path summaries.
- [ ] Define finding categories: functional issue, navigation friction, clarity, accessibility signal, and performance observation.
- [ ] Define severity rubric based on task impact and reproducibility; keep confidence separate from severity.
- [ ] Require each finding to reference real step/artifact IDs. Reject unsupported evidence references.
- [ ] Separate observed facts from inferred explanations and suggestions.
- [ ] Deduplicate related findings across personas while preserving each persona's supporting evidence.
- [ ] Add reproduction steps, expected versus observed behavior, limitations, and concrete recommendations.
- [ ] Provide honest no-findings, incomplete-analysis, and insufficient-evidence states.
- [ ] Add deterministic accessibility checks where appropriate, but never label them a full accessibility certification.
- [ ] Link report findings back to the exact journey step and captured moment.

**Gate:** Each reported issue can be inspected against evidence; known fixture failures are found without claiming unrelated invented bugs.

### Phase 10 — Security, privacy, reliability, and cost review

- [ ] Review tenant isolation across every endpoint and object-storage access path.
- [ ] Redact sensitive inputs, tokens, headers, cookies, logs, and screenshot regions before exposure to models or viewers wherever possible.
- [ ] Prefer staging/test data; block workflows where safe capture cannot be guaranteed.
- [ ] Document screenshot/model-provider data flow and retention before hosted use.
- [ ] Set run/artifact expiry and implement deletion from both database and object storage, accounting for backups and queued jobs.
- [ ] Apply per-user/workspace concurrency limits, API rate limits, and hard cost ceilings.
- [ ] Exercise prompt injection, unsafe navigation, duplicate requests, retry storms, and malicious pages.
- [ ] Add structured logs/metrics for queue delay, browser crashes, model errors, frame latency, artifact failures, and cost.
- [ ] Document incident response and a global stop switch for browser execution.

**Gate:** No critical security blocker remains, cleanup is bounded, and cost controls work under failure conditions.

### Phase 11 — Release validation and staged deployment

- [ ] Unit tests: schemas, state transitions, policies, severity rules, and model-output validation.
- [ ] Integration tests: API → queue → worker → database/storage → events → report.
- [ ] End-to-end tests: sign in, add website, create run, select persona, live view, inspect finding, cancel, reload, and delete.
- [ ] Failure tests: invalid URL, internal address, redirect escape, timeout, blocked access, missing image, model rate limit, worker crash, and expired session.
- [ ] Visual review: compare the production dashboard to Journey Atlas and the supplied homepage palette on desktop and mobile.
- [ ] Accessibility review: keyboard-only journey, focus visibility, dialogs, announcements, contrast, and reduced motion.
- [ ] Evaluate on owned fixtures before limited authorized staging websites; record false positives, missed seeded issues, duration, and cost.
- [ ] Deploy a staging web app and isolated workers with private storage and managed secrets.
- [ ] Verify migrations, backup/restore, health checks, queue recovery, and rollback procedures.
- [ ] Run a small authorized pilot. Expand concurrency only after reliability and cost measurements are acceptable.

**Gate:** A fresh user can finish the complete flow, inspect genuine evidence, and understand failures without developer intervention.

## 7. First engineering session: exact order

1. Resolve Phase 0 decisions and record them below.
2. Scaffold the application, worker, contracts, and local services.
3. Add one run/session schema and create-run API contract.
4. Build an isolated deterministic browser test against the owned fixture.
5. Store one real screenshot and one completed step.
6. Render that screenshot and step in a small production-component view.
7. Only after that works, introduce the model's action-selection loop.

The first vertical slice is **one task, one persona, one browser session, one evidence-backed result**. Do not begin with multi-agent orchestration, streaming video, or automated UI fixes.

## 8. Completion checklist

- [ ] The selected design is preserved, including rounded persona pills and Soft Spectrum color balance.
- [ ] New runs execute real authorized tasks, not the old scripted example.
- [ ] Every persona has an isolated, bounded session.
- [ ] Journey steps, live frames, captures, and report findings refer to the same underlying evidence.
- [ ] Website/run history survives reload and is workspace-private.
- [ ] Failure, cancellation, reconnect, and cleanup paths are tested.
- [ ] Findings communicate uncertainty and do not overclaim human-user or accessibility coverage.
- [ ] Setup, deployment, testing, retention, and operating instructions are documented.
- [ ] The full release gate in Phase 11 is satisfied.

## 9. Decision log

| Decision | Status | Notes |
| --- | --- | --- |
| Visual direction | Confirmed | Journey Atlas 01; homepage Soft Spectrum |
| Overview / selected-persona live view | Confirmed | Keep both floating controls |
| Framework, queue, database, storage | Confirmed | Section 4 defaults: Next.js + TS web app, Node/Playwright worker, PostgreSQL, DB-backed durable queue, local storage for artifacts in dev (object storage later) |
| Model provider and model | Confirmed | Claude (Anthropic) via the Claude API, tool use for action selection |
| Authentication provider | Confirmed | Managed auth service (Clerk/Auth.js), server-side workspace authorization |
| Workspace model (Phase 3) | Confirmed | One personal workspace per Clerk user, auto-created on first sign-in; `userId` is the workspace identifier (`workspaces.clerk_user_id`). No multi-user/organization concept — reverted from an earlier Clerk-Organizations-as-workspaces design (which required an in-app org creation/switcher flow) per explicit user request to drop organizations entirely. See [PHASE_3_PLAN.md](./PHASE_3_PLAN.md) section 2. |
| First task and authorized-site policy | Confirmed | First task: discover and compare a product's public plans. Authorization: owned fixtures only for first release, no real external site scanning yet |
| Session limits and cost caps | Confirmed | Per persona session: max 20 actions, 3 min wall-clock, 1 browser context, no downloads/uploads. Per run: hard cost cap ~$0.50 (tokens + browser compute), force-terminate and mark failed on breach |
| Artifact retention / deletion policy | Confirmed | Screenshots/artifacts retained 7 days, then deleted from storage and DB |
| Live screenshot cadence | Proposed | 2–5 seconds, action-triggered captures, measured under load |
| Hosting / deployment target | Confirmed | Local-only for Phase 1 (docker-compose); hosting target (Vercel + separate worker host) decided later before Phase 11 staged deployment |

## 10. Session handoff

- Current phase: Phase 0.
- Completed: inspected the local prototypes and inspiration structure; wrote this plan.
- Implementation completed: none.
- Current blocker: none for planning; stack/provider and safety-policy decisions precede implementation.
- Next concrete task: resolve Phase 0 decisions, then scaffold Phase 1.
- Latest checks: planning document only; no production application tests exist in this repository yet.

### 2026-09-12 — Phase 0 resolved

- Tasks checked off: all Phase 0 checklist items (first task type, authorization policy, stack, model provider, auth provider, hosting, session limits, cost cap, retention).
- Changed areas: decision log (section 9) updated from Pending to Confirmed for framework/queue/db/storage, model provider, auth provider, first task/authorization policy, session limits/cost caps, retention policy, and hosting target.
- Decisions recorded: first task = public plan comparison; authorization = owned fixtures only for first release; stack = plan's proposed defaults (Next.js/TS web, Node/Playwright worker, PostgreSQL, DB-backed queue, local storage for dev artifacts); model provider = Claude (Anthropic); auth = managed service (Clerk/Auth.js); hosting = local-only via docker-compose for Phase 1, real hosting target deferred to before Phase 11; session limits = max 20 actions / 3 min wall-clock / 1 browser context / no downloads-uploads per persona session; cost cap = ~$0.50/run hard cap, force-terminate on breach; retention = 7 days for screenshots/artifacts.
- Checks actually run: none (planning/decision update only).
- Failures/limitations: live screenshot cadence remains "Proposed" (2–5s), not yet confirmed under load — revisit in Phase 8.
- Next concrete task: begin Phase 1 — scaffold the source layout, dependency lockfile, local docker-compose services (Postgres, queue), health checks, and shared schemas per section 4/6.

### 2026-09-12 — Phase 1 scaffolded

- Tasks checked off (Phase 1 checklist): source layout created (`apps/web`, `apps/worker`, `packages/contracts`, `packages/db`, `packages/agent`, `packages/ui`, `tests/fixtures/site`, `tests/integration`, `tests/e2e`, `docs/`); npm workspaces + lockfile; formatting (Prettier), linting (ESLint flat config), type checking (tsc per workspace), and `docs/DEVELOPMENT.md` as the root dev guide; `.env.example` with variable names/descriptions only; local Postgres via `docker-compose.yml`; health checks for both the web process (`/api/health`) and worker (`/health` on a plain `node:http` server); shared request/response/event schemas and structured error codes in `@nori/contracts`; CI workflow (`.github/workflows/ci.yml`) running typecheck/lint/build on push/PR.
- Changed areas: entire repo root restructured into the monorepo layout from section 4. The old prototype (`index.html`, `app.js`, `styles.css`, `assets/`, `README.md`) was moved to `prototype/` and preserved unchanged as the frozen Phase 2 design reference, per the Phase 2 gate. `packages/db` includes a durable, DB-backed job queue table (`jobs`, with lease/heartbeat columns) ahead of Phase 6, since the plan requires a maintained DB-backed queue rather than inventing an in-memory one later.
- Checks actually run: `npm install` (clean), `npm run typecheck` (all 6 workspaces pass), `npm run lint` (clean, no warnings), `npm run build` (apps/web builds via `next build`, apps/worker via `tsc`, both succeed). Worker skeleton manually smoke-tested: started via `node --experimental-strip-types apps/worker/src/main.ts`, `GET /health` returned `{"status":"ok"}`, SIGTERM produced a graceful shutdown log and clean exit. Did not run `docker compose up` or `npm run db:migrate` — not required for this phase, no live Postgres needed yet.
- Failures/limitations: `apps/worker` has no job-processing loop yet (intentionally deferred — marked with `TODO(Phase 4/5/6)` in `src/main.ts` pointing at `packages/db`'s `jobs` table). `packages/agent` and `packages/ui` are empty placeholders with comments only, per Phase 2/5 scope. `apps/web` is a placeholder page, not the ported Journey Atlas UI. Live screenshot cadence (2–5s) still unconfirmed under load — carried over from Phase 0, revisit in Phase 8.
- Next concrete task: begin Phase 2 — extract Soft Spectrum design tokens (colors, gradients, radii, spacing, shadows, motion) from `prototype/styles.css` into `packages/ui`, then build the first real components (AppShell, Sidebar, PersonaShelf, etc.) as stateful React components in `apps/web`, replacing the placeholder page. Do not begin backend/agent work (Phase 3+) in the same pass, per the plan's own rule against mixing design migration with agent-system work.

### 2026-09-12 — Phase 2 complete, Phase 3 complete

Phase 2 (Journey Atlas ported into real React components, design tokens extracted, fixture data shaped to `@nori/contracts`) was completed and logged in full in [PHASE_2_PLAN.md](./PHASE_2_PLAN.md)'s own session log across several work sessions — not duplicated here.

- Tasks checked off: every Phase 3 checklist item satisfying the phase's literal gate (websites persist across reloads; cross-workspace access rejected server-side) — see the checklist above and [PHASE_3_PLAN.md](./PHASE_3_PLAN.md) section 6 for the full breakdown of what's done vs. explicitly deferred (run/event/artifact data staying fixture-backed, website detail-view page and authorization-status UI deferred).
- Changed areas: Clerk + Clerk Organizations wired up as Nori's workspace concept; `packages/db` query/repository layer built from scratch (workspaces, websites, shared row-mapping helper) and verified against real local Postgres; website CRUD API routes; `websites/page.tsx` converted to a Server Component with a real "add website" flow; sidebar/workspace context now carries real website data instead of fixtures; a committed automated cross-workspace isolation test. Full detail, including two real pre-existing/newly-introduced bugs found and fixed along the way (the migration script's Node runner, and Next's webpack not resolving this repo's `.js`-suffixed imports for two packages touched by server code for the first time), is in [PHASE_3_PLAN.md](./PHASE_3_PLAN.md)'s session log.
- Checks actually run: `npm run typecheck`/`lint`/`build` all pass; `npm run test:integration` passes against real Postgres and was verified to actually catch a deliberately-introduced isolation regression.
- Failures/limitations: real Clerk sign-in (and therefore true browser click-testing of the create-website flow) cannot be exercised without the user's own Clerk API keys — documented, not silently glossed over. Home/runs pages still show fixture data unrelated to whichever real website is selected, by design for this phase's scope.
- Next concrete task: Phase 4 — safe deterministic browser execution. Its own explicit gate: build this before letting a model control arbitrary navigation. Real Clerk credential setup (`npx clerk@latest init` or manual) is a good parallel follow-up, not a blocker for Phase 4 itself.

For later sessions, append: date, tasks checked off, changed areas, checks actually run, failures/limitations, and the next single task.
