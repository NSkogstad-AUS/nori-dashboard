import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@nori/ui/src/tokens/tokens.css';
import '@nori/ui/src/tokens/motion.css';
import '@nori/ui/src/styles/components.css';
import { WorkspaceProvider } from '../context/workspace-context';
import { NewRunDialogProvider } from '../context/new-run-dialog-context';
import { AppShellFrame } from './app-shell-frame';

export const metadata: Metadata = {
  title: 'Nori',
  description: 'Nori — Journey Atlas sample workspace',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WorkspaceProvider>
          <NewRunDialogProvider>
            <AppShellFrame>{children}</AppShellFrame>
          </NewRunDialogProvider>
        </WorkspaceProvider>
        {/* Visually-hidden live region for cross-page announcements (e.g. new-run success),
            matching prototype/index.html's #announcement. */}
        <div id="announcement" className="sr-only" role="status" />
      </body>
    </html>
  );
}
