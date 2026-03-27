# Home Assistant Custom Dashboard

React 19 + TypeScript + Tailwind CSS 4 + Vite 7 custom panel for Home Assistant.

## Commands

```bash
npm run dev           # Start dev server with HA proxy
npm run build         # TypeScript check + Vite build
npm run lint          # ESLint
npm run preview       # Preview production build
npx tsc -b --noEmit   # TypeScript check only (no build)
```

Deploy from project root: `make deploy-dashboard` (NOT raw rsync).

## Architecture

```
src/
  providers/HAProvider.tsx   # @hakit/core HassConnect wrapper (auth + WS)
  App.tsx                    # View registry → Shell
  views/                    # Top-level pages (Home, Climate, Energy, Security, Settings, SystemHealth)
  components/
    layout/                 # Shell, Header, BottomNav, Sidebar
    cards/                  # Data display cards (RoomCard, CameraCard, VacuumCard, etc.)
    controls/               # Interactive controls (LightControl, ClimateModePicker, ScheduleEditor, etc.)
    popups/                 # Modal dialogs (CameraPopup, RoomPopup, AcControlPopup, ZoneHistoryPopup)
    Go2RtcPlayer.tsx        # MSE player for desktop camera streams
    WebRtcPlayer.tsx        # WebRTC player for mobile camera streams
  hooks/                    # Custom hooks (useHistory, useSolarForecast, useWeatherForecast, etc.)
  lib/                      # Utilities (entities, areas, format, icons, camera-utils, snapshot-api)
                            # Control hooks: useControlCommit, useNumericControl, useSliderControl, useControlGroup
```

## Key Patterns

### Component Conventions
- **Naming**: `*View` (route pages), `*Card` (data display), `*Control` (interactive widgets), `*Popup` (modal dialogs)
- **Props**: `interface FooProps { ... }` (always `interface`, not `type`, for component props). Export prop interfaces when the component is reusable.
- **Exports**: Named exports for components (`export function FooCard`). Only `App.tsx` uses default export.
- **Import order**: React → `@hakit/core` → `home-assistant-js-websocket` → Radix → `framer-motion` → `@iconify/react` → local `lib/` → local components
- **File size limit**: Keep components under ~300 lines. When a file grows beyond that, extract sub-components, helpers, or hooks into their own files. No "god" components — split by responsibility (e.g., `LightControl` has its own `SliderRow`, `TogglePill`, `ColorPickerPopup` internally, but if those grow they should become separate files). Move reusable logic to `hooks/` or `lib/`.

### HA Connection
- `@hakit/core` provides `HassConnect` — auto-inherits auth when embedded as `panel_iframe`
- For local dev, set `VITE_HA_URL` and `VITE_HA_TOKEN` in `.env`
- State management: Zustand for app state, `@hakit/core` hooks for HA entity state

### State & Data
- Use `@hakit/core` hooks (`useEntity`, `useHass`) for entity state — don't call WS directly for state
- Custom hooks in `hooks/` for derived data (history, forecasts, timers)
- `lib/entities.ts` and `lib/areas.ts` define entity/area constants — always use these, don't hardcode entity IDs in components

### Camera Streaming
- **Desktop**: MSE via `Go2RtcPlayer` (direct go2rtc port 1984)
- **Mobile/iOS**: WebRTC via `WebRtcPlayer` (signed `/api/webrtc/ws`, message types: `webrtc/offer` + `webrtc/answer`)
- iOS WKWebView has NO `MediaSource` API — MSE will not work in HA companion app
- Snapshots: latest at `/config/www/snapshots/{camera_id}.jpg`, history via `media_source/browse_media` WS API

### Styling
- Tailwind CSS 4 (via `@tailwindcss/vite` plugin)
- All colors reference `@theme` tokens from `index.css` — never use raw hex values in components
- Class concatenation uses template literals — this project does NOT use a `cn()` utility
- Animations: `framer-motion` (`AnimatePresence` + `motion` components) for enter/exit transitions, Tailwind `transition-*` for simple hover/state changes
- Icons: `@iconify/react` `Icon` component with MDI icon names (e.g., `mdi:close`, `mdi:lightbulb`)
- No `!important` or z-index hacks

### Radix UI
- Used for accessible overlays: `@radix-ui/react-dialog` (popups), `@radix-ui/react-popover` (dropdowns), `@radix-ui/react-toggle`
- Compose all required parts: Dialog needs `Root` → `Portal` → `Overlay` + `Content` → `Title` + `Description` (Title and Description are **required** for accessibility)
- Wrap Radix parts with `framer-motion` via `asChild` for animated enter/exit
- Style state changes via `data-[state=open]:` and `data-[state=closed]:` Tailwind variants
- See `PopoverSelect.tsx` for the reusable dropdown pattern used across the dashboard

## React 19 Rules

- **No `forwardRef`** — pass `ref` directly as a prop: `function MyInput({ ref, ...props })`
- **No `<Context.Provider>`** — use `<Context value={...}>` directly
- **`use()` hook** can be called inside conditionals (unlike other hooks)
- **Ref cleanup**: ref callbacks can return a cleanup function; use explicit block bodies `ref={(el) => { ... }}` (not arrow returns)
- **No preemptive memoization** — don't add `React.memo`/`useMemo`/`useCallback` unless profiling shows a measurable perf issue

## Tailwind v4 Rules

- Config lives in CSS (`@theme` in `index.css`), NOT in `tailwind.config.js`
- Add new design tokens in the `@theme { }` block as CSS variables
- Custom utilities: use `@utility name { ... }` (NOT `@layer utilities`)
- CSS variable references use parens: `bg-(--color-accent)` (NOT brackets `bg-[--color-accent]`)
- Important modifier is a suffix: `flex!` (NOT prefix `!flex`)
- Renamed from v3: `shadow-xs`/`shadow-sm` (shifted down), `rounded-xs`/`rounded-sm` (shifted down), `outline-hidden` (not `outline-none`)
- Do NOT use `@apply` — compose classes in JSX

## Gotchas

- **TypeScript**: avoid `any` — use `unknown`, generics, or specific HA types from `home-assistant-js-websocket`
- **Entity IDs**: always import from `lib/entities.ts` — never hardcode entity ID strings in components
- **Service calls**: use `callService` from `home-assistant-js-websocket` (WS) by default; REST API fallback (`fetch /api/services/...`) only when WS isn't available (e.g., fire-and-forget from cleanup functions)
- **Control state**: all interactive controls use the unified control system (see Control System section below) — never implement ad-hoc debounce/pending/timeout patterns
- `panel_custom` `module_url` does NOT support query params (`?v=2` breaks panel loading)
- `panel.js` is deployed separately by `make deploy-dashboard` (after `--delete` cleans dist)
- `Date.now()` on iframe `src` in `panel.js` handles `index.html` cache busting; React bundles use content hashes
- Vite `base` is `/local/custom-dashboard/` — all assets are served from this path
- Dev server proxies `/api`, `/local/snapshots`, `/media` to HA instance

## Unified Control System

All interactive controls (sliders, toggles, steppers, dropdowns, segmented controls) use a shared state machine hook hierarchy. **Never** implement ad-hoc debounce, pending state, or timeout logic — always use these hooks.

Design spec: documented in the sections below.

### Hook Hierarchy

```
useControlCommit<T>          — generic state machine (any value type)
├── useNumericControl        — adds increment/decrement, clamping, step snapping
│   └── useSliderControl     — adds pointer events, ratio, dragging state
```

All hooks live in `lib/`:
- `lib/useControlCommit.ts` — core state machine, 4-phase lifecycle
- `lib/useNumericControl.ts` — numeric convenience (extends `ControlCommitOptions<number>` with min/max/step)
- `lib/useSliderControl.ts` — slider pointer events + ratio (commits on pointer-up, 60s idle debounce as safety)
- `lib/useControlGroup.ts` — coordinates multiple controls on the same entity

### 4-Phase Lifecycle

`idle` → `debouncing` → `inflight` → `idle` (or `correction` if server disagrees)

- **Debounce resets** on every interaction — rapid taps produce one service call
- **Inflight interaction is queued**, not sent — at most 2 sequential calls, never a flood
- **Post-confirmation hold** (3s) absorbs device-revert flicker (HA optimistic update → slow device briefly reverts → device confirms)
- **Safety timeout** (15s) transitions to hold state (maintains optimistic display) if server never responds
- **No-op skip**: `fire()` checks if server already has the target value and skips unnecessary inflight
- **Intermediate values ignored**: during inflight, non-matching server values are not treated as corrections (handles slow devices reporting intermediate states like 19.5 → 20.0 → 20.5)

### Control Groups (`useControlGroup`)

Multi-control entities (e.g., AC with mode/temp/fan/swing, lights with brightness/color temp/effect) must share a `ControlGroup`. When any member is inflight, idle siblings **freeze** their display at a snapshot value to prevent flicker from intermediate entity updates.

```tsx
const group = useControlGroup();
const mode = useControlCommit(hvacMode, onModeChange, { debounceMs: 300, group });
const fan = useControlCommit(fanMode, onFanChange, { debounceMs: 300, group });
// All controls on the same entity share the same group
```

Always create a group with `useControlGroup()` in the parent component and pass it to all control hooks for that entity.

### Custom Equality (`isEqual`)

Some controls need domain-specific equality checks. Pass `isEqual` in options:

- **Kelvin color temp**: HA stores color temp as integer mireds, causing kelvin round-trip precision loss (e.g., 3500K → mired 286 → 3497K). Use mired-space comparison:
  ```tsx
  const kelvinEqual = useCallback((a: number, b: number) => {
    if (a <= 0 || b <= 0) return a === b;
    return Math.abs(Math.round(1_000_000 / a) - Math.round(1_000_000 / b)) <= 2;
  }, []);
  <SliderRow isEqual={kelvinEqual} ... />
  ```

### Phase-Driven Visuals

Controls receive `phase` from their hook and apply visual treatment:
- **idle**: neutral colors
- **debouncing**: warm accent colors (user intent acknowledged)
- **inflight**: warm colors + animation (knight rider underline, pulsing glow, spinning ring, etc.)
- **correction**: shake animation (0.4s) then snap to corrected value

Presentational controls (e.g., `SegmentedControl`) receive `phase` as a prop — the parent owns the `useControlCommit` hook. Use `cloneElement` (not wrapper divs) to add phase CSS classes to Radix triggers to avoid breaking layout measurement.

### Adding a New Control

1. Pick the right hook level: `useControlCommit<T>` for non-numeric, `useNumericControl` for steppers, `useSliderControl` for sliders
2. Create a `useControlGroup()` if the entity has multiple controls, pass it via `group` option
3. Use `phase` to drive visual feedback (follow existing patterns in the control type tables in the design spec)
4. For `onCommit`, guard with `if (!connection) return` — connection can be null
5. Never return the `callService()` result directly (it's `Promise<unknown>` which conflicts with `void | Promise<void>`)
