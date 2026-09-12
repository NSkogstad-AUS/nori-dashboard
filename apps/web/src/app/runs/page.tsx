'use client';

// Ports prototype/app.js `runCards()`. See plan/PHASE_2_PLAN.md section 6.

import { useRouter } from 'next/navigation';
import { RunCard, NewRunCard, EmptyState } from '@nori/ui';
import { personas, websites, runs } from '../../fixtures/index';
import { findingsForRun } from '../../lib/journey-derivations';
import { useWorkspace } from '../../context/workspace-context';
import { useNewRunDialog } from '../../context/new-run-dialog-context';

const SITE_COLOR_CLASS: Record<string, string> = {
  Acme: 'peach',
  Forma: 'violet',
  Orbit: 'blue',
};

export default function RunsPage() {
  const router = useRouter();
  const { selectedWebsiteId } = useWorkspace();
  const { openDialog: openNewRun } = useNewRunDialog();
  // Phase 3: selectedWebsiteId now comes from real (DB-backed) websites via WorkspaceContext,
  // but runs/persona data here is still fixture-only (out of this phase's scope — see
  // plan/PHASE_3_PLAN.md section 1). A real website's id will not match any fixture website, so
  // this intentionally does NOT fall back to fixtures[0] on a miss — that would silently show
  // one real website's runs page as if it were Acme's fixture data.
  const activeWebsite = websites.find((site) => site.id === selectedWebsiteId);

  const matching = activeWebsite ? runs.filter((run) => run.websiteId === activeWebsite.id) : [];
  const personaEmojis = personas.slice(0, 3).map((persona) => persona.emoji);

  if (!activeWebsite) {
    return (
      <EmptyState
        tone="empty"
        title="No sample runs for this website"
        description="Sample runs are illustrative data tied to the Journey Atlas demo websites and aren't available for websites you've added yet."
      />
    );
  }

  return (
    <>
      <div className="view-intro">
        <p>Each run is a fresh set of eyes on your website.</p>
        <span className="subtle">{matching.length} sample runs</span>
      </div>
      {matching.length === 0 ? (
        <EmptyState
          tone="empty"
          title="No sample runs yet for this website"
          description="Create a sample run to see how different perspectives experience this site."
        />
      ) : (
        <div className="run-grid">
          {matching.map((run) => (
            <RunCard
              key={run.id}
              websiteUrl={new URL(activeWebsite.origin).hostname}
              title={run.task}
              date={new Date(run.createdAt).toLocaleDateString('en-US', {
                weekday: 'short',
                hour: 'numeric',
                minute: '2-digit',
              })}
              colorClass={SITE_COLOR_CLASS[activeWebsite.displayName] ?? 'peach'}
              personaEmojis={personaEmojis}
              pending={run.state === 'queued'}
              flaggedCount={findingsForRun(run.id).length}
              onOpen={() => router.push('/journeys')}
            />
          ))}
          <NewRunCard onCreate={openNewRun} />
        </div>
      )}
    </>
  );
}
