// Ports the `.person` button markup from prototype/app.js's `personaShelf()`.

export interface PersonaPillProps {
  id: string;
  name: string;
  emoji: string;
  /** When provided, rendered in place of the emoji avatar. */
  photoSrc?: string;
  role: string;
  colorClass: string;
  selected: boolean;
  /**
   * 'toggle' (Overview): clicking the selected pill deselects it (multi-select-like — only one
   * active at a time, but re-clicking clears it). 'single' (Live): clicking always selects,
   * never deselects — the prototype's click handler special-cases `state.mode==='live'` with
   * `state.person = state.mode==='live' ? person : (state.person===person ? null : person)`.
   */
  selectionMode: 'toggle' | 'single';
  onSelect: (id: string) => void;
  compact?: boolean;
}

export function PersonaPill({
  id,
  name,
  emoji,
  photoSrc,
  role,
  colorClass,
  selected,
  selectionMode,
  onSelect,
  compact = false,
}: PersonaPillProps) {
  const actionLabel =
    selectionMode === 'single'
      ? selected
        ? 'Watching'
        : 'Watch'
      : selected
        ? 'Selected'
        : 'Select';
  return (
    <article
      className={`person ${colorClass}${selected ? ' selected' : ''}${compact ? ' person-compact' : ''}`}
      data-person={id}
      aria-label={name}
    >
      <div className="person-portrait-reveal" aria-hidden={compact}>
        <div className="person-portrait-clip">
          <span className="person-photo-frame">
            <span className="person-heading">
              <strong>{name}</strong>
            </span>
            {photoSrc ? (
              <img src={photoSrc} alt="" className="person-photo" />
            ) : (
              <span className="emoji">{emoji}</span>
            )}
          </span>
        </div>
      </div>
      <span className="person-footer">
        <span className="person-identity">
          {photoSrc ? (
            <img src={photoSrc} alt="" className="person-avatar" />
          ) : (
            <span className="emoji person-identity-emoji">{emoji}</span>
          )}
          <span className="person-details">
            {compact && <strong className="person-compact-name">{name}</strong>}
            {!compact && <span className="person-role">{role}</span>}
          </span>
        </span>
        <button
          type="button"
          className="person-action"
          aria-label={`${actionLabel} ${name}`}
          aria-pressed={selected}
          onClick={() => onSelect(id)}
        >
          {actionLabel}
        </button>
      </span>
    </article>
  );
}
