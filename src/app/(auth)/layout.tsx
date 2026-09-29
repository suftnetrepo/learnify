import Link from "next/link";
import Image from "next/image";
import { BookOpenCheck, GraduationCap, Sparkles } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f6f7fb] p-4 sm:p-6">
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage: "radial-gradient(circle, #dfe3ef 1px, transparent 1px)",
          backgroundSize: "30px 30px",
        }}
      />
      <div className="pointer-events-none absolute -left-24 top-12 h-80 w-80 rounded-full bg-brand-100/60 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-10 h-80 w-80 rounded-full bg-violet-100/60 blur-3xl" />

      <main
        className="relative z-10 w-full max-w-[920px] overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_28px_80px_rgba(31,41,55,0.10)]"
      >
        <div className="flex min-h-[600px]">
          <section className="relative hidden w-[42%] flex-col overflow-hidden border-r border-brand-100/70 bg-gradient-to-br from-[#eef3ff] via-[#f2f4ff] to-[#f8f5ff] p-9 lg:flex">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full border-[42px] border-white/45" />
            <div className="pointer-events-none absolute -bottom-28 -left-24 h-72 w-72 rounded-full bg-brand-100/45" />

            <Link href="/" className="relative z-10 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white p-1.5 shadow-[0_10px_25px_rgba(79,70,229,0.12)] ring-1 ring-brand-100">
                <Image src="/logo.png" alt="Edquis" width={44} height={44} className="rounded-lg" />
              </div>
              <span className="font-display text-lg font-extrabold tracking-tight text-gray-900">Edquis</span>
            </Link>

            <div className="relative z-10 my-auto py-12">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200/70 bg-white/70 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700 shadow-sm backdrop-blur-sm">
                <Sparkles size={12} /> Learn with purpose
              </span>
              <h2 className="mt-6 max-w-sm font-display text-[2rem] font-extrabold leading-[1.15] tracking-tight text-slate-900">
                Learning designed around your next step.
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-6 text-slate-600">
                Access your courses, live sessions and learning resources from one calm, focused workspace.
              </p>

              <div className="mt-8 space-y-3">
                <div className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/60 p-3.5 backdrop-blur-sm">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                    <BookOpenCheck size={17} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Structured learning</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">Keep lessons, notes and progress together.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/60 p-3.5 backdrop-blur-sm">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                    <GraduationCap size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Progress with confidence</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">Return to exactly where you left off.</p>
                  </div>
                </div>
              </div>
            </div>

            <p className="relative z-10 text-[11px] leading-5 text-slate-400">
              A focused space for students and instructors.
            </p>
          </section>

          <section className="flex flex-1 flex-col justify-center bg-white px-6 py-10 sm:px-12 lg:px-14">
            <Link href="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
              <Image src="/logo.png" alt="Edquis" width={34} height={34} className="rounded-lg" />
              <span className="font-display text-base font-extrabold text-gray-900">Edquis</span>
            </Link>
            <div className="w-full max-w-[360px] self-center">
              {children}
            </div>
          </section>
        </div>
      </main>

      <p className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap text-[11px] text-gray-400 sm:bottom-4">
        © {new Date().getFullYear()} Edquis · All rights reserved.
      </p>
    </div>
  );
}
