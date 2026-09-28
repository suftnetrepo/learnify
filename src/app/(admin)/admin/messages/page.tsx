import { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { MessagesInbox } from "@/components/messaging/MessagesInbox";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <MessagesInbox viewerId={session.user.id} viewerRole="admin" />;
}
