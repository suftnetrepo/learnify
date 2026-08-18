import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ToastProvider } from "@/components/ui/Toast";

export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <ToastProvider>{children}</ToastProvider>;
}
