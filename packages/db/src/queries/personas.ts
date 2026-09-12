import type { Persona } from '@nori/contracts';
import { getDb } from '../client';
import { rowToCamelCase } from '../row-mapping';

// Personas are not workspace-scoped (see packages/contracts/src/entities.ts — personaSchema has
// no workspaceId) — they're a shared library, matching 001_init.sql's `personas` table having no
// workspace_id column. Real persona authoring is Phase 5's job; this phase only needs a single
// placeholder "system" persona to satisfy persona_sessions.persona_id for the fixture job.

export async function getPersonaById(id: string): Promise<Persona | null> {
  const sql = getDb();
  const [row] = await sql<Record<string, unknown>[]>`
    select id, name, version, emoji, goal, behavior, device, limitations, created_at
    from personas
    where id = ${id}
  `;
  return row ? rowToCamelCase<Persona>(row) : null;
}

export interface EnsureSystemPersonaOptions {
  name?: string;
}

export async function ensureAlexPersona(): Promise<Persona> {
  const sql = getDb();
  const device = {
    viewportWidth: 1280,
    viewportHeight: 800,
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    reducedMotion: false,
  };
  const [row] = await sql<Record<string, unknown>[]>`
    insert into personas (name, version, emoji, goal, behavior, device, limitations)
    values (
      'Alex',
      1,
      '🧑‍🦱',
      'Complete the assigned task as a first-time visitor.',
      'Explores a website with no prior context, takes visible content at face value, and uses
       the clearest apparent path before committing to the next step.',
      ${sql.json(device)},
      ${sql.json(['Has no prior knowledge of the website or its navigation.'])}
    )
    on conflict (name, version) do update set
      goal = excluded.goal,
      behavior = excluded.behavior,
      device = excluded.device,
      limitations = excluded.limitations
    returning id, name, version, emoji, goal, behavior, device, limitations, created_at
  `;
  if (!row) throw new Error('ensureAlexPersona: insert returned no row');
  return rowToCamelCase<Persona>(row);
}

/**
 * Ensures a single placeholder persona exists for Phase 4's fixed (non-model-driven) fixture
 * job, upserting on (name, version) — the table's existing unique constraint. Not meant for real
 * persona authoring; Phase 5 replaces this with a real persona library.
 */
export async function ensureSystemPersona(
  options: EnsureSystemPersonaOptions = {},
): Promise<Persona> {
  const sql = getDb();
  const name = options.name ?? 'Phase 4 Fixture Runner';
  const device = {
    viewportWidth: 1280,
    viewportHeight: 800,
    userAgent: 'Nori-Phase4-FixtureRunner/1.0',
    reducedMotion: true,
  };
  const [row] = await sql<Record<string, unknown>[]>`
    insert into personas (name, version, emoji, goal, behavior, device, limitations)
    values (
      ${name},
      1,
      '🤖',
      'Complete a fixed, deterministic sequence of actions against the fixture site.',
      'Follows a hand-written script exactly; does not make judgment calls. Placeholder for
       Phase 4 only — Phase 5 replaces this with real model-driven personas.',
      ${sql.json(device)},
      ${sql.json([])}
    )
    on conflict (name, version) do update set name = excluded.name
    returning id, name, version, emoji, goal, behavior, device, limitations, created_at
  `;
  if (!row) {
    throw new Error('ensureSystemPersona: insert returned no row');
  }
  return rowToCamelCase<Persona>(row);
}
