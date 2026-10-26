import { useEffect, useRef } from "react";
import { levers, model } from "../data";
import { adoptionFactor, hypothesisValues, runYear } from "../engine/simulate";
import { evaluate } from "../engine/expr";
import { expressionVars } from "../engine/simulate";
import { fmtNum, fmtPct, fmtRangePoints, fmtSignedPct } from "../engine/format";
import { useApp, useResults, REFERENCE } from "../state/store";
import { presetFields } from "../state/url";
import { useT } from "../i18n/useT";
import { Toggle } from "./Toggle";
import { Slider } from "./Slider";
import { HarveyBall } from "./HarveyBall";
import { PillButton } from "./PillButton";
import { Icon } from "./Icon";
import { LeverNumber, PlotTags, TypeBadge } from "./LeverBits";

/** Lever sheet, a panel on the right reachable from every screen. Any change to an assumption
 *  updates the trajectory at once. */
export function LeverDrawer() {
  const { state, dispatch } = useApp();
  const { t, tx, lang } = useT();
  const R = useResults();
  const panel = useRef<HTMLDivElement>(null);
  const lever = levers.find((l) => l.id === state.drawer);

  useEffect(() => {
    if (!lever) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") dispatch({ type: "drawer", lever: null }); };
    window.addEventListener("keydown", onKey);
    panel.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [lever, dispatch]);

  if (!lever) return null;
  const on = state.activeLevers.includes(lever.number);
  const values = hypothesisValues(lever, state.hypotheses[lever.id]);
  const presetH = state.preset ? presetFields(state.preset).hypotheses[lever.id] : undefined;
  const referenceOf = (id: string, def: number) => presetH?.[id] ?? def;
  const changed = lever.hypotheses.some((h) => values[h.id] !== referenceOf(h.id, h.value));
  const e = R.isolated[lever.number];
  const alone = runYear(model, state, state.horizon, "mid", lever.number).metrics;
  const co2 = alone.co2 / REFERENCE.co2 - 1;
  const end = lever.ramp.startYear + lever.ramp.yearsToFull - 1;
  const tightening = lever.tightensUncertainty ? evaluate(lever.tightensUncertainty, expressionVars(lever, state.hypotheses[lever.id])) : null;
  const close = () => dispatch({ type: "drawer", lever: null });

  return (
    <div className="drawer-wrap" role="presentation" onClick={close}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" ref={panel} tabIndex={-1} onClick={(ev) => ev.stopPropagation()}>
        <header className="drawer-h">
          <div className="drawer-title">
            <LeverNumber lever={lever} size={36} />
            <div>
              <span className="k">{t("drawer.title")} · {t("drawer.draft")}</span>
              <h2 id="drawer-title">{tx(lever.label)}</h2>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={close} aria-label={t("app.close")}><Icon name="close" size={18} /></button>
        </header>
        <div className="drawer-badges">
          <TypeBadge type={lever.type} />
          <PlotTags plots={lever.plots} />
          {lever.provisional && <span className="chip warn">{t("levers.provisional")}</span>}
        </div>
        <div className="drawer-active">
          <span>{t("drawer.active")}</span>
          <Toggle on={on} label={t("drawer.active")} onChange={() => dispatch({ type: "toggleLever", number: lever.number })} />
        </div>

        <div className="drawer-body">
          <section>
            <h3>{t("drawer.description")}</h3>
            <p>{tx(lever.description)}</p>
            <h3>{t("drawer.why")}</h3>
            <p>{tx(lever.whyForU)}</p>
          </section>

          <section className="hyps">
            <div className="sec-h">
              <h3>{t("drawer.hypotheses")}</h3>
              <PillButton variant="secondary" small disabled={!changed} onClick={() => dispatch({ type: "resetLever", lever: lever.id })}>
                <Icon name="reset" size={13} /> {t("drawer.reset")}
              </PillButton>
            </div>
            {lever.hypotheses.map((h) => (
              <Slider key={h.id} h={h} value={values[h.id]} reference={referenceOf(h.id, h.value)}
                onChange={(v) => dispatch({ type: "hypothesis", lever: lever.id, id: h.id, value: v })} />
            ))}
            <p className="meta mono">
              {t("drawer.ramp", { start: lever.ramp.startYear, end })}
              {lever.storeDependency > 0 && (
                <><br />{t("drawer.storeShare", { dep: fmtPct(lever.storeDependency, lang, 0), adoption: fmtPct(state.adoption, lang, 0), factor: fmtPct(adoptionFactor(lever, state.adoption), lang, 0) })}</>
              )}
            </p>
          </section>

          <section className="effect">
            <h3>{t("drawer.effect", { year: state.horizon })}</h3>
            {lever.effects.length === 0 ? (
              <div className="effect-box">
                <p className="big-note">{t("drawer.noRatioEffect")}</p>
                {tightening !== null && <p className="mono small">{t("drawer.tightening", { k: fmtNum(tightening, lang, 2) })}</p>}
              </div>
            ) : (
              <div className="effect-grid">
                <div><span className="m">{t("drawer.ratio")}</span><b className="num">{fmtRangePoints(e.low, e.high, lang)}</b></div>
                <div><span className="m">{t("drawer.co2")}</span><b className="num">{fmtSignedPct(co2, lang)}</b></div>
              </div>
            )}
            <p className="small muted">{t("drawer.effectNote", { adoption: fmtPct(state.adoption, lang, 0) })}</p>
            <div className="effect-grid harveys">
              <div><span className="m">{t("drawer.revenue")}</span><HarveyBall score={lever.economics.revenueEffect} /></div>
              <div><span className="m">{t("drawer.margin")}</span><HarveyBall score={lever.economics.marginEffect} /></div>
            </div>
            <p className="small muted">{t("drawer.qualitative")}</p>
            <div className="effect-grid scores">
              <div><span className="m">{t("drawer.effort")}</span><b className="num">{fmtNum(lever.deckEffort, lang, 1)} <small>/ 10</small></b></div>
              <div><span className="m">{t("drawer.impact")}</span><b className="num">{fmtNum(lever.deckImpact, lang, 1)} <small>/ 10</small></b></div>
            </div>
            {lever.provisional && <p className="small warn-text">{t("drawer.provisional")}</p>}
          </section>

          <section>
            <h3>{t("drawer.owner")}</h3>
            <p>{tx(lever.owner)}</p>
            <h3>{t("drawer.pilot")}</h3>
            <ul className="pilot">
              {tx(lever.pilot).split(/\s(?=(?:Durée|Indicateurs|Go si|Duration|Indicators|Go if)\b)/).map((line) => <li key={line}>{line}</li>)}
            </ul>
          </section>
        </div>
        <footer className="drawer-foot">{t("drawer.footer")}</footer>
      </aside>
    </div>
  );
}


