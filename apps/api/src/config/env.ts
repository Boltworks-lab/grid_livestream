import { z } from 'zod';

// All input validated with zod at the edge (PROJECT_BRIEF §3.6) — the process
// environment included. Fail fast on boot rather than at first use.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
