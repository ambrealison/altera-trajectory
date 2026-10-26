import { scaleLinear } from "d3-scale";
import type { Lever } from "../data/types";
import { leverByNumber } from "../data";
import type { Contributions } from "../engine/contributions";
import { fmtPct, fmtPoints } from "../engine/format";
import { useT } from "../i18n/useT";
import { useWidth } from "./useWidth";

const TYPE_FILL: Record<Lever["type"], string> = { central: "var(--type-central)", central_stores: "var(--type-cs)", stores: "var(--type-stores)" };
const TYPE_STROKE: Record<Lever["type"], string> = { central: "none", central_stores: "none", stores: "var(--type-stores-ring)" };

interface Props {
  contrib: Contributions;
  low: number;
  high: number;
  baseYear: number;
  horizon: number;
  pinned?: { name: string; value: number } | null;
  onOpen: (leverId: string) => void;
}

/** Waterfall from the reference to the horizon: one step per active lever in its type colour,
 *  dotted connectors, a peach final bar with its range. The value axis does not start at zero:
 *  the two bars that rest on it carry a break mark. */
export function Waterfall({ contrib, low, high, baseYear, horizon, pinned, onOpen }: Props) {
  const { t, tx, lang } = useT();
  const [ref, width] = useWidth<HTMLDivElement>();
  const H = 300;
  const m = { top: 30, right: 12, bottom: 58, left: 44 };
  const innerW = Math.max(200, width - m.left - m.right);
  const steps = contrib.steps;

  // layout: reference and final bars weigh 2 units, each lever 1 unit
  const units = steps.length + 4;
  const unit = innerW / units;
  const barW = (w: number, cap: number) => Math.min(cap, w * 0.72);
  type Item = { key: string; x: number; w: number; from: number; to: number; kind: "ref" | "step" | "final"; lever?: Lever; value?: number };
  const items: Item[] = [];
  let cursor = 0;
  let cum = contrib.base;
  items.push({ key: "ref", x: cursor, w: 2 * unit, from: NaN, to: contrib.base, kind: "ref" });
  cursor += 2 * unit;
  for (const s of steps) {
    items.push({ key: `L${s.number}`, x: cursor, w: unit, from: cum, to: cum + s.value, kind: "step", lever: leverByNumber(s.number), value: s.value });
    cum += s.value;
    cursor += unit;
  }
  items.push({ key: "final", x: cursor, w: 2 * unit, from: NaN, to: contrib.final, kind: "final" });

  const values = [contrib.base, contrib.final, low, high, ...items.map((i) => i.to), ...(pinned ? [pinned.value] : [])];
  const lo = Math.min(...values), hi = Math.max(...values);
  const yMin = Math.floor(lo * 100 - 1.5) / 100;
  const yMax = Math.ceil(hi * 100 + 0.6) / 100;
  const y = scaleLinear().domain([yMin, yMax]).range([H - m.bottom, m.top]);
  const ticks = y.ticks(Math.min(6, Math.round((yMax - yMin) * 100)));
  const small = (v: number) => Math.abs(v) < 0.001 - 1e-12;
  const ptsLabel = (v: number) => {
    const s = fmtPoints(v, lang, Math.abs(v) < 0.001 ? 2 : 1);
    return s.replace(/\s?pts?$/, "").replace(/ pts?$/, "");
  };

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={H} role="img" aria-label={t("trajectory.chartTitleLever", { from: baseYear, to: horizon })}>
        <g transform={`translate(${m.left},0)`}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={0} x2={innerW} y1={y(v)} y2={y(v)} className="grid" />
              <text x={-8} y={y(v)} dy="0.32em" textAnchor="end" className="axis">{fmtPct(v, lang, 0)}</text>
            </g>
          ))}
          {items.map((it, i) => {
            const next = items[i + 1];
            if (!next || it.kind === "final") return null;
            const w = barW(it.w, it.kind === "ref" ? 64 : 44);
            const x1 = it.x + (it.w + w) / 2;
            const nw = barW(next.w, next.kind === "final" ? 64 : 44);
            const x2 = next.x + (next.w - nw) / 2;
            return <line key={`c${it.key}`} x1={x1} x2={x2} y1={y(it.to)} y2={y(it.to)} className="connector" />;
          })}
          {pinned && (
            <g className="ghost">
              <line x1={0} x2={innerW} y1={y(pinned.value)} y2={y(pinned.value)} />
              <text x={4} y={y(pinned.value) - 6}>{t("trajectory.pinned", { name: pinned.name, value: fmtPct(pinned.value, lang) })}</text>
            </g>
          )}
          {items.map((it) => {
            const w = barW(it.w, it.kind === "step" ? 44 : 64);
            const bx = it.x + (it.w - w) / 2;
            const cx = it.x + it.w / 2;
            if (it.kind !== "step") {
              const top = y(it.to);
              const base = y(yMin);
              const isFinal = it.kind === "final";
              return (
                <g key={it.key}>
                  <rect x={bx} y={top} width={w} height={Math.max(1, base - top)} rx={4} fill={isFinal ? "var(--peach)" : "var(--ink)"} />
                  <path d={`M ${bx - 2} ${base - 14} l ${w + 4} -6 M ${bx - 2} ${base - 8} l ${w + 4} -6`} className="axis-break" />
                  {isFinal && (
                    <g className="whisker">
                      <line x1={cx} x2={cx} y1={y(high)} y2={y(low)} />
                      <line x1={cx - 6} x2={cx + 6} y1={y(high)} y2={y(high)} />
                      <line x1={cx - 6} x2={cx + 6} y1={y(low)} y2={y(low)} />
                    </g>
                  )}
                  <text x={cx} y={Math.min(top, isFinal ? y(high) : top) - 8} textAnchor="middle" className={`val ${isFinal ? "big" : ""}`}>{fmtPct(it.to, lang)}</text>
                  <text x={isFinal ? bx + w : bx} y={H - m.bottom + (steps.length ? 44 : 18)} textAnchor={isFinal ? "end" : "start"} className="xlab strong">
                    {isFinal ? t("trajectory.yourTrajectory", { year: horizon }) : t("trajectory.reference", { year: baseYear })}
                  </text>
                </g>
              );
            }
            const l = it.lever!;
            const v = it.value!;
            const top = y(Math.max(it.from, it.to));
            const h = Math.max(1.5, Math.abs(y(it.from) - y(it.to)));
            const r = Math.min(11, it.w / 2 - 1);
            return (
              <g key={it.key} className="wstep" onClick={() => onOpen(l.id)} role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(l.id); } }}
                aria-label={`${l.number} · ${tx(l.label)} : ${fmtPoints(v, lang)}`}>
                <title>{`${l.number} · ${tx(l.label)} : ${fmtPoints(v, lang, 2)}`}</title>
                <rect x={it.x} y={m.top} width={it.w} height={H - m.top - m.bottom + 30} fill="transparent" />
                <rect x={bx} y={top} width={w} height={h} rx={3} fill={TYPE_FILL[l.type]} stroke={TYPE_STROKE[l.type]} strokeWidth={l.type === "stores" ? 1.5 : 0} />
                {!small(v) && it.w >= 18 && (
                  <text x={cx} y={top - 6} textAnchor="middle" className="val">{ptsLabel(v)}</text>
                )}
                <circle cx={cx} cy={H - m.bottom + 16} r={r} className={`ldot t-${l.type}`} />
                <text x={cx} y={H - m.bottom + 16} dy="0.34em" textAnchor="middle" className={`ldot-n t-${l.type}`} style={{ fontSize: Math.max(8, r * 0.95) }}>{l.number}</text>
              </g>
            );
          })}
          <line x1={0} x2={innerW} y1={y(yMin)} y2={y(yMin)} className="baseline" />
        </g>
      </svg>
    </div>
  );
}
