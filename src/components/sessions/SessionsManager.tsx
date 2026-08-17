"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import {
  Plus, Calendar, Clock, Users, MapPin, Video,
  ChevronDown, ChevronUp, Trash2, Edit2, X, Check,
  AlertCircle, CheckCircle2, Ban,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn, formatDate } from "@/lib/utils";

interface Session {
  id:                 string;
  title:              string;
  description:        string | null;
  startDatetime:      string;
  endDatetime:        string;
  capacity:           number;
  enrolledCount:      number;
  seatsRemaining:     number;
  isFull:             boolean;
  status:             "scheduled" | "cancelled" | "completed";
  venueAddress:       string | null;
  venueCity:          string | null;
  venuePostcode:      string | null;
  venueMapUrl:        string | null;
  conferencePlatform: string | null;
  conferenceUrl:      string | null;
  conferencePassword: string | null;
}

interface Props {
  courseId: string;
  format:   "online" | "in_person" | "hybrid";
  sessions: Session[];
}

const PLATFORM_LABELS: Record<string, string> = {
  zoom: "Zoom", teams: "Microsoft Teams", google_meet: "Google Meet",
  webex: "Cisco Webex", other: "Other",
};

function SessionCard({ s, courseId, onRefresh }: {
  s: Session; courseId: string; onRefresh: () => void;
}) {
  const { success, error } = useToast();
  const [expanded,  setExpanded]  = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const start = new Date(s.startDatetime);
  const end   = new Date(s.endDatetime);
  const pct   = s.capacity > 0 ? Math.round((s.enrolledCount / s.capacity) * 100) : 0;

  async function handleDelete() {
    if (!confirm("Delete this session? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res  = await fetch(`/api/sessions/${s.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      success("Session deleted");
      onRefresh();
    } catch (err) {
      error("Delete failed", err instanceof Error ? err.message : "Please try again");
    } finally {
      setDeleting(false);
    }
  }

  async function handleCancel() {
    if (!confirm("Cancel this session? Enrolled students will keep access.")) return;
    setCancelling(true);
    try {
      const res  = await fetch(`/api/sessions/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: "cancelled" }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      success("Session cancelled");
      onRefresh();
    } catch (err) {
      error("Cancel failed", err instanceof Error ? err.message : "Please try again");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className={cn(
      "rounded-2xl border bg-white transition-all",
      s.status === "cancelled" && "opacity-60",
      s.status === "scheduled" ? "border-surface-200 shadow-card" : "border-surface-100"
    )}>
      {/* Header row */}
      <div className="flex items-center gap-4 p-4">
        {/* Date column */}
        <div className="flex-shrink-0 w-14 text-center rounded-xl bg-brand-50 py-2">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-wider">
            {start.toLocaleDateString("en-GB", { month: "short" })}
          </p>
          <p className="text-2xl font-bold text-brand-700 leading-tight">
            {start.getDate()}
          </p>
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 truncate">{s.title}</p>
            <span className={cn(
              "flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
              s.status === "scheduled"  && "bg-emerald-100 text-emerald-700",
              s.status === "cancelled"  && "bg-red-100 text-red-700",
              s.status === "completed"  && "bg-gray-100 text-gray-600",
            )}>
              {s.status}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-gray-400 flex-wrap">
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} –{" "}
              {end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </span>
            {s.venueCity && (
              <span className="flex items-center gap-1"><MapPin size={11} />{s.venueCity}</span>
            )}
            {s.conferencePlatform && (
              <span className="flex items-center gap-1">
                <Video size={11} />{PLATFORM_LABELS[s.conferencePlatform] ?? s.conferencePlatform}
              </span>
            )}
          </div>

          {/* Capacity bar */}
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">
                {s.enrolledCount} / {s.capacity} enrolled
              </span>
              <span className={cn("text-xs font-medium", s.isFull ? "text-red-500" : "text-emerald-600")}>
                {s.isFull ? "Full" : `${s.seatsRemaining} seats left`}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-surface-100">
              <div
                className={cn("h-1.5 rounded-full transition-all", pct >= 90 ? "bg-red-400" : pct >= 60 ? "bg-amber-400" : "bg-emerald-500")}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {s.status === "scheduled" && (
            <button onClick={handleCancel} disabled={cancelling}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
              title="Cancel session">
              <Ban size={14} />
            </button>
          )}
          {s.enrolledCount === 0 && s.status !== "completed" && (
            <button onClick={handleDelete} disabled={deleting}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
              title="Delete session">
              <Trash2 size={14} />
            </button>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-surface-100 transition-colors"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-surface-100 px-4 pb-4 pt-3 space-y-3">
          {s.description && (
            <p className="text-sm text-gray-600">{s.description}</p>
          )}
          {/* Venue */}
          {(s.venueAddress || s.venueCity) && (
            <div className="rounded-xl bg-surface-50 p-3 space-y-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Venue</p>
              {s.venueAddress  && <p className="text-sm text-gray-700">{s.venueAddress}</p>}
              {s.venueCity     && <p className="text-sm text-gray-500">{s.venueCity}{s.venuePostcode ? `, ${s.venuePostcode}` : ""}</p>}
              {s.venueMapUrl   && <a href={s.venueMapUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline">View on map →</a>}
            </div>
          )}
          {/* Conference */}
          {s.conferenceUrl && (
            <div className="rounded-xl bg-surface-50 p-3 space-y-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Conference</p>
              <p className="text-sm text-gray-700">{PLATFORM_LABELS[s.conferencePlatform ?? ""] ?? "Video call"}</p>
              <a href={s.conferenceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline break-all">{s.conferenceUrl}</a>
              {s.conferencePassword && <p className="text-xs text-gray-500">Password: <span className="font-mono">{s.conferencePassword}</span></p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SessionFormModal({
  courseId, format, onClose, onSaved,
}: {
  courseId: string; format: string; onClose: () => void; onSaved: () => void;
}) {
  const { success, error } = useToast();
  const [saving,   setSaving]   = useState(false);
  const [platform, setPlatform] = useState("zoom");
  const isVenue = format === "in_person" || format === "hybrid";
  const isLive  = format === "online"    || format === "hybrid";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);

    const body: Record<string, unknown> = {
      title:         fd.get("title"),
      description:   fd.get("description") || undefined,
      startDatetime: new Date(fd.get("startDatetime") as string).toISOString(),
      endDatetime:   new Date(fd.get("endDatetime")   as string).toISOString(),
      capacity:      Number(fd.get("capacity")),
    };

    if (isVenue) {
      body.venueAddress  = fd.get("venueAddress")  || undefined;
      body.venueCity     = fd.get("venueCity")     || undefined;
      body.venuePostcode = fd.get("venuePostcode") || undefined;
      body.venueMapUrl   = fd.get("venueMapUrl")   || undefined;
    }
    if (isLive) {
      body.conferencePlatform = platform;
      body.conferenceUrl      = fd.get("conferenceUrl")      || undefined;
      body.conferencePassword = fd.get("conferencePassword") || undefined;
    }

    try {
      const res  = await fetch(`/api/courses/${courseId}/sessions`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      success("Session created");
      onSaved();
      onClose();
    } catch (err) {
      error("Failed to create session", err instanceof Error ? err.message : "Please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-surface-100 px-6 py-4">
          <h2 className="font-display text-lg font-bold text-gray-900">Add Session</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-surface-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[75vh]">
          <div className="p-6 space-y-4">
            {/* Title */}
            <div>
              <label className="form-label">Session Title *</label>
              <input name="title" required className="form-input" placeholder="e.g. Morning Cohort — Batch 1" />
            </div>

            {/* Description */}
            <div>
              <label className="form-label">Description <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea name="description" rows={2} className="form-input resize-none" placeholder="Any specific info for this session…" />
            </div>

            {/* Date/time row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Start date & time *</label>
                <input name="startDatetime" type="datetime-local" required className="form-input" />
              </div>
              <div>
                <label className="form-label">End date & time *</label>
                <input name="endDatetime" type="datetime-local" required className="form-input" />
              </div>
            </div>

            {/* Capacity */}
            <div>
              <label className="form-label">Max seats *</label>
              <input name="capacity" type="number" min="1" max="10000" defaultValue={20} required className="form-input" />
            </div>

            {/* Venue details */}
            {isVenue && (
              <div className="rounded-xl border border-surface-200 p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5"><MapPin size={11} />Venue Details</p>
                <input name="venueAddress"  className="form-input" placeholder="Street address" />
                <div className="grid grid-cols-2 gap-3">
                  <input name="venueCity"     className="form-input" placeholder="City" />
                  <input name="venuePostcode" className="form-input" placeholder="Postcode" />
                </div>
                <input name="venueMapUrl" type="url" className="form-input" placeholder="Google Maps URL (optional)" />
              </div>
            )}

            {/* Conference details */}
            {isLive && (
              <div className="rounded-xl border border-surface-200 p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5"><Video size={11} />Conference Details</p>
                <div>
                  <label className="form-label">Platform</label>
                  <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="form-input">
                    <option value="zoom">Zoom</option>
                    <option value="teams">Microsoft Teams</option>
                    <option value="google_meet">Google Meet</option>
                    <option value="webex">Cisco Webex</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <input name="conferenceUrl" type="url" className="form-input" placeholder="Join link (only visible to enrolled students)" />
                <input name="conferencePassword" className="form-input" placeholder="Meeting password (optional)" />
              </div>
            )}
          </div>

          <div className="border-t border-surface-100 flex items-center justify-end gap-3 px-6 py-4">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={saving} leftIcon={<Check size={15} />}>
              Create Session
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function SessionsManager({ courseId, format, sessions: initial }: Props) {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>(initial);
  const [showForm, setShowForm] = useState(false);

  async function refresh() {
    const res  = await fetch(`/api/courses/${courseId}/sessions`);
    const json = await res.json();
    if (json.success) setSessions(json.data);
    router.refresh();
  }

  const scheduled = sessions.filter((s) => s.status === "scheduled");
  const past      = sessions.filter((s) => s.status !== "scheduled");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-base font-bold text-gray-900">Sessions</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {scheduled.length} upcoming · {sessions.reduce((a, s) => a + s.enrolledCount, 0)} total enrolled
          </p>
        </div>
        <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setShowForm(true)}>
          Add Session
        </Button>
      </div>

      {/* Upcoming sessions */}
      {scheduled.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-surface-200 py-10 text-center">
          <Calendar size={28} className="mb-3 text-gray-200" />
          <p className="text-sm font-medium text-gray-500">No upcoming sessions</p>
          <p className="mt-1 text-xs text-gray-400">Add your first session so students can book a date.</p>
          <button onClick={() => setShowForm(true)} className="mt-4 text-sm font-semibold text-brand-600 hover:underline">
            + Add session
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {scheduled.map((s) => (
            <SessionCard key={s.id} s={s} courseId={courseId} onRefresh={refresh} />
          ))}
        </div>
      )}

      {/* Past / cancelled sessions */}
      {past.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Past & Cancelled</p>
          <div className="space-y-3">
            {past.map((s) => (
              <SessionCard key={s.id} s={s} courseId={courseId} onRefresh={refresh} />
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <SessionFormModal
          courseId={courseId}
          format={format}
          onClose={() => setShowForm(false)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
