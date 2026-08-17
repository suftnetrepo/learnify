import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { ProfileSettingsForm } from "./ProfileSettingsForm";
import { UserService } from "@/services";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await UserService.findById(session.user.id);

  if (!user) redirect("/login");

  return (
    <div>
      <Topbar breadcrumbs={[{ label: "Dashboard" }, { label: "Settings" }]} />
      <div className="p-4 sm:p-6 max-w-2xl space-y-8">
        <div>
          <h1 className="heading-1 text-gray-900">Settings</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your account details.</p>
        </div>
        <ProfileSettingsForm user={user} />
      </div>
    </div>
  );
}
