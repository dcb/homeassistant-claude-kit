---
title: v0.2.0 — Irrigation (core view) + Recipes (optional template) + TRV fix
type: feat
status: active
date: 2026-06-07
origin: docs/brainstorms/2026-06-07-kit-versioning-agent-upgrade-brainstorm.md
---

# v0.2.0 — Irrigation core view + Recipes template + TRV fix

Phase 2 of the kit-versioning effort: the first **real content sync**, dogfooding the `release` skill.
Bundled into one release (`v0.2.0`). Grounded in the two discovery reports (2026-06-07).

## Scope (confirmed with maintainer)

1. **TRV active-heating fix** — DONE (commit `27fd79b`): `dashboard/src/lib/climate.ts::isTrvActivelyHeating` wired into `useRoomState.ts` + `ClimateSection.tsx`. Fixes a live kit bug.
2. **Irrigation — port as a CORE view** (the kit's `IrrigationView` is a 19-line stub today; this is a full feature port, not a refresh).
3. **Recipes — ship as an OPTIONAL template** under `docs/templates/recipes/` with **full setup instructions** (forces a Mealie add-on + LLM-key dependency, so not core).
4. Run the `release` skill → cut **`v0.2.0`** (covers the Phase-1 machinery + R1 + irrigation + recipes + the TRV fix).

## Genericization rules (the burn-risk part — review these)

**Irrigation:**
- **Zones**: replace the 7 real lawns (`street_lawn`, `house_front_lawn`, `front_west_lawn`, `back_lawn`, `house_back_lawn`, `house_west_lawn`, `shed_lawn`) with 2 generic examples — `front_zone_1` ("Front Zone 1", front) and `back_zone_1` ("Back Zone 1", back) — plus a comment block explaining the `valve.{slug}` / `binary_sensor.{slug}_watering` / `input_*.irrigation_zone_{slug}_*` derivation and how to add zones. Keep the `irrigationZone()` factory + front/back group model as the example.
- **Hardware**: abstract "Hydrawise" → "your valve controller (Hydrawise / OpenSprinkler / Rachio / …)"; fix the `binary_sensor.irigation_connectivity` typo → `binary_sensor.irrigation_connectivity` and make it a documented optional sensor.
- **Prereq sensors**: `sensor.outdoor_temperature_3_day_average` (Netatmo-derived) → document as a generic prerequisite template sensor, not assumed hardware.
- **Notify**: `notify.mobile_app_dcb_iphone` / `notify.mobile_app_alina_s_iphone` → `notify.YOUR_PHONE` in YAML templates.
- entities.ts irrigation block uses concrete strings → convert to the kit's documented-default convention with the example zones.

**Recipes:**
- `dashboard/src/lib/notifyForUser.ts` (real user UUIDs → notify services) → `notifyForUser.example.ts` with an empty map + comment.
- LLM prompts in `configuration.yaml` rest_commands: strip the 2 Romanian cheese rows (`telemea`, `cașcaval`) or relabel generically; parameterize/flag the pinned model IDs (`claude-sonnet-4-6`, `gpt-5.4-mini`) as user-updatable; keep the ~95% generic extraction/nutrition logic intact (the kit's value-add).
- Mealie add-on slug `db21ed7f-mealie` → placeholder `your-mealie-addon-slug`.
- `calendar.mealie_dinner` (in `sensor.mealie_todays_dinner` template) → `calendar.your_mealie_calendar`.
- Document `secrets.yaml` keys: `anthropic_api_key`, `openai_api_key_bearer`.
- Fix the stale model names in `system-recipes.md` (it says Haiku 4.5 / gpt-4o-mini; actual is sonnet-4-6 / gpt-5.4-mini).

## File map

### Irrigation (core) — from private repo
- `dashboard/src/lib/entities.ts` irrigation block (`IrrigationZoneConfig`, `irrigationZone()`, `IRRIGATION_ZONES`, `IrrigationGroup`/`isIrrigationGroup`, `effectiveCycleMinutes`, `IrrigationZoneNumericParam`, `irrigationZoneNumericParams`) → kit `entities.ts`, genericized to example zones.
- `dashboard/src/hooks/useIrrigationRuns.ts` → kit (depends only on `useMultiStateHistory`, present). Copy.
- `dashboard/src/views/IrrigationView.tsx` (~630 lines) → replace the kit stub. Genericize comments/hardware refs.
- `dashboard/src/components/popups/IrrigationZonePopup.tsx` → kit. Copy.
- `config/automations/irrigation.yaml` + the ~56 zone-helper lines in `configuration.yaml` → `docs/templates/config/automations/irrigation.yaml` + `docs/templates/config/helpers.yaml` (genericized YAML templates).
- `docs/system-irrigation.md` → genericized doc (system doc or under templates).

### Recipes (optional template) — new `docs/templates/recipes/` subtree
- `dashboard/` → all 14 components, the Mealie hooks (`useMealie*`, `useRecipeImport`, `useCookTimers`, `useScreenWakeLock`), `mealie.ts`/`mealie-types.ts`/`recipeTimers.ts`/`scaleIngredients.ts`, `RecipesView.tsx`, `recipes-constants.ts`, `RecipePickerPopup.tsx`, `TonightsDinnerCard.tsx`, `notifyForUser.example.ts`, plus the RECIPES entity constants + `MEALIE_SETTINGS` snippet to merge into `entities.ts`/`settings-constants.ts`.
- `config/recipes.yaml` (scripts), `config/custom_scripts/mealie_upload_image.py`, `configuration-recipes.yaml` fragment (helpers + rest_commands + template sensor + shell_command).
- `README.md` — full setup instructions (Mealie add-on + official integration, the helper set, the two LLM secrets, the dependency chain dashboard→WS→script→rest_command→LLM→Mealie→image-python, install steps).

## Build sequence
1. [x] TRV fix (done, `27fd79b`).
2. Irrigation: entities block (genericized) → `useIrrigationRuns` → `IrrigationView` (replace stub) → `IrrigationZonePopup`; `npx tsc -b --noEmit`; then YAML templates + doc.
3. Recipes: create `docs/templates/recipes/` tree (copy + genericize); write the README. (Templates aren't compiled by the kit build, but verify the copied TS is internally consistent.)
4. Run `release` skill → `v0.2.0` (validate_changelog, render CHANGELOG, tag, push, GitHub release).

## Acceptance criteria
- [ ] Irrigation: kit `IrrigationView` is the real view (stub gone); popup + hook + entities present; **fresh-clone `tsc -b --noEmit` passes**; example zones generic (no real lawn names); hardware abstracted.
- [ ] Recipes: `docs/templates/recipes/` complete with genericized files + a full README; no real user UUIDs, no Mealie slug, no Romanian cheeses, no pinned-undocumented models; secrets documented.
- [ ] `release` cuts `v0.2.0`: `kit-changelog.yaml` entries generated (irrigation=feature, recipes=feature, TRV=fix), `CHANGELOG.md` rendered, `.kit-version`+`package.json` bumped, signed/annotated tag, GitHub release.

## Notes
- Genericization is agent-proposes / maintainer-reviews (the cross-repo burn rule). Show genericized YAML/prompts before finalizing.
- Read source from the private repo (`/Users/dcb/Projects/claude-homeassistant`); write only to the kit.
