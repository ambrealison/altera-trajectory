import { scaleLinear } from "d3-scale";
import { area, curveMonotoneX, stack } from "d3-shape";
import { fmtNum } from "../engine/format";
import { useT } from "../i18n/useT";
import { useWidth } from "./useWidth";
import { showYear } from "./TrajectoryChart";

export interface Layer { key: string; label: string; color: string }

/** Stacked areas of plant protein by plot, in ratio points, bottom layer first. */
export function StackedArea({ rows, layers }: { rows: ({ year: number } & Record<string, number>)[]; layers: Layer[] }) {
  const { lang } = useT();
  const [ref, width] = useWidth<HTMLDivElement>();
  const H = 220;
  const m = { top: 10, right: 235, bottom: 28, left: 44 };
  const x0 = rows[0].year, x1 = rows[rows.length - 1].year;
  const x = scaleLinear().domain([x0, x1]).range([m.left, Math.max(m.left + 200, width - m.right)]);
  const series = stack<Record<string, number>>().keys(layers.map((l) => l.key))(rows as Record<string, number>[]);
  const top = Math.max(...series[series.length - 1].map((d) => d[1]));
  const y = scaleLinear().domain([0, top * 1.04]).range([H - m.bottom, m.top]).nice();
  const ticks = y.ticks(4);
  const shape = area<[number, number] & { data: Record<string, number> }>()
    .x((d) => x(d.data.year)).y0((d) => y(d[0])).y1((d) => y(d[1])).curve(curveMonotoneX);
  const endX = x(x1);
  // right-hand labels at the middle of each layer in the last year, pushed apart when crowded
  const lab = series.map((s, i) => ({ i, y: y((s[s.length - 1][0] + s[s.length - 1][1]) / 2) }));
  const ordered = [...lab].sort((a, b) => b.y - a.y);
  for (let k = 1; k < ordered.length; k++) if (ordered[k - 1].y - ordered[k].y < 14) ordered[k].y = ordered[k - 1].y - 14;

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={H} role="img" aria-label={layers.map((l) => l.label).join(", ")}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={m.left} x2={endX} y1={y(v)} y2={y(v)} className="grid" />
            <text x={m.left - 8} y={y(v)} dy="0.32em" textAnchor="end" className="axis">{fmtNum(v, lang, 0)}</text>
          </g>
        ))}
        {rows.filter((r) => showYear(r.year, x0, x1, x)).map((r) => (
          <text key={r.year} x={x(r.year)} y={H - 8} textAnchor="middle" className="axis">{r.year}</text>
        ))}
        {series.map((s, i) => (
          <path key={layers[i].key} d={shape(s as never) ?? ""} fill={layers[i].color} stroke="var(--white)" strokeWidth={1}>
            <title>{layers[i].label}</title>
          </path>
        ))}
        {lab.map(({ i, y: ly }) => {
          const s = series[i];
          const v = s[s.length - 1][1] - s[s.length - 1][0];
          return (
            <g key={layers[i].key}>
              <circle cx={endX + 12} cy={ly} r={4} fill={layers[i].color} />
              <text x={endX + 21} y={ly} dy="0.32em" className="stack-lab">
                <tspan className="num">{fmtNum(v, lang, 1)}</tspan> {layers[i].label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
