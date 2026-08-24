import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { UserService } from "@/services";
import { UsersClient } from "./UsersClient";

export const metadata: Metadata = { title: "Users | Admin" };

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/login");

  const { users } = await UserService.list({ limit: 100 });

  return (
    <div>
      <Topbar breadcrumbs={[
        { label: "Admin", href: "/admin" },
        { label: "Users" },
      ]} />
      <div className="p-4 sm:p-6 max-w-5xl">
        <UsersClient users={users.map((u) => ({
          id:        u.id,
          name:      u.name,
          email:     u.email,
          role:      u.role as "student" | "tutor" | "admin",
          status:    u.status as "active" | "suspended" | "pending" | "invited",
          createdAt: u.createdAt,
        }))} />
      </div>
    </div>
  );
}
