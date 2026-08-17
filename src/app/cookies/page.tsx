import { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { auth } from "@/lib/auth";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = { title: "Cookie Policy — Learnify" };

export default async function CookiePolicyPage() {
  const session = await auth();
  return (
    <div className="min-h-screen bg-white">
      <Navbar session={session} />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="font-display text-4xl font-bold text-gray-900">Cookie Policy</h1>
        <p className="mt-2 text-sm text-gray-400">Last updated: 1 August 2026</p>

        <div className="mt-10 space-y-8 text-gray-600 leading-relaxed">

          <section>
            <h2 className="font-display text-xl font-bold text-gray-900 mb-3">What Are Cookies</h2>
            <p>Cookies are small text files stored on your device when you visit a website. They help us remember your preferences and keep you signed in.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-gray-900 mb-3">Cookies We Use</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-surface-200 rounded-xl overflow-hidden">
                <thead className="bg-surface-50">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Cookie</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Purpose</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Duration</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">authjs.session-token</td>
                    <td className="px-4 py-3">Keeps you signed in securely</td>
                    <td className="px-4 py-3">30 days</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-brand-100 text-brand-700 text-xs font-semibold px-2 py-0.5">Essential</span></td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">authjs.csrf-token</td>
                    <td className="px-4 py-3">Protects against cross-site request forgery</td>
                    <td className="px-4 py-3">Session</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-brand-100 text-brand-700 text-xs font-semibold px-2 py-0.5">Essential</span></td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">__stripe_mid</td>
                    <td className="px-4 py-3">Stripe fraud prevention during checkout</td>
                    <td className="px-4 py-3">1 year</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5">Functional</span></td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">__stripe_sid</td>
                    <td className="px-4 py-3">Stripe session identification</td>
                    <td className="px-4 py-3">30 minutes</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5">Functional</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-gray-900 mb-3">Essential Cookies</h2>
            <p>We only use essential and functional cookies. We do not use analytics cookies, advertising cookies, or tracking pixels. Essential cookies cannot be disabled as they are required for the platform to function.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-gray-900 mb-3">Managing Cookies</h2>
            <p>You can delete cookies at any time through your browser settings. Note that deleting your session cookie will sign you out of Learnify. Most browsers also allow you to block cookies — however, this will prevent you from signing in.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-gray-900 mb-3">Contact</h2>
            <p>Questions about our cookie use? Email <a href="mailto:privacy@learnify.dev" className="text-brand-600 hover:underline">privacy@learnify.dev</a>.</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
