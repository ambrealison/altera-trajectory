import { scaleLinear } from "d3-scale";
import { area, curveMonotoneX, line } from "d3-shape";
import { fmtPct } from "../engine/format";
import { useT } from "../i18n/useT";
import { useWidth } from "./useWidth";

export interface Point { year: number; v: number; lo: number; hi: number }

/** Year labels: all of them when there is room, otherwise every five years and the last one. */
export const showYear = (year: number, first: number, last: number, x: (v: number) => number) =>
  x(first + 1) - x(first) >= 44 || year === last || (year - first) % 5 === 0;

/** Yearly ratio with its uncertainty band, the Dutch pace from the reference (dotted) and the pinned
 *  scenario as a ghost line. */
export function TrajectoryChart({ points, dutch, ghost, ghostName, fmt, zero, label }: {
  points: Point[];
  dutch?: { year: number; v: number }[];
  ghost?: { year: number; v: number }[];
  ghostName?: string;
  /** Value format (the protein split by default); a custom format pads the domain by a share of its span. */
  fmt?: (v: number) => string;
  /** Draws a reference line at this value. */
  zero?: number;
  label?: string;
}) {
  const { t, lang } = useT();
  const [ref, width] = useWidth<HTMLDivElement>();
  const H = 270;
  const m = { top: 18, right: 235, bottom: 30, left: 44 };
  const x0 = points[0].year, x1 = points[points.length - 1].year;
  const x = scaleLinear().domain([x0, x1]).range([m.left, Math.max(m.left + 200, width - m.right)]);
  const all = [...points.flatMap((p) => [p.lo, p.hi, p.v]), ...(dutch ?? []).map((d) => d.v), ...(ghost ?? []).map((d) => d.v)];
  const lo0 = Math.min(...all, zero ?? Infinity), hi0 = Math.max(...all, zero ?? -Infinity);
  const pad = Math.max((hi0 - lo0) * 0.12, Math.abs(hi0) * 0.002, 1e-6);
  const yMin = fmt ? lo0 - pad : Math.floor(Math.min(...all) * 100 - 0.6) / 100;
  const yMax = fmt ? hi0 + pad : Math.ceil(Math.max(...all) * 100 + 0.6) / 100;
  const f = fmt ?? ((v: number) => fmtPct(v, lang));
  const fAxis = fmt ?? ((v: number) => fmtPct(v, lang, 0));
  const y = scaleLinear().domain([yMin, yMax]).range([H - m.bottom, m.top]);
  const ticks = y.ticks(5);
  const band = area<Point>().x((p) => x(p.year)).y0((p) => y(p.lo)).y1((p) => y(p.hi)).curve(curveMonotoneX)(points) ?? "";
  const mid = line<Point>().x((p) => x(p.year)).y((p) => y(p.v)).curve(curveMonotoneX)(points) ?? "";
  const simple = line<{ year: number; v: number }>().x((p) => x(p.year)).y((p) => y(p.v));
  const last = points[points.length - 1];
  const endX = x(x1);
  // keep end labels apart
  const labels = [
    { key: "mid", y: y(last.v), text: f(last.v), sub: "", cls: "end-main" },
    ...(dutch ? [{ key: "dutch", y: y(dutch[dutch.length - 1].v), text: f(dutch[dutch.length - 1].v), sub: t("trajectory.dutchPace"), cls: "end-dutch" }] : []),
    ...(ghost ? [{ key: "ghost", y: y(ghost[ghost.length - 1].v), text: f(ghost[ghost.length - 1].v), sub: ghostName ?? t("trajectory.ghost"), cls: "end-ghost" }] : []),
  ].sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i++) { const gap = labels[i - 1].sub ? 28 : 16; if (labels[i].y - labels[i - 1].y < gap) labels[i].y = labels[i - 1].y + gap; }

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={H} role="img" aria-label={label ?? t("trajectory.chartTitleTime")}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={m.left} x2={endX} y1={y(v)} y2={y(v)} className="grid" />
            <text x={m.left - 8} y={y(v)} dy="0.32em" textAnchor="end" className="axis">{fAxis(v)}</text>
          </g>
        ))}
        {points.filter((p) => showYear(p.year, x0, x1, x)).map((p) => (
          <text key={p.year} x={x(p.year)} y={H - 8} textAnchor="middle" className="axis">{p.year}</text>
        ))}
        {zero !== undefined && <line x1={m.left} x2={endX} y1={y(zero)} y2={y(zero)} className="zero-line" />}
        <path d={band} className="band" />
        {dutch && <path d={simple(dutch) ?? ""} className="dutch" />}
        {ghost && <path d={simple(ghost) ?? ""} className="ghost-line" />}
        <path d={mid} className="mainline" />
        {points.map((p) => (
          <circle key={p.year} cx={x(p.year)} cy={y(p.v)} r={3.6} className="dot">
            <title>{`${p.year} : ${f(p.v)} (${f(p.lo)}, ${f(p.hi)})`}</title>
          </circle>
        ))}
        {labels.map((l) => (
          <text key={l.key} x={endX + 10} y={l.y} dy="0.32em" className={l.cls}>
            <tspan>{l.text}</tspan>
            {l.sub && <tspan x={endX + 10} dy="1.25em" className="end-sub">{l.sub}</tspan>}
          </text>
        ))}
      </svg>
    </div>
  );
}
