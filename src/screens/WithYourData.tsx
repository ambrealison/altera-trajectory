import { useT } from "../i18n/useT";
import { ScreenHead } from "../components/ScreenHead";
import { StatusPill } from "../components/LeverBits";
import { Icon } from "../components/Icon";

const MODULES = ["stores", "margin", "carbon", "sales", "history"] as const;

/** Blurred previews: small fake charts, deliberately unreadable, that only suggest the module. */
function Preview({ kind }: { kind: (typeof MODULES)[number] }) {
  const bars = { stores: [6, 9, 4, 8, 5, 7, 3, 9, 6], margin: [3, 5, 7, 6, 8, 5, 4], carbon: [9, 7, 6, 5, 4, 3, 2], sales: [4, 5, 5, 6, 7, 7, 8, 9], history: [5, 6, 4, 7, 5, 8, 6, 9, 7, 8] }[kind];
  const max = Math.max(...bars);
  return (
    <div className="preview" aria-hidden>
      <svg viewBox="0 0 200 90" preserveAspectRatio="none">
        {kind === "sales" || kind === "history" ? (
          <polyline fill="none" stroke="var(--green)" strokeWidth="3" points={bars.map((b, i) => `${10 + (i * 180) / (bars.length - 1)},${80 - (b / max) * 65}`).join(" ")} />
        ) : (
          bars.map((b, i) => (
            <rect key={i} x={10 + i * (180 / bars.length)} y={85 - (b / max) * 70} width={180 / bars.length - 6} height={(b / max) * 70} rx="3"
              fill={kind === "carbon" ? "var(--plant-2)" : kind === "margin" ? "var(--lav)" : "var(--animal)"} />
          ))
        )}
      </svg>
    </div>
  );
}

export function WithYourData() {
  const { t } = useT();
  return (
    <>
      <ScreenHead id="data" status={<StatusPill>{t("data.status")}</StatusPill>} />
      <div className="modules" data-tour="data-modules">
        {MODULES.map((k) => (
          <article key={k} className="module">
            <Preview kind={k} />
            <span className="chip locked"><Icon name="lock" size={12} />{t("data.locked")}</span>
            <div className="module-body">
              <h3>{t(`data.${k}Title`)}</h3>
              <p><span className="lbl">{t("data.with")}</span>{t(`data.${k}With`)}</p>
              <p><span className="lbl get">{t("data.get")}</span>{t(`data.${k}Get`)}</p>
            </div>
          </article>
        ))}
        <article className="module note" data-tour="data-note">
          <p>{t("data.note")}</p>
          <p className="sub">{t("drawer.footer")}</p>
        </article>
      </div>
    </>
  );
}
