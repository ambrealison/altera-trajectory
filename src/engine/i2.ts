// Integrated aisle placement (lever 12, "I2"): the Altera quarterly model, formula for formula as in
// its workbook (sheet I2_Model). Plant-based meat alternatives move into a bay beside the meat while
// the plant shelf stays; every result is the difference to today's layout.
//
// Version A keeps today's range; version B adds the range build (more products, better taste).
// The workbook stops in 2030; the same quarterly loop runs here to 2035.
import type { I2Values } from "../data/types";

export const I2_KEYS = [
  "G.R0", "G.POOL_T", "I2.V0_T", "G.PBM_GROWTH", "I2.UPLIFT", "I2.FID", "I2.RET", "I2.W_SCOPE", "I2.ALPHA",
  "I2.T_FIRST", "I2.ROLLOUT_Y", "I2.DISPL", "G.PBM_PROT", "G.MEAT_PROT", "G.PBM_EUR_FR", "G.PBM_KG_FR", "G.VAT",
  "G.PBM_GM", "G.MEAT_PRICE_HT", "G.MEAT_GM", "G.N_STORES_SCOPE", "I2.H_STORE_SETUP", "I2.H_STORE_WEEK",
  "I2.DAYS_HQ_ONEOFF", "I2.DAYS_HQ_ANNUAL", "I2.MAT_EUR_STORE", "G.LABOUR_EUR_H", "G.HQ_EUR_DAY", "G.E_PBM",
  "G.E_MEAT", "I2.MEAT_EFFECT", "I2.MEAT_POOL_T", "RG.ETA", "RG.TASTE", "RG.T_FIRST", "RG.ROLLOUT_Y", "RG.N_NOW",
  "RG.N_TARGET",
] as const;
export type I2Key = (typeof I2_KEYS)[number];
export type I2Params = Record<I2Key, number>;

export interface I2Options {
  /** Version B: range build and better taste (RG.ON = 1 in the workbook). */
  rangeBuild: boolean;
  /** Last year simulated (2030 in the workbook). */
  toYear?: number;
}

export interface I2Year {
  year: number;
  /** Plant-based meat sold in addition, kg. */
  addedKg: number;
  /** Plant protein added and animal protein change, kg. */
  dP: number;
  dA: number;
  /** Animal protein change split into its two channels, kg. */
  dASubstitution: number;
  dAMeatSide: number;
  /** Change in the Protein Tracker plant share, percentage points. */
  pp: number;
  /** Change in meat volume, kg (negative when meat is lost). */
  meatKg: number;
  marginPlant: number;
  marginMeat: number;
  cost: number;
  net: number;
  co2kt: number;
  storesLive: number;
  newStores: number;
  setupH: number;
  upkeepH: number;
  hqDays: number;
  personDays: number;
  cumPersonDays: number;
  cumCost: number;
  /** Plant-meat volume the lever acts on (with growth and range build), t a year. */
  baseT: number;
}

const smooth = (x: number) => 3 * x * x - 2 * x * x * x;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export const centralParams = (v: I2Values): I2Params =>
  Object.fromEntries(I2_KEYS.map((k) => [k, v[k].central])) as I2Params;

export function runI2(p: I2Params, opts: I2Options): I2Year[] {
  const toYear = opts.toYear ?? 2035;
  const nq = (toYear - 2024) * 4;
  const t = (q: number) => 2025 + (q + 0.5) / 4; // mid-quarter, q = 0 is Q1 2025

  const live: number[] = [];
  const fresh: number[] = [];
  for (let q = 0; q < nq; q++) {
    const x = clamp01((t(q) - p["I2.T_FIRST"]) / p["I2.ROLLOUT_Y"]);
    live[q] = p["I2.ALPHA"] * smooth(x);
    fresh[q] = q === 0 ? live[0] : live[q] - live[q - 1];
  }
  // Cohorts: the stores that went live in quarter s fade by RET a year after their first six months.
  const eff: number[] = [];
  for (let q = 0; q < nq; q++) {
    let e = 0;
    for (let s = 0; s <= q; s++) e += fresh[s] * Math.pow(p["I2.RET"], Math.max(0, t(q) - t(s) - 0.5));
    eff[q] = e;
  }
  const rangeFactor = (q: number) => {
    if (!opts.rangeBuild) return 1;
    const S = smooth(clamp01((t(q) - p["RG.T_FIRST"]) / p["RG.ROLLOUT_Y"]));
    return (1 + (Math.pow(p["RG.N_TARGET"] / p["RG.N_NOW"], p["RG.ETA"]) - 1) * S) * (1 + p["RG.TASTE"] * S);
  };
  const volume = (q: number) => p["I2.V0_T"] * 1000 * Math.pow(1 + p["G.PBM_GROWTH"], t(q) - 2025) * rangeFactor(q);

  const k = Math.max(0, Math.min(5, Math.floor(p["I2.T_FIRST"] - 2025) - 1));
  const plantPriceHT = p["G.PBM_EUR_FR"] / p["G.PBM_KG_FR"] / (1 + p["G.VAT"]);
  const pool = p["G.POOL_T"] * 1000;
  const out: I2Year[] = [];
  let cumPD = 0;
  let cumCost = 0;
  for (let y = 2025; y <= toYear; y++) {
    const qs = [0, 1, 2, 3].map((i) => (y - 2025) * 4 + i);
    const addedKg = qs.reduce((s, q) => s + (volume(q) / 4) * eff[q] * p["I2.UPLIFT"] * p["I2.FID"] * p["I2.W_SCOPE"], 0);
    const liveSum = qs.reduce((s, q) => s + live[q], 0);
    const dP = (addedKg * p["G.PBM_PROT"]) / 100;
    const dASubstitution = -p["I2.DISPL"] * dP;
    const dAMeatSide = (p["I2.MEAT_EFFECT"] * p["I2.MEAT_POOL_T"] * 1000 * liveSum) / 4 * p["I2.W_SCOPE"];
    const dA = dASubstitution + dAMeatSide;
    const pp = 100 * ((p["G.R0"] * pool + dP) / (pool + dP + dA) - p["G.R0"]);
    const meatKg = dA / (p["G.MEAT_PROT"] / 100);
    const marginPlant = addedKg * plantPriceHT * p["G.PBM_GM"];
    const marginMeat = meatKg * p["G.MEAT_PRICE_HT"] * p["G.MEAT_GM"];
    const n = p["G.N_STORES_SCOPE"];
    const newStores = qs.reduce((s, q) => s + fresh[q], 0) * n;
    const setupH = newStores * p["I2.H_STORE_SETUP"];
    const upkeepH = liveSum * n * 13 * p["I2.H_STORE_WEEK"];
    const i = y - 2025;
    const hqDays = i === k ? p["I2.DAYS_HQ_ONEOFF"] : i > k ? p["I2.DAYS_HQ_ANNUAL"] : 0;
    const personDays = (setupH + upkeepH) / 7.5 + hqDays;
    const cost = (setupH + upkeepH) * p["G.LABOUR_EUR_H"] + hqDays * p["G.HQ_EUR_DAY"] + newStores * p["I2.MAT_EUR_STORE"];
    cumPD += personDays;
    cumCost += cost;
    out.push({
      year: y, addedKg, dP, dA, dASubstitution, dAMeatSide, pp, meatKg, marginPlant, marginMeat, cost,
      net: marginPlant + marginMeat - cost,
      co2kt: (addedKg * p["G.E_PBM"] + meatKg * p["G.E_MEAT"]) / 1e6,
      storesLive: live[qs[3]] * n, newStores, setupH, upkeepH, hqDays, personDays,
      cumPersonDays: cumPD, cumCost,
      baseT: qs.reduce((s, q) => s + volume(q), 0) / 4 / 1000,
    });
  }
  return out;
}

export const i2Year = (rows: I2Year[], year: number) => rows.find((r) => r.year === year) ?? rows[rows.length - 1];

/** One step of the protein split calculation, as in the workbook's Protein_split sheet. */
export function splitSteps(p: I2Params, r: I2Year) {
  const T = p["G.POOL_T"];
  const P0 = p["G.R0"] * T;
  const A0 = T - P0;
  const dP = r.dP / 1000;
  const dA = r.dA / 1000;
  const after = T + dP + dA;
  const share = (P0 + dP) / after;
  const need = (0.01 * T) / (1 - p["G.R0"] - 0.01);
  return { T, R0: p["G.R0"], P0, A0, baseT: r.baseT, addedT: r.addedKg / 1000, dP, dA, after, plantAfter: P0 + dP, share, pp: r.pp, need, multiple: dP > 0 ? need / dP : Infinity };
}

// ---------------------------------------------------------------- uncertainty

/** Seeded generator (mulberry32), so a page shows the same draws on every visit. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Inverse CDF of the triangular distribution on [lo, hi] with mode c. */
export function triangular(u: number, lo: number, c: number, hi: number) {
  if (hi <= lo) return c;
  const f = (c - lo) / (hi - lo);
  return u < f ? lo + Math.sqrt(u * (hi - lo) * (c - lo)) : hi - Math.sqrt((1 - u) * (hi - lo) * (hi - c));
}

export type I2Metric = "pp" | "net" | "co2kt" | "cumPersonDays";
export const I2_METRICS: I2Metric[] = ["pp", "net", "co2kt", "cumPersonDays"];

export interface Spread { p10: number; median: number; p90: number; belowZero: number; mean: number }
export interface MonteCarlo { draws: number; byMetric: Record<I2Metric, Spread>; samples: Record<I2Metric, Float64Array> }

const quantile = (sorted: Float64Array, q: number) => {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
};

/** Triangular draws on every input's low, central and high value (10 000 draws, seed 20261015 by
 *  default, as in the Altera model). `fixed` holds inputs kept at a given value in every draw. */
export function monteCarlo(
  v: I2Values,
  opts: I2Options & { year: number; draws?: number; seed?: number; fixed?: Partial<I2Params>; overrides?: Partial<I2Params> },
): MonteCarlo {
  const draws = opts.draws ?? 10000;
  const rand = rng(opts.seed ?? 20261015);
  const samples = Object.fromEntries(I2_METRICS.map((m) => [m, new Float64Array(draws)])) as Record<I2Metric, Float64Array>;
  const base = { ...centralParams(v), ...opts.overrides };
  for (let d = 0; d < draws; d++) {
    const p = { ...base };
    for (const k of I2_KEYS) {
      const u = rand();
      const r = v[k];
      if (opts.overrides && k in opts.overrides) continue;
      p[k] = triangular(u, r.low, r.central, r.high);
    }
    if (opts.fixed) Object.assign(p, opts.fixed);
    const row = i2Year(runI2(p, { ...opts, toYear: opts.year }), opts.year);
    for (const m of I2_METRICS) samples[m][d] = row[m];
  }
  const byMetric = {} as Record<I2Metric, Spread>;
  for (const m of I2_METRICS) {
    const s = samples[m];
    const sorted = Float64Array.from(s).sort();
    let below = 0;
    let sum = 0;
    for (const x of s) {
      if (x < 0) below++;
      sum += x;
    }
    byMetric[m] = { p10: quantile(sorted, 0.1), median: quantile(sorted, 0.5), p90: quantile(sorted, 0.9), belowZero: below / draws, mean: sum / draws };
  }
  return { draws, byMetric, samples };
}

export interface TornadoRow { key: I2Key; atLow: number; atHigh: number; swing: number }

/** One input at a time to its low and then its high value, everything else central. */
export function tornado(v: I2Values, opts: I2Options & { year: number; metric: I2Metric; base?: I2Params; top?: number }): TornadoRow[] {
  const base = opts.base ?? centralParams(v);
  const at = (k: I2Key, x: number) => i2Year(runI2({ ...base, [k]: x }, { ...opts, toYear: opts.year }), opts.year)[opts.metric];
  const rows = I2_KEYS.filter((k) => v[k].high > v[k].low)
    .filter((k) => opts.rangeBuild || !k.startsWith("RG."))
    .map((k) => {
      const atLow = at(k, v[k].low);
      const atHigh = at(k, v[k].high);
      return { key: k, atLow, atHigh, swing: Math.abs(atHigh - atLow) };
    })
    .sort((a, b) => b.swing - a.swing);
  return rows.slice(0, opts.top ?? 8);
}
