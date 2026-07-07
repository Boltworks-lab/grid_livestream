import { z } from 'zod';

/**
 * Automated chat moderation config (brief §8). Runtime-editable via app_config so
 * staff can add, REMOVE, or reclassify terms without a deploy — the anti-
 * over-policing requirement: the default posture is flag-for-human-review, and
 * only the hardest tier blocks pre-broadcast. Different communities differ, so
 * the whole list is data, not code.
 *
 * Severity → action:
 *   - allow: never touched (e.g. reclaimed/harsh words a community permits)
 *   - flag:  broadcast, but queue an auto-report for a human to review
 *   - block: never broadcast; the sender is told; a report documents it
 * Staff map each severity to an action, so "harsh" ≠ "banned".
 */
export const modSeverity = ['allow', 'flag', 'block'] as const;
export type ModSeverity = (typeof modSeverity)[number];

export const moderationConfigSchema = z.object({
  enabled: z.boolean().default(true),
  /** term → severity. term is matched after normalization (see server). */
  terms: z.record(z.string(), z.enum(modSeverity)).default({}),
  /** optional allowlist: terms here are NEVER flagged even if a rule would match */
  allow: z.array(z.string()).default([]),
  /** ML text-moderation thresholds (0..1) per category — used when a provider key
   *  is configured; ignored otherwise. Drop-in for OpenAI/Perspective later. */
  mlThresholds: z
    .object({
      harassment: z.number().min(0).max(1),
      hate: z.number().min(0).max(1),
      sexual: z.number().min(0).max(1),
      selfHarm: z.number().min(0).max(1),
      violence: z.number().min(0).max(1),
    })
    .partial()
    .default({}),
});
export type ModerationConfig = z.infer<typeof moderationConfigSchema>;

export const DEFAULT_MODERATION: ModerationConfig = {
  enabled: true,
  // Deliberately minimal + conservative. Communities tune it; nothing here
  // auto-blocks casual profanity — that stays 'allow'. Slurs/hard categories
  // are seeded as examples and fully editable/removable by staff.
  terms: {},
  allow: [],
  mlThresholds: { harassment: 0.9, hate: 0.85, sexual: 0.9, selfHarm: 0.8, violence: 0.9 },
};

/** Creator-set slow-mode / mute inputs. */
export const slowModeSchema = z.object({ seconds: z.number().int().min(0).max(300) });
export type SlowModeInput = z.infer<typeof slowModeSchema>;

export const muteSchema = z.object({
  userId: z.string().uuid(),
  minutes: z.number().int().min(1).max(1440),
});
export type MuteInput = z.infer<typeof muteSchema>;
