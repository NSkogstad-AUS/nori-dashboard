// Fixture-only. Illustrative data for the Journey Atlas sample workspace — these are fictional
// persona sessions, not real agent executions. See plan/PHASE_2_PLAN.md section 4.

import type { PersonaSession } from '@nori/contracts';
import { personas } from './personas';
import { personaIds, runIds, sessionIds, type PersonaKey, type RunKey } from './ids';

const personaByKey: Record<PersonaKey, (typeof personas)[number]> = {
  alex: personas[0]!,
  jamie: personas[1]!,
  sam: personas[2]!,
  riley: personas[3]!,
};

const PERSONA_KEYS: PersonaKey[] = ['alex', 'jamie', 'sam', 'riley'];
const RUN_KEYS: RunKey[] = ['run1', 'run2', 'run3', 'run4'];

const FIXTURE_TIMESTAMP = '2026-09-12T10:42:00.000Z';

// One PersonaSession per persona per run (plan/PHASE_2_PLAN.md section 4): the prototype's
// runs don't carry their own per-persona data, so every run's four sessions are built from the
// same underlying persona roster and are all 'completed'.
export const sessions: PersonaSession[] = RUN_KEYS.flatMap((runKey) =>
  PERSONA_KEYS.map((personaKey) => {
    const persona = personaByKey[personaKey];
    const session: PersonaSession = {
      id: sessionIds[runKey][personaKey],
      runId: runIds[runKey],
      personaId: personaIds[personaKey],
      personaVersion: persona.version,
      attempt: 0,
      device: persona.device,
      state: 'completed',
      heartbeatAt: null,
      createdAt: FIXTURE_TIMESTAMP,
      updatedAt: FIXTURE_TIMESTAMP,
    };
    return session;
  }),
);
