-- Links a Nori workspace row to its Clerk user. Nori has no multi-user/organization concept —
-- every Clerk user gets exactly one personal workspace, created on first sign-in (see
-- packages/db/src/queries/workspaces.ts's ensureWorkspace). Added as a new column rather than
-- changing workspaces.id's type, since that id is a uuid referenced by every workspace-scoped
-- table's foreign key (websites, runs, ...) — Clerk user ids (format "user_...") are not valid
-- uuids, so they can't be stored there directly without reshaping every table that references
-- workspaces(id).

alter table workspaces add column clerk_user_id text unique;
create index workspaces_clerk_user_id_idx on workspaces(clerk_user_id) where clerk_user_id is not null;
