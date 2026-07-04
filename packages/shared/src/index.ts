import { z } from 'zod';

/**
 * Platform fee fractions (PROJECT_BRIEF §1). Server-authoritative: the API computes
 * every split from these; clients may only display them (PROJECT_BRIEF §3.2).
 */
export const PLATFORM_FEES = {
  gift: 0.3,
  subscription: 0.3,
  ppv: 0.25,
} as const;

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  timestamp: z.string(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
