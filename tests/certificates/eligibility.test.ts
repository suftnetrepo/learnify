import { describe, expect, it } from "vitest";
import { certificateEligibilityError } from "@/lib/certificate/eligibility";

describe("certificate eligibility", () => {
  it("allows completion only after attended and passed", () => {
    expect(certificateEligibilityError("completion", "attended", "passed")).toBeNull();
    expect(certificateEligibilityError("completion", "partial", "passed")).toMatch(/requires attended/);
    expect(certificateEligibilityError("completion", "attended", "incomplete")).toMatch(/requires attended/);
  });

  it("allows attendance for full or partial attendance, but not absence", () => {
    expect(certificateEligibilityError("attendance", "attended", "passed")).toBeNull();
    expect(certificateEligibilityError("attendance", "partial", "incomplete")).toBeNull();
    expect(certificateEligibilityError("attendance", "absent", "incomplete")).toMatch(/cannot be issued/);
  });
});
