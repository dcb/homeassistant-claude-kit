import { Icon } from "@iconify/react";
import { APP_DEFINITIONS, type AppDefinition } from "../../lib/tv-adapter";

interface AppStripProps {
  activeApp: AppDefinition | undefined;
  onLaunch: (app: AppDefinition) => void;
}

export function AppStrip({ activeApp, onLaunch }: AppStripProps) {
  return (
    <div className="flex justify-between">
      {APP_DEFINITIONS.map((app) => {
        const isActive = activeApp?.name === app.name;
        return (
          <button
            key={app.name}
            onClick={() => onLaunch(app)}
            className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors active:bg-white/10 ${
              isActive
                ? "bg-white/5"
                : "bg-white/4 hover:bg-white/8"
            }`}
            style={{
              border: isActive
                ? `1px solid ${app.color}`
                : "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <Icon icon={app.icon} width={24} style={{ color: app.color }} />
          </button>
        );
      })}
    </div>
  );
}
