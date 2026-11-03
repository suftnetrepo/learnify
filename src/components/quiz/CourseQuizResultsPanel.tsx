"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, ClipboardCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CourseQuizReport } from "@/types";

const fmtDate = (value: Date | string | null) => value
  ? new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
  : "—";

export function CourseQuizResultsPanel({ report }: { report: CourseQuizReport }) {
  const [open, setOpen] = useState<string | null>(null);
  const published = report.modules.filter((module) => module.isPublished).length;
  const attempts = report.modules.reduce((sum, module) => sum + module.attemptedStudents, 0);
  const scores = report.modules.flatMap((module) => module.students.map((student) => student.latestScore).filter((score): score is number => score !== null));
  const average = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Enrolled students", value: report.enrolledStudents, icon: Users },
          { label: "Module exercises", value: report.modules.length, icon: ClipboardCheck },
          { label: "Published", value: published, icon: CheckCircle2 },
          { label: "Average score", value: average === null ? "—" : `${average}%`, icon: ClipboardCheck },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-surface-100 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">{label}</p>
              <Icon size={15} className="text-brand-500" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-surface-100 bg-white">
        <div className="flex items-center justify-between border-b border-surface-100 px-5 py-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Results by module</h3>
            <p className="mt-0.5 text-xs text-gray-400">{attempts} student module attempts recorded</p>
          </div>
        </div>
        <div className="divide-y divide-surface-100">
          {report.modules.map((module, index) => {
            const isOpen = open === module.sectionId;
            const passRate = module.attemptedStudents
              ? Math.round((module.passedStudents / module.attemptedStudents) * 100)
              : null;
            return (
              <div key={module.sectionId}>
                <button onClick={() => setOpen(isOpen ? null : module.sectionId)} className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-50">
                  <span className={cn(
                    "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-xs font-bold",
                    module.isPublished ? "bg-brand-50 text-brand-700" : "bg-surface-100 text-gray-400",
                  )}>{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-gray-900">{module.sectionTitle}</span>
                    <span className="mt-0.5 block text-xs text-gray-400">
                      {module.quizId
                        ? `${module.questionCount} questions · ${module.isPublished ? "Published" : "Draft"}`
                        : "Exercise not configured"}
                    </span>
                  </span>
                  <span className="hidden gap-5 text-right sm:flex">
                    <span><span className="block text-sm font-bold text-gray-800">{module.attemptedStudents}/{report.enrolledStudents}</span><span className="text-[10px] text-gray-400">Attempted</span></span>
                    <span><span className="block text-sm font-bold text-gray-800">{module.averageScore === null ? "—" : `${module.averageScore}%`}</span><span className="text-[10px] text-gray-400">Average</span></span>
                    <span><span className="block text-sm font-bold text-gray-800">{passRate === null ? "—" : `${passRate}%`}</span><span className="text-[10px] text-gray-400">Pass rate</span></span>
                  </span>
                  <ChevronDown size={16} className={cn("flex-shrink-0 text-gray-400 transition-transform", isOpen && "rotate-180")} />
                </button>

                {isOpen && (
                  <div className="border-t border-surface-100 bg-surface-50/50 px-5 py-4">
                    {!report.enrolledStudents ? (
                      <p className="py-5 text-center text-xs text-gray-400">No students are enrolled in this course.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-surface-100 bg-white">
                        <table className="w-full min-w-[620px] text-sm">
                          <thead className="border-b border-surface-100 bg-surface-50 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            <tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Attempts</th><th className="px-4 py-3">Latest</th><th className="px-4 py-3">Best</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Last submitted</th></tr>
                          </thead>
                          <tbody className="divide-y divide-surface-100">
                            {module.students.map((student) => (
                              <tr key={student.studentId}>
                                <td className="px-4 py-3"><p className="font-medium text-gray-900">{student.name ?? student.email}</p>{student.name && <p className="text-xs text-gray-400">{student.email}</p>}</td>
                                <td className="px-4 py-3 text-gray-600">{student.attempts}</td>
                                <td className="px-4 py-3 font-semibold text-gray-800">{student.latestScore === null ? "—" : `${student.latestScore}%`}</td>
                                <td className="px-4 py-3 font-semibold text-gray-800">{student.bestScore === null ? "—" : `${student.bestScore}%`}</td>
                                <td className="px-4 py-3">
                                  <span className={cn(
                                    "inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold",
                                    student.passed === true ? "bg-emerald-100 text-emerald-700"
                                      : student.passed === false ? "bg-amber-100 text-amber-700"
                                      : "bg-surface-100 text-gray-400",
                                  )}>{student.passed === true ? "Passed" : student.passed === false ? "Retry" : "Not attempted"}</span>
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(student.lastSubmittedAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
