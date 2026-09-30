"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  id:           string;
  value:        string[];
  onChange:     (tags: string[]) => void;
  max:          number;
  suggestions?: string[];
  placeholder?: string;
  error?:       string;
}

/** Type and press Enter or comma to add; Backspace on an empty input removes the last tag. */
export function TagInput({ id, value, onChange, max, suggestions = [], placeholder, error }: Props) {
  const [draft, setDraft] = useState("");
  const full = value.length >= max;
  const has  = (tag: string) => value.some((t) => t.toLowerCase() === tag.toLowerCase());

  function add(raw: string) {
    const tag = raw.trim().replace(/,+$/, "").trim().slice(0, 40);
    if (!tag || full || has(tag)) return;
    onChange([...value, tag]);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
      setDraft("");
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  const openSuggestions = suggestions.filter(
    (s) => !has(s) && (!draft || s.toLowerCase().includes(draft.trim().toLowerCase()))
  );

  return (
    <div>
      <div
        className={cn(
          "flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border bg-white px-2.5 py-2 transition focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100",
          error ? "border-red-400" : "border-surface-200"
        )}
      >
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-lg bg-brand-50 py-1 pl-2.5 pr-1 text-xs font-semibold text-brand-700">
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="rounded p-0.5 text-brand-400 hover:bg-brand-100 hover:text-brand-700"
              aria-label={`Remove ${tag}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => { add(draft); setDraft(""); }}
          disabled={full}
          placeholder={full ? `Maximum of ${max} reached` : placeholder}
          className="min-w-[8rem] flex-1 bg-transparent px-1 text-sm text-gray-900 outline-none placeholder:text-gray-400 disabled:cursor-not-allowed"
        />
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2">
        {error ? <p className="text-xs text-red-500">{error}</p> : <p className="text-xs text-gray-400">Press Enter or comma to add.</p>}
        <p className="flex-shrink-0 text-xs text-gray-400">{value.length}/{max}</p>
      </div>

      {!full && openSuggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {openSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="inline-flex items-center gap-1 rounded-lg border border-dashed border-surface-300 px-2 py-1 text-xs text-gray-500 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
            >
              <Plus size={11} /> {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
