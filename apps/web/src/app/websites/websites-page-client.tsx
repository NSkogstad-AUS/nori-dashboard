'use client';

// Client half of the Server Component split in page.tsx — owns the interactive bits (card
// click → select + navigate, the "Add website" dialog and its POST /api/websites call) while
// the initial website list is server-fetched, real data (see plan/PHASE_3_PLAN.md section 4.5).

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EmptyState, NewWebsiteDialog, type NewWebsiteSubmission } from '@nori/ui';
import { useWorkspace } from '../../context/workspace-context';
import type { Website } from '@nori/contracts';

const COLOR_CLASSES = ['peach', 'violet', 'blue', 'lime'];

export function WebsitesPageClient({ initialWebsites }: { initialWebsites: Website[] }) {
  const router = useRouter();
  const { websites, addWebsite, setSelectedWebsiteId } = useWorkspace();
  const [dialogOpen, setDialogOpen] = useState(false);

  // WorkspaceContext is seeded from the same server fetch (see layout.tsx) and is the shared,
  // up-to-date source once a website is added — falls back to the page's own server-fetched
  // list only if context somehow hasn't picked it up yet (shouldn't normally happen since both
  // read the same initial data).
  const displayedWebsites = websites.length > 0 ? websites : initialWebsites;

  // Errors are surfaced inside NewWebsiteDialog itself (it catches whatever this throws and
  // shows it in its own form-error region) — nothing further to do with them here beyond
  // closing the dialog on success.
  const handleSubmit = async (submission: NewWebsiteSubmission) => {
    const response = await fetch('/api/websites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submission),
    });
    if (!response.ok) {
      const error: unknown = await response.json().catch(() => null);
      const message =
        error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
          ? error.message
          : 'Could not add this website.';
      throw new Error(message);
    }
    const website = (await response.json()) as Website;
    addWebsite(website);
    setDialogOpen(false);
  };

  if (displayedWebsites.length === 0) {
    return (
      <>
        <EmptyState
          tone="empty"
          title="No websites tracked yet"
          description="Add a website to start creating sample runs against it."
          action={
            <button type="button" className="dark pill" onClick={() => setDialogOpen(true)}>
              + Add website
            </button>
          }
        />
        <NewWebsiteDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSubmit={handleSubmit}
        />
      </>
    );
  }

  return (
    <>
      <div className="view-intro home-sites-intro">
        <div>
          <strong>Tracked websites</strong>
          <p>Choose a website to create a new journey.</p>
        </div>
        <button type="button" className="dark pill" onClick={() => setDialogOpen(true)}>
          + Add website
        </button>
      </div>
      <div className="site-grid">
        {displayedWebsites.map((site, index) => {
          const colorClass = COLOR_CLASSES[index % COLOR_CLASSES.length];
          return (
            <button
              key={site.id}
              type="button"
              className="website-card"
              onClick={() => {
                setSelectedWebsiteId(site.id);
                router.push('/journeys');
              }}
            >
              <span className={`site-avatar ${colorClass}`}>
                {site.displayName[0]?.toUpperCase() ?? '?'}
              </span>
              <h2>{site.displayName}</h2>
              <p>{new URL(site.origin).hostname}</p>
              <footer>
                <span>Ready to test</span>
                <span>Start a journey ↗</span>
              </footer>
            </button>
          );
        })}
      </div>
      <NewWebsiteDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
      />
    </>
  );
}
