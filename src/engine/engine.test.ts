import { describe, expect, it } from "vitest";
import { config, categories, levers, model, scenarios } from "../data";
import type { Lever, Scenario } from "../data/types";
import { baseline, runYear, simulate, type ScenarioState } from "./simulate";
import { contributions, isolatedEffect } from "./contributions";
import { guardrail } from "./guardrail";
import { spearman } from "./stats";

const HORIZON = 2030;
const BASE_YEAR = config.baseYear;
const ref = baseline(model);
const defaults = (active: number[], adoption = config.defaultAdoption): ScenarioState => ({ activeLevers: active, adoption, hypotheses: {} });
const at = (s: ScenarioState, year = HORIZON) => runYear(model, s, year).metrics;
const storeLevers = levers.filter((l) => l.type === "stores");

describe("reference and predefined scenarios", () => {
  it("reference Protein Tracker ratio is 32.0 %", () => {
    expect(Math.abs(ref.pt - 0.32)).toBeLessThan(0.0005);
  });

  it.each(scenarios.map((s) => [s.id, s] as [string, Scenario]))("%s lands within 0.5 point of its 2030 target", (_, s) => {
    expect(Math.abs(at(s).pt - s.target2030)).toBeLessThanOrEqual(0.005);
  });

  it.each(scenarios.map((s) => [s.id, s] as [string, Scenario]))("%s shows the expected guardrail state in 2030", (_, s) => {
    const g = guardrail(ref.pt, at(s).pt, BASE_YEAR, HORIZON, config.benchmark.pointsPerYear);
    expect(g.state).toBe(s.expectedGuardrail);
  });

  it("every scenario assumption exists and stays within its min-max range", () => {
    for (const s of scenarios) {
      for (const [leverId, values] of Object.entries(s.hypotheses)) {
        const l = levers.find((x) => x.id === leverId);
        expect(l, `${s.id}: ${leverId}`).toBeDefined();
        for (const [hid, v] of Object.entries(values)) {
          const h = l!.hypotheses.find((x) => x.id === hid);
          expect(h, `${s.id}: ${leverId}.${hid}`).toBeDefined();
          expect(v).toBeGreaterThanOrEqual(h!.min);
          expect(v).toBeLessThanOrEqual(h!.max);
        }
      }
    }
  });

  it("every lever default stays within its min-max range", () => {
    for (const l of levers) for (const h of l.hypotheses) {
      expect(h.value, `${l.id}.${h.id}`).toBeGreaterThanOrEqual(h.min);
      expect(h.value, `${l.id}.${h.id}`).toBeLessThanOrEqual(h.max);
    }
  });
});

describe("engine rules", () => {
  it("with no active lever the ratio stays constant", () => {
    const res = simulate(categories, levers, defaults([]), { horizon: HORIZON });
    for (const y of res) {
      expect(y.pt).toBeCloseTo(ref.pt, 12);
      expect(y.low.pt).toBeCloseTo(ref.pt, 12);
      expect(y.high.pt).toBeCloseTo(ref.pt, 12);
    }
  });

  it("2025 is the reference: no lever has any effect on it", () => {
    for (const s of scenarios) expect(at(s, BASE_YEAR).pt).toBeCloseTo(ref.pt, 12);
  });

  it("lever 3 alone leaves the ratio unchanged and narrows the band of the other levers", () => {
    expect(at(defaults([3])).pt).toBeCloseTo(ref.pt, 12);
    const others = [1, 5, 8, 11];
    const without = simulate(categories, levers, defaults(others), { horizon: HORIZON }).at(-1)!;
    const withData = simulate(categories, levers, defaults([3, ...others]), { horizon: HORIZON }).at(-1)!;
    expect(withData.pt).toBeCloseTo(without.pt, 12);
    expect(withData.high.pt - withData.low.pt).toBeLessThan(without.high.pt - without.low.pt);
    expect((withData.high.pt - withData.low.pt) / (without.high.pt - without.low.pt)).toBeCloseTo(0.6, 1);
  });

  it("with adoption at 0, levers that depend on stores have no effect", () => {
    expect(storeLevers.length).toBeGreaterThan(0);
    for (const l of storeLevers) {
      const r = runYear(model, defaults([l.number], 0), HORIZON);
      expect(r.metrics.pt, `lever ${l.number}`).toBeCloseTo(ref.pt, 12);
      for (const c of categories) expect(r.st[c.id].t).toBeCloseTo(c.tonnesProduct, 9);
    }
    const all = defaults(levers.map((l) => l.number), 0);
    const centralOnly = defaults(levers.filter((l) => l.type !== "stores").map((l) => l.number), 0);
    expect(at(all).pt).toBeCloseTo(at(centralOnly).pt, 12);
  });

  it("combined effect never exceeds the sum of isolated effects in the predefined scenarios", () => {
    for (const s of scenarios) {
      const c = contributions(model, s, HORIZON);
      expect(c.combined, s.id).toBeLessThanOrEqual(c.sumIsolated + 1e-12);
    }
  });

  it("for every pair of levers, combined stays within 0.05 point of the sum of isolated effects or below", () => {
    const numbers = levers.map((l) => l.number);
    for (const adoption of [0.5, 1]) {
      for (let i = 0; i < numbers.length; i++) for (let j = i + 1; j < numbers.length; j++) {
        const c = contributions(model, defaults([numbers[i], numbers[j]], adoption), HORIZON);
        expect(c.combined - c.sumIsolated, `${numbers[i]} + ${numbers[j]}`).toBeLessThanOrEqual(0.0005);
      }
    }
  });

  it("contributions add up to the combined effect", () => {
    for (const s of scenarios) {
      const c = contributions(model, s, HORIZON);
      const sum = c.steps.reduce((a, x) => a + x.value, 0);
      expect(sum).toBeCloseTo(c.combined, 12);
      expect(c.base + c.combined).toBeCloseTo(c.final, 12);
    }
  });

  it("ratios stay between 0 and 100 % and no volume turns negative, even with every assumption at its maximum", () => {
    const maxed: Record<string, Record<string, number>> = {};
    const mined: Record<string, Record<string, number>> = {};
    for (const l of levers) {
      maxed[l.id] = Object.fromEntries(l.hypotheses.map((h) => [h.id, h.max]));
      mined[l.id] = Object.fromEntries(l.hypotheses.map((h) => [h.id, h.min]));
    }
    const all = levers.map((l) => l.number);
    const states: ScenarioState[] = [...scenarios, { activeLevers: all, adoption: 1, hypotheses: maxed }, { activeLevers: all, adoption: 1, hypotheses: mined }];
    for (const s of states) {
      for (const y of simulate(categories, levers, s, { horizon: HORIZON })) {
        for (const m of [y, y.low, y.high]) {
          for (const r of [m.pt, m.fg1]) {
            expect(r).toBeGreaterThanOrEqual(0);
            expect(r).toBeLessThanOrEqual(1);
          }
        }
        for (const v of Object.values(y.volumes)) expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("ramp-up is monotonic: the ratio never falls from one year to the next in the predefined scenarios", () => {
    for (const s of scenarios) {
      const res = simulate(categories, levers, s, { horizon: HORIZON });
      for (let i = 1; i < res.length; i++) expect(res[i].pt).toBeGreaterThanOrEqual(res[i - 1].pt - 1e-12);
    }
  });
});

describe("calibration against the deck", () => {
  it("isolated effects follow the deck's impact scores (Spearman at least 0.7, lever 3 excluded)", () => {
    const state = defaults(levers.map((l) => l.number));
    const ranked = levers.filter((l) => l.number !== 3);
    const effects = ranked.map((l) => isolatedEffect(model, state, l.number, HORIZON).mid);
    expect(spearman(ranked.map((l) => l.deckImpact), effects)).toBeGreaterThanOrEqual(0.7);
  });

  it("lever 1 has the strongest isolated effect", () => {
    const state = defaults(levers.map((l) => l.number));
    const effects = levers.map((l: Lever) => ({ n: l.number, e: isolatedEffect(model, state, l.number, HORIZON).mid }));
    expect(effects.sort((a, b) => b.e - a.e)[0].n).toBe(1);
  });

  it("the 4 plots weigh between 3 and 6 points and other plant protein carries most of the rest", () => {
    const plots = (["1", "2", "3", "4"] as const).reduce((a, k) => a + ref.plots[k], 0) / ref.proteinTotal;
    expect(plots).toBeGreaterThanOrEqual(0.03);
    expect(plots).toBeLessThanOrEqual(0.06);
    expect(ref.plots.other / ref.proteinTotal).toBeGreaterThan(0.32 - plots - ref.plots.composite / ref.proteinTotal - 0.001);
    expect(ref.plots.other).toBeGreaterThan(ref.plots["1"] + ref.plots["2"] + ref.plots["3"] + ref.plots["4"]);
  });
});
