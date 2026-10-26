import type { Hypothesis } from "../data/types";
import { fmtValue } from "../engine/format";
import { useT } from "../i18n/useT";

/** Assumption slider: current value in monospace, a tick at the default, min and max under the track. */
export function Slider({ h, value, reference, onChange }: { h: Hypothesis; value: number; reference: number; onChange: (v: number) => void }) {
  const { t, tx, lang } = useT();
  const pct = (v: number) => ((v - h.min) / (h.max - h.min || 1)) * 100;
  const fmt = (v: number) => fmtValue(v, h.unit, lang, h.step);
  const changed = value !== reference;
  return (
    <div className="hyp">
      <div className="hyp-top">
        <label htmlFor={`h-${h.id}`}>{tx(h.label)}</label>
        <b className={`mono ${changed ? "changed" : ""}`}>{fmt(value)}</b>
      </div>
      <div className="range-wrap">
        <input id={`h-${h.id}`} type="range" min={h.min} max={h.max} step={h.step} value={value}
          style={{ ["--p" as string]: `${pct(value)}%` }}
          onChange={(e) => onChange(Number(e.target.value))} />
        <i className="default-tick" style={{ left: `${pct(reference)}%` }} aria-hidden />
      </div>
      <div className="hyp-meta mono">
        <span>{fmt(h.min)}</span>
        <span>{t("drawer.default", { v: fmt(reference) })}</span>
        <span>{fmt(h.max)}</span>
      </div>
      {tx(h.note) && <p className="hyp-note">{tx(h.note)}</p>}
    </div>
  );
}
