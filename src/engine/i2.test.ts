import { describe, expect, it } from "vitest";
import { dataset } from "../data";
import { I2_KEYS, centralParams, i2Year, monteCarlo, rng, runI2, splitSteps, tornado, triangular } from "./i2";

const v = dataset.i2;
const p = centralParams(v);
const A = runI2(p, { rangeBuild: false });
const B = runI2(p, { rangeBuild: true });

describe("I2 register", () => {
  it("holds the 38 inputs of the model, each with low <= central <= high", () => {
    for (const k of I2_KEYS) {
      expect(v[k], k).toBeDefined();
      expect(v[k].low, k).toBeLessThanOrEqual(v[k].central);
      expect(v[k].central, k).toBeLessThanOrEqual(v[k].high);
      expect(v[k].note.fr.length * v[k].note.en.length, k).toBeGreaterThan(0);
    }
  });
});

describe("I2 model", () => {
  it("2025 and 2026 have no effect (first shelf in 2027) and the effect grows up to the plateau", () => {
    expect(i2Year(A, 2025).pp).toBe(0);
    expect(i2Year(A, 2026).pp).toBe(0);
    for (let y = 2028; y <= 2035; y++) expect(i2Year(A, y).pp).toBeGreaterThan(i2Year(A, y - 1).pp);
  });

  it("with every store live all year, the added volume has its closed form", () => {
    const r = i2Year(A, 2030);
    let expected = 0;
    for (let q = 0; q < 4; q++) expected += (p["I2.V0_T"] * 1000 * Math.pow(1 + p["G.PBM_GROWTH"], 5 + (q + 0.5) / 4)) / 4;
    expect(r.addedKg).toBeCloseTo(expected * p["I2.UPLIFT"], 6);
    expect(r.storesLive).toBeCloseTo(p["G.N_STORES_SCOPE"], 6);
  });

  it("the protein split change follows the Protein Tracker formula", () => {
    const r = i2Year(B, 2030);
    const T = p["G.POOL_T"] * 1000;
    expect(r.pp).toBeCloseTo(100 * ((p["G.R0"] * T + r.dP) / (T + r.dP + r.dA) - p["G.R0"]), 12);
    const s = splitSteps(p, r);
    expect(s.pp).toBe(r.pp);
    expect(s.need).toBeCloseTo((0.01 * p["G.POOL_T"]) / (1 - p["G.R0"] - 0.01), 6);
  });

  it("no uplift and no meat effect give no protein, margin or carbon change", () => {
    const r = i2Year(runI2({ ...p, "I2.UPLIFT": 0, "I2.MEAT_EFFECT": 0 }, { rangeBuild: true }), 2030);
    expect(r.addedKg).toBe(0);
    expect(r.pp).toBeCloseTo(0, 12);
    expect(r.co2kt).toBeCloseTo(0, 12);
    expect(r.net).toBeCloseTo(-r.cost, 6);
  });

  it("half the stores halve the volume and the meat-side effect", () => {
    const meat = { ...p, "I2.MEAT_EFFECT": -0.029 };
    const full = i2Year(runI2(meat, { rangeBuild: false }), 2030);
    const half = i2Year(runI2({ ...meat, "I2.ALPHA": 0.5 }, { rangeBuild: false }), 2030);
    expect(half.addedKg).toBeCloseTo(full.addedKg / 2, 6);
    expect(half.dAMeatSide).toBeCloseTo(full.dAMeatSide / 2, 6);
  });

  it("a 2.9 % meat fall changes animal protein by exactly 0.029 times the pool once every store is live", () => {
    const r = i2Year(runI2({ ...p, "I2.MEAT_EFFECT": -0.029 }, { rangeBuild: false }), 2030);
    expect(r.dAMeatSide).toBeCloseTo(-0.029 * p["I2.MEAT_POOL_T"] * 1000, 6);
  });

  it("the range build only adds volume, and leaves the effort unchanged", () => {
    for (let y = 2025; y <= 2035; y++) {
      expect(i2Year(B, y).addedKg).toBeGreaterThanOrEqual(i2Year(A, y).addedKg);
      expect(i2Year(B, y).cumPersonDays).toBeCloseTo(i2Year(A, y).cumPersonDays, 9);
    }
  });

  it("head office books its one-off block the year before first shelf, then a yearly block", () => {
    const k = Math.max(0, Math.min(5, Math.floor(p["I2.T_FIRST"] - 2025) - 1));
    expect(A[k].hqDays).toBe(p["I2.DAYS_HQ_ONEOFF"]);
    for (let i = 0; i < k; i++) expect(A[i].hqDays).toBe(0);
    for (let i = k + 1; i < A.length; i++) expect(A[i].hqDays).toBe(p["I2.DAYS_HQ_ANNUAL"]);
  });

  it("net margin is positive at central values in both versions (demo)", () => {
    expect(i2Year(A, 2030).net).toBeGreaterThan(0);
    expect(i2Year(B, 2030).net).toBeGreaterThan(0);
  });
});

describe("I2 uncertainty", () => {
  it("the seeded generator is reproducible and the triangular draws have the right mean", () => {
    const a = rng(20261015), b = rng(20261015);
    for (let i = 0; i < 5; i++) expect(a()).toBe(b());
    const r = rng(7);
    let sum = 0;
    for (let i = 0; i < 20000; i++) sum += triangular(r(), 0, 0.1, 0.5);
    expect(sum / 20000).toBeCloseTo(0.2, 2);
  });

  it("Monte Carlo is deterministic and orders P10 <= median <= P90", () => {
    const m1 = monteCarlo(v, { rangeBuild: true, year: 2030, draws: 2000 });
    const m2 = monteCarlo(v, { rangeBuild: true, year: 2030, draws: 2000 });
    for (const k of ["pp", "net", "co2kt", "cumPersonDays"] as const) {
      expect(m1.byMetric[k].median).toBe(m2.byMetric[k].median);
      expect(m1.byMetric[k].p10).toBeLessThanOrEqual(m1.byMetric[k].median);
      expect(m1.byMetric[k].median).toBeLessThanOrEqual(m1.byMetric[k].p90);
    }
  });

  it("holding the meat-side effect at 0 narrows the range of the protein split", () => {
    const all = monteCarlo(v, { rangeBuild: true, year: 2030, draws: 3000 }).byMetric.pp;
    const zero = monteCarlo(v, { rangeBuild: true, year: 2030, draws: 3000, fixed: { "I2.MEAT_EFFECT": 0 } }).byMetric.pp;
    expect(zero.p90 - zero.p10).toBeLessThan(all.p90 - all.p10);
  });

  it("the meat-side effect is the largest swing factor of the protein split", () => {
    expect(tornado(v, { rangeBuild: true, year: 2030, metric: "pp" })[0].key).toBe("I2.MEAT_EFFECT");
  });
});
