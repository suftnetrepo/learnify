import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { EnrollmentService } from "@/services/enrollment.service";
import { Topbar } from "@/components/layout/Topbar";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { Trophy, Download, ArrowRight } from "lucide-react";

export const metadata: Metadata = { title: "Certificates | Learnify" };

export default async function CertificatesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { enrolled } = await EnrollmentService.getDashboardData(session.user.id);
  const certificates  = enrolled.filter((e) => e.completedAt !== null);

  return (
    <div className="flex flex-col h-full min-h-0">
      <Topbar
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Certificates" }]}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-6 space-y-6 max-w-6xl">
          {/* Header */}
          <div>
            <h1 className="font-display text-2xl font-extrabold text-gray-900">Certificates</h1>
            <p className="mt-1 text-sm text-gray-400">
              {certificates.length} certificate{certificates.length === 1 ? "" : "s"} earned
            </p>
          </div>

          {certificates.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {certificates.map((c) => (
                <div
                  key={c.enrollmentId}
                  className="flex flex-col rounded-2xl border border-surface-100 bg-white p-5"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50">
                      <Trophy size={20} className="text-violet-600" />
                    </div>
                    <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                      Completed
                    </span>
                  </div>

                  {c.categoryName && (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-500 mb-1">
                      {c.categoryName}
                    </p>
                  )}
                  <h3 className="font-semibold text-sm text-gray-900 leading-snug mb-2 flex-1">
                    {c.courseTitle}
                  </h3>
                  <p className="text-xs text-gray-400 mb-4">
                    Completed {formatDate(c.completedAt!)}
                  </p>

                  <a
                    href={`/api/enrollments/${c.enrollmentId}/certificate`}
                    className="flex items-center justify-center gap-2 rounded-xl border border-surface-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:border-brand-300 hover:text-brand-700 transition-colors"
                  >
                    <Download size={15} />
                    Download
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border-2 border-dashed border-surface-200 p-14 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50 mx-auto mb-5">
                <Trophy size={28} className="text-violet-500" />
              </div>
              <h3 className="font-display text-xl font-bold text-gray-900 mb-2">No certificates yet</h3>
              <p className="text-sm text-gray-400 max-w-xs mx-auto mb-6">
                Complete a course to earn your first certificate.
              </p>
              <Link
                href="/courses"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
              >
                Browse Courses <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
