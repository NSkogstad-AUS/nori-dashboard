// Ports prototype/app.js `render()`'s outer `.shell` grid (rail + main) — see
// plan/PHASE_2_PLAN.md sections 3 and 6. Composition only: Sidebar/PageHeader/FloatingDock are
// passed in as children/props by the consuming layout so AppShell itself stays route-agnostic.

import type { ReactNode } from 'react';

export interface AppShellProps {
  collapsed: boolean;
  sidebar: ReactNode;
  header: ReactNode;
  floatingDock?: ReactNode;
  children: ReactNode;
}

export function AppShell({ collapsed, sidebar, header, floatingDock, children }: AppShellProps) {
  return (
    <>
      <div className={`shell${collapsed ? ' collapsed' : ''}`}>
        {sidebar}
        <main>
          {header}
          {children}
          <footer className="page-footer">
            <span>All journeys and findings are fictional. No live agents.</span>
            <span>Nori / A fresh perspective</span>
          </footer>
        </main>
      </div>
      {floatingDock}
    </>
  );
}
