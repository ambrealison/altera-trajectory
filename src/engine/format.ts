// Localised number formats through Intl: "32,0 %" and "1 102 t" in French, "32.0%" and "1,102 t" in English.

import type { Lang } from "../data/types";

const locale = (lang: Lang) => (lang === "fr" ? "fr-FR" : "en-GB");
const NBSP = " ";
const cache = new Map<string, Intl.NumberFormat>();
const nf = (lang: Lang, opts: Intl.NumberFormatOptions) => {
  const key = lang + JSON.stringify(opts);
  let f = cache.get(key);
  if (!f) cache.set(key, (f = new Intl.NumberFormat(locale(lang), opts)));
  return f;
};

export const fmtNum = (v: number, lang: Lang, digits = 0) =>
  nf(lang, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v === 0 ? 0 : v);

/** A 0 to 1 share as a percentage: 0.32 gives "32,0 %". */
export const fmtPct = (v: number, lang: Lang, digits = 1) =>
  nf(lang, { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v === 0 ? 0 : v);

/** Signed percentage change: "+1,2 %", "-0,4 %". */
export const fmtSignedPct = (v: number, lang: Lang, digits = 1) =>
  nf(lang, { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits, signDisplay: "exceptZero" }).format(v);

/** Ratio difference in points: 0.0123 gives "+1,2 pt" or "+1.2 pts". */
export function fmtPoints(delta: number, lang: Lang, digits = 1, signed = true) {
  const pts = delta * 100;
  const s = nf(lang, { minimumFractionDigits: digits, maximumFractionDigits: digits, signDisplay: signed ? "exceptZero" : "auto" }).format(pts);
  const abs = Math.abs(Number(pts.toFixed(digits)));
  if (lang === "fr") return `${s}${NBSP}${abs >= 2 ? "pts" : "pt"}`;
  return `${s} ${abs === 1 ? "pt" : "pts"}`;
}

/** Tonnes: "1 102 t", and "4,8 Mt" from a million tonnes. */
export function fmtTonnes(t: number, lang: Lang) {
  if (Math.abs(t) >= 1e6) return `${fmtNum(t / 1e6, lang, 1)}${NBSP}Mt`;
  return `${fmtNum(t, lang, 0)}${NBSP}t`;
}

/** Signed tonnes rounded to two significant figures: an order of magnitude, not a measurement. */
export function fmtSignedTonnes(t: number, lang: Lang) {
  const mag = t === 0 ? 0 : Math.floor(Math.log10(Math.abs(t)));
  const step = 10 ** Math.max(0, mag - 1);
  const s = fmtTonnes(Math.round(t / step) * step, lang);
  return t > 0 ? `+${s}` : s;
}

/** Euros with an adaptive unit: "6,9 Md€", "120 M€" ("€6.9bn", "€120m" in English). */
export function fmtEuros(v: number, lang: Lang) {
  const a = Math.abs(v);
  if (lang === "fr") {
    if (a >= 1e9) return `${fmtNum(v / 1e9, lang, 1)}${NBSP}Md€`;
    return `${fmtNum(v / 1e6, lang, 0)}${NBSP}M€`;
  }
  if (a >= 1e9) return `€${fmtNum(v / 1e9, lang, 1)}bn`;
  return `€${fmtNum(v / 1e6, lang, 0)}m`;
}

/** Hypothesis value with its unit. */
export function fmtValue(v: number, unit: string, lang: Lang, step = 1) {
  const digits = step < 1 ? Math.max(0, Math.ceil(-Math.log10(step))) : 0;
  const n = fmtNum(v, lang, digits);
  if (unit === "%") return lang === "fr" ? `${n}${NBSP}%` : `${n}%`;
  if (unit === "pts") return lang === "fr" ? `${n}${NBSP}pts` : `${n} pts`;
  return n;
}

/** Range of ratio points: "+0,8 à +1,3 pt", "+0.8 to +1.3 pts". */
export function fmtRangePoints(lo: number, hi: number, lang: Lang, digits = 1) {
  const f = (v: number) => nf(lang, { minimumFractionDigits: digits, maximumFractionDigits: digits, signDisplay: "exceptZero" }).format(v * 100);
  const abs = Math.abs(Number((hi * 100).toFixed(digits)));
  if (lang === "fr") return `${f(lo)} à ${f(hi)}${NBSP}${abs >= 2 ? "pts" : "pt"}`;
  return `${f(lo)} to ${f(hi)} ${abs === 1 ? "pt" : "pts"}`;
}
