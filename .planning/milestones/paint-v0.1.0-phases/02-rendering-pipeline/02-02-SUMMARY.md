---
phase: 02-rendering-pipeline
plan: "02"
subsystem: rendering
tags: [paper-heightmap, physics-decoupling, ui-split, paper-grain, background-toggle]

# Dependency graph
requires:
  - phase: 02-rendering-pipeline
    plan: "01"
    provides: Beer-Lambert density-weighted transparency and strengthened flow/diffusion parameters
provides:
  - Persistent physicsHeightMap decoupled from background display mode
  - setPaperPhysics() function for independent paper grain control
  - Split UI with separate Background (visual) and Paper grain (physics) controls
  - Auto-selection of matching paper grain when choosing canvas background
affects: [phase-03, paper-texture-verification]

# Tech tracking
tech-stack:
  added: []
  patterns: [physics-heightmap-decoupling, split-ui-controls]

key-files:
  created: []
  modified: [efx-paint-physic-v2.html]

key-decisions:
  - "physicsHeightMap persists independently of bgMode -- paperHeight never nulled by drawBg"
  - "Green highlight (#88cc44) on paper grain buttons to distinguish from blue (#44aaee) background buttons"
  - "Selecting canvas background auto-selects matching paper grain for convenience"
  - "Default paper physics: canvas1 (Smooth) initialized on texture load"

patterns-established:
  - "Physics state decoupled from display state: physicsHeightMap vs bgMode"
  - "Split UI pattern: visual controls and physics controls as separate labeled rows"

requirements-completed: [RENDER-01, DEMO-03]

# Metrics
duration: 4min
completed: 2026-03-29
---

# Phase 02 Plan 02: Paper Heightmap Decoupling and UI Split Summary

**Persistent physicsHeightMap decoupled from background mode; split Background/Paper grain UI controls with green/blue color distinction**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-29T17:23:12Z
- **Completed:** 2026-03-29T17:27:45Z
- **Tasks:** 2 completed, 1 pending (checkpoint:human-verify)
- **Files modified:** 1

## Accomplishments
- Introduced `physicsHeightMap` global that persists across all background mode changes (white, transparent, canvas), ensuring paper grain always influences flow, drying, and emboss physics
- Removed all executable `paperHeight=null` assignments from `drawBg()`, replacing with `paperHeight = physicsHeightMap` restoration at end of function
- Split the single "Canvas" UI row into two separate rows: "Background" (visual display) and "Paper grain" (physics heightmap), with distinct color highlights (blue vs green)
- Added `setPaperPhysics()` function for independent paper grain control, called from both the grain selector and the background selector (auto-match on canvas selection)

## Task Commits

Each task was committed atomically:

1. **Task 1: Decouple paper heightmap from background mode** - `545e4b0` (feat)
2. **Task 2: Split UI into paper grain selector and background toggle** - `ea5cefe` (feat)
3. **Task 3: Visual verification of complete Phase 2 rendering pipeline** - pending: awaiting human verification

## Files Created/Modified
- `efx-paint-physic-v2.html` - Added physicsHeightMap/currentPaperKey globals, setPaperPhysics() function, modified drawBg() to preserve physics heightmap, split Canvas UI into Background + Paper grain rows with .pgb CSS, added pgb click handler

## Decisions Made
- physicsHeightMap persists independently of bgMode -- drawBg never nulls paperHeight, always restores from physicsHeightMap
- Green highlight (#88cc44) on paper grain buttons distinguishes them visually from blue (#44aaee) background buttons
- Selecting a canvas background auto-selects the matching paper grain for user convenience (but not the reverse)
- Default paper physics initialized to canvas1 (Smooth) inside the img.onload callback for timing safety

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Task 3 (human-verify checkpoint) must be completed before Phase 2 can be marked as finished
- All rendering pipeline features are in place: density-weighted transparency (Plan 01), persistent paper physics and split UI (Plan 02)
- Once verified, Phase 3 work can proceed with confidence that paper heightmap survives background mode changes

## Self-Check: PASSED

- efx-paint-physic-v2.html: FOUND
- 02-02-SUMMARY.md: FOUND
- Commit 545e4b0 (Task 1): FOUND
- Commit ea5cefe (Task 2): FOUND

---
*Phase: 02-rendering-pipeline*
*Completed: 2026-03-29*
