"use client";

import { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import {
  Mail, MapPin, Clock, MessageSquare,
  CheckCircle2, ArrowRight, Phone, BookOpen, Users, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RecaptchaProvider, useRecaptcha } from "@/lib/recaptcha";

const TOPICS = [
  { value: "course",       label: "Course enquiry" },
  { value: "instructor",   label: "Becoming an instructor" },
  { value: "corporate",    label: "Corporate / team training" },
  { value: "technical",    label: "Technical support" },
  { value: "billing",      label: "Billing & payments" },
  { value: "partnership",  label: "Partnership" },
  { value: "other",        label: "Something else" },
];

const CHANNELS = [
  {
    icon:  Mail,
    title: "Email us",
    body:  "Send us a message and we'll reply within 24 hours.",
    value: "hello@learnify.dev",
    href:  "mailto:hello@learnify.dev",
    color: "bg-brand-50 text-brand-600",
  },
  {
    icon:  MessageSquare,
    title: "Live chat",
    body:  "Chat with the team weekdays 9am–6pm GMT.",
    value: "Start a chat →",
    href:  "#chat",
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    icon:  Phone,
    title: "Call us",
    body:  "Speak to someone directly for urgent matters.",
    value: "+44 (0) 1733 000 000",
    href:  "tel:+441733000000",
    color: "bg-amber-50 text-amber-600",
  },
];

const FAQS = [
  {
    q: "How does the 30-day money-back guarantee work?",
    a: "If you're not satisfied with a course within 30 days of purchase, contact us and we'll issue a full refund — no questions asked. The refund appears on your original payment method within 5–10 business days.",
  },
  {
    q: "Can I become an instructor on Learnify?",
    a: "Yes. We accept applications from practitioners with real-world experience in their field. Use the contact form, select 'Becoming an instructor', and tell us about your expertise. We review every application personally.",
  },
  {
    q: "Do you offer corporate or team training packages?",
    a: "Absolutely. We work with businesses of all sizes to deliver bespoke training programmes — either from our existing catalogue or as custom-built courses for your team. Get in touch and we'll put together a proposal.",
  },
  {
    q: "How long does it take to get a response?",
    a: "We aim to reply to all emails within 24 hours on weekdays. For urgent technical issues, live chat is the fastest way to reach us.",
  },
];

export default function ContactPage() {
  const [topic,     setTopic]     = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [openFaq,   setOpenFaq]   = useState<number | null>(null);
  const getToken = useRecaptcha("contact");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    await getToken(); // execute reCAPTCHA silently
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    setSubmitted(true);
  }

  return (
    <RecaptchaProvider>
    <div className="min-h-screen bg-white">
      <Navbar session={null} />

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="bg-[#1c1d1f] py-16">
        <div className="container">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-400">Get in touch</p>
          <h1 className="font-display text-3xl font-extrabold text-white sm:text-4xl lg:text-5xl">
            We&apos;d love to hear from you
          </h1>
          <p className="mt-4 max-w-lg text-base text-gray-400 leading-relaxed">
            Whether you&apos;ve got a question about a course, want to become an instructor, or just want to say hello —
            we&apos;re real people and we reply to every message.
          </p>
        </div>
      </section>

      {/* ── CONTACT CHANNELS ─────────────────────────────────────────── */}
      <section className="border-b border-surface-100 py-10">
        <div className="container">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {CHANNELS.map(({ icon: Icon, title, body, value, href, color }) => (
              <a key={title} href={href}
                className="group flex items-start gap-4 rounded-2xl border border-surface-200 p-5 hover:border-brand-200 hover:bg-surface-50 transition-all">
                <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${color}`}>
                  <Icon size={20} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{title}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{body}</p>
                  <p className="mt-2 text-xs font-semibold text-brand-600 group-hover:underline">{value}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── MAIN: FORM + INFO ────────────────────────────────────────── */}
      <section className="py-16">
        <div className="container">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_380px]">

            {/* Contact form */}
            <div>
              <h2 className="font-display text-2xl font-bold text-gray-900 mb-6">Send us a message</h2>

              {submitted ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 py-16 text-center px-8">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 mb-4">
                    <CheckCircle2 size={32} className="text-emerald-600" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-gray-900">Message received!</h3>
                  <p className="mt-2 text-sm text-gray-500">
                    We&apos;ll get back to you within 24 hours. In the meantime, check out our FAQ below.
                  </p>
                  <button
                    onClick={() => setSubmitted(false)}
                    className="mt-6 text-sm font-semibold text-brand-600 hover:underline"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Name + Email */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="form-label">Full name *</label>
                      <input required className="form-input" placeholder="Alex Rivera" />
                    </div>
                    <div>
                      <label className="form-label">Email address *</label>
                      <input required type="email" className="form-input" placeholder="you@example.com" />
                    </div>
                  </div>

                  {/* Topic */}
                  <div>
                    <label className="form-label">Topic *</label>
                    <select required value={topic} onChange={(e) => setTopic(e.target.value)} className="form-input">
                      <option value="">Select a topic…</option>
                      {TOPICS.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Organisation — shown for corporate */}
                  {topic === "corporate" && (
                    <div>
                      <label className="form-label">Organisation</label>
                      <input className="form-input" placeholder="Company name" />
                    </div>
                  )}

                  {/* Subject */}
                  <div>
                    <label className="form-label">Subject *</label>
                    <input required className="form-input" placeholder="What is this about?" />
                  </div>

                  {/* Message */}
                  <div>
                    <label className="form-label">Message *</label>
                    <textarea required rows={5} className="form-input resize-none"
                      placeholder="Tell us as much as you can — the more detail, the faster we can help." />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className={cn(
                      "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-white transition-colors",
                      "bg-brand-500 hover:bg-brand-600 disabled:opacity-60 disabled:cursor-not-allowed"
                    )}
                  >
                    {loading ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Sending…
                      </>
                    ) : (
                      <>Send message <ArrowRight size={16} /></>
                    )}
                  </button>

                  <p className="text-xs text-gray-400 text-center">
                    We reply to all messages within 24 hours on weekdays. By submitting you agree to our{" "}
                    <a href="/privacy" className="text-brand-600 hover:underline">Privacy Policy</a>.
                  </p>
                </form>
              )}
            </div>

            {/* Right sidebar */}
            <div className="space-y-5">
              {/* Office info */}
              <div className="rounded-2xl border border-surface-200 bg-surface-50 p-6 space-y-4">
                <h3 className="font-display text-base font-bold text-gray-900">Our office</h3>
                <div className="flex items-start gap-3 text-sm text-gray-600">
                  <MapPin size={16} className="flex-shrink-0 mt-0.5 text-brand-500" />
                  <div>
                    <p className="font-medium text-gray-900">Learnify Ltd</p>
                    <p>Peterborough, England</p>
                    <p>United Kingdom</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Clock size={16} className="flex-shrink-0 text-brand-500" />
                  <div>
                    <p className="font-medium text-gray-900">Office hours</p>
                    <p>Monday – Friday, 9am – 6pm GMT</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Mail size={16} className="flex-shrink-0 text-brand-500" />
                  <a href="mailto:hello@learnify.dev" className="text-brand-600 hover:underline">
                    hello@learnify.dev
                  </a>
                </div>
              </div>

              {/* Quick links */}
              <div className="rounded-2xl border border-surface-200 p-6 space-y-3">
                <h3 className="font-display text-base font-bold text-gray-900">Quick links</h3>
                {[
                  { icon: BookOpen, label: "Browse all courses",       href: "/courses" },
                  { icon: Users,    label: "Become an instructor",     href: "/register?role=tutor" },
                  { icon: Shield,   label: "Refund policy",            href: "/terms" },
                  { icon: Mail,     label: "Privacy & data requests",  href: "/privacy" },
                ].map(({ icon: Icon, label, href }) => (
                  <a key={label} href={href}
                    className="flex items-center gap-3 text-sm text-gray-600 hover:text-brand-600 transition-colors group">
                    <Icon size={15} className="text-gray-400 group-hover:text-brand-500 transition-colors" />
                    {label}
                    <ArrowRight size={12} className="ml-auto text-gray-300 group-hover:text-brand-400 transition-colors" />
                  </a>
                ))}
              </div>

              {/* Response time badge */}
              <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 border border-emerald-200 px-5 py-4">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Typical response: under 24 hours</p>
                  <p className="text-xs text-emerald-600 mt-0.5">We&apos;re a real team — every message is read.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section className="border-t border-surface-100 py-16 bg-surface-50">
        <div className="container">
          <div className="mx-auto max-w-2xl">
            <h2 className="font-display text-2xl font-bold text-gray-900 mb-8 text-center">
              Frequently asked questions
            </h2>
            <div className="space-y-3">
              {FAQS.map(({ q, a }, i) => (
                <div key={i}
                  className="rounded-2xl border border-surface-200 bg-white overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="flex w-full items-center justify-between px-6 py-4 text-left"
                  >
                    <span className="font-medium text-sm text-gray-900 pr-4">{q}</span>
                    <span className={cn(
                      "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-surface-200 text-gray-500 transition-transform text-base font-medium",
                      openFaq === i && "rotate-45"
                    )}>+</span>
                  </button>
                  {openFaq === i && (
                    <div className="border-t border-surface-100 px-6 pb-5 pt-3">
                      <p className="text-sm text-gray-500 leading-relaxed">{a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-8 text-center text-sm text-gray-400">
              Still have questions?{" "}
              <a href="mailto:hello@learnify.dev" className="font-semibold text-brand-600 hover:underline">
                Email us directly
              </a>
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
    </RecaptchaProvider>
  );
}
