import type { ReactNode } from "react";
import { useT } from "../i18n/useT";

/** White card with a small capitalised title. Chart cards carry the "illustrative data" mention. */
export function Card({ title, right, note, fictitious, className = "", children, ...rest }: { title?: ReactNode; right?: ReactNode; note?: ReactNode; fictitious?: boolean; className?: string; children: ReactNode } & { "data-tour"?: string }) {
  const { t } = useT();
  return (
    <section className={`card ${className}`} {...rest}>
      {(title || right) && (
        <header className="ctitle">
          <span>{title}</span>
          {right && <span className="ctitle-r">{right}</span>}
        </header>
      )}
      {children}
      {(note || fictitious) && (
        <footer className="cnote">
          <span>{note}</span>
          {fictitious && <span className="fict">{t("app.fictitious")}</span>}
        </footer>
      )}
    </section>
  );
}
