---
phase: 04-timeline-preview
verified: 2026-03-09T18:45:00Z
status: human_needed
score: 6/6 gap-closure must-haves verified
re_verification:
  previous_status: passed
  previous_score: 11/11
  uat_result: 5/10 passed, 5 issues
  gaps_closed:
    - "Preview image visually changes when stepping forward/backward through frames"
    - "Preview image updates in real-time during playback at project fps"
    - "Click-to-seek on timeline updates preview to show the correct frame image"
    - "User can click and drag the playhead to scrub through frames in real-time"
    - "User can middle-click and drag on the preview to pan"
    - "Pointer capture works correctly for both playhead drag and preview pan"
  gaps_remaining: []
  regressions: []
gaps: []
human_verification:
  - test: "Preview image changes when stepping through frames (UAT Test 3 re-test)"
    expected: "Click step forward/backward. Each step shows a different key photo image in the preview canvas. Not stuck on one image."
    why_human: "Cache-busting fix is structurally correct (unique URLs per imageId), but requires visual confirmation that WebKit actually fetches fresh image data."
  - test: "Playback shows different images at project fps (UAT Test 2 re-test)"
    expected: "Click play. The preview animates through key photo images at the project frame rate. Different key photos display their corresponding images."
    why_human: "rAF tick + cache-busted image loading must produce visual frame changes; requires runtime visual verification."
  - test: "Click-to-seek updates preview to correct image (UAT Test 5 re-test)"
    expected: "Click different positions on the timeline. The playhead jumps and the preview shows the correct image for that frame position."
    why_human: "Seek correctly updates currentFrame signal, but visual result depends on cache-busted image loading working end-to-end."
  - test: "Playhead drag scrubbing works (UAT Test 6 re-test)"
    expected: "Click near the playhead vertical line and drag. The playhead follows the cursor and the preview updates in real-time as you scrub."
    why_human: "PointerEvent fix is structurally correct, but playhead hit area and pointer capture behavior require interactive testing."
  - test: "Middle-click pan works on preview (UAT Test 8 re-test)"
    expected: "Middle-click and drag on the preview area. The preview pans following the cursor. Release stops panning."
    why_human: "PointerEvent fix is structurally correct, but middle-click pan with pointer capture requires interactive testing in WebKit WebView."
---

# Phase 4: Timeline & Preview - Gap Closure Verification Report

**Phase Goal:** Canvas-based timeline with track rendering, playhead scrubbing, zoom, and sequence reorder; Motion Canvas preview with playback controls and zoom/pan.
**Verified:** 2026-03-09T18:45:00Z
**Status:** human_needed
**Re-verification:** Yes -- after gap closure (plans 04-04 and 04-05)

## Context

The initial verification (2026-03-03) passed 11/11 truths. UAT testing (2026-03-09) then revealed 5 issues:
- **Tests 2, 3, 5:** Preview image not updating when frame changes (caching issue)
- **Test 6:** Playhead drag scrubbing broken (pointer events)
- **Test 8:** Middle-click pan broken (pointer events)

Plans 04-04 and 04-05 were created to close these gaps. This verification confirms the fixes exist in the codebase.

---

## Goal Achievement

### Gap Closure Truths (Plans 04-04 and 04-05)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Preview image visually changes when stepping through frames | VERIFIED (code) | `previewRenderer.ts` L202: `assetUrl(image.project_path, imageId)` passes imageId as cache-buster; `ipc.ts` L22-27: `assetUrl()` appends `?v={bustKey}` making each imageId a unique URL; `lib.rs` L40-41: Cache-Control headers prevent WebKit caching |
| 2 | Preview image updates in real-time during playback at project fps | VERIFIED (code) | Same cache-busting mechanism; `Preview.tsx` L55-64: rAF tick calls `renderCurrent()` on frame change; `playbackEngine.ts` L73-107: delta accumulation advances frames correctly |
| 3 | Click-to-seek on timeline updates preview to correct frame image | VERIFIED (code) | Same cache-busting mechanism; `TimelineInteraction.ts` L142-143: click calls `playbackEngine.seekToFrame(frame)`; signal chain triggers `Preview.tsx` render effect |
| 4 | User can click and drag the playhead to scrub in real-time | VERIFIED (code) | `TimelineInteraction.ts` L29-31: `handlePointerDown/Move/Up` bound; L40-42: `pointerdown/pointermove/pointerup` event listeners; L139: `setPointerCapture(e.pointerId)` with real pointerId; L83: hit area widened to 10px |
| 5 | User can middle-click and drag on the preview to pan | VERIFIED (code) | `CanvasArea.tsx` L47-77: `handlePointerDown/Move/Up` with `PointerEvent` type; L57: `setPointerCapture(e.pointerId)` with real pointerId; L92-94: JSX uses `onPointerDown/Move/Up` |
| 6 | Pointer capture works correctly for both interactions | VERIFIED (code) | All `setPointerCapture`/`releasePointerCapture` calls use `e.pointerId` directly; no unsafe casts `(e as unknown as PointerEvent).pointerId ?? 0` remain; try/catch safety nets on release |

**Score:** 6/6 gap-closure truths verified in code

### Previously Verified Truths (Quick Regression Check)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Canvas-based timeline displays frame thumbnails with virtualized rendering | OK | `TimelineRenderer.ts` unchanged; still performs range/frame virtualization |
| 2 | Timeline shows one track row per sequence with name in header | OK | `TimelineRenderer.ts` unchanged |
| 3 | User can zoom timeline in/out with scroll/pinch, anchored at cursor | OK | `TimelineInteraction.ts` onWheel/onGestureChange unchanged |
| 4 | User can reorder sequences by dragging track headers | OK | `TimelineInteraction.ts` track drag logic intact with pointer events; `sequenceStore.reorderSequences()` still called at L196 |
| 5 | PlaybackEngine uses correct clock architecture | OK | `playbackEngine.ts` unchanged; performance.now() delta accumulation intact |

No regressions detected. All non-gap truths from initial verification remain intact.

---

## Required Artifacts (Plan 04-04)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `Application/src-tauri/src/lib.rs` | Cache-Control: no-cache, no-store header on efxasset response | VERIFIED | L40: `.header("Cache-Control", "no-cache, no-store, must-revalidate")`, L41: `.header("Pragma", "no-cache")` |
| `Application/src/lib/ipc.ts` | assetUrl accepts optional bustKey param | VERIFIED | L22: `assetUrl(filePath: string, bustKey?: string)`, L26: appends `?v=${bustKey}` |
| `Application/src/lib/previewRenderer.ts` | getImageSource passes imageId as cache-buster | VERIFIED | L202: `img.src = assetUrl(image.project_path, imageId)` |
| `Application/src/components/Preview.tsx` | Clean render effect without debug logging | VERIFIED | No `console.log` in file; render effect at L41-49 directly calls `renderer.renderFrame()` |

## Required Artifacts (Plan 04-05)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `Application/src/components/timeline/TimelineInteraction.ts` | Pointer event handlers (not mouse events) | VERIFIED | L29-31: `handlePointerDown/Move/Up`; L40-42: `pointerdown/pointermove/pointerup` listeners; L106: `onPointerDown(e: PointerEvent)`; L148: `onPointerMove(e: PointerEvent)`; L183: `onPointerUp(e: PointerEvent)` |
| `Application/src/components/timeline/TimelineInteraction.ts` | Playhead hit area widened to 10px | VERIFIED | L83: `Math.abs(clientX - playheadX) <= 10` |
| `Application/src/components/layout/CanvasArea.tsx` | Pointer event handlers for middle-click pan | VERIFIED | L47: `handlePointerDown(e: PointerEvent)`; L60: `handlePointerMove(e: PointerEvent)`; L68: `handlePointerUp(e: PointerEvent)`; L92-94: JSX `onPointerDown/Move/Up` |

---

## Key Link Verification

### Plan 04-04 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `previewRenderer.ts` | `lib.rs` (efxasset) | efxasset:// URL with cache-buster query param | WIRED | L202: `assetUrl(image.project_path, imageId)` produces `efxasset://localhost/path?v={imageId}` which hits the Rust handler at `lib.rs` L16-51 |
| `Preview.tsx` | `previewRenderer.ts` | renderer.renderFrame() on frame signal change | WIRED | L41-48: effect subscribes to `currentFrame.value`, `layers.value`, `activeSequenceFrames.value` and calls `renderer.renderFrame()`; L55-64: rAF tick also calls `renderCurrent()` during playback |

### Plan 04-05 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `TimelineInteraction.ts` | `playbackEngine.seekToFrame()` | onPointerDown -> isDragging -> onPointerMove -> seekToFrame | WIRED | L136-138: `isOnPlayhead()` sets `isDragging=true` + `setPointerCapture(e.pointerId)`; L163-165: `onPointerMove` checks `isDragging` and calls `playbackEngine.seekToFrame(frame)` |
| `CanvasArea.tsx` | `previewPanX/previewPanY signals` | onPointerDown -> drag state -> onPointerMove -> signal update | WIRED | L47-57: `handlePointerDown` sets `drag.isDragging=true` + captures pointer; L60-65: `handlePointerMove` updates `previewPanX.value` and `previewPanY.value` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PREV-01 | 04-04 | Preview renders composited frame | SATISFIED | Cache-busting ensures different frames show different images; renderFrame() composites all visible layers |
| PREV-02 | 04-04 | Play/pause at project fps | SATISFIED | PlaybackEngine rAF tick with cache-busted image loading |
| PREV-03 | 04-04 | Step forward/backward one frame | SATISFIED | Step buttons trigger frame change; cache-buster ensures new image loads |
| TIME-02 | 04-05 | Click-to-seek with playhead | SATISFIED | PointerEvent fix ensures click-to-seek and drag both work |
| TIME-03 | 04-05 | Playhead drag scrubbing | SATISFIED | pointerdown/pointermove/pointerup with real e.pointerId; 10px hit area |
| PREV-04 | 04-05 | Preview zoom and pan | SATISFIED | Pointer events fix middle-click pan; Cmd+scroll zoom unchanged and working |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | No TODO, FIXME, PLACEHOLDER, console.log, empty handlers, or stub implementations found in any modified file |

---

## Commit Verification

All 4 gap-closure commits verified in git history:

| Commit | Plan | Description | Verified |
|--------|------|-------------|----------|
| `f23a1c5` | 04-04 | Add Cache-Control headers and cache-buster to efxasset protocol | Yes |
| `145cedf` | 04-04 | Use cache-buster in preview renderer and remove debug logging | Yes |
| `340a762` | 04-05 | Switch TimelineInteraction from mouse to pointer events | Yes |
| `b6a5083` | 04-05 | Switch CanvasArea middle-click pan from mouse to pointer events | Yes |

---

## Eliminated Anti-Patterns

The following broken patterns from the UAT diagnosis have been fully removed:

1. **`(e as unknown as PointerEvent).pointerId ?? 0`** -- Eliminated from both `TimelineInteraction.ts` and `CanvasArea.tsx`. All `setPointerCapture` calls now use `e.pointerId` from native `PointerEvent`.

2. **`mousedown/mousemove/mouseup` event listeners** -- Eliminated from `TimelineInteraction.ts`. Replaced with `pointerdown/pointermove/pointerup`.

3. **`onMouseDown/onMouseMove/onMouseUp` JSX props** -- Eliminated from `CanvasArea.tsx`. Replaced with `onPointerDown/onPointerMove/onPointerUp`.

4. **`console.log` debug logging in Preview.tsx** -- Eliminated. Render effect is clean.

5. **Missing Cache-Control on efxasset protocol** -- Fixed. Response includes `Cache-Control: no-cache, no-store, must-revalidate` and `Pragma: no-cache`.

---

## Human Verification Required

All automated code-level checks pass. The fixes are structurally correct. However, the original UAT failures were visual/interactive issues that can only be confirmed by running the application.

### 1. Preview Image Changes When Stepping (UAT Test 3 Re-test)

**Test:** Open a project with multiple key photos across sequences. Click step forward/backward buttons.
**Expected:** Each step shows a visually different key photo image in the preview canvas. Not stuck on one image.
**Why human:** Cache-busting fix ensures unique URLs per imageId, but WebKit WebView behavior with custom protocols must be confirmed visually.

### 2. Playback Shows Different Images (UAT Test 2 Re-test)

**Test:** Click play and watch the preview.
**Expected:** The preview animates through key photo images at the project frame rate. Different key photos display their corresponding images.
**Why human:** rAF tick + cache-busted image loading must produce visual frame changes at runtime.

### 3. Click-to-Seek Updates Preview (UAT Test 5 Re-test)

**Test:** Click different positions on the timeline ruler/track area.
**Expected:** The playhead jumps to the clicked position AND the preview shows the correct image for that frame.
**Why human:** End-to-end signal chain from seek to preview render must work at runtime.

### 4. Playhead Drag Scrubbing Works (UAT Test 6 Re-test)

**Test:** Click near the playhead vertical line on the timeline and drag left/right.
**Expected:** The playhead follows the cursor smoothly. The preview updates in real-time showing different frames as you scrub. Dragging outside the canvas boundary still tracks (pointer capture).
**Why human:** PointerEvent fix with 10px hit area and pointer capture must work in the Tauri WebKit WebView runtime.

### 5. Middle-Click Pan Works (UAT Test 8 Re-test)

**Test:** Middle-click and drag on the preview area.
**Expected:** The preview image pans following the cursor direction. Release stops panning. The pan direction does NOT interfere with timeline seek.
**Why human:** Middle-click with pointer capture in WebKit WebView requires interactive confirmation.

---

## Gaps Summary

No code-level gaps found. All 6 gap-closure must-haves are verified in the codebase:

- **Plan 04-04 (Preview Cache Fix):** Cache-Control headers added to Rust efxasset handler. Cache-buster URL parameter implemented in ipc.ts and used in previewRenderer.ts. Debug logging cleaned from Preview.tsx. All 3 artifacts verified.

- **Plan 04-05 (Pointer Events Fix):** All mouse events converted to pointer events in both TimelineInteraction.ts and CanvasArea.tsx. Unsafe `pointerId ?? 0` casts eliminated. Playhead hit area widened from 5px to 10px. All 2 artifacts verified.

The fixes address the exact root causes diagnosed in the UAT:
- WebKit URL-level caching broken by both headers and query param
- DOMException: InvalidPointerId from setPointerCapture(0) fixed by using real PointerEvent.pointerId

Awaiting human re-test of UAT Tests 2, 3, 5, 6, and 8 to confirm visual/interactive behavior.

---

_Verified: 2026-03-09T18:45:00Z_
_Verifier: Claude (gsd-verifier)_
