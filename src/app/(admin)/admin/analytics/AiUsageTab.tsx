import Link from "next/link";
import { inArray } from "drizzle-orm";
import { AlertTriangle, Bot, FileText, Layers, MessageCircleQuestion, Sparkles } from "lucide-react";
import { db } from "@/db";
import { courses } from "@/db/schema";
import { StatCard } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { getStudyMindUsage, type StudyMindUsage } from "@/lib/analytics/studymind";

const STATUS_BADGE: Record<StudyMindUsage["courses"][number]["status"], { label: string; variant: "success" | "warning" | "danger" }> = {
  ready:   { label: "Active",   variant: "success" },
  pending: { label: "Indexing", variant: "warning" },
  failed:  { label: "Failed",   variant: "danger" },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function AiUsageTab() {
  const usage = await getStudyMindUsage();

  if (!usage) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-amber-500" />
        <div>
          <p className="font-semibold text-amber-800">AI analytics unavailable</p>
          <p className="mt-1 text-sm text-amber-700">
            Check the StudyMind API connection — <code className="rounded bg-amber-100 px-1">STUDYMIND_API_KEY</code> and{" "}
            <code className="rounded bg-amber-100 px-1">STUDYMIND_API_URL</code> must be set, and StudyMind must be reachable.
          </p>
        </div>
      </div>
    );
  }

  // StudyMind's course_id is the Edquis course UUID — look them up for names and links
  const ids = usage.courses.map((c) => c.course_id).filter((id) => UUID.test(id));
  const edquisCourses = ids.length
    ? await db.select({ id: courses.id, title: courses.title, slug: courses.slug, status: courses.status })
        .from(courses).where(inArray(courses.id, ids))
    : [];
  const byId = new Map(edquisCourses.map((c) => [c.id, c]));

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total AI Requests"  value={usage.total_requests.toLocaleString()}
          delta={usage.last_used_at ? `Since integration · last ${formatDate(usage.last_used_at)}` : "Since integration"}
          icon={<Bot size={20} />} />
        <StatCard label="Questions Asked"    value={usage.total_questions.toLocaleString()}
          delta={`By students across all courses · ${usage.total_chat_sessions.toLocaleString()} chats`}
          icon={<MessageCircleQuestion size={20} />} />
        <StatCard label="Courses with AI"    value={usage.courses_indexed.toLocaleString()}
          delta="Courses indexed and ready" icon={<Sparkles size={20} />} />
        <StatCard label="Documents Indexed"  value={usage.documents_uploaded.toLocaleString()}
          delta="Files uploaded by tutors" icon={<FileText size={20} />} />
      </div>

      <div>
        <h2 className="heading-3 text-gray-900 mb-4">AI-Enabled Courses</h2>
        <div className="table-container">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr>
                <th className="table-header">Course</th>
                <th className="table-header">Chunks</th>
                <th className="table-header">Indexed</th>
                <th className="table-header">Status</th>
              </tr>
            </thead>
            <tbody>
              {usage.courses.length === 0 && (
                <tr><td colSpan={4} className="table-cell py-8 text-center text-sm text-gray-400">No courses have been indexed for AI yet.</td></tr>
              )}
              {usage.courses.map((c) => {
                const course = byId.get(c.course_id);
                const badge  = STATUS_BADGE[c.status] ?? STATUS_BADGE.failed;
                return (
                  <tr key={c.course_id} className="table-row">
                    <td className="table-cell max-w-[320px]">
                      {course ? (
                        <Link href={`/admin/courses/${course.id}`} className="font-medium text-gray-900 hover:text-brand-600">
                          {course.title}
                        </Link>
                      ) : (
                        <span className="font-medium text-gray-900">{c.title ?? c.course_id}</span>
                      )}
                      <p className="mt-0.5 truncate text-xs text-gray-400">
                        {course ? (course.status === "published" ? `/courses/${course.slug}` : `Course is ${course.status.replace("_", " ")}`) : "Not in this database"}
                      </p>
                    </td>
                    <td className="table-cell text-gray-600"><span className="flex items-center gap-1.5"><Layers size={13} className="text-gray-400" />{c.chunk_count.toLocaleString()}</span></td>
                    <td className="table-cell text-gray-500">{c.indexed_at ? formatDate(c.indexed_at) : "—"}</td>
                    <td className="table-cell"><Badge variant={badge.variant} dot>{badge.label}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Bot size={18} /></div>
          <div>
            <h3 className="font-semibold text-gray-900">What is AI Usage?</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
              Edquis&apos;s AI tutor is powered by StudyMind. Each course&apos;s outline and the materials tutors upload are
              indexed so students can ask questions, generate quizzes and flashcards, and get summaries grounded in that
              course. These figures come from StudyMind for Edquis&apos;s API key: requests are every call Edquis makes,
              questions are messages students send to the AI tutor.
            </p>
            <Link href="/admin/courses" className="mt-3 inline-block text-sm font-semibold text-brand-600 hover:underline">
              Manage courses and upload materials →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
