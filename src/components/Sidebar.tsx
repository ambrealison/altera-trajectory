import { useApp } from "../state/store";
import { SCREENS } from "../state/types";
import { useT } from "../i18n/useT";
import { Icon } from "./Icon";

/** "ÉTAPES": free navigation, no blocking validation. Visited steps get a green check. */
export function Sidebar() {
  const { state, dispatch } = useApp();
  const { t } = useT();
  return (
    <nav className="side" aria-label={t("steps.label")}>
      <div className="side-label">{t("steps.label")}</div>
      {SCREENS.map((id, i) => {
        const now = state.screen === id;
        const done = !now && state.visited.includes(id);
        return (
          <button key={id} type="button" className={`pstep ${now ? "now" : ""} ${done ? "done" : ""}`} aria-current={now ? "step" : undefined}
            onClick={() => dispatch({ type: "go", screen: id })}>
            <span className="ic">{done ? <Icon name="check" size={14} /> : i + 1}</span>
            <span>{t(`steps.${id}`)}</span>
          </button>
        );
      })}
      <p className="side-note">{t("steps.sideNote")}</p>
    </nav>
  );
}
