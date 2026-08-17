import { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { auth } from "@/lib/auth";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = { title: "Terms of Service — Learnify" };

const LAST_UPDATED = "1 August 2026";

export default async function TermsPage() {
  const session = await auth();
  return (
    <div className="min-h-screen bg-white">
      <Navbar session={session} />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="font-display text-4xl font-bold text-gray-900">Terms of Service</h1>
        <p className="mt-2 text-sm text-gray-400">Last updated: {LAST_UPDATED}</p>

        <div className="mt-10 space-y-8 text-gray-600 leading-relaxed">

          <section>
            <h2 className="font-display text-xl font-bold text-gray-900 mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using Learnify ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Platform.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-gray-900 mb-3">2. Description of Service</h2>
            <p>Learnify is an online learning management platform that connects students with instructors. We facilitate the delivery of educational courses in online, in-person, and hybrid formats.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-gray-900 mb-3">3. User Accounts</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>You must be at least 18 years old to create an account.</li>
              <li>You are responsible for maintaining the confidentiality of your password.</li>
              <li>You agree to provide accurate and complete information when registering.</li>
              <li>We reserve the right to suspend or terminate accounts that violate these terms.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-gray-900 mb-3">4. Payments and Refunds</h2>
            <p className="mb-3">All course purchases are processed securely through Stripe. Prices are displayed in GBP and include applicable taxes.</p>
            <p className="mb-3"><strong>30-day money-back guarantee:</strong> If you are not satisfied with a course, you may request a full refund within 30 days of purchase, provided you have completed less than 50% of the course content.</p>
            <p>Refunds are processed to the original payment method within 5–10 business days. The 30-day window begins on the date of purchase.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-gray-900 mb-3">5. Intellectual Property</h2>
            <p>All course content, including videos, documents, and materials, remains the intellectual property of the respective instructors or Learnify. You may not reproduce, distribute, or create derivative works without express written permission.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-gray-900 mb-3">6. Prohibited Conduct</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Sharing account credentials or course access with third parties.</li>
              <li>Recording, redistributing, or reselling course content.</li>
              <li>Submitting false reviews or engaging in review manipulation.</li>
              <li>Using the platform for any unlawful purpose.</li>
              <li>Attempting to circumvent technical measures protecting the platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-gray-900 mb-3">7. Limitation of Liability</h2>
            <p>Learnify is provided on an "as is" basis. To the maximum extent permitted by law, Learnify shall not be liable for any indirect, incidental, or consequential damages arising from your use of the platform.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-gray-900 mb-3">8. Governing Law</h2>
            <p>These terms are governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-gray-900 mb-3">9. Contact</h2>
            <p>For questions about these terms, contact us at <a href="mailto:legal@learnify.dev" className="text-brand-600 hover:underline">legal@learnify.dev</a>.</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
