// Types of the tool's data. The public demo ships a fictitious dataset; the private version for the
// retailer injects its own dataset through the "@dataset" alias (vite.config.ts, mode "u").

export type Lang = "fr" | "en";
export type Text = { fr: string; en: string };

export type ProteinGroup = "animal_core" | "composite" | "plant_core" | "plant_noncore";
export type WwfGroup = "FG1" | "FG2" | "FG3" | "FG4" | "FG5" | "FG6" | "FG7";

export interface Config {
  client: string;
  title: Text;
  footer: { left: Text; right: string };
  baseYear: number;
  horizons: number[];
  defaultHorizon: number;
  /** Beyond fromYear, lever effects keep growing by ratePerYear (diffusion assumption). */
  extension: Extension;
  defaultAdoption: number;
  animalGroups: Record<string, Text>;
  benchmark: { text: Text; source: Text; pointsPerYear: number };
}

export interface Extension {
  fromYear: number;
  ratePerYear: number;
}

export interface Category {
  id: string;
  label: Text;
  /** Display group of the dataset (see Dataset.groups); "animal" for animal products. */
  group: string;
  proteinGroup: ProteinGroup;
  /** Display group for the animal side of the baseline screen. */
  animalGroup?: string;
  wwfGroup: WwfGroup;
  /** Multi-ingredient products are set apart from the WWF food-group ratios, as in the Altera tool. */
  wwfComposite?: boolean;
  /** Shares of the category's tonnes that are whole FG1 products of plant and of animal origin
   *  (override wwfGroup and wwfComposite when present). */
  fg1?: { plant: number; animal: number };
  tonnesProduct: number;
  proteinPer100g: number;
  plantProteinShare: number;
  pricePerKg: number;
  co2PerKg: number;
  /** Composites only: CO2 per kg at 0 % and at 100 % plant protein, so CO2 follows the recipe. */
  co2Anchors?: { animal: number; plant: number };
}

export type LeverType = "central" | "central_stores" | "stores";
/** Levers that act across every category, or only outside the plant categories, say so. */
export type LeverScope = "transverse" | "outside";

export interface Hypothesis {
  id: string;
  label: Text;
  value: number;
  min: number;
  max: number;
  step: number;
  /** "%" values enter the effect expressions as fractions (30 means 0.30). */
  unit: "%" | "pts" | "";
  note: Text;
  /** Id of the hypothesis this one acts on: it has no effect while that one is at 0. */
  dependsOn?: string;
}

/** Effect values are small expressions over the lever's hypothesis ids, e.g. "priceCut * elasticity". */
export type Expr = string;

export type Effect =
  | {
      op: "scale";
      targets: string[];
      x: Expr;
      /** Part of the volume gained that is taken from other categories. */
      substitution?: { from: string[]; share: Expr; basis: "product" | "protein" };
    }
  | {
      op: "transfer";
      from: string[];
      to: string;
      basis: "product" | "protein";
      x: Expr;
      /** Plant share of protein of the volume that arrives (a new recipe). */
      receiverPlantShare?: Expr;
    }
  | { op: "composition"; targets: string[]; x: Expr }
  | { op: "price"; targets: string[]; x: Expr };

export interface Lever {
  id: string;
  number: number;
  label: Text;
  type: LeverType;
  storeDependency: number;
  scope?: LeverScope[];
  deckEffort: number;
  deckImpact: number;
  provisional: boolean;
  description: Text;
  whyForU: Text;
  owner: Text;
  pilot: Text;
  economics: { revenueEffect: number; marginEffect: number };
  hypotheses: Hypothesis[];
  effects: Effect[];
  /** Lever 3 only: expression giving the factor applied to the width of every other lever's band. */
  tightensUncertainty?: Expr;
  ramp: { startYear: number; yearsToFull: number };
  uncertainty: { low: number; high: number };
  status: "draft";
  /** Id of the full evidence dossier, when one exists (only "i2" so far). */
  dossier?: string;
}

export type GuardrailState = "within" | "above" | "well_above";

export interface Scenario {
  id: string;
  label: Text;
  description: Text;
  activeLevers: number[];
  /** Share of stores that follow the central recommendations, 0 to 1. */
  adoption: number;
  /** Hypothesis values that differ from the lever defaults, by lever id then hypothesis id. */
  hypotheses: Record<string, Record<string, number>>;
  target2030: number;
  expectedGuardrail: GuardrailState;
}

/** A block of the plant breakdown: a plant category of the retailer (or of the method), the plant part
 *  of composite products, or the rest of plant protein. */
export interface Group {
  id: string;
  kind: "core" | "other" | "composite";
  label: Text;
  /** Short note under the label, for instance the matching Protein Tracker and WWF groups. */
  detail?: Text;
  /** Shown as one line, without its categories. */
  collapsed?: boolean;
}

export interface RayonRow { id: string; label: Text; protein: number; plantShare: number; points: number }

/** Inputs of the integrated aisle placement model (lever 12), as in the Altera register. */
export interface I2Value { low: number; central: number; high: number; tier: string; status: string; note: Text; url: string | null }
export type I2Values = Record<string, I2Value>;

export interface Dataset {
  kind: "public" | "u";
  categories: Category[];
  scenarios: Scenario[];
  groups: Group[];
  /** Running-text names of the plant categories that lever texts cite as {meatAlt}, {veganMeals}, {wholePlant}, {dairyAlt}. */
  roles: Record<"meatAlt" | "veganMeals" | "wholePlant" | "dairyAlt", Text>;
  /** Interface strings that differ in this version, by i18n key. */
  texts: Record<string, Text>;
  rayonTable: RayonRow[];
  /** Scope 3 emissions of the retailer and its reduction target. */
  scope3: { baseKt: number; targetCut: number; targetYear: number; source: Text };
  i2: I2Values;
}
