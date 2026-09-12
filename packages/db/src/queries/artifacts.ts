import type { Artifact, ArtifactContentType } from '@nori/contracts';
import { getDb } from '../client';
import { rowToCamelCase } from '../row-mapping';

export interface CreateArtifactInput {
  sessionId: string;
  stepId: string | null;
  storageKey: string;
  contentType: ArtifactContentType;
  width: number;
  height: number;
  /** Defaults to 30 days from now — no retention policy has been decided yet; revisit once one
   *  is (see plan/PHASE_4_PLAN.md — artifact storage is local-filesystem-only for now). */
  expiresAt?: Date;
}

export async function createArtifact(input: CreateArtifactInput): Promise<Artifact> {
  const sql = getDb();
  const expiresAt = input.expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const [row] = await sql<Record<string, unknown>[]>`
    insert into artifacts (session_id, step_id, storage_key, content_type, width, height, expires_at)
    values (
      ${input.sessionId}, ${input.stepId}, ${input.storageKey}, ${input.contentType},
      ${input.width}, ${input.height}, ${expiresAt.toISOString()}
    )
    returning id, session_id, step_id, storage_key, content_type, width, height, redacted,
      expires_at, created_at
  `;
  if (!row) {
    throw new Error(`createArtifact: insert returned no row for sessionId ${input.sessionId}`);
  }
  return rowToCamelCase<Artifact>(row);
}

/**
 * Links an artifact to a step via the step_artifacts join table — a step's `artifactIds` (see
 * packages/db/src/queries/steps.ts's listStepsForSession) is populated from this join, not from
 * a direct column, since one artifact can in principle be referenced by multiple steps.
 */
export async function linkArtifactToStep(stepId: string, artifactId: string): Promise<void> {
  const sql = getDb();
  await sql`
    insert into step_artifacts (step_id, artifact_id)
    values (${stepId}, ${artifactId})
    on conflict do nothing
  `;
}
