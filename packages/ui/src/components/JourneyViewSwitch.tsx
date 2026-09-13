// Ports prototype/app.js `journeyContent()`'s `.view-switch` group, plus a "Begin run" action
// (not in the prototype) that starts a real run from the Journeys page's own URL input and
// selected persona — see apps/web/src/app/journeys/journeys-client.tsx.

export interface JourneyViewSwitchProps {
  mode: 'overview' | 'live';
  onChange: (mode: 'overview' | 'live') => void;
  /** Starts a run. Omit to hide the action entirely. */
  onBeginRun?: () => void;
  /** Replaces and disables the action while a run is active. */
  beginRunRunning?: boolean;
  /** Requests cancellation of the active run. */
  onCancelRun?: () => void;
  /** Disables the cancellation action while the request is being processed. */
  cancelRunPending?: boolean;
  /** Current journey status, displayed in the center of the control bar. */
  statusLabel?: string;
  onFinishJourney?: () => void;
  finishJourneyPending?: boolean;
  summaryVisible?: boolean;
}

export function JourneyViewSwitch({
  mode,
  onChange,
  onBeginRun,
  beginRunRunning = false,
  onCancelRun,
  cancelRunPending = false,
  statusLabel = 'Ready to begin',
  onFinishJourney,
  finishJourneyPending = false,
  summaryVisible = false,
}: JourneyViewSwitchProps) {
  return (
    <header className="view-switch">
      <div className="view-switch-leading">
        <div className="view-switch-tabs" role="group" aria-label="Journey view">
          <button
            type="button"
            className="pill"
            aria-pressed={mode === 'overview'}
            onClick={() => onChange('overview')}
          >
            Overview
          </button>
          <button
            type="button"
            className="pill"
            aria-pressed={mode === 'live'}
            onClick={() => onChange('live')}
          >
            <span className="live-view-dot" aria-hidden="true" />
            Live view
          </button>
        </div>
      </div>
      <span className="view-switch-status" aria-live="polite">
        <i aria-hidden="true" />
        {statusLabel}
      </span>
      <div className="view-switch-actions">
        {onFinishJourney ? (
          <button
            type="button"
            className="pill finish-run"
            onClick={onFinishJourney}
            disabled={finishJourneyPending || cancelRunPending}
          >
            {finishJourneyPending
              ? 'Finishing…'
              : summaryVisible
                ? 'View summary'
                : 'Finish Journey'}
          </button>
        ) : null}
        {onBeginRun ? (
          <button
            type="button"
            className={`pill begin-run${beginRunRunning && onCancelRun ? ' cancel-run' : ''}`}
            onClick={beginRunRunning && onCancelRun ? onCancelRun : onBeginRun}
            disabled={beginRunRunning ? !onCancelRun || cancelRunPending : false}
          >
            {beginRunRunning ? (
              onCancelRun ? (
                cancelRunPending ? (
                  'Cancelling…'
                ) : (
                  'Cancel run'
                )
              ) : (
                'Running…'
              )
            ) : (
              <>
                <svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14">
                  <path d="M4.5 3.2 12 8l-7.5 4.8V3.2Z" fill="currentColor" />
                </svg>
                Begin run
              </>
            )}
          </button>
        ) : null}
      </div>
    </header>
  );
}
