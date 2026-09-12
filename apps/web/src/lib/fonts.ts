// Self-hosted font loading via next/font/google — this fetches font files at build time and
// serves them from the app's own origin, so there's no runtime CDN dependency or CSP/allowlist
// concern.
//
// Inter is used for everything on the page — headings and body copy alike, matching the
// typeface used in the embedded Framer feature-flipper component (apps/web/framer) so the whole
// page reads as one consistent typographic system. It's assigned to both --font-display and
// --font-body (see layout.tsx) rather than removing the --font-display token, so every component
// that already references var(--font-display) keeps working without a CSS rewrite.

import { Inter } from 'next/font/google';

export const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
});
