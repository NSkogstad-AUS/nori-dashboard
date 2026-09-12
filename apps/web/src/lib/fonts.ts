// Self-hosted font loading via next/font/google — see plan/PHASE_2_PLAN.md-adjacent design pass
// notes: this fetches font files at build time and serves them from the app's own origin, so
// there's no runtime CDN dependency or CSP/allowlist concern.
//
// Fraunces (display) carries the editorial-serif personality for page titles and stage names,
// used sparingly. Inter (body) is the reliable grotesk for everything functional — nav, cards,
// buttons, timestamps. Both expose a CSS variable that tokens.css/root layout wire up as
// --font-display / --font-body, with a system-font fallback stack baked into each `variable`
// definition's `fallback` option so a slow/failed font fetch never leaves text invisible.

import { Fraunces, Inter } from 'next/font/google';

export const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
  fallback: ['Georgia', 'ui-serif', 'serif'],
});

export const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
});
