// Shared with packages/ui/src/components/NewRunDialog.tsx's inline validator — kept here too
// since NewRunDialog doesn't export it and apps/web needs the same rule for the website preview
// input. Validates a raw URL string the same way prototype/app.js's submit handler did: assumes
// `https://` when no scheme is given, requires http/https, a hostname, and no embedded
// credentials. Returns the parsed URL on success or null on failure.
export function validateWebsiteUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
    const url = new URL(hasScheme ? trimmed : `https://${trimmed}`);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}
