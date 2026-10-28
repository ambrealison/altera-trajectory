import { config } from "../data";
import { useApp } from "../state/store";
import { useT } from "../i18n/useT";
import { DemoBadge } from "./DemoBadge";
import { Segmented } from "./Segmented";
import { Icon } from "./Icon";

export function Header() {
  const { state, dispatch } = useApp();
  const { t, tx } = useT();
  return (
    <header className="top">
      <div className="logo"><b>Altera<em>.ai</em></b></div>
      <div className="crumb">
        <b>{config.client}</b><span aria-hidden>·</span><span>{tx(config.title)}</span>
      </div>
      <div className="top-r">
        <DemoBadge />
        <button type="button" className="ghost" onClick={() => dispatch({ type: "tour", step: 0 })}>
          <Icon name="play" size={12} />{t("app.tour")}
        </button>
        <Segmented label={t("app.language")} size="sm" value={state.lang} onChange={(lang) => dispatch({ type: "lang", lang })}
          options={[{ value: "fr", label: "FR" }, { value: "en", label: "EN" }]} />
      </div>
    </header>
  );
}
