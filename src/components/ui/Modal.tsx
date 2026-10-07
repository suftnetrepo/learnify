"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

interface ModalProps {
  open:       boolean;
  onClose:    () => void;
  title?:     string;
  children:   React.ReactNode;
  size?:      "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
  "2xl": "max-w-4xl",
};

export function Modal({ open, onClose, title, children, size = "md", className }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Lock scroll
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  // Portalled to <body> so ancestor opacity/transform/stacking never affects the dialog
  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" />

      {/* Panel */}
      <div role="dialog" aria-modal="true" className={cn(
        "relative w-full rounded-2xl bg-white shadow-2xl animate-fade-up",
        sizeClasses[size],
        className
      )}>
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between border-b border-surface-100 px-6 py-4">
            <h2 className="heading-3 text-gray-900">{title}</h2>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X size={16} />
            </Button>
          </div>
        )}
        {!title && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="absolute right-4 top-4 h-8 w-8 p-0 z-10"
          >
            <X size={16} />
          </Button>
        )}

        {/* Content */}
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}

// Confirm dialog built on Modal
interface ConfirmModalProps {
  open:        boolean;
  onClose:     () => void;
  onConfirm:   () => void;
  title:       string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?:  string;
  variant?:    "danger" | "primary";
  loading?:    boolean;
  /** When set, renders a centred alert layout with this icon in a tinted badge. */
  icon?:       React.ReactNode;
}

export function ConfirmModal({
  open, onClose, onConfirm, title, description,
  confirmLabel = "Confirm", cancelLabel = "Cancel", variant = "primary", loading, icon,
}: ConfirmModalProps) {
  if (icon) {
    return (
      <Modal open={open} onClose={loading ? () => {} : onClose} size="sm">
        <div className="flex flex-col items-center pt-3 text-center">
          <div className={cn(
            "mb-4 flex h-14 w-14 items-center justify-center rounded-full ring-8",
            variant === "danger" ? "bg-red-100 text-red-600 ring-red-50" : "bg-brand-100 text-brand-600 ring-brand-50"
          )}>
            {icon}
          </div>
          <h2 className="heading-3 text-gray-900">{title}</h2>
          <div className="mt-2 text-sm text-gray-500">{description}</div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="ghost" onClick={onClose} disabled={loading} className="w-full border border-surface-200">{cancelLabel}</Button>
          <Button variant={variant} onClick={onConfirm} loading={loading} className="w-full">{confirmLabel}</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="text-sm text-gray-500">{description}</div>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose} disabled={loading}>{cancelLabel}</Button>
        <Button variant={variant} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}
