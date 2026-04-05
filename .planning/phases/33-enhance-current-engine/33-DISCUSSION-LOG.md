# Phase 33: Enhance Current Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 33-enhance-current-engine
**Areas discussed:** UX, Paint Modes, Paint FX, Animation

---

## Initial Spec Provided

User provided a comprehensive written spec covering all four areas. Gray areas were identified from the spec for clarification.

## Inline Color Picker Design

| Option | Description | Selected |
|--------|-------------|----------|
| Vertical hue strip + square | Classic HSV picker with compact layout | |
| Compact swatches + slider | Color swatch grid with hue slider below | |
| Same as current modal picker | Reuse existing component, dock inline | |

**User's choice:** Custom multi-mode picker with 4 visual modes: Box (HSV square + hue/alpha sliders), TSL (H/S/L/A sliders), RVB (R/G/B/A sliders), CMYK (C/M/Y/K/A sliders). Plus HEX input and swatches (recent + custom favorites).
**Notes:** User provided 4 screenshots showing each visual mode. Auto-apply behavior, no OK/Cancel.

## Animate Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Identical copy | Same stroke duplicated to every frame | |
| Copy with position offset | Per-frame position/rotation delta | |
| Just the starting point | Copy as starting point, user edits each | |

**User's choice:** Speed-based progressive draw reveal — the stroke is drawn over time across frames using the original drawing speed. Slow drawing = more frames, fast drawing = fewer frames.
**Notes:** This is a drawing animation effect, not a copy. The stroke is progressively revealed at the project framerate.

## Circle Cursor Zoom Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Scale with zoom | Circle reflects actual brush footprint, scales with canvas zoom | ✓ |
| Fixed screen size | Circle always shows at pixel size value regardless of zoom | |

**User's choice:** Scale with zoom (like Photoshop)

## Animate Point Distribution

| Option | Description | Selected |
|--------|-------------|----------|
| Even distribution | Points split evenly across frame range | |
| Speed-based | Uses original drawing speed for natural reveal | ✓ |
| User sets duration only | User picks start/end, system distributes evenly | |

**User's choice:** Speed-based — slow parts of the stroke take more frames, fast parts fewer

## Color Picker Swatches

| Option | Description | Selected |
|--------|-------------|----------|
| Recent colors auto-collected | Auto-saves last N colors used | |
| User-managed palette | Manual add/remove swatches | |
| Both recent + custom | Auto recent row + manual favorites row | ✓ |

**User's choice:** Both — recent colors (auto) + saved favorites (manual)

## Mode Conversion Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Always ask: frame or all | Dialog asks current frame or all frames each time | ✓ |
| Current frame default | Converts current frame, batch option separate | |

**User's choice:** Always ask — dialog presents "current frame only or all frames?" choice

## Animate Preview

| Option | Description | Selected |
|--------|-------------|----------|
| Set params and go | Pick target range, confirm, can undo | ✓ |
| Preview first | Small preview before committing | |

**User's choice:** Set params and go — undo available if not happy

---

## Claude's Discretion

- Inline color picker component implementation approach
- Circle cursor rendering technique
- FX cache invalidation strategy for undo fix
- Speed-based point distribution algorithm
- CSS pulsate animation keyframes for exit button

## Deferred Ideas

- Physical Paint mode (efx-physic-paint engine) — next phase
- Custom brush presets (PAINT-09) — future phase
- Per-stroke physics isolation (PAINT-10) — future phase
- Multi-frame stroke operations (PAINT-11) — future phase
- Stroke grouping hierarchy (PAINT-12) — future phase
