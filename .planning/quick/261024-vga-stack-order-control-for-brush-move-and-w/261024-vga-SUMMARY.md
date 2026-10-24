---
phase: quick-261024-vga
plan: 261024-vga
subsystem: ui
tags: [preact, signals, physic-paint, brush, watercolor, stack-order, vitest]

requires:
  - phase: quick-261024-p5q
    provides: shared Stroke Settings dialog bundle and its appearance/move/transform members
  - phase: quick-261024-mz5
    provides: multi-stroke selection and batch engine/port edit paths
  - phase: quick-261022-ujp
    provides: aquarelle payload-timeline stack step and recording-slot trade law

provides:
  - ONE stack-position law in the engine package, re-exported to the app
  - Stack section in the shared Stroke Settings dialog for Brush Move and Water color Select
  - engine moveStrokeToStackPosition exact placement
  - brush port placeBrushScriptStroke
  - watercolor placeAquarelleStrokeInScript, beginAquarellePlaceEdit and Studio handleAquarellePlaceStroke

affects: [physic-paint-stroke-settings, brush-stroke-stack, watercolor-script-stack]

actuals:
  tokens: 20329
  tasks: 3
  commits: 3
  plan_head_before: c7fc192fcc7bf63d1e2a04115651bc53395916b6
  plan_head_after: 475a38168afca9d36182465c71aa79afa7d34812

tech-stack:
  added: []
  patterns:
    - "Bottom -> top arrays with public position 1 = topmost, total = bottom (total - clamped(position))"
    - "Group boundary shared with the dialog listing: every points-bearing live entry starts a row; zero-point entries are continuations"
    - "Ref-held nonce signal used as a Preact key to remount a SliderStepper after a commit; ref-held last-emitted value cleared on a microtask to collapse Enter+blur"
    - "Watercolor placement re-stamps only the travelled window's recording slots to keep the bake's settle clock monotonic"

key-files:
  created:
    - packages/efx-physic-paint/src/engine/stackOrder.ts
    - app/src/components/physic-paint/view/stackOrder.ts
    - app/src/components/physic-paint/view/stackOrder.test.ts
  modified:
    - packages/efx-physic-paint/src/index.ts
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.strokeReorder.test.ts
    - app/src/components/physic-paint/view/strokeSettingsModel.ts
    - app/src/components/physic-paint/view/strokeSettingsModel.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
    - app/src/components/physic-paint/view/brushScriptEditionPort.ts
    - app/src/components/physic-paint/view/brushScriptEditionPort.test.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.reorder.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "The index law lives once in the engine package; the app re-exports it, so no adapter re-derives the clamp/remove/insert math."
  - "Erase strokes are their own Stack row (every points-bearing entry starts a group), matching the dialog listing; leading zero-point entries stay pinned and are never counted."
  - "A refused or accepted Stack commit re-keys the position stepper so the input remounts at the live readout; the same-tick Enter+blur pair collapses to one reorder via a microtask-cleared last-emitted value."
  - "Watercolor placement replaces entries (never mutates them) and rewrites recording slots only across the travelled window, preserving Dry events and other frames byte-identically."

patterns-established:
  - "Stack placement: dialog -> bundle.reorderStroke -> adapter -> engine/timeline reorder -> one flush/re-bake -> revision bump -> dialog re-reads listStrokes"
  - "Per-gesture commit coalescing with a ref-held value plus queueMicrotask; remount-based input resync with a ref-held signal key"

requirements-completed: []

coverage:
  - id: D1
    description: "Shared stack-position law (clamp, target index, reorder with same-reference no-op) plus the Stack section in the shared Stroke Settings dialog with position stepper, dot/serial, Above/Below, Top/Bottom and the multi-select disabled hint."
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/stackOrder.test.ts (7 tests); app/src/components/physic-paint/view/strokeSettingsModel.test.ts (59 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Brush exact placement end-to-end: engine.moveStrokeToStackPosition under the Move commit contract, brush port placeBrushScriptStroke, brush dialog bundle wiring."
    verification:
      - kind: unit
        ref: "packages/efx-physic-paint/src/engine/EfxPaintEngine.strokeReorder.test.ts (29 tests); app/src/components/physic-paint/view/brushScriptEditionPort.test.ts (30 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Water color exact placement end-to-end: placeAquarelleStrokeInScript, beginAquarellePlaceEdit, Studio handleAquarellePlaceStroke with shared Apply/rollback, watercolor dialog bundle and memo dependency."
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleRecordState.reorder.test.ts (16 tests); app/src/components/physic-paint/PhysicsPaintStudio.test.ts (264 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Native UAT: visible Stack section on both modules, live re-bake ordering, gesture coalescing, refused-commit input snap-back, undo/redo as one edit, save/reopen persistence, physical-lock refusal."
    verification: []
    human_judgment: true
    rationale: "Native Tauri/webview behaviour and visual parity with the Move badge cannot be proven by static or unit tests; the user runs live UAT."

duration: ~25 min
completed: 2026-10-24
status: complete
---

# Quick 261024-vga: Stack-order control for Brush Move and Water color Select Summary

**Exact paint-order placement: one shared stack-position law, a Stack section in the shared Stroke Settings dialog, and end-to-end brush-engine and watercolor-timeline placement with single-edit undo.**

## Performance

- **Duration:** ~25 min (exact start time was not persisted across a context compaction; derived from the task commit timeline)
- **Started:** 2026-10-24 (session)
- **Completed:** 2026-10-24T22:08Z
- **Tasks:** 3/3
- **Files modified:** 16 (13 modified, 3 created)

## Accomplishments

- One index implementation (`packages/efx-physic-paint/src/engine/stackOrder.ts`) consumed by the engine and both app adapters, with `readonly T[]` in and out so the unchanged case returns the same reference.
- The shared Stroke Settings dialog renders the Stack section for Brush Move and Water color Select: colour dot, `#serial`, `position/total`, a release-commit position stepper, Above/Below rows with em-dash edges, Top/Bottom, and a disabled hint for multi-selection.
- Brush: `moveStrokeToStackPosition` moves the `strokeStack` projection in one commit under the existing Move contract (drained finalizations, cleared redo, one 'move' notification, ledger untouched), with erase strokes as their own rows and leading zero-point entries pinned; `placeBrushScriptStroke` adds the lock-gated port path with one flush.
- Water color: `placeAquarelleStrokeInScript` reorders the payload timeline's same-frame entries and re-stamps recording slots across the travelled window only; `beginAquarellePlaceEdit` stores one ledger command; the Studio handler reuses the step handler's peek-only guards, sheet reset, shared Apply and rollback path.
- Gesture discipline: the Enter+blur pair collapses to one `reorderStroke` call, and every commit attempt re-keys the stepper so a refused placement remounts the input at the live position.

## Task Commits

Each task was committed atomically:

1. **Task 1: The shared stack-position law and the Stack section for both modules** - `8d8bded5` (feat)
2. **Task 2: Brush end-to-end — engine moveStrokeToStackPosition, port placement and the brush bundle** - `380c5ca0` (feat)
3. **Task 3: Water color end-to-end — script placement, snapshot edit, Studio handler and live wiring** - `475a3816` (feat)

**Plan metadata:** not committed by this executor (orchestrator owns the docs commit).

_Measured from the plan ledger (`gsd-plan-head-before-261024-vga` = `c7fc192f`): 3 commits, HEAD after = `475a3816`._

## TDD Evidence

| Task | RED | GREEN |
| ---- | --- | ----- |
| 1 | stackOrder.test.ts + strokeSettingsModel.test.ts failed before implementation (missing `./stackOrder`, absent Stack section) — 12 failed / 47 passed | stackOrder 7/7, strokeSettingsModel 59/59, package build + typecheck clean |
| 2 | engine and port suites failed against the missing method/export before implementation | engine 29/29, port 30/30, package build + typecheck clean |
| 3 | aquarelle record suite failed at collection (missing exports) and 3 Studio pins failed; 4 failed / 260 passed | record suite 16/16, Studio 264/264; five-suite gate 376/376; typecheck clean |

## Full Gate Output

- `pnpm --dir packages/efx-physic-paint build` — ESM + DTS build success.
- Five app suites (`stackOrder`, `strokeSettingsModel`, `brushScriptEditionPort`, `aquarelleRecordState.reorder`, `PhysicsPaintStudio`) — 5 files, 376 tests passed.
- Engine suite (`EfxPaintEngine.strokeReorder.test.ts`) — 29 tests passed.
- `pnpm --dir app typecheck` — clean.

## Files Created/Modified

- `packages/efx-physic-paint/src/engine/stackOrder.ts` — created; the ONE clamp/target/reorder law.
- `packages/efx-physic-paint/src/index.ts` — exports the law and its result type.
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` — `moveStrokeToStackPosition` + stackOrder import.
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.strokeReorder.test.ts` — 12 exact-placement cells.
- `app/src/components/physic-paint/view/stackOrder.ts` — created; app-facing re-export.
- `app/src/components/physic-paint/view/stackOrder.test.ts` — created; 7-cell truth table.
- `app/src/components/physic-paint/view/strokeSettingsModel.ts` — optional `reorderStroke` bundle member.
- `app/src/components/physic-paint/view/strokeSettingsModel.test.ts` — Stack describe (12 cells) + revised pre-existing slider assertion.
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` — Stack section, ref-held nonce re-key, last-emitted coalescing.
- `app/src/components/physic-paint/view/brushScriptEditionPort.ts` — engine member + `placeBrushScriptStroke`.
- `app/src/components/physic-paint/view/brushScriptEditionPort.test.ts` — lock/accepted/refused/no-context cells.
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` — `placeAquarelleStrokeInScript`.
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` — `beginAquarellePlaceEdit`.
- `app/src/components/physic-paint/view/aquarelleRecordState.reorder.test.ts` — 7 placement cells.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — `handleAquarellePlaceStroke`, brush and watercolor bundle members, memo dep.
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — watercolor wiring pins + two pre-existing count pins updated.

## Decisions Made

- The ONE law lives in the engine package (the package cannot import app code); the app re-exports it through `dist`.
- Group rows follow the dialog listing exactly: every live points-bearing entry (paint OR erase) starts a row; zero-point entries follow their primary; leading zero-point entries are pinned and not counted.
- The dialog never stores stroke data: the only added signal is a ref-held sync nonce; all readouts derive from one hoisted `bundle.listStrokes` read.
- Watercolor placement keeps Dry events and other-frame entries object-identical at their absolute indices and never reorders the registry Map.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's illustrative erase-row expectation contradicted the locked group law**
- **Found during:** Task 2 (engine suite)
- **Issue:** The plan bullet says ledger `[A(paint), X(erase), B(paint)]` with `moveStrokeToStackPosition(A, 1)` yields `[B, A, X]`. Under the authoritative boundary (X is its own points-bearing row, position 1 = topmost) the correct result is `[X, B, A]`.
- **Fix:** Implemented the law-consistent grouping and pinned `[X, B, A]`; X remains a separate row and A reads position 1.
- **Files modified:** `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts`, `packages/efx-physic-paint/src/engine/EfxPaintEngine.strokeReorder.test.ts`
- **Verification:** engine suite 29/29.
- **Committed in:** `380c5ca0`

**2. [Rule 1 - Bug] Pre-existing brush flush-site count pinned 5, new port path is the sixth flush**
- **Found during:** Task 3 RED gate (`PhysicsPaintStudio.test.ts` regressed from the Task 2 commit)
- **Issue:** `keeps the brush port peek-only and lock-gated` asserted exactly 5 `resolvePaintSettings(resolved.engine),` occurrences; `placeBrushScriptStroke` added a sixth.
- **Fix:** Raised the pin to 6 with a `261024-vga` comment.
- **Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- **Verification:** Studio suite 264/264.
- **Committed in:** `475a3816`

**3. [Rule 1 - Bug] Pre-existing refusal-mapper count pinned 9, the new handler is the tenth mention**
- **Found during:** Task 3 GREEN gate
- **Issue:** The quick-260922-al1 pin expected one import + eight call sites; `handleAquarellePlaceStroke` reuses the same mapper and capsule.
- **Fix:** Raised the pin to 10 with a comment; no second import or refusal surface.
- **Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- **Verification:** Studio suite 264/264.
- **Committed in:** `475a3816`

**4. [Authorized revision] Pre-existing `allowOutOfRangeEntry` count scoped away from the Stack stepper**
- **Found during:** Task 1 Step 6 (explicitly authorized by the plan)
- **Issue:** The old assertion required 8/8 sliders to pass `allowOutOfRangeEntry`; the Stack stepper deliberately clamps instead.
- **Fix:** Assertion scoped to pre-existing sliders (`sliders.length - 1`) with a comment; the Stack cell still asserts the prop is absent.
- **Files modified:** `app/src/components/physic-paint/view/strokeSettingsModel.test.ts`
- **Verification:** strokeSettingsModel 59/59.
- **Committed in:** `8d8bded5`

### Test-correction issues during GREEN (no production-code change)

- Task 2: the save/load cell originally asked for a no-op position; corrected to the bottom row. The drain cell assumed the fresh stroke was not already top; corrected to position 3.
- Task 3: the record-state suite reused ids already deleted/recorded by earlier suites in the same module (`9301` is deleted by an earlier test), so frame 703 switched to fresh ids; `9502` was already its frame's top row, so the move target became position 2; the same-position/clamp refusals were re-pointed at the actual top (`9801`) and bottom (`9802`) rows; invalid numeric literals (`9B01`) were replaced with valid ids.

**Total deviations:** 4 auto-fixed/authorized (3 assertion corrections, 1 plan-illustration correction) plus test-authoring corrections confined to the same task commits.
**Impact on plan:** No scope creep and no production behaviour beyond the plan; every correction was required for the truth tables to describe the locked law.

## Issues Encountered

- Task 3's RED gate exposed that two pre-existing Studio count pins encode the exact number of flush sites / refusal sites; both were updated as above.
- The package must be rebuilt before app gates that consume `stackOrder`; `dist/` stayed uncommitted.

## Known Stubs

None.

## Threat Flags

None — the plan's threat model (local in-memory UI, no new dependency) held; no new network, auth, file or persisted surface was introduced.

## Auth Gates

None.

## User Setup Required

None — no external service configuration required.

## UAT Revision

**2026-10-25 — tabbed dialog (commit `27580c79`):** the three sections moved onto ONE pinned tab row (`Geometry | Stack | Paint`), Geometry is the default tab, and the color readout moved into Paint. Tab state is a ref-held signal (no useState, no render-body write). Automated gates re-run after the change: five app suites 378/378 and `tsc --noEmit` clean. The VERIFICATION.md covered digest predates this revision, so its status is stale until the next verifier run; the native UAT checklist above still applies.

## Next Phase Readiness

- Automated gates are green and the feature is code-complete. Native UAT is still required before calling it done: both modules' Stack section, live re-bake ordering, Enter/blur coalescing, refused-commit input snap-back, undo/redo as one edit, save/reopen persistence, and physical-lock refusal.
- The unrelated pre-existing `app/src/components/project/WelcomeScreen.tsx` modification was never touched, staged or committed.

---
*Quick: 261024-vga*
*Completed: 2026-10-24*

## Self-Check: PASSED
