import { Metadata } from "next";
import { UserService } from "@/services";
import { Topbar } from "@/components/layout/Topbar";
import { formatDate } from "@/lib/utils";
import { UserStatusBadge, Badge } from "@/components/ui/Badge";
import { UserActionsMenu } from "./UserActionsMenu";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Users } from "lucide-react";

export const metadata: Metadata = { title: "Manage Users" };

interface PageProps {
  searchParams: Promise<{ page?: string; role?: string; status?: string; search?: string }>;
}

const PER_PAGE = 20;

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page   = Math.max(1, Number(params.page ?? 1));
  const role   = params.role   ?? "";
  const status = params.status ?? "";
  const search = params.search ?? "";

  const { users: rows, pagination } = await UserService.list({
    page,
    limit:  PER_PAGE,
    role:   role   as "student" | "tutor" | "admin" | undefined,
    status: status as "active" | "pending" | "suspended" | undefined,
    search: search || undefined,
  });
  const total = pagination.total;

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div>
      <Topbar breadcrumbs={[{ label: "Admin" }, { label: "Users" }]} />
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="heading-1 text-gray-900">Users</h1>
            <p className="mt-1 text-sm text-gray-500">{total} total accounts</p>
          </div>
        </div>

        {/* Quick filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {["", "student", "tutor", "admin"].map((r) => (
            <Link
              key={r}
              href={`/admin/users?role=${r}`}
              className={`badge cursor-pointer transition-colors ${
                role === r
                  ? "bg-brand-500 text-white"
                  : "bg-surface-100 text-gray-600 hover:bg-surface-200"
              }`}
            >
              {r === "" ? "All" : r.charAt(0).toUpperCase() + r.slice(1)}
            </Link>
          ))}
        </div>

        <div className="table-container">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr>
                <th className="table-header">User</th>
                <th className="table-header hidden sm:table-cell">Role</th>
                <th className="table-header">Status</th>
                <th className="table-header">Joined</th>
                <th className="table-header hidden lg:table-cell">Last Login</th>
                <th className="table-header w-16"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-sm text-gray-400">
                    No users found.
                  </td>
                </tr>
              ) : rows.map((user) => (
                <tr key={user.id} className="table-row">
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 text-xs font-bold">
                        {user.name?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{user.name ?? "Unnamed"}</p>
                        <p className="text-xs text-gray-400 truncate">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">
                    <Badge
                      variant={user.role === "admin" ? "brand" : user.role === "tutor" ? "accent" : "neutral"}
                    >
                      {user.role}
                    </Badge>
                  </td>
                  <td className="table-cell">
                    <UserStatusBadge status={user.status} />
                  </td>
                  <td className="table-cell text-gray-400">{formatDate(user.createdAt)}</td>
                  <td className="table-cell text-gray-400">
                    {user.lastLoginAt ? formatDate(user.lastLoginAt) : "Never"}
                  </td>
                  <td className="table-cell">
                    <UserActionsMenu userId={user.id} currentStatus={user.status} currentRole={user.role} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-surface-100 px-4 py-3">
              <p className="text-xs text-gray-400">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={`?page=${page - 1}&role=${role}&status=${status}`}>
                    <Button variant="outline" size="sm">Previous</Button>
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={`?page=${page + 1}&role=${role}&status=${status}`}>
                    <Button variant="outline" size="sm">Next</Button>
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
