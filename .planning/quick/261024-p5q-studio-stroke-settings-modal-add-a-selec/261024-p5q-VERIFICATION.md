---
phase: quick-261024-p5q
verified: 2026-10-24T17:47:12Z
status: human_needed
score: 7/8 must-haves verified
covered_files: [".planning/quick/261024-p5q-studio-stroke-settings-modal-add-a-selec/261024-p5q-PLAN.md", ".planning/quick/261024-p5q-studio-stroke-settings-modal-add-a-selec/261024-p5q-SUMMARY.md", "app/src/components/physic-paint/PhysicsPaintStudio.test.ts", "app/src/components/physic-paint/PhysicsPaintStudio.tsx", "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx", "app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx", "app/src/components/physic-paint/view/aquarelleRecordState.ts", "app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts", "app/src/components/physic-paint/view/aquarelleStrokeSelection.ts", "app/src/components/physic-paint/view/brushScriptEditionPort.test.ts", "app/src/components/physic-paint/view/brushScriptEditionPort.ts", "app/src/components/physic-paint/view/strokeSettingsModel.test.ts", "app/src/components/physic-paint/view/strokeSettingsModel.ts", "app/src/components/shared/NumericStepper.test.tsx", "app/src/components/shared/SliderStepper.test.tsx", "app/src/components/shared/SliderStepper.tsx", "packages/efx-physic-paint/src/engine/EfxPaintEngine.moveTranslate.test.ts", "packages/efx-physic-paint/src/engine/EfxPaintEngine.ts"]
covered_digest: "v3:sha256:49e08ba13bac94f8b8ec4c8676f8f192e543c9f6eb86485d8cde08b0db3265c4"
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 7/8
  gaps_closed:
    - "Mixed-selection swatch click wrote twice (wrapper pointerup + swatch click) and a bare click into the chip/hex field could collapse a mixed selection to the representative colour — closed by commit 9b420450 (picker-surface boundary guards, draft-only commits, three new pins)."
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "Water color intrinsic and color commits are ONE snapshot edit plus ONE re-bake: ONE aquarelle-script ledger entry on success, restoreAquarelleEditSnapshot on refusal, surfaced refusal copy, no in-flight interleaving."
    test: "Force the watercolor re-bake (applyAquarelleTimeline) to fail during a Stroke Settings appearance commit."
    expected: "The pre-edit script is restored exactly (one undo step back to the original appearance), the shared refusal copy is surfaced, the handler returns false, the dialog keeps its previous display/session value, and the in-flight flag clears."
    why_human: "No test drives the Studio handler's failure branch. The constituents are behaviorally tested in isolation (updateAquarelleStrokesInScript, beginAquarelleAppearanceEdit, restoreAquarelleEditSnapshot) but no test exercises handleAquarelleAppearanceStrokes itself; even its success ordering is not source-pinned (only the shared refusal-mapper call-site count is pinned)."
human_verification:
  - test: "Water color Select: edit pigment/water on selected strokes, then force or observe a refused re-bake (e.g. during an applying/locked state) and press Undo."
    expected: "The appearance edit restores exactly to its pre-attempt state, the refusal message is shown, and one undo returns to the original appearance."
    why_human: "The handler's restore-on-refusal branch has no behavioral test (behavior_unverified_items)."
  - test: "Brush Move: select a stroke; observe the dialog placement, Paint rows, dragging by the header, Escape with a focused value field vs outside it, close button, outside clicks, and empty-then-reselect reopen."
    expected: "320px card at the canvas region's top-right, seated under the picker step-aside; header drag with the 80px visibility clamp; Escape hides only outside editable fields; outside clicks never close; empty-then-reselect reopens; a non-empty reselect stays hidden."
    why_human: "Visual placement, drag feel and gesture-level dismissal are not observable through grep or unit tests."
  - test: "Select strokes with differing sizes/colours and drag one control once."
    expected: "'Mixed' readout with neutral track/segments and Mixed colour badge; the first gesture writes every selected stroke; untouched rows never change."
    why_human: "Mixed chrome and first-gesture semantics are visual/interaction behaviour."
  - test: "Colour gestures: drag the colour box (writes once on release), click one palette swatch once (writes once), type a hex + Enter (writes once), and focus the hex field on a mixed selection then click away without editing."
    expected: "One stroke write per gesture; the swatch pointerup performs no write; a bare click into the chip/hex field performs no write. Note: the unmodified picker emits onColorChange from the hex field's own onBlur even for an unchanged value, so leaving the field without an edit still reaches the wrapper's blur boundary and commits the first-selected representative once — plan-literal (blur is a listed boundary; a mixed first commit writes the representative) but worth confirming live."
    why_human: "Physical event ordering (pointerup/blur/click) and the shared picker's unconditional blur emission only occur in the real DOM."
  - test: "Water color Select: edit pigment/water on selected strokes; undo once."
    expected: "One re-bake, one ledger entry, one undo step."
    why_human: "Live pipeline timing and undo granularity."
  - test: "Geometry rows: type/drag X, Y, Scale (100 -> 120 -> 90), Scale X, Scale Y, Rotation about the selection centre; then change selection membership."
    expected: "Committed deltas are session-relative and compound; a refused watercolor commit keeps the previous value; membership change resets scale to 100% and rotation to 0."
    why_human: "Live transform feel and centre-of-rotation correctness are visual; this pass does not run the app."
  - test: "Confirm the right sidebar and top bar never mirror the dialog edits, and the shared colour picker still behaves as before in the sidebar."
    expected: "No mirrored writes; sidebar colour control byte-identical in behaviour."
    why_human: "Cross-surface isolation is a live UI observation."
---

# Phase quick-261024-p5q: Studio Stroke Settings Dialog Verification Report

**Phase Goal:** Studio stroke settings modal: add a selection-gated, movable dialog for the selected Studio stroke(s) in Brush Move and Water color Select — intrinsic per-stroke fields, the one shared color control, and session-relative geometry.
**Verified:** 2026-10-24T17:47:12Z
**Status:** human_needed
**Re-verification:** Yes — after post-verification fix `9b420450`

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Non-empty selection in Brush Move / Water color Select opens a movable 320px dialog at the canvas top-right; empty selection or inactive surface never renders it; Escape dismisses only outside editable fields; dismissal is written only by Escape/close; reopen only on the empty-to-non-empty edge; outside clicks never close. | ✓ VERIFIED | `PhysicsPaintStrokeSettingsDialog.tsx:83-99` (absolute top-right, width 320, zIndex 50, no backdrop), `:205-224` (surfaceActive + `resolveStrokeSettingsOpen`), `:212-215` (`shouldMarkSawEmpty` plain render-body flag), `:226-246` (capture-phase Escape, `closest('input, textarea, [contenteditable="true"]')` guard that returns before stopping propagation), `:248-252` (null when closed/empty), `:380-422` (dismiss + header drag with visibility clamp), `:445-454` (close). Laws at `strokeSettingsModel.ts:211-226`. Mounted inside `.physics-paint-canvas-region` under the picker step-aside at `PhysicsPaintStudioView.tsx:390-396`. Tests: `strokeSettingsModel.test.ts:376-534` (open law, non-empty-to-non-empty no-reopen, Escape inside vs outside, close, header drag). |
| 2 | Hydration: absolute when agreed, "Mixed" chrome when values differ; mixed representative = FIRST-SELECTED (`ReadonlySet` insertion order); untouched controls never write; first gesture writes every selected stroke. | ✓ VERIFIED | `strokeSettingsModel.ts:51-95` (locked field registries), `:154-181` (first-selected representative + mixed), `:184-197` (canonical patch builders); dialog `ids = [...selection]` at `PhysicsPaintStrokeSettingsDialog.tsx:250`, hydration at `:251`, rows at `:459-521` (each `onChange` writes the whole selection; no other write site). `SliderStepper.tsx:313,318,375,398,406` bypasses the equality guard only when `mixed`. Tests: `strokeSettingsModel.test.ts:240-355` (registry + absolute/mixed/insertion order), `:583-683` (full field sets, mixed chrome incl. smoothing), `SliderStepper.test.tsx:243-345`. |
| 3 | Brush intrinsic and color commits are ONE engine batch edit plus ONE retained-script flush: drain first, redo cleared, no new undo checkpoint, one redraw, one 'move' completion, one flush. | ✓ VERIFIED | `EfxPaintEngine.ts:4138-4156` (`getStrokeAppearance`, narrow copies), `:4169-4230` (`setStrokeAppearance`: whole-patch validation, drain at `:4190`, compare-then-write, 0-change no-op at `:4222`, else redo clear + one redraw + ONE `notifyCompletedMutation('move', changed[0])` at `:4224-4228`, no undo push). `brushScriptEditionPort.ts:277-314` (read subscribes `brushScriptRevision`; apply is lock-gated, declares the edit base, ONE engine call, ONE flush only when changes > 0). Tests: `EfxPaintEngine.moveTranslate.test.ts` 25/25 including the 6 appearance cases; `brushScriptEditionPort.test.ts` 26/26. |
| 4 | Water color intrinsic/color commits are ONE snapshot edit plus ONE re-bake: objects replaced (never mutated), entry regenerated with `toStudioStroke` at the SAME payloadTimeline index, one revision bump, reset sheet then `applyAquarelleTimeline`, ONE ledger entry on success, `restoreAquarelleEditSnapshot` on refusal, no in-flight interleaving. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Present and wired: `aquarelleRecordState.ts:489-548` (whole-patch validation against the canonical eight keys, resolve-before-mutate, replaced stroke + same-index `toStudioStroke` entry at `:535-545`, one bump at `:546`), `aquarelleStrokeSelection.ts:130-147` (read via `aquarelleStrokesOnFrame`), `:504-517` (`beginAquarelleAppearanceEdit`: ghost clear, in-flight guard, snapshot pair, null on zero change). Studio handler `PhysicsPaintStudio.tsx:5749-5802` (peek-only guards, frame filter, begin edit, in-flight true, reset sheet, await re-bake, record ONE ledger entry or `restoreAquarelleEditSnapshot(editId, 'undo')` + refusal copy, finally clears the flag). Bundle wiring `:7317-7331`. Constituents behaviorally tested (`aquarelleStrokeSelection.test.ts:302-449`); the handler's failure branch is never exercised, and its success ordering is not source-pinned either — only the shared refusal-mapper call-site count is (`PhysicsPaintStudio.test.ts:2425-2443`). See `behavior_unverified_items`. |
| 5 | Color reuses `RightPanelColorTab` UNMODIFIED as the only picker; live `onColorChange` feeds a dialog draft only; exactly one stroke write per commit boundary detected by the dialog wrapper (color-box/hue-strip pointerup, color-chip change, hex Enter/blur, swatch click); sidebar/top-bar usage byte-identical. | ✓ VERIFIED | Shared picker untouched (`git diff 9488cd0f..HEAD -- RightPanelColorTab.tsx` empty). Draft-only live path `PhysicsPaintStrokeSettingsDialog.tsx:267-271`; single write `:284-292` (requires a draft emitted for the current selection, dedupe baseline keyed by the selection Set); boundary guards `:294-320` (only `.physics-paint-color-box`/`.physics-paint-hue-strip` pointerup, `.physics-paint-color-chip` change, Enter on `.physics-paint-hex-input`, `.physics-paint-swatch` click); blur deferred one microtask `:322-330`; wiring `:526-546`. Selector names verified against `RightPanelColorTab.tsx:182,201,219,227,246`. New pins from fix `9b420450`: `strokeSettingsModel.test.ts:789-810` (swatch pointerup writes nothing, click writes once), `:812-832` (bare chip/hex clicks write nothing), `:834-843` (draftless blur writes nothing), `:705-787` (one write per boundary, mixed-first-commit, per-selection baseline reset). Previous double-write human item is closed. |
| 6 | Geometry rows (X/Y, uniform scale, Scale X/Y, rotation) apply session-relative deltas through the existing move/transform commits; every row is a `commitOnRelease` free-entry SliderStepper; baseline advances ONLY on a true result; refused commit keeps the previous value; membership change re-baselines scale to 100% and rotation to 0; no persistence. | ✓ VERIFIED | `strokeSettingsModel.ts:268-395` (fresh session, declared ranges 10..1000 / -360..360, integer-px move delta with sub-pixel refusal, per-control factor/delta law, uniform compounds axis displays, every transform anchored at the centre); dialog `:341-378` (session keyed by the selection Set; written ONLY in the promise continuation after `true`; X/Y commit typed delta) and `:549-631` (all six rows `freeEntry` + `commitOnRelease`). Tests: `strokeSettingsModel.test.ts:884-1015` (identity, compounding, independent axes, rotation delta, clamps/refusals, integer deltas), `:1016-1140` (rows, awaited true-only, refused keeps session, re-baseline on membership change, no persistent record). |
| 7 | The dialog is the only editing surface: it never writes Studio globals/settings/top bar/right panel and never reads them back; shared `ScriptStrokeEditionPort`, legacy inline editor, schema/persistence untouched; no new dependency. | ✓ VERIFIED | Dialog imports only selection reads (`scriptSelectedStrokeIds`, `scriptSelectMode`), `scriptStrokeSelectionBox`, the supplied bundle and the shared picker (`PhysicsPaintStrokeSettingsDialog.tsx:1-25`); no settings/global store write. Studio body does not read `scriptSelectedStrokeIds` (grep: no match in `PhysicsPaintStudio.tsx`). Guardrail paths empty in `git diff 9488cd0f..HEAD`: `RightPanelColorTab.tsx`, `scriptStrokeEdition.ts`, `physicsPaintStudio.css`, `PaintOverlay.tsx`, `paintStore.ts`, `package.json`, `pnpm-lock.yaml`, `app/package.json`. Bundle chosen by active module at `PhysicsPaintStudio.tsx:7303-7348`. Structural pin `strokeSettingsModel.test.ts:866-874`. |
| 8 | All state is `@preact/signals` (no useState); dismissal, draft color, geometry session and drag offset written only in pointer/key handlers or stepper/color callbacks — never in an effect; the Studio render body never subscribes the stroke-selection signals; all new styling inline. | ✓ VERIFIED | No `useState` in `strokeSettingsModel.ts` or `PhysicsPaintStrokeSettingsDialog.tsx` (grep none; pin at `strokeSettingsModel.test.ts:866-874`). Ref-held signals `:186-203`; signal writes only at `:239` (Escape), `:270` (draft), `:363` (async session continuation), `:381` (close), `:417` (drag); the single render-body write is the plain module flag `:212-215`, explicitly mandated by the plan. The only effect installs the Escape listener (`:226-246`) and writes no state. Dialog styling is inline (`:83-181`); `physicsPaintStudio.css` unchanged; Studio body has no stroke-selection read (grep). |

**Score:** 7/8 truths verified (1 present, behavior-unverified)

### Deferred Items

None. The 32 full-engine-suite failures are pre-existing at base `9488cd0f` and are outside this quick's scope (neither gap nor deferral). The post-fix pass did not re-run the full engine suite; the fix touched no engine file, and the engine appearance file still passes 25/25.

### Advisory (New Scope, Unevidenced)

None. Re-verification produced no new-scope Step 7 findings requiring an advisory entry.

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `app/src/components/physic-paint/view/strokeSettingsModel.ts` | Field registry, mixed readers, patch builders, bundle types, pure geometry law | ✓ VERIFIED | 395 lines, pure (no Preact/signals/DOM); consumed by the dialog and Studio; 47-test suite covers it. |
| `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` | Movable selection-gated dialog (fields, color wrapper, geometry, dismissal) | ✓ VERIFIED | 637 lines; imported at `PhysicsPaintStudioView.tsx:28` and rendered at `:394-396`; memoized alias exported at `:636`. |
| `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx` | Dialog mount inside the canvas region | ✓ VERIFIED | Prop declared `:333`, destructured `:354`, mounted `:394-396` inside `.physics-paint-canvas-region` (`:378`), gated by `!pickerOpen`. |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | View-supplied bundle; watercolor appearance handler; boolean watercolor move/transform | ✓ VERIFIED | Bundle assembled `:7303-7348` (module-keyed identity memo at `:846`), passed to the view model `:7358`; `handleAquarelleAppearanceStrokes` `:5749-5802`; move/transform return `Promise<boolean>`. |
| `app/src/components/physic-paint/view/brushScriptEditionPort.ts` | Brush appearance read/apply with one flush per commit | ✓ VERIFIED | `:277-314`; one engine call + one flush when changes > 0; lock/empty/empty-patch guards; 26 tests. |
| `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` | Watercolor appearance read + snapshot edit | ✓ VERIFIED | `readAquarelleStrokeAppearance` `:130-147`; `beginAquarelleAppearanceEdit` `:504-517`; 20 tests. |
| `app/src/components/physic-paint/view/aquarelleRecordState.ts` | Per-stroke params/color script update | ✓ VERIFIED | `updateAquarelleStrokesInScript` `:489-548`: replaced objects, same-index regenerated entry, one revision bump, canonical key whitelist. |
| `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` | `getStrokeAppearance` + `setStrokeAppearance` under the Move-commit law | ✓ VERIFIED | `:4138-4230`; nine-key whitelist `:464-467`, validate-before-mutate, drain, compare-then-write, one move notification; engine appearance file 25/25. |
| `app/src/components/shared/SliderStepper.tsx` | Optional mixed display and mixed-first-gesture commit | ✓ VERIFIED | `mixed?: boolean` `:56-64`, "Mixed" readout `:123-127,277`, neutral fill `:415-416`, mixed class `:427`, equality guards bypassed only when mixed `:313,318,375,398,406`; mixed suite 24/24. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| Dialog hydration | `bundle.readAppearance` → engine / watercolor registry | `PhysicsPaintStrokeSettingsDialog.tsx:251`; `PhysicsPaintStudio.tsx:7339-7341, 7323-7325` | ✓ WIRED | Brush read calls engine `getStrokeAppearance` behind `engineHoldsBrushScriptFrame`; watercolor reads via `aquarelleStrokesOnFrame`; readers subscribe the revision signals so a commit re-reads. |
| Field commit | `bundle.applyAppearance` → brush port OR watercolor handler | `PhysicsPaintStrokeSettingsDialog.tsx:459-521`; `PhysicsPaintStudio.tsx:7326-7327, 7341-7342` | ✓ WIRED | Brush: one `setStrokeAppearance` + one flush. Watercolor: begin edit → reset sheet → re-bake → record/rollback. |
| `setStrokeAppearance` 'move' | frame dirty → port flush → `brushScriptRevision` → dialog re-read | `EfxPaintEngine.ts:4224-4228`; `brushScriptEditionPort.ts:306-313` | ✓ WIRED | Test-pinned (one notification naming the first changed id; one flush). |
| Geometry commit | `geometryTransform`/`geometryMoveDelta` → `bundle.transformStrokes`/`moveStrokes` → existing commits | `PhysicsPaintStrokeSettingsDialog.tsx:341-378, 549-631`; `PhysicsPaintStudio.tsx:7328-7329, 7343-7344` | ✓ WIRED | Session advances only in the promise continuation after `true`; selection centre from `scriptStrokeSelectionBox(bundle.listStrokes(...))` at `:345-351`. |
| Color control | live `onColorChange` → draft; wrapper boundaries → `applyAppearance({ color })` | `PhysicsPaintStrokeSettingsDialog.tsx:267-330, 526-546` | ✓ WIRED | Draft-only live path; picker-surface guards; dedupe baseline per selection Set; three new pins from `9b420450`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| Paint rows | `appearances` | `bundle.readAppearance` → engine `getStrokeAppearance` (brush) / recorded aquarelle registry | Yes — real per-stroke params/color, no literals | ✓ FLOWING |
| Mixed flags / representative | derived from `appearances` + selection order | Same real reads | Yes | ✓ FLOWING |
| Color picker | `colorReading` + draft | `readColorField` over real appearances; commits through `applyAppearance` | Yes | ✓ FLOWING |
| Geometry centre / X-Y rows | `selectionBox` | `scriptStrokeSelectionBox(bundle.listStrokes(playFrame, canvasSize))` (`:345-351`) → real stroke bounds | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Targeted suites (model/dialog, watercolor selection, brush port, SliderStepper) | `pnpm --filter efx-motion-editor exec vitest run strokeSettingsModel.test.ts aquarelleStrokeSelection.test.ts brushScriptEditionPort.test.ts SliderStepper.test.tsx.test.ts` | 4 files passed, 117/117 tests (`strokeSettingsModel.test.ts` 47/47) | ✓ PASS (re-run during this verification) |
| Full app suite | `pnpm --filter efx-motion-editor exec vitest run` | 331 files passed, 2 skipped; 5983 passed, 1 skipped, 96 todo (6080 total) | ✓ PASS (reproduced; +3 tests vs the pre-fix 5980 = the three new color pins) |
| Engine appearance file | `pnpm --filter efx-motion-editor exec vitest run --root ../packages/efx-physic-paint src/engine/EfxPaintEngine.moveTranslate.test.ts` | 25/25 passed | ✓ PASS |
| App typecheck | `pnpm --filter efx-motion-editor run typecheck` | clean | ✓ PASS |
| Engine check | `pnpm --filter @efxlab/efx-physic-paint run check` | clean | ✓ PASS |
| Engine package build | `pnpm --filter @efxlab/efx-physic-paint build` | success (DTS build success) | ✓ PASS |
| Commit ledger | `git merge-base --is-ancestor` for 3b7d1139, c00c6088, 4f430e68, 9b420450; `git rev-list --count 9488cd0f..HEAD` | all four ancestors; count = 4 | ✓ PASS |
| Guardrail files untouched | `git diff --name-only 9488cd0f..HEAD -- <guardrails>` | empty | ✓ PASS |
| Debt-marker scan of modified source files | `grep -n -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` | no matches | ✓ PASS |
| Disabled/circular test scan | `grep -n -E "it\.skip\|describe\.skip\|test\.skip\|xit\(\|xdescribe\(\|xtest\(\|\.pending\|it\.todo\|test\.todo"`; fixture-write scan | no disabled tests; no circular fixture writes | ✓ PASS |

### Probe Execution

Not applicable — the quick declares no probes and no `scripts/*/tests/probe-*.sh` exists.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| None declared | `261024-p5q-PLAN.md` (`requirements-completed: []`) | Quick task with no requirement IDs | N/A | No `.planning/REQUIREMENTS.md` mapping applies |

### Test Quality Audit

| Test File | Linked Truth | Active | Skipped | Circular | Assertion Level | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| `app/src/components/physic-paint/view/strokeSettingsModel.test.ts` | 1, 2, 5, 6 | 47 | 0 | none | Value + Behavioral | PASS |
| `app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts` | 4 | 20 | 0 | none | Value + Behavioral (constituents only) | PASS — handler refusal remains behavior-unverified |
| `app/src/components/physic-paint/view/brushScriptEditionPort.test.ts` | 3 | 26 | 0 | none | Value + Behavioral | PASS |
| `app/src/components/shared/SliderStepper.test.tsx` (via `.test.tsx.test.ts` launcher) | 2 | 24 | 0 | none | Value | PASS |
| `packages/efx-physic-paint/src/engine/EfxPaintEngine.moveTranslate.test.ts` | 3 | 25 (6 appearance) | 0 | none | Value | PASS |
| `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` | 3, 4, 7 | 260 | 0 | none | Structural pins | PASS — the appearance handler contributes only the refusal-mapper count pin; no sequence/refusal execution |

**Disabled tests on requirements:** 0.
**Circular patterns detected:** 0.
**Insufficient assertions:** 0 for the delivered model/engine/port/dialog behavior. Coverage note (non-blocking): the wrapper's positive `onChange` (color chip) and Enter (hex) boundaries have no direct positive test; their code paths are identical to the tested draft-then-commit shape, and the negative guards are pinned.

### Decision Coverage

No trackable decisions in CONTEXT.md. (`decision_coverage: {honored: 0, total: 0, not_honored: []}`, gate skipped, non-blocking.)

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| — | — | No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers; no stub returns; no disabled tests in the changed files | — | None |

The two unplanned test-file edits remain assertions-only pin updates, not behaviour changes: `PhysicsPaintStudio.test.ts` updated counts/signatures; `NumericStepper.test.tsx` replaced a single-path exception with an explicit two-entry `freeEntry` allow-list required by the plan-mandated free-entry geometry rows.

### Human Verification Required

#### 1. Watercolor refusal rollback (behavior-unverified truth 4)

**Test:** In Water color Select, commit a pigment/water appearance edit while the re-bake can fail (or force a refusal), then Undo.
**Expected:** The pre-edit script is restored exactly, the shared refusal message surfaces, the dialog keeps its previous value, and one undo returns to the original appearance.
**Why human:** No test exercises `handleAquarelleAppearanceStrokes`'s failure branch; the constituents are tested in isolation only.

#### 2. Dialog presence, drag and dismissal (UAT rows 1, 2, 7)

**Test:** Select a stroke in Brush Move; drag by the header; press Escape with a value field focused and outside it; click outside; reselect non-empty; empty then reselect.
**Expected:** 320px card top-right, 80px visibility clamp, Escape ignored inside editable fields, outside clicks never close, non-empty reselect stays hidden, empty-then-select reopens, offset resets on reopen.
**Why human:** Visual placement, drag feel and gesture-level dismissal.

#### 3. Mixed chrome and first-gesture commit (UAT row 3)

**Test:** Select strokes with differing sizes/colours; drag one control once.
**Expected:** "Mixed" readout, neutral track/segments, Mixed colour badge from the first-selected stroke; the first gesture writes every selected stroke; untouched rows stay unchanged.
**Why human:** Visual/interaction semantics.

#### 4. Colour gesture write counts (UAT row 4, now fixed path)

**Test:** Drag the colour box once (writes on release), click one palette swatch once (writes once), type a hex + Enter (writes once). Separately, on a mixed selection focus the hex field and click away without editing.
**Expected:** One write per gesture; swatch pointerup writes nothing; bare chip/hex clicks write nothing. The unchanged-hex blur is a plan-literal boundary: the shared picker's own `onBlur` emits `onColorChange` unconditionally (`RightPanelColorTab.tsx:86-94,233`), so the wrapper's deferred blur commit (`PhysicsPaintStrokeSettingsDialog.tsx:322-330`) writes the first-selected representative once. Confirm this is acceptable or request a suppression.
**Why human:** Physical pointer/blur ordering only exists in the live DOM.

#### 5. Watercolor live re-bake and undo (UAT row 5)

**Test:** Edit pigment/water on selected watercolor strokes; undo once.
**Expected:** One re-bake, one ledger entry, one undo step.
**Why human:** Live pipeline timing and undo granularity.

#### 6. Geometry live semantics (UAT row 6)

**Test:** Use X/Y, uniform Scale (100 -> 120 -> 90), Scale X/Y and Rotation; change selection membership.
**Expected:** Session-relative compounding, rotation about the union-box centre, refused commit keeps the previous value, membership change resets scale/rotation.
**Why human:** Live transform feel and centre correctness.

#### 7. Sidebar/top-bar isolation (UAT row 8)

**Test:** Use the dialog in both modules; compare the right sidebar and top bar; use the shared colour control in the sidebar.
**Expected:** No mirrored writes; sidebar colour behaviour unchanged.
**Why human:** Cross-surface live observation.

### Gaps Summary

No blocking gaps. All 9 artifacts exist, are substantive and wired; all 5 key links verify. The post-verification fix `9b420450` is confirmed in the codebase: the color wrapper now commits only on the picker's own surfaces and only a draft the picker emitted for the current selection, with three new pins (swatch pointerup no-write / click single-write, bare chip/hex clicks no-write, draftless blur no-write). The previous human-verification item about the mixed-selection swatch double write is closed. Seven of eight truths are verified; the watercolor snapshot+re-bake+rollback truth remains present and wired but its refusal transition is not exercised by any test (and its success ordering is only indirectly pinned), so it is recorded as behavior-unverified and routed to human verification. All reported gates reproduce: targeted 117/117, full app 331 files / 5983 passed, engine appearance 25/25, typecheck/check/build clean, guardrail files untouched. The remaining human work is the live UAT rows plus the watercolor refusal rollback.

---

_Verified: 2026-10-24T17:47:12Z_
_Verifier: Claude (gsd-verifier)_
