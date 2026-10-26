import { describe, expect, it } from "vitest";
import { fmtNum, fmtPct, fmtPoints, fmtTonnes } from "./format";

describe("localised formats", () => {
  it("French: comma decimals, non-breaking spaces before % and as thousands separator", () => {
    expect(fmtPct(0.32, "fr")).toBe("32,0 %");
    expect(fmtNum(1102, "fr")).toBe("1 102");
    expect(fmtTonnes(1102, "fr")).toBe("1 102 t");
  });
  it("English: point decimals, comma thousands", () => {
    expect(fmtPct(0.32, "en")).toBe("32.0%");
    expect(fmtNum(1102, "en")).toBe("1,102");
    expect(fmtTonnes(1102, "en")).toBe("1,102 t");
  });
  it("points are signed and never use a minus sign other than the hyphen", () => {
    expect(fmtPoints(0.0123, "fr")).toBe("+1,2 pt");
    expect(fmtPoints(-0.0234, "en")).toBe("-2.3 pts");
  });
});
