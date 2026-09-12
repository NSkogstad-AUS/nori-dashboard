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
  const activeWebsite = websites.find((site) => site.id === selectedWebsiteId) ?? websites[0]!;

  const matching = runs.filter((run) => run.websiteId === activeWebsite.id);
  const personaEmojis = personas.slice(0, 3).map((persona) => persona.emoji);

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
