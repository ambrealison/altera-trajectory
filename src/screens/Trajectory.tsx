import { useMemo } from "react";
import { config, levers, model, scenarios } from "../data";
import { runYear } from "../engine/simulate";
import { fmtPct, fmtPoints, fmtSignedPct, fmtSignedTonnes } from "../engine/format";
import { useApp, useResults, REFERENCE } from "../state/store";
import { matchingPreset, presetFields } from "../state/url";
import { useT } from "../i18n/useT";
import { ScreenHead } from "../components/ScreenHead";
import { Card } from "../components/Card";
import { Segmented } from "../components/Segmented";
import { Toggle } from "../components/Toggle";
import { PillButton } from "../components/PillButton";
import { Icon } from "../components/Icon";
import { LeverNumber, StatusPill } from "../components/LeverBits";
import { Waterfall } from "../components/Waterfall";
import { TrajectoryChart } from "../components/TrajectoryChart";
import { StackedArea, type Layer } from "../components/StackedArea";
import type { YearResult } from "../engine/simulate";
import type { MetricKey } from "../state/types";

const PLOT_LAYERS = ["other", "composite", "4", "3", "2", "1"] as const;
const LAYER_COLOR: Record<(typeof PLOT_LAYERS)[number], string> = {
  other: "var(--plot-other)", composite: "var(--plot-composite)", "4": "var(--plot-4)", "3": "var(--plot-3)", "2": "var(--plot-2)", "1": "var(--plot-1)",
};

/** Plant share by plot in ratio points, for one year. */
function plotPoints(r: YearResult, metric: MetricKey): Record<string, number> {
  const out: Record<string, number> = {};
  if (metric === "pt") for (const k of PLOT_LAYERS) out[k] = (100 * r.plots[k]) / r.proteinTotal;
  else {
    const total = Object.values(r.fg1Plots).reduce((a, v) => a + v, 0);
    for (const k of PLOT_LAYERS) out[k] = total > 0 ? (100 * r.fg1Plots[k]) / total : 0;
  }
  return out;
}

export function Trajectory() {
  const { state, dispatch } = useApp();
  const { t, tx, lang } = useT();
  const R = useResults();
  const metric = state.metric;
  const current = matchingPreset(state);
  const ref = REFERENCE[metric];
  const fin = R.final;
  const storeDependent = state.activeLevers.some((n) => levers.find((l) => l.number === n)!.storeDependency > 0);

  const presetValues = useMemo(
    () => Object.fromEntries(scenarios.map((s) => [s.id, runYear(model, presetFields(s.id), state.horizon).metrics[metric]])),
    [state.horizon, metric],
  );

  const pinnedName = state.pinned ? (state.pinned.preset ? tx(scenarios.find((x) => x.id === state.pinned!.preset)!.label) : t("trajectory.custom")) : undefined;
  const pinnedFinal = R.pinnedSeries ? R.pinnedSeries[R.pinnedSeries.length - 1][metric] : null;
  const scenarioName = current ? tx(scenarios.find((s) => s.id === current)!.label) : t("trajectory.custom");

  const points = R.series.map((r) => ({ year: r.year, v: r[metric], lo: Math.min(r.low[metric], r.high[metric]), hi: Math.max(r.low[metric], r.high[metric]) }));
  // the observed Dutch pace is only drawn up to 2030: extrapolating two observed years further would mislead
  const showDutch = metric === "pt" && state.horizon <= config.extension.fromYear;
  const dutch = showDutch ? R.series.map((r) => ({ year: r.year, v: REFERENCE.pt + (config.benchmark.pointsPerYear / 100) * (r.year - config.baseYear) })) : undefined;
  const ghost = R.pinnedSeries?.map((r) => ({ year: r.year, v: r[metric] }));
  const layers: Layer[] = PLOT_LAYERS
    .map((k) => ({ key: k, label: k === "composite" ? t("trajectory.stackComposite") : tx(config.plots[k]), color: LAYER_COLOR[k] }))
    .filter((l) => metric === "pt" || R.series.some((r) => plotPoints(r, metric)[l.key] > 0));
  const rows = R.series.map((r) => ({ year: r.year, ...plotPoints(r, metric) }));
  const co2Delta = fin.co2 - REFERENCE.co2;
  const showOverlap = Math.abs(R.contrib.overlap) >= 0.001;

  return (
    <>
      <ScreenHead id="trajectory" status={<StatusPill tone="lav">{scenarioName}</StatusPill>} />
      <div className="traj">
        <aside className="traj-side">
          <Card title={t("trajectory.scenarios")} data-tour="scenarios">
            <div className="presets">
              {scenarios.map((s) => (
                <button key={s.id} type="button" className={`preset ${current === s.id ? "on" : ""}`} aria-pressed={current === s.id}
                  onClick={() => dispatch({ type: "preset", id: s.id })} title={tx(s.description)}>
                  <b>{tx(s.label)}</b>
                  <span className="num">{fmtPct(presetValues[s.id], lang)}</span>
                </button>
              ))}
            </div>
            <div className="pinrow">
              {state.pinned ? (
                <span className="pinned-chip">
                  <Icon name="pin" size={13} />
                  <span>{t("trajectory.pinned", { name: pinnedName ?? "", value: pinnedFinal !== null ? fmtPct(pinnedFinal, lang) : "" })}</span>
                  <button type="button" onClick={() => dispatch({ type: "unpin" })}>{t("trajectory.unpin")}</button>
                </span>
              ) : (
                <PillButton variant="secondary" small onClick={() => dispatch({ type: "pin" })}>
                  <Icon name="pin" size={13} /> {t("trajectory.pin")}
                </PillButton>
              )}
            </div>
          </Card>

          <Card title={t("trajectory.adoption")} data-tour="adoption">
            <div className="adopt">
              <input type="range" min={0} max={100} step={10} value={Math.round(state.adoption * 100)} aria-label={t("trajectory.adoption")}
                style={{ ["--p" as string]: `${state.adoption * 100}%` }}
                onChange={(e) => dispatch({ type: "adoption", adoption: Number(e.target.value) / 100 })} />
              <b className="num">{fmtPct(state.adoption, lang, 0)}</b>
            </div>
            <p className="small-note">{t("trajectory.adoptionNote")}</p>
            {!storeDependent && <p className="small-note warn">{t("trajectory.adoptionNoEffect")}</p>}
            <div className="horizon">
              <span>{t("trajectory.horizon")}</span>
              <Segmented label={t("trajectory.horizon")} size="sm" value={state.horizon} onChange={(h) => dispatch({ type: "horizon", horizon: h })}
                options={config.horizons.map((h) => ({ value: h, label: String(h) }))} />
            </div>
            {state.horizon > config.extension.fromYear && (
              <p className="small-note">{t("trajectory.extensionNote", { year: config.extension.fromYear, rate: fmtPct(config.extension.ratePerYear, lang, 0) })}</p>
            )}
          </Card>

          <Card title={t("trajectory.leversTitle")} right={<span className="count">{t("trajectory.leversCount", { n: state.activeLevers.length, total: levers.length })}</span>}>
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
          <div className="kpis">
            <div className="kpi pt">
              <span className="m">{t("trajectory.kpiRatio", { year: state.horizon })} · {t(`metric.${metric}`)}</span>
              <b className="num">{fmtPct(fin[metric], lang)}</b>
              <span className="d">{fmtPoints(fin[metric] - ref, lang)} {t("trajectory.vsRef")}</span>
              <span className="ref">{t("trajectory.kpiRange", { low: fmtPct(Math.min(fin.low[metric], fin.high[metric]), lang), high: fmtPct(Math.max(fin.low[metric], fin.high[metric]), lang) })}</span>
            </div>
            <div className="kpi plain">
              <span className="m">{t("trajectory.kpiCo2", { year: state.horizon })}</span>
              <b className="num">{fmtSignedPct(fin.co2 / REFERENCE.co2 - 1, lang)}</b>
              <span className="d">{fmtSignedTonnes(co2Delta, lang)} CO2e {t("trajectory.vsRef")}</span>
              <span className="ref">{t("trajectory.kpiCo2Note")}</span>
            </div>
            <div className="kpi plain">
              <span className="m">{t("trajectory.kpiRevenue", { year: state.horizon })}</span>
              <b className="num">{fmtSignedPct(fin.revenue / REFERENCE.revenue - 1, lang)}</b>
              <span className="d">{t("trajectory.vsRef")}</span>
              <span className="ref">{t("trajectory.kpiRevenueNote")}</span>
            </div>
          </div>

          <Card className="chart-card" data-tour="chart" fictitious
            title={state.chartView === "lever" ? t("trajectory.chartTitleLever", { from: config.baseYear, to: state.horizon }) : t("trajectory.chartTitleTime")}
            right={
              <>
                <Segmented label={t("metric.label")} size="sm" value={metric} onChange={(m) => dispatch({ type: "metric", metric: m })}
                  options={[{ value: "pt", label: t("metric.pt") }, { value: "fg1", label: t("metric.fg1") }]} />
                <Segmented label={t("trajectory.byLever")} value={state.chartView} onChange={(v) => dispatch({ type: "chartView", view: v })}
                  options={[{ value: "lever", label: t("trajectory.byLever") }, { value: "time", label: t("trajectory.overTime") }]} />
              </>
            }
            note={showDutch && state.chartView === "time"
              ? t("trajectory.dutchSource", { text: tx(config.benchmark.text), source: tx(config.benchmark.source) })
              : metric === "pt" ? t("metric.ptLong") : t("metric.fg1Long")}>
            {state.activeLevers.length === 0 && <p className="empty">{t("trajectory.noLever")}</p>}
            {state.chartView === "lever" ? (
              <>
                <Waterfall contrib={R.contrib} low={Math.min(fin.low[metric], fin.high[metric])} high={Math.max(fin.low[metric], fin.high[metric])}
                  baseYear={config.baseYear} horizon={state.horizon}
                  pinned={pinnedFinal !== null && pinnedName ? { name: pinnedName, value: pinnedFinal } : null}
                  onOpen={(id) => dispatch({ type: "drawer", lever: id })} />
                <div className="wf-foot">
                  <div className="legend">
                    <span><i className="sw ref" />{t("trajectory.reference", { year: config.baseYear })}</span>
                    <span><i className="sw t-central" />{t("types.central")}</span>
                    <span><i className="sw t-central_stores" />{t("types.central_stores")}</span>
                    <span><i className="sw t-stores" />{t("types.stores")}</span>
                    <span><i className="sw final" />{t("trajectory.yourTrajectory", { year: state.horizon })}</span>
                  </div>
                  {showOverlap && (
                    <div className="overlap">
                      <span>{t("trajectory.sumIsolated")} <b className="num">{fmtPoints(R.contrib.sumIsolated, lang)}</b></span>
                      <span>{t("trajectory.combined")} <b className="num">{fmtPoints(R.contrib.combined, lang)}</b></span>
                      <span className="ov">{t("trajectory.overlap")} <b className="num">{fmtPoints(R.contrib.overlap, lang, 1, false)}</b></span>
                      <small>{t("trajectory.overlapNote")}</small>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <TrajectoryChart points={points} dutch={dutch} ghost={ghost} ghostName={pinnedName} />
                <div className="legend">
                  <span><i className="sw line" />{t(`metric.${metric}`)}</span>
                  <span><i className="sw band" />{t("trajectory.band")}</span>
                  {dutch && <span><i className="sw dutch" />{t("trajectory.dutchPace")}</span>}
                  {ghost && <span><i className="sw ghostl" />{t("trajectory.ghost")}</span>}
                </div>
                <div className="subchart">
                  <div className="ctitle"><span>{t("trajectory.stackTitle")}</span><span className="ctitle-r small">{metric === "pt" ? t("trajectory.stackNotePt") : t("trajectory.stackNoteFg1")}</span></div>
                  <StackedArea rows={rows} layers={layers} />
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
