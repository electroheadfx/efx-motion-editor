---
phase: quick-261024-mz5
plan: 261024-mz5
subsystem: ui
tags: [preact-signals, physics-paint-studio, watercolor, script-edition, multi-select, transform, tdd]

# Dependency graph
requires:
  - phase: quick-261023-g4p
    provides: the ONE shared script-edition seam (scriptStrokeEdition + ScriptStrokeOverlay) and the brush/watercolor adapters
  - phase: quick-261022-pim
    provides: the watercolor record-state script edits and the before/after snapshot ledger
  - phase: quick-261022-tv1
    provides: the watercolor move edit (one snapshot + one re-bake)
provides:
  - Set-based multi-stroke selection shared by Brush Move and Water color select
  - Batch move/delete in one engine commit (brush) and one script edit (watercolor)
  - Uniform corner scale + top rotate handle with live ghost preview
  - EfxPaintEngine.transformStrokes (points-only, Move commit law)
  - aquarelleEnginePixelToUv absolute pixel→UV bridge inverse
  - transformAquarelleStrokesInScript (UV-space, points-only, same indexes)
affects: [physics-paint-studio, watercolor-script, roto-script, inline-editor-reference]

# Actuals (#2632) — chars/4 over the realized diff (git diff base..HEAD), not a harness count.
actuals:
  tokens: 54985
  tasks: 3
  commits: 6

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Selection set + preview signal written only in pointer handlers; narrow-leaf reads"
    - "Batch edit = one commit per gesture (engine commit OR snapshot edit), one flush/re-bake"
    - "Pure transform geometry module consumed by preview and commit alike"

key-files:
  created:
    - app/src/components/physic-paint/view/scriptStrokeTransform.ts
    - app/src/components/physic-paint/view/scriptStrokeTransform.test.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.transform.test.ts
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.strokeTransform.test.ts
  modified:
    - app/src/components/physic-paint/view/scriptStrokeEdition.ts
    - app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx
    - app/src/components/physic-paint/view/brushScriptEditionPort.ts
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/engine/aquarelleStrokeBridge.ts
    - app/src/components/physic-paint/engine/AquarelleStrokeOverlay.tsx
    - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
    - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts

key-decisions:
  - "Scale is direct manipulation: factor = currentDistance / startDistance (the inline editor's newDist/startDist), clamped [0.1, 10] — the plan text's inverted ratio was overridden"
  - "A degenerate (zero) distance is identity, never NaN and never a collapse"
  - "transformStrokes honors angle and factor together: scale first, then rotate about the same centre, matching the shared apply law"
  - "Handles render only when the adapter supplies onTransformStrokes; hit-testing the handle wins over the stroke hit test"
  - "Watercolor transform is UV-space via one aquarelleEnginePixelToUv crossing and a NEGATED screen angle (UV y is up)"
  - "Watercolor failure path restores the raw pre-attempt snapshot and surfaces the existing refusal capsule"

patterns-established:
  - "One gesture = one commit: brush transformStrokes (redo cleared, no checkpoint) + one retained-script flush"
  - "One gesture = one ledger edit: watercolor beginAquarelleTransformEdit + one re-bake through Apply"
  - "Pure geometry module proves the preview and the commit share the same math"

requirements-completed: []

coverage:
  - id: D1
    description: "Multi-stroke selection (plain replace, Cmd/Ctrl toggle, Shift add, empty clear) and batched move/delete in one edit"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/scriptStrokeEdition.test.ts"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleRecordState.move.test.ts"
        status: pass
    human_judgment: true
    rationale: "Pointer modifier gestures and the visible outline/ghost behavior need live Studio UAT."
  - id: D2
    description: "Union box, four uniform-scale corners and a top rotate handle with a live ghost and release-only commit"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/scriptStrokeTransform.test.ts"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#261024-mz5 Studio transform handles surface"
        status: pass
    human_judgment: true
    rationale: "Handle geometry, cursor feedback and drag feel are visible interactions; automated cells only pin math and wiring."
  - id: D3
    description: "Brush transform commit: one engine transformStrokes + one flush, points only, redo cleared, no undo checkpoint"
    verification:
      - kind: unit
        ref: "packages/efx-physic-paint/src/engine/EfxPaintEngine.strokeTransform.test.ts"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/brushScriptEditionPort.test.ts"
        status: pass
    human_judgment: true
    rationale: "Persistence after close/reopen and the absence of artifacts is a live UAT row (2)."
  - id: D4
    description: "Water color transform end-to-end: one snapshot edit, one re-bake, undo restores one step, failed bake restores the pre-attempt script"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleRecordState.transform.test.ts"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/aquarelleStrokeBridge.test.ts#aquarelleEnginePixelToUv"
        status: pass
    human_judgment: true
    rationale: "The re-bake result, the refusal capsule and undo/redo are live visible outcomes (UAT rows 5-6)."

# Metrics
duration: 19min
completed: 2026-10-24
status: complete
plan_head_before: 3ffeb81445d226eaa73e6d73a0a034248ace3cef
plan_head_after: 5e4c1b70c0234d5adef8f45553c83fa29b1445c6
commits: 6
---

# Quick 261024-mz5: Studio multi-select + rotation/scale Summary

**Set-based stroke selection with live-preview corner scale and rotate handles, committed as one batch edit for Brush and one snapshot edit plus re-bake for Water color.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-10-24T16:44:07+02:00 (first task commit)
- **Completed:** 2026-10-24T17:03:00+02:00
- **Tasks:** 3
- **Files modified:** 23

## Verification finding and final API surface

The Studio script-edition seam held a SINGLE selected id; multi-select existed only in the legacy inline paint editor (`paintStore.selectedStrokeIds` + Cmd/Ctrl-click in `PaintOverlay.tsx`), which is the convention reference and was NOT reused as code. This quick extends the existing Studio seam only — no second selection system.

Final surface:

- `scriptStrokeEdition.ts` — `scriptSelectedStrokeIds: ReadonlySet<number>`, `scriptSelectedStrokeId` computed singleton, compare-then-write `setScriptStrokeSelection` / `selectScriptStroke` / `toggleScriptStrokeSelection` / `clearScriptStrokeSelection`, the shared drag signal, the transform preview signal (`scriptStrokeTransform`, compare-then-write), and batch port ops `deleteStrokes` / `moveStrokes` / `transformStrokes`.
- `scriptStrokeTransform.ts` — pure union box, five handles (tl/tr/bl/br + rotate on a stem), hit-test, `rotateScriptPoint` / `scaleScriptPoint` / `applyScriptStrokeTransform` (scale then rotate), `buildScriptStrokeTransform` (direct manipulation, Shift 15° snap), identity detection.
- `ScriptStrokeOverlay.tsx` — plain click replaces, Cmd/Ctrl toggles, Shift adds, plain empty clears; Alt+click batch delete; press-and-drag moves the WHOLE captured set; handle-first hit-testing; preview-only handle gestures; handles render only when the adapter supplies `onTransformStrokes`.
- `EfxPaintEngine.transformStrokes(ids, transform)` — drain, map points, clear redo, notify history, redraw, ONE `'move'` notification, `updateMoveHover()`; `params` never touched.
- `brushScriptEditionPort.transformBrushScriptStrokes` — one engine commit + one `flushBrushScriptFrame`.
- `aquarelleEnginePixelToUv` — the exact inverse of `aquarelleUvToEnginePixel`, degenerate guard returning `{0,0}`.
- `transformAquarelleStrokesInScript(ids, {kind, centerUvX, centerUvY, angleRad, factor})` — UV-space points-only remap, registry/entry/timeline replaced at the SAME indexes, one revision bump.
- `beginAquarelleTransformEdit(ids, transform)` — one before/after snapshot edit under the shared 10-entry ledger.
- Studio `handleAquarelleTransformStrokes` — the move guard chain, one bridge crossing for the centre, NEGATED screen angle, begin → sheet reset → await Apply → record on success → raw rollback + refusal capsule on failure.
- Rail tooltips now mention `Corner handles scale · Top handle rotates` in both Move and Select.

## Commit laws

- **Brush:** ONE `engine.transformStrokes(ids, transform)` call — drain first, map every point (scale then rotate about the union-box centre), `redoStack = []`, `notifyHistoryAvailability()`, `displayCompositeDirty = true`, `redrawAfterScriptEdit()`, ONE `notifyCompletedMutation('move', firstId)`, `updateMoveHover()`, then ONE retained-script flush. No undo checkpoint is pushed — the existing Move law.
- **Water color:** ONE `beginAquarelleTransformEdit` (before/after snapshots, one edit id) + ONE `applyAquarelleTimeline` re-bake through the shared Apply pipeline. Success records one `aquarelle-script` ledger entry (undoable); failure calls `restoreAquarelleEditSnapshot(editId, 'undo')` and shows the existing refusal capsule.

## Task Commits

Each task was committed atomically (TDD: RED then GREEN):

1. **Task 1: Multi-select + batch move/delete** — `766a7d18` (test), `1cf3b801` (feat)
2. **Task 2: Transform geometry, handles, brush transform commit** — `444e1614` (test), `53282d1d` (feat)
3. **Task 3: Watercolor transform end-to-end, Studio wiring, tooltips** — `b9df6475` (test), `5e4c1b70` (feat)

Plan metadata commit is created by the orchestrator (summary/STATE only; per the quick workflow this executor does not commit docs artifacts).

## Files Created/Modified

- `app/src/components/physic-paint/view/scriptStrokeTransform.ts` — pure selection-transform geometry (new)
- `app/src/components/physic-paint/view/scriptStrokeTransform.test.ts` — geometry/handle/builder cells (new)
- `app/src/components/physic-paint/view/aquarelleRecordState.transform.test.ts` — UV transform law + snapshot round trip (new)
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.strokeTransform.test.ts` — engine transform commit law (new)
- `app/src/components/physic-paint/view/scriptStrokeEdition.ts` — selection Set, drag/transform signals, batch port ops
- `app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx` — multi-select gestures, ghost, handles, transform preview
- `app/src/components/physic-paint/view/brushScriptEditionPort.ts` — batch engine-backed ops incl. transform
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` — batch move/delete/transform edits
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` — batch translate/delete/transform in lockstep
- `app/src/components/physic-paint/engine/aquarelleStrokeBridge.ts` — absolute pixel→UV inverse
- `app/src/components/physic-paint/engine/AquarelleStrokeOverlay.tsx` — transform callback + port op
- `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` — ref-threaded transform callback
- `app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx` — ref-threaded transform callback
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — batch handlers, watercolor transform re-bake, port registration
- `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx` — Move/Select tooltips
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` — `moveStrokes` / `deleteStrokes` / `transformStrokes`

## Decisions Made

- Direct-manipulation scale (`currentDistance / startDistance`) over the plan's inverted ratio: the plan cites the inline editor's `newDist / startDist` but transcribes it reversed; the editor is the oracle.
- A pointer exactly on the centre yields identity (the RED cell's "degenerate distance is identity, not NaN"); the published floor remains 0.1 for any non-zero distance.
- `kind` is advisory: both angle and factor are honored (scale then rotate), so a future combined gesture needs no new engine entry point.
- The watercolor transform type keeps a UV centre (`centerUvX/Y`) rather than reusing the screen-space type, so no caller can forget the y flip.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Scale ratio direction**
- **Found during:** Task 2 (transform geometry)
- **Issue:** The plan behaviour says `factor = startDistance/currentDistance`; the inline editor it cites uses `newDist / transformStartDist` (drag away = grow). The plan's formula would invert every drag.
- **Fix:** Implemented `factor = currentDistance / startDistance`, clamped `[0.1, 10]`; the RED cells pin grow/shrink directions.
- **Files modified:** `app/src/components/physic-paint/view/scriptStrokeTransform.ts`, `scriptStrokeTransform.test.ts`
- **Verification:** 15 geometry cells pass, including grow ×2 / shrink ×0.5.
- **Committed in:** `53282d1d`

**2. [Rule 1 - Bug] Clamp-cell arithmetic and the degenerate-distance guard**
- **Found during:** Task 2 GREEN
- **Issue:** The RED clamp cell fed a 0.5-distance pointer while expecting the 0.1 floor (0.5 is above it with direct manipulation), and the builder returned 0.1 for a pointer exactly on the centre while the RED cell required identity.
- **Fix:** The clamp cell now feeds 0.01 distance (genuinely below the floor); the builder treats a zero current distance as identity before clamping.
- **Files modified:** `scriptStrokeTransform.test.ts`, `scriptStrokeTransform.ts`
- **Verification:** Full geometry suite green.
- **Committed in:** `53282d1d`

**3. [Rule 3 - Blocking] Widened port type needed interim no-op transform ops**
- **Found during:** Task 2
- **Issue:** Adding `transformStrokes` to `ScriptStrokeEditionPort` broke the watercolor adapter and the Studio's registered watercolor port before Task 3 wired them.
- **Fix:** Temporary unreachable no-ops in both, replaced by the real callbacks in Task 3 (`5e4c1b70`). No user-visible behavior existed in between.
- **Files modified:** `AquarelleStrokeOverlay.tsx`, `PhysicsPaintStudio.tsx`
- **Committed in:** `53282d1d` (removed in `5e4c1b70`)

**4. [Rule 3 - Blocking] Source-pin maintenance for intentionally changed contracts**
- **Found during:** Tasks 2-3 GREEN
- **Issue:** Four pins encoded the pre-change API: the old overlay early-return string (missed in RED), the mount memo-deps tail, the `buildRotoScriptApplyRefusalMessage` call-site count, and "watercolor has no transform callback".
- **Fix:** Updated each pin to the new contract with the intended behavior preserved (gates still pinned; one additional refusal site documented).
- **Files modified:** `PhysicsPaintStudio.test.ts`
- **Verification:** 260 Studio cells pass; full suite green.
- **Committed in:** `53282d1d`, `5e4c1b70`

---

**Total deviations:** 4 auto-fixed (2 bugs, 2 blocking — one temporary, removed in Task 3).
**Impact on plan:** No scope creep. The scale-direction correction is the only behavioral divergence and follows the cited oracle.

## Issues Encountered

None beyond the deviations above.

## Known Stubs

None. (The Task 2 interim no-ops were removed within this same plan.)

## Threat Flags

None — the change is an in-memory point remap plus existing Apply/engine paths; no new endpoint, auth path, file access, or schema.

## Verification

Task 2 gate:

- package build OK; engine suites `EfxPaintEngine.strokeTransform` (6) + `moveTranslate` (19) = 25 passed
- app suites `scriptStrokeTransform` (15), `scriptStrokeEdition` (18), `brushScriptEditionPort` (22), `PhysicsPaintStudio` (257) = 312 passed
- app typecheck green

Task 3 gate:

- package build OK; package `check` (tsc --noEmit) green
- targeted suites: `aquarelleStrokeBridge` (13), `aquarelleRecordState.transform` (4), `aquarelleRecordState.move` (21), `aquarelleStrokeSelection` (13), `PhysicsPaintStudio` (260) = 311 passed
- app typecheck green
- **FULL app suite:** 330 passed | 2 skipped test files; 5913 passed | 1 skipped | 96 todo (6010 tests), including the production vite build (main chunk 1,641.89 kB, under the 2,000 kB ceiling)

## Performance note

The transform is an O(points) in-memory remap per committed gesture: one pass per targeted stroke, one redraw/re-play, one retained-script flush (brush) or one re-bake (watercolor). The live preview maps only the decimated overlay polylines (≤96 points per selected stroke) and never touches the engine. No new per-frame allocation is retained; replaced point arrays are the only garbage, in line with the existing move/delete paths.

## UAT rows (pending live verification)

1. Brush Move: Cmd/Shift-click two strokes → both outlined, union box visible.
2. Corner drag scales both live; release commits; artifacts persist after close/reopen.
3. Rotate drag with Shift snaps to 15°.
4. Backspace deletes all selected strokes in one edit.
5. Water color multi-select transform re-bakes through Apply; undo restores one step.
6. A failed watercolor re-bake shows the refusal and restores the pre-attempt script.
7. `<` / `>` steps only a single selection (multi consumes the key, mutates nothing).
8. Leaving the module or select mode drops the selection and any preview.

## Next Phase Readiness

Both Studio modules share one selection/transform seam; the inline editor is untouched. Live UAT (rows above) is the only remaining gate before calling the quick closed.

## Self-Check: PASSED

- All four created source/test files exist on disk.
- All six task commits (766a7d18, 1cf3b801, 444e1614, 53282d1d, b9df6475, 5e4c1b70) are ancestors of HEAD.
