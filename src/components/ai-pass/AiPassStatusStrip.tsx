"use client";

import { useState } from "react";
import { Sparkles, ChevronDown } from "lucide-react";
import { AiTutorPassCard } from "./AiTutorPassCard";
import { FEATURE_LABELS, formatDate, type AiPassStatus } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Top of the AI tutor drawer for pass holders: today's allowances, expiry and "Extend". */
export function AiPassStatusStrip({ courseId, status }: { courseId: string; status: AiPassStatus }) {
  const [extending, setExtending] = useState(false);
  const [now] = useState(() => Date.now());   // the strip is re-mounted with fresh status
  const current = status.current;
  if (!current) return null;

  const queued   = status.queued ?? [];
  const finalEnd = queued.at(-1)?.endsAt ?? current.endsAt;
  const msLeft   = new Date(finalEnd).getTime() - now;
  const daysLeft = Math.max(0, Math.ceil(msLeft / DAY_MS));
  const endingSoon = queued.length === 0 && msLeft <= 3 * DAY_MS;
  const usage = status.usage;

  return (
    <div className="flex-shrink-0 border-b border-surface-100 bg-surface-50">
      {endingSoon && (
        <p className="bg-amber-50 px-5 py-2 text-xs text-amber-700">
          Your AI Tutor Pass ends {daysLeft <= 1 ? "within a day" : `in ${daysLeft} days`}. Extend now to keep your tutor.
        </p>
      )}
      <div className="flex items-center justify-between gap-3 px-5 py-2.5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-900">
            <Sparkles size={12} className="text-brand-500" /> AI Tutor Pass
          </p>
          <p className="text-[11px] text-gray-500">
            Active until {formatDate(finalEnd)}{queued.length > 0 && ` (${queued.length} more queued)`}
          </p>
        </div>
        {status.canPurchaseMore && (
          <button
            onClick={() => setExtending((v) => !v)}
            aria-expanded={extending}
            className="flex flex-shrink-0 items-center gap-1 rounded-lg border border-brand-200 bg-white px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
          >
            Extend <ChevronDown size={12} className={extending ? "rotate-180" : ""} />
          </button>
        )}
      </div>

      {usage ? (
        <ul className="grid grid-cols-4 gap-2 px-5 pb-3">
          {(Object.keys(FEATURE_LABELS) as (keyof typeof FEATURE_LABELS)[]).map((k) => {
            const f = usage.features[k];
            return (
              <li key={k} className="rounded-lg bg-white px-2 py-1.5 text-center shadow-sm" title={FEATURE_LABELS[k]}>
                <p className={`text-sm font-semibold ${f.remaining > 0 && !usage.budget_exhausted ? "text-gray-900" : "text-gray-500"}`}>
                  {f.remaining}<span className="text-[10px] font-normal text-gray-500">/{f.limit}</span>
                </p>
                <p className="truncate text-[10px] text-gray-500">{FEATURE_LABELS[k].split(" ").at(-1)}</p>
              </li>
            );
          })}
        </ul>
      ) : status.usageAvailable === false ? (
        <p className="px-5 pb-3 text-[11px] text-gray-500">Today&apos;s usage is unavailable right now.</p>
      ) : null}
      {usage?.budget_exhausted && (
        <p className="px-5 pb-3 text-[11px] text-amber-700">You&apos;ve reached today&apos;s fair-use limit. It resets at midnight UK time.</p>
      )}

      {extending && (
        <div className="border-t border-surface-100 bg-white">
          <AiTutorPassCard courseId={courseId} status={status} variant="extend" />
        </div>
      )}
    </div>
  );
}
