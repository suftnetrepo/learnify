import { Metadata } from "next";
import { XCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Checkout Cancelled" };

interface Props { searchParams: Promise<{ courseId?: string }> }

export default async function CheckoutCancelPage({ searchParams }: Props) {
  const { courseId } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-50 p-6">
      <div className="max-w-md text-center space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
          <XCircle size={40} className="text-gray-400" />
        </div>
        <div>
          <h1 className="heading-1 text-gray-900">Payment cancelled</h1>
          <p className="mt-2 text-gray-500">
            No charge was made. You can try again whenever you&apos;re ready.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          {courseId && (
            <Link href={`/checkout/${courseId}`}>
              <Button size="lg">Try again</Button>
            </Link>
          )}
          <Link href="/courses">
            <Button variant="secondary" size="lg">Browse courses</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
