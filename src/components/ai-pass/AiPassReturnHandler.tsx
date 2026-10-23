"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

/**
 * Handles the redirect back from Stripe Checkout (?ai_pass=success&session_id=… or
 * ?ai_pass=cancelled). The session id is only a hint — /api/ai-pass/confirm re-reads it from
 * Stripe and checks it belongs to this student — then the page re-renders with the new access.
 */
export function AiPassReturnHandler() {
  const router = useRouter();
  const toast  = useToast();
  const ran    = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    const url    = new URL(window.location.href);
    const result = url.searchParams.get("ai_pass");
    if (!result) return;
    ran.current = true;
    const sessionId = url.searchParams.get("session_id");
    url.searchParams.delete("ai_pass");
    url.searchParams.delete("session_id");
    const clean = url.pathname + (url.search || "");

    if (result !== "success" || !sessionId) {
      toast.info("Checkout cancelled", "You haven't been charged.");
      router.replace(clean, { scroll: false });
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/ai-pass/confirm", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ sessionId }),
        });
        const body = await res.json().catch(() => ({}));
        if (res.ok) {
          toast.success("AI Tutor Pass activated", "Open the AI Tutor to get started.");
        } else if (res.status === 409) {
          toast.info("Payment processing", "Your pass will appear as soon as the payment completes.");
        } else {
          toast.error("We couldn't activate your pass", body?.message ?? "Please contact support if you were charged.");
        }
      } catch {
        toast.info("Payment received", "Your pass will appear shortly. Refresh the page if it doesn't.");
      }
      router.replace(clean, { scroll: false });
      router.refresh();
    })();
  }, [router, toast]);

  return null;
}
