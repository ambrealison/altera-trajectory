// Typed access to the demo data. The public build uses the fictitious dataset; a private build may
// point the "@dataset" alias at another one (vite.config.ts, mode "real").
import type { Config, Lever } from "./types";
import configJson from "./config.json";
import leversJson from "./levers.json";
import { dataset } from "@dataset";

const baseConfig = configJson as Config;
export { dataset };
export const config: Config = {
  ...baseConfig,
  rayons: { ...baseConfig.rayons, ...dataset.meta?.rayons },
  animalGroups: dataset.meta?.animalGroups ?? baseConfig.animalGroups,
};
export const categories = dataset.categories;
export const levers = (leversJson as Lever[]).slice().sort((a, b) => a.number - b.number);
export const scenarios = dataset.scenarios;
export const model = { categories, levers, extension: config.extension };
export const leverByNumber = (n: number) => levers.find((l) => l.number === n)!;
