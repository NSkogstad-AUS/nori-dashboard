import {
  isValidRunTransition,
  type CancelRequestState,
  type Run,
  type RunLimits,
  type RunState,
} from '@nori/contracts';
import { getDb } from '../client';
import { rowToCamelCase } from '../row-mapping';

// Every function here takes workspaceId as a required parameter and scopes its WHERE clause on
// it, matching packages/db/src/queries/websites.ts's established pattern (see
// plan/PHASE_3_PLAN.md section 4.6's cross-workspace isolation test).

export interface CreateRunInput {
  websiteId: string;
  url: string;
  task: string;
  allowedOrigins: string[];
  limits: RunLimits;
  idempotencyKey: string;
}

export async function createRun(workspaceId: string, input: CreateRunInput): Promise<Run> {
  const sql = getDb();
  const [row] = await sql<Record<string, unknown>[]>`
    insert into runs (
      workspace_id, website_id, url, task, allowed_origins, limits, idempotency_key
    )
    values (
      ${workspaceId}, ${input.websiteId}, ${input.url}, ${input.task},
      ${sql.json(input.allowedOrigins)}, ${sql.json(input.limits)}, ${input.idempotencyKey}
    )
    returning id, workspace_id, website_id, url, task, allowed_origins, limits, state,
      cancel_request_state, idempotency_key, cost_total_usd, created_at, updated_at
  `;
  if (!row) {
    throw new Error(`createRun: insert returned no row for workspaceId ${workspaceId}`);
  }
  return rowToCamelCase<Run>(row);
}

export async function getRunById(workspaceId: string, runId: string): Promise<Run | null> {
  const sql = getDb();
  const [row] = await sql<Record<string, unknown>[]>`
    select id, workspace_id, website_id, url, task, allowed_origins, limits, state,
      cancel_request_state, idempotency_key, cost_total_usd, created_at, updated_at
    from runs
    where workspace_id = ${workspaceId} and id = ${runId}
  `;
  return row ? rowToCamelCase<Run>(row) : null;
}

/**
 * Fetches the run without workspace scoping — for internal worker/job-processing code that
 * already reached the run via a workspace-scoped job claim, not for anything reachable from a
 * client request. API routes must use getRunById instead.
 */
export async function getRunByIdUnscoped(runId: string): Promise<Run | null> {
  const sql = getDb();
  const [row] = await sql<Record<string, unknown>[]>`
    select id, workspace_id, website_id, url, task, allowed_origins, limits, state,
      cancel_request_state, idempotency_key, cost_total_usd, created_at, updated_at
    from runs
    where id = ${runId}
  `;
  return row ? rowToCamelCase<Run>(row) : null;
}

export async function getRunCancellationState(runId: string): Promise<CancelRequestState | null> {
  const sql = getDb();
  const [row] = await sql<{ cancel_request_state: CancelRequestState }[]>`
    select cancel_request_state from runs where id = ${runId}
  `;
  return row?.cancel_request_state ?? null;
}

export async function updateRunCancellationState(
  runId: string,
  from: CancelRequestState,
  to: CancelRequestState,
): Promise<void> {
  const allowed =
    (from === 'none' && to === 'cancel_requested') ||
    (from === 'cancel_requested' && to === 'cancelled');
  if (!allowed) {
    throw new Error(`updateRunCancellationState: invalid transition ${from} -> ${to}`);
  }
  const sql = getDb();
  const result = await sql`
    update runs set cancel_request_state = ${to}, updated_at = now()
    where id = ${runId} and cancel_request_state = ${from}
  `;
  if (result.count !== 1) {
    throw new Error(
      `updateRunCancellationState: no row updated for runId ${runId} (expected ${from})`,
    );
  }
}

/**
 * Validates the transition against packages/contracts' RUN_TRANSITIONS before writing it —
 * throws rather than silently persisting an invalid state change.
 */
export async function updateRunState(runId: string, from: RunState, to: RunState): Promise<Run> {
  if (!isValidRunTransition(from, to)) {
    throw new Error(`updateRunState: invalid run transition ${from} -> ${to}`);
  }
  const sql = getDb();
  const [row] = await sql<Record<string, unknown>[]>`
    update runs
    set state = ${to}, updated_at = now()
    where id = ${runId} and state = ${from}
    returning id, workspace_id, website_id, url, task, allowed_origins, limits, state,
      cancel_request_state, idempotency_key, cost_total_usd, created_at, updated_at
  `;
  if (!row) {
    throw new Error(
      `updateRunState: no row updated for runId ${runId} (expected current state ${from}) — ` +
        'concurrent update or run does not exist',
    );
  }
  return rowToCamelCase<Run>(row);
}
