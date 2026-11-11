---
phase: 261111-ucf-brush-picks-and-paint-controls-edit-the-
plan: 01
subsystem: Physic Paint Studio — brush picks and paint-control releases routed onto the selected strokes
tags: [preact, signals, aquarelle, selection-edit-port, paint-controls, slider-release, undo, tdd]

requires:
  - phase: quick-261111-t74
    provides: the selection edit port (setAquarelleSelectionEditPort, peek-only aquarelleSelectionEditActive, commitAquarelleSelectionAppearance) and ScriptStrokeAppearancePatch
  - phase: quick-261111-tul
    provides: SliderStepper onCommit — the gesture release boundary every paint control now uses

provides:
  - "aquarellePaintControls with pickAquarelleBrush, commitAquarelleSelectionParam, commitAquarelleSelectionParams and commitAquarelleSelectionMultiplier — the ONE selection seam every pick surface and paint control calls"
  - "optional filter on commitAquarelleSelectionAppearance: forwards only ids matching the live stroke type filter and returns null when none remain"
  - "all four brush pick surfaces (top-bar dropdown, library card, docker row, import-success) routed through pickAquarelleBrush; eraser branches keep setAquarelleLiftTipId and commit nothing"
  - "release commits on five top-bar brush sliders, the Paint-tab size pair, the seven global rows and the eight Brush response rows; Reset leaves ONE seven-key params patch"

affects: [Phase 61 brush controls, any future selection-scoped paint control, Studio selection editing UAT]

actuals:
  tokens: 14127
  tasks: 3
  commits: 3

plan_head_before: b0993666b30af56c672b68f479b9a25f747d1ff9
plan_head_after: 73d704c1d182f54f58ccaa0f264f98eb501d5527

tech-stack:
  added: []
  patterns:
    - "One paint-controls module: every pick surface and every release boundary calls the same four functions, so the filter:'paint' law, the snapshot bag and the no-selection no-op cannot drift per caller"
    - "Live first, commit second: pickAquarelleBrush calls selectAquarelleTip, then commits { brushId, toolOverrides: { ...aquarelleToolOverrides.peek() } } so the patch carries the POST-pick bag (a returning brush keeps its own response)"
    - "The live setter stays the caller's job; the commit helper only mirrors the release value into the selection (onChange remains the continuous stream and never commits)"

key-files:
  created:
    - app/src/components/physic-paint/view/aquarellePaintControls.ts
    - app/src/components/physic-paint/view/aquarellePaintControls.test.ts
  modified:
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
    - app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx
    - app/src/components/physic-paint/view/PhysicsPaintBrushMenu.test.ts
    - app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx
    - app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts
    - app/src/components/physic-paint/view/BrushesDocker.tsx
    - app/src/components/physic-paint/view/BrushesDocker.test.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts
    - app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx
    - app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
    - app/src/components/physic-paint/view/BrushResponsePanel.tsx
    - app/src/components/physic-paint/view/BrushResponsePanel.test.ts

key-decisions:
  - "pickAquarelleBrush returns the port promise (or null), so the import-success site can fire-and-forget while the fixture tests can await the seam"
  - "commitAquarelleSelectionParams refuses an empty batch before touching the port, and Reset maps DEFAULT_PARAMS ×100 through the existing live writes first, so Reset is at most one undo entry and no selection is a no-op"
  - "WatercolorBrushLibrary disarms Select mode only when no selection is armed — an armed selection must survive the pick or the disarm would clear what the pick is about to edit (WR-03 preserved)"
  - "commitAquarelleSelectionMultiplier clamps to MULTIPLIER_MIN/MAX and drops non-finite values, mirroring setAquarelleMultiplier's law so the release path can never send the record door an illegal multiplier"
  - "The Eraser cluster keeps its shipped controls: no onCommit on physics-lift-size or physics-lift-strength, and the lift branch of the dropdown never calls the pick helper"

patterns-established:
  - "Source pins use stripComments + one-occurrence counts per surface (one passthrough, one commit call, one import), so a future second wiring path fails loudly"
  - "Behavior fixtures register a fake port and assert call count, filtered ids and patch shape per release; the materialized panels use source pins because their harness expands SliderStepper away"

requirements-completed: [QUICK-261111-UCF]

coverage:
  - id: D1
    description: "Every brush pick surface (top-bar dropdown, library card, docker row, import-success) routes through pickAquarelleBrush: live pick behaviour unchanged, only paint ids committed after a mixed or lift-only selection, post-pick multiplier bag, no port with Select mode off or an empty selection"
    requirement: "QUICK-261111-UCF"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarellePaintControls.test.ts#commits the picked id and the POST-pick bag to the selected paint strokes"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarellePaintControls.test.ts#captures the bag as a snapshot — a later bag write cannot rewrite the patch"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarellePaintControls.test.ts#forwards only the paint ids of a mixed selection"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarellePaintControls.test.ts#a lift-only selection is a no-attempt no-op while the live brush still changes"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts#keeps Select mode and the selection, then commits the picked id + live bag"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/BrushesDocker.test.tsx#a row pick keeps the armed selection and commits the picked id + live bag"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintBrushMenu.test.ts#routes the brush branch through the paint-control seam and never the lift branch"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every paint-control release (five top-bar brush sliders, Paint-tab size, seven global rows, eight Brush response rows) commits exactly one params or clamped-multiplier patch at the release boundary; Reset leaves ONE seven-key batch; the Eraser cluster never commits"
    requirement: "QUICK-261111-UCF"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts#each brush slider commits its mapped key exactly once, and only on release"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts#the Eraser cluster never commits a paint param"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts#onCommit forwards one size patch and onChange still calls the live handler"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts#Reset commits ONE seven-key params patch after the seven live writes"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarellePaintControls.test.ts#commits one params patch and leaves the live bag to the caller"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarellePaintControls.test.ts#clamps into the band and leaves the live bag untouched"
        status: pass
      - kind: unit
        ref: "pnpm --filter efx-motion-editor run typecheck && pnpm --filter efx-motion-editor exec vitest run (426 files passed | 2 skipped, 8916 tests passed | 1 skipped | 96 todo)"
        status: pass
    human_judgment: false
  - id: D3
    description: "In the running Studio, picking a brush or releasing a paint slider with an armed selection visibly rewrites the selected paint strokes as ONE undo entry and one revision bump; lift strokes never change"
    requirement: "QUICK-261111-UCF"
    verification: []
    human_judgment: true
    rationale: "The fixtures use a registered fake port; the live one-ledger-edit, one-undo, one-seed-re-roll result through the Studio port path needs a visible UAT row (project law: automated-ready until live UAT passes)."

duration: 15min
completed: 2026-11-11
status: complete
---

# Quick 261111-ucf: Brush picks and paint-control releases edit the selected strokes

**One paint-controls seam routes all four brush pick surfaces and every slider release through the t74 appearance door, committing only selected paint strokes with one undo entry — while the live brush and slider behaviour stays byte-identical.**

## Performance

- **Duration:** ~15 min (2026-11-11 22:06 → 22:21 local)
- **Started:** 2026-11-11T21:06:00Z (approx)
- **Completed:** 2026-11-11T21:21:19Z
- **Tasks:** 3/3
- **Files modified:** 17 (2 created, 15 modified)

## Accomplishments

- New `aquarellePaintControls.ts` is the single selection seam: `pickAquarelleBrush`, `commitAquarelleSelectionParam`, `commitAquarelleSelectionParams`, `commitAquarelleSelectionMultiplier` — all riding `filter: 'paint'` so lift strokes are never addressed.
- `commitAquarelleSelectionAppearance` gained an optional `filter`, resolving selected ids against the live stroke map and returning `null` when no id matches.
- All four pick surfaces wired: top-bar dropdown brush branch, library BrushCard (armed selection survives the pick — WR-03), docker rows and the import-success pick; every eraser branch still calls `setAquarelleLiftTipId` and commits nothing.
- Release commits landed on the five top-bar brush sliders, the Paint-tab size pair, the seven global rows and the eight Brush response rows; Globals Reset sends ONE seven-key params patch after its seven live writes.
- Gate: typecheck clean; four targeted suites 97/97; full app suite 426 files passed | 2 skipped, 8916 tests passed | 1 skipped | 96 todo.

## Task Commits

1. **Task 1 (tracer): paint-control seam + top-bar brush pick** — `d688bd1b0` (feat)
2. **Task 2: library cards and docker rows through the seam** — `6ca29279d` (feat)
3. **Task 3: paint-control release commits** — `73d704c1d` (feat)

**Plan metadata:** not committed by instruction (docs artifacts stay out of the task history).

_Measured from the commit ledger: 3 commits between `b0993666b` (plan head) and `73d704c1d`._

## TDD Evidence

- **Task 1 RED:** `.red-evidence/t1/red-record.json` — `RED_EVIDENCE_OK`; target `pickAquarelleBrush — live pick first, selection commit second > commits the picked id and the POST-pick bag to the selected paint strokes`.
- **Task 2 RED:** `.red-evidence/t2/red-record.json` — `RED_EVIDENCE_OK`; target `quick 261111-ucf library card picks edit the armed selection > keeps Select mode and the selection, then commits the picked id + live bag`.
- **Task 3 RED:** `.red-evidence/t3/red-record.json` — `RED_EVIDENCE_OK`; target `quick 261111-ucf top-bar slider release commits > each brush slider commits its mapped key exactly once, and only on release` (6 failed | 91 passed at RED).
- **GREEN:** every targeted suite and the full app suite pass; no assertion was weakened to get there.

## Files Created/Modified

- `app/src/components/physic-paint/view/aquarellePaintControls.ts` (created) — the four seam functions and the `PAINT_ONLY` filter law.
- `app/src/components/physic-paint/view/aquarellePaintControls.test.ts` (created) — 10 behavior fixtures (ids 10601-10612) for pick order, snapshot bag, paint-only filtering, no-attempt laws, patch shapes, clamp.
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` — optional `filter` on `commitAquarelleSelectionAppearance`; resolves ids against `getRecordedAquarelleStrokeEntries()` and returns null when none remain.
- `app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx` / `.test.ts` — brush branch through `pickAquarelleBrush`; lift branch unchanged; source pins.
- `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx` / `.test.ts` — conditional Select-mode disarm plus the pick; armed-selection behavior test (10651).
- `app/src/components/physic-paint/view/BrushesDocker.tsx` / `.test.tsx` — TipRow + import-success through the pick; behavior test (10661) and two-call source pin.
- `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx` / `.test.ts` — `TopBarSlider` onCommit passthrough (clamped; undefined stays undefined) and five mapped commits; five-slider release test (10701), Eraser silence test, source pins.
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` / `.test.ts` — Paint-tab size release commit (10711).
- `app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx` / `.test.ts` — per-row commits plus the ONE Reset batch (10721) and source pins.
- `app/src/components/physic-paint/view/BrushResponsePanel.tsx` / `.test.ts` — per-row multiplier commit passthrough and source pins.

## Decisions Made

- Pick returns the port promise so the import-success call can fire-and-forget while fixtures await it.
- Reset live-writes first, then commits the batch, so the visible value and the selection agree and Reset costs at most one undo entry.
- The multiplier commit clamps and rejects non-finite values, mirroring `setAquarelleMultiplier`, rather than trusting every caller.
- The Eraser cluster and lift dropdown branch are deliberately left without commits — paint controls must never address lift strokes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Non-finite guard in `commitAquarelleSelectionMultiplier`**
- **Found during:** Task 1 (paint-control seam)
- **Issue:** The plan's helper forwarded the raw value; a non-finite release value would reach the record door (which refuses it and returns false) instead of matching the live setter's silent-drop law.
- **Fix:** Added `if (!Number.isFinite(value)) return null;` before the clamp, mirroring `setAquarelleMultiplier`.
- **Files modified:** `app/src/components/physic-paint/view/aquarellePaintControls.ts`
- **Verification:** Covered by the clamp behavior test; typecheck and suites green.
- **Committed in:** `d688bd1b0` (Task 1 commit)

**2. [Rule 3 - Blocking] Array.prototype.at is outside the app tsconfig lib**
- **Found during:** Task 3 gate (typecheck)
- **Issue:** The new top-bar test used `calls.at(-1)!`; `app/tsconfig.json`'s lib target does not include `Array.prototype.at` (TS2550), so typecheck failed even though the suite passed.
- **Fix:** Replaced with `calls[calls.length - 1]!`; no test intent changed.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts`
- **Verification:** Typecheck clean and the same test passes.
- **Committed in:** `73d704c1d` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both keep the new paths' laws identical to the shipped ones. No scope creep.

## Issues Encountered

- **Task 1 RED collection:** a test importing a not-yet-existing module fails at collection, which the classifier reports as INVALID_RED. Wrote a temporary compile-only stub of `aquarellePaintControls.ts` for the RED run, then replaced it with the real implementation at GREEN. Shipped code is exactly as planned.
- **Task 2 RED collection:** the new describe used `afterEach` without importing it, erroring the whole file at collection. Added the import and re-ran; the second run produced genuine assertion failures and a valid RED record.
- **Task 3 record authoring:** an inline `node -e` with escaped single quotes broke zsh quoting; rebuilt the `actual` field as a JS template literal, then the record wrote and validated as `RED_EVIDENCE_OK`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Automated-ready: the seam, all pick surfaces and all release boundaries are wired and pinned.
- Pending visible UAT: with a selection armed, a brush pick or slider release should rewrite the selected paint strokes as one undo entry, and lift strokes must stay untouched.
- No Studio edit, no record-state change, no engine/compositor/`.mce` change.

---
*Quick: 261111-ucf*
*Completed: 2026-11-11*

## Self-Check: PASSED

- `app/src/components/physic-paint/view/aquarellePaintControls.ts` — FOUND
- `app/src/components/physic-paint/view/aquarellePaintControls.test.ts` — FOUND
- `.planning/quick/261111-ucf-brush-picks-and-paint-controls-edit-the-/261111-ucf-SUMMARY.md` — FOUND
- Commit `d688bd1b0` — FOUND
- Commit `6ca29279d` — FOUND
- Commit `73d704c1d` — FOUND
