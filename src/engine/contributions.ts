// Per-lever contributions for the waterfall. Each lever's isolated effect is the lever alone on the
// reference; contributions are those effects scaled so that they add up to the combined effect.
// The gap between the sum of isolated effects and the combined effect is the overlap between levers.

import { baseline, runYear, type Metrics, type Model, type ScenarioState } from "./simulate";

export type MetricKey = "pt" | "fg1";

export interface Range { mid: number; low: number; high: number }

/** Effect of one lever alone at a given year, in ratio units (0.01 = 1 point). */
export function isolatedEffect(model: Model, state: ScenarioState, leverNumber: number, year: number, metric: MetricKey = "pt"): Range {
  const ref = baseline(model)[metric];
  const at = (band: "mid" | "low" | "high") => runYear(model, state, year, band, leverNumber).metrics[metric] - ref;
  const a = at("low"), b = at("high");
  return { mid: at("mid"), low: Math.min(a, b), high: Math.max(a, b) };
}

export interface Contribution { number: number; isolated: number; value: number }

export interface Contributions {
  base: number;
  final: number;
  combined: number;
  sumIsolated: number;
  /** Sum of isolated effects minus the combined effect. Positive when levers overlap. */
  overlap: number;
  steps: Contribution[];
}

export function contributions(model: Model, state: ScenarioState, year: number, metric: MetricKey = "pt"): Contributions {
  const base = baseline(model)[metric];
  const final = runYear(model, state, year).metrics[metric];
  const combined = final - base;
  const active = [...state.activeLevers].sort((a, b) => a - b);
  const iso = active.map((n) => ({ number: n, isolated: runYear(model, state, year, "mid", n).metrics[metric] - base }));
  const sumIsolated = iso.reduce((a, c) => a + c.isolated, 0);
  const scale = sumIsolated !== 0 ? combined / sumIsolated : 0;
  return {
    base,
    final,
    combined,
    sumIsolated,
    overlap: sumIsolated - combined,
    steps: iso.map((c) => ({ ...c, value: c.isolated * scale })),
  };
}

/** Change of a metric between the reference and a year, as a share of the reference. */
export const relativeChange = (ref: Metrics, now: Metrics, key: "co2" | "revenue") => (now[key] - ref[key]) / ref[key];
