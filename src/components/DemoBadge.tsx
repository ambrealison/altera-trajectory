import { useT } from "../i18n/useT";

/** Permanent "illustrative data" badge, visible on every screen and in every screenshot. */
export function DemoBadge() {
  const { t } = useT();
  return <span className="demo-badge" role="note">{t("app.demoBadge")}</span>;
}
