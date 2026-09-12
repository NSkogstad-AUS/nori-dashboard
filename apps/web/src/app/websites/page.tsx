// Phase 3: Server Component, real DB-backed data (see plan/PHASE_3_PLAN.md section 4.5) —
// replaces the Phase 2 fixture-driven client component. Fetches the current workspace's
// websites server-side and passes them to a thin client component for the interactive bits
// (card click, "add website" dialog).

import { listWebsitesForWorkspace } from '@nori/db';
import { requireWorkspace } from '../../lib/workspace-auth';
import { WebsitesPageClient } from './websites-page-client';

export default async function WebsitesPage() {
  const workspace = await requireWorkspace();
  const websites = await listWebsitesForWorkspace(workspace.id);
  return <WebsitesPageClient initialWebsites={websites} />;
}
