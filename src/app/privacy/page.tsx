import { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { auth } from "@/lib/auth";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = { title: "Privacy Policy — Learnify" };

const LAST_UPDATED = "1 August 2026";

export default async function PrivacyPage() {
  const session = await auth();
  return (
    <div className="min-h-screen bg-white">
      <Navbar session={session} />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="font-display text-4xl font-bold text-gray-900">Privacy Policy</h1>
        <p className="mt-2 text-sm text-gray-400">Last updated: {LAST_UPDATED}</p>

        <div className="mt-10 space-y-8 text-gray-600 leading-relaxed">

          <section>
            <h2 className="font-display text-xl font-bold text-gray-900 mb-3">1. Who We Are</h2>
            <p>Learnify ("we", "our", "us") operates the Learnify learning platform. We are the data controller for personal data collected through the platform. For GDPR purposes, our registered address is in England and Wales.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-gray-900 mb-3">2. Data We Collect</h2>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Account data:</strong> name, email address, password (hashed), role.</li>
              <li><strong>Payment data:</strong> transaction amounts and dates. We do not store card details — these are handled by Stripe.</li>
              <li><strong>Learning data:</strong> course progress, lecture completion, certificates earned.</li>
              <li><strong>Usage data:</strong> pages visited, time spent, device type, IP address.</li>
              <li><strong>Communications:</strong> messages you send to our support team.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-gray-900 mb-3">3. How We Use Your Data</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>To provide and improve the platform and your learning experience.</li>
              <li>To process payments and issue refunds.</li>
              <li>To send transactional emails (purchase confirmations, certificates, password resets).</li>
              <li>To comply with legal obligations.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-gray-900 mb-3">4. Legal Basis (GDPR)</h2>
            <p>We process your data on the basis of contract performance (to deliver the service you purchased), legitimate interests (platform security and improvement), and legal compliance. For marketing communications, we rely on your explicit consent.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-gray-900 mb-3">5. Data Sharing</h2>
            <p className="mb-3">We share data only with trusted third-party processors:</p>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Stripe</strong> — payment processing (PCI DSS compliant).</li>
              <li><strong>Cloudinary</strong> — video and image hosting.</li>
              <li><strong>Resend</strong> — transactional email delivery.</li>
              <li><strong>Neon / PostgreSQL</strong> — database hosting.</li>
            </ul>
            <p className="mt-3">We never sell your personal data to third parties.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-gray-900 mb-3">6. Your Rights</h2>
            <p className="mb-3">Under GDPR and UK data protection law, you have the right to:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Access the personal data we hold about you.</li>
              <li>Correct inaccurate data.</li>
              <li>Request deletion of your data ("right to be forgotten").</li>
              <li>Object to processing or request restriction.</li>
              <li>Data portability — receive your data in a machine-readable format.</li>
            </ul>
            <p className="mt-3">To exercise any of these rights, contact <a href="mailto:privacy@learnify.dev" className="text-brand-600 hover:underline">privacy@learnify.dev</a>.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-gray-900 mb-3">7. Data Retention</h2>
            <p>We retain account data for the duration of your account plus 3 years for legal and financial compliance. Payment records are retained for 7 years as required by HMRC. You may request deletion at any time for non-financial data.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-gray-900 mb-3">8. Cookies</h2>
            <p>We use essential cookies for authentication and session management. See our <a href="/cookies" className="text-brand-600 hover:underline">Cookie Policy</a> for details.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-gray-900 mb-3">9. Contact & Complaints</h2>
            <p>Contact our Data Protection Officer at <a href="mailto:privacy@learnify.dev" className="text-brand-600 hover:underline">privacy@learnify.dev</a>. You also have the right to lodge a complaint with the ICO (Information Commissioner's Office) at <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">ico.org.uk</a>.</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
