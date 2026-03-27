---
title: "useEffect with unstable callback props causes perpetual timer cancellation"
category: ui-bugs
date: 2026-03-26
tags: [react, useEffect, useRef, websocket, timers]
---

# useEffect with unstable callback props causes perpetual timer cancellation

## Problem

A timer inside a `useEffect` (e.g., a 3-second debounce or delay) never fires.
The component appears stuck -- the delayed action never executes despite the
trigger condition being met repeatedly.

## Root Cause

The parent component re-renders on every Home Assistant WebSocket state update
(potentially multiple times per second). Each render creates a new callback
function reference. When that callback is listed in the effect's dependency
array, React runs the cleanup function (clearing the timer) and re-runs the
effect on every render.

A typical pattern that fails:

```tsx
// Parent re-renders frequently, creating new onComplete each time
useEffect(() => {
  if (!shouldStart) return;
  started.current = true;
  const id = setTimeout(onComplete, 3000);
  return () => clearTimeout(id);         // fires on every re-render
}, [shouldStart, onComplete]);            // onComplete changes every render
```

The ref guard (`started.current`) prevents the timer from restarting after
cleanup, so the effect becomes permanently stuck: timer cleared, never restarted.

## Solution

Store the callback in a ref so it can be called with the latest value without
being a dependency:

```tsx
const onCompleteRef = useRef(onComplete);
onCompleteRef.current = onComplete;       // always up-to-date

useEffect(() => {
  if (!shouldStart) return;
  const id = setTimeout(() => onCompleteRef.current(), 3000);
  return () => clearTimeout(id);
}, [shouldStart]);                        // stable dependency only
```

The ref is not a reactive dependency, so the effect only re-runs when
`shouldStart` changes. The timeout survives parent re-renders and always
calls the latest callback.

## Prevention

- Never put inline callbacks or object props in useEffect dependency arrays
  when the parent re-renders frequently (WebSocket-connected components).
- Use the ref pattern for any callback prop consumed inside an effect.
- Lint rules (`react-hooks/exhaustive-deps`) will warn about missing deps --
  suppress with a comment explaining the ref pattern, or use `useEffectEvent`
  (React 19+) when available.
