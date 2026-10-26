// Interface strings live in fr.json and en.json (same keys); lever and category texts are {fr, en}
// objects in the data files.
import { useCallback } from "react";
import fr from "./fr.json";
import en from "./en.json";
import type { Lang, Text } from "../data/types";
import { config } from "../data";
import { useApp } from "../state/store";

const DICTS: Record<Lang, unknown> = { fr, en };

export const fill = (s: string, vars?: Record<string, string | number>) =>
  vars ? s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`)) : s;

const lowerFirst = (s: string) => s.charAt(0).toLocaleLowerCase() + s.slice(1);

/** The 4 plot names from config.json, usable as {plot1} to {plot4} inside running text. */
export const plotVars = (lang: Lang) =>
  Object.fromEntries((["1", "2", "3", "4"] as const).map((k) => [`plot${k}`, lowerFirst(config.plots[k][lang])]));

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const v = key.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), DICTS[lang]);
  return typeof v === "string" ? fill(v, { ...plotVars(lang), ...vars }) : key;
}

export function useT() {
  const { state } = useApp();
  const lang = state.lang;
  const t = useCallback((key: string, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
  const tx = useCallback((x: Text) => fill(x[lang], plotVars(lang)), [lang]);
  return { t, tx, lang };
}
