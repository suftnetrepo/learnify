"use client";

import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, CheckCircle, Ban, Trash2 } from "lucide-react";
import { ConfirmModal } from "@/components/ui/Modal";
import { useUsers } from "@/hooks/useUsers";

interface Props {
  userId:        string;
  currentStatus: string;
  currentRole:   string;
}

export function UserActionsMenu({ userId, currentStatus, currentRole }: Props) {
  const [open,    setOpen]    = useState(false);
  const [confirm, setConfirm] = useState<"suspend" | "activate" | "delete" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { activateUser, suspendUser, deleteUser, updating, deleting } = useUsers();
  const loading = updating || deleting;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close menu on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  async function handleConfirm() {
    if (!confirm) return;
    if (confirm === "activate") await activateUser(userId);
    if (confirm === "suspend")  await suspendUser(userId);
    if (confirm === "delete")   await deleteUser(userId);
    setConfirm(null);
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        aria-label="User actions"
        aria-haspopup="true"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-surface-100 hover:text-gray-600 transition-colors"
      >
        <MoreHorizontal size={16} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-surface-100 bg-white py-1.5 shadow-card-hover"
        >
          {currentStatus !== "active" && (
            <button
              role="menuitem"
              onClick={() => { setOpen(false); setConfirm("activate"); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50 transition-colors"
            >
              <CheckCircle size={14} /> Activate
            </button>
          )}
          {currentStatus !== "suspended" && (
            <button
              role="menuitem"
              onClick={() => { setOpen(false); setConfirm("suspend"); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-amber-600 hover:bg-amber-50 transition-colors"
            >
              <Ban size={14} /> Suspend
            </button>
          )}
          <hr className="my-1 border-surface-100" />
          <button
            role="menuitem"
            onClick={() => { setOpen(false); setConfirm("delete"); }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} /> Remove
          </button>
        </div>
      )}

      <ConfirmModal
        open={confirm === "suspend"}
        onClose={() => setConfirm(null)}
        onConfirm={handleConfirm}
        title="Suspend User"
        description="This user will lose access immediately. You can reactivate them at any time."
        confirmLabel="Suspend"
        variant="danger"
        loading={loading}
      />
      <ConfirmModal
        open={confirm === "activate"}
        onClose={() => setConfirm(null)}
        onConfirm={handleConfirm}
        title="Activate User"
        description="This user will regain access to their account."
        confirmLabel="Activate"
        loading={loading}
      />
      <ConfirmModal
        open={confirm === "delete"}
        onClose={() => setConfirm(null)}
        onConfirm={handleConfirm}
        title="Remove User"
        description="This will permanently remove the user. This cannot be undone."
        confirmLabel="Remove"
        variant="danger"
        loading={loading}
      />
    </div>
  );
}
