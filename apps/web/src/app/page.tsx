import { listWebsitesForWorkspace } from '@nori/db';
import { requireWorkspace } from '../lib/workspace-auth';
import { WebsitesPageClient } from './websites/websites-page-client';

export default async function HomePage() {
  const workspace = await requireWorkspace();
  const websites = await listWebsitesForWorkspace(workspace.id);

  return <WebsitesPageClient initialWebsites={websites} />;
}
