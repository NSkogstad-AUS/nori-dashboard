'use client';

// Replaces prototype/app.js's `state.site` / `state.collapsed`. Provided once at the apps/web
// layout root, wrapping AppShell — see plan/PHASE_2_PLAN.md section 5.
//
// Phase 3: the website list is now real, server-fetched data (see apps/web/src/app/layout.tsx),
// not the fixtures array — seeded in via `initialWebsites` since a Server Component can't use
// context directly. `addWebsite` lets a newly-created website appear immediately (optimistic,
// not re-fetched) after NewWebsiteDialog's onSubmit succeeds, without a full page reload.

import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Website } from '@nori/contracts';

export interface WorkspaceContextValue {
  websites: Website[];
  addWebsite: (website: Website) => void;
  removeWebsite: (websiteId: string) => void;
  selectedWebsiteId: string;
  setSelectedWebsiteId: (websiteId: string) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({
  children,
  initialWebsites,
}: {
  children: ReactNode;
  initialWebsites: Website[];
}) {
  const [websites, setWebsites] = useState<Website[]>(initialWebsites);
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string>(
    () => initialWebsites[0]?.id ?? '',
  );
  const [collapsed, setCollapsed] = useState(false);

  const addWebsite = (website: Website) => {
    setWebsites((previous) => [website, ...previous]);
    setSelectedWebsiteId(website.id);
  };

  const removeWebsite = (websiteId: string) => {
    setWebsites((previous) => {
      const next = previous.filter((website) => website.id !== websiteId);
      setSelectedWebsiteId((selected) =>
        selected === websiteId ? (next[0]?.id ?? '') : selected,
      );
      return next;
    });
  };

  const value = useMemo(
    () => ({ websites, addWebsite, removeWebsite, selectedWebsiteId, setSelectedWebsiteId, collapsed, setCollapsed }),
    [websites, selectedWebsiteId, collapsed],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
