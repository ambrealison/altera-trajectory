import { useEffect, useRef } from "react";
import { levers } from "../data";
import { useApp } from "../state/store";
import { useT } from "../i18n/useT";
import { Toggle } from "./Toggle";
import { PillButton } from "./PillButton";
import { Icon } from "./Icon";
import { CategoryTags, LeverNumber, TypeBadge } from "./LeverBits";

/** Lever card, a short panel on the right reachable from every screen: what the lever is, who
 *  carries it, and the way into its full page (assumptions, effects, evidence). */
export function LeverDrawer() {
  const { state, dispatch } = useApp();
  const { t, tx } = useT();
  const panel = useRef<HTMLDivElement>(null);
  const lever = levers.find((l) => l.id === state.drawer);

  useEffect(() => {
    if (!lever) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") dispatch({ type: "drawer", lever: null }); };
    window.addEventListener("keydown", onKey);
    panel.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [lever, dispatch]);

  if (!lever) return null;
  const on = state.activeLevers.includes(lever.number);
  const close = () => dispatch({ type: "drawer", lever: null });

  return (
    <div className="drawer-wrap" role="presentation" onClick={close}>
      <aside className="drawer drawer-short" role="dialog" aria-modal="true" aria-labelledby="drawer-title" ref={panel} tabIndex={-1} onClick={(ev) => ev.stopPropagation()}>
        <header className="drawer-h">
          <div className="drawer-title">
            <LeverNumber lever={lever} size={36} />
            <div>
              <span className="k">{t("drawer.title")}</span>
              <h2 id="drawer-title">{tx(lever.label)}</h2>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={close} aria-label={t("app.close")}><Icon name="close" size={18} /></button>
        </header>
        <div className="drawer-badges">
          <TypeBadge type={lever.type} />
          <CategoryTags lever={lever} max={4} />
          {lever.provisional && <span className="chip warn">{t("levers.provisional")}</span>}
        </div>
        <div className="drawer-active">
          <span>{t("drawer.active")}</span>
          <Toggle on={on} label={t("drawer.active")} onChange={() => dispatch({ type: "toggleLever", number: lever.number })} />
        </div>

        <div className="drawer-body">
          <section>
            <h3>{t("drawer.description")}</h3>
            <p>{tx(lever.description)}</p>
            <h3>{t("drawer.owner")}</h3>
            <p>{tx(lever.owner)}</p>
          </section>
          <section className="drawer-open">
            <PillButton onClick={() => dispatch({ type: "openLever", lever: lever.id })}>
              {t("drawer.open")} <Icon name="arrow" size={14} />
            </PillButton>
            <p className="small muted">{lever.dossier ? t("drawer.openDossier") : t("drawer.openTemplate")}</p>
          </section>
        </div>
      </aside>
    </div>
  );
}
