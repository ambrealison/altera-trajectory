// Typed access to the demo data. Every figure here is fictitious.
import type { Category, Config, Lever, Scenario } from "./types";
import configJson from "./config.json";
import categoriesJson from "./categories.json";
import leversJson from "./levers.json";
import scenariosJson from "./scenarios.json";

export const config = configJson as Config;
export const categories = categoriesJson as Category[];
export const levers = (leversJson as Lever[]).slice().sort((a, b) => a.number - b.number);
export const scenarios = scenariosJson as Scenario[];
export const model = { categories, levers, extension: config.extension };
export const leverByNumber = (n: number) => levers.find((l) => l.number === n)!;
