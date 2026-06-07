export type ViewId =
  | "home"
  | "climate"
  | "energy"
  | "security"
  | "irrigation"
  | "settings"
  | "health";

export interface NavItem {
  id: ViewId;
  label: string;
  icon: string;
  /** Only shown when predicate returns true. Always shown if undefined. */
  visible?: "seasonal" | "admin";
}

/**
 * Navigation items in usage-frequency order.
 * Icons use Iconify names (mdi set).
 */
export const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Home", icon: "mdi:home" },
  { id: "climate", label: "Climate", icon: "lucide:thermometer-sun" },
  { id: "energy", label: "Energy", icon: "mdi:solar-power" },
  { id: "security", label: "Security", icon: "mdi:shield-home" },
  { id: "irrigation", label: "Irrigation", icon: "mdi:sprinkler", visible: "seasonal" },
  { id: "settings", label: "Settings", icon: "mdi:cog", visible: "admin" },
  { id: "health", label: "Health", icon: "mdi:heart-pulse", visible: "admin" },
];
