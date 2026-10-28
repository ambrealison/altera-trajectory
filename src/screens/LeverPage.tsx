import { useEffect } from "react";
import { leverByNumber, levers, model } from "../data";
import type { Hypothesis, Lever } from "../data/types";
import { adoptionFactor, expressionVars, hypothesisValues, runYear } from "../engine/simulate";
import { evaluate } from "../engine/expr";
import { fmtNum, fmtPct, fmtRangePoints, fmtSignedPct } from "../engine/format";
import { useApp, useResults, REFERENCE } from "../state/store";
import { presetFields } from "../state/url";
import { useT } from "../i18n/useT";
import { Card } from "../components/Card";
import { Toggle } from "../components/Toggle";
import { Slider } from "../components/Slider";
import { HarveyBall } from "../components/HarveyBall";
import { PillButton } from "../components/PillButton";
import { Icon } from "../components/Icon";
import { CategoryTags, LeverNumber, StatusPill, TypeBadge } from "../components/LeverBits";
import { I2Tab, I2_TABS } from "./I2Dossier";

const BASE_TABS = ["summary", "assumptions", "evidence"];

/** Tabs of a lever page: the common template, or the full dossier when the lever has one. */
export const leverTabs = (l: Lever) => (l.dossier === "i2" ? I2_TABS : BASE_TABS);

/** Full page of a lever: what it is, its assumptions with their links, its effects and its
 *  evidence. The same template serves the 20 levers; lever 12 carries the full Altera dossier. */
export function LeverPage() {
  const { state, dispatch } = useApp();
  const { t, tx } = useT();
  const lever = levers.find((l) => l.id === state.leverPage);
  useEffect(() => { document.getElementById("main")?.scrollTo({ top: 0 }); }, [state.leverPage, state.leverTab]);
  if (!lever) return null;
  const tabs = leverTabs(lever);
  const tab = tabs.includes(state.leverTab) ? state.leverTab : "summary";
  const on = state.activeLevers.includes(lever.number);
  const i = levers.indexOf(lever);
  const prev = levers[i - 1], next = levers[i + 1];

  return (
    <div className="lp">
      <div className="lp-bar">
        <button type="button" className="link back" onClick={() => dispatch({ type: "closeLever" })}>
          <Icon name="back" size={14} /> {t("lever.back", { screen: t(`steps.${state.screen}`) })}
        </button>
        <span className="lp-nav">
          {prev && <button type="button" className="link" onClick={() => dispatch({ type: "openLever", lever: prev.id, tab })}>← {prev.number}</button>}
          <span className="muted small">{t("lever.position", { n: lever.number, total: levers.length })}</span>
          {next && <button type="button" className="link" onClick={() => dispatch({ type: "openLever", lever: next.id, tab: tabs === leverTabs(next) ? tab : "summary" })}>{next.number} →</button>}
        </span>
      </div>

      <header className="lp-head" data-tour="lp-head">
        <LeverNumber lever={lever} size={52} />
        <div className="lp-title">
          <span className="k">{t("lever.kicker", { n: lever.number })}</span>
          <h1>{tx(lever.label)}</h1>
          <div className="lp-badges">
            <TypeBadge type={lever.type} />
            <CategoryTags lever={lever} max={5} />
            {lever.provisional && <span className="chip warn">{t("levers.provisional")}</span>}
          </div>
        </div>
        <div className="lp-head-r">
          {lever.dossier ? <StatusPill tone="lav">{t("lever.dossierReady")}</StatusPill> : <StatusPill>{t("lever.dossierDraft")}</StatusPill>}
          <label className="lp-active">
            <span>{t("drawer.active")}</span>
            <Toggle on={on} label={t("drawer.active")} onChange={() => dispatch({ type: "toggleLever", number: lever.number })} />
          </label>
        </div>
      </header>

      <nav className="lp-tabs" role="tablist" aria-label={t("lever.tabs")} data-tour="lp-tabs">
        {tabs.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => dispatch({ type: "leverTab", tab: k })}>
            {t(`lever.tab.${k}`)}
          </button>
        ))}
      </nav>

      <div className="lp-body" role="tabpanel">
        {lever.dossier === "i2" && tab !== "assumptions" ? (
          <I2Tab tab={tab} lever={lever} />
        ) : tab === "summary" ? (
          <Summary lever={lever} />
        ) : tab === "assumptions" ? (
          <Assumptions lever={lever} />
        ) : (
          <Evidence lever={lever} />
        )}
      </div>
    </div>
  );
}

/** Lever description, who carries it, the pilot and the effects at the horizon. */
export function Summary({ lever }: { lever: Lever }) {
  const { state } = useApp();
  const { t, tx, lang } = useT();
  const end = lever.ramp.startYear + lever.ramp.yearsToFull - 1;
  return (
    <>
      <div className="grid2">
        <Card title={t("drawer.description")} data-tour="lp-summary">
          <p>{tx(lever.description)}</p>
          <h3 className="sub-h">{t("drawer.why")}</h3>
          <p>{tx(lever.whyForU)}</p>
        </Card>
        <Card title={t("lever.implementation")} data-tour="lp-implementation">
          <dl className="facts">
            <dt>{t("drawer.owner")}</dt><dd>{tx(lever.owner)}</dd>
            <dt>{t("lever.ramp")}</dt><dd>{t("drawer.ramp", { start: lever.ramp.startYear, end })}</dd>
            <dt>{t("lever.stores")}</dt>
            <dd>{lever.storeDependency === 0 ? t("lever.storesNone") : t("drawer.storeShare", { dep: fmtPct(lever.storeDependency, lang, 0), adoption: fmtPct(state.adoption, lang, 0), factor: fmtPct(adoptionFactor(lever, state.adoption), lang, 0) })}</dd>
            <dt>{t("lever.deck")}</dt>
            <dd>{t("lever.deckScores", { effort: fmtNum(lever.deckEffort, lang, 1), impact: fmtNum(lever.deckImpact, lang, 1) })}</dd>
          </dl>
          <h3 className="sub-h">{t("drawer.pilot")}</h3>
          <ul className="pilot">
            {tx(lever.pilot).split(/\s(?=(?:Durée|Indicateurs|Go si|Duration|Indicators|Go if)\b)/).map((line) => <li key={line}>{line}</li>)}
          </ul>
        </Card>
      </div>
      <Effects lever={lever} />
    </>
  );
}

/** The lever alone at the horizon, with the current assumptions and store adoption. */
function Effects({ lever }: { lever: Lever }) {
  const { state } = useApp();
  const { t, lang } = useT();
  const R = useResults();
  const e = R.isolated[lever.number];
  const alone = runYear(model, state, state.horizon, "mid", lever.number).metrics;
  const tightening = lever.tightensUncertainty ? evaluate(lever.tightensUncertainty, expressionVars(lever, state.hypotheses[lever.id])) : null;
  return (
    <Card title={t("drawer.effect", { year: state.horizon })} note={t("drawer.effectNote", { adoption: fmtPct(state.adoption, lang, 0) })} data-tour="lp-effects" fictitious>
      {lever.effects.length === 0 ? (
        <div className="effect-box">
          <p className="big-note">{t("drawer.noRatioEffect")}</p>
          {tightening !== null && <p className="mono small">{t("drawer.tightening", { k: fmtNum(tightening, lang, 2) })}</p>}
        </div>
      ) : (
        <div className="effect-grid four">
          <div><span className="m">{t("drawer.ratio")}</span><b className="num">{fmtRangePoints(e.low, e.high, lang, Math.abs(e.high) < 0.001 ? 3 : Math.abs(e.high) < 0.01 ? 2 : 1)}</b></div>
          <div><span className="m">{t("drawer.co2")}</span><b className="num">{fmtSignedPct(alone.co2 / REFERENCE.co2 - 1, lang, 2)}</b></div>
          <div><span className="m">{t("drawer.revenue")}</span><b className="num">{fmtSignedPct(alone.revenue / REFERENCE.revenue - 1, lang, 2)}</b></div>
          <div><span className="m">{t("drawer.margin")}</span><HarveyBall score={lever.economics.marginEffect} /><small className="muted">{t("drawer.qualitative")}</small></div>
        </div>
      )}
    </Card>
  );
}

/** Assumptions grouped by dependency: an assumption that acts on another sits under it, linked,
 *  and has no effect while the one it depends on is at 0. */
export function Assumptions({ lever }: { lever: Lever }) {
  const { state, dispatch } = useApp();
  const { t, tx, lang } = useT();
  const values = hypothesisValues(lever, state.hypotheses[lever.id]);
  const presetH = state.preset ? presetFields(state.preset).hypotheses[lever.id] : undefined;
  const reference = (id: string, def: number) => presetH?.[id] ?? def;
  const changed = lever.hypotheses.some((h) => values[h.id] !== reference(h.id, h.value));
  const byId = Object.fromEntries(lever.hypotheses.map((h) => [h.id, h]));
  const depth = (h: Hypothesis): number => (h.dependsOn && byId[h.dependsOn] ? 1 + depth(byId[h.dependsOn]) : 0);
  // a parent at 0 switches off everything that depends on it, directly or not
  const off = (h: Hypothesis): Hypothesis | null => {
    const p = h.dependsOn ? byId[h.dependsOn] : undefined;
    if (!p) return null;
    return values[p.id] === 0 ? p : off(p);
  };
  // roots first, each followed by what depends on it
  const ordered: Hypothesis[] = [];
  const visit = (h: Hypothesis) => { ordered.push(h); lever.hypotheses.filter((c) => c.dependsOn === h.id).forEach(visit); };
  lever.hypotheses.filter((h) => !h.dependsOn || !byId[h.dependsOn]).forEach(visit);

  return (
    <>
      {lever.dossier === "i2" && <I2Tab tab="assumptionsHead" lever={lever} />}
      <Card title={t("drawer.hypotheses")} data-tour="lp-assumptions"
        right={
          <PillButton variant="secondary" small disabled={!changed} onClick={() => dispatch({ type: "resetLever", lever: lever.id })}>
            <Icon name="reset" size={13} /> {t("drawer.reset")}
          </PillButton>
        }
        note={t("drawer.footer")}>
        <div className="hyp-tree">
          {ordered.map((h) => {
            const parent = h.dependsOn ? byId[h.dependsOn] : undefined;
            const blocker = off(h);
            return (
              <div key={h.id} className={`hyp-node d${depth(h)} ${blocker ? "off" : ""}`}>
                {parent && (
                  <span className="hyp-link">
                    <Icon name="link" size={12} /> {t("lever.dependsOn", { name: tx(parent.label) })}
                  </span>
                )}
                <Slider h={h} value={values[h.id]} reference={reference(h.id, h.value)} disabled={!!blocker}
                  onChange={(v) => dispatch({ type: "hypothesis", lever: lever.id, id: h.id, value: v })} />
                {blocker && <p className="hyp-off">{t("lever.noEffectWhile", { name: tx(blocker.label) })}</p>}
              </div>
            );
          })}
        </div>
        <p className="meta mono">
          {t("drawer.ramp", { start: lever.ramp.startYear, end: lever.ramp.startYear + lever.ramp.yearsToFull - 1 })}
          {lever.storeDependency > 0 && <><br />{t("drawer.storeShare", { dep: fmtPct(lever.storeDependency, lang, 0), adoption: fmtPct(state.adoption, lang, 0), factor: fmtPct(adoptionFactor(lever, state.adoption), lang, 0) })}</>}
        </p>
      </Card>
      <Effects lever={lever} />
    </>
  );
}

/** Evidence of a lever without a dossier yet: what the dossier will hold, and the way to the
 *  complete example. */
function Evidence({ lever }: { lever: Lever }) {
  const { dispatch } = useApp();
  const { t } = useT();
  const example = leverByNumber(12);
  return (
    <Card title={t("lever.evidenceTitle")} data-tour="lp-evidence">
      <div className="draft-box">
        <StatusPill>{t("lever.dossierDraft")}</StatusPill>
        <p>{t("lever.draftText")}</p>
        <ul className="checklist">
          {["model", "register", "evidence", "gaps"].map((k) => <li key={k}>{t(`lever.draftItem.${k}`)}</li>)}
        </ul>
        {lever.number !== example.number && (
          <PillButton variant="secondary" onClick={() => dispatch({ type: "openLever", lever: example.id })}>
            {t("lever.seeExample", { n: example.number })} <Icon name="arrow" size={14} />
          </PillButton>
        )}
      </div>
    </Card>
  );
}
