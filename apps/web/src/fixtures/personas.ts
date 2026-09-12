// Fixture-only. Illustrative data for the Journey Atlas sample workspace — these are fictional
// AI personas, not real user research. See plan/PHASE_2_PLAN.md section 4.

import type { Persona } from '@nori/contracts';
import { personaIds } from './ids';

// `behavior` has no equivalent in prototype/app.js's `people` array — each sentence below is
// invented for this fixture pass, written to stay consistent with the persona's existing `role`.
export const personas: Persona[] = [
  {
    id: personaIds.alex,
    name: 'Alex',
    version: 1,
    emoji: '🧑‍🦱',
    goal: 'First-time visitor',
    behavior:
      'Explores a website for the first time with no prior context, comparing options at face value before committing to any next step.',
    device: {
      viewportWidth: 1440,
      viewportHeight: 900,
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      reducedMotion: false,
    },
    limitations: [],
  },
  {
    id: personaIds.jamie,
    name: 'Jamie',
    version: 1,
    emoji: '👩‍💻',
    goal: 'Busy professional',
    behavior:
      'Moves quickly and skims content for the shortest path to a decision, abandoning anything that takes too long to summarize.',
    device: {
      viewportWidth: 1440,
      viewportHeight: 900,
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      reducedMotion: false,
    },
    limitations: [],
  },
  {
    id: personaIds.sam,
    name: 'Sam',
    version: 1,
    emoji: '🧔',
    goal: 'Careful evaluator',
    behavior:
      'Reads every detail before acting, double-checking terms and commitments and backtracking to earlier pages when information feels incomplete.',
    device: {
      viewportWidth: 1440,
      viewportHeight: 900,
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      reducedMotion: false,
    },
    limitations: [],
  },
  {
    id: personaIds.riley,
    name: 'Riley',
    version: 1,
    emoji: '👩‍🦽',
    goal: 'Keyboard-first visitor',
    behavior:
      'Navigates entirely by keyboard, relying on a predictable tab order and a visible focus indicator to move through every page.',
    device: {
      viewportWidth: 1440,
      viewportHeight: 900,
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      reducedMotion: true,
    },
    limitations: [],
  },
];
