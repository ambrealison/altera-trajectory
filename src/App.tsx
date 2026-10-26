import { useEffect } from "react";
import { AppProvider, useApp } from "./state/store";
import { Layout } from "./components/Layout";
import { LeverDrawer } from "./components/LeverDrawer";
import { Tour } from "./components/Tour";
import { Baseline } from "./screens/Baseline";
import { Levers } from "./screens/Levers";
import { Trajectory } from "./screens/Trajectory";
import { WithYourData } from "./screens/WithYourData";

function Screens() {
  const { state } = useApp();
  useEffect(() => { document.getElementById("main")?.scrollTo({ top: 0 }); }, [state.screen]);
  return (
    <Layout>
      {state.screen === "baseline" && <Baseline />}
      {state.screen === "levers" && <Levers />}
      {state.screen === "trajectory" && <Trajectory />}
      {state.screen === "data" && <WithYourData />}
      <LeverDrawer />
      <Tour />
    </Layout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Screens />
    </AppProvider>
  );
}
