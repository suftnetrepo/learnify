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
  price:       number;
  isFree?:     boolean;
  sessions?:   Session[];
}

export function CheckoutButton({ courseId, price, isFree = false, sessions = [] }: Props) {
  const { startCheckout, loading, error } = useCheckout();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    sessions.length === 1 ? sessions[0].id : null
  );

  const hasSessions    = sessions.length > 0;
  const needsSelection = hasSessions && !selectedSessionId;
  const selectedFull   = selectedSessionId
    ? sessions.find((s) => s.id === selectedSessionId)?.isFull
    : false;

  function handleCheckout() {
    startCheckout(courseId, selectedSessionId ?? undefined);
  }

  return (
    <div className="space-y-4">
      {/* Session picker */}
      {hasSessions && (
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
        disabled={needsSelection || !!selectedFull}
        leftIcon={<Lock size={15} />}
      >
        {loading          ? "Preparing checkout…" :
         needsSelection   ? "Select a session to continue" :
         "Enrol now"}
      </Button>

      {error && <p className="text-xs text-red-500 text-center">{error}</p>}
      <p className="text-xs text-gray-400 text-center">
        You&apos;ll be taken to Stripe&apos;s secure checkout page.
      </p>
    </div>
  );
}
