import type { ReactNode } from "react";
import { useApp } from "../state/store";
import { SCREENS, type ScreenId } from "../state/types";
import { useT } from "../i18n/useT";
import { PillButton } from "./PillButton";
import { Icon } from "./Icon";

/** Screen title block: step label, title, description; status pill and next step on the right. */
export function ScreenHead({ id, status }: { id: ScreenId; status?: ReactNode }) {
  const { dispatch } = useApp();
  const { t } = useT();
  const i = SCREENS.indexOf(id);
  const next = SCREENS[i + 1];
  return (
    <div className="shead">
      <div>
        <div className="k">{t("steps.stepOf", { n: i + 1, total: SCREENS.length })}</div>
        <h1>{t(`${id === "data" ? "data" : id}.title`)}</h1>
        <p>{t(`${id}.desc`)}</p>
      </div>
      <div className="shead-r">
        {status}
        {next && (
          <PillButton variant="next" onClick={() => dispatch({ type: "go", screen: next })}>
            {t("steps.next")} <Icon name="arrow" size={15} />
          </PillButton>
        )}
      </div>
    </div>
  );
}
