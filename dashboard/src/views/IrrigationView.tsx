export function IrrigationView() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 py-2">
      <h1 className="text-lg font-semibold">Irrigation</h1>
      <PlaceholderSection title="Zone Cards" description="7 Hydrawise zones with status, run/stop controls" />
      <PlaceholderSection title="Schedule" description="Next scheduled run with zone list" />
      <PlaceholderSection title="Weather Context" description="Rain forecast and smart skip recommendation" />
    </div>
  );
}

function PlaceholderSection({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-bg-card/50 p-5">
      <h2 className="text-sm font-medium text-text-secondary">{title}</h2>
      <p className="mt-1 text-xs text-text-dim">{description}</p>
    </div>
  );
}
