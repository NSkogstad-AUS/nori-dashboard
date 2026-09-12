// Ports prototype/app.js `node(person,stage)` — a single stage cell in the journey grid.
// Extends the prototype with a visibly distinct rendering for `outcome: 'error'|'blocked'` steps
// (plan/PHASE_2_PLAN.md section 7 — the injected fixture error step must be visibly reachable,
// not just theoretical).

export interface JourneyStepProps {
  personName: string;
  personEmoji: string;
  actionText: string;
  /** Undefined = no finding at this step ("continued smoothly"). */
  findingSeverity?: string;
  /** True for the fixture step(s) with outcome 'error'/'blocked'. */
  isErrorOutcome?: boolean;
  onlyIssues: boolean;
  onOpen: () => void;
}

export function JourneyStep({
  personName,
  personEmoji,
  actionText,
  findingSeverity,
  isErrorOutcome = false,
  onlyIssues,
  onOpen,
}: JourneyStepProps) {
  const hasIssue = Boolean(findingSeverity);

  if (onlyIssues && !hasIssue && !isErrorOutcome) {
    return <div className="quiet-node">✓ No flagged issue</div>;
  }

  if (isErrorOutcome) {
    return (
      <button type="button" className="journey-node has-error" onClick={onOpen}>
        <span className="node-top">
          <span>
            {personEmoji} {personName}
          </span>
          <span className="signal" role="img" aria-label="Error">
            ✕
          </span>
        </span>
        <strong>{actionText}</strong>
        <small role="alert">This step failed to complete</small>
      </button>
    );
  }

  return (
    <button type="button" className={`journey-node${hasIssue ? ' has-issue' : ''}`} onClick={onOpen}>
      <span className="node-top">
        <span>
          {personEmoji} {personName}
        </span>
        <span className={hasIssue ? 'signal' : 'okay'}>{hasIssue ? '!' : '✓'}</span>
      </span>
      <strong>{actionText}</strong>
      <small>{hasIssue ? `${findingSeverity} friction` : 'Continued smoothly'}</small>
    </button>
  );
}
