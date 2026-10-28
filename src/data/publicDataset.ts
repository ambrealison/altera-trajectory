// The fictitious dataset of the public demo: categories grouped as in the Protein Tracker and WWF
// methods, volumes scaled and perturbed so that no retailer's figures can be read from them.
import type { Category, Dataset, Group, I2Values, RayonRow, Scenario } from "./types";
import categories from "./public/categories.json";
import groups from "./public/groups.json";
import meta from "./public/dataset.json";
import scenarios from "./public/scenarios.json";
import rayonTable from "./public/rayon_table.json";
import i2 from "./public/i2_values.json";

export const dataset: Dataset = {
  kind: "public",
  categories: categories as Category[],
  scenarios: scenarios as Scenario[],
  groups: groups as Group[],
  roles: meta.roles,
  texts: meta.texts,
  rayonTable: rayonTable as RayonRow[],
  scope3: meta.scope3,
  i2: i2 as I2Values,
};
