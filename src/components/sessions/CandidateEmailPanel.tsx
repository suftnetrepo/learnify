"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Award,
  CalendarDays,
  Check,
  CheckCircle2,
  Download,
  LoaderCircle,
  Mail,
  Search,
  Send,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

type Candidate = {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  enrolledAt: string;
  progress: number;
  completedAt: string | null;
  enrollmentId: string;
  attendanceStatus: "not_reviewed" | "attended" | "partial" | "absent" | null;
  outcome: "pending" | "passed" | "incomplete" | null;
  attendanceNotes: string | null;
  certificateId: string | null;
  certificateType: "attendance" | "completion" | null;
  certificateUrl: string | null;
  certificateIssuedAt: string | null;
};

type CandidateResponse = {
  session: { id: string; title: string; courseTitle: string; capacity: number; endDatetime: string };
  candidates: Candidate[];
};

export function CandidateEmailPanel({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const { success, error } = useToast();
  const [data, setData] = useState<CandidateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [composerOpen, setComposerOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/sessions/${sessionId}/candidates`)
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.message ?? "Unable to load candidates");
        if (active) setData(json.data);
      })
      .catch((reason) => error("Candidates unavailable", reason instanceof Error ? reason.message : "Please try again"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [error, sessionId]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return data?.candidates ?? [];
    return (data?.candidates ?? []).filter((candidate) =>
      `${candidate.name ?? ""} ${candidate.email}`.toLowerCase().includes(value)
    );
  }, [data, query]);

  const recipients = (data?.candidates ?? []).filter((candidate) => selected.has(candidate.id));
  const activeCandidate = (data?.candidates ?? []).find((candidate) => candidate.id === activeCandidateId) ?? null;
  const allSelected = Boolean(data?.candidates.length) && selected.size === data?.candidates.length;

  function toggle(candidateId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(candidateId)) next.delete(candidateId);
      else next.add(candidateId);
      return next;
    });
  }

  function composeFor(candidateIds: string[]) {
    setSelected(new Set(candidateIds));
    setComposerOpen(true);
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected.size) return;
    setSending(true);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/candidates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateIds: [...selected], subject, message }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.message ?? "Message could not be sent");
      success("Email submitted", json.message);
      setComposerOpen(false);
      setSubject("");
      setMessage("");
    } catch (reason) {
      error("Email not sent", reason instanceof Error ? reason.message : "Please try again");
    } finally {
      setSending(false);
    }
  }

  function certificateIssued(candidateId: string, certificate: { id: string; type: "attendance" | "completion"; pdfUrl: string; issuedAt: string; attendanceStatus: Candidate["attendanceStatus"]; outcome: Candidate["outcome"] }) {
    setData((current) => current ? {
      ...current,
      candidates: current.candidates.map((candidate) => candidate.id === candidateId ? {
        ...candidate,
        attendanceStatus: certificate.attendanceStatus,
        outcome: certificate.outcome,
        certificateId: certificate.id,
        certificateType: certificate.type,
        certificateUrl: certificate.pdfUrl,
        certificateIssuedAt: certificate.issuedAt,
      } : candidate),
    } : current);
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-950/25 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[440px] flex-col border-l border-surface-200 bg-white shadow-[-24px_0_70px_rgba(15,23,42,0.16)]">
        <div className="border-b border-surface-100 px-6 pb-5 pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <UsersRound size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">Session candidates</p>
                <h2 className="mt-1 truncate font-display text-lg font-bold text-gray-900">{data?.session.title ?? "Candidates"}</h2>
                {data && <p className="mt-0.5 truncate text-xs text-gray-400">{data.session.courseTitle}</p>}
              </div>
            </div>
            <button onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-gray-400 transition hover:bg-surface-100 hover:text-gray-700" aria-label="Close candidates panel">
              <X size={17} />
            </button>
          </div>

          {activeCandidate ? (
            <button onClick={() => setActiveCandidateId(null)} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700">
              <ArrowLeft size={15} /> Back to candidate list
            </button>
          ) : (
            <div className="relative mt-5">
              <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email" className="form-input h-11 pl-10" />
            </div>
          )}
        </div>

        {!activeCandidate && <div className="flex items-center justify-between border-b border-surface-100 px-6 py-3">
          <button
            onClick={() => setSelected(allSelected ? new Set() : new Set((data?.candidates ?? []).map(({ id }) => id)))}
            disabled={!data?.candidates.length}
            className="text-xs font-semibold text-gray-500 transition hover:text-brand-600 disabled:opacity-40"
          >
            {allSelected ? "Clear selection" : "Select all candidates"}
          </button>
          <span className="rounded-full bg-surface-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
            {data?.candidates.length ?? 0} enrolled
          </span>
        </div>}

        {activeCandidate && data ? (
          <CandidateCertificateForm
            key={activeCandidate.id}
            sessionId={sessionId}
            session={data.session}
            candidate={activeCandidate}
            onIssued={(certificate) => certificateIssued(activeCandidate.id, certificate)}
          />
        ) : <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex h-48 items-center justify-center text-brand-600"><LoaderCircle className="animate-spin" size={22} /></div>
          ) : !data?.candidates.length ? (
            <div className="flex h-64 flex-col items-center justify-center px-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-50 text-gray-300"><UserRound size={24} /></div>
              <p className="mt-4 text-sm font-semibold text-gray-700">No enrolled candidates</p>
              <p className="mt-1 text-xs leading-5 text-gray-400">Candidates will appear here after they enrol in this session.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((candidate) => {
                const checked = selected.has(candidate.id);
                const initials = (candidate.name ?? candidate.email).split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
                return (
                  <div key={candidate.id} className={cn("group flex items-center gap-3 rounded-2xl border px-3 py-3 transition", checked ? "border-brand-200 bg-brand-50/60" : "border-transparent hover:border-surface-200 hover:bg-surface-50")}>
                    <button onClick={() => toggle(candidate.id)} className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition", checked ? "border-brand-600 bg-brand-600 text-white" : "border-surface-300 bg-white text-transparent")} aria-label={`${checked ? "Deselect" : "Select"} ${candidate.name ?? candidate.email}`}>
                      <Check size={12} strokeWidth={3} />
                    </button>
                    <button onClick={() => setActiveCandidateId(candidate.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-100 to-brand-50 bg-cover bg-center text-xs font-bold text-brand-700"
                        style={candidate.avatarUrl ? { backgroundImage: `url(${candidate.avatarUrl})` } : undefined}
                        aria-hidden="true"
                      >
                        {!candidate.avatarUrl && initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-800">{candidate.name ?? "Candidate"}</p>
                        <p className="mt-0.5 truncate text-xs text-gray-400">{candidate.email}</p>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                            candidate.attendanceStatus === "attended" ? "bg-emerald-50 text-emerald-700" :
                            candidate.attendanceStatus === "absent" ? "bg-red-50 text-red-600" :
                            candidate.attendanceStatus === "partial" ? "bg-amber-50 text-amber-700" : "bg-surface-100 text-gray-500",
                          )}>{(candidate.attendanceStatus ?? "not_reviewed").replace("_", " ")}</span>
                          {candidate.certificateId && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">Certificate issued</span>}
                        </div>
                      </div>
                    </button>
                    <button onClick={() => composeFor([candidate.id])} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-gray-400 transition hover:bg-white hover:text-brand-600 hover:shadow-sm" title={`Email ${candidate.name ?? candidate.email}`}>
                      <Mail size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>}

        {!activeCandidate && <div className="border-t border-surface-100 bg-white px-6 py-4">
          <Button className="w-full" disabled={!selected.size} leftIcon={<Mail size={15} />} onClick={() => setComposerOpen(true)}>
            {selected.size ? `Email ${selected.size} selected` : "Select candidates to email"}
          </Button>
          {!!data?.candidates.length && (
            <button onClick={() => composeFor(data.candidates.map(({ id }) => id))} className="mt-3 w-full text-center text-xs font-semibold text-brand-600 hover:text-brand-700">
              Email the entire cohort
            </button>
          )}
        </div>}
      </aside>

      {composerOpen && (
        <form onSubmit={sendMessage} className="fixed bottom-0 right-0 z-[60] flex h-[min(610px,calc(100vh-32px))] w-full flex-col overflow-hidden border border-surface-200 bg-white shadow-[0_24px_90px_rgba(15,23,42,0.28)] sm:bottom-5 sm:right-5 sm:w-[520px] sm:rounded-2xl lg:right-[460px]">
          <div className="flex items-center justify-between bg-[#202124] px-5 py-3.5 text-white">
            <div>
              <p className="text-sm font-semibold">New message</p>
              <p className="mt-0.5 text-[11px] text-white/55">{data?.session.title}</p>
            </div>
            <button type="button" onClick={() => setComposerOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white" aria-label="Close email composer"><X size={16} /></button>
          </div>
          <div className="flex min-h-12 items-center gap-3 border-b border-surface-100 px-5 py-2.5">
            <span className="text-xs font-medium text-gray-400">To</span>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                {recipients.length === 1 ? (recipients[0].name ?? recipients[0].email) : `${recipients.length} session candidates`}
              </span>
            </div>
          </div>
          <input required maxLength={200} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" className="h-13 border-b border-surface-100 px-5 py-3 text-sm font-medium text-gray-800 outline-none placeholder:font-normal placeholder:text-gray-400" />
          <textarea required maxLength={10_000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write your message…" className="min-h-0 flex-1 resize-none px-5 py-4 text-sm leading-6 text-gray-700 outline-none placeholder:text-gray-400" />
          <div className="flex items-center justify-between border-t border-surface-100 px-5 py-3.5">
            <p className="text-[11px] text-gray-400">Sent individually to protect candidate privacy</p>
            <Button type="submit" loading={sending} disabled={!subject.trim() || !message.trim() || !selected.size} leftIcon={<Send size={14} />}>
              Send
            </Button>
          </div>
        </form>
      )}
    </>
  );
}

function CandidateCertificateForm({ sessionId, session, candidate, onIssued }: {
  sessionId: string;
  session: CandidateResponse["session"];
  candidate: Candidate;
  onIssued: (certificate: { id: string; type: "attendance" | "completion"; pdfUrl: string; issuedAt: string; attendanceStatus: Candidate["attendanceStatus"]; outcome: Candidate["outcome"] }) => void;
}) {
  const { success, error } = useToast();
  const endDate = new Date(session.endDatetime);
  const safeDate = endDate > new Date() ? new Date() : endDate;
  const [attendanceStatus, setAttendanceStatus] = useState(candidate.attendanceStatus && candidate.attendanceStatus !== "not_reviewed" ? candidate.attendanceStatus : "attended");
  const [outcome, setOutcome] = useState(candidate.outcome && candidate.outcome !== "pending" ? candidate.outcome : "passed");
  const [certificateType, setCertificateType] = useState<"attendance" | "completion">("completion");
  const [recipientName, setRecipientName] = useState(candidate.name ?? "");
  const [completionDate, setCompletionDate] = useState(safeDate.toISOString().slice(0, 10));
  const [issuerName, setIssuerName] = useState("");
  const [attendanceNotes, setAttendanceNotes] = useState(candidate.attendanceNotes ?? "");
  const [certificateNotes, setCertificateNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const sessionEnded = endDate <= new Date();
  const eligibleOutcome = certificateType === "completion"
    ? attendanceStatus === "attended" && outcome === "passed"
    : attendanceStatus !== "absent";
  const canIssue = sessionEnded && eligibleOutcome;

  async function issueCertificate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canIssue || candidate.certificateId) return;
    setIssuing(true);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/candidates/${candidate.id}/certificate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendanceStatus,
          outcome,
          attendanceNotes,
          certificateType,
          recipientName,
          completionDate: new Date(`${completionDate}T12:00:00`).toISOString(),
          issuerName: issuerName || null,
          certificateNotes: certificateNotes || null,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        const fieldError = json.errors && Object.values(json.errors as Record<string, string[]>)[0]?.[0];
        throw new Error(fieldError ?? json.message ?? "Certificate could not be generated");
      }
      onIssued(json.data);
      success("Certificate issued", "The PDF was generated and the candidate email was submitted for delivery.");
    } catch (reason) {
      error("Certificate not issued", reason instanceof Error ? reason.message : "Please try again");
    } finally {
      setIssuing(false);
    }
  }

  return (
    <form onSubmit={issueCertificate} className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <div className="flex items-center gap-3 rounded-2xl border border-surface-100 bg-surface-50 p-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-sm font-bold text-brand-700 shadow-sm">
            {(candidate.name ?? candidate.email).slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">{candidate.name ?? "Candidate"}</p>
            <p className="truncate text-xs text-gray-400">{candidate.email}</p>
            <p className="mt-1 text-[11px] font-medium text-brand-600">Course progress: {candidate.progress}%</p>
          </div>
        </div>

        {candidate.certificateId ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
            <CheckCircle2 className="mx-auto text-emerald-600" size={28} />
            <h3 className="mt-3 text-sm font-bold text-emerald-900">Certificate already issued</h3>
            <p className="mt-1 text-xs capitalize text-emerald-700">{candidate.certificateType} certificate</p>
            {candidate.certificateUrl && <a href={candidate.certificateUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-emerald-700 shadow-sm"><Download size={14} /> Download PDF</a>}
          </div>
        ) : <>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">Attendance review</p>
            <div className="grid grid-cols-3 gap-2">
              {(["attended", "partial", "absent"] as const).map((status) => <button key={status} type="button" onClick={() => setAttendanceStatus(status)} className={cn("rounded-xl border px-2 py-2.5 text-xs font-semibold capitalize", attendanceStatus === status ? "border-brand-300 bg-brand-50 text-brand-700" : "border-surface-200 text-gray-500")}>{status}</button>)}
            </div>
          </div>
          <div>
            <label className="form-label">Candidate outcome</label>
            <select value={outcome} onChange={(event) => setOutcome(event.target.value as "passed" | "incomplete")} className="form-input"><option value="passed">Passed</option><option value="incomplete">Incomplete</option></select>
          </div>
          <div>
            <label className="form-label">Certificate type</label>
            <select value={certificateType} onChange={(event) => setCertificateType(event.target.value as "attendance" | "completion")} className="form-input"><option value="completion">Certificate of completion</option><option value="attendance">Certificate of attendance</option></select>
            {!eligibleOutcome && <p className="mt-1.5 text-xs text-amber-700">Completion requires Attended + Passed. Attendance certificates cannot be issued when Absent.</p>}
            {!sessionEnded && <p className="mt-1.5 text-xs text-amber-700">Certificates become available after the session ends.</p>}
          </div>
          <div>
            <label className="form-label">Recipient name</label>
            <input required minLength={2} maxLength={100} value={recipientName} onChange={(event) => setRecipientName(event.target.value)} className="form-input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">Completion date</label><input required type="date" max={new Date().toISOString().slice(0, 10)} value={completionDate} onChange={(event) => setCompletionDate(event.target.value)} className="form-input" /></div>
            <div><label className="form-label">Issuer name</label><input maxLength={100} value={issuerName} onChange={(event) => setIssuerName(event.target.value)} placeholder="Optional" className="form-input" /></div>
          </div>
          <div><label className="form-label">Attendance notes</label><textarea maxLength={2000} rows={3} value={attendanceNotes} onChange={(event) => setAttendanceNotes(event.target.value)} className="form-input resize-none" placeholder="Internal review notes" /></div>
          <div><label className="form-label">Certificate note</label><textarea maxLength={2000} rows={2} value={certificateNotes} onChange={(event) => setCertificateNotes(event.target.value)} className="form-input resize-none" placeholder="Optional audit note" /></div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-surface-200 p-3 text-xs leading-5 text-gray-600">
            <input type="checkbox" required checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-brand-600" />
            <CalendarDays className="mt-0.5 shrink-0 text-brand-500" size={15} />
            <span>I confirm that this attendance and outcome record is accurate and the candidate is eligible for this certificate.</span>
          </label>
        </>}
      </div>
      {!candidate.certificateId && <div className="border-t border-surface-100 px-6 py-4"><Button type="submit" className="w-full" loading={issuing} disabled={!canIssue || !recipientName.trim() || !completionDate || !confirmed} leftIcon={<Award size={15} />}>Generate certificate</Button><p className="mt-2 text-center text-[11px] text-gray-400">This action is recorded against your account.</p></div>}
    </form>
  );
}
