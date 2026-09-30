import { z } from "zod";

/** A student's review — used for creating and for editing their own. */
export const reviewInputSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title:  z.string().trim().max(120).optional(),
  body:   z.string().trim().max(2000).optional()
    .refine((b) => !b || b.length >= 10, "Review must be at least 10 characters"),
});
