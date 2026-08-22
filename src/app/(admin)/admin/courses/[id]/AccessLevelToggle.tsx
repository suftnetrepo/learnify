"use client";

import { cn } from "@/lib/utils";
import { useTutorAssignment } from "@/hooks/useTutors";
import type { TutorAccessLevel } from "@/types";

interface Props { assignmentId: string; accessLevel: TutorAccessLevel }

const LEVELS = ["viewer", "editor", "manager"] as const;

const LEVEL_STYLES: Record<TutorAccessLevel, string> = {
  viewer:  "bg-surface-100 text-gray-500 hover:bg-surface-200",
  editor:  "bg-brand-100 text-brand-700 hover:bg-brand-200",
  manager: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
};

const LEVEL_LABELS: Record<TutorAccessLevel, string> = {
  viewer:  "Viewer",
  editor:  "Editor",
  manager: "Manager",
};

const LEVEL_HELP: Record<TutorAccessLevel, string> = {
  viewer:  "Read-only access",
  editor:  "Can edit content and upload videos",
  manager: "Full course creation and pricing — requires admin approval to publish",
};

export function AccessLevelToggle({ assignmentId, accessLevel }: Props) {
  const { updateAccessLevel, updatingAccess } = useTutorAssignment();

  // Cycle to next level on click: viewer → editor → manager → viewer
  const nextLevel = LEVELS[(LEVELS.indexOf(accessLevel) + 1) % LEVELS.length];

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400">Access:</span>
      <button
        disabled={updatingAccess}
        onClick={() => updateAccessLevel(assignmentId, nextLevel)}
        title={`${LEVEL_HELP[accessLevel]} — click to change to ${LEVEL_LABELS[nextLevel]}`}
        className={cn(
          "rounded-full px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50",
          LEVEL_STYLES[accessLevel]
        )}
      >
        {LEVEL_LABELS[accessLevel]}
      </button>
    </div>
  );
}
