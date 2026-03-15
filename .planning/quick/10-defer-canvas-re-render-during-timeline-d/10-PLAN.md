---
phase: quick-10
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - Application/src/stores/timelineStore.ts
  - Application/src/components/timeline/TimelineInteraction.ts
  - Application/src/components/Preview.tsx
autonomous: false
requirements: [QUICK-10]
must_haves:
  truths:
    - "Canvas does not re-render while dragging in/out points, layers, or keyframes on the timeline"
    - "Canvas re-renders once when mouse is released after a timeline drag"
    - "Canvas still re-renders immediately for non-drag interactions (click-to-seek, step forward/backward)"
    - "Timeline canvas (playhead, tracks) still updates in real-time during all drag operations"
  artifacts:
    - path: "Application/src/stores/timelineStore.ts"
      provides: "timelineDragging signal"
      contains: "timelineDragging"
    - path: "Application/src/components/timeline/TimelineInteraction.ts"
      provides: "Drag start/end sets timelineDragging signal"
    - path: "Application/src/components/Preview.tsx"
      provides: "Render effect skips when timelineDragging is true"
  key_links:
    - from: "TimelineInteraction.ts"
      to: "timelineStore.timelineDragging"
      via: "set true on pointerdown drag start, false on pointerup"
    - from: "Preview.tsx render effect"
      to: "timelineStore.timelineDragging"
      via: "early-return when true; re-renders on false transition"
---

<objective>
Defer canvas (Preview) re-renders during timeline drag operations until mouse release.

Purpose: Currently, dragging layer in/out points (FX resize), moving layers (FX move), dragging keyframes, and playhead scrubbing all cause the Preview canvas to re-render on every pointermove event. This is expensive (full compositing pass with blur, generators, etc.) and makes the UI sluggish. The timeline canvas should continue updating in real-time, but the Preview canvas should only re-render once on mouseup.

Output: Modified timelineStore, TimelineInteraction, and Preview with drag-gating logic.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@Application/src/stores/timelineStore.ts
@Application/src/components/timeline/TimelineInteraction.ts
@Application/src/components/Preview.tsx
@Application/src/lib/playbackEngine.ts
</context>

<interfaces>
<!-- Key signals and methods the executor needs -->

From Application/src/stores/timelineStore.ts:
```typescript
export const timelineStore = {
  currentFrame,      // signal(0) - updated by seek/step
  displayFrame,      // signal(0) - drives Preview.tsx render
  syncDisplayFrame()  // sets displayFrame = currentFrame
  seek(frame: number) // sets currentFrame only (NOT displayFrame)
};
```

From Application/src/lib/playbackEngine.ts:
```typescript
export class PlaybackEngine {
  seekToFrame(frame: number) {
    timelineStore.seek(frame);       // sets currentFrame
    timelineStore.syncDisplayFrame(); // sets displayFrame -> triggers Preview render
  }
}
```

From Application/src/components/Preview.tsx render effect (lines 97-129):
```typescript
// Subscribes to displayFrame.value AND sequenceStore.sequences.value
// Both change during timeline drags, causing expensive re-renders
const disposeRender = effect(() => {
  const globalFrame = timelineStore.displayFrame.value;  // triggers on seek
  const allSeqs = sequenceStore.sequences.value;         // triggers on FX drag/keyframe move
  // ... expensive compositing/blur/render
});
```

Drag types in TimelineInteraction that cause re-renders:
1. Playhead scrub (isDragging): calls playbackEngine.seekToFrame() on every move
2. FX range drag (isDraggingFx): calls sequenceStore.updateFxSequenceRange() on every move
3. Keyframe drag (isDraggingKeyframe): calls keyframeStore.moveKeyframe() on every move
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Add timelineDragging signal and gate Preview renders</name>
  <files>Application/src/stores/timelineStore.ts, Application/src/components/Preview.tsx, Application/src/components/timeline/TimelineInteraction.ts</files>
  <action>
**1. timelineStore.ts** -- Add a `timelineDragging` signal:

```typescript
const timelineDragging = signal(false);
```

Export it in the timelineStore object:
```typescript
timelineDragging,
setTimelineDragging(v: boolean) {
  timelineDragging.value = v;
},
```

**2. Preview.tsx** -- Gate the render effect with the dragging signal.

In the `disposeRender = effect(...)` block (around line 97), add at the top of the effect callback:

```typescript
const isDragging = timelineStore.timelineDragging.value;
if (isDragging) return; // Skip render during timeline drags
```

This works because Preact signals track dependencies accessed before an early return. The effect subscribes to `timelineDragging` and when it transitions from `true` to `false`, the effect re-runs and performs the render with current state.

**3. TimelineInteraction.ts** -- Set dragging flag on drag start/end.

Import `timelineStore` (already imported).

**Playhead scrub drag start** -- In `onPointerDown`, in the ruler/playhead branch (around line 427-429 where `isDragging = true`), add:
```typescript
timelineStore.setTimelineDragging(true);
```

**Playhead scrub during drag** -- In `onPointerMove`, in the `isDragging` branch (around line 521-523), change from `playbackEngine.seekToFrame(frame)` to:
```typescript
timelineStore.seek(frame); // Update currentFrame only (timeline canvas updates)
// Do NOT call syncDisplayFrame -- Preview stays frozen
```

**Playhead scrub drag end** -- In `onPointerUp`, in the `isDragging` branch (around line 668-677), add before or after `isDragging = false`:
```typescript
timelineStore.setTimelineDragging(false);
playbackEngine.seekToFrame(timelineStore.currentFrame.peek()); // Final sync
```
Note: `seekToFrame` calls `syncDisplayFrame` which will trigger the Preview render now that dragging is false.

**FX range drag start** -- In `onPointerDown`, FX drag branch (around line 327-336 where `isDraggingFx = true`), add:
```typescript
timelineStore.setTimelineDragging(true);
```

**FX range drag end** -- In `onPointerUp`, FX drag branch (around line 621-633), add after `isDraggingFx = false`:
```typescript
timelineStore.setTimelineDragging(false);
timelineStore.syncDisplayFrame(); // Trigger final Preview render
```

**Keyframe drag start** -- In `onPointerDown`, keyframe drag branch (around line 380-386 where `isDraggingKeyframe = true`), add:
```typescript
timelineStore.setTimelineDragging(true);
```

**Keyframe drag end** -- In `onPointerUp`, keyframe drag branch (around line 572-583), add after `isDraggingKeyframe = false`:
```typescript
timelineStore.setTimelineDragging(false);
timelineStore.syncDisplayFrame(); // Trigger final Preview render
```

**Important: Do NOT gate track header drag or FX reorder drag** -- these only update visual drag state in the renderer and do not cause canvas re-renders, so no optimization needed.

**Important: Do NOT change the initial click seekToFrame calls** -- single clicks (non-drag) should still trigger immediate Preview renders. Only the drag continuations (pointermove handlers) should be deferred.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - timelineDragging signal exists in timelineStore
    - Preview.tsx render effect checks timelineDragging and skips when true
    - TimelineInteraction sets timelineDragging=true on playhead scrub/FX drag/keyframe drag start
    - TimelineInteraction sets timelineDragging=false and calls syncDisplayFrame on drag end
    - Playhead scrub during drag uses timelineStore.seek() instead of playbackEngine.seekToFrame()
    - TypeScript compiles without errors
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Verify deferred canvas rendering behavior</name>
  <files>n/a</files>
  <action>Human verifies that canvas rendering is deferred during timeline drags and updates on mouse release.</action>
  <verify>Manual verification per steps below</verify>
  <done>All drag operations defer canvas render; all non-drag operations render immediately</done>
  <what-built>Deferred canvas re-rendering during timeline drag operations. The Preview canvas now freezes during playhead scrub, FX range drag, and keyframe drag -- only updating on mouse release.</what-built>
  <how-to-verify>
    1. Open a project with content and FX layers
    2. **Playhead scrub test**: Click and drag on the timeline ruler. Verify:
       - The playhead moves smoothly in the timeline
       - The Preview canvas does NOT update during the drag
       - On mouse release, the Preview canvas updates to show the final frame
    3. **FX range drag test**: Drag an FX layer's in/out points or move it. Verify:
       - The FX bar moves/resizes in the timeline
       - The Preview canvas does NOT update during the drag
       - On mouse release, the Preview canvas updates
    4. **Keyframe drag test**: Select a layer with keyframes, drag a diamond. Verify:
       - The diamond moves in the timeline
       - The Preview canvas does NOT update during the drag
       - On mouse release, the Preview canvas updates
    5. **Click-to-seek test**: Single-click on the timeline (no drag). Verify:
       - The Preview canvas updates immediately (no regression)
    6. **Step forward/backward test**: Use step buttons or J/K/L. Verify:
       - The Preview canvas updates immediately (no regression)
    7. **Playback test**: Press play. Verify:
       - Playback renders normally via rAF loop (no regression)
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- TypeScript compiles without errors
- All timeline drag operations (playhead scrub, FX drag, keyframe drag) no longer cause Preview canvas re-renders during drag
- Single-click seek, step forward/backward, and playback still trigger immediate renders
- Timeline canvas (playhead, track visuals) still updates in real-time during all operations
</verification>

<success_criteria>
- Dragging on timeline does not cause visible Preview canvas updates until mouseup
- UI feels noticeably smoother during timeline drag operations
- No regressions in click-to-seek, step, or playback rendering
</success_criteria>

<output>
After completion, create `.planning/quick/10-defer-canvas-re-render-during-timeline-d/10-SUMMARY.md`
</output>
