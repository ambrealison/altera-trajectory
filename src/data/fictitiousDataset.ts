// The fictitious dataset shipped with the public demo. A private build can swap it for another one
// through the "@dataset" alias (see vite.config.ts): the rest of the app does not change.
import type { Category, Dataset, Scenario } from "./types";
import categoriesJson from "./categories.json";
import scenariosJson from "./scenarios.json";

export const dataset: Dataset = {
  kind: "fictitious",
  categories: categoriesJson as Category[],
  scenarios: scenariosJson as Scenario[],
};
