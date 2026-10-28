import type { Lang, Lever } from "../data/types";
import { groupById, leverGroups } from "../data";
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

/** Label of a category tag: a plant group of the dataset, or a lever scope. */
export function tagLabel(tag: string, t: (k: string, v?: Record<string, string | number>) => string, lang: Lang) {
  if (tag === "outside" || tag === "transverse") return t(`scope.${tag}`);
  return groupById(tag)?.label[lang] ?? tag;
}

/** Tags of a lever: its scope when it has one, otherwise the plant groups it acts on. */
export const leverTags = (l: Lever): string[] => (l.scope?.length ? l.scope : leverGroups(l));

export function CategoryTags({ lever, max = 3 }: { lever: Lever; max?: number }) {
  const { t, lang } = useT();
  const tags = leverTags(lever);
  const shown = tags.slice(0, tags.length > max ? max - 1 : max);
  const rest = tags.length - shown.length;
  return (
    <span className="plot-tags">
      {shown.map((p) => (
        <span key={p} className={`chip plot ${p === "outside" ? "outside" : ""}`}>{tagLabel(p, t, lang)}</span>
      ))}
      {rest > 0 && <span className="chip plot more" title={tags.slice(shown.length).map((p) => tagLabel(p, t, lang)).join(", ")}>+{rest}</span>}
    </span>
  );
}

export function StatusPill({ tone = "neutral", children }: { tone?: "neutral" | "lav"; children: React.ReactNode }) {
  return <span className={`status-pill ${tone}`}><i />{children}</span>;
}
