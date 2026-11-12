---
phase: 61-vector-painting-tool
reviewed: 2026-11-12T11:13:48Z
depth: standard
files_reviewed: 68
files_reviewed_list:
  - app/src-tauri/src/models/project.rs
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
  - app/src/components/physic-paint/engine/VectorPathOverlay.test.ts
  - app/src/components/physic-paint/engine/VectorPathOverlay.tsx
  - app/src/components/physic-paint/engine/aquarelleStrokeBridge.test.ts
  - app/src/components/physic-paint/hooks/usePhysicsPaintStudioKeyboard.test.ts
  - app/src/components/physic-paint/hooks/usePhysicsPaintStudioKeyboard.ts
  - app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts
  - app/src/components/physic-paint/performance/scriptTimelineCodec.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts
  - app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
  - app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx
  - app/src/components/physic-paint/view/BrushResponsePanel.test.ts
  - app/src/components/physic-paint/view/BrushResponsePanel.tsx
  - app/src/components/physic-paint/view/BrushesDocker.test.tsx
  - app/src/components/physic-paint/view/BrushesDocker.tsx
  - app/src/components/physic-paint/view/PhysicsPaintBrushMenu.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx
  - app/src/components/physic-paint/view/PhysicsPaintBrushPicker.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
  - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
  - app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts
  - app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx
  - app/src/components/physic-paint/view/aquarellePaintControls.test.ts
  - app/src/components/physic-paint/view/aquarellePaintControls.ts
  - app/src/components/physic-paint/view/aquarellePresetSelection.test.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.reopenAnchorColor.test.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.test.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
  - app/src/components/physic-paint/view/brushMenuPresets.ts
  - app/src/components/physic-paint/view/strokeSettingsModel.test.ts
  - app/src/components/physic-paint/view/strokeSettingsModel.ts
  - app/src/components/physic-paint/view/vectorPathHandles.test.ts
  - app/src/components/physic-paint/view/vectorPathHandles.ts
  - app/src/components/physic-paint/view/watercolorStrokeThumb.test.ts
  - app/src/components/physic-paint/view/watercolorStrokeThumb.ts
  - app/src/components/shared/SliderStepper.test.tsx
  - app/src/components/shared/SliderStepper.tsx
  - app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts
  - app/src/efx-paint/compositor/vectorStrokeExportParity.test.ts
  - app/src/lib/mceFieldContract.test.ts
  - app/src/types/project.ts
  - packages/efx-watercolor/probe/vector-spine/probe.ts
  - packages/efx-watercolor/probe/vector-spine/run.mjs
  - packages/efx-watercolor/src/adapter/engineAdapter.test.ts
  - packages/efx-watercolor/src/adapter/engineAdapter.ts
  - packages/efx-watercolor/src/determinismContract.test.ts
  - packages/efx-watercolor/src/payload/codec.test.ts
  - packages/efx-watercolor/src/payload/codec.ts
  - packages/efx-watercolor/src/payload/toStudioStroke.test.ts
  - packages/efx-watercolor/src/payload/toStudioStroke.ts
  - packages/efx-watercolor/src/payload/vectorPath.test.ts
  - packages/efx-watercolor/src/payload/vectorPath.ts
  - packages/efx-watercolor/src/playground/Engine.ts
  - packages/efx-watercolor/src/playground/brushes.ts
  - packages/efx-watercolor/src/playground/shaders.ts
  - packages/efx-watercolor/src/vector/spine.test.ts
  - packages/efx-watercolor/src/vector/spine.ts
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
  necessity: 1
status: issues_found
---

# Phase 61: Code Review Report

**Reviewed:** 2026-11-12T11:13:48Z
**Depth:** standard
**Files Reviewed:** 68
**Status:** issues_found

## Summary

Scope: the five follow-up quicks landed since `5184dc41` — the selection edit port for brush/paint-control patches, the SliderStepper commit boundary, routing brush picks and paint sliders onto selected strokes, removal of the Stroke Settings Paint tab (Curve + Vertex size moved to Geometry), and per-vertex colour (anchor `color` through AQTL v2, the `.mce` Rust model, and the engine). No `<structural_findings>` block was provided, so this report contains narrative findings only. Already-dispositioned 61-REVIEW findings were not re-litigated.

The per-vertex colour data path itself is sound. AQTL v2 round-trips: the per-anchor colour presence byte, the verbatim string written last per anchor, the all-or-nothing per-path flag, and the `MIN_ANCHOR_BYTE_LENGTH` lower bound all hold together (`app/src/components/physic-paint/performance/scriptTimelineCodec.ts:540-555, 588-623, 842-845, 859-908`). The Rust model is declaration-only with `#[allow(dead_code)]` and cannot mis-serialize. The engine carries colours once per render and restores `strokeBasePigment` on every stroke-exit path, including `ending` and the `stampScripted` try/finally (`packages/efx-watercolor/src/playground/Engine.ts:888-933, 1679-1703, 1739-1800`). `recordedCurveModeField` writes `curveMode: 'spline'` explicitly for new paths (`packages/efx-watercolor/src/payload/vectorPath.ts:108-112`), `resampleVectorPaintPoints` terminates (step floor 0.008, 20000 cap), and the renderMode removal leaves no dangling references (`presetFor` falls back to `'round'`). Stroke rejection paths in `updateAquarelleStrokesInScript` validate params, colour, brushId, and toolOverrides before mutating.

Three defects remain in the new boundary surface. **CR-01**: the one-edit anchor-colour commit publishes a false refusal banner for an *unchanged* colour because the Color tab has no equality guard on its commit emission — directly violating the file's own stated law that a null edit id for a readable path "must publish nothing". **WR-01**: the entire paint-control seam is fire-and-forget (`void`), so a refused selection edit silently desynchronizes the live control value from the selected strokes. **WR-02**: the new orphan-focus window key route dispatches every Studio shortcut with no floating-surface guard, while the Stroke Settings dialog has no autofocus and only an Escape capture handler — destructive and tool-switching shortcuts reach the shell while the dialog is open. One necessity finding (**IN-01**): `brushMenuPresets(_target)` ignores its parameter.

## Narrative Findings (AI reviewer)

### CR-01: Unchanged per-vertex colour commit publishes a false "refused" banner

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:7487`
**Severity:** BLOCKER
**Issue:** The anchor-colour branch of `handleRightPanelColorCommit` treats `editId === null` as a refusal and publishes `ANCHOR_COLOR_COMMIT_REFUSED_MESSAGE` (lines 7487-7492). But `commitAquarelleVectorPathEdit` returns `null` in two very different cases: (a) a genuine refusal, and (b) an **unchanged** gesture. For (b) the chain is: `updateAquarellePathInScript` returns 0 via `anchorsEqual` (`app/src/components/physic-paint/view/aquarelleRecordState.ts:1056`) → `beginAquarellePathEdit` returns `null` (`app/src/components/physic-paint/view/aquarelleStrokeSelection.ts:1040`) → `commitAquarelleVectorPathEdit` returns `null` (`PhysicsPaintStudio.tsx:10264`).

The no-change case is reachable on the common path because nothing upstream guards it:
- `RightPanelColorTab.emitColorCommit` calls `props.onColorCommit?.(normalized, ...)` with no equality check (`app/src/components/physic-paint/view/RightPanelColorTab.tsx:159-166`), and several emit sites fire on pointer-up/blur regardless of whether the colour moved: colour box pointer-up (284-288), hue strip pointer-up (308-312), hex blur (335-337), colour chip change (325), swatch click (364-368).
- `buildAnchorColorCommit` returns a fresh anchor list whenever the selection is non-empty and the colour is valid (`app/src/components/physic-paint/view/vectorPathHandles.ts:598-618`); it never returns a no-op list.

Result: clicking the colour box and releasing without moving, re-picking the same swatch, or typing the same hex with anchors selected publishes an error banner and sets `applyStatus='error'` + `lastError`, while nothing was wrong. This contradicts the commit's own docstring: "A null edit id for a READABLE path is an in-flight or unchanged gesture, which must **publish nothing**" (`PhysicsPaintStudio.tsx:10331-10335`).

**Fix:** Either guard at the source or make the sentinel distinguish the two cases. Emission-side guard (smallest change):

```ts
const next = buildAnchorColorCommit(anchors, anchorSelection, color);
if (next !== null) {
  // Same colour on every anchor = unchanged gesture: publish nothing.
  if (next.every((anchor, index) => anchor.color === anchors[index]?.color)) return;
  void commit(target, next).then((editId) => {
    if (editId !== null) return;
    setApplyMessage(ANCHOR_COLOR_COMMIT_REFUSED_MESSAGE);
    setApplyStatus('error');
    setLastError(ANCHOR_COLOR_COMMIT_REFUSED_MESSAGE);
  });
  return;
}
```

Alternative: return `undefined` from `commitAquarelleVectorPathEdit` for "unchanged, nothing committed" versus `null` for a genuine refusal, and publish only on `null`.

### WR-01: Paint-control seam swallows refusals; live value and selected strokes silently diverge

**File:** `app/src/components/physic-paint/view/aquarellePaintControls.ts:42-85`
**Severity:** WARNING
**Issue:** The port contract says `commitAquarelleSelectionAppearance` resolves `false` on refusal and `null` when no attempt was made (`app/src/components/physic-paint/view/aquarelleStrokeSelection.ts:690-708`), and `handleAquarelleAppearanceStrokes` returns `false` with no publication for its guard refusals (`PhysicsPaintStudio.tsx:9188-9196`). Every caller, however, discards the result with `void`:

- `app/src/components/physic-paint/view/aquarellePaintControls.ts:42-85` (`pickAquarelleBrush`, `commitAquarelleSelectionParam`, `commitAquarelleSelectionParams`, `commitAquarelleSelectionMultiplier`)
- `app/src/components/physic-paint/view/BrushesDocker.tsx:86, 213`
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx:465`
- `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx:87`
- `app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx:78, 93`
- `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx:354, 366, 378, 391, 404`
- `app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx:185`
- `app/src/components/physic-paint/view/BrushResponsePanel.tsx:95`

Because these controls write the live value first and commit second, a refusal leaves the slider/top-bar showing the new value while the selected strokes keep the old one, with no message. The user sees "applied" and gets "not applied". Only the anchor-width path (`applyAnchorWidths` → `publishRefusal`, `PhysicsPaintStudio.tsx:11696-11724`) and the stroke colour path report refusals today.

**Fix:** Publish on `=== false` at the visible value controls, mirroring the anchor-width path. A focused wrapper keeps the call sites honest:

```ts
const commitSelection = (promise: Promise<boolean> | null) => {
  void promise?.then((ok) => {
    if (!ok) publishRefusal(/* selection edit message */);
  });
};
```

If a banner is too noisy for brush picks, the alternative is to roll the live setter back to the previous value on refusal — but silent divergence should not be the default.

### WR-02: Orphan-focus window key route has no floating-surface guard

**File:** `app/src/components/physic-paint/hooks/usePhysicsPaintStudioKeyboard.ts:33-41`
**Severity:** WARNING
**Issue:** The new bubble-phase `window` keydown route (added in `e85682d96`) dispatches the full Studio shortcut handler whenever `document.activeElement` is `body`, `documentElement`, or `null`:

```ts
const active = document.activeElement;
if (active !== null && active !== document.body && active !== document.documentElement) return;
handlerRef.current(event);
```

Before this hook, keydown targeted at `body` never bubbled through the shell `<section tabIndex={0} onKeyDown>` (body is an ancestor, not a descendant), so no Studio shortcut fired with focus orphaned. The new path has no floating-surface guard. Combined with the dialog surfaces:

- `PhysicsPaintStrokeSettingsDialog` renders `role="dialog"` with **no** `aria-modal` and **no** `.focus()`/`autoFocus` anywhere (`app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx:901`; grep confirms zero focus calls). Its only capture handler consumes Escape (635-656), so Delete, Space, bare tool keys, arrows, undo/redo, Shift+R/A, and C (the confirm-guarded clear) all reach the shell handler.
- `PhysicsPaintScriptPickerDialog` declares `aria-modal="false"` (109) and the Play Script dialog has no `aria-modal` at all, so the document-wide `[aria-modal="true"]` guards (`app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts:123, 240, 262, 273`) suspend nothing for them.

Reachable regression: open Stroke Settings, click a slider track (or any non-focusable area in the dialog), press Delete — `isPhysicsPaintShortcutTarget` accepts body (110-116), the destructive stroke-Delete branch (240) finds no `[aria-modal="true"]`, and the stroke under the open dialog is deleted. The same path silently switches the active tool or scrubs with arrows behind the dialog.

**Fix:** Make the new route stand down when any floating surface is present, and give the settings dialog real modality semantics. Minimal guard:

```ts
const active = document.activeElement;
if (active !== null && active !== document.body && active !== document.documentElement) return;
if (document.querySelector('[role="dialog"], [data-physics-paint-floating]')) return;
handlerRef.current(event);
```

Also add `aria-modal="true"` plus initial focus to `PhysicsPaintStrokeSettingsDialog`; if it is intentionally non-modal, focus a container on open and stop non-Escape keys in a capture handler while it is visible.

### IN-01: `brushMenuPresets` parameter is dead generality

**File:** `app/src/components/physic-paint/view/brushMenuPresets.ts:15-17`
**Severity:** INFO
**Category:** necessity
**Issue:** `brushMenuPresets(_target: BrushMenuTarget)` ignores `_target` and returns `BRUSH_PRESETS` unconditionally, so both the brush and eraser/lift popovers receive the identical list. The `BrushMenuTarget` type and parameter encode a distinction with no implementation — no instantiation anywhere makes the parameter observable. The module docstring itself states both branches "pick a TIP SHAPE from the same shipped preset list", and the function body is a single `return`, so the state the parameter guards against (diverging lists) is structurally guaranteed not to occur. Evidence: the whole file is 17 lines and the exported function is the only consumer of `BrushMenuTarget`.
**Fix:** Drop the parameter and the `BrushMenuTarget` type at the call sites, or add the intended divergence alongside a test that distinguishes the two branches.

---

**Scope notes:** Performance findings are out of v1 scope. Test files were checked only for reliability (no flaky-pattern or missing-assertion findings). The probe files (`packages/efx-watercolor/probe/vector-spine/*`) and `*.test.*` entries are listed in `files_reviewed_list` for exact scope fidelity.

_Reviewed: 2026-11-12T11:13:48Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
