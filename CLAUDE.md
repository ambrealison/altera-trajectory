# Altera.ai · Protein trajectory (demo)

A static demo of a protein trajectory simulator for a French cooperative retailer whose stores are independent (Coopérative U). Altera (an association that measures the plant / animal protein split of retailers' ranges) shows it to the retailer to show what could be built for them. Two versions are built from this one codebase:

- **Public demo** (this repository, public): fictitious but realistic data, served at https://ambrealison.github.io/altera-trajectory/. **All data here is fictitious and must be presented as such.**
- **Coopérative U version** (private repository `ambrealison/altera-trajectory-U`): the same app built with U's real dataset (`vite build --mode u`), served at https://ambrealison.github.io/altera-trajectory-U/. Its data never enters this repository: `src/data/u/` is git-ignored and filled by the private repo's workflow.

Audience: the retailer's commercial, insights, range marketing and CSR teams. Tone: sober, fast, quantified, no staging. Shown in screen share (1440 and 1920 px), then sent as a link and read alone. Readable from 1280 px; on tablet and mobile nothing should break.

## Vocabulary (WWF and the client's feedback, 2026-10-28)

- Never "ratio": say **protein split** (EN) and **répartition protéique** (FR). Never "plots": say **categories** (catégories). Products mixing plant and animal protein are **composite** (composites), never "mixed". A test enforces it.
- Lever screen text: "Twenty levers compared by their protein split, carbon and margin impact. Click a lever's row to open its individual card for more details."

## Business model

- Main indicator: Protein Tracker, plant share of protein sold, recomputed from volumes. Composite products count for their plant share of protein. Secondary indicator behind a discreet switch: WWF FG1, plant share of protein-rich foods in tonnes of product (composites set apart).
- Categories come from the dataset (`Dataset.groups`): the public demo groups its 30 categories as in the Protein Tracker and WWF methods (meat alternatives, pulses, nuts, seeds, tofu, dairy alternatives, other core plant, composites, non-core plant); the U version uses U's 4 categories and puts everything else in one collapsed "Autre" block. Lever texts name categories through role placeholders `{meatAlt}`, `{veganMeals}`, `{wholePlant}`, `{dairyAlt}` (`Dataset.roles`). A dataset can replace any interface string (`Dataset.texts`, read first by `translate`).
- Lever types: central only (green), central and stores (violet), depends on stores (peach ringed with orange). Real effect = effect × (1 - storeDependency + storeDependency × adoption). Under the store slider, the trajectory screen splits the effect into what the central office decides, what following stores bring and the store potential left, so that nobody expects 0 % of stores to mean no effect.
- Linked assumptions: `Hypothesis.dependsOn` names the assumption it acts on; on the lever page it sits under it, linked, and is greyed while the parent is at 0.
- Scenarios: four "suggested by Altera" (Central only 35.0 % in 2030, Committed 37.5 %, Ambitious 40.0 %, Theoretical ceiling about 45 %; tests check ±0.5 pt) and the user's own scenarios (save, rename, delete, update; kept in localStorage; the URL carries the scenario and its name, `cn=`, so a link can be saved by whoever opens it). No scenario is called "realistic".
- Trajectory indicators: three clickable cards (protein split, CO2 with the share of the scope 3 target, revenue in % and euros) switch both charts (by lever and over time) to that indicator. Scope 3 base and target are in `Dataset.scope3`.
- Realism benchmark: Dutch supermarkets gained 1.7 points in two years (Protein Tracker 2025, ProVeg and GPA, March 2026), about 0.85 point a year; its dotted line shows at every horizon (extended unchanged beyond 2030, said in the chart note). The guardrail is computed and tested but not displayed (presented orally). Never change its thresholds to suit a scenario.
- Horizons 2028, 2030, 2035 (default). Beyond 2030, `extension` in config.json (+4 % of effect a year) keeps the trajectory rising.
- Demo choice: revenue goes up in every suggested scenario; lever margin and revenue scores (Harvey balls) are never negative.
- Lever card: the side panel is short (what, who, type, categories, active switch) and opens the full lever page (`leverPage` in the state, `lp=` and `lt=` in the URL). The page template serves all 20 levers (summary, linked assumptions with live effects, evidence marked "dossier in preparation"); lever 12 (integrated aisle placement, `dossier: "i2"`) carries the full Altera dossier.

## I2 dossier (lever 12)

- `src/engine/i2.ts` reproduces the Altera workbook formula for formula (sheet I2_Model): quarterly S-curve rollout with cohort fade, range-build factor (version B), two meat channels (substitution and meat-side effect), margin, carbon, effort; then a seeded Monte Carlo (triangular on low / central / high, 10,000 draws, seed 20261015) and a one-at-a-time tornado. The workbook stops in 2030; the loop runs to 2035.
- The private repo's test checks the central 2030 results against the workbook (A: +0.0207 pp, EUR 1.17 m, +0.27 kt, 2,045 person-days; B: +0.0354 pp, EUR 2.12 m, +0.46 kt). Keep it green after any engine change.
- Inputs live in `Dataset.i2` (the register, with short bilingual notes); the dossier texts live in `src/data/dossiers/i2.json` and cite live values through placeholders. Lever 12's three assumptions (uplift, displacement, meat effect) drive the matching register inputs, so the lever page and the trajectory stay consistent.
- The dossier is the only place where margin is computed in euros (the Altera model does it); elsewhere margin stays qualitative.

## Rules

- **No real retailer data in this repository.** The public dataset is scaled and perturbed fictitious data; U's real data lives only in the private repository. Never put names of people, another client's internal data (for example the reference retailer behind the range target) or internal links (Google Docs) in code, data or docs. A test checks the public data for such words.
- **No em dash or en dash** (U+2014, U+2013) and no minus sign U+2212 anywhere in texts, in either language. Rewrite with a comma, a colon or parentheses. Negative numbers use the hyphen-minus.
- French: « » quotes, a non-breaking space before : ; ? ! % » and after «, formal "vous".
- Short, cautious sentences ("estimate", "order of magnitude"). Never "guaranteed" / « garanti ».
- Every UI string lives in `src/i18n/fr.json` and `en.json` with identical keys; data texts are `{ fr, en }` objects. French is the default language.
- 100 % static: no network request at runtime. `localStorage` only for language, tour, last scenario and saved scenarios, every access wrapped in try/catch.
- Charts are hand-made SVG; d3-scale and d3-shape are used for computations only. No UI component library. Colours, fonts, radii and spacing come from `src/styles/tokens.css` only.
- Guided tours: a welcome tour on the first visit, then one tour per screen and per lever page (header button), each covering every component (`src/components/Tour.tsx`, targets are `data-tour` attributes).

## Code map

- `src/data/`: `config.json`, `levers.json` (20 draft levers), `types.ts`, `index.ts` (reads `@dataset`), `publicDataset.ts` and `public/` (the fictitious dataset, generated by the private repo's `scripts/build_datasets.py`), `dossiers/i2.json`, `u/` (git-ignored).
- `src/engine/`: pure functions. `simulate.ts` (yearly volumes, splits, groups, CO2, revenue, low and high bands), `contributions.ts` (isolated effects and waterfalls, any metric), `i2.ts` (I2 model, Monte Carlo, tornado), `guardrail.ts`, `format.ts`, `expr.ts`, `stats.ts`.
- `src/state/`: reducer store, URL hash (`url.ts`), `useI2.ts`.
- `src/screens/` (Baseline, Levers, Trajectory, WithYourData, LeverPage, I2Dossier, Cover), `src/components/`, `src/styles/`.

## Commands

```bash
npm run dev          # http://localhost:5173/altera-trajectory/
npm test             # engine, I2 model, data, i18n, vocabulary and typography checks
npm run report       # isolated effects, scenarios in 2028, 2030 and 2035, Spearman
npm run build        # static build in dist/
npm run screenshots  # FR and EN captures of every screen and lever page (dev server running)
npm run dev -- --mode u   # U version, once the private data is copied into src/data/u/
```

Deployment: every push to `main` runs `.github/workflows/deploy.yml` (tests, build, GitHub Pages, base path `/altera-trajectory/`). The U version is rebuilt by the private repository's workflow (run it again after a change here).
