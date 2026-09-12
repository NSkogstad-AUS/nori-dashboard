// Ports prototype/app.js `personaShelf()`.

import { PersonaPill, type PersonaPillProps } from './PersonaPill';

export interface PersonaShelfPerson {
  id: string;
  name: string;
  emoji: string;
  role: string;
  colorClass: string;
  issues: number;
}

export interface PersonaShelfProps {
  people: PersonaShelfPerson[];
  selectedPersonId: string | null;
  selectionMode: PersonaPillProps['selectionMode'];
  onSelect: (id: string) => void;
  onOpenLibrary: () => void;
  /** true in Live mode ("Choose whose experience to watch"), false in Overview. */
  liveCopy: boolean;
}

export function PersonaShelf({
  people,
  selectedPersonId,
  selectionMode,
  onSelect,
  onOpenLibrary,
  liveCopy,
}: PersonaShelfProps) {
  return (
    <div className="persona-shelf">
      <div className="shelf-header">
        <div className="shelf-title">
          <span className="eyebrow">Attached perspectives</span>
          <small>
            {liveCopy ? 'Choose whose experience to watch' : 'Choose a person to trace their path'}
          </small>
        </div>
        <button
          type="button"
          className="circle add-person"
          aria-label="Open persona library"
          onClick={onOpenLibrary}
        >
          +
        </button>
      </div>
      <div className="people">
        {people.map((person) => (
          <PersonaPill
            key={person.id}
            id={person.id}
            name={person.name}
            emoji={person.emoji}
            role={person.role}
            colorClass={person.colorClass}
            issues={person.issues}
            selected={selectedPersonId === person.id}
            selectionMode={selectionMode}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
