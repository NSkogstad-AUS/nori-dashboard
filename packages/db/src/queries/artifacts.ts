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
  /** Defaults to the product's confirmed seven-day artifact-retention window. */
  expiresAt?: Date;
}

export async function createArtifact(input: CreateArtifactInput): Promise<Artifact> {
  const sql = getDb();
  const expiresAt = input.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
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

/** Returns an artifact only when its session belongs to the requested workspace. */
export async function getArtifactForWorkspace(
  workspaceId: string,
  artifactId: string,
): Promise<Artifact | null> {
  const sql = getDb();
  const [row] = await sql<Record<string, unknown>[]>`
    select a.id, a.session_id, a.step_id, a.storage_key, a.content_type, a.width, a.height,
      a.redacted, a.expires_at, a.created_at
    from artifacts a
    inner join persona_sessions ps on ps.id = a.session_id
    inner join runs r on r.id = ps.run_id
    where a.id = ${artifactId} and r.workspace_id = ${workspaceId}
    limit 1
  `;
  return row ? rowToCamelCase<Artifact>(row) : null;
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
