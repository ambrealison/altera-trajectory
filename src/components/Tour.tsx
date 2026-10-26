import { useEffect, useLayoutEffect, useState } from "react";
import { useApp, storage } from "../state/store";
import type { ScreenId } from "../state/types";
import { useT } from "../i18n/useT";

const STEPS: { screen: ScreenId; target: string }[] = [
  { screen: "baseline", target: "baseline-kpi" },
  { screen: "baseline", target: "plots" },
  { screen: "levers", target: "levers" },
  { screen: "trajectory", target: "adoption" },
  { screen: "trajectory", target: "chart" },
  { screen: "trajectory", target: "guardrail" },
];
const W = 420;

/** Guided tour: six short bubbles, two lines each. Starts on the first visit only (remembered). */
export function Tour() {
  const { state, dispatch } = useApp();
  const { t } = useT();
  const step = state.tour;
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => { if (step !== null) storage.set("tour", "seen"); }, [step]);

  useEffect(() => {
    if (step === null) return;
    const s = STEPS[step];
    if (state.screen !== s.screen) dispatch({ type: "go", screen: s.screen });
    if (state.drawer) dispatch({ type: "drawer", lever: null });
  }, [step, state.screen, state.drawer, dispatch]);

  useLayoutEffect(() => {
    if (step === null) { setRect(null); return; }
    let raf = 0;
    const measure = () => {
      const el = document.querySelector(`[data-tour="${STEPS[step].target}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    const el = document.querySelector(`[data-tour="${STEPS[step].target}"]`);
    el?.scrollIntoView({ block: "center", behavior: "auto" });
    raf = requestAnimationFrame(measure);
    const main = document.getElementById("main");
    window.addEventListener("resize", measure);
    main?.addEventListener("scroll", measure);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", measure); main?.removeEventListener("scroll", measure); };
  }, [step, state.screen]);

  if (step === null) return null;
  const last = step === STEPS.length - 1;
  const close = () => dispatch({ type: "tour", step: null });
  const vw = window.innerWidth, vh = window.innerHeight;
  const BH = 180;
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

  return (
    <div className="tour" role="dialog" aria-modal="false" aria-labelledby="tour-title">
      {rect && <div className="tour-ring" style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }} />}
      <div className="tour-bubble" style={{ top, left, width: W }}>
        <div className="tour-k">{t("app.tour")} · {t("tour.stepOf", { n: step + 1, total: STEPS.length })}</div>
        <b id="tour-title">{t(`tour.s${step + 1}Title`)}</b>
        <p>{t(`tour.s${step + 1}Text`)}</p>
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
