---
phase: quick
plan: 2
type: execute
wave: 1
depends_on: []
files_modified:
  - Application/src/stores/timelineStore.ts
  - Application/src/lib/playbackEngine.ts
  - Application/src/components/layout/TimelinePanel.tsx
  - Application/src/components/layout/CanvasArea.tsx
  - Application/src/components/layout/PropertiesPanel.tsx
  - Application/src/components/layer/LayerList.tsx
  - Application/src/components/timeline/TimelineCanvas.tsx
  - Application/src/components/Preview.tsx
autonomous: true
requirements: [QUICK-02]

must_haves:
  truths:
    - "During playback, only the preview canvas and timeline playhead update per-frame"
    - "PropertiesPanel, LayerList, timecode displays do NOT re-render during playback"
    - "When playback stops, all UI panels immediately update to the current frame"
    - "Scrubbing (drag-seek on timeline) updates all UI panels in real-time as before"
  artifacts:
    - path: "Application/src/stores/timelineStore.ts"
      provides: "displayFrame signal that freezes during playback"
      contains: "displayFrame"
    - path: "Application/src/lib/playbackEngine.ts"
      provides: "Syncs displayFrame on stop"
  key_links:
    - from: "Application/src/components/layout/TimelinePanel.tsx"
      to: "timelineStore.displayFrame"
      via: "computed displayTime"
      pattern: "displayTime"
    - from: "Application/src/components/layout/CanvasArea.tsx"
      to: "timelineStore.displayFrame"
      via: "computed displayTime"
      pattern: "displayTime"
---

<objective>
Freeze UI panel updates during animation playback so only the preview canvas and timeline playhead animate per-frame.

Purpose: During playback, per-frame DOM updates to PropertiesPanel, LayerList, and timecode displays cause unnecessary re-renders that waste CPU and can cause visual jank. Only the preview canvas (renders frames) and timeline canvas (draws playhead) need per-frame updates.

Output: Modified timelineStore with a `displayFrame` signal, UI components switched to use it.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@Application/src/stores/timelineStore.ts
@Application/src/lib/playbackEngine.ts
@Application/src/components/layout/TimelinePanel.tsx
@Application/src/components/layout/CanvasArea.tsx
@Application/src/components/layout/PropertiesPanel.tsx
@Application/src/components/layer/LayerList.tsx
@Application/src/components/timeline/TimelineCanvas.tsx
@Application/src/components/Preview.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add displayFrame signal and wire PlaybackEngine to sync it</name>
  <files>Application/src/stores/timelineStore.ts, Application/src/lib/playbackEngine.ts</files>
  <action>
In timelineStore.ts:

1. Add a new signal `displayFrame = signal(0)` alongside `currentFrame`. This signal represents the "UI-visible" frame that only updates when NOT playing.

2. Add a computed `displayTime` similar to `currentTime` but derived from `displayFrame`:
   ```ts
   const displayTime = computed(() => displayFrame.value / projectStore.fps.value);
   ```

3. Export `displayFrame` and `displayTime` on the `timelineStore` object.

4. In the `seek()` method: ALSO set `displayFrame.value` to the clamped value. This ensures scrubbing (which calls seek) updates UI panels in real-time. The seek method is called by playbackEngine.seekToFrame (manual scrub) AND by the tick loop (playback). For the tick loop case, the displayFrame write is redundant but harmless since nothing subscribes reactively during playback -- wait, the tick loop calls seek/stepForward/stepBackward. We need to be more precise:

   Better approach: Do NOT update displayFrame inside seek/stepForward/stepBackward. Instead:
   - Add a method `syncDisplayFrame()` that sets `displayFrame.value = currentFrame.value`
   - Have PlaybackEngine call `syncDisplayFrame()` in `stop()` and in `seekToFrame()` (manual seek/scrub)
   - Have PlaybackEngine.stepForward/stepBackward (manual step, called from buttons not tick) also call `syncDisplayFrame()`

5. In the `reset()` method: also reset `displayFrame.value = 0`.

In playbackEngine.ts:

1. In `stop()`: After `timelineStore.setPlaying(false)`, call `timelineStore.syncDisplayFrame()`.

2. In `seekToFrame()`: After `timelineStore.seek(frame)`, call `timelineStore.syncDisplayFrame()`. This method is used for manual scrub (click-to-seek, drag-scrub) so UI panels must update.

3. In `stepForward()` and `stepBackward()`: After the step call, call `timelineStore.syncDisplayFrame()`. These are only called from transport button clicks (not from the tick loop, which calls timelineStore.stepForward directly).

This ensures:
- During playback tick: currentFrame changes but displayFrame does NOT (UI panels frozen)
- On stop: displayFrame catches up to currentFrame (UI panels refresh)
- On manual scrub/seek: displayFrame updates immediately (UI panels responsive)
- On manual step: displayFrame updates immediately
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>timelineStore exports displayFrame and displayTime signals. PlaybackEngine syncs displayFrame on stop, seek, and manual step. TypeScript compiles clean.</done>
</task>

<task type="auto">
  <name>Task 2: Switch UI components to use displayFrame/displayTime instead of currentFrame/currentTime</name>
  <files>Application/src/components/layout/TimelinePanel.tsx, Application/src/components/layout/CanvasArea.tsx, Application/src/components/layout/PropertiesPanel.tsx, Application/src/components/layer/LayerList.tsx</files>
  <action>
In TimelinePanel.tsx:

1. Change the timecode display from `timelineStore.currentTime.value` to `timelineStore.displayTime.value`. The play/pause button icon (`isPlaying.value`) is fine to keep reactive -- it only changes on play/stop transitions, not per-frame.

In CanvasArea.tsx:

1. Change the timecode display from `timelineStore.currentTime.value` to `timelineStore.displayTime.value`.

2. The `isPlaying` read on line 14 is fine -- it only re-renders on play/stop transitions.

In PropertiesPanel.tsx:

3. PropertiesPanel reads `sequenceStore.sequences.value` and `layerStore.selectedLayerId.value`. These do NOT change per-frame during normal playback (selectedLayerId doesn't change, and sequences only change when crossing sequence boundaries via syncActiveSequence). The main source of unnecessary re-renders here is indirect: when activeSequenceId changes, `layerStore.layers` (computed from active sequence) recomputes, causing LayerList to re-render. However, PropertiesPanel itself only re-renders if `selectedLayerId` or the matching layer's data changes. Since we are NOT changing layer data during playback, PropertiesPanel should already be fine. No changes needed here unless testing reveals otherwise.

In LayerList.tsx:

4. LayerList reads `layerStore.layers.value` which is computed from `sequenceStore.getActiveSequence()`. During playback, `syncActiveSequence()` in PlaybackEngine may switch the active sequence ID, which would recompute `layers` and trigger a LayerList re-render. To prevent this:

   In playbackEngine.ts `syncActiveSequence()`: wrap the sequence switch in a guard that checks `isPlaying`. If playing, defer the active sequence switch -- store it as a pending value and apply it on `stop()`.

   Actually, a simpler approach: in PlaybackEngine.tick(), the `syncActiveSequence()` call switches the active sequence for the PreviewRenderer to know which content to show. But PreviewRenderer already uses `activeSequenceFrames` (computed from active sequence), so it needs the switch. The issue is that the switch also triggers LayerList re-render.

   Best approach: Do NOT change the syncActiveSequence behavior. Instead, make LayerList guard against re-renders during playback by reading `isPlaying` and when playing, skip reading `layers.value` -- use a cached reference instead.

   In LayerList.tsx:
   - Import `timelineStore`
   - At the top of the component: `const playing = timelineStore.isPlaying.value;`
   - Use a ref to cache the last-known layers: `const cachedLayers = useRef(layerStore.layers.value);`
   - When NOT playing, update the cache: `if (!playing) cachedLayers.current = layerStore.layers.value;`
   - Use `cachedLayers.current` for rendering instead of reading `layerStore.layers.value` directly in the JSX.
   - Same pattern for `selectedId`: cache when not playing.

   Wait -- this is getting complex and fragile. Simpler: just read `layerStore.layers.value` normally. The `isPlaying` signal only changes on play/stop, so the component will still re-render on play/stop (which is fine -- 2 re-renders total). The concern was per-frame re-renders from `layers` recomputing. But `layers` is computed from `sequenceStore.getActiveSequence()` which only changes when `activeSequenceId` changes (sequence boundary crossing), not on every frame. So in practice, LayerList only re-renders when crossing a sequence boundary during playback, which is rare and acceptable.

   Conclusion: No changes needed to PropertiesPanel or LayerList. The per-frame re-render issue is confined to timecode displays (which read currentTime every frame).

IMPORTANT: Do NOT modify TimelineCanvas.tsx or Preview.tsx -- they must continue using `currentFrame.value` for per-frame rendering.

Summary of actual changes:
- TimelinePanel.tsx: `currentTime.value` -> `displayTime.value` (one occurrence, timecode)
- CanvasArea.tsx: `currentTime.value` -> `displayTime.value` (two occurrences, timecodes)
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>TimelinePanel and CanvasArea timecode displays use displayTime instead of currentTime. During playback, these DOM elements no longer update per-frame. On stop/scrub/step, they update immediately via displayFrame sync.</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with no errors
2. Manual test: Open a project with multiple sequences and FX layers. Press play. Observe:
   - Preview canvas animates normally (frames render)
   - Timeline playhead moves across the canvas
   - Timecode displays in TimelinePanel and CanvasArea are FROZEN (show the frame where playback started)
   - PropertiesPanel does not visually update
3. Press stop. Observe:
   - Timecode displays immediately snap to the current stopped frame
   - PropertiesPanel shows correct data for current frame position
4. Scrub timeline (click-drag on ruler). Observe:
   - Timecode displays update in real-time as you drag
   - Preview updates in real-time
5. Click step-forward/step-backward buttons. Observe:
   - Timecode advances by one frame each click
</verification>

<success_criteria>
- During playback: only preview canvas and timeline canvas (playhead) update per-frame
- Timecode displays in TimelinePanel and CanvasArea freeze during playback, update on stop/scrub/step
- No TypeScript compilation errors
- No behavioral regression in stop, scrub, or step operations
</success_criteria>

<output>
After completion, create `.planning/quick/2-freeze-ui-updates-during-playback-only-u/2-SUMMARY.md`
</output>
