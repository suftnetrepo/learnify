import { Metadata } from "next";
import { UserService, TutorService } from "@/services";
import { Topbar } from "@/components/layout/Topbar";
import { formatDate } from "@/lib/utils";
import { InviteTutorButton } from "./InviteTutorButton";
import { TutorApproveButton } from "./TutorApproveButton";
import { RevokeInviteButton } from "./RevokeInviteButton";
import { GraduationCap, Clock, Send, CheckCircle2, CreditCard, AlertCircle, UserCheck } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = { title: "Manage Tutors" };

export default async function AdminTutorsPage() {
  const [tutors, pendingInvites] = await Promise.all([
    UserService.getTutors(),
    TutorService.getPendingInvitations(),
  ]);

  const pending   = tutors.filter((t) => t.status === "pending");
  const active    = tutors.filter((t) => t.status === "active");
  const suspended = tutors.filter((t) => t.status === "suspended");

  return (
    <div>
      <Topbar breadcrumbs={[{ label: "Admin" }, { label: "Tutors" }]} />
      <div className="p-6 space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="heading-1 text-gray-900">Tutors</h1>
            <div className="mt-2 flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1.5 text-sm text-gray-500"><UserCheck size={14} className="text-emerald-500" />{active.length} active</span>
              {pending.length > 0 && <span className="flex items-center gap-1.5 text-sm text-amber-600 font-medium"><AlertCircle size={14} />{pending.length} awaiting approval</span>}
              {pendingInvites.length > 0 && <span className="flex items-center gap-1.5 text-sm text-gray-500"><Send size={14} />{pendingInvites.length} pending invite{pendingInvites.length > 1 ? "s" : ""}</span>}
            </div>
          </div>
          <InviteTutorButton />
        </div>

        {pending.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3"><Clock size={15} className="text-amber-500" /><h2 className="heading-3 text-gray-900">Awaiting Approval</h2><span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">{pending.length}</span></div>
            <div className="space-y-3">
              {pending.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-200 text-sm font-bold text-amber-800">{t.name?.[0]?.toUpperCase() ?? "T"}</div>
                    <div><p className="font-semibold text-gray-900">{t.name ?? "Unnamed"}</p><p className="text-xs text-gray-500">{t.email}</p><p className="text-xs text-amber-600 mt-0.5">Applied {formatDate(t.createdAt)}</p></div>
                  </div>
                  <TutorApproveButton tutorId={t.id} tutorName={t.name ?? t.email} />
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-500" /><h2 className="heading-3 text-gray-900">Active Tutors</h2></div>
            <Link href="/admin/tutors/assign" className="text-sm font-medium text-brand-600 hover:underline">Assign to course →</Link>
          </div>
          <div className="table-container">
            <table className="w-full min-w-[560px]">
              <thead><tr><th className="table-header">Tutor</th><th className="table-header">Stripe Onboarding</th><th className="table-header">Payouts</th><th className="table-header">Joined</th></tr></thead>
              <tbody>
                {active.length === 0 ? (
                  <tr><td colSpan={4}><div className="flex flex-col items-center justify-center py-12 text-center"><GraduationCap size={32} className="mb-3 text-gray-200" /><p className="text-sm font-medium text-gray-500">No active tutors yet</p></div></td></tr>
                ) : active.map((t) => (
                  <tr key={t.id} className="table-row">
                    <td className="table-cell"><div className="flex items-center gap-3"><div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">{t.name?.[0]?.toUpperCase() ?? "T"}</div><div><p className="font-semibold text-gray-900 truncate">{t.name ?? "Unnamed"}</p><p className="text-xs text-gray-400 truncate">{t.email}</p></div></div></td>
                    <td className="table-cell"><div className="flex items-center gap-2"><div className={`h-1.5 w-1.5 rounded-full ${t.stripeOnboardingStatus === "complete" ? "bg-emerald-500" : t.stripeOnboardingStatus === "in_progress" ? "bg-amber-500" : "bg-gray-300"}`} /><span className="text-sm text-gray-600 capitalize">{t.stripeOnboardingStatus?.replace(/_/g, " ") ?? "Not started"}</span></div></td>
                    <td className="table-cell">{t.stripePayoutsEnabled ? <div className="flex items-center gap-1.5 text-emerald-600"><CreditCard size={13} /><span className="text-xs font-medium">Enabled</span></div> : <span className="text-xs text-gray-400">Not set up</span>}</td>
                    <td className="table-cell text-gray-400 text-xs">{formatDate(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {pendingInvites.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4"><Send size={15} className="text-brand-500" /><h2 className="heading-3 text-gray-900">Pending Invitations</h2></div>
            <div className="table-container">
              <table className="w-full min-w-[560px]">
                <thead><tr><th className="table-header">Email</th><th className="table-header">Sent</th><th className="table-header">Expires</th><th className="table-header w-24"></th></tr></thead>
                <tbody>
                  {pendingInvites.map((inv) => {
                    const expiring = inv.expiresAt < new Date(Date.now() + 86400000);
                    return (
                      <tr key={inv.id} className="table-row">
                        <td className="table-cell"><div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{inv.email[0].toUpperCase()}</div><span className="text-sm text-gray-800">{inv.email}</span></div></td>
                        <td className="table-cell text-gray-400 text-xs">{formatDate(inv.createdAt)}</td>
                        <td className="table-cell"><span className={`text-xs font-medium ${expiring ? "text-red-500" : "text-gray-400"}`}>{expiring ? "Expiring soon — " : ""}{formatDate(inv.expiresAt)}</span></td>
                        <td className="table-cell"><RevokeInviteButton inviteId={inv.id} email={inv.email} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
