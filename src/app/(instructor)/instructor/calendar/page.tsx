import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { SessionService } from "@/services/session.service";
import { CalendarDays } from "lucide-react";
import { CalendarView } from "./CalendarView";

export const metadata: Metadata = { title: "Calendar | Instructor" };

export default async function InstructorCalendarPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sessions = await SessionService.getInstructorSessions(session.user.id);

  return (
    <div>
      <Topbar breadcrumbs={[
        { label: "Instructor" },
        { label: "Calendar" },
      ]} />

      <div className="p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-gray-900">Calendar</h1>
          <p className="mt-1 text-sm text-gray-400">
            Every session scheduled across your assigned courses.
          </p>
        </div>

        {sessions.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-surface-200 p-14 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 mx-auto mb-4">
              <CalendarDays size={28} className="text-brand-500" />
            </div>
            <h3 className="font-display text-xl font-bold text-gray-900 mb-2">No sessions yet</h3>
            <p className="text-sm text-gray-400 max-w-xs mx-auto">
              Sessions will appear here once your admin adds them to your assigned courses.
            </p>
          </div>
        ) : (
          <CalendarView sessions={sessions} />
        )}
      </div>
    </div>
  );
}
