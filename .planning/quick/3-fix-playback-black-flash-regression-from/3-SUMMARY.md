# Quick Task 3: Fix playback black flash regression

**Date:** 2026-03-10
**Commit:** 230b0a2

## Root Cause

Quick-2 removed `syncActiveSequence()` from the playback tick loop to prevent sidebar re-renders. But the preview renderer (`Preview.tsx`) depended on `activeSequenceId`-derived signals (`activeSequenceFrames`, `activeSequenceStartFrame`, `layerStore.layers`) for its rendering data. With `activeSequenceId` frozen during playback, the renderer used stale frame data when crossing sequence boundaries → wrong images, black frames.

## Fix

**Two-path rendering architecture:**

1. **rAF tick (playback):** New `renderFromFrameMap()` function derives all rendering data directly from `frameMap[globalFrame]` — sequence, layers, local frame offset, fps. Completely independent of `activeSequenceId`.

2. **Signal effect (scrub/seek/step):** Switched from `currentFrame.value` to `displayFrame.value`. Since `displayFrame` only updates on stop/seek/step, the effect does NOT fire during playback (eliminating redundant renders). Uses `activeSequenceId`-based signals which are correct because `syncActiveSequence()` runs on stop/seek/step.

**Result:** Preview renders correctly during playback across sequence boundaries. Sidebar stays frozen during playback. No redundant effect-based renders during playback.

## Files Changed

- `Application/src/components/Preview.tsx` — renderFromFrameMap() + displayFrame effect
- `Application/src/lib/playbackEngine.ts` — syncActiveSequence in stop() only (from quick-2 follow-up)
