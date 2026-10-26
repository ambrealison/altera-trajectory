// Realism check: average yearly gain of the scenario against the pace observed in the Netherlands
// (1.7 points in two years). The thresholds are fixed and never tuned to suit a scenario.

import type { GuardrailState } from "../data/types";

export const WELL_ABOVE_MULTIPLE = 1.5;

export interface Guardrail {
  /** Average gain in points per year. */
  annualGain: number;
  /** Annual gain divided by the observed pace. */
  multiple: number;
  state: GuardrailState;
}

export function guardrail(baseRatio: number, ratio: number, baseYear: number, year: number, pointsPerYear: number): Guardrail {
  const years = Math.max(1, year - baseYear);
  const annualGain = ((ratio - baseRatio) * 100) / years;
  const multiple = annualGain / pointsPerYear;
  // Thresholds are inclusive: exactly 1.5 times the pace is still "above".
  const eps = 1e-9;
  const state: GuardrailState = multiple > WELL_ABOVE_MULTIPLE + eps ? "well_above" : multiple > 1 + eps ? "above" : "within";
  return { annualGain, multiple, state };
}
