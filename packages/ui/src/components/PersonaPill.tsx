'use client';

// Ports the `.person` button markup from prototype/app.js's `personaShelf()`.

import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

export interface PersonaPillProps {
  id: string;
  name: string;
  emoji: string;
  /** When provided, rendered in place of the emoji avatar. */
  photoSrc?: string;
  widePhotoSrc?: string;
  role: string;
  behavior: string;
  colorClass: string;
  selected: boolean;
  /**
   * 'toggle' (Overview): clicking the selected pill deselects it (multi-select-like — only one
   * active at a time, but re-clicking clears it). 'single' (Live): clicking always selects,
   * never deselects — the prototype's click handler special-cases `state.mode==='live'` with
   * `state.person = state.mode==='live' ? person : (state.person===person ? null : person)`.
   * Clicking either the photo or the "Select"/"Watch" action triggers the same select-and-expand
   * behavior — there is only one persona selected/expanded at a time.
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
  widePhotoSrc,
  role,
  behavior,
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

  // Subtle parallax: nudges the photo a couple of pixels toward the pointer within its frame.
  // Kept as a direct style write (not React state) so hovering doesn't trigger re-renders, and
  // the CSS transition on .person-photo (gated behind prefers-reduced-motion, see motion.css)
  // smooths it into an "almost unnoticeable" drift rather than a snap. Skipped entirely when the
  // user prefers reduced motion, matching every other motion effect in this app.
  const frameRef = useRef<HTMLSpanElement>(null);
  const handlePointerMove = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const frame = frameRef.current;
    if (!frame) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const bounds = frame.getBoundingClientRect();
    const offsetX = (event.clientX - bounds.left) / bounds.width - 0.5;
    const offsetY = (event.clientY - bounds.top) / bounds.height - 0.5;
    frame.style.setProperty('--parallax-x', `${(offsetX * -6).toFixed(2)}px`);
    frame.style.setProperty('--parallax-y', `${(offsetY * -6).toFixed(2)}px`);
  };
  const resetParallax = () => {
    const frame = frameRef.current;
    if (!frame) return;
    frame.style.setProperty('--parallax-x', '0px');
    frame.style.setProperty('--parallax-y', '0px');
  };

  return (
    <article
      className={`person ${colorClass}${selected ? ' selected' : ''}${compact ? ' person-compact' : ''}`}
      data-person={id}
      aria-label={name}
    >
      <div className="person-portrait-reveal" aria-hidden={compact}>
        <div className="person-portrait-clip">
          <span
            className="person-photo-frame"
            ref={frameRef}
            onPointerMove={handlePointerMove}
            onPointerLeave={resetParallax}
          >
            <button
              type="button"
              className="person-portrait-select"
              aria-label={`${actionLabel} ${name}`}
              aria-pressed={selected}
              tabIndex={compact ? -1 : 0}
              onClick={() => onSelect(id)}
            />
            {photoSrc ? (
              <img src={widePhotoSrc ?? photoSrc} alt="" className="person-photo" />
            ) : (
              <span className="emoji">{emoji}</span>
            )}
            <span className="person-portrait-left">
              <span className="person-heading">
                <strong>{name}</strong>
              </span>
            </span>
            <span className="person-profile" aria-hidden={!selected || compact}>
              <strong>{role}</strong>
              <span>{behavior}</span>
            </span>
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
