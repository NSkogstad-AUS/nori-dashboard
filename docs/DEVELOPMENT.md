# Development setup

## Prerequisites

- Node.js 22+
- A local Postgres — either your machine's own install, or Docker (for docker-compose Postgres)

## First-time setup

```bash
npm run setup
```

This installs dependencies, creates `.env` from `.env.example` if it doesn't exist yet, sets up
a local `nori`/`nori` Postgres role and database, and runs migrations. It's idempotent — safe to
re-run any time.

By default it uses a Postgres server already running natively on your machine (port 5432). If
you'd rather use docker-compose's isolated Postgres instead, run `npm run setup -- --docker` —
but note that if you _also_ have a native Postgres bound to port 5432, connections will silently
go to that instead of the container (this was hit and diagnosed during Phase 3 — see
`plan/PHASE_3_PLAN.md`'s session log). Stop the native instance first, or edit `DATABASE_URL` in
`.env` to a different port, if you need both.

The script stops short of one step it can't automate: Clerk needs real API keys before the app
renders past a 500 error. Run `npx clerk@latest init` (non-interactive, no existing Clerk account
needed) — it writes `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` into `.env` for you.

## Running the app

In separate terminals:

```bash
npm run dev:web     # apps/web — Next.js dashboard, http://localhost:3000
npm run dev:worker  # apps/worker — health endpoint plus the database job-claim loop
```

To exercise the Phase 4 deterministic browser job locally, install Chromium once and use three
terminals. Fixture mode is explicit because it permits the worker to reach the owned local site;
the worker rejects deterministic jobs when the flag is absent.

```bash
npx playwright install chromium
npm run dev:fixture-site
npm run seed-fixture-run --workspace=apps/worker
WORKER_FIXTURE_MODE=true npm run dev:worker
```

## Health checks

- Web: http://localhost:3000/api/health → `{ "status": "ok" }`
- Worker: http://localhost:8081/health → `{ "status": "ok" }`

## Other scripts (root)

```bash
npm run typecheck        # tsc --noEmit across all workspaces
npm run lint              # eslint across the repo
npm run build             # build all workspaces (apps/web via next build; others via tsc)
npm run test               # runs each workspace's own tests, then the integration suite
npm run test:integration   # tests/integration/*.test.ts against real Postgres (needs DATABASE_URL)
npm run format             # prettier --write .
npm run format:check
```

## What's not here yet

- Model-selected browser actions are not enabled yet. The worker only runs Phase 4's fixed
  navigate → capture → click → capture → finish sequence against an explicitly enabled fixture.
- Website ownership/authorization status isn't surfaced in the UI yet, and there's no website
  detail-view page (API route exists, no page).
- Runs, journey steps, and findings are still fixture/demo data, not backed by the database —
  only websites (Phase 3's scope) are real. This means the Runs and Journeys pages don't reflect
  whichever real website is selected.
- `tests/e2e` remains reserved for Phase 11. The Phase 4 fixture and integration suites are real
  and self-start the fixture server during `npm run test:integration`.

The web development server writes to `apps/web/.next-dev`; production builds use
`apps/web/.next`. These directories stay separate so running a build does not
remove JavaScript assets from an active development session.
