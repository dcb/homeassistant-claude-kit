---
title: "Flexbox min-width: auto causes mobile horizontal overflow"
category: ui-bugs
date: 2026-03-26
tags: [flexbox, mobile, overflow, tailwind, css]
---

# Flexbox min-width: auto causes mobile horizontal overflow

## Problem

The dashboard scrolls horizontally on mobile devices despite `overflow-hidden`
being set on the outer container. Content extends past the right edge of the
viewport. The issue does not appear on desktop.

## Root Cause

Flex children default to `min-width: auto`, which prevents them from shrinking
below their content's intrinsic width. On mobile, where the viewport is narrow,
a deeply nested flex child with wide content (a long text string, a chart, a
grid) refuses to shrink. This pushes its parent wider, which pushes *its*
parent wider, cascading up the DOM tree.

Adding `overflow-hidden` to a parent only clips the overflow visually -- it
does not fix the layout. The element still computes at its full width, and on
iOS Safari/WKWebView, the body-level scroll still activates.

A secondary issue: `h-screen` (100vh) on iOS does not account for the dynamic
browser chrome. The viewport height changes as you scroll, causing layout
jumps.

## Solution

Add `min-w-0` (Tailwind for `min-width: 0`) to every flex container in the
chain from root to the overflowing child:

```tsx
<div className="flex h-dvh min-w-0">
  <main className="flex-1 min-w-0">
    <div className="flex flex-col min-w-0">
      {/* content */}
    </div>
  </main>
</div>
```

Key rules:
- **`min-w-0`** on every flex parent -- missing it on even one level breaks
  the chain.
- **`h-dvh`** instead of `h-screen` -- uses the dynamic viewport height that
  accounts for mobile browser chrome.
- Do NOT use `overflow-hidden` as a layout fix. Use it only for intentional
  clipping (e.g., rounded corners, image containers).

## Prevention

- Establish `min-w-0` as a default on all flex containers in the layout shell.
- Test on a real iOS device or simulator -- desktop responsive mode does not
  reproduce `min-width: auto` overflow behavior accurately.
- Use `h-dvh` from the start on any full-height mobile layout.
