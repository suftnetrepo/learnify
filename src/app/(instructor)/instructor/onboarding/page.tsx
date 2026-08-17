import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { StripeConnectCard } from "./StripeConnectCard";

export const metadata: Metadata = { title: "Stripe Onboarding" };

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [tutor] = await db
    .select({
      stripeAccountId:         users.stripeAccountId,
      stripeOnboardingStatus:  users.stripeOnboardingStatus,
      stripePayoutsEnabled:    users.stripePayoutsEnabled,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return (
    <div>
      <Topbar
        breadcrumbs={[
          { label: "Instructor" },
          { label: "Stripe Onboarding" },
        ]}
      />
      <div className="p-6 max-w-2xl">
        <h1 className="heading-1 text-gray-900">Set up payouts</h1>
        <p className="mt-2 text-sm text-gray-500">
          Connect your bank account via Stripe to receive payments when students
          enrol in your courses. This takes about 5 minutes.
        </p>
        <div className="mt-8">
          <StripeConnectCard
            status={tutor?.stripeOnboardingStatus ?? "not_started"}
            payoutsEnabled={tutor?.stripePayoutsEnabled ?? false}
            hasAccount={!!tutor?.stripeAccountId}
          />
        </div>
      </div>
    </div>
  );
}
