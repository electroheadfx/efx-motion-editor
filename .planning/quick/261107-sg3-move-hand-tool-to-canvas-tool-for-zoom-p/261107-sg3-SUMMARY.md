---
phase: 261107-sg3-move-hand-tool-to-canvas-tool-for-zoom-p
plan: 01
subsystem: ui
tags: [preact, signals, pointer-events, canvas-zoom, tool-rail]

# Dependency graph
requires:
  - phase: 261105-cgl
    provides: the session-only hand store and the mid-drag pan path (physicsPaintCanvasZoom.setPan)
  - phase: 261104-uyv
    provides: the floating canvas zoom pill and the capture-phase zoom viewport
provides:
  - a latched Hand canvas tool in the floating zoom pill (arm click, primary-drag pan, second click disarms)
  - capture-phase primary-button pan routing through the same setPan path as middle-drag
  - a grab/grabbing/empty cursor law with mid-drag disarm
  - a Hand-free Studio tool rail (hand store and zoom store removed from the rail)
affects: [60-studio-timeline-horizontal-zoom, studio canvas tooling]

actuals:
  tokens: 8736
  tasks: 3
  commits: 3
  plan_head_before: 0d3658a2303a9989c8e260e696588a67db6684cc
  plan_head_after: 3b4bb3581b29b48f48d3b038a87074fbcfdd681a

tech-stack:
  added: []
  patterns:
    - "Latched canvas tool: one boolean arms a global input mode; the viewport consumes one extra pointer route in the capture phase and reuses the existing pan state"
    - "Narrow signals effect for DOM-only presentation (cursor) created inside the mount effect, disposed in cleanup, never writing a signal"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintCanvasZoomBar.tsx
    - app/src/components/physic-paint/view/PhysicsPaintCanvasZoomViewport.tsx
    - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
    - app/src/components/physic-paint/view/physicsPaintHandTool.ts
    - app/src/components/physic-paint/view/physicsPaintHandToolWiring.test.ts
    - app/src/components/physic-paint/view/physicsPaintCanvasZoomWiring.test.ts
    - app/src/components/physic-paint/view/railMotionBoundaryTool.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "The Hand is LATCHED: one click arms, a primary drag pans, a second click on the same icon disarms (D-01)"
  - "Only the Hand icon toggles it — no coupling to the paint tool, Select, the picker, motion mode, keys or Escape (D-02)"
  - "Never disabled at Fit or without overflow: the hand route skips the overflow gate so setPan clamps the pan to zero (D-03)"
  - "The viewport cursor is driven by one signals effect that writes DOM style only; a disarm finishes a live drag before clearing the cursor"
  - "The rail keeps only paint/host tools and no longer imports the hand or zoom store (D-04)"

patterns-established:
  - "Primary-press capture-phase routing: `handPan = button 0 && isHandToolArmedPeek()`; middle always routes, primary only while armed, both through one drag state and physicsPaintCanvasZoom.setPan"
  - "Cursor law: armed idle = grab, drag = grabbing, release while armed = grab, disarm = empty"

requirements-completed: [QUICK-261107-SG3]

coverage:
  - id: D1
    description: "The floating zoom pill renders the latched Hand toggle before Fit, aria-pressed bound to the armed signal, no disabled state, no paint-state coupling"
    requirement: QUICK-261107-SG3
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintHandToolWiring.test.ts#Hand canvas tool in the zoom pill (261107-sg3)"
        status: pass
    human_judgment: true
    rationale: "Source pins prove the markup and wiring; the actual click-to-arm click-to-disarm behavior on the native Studio canvas needs live UAT."
  - id: D2
    description: "An armed primary press is consumed in the capture phase and pans through the same physicsPaintCanvasZoom.setPan path as middle-drag; middle-drag unchanged"
    requirement: QUICK-261107-SG3
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintCanvasZoomWiring.test.ts#routes a middle press always and a primary press only while the Hand is armed"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintHandToolWiring.test.ts#pans on a primary drag only while armed, through the middle-drag path"
        status: pass
    human_judgment: true
    rationale: "Routing is pinned structurally; live drag feel and the absence of accidental painting while armed need native UAT."
  - id: D3
    description: "The Studio tool rail renders no Hand control, imports neither the hand store nor the zoom store, and its paint row no longer references handArmed"
    requirement: QUICK-261107-SG3
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintHandToolWiring.test.ts#Hand removed from the Studio tool rail (261107-sg3)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts (339 tests)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/railMotionBoundaryTool.test.ts (5 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Cursor law (grab/grabbing/grab/empty) and mid-drag disarm via one narrow disposed signals effect"
    requirement: QUICK-261107-SG3
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintHandToolWiring.test.ts#holds the grab/grabbing cursor law and ends a live hand drag on disarm"
        status: pass
    human_judgment: true
    rationale: "Source pins prove the effect shape; the visible cursor states on the native canvas need live UAT."
  - id: D5
    description: "Hand store API and compare-then-write/idempotent contract unchanged; contract doc describes the latched canvas tool"
    requirement: QUICK-261107-SG3
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintHandTool.test.ts (6 tests)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintHandToolWiring.test.ts#keeps the unchanged hand store API and describes the latched canvas tool"
        status: pass
    human_judgment: false

metrics:
  duration: 3min
  completed: 2026-11-07
  status: complete
---

# Quick 261107-sg3: Move the Hand tool to the canvas for zoom/pan Summary

**Hand canvas pan in the floating zoom pill: one click arms a single primary drag that pans through the existing `setPan` path, grab/grabbing cursor, and releasing the drag disarms; the Studio tool rail loses the Hand entirely.**

> **UAT correction (2026-11-07, after delivery):** the first cut kept the Hand
> armed after the drag release. Live UAT rejected that model — the agreed law
> is ONE DRAG PER CLICK: the release of the pan drag also disarms, so the next
> canvas drag paints again. A second click before dragging still cancels. The
> correction is in `PhysicsPaintCanvasZoomViewport.tsx`
> (`if (wasHand) disarmHandTool();` in `finishDrag`) plus the pill copy and the
> wiring pins. Panning itself already worked in the UAT; only the exit law
> changed.

## Performance

- **Duration:** 3 min
- **Started:** 2026-11-07T19:37:00Z
- **Completed:** 2026-11-07T19:40:12Z
- **Tasks:** 3 (tracer TDD + 2 auto)
- **Files modified:** 8

## Accomplishments

- The zoom pill gains a latched `aquarelle-hand-toggle` before Fit, bound to the armed signal with no disabled state and no coupling to paint/Select/picker/motion state.
- An armed primary press is consumed in the viewport capture phase and pans through `physicsPaintCanvasZoom.setPan` — the same drag state middle-drag uses; middle-drag keeps its overflow gate and capture-phase listener.
- The rail's Hand button, momentary hold-to-pan session, pointer listeners, unmount cleanup, `Hand` icon, `preact/hooks` import and both store imports are gone; the paint row's active expression is Hand-free.
- One narrow signals effect owns the cursor law (grab / grabbing / grab / empty), disposes in the mount cleanup, and ends a live hand drag on disarm (pointer capture released).
- Hand store API and compare-then-write bodies untouched; the contract doc now describes the latched canvas tool while keeping the pinned `HOST tool` phrase.

## Task Commits

Each task was committed atomically:

1. **Task 1: Arm the Hand in the zoom pill and pan with a primary drag** - `6e10f682f` (feat)
2. **Task 2: Remove the Hand button and its session from the Studio tool rail** - `817546d90` (refactor)
3. **Task 3: Cursor law, mid-drag disarm, and the latched contract doc** - `3b4bb3581` (feat)

**Plan metadata:** orchestrator-owned docs commit (SUMMARY/STATE/PLAN not committed by this executor)

_Note: TDD tasks may have multiple commits (test → feat → refactor). Here each task's RED pins and GREEN source landed in the same atomic commit._

## Files Created/Modified

- `app/src/components/physic-paint/view/PhysicsPaintCanvasZoomBar.tsx` - latched Hand toggle before Fit, armed-signal read, module doc rewrite.
- `app/src/components/physic-paint/view/PhysicsPaintCanvasZoomViewport.tsx` - primary-press routing while armed, `hand` drag flag, `finishDrag`, cursor effect, dispose in cleanup.
- `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx` - Hand button and hold-to-pan session removed; hook/store imports removed; active expression simplified.
- `app/src/components/physic-paint/view/physicsPaintHandTool.ts` - contract doc rewritten for the latched canvas tool (API unchanged).
- `app/src/components/physic-paint/view/physicsPaintHandToolWiring.test.ts` - rail-removal, pill, viewport-routing, cursor and store-contract pins.
- `app/src/components/physic-paint/view/physicsPaintCanvasZoomWiring.test.ts` - additive dual-routing pin.
- `app/src/components/physic-paint/view/railMotionBoundaryTool.test.ts` - rail exclusivity pin updated.
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - rail active-expression pin and stale Hand comment updated.

## Decisions Made

- Followed the locked D-01..D-04 design exactly: latched, canvas-internal, never disabled at Fit, full rail removal.
- Kept the middle-drag overflow early return only for the middle route (`!handPan && !hasOverflow`) so the hand route still proceeds at Fit and clamps through `setPan`.
- The effect's disarm branch finishes any live drag (not only a hand-flagged one) — the plan's specified shape; a mid-drag disarm therefore always releases pointer capture.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. RED was confirmed for each task before the source edit: Task 1 (4 failures: pill toggle, viewport routing, capture-phase/mount pins, dual-routing pin), Task 2 (5 failures: rail removal ×3 + motion-boundary + Studio), Task 3 (2 failures: cursor law + store contract).

## User Setup Required

None - no external service configuration required.

## Verification

- `pnpm --dir app exec vitest run` on the five targeted suites: green (hand wiring 11, hand store 6, zoom wiring 7, motion-boundary 5, Studio 339).
- Full `src/components/physic-paint` tree: 226 files / 5,577 tests passed.
- `pnpm --dir app run typecheck`: clean.
- Scope check: `git diff --name-only 0d3658a23 -- app/src` lists exactly the eight `files_modified` paths.

## Known Stubs

None.

## UAT Correction — one drag per click (2026-11-07)

Live UAT confirmed the pan worked but rejected the stay-armed exit law. Final
behavior:

- Click the Hand in the zoom pill → one primary-button drag on the canvas pans
  through the same `setPan` path as middle-drag.
- Releasing that drag also disarms: the grab cursor clears and the next canvas
  drag paints again. A second Hand click before dragging cancels.
- Middle-drag stays untouched (never disarms), and the Hand stays independent
  of the paint tool / Select / picker / motion mode.
- Wiring pins updated: `physicsPaintHandToolWiring.test.ts` gains the
  `finishDrag` one-shot pin; the store/pill/rail pins now describe the
  one-drag model.

## Next Phase Readiness

- Automated-ready; the remaining live native UAT rows are the one-drag-per-click
  arm/pan/release cycle, no accidental paint during the drag, and the cursor
  states.
- No blockers; no CSS change was needed (the pill's existing `[aria-pressed="true"]` rule styles the button).

---
*Quick: 261107-sg3-move-hand-tool-to-canvas-tool-for-zoom-p*
*Completed: 2026-11-07*

## Self-Check: PASSED

- All 8 modified source files exist at HEAD `3b4bb3581`.
- Task commits `6e10f682f`, `817546d90`, `3b4bb3581` are ancestors of HEAD.
- SUMMARY.md exists at `.planning/quick/261107-sg3-move-hand-tool-to-canvas-tool-for-zoom-p/261107-sg3-SUMMARY.md`.
