// Typed access to the data. The public build uses the fictitious dataset; a client version points
// the "@dataset" alias at its own dataset (vite.config.ts, mode "client").
import type { Config, Lever } from "./types";
import configJson from "./config.json";
import leversJson from "./levers.json";
import { dataset } from "@dataset";

export { dataset };
export const config = configJson as Config;
export const categories = dataset.categories;
// a dataset can reword some lever texts (dataset.leverTexts)
export const levers = (leversJson as Lever[])
  .map((l) => ({ ...l, ...dataset.leverTexts?.[l.id] }))
  .sort((a, b) => a.number - b.number);
export const scenarios = dataset.scenarios;
export const groups = dataset.groups;
export const model = { categories, levers, extension: config.extension };
export const leverByNumber = (n: number) => levers.find((l) => l.number === n)!;
export const categoryById = (id: string) => categories.find((c) => c.id === id);

/** Categories the lever acts on (scale and composition targets, transfer receivers and sources). */
export function leverTargets(l: Lever): string[] {
  const ids = new Set<string>();
  for (const e of l.effects) {
    if (e.op === "transfer") { ids.add(e.to); e.from.forEach((x) => ids.add(x)); }
    else e.targets.forEach((x) => ids.add(x));
  }
  return [...ids];
}

/** Plant groups of the dataset the lever acts on, in dataset order ("animal" categories left out). */
export function leverGroups(l: Lever): string[] {
  const touched = new Set(leverTargets(l).map((id) => categoryById(id)?.group).filter((g): g is string => !!g && g !== "animal"));
  return groups.filter((g) => touched.has(g.id)).map((g) => g.id);
}
export const groupById = (id: string) => groups.find((g) => g.id === id);
