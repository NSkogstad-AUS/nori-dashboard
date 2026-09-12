// Ports prototype/app.js `liveView()`'s captures heading + `.capture-grid` block.

import { BrowserViewport } from './BrowserViewport';

export interface CaptureStripProps {
  personName: string;
  colorClass: string;
  captureFrames: number[];
  currentFrame: number;
  stageNames: readonly string[];
  captureMessage: string;
  onSelectFrame: (frame: number) => void;
}

export function CaptureStrip({
  personName,
  colorClass,
  captureFrames,
  currentFrame,
  stageNames,
  captureMessage,
  onSelectFrame,
}: CaptureStripProps) {
  return (
    <>
      <div className="captures-heading">
        <div>
          <h3>Captured moments</h3>
          <p>Select a still to revisit that point in the journey.</p>
        </div>
        <span>
          {captureFrames.length} stills for {personName}
        </span>
      </div>
      <div className="capture-grid">
        {captureFrames.map((moment) => (
          <button
            key={moment}
            type="button"
            className={`capture-card${moment === currentFrame ? ' current' : ''}`}
            aria-label={`View ${personName} at ${stageNames[moment]}`}
            aria-pressed={moment === currentFrame}
            onClick={() => onSelectFrame(moment)}
          >
            <BrowserViewport
              personName={personName}
              colorClass={colorClass}
              stageIndex={moment}
              stageName={stageNames[moment] ?? ''}
              thumbnail
            />
            <span>
              <strong>{stageNames[moment]}</strong>
              <small>00:{String(moment * 12).padStart(2, '0')}</small>
            </span>
          </button>
        ))}
      </div>
      <p className="capture-feedback" role="status">
        {captureMessage}
      </p>
    </>
  );
}
