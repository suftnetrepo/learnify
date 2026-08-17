import type { CourseListItem } from "@/types/course.types";
import Link from "next/link";
import Image from "next/image";
import { Star, Award } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface CourseCardProps {
  course:     CourseListItem;
  className?: string;
}

const THUMB_COLORS = [
  "bg-brand-500", "bg-sky-600", "bg-emerald-600",
  "bg-amber-600", "bg-violet-600", "bg-rose-600",
];

function hashString(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

const LEVEL_CONFIG: Record<string, { label: string; className: string }> = {
  beginner:     { label: "Beginner",     className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  intermediate: { label: "Intermediate", className: "bg-violet-50  text-violet-700  border-violet-200"  },
  advanced:     { label: "Advanced",     className: "bg-red-50     text-red-700     border-red-200"     },
};

export function CourseCard({ course, className }: CourseCardProps) {
  const rating      = Number(course.averageRating ?? 0);
  const enrollments = Number(course.enrollmentCount ?? 0);
  const gradient    = THUMB_COLORS[hashString(course.id) % THUMB_COLORS.length];
  const isBestSeller = enrollments >= 500;
  const isNew        = !rating && enrollments < 10;
  const levelCfg     = course.level ? LEVEL_CONFIG[course.level] : null;
  const isFree       = Number(course.price) === 0;

  return (
    <Link
      href={`/courses/${course.slug}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl bg-white",
        "border border-surface-150 shadow-card",
        "hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200",
        className
      )}
    >
      {/* Thumbnail */}
      <div className="relative h-44 w-full overflow-hidden flex-shrink-0 bg-surface-100">
        {course.thumbnailUrl ? (
          <Image
            src={course.thumbnailUrl}
            alt={course.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className={cn("h-full w-full flex items-center justify-center", gradient)}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
              stroke="rgba(255,255,255,0.35)" strokeWidth="1.5">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
            </svg>
          </div>
        )}

        {/* Top-left badges */}
        <div className="absolute top-3 left-3 flex gap-1.5">
          {isBestSeller && (
            <span className="flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-xs font-bold text-amber-900 shadow-sm">
              <Award size={10} /> Bestseller
            </span>
          )}
          {isNew && (
            <span className="rounded-full bg-brand-500 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
              New
            </span>
          )}
        </div>

        {/* Format badge */}
        {course.format === "in_person" && (
          <span className="absolute top-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
            In-person
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4 gap-2.5">

        {/* Category label */}
        {course.categoryName && (
          <p className="text-[11px] font-bold uppercase tracking-widest text-brand-500 leading-none">
            {course.categoryName}
          </p>
        )}

        {/* Rating row — prominent, matches mock */}
        {rating > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-gray-900">{rating.toFixed(1)}</span>
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={13}
                  className={i < Math.round(rating)
                    ? "fill-amber-400 text-amber-400"
                    : "fill-surface-200 text-surface-200"
                  }
                />
              ))}
            </div>
            {course.reviewCount != null && course.reviewCount > 0 && (
              <span className="text-xs text-gray-400">({course.reviewCount.toLocaleString()})</span>
            )}
          </div>
        )}

        {/* Title */}
        <h3 className="font-display text-[15px] font-bold text-gray-900 leading-snug line-clamp-2 group-hover:text-brand-600 transition-colors">
          {course.title}
        </h3>

        {/* Short description */}
        {course.shortDescription && (
          <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">
            {course.shortDescription}
          </p>
        )}

        {/* Level badge */}
        {levelCfg && (
          <span className={cn(
            "self-start inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
            levelCfg.className
          )}>
            {levelCfg.label}
          </span>
        )}

        {/* Footer — Join Now + Price, matches mock layout */}
        <div className="mt-auto flex items-center justify-between gap-3 pt-3 border-t border-surface-100">
          <span className={cn(
            "inline-flex h-9 items-center rounded-xl border border-gray-200 px-5 text-xs font-semibold text-gray-800",
            "group-hover:border-brand-400 group-hover:text-brand-600 group-hover:bg-brand-50 transition-all"
          )}>
            {isFree ? "Enrol free" : "Join Now"}
          </span>
          <span className="font-display text-lg font-extrabold text-gray-900">
            {isFree ? "Free" : formatCurrency(Number(course.price))}
          </span>
        </div>
      </div>
    </Link>
  );
}
