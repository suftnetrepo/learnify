import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ToastProvider } from "@/components/ui/Toast";

export default async function InstructorLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "tutor" && session.user.role !== "admin") redirect("/unauthorized");
  if (session.user.status === "pending") redirect("/pending-approval");

  return (
    <ToastProvider>
      <DashboardShell
        role={session.user.role}
        name={session.user.name}
        email={session.user.email}
        avatar={session.user.image}
      >
        {children}
      </DashboardShell>
    </ToastProvider>
  );
}
