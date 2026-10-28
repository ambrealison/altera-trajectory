// The integrated aisle placement dossier (lever 12) reads the Altera register, the values changed on
// its page, and lever 12's own assumptions, which stay shared with the trajectory screens.
import { useDeferredValue, useMemo } from "react";
import { dataset, leverByNumber } from "../data";
import type { I2Values } from "../data/types";
import { hypothesisValues } from "../engine/simulate";
import { centralParams, monteCarlo, runI2, type I2Key, type MonteCarlo } from "../engine/i2";
import { useApp } from "./store";

/** Register keys driven by lever 12's assumptions (sliders shared with the lever card). */
export const LINKED: Partial<Record<I2Key, { hyp: string; toModel: (v: number) => number; toLever: (v: number) => number }>> = {
  "I2.UPLIFT": { hyp: "uplift", toModel: (v) => v / 100, toLever: (v) => v * 100 },
  "I2.DISPL": { hyp: "displacement", toModel: (v) => v, toLever: (v) => v },
  "I2.MEAT_EFFECT": { hyp: "meatEffect", toModel: (v) => v / 100, toLever: (v) => v * 100 },
};

/** Register with the page's values as centrals; a central outside the register range widens it. */
export function adjusted(base: I2Values, central: Record<string, number>): I2Values {
  const out: I2Values = {};
  for (const [k, v] of Object.entries(base)) {
    const c = central[k] ?? v.central;
    out[k] = { ...v, central: c, low: Math.min(v.low, c), high: Math.max(v.high, c) };
  }
  return out;
}

export function useI2() {
  const { state } = useApp();
  const lever = leverByNumber(12);
  const h = hypothesisValues(lever, state.hypotheses[lever.id]);
  const overrides = state.i2.overrides;
  return useMemo(() => {
    const central: Record<string, number> = { ...overrides };
    for (const [k, link] of Object.entries(LINKED)) central[k] = link!.toModel(h[link!.hyp]);
    const values = adjusted(dataset.i2, central);
    const params = centralParams(values);
    const rowsA = runI2(params, { rangeBuild: false });
    const rowsB = runI2(params, { rangeBuild: true });
    return { values, params, rowsA, rowsB, rows: state.i2.rangeBuild ? rowsB : rowsA, rangeBuild: state.i2.rangeBuild, changed: Object.keys(overrides).length };
    // h is rebuilt on every render; its values are what matter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrides, state.i2.rangeBuild, h.uplift, h.displacement, h.meatEffect]);
}

/** Monte Carlo on the current register (deferred, so that sliders stay responsive). */
export function useI2MonteCarlo(values: I2Values, rangeBuild: boolean, year: number, meatZero = false): MonteCarlo {
  const v = useDeferredValue(values);
  return useMemo(
    () => monteCarlo(v, { rangeBuild, year, fixed: meatZero ? { "I2.MEAT_EFFECT": 0 } : undefined }),
    [v, rangeBuild, year, meatZero],
  );
}
