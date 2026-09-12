import { z } from 'zod';

export const actionableElementSchema = z.object({
  id: z.string().min(1).max(80),
  tag: z.string().min(1).max(32),
  role: z.string().max(64).nullable(),
  name: z.string().max(300),
  type: z.string().max(64).nullable(),
  disabled: z.boolean(),
});
export type ActionableElement = z.infer<typeof actionableElementSchema>;

export const pageObservationSchema = z.object({
  url: z.string().url(),
  title: z.string().max(500),
  visibleText: z.string().max(12_000),
  elements: z.array(actionableElementSchema).max(100),
});
export type PageObservation = z.infer<typeof pageObservationSchema>;

const elementIdSchema = z.string().min(1).max(80);

export const browserActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('navigate'), url: z.string().url() }),
  z.object({ kind: z.literal('click'), elementId: elementIdSchema }),
  z.object({ kind: z.literal('scroll'), deltaY: z.number().int().min(-2000).max(2000) }),
  z.object({ kind: z.literal('type'), elementId: elementIdSchema, text: z.string().max(500) }),
  z.object({ kind: z.literal('wait'), milliseconds: z.number().int().min(100).max(3000) }),
  z.object({ kind: z.literal('capture') }),
  z.object({
    kind: z.literal('finish'),
    outcome: z.enum(['task_success', 'task_failure']),
    summary: z.string().min(1).max(1000),
  }),
]);
export type BrowserAction = z.infer<typeof browserActionSchema>;

export const agentDecisionSchema = z.object({
  action: browserActionSchema,
  observation: z.string().min(1).max(1000),
});
export type AgentDecision = z.infer<typeof agentDecisionSchema>;

export const modelUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
});
export type ModelUsage = z.infer<typeof modelUsageSchema>;

export const personaReportOutcomeSchema = z.enum(['task_success', 'task_failure']);
export type PersonaReportOutcome = z.infer<typeof personaReportOutcomeSchema>;

export const personaReportSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  sessionId: z.string().uuid(),
  outcome: personaReportOutcomeSchema,
  summary: z.string().min(1).max(2000),
  evidenceStepIds: z.array(z.string().uuid()),
  modelProvider: z.string().min(1),
  modelId: z.string().min(1),
  promptVersion: z.string().min(1),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
  createdAt: z.string().datetime(),
});
export type PersonaReport = z.infer<typeof personaReportSchema>;

export const sessionFailureKindSchema = z.enum(['model_failure', 'infrastructure_failure']);
export type SessionFailureKind = z.infer<typeof sessionFailureKindSchema>;
