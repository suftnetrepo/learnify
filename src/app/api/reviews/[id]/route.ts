import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  successResponse, unauthorized, forbidden, serverError, validationError, errorResponse,
} from "@/lib/api-response";
import { ReviewService, ReviewError } from "@/services/review.service";
import { reviewInputSchema } from "@/lib/validation/review";
import { log } from "@/lib/logger";

const moderationSchema = z.object({ isPublished: z.boolean() });

/**
 * Students edit their own review (rating/title/body).
 * Admins moderate: { isPublished: false } hides it, { isPublished: true } restores it.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { id } = await params;
    const body = await req.json();

    if (session.user.role === "admin") {
      const parsed = moderationSchema.safeParse(body);
      if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
      const review = await ReviewService.setPublished(id, parsed.data.isPublished, session.user.id);
      return successResponse(review, parsed.data.isPublished ? "Review restored" : "Review hidden");
    }

    if (session.user.role !== "student") return forbidden();
    const parsed = reviewInputSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    const review = await ReviewService.updateOwn(session.user.id, id, parsed.data);
    return successResponse(review, "Review updated");
  } catch (error) {
    if (error instanceof ReviewError) return errorResponse(error.message, "REVIEW_ERROR", error.status);
    log.error("PATCH /api/reviews/:id", { error });
    return serverError();
  }
}

/** Admin only: permanently delete a review. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "admin") return forbidden();
    const { id } = await params;
    await ReviewService.remove(id, session.user.id);
    return successResponse(null, "Review deleted");
  } catch (error) {
    if (error instanceof ReviewError) return errorResponse(error.message, "REVIEW_ERROR", error.status);
    log.error("DELETE /api/reviews/:id", { error });
    return serverError();
  }
}
