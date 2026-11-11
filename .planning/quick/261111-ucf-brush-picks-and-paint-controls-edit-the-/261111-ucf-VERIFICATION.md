---
phase: 261111-ucf-brush-picks-and-paint-controls-edit-the-
verified: 2026-11-11T21:26:36Z
status: human_needed
score: 8/8 must-haves verified
covered_files:
  - ".planning/quick/261111-ucf-brush-picks-and-paint-controls-edit-the-/261111-ucf-PLAN.md"
  - ".planning/quick/261111-ucf-brush-picks-and-paint-controls-edit-the-/261111-ucf-SUMMARY.md"
  - "app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts"
  - "app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx"
  - "app/src/components/physic-paint/view/BrushResponsePanel.test.ts"
  - "app/src/components/physic-paint/view/BrushResponsePanel.tsx"
  - "app/src/components/physic-paint/view/BrushesDocker.test.tsx"
  - "app/src/components/physic-paint/view/BrushesDocker.tsx"
  - "app/src/components/physic-paint/view/PhysicsPaintBrushMenu.test.ts"
  - "app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx"
  - "app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts"
  - "app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx"
  - "app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts"
  - "app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx"
  - "app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts"
  - "app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx"
  - "app/src/components/physic-paint/view/aquarellePaintControls.test.ts"
  - "app/src/components/physic-paint/view/aquarellePaintControls.ts"
  - "app/src/components/physic-paint/view/aquarelleStrokeSelection.ts"
covered_digest: "v4:sha256:ed4dc740532083c6cbb30e3e63bb50d144aa0712653cb03f7ada4aaf42f5eadb"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "In the running Studio, arm Select mode, select a hand-painted (or vector) stroke, then pick another brush from the top-bar dropdown (and once from the library card and once from a docker row)."
    expected: "The selected stroke repaints to the picked brush, the live brush also changes, the dropdown/menu closes, and ONE undo (Cmd+Z) reverts the stroke repaint in a single step."
    why_human: "The fixtures register a fake appearance port; the real port registration in PhysicsPaintStudio, the canvas re-bake and the visible one-undo result cannot be exercised by the node-env suites."
  - test: "With a paint stroke selected, drag and release the top-bar Size/Water (and Pigment/Edges/Grain), the Paint-tab Brush size, one global row and one Brush response row."
    expected: "Nothing on the selected stroke changes during the drag; each release rewrites the selected stroke with that value and costs exactly one undo entry (globals Reset = one undo entry, never seven)."
    why_human: "Release cadence and the visible one-undo outcome depend on the live SliderStepper gesture + Studio ledger path; the unit tests assert one port call and one door edit but not the on-canvas/undo result."
  - test: "Select only a lift (eraser) stroke (Stroke type filter set to All so it can be selected), then pick a brush and release a paint slider."
    expected: "The lift stroke is untouched (no repaint, no undo entry), while the live brush/tool still updates as before."
    why_human: "The paint filter is unit-tested at the seam, but the visible proof that a lift stroke's pixels never change requires the live canvas."
---

# Quick 261111-ucf: Brush picks and paint controls edit the selection — Verification Report

**Phase Goal:** Selecting a stroke (hand-painted or vector) and picking a brush / moving a paint slider changes THAT stroke, while the live brush still updates as today.
**Verified:** 2026-11-11T21:26:36Z
**Status:** human_needed (all must-haves verified; visible live-UAT rows pending)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A pick with an armed selection keeps the live brush behaviour (tip selected, tool back to Brush, menu closes) AND commits the picked brush id plus the live multiplier bag through the ONE appearance door — one undo entry, one revision bump, one seed re-roll | ✓ VERIFIED | `pickAquarelleBrush` calls `selectAquarelleTip` then commits `{ brushId, toolOverrides: {...peek()} }` (`aquarellePaintControls.ts:42-51`); menu closes at `PhysicsPaintBrushMenu.tsx:185-186`; the port forwards to `handleAquarelleAppearanceStrokes` → `beginAquarelleAppearanceEdit` (`PhysicsPaintStudio.tsx:9224-9226`, door at `aquarelleStrokeSelection.ts:972-990`: one snapshot pair → one edit, `bumpAquarellePaintSeedSalts` = one seed re-roll; `updateAquarelleStrokesInScript` = one revision bump). Seam test asserts one port call and the tip change; door tests (`aquarelleStrokeSelection.test.ts:1959-2065`) assert one bump per write and one undo restoring a two-stroke batch. |
| 2 | The committed bag is the POST-pick bag (selectAquarelleTip first, commit second), snapshot not a live reference | ✓ VERIFIED | Source order at `aquarellePaintControls.ts:43-49`; `selectAquarelleTip` loads the incoming bag (`aquarelleRecordState.ts:277-283`). Test "commits the picked id and the POST-pick bag…" asserts forwarded bag equals the post-pick bag and differs from the pre-pick bag; snapshot test rewrites the live bag after the call and the patch stays unchanged. |
| 3 | Lift (eraser) strokes are never addressed: mixed selection commits only non-lift, lift-only is a no-attempt no-op while the live brush still changes, and no lift stroke ever receives a paint param or multiplier bag | ✓ VERIFIED | Every one of the four seam functions commits with `PAINT_ONLY = { filter: 'paint' }` (`aquarellePaintControls.ts:28,49,58,69,84`); the filter resolves ids through `getRecordedAquarelleStrokeEntries()` + `matchesAquarelleStrokeFilter` (`aquarelleStrokeSelection.ts:676-694`, predicate `tool !== 'lift'` at line 181-187) and returns null when none remain. Tests: mixed selection forwards `[10602]` only; lift-only returns null with zero port calls while the tip still changes. Lift strokes are recorded with the active tool (`aquarelleRecordState.ts:419`), and live `tool: 'lift'` is never written by the pick path. |
| 4 | Every brush pick surface routes through `pickAquarelleBrush`: top-bar dropdown, library cards, docker rows, import-success; eraser branches keep `setAquarelleLiftTipId` and commit nothing | ✓ VERIFIED | Production call sites: `PhysicsPaintBrushMenu.tsx:185`, `WatercolorBrushLibrary.tsx:87`, `BrushesDocker.tsx:86` (row) and `:213` (import-success). No production `selectAquarelleTip(` call exists outside the seam (`grep` shows only the seam and the definition). Lift branch keeps `setAquarelleLiftTipId` (`PhysicsPaintBrushMenu.tsx:137`). Source pins: menu brush region contains `pickAquarelleBrush(` exactly once, lift region contains none; docker source pin = exactly two calls + one import. |
| 5 | `WatercolorBrushLibrary` keeps Select mode and the selection armed when a non-empty selection exists, and still disarms Select mode on a pick when it does not (WR-03 preserved) | ✓ VERIFIED | `if (!aquarelleSelectionEditActive()) setAquarelleSelectMode(false);` (`WatercolorBrushLibrary.tsx:82-88`); `aquarelleSelectionEditActive` is peek-only Select-mode + non-empty (`aquarelleStrokeSelection.ts:662-664`). New test (10651) asserts mode and selection survive the pick plus one port call; the pre-existing WR-03 test (`WatercolorBrushLibrary.test.ts:420-440`) is unchanged and still passes (empty selection ⇒ disarm). |
| 6 | A release on the five top-bar brush sliders (size, pigment, water, edges, grain), the Paint-tab size control, any of the seven global rows and any Brush response row commits exactly ONE params or multiplier patch at that release boundary; `onChange`, live setters and rendered values unchanged | ✓ VERIFIED | Top bar: `TopBarSlider.onCommit` passthrough with the same clamp (`PhysicsPaintTopBar.tsx:208,215,224`) and five mapped commits `size/load/water/edge/granulation` (`:353-405`); Eraser cluster has no `onCommit` (`:324-342`). Paint tab: `paint-tab-brush-size` `onCommit` → `commitAquarelleSelectionParam('size', value)` (`PhysicsPaintRightPanel.tsx:464-466`), `onChange` untouched. Globals: per-row `onGlobalCommit` (`AquarelleGlobalsPanel.tsx:77-79,104`). Brush response: per-field `onMultiplierCommit` (`BrushResponsePanel.tsx:94-96,123`), 8 fields. Tests: top-bar 5 patches, zero calls before release; right-panel one patch + `onChange` still calls the live handler; seam clamp test; globals/response source pins. All `onChange` live setters are byte-identical in the diffs. |
| 7 | Globals Reset writes its seven live params as today and then commits ONE 7-key params patch — one undo entry, never seven | ✓ VERIFIED | `onReset` builds `next` while calling `setAquarelleParam(row.key, value)` per row in the shipped order, then one `commitAquarelleSelectionParams(next)` (`AquarelleGlobalsPanel.tsx:86-94`). Test asserts exactly one port call with all seven keys (`AquarelleGlobalsPanel.test.ts:278-302`), no `size`; the pre-existing Reset test still asserts the seven live values; `beginAquarelleAppearanceEdit` stores one edit per call (door tests). |
| 8 | With no selection or Select mode off every new commit is a no-attempt no-op (port never called) and every control behaves byte-identically to HEAD | ✓ VERIFIED | `commitAquarelleSelectionAppearance` returns null before touching the port when inactive or unportable (`aquarelleStrokeSelection.ts:676-679`); tests assert null + zero calls with Select mode off and with an empty selection; the diff adds only optional `onCommit` props (no live setter or render change), and `SliderStepper.onCommit` fires only at the shipped release boundary (`SliderStepper.test.tsx:657-752` via its launcher). |

**Score:** 8/8 truths verified (0 present, behavior-unverified)

### Deferred Items

None — the goal's automated scope is fully owned by this quick; no later-phase roadmap item defers any part of it.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/src/components/physic-paint/view/aquarellePaintControls.ts` | The four seam functions | ✓ VERIFIED | 86 lines; exports `pickAquarelleBrush`, `commitAquarelleSelectionParam(s)`, `commitAquarelleSelectionMultiplier`; all commit with filter `'paint'`; imported by 7 production modules |
| `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` | Optional filter on the appearance commit | ✓ VERIFIED | `AquarelleSelectionEditOptions` + `filter` default `'all'`; filtered ids resolved against the live stroke map; null on empty result before the port |
| `app/src/components/physic-paint/view/aquarellePaintControls.test.ts` | Behavior fixtures | ✓ VERIFIED | 275 lines, 10 fixtures (ids 10601-10612): pick order, post-pick bag, snapshot, mixed/lift-only/no-selection, param/batch shapes, clamp, default-'all' contract; collected (`*.test.ts`) and passing |
| `app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx` | Brush branch through the seam; lift branch unchanged | ✓ VERIFIED | `void pickAquarelleBrush(preset.id)`; `setAquarelleLiftTipId` retained at line 137 |
| `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx` | Conditional disarm + pick | ✓ VERIFIED | `aquarelleSelectionEditActive()` gate; one pick call |
| `app/src/components/physic-paint/view/BrushesDocker.tsx` | Row + import-success through the seam | ✓ VERIFIED | Two `pickAquarelleBrush` calls; import flow flags unchanged |
| `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx` | Clamped `onCommit` passthrough + five commits; Eraser untouched | ✓ VERIFIED | `updateCommit` builder; five mapped keys; lift cluster has no commit |
| `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` | Paint-tab size release commit | ✓ VERIFIED | `onCommit` → `commitAquarelleSelectionParam('size', value)`; `onChange` unchanged |
| `app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx` | Per-row commits + ONE Reset batch | ✓ VERIFIED | Seven `onCommit` wirings; Reset = seven live writes + one 7-key batch; no `size` |
| `app/src/components/physic-paint/view/BrushResponsePanel.tsx` | Per-row multiplier commits | ✓ VERIFIED | Eight rows wired to `commitAquarelleSelectionMultiplier(field, value)`; live setter unchanged |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `aquarellePaintControls.ts` | `aquarelleRecordState.ts` | `pickAquarelleBrush` selects the tip first, then `aquarelleToolOverrides.peek()` | ✓ WIRED | `selectAquarelleTip` loads the incoming bag (`aquarelleRecordState.ts:277-283`); `peek()` at `aquarellePaintControls.ts:47` |
| `aquarellePaintControls.ts` | `aquarelleStrokeSelection.ts` | Every commit calls `commitAquarelleSelectionAppearance` with `filter: 'paint'` | ✓ WIRED | `PAINT_ONLY` at line 28; calls at 44, 58, 69, 84 |
| `aquarelleStrokeSelection.ts` | `PhysicsPaintStudio.tsx` | Registered `applyAppearance` → `handleAquarelleAppearanceStrokes` → `beginAquarelleAppearanceEdit` | ✓ WIRED | Port registration `PhysicsPaintStudio.tsx:9224-9226`; handler at 9146-9214; one edit per call |
| `SliderStepper.tsx` | `aquarellePaintControls.ts` | `onCommit` release boundary is the only commit trigger; `onChange` never commits | ✓ WIRED | `onCommit` emitted at gesture end (`SliderStepper.tsx:421,435,501,602,610`); panels wire only `onCommit`; top-bar test asserts zero calls until release |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `aquarellePaintControls.ts` (pick) | `aquarelleToolOverrides` | Live signal written by `selectAquarelleTip` before the commit | Yes — post-pick bag, snapshot | ✓ FLOWING |
| `aquarellePaintControls.ts` (params/multiplier) | release value from `SliderStepper.onCommit` | Caller's live setter writes the same value; commit mirrors it into the selection | Yes — real gesture value | ✓ FLOWING |
| `aquarelleStrokeSelection.ts` (filter) | `scriptSelectedStrokeIds` + recorded stroke map | Session selection ids resolved against `getRecordedAquarelleStrokeEntries()` | Yes — real recorded strokes; deleted ids dropped | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| App typechecks with the new seam | `pnpm --filter efx-motion-editor run typecheck` | `tsc --noEmit` clean (exit 0) | ✓ PASS |
| Nine targeted suites (new fixtures + regression guards) | `pnpm --filter efx-motion-editor exec vitest run <9 files>` | 9 files / 237 tests passed | ✓ PASS |
| Full app suite | `pnpm --filter efx-motion-editor exec vitest run` | 426 passed \| 2 skipped (428); 8916 passed \| 1 skipped \| 96 todo (9013) | ✓ PASS |
| Release boundary fires once per gesture | `SliderStepper.test.tsx` via its launcher (part of the full run) | onCommit once per drag/release, zero during typing until commit | ✓ PASS |

### Probe Execution

N/A — the quick declares no `probe-*.sh` and is not a migration/CLI phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| QUICK-261111-UCF | `261111-ucf-PLAN.md` | Brush picks and paint controls edit the selection | ✓ SATISFIED (automated scope) | All 8 must-haves verified; visible live-UAT rows are the remaining human items |

No orphaned requirements: this is a quick task with no REQUIREMENTS.md phase mapping; the only declared ID is owned by this plan.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `aquarellePaintControls.test.ts` | QUICK-261111-UCF | 10 | 0 | No | Value + behavioral (call count, ids, payload, order) | ✓ OK |
| `PhysicsPaintBrushMenu.test.ts` | QUICK-261111-UCF | 6 | 0 | No | Source-pin + value | ✓ OK |
| `WatercolorBrushLibrary.test.ts` | QUICK-261111-UCF | 16 | 0 | No | Behavioral (mode/selection survival, port call) | ✓ OK |
| `BrushesDocker.test.tsx` | QUICK-261111-UCF | 8 | 0 | No | Behavioral (row pick) + source pin | ✓ OK |
| `PhysicsPaintTopBar.test.ts` | QUICK-261111-UCF | 39 | 0 | No | Behavioral (5 mapped commits, Eraser silence) + source pin | ✓ OK |
| `PhysicsPaintRightPanel.test.ts` | QUICK-261111-UCF | 42 | 0 | No | Behavioral (one patch, live handler) | ✓ OK |
| `AquarelleGlobalsPanel.test.ts` | QUICK-261111-UCF | 17 | 0 | No | Behavioral (Reset batch) + source pin | ✓ OK |
| `BrushResponsePanel.test.ts` | QUICK-261111-UCF | 12 | 0 | No | Source pin; seam behavior covered in `aquarellePaintControls.test.ts` | ✓ OK (plan-prescribed) |

**Disabled tests on requirements:** 0 (the only `.pending` matches are a harness `pendingEffects` field).
**Circular patterns detected:** 0.
**Insufficient assertions:** 0.

### Decision Coverage

Skipped — quick task with no `*-CONTEXT.md` `<decisions>` block.

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`HACK`/`PLACEHOLDER` markers in any changed file; no stub returns added; the new module is fully implemented and imported by seven production modules. No `renderMode` references in any touched file. The working-tree dirty paths (`packages/efx-watercolor/probe/vector-spine/result.json`, `.red-evidence/` dirs) are unrelated and untouched by the three commits.

### Human Verification Required

1. **Live pick repaints the selected stroke (one undo)**
   - **Test:** In the running Studio, arm Select mode, select a hand-painted (or vector) stroke, then pick another brush from the top-bar dropdown (repeat once from a library card and once from a docker row).
   - **Expected:** The selected stroke repaints to the picked brush, the live brush also changes, the dropdown closes, and ONE undo reverts the repaint.
   - **Why human:** The fixtures use a fake appearance port; the real Studio port, canvas re-bake and visible one-undo result need the live app.

2. **Slider release edits the selection once; drag does not**
   - **Test:** With a paint stroke selected, drag and release top-bar Size/Water (plus Pigment/Edges/Grain), the Paint-tab Brush size, one global row and one Brush response row; then press Reset.
   - **Expected:** No selection edit during a drag; each release rewrites the selected stroke with that value and costs exactly one undo entry; Reset is one undo entry, never seven.
   - **Why human:** Release cadence + ledger outcome depend on the live gesture and Studio ledger path.

3. **Lift strokes stay untouched**
   - **Test:** With the Stroke-type filter on All, select only a lift (eraser) stroke, then pick a brush and release a paint slider.
   - **Expected:** The lift stroke is visually unchanged and no undo entry is created, while the live brush/tool still updates.
   - **Why human:** Visible proof that a lift stroke's pixels never change requires the live canvas.

### Gaps Summary

No gaps. All eight must-have truths are present, substantive, wired and covered by passing automated checks. The only remaining step is the visible live UAT recorded above — the plan itself requires that row before calling the feature shipped.

---

_Verified: 2026-11-11T21:26:36Z_
_Verifier: Claude (gsd-verifier)_
