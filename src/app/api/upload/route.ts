import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { generateSignedUploadParams } from "@/lib/cloudinary";
import { z } from "zod";
import {
  successResponse, unauthorized, forbidden,
  serverError, validationError,
} from "@/lib/api-response";

const schema = z.object({
  type:   z.enum(["video", "image", "document"]),
  folder: z.enum(["lectures", "thumbnails", "resources", "avatars"]),
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (!["admin", "tutor"].includes(session.user.role)) {
      return forbidden("Only admins and tutors can upload content.");
    }

    const { searchParams } = new URL(req.url);
    const parsed = schema.safeParse({
      type:   searchParams.get("type")   ?? "video",
      folder: searchParams.get("folder") ?? "lectures",
    });

    if (!parsed.success) {
      return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }

    const { type, folder } = parsed.data;
    const resourceType = type === "document" ? "raw" : type;

    const params = generateSignedUploadParams({
      folder:       `learnify/${folder}`,
      resourceType: resourceType as "video" | "image" | "raw",
    });

    return successResponse(params);
  } catch (error) {
    return serverError("Failed to generate upload parameters.");
  }
}
