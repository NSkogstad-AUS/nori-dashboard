// Cross-workspace isolation test — the literal Phase 3 gate (plan/PHASE_3_PLAN.md section 4.6:
// "cross-workspace access is rejected server-side"). Runs against a real local Postgres
// (DATABASE_URL must be set — see docs/DEVELOPMENT.md / .env.example), via Node's built-in test
// runner: `tsx --test tests/integration/workspace-isolation.test.ts`.
//
// This talks to packages/db's query layer directly (not the HTTP API routes), since those
// routes require a live Clerk session to reach `requireWorkspace()` — the query layer is where
// the actual scoping logic lives (every function takes workspaceId and scopes its WHERE clause
// on it), so testing at that layer is what actually proves isolation, not an artifact of the
// auth layer happening to reject requests first.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDb,
  ensureWorkspace,
  createWebsite,
  listWebsitesForWorkspace,
  getWebsiteById,
} from '@nori/db';

// getDb() is a lazily-initialized singleton (packages/db/src/client.ts) that keeps its
// connection open — without explicitly ending it, `tsx --test` never exits on its own.
after(async () => {
  await getDb().end();
});

const TEST_ORG_A = 'org_isolation_test_a';
const TEST_ORG_B = 'org_isolation_test_b';

async function cleanup() {
  const sql = getDb();
  await sql`delete from workspaces where clerk_org_id in (${TEST_ORG_A}, ${TEST_ORG_B})`;
}

test('cross-workspace isolation', async (t) => {
  await cleanup();

  const workspaceA = await ensureWorkspace(TEST_ORG_A, 'Isolation Test Workspace A');
  const workspaceB = await ensureWorkspace(TEST_ORG_B, 'Isolation Test Workspace B');

  const website = await createWebsite(workspaceA.id, {
    displayName: 'Isolation Test Site',
    origin: 'https://isolation-test.example',
  });

  await t.test('workspace B never lists workspace A websites', async () => {
    const websitesForB = await listWebsitesForWorkspace(workspaceB.id);
    assert.equal(
      websitesForB.some((site) => site.id === website.id),
      false,
      'workspace B should not see workspace A\'s website in its list',
    );
  });

  await t.test('workspace B cannot fetch workspace A\'s website by id', async () => {
    const result = await getWebsiteById(workspaceB.id, website.id);
    assert.equal(result, null, 'fetching another workspace\'s website by id must return null, not the website');
  });

  await t.test('workspace A can fetch its own website by id', async () => {
    const result = await getWebsiteById(workspaceA.id, website.id);
    assert.ok(result, 'the owning workspace must still be able to fetch its own website');
    assert.equal(result?.id, website.id);
  });

  await cleanup();
});
