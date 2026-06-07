// ─────────────────────────────────────────────────────────────────────────
// MEALIE settings block for the Settings view.
//
// Paste the `MEALIE_SETTINGS` array into your dashboard's
// `src/views/settings-constants.ts`, then add the import for the three
// entity constants it references (shown below), and render the section in
// your Settings view (see README → "Wire the Settings section").
//
// Requires the `SettingConfig` type from `../lib/settings-types` (already part
// of the kit core) and the RECIPE_* / MEALIE_* constants you pasted into
// `entities.ts` (see entities-snippet.ts).
// ─────────────────────────────────────────────────────────────────────────

// Add these names to the existing `import { ... } from "../lib/entities";`
// block at the top of settings-constants.ts:
import {
  RECIPE_IMPORT_PROVIDER,
  RECIPE_IMPORT_UNIT_SYSTEM,
  RECIPE_LIBRARY_PAGE_SIZE,
  RECIPE_SHOPPING_POLL_SECONDS,
} from "../lib/entities";
import type { SettingConfig } from "../lib/settings-types";

export const MEALIE_SETTINGS: SettingConfig[] = [
  {
    kind: "select",
    entity: RECIPE_IMPORT_PROVIDER,
    label: "Import provider",
    help: "LLM used to parse pasted recipe text into Mealie's schema. Claude is cheaper and faster; OpenAI is the fallback.",
    options: [
      { value: "claude", label: "Claude (Sonnet 4.6)" },
      { value: "openai", label: "OpenAI (gpt-5.4-mini)" },
    ],
  },
  {
    kind: "select",
    entity: RECIPE_IMPORT_UNIT_SYSTEM,
    label: "Unit system",
    help: "Drives conversion at import time. Metric converts cups/fl oz/lb/oz to g/ml/kg; imperial keeps US units. tsp, tbsp and count units (eggs, cloves) are kept either way.",
    options: [
      { value: "metric", label: "Metric (g, ml, kg)" },
      { value: "imperial", label: "Imperial (cup, oz, lb)" },
    ],
  },
  { kind: "number", entity: RECIPE_LIBRARY_PAGE_SIZE, label: "Library page size", unit: "recipes", min: 10, max: 100, step: 10,
    help: "Recipes per page in the Library view." },
  { kind: "number", entity: RECIPE_SHOPPING_POLL_SECONDS, label: "Shopping list refresh", unit: "s", min: 2, max: 30, step: 1,
    help: "How often the shopping list checks Mealie for updates from other devices." },
];
