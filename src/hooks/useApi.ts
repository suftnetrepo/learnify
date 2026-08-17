"use client";

import { useState, useCallback } from "react";
import { ApiError } from "@/lib/api-client";

interface MutationState {
  loading: boolean;
  error:   string | null;
}

interface UseMutationOptions {
  onSuccess?: (message?: string) => void;
  onError?:   (message: string)  => void;
}

/**
 * Wraps any async api-client function with loading + error state.
 * Hooks use this to expose clean state to components.
 */
export function useMutation<TArgs extends unknown[], TReturn>(
  apiFn:   (...args: TArgs) => Promise<TReturn>,
  options?: UseMutationOptions
) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const mutate = useCallback(async (...args: TArgs): Promise<TReturn | null> => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiFn(...args);
      options?.onSuccess?.();
      return result;
    } catch (err) {
      const message = err instanceof ApiError
        ? err.message
        : err instanceof Error
        ? err.message
        : "Something went wrong";

      setError(message);
      options?.onError?.(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [apiFn, options]);

  const reset = useCallback(() => setError(null), []);

  return { mutate, loading, error, reset };
}
