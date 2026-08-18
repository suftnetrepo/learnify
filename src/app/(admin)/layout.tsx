import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/DashboardShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/unauthorized");

  return (
    <DashboardShell
      role={session.user.role}
      name={session.user.name}
      email={session.user.email}
      avatar={session.user.image}
    >
      {children}
    </DashboardShell>
  );
}
