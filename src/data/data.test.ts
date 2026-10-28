import { describe, expect, it } from "vitest";
import fr from "../i18n/fr.json";
import en from "../i18n/en.json";
import configJson from "./config.json";
import categoriesJson from "./public/categories.json";
import groupsJson from "./public/groups.json";
import datasetJson from "./public/dataset.json";
import i2Json from "./public/i2_values.json";
import dossierJson from "./dossiers/i2.json";
import leversJson from "./levers.json";
import scenariosJson from "./public/scenarios.json";
import { categories, dataset, groups, levers } from ".";
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

const DATA = { config: configJson, categories: categoriesJson, levers: leversJson, scenarios: scenariosJson, groups: groupsJson, dataset: datasetJson, i2: i2Json, dossier: dossierJson };
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
    for (const t of ALL_TEXT) expect(/[\u2013\u2014\u2212]/.test(t.s), `${t.path}: ${t.s}`).toBe(false);
  });
  it("French texts put a non-breaking space before : ; ? ! % » and after «", () => {
    for (const t of ALL_TEXT.filter((x) => x.lang === "fr")) {
      expect(/ [:;?!%»]|« /.test(t.s), `${t.path}: ${t.s}`).toBe(false);
      expect(/[^\s  (][;?!%»]/.test(t.s.replace(/https?:\S+/g, "")), `${t.path}: ${t.s}`).toBe(false);
    }
  });
  it("lever and category texts only use the role placeholders of the dataset", () => {
    const roles = Object.keys(dataset.roles);
    for (const t of strings({ config: configJson, categories: categoriesJson, levers: leversJson, scenarios: scenariosJson }, "")) for (const m of t.s.matchAll(/\{(\w+)\}/g)) expect(roles, `${t.path}`).toContain(m[1]);
  });
  it("WWF vocabulary: no « ratio », no « plot », and composite rather than mixed, in either language", () => {
    for (const t of ALL_TEXT) {
      expect(/\bratios?\b/i.test(t.s), `${t.path}: ${t.s}`).toBe(false);
      expect(/\bplots?\b/i.test(t.s), `${t.path}: ${t.s}`).toBe(false);
      expect(/\bmixtes?\b|\bmixed\b/i.test(t.s), `${t.path}: ${t.s}`).toBe(false);
    }
  });
  it("the public data holds no internal link, file name or script path", () => {
    const all = JSON.stringify(DATA);
    for (const w of ["docs.google", "drive.google", "xlsx", "i3/scripts"]) expect(all.includes(w), w).toBe(false);
  });
  it("economics are qualitative scores from -2 to +2, never negative in this demo", () => {
    for (const l of levers) for (const v of [l.economics.revenueEffect, l.economics.marginEffect]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(2);
    }
  });
  it("texts never promise: no « garanti » and no « réaliste » scenario", () => {
    for (const t of ALL_TEXT) expect(/garanti|guarantee/i.test(t.s), `${t.path}`).toBe(false);
    for (const s of scenariosJson) expect(/réaliste|realistic/i.test(s.label.fr + s.label.en)).toBe(false);
  });
});

describe("data consistency", () => {
  const ids = new Set(categories.map((c) => c.id));
  it("has between 18 and 32 categories with valid fields, each in a known group", () => {
    expect(categories.length).toBeGreaterThanOrEqual(18);
    expect(categories.length).toBeLessThanOrEqual(32);
    const known = new Set([...groups.map((g) => g.id), "animal"]);
    for (const c of categories) expect(known.has(c.group), `${c.id}: ${c.group}`).toBe(true);
    for (const c of categories) {
      expect(c.plantProteinShare).toBeGreaterThanOrEqual(0);
      expect(c.plantProteinShare).toBeLessThanOrEqual(1);
      expect(c.tonnesProduct).toBeGreaterThan(0);
      if (c.co2Anchors) expect(c.co2Anchors.animal + (c.co2Anchors.plant - c.co2Anchors.animal) * c.plantProteinShare).toBeCloseTo(c.co2PerKg, 2);
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

describe("linked assumptions", () => {
  it("an assumption depends on another assumption of the same lever, never on itself, without cycles", () => {
    for (const l of levers) {
      const byId = new Map(l.hypotheses.map((h) => [h.id, h]));
      for (const h of l.hypotheses) {
        if (!h.dependsOn) continue;
        expect(byId.has(h.dependsOn), `${l.id}.${h.id}`).toBe(true);
        let cur: string | undefined = h.dependsOn;
        const seen = new Set([h.id]);
        while (cur) {
          expect(seen.has(cur), `${l.id}: cycle at ${cur}`).toBe(false);
          seen.add(cur);
          cur = byId.get(cur)?.dependsOn;
        }
      }
    }
  });
  it("only lever 12 carries a dossier, and its three assumptions match the I2 register", () => {
    expect(levers.filter((l) => l.dossier).map((l) => l.number)).toEqual([12]);
    const l12 = levers.find((l) => l.number === 12)!;
    const h = Object.fromEntries(l12.hypotheses.map((x) => [x.id, x.value]));
    expect(h.uplift / 100).toBeCloseTo(dataset.i2["I2.UPLIFT"].central, 6);
    expect(h.displacement).toBeCloseTo(dataset.i2["I2.DISPL"].central, 6);
    expect(h.meatEffect / 100).toBeCloseTo(dataset.i2["I2.MEAT_EFFECT"].central, 6);
  });
});
