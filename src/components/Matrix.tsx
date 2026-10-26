import { scaleLinear } from "d3-scale";
import type { Lever } from "../data/types";
import { useT } from "../i18n/useT";
import { useWidth } from "./useWidth";

/** Impact / effort scatter, faithful to the deck: effort on x, impact on y, both 0 to 10. */
export function Matrix({ levers, active, onOpen }: { levers: Lever[]; active: number[]; onOpen: (id: string) => void }) {
  const { t, tx } = useT();
  const [ref, width] = useWidth<HTMLDivElement>();
  const H = Math.max(420, Math.min(560, width * 0.62));
  const m = { top: 16, right: 18, bottom: 44, left: 52 };
  const x = scaleLinear().domain([0, 10]).range([m.left, width - m.right]);
  const y = scaleLinear().domain([0, 10]).range([H - m.bottom, m.top]);
  const ticks = [0, 2, 4, 6, 8, 10];
  const r = 14;
  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={H} role="img" aria-label={t("levers.viewMatrix")}>
        <rect x={x(0)} y={y(10)} width={x(5) - x(0)} height={y(5) - y(10)} className="quad hi" />
        <rect x={x(5)} y={y(5)} width={x(10) - x(5)} height={y(0) - y(5)} className="quad lo" />
        <text x={x(0) + 12} y={y(10) + 20} className="quad-lab">{t("levers.quadHigh").toUpperCase()}</text>
        <text x={x(10) - 12} y={y(0) - 12} textAnchor="end" className="quad-lab">{t("levers.quadLow").toUpperCase()}</text>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={x(v)} x2={x(v)} y1={y(0)} y2={y(10)} className="grid" />
            <line x1={x(0)} x2={x(10)} y1={y(v)} y2={y(v)} className="grid" />
            <text x={x(v)} y={y(0) + 18} textAnchor="middle" className="axis">{v}</text>
            <text x={x(0) - 10} y={y(v)} dy="0.32em" textAnchor="end" className="axis">{v}</text>
          </g>
        ))}
        <text x={(x(0) + x(10)) / 2} y={H - 6} textAnchor="middle" className="axis-title">{t("levers.x")}</text>
        <text transform={`translate(14, ${(y(0) + y(10)) / 2}) rotate(-90)`} textAnchor="middle" className="axis-title">{t("levers.y")}</text>
        {levers.map((l) => {
          const on = active.includes(l.number);
          return (
            <g key={l.id} className={`mpt t-${l.type} ${on ? "on" : "off"}`} transform={`translate(${x(l.deckEffort)},${y(l.deckImpact)})`}
              onClick={() => onOpen(l.id)} role="button" tabIndex={0} aria-label={`${l.number} · ${tx(l.label)}`}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(l.id); } }}>
              <title>{`${l.number} · ${tx(l.label)} (${t("levers.x")} ${l.deckEffort}, ${t("levers.y")} ${l.deckImpact})`}</title>
              {l.provisional && <circle r={r + 4} className="prov-ring" />}
              <circle r={r} />
              <text dy="0.34em" textAnchor="middle">{l.number}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
