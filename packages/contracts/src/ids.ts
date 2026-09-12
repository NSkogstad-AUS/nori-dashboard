import { z } from 'zod';

export const workspaceId = z.string().uuid().brand('WorkspaceId');
export const websiteId = z.string().uuid().brand('WebsiteId');
export const runId = z.string().uuid().brand('RunId');
export const sessionId = z.string().uuid().brand('SessionId');
export const stepId = z.string().uuid().brand('StepId');
export const artifactId = z.string().uuid().brand('ArtifactId');
export const findingId = z.string().uuid().brand('FindingId');

export type WorkspaceId = z.infer<typeof workspaceId>;
export type WebsiteId = z.infer<typeof websiteId>;
export type RunId = z.infer<typeof runId>;
export type SessionId = z.infer<typeof sessionId>;
export type StepId = z.infer<typeof stepId>;
export type ArtifactId = z.infer<typeof artifactId>;
export type FindingId = z.infer<typeof findingId>;
