/**
 * Convert a Home Assistant icon string to an Iconify icon name.
 * HA uses "hass:foo", "mdi:foo", "phu:foo", etc.
 * Iconify uses "mdi:foo", "ph:foo", etc.
 */
export function haIconToIconify(haIcon: string): string {
  if (!haIcon) return "mdi:lightbulb";
  // Already a valid Iconify icon (contains ":")
  if (haIcon.includes(":")) {
    // Remap HA-specific prefixes
    const [prefix, name] = haIcon.split(":");
    if (prefix === "hass") return `mdi:${name}`;
    return haIcon; // mdi:, ph:, lucide: etc. pass through unchanged
  }
  // Plain name — assume mdi
  return `mdi:${haIcon}`;
}
