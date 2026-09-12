// Pure derivation helpers bridging the real @nori/contracts entity shapes (Finding's
// personaSessionIds/stepIds arrays, Step.sequence) back into the "which persona, which stage"
// lookups the UI needs — analogous to prototype/app.js's `issueAt(person, stage)`, which could
// do this directly because its fixture arrays were flat [person][stage] matrices. See
// plan/PHASE_2_PLAN.md sections 4 and 5.
//
// Nothing here mutates or reshapes the fixture data — these are read-only lookups computed from
// the fixture dataset already built by the prior pass.

import type { Finding, PersonaSession, Step } from '@nori/contracts';
import { fixtureDataset } from '../fixtures/index';

const { personas, sessions, steps, findings } = fixtureDataset;

export const STAGE_NAMES = ['Discover', 'Explore', 'Sign up', 'Get started'] as const;

/** All persona sessions belonging to a given run, in fixture-roster order. */
export function sessionsForRun(runId: string): PersonaSession[] {
  return sessions.filter((session) => session.runId === runId);
}

/** The persona session for a given persona within a given run, if one exists. */
export function sessionForPersonaInRun(
  runId: string,
  personaId: string,
): PersonaSession | undefined {
  return sessions.find((session) => session.runId === runId && session.personaId === personaId);
}

/** Every step belonging to a session, ordered by `sequence`. */
export function stepsForSession(sessionId: string): Step[] {
  return steps
    .filter((step) => step.sessionId === sessionId)
    .sort((a, b) => a.sequence - b.sequence);
}

/** The step at a specific stage index (Step.sequence) within a session, if one exists. */
export function stepAtStage(sessionId: string, stageIndex: number): Step | undefined {
  return steps.find((step) => step.sessionId === sessionId && step.sequence === stageIndex);
}

/**
 * Looks up the Finding attached to a given persona's step at a given stage index, within a run —
 * the direct equivalent of the prototype's `issueAt(person, stage)`, which returned a findings
 * array index. Returns `undefined` when there is no finding at that step (the "continued
 * smoothly" case).
 */
export function findingAt(
  runId: string,
  personaId: string,
  stageIndex: number,
): Finding | undefined {
  const session = sessionForPersonaInRun(runId, personaId);
  if (!session) return undefined;
  const step = stepAtStage(session.id, stageIndex);
  if (!step) return undefined;
  return findings.find(
    (finding) =>
      finding.runId === runId &&
      finding.personaSessionIds.includes(session.id) &&
      finding.stepIds.includes(step.id),
  );
}

/** Count of findings anchored to a given run, for run/website summary counts. */
export function findingsForRun(runId: string): Finding[] {
  return findings.filter((finding) => finding.runId === runId);
}

/**
 * Findings whose steps include the given stage index (Step.sequence), across the whole fixture
 * dataset — used by the Home page's "where people pause" mini-stage summary, mirroring the
 * prototype's `findings.filter(item => item.stage === index)`.
 */
export function findingsAtStage(stageIndex: number): Finding[] {
  const stepIdsAtStage = new Set(
    steps.filter((step) => step.sequence === stageIndex).map((step) => step.id),
  );
  return findings.filter((finding) => finding.stepIds.some((id) => stepIdsAtStage.has(id)));
}

/** Resolves a Finding back to its persona (for rendering emoji/name/role in dialogs/drawers). */
export function personaForFinding(finding: Finding) {
  const sessionId = finding.personaSessionIds[0];
  const session = sessions.find((candidate) => candidate.id === sessionId);
  if (!session) return undefined;
  return personas.find((persona) => persona.id === session.personaId);
}

/** Resolves a Finding back to the stage index (Step.sequence) of its first referenced step. */
export function stageIndexForFinding(finding: Finding): number | undefined {
  const stepId = finding.stepIds[0];
  const step = steps.find((candidate) => candidate.id === stepId);
  return step?.sequence;
}

/** Human-readable stage name for a Finding, or undefined if it can't be resolved. */
export function stageNameForFinding(finding: Finding): string | undefined {
  const stageIndex = stageIndexForFinding(finding);
  return stageIndex === undefined ? undefined : STAGE_NAMES[stageIndex];
}

/** The observation text for a persona at a stage within a run (mirrors prototype's `actions`). */
export function observationAt(
  runId: string,
  personaId: string,
  stageIndex: number,
): string | null {
  const session = sessionForPersonaInRun(runId, personaId);
  if (!session) return null;
  const step = stepAtStage(session.id, stageIndex);
  return step?.observation ?? null;
}

/** True when a step outcome should be rendered as an error/blocked state in JourneyStep. */
export function isErrorOutcome(step: Step): boolean {
  return step.outcome === 'error' || step.outcome === 'blocked';
}
