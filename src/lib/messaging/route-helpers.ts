import { z } from "zod";
import { auth } from "@/lib/auth";
import { CourseMessagingService } from "@/services";
import type { Role, Viewer } from "@/services/messaging.service";

const uuid = z.string().uuid();
export const isUuid = (v: unknown): v is string => uuid.safeParse(v).success;

type Access =
  | { ok: true; viewer: Viewer; courseRole: Role }
  | { ok: false; status: 400 | 401 | 403; message: string };

/** Signed in, a valid course id, and part of the course (enrolled / assigned tutor / admin). */
export async function courseAccess(courseId: string | null): Promise<Access> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, status: 401, message: "Authentication required" };
  if (!isUuid(courseId)) return { ok: false, status: 400, message: "A valid courseId is required" };
  const viewer: Viewer = { id: session.user.id, role: session.user.role };
  const courseRole = await CourseMessagingService.courseRole(viewer, courseId);
  if (!courseRole) return { ok: false, status: 403, message: "You're not part of this course" };
  return { ok: true, viewer, courseRole };
}

/** Like courseAccess, but only the course's assigned tutors and admins (the staff channel). */
export async function staffAccess(courseId: string | null): Promise<Access> {
  const access = await courseAccess(courseId);
  if (access.ok && access.courseRole === "student") {
    return { ok: false, status: 403, message: "The staff channel is for tutors and admins" };
  }
  return access;
}
