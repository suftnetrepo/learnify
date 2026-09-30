"use client";

import { Fragment, useState } from "react";
import { CheckCircle2, ChevronDown, Circle, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CourseProgressReport } from "@/services/enrollment.service";

interface Props {
  report: CourseProgressReport;
}

const fmtDate = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

function barColour(percent: number) {
  if (percent >= 100) return "bg-emerald-500";
  if (percent >= 50)  return "bg-brand-500";
  return "bg-amber-400";
}

/** Tutor/admin view of each enrolled student's lesson-by-lesson completion. */
export function CourseProgressPanel({ report }: Props) {
  const { students, modules, totalLectures } = report;
  const [open, setOpen] = useState<string | null>(null);

  if (!students.length) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-surface-200 px-6 py-14 text-center">
        <Users size={28} className="text-gray-300" />
        <p className="mt-3 text-sm font-semibold text-gray-700">No students enrolled yet</p>
        <p className="mt-1 text-xs text-gray-400">Progress appears here as students complete lessons.</p>
      </div>
    );
  }

  const avg       = Math.round(students.reduce((sum, s) => sum + s.percent, 0) / students.length);
  const finished  = students.filter((s) => s.percent >= 100).length;
  const notStarted = students.filter((s) => s.completedLectures === 0).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Students",        value: students.length },
          { label: "Avg. completion", value: `${avg}%` },
          { label: "Completed",       value: finished },
          { label: "Not started",     value: notStarted },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-2xl border border-surface-100 bg-white p-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="mt-1 font-display text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-surface-100 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-surface-100 bg-surface-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Modules</th>
                <th className="px-4 py-3">Last activity</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {students.map((s) => {
                const isOpen = open === s.studentId;
                return (
                  <Fragment key={s.studentId}>
                    <tr
                      onClick={() => setOpen(isOpen ? null : s.studentId)}
                      className={cn("cursor-pointer transition-colors hover:bg-surface-50", isOpen && "bg-surface-50")}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{s.name ?? s.email}</p>
                        <p className="text-xs text-gray-400">
                          {s.name ? s.email : null}
                          {s.sessionTitle && <>{s.name ? " · " : ""}{s.sessionTitle}</>}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-2 w-28 overflow-hidden rounded-full bg-surface-100">
                            <div className={cn("h-full rounded-full", barColour(s.percent))} style={{ width: `${s.percent}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-gray-700">{s.percent}%</span>
                        </div>
                        <p className="mt-1 text-xs text-gray-400">{s.completedLectures} / {totalLectures} lessons</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {s.modules.map((m, i) => (
                            <span
                              key={m.id}
                              title={`${modules[i].title}: ${m.completed}/${m.total}`}
                              className={cn(
                                "inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1 text-[11px] font-semibold",
                                m.completed === m.total ? "bg-emerald-100 text-emerald-700"
                                : m.completed > 0      ? "bg-brand-50 text-brand-700"
                                : "bg-surface-100 text-gray-400"
                              )}
                            >
                              {i + 1}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(s.lastActivityAt)}</td>
                      <td className="px-4 py-3">
                        <ChevronDown size={16} className={cn("text-gray-400 transition-transform", isOpen && "rotate-180")} />
                      </td>
                    </tr>

                    {isOpen && (
                      <tr className="bg-surface-50/60">
                        <td colSpan={5} className="px-4 pb-5 pt-1">
                          <div className="grid gap-3 md:grid-cols-2">
                            {modules.map((m, i) => (
                              <div key={m.id} className="rounded-xl border border-surface-100 bg-white p-3">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <p className="text-xs font-bold text-gray-800">{i + 1}. {m.title}</p>
                                  <span className="flex-shrink-0 text-[11px] font-semibold text-gray-400">
                                    {s.modules[i].completed}/{s.modules[i].total}
                                  </span>
                                </div>
                                <ul className="space-y-1.5">
                                  {m.lectures.map((l) => {
                                    const done = l.id in s.completedLectureIds;
                                    return (
                                      <li key={l.id} className="flex items-start gap-2 text-xs">
                                        {done
                                          ? <CheckCircle2 size={14} className="mt-px flex-shrink-0 text-emerald-500" />
                                          : <Circle size={14} className="mt-px flex-shrink-0 text-gray-300" />}
                                        <span className={cn("flex-1", done ? "text-gray-700" : "text-gray-400")}>{l.title}</span>
                                        {done && (
                                          <span className="flex-shrink-0 text-[11px] text-gray-400">
                                            {fmtDate(s.completedLectureIds[l.id])}
                                          </span>
                                        )}
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
