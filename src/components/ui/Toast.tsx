"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id:       string;
  type:     ToastType;
  title:    string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (options: Omit<Toast, "id">) => void;
  success: (title: string, message?: string) => void;
  error:   (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info:    (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={18} className="text-emerald-500" />,
  error:   <XCircle     size={18} className="text-red-500"     />,
  warning: <AlertCircle size={18} className="text-amber-500"   />,
  info:    <Info        size={18} className="text-brand-500"   />,
};

const borders: Record<ToastType, string> = {
  success: "border-l-emerald-400",
  error:   "border-l-red-400",
  warning: "border-l-amber-400",
  info:    "border-l-brand-400",
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    timerRef.current = setTimeout(() => onRemove(toast.id), toast.duration ?? 4000);
    return () => clearTimeout(timerRef.current as ReturnType<typeof setTimeout>);
  }, [toast.id, toast.duration, onRemove]);

  return (
    <div className={cn(
      "flex w-80 items-start gap-3 rounded-xl border border-surface-100 bg-white p-4",
      "shadow-card border-l-4 animate-fade-up",
      borders[toast.type]
    )}>
      <div className="mt-0.5 flex-shrink-0">{icons[toast.type]}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900">{toast.title}</p>
        {toast.message && <p className="mt-0.5 text-xs text-gray-500">{toast.message}</p>}
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="ml-1 flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback((options: Omit<Toast, "id">) => {
    setToasts((prev) => [
      ...prev,
      { ...options, id: Math.random().toString(36).slice(2) },
    ]);
  }, []);

  const ctx: ToastContextValue = {
    toast:   add,
    success: (title, message) => add({ type: "success", title, message }),
    error:   (title, message) => add({ type: "error",   title, message }),
    warning: (title, message) => add({ type: "warning", title, message }),
    info:    (title, message) => add({ type: "info",    title, message }),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
