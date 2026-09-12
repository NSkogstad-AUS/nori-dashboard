import type { NextConfig } from 'next';

// @nori/ui ships TS/CSS source directly rather than a build output, so Next needs to transpile
// it as part of the app build (see plan/PHASE_2_PLAN.md's next.config.ts note).
const nextConfig: NextConfig = {
  transpilePackages: ['@nori/ui'],
};

export default nextConfig;
