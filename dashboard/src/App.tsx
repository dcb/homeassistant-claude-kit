import { lazy, Suspense } from "react";
import { HAProvider } from "./providers/HAProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Shell } from "./components/layout/Shell";
import { HomeView } from "./views/HomeView";

const ClimateView = lazy(() => import("./views/ClimateView").then((m) => ({ default: m.ClimateView })));
const EnergyView = lazy(() => import("./views/EnergyView").then((m) => ({ default: m.EnergyView })));
const SecurityView = lazy(() => import("./views/SecurityView").then((m) => ({ default: m.SecurityView })));
const IrrigationView = lazy(() => import("./views/IrrigationView").then((m) => ({ default: m.IrrigationView })));
const SettingsView = lazy(() => import("./views/SettingsView").then((m) => ({ default: m.SettingsView })));
const SystemHealthView = lazy(() => import("./views/SystemHealthView").then((m) => ({ default: m.SystemHealthView })));

function LazyView({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

const views = {
  home: <HomeView />,
  climate: <LazyView><ClimateView /></LazyView>,
  energy: <LazyView><EnergyView /></LazyView>,
  security: <LazyView><SecurityView /></LazyView>,
  irrigation: <LazyView><IrrigationView /></LazyView>,
  settings: <LazyView><SettingsView /></LazyView>,
  health: <LazyView><SystemHealthView /></LazyView>,
} as const;

export default function App() {
  return (
    <ErrorBoundary>
      <HAProvider>
        <Shell views={views} />
      </HAProvider>
    </ErrorBoundary>
  );
}
