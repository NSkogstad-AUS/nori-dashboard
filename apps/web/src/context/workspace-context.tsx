'use client';

// Replaces prototype/app.js's `state.site` / `state.collapsed`. Provided once at the apps/web
// layout root, wrapping AppShell — see plan/PHASE_2_PLAN.md section 5.

import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { websites } from '../fixtures/index';

export interface WorkspaceContextValue {
  selectedWebsiteId: string;
  setSelectedWebsiteId: (websiteId: string) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string>(
    () => websites[0]?.id ?? '',
  );
  const [collapsed, setCollapsed] = useState(false);

  const value = useMemo(
    () => ({ selectedWebsiteId, setSelectedWebsiteId, collapsed, setCollapsed }),
    [selectedWebsiteId, collapsed],
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
