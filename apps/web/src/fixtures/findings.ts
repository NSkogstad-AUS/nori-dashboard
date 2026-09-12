// Fixture-only. Illustrative data for the Journey Atlas sample workspace — these are fictional
// findings, not test results from any real website. See plan/PHASE_2_PLAN.md section 4.

import type { Finding } from '@nori/contracts';
import { runIds, sessionIds, stepIds, type PersonaKey } from './ids';

type FindingCategoryType = Finding['category'];

const FIXTURE_TIMESTAMP = '2026-09-12T10:50:00.000Z';

// All six findings below are anchored to run1 (the "First visit → first project" run, Acme) —
// the run the prototype's atlas/live view/detail dialogs treat as the canonical illustrative
// journey. Resolving (person, stage) into concrete uuids means looking up that persona's run1
// session and the step at that stage index.
const RUN_KEY = 'run1' as const;

function sessionFor(personaKey: PersonaKey): string {
  return sessionIds[RUN_KEY][personaKey];
}

function stepFor(personaKey: PersonaKey, stageIndex: number): string {
  return stepIds[RUN_KEY][personaKey][stageIndex]!;
}

// Ported from prototype/app.js `findings` array (person index -> persona key, stage index ->
// stage name: 0 Discover, 1 Explore, 2 Sign up, 3 Get started).
//
// category mapping is a judgment call per plan/PHASE_2_PLAN.md section 4's guidance — mapped
// against findingCategorySchema's five values (functional_issue, navigation_friction, clarity,
// accessibility_signal, performance_observation):
//   - "Plan differences are easy to miss" / "Too much detail before the decision" / "Trial
//     terms arrive too late" -> clarity (the content exists, but isn't easy to parse in time).
//   - "The next step is unclear" -> navigation_friction (the person can't tell where to go
//     next, a wayfinding problem rather than a comprehension one).
//   - "Focus skips the main navigation" / "The active control is hard to see" ->
//     accessibility_signal (both are keyboard/focus-visibility issues from Riley's session).
//
// confidence: fixed at 0.7 per the plan's suggestion, except the two keyboard-focus findings,
// bumped slightly to 0.8 since tab order and focus-ring visibility are more mechanically
// verifiable than "did this feel unclear" judgments (a difference the plan explicitly allows
// when genuinely justifiable).
export const findings: Finding[] = [
  {
    id: crypto.randomUUID(),
    runId: runIds[RUN_KEY],
    personaSessionIds: [sessionFor('alex')],
    stepIds: [stepFor('alex', 1)],
    artifactIds: [],
    category: 'clarity' satisfies FindingCategoryType,
    severity: 'moderate',
    confidence: 0.7,
    title: 'Plan differences are easy to miss',
    observedFact: 'Alex moved between two plan cards three times before finding the limits.',
    inferredExplanation: null,
    recommendation: 'Align the key limits in a short, scannable comparison.',
    reproductionSteps: [
      'Open the pricing page as Alex.',
      'Compare the Personal and Team plan cards.',
      'Note the back-and-forth needed to find the usage limits on each plan.',
    ],
    createdAt: FIXTURE_TIMESTAMP,
  },
  {
    id: crypto.randomUUID(),
    runId: runIds[RUN_KEY],
    personaSessionIds: [sessionFor('alex')],
    stepIds: [stepFor('alex', 2)],
    artifactIds: [],
    category: 'navigation_friction' satisfies FindingCategoryType,
    severity: 'high',
    confidence: 0.7,
    title: 'The next step is unclear',
    observedFact: 'Alex paused at the form footer and returned to the pricing page.',
    inferredExplanation:
      'The generic "Continue" label does not tell Alex what happens next, so returning to pricing feels safer than proceeding.',
    recommendation:
      'Replace “Continue” with a specific action and keep it beside the final field.',
    reproductionSteps: [
      'Open the sign-up form as Alex.',
      'Scroll to the form footer.',
      'Observe the return to the pricing page instead of submitting.',
    ],
    createdAt: FIXTURE_TIMESTAMP,
  },
  {
    id: crypto.randomUUID(),
    runId: runIds[RUN_KEY],
    personaSessionIds: [sessionFor('jamie')],
    stepIds: [stepFor('jamie', 1)],
    artifactIds: [],
    category: 'clarity' satisfies FindingCategoryType,
    severity: 'moderate',
    confidence: 0.7,
    title: 'Too much detail before the decision',
    observedFact: 'Jamie skimmed the feature list and searched for a summary.',
    inferredExplanation: null,
    recommendation: 'Lead with the three differences that help visitors choose.',
    reproductionSteps: [
      'Open the pricing page as Jamie.',
      'Skim the full feature list.',
      'Note the search for a shorter comparison before scrolling further.',
    ],
    createdAt: FIXTURE_TIMESTAMP,
  },
  {
    id: crypto.randomUUID(),
    runId: runIds[RUN_KEY],
    personaSessionIds: [sessionFor('sam')],
    stepIds: [stepFor('sam', 2)],
    artifactIds: [],
    category: 'clarity' satisfies FindingCategoryType,
    severity: 'moderate',
    confidence: 0.7,
    title: 'Trial terms arrive too late',
    observedFact: 'Sam left the form to look for billing information.',
    inferredExplanation: null,
    recommendation: 'Show the trial length and billing expectations before sign-up.',
    reproductionSteps: [
      'Open the sign-up form as Sam.',
      'Look for trial length or billing terms on the form.',
      'Observe the trip back to an earlier page to find that information.',
    ],
    createdAt: FIXTURE_TIMESTAMP,
  },
  {
    id: crypto.randomUUID(),
    runId: runIds[RUN_KEY],
    personaSessionIds: [sessionFor('riley')],
    stepIds: [stepFor('riley', 0)],
    artifactIds: [],
    category: 'accessibility_signal' satisfies FindingCategoryType,
    severity: 'high',
    confidence: 0.8,
    title: 'Focus skips the main navigation',
    observedFact: 'The illustrative keyboard path jumps from the logo to the footer.',
    inferredExplanation: null,
    recommendation: 'Use a predictable tab order and provide a skip-to-content link.',
    reproductionSteps: [
      'Load the homepage as Riley.',
      'Tab from the logo through the page.',
      'Observe focus landing on the footer before the main navigation.',
    ],
    createdAt: FIXTURE_TIMESTAMP,
  },
  {
    id: crypto.randomUUID(),
    runId: runIds[RUN_KEY],
    personaSessionIds: [sessionFor('riley')],
    stepIds: [stepFor('riley', 3)],
    artifactIds: [],
    category: 'accessibility_signal' satisfies FindingCategoryType,
    severity: 'high',
    confidence: 0.8,
    title: 'The active control is hard to see',
    observedFact: 'The sample focus indicator blends into the project card.',
    inferredExplanation: null,
    recommendation: 'Use a visible, high-contrast focus ring on every control.',
    reproductionSteps: [
      'Reach the workspace page as Riley.',
      'Tab onto the "Create a project" control.',
      'Observe the low-contrast focus ring against the project card.',
    ],
    createdAt: FIXTURE_TIMESTAMP,
  },
];
