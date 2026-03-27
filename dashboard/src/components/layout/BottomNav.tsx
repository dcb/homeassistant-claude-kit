import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import type { NavItem, ViewId } from "../../lib/navigation";

interface BottomNavProps {
  items: NavItem[];
  active: ViewId;
  onNavigate: (id: ViewId) => void;
}

export function BottomNav({ items, active, onNavigate }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 bg-bg-primary/90 backdrop-blur-lg md:hidden">
      <div className="flex items-center justify-around px-1 pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="relative flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors"
            >
              {isActive && (
                <motion.div
                  layoutId="bottomnav-indicator"
                  className="absolute -top-px left-3 right-3 h-0.5 rounded-full bg-accent"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <Icon
                icon={item.icon}
                width={22}
                className={isActive ? "text-accent" : "text-text-dim"}
              />
              <span
                className={`text-[10px] leading-tight ${
                  isActive
                    ? "font-medium text-accent"
                    : "text-text-dim"
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
