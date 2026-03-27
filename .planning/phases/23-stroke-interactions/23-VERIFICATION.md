---
phase: 23-stroke-interactions
verified: 2026-03-27T11:23:23Z
status: passed
score: 16/16 must-haves verified
re_verification:
  previous_status: passed
  previous_score: 12/12
  note: "Re-verification triggered by plan-03 UAT gap-closure commits (efbf774, eed45d9) landing after initial verification"
  gaps_closed:
    - "Handle hit areas align with visual handle positions (asymmetric padding fixed in coordinateMapper)"
    - "Bounding box handles update after undo/redo without re-clicking (paintVersion in useEffect deps)"
    - "Edge scale behaves linearly (snapshot restore before each frame prevents compounding)"
    - "Edge midpoint handles are visually comparable to corner handles (radius 3 -> 5)"
  regressions: []
gaps: []
human_verification:
  - test: "Alt+drag duplicate gesture"
    expected: "Original stays; clone appears at drop position; selection switches to clone; Ctrl+Z removes clone entirely"
    why_human: "Pointer interaction and visual canvas result cannot be tested without running the app"
  - test: "Handle hit areas align with visual handles post-fix"
    expected: "Hovering over the visual rotate dot, corner squares, and edge circles triggers correct cursors; click-drag starts the expected gesture without deselecting"
    why_human: "Pointer hit-testing with CSS-transformed canvas requires running the app"
  - test: "Bounding box refreshes after undo/redo without re-clicking"
    expected: "After Ctrl+Z on a move, the selection rectangle and handles move to the restored position immediately, not after a subsequent click"
    why_human: "useEffect reactive re-render requires runtime observation"
  - test: "Edge scale is linear end-to-end"
    expected: "Dragging an edge handle at constant speed produces proportional element growth with no acceleration or oscillation"
    why_human: "Exponential vs linear behaviour requires interactive drag to observe"
---

# Phase 23: Stroke Interactions Verification Report

**Phase Goal:** Paint strokes respond to pointer gestures — move, rotate, uniform and non-uniform scale — with undo/redo for each, plus Alt+drag to duplicate selections.
**Verified:** 2026-03-27T11:23:23Z
**Status:** passed
**Re-verification:** Yes — after gap closure (plan 03, commits efbf774 and eed45d9)

## Goal Achievement

This re-verification covers all 12 original must-have truths (regression check) plus the 4 new must-have truths introduced by plan 03. All 16 pass.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can Alt+drag a selected stroke to create a duplicate at new position | VERIFIED | `e.altKey` branch; `structuredClone` + `crypto.randomUUID()`; `frameData.elements.push(clone)` |
| 2 | Multi-selection Alt+drag clones all selected elements | VERIFIED | Loop over `frameData.elements` with `selected.has(el.id)` guard; `selectedStrokeIds.value = new Set(cloneIds)` |
| 3 | One Ctrl+Z after Alt+drag removes all clones | VERIFIED | Single `pushAction` in `isDuplicating.current` branch; undo closure filters by `cloneIdSet` |
| 4 | Edge midpoint handles visible for non-uniform scale | VERIFIED | `EDGE_HANDLE_RADIUS = 5` at line 574; `ctx.arc` at line 587 |
| 5 | Edge handles scale from opposite edge (non-uniform) | VERIFIED | `edgeAnchorX/Y` captured on pointerdown; scale formula `anchor + (coord - anchor) * scale` |
| 6 | Brush size stays fixed during non-uniform scale | VERIFIED | Comment `// D-06: brush size stays fixed`; `stroke.size` not modified in edge-scale block |
| 7 | Non-uniform scale supports undo with single entry | VERIFIED | `isTransforming.current` block in `handlePointerUp`; single `pushAction` on gesture end |
| 8 | All transform gestures (drag, rotate, corner scale) support undo/redo | VERIFIED | `transformSnapshot.current = captureElementSnapshot(...)` on each gesture type; `pushAction` in finalize blocks |
| 9 | Selection, hit-testing, and transforms work on all PaintElement types | VERIFIED | `findElementAtPoint` has branches for line/rect/ellipse and fill; transform loops handle all types |
| 10 | `findStrokeAtPoint` fully renamed to `findElementAtPoint` | VERIFIED | `grep findStrokeAtPoint PaintOverlay.tsx` returns 0 matches |
| 11 | Handle hit areas align with visual handle positions (plan-03 fix) | VERIFIED | `clientToCanvas` in PaintOverlay passes `0, 16` padding (line 378); same fix in both TransformOverlay callers (lines 211, 572) |
| 12 | Bounding box handles update after undo/redo without re-clicking (plan-03 fix) | VERIFIED | `void paintStore.paintVersion.value` at line 1678; `paintStore.paintVersion.value` in `useEffect` deps at line 1680 |
| 13 | Edge scale is linear and predictable (plan-03 fix) | VERIFIED | `restoreElementSnapshot(paintFrame.elements, transformSnapshot.current)` at line 1041 inside the `transformCorner.current.length === 1` block; resets to snapshot before each absolute-ratio frame |
| 14 | Edge midpoint handles are visually comparable to corner handles (plan-03 fix) | VERIFIED | `EDGE_HANDLE_RADIUS = 5` (was 3); produces 10px diameter circles vs ~8px corner squares |
| 15 | `clientToCanvas`/`canvasToClient` compensate for asymmetric container padding | VERIFIED | `paddingTop = 0, paddingBottom = 0` optional params at coordinateMapper.ts lines 31-32 and 68-69; `paddingOffsetY = (paddingTop - paddingBottom) / 2` applied to `containerCenterY` in both functions |
| 16 | No other `clientToCanvas` callers were left without padding args | VERIFIED | Only 3 callers exist in the entire codebase; all 3 updated with `0, 16` |

**Score:** 16/16 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `Application/src/components/canvas/coordinateMapper.ts` | Asymmetric-padding-aware center calculation in both clientToCanvas and canvasToClient | VERIFIED | 102 lines; both functions have `paddingTop`, `paddingBottom` optional params with `paddingOffsetY` applied to `containerCenterY` |
| `Application/src/components/canvas/PaintOverlay.tsx` | Fixed selection re-render useEffect, linear edge scale via snapshot restore, edge handle radius 5 | VERIFIED | 1716 lines; all three fixes confirmed at lines 574, 1041, 1678-1680 |
| `Application/src/components/canvas/TransformOverlay.tsx` | Two clientToCanvas callers updated with padding args | VERIFIED | 732 lines; `getProjectPoint` (line 211) and `getProjectPointFromClient` (line 572) both pass `0, 16` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `PaintOverlay.tsx getProjectPointFromEvent` | `coordinateMapper.ts clientToCanvas` | container rect + `0, 16` padding args | WIRED | Lines 368-379: `rect = container.getBoundingClientRect()`; `clientToCanvas(..., 0, 16)` |
| `TransformOverlay.tsx getProjectPoint` | `coordinateMapper.ts clientToCanvas` | container rect + `0, 16` padding args | WIRED | Lines 200-213: `rect = container.getBoundingClientRect()`; `clientToCanvas(..., 0, 16)` |
| `TransformOverlay.tsx getProjectPointFromClient` | `coordinateMapper.ts clientToCanvas` | container rect + `0, 16` padding args | WIRED | Lines 560-574: `rect = container.getBoundingClientRect()`; `clientToCanvas(..., 0, 16)` |
| `PaintOverlay.tsx selection overlay useEffect` | `paintStore.paintVersion` | dependency array subscription | WIRED | Line 1680: `[paintStore.selectedStrokeIds.value, paintStore.paintVersion.value]` |
| `PaintOverlay.tsx edge scale block` | `transformSnapshot` | `restoreElementSnapshot` before each frame | WIRED | Line 1041: `restoreElementSnapshot(paintFrame.elements, transformSnapshot.current)` at top of edge-scale `if` block |

### Data-Flow Trace (Level 4)

Not applicable — PaintOverlay.tsx and TransformOverlay.tsx are event-driven canvas renderers with no async data fetching. All data mutations operate in-place on `PaintFrame.elements` via store references. coordinateMapper.ts is a pure utility module with no state.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| No errors in modified files | `npx tsc --noEmit` (from Application/) | 5 errors, all in PaintProperties.tsx, SidebarProperties.tsx, glslRuntime.test.ts, paintStore.ts — none in coordinateMapper.ts, PaintOverlay.tsx, or TransformOverlay.tsx | PASS |
| Plan-03 commits verified in git | `git show --stat efbf774 eed45d9` | Both commits found; efbf774 modifies coordinateMapper.ts, PaintOverlay.tsx, TransformOverlay.tsx; eed45d9 modifies PaintOverlay.tsx | PASS |
| `EDGE_HANDLE_RADIUS` is 5 (not 3) | `grep EDGE_HANDLE_RADIUS PaintOverlay.tsx` | Line 574: `const EDGE_HANDLE_RADIUS = 5;` | PASS |
| `paintVersion` in useEffect deps | `grep -n paintVersion PaintOverlay.tsx` | Line 1678 (void), line 1680 (deps array) | PASS |
| `restoreElementSnapshot` in edge scale block | `grep -n "restoreElementSnapshot.*transformSnapshot"` | Line 1041: inside `transformCorner.current.length === 1` guard | PASS |
| All `clientToCanvas` callers pass padding | Count callers across src/ | 3 callers total (PaintOverlay line 369, TransformOverlay lines 202, 563); all pass `0, 16` | PASS |
| No `findStrokeAtPoint` references | `grep -c findStrokeAtPoint PaintOverlay.tsx` | 0 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PINT-01 | 23-01-PLAN.md, 23-02-PLAN.md, 23-03-PLAN.md | User can duplicate a stroke with Alt+move on the same frame in roto paint edit mode | SATISFIED | `e.altKey` path in `handleSelectPointerDown`; clones pushed to `frameData.elements`; `structuredClone` + new UUID; single undo removes all clones; REQUIREMENTS.md line 20 marked `[x]` |
| PINT-02 | 23-01-PLAN.md, 23-02-PLAN.md, 23-03-PLAN.md | User can apply non-uniform scale to individual paint strokes | SATISFIED | `hitTestHandle` returns single-letter edge handles; `transformCorner.current.length === 1` branches to edge scale; snapshot restore prevents exponential compounding; REQUIREMENTS.md line 21 marked `[x]` |

No orphaned requirements. PINT-01 and PINT-02 are the only phase-23 requirements in REQUIREMENTS.md (lines 70-71 of the tracking table confirm both Complete).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

No stubs, placeholders, empty handlers, TODO markers, or hardcoded-empty returns found in any of the three plan-03-modified files. The 5 pre-existing TypeScript errors in unrelated files (PaintProperties.tsx, SidebarProperties.tsx, glslRuntime.test.ts, paintStore.ts) are unchanged from before this phase began.

### Human Verification Required

#### 1. Alt+drag duplicate gesture

**Test:** In roto paint edit mode, select a brush stroke, hold Alt, click and drag to a new position, release.
**Expected:** Original stroke remains at original position; clone appears at drop position; selection switches to clone. Then Ctrl+Z removes clone entirely, restoring original-only state.
**Why human:** Pointer event interaction and visual canvas result require running the app.

#### 2. Handle hit areas align with visual positions (post padding fix)

**Test:** Select any element. Hover over the visual rotate dot above the selection. Observe cursor. Then hover over a corner square and an edge circle.
**Expected:** Rotate dot shows grab cursor exactly where the dot is drawn. Corner squares and edge circles each trigger resize cursors when the pointer is directly over the rendered shape — not 8px offset.
**Why human:** Asymmetric-padding fix correctness requires runtime pointer observation; cannot verify pixel-accuracy of hit zones from static analysis.

#### 3. Bounding box refreshes after undo/redo without re-clicking

**Test:** Drag-move a selected stroke. Press Ctrl+Z.
**Expected:** The selection rectangle and handles immediately jump to the pre-move position. No need to click elsewhere and re-select.
**Why human:** useEffect reactive re-render triggered by `paintVersion` requires runtime observation to confirm the handles re-draw in the same frame as the undo.

#### 4. Edge scale is linear end-to-end

**Test:** Select a stroke. Drag the right-edge midpoint handle slowly, then quickly.
**Expected:** The element stretches proportionally to pointer movement at all speeds — no acceleration, no oscillation, no runaway growth.
**Why human:** Exponential vs linear behaviour requires interactive drag at varying speeds to distinguish; snapshot-restore fix correctness cannot be inferred from static code alone.

### Gaps Summary

No gaps. All 16 must-have truths verified. Plan-03's four fixes (asymmetric padding, stale bounding box, exponential edge scale, edge handle size) are all present in the actual code and correctly wired. The 5 pre-existing TypeScript errors are unrelated to this phase. PINT-01 and PINT-02 are both satisfied and marked complete in REQUIREMENTS.md. Phase 23 goal is fully achieved.

---

_Verified: 2026-03-27T11:23:23Z_
_Verifier: Claude (gsd-verifier)_
