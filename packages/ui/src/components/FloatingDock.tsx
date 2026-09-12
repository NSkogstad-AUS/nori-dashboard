// Ports prototype/app.js `render()`'s `.floating-dock` quick-actions cluster.

export interface FloatingDockProps {
  onOpenJourneys: () => void;
  onOpenRuns: () => void;
  onNewRun: () => void;
}

export function FloatingDock({ onOpenJourneys, onOpenRuns, onNewRun }: FloatingDockProps) {
  return (
    <div className="floating-dock" aria-label="Quick actions">
      <button type="button" className="circle" aria-label="Open journeys" onClick={onOpenJourneys}>
        ⌘
      </button>
      <button type="button" className="circle" aria-label="Open runs" onClick={onOpenRuns}>
        ▦
      </button>
      <button
        type="button"
        className="circle accent"
        aria-label="Create a sample run"
        onClick={onNewRun}
      >
        ＋
      </button>
    </div>
  );
}
