# Phase 17: Enhancements - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 17-enhancements
**Areas discussed:** Key photo scroll/collapse, Sequence solo semantics, Layer solo controls

---

## Key Photo Scroll/Collapse

### ENH-01 root cause

| Option | Description | Selected |
|--------|-------------|----------|
| Vertical multi-row wrap | Key photos wrap to rows with vertical scroll | |
| Better horizontal scroll UX | Add scroll indicators (arrows, fade edges) | |
| Scrollbar visible | Show horizontal scrollbar | |

**User's choice:** None — user clarified the actual issue is vertical scroll blocking when key photos are expanded. The wheel handler in KeyPhotoStripInline prevents parent Sequences panel from scrolling. ENH-02 collapse solves this.

### Drop ENH-01?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, drop ENH-01 | ENH-02 collapse solves the root cause | ✓ |
| Keep ENH-01 separately | Fix scroll blocking as its own task | |

### Collapse toggle behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle on active sequence | First click selects+expands, second collapses. Auto-collapse previous on switch | ✓ |
| Independent expand state | Each sequence remembers its own state, multiple can be open | |
| Global toggle button | Single button in panel header | |

### Expand persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Always auto-expand on select | New sequence always shows key photos | ✓ |
| Remember last state | Next sequence starts collapsed if previous was | |

### Scroll fix

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, fix wheel passthrough | Smart wheel handling at scroll edges | |
| No, collapse is enough | Users collapse to scroll sequences | ✓ |

---

## Sequence Solo Semantics

### Solo rendering semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Bypass layers + FX compositing | Render only base key photos, no overlays, no FX | ✓ |
| Bypass layers + FX per-sequence | Solo applies only to active sequence | |
| Replace isolation entirely | Solo replaces current isolation system | |

**User's note:** ENH-03 revised to "solo the timeline to play without layers and FX" (global, not per-sequence).

### Solo UI placement

| Option | Description | Selected |
|--------|-------------|----------|
| Timeline toolbar button | Global toggle in transport/toolbar area | ✓ |
| Keyboard shortcut only | No visible button | |
| Canvas toolbar | Button alongside zoom/fit controls | |

### Solo scope (preview vs export)

| Option | Description | Selected |
|--------|-------------|----------|
| Preview only | Solo only affects canvas preview | |
| Both preview and export | Solo affects both preview and export output | ✓ |

---

## Layer Solo Controls

### Layer solo semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Show only that layer | Solo layer = render only that layer's content | |
| Mute other layers | Solo layer = key photos + only soloed layer | |
| Toggle layer visibility | Simple show/hide per layer | |

**User's choice:** Dropped ENH-04 entirely. User decided there is only one Solo feature: global timeline solo that strips all layers (key photo layers + timeline layers) and FX. No per-layer solo.

---

## Claude's Discretion

- Solo button icon and active state styling
- Keyboard shortcut assignment
- Collapse animation details
- Solo state persistence strategy

## Deferred Ideas

- Solid with multi-gradient (GLSL shader gradients on solid layers/key entries) — future phase
- Per-layer solo (ENH-04 original) — dropped, could revisit later
- Smart wheel passthrough in key photo strip — low priority
