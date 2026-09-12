'use client';

import { useId, useState } from 'react';
// Ports prototype/app.js `personaShelf()`.

import { PersonaPill, type PersonaPillProps } from './PersonaPill';

export interface PersonaShelfPerson {
  id: string;
  name: string;
  emoji: string;
  photoSrc?: string;
  role: string;
  colorClass: string;
}

export interface PersonaShelfProps {
  people: PersonaShelfPerson[];
  selectedPersonId: string | null;
  selectionMode: PersonaPillProps['selectionMode'];
  onSelect: (id: string) => void;
  onOpenLibrary: () => void;
}

export function PersonaShelf({
  people,
  selectedPersonId,
  selectionMode,
  onSelect,
  onOpenLibrary,
}: PersonaShelfProps) {
  const [compact, setCompact] = useState(false);
  const cardsId = useId();
  return (
    <div className="persona-shelf">
      <div className="shelf-header">
        <div className="shelf-title">
          <span>Attached perspectives</span>
        </div>
        <button
          type="button"
          className="perspectives-toggle"
          aria-expanded={!compact}
          aria-controls={cardsId}
          onClick={() => setCompact((previous) => !previous)}
        >
          {compact ? 'Expand' : 'Collapse'}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d={compact ? 'm6 9 6 6 6-6' : 'm6 15 6-6 6 6'} />
          </svg>
        </button>
      </div>
      <div id={cardsId} className={`people${compact ? ' people-compact' : ''}`}>
        {people.map((person) => (
          <PersonaPill
            key={person.id}
            id={person.id}
            name={person.name}
            emoji={person.emoji}
            photoSrc={person.photoSrc}
            role={person.role}
            colorClass={person.colorClass}
            selected={selectedPersonId === person.id}
            selectionMode={selectionMode}
            onSelect={onSelect}
            compact={compact}
          />
        ))}
        {people.length < 4 && (
          <button type="button" className="person-add" onClick={onOpenLibrary}>
            <span aria-hidden="true">+</span>
            Add a user
          </button>
        )}
      </div>
    </div>
  );
}
