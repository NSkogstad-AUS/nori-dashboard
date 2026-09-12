// Fixture-only. Illustrative data for the Journey Atlas sample workspace — these are fictional
// sample runs, not real test executions. See plan/PHASE_2_PLAN.md section 4.

import type { Run, RunLimits } from '@nori/contracts';
import { runIds, websiteIds, workspaceId } from './ids';

// Phase 0 session limits (20 actions / 180s / $0.50 cap), already modeled in RunLimits.
const DEFAULT_LIMITS: RunLimits = {
  maxActionsPerSession: 20,
  maxSessionSeconds: 180,
  hardCostCapUsd: 0.5,
};

// Ported from prototype/app.js `runs` array: title/site/date/count map directly; all four
// pre-existing runs are `completed` (a `queued` run is created at runtime via the New Run
// dialog — see plan/PHASE_2_PLAN.md section 5 — and is not part of this static fixture list).
export const runs: Run[] = [
  {
    id: runIds.run1,
    workspaceId,
    websiteId: websiteIds.acme,
    url: 'https://acme.example',
    task: 'First visit → first project',
    allowedOrigins: ['https://acme.example'],
    limits: DEFAULT_LIMITS,
    state: 'completed',
    cancelRequestState: 'none',
    idempotencyKey: 'fixture-run-1',
    costTotalUsd: 0.18,
    createdAt: '2026-09-12T10:42:00.000Z',
    updatedAt: '2026-09-12T10:58:00.000Z',
  },
  {
    id: runIds.run2,
    workspaceId,
    websiteId: websiteIds.acme,
    url: 'https://acme.example/pricing',
    task: 'Pricing → account',
    allowedOrigins: ['https://acme.example'],
    limits: DEFAULT_LIMITS,
    state: 'completed',
    cancelRequestState: 'none',
    idempotencyKey: 'fixture-run-2',
    costTotalUsd: 0.16,
    createdAt: '2026-09-11T14:10:00.000Z',
    updatedAt: '2026-09-11T14:26:00.000Z',
  },
  {
    id: runIds.run3,
    workspaceId,
    websiteId: websiteIds.forma,
    url: 'https://forma.example',
    task: 'Discover the collection',
    allowedOrigins: ['https://forma.example'],
    limits: DEFAULT_LIMITS,
    state: 'completed',
    cancelRequestState: 'none',
    idempotencyKey: 'fixture-run-3',
    costTotalUsd: 0.14,
    createdAt: '2026-09-08T09:20:00.000Z',
    updatedAt: '2026-09-08T09:35:00.000Z',
  },
  {
    id: runIds.run4,
    workspaceId,
    websiteId: websiteIds.orbit,
    url: 'https://orbit.example',
    task: 'Start a workspace',
    allowedOrigins: ['https://orbit.example'],
    limits: DEFAULT_LIMITS,
    state: 'completed',
    cancelRequestState: 'none',
    idempotencyKey: 'fixture-run-4',
    costTotalUsd: 0.2,
    createdAt: '2026-09-07T11:05:00.000Z',
    updatedAt: '2026-09-07T11:22:00.000Z',
  },
];
