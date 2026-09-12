-- Links a Nori workspace row to its Clerk Organization (see plan/PHASE_3_PLAN.md section 2:
-- Clerk Organizations are the workspace concept, orgId is what every request actually carries).
-- Added as a new column rather than changing workspaces.id's type, since that id is a uuid
-- referenced by every workspace-scoped table's foreign key (websites, runs, ...) — Clerk org ids
-- (format "org_...") are not valid uuids, so they can't be stored there directly without
-- reshaping every table that references workspaces(id).

alter table workspaces add column clerk_org_id text unique;
create index workspaces_clerk_org_id_idx on workspaces(clerk_org_id) where clerk_org_id is not null;
