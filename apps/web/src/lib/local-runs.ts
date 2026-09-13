import type { RunState } from '@nori/contracts';

const STORAGE_KEY = 'nori.local-runs.v1';

export interface LocalRun {
  runId: string;
  websiteId: string;
  url: string;
  personaName: string;
  state: RunState;
  createdAt: string;
  updatedAt: string;
}

export function readLocalRuns(): LocalRun[] {
  if (typeof window === 'undefined') return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(value) ? (value as LocalRun[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalRun(run: LocalRun): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = readLocalRuns().filter((item) => item.runId !== run.runId);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([run, ...existing].slice(0, 50)));
  } catch {
    // A run should still start if private browsing or a storage quota blocks local history.
  }
}

export function updateLocalRunState(runId: string, state: RunState, updatedAt: string): void {
  if (typeof window === 'undefined') return;
  try {
    const runs = readLocalRuns();
    const index = runs.findIndex((run) => run.runId === runId);
    if (index < 0) return;
    runs[index] = { ...runs[index]!, state, updatedAt };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
  } catch {
    // Progress polling should not fail because local history is unavailable.
  }
}

export function removeLocalRunsForWebsite(websiteId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const remaining = readLocalRuns().filter((run) => run.websiteId !== websiteId);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
  } catch {
    // The server deletion has still succeeded if browser storage is unavailable.
  }
}
