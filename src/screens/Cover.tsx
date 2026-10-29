import { useMemo } from "react";
import { config, dataset, leverByNumber, model, scenarios } from "../data";
import type { Lever } from "../data/types";
import { contributions } from "../engine/contributions";
import { fmtPct } from "../engine/format";
import { useApp } from "../state/store";
import { matchingPreset } from "../state/url";
import { SCREENS } from "../state/types";
import { useT } from "../i18n/useT";
import { DemoBadge } from "../components/DemoBadge";
import { Segmented } from "../components/Segmented";
import { Icon } from "../components/Icon";

const TYPE_FILL: Record<Lever["type"], string> = { central: "var(--type-central)", central_stores: "var(--type-cs)", stores: "var(--type-stores)" };

/** A glimpse of the trajectory screen, computed from the scenario the tool opens on. */
function Peek() {
  const { state } = useApp();
  const { t, tx, lang } = useT();
  const year = config.defaultHorizon;
  const { activeLevers, adoption, hypotheses } = state;
  const c = useMemo(() => contributions(model, { activeLevers, adoption, hypotheses }, year, "pt"), [activeLevers, adoption, hypotheses, year]);
  const preset = matchingPreset(state);
  const name = preset ? tx(scenarios.find((s) => s.id === preset)!.label) : t("trajectory.custom");

  // mini waterfall: reference, one step per lever, final bar
  const W = 520, H = 210, pad = 6;
  const lo = Math.floor(c.base * 100 - 2) / 100, hi = Math.ceil(c.final * 100 + 1) / 100;
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * (H - 24);
  const n = c.steps.length + 4;
  const u = (W - 2 * pad) / n;
  let cum = c.base;
  const steps = c.steps.map((s, i) => {
    const from = cum;
    cum += s.value;
    return { x: pad + (2 + i) * u, from, to: cum, lever: leverByNumber(s.number) };
  });

  return (
    <div className="peek" aria-hidden>
      <div className="peek-frame">
        <div className="peek-win">
          <div className="peek-bar">
            <span className="wlogo">Altera<em>.ai</em></span>
            <span className="crumb"><b>{tx(dataset.client)}</b> · {tx(config.title)}</span>
            <span className="mini-badge">{t("app.fictitious")}</span>
          </div>
          <div className="peek-body">
            <div className="peek-kpis">
              <div>
                <span className="m">{t("cover.peekRef", { year: config.baseYear })}</span>
                <b className="ref num">{fmtPct(c.base, lang)}</b>
              </div>
              <span className="peek-arrow"><Icon name="arrow" size={22} /></span>
              <div>
                <span className="m">{t("cover.peekTarget", { name, year })}</span>
                <b className="num">{fmtPct(c.final, lang)}</b>
              </div>
              <span className="peek-levers">{t("cover.peekLevers", { n: c.steps.length })}</span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="peek-chart">
              <rect x={pad + u * 0.3} y={y(c.base)} width={u * 1.4} height={H - y(c.base)} rx={5} fill="var(--ink)" />
              {steps.map((s) => (
                <rect key={s.lever.id} x={s.x + u * 0.16} y={y(Math.max(s.from, s.to))} width={u * 0.68} height={Math.max(2, Math.abs(y(s.from) - y(s.to)))} rx={3}
                  fill={TYPE_FILL[s.lever.type]} stroke={s.lever.type === "stores" ? "var(--type-stores-ring)" : "none"} strokeWidth={1.5} />
              ))}
              <rect x={pad + (n - 2) * u + u * 0.3} y={y(c.final)} width={u * 1.4} height={H - y(c.final)} rx={5} fill="var(--peach)" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Cover page, shown on arrival: title, one sentence, "Let's go". */
export function Cover() {
  const { state, dispatch } = useApp();
  const { t, tx } = useT();
  return (
    <div className="cover-page">
      <header className="cover-top">
        <div className="logo"><b>Altera<em>.ai</em></b></div>
        <span className="spacer" />
        <DemoBadge />
        <Segmented label={t("app.language")} size="sm" value={state.lang} onChange={(lang) => dispatch({ type: "lang", lang })}
          options={[{ value: "fr", label: "FR" }, { value: "en", label: "EN" }]} />
      </header>

      <main className="cover-main">
        <div className="cover-text">
          <p className="eyebrow rise">{t("cover.eyebrow")}</p>
          <h1 className="display rise d1">{t("cover.title")}</h1>
          <p className="lead rise d2">{t("cover.lead")}</p>
          <div className="cover-actions rise d3">
            <button type="button" className="pill pill-primary pill-xl" onClick={() => dispatch({ type: "enter" })}>
              {t("cover.cta")} <Icon name="arrow" size={18} />
            </button>
            <span className="meta">{t("cover.meta")}</span>
          </div>
          <ol className="cover-steps rise d4">
            {SCREENS.map((id, i) => (
              <li key={id}><span>{i + 1}</span>{t(`steps.${id}`)}</li>
            ))}
          </ol>
        </div>
        <div className="cover-visual rise d3">
          <Peek />
        </div>
      </main>

      <footer className="foot">
        <span>{tx(config.footer.left)}</span>
        <span>{dataset.footer}</span>
      </footer>
    </div>
  );
}
