import { scaleBand, scaleLinear } from "d3-scale";
import { useT } from "../i18n/useT";
import { useWidth } from "./useWidth";

/** Yearly bars of a signed value, one or two series side by side. */
export function YearBars({ years, series, fmt, height = 200, label }: {
  years: number[];
  series: { key: string; label: string; color: string; values: number[] }[];
  fmt: (v: number) => string;
  height?: number;
  label: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const m = { top: 16, right: 8, bottom: 24, left: 56 };
  const all = series.flatMap((s) => s.values);
  const lo = Math.min(0, ...all), hi = Math.max(0, ...all);
  const pad = (hi - lo || 1) * 0.08;
  const y = scaleLinear().domain([lo - (lo < 0 ? pad : 0), hi + pad]).range([height - m.bottom, m.top]).nice();
  const x = scaleBand<number>().domain(years).range([m.left, Math.max(m.left + 100, width - m.right)]).padding(0.25);
  const inner = scaleBand<string>().domain(series.map((s) => s.key)).range([0, x.bandwidth()]).padding(0.08);
  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={label}>
        {y.ticks(4).map((v) => (
          <g key={v}>
            <line x1={m.left} x2={width - m.right} y1={y(v)} y2={y(v)} className={v === 0 ? "zero-line" : "grid"} />
            <text x={m.left - 8} y={y(v)} dy="0.32em" textAnchor="end" className="axis">{fmt(v)}</text>
          </g>
        ))}
        {years.map((yr, i) => (
          <g key={yr}>
            {series.map((s) => {
              const v = s.values[i];
              const top = y(Math.max(0, v)), bot = y(Math.min(0, v));
              return (
                <rect key={s.key} x={(x(yr) ?? 0) + (inner(s.key) ?? 0)} y={top} width={inner.bandwidth()} height={Math.max(v === 0 ? 0 : 1, bot - top)} rx={2} fill={s.color}>
                  <title>{`${s.label} · ${yr} : ${fmt(v)}`}</title>
                </rect>
              );
            })}
            {(x.bandwidth() > 26 || i % 2 === 0) && <text x={(x(yr) ?? 0) + x.bandwidth() / 2} y={height - 6} textAnchor="middle" className="axis">{yr}</text>}
          </g>
        ))}
      </svg>
    </div>
  );
}

/** One input at a time to its low and high value: horizontal bars around the central result. */
export function Tornado({ rows, center, fmt, label }: {
  rows: { key: string; label: string; atLow: number; atHigh: number; lowText: string; highText: string }[];
  center: number;
  fmt: (v: number) => string;
  label: string;
}) {
  const { t } = useT();
  const [ref, width] = useWidth<HTMLDivElement>();
  const rowH = 30;
  const m = { top: 22, right: 70, bottom: 8, left: Math.min(300, Math.max(160, width * 0.38)) };
  const H = m.top + rows.length * rowH + m.bottom;
  const vals = rows.flatMap((r) => [r.atLow, r.atHigh]).concat(center);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo || Math.abs(center) || 1) * 0.06;
  const x = scaleLinear().domain([lo - pad, hi + pad]).range([m.left, Math.max(m.left + 120, width - m.right)]);
  return (
    <div className="chart tornado" ref={ref}>
      <svg width={width} height={H} role="img" aria-label={label}>
        <text x={x(center)} y={12} textAnchor="middle" className="axis strong">{t("i2.central")} {fmt(center)}</text>
        <line x1={x(center)} x2={x(center)} y1={m.top - 4} y2={H - m.bottom} className="tornado-axis" />
        {rows.map((r, i) => {
          const yy = m.top + i * rowH;
          const a = x(r.atLow), b = x(r.atHigh), c = x(center);
          return (
            <g key={r.key}>
              <text x={m.left - 10} y={yy + rowH / 2} dy="0.32em" textAnchor="end" className="tlabel">{r.label}</text>
              <rect x={Math.min(a, c)} y={yy + 6} width={Math.max(1, Math.abs(a - c))} height={rowH - 12} className="t-low" rx={2}>
                <title>{`${r.lowText} : ${fmt(r.atLow)}`}</title>
              </rect>
              <rect x={Math.min(b, c)} y={yy + 6} width={Math.max(1, Math.abs(b - c))} height={rowH - 12} className="t-high" rx={2}>
                <title>{`${r.highText} : ${fmt(r.atHigh)}`}</title>
              </rect>
              <text x={Math.max(a, b, c) + 6} y={yy + rowH / 2} dy="0.32em" className="axis">{fmt(Math.max(r.atLow, r.atHigh))}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Distribution of Monte Carlo draws, with the P10, median and P90 marked. */
export function Histogram({ samples, p10, median, p90, fmt, label, bins = 40 }: {
  samples: Float64Array;
  p10: number;
  median: number;
  p90: number;
  fmt: (v: number) => string;
  label: string;
  bins?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const H = 190;
  const m = { top: 22, right: 12, bottom: 26, left: 12 };
  // trim the extreme 1 % on each side so that a long tail does not flatten the shape
  const sorted = Float64Array.from(samples).sort();
  const lo = sorted[Math.floor(sorted.length * 0.01)], hi = sorted[Math.ceil(sorted.length * 0.99) - 1];
  const w = (hi - lo) / bins || 1;
  const counts = new Array(bins).fill(0);
  for (const s of samples) if (s >= lo && s <= hi) counts[Math.min(bins - 1, Math.floor((s - lo) / w))]++;
  const x = scaleLinear().domain([lo, hi]).range([m.left, Math.max(m.left + 100, width - m.right)]);
  const y = scaleLinear().domain([0, Math.max(...counts)]).range([H - m.bottom, m.top]);
  const mark = (v: number, cls: string, text: string) => (
    <g className={cls}>
      <line x1={x(v)} x2={x(v)} y1={m.top - 6} y2={H - m.bottom} />
      <text x={x(v)} y={m.top - 10} textAnchor="middle">{text}</text>
    </g>
  );
  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={H} role="img" aria-label={label}>
        {counts.map((c, i) => (
          <rect key={i} x={x(lo + i * w) + 0.5} y={y(c)} width={Math.max(0.5, x(lo + (i + 1) * w) - x(lo + i * w) - 1)} height={H - m.bottom - y(c)} className="hbin" />
        ))}
        {lo < 0 && hi > 0 && <line x1={x(0)} x2={x(0)} y1={m.top} y2={H - m.bottom} className="zero-line" />}
        {mark(p10, "hmark", `P10 ${fmt(p10)}`)}
        {mark(median, "hmark med", fmt(median))}
        {mark(p90, "hmark", `P90 ${fmt(p90)}`)}
        <text x={m.left} y={H - 6} className="axis">{fmt(lo)}</text>
        <text x={width - m.right} y={H - 6} textAnchor="end" className="axis">{fmt(hi)}</text>
      </svg>
    </div>
  );
}
