'use client';

// New in Phase 3 (see plan/PHASE_3_PLAN.md section 4.5) — the first dialog in this app backed by
// a real API call rather than a fixture-only submit handler. Mirrors NewRunDialog's shape/URL
// validation logic (packages/ui/src/components/NewRunDialog.tsx).

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Dialog } from './Dialog';

export interface NewWebsiteSubmission {
  displayName: string;
  origin: string;
}

export interface NewWebsiteDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (submission: NewWebsiteSubmission) => Promise<void> | void;
}

/** Same validation rule as NewRunDialog's validateRunUrl: assumes https://, requires a hostname,
 *  rejects embedded credentials. Returns the parsed URL's origin on success, null on failure. */
function validateWebsiteOrigin(raw: string): URL | null {
  try {
    const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw);
    const url = new URL(hasScheme ? raw : `https://${raw}`);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export function NewWebsiteDialog({ open, onClose, onSubmit }: NewWebsiteDialogProps) {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const displayName = String(formData.get('displayName') ?? '').trim();
    const rawUrl = String(formData.get('origin') ?? '').trim();

    if (!displayName) {
      setError('Enter a name for this website.');
      return;
    }
    const url = validateWebsiteOrigin(rawUrl);
    if (!url) {
      setError('Enter a valid http or https website URL.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await onSubmit({ displayName, origin: url.origin });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not add this website.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} labelledBy="new-website-dialog-title">
      <button className="close circle" data-close aria-label="Close dialog" onClick={onClose}>
        ×
      </button>
      <span className="subtle">Track a new website</span>
      <h2 id="new-website-dialog-title">Which website should we track?</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="website-name">Website name</label>
        <input id="website-name" name="displayName" placeholder="Acme" required />
        <label htmlFor="website-origin">Website URL</label>
        <input id="website-origin" name="origin" placeholder="https://your-website.com" required />
        <p id="new-website-form-error" role="alert">
          {error}
        </p>
        <button type="submit" className="dark pill" disabled={submitting}>
          {submitting ? 'Adding…' : 'Add website →'}
        </button>
      </form>
    </Dialog>
  );
}
