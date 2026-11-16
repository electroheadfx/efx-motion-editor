---
phase: quick/261116-gcn
verified: 2026-11-16T11:43:41Z
status: human_needed
score: 6/7 must-haves verified
covered_files: [".planning/quick/261116-gcn-in-studio-head-top-bar-add-a-2nd-dropdow/261116-gcn-PLAN.md", ".planning/quick/261116-gcn-in-studio-head-top-bar-add-a-2nd-dropdow/261116-gcn-SUMMARY.md", "app/src/components/physic-paint/physicsPaintStudio.css", "app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx", "app/src/components/physic-paint/view/PhysicsPaintBrushPicker.test.ts", "app/src/components/physic-paint/view/PhysicsPaintRailMotionModal.test.ts", "app/src/components/physic-paint/view/PhysicsPaintStudioView.test.ts", "app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx", "app/src/components/physic-paint/view/PhysicsPaintTextureMenu.test.ts", "app/src/components/physic-paint/view/PhysicsPaintTextureMenu.tsx", "app/src/components/physic-paint/view/PhysicsPaintTextureModal.test.ts", "app/src/components/physic-paint/view/PhysicsPaintTextureModal.tsx", "app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts", "app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx", "app/src/components/physic-paint/view/aquarelleRecordState.ts", "app/src/components/physic-paint/view/floatingSheetStack.test.ts", "app/src/components/physic-paint/view/floatingSheetStack.ts"]
covered_digest: "v4:sha256:baf0eaa817af0fecbaf8a698ded31c2afa7a367fc0d6a3562fc71f8b5ad05f0c"
behavior_unverified: 1
overrides_applied: 0
behavior_unverified_items:
  - truth: "The Open modal action raises and opens a floating Textures sheet that is draggable, height-resizable, closes via its X, and only the front sheet consumes Escape."
    test: "Open the Textures sheet and drag its bottom resize handle through a real pointer sequence."
    expected: "The sheet height follows the pointer between the 240px floor and the viewport clamp, and the resized height survives close/reopen for the Studio session."
    why_human: "onResizePointerDown/Move and the textureModalResizeHeight write are present and wired, but no test invokes them (the modal suite only asserts the resize handle exists). Drag, X-close and the front-only Escape helper are behaviorally tested; the resize state transition is only presence-verified. Escape listener registration itself is also only source-pinned because the suite mocks useEffect."
human_verification:
  - test: "Open the Studio and click the second 'Textures' control inside the brush pill."
    expected: "A viewport-fixed popover appears under that control (not clipped by the top bar), with 'Open modal' as the first action, then a separator, then the compact 34px texture chips; clicking the trigger again, clicking outside, or pressing Escape closes it."
    why_human: "Placement, blur and clipping are visual judgments the vnode harness cannot see."
  - test: "Pick a texture chip, then inspect the brush response selection."
    expected: "The popover stays open, the chosen chip shows the selected accent, and the displayed brush response card is unchanged."
    why_human: "Real UI affordance and cross-axis state are visual."
  - test: "Click Open modal, drag the sheet header, drag the bottom resize handle, close with X, then reopen and press Escape while another sheet is front."
    expected: "The sheet appears one cascade step below the rail-motion sheet (76px top, 12px right), drags within the window, resizes between 240px and the viewport clamp, X closes it, and Escape closes only the front sheet."
    why_human: "The resize pointer sequence has no automated test (behavior-unverified); drag/resize ergonomics are visual."
  - test: "With paint strokes selected, drag the Size slider inside the Textures sheet, release, then press Undo."
    expected: "Live strokes follow the same shared Brush size as the top bar; release produces exactly one size undo entry; Undo restores the previous size; the watercolor engine, masks and recorded strokes are untouched."
    why_human: "Live rendering feel and undo affordance need the running app; the commit law itself is unit-proven."
  - test: "Open the brush dropdown, then open the brush catalog from Open modal."
    expected: "The dropdown shows Open modal, separator, preset list only (no texture strip); the catalog still shows the full texture row with its import controls."
    why_human: "Confirms the D-2 relocation visually in the live app."
---

# Quick 261116-gcn: Studio Textures axis Verification Report

**Task Goal:** In the Studio head top bar, add a 2nd dropdown near brushes for Textures with an open-modal option; inside the Textures modal add the Size slider/stepper so the texture is controllable by size.
**Verified:** 2026-11-16T11:43:41Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A second top-bar trigger labelled "Textures" (testid physics-texture-trigger) sits INSIDE the existing brush pill, after the tool trigger and before the Script switch; it opens a viewport-fixed popover whose FIRST action is "Open modal", followed by the compact texture strip. | ✓ VERIFIED | `PhysicsPaintTopBar.tsx:154-177` exports `TopBarTextureTrigger` with `data-testid="physics-texture-trigger"`, `aria-label="Textures"`, `data-watercolor-texture-trigger`; it is rendered inside `.physics-paint-topbar-brush-pill` after `TopBarBrushTrigger` and before `ScriptRecordingSwitch` (lines 465-493). `toggleTextureMenu` (lines 414-422) opens at `rect.bottom + 6`. `PhysicsPaintTextureMenu.tsx` root is the fixed popover with the Open-modal button first, then the separator, then the compact strip (lines 81-99); CSS `.physics-paint-texture-menu` is `position: fixed`. TopBar suite proves seat order, rect anchoring and source pins; TextureMenu suite proves Open-modal-first ordering and `compact` strip. |
| 2 | A texture chip pick writes aquarelleSelectedTextureId only and keeps the popover open; the response selection is untouched. | ✓ VERIFIED | `WatercolorTextureStrip.tsx:99` calls only `setAquarelleSelectedTextureId(textureId)`. Test "a chip pick writes only the texture and keeps the popover open" materializes the chip, clicks it, and asserts texture = `wc/builtin-chalk`, tip still `chalk`, menu open still true. |
| 3 | The brush dropdown no longer shows any texture strip — it is Open modal, separator, preset scroller (the lift branch is unchanged). | ✓ VERIFIED | `PhysicsPaintBrushMenu.tsx` has no `WatercolorTextureStrip` import/mount, no `brushCatalogGeneration` read, and its measurement effect deps are exactly `[open, anchor?.top]` (line 72). Brush branch is Open modal → separator → scroll list; lift branch is the unchanged list-only branch. Revision-gate absence pin present in `PhysicsPaintBrushPicker.test.ts:189-191` (`not.toContain('WatercolorTextureStrip')`, `not.toContain('physics-paint-brush-menu-textures')`, `not.toContain('brushCatalogGeneration')`). |
| 4 | Opening one popover closes the other; both new surfaces stand down while a project file picker is open. | ✓ VERIFIED | `toggleBrushMenu` closes the texture menu when open (TopBar line 406); `toggleTextureMenu` closes the brush menu (line 415). TopBar suite "opening one popover closes the other in both directions" proves both directions. `PhysicsPaintStudioView.tsx` mounts `{!pickerOpen ? <PhysicsPaintTextureMenu /> : null}` (line 564) and `{!pickerOpen ? <PhysicsPaintTextureModal .../> : null}` (lines 613-618). Revision-gate extension present: `PhysicsPaintStudioView.test.ts:141-142` counts both surfaces 0 under each picker and `:151-152` counts 1 when no picker is open; all four shipped expectations and fixtures untouched. |
| 5 | The Open modal action raises and opens a floating Textures sheet that is draggable, height-resizable, closes via its X, and only the front sheet consumes Escape. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Present and wired: `PhysicsPaintTextureMenu.tsx:85-91` closes the popover, `bringSheetToFront(SHEET_ID_TEXTURES)` then `setAquarelleTextureModalOpen(true)` (test proves raise+open+front). `PhysicsPaintTextureModal.tsx` implements header drag (180-216), resize handle (218-241, 304-314), X close (278-291), and front-only Escape via `closeSheetIfFront` + `stopImmediatePropagation` (157-174); `floatingSheetStack.test.ts` proves the front-gate helper semantics for all five handlers. Behaviorally tested: drag lands in the style transform, X closes. NOT tested: the resize pointer transition (`onResizePointerDown/Move` → `textureModalResizeHeight` → height). No test invokes it — see behavior_unverified_items and Human Verification. |
| 6 | The Textures sheet's Size control reads aquarelleParams.size, streams onChange live, and commits exactly one `size` patch per release — the shared brush Size, never a texture-pattern scale. | ✓ VERIFIED | `TextureSizeControl` (Modal lines 119-146) performs ONE `aquarelleParams.value.size` read; `SliderStepper` id `physics-texture-size`, label "Brush size", min 1 / max 80 / step 1; `onChange` forwards `props.onBrushSizeChange` (mounted with `topBar.onBrushSizeChange` = `handleBrushSizeChange` → `setAquarelleParam('size', value)`, PhysicsPaintStudio.tsx:7211-7213) and never writes the signal; `onCommit` calls `commitAquarelleSelectionParam('size', value)` → `{ params: { size } }` patch. Test proves live value 42, onChange(37) forwards with signal untouched, and exactly one patch `{ params: { size: 37 } }` for ids `[10801]` per release. No watercolor package/engine/mask/stroke plumbing file changed (diff stat limited to the 15 planned files). |
| 7 | The four shipped sheet seats keep their exact z-index and top inset (50/51/52/53, 12/28/44/60); Textures seats last at 54 / 76px. | ✓ VERIFIED | `floatingSheetStack.ts:40-46` INITIAL_ORDER = stroke-settings, brushes, settings, rail-motion, textures (SHEET_ID_TEXTURES appended last); base z 50 → 50/51/52/53/54. Insets: StrokeSettingsDialog 12, BrushModal 28, SettingsModal 44, RailMotionModal 60, TextureModal 76. Tests pin z 50-54 (floatingSheetStack), Settings 52/44px (physicsPaintSettingsModal), RailMotion 53/60px with the relative assertion now reading `sheetZIndex(SHEET_ID_TEXTURES) - 1`, and Textures top 76px / z 54 / height `min(480px, calc(100% - 88px))`. |

**Score:** 6/7 truths verified (1 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/src/components/physic-paint/view/PhysicsPaintTextureMenu.tsx` | Textures popover (Open modal, separator, compact strip) | ✓ VERIFIED | 102 lines, mounted in StudioView behind `!pickerOpen`, wired to sheet stack + modal signal. |
| `app/src/components/physic-paint/view/PhysicsPaintTextureModal.tsx` | Floating Textures sheet + `TextureSizeControl` | ✓ VERIFIED | 317 lines, mounted in StudioView with `topBar.onBrushSizeChange` / `topBar.disabled`, seat 54/76px, drag/resize/close/front-only Escape. |
| `app/src/components/physic-paint/view/PhysicsPaintTextureMenu.test.ts` | Popover laws | ✓ VERIFIED | 235 lines; ordering, chip pick, Open modal hand-off, viewport clamp, compact geometry. |
| `app/src/components/physic-paint/view/PhysicsPaintTextureModal.test.ts` | Sheet laws | ✓ VERIFIED | 252 lines; seat/z, raise, Size control, one-patch release, drag/close, source laws. |
| `aquarelleRecordState.ts` exports `aquarelleTextureMenuOpen`, `aquarelleTextureMenuAnchor`, `aquarelleTextureModalOpen`, `setAquarelleTextureMenuOpen`, `setAquarelleTextureModalOpen` | Studio-UI-only signals + compare-then-write setters | ✓ VERIFIED | Lines 200-228; close never rewrites the anchor; modal setter compare-then-write. |
| `floatingSheetStack.ts` exports `SHEET_ID_TEXTURES` as the LAST INITIAL_ORDER entry | Fifth seat appended | ✓ VERIFIED | Lines 38-46. |
| `physicsPaintStudio.css` defines `.physics-paint-texture-trigger`, `.physics-paint-texture-menu`, `.physics-paint-texture-menu-strip`, `.physics-paint-texture-modal`, `.physics-paint-texture-size` | New chrome | ✓ VERIFIED | Lines 842, 1077, 1096, 1104, 1120, 1126; dead `.physics-paint-brush-menu-textures` rules removed; base 44px chip rule and `.watercolor-texture-strip` untouched. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `PhysicsPaintTopBar.tsx` | `aquarelleRecordState.ts` | `TopBarTextureTrigger` onToggle → `setAquarelleTextureMenuOpen(open, anchor)` | ✓ WIRED | `toggleTextureMenu` reads the trigger rect and calls the setter; test asserts `{ left: 120, top: 64 }`. |
| `PhysicsPaintTextureMenu.tsx` | `floatingSheetStack.ts` | Open modal → `bringSheetToFront(SHEET_ID_TEXTURES)` then `setAquarelleTextureModalOpen(true)` | ✓ WIRED | Exact order at lines 85-91 and pinned by test (`indexOf` ordering + front-sheet assertion). |
| `PhysicsPaintTextureMenu.tsx` | `WatercolorTextureStrip.tsx` | compact strip mounted below the separator | ✓ WIRED | Lines 96-99; test proves sibling order and `compact={true}`. |
| `PhysicsPaintTextureModal.tsx` | `aquarellePaintControls.ts` | `TextureSizeControl` SliderStepper onCommit → `commitAquarelleSelectionParam('size', value)` | ✓ WIRED | Lines 135-137; test captures one `{ params: { size: 37 } }` patch through the selection edit port. |
| `PhysicsPaintStudioView.tsx` | `PhysicsPaintTextureModal.tsx` | mount with `topBar.onBrushSizeChange` and `topBar.disabled` under `!pickerOpen` | ✓ WIRED | Lines 613-618; picker gate counted by StudioView tests. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `PhysicsPaintTextureModal.tsx` — Size row | `aquarelleParams.value.size` | `setAquarelleParam('size', value)` via `handleBrushSizeChange` (PhysicsPaintStudio.tsx:7211), threaded through `topBar.onBrushSizeChange` | Yes — live aquarelle signal, not a literal | ✓ FLOWING |
| `PhysicsPaintTextureMenu.tsx` — compact strip | `aquarelleSelectedTextureId` / texture registry | Shipped `WatercolorTextureStrip` (unchanged, self-subscribing) | Yes — same registry the library uses | ✓ FLOWING |
| `PhysicsPaintTextureModal.tsx` — full strip | Texture registry | Shipped `WatercolorTextureStrip` (no compact prop) | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Typecheck | `pnpm --filter efx-motion-editor run typecheck` | `tsc --noEmit` clean (exit 0) | ✓ PASS |
| Ten-suite verification sweep (independently re-run) | `pnpm exec vitest run floatingSheetStack PhysicsPaintTextureMenu PhysicsPaintTextureModal PhysicsPaintBrushPicker PhysicsPaintTopBar PhysicsPaintBrushMenu WatercolorBrushLibrary physicsPaintSettingsModal PhysicsPaintRailMotionModal PhysicsPaintStudioView .test.ts` | 10 files / 169 tests passed | ✓ PASS |

### Probe Execution

N/A — no probes are declared or required for this Studio UI quick (not a migration/tooling phase).

### Requirements Coverage

N/A — the quick task declares `requirements: []`; it maps to no `REQUIREMENTS.md` IDs.

### Test Quality Audit

| Test File | Linked Truth | Active | Skipped | Circular | Assertion Level | Verdict |
| --------- | ------------ | ------ | ------- | -------- | --------------- | ------- |
| `PhysicsPaintTextureMenu.test.ts` | 1, 2, 5 | yes | 0 | no | Value + behavioral (chip click, hand-off) | PASS |
| `PhysicsPaintTextureModal.test.ts` | 5, 6, 7 | yes | 0 | no | Value + behavioral (drag, commit via edit port) | PASS |
| `PhysicsPaintTopBar.test.ts` | 1, 4 | yes | 0 | no | Behavioral (toggle handlers) + source pins | PASS |
| `PhysicsPaintBrushPicker.test.ts` | 3 | yes | 0 | no | Absence pins + value | PASS |
| `PhysicsPaintStudioView.test.ts` | 4 | yes | 0 | no | Behavioral (mount counts under gates) | PASS |
| `floatingSheetStack.test.ts` | 5, 7 | yes | 0 | no | Behavioral (stack transitions) + source pins | PASS |

**Disabled tests on requirements:** 0. **Circular patterns:** 0. **Insufficient assertions:** 0 — the shared-Size commit and the stack transitions are proven at behavioral level.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts` | 679 | Stale comment references the deleted `.physics-paint-brush-menu-textures` selector as rationale for a line-anchored CSS lookup | ℹ️ Info | Inert — the assertion resolves the base 44px rule and does not depend on the deleted selector. File not modified by this quick. |

No `TBD`/`FIXME`/`XXX` markers in any file modified by this quick. No stubs or hardcoded empty data flow into the new surfaces.

### Human Verification Required

#### 1. Textures popover placement and contents

**Test:** Open the Studio and click the second "Textures" control inside the brush pill.
**Expected:** A viewport-fixed popover appears directly under that control (not clipped by the top bar), with "Open modal" first, then a separator, then the compact 34px texture chips; the trigger toggles it closed, outside-press and Escape close it.
**Why human:** Placement, blur and clipping are visual judgments the vnode harness cannot see.

#### 2. Chip pick behavior

**Test:** Pick a texture chip, then inspect the brush response selection.
**Expected:** The popover stays open, the chosen chip shows the selected accent, and the displayed brush response is unchanged.
**Why human:** Real UI affordance and cross-axis state are visual.

#### 3. Textures sheet drag, height-resize, close and Escape

**Test:** Click Open modal; drag the header; drag the bottom resize handle; close with X; reopen and press Escape while another sheet is front.
**Expected:** The sheet seats at the fifth cascade step (76px top, 12px right, above the other sheets), drags within the window, resizes between 240px and the viewport clamp, X closes it, and Escape closes only the front sheet.
**Why human:** The resize pointer sequence has no automated test (behavior-unverified); drag/resize ergonomics are visual.

#### 4. Shared Size live behavior and single undo entry

**Test:** With paint strokes selected, drag the Size slider in the Textures sheet, release, then press Undo.
**Expected:** Live strokes follow the same shared Brush size as the top bar; release produces exactly one size undo entry; Undo restores the previous size; engine, masks and recorded strokes are untouched.
**Why human:** Live rendering feel and undo affordance need the running app; the commit law is unit-proven.

#### 5. D-2 regression check

**Test:** Open the brush dropdown, then open the brush catalog from Open modal.
**Expected:** The dropdown shows Open modal, separator, preset list only (no texture strip); the catalog still shows the full texture row with its import controls.
**Why human:** Confirms the relocation visually in the live app.

### Gaps Summary

No blocking gaps. Every must-have truth is present, substantive and wired; six of seven are behaviorally proven. The remaining truth is deferred to human verification only for its height-resize transition (handlers wired, no test exercising them) plus the live visual/ergonomic pass the executor deliberately left to the user. No shared seat moved (50/51/52/53 + 12/28/44/60 are byte-identical; Textures is 54/76px), the brush dropdown is clean of the texture strip, the full texture row with import remains in the library, and no watercolor package file was modified.

---

_Verified: 2026-11-16T11:43:41Z_
_Verifier: Claude (gsd-verifier)_
