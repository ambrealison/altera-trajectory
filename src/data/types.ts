// Types of the fictitious demo data. Every figure in src/data is illustrative.

export type Lang = "fr" | "en";
export type Text = { fr: string; en: string };

export type PlotId = "1" | "2" | "3" | "4";
export type ProteinGroup = "animal_core" | "composite" | "plant_core" | "plant_noncore";
export type WwfGroup = "FG1" | "FG2" | "FG3" | "FG4" | "FG5" | "FG6" | "FG7";

export interface Config {
  client: string;
  title: Text;
  coBranding: string;
  footer: { left: Text; right: string };
  baseYear: number;
  horizons: number[];
  defaultHorizon: number;
  /** Beyond fromYear, lever effects keep growing by ratePerYear (diffusion assumption). */
  extension: Extension;
  defaultAdoption: number;
  plots: Record<PlotId, Text> & { other: Text; composite: Text; animal: Text };
  plotDetails: Record<PlotId, Text>;
  rayons: Record<string, Text>;
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
  rayon: string;
  /** 1 to 4 for the retailer's plant "plots", "other_plant" for the rest of plant protein, null otherwise. */
  plot: 1 | 2 | 3 | 4 | "other_plant" | null;
  proteinGroup: ProteinGroup;
  /** Display group for the animal side of the baseline screen. */
  animalGroup?: string;
  wwfGroup: WwfGroup;
  /** Multi-ingredient products are set apart from the WWF food-group ratios, as in the Altera tool. */
  wwfComposite?: boolean;
  tonnesProduct: number;
  proteinPer100g: number;
  plantProteinShare: number;
  pricePerKg: number;
  co2PerKg: number;
  /** Composites only: CO2 per kg at 0 % and at 100 % plant protein, so CO2 follows the recipe. */
  co2Anchors?: { animal: number; plant: number };
}

export type LeverType = "central" | "central_stores" | "stores";
export type LeverPlot = PlotId | "other" | "transverse" | "outside";

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
  plots: LeverPlot[];
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
