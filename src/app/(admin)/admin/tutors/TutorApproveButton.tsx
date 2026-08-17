"use client";

import { useState } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/Modal";
import { useTutorApproval } from "@/hooks/useTutors";

interface Props { tutorId: string; tutorName: string }

export function TutorApproveButton({ tutorId, tutorName }: Props) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const { approve, reject, loading } = useTutorApproval();

  return (
    <div className="flex gap-2">
      <Button
        variant="secondary"
        size="sm"
        leftIcon={<CheckCircle size={14} />}
        loading={loading}
        onClick={() => approve(tutorId, tutorName)}
      >
        Approve
      </Button>
      <Button
        variant="ghost"
        size="sm"
        leftIcon={<XCircle size={14} />}
        disabled={loading}
        onClick={() => setRejectOpen(true)}
        className="text-red-500 hover:bg-red-50 hover:text-red-600"
      >
        Reject
      </Button>

      <ConfirmModal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onConfirm={async () => { await reject(tutorId); setRejectOpen(false); }}
        title="Reject Application"
        description={`Reject ${tutorName}'s tutor application? Their account will be suspended.`}
        confirmLabel="Reject"
        variant="danger"
        loading={loading}
      />
    </div>
  );
}
