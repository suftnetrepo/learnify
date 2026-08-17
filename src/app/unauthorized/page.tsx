import Link from "next/link";
import { ShieldX } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-50 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 mb-6">
        <ShieldX size={28} className="text-red-500" />
      </div>
      <h1 className="heading-1 text-gray-900 mb-2">Access denied</h1>
      <p className="text-gray-500 mb-8 max-w-sm">
        You don&apos;t have permission to view this page.
      </p>
      <Link href="/dashboard" className="btn-primary">Back to dashboard</Link>
    </div>
  );
}
