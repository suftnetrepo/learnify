"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { useMutation } from "./useApi";
import { usersApi } from "@/lib/api-client";
import type { UpdateUserPayload, CreateUserPayload } from "@/types";

export function useUsers() {
  const router = useRouter();
  const { success, error } = useToast();

  const createMut = useMutation(usersApi.create, {
    onSuccess: () => { success("User created"); router.refresh(); },
    onError:   (msg) => error("Failed to create user", msg),
  });

  const updateMut = useMutation(usersApi.update, {
    onSuccess: () => { success("User updated"); router.refresh(); },
    onError:   (msg) => error("Update failed", msg),
  });

  const deleteMut = useMutation(usersApi.remove, {
    onSuccess: () => { success("User removed"); router.refresh(); },
    onError:   (msg) => error("Delete failed", msg),
  });

  const createUser = useCallback(
    (payload: CreateUserPayload) => createMut.mutate(payload),
    [createMut]
  );

  const updateUser = useCallback(
    (id: string, payload: UpdateUserPayload) => updateMut.mutate(id, payload),
    [updateMut]
  );

  const deleteUser    = useCallback((id: string) => deleteMut.mutate(id),    [deleteMut]);
  const activateUser  = useCallback((id: string) => updateUser(id, { status: "active" }),    [updateUser]);
  const suspendUser   = useCallback((id: string) => updateUser(id, { status: "suspended" }), [updateUser]);

  return {
    createUser,
    updateUser,
    deleteUser,
    activateUser,
    suspendUser,
    creating: createMut.loading,
    updating: updateMut.loading,
    deleting: deleteMut.loading,
    error:    createMut.error ?? updateMut.error ?? deleteMut.error,
  };
}
