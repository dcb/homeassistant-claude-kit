import type { HassEntity } from "home-assistant-js-websocket";

/**
 * Whether a thermostatic radiator valve is *actively* calling for heat.
 *
 * `state === "heat"` only means the TRV is in heat *mode* — capable of
 * heating. With a 5°C setpoint and 22°C current temperature, the valve is
 * closed even though state is "heat". Treating state="heat" as "open / heating"
 * lights up the room indicator for a radiator that is doing nothing.
 *
 * Preferred signal: `hvac_action` (some TRVs report "heating" / "idle"),
 * falling back to a setpoint-vs-current comparison.
 */
export function isTrvActivelyHeating(entity: HassEntity | undefined): boolean {
  if (!entity || entity.state !== "heat") return false;

  const action = entity.attributes?.hvac_action as string | undefined;
  if (action) return action === "heating";

  const setpoint = Number(entity.attributes?.temperature);
  const current = Number(entity.attributes?.current_temperature);
  if (!Number.isFinite(setpoint) || !Number.isFinite(current)) return false;
  return setpoint > current;
}
