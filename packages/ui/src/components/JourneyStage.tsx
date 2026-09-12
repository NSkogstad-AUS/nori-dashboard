// Ports prototype/app.js `atlas()`'s per-stage column (`.stage-column`), rendering the `→`
// connector between columns via CSS on `.stage-column:not(:last-child) .journey-node:after`
// (ported as-is in components.css) rather than markup.

import type { ReactNode } from 'react';

export interface JourneyStageProps {
  index: number;
  name: string;
  children: ReactNode;
}

export function JourneyStage({ index, name, children }: JourneyStageProps) {
  return (
    <div className="stage-column">
      <div className="stage-heading">
        <span>0{index + 1}</span>
        <h3>{name}</h3>
      </div>
      <div className="stage-nodes">{children}</div>
    </div>
  );
}
