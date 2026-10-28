import { useMemo, useState } from "react";
import { model, scenarios } from "../data";
import { runYear } from "../engine/simulate";
import { fmtPct } from "../engine/format";
import { sameAsCustom, useApp } from "../state/store";
import { matchingPreset, presetFields } from "../state/url";
import { useT } from "../i18n/useT";
import { Card } from "./Card";
import { PillButton } from "./PillButton";
import { Icon } from "./Icon";

/** Scenarios: the four suggested by Altera, the ones the user saved (in this browser), saving,
 *  renaming, deleting, copying a link that reopens the scenario, and pinning one to compare. */
export function ScenarioPanel({ pinnedName, pinnedValue }: { pinnedName?: string; pinnedValue: string }) {
  const { state, dispatch } = useApp();
  const { t, tx, lang } = useT();
  const metric = state.metric;
  const current = matchingPreset(state);
  const [naming, setNaming] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const presetValues = useMemo(
    () => Object.fromEntries(scenarios.map((s) => [s.id, runYear(model, presetFields(s.id), state.horizon).metrics[metric]])),
    [state.horizon, metric],
  );
  const customValues = useMemo(
    () => Object.fromEntries(state.customs.map((c) => [c.id, runYear(model, c, state.horizon).metrics[metric]])),
    [state.customs, state.horizon, metric],
  );
  const loaded = state.customs.find((c) => c.id === state.custom);
  const modified = loaded ? !sameAsCustom(state, loaded) : false;
  const onCustomExact = state.customs.find((c) => sameAsCustom(state, c));
  const save = () => {
    if (naming === null) return;
    dispatch({ type: "saveCustom", name: naming || t("scenario.defaultName", { n: state.customs.length + 1 }) });
    setNaming(null);
  };
  const copyLink = () => {
    try {
      void navigator.clipboard?.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked: the address bar still holds the link */ }
  };

  return (
    <Card title={t("scenario.title")} data-tour="scenarios">
      <div className="sc-group" data-tour="scenarios-suggested">
        <span className="sc-k">{t("scenario.suggested")}</span>
        <div className="presets">
          {scenarios.map((s) => (
            <button key={s.id} type="button" className={`preset ${current === s.id ? "on" : ""}`} aria-pressed={current === s.id}
              onClick={() => dispatch({ type: "preset", id: s.id })} title={tx(s.description)}>
              <b>{tx(s.label)}</b>
              <span className="num">{fmtPct(presetValues[s.id], lang)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="sc-group" data-tour="scenarios-custom">
        <span className="sc-k">{t("scenario.yours")}</span>
        {state.sharedName && (
          <div className="sc-shared">
            <span>{t("scenario.shared", { name: state.sharedName })}</span>
            <PillButton small variant="secondary" onClick={() => setNaming(state.sharedName)}>{t("scenario.saveShared")}</PillButton>
          </div>
        )}
        {state.customs.length === 0 && naming === null && <p className="small-note">{t("scenario.none")}</p>}
        {state.customs.length > 0 && (
          <ul className="customs">
            {state.customs.map((c) => {
              const on = state.custom === c.id && !modified;
              return (
                <li key={c.id} className={on ? "on" : ""}>
                  {renaming?.id === c.id ? (
                    <form className="sc-name" onSubmit={(e) => { e.preventDefault(); dispatch({ type: "renameCustom", id: c.id, name: renaming.name }); setRenaming(null); }}>
                      <input autoFocus value={renaming.name} maxLength={60} aria-label={t("scenario.rename")} onChange={(e) => setRenaming({ id: c.id, name: e.target.value })} />
                      <button type="submit" className="icon-btn" aria-label={t("scenario.ok")}><Icon name="check" size={14} /></button>
                    </form>
                  ) : (
                    <button type="button" className="preset custom" aria-pressed={on} onClick={() => dispatch({ type: "loadCustom", id: c.id })}>
                      <b>{c.name}</b>
                      <span className="num">{fmtPct(customValues[c.id], lang)}</span>
                    </button>
                  )}
                  <span className="sc-actions">
                    <button type="button" className="icon-btn" title={t("scenario.rename")} aria-label={t("scenario.rename")} onClick={() => setRenaming({ id: c.id, name: c.name })}><Icon name="edit" size={13} /></button>
                    <button type="button" className="icon-btn" title={t("scenario.delete")} aria-label={t("scenario.delete")}
                      onClick={() => { if (window.confirm(t("scenario.confirmDelete", { name: c.name }))) dispatch({ type: "deleteCustom", id: c.id }); }}>
                      <Icon name="close" size={13} />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {naming !== null ? (
          <form className="sc-name" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <input autoFocus value={naming} maxLength={60} placeholder={t("scenario.namePlaceholder")} aria-label={t("scenario.name")} onChange={(e) => setNaming(e.target.value)} />
            <PillButton small type="submit">{t("scenario.save")}</PillButton>
            <button type="button" className="link" onClick={() => setNaming(null)}>{t("scenario.cancel")}</button>
          </form>
        ) : (
          <div className="sc-buttons">
            {loaded && modified && (
              <PillButton small variant="secondary" onClick={() => dispatch({ type: "updateCustom", id: loaded.id })}>{t("scenario.update", { name: loaded.name })}</PillButton>
            )}
            {!onCustomExact && (
              <PillButton small variant="secondary" onClick={() => setNaming("")}>+ {t("scenario.saveCurrent")}</PillButton>
            )}
          </div>
        )}
        <p className="small-note">{t("scenario.storageNote")}</p>
      </div>

      <div className="pinrow">
        {state.pinned ? (
          <span className="pinned-chip">
            <Icon name="pin" size={13} />
            <span>{t("trajectory.pinned", { name: pinnedName ?? "", value: pinnedValue })}</span>
            <button type="button" onClick={() => dispatch({ type: "unpin" })}>{t("trajectory.unpin")}</button>
          </span>
        ) : (
          <PillButton variant="secondary" small onClick={() => dispatch({ type: "pin" })}>
            <Icon name="pin" size={13} /> {t("trajectory.pin")}
          </PillButton>
        )}
        <PillButton variant="ghost" small onClick={copyLink}>{copied ? t("scenario.copied") : t("scenario.copyLink")}</PillButton>
      </div>
    </Card>
  );
}
