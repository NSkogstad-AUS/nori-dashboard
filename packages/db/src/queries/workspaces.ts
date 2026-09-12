import type { Workspace } from '@nori/contracts';
import { getDb } from '../client';
import { rowToCamelCase } from '../row-mapping';

/**
 * Ensures a `workspaces` row exists for the given Clerk organization, creating one on first
 * access. Clerk orgs are created outside Nori's control (via Clerk's own UI/API), so there is no
 * explicit "create workspace" flow in Nori itself — the workspace row is just a place to hang
 * Nori-owned data (websites, runs, ...) off Nori's own uuid, linked back to Clerk's org id via
 * the `clerk_org_id` column (see migrations/003_clerk_org_link.sql — Clerk org ids like
 * "org_..." aren't valid uuids, so they can't be the primary key `workspaces.id` itself, which
 * every workspace-scoped table's foreign key references).
 *
 * Every caller of a workspace-scoped query should call this first with the `orgId` from `auth()`
 * to resolve it to Nori's internal `workspaceId`, then pass that resolved id to the actual
 * scoped query — never pass a Clerk `orgId` directly into a query expecting `workspace_id`.
 */
export async function ensureWorkspace(orgId: string, name: string): Promise<Workspace> {
  const sql = getDb();
  const [row] = await sql<Record<string, unknown>[]>`
    insert into workspaces (clerk_org_id, name)
    values (${orgId}, ${name})
    on conflict (clerk_org_id) do update set name = excluded.name
    returning id, name, created_at
  `;
  if (!row) {
    throw new Error(`ensureWorkspace: insert returned no row for orgId ${orgId}`);
  }
  return rowToCamelCase<Workspace>(row);
}
