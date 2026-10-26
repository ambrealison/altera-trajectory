// Trajectory engine: pure functions, no React. Every ratio is recomputed from volumes and protein
// shares, never by adding points, so levers that touch the same products overlap naturally.
//
// Rules (documented in README):
// - Active levers apply one after the other, by ascending number; each operation acts on the
//   current state of that year.
// - Uplifts are shares of 2025 sales, and uplifts on the same category share one potential:
//   +20 % then +20 % gives +36 %, not +44 %. Reductions apply to the current volume.
// - Ramp-up is an S-curve (smoothstep) between startYear and startYear + yearsToFull. 2025 is the
//   reference: no lever has any effect on it.
// - Beyond the extension year (2030), effects keep growing linearly (diffusion assumption, config.json).
// - Store adoption: effect × (1 - storeDependency + storeDependency × adoption).
// - Bands: two more runs with each lever's low and high multipliers, narrowed by lever 3.

import type { Category, Effect, Extension, Hypothesis, Lever, Scenario } from "../data/types";
import { evaluate } from "./expr";

export type ScenarioState = Pick<Scenario, "activeLevers" | "adoption" | "hypotheses">;
export type Band = "mid" | "low" | "high";

export interface PlotSplit {
  "1": number;
  "2": number;
  "3": number;
  "4": number;
  composite: number;
  other: number;
  animal: number;
}

export interface Metrics {
  /** Protein Tracker: plant share of protein sold, 0 to 1. */
  pt: number;
  /** WWF FG1: plant share of protein-rich foods in tonnes of product, composites set apart, 0 to 1. */
  fg1: number;
  proteinTotal: number;
  /** Protein tonnes: plant protein by plot, plant part of composites, rest of plant protein, animal protein. */
  plots: PlotSplit;
  /** FG1 tonnes of product: plant products by plot, and animal products. */
  fg1Plots: PlotSplit;
  /** Tonnes of CO2e. */
  co2: number;
  /** Euros. */
  revenue: number;
}

export interface YearResult extends Metrics {
  year: number;
  volumes: Record<string, number>;
  low: Metrics;
  high: Metrics;
}

interface CatState { t: number; s: number; price: number; u: number; base: number }
type State = Record<string, CatState>;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export const smoothstep = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

/** Share of a lever's full effect reached in a given year. */
export const rampAt = (lever: Pick<Lever, "ramp">, year: number) =>
  smoothstep((year - lever.ramp.startYear + 1) / lever.ramp.yearsToFull);

/** Growth of lever effects after the extension year: 1 until then, then 1 + rate per year. */
export const extensionFactor = (ext: Extension | undefined, year: number) =>
  ext ? 1 + ext.ratePerYear * Math.max(0, year - ext.fromYear) : 1;

export const adoptionFactor = (lever: Pick<Lever, "storeDependency">, adoption: number) =>
  1 - lever.storeDependency + lever.storeDependency * adoption;

/** Raw hypothesis values for a lever (scenario overrides on top of lever defaults). */
export function hypothesisValues(lever: Lever, overrides?: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const h of lever.hypotheses) out[h.id] = overrides?.[h.id] ?? h.value;
  return out;
}

const asFraction = (h: Hypothesis, v: number) => (h.unit === "%" || h.unit === "pts" ? v / 100 : v);

/** Values as the effect expressions see them: percentages become fractions. */
export function expressionVars(lever: Lever, overrides?: Record<string, number>): Record<string, number> {
  const raw = hypothesisValues(lever, overrides);
  const out: Record<string, number> = {};
  for (const h of lever.hypotheses) out[h.id] = asFraction(h, raw[h.id]);
  return out;
}

/** Factor applied to the width of every lever's band: 1, or less when lever 3 is active. */
export function bandTightening(levers: Lever[], state: ScenarioState): number {
  let k = 1;
  for (const l of levers) {
    if (l.tightensUncertainty && state.activeLevers.includes(l.number)) {
      k *= clamp(evaluate(l.tightensUncertainty, expressionVars(l, state.hypotheses[l.id])), 0, 1);
    }
  }
  return k;
}

export function bandMultiplier(lever: Lever, band: Band, tightening: number): number {
  if (band === "low") return 1 - (1 - lever.uncertainty.low) * tightening;
  if (band === "high") return 1 + (lever.uncertainty.high - 1) * tightening;
  return 1;
}

function initialState(categories: Category[]): State {
  const s: State = {};
  for (const c of categories) s[c.id] = { t: c.tonnesProduct, s: c.plantProteinShare, price: c.pricePerKg, u: 0, base: c.tonnesProduct };
  return s;
}

/** Applies one lever at intensity f (ramp × adoption × band multiplier) to the current state. */
function applyEffects(st: State, cats: Record<string, Category>, effects: Effect[], vars: Record<string, number>, f: number) {
  const density = (id: string) => cats[id].proteinPer100g / 100;
  for (const e of effects) {
    if (e.op === "scale") {
      const x = evaluate(e.x, vars) * f;
      let gainProduct = 0, gainProtein = 0;
      for (const id of e.targets) {
        const c = st[id];
        const before = c.t;
        if (x >= 0) {
          // Uplifts are shares of reference sales and share one potential.
          const u = 1 - (1 - c.u) * (1 - Math.min(x, 1));
          c.t += c.base * (u - c.u);
          c.u = u;
        } else {
          c.t *= Math.max(0, 1 + x);
        }
        gainProduct += c.t - before;
        gainProtein += (c.t - before) * density(id);
      }
      if (e.substitution && x > 0) {
        const share = clamp(evaluate(e.substitution.share, vars), 0, 1);
        const protein = e.substitution.basis === "protein";
        let toRemove = (protein ? gainProtein : gainProduct) * share;
        const amount = (id: string) => (protein ? st[id].t * density(id) : st[id].t);
        const pool = e.substitution.from.reduce((a, id) => a + amount(id), 0);
        if (pool > 0) {
          toRemove = Math.min(toRemove, pool);
          for (const id of e.substitution.from) {
            const removed = (toRemove * amount(id)) / pool;
            st[id].t = Math.max(0, st[id].t - (protein ? removed / density(id) : removed));
          }
        }
      }
    } else if (e.op === "transfer") {
      const x = clamp(evaluate(e.x, vars) * f, 0, 1);
      if (x === 0) continue;
      const r = st[e.to];
      let incoming = 0;
      for (const id of e.from) {
        const moved = st[id].t * x;
        st[id].t -= moved;
        incoming += e.basis === "product" ? moved : (moved * density(id)) / density(e.to);
      }
      if (e.receiverPlantShare !== undefined && incoming > 0) {
        const sIn = clamp(evaluate(e.receiverPlantShare, vars), 0, 1);
        r.s = (r.t * r.s + incoming * sIn) / (r.t + incoming);
      }
      r.t += incoming;
    } else if (e.op === "composition") {
      const x = evaluate(e.x, vars) * f;
      for (const id of e.targets) st[id].s = clamp(st[id].s + x, 0, 1);
    } else {
      const x = evaluate(e.x, vars) * f;
      for (const id of e.targets) st[id].price *= Math.max(0, 1 + x);
    }
  }
}

/** Shares of a category's tonnes that are whole FG1 products, of plant and of animal origin. */
export function fg1Shares(c: Category): { plant: number; animal: number } {
  if (c.fg1) return c.fg1;
  const whole = c.wwfGroup === "FG1" && !c.wwfComposite;
  return { plant: whole && c.proteinGroup !== "animal_core" ? 1 : 0, animal: whole && c.proteinGroup === "animal_core" ? 1 : 0 };
}

const emptySplit = (): PlotSplit => ({ "1": 0, "2": 0, "3": 0, "4": 0, composite: 0, other: 0, animal: 0 });

export const co2PerKg = (c: Category, plantShare: number) =>
  c.co2Anchors ? c.co2Anchors.animal + (c.co2Anchors.plant - c.co2Anchors.animal) * plantShare : c.co2PerKg;

function metricsOf(st: State, categories: Category[]): Metrics {
  const plots = emptySplit();
  const fg1Plots = emptySplit();
  let plant = 0, total = 0, co2 = 0, revenue = 0, fg1Plant = 0, fg1Animal = 0;
  for (const c of categories) {
    const v = st[c.id];
    const protein = v.t * (c.proteinPer100g / 100);
    const p = protein * v.s;
    plant += p;
    total += protein;
    plots.animal += protein - p;
    const key = c.plot === null ? "composite" : c.plot === "other_plant" ? "other" : (String(c.plot) as keyof PlotSplit);
    plots[key] += p;
    const f = fg1Shares(c);
    fg1Plant += v.t * f.plant;
    fg1Plots[key] += v.t * f.plant;
    fg1Animal += v.t * f.animal;
    fg1Plots.animal += v.t * f.animal;
    co2 += v.t * co2PerKg(c, v.s);
    revenue += v.t * 1000 * v.price;
  }
  return {
    pt: total > 0 ? plant / total : 0,
    fg1: fg1Plant + fg1Animal > 0 ? fg1Plant / (fg1Plant + fg1Animal) : 0,
    proteinTotal: total,
    plots,
    fg1Plots,
    co2,
    revenue,
  };
}

export interface Model {
  categories: Category[];
  levers: Lever[];
  extension?: Extension;
}

/** State of every category in one year, for one band. */
export function runYear(model: Model, state: ScenarioState, year: number, band: Band = "mid", only?: number) {
  const cats = Object.fromEntries(model.categories.map((c) => [c.id, c]));
  const st = initialState(model.categories);
  const tightening = bandTightening(model.levers, state);
  const active = [...model.levers]
    .filter((l) => (only === undefined ? state.activeLevers.includes(l.number) : l.number === only))
    .sort((a, b) => a.number - b.number);
  for (const l of active) {
    const f = rampAt(l, year) * extensionFactor(model.extension, year) * adoptionFactor(l, state.adoption) * bandMultiplier(l, band, tightening);
    if (f > 0 && l.effects.length) applyEffects(st, cats, l.effects, expressionVars(l, state.hypotheses[l.id]), f);
  }
  return { st, metrics: metricsOf(st, model.categories) };
}

export function baseline(model: Model): Metrics {
  return metricsOf(initialState(model.categories), model.categories);
}

export function simulate(categories: Category[], levers: Lever[], scenario: ScenarioState, opts: { horizon: number; baseYear?: number; extension?: Extension }): YearResult[] {
  const model = { categories, levers, extension: opts.extension };
  const from = opts.baseYear ?? 2025;
  const out: YearResult[] = [];
  for (let year = from; year <= opts.horizon; year++) {
    const mid = runYear(model, scenario, year, "mid");
    const volumes = Object.fromEntries(Object.entries(mid.st).map(([id, v]) => [id, v.t]));
    out.push({
      year,
      ...mid.metrics,
      volumes,
      low: runYear(model, scenario, year, "low").metrics,
      high: runYear(model, scenario, year, "high").metrics,
    });
  }
  return out;
}
