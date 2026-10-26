# Altera.ai · Protein trajectory (demo)

A static demo of a protein trajectory simulator for a French cooperative retailer whose stores are independent. Altera (an association that measures the plant / animal protein ratio of retailers' ranges) shows it with its partner InterVeg, to show the retailer what could be built for them. **All data is fictitious and must be presented as such. This is not a production tool.**

Audience: the retailer's commercial, insights, range marketing and CSR teams. Part of them think "we can do this ourselves"; the tool shows what they do not have: every lever quantified from explicit, editable assumptions; combined effects computed properly; dependence on independent stores; a realism check. Tone: sober, fast, quantified, no staging (no fake calculation animation, no scrolling fake code). Shown in screen share (1440 and 1920 px), then sent as a link and read alone: it must make sense without commentary. Readable from 1280 px; on tablet and mobile nothing should break.

## Business model

- Main ratio: Protein Tracker, plant share of protein sold. Composite products count for their plant share of protein. Secondary ratio behind a discreet switch: WWF FG1, plant share of protein-rich foods in tonnes of product (composites set apart).
- The retailer thinks of plant protein as 4 "plots" (labels in `src/data/config.json`): processed plant proteins, plant-based ready meals, whole plant proteins, plant-based dairy alternatives. The rest of plant protein (cereals, pasta, bread) is "other plant protein" and weighs far more; the demo makes this visible.
- Levers outside the 4 plots (hybrids, portions, waste) carry a visible "outside the 4 plots" tag.
- Lever types: central only (green), central and stores (violet), depends on stores (peach ringed with orange). Real effect = effect × (1 - storeDependency + storeDependency × adoption).
- Realism benchmark: Dutch supermarkets gained 1.7 points in two years (Protein Tracker 2025, ProVeg and GPA, March 2026), about 0.85 point a year. Its dotted line and source show on the time chart up to the 2030 horizon only. The guardrail (within / above / well above 1.5 times that pace) is still computed and tested but no longer displayed: the user presents it orally (decision of 2026-10-26). Never change its thresholds to suit a scenario.
- Four scenarios: Central only (35.0 % in 2030), Committed (37.5 %), Ambitious (40.0 %), Theoretical ceiling (45.0 %). No scenario is called "realistic". Every arrival shows a cover page (eyebrow, display title, one sentence, "Let's go" button, a live glimpse of the opening scenario); the app then opens on Committed, and the guided tour starts after "Let's go" on the first visit only.
- Horizons 2028, 2030, 2035 (default); 2040 was removed at the user's request. The last scenario restored from localStorage never brings back its horizon, indicator or screen. Levers reach full effect by 2030; beyond, a diffusion assumption (`extension` in config.json, +4 % of effect a year) keeps the trajectory rising.
- Demo choice: revenue goes up in every scenario (plant and hybrid products priced higher per kilo, explicit value assumptions on levers 4, 6, 20) and lever financial scores are never negative. A test checks it.
- Every category belongs to a named block: the 4 plots (nuts are in whole plant proteins), mixed products, or other plant protein; no catch-all. Plot names live only in config.json; texts refer to them as {plot1} to {plot4}, never "plot 1".

## Rules

- **Fictitious data only.** Never put real retailer data, names of people or internal client details in code, data or docs.
- **No em dash or en dash** (U+2014, U+2013) and no minus sign U+2212 anywhere in texts, in either language. Rewrite with a comma, a colon or parentheses. Negative numbers use the hyphen-minus.
- French: « » quotes, a non-breaking space before : ; ? ! % » and after «, formal "vous".
- Short, cautious sentences ("estimate", "order of magnitude"). Never "guaranteed" / « garanti ».
- Every UI string lives in `src/i18n/fr.json` and `en.json` with identical keys; data texts are `{ fr, en }` objects. French is the default language.
- Margin is never computed in euros: revenue and margin effects per lever are qualitative (-2 to +2, Harvey balls).
- 100 % static: no network request at runtime, no external API. `localStorage` only for language, tour and last scenario, every access wrapped in try/catch.
- Charts are hand-made SVG; d3-scale and d3-shape are used for computations only. No UI component library. Colours, fonts, radii and spacing come from `src/styles/tokens.css` only (taken from the Altera demo tool).

## Code map

- `src/data/`: `config.json`, `categories.json` (24 named categories, no catch-all; fruit and vegetables carry the calibration so the reference is exactly 32.0 %), `levers.json` (20 draft levers), `scenarios.json`, types in `types.ts`.
- `src/engine/`: pure functions. `simulate.ts` (yearly volumes, ratios, plots, CO2, revenue, low and high bands), `contributions.ts` (isolated effects and waterfall), `guardrail.ts`, `format.ts` (Intl), `expr.ts` (effect expressions), `stats.ts` (Spearman).
- `src/state/`: reducer store, URL hash serialisation (`url.ts`).
- `src/components/`, `src/screens/` (Baseline, Levers, Trajectory, WithYourData), `src/styles/`.

## Commands

```bash
npm run dev          # http://localhost:5173/altera-trajectory/
npm test             # engine, data, i18n and typography checks
npm run report       # isolated effects, scenarios in 2028 and 2030, Spearman
npm run build        # static build in dist/
npm run screenshots  # FR and EN captures of every screen (dev server running)
```

Deployment: every push to `main` runs `.github/workflows/deploy.yml` (tests, build, GitHub Pages, base path `/altera-trajectory/`).
