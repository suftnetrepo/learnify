import { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { MessagesInbox } from "@/components/messaging/MessagesInbox";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // Admins can open instructor pages too — they get the read-only view
  return <MessagesInbox viewerId={session.user.id} viewerRole={session.user.role === "admin" ? "admin" : "tutor"} />;
}
