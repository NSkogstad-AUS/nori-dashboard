import { z } from 'zod';
import { RUN_STATES, SESSION_STATES, CANCEL_REQUEST_STATES } from './state-machines';
import { sessionFailureKindSchema } from './agent';

// Data model from plan/IMPLEMENTATION_PLAN.md section 5.
// Every tenant-owned record carries a workspaceId; server-side authorization
// must never trust a workspaceId supplied by the browser.

export const workspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  createdAt: z.string().datetime(),
});
export type Workspace = z.infer<typeof workspaceSchema>;

export const membershipRoleSchema = z.enum(['owner', 'member']);

export const membershipSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().min(1),
  role: membershipRoleSchema,
  createdAt: z.string().datetime(),
});
export type Membership = z.infer<typeof membershipSchema>;

export const websiteAuthorizationStatusSchema = z.enum(['unverified', 'owner_verified', 'fixture']);

export const websiteSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  displayName: z.string().min(1),
  origin: z.string().url(),
  authorizationStatus: websiteAuthorizationStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Website = z.infer<typeof websiteSchema>;

export const personaDeviceSettingsSchema = z.object({
  viewportWidth: z.number().int().positive(),
  viewportHeight: z.number().int().positive(),
  userAgent: z.string().min(1),
  reducedMotion: z.boolean().default(false),
});
export type PersonaDeviceSettings = z.infer<typeof personaDeviceSettingsSchema>;

export const personaSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  version: z.number().int().positive(),
  emoji: z.string().min(1),
  goal: z.string().min(1),
  behavior: z.string().min(1),
  device: personaDeviceSettingsSchema,
  limitations: z.array(z.string()).default([]),
});
export type Persona = z.infer<typeof personaSchema>;

export const runLimitsSchema = z.object({
  maxActionsPerSession: z.number().int().positive().default(20),
  maxSessionSeconds: z.number().int().positive().default(180),
  hardCostCapUsd: z.number().positive().default(0.1),
});
export type RunLimits = z.infer<typeof runLimitsSchema>;

export const runStateSchema = z.enum(RUN_STATES);
export const cancelRequestStateSchema = z.enum(CANCEL_REQUEST_STATES);

export const runSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  websiteId: z.string().uuid(),
  url: z.string().url(),
  task: z.string().min(1),
  allowedOrigins: z.array(z.string().url()).min(1),
  limits: runLimitsSchema,
  state: runStateSchema,
  cancelRequestState: cancelRequestStateSchema,
  idempotencyKey: z.string().min(1),
  costTotalUsd: z.number().nonnegative().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Run = z.infer<typeof runSchema>;

export const sessionStateSchema = z.enum(SESSION_STATES);

export const personaSessionSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  personaId: z.string().uuid(),
  personaVersion: z.number().int().positive(),
  attempt: z.number().int().nonnegative().default(0),
  device: personaDeviceSettingsSchema,
  state: sessionStateSchema,
  failureKind: sessionFailureKindSchema.nullable(),
  failureMessage: z.string().max(2000).nullable(),
  heartbeatAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PersonaSession = z.infer<typeof personaSessionSchema>;

export const stepActionSchema = z.enum([
  'navigate',
  'click',
  'scroll',
  'type',
  'wait',
  'capture',
  'finish',
]);
export type StepAction = z.infer<typeof stepActionSchema>;

export const stepOutcomeSchema = z.enum(['success', 'error', 'blocked']);
export type StepOutcome = z.infer<typeof stepOutcomeSchema>;

export const stepSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  sequence: z.number().int().nonnegative(),
  action: stepActionSchema,
  outcome: stepOutcomeSchema,
  urlBefore: z.string().url().nullable(),
  urlAfter: z.string().url().nullable(),
  observation: z.string().max(2000).nullable(),
  artifactIds: z.array(z.string().uuid()).default([]),
  cursorX: z.number().int().nonnegative().nullable(),
  cursorY: z.number().int().nonnegative().nullable(),
  /** Which session state (see sessionStateSchema) was active when this step was recorded — lets
   *  a caller bucket a session's steps by stage (e.g. for a live progress view) without inferring
   *  it from step order. */
  sessionState: sessionStateSchema,
  createdAt: z.string().datetime(),
});
export type Step = z.infer<typeof stepSchema>;

export const artifactContentTypeSchema = z.enum(['image/png', 'image/jpeg']);
export type ArtifactContentType = z.infer<typeof artifactContentTypeSchema>;

export const artifactSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  stepId: z.string().uuid().nullable(),
  storageKey: z.string().min(1),
  contentType: artifactContentTypeSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  redacted: z.boolean().default(false),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});
export type Artifact = z.infer<typeof artifactSchema>;

export const findingCategorySchema = z.enum([
  'functional_issue',
  'navigation_friction',
  'clarity',
  'accessibility_signal',
  'performance_observation',
]);

export const findingSeveritySchema = z.enum(['low', 'moderate', 'high']);

export const findingSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  personaSessionIds: z.array(z.string().uuid()).min(1),
  stepIds: z.array(z.string().uuid()).min(1),
  artifactIds: z.array(z.string().uuid()).default([]),
  category: findingCategorySchema,
  severity: findingSeveritySchema,
  confidence: z.number().min(0).max(1),
  title: z.string().min(1),
  observedFact: z.string().min(1),
  inferredExplanation: z.string().min(1).nullable(),
  recommendation: z.string().min(1),
  reproductionSteps: z.array(z.string()).min(1),
  createdAt: z.string().datetime(),
});
export type Finding = z.infer<typeof findingSchema>;

export const runEventTypeSchema = z.enum([
  'run.status',
  'session.status',
  'step.started',
  'step.completed',
  'artifact.ready',
  'finding.created',
  'session.error',
  'run.finished',
]);

export const runEventSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  sessionId: z.string().uuid().nullable(),
  sequence: z.number().int().nonnegative(),
  type: runEventTypeSchema,
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
});
export type RunEvent = z.infer<typeof runEventSchema>;
