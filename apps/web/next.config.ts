import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

// Keep development assets separate so a production build cannot remove the
// JavaScript chunks needed to hydrate pages in the running development server.
export default function nextConfig(phase: string): NextConfig {
  return {
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
    // @nori/ui ships TypeScript and CSS source directly.
    transpilePackages: ['@nori/ui'],
  };
}
