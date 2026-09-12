// Ports prototype/app.js `render()`'s `<header class="workspace-header">` and `.page-heading`
// blocks. See plan/PHASE_2_PLAN.md section 6 and section 8 (FixtureModeBadge usage).

import { FixtureModeBadge } from './FixtureModeBadge';

export interface PageHeaderProps {
  websiteName: string;
  sectionLabel: string;
  eyebrow: string;
  title: string;
  note: string;
  onNewRun: () => void;
}

export function PageHeader({
  websiteName,
  sectionLabel,
  eyebrow,
  title,
  note,
  onNewRun,
}: PageHeaderProps) {
  return (
    <>
      <header className="workspace-header">
        <span>
          {websiteName} <span className="muted">/ {sectionLabel}</span>
        </span>
        <div>
          <FixtureModeBadge variant="badge" />
          <button type="button" className="dark pill" onClick={onNewRun}>
            ＋ New run
          </button>
        </div>
      </header>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{note}</p>
        </div>
      </div>
    </>
  );
}
