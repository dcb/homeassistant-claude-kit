// Climate view — starter version.
//
// For zone heating (TRVs + boiler), copy from docs/templates/cards/:
//   ClimateModePicker, ZoneCard, ZoneOverrides, BoilerCard, AcStatus
// Then add your zone config from entities.ts and wire it here.

export function ClimateView() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 py-2">
      <h1 className="text-lg font-semibold">Climate</h1>
      <p className="text-sm text-text-dim">
        Add your climate cards here. See{" "}
        <code>docs/templates/cards/</code> for zone heating, AC, and boiler
        components.
      </p>
    </div>
  );
}
