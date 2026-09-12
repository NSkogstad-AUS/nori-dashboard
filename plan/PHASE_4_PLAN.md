# Phase 4 Plan — Safe deterministic browser execution

Created: 12 September 2026
Status: Complete. Acceptance gate passed locally on 12 September 2026.
Parent: [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md), Phase 4 checklist.

This document is the detailed working plan for Phase 4. Treat this file the same way the master
plan and [PHASE_2_PLAN.md](./PHASE_2_PLAN.md)/[PHASE_3_PLAN.md](./PHASE_3_PLAN.md) treat
themselves: a checklist to work through in order — check items off as they're completed, and
append session notes at the bottom.

## 1. Purpose and scope

Phase 3 (complete) wired up real auth and real website tracking, but nothing in Nori actually
drives a browser yet. Phase 4 is the master plan's explicit gate before Phase 5 lets a model
choose what a browser does next: **"Implement this before letting a model control arbitrary
navigation."** This phase proves Nori can safely launch an isolated browser, restrict where it's
allowed to go (rejecting internal/private targets, not just the sites Nori intends), run a fixed
deterministic sequence of actions against an owned fixture site, and record real steps and
screenshot artifacts to the database — all without any model involved yet.

**In scope:**

- An owned fixture website (`tests/fixtures/site/`) with a clear success path, broken links, a
  confusing CTA, a keyboard-focus issue, and a delayed/error page.
- A safe-navigation policy module in `packages/agent` — DNS-resolution-based private-IP/loopback/
  metadata-endpoint blocking, scheme/credential/port checks, redirect re-validation, and the same
  checks applied to subresources/popups/WebSockets/downloads.
- A real Playwright browser job running in `apps/worker`, replacing its Phase 1 health-check
  skeleton with an actual job-claim loop against the existing `jobs` table.
- A DB query layer for `personas`, `runs`, `persona_sessions`, `steps`, `artifacts`, and `jobs` —
  none of which have any query code yet, only migrations.
- Local-filesystem artifact storage (`artifacts-storage/`, gitignored) — a real object store
  is a deliberately deferred decision, not this phase's problem.
- Resource limits (`maxActionsPerSession`, `maxSessionSeconds`) enforced for real, with clean
  browser-context teardown on success, error, timeout, or cancellation.
- Security tests proving blocked targets are actually rejected, plus an end-to-end happy-path test
  against the real fixture site.
- CI updated to install Chromium and run the new test suites.

**Explicitly out of scope for this phase:**

- Any model/persona-agent decision-making (Phase 5) — this phase's browser script is a **fixed,
  hand-written sequence** (navigate → capture → click → capture → finish), not model-chosen
  actions. `packages/agent`'s model/prompt/tool-use code still waits for Phase 5; only the
  navigation-safety policy module is built now (see the decision log below for why it lives here).
- Real run-creation UI/API (still not built — Phase 3 explicitly deferred this). This phase
  triggers its one fixture job via a CLI script, not through `apps/web`.
- Durable multi-persona job orchestration, leases-under-contention, retries-after-worker-crash
  (Phase 6) — this phase uses the `jobs` table's columns as designed, but only ever runs one job
  at a time by hand; Phase 6 is what makes the claim loop robust under real concurrency.
- Findings generation, live SSE, real persona authoring (Phase 5/7/8/9).
- Any production deployment target decision for `apps/worker` (no Dockerfile exists yet, and
  deciding one is out of scope here — CI gets Chromium regardless of where the worker eventually
  runs in production).

## 2. Confirmed decisions (this session)

| Decision                        | Resolution                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase scope                     | Full phase per the master plan's checklist — not a minimal "one screenshot" slice. Triggered by investigating a website-preview iframe question that turned out to need no code change (see the "No changes needed" note below), but the user then asked to start Phase 4 properly on its own terms.                                                     |
| Job model                       | Reuse `runs`/`persona_sessions`/`jobs` exactly as designed (NOT NULL `run_id`/`session_id` FKs on `jobs`), not a new generic job table. This phase seeds one real fixture `run` + `persona_session` (using a placeholder/system persona) and drives it through the existing `jobs` table the same way Phase 6 will later do for real multi-persona runs. |
| Artifact storage                | Local filesystem under `artifacts-storage/` (gitignored and configurable with `ARTIFACT_STORAGE_DIR`). `artifacts.storage_key` = a relative path. Real object-store (S3/R2/etc.) swap is an explicit future decision once deployment is chosen.                                                                                                          |
| Fixture site hosting            | A small static Express/Node server in `tests/fixtures/site/` (its own port, separate from `apps/web`'s 3000 and `apps/worker`'s 8081), matching that directory's existing placeholder README.                                                                                                                                                            |
| Safe-navigation module location | `packages/agent`. Matches the master plan's own section 5 ("Contracts") naming — that package is earmarked for "the bounded action policy." Its Phase 1 placeholder comment ("intentionally empty until Phase 5") is updated to reflect that navigation-safety policy starts now in Phase 4; model/prompt/tool-use logic still waits for Phase 5.        |

**Why a fixed script, not a model, drives the browser this phase:** the master plan's Phase 4 gate
exists specifically so unrestricted model-driven navigation never touches a browser that hasn't
already proven it can say no to unsafe targets. Writing the safety policy against a predictable,
hand-authored action sequence means the security tests in section 6 below are testing the policy
itself, not accidentally passing because a model happened to behave — Phase 5 then plugs a real
decision-maker into infrastructure already proven safe, rather than building both at once.

## 3. Current-state findings (verified this session by reading the actual files)

- **`apps/worker/src/main.ts`** is a genuine Phase 1 skeleton: a bare `node:http` server with only
  `GET /health`, graceful SIGTERM/SIGINT shutdown, and nothing else. Its own `TODO(Phase 4/5/6)`
  comment already names Playwright and already assumes the job-claim unit is a persona session —
  this phase isn't inventing new architecture, it's implementing already-stated intent.
  `apps/worker/package.json` has zero browser-automation dependency (`playwright`/`puppeteer`/
  `chromium` all absent — confirmed via repo-wide grep).
- **The `jobs` table** (`packages/db/src/migrations/002_queue.sql`) is fully shaped for the
  claim-loop this phase needs: `status` enum (`pending/leased/completed/failed/cancelled`),
  `attempt`/`max_attempts`, `available_at`, `leased_by`/`leased_until`, `last_heartbeat_at`,
  `last_error`, and `jobs_claimable_idx` on `(status, available_at) where status = 'pending'` —
  built for a `select ... for update skip locked` claim. `run_id`/`session_id` are both NOT NULL
  FKs (one job per persona session, by design — matches the confirmed job model above).
- **The run/session/step/artifact data model already exists**, in both
  `packages/contracts/src/entities.ts` and `packages/db/src/migrations/001_init.sql`, already
  shaped for this phase:
  - `runSchema.allowedOrigins` and `runSchema.limits` already provide the origin allowlist and
    limits (`maxActionsPerSession`, `maxSessionSeconds`, `hardCostCapUsd`) this phase enforces.
  - `stepSchema.action` (`navigate|click|scroll|type|wait|capture|finish`) and `.outcome`
    (`success|error|blocked`), plus `urlBefore`/`urlAfter`/`observation` — the deterministic
    sequence log this phase's checklist item describes.
  - `artifactSchema` (`sessionId`, `stepId` nullable, `storageKey`, `contentType`, `width`,
    `height`, `redacted`, `expiresAt`) — the screenshot-artifact record. `storageKey` is an opaque
    text column with no scheme defined anywhere yet; this phase defines one (a local file path).
  - `errorCodeSchema` (`packages/contracts/src/api.ts`) already includes `'unsafe_target'` and
    `'cost_cap_exceeded'` — anticipated for this phase, unused until now.
  - `packages/contracts/src/state-machines.ts` already has `RUN_TRANSITIONS`/
    `SESSION_TRANSITIONS`/`isValidRunTransition`/`isValidSessionTransition`/
    `deriveRunOutcomeFromSessions` — reuse these for every state change; don't hand-roll new ones.
- **No queries exist yet** for `runs`, `persona_sessions`, `steps`, `artifacts`, `jobs`, or
  `personas` — `packages/db/src/queries/` currently only has `workspaces.ts` and `websites.ts`.
  This phase writes the query layer for everything it touches.
- **`tests/fixtures/site/README.md`** and **`tests/integration/README.md`** already name this
  phase as their intended starting point. `tests/e2e/README.md` is explicitly Phase 11 — untouched
  here.
- **No Dockerfile exists anywhere in the repo**, and `.github/workflows/ci.yml` has no browser-
  install step yet — this phase adds `playwright install --with-deps chromium` to CI.
- **`POST /api/websites` is fully synchronous today**, no job dispatch of any kind — this phase
  does not touch the websites UI/API; the fixture job is triggered independently via a CLI script.
- **`packages/agent/src/index.ts`** is currently 8 lines: `export {};` plus a comment reserving it
  for Phase 5's model adapter/persona prompts/bounded action policy. This phase adds real code
  here for the first time (the navigation-safety half of "bounded action policy" only).

## 4. Implementation steps

### 4.1 Fixture site (`tests/fixtures/site/`)

Express (or plain `node:http`) server, TypeScript, run via `tsx`, own port (`8082`, separate from
`apps/web`'s 3000 and `apps/worker`'s 8081). Pages, matching the master plan's checklist verbatim:

- `/` — a clear success path: a short task completable in a couple of clicks (e.g. a minimal
  "subscribe" or "add to cart" flow) that the fixture job's fixed script will actually complete.
- `/broken-links` — links pointing at routes that 404 or don't exist.
- `/confusing-cta` — a button whose label doesn't match what it actually does.
- `/focus-trap` — an interactive element with a keyboard-focus issue (not reachable by Tab, or a
  trap that can't be escaped).
- `/slow` — an artificially delayed response; `/error` — a deliberate 500.

Needs its own `package.json` + `dev`/`start` scripts, and a root-level way to run it alongside the
worker for local testing and CI.

### 4.2 Query layer (`packages/db/src/queries/`)

New files, following `websites.ts`'s established pattern (workspace-scoped where applicable,
`rowToCamelCase` reuse, no ad hoc mapping):

- `personas.ts` — `getPersonaById` + a seed helper for one placeholder "system" persona (real
  persona authoring is Phase 5's job; this phase just needs a valid `personas` row to satisfy
  `persona_sessions.persona_id`).
- `runs.ts` — `createRun`, `getRunById`, `updateRunState` (validated through
  `isValidRunTransition`; throws on an invalid transition rather than writing it).
- `persona-sessions.ts` — `createPersonaSession`, `updateSessionState` (via
  `isValidSessionTransition`), `touchHeartbeat`.
- `steps.ts` — `appendStep` (assigns the next `sequence` per session).
- `artifacts.ts` — `createArtifact` (records the local file path as `storageKey`).
- `jobs.ts` — `enqueueJob(runId, sessionId)`, `claimNextJob(workerId)` (using
  `select ... for update skip locked` via `jobs_claimable_idx`), `heartbeatJob`, `completeJob`,
  `failJob`.
- `packages/db/src/index.ts` — export all of the above.

### 4.3 Safe-navigation policy module (`packages/agent/src/safe-navigation.ts` or similar)

The security-critical core of this phase — a standalone, directly-testable module, not logic
scattered inline in the worker loop:

- Resolve DNS for a candidate URL's hostname; reject loopback, private/link-local addresses
  (RFC 1918 IPv4 ranges, link-local IPv6), and cloud metadata endpoints (`169.254.169.254` and
  equivalents) — checked against the **resolved IP**, not the hostname string, to prevent
  DNS-rebinding bypasses.
- Reject non-`http(s)` schemes, credentials embedded in the URL (`user:pass@host`), and ports
  outside an explicit allowlist.
- Check the candidate URL's origin against the run's `allowedOrigins`.
- Re-validate on every redirect hop, not just the initial navigation (a redirect chain ending in a
  blocked target must be caught).
- Apply the same checks to subresource requests, popups, and WebSocket connections the page opens
  (Playwright route interception), and block uncontrolled file downloads.
- Return a structured `{allowed: boolean, reason?: string}` result, so a denial becomes a `step`
  row with `outcome: 'blocked'`, surfaced via the existing `unsafe_target` error code.
- Update `packages/agent/src/index.ts`'s placeholder comment: navigation-safety policy starts in
  Phase 4; model/prompt/tool-use logic still waits for Phase 5 — export the new module from here.

### 4.4 Browser execution (`apps/worker`)

- Add `playwright` (full package, not `-core`) as a real dependency.
- Replace `main.ts`'s TODO with an actual job-claim loop: poll `jobs` via `claimNextJob`, load the
  associated `run`/`persona_session`, launch an isolated `browser.newContext()` per session (fresh
  state, nothing shared between sessions), heartbeat periodically while running.
- Run a fixed, hand-written script against the fixture site: navigate → capture → click a known
  element → capture → finish. One `step` row per action (`urlBefore`/`urlAfter`/`outcome`), one
  `artifact` row per capture (`artifacts-storage/<sessionId>/<stepId>.png`, `storageKey` =
  that relative path). Every navigation (including redirects, subresources, popups) is checked
  through 4.3's policy module before Playwright is allowed to follow it.
- Enforce `maxActionsPerSession`/`maxSessionSeconds` for real — abort and mark the session
  `failed` with a clear reason if exceeded, never silently truncate.
- Close the browser context and clean up on success, error, timeout, or cancellation
  (`cancel_request_state`) — verify no leaked Chromium processes afterward.
- Root `.gitignore` — ignore `artifacts-storage/`.

### 4.5 Trigger mechanism

No UI hookup this phase (no real run-creation UI exists yet — Phase 3 explicitly deferred it). A
CLI script (`apps/worker/src/run-fixture-job.ts`, via an `npm run worker:seed-fixture-run`-style
script) that: ensures the placeholder persona exists, creates a `website` row pointing at the
local fixture site, creates a `run` + `persona_session` + `jobs` row, then the worker's normal
job-claim loop (already running, or invoked one-shot) picks it up and executes it.

### 4.6 Security tests

`tests/integration/safe-navigation.test.ts` (Node's built-in test runner, matching
`workspace-isolation.test.ts`'s pattern) — unit-level tests against 4.3's policy module directly
(no real browser needed for most cases): reject `http://127.0.0.1`, `http://169.254.169.254`,
`http://[::1]`, private ranges (`10.x`, `172.16-31.x`, `192.168.x`), `file://`/`javascript:`
schemes, credentials-in-URL, and a redirect chain ending in a blocked target — plus confirm the
fixture site's own local origin is correctly allowed. This is the phase's literal gate line:
"Security tests demonstrate blocked internal/private targets before accepting user-submitted
URLs."

`tests/integration/fixture-run.test.ts` (or similar) — a real end-to-end happy-path test: run the
fixture job, assert the `run` reaches a terminal state via the real transition functions, `steps`
were recorded in the correct order with correct outcomes, `artifacts` exist as real files at their
`storageKey` paths and are valid PNGs with the expected dimensions.

### 4.7 CI

Add `playwright install --with-deps chromium` to `.github/workflows/ci.yml` (after `npm ci`,
before the test steps). Start the fixture site as a background step before `test:integration`
runs (or have the test suite spin it up/down itself via `before`/`after` hooks, matching
`workspace-isolation.test.ts`'s `after(() => getDb().end())` cleanup pattern — decide during
implementation based on what's cleanest).

## 5. Acceptance gate

Restated from the master plan: **"A real browser completes the fixture task and produces
inspectable artifacts. Security tests demonstrate blocked internal/private targets before
accepting user-submitted URLs."** Concretely, checkable:

- The fixture job's fixed script runs a real Chromium browser (not mocked) against
  `tests/fixtures/site/`, completes its full navigate/click/capture sequence, and the `run`/
  `persona_session` reach a terminal state (`completed`) via the real state-machine functions.
- Real `steps` rows exist in Postgres in the correct sequence, with correct `outcome`s.
- Real `artifacts` rows exist with real screenshot files at their `storageKey` paths, valid PNGs.
- `tests/integration/safe-navigation.test.ts` passes and demonstrably rejects every documented
  unsafe-target category — verified by deliberately breaking the policy module, confirming the
  test fails with a clear diff, then confirming the fix restores a clean pass (same discipline as
  Phase 3's cross-workspace isolation test).
- No leaked Chromium processes after a normal run, a timeout, or a cancellation.
- `npm run typecheck`/`lint`/`build` pass at the repo root; CI is green with the new Chromium
  install step.

## 6. Session notes

### 2026-09-12 — Preceding investigation: "No changes needed" (website preview)

Before Phase 4 was scoped, the user shared a screenshot of the Journeys page's live website-URL
preview showing "This site can't be embedded in a preview" for `au.pinterest.com`, asking if this
was expected. Investigation found this is the correct, already-implemented fallback in
`WebsitePreview` (`apps/web/src/app/journeys/journeys-client.tsx` ~lines 168-220) for sites that
send `X-Frame-Options`/CSP headers blocking iframe embedding — a real, un-bypassable browser
security restriction, not a bug. A server-side-screenshot fix was considered and rejected: that
preview updates on every debounced keystroke before a URL is even submitted, so a multi-second
Playwright round-trip would make the live-typing UX worse, not better. No code changed. This did,
however, directly prompt the user to ask to start Phase 4 properly on its own terms (rather than
backing into it via that UI polish item) — which is this document.

### 2026-09-12 (continued) — Phase 4 planning

This document written and confirmed decisions recorded above. Implementation has not started as
of this note — see the master plan's Phase 4 checklist for live status once work begins.

### 2026-09-12 (continued) — Phase 4 complete

Implemented the owned fixture site, complete DB query layer, strict navigation policy, real
Playwright worker and job loop, CLI fixture seed, local screenshot artifacts, cancellation and
heartbeat persistence, and CI Chromium setup. The browser pins validated DNS answers, inspects
redirects before following them, checks all routed requests and WebSockets, blocks downloads, and
refuses the fixed action script unless fixture mode is explicit.

The acceptance run passed with 35 integration checks: a real claimed database job completed the
five-action script in Chromium, wrote five ordered step rows and two valid 1280×800 PNG artifacts,
and reached completed run/session states. Security coverage includes schemes, URL credentials,
origins, ports, IPv4/IPv6 private and reserved ranges, metadata endpoints, redirect chains,
changing DNS answers, WebSockets, and a browser-level unsafe redirect. Lifecycle coverage proves
browser release after success, action limit, wall-clock timeout, cancellation during a stalled
response, unsafe navigation, and the disabled-fixture gate. Root typecheck, lint, and production
build pass. CI now installs Chromium before running the same integration suite.

Hard host CPU and memory quotas remain part of the eventual worker deployment choice, which this
phase explicitly leaves out of scope. The in-process executor caps action count and wall time,
uses one fresh context, limits renderer processes, and caps the renderer JavaScript heap.
