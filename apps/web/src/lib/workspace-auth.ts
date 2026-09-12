import { auth, clerkClient } from '@clerk/nextjs/server';
import { ensureWorkspace } from '@nori/db';
import type { Workspace } from '@nori/contracts';

export class UnauthorizedError extends Error {}
export class NoActiveOrganizationError extends Error {}

/**
 * Resolves the current request's authenticated Clerk organization into Nori's internal
 * workspace row, creating it on first access (see packages/db/src/queries/workspaces.ts).
 * Throws UnauthorizedError if there's no signed-in user, or NoActiveOrganizationError if the
 * user is signed in but has no active organization selected — every workspace-scoped API route
 * should call this first and let these errors map to 401/403 responses, never proceed with a
 * missing or client-supplied workspace id.
 */
export async function requireWorkspace(): Promise<Workspace> {
  const { userId, orgId } = await auth();
  if (!userId) {
    throw new UnauthorizedError('No signed-in user.');
  }
  if (!orgId) {
    throw new NoActiveOrganizationError('No active organization selected.');
  }
  const client = await clerkClient();
  const organization = await client.organizations.getOrganization({ organizationId: orgId });
  return ensureWorkspace(orgId, organization.name);
}
