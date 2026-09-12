import {
  isValidSessionTransition,
  type PersonaDeviceSettings,
  type PersonaSession,
  type SessionFailureKind,
  type SessionState,
} from '@nori/contracts';
import { getDb } from '../client';
import { rowToCamelCase } from '../row-mapping';

// Not workspace-scoped directly — persona_sessions belong to a run, which is workspace-scoped
// (see runs.ts). Callers that need workspace isolation should resolve the run via
// getRunById(workspaceId, runId) first, matching how runs.ts itself is used.

export interface CreatePersonaSessionInput {
  runId: string;
  personaId: string;
  personaVersion: number;
  device: PersonaDeviceSettings;
}

export async function createPersonaSession(
  input: CreatePersonaSessionInput,
): Promise<PersonaSession> {
  const sql = getDb();
  const [row] = await sql<Record<string, unknown>[]>`
    insert into persona_sessions (run_id, persona_id, persona_version, device)
    values (${input.runId}, ${input.personaId}, ${input.personaVersion}, ${sql.json(input.device)})
    returning id, run_id, persona_id, persona_version, attempt, device, state, failure_kind,
      failure_message, heartbeat_at, created_at, updated_at
  `;
  if (!row) {
    throw new Error(`createPersonaSession: insert returned no row for runId ${input.runId}`);
  }
  return rowToCamelCase<PersonaSession>(row);
}

export async function getPersonaSessionById(sessionId: string): Promise<PersonaSession | null> {
  const sql = getDb();
  const [row] = await sql<Record<string, unknown>[]>`
    select id, run_id, persona_id, persona_version, attempt, device, state, failure_kind,
      failure_message, heartbeat_at, created_at, updated_at
    from persona_sessions
    where id = ${sessionId}
  `;
  return row ? rowToCamelCase<PersonaSession>(row) : null;
}

/**
 * Validates the transition against packages/contracts' SESSION_TRANSITIONS before writing it —
 * throws rather than silently persisting an invalid state change.
 */
export async function updateSessionState(
  sessionId: string,
  from: SessionState,
  to: SessionState,
): Promise<PersonaSession> {
  if (!isValidSessionTransition(from, to)) {
    throw new Error(`updateSessionState: invalid session transition ${from} -> ${to}`);
  }
  const sql = getDb();
  const [row] = await sql<Record<string, unknown>[]>`
    update persona_sessions
    set state = ${to}, updated_at = now()
    where id = ${sessionId} and state = ${from}
    returning id, run_id, persona_id, persona_version, attempt, device, state, failure_kind,
      failure_message, heartbeat_at, created_at, updated_at
  `;
  if (!row) {
    throw new Error(
      `updateSessionState: no row updated for sessionId ${sessionId} (expected current state ` +
        `${from}) — concurrent update or session does not exist`,
    );
  }
  return rowToCamelCase<PersonaSession>(row);
}

export async function touchHeartbeat(sessionId: string): Promise<void> {
  const sql = getDb();
  await sql`
    update persona_sessions
    set heartbeat_at = now(), updated_at = now()
    where id = ${sessionId}
  `;
}

export async function recordSessionFailure(
  sessionId: string,
  kind: SessionFailureKind,
  message: string,
): Promise<void> {
  const sql = getDb();
  await sql`
    update persona_sessions
    set failure_kind = ${kind}, failure_message = ${message.slice(0, 2000)}, updated_at = now()
    where id = ${sessionId}
  `;
}
