import type { Lang } from "../data/types";

export type ScreenId = "baseline" | "levers" | "trajectory" | "data";
export const SCREENS: ScreenId[] = ["baseline", "levers", "trajectory", "data"];
export type MetricKey = "pt" | "fg1";

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
  pinned: Pinned | null;
  tour: number | null;
}
