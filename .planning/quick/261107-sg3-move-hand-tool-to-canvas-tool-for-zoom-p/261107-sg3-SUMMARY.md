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
    description: "The floating zoom pill renders the press-and-hold Hand button before Fit, aria-pressed bound to the armed signal, no disabled state, no paint-state coupling"
    requirement: QUICK-261107-SG3
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintHandToolWiring.test.ts#Hand press button in the zoom pill (261107-sg3)"
        status: pass
    human_judgment: true
    rationale: "Source pins prove the markup and wiring; the actual press-move-release behavior on the native Studio canvas needs live UAT."
  - id: D2
    description: "A held Hand press captures the pointer and pans through the same physicsPaintCanvasZoom.setPan path as middle-drag; the canvas keeps middle-drag only"
    requirement: QUICK-261107-SG3
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintHandToolWiring.test.ts#pans for as long as the button is held and disarms on release"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintHandToolWiring.test.ts#leaves the canvas pointer route to middle-drag only"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintCanvasZoomWiring.test.ts#routes only a middle press to the canvas pan; the Hand owns its own pointer"
        status: pass
    human_judgment: true
    rationale: "Routing is pinned structurally; live press-drag feel and the absence of accidental painting need native UAT."
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
    description: "The pressed Hand ends cleanly: release/cancel/lost-capture all disarm, the button restores its cursor, and a Studio window closing mid-press never leaves the flag armed"
    requirement: QUICK-261107-SG3
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintHandToolWiring.test.ts#pans for as long as the button is held and disarms on release"
        status: pass
    human_judgment: true
    rationale: "Source pins prove the teardown; the visible press/move/release cycle needs live UAT."
  - id: D5
    description: "Hand store keeps the compare-then-write/idempotent arm-disarm contract; the unused toggle helper is removed and the contract doc describes the momentary press"
    requirement: QUICK-261107-SG3
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintHandTool.test.ts (6 tests)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintHandToolWiring.test.ts#keeps the unchanged hand store API and describes the momentary press"
        status: pass
    human_judgment: false

metrics:
  duration: 3min
  completed: 2026-11-07
  status: complete
---

# Quick 261107-sg3: Move the Hand tool to the canvas for zoom/pan Summary

**Press-and-hold Hand canvas pan in the floating zoom pill: press the button, move the mouse or pen to pan through the existing `setPan` path, release to stop; the Studio tool rail loses the Hand entirely.**

> **UAT corrections (2026-11-07, after delivery):** two click models were
> tried and rejected live. The final law is a PRESS-AND-HOLD button: press the
> Hand in the zoom pill, move the mouse or pen to pan (pointer capture keeps
> the pan following the pointer), release to stop and disarm. No canvas click,
> nothing latched. The canvas keeps its middle-drag route only — the interim
> viewport hand routing and the one-drag release fix were both removed.

## Performance

- **Duration:** 3 min
- **Started:** 2026-11-07T19:37:00Z
- **Completed:** 2026-11-07T19:40:12Z
- **Tasks:** 3 (tracer TDD + 2 auto)
- **Files modified:** 8

## Accomplishments

- The zoom pill gains a press-and-hold `aquarelle-hand-toggle` before Fit, bound to the armed signal with no disabled state and no coupling to paint/Select/picker/motion state.
- Pressing that button captures the pointer and pans through `physicsPaintCanvasZoom.setPan` — the same path middle-drag uses — for as long as the press lasts; releasing disarms.
- The rail's Hand button and its session are gone; the rail keeps its paint and host tools only and imports neither the hand store nor the zoom store.
- The canvas viewport stays middle-drag only: no primary-press hand route and no cursor subscription survives there.
- Hand store keeps its compare-then-write/idempotent contract; the unused `toggleHandTool` helper was removed and the contract doc describes the momentary press while keeping the pinned `HOST tool` phrase.

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

- UAT-final model: the Hand is a press button in the zoom pill (pointer capture + `setPan` on move), momentary — release disarms. It is canvas-internal, never disabled at Fit, and absent from the rail.
- The canvas viewport was restored to middle-drag only; the momentary button does not touch canvas pointer routing.
- `toggleHandTool` was removed with the click model; the store exposes arm/disarm and compare-then-write reads only.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. RED was confirmed for each task before the source edit: Task 1 (4 failures: pill toggle, viewport routing, capture-phase/mount pins, dual-routing pin), Task 2 (5 failures: rail removal ×3 + motion-boundary + Studio), Task 3 (2 failures: cursor law + store contract).

## User Setup Required

None - no external service configuration required.

## Verification

- `pnpm --dir app exec vitest run` on the targeted suites: green (hand wiring 10, hand store 6, zoom wiring 7, motion-boundary 5, Studio 339).
- Full `src/components/physic-paint` tree: 226 files / 5,577 tests passed.
- `pnpm --dir app run typecheck`: clean.
- Scope check: `git diff --name-only 0d3658a23 -- app/src` lists exactly the eight `files_modified` paths.

## Known Stubs

None.

## UAT Correction — press-and-hold (final, 2026-11-07)

Two click models were tried and rejected live. Final behavior:

- Press and HOLD the Hand button in the zoom pill, then move the mouse or pen:
  the canvas pans through the same `setPan` path as middle-drag. Pointer
  capture keeps the pan following the pointer after it leaves the button.
- Releasing the button stops the pan and disarms. Nothing latches, and the
  canvas is never clicked to pan.
- The canvas viewport stays middle-drag only; primary canvas presses go to the
  paint stack untouched. The Hand stays independent of the paint tool /
  Select / picker / motion mode.
- Wiring pins updated: the pill pins `onPointerDown` + capture + `setPan` +
  disarm-on-release; the viewport pins no hand routing; the store's unused
  `toggleHandTool` was removed.

**Live UAT approved 2026-11-07** — press-and-hold pan in the zoom pill accepted.

## Next Phase Readiness

- Closed: live UAT approved the press-and-hold pan cycle.
- No blockers; no CSS change was needed (the pill's existing `[aria-pressed="true"]` rule styles the pressed button).

---
*Quick: 261107-sg3-move-hand-tool-to-canvas-tool-for-zoom-p*
*Completed: 2026-11-07*

## Self-Check: PASSED

- All 8 modified source files exist at HEAD `3b4bb3581`.
- Task commits `6e10f682f`, `817546d90`, `3b4bb3581` are ancestors of HEAD.
- SUMMARY.md exists at `.planning/quick/261107-sg3-move-hand-tool-to-canvas-tool-for-zoom-p/261107-sg3-SUMMARY.md`.
