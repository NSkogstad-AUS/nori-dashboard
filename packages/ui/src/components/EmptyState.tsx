// Generic reusable empty/error/loading/permission-denied state, per plan/PHASE_2_PLAN.md
// section 7's accessibility & states checklist — new work, since the prototype is fully
// synchronous and has no such states today. Used for: a website with zero runs, BrowserViewport's
// "artifact unavailable" placeholder, and is reusable for a future PermissionDeniedPanel without
// duplicating markup.

export type EmptyStateTone = 'empty' | 'error' | 'loading' | 'permission-denied';

export interface EmptyStateProps {
  tone?: EmptyStateTone;
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

const DEFAULT_ICON: Record<EmptyStateTone, string> = {
  empty: '◫',
  error: '✕',
  loading: '…',
  'permission-denied': '⊘',
};

export function EmptyState({ tone = 'empty', icon, title, description, action }: EmptyStateProps) {
  const role = tone === 'error' ? 'alert' : 'status';
  return (
    <div className={`empty-state empty-state-${tone}`} role={role}>
      <span className="empty-state-icon" aria-hidden="true">
        {icon ?? DEFAULT_ICON[tone]}
      </span>
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action ? <div className="empty-state-action">{action}</div> : null}
    </div>
  );
}
