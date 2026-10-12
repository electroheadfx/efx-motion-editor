---
phase: quick-261003-ud9
plan: 261003-ud9
subsystem: paint-engine
tags: [efx-physic-paint, erase, pointer-events, hover-preview, cursor-glyph, tdd, one-detection-law]

# Dependency graph
requires:
  - phase: quick-261003-hpi
    provides: "Erase contract: whole-stroke removal on wet (W-S), dry pixel eraser with force law (D-P), purely geometric detection — removeWetIntersectedStrokes()"
provides:
  - "Erase hover: preview ribbon of the fresh stroke under the cursor + pointer arrow glyph (dual dark/white)"
  - "Click-to-delete: one click on a fresh stroke removes entry + deposit + history, one 'erase' mutation notification"
  - "resolveEraseTargetIds() — the ONE geometric erase detection law shared by hover, click and drag"
affects: [erase, pointer-input, cursor-rendering, save-persistence, undo-history]

# Actuals (#2632)
actuals:
  tokens: 12950   # chars/4 over the realized diff (51801 chars, 49341b5f...HEAD)
  tasks: 3
  commits: 2      # measured at SUMMARY write: 76dfa3bd (test) + 01b7c163 (feat); docs commit follows

# Tech tracking
tech-stack:
  added: []
  patterns: [shared-detection-routine, hover-state-in-pointer-handlers, optional-renderer-mode-param]

key-files:
  created:
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.erasePointerDelete.test.ts
    - packages/efx-physic-paint/src/render/canvas.pointerCursor.test.ts
  modified:
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
    - packages/efx-physic-paint/src/render/canvas.ts

key-decisions:
  - "Extract resolveEraseTargetIds(firstOnly?) from removeWetIntersectedStrokes instead of a second threshold implementation — the preview can never promise a stroke the click then misses"
  - "Click path flushes pendingStrokeFinalizations BEFORE removal — a queued stroke's entry exists but its deposit does not; splice-first would orphan ghost pixels"
  - "Click miss falls through to the existing short-stroke discard (no pixel erase on click) — pixel erase stays drag-only, keeping the D-P contract shape"
  - "clearEraseHover() only nulls previewStroke when !drawing — the live gesture owns the ribbon during a stroke"

patterns-established:
  - "One detection law: hover preview, click delete and drag removal all call resolveEraseTargetIds() — never fork the threshold math"

requirements-completed: [QUICK-261003-UD9]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Erase hover: moving the pointer (not drawing) over a fresh stroke previews exactly that stroke's geometry in erase-red and swaps the brush ring for the pointer arrow glyph; move-off/leave/tool-change/force-0 all clear both"
    requirement: QUICK-261003-UD9
    verification:
      - kind: unit
        ref: "packages/efx-physic-paint/src/engine/EfxPaintEngine.erasePointerDelete.test.ts#HOVER: erase tool previews the fresh stroke under the pointer"
        status: pass
      - kind: unit
        ref: "packages/efx-physic-paint/src/render/canvas.pointerCursor.test.ts#CURSOR GLYPH: pointer mode draws the arrow polyline with the dual dark/white treatment"
        status: pass
    human_judgment: true
    rationale: "Native UAT row (a) is mandated pending by plan Task 3 — live hover feel in the running app must be judged by a human"
  - id: D2
    description: "Click = whole-stroke delete: one click removes the fresh stroke's entry, deposit, history and save() serialization with exactly one kind 'erase' notification; drain-coherent (flush before remove)"
    requirement: QUICK-261003-UD9
    verification:
      - kind: unit
        ref: "packages/efx-physic-paint/src/engine/EfxPaintEngine.erasePointerDelete.test.ts#CLICK: single click on a fresh stroke removes it end-to-end"
        status: pass
    human_judgment: true
    rationale: "Native UAT rows (b) and (d) are mandated pending — Save/reopen persistence, neighbor immunity and Undo honesty need the live app"
  - id: D3
    description: "Guards unchanged: click on pixel-only paint and on empty space is a no-op, force-0 click is inert, multi-sample drag still whole-stroke-removes and pixel-erases with the force law"
    requirement: QUICK-261003-UD9
    verification:
      - kind: unit
        ref: "packages/efx-physic-paint/src/engine/EfxPaintEngine.erasePointerDelete.test.ts#DRAG GUARD: multi-sample erase behavior is unchanged"
        status: pass
      - kind: unit
        ref: "packages/efx-physic-paint/src/engine/EfxPaintEngine.eraseContract.test.ts"
        status: pass
    human_judgment: true
    rationale: "Native UAT row (c) is mandated pending — drag feel with the force slider must be judged live"

# Metrics
duration: 30min
completed: 2026-10-03
status: complete
plan_head_before: 49341b5f610d4641bb5575231e35f987251645db
commits: 2
---

# Quick Task 261003-ud9: Erase pointer-delete on fresh strokes Summary

**Hover under the erase cursor previews the fresh stroke's own geometry with a pointer arrow glyph, and one click whole-stroke-deletes it — entry, deposit, history and one 'erase' notification — through a single shared geometric detection law with drag erase.**

**Verdict: automated-ready** (native UAT pending — five rows (a)–(e) below)

## Performance

- **Duration:** 30 min
- **Started:** 2026-10-03T20:09:11Z
- **Completed:** 2026-10-03
- **Tasks:** 3
- **Files modified:** 4 (2 created tests, 2 production)

## Accomplishments

- `resolveEraseTargetIds(points, opts, firstOnly?)` extracted from `removeWetIntersectedStrokes` — hover, click and drag now share ONE purely geometric law (tool 'paint', non-null mutationId, threshold strokeR + eraseR, newest-first, no wetness/dirty gates)
- Click path in `onPointerUp` short-stroke branch: flush drain → single-point whole-stroke removal → `redrawAll()` → exactly one `notifyCompletedMutation('erase', fresh mutationId)` so save/stroke-list consumers refresh
- Hover state (`eraseHoverTargetId`) computed on pointer-move when not drawing; preview ribbon shows the target stroke's OWN points array; cleared on down/leave/setTool(non-erase)/force-0
- `drawBrushCursor` 8th param `mode: 'brush' | 'pointer'` (default brush = back-compat) — pointer draws the arrow (tip at cursor, 11.5 × 18.8 units, dark outline width 3 + dark fill, white fill over-pass); both engine call sites pass `cursorGlyphMode()`; restore box widened to contain the glyph
- Full gate: 49 test files / 397 passed (3 pre-existing skips), `tsc --noEmit` clean, frozen knobs + R4 re-run green

## RED evidence (pre-change, commit `76dfa3bd`)

**5 failed | 9 passed (14 tests across the 2 new files)** against the base engine — exactly the planned target cells:

| Failing cell | Failure |
|---|---|
| CURSOR GLYPH: pointer mode draws the arrow polyline | `expected true to be false` — `arc` drawn: brush ring instead of arrow |
| CLICK-DELETE | `expected [ 1 ] to not include 1` — short stroke discarded, nothing removed |
| CLICK during drain | same — entry kept, drain never flushed by the click |
| HOVER PREVIEW (target) | `expected null to be 1` — no hover state exists |
| HOVER POINTER CURSOR (active) | `expected null to be 1` — no hover target → no pointer mode |

Guard pins passing at base (proving the probes have clicks/teeth): CLICK force 0, CLICK pixel-only, CLICK empty space, both HOVER-clear cells, HOVER scope, brush-mode cursor cell, both DRAG GUARD cells (whole-stroke + force law), CURSOR GLYPH brush mode.

## Green commands (verbatim)

```
cd /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/engine/EfxPaintEngine.erasePointerDelete.test.ts src/render/canvas.pointerCursor.test.ts src/engine/EfxPaintEngine.eraseContract.test.ts src/engine/EfxPaintEngine.pointerInput.test.ts src/engine/EfxPaintEngine.cooperativeFinalization.contract.red.test.ts src/engine/EfxPaintEngine.redrawAllQueuedFinalizations.test.ts src/core/lookLawDigest.test.ts src/brush/shapeDetail.test.ts
cd /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run
cd /Users/lmarques/Dev/efx-motion-editor && pnpm --filter efx-physic-paint run check
```

- Task 1 cells + 8 existing suites: **8 files, 113 passed** (zero Task 1 assertion edits — `git diff 76dfa3bd` on both test files is empty)
- Full package suite: **49 files, 397 passed | 3 skipped** (pre-existing skips; no test file edited outside the 2 new ones)
- Typecheck: `tsc --noEmit` clean
- Guardrail re-runs: frozen-knob literal pins **16 passed** (whiteSeamHoleWriter `DEPOSIT_KEEP_TIER=40`, `DEPOSIT_DENSITY_SCALE=4500`; wetDisplayAlpha law), R4 anti-alignment cell **passed** (`-t "R4"` → 3 passed, 13 skipped by filter)

## Guardrail scope proof

Quick base (HEAD before the first commit, recorded in `.git/gsd-plan-head-before-261003-ud9`): **`49341b5f610d4641bb5575231e35f987251645db`**

`git diff --name-only 49341b5f...HEAD`:

```
packages/efx-physic-paint/src/engine/EfxPaintEngine.erasePointerDelete.test.ts
packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
packages/efx-physic-paint/src/render/canvas.pointerCursor.test.ts
packages/efx-physic-paint/src/render/canvas.ts
```

- `app/**`, `compositor.ts`, `drying.ts`, `wet-layer.ts` diff **EMPTY** (verified with a path grep over the changed-file list)
- Frozen literals intact in production: `DEPOSIT_KEEP_TIER = 40` (wet-layer.ts:414), `DEPOSIT_DENSITY_SCALE = 4500` (:424), `PAPER_ADSORPTION_GAMMA = 0.5` (:432); `'erase-shape'` seeded stream untouched (erase.ts:71)
- No frozen-knob literal added/edited in the diff (the only textual match is the new test file's compositor mock — byte-identical to the established eraseContract harness mock)
- One-law proof: `resolveEraseTargetIds` has exactly two callers — `removeWetIntersectedStrokes` (drag line 3215 + click line 3411 paths) and `updateEraseHover` (line 3071); no dirty/refusal gate reintroduced (detection stays purely geometric)

## Task Commits

Each task committed atomically (ledger base `49341b5f`):

1. **Task 1: RED cells** - `76dfa3bd` (test) — `test(261003-ud9): RED cells for erase pointer-delete on fresh strokes`
2. **Task 2: GREEN implementation** - `01b7c163` (feat) — `feat(261003-ud9): erase pointer-delete — hover previews a fresh stroke, one click removes it`

**Plan metadata:** docs commit `docs(261003-ud9): quick summary` (this file)

## Files Created/Modified

- `packages/efx-physic-paint/src/engine/EfxPaintEngine.erasePointerDelete.test.ts` — contract of record: 12 cells (click-delete, force 0, pixel-only, empty, drain, hover preview/clear/cursor/scope, 2 drag guards)
- `packages/efx-physic-paint/src/render/canvas.pointerCursor.test.ts` — pointer arrow glyph geometry vs brush ring (recording 2D context)
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` — shared `resolveEraseTargetIds`, hover state + clear call sites, click branch in `onPointerUp`, pointer-mode cursor call sites, widened `overlayBoundsForCursor`
- `packages/efx-physic-paint/src/render/canvas.ts` — `drawBrushCursor` optional `mode` param + `strokePointerArrow` (two offset passes)

## Decisions Made

- Extract the shared detection routine rather than duplicate thresholds (plan's key_links one-law requirement)
- Flush-before-remove for drain coherence; the paint finalization's own 'paint' notification during flush is the existing pipeline's — the click cell asserts exactly one notification with `kind === 'erase'`
- Click uses the last raw sample point (up position); a miss never pixel-erases (pixel erase remains drag-only)
- Pointer glyph bounds `x0-2 / y0-2 / x1+14 / y1+21` at the cursor — contains the 11.5 × 18.8 arrow + 3px under-stroke so incremental restore never clips the tail

## Deviations from Plan

None — plan executed exactly as written (no production files beyond the plan's `files_modified`, no gate edits, no assertion edits).

**Total deviations:** 0
**Impact on plan:** none.

## Issues Encountered

Two test-harness authoring fixes inside Task 1's new test file before its RED commit (new file, allowed — production untouched):

1. `dryCanvas.getBoundingClientRect` missing from the harness mock → 13 unrelated TypeErrors. Fixed by adding the rect accessor to the harness's dryCanvas.
2. The drag helper defaulted to `pointerType: 'pen'` → `pMod = pressure 0.5` halved the D-P force mask, so the guard cell failed at base for a pressure reason, not a regression reason. Rewrote `drag()` to emit `pointerType: 'mouse'` (`pMod = 1`, matching the D-P contract shape) with an explanatory comment; the guard cell then passed at base as the plan requires.

## User Setup Required

None — no external service configuration required.

## Native UAT (pending)

- (a) With the erase tool, hovering a fresh stroke highlights exactly that stroke and the cursor becomes a pointer; moving away, off the canvas or to another tool clears both — no preview artifacts while painting or with the erase strength at 0.
- (b) A single click on a fresh stroke removes it entirely in one action — it disappears from the canvas immediately and is still gone after Save/reopen.
- (c) A click on baked/pixel paint does nothing, while dragging the eraser still erases pixels with the force slider and still whole-stroke-removes fresh strokes.
- (d) Neighbors the clicked stroke merely touches keep their entry and their paint; Undo after a click-delete behaves honestly (no resurrection, counters match).
- (e) Painting, scripted/replayed strokes and Roto script flows look and behave unchanged.

## Next Phase Readiness

- Automated gates all green; ready for live native UAT of rows (a)–(e). Never claim done before that UAT passes.
- No blockers. Nothing deferred; no stubs (see Known Stubs — none).

## Known Stubs

None — no placeholder values, empty wiring or TODO markers introduced by this plan.

## Self-Check: PASSED

- SUMMARY + all 4 changed files exist; commits `76dfa3bd` and `01b7c163` found in history
- Five native UAT rows (a)–(e) byte-identical to the plan's Task 3 text

---
*Phase: quick-261003-ud9*
*Completed: 2026-10-03*
