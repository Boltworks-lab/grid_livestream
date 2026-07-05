import { z } from 'zod';

/** Go Live setup (prototype: title, category, visibility, access, PPV price). */
export const createStreamSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    category: z.string().trim().min(1).max(40).optional(),
    visibility: z.enum(['PUBLIC', 'FOLLOWERS', 'PRIVATE']).default('PUBLIC'),
    access: z.enum(['FREE', 'PPV', 'SUBS']).default('FREE'),
    ppvPriceDiamonds: z.number().int().positive().max(1_000_000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.access === 'PPV' && !v.ppvPriceDiamonds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ppvPriceDiamonds'],
        message: 'a pay-per-view stream needs an unlock price',
      });
    }
  });
export type CreateStreamInput = z.infer<typeof createStreamSchema>;

export const streamSummarySchema = z.object({
  id: z.string().uuid(),
  creatorId: z.string().uuid(),
  creatorHandle: z.string(),
  title: z.string(),
  category: z.string().nullable(),
  visibility: z.enum(['PUBLIC', 'FOLLOWERS', 'PRIVATE']),
  access: z.enum(['FREE', 'PPV', 'SUBS']),
  ppvPriceDiamonds: z.number().int().nullable(),
  status: z.enum(['SCHEDULED', 'LIVE', 'ENDED']),
  viewerCount: z.number().int().nonnegative(),
  startedAt: z.string().nullable(),
  /** server-computed: may the CALLER join (media + chat)? */
  entitled: z.boolean(),
});
export type StreamSummary = z.infer<typeof streamSummarySchema>;
