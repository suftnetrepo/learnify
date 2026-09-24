"use client";

import { useEffect, useId, useState } from "react";
import { X } from "lucide-react";

interface Props {
  title:      string;
  icon:       React.ReactNode;
  /** Classes for the floating trigger (position + shape); it always opens/closes the drawer. */
  triggerClassName: string;
  triggerContent:   React.ReactNode;
  triggerLabel:     string;
  /** Optional note shown under the header. */
  description?: React.ReactNode;
  /** Rendered on first open, then kept mounted so closing doesn't lose state (chat, uploads). */
  children: React.ReactNode;
}

/** Right-hand slide-over used by the StudyMind drawers (student AI tutor, tutor/admin materials). */
export function SlideOverDrawer({
  title, icon, triggerClassName, triggerContent, triggerLabel, description, children,
}: Props) {
  const [open,   setOpen]   = useState(false);
  const [opened, setOpened] = useState(false);
  const drawerId = useId();

  const toggle = () => {
    setOpen((o) => !o);
    setOpened(true);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        onClick={toggle}
        aria-expanded={open}
        aria-controls={drawerId}
        aria-label={triggerLabel}
        title={triggerLabel}
        className={triggerClassName}
      >
        {triggerContent}
      </button>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setOpen(false)} aria-hidden />
      )}

      <div
        id={drawerId}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-hidden={!open}
        className={`fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out sm:w-[480px] md:w-[520px] lg:w-[580px] ${
          open ? "translate-x-0" : "pointer-events-none translate-x-full"
        }`}
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-surface-100 px-5 py-3">
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-sm font-semibold text-gray-900">{title}</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-surface-100 hover:text-gray-700"
          >
            <X size={16} />
          </button>
        </div>

        {description && (
          <p className="flex-shrink-0 border-b border-surface-100 px-5 py-3 text-xs text-gray-500">
            {description}
          </p>
        )}

        <div className="flex min-h-0 flex-1 flex-col">{opened && children}</div>
      </div>
    </>
  );
}
