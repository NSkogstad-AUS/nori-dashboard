'use client';

// Small dedicated context so any page-level trigger (PageHeader's "+ New run", FloatingDock,
// RunCard's "add" card) can open the shared NewRunDialog owned by the root shell, without
// resorting to DOM queries or prop-drilling through every route. Scoped to the root layout
// alongside WorkspaceContext since the dialog itself is rendered there.

import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export interface NewRunDialogContextValue {
  open: boolean;
  openDialog: () => void;
  closeDialog: () => void;
}

const NewRunDialogContext = createContext<NewRunDialogContextValue | undefined>(undefined);

export function NewRunDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(
    () => ({ open, openDialog: () => setOpen(true), closeDialog: () => setOpen(false) }),
    [open],
  );
  return <NewRunDialogContext.Provider value={value}>{children}</NewRunDialogContext.Provider>;
}

export function useNewRunDialog(): NewRunDialogContextValue {
  const context = useContext(NewRunDialogContext);
  if (!context) {
    throw new Error('useNewRunDialog must be used within a NewRunDialogProvider');
  }
  return context;
}
