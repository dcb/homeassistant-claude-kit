import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import type { NavItem, ViewId } from "../../lib/navigation";

interface SidebarProps {
  items: NavItem[];
  active: ViewId;
  onNavigate: (id: ViewId) => void;
}

export function Sidebar({ items, active, onNavigate }: SidebarProps) {
  return (
    <nav className="hidden md:flex fixed left-0 top-0 bottom-0 z-50 w-[72px] flex-col items-center gap-1 border-r border-white/5 bg-bg-primary py-4">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
        <Icon icon="mdi:home-automation" width={24} className="text-accent" />
      </div>

      <div className="flex flex-1 flex-col items-center gap-1">
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="group relative flex h-12 w-14 flex-col items-center justify-center rounded-xl transition-colors hover:bg-white/5 active:bg-white/5"
              title={item.label}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-indicator"
                  className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-accent"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <Icon
                icon={item.icon}
                width={22}
                className={
                  isActive
                    ? "text-accent"
                    : "text-text-dim group-hover:text-text-secondary"
                }
              />
              <span
                className={`mt-0.5 text-[9px] leading-tight ${
                  isActive
                    ? "font-medium text-accent"
                    : "text-text-dim group-hover:text-text-secondary"
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
