import { categories, config } from "../data";
import type { PlotId } from "../data/types";
import { fmtNum, fmtPct, fmtTonnes } from "../engine/format";
import { useApp, REFERENCE } from "../state/store";
import type { MetricKey } from "../state/types";
import { useT } from "../i18n/useT";
import { ScreenHead } from "../components/ScreenHead";
import { Card } from "../components/Card";
import { HBar } from "../components/HBar";
import { Segmented } from "../components/Segmented";
import { StatusPill } from "../components/LeverBits";

const PLOTS: PlotId[] = ["1", "2", "3", "4"];

/** Reference figures by plot, animal group and department, in the selected indicator's unit:
 *  tonnes of protein for the Protein Tracker, tonnes of protein-rich products for WWF FG1. */
function breakdown(metric: MetricKey) {
  const inFg1 = (c: (typeof categories)[number]) => c.wwfGroup === "FG1" && !c.wwfComposite;
  const plant = (c: (typeof categories)[number]) => (metric === "pt" ? (c.tonnesProduct * c.proteinPer100g * c.plantProteinShare) / 100 : inFg1(c) && c.proteinGroup !== "animal_core" ? c.tonnesProduct : 0);
  const animal = (c: (typeof categories)[number]) => (metric === "pt" ? (c.tonnesProduct * c.proteinPer100g * (1 - c.plantProteinShare)) / 100 : inFg1(c) && c.proteinGroup === "animal_core" ? c.tonnesProduct : 0);
  const total = categories.reduce((a, c) => a + plant(c) + animal(c), 0);
  const byPlot: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, composite: 0, other: 0 };
  const groups: Record<string, number> = {};
  const rayons: Record<string, { plant: number; animal: number }> = {};
  for (const c of categories) {
    const key = c.plot === null ? "composite" : c.plot === "other_plant" ? "other" : String(c.plot);
    byPlot[key] += plant(c);
    if (c.animalGroup) groups[c.animalGroup] = (groups[c.animalGroup] ?? 0) + animal(c);
    const r = (rayons[c.rayon] ??= { plant: 0, animal: 0 });
    r.plant += plant(c);
    r.animal += animal(c);
  }
  return { total, byPlot, groups, rayons };
}

export function Baseline() {
  const { state, dispatch } = useApp();
  const { t, tx, lang } = useT();
  const metric = state.metric;
  const ratio = REFERENCE[metric];
  const B = breakdown(metric);
  const pts = (v: number) => (100 * v) / B.total;
  const plotPts = PLOTS.reduce((a, k) => a + pts(B.byPlot[k]), 0);
  const ratioPts = ratio * 100;
  const totalLabel = fmtNum(ratioPts, lang, Math.abs(ratioPts - Math.round(ratioPts)) < 0.05 ? 0 : 1);
  const unit = (v: number) => fmtTonnes(v, lang);
  const fg1 = metric === "fg1";

  const rows: { key: string; label: string; detail?: string; color: string; value: number; status?: string }[] = [
    ...PLOTS.map((k) => ({
      key: k,
      label: tx(config.plots[k]),
      detail: tx(config.plotDetails[k]),
      color: "var(--plant)",
      value: B.byPlot[k],
      status: fg1 && k === "2" ? t("baseline.apartFg1") : fg1 && k === "4" ? t("baseline.outFg1") : undefined,
    })),
    { key: "composite", label: tx(config.plots.composite), color: "var(--comp)", value: B.byPlot.composite, status: fg1 ? t("baseline.apartFg1") : undefined },
    { key: "other", label: tx(config.plots.other), color: "var(--plant-2)", value: B.byPlot.other },
  ];
  const maxRow = Math.max(...rows.map((r) => r.value));

  const groupKeys = Object.keys(config.animalGroups);
  const animalTotal = groupKeys.reduce((a, k) => a + (B.groups[k] ?? 0), 0);
  const rayonKeys = Object.keys(config.rayons).filter((k) => (B.rayons[k]?.plant ?? 0) + (B.rayons[k]?.animal ?? 0) > 0);

  return (
    <>
      <ScreenHead id="baseline" status={<StatusPill tone="lav">{t("baseline.status")}</StatusPill>} />
      <div className="grid2">
        <div className="kpi pt big" data-tour="baseline-kpi">
          <div className="kpi-top">
            <span className="m">{t(`metric.${metric}`)}</span>
            <Segmented label={t("metric.label")} size="sm" value={metric} onChange={(m) => dispatch({ type: "metric", metric: m })}
              options={[{ value: "pt", label: t("metric.pt") }, { value: "fg1", label: t("metric.fg1") }]} />
          </div>
          <b className="num">{fmtPct(ratio, lang)}</b>
          <span className="l">{t(`metric.${metric}Long`)}</span>
          <div className="gauge"><i style={{ width: `${ratio * 100}%` }} /></div>
          <span className="ref">{t("baseline.kpiNote")}</span>
        </div>
        <div className="card keymsg">
          <span className="k">{t("baseline.status")}</span>
          <h2>{t("baseline.keyMessage", { x: `${fmtNum(plotPts, lang, 1)}${lang === "fr" ? " " : " "}${t("app.points")}`, total: totalLabel })}</h2>
          <div className="split-bar" aria-hidden>
            <i style={{ width: `${(plotPts / ratioPts) * 100}%`, background: "var(--plant)" }} />
            <i style={{ width: `${(pts(B.byPlot.composite) / ratioPts) * 100}%`, background: "var(--comp)" }} />
            <i style={{ width: `${(pts(B.byPlot.other) / ratioPts) * 100}%`, background: "var(--plant-2)" }} />
          </div>
          <p>{fg1 ? t("baseline.keyMessageFg1") : t("baseline.keyMessageText")}</p>
        </div>
      </div>

      <div className="grid2 wide-left">
        <Card title={t("baseline.plantTitle")} right={<span className="small">{fg1 ? t("baseline.plantNoteFg1") : t("baseline.plantNotePt")}</span>} data-tour="plots" fictitious>
          <div className="drows">
            <div className="drow dhead"><span /><span /><span>{t("baseline.colPoints")}</span><span>{fg1 ? t("baseline.colProduct") : t("baseline.colProtein")}</span></div>
            {rows.map((r, i) => (
              <div key={r.key} className={`drow ${i === 4 ? "sep" : ""} ${r.key === "other" ? "other" : ""}`}>
                <span className="dl">
                  <b>{r.label}</b>
                  {r.detail && <small>{r.detail}</small>}
                </span>
                {r.status && r.value === 0 ? (
                  <span className="dstatus">{r.status}</span>
                ) : (
                  <HBar value={r.value / maxRow} color={r.color} height={9} />
                )}
                <b className="num dv">{r.status && r.value === 0 ? "" : fmtNum(pts(r.value), lang, 1)}</b>
                <span className="num dt">{r.status && r.value === 0 ? "" : unit(r.value)}</span>
              </div>
            ))}
            <div className="drow total">
              <span className="dl"><b>{t("baseline.total")}</b></span>
              <span />
              <b className="num dv">{fmtNum(ratioPts, lang, 1)}</b>
              <span className="num dt">{unit(rows.reduce((a, r) => a + r.value, 0))}</span>
            </div>
          </div>
        </Card>

        <div className="stack">
          <Card title={t("baseline.animalTitle")} right={<span className="small">{fg1 ? t("baseline.animalNoteFg1") : t("baseline.animalNotePt")}</span>}>
            {groupKeys.map((k) => {
              const v = B.groups[k] ?? 0;
              return (
                <div key={k} className="arow">
                  <span>{tx(config.animalGroups[k])}</span>
                  {v === 0 ? <span className="dstatus">{t("baseline.outFg1")}</span> : <HBar value={v / animalTotal} color="var(--animal)" height={9} />}
                  <b className="num">{v === 0 ? "" : fmtPct(v / B.total, lang)}</b>
                  <span className="num dt">{v === 0 ? "" : unit(v)}</span>
                </div>
              );
            })}
          </Card>
          <Card title={t("baseline.rayonTitle")} fictitious>
            <table className="rtable">
              <thead>
                <tr><th>{t("baseline.colRayon")}</th><th className="r">{fg1 ? t("baseline.colProduct") : t("baseline.colProtein")}</th><th>{t("baseline.colPlantShare")}</th><th className="r">{t("baseline.colPoints")}</th></tr>
              </thead>
              <tbody>
                {rayonKeys.map((k) => {
                  const r = B.rayons[k];
                  const tot = r.plant + r.animal;
                  const share = tot > 0 ? r.plant / tot : 0;
                  return (
                    <tr key={k}>
                      <td>{tx(config.rayons[k])}</td>
                      <td className="r num">{unit(tot)}</td>
                      <td>
                        <span className="minisplit"><i style={{ width: `${share * 100}%` }} /></span>
                        <span className="num share">{fmtPct(share, lang, 0)}</span>
                      </td>
                      <td className="r num">{fmtNum(pts(r.plant), lang, 1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </>
  );
}
