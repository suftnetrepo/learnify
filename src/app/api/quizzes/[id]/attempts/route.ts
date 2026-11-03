import { z } from "zod";
import { auth } from "@/lib/auth";
import { errorResponse, serverError, successResponse, unauthorized, validationError } from "@/lib/api-response";
import { QuizError, QuizService } from "@/services";
import { log } from "@/lib/logger";

const submissionSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().uuid(),
    optionId: z.string().uuid(),
  })).min(1).max(10),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const parsed = submissionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    const { id } = await params;
    return successResponse(
      await QuizService.submit(id, session.user.id, parsed.data.answers),
      "Quiz submitted",
    );
  } catch (error) {
    if (error instanceof QuizError) return errorResponse(error.message, "QUIZ_ERROR", error.status);
    log.error("Submit module quiz failed", { error });
    return serverError();
  }
}
