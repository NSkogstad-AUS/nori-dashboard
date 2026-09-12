// Fixture-only. Illustrative data for the Journey Atlas sample workspace — these are fictional
// websites, not real customer properties. See plan/PHASE_2_PLAN.md section 4.

import type { Website } from '@nori/contracts';
import { websiteIds, workspaceId } from './ids';

const FIXTURE_TIMESTAMP = '2026-09-01T09:00:00.000Z';

// authorizationStatus is 'fixture' for all three, matching the Phase 0 decision to keep the
// first release on owned fixtures only (plan/PHASE_2_PLAN.md section 4).
export const websites: Website[] = [
  {
    id: websiteIds.acme,
    workspaceId,
    displayName: 'Acme',
    origin: 'https://acme.example',
    authorizationStatus: 'fixture',
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
  },
  {
    id: websiteIds.forma,
    workspaceId,
    displayName: 'Forma',
    origin: 'https://forma.example',
    authorizationStatus: 'fixture',
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
  },
  {
    id: websiteIds.orbit,
    workspaceId,
    displayName: 'Orbit',
    origin: 'https://orbit.example',
    authorizationStatus: 'fixture',
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
  },
];
