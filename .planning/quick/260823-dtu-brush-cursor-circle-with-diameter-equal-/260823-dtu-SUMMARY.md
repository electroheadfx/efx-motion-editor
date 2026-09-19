---
phase: quick-260823-dtu
plan: 260823-dtu
subsystem: ui
tags: [paint-cursor, physics-paint, canvas-2d, brush-size, preact]

# Dependency graph
requires: []
provides:
  - Deterministic solid brush cursor (ring + crosshair) legible on light and dark canvases, no dashes, no blend modes, no sampling
affects: [physics-paint-studio, brush-tool, drawBrushCursor cursor presentation]

# Actuals (#2632) — pairs with the plan's `estimate: 8000` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 222
  tasks: 1
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deterministic contrast without blend modes: dark under-stroke (width 3) + white over-stroke (width 1) on the same arc/line — white hairline flanked by black reads on light AND dark"
    - "Canvas 2D vector-effect equivalent: solid strokes, no setLineDash, no mix-blend-mode, no getImageData sampling"

key-files:
  created: []
  modified:
    - packages/efx-physic-paint/src/render/canvas.ts
    - app/src/components/canvas/PaintCursor.tsx

key-decisions:
  - "The reported cursor surface was the Physics Paint Studio (drawBrushCursor in packages/efx-physic-paint/src/render/canvas.ts), not the main-editor PaintCursor.tsx. The dashed ring + center dot was replaced with a solid dual-stroke cursor."
  - "radius >= 4: true-size ring as two solid strokes (dark #111 width 3 under, white #fff width 1 over) on the same arc. radius < 4: fixed crosshair (6px arms, 1px center gap), same dual-stroke per axis. Center dot dropped (not legible on light)."
  - "Main-editor PaintCursor.tsx rewritten as an inline SVG with vector-effect non-scaling-stroke (circle for brushSize >= 8, 23px crosshair below), kept per user instruction; committed separately, visual UAT pending."

patterns-established:
  - "Overlay cursor contrast is authored with explicit dual strokes (dark under + light over), never blend-mode backdrop compositing or pixel sampling"

requirements-completed: []

coverage:
  - id: D1
    description: "Brush cursor renders as a solid ring whose outer edge matches the brush size (or a compact crosshair for tiny brushes), centered on the pointer, legible on both light and dark canvases"
    verification:
      - kind: other
        ref: "packages/efx-physic-paint/src/render/canvas.ts — grep gates: no setLineDash([4,3]) in drawBrushCursor, rgba(17,17,17,0.9) + rgba(255,255,255,0.95) dual strokes, no blend-mode/getImageData"
        status: pass
      - kind: other
        ref: "pnpm --filter efx-physic-paint exec tsc --noEmit"
        status: pass
      - kind: other
        ref: "pnpm --filter efx-motion-editor exec vitest run (2675 passed)"
        status: pass
    human_judgment: true
    rationale: "Visual legibility on light and dark canvases and cursor-diameter tracking of the brush-size slider require native UAT on both backgrounds, which the user performs in the running app"

# Metrics
duration: 6min
completed: 2026-08-23
status: complete
---

# Quick 260823-dtu: Brush cursor circle with diameter equal to brush size, legible on light and dark canvases Summary

**Replaced the dashed ring + center-dot brush cursor in the Physics Paint Studio with a deterministic solid dual-stroke cursor (dark under-stroke + white over-stroke), plus a compact crosshair for tiny brushes; rewrote the main-editor PaintCursor as an inline SVG with the same dual-stroke treatment**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-23T08:01:26Z
- **Completed:** 2026-08-23T11:10:00Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Identified the real cursor surface: the user's screenshots showed the **Physics Paint Studio** cursor (`drawBrushCursor` in `packages/efx-physic-paint/src/render/canvas.ts`), not the main-editor `PaintCursor.tsx`. The dashed ring (`setLineDash([4,3])`) was the legibility failure.
- `drawBrushCursor` now draws a **solid** cursor — no dashes, no blend modes, no sampling:
  - `radius >= 4`: true-size ring as two solid strokes on the same arc — dark `rgba(17,17,17,0.9)` width 3 under, white `rgba(255,255,255,0.95)` width 1 over. The white hairline flanked by black reads on light AND dark.
  - `radius < 4`: fixed crosshair (6px arms, 1px center gap), same dual-stroke per axis. Center dot dropped (a plain white dot is not legible on light backgrounds).
  - `setLineDash([])` after `save()` guarantees solid strokes regardless of caller-left dash state.
- Main-editor `PaintCursor.tsx` rewritten as an inline SVG with `vector-effect="non-scaling-stroke"` (circle for `brushSize >= 8`, 23px crosshair below), kept per user instruction; committed separately, visual UAT pending.

## Task Commits

Each task was committed atomically:

1. **Physics Paint Studio cursor fix** - `cb6ea707` (fix) — solid dual-stroke cursor in `drawBrushCursor`
2. **Main-editor SVG cursor** - `5d6e2ca2` (feat) — inline SVG dual-stroke cursor in `PaintCursor.tsx`

**Plan metadata:** docs commit handled by the orchestrator (quick-task constraint: docs artifacts not committed by the executor).

## Files Created/Modified
- `packages/efx-physic-paint/src/render/canvas.ts` - Replaced dashed ring + center dot with solid dual-stroke cursor: ring (radius >= 4) and crosshair (radius < 4), both dark-under/white-over; removed `setLineDash([4,3])`.
- `app/src/components/canvas/PaintCursor.tsx` - Rewrote as inline SVG with `vector-effect="non-scaling-stroke"`: circle for `brushSize >= 8`, 23px crosshair below; no blend modes, no sampling, no box-shadow.

## Decisions Made
- The plan's original box-shadow double-outline approach (commit `45bf4b90`) was a dead end — it rasterized as a faint dashed ring at small diameters and collapsed to a white blob under 4px. The user redirected to the correct surface (Physics Paint Studio) and the accepted design became the solid dual-stroke cursor.
- Dropped the center dot: not legible on light backgrounds; the ring/crosshair is already centered on the pointer.
- Crosshair tuned after UAT feedback ("too strong and bigger"): arms 11 → 6px, dark under-stroke 3 → 2px.

## Deviations from Plan

The plan targeted `app/src/components/canvas/PaintCursor.tsx` (main editor). The actual fix landed in `packages/efx-physic-paint/src/render/canvas.ts` (Physics Paint Studio) after the user identified the correct surface from screenshots. The main-editor `PaintCursor.tsx` was still rewritten (SVG dual-stroke) and committed separately.

## Issues Encountered
- A stale `.git/index.lock` blocked the initial revert; verified with `lsof` that no process held it, removed the stale lock per CLAUDE.md recovery guidance, and re-ran successfully.
- `mix-blend-mode: difference` does not engage in this Tauri webview (parent stacking context from the canvas CSS transform isolates it) — ruled out.
- `getImageData` pixel sampling is unreliable because the canvas bitmap is transparent where unpainted (the light/dark background is CSS behind the canvas) — ruled out.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Automated gates pass: physics package `tsc --noEmit` clean, full app vitest suite passes (2675 tests), grep gates confirm the dual-stroke colors and the absence of dashes/blend-mode/sampling in the cursor.
- **Native UAT passed** for the Physics Paint Studio cursor at brush sizes 1/3/4/9/30px on light and dark canvases (user: "perfect, approved").
- **Pending native UAT:** main-editor `PaintCursor.tsx` SVG cursor (committed separately, not yet visually confirmed).

---
*Phase: quick-260823-dtu*
*Completed: 2026-08-23*

## Self-Check: PASSED

- `packages/efx-physic-paint/src/render/canvas.ts` — present (modified, committed `cb6ea707`)
- `app/src/components/canvas/PaintCursor.tsx` — present (modified, committed `5d6e2ca2`)
- SUMMARY at `.planning/quick/260823-dtu-brush-cursor-circle-with-diameter-equal-/260823-dtu-SUMMARY.md` — present
