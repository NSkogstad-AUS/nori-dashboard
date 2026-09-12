'use client';

// Ports prototype/app.js `websites()`. See plan/PHASE_2_PLAN.md section 6.

import { useRouter } from 'next/navigation';
import { websites, runs } from '../../fixtures/index';
import { useWorkspace } from '../../context/workspace-context';

const SITE_MARKS: Record<string, { mark: string; colorClass: string }> = {
  Acme: { mark: 'A', colorClass: 'peach' },
  Forma: { mark: 'F', colorClass: 'violet' },
  Orbit: { mark: 'O', colorClass: 'blue' },
};

export default function WebsitesPage() {
  const router = useRouter();
  const { setSelectedWebsiteId } = useWorkspace();

  return (
    <div className="site-grid">
      {websites.map((site) => {
        const marks = SITE_MARKS[site.displayName] ?? { mark: '?', colorClass: 'blue' };
        const runCount = runs.filter((run) => run.websiteId === site.id).length;
        return (
          <button
            key={site.id}
            type="button"
            className="website-card"
            onClick={() => {
              setSelectedWebsiteId(site.id);
              router.push('/runs');
            }}
          >
            <span className={`site-avatar ${marks.colorClass}`}>{marks.mark}</span>
            <h2>{site.displayName}</h2>
            <p>{new URL(site.origin).hostname}</p>
            <footer>
              <span>{runCount} sample runs</span>
              <span>Open website workspace ↗</span>
            </footer>
          </button>
        );
      })}
    </div>
  );
}
