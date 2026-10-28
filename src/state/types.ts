import type { Lang } from "../data/types";

export type ScreenId = "baseline" | "levers" | "trajectory" | "data";
export const SCREENS: ScreenId[] = ["baseline", "levers", "trajectory", "data"];
export type MetricKey = "pt" | "fg1";
/** Indicator shown by the trajectory charts: protein split, CO2 (with the scope 3 target) or revenue. */
export type KpiKey = "split" | "co2" | "revenue";
export const KPIS: KpiKey[] = ["split", "co2", "revenue"];

/** A scenario the user saved under a name (kept in the browser, shareable as a link). */
export interface CustomScenario {
  id: string;
  name: string;
  activeLevers: number[];
  adoption: number;
  hypotheses: Record<string, Record<string, number>>;
}

export interface ScenarioFields {
  /** Preset the scenario started from, used to highlight it and to reset assumptions. */
  preset: string | null;
  activeLevers: number[];
  adoption: number;
  /** Assumption values that differ from the lever defaults. */
  hypotheses: Record<string, Record<string, number>>;
  horizon: number;
  metric: MetricKey;
}

export interface Pinned {
  /** Preset the pinned scenario matched exactly, null for a custom scenario. */
  preset: string | null;
  fields: ScenarioFields;
}

export interface AppState extends ScenarioFields {
  /** Cover page, shown on every arrival until "Let's go". */
  cover: boolean;
  lang: Lang;
  screen: ScreenId;
  visited: ScreenId[];
  chartView: "lever" | "time";
  leverView: "list" | "matrix";
  drawer: string | null;
  /** Full page of a lever (its id), shown in place of the current screen. */
  leverPage: string | null;
  leverTab: string;
  kpi: KpiKey;
  customs: CustomScenario[];
  /** Saved scenario currently loaded (it may have been changed since). */
  custom: string | null;
  /** Name carried by a shared link, offered for saving. */
  sharedName: string | null;
  /** Integrated aisle placement dossier: version and register values changed on its page. */
  i2: { rangeBuild: boolean; overrides: Record<string, number> };
  pinned: Pinned | null;
  tour: number | null;
  /** Which guided tour runs: "welcome", a screen id, "lever" or "i2". */
  tourId: string;
}
