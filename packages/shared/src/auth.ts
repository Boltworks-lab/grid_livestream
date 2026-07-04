import { z } from 'zod';

/**
 * Auth schemas — validated at every edge (PROJECT_BRIEF §3.6): the API pipes and
 * the web/mobile forms all parse with these.
 */

export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,24}$/, 'handle must be 3-24 chars: a-z, 0-9, _');

export const passwordSchema = z.string().min(8, 'at least 8 characters').max(128);

/** 18+ age gate (PROJECT_BRIEF §7) — computed against UTC today. */
export function isAdult(dobIso: string, now = new Date()): boolean {
  const dob = new Date(dobIso);
  const cutoff = new Date(Date.UTC(now.getUTCFullYear() - 18, now.getUTCMonth(), now.getUTCDate()));
  return dob <= cutoff;
}

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: passwordSchema,
  handle: handleSchema,
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
    .refine((d) => !Number.isNaN(Date.parse(d)), 'invalid date')
    .refine((d) => isAdult(d), 'you must be 18 or older'),
  country: z.string().trim().toUpperCase().length(2).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  /** email or handle */
  identifier: z.string().trim().toLowerCase().min(3),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(50).optional(),
  avatarUrl: z.string().url().max(500).optional(),
  bio: z.string().trim().max(300).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/** Shape both clients render — the API's user payload (never includes secrets). */
export const authUserSchema = z.object({
  id: z.string().uuid(),
  handle: z.string(),
  email: z.string().nullable(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
  role: z.enum(['USER', 'CREATOR']),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED']),
  createdAt: z.string(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: authUserSchema,
});
export type AuthTokens = z.infer<typeof authTokensSchema>;
