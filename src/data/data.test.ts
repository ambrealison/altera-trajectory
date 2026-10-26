import { describe, expect, it } from "vitest";
import fr from "../i18n/fr.json";
import en from "../i18n/en.json";
import configJson from "./config.json";
import categoriesJson from "./categories.json";
import leversJson from "./levers.json";
import scenariosJson from "./scenarios.json";
import { categories, levers } from ".";
import { identifiers } from "../engine/expr";

const keys = (o: unknown, prefix = ""): string[] =>
  o && typeof o === "object" && !Array.isArray(o)
    ? Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => {
        const p = prefix ? `${prefix}.${k}` : k;
        return v && typeof v === "object" && !Array.isArray(v) ? keys(v, p) : [p];
      })
    : [];

/** Every {fr, en} object in a JSON tree. */
function bilingual(o: unknown, path = "$", out: { path: string; fr: unknown; en: unknown }[] = []) {
  if (Array.isArray(o)) o.forEach((x, i) => bilingual(x, `${path}[${i}]`, out));
  else if (o && typeof o === "object") {
    const rec = o as Record<string, unknown>;
    if ("fr" in rec || "en" in rec) out.push({ path, fr: rec.fr, en: rec.en });
    else for (const [k, v] of Object.entries(rec)) bilingual(v, `${path}.${k}`, out);
  }
  return out;
}

/** Every string in a JSON tree, with its language when known. */
function strings(o: unknown, lang: "fr" | "en" | "", path = "$", out: { path: string; lang: string; s: string }[] = []) {
  if (typeof o === "string") out.push({ path, lang, s: o });
  else if (Array.isArray(o)) o.forEach((x, i) => strings(x, lang, `${path}[${i}]`, out));
  else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) strings(v, k === "fr" || k === "en" ? k : lang, `${path}.${k}`, out);
  return out;
}

const DATA = { config: configJson, categories: categoriesJson, levers: leversJson, scenarios: scenariosJson };
const ALL_TEXT = [...strings(DATA, ""), ...strings(fr, "fr", "fr"), ...strings(en, "en", "en")];

describe("i18n and bilingual data", () => {
  it("fr.json and en.json have exactly the same keys", () => {
    expect(keys(fr).sort()).toEqual(keys(en).sort());
  });
  it("every {fr, en} field in the data is filled in both languages", () => {
    const fields = bilingual(DATA);
    expect(fields.length).toBeGreaterThan(100);
    for (const f of fields) {
      expect(typeof f.fr === "string" && f.fr.trim().length > 0, `${f.path}.fr`).toBe(true);
      expect(typeof f.en === "string" && f.en.trim().length > 0, `${f.path}.en`).toBe(true);
    }
  });
  it("no em dash, en dash or minus sign anywhere in the texts", () => {
    for (const t of ALL_TEXT) expect(/[–—−]/.test(t.s), `${t.path}: ${t.s}`).toBe(false);
  });
  it("French texts put a non-breaking space before : ; ? ! % » and after «", () => {
    for (const t of ALL_TEXT.filter((x) => x.lang === "fr")) {
      expect(/ [:;?!%»]|« /.test(t.s), `${t.path}: ${t.s}`).toBe(false);
      expect(/[^\s  (][;?!%»]/.test(t.s.replace(/https?:\S+/g, "")), `${t.path}: ${t.s}`).toBe(false);
    }
  });
  it("texts never promise: no « garanti » and no « réaliste » scenario", () => {
    for (const t of ALL_TEXT) expect(/garanti|guarantee/i.test(t.s), `${t.path}`).toBe(false);
    for (const s of scenariosJson) expect(/réaliste|realistic/i.test(s.label.fr + s.label.en)).toBe(false);
  });
});

describe("data consistency", () => {
  const ids = new Set(categories.map((c) => c.id));
  it("has between 18 and 25 categories with valid fields", () => {
    expect(categories.length).toBeGreaterThanOrEqual(18);
    expect(categories.length).toBeLessThanOrEqual(25);
    for (const c of categories) {
      expect(c.plantProteinShare).toBeGreaterThanOrEqual(0);
      expect(c.plantProteinShare).toBeLessThanOrEqual(1);
      expect(c.tonnesProduct).toBeGreaterThan(0);
      if (c.co2Anchors) expect(c.co2Anchors.animal + (c.co2Anchors.plant - c.co2Anchors.animal) * c.plantProteinShare).toBeCloseTo(c.co2PerKg, 6);
    }
  });
  it("has the 20 levers of the deck, numbered 1 to 20, with 2 or 3 assumptions", () => {
    expect(levers.map((l) => l.number)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    for (const l of levers) {
      expect(l.hypotheses.length, l.id).toBeGreaterThanOrEqual(2);
      expect(l.hypotheses.length, l.id).toBeLessThanOrEqual(3);
      expect(l.storeDependency).toBe(l.type === "central" ? 0 : l.type === "stores" ? 1 : 0.5);
      expect(l.provisional).toBe(l.number === 8 || l.number === 10);
      expect(l.status).toBe("draft");
      expect(l.ramp.startYear).toBeGreaterThan(2025);
    }
  });
  it("effects only refer to existing categories and to the lever's own assumptions", () => {
    for (const l of levers) {
      const hyps = new Set(l.hypotheses.map((h) => h.id));
      const exprs: string[] = l.tightensUncertainty ? [l.tightensUncertainty] : [];
      for (const e of l.effects) {
        const cats = e.op === "transfer" ? [...e.from, e.to] : [...e.targets, ...(e.op === "scale" && e.substitution ? e.substitution.from : [])];
        for (const c of cats) expect(ids.has(c), `${l.id}: ${c}`).toBe(true);
        exprs.push(e.x);
        if (e.op === "scale" && e.substitution) exprs.push(e.substitution.share);
        if (e.op === "transfer" && e.receiverPlantShare) exprs.push(e.receiverPlantShare);
      }
      for (const x of exprs) for (const id of identifiers(x)) expect(hyps.has(id), `${l.id}: ${id} in "${x}"`).toBe(true);
    }
  });
});
