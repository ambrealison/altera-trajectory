import type { Lever, LeverPlot } from "../data/types";
import { useT } from "../i18n/useT";

/** Numbered disc coloured by lever type (green, violet, peach ringed with orange). */
export function LeverNumber({ lever, size = 26, muted }: { lever: Pick<Lever, "number" | "type" | "provisional">; size?: number; muted?: boolean }) {
  return (
    <span className={`lnum t-${lever.type} ${muted ? "muted" : ""} ${lever.provisional ? "prov" : ""}`} style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {lever.number}
    </span>
  );
}

export function TypeBadge({ type }: { type: Lever["type"] }) {
  const { t } = useT();
  return <span className={`chip type t-${type}`}><i />{t(`types.${type}`)}</span>;
}

export function plotLabel(p: LeverPlot, t: (k: string, v?: Record<string, string | number>) => string) {
  if (p === "outside") return t("plots.outside");
  if (p === "transverse") return t("plots.transverse");
  if (p === "other") return t("plots.other");
  return t("plots.plot", { n: p });
}

export function PlotTags({ plots }: { plots: LeverPlot[] }) {
  const { t } = useT();
  return (
    <span className="plot-tags">
      {plots.map((p) => (
        <span key={p} className={`chip plot ${p === "outside" ? "outside" : ""}`}>{plotLabel(p, t)}</span>
      ))}
    </span>
  );
}

export function StatusPill({ tone = "neutral", children }: { tone?: "neutral" | "within" | "above" | "well_above" | "lav"; children: React.ReactNode }) {
  return <span className={`status-pill ${tone}`}><i />{children}</span>;
}
