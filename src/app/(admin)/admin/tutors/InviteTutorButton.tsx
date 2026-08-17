"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useTutorInvite } from "@/hooks/useTutors";

export function InviteTutorButton() {
  const [open,  setOpen]  = useState(false);
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState("");

  const { invite, loading, error } = useTutorInvite();

  async function handleInvite() {
    if (!email.trim()) { setFieldError("Email is required"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFieldError("Enter a valid email address"); return; }

    const res = await invite(email.trim());
    if (res) {
      setOpen(false);
      setEmail("");
    }
  }

  function handleClose() {
    setOpen(false);
    setEmail("");
    setFieldError("");
  }

  return (
    <>
      <Button leftIcon={<UserPlus size={16} />} onClick={() => setOpen(true)}>
        Invite Tutor
      </Button>

      <Modal open={open} onClose={handleClose} title="Invite a Tutor" size="sm">
        <p className="text-sm text-gray-500 mb-5">
          We&apos;ll send them a unique sign-up link. Invitations expire after 7 days.
        </p>

        <Input
          label="Email Address"
          type="email"
          placeholder="tutor@example.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setFieldError(""); }}
          error={fieldError || error || undefined}
          required
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") handleInvite(); }}
        />

        <div className="mt-5 flex justify-end gap-3">
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleInvite} loading={loading}>
            Send Invitation
          </Button>
        </div>
      </Modal>
    </>
  );
}
