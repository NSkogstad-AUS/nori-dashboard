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
- Authentication via Clerk. Each Clerk user gets exactly one personal Nori workspace — no
  organizations, invites, or multi-user membership (see the workspace-model decision below; this
  was originally built on Clerk Organizations and was reverted per explicit user request to keep
  things local/simple — see the 2026-09-12 session note "Organizations removed").
- A DB query/repository layer in `packages/db` for workspaces and websites.
- API routes and a Server Component conversion for website creation/listing.
- A cross-workspace isolation test proving one user's workspace can never read another's data.
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
| Workspace model | **Superseded 2026-09-12.** One personal workspace per Clerk user, auto-created on first sign-in (`workspaces.clerk_user_id`, resolved via `userId` from `auth()`). No organizations, no invites, no multi-user membership — Nori has no team/collaboration concept at this stage. Originally built on Clerk Organizations (`orgId` as the workspace identifier); reverted per explicit user request ("dont do organisations") to keep local dev simple — see the session note below for what changed. |
| Local environment | Real Postgres, run natively on the developer's machine rather than via the project's `docker-compose.yml` (see the Phase 3 session notes below — a pre-existing native Postgres on port 5432 silently intercepted Docker's, so native was chosen instead and the local `nori`/`nori` role+database is created directly on it). `scripts/setup.sh` automates this. Clerk itself is wired up correctly in code; real sign-in requires the user's own Clerk app + API keys (via `npx clerk@latest init`, run from `apps/web/`). |
| Fixture transition | Websites fully replace fixture reads with real DB-backed data (the literal Phase 3 gate). Runs stay fixture-backed for now (see scope above). Personas stay fixture-backed. |
| Schema drift | `packages/contracts`'s `runSchema` is missing `cancelRequestState`, even though `001_init.sql`'s `runs` table has a `cancel_request_state` column. Fixed as part of this phase, before building the API layer on top of it. |

**Why the workspace model changed:** Clerk Organizations were originally chosen so invite flows,
role management, and an org-switcher UI would come for free rather than being hand-built — the
standard pattern for a B2B multi-tenant app. In practice this meant a first-time signed-in user
with no Clerk Organization hit a hard "No active organization selected" error with no in-app way
to recover, which needed its own onboarding flow (`/create-organization` page + a middleware
redirect) just to unblock local development. The user asked to drop organizations entirely rather
than build and maintain that onboarding path — Nori doesn't need multi-user workspaces yet, so a
workspace is now just "this Clerk user's data," with no separate creation/switching step at all.

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

- [x] Websites persist across reloads (created via the real UI, still present after a hard
  refresh, sourced from Postgres, not a fixture array). Verified via `createWebsite` +
  `listWebsitesForWorkspace` against real Postgres; the UI path itself (NewWebsiteDialog → POST
  /api/websites) is built and typechecked/built cleanly, but not click-tested in a browser since
  that requires real Clerk sign-in — see the Clerk item below.
- [x] Cross-workspace access is rejected server-side — proven by an automated test
  (`tests/integration/workspace-isolation.test.ts`), not just reasoning about the code. The test
  was verified to actually test something: deliberately breaking `getWebsiteById`'s workspace
  scoping made it fail loudly with a clear diff, then the fix was confirmed to restore a clean
  pass.
- [x] `npm run typecheck`, `npm run lint`, `npm run build` all pass at the repo root.
- [x] `packages/contracts`'s `runSchema` and `001_init.sql`'s `runs` table agree on every column.
- [x] Clerk middleware and `ClerkProvider` are correctly wired, even though real sign-in can't be
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
- Next concrete task at the time: 4.4 — API routes for website CRUD.

### 2026-09-12 (continued) — API routes, Server Component conversion, automated test: Phase 3 complete

- Tasks checked off: 4.4, 4.5, 4.6 — every remaining item in this plan's implementation steps and
  acceptance gate.
- Changed areas: `apps/web/src/lib/workspace-auth.ts` (new — `requireWorkspace()` resolves the
  current Clerk org into Nori's workspace row, typed `UnauthorizedError`/
  `NoActiveOrganizationError` for API routes to map to 401/403); `apps/web/src/app/api/websites/
  route.ts` and `.../[id]/route.ts` (new — GET list/create, GET detail, every handler scoped by
  the resolved workspace); `apps/web/next.config.ts` (added `@nori/contracts`/`@nori/db` to
  `transpilePackages`); `packages/contracts/src` and `packages/db/src` (stripped `.js` from
  internal relative imports — see the real build-pipeline bug found below); `packages/ui/src/
  components/NewWebsiteDialog.tsx` (new, mirrors `NewRunDialog`'s shape); `apps/web/src/context/
  workspace-context.tsx` (now holds the real website list + `addWebsite`, seeded via
  `initialWebsites` instead of importing the fixture array); `apps/web/src/app/layout.tsx`
  (fetches the workspace's real websites server-side, passes them into `WorkspaceProvider`);
  `apps/web/src/app/app-shell-frame.tsx` (reads `websites` from context instead of the fixture
  import); `apps/web/src/app/websites/page.tsx` (now an async Server Component) +
  `websites-page-client.tsx` (new — the interactive split-off); `apps/web/src/app/page.tsx` and
  `runs/page.tsx` (fixed a coherence gap — see below); `tests/integration/
  workspace-isolation.test.ts` (new — the automated cross-workspace isolation test); root
  `package.json` (added `test:integration` script using Node's built-in test runner via `tsx`, no
  new test-framework dependency).
- **Real build-pipeline bug found and fixed**: adding `@nori/contracts`/`@nori/db` to
  `transpilePackages` was not sufficient to fix Next's webpack build — it still failed with
  "Module not found: Can't resolve './entities.js'" etc., since `transpilePackages` controls
  whether Next transpiles a package's syntax, not whether it remaps `.js`-suffixed import
  specifiers to the `.ts` files they point to on disk. The actual fix (matching a fix already
  applied to `packages/ui`/`apps/web` in an earlier session, now extended to the two packages
  touched by API routes for the first time) was stripping `.js` from every internal relative
  import in `packages/contracts/src` and `packages/db/src` — except `packages/db/src/migrate.ts`,
  which is run directly via `tsx` and needs the literal `.js` extension to resolve correctly
  under that runner.
- **Real coherence bug found and fixed**: once `selectedWebsiteId` (in `WorkspaceContext`) became
  a real database id instead of a fixture id, `runs/page.tsx` and home `page.tsx`'s
  `websites.find(id) ?? fixtureWebsites[0]` fallback pattern would silently show Acme's fixture
  data attributed to whichever real website happened to be selected, since the real id would
  essentially never match a fixture id. Fixed by removing the `?? fixtureWebsites[0]` fallback in
  both: `runs/page.tsx` now shows an honest empty state when there's no matching fixture website,
  and home `page.tsx`'s "Latest journey" section was relabeled "Sample journey" instead of
  attributing fixture data to a real website's name.
- Checks actually run: `npm run typecheck`/`lint`/`build` all pass at the repo root (build output
  confirms `/websites`, `/api/websites`, `/api/websites/[id]` all compile; every route is now `ƒ`
  dynamic rather than `○` static, correctly, since `auth()` reads request headers). Ran
  `npm run test:integration` against real local Postgres — all 4 assertions pass, and the test
  was verified to actually catch a real regression: deliberately removing `getWebsiteById`'s
  workspace-scoping clause made it fail with a clear diff, restoring the fix brought it back to a
  clean pass. Started the dev server and confirmed every route (`/`, `/websites`, `/runs`,
  `/journeys`) responds with Clerk's own clear "missing publishableKey" error (no keys set) rather
  than any new/different failure mode — confirms the whole restructure holds together structurally.
- Failures/limitations: real Clerk sign-in, and therefore true end-to-end browser click-testing
  of "create a website via the UI, reload, see it persist," still cannot be exercised without the
  user's own Clerk API keys (`npx clerk@latest init`). Home and runs pages still show fixture
  journey/run data unrelated to whichever real website is selected — intentional and documented,
  not a bug, since moving those off fixtures is out of this phase's scope, but it does mean the
  app's data model is only fully coherent for the Websites page/workflow at this point, not
  end-to-end.
- Next concrete task: **Phase 3 is complete per this plan's checklist.** The next phase is
  Phase 4 (safe deterministic browser execution) per `plan/IMPLEMENTATION_PLAN.md` — but note its
  explicit gate: "Implement this before letting a model control arbitrary navigation." A natural
  follow-up before or alongside Phase 4 (not blocking it) is real Clerk credential setup so this
  phase's work can finally be exercised end-to-end in a browser.

### 2026-09-12 (continued) — Organizations removed, local dev simplified

- Trigger: after wiring up Clerk sign-in for real, a first-time user with no Clerk Organization
  hit `NoActiveOrganizationError` with no in-app way to recover, so an in-app org creation/
  switcher flow was built (`/create-organization` page using Clerk's `<CreateOrganization>`, a
  middleware redirect for signed-in-but-orgless users, an `<OrganizationSwitcher>` in the sidebar
  footer). The user then asked to drop organizations entirely rather than keep that onboarding
  path — see "Why the workspace model changed" in section 2 above.
- Changed areas: `apps/web/src/lib/workspace-auth.ts` (`requireWorkspace()` now only needs
  `userId` from `auth()` plus the user's name/email from `currentUser()` — no more
  `clerkClient().organizations` lookup; deleted `NoActiveOrganizationError`, only
  `UnauthorizedError` remains); `apps/web/src/middleware.ts` (back to a plain sign-in gate — no
  org check, no `/create-organization` exclusion); `apps/web/src/app/create-organization/`
  (deleted); `apps/web/src/app/app-shell-frame.tsx` and `packages/ui/src/components/Sidebar.tsx`
  (the `<OrganizationSwitcher>`/`workspaceSwitcher` slot added for this, then removed — back to
  the plain static "Your workspace" footer); `apps/web/src/app/api/websites/route.ts` and
  `.../[id]/route.ts` (dropped the now-impossible `NoActiveOrganizationError` → 403 branch);
  `packages/db/src/queries/workspaces.ts` (`ensureWorkspace(userId, name)` instead of
  `ensureWorkspace(orgId, name)`); `packages/db/src/migrations/003_clerk_org_link.sql` renamed to
  `003_clerk_user_link.sql` (`clerk_user_id` column instead of `clerk_org_id` — edited in place
  rather than adding a new migration on top, since it had only existed locally this session and
  was never applied anywhere but this machine's dev database); `tests/integration/
  workspace-isolation.test.ts` (fake `user_...` ids instead of `org_...` ids); `.env.example` and
  `plan/IMPLEMENTATION_PLAN.md`'s decision log updated to match.
- **Local-only consequence, handled**: renaming the migration file meant the local dev database's
  `schema_migrations` history (keyed by filename) no longer matched. Since no real data existed
  yet (the org-creation block had prevented anyone from reaching the point of creating a website),
  the simplest fix was dropping and recreating the local `nori` database from scratch, then
  re-running `npm run db:migrate` — rather than layering a rename migration on top of a
  since-abandoned column. This is safe precisely because it's local/pre-real-data; the same move
  would not be appropriate once a real deployed database has this migration applied.
- Checks actually run: `npm run typecheck`/`lint`/`build` all pass at the repo root (build output
  confirms `/create-organization` no longer appears in the route list). Re-ran
  `npm run db:migrate` against the freshly recreated local database — all three migrations
  (`001_init.sql`, `002_queue.sql`, `003_clerk_user_link.sql`) applied cleanly. Re-ran
  `npm run test:integration` — all 4 cross-workspace isolation assertions still pass against the
  renamed column. Restarted the dev server and confirmed `/create-organization` 404s (route no
  longer exists) and the app otherwise starts clean.
- Failures/limitations: same as before — real Clerk sign-in still cannot be exercised end-to-end
  in this environment without the user driving a real browser session with cookies; the change
  itself is verified structurally (typecheck/lint/build/tests) but not yet click-tested by a human
  in a browser as of this note.
- Next concrete task: unchanged — Phase 4 (safe deterministic browser execution), or real Clerk
  credential setup as a non-blocking follow-up, per the note above.
