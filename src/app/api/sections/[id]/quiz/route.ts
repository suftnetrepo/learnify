import { auth } from "@/lib/auth";
import { forbidden, serverError, successResponse, unauthorized } from "@/lib/api-response";
import { QuizError, QuizService } from "@/services";
import { log } from "@/lib/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const { id } = await params;
    return successResponse(await QuizService.getPublishedForStudent(id, session.user.id));
  } catch (error) {
    if (error instanceof QuizError && error.status === 403) return forbidden(error.message);
    log.error("Get module quiz failed", { error });
    return serverError();
  }
}
