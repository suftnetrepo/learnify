"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { useMutation } from "@/hooks/useApi";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface Props {
  courseId:     string;
  existingReview?: boolean;
  progress:     number;
}

export function ReviewForm({ courseId, existingReview, progress }: Props) {
  const { success, error } = useToast();
  const router             = useRouter();
  const [rating,    setRating]    = useState(0);
  const [hovered,   setHovered]   = useState(0);
  const [title,     setTitle]     = useState("");
  const [body,      setBody]      = useState("");
  const [submitted, setSubmitted] = useState(existingReview);

  const { mutate, loading } = useMutation(
    async (data: { rating: number; title?: string; body?: string }) => {
      const res = await fetch(`/api/courses/${courseId}/reviews`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new ApiError(json.message, res.status);
      return json.data;
    },
    {
      onSuccess: () => {
        success("Review submitted", "Thank you for your feedback!");
        setSubmitted(true);
        router.refresh();
      },
      onError: (msg) => error("Could not submit review", msg),
    }
  );

  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-center">
        <p className="text-sm font-semibold text-emerald-700">✓ You&apos;ve already reviewed this course</p>
        <p className="mt-1 text-xs text-emerald-600">Your review helps other students make a better decision.</p>
      </div>
    );
  }

  if (progress < 25) {
    return (
      <div className="rounded-2xl border border-surface-200 bg-surface-50 px-5 py-4 text-center">
        <p className="text-sm font-medium text-gray-600">Complete at least 25% of the course to leave a review</p>
        <div className="mt-2 h-1.5 w-full rounded-full bg-surface-200">
          <div className="h-1.5 rounded-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-1 text-xs text-gray-400">{progress}% complete</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-card">
      <h3 className="font-display text-base font-semibold text-gray-900 mb-4">Leave a review</h3>

      {/* Star rating */}
      <div className="flex items-center gap-1 mb-4">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            className="transition-transform hover:scale-110"
          >
            <Star
              size={28}
              className={cn(
                "transition-colors",
                (hovered || rating) >= star
                  ? "fill-amber-400 text-amber-400"
                  : "fill-surface-100 text-surface-200"
              )}
            />
          </button>
        ))}
        {rating > 0 && (
          <span className="ml-2 text-sm font-medium text-gray-500">
            {["", "Poor", "Fair", "Good", "Very good", "Excellent"][rating]}
          </span>
        )}
      </div>

      <div className="space-y-3">
        <input
          type="text"
          placeholder="Review headline (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          className="form-input text-sm"
        />
        <textarea
          placeholder="Share your experience with this course…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          rows={4}
          className="form-input resize-none text-sm"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">{body.length}/2000</p>
          <button
            onClick={() => mutate({ rating, title: title || undefined, body: body || undefined })}
            disabled={loading || rating === 0}
            className={cn(
              "flex h-9 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition-colors",
              "bg-brand-500 hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            {loading ? "Submitting…" : "Submit review"}
          </button>
        </div>
      </div>
    </div>
  );
}
