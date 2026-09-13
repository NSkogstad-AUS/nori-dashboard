// End-to-end happy-path test for Phase 4's fixed browser job — the phase's literal gate: "A real
// browser completes the fixture task and produces inspectable artifacts." See
// plan/PHASE_4_PLAN.md section 4.6. Runs a real Chromium browser (via @nori/worker's
// runFixedSessionScript) against a real instance of the fixture site (tests/fixtures/site),
// started and torn down by this test itself, and asserts on the resulting DB rows and screenshot
// files — not mocked at any layer.
//
// Requires DATABASE_URL (see docs/DEVELOPMENT.md) and a Chromium install
// (`npx playwright install chromium`, done once per machine).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  getDb,
  ensureWorkspace,
  createWebsite,
  ensureSystemPersona,
  createRun,
  createPersonaSession,
  enqueueJob,
  claimNextJob,
  getRunByIdUnscoped,
  getRunCancellationState,
  getPersonaSessionById,
  listStepsForSession,
  updateRunCancellationState,
} from '@nori/db';
import { processJob } from '../../apps/worker/src/main.ts';
import {
  getActiveBrowserCountForTests,
  runFixedSessionScript,
  SessionCancelledError,
  SessionLimitExceededError,
  UnsafeTargetError,
} from '../../apps/worker/src/run-session.ts';

const FIXTURE_PORT = 8189; // distinct from the dev-time 8082, to avoid colliding with a running dev instance
const FIXTURE_ORIGIN = `http://127.0.0.1:${FIXTURE_PORT}`;
const ARTIFACTS_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'artifacts-storage',
);

let fixtureSiteProcess: ChildProcess | null = null;

async function waitForFixtureSite(timeoutMs = 10000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${FIXTURE_ORIGIN}/`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('fixture site did not become ready in time');
}

before(async () => {
  fixtureSiteProcess = spawn('npx', ['tsx', 'tests/fixtures/site/src/server.ts'], {
    cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'),
    env: { ...process.env, FIXTURE_SITE_PORT: String(FIXTURE_PORT) },
    stdio: 'ignore',
  });
  await waitForFixtureSite();
});

after(async () => {
  fixtureSiteProcess?.kill();
  await getDb().end();
});

test('fixed browser script completes the fixture task and produces inspectable artifacts', async (t) => {
  const workspace = await ensureWorkspace(`e2e-test-${randomUUID()}`, 'E2E Fixture Test');
  const persona = await ensureSystemPersona();
  const website = await createWebsite(workspace.id, {
    displayName: 'E2E Fixture Site',
    origin: FIXTURE_ORIGIN,
  });
  const run = await createRun(workspace.id, {
    websiteId: website.id,
    url: `${FIXTURE_ORIGIN}/`,
    task: 'Subscribe to the newsletter.',
    allowedOrigins: [FIXTURE_ORIGIN],
    limits: { maxActionsPerSession: 20, maxSessionSeconds: 60, hardCostCapUsd: 0.5 },
    idempotencyKey: randomUUID(),
  });
  const session = await createPersonaSession({
    runId: run.id,
    personaId: persona.id,
    personaVersion: persona.version,
    device: persona.device,
  });

  await enqueueJob(run.id, session.id);
  const job = await claimNextJob(`fixture-test-${randomUUID()}`);
  assert.ok(job, 'worker should claim the fixture job');
  assert.equal(job.sessionId, session.id);
  await processJob(job, { allowPrivateTargets: true });

  const completedRun = await getRunByIdUnscoped(run.id);
  const completedSession = await getPersonaSessionById(session.id);
  assert.equal(completedRun?.state, 'completed');
  assert.equal(completedSession?.state, 'completed');
  assert.ok(completedSession?.heartbeatAt, 'worker should heartbeat while the browser is active');

  await t.test('steps were recorded in order with success outcomes', async () => {
    const steps = await listStepsForSession(session.id);
    assert.equal(steps.length, 5, 'expected navigate, capture, click, capture, finish');
    assert.deepEqual(
      steps.map((s) => s.action),
      ['navigate', 'capture', 'click', 'capture', 'finish'],
    );
    assert.ok(
      steps.every((s) => s.outcome === 'success'),
      "every step should succeed against the fixture site's known-good success path",
    );
    assert.deepEqual(
      steps.map((s) => s.sequence),
      [0, 1, 2, 3, 4],
    );
  });

  await t.test('artifacts exist as real files with correct dimensions', async () => {
    const steps = await listStepsForSession(session.id);
    const artifactIds = steps.flatMap((s) => s.artifactIds);
    assert.equal(artifactIds.length, 2, 'expected one screenshot after navigate, one after click');

    const sql = getDb();
    const rows = await sql<Record<string, unknown>[]>`
      select storage_key, content_type, width, height from artifacts where session_id = ${session.id}
    `;
    assert.equal(rows.length, 2);
    for (const row of rows) {
      assert.equal(row.content_type, 'image/png');
      assert.equal(row.width, 1280);
      assert.equal(row.height, 800);
      const filePath = path.join(ARTIFACTS_ROOT, row.storage_key as string);
      const buffer = await readFile(filePath);
      assert.ok(buffer.length > 0, 'screenshot file should be non-empty');
      assert.equal(
        buffer.subarray(0, 8).toString('hex'),
        '89504e470d0a1a0a',
        'file should have a real PNG signature',
      );
    }
  });

  await rm(path.join(ARTIFACTS_ROOT, session.id), { recursive: true, force: true });
  const sql = getDb();
  await sql`delete from workspaces where id = ${workspace.id}`;
});

async function createLifecycleFixture(
  pathname: string,
  maxSessionSeconds: number,
  maxActionsPerSession = 20,
) {
  const workspace = await ensureWorkspace(`lifecycle-${randomUUID()}`, 'Lifecycle Test');
  const persona = await ensureSystemPersona();
  const website = await createWebsite(workspace.id, {
    displayName: 'Lifecycle Fixture Site',
    origin: FIXTURE_ORIGIN,
  });
  const run = await createRun(workspace.id, {
    websiteId: website.id,
    url: `${FIXTURE_ORIGIN}${pathname}`,
    task: 'Exercise browser lifecycle controls.',
    allowedOrigins: [FIXTURE_ORIGIN],
    limits: { maxActionsPerSession, maxSessionSeconds, hardCostCapUsd: 0.5 },
    idempotencyKey: randomUUID(),
  });
  const session = await createPersonaSession({
    runId: run.id,
    personaId: persona.id,
    personaVersion: persona.version,
    device: persona.device,
  });
  return { workspace, run, session };
}

async function cleanupLifecycleFixture(workspaceId: string, sessionId: string) {
  await rm(path.join(ARTIFACTS_ROOT, sessionId), { recursive: true, force: true });
  await getDb()`delete from workspaces where id = ${workspaceId}`;
}

test('blocked third-party subresources do not fail an allowed page navigation', async () => {
  const { workspace, run, session } = await createLifecycleFixture('/third-party-resource', 30);
  try {
    await runFixedSessionScript({
      run,
      session,
      navigationOptions: {
        allowedOrigins: [FIXTURE_ORIGIN],
        allowedPorts: [FIXTURE_PORT],
        allowPrivateTargets: true,
      },
      monitorIntervalMs: 25,
    });

    const steps = await listStepsForSession(session.id);
    assert.deepEqual(
      steps.map(({ action, outcome }) => ({ action, outcome })),
      [
        { action: 'navigate', outcome: 'success' },
        { action: 'capture', outcome: 'success' },
        { action: 'click', outcome: 'success' },
        { action: 'capture', outcome: 'success' },
        { action: 'finish', outcome: 'success' },
      ],
    );
  } finally {
    await cleanupLifecycleFixture(workspace.id, session.id);
  }
});

test('a slow allowed navigation is not reported as an unsafe target', async () => {
  const { workspace, run, session } = await createLifecycleFixture('/slow-navigation', 30);
  try {
    await runFixedSessionScript({
      run,
      session,
      navigationOptions: {
        allowedOrigins: [FIXTURE_ORIGIN],
        allowedPorts: [FIXTURE_PORT],
        allowPrivateTargets: true,
      },
      monitorIntervalMs: 25,
    });

    const steps = await listStepsForSession(session.id);
    assert.equal(steps[0]?.action, 'navigate');
    assert.equal(steps[0]?.outcome, 'success');
    assert.ok(steps.every((step) => step.outcome === 'success'));
  } finally {
    await cleanupLifecycleFixture(workspace.id, session.id);
  }
});

test('wall-clock timeout interrupts a stuck browser action and releases Chromium', async () => {
  const { workspace, run, session } = await createLifecycleFixture('/unclickable', 2);
  await assert.rejects(
    runFixedSessionScript({
      run,
      session,
      navigationOptions: {
        allowedOrigins: [FIXTURE_ORIGIN],
        allowedPorts: [FIXTURE_PORT],
        allowPrivateTargets: true,
      },
      monitorIntervalMs: 25,
    }),
    SessionLimitExceededError,
  );
  assert.equal(getActiveBrowserCountForTests(), 0, 'timeout must close the browser');
  await cleanupLifecycleFixture(workspace.id, session.id);
});

test('cancellation polling interrupts a live session and releases Chromium', async () => {
  const { workspace, run, session } = await createLifecycleFixture('/slow', 30);
  const startedAt = Date.now();
  await assert.rejects(
    runFixedSessionScript({
      run,
      session,
      navigationOptions: {
        allowedOrigins: [FIXTURE_ORIGIN],
        allowedPorts: [FIXTURE_PORT],
        allowPrivateTargets: true,
      },
      isCancellationRequested: async () => true,
      monitorIntervalMs: 25,
    }),
    SessionCancelledError,
  );
  assert.ok(Date.now() - startedAt < 2_500, 'a stalled response must not delay cancellation');
  assert.equal(getActiveBrowserCountForTests(), 0, 'cancellation must close the browser');
  await cleanupLifecycleFixture(workspace.id, session.id);
});

test('action limit stops the deterministic sequence and releases Chromium', async () => {
  const { workspace, run, session } = await createLifecycleFixture('/', 30, 1);
  await assert.rejects(
    runFixedSessionScript({
      run,
      session,
      navigationOptions: {
        allowedOrigins: [FIXTURE_ORIGIN],
        allowedPorts: [FIXTURE_PORT],
        allowPrivateTargets: true,
      },
      monitorIntervalMs: 25,
    }),
    SessionLimitExceededError,
  );
  assert.equal(getActiveBrowserCountForTests(), 0, 'action-limit failure must close the browser');
  await cleanupLifecycleFixture(workspace.id, session.id);
});

test('browser network boundary blocks an unsafe redirect and records it', async () => {
  const { workspace, run, session } = await createLifecycleFixture('/redirect-unsafe', 30);
  await assert.rejects(
    runFixedSessionScript({
      run,
      session,
      navigationOptions: {
        allowedOrigins: [FIXTURE_ORIGIN],
        allowedPorts: [FIXTURE_PORT],
        allowPrivateTargets: true,
      },
      monitorIntervalMs: 25,
    }),
    UnsafeTargetError,
  );
  const steps = await listStepsForSession(session.id);
  assert.equal(steps.length, 1);
  assert.equal(steps[0]?.action, 'navigate');
  assert.equal(steps[0]?.outcome, 'blocked');
  assert.match(
    steps[0]?.observation ?? '',
    /unsafe_target:(disallowed_port|origin_not_allowlisted)/,
  );
  assert.equal(getActiveBrowserCountForTests(), 0);
  await cleanupLifecycleFixture(workspace.id, session.id);
});

test('worker persists cancelled terminal states when a cancellation is requested', async () => {
  const { workspace, run, session } = await createLifecycleFixture('/unclickable', 30);
  const job = await enqueueJob(run.id, session.id);
  await updateRunCancellationState(run.id, 'none', 'cancel_requested');
  await processJob(job, { allowPrivateTargets: true });

  assert.equal((await getRunByIdUnscoped(run.id))?.state, 'cancelled');
  assert.equal((await getPersonaSessionById(session.id))?.state, 'cancelled');
  assert.equal(await getRunCancellationState(run.id), 'cancelled');
  const [jobRow] = await getDb()<[{ status: string }]>`
    select status from jobs where id = ${job.id}
  `;
  assert.equal(jobRow?.status, 'cancelled');
  assert.equal(getActiveBrowserCountForTests(), 0);
  await cleanupLifecycleFixture(workspace.id, session.id);
});

test('worker fails the job and records terminal states when fixture mode is disabled', async () => {
  const { workspace, run, session } = await createLifecycleFixture('/', 30);
  const job = await enqueueJob(run.id, session.id);
  await processJob(job, { allowPrivateTargets: false });

  assert.equal((await getRunByIdUnscoped(run.id))?.state, 'failed');
  assert.equal((await getPersonaSessionById(session.id))?.state, 'failed');
  const [jobRow] = await getDb()<[{ status: string; last_error: string | null }]>`
    select status, last_error from jobs where id = ${job.id}
  `;
  assert.equal(jobRow?.status, 'failed');
  assert.match(jobRow?.last_error ?? '', /disabled outside explicit fixture mode/);
  assert.equal(getActiveBrowserCountForTests(), 0);
  await cleanupLifecycleFixture(workspace.id, session.id);
});
