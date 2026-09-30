"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useUsers } from "@/hooks/useUsers";
import Link from "next/link";
import { UserRound } from "lucide-react";

interface Props {
  user: { id: string; name: string | null; email: string; bio: string | null; avatarUrl: string | null };
  role: string;
}

export function ProfileSettingsForm({ user, role }: Props) {
  // Tutors edit name, photo and bio on /instructor/profile (their public profile), so
  // Settings stays account-only for them rather than editing the same fields twice
  const isTutor = role === "tutor";
  const [name, setName] = useState(user.name ?? "");
  const [bio,  setBio]  = useState(user.bio  ?? "");
  const { updateUser, updating } = useUsers();

  async function save() {
    await updateUser(user.id, { name, bio: bio || undefined });
  }

  return (
    <div className="space-y-6">
      {isTutor ? (
        <Card>
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <UserRound size={18} />
            </div>
            <div className="flex-1">
              <h2 className="heading-3 text-gray-900">Public profile</h2>
              <p className="mt-1 text-sm text-gray-500">
                Your name, photo, headline, bio, expertise and experience are edited on your Profile page.
              </p>
              <Link href="/instructor/profile" className="mt-3 inline-block">
                <Button variant="secondary" size="sm">Edit profile</Button>
              </Link>
            </div>
          </div>
        </Card>
      ) : (
      <Card>
        <h2 className="heading-3 text-gray-900 mb-5">Profile</h2>
        <div className="flex items-center gap-4 mb-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-500 text-2xl font-bold text-white">
            {name?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{name || "Your name"}</p>
            <p className="text-xs text-gray-400">{user.email}</p>
          </div>
        </div>
        <div className="space-y-4">
          <Input label="Full Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
          <div>
            <label className="form-label">Bio</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3}
              placeholder="Tell students about yourself…" className="form-input resize-none" />
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={save} loading={updating}>Save changes</Button>
        </div>
      </Card>
      )}

      <Card>
        <h2 className="heading-3 text-gray-900 mb-2">Email</h2>
        <p className="text-sm text-gray-500 mb-1">
          Your email is <strong>{user.email}</strong>.
        </p>
        <p className="text-xs text-gray-400">Email changes require contacting support.</p>
      </Card>
    </div>
  );
}
