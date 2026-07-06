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
    /** staff tokens are a SEPARATE trust domain (brief §3.5) */
    ADMIN_JWT_SECRET: z.string().min(32).default('dev-only-admin-secret-change-me-9876543210fe'),
    /** comma-separated browser origins allowed by CORS */
    CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:5174'),
    /** Stripe test-mode keys; checkout/webhooks throw a clear error when unset */
    STRIPE_SECRET_KEY: z.string().default(''),
    STRIPE_WEBHOOK_SECRET: z.string().default(''),
    /** Sentry error tracking (all apps, brief §2); empty = disabled */
    SENTRY_DSN: z.string().default(''),
    SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),
    /** where Stripe Checkout returns the browser (defaults to the web app) */
    TOPUP_RETURN_ORIGIN: z.string().url().default('http://localhost:5173'),
    /** LiveKit Cloud (owner-blocked, docs/deferred.md); media endpoints 503 until set */
    LIVEKIT_URL: z.string().default(''),
    LIVEKIT_API_KEY: z.string().default(''),
    LIVEKIT_API_SECRET: z.string().default(''),
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
    if (cfg.NODE_ENV === 'production' && cfg.ADMIN_JWT_SECRET.startsWith('dev-only-admin')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ADMIN_JWT_SECRET'],
        message: 'ADMIN_JWT_SECRET must be set explicitly in production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
