"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";

interface Props {
  courseId:    string;
  courseTitle: string;
}

export function ReviewActions({ courseId, courseTitle }: Props) {
  const router   = useRouter();
  const [loading,      setLoading]      = useState(false);
  const [showReject,   setShowReject]   = useState(false);
  const [rejectionNote, setRejectionNote] = useState("");
  const [error,        setError]        = useState<string | null>(null);

  async function handleApprove() {
    if (!confirm(`Approve and publish "${courseTitle}"?`)) return;
    setLoading(true);
    const res = await fetch(`/api/courses/${courseId}/approve`, { method: "POST" });
    if (res.ok) {
      router.refresh();
    } else {
      const json = await res.json();
      setError(json.message ?? "Failed to approve");
      setLoading(false);
    }
  }

  async function handleReject() {
    if (rejectionNote.trim().length < 10) {
      setError("Please provide a reason of at least 10 characters");
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/courses/${courseId}/reject`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ note: rejectionNote }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      const json = await res.json();
      setError(json.message ?? "Failed to reject");
      setLoading(false);
    }
  }

  if (showReject) {
    return (
      <div className="flex flex-col gap-2 w-72">
        {error && <p className="text-xs text-red-600">{error}</p>}
        <textarea
          value={rejectionNote}
          onChange={(e) => { setRejectionNote(e.target.value); setError(null); }}
          placeholder="Explain what needs to be changed..."
          rows={3}
          className="form-input resize-none text-sm"
        />
        <div className="flex gap-2">
          <button
            onClick={handleReject}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-500 px-3 py-2 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
          >
            <XCircle size={13} /> Send feedback
          </button>
          <button
            onClick={() => { setShowReject(false); setError(null); }}
            className="rounded-xl border border-surface-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-surface-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {error && <p className="text-xs text-red-600 mr-1">{error}</p>}
      <button
        onClick={() => setShowReject(true)}
        className="flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
      >
        <XCircle size={13} /> Reject
      </button>
      <button
        onClick={handleApprove}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
      >
        <CheckCircle2 size={13} /> {loading ? "Approving..." : "Approve"}
      </button>
    </div>
  );
}
