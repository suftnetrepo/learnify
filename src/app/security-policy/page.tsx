import { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { auth } from "@/lib/auth";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = { title: "Security Policy" };

const LAST_UPDATED = "29 September 2026";

export default async function SecurityPolicyPage() {
  const session = await auth();
  return (
    <div className="min-h-screen bg-white">
      <Navbar session={session} />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="font-display text-4xl font-bold text-gray-900">Security Policy</h1>
        <p className="mt-2 text-sm text-gray-400">Last updated: {LAST_UPDATED}</p>

        <div className="mt-10 space-y-8 text-gray-600 leading-relaxed">

          <section>
            <h2 className="font-display text-xl font-bold text-gray-900 mb-3">1. Our Commitment</h2>
            <p>Keeping the data of our students and instructors safe is a priority for Edquis. If you believe you have found a security vulnerability in the platform, we want to hear from you and will work with you to resolve it.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-gray-900 mb-3">2. Reporting a Vulnerability</h2>
            <p className="mb-3">Please email <a href="mailto:info@suftnet.com?subject=Security%20report" className="text-brand-600 hover:underline">info@suftnet.com</a> with the subject line "Security report" and include:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>A description of the vulnerability and its potential impact.</li>
              <li>The URL, page, or API endpoint affected.</li>
              <li>Step-by-step instructions to reproduce the issue.</li>
              <li>Any proof-of-concept code, screenshots, or logs that help us understand it.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-gray-900 mb-3">3. What to Expect</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>We aim to acknowledge your report within 5 business days.</li>
              <li>We will investigate, keep you informed of our progress, and let you know when the issue is fixed.</li>
              <li>With your permission, we are happy to credit you once the issue has been resolved.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-gray-900 mb-3">4. Guidelines for Researchers</h2>
            <p className="mb-3">We will not pursue action against anyone who reports a vulnerability in good faith and follows these guidelines:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Only test against accounts you own or have explicit permission to use.</li>
              <li>Do not access, modify, or delete data belonging to other users.</li>
              <li>Do not degrade the service — no denial-of-service, spam, or automated high-volume testing.</li>
              <li>Do not use social engineering, phishing, or physical attacks against our staff or users.</li>
              <li>Give us reasonable time to fix the issue before disclosing it publicly.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-gray-900 mb-3">5. Out of Scope</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Vulnerabilities in third-party services we use, such as Stripe or Cloudinary — please report these to the provider directly.</li>
              <li>Reports from automated scanners without a demonstrated impact.</li>
              <li>Missing security headers or best practices that do not lead to an exploitable issue.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-gray-900 mb-3">6. Contact</h2>
            <p>For anything else related to security, contact us at <a href="mailto:info@suftnet.com" className="text-brand-600 hover:underline">info@suftnet.com</a>. Questions about how we handle personal data are covered in our <Link href="/privacy" className="text-brand-600 hover:underline">Privacy Policy</Link>.</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
