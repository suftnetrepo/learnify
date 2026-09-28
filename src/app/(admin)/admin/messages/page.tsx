import { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Topbar } from "@/components/layout/Topbar";
import { MessagesHub, type HubTab } from "@/components/messaging/MessagesHub";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { tab } = await searchParams;
  return (
    <>
      <Topbar breadcrumbs={[{ label: "Admin" }, { label: "Messages" }]} />
      <MessagesHub viewerId={session.user.id} viewerRole="admin" initialTab={tab as HubTab | undefined} />
    </>
  );
}
