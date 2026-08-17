import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ToastProvider } from "@/components/ui/Toast";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

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
