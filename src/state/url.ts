// The whole scenario (screen, levers, assumptions, adoption, horizon, indicator, language) is encoded
// in the URL hash, so a precise scenario can be shared as a link. Example:
// #v=trajectory&sc=committed&l=1.2.3&a=30&h=2030&m=pt&lang=fr&hy=L01.conversion:45,L02.plantShare:45
import { config, levers, scenarios } from "../data";
import type { Lang } from "../data/types";
import { KPIS, SCREENS, type KpiKey, type ScenarioFields, type ScreenId } from "./types";

export interface Snapshot extends ScenarioFields {
  screen: ScreenId;
  lang?: Lang;
  leverPage?: string | null;
  leverTab?: string;
  kpi?: KpiKey;
  /** Name of a saved scenario, so that a shared link can be saved under the same name. */
  customName?: string | null;
}

/** Hypothesis overrides of a preset scenario, as stored in the app state (relative to lever defaults). */
export function presetFields(id: string): ScenarioFields {
  const s = scenarios.find((x) => x.id === id) ?? scenarios[0];
  return {
    preset: s.id,
    activeLevers: [...s.activeLevers].sort((a, b) => a - b),
    adoption: s.adoption,
    hypotheses: clean(s.hypotheses),
    horizon: config.defaultHorizon,
    metric: "pt",
  };
}

/** Drops overrides equal to the lever default. */
export function clean(h: Record<string, Record<string, number>>): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const l of levers) {
    for (const hyp of l.hypotheses) {
      const v = h[l.id]?.[hyp.id];
      if (v !== undefined && v !== hyp.value) (out[l.id] ??= {})[hyp.id] = v;
    }
  }
  return out;
}

export function sameHypotheses(a: Record<string, Record<string, number>>, b: Record<string, Record<string, number>>) {
  const ca = clean(a), cb = clean(b);
  const ka = Object.keys(ca), kb = Object.keys(cb);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => {
    const x = ca[k], y = cb[k];
    if (!y) return false;
    const kx = Object.keys(x);
    return kx.length === Object.keys(y).length && kx.every((h) => x[h] === y[h]);
  });
}

/** Id of the preset scenario the fields match exactly, if any (horizon and indicator aside). */
export function matchingPreset(f: ScenarioFields): string | null {
  for (const s of scenarios) {
    const p = presetFields(s.id);
    if (
      p.adoption === f.adoption &&
      p.activeLevers.length === f.activeLevers.length &&
      p.activeLevers.every((n, i) => n === f.activeLevers[i]) &&
      sameHypotheses(p.hypotheses, f.hypotheses)
    ) return s.id;
  }
  return null;
}

/** Value of every assumption, lever defaults filled in. */
const effective = (h: Record<string, Record<string, number>>) =>
  levers.flatMap((l) => l.hypotheses.map((x) => ({ lid: l.id, hid: x.id, v: h[l.id]?.[x.id] ?? x.value })));

export function toHash(s: Snapshot): string {
  const p: string[] = [`v=${s.screen}`];
  if (s.preset) p.push(`sc=${s.preset}`);
  const exact = s.preset && matchingPreset(s) === s.preset;
  if (!exact) {
    p.push(`l=${s.activeLevers.join(".")}`);
    p.push(`a=${Math.round(s.adoption * 100)}`);
    // only the assumptions that differ from the preset (or from the lever defaults without a preset)
    const base = effective(s.preset ? presetFields(s.preset).hypotheses : {});
    const hy = effective(s.hypotheses).filter((x, i) => x.v !== base[i].v).map((x) => `${x.lid}.${x.hid}:${x.v}`);
    if (hy.length) p.push(`hy=${hy.join(",")}`);
  }
  if (s.horizon !== config.defaultHorizon) p.push(`h=${s.horizon}`);
  if (s.metric !== "pt") p.push(`m=${s.metric}`);
  if (s.kpi && s.kpi !== "split") p.push(`k=${s.kpi}`);
  if (s.leverPage) p.push(`lp=${s.leverPage}`);
  if (s.leverPage && s.leverTab && s.leverTab !== "summary") p.push(`lt=${s.leverTab}`);
  if (s.customName) p.push(`cn=${encodeURIComponent(s.customName)}`);
  if (s.lang) p.push(`lang=${s.lang}`);
  return `#${p.join("&")}`;
}

export function fromHash(hash: string): Partial<Snapshot> | null {
  const raw = hash.replace(/^#/, "");
  if (!raw) return null;
  const q = new URLSearchParams(raw);
  const out: Partial<Snapshot> = {};
  const v = q.get("v");
  if (v && (SCREENS as string[]).includes(v)) out.screen = v as ScreenId;
  const sc = q.get("sc");
  const base = sc && scenarios.some((s) => s.id === sc) ? presetFields(sc) : null;
  if (base) Object.assign(out, base);
  const l = q.get("l");
  if (l !== null) {
    const valid = new Set(levers.map((x) => x.number));
    out.activeLevers = [...new Set(l.split(".").map(Number).filter((n) => valid.has(n)))].sort((a, b) => a - b);
  }
  const a = q.get("a");
  if (a !== null && !Number.isNaN(Number(a))) out.adoption = Math.min(1, Math.max(0, Math.round(Number(a) / 10) / 10));
  const hy = q.get("hy");
  if (hy !== null) {
    const h: Record<string, Record<string, number>> = structuredClone(base?.hypotheses ?? {});
    for (const part of hy.split(",")) {
      const m = part.match(/^(L\d{2})\.(\w+):(-?[\d.]+)$/);
      if (!m) continue;
      const lever = levers.find((x) => x.id === m[1]);
      const hyp = lever?.hypotheses.find((x) => x.id === m[2]);
      if (!lever || !hyp) continue;
      (h[lever.id] ??= {})[hyp.id] = Math.min(hyp.max, Math.max(hyp.min, Number(m[3])));
    }
    out.hypotheses = clean(h);
  }
  const hz = Number(q.get("h"));
  if (config.horizons.includes(hz)) out.horizon = hz;
  const m = q.get("m");
  if (m === "pt" || m === "fg1") out.metric = m;
  const lang = q.get("lang");
  if (lang === "fr" || lang === "en") out.lang = lang;
  const k = q.get("k");
  if (k && (KPIS as string[]).includes(k)) out.kpi = k as KpiKey;
  const lp = q.get("lp");
  if (lp && levers.some((x) => x.id === lp)) {
    out.leverPage = lp;
    const lt = q.get("lt");
    if (lt && /^\w+$/.test(lt)) out.leverTab = lt;
  }
  const cn = q.get("cn");
  if (cn) out.customName = cn.slice(0, 60);
  if (!base && (out.activeLevers || out.hypotheses)) out.preset = null;
  return out;
}
