import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
  claimNextJob,
  cancelJob,
  completeJob,
  failJob,
  getRunCancellationState,
  getRunByIdUnscoped,
  getPersonaSessionById,
  heartbeatJob,
  touchHeartbeat,
  updateRunCancellationState,
  updateRunState,
  updateSessionState,
} from '@nori/db';
import { runFixedSessionScript, SessionCancelledError } from './run-session.js';

// Phase 4 job-claim loop (see plan/PHASE_4_PLAN.md section 4.4) — replaces the Phase 1 health-
// check skeleton. Polls the jobs table (packages/db/src/migrations/002_queue.sql) for leasable
// persona-session jobs, claims one via SELECT ... FOR UPDATE SKIP LOCKED
// (packages/db/src/queries/jobs.ts), runs a fixed deterministic browser script against it
// (run-session.ts), and records the outcome. Model-driven action selection is Phase 5's job —
// this loop only ever runs the one hand-written script, never anything a model chose.

const PORT = Number(process.env.PORT ?? 8081);
const WORKER_ID = process.env.WORKER_ID ?? `worker-${randomUUID().slice(0, 8)}`;
const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 2000);

let polling = true;
let currentJobPromise: Promise<void> | null = null;

export async function processJob(
  job: NonNullable<Awaited<ReturnType<typeof claimNextJob>>>,
  options: { allowPrivateTargets?: boolean } = {},
) {
  if (!job) return;
  console.log(`[worker] claimed job ${job.id} (session ${job.sessionId})`);

  const run = await getRunByIdUnscoped(job.runId);
  const session = await getPersonaSessionById(job.sessionId);
  if (!run || !session) {
    await failJob(
      job.id,
      `run or session not found (runId=${job.runId}, sessionId=${job.sessionId})`,
    );
    return;
  }

  const fixtureMode = options.allowPrivateTargets ?? process.env.WORKER_FIXTURE_MODE === 'true';
  if (!fixtureMode) {
    const message = 'Phase 4 deterministic actions are disabled outside explicit fixture mode';
    await updateSessionState(session.id, session.state, 'failed');
    await updateRunState(run.id, run.state, 'failed');
    await failJob(job.id, message);
    return;
  }

  try {
    let lastHeartbeatAt = 0;
    await updateRunState(run.id, run.state, 'running');
    await updateSessionState(session.id, session.state, 'starting');
    await updateSessionState(session.id, 'starting', 'exploring');

    await runFixedSessionScript({
      run,
      session,
      navigationOptions: {
        allowedOrigins: run.allowedOrigins,
        // The fixture site runs on a non-default port and (for now) a private LAN address on
        // the developer's machine — see plan/PHASE_4_PLAN.md's "fixture reachability" note and
        // packages/agent/src/safe-navigation.ts's allowPrivateTargets doc comment. Every real
        // user-submitted URL Phase 5 ever requests must never set this.
        allowedPorts: run.allowedOrigins.flatMap((origin) => {
          const port = new URL(origin).port;
          return port ? [Number(port)] : [];
        }),
        allowPrivateTargets: fixtureMode,
      },
      monitorIntervalMs: 250,
      onHeartbeat: async () => {
        if (Date.now() - lastHeartbeatAt < 5000) return;
        await Promise.all([heartbeatJob(job.id), touchHeartbeat(session.id)]);
        lastHeartbeatAt = Date.now();
      },
      isCancellationRequested: async () =>
        (await getRunCancellationState(run.id)) === 'cancel_requested',
    });

    await updateSessionState(session.id, 'exploring', 'analysing');
    await updateSessionState(session.id, 'analysing', 'completed');
    await updateRunState(run.id, 'running', 'analysing');
    await updateRunState(run.id, 'analysing', 'completed');
    await completeJob(job.id);
    console.log(`[worker] job ${job.id} completed`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[worker] job ${job.id} failed: ${message}`);
    if (error instanceof SessionCancelledError) {
      const latestSession = await getPersonaSessionById(session.id);
      if (latestSession && latestSession.state !== 'cancelled') {
        await updateSessionState(session.id, latestSession.state, 'cancelled');
      }
      const latestRun = await getRunByIdUnscoped(run.id);
      if (latestRun && latestRun.state !== 'cancelled') {
        await updateRunState(run.id, latestRun.state, 'cancelled');
      }
      if ((await getRunCancellationState(run.id)) === 'cancel_requested') {
        await updateRunCancellationState(run.id, 'cancel_requested', 'cancelled');
      }
      await cancelJob(job.id, message);
      return;
    }
    try {
      const latestSession = await getPersonaSessionById(session.id);
      if (
        latestSession &&
        latestSession.state !== 'failed' &&
        latestSession.state !== 'cancelled'
      ) {
        await updateSessionState(session.id, latestSession.state, 'failed');
      }
      const latestRun = await getRunByIdUnscoped(run.id);
      if (latestRun && latestRun.state !== 'failed' && latestRun.state !== 'cancelled') {
        await updateRunState(run.id, latestRun.state, 'failed');
      }
    } catch (transitionError) {
      console.error('[worker] failed to record failure state', transitionError);
    }
    await failJob(job.id, message);
  }
}

async function pollLoop() {
  while (polling) {
    try {
      const job = await claimNextJob(WORKER_ID);
      if (job) {
        currentJobPromise = processJob(job);
        await currentJobPromise;
        currentJobPromise = null;
      } else {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    } catch (error) {
      console.error('[worker] poll loop error', error);
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
}

let server: ReturnType<typeof createServer> | null = null;

export function startWorker(): void {
  server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', workerId: WORKER_ID }));
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  });

  server.listen(PORT, () => {
    console.log(`[worker] ${WORKER_ID} started, health check on http://localhost:${PORT}/health`);
    console.log('[worker] polling for jobs...');
  });
  void pollLoop();
}

function shutdown(signal: string) {
  console.log(`[worker] received ${signal}, shutting down gracefully`);
  polling = false;
  const finish = () => {
    server?.close((err) => {
      if (err) {
        console.error('[worker] error while closing health server', err);
        process.exit(1);
      }
      process.exit(0);
    });
  };
  if (currentJobPromise) {
    currentJobPromise.finally(finish);
  } else {
    finish();
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startWorker();
}
