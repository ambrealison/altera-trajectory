import { describe, expect, it } from "vitest";
import { guardrail } from "./guardrail";

describe("guardrail", () => {
  const pace = 0.85;
  it("is within the observed pace up to 0.85 point a year", () => {
    expect(guardrail(0.32, 0.32 + 0.0425, 2025, 2030, pace).state).toBe("within");
  });
  it("is above beyond 0.85 and up to 1.5 times that pace", () => {
    expect(guardrail(0.32, 0.32 + 0.045, 2025, 2030, pace).state).toBe("above");
    expect(guardrail(0.32, 0.32 + 0.06375, 2025, 2030, pace).state).toBe("above");
  });
  it("is well above beyond 1.5 times the observed pace", () => {
    expect(guardrail(0.32, 0.32 + 0.065, 2025, 2030, pace).state).toBe("well_above");
  });
  it("reports the average yearly gain in points", () => {
    expect(guardrail(0.32, 0.35, 2025, 2028, pace).annualGain).toBeCloseTo(1, 10);
  });
});
