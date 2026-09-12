import type { Step, StepAction, StepOutcome } from '@nori/contracts';
import { getDb } from '../client';
import { rowToCamelCase } from '../row-mapping';

export interface AppendStepInput {
  sessionId: string;
  action: StepAction;
  outcome: StepOutcome;
  urlBefore: string | null;
  urlAfter: string | null;
  observation: string | null;
}

/**
 * Appends the next step for a session, assigning `sequence` as one past the current max —
 * matches steps' (session_id, sequence) unique constraint (001_init.sql). Callers must not
 * append concurrently for the same session (the worker only ever runs one session at a time per
 * browser context, so this isn't a race in practice for Phase 4 — Phase 6's concurrent workers
 * would need a stronger guarantee, e.g. a DB-side sequence, if that changes).
 */
export async function appendStep(input: AppendStepInput): Promise<Step> {
  const sql = getDb();
  const [row] = await sql<Record<string, unknown>[]>`
    insert into steps (session_id, sequence, action, outcome, url_before, url_after, observation)
    values (
      ${input.sessionId},
      coalesce((select max(sequence) + 1 from steps where session_id = ${input.sessionId}), 0),
      ${input.action}, ${input.outcome}, ${input.urlBefore}, ${input.urlAfter}, ${input.observation}
    )
    returning id, session_id, sequence, action, outcome, url_before, url_after, observation,
      created_at
  `;
  if (!row) {
    throw new Error(`appendStep: insert returned no row for sessionId ${input.sessionId}`);
  }
  return rowToCamelCase<Step>({ ...row, artifact_ids: [] });
}

export async function listStepsForSession(sessionId: string): Promise<Step[]> {
  const sql = getDb();
  const rows = await sql<Record<string, unknown>[]>`
    select s.id, s.session_id, s.sequence, s.action, s.outcome, s.url_before, s.url_after,
      s.observation, s.created_at,
      coalesce(
        array_agg(sa.artifact_id) filter (where sa.artifact_id is not null),
        array[]::uuid[]
      ) as artifact_ids
    from steps s
    left join step_artifacts sa on sa.step_id = s.id
    where s.session_id = ${sessionId}
    group by s.id
    order by s.sequence asc
  `;
  return rows.map((row) => rowToCamelCase<Step>(row));
}
