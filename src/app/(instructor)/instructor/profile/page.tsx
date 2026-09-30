import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { auth } from "@/lib/auth";
import { UserService } from "@/services";
import { Topbar } from "@/components/layout/Topbar";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = { title: "Profile | Instructor" };

export default async function InstructorProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await UserService.findById(session.user.id);
  if (!user) redirect("/login");

  return (
    <div>
      <Topbar
        breadcrumbs={[{ label: "Instructor", href: "/instructor" }, { label: "Profile" }]}
        actions={
          user.role === "tutor" ? (
            <Link
              href={`/tutors/${user.id}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-xl border border-surface-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition hover:border-brand-200 hover:text-brand-600"
            >
              <ExternalLink size={13} /> View public profile
            </Link>
          ) : undefined
        }
      />
      <div className="max-w-3xl space-y-6 p-4 pb-24 sm:p-6 sm:pb-24">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-gray-900">Your profile</h1>
          <p className="mt-1 text-sm text-gray-500">
            This is what students see on your public profile and on the courses you teach.
          </p>
        </div>
        <ProfileForm
          user={{
            id:              user.id,
            name:            user.name,
            email:           user.email,
            bio:             user.bio,
            avatarUrl:       user.avatarUrl,
            headline:        user.headline,
            location:        user.location,
            website:         user.website,
            linkedinUrl:     user.linkedinUrl,
            githubUrl:       user.githubUrl,
            twitterUrl:      user.twitterUrl,
            yearsExperience: user.yearsExperience,
            languages:       user.languages ?? [],
            expertise:       user.expertise ?? [],
            experience:      user.experience ?? [],
          }}
        />
      </div>
    </div>
  );
}
