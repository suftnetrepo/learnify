import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative flex min-h-screen items-center justify-center p-4 sm:p-6 bg-surface-50"
    >
      {/* Subtle dot pattern on light bg */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage: "radial-gradient(circle, #e4e4ef 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Floating card */}
      <div className="relative z-10 w-full max-w-[880px] overflow-hidden rounded-2xl shadow-2xl"
        style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.06)" }}>
        <div className="flex min-h-[560px]">

          {/* ── Left panel ─────────────────────────────────────────────────── */}
          <div
            className="relative hidden w-[42%] flex-col overflow-hidden lg:flex"
            style={{ background: "#111126" }}
          >
            {/* Inner glows */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -left-16 -top-16 h-64 w-64 rounded-full bg-brand-600/25 blur-[60px]" />
              <div className="absolute -bottom-16 right-0 h-56 w-56 rounded-full bg-violet-600/20 blur-[60px]" />
            </div>

            {/* Logo */}
            <div className="relative z-10 p-8">
              <Link href="/" className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 shadow-glow-brand">
                  <Sparkles size={16} className="text-white" />
                </div>
                <span className="font-display text-base font-bold text-white">Learnify</span>
              </Link>
            </div>

            {/* SVG Illustration */}
            <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-8">
              <svg viewBox="0 0 300 240" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-[240px]">
                <ellipse cx="150" cy="125" rx="130" ry="105" fill="rgba(99,102,241,0.09)" />
                {/* Monitor */}
                <rect x="78" y="72" width="144" height="104" rx="9" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5"/>
                <rect x="88" y="82" width="124" height="76" rx="5" fill="rgba(99,102,241,0.22)"/>
                <rect x="98" y="94" width="52" height="5" rx="2.5" fill="rgba(255,255,255,0.5)"/>
                <rect x="98" y="105" width="70" height="4" rx="2" fill="rgba(255,255,255,0.25)"/>
                <rect x="98" y="114" width="60" height="4" rx="2" fill="rgba(255,255,255,0.18)"/>
                <rect x="98" y="123" width="76" height="4" rx="2" fill="rgba(255,255,255,0.14)"/>
                <rect x="98" y="144" width="96" height="6" rx="3" fill="rgba(255,255,255,0.07)"/>
                <rect x="98" y="144" width="60" height="6" rx="3" fill="rgba(99,102,241,0.75)"/>
                <rect x="141" y="176" width="18" height="10" rx="2" fill="rgba(255,255,255,0.07)"/>
                <rect x="126" y="186" width="48" height="5" rx="2.5" fill="rgba(255,255,255,0.06)"/>
                {/* Desk */}
                <rect x="42" y="192" width="216" height="10" rx="5" fill="rgba(255,255,255,0.06)"/>
                {/* Book */}
                <path d="M44 188C44 188 44 164 66 164L86 164L86 188Z" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.14)" strokeWidth="1"/>
                <path d="M86 164L106 164C128 164 128 188 128 188L86 188Z" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
                <line x1="86" y1="164" x2="86" y2="188" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5"/>
                <rect x="52" y="172" width="26" height="3" rx="1.5" fill="rgba(255,255,255,0.18)"/>
                <rect x="52" y="179" width="20" height="2.5" rx="1.25" fill="rgba(255,255,255,0.12)"/>
                <rect x="92" y="172" width="26" height="3" rx="1.5" fill="rgba(255,255,255,0.18)"/>
                {/* Floating card */}
                <g transform="translate(212,58)">
                  <rect width="70" height="46" rx="9" fill="rgba(99,102,241,0.32)" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
                  <rect x="8" y="10" width="20" height="20" rx="5" fill="rgba(255,255,255,0.12)"/>
                  <rect x="34" y="14" width="28" height="4" rx="2" fill="rgba(255,255,255,0.42)"/>
                  <rect x="34" y="22" width="20" height="3" rx="1.5" fill="rgba(255,255,255,0.2)"/>
                  <rect x="8" y="35" width="54" height="4" rx="2" fill="rgba(255,255,255,0.08)"/>
                  <rect x="8" y="35" width="34" height="4" rx="2" fill="rgba(255,255,255,0.45)"/>
                </g>
                {/* Badge */}
                <g transform="translate(14,78)">
                  <rect width="72" height="32" rx="16" fill="rgba(16,185,129,0.2)" stroke="rgba(16,185,129,0.4)" strokeWidth="1"/>
                  <circle cx="16" cy="16" r="9" fill="rgba(16,185,129,0.4)"/>
                  <path d="M12 16L15 19L21 13" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <rect x="30" y="10" width="32" height="4" rx="2" fill="rgba(255,255,255,0.48)"/>
                  <rect x="30" y="18" width="22" height="3" rx="1.5" fill="rgba(255,255,255,0.26)"/>
                </g>
                {/* Stars */}
                <circle cx="250" cy="46" r="2.5" fill="rgba(251,191,36,0.8)"/>
                <circle cx="262" cy="58" r="1.5" fill="rgba(251,191,36,0.6)"/>
                <circle cx="56" cy="54" r="3" fill="rgba(99,102,241,0.5)"/>
                <circle cx="262" cy="158" r="2" fill="rgba(139,92,246,0.45)"/>
              </svg>

              {/* Copy */}
              <div className="mt-6 text-center">
                <h2 className="font-display text-xl font-bold leading-snug text-white">
                  Skills that move<br />
                  <span className="bg-gradient-to-r from-brand-300 to-violet-300 bg-clip-text text-transparent">
                    careers forward
                  </span>
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-gray-500">
                  Join 50,000+ learners building<br />real skills with expert-led courses.
                </p>
              </div>

              {/* Dot nav */}
              <div className="mt-5 flex items-center gap-1.5">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className={`h-1.5 rounded-full transition-all ${i === 2 ? "w-5 bg-brand-500" : "w-1.5 bg-white/15"}`} />
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="relative z-10 border-t border-white/[0.06] px-8 py-5">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { v: "50k+", l: "Students" },
                  { v: "500+", l: "Courses"  },
                  { v: "4.9",  l: "Avg. Rating" },
                ].map(({ v, l }) => (
                  <div key={l}>
                    <p className="font-display text-base font-bold text-white">{v}</p>
                    <p className="mt-0.5 text-[10px] text-gray-600">{l}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right panel — form ──────────────────────────────────────────── */}
          <div className="flex flex-1 flex-col justify-center bg-white px-8 py-10 sm:px-10">
            {/* Mobile logo */}
            <Link href="/" className="mb-6 flex items-center gap-2 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500">
                <Sparkles size={15} className="text-white" />
              </div>
              <span className="font-display text-base font-bold text-gray-900">Learnify</span>
            </Link>

            {/* Desktop logo inside form */}
            <Link href="/" className="mb-6 hidden items-center gap-2 lg:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 shadow-glow-brand">
                <Sparkles size={15} className="text-white" />
              </div>
              <span className="font-display text-base font-bold text-gray-900">Learnify</span>
            </Link>

            <div className="w-full max-w-[340px]">
              {children}
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-gray-400 z-10">
        © {new Date().getFullYear()} Learnify · All rights reserved.
      </p>
    </div>
  );
}
