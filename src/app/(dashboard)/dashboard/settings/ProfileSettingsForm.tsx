"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useUsers } from "@/hooks/useUsers";
import { useToast } from "@/components/ui/Toast";

interface Props {
  user: { id: string; name: string | null; email: string; bio: string | null; avatarUrl: string | null };
}

export function ProfileSettingsForm({ user }: Props) {
  const [name, setName] = useState(user.name ?? "");
  const [bio,  setBio]  = useState(user.bio  ?? "");
  const { updateUser, updating } = useUsers();

  async function save() {
    await updateUser(user.id, { name, bio: bio || undefined });
  }

  return (
    <div className="space-y-6">
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
