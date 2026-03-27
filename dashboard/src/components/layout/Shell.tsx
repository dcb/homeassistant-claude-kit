import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ViewId } from "../../lib/navigation";
import { useNavVisibility } from "../../hooks/useNavVisibility";
import { ErrorBoundary } from "../ErrorBoundary";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { HEADER_CONFIG } from "../../lib/entities";

interface ShellProps {
  views: Record<ViewId, ReactNode>;
}

const pageVariants = {
  enter: { opacity: 0, y: 8 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export function Shell({ views }: ShellProps) {
  const [activeView, setActiveView] = useState<ViewId>("home");
  const visibleItems = useNavVisibility();

  return (
    <div className="flex h-dvh bg-bg-primary">
      {/* Desktop sidebar */}
      <Sidebar
        items={visibleItems}
        active={activeView}
        onNavigate={setActiveView}
      />

      {/* Main content area — min-w-0 lets this flex child shrink below content width */}
      <div className="flex min-w-0 flex-1 flex-col md:ml-[72px]">
        <main className="relative min-w-0 flex-1 overflow-y-auto pb-20 md:pb-4">
          <Header config={HEADER_CONFIG} />
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="px-4"
            >
              <ErrorBoundary key={activeView} label={`${activeView} view`}>
                {views[activeView]}
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav
        items={visibleItems}
        active={activeView}
        onNavigate={setActiveView}
      />
    </div>
  );
}
