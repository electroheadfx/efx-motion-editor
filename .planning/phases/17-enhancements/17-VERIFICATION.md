---
phase: 17-enhancements
verified: 2026-03-24T10:10:34Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 17: Enhancements Verification Report

**Phase Goal:** Users get collapsible key photo lists in the sidebar, a global solo mode that strips layers/FX from preview and export, gradient fills for solid entries, and Tailwind v4 syntax cleanup
**Verified:** 2026-03-24T10:10:34Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can collapse and expand a sequence's key photo list by clicking the sequence header bar a second time | VERIFIED | `SequenceList.tsx` line 83: `const [keyPhotoCollapsed, setKeyPhotoCollapsed] = useState(false)`; line 136: `setKeyPhotoCollapsed(prev => !prev)` in same-sequence branch; line 392: `maxHeight: isActive && !keyPhotoCollapsed ? '72px' : '0px'` |
| 2 | User can toggle global solo mode via timeline toolbar button or S key, stripping all overlay layers and FX from preview and export | VERIFIED | `soloStore.ts` exports `soloStore` with `toggleSolo/setSolo/isSolo`; `TimelinePanel.tsx` has Headphones button calling `soloStore.toggleSolo()`; `shortcuts.ts` line 405 binds `'s'` key; `exportRenderer.ts` gates overlay loop with `if (!soloActive)` at line 255; all 3 render call sites pass solo state |
| 3 | User can apply gradient fills (linear, radial, conic) with 2-5 color stops to solid key entries via extended ColorPickerModal | VERIFIED | `GradientBar.tsx` exports `GradientBar` and `buildGradientCSS`; `ColorPickerModal.tsx` has `showGradientMode` prop, `<select>` for gradient type with linear/radial/conic options, angle/center controls; `KeyPhotoStrip.tsx` line 444: `showGradientMode={true}` on `ColorPickerModal` |
| 4 | Gradient data persists in .mce project file v13 with backward compat for v12 | VERIFIED | `projectStore.ts` line 219: `version: 13`; serialization at lines 108-115, deserialization at lines 359-365; `project.ts` has `MceGradientData`/`MceGradientStop` interfaces; `project.rs` has `MceGradientData` struct with `#[serde(default, skip_serializing_if = "Option::is_none")]` on gradient field of `MceKeyPhoto` |
| 5 | All Tailwind v4 deprecated `[var(--...)]` patterns migrated to parenthetical `(--...)` syntax | VERIFIED | `grep -rn '\[var(--' Application/src/components/` returns 0 occurrences; `grep -rn '\[var(--' Application/src/` returns 0 occurrences; `TimelinePanel.tsx` confirms 30 uses of `(--color` parenthetical syntax |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `Application/src/components/sequence/SequenceList.tsx` | Collapse toggle on SequenceItem | VERIFIED | Contains `keyPhotoCollapsed`, `setKeyPhotoCollapsed(prev => !prev)`, `setKeyPhotoCollapsed(false)`, and updated `maxHeight` condition |
| `Application/src/components/layout/TimelinePanel.tsx` | Migrated Tailwind syntax + solo button | VERIFIED | 30 uses of `bg-(--color...` parenthetical syntax; Headphones solo button wired to `soloStore.toggleSolo()` |
| `Application/src/stores/soloStore.ts` | Signal-based solo state | VERIFIED | Exports `soloStore` with `soloEnabled` signal, `toggleSolo`, `setSolo`, `isSolo: computed` |
| `Application/src/stores/soloStore.test.ts` | Unit tests for soloStore | VERIFIED | 3 tests: starts disabled, toggleSolo flips state, setSolo sets explicit value — all passing |
| `Application/src/lib/exportRenderer.ts` | Solo-aware renderGlobalFrame | VERIFIED | `soloActive: boolean = false` parameter at line 91; `if (!soloActive)` gating overlay loop at line 255; does NOT import soloStore (pure function) |
| `Application/src/types/sequence.ts` | GradientData, GradientStop, KeyPhoto.gradient | VERIFIED | `export interface GradientStop`, `export interface GradientData` with `type: 'linear' \| 'radial' \| 'conic'`, `stops: GradientStop[]`; `KeyPhoto.gradient?: GradientData`; `isKeyGradient` and `createDefaultGradient` helpers |
| `Application/src/types/timeline.ts` | FrameEntry.gradient field | VERIFIED | `gradient?: GradientData` at line 21; imports `GradientData` from `./sequence` |
| `Application/src/components/shared/ColorPickerModal.tsx` | Extended with gradient mode | VERIFIED | Imports `GradientData`, `GradientBar`, `buildGradientCSS`; `showGradientMode` prop; `fillMode` state toggle; `<select>` for gradient type; `onGradientChange`/`onGradientLiveChange` callbacks |
| `Application/src/components/shared/GradientBar.tsx` | Draggable gradient stop editor | VERIFIED | Exports `GradientBar` and `buildGradientCSS`; uses `onPointerDown`/`onPointerMove` with `setPointerCapture` for drag |
| `Application/src/lib/previewRenderer.ts` | Canvas 2D gradient rendering | VERIFIED | `function createCanvasGradient` at line 20; `entry?.gradient && !entry?.isTransparent` check before solidColor; `typeof ctx.createConicGradient === 'function'` fallback |
| `Application/src/lib/exportRenderer.ts` | Gradient propagation in buildSequenceFrames | VERIFIED | `...(kp.gradient ? { gradient: kp.gradient } : {})` at line 29 |
| `Application/src/lib/frameMap.ts` | Gradient propagation for preview pipeline | VERIFIED | `...(kp.gradient ? { gradient: kp.gradient } : {})` at line 28 |
| `Application/src/stores/projectStore.ts` | Version 13, gradient serialization | VERIFIED | `version: 13` at line 219; gradient serialization (lines 108-115) and deserialization (lines 359-365) |
| `Application/src/types/project.ts` | MceGradientData and MceKeyPhoto.gradient | VERIFIED | `export interface MceGradientStop`, `export interface MceGradientData` with type/stops/angle/center_x/center_y; `MceKeyPhoto.gradient?: MceGradientData` |
| `Application/src-tauri/src/models/project.rs` | Rust MceGradientData struct | VERIFIED | `pub struct MceGradientStop`, `pub struct MceGradientData` with `gradient_type: String`, `stops: Vec<MceGradientStop>`, optional fields with `#[serde(default, skip_serializing_if = "Option::is_none")]`; `MceKeyPhoto.gradient: Option<MceGradientData>` |
| `Application/src/stores/sequenceStore.ts` | updateKeyGradient and updateKeyGradientLive | VERIFIED | Both methods present at lines 547 and 573 |
| `Application/src/components/sequence/KeyPhotoStrip.tsx` | showGradientMode wired to ColorPickerModal | VERIFIED | `showGradientMode={true}` at line 444; `onGradientChange` at line 446; `onGradientLiveChange` at line 447 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `SequenceList.tsx SequenceItem handleSelect` | `keyPhotoCollapsed state` | `setKeyPhotoCollapsed(prev => !prev)` on same-sequence second click | WIRED | Lines 136, 141: toggle on same-seq, reset on switch |
| `TimelinePanel.tsx solo button` | `soloStore.toggleSolo()` | `onClick` handler | WIRED | Line 141: `onClick={() => soloStore.toggleSolo()}` |
| `Preview.tsx` | `renderGlobalFrame` | `soloStore.soloEnabled.value` passed as 7th parameter | WIRED | Line 32: `soloStore.soloEnabled.value` |
| `exportEngine.ts` | `renderGlobalFrame` | `soloStore.soloEnabled.peek()` passed as 7th parameter | WIRED | Line 144: `.peek()` used correctly for non-reactive context |
| `ExportPreview.tsx` | `renderGlobalFrame` | `soloStore.soloEnabled.value` passed as 7th parameter | WIRED | Line 58 |
| `exportRenderer.ts` | does NOT import soloStore | Pure function design | VERIFIED ABSENT | `grep -n "import.*soloStore" exportRenderer.ts` returns nothing |
| `shortcuts.ts` S key | `soloStore.toggleSolo()` | tinykeys binding with `shouldSuppressShortcut` guard | WIRED | Lines 405-409: `'s': (e) => { if (shouldSuppressShortcut(e)) return; ... soloStore.toggleSolo(); }` |
| `ColorPickerModal gradient mode` | `GradientData type` | `gradient` state and `onGradientChange` callback | WIRED | Lines 105-108: all gradient props present |
| `GradientBar stops` | `GradientData.stops` | draggable stop positions with pointer capture | WIRED | `setPointerCapture` at line 111, `onPointerDown`/`onPointerMove` at lines 154-155 |
| `KeyPhotoStrip.tsx ColorPickerModal` | `sequenceStore.updateKeyGradient` | `onGradientChange` callback with `showGradientMode={true}` | WIRED | Lines 444-447 |
| `projectStore.ts buildMceProject` | `MceGradientData` | gradient serialization in key_photos map | WIRED | Lines 108-115 |
| `projectStore.ts hydrateFromMce` | `GradientData` | gradient deserialization with camelCase mapping | WIRED | Lines 359-365: `center_x` mapped to `centerX` |
| `previewRenderer.ts renderFrame` | `createCanvasGradient` | `entry.gradient` check before `solidColor` | WIRED | Line 172: gradient in `hasDrawable` check; line 269: `createCanvasGradient` called as `fillStyle` |
| `exportRenderer.ts buildSequenceFrames` | `FrameEntry.gradient` | `kp.gradient` spread into frame entry | WIRED | Line 29 |
| `frameMap.ts` | `FrameEntry.gradient` | `kp.gradient` spread in computed signal | WIRED | Line 28 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `previewRenderer.ts` gradient rendering | `entry.gradient` | `FrameEntry.gradient` populated from `frameMap.ts` via `kp.gradient` spread | Yes — flows from `KeyPhoto.gradient` (set by `sequenceStore.updateKeyGradient`) through frameMap to renderer | FLOWING |
| `exportRenderer.ts` gradient in export | `kp.gradient` | `KeyPhoto.gradient` spread into `FrameEntry` in `buildSequenceFrames` | Yes — same source, flows to `renderGlobalFrame` | FLOWING |
| `projectStore.ts` gradient persistence | `kp.gradient` | Written by `sequenceStore.updateKeyGradient`, serialized in `buildMceProject`, deserialized in `hydrateFromMce` | Yes — round-trip serialization confirmed with snake_case/camelCase mapping | FLOWING |
| `ColorPickerModal.tsx` gradient state | `gradientState` | `useState` initialized from `props.gradient ?? createDefaultGradient()`, mutated by UI controls | Yes — callbacks fire `onGradientChange`/`onGradientLiveChange` which wire to `sequenceStore.updateKeyGradient` | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| soloStore unit tests pass | `npx vitest run src/stores/soloStore.test.ts` | 3/3 tests passed (241ms) | PASS |
| TypeScript compiles clean | `npx tsc --noEmit` | 1 pre-existing warning only (`glslRuntime.test.ts` unused import — not introduced by this phase) | PASS |
| Zero deprecated `[var(--` patterns remain | `grep -rn '\[var(--' Application/src/` | 0 matches | PASS |
| All 8 phase commits exist | `git log --oneline` | `db0e155`, `da293ba`, `40f363e`, `128a004`, `29eb9c2`, `9d35dda`, `7148a01`, `015b419` all confirmed | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ENH-01 | (dropped — not claimed by any plan) | User can scroll through key photos when list overflows | DROPPED | Per D-01, subsumed by ENH-02 collapse. REQUIREMENTS.md marks as dropped. No plan claims it. Correct disposition. |
| ENH-02 | 17-01-PLAN.md | User can collapse/expand key photo list by clicking sequence header bar a second time | SATISFIED | `keyPhotoCollapsed` toggle in `SequenceList.tsx`; second click collapses, switching sequences auto-expands |
| ENH-03 | 17-02-PLAN.md | User can toggle global solo mode to preview and export without overlay layers and FX | SATISFIED | `soloStore`, toolbar button, S shortcut, `renderGlobalFrame` overlay gating, all 3 call sites wired |
| ENH-04 | (dropped — not claimed by any plan) | User can solo individual layers within a sequence via sidebar toggle | DROPPED | Per D-07, dropped in favor of global solo only. REQUIREMENTS.md marks as dropped. Correct disposition. |
| ENH-05 | 17-03-PLAN.md, 17-04-PLAN.md | User can apply gradient fills with 2-5 stops via extended ColorPickerModal, persisting in .mce | SATISFIED | Types, UI, rendering, persistence, and Rust model all implemented and wired end-to-end |

**Note on prompt requirement IDs:** The verification prompt listed ENH-04 as a phase requirement ID, but REQUIREMENTS.md shows ENH-04 was dropped (per D-07) and the gradient feature is ENH-05. The plans correctly claim ENH-02, ENH-03, ENH-05. No orphaned requirements: ENH-01 and ENH-04 are explicitly dropped in REQUIREMENTS.md.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ColorPickerModal.tsx` | 631 | `placeholder="#000000"` | Info | HTML input placeholder attribute — not a code stub. Innocuous. |

No blockers or warnings found. The one "placeholder" occurrence is an HTML input attribute for the hex color text field, not a stub implementation.

---

### Human Verification Required

#### 1. Collapse/expand visual behavior

**Test:** Open the sidebar Sequences panel with at least one sequence active. Click the active sequence header a second time.
**Expected:** Key photo strip animates closed (max-height transitions to 0). Clicking again or switching to another sequence expands it.
**Why human:** CSS transition animation (`transition-[max-height] duration-150 ease-out`) and visual feel cannot be verified programmatically.

#### 2. Solo mode — overlay strip behavior in preview

**Test:** Add a FX or content-overlay layer to a project. Toggle solo mode via the Headphones button or S key. Observe the preview canvas.
**Expected:** All overlay layers and FX disappear from the preview. The preview shows only base content (key photos). Toggling solo off restores overlays.
**Why human:** Canvas rendering output requires visual inspection; automated checks cannot observe the pixel content of the preview canvas.

#### 3. Gradient fill — visual rendering

**Test:** Select a solid key entry. Open the color picker. Switch to Gradient mode. Add color stops, choose radial type, drag stops. Confirm the preview shows the gradient. Click Save and observe the preview canvas.
**Expected:** Preview canvas shows a correctly rendered gradient matching the type (linear/radial/conic) and stop positions/colors configured.
**Why human:** Canvas gradient rendering requires visual inspection of the output.

#### 4. Project file round-trip with gradients

**Test:** Create a project with gradient solid entries. Save as .mce (v13). Close and reopen. Verify gradients are preserved.
**Expected:** Gradient fills, stop colors, positions, type, angle, and center values survive the save/load cycle.
**Why human:** Requires Tauri filesystem save/load operations in the running app.

#### 5. Backward compatibility — open v12 project

**Test:** Open a pre-existing .mce file saved at version 12 (without gradient data).
**Expected:** File opens without errors; all solid entries retain their solid colors; no crash or data loss.
**Why human:** Requires a real v12 project file and the running Tauri application.

---

### Gaps Summary

No gaps. All 5 observable truths verified, all 17 artifacts confirmed at all levels (exists, substantive, wired, data-flowing), all 15 key links confirmed WIRED, 3/3 soloStore tests passing, 0 deprecated Tailwind patterns remaining, TypeScript compiles with only a pre-existing unrelated warning.

---

_Verified: 2026-03-24T10:10:34Z_
_Verifier: Claude (gsd-verifier)_
