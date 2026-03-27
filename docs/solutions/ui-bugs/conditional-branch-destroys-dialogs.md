---
title: "Conditional branch rendering destroys dialogs on transient HA state changes"
category: ui-bugs
date: 2026-03-26
tags: [react, conditional-rendering, popups, home-assistant, transient-states]
---

# Conditional branch rendering destroys dialogs on transient HA state changes

## Problem

A popup (bottom sheet, dialog, modal) closes and immediately reopens -- or
flickers -- when interacting with a media player or other entity. Seeking a
track, for example, causes the popup to visibly remount twice in quick
succession.

## Root Cause

The popup component is rendered inside a conditional branch that depends on
entity state:

```tsx
// Broken: popup lives inside conditional branches
{state === "playing" ? (
  <PlayingView>
    <MediaPopup open={popupOpen} />   {/* mounted here */}
  </PlayingView>
) : state === "paused" ? (
  <PausedView>
    <MediaPopup open={popupOpen} />   {/* different mount point */}
  </PausedView>
) : null}
```

When a media player seeks, it briefly transitions through intermediate states
(e.g., `playing` -> `buffering` -> `playing`). Each branch change causes React
to unmount the entire subtree (including the popup) and mount a different one.
The popup loses all internal state: scroll position, animation state, open/close
status.

Home Assistant entities frequently pass through brief intermediate states
during operations. This is normal HA behavior, not a bug.

## Solution

Hoist popups out of conditional branches so they have a stable mount point:

```tsx
// Fixed: popup is always mounted at the same tree position
<div>
  {state === "playing" ? <PlayingView /> : <PausedView />}
  <MediaPopup open={popupOpen} />   {/* stable mount point */}
</div>
```

For the conditional content itself, include all transient states in the "active"
check rather than switching branches:

```tsx
const isActive = ["playing", "paused", "buffering", "idle"].includes(state);
```

## Prevention

- Never render popups, modals, or bottom sheets inside conditional branches.
- Keep popups at the highest stable level in the component tree.
- When branching on HA entity state, always account for transient intermediate
  states -- list them explicitly rather than using a default/else branch.
- Test state-dependent UI by rapidly toggling entity states in HA developer
  tools.
