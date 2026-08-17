import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getConnectAccount } from "@/lib/stripe";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

/**
 * Stripe redirects here after the tutor completes onboarding.
 * We sync the account status from Stripe, then show a confirmation.
 */
export default async function OnboardingCompletePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [tutor] = await db
    .select({ stripeAccountId: users.stripeAccountId })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  // Sync latest status from Stripe
  if (tutor?.stripeAccountId) {
    try {
      const account = await getConnectAccount(tutor.stripeAccountId);
      await db
        .update(users)
        .set({
          stripePayoutsEnabled:   account.payouts_enabled ?? false,
          stripeChargesEnabled:   account.charges_enabled ?? false,
          stripeOnboardingStatus: account.details_submitted && account.payouts_enabled
            ? "complete" : "in_progress",
          updatedAt: new Date(),
        })
        .where(eq(users.id, session.user.id));
    } catch {
      // Non-fatal — webhook will sync later
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-50 p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 size={40} className="text-emerald-500" />
        </div>
        <h1 className="heading-1 text-gray-900">You&apos;re all set!</h1>
        <p className="mt-3 text-gray-500">
          Your Stripe account has been connected. You&apos;ll start receiving
          payouts every Friday once students enrol in your courses.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/instructor/courses">
            <Button size="lg">Go to my courses</Button>
          </Link>
          <Link href="/instructor/earnings">
            <Button variant="secondary" size="lg">View earnings</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
