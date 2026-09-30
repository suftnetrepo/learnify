"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SessionPicker } from "@/components/sessions/SessionPicker";
import { useCheckout } from "@/hooks/useStripe";

interface Session {
  id: string; title: string;
  startDatetime: string; endDatetime: string;
  capacity: number; enrolledCount: number;
  seatsRemaining: number; isFull: boolean;
  venueCity: string | null; venueAddress: string | null;
  venuePostcode: string | null; conferencePlatform: string | null;
}

interface Props {
  courseId:    string;
  sessions?:   Session[];
  requiresSession?: boolean;
}

export function CheckoutButton({ courseId, sessions = [], requiresSession = false }: Props) {
  const { startCheckout, loading, error } = useCheckout();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    sessions.length === 1 ? sessions[0].id : null
  );

  const hasSessions    = sessions.length > 0;
  // A session course with nothing upcoming can't be bought — never send it to Stripe
  const unavailable    = requiresSession && !hasSessions;
  const needsSelection = requiresSession && !selectedSessionId;
  const selectedFull   = selectedSessionId
    ? sessions.find((s) => s.id === selectedSessionId)?.isFull
    : false;

  function handleCheckout() {
    if (unavailable || needsSelection || selectedFull) return;
    startCheckout(courseId, selectedSessionId ?? undefined);
  }

  return (
    <div className="space-y-4">
      {/* Session picker */}
      {requiresSession && (
        <div>
          <p className="text-sm font-semibold text-gray-900 mb-2">Choose a session</p>
          <SessionPicker
            sessions={sessions}
            selectedSessionId={selectedSessionId}
            onSelect={setSelectedSessionId}
          />
        </div>
      )}

      {/* Button */}
      <Button
        className="w-full"
        size="lg"
        onClick={handleCheckout}
        loading={loading}
        disabled={unavailable || needsSelection || !!selectedFull}
        leftIcon={<Lock size={15} />}
      >
        {loading          ? "Preparing checkout…" :
         unavailable      ? "No sessions available" :
         needsSelection   ? "Select a session to continue" :
         "Enrol now"}
      </Button>

      {error && <p className="text-xs text-red-500 text-center">{error}</p>}
      {!unavailable && (
        <p className="text-xs text-gray-400 text-center">
          You&apos;ll be taken to Stripe&apos;s secure checkout page.
        </p>
      )}
    </div>
  );
}
