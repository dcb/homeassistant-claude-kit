---
title: "Unified control commit lifecycle for debounce, inflight, and hold phases"
category: "ui-bugs"
date: "2026-03-16"
tags:
  - controls
  - debounce
  - state-machine
  - slider
  - flicker
  - optimistic-update
  - ux
  - react-hooks
  - home-assistant
severity: "high"
symptoms:
  - "Slider knobs stuck in inflight mode (100% repro on color temp slider due to kelvin-mired-kelvin round-trip precision loss)"
  - "Temperature controls flashing/flickering with slow-responding ACs (optimistic update then device revert)"
  - "Dropdown trigger sizing breaking during inflight phase (DOM wrapping broke Radix layout)"
  - "Sibling controls on multi-control entities (AC mode/temp/fan/swing) flickering from intermediate entity updates"
  - "Inconsistent debounce and pending-state UX behavior across different control types"
  - "Slider gradient compressed instead of clipped at thumb position"
root_causes:
  - "4+ ad-hoc debounce/pending patterns with no shared lifecycle or state machine"
  - "Kelvin to mired to kelvin round-trip precision loss causing equality checks to fail"
  - "No post-confirmation hold period to absorb device-revert flicker on slow devices"
  - "No control group coordination causing intermediate entity states to ripple into sibling controls"
  - "Inflight styling applied via wrapper elements that broke Radix trigger layout"
---

# Unified Control State Machine for Dashboard Controls

## Problem

The Home Assistant React dashboard had 4+ separate debounce/pending/optimistic-update patterns scattered across control components (sliders, toggles, dropdowns, temperature steppers). Each implementation handled the lifecycle of "user changes value -> send to HA -> wait for confirmation" differently, leading to six distinct bugs:

1. **Slider knob stuck in inflight (color temp, 100% repro)**: HA stores color temperature as integer mireds. A Kelvin value sent to HA undergoes a Kelvin->mired->Kelvin round-trip that introduces precision loss (e.g., 3500K -> 286 mireds -> 3497K). The default equality check (`numericEqual` with step=1, tolerance 0.5K) could not match the 3K difference, so the inflight phase never confirmed.

2. **Temperature control flash with slow AC**: HA performs an optimistic update (serverValue jumps to 21.0), the hook confirms and clears `localValue`. But the physical AC then reports its actual (old) temperature (19.0) before settling. With `localValue` cleared, the display briefly shows 19.0 before bouncing back to 21.0.

3. **Dropdown sizing collapse during inflight**: Wrapping the Radix Select trigger in `<div>` + `<span>` for phase styling broke the trigger's `w-full` / `flex-1` layout contract, causing it to collapse to text width.

4. **Sibling control flicker on multi-control entities**: AC entities expose mode, temperature, fan speed, and swing as separate controls bound to the same entity. Changing one triggers a WebSocket update with stale values for the others, causing idle siblings to flash.

5. **Slider gradient compression**: Fill portion used `background: linear-gradient(...)` with `width: 50%`, which compressed the full gradient into the fill area instead of clipping it.

6. **SegmentedControl unresponsive during debounce**: All non-idle phases blocked pointer events, so rapid taps during the debounce window were ignored.

## Root Cause Analysis

The fundamental issue was architectural: no shared abstraction for the lifecycle of an optimistic UI update to a Home Assistant entity. Each component independently solved debouncing, pending display, confirmation detection, and error recovery -- each with slightly different bugs.

The specific bugs each had additional root causes:
- **Kelvin stuck**: Unit conversion precision loss + overly strict equality check
- **Temperature flash**: No hold mechanism after server confirmation to absorb device revert
- **Dropdown sizing**: DOM wrapping breaks headless UI library (Radix) layout measurement
- **Sibling flicker**: No coordination between controls sharing the same entity
- **Gradient compression**: CSS `background` shorthand with `width%` compresses, doesn't clip
- **SegmentedControl**: Overly broad interaction blocking (any non-idle phase)

## Solution

### Core: `useControlCommit<T>` -- 4-Phase State Machine Hook

All controls share a single hook managing the full optimistic-update lifecycle:

| Phase | Meaning | Duration | Display value |
|-------|---------|----------|---------------|
| **idle** | No local edit | -- | `serverValue` (or frozen ref if group sibling busy) |
| **debouncing** | User editing, not yet sent | Resets on each `set()`, default 300ms | `localValue` |
| **inflight** | Service call fired, waiting for HA | Until `isEqual(server, target)` or 15s timeout | `localValue` (frozen) |
| **hold** | Server confirmed, absorbing transients | 3 seconds | `localValue` (frozen), then -> idle |

```typescript
interface ControlCommitOptions<T> {
  debounceMs?: number;   // default 300
  timeoutMs?: number;    // default 15000 (safety net)
  holdMs?: number;       // default 3000 (post-confirm absorption)
  isEqual?: (a: T, b: T) => boolean;
  group?: ControlGroup;  // multi-control coordination
}
```

Key behaviors:
- **`set(v)`**: Stores localValue, starts/restarts debounce timer
- **`commit()`**: Fires immediately bypassing debounce (pointer-up on sliders)
- **`reset()`**: Clears localValue without firing (pointer-cancel)
- **`fire()`** (internal): No-op skip if server already has target value
- **Inflight confirmation**: Transitions to **hold** (not idle) for 3s absorption
- **Safety timeout (15s)**: Transitions to hold (not hard-clear)
- **Intermediate rejection**: During inflight, non-matching server values are ignored
- **Display**: `localValue ?? (frozenServerRef.current ?? serverValue)`

### Layer 2: `useNumericControl`

Thin wrapper around `useControlCommit<number>` with numeric defaults and increment/decrement helpers. Passes `group` through via spread.

### Layer 3: `useSliderControl`

Wraps `useNumericControl` with 60s debounce (overridden by `commit()` on pointer-up), custom `isEqual` support, `reset()` on pointer-cancel.

### `useControlGroup` -- Multi-Control Coordination

```typescript
interface ControlGroup {
  busyRef: React.RefObject<boolean>;
  enter: () => void;   // called when member enters inflight
  leave: () => void;   // called when member exits hold -> idle
}
```

Shared busy counter across all controls on the same entity. When any member is inflight, idle siblings freeze their display at a snapshot value, ignoring intermediate entity updates.

## Key Code Patterns

### Kelvin equality via mired-space comparison

```typescript
function kelvinEqual(a: number, b: number): boolean {
  if (a <= 0 || b <= 0) return a === b;
  return Math.abs(Math.round(1_000_000 / a) - Math.round(1_000_000 / b)) <= 2;
}
```

Tolerates the inherent precision loss of Kelvin->mired->Kelvin round-trip. +/-2 mireds covers worst-case rounding at typical color temperature ranges (2000K-6500K).

### Slider gradient clipping (not compression)

```typescript
style={{
  width: `${ratio * 100}%`,
  backgroundImage: trackGradient,
  backgroundSize: `${(1 / ratio) * 100}% 100%`,
  backgroundRepeat: "no-repeat",
}}
```

By setting `backgroundSize` to the inverse of the fill ratio, the gradient renders at full-track scale and clips at the element's width.

### Phase styling without layout-breaking wrappers

```typescript
// cloneElement injects phase CSS classes directly onto trigger element
const styledTrigger = cloneElement(trigger, {
  className: `${trigger.props.className ?? ""} ${phaseClasses}`.trim(),
});
```

Preserves Radix trigger's flex layout contract. No wrapper divs.

### SegmentedControl interaction during debounce

```typescript
const isBlocked = phase === "inflight" || phase === "hold";
// Allows clicks during debounce -- user can change their mind
```

## Files Modified

| File | Change |
|------|--------|
| `src/lib/useControlCommit.ts` | Core state machine (rewritten twice) |
| `src/lib/useControlGroup.ts` | New: multi-control coordination |
| `src/lib/useSliderControl.ts` | Custom isEqual, reset support |
| `src/lib/useNumericControl.ts` | Group passthrough |
| `src/components/controls/SliderTrack.tsx` | Gradient scaling fix |
| `src/components/controls/SliderRow.tsx` | isEqual + group props |
| `src/components/controls/SegmentedControl.tsx` | Debounce interaction |
| `src/components/controls/PopoverSelect.tsx` | cloneElement approach |
| `src/components/controls/TemperatureControl.tsx` | Group prop |
| `src/components/controls/LightControl.tsx` | Group + kelvinEqual |
| `src/components/popups/AcControlPopup.tsx` | Group for all 4 controls |

## Prevention Strategies

### Always use the unified hook hierarchy

All device-controlling components MUST use `useControlCommit` / `useNumericControl` / `useSliderControl`. Direct `callService` + local `useState` for pending values is prohibited. Any component importing `callService` and pairing it with `useState` for optimistic values is a red flag.

### Never compare converted values with strict equality

Values that pass through unit conversion (Kelvin/mired, Fahrenheit/Celsius) lose precision. Use domain-specific equality functions with appropriate tolerance. Pass custom `isEqual` to `useControlCommit` or `useSliderControl`.

### Never wrap Radix trigger children in divs

Use `cloneElement` or Radix's `asChild` pattern. Wrapper divs break `getBoundingClientRect`, flex participation, and `w-full` layout.

### Coordinate all controls on the same entity

If multiple controls target the same HA entity, create a shared `useControlGroup()` and pass it to all controls. This freezes idle siblings' displays during any member's inflight phase.

### Hold window duration by device class

| Device | Hold | Rationale |
|--------|------|-----------|
| Lights | 1s | Fast response |
| Climate/AC | 3s | Slow physical devices |
| Covers/blinds | 2-3s | Motor feedback delay |
| Media players | 1s | Fast response |

### Test the three-state flicker scenario

After any control implementation: send command -> receive stale echo -> receive correct confirmation. UI should show exactly two visual states (old -> new), never three.
