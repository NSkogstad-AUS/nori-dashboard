import { auth, currentUser } from '@clerk/nextjs/server';
import { ensureWorkspace } from '@nori/db';
import type { Workspace } from '@nori/contracts';

export class UnauthorizedError extends Error {}

/**
 * Resolves the current request's authenticated Clerk user into Nori's internal workspace row,
 * creating it on first sign-in (see packages/db/src/queries/workspaces.ts). Nori has no
 * multi-user/organization concept — every Clerk user gets exactly one personal workspace.
 * Throws UnauthorizedError if there's no signed-in user; every workspace-scoped API route
 * should call this first and let that map to a 401 response, never proceed with a missing or
 * client-supplied workspace id.
 */
export async function requireWorkspace(): Promise<Workspace> {
  const { userId } = await auth();
  if (!userId) {
    throw new UnauthorizedError('No signed-in user.');
  }
  const user = await currentUser();
  const name = user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? 'My workspace';
  return ensureWorkspace(userId, name);
}
