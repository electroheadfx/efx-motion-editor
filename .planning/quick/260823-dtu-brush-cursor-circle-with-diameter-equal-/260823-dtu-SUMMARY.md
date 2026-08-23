---
phase: quick-260823-dtu
plan: 260823-dtu
subsystem: ui
tags: [paint-cursor, preact, css, canvas-overlay, brush-size]

# Dependency graph
requires: []
provides:
  - Deterministic double-outline brush cursor circle legible on light and dark canvases without CSS blend-mode
affects: [paint-mode, brush-tool, PaintOverlay cursor presentation]

# Actuals (#2632) — pairs with the plan's `estimate: 8000` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 222
  tasks: 1
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deterministic contrast without mix-blend-mode: solid dark outer halo + solid bright inner ring + dark inner hairline via border/boxShadow"

key-files:
  created: []
  modified:
    - app/src/components/canvas/PaintCursor.tsx

key-decisions:
  - "Cursor legibility uses a deterministic double-outline (white inner ring + dark outer halo + dark inner hairline) instead of mix-blend-mode difference compositing, which was illegible on light canvases"

patterns-established:
  - "Overlay cursor contrast is authored with explicit border/boxShadow colors, never blend-mode backdrop compositing"

requirements-completed: []

coverage:
  - id: D1
    description: "Brush cursor renders as a double-outline circle whose outer edge matches the brush pixel size, centered on the pointer, legible on both light and dark canvases"
    verification:
      - kind: other
        ref: "app/src/components/canvas/PaintCursor.tsx — grep gates: no mixBlendMode/blend-mode, rgba(255,255,255,0.95) border, rgba(0,0,0,0.85) boxShadow"
        status: pass
      - kind: other
        ref: "pnpm --filter efx-motion-editor exec tsc --noEmit"
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

**Rewrote the brush cursor in PaintCursor.tsx as a deterministic double-outline circle (solid white inner ring + solid dark outer halo + dark inner hairline) with the CSS blend-mode dependency removed, keeping the pointer-centered diameter equal to max(brushSize, 4)**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-23T08:01:26Z
- **Completed:** 2026-08-23T08:07:30Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Brush cursor no longer depends on `mix-blend-mode: difference` (which produced a faint, muddy crosshair on light canvases).
- Cursor now renders a solid dark outer halo (`0 0 0 1.5px rgba(0,0,0,0.85)`) plus a solid bright inner ring (`1.5px solid rgba(255,255,255,0.95)`) plus a dark inner hairline (`inset 0 0 0 1px rgba(0,0,0,0.85)`) — deterministic contrast on any backdrop.
- The white ring's outer edge equals the border-box edge = `displayDiameter = max(brushSize, 4)`; the circle stays centered on the pointer (position math unchanged).
- Geometry, visibility, and brush-size plumbing untouched: position formula, borderRadius 50%, pointerEvents none, zIndex 50, `if (!visible) return null`, and the pre-transform-space comment are byte-identical.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite brush cursor circle with a deterministic double-outline** - `45bf4b90` (feat)

**Plan metadata:** docs commit handled by the orchestrator (quick-task constraint: docs artifacts not committed by the executor).

## Files Created/Modified
- `app/src/components/canvas/PaintCursor.tsx` - Replaced blend-mode-dependent cursor style with deterministic double-outline: border `1.5px solid rgba(255,255,255,0.95)`, boxShadow `0 0 0 1.5px rgba(0,0,0,0.85), inset 0 0 0 1px rgba(0,0,0,0.85)`, removed `mixBlendMode`.

## Decisions Made
- Followed the plan's accepted double-outline alternative verbatim: solid dark outer halo for light canvases + solid white inner ring for dark canvases, no blend-mode dependency. No new decision needed — the plan locked the alternative and the automated grep gates encode it.

## Deviations from Plan

None - plan executed exactly as written. The one operational incident (stale `.git/index.lock`) was handled via the project's documented recovery procedure (lsof check → no holder → remove lock → retry) and is not a code deviation.

## Issues Encountered
- A stale `.git/index.lock` blocked the task commit; verified with `lsof` that no process held it, removed the stale lock per CLAUDE.md recovery guidance, and re-ran the commit successfully.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Automated gates pass: `tsc --noEmit` clean, full vitest suite passes (2675 tests), grep gates confirm the double-outline colors and the absence of any blend-mode dependency.
- **Pending native UAT:** user confirmation on both a light (white/near-white) and a dark/black canvas that (1) the circle is clearly visible on both, (2) its outer edge tracks the brush-size slider, and (3) it stays centered on the pointer while painting and while not painting.

---
*Phase: quick-260823-dtu*
*Completed: 2026-08-23*

## Self-Check: PASSED

- `app/src/components/canvas/PaintCursor.tsx` — present (modified, committed)
- Commit `45bf4b90` — verified in git log
- SUMMARY at `.planning/quick/260823-dtu-brush-cursor-circle-with-diameter-equal-/260823-dtu-SUMMARY.md` — present
