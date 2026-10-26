/** Thin rounded horizontal bar, as in the reference tool's breakdowns. */
export function HBar({ value, color, height = 8 }: { value: number; color: string; height?: number }) {
  const w = Math.max(0, Math.min(1, value));
  return (
    <span className="track" style={{ height }}>
      <i style={{ width: `${w * 100}%`, background: color }} />
    </span>
  );
}
