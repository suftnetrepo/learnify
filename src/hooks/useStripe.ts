"use client";

import { useToast } from "@/components/ui/Toast";
import { useMutation } from "./useApi";
import { stripeApi } from "@/lib/api-client";

export function useCheckout() {
  const { error } = useToast();

  const { mutate, loading, error: mutError } = useMutation(
    (courseId: string, sessionId?: string) => stripeApi.checkout(courseId, sessionId), {
    onError: (msg) => error("Checkout failed", msg),
  });

  const startCheckout = async (courseId: string, sessionId?: string) => {
    const res = await mutate(courseId, sessionId);
    if (res?.url) window.location.href = res.url;
    return res;
  };
  // Note: free courses return { url: "/dashboard/courses/..." } which is handled above

  return { startCheckout, loading, error: mutError };
}

export function useStripeConnect() {
  const { error } = useToast();

  const { mutate, loading } = useMutation(stripeApi.connectOnboard, {
    onError: (msg) => error("Connection failed", msg),
  });

  const startOnboarding = async () => {
    const res = await mutate();
    if (res?.url) window.location.href = res.url;
    return res;
  };

  return { startOnboarding, loading };
}
