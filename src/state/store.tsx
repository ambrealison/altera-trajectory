// Scenario store: one reducer, the URL hash kept in sync, and localStorage for the language, the
// guided tour and the last scenario (each access wrapped, the app works without it).
import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from "react";
import { config, levers, model, scenarios } from "../data";
import type { Lang } from "../data/types";
import { baseline, runYear, simulate, type Metrics, type YearResult } from "../engine/simulate";
import { contributions, isolatedEffect, type Contributions, type Range } from "../engine/contributions";
import { fromHash, matchingPreset, presetFields, toHash, type Snapshot } from "./url";
import type { AppState, MetricKey, Pinned, ScenarioFields, ScreenId } from "./types";

const KEY = "altera-trajectory:";
export const storage = {
  get(k: string): string | null {
    try { return window.localStorage.getItem(KEY + k); } catch { return null; }
  },
  set(k: string, v: string) {
    try { window.localStorage.setItem(KEY + k, v); } catch { /* private mode or blocked storage */ }
  },
};

const DEFAULT_PRESET = "committed";

function initialState(): AppState {
  const fromUrl = fromHash(window.location.hash);
  // the last scenario comes back without its horizon, indicator or screen: arrivals start on the defaults
  const last = fromUrl ? null : fromHash(storage.get("last") ?? "");
  const fromLast = last ? { ...last, horizon: undefined, metric: undefined, screen: undefined } : null;
  const snap = fromUrl ?? fromLast ?? {};
  const query = new URLSearchParams(window.location.search).get("lang");
  const lang: Lang = snap.lang ?? (query === "en" || query === "fr" ? query : null) ?? ((storage.get("lang") as Lang | null) ?? "fr");
  const fields: ScenarioFields = { ...presetFields(DEFAULT_PRESET), ...Object.fromEntries(Object.entries(snap).filter(([, v]) => v !== undefined)) };
  const screen: ScreenId = fromUrl?.screen ?? "baseline";
  return {
    ...fields,
    lang: lang === "en" ? "en" : "fr",
    screen,
    visited: [screen],
    chartView: "lever",
    leverView: "list",
    drawer: null,
    pinned: null,
    cover: true,
    tour: null,
  };
}

export type Action =
  | { type: "lang"; lang: Lang }
  | { type: "go"; screen: ScreenId }
  | { type: "metric"; metric: MetricKey }
  | { type: "horizon"; horizon: number }
  | { type: "adoption"; adoption: number }
  | { type: "toggleLever"; number: number }
  | { type: "hypothesis"; lever: string; id: string; value: number }
  | { type: "resetLever"; lever: string }
  | { type: "preset"; id: string }
  | { type: "chartView"; view: AppState["chartView"] }
  | { type: "leverView"; view: AppState["leverView"] }
  | { type: "drawer"; lever: string | null }
  | { type: "pin" }
  | { type: "unpin" }
  | { type: "tour"; step: number | null }
  | { type: "enter" }
  | { type: "load"; snap: Partial<Snapshot> };

function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case "lang": return { ...s, lang: a.lang };
    case "go": return { ...s, screen: a.screen, visited: s.visited.includes(a.screen) ? s.visited : [...s.visited, a.screen] };
    case "metric": return { ...s, metric: a.metric };
    case "horizon": return { ...s, horizon: a.horizon };
    case "adoption": return { ...s, adoption: a.adoption };
    case "toggleLever": {
      const on = s.activeLevers.includes(a.number);
      const activeLevers = on ? s.activeLevers.filter((n) => n !== a.number) : [...s.activeLevers, a.number].sort((x, y) => x - y);
      return { ...s, activeLevers };
    }
    case "hypothesis": {
      const lever = levers.find((l) => l.id === a.lever);
      const hyp = lever?.hypotheses.find((h) => h.id === a.id);
      if (!hyp) return s;
      const value = Math.min(hyp.max, Math.max(hyp.min, a.value));
      return { ...s, hypotheses: { ...s.hypotheses, [a.lever]: { ...s.hypotheses[a.lever], [a.id]: value } } };
    }
    case "resetLever": {
      const preset = s.preset ? presetFields(s.preset).hypotheses[a.lever] : undefined;
      const hypotheses = { ...s.hypotheses };
      if (preset) hypotheses[a.lever] = { ...preset };
      else delete hypotheses[a.lever];
      return { ...s, hypotheses };
    }
    case "preset": {
      const p = presetFields(a.id);
      return { ...s, preset: p.preset, activeLevers: p.activeLevers, adoption: p.adoption, hypotheses: p.hypotheses };
    }
    case "chartView": return { ...s, chartView: a.view };
    case "leverView": return { ...s, leverView: a.view };
    case "drawer": return { ...s, drawer: a.lever };
    case "pin": {
      const fields: ScenarioFields = { preset: s.preset, activeLevers: s.activeLevers, adoption: s.adoption, hypotheses: s.hypotheses, horizon: s.horizon, metric: s.metric };
      return { ...s, pinned: { preset: matchingPreset(fields), fields } satisfies Pinned };
    }
    case "unpin": return { ...s, pinned: null };
    case "tour": return { ...s, tour: a.step };
    case "enter": {
      // the guided tour starts by itself on the first visit only
      const seen = storage.get("tour") === "off" || storage.get("tour") === "seen";
      return { ...s, cover: false, tour: seen ? null : 0 };
    }
    case "load": {
      const { screen, lang, ...fields } = a.snap;
      const next = { ...s, ...fields, lang: lang ?? s.lang };
      return screen ? reducer(next, { type: "go", screen }) : next;
    }
  }
}

const Ctx = createContext<{ state: AppState; dispatch: Dispatch<Action> } | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  useEffect(() => {
    document.documentElement.lang = state.lang;
    document.title = `Altera.ai · ${config.title[state.lang]}`;
    storage.set("lang", state.lang);
  }, [state.lang]);

  useEffect(() => {
    const hash = toHash({ ...state, lang: state.lang });
    if (window.location.hash !== hash) window.history.replaceState(null, "", hash);
    storage.set("last", hash);
  }, [state]);

  useEffect(() => {
    const onHash = () => {
      const snap = fromHash(window.location.hash);
      if (snap) dispatch({ type: "load", snap });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
}

export const REFERENCE: Metrics = baseline(model);

export interface Results {
  series: YearResult[];
  final: YearResult;
  contrib: Contributions;
  isolated: Record<number, Range>;
  /** Each lever alone at the horizon: CO2 and revenue changes against 2025 (shares and tonnes). */
  leverImpact: Record<number, { co2: number; co2t: number; revenue: number }>;
  pinnedSeries: YearResult[] | null;
}

const scenarioOf = (f: Pick<ScenarioFields, "activeLevers" | "adoption" | "hypotheses">) => ({ activeLevers: f.activeLevers, adoption: f.adoption, hypotheses: f.hypotheses });

/** Every figure the screens need, recomputed from volumes whenever the scenario changes. */
export function useResults(): Results {
  const { state } = useApp();
  const { activeLevers, adoption, hypotheses, horizon, metric, pinned } = state;
  return useMemo(() => {
    const scen = scenarioOf({ activeLevers, adoption, hypotheses });
    const series = simulate(model.categories, model.levers, scen, { horizon, baseYear: config.baseYear, extension: config.extension });
    const final = series[series.length - 1];
    const isolated: Record<number, Range> = {};
    const leverImpact: Results["leverImpact"] = {};
    for (const l of levers) {
      isolated[l.number] = isolatedEffect(model, scen, l.number, horizon, metric);
      const m = runYear(model, scen, horizon, "mid", l.number).metrics;
      leverImpact[l.number] = { co2: m.co2 / REFERENCE.co2 - 1, co2t: m.co2 - REFERENCE.co2, revenue: m.revenue / REFERENCE.revenue - 1 };
    }
    return {
      series,
      final,
      contrib: contributions(model, scen, horizon, metric),
      isolated,
      leverImpact,
      pinnedSeries: pinned ? simulate(model.categories, model.levers, scenarioOf(pinned.fields), { horizon, baseYear: config.baseYear, extension: config.extension }) : null,
    };
  }, [activeLevers, adoption, hypotheses, horizon, metric, pinned]);
}

export { scenarios };
