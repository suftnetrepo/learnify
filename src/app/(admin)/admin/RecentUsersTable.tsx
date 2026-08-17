import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import type { UserListItem } from "@/types";

export function RecentUsersTable({ users }: { users: UserListItem[] }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="heading-3 text-gray-900">Recent Users</h2>
      </div>
      <div className="table-container">
        <table className="w-full min-w-[560px]">
          <thead><tr><th className="table-header">User</th><th className="table-header">Role</th><th className="table-header">Status</th><th className="table-header">Joined</th></tr></thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan={4} className="table-cell text-center text-gray-400 py-8">No users yet</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="table-row">
                <td className="table-cell"><p className="font-medium text-gray-900">{u.name ?? "—"}</p><p className="text-xs text-gray-400">{u.email}</p></td>
                <td className="table-cell"><Badge variant={u.role === "admin" ? "brand" : u.role === "tutor" ? "accent" : "neutral"}>{u.role}</Badge></td>
                <td className="table-cell"><Badge variant={u.status === "active" ? "success" : u.status === "pending" ? "warning" : "danger"}>{u.status}</Badge></td>
                <td className="table-cell text-gray-400 text-xs">{formatDate(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
