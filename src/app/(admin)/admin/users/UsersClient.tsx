"use client";

import { useState, useCallback, useRef, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { UserPlus, Search } from "lucide-react";
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
  users:       User[];
  total:       number;
  currentPage: number;
  pageSize:    number;
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

export function UsersClient({ users, total, currentPage, pageSize }: Props) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [drawerMode,     setDrawerMode]     = useState<"view" | "create">("view");
  const [drawerOpen,     setDrawerOpen]     = useState(false);
  const [searchInput,    setSearchInput]    = useState(searchParams.get("q") ?? "");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived (not stored) — once router.refresh() brings back fresh rows
  // (triggered inside the useUsers hook on a successful save/suspend), the
  // open drawer automatically shows current data instead of a stale snapshot.
  const selectedUser = selectedUserId ? users.find((u) => u.id === selectedUserId) ?? null : null;

  const updateParam = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    // Reset to page 1 whenever a filter changes — but not when the caller
    // IS the pagination control itself (that would make Next/prev/page
    // numbers unable to ever navigate anywhere but page 1).
    if (key !== "page") params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }, [searchParams, pathname, router]);

  // Debounced search — updating the URL (and triggering a server refetch) on
  // every keystroke would hammer the DB; wait for a pause in typing instead.
  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => updateParam("q", value), 350);
  }

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

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
    .reduce<(number | "...")[]>((acc, p, i, arr) => {
      if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
      acc.push(p);
      return acc;
    }, []);

  return (
    <>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-gray-900">Users</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {total} total user{total !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
        >
          <UserPlus size={15} /> Invite / Create user
        </button>
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full rounded-xl border border-surface-200 bg-white pl-9 pr-4 py-2 text-sm placeholder:text-gray-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition-all"
          />
        </div>

        <select
          defaultValue={searchParams.get("role") ?? ""}
          onChange={(e) => updateParam("role", e.target.value)}
          className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-gray-600 focus:border-brand-400 outline-none"
        >
          <option value="">All roles</option>
          <option value="admin">Admin</option>
          <option value="tutor">Tutor</option>
          <option value="student">Student</option>
        </select>

        <select
          defaultValue={searchParams.get("status") ?? ""}
          onChange={(e) => updateParam("status", e.target.value)}
          className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-gray-600 focus:border-brand-400 outline-none"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="pending">Pending</option>
          <option value="invited">Invited</option>
        </select>
      </div>

      {/* Table */}
      <div className={cn(
        "overflow-x-auto rounded-2xl border border-surface-100 bg-white transition-opacity",
        isPending && "opacity-60"
      )}>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-gray-400">
            Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, total)} of {total} users
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => updateParam("page", String(currentPage - 1))}
              disabled={currentPage <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-200 text-sm text-gray-500 hover:bg-surface-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ‹
            </button>
            {pageNumbers.map((p, i) =>
              p === "..." ? (
                <span key={`ellipsis-${i}`} className="px-1 text-xs text-gray-400">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => updateParam("page", String(p))}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition-colors",
                    p === currentPage
                      ? "bg-brand-500 text-white"
                      : "border border-surface-200 text-gray-500 hover:bg-surface-50"
                  )}
                >
                  {p}
                </button>
              )
            )}
            <button
              onClick={() => updateParam("page", String(currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-200 text-sm text-gray-500 hover:bg-surface-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ›
            </button>
          </div>
        </div>
      )}

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
