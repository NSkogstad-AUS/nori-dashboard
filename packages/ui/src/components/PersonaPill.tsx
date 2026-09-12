// Ports the `.person` button markup from prototype/app.js's `personaShelf()`.

export interface PersonaPillProps {
  id: string;
  name: string;
  emoji: string;
  /** When provided, rendered in place of the emoji avatar. */
  photoSrc?: string;
  role: string;
  colorClass: string;
  issues: number;
  selected: boolean;
  /**
   * 'toggle' (Overview): clicking the selected pill deselects it (multi-select-like — only one
   * active at a time, but re-clicking clears it). 'single' (Live): clicking always selects,
   * never deselects — the prototype's click handler special-cases `state.mode==='live'` with
   * `state.person = state.mode==='live' ? person : (state.person===person ? null : person)`.
   */
  selectionMode: 'toggle' | 'single';
  onSelect: (id: string) => void;
}

export function PersonaPill({
  id,
  name,
  emoji,
  photoSrc,
  role,
  colorClass,
  issues,
  selected,
  selectionMode,
  onSelect,
}: PersonaPillProps) {
  const hasIssues = issues > 0;
  const actionLabel =
    selectionMode === 'single' ? (selected ? 'Watching' : 'Watch') : selected ? 'Selected' : 'Select';
  return (
    <button
      type="button"
      className={`person ${colorClass}${selected ? ' selected' : ''}${hasIssues ? ' has-issues' : ''}`}
      data-person={id}
      aria-pressed={selected}
      onClick={() => onSelect(id)}
    >
      <span className="person-photo-frame">
        {photoSrc ? (
          <img src={photoSrc} alt="" className="person-photo" />
        ) : (
          <span className="emoji">{emoji}</span>
        )}
      </span>
      <span className="person-overlay-top">
        <strong>{name}</strong>
        <small>{role}</small>
      </span>
      <span className="person-overlay-bottom">
        <span className="person-identity">
          <span className="emoji person-identity-emoji">{emoji}</span>
          <span
            className={hasIssues ? 'signal' : undefined}
            aria-label={`${issues} potential ${issues === 1 ? 'issue' : 'issues'}`}
          >
            {hasIssues ? `${issues} ${issues === 1 ? 'issue' : 'issues'}` : 'No issues'}
          </span>
        </span>
        <span className="person-action">{actionLabel}</span>
      </span>
    </button>
  );
}
