'use client';

// Ports prototype/app.js's `personas` library dialog action — the prototype's third dialog type,
// required per plan/PHASE_2_PLAN.md section 5 even though it isn't in the master component list
// by name. Built on the shared Dialog component.

import { Dialog } from './Dialog';
import { FixtureModeBadge } from './FixtureModeBadge';

export interface PersonaLibraryEntry {
  id: string;
  name: string;
  emoji: string;
  role: string;
  colorClass: string;
}

export interface PersonaLibraryDialogProps {
  open: boolean;
  onClose: () => void;
  personas: PersonaLibraryEntry[];
}

export function PersonaLibraryDialog({ open, onClose, personas }: PersonaLibraryDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="persona-library-title">
      <button className="close circle" data-close aria-label="Close dialog" onClick={onClose}>
        ×
      </button>
      <span className="subtle">Perspective library</span>
      <h2 id="persona-library-title">Four different ways of seeing.</h2>
      <div className="library">
        {personas.map((persona) => (
          <div key={persona.id} className={persona.colorClass}>
            <span className="emoji">{persona.emoji}</span>
            <strong>{persona.name}</strong>
            <p>{persona.role}</p>
            <small>✓ Attached to this sample journey</small>
          </div>
        ))}
      </div>
      <FixtureModeBadge variant="disclaimer">
        These are fictional AI personas. Customize your selection when creating a new sample run.
      </FixtureModeBadge>
    </Dialog>
  );
}
