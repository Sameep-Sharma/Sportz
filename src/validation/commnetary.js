import { z } from "zod";

export const listCommentaryQuerySchema = z.object({
  limit: z.coerce.number().positive().max(100).optional(),
});

export const listCommnetaryQuerySchema = listCommentaryQuerySchema;

export const createCommentarySchema = z
  .object({
    minute: z.coerce.number().int().nonnegative().optional(),
    minutes: z.coerce.number().int().nonnegative().optional(),
    sequence: z.coerce.number().int().nonnegative(),
    period: z.string(),
    eventType: z.string(),
    actor: z.string().optional(),
    team: z.string().optional(),
    message: z.string().trim().min(1),
    metadata: z.record(z.string(), z.any()).optional(),
    tags: z.array(z.string()).optional(),
  })
  .transform((data) => {
    const min = data.minutes ?? data.minute ?? 0;
    return {
      ...data,
      minutes: min,
      minute: min,
    };
  });

