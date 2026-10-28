// Scenario store: one reducer, the URL hash kept in sync, and localStorage for the language, the
// guided tour and the last scenario (each access wrapped, the app works without it).
import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from "react";
import { config, levers, model, scenarios } from "../data";
import type { Lang } from "../data/types";
import { baseline, runYear, simulate, type Metrics, type YearResult } from "../engine/simulate";
import { contributionsMulti, isolatedEffect, type Contributions, type Range } from "../engine/contributions";
import { clean, fromHash, matchingPreset, presetFields, sameHypotheses, toHash, type Snapshot } from "./url";
import type { AppState, CustomScenario, KpiKey, MetricKey, Pinned, ScenarioFields, ScreenId } from "./types";

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

function loadCustoms(): CustomScenario[] {
  try {
    const raw = JSON.parse(storage.get("customs") ?? "[]");
    if (!Array.isArray(raw)) return [];
    const valid = new Set(levers.map((l) => l.number));
    return raw
      .filter((c) => c && typeof c.id === "string" && typeof c.name === "string" && Array.isArray(c.activeLevers))
      .map((c) => ({ id: c.id, name: String(c.name).slice(0, 60), activeLevers: c.activeLevers.filter((n: number) => valid.has(n)), adoption: Number(c.adoption) || 0, hypotheses: clean(c.hypotheses ?? {}) }));
  } catch {
    return [];
  }
}

/** True when the scenario fields equal the saved scenario. */
export function sameAsCustom(f: Pick<ScenarioFields, "activeLevers" | "adoption" | "hypotheses">, c: CustomScenario) {
  return f.adoption === c.adoption && f.activeLevers.length === c.activeLevers.length && f.activeLevers.every((n, i) => n === c.activeLevers[i]) && sameHypotheses(f.hypotheses, c.hypotheses);
}

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
  const customs = loadCustoms();
  const shared = fromUrl?.customName ?? null;
  const match = shared ? customs.find((c) => c.name === shared && sameAsCustom(fields, c)) : undefined;
  return {
    ...fields,
    preset: shared ? null : fields.preset,
    lang: lang === "en" ? "en" : "fr",
    screen,
    visited: [screen],
    chartView: "lever",
    leverView: "list",
    drawer: null,
    pinned: null,
    cover: !fromUrl?.leverPage,
    tour: null,
    tourId: "welcome",
    leverPage: fromUrl?.leverPage ?? null,
    leverTab: fromUrl?.leverTab ?? "summary",
    kpi: fromUrl?.kpi ?? "split",
    customs,
    custom: match?.id ?? null,
    sharedName: shared && !match ? shared : null,
    i2: { rangeBuild: true, overrides: {} },
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
  | { type: "tour"; step: number | null; id?: string }
  | { type: "enter" }
  | { type: "load"; snap: Partial<Snapshot> }
  | { type: "openLever"; lever: string; tab?: string }
  | { type: "closeLever" }
  | { type: "leverTab"; tab: string }
  | { type: "kpi"; kpi: KpiKey }
  | { type: "saveCustom"; name: string }
  | { type: "updateCustom"; id: string }
  | { type: "renameCustom"; id: string; name: string }
  | { type: "deleteCustom"; id: string }
  | { type: "loadCustom"; id: string }
  | { type: "i2Version"; rangeBuild: boolean }
  | { type: "i2Param"; key: string; value: number | null }
  | { type: "i2Reset" };

const fieldsOf = (s: AppState) => ({ activeLevers: s.activeLevers, adoption: s.adoption, hypotheses: clean(s.hypotheses) });
const newId = () => `c${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case "lang": return { ...s, lang: a.lang };
    case "go": return { ...s, screen: a.screen, leverPage: null, visited: s.visited.includes(a.screen) ? s.visited : [...s.visited, a.screen] };
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
      return { ...s, preset: p.preset, custom: null, sharedName: null, activeLevers: p.activeLevers, adoption: p.adoption, hypotheses: p.hypotheses };
    }
    case "openLever": return { ...s, drawer: null, leverPage: a.lever, leverTab: a.tab ?? "summary" };
    case "closeLever": return { ...s, leverPage: null };
    case "leverTab": return { ...s, leverTab: a.tab };
    case "kpi": return { ...s, kpi: a.kpi };
    case "saveCustom": {
      const c: CustomScenario = { id: newId(), name: a.name.trim().slice(0, 60) || "?", ...fieldsOf(s) };
      return { ...s, customs: [...s.customs, c], custom: c.id, preset: null, sharedName: null };
    }
    case "updateCustom": return { ...s, customs: s.customs.map((c) => (c.id === a.id ? { ...c, ...fieldsOf(s) } : c)), custom: a.id, preset: null };
    case "renameCustom": return { ...s, customs: s.customs.map((c) => (c.id === a.id ? { ...c, name: a.name.trim().slice(0, 60) || c.name } : c)) };
    case "deleteCustom": return { ...s, customs: s.customs.filter((c) => c.id !== a.id), custom: s.custom === a.id ? null : s.custom };
    case "loadCustom": {
      const c = s.customs.find((x) => x.id === a.id);
      if (!c) return s;
      return { ...s, custom: c.id, preset: null, sharedName: null, activeLevers: [...c.activeLevers], adoption: c.adoption, hypotheses: structuredClone(c.hypotheses) };
    }
    case "i2Version": return { ...s, i2: { ...s.i2, rangeBuild: a.rangeBuild } };
    case "i2Param": {
      const overrides = { ...s.i2.overrides };
      if (a.value === null) delete overrides[a.key];
      else overrides[a.key] = a.value;
      return { ...s, i2: { ...s.i2, overrides } };
    }
    case "i2Reset": return { ...s, i2: { ...s.i2, overrides: {} } };
    case "chartView": return { ...s, chartView: a.view };
    case "leverView": return { ...s, leverView: a.view };
    case "drawer": return { ...s, drawer: a.lever };
    case "pin": {
      const fields: ScenarioFields = { preset: s.preset, activeLevers: s.activeLevers, adoption: s.adoption, hypotheses: s.hypotheses, horizon: s.horizon, metric: s.metric };
      return { ...s, pinned: { preset: matchingPreset(fields), fields } satisfies Pinned };
    }
    case "unpin": return { ...s, pinned: null };
    case "tour": return { ...s, tour: a.step, tourId: a.id ?? s.tourId };
    case "enter": {
      // the guided tour starts by itself on the first visit only
      const seen = storage.get("tour") === "off" || storage.get("tour") === "seen";
      return { ...s, cover: false, tour: seen ? null : 0, tourId: "welcome" };
    }
    case "load": {
      const { screen, lang, leverPage, leverTab, kpi, customName, ...fields } = a.snap;
      let next: AppState = { ...s, ...fields, lang: lang ?? s.lang, kpi: kpi ?? "split" };
      if (screen && screen !== s.screen) next = reducer(next, { type: "go", screen });
      next = { ...next, leverPage: leverPage ?? null, leverTab: leverTab ?? (leverPage === s.leverPage ? s.leverTab : "summary"), cover: leverPage ? false : next.cover };
      if (customName !== undefined && customName !== null) {
        const match = next.customs.find((c) => c.name === customName && sameAsCustom(next, c));
        next = { ...next, preset: null, custom: match?.id ?? null, sharedName: match ? null : customName };
      }
      return next;
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
    const custom = state.customs.find((c) => c.id === state.custom);
    const name = custom && sameAsCustom(state, custom) ? custom.name : state.sharedName;
    const hash = toHash({ ...state, lang: state.lang, customName: name });
    if (window.location.hash !== hash) window.history.replaceState(null, "", hash);
    // the stored "last" scenario never reopens a lever page
    storage.set("last", toHash({ ...state, lang: state.lang, leverPage: null, customName: null }));
  }, [state]);

  useEffect(() => { storage.set("customs", JSON.stringify(state.customs)); }, [state.customs]);

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
  /** Waterfall of the selected split indicator, of CO2 (t) and of revenue (EUR). */
  contrib: Contributions;
  contribCo2: Contributions;
  contribRevenue: Contributions;
  /** Split indicator at the horizon with no store following and with every store following. */
  storeSplit: { at0: number; at1: number };
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
    const c = contributionsMulti(model, scen, horizon, [metric, "co2", "revenue"]);
    return {
      series,
      final,
      contrib: c[metric],
      contribCo2: c.co2,
      contribRevenue: c.revenue,
      storeSplit: {
        at0: runYear(model, { ...scen, adoption: 0 }, horizon).metrics[metric],
        at1: runYear(model, { ...scen, adoption: 1 }, horizon).metrics[metric],
      },
      isolated,
      leverImpact,
      pinnedSeries: pinned ? simulate(model.categories, model.levers, scenarioOf(pinned.fields), { horizon, baseYear: config.baseYear, extension: config.extension }) : null,
    };
  }, [activeLevers, adoption, hypotheses, horizon, metric, pinned]);
}

export { scenarios };
