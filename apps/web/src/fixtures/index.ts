// Fixture-only. Illustrative data for the Journey Atlas sample workspace — ported from
// prototype/app.js and shaped to @nori/contracts schemas. See plan/PHASE_2_PLAN.md section 4.
//
// Nothing in this module fetches real data or calls a backend — it is a static, in-memory
// dataset for Phase 2's UI work, matching the master plan's "never present fixture data...
// as actual test results" rule.

import { workspaceId } from './ids';
import { personas } from './personas';
import { websites } from './websites';
import { runs } from './runs';
import { sessions } from './sessions';
import { steps } from './steps';
import { findings } from './findings';

export { workspaceId } from './ids';
export { personas } from './personas';
export { websites } from './websites';
export { runs } from './runs';
export { sessions } from './sessions';
export { steps } from './steps';
export { findings } from './findings';

export const fixtureDataset = {
  workspaceId,
  personas,
  websites,
  runs,
  sessions,
  steps,
  findings,
};

export type FixtureDataset = typeof fixtureDataset;
