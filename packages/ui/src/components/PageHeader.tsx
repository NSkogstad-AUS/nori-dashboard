// Ports prototype/app.js `render()`'s `<header class="workspace-header">` and `.page-heading`
// blocks. See plan/PHASE_2_PLAN.md section 6 and section 8 (FixtureModeBadge usage).

import { FixtureModeBadge } from './FixtureModeBadge';

export interface PageHeaderProps {
  websiteName: string;
  sectionLabel: string;
  title: string;
  note: string;
  onNewRun: () => void;
  showHeading?: boolean;
}

export function PageHeader({
  websiteName,
  sectionLabel,
  title,
  note,
  onNewRun,
  showHeading = true,
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
      {showHeading && (
        <div className="page-heading">
          <div>
            <h1>{title}</h1>
            <p>{note}</p>
          </div>
        </div>
      )}
    </>
  );
}
