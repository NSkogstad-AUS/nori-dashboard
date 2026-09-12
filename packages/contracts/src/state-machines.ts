// State machines from plan/IMPLEMENTATION_PLAN.md section 5.

export const RUN_STATES = [
  'queued',
  'running',
  'analysing',
  'completed',
  'completed_with_errors',
  'failed',
  'cancelled',
] as const;
export type RunState = (typeof RUN_STATES)[number];

export const RUN_TERMINAL_STATES: readonly RunState[] = [
  'completed',
  'completed_with_errors',
  'failed',
  'cancelled',
];

export const RUN_TRANSITIONS: Record<RunState, readonly RunState[]> = {
  queued: ['running', 'cancelled', 'failed'],
  running: ['analysing', 'completed_with_errors', 'failed', 'cancelled'],
  analysing: ['completed', 'completed_with_errors', 'failed'],
  completed: [],
  completed_with_errors: [],
  failed: [],
  cancelled: [],
};

export function isValidRunTransition(from: RunState, to: RunState): boolean {
  return RUN_TRANSITIONS[from].includes(to);
}

export const CANCEL_REQUEST_STATES = ['none', 'cancel_requested', 'cancelled'] as const;
export type CancelRequestState = (typeof CANCEL_REQUEST_STATES)[number];

export const SESSION_STATES = [
  'queued',
  'starting',
  'exploring',
  'analysing',
  'completed',
  'failed',
  'cancelled',
] as const;
export type SessionState = (typeof SESSION_STATES)[number];

export const SESSION_TERMINAL_STATES: readonly SessionState[] = [
  'completed',
  'failed',
  'cancelled',
];

export const SESSION_TRANSITIONS: Record<SessionState, readonly SessionState[]> = {
  queued: ['starting', 'cancelled', 'failed'],
  starting: ['exploring', 'failed', 'cancelled'],
  exploring: ['analysing', 'failed', 'cancelled'],
  analysing: ['completed', 'failed'],
  completed: [],
  failed: [],
  cancelled: [],
};

export function isValidSessionTransition(from: SessionState, to: SessionState): boolean {
  return SESSION_TRANSITIONS[from].includes(to);
}

/**
 * Reduces per-persona session outcomes to a single run outcome.
 * Any session failure downgrades a run from `completed` to `completed_with_errors`;
 * a run only fails outright if every session failed or was cancelled.
 */
export function deriveRunOutcomeFromSessions(
  sessionStates: readonly SessionState[],
): 'completed' | 'completed_with_errors' | 'failed' {
  if (sessionStates.length === 0) return 'failed';
  const succeeded = sessionStates.filter((s) => s === 'completed').length;
  if (succeeded === sessionStates.length) return 'completed';
  if (succeeded === 0) return 'failed';
  return 'completed_with_errors';
}
