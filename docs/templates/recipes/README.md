# Recipes (Mealie) — optional template

A full recipe manager for the dashboard, backed by a self-hosted
[Mealie](https://mealie.io) instance. This is an **optional template**: it is
not part of the core kit. Copy these files into your project only if you run
Mealie and want recipes in the dashboard.

Everything for this feature lives under `docs/templates/recipes/`. Nothing here
is wired into the kit by default — you copy the dashboard files into
`dashboard/src/...`, merge the config fragment into `configuration.yaml`, and
add the script + python helper.

## What it is

A `Recipes` view plus a home-screen "tonight's dinner" card:

- **Library** — browse/search your Mealie recipes with images, paginated.
- **Detail** — ingredients (scaled to chosen servings), steps, nutrition,
  times; edit in place.
- **Cook mode** — full-screen, step-by-step cooking with per-step **timers**
  and a **screen wake lock** (phone won't sleep while cooking). Timers also
  fire a **mobile notification** via an HA script, so they alarm even with the
  dashboard closed.
- **Meal plan** — view/remove Mealie meal-plan entries.
- **Shopping list** — check items, add ad-hoc items, add a whole recipe's
  ingredients; polls Mealie so changes from other devices show up.
- **Paste-to-import** — paste arbitrary recipe text (or a URL's text) and an
  **LLM** (Claude or OpenAI) extracts a structured recipe — ingredients with
  quantities/units, steps with timers, per-serving nutrition, unit conversion —
  then creates it in Mealie. Best-effort image fetch attaches a hero photo.
- **Tonight's dinner card** — a home-screen card reading a Mealie meal-plan
  calendar.

Source of truth in the private repo this was ported from:
`docs/system-recipes.md`. Mealie types are hand-written and **pinned to Mealie
v3.17.0** (`dashboard/src/lib/mealie-types.ts`) — newer Mealie releases may
change response shapes; re-check the types if you run a different version.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| **Mealie add-on** | Self-hosted Mealie (the HA add-on, or any reachable Mealie server). You need its internal add-on hostname (for `rest_command`) and an external/Ingress URL (for the browser). |
| **Mealie API token** | Mealie → Profile → **API Tokens**. Goes in `input_text.mealie_api_token`. |
| **Official Mealie HA integration** | Provides the meal-plan **calendar** entity used by the "tonight's dinner" sensor. Settings → Devices & Services → add **Mealie**. |
| **Anthropic and/or OpenAI API key** | At least one is required for paste-to-import. Claude is the default provider; OpenAI is the fallback. Other features (library, cook mode, shopping) work without any LLM key. |

---

## The dependency chain (read this — a missing link fails silently)

Recipe **import** is the part with the most moving parts. The call path is:

```
Dashboard (ImportSection)
  └─ WS call → script.recipe_import_from_text          (config/scripts/recipes.yaml)
       └─ rest_command.llm_parse_recipe_claude|openai  (configuration-recipes.yaml)
            └─ Anthropic / OpenAI API                  (!secret anthropic_api_key / openai_api_key_bearer)
       └─ rest_command.mealie_create_recipe / _update  → Mealie REST API
       └─ shell_command.mealie_upload_image_from_url
            └─ python3 custom_scripts/mealie_upload_image.py → Mealie PUT .../image
```

If **any** of these is missing or misconfigured, import breaks — often without
an obvious error:

- Missing `input_text.mealie_url_internal` / `mealie_api_token` → Mealie calls
  401/connection-refused.
- Missing `!secret anthropic_api_key` (or `openai_api_key_bearer`) → the LLM
  `rest_command` 401s; the script returns an `llm_<status>` error.
- Missing `custom_scripts/mealie_upload_image.py` or the `shell_command` →
  the recipe imports but the image silently goes missing (logged as a warning
  under logger `recipe_import`).
- `shell_command` changed but HA only reloaded, not restarted → HA caches
  `shell_command` templates at **startup**; you must **restart** HA after
  editing that line.

The non-import features have a shorter chain: dashboard → `rest_command.mealie_*`
→ Mealie REST API (plus the small `recipe_*` scripts for shopping/meal-plan
mutations and cook timers).

---

## Install

All paths below are relative to your dashboard (`dashboard/`) and config
(`config/`) roots.

### 1. Copy the dashboard files

Copy, preserving structure (these import each other with relative paths):

```
docs/templates/recipes/dashboard/src/components/recipes/*    → dashboard/src/components/recipes/
docs/templates/recipes/dashboard/src/components/cards/TonightsDinnerCard.tsx   → dashboard/src/components/cards/
docs/templates/recipes/dashboard/src/components/popups/RecipePickerPopup.tsx   → dashboard/src/components/popups/
docs/templates/recipes/dashboard/src/hooks/*                 → dashboard/src/hooks/
docs/templates/recipes/dashboard/src/lib/mealie.ts           → dashboard/src/lib/
docs/templates/recipes/dashboard/src/lib/mealie-types.ts     → dashboard/src/lib/
docs/templates/recipes/dashboard/src/lib/recipeTimers.ts     → dashboard/src/lib/
docs/templates/recipes/dashboard/src/lib/scaleIngredients.ts → dashboard/src/lib/
docs/templates/recipes/dashboard/src/views/RecipesView.tsx       → dashboard/src/views/
docs/templates/recipes/dashboard/src/views/recipes-constants.ts  → dashboard/src/views/
```

**Peer helpers** — the template bundles `lib/uuid.ts` and `lib/formatDuration.ts`.
Copy them into `dashboard/src/lib/` **only if you don't already have them**
(the kit core may not ship these). Skip any that already exist; do not overwrite.

```
docs/templates/recipes/dashboard/src/lib/uuid.ts           → dashboard/src/lib/   (if missing)
docs/templates/recipes/dashboard/src/lib/formatDuration.ts → dashboard/src/lib/   (if missing)
```

These import from the kit core (already present): `lib/entities.ts`,
`lib/useEntityState.ts`, `hooks/useUser` (from `@hakit/core`). No other core
changes are required.

### 2. Set up the cook-timer notify map

The cook timers notify the phone of whoever is logged into the dashboard.

1. Rename `notifyForUser.example.ts` → `notifyForUser.ts` and put it in
   `dashboard/src/lib/`.
2. Fill the `USER_TO_NOTIFY` map: each key is an HA `user_id`, each value is a
   `notify.mobile_app_*` service. The file has comments on where to find both.

`useCookTimers.ts` imports `../lib/notifyForUser` (no `.example`), so the rename
is required for the build to find it. An empty map is fine — timers then fall
back to the local in-page beep.

### 3. Paste the entity constants

Open `entities-snippet.ts` and paste the `MEALIE_*` / `RECIPE_*` /
`MEALIE_TODAYS_DINNER` consts into your real `dashboard/src/lib/entities.ts`.
Every recipe component imports these from `../../lib/entities`, so they must
live there (not in the template directory). `entities-snippet.ts` itself is a
reference only — do not import from it.

### 4. Wire the Settings section

Open `settings-snippet.ts` and:

1. Add the four imported entity constants to the existing
   `import { ... } from "../lib/entities";` block in
   `dashboard/src/views/settings-constants.ts`.
2. Paste the `MEALIE_SETTINGS` array into `settings-constants.ts`.
3. Render the section in your Settings view (follow how the other
   `*_SETTINGS` arrays are rendered there).

### 5. Wire the view + navigation + home card

In `dashboard/src/App.tsx`:

```tsx
const RecipesView = lazy(() => import("./views/RecipesView").then((m) => ({ default: m.RecipesView })));
// …and in the `views` map:
recipes: <LazyView><RecipesView /></LazyView>,
```

In `dashboard/src/lib/navigation.ts`:

```ts
// add to the ViewId union:
| "recipes"
// add to NAV_ITEMS (placement is up to you):
{ id: "recipes", label: "Recipes", icon: "mdi:silverware-fork-knife" },
```

For the home-screen card, in `dashboard/src/views/HomeView.tsx`:

```tsx
import { TonightsDinnerCard } from "../components/cards/TonightsDinnerCard";
// …then render <TonightsDinnerCard /> wherever you want it on the home grid.
```

### 6. Merge the HA config

1. **`configuration-recipes.yaml`** — merge each top-level block
   (`input_number:`, `input_select:`, `input_text:`, `template:`,
   `rest_command:`, `shell_command:`) into the **same** key in your real
   `config/configuration.yaml`. These keys likely already exist — merge the
   children, don't duplicate the parents.
   - **Genericized placeholders to fix:**
     - `calendar.your_mealie_calendar` (in `sensor.mealie_todays_dinner`) →
       your actual Mealie dinner calendar entity (from the Mealie integration).
     - The pinned LLM model IDs (`claude-sonnet-4-6`, `gpt-5.4-mini`) — update
       to the current models (comments mark both lines).
2. **`config/scripts/recipes.yaml`** — add to your scripts (e.g. include it the
   way you include other split script files, or paste into `scripts.yaml`).
   The `recipe_timer` field description shows `notify.YOUR_PHONE` as an example —
   the dashboard supplies the real service at call time.
3. **`config/custom_scripts/mealie_upload_image.py`** — copy to
   `config/custom_scripts/` on the HA instance. It's generic (host/token come in
   as argv from the `shell_command`); only the docstring mentions
   `your-mealie-addon-slug` as an example.

### 7. Add the secrets

In `config/secrets.yaml`:

```yaml
anthropic_api_key:     sk-ant-...        # raw key — sent as the x-api-key header
openai_api_key_bearer: "Bearer sk-..."   # NOTE: includes "Bearer " — it is the
                                         # full Authorization header value
```

Add only the provider(s) you use. (`openai_api_key_bearer` deliberately includes
the word `Bearer ` because the `rest_command` passes it straight into the
`Authorization` header.)

### 8. Set the Mealie helpers and restart

After deploying, set these helpers (UI or API — they persist across restarts):

- `input_text.mealie_url_internal` → internal add-on hostname, e.g.
  `http://your-mealie-addon-slug:9000` (the slug is the prefix of the add-on's
  hostname, on Settings → Add-ons → Mealie → "Hostname").
- `input_text.mealie_url_external` → URL the browser reaches Mealie at.
- `input_text.mealie_api_token` → the Mealie API token.

Then **restart Home Assistant** (not just reload) — the `shell_command`
template is cached at startup. Reload automations/scripts as needed, and
rebuild + deploy the dashboard.

---

## Files in this template

```
docs/templates/recipes/
├── README.md
├── config/
│   ├── configuration-recipes.yaml          # merge into configuration.yaml
│   ├── scripts/recipes.yaml                # recipe scripts (import, shopping, timers)
│   └── custom_scripts/mealie_upload_image.py
└── dashboard/src/
    ├── components/
    │   ├── recipes/                        # 14 components (Library, Detail, CookMode…)
    │   ├── cards/TonightsDinnerCard.tsx
    │   └── popups/RecipePickerPopup.tsx
    ├── hooks/                              # useMealie*, useRecipeImport, useCookTimers, useScreenWakeLock
    ├── lib/
    │   ├── mealie.ts, mealie-types.ts, recipeTimers.ts, scaleIngredients.ts
    │   ├── uuid.ts, formatDuration.ts      # peer helpers — copy only if missing
    │   ├── notifyForUser.example.ts        # rename → notifyForUser.ts, fill the map
    │   ├── entities-snippet.ts             # paste into entities.ts (reference only)
    │   └── ...
    └── views/
        ├── RecipesView.tsx, recipes-constants.ts
        └── settings-snippet.ts             # paste MEALIE_SETTINGS into settings-constants.ts
```
