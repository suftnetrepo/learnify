import { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { auth } from "@/lib/auth";
import { isAiTutorPassEnabled } from "@/lib/flags";
import { AI_PASS_TERMS, AI_PASS_TERMS_SECTIONS } from "@/lib/ai-pass/terms";

export const metadata: Metadata = { title: "AI Tutor Pass Terms" };

/** AI Tutor Pass terms (versioned; the accepted version is stored with each purchase). Hidden while the feature is off. */
export default async function AiTutorPassTermsPage() {
  await connection();   // decide per request — the feature flag is a runtime setting, not a build-time one
  if (!isAiTutorPassEnabled()) notFound();
  const session = await auth();
  return (
    <div className="min-h-screen bg-white">
      <Navbar session={session} />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        {!AI_PASS_TERMS.approved && (
          <p role="note" className="mb-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <strong>Draft for legal review.</strong> These terms have not been approved and are not in force.
          </p>
        )}
        <h1 className="font-display text-4xl font-bold text-gray-900">AI Tutor Pass Terms</h1>
        <p className="mt-2 text-sm text-gray-500">Version {AI_PASS_TERMS.version}</p>

        <div className="mt-10 space-y-8 leading-relaxed text-gray-600">
          {AI_PASS_TERMS_SECTIONS.map((s) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-heading`}>
              <h2 id={`${s.id}-heading`} className="mb-3 font-display text-xl font-bold text-gray-900">{s.heading}</h2>
              {s.paragraphs.map((p, i) => <p key={i} className={i ? "mt-3" : undefined}>{p}</p>)}
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
