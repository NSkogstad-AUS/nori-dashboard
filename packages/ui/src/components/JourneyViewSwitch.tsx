// Ports prototype/app.js `journeyContent()`'s `.view-switch` group, plus a "Begin run" action
// (not in the prototype) that starts a real run from the Journeys page's own URL input and
// selected persona — see apps/web/src/app/journeys/journeys-client.tsx.

export interface JourneyViewSwitchProps {
  mode: 'overview' | 'live';
  onChange: (mode: 'overview' | 'live') => void;
  /** Starts a run. Omit to hide the action entirely. */
  onBeginRun?: () => void;
  /** Replaces the action's label while the run is being created. */
  beginRunPending?: boolean;
}

export function JourneyViewSwitch({
  mode,
  onChange,
  onBeginRun,
  beginRunPending = false,
}: JourneyViewSwitchProps) {
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
      {onBeginRun ? (
        <button
          type="button"
          className="pill begin-run"
          onClick={onBeginRun}
          disabled={beginRunPending}
        >
          {beginRunPending ? '◌ Starting…' : '▶ Begin run'}
        </button>
      ) : null}
    </div>
  );
}
