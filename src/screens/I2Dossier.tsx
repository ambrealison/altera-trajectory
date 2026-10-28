import { useMemo, useState } from "react";
import { dataset, leverByNumber } from "../data";
import type { Lang, Lever, Text } from "../data/types";
import dossierJson from "../data/dossiers/i2.json";
import { i2Year, splitSteps, tornado, type I2Key, type I2Metric, type I2Params, type I2Year } from "../engine/i2";
import { fmtNum, fmtPct, fmtSignedEuros, fmtSignedKt, fmtSignedNum, fmtTonnes } from "../engine/format";
import { useApp } from "../state/store";
import { LINKED, useI2, useI2MonteCarlo } from "../state/useI2";
import { fill, useT } from "../i18n/useT";
import { Card } from "../components/Card";
import { Segmented } from "../components/Segmented";
import { PillButton } from "../components/PillButton";
import { Icon } from "../components/Icon";
import { TrajectoryChart } from "../components/TrajectoryChart";
import { Histogram, Tornado, YearBars } from "../components/MiniCharts";
import { Summary } from "./LeverPage";

export const I2_TABS = ["summary", "assumptions", "model", "margin", "carbonEffort", "uncertainty", "register", "evidence", "gaps"];

type Ev = { id: string; tier: string; title: string; titleEn?: string; country: string; variant: string; status: string; text: Text; flags: Text; url: string | null };
interface Dossier {
  definition: Text; counterfactual: Text; leavesOut: Text;
  versions: Record<"A" | "B", Text>; versionNote: Record<"A" | "B", Text>;
  scenario: { k: Text; v: Text; s: Text }[];
  findings: { id: string; t: Text; dir: string; conf: Text; basis: string }[];
  variants: Record<string, Text>;
  evidence: Ev[];
  counter: Text[]; risks: Text[]; barriers: Text[]; commercial: Text[]; notHeld: Text[]; gaps: Text[];
  retailers: { country: string; retailer: string | Text; activity: Text; variant: string; ids: string }[];
  scorecards: { volume: { score: number; max: number; rating: Text }; quality: { score: number; max: number; rating: Text }; framing: { k: Text; prom: string; negl: string }[]; note: Text };
  messages: Record<string, Text>;
  register: { group: Text; rows: { key: I2Key; label: Text; unit: string }[] }[];
  tiers: Record<string, Text>; statuses: Record<string, Text>; countries: Record<string, Text>;
}
const D = dossierJson as unknown as Dossier;
const LABEL = Object.fromEntries(D.register.flatMap((g) => g.rows.map((r) => [r.key, r]))) as Record<I2Key, { key: I2Key; label: Text; unit: string }>;
const YEARS = [2028, 2030, 2035];

/** A register value in its unit. */
export function fmtUnit(v: number, unit: string, lang: Lang): string {
  const fr = lang === "fr";
  const nb = " ";
  const n = (d: number) => fmtNum(v, lang, d);
  const auto = Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2;
  switch (unit) {
    case "t": return fmtTonnes(v, lang);
    case "tprot": return `${fmtTonnes(v, lang)}${fr ? " de protéines" : " of protein"}`;
    case "pct": return fmtPct(v, lang, Math.abs(v) < 0.1 && v !== 0 ? 1 : Math.abs(v * 100) % 1 > 0.05 ? 1 : 0);
    case "Mkg": return fr ? `${n(1)}${nb}M de kg` : `${n(1)}m kg`;
    case "MEUR": return fr ? `${n(1)}${nb}M€` : `€${n(1)}m`;
    case "year": return n(2).replace(/[,.]00$/, "");
    case "years": return fr ? `${n(v % 1 ? 1 : 0)}${nb}an${v >= 2 ? "s" : ""}` : `${n(v % 1 ? 1 : 0)} year${v === 1 ? "" : "s"}`;
    case "stores": return fr ? `${n(0)} magasins` : `${n(0)} stores`;
    case "coef": return n(2);
    case "g100": return `${n(1)}${nb}g/100${nb}g`;
    case "eurkg": return fr ? `${n(2)}${nb}€/kg` : `€${n(2)}/kg`;
    case "eurh": return fr ? `${n(2)}${nb}€/h` : `€${n(2)}/h`;
    case "eurday": return fr ? `${n(0)}${nb}€/jour` : `€${n(0)}/day`;
    case "eur": return fr ? `${n(0)}${nb}€` : `€${n(0)}`;
    case "kgco2": return `${n(2)}${nb}kg${nb}CO2e/kg`;
    case "h": return `${n(1)}${nb}h`;
    case "hweek": return fr ? `${n(2)}${nb}h/sem.` : `${n(2)} h/wk`;
    case "days": return fr ? `${n(0)}${nb}j` : `${n(0)} d`;
    case "sku": return fr ? `${n(0)} réf.` : `${n(0)} products`;
    default: return n(auto);
  }
}

const pp = (v: number, lang: Lang, d = 4) => `${fmtSignedNum(v, lang, d)}${lang === "fr" ? " pt" : " pp"}`;
const meur = (v: number, lang: Lang) => fmtSignedEuros(v, lang);
const kt = (v: number, lang: Lang) => fmtSignedKt(v, lang, 2);
const pdays = (v: number, lang: Lang) => (lang === "fr" ? `${fmtNum(v, lang, 0)} jours-personne` : `${fmtNum(v, lang, 0)} person-days`);
const METRIC_FMT: Record<I2Metric, (v: number, lang: Lang) => string> = { pp: (v, l) => pp(v, l), net: meur, co2kt: kt, cumPersonDays: pdays };

/** Values the dossier texts cite as {v0}, {stores}... from the live register. */
function vars(p: I2Params, row: I2Year, lang: Lang) {
  const s = splitSteps(p, row);
  const breakEven = (p["G.E_PBM"] * p["G.MEAT_PROT"]) / (p["G.PBM_PROT"] * p["G.E_MEAT"]);
  const plantPrice = p["G.PBM_EUR_FR"] / p["G.PBM_KG_FR"] / (1 + p["G.VAT"]);
  return {
    v0: fmtTonnes(p["I2.V0_T"], lang), stores: fmtNum(p["G.N_STORES_SCOPE"], lang, 0), nNow: fmtNum(p["RG.N_NOW"], lang, 0), nTarget: fmtNum(p["RG.N_TARGET"], lang, 0),
    pool: fmtTonnes(p["G.POOL_T"], lang), r0: fmtPct(p["G.R0"], lang, 1), rgYears: fmtNum(p["RG.ROLLOUT_Y"], lang, 0), rgStart: Math.floor(p["RG.T_FIRST"]),
    taste: fmtPct(p["RG.TASTE"], lang, 0), need: fmtTonnes(s.need, lang), multiple: fmtNum(s.multiple, lang, 0),
    plantPrice: fmtUnit(plantPrice, "eurkg", lang), meatPrice: fmtUnit(p["G.MEAT_PRICE_HT"], "eurkg", lang), breakEven: fmtNum(breakEven, lang, 2), draws: fmtNum(10000, lang, 0),
  };
}

export function I2Tab({ tab, lever }: { tab: string; lever: Lever }) {
  switch (tab) {
    case "summary": return <Synthesis lever={lever} />;
    case "assumptionsHead": return <AssumptionsHead />;
    case "model": return <ModelTab />;
    case "margin": return <MarginTab />;
    case "carbonEffort": return <CarbonEffortTab />;
    case "uncertainty": return <UncertaintyTab />;
    case "register": return <RegisterTab />;
    case "evidence": return <EvidenceTab />;
    case "gaps": return <GapsTab />;
    default: return null;
  }
}

/** Version and year switches shared by the dossier tabs. */
function VersionBar({ year, setYear }: { year?: number; setYear?: (y: number) => void }) {
  const { state, dispatch } = useApp();
  const { t, tx, lang } = useT();
  const I = useI2();
  const v = state.i2.rangeBuild ? "B" : "A";
  return (
    <div className="i2-bar" data-tour="i2-version">
      <Segmented label={t("i2.version")} value={v} onChange={(x) => dispatch({ type: "i2Version", rangeBuild: x === "B" })}
        options={(["A", "B"] as const).map((k) => ({ value: k, label: tx(D.versions[k]) }))} />
      {year !== undefined && setYear && (
        <Segmented label={t("i2.year")} size="sm" value={year} onChange={setYear} options={YEARS.map((y) => ({ value: y, label: String(y) }))} />
      )}
      <span className="small muted">{fill(tx(D.versionNote[v]), vars(I.params, i2Year(I.rows, 2030), lang))}</span>
      {I.changed > 0 && (
        <PillButton variant="ghost" small onClick={() => dispatch({ type: "i2Reset" })}><Icon name="reset" size={12} /> {t("i2.resetRegister", { n: I.changed })}</PillButton>
      )}
    </div>
  );
}

function useYear() {
  return useState(2030);
}

function Synthesis({ lever }: { lever: Lever }) {
  const { t, tx, lang } = useT();
  const I = useI2();
  const [year, setYear] = useYear();
  const row = i2Year(I.rows, year);
  const mc = useI2MonteCarlo(I.values, I.rangeBuild, year);
  const V = vars(I.params, row, lang);
  const tile = (m: I2Metric, label: string, value: number, note: string) => {
    const s = mc.byMetric[m];
    return (
      <div className="i2-tile">
        <span className="m">{label}</span>
        <b className="num">{m === "cumPersonDays" ? <>{fmtNum(value, lang, 0)} <small>{t("i2.colDays").toLocaleLowerCase()}</small></> : METRIC_FMT[m](value, lang)}</b>
        <span className="d">{t("i2.median", { v: METRIC_FMT[m](s.median, lang) })}</span>
        <span className="ref">{t("i2.p10p90", { lo: METRIC_FMT[m](s.p10, lang), hi: METRIC_FMT[m](s.p90, lang) })}</span>
        <span className="ref">{note}</span>
      </div>
    );
  };
  const other = I.rangeBuild ? I.rowsA : I.rowsB;
  const line = (rows: I2Year[]) => rows.map((r) => ({ year: r.year, v: r.pp, lo: r.pp, hi: r.pp }));
  return (
    <>
      <VersionBar year={year} setYear={setYear} />
      <div className="i2-tiles" data-tour="i2-tiles">
        {tile("pp", t("i2.tilePp", { year }), row.pp, t("i2.tilePpNote", { t: fmtTonnes(row.dP / 1000, lang) }))}
        {tile("net", t("i2.tileNet", { year }), row.net, t("i2.tileNetNote", { share: fmtPct(mc.byMetric.net.belowZero, lang, 0) }))}
        {tile("co2kt", t("i2.tileCo2", { year }), row.co2kt, row.co2kt > 0 ? t("i2.tileCo2Up") : t("i2.tileCo2Down"))}
        {tile("cumPersonDays", t("i2.tileEffort", { year }), row.cumPersonDays, t("i2.tileEffortNote"))}
      </div>
      <div className="card keymsg i2-msg">
        <span className="k">{t("i2.keyMessage")}</span>
        <h2>{tx(D.messages.headline)}</h2>
        <p>{fill(tx(D.messages.scale), V)}</p>
        <p className="small muted">{fill(tx(D.messages.median), V)}</p>
      </div>
      <Card title={t("i2.yearTitle")} note={t("i2.yearNote")} data-tour="i2-year" fictitious={dataset.kind === "public"}>
        <TrajectoryChart points={line(I.rows)} ghost={line(other).map(({ year: y, v }) => ({ year: y, v }))} ghostName={tx(D.versions[I.rangeBuild ? "A" : "B"])}
          fmt={(v) => pp(v, lang, 3)} zero={0} label={t("i2.yearTitle")} />
      </Card>
      <div className="grid2">
        <Card title={t("i2.whatTitle")}>
          <p>{tx(D.definition)}</p>
          <p>{tx(D.counterfactual)}</p>
          <p className="small muted">{tx(D.leavesOut)}</p>
        </Card>
        <Card title={t("i2.scenarioTitle")} data-tour="i2-scenario">
          <dl className="facts">
            {D.scenario.map((r) => (
              <div key={r.k.en} className="fact">
                <dt>{tx(r.k)}</dt>
                <dd>{fill(tx(r.v), V)}<small>{tx(r.s)}</small></dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
      <Summary lever={lever} />
    </>
  );
}

function AssumptionsHead() {
  const { t } = useT();
  return (
    <>
      <VersionBar />
      <p className="lp-intro">{t("i2.assumptionsIntro")}</p>
    </>
  );
}

function ModelTab() {
  const { t, lang } = useT();
  const I = useI2();
  const [year, setYear] = useYear();
  const a = splitSteps(I.params, i2Year(I.rowsA, year));
  const b = splitSteps(I.params, i2Year(I.rowsB, year));
  const T1 = (v: number) => fmtNum(v, lang, v >= 1000 ? 0 : v >= 10 ? 1 : 2);
  const steps: [string, string, (s: typeof a) => string][] = [
    ["s1", "G.POOL_T", (s) => T1(s.T)],
    ["s2", "G.R0", (s) => fmtPct(s.R0, lang, 2)],
    ["s3", "R0 × T", (s) => T1(s.P0)],
    ["s4", "T - P0", (s) => T1(s.A0)],
    ["s5", "I2.V0_T, G.PBM_GROWTH, RG.*", (s) => T1(s.baseT)],
    ["s6", "I2.UPLIFT", (s) => T1(s.addedT)],
    ["s7", "G.PBM_PROT", (s) => T1(s.dP)],
    ["s8", "I2.DISPL, I2.MEAT_EFFECT", (s) => fmtSignedNum(s.dA, lang, 2)],
    ["s9", "1 + 7 + 8", (s) => T1(s.after)],
    ["s10", "3 + 7", (s) => T1(s.plantAfter)],
    ["s11", "10 / 9", (s) => fmtPct(s.share, lang, 4)],
    ["s12", "100 × (11 - R0)", (s) => pp(s.pp, lang)],
    ["s13", "0,01 × T / (1 - R0 - 0,01)", (s) => T1(s.need)],
    ["s14", "13 / 7", (s) => (Number.isFinite(s.multiple) ? `${fmtNum(s.multiple, lang, 0)} ×` : "")],
  ];
  return (
    <>
      <VersionBar year={year} setYear={setYear} />
      <Card title={t("i2.modelTitle", { year })} note={t("i2.modelNote")} data-tour="i2-steps" fictitious={dataset.kind === "public"}>
        <table className="i2-table steps">
          <thead><tr><th>#</th><th>{t("i2.colStep")}</th><th className="r">{t("i2.colA")}</th><th className="r">{t("i2.colB")}</th><th>{t("i2.colFormula")}</th></tr></thead>
          <tbody>
            {steps.map(([k, f, g], i) => (
              <tr key={k} className={k === "s12" ? "hl" : ""}>
                <td className="num">{i + 1}</td><td>{t(`i2.step.${k}`)}</td><td className="r num">{g(a)}</td><td className="r num">{g(b)}</td><td className="mono small">{f}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title={t("i2.formulaTitle")} data-tour="i2-formula">
        <pre className="formula">{t("i2.formula")}</pre>
        <p className="small muted">{t("i2.formulaNote")}</p>
      </Card>
      <Card title={t("i2.yearTable")}>
        <YearTable />
      </Card>
    </>
  );
}

function YearTable() {
  const { t, lang } = useT();
  const I = useI2();
  const ys = I.rowsA.filter((r) => r.year >= 2026);
  return (
    <div className="table-scroll">
      <table className="i2-table years">
        <thead><tr><th />{ys.map((r) => <th key={r.year} className="r">{r.year}</th>)}</tr></thead>
        <tbody>
          <tr><td>{t("i2.rowAddedA")}</td>{ys.map((r) => <td key={r.year} className="r num">{fmtNum(r.addedKg / 1000, lang, 0)}</td>)}</tr>
          <tr><td>{t("i2.rowPpA")}</td>{ys.map((r) => <td key={r.year} className="r num">{fmtSignedNum(r.pp, lang, 4)}</td>)}</tr>
          <tr><td>{t("i2.rowAddedB")}</td>{I.rowsB.filter((r) => r.year >= 2026).map((r) => <td key={r.year} className="r num">{fmtNum(r.addedKg / 1000, lang, 0)}</td>)}</tr>
          <tr><td>{t("i2.rowPpB")}</td>{I.rowsB.filter((r) => r.year >= 2026).map((r) => <td key={r.year} className="r num">{fmtSignedNum(r.pp, lang, 4)}</td>)}</tr>
          <tr><td>{t("i2.rowStores")}</td>{ys.map((r) => <td key={r.year} className="r num">{fmtNum(r.storesLive, lang, 0)}</td>)}</tr>
        </tbody>
      </table>
    </div>
  );
}

/** Tornado of one metric for the current version, labels from the register. */
function TornadoCard({ metric, year, title }: { metric: I2Metric; year: number; title: string }) {
  const { t, tx, lang } = useT();
  const I = useI2();
  const rows = tornado(I.values, { rangeBuild: I.rangeBuild, year, metric, base: I.params, top: 7 });
  const center = i2Year(I.rows, year)[metric];
  return (
    <Card title={title} note={t("i2.tornadoNote")} data-tour="i2-tornado">
      <Tornado center={center} fmt={(v) => METRIC_FMT[metric](v, lang)} label={title}
        rows={rows.map((r) => ({
          key: r.key, label: LABEL[r.key] ? tx(LABEL[r.key].label) : r.key, atLow: r.atLow, atHigh: r.atHigh,
          lowText: `${t("i2.low")} ${fmtUnit(I.values[r.key].low, LABEL[r.key]?.unit ?? "", lang)}`,
          highText: `${t("i2.high")} ${fmtUnit(I.values[r.key].high, LABEL[r.key]?.unit ?? "", lang)}`,
        }))} />
      <div className="legend"><span><i className="sw t-low-sw" />{t("i2.atLow")}</span><span><i className="sw t-high-sw" />{t("i2.atHigh")}</span></div>
    </Card>
  );
}

function MarginTab() {
  const { t, tx, lang } = useT();
  const I = useI2();
  const [year, setYear] = useYear();
  const a = i2Year(I.rowsA, year), b = i2Year(I.rowsB, year);
  const V = vars(I.params, a, lang);
  const lines: [string, (r: I2Year) => number][] = [
    ["marginPlant", (r) => r.marginPlant], ["marginMeat", (r) => r.marginMeat], ["cost", (r) => -r.cost], ["net", (r) => r.net],
  ];
  const ys = I.rows.filter((r) => r.year >= 2026);
  return (
    <>
      <VersionBar year={year} setYear={setYear} />
      <div className="grid2">
        <Card title={t("i2.marginSteps", { year })} note={t("i2.marginFormula")} data-tour="i2-margin" fictitious={dataset.kind === "public"}>
          <table className="i2-table">
            <thead><tr><th>{t("i2.colLine")}</th><th className="r">{t("i2.colA")}</th><th className="r">{t("i2.colB")}</th></tr></thead>
            <tbody>
              {lines.map(([k, f]) => (
                <tr key={k} className={k === "net" ? "hl" : ""}><td>{t(`i2.line.${k}`)}</td><td className="r num">{meur(f(a), lang)}</td><td className="r num">{meur(f(b), lang)}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="small">{fill(tx(D.messages.margin), V)}</p>
        </Card>
        <Card title={t("i2.marginInputs")}>
          <InputsList keys={["G.PBM_EUR_FR", "G.PBM_KG_FR", "G.VAT", "G.PBM_GM", "G.MEAT_PRICE_HT", "G.MEAT_GM", "G.LABOUR_EUR_H", "G.HQ_EUR_DAY", "I2.MAT_EUR_STORE"]} />
        </Card>
      </div>
      <Card title={t("i2.marginByYear")}>
        <YearBars years={ys.map((r) => r.year)} label={t("i2.marginByYear")} fmt={(v) => meur(v, lang)}
          series={[{ key: "net", label: t("i2.line.net"), color: "var(--green)", values: ys.map((r) => r.net) }]} />
      </Card>
      <TornadoCard metric="net" year={year} title={t("i2.tornadoNet", { year })} />
    </>
  );
}

function InputsList({ keys }: { keys: I2Key[] }) {
  const { tx, lang } = useT();
  const I = useI2();
  return (
    <dl className="facts compact">
      {keys.map((k) => (
        <div key={k} className="fact">
          <dt>{LABEL[k] ? tx(LABEL[k].label) : k}</dt>
          <dd className="num">{fmtUnit(I.params[k], LABEL[k]?.unit ?? "", lang)}<small>{fmtUnit(I.values[k].low, LABEL[k]?.unit ?? "", lang)} · {fmtUnit(I.values[k].high, LABEL[k]?.unit ?? "", lang)}</small></dd>
        </div>
      ))}
    </dl>
  );
}

function CarbonEffortTab() {
  const { t, tx, lang } = useT();
  const I = useI2();
  const [year, setYear] = useYear();
  const a = i2Year(I.rowsA, year), b = i2Year(I.rowsB, year);
  const p = I.params;
  const carbon: [string, (r: I2Year) => string][] = [
    ["added", (r) => fmtNum(r.addedKg / 1000, lang, 1)],
    ["plantEm", (r) => fmtNum((r.addedKg * p["G.E_PBM"]) / 1000, lang, 0)],
    ["meatT", (r) => fmtSignedNum(r.meatKg / 1000, lang, 1)],
    ["meatEm", (r) => fmtSignedNum((r.meatKg * p["G.E_MEAT"]) / 1000, lang, 0)],
    ["net", (r) => kt(r.co2kt, lang)],
  ];
  const cum = (rows: I2Year[], f: (r: I2Year) => number) => rows.filter((r) => r.year <= year).reduce((s, r) => s + f(r), 0);
  const k = Math.max(0, Math.min(5, Math.floor(p["I2.T_FIRST"] - 2025) - 1));
  const effort: [string, number, string][] = [
    ["setup", cum(I.rows, (r) => r.setupH / 7.5), t("i2.effortSetupNote", { stores: fmtNum(p["G.N_STORES_SCOPE"], lang, 0), h: fmtNum(p["I2.H_STORE_SETUP"], lang, 1) })],
    ["upkeep", cum(I.rows, (r) => r.upkeepH / 7.5), t("i2.effortUpkeepNote", { h: fmtNum(p["I2.H_STORE_WEEK"], lang, 2) })],
    ["hqOnce", p["I2.DAYS_HQ_ONEOFF"], t("i2.effortHqOnceNote", { year: 2025 + k })],
    ["hqYear", cum(I.rows, (r) => r.hqDays) - p["I2.DAYS_HQ_ONEOFF"], t("i2.effortHqYearNote", { d: fmtNum(p["I2.DAYS_HQ_ANNUAL"], lang, 0) })],
  ];
  const total = i2Year(I.rows, year).cumPersonDays;
  const storeShare = total > 0 ? (effort[0][1] + effort[1][1]) / total : 0;
  const V = { ...vars(p, a, lang), storeShare: fmtPct(storeShare, lang, 0) };
  const ys = I.rows.filter((r) => r.year >= 2026);
  return (
    <>
      <VersionBar year={year} setYear={setYear} />
      <div className="grid2">
        <Card title={t("i2.carbonSteps", { year })} note={t("i2.carbonFormula")} data-tour="i2-carbon" fictitious={dataset.kind === "public"}>
          <table className="i2-table">
            <thead><tr><th>{t("i2.colLine")}</th><th className="r">{t("i2.colA")}</th><th className="r">{t("i2.colB")}</th></tr></thead>
            <tbody>
              {carbon.map(([key, f]) => <tr key={key} className={key === "net" ? "hl" : ""}><td>{t(`i2.carbon.${key}`)}</td><td className="r num">{f(a)}</td><td className="r num">{f(b)}</td></tr>)}
            </tbody>
          </table>
          <p className="small">{fill(tx(D.messages.carbon), V)}</p>
          <InputsList keys={["G.E_PBM", "G.E_MEAT"]} />
        </Card>
        <Card title={t("i2.effortTitle", { year })} note={t("i2.effortFormula")} data-tour="i2-effort">
          <table className="i2-table">
            <thead><tr><th>{t("i2.colComponent")}</th><th className="r">{t("i2.colDays")}</th></tr></thead>
            <tbody>
              {effort.map(([key, v, note]) => <tr key={key}><td>{t(`i2.effort.${key}`)}<small className="block muted">{note}</small></td><td className="r num">{fmtNum(v, lang, 0)}</td></tr>)}
              <tr className="hl"><td>{t("i2.effort.total")}</td><td className="r num">{fmtNum(total, lang, 0)}</td></tr>
            </tbody>
          </table>
          <p className="small">{fill(tx(D.messages.effort), V)}</p>
        </Card>
      </div>
      <div className="grid2">
        <Card title={t("i2.co2ByYear")}>
          <YearBars years={ys.map((r) => r.year)} label={t("i2.co2ByYear")} fmt={(v) => kt(v, lang)}
            series={[{ key: "A", label: tx(D.versions.A), color: "var(--plant-2)", values: I.rowsA.filter((r) => r.year >= 2026).map((r) => r.co2kt) },
              { key: "B", label: tx(D.versions.B), color: "var(--green)", values: I.rowsB.filter((r) => r.year >= 2026).map((r) => r.co2kt) }]} />
        </Card>
        <Card title={t("i2.effortByYear")}>
          <YearBars years={ys.map((r) => r.year)} label={t("i2.effortByYear")} fmt={(v) => fmtNum(v, lang, 0)}
            series={[{ key: "pd", label: t("i2.colDays"), color: "var(--comp)", values: ys.map((r) => r.personDays) }]} />
        </Card>
      </div>
      <div className="grid2">
        <TornadoCard metric="co2kt" year={year} title={t("i2.tornadoCo2", { year })} />
        <TornadoCard metric="cumPersonDays" year={year} title={t("i2.tornadoEffort", { year })} />
      </div>
    </>
  );
}

function UncertaintyTab() {
  const { t, tx, lang } = useT();
  const I = useI2();
  const [year, setYear] = useYear();
  const [metric, setMetric] = useState<I2Metric>("pp");
  const mcA = useI2MonteCarlo(I.values, false, year);
  const mcB = useI2MonteCarlo(I.values, true, year);
  const mcA0 = useI2MonteCarlo(I.values, false, year, true);
  const mcB0 = useI2MonteCarlo(I.values, true, year, true);
  const cur = I.rangeBuild ? mcB : mcA;
  const rows = [
    { k: tx(D.versions.A), mc: mcA, c: i2Year(I.rowsA, year) },
    { k: tx(D.versions.B), mc: mcB, c: i2Year(I.rowsB, year) },
    { k: `${tx(D.versions.A)} · ${t("i2.meatZero")}`, mc: mcA0 },
    { k: `${tx(D.versions.B)} · ${t("i2.meatZero")}`, mc: mcB0 },
  ];
  const s = cur.byMetric[metric];
  return (
    <>
      <VersionBar year={year} setYear={setYear} />
      <Card title={t("i2.mcTitle", { year })} note={t("i2.mcNote", { draws: fmtNum(cur.draws, lang, 0) })} data-tour="i2-mc" fictitious={dataset.kind === "public"}>
        <div className="table-scroll">
          <table className="i2-table mc">
            <thead>
              <tr><th>{t("i2.colVersion")}</th>{(["pp", "net", "co2kt", "cumPersonDays"] as I2Metric[]).map((m) => <th key={m} className="r">{t(`i2.metric.${m}`)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.k}>
                  <td>{r.k}</td>
                  {(["pp", "net", "co2kt", "cumPersonDays"] as I2Metric[]).map((m) => (
                    <td key={m} className="r num">
                      <b>{METRIC_FMT[m](r.mc.byMetric[m].median, lang)}</b>
                      <small className="block">{METRIC_FMT[m](r.mc.byMetric[m].p10, lang)} · {METRIC_FMT[m](r.mc.byMetric[m].p90, lang)}</small>
                      {m !== "cumPersonDays" && <small className="block muted">{t(m === "co2kt" ? "i2.saving" : "i2.belowZero", { share: fmtPct(m === "co2kt" ? r.mc.byMetric[m].belowZero : r.mc.byMetric[m].belowZero, lang, 0) })}</small>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small">{tx(D.messages.meatZero)}</p>
      </Card>
      <div className="grid2">
        <Card title={t("i2.histTitle")} right={
          <Segmented label={t("i2.metricLabel")} size="sm" value={metric} onChange={setMetric}
            options={(["pp", "net", "co2kt", "cumPersonDays"] as I2Metric[]).map((m) => ({ value: m, label: t(`i2.metricShort.${m}`) }))} />
        } data-tour="i2-hist">
          <Histogram samples={cur.samples[metric]} p10={s.p10} median={s.median} p90={s.p90} fmt={(v) => METRIC_FMT[metric](v, lang)} label={t("i2.histTitle")} />
          <p className="small muted">{t("i2.histNote", { median: METRIC_FMT[metric](s.median, lang), central: METRIC_FMT[metric](i2Year(I.rows, year)[metric], lang) })}</p>
        </Card>
        <TornadoCard metric={metric} year={year} title={t("i2.tornadoTitle", { metric: t(`i2.metric.${metric}`), year })} />
      </div>
    </>
  );
}

function RegisterTab() {
  const { state, dispatch } = useApp();
  const { t, tx, lang } = useT();
  const I = useI2();
  const lever = leverByNumber(12);
  const [q, setQ] = useState("");
  const query = q.trim().toLocaleLowerCase();
  const set = (k: I2Key, v: number) => {
    const link = LINKED[k];
    if (link) dispatch({ type: "hypothesis", lever: lever.id, id: link.hyp, value: Math.round(link.toLever(v) * 1000) / 1000 });
    else dispatch({ type: "i2Param", key: k, value: v === dataset.i2[k].central ? null : v });
  };
  return (
    <>
      <VersionBar />
      <Card title={t("i2.registerTitle")} note={t("i2.registerNote")} data-tour="i2-register"
        right={<input type="search" className="lsearch" placeholder={t("i2.registerSearch")} aria-label={t("i2.registerSearch")} value={q} onChange={(e) => setQ(e.target.value)} />}>
        {D.register.map((g) => {
          const rows = g.rows.filter((r) => !query || `${r.key} ${tx(r.label)} ${tx(I.values[r.key].note)}`.toLocaleLowerCase().includes(query));
          if (!rows.length) return null;
          return (
            <section key={g.group.en} className="reg-group">
              <h3 className="sub-h">{tx(g.group)}</h3>
              {rows.map((r) => {
                const v = I.values[r.key];
                const base = dataset.i2[r.key];
                const cur = I.params[r.key];
                const span = base.high - base.low;
                const step = span > 0 ? Number((span / 100).toPrecision(1)) : 1;
                const changed = Math.abs(cur - base.central) > 1e-12;
                const f = (x: number) => fmtUnit(x, r.unit, lang);
                return (
                  <div key={r.key} className={`reg-row ${changed ? "changed" : ""}`}>
                    <div className="reg-l">
                      <b>{tx(r.label)}</b>
                      <span className="reg-meta"><code>{r.key}</code><span className={`tier t-${v.tier}`}>{v.tier}</span><span className="rstatus">{t(`i2.status.${v.status}`)}</span>{LINKED[r.key] && <span className="chip plot">{t("i2.linked")}</span>}</span>
                      <p className="small muted">{tx(v.note)}{v.url && <> <a href={v.url} target="_blank" rel="noreferrer noopener">{t("i2.source")} <Icon name="external" size={11} /></a></>}</p>
                    </div>
                    <div className="reg-v">
                      <b className={`num ${changed ? "changed" : ""}`}>{f(cur)}</b>
                      {span > 0 ? (
                        <input type="range" min={base.low} max={base.high} step={step} value={Math.min(base.high, Math.max(base.low, cur))} aria-label={tx(r.label)}
                          style={{ ["--p" as string]: `${((Math.min(base.high, Math.max(base.low, cur)) - base.low) / span) * 100}%` }}
                          onChange={(e) => set(r.key, Number(e.target.value))} />
                      ) : <span className="small muted">{t("i2.fixed")}</span>}
                      <span className="reg-range mono">{f(base.low)} · {f(base.central)} · {f(base.high)}</span>
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}
        <p className="small muted">{t("i2.registerLegend")}</p>
      </Card>
      {state.i2.rangeBuild === false && <p className="small muted">{t("i2.rgOff")}</p>}
    </>
  );
}

function EvidenceTab() {
  const { t, tx, lang } = useT();
  const [tier, setTier] = useState("all");
  const [country, setCountry] = useState("all");
  const [variant, setVariant] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const query = q.trim().toLocaleLowerCase();
  const countries = useMemo(() => [...new Set(D.evidence.map((e) => e.country).filter(Boolean))], []);
  const shown = D.evidence.filter((e) =>
    (tier === "all" || e.tier === tier) && (country === "all" || e.country === country) && (variant === "all" || e.variant.split(", ").includes(variant)) &&
    (!query || `${e.id} ${e.title} ${tx(e.text)} ${tx(e.flags)}`.toLocaleLowerCase().includes(query)));
  const DIR: Record<string, string> = { pos: "+", neg: "-", null: "=", mix: "±", unk: "?" };
  const jump = (ids: string) => { const first = ids.split(/,\s*/)[0]; if (first) { setTier("all"); setCountry("all"); setVariant("all"); setQ(""); setOpen(first); document.getElementById(`ev-${first}`)?.scrollIntoView({ block: "center" }); } };
  return (
    <>
      <Card title={t("i2.findingsTitle")} note={t("i2.findingsNote")} data-tour="i2-findings">
        <div className="findings">
          {D.findings.map((f) => (
            <div key={f.id} className={`finding d-${f.dir}`}>
              <span className="fdir" aria-hidden>{DIR[f.dir]}</span>
              <div>
                <b>{f.id} · {tx(f.t)}</b>
                <span className="small muted">{t("i2.confidence")} {tx(f.conf)}{f.basis && <> · <button type="button" className="link" onClick={() => jump(f.basis)}>{f.basis}</button></>}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title={t("i2.explorerTitle", { n: shown.length, total: D.evidence.length })} note={t("i2.explorerNote")} data-tour="i2-explorer">
        <div className="toolbar ev-tools">
          <div className="filters" role="group" aria-label={t("i2.tier")}>
            <span className="flabel">{t("i2.tier")}</span>
            <button type="button" className={`fchip ${tier === "all" ? "on" : ""}`} onClick={() => setTier("all")}>{t("levers.all")}</button>
            {Object.keys(D.tiers).map((k) => <button key={k} type="button" className={`fchip ${tier === k ? "on" : ""}`} title={tx(D.tiers[k])} onClick={() => setTier(k)}>{k} · {tx(D.tiers[k])}</button>)}
          </div>
          <label className="filters fselect"><span className="flabel">{t("i2.country")}</span>
            <select value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="all">{t("i2.allCountries")}</option>
              {countries.map((c) => <option key={c} value={c}>{D.countries[c] ? tx(D.countries[c]) : c}</option>)}
            </select>
          </label>
          <label className="filters fselect"><span className="flabel">{t("i2.variant")}</span>
            <select value={variant} onChange={(e) => setVariant(e.target.value)}>
              <option value="all">{t("i2.allVariants")}</option>
              {Object.keys(D.variants).map((v) => <option key={v} value={v}>{v} · {tx(D.variants[v])}</option>)}
            </select>
          </label>
          <input type="search" className="lsearch" placeholder={t("i2.search")} aria-label={t("i2.search")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {shown.length === 0 && <p className="empty">{t("i2.noEvidence")}</p>}
        <div className="ev-list">
          {shown.map((e) => (
            <article key={e.id} id={`ev-${e.id}`} className={`ev ${open === e.id ? "open" : ""}`}>
              <button type="button" className="ev-h" aria-expanded={open === e.id} onClick={() => setOpen(open === e.id ? null : e.id)}>
                <span className={`tier t-${e.tier}`}>{e.id}</span>
                <b>{lang === "en" && e.titleEn ? e.titleEn : e.title}</b>
                <span className="ev-tags">
                  {e.country && <span className="chip plot">{D.countries[e.country] ? tx(D.countries[e.country]) : e.country}</span>}
                  {e.variant && <span className="chip plot" title={e.variant.split(", ").map((v) => tx(D.variants[v])).join(" ; ")}>{e.variant}</span>}
                  <span className="rstatus">{tx(D.statuses[e.status])}</span>
                </span>
              </button>
              <div className="ev-b">
                <p>{tx(e.text)}</p>
                <p className="small muted"><b>{t("i2.flags")}</b> {tx(e.flags)}</p>
                {e.url && <a className="small" href={e.url} target="_blank" rel="noreferrer noopener">{t("i2.openSource")} <Icon name="external" size={11} /></a>}
              </div>
            </article>
          ))}
        </div>
      </Card>

      <div className="grid2">
        <Card title={t("i2.counterTitle")} data-tour="i2-counter"><ul className="bullets">{D.counter.map((x) => <li key={x.en}>{tx(x)}</li>)}</ul></Card>
        <div className="stack">
          <Card title={t("i2.risksTitle")}><ul className="bullets">{D.risks.map((x) => <li key={x.en}>{tx(x)}</li>)}</ul></Card>
          <Card title={t("i2.barriersTitle")}><ul className="bullets">{D.barriers.map((x) => <li key={x.en}>{tx(x)}</li>)}</ul></Card>
        </div>
      </div>

      <Card title={t("i2.retailersTitle")} note={t("i2.retailersNote")} data-tour="i2-retailers">
        <div className="table-scroll">
          <table className="i2-table retail">
            <thead><tr><th>{t("i2.country")}</th><th>{t("i2.retailer")}</th><th>{t("i2.activity")}</th><th>{t("i2.variant")}</th><th>{t("i2.records")}</th></tr></thead>
            <tbody>
              {D.retailers.map((r, i) => (
                <tr key={i}>
                  <td>{D.countries[r.country] ? tx(D.countries[r.country]) : r.country}</td><td><b>{typeof r.retailer === "string" ? r.retailer || t("i2.none") : tx(r.retailer)}</b></td><td>{tx(r.activity)}</td><td className="mono small">{r.variant}</td>
                  <td>{r.ids && <button type="button" className="link small" onClick={() => jump(r.ids)}>{r.ids}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid2">
        <Card title={t("i2.scoreTitle")} note={tx(D.scorecards.note)}>
          <div className="scores">
            {(["volume", "quality"] as const).map((k) => (
              <div key={k} className="score">
                <span className="m">{t(`i2.score.${k}`)}</span>
                <b className="num">{D.scorecards[k].score}<small> / {D.scorecards[k].max}</small></b>
                <span className="small muted">{tx(D.scorecards[k].rating)}</span>
                <div className="gauge"><i style={{ width: `${(D.scorecards[k].score / D.scorecards[k].max) * 100}%` }} /></div>
              </div>
            ))}
          </div>
          <table className="i2-table">
            <thead><tr><th>{t("i2.framing")}</th><th className="r">{t("i2.promising")}</th><th className="r">{t("i2.neglected")}</th></tr></thead>
            <tbody>{D.scorecards.framing.map((f) => <tr key={f.k.en}><td>{tx(f.k)}</td><td className="r num">{f.prom}</td><td className="r num">{f.negl}</td></tr>)}</tbody>
          </table>
        </Card>
        <Card title={t("i2.commercialTitle")}><ul className="bullets">{D.commercial.map((x) => <li key={x.en}>{tx(x)}</li>)}</ul></Card>
      </div>
      <Card title={t("i2.variantsTitle")}>
        <dl className="facts compact">{Object.entries(D.variants).map(([k, v]) => <div key={k} className="fact"><dt className="mono">{k}</dt><dd>{tx(v)}</dd></div>)}</dl>
      </Card>
    </>
  );
}

function GapsTab() {
  const { t, tx } = useT();
  return (
    <div className="grid2">
      <Card title={t("i2.gapsTitle")} data-tour="i2-gaps"><ul className="bullets">{D.gaps.map((x) => <li key={x.en}>{tx(x)}</li>)}</ul></Card>
      <Card title={t("i2.notHeldTitle")} note={t("i2.notHeldNote")}><ul className="bullets">{D.notHeld.map((x) => <li key={x.en}>{tx(x)}</li>)}</ul></Card>
    </div>
  );
}
