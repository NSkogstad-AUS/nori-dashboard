# Phase 3 Plan — Identity, database, and website tracking

Created: 12 September 2026
Status: Planning only. No Phase 3 implementation has started.
Parent: [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md), Phase 3 checklist.

This document is the detailed working plan for Phase 3. Treat this file the same way the master
plan and [PHASE_2_PLAN.md](./PHASE_2_PLAN.md) treat themselves: a checklist to work through in
order — check items off as they're completed, and append session notes at the bottom.

## 1. Purpose and scope

Phase 2 (complete) ported the Journey Atlas prototype into real React components, but every piece
of data — personas, websites, runs, findings — is static fixture data in `apps/web/src/fixtures/`.
Phase 3 wires up real authentication, a real Postgres database, and real website tracking so the
app stops being a static demo and starts being a real multi-tenant product. This is the first
phase where data genuinely persists and cross-tenant access is actually enforced, not just
modeled in a schema.

**In scope:**
- Authentication via Clerk, using **Clerk Organizations** as Nori's workspace concept.
- A DB query/repository layer in `packages/db` for workspaces and websites.
- API routes and a Server Component conversion for website creation/listing.
- A cross-workspace isolation test proving one org can never read another org's data.
- Fixing a schema drift between `packages/contracts` and the Postgres migration.

**Explicitly out of scope for this phase:**
- Real run creation/execution (Phase 4/5/6) — `runs/page.tsx` may keep reading fixture runs, or
  show an honest pending/empty state, but building a full run-creation-and-tracking pipeline here
  would be overbuilding ahead of the phases that actually need it.
- Persona data moving off fixtures — personas stay fixture-backed; Phase 5 owns the real
  persona/agent system.
- Any browser automation, safe-navigation sandboxing, or worker job processing (Phase 4/6).
- Live SSE, findings generation, or anything from Phase 7 onward.

## 2. Confirmed decisions (Phase 0 decision log + this session)

| Decision | Resolution |
| --- | --- |
| Auth provider | Clerk (confirmed Phase 0) |
| Workspace model | **Clerk Organizations** = Nori workspaces. `orgId` is the workspace identifier; Clerk owns membership/invite/role UI and logic. Nori's `workspaces`/`memberships` tables become a thin sync target keyed by `orgId`, not the primary source of truth for membership. |
| Local environment | Real Postgres via the existing `docker-compose.yml` (already scaffolded in Phase 1). Clerk itself is wired up correctly in code, but real sign-in requires the user's own Clerk app + API keys after this session — cannot be created or verified end-to-end here. |
| Fixture transition | Websites fully replace fixture reads with real DB-backed data (the literal Phase 3 gate). Runs stay fixture-backed for now (see scope above). Personas stay fixture-backed. |
| Schema drift | `packages/contracts`'s `runSchema` is missing `cancelRequestState`, even though `001_init.sql`'s `runs` table has a `cancel_request_state` column. Fixed as part of this phase, before building the API layer on top of it. |

**Why Clerk Organizations over hand-rolled workspaces:** Nori's `workspaces`/`memberships` tables
(migrated in Phase 1) map almost directly onto Clerk's org/membership model. Using Clerk
Organizations means invite flows, role management, and the org-switcher UI come for free instead
of being hand-built and maintained — the standard pattern for this shape of B2B multi-tenant app.

## 3. Current-state findings (verified this session)

- **`apps/web/src/app/websites/page.tsx`, `runs/page.tsx`, `page.tsx` (home) are all Client
  Components** (`'use client'`), reading fixture arrays directly and depending on
  `useWorkspace()` client context for the selected website. Only
  `apps/web/src/app/layout.tsx` is currently a Server Component.
- **`workspace-context.tsx`** only tracks `selectedWebsiteId` (seeded from `websites[0]?.id` at
  module load, no persistence across reloads) and sidebar `collapsed` state. There is no
  workspace-switching concept anywhere yet — every fixture website implicitly shares one
  workspace id.
- **`packages/db` has zero query/repository layer** — only `client.ts` (`getDb()` singleton),
  `migrate.ts`, and `index.ts`. No `findWebsitesByOrg`, no `createWebsite`, nothing exists yet;
  this phase writes that layer from scratch.
- **Zod (camelCase) ↔ Postgres (snake_case) mapping is systematic** (`workspaceId` ↔
  `workspace_id`, `displayName` ↔ `display_name`, etc.) but no transform helper exists yet.
- **`apps/web` does not depend on `@nori/db` yet** — needs adding as a workspace dependency.
- Next 15.1 / React 19 are already installed — current enough for `@clerk/nextjs`'s App Router
  integration and the async `auth()` API; no version bump needed.

## 4. Implementation steps

### 4.1 Fix the schema drift
Add a `cancelRequestStateSchema = z.enum(['none', 'cancel_requested', 'cancelled'])` to
`packages/contracts/src/entities.ts` (matching `001_init.sql`'s `cancel_request_state` enum) and
wire `cancelRequestState: cancelRequestStateSchema` into `runSchema`, mirroring how
`runStateSchema` is already derived from `RUN_STATES` in `state-machines.ts`.

### 4.2 Wire up Clerk with Organizations as workspaces
- Add `@clerk/nextjs` to `apps/web/package.json`.
- Add `apps/web/middleware.ts` exporting `clerkMiddleware()` with `createRouteMatcher` protecting
  authenticated routes (the health check endpoint stays public).
- Wrap `ClerkProvider` around the root layout in `apps/web/src/app/layout.tsx` — outermost, above
  `WorkspaceProvider`.
- Add an org switcher to the shell (Clerk's `<OrganizationSwitcher>`, or a custom-styled
  equivalent wired to `useOrganization()`/`useOrganizationList()`) in `packages/ui`'s `Sidebar` or
  `PageHeader` — workspace (org) and website (a row scoped to that org) are now two distinct
  levels, where today only "website" exists as a concept.
- Update `.env.example`'s `AUTH_PROVIDER`/`CLERK_*` comments to reflect Organizations usage; add
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` if not already implied by the existing vars.

### 4.3 Build the DB query/repository layer
- `packages/db/src/queries/workspaces.ts` — `ensureWorkspace(orgId, name)`: upsert-on-first-access
  since Clerk orgs are created outside Nori's control; Nori just needs a matching `workspaces` row
  linked to the Clerk `orgId`.
- `packages/db/src/queries/websites.ts` — `listWebsitesForWorkspace(workspaceId)`,
  `createWebsite(workspaceId, input)`, `getWebsiteById(workspaceId, id)`. Every query takes
  `workspaceId` as a required parameter and scopes its `WHERE` clause on it — never trust a bare
  id from the client without the workspace check.
- One shared camelCase⇄snake_case row-mapping helper (generic, reused by every query function)
  since `postgres.js` returns raw snake_case rows and there's no existing transform utility.

### 4.4 API routes for website CRUD
- `apps/web/src/app/api/websites/route.ts` — `GET` (list for the current org), `POST` (create).
- `apps/web/src/app/api/websites/[id]/route.ts` — `GET` (detail).
- Each handler calls `auth()` for `orgId`, calls `ensureWorkspace`, then the scoped
  `packages/db` query functions. Structured errors reuse `packages/contracts/src/api.ts`'s
  existing `errorCodeSchema`/`apiErrorSchema` rather than inventing new ones.

### 4.5 Convert `websites/page.tsx` to a Server Component
Fetch the org's websites server-side (`auth()` + a direct `packages/db` query call — no need to
round-trip through the API route from within a Server Component itself), passing data down to a
thin client component for the interactive bits (card click → select + navigate). This directly
satisfies the Phase 3 gate ("websites persist across reloads") without a client-side fetch
waterfall.

Website creation reuses the `NewRunDialog` shape/pattern in `packages/ui` for a `NewWebsiteDialog`
— POSTs to the API route, then revalidates the page.

### 4.6 Cross-workspace isolation test
Add a test (matching whatever convention `tests/integration/README.md` established in Phase 1)
that creates two workspaces and asserts workspace A's query functions never return workspace B's
websites — even when passed workspace B's website id directly. This is the literal Phase 3 gate
("cross-workspace access is rejected server-side").

## 5. Files to touch

- `packages/contracts/src/entities.ts` — schema drift fix.
- `apps/web/package.json` — add `@clerk/nextjs`, `@nori/db`.
- `apps/web/middleware.ts` — new.
- `apps/web/src/app/layout.tsx` — wrap in `ClerkProvider`.
- `packages/ui/src/components/Sidebar.tsx` or `PageHeader.tsx` — org switcher.
- `packages/db/src/queries/workspaces.ts`, `packages/db/src/queries/websites.ts` — new.
- `packages/db/src/row-mapping.ts` (or similar name) — new shared helper.
- `apps/web/src/app/api/websites/route.ts`, `apps/web/src/app/api/websites/[id]/route.ts` — new.
- `apps/web/src/app/websites/page.tsx` — Server Component conversion.
- `apps/web/src/context/workspace-context.tsx` — adjust for the workspace (org) vs. website (row
  within org) two-level model.
- `.env.example` — updated Clerk comments/vars.
- `plan/IMPLEMENTATION_PLAN.md` — check off Phase 3 items, record the Clerk Organizations
  decision in the decision log, update the session handoff section.

## 6. Acceptance gate

Restating the master plan's Phase 3 gate plus concrete, checkable criteria:

- [ ] Websites persist across reloads (created via the real UI, still present after a hard
  refresh, sourced from Postgres, not a fixture array).
- [ ] Cross-workspace access is rejected server-side — proven by an automated test, not just
  reasoning about the code.
- [ ] `npm run typecheck`, `npm run lint`, `npm run build` all pass at the repo root.
- [ ] `packages/contracts`'s `runSchema` and `001_init.sql`'s `runs` table agree on every column.
- [ ] Clerk middleware and `ClerkProvider` are correctly wired, even though real sign-in can't be
  exercised end-to-end without the user's own Clerk API keys — this limitation is documented, not
  silently glossed over.

## Session log

### 2026-09-12 — Schema fix + Clerk wiring

- Tasks checked off: 4.1 (schema drift fix), 4.2 (Clerk + Organizations wiring), partial.
- Changed areas: `packages/contracts/src/entities.ts` (added `cancelRequestStateSchema`, wired
  into `runSchema`, imported `CANCEL_REQUEST_STATES` from `state-machines.ts` which already had
  it defined — no new state-machine logic needed, just exposing it in the zod schema);
  `apps/web/src/fixtures/runs.ts` (added `cancelRequestState: 'none'` to all 4 fixture runs, since
  the new required field broke their shape); `apps/web/package.json` (added `@clerk/nextjs
  ^7.9.2`, `@nori/db`); `apps/web/src/middleware.ts` (new — `clerkMiddleware()` protecting all
  routes except `/api/health`); `apps/web/src/app/layout.tsx` (wrapped in `ClerkProvider`,
  outermost); `.env.example` (Clerk section updated to the exact env var names `@clerk/nextjs`
  reads by default: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`).
- Checks actually run: `npm run typecheck`/`lint`/`build` all pass at the repo root. Started
  `npm run dev:web` with no Clerk keys set and confirmed the *expected* failure: Clerk correctly
  throws "Missing publishableKey" with actionable instructions (`npx clerk@latest init`) rather
  than silently misbehaving — this confirms the middleware/provider wiring is correct, just
  blocked on real credentials.
- Failures/limitations: real sign-in cannot be exercised end-to-end without the user running
  `npx clerk@latest init` (or manually creating a Clerk app and pasting keys into a local `.env`)
  — this is expected per the plan's own stated constraint (section 2), not a bug.
- Next concrete task at the time: 4.3 — build the `packages/db` query/repository layer.

### 2026-09-12 (continued) — DB query layer built and verified end-to-end

- Tasks checked off: 4.3 (DB query/repository layer), fully done and verified against a real
  database — the strongest verification so far this phase.
- Changed areas: `packages/db/src/row-mapping.ts` (new — shared snake_case→camelCase +
  Date→ISO-string row mapper, used by every query function); `packages/db/src/queries/
  workspaces.ts` (new — `ensureWorkspace(orgId, name)`, upsert-on-first-access);
  `packages/db/src/queries/websites.ts` (new — `listWebsitesForWorkspace`, `createWebsite`,
  `getWebsiteById`, every one scoped by `workspaceId`); `packages/db/src/index.ts` (exports the
  new query modules); `packages/db/package.json` (added `@nori/contracts` dependency).
- **Real architectural finding, resolved**: `workspaces.id` is a Postgres `uuid` primary key
  referenced by every workspace-scoped table's foreign key, but Clerk organization ids (format
  `org_...`) are not valid uuids — so `orgId` cannot be used as `workspaces.id` directly, contrary
  to my first draft of `ensureWorkspace`. Fixed by adding a new migration
  (`packages/db/src/migrations/003_clerk_org_link.sql`) that adds a `clerk_org_id text unique`
  column to `workspaces` rather than reshaping the existing `uuid` primary key (which would ripple
  through `websites.workspace_id`, `runs.workspace_id`, etc.). `ensureWorkspace` now upserts on
  `clerk_org_id` and returns Nori's own internal `id` (uuid) for callers to use in every
  subsequent workspace-scoped query.
- **Pre-existing bug found and fixed**: `packages/db/src/migrate.ts` (written in Phase 1) has
  apparently never been run successfully before — `node --experimental-strip-types` (the runner
  Phase 1 wired up) strips TypeScript syntax but does not remap `.js`-suffixed import specifiers
  to the `.ts` files they actually point to on disk (every file in this repo uses that `.js`
  convention because `tsc`/Next.js's bundler-mode resolution handles the remap; raw Node does
  not). Switched `packages/db`'s `migrate` script to use `tsx` instead (a devDependency addition,
  `tsx ^4.22.4`), which does resolve `.js`→`.ts` correctly, matching every other tool in this
  monorepo — no source-level import changes needed.
- **Local environment issue found and fixed**: this machine has a native (non-Docker) Postgres
  server already bound to port 5432, which silently intercepted connections meant for the Docker
  Compose Postgres, causing a confusing "role nori does not exist" error even after resetting the
  Docker volume. Resolved by using the native Postgres install instead of Docker for local dev
  (per the user's explicit choice) — created a `nori` role/database on it directly (non-
  destructively; did not touch any pre-existing roles/databases). The project's `docker-compose.yml`
  is untouched and still valid for anyone whose machine doesn't have a conflicting native Postgres.
- Checks actually run: `npm run db:migrate` applied all three migrations cleanly against the real
  native Postgres (`001_init.sql`, `002_queue.sql` — confirming these Phase 1 migrations are
  correct for the first time ever, plus the new `003_clerk_org_link.sql`). Wrote and ran a
  temporary smoke-test script (not committed — deleted after use) that: created two workspaces via
  `ensureWorkspace`, created a website in workspace A via `createWebsite`, confirmed
  `listWebsitesForWorkspace` returns it for A and an empty list for B, and — the actual Phase 3
  gate — confirmed `getWebsiteById(workspaceB.id, <workspace A's website id>)` returns `null`
  while `getWebsiteById(workspaceA.id, <same id>)` correctly returns the website. Cleaned up all
  test data afterward. `npm run typecheck`/`lint`/`build` all pass at the repo root.
- Failures/limitations: the cross-workspace isolation check above was a manual smoke test, not
  yet a committed automated test — section 4.6 (a real test file) is still outstanding. Real
  Clerk sign-in still cannot be exercised end-to-end without the user's own Clerk API keys.
- Next concrete task: 4.4 — API routes for website CRUD (`apps/web/src/app/api/websites/
  route.ts`, `.../[id]/route.ts`), then 4.5 (Server Component conversion of `websites/page.tsx`)
  and 4.6 (turning this session's manual isolation smoke test into a committed automated test).
