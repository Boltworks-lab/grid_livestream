import 'dotenv/config';

import { z } from 'zod';

// All input validated with zod at the edge (PROJECT_BRIEF §3.6) — the process
// environment included. Fail fast on boot rather than at first use.
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z
      .string()
      .url()
      // host port 5433: the dev machine runs a native PostgreSQL on 5432
      .default('postgresql://grid:grid@localhost:5433/grid'),
    REDIS_URL: z.string().url().default('redis://localhost:6379'),
    JWT_SECRET: z.string().min(32).default('dev-only-secret-change-me-0123456789abcdef'),
    /** access token TTL in seconds */
    JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
    /** refresh token TTL in days */
    REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  })
  .superRefine((cfg, ctx) => {
    // Secrets in env only, never defaults, in production (PROJECT_BRIEF §3.7).
    if (cfg.NODE_ENV === 'production' && cfg.JWT_SECRET.startsWith('dev-only-secret')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET must be set explicitly in production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
