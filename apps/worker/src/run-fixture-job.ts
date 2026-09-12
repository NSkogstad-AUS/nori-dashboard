import { randomUUID } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import {
  ensureWorkspace,
  createWebsite,
  listWebsitesForWorkspace,
  ensureSystemPersona,
  createRun,
  createPersonaSession,
  enqueueJob,
} from '@nori/db';

// CLI trigger for Phase 4's fixture job — see plan/PHASE_4_PLAN.md section 4.5. No run-creation
// UI/API exists yet (Phase 3 explicitly deferred that), so this script seeds the website/run/
// persona_session/job rows the worker's job-claim loop (main.ts) needs, using the same
// packages/db query functions real API routes would eventually call. Run via:
//   npm run seed-fixture-run --workspace=apps/worker
// then start the worker (npm run dev:worker) to have it pick the job up, or run both together.

function resolveLanAddress(): string {
  const override = process.env.FIXTURE_SITE_HOST;
  if (override) return override;
  const nets = networkInterfaces();
  for (const addrs of Object.values(nets)) {
    for (const addr of addrs ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) {
        return addr.address;
      }
    }
  }
  throw new Error(
    'resolveLanAddress: no non-internal IPv4 interface found — set FIXTURE_SITE_HOST explicitly.',
  );
}

async function main() {
  const fixtureSitePort = Number(process.env.FIXTURE_SITE_PORT ?? 8082);
  const host = resolveLanAddress();
  const fixtureOrigin = `http://${host}:${fixtureSitePort}`;
  console.log(`[seed] fixture site origin: ${fixtureOrigin}`);

  const workspace = await ensureWorkspace('phase4-fixture-runner', 'Phase 4 Fixture Runner');
  const persona = await ensureSystemPersona();

  const website = await createWebsite(workspace.id, {
    displayName: 'Nori Fixture Site',
    origin: fixtureOrigin,
  }).catch(async (error: unknown) => {
    // createWebsite enforces a unique (workspace_id, origin) constraint — re-running this
    // script against an already-seeded workspace is expected during local iteration, so treat a
    // conflict as "reuse the existing website" rather than failing the whole run.
    if (error instanceof Error && 'code' in error && error.code === '23505') {
      const existing = await listWebsitesForWorkspace(workspace.id);
      const found = existing.find((w) => w.origin === fixtureOrigin);
      if (found) return found;
    }
    throw error;
  });

  const run = await createRun(workspace.id, {
    websiteId: website.id,
    url: fixtureOrigin + '/',
    task: 'Subscribe to the newsletter from the fixture site home page.',
    allowedOrigins: [fixtureOrigin],
    limits: { maxActionsPerSession: 20, maxSessionSeconds: 60, hardCostCapUsd: 0.5 },
    idempotencyKey: randomUUID(),
  });
  console.log(`[seed] created run ${run.id}`);

  const session = await createPersonaSession({
    runId: run.id,
    personaId: persona.id,
    personaVersion: persona.version,
    device: persona.device,
  });
  console.log(`[seed] created persona session ${session.id}`);

  const job = await enqueueJob(run.id, session.id);
  console.log(
    `[seed] enqueued job ${job.id} — run it with WORKER_FIXTURE_MODE=true npm run dev:worker.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('[seed] failed', error);
    process.exit(1);
  });
