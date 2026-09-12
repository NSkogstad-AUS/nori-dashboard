'use client';

// Ports prototype/app.js `overview()`. See plan/PHASE_2_PLAN.md section 6.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { personas, websites, runs } from '../fixtures/index';
import { STAGE_NAMES, findingsForRun, findingsAtStage } from '../lib/journey-derivations';
import { useWorkspace } from '../context/workspace-context';

const PERSONA_COLOR_CLASS: Record<string, string> = {
  Alex: 'peach',
  Jamie: 'blue',
  Sam: 'violet',
  Riley: 'lime',
};

const SITE_MARKS: Record<string, { mark: string; colorClass: string }> = {
  Acme: { mark: 'A', colorClass: 'peach' },
  Forma: { mark: 'F', colorClass: 'violet' },
  Orbit: { mark: 'O', colorClass: 'blue' },
};

const STAGE_DOT_COLORS = ['blue', 'violet', 'peach', 'lime'];

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date('2026-09-12T12:00:00.000Z');
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (diffDays <= 0) return `Today, ${time}`;
  if (diffDays === 1) return `Yesterday, ${time}`;
  return date.toLocaleDateString('en-US', { weekday: 'short' }) + `, ${time}`;
}

export default function HomePage() {
  const router = useRouter();
  const { selectedWebsiteId } = useWorkspace();
  const activeWebsite = websites.find((site) => site.id === selectedWebsiteId) ?? websites[0]!;

  const totalFlagged = runs.reduce((sum, run) => sum + findingsForRun(run.id).length, 0);

  return (
    <div className="overview-grid">
      <section className="welcome-panel">
        <span className="eyebrow">Your workspace, at a glance</span>
        <h2>
          A fresh look at
          <br />
          what matters.
        </h2>
        <p>{websites.length} websites. A few new perspectives.</p>
        <Link href="/journeys" className="dark pill">
          Explore customer journeys ↗
        </Link>
        <div className="overview-people">
          {personas.map((person) => (
            <span key={person.id} className={`emoji ${PERSONA_COLOR_CLASS[person.name] ?? 'peach'}`}>
              {person.emoji}
            </span>
          ))}
        </div>
      </section>
      <section className="metric-panel">
        <span className="eyebrow">Across your workspace</span>
        <div>
          <strong>{String(runs.length).padStart(2, '0')}</strong>
          <span>sample runs</span>
        </div>
        <div>
          <strong>{String(websites.length).padStart(2, '0')}</strong>
          <span>websites tracked</span>
        </div>
        <div>
          <strong>{String(totalFlagged).padStart(2, '0')}</strong>
          <span>flagged moments</span>
        </div>
      </section>
      <section className="overview-journey">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Latest journey / {activeWebsite.displayName}</span>
            <h2>Where people pause</h2>
          </div>
          <button
            type="button"
            className="circle"
            aria-label="Explore journey"
            onClick={() => router.push('/journeys')}
          >
            ↗
          </button>
        </div>
        <div className="mini-stages">
          {STAGE_NAMES.map((stage, index) => (
            <button key={stage} type="button" onClick={() => router.push('/journeys')}>
              <span className={`mini-dot ${STAGE_DOT_COLORS[index]}`}>0{index + 1}</span>
              <strong>{stage}</strong>
              <small>{findingsAtStage(index).length} issues</small>
            </button>
          ))}
        </div>
        <div className="mini-path" />
        <p className="subtle">Most friction appears between choosing a plan and signing up.</p>
      </section>
      <section className="recent-panel">
        <div className="panel-head">
          <h2>Recent runs</h2>
          <Link href="/runs" className="text-button">
            View all ↗
          </Link>
        </div>
        {runs.slice(0, 3).map((run) => {
          const site = websites.find((candidate) => candidate.id === run.websiteId)!;
          const marks = SITE_MARKS[site.displayName] ?? { mark: '?', colorClass: 'blue' };
          return (
            <button
              key={run.id}
              type="button"
              className="recent-row"
              onClick={() => router.push('/runs')}
            >
              <span className={`site-avatar ${marks.colorClass}`}>{marks.mark}</span>
              <span>
                <strong>{run.task}</strong>
                <small>
                  {new URL(site.origin).hostname} · {formatRelativeDate(run.createdAt)}
                </small>
              </span>
              <span>↗</span>
            </button>
          );
        })}
      </section>
    </div>
  );
}
