import type { ReactNode } from "react";
import { config, dataset } from "../data";
import { useT } from "../i18n/useT";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function Layout({ children }: { children: ReactNode }) {
  const { tx } = useT();
  return (
    <div className="app">
      <Header />
      <div className="body">
        <Sidebar />
        <main className="main" id="main">{children}</main>
      </div>
      <footer className="foot">
        <span>{tx(config.footer.left)}</span>
        <span>{dataset.footer}</span>
      </footer>
    </div>
  );
}
