---
phase: 22-foundation-quick-wins
verified: 2026-03-27T00:40:00Z
status: passed
score: 14/14 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 10/11
  gaps_closed:
    - "Motion path dots appear noticeably denser on short sequences (< 30 frames) due to sub-frame sampling"
    - "Adding to indicator text is readable (amber/orange) on dark background in both menus"
    - "Layer creation in isolation mode adds a NEW timeline-level sequence aligned with the isolated sequence's frame range"
    - "Timeline Add FX menu adds FX/paint/content layer to timeline aligned with isolated sequence, not to key photo sequence layers"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Visual layout of paint properties panel"
    expected: "Panel shows compact layout with 2-col grids, no PAINT BACKGROUND / BRUSH STYLE / STROKE / ACTIONS headers, Clear Brushes button is red, bottom sections are BRUSH, TABLET, ONION SKIN only"
    why_human: "Visual rendering and spatial compactness cannot be confirmed via static analysis"
  - test: "Isolation-aware layer creation flow — frame range alignment"
    expected: "When a sequence is isolated, clicking the timeline or sidebar add-layer menu creates a NEW timeline-level sequence (FX or content-overlay) with inFrame/outFrame matching the isolated sequence's frame range. The 'Adding to:' indicator appears in amber text."
    why_human: "Requires running app with isolation state active; frame range computation depends on runtime trackLayouts signal values"
  - test: "Auto-flatten on exit paint mode"
    expected: "Switching out of paint mode automatically flattens the current frame without a manual button click"
    why_human: "Requires live paint mode interaction to verify the effect() fires correctly"
---

# Phase 22: Foundation & Quick Wins — Verification Report

**Phase Goal:** Users get immediate UX improvements to paint properties, layer creation, and motion path visualization while pre-existing bugs are fixed to stabilize the paint store for all subsequent phases
**Verified:** 2026-03-27T00:40:00Z
**Status:** passed
**Re-verification:** Yes — after UAT gap closure (plans 04 and 05)

---

## Re-verification Context

Previous VERIFICATION.md (2026-03-26T23:30:00Z) had status `gaps_found` in the report body with score 10/11, despite frontmatter showing `passed`. UAT testing after that initial verification uncovered 3 additional gaps:

1. Motion path sub-frame density visually insufficient (Math.round + duplicate keys discarding 75% of dots)
2. "Adding to:" indicator text unreadable (blue on dark background)
3. Isolation-mode layer creation added internal sub-layers instead of timeline-level sequences

Gap-closure plans 04 and 05 addressed all three. This re-verification confirms all gaps are closed.

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | `moveElementsForward/Backward/ToFront/ToBack` all bump `paintVersion` so canvas re-renders | ✓ VERIFIED | `_notifyVisualChange` called in all 4 functions (paintStore.ts lines 117, 140, 169, 199, 227, 255); helper increments `paintVersion.value++` at line 70 |
| 2  | `moveElements*` operations support undo/redo with a single `pushAction` per call | ✓ VERIFIED | `pushAction` at lines 118, 141, 170, 200, 228, 256 — each with snapshot-based `undo`/`redo` callbacks; 24 unit tests pass |
| 3  | Undo/redo callbacks also bump `paintVersion` so canvas updates after undo | ✓ VERIFIED | `_notifyVisualChange` called inside every `undo` and `redo` callback in all 4 functions |
| 4  | Motion path shows 4x more dots for sequences spanning fewer than 30 frames, without Preact deduplication | ✓ VERIFIED | `step = span < 30 ? 0.25 : 1` line 54; `frame: f` (raw fractional, not Math.round) line 63; `key={index}` line 187; 17 tests pass including fractional-value and uniqueness tests |
| 5  | When a sequence is isolated, creating an FX/paint layer from the timeline menu creates a NEW timeline-level FX sequence aligned with the isolated sequence's frame range | ✓ VERIFIED | AddFxMenu.tsx line 72: `sequenceStore.createFxSequence(name, fxLayer, totalFrames.peek(), { inFrame: isolatedInFrame, outFrame: isolatedOutFrame })`; no `addLayerToSequence` calls |
| 6  | When a sequence is isolated, creating a content layer from the sidebar menu creates a NEW timeline-level content-overlay sequence aligned with the isolated sequence's frame range | ✓ VERIFIED | ImportedView.tsx lines 103-105, 172-174, 244-246 call `createContentOverlaySequence` with `isolatedInFrame`/`isolatedOutFrame` from intent; no `addLayerToSequence` calls |
| 7  | "Adding to: [Sequence Name]" indicator is shown in amber (#F59E0B) — readable on dark background | ✓ VERIFIED | AddFxMenu.tsx line 135: `text-[#F59E0B]`; AddLayerMenu.tsx line 88: `text-[#F59E0B]` |
| 8  | Frame range for isolation-mode layers is computed from `trackLayouts` signal (runtime layout positions) | ✓ VERIFIED | AddFxMenu.tsx lines 43-51 and AddLayerMenu.tsx lines 38-51 both look up `trackLayouts.value.find(t => t.sequenceId === targetSequenceId)` |
| 9  | When no sequence is isolated, layer creation behavior is unchanged | ✓ VERIFIED | All three files fall through to `createFxSequence(name, layer, totalFrames.peek())` / `createContentOverlaySequence(...)` with no opts when `targetSequenceId` is null |
| 10 | Paint properties panel has removed PAINT BACKGROUND, BRUSH STYLE, STROKE, ACTIONS section headers | ✓ VERIFIED | No `SectionLabel` with those texts; only SELECTION, BRUSH (x2 conditional), SHAPE, FILL, TABLET, ONION SKIN remain |
| 11 | Clear Brushes button has red background (`#DC2626`) and white text | ✓ VERIFIED | `backgroundColor: '#DC2626', color: '#FFFFFF'` at line 467 |
| 12 | Background color and "Show BG Sequence" checkbox appear on the same row | ✓ VERIFIED | Lines 75-107: both controls in a 2-col flex row; UAT test 10 passed by user |
| 13 | Full test suite has zero failures and no regressions | ✓ VERIFIED | 277 passed, 101 todo, 0 failed across 26 test files |
| 14 | All requirement IDs (UXP-01, UXP-02, UXP-03) are marked Complete in REQUIREMENTS.md | ✓ VERIFIED | Lines 35-37: `[x]` checkboxes; lines 79-81: `Complete` in tracker table |

**Score:** 14/14 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `Application/src/stores/paintStore.ts` | `_notifyVisualChange` helper, fixed `moveElements*` | ✓ VERIFIED | Helper at line 68-73; 14 `_notifyVisualChange` calls across all 4 functions' body and callbacks |
| `Application/src/stores/paintStore.test.ts` | Unit tests for `moveElements*` bug fixes | ✓ VERIFIED | 24 tests, all pass |
| `Application/src/components/canvas/MotionPath.tsx` | Sub-frame sampling with fractional frame preservation and index-based keys | ✓ VERIFIED | `step = span < 30 ? 0.25 : 1` line 54; `frame: f` (raw float) line 63; `key={index}` line 187; `Math.round` only in currentDot lookup line 156 |
| `Application/src/components/canvas/motionPath.test.ts` | Tests for sub-frame dot density with fractional frame values | ✓ VERIFIED | 17 tests pass; fractional-value and uniqueness tests added in plan 04 |
| `Application/src/stores/uiStore.ts` | `AddLayerIntent` with `targetSequenceId`, `isolatedInFrame`, `isolatedOutFrame` fields | ✓ VERIFIED | Lines 11-14: all three optional fields present |
| `Application/src/stores/sequenceStore.ts` | `createFxSequence` and `createContentOverlaySequence` with optional `opts?: { inFrame?, outFrame? }` | ✓ VERIFIED | `createFxSequence` at line 173 with opts; `createContentOverlaySequence` at line 204 with opts |
| `Application/src/components/layer/AddLayerMenu.tsx` | Isolation-aware sidebar menu; amber indicator; frame range from trackLayouts | ✓ VERIFIED | `trackLayouts` import line 5; `#F59E0B` line 88; frame range computed lines 38-51; no `addLayerToSequence` calls |
| `Application/src/components/timeline/AddFxMenu.tsx` | Isolation-aware timeline menu; amber indicator; createFxSequence with frame range | ✓ VERIFIED | `trackLayouts` import line 10; `#F59E0B` line 135; `createFxSequence` with opts at lines 72, 115; no `addLayerToSequence` calls |
| `Application/src/components/views/ImportedView.tsx` | Isolation routing to `createContentOverlaySequence` with frame range opts | ✓ VERIFIED | `createContentOverlaySequence` with `isolatedInFrame`/`isolatedOutFrame` at lines 103-105, 172-174, 244-246 |
| `Application/src/components/sidebar/PaintProperties.tsx` | Reorganized paint panel (min 700 lines) | ✓ VERIFIED | 967 lines; headers removed; 2-col grids; BRUSH/TABLET/ONION SKIN order; `Show BG Sequence` label (user-approved deviation from `Show Seq BG`) |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `paintStore.ts` | `paintVersion` signal | `_notifyVisualChange` helper | ✓ WIRED | `paintVersion.value++` at line 70; helper called in all 4 functions and their callbacks |
| `paintStore.ts` | `lib/history pushAction` | undo/redo in `moveElements*` | ✓ WIRED | `pushAction` at lines 118, 141, 170, 200, 228, 256 |
| `MotionPath.tsx sampleMotionDots` | SVG `<circle>` render | fractional frame values preserved; index-based keys | ✓ WIRED | `frame: f` line 63 preserves float; `dots.map((dot, index) => <circle key={index} ...>)` line 187 |
| `AddFxMenu.tsx` | `sequenceStore.createFxSequence` | computed `inFrame`/`outFrame` from `trackLayouts` when isolated | ✓ WIRED | Lines 43-51 compute range; lines 72, 115 pass `{ inFrame, outFrame }` opts |
| `AddLayerMenu.tsx` | `uiStore.setAddLayerIntent` | `isolatedInFrame`/`isolatedOutFrame` in intent when isolated | ✓ WIRED | Lines 53, 61, 69 spread `{ targetSequenceId, isolatedInFrame, isolatedOutFrame }` into intent |
| `ImportedView.tsx` | `sequenceStore.createContentOverlaySequence` | `currentIntent.isolatedInFrame`/`isolatedOutFrame` opts | ✓ WIRED | Lines 103-105, 172-174, 244-246 pass opts from intent fields |

---

## Data-Flow Trace (Level 4)

Not applicable — no artifacts in this phase render data from an external database or API. All data flows are through in-memory Preact signals (`paintVersion`, `sequences`, `isolatedSequenceIds`, `trackLayouts`). Signal flows are verified structurally via key link checks above.

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| paintStore tests: all `moveElements*` functions | `vitest run src/stores/paintStore.test.ts` | 24 passed | ✓ PASS |
| motionPath tests: sub-frame density with fractional frame preservation | `vitest run src/components/canvas/motionPath.test.ts` | 17 passed (includes fractional-value and uniqueness tests) | ✓ PASS |
| Full test suite regression check | `vitest run` | 277 passed, 0 failed, 26 test files | ✓ PASS |
| No `key={dot.frame}` in dot render loop | grep `key={` MotionPath.tsx | Lines 187 (`key={index}`) and 213 (`key={kf-...}`) only | ✓ PASS |
| No `addLayerToSequence` in isolation paths | grep isolation files | Zero occurrences in AddFxMenu, AddLayerMenu, ImportedView | ✓ PASS |

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| UXP-03 | Plan 01, Plan 04 | Motion path shows denser interpolation dots for short sequences | ✓ SATISFIED | `step = span < 30 ? 0.25 : 1`; fractional `frame: f`; `key={index}`; 7 sub-frame tests pass; REQUIREMENTS.md `[x]` |
| UXP-02 | Plan 02, Plan 05 | New roto/paint layer is created only on isolated sequence when one is selected | ✓ SATISFIED | `createFxSequence`/`createContentOverlaySequence` with `inFrame`/`outFrame` from `trackLayouts` in all isolation paths; amber indicator; REQUIREMENTS.md `[x]` |
| UXP-01 | Plan 03 | Paint properties panel is reorganized for space optimization with cleaner buttons | ✓ SATISFIED | Section headers removed; 2-col grids; red Clear Brushes; correct section order; user-approved `Show BG Sequence` label; REQUIREMENTS.md `[x]` |

No orphaned requirements. All three IDs declared in plan frontmatter are covered and marked Complete in REQUIREMENTS.md.

**Note on label deviation (D-02):** Plan 03 acceptance criterion specifies `Show Seq BG`. The implemented label is `Show BG Sequence`. UAT test 10 ("Background Color and Show BG Sequence Row") passed — the user validated this label text during the UAT session. This is a user-approved deviation documented in the previous VERIFICATION.md.

---

## Anti-Patterns Found

None detected. All 9 files modified across plans 01-05 were scanned:

- No TODO/FIXME/PLACEHOLDER comments
- No stub return values in active code paths
- No empty handlers
- No disconnected signal reads
- No `addLayerToSequence` calls remaining in isolation code paths

---

## Human Verification Required

### 1. Paint Panel Visual Layout

**Test:** Open the app, enter paint mode on any paint layer, inspect the properties sidebar.
**Expected:** No PAINT BACKGROUND / BRUSH STYLE / STROKE / ACTIONS section headers visible; background row is compact with swatch + checkbox + Reset on one line; BRUSH section shows style buttons at top, Size+Clear Brushes row, Opacity row; bottom order is BRUSH, TABLET, ONION SKIN only; Clear Brushes button is visually red with white text.
**Why human:** Visual compactness and spatial correctness cannot be confirmed statically.

### 2. Isolation-Aware Layer Creation — Frame Range Alignment

**Test:** In the timeline, isolate a sequence that spans e.g. frames 10-30. Open the "+ Layer" timeline menu and add a Paint layer. Also try the sidebar "+ Add" menu for a static image.
**Expected:** Both menus display "Adding to: [Sequence Name]" in amber/orange text. The created layer appears in the timeline as a new track aligned with frames 10-30 (inFrame=10, outFrame=30), not as a full-length track and not as a sub-layer inside the content sequence.
**Why human:** Frame range computation uses `trackLayouts` signal which only has runtime values; isolation signal state is runtime-only.

### 3. Auto-Flatten on Exit Paint Mode

**Test:** Enter paint mode, draw some strokes on a frame, then click "Exit Paint Mode."
**Expected:** The current frame is automatically flattened (no manual "Flatten Frame" button needed); strokes remain visible as a rasterized frame after exit.
**Why human:** Requires live paint mode interaction to confirm the `effect()` in `paintStore.ts` fires at the correct moment.

---

## Gaps Summary

No gaps remain. All UAT-identified issues are resolved:

**Motion path density (UXP-03):** Plan 04 fixed the two rendering bugs. Fractional frame values are now stored in dot objects (`frame: f`), and SVG circles use sequential index keys (`key={index}`), preventing Preact from deduplicating sub-frame dots. 17 tests confirm correct behavior.

**Indicator readability (UXP-02):** Both AddFxMenu and AddLayerMenu now use `text-[#F59E0B]` (amber) for the "Adding to:" indicator, replacing the unreadable blue accent color.

**Isolation layer routing (UXP-02):** Plan 05 replaced all `addLayerToSequence` calls in isolation paths with `createFxSequence`/`createContentOverlaySequence` + optional `{ inFrame, outFrame }` opts derived from `trackLayouts`. Frame range is propagated through `AddLayerIntent` for the sidebar path. The change covers FX layers, paint layers, static images, videos, and image sequences.

All three requirement IDs (UXP-01, UXP-02, UXP-03) are marked Complete in REQUIREMENTS.md. Full test suite passes with 277 tests across 26 files.

---

_Verified: 2026-03-27T00:40:00Z_
_Verifier: Claude (gsd-verifier)_
