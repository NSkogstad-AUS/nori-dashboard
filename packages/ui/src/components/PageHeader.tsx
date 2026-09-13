// Ports prototype/app.js `render()`'s `<header class="workspace-header">` and `.page-heading`
// blocks. See plan/PHASE_2_PLAN.md section 6.

export interface PageHeaderProps {
  websiteName: string;
  sectionLabel: string;
  title: string;
  note: string;
  showHeading?: boolean;
}

export function PageHeader({
  websiteName,
  sectionLabel,
  title,
  note,
  showHeading = true,
}: PageHeaderProps) {
  return (
    <>
      <header className="workspace-header">
        <span>
          {websiteName} <span className="muted">/ {sectionLabel}</span>
        </span>
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
