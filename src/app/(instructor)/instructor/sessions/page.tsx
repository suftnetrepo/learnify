import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import { Topbar } from "@/components/layout/Topbar";
import { formatDate } from "@/lib/utils";
import { Calendar, Clock, Users, MapPin, Video, CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/ui/Card";

export const metadata: Metadata = { title: "My Sessions" };

const PLATFORM_LABELS: Record<string, string> = {
  zoom: "Zoom", teams: "Microsoft Teams", google_meet: "Google Meet",
  webex: "Cisco Webex", other: "Other",
};

export default async function InstructorSessionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const tutorId = session.user.id;

  const allSessions = await SessionService.getInstructorSessions(tutorId);
  const now = new Date();
  const upcoming = allSessions.filter((s) => new Date(s.startDatetime) >= now);
  const past     = allSessions.filter((s) => new Date(s.startDatetime) < now);

  return (
    <div>
      <Topbar breadcrumbs={[{ label: "Instructor" }, { label: "Sessions" }]} />
      <div className="p-6 space-y-8">
        <div>
          <h1 className="heading-1 text-gray-900">My Sessions</h1>
          <p className="mt-1 text-sm text-gray-500">{upcoming.length} upcoming · {allSessions.length} total sessions</p>
        </div>

        {upcoming.length > 0 && (
          <section className="space-y-4">
            <h2 className="heading-2 text-gray-900">Upcoming</h2>
            {upcoming.map((s) => <div key={s.id} className="card p-4"><p className="font-semibold">{s.courseTitle}</p><p className="text-sm text-gray-500">{new Date(s.startDatetime).toLocaleString()}</p></div>)}
          </section>
        )}

        {past.length > 0 && (
          <section className="space-y-4">
            <h2 className="heading-2 text-gray-900">Past</h2>
            <div className="opacity-75 space-y-4">
              {past.map((s) => <div key={s.id} className="card p-4 opacity-60"><p className="font-semibold">{s.courseTitle}</p><p className="text-sm text-gray-500">{new Date(s.startDatetime).toLocaleString()}</p></div>)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
