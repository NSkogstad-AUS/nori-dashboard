'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

export interface DialogProps {
  /** Whether the dialog should be open (rendered via native `<dialog>.showModal()`). */
  open: boolean;
  /** Called when the dialog is dismissed — Escape key, backdrop click, or a close control. */
  onClose: () => void;
  /** id of the element that labels this dialog, wired to `aria-labelledby`. */
  labelledBy?: string;
  /** Dialog contents. */
  children: ReactNode;
  /** Optional extra class name applied to the native `<dialog>` element. */
  className?: string;
}

/**
 * Shared native `<dialog>` wrapper used by NewRunDialog, FindingDrawer, and
 * PersonaLibraryDialog (see plan/PHASE_2_PLAN.md section 5).
 *
 * Responsibilities kept in one place so they aren't reimplemented three times:
 * - Opens via `showModal()` / closes via `close()`, kept in sync with the `open` prop.
 * - Restores focus to whichever element triggered the dialog once it closes, by capturing
 *   `document.activeElement` at the moment `open` flips to `true`.
 * - Wires the native `close` and `cancel` (Escape) events back to `onClose`, and reflects
 *   backdrop clicks (a click landing on the `<dialog>` element itself, outside its content)
 *   as a close as well, matching native dialog UX expectations.
 * - Accepts `labelledBy` so callers can point `aria-labelledby` at their own heading id
 *   (the prototype's dialog uses `aria-labelledby="dialog-title"`).
 */
export function Dialog({ open, onClose, labelledBy, children, className }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    const dialogElement = dialogRef.current;
    if (!dialogElement) return;

    if (open) {
      triggerRef.current = document.activeElement;
      if (!dialogElement.open) {
        dialogElement.showModal();
      }
    } else if (dialogElement.open) {
      dialogElement.close();
    }
  }, [open]);

  useEffect(() => {
    const dialogElement = dialogRef.current;
    if (!dialogElement) return;

    const handleClose = () => {
      onClose();
      const trigger = triggerRef.current;
      if (trigger instanceof HTMLElement) {
        trigger.focus();
      }
    };

    dialogElement.addEventListener('close', handleClose);
    return () => dialogElement.removeEventListener('close', handleClose);
  }, [onClose]);

  const handleBackdropClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current) {
      dialogRef.current?.close();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className={className}
      aria-labelledby={labelledBy}
      onClick={handleBackdropClick}
    >
      {children}
    </dialog>
  );
}
