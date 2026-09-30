"use client";

import { useState } from "react";
import { EyeOff, Pencil, Star } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const MIN_PROGRESS = 25; // keep in step with REVIEW_MIN_PROGRESS in review.service
const LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

export interface OwnReview {
  id:          string;
  rating:      number;
  title:       string | null;
  body:        string | null;
  isPublished: boolean;
}

interface Props {
  courseId: string;
  progress: number;            // live course progress %, so the form unlocks without a reload
  myReview: OwnReview | null;
}

function Stars({ value, size = 18 }: { value: number; size?: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} size={size} className={s <= value ? "fill-amber-400 text-amber-400" : "fill-surface-100 text-surface-200"} />
      ))}
    </span>
  );
}

export function ReviewForm({ courseId, progress, myReview }: Props) {
  const { success, error } = useToast();
  const router = useRouter();
  const [review,  setReview]  = useState<OwnReview | null>(myReview);
  const [editing, setEditing] = useState(false);
  const [rating,  setRating]  = useState(myReview?.rating ?? 0);
  const [hovered, setHovered] = useState(0);
  const [title,   setTitle]   = useState(myReview?.title ?? "");
  const [body,    setBody]    = useState(myReview?.body ?? "");
  const [saving,  setSaving]  = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(review ? `/api/reviews/${review.id}` : `/api/courses/${courseId}/reviews`, {
        method:  review ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ rating, title: title.trim() || undefined, body: body.trim() || undefined }),
      });
      const json = await res.json();
      if (!json.success) {
        const fieldError = json.errors && Object.values(json.errors as Record<string, string[]>)[0]?.[0];
        throw new Error(fieldError ?? json.message);
      }
      setReview({
        id: json.data.id, rating: json.data.rating, title: json.data.title, body: json.data.body,
        isPublished: json.data.isPublished,
      });
      setEditing(false);
      success(review ? "Review updated" : "Review submitted", "Thank you for your feedback!");
      router.refresh();
    } catch (err) {
      error(review ? "Could not update review" : "Could not submit review", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  // ── Locked until enough of the course is done ──────────────────────────────
  if (!review && progress < MIN_PROGRESS) {
    return (
      <div className="max-w-xl rounded-2xl border border-surface-200 bg-surface-50 px-5 py-4">
        <p className="text-sm font-medium text-gray-700">Complete at least {MIN_PROGRESS}% of the course to leave a review</p>
        <div className="mt-3 h-1.5 w-full rounded-full bg-surface-200">
          <div className="h-1.5 rounded-full bg-brand-500 transition-all" style={{ width: `${Math.min(progress / MIN_PROGRESS, 1) * 100}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-gray-400">{progress}% complete · mark lessons complete as you go</p>
      </div>
    );
  }

  // ── Their review, read-only ────────────────────────────────────────────────
  if (review && !editing) {
    return (
      <div className="max-w-xl space-y-3">
        {!review.isPublished && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <EyeOff size={15} className="mt-0.5 flex-shrink-0" />
            <p>Your review has been hidden by the Edquis team and isn&apos;t shown publicly. You can still edit it.</p>
          </div>
        )}
        <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Your review</p>
              <div className="mt-2 flex items-center gap-2">
                <Stars value={review.rating} />
                <span className="text-sm font-medium text-gray-500">{LABELS[review.rating]}</span>
              </div>
            </div>
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-brand-200 hover:text-brand-600"
            >
              <Pencil size={12} /> Edit
            </button>
          </div>
          {review.title && <p className="mt-3 font-semibold text-gray-900">{review.title}</p>}
          {review.body && <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-gray-600">{review.body}</p>}
        </div>
      </div>
    );
  }

  // ── Write or edit ──────────────────────────────────────────────────────────
  return (
    <div className="max-w-xl rounded-2xl border border-surface-200 bg-white p-5 shadow-card">
      <h3 className="mb-4 font-display text-base font-semibold text-gray-900">{review ? "Edit your review" : "Leave a review"}</h3>

      <div className="mb-4 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
            className="transition-transform hover:scale-110"
          >
            <Star
              size={28}
              className={cn("transition-colors", (hovered || rating) >= star ? "fill-amber-400 text-amber-400" : "fill-surface-100 text-surface-200")}
            />
          </button>
        ))}
        {rating > 0 && <span className="ml-2 text-sm font-medium text-gray-500">{LABELS[rating]}</span>}
      </div>

      <div className="space-y-3">
        <input
          type="text" placeholder="Review headline (optional)" value={title}
          onChange={(e) => setTitle(e.target.value)} maxLength={120} className="form-input text-sm"
        />
        <textarea
          placeholder="Share your experience with this course… (optional, at least 10 characters)" value={body}
          onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={5} className="form-input resize-y text-sm"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400">{body.length}/2000</p>
          <div className="flex items-center gap-2">
            {review && (
              <button
                onClick={() => { setEditing(false); setRating(review.rating); setTitle(review.title ?? ""); setBody(review.body ?? ""); }}
                className="h-9 rounded-xl px-4 text-sm font-medium text-gray-500 hover:bg-surface-50"
              >
                Cancel
              </button>
            )}
            <button
              onClick={save}
              disabled={saving || rating === 0}
              className="flex h-9 items-center gap-2 rounded-xl bg-brand-500 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : review ? "Save changes" : "Submit review"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
