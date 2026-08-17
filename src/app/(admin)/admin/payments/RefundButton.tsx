"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { ConfirmModal } from "@/components/ui/Modal";
import { useMutation } from "@/hooks/useApi";
import { paymentsApi } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";

interface Props { purchaseId: string; paymentIntentId: string; amount: string }

export function RefundButton({ purchaseId, amount }: Props) {
  const [open, setOpen] = useState(false);
  const { success, error } = useToast();
  const router = useRouter();

  const { mutate, loading } = useMutation(paymentsApi.refund, {
    onSuccess: () => { success("Refund issued", "The student will be refunded within 5–10 business days."); router.refresh(); },
    onError:   (msg) => error("Refund failed", msg),
  });

  async function handleRefund() {
    await mutate(purchaseId);
    setOpen(false);
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-surface-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors">
        <RotateCcw size={11} /> Refund
      </button>
      <ConfirmModal open={open} onClose={() => setOpen(false)} onConfirm={handleRefund}
        title="Issue Refund" description={`Refund ${amount} to the student? This will revoke their course access.`}
        confirmLabel="Issue Refund" variant="danger" loading={loading} />
    </>
  );
}
