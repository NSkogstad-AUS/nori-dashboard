import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { PersonaActionModel, SelectActionInput } from '@nori/agent';
import {
  claimJobById,
  createPersonaSession,
  createRun,
  createWebsite,
  enqueueJob,
  ensureAlexPersona,
  ensureWorkspace,
  getDb,
  getPersonaReportBySessionId,
  getPersonaSessionById,
  getRunByIdUnscoped,
  listStepsForSession,
} from '@nori/db';
import { processJob } from '../../apps/worker/src/main.ts';
import {
  ARTIFACTS_ROOT,
  getActiveBrowserCountForTests,
} from '../../apps/worker/src/run-session.ts';

const PORT = 8190;
const ORIGIN = `http://127.0.0.1:${PORT}`;
let fixtureProcess: ChildProcess | null = null;

class FixturePersonaModel implements PersonaActionModel {
  readonly provider = 'test-provider';
  readonly modelId = 'fixture-persona-model-v1';
  readonly promptVersion = 'fixture-prompt-v1';

  async selectAction(input: SelectActionInput) {
    const complete = input.observation.visibleText.includes("You're subscribed. Thanks!");
    const decision = complete
      ? {
          action: {
            kind: 'finish' as const,
            outcome: 'task_success' as const,
            summary: 'The page visibly confirmed the newsletter subscription.',
          },
          observation: 'The subscription confirmation is visible.',
        }
      : {
          action: {
            kind: 'click' as const,
            elementId:
              input.observation.elements.find((element) => element.name === 'Subscribe')?.id ??
              'missing',
          },
          observation: 'A Subscribe button is visible.',
        };
    return { decision, usage: { inputTokens: 100, outputTokens: 20, costUsd: 0.001 } };
  }
}

class InvalidActionModel implements PersonaActionModel {
  readonly provider = 'test-provider';
  readonly modelId = 'invalid-action-model';
  readonly promptVersion = 'fixture-prompt-v1';

  async selectAction() {
    return {
      decision: {
        action: { kind: 'click' as const, elementId: 'element-not-observed' },
        observation: 'Attempting an element that was not observed.',
      },
      usage: { inputTokens: 25, outputTokens: 10, costUsd: 0.001 },
    };
  }
}

async function waitForFixture(): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(ORIGIN)).ok) return;
    } catch {
      // Wait for the child server.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('persona fixture site did not start');
}

before(async () => {
  fixtureProcess = spawn('npx', ['tsx', 'tests/fixtures/site/src/server.ts'], {
    cwd: path.resolve(import.meta.dirname, '..', '..'),
    env: { ...process.env, FIXTURE_SITE_PORT: String(PORT) },
    stdio: 'ignore',
  });
  await waitForFixture();
});

after(async () => {
  fixtureProcess?.kill();
  await getDb().end();
});

test('one persona completes a real browser journey and persists an evidence-backed report', async () => {
  const workspace = await ensureWorkspace(`phase5-${randomUUID()}`, 'Phase 5 Agent Test');
  const persona = await ensureAlexPersona();
  const website = await createWebsite(workspace.id, {
    displayName: 'Agent Fixture',
    origin: ORIGIN,
  });
  const run = await createRun(workspace.id, {
    websiteId: website.id,
    url: ORIGIN,
    task: 'Subscribe to the weekly newsletter.',
    allowedOrigins: [ORIGIN],
    limits: { maxActionsPerSession: 8, maxSessionSeconds: 30, hardCostCapUsd: 0.5 },
    idempotencyKey: randomUUID(),
  });
  const session = await createPersonaSession({
    runId: run.id,
    personaId: persona.id,
    personaVersion: persona.version,
    device: persona.device,
  });
  const queued = await enqueueJob(run.id, session.id);
  const job = await claimJobById(queued.id, `phase5-test-${randomUUID()}`);
  assert.ok(job);
  await processJob(job, { allowPrivateTargets: true, model: new FixturePersonaModel() });

  assert.equal((await getRunByIdUnscoped(run.id))?.state, 'completed');
  assert.equal((await getPersonaSessionById(session.id))?.state, 'completed');
  const steps = await listStepsForSession(session.id);
  assert.deepEqual(
    steps.map((step) => step.action),
    ['navigate', 'click', 'finish'],
  );
  assert.deepEqual(
    steps.map((step) => step.outcome),
    ['success', 'success', 'success'],
  );
  const clickStep = steps.find((step) => step.action === 'click');
  assert.ok(clickStep?.cursorX !== null && clickStep.cursorX >= 0);
  assert.ok(clickStep?.cursorY !== null && clickStep.cursorY >= 0);

  const report = await getPersonaReportBySessionId(session.id);
  assert.equal(report?.outcome, 'task_success');
  assert.equal(report?.modelId, 'fixture-persona-model-v1');
  assert.equal(report?.promptVersion, 'fixture-prompt-v1');
  assert.equal(report?.inputTokens, 200);
  assert.equal(report?.outputTokens, 40);
  assert.equal(Number(report?.costUsd), 0.002);
  assert.deepEqual(report?.evidenceStepIds.sort(), steps.map((step) => step.id).sort());
  assert.equal(getActiveBrowserCountForTests(), 0);

  await rm(path.join(ARTIFACTS_ROOT, session.id), { recursive: true, force: true });
  await getDb()`delete from workspaces where id = ${workspace.id}`;
});

test('invalid model actions fail as model failures and never reach Playwright', async () => {
  const workspace = await ensureWorkspace(`phase5-failure-${randomUUID()}`, 'Phase 5 Failure Test');
  const persona = await ensureAlexPersona();
  const website = await createWebsite(workspace.id, {
    displayName: 'Agent Failure Fixture',
    origin: ORIGIN,
  });
  const run = await createRun(workspace.id, {
    websiteId: website.id,
    url: ORIGIN,
    task: 'Subscribe to the weekly newsletter.',
    allowedOrigins: [ORIGIN],
    limits: { maxActionsPerSession: 8, maxSessionSeconds: 30, hardCostCapUsd: 0.5 },
    idempotencyKey: randomUUID(),
  });
  const session = await createPersonaSession({
    runId: run.id,
    personaId: persona.id,
    personaVersion: persona.version,
    device: persona.device,
  });
  const queued = await enqueueJob(run.id, session.id);
  const job = await claimJobById(queued.id, `phase5-failure-${randomUUID()}`);
  assert.ok(job);
  await processJob(job, { allowPrivateTargets: true, model: new InvalidActionModel() });

  assert.equal((await getRunByIdUnscoped(run.id))?.state, 'failed');
  const failedSession = await getPersonaSessionById(session.id);
  assert.equal(failedSession?.state, 'failed');
  assert.equal(failedSession?.failureKind, 'model_failure');
  assert.match(failedSession?.failureMessage ?? '', /element_not_in_current_observation/);
  assert.equal(await getPersonaReportBySessionId(session.id), null);
  assert.equal(getActiveBrowserCountForTests(), 0);

  await rm(path.join(ARTIFACTS_ROOT, session.id), { recursive: true, force: true });
  await getDb()`delete from workspaces where id = ${workspace.id}`;
});
