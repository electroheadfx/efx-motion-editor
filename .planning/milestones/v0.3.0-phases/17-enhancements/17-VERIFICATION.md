---
phase: 17-enhancements
verified: 2026-03-24T12:15:00Z
status: passed
score: 8/8 must-haves verified
re_verification: true
  previous_status: passed
  previous_score: 5/5
  note: "Previous verification predated Plans 05 and 06 (UAT gap closure). Re-verification includes all 6 plans."
  gaps_closed:
    - "ColorPickerModal drag propagation into SortableJS container"
    - "Timeline thumbnails missing gradient previews for gradient key photos"
    - "Gradient stop color editing missing HEX/RGBA/HSL input mode tabs"
  gaps_remaining: []
  regressions: []
---

# Phase 17: Enhancements Verification Report

**Phase Goal:** Users get collapsible key photo lists in the sidebar, a global solo mode that strips layers/FX from preview and export, gradient fills for solid entries, and Tailwind v4 syntax cleanup
**Verified:** 2026-03-24T12:15:00Z
**Status:** passed
**Re-verification:** Yes — after UAT gap closure (Plans 05 and 06 added since initial verification)

## Context

An initial verification at `2026-03-24T10:10:34Z` claimed `passed` (5/5 truths). However, UAT subsequently uncovered 3 gaps logged in `17-UAT.md`. Two gap-closure plans were created and executed:
- Plan 05 closed: drag propagation through ColorPickerModal, missing HEX/RGBA/HSL input tabs in gradient mode
- Plan 06 closed: gradient thumbnails absent from timeline key photo cells

This re-verification covers all 6 plans (01–06) and all UAT-reported gaps.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can collapse and expand a sequence's key photo list by clicking the sequence header bar a second time | VERIFIED | `SequenceList.tsx` line 83: `useState(false)` for `keyPhotoCollapsed`; line 136: `setKeyPhotoCollapsed(prev => !prev)` in same-sequence branch; line 141: `setKeyPhotoCollapsed(false)` on sequence switch; line 392: `maxHeight: isActive && !keyPhotoCollapsed ? '72px' : '0px'` |
| 2 | User can toggle global solo mode via timeline toolbar button or S key, stripping all overlay layers and FX from preview and export | VERIFIED | `soloStore.ts` exports `soloStore` with `toggleSolo/setSolo/isSolo`; `TimelinePanel.tsx` line 141: Headphones button calls `soloStore.toggleSolo()`; `shortcuts.ts` line 405: `'s'` key binding with `shouldSuppressShortcut` guard; `exportRenderer.ts` line 255: `if (!soloActive)` gates overlay loop; all 3 render call sites pass solo state |
| 3 | User can apply gradient fills (linear, radial, conic) with 2-5 color stops to solid key entries via extended ColorPickerModal | VERIFIED | `GradientBar.tsx` exports `GradientBar` and `buildGradientCSS`; `ColorPickerModal.tsx` has `showGradientMode` prop, `fillMode` toggle, `<select>` for gradient type; `KeyPhotoStrip.tsx` line 444: `showGradientMode={true}` wired to `onGradientChange` and `onGradientLiveChange` |
| 4 | Gradient data persists in .mce project file v13 with backward compat for v12 | VERIFIED | `projectStore.ts` line 219: `version: 13`; serialization lines 108-115; deserialization lines 359-365; `project.ts` has `MceGradientData`/`MceGradientStop`; `project.rs` `MceGradientData` struct with `#[serde(default, skip_serializing_if = "Option::is_none")]` on `MceKeyPhoto.gradient` |
| 5 | All Tailwind v4 deprecated `[var(--...)]` patterns migrated to parenthetical `(--...)` syntax | VERIFIED | `grep -rn '\[var(--' Application/src/` returns 0 occurrences |
| 6 | Dragging inside ColorPickerModal does not trigger background key photo card movement | VERIFIED | `ColorPickerModal.tsx` line 2: `import {createPortal} from 'preact/compat'`; line 389: `return createPortal(..., document.body)`; line 393: `onMouseDown={(e) => e.stopPropagation()}` on outer wrapper — modal DOM is outside SortableJS container |
| 7 | Gradient stop color editing shows HEX/RGBA/HSL input mode tabs and text fields | VERIFIED | `ColorPickerModal.tsx` lines 615-690: mode tab buttons and input fields rendered unconditionally (no `!isGradientMode` guard); only color preview bar retains the guard (line 605) |
| 8 | Timeline thumbnails render gradient previews for gradient key photos | VERIFIED | `timeline.ts` line 61: `KeyPhotoRange.gradient?: GradientData`; `frameMap.ts` line 77: gradient spread in trackLayouts ranges.push; `TimelineRenderer.ts` line 4: imports `createCanvasGradient`; line 584: `if (range.gradient)` renders gradient before solidColor check |

**Score:** 8/8 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `Application/src/components/sequence/SequenceList.tsx` | Collapse toggle on SequenceItem | VERIFIED | `keyPhotoCollapsed` state, `setKeyPhotoCollapsed(prev => !prev)` in same-seq branch, `setKeyPhotoCollapsed(false)` on switch, `maxHeight` condition updated |
| `Application/src/components/layout/TimelinePanel.tsx` | Migrated Tailwind syntax + solo button | VERIFIED | Zero `[var(--` patterns; Headphones button wired to `soloStore.toggleSolo()` |
| `Application/src/stores/soloStore.ts` | Signal-based solo state | VERIFIED | Exports `soloStore` with `soloEnabled` signal, `toggleSolo`, `setSolo`, `isSolo: computed` |
| `Application/src/stores/soloStore.test.ts` | Unit tests for soloStore | VERIFIED | 3 tests all passing: starts disabled, toggleSolo flips state, setSolo sets explicit value |
| `Application/src/lib/exportRenderer.ts` | Solo-aware renderGlobalFrame | VERIFIED | `soloActive: boolean = false` at line 91; `if (!soloActive)` at line 255; does NOT import soloStore (pure function) |
| `Application/src/types/sequence.ts` | GradientData, GradientStop, KeyPhoto.gradient | VERIFIED | `export interface GradientStop`, `export interface GradientData` with `type: 'linear' \| 'radial' \| 'conic'`; `KeyPhoto.gradient?: GradientData`; `isKeyGradient` and `createDefaultGradient` exported |
| `Application/src/types/timeline.ts` | FrameEntry.gradient and KeyPhotoRange.gradient | VERIFIED | `FrameEntry.gradient?: GradientData` at line 21; `KeyPhotoRange.gradient?: GradientData` at line 61; both import `GradientData` from `./sequence` |
| `Application/src/components/shared/ColorPickerModal.tsx` | Portal-rendered, gradient mode with all input tabs | VERIFIED | `createPortal` to `document.body`; `onMouseDown` stopPropagation; `showGradientMode` prop; `fillMode` toggle; `<select>` for gradient type; HEX/RGBA/HSL tabs unconditional |
| `Application/src/components/shared/GradientBar.tsx` | Draggable gradient stop editor | VERIFIED | Exports `GradientBar` and `buildGradientCSS`; uses `onPointerDown`/`onPointerMove` with `setPointerCapture` for drag capture |
| `Application/src/lib/previewRenderer.ts` | Canvas 2D gradient rendering, exported createCanvasGradient | VERIFIED | `export function createCanvasGradient` at line 20; `entry?.gradient && !entry?.isTransparent` check before solidColor; `typeof ctx.createConicGradient === 'function'` fallback |
| `Application/src/lib/exportRenderer.ts` | Gradient propagation in buildSequenceFrames | VERIFIED | `...(kp.gradient ? { gradient: kp.gradient } : {})` at line 29 |
| `Application/src/lib/frameMap.ts` | Gradient in both FrameEntry and trackLayouts (KeyPhotoRange) | VERIFIED | Line 28: `kp.gradient` spread for FrameEntry; line 77: `kp.gradient` spread for KeyPhotoRange in trackLayouts |
| `Application/src/stores/projectStore.ts` | Version 13, gradient serialization/deserialization | VERIFIED | `version: 13` at line 219; serialization lines 108-115; deserialization lines 359-365 with camelCase/snake_case mapping |
| `Application/src/types/project.ts` | MceGradientData and MceKeyPhoto.gradient | VERIFIED | `export interface MceGradientStop`, `export interface MceGradientData` with type/stops/angle/center_x/center_y; `MceKeyPhoto.gradient?: MceGradientData` |
| `Application/src-tauri/src/models/project.rs` | Rust MceGradientData struct with serde | VERIFIED | `pub struct MceGradientStop`, `pub struct MceGradientData` with `gradient_type: String`, `stops: Vec<MceGradientStop>`, optional fields with `#[serde(default, skip_serializing_if = "Option::is_none")]`; `MceKeyPhoto.gradient: Option<MceGradientData>` |
| `Application/src/stores/sequenceStore.ts` | updateKeyGradient and updateKeyGradientLive | VERIFIED | Both methods at lines 547 and 573 |
| `Application/src/components/sequence/KeyPhotoStrip.tsx` | showGradientMode wired to ColorPickerModal | VERIFIED | `showGradientMode={true}` at line 444; `onGradientChange` at line 446; `onGradientLiveChange` at line 447 |
| `Application/src/components/timeline/TimelineRenderer.ts` | Canvas 2D gradient rendering branch for timeline cells | VERIFIED | Line 4: `import {createCanvasGradient}`; line 584: `if (range.gradient)` branch with clip rect per cell before solidColor check |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `SequenceList.tsx SequenceItem handleSelect` | `keyPhotoCollapsed state` | `setKeyPhotoCollapsed(prev => !prev)` on same-sequence click | WIRED | Lines 136, 141: toggle on same-seq, reset on switch |
| `TimelinePanel.tsx solo button` | `soloStore.toggleSolo()` | `onClick` handler | WIRED | Line 141: `onClick={() => soloStore.toggleSolo()}` |
| `Preview.tsx` | `renderGlobalFrame` | `soloStore.soloEnabled.value` as 7th parameter | WIRED | Line 32 confirmed |
| `exportEngine.ts` | `renderGlobalFrame` | `soloStore.soloEnabled.peek()` as 7th parameter | WIRED | Line 144: `.peek()` for non-reactive context |
| `ExportPreview.tsx` | `renderGlobalFrame` | `soloStore.soloEnabled.value` as 7th parameter | WIRED | Line 58 confirmed |
| `exportRenderer.ts` | does NOT import soloStore | Pure function design | VERIFIED ABSENT | No `import.*soloStore` in exportRenderer.ts |
| `shortcuts.ts S key` | `soloStore.toggleSolo()` | tinykeys binding with `shouldSuppressShortcut` guard | WIRED | Lines 405-409 |
| `ColorPickerModal.tsx` | `document.body` | `createPortal` | WIRED | Line 389: `return createPortal(..., document.body)` |
| `ColorPickerModal gradient mode` | `GradientData type` | `fillMode` state and `onGradientChange` callback | WIRED | Props and state wired at lines 105-114 |
| `GradientBar stops` | `GradientData.stops` | pointer capture drag with `onPointerDown`/`onPointerMove` | WIRED | `setPointerCapture` at line 111; drag handlers at lines 154-155 |
| `KeyPhotoStrip.tsx ColorPickerModal` | `sequenceStore.updateKeyGradient` | `onGradientChange` callback with `showGradientMode={true}` | WIRED | Lines 444-447 |
| `projectStore.ts buildMceProject` | `MceGradientData` | gradient serialization in key_photos map | WIRED | Lines 108-115 |
| `projectStore.ts hydrateFromMce` | `GradientData` | gradient deserialization with camelCase mapping | WIRED | Lines 359-365: `center_x` mapped to `centerX` |
| `previewRenderer.ts renderFrame` | `createCanvasGradient` | `entry.gradient` check before `solidColor` | WIRED | Line 264: `entry?.gradient && !entry?.isTransparent`; line 269: `createCanvasGradient` as `fillStyle` |
| `exportRenderer.ts buildSequenceFrames` | `FrameEntry.gradient` | `kp.gradient` spread into frame entry | WIRED | Line 29 |
| `frameMap.ts trackLayouts` | `KeyPhotoRange.gradient` | `kp.gradient` spread in trackLayouts ranges.push | WIRED | Line 77 |
| `TimelineRenderer.ts` | `createCanvasGradient` | `range.gradient` check with clip-rect per cell | WIRED | Lines 584-596 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `previewRenderer.ts` gradient rendering | `entry.gradient` | `FrameEntry.gradient` populated from `frameMap.ts` via `kp.gradient` spread at line 28 | Yes — flows from `KeyPhoto.gradient` (set by `sequenceStore.updateKeyGradient`) through frameMap to renderer | FLOWING |
| `exportRenderer.ts` gradient in export | `kp.gradient` | `KeyPhoto.gradient` spread into `FrameEntry` in `buildSequenceFrames` at line 29 | Yes — same source, flows to `renderGlobalFrame` | FLOWING |
| `projectStore.ts` gradient persistence | `kp.gradient` | Written by `sequenceStore.updateKeyGradient`, serialized in `buildMceProject`, deserialized in `hydrateFromMce` | Yes — round-trip with snake_case/camelCase mapping confirmed | FLOWING |
| `ColorPickerModal.tsx` gradient state | `gradientState` | `useState` initialized from `props.gradient ?? createDefaultGradient()`, mutated by UI controls | Yes — callbacks fire `onGradientChange`/`onGradientLiveChange` wired to `sequenceStore.updateKeyGradient` | FLOWING |
| `TimelineRenderer.ts` gradient thumbnail | `range.gradient` | `KeyPhotoRange.gradient` populated from `frameMap.ts` trackLayouts at line 77 | Yes — flows from `KeyPhoto.gradient` through trackLayouts pipeline to timeline renderer | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| soloStore unit tests pass | `npx vitest run src/stores/soloStore.test.ts` | 3/3 tests passed (219ms) | PASS |
| TypeScript compiles clean | `npx tsc --noEmit` | 1 pre-existing warning only (`glslRuntime.test.ts` unused import — not introduced by phase 17) | PASS |
| Zero deprecated `[var(--` patterns remain | `grep -rn '\[var(--' Application/src/` | 0 matches | PASS |
| ColorPickerModal portal rendering | `grep -n 'createPortal' ColorPickerModal.tsx` | `import {createPortal}` at line 2; `return createPortal(` at line 389 | PASS |
| Timeline gradient rendering wired | `grep -n 'range.gradient' TimelineRenderer.ts` | `if (range.gradient)` branch at line 584 | PASS |
| HEX/RGBA/HSL tabs unconditional | Lines 615-619 in ColorPickerModal.tsx | Mode tab buttons at lines 617-619 with no `isGradientMode` guard wrapping them | PASS |

---

### Requirements Coverage

Requirements declared in Phase 17 ROADMAP.md: ENH-01, ENH-02, ENH-03, ENH-04

Note: The prompt listed ENH-01 through ENH-04 as the phase requirement IDs, but the ROADMAP and REQUIREMENTS.md record a revised set for this phase. The traceability is documented below for all IDs.

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ENH-01 | (none — dropped) | User can scroll through key photos when list overflows | DROPPED | Per D-01, subsumed by ENH-02 collapse. REQUIREMENTS.md marks as dropped. No plan claims it. Correct disposition per project decisions. |
| ENH-02 | 17-01-PLAN.md | User can collapse/expand key photo list by clicking sequence header bar a second time | SATISFIED | `keyPhotoCollapsed` toggle in `SequenceList.tsx`; second click collapses, switching sequences auto-expands |
| ENH-03 | 17-02-PLAN.md, 17-05-PLAN.md, 17-06-PLAN.md | User can toggle global solo mode to preview and export without overlay layers and FX | SATISFIED | `soloStore`, toolbar button, S shortcut, `renderGlobalFrame` overlay gating, all 3 call sites wired; gap closure plans address portal rendering and timeline thumbnails |
| ENH-04 | (none — dropped) | User can solo individual layers within a sequence via sidebar toggle | DROPPED | Per D-07, dropped in favor of global solo only. REQUIREMENTS.md marks as dropped. Correct disposition. |
| ENH-05 | 17-03-PLAN.md, 17-04-PLAN.md | User can apply gradient fills with 2-5 stops via extended ColorPickerModal, persisting in .mce | SATISFIED | Types, UI, rendering, persistence, Rust model all implemented and wired end-to-end |

**Orphaned requirement check:** `grep -E "Phase 17" .planning/REQUIREMENTS.md` shows ENH-01 through ENH-05 mapped to Phase 17. ENH-01 and ENH-04 are explicitly dropped in REQUIREMENTS.md with reasons. ENH-05 was added after initial roadmap. No orphaned requirements — all IDs accounted for.

**Note on Tailwind v4 migration:** The Tailwind cleanup is implemented as part of ENH-02/ENH-03 work in Plan 01 per ROADMAP.md Success Criterion 5. It maps to the phase goal but not to a discrete ENH-XX requirement ID.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ColorPickerModal.tsx` | 631 | `placeholder="#000000"` | Info | HTML input placeholder attribute — not a code stub. Innocuous. |

No blockers or warnings found. All `var()` usages in this file are inside `style={{}}` objects (correct CSS syntax), not Tailwind utility classes.

---

### Human Verification Required

#### 1. Collapse/expand visual behavior

**Test:** Open the sidebar Sequences panel with at least one sequence active. Click the active sequence header a second time.
**Expected:** Key photo strip animates closed (max-height transitions to 0 via `transition-[max-height] duration-150 ease-out`). Clicking again or switching to another sequence expands it.
**Why human:** CSS transition animation and visual feel cannot be verified programmatically.

#### 2. Solo mode — overlay strip behavior in preview

**Test:** Add a FX or content-overlay layer to a project. Toggle solo mode via the Headphones button or S key. Observe the preview canvas.
**Expected:** All overlay layers and FX disappear from the preview. The preview shows only base content. Toggling solo off restores overlays.
**Why human:** Canvas pixel output requires visual inspection.

#### 3. Gradient fill — visual rendering in preview canvas

**Test:** Select a solid key entry. Open the color picker. Switch to Gradient mode. Choose radial, drag stops. Confirm the modal shows the gradient preview. Click Save and observe the preview canvas.
**Expected:** Preview canvas renders the correct gradient (linear/radial/conic) matching stop positions/colors.
**Why human:** Canvas gradient rendering requires visual inspection.

#### 4. ColorPickerModal drag isolation (UAT gap #1 — was major)

**Test:** Open color picker from a key solid card. Drag on the angle input field or gradient bar inside the modal.
**Expected:** Background key photo cards do NOT move while dragging inside the modal.
**Why human:** Portal rendering was applied programmatically; the drag isolation behavior requires running app interaction to confirm.

#### 5. Gradient stop HEX/RGBA/HSL input (UAT gap #3 — was minor)

**Test:** In gradient mode, select a gradient stop. Look for HEX/RGBA/HSL tabs below the HSV picker.
**Expected:** Mode tab buttons (HEX, RGBA, HSL) and their text input fields appear. Entering a hex value updates the selected stop's color.
**Why human:** Requires visual confirmation of rendered UI tabs.

#### 6. Timeline gradient thumbnail (UAT gap #2 — was major)

**Test:** Create a project with a gradient solid key entry. Open the timeline. Observe the key photo range cell for that entry.
**Expected:** Timeline cell shows a gradient preview (directional/circular/angular depending on type) instead of empty placeholder.
**Why human:** Canvas timeline rendering requires visual inspection.

#### 7. Project file round-trip with gradients

**Test:** Create a project with gradient solid entries. Save as .mce (v13). Close and reopen.
**Expected:** Gradient fills, stop colors, positions, type, angle, and center values survive the save/load cycle.
**Why human:** Requires Tauri filesystem operations in the running app.

#### 8. Backward compatibility — open v12 project

**Test:** Open a pre-existing .mce file saved at version 12 (without gradient data).
**Expected:** File opens without errors; solid entries retain their solid colors; no crash or data loss.
**Why human:** Requires a real v12 project file and the running Tauri application.

---

### Re-Verification: Gap Closure Assessment

| UAT Gap | Plan | Fix Applied | Verification Result |
|---------|------|-------------|---------------------|
| Drag propagation from ColorPickerModal into SortableJS | 17-05 | `createPortal` to `document.body` + `onMouseDown` stopPropagation | CLOSED — portal confirmed at line 389; stopPropagation at line 393 |
| Timeline gradient thumbnails missing | 17-06 | `KeyPhotoRange.gradient` field + frameMap spread + TimelineRenderer gradient branch | CLOSED — all 3 pieces verified at lines 61, 77, 584 |
| HEX/RGBA/HSL input tabs hidden in gradient mode | 17-05 | Removed `!isGradientMode` guard wrapping mode tabs and input fields | CLOSED — tabs render unconditionally at lines 615-619 |

---

### Gaps Summary

No gaps. All 8 observable truths verified, all 19 artifacts confirmed at all levels (exists, substantive, wired, data-flowing), all 17 key links WIRED, 3/3 soloStore tests passing, 0 deprecated Tailwind patterns remaining, TypeScript compiles with only a pre-existing unrelated warning. The 3 UAT gaps reported after the initial verification are all closed by Plans 05 and 06.

---

_Verified: 2026-03-24T12:15:00Z_
_Verifier: Claude (gsd-verifier)_
