'use client';

import { useState } from 'react';

// Adapted from a product-card pattern (photo, follow-style toggle, title/detail row, action
// button) into a persona card for Nori's persona library. Uses the existing plain-CSS token
// system (packages/ui/src/styles/components.css) rather than Tailwind — this package has no
// Tailwind/lucide-react/motion dependency, and a plain <img> rather than next/image since
// packages/ui stays framework-agnostic (consumers like apps/web decide on image optimization).

export interface PersonaCardProps {
  name: string;
  goal: string;
  behavior: string;
  emoji: string;
  photoSrc: string;
  /** Whether this persona is currently included in the active journey/run. */
  attached: boolean;
  onToggleAttached: () => void;
  onViewDetails?: () => void;
}

export function PersonaCard({
  name,
  goal,
  behavior,
  emoji,
  photoSrc,
  attached,
  onToggleAttached,
  onViewDetails,
}: PersonaCardProps) {
  const [justToggled, setJustToggled] = useState(false);

  const handleToggle = () => {
    onToggleAttached();
    setJustToggled(true);
    window.setTimeout(() => setJustToggled(false), 200);
  };

  return (
    <div className="persona-card">
      <div className="persona-card-photo">
        <button
          type="button"
          className={`persona-card-attach${attached ? ' attached' : ''}${justToggled ? ' just-toggled' : ''}`}
          onClick={handleToggle}
          aria-pressed={attached}
          aria-label={attached ? `Remove ${name} from this journey` : `Add ${name} to this journey`}
        >
          {attached ? '✓' : '+'}
        </button>
        <img src={photoSrc} alt="" className="persona-card-image" />
        <span className="persona-card-emoji" aria-hidden="true">
          {emoji}
        </span>
      </div>
      <article className="persona-card-body">
        <div className="persona-card-heading">
          <h3>{name}</h3>
          <span className="subtle">{goal}</span>
        </div>
        <p className="persona-card-behavior">{behavior}</p>
        <button type="button" className="persona-card-action" onClick={onViewDetails}>
          View journey
        </button>
      </article>
    </div>
  );
}
