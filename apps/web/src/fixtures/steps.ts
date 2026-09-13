// Fixture-only. Illustrative data for the Journey Atlas sample workspace — these are fictional
// step records, not a real browsing trace. See plan/PHASE_2_PLAN.md section 4.

import type { Step } from '@nori/contracts';
import { runs } from './runs';
import { sessionIds, stepIds, extraStepIds, type PersonaKey, type RunKey } from './ids';

type StepAction = Step['action'];

const PERSONA_KEYS: PersonaKey[] = ['alex', 'jamie', 'sam', 'riley'];
const RUN_KEYS: RunKey[] = ['run1', 'run2', 'run3', 'run4'];

// Ported from prototype/app.js `stages` + `actions[person][stage]`. actions is a flat matrix
// shared by every persona/run in the prototype (it isn't per-run data), so the same four
// observation sentences are reused for every run's four sessions here.
const STAGE_URLS = ['/', '/pricing', '/signup', '/workspace'];

const ACTIONS: Record<PersonaKey, [string, string, string, string]> = {
  alex: ['Lands on homepage', 'Compares plans', 'Looks for next step', 'Reaches workspace'],
  jamie: ['Opens pricing', 'Skims features', 'Creates an account', 'Finds first project'],
  sam: ['Reads the promise', 'Checks what’s included', 'Reviews the form', 'Opens the guide'],
  riley: [
    'Tabs through navigation',
    'Opens plan details',
    'Completes the form',
    'Finds keyboard focus',
  ],
};

// action per stage: mostly 'navigate'; the sign-up/form-completion stage reads more naturally
// as a 'click' (submitting/advancing a form), same for all personas at stage index 2.
const STAGE_ACTIONS: [StepAction, StepAction, StepAction, StepAction] = [
  'navigate',
  'navigate',
  'click',
  'navigate',
];

function originFor(runKey: RunKey): string {
  const run = runs.find((candidate) => candidate.id === runsByKey[runKey].id);
  return new URL(run!.url).origin;
}

const runsByKey: Record<RunKey, (typeof runs)[number]> = {
  run1: runs[0]!,
  run2: runs[1]!,
  run3: runs[2]!,
  run4: runs[3]!,
};

const FIXTURE_TIMESTAMP = '2026-09-12T10:45:00.000Z';

const baseSteps: Step[] = RUN_KEYS.flatMap((runKey) => {
  const origin = originFor(runKey);
  return PERSONA_KEYS.flatMap((personaKey) => {
    const sessionId = sessionIds[runKey][personaKey];
    return STAGE_URLS.map((path, stageIndex) => {
      const nextPath = STAGE_URLS[stageIndex + 1] ?? path;
      const step: Step = {
        id: stepIds[runKey][personaKey][stageIndex]!,
        sessionId,
        sequence: stageIndex,
        action: STAGE_ACTIONS[stageIndex]!,
        outcome: 'success',
        urlBefore: `${origin}${path}`,
        urlAfter: `${origin}${nextPath}`,
        observation: ACTIONS[personaKey][stageIndex]!,
        artifactIds: [],
        cursorX: null,
        cursorY: null,
        sessionState: 'exploring',
        createdAt: FIXTURE_TIMESTAMP,
      };
      return step;
    });
  });
});

// Extra step added specifically to exercise the 'error' outcome UI state (plan section 4 + 7):
// nothing in the prototype models a hard failure, so Phase 2 adds this to Riley's run1 session
// as a page-load failure on the "Get started" workspace page, appended after her normal
// 4-stage journey. Deliberately has no Finding attached — findings model friction, not hard
// failures, per the plan's framing.
const rileyRun1Origin = originFor('run1');
const rileyPageLoadErrorStep: Step = {
  id: extraStepIds.rileyPageLoadError,
  sessionId: sessionIds.run1.riley,
  sequence: 4,
  action: 'navigate',
  outcome: 'error',
  urlBefore: `${rileyRun1Origin}${STAGE_URLS[3]}`,
  urlAfter: null,
  observation: 'The workspace page failed to load after reaching the final step.',
  artifactIds: [],
  cursorX: null,
  cursorY: null,
  sessionState: 'exploring',
  createdAt: FIXTURE_TIMESTAMP,
};

export const steps: Step[] = [...baseSteps, rileyPageLoadErrorStep];
