import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { loadEnvFile } from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  claimNextJob,
  cancelJob,
  completeJob,
  createPersonaReport,
  ensurePersonaFromSeed,
  failJob,
  getPersonaById,
  getRunCancellationState,
  getRunByIdUnscoped,
  getPersonaSessionById,
  heartbeatJob,
  recordSessionFailure,
  touchHeartbeat,
  updateRunCancellationState,
  updateRunState,
  updateSessionState,
  type PersonaSeed,
} from '@nori/db';
import {
  AgentLoopError,
  AnthropicActionModel,
  PersonaModelError,
  type PersonaActionModel,
} from '@nori/agent';
import {
  runFixedSessionScript,
  runPersonaAgentSession,
  SessionCancelledError,
} from './run-session.js';

// Next loads apps/web/.env.local itself, but the standalone Node worker does not. Load the shared
// repository .env without overriding variables already supplied by the process or deployment.
try {
  loadEnvFile(fileURLToPath(new URL('../../../.env', import.meta.url)));
} catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
}

// Phase 4 job-claim loop (see plan/PHASE_4_PLAN.md section 4.4) — replaces the Phase 1 health-
// check skeleton. Polls the jobs table (packages/db/src/migrations/002_queue.sql) for leasable
// persona-session jobs, claims one via SELECT ... FOR UPDATE SKIP LOCKED
// (packages/db/src/queries/jobs.ts), runs a fixed deterministic browser script against it
// (run-session.ts), and records the outcome. Normal persona jobs use the bounded Anthropic action
// model whenever its API key is configured. The fixed Phase 4 script is reserved for the explicit
// system fixture persona so it can never leak into a real website run.

const PORT = Number(process.env.PORT ?? 8081);
const WORKER_ID = process.env.WORKER_ID ?? `worker-${randomUUID().slice(0, 8)}`;
const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 2000);
const CREDENTIAL_TTL_MS = 60 * 60 * 1000;

interface EphemeralCredential {
  apiKey: string;
  expiresAt: number;
}

const runCredentials = new Map<string, EphemeralCredential>();

function purgeExpiredCredentials(): void {
  const now = Date.now();
  for (const [token, credential] of runCredentials) {
    if (credential.expiresAt <= now) runCredentials.delete(token);
  }
}

function credentialForRun(runToken: string): string | undefined {
  purgeExpiredCredentials();
  return runCredentials.get(runToken)?.apiKey;
}

let polling = true;
let currentJobPromise: Promise<void> | null = null;

// Real DB rows for the remaining 3 fixture personas (apps/web/src/fixtures/personas.ts) — Alex
// already has its own dedicated ensureAlexPersona() that existing tests depend on by name/shape,
// so it's left as-is; these three are new so a real run can pick any of the 4 personas the
// NewRunDialog picker shows, not just Alex. Seeded once at worker startup (self-healing, matching
// how ensureWorkspace/ensureAlexPersona already upsert on first use) rather than a one-off
// migration script that could be forgotten in a fresh environment.
const REMAINING_PERSONA_SEEDS: PersonaSeed[] = [
  {
    name: 'Jamie',
    emoji: '👩‍💻',
    goal: 'Busy professional',
    behavior:
      'Moves quickly and skims content for the shortest path to a decision, abandoning ' +
      'anything that takes too long to summarize.',
    device: {
      viewportWidth: 1440,
      viewportHeight: 900,
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      reducedMotion: false,
    },
    limitations: [],
  },
  {
    name: 'Sam',
    emoji: '🧔',
    goal: 'Careful evaluator',
    behavior:
      'Reads every detail before acting, double-checking terms and commitments and ' +
      'backtracking to earlier pages when information feels incomplete.',
    device: {
      viewportWidth: 1440,
      viewportHeight: 900,
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      reducedMotion: false,
    },
    limitations: [],
  },
  {
    name: 'Riley',
    emoji: '👩‍🦽',
    goal: 'Keyboard-first visitor',
    behavior:
      'Navigates entirely by keyboard, relying on a predictable tab order and a visible ' +
      'focus indicator to move through every page.',
    device: {
      viewportWidth: 1440,
      viewportHeight: 900,
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      reducedMotion: true,
    },
    limitations: [],
  },
];

async function ensureRemainingPersonas(): Promise<void> {
  for (const seed of REMAINING_PERSONA_SEEDS) {
    await ensurePersonaFromSeed(seed);
  }
}

export async function processJob(
  job: NonNullable<Awaited<ReturnType<typeof claimNextJob>>>,
  options: { allowPrivateTargets?: boolean; model?: PersonaActionModel } = {},
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
  const persona = await getPersonaById(session.personaId);
  if (!persona) {
    const message = `persona not found (personaId=${session.personaId})`;
    await recordSessionFailure(session.id, 'infrastructure_failure', message);
    await updateSessionState(session.id, session.state, 'failed');
    await updateRunState(run.id, run.state, 'failed');
    await failJob(job.id, message);
    return;
  }

  const fixtureMode = options.allowPrivateTargets ?? process.env.WORKER_FIXTURE_MODE === 'true';
  const isFixedFixturePersona = persona.name === 'Phase 4 Fixture Runner';
  const suppliedApiKey = credentialForRun(run.idempotencyKey);
  const configuredApiKey = suppliedApiKey ?? process.env.ANTHROPIC_API_KEY?.trim();
  const model =
    options.model ??
    (!isFixedFixturePersona && configuredApiKey
      ? new AnthropicActionModel({ apiKey: configuredApiKey })
      : undefined);
  // The Phase 4 fixed script is hard-coded to the fixture site's DOM (see run-session.ts's
  // runFixedSessionScript) — it must never run against a real, non-fixture target. A real,
  // model-driven session has no such constraint: navigationOptions.allowPrivateTargets below
  // already rejects private/internal targets by default (fixtureMode is false unless explicitly
  // set), so a model-driven run against a real public website is safe to proceed without this
  // gate. Only the fixed-script path needs to be refused outside fixture mode.
  if (!model && isFixedFixturePersona && !fixtureMode) {
    const message = 'Phase 4 deterministic actions are disabled outside explicit fixture mode';
    await updateSessionState(session.id, session.state, 'failed');
    await updateRunState(run.id, run.state, 'failed');
    await failJob(job.id, message);
    return;
  }
  if (!model && !isFixedFixturePersona) {
    const message =
      'Persona AI is not configured: enter an Anthropic API key or set ANTHROPIC_API_KEY';
    await recordSessionFailure(session.id, 'infrastructure_failure', message);
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

    const navigationOptions = {
      allowedOrigins: run.allowedOrigins,
      allowedPorts: run.allowedOrigins.flatMap((origin) => {
        const port = new URL(origin).port;
        return port ? [Number(port)] : [];
      }),
      allowPrivateTargets: fixtureMode,
      // Real sites serve their own assets from sibling hosts (cdn./static./assets.), and
      // blocking those leaves the page unable to render at all. Subdomains of the run's own
      // allowlisted origins are in scope for a run authorized against that site; unrelated
      // third-party hosts still are not. See isOriginAllowed in packages/agent/src/
      // safe-navigation.ts for the exact matching rule and what it deliberately excludes.
      allowSubdomains: true,
    };
    const lifecycleOptions = {
      monitorIntervalMs: 250,
      onHeartbeat: async () => {
        if (Date.now() - lastHeartbeatAt < 5000) return;
        await Promise.all([heartbeatJob(job.id), touchHeartbeat(session.id)]);
        lastHeartbeatAt = Date.now();
      },
      isCancellationRequested: async () => (await getRunCancellationState(run.id)) !== 'none',
    };

    if (model) {
      const result = await runPersonaAgentSession({
        run,
        session,
        persona,
        model,
        navigationOptions,
        ...lifecycleOptions,
      });
      await createPersonaReport({
        runId: run.id,
        sessionId: session.id,
        outcome: result.outcome,
        summary: result.summary,
        evidenceStepIds: result.evidenceStepIds,
        modelProvider: model.provider,
        modelId: model.modelId,
        promptVersion: model.promptVersion,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        costUsd: result.usage.costUsd,
      });
    } else {
      await runFixedSessionScript({
        run,
        session,
        navigationOptions,
        ...lifecycleOptions,
      });
    }

    await updateSessionState(session.id, 'exploring', 'analysing');
    await updateSessionState(session.id, 'analysing', 'completed');
    await updateRunState(run.id, 'running', 'analysing');
    await updateRunState(run.id, 'analysing', 'completed');
    await completeJob(job.id);
    console.log(`[worker] job ${job.id} completed`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[worker] job ${job.id} failed: ${message}`);
    const cancellationState = await getRunCancellationState(run.id);
    if (error instanceof SessionCancelledError || cancellationState !== 'none') {
      const latestSession = await getPersonaSessionById(session.id);
      if (latestSession && latestSession.state !== 'cancelled') {
        await updateSessionState(session.id, latestSession.state, 'cancelled');
      }
      const latestRun = await getRunByIdUnscoped(run.id);
      if (latestRun && latestRun.state !== 'cancelled') {
        await updateRunState(run.id, latestRun.state, 'cancelled');
      }
      if (cancellationState === 'cancel_requested') {
        await updateRunCancellationState(run.id, 'cancel_requested', 'cancelled');
      }
      await cancelJob(job.id, message);
      return;
    }
    await recordSessionFailure(
      session.id,
      error instanceof PersonaModelError || error instanceof AgentLoopError
        ? 'model_failure'
        : 'infrastructure_failure',
      message,
    );
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
let shuttingDown = false;

export function startWorker(): void {
  server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', workerId: WORKER_ID }));
      return;
    }

    if (req.method === 'POST' && req.url === '/credentials') {
      const internalToken = process.env.WORKER_INTERNAL_TOKEN?.trim();
      const remoteAddress = req.socket.remoteAddress ?? '';
      const isLoopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remoteAddress);
      if (
        (internalToken && req.headers.authorization !== `Bearer ${internalToken}`) ||
        (!internalToken && !isLoopback)
      ) {
        res.writeHead(401, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'unauthorized' }));
        return;
      }

      let body = '';
      let rejected = false;
      req.setEncoding('utf8');
      req.on('data', (chunk: string) => {
        if (rejected) return;
        body += chunk;
        if (body.length > 2048) {
          rejected = true;
          res.writeHead(413, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'payload_too_large' }));
        }
      });
      req.on('end', () => {
        if (rejected) return;
        try {
          const value = JSON.parse(body) as { runToken?: unknown; apiKey?: unknown };
          if (
            typeof value.runToken !== 'string' ||
            value.runToken.length < 1 ||
            value.runToken.length > 200 ||
            typeof value.apiKey !== 'string' ||
            value.apiKey.trim().length < 20 ||
            value.apiKey.length > 512
          ) {
            res.writeHead(400, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'invalid_credential' }));
            return;
          }
          purgeExpiredCredentials();
          runCredentials.set(value.runToken, {
            apiKey: value.apiKey.trim(),
            expiresAt: Date.now() + CREDENTIAL_TTL_MS,
          });
          res.writeHead(204);
          res.end();
        } catch {
          res.writeHead(400, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid_json' }));
        }
      });
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  });

  server.once('error', (error: NodeJS.ErrnoException) => {
    polling = false;
    if (error.code === 'EADDRINUSE') {
      console.error(
        `[worker] port ${PORT} is already in use. Another Nori worker is likely already running.`,
      );
      process.exitCode = 1;
      return;
    }
    console.error('[worker] health server failed', error);
    process.exitCode = 1;
  });

  server.listen(PORT, () => {
    console.log(`[worker] ${WORKER_ID} started, health check on http://localhost:${PORT}/health`);
    console.log('[worker] polling for jobs...');
    void ensureRemainingPersonas()
      .catch((error: unknown) => console.error('[worker] failed to seed personas', error))
      .finally(() => {
        if (polling) void pollLoop();
      });
  });
}

function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[worker] received ${signal}, shutting down gracefully`);
  polling = false;

  // Release the health port immediately so tsx watch can start the replacement process while
  // this process gives an in-flight job a short window to clean up its browser context.
  server?.close((error) => {
    if (error) console.error('[worker] error while closing health server', error);
  });
  server = null;

  const forceExit = setTimeout(() => {
    console.warn('[worker] shutdown deadline reached; exiting');
    process.exit(0);
  }, 5000);
  forceExit.unref();

  void (currentJobPromise ?? Promise.resolve()).finally(() => {
    clearTimeout(forceExit);
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startWorker();
}
