/**
 * @file BoilerDiagCard — Detailed boiler telemetry (eBus register values).
 *
 * @ha-integration ebusd — same as BoilerCard; exposes raw register values
 * @ha-helpers    Same as BoilerCard (heating curve input_numbers, climate_mode)
 * @ha-automation Same as BoilerCard (config/automations/climate.yaml)
 *
 * Shows raw eBus register values (flow/return temps, modulation, EEPROM write counter).
 * The EEPROM write counter tracks writes to non-volatile boiler memory — some registers
 * have a finite write cycle limit. Never wire EEPROM-backed registers into high-frequency
 * control loops without checking your boiler's write durability specification.
 *
 * Status strings are ebusd-specific — see BoilerCard for details.
 *
 * Remove this block once prerequisites are satisfied and entity IDs are filled in entities.ts.
 */
import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { Icon } from "@iconify/react";
import type { BoilerDiagConfig } from "../../lib/entities";

function val(entities: HassEntities, id: string): string | null {
  const s = entities[id]?.state;
  if (!s || s === "unavailable" || s === "unknown") return null;
  return s;
}

function Row({ label, value, unit, warn }: {
  label: string;
  value: string | null;
  unit?: string;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-text-secondary">{label}</span>
      <span className={`font-medium tabular-nums ${warn ? "text-red-400" : ""}`}>
        {value ?? "—"}{value && unit ? ` ${unit}` : ""}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] font-medium uppercase tracking-wider text-text-dim pt-2 first:pt-0">
        {title}
      </div>
      {children}
    </div>
  );
}

export function BoilerDiagCard({ config }: { config: BoilerDiagConfig }) {
  const entities = useHass((s) => s.entities) as HassEntities;

  const status = val(entities, config.status);
  const diverter = val(entities, config.diverter);
  const flowTemp = val(entities, config.flowTemp);
  const returnTemp = val(entities, config.returnTemp);
  const modulation = val(entities, config.modulation);
  const delta = val(entities, config.efficiencyDelta);
  const targetFlow = val(entities, config.targetFlow);
  const fixedTemp = val(entities, config.fixedTemp);
  const slope = val(entities, config.heatingCurveSlope);
  const offset = val(entities, config.heatingCurveOffset);
  const influence = val(entities, config.heatingCurveRoomInfluence);
  const flowMax = val(entities, config.flowTempMax);
  const flowMin = val(entities, config.flowTempMin);
  const dhwTarget = val(entities, config.dhwTarget);
  const heatingStatus = val(entities, config.heatingStatus);
  const eepromCounter = val(entities, config.eepromCounter);
  const uptime = val(entities, config.uptime);

  const returnNum = returnTemp ? parseFloat(returnTemp) : null;
  const condensing = returnNum != null ? returnNum < 55 : null;

  const uptimeFormatted = uptime
    ? `${Math.floor(parseInt(uptime) / 3600)}h ${Math.floor((parseInt(uptime) % 3600) / 60)}m`
    : null;

  return (
    <div className="contain-card rounded-2xl bg-bg-card p-4 text-xs space-y-1">
      <div className="flex items-center gap-2 pb-1">
        <Icon icon="mdi:water-boiler" width={18} />
        <span className="text-sm font-medium">Boiler Diagnostics</span>
      </div>

      <Section title="Status">
        <Row label="Boiler status" value={status} />
        <Row label="Diverter valve" value={diverter} />
        <Row label="Heating (seasonal)" value={heatingStatus} />
        <Row label="Flame power" value={modulation} unit="kW" />
      </Section>

      <Section title="Temperatures">
        <Row label="Flow temp" value={flowTemp} unit="°C" />
        <Row label="Return temp" value={returnTemp} unit="°C" />
        <Row label="Flow-return delta" value={delta} unit="°C" />
        <div className="flex items-center justify-between py-0.5">
          <span className="text-text-secondary">Condensing</span>
          {condensing != null ? (
            <span className={`font-medium px-1.5 py-0.5 rounded-full text-[10px] ${
              condensing ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
            }`}>
              {condensing ? "yes" : "no"}
            </span>
          ) : (
            <span>—</span>
          )}
        </div>
      </Section>

      <Section title="Heating Curve">
        <Row label="HA computed target" value={targetFlow} unit="°C" />
        <Row label="Written to boiler" value={fixedTemp} unit="°C" />
        <Row label="Slope" value={slope} />
        <Row label="Offset" value={offset} unit="°C" />
        <Row label="Room influence" value={influence} unit="/ 20" />
        <Row label="Flow max" value={flowMax} unit="°C" />
        <Row label="Flow min" value={flowMin} unit="°C" />
      </Section>

      <Section title="DHW">
        <Row label="Target" value={dhwTarget} unit="°C" />
      </Section>

      <Section title="System">
        <Row
          label="EEPROM counter"
          value={eepromCounter}
          warn={eepromCounter != null && parseInt(eepromCounter) > 50000}
        />
        <Row label="ebusd uptime" value={uptimeFormatted} />
      </Section>
    </div>
  );
}
