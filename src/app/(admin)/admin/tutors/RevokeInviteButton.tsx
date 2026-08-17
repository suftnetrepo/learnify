"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { ConfirmModal } from "@/components/ui/Modal";
import { useTutorAssignment } from "@/hooks/useTutors";

interface Props { inviteId: string; email: string }

export function RevokeInviteButton({ inviteId, email }: Props) {
  const [open, setOpen] = useState(false);
  const { revokeInvite, revoking } = useTutorAssignment();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
      >
        <X size={12} /> Revoke
      </button>
      <ConfirmModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={async () => { await revokeInvite(inviteId, email); setOpen(false); }}
        title="Revoke Invitation"
        description={`Cancel the pending invitation to ${email}? The link will no longer work.`}
        confirmLabel="Revoke"
        variant="danger"
        loading={revoking}
      />
    </>
  );
}
