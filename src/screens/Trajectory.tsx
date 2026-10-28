import type { ReactNode } from "react";
import { config, dataset, groups, levers, scenarios } from "../data";
import type { Contributions } from "../engine/contributions";
import type { YearResult } from "../engine/simulate";
import { fmtKt, fmtMEuros, fmtPct, fmtPoints, fmtSignedEuros, fmtSignedKt, fmtSignedNum, fmtSignedPct } from "../engine/format";
import { sameAsCustom, useApp, useResults, REFERENCE } from "../state/store";
import { matchingPreset } from "../state/url";
import type { KpiKey, MetricKey } from "../state/types";
import { useT } from "../i18n/useT";
import { ScreenHead } from "../components/ScreenHead";
import { Card } from "../components/Card";
import { Segmented } from "../components/Segmented";
import { Toggle } from "../components/Toggle";
import { LeverNumber, StatusPill } from "../components/LeverBits";
import { Waterfall } from "../components/Waterfall";
import { TrajectoryChart } from "../components/TrajectoryChart";
import { StackedArea, type Layer } from "../components/StackedArea";
import { ScenarioPanel } from "../components/ScenarioPanel";

// stacked layers, bottom to top: the rest of plant protein, composites, then the plant categories
const LAYERS = [...groups.filter((g) => g.kind === "other"), ...groups.filter((g) => g.kind === "composite"), ...groups.filter((g) => g.kind === "core").reverse()];
const CORE_SHADES = ["var(--plot-1)", "var(--plot-2)", "var(--plot-3)", "var(--plot-4)", "var(--green-2)", "var(--plant-2)"];
const layerColor = (id: string) => {
  const g = groups.find((x) => x.id === id)!;
  if (g.kind === "other") return "var(--plot-other)";
  if (g.kind === "composite") return "var(--plot-composite)";
  const core = groups.filter((x) => x.kind === "core");
  return CORE_SHADES[Math.min(CORE_SHADES.length - 1, core.findIndex((x) => x.id === id))];
};

/** Plant share by group in ratio points, for one year. The plant part of animal categories joins
 *  the composites, so that the layers add up to the split. */
function groupPoints(r: YearResult, metric: MetricKey): Record<string, number> {
  const split = metric === "pt" ? r.groups : r.fg1Groups;
  const total = metric === "pt" ? r.proteinTotal : Object.values(r.fg1Groups).reduce((a, v) => a + v, 0);
  const out: Record<string, number> = {};
  for (const g of LAYERS) out[g.id] = total > 0 ? (100 * (split[g.id] ?? 0)) / total : 0;
  const rest = 100 * r[metric] - Object.values(out).reduce((a, v) => a + v, 0);
  const comp = LAYERS.find((g) => g.kind === "composite");
  if (comp && rest > 0) out[comp.id] += rest;
  return out;
}

/** The same waterfall in another unit (t of CO2 to kt, euros to millions). */
const scaled = (c: Contributions, k: number): Contributions => ({
  ...c, base: c.base * k, final: c.final * k, combined: c.combined * k, sumIsolated: c.sumIsolated * k, overlap: c.overlap * k,
  steps: c.steps.map((s) => ({ ...s, isolated: s.isolated * k, value: s.value * k })),
});

/** Padded domain around the waterfall's levels. */
const domainOf = (c: Contributions, lo: number, hi: number): [number, number] => {
  let cum = c.base;
  const levels = [c.base, c.final, lo, hi, ...c.steps.map((s) => (cum += s.value))];
  const a = Math.min(...levels), b = Math.max(...levels);
  const pad = Math.max((b - a) * 0.35, Math.abs(b) * 0.002);
  return [a - pad * 1.6, b + pad];
};

export function Trajectory() {
  const { state, dispatch } = useApp();
  const { t, tx, lang } = useT();
  const R = useResults();
  const metric = state.metric;
  const kpi = state.kpi;
  const current = matchingPreset(state);
  const ref = REFERENCE[metric];
  const fin = R.final;
  const storeDependent = state.activeLevers.some((n) => levers.find((l) => l.number === n)!.storeDependency > 0);

  const loaded = state.customs.find((c) => c.id === state.custom);
  const customName = loaded && sameAsCustom(state, loaded) ? loaded.name : null;
  const pinnedName = state.pinned ? (state.pinned.preset ? tx(scenarios.find((x) => x.id === state.pinned!.preset)!.label) : t("trajectory.custom")) : undefined;
  const pinnedFinal = R.pinnedSeries ? R.pinnedSeries[R.pinnedSeries.length - 1] : null;
  const scenarioName = current ? tx(scenarios.find((s) => s.id === current)!.label) : customName ?? t("trajectory.custom");

  // CO2 against the scope 3 target: the target is a cut of scope 3 emissions by the target year
  const s3 = dataset.scope3;
  const targetKt = s3.baseKt * s3.targetCut;
  const savedKt = (REFERENCE.co2 - fin.co2) / 1000;
  const targetShare = targetKt > 0 ? savedKt / targetKt : 0;
  const revDelta = fin.revenue - REFERENCE.revenue;

  // effect of the split indicator by who decides: the central office alone, the stores that follow, the rest of the store potential
  const central = R.storeSplit.at0 - ref;
  const followed = fin[metric] - R.storeSplit.at0;
  const untapped = R.storeSplit.at1 - fin[metric];
  const fullSpan = Math.max(1e-9, Math.abs(central) + Math.abs(followed) + Math.abs(untapped));

  const KpiCard = ({ k, children, tone }: { k: KpiKey; children: ReactNode; tone?: string }) => (
    <button type="button" className={`kpi kpi-btn ${tone ?? "plain"} ${kpi === k ? "on" : ""}`} aria-pressed={kpi === k} onClick={() => dispatch({ type: "kpi", kpi: k })}>
      {children}
      <span className="kpi-hint">{kpi === k ? t("trajectory.kpiShown") : t("trajectory.kpiShow")}</span>
    </button>
  );

  let chart: ReactNode;
  let title = "";
  let note: string | undefined;
  if (kpi === "split") {
    const points = R.series.map((r) => ({ year: r.year, v: r[metric], lo: Math.min(r.low[metric], r.high[metric]), hi: Math.max(r.low[metric], r.high[metric]) }));
    const showDutch = metric === "pt";
    const dutch = showDutch ? R.series.map((r) => ({ year: r.year, v: REFERENCE.pt + (config.benchmark.pointsPerYear / 100) * (r.year - config.baseYear) })) : undefined;
    const ghost = R.pinnedSeries?.map((r) => ({ year: r.year, v: r[metric] }));
    const layers: Layer[] = LAYERS
      .map((g) => ({ key: g.id, label: tx(g.label), color: layerColor(g.id) }))
      .filter((l) => R.series.some((r) => groupPoints(r, metric)[l.key] > 0.005));
    const rows = R.series.map((r) => ({ year: r.year, ...groupPoints(r, metric) }));
    const showOverlap = Math.abs(R.contrib.overlap) >= 0.001;
    title = state.chartView === "lever" ? t("trajectory.chartTitleLever", { from: config.baseYear, to: state.horizon }) : t("trajectory.chartTitleTime");
    note = showDutch && state.chartView === "time"
      ? t("trajectory.dutchSource", { text: tx(config.benchmark.text), source: tx(config.benchmark.source) }) + (state.horizon > config.extension.fromYear ? ` ${t("trajectory.dutchExtended", { year: config.extension.fromYear })}` : "")
      : metric === "pt" ? t("metric.ptLong") : t("metric.fg1Long");
    chart = state.chartView === "lever" ? (
      <>
        <Waterfall contrib={R.contrib} low={Math.min(fin.low[metric], fin.high[metric])} high={Math.max(fin.low[metric], fin.high[metric])}
          baseYear={config.baseYear} horizon={state.horizon}
          pinned={pinnedFinal && pinnedName ? { name: pinnedName, value: pinnedFinal[metric] } : null}
          onOpen={(id) => dispatch({ type: "drawer", lever: id })} />
        <WaterfallFoot contrib={R.contrib} show={showOverlap} fmt={(v) => fmtPoints(v, lang)} fmtOverlap={(v) => fmtPoints(v, lang, 1, false)} />
      </>
    ) : (
      <>
        <TrajectoryChart points={points} dutch={dutch} ghost={ghost} ghostName={pinnedName} />
        <div className="legend">
          <span><i className="sw line" />{t("trajectory.kpiSplit")}</span>
          <span><i className="sw band" />{t("trajectory.band")}</span>
          {dutch && <span><i className="sw dutch" />{t("trajectory.dutchPace")}</span>}
          {ghost && <span><i className="sw ghostl" />{t("trajectory.ghost")}</span>}
        </div>
        <div className="subchart">
          <div className="ctitle"><span>{t("trajectory.stackTitle")}</span><span className="ctitle-r small">{metric === "pt" ? t("trajectory.stackNotePt") : t("trajectory.stackNoteFg1")}</span></div>
          <StackedArea rows={rows} layers={layers} />
        </div>
      </>
    );
  } else if (kpi === "co2") {
    const c = scaled(R.contribCo2, 1 / 1000);
    const lo = Math.min(fin.low.co2, fin.high.co2) / 1000, hi = Math.max(fin.low.co2, fin.high.co2) / 1000;
    title = state.chartView === "lever" ? t("trajectory.co2TitleLever", { from: config.baseYear, to: state.horizon }) : t("trajectory.co2TitleTime");
    note = t("trajectory.co2Note");
    const points = R.series.map((r) => {
      const a = (r.low.co2 - REFERENCE.co2) / 1000, b = (r.high.co2 - REFERENCE.co2) / 1000;
      return { year: r.year, v: (r.co2 - REFERENCE.co2) / 1000, lo: Math.min(a, b), hi: Math.max(a, b) };
    });
    chart = (
      <>
        {state.chartView === "lever" ? (
          <>
            <Waterfall contrib={c} low={lo} high={hi} baseYear={config.baseYear} horizon={state.horizon} domain={domainOf(c, lo, hi)}
              fmtLevel={(v) => fmtKt(v, lang, 0)} fmtStep={(v) => fmtSignedNum(v, lang, Math.abs(v) < 10 ? 1 : 0)}
              pinned={pinnedFinal && pinnedName ? { name: pinnedName, value: pinnedFinal.co2 / 1000 } : null}
              onOpen={(id) => dispatch({ type: "drawer", lever: id })} />
            <WaterfallFoot contrib={c} show={Math.abs(c.overlap) > Math.abs(c.combined) * 0.02} fmt={(v) => fmtSignedKt(v, lang)} fmtOverlap={(v) => fmtKt(Math.abs(v), lang)} />
          </>
        ) : (
          <>
            <TrajectoryChart points={points} fmt={(v) => fmtSignedKt(v, lang)} zero={0} label={title}
              ghost={R.pinnedSeries?.map((r) => ({ year: r.year, v: (r.co2 - REFERENCE.co2) / 1000 }))} ghostName={pinnedName} />
            <div className="legend">
              <span><i className="sw line" />{t("trajectory.co2Line")}</span>
              <span><i className="sw band" />{t("trajectory.band")}</span>
            </div>
          </>
        )}
        <Scope3 savedKt={savedKt} targetKt={targetKt} />
      </>
    );
  } else {
    const c = scaled(R.contribRevenue, 1 / 1e6);
    const lo = Math.min(fin.low.revenue, fin.high.revenue) / 1e6, hi = Math.max(fin.low.revenue, fin.high.revenue) / 1e6;
    title = state.chartView === "lever" ? t("trajectory.revTitleLever", { from: config.baseYear, to: state.horizon }) : t("trajectory.revTitleTime");
    note = t("trajectory.revNote");
    const points = R.series.map((r) => {
      const a = r.low.revenue / REFERENCE.revenue - 1, b = r.high.revenue / REFERENCE.revenue - 1;
      return { year: r.year, v: r.revenue / REFERENCE.revenue - 1, lo: Math.min(a, b), hi: Math.max(a, b) };
    });
    chart = state.chartView === "lever" ? (
      <>
        <Waterfall contrib={c} low={lo} high={hi} baseYear={config.baseYear} horizon={state.horizon} domain={domainOf(c, lo, hi)}
          fmtLevel={(v) => fmtMEuros(v, lang)} fmtStep={(v) => fmtSignedNum(v, lang, Math.abs(v) < 10 ? 1 : 0)}
          pinned={pinnedFinal && pinnedName ? { name: pinnedName, value: pinnedFinal.revenue / 1e6 } : null}
          onOpen={(id) => dispatch({ type: "drawer", lever: id })} />
        <WaterfallFoot contrib={c} show={Math.abs(c.overlap) > Math.abs(c.combined) * 0.02} fmt={(v) => fmtSignedEuros(v * 1e6, lang)} fmtOverlap={(v) => fmtSignedEuros(Math.abs(v) * 1e6, lang).replace("+", "")} />
      </>
    ) : (
      <>
        <TrajectoryChart points={points} fmt={(v) => fmtSignedPct(v, lang)} zero={0} label={title}
          ghost={R.pinnedSeries?.map((r) => ({ year: r.year, v: r.revenue / REFERENCE.revenue - 1 }))} ghostName={pinnedName} />
        <div className="legend">
          <span><i className="sw line" />{t("trajectory.revLine")}</span>
          <span><i className="sw band" />{t("trajectory.band")}</span>
        </div>
      </>
    );
  }

  return (
    <>
      <ScreenHead id="trajectory" status={<StatusPill tone="lav">{scenarioName}</StatusPill>} />
      <div className="traj">
        <aside className="traj-side">
          <ScenarioPanel pinnedName={pinnedName} pinnedValue={pinnedFinal ? fmtPct(pinnedFinal[metric], lang) : ""} />

          <Card title={t("trajectory.adoption")} data-tour="adoption">
            <div className="adopt">
              <input type="range" min={0} max={100} step={10} value={Math.round(state.adoption * 100)} aria-label={t("trajectory.adoption")}
                style={{ ["--p" as string]: `${state.adoption * 100}%` }}
                onChange={(e) => dispatch({ type: "adoption", adoption: Number(e.target.value) / 100 })} />
              <b className="num">{fmtPct(state.adoption, lang, 0)}</b>
            </div>
            <p className="small-note">{t("trajectory.adoptionNote")}</p>
            {state.activeLevers.length > 0 && (
              <div className="store-split" data-tour="store-split">
                <span className="sc-k">{t("trajectory.splitTitle", { year: state.horizon })}</span>
                <div className="ss-bar" aria-hidden>
                  <i className="ss-central" style={{ width: `${(Math.abs(central) / fullSpan) * 100}%` }} />
                  <i className="ss-stores" style={{ width: `${(Math.abs(followed) / fullSpan) * 100}%` }} />
                  <i className="ss-left" style={{ width: `${(Math.abs(untapped) / fullSpan) * 100}%` }} />
                </div>
                <ul className="ss-legend">
                  <li><i className="ss-central" />{t("trajectory.splitCentral")}<b className="num">{fmtPoints(central, lang, 2)}</b></li>
                  <li><i className="ss-stores" />{t("trajectory.splitStores", { adoption: fmtPct(state.adoption, lang, 0) })}<b className="num">{fmtPoints(followed, lang, 2)}</b></li>
                  <li><i className="ss-left" />{t("trajectory.splitLeft")}<b className="num">{fmtPoints(untapped, lang, 2)}</b></li>
                </ul>
                <p className="small-note">{storeDependent ? t("trajectory.splitNote", { x: fmtPoints(central, lang, 2) }) : t("trajectory.adoptionNoEffect")}</p>
              </div>
            )}
            <div className="horizon" data-tour="horizon">
              <span>{t("trajectory.horizon")}</span>
              <Segmented label={t("trajectory.horizon")} size="sm" value={state.horizon} onChange={(h) => dispatch({ type: "horizon", horizon: h })}
                options={config.horizons.map((h) => ({ value: h, label: String(h) }))} />
            </div>
            {state.horizon > config.extension.fromYear && (
              <p className="small-note">{t("trajectory.extensionNote", { year: config.extension.fromYear, rate: fmtPct(config.extension.ratePerYear, lang, 0) })}</p>
            )}
          </Card>

          <Card title={t("trajectory.leversTitle")} data-tour="traj-levers" right={<span className="count">{t("trajectory.leversCount", { n: state.activeLevers.length, total: levers.length })}</span>}>
            <ul className="lever-mini">
              {levers.map((l) => {
                const on = state.activeLevers.includes(l.number);
                return (
                  <li key={l.id} className={on ? "on" : ""}>
                    <Toggle small on={on} label={tx(l.label)} onChange={() => dispatch({ type: "toggleLever", number: l.number })} />
                    <LeverNumber lever={l} size={20} muted={!on} />
                    <button type="button" className="lname" onClick={() => dispatch({ type: "drawer", lever: l.id })} title={tx(l.label)}>{tx(l.label)}</button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </aside>

        <div className="traj-main">
          <div className="kpis" data-tour="kpis" role="group" aria-label={t("trajectory.kpiGroup")}>
            <KpiCard k="split" tone="pt">
              <span className="m">{t("trajectory.kpiRatio", { year: state.horizon })} · {t(`metric.${metric}`)}</span>
              <b className="num">{fmtPct(fin[metric], lang)}</b>
              <span className="d">{fmtPoints(fin[metric] - ref, lang)} {t("trajectory.vsRef")}</span>
              <span className="ref">{t("trajectory.kpiRange", { low: fmtPct(Math.min(fin.low[metric], fin.high[metric]), lang), high: fmtPct(Math.max(fin.low[metric], fin.high[metric]), lang) })}</span>
            </KpiCard>
            <KpiCard k="co2">
              <span className="m">{t("trajectory.kpiCo2", { year: state.horizon })}</span>
              <b className="num">{fmtSignedPct(fin.co2 / REFERENCE.co2 - 1, lang)}</b>
              <span className="d">{fmtSignedKt(-savedKt, lang)} CO2e {t("trajectory.vsRef")}</span>
              <span className="ref">{t("trajectory.kpiScope3", { share: fmtPct(Math.max(0, targetShare), lang, 0), cut: fmtPct(s3.targetCut, lang, 0), year: s3.targetYear })}</span>
            </KpiCard>
            <KpiCard k="revenue">
              <span className="m">{t("trajectory.kpiRevenue", { year: state.horizon })}</span>
              <b className="num">{fmtSignedPct(fin.revenue / REFERENCE.revenue - 1, lang)}</b>
              <span className="d">{fmtSignedEuros(revDelta, lang)} {t("trajectory.vsRef")}</span>
              <span className="ref">{t("trajectory.kpiRevenueNote")}</span>
            </KpiCard>
          </div>

          <Card className="chart-card" data-tour="chart" fictitious title={title}
            right={
              <>
                {kpi === "split" && (
                  <Segmented label={t("metric.label")} size="sm" value={metric} onChange={(m) => dispatch({ type: "metric", metric: m })}
                    options={[{ value: "pt", label: t("metric.pt") }, { value: "fg1", label: t("metric.fg1") }]} />
                )}
                <Segmented tour="chart-view" label={t("trajectory.byLever")} value={state.chartView} onChange={(v) => dispatch({ type: "chartView", view: v })}
                  options={[{ value: "lever", label: t("trajectory.byLever") }, { value: "time", label: t("trajectory.overTime") }]} />
              </>
            }
            note={note}>
            {state.activeLevers.length === 0 && <p className="empty">{t("trajectory.noLever")}</p>}
            {chart}
          </Card>
        </div>
      </div>
    </>
  );
}


function WaterfallFoot({ contrib, show, fmt, fmtOverlap }: { contrib: Contributions; show: boolean; fmt: (v: number) => string; fmtOverlap: (v: number) => string }) {
  const { t } = useT();
  return (
    <div className="wf-foot">
      <div className="legend">
        <span><i className="sw ref" />{t("trajectory.reference", { year: config.baseYear })}</span>
        <span><i className="sw t-central" />{t("types.central")}</span>
        <span><i className="sw t-central_stores" />{t("types.central_stores")}</span>
        <span><i className="sw t-stores" />{t("types.stores")}</span>
        <span><i className="sw final" />{t("trajectory.yourTrajectoryShort")}</span>
      </div>
      {show && (
        <div className="overlap">
          <span>{t("trajectory.sumIsolated")} <b className="num">{fmt(contrib.sumIsolated)}</b></span>
          <span>{t("trajectory.combined")} <b className="num">{fmt(contrib.combined)}</b></span>
          <span className="ov">{t("trajectory.overlap")} <b className="num">{fmtOverlap(contrib.overlap)}</b></span>
          <small>{t("trajectory.overlapNote")}</small>
        </div>
      )}
    </div>
  );
}

/** Share of the scope 3 target that the trajectory's CO2 saving covers, as a progress bar. */
function Scope3({ savedKt, targetKt }: { savedKt: number; targetKt: number }) {
  const { t, tx, lang } = useT();
  const s3 = dataset.scope3;
  const share = targetKt > 0 ? Math.max(0, savedKt) / targetKt : 0;
  return (
    <div className="scope3" data-tour="scope3">
      <div className="s3-top">
        <b>{t("trajectory.s3Title", { cut: fmtPct(s3.targetCut, lang, 0), year: s3.targetYear })}</b>
        <span className="num">{t("trajectory.s3Value", { saved: fmtKt(Math.max(0, savedKt), lang), target: fmtKt(targetKt, lang), share: fmtPct(share, lang, 1) })}</span>
      </div>
      <div className="s3-bar" aria-hidden><i style={{ width: `${Math.min(100, share * 100)}%` }} /></div>
      <p className="small-note">{t("trajectory.s3Note", { base: fmtKt(s3.baseKt, lang), source: tx(s3.source) })}</p>
    </div>
  );
}
