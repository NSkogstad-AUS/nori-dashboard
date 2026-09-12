'use client';

// Ports prototype/app.js's `personas` library dialog action — the prototype's third dialog type,
// required per plan/PHASE_2_PLAN.md section 5 even though it isn't in the master component list
// by name. Built on the shared Dialog component.

import { Dialog } from './Dialog';
import { FixtureModeBadge } from './FixtureModeBadge';
import { PersonaCard } from './PersonaCard';

export interface PersonaLibraryEntry {
  id: string;
  name: string;
  emoji: string;
  role: string;
  behavior: string;
  photoSrc: string;
  attached: boolean;
}

export interface PersonaLibraryDialogProps {
  open: boolean;
  onClose: () => void;
  personas: PersonaLibraryEntry[];
  onToggleAttached: (id: string) => void;
}

export function PersonaLibraryDialog({
  open,
  onClose,
  personas,
  onToggleAttached,
}: PersonaLibraryDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="persona-library-title">
      <button className="close circle" data-close aria-label="Close dialog" onClick={onClose}>
        ×
      </button>
      <span className="subtle">Perspective library</span>
      <h2 id="persona-library-title">Four different ways of seeing.</h2>
      <div className="library persona-library-grid">
        {personas.map((persona) => (
          <PersonaCard
            key={persona.id}
            name={persona.name}
            goal={persona.role}
            behavior={persona.behavior}
            emoji={persona.emoji}
            photoSrc={persona.photoSrc}
            attached={persona.attached}
            onToggleAttached={() => onToggleAttached(persona.id)}
          />
        ))}
      </div>
      <FixtureModeBadge variant="disclaimer">
        These are fictional AI personas. Customize your selection when creating a new sample run.
      </FixtureModeBadge>
    </Dialog>
  );
}
