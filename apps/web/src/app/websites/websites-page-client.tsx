'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EmptyState } from '@nori/ui';
import { useWorkspace } from '../../context/workspace-context';
import { readLocalRuns, type LocalRun } from '../../lib/local-runs';
import type { Website } from '@nori/contracts';

const COLOR_CLASSES = ['peach', 'violet', 'blue', 'lime'];

function runStateLabel(state: LocalRun['state']): string {
  if (state === 'completed') return 'Journey complete';
  if (state === 'completed_with_errors') return 'Completed with issues';
  if (state === 'failed') return 'Journey failed';
  if (state === 'cancelled') return 'Journey cancelled';
  return 'Journey running';
}

export function WebsitesPageClient({ initialWebsites }: { initialWebsites: Website[] }) {
  const router = useRouter();
  const { websites, setSelectedWebsiteId } = useWorkspace();
  const [localRuns, setLocalRuns] = useState<LocalRun[]>([]);
  const displayedWebsites = websites.length > 0 ? websites : initialWebsites;

  useEffect(() => setLocalRuns(readLocalRuns()), []);

  const openJourney = (site: Website) => {
    setSelectedWebsiteId(site.id);
    const latestRun = localRuns.find((run) => run.websiteId === site.id);
    router.push(
      latestRun ? `/journeys?runId=${latestRun.runId}&from=home#journey-results` : '/journeys',
    );
  };

  if (displayedWebsites.length === 0) {
    return (
      <EmptyState
        tone="empty"
        title="No websites tracked yet"
        description="Start a journey with a website URL and it will appear here."
        action={
          <button
            type="button"
            className="dark pill"
            onClick={() => router.push('/journeys?new=1')}
          >
            + Add website
          </button>
        }
      />
    );
  }

  return (
    <>
      <div className="view-intro home-sites-intro">
        <div>
          <strong>Tracked websites</strong>
          <p>Open a saved journey or choose a website to create one.</p>
        </div>
        <button
          type="button"
          className="dark pill"
          onClick={() => router.push('/journeys?new=1')}
        >
          + Add website
        </button>
      </div>
      <div className="site-grid">
        {displayedWebsites.map((site, index) => {
          const colorClass = COLOR_CLASSES[index % COLOR_CLASSES.length];
          const siteRuns = localRuns.filter((run) => run.websiteId === site.id);
          const latestRun = siteRuns[0];
          return (
            <button
              key={site.id}
              type="button"
              className="website-card"
              onClick={() => openJourney(site)}
            >
              <span className={`site-avatar ${colorClass}`}>
                {site.displayName[0]?.toUpperCase() ?? '?'}
              </span>
              <h2>{site.displayName}</h2>
              <p>{new URL(site.origin).hostname}</p>
              <footer>
                <span>
                  {latestRun
                    ? `${siteRuns.length} saved ${siteRuns.length === 1 ? 'journey' : 'journeys'} · ${runStateLabel(latestRun.state)}`
                    : 'No saved journeys'}
                </span>
                <span>{latestRun ? 'Open latest journey ↗' : 'Start a journey ↗'}</span>
              </footer>
            </button>
          );
        })}
      </div>
    </>
  );
}
