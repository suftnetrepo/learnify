import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import Link from "next/link";
import { Calendar, ArrowRight } from "lucide-react";

export const metadata: Metadata = { title: "Calendar | Learnify" };

export default async function CalendarPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex flex-col h-full min-h-0">
      <Topbar
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Calendar" }]}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-6 space-y-6 max-w-6xl">
          {/* Header */}
          <div>
            <h1 className="font-display text-2xl font-extrabold text-gray-900">Calendar</h1>
            <p className="mt-1 text-sm text-gray-400">Your upcoming live and in-person sessions.</p>
          </div>

          {/* Empty state */}
          <div className="rounded-2xl border border-surface-100 bg-white p-14 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 mx-auto mb-5">
              <Calendar size={28} className="text-brand-500" />
            </div>
            <h3 className="font-display text-xl font-bold text-gray-900 mb-2">No sessions scheduled</h3>
            <p className="text-sm text-gray-400 max-w-sm mx-auto mb-6">
              Session bookings will appear here once you enrol in a live or in-person course.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link
                href="/courses?format=in_person"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
              >
                In-person courses <ArrowRight size={14} />
              </Link>
              <Link
                href="/courses?format=hybrid"
                className="inline-flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:border-brand-300 hover:text-brand-700 transition-colors"
              >
                Hybrid courses <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
