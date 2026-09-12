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
  onRemove: (id: string) => void;
  /** true in Live mode ("Choose whose experience to watch"), false in Overview. */
  liveCopy: boolean;
}

export function PersonaShelf({
  people,
  selectedPersonId,
  selectionMode,
  onSelect,
  onOpenLibrary,
  onRemove,
  liveCopy,
}: PersonaShelfProps) {
  return (
    <div className="persona-shelf">
      <div className="shelf-header">
        <div className="shelf-title">
          <span>Attached perspectives</span>
          <small>
            {liveCopy ? 'Choose whose experience to watch' : 'Choose a person to trace their path'}
          </small>
        </div>
      </div>
      <div className="people">
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
            onRemove={onRemove}
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
