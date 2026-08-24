"use client";

import { useState, useCallback } from "react";
import { UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserDrawer } from "./UserDrawer";

type UserRole   = "student" | "tutor" | "admin";
type UserStatus = "active" | "suspended" | "pending" | "invited";

interface User {
  id:        string;
  name:      string | null;
  email:     string;
  role:      UserRole;
  status:    UserStatus;
  createdAt: Date;
}

interface Props {
  users: User[];
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

const STATUS_DOTS: Record<UserStatus, string> = {
  active:    "bg-emerald-500",
  suspended: "bg-red-500",
  pending:   "bg-amber-400",
  invited:   "bg-brand-400",
};

const AVATAR_COLORS = [
  "bg-brand-500", "bg-teal-600", "bg-rose-500",
  "bg-amber-500", "bg-violet-600", "bg-sky-600",
];

function avatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initials(name: string | null, email: string) {
  if (name) return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  return email[0].toUpperCase();
}

export function UsersClient({ users }: Props) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [drawerMode,     setDrawerMode]     = useState<"view" | "create">("view");
  const [drawerOpen,     setDrawerOpen]     = useState(false);

  // Derived (not stored) — once router.refresh() brings back fresh rows
  // (triggered inside the useUsers hook on a successful save/suspend), the
  // open drawer automatically shows current data instead of a stale snapshot.
  const selectedUser = selectedUserId ? users.find((u) => u.id === selectedUserId) ?? null : null;

  const openUser = useCallback((user: User) => {
    setSelectedUserId(user.id);
    setDrawerMode("view");
    setDrawerOpen(true);
  }, []);

  const openCreate = useCallback(() => {
    setSelectedUserId(null);
    setDrawerMode("create");
    setDrawerOpen(true);
  }, []);

  const adminCount   = users.filter((u) => u.role === "admin").length;
  const tutorCount   = users.filter((u) => u.role === "tutor").length;
  const studentCount = users.filter((u) => u.role === "student").length;

  return (
    <>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-gray-900">Users</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {users.length} total · {adminCount} admin{adminCount !== 1 ? "s" : ""} · {tutorCount} tutor{tutorCount !== 1 ? "s" : ""} · {studentCount} student{studentCount !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
        >
          <UserPlus size={15} /> Invite / Create user
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-surface-100 bg-white">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-surface-100 bg-surface-50">
              <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">User</th>
              <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">Role</th>
              <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">Status</th>
              <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">Joined</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-16 text-center text-sm text-gray-400">
                  No users found.
                </td>
              </tr>
            ) : users.map((user) => (
              <tr
                key={user.id}
                onClick={() => openUser(user)}
                className={cn(
                  "border-b border-surface-50 last:border-none cursor-pointer transition-colors",
                  selectedUser?.id === user.id && drawerOpen
                    ? "bg-brand-50"
                    : "hover:bg-surface-50"
                )}
              >
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                      avatarColor(user.id)
                    )}>
                      {initials(user.name, user.email)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{user.name ?? "—"}</p>
                      <p className="text-xs text-gray-400">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize", ROLE_STYLES[user.role])}>
                    {user.role}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize", STATUS_STYLES[user.status])}>
                    <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", STATUS_DOTS[user.status])} />
                    {user.status}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-xs text-gray-400">
                  {new Date(user.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <span className="text-gray-300">›</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Drawer */}
      {drawerOpen && (
        <UserDrawer
          user={selectedUser}
          mode={drawerMode}
          onClose={() => { setDrawerOpen(false); setSelectedUserId(null); }}
          onSave={() => {}}
        />
      )}
    </>
  );
}
