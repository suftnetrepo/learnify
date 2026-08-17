import { Clock } from "lucide-react";
import Link from "next/link";

export default function PendingApprovalPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-50 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 mb-6">
        <Clock size={28} className="text-amber-500" />
      </div>
      <h1 className="heading-1 text-gray-900 mb-2">Application under review</h1>
      <p className="text-gray-500 mb-8 max-w-sm">
        Your tutor application is being reviewed by our team. We&apos;ll email you once it&apos;s approved — usually within 24 hours.
      </p>
      <Link href="/" className="btn-secondary">Back to home</Link>
    </div>
  );
}
