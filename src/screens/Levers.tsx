import { useMemo, useState } from "react";
import { levers } from "../data";
import type { Lever, LeverPlot, LeverType } from "../data/types";
import { fmtPct, fmtPoints, fmtRangePoints, fmtSignedPct, fmtSignedTonnes } from "../engine/format";
import { useApp, useResults, REFERENCE } from "../state/store";
import { useT } from "../i18n/useT";
import { ScreenHead } from "../components/ScreenHead";
import { Card } from "../components/Card";
import { Segmented } from "../components/Segmented";
import { Toggle } from "../components/Toggle";
import { Matrix } from "../components/Matrix";
import { HarveyBall } from "../components/HarveyBall";
import { LeverNumber, PlotTags, StatusPill, TypeBadge, plotLabel } from "../components/LeverBits";

const PLOT_FILTERS: LeverPlot[] = ["1", "2", "3", "4", "transverse", "outside"];
const TYPE_FILTERS: LeverType[] = ["central", "central_stores", "stores"];
type SortKey = "number" | "ratio" | "co2" | "margin";
type Status = "all" | "active" | "inactive";

export function Levers() {
  const { state, dispatch } = useApp();
  const { t, tx, lang } = useT();
  const R = useResults();
  const [plot, setPlot] = useState<LeverPlot | "all">("all");
  const [type, setType] = useState<LeverType | "all">("all");
  const [status, setStatus] = useState<Status>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "number", desc: false });
  const open = (id: string) => dispatch({ type: "drawer", lever: id });

  const q = query.trim().toLocaleLowerCase();
  const shown = levers.filter((l) =>
    (plot === "all" || l.plots.includes(plot)) &&
    (type === "all" || l.type === type) &&
    (status === "all" || (status === "active") === state.activeLevers.includes(l.number)) &&
    (!q || `${l.number} ${tx(l.label)}`.toLocaleLowerCase().includes(q)),
  );
  const value = (l: Lever, key: SortKey) =>
    key === "ratio" ? R.isolated[l.number].mid : key === "co2" ? -R.leverImpact[l.number].co2 : key === "margin" ? l.economics.marginEffect : -l.number;
  const sorted = [...shown].sort((a, b) => {
    const d = value(b, sort.key) - value(a, sort.key) || a.number - b.number;
    return sort.key === "number" ? (sort.desc ? -d : d) : sort.desc ? d : -d;
  });
  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== "number" }));

  const maxHigh = Math.max(...levers.map((l) => R.isolated[l.number].high), 0.0001);
  const maxCo2 = Math.max(...levers.map((l) => Math.abs(R.leverImpact[l.number].co2)), 0.0001);
  const topCo2 = useMemo(
    () => [...levers].filter((l) => state.activeLevers.includes(l.number)).sort((a, b) => R.leverImpact[a.number].co2 - R.leverImpact[b.number].co2)[0],
    [R, state.activeLevers],
  );
  const co2Delta = R.final.co2 - REFERENCE.co2;

  const Head = ({ k, label, className = "" }: { k: SortKey; label: string; className?: string }) => (
    <th className={className} aria-sort={sort.key === k ? (sort.desc ? "descending" : "ascending") : "none"}>
      <button type="button" onClick={() => toggleSort(k)} title={t("levers.sortBy", { col: label })}>
        {label}<i className={`sort ${sort.key === k ? (sort.desc ? "desc" : "asc") : ""}`} aria-hidden />
      </button>
    </th>
  );

  return (
    <>
      <ScreenHead id="levers" status={<StatusPill tone="lav">{t("levers.status", { n: state.activeLevers.length, total: levers.length })}</StatusPill>} />

      <div className="lever-kpis">
        <div className="lkpi">
          <span className="m">{t("levers.kpiActive")}</span>
          <b className="num">{state.activeLevers.length}<small> / {levers.length}</small></b>
        </div>
        <div className="lkpi">
          <span className="m">{t("levers.kpiRatio", { year: state.horizon })}</span>
          <b className="num">{fmtPoints(R.contrib.combined, lang)}</b>
          <small>{fmtPct(R.contrib.base, lang)} → {fmtPct(R.contrib.final, lang)}</small>
        </div>
        <div className="lkpi co2">
          <span className="m">{t("levers.kpiCo2", { year: state.horizon })}</span>
          <b className="num">{fmtSignedPct(R.final.co2 / REFERENCE.co2 - 1, lang)}</b>
          <small>{fmtSignedTonnes(co2Delta, lang)} CO2e · {t("levers.kpiCo2Note")}</small>
        </div>
        <div className="lkpi">
          <span className="m">{t("levers.kpiTopCo2")}</span>
          {topCo2 ? (
            <button type="button" className="top-lever" onClick={() => open(topCo2.id)}>
              <LeverNumber lever={topCo2} size={24} />
              <span>{tx(topCo2.label)}</span>
              <b className="num">{fmtSignedPct(R.leverImpact[topCo2.number].co2, lang)}</b>
            </button>
          ) : <small>{t("trajectory.noLever")}</small>}
        </div>
      </div>

      <div className="toolbar">
        <Segmented label={t("levers.viewList")} value={state.leverView} onChange={(v) => dispatch({ type: "leverView", view: v })}
          options={[{ value: "list", label: t("levers.viewList") }, { value: "matrix", label: t("levers.viewMatrix") }]} />
        <input type="search" className="lsearch" placeholder={t("levers.search")} aria-label={t("levers.search")} value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="filters" role="group" aria-label={t("levers.filterStatus")}>
          <span className="flabel">{t("levers.filterStatus")}</span>
          {(["all", "active", "inactive"] as Status[]).map((s) => (
            <button key={s} type="button" className={`fchip ${status === s ? "on" : ""}`} onClick={() => setStatus(s)}>
              {t(`levers.status${s === "all" ? "All" : s === "active" ? "Active" : "Inactive"}`)}
            </button>
          ))}
        </div>
        <div className="filters" role="group" aria-label={t("levers.filterTypes")}>
          <span className="flabel">{t("levers.filterTypes")}</span>
          <button type="button" className={`fchip ${type === "all" ? "on" : ""}`} onClick={() => setType("all")}>{t("levers.all")}</button>
          {TYPE_FILTERS.map((ty) => (
            <button key={ty} type="button" className={`fchip type t-${ty} ${type === ty ? "on" : ""}`} onClick={() => setType(ty)}><i />{t(`types.${ty}`)}</button>
          ))}
        </div>
        <div className="filters" role="group" aria-label={t("levers.filterPlots")}>
          <span className="flabel">{t("levers.filterPlots")}</span>
          <button type="button" className={`fchip ${plot === "all" ? "on" : ""}`} onClick={() => setPlot("all")}>{t("levers.all")}</button>
          {PLOT_FILTERS.map((p) => (
            <button key={p} type="button" className={`fchip ${plot === p ? "on" : ""} ${p === "outside" ? "outside" : ""}`} onClick={() => setPlot(p)}>{plotLabel(p, t, lang)}</button>
          ))}
        </div>
      </div>

      {state.leverView === "list" ? (
        <Card className="lever-table-card" data-tour="levers" fictitious
          title={t("levers.shown", { n: sorted.length })}
          note={t("levers.tableNote", { year: state.horizon, adoption: fmtPct(state.adoption, lang, 0) })}>
          {sorted.length === 0 && <p className="empty">{t("levers.empty")}</p>}
          <table className="ltable">
            <thead>
              <tr>
                <Head k="number" label="#" className="c-num" />
                <th className="c-lever">{t("levers.colLever")}</th>
                <Head k="ratio" label={t("levers.colRatio")} className="c-ratio" />
                <Head k="co2" label={t("levers.colCo2")} className="c-co2" />
                <Head k="margin" label={t("levers.colMargin")} className="c-margin" />
                <th className="c-active">{t("levers.colActive")}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((l) => {
                const on = state.activeLevers.includes(l.number);
                const e = R.isolated[l.number];
                const c = R.leverImpact[l.number];
                return (
                  <tr key={l.id} className={on ? "on" : ""} onClick={() => open(l.id)} tabIndex={0}
                    onKeyDown={(ev) => { if (ev.key === "Enter") open(l.id); }}>
                    <td className="c-num"><LeverNumber lever={l} size={28} muted={!on} /></td>
                    <td className="c-lever">
                      <b>{tx(l.label)}</b>
                      <span className="lmeta">
                        <TypeBadge type={l.type} />
                        <PlotTags plots={l.plots} />
                        {l.provisional && <span className="chip warn">{t("levers.provisional")}</span>}
                      </span>
                    </td>
                    <td className="c-ratio">
                      {l.effects.length === 0 ? (
                        <span className="noratio">{t("levers.noRatio")}</span>
                      ) : (
                        <>
                          <b className="num">{fmtPoints(e.mid, lang, 2)}</b>
                          <span className="rangebar" aria-hidden>
                            <i className="rng" style={{ left: `${(e.low / maxHigh) * 100}%`, width: `${((e.high - e.low) / maxHigh) * 100}%` }} />
                            <i className="mid" style={{ left: `${(e.mid / maxHigh) * 100}%` }} />
                          </span>
                          <small className="num">{fmtRangePoints(e.low, e.high, lang)}</small>
                        </>
                      )}
                    </td>
                    <td className="c-co2">
                      {Math.abs(c.co2) < 0.00005 ? (
                        <span className="muted small">{fmtSignedPct(0, lang)}</span>
                      ) : (
                        <>
                          <b className={`num ${c.co2 < 0 ? "saving" : "rise"}`}>{fmtSignedPct(c.co2, lang, 2)}</b>
                          <span className="co2bar" aria-hidden><i className={c.co2 < 0 ? "saving" : "rise"} style={{ width: `${(Math.abs(c.co2) / maxCo2) * 100}%` }} /></span>
                          <small className="num">{fmtSignedTonnes(c.co2t, lang)} CO2e</small>
                        </>
                      )}
                    </td>
                    <td className="c-margin"><HarveyBall score={l.economics.marginEffect} size={20} /></td>
                    <td className="c-active" onClick={(ev) => ev.stopPropagation()}>
                      <Toggle on={on} label={on ? t("levers.active") : t("levers.inactive")} onChange={() => dispatch({ type: "toggleLever", number: l.number })} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ) : (
        <Card className="matrix-card" data-tour="levers" note={t("levers.matrixNote")} fictitious
          right={
            <span className="legend">
              {TYPE_FILTERS.map((ty) => <span key={ty}><i className={`sw dot t-${ty}`} />{t(`types.${ty}`)}</span>)}
              <span><i className="sw dot off" />{t("levers.legendInactive")}</span>
              <span><i className="sw dot prov" />{t("levers.provisional")}</span>
            </span>
          }>
          <Matrix levers={sorted} active={state.activeLevers} onOpen={open} />
        </Card>
      )}
    </>
  );
}
