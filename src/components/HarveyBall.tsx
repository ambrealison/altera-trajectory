import { useT } from "../i18n/useT";

const KEYS: Record<number, string> = { [-2]: "drawer.harveyM2", [-1]: "drawer.harveyM1", 0: "drawer.harvey0", 1: "drawer.harveyP1", 2: "drawer.harveyP2" };

/** Qualitative score from -2 to +2: the share of the disc filled is |score| / 2, green when positive,
 *  terracotta when negative, an empty ring when neutral. Never a figure in euros. */
export function HarveyBall({ score, size = 22, compact }: { score: number; size?: number; compact?: boolean }) {
  const { t } = useT();
  const s = Math.max(-2, Math.min(2, Math.round(score)));
  const r = size / 2 - 1.5;
  const c = size / 2;
  const frac = Math.abs(s) / 2;
  const color = s > 0 ? "var(--green)" : "var(--animal)";
  const label = t(KEYS[s]);
  let fill = null;
  if (frac === 1) fill = <circle cx={c} cy={c} r={r} fill={color} />;
  else if (frac > 0) {
    // half disc, right side for positive, left side for negative
    const sweep = s > 0 ? 1 : 0;
    fill = <path d={`M ${c} ${c - r} A ${r} ${r} 0 0 ${sweep} ${c} ${c + r} Z`} fill={color} />;
  }
  return (
    <span className="harvey" title={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <circle cx={c} cy={c} r={r} fill="var(--white)" stroke={s === 0 ? "var(--faint)" : color} strokeWidth="1.5" />
        {fill}
      </svg>
      {!compact && <span>{label}</span>}
    </span>
  );
}
