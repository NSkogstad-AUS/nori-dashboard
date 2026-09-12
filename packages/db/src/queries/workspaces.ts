import type { Workspace } from '@nori/contracts';
import { getDb } from '../client';
import { rowToCamelCase } from '../row-mapping';

/**
 * Ensures a `workspaces` row exists for the given Clerk user, creating one on first sign-in.
 * Nori has no multi-user/organization concept — every Clerk user gets exactly one personal
 * workspace, linked back to Clerk's user id via the `clerk_user_id` column (see
 * migrations/003_clerk_user_link.sql — Clerk user ids like "user_..." aren't valid uuids, so
 * they can't be the primary key `workspaces.id` itself, which every workspace-scoped table's
 * foreign key references).
 *
 * Every caller of a workspace-scoped query should call this first with the `userId` from
 * `auth()` to resolve it to Nori's internal `workspaceId`, then pass that resolved id to the
 * actual scoped query — never pass a Clerk `userId` directly into a query expecting
 * `workspace_id`.
 */
export async function ensureWorkspace(userId: string, name: string): Promise<Workspace> {
  const sql = getDb();
  const [row] = await sql<Record<string, unknown>[]>`
    insert into workspaces (clerk_user_id, name)
    values (${userId}, ${name})
    on conflict (clerk_user_id) do update set name = excluded.name
    returning id, name, created_at
  `;
  if (!row) {
    throw new Error(`ensureWorkspace: insert returned no row for userId ${userId}`);
  }
  return rowToCamelCase<Workspace>(row);
}
