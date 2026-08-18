import { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PaymentService } from "@/services/payment.service";
import { CourseService } from "@/services";
import { stripe } from "@/lib/stripe";
import { CheckCircle2, BookOpen } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Enrolment Confirmed" };

interface Props { searchParams: Promise<{ session_id?: string }> }

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const { session_id } = await searchParams;
  const session        = await auth();

  if (!session?.user) redirect("/login");
  if (!session_id)    redirect("/dashboard");

  // Fetch the Stripe session to confirm payment
  let stripeSession;
  try {
    stripeSession = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["line_items"],
    });
  } catch {
    redirect("/dashboard");
  }

  if (stripeSession.payment_status !== "paid" && stripeSession.payment_status !== "no_payment_required") {
    redirect("/dashboard");
  }

  // Find the purchase record via service
  const purchase = await PaymentService.findByStripeSession(session_id);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-50 p-6">
      <div className="max-w-lg w-full text-center space-y-6">
        {/* Success icon */}
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 size={48} className="text-emerald-500" />
        </div>

        <div>
          <h1 className="heading-1 text-gray-900">You&apos;re enrolled!</h1>
          {purchase?.courseTitle && (
            <p className="mt-2 text-lg text-gray-500">
              Welcome to <strong className="text-gray-800">{purchase.courseTitle}</strong>
            </p>
          )}
          {purchase?.amount && (
            <p className="mt-1 text-sm text-gray-400">
              Payment of {formatCurrency(Number(purchase.amount))} confirmed
            </p>
          )}
        </div>

        {/* What's next */}
        <div className="card p-6 text-left space-y-3">
          <p className="text-sm font-semibold text-gray-700">What happens next</p>
          <div className="space-y-2.5 text-sm text-gray-500">
            <p className="flex items-center gap-2"><CheckCircle2 size={14} className="flex-shrink-0 text-emerald-500" />You have instant access to all course content</p>
            <p className="flex items-center gap-2"><CheckCircle2 size={14} className="flex-shrink-0 text-emerald-500" />A confirmation email is on its way to you</p>
            <p className="flex items-center gap-2"><CheckCircle2 size={14} className="flex-shrink-0 text-emerald-500" />Track your progress from your dashboard</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          {purchase?.courseId && (
            <Link href={`/learn/${purchase.courseId}`}>
              <Button size="lg" leftIcon={<BookOpen size={18} />}>
                Start learning
              </Button>
            </Link>
          )}
          <Link href="/dashboard">
            <Button variant="secondary" size="lg">
              Go to dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
