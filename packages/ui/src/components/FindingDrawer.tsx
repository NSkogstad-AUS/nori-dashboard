'use client';

// Ports prototype/app.js `showFinding(index)`. Built on the shared Dialog component.

import { Dialog } from './Dialog';
import { FixtureModeBadge } from './FixtureModeBadge';

export interface FindingDrawerProps {
  open: boolean;
  onClose: () => void;
  stageName: string;
  title: string;
  personName: string;
  personEmoji: string;
  personColorClass: string;
  personRole: string;
  severity: string;
  observedFact: string;
  recommendation: string;
  previousStageName: string;
}

export function FindingDrawer({
  open,
  onClose,
  stageName,
  title,
  personName,
  personEmoji,
  personColorClass,
  personRole,
  severity,
  observedFact,
  recommendation,
  previousStageName,
}: FindingDrawerProps) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="finding-drawer-title">
      <button className="close circle" data-close aria-label="Close dialog" onClick={onClose}>
        ×
      </button>
      <span className="subtle">Fictional evidence / {stageName}</span>
      <h2 id="finding-drawer-title">{title}</h2>
      <div className="finding-person">
        <span className={`emoji ${personColorClass}`}>{personEmoji}</span>
        <span>
          {personName}, {personRole}
        </span>
        <span className="tag">{severity}</span>
      </div>
      <h3>What happened</h3>
      <p>{observedFact}</p>
      <div className="evidence-strip">
        <span>{previousStageName}</span> → <span className="flagged">{stageName} !</span> →{' '}
        <span>Pause</span>
      </div>
      <h3>A possible improvement</h3>
      <p>{recommendation}</p>
      <FixtureModeBadge variant="disclaimer">
        Illustrative finding, not a test result from your website.
      </FixtureModeBadge>
    </Dialog>
  );
}
