
import { TutorService } from "@/services/tutor.service";

import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { UserPlus, CalendarDays, ArrowRight, GraduationCap } from "lucide-react";
import { CancelAssignmentButton } from "./CancelAssignmentButton";

interface Props { courseId: string }

export async function TutorAssignmentSection({ courseId }: Props) {
  const assignments = await TutorService.getAssignmentsForCourse(courseId);

  const active    = assignments.filter((a) => a.status === "active");
  const completed = assignments.filter((a) => a.status !== "active");

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="heading-3 text-gray-900">Tutor Assignments</h2>
          <p className="mt-1 text-sm text-gray-400">
            {active.length === 0
              ? "No tutors currently assigned to this course."
              : `${active.length} active assignment${active.length > 1 ? "s" : ""}`}
          </p>
        </div>
        <Link href={`/admin/tutors/assign?courseId=${courseId}`}>
          <Button variant="secondary" size="sm" leftIcon={<UserPlus size={14} />}>
            Assign Tutor
          </Button>
        </Link>
      </div>

      {assignments.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-surface-200 py-10 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-100">
            <GraduationCap size={22} className="text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-500">No tutors assigned yet</p>
          <p className="mt-1 text-xs text-gray-400">
            Assign a tutor to let them deliver this course and receive payouts.
          </p>
          <Link href={`/admin/tutors/assign?courseId=${courseId}`} className="mt-4">
            <Button size="sm" leftIcon={<UserPlus size={14} />}>Assign Tutor</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Active assignments */}
          {active.map((a) => (
            <div
              key={a.id}
              className="flex items-start justify-between gap-4 rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-4"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
                  {a.tutorName?.[0]?.toUpperCase() ?? "T"}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{a.tutorName ?? "Unnamed Tutor"}</p>
                  <p className="text-xs text-gray-500">{a.tutorEmail}</p>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                    <CalendarDays size={12} className="text-gray-400 flex-shrink-0" />
                    <span>{formatDate(a.startDate)}</span>
                    <ArrowRight size={11} className="text-gray-300 flex-shrink-0" />
                    <span>{formatDate(a.endDate)}</span>
                  </div>
                  {a.notes && (
                    <p className="mt-1.5 text-xs text-gray-400 italic">"{a.notes}"</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant="success" dot>active</Badge>
                <CancelAssignmentButton assignmentId={a.id} tutorName={a.tutorName ?? "this tutor"} />
              </div>
            </div>
          ))}

          {/* Past assignments */}
          {completed.length > 0 && (
            <>
              <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Past Assignments</p>
              {completed.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start justify-between gap-4 rounded-xl border border-surface-100 bg-surface-50 px-4 py-3 opacity-70"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-surface-200 text-xs font-bold text-gray-500">
                      {a.tutorName?.[0]?.toUpperCase() ?? "T"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-700">{a.tutorName ?? "Unnamed"}</p>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
                        <CalendarDays size={11} className="flex-shrink-0" />
                        <span>{formatDate(a.startDate)}</span>
                        <ArrowRight size={10} className="text-gray-300 flex-shrink-0" />
                        <span>{formatDate(a.endDate)}</span>
                      </div>
                    </div>
                  </div>
                  <Badge variant={a.status === "completed" ? "neutral" : "danger"} dot>
                    {a.status}
                  </Badge>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </Card>
  );
}
