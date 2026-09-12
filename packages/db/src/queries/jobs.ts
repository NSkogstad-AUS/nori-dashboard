import { getDb } from '../client';
import { rowToCamelCase } from '../row-mapping';

// Matches packages/db/src/migrations/002_queue.sql's jobs table — one job per persona session
// (unique(session_id)), claimed via `select ... for update skip locked` so concurrent workers
// never claim the same job twice. Phase 4 only ever runs one worker/one job at a time by hand;
// Phase 6 is what makes this safe under real concurrency, but the claim query itself is written
// to be correct under concurrency from the start rather than retrofitted later.

export type JobStatus = 'pending' | 'leased' | 'completed' | 'failed' | 'cancelled';

export interface Job {
  id: string;
  runId: string;
  sessionId: string;
  status: JobStatus;
  attempt: number;
  maxAttempts: number;
  availableAt: string;
  leasedBy: string | null;
  leasedUntil: string | null;
  lastHeartbeatAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function enqueueJob(runId: string, sessionId: string): Promise<Job> {
  const sql = getDb();
  const [row] = await sql<Record<string, unknown>[]>`
    insert into jobs (run_id, session_id)
    values (${runId}, ${sessionId})
    returning id, run_id, session_id, status, attempt, max_attempts, available_at, leased_by,
      leased_until, last_heartbeat_at, last_error, created_at, updated_at
  `;
  if (!row) {
    throw new Error(`enqueueJob: insert returned no row for sessionId ${sessionId}`);
  }
  return rowToCamelCase<Job>(row);
}

/**
 * Claims one pending, available job for `workerId` using `select ... for update skip locked` —
 * concurrent callers never see the same row, and a locked-but-not-yet-committed row is skipped
 * rather than blocking. Sets a lease for `leaseSeconds` and bumps `attempt`.
 */
export async function claimNextJob(workerId: string, leaseSeconds = 60): Promise<Job | null> {
  const sql = getDb();
  const rows = await sql<Record<string, unknown>[]>`
    with claimed as (
      select id from jobs
      where status = 'pending' and available_at <= now()
      order by available_at asc
      limit 1
      for update skip locked
    )
    update jobs
    set status = 'leased',
        attempt = jobs.attempt + 1,
        leased_by = ${workerId},
        leased_until = now() + (${leaseSeconds} || ' seconds')::interval,
        last_heartbeat_at = now(),
        updated_at = now()
    from claimed
    where jobs.id = claimed.id
    returning jobs.id, jobs.run_id, jobs.session_id, jobs.status, jobs.attempt,
      jobs.max_attempts, jobs.available_at, jobs.leased_by, jobs.leased_until,
      jobs.last_heartbeat_at, jobs.last_error, jobs.created_at, jobs.updated_at
  `;
  const [row] = rows;
  return row ? rowToCamelCase<Job>(row) : null;
}

export async function claimJobById(
  jobId: string,
  workerId: string,
  leaseSeconds = 60,
): Promise<Job | null> {
  const sql = getDb();
  const [row] = await sql<Record<string, unknown>[]>`
    update jobs
    set status = 'leased',
        attempt = attempt + 1,
        leased_by = ${workerId},
        leased_until = now() + (${leaseSeconds} || ' seconds')::interval,
        last_heartbeat_at = now(),
        updated_at = now()
    where id = ${jobId} and status = 'pending' and available_at <= now()
    returning id, run_id, session_id, status, attempt, max_attempts, available_at, leased_by,
      leased_until, last_heartbeat_at, last_error, created_at, updated_at
  `;
  return row ? rowToCamelCase<Job>(row) : null;
}

export async function heartbeatJob(jobId: string, leaseSeconds = 60): Promise<void> {
  const sql = getDb();
  await sql`
    update jobs
    set last_heartbeat_at = now(),
        leased_until = now() + (${leaseSeconds} || ' seconds')::interval,
        updated_at = now()
    where id = ${jobId}
  `;
}

export async function completeJob(jobId: string): Promise<void> {
  const sql = getDb();
  await sql`
    update jobs
    set status = 'completed', updated_at = now()
    where id = ${jobId}
  `;
}

export async function failJob(jobId: string, error: string): Promise<void> {
  const sql = getDb();
  await sql`
    update jobs
    set status = 'failed', last_error = ${error}, updated_at = now()
    where id = ${jobId}
  `;
}

export async function cancelJob(jobId: string, reason: string): Promise<void> {
  const sql = getDb();
  await sql`
    update jobs
    set status = 'cancelled', last_error = ${reason}, leased_until = null, updated_at = now()
    where id = ${jobId}
  `;
}
