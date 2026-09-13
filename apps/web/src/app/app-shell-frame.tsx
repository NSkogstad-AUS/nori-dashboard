'use client';

// Client wrapper around @nori/ui's AppShell/Sidebar/PageHeader/FloatingDock/NewRunDialog, wired
// to real Next.js routing (replacing the prototype's state.view switch + hash hack — see
// plan/PHASE_2_PLAN.md section 5) and to WorkspaceContext for the active website + sidebar
// collapse state. Rendered once from the root layout so every route gets the same shell.

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  AppShell,
  Sidebar,
  PageHeader,
  NewRunDialog,
  type NewRunSubmission,
  type SidebarNavItem,
} from '@nori/ui';
import type { Persona } from '@nori/contracts';
import { useWorkspace } from '../context/workspace-context';
import { useNewRunDialog } from '../context/new-run-dialog-context';

const NAV_ITEMS: { href: string; label: string; icon: string }[] = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/journeys', label: 'Journey', icon: 'journeys' },
];

const SECTION_LABELS: Record<string, string> = {
  '/': 'Home',
  '/journeys': 'Journey',
  '/runs': 'Runs',
  '/websites': 'Websites',
};

const PAGE_TITLES: Record<string, string> = {
  '/': 'Your websites',
  '/journeys': 'New journey',
  '/runs': 'Your runs',
  '/websites': 'Your websites',
};

export function AppShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { websites, selectedWebsiteId, collapsed, setCollapsed } = useWorkspace();
  const { open: newRunOpen, closeDialog: closeNewRun } = useNewRunDialog();

  const activeWebsite = websites.find((site) => site.id === selectedWebsiteId) ?? websites[0];

  const navItems: SidebarNavItem[] = NAV_ITEMS.map((item) => ({
    ...item,
    active: pathname === item.href,
  }));

  // Real persona ids, fetched from the DB rather than apps/web/src/fixtures — the fixture
  // personas' ids are crypto.randomUUID() values generated fresh per process, so they never
  // match a real personas.id a run could actually reference. See plan/PHASE_5_PLAN.md's session
  // log ("Persona ID mismatch").
  const [personas, setPersonas] = useState<Persona[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/personas')
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((data: { items: Persona[] }) => {
        if (!cancelled) setPersonas(data.items);
      })
      .catch((error: unknown) => console.error('Failed to load personas', error));
    return () => {
      cancelled = true;
    };
  }, []);

  const newRunPersonas = useMemo(
    () =>
      personas.map((persona) => ({
        id: persona.id,
        name: persona.name,
        emoji: persona.emoji,
        colorClass: 'peach',
      })),
    [personas],
  );

  const sectionLabel = SECTION_LABELS[pathname] ?? 'Overview';
  const title = PAGE_TITLES[pathname] ?? 'A clearer picture.';

  const announce = (message: string) => {
    const announcement = document.getElementById('announcement');
    if (announcement) announcement.textContent = message;
  };

  const handleNewRunSubmit = async (submission: NewRunSubmission) => {
    closeNewRun();
    if (!selectedWebsiteId) {
      announce('Add a website before starting a run.');
      return;
    }
    try {
      const response = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          websiteId: selectedWebsiteId,
          url: submission.url,
          // NewRunDialog doesn't collect a task description yet — explore-and-report is the
          // default task every persona session runs against.
          task: 'Explore the site and report anything that gets in the way of completing a typical task.',
          personaIds: submission.personaIds,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      if (!response.ok) {
        const error: { message?: string } = await response.json().catch(() => ({}));
        announce(error.message ?? 'Could not start the run.');
        return;
      }
      const { runId }: { runId: string } = await response.json();
      announce('Run started.');
      router.push(`/journeys?runId=${runId}`);
    } catch (error) {
      console.error('Failed to start run', error);
      announce('Could not start the run.');
    }
  };

  return (
    <>
      <AppShell
        collapsed={collapsed}
        sidebar={
          <Sidebar
            navItems={navItems}
            collapsed={collapsed}
            onToggleCollapsed={() => setCollapsed(!collapsed)}
            renderNavLink={(item, content) => (
              <Link href={item.href} aria-current={item.active ? 'page' : undefined}>
                {content}
              </Link>
            )}
          />
        }
        header={
          <PageHeader
            websiteName={activeWebsite?.displayName ?? 'No websites yet'}
            sectionLabel={sectionLabel}
            title={title}
            showHeading={pathname !== '/journeys'}
            note={
              pathname === '/'
                ? 'Track a website or choose one to start a new journey.'
                : 'See the whole experience, connected.'
            }
          />
        }
      >
        {children}
      </AppShell>
      <NewRunDialog
        open={newRunOpen}
        onClose={closeNewRun}
        personas={newRunPersonas}
        onSubmit={handleNewRunSubmit}
      />
    </>
  );
}
