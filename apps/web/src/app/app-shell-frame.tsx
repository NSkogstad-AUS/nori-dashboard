'use client';

// Client wrapper around @nori/ui's AppShell/Sidebar/PageHeader/FloatingDock/NewRunDialog, wired
// to real Next.js routing (replacing the prototype's state.view switch + hash hack — see
// plan/PHASE_2_PLAN.md section 5) and to WorkspaceContext for the active website + sidebar
// collapse state. Rendered once from the root layout so every route gets the same shell.

import { useMemo } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  AppShell,
  Sidebar,
  PageHeader,
  FloatingDock,
  NewRunDialog,
  type NewRunSubmission,
  type SidebarNavItem,
} from '@nori/ui';
import { useWorkspace } from '../context/workspace-context';
import { useNewRunDialog } from '../context/new-run-dialog-context';
import { personas } from '../fixtures/index';

const NAV_ITEMS: { href: string; label: string; icon: string }[] = [
  { href: '/', label: 'Home', icon: '⌂' },
  { href: '/journeys', label: 'Journeys', icon: '⌘' },
  { href: '/runs', label: 'Runs', icon: '▦' },
  { href: '/websites', label: 'Websites', icon: '◫' },
];

const SECTION_LABELS: Record<string, string> = {
  '/': 'Overview',
  '/journeys': 'Customer journeys',
  '/runs': 'Runs',
  '/websites': 'Websites',
};

const PAGE_TITLES: Record<string, string> = {
  '/': 'A clearer picture.',
  '/journeys': 'Customer journeys',
  '/runs': 'Your runs',
  '/websites': 'Your websites',
};

const COLOR_CLASS: Record<string, string> = {
  peach: 'peach',
  violet: 'violet',
  blue: 'blue',
};

const SITE_MARKS: Record<string, { mark: string; colorClass: string }> = {
  Acme: { mark: 'A', colorClass: 'peach' },
  Forma: { mark: 'F', colorClass: 'violet' },
  Orbit: { mark: 'O', colorClass: 'blue' },
};

export function AppShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { websites, selectedWebsiteId, setSelectedWebsiteId, collapsed, setCollapsed } =
    useWorkspace();
  const { open: newRunOpen, openDialog: openNewRun, closeDialog: closeNewRun } = useNewRunDialog();

  const activeWebsite = websites.find((site) => site.id === selectedWebsiteId) ?? websites[0];

  const navItems: SidebarNavItem[] = NAV_ITEMS.map((item) => ({
    ...item,
    active: pathname === item.href,
  }));

  const siteItems = websites.map((site) => {
    const marks = SITE_MARKS[site.displayName] ?? {
      mark: site.displayName[0] ?? '?',
      colorClass: 'blue',
    };
    return {
      id: site.id,
      name: site.displayName,
      mark: marks.mark,
      colorClass: COLOR_CLASS[marks.colorClass] ?? 'blue',
      active: site.id === selectedWebsiteId,
    };
  });

  const newRunPersonas = useMemo(
    () =>
      personas.map((persona) => ({
        id: persona.id,
        name: persona.name,
        emoji: persona.emoji,
        colorClass: 'peach',
      })),
    [],
  );

  const sectionLabel = SECTION_LABELS[pathname] ?? 'Overview';
  const title = PAGE_TITLES[pathname] ?? 'A clearer picture.';

  const handleNewRunSubmit = (submission: NewRunSubmission) => {
    // Fixture-only: Phase 2 has no backend, so a submitted run is only announced, not
    // persisted — matching the "no website is visited or tested" disclaimer in the dialog.
    closeNewRun();
    const announcement = document.getElementById('announcement');
    if (announcement) {
      announcement.textContent = 'Sample run added. No website was tested.';
    }
    void submission;
    router.push('/runs');
  };

  return (
    <>
      <AppShell
        collapsed={collapsed}
        sidebar={
          <Sidebar
            navItems={navItems}
            siteItems={siteItems}
            collapsed={collapsed}
            onToggleCollapsed={() => setCollapsed(!collapsed)}
            onSelectSite={(id) => {
              setSelectedWebsiteId(id);
              router.push('/runs');
            }}
            renderNavLink={(item, content) => <Link href={item.href}>{content}</Link>}
          />
        }
        header={
          <PageHeader
            websiteName={activeWebsite?.displayName ?? 'No websites yet'}
            sectionLabel={sectionLabel}
            title={title}
            showHeading={pathname !== '/journeys'}
            note="The whole experience, connected."
            onNewRun={openNewRun}
          />
        }
        floatingDock={
          <FloatingDock
            onOpenJourneys={() => router.push('/journeys')}
            onOpenRuns={() => router.push('/runs')}
            onNewRun={openNewRun}
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
