import type { Website } from '@nori/contracts';
import { getDb } from '../client';
import { rowToCamelCase } from '../row-mapping';

// Every function here takes workspaceId as a required parameter and scopes its WHERE clause on
// it — never trust a bare website id from the client without also checking it belongs to the
// caller's workspace. This is what plan/PHASE_3_PLAN.md section 4.6's cross-workspace isolation
// test asserts.

export async function listWebsitesForWorkspace(workspaceId: string): Promise<Website[]> {
  const sql = getDb();
  const rows = await sql<Record<string, unknown>[]>`
    select id, workspace_id, display_name, origin, authorization_status, created_at, updated_at
    from websites
    where workspace_id = ${workspaceId}
    order by created_at desc
  `;
  return rows.map((row) => rowToCamelCase<Website>(row));
}

export interface CreateWebsiteInput {
  displayName: string;
  origin: string;
}

export async function createWebsite(
  workspaceId: string,
  input: CreateWebsiteInput,
): Promise<Website> {
  const sql = getDb();
  const [row] = await sql<Record<string, unknown>[]>`
    insert into websites (workspace_id, display_name, origin, authorization_status)
    values (${workspaceId}, ${input.displayName}, ${input.origin}, 'unverified')
    returning id, workspace_id, display_name, origin, authorization_status, created_at, updated_at
  `;
  if (!row) {
    throw new Error(
      `createWebsite: insert returned no row for workspaceId ${workspaceId}, origin ${input.origin}`,
    );
  }
  return rowToCamelCase<Website>(row);
}

/**
 * Returns the website only if it belongs to `workspaceId` — the `WHERE workspace_id = $1 and
 * id = $2` combination (not a plain `WHERE id = $1`) is what actually enforces workspace
 * isolation here, rather than fetching by id and checking the result afterward.
 */
export async function getWebsiteById(
  workspaceId: string,
  websiteId: string,
): Promise<Website | null> {
  const sql = getDb();
  const [row] = await sql<Record<string, unknown>[]>`
    select id, workspace_id, display_name, origin, authorization_status, created_at, updated_at
    from websites
    where workspace_id = ${workspaceId} and id = ${websiteId}
  `;
  return row ? rowToCamelCase<Website>(row) : null;
}

export async function deleteWebsite(
  workspaceId: string,
  websiteId: string,
): Promise<'deleted' | 'not_found' | 'active_run'> {
  const sql = getDb();
  return sql.begin(async (transaction) => {
    const [website] = await transaction<{ id: string }[]>`
      select id from websites
      where workspace_id = ${workspaceId} and id = ${websiteId}
      for update
    `;
    if (!website) return 'not_found';

    const [activeRun] = await transaction<{ id: string }[]>`
      select id from runs
      where website_id = ${websiteId}
        and state not in ('completed', 'completed_with_errors', 'failed', 'cancelled')
      limit 1
    `;
    if (activeRun) return 'active_run';

    await transaction`
      delete from websites
      where workspace_id = ${workspaceId} and id = ${websiteId}
    `;
    return 'deleted';
  });
}
