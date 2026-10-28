import { categories, config, dataset, groups } from "../data";
import { fg1Shares } from "../engine/simulate";
import { fmtNum, fmtPct, fmtTonnes } from "../engine/format";
import { useApp, REFERENCE } from "../state/store";
import type { MetricKey } from "../state/types";
import { useT } from "../i18n/useT";
import { ScreenHead } from "../components/ScreenHead";
import { Card } from "../components/Card";
import { HBar } from "../components/HBar";
import { Segmented } from "../components/Segmented";
import { StatusPill } from "../components/LeverBits";

type Cat = (typeof categories)[number];

/** Reference figures by plant group and animal group, in the selected indicator's unit: tonnes of
 *  protein for the Protein Tracker, tonnes of protein-rich products for WWF FG1. */
function breakdown(metric: MetricKey) {
  const plant = (c: Cat) => (metric === "pt" ? (c.tonnesProduct * c.proteinPer100g * c.plantProteinShare) / 100 : c.tonnesProduct * fg1Shares(c).plant);
  const animal = (c: Cat) => (metric === "pt" ? (c.tonnesProduct * c.proteinPer100g * (1 - c.plantProteinShare)) / 100 : c.tonnesProduct * fg1Shares(c).animal);
  const total = categories.reduce((a, c) => a + plant(c) + animal(c), 0);
  const byGroup: Record<string, number> = Object.fromEntries(groups.map((g) => [g.id, 0]));
  const byCategory: { category: Cat; group: string; value: number }[] = [];
  const animalGroups: Record<string, number> = {};
  let animalPlant = 0;
  for (const c of categories) {
    const v = plant(c);
    // the plant part of animal categories (a few recipes) is shown with the composites, on one line
    if (c.group === "animal") {
      byGroup.composite = (byGroup.composite ?? 0) + v;
      animalPlant += v;
    } else {
      if (c.group in byGroup) byGroup[c.group] += v;
      if (v > 0) byCategory.push({ category: c, group: c.group, value: v });
    }
    if (c.animalGroup) animalGroups[c.animalGroup] = (animalGroups[c.animalGroup] ?? 0) + animal(c);
  }
  if (animalPlant > 0) byCategory.push({ category: { id: "animal-plant", label: { fr: "", en: "" } } as Cat, group: "composite", value: animalPlant });
  byCategory.sort((a, b) => b.value - a.value);
  return { total, byGroup, byCategory, animalGroups };
}

export function Baseline() {
  const { state, dispatch } = useApp();
  const { t, tx, lang } = useT();
  const metric = state.metric;
  const fg1 = metric === "fg1";
  const ratio = REFERENCE[metric];
  const B = breakdown(metric);
  const pts = (v: number) => (100 * v) / B.total;
  const core = groups.filter((g) => g.kind === "core");
  const corePts = core.reduce((a, g) => a + pts(B.byGroup[g.id]), 0);
  const compositePts = groups.filter((g) => g.kind === "composite").reduce((a, g) => a + pts(B.byGroup[g.id]), 0);
  const ratioPts = ratio * 100;
  const totalLabel = fmtNum(ratioPts, lang, Math.abs(ratioPts - Math.round(ratioPts)) < 0.05 ? 0 : 1);
  const unit = (v: number) => fmtTonnes(v, lang);
  const order = [...core, ...groups.filter((g) => g.kind === "composite"), ...groups.filter((g) => g.kind === "other")];
  const maxRow = Math.max(...order.map((g) => B.byGroup[g.id]));
  const firstNonCore = order.findIndex((g) => g.kind !== "core");

  const groupKeys = Object.keys(config.animalGroups);
  const animalTotal = groupKeys.reduce((a, k) => a + (B.animalGroups[k] ?? 0), 0);

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
        <div className="card keymsg" data-tour="baseline-message">
          <span className="k">{t("baseline.status")}</span>
          <h2>{t("baseline.keyMessage", { x: `${fmtNum(corePts, lang, 1)} ${t("app.points")}`, total: totalLabel })}</h2>
          <div className="split-bar" aria-hidden>
            <i style={{ width: `${(corePts / ratioPts) * 100}%`, background: "var(--plant)" }} />
            <i style={{ width: `${(compositePts / ratioPts) * 100}%`, background: "var(--comp)" }} />
            <i style={{ width: `${((ratioPts - corePts - compositePts) / ratioPts) * 100}%`, background: "var(--plant-2)" }} />
          </div>
          <p>{fg1 ? t("baseline.keyMessageFg1") : t("baseline.keyMessageText")}</p>
        </div>
      </div>

      <div className="grid2 wide-left">
        <Card title={t("baseline.plantTitle")} right={<span className="small">{fg1 ? t("baseline.plantNoteFg1") : t("baseline.plantNotePt")}</span>} data-tour="categories" fictitious>
          <div className="drows">
            <div className="drow dhead"><span /><span /><span>{t("baseline.colPoints")}</span><span>{fg1 ? t("baseline.colProduct") : t("baseline.colProtein")}</span></div>
            {order.flatMap((g, i) => {
              const v = B.byGroup[g.id];
              const apart = fg1 && v === 0;
              const color = g.kind === "core" ? "var(--plant)" : g.kind === "composite" ? "var(--comp)" : "var(--plant-2)";
              return [
                <div key={g.id} className={`drow ${i === firstNonCore ? "sep" : ""} ${g.kind === "other" ? "other" : ""}`}>
                  <span className="dl">
                    <b>{tx(g.label)}</b>
                    {g.detail && <small className="ddetail">{tx(g.detail)}</small>}
                  </span>
                  {apart ? <span className="dstatus">{g.kind === "composite" ? t("baseline.apartFg1") : t("baseline.outFg1")}</span> : <HBar value={v / maxRow} color={color} height={9} />}
                  <b className="num dv">{apart ? "" : fmtNum(pts(v), lang, 1)}</b>
                  <span className="num dt">{apart ? "" : unit(v)}</span>
                </div>,
                // every block lists the categories it holds, except a block shown as one line
                ...(g.collapsed ? [] : B.byCategory.filter((c) => c.group === g.id)).map((c) => (
                  <div key={`${g.id}-${c.category.id}`} className="drow sub">
                    <span className="dl">{c.category.id === "animal-plant" ? t("baseline.animalPlant") : tx(c.category.label)}</span>
                    <HBar value={c.value / maxRow} color={color} height={5} />
                    <span className="num dv">{fmtNum(pts(c.value), lang, 1)}</span>
                    <span className="num dt">{unit(c.value)}</span>
                  </div>
                )),
              ];
            })}
            <div className="drow total">
              <span className="dl"><b>{t("baseline.total")}</b></span>
              <span />
              <b className="num dv">{fmtNum(ratioPts, lang, 1)}</b>
              <span className="num dt">{unit(order.reduce((a, g) => a + B.byGroup[g.id], 0))}</span>
            </div>
          </div>
        </Card>

        <div className="stack">
          <Card title={t("baseline.animalTitle")} right={<span className="small">{fg1 ? t("baseline.animalNoteFg1") : t("baseline.animalNotePt")}</span>} data-tour="baseline-animal">
            {groupKeys.map((k) => {
              const v = B.animalGroups[k] ?? 0;
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
          <Card title={t("baseline.rayonTitle")} right={<span className="small">{t("baseline.rayonNote")}</span>} data-tour="baseline-rayons" fictitious>
            <table className="rtable">
              <thead>
                <tr><th>{t("baseline.colRayon")}</th><th className="r">{t("baseline.colProtein")}</th><th>{t("baseline.colPlantShare")}</th><th className="r">{t("baseline.colPoints")}</th></tr>
              </thead>
              <tbody>
                {dataset.rayonTable.map((r) => (
                  <tr key={r.id}>
                    <td>{tx(r.label)}</td>
                    <td className="r num">{unit(r.protein)}</td>
                    <td>
                      <span className="minisplit"><i style={{ width: `${r.plantShare * 100}%` }} /></span>
                      <span className="num share">{fmtPct(r.plantShare, lang, 0)}</span>
                    </td>
                    <td className="r num">{fmtNum(r.points, lang, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </>
  );
}
