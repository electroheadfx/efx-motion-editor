---
gsd_state_version: 1.0
milestone: v0.5.0
milestone_name: Motion Blur & Paint Styles
status: Ready to execute
stopped_at: Completed 21-02-PLAN.md
last_updated: "2026-03-26T16:20:23.891Z"
progress:
  total_phases: 2
  completed_phases: 1
  total_plans: 8
  completed_plans: 5
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-25)

**Core value:** Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences -- the complete stop-motion-to-cinema pipeline must work end-to-end.
**Current focus:** Phase 21 — motion-blur

## Current Position

Phase: 21 (motion-blur) — EXECUTING
Plan: 3 of 4

## Performance Metrics

**Velocity (v0.4.0):**

- Total plans completed: 9
- Phases: 2 (18, 19)
- Timeline: 2 days (2026-03-24 → 2026-03-25)

## Accumulated Context

### Decisions

Archived to PROJECT.md Key Decisions table.
Full phase decisions archived in milestones/v0.4.0-ROADMAP.md.

- [Phase 20]: Wave 0 test scaffold: 7 vitest stub files with 57 it.todo() cases covering full brush FX verification surface
- [Phase 20]: BrushStyle/BrushFxParams as optional PaintStroke fields for backward compat with existing sidecar data
- [Phase 20]: setBrushStyle auto-resets brushFxParams to per-style defaults for tuned values on style switch
- [Phase 20]: SVG data URIs with per-style filter effects for zero-cost brush preview thumbnails; BRUSH FX section between BRUSH and STROKE for logical grouping
- [Phase 20]: Combined stamp-based stroke rendering with spectral compositing in single brushFxRenderer.ts module; sRGB-to-linear gamma for correct spectral mixing
- [Phase 20]: Hash-based 2D noise flow field for organic stroke distortion -- simpler than Perlin, no dependency, deterministic
- [Phase 20]: STYLE_CONFIGS Record<string, StyleConfig> with getStyleConfig() fallback replaces per-property style constants for unified per-style rendering params
- [Phase 20]: Inline WATERCOLOR shaders in brushFxRenderer.ts (trivial, 10 lines each) rather than adding to brushFxShaders.ts
- [Phase 20]: Per-layer watercolor alpha = stroke.opacity * 0.3 / layerCount for natural transparency buildup; hashStringToNumber(stroke.id) for deterministic seeding
- [Phase 20]: p5.brush standalone replaces ~2000 lines of broken custom WebGL2 renderer with ~200 lines of adapter code
- [Phase 20]: Custom our_ink/our_pencil brushes via brush.add() for distinct style character (PAINT-02 edge darkening, PAINT-04 fine grain)
- [Phase 20]: HTMLCanvasElement | OffscreenCanvas | null union type for fxCanvas; typeof OffscreenCanvas guard for jsdom/SSR
- [Phase 20]: Per-frame caching (not per-stroke) ensures spectral mixing via shared p5.brush canvas
- [Phase 20]: renderFrameFx copies to new canvas; shared singleton reused between calls
- [Phase 20]: Added Plan 01 prerequisite types/signals inline for parallel execution (Rule 3)
- [Phase 20]: Flat-only drawing: brushStyle='flat' hardcoded in handlePointerUp -- FX applied post-draw via select tool per D-01
- [Phase 20]: FX application triggers full-frame re-render of ALL FX strokes for spectral mixing correctness (not just selected)
- [Phase 20]: showSequenceOverlay signal in paintStore (not component-level) for cross-component access
- [Phase 20]: flattenFrame ensures all styled strokes are marked fx-applied before calling renderFrameFx
- [Phase 20]: Export parity confirmed: exportRenderer delegates to PreviewRenderer which uses renderPaintFrameWithBg
- [Phase 21]: VELOCITY_THRESHOLD = 0.5 for stationary layer detection (sum of absolute deltas)
- [Phase 21]: Separate WebGL2 context for glMotionBlur.ts (not shared) for isolation and simplicity
- [Phase 21]: Triangle filter weighting in GLSL shader for smooth directional blur falloff
- [Phase 21]: VelocityCache invalidates on non-sequential frame for seek detection (Math.abs(currentFrame - lastFrame) > 1)
- [Phase 21]: Motion blur pass goes after gaussian blur when both apply on same layer (per D-12)
- [Phase 21]: Toolbar split-button: main Zap icon toggles blur, ChevronDown opens settings popover

### Pending Todos

None.

### Roadmap Evolution

v0.5.0 roadmap created. 2 phases (20-21), 22 requirements mapped.
Research recommends shared WebGL2 context (`glSharedContext.ts`) for both features.

### Blockers/Concerns

No active blockers.

### Quick Tasks Completed

None.

## Session Continuity

Last session: 2026-03-26T16:20:23.888Z
Stopped at: Completed 21-02-PLAN.md
Resume file: None
