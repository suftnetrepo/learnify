"use client";

import { useState } from "react";
import { CheckCircle2, Lock, PlayCircle, ChevronDown, Star } from "lucide-react";
import { PreviewModal } from "./PreviewModal";
import { formatDuration } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Lecture {
  id: string; title: string; videoDuration: number | null;
  isFree: boolean; sectionId: string; videoUrl: string | null;
}
interface Section { id: string; title: string; lectures: Lecture[] }
interface Review  { id: string; rating: number; title: string | null; body: string | null; studentName: string | null; createdAt: Date }
interface Assignment { tutorName: string | null; tutorBio: string | null }

interface Props {
  course: {
    id: string; title: string; description: string | null;
    totalLectures: number | null; totalDuration: number | null;
    level: string | null;
  };
  sectionsWithLectures: Section[];
  requirements: string[];
  assignment: Assignment | null;
  reviews: Review[];
  rating: number;
}

const TABS = ["About", "Curriculum", "Reviews"] as const;
type Tab = typeof TABS[number];

export function CourseDetailTabs({
  course, sectionsWithLectures, requirements, assignment, reviews, rating,
}: Props) {
  const [activeTab,  setActiveTab]  = useState<Tab>("About");
  const [openSects,  setOpenSects]  = useState<Set<string>>(
    new Set(sectionsWithLectures.slice(0, 2).map((s) => s.id))
  );
  const [showAll,    setShowAll]    = useState(false);

  const totalLectures = sectionsWithLectures.reduce((a, s) => a + s.lectures.length, 0);
  const totalMins     = sectionsWithLectures.reduce(
    (a, s) => a + s.lectures.reduce((b, l) => b + (l.videoDuration ?? 0), 0), 0
  );

  function toggleSection(id: string) {
    setOpenSects((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const displayedReviews = showAll ? reviews : reviews.slice(0, 4);

  return (
    <div>
      {/* Tab bar */}
      <div className="border-b border-surface-200 mb-8">
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                activeTab === tab
                  ? "border-brand-500 text-brand-600"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              )}
            >
              {tab}
              {tab === "Reviews" && reviews.length > 0 && (
                <span className="ml-1.5 text-xs text-gray-400">({reviews.length})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── ABOUT ────────────────────────────────────────────────────── */}
      {activeTab === "About" && (
        <div className="space-y-8">
          {/* Requirements */}
          {requirements.length > 0 && (
            <div>
              <h3 className="font-display text-lg font-bold text-gray-900 mb-3">Requirements</h3>
              <ul className="space-y-2">
                {requirements.map((r, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
                    <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gray-400" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Description */}
          {course.description && (
            <div>
              <h3 className="font-display text-lg font-bold text-gray-900 mb-3">About this course</h3>
              <div className="relative">
                <p className={cn(
                  "text-sm text-gray-600 leading-relaxed whitespace-pre-line",
                  !showAll && "line-clamp-6"
                )}>
                  {course.description}
                </p>
                {!showAll && course.description.length > 400 && (
                  <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent" />
                )}
              </div>
              {course.description.length > 400 && (
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="mt-2 text-sm font-semibold text-brand-600 hover:underline"
                >
                  {showAll ? "Show less" : "Read more"}
                </button>
              )}
            </div>
          )}

          {/* Instructor bio */}
          {assignment?.tutorName && (
            <div>
              <h3 className="font-display text-lg font-bold text-gray-900 mb-3">Your instructor</h3>
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-2xl font-bold text-white">
                  {assignment.tutorName[0]}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{assignment.tutorName}</p>
                  {assignment.tutorBio && (
                    <p className="mt-2 text-sm text-gray-500 leading-relaxed">{assignment.tutorBio}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CURRICULUM ───────────────────────────────────────────────── */}
      {activeTab === "Curriculum" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">
              {sectionsWithLectures.length} sections · {totalLectures} lectures ·{" "}
              {formatDuration(Math.round(totalMins / 60))} total length
            </p>
            <button
              onClick={() => {
                const allOpen = sectionsWithLectures.every((s) => openSects.has(s.id));
                setOpenSects(allOpen ? new Set() : new Set(sectionsWithLectures.map((s) => s.id)));
              }}
              className="text-xs font-semibold text-brand-600 hover:underline"
            >
              {sectionsWithLectures.every((s) => openSects.has(s.id)) ? "Collapse all" : "Expand all"}
            </button>
          </div>

          <div className="divide-y divide-surface-100 rounded-2xl border border-surface-200 overflow-hidden">
            {sectionsWithLectures.map((section) => {
              const isOpen   = openSects.has(section.id);
              const secMins  = section.lectures.reduce((a, l) => a + (l.videoDuration ?? 0), 0);
              return (
                <div key={section.id}>
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="flex w-full items-center gap-3 bg-surface-50 px-5 py-4 text-left hover:bg-surface-100 transition-colors"
                  >
                    <ChevronDown size={16}
                      className={cn("text-gray-400 flex-shrink-0 transition-transform", isOpen && "rotate-180")} />
                    <span className="flex-1 font-semibold text-sm text-gray-900">{section.title}</span>
                    <span className="flex-shrink-0 text-xs text-gray-400">
                      {section.lectures.length} lectures{secMins > 0 ? ` · ${formatDuration(Math.round(secMins / 60))}` : ""}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="divide-y divide-surface-50">
                      {section.lectures.map((lecture) => (
                        <div key={lecture.id} className="flex items-center gap-3 px-5 py-3">
                          {lecture.isFree
                            ? <PlayCircle size={15} className="flex-shrink-0 text-brand-500" />
                            : <Lock       size={15} className="flex-shrink-0 text-gray-300" />
                          }
                          <span className="flex-1 text-sm text-gray-600">{lecture.title}</span>
                          {lecture.isFree && lecture.videoUrl && (
                            <PreviewModal lectureTitle={lecture.title} videoUrl={lecture.videoUrl} />
                          )}
                          {lecture.isFree && !lecture.videoUrl && (
                            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">Preview</span>
                          )}
                          {lecture.videoDuration && (
                            <span className="text-xs text-gray-400 flex-shrink-0">
                              {formatDuration(Math.round(lecture.videoDuration / 60))}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── REVIEWS ──────────────────────────────────────────────────── */}
      {activeTab === "Reviews" && (
        <div>
          {reviews.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-surface-200 py-14 text-center">
              <Star size={32} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-medium text-gray-500">No reviews yet</p>
              <p className="text-xs text-gray-400 mt-1">Be the first to review this course</p>
            </div>
          ) : (
            <div>
              {/* Rating summary */}
              {rating > 0 && (
                <div className="mb-8 flex items-center gap-6 rounded-2xl bg-surface-50 border border-surface-200 p-6">
                  <div className="text-center">
                    <p className="font-display text-5xl font-extrabold text-gray-900">{rating.toFixed(1)}</p>
                    <div className="mt-1 flex justify-center">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={16}
                          className={i < Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-gray-200"} />
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-gray-400">Course rating</p>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const cnt = reviews.filter((r) => r.rating === star).length;
                      const pct = reviews.length > 0 ? (cnt / reviews.length) * 100 : 0;
                      return (
                        <div key={star} className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-surface-200">
                            <div className="h-2 rounded-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex flex-shrink-0 w-16">
                            {Array.from({ length: star }).map((_, i) => (
                              <Star key={i} size={11} className="fill-amber-400 text-amber-400" />
                            ))}
                          </div>
                          <span className="text-xs text-gray-400 w-8 text-right">{cnt}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Review cards */}
              <div className="space-y-4">
                {displayedReviews.map((review) => (
                  <div key={review.id} className="border-b border-surface-100 pb-5 last:border-0">
                    <div className="flex items-center gap-3 mb-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                        {review.studentName?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{review.studentName}</p>
                        <div className="flex mt-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} size={12}
                              className={i < review.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"} />
                          ))}
                        </div>
                      </div>
                    </div>
                    {review.title && <p className="font-medium text-sm text-gray-800 mb-1">{review.title}</p>}
                    {review.body  && <p className="text-sm text-gray-600 leading-relaxed">{review.body}</p>}
                  </div>
                ))}
              </div>

              {reviews.length > 4 && (
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="mt-5 text-sm font-semibold text-brand-600 hover:underline"
                >
                  {showAll ? `Show less` : `Show all ${reviews.length} reviews`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
