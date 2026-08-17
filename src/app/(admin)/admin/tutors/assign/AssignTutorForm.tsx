"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { useTutorAssignment } from "@/hooks/useTutors";
import { CalendarDays, BookOpen, CheckCircle2, ArrowRight, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Tutor  { id: string; name: string | null; email: string }
interface Course { id: string; title: string }

interface Props {
  tutors:              Tutor[];
  courses:             Course[];
  preselectedCourseId: string;
}

function today()        { return new Date().toISOString().split("T")[0]; }
function inDays(n: number) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function StepNumber({ n, active }: { n: number; active?: boolean }) {
  return (
    <div className={cn(
      "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors",
      active ? "bg-brand-500 text-white" : "bg-surface-100 text-gray-400"
    )}>{n}</div>
  );
}

export function AssignTutorForm({ tutors, courses, preselectedCourseId }: Props) {
  const router = useRouter();
  const { assign, assigning } = useTutorAssignment();

  const [tutorId,   setTutorId]   = useState("");
  const [courseId,  setCourseId]  = useState(preselectedCourseId);
  const [startDate, setStartDate] = useState(today());
  const [endDate,   setEndDate]   = useState(inDays(90));
  const [notes,     setNotes]     = useState("");
  const [errors,    setErrors]    = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!tutorId)   e.tutorId   = "Please select a tutor";
    if (!courseId)  e.courseId  = "Please select a course";
    if (!startDate) e.startDate = "Start date required";
    if (!endDate)   e.endDate   = "End date required";
    if (startDate && endDate && endDate <= startDate) e.endDate = "End date must be after start date";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    const res = await assign({
      tutorId,
      courseId,
      startDate: new Date(startDate).toISOString(),
      endDate:   new Date(endDate).toISOString(),
      notes:     notes || undefined,
    });
    if (res) router.push(`/admin/courses/${courseId}`);
  }

  const selectedTutor  = tutors.find((t) => t.id === tutorId);
  const selectedCourse = courses.find((c) => c.id === courseId);

  return (
    <div className="space-y-4">
      {/* Step 1 – Tutor */}
      <Card className="p-6">
        <div className="flex items-start gap-3 mb-5">
          <StepNumber n={1} active={true} />
          <div>
            <p className="text-sm font-semibold text-gray-900">Select Tutor</p>
            <p className="text-xs text-gray-400 mt-0.5">Only active approved tutors are shown</p>
          </div>
        </div>

        {tutors.length === 0 ? (
          <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
            <AlertCircle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700">No active tutors. Approve a tutor application first.</p>
          </div>
        ) : (
          <>
            <Select
              name="tutorId"
              value={tutorId}
              onChange={(e) => { setTutorId(e.target.value); setErrors((p) => ({ ...p, tutorId: "" })); }}
              options={tutors.map((t) => ({ value: t.id, label: `${t.name ?? "Unnamed"} — ${t.email}` }))}
              placeholder="Choose a tutor…"
              error={errors.tutorId}
            />
            {selectedTutor && (
              <div className="mt-3 flex items-center gap-3 rounded-xl bg-surface-50 border border-surface-100 px-4 py-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
                  {selectedTutor.name?.[0]?.toUpperCase() ?? "T"}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{selectedTutor.name}</p>
                  <p className="text-xs text-gray-400">{selectedTutor.email}</p>
                </div>
                <CheckCircle2 size={15} className="ml-auto text-emerald-500 flex-shrink-0" />
              </div>
            )}
          </>
        )}
      </Card>

      {/* Step 2 – Course */}
      <Card className="p-6">
        <div className="flex items-start gap-3 mb-5">
          <StepNumber n={2} active={!!tutorId} />
          <div>
            <p className="text-sm font-semibold text-gray-900">Select Course</p>
            <p className="text-xs text-gray-400 mt-0.5">Only published courses can have tutors assigned</p>
          </div>
        </div>
        <Select
          name="courseId"
          value={courseId}
          onChange={(e) => { setCourseId(e.target.value); setErrors((p) => ({ ...p, courseId: "" })); }}
          options={courses.map((c) => ({ value: c.id, label: c.title }))}
          placeholder="Choose a course…"
          error={errors.courseId}
        />
        {selectedCourse && (
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-surface-50 border border-surface-100 px-4 py-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-100">
              <BookOpen size={15} className="text-brand-600" />
            </div>
            <p className="text-sm font-medium text-gray-900 truncate flex-1">{selectedCourse.title}</p>
            <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />
          </div>
        )}
      </Card>

      {/* Step 3 – Dates */}
      <Card className="p-6">
        <div className="flex items-start gap-3 mb-5">
          <StepNumber n={3} active={!!courseId} />
          <div>
            <p className="text-sm font-semibold text-gray-900">Assignment Period</p>
            <p className="text-xs text-gray-400 mt-0.5">Set the start and end date for this assignment</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label flex items-center gap-1.5">
              <CalendarDays size={12} className="text-gray-400" /> Start Date
            </label>
            <input type="date" value={startDate} min={today()}
              onChange={(e) => { setStartDate(e.target.value); setErrors((p) => ({ ...p, startDate: "" })); }}
              className="form-input" />
            {errors.startDate && <p className="form-error">{errors.startDate}</p>}
          </div>
          <div>
            <label className="form-label flex items-center gap-1.5">
              <CalendarDays size={12} className="text-gray-400" /> End Date
            </label>
            <input type="date" value={endDate} min={startDate || today()}
              onChange={(e) => { setEndDate(e.target.value); setErrors((p) => ({ ...p, endDate: "" })); }}
              className="form-input" />
            {errors.endDate && <p className="form-error">{errors.endDate}</p>}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400">Quick set:</span>
          {[{ label: "30 days", days: 30 }, { label: "90 days", days: 90 }, { label: "6 months", days: 180 }, { label: "1 year", days: 365 }].map(({ label, days }) => (
            <button key={days} type="button" onClick={() => setEndDate(inDays(days))}
              className="rounded-full border border-surface-200 px-3 py-1 text-xs font-medium text-gray-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 transition-colors">
              {label}
            </button>
          ))}
        </div>
      </Card>

      {/* Step 4 – Notes */}
      <Card className="p-6">
        <div className="flex items-start gap-3 mb-5">
          <StepNumber n={4} />
          <div>
            <p className="text-sm font-semibold text-gray-900">Notes <span className="font-normal text-gray-400">(optional)</span></p>
            <p className="text-xs text-gray-400 mt-0.5">Internal notes visible only to admins</p>
          </div>
        </div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
          placeholder="e.g. Covering maternity leave. Focus on beginner cohort."
          className="form-input resize-none" maxLength={1000} />
        <p className="mt-1 text-right text-xs text-gray-300">{notes.length}/1000</p>
      </Card>

      {/* Summary */}
      {selectedTutor && selectedCourse && (
        <div className="rounded-2xl border border-brand-200 bg-brand-50 px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-2">Assignment Summary</p>
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <span className="font-semibold text-gray-900">{selectedTutor.name}</span>
            <ArrowRight size={13} className="text-brand-400 flex-shrink-0" />
            <span className="font-semibold text-gray-900 truncate">{selectedCourse.title}</span>
          </div>
          {startDate && endDate && (
            <p className="mt-1 text-xs text-brand-600">
              {new Date(startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              {" – "}
              {new Date(endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between rounded-2xl border border-surface-200 bg-white px-6 py-4 shadow-card">
        <Button variant="ghost" onClick={() => router.back()}>Cancel</Button>
        <Button onClick={handleSubmit} loading={assigning} disabled={!tutorId || !courseId} leftIcon={<CheckCircle2 size={15} />}>
          Confirm Assignment
        </Button>
      </div>
    </div>
  );
}
