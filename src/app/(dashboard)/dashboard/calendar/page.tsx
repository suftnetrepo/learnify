import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { SessionService } from "@/services/session.service";
import { EnrollmentService } from "@/services/enrollment.service";
import { Calendar } from "lucide-react";
import Link from "next/link";
import { CalendarView } from "./CalendarView";

export const metadata: Metadata = { title: "Calendar | Learnify" };

export default async function CalendarPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [sessions, { enrolled }] = await Promise.all([
    SessionService.getStudentSessions(session.user.id),
    EnrollmentService.getDashboardData(session.user.id),
  ]);

  return (
    <div>
      <Topbar breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Calendar" },
      ]} />

      <div className="p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-gray-900">Calendar</h1>
          <p className="mt-1 text-sm text-gray-400">
            Your scheduled live and in-person sessions.
          </p>
        </div>

        {sessions.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-surface-200 p-14 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 mx-auto mb-4">
              <Calendar size={28} className="text-brand-500" />
            </div>
            <h3 className="font-display text-xl font-bold text-gray-900 mb-2">No sessions yet</h3>
            <p className="text-sm text-gray-400 max-w-xs mx-auto mb-6">
              Enrol in a live or in-person course to see scheduled sessions here.
            </p>
            <Link href="/courses?format=in_person"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition-colors">
              Browse live courses
            </Link>
          </div>
        ) : (
          <CalendarView enrolled={enrolled} sessions={sessions} />
        )}
      </div>
    </div>
  );
}
