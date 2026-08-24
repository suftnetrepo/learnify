"use client";

import { useState } from "react";
import {
  X, Pencil, Ban, Trash2, CheckCircle2,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUsers } from "@/hooks/useUsers";

type Tab = "details" | "edit" | "activity";

type UserRole   = "student" | "tutor" | "admin";
type UserStatus = "active" | "suspended" | "pending" | "invited";

interface User {
  id:        string;
  name:      string | null;
  email:     string;
  role:      UserRole;
  status:    UserStatus;
  createdAt: Date;
  bio?:      string | null;
}

interface Props {
  user:    User | null;
  mode:    "view" | "create";
  onClose: () => void;
  onSave:  () => void;
}

const ROLE_STYLES: Record<UserRole, string> = {
  admin:   "bg-brand-50 text-brand-700",
  tutor:   "bg-emerald-50 text-emerald-700",
  student: "bg-surface-100 text-gray-500",
};

const STATUS_STYLES: Record<UserStatus, string> = {
  active:    "bg-emerald-50 text-emerald-700",
  suspended: "bg-red-50 text-red-600",
  pending:   "bg-amber-50 text-amber-700",
  invited:   "bg-brand-50 text-brand-600",
};

function initials(name: string | null, email: string) {
  if (name) return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  return email[0].toUpperCase();
}

const AVATAR_COLORS = [
  "bg-brand-500", "bg-teal-600", "bg-rose-500",
  "bg-amber-500", "bg-violet-600", "bg-sky-600",
];

function avatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function UserDrawer({ user, mode, onClose, onSave }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>(mode === "create" ? "edit" : "details");
  const [error,     setError]     = useState<string | null>(null);
  const [success,   setSuccess]   = useState<string | null>(null);

  const { createUser, updateUser, deleteUser, suspendUser, activateUser, creating, updating, deleting, error: hookError } = useUsers();
  const loading = creating || updating || deleting;

  // Edit form state
  const [name,     setName]     = useState(user?.name     ?? "");
  const [email,    setEmail]    = useState(user?.email    ?? "");
  const [role,     setRole]     = useState<UserRole>(user?.role ?? "student");
  const [status,   setStatus]   = useState<UserStatus>(user?.status ?? "active");
  const [password, setPassword] = useState("");

  const isCreate = mode === "create";

  async function handleSave() {
    setError(null);
    const res = isCreate
      ? await createUser({ name, email, role, status, password: password || undefined })
      : await updateUser(user!.id, { name, email, role, status });

    if (res) {
      setSuccess(isCreate ? "User created successfully" : "User updated successfully");
      setTimeout(() => { onSave(); setSuccess(null); }, 1000);
    } else {
      setError(hookError ?? (isCreate ? "Failed to create user" : "Failed to update user"));
    }
  }

  async function handleSuspend() {
    if (!user) return;
    const willSuspend = user.status !== "suspended";
    const label       = willSuspend ? "suspend" : "unsuspend";
    if (!confirm(`Are you sure you want to ${label} this account?`)) return;
    setError(null);
    const res = willSuspend ? await suspendUser(user.id) : await activateUser(user.id);
    if (res) onSave();
    else setError(hookError ?? "Failed to update status");
  }

  async function handleDelete() {
    if (!user) return;
    if (!confirm(`Permanently delete ${user.name ?? user.email}? This cannot be undone.`)) return;
    setError(null);
    const res = await deleteUser(user.id);
    if (res !== null) { onSave(); onClose(); }
    else setError(hookError ?? "Failed to delete user");
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-[380px] max-w-full flex-col border-l border-surface-100 bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-100 px-5 py-4 flex-shrink-0">
          <h2 className="font-display text-sm font-bold text-gray-900">
            {isCreate ? "Invite / Create user" : "User details"}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-surface-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>

          {/* Profile header — view mode only */}
          {!isCreate && user && (
            <div className="flex flex-col items-center border-b border-surface-100 px-5 py-6 text-center">
              <div className={cn(
                "flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold text-white mb-3",
                avatarColor(user.id)
              )}>
                {initials(user.name, user.email)}
              </div>
              <p className="font-semibold text-gray-900">{user.name ?? "—"}</p>
              <p className="text-xs text-gray-400 mt-0.5 mb-3">{user.email}</p>
              <div className="flex gap-2">
                <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize", ROLE_STYLES[user.role])}>
                  {user.role}
                </span>
                <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize", STATUS_STYLES[user.status])}>
                  {user.status}
                </span>
              </div>
            </div>
          )}

          {/* Tabs */}
          {!isCreate && (
            <div className="flex border-b border-surface-100 px-5">
              {(["details", "edit", "activity"] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "py-3 px-3 text-xs font-semibold capitalize border-b-2 -mb-px transition-colors",
                    activeTab === tab
                      ? "border-brand-500 text-brand-600"
                      : "border-transparent text-gray-400 hover:text-gray-700"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}

          <div className="px-5 py-5 space-y-4">
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
                <CheckCircle2 size={14} /> {success}
              </div>
            )}

            {/* DETAILS TAB */}
            {activeTab === "details" && user && (
              <div className="space-y-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Account info</p>
                {[
                  { label: "Full name",  value: user.name ?? "—" },
                  { label: "Email",      value: user.email },
                  { label: "Role",       value: user.role },
                  { label: "Status",     value: user.status },
                  { label: "Joined",     value: new Date(user.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between py-2.5 border-b border-surface-50 last:border-none">
                    <span className="text-xs text-gray-400">{label}</span>
                    <span className="text-xs font-medium text-gray-900 capitalize">{value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* EDIT TAB or CREATE mode */}
            {(activeTab === "edit" || isCreate) && (
              <div className="space-y-4">
                <div>
                  <label className="form-label">Full name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="form-input"
                    placeholder="e.g. Sarah Johnson"
                  />
                </div>
                <div>
                  <label className="form-label">Email address <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="form-input"
                    placeholder="email@example.com"
                  />
                </div>
                {isCreate && (
                  <div>
                    <label className="form-label">
                      Temporary password
                      <span className="text-gray-400 font-normal ml-1">(leave blank to auto-generate)</span>
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="form-input"
                      placeholder="Min 8 characters"
                    />
                  </div>
                )}
                <div>
                  <label className="form-label">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="form-input"
                  >
                    <option value="student">Student</option>
                    <option value="tutor">Tutor / Instructor</option>
                    <option value="admin">Admin</option>
                  </select>
                  {role === "admin" && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600">
                      <Shield size={12} />
                      Admins have full platform access including user management and payments.
                    </p>
                  )}
                </div>
                <div>
                  <label className="form-label">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as UserStatus)}
                    className="form-input"
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>
            )}

            {/* ACTIVITY TAB */}
            {activeTab === "activity" && user && (
              <div className="space-y-4">
                <div className="rounded-xl border border-surface-100 p-4 text-center">
                  <p className="text-xs text-gray-400">Activity log coming soon</p>
                  <p className="text-[11px] text-gray-300 mt-0.5">Login history and actions will appear here</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-surface-100 px-5 py-4 space-y-2">
          {(activeTab === "edit" || isCreate) && (
            <button
              onClick={handleSave}
              disabled={loading || !email}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              {loading ? "Saving..." : isCreate ? "Create user" : "Save changes"}
            </button>
          )}

          {!isCreate && user && activeTab === "details" && (
            <>
              <button
                onClick={() => setActiveTab("edit")}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-surface-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-surface-50 transition-colors"
              >
                <Pencil size={14} /> Edit user
              </button>
              <button
                onClick={handleSuspend}
                disabled={loading}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-50",
                  user.status === "suspended"
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                )}
              >
                <Ban size={14} />
                {user.status === "suspended" ? "Unsuspend account" : "Suspend account"}
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
              >
                <Trash2 size={14} /> Delete user
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
