import { Icon } from "@iconify/react";
import { useEntityState } from "../../lib/useEntityState";
import { MEALIE_TODAYS_DINNER } from "../../lib/entities";

const EMPTY_STATES = new Set(["", "No dinner planned", "unavailable", "unknown"]);

export function TonightsDinnerCard() {
  const dinner = useEntityState(MEALIE_TODAYS_DINNER) ?? "";
  if (EMPTY_STATES.has(dinner.trim())) return null;

  return (
    <div className="rounded-2xl bg-white/5 p-4 flex items-center gap-3">
      <div className="size-10 rounded-xl bg-orange-400/20 grid place-items-center shrink-0">
        <Icon icon="mdi:silverware-fork-knife" width={22} className="text-orange-300" />
      </div>
      <div className="min-w-0">
        <div className="text-white/50 text-xs uppercase tracking-wide">Tonight's dinner</div>
        <div className="text-white truncate">{dinner}</div>
      </div>
    </div>
  );
}
