import { useEffect, useLayoutEffect, useState } from "react";
import { leverByNumber } from "../data";
import { useApp, storage } from "../state/store";
import type { AppState, ScreenId } from "../state/types";
import type { Action } from "../state/store";
import { useT } from "../i18n/useT";

/** A step points at a [data-tour] element; `go` puts the app in the state the step needs. */
interface Step { id: string; target: string; go?: (s: AppState) => Action[] }
const screen = (id: ScreenId) => (s: AppState): Action[] => [...(s.leverPage ? [{ type: "closeLever" } as Action] : []), ...(s.screen !== id ? [{ type: "go", screen: id } as Action] : [])];
const on = (id: ScreenId, extra: Action[] = []) => (s: AppState): Action[] => [...screen(id)(s), ...extra];
const L12 = () => leverByNumber(12).id;
const lever = (t: string) => (s: AppState): Action[] => (s.leverPage === L12() && s.leverTab === t ? [] : [{ type: "openLever", lever: L12(), tab: t }]);
const tab = (t: string) => (s: AppState): Action[] => (s.leverTab === t ? [] : [{ type: "leverTab", tab: t }]);

/** The welcome tour crosses the four screens; each screen (and the lever page) has its own tour
 *  that covers every component on it. */
export const TOURS: Record<string, Step[]> = {
  welcome: [
    { id: "w1", target: "baseline-kpi", go: screen("baseline") },
    { id: "w2", target: "categories", go: screen("baseline") },
    { id: "w3", target: "levers-table", go: on("levers", [{ type: "leverView", view: "list" }]) },
    { id: "w4", target: "kpis", go: screen("trajectory") },
    { id: "w5", target: "adoption", go: screen("trajectory") },
    { id: "w6", target: "tour-button" },
  ],
  baseline: [
    { id: "b1", target: "baseline-kpi", go: screen("baseline") },
    { id: "b2", target: "baseline-message", go: screen("baseline") },
    { id: "b3", target: "categories", go: screen("baseline") },
    { id: "b4", target: "baseline-animal", go: screen("baseline") },
    { id: "b5", target: "baseline-rayons", go: screen("baseline") },
    { id: "b6", target: "next-step", go: screen("baseline") },
  ],
  levers: [
    { id: "l1", target: "levers-kpis", go: screen("levers") },
    { id: "l2", target: "levers-view", go: on("levers", [{ type: "leverView", view: "list" }]) },
    { id: "l3", target: "levers-toolbar", go: screen("levers") },
    { id: "l4", target: "levers-table", go: on("levers", [{ type: "leverView", view: "list" }]) },
    { id: "l5", target: "levers-table", go: on("levers", [{ type: "leverView", view: "matrix" }]) },
  ],
  trajectory: [
    { id: "t1", target: "kpis", go: on("trajectory", [{ type: "kpi", kpi: "split" }]) },
    { id: "t2", target: "chart", go: on("trajectory", [{ type: "kpi", kpi: "split" }, { type: "chartView", view: "lever" }]) },
    { id: "t3", target: "chart", go: on("trajectory", [{ type: "kpi", kpi: "split" }, { type: "chartView", view: "time" }]) },
    { id: "t4", target: "chart", go: on("trajectory", [{ type: "kpi", kpi: "co2" }, { type: "chartView", view: "lever" }]) },
    { id: "t5", target: "scope3", go: on("trajectory", [{ type: "kpi", kpi: "co2" }]) },
    { id: "t6", target: "scenarios-suggested", go: screen("trajectory") },
    { id: "t7", target: "scenarios-custom", go: screen("trajectory") },
    { id: "t8", target: "adoption", go: screen("trajectory") },
    { id: "t9", target: "store-split", go: screen("trajectory") },
    { id: "t10", target: "horizon", go: screen("trajectory") },
    { id: "t11", target: "traj-levers", go: on("trajectory", [{ type: "kpi", kpi: "split" }]) },
  ],
  data: [
    { id: "d1", target: "data-modules", go: screen("data") },
    { id: "d2", target: "data-note", go: screen("data") },
  ],
  lever: [
    { id: "p1", target: "lp-head", go: tab("summary") },
    { id: "p2", target: "lp-tabs", go: tab("summary") },
    { id: "g3", target: "lp-summary", go: tab("summary") },
    { id: "g4", target: "lp-implementation", go: tab("summary") },
    { id: "g5", target: "lp-effects", go: tab("summary") },
    { id: "p5", target: "lp-assumptions", go: tab("assumptions") },
    { id: "g6", target: "lp-evidence", go: tab("evidence") },
  ],
  i2: [
    { id: "p1", target: "lp-head", go: lever("summary") },
    { id: "p2", target: "lp-tabs", go: lever("summary") },
    { id: "p4", target: "i2-version", go: lever("summary") },
    { id: "p3", target: "i2-tiles", go: lever("summary") },
    { id: "i5", target: "i2-scenario", go: lever("summary") },
    { id: "p5", target: "lp-assumptions", go: lever("assumptions") },
    { id: "p6", target: "i2-steps", go: lever("model") },
    { id: "p7", target: "i2-margin", go: lever("margin") },
    { id: "p8", target: "i2-carbon", go: lever("carbonEffort") },
    { id: "i8", target: "i2-effort", go: lever("carbonEffort") },
    { id: "p9", target: "i2-mc", go: lever("uncertainty") },
    { id: "i9", target: "i2-tornado", go: lever("uncertainty") },
    { id: "p10", target: "i2-register", go: lever("register") },
    { id: "i10", target: "i2-findings", go: lever("evidence") },
    { id: "p11", target: "i2-explorer", go: lever("evidence") },
    { id: "i11", target: "i2-retailers", go: lever("evidence") },
    { id: "p12", target: "i2-gaps", go: lever("gaps") },
  ],
};

/** Tour that the header button starts: the current screen's, or the lever page's. */
export const tourFor = (s: AppState) => (s.leverPage ? (s.leverPage === L12() ? "i2" : "lever") : s.screen);

const W = 400;

export function Tour() {
  const { state, dispatch } = useApp();
  const { t } = useT();
  const step = state.tour;
  const steps = TOURS[state.tourId] ?? TOURS.welcome;
  const cur = step !== null ? steps[step] : null;
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => { if (step !== null && state.tourId === "welcome") storage.set("tour", "seen"); }, [step, state.tourId]);

  useEffect(() => {
    if (!cur) return;
    for (const a of cur.go?.(state) ?? []) dispatch(a);
    if (state.drawer) dispatch({ type: "drawer", lever: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, dispatch]);

  useLayoutEffect(() => {
    if (!cur) { setRect(null); return; }
    let raf = 0;
    const find = () => document.querySelector(`[data-tour="${cur.target}"]`);
    const measure = () => { const el = find(); setRect(el ? el.getBoundingClientRect() : null); };
    const place = () => { find()?.scrollIntoView({ block: "center", behavior: "auto" }); raf = requestAnimationFrame(measure); };
    // the target can appear one render later, once the step's state is in place
    raf = requestAnimationFrame(place);
    const main = document.getElementById("main");
    window.addEventListener("resize", measure);
    main?.addEventListener("scroll", measure);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", measure); main?.removeEventListener("scroll", measure); };
  }, [cur, state.screen, state.leverPage, state.leverTab, state.kpi, state.chartView, state.leverView]);

  if (step === null || !cur) return null;
  const last = step === steps.length - 1;
  const close = () => dispatch({ type: "tour", step: null });
  const vw = window.innerWidth, vh = window.innerHeight;
  const BH = 190;
  const minTop = 72, maxTop = vh - BH - 44;
  const clampTop = (v: number) => Math.min(maxTop, Math.max(minTop, v));
  let top = clampTop(vh / 2 - BH / 2), left = vw / 2 - W / 2;
  if (rect) {
    left = Math.min(vw - W - 16, Math.max(16, rect.left));
    if (rect.bottom + 14 + BH <= vh - 40) top = rect.bottom + 14;
    else if (rect.top - 14 - BH >= minTop) top = rect.top - 14 - BH;
    else if (rect.right + 14 + W <= vw - 16) { left = rect.right + 14; top = clampTop(rect.top); }
    else if (rect.left - 14 - W >= 16) { left = rect.left - 14 - W; top = clampTop(rect.top); }
    else { top = maxTop; left = Math.min(vw - W - 16, Math.max(16, rect.left + 24)); }
  }
  const ring = rect ? { top: Math.max(4, rect.top - 6), left: rect.left - 6, width: rect.width + 12, height: Math.min(rect.height + 12, vh - Math.max(4, rect.top - 6) - 8) } : null;

  return (
    <div className="tour" role="dialog" aria-modal="false" aria-labelledby="tour-title">
      {ring && <div className="tour-ring" style={ring} />}
      <div className="tour-bubble" style={{ top, left, width: Math.min(W, vw - 32) }}>
        <div className="tour-k">{t(`tour.name.${state.tourId}`)} · {t("tour.stepOf", { n: step + 1, total: steps.length })}</div>
        <b id="tour-title">{t(`tour.${cur.id}.title`)}</b>
        <p>{t(`tour.${cur.id}.text`)}</p>
        <div className="tour-actions">
          <button type="button" className="link" onClick={close}>{t("tour.skip")}</button>
          <span>
            {step > 0 && <button type="button" className="pill pill-secondary pill-sm" onClick={() => dispatch({ type: "tour", step: step - 1 })}>{t("tour.prev")}</button>}
            <button type="button" className="pill pill-primary pill-sm" onClick={() => (last ? close() : dispatch({ type: "tour", step: step + 1 }))}>
              {last ? t("tour.done") : t("tour.next")}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
