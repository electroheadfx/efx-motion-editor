---
phase: quick-261024-p5q
plan: 261024-p5q
subsystem: physic-paint-studio
tags:
  - preact-signals
  - stroke-settings
  - brush-engine
  - watercolor
  - slider-stepper
  - geometry

requires:
  - quick: 261024-mz5
    provides: shared stroke selection set, move/transform commits, selection box
  - quick: 261023-g4p
    provides: script-edition port registration and the brush Move surface
  - quick: 261022-ujp
    provides: watercolor restack edit + shared Apply pipeline / ledger

provides:
  - view-supplied StrokeSettingsDialogBundle for the active module
  - selection-gated movable Stroke Settings dialog (Paint, Color, Geometry)
  - brush engine getStrokeAppearance / setStrokeAppearance batch commit
  - watercolor readAquarelleStrokeAppearance + beginAquarelleAppearanceEdit
  - SliderStepper mixed display with mixed-first-gesture commit
  - session-relative geometry law (uniform / per-axis scale / rotation / X-Y)

affects:
  - physic-paint-studio
  - stroke-settings-dialog
  - brush-script-edition
  - aquarelle-script-edition

actuals:
  tokens: 40914 # chars/4 over the realized diff (163654 chars), same scale as the estimate
  tasks: 3
  commits: 3
  plan_head_before: 9488cd0faf8791d5a2205fce5bbb42d9428991f6
  plan_head_after: 4f430e68e63010630baad07b5532d4f60a66582a

tech-stack:
  added: []
  patterns:
    - "Applied-only baseline: the geometry session advances only after the commit promise resolves true"
    - "Selection-keyed drafts: color/geometry state is keyed by the selection Set instance, so membership changes re-arm without a render-body write"
    - "Watercolor appearance as object replacement: toStudioStroke at the same timeline index + one snapshot edit + ledger-or-rollback"

key-files:
  created:
    - app/src/components/physic-paint/view/strokeSettingsModel.ts
    - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
  modified:
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
    - app/src/components/physic-paint/view/brushScriptEditionPort.ts
    - app/src/components/shared/SliderStepper.tsx
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts

key-decisions:
  - "The dialog consumes a view-supplied callback bundle, never the shared ScriptStrokeEditionPort."
  - "Mixed representative values always come from ReadonlySet insertion order (first selected)."
  - "The color control's live changes feed a dialog draft; one stroke write per gesture boundary."
  - "Geometry is session-relative with an applied-only baseline; transforms anchor at the selected-strokes' union-box centre."
  - "Pre-existing engine package failures (32, identical at the base commit) were left untouched."

patterns-established:
  - "Brush appearance commit: validate whole patch -> drain -> compare-then-write -> redo cleared -> ONE move notification -> ONE flush"
  - "Watercolor appearance commit: peek-only guards -> frame filter -> snapshot edit -> reset sheet -> await re-bake -> ledger or undo restore"
  - "Dialog dismissal edge: dismissed boolean signal + plain sawEmptySinceDismiss flag + resolveStrokeSettingsOpen"

requirements-completed: []

duration: 15min
completed: 2026-10-24
status: complete
---

# Quick 261024-p5q: Studio Stroke Settings dialog Summary

**A selection-gated, header-draggable Stroke Settings dialog that edits exactly the selected Brush/Water color strokes through the existing script-edition laws, with the shared unmodified color picker and session-relative geometry.**

## Performance

- **Duration:** ~15 min measured from the commit-ledger anchor to the final task commit (the session reading/implementation before the first commit is not included in this instrument)
- **Started:** 2026-10-24T17:17:58Z (ledger anchor)
- **Completed:** 2026-10-24T17:32:10Z
- **Tasks:** 3/3
- **Files modified:** 16 (2 created, 14 modified)

## Accomplishments

- The dialog opens only for a non-empty stroke selection with the module's edition surface active (Brush Move / Water color Select), seats at the canvas region's top-right, drags by its header with an 80px-visibility clamp, ignores outside clicks, and dismisses on Escape only when an editable field inside does not own the key.
- The full locked Paint field set ships for both engines with Mixed display (value "Mixed", neutral track, no active smoothing segment), the representative taken from the first-selected stroke; untouched controls never write and the first gesture writes every selected stroke.
- Brush intrinsic/color commits are ONE engine batch edit plus ONE retained-script flush; watercolor commits are ONE snapshot edit plus ONE re-bake with ledger recording and exact rollback on refusal.
- Color reuses RightPanelColorTab unmodified: live changes feed a draft signal only, and exactly one stroke write fires per boundary gesture (pointerup, change, Enter, deferred blur-capture, click).
- Geometry rows (X, Y, Scale, Scale X, Scale Y, Rotation) are release-commit free-entry SliderSteppers that reuse the existing move/transform commits, compound per control, and never advance on a refused commit.
- Every existing structural gate that pinned the previous surface was updated to the intentional new surface (async boolean watercolor handlers, the eighth refusal site, the tenth PropsMemo, the fifth brush flush site, and an explicit freeEntry allow-list entry).

## Task Commits

Each task was committed atomically:

1. **Task 1: Brush intrinsic field end-to-end — model, engine appearance write, brush port, dialog shell, Studio wiring** - `3b7d1139` (feat)
2. **Task 2: Water color path, full intrinsic field sets, mixed display, shared color control commit** - `c00c6088` (feat)
3. **Task 3: Geometry controls with the applied-only session delta law, and final gates** - `4f430e68` (feat)

Measured: `git rev-list --count 9488cd0faf8791d5a2205fce5bbb42d9428991f6..HEAD` = 3.

_Note: per the dispatch contract, `.planning/` artifacts were deliberately not committed and STATE.md/ROADMAP.md were not updated._

## Final API Surface

- **`StrokeSettingsDialogBundle`** (`view/strokeSettingsModel.ts`): `module: 'brush' | 'watercolor'`, `brushMoveActive: boolean`, `playFrame: number`, `canvasSize: ScriptStrokeSize`, `listStrokes(playFrame, size)`, `readAppearance(ids, playFrame)`, `applyAppearance(ids, patch): boolean | Promise<boolean>`, `moveStrokes(ids, dxPx, dyPx): boolean | Promise<boolean>`, `transformStrokes(ids, transform): boolean | Promise<boolean>`.
- **Pure model**: `BRUSH_SETTINGS_FIELDS`, `WATERCOLOR_SETTINGS_FIELDS`, `strokeSettingsFields`, `readNumericField`, `readColorField`, `buildAppearancePatch`, `buildColorPatch`, `resolveStrokeSettingsOpen`, `shouldMarkSawEmpty`, `StrokeGeometrySession`, `FRESH_STROKE_GEOMETRY_SESSION`, `STROKE_SCALE_RANGE` (10..1000), `STROKE_ROTATION_RANGE` (-360..360), `geometryMoveDelta`, `geometryTransform`.
- **Brush engine** (`EfxPaintEngine.ts`): `getStrokeAppearance(mutationIds): StrokeAppearanceRecord[]`, `setStrokeAppearance(mutationIds, patch): number`, `StrokeAppearancePatch { params?, color? }`; param whitelist = the nine `BrushOpts` keys.
- **Brush port** (`brushScriptEditionPort.ts`): `readBrushScriptStrokeAppearance(ids, playFrame)`, `applyBrushScriptStrokeAppearance(ids, patch): boolean`.
- **Watercolor** (`aquarelleRecordState.ts` / `aquarelleStrokeSelection.ts`): `updateAquarelleStrokesInScript(mutationIds, patch): number`, `readAquarelleStrokeAppearance(ids, playFrame)`, `beginAquarelleAppearanceEdit(ids, patch): number | null`.
- **Studio** (`PhysicsPaintStudio.tsx`): `handleAquarelleAppearanceStrokes(ids, patch): Promise<boolean>`; `handleAquarelleMoveStrokes` and `handleAquarelleTransformStrokes` now return `Promise<boolean>` (true only after a successful re-bake).
- **SliderStepper**: optional `mixed?: boolean` — "Mixed" readout, `slider-stepper-mixed` modifier, neutral zero-width progress until a draft exists, equality guards bypassed only when mixed.
- **Dialog**: props `{ bundle?: StrokeSettingsDialogBundle | null }`; test ids `stroke-settings-dialog`, `-header`, `-close`, `-<fieldKey>`, `-smoothing-option-<n>`, `-color`, `-color-mixed`, `-geometry`, `-geometry-{x,y,scale,scale-x,scale-y,rotation}`.

## Commit Laws

- **Brush appearance** (`setStrokeAppearance`): validate the ENTIRE patch first (known keys, finite values, non-empty color, at least one member) -> `flushPendingStrokeFinalizations()` -> resolve targets (paint only, dedupe ids) -> compare-then-write each key/color -> 0 changed = no history change, no redraw, no notification -> otherwise `redoStack = []`, `notifyHistoryAvailability()`, `displayCompositeDirty = true`, `redrawAfterScriptEdit()`, ONE `notifyCompletedMutation('move', firstChangedId)`. No undo checkpoint. The port adds the lock gate, `declareEditBase`, ONE engine call and ONE `flushBrushScriptFrame(... resolvePaintSettings(engine))` only when changes > 0.
- **Watercolor appearance** (`updateAquarelleStrokesInScript` + `beginAquarelleAppearanceEdit`): strokes and entries are REPLACED, the entry is regenerated with `toStudioStroke(nextStroke)` at the SAME `payloadTimeline` index, one `bumpAquarelleStrokesRevision()` per effective batch; no-op/unknown/deleted ids and invalid patches change nothing and store no edit. The edit stores one before/after `AquarelleScriptSnapshot` (10-entry cap).
- **Watercolor handler**: peek-only guards (physical lock, `rotoScript.applying`/`mutationLocked`, `currentCell.kind === 'real'`, in-flight) -> `aquarelleStrokesOnFrame` -> begin edit -> in-flight true -> reset sheet -> `await applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame))` -> success records ONE `aquarelle-script` ledger entry and returns true; failure calls `restoreAquarelleEditSnapshot(editId, 'undo')`, surfaces the shared refusal copy and returns false; `finally` clears the flag.
- **Color boundary (UAT revision)**: the dialog shows a read-only color thumb; the ONE picker is the sidebar `RightPanelColorTab`. Its optional `onColorCommit` fires at box/hue release, color-chip change, hex Enter/blur and swatch click (never on live moves); the Studio routes it to the selected strokes through `applyBrushScriptStrokeAppearance` (Brush Move) or `handleAquarelleAppearanceStrokes` (Water color Select). One gesture = one stroke write; an unchanged color is refused by the engine/script update.
- **Geometry baseline**: every row is `commitOnRelease` + `freeEntry`. Uniform applies `next / uniformPct` and multiplies both axis displays; Scale X / Scale Y apply `next / their own baseline` and move no other baseline; rotation applies the degree delta; X/Y commit `round(target - live centre)` in px and refuse a zero delta. The session is keyed by the selection Set, is written ONLY in the promise continuation after a true result, and re-baselines to 100% / 0 degrees on any membership change. Every transform anchors at the union-box centre of the selected strokes. Nothing persists.
- **Dismissal edge**: `dismissed` is a boolean signal written ONLY by Escape and the header close button; `sawEmptySinceDismiss` is a plain module flag written idempotently in the render body through `shouldMarkSawEmpty`; open = `surfaceActive && size > 0 && (!dismissed || sawEmptySinceDismiss)`.

## UAT Revision (2026-10-24)

1. **App scrollbar**: the dialog body uses `SidebarScrollArea` (the right-sidebar custom thumb), never the OS scrollbar; the surface has a bounded height so the track is real.
2. **Color thumb only**: removed the embedded picker. The dialog shows a 28px color thumb at the top (plus a red Mixed badge); the sidebar Color tab is the ONE picker and commits to the selected strokes once per gesture.
3. **Section order**: Color -> Geometry -> Paint.
4. **Header**: the Document sound modal chrome — `SlidersHorizontal` icon, shared title style, rounded-square close button.
5. **Mixed is red**: `#ef4444` in the SliderStepper value box and every Mixed caption.
6. **Brush Paint Size**: max 800 px in the dialog (per-stroke rendering has no engine cap; the live top-bar slider remains 1-80).
7. **Scale / Scale X / Scale Y**: max 500%.
8. **X / Y**: max 2000 px.
9. **Water color Size reaches 800**: the canonical 1-800 px value maps through `toEngineParams`; every legacy value (1-80) keeps its exact pre-change footprint, the 80-800 band extends the vendor footprint scale linearly to ~10x an 80 px stroke, and typed values above 800 keep growing to a finite safety ceiling. The live top-bar watercolor slider remains 1-80.
10. **Ruled section titles**: Color / Geometry / Paint use the shared `RuleSectionHeader` (centered uppercase label between two 1px rules, the Sidebar Paper-tab look) with 6px top/bottom padding.
11. **Free typed entry**: every dialog slider accepts typed values outside its track range and ± steps keep stepping; only the track (and its knob) stays bounded. Geometry transforms no longer clamp typed scale/rotation values.
12. **Tighter rules**: section-header padding drops to 3px, the Color header gets padding-top 0, and the scroll content has padding-bottom 0.
13. **Color block**: the 28px thumb becomes a full-width 48px swatch with its hex and `rgb(r, g, b)` readouts underneath; the red Mixed badge sits in that readout row.
14. **Resizable sheet**: a bottom grip drags the dialog height (240px minimum, bounded by the canvas region); the chosen height survives close/reopen within the Studio session.
15. **Geometry opacity**: Opacity is the first row of Geometry (brush `opacity`; water color canonical Pigment `load` shown under the Opacity label) and is removed from the Paint list so exactly one control edits it.

## UAT Rows (for the user)

1. Brush Move: select one stroke -> the dialog appears at the canvas region's top-right with the locked Paint fields (Size, Opacity, Shape detail, Blending, Smoothing) hydrated from that stroke.
2. Escape hides it without clearing the selection and without hijacking a focused value/hex field; a non-empty reselect keeps it hidden; empty-then-select reopens it; outside clicks never close it.
3. Mixed Brush sizes show "Mixed" and the first drag writes every selected stroke; the mixed color badge shows the first-selected stroke's color; an untouched Opacity stays unchanged.
4. The dialog shows only a color thumb; use the sidebar Color tab. A picker gesture writes the selected strokes once on release / swatch / hex commit; live drags do not write; brush redo state follows the Move law (redo cleared, no new undo checkpoint).
5. Water color Select: pigment/water edits re-bake once and undo restores one step; a refused re-bake shows the refusal and restores the pre-attempt script.
6. Geometry: X/Y move by the typed delta; uniform 100 -> 120 -> 90 compounds to 0.9x; rotation is about the selection center; a refused watercolor commit leaves the session value unchanged; a membership change resets scale/rotation.
7. The header drag moves the dialog and the offset resets on reopen; canvas transform handles still work behind it.
8. The sidebar Color tab is the color editing surface for the selection; the top bar and every other sidebar field never mirror the modal edits, and the Color tab's non-selection behavior is unchanged.
9. Header/scroll/order: the dialog wears the Document sound header (icon, title, rounded-square close), scrolls with the app scrollbar, and reads Color - Geometry - Paint.
10. Ranges: Brush and Water color Size reach 800 (typing may exceed it); Scale / Scale X / Scale Y reach 500; X / Y reach 2000; every typed value outside a track range is still accepted.
11. Section titles read as ruled centered headers (the Sidebar Paper tab's TEXTURE style) with vertical breathing room.

## Gate Totals

- Task 2 targeted suites: 102/102 across `aquarelleStrokeSelection.test.ts`, `strokeSettingsModel.test.ts`, `SliderStepper.test.tsx.test.ts`, `brushScriptEditionPort.test.ts`; app typecheck clean. RED evidence before implementation: 21 failed | 55 passed.
- Task 3 RED evidence: 12 failed | 32 passed in `strokeSettingsModel.test.ts` before the geometry implementation; 44/44 after.
- Task 3 targeted final: 114/114 across the four suites; app typecheck clean; `@efxlab/efx-physic-paint run check` clean; engine package build clean.
- Full app suite: 331 test files passed, 2 skipped; 5981 tests passed, 1 skipped, 96 todo (6078 total) after the UAT revision.
- UAT-revision focused rerun: 333/333 across `strokeSettingsModel.test.ts`, `PhysicsPaintPalette.test.ts`, `SliderStepper.test.tsx.test.ts`, and `PhysicsPaintStudio.test.ts`; app typecheck clean.
- Full engine suite: 423 passed, 32 failed, 3 skipped (458). The 32 failures are PRE-EXISTING and unrelated: the same 7 files and the same 32 failures reproduce at the base commit `9488cd0f` (32 failed | 417 passed | 3 skipped; HEAD adds exactly the 6 new appearance tests, all passing). Causes are the engine's stale prototype harnesses / canvas-API environment (`getImageData` undefined, missing `previewBaseMatteCache` etc.) plus intentionally-red contract tests; `.planning/WINDOWS.md` already records two of them (#74 liveAlphaCache, #80 cooperativeFinalization).
- No new dependency, no package.json/pnpm-lock change, no schema or persistence change, no per-tick writes (one batch write per commit), and no edits to `RightPanelColorTab.tsx`, `scriptStrokeEdition.ts`, `physicsPaintStudio.css`, the legacy inline editor, or `paintContext`/schema files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated existing structural pins to the intentional new surface**
- **Found during:** Task 3 final gate (full app suite)
- **Issue:** `PhysicsPaintStudio.test.ts` pinned the pre-quick shapes: `PropsMemo.resolve(` count 9 (the dialog bundle memo is the 10th), refusal-mapper mentions 8 (the appearance handler is the 8th call site -> 9 mentions), brush flush sites 4 (the appearance commit is the 5th), the move handler's synchronous signature, and the transform handler's bare `return;` guards (now `return false;` with a hoisted `playFrame`).
- **Fix:** Updated each pin and its explanatory comment to the new surface; no behavior change.
- **Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- **Verification:** the file passes (260/260) and the full app suite is green.
- **Committed in:** `4f430e68` (Task 3 commit)

**2. [Rule 3 - Blocking] Extended the NumericStepper exception-option allow-list**
- **Found during:** Task 3 final gate (full app suite)
- **Issue:** `NumericStepper.test.tsx` allowed `freeEntry`/`resolveStep` only in `PaperPicker.tsx`; the plan mandates free entry on every geometry row, so the dialog was flagged as a leak.
- **Fix:** Turned the single path into a fixed two-entry allow-list (`PaperPicker.tsx` + `PhysicsPaintStrokeSettingsDialog.tsx`) with the rationale in the comment — an explicit opt-in list, never a blanket rule.
- **Files modified:** `app/src/components/shared/NumericStepper.test.tsx`
- **Verification:** the sweep passes (35/35) and the positive control still sees the paper-grain call site.
- **Committed in:** `4f430e68` (Task 3 commit)

**3. [Rule 2 - Missing Critical] Deferred blur-capture color commit one microtask**
- **Found during:** Task 2 (color boundary)
- **Issue:** Preact attaches `onBlurCapture` as a native capture-phase `blur` listener, so a hex-field commit would otherwise run before the field's own `onColorChange` draft write.
- **Fix:** `queueMicrotask(commitColor)` in the wrapper's blur-capture handler; one stroke write still happens per gesture.
- **Files modified:** `PhysicsPaintStrokeSettingsDialog.tsx`
- **Verification:** pinned by the "blur boundary commits the draft after the hex field handler ran" test.
- **Committed in:** `c00c6088` (Task 2 commit)

**4. [Post-verification fix] Color boundary target guards**
- **Found during:** post-execution verification (mixed-selection swatch double write).
- **Issue:** the wrapper committed on every pointerup/click/blur, so one physical swatch click produced two writes (pointerup + click) and a bare click into the hex field or color chip could collapse a mixed selection to the representative color.
- **Fix:** the wrapper now commits only on the picker's own surfaces (color box / hue strip pointerup, color-chip change, hex Enter / blur, swatch click) and only when the shared picker emitted a draft for the current selection; `commitColor` no longer invents the representative color.
- **Files modified:** `PhysicsPaintStrokeSettingsDialog.tsx`, `strokeSettingsModel.test.ts`.
- **Verification:** `strokeSettingsModel.test.ts` 47/47, app typecheck clean; new pins cover the swatch single-write sequence, bare chip/hex clicks, and a draftless blur.

---

**Total deviations:** 4 auto-fixed (2 blocking gate fixes, 1 missing critical ordering fix, 1 post-verification boundary guard)
**Impact on plan:** No scope creep. The pin updates describe the surface the plan itself mandates; the blur fix is required for a correct single-write-per-gesture color commit.

## Deferred Issues

- Full engine package suite: 32 failures across 7 files, byte-for-byte identical at the base commit `9488cd0f` (verified in a throwaway detached worktree with symlinked node_modules, then removed). They are pre-existing environment/stale-harness failures in preview-base decode/matte suites, `liveAlphaCache`, `lookLawDigest`'s `'live'` source pin, the cooperative-finalization `.red.` contract suite, and one erase-ordering measurement. Out of scope for this quick; not fixed.

## Next Phase Readiness

- The Studio selection surface now has one editing dialog for intrinsics, color and geometry in both modules; delivery of any further stroke fields only needs a registry entry plus the existing commit path.
- Live UAT rows 1-8 above are the user's; automated gates are green apart from the documented pre-existing engine failures.

---

*Quick: quick-261024-p5q*
*Completed: 2026-10-24*

## Self-Check: PASSED

- All key files exist; all three task commits (3b7d1139, c00c6088, 4f430e68) are ancestors of HEAD.
