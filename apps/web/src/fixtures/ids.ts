// Fixture-only. Illustrative data for the Journey Atlas sample workspace — not real records.
//
// Central place to mint the fixture dataset's uuids. Using `crypto.randomUUID()` at module load
// (rather than hand-typed literal uuid strings) avoids the risk of a typo producing a
// non-uuid-shaped string that would fail the @nori/contracts zod `.uuid()` checks, while still
// giving every other fixture file a single stable reference to import from — the ids are stable
// for the lifetime of the process/module graph, which is all fixture data needs.

export const workspaceId = crypto.randomUUID();

export const websiteIds = {
  acme: crypto.randomUUID(),
  forma: crypto.randomUUID(),
  orbit: crypto.randomUUID(),
} as const;

export const personaIds = {
  alex: crypto.randomUUID(),
  jamie: crypto.randomUUID(),
  sam: crypto.randomUUID(),
  riley: crypto.randomUUID(),
} as const;

export type PersonaKey = keyof typeof personaIds;

export const runIds = {
  run1: crypto.randomUUID(),
  run2: crypto.randomUUID(),
  run3: crypto.randomUUID(),
  run4: crypto.randomUUID(),
} as const;

export type RunKey = keyof typeof runIds;

// One PersonaSession per persona per run (plan/PHASE_2_PLAN.md section 4): the prototype's
// actions/stages matrix is indexed by [person][stage] only, with no per-run variation, so every
// run's four sessions render the same underlying illustrative journey content.
export const sessionIds: Record<RunKey, Record<PersonaKey, string>> = {
  run1: {
    alex: crypto.randomUUID(),
    jamie: crypto.randomUUID(),
    sam: crypto.randomUUID(),
    riley: crypto.randomUUID(),
  },
  run2: {
    alex: crypto.randomUUID(),
    jamie: crypto.randomUUID(),
    sam: crypto.randomUUID(),
    riley: crypto.randomUUID(),
  },
  run3: {
    alex: crypto.randomUUID(),
    jamie: crypto.randomUUID(),
    sam: crypto.randomUUID(),
    riley: crypto.randomUUID(),
  },
  run4: {
    alex: crypto.randomUUID(),
    jamie: crypto.randomUUID(),
    sam: crypto.randomUUID(),
    riley: crypto.randomUUID(),
  },
};

// Steps: one per (session, stage) pair, 4 stages per session => 16 sessions * 4 = 64 base steps,
// keyed the same way as sessionIds. A couple of additional error/blocked steps (not part of this
// per-stage grid) are minted separately in steps.ts.
export const stepIds: Record<RunKey, Record<PersonaKey, [string, string, string, string]>> = {
  run1: {
    alex: [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()],
    jamie: [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()],
    sam: [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()],
    riley: [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()],
  },
  run2: {
    alex: [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()],
    jamie: [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()],
    sam: [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()],
    riley: [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()],
  },
  run3: {
    alex: [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()],
    jamie: [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()],
    sam: [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()],
    riley: [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()],
  },
  run4: {
    alex: [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()],
    jamie: [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()],
    sam: [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()],
    riley: [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()],
  },
};

// Extra steps added specifically to exercise 'error'/'blocked' outcome UI states (plan section
// 4 + section 7), since nothing in the prototype models a hard failure. Attached to run1 (Acme),
// Riley's session, as an extra step appended after her normal 4-stage journey — representing a
// page-load failure on the "Get started" workspace page. No Finding references this step:
// findings model friction, not hard failures, per the plan.
export const extraStepIds = {
  rileyPageLoadError: crypto.randomUUID(),
};
