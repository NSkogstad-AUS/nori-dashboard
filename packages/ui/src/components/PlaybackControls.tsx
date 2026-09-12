// Ports prototype/app.js `liveView()`'s `.playback` block (play/pause, prev/next, capture,
// frame-time readout). Keeps `data-action="play"`/`data-action="capture"` on their buttons,
// matching the prototype exactly — the autoplay effect in journeys-client.tsx reads
// `document.activeElement?.dataset?.action` the same way the prototype's setInterval callback
// did, to decide whether to restore focus to the Play button after each tick.

import type { Ref } from 'react';

export interface PlaybackControlsProps {
  playing: boolean;
  frame: number;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onCapture: () => void;
  /** Ref to the Play/Pause button, so callers can restore focus to it (autoplay tick). */
  playButtonRef?: Ref<HTMLButtonElement>;
}

export function PlaybackControls({
  playing,
  frame,
  onPlayPause,
  onPrevious,
  onNext,
  onCapture,
  playButtonRef,
}: PlaybackControlsProps) {
  return (
    <div className="playback">
      <div>
        <button
          ref={playButtonRef}
          type="button"
          className="pill small"
          data-action="play"
          onClick={onPlayPause}
        >
          {playing ? 'Ⅱ Pause' : '▶ Play demo'}
        </button>
        <button
          type="button"
          className="circle"
          aria-label="Previous moment"
          disabled={frame === 0}
          onClick={onPrevious}
        >
          ←
        </button>
        <button
          type="button"
          className="circle"
          aria-label="Next moment"
          disabled={frame === 3}
          onClick={onNext}
        >
          →
        </button>
      </div>
      <span className="frame-time">
        00:{String(frame * 12).padStart(2, '0')} / 00:36
      </span>
      <button type="button" className="pill small" data-action="capture" onClick={onCapture}>
        ⊙ Capture moment
      </button>
    </div>
  );
}
