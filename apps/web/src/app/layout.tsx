import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ClerkProvider } from '@clerk/nextjs';
import '@nori/ui/src/tokens/tokens.css';
import '@nori/ui/src/tokens/motion.css';
import '@nori/ui/src/styles/components.css';
import { WorkspaceProvider } from '../context/workspace-context';
import { NewRunDialogProvider } from '../context/new-run-dialog-context';
import { AppShellFrame } from './app-shell-frame';
import { inter } from '../lib/fonts';
import { requireWorkspace } from '../lib/workspace-auth';
import { listWebsitesForWorkspace } from '@nori/db';

export const metadata: Metadata = {
  title: 'Nori',
  description: 'Nori — Journey Atlas sample workspace',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The shell (sidebar site switcher, header) needs the real website list on every route, not
  // just /websites — fetched once here and passed down as props/seed data rather than each page
  // re-fetching independently. Middleware (apps/web/src/middleware.ts) already gates every route
  // except /api/health, /sign-in, /sign-up behind sign-in, so this fetch failing here means
  // something else went wrong (DB down, etc.). Wrapped so that failure renders the shell with an
  // empty website list rather than crashing the whole app.
  let websites: Awaited<ReturnType<typeof listWebsitesForWorkspace>> = [];
  try {
    const workspace = await requireWorkspace();
    websites = await listWebsitesForWorkspace(workspace.id);
  } catch (error) {
    console.error('RootLayout: failed to load workspace websites', error);
  }

  return (
    <ClerkProvider>
      <html lang="en" className={inter.variable}>
        <body>
          <WorkspaceProvider initialWebsites={websites}>
            <NewRunDialogProvider>
              <AppShellFrame>{children}</AppShellFrame>
            </NewRunDialogProvider>
          </WorkspaceProvider>
          {/* Visually-hidden live region for cross-page announcements (e.g. new-run success),
              matching prototype/index.html's #announcement. */}
          <div id="announcement" className="sr-only" role="status" />
        </body>
      </html>
    </ClerkProvider>
  );
}
