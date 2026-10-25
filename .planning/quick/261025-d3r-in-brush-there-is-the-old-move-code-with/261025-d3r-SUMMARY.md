---
phase: quick-261025-d3r
plan: 261025-d3r
subsystem: physics-paint-engine
tags: [cursor, move-tool, erase-hover, canvas-overlay, vitest, red-green]

# Dependency graph
requires:
  - phase: quick-261004-dn5
    provides: "Move hover target + preview ribbon and the move-hover pointing hand that this quick removes"
  - phase: quick-261003-ud9
    provides: "Erase hover pointing hand (kept verbatim)"
  - phase: quick-261023-g4p
    provides: "Host cursor hiding and the script-edition overlay that own persistent Move"
provides:
  - "One private erase-only hand predicate (pointerHandActive) consumed by both cursorGlyphMode and overlayBoundsForCursor"
  - "Move hover keeps brush mode (ring/crosshair) at every brush size while moveHoverTargetId and previewStroke stay populated"
  - "Ring-shaped cursor restore box in Move hover (41/21/59/39 at size 12, 27/7/73/53 at size 40) — no hand-shaped ghost"
affects: [physics-paint-cursor, move-tool, erase-hover, temporary-move, script-edition-overlay]

# Actuals (#2632) — chars/4 over the realized diff (f7085e24..a8cb7897), same scale as the plan estimate.
actuals:
  tokens: 1684
  tasks: 1
  commits: 1
plan_head_before: f7085e24
plan_head_after: a8cb7897

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One private predicate drives both the drawn cursor glyph and its incremental restore box, so the two can never disagree (no ghost, no clipped glyph)"

key-files:
  created: []
  modified:
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.moveTranslate.test.ts

key-decisions:
  - "The pointing hand is erase-only: pointerHandActive() returns this.eraseHoverTargetId != null and is the single source for cursorGlyphMode and overlayBoundsForCursor (D-01, D-05)"
  - "Momentary Move keeps its affordance — moveHoverTargetId and the preview ribbon are untouched; only the glyph changes (D-02)"
  - "No host-side suppression was added: the engine law covers held-Cmd, persistent Move (cursor hidden upstream), the locked passthrough and engine re-create (D-03)"
  - "The erase hover hand, its box and the erase suite are untouched (D-04)"
  - "pointerHandActive is placed immediately AFTER cursorGlyphMode so PhysicsPaintStudio.test.ts's `private cursorGlyphMode(` slice delimiter keeps its meaning"

patterns-established:
  - "Cursor contract tests pin glyph mode AND restore geometry at two brush sizes, plus a cross-check that the erase hover still yields the hand in the same file"

requirements-completed: []

coverage:
  - id: D1
    description: "Move hover yields brush mode (no pointing hand) at brush sizes 12 and 40, while moveHoverTargetId and previewStroke stay populated; restore box is the symmetric ring (41/21/59/39 then 27/7/73/53)"
    verification:
      - kind: unit
        ref: "packages/efx-physic-paint/src/engine/EfxPaintEngine.moveTranslate.test.ts#HOVER CURSOR: the pointing hand is erase-only — move hover keeps brush mode and the ring restore box"
        status: pass
    human_judgment: false
  - id: D2
    description: "Erase hover still yields the pointer hand with eraseHoverTargetId set; the untouched erase/renderer suites stay green"
    verification:
      - kind: unit
        ref: "packages/efx-physic-paint/src/engine/EfxPaintEngine.erasePointerDelete.test.ts (15 tests)"
        status: pass
      - kind: unit
        ref: "packages/efx-physic-paint/src/render/canvas.pointerCursor.test.ts (2 tests)"
        status: pass
      - kind: unit
        ref: "packages/efx-physic-paint/src/engine/EfxPaintEngine.moveTranslate.test.ts#(erase cross-check inside the reworked cursor test)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Live Studio: held-Cmd move hover and drag never draw the engine hand; persistent Move stays overlay-only; erase hover still draws the hand; no ghost trails after an engine re-create or under a physical mutation lock"
    verification:
      - kind: human
        ref: "Live Studio UAT — 6 native rows (261025-d3r-PLAN.md)"
        status: pending
    human_judgment: true
    rationale: "Cursor glyph visibility, momentary Cmd key-down routing and WKWebView rendering are native-surface judgments vitest cannot observe."

# Metrics
duration: 4min
completed: 2026-10-25
status: complete
---

# Quick 261025-d3r: Erase-only pointing hand Summary

**The engine's pointing-hand cursor is now erase-only — Move mode (held-Cmd momentary, persistent overlay, or post-re-create) keeps the ring/crosshair with its matching restore box while the preview ribbon and script-edition overlay carry the Move affordance**

## Performance

- **Duration:** 4 min
- **Started:** 2026-10-25T08:34:00Z
- **Completed:** 2026-10-25T08:37:30Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Added `pointerHandActive()` (erase hover only) in `EfxPaintEngine` and made it the single predicate behind both `cursorGlyphMode()` and `overlayBoundsForCursor()` — the glyph and its incremental restore box can no longer disagree.
- Removed the legacy Move hand: a move hover now yields `'brush'` from `drawBrushCursor` while `moveHoverTargetId` and `previewStroke` stay populated — the preview ribbon remains the momentary-Move affordance.
- Restore box in move hover is the symmetric ring: 41/21/59/39 at brush size 12 (half-size 9) and 27/7/73/53 at brush size 40 (half-size 23), versus the old asymmetric hand box 40/27/69/64.
- Erase hover is unchanged: `eraseHoverTargetId` still set, last glyph mode still `'pointer'`.
- Updated the stale `moveHoverTargetId` field comment and the cursor/box doc comments to the new law; no Studio, temporary-move, overlay or renderer file was touched.

## TDD Gate Compliance

- **RED (before the engine edit):** the reworked cursor test failed on the mode assertion — `AssertionError: expected 'pointer' to be 'brush'` (file: 25 tests | 1 failed, 24 passed).
- **RED (restore-box evidence):** a temporary assertion reorder (reverted before the engine edit) captured the old hand box — `expected [ 40, 27, 69, 64 ] to deeply equal [ 41, 21, 59, 39 ]` (asymmetric -10/+19 on x, -3/+34 on y).
- **GREEN (after the engine edit):** `EfxPaintEngine.moveTranslate.test.ts` — 25/25 passed.

## Task Commits

Each task was committed atomically:

1. **Task 1: Erase-only hand predicate + reworked move-cursor contract** - `a8cb7897` (fix)

## Files Created/Modified
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` — added `pointerHandActive()` immediately after `cursorGlyphMode()`; both cursor methods now consume it; `overlayBoundsForCursor` falls through to the ring box in move hover; stale `moveHoverTargetId` comment updated.
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.moveTranslate.test.ts` — header contract bullet replaced; move-cursor test renamed and reworked to pin brush mode + ring box at sizes 12 and 40 + the erase-hand cross-check; sibling test renamed to drop the POINTER wording with assertions unchanged.

## Decisions Made
- Followed D-01..D-05 exactly: no Move hand, held-Cmd preserved, persistent overlay untouched, erase hand retained, engine as the single source (no host suppression).
- Placed `pointerHandActive` after `cursorGlyphMode` to preserve the `PhysicsPaintStudio.test.ts` source-slice delimiter.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- None. The RED restore-box value was captured with a temporary assertion reorder on the reworked test; the order was restored to the plan's form before the engine edit.
- STATE.md / ROADMAP.md were intentionally left untouched: the orchestrator owns the docs commit for this quick task.

## Known Stubs
None.

## Threat Flags
None — the change is local cursor rendering only; no new endpoint, auth path, file access or schema surface.

## UAT

Native UAT is **pending** (user-driven, live Studio):

| # | Action | Expected |
|---|--------|----------|
| 1 | Brush module, Paint selected; hold Cmd and hover a painted script stroke | No pointing hand; cursor stays ring/crosshair; hovered stroke shows its preview ribbon |
| 2 | Still holding Cmd, drag the stroke, then release drag and Cmd | Stroke moves rigidly, tool returns to Paint, no hand ever appears |
| 3 | Cmd tap (or rail Move) for persistent Move, then hover strokes | Script-edition overlay is the only Move surface; no engine hand or ring |
| 4 | Switch to Erase and hover a stroke | Pointing hand still appears with the red erase preview (unchanged) |
| 5 | With persistent Move selected, force an engine re-create (canvas size in Tools, or Water color → Brush), then hover | No hand; overlay remains the visible surface |
| 6 | With a physical mutation lock active (playback running), press rail Move or tap Cmd | Move is not entered and no hand appears; after the lock clears Move works normally |

## UAT revision 1 — pointer finger on hittable strokes (2026-10-25)

User follow-up: "c'est possible d'avoir le pointer finger when I hover on a stroke so I see if I can click ?"

- The shared `ScriptStrokeOverlay` hover handler now hit-tests the stroke under the pointer: a hittable stroke sets `cursor: pointer`, empty canvas keeps `default`. Transform handles keep their axis/grab cursors and still win over the stroke test. One surface, so Brush Move and Water color Select both get it.
- The old engine hand stays removed — this is a deliberate overlay affordance for click-to-select, not the legacy 261004-dn5 cursor.
- Commit: `f2d7a346`.
- Gate: `PhysicsPaintStudio.test.ts` 278/278 (new source pin included); app typecheck clean. The engine package is unchanged by this revision.
- Added UAT row: with persistent Move (or Water color Select), hover a stroke → pointer finger; empty canvas → arrow; scale/rotate handle → its axis/grab cursor.

## UAT revision 2 — deselect on a canvas-region background click (2026-10-25)

User follow-up: "is it possible to click outside canvas to deselect, actually click outside a stroke deselect but when canvas are full of stroke its difficult to deselect with a click"

- A plain left click on the dark workspace around the canvas sheet now clears the Move/Select selection (`PhysicsPaintStudioView` region pointerdown + `view/scriptSelectionDeselect.ts`).
- Scope guards: the canvas sheet keeps the overlay's own hit/empty-click law; the Stroke Settings dialog (`[role="dialog"]`) and the full-area gallery pickers keep the selection because their clicks operate ON it; Cmd/Ctrl/Shift clicks keep the set (the overlay's additive-empty law); non-primary buttons are ignored.
- Applies to Brush Move and Water color Select (one shared surface).
- Commit: `0df26296`.
- Gate: `scriptSelectionDeselect.test.ts` 4/4, `PhysicsPaintStudio.test.ts` 279/279, app typecheck clean.
- Added UAT rows: full-canvas Move → click the dark margin → deselect; Cmd-click the margin → keep; click inside the Stroke Settings dialog → keep; click a stroke/empty canvas → overlay law unchanged.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Automated verification is green:

- `pnpm --filter @efxlab/efx-physic-paint build` → success.
- `pnpm --filter efx-motion-editor exec vitest run --root ../packages/efx-physic-paint src/engine/EfxPaintEngine.moveTranslate.test.ts src/engine/EfxPaintEngine.erasePointerDelete.test.ts src/render/canvas.pointerCursor.test.ts` → 3 files, 42 tests passed.
- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts` → 277 tests passed.
- `pnpm --filter @efxlab/efx-physic-paint run check` → clean.
- `pnpm --filter efx-motion-editor run typecheck` → clean.

Remaining gate: the 6 native UAT rows above (user's live Studio run).

## Self-Check: PASSED

- `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` — FOUND
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.moveTranslate.test.ts` — FOUND
- Commit `a8cb7897` — ancestor of HEAD
