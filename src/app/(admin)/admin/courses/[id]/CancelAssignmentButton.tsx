"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { ConfirmModal } from "@/components/ui/Modal";
import { useTutorAssignment } from "@/hooks/useTutors";

interface Props { assignmentId: string; tutorName: string }

export function CancelAssignmentButton({ assignmentId, tutorName }: Props) {
  const [open, setOpen] = useState(false);
  const { cancelAssignment, cancelling } = useTutorAssignment();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-red-100 hover:text-red-500 transition-colors"
        title="Cancel assignment"
        aria-label="Cancel assignment"
      >
        <X size={14} />
      </button>
      <ConfirmModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={async () => { await cancelAssignment(assignmentId, tutorName); setOpen(false); }}
        title="Cancel Assignment"
        description={`Remove ${tutorName} from this course? Past payment records are unaffected.`}
        confirmLabel="Cancel Assignment"
        variant="danger"
        loading={cancelling}
      />
    </>
  );
}
