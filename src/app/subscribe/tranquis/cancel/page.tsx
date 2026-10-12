import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Payment Cancelled — Tranquis" };

interface Props {
  searchParams: Promise<{ user_id?: string }>;
}

export default async function TransquisCancelPage({ searchParams }: Props) {
  const { user_id } = await searchParams;
  const retryHref   = `/subscribe/tranquis${user_id ? `?user_id=${user_id}` : ""}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-6">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
          <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">No worries</h1>
          <p className="mt-2 text-gray-500">
            Your payment was not completed. You have not been charged.
          </p>
        </div>

        <Link
          href={retryHref}
          className="block w-full rounded-xl bg-indigo-600 py-3 px-4 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          View plans
        </Link>
      </div>
    </div>
  );
}
