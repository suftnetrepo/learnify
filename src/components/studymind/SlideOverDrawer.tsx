"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { announceDrawerOpen, onOtherDrawerOpen } from "@/lib/drawers";

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
  const drawerId   = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();   // back to the button that opened it
  };

  const toggle = () => {
    if (open) { close(); return; }
    announceDrawerOpen(drawerId);
    setOpen(true);
    setOpened(true);
    requestAnimationFrame(() => panelRef.current?.focus());   // keyboard users land in the drawer
  };

  // Another drawer (e.g. Messages) opened — make way for it
  useEffect(() => onOtherDrawerOpen(drawerId, () => setOpen(false)), [drawerId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
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
        <div className="fixed inset-0 z-40 bg-black/20" onClick={close} aria-hidden />
      )}

      <div
        id={drawerId}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-hidden={!open}
        ref={panelRef}
        tabIndex={-1}
        // Closed: off-screen AND out of the tab order
        inert={!open}
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
            onClick={close}
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
