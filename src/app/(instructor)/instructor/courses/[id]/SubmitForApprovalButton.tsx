"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { ConfirmModal } from "@/components/ui/Modal";

export function SubmitForApprovalButton({ courseId }: { courseId: string }) {
  const router   = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${courseId}/submit-review`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to submit");
      setConfirmOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
      setConfirmOpen(false);
      setLoading(false);
    }
  }

  return (
    <div className="mx-6 mt-4">
      {error && (
        <p className="mb-2 text-xs text-red-600">{error}</p>
      )}
      <button
        onClick={() => setConfirmOpen(true)}
        disabled={loading}
        className="flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
      >
        <Send size={14} />
        {loading ? "Submitting..." : "Submit for approval"}
      </button>
      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleSubmit}
        icon={<Send size={22} />}
        title="Submit for review?"
        description="An admin will review this course. You'll be notified by email once it's approved or rejected."
        confirmLabel="Yes, submit"
        loading={loading}
      />
    </div>
  );
}
