import { useState } from "react";
import { levers } from "../data";
import type { LeverPlot, LeverType } from "../data/types";
import { fmtPct, fmtRangePoints } from "../engine/format";
import { useApp, useResults } from "../state/store";
import { useT } from "../i18n/useT";
import { ScreenHead } from "../components/ScreenHead";
import { Card } from "../components/Card";
import { Segmented } from "../components/Segmented";
import { Toggle } from "../components/Toggle";
import { Matrix } from "../components/Matrix";
import { LeverNumber, PlotTags, StatusPill, TypeBadge, plotLabel } from "../components/LeverBits";

const PLOT_FILTERS: LeverPlot[] = ["1", "2", "3", "4", "transverse", "outside"];
const TYPE_FILTERS: LeverType[] = ["central", "central_stores", "stores"];

export function Levers() {
  const { state, dispatch } = useApp();
  const { t, tx, lang } = useT();
  const R = useResults();
  const [plot, setPlot] = useState<LeverPlot | "all">("all");
  const [type, setType] = useState<LeverType | "all">("all");
  const shown = levers.filter((l) => (plot === "all" || l.plots.includes(plot)) && (type === "all" || l.type === type));
  const maxHigh = Math.max(...levers.map((l) => R.isolated[l.number].high), 0.0001);
  const open = (id: string) => dispatch({ type: "drawer", lever: id });

  return (
    <>
      <ScreenHead id="levers" status={<StatusPill tone="lav">{t("levers.status", { n: state.activeLevers.length, total: levers.length })}</StatusPill>} />
      <div className="toolbar">
        <Segmented label={t("levers.viewList")} value={state.leverView} onChange={(v) => dispatch({ type: "leverView", view: v })}
          options={[{ value: "list", label: t("levers.viewList") }, { value: "matrix", label: t("levers.viewMatrix") }]} />
        <div className="filters" role="group" aria-label={t("levers.filterPlots")}>
          <span className="flabel">{t("levers.filterPlots")}</span>
          <button type="button" className={`fchip ${plot === "all" ? "on" : ""}`} onClick={() => setPlot("all")}>{t("levers.all")}</button>
          {PLOT_FILTERS.map((p) => (
            <button key={p} type="button" className={`fchip ${plot === p ? "on" : ""} ${p === "outside" ? "outside" : ""}`} onClick={() => setPlot(p)}>{plotLabel(p, t)}</button>
          ))}
        </div>
        <div className="filters" role="group" aria-label={t("levers.filterTypes")}>
          <span className="flabel">{t("levers.filterTypes")}</span>
          <button type="button" className={`fchip ${type === "all" ? "on" : ""}`} onClick={() => setType("all")}>{t("levers.all")}</button>
          {TYPE_FILTERS.map((ty) => (
            <button key={ty} type="button" className={`fchip type t-${ty} ${type === ty ? "on" : ""}`} onClick={() => setType(ty)}><i />{t(`types.${ty}`)}</button>
          ))}
        </div>
      </div>

      {state.leverView === "list" ? (
        <Card className="lever-list-card" data-tour="levers" fictitious
          title={t("levers.isolated", { year: state.horizon })}
          note={t("levers.isolatedNote", { adoption: fmtPct(state.adoption, lang, 0) })}>
          {shown.length === 0 && <p className="empty">{t("levers.empty")}</p>}
          <ul className="llist">
            {shown.map((l) => {
              const on = state.activeLevers.includes(l.number);
              const e = R.isolated[l.number];
              return (
                <li key={l.id} className={on ? "on" : ""}>
                  <button type="button" className="lrow" onClick={() => open(l.id)}>
                    <LeverNumber lever={l} size={30} muted={!on} />
                    <span className="lmain">
                      <b>{tx(l.label)}</b>
                      <span className="lmeta">
                        <PlotTags plots={l.plots} />
                        {l.provisional && <span className="chip warn">{t("levers.provisional")}</span>}
                      </span>
                    </span>
                    <TypeBadge type={l.type} />
                    <span className="leffect">
                      {l.effects.length === 0 ? (
                        <span className="noratio">{t("levers.noRatio")}</span>
                      ) : (
                        <>
                          <span className="num">{fmtRangePoints(e.low, e.high, lang)}</span>
                          <span className="rangebar" aria-hidden>
                            <i className="rng" style={{ left: `${(e.low / maxHigh) * 100}%`, width: `${((e.high - e.low) / maxHigh) * 100}%` }} />
                            <i className="mid" style={{ left: `${(e.mid / maxHigh) * 100}%` }} />
                          </span>
                        </>
                      )}
                    </span>
                  </button>
                  <Toggle on={on} label={on ? t("levers.active") : t("levers.inactive")} onChange={() => dispatch({ type: "toggleLever", number: l.number })} />
                </li>
              );
            })}
          </ul>
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
          <Matrix levers={shown} active={state.activeLevers} onOpen={open} />
        </Card>
      )}
    </>
  );
}
