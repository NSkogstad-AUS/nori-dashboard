import { z } from 'zod';
import { runLimitsSchema, runSchema, websiteSchema } from './entities';

// API sketch from plan/IMPLEMENTATION_PLAN.md section 5.

export const errorCodeSchema = z.enum([
  'validation_failed',
  'unauthorized',
  'forbidden',
  'not_found',
  'idempotency_conflict',
  'rate_limited',
  'cost_cap_exceeded',
  'unsafe_target',
  'internal_error',
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const apiErrorSchema = z.object({
  code: errorCodeSchema,
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export const createWebsiteRequestSchema = z.object({
  displayName: z.string().min(1),
  origin: z.string().url(),
});
export type CreateWebsiteRequest = z.infer<typeof createWebsiteRequestSchema>;

export const createWebsiteResponseSchema = websiteSchema;

export const createRunRequestSchema = z.object({
  websiteId: z.string().uuid(),
  url: z.string().url(),
  task: z.string().min(1),
  personaIds: z.array(z.string().uuid()).min(1).max(3),
  limits: runLimitsSchema.partial().optional(),
  idempotencyKey: z.string().min(1),
});
export type CreateRunRequest = z.infer<typeof createRunRequestSchema>;

export const createRunResponseSchema = z.object({
  runId: z.string().uuid(),
});
export type CreateRunResponse = z.infer<typeof createRunResponseSchema>;

export const listRunsQuerySchema = z.object({
  websiteId: z.string().uuid().optional(),
  state: runSchema.shape.state.optional(),
  cursor: z.string().optional(),
  limit: z.number().int().positive().max(100).default(20),
});
export type ListRunsQuery = z.infer<typeof listRunsQuerySchema>;

export const paginatedSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
