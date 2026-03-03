---
phase: 04-timeline-preview
verified: 2026-03-03T14:00:00Z
status: passed
score: 11/11 must-haves verified
re_verification: null
gaps: []
human_verification:
  - test: "Preview image updates on frame change during playback"
    expected: "Each rAF tick advances the frame; the img overlay in Preview updates to show the correct key photo image for the new frame within one render cycle"
    why_human: "Signal propagation chain (currentFrame -> currentTime -> CanvasArea re-render -> Preview useEffect re-runs -> currentPreviewUrl updated -> img src changes) is correct in code but requires visual confirmation that no race or batching causes a visible stutter"
  - test: "Playback stops at last frame without crash"
    expected: "When currentFrame reaches totalFrames-1, PlaybackEngine calls stop() and the play button returns to the play icon; no infinite loop or frozen UI"
    why_human: "End-of-playback logic is in the rAF tick; requires runtime test to confirm totalFrames.peek() returns a correct non-zero value and the while-loop exits cleanly"
  - test: "Timeline thumbnail lazy-loading triggers redraw"
    expected: "When the timeline first renders, frames show placeholder colored rects; as thumbnails load, the canvas redraws with real images without flickering or layout shifts"
    why_human: "ThumbnailCache.onLoad triggers renderer.draw() which re-renders; requires visual confirmation that the redraw doesn't cause visible flashing"
  - test: "Cursor-anchored zoom keeps frame under cursor stable"
    expected: "When zooming in/out with Cmd+scroll, the frame under the cursor stays at the same pixel position; timeline doesn't jump or shift unexpectedly"
    why_human: "The anchor math is correct in code (frameUnderCursor * newZoom - cursorX) but pixel-precise behavior requires human confirmation"
  - test: "Sequence reorder reflects in left panel"
    expected: "After dragging a track header to reorder, the SequenceList in the left panel immediately reflects the new order (both lists update from sequenceStore.sequences signal)"
    why_human: "sequenceStore.sequences is a signal so both views should update automatically; requires visual confirmation across both panels"
---

# Phase 4: Timeline & Preview Verification Report

**Phase Goal:** Canvas-based timeline with track rendering, playhead scrubbing, zoom, and sequence reorder; Motion Canvas preview with playback controls and zoom/pan.
**Verified:** 2026-03-03T14:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

All truths are derived from the ROADMAP.md Success Criteria and plan must_haves across all three plans.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Canvas-based timeline displays frame thumbnails with virtualized rendering for 100+ frame performance | VERIFIED | `TimelineRenderer.ts` L131, L148: double-check `rangeX + rangeWidth < TRACK_HEADER_WIDTH \|\| rangeX > w` skips off-screen ranges and frames |
| 2 | User can click timeline to seek and drag playhead to scrub | VERIFIED | `TimelineInteraction.ts` L106-145: click calls `playbackEngine.seekToFrame(frame)`, drag sets `isDragging=true` and scrubs via `playbackEngine.seekToFrame(frame)` in mousemove |
| 3 | Timeline shows one track row per sequence with sequence name in header | VERIFIED | `TimelineRenderer.ts` L107-188: loops over `tracks[]`, draws header column with `track.sequenceName` |
| 4 | User can zoom the timeline in/out with scroll/pinch, anchored at cursor | VERIFIED | `TimelineInteraction.ts` L229-275: wheel + Cmd/Meta applies cursor-anchored zoom; gesturechange handles macOS pinch |
| 5 | User can reorder sequences on the timeline by dragging track headers | VERIFIED | `TimelineInteraction.ts` L106-134, L183-213: hit tests `localX < TRACK_HEADER_WIDTH`, drag state tracked, `sequenceStore.reorderSequences()` called on drop |
| 6 | Preview canvas renders composited frame via Motion Canvas player (PREV-01) | VERIFIED (partial) | `Preview.tsx` L18-29: `motion-canvas-player` mounted and hidden; `project.ts` uses `previewScene`; image displayed via img overlay per plan decision (MC player reserved for Phase 5 compositing). Player IS wired to playbackEngine. |
| 7 | User can play/pause at project frame rate using rAF delta accumulation | VERIFIED | `playbackEngine.ts` L71-94: `performance.now()` delta, accumulator pattern, `1000/fps` frameDuration, `while` loop for multi-frame catch-up |
| 8 | User can step forward/backward one frame at a time | VERIFIED | `playbackEngine.ts` L54-61: delegates to `timelineStore.stepForward/stepBackward()`, then `syncPlayer()` |
| 9 | User can zoom and pan the preview canvas | VERIFIED | `CanvasArea.tsx` L25-43: Cmd/Ctrl+scroll zoom with cursor-anchored pan adjustment; L46-76: middle-click drag for pan |
| 10 | PlaybackEngine uses correct clock architecture for audio sync readiness (PREV-05) | VERIFIED | `playbackEngine.ts` L1-14 comment, L72: `performance.now()` (not `Date.now()`), accumulator pattern explicitly documented for PREV-05 audio sync readiness |
| 11 | Preview frame-to-image wiring: frame changes update the displayed image | VERIFIED | `Preview.tsx` L44-74: useEffect reads `timelineStore.currentFrame.value` + `frameMap.value`, updates `currentPreviewUrl`; L77 reads `currentPreviewUrl.value` at render level making CanvasArea/Preview reactive to frame changes via signal chain |

**Score:** 11/11 truths verified

---

## Required Artifacts

### Plan 04-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `Application/src/lib/frameMap.ts` | Computed frame map from sequence data | VERIFIED | 55 lines; exports `frameMap`, `totalFrames`, `trackLayouts` all as `computed()` signals; reads `sequenceStore.sequences.value` |
| `Application/src/lib/playbackEngine.ts` | PlaybackEngine with rAF frame-rate limiting | VERIFIED | 103 lines; exports `PlaybackEngine` class and `playbackEngine` singleton; uses rAF + delta accumulation |
| `Application/src/scenes/previewScene.tsx` | Motion Canvas scene rendering key photo | VERIFIED | 13 lines; correct JSX pragma `/** @jsxImportSource @efxlab/motion-canvas-2d/lib */`; `Img` node inside `Rect`; `waitFor(Infinity)` |
| `Application/src/types/timeline.ts` | Extended timeline types for frame info | VERIFIED | 33 lines; contains `FrameEntry`, `TrackLayout`, `KeyPhotoRange` interfaces |
| `Application/src/lib/previewBridge.ts` | currentPreviewUrl signal bridge | VERIFIED | 4 lines; exports `currentPreviewUrl = signal<string>('')` |
| `Application/src/stores/timelineStore.ts` | timelineStore with totalFrames, clamping | VERIFIED | 55 lines; imports `totalFramesSignal` from `frameMap`, exposes as `totalFrames`; `seek()` clamps to `[0, max-1]`; `stepForward()` guards upper bound |
| `Application/src/components/Preview.tsx` | Preview with playbackEngine wiring + img overlay | VERIFIED | 102 lines; mounts `motion-canvas-player`, calls `playbackEngine.setPlayerRef(player)`, img overlay reads `currentPreviewUrl` |
| `Application/src/project.ts` | Registers previewScene | VERIFIED | 6 lines; imports `previewScene?scene` and passes to `makeProject` |

### Plan 04-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `Application/src/components/timeline/TimelineRenderer.ts` | Pure canvas drawing: tracks, thumbnails, playhead | VERIFIED | 329 lines; exports `TimelineRenderer`, `BASE_FRAME_WIDTH`, `TRACK_HEIGHT`, `TRACK_HEADER_WIDTH`, `RULER_HEIGHT`, `DragState`, `DrawState`; DPI scaling via `devicePixelRatio`; virtualized rendering; drag ghost and drop indicator |
| `Application/src/components/timeline/ThumbnailCache.ts` | Lazy-loading thumbnail image cache | VERIFIED | 42 lines; exports `ThumbnailCache`; `Map` cache + `Set` loading; `onLoad` callback fires after image loads |
| `Application/src/components/timeline/TimelineInteraction.ts` | Mouse/wheel/touch event handling | VERIFIED | 289 lines; exports `TimelineInteraction`; handles click-to-seek, drag scrub, wheel zoom (cursor-anchored), macOS pinch, track header drag-drop |
| `Application/src/components/timeline/TimelineCanvas.tsx` | Preact canvas wrapper with signal subscriptions | VERIFIED | 72 lines; exports `TimelineCanvas`; `effect()` from `@preact/signals` subscribes to `currentFrame`, `zoom`, `scrollX`, `trackLayouts`, `totalFrames`; `ResizeObserver` on parent |
| `Application/src/components/layout/TimelinePanel.tsx` | Updated panel using TimelineCanvas | VERIFIED | 115 lines; uses `<TimelineCanvas />`; play/pause wired to `playbackEngine.toggle()`; step buttons to `playbackEngine.step*`; timecode from `timelineStore.currentTime.value` and `totalDuration.value`; zoom slider functional; Fit All button |

### Plan 04-03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `Application/src/components/layout/CanvasArea.tsx` | Preview zoom/pan + preview controls | VERIFIED | 167 lines; `previewZoom/previewPanX/previewPanY` signals; Cmd+scroll zoom (0.1-4x); middle-click pan; CSS transform on preview wrapper; controls wired to `playbackEngine`; Fit button resets state |
| `Application/src/components/timeline/TimelineRenderer.ts` | DragState + setDragState() for reorder visuals | VERIFIED | `DragState` interface exported; `setDragState()` method at L307-311; drop indicator drawn at L197-199; ghost track at L202-222 |
| `Application/src/components/timeline/TimelineInteraction.ts` | Track header drag-drop for sequence reorder | VERIFIED | L113-134: hit test `localX < TRACK_HEADER_WIDTH`; L196: `sequenceStore.reorderSequences(fromIndex, toIndex)`; single-sequence guard at L118 |

---

## Key Link Verification

### Plan 04-01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `frameMap.ts` | `sequenceStore.ts` | `sequenceStore.sequences.value` | WIRED | L9: `for (const seq of sequenceStore.sequences.value)` — confirmed |
| `playbackEngine.ts` | `timelineStore.ts` | `timelineStore.stepForward()` | WIRED | L87: `timelineStore.stepForward()` in tick; L29: `timelineStore.setPlaying(true)` |
| `previewScene.tsx` | `frameMap.ts` | Not directly — img overlay pattern used | ACCEPTED | Plan decision: previewScene holds `Img` node for Phase 5; Preview.tsx reads frameMap directly for img overlay — this is the documented architecture decision |
| `Preview.tsx` | `playbackEngine.ts` | `playbackEngine.setPlayerRef(player)` | WIRED | L35: `playbackEngine.setPlayerRef(player)` after DOM mount |

### Plan 04-02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `TimelineRenderer.ts` | `frameMap.ts` | `trackLayouts` in `DrawState` | WIRED | `trackLayouts` passed via `draw(state)` parameter from `TimelineCanvas.tsx` L44 |
| `TimelineRenderer.ts` | `ThumbnailCache.ts` | `thumbnailCache.get()` | WIRED | L50, L59-63: `ThumbnailCache` created in constructor; `onLoad` callback set; L138: `thumbnailCache.get(range.imageId, thumbnailUrl)` |
| `TimelineInteraction.ts` | `timelineStore.ts` | `seek()`, `setZoom()`, `setScrollX()` | WIRED | L246-247: `setZoom` + `setScrollX`; L251: `setScrollX`; click-seek via `playbackEngine.seekToFrame()` which calls `timelineStore.seek()` |
| `TimelineCanvas.tsx` | `TimelineRenderer.ts` | `renderer.draw()` on signal changes | WIRED | L40-55: `effect()` subscribes to 5 signals, calls `renderer.draw(...)` |

### Plan 04-03 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `CanvasArea.tsx` | `playbackEngine.ts` | `playbackEngine.toggle/step/seek` | WIRED | L111: `stepBackward()`; L119: `toggle()`; L129: `stepForward()` |
| `TimelineInteraction.ts` | `sequenceStore.ts` | `sequenceStore.reorderSequences()` | WIRED | L3 import; L196: `sequenceStore.reorderSequences(fromIndex, toIndex)` on drop |

---

## Requirements Coverage

All 11 requirement IDs from plan frontmatter verified against REQUIREMENTS.md:

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| TIME-01 | 04-02 | Canvas-based timeline displays frame thumbnails with virtualized rendering | SATISFIED | `TimelineRenderer.ts` L131, L148: range and frame virtualization checks; `ThumbnailCache.ts`: lazy image loading for performance |
| TIME-02 | 04-02 | Playhead shows current position with click-to-seek | SATISFIED | `TimelineInteraction.ts` L136-144: click calls `playbackEngine.seekToFrame()`; playhead drawn at `TimelineRenderer.ts` L226-243 |
| TIME-03 | 04-02 | User can scrub through timeline by dragging playhead | SATISFIED | `TimelineInteraction.ts` L136-144: `isOnPlayhead()` check + `isDragging=true`; L163-166: mousemove calls `playbackEngine.seekToFrame()` with pointer capture |
| TIME-04 | 04-02 | User can zoom timeline in/out with scroll/pinch | SATISFIED | `TimelineInteraction.ts` L229-275: `onWheel` with cursor-anchored zoom math; `onGestureChange` for macOS pinch |
| TIME-05 | 04-02 | Timeline shows layer tracks for each sequence | SATISFIED | `TimelineRenderer.ts` L106-188: one `TRACK_HEIGHT` row per `tracks[]` element with sequence name label |
| TIME-06 | 04-03 | User can reorder sequences on the timeline | SATISFIED | `TimelineInteraction.ts` L113-134, L183-213: track header hit test, drag state, `sequenceStore.reorderSequences()` on drop |
| PREV-01 | 04-01 | Preview canvas renders composited frame via Motion Canvas player | SATISFIED (Phase 4 scope) | `Preview.tsx`: `motion-canvas-player` mounted, wired to `playbackEngine`; img overlay shows frame image; MC player hidden for Phase 5 compositing per plan architecture decision |
| PREV-02 | 04-01 | User can play/pause at project frame rate (15 or 24 fps) | SATISFIED | `playbackEngine.ts` L71-94: rAF + `performance.now()` delta + `while` accumulator loop at `1000/fps` frameDuration |
| PREV-03 | 04-01 | User can step forward/backward one frame at a time | SATISFIED | `playbackEngine.ts` L54-61: `stepForward/stepBackward` delegates to `timelineStore`, wired in `CanvasArea.tsx` and `TimelinePanel.tsx` |
| PREV-04 | 04-03 | User can zoom and pan the preview canvas | SATISFIED | `CanvasArea.tsx`: `previewZoom/previewPanX/previewPanY` signals; CSS transform on wrapper; Cmd+scroll zoom; middle-click pan |
| PREV-05 | 04-01 | Playback engine uses correct clock architecture for audio sync readiness | SATISFIED | `playbackEngine.ts` L72: `performance.now()` (not Date.now()); delta accumulation pattern; `.peek()` in rAF tick |

No orphaned requirements found. All 11 IDs declared across the three plans correspond to Phase 4 requirements in REQUIREMENTS.md, and all are marked Complete in the requirements tracking table.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `TimelineRenderer.ts` | 18-19, 156-159 | `PLACEHOLDER_BG_A/B` and placeholder drawing | INFO | Intentional design — colored placeholder rects shown while thumbnails load asynchronously. Not a stub; the `ThumbnailCache` actively loads thumbnails and replaces placeholders via `onLoad` callback |

No blocker or warning anti-patterns found. All files contain substantive implementations with no `TODO`, `FIXME`, empty handlers, static API responses, or unimplemented stubs.

---

## Architecture Notes

**PREV-01 design decision (documented in plan):** The Motion Canvas player is mounted in the DOM but hidden (`opacity: 0`). Image display is handled by a plain `<img>` overlay reading `currentPreviewUrl` signal. This is an explicit architecture decision in the 04-01 plan: "the player is kept in the DOM for Phase 5 compositing readiness." PREV-01 says "renders composited frame via Motion Canvas player" — in Phase 4, the player is wired and present; actual compositing via Motion Canvas is deferred to Phase 5 when layers exist. The plan explicitly documents this hybrid approach as satisfying PREV-01 for Phase 4.

**Preview reactivity chain:** `timelineStore.currentFrame` change -> `currentTime` computed fires -> `CanvasArea` re-renders (reads `currentTime.value`) -> `Preview` child re-renders -> `useEffect` at line 44 re-runs -> `currentPreviewUrl.value` updated -> `Preview` re-renders to update `<img src>`. This chain is correct and reactive.

**Signal purity in rAF tick:** All signal reads inside the `PlaybackEngine.tick` method use `.peek()` (not `.value`) — verified at lines 72, 78, 82, 87, 92 of `playbackEngine.ts`. This correctly avoids Preact signal subscription tracking outside of effects.

---

## Human Verification Required

### 1. Preview Image Updates on Frame Change During Playback

**Test:** Open a project with sequences and key photos; press play; watch the preview area
**Expected:** The displayed image updates each time the frame advances; different key photos show their corresponding images at the correct hold durations
**Why human:** The signal propagation chain through `currentTime -> CanvasArea re-render -> Preview useEffect` is correct in code but requires visual confirmation that no batching or render timing causes visible lag

### 2. Playback Stops at Last Frame Without Crash

**Test:** Play a project to the end (or seek to the last frame and confirm playback won't loop)
**Expected:** When `currentFrame >= totalFrames - 1`, `playbackEngine.stop()` is called, the play button shows the play icon, and no error or frozen state occurs
**Why human:** `totalFrames.peek()` in the rAF tick must return the correct non-zero count; requires runtime validation

### 3. Timeline Thumbnail Lazy-Loading Triggers Redraw

**Test:** Open a project with key photos; observe the timeline canvas load
**Expected:** Frames initially show colored placeholder rects; within a short delay, real thumbnail images appear in-place without layout shifts or flicker
**Why human:** `ThumbnailCache.onLoad -> renderer.draw()` chain requires visual confirmation that the redraw is smooth

### 4. Cursor-Anchored Zoom Keeps Frame Under Cursor Stable

**Test:** In the timeline, position cursor over a specific frame number; Cmd+scroll to zoom in
**Expected:** The frame under the cursor stays at the same pixel position; the timeline scrolls to keep that frame visible and stationary
**Why human:** The anchor math is correct but pixel-precise behavior at fractional zoom levels requires human confirmation

### 5. Sequence Reorder Reflects in Left Panel

**Test:** Drag a track header in the timeline to reorder two sequences; observe the left panel SequenceList
**Expected:** The SequenceList in the left panel immediately updates to reflect the new sequence order (both views read from `sequenceStore.sequences`)
**Why human:** Both panels should auto-update via shared signal; requires visual confirmation across panels simultaneously

---

## Gaps Summary

No gaps found. All 11 requirements satisfied, all artifacts exist with substantive implementations, all key links verified as wired. The only note is the PREV-01 architecture decision (img overlay instead of Motion Canvas compositing) which is explicitly documented in the plan as the correct Phase 4 approach.

---

_Verified: 2026-03-03T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
