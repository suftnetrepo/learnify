import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { log } from "@/lib/logger";
import { getStudyMindRole } from "@/lib/studymind";

const DEFAULT_API_URL = "https://api.aismartlearner.com";
const TOKEN_TTL_SECONDS = 3600;

/**
 * POST /api/studymind/session  { courseId }
 *
 * Exchanges Learnify's server-only StudyMind API key for a short-lived session
 * token scoped to this course and the signed-in user. The role in the token
 * comes from Learnify's own access rules, never from the request.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const courseId = typeof body?.courseId === "string" ? body.courseId : "";
    if (!courseId) {
      return NextResponse.json({ error: "courseId is required" }, { status: 400 });
    }

    const role = await getStudyMindRole(session.user.id, session.user.role, courseId);
    if (!role) {
      return NextResponse.json({ error: "You don't have access to this course" }, { status: 403 });
    }

    const apiKey = process.env.STUDYMIND_API_KEY;
    const apiUrl = process.env.STUDYMIND_API_URL || DEFAULT_API_URL;
    if (!apiKey) {
      return NextResponse.json({ error: "StudyMind not configured" }, { status: 503 });
    }

    const res = await fetch(`${apiUrl}/api/v1/auth/session`, {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        course_id:  courseId,
        user_id:    session.user.id,
        user_role:  role,
        expires_in: TOKEN_TTL_SECONDS,
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      log.error("StudyMind session exchange failed", { status: res.status, detail: err?.detail });
      return NextResponse.json(
        { error: "Couldn't connect to the AI tutor. Please try again." },
        // Upstream failures (incl. a rejected API key) are server-side problems, not the user's auth
        { status: 502 },
      );
    }

    const data = await res.json();
    return NextResponse.json({
      sessionToken: data.session_token,
      expiresAt:    data.expires_at,
      apiUrl,
      userId:       session.user.id,
      role,
    });
  } catch (e) {
    log.error("StudyMind session error", { error: e });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
