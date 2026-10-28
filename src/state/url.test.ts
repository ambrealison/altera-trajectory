import { describe, expect, it } from "vitest";
import { fromHash, presetFields, toHash } from "./url";

describe("scenario in the URL hash", () => {
  it("a preset scenario gives a short link", () => {
    expect(toHash({ ...presetFields("committed"), screen: "trajectory", lang: "fr" })).toBe("#v=trajectory&sc=committed&lang=fr");
  });
  it("round-trips a modified scenario", () => {
    const base = presetFields("ambitious");
    const snap = {
      ...base,
      screen: "trajectory" as const,
      lang: "en" as const,
      activeLevers: [1, 2, 3, 20],
      adoption: 0.7,
      horizon: 2028,
      metric: "fg1" as const,
      hypotheses: { ...base.hypotheses, L01: { conversion: 60, plantShare: 35 }, L20: { purchaseCut: 3 } },
    };
    const back = fromHash(toHash(snap))!;
    expect(back.screen).toBe("trajectory");
    expect(back.lang).toBe("en");
    expect(back.preset).toBe("ambitious");
    expect(back.activeLevers).toEqual([1, 2, 3, 20]);
    expect(back.adoption).toBeCloseTo(0.7, 10);
    expect(back.horizon).toBe(2028);
    expect(back.metric).toBe("fg1");
    expect(back.hypotheses?.L01).toEqual({ conversion: 60, plantShare: 35 });
    expect(back.hypotheses?.L20).toEqual({ purchaseCut: 3 });
    expect(back.hypotheses?.L02).toEqual(base.hypotheses.L02);
  });
  it("an old link to the removed 2040 horizon falls back to the default", () => {
    expect(fromHash("#v=trajectory&sc=ambitious&h=2040")!.horizon).toBe(2035);
  });
  it("ignores unknown levers, assumptions and out-of-range values", () => {
    const back = fromHash("#v=levers&l=1.99.3&hy=L01.conversion:500,L77.x:1,L02.nope:3")!;
    expect(back.activeLevers).toEqual([1, 3]);
    expect(back.hypotheses?.L01?.conversion).toBe(70);
    expect(back.hypotheses?.L77).toBeUndefined();
  });
});
