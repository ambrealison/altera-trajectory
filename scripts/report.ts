// Prints the calibration report: isolated effect of every lever, the four scenarios in 2028 and 2030,
// and the rank correlation with the deck's impact scores. Run with `npm run report`.
import { config, levers, model, scenarios } from "../src/data";
import { baseline, runYear, simulate } from "../src/engine/simulate";
import { isolatedEffect } from "../src/engine/contributions";
import { guardrail } from "../src/engine/guardrail";
import { spearman } from "../src/engine/stats";

const pts = (v: number) => (v * 100).toFixed(2);
const base = baseline(model);
const defaults = { activeLevers: levers.map((l) => l.number), adoption: config.defaultAdoption, hypotheses: {} };
console.log(`Reference: Protein Tracker ${pts(base.pt)} %, WWF FG1 ${pts(base.fg1)} %\n`);
console.log("Isolated effect at 2030, default assumptions, adoption 50 % (points)");
const rows = levers.map((l) => ({ l, e: isolatedEffect(model, defaults, l.number, 2030) }));
for (const { l, e } of rows) {
  const m = runYear(model, defaults, 2030, "mid", l.number).metrics;
  const pct = (a: number, b: number) => (100 * (a / b - 1)).toFixed(2).padStart(6);
  console.log(`  ${String(l.number).padStart(2)}  impact ${l.deckImpact.toFixed(1).padStart(4)}  ${pts(e.mid).padStart(6)}  [${pts(e.low)} to ${pts(e.high)}]  CO2 ${pct(m.co2, base.co2)} %  CA ${pct(m.revenue, base.revenue)} %  ${l.label.fr}`);
}
const ranked = rows.filter((r) => r.l.number !== 3);
console.log(`\nSpearman (19 levers, lever 3 excluded): ${spearman(ranked.map((r) => r.l.deckImpact), ranked.map((r) => r.e.mid)).toFixed(3)}`);
console.log(`Spearman (20 levers): ${spearman(rows.map((r) => r.l.deckImpact), rows.map((r) => r.e.mid)).toFixed(3)}\n`);
for (const s of scenarios) {
  const res = simulate(model.categories, model.levers, s, { horizon: 2030 });
  const line = (y: number) => {
    const r = res.find((x) => x.year === y)!;
    const g = guardrail(base.pt, r.pt, 2025, y, config.benchmark.pointsPerYear);
    return `${y}: ${pts(r.pt)} % [${pts(r.low.pt)} to ${pts(r.high.pt)}] ${g.annualGain.toFixed(2)} pt/yr ${g.state}`;
  };
  const r30 = res[res.length - 1];
  console.log(`${s.label.fr.padEnd(18)} target ${pts(s.target2030)}  ${line(2028)}  |  ${line(2030)}  CO2 ${(100 * (r30.co2 / base.co2 - 1)).toFixed(1)} %  CA ${(100 * (r30.revenue / base.revenue - 1)).toFixed(1)} %`);
}
