import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-50 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500 mb-6">
        <Sparkles size={28} className="text-white" />
      </div>
      <p className="text-7xl font-bold text-brand-100 font-display mb-4">404</p>
      <h1 className="heading-1 text-gray-900 mb-2">Page not found</h1>
      <p className="text-gray-500 mb-8 max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="flex gap-3">
        <Link href="/" className="btn-primary">Go home</Link>
        <Link href="/courses" className="btn-secondary">Browse courses</Link>
      </div>
    </div>
  );
}
