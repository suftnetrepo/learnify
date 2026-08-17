"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { useMutation } from "./useApi";
import { tutorsApi, usersApi } from "@/lib/api-client";
import type { AssignTutorPayload } from "@/types";

export function useTutorInvite() {
  const router = useRouter();
  const { success, error } = useToast();

  const { mutate, loading, error: mutError } = useMutation(tutorsApi.invite, {
    onSuccess: () => { success("Invitation sent", "They'll receive a sign-up link by email."); router.refresh(); },
    onError:   (msg) => error("Failed to send invitation", msg),
  });

  return { invite: mutate, loading, error: mutError };
}

export function useTutorApproval() {
  const router = useRouter();
  const { success, error } = useToast();

  const { mutate: updateUser, loading } = useMutation(usersApi.update, {
    onSuccess: () => router.refresh(),
    onError:   (msg) => error("Action failed", msg),
  });

  const approve = useCallback(async (tutorId: string, tutorName: string) => {
    const res = await updateUser(tutorId, { status: "active" });
    if (res) success("Tutor approved", `${tutorName} can now access their instructor dashboard.`);
    return res;
  }, [updateUser, success]);

  const reject = useCallback(async (tutorId: string) => {
    return updateUser(tutorId, { status: "suspended" });
  }, [updateUser]);

  return { approve, reject, loading };
}

export function useTutorAssignment() {
  const router = useRouter();
  const { success, error } = useToast();

  const assignMut = useMutation(tutorsApi.assign, {
    onError: (msg) => error("Assignment failed", msg),
  });
  const cancelMut = useMutation(tutorsApi.cancelAssignment, {
    onError: (msg) => error("Failed to cancel", msg),
  });
  const revokeMut = useMutation(tutorsApi.revokeInvite, {
    onError: (msg) => error("Failed to revoke", msg),
  });

  const assign = useCallback(async (payload: AssignTutorPayload) => {
    const res = await assignMut.mutate(payload);
    if (res) { success("Tutor assigned"); router.refresh(); }
    return res;
  }, [assignMut, success, router]);

  const cancelAssignment = useCallback(async (id: string, tutorName: string) => {
    const res = await cancelMut.mutate(id);
    if (res !== null) { success("Assignment cancelled", `${tutorName} has been removed.`); router.refresh(); }
    return res;
  }, [cancelMut, success, router]);

  const revokeInvite = useCallback(async (id: string, email: string) => {
    const res = await revokeMut.mutate(id);
    if (res !== null) { success("Invitation revoked", `Invite to ${email} cancelled.`); router.refresh(); }
    return res;
  }, [revokeMut, success, router]);

  return { assign, cancelAssignment, revokeInvite, assigning: assignMut.loading, cancelling: cancelMut.loading, revoking: revokeMut.loading };
}
