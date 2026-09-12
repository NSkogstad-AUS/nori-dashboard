'use client';

// Ports prototype/app.js `journeyContent()`, `atlas()`, `liveView()`, `browserFrame()`,
// `changeFrame()`, `showFinding()`, and the personas-library dialog action. See
// plan/PHASE_2_PLAN.md section 6.

import { useEffect, useMemo, useRef, useState } from 'react';
import FeatureFlipper from '../../../framer/feature-flipper';
import {
  JourneyViewSwitch,
  PersonaShelf,
  JourneyStage,
  JourneyStep,
  BrowserViewport,
  PlaybackControls,
  CaptureStrip,
  FindingDrawer,
  PersonaLibraryDialog,
  FixtureModeBadge,
  Dialog,
  type PersonaShelfPerson,
} from '@nori/ui';
import { JourneyViewProvider, useJourneyView } from '../../context/journey-view-context';
import { personas, runs } from '../../fixtures/index';
import {
  STAGE_NAMES,
  findingAt,
  observationAt,
  personaForFinding,
  sessionForPersonaInRun,
  stageIndexForFinding,
  stepAtStage,
  isErrorOutcome,
} from '../../lib/journey-derivations';
import type { Finding } from '@nori/contracts';

const PERSONA_COLOR_CLASS: Record<string, string> = {
  Alex: 'peach',
  Jamie: 'blue',
  Sam: 'violet',
  Riley: 'lime',
};

const PERSONA_PHOTO_SRC: Record<string, string> = {
  Alex: '/personas/alex.png',
  Jamie: '/personas/jamie.png',
  Sam: '/personas/sam.png',
  Riley: '/personas/riley.png',
};

// The prototype's atlas/live view both operate on a single canonical illustrative run — the
// "First visit → first project" run (Acme, run1) — regardless of the sidebar's selected website.
// This mirrors that: Journeys always explores this one sample run's data.
const CANONICAL_RUN = runs[0]!;

export default function JourneysClient() {
  return (
    <JourneyViewProvider>
      <JourneysContent />
    </JourneyViewProvider>
  );
}

function JourneysContent() {
  const { mode, setMode, setPlaying, setCaptureMessage } = useJourneyView();

  const [findingOpen, setFindingOpen] = useState<Finding | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [attachedPersonaIds, setAttachedPersonaIds] = useState<Set<string>>(
    () => new Set(personas.map((persona) => persona.id)),
  );
  const [plainStepOpen, setPlainStepOpen] = useState<{
    personId: string;
    stageIndex: number;
  } | null>(null);

  const toggleAttached = (id: string) => {
    const next = new Set(attachedPersonaIds);
    next.add(id);
    setAttachedPersonaIds(next);
    setPlaying(false);
    setCaptureMessage('');
  };

  const findingPerson = findingOpen ? personaForFinding(findingOpen) : undefined;
  const findingStageIndex = findingOpen ? (stageIndexForFinding(findingOpen) ?? 0) : 0;

  // Mirrors the prototype's `show()`, which always sets `state.playing = false` before
  // displaying any dialog content, regardless of which dialog — so any trigger for any dialog
  // (finding, persona library, or the plain step notice) pauses live-view autoplay.
  const openFinding = (finding: Finding) => {
    setPlaying(false);
    setFindingOpen(finding);
  };
  const openLibrary = () => {
    setPlaying(false);
    setLibraryOpen(true);
  };
  const openPlainStep = (personId: string, stageIndex: number) => {
    setPlaying(false);
    setPlainStepOpen({ personId, stageIndex });
  };

  return (
    <>
      <section className="journey-website" aria-label="Website">
        <div className="journey-website-input">
          <span className="journey-website-icon" aria-hidden="true">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <circle cx="12" cy="12" r="9" />
              <ellipse cx="12" cy="12" rx="4" ry="9" />
              <path d="M3 12h18" />
            </svg>
          </span>
          <input
            type="url"
            aria-label="Website URL"
            placeholder="Enter a website URL"
            value={websiteUrl}
            onChange={(event) => setWebsiteUrl(event.target.value)}
            autoComplete="url"
            spellCheck={false}
          />
        </div>
      </section>
      <div className="perspective-panel">
        <PersonaShelfSection onOpenLibrary={openLibrary} attachedPersonaIds={attachedPersonaIds} />
      </div>
      <section className="journey-framer-feature" aria-label="Feature flipper">
        <FeatureFlipper style={{ width: '100%', height: '100%' }} />
      </section>
      <div className="journey-experience">
        <JourneyViewSwitch mode={mode} onChange={setMode} />
        {mode === 'live' ? (
          <LiveView onOpenFinding={openFinding} />
        ) : (
          <OverviewAtlas onOpenFinding={openFinding} onOpenStep={openPlainStep} />
        )}
      </div>
      <FindingDrawer
        open={findingOpen !== null}
        onClose={() => setFindingOpen(null)}
        stageName={STAGE_NAMES[findingStageIndex] ?? ''}
        title={findingOpen?.title ?? ''}
        personName={findingPerson?.name ?? ''}
        personEmoji={findingPerson?.emoji ?? ''}
        personColorClass={PERSONA_COLOR_CLASS[findingPerson?.name ?? ''] ?? 'peach'}
        personRole={findingPerson?.goal ?? ''}
        severity={findingOpen?.severity ?? ''}
        observedFact={findingOpen?.observedFact ?? ''}
        recommendation={findingOpen?.recommendation ?? ''}
        previousStageName={STAGE_NAMES[Math.max(0, findingStageIndex - 1)] ?? ''}
      />
      <PersonaLibraryDialog
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        personas={personas.map((persona) => ({
          id: persona.id,
          name: persona.name,
          emoji: persona.emoji,
          role: persona.goal,
          behavior: persona.behavior,
          photoSrc: PERSONA_PHOTO_SRC[persona.name] ?? '',
          attached: attachedPersonaIds.has(persona.id),
        }))}
        onToggleAttached={toggleAttached}
      />
      {/* Ports the prototype's plain step detail dialog (a step with no finding) — purely
          informational text with no form/interactive content, same as the prototype's version,
          but still built on the shared Dialog for consistent focus-restore/Escape/backdrop
          behavior with the other two dialogs. */}
      <PlainStepNotice
        open={plainStepOpen !== null}
        personId={plainStepOpen?.personId ?? null}
        stageIndex={plainStepOpen?.stageIndex ?? 0}
        onClose={() => setPlainStepOpen(null)}
      />
    </>
  );
}

function PersonaShelfSection({
  onOpenLibrary,
  attachedPersonaIds,
}: {
  onOpenLibrary: () => void;
  attachedPersonaIds: Set<string>;
}) {
  const { mode, selectedPersonId, setSelectedPersonId, setPlaying, setCaptureMessage } =
    useJourneyView();

  const people: PersonaShelfPerson[] = personas
    .filter((persona) => attachedPersonaIds.has(persona.id))
    .map((persona) => {
      return {
        id: persona.id,
        name: persona.name,
        emoji: persona.emoji,
        photoSrc: PERSONA_PHOTO_SRC[persona.name],
        role: persona.goal,
        behavior: persona.behavior,
        colorClass: PERSONA_COLOR_CLASS[persona.name] ?? 'peach',
      };
    });

  const handleSelect = (id: string) => {
    // Mirrors prototype: in Live mode, clicking always selects (never deselects); in Overview,
    // clicking the already-selected persona clears the selection.
    if (mode === 'live') {
      setSelectedPersonId(id);
    } else {
      setSelectedPersonId(selectedPersonId === id ? null : id);
    }
    setPlaying(false);
    setCaptureMessage('');
  };

  return (
    <PersonaShelf
      people={people}
      selectedPersonId={selectedPersonId}
      selectionMode={mode === 'live' ? 'single' : 'toggle'}
      onSelect={handleSelect}
      onOpenLibrary={onOpenLibrary}
    />
  );
}

interface OverviewAtlasProps {
  onOpenFinding: (finding: Finding) => void;
  onOpenStep: (personId: string, stageIndex: number) => void;
}

function OverviewAtlas({ onOpenFinding, onOpenStep }: OverviewAtlasProps) {
  const { selectedPersonId, onlyIssues } = useJourneyView();
  const visiblePersonas = selectedPersonId
    ? personas.filter((persona) => persona.id === selectedPersonId)
    : personas;

  return (
    <>
      <section className="map-panel">
        <div className="panel-head">
          <div>
            <span className="subtle">Sample run</span>
            <h2>{CANONICAL_RUN.task}</h2>
          </div>
          <button type="button" className="circle" aria-label="Run details">
            ↗
          </button>
        </div>
        <div className="scroll-area">
          <div className="stage-map">
            {STAGE_NAMES.map((stageName, stageIndex) => (
              <JourneyStage key={stageName} index={stageIndex} name={stageName}>
                {visiblePersonas.map((persona) => {
                  const finding = findingAt(CANONICAL_RUN.id, persona.id, stageIndex);
                  const session = sessionForPersonaInRun(CANONICAL_RUN.id, persona.id);
                  const step = session ? stepAtStage(session.id, stageIndex) : undefined;
                  const actionText = observationAt(CANONICAL_RUN.id, persona.id, stageIndex) ?? '';
                  return (
                    <JourneyStep
                      key={persona.id}
                      personName={persona.name}
                      personEmoji={persona.emoji}
                      actionText={actionText}
                      findingSeverity={finding?.severity}
                      isErrorOutcome={step ? isErrorOutcome(step) : false}
                      onlyIssues={onlyIssues}
                      onOpen={() => {
                        if (finding) onOpenFinding(finding);
                        else onOpenStep(persona.id, stageIndex);
                      }}
                    />
                  );
                })}
              </JourneyStage>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

interface LiveViewProps {
  onOpenFinding: (finding: Finding) => void;
}

function LiveView({ onOpenFinding }: LiveViewProps) {
  const {
    selectedPersonId,
    frameBySession,
    setFrame,
    captureFramesBySession,
    addCapture,
    playing,
    setPlaying,
    captureMessage,
    setCaptureMessage,
  } = useJourneyView();

  const persona = personas.find((candidate) => candidate.id === selectedPersonId) ?? personas[0]!;
  const session = sessionForPersonaInRun(CANONICAL_RUN.id, persona.id);
  const sessionId = session?.id ?? '';
  const frame = frameBySession[sessionId] ?? 0;
  const captureFrames = captureFramesBySession[sessionId] ?? [0, 1];
  const colorClass = PERSONA_COLOR_CLASS[persona.name] ?? 'peach';
  const finding = findingAt(CANONICAL_RUN.id, persona.id, frame);

  const playButtonRef = useRef<HTMLButtonElement | null>(null);

  const changeFrame = (nextFrame: number) => {
    setFrame(sessionId, nextFrame);
    setPlaying(false);
    setCaptureMessage('');
  };

  // Autoplay: ports the prototype's `setInterval(..., 2400)` into a useEffect with cleanup on
  // unmount/dependency change. The prototype's interval callback re-checks on every tick that
  // `state.playing && state.view==='journey' && state.mode==='live' && !dialog.open &&
  // !document.hidden` before advancing. Here, "Journeys route + live mode" is guaranteed by this
  // component only being mounted in that state (it unmounts on route/mode change, which the
  // cleanup below handles), `document.hidden` is still checked explicitly, and "no dialog open"
  // is enforced because opening FindingDrawer/PersonaLibraryDialog always calls setPlaying(false)
  // first via the shelf/finding-click handlers.
  useEffect(() => {
    if (!playing) return;
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      const focusedAction = (document.activeElement as HTMLElement | null)?.dataset?.action;
      setFrame(sessionId, Math.min(3, frame + 1));
      if (frame + 1 >= 3) {
        setPlaying(false);
      }
      if (focusedAction === 'play') {
        window.requestAnimationFrame(() => playButtonRef.current?.focus({ preventScroll: true }));
      }
    }, 2400);
    return () => window.clearInterval(interval);
  }, [playing, frame, sessionId]);

  const handlePlayPause = () => {
    if (!playing && frame === 3) {
      setFrame(sessionId, 0);
    }
    setPlaying(!playing);
  };

  const handleCapture = () => {
    const added = addCapture(sessionId, frame);
    setCaptureMessage(
      added ? `Moment saved for ${persona.name}.` : 'This moment is already captured.',
    );
    setPlaying(false);
  };

  const activitySteps = useMemo(
    () =>
      STAGE_NAMES.map((stageName, index) => ({
        stageName,
        actionText: observationAt(CANONICAL_RUN.id, persona.id, index) ?? '',
      })),
    [persona.id],
  );

  return (
    <section className="transmission">
      <header className="transmission-header">
        <div>
          <span className={`emoji ${colorClass}`}>{persona.emoji}</span>
          <span>
            <h2>{persona.name}&rsquo;s experience</h2>
            <small>{persona.goal}</small>
          </span>
        </div>
        <span className="transmission-status">
          <i />
          {playing ? 'Playing demo' : 'Paused demo'}
        </span>
      </header>
      <div className="transmission-layout">
        <div className="screen-column">
          <div className="browser-window">
            <div className="browser-chrome">
              <span>● ● ●</span>
              <span className="browser-address">
                ▣ forma.example / {['home', 'pricing', 'signup', 'workspace'][frame]}
              </span>
              <span>↗</span>
            </div>
            <BrowserViewport
              personName={persona.name}
              colorClass={colorClass}
              stageIndex={frame}
              stageName={STAGE_NAMES[frame] ?? ''}
            />
          </div>
          <PlaybackControls
            playButtonRef={playButtonRef}
            playing={playing}
            frame={frame}
            onPlayPause={handlePlayPause}
            onPrevious={() => changeFrame(frame - 1)}
            onNext={() => changeFrame(frame + 1)}
            onCapture={handleCapture}
          />
          <FixtureModeBadge variant="disclaimer" className="feed-disclaimer">
            {`Simulated browser frames. Forma is fictional, not a live connection to ${
              new URL(CANONICAL_RUN.url).hostname
            }. Playback is condensed.`}
          </FixtureModeBadge>
        </div>
        <aside className="activity-panel">
          <span className="subtle">Through their eyes</span>
          <h3>{activitySteps[frame]?.actionText}</h3>
          <p>
            {persona.name} is at the &ldquo;{STAGE_NAMES[frame]}&rdquo; stage of this illustrative
            journey.
          </p>
          <div className="activity-steps">
            {activitySteps.map((step, index) => (
              <button
                key={step.stageName}
                type="button"
                data-frame={index}
                aria-current={frame === index ? 'step' : 'false'}
                onClick={() => changeFrame(index)}
              >
                <span className="activity-dot">
                  {index < frame ? '✓' : String(index + 1).padStart(2, '0')}
                </span>
                <span>
                  <strong>{step.stageName}</strong>
                  <small>{step.actionText}</small>
                </span>
              </button>
            ))}
          </div>
          {finding ? (
            <button type="button" className="live-finding" onClick={() => onOpenFinding(finding)}>
              <span className="tag">{finding.severity} friction</span>
              <strong>{finding.title}</strong>
              <small>Open sample evidence ↗</small>
            </button>
          ) : (
            <div className="clear-moment">✓ No flagged issue at this moment.</div>
          )}
        </aside>
      </div>
      <CaptureStrip
        personName={persona.name}
        colorClass={colorClass}
        captureFrames={captureFrames}
        currentFrame={frame}
        stageNames={STAGE_NAMES}
        captureMessage={captureMessage}
        onSelectFrame={changeFrame}
      />
    </section>
  );
}

function PlainStepNotice({
  open,
  personId,
  stageIndex,
  onClose,
}: {
  open: boolean;
  personId: string | null;
  stageIndex: number;
  onClose: () => void;
}) {
  const persona = personId ? personas.find((candidate) => candidate.id === personId) : undefined;
  const actionText = personId ? (observationAt(CANONICAL_RUN.id, personId, stageIndex) ?? '') : '';
  return (
    <Dialog open={open} onClose={onClose} labelledBy="plain-step-title">
      <button className="close circle" data-close aria-label="Close dialog" onClick={onClose}>
        ×
      </button>
      <span className="subtle">Sample journey / {STAGE_NAMES[stageIndex]}</span>
      <h2 id="plain-step-title">{actionText}</h2>
      <p>
        {persona ? (
          <>
            {persona.emoji} {persona.name} continued to the next step without a flagged issue in
            this fictional path.
          </>
        ) : null}
      </p>
    </Dialog>
  );
}
