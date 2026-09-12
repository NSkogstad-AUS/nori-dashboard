// Ports prototype/app.js `journeyContent()`'s `.view-switch` group.

export interface JourneyViewSwitchProps {
  mode: 'overview' | 'live';
  onChange: (mode: 'overview' | 'live') => void;
}

export function JourneyViewSwitch({ mode, onChange }: JourneyViewSwitchProps) {
  return (
    <div className="view-switch" role="group" aria-label="Journey view">
      <button
        type="button"
        className="pill"
        aria-pressed={mode === 'overview'}
        onClick={() => onChange('overview')}
      >
        ⌘ Overview
      </button>
      <button
        type="button"
        className="pill"
        aria-pressed={mode === 'live'}
        onClick={() => onChange('live')}
      >
        ◉ Live view
      </button>
    </div>
  );
}
