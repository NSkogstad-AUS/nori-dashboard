# Development setup

Phase 1 scaffold. This covers what actually exists today — no auth, no real job
processing, no UI beyond a placeholder page.

## Prerequisites

- Node.js 22+
- Docker (for local Postgres via docker-compose)

## First-time setup

```bash
cp .env.example .env
# fill in DATABASE_URL etc. in .env — see .env.example for descriptions of each variable

docker compose up -d   # starts Postgres (user/pass/db: nori/nori/nori)

npm install             # installs all workspaces

npm run db:migrate      # applies packages/db migrations
```

## Running the app

In separate terminals:

```bash
npm run dev:web     # apps/web — Next.js dashboard, http://localhost:3000
npm run dev:worker  # apps/worker — worker process skeleton, no job processing yet
```

## Health checks

- Web: http://localhost:3000/api/health → `{ "status": "ok" }`
- Worker: http://localhost:8081/health → `{ "status": "ok" }`

## Other scripts (root)

```bash
npm run typecheck   # tsc --noEmit across all workspaces
npm run lint        # eslint across the repo
npm run build       # build all workspaces (apps/web via next build; others via tsc)
npm run format      # prettier --write .
npm run format:check
```

## What's not here yet

- No authentication (Phase 3).
- No real design system — `apps/web` is a placeholder page (Phase 2 ports Journey Atlas).
- `apps/worker` starts and reports healthy but does not claim or process any jobs
  (Phase 4/5/6).
- No tests exist yet (`tests/` has placeholder READMEs only; Phase 4+ populates them).
