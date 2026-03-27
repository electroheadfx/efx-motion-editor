---
phase: 23-stroke-interactions
verified: 2026-03-27T11:15:00Z
status: passed
score: 12/12 must-haves verified
gaps: []
human_verification:
  - test: "Alt+drag duplicate: drag selected stroke with Alt held, release, then Ctrl+Z"
    expected: "Clone appears at drop position; Ctrl+Z removes clone entirely, restoring original-only state"
    why_human: "Pointer interaction and visual result cannot be tested without running the app"
  - test: "Edge handle scale: drag right-edge midpoint handle horizontally while a stroke is selected"
    expected: "Elements stretch on X axis; left edge stays fixed; brush size does not change"
    why_human: "Interactive drag gesture cannot be verified programmatically"
  - test: "8 visible handles on selection: 4 corner squares + 4 edge circles + 1 rotate dot"
    expected: "All 9 handles render at correct bounding-box positions without overlap"
    why_human: "Canvas rendering requires visual inspection"
  - test: "Ctrl+Z after rotating then after scaling: each restores pre-gesture state exactly"
    expected: "Undo history stacks correctly; no double-entries per gesture"
    why_human: "Runtime undo stack behaviour cannot be verified by static analysis"
---

# Phase 23: Stroke Interactions Verification Report

**Phase Goal:** Users can duplicate and non-uniformly scale individual paint strokes, expanding the roto paint editing toolkit
**Verified:** 2026-03-27T11:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can Alt+drag a selected stroke to create a duplicate at new position | VERIFIED | `e.altKey` branch at line 737; `structuredClone` + `crypto.randomUUID()` at lines 746-748; `isDragging.current = true` at line 770 |
| 2 | Alt+drag works on all element types: strokes, shapes, and fills | VERIFIED | Clone loop at lines 744-750 iterates `frameData.elements` — all PaintElement union types included |
| 3 | Multi-selection Alt+drag clones all selected elements | VERIFIED | Loop condition `if (!selected.has(el.id)) continue` clones every selected element; `paintStore.selectedStrokeIds.value = new Set(cloneIds)` switches to all clones |
| 4 | One Ctrl+Z after Alt+drag removes all clones | VERIFIED | `isDuplicating.current` branch in `handlePointerUp` pushes single `pushAction`; undo closure at line 1337 uses `f.elements.filter(el => !cloneIdSet.has(el.id))` |
| 5 | Edge midpoint handles (t/r/b/l) visible for non-uniform scale | VERIFIED | `EDGE_HANDLE_RADIUS = 3` at line 573; circular handles rendered via `ctx.arc` at line 586; 4 midpoints defined at lines 574-579 |
| 6 | Edge handles scale from opposite edge | VERIFIED | `edgeAnchorX/Y` captured once on pointerdown at lines 704-715; scale formula `anchor + (coord - anchor) * scale` at lines 1056, 1064, 1086, 1093 |
| 7 | Brush size stays fixed during non-uniform scale | VERIFIED | Comment `// D-06: brush size stays fixed` at lines 1061, 1090; `stroke.size` is NOT modified in edge-scale block (confirmed by absence of `stroke.size *=`) |
| 8 | Non-uniform scale supports undo/redo with single entry | VERIFIED | `isTransforming.current` block in `handlePointerUp` at line 1252 captures `beforeSnap`/`afterSnap` and calls `pushAction` once |
| 9 | All transform gestures (drag, uniform scale, rotate) support undo/redo | VERIFIED | `transformSnapshot.current = captureElementSnapshot(...)` on rotate (line 681), scale (line 697), drag (line 781/765); `pushAction` in finalize blocks lines 1262 and 1366 |
| 10 | Ctrl+Z after dragging restores pre-drag position | VERIFIED | Snapshot captured pre-drag at line 781; normal drag `pushAction` at line 1366 with `restoreElementSnapshot` in undo closure |
| 11 | Selection, hit-testing, bounding boxes, and transforms work on PaintShape and PaintFill | VERIFIED | `findElementAtPoint` handles `line/rect/ellipse` at line 83 and `fill` at line 93; `getSelectionBounds` handles all types at lines 126-144; all transform loops branch on element type |
| 12 | `findStrokeAtPoint` fully renamed to `findElementAtPoint` | VERIFIED | `grep -c findStrokeAtPoint` returns 0; `findElementAtPoint` defined at line 54, called at lines 731, 834, 970 |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `Application/src/components/canvas/PaintOverlay.tsx` | Transform undo infrastructure + generalized element handling + Alt+duplicate + non-uniform edge scale | VERIFIED | 1709 lines; all required patterns present; TypeScript compiles with 0 errors in this file |

### Key Link Verification

**Plan 01 key links:**

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `handleSelectPointerDown` rotate block | `captureElementSnapshot` | `transformSnapshot.current = captureElementSnapshot(...)` | WIRED | Line 681 — snapshot captured after rotate handle detection |
| `handleSelectPointerDown` scale block | `captureElementSnapshot` | `transformSnapshot.current = captureElementSnapshot(...)` | WIRED | Line 697 — snapshot captured after corner/edge handle detection |
| `handlePointerUp` transform finalize | `pushAction` | single undo entry on gesture end | WIRED | Line 1262 — `pushAction({description: 'Transform elements',...})` |
| `handlePointerUp` drag finalize | `pushAction` | single undo entry on gesture end | WIRED | Line 1366 — second `pushAction` for drag path |
| `findElementAtPoint` | PaintElement union | handles brush, shape, fill types | WIRED | Lines 62, 83, 93 — three element type branches in function body |

**Plan 02 key links:**

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `handleSelectPointerDown` altKey check | `structuredClone + push to elements` | clone selected elements and switch selection to clones | WIRED | Lines 737-776 — `e.altKey` triggers clone loop, `frameData.elements.push(clone)`, `selectedStrokeIds.value = new Set(cloneIds)` |
| `hitTestHandle` edge midpoints | `handlePointerMove` edge-scale | `transformCorner.current.length === 1` distinguishes | WIRED | `hitTestHandle` returns `'t'/'r'/'b'/'l'` at lines 178-186; `transformCorner.current.length === 1` at line 1034 branches to edge scale |
| `handlePointerUp` | `pushAction` for duplicate | commit undo for Alt+drag | WIRED | Lines 1330 — `pushAction({description: 'Duplicate N element(s)',...})` |

### Data-Flow Trace (Level 4)

Not applicable — PaintOverlay.tsx is an event-driven canvas renderer, not a data-fetching component. All data mutations happen in-place on `PaintFrame.elements` via the store references; no async data source.

### Behavioral Spot-Checks

Step 7b: TypeScript compilation is the primary verifiable behavioral check for canvas/gesture code.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| PaintOverlay.tsx compiles without errors | `npx tsc --noEmit \| grep PaintOverlay` | 0 output (no errors) | PASS |
| No `findStrokeAtPoint` references remain | `grep -c findStrokeAtPoint PaintOverlay.tsx` | 0 | PASS |
| `el.tool !== 'brush'` count is 4 or fewer (only FX) | `grep -c "el.tool !== 'brush'"` | 4 (lines 639, 1516, 1538, 1575 — all FX/style-sync) | PASS |
| All 4 phase commits exist in git log | `git show --stat eb3d30d 4a634e4 4660445 7701992` | All 4 commits verified | PASS |
| `pushAction` imported and called | `grep -n "pushAction"` | Import at line 13; calls at lines 1262, 1330, 1366 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PINT-01 | 23-01-PLAN.md, 23-02-PLAN.md | User can duplicate a stroke with Alt+move on the same frame in roto paint edit mode | SATISFIED | `e.altKey` path in `handleSelectPointerDown`; clones pushed to `frameData.elements`; `structuredClone` + new UUID for each selected element; single undo removes all clones |
| PINT-02 | 23-01-PLAN.md, 23-02-PLAN.md | User can apply non-uniform scale to individual paint strokes | SATISFIED | `hitTestHandle` returns single-letter edge handles; `transformCorner.current.length === 1` triggers edge scale path; only axis coordinates modified (brush size untouched) |

No orphaned requirements — both PINT-01 and PINT-02 are fully claimed and implemented.

**REQUIREMENTS.md status:** Both requirements marked `[x]` complete (lines 20-21).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

No stubs, placeholders, empty handlers, or TODO markers found in PaintOverlay.tsx. The 4 remaining `el.tool !== 'brush'` guards (lines 639, 1516, 1538, 1575) are all legitimate — they are in `syncStyleToSelection` (brush-style sync only makes sense for brush strokes) and in three FX application `useEffect` loops (FX rendering is brush-only by design).

### Human Verification Required

#### 1. Alt+drag duplicate gesture

**Test:** In roto paint edit mode, select a brush stroke, hold Alt, click and drag to a new position, release.
**Expected:** Original stroke remains at original position; clone appears at drop position; selection switches to clone; Ctrl+Z removes clone entirely.
**Why human:** Pointer event interaction and visual canvas result require running the app.

#### 2. Edge handle non-uniform scale

**Test:** Select a stroke, drag the right-edge midpoint circle handle (hollow circle at bounding box right center) horizontally.
**Expected:** Elements stretch on X axis only; left edge stays fixed; brush stroke point positions update but stroke size (visual thickness) does not change.
**Why human:** Interactive gesture with canvas rendering cannot be verified statically.

#### 3. 9-handle selection rendering

**Test:** Select any element in paint select mode.
**Expected:** 4 corner squares + 4 edge midpoint circles + 1 rotate dot above top center = 9 visible handles.
**Why human:** Canvas rendering requires visual inspection.

#### 4. Undo stack correctness

**Test:** Drag-move a stroke (1 undo entry), then rotate it (1 more), then Ctrl+Z twice.
**Expected:** Two distinct undo entries; each Ctrl+Z restores exactly one gesture; no extra entries.
**Why human:** Runtime undo stack order and coalescing behavior requires app execution.

### Gaps Summary

No gaps found. All 12 must-have truths verified against the actual code in `PaintOverlay.tsx`. All key links are wired. Both PINT-01 and PINT-02 requirements are satisfied. TypeScript compiles cleanly for PaintOverlay.tsx (5 pre-existing errors in unrelated files — PaintProperties.tsx, SidebarProperties.tsx, glslRuntime.test.ts, paintStore.ts — are unchanged from before this phase). All 4 phase commits are real and in git history.

---

_Verified: 2026-03-27T11:15:00Z_
_Verifier: Claude (gsd-verifier)_
