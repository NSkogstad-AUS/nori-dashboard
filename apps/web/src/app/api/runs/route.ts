import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  createPersonaSession,
  createRun,
  enqueueJob,
  getPersonaById,
  getWebsiteById,
} from '@nori/db';
import { createRunRequestSchema, runLimitsSchema, type ApiError } from '@nori/contracts';
import { UnauthorizedError, requireWorkspace } from '../../../lib/workspace-auth';

function errorResponse(error: ApiError, status: number) {
  return NextResponse.json(error, { status });
}

class WorkerCredentialHandoffError extends Error {}

function allowedOriginsForWebsite(origin: string): string[] {
  const websiteUrl = new URL(origin);
  const origins = new Set([websiteUrl.origin]);

  // A site entered as www.example.com commonly serves its own assets from cdn.example.com.
  // The worker already permits subdomains of each allowed origin, so adding the corresponding
  // apex here lets those sibling asset hosts render while preserving scheme, port, DNS, and
  // private-network checks. Only the conventional `www.` label is broadened this way.
  if (websiteUrl.hostname.startsWith('www.')) {
    const apexUrl = new URL(websiteUrl.origin);
    apexUrl.hostname = websiteUrl.hostname.slice(4);
    origins.add(apexUrl.origin);
  }

  return [...origins];
}

async function handCredentialToWorker(runToken: string, apiKey: string): Promise<void> {
  const workerUrl = (process.env.WORKER_INTERNAL_URL?.trim() || 'http://127.0.0.1:8081').replace(
    /\/$/,
    '',
  );
  const internalToken = process.env.WORKER_INTERNAL_TOKEN?.trim();
  try {
    const response = await fetch(`${workerUrl}/credentials`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(internalToken ? { authorization: `Bearer ${internalToken}` } : {}),
      },
      body: JSON.stringify({ runToken, apiKey }),
      signal: AbortSignal.timeout(4000),
      cache: 'no-store',
    });
    if (response.ok) return;
    throw new WorkerCredentialHandoffError(`worker credential handoff failed (${response.status})`);
  } catch (error) {
    if (error instanceof WorkerCredentialHandoffError) throw error;
    throw new WorkerCredentialHandoffError('worker credential handoff failed', {
      cause: error,
    });
  }
}

// Creates a real run: validates the request, verifies the target website belongs to the caller's
// workspace, creates one persona_session per requested persona (1-3, per
// createRunRequestSchema), and enqueues one job per session — the same sequence
// apps/worker/src/run-fixture-job.ts already uses to seed CLI-triggered runs, just reached from
// an HTTP request instead of a script. The standing worker (npm run dev:worker, with
// WORKER_AGENT_MODE=true + ANTHROPIC_API_KEY set) picks enqueued jobs up on its own; this route
// does not run anything itself.
export async function POST(request: NextRequest) {
  try {
    const workspace = await requireWorkspace();
    const body: unknown = await request.json().catch(() => null);
    const parsed = createRunRequestSchema.safeParse(body);
    if (!parsed.success) {
      const fields = [
        ...new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? 'run'))),
      ];
      const message = fields.includes('apiKey')
        ? 'Enter a valid Anthropic API key.'
        : fields.includes('personaIds')
          ? 'Choose between one and three perspectives.'
          : fields.includes('url')
            ? 'Enter a valid website URL.'
            : fields.includes('websiteId')
              ? 'Choose a website before beginning the run.'
              : `Check the ${fields.join(', ')} ${fields.length === 1 ? 'field' : 'fields'} and try again.`;
      console.warn('POST /api/runs rejected fields:', fields.join(', '));
      return errorResponse(
        {
          code: 'validation_failed',
          message,
          details: { issues: parsed.error.issues },
        },
        400,
      );
    }
    const { websiteId, url, task, personaIds, limits, idempotencyKey, apiKey } = parsed.data;

    const website = await getWebsiteById(workspace.id, websiteId);
    if (!website) {
      return errorResponse({ code: 'not_found', message: 'Website not found.' }, 404);
    }

    const personas = await Promise.all(personaIds.map((personaId) => getPersonaById(personaId)));
    const missingIndex = personas.findIndex((persona) => !persona);
    if (missingIndex !== -1) {
      return errorResponse(
        { code: 'not_found', message: `Persona not found: ${personaIds[missingIndex]}` },
        404,
      );
    }

    // Register before enqueueing so a job can never be claimed before its ephemeral credential
    // reaches the worker. The credential is held only in worker memory, keyed by this opaque run
    // token; it is not written to Postgres or returned by any API.
    if (apiKey) await handCredentialToWorker(idempotencyKey, apiKey);

    const run = await createRun(workspace.id, {
      websiteId,
      url,
      task,
      allowedOrigins: allowedOriginsForWebsite(website.origin),
      limits: runLimitsSchema.parse(limits ?? {}),
      idempotencyKey,
    });

    for (const persona of personas) {
      // Non-null: missingIndex check above already guaranteed every entry is present.
      const session = await createPersonaSession({
        runId: run.id,
        personaId: persona!.id,
        personaVersion: persona!.version,
        device: persona!.device,
      });
      await enqueueJob(run.id, session.id);
    }

    return NextResponse.json({ runId: run.id }, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return errorResponse({ code: 'unauthorized', message: error.message }, 401);
    }
    if (error instanceof WorkerCredentialHandoffError) {
      console.error(
        `POST /api/runs could not reach the worker credential endpoint: ${error.message}`,
      );
      return errorResponse(
        {
          code: 'internal_error',
          message: 'The journey worker is unavailable. Start it and try again.',
        },
        503,
      );
    }
    // A duplicate (workspace_id, idempotency_key) violates the unique constraint in
    // packages/db/src/migrations/001_init.sql — surface it as a clear conflict rather than a
    // generic 500, matching api/websites/route.ts's existing duplicate-handling pattern.
    if (error instanceof Error && 'code' in error && error.code === '23505') {
      return errorResponse(
        {
          code: 'idempotency_conflict',
          message: 'A run with this idempotency key already exists.',
        },
        409,
      );
    }
    console.error('POST /api/runs failed', error);
    return errorResponse({ code: 'internal_error', message: 'Unexpected error.' }, 500);
  }
}
