import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

// Keep development assets separate so a production build cannot remove the
// JavaScript chunks needed to hydrate pages in the running development server.
export default function nextConfig(phase: string): NextConfig {
  return {
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
    // @nori/ui, @nori/contracts, and @nori/db all ship TypeScript source directly (no build
    // step) with .js-suffixed relative imports resolved by tsc's bundler-mode resolution —
    // Next's own webpack resolver needs these listed here to remap those imports the same way,
    // or it fails with "Module not found: Can't resolve './whatever.js'".
    transpilePackages: ['@nori/ui', '@nori/contracts', '@nori/db'],
  };
}
