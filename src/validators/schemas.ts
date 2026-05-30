import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const demandForecastGenerateSchema = z.object({
  horizonDays: z.number().int().positive(),
  includeSeasonality: z.boolean().optional(),
});

export const triggerPipelineSchema = z.object({
  source: z.string().min(1, 'Source is required'),
});

export const aiInsightsSchema = z.object({
  context: z.string().min(1, 'Context is required'),
  data: z.record(z.string(), z.any()),
});

// Query param schemas (can be used for validation if needed, or inline)
export const periodQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d']).optional().default('30d'),
});
