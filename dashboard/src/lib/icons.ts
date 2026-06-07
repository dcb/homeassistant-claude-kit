/**
 * Map Home Assistant icon names to Iconify-compatible icon IDs.
 *
 * HA uses these prefixes:
 *   - "mdi:*"  → Material Design Icons, works directly with @iconify/react
 *   - "phu:*"  → custom-brand-icons (Philips Hue etc.), maps to "cbi:*" in Iconify
 *
 * @iconify/react fetches icons from the Iconify API on demand (no bundling needed).
 */
export function haIconToIconify(haIcon: string): string {
  if (haIcon.startsWith("phu:")) {
    return "cbi:" + haIcon.slice(4);
  }
  // mdi:, simple-icons:, etc. pass through unchanged
  return haIcon;
}
