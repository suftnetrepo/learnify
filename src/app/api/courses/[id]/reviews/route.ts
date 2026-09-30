import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { reviewInputSchema } from "@/lib/validation/review";
import {
  createdResponse, unauthorized, forbidden, serverError, validationError, errorResponse,
} from "@/lib/api-response";
import { ReviewService, ReviewError } from "@/services/review.service";
import { log } from "@/lib/logger";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user)                  return unauthorized();
    if (session.user.role !== "student") return forbidden("Only students can leave reviews");

    const { id: courseId } = await params;
    const parsed = reviewInputSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);

    const review = await ReviewService.create(session.user.id, courseId, parsed.data);
    return createdResponse(review, "Review submitted successfully");
  } catch (error) {
    if (error instanceof ReviewError) return errorResponse(error.message, "REVIEW_ERROR", error.status);
    log.error("POST /api/courses/:id/reviews", { error });
    return serverError();
  }
}
