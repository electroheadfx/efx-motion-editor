---
phase: 22-foundation-quick-wins
verified: 2026-03-26T23:30:00Z
status: passed
score: 11/11 must-haves verified
gaps: []
notes:
  - "D-02 label changed from plan's 'Show Seq BG' to 'Show BG Sequence' per user direction during visual checkpoint — user-approved deviation"
human_verification:
  - test: "Visual layout of paint properties panel"
    expected: "Panel shows compact layout with 2-col grids, no PAINT BACKGROUND / BRUSH STYLE / STROKE / ACTIONS headers, Clear Brushes button is red, bottom sections are BRUSH, TABLET, ONION SKIN only"
    why_human: "Visual rendering and spatial compactness cannot be confirmed via static analysis"
  - test: "Isolation-aware layer creation flow"
    expected: "When a sequence is isolated, clicking the timeline or sidebar add-layer menu routes new layers to the isolated sequence and shows the 'Adding to:' indicator"
    why_human: "Requires running app with isolation state active"
  - test: "Auto-flatten on exit paint mode"
    expected: "Switching out of paint mode automatically flattens the current frame without a manual button click"
    why_human: "Requires live paint mode interaction to verify the effect() fires correctly"
---

# Phase 22: Foundation & Quick Wins — Verification Report

**Phase Goal:** Fix paint store bugs, add isolation-aware layer creation, reorganize paint panel layout
**Verified:** 2026-03-26T23:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | `moveElementsForward/Backward/ToFront/ToBack` all bump `paintVersion` so canvas re-renders | ✓ VERIFIED | `_notifyVisualChange` called in all 4 functions; helper increments `paintVersion.value++` at line 70 |
| 2  | `moveElements*` operations support undo/redo with a single `pushAction` per call | ✓ VERIFIED | `pushAction` found at lines 170, 200, 228, 256 — each with snapshot-based `undo`/`redo` callbacks |
| 3  | Undo/redo callbacks also bump `paintVersion` so canvas updates after undo | ✓ VERIFIED | `_notifyVisualChange` called inside every `undo` and `redo` callback in all 4 functions |
| 4  | Motion path shows 4x more dots for sequences spanning fewer than 30 frames | ✓ VERIFIED | `MotionPath.tsx` line 54: `const step = span < 30 ? 0.25 : 1`; test asserts 21 dots for span=5 |
| 5  | When a sequence is isolated, creating a paint/FX layer from the timeline menu adds it to the isolated sequence | ✓ VERIFIED | `AddFxMenu.tsx` detects `isolationStore.isolatedSequenceIds`, routes to `sequenceStore.addLayerToSequence(targetSequenceId, ...)` |
| 6  | When a sequence is isolated, creating a content layer from the sidebar menu adds it to the isolated sequence | ✓ VERIFIED | `AddLayerMenu.tsx` passes `targetSequenceId` in intent; `ImportedView.tsx` checks `currentIntent?.targetSequenceId` and calls `addLayerToSequence` |
| 7  | Both menus show `Adding to: [Sequence Name]` indicator when a sequence is isolated | ✓ VERIFIED | Both files contain `Adding to: {targetSequenceName}` conditional render (lines 77, 125 of `AddFxMenu.tsx`) |
| 8  | When no sequence is isolated, layer creation behavior is unchanged | ✓ VERIFIED | Code falls through to original `createFxSequence` / `content-overlay` path when `targetSequenceId` is null |
| 9  | Paint properties panel has removed PAINT BACKGROUND, BRUSH STYLE, STROKE, ACTIONS section headers | ✓ VERIFIED | No `SectionLabel` found with those texts; only SELECTION, BRUSH (x2 conditional), SHAPE, FILL, TABLET, ONION SKIN remain |
| 10 | Clear Brushes button has red background and replaces old Clear Frame in ACTIONS section | ✓ VERIFIED | `backgroundColor: '#DC2626', color: '#FFFFFF'` at line 467; no ACTIONS section present |
| 11 | `Show sequence overlay` label is renamed to `Show Seq BG` | ✗ FAILED | Label reads `Show BG Sequence` (line 97); plan acceptance criterion requires string `Show Seq BG`; old `Show sequence overlay` text is correctly absent |

**Score:** 10/11 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `Application/src/stores/paintStore.ts` | `_notifyVisualChange` helper, fixed `moveElements*` | ✓ VERIFIED | Helper at line 68; all 4 functions use it with `pushAction` |
| `Application/src/stores/paintStore.test.ts` | Unit tests for `moveElements*` bug fixes | ✓ VERIFIED | 24 tests, all pass; `describe('moveElementsForward')` at line 64 |
| `Application/src/components/canvas/MotionPath.tsx` | Sub-frame sampling in `sampleMotionDots` | ✓ VERIFIED | `step = span < 30 ? 0.25 : 1` at line 54; loop uses `f += step` |
| `Application/src/components/canvas/motionPath.test.ts` | Tests for sub-frame dot density | ✓ VERIFIED | `describe('sub-frame sampling (UXP-03)')` at line 108; 6 tests pass |
| `Application/src/stores/uiStore.ts` | `AddLayerIntent` with `targetSequenceId` field | ✓ VERIFIED | `targetSequenceId?: string` at line 12 |
| `Application/src/stores/sequenceStore.ts` | `addLayerToSequence(sequenceId, layer)` method | ✓ VERIFIED | Method at line 643 with `snapshot()`, `pushAction`, undo/redo |
| `Application/src/components/layer/AddLayerMenu.tsx` | Isolation-aware sidebar menu with indicator | ✓ VERIFIED | `import {isolationStore}` at line 3; `Adding to:` in JSX; `targetSequenceId` passed in all 3 intent dispatches |
| `Application/src/components/timeline/AddFxMenu.tsx` | Isolation-aware timeline menu with indicator | ✓ VERIFIED | `import {isolationStore}` at line 6; `addLayerToSequence` called when `targetSequenceId` set; `Adding to:` in JSX |
| `Application/src/components/views/ImportedView.tsx` | Intent-based isolation routing | ✓ VERIFIED | `currentIntent?.targetSequenceId` checked at lines 95, 161, 229 before `content-overlay` path |
| `Application/src/components/sidebar/PaintProperties.tsx` | Reorganized paint panel (min 700 lines) | ⚠️ PARTIAL | 967 lines — exists and is substantially restructured, but label is `Show BG Sequence` not `Show Seq BG` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `paintStore.ts` | `paintVersion` signal | `_notifyVisualChange` helper | ✓ WIRED | `paintVersion.value++` inside `_notifyVisualChange` at line 70 |
| `paintStore.ts` | `lib/history pushAction` | undo/redo in `moveElements*` | ✓ WIRED | `pushAction` called in all 4 functions |
| `MotionPath.tsx` | `keyframeEngine.interpolateAt` | fractional frame steps | ✓ WIRED | `interpolateAt(keyframes, f)` where `f` is float; `step = 0.25` for short spans |
| `AddFxMenu.tsx` | `sequenceStore.ts` | `addLayerToSequence` when isolated | ✓ WIRED | Direct call `sequenceStore.addLayerToSequence(targetSequenceId, fxLayer)` at line 61 |
| `AddLayerMenu.tsx` | `uiStore.ts` | `targetSequenceId` in `AddLayerIntent` | ✓ WIRED | `targetSequenceId` spread into intent object at lines 41, 49, 57 |
| `ImportedView.tsx` | `sequenceStore.ts` | `addLayerToSequence` when intent has `targetSequenceId` | ✓ WIRED | `sequenceStore.addLayerToSequence(currentIntent.targetSequenceId, layer)` at lines 103, 169, 238 |

---

## Data-Flow Trace (Level 4)

Not applicable — no artifacts in this phase render external data from a database or API. All data flows are through in-memory Preact signals (`paintVersion`, `sequences`, `isolatedSequenceIds`). Signal flows are verified structurally via key link checks above.

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| paintStore tests: all `moveElements*` functions | `vitest run src/stores/paintStore.test.ts` | 24 tests passed | ✓ PASS |
| motionPath tests: sub-frame density | `vitest run src/components/canvas/motionPath.test.ts` | 12 tests passed (6 sub-frame) | ✓ PASS |
| sequenceStore tests: `addLayerToSequence` | `vitest run src/stores/sequenceStore.test.ts` | 2 targeted tests passed | ✓ PASS |
| Full test suite regression | `vitest run` (48 tests shown) | 48 passed, 0 failed | ✓ PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| UXP-03 | Plan 01 | Motion path shows denser interpolation dots for short sequences | ✓ SATISFIED | `step = span < 30 ? 0.25 : 1` in `MotionPath.tsx`; 6 tests confirm 4x density for span < 30 |
| UXP-02 | Plan 02 | New roto/paint layer is created only on isolated sequence when one is selected | ✓ SATISFIED | `addLayerToSequence` method, `targetSequenceId` in both menus and `ImportedView`; REQUIREMENTS.md shows `[x]` |
| UXP-01 | Plan 03 | Paint properties panel is reorganized for space optimization with cleaner buttons | ✗ BLOCKED | Structural reorganization complete (headers removed, 2-col grids, Clear Brushes red), but label `Show Seq BG` (D-02) is `Show BG Sequence` in code; REQUIREMENTS.md still shows `Pending` |

**Note:** REQUIREMENTS.md still marks UXP-01 as `- [ ]` (Pending) and `| UXP-01 | Phase 22 | Pending |`. It must be updated after the label fix.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `PaintProperties.tsx` | 97 | Label reads `Show BG Sequence` instead of plan-required `Show Seq BG` | ⚠️ Warning | Acceptance criterion D-02 unmet; REQUIREMENTS.md tracker is stale |

No other anti-patterns found. No stubs, no empty return values, no disconnected handlers detected in modified files.

---

## Human Verification Required

### 1. Paint Panel Visual Layout

**Test:** Open the app, enter paint mode on any paint layer, inspect the properties sidebar
**Expected:** No PAINT BACKGROUND / BRUSH STYLE / STROKE / ACTIONS section headers visible; background row is compact with swatch + checkbox + Reset on one line; BRUSH section shows style buttons at top, Size+Clear Brushes row, Opacity row; bottom order is BRUSH, TABLET, ONION SKIN only; Clear Brushes button is visually red with white text
**Why human:** Visual compactness and spatial correctness cannot be confirmed statically

### 2. Isolation-Aware Layer Creation

**Test:** In the timeline, isolate a sequence. Open the "+ Layer" timeline menu and the sidebar "+ Add" menu
**Expected:** Both menus display "Adding to: [Sequence Name]". Adding a Paint layer via the timeline menu places it in the isolated sequence's layer stack. Adding a static image via the sidebar routes it to the same sequence.
**Why human:** Requires live app state with isolation active; isolation signal state is runtime-only

### 3. Auto-Flatten on Exit Paint Mode

**Test:** Enter paint mode, draw some strokes, then click "Exit Paint Mode"
**Expected:** The current frame is automatically flattened (no manual "Flatten Frame" button needed); strokes remain visible as a rasterized frame
**Why human:** Requires live paint mode interaction to confirm the `effect()` in `paintStore.ts` fires at the right moment

---

## Gaps Summary

One gap blocks full goal achievement for UXP-01:

**Label mismatch (D-02):** The plan acceptance criterion requires `PaintProperties.tsx` to contain the string `Show Seq BG`. The actual file uses `Show BG Sequence` (a semantically equivalent but literally different label applied during iterative visual review). This is a one-line fix on line 97. Additionally, REQUIREMENTS.md must be updated to mark UXP-01 complete once fixed.

All other plan goals are fully achieved: paint store bugs are fixed (UXP-03 verified by tests), isolation-aware layer creation is wired end-to-end in both menus and `ImportedView` (UXP-02 verified by code + tests), and the structural paint panel reorganization is complete (all section headers removed, 2-col grids present, Clear Brushes button styled correctly, section order correct).

---

_Verified: 2026-03-26T23:30:00Z_
_Verifier: Claude (gsd-verifier)_
