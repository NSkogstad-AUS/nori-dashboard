'use client';

// Ports prototype/app.js `newRun()` + its submit handler. Built on the shared Dialog component
// (see plan/PHASE_2_PLAN.md section 5). URL validation logic is ported near-verbatim from the
// prototype's try/catch block since the plan calls it out as "already solid".

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Dialog } from './Dialog';
import { FixtureModeBadge } from './FixtureModeBadge';

export interface NewRunPersonaOption {
  id: string;
  name: string;
  emoji: string;
  colorClass: string;
}

export interface NewRunSubmission {
  url: string;
  personaIds: string[];
}

export interface NewRunDialogProps {
  open: boolean;
  onClose: () => void;
  personas: NewRunPersonaOption[];
  onSubmit: (submission: NewRunSubmission) => void;
}

/**
 * Validates a raw URL string the same way prototype/app.js's submit handler does: assumes
 * `https://` when no scheme is given, requires http/https, a hostname, and no embedded
 * credentials. Returns the parsed URL on success or null on failure.
 */
function validateRunUrl(raw: string): URL | null {
  try {
    const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw);
    const url = new URL(hasScheme ? raw : `https://${raw}`);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export function NewRunDialog({ open, onClose, personas, onSubmit }: NewRunDialogProps) {
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>(
    () => personas.map((persona) => persona.id),
  );
  const [error, setError] = useState('');

  const togglePersona = (id: string) => {
    setSelectedPersonaIds((previous) =>
      previous.includes(id) ? previous.filter((candidate) => candidate !== id) : [...previous, id],
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const raw = String(formData.get('url') ?? '').trim();
    const url = validateRunUrl(raw);
    if (!url) {
      setError('Enter a valid http or https website URL.');
      return;
    }
    if (selectedPersonaIds.length === 0) {
      setError('Choose at least one perspective.');
      return;
    }
    setError('');
    onSubmit({ url: url.href, personaIds: selectedPersonaIds });
  };

  return (
    <Dialog open={open} onClose={onClose} labelledBy="new-run-dialog-title">
      <button className="close circle" data-close aria-label="Close dialog" onClick={onClose}>
        ×
      </button>
      <span className="eyebrow">Set up a design preview</span>
      <h2 id="new-run-dialog-title">Where should we look?</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="run-url">Website URL</label>
        <input id="run-url" name="url" placeholder="https://your-website.com" required />
        <label>Choose perspectives</label>
        <div className="persona-options">
          {personas.map((persona) => (
            <label key={persona.id} className={persona.colorClass}>
              <input
                type="checkbox"
                name="persona"
                value={persona.id}
                checked={selectedPersonaIds.includes(persona.id)}
                onChange={() => togglePersona(persona.id)}
              />
              <span>{persona.emoji}</span>
              {persona.name}
            </label>
          ))}
        </div>
        <p id="form-error" role="alert">
          {error}
        </p>
        <FixtureModeBadge variant="disclaimer">
          Creates a local sample run only. No website is visited or tested.
        </FixtureModeBadge>
        <button type="submit" className="dark pill">
          Create sample run →
        </button>
      </form>
    </Dialog>
  );
}
