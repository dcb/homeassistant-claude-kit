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
  /** undefined = always visible; "seasonal" = hidden in summer; "admin" = admin only */
  visible?: "seasonal" | "admin";
}

export const NAV_ITEMS: NavItem[] = [
  { id: "home",      label: "Home",     icon: "mdi:home" },
  { id: "climate",   label: "Climate",  icon: "mdi:radiator",      visible: "seasonal" },
  { id: "energy",    label: "Energy",   icon: "mdi:solar-power-variant" },
  { id: "security",  label: "Security", icon: "mdi:shield-home" },
  { id: "settings",  label: "Settings", icon: "mdi:cog" },
  { id: "health",    label: "System",   icon: "mdi:heart-pulse",   visible: "admin" },
];
