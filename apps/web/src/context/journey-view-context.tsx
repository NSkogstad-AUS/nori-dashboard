'use client';

// Replaces prototype/app.js's state.mode/person/onlyIssues/frames/captures/playing/
// captureMessage. Scoped to the Journeys route (not global — see plan/PHASE_2_PLAN.md section 5),
// so this provider should wrap only `app/journeys/page.tsx`, not the root layout.

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type JourneyViewMode = 'overview' | 'live';

export interface JourneyViewContextValue {
  mode: JourneyViewMode;
  setMode: (mode: JourneyViewMode) => void;
  selectedPersonId: string | null;
  setSelectedPersonId: (personId: string | null) => void;
  onlyIssues: boolean;
  setOnlyIssues: (onlyIssues: boolean) => void;
  frameBySession: Record<string, number>;
  setFrame: (sessionId: string, frame: number) => void;
  captureFramesBySession: Record<string, number[]>;
  addCapture: (sessionId: string, frame: number) => boolean;
  playing: boolean;
  setPlaying: (playing: boolean) => void;
  captureMessage: string;
  setCaptureMessage: (message: string) => void;
}

const JourneyViewContext = createContext<JourneyViewContextValue | undefined>(undefined);

export function JourneyViewProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<JourneyViewMode>('overview');
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [frameBySession, setFrameBySession] = useState<Record<string, number>>({});
  const [captureFramesBySession, setCaptureFramesBySession] = useState<Record<string, number[]>>(
    {},
  );
  const [playing, setPlaying] = useState(false);
  const [captureMessage, setCaptureMessage] = useState('');

  // Mirrors the prototype's mode switch handler: switching modes always resets playback and
  // any pending capture feedback message.
  const setMode = useCallback((nextMode: JourneyViewMode) => {
    setModeState(nextMode);
    setPlaying(false);
    setCaptureMessage('');
  }, []);

  const setFrame = useCallback((sessionId: string, frame: number) => {
    const clamped = Math.max(0, Math.min(3, frame));
    setFrameBySession((previous) => ({ ...previous, [sessionId]: clamped }));
  }, []);

  // Mirrors the prototype's capture dedupe: `if (!captures[person].includes(frame))`. Returns
  // whether a new capture was actually added, so callers can set the right feedback message.
  const addCapture = useCallback((sessionId: string, frame: number): boolean => {
    let added = false;
    setCaptureFramesBySession((previous) => {
      const existing = previous[sessionId] ?? [];
      if (existing.includes(frame)) {
        added = false;
        return previous;
      }
      added = true;
      const next = [...existing, frame].sort((a, b) => a - b);
      return { ...previous, [sessionId]: next };
    });
    return added;
  }, []);

  const value = useMemo<JourneyViewContextValue>(
    () => ({
      mode,
      setMode,
      selectedPersonId,
      setSelectedPersonId,
      onlyIssues,
      setOnlyIssues,
      frameBySession,
      setFrame,
      captureFramesBySession,
      addCapture,
      playing,
      setPlaying,
      captureMessage,
      setCaptureMessage,
    }),
    [
      mode,
      setMode,
      selectedPersonId,
      onlyIssues,
      frameBySession,
      setFrame,
      captureFramesBySession,
      addCapture,
      playing,
      captureMessage,
    ],
  );

  return <JourneyViewContext.Provider value={value}>{children}</JourneyViewContext.Provider>;
}

export function useJourneyView(): JourneyViewContextValue {
  const context = useContext(JourneyViewContext);
  if (!context) {
    throw new Error('useJourneyView must be used within a JourneyViewProvider');
  }
  return context;
}
