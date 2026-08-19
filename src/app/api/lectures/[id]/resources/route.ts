import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { ResourceService } from "@/services";
import { successResponse, unauthorized, forbidden, serverError, createdResponse, validationError } from "@/lib/api-response";
import { z } from "zod";

const createSchema = z.object({
  type:      z.enum(["pdf", "zip", "github", "link", "video"]),
  label:     z.string().min(1).max(100),
  url:       z.string().url(),
  sortOrder: z.number().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: lectureId } = await params;
    const resources = await ResourceService.getForLecture(lectureId);
    return successResponse(resources);
  } catch {
    return serverError();
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "admin") return forbidden("Admins only");

    const { id: lectureId } = await params;
    const body   = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }

    const resource = await ResourceService.create({ lectureId, ...parsed.data });
    return createdResponse(resource);
  } catch {
    return serverError();
  }
}
