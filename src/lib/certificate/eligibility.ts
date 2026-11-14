export type AttendanceStatus = "attended" | "partial" | "absent";
export type CandidateOutcome = "passed" | "incomplete";
export type CertificateType = "attendance" | "completion";

export function certificateEligibilityError(
  type: CertificateType,
  attendance: AttendanceStatus,
  outcome: CandidateOutcome,
): string | null {
  if (type === "completion" && (attendance !== "attended" || outcome !== "passed")) {
    return "A completion certificate requires attended and passed statuses";
  }
  if (type === "attendance" && attendance === "absent") {
    return "An attendance certificate cannot be issued to an absent candidate";
  }
  return null;
}
