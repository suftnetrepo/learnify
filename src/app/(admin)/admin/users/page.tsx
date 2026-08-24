import { Metadata } from "next";
import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { UserService } from "@/services";
import { UsersClient } from "./UsersClient";

export const metadata: Metadata = { title: "Users | Admin" };

interface PageProps {
  searchParams: Promise<{
    q?:      string;
    role?:   string;
    status?: string;
    page?:   string;
  }>;
}

const PAGE_SIZE = 20;

export default async function UsersPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/login");

  const { q, role, status, page } = await searchParams;
  const currentPage = Math.max(1, parseInt(page ?? "1", 10) || 1);

  const { users, pagination } = await UserService.list({
    page:   currentPage,
    limit:  PAGE_SIZE,
    role:   role   as "student" | "tutor" | "admin" | undefined,
    status: status as "active" | "suspended" | "pending" | "invited" | undefined,
    search: q || undefined,
  });

  return (
    <div>
      <Topbar breadcrumbs={[
        { label: "Admin", href: "/admin" },
        { label: "Users" },
      ]} />
      <div className="p-4 sm:p-6 max-w-5xl">
        <Suspense fallback={<div className="h-96 rounded-2xl bg-surface-100 animate-pulse" />}>
          <UsersClient
            users={users.map((u) => ({
              id:        u.id,
              name:      u.name,
              email:     u.email,
              role:      u.role as "student" | "tutor" | "admin",
              status:    u.status as "active" | "suspended" | "pending" | "invited",
              createdAt: u.createdAt,
            }))}
            total={pagination.total}
            currentPage={pagination.page}
            pageSize={pagination.limit}
          />
        </Suspense>
      </div>
    </div>
  );
}
