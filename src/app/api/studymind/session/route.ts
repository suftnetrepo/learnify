import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { log } from "@/lib/logger";
import { courseHasAiTutor, getStudyMindRole, type StudyMindRole } from "@/lib/studymind";
import { isAiTutorPassEnabled } from "@/lib/flags";
import { resolveStudentAiAccess } from "@/lib/ai-pass/access";
import { AI_PASS } from "@/lib/ai-pass/config";
import { AiTutorPassService } from "@/services/ai-tutor-pass.service";
import type { AiTutorPass } from "@/db/schema";

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

    let role: StudyMindRole | null;
    let pass: AiTutorPass | null = null;   // set only for free-course AI Tutor Pass sessions

    if (session.user.role === "student" && isAiTutorPassEnabled()) {
      // Decided from the database — free courses never get an unrestricted token
      const access = await resolveStudentAiAccess(session.user.id, courseId);
      if (access.kind === "pass_required") {
        return NextResponse.json(
          { error: "Get an AI Tutor Pass to use the AI tutor on free courses", code: "ai_pass_required" },
          { status: 402 },
        );
      }
      if (access.kind !== "paid" && access.kind !== "pass") {
        return NextResponse.json({ error: "You don't have access to this course" }, { status: 403 });
      }
      role = "student";
      if (access.kind === "pass") pass = access.pass;
    } else {
      // Existing behaviour, unchanged (feature off, or tutors/admins)
      // Paid-course feature — say so plainly rather than a generic "no access"
      if (session.user.role === "student" && !(await courseHasAiTutor(courseId))) {
        return NextResponse.json({ error: "The AI tutor is available on paid courses only" }, { status: 403 });
      }

      role = await getStudyMindRole(session.user.id, session.user.role, courseId);
      if (!role) {
        return NextResponse.json({ error: "You don't have access to this course" }, { status: 403 });
      }
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
        expires_in: pass ? passTokenSeconds(pass) : TOKEN_TTL_SECONDS,
        // Pass sessions: StudyMind enforces the allowances/budget and caps the token at the pass end
        ...(pass ? {
          usage_policy: { type: AI_PASS.policyType, pass_id: pass.id, expires_at: pass.endsAt.toISOString() },
        } : {}),
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      // A refused pass policy (expired/revoked/conflict) is final — never fall back to an unrestricted token
      if (pass && [402, 403, 409, 422, 429].includes(res.status)) {
        log.warn("StudyMind refused AI Tutor Pass session", { status: res.status, code: err?.code, passId: pass.id });
        return NextResponse.json(
          { error: typeof err?.detail === "string" ? err.detail : "Your AI Tutor Pass isn't active", code: err?.code ?? "ai_pass_refused" },
          { status: 403 },
        );
      }
      log.error("StudyMind session exchange failed", { status: res.status, detail: err?.detail });
      return NextResponse.json(
        { error: "Couldn't connect to the AI tutor. Please try again." },
        // Upstream failures (incl. a rejected API key) are server-side problems, not the user's auth
        { status: 502 },
      );
    }

    const data = await res.json();
    if (pass) await AiTutorPassService.markPolicyCreated(pass.id).catch(() => {});   // bookkeeping only
    return NextResponse.json({
      sessionToken: data.session_token,
      expiresAt:    data.expires_at,
      expiresIn:    data.expires_in ?? TOKEN_TTL_SECONDS,   // seconds — lets clients ignore clock skew
      apiUrl,
      userId:       session.user.id,
      role,
    });
  } catch (e) {
    log.error("StudyMind session error", { error: e });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Token lifetime for a pass session: up to an hour, never past the pass end. StudyMind rejects
 * lifetimes under 300 s, so near the end we still ask for 300 — StudyMind itself caps the token at
 * the pass expiry (resolveStudentAiAccess already treats a pass with <= 5 s left as ended).
 */
function passTokenSeconds(pass: AiTutorPass): number {
  const remaining = Math.floor((pass.endsAt.getTime() - Date.now()) / 1000);
  return Math.min(TOKEN_TTL_SECONDS, Math.max(AI_PASS.studymindMinTokenSeconds, remaining));
}
