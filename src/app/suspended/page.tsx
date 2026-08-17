import { Ban } from "lucide-react";

export default function SuspendedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-50 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 mb-6">
        <Ban size={28} className="text-red-500" />
      </div>
      <h1 className="heading-1 text-gray-900 mb-2">Account suspended</h1>
      <p className="text-gray-500 mb-8 max-w-sm">
        Your account has been suspended. Please contact support if you believe this is a mistake.
      </p>
      <a href="mailto:support@learnify.com" className="btn-primary">Contact support</a>
    </div>
  );
}
