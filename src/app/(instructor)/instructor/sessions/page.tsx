import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { SessionService } from "@/services/session.service";
import { Calendar } from "lucide-react";
import { SessionCard } from "./SessionCard";

export const metadata: Metadata = { title: "My Sessions | Instructor" };

export default async function InstructorSessionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const allSessions = await SessionService.getInstructorSessions(session.user.id);
  const now         = new Date();

  const live     = allSessions.filter((s) => now >= new Date(s.startDatetime) && now <= new Date(s.endDatetime));
  const upcoming = allSessions.filter((s) => new Date(s.startDatetime) > now);
  const past     = allSessions.filter((s) => new Date(s.endDatetime) < now);

  return (
    <div>
      <Topbar breadcrumbs={[{ label: "Instructor" }, { label: "Sessions" }]} />

      <div className="p-4 sm:p-6 space-y-8">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-gray-900">My Sessions</h1>
          <p className="mt-1 text-sm text-gray-400">
            {upcoming.length} upcoming · {allSessions.length} total
          </p>
        </div>

        {allSessions.length === 0 && (
          <div className="rounded-3xl border-2 border-dashed border-surface-200 p-14 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 mx-auto mb-4">
              <Calendar size={28} className="text-brand-500" />
            </div>
            <h3 className="font-display text-xl font-bold text-gray-900 mb-2">No sessions yet</h3>
            <p className="text-sm text-gray-400 max-w-xs mx-auto">
              Sessions will appear here once your admin adds them to your assigned courses.
            </p>
          </div>
        )}

        {live.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <h2 className="font-display text-base font-bold text-gray-900">Happening now</h2>
            </div>
            <div className="space-y-3">
              {live.map((s) => <SessionCard key={s.id} s={s} variant="live" />)}
            </div>
          </section>
        )}

        {upcoming.length > 0 && (
          <section>
            <h2 className="font-display text-base font-bold text-gray-900 mb-3">Upcoming</h2>
            <div className="space-y-3">
              {upcoming.map((s) => <SessionCard key={s.id} s={s} variant="upcoming" />)}
            </div>
          </section>
        )}

        {past.length > 0 && (
          <section>
            <h2 className="font-display text-base font-bold text-gray-900 mb-3">Past sessions</h2>
            <div className="space-y-3 opacity-60">
              {past.slice(0, 5).map((s) => <SessionCard key={s.id} s={s} variant="past" />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
