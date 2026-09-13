'use client';

// Ports prototype/app.js `journeyContent()`, `atlas()`, `liveView()`, `browserFrame()`,
// `changeFrame()`, `showFinding()`, and the personas-library dialog action. See
// plan/PHASE_2_PLAN.md section 6.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  JourneyViewSwitch,
  PersonaShelf,
  BrowserViewport,
  PlaybackControls,
  CaptureStrip,
  FindingDrawer,
  PersonaLibraryDialog,
  FixtureModeBadge,
  type PersonaShelfPerson,
} from '@nori/ui';
import { JourneyViewProvider, useJourneyView } from '../../context/journey-view-context';
import { useWorkspace } from '../../context/workspace-context';
import { useNewRunDialog } from '../../context/new-run-dialog-context';
import { personas, runs } from '../../fixtures/index';
import {
  STAGE_NAMES,
  findingAt,
  observationAt,
  personaForFinding,
  sessionForPersonaInRun,
  stageIndexForFinding,
} from '../../lib/journey-derivations';
import { validateWebsiteUrl } from '../../lib/validate-url';
import { saveLocalRun, updateLocalRunState } from '../../lib/local-runs';
import type {
  Finding,
  Persona,
  Website,
  PersonaReport,
  PersonaSession,
  Run,
  SessionState,
  Step,
} from '@nori/contracts';

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

/**
 * Returns the id of the workspace website whose origin matches `url`, registering it first if
 * this workspace isn't tracking that origin yet. Returns null if it can't be resolved.
 *
 * The run's navigation allowlist is derived from its website's origin (api/runs/route.ts), so
 * this is what lets the agent actually visit the URL typed on this page.
 */
async function resolveWebsiteForOrigin(
  url: URL,
  websites: Website[],
  addWebsite: (website: Website) => void,
): Promise<string | null> {
  const existing = websites.find((website) => {
    try {
      return new URL(website.origin).origin === url.origin;
    } catch {
      return false;
    }
  });
  if (existing) return existing.id;

  const response = await fetch('/api/websites', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ displayName: url.hostname, origin: url.origin }),
  });
  if (response.ok) {
    const website = (await response.json()) as Website;
    // Keeps the sidebar in step with the origin this run actually targets.
    addWebsite(website);
    return website.id;
  }
  // 409: another tab/session already registered this origin, or WorkspaceContext's seeded list
  // was stale. Re-read the server's list and use the row that's there.
  if (response.status === 409) {
    const listResponse = await fetch('/api/websites');
    if (!listResponse.ok) return null;
    const { items }: { items: Website[] } = await listResponse.json();
    const match = items.find((website) => {
      try {
        return new URL(website.origin).origin === url.origin;
      } catch {
        return false;
      }
    });
    return match?.id ?? null;
  }
  return null;
}

export default function JourneysClient() {
  return (
    <JourneyViewProvider>
      <JourneysContent />
    </JourneyViewProvider>
  );
}

function JourneysContent() {
  const {
    mode,
    setMode,
    setPlaying,
    setCaptureMessage,
    selectedPersonId,
    setSelectedPersonId,
  } = useJourneyView();
  const searchParams = useSearchParams();
  const router = useRouter();
  const runId = searchParams.get('runId');
  const { websites, selectedWebsiteId, addWebsite } = useWorkspace();
  const { openDialog: openNewRun } = useNewRunDialog();

  const [findingOpen, setFindingOpen] = useState<Finding | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState(
    () =>
      searchParams.get('new') === '1'
        ? ''
        : (websites.find((website) => website.id === selectedWebsiteId)?.origin ?? ''),
  );
  const [attachedPersonaIds, setAttachedPersonaIds] = useState<Set<string>>(
    () => new Set(personas.map((persona) => persona.id)),
  );
  const [runPending, setRunPending] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);
  const [cancelledRunId, setCancelledRunId] = useState<string | null>(null);
  const { progress: runProgress, error: runProgressError } = useRunProgress(runId);
  const locallyCancelled = Boolean(runId && cancelledRunId === runId);
  const runRunning =
    !locallyCancelled &&
    (runPending ||
    Boolean(
      runId &&
        !runProgressError &&
        (!runProgress ||
          !['completed', 'completed_with_errors', 'failed', 'cancelled'].includes(
            runProgress.run.state,
          )),
    ));
  const cancellationRequested =
    cancelPending || runProgress?.run.cancelRequestState === 'cancel_requested';
  const runStatusLabel = locallyCancelled
    ? 'Run cancelled'
    : cancellationRequested
      ? 'Cancelling…'
      : runRunning
        ? 'Running…'
    : runProgress?.run.state === 'completed'
      ? 'Journey complete'
      : runProgress?.run.state === 'completed_with_errors'
        ? 'Completed with issues'
        : runProgress?.run.state === 'failed'
          ? 'Run failed'
          : runProgress?.run.state === 'cancelled'
            ? 'Run cancelled'
            : 'Ready to begin';

  useEffect(() => {
    if (!selectedPersonId) setSelectedPersonId(personas[0]?.id ?? null);
  }, [selectedPersonId, setSelectedPersonId]);

  useEffect(() => {
    if (searchParams.get('from') !== 'home' || !runId) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('journey-results')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [runId, searchParams]);

  useEffect(() => {
    if (
      runProgress &&
      ['completed', 'completed_with_errors', 'failed', 'cancelled'].includes(runProgress.run.state)
    ) {
      setCancelPending(false);
    }
  }, [runProgress]);

  useEffect(() => {
    if (!runProgress) return;
    updateLocalRunState(runProgress.run.id, runProgress.run.state, runProgress.run.updatedAt);
  }, [runProgress]);

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

  const announce = (message: string) => {
    const announcement = document.getElementById('announcement');
    if (announcement) announcement.textContent = message;
  };

  // Starts a real run from what this page already holds: the URL typed into step 1 and the one
  // persona selected on the shelf in step 2 — one run, one persona, so the shelf's existing
  // single-selection is exactly the run's perspective. Neither is re-asked for.
  //
  // Two id translations are needed before POSTing, because neither piece of page state is a
  // real DB id:
  //
  //  * Persona. The shelf's personas come from apps/web/src/fixtures, whose ids are per-process
  //    crypto.randomUUID() values that no personas row matches (see app-shell-frame.tsx), so the
  //    selected one is matched to a DB persona by name.
  //  * Website. api/runs derives the run's allowedOrigins from its website's origin, and
  //    packages/agent/src/safe-navigation.ts refuses to navigate anywhere outside that
  //    allowlist. So the run must be attached to the website matching the URL actually typed
  //    here — NOT the sidebar's selected website, which is a different origin and makes the
  //    agent fail the target as origin_not_allowlisted. An origin that isn't tracked yet is
  //    registered first, the same way the websites page's NewWebsiteDialog does it.
  //
  // Anything that can't be resolved (no URL yet, nobody selected, no persona name match) falls
  // through to the shared NewRunDialog rather than failing silently, so the button always leads
  // somewhere.
  const beginRun = useCallback(async () => {
    const validUrl = validateWebsiteUrl(websiteUrl);
    const selectedPersona = personas.find((persona) => persona.id === selectedPersonId);
    if (!validUrl || !selectedPersona) {
      openNewRun();
      return;
    }

    setPlaying(false);
    setRunPending(true);
    try {
      const personasResponse = await fetch('/api/personas');
      if (!personasResponse.ok) throw new Error('Could not load personas.');
      const { items: dbPersonas }: { items: Persona[] } = await personasResponse.json();
      const dbPersona = dbPersonas.find((persona) => persona.name === selectedPersona.name);
      if (!dbPersona) {
        openNewRun();
        return;
      }

      const websiteId = await resolveWebsiteForOrigin(validUrl, websites, addWebsite);
      if (!websiteId) {
        announce(`Could not add ${validUrl.hostname} to your workspace.`);
        return;
      }

      const response = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          websiteId,
          url: validUrl.href,
          task: 'Explore the site and report anything that gets in the way of completing a typical task.',
          personaIds: [dbPersona.id],
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      if (!response.ok) {
        const error: { message?: string } = await response.json().catch(() => ({}));
        announce(error.message ?? 'Could not start the run.');
        return;
      }
      const { runId: newRunId }: { runId: string } = await response.json();
      const now = new Date().toISOString();
      saveLocalRun({
        runId: newRunId,
        websiteId,
        url: validUrl.href,
        personaName: selectedPersona.name,
        state: 'queued',
        createdAt: now,
        updatedAt: now,
      });
      announce('Run started.');
      // The tracker renders in Overview mode (see the mode/runId branch below), so switch back
      // to it — otherwise a run started from Live view would start invisibly.
      setMode('overview');
      router.push(`/journeys?runId=${newRunId}`);
    } catch (error) {
      console.error('Failed to start run', error);
      announce('Could not start the run.');
    } finally {
      setRunPending(false);
    }
  }, [websiteUrl, selectedPersonId, websites, addWebsite, openNewRun, setPlaying, setMode, router]);

  const cancelRun = useCallback(async () => {
    if (!runId || cancelPending) return;
    setCancelPending(true);
    try {
      const response = await fetch(`/api/runs/${runId}/cancel`, { method: 'POST' });
      if (!response.ok) {
        const error: { message?: string } = await response.json().catch(() => ({}));
        announce(error.message ?? 'Could not cancel the run.');
        setCancelPending(false);
        return;
      }
      setCancelledRunId(runId);
      setCancelPending(false);
      announce('Run cancelled.');
    } catch (error) {
      console.error('Failed to cancel run', error);
      announce('Could not cancel the run.');
      setCancelPending(false);
    }
  }, [runId, cancelPending]);

  return (
    <>
      {/* Three full-height scroll-snap steps — website URL, persona shelf, journey experience.
          scroll-snap-type: y mandatory (see .journey-steps in components.css) means scrolling
          past a step's threshold jumps cleanly to the next one; there is no partial/in-between
          resting state, unlike a scrubbed scroll animation. Native browser behavior, no JS
          scroll-position tracking involved. */}
      <div className="journey-steps">
        <section className="journey-step journey-website" aria-label="Website">
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
          <WebsitePreview rawUrl={websiteUrl} />
        </section>
        <div className="journey-step perspective-panel">
          <PersonaShelfSection
            onOpenLibrary={openLibrary}
            attachedPersonaIds={attachedPersonaIds}
          />
        </div>
        <div id="journey-results" className="journey-step journey-experience">
          <JourneyViewSwitch
            mode={mode}
            onChange={setMode}
            onBeginRun={() => void beginRun()}
            beginRunRunning={runRunning}
            onCancelRun={runId && runRunning ? () => void cancelRun() : undefined}
            cancelRunPending={cancellationRequested}
            statusLabel={runStatusLabel}
          />
          {mode === 'live' ? (
            runId ? (
              <LiveRunView progress={runProgress} error={runProgressError} />
            ) : (
              <LiveView onOpenFinding={openFinding} />
            )
          ) : runId ? (
            <LiveRunTracker progress={runProgress} error={runProgressError} />
          ) : (
            <OverviewAtlas />
          )}
        </div>
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
    </>
  );
}

function WebsitePreview({ rawUrl }: { rawUrl: string }) {
  const validUrl = useMemo(() => validateWebsiteUrl(rawUrl), [rawUrl]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'blocked'>('idle');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounces the raw input so a preview attempt doesn't fire on every keystroke, then loads
  // a real <iframe> of the entered site. Many real sites send X-Frame-Options/CSP
  // frame-ancestors headers that silently block embedding — no load/error event fires for that,
  // the frame just stays blank — so a load timeout is the only reliable signal something went
  // wrong, alongside the iframe's own onLoad for the sites that do allow it.
  useEffect(() => {
    if (!validUrl) {
      setStatus('idle');
      return;
    }
    setStatus('loading');
    const debounce = setTimeout(() => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setStatus((current) => (current === 'loading' ? 'blocked' : current));
      }, 4000);
    }, 500);
    return () => {
      clearTimeout(debounce);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [validUrl]);

  if (!validUrl) return null;

  return (
    <div className="journey-website-preview">
      {status === 'blocked' ? (
        <div className="journey-website-preview-blocked">
          <span>This site can&rsquo;t be embedded in a preview.</span>
          <a href={validUrl.href} target="_blank" rel="noreferrer noopener">
            Open {validUrl.hostname} in a new tab ↗
          </a>
        </div>
      ) : (
        <iframe
          key={validUrl.href}
          src={validUrl.href}
          title={`Preview of ${validUrl.hostname}`}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          referrerPolicy="no-referrer"
          onLoad={() => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            setStatus('loaded');
          }}
          onError={() => setStatus('blocked')}
        />
      )}
    </div>
  );
}

function PersonaShelfSection({
  onOpenLibrary,
  attachedPersonaIds,
}: {
  onOpenLibrary: () => void;
  attachedPersonaIds: Set<string>;
}) {
  const { selectedPersonId, setSelectedPersonId, setPlaying, setCaptureMessage } = useJourneyView();

  const people: PersonaShelfPerson[] = personas
    .filter((persona) => attachedPersonaIds.has(persona.id))
    .map((persona) => {
      return {
        id: persona.id,
        name: persona.name,
        emoji: persona.emoji,
        photoSrc: PERSONA_PHOTO_SRC[persona.name],
        widePhotoSrc: `/personas/${persona.name.toLowerCase()}-wide.png`,
        role: persona.goal,
        behavior: persona.behavior,
        colorClass: PERSONA_COLOR_CLASS[persona.name] ?? 'peach',
      };
    });

  const handleSelect = (id: string) => {
    setSelectedPersonId(id);
    setPlaying(false);
    setCaptureMessage('');
  };

  return (
    <PersonaShelf
      people={people}
      selectedPersonId={selectedPersonId}
      selectionMode="single"
      onSelect={handleSelect}
      onOpenLibrary={onOpenLibrary}
    />
  );
}

type ProcessStageStatus = 'complete' | 'active' | 'queued' | 'failed' | 'cancelled';

interface ProcessStageView {
  eyebrow: string;
  title: string;
  description: string;
  checkpoints: readonly string[];
  status: ProcessStageStatus;
  completedCheckpointCount?: number;
}

const PROCESS_STAGE_COPY = [
  {
    eyebrow: '01 · Understand',
    title: 'Context gathering',
    description: 'The AI reads the brief, applies the persona, and prepares a safe browser.',
    checkpoints: ['Load the persona and task', 'Check the target website', 'Prepare the browser'],
  },
  {
    eyebrow: '02 · Explore',
    title: 'Journey exploration',
    description:
      'The persona moves through the site and chooses each next step from what is visible.',
    checkpoints: ['Read the current page', 'Choose a safe action', 'Record the outcome'],
  },
  {
    eyebrow: '03 · Review',
    title: 'Evidence review',
    description:
      'Captured steps and screenshots are checked for friction, dead ends, and uncertainty.',
    checkpoints: ['Group the recorded steps', 'Identify points of friction', 'Check the evidence'],
  },
  {
    eyebrow: '04 · Deliver',
    title: 'Journey report',
    description:
      'The findings are turned into a clear account of what happened and what to improve.',
    checkpoints: ['Summarise the outcome', 'Prioritise findings', 'Link the evidence'],
  },
] as const;

function personaForId(id: string | null): Persona {
  return personas.find((candidate) => candidate.id === id) ?? personas[0]!;
}

function PersonaProcessVisual({
  persona,
}: {
  persona: Persona;
}) {
  return (
    <aside className="process-persona" aria-label={`Selected persona: ${persona.name}`}>
      <div className="process-persona-photo">
        <img src={PERSONA_PHOTO_SRC[persona.name]} alt="" />
      </div>
      <div className="process-persona-copy">
        <span>Selected perspective</span>
        <h2>{persona.name}</h2>
        <strong>{persona.goal}</strong>
        <p>{persona.behavior}</p>
      </div>
    </aside>
  );
}

function ProcessBoard({
  persona,
  stages,
  cancelled = false,
}: {
  persona: Persona;
  stages: ProcessStageView[];
  cancelled?: boolean;
}) {
  const currentIndex = stages.findIndex(
    (stage) =>
      stage.status === 'active' || stage.status === 'failed' || stage.status === 'cancelled',
  );
  const lastCompletedIndex = stages.reduce(
    (lastIndex, stage, index) => (stage.status === 'complete' ? index : lastIndex),
    0,
  );
  const activeIndex = currentIndex >= 0 ? currentIndex : lastCompletedIndex;
  const columnVars = Object.fromEntries(
    stages.map((_, index) => [
      `--process-card-${index}`,
      `${index === activeIndex ? 2.25 : 0.88}fr`,
    ]),
  ) as React.CSSProperties;

  return (
    <section className="map-panel process-board">
      <header className="process-board-header">
        <div>
          <span className="process-kicker">AI journey progress</span>
          <h2>Following {persona.name}&rsquo;s path</h2>
        </div>
      </header>
      {cancelled ? (
        <div className="process-cancelled-notice" role="status">
          <i aria-hidden="true">×</i>
          <strong>Run cancelled</strong>
          <span>The journey stopped before completion.</span>
        </div>
      ) : null}
      <div className="process-board-layout">
        <PersonaProcessVisual persona={persona} />
        <div className="process-flow" style={columnVars}>
          {stages.map((stage) => (
            <article
              key={stage.title}
              className={`process-stage process-stage-${stage.status}`}
              aria-current={stage.status === 'active' ? 'step' : undefined}
            >
              <div className="process-stage-topline">
                <span>{stage.eyebrow}</span>
                <i aria-label={stage.status} />
              </div>
              <div className="process-stage-copy">
                <h3>{stage.title}</h3>
                <p>{stage.description}</p>
              </div>
              <ul>
                {stage.checkpoints.map((checkpoint, checkpointIndex) => {
                  const completed =
                    stage.status === 'complete' ||
                    checkpointIndex < (stage.completedCheckpointCount ?? 0);
                  return (
                    <li
                      key={`${checkpoint}-${checkpointIndex}`}
                      className={
                        completed ? 'is-complete' : stage.status === 'failed' ? 'is-failed' : ''
                      }
                    >
                      <i aria-hidden="true" />
                      <span>{checkpoint}</span>
                    </li>
                  );
                })}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function OverviewAtlas() {
  const { selectedPersonId } = useJourneyView();
  const persona = personaForId(selectedPersonId);
  const stages: ProcessStageView[] = PROCESS_STAGE_COPY.map((stage, index) => ({
    ...stage,
    status: index === 0 ? 'active' : 'queued',
    completedCheckpointCount: 0,
  }));

  return <ProcessBoard persona={persona} stages={stages} />;
}

// The persisted worker states map onto the first three visual phases. Terminal outcomes occupy
// the report phase, which keeps the process understandable without exposing backend state names.
const TRACKER_STAGES: { state: SessionState; label: string }[] = [
  { state: 'starting', label: 'Context gathering' },
  { state: 'exploring', label: 'Journey exploration' },
  { state: 'analysing', label: 'Evidence review' },
];

const STEP_ACTION_LABEL: Record<Step['action'], string> = {
  navigate: 'Opened',
  click: 'Clicked',
  scroll: 'Scrolled',
  type: 'Typed into',
  wait: 'Waited',
  capture: 'Took a screenshot',
  finish: 'Finished',
};

function stepSummary(step: Step): string {
  const verb = STEP_ACTION_LABEL[step.action];
  if (
    step.outcome === 'error' &&
    (step.observation?.includes('subscribe button') || step.observation?.includes('#subscribe-btn'))
  ) {
    return 'The fixture action could not run on this website';
  }
  if (step.outcome === 'blocked') {
    return `${verb} — blocked${step.observation ? `: ${step.observation}` : ''}`;
  }
  if (step.outcome === 'error') {
    return `${verb} — didn't work${step.observation ? `: ${step.observation}` : ''}`;
  }
  if (step.observation) return `${verb} — ${step.observation}`;
  const url = step.urlAfter ?? step.urlBefore;
  if (url) {
    try {
      return `${verb} ${new URL(url).pathname || '/'}`;
    } catch {
      return verb;
    }
  }
  return verb;
}

interface RunProgressResponse {
  run: Run;
  sessions: {
    session: PersonaSession;
    persona: Persona;
    steps: Step[];
    report: PersonaReport | null;
  }[];
}

const TERMINAL_SESSION_STATES: readonly SessionState[] = ['completed', 'failed', 'cancelled'];

function useRunProgress(runId: string | null) {
  const [progress, setProgress] = useState<RunProgressResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) {
      setProgress(null);
      setError(null);
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const response = await fetch(`/api/runs/${runId}/progress`);
        if (!response.ok) {
          const body: { message?: string } = await response.json().catch(() => ({}));
          if (!cancelled) setError(body.message ?? 'Could not load run progress.');
          return;
        }
        const data: RunProgressResponse = await response.json();
        if (cancelled) return;
        setProgress(data);
        setError(null);
        const isTerminal =
          data.run.state === 'completed' ||
          data.run.state === 'completed_with_errors' ||
          data.run.state === 'failed' ||
          data.run.state === 'cancelled';
        if (!isTerminal) timeoutId = setTimeout(poll, 1200);
      } catch {
        if (!cancelled) setError('Could not load run progress.');
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [runId]);

  return { progress, error };
}

function LiveRunTracker({
  progress,
  error,
}: {
  progress: RunProgressResponse | null;
  error: string | null;
}) {
  const [selectedSessionIndex, setSelectedSessionIndex] = useState(0);

  if (error) {
    return (
      <section className="map-panel">
        <p role="alert">{error}</p>
      </section>
    );
  }
  if (!progress) {
    return (
      <section className="map-panel">
        <p aria-live="polite">Loading run…</p>
      </section>
    );
  }

  const sessionDetail = progress.sessions[selectedSessionIndex] ?? progress.sessions[0];
  if (!sessionDetail) {
    return (
      <section className="map-panel">
        <p>This run has no persona sessions yet.</p>
      </section>
    );
  }

  const { session, persona, steps, report } = sessionDetail;
  const isTerminal = TERMINAL_SESSION_STATES.includes(session.state);
  const activeStageIndex = TRACKER_STAGES.findIndex((stage) => stage.state === session.state);
  const failed = session.state === 'failed';
  const lastRecordedState = steps.at(-1)?.sessionState;
  const lastRecordedStageIndex = TRACKER_STAGES.findIndex(
    (stage) => stage.state === lastRecordedState,
  );
  const visualActiveIndex =
    session.state === 'completed'
      ? 3
      : isTerminal
        ? Math.max(lastRecordedStageIndex, 0)
        : Math.max(activeStageIndex, 0);
  const stages: ProcessStageView[] = PROCESS_STAGE_COPY.map((stage, index) => {
    const stageState = TRACKER_STAGES[index]?.state;
    const stageSteps = stageState ? steps.filter((step) => step.sessionState === stageState) : [];
    const recordedSteps = stageSteps.map(stepSummary);
    let checkpoints = recordedSteps.length > 0 ? recordedSteps.slice(-4) : [...stage.checkpoints];

    if (index === 3 && report) {
      checkpoints = [report.summary, ...stage.checkpoints.slice(1)];
    }
    if (index === visualActiveIndex && failed) {
      const isFixtureMismatch =
        session.failureMessage?.includes("locator('#subscribe-btn')") ||
        session.failureMessage?.includes('subscribe button');
      const visibleRecordedSteps = isFixtureMismatch
        ? recordedSteps.filter((step) => !step.includes('fixture action'))
        : recordedSteps;
      checkpoints = [
        ...visibleRecordedSteps.slice(-2),
        humanizeFailureMessage(session.failureMessage),
        failureRecoveryMessage(session.failureMessage),
      ].slice(-4);
    }

    const status: ProcessStageStatus =
      index < visualActiveIndex
        ? 'complete'
        : index > visualActiveIndex
          ? 'queued'
          : failed
            ? 'failed'
            : session.state === 'cancelled'
              ? 'cancelled'
              : session.state === 'completed'
                ? 'complete'
                : 'active';

    const completedCheckpointCount =
      status === 'complete' ? checkpoints.length : status === 'active' ? recordedSteps.length : 0;

    return { ...stage, checkpoints, status, completedCheckpointCount };
  });

  return (
    <section className="process-tracker-shell">
      {progress.sessions.length > 1 ? (
        <div className="process-session-tabs" role="tablist" aria-label="Persona sessions">
          <span>Viewing perspective</span>
          <div>
            {progress.sessions.map(({ session: s }, index) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={index === selectedSessionIndex}
                aria-pressed={index === selectedSessionIndex}
                onClick={() => setSelectedSessionIndex(index)}
              >
                {progress.sessions[index]?.persona.name ?? `Persona ${index + 1}`}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div aria-live="polite">
        <ProcessBoard
          persona={persona}
          stages={stages}
          cancelled={session.state === 'cancelled'}
        />
      </div>
    </section>
  );
}

function humanizeFailureMessage(message: string | null): string {
  if (!message) return 'The browser could not finish this journey';
  if (message.includes("locator('#subscribe-btn')") || message.includes('subscribe button')) {
    return 'This run used the fixture browser script instead of the persona AI';
  }
  if (message.includes('Persona AI is not configured')) {
    return 'The AI model is not configured for this worker';
  }
  if (message.includes('model repeated')) {
    return 'The persona could not make progress with its current action';
  }
  const originMatch = message.match(/origin_not_allowlisted:(https?:\/\/[^\s]+)/);
  if (originMatch?.[1]) {
    try {
      return `Navigation to ${new URL(originMatch[1]).hostname} was kept outside this run`;
    } catch {
      return 'A navigation outside the selected website was blocked';
    }
  }
  if (message.includes('authentication')) return 'The model connection needs to be checked';
  if (message.includes('timed_out')) return 'The journey reached its time limit';
  return message.replace(/^unsafe_target:/, '').replaceAll('_', ' ');
}

function failureRecoveryMessage(message: string | null): string {
  if (
    message?.includes("locator('#subscribe-btn')") ||
    message?.includes('subscribe button') ||
    message?.includes('Persona AI is not configured') ||
    message?.includes('authentication')
  ) {
    return 'Configure the AI worker, then start a new run';
  }
  if (message?.includes('timed_out')) return 'Increase the run limit, then try again';
  if (message?.includes('model repeated')) {
    return 'Continue from the last page and try a different action';
  }
  if (message?.includes('origin_not_allowlisted')) {
    return 'Check the target website, then start a new run';
  }
  return 'Start a new run after checking the worker';
}

interface LiveFrame {
  artifactId: string;
  step: Step;
}

function sessionStatusLabel(session: PersonaSession): string {
  if (session.state === 'completed') return 'Journey complete';
  if (session.state === 'failed') return 'Journey stopped';
  if (session.state === 'cancelled') return 'Run cancelled';
  if (session.state === 'analysing') return 'Reviewing evidence';
  if (session.state === 'exploring') return 'Exploring now';
  return 'Preparing browser';
}

function LiveRunView({
  progress,
  error,
}: {
  progress: RunProgressResponse | null;
  error: string | null;
}) {
  const router = useRouter();
  const [selectedSessionIndex, setSelectedSessionIndex] = useState(0);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(0);
  const [followLive, setFollowLive] = useState(true);
  const [unavailableArtifactId, setUnavailableArtifactId] = useState<string | null>(null);
  const [continuePending, setContinuePending] = useState(false);
  const [continueError, setContinueError] = useState<string | null>(null);

  const sessionDetail = progress?.sessions[selectedSessionIndex] ?? progress?.sessions[0];
  const frames = useMemo<LiveFrame[]>(
    () =>
      sessionDetail?.steps.flatMap((step) =>
        step.artifactIds.map((artifactId) => ({ artifactId, step })),
      ) ?? [],
    [sessionDetail],
  );

  useEffect(() => {
    if (followLive && frames.length > 0) setSelectedFrameIndex(frames.length - 1);
  }, [followLive, frames.length]);

  const frameIndex = Math.max(0, Math.min(selectedFrameIndex, frames.length - 1));
  const currentFrame = frames[frameIndex];
  const currentStep = currentFrame?.step;
  const persona = sessionDetail?.persona;
  const session = sessionDetail?.session;
  const latest = frameIndex === frames.length - 1;
  const isActive = session ? !TERMINAL_SESSION_STATES.includes(session.state) : false;
  const currentUrl = currentStep?.urlAfter ?? currentStep?.urlBefore ?? progress?.run.url;
  const viewportWidth = session?.device.viewportWidth ?? 1280;
  const viewportHeight = session?.device.viewportHeight ?? 800;
  const cursorStep = frames
    .slice(0, frameIndex + 1)
    .reverse()
    .find((frame) => frame.step.cursorX !== null && frame.step.cursorY !== null)?.step;
  const fallbackCursor = currentStep
    ? {
        x: 14 + ((currentStep.sequence * 23) % 68),
        y: 18 + ((currentStep.sequence * 31) % 62),
      }
    : { x: 10, y: 12 };
  const recordedCursorX = cursorStep?.cursorX;
  const recordedCursorY = cursorStep?.cursorY;
  const cursorX =
    recordedCursorX !== null && recordedCursorX !== undefined
      ? (recordedCursorX / viewportWidth) * 100
      : fallbackCursor.x;
  const cursorY =
    recordedCursorY !== null && recordedCursorY !== undefined
      ? (recordedCursorY / viewportHeight) * 100
      : fallbackCursor.y;
  const cursorStyle = {
    '--cursor-x': Math.max(1, Math.min(96, cursorX)),
    '--cursor-y': Math.max(1, Math.min(94, cursorY)),
  } as React.CSSProperties;

  const selectFrame = (index: number) => {
    setSelectedFrameIndex(index);
    setFollowLive(index === frames.length - 1);
    setUnavailableArtifactId(null);
  };

  const continueJourney = async () => {
    if (!progress || !sessionDetail || continuePending) return;
    setContinuePending(true);
    setContinueError(null);
    const lastStep = sessionDetail.steps.at(-1);
    const continuationUrl = lastStep?.urlAfter ?? lastStep?.urlBefore ?? progress.run.url;
    try {
      const response = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          websiteId: progress.run.websiteId,
          url: continuationUrl,
          task: progress.run.task,
          personaIds: [sessionDetail.persona.id],
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      if (!response.ok) {
        const responseError: { message?: string } = await response.json().catch(() => ({}));
        throw new Error(responseError.message ?? 'Could not continue the journey.');
      }
      const { runId: nextRunId }: { runId: string } = await response.json();
      const now = new Date().toISOString();
      saveLocalRun({
        runId: nextRunId,
        websiteId: progress.run.websiteId,
        url: continuationUrl,
        personaName: sessionDetail.persona.name,
        state: 'queued',
        createdAt: now,
        updatedAt: now,
      });
      router.replace(`/journeys?runId=${nextRunId}&from=home#journey-results`);
    } catch (continueFailure) {
      setContinueError(
        continueFailure instanceof Error
          ? continueFailure.message
          : 'Could not continue the journey.',
      );
      setContinuePending(false);
    }
  };

  if (error) {
    return (
      <section className="transmission real-live-view">
        <div className="live-empty" role="alert">
          <span aria-hidden="true">×</span>
          <strong>Live view unavailable</strong>
          <p>{error}</p>
        </div>
      </section>
    );
  }

  if (!progress || !sessionDetail || !persona || !session) {
    return (
      <section className="transmission real-live-view" aria-live="polite">
        <div className="live-empty is-loading">
          <span aria-hidden="true" />
          <strong>Connecting to the browser</strong>
          <p>The first frame will appear when the persona opens the website.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="transmission real-live-view">
      <header className="transmission-header real-live-header">
        <div>
          <img className="live-persona-avatar" src={PERSONA_PHOTO_SRC[persona.name] ?? ''} alt="" />
          <span>
            <small>Watching through their perspective</small>
            <h2>{persona.name}&rsquo;s live journey</h2>
          </span>
        </div>
        <div className="live-header-actions">
          <span className={`transmission-status${isActive ? ' is-live' : ''}`}>
            <i />
            {sessionStatusLabel(session)}
          </span>
          {!latest && frames.length > 0 ? (
            <button
              type="button"
              className="live-follow-button"
              onClick={() => {
                setFollowLive(true);
                setSelectedFrameIndex(frames.length - 1);
              }}
            >
              Jump to latest
            </button>
          ) : null}
        </div>
      </header>

      {progress.sessions.length > 1 ? (
        <div className="live-persona-tabs" role="tablist" aria-label="Persona sessions">
          {progress.sessions.map((detail, index) => (
            <button
              key={detail.session.id}
              type="button"
              role="tab"
              aria-selected={index === selectedSessionIndex}
              onClick={() => {
                setSelectedSessionIndex(index);
                setSelectedFrameIndex(0);
                setFollowLive(true);
              }}
            >
              {detail.persona.name}
            </button>
          ))}
        </div>
      ) : null}

      <div className="real-live-layout">
        <div className="live-browser-column">
          <div className="live-browser-window">
            <div className="live-browser-bar">
              <span className="live-browser-dots" aria-hidden="true">
                <i /> <i /> <i />
              </span>
              <span className="live-browser-address" title={currentUrl}>
                <i aria-hidden="true">⌁</i>
                {currentUrl
                  ? new URL(currentUrl).hostname + new URL(currentUrl).pathname
                  : 'Opening site…'}
              </span>
              <span className={`live-frame-count${isActive && latest ? ' is-live' : ''}`}>
                {isActive && latest ? 'LIVE' : `${frameIndex + 1} / ${Math.max(frames.length, 1)}`}
              </span>
            </div>
            <div
              className="live-browser-screen"
              aria-live="polite"
              style={{
                aspectRatio: `${viewportWidth} / ${viewportHeight}`,
              }}
            >
              {currentFrame && unavailableArtifactId !== currentFrame.artifactId ? (
                <img
                  key={currentFrame.artifactId}
                  src={`/api/artifacts/${currentFrame.artifactId}`}
                  alt={`Screenshot of ${currentUrl ?? 'the website'} captured while ${persona.name} ${STEP_ACTION_LABEL[currentFrame.step.action].toLowerCase()}`}
                  onError={() => setUnavailableArtifactId(currentFrame.artifactId)}
                />
              ) : (
                <div className="live-empty">
                  <span aria-hidden="true">{frames.length === 0 ? '◫' : '×'}</span>
                  <strong>
                    {frames.length === 0 ? 'Waiting for the first frame' : 'Frame unavailable'}
                  </strong>
                  <p>
                    {frames.length === 0
                      ? `${persona.name} is ${sessionStatusLabel(session).toLowerCase()}.`
                      : 'The screenshot could not be loaded from artifact storage.'}
                  </p>
                </div>
              )}
              {currentFrame ? (
                <div className="live-persona-cursor" style={cursorStyle} aria-hidden="true">
                  {currentStep?.action === 'click' ? (
                    <i key={currentStep.id} className="live-cursor-click" />
                  ) : null}
                  <svg width="22" height="27" viewBox="0 0 22 27" fill="none">
                    <path
                      d="M2 1.5L19.3 16.2L11.1 17.1L7.2 24.7L2 1.5Z"
                      fill="currentColor"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>{persona.name}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="live-playback">
            <div>
              <button
                type="button"
                className="circle"
                aria-label="Previous captured moment"
                disabled={frameIndex === 0 || frames.length === 0}
                onClick={() => selectFrame(frameIndex - 1)}
              >
                ←
              </button>
              <button
                type="button"
                className="circle"
                aria-label="Next captured moment"
                disabled={latest || frames.length === 0}
                onClick={() => selectFrame(frameIndex + 1)}
              >
                →
              </button>
            </div>
            <span>
              {currentStep
                ? `${STEP_ACTION_LABEL[currentStep.action]} · moment ${currentStep.sequence + 1}`
                : 'No moments captured yet'}
            </span>
          </div>
        </div>

        <aside className="live-activity-panel">
          <div className="live-activity-heading">
            <span>Journey activity</span>
            <strong>{sessionDetail.steps.length} actions</strong>
          </div>
          <div className="live-current-thought">
            <small>{currentStep ? 'What the persona observed' : 'Current state'}</small>
            <p>
              {currentStep?.observation ??
                `${persona.name} is preparing to inspect what is visible on the page.`}
            </p>
          </div>
          <ol className="live-action-list">
            {sessionDetail.steps.map((step) => {
              const artifactId = step.artifactIds.at(-1);
              const linkedFrameIndex = artifactId
                ? frames.findIndex((frame) => frame.artifactId === artifactId)
                : -1;
              const current = currentStep?.id === step.id;
              return (
                <li key={step.id} className={current ? 'is-current' : ''}>
                  <button
                    type="button"
                    disabled={linkedFrameIndex < 0}
                    onClick={() => selectFrame(linkedFrameIndex)}
                    aria-current={current ? 'step' : undefined}
                  >
                    <span className={`live-action-index is-${step.outcome}`}>
                      {step.outcome === 'success' ? '✓' : '!'}
                    </span>
                    <span>
                      <strong>{STEP_ACTION_LABEL[step.action]}</strong>
                      <small>{stepSummary(step)}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          {session.state === 'failed' ? (
            <div className="live-run-message is-error">
              <strong>Journey stopped</strong>
              <span>{humanizeFailureMessage(session.failureMessage)}</span>
              <button
                type="button"
                className="continue-journey-button"
                onClick={() => void continueJourney()}
                disabled={continuePending}
              >
                {continuePending ? 'Continuing…' : 'Continue to next step →'}
              </button>
              {continueError ? <small role="alert">{continueError}</small> : null}
            </div>
          ) : session.state === 'completed' ? (
            <div className="live-run-message is-complete">
              <strong>Journey complete</strong>
              <span>{sessionDetail.report?.summary ?? 'Evidence is ready to review.'}</span>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
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

  // A real run uses LiveRunView above. Until one exists, keep Live View neutral instead of
  // showing the old illustrative Forma walkthrough.
  const showIllustrativeTemplate = false;
  if (!showIllustrativeTemplate) {
    return (
      <section className="transmission">
        <div className="live-empty">
          <span aria-hidden="true">◎</span>
          <strong>Ready for a live run</strong>
          <p>Begin a run to see the journey appear here.</p>
        </div>
      </section>
    );
  }

  // Kept temporarily as the source for the real-run presentation while that view is migrated.
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
