---
phase: quick-8
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - Application/src/components/sequence/SequenceList.tsx
  - Application/src/components/Preview.tsx
autonomous: true
requirements: [QUICK-8]
must_haves:
  truths:
    - "Selecting a different sequence in the sidebar keeps the cursor/playhead at its current global position"
    - "Preview renders the content that exists at the cursor position, regardless of which sequence is selected"
    - "Clicking a track area in the timeline still seeks to the clicked position (unchanged)"
    - "Playback rendering via rAF loop continues working correctly"
  artifacts:
    - path: "Application/src/components/sequence/SequenceList.tsx"
      provides: "Sequence selection without playhead jump"
    - path: "Application/src/components/Preview.tsx"
      provides: "Frame-map-based rendering independent of activeSequenceId"
  key_links:
    - from: "Preview.tsx disposeRender effect"
      to: "frameMap"
      via: "Uses frameMap to determine which sequence's content to render at cursor position"
      pattern: "frameMap\\.value|frameMap\\.peek"
---

<objective>
Fix sequence selection rendering: when selecting a different sequence in the timeline sidebar, the render should stay at the global cursor position instead of jumping to show the selected sequence's start.

Purpose: Currently, selecting Sequence 2 (starts at 6s) while cursor is at 2s (under Sequence 1) causes the preview to render Sequence 2's content as if the cursor were at 6s. The cursor should stay at 2s and show whatever content exists at that global position.

Output: Preview renders based on cursor position using frameMap, not based on activeSequenceId. Sequence selection in sidebar no longer moves the playhead.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@Application/src/components/Preview.tsx
@Application/src/components/sequence/SequenceList.tsx
@Application/src/lib/frameMap.ts
@Application/src/stores/sequenceStore.ts
@Application/src/stores/timelineStore.ts
@Application/src/stores/layerStore.ts
@Application/src/components/timeline/TimelineInteraction.ts

<interfaces>
From Application/src/lib/frameMap.ts:
```typescript
// frameMap: global frame -> { globalFrame, sequenceId, keyPhotoId, imageId, localFrame }
export const frameMap = computed<FrameEntry[]>(...);
export const activeSequenceFrames = computed<FrameEntry[]>(...);
export const activeSequenceStartFrame = computed<number>(...);
```

From Application/src/stores/timelineStore.ts:
```typescript
export const timelineStore = {
  currentFrame: signal(0),    // updated during playback
  displayFrame: signal(0),    // updated on seek/stop/step (not during playback)
  seek(frame: number): void,
  syncDisplayFrame(): void,
};
```

From Application/src/stores/sequenceStore.ts:
```typescript
export const sequenceStore = {
  sequences: signal<Sequence[]>([]),
  activeSequenceId: signal<string | null>(null),
  setActive(id: string | null): void,
  getActiveSequence(): Sequence | null,
  getById(id: string): Sequence | null,
};
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove playhead seek from sidebar sequence selection</name>
  <files>Application/src/components/sequence/SequenceList.tsx</files>
  <action>
In SequenceList.tsx, modify the `handleSelect` callback (around line 113-123) to remove the playhead seek behavior. Currently it does:

```typescript
const handleSelect = useCallback(() => {
  if (!editing) {
    uiStore.selectSequence(seq.id);
    sequenceStore.setActive(seq.id);
    // Seek playhead to this sequence's start frame so preview shows the right content
    const track = trackLayouts.peek().find((t) => t.sequenceId === seq.id);
    if (track) {
      timelineStore.seek(track.startFrame);
    }
  }
}, [seq.id, editing]);
```

Change it to only select the sequence without seeking:

```typescript
const handleSelect = useCallback(() => {
  if (!editing) {
    uiStore.selectSequence(seq.id);
    sequenceStore.setActive(seq.id);
  }
}, [seq.id, editing]);
```

Also remove the now-unused imports: `timelineStore` and `trackLayouts` (check they are not used elsewhere in the file first -- `trackLayouts` is NOT used elsewhere, but `timelineStore` is NOT imported from this file at all so just remove `trackLayouts`). Actually check: `timelineStore` is imported on line 7 and `trackLayouts` on line 8. Verify no other usage before removing.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>Selecting a sequence in the sidebar no longer moves the playhead. Unused imports removed cleanly.</done>
</task>

<task type="auto">
  <name>Task 2: Make Preview render based on cursor position via frameMap instead of activeSequenceId</name>
  <files>Application/src/components/Preview.tsx</files>
  <action>
In Preview.tsx, the `disposeRender` effect (lines 69-90) currently renders using:
- `layerStore.layers.value` (layers from the ACTIVE sequence, not the sequence at the cursor)
- `activeSequenceFrames.value` (frames from the active sequence)
- `activeSequenceStartFrame.value` (start frame of the active sequence)
- `sequenceStore.getActiveSequence()?.fps` (fps of active sequence)

This means if cursor is at frame 10 (in Sequence 1) but Sequence 2 is active, it renders Sequence 2's layers at local frame `10 - startOfSeq2` which is wrong.

Refactor the `disposeRender` effect to use `frameMap` to determine which content sequence owns the current cursor frame, then render that sequence's layers. This mirrors the approach already used by `renderFromFrameMap` (lines 24-53) which correctly handles this.

Replace the `disposeRender` effect body with logic that:

1. Reads `displayFrame.value` (subscribes to scrub/seek changes)
2. Looks up `frameMap.value[globalFrame]` to find the owning `sequenceId`
3. Finds that sequence from `sequenceStore.sequences.value`
4. Computes `seqStart` by walking backward in frameMap (same pattern as `renderFromFrameMap`)
5. Filters `frameMap` entries for that sequence to get `seqFrames`
6. Computes `localFrame = globalFrame - seqStart`
7. Calls `renderer.renderFrame(seq.layers, localFrame, seqFrames, seq.fps)`
8. Then composites FX sequences on top (same as current code, using `globalFrame` for in/out range checks)

The key change: instead of `layerStore.layers.value` (active sequence), use the sequence that owns the cursor frame. Instead of `activeSequenceFrames` and `activeSequenceStartFrame`, derive from `frameMap`.

Also subscribing to `sequenceStore.sequences.value` (instead of just `layerStore.layers.value`) ensures re-render when layer properties change on ANY sequence.

Remove the now-unused imports: `layerStore`, `activeSequenceFrames`, `activeSequenceStartFrame`. Keep `frameMap` (already imported) and `sequenceStore` (already imported).

The updated effect should look like:

```typescript
const disposeRender = effect(() => {
  const globalFrame = timelineStore.displayFrame.value;
  const fm = frameMap.value;
  // Subscribe to all sequence data so we re-render on layer property changes
  const allSeqs = sequenceStore.sequences.value;

  if (globalFrame < 0 || globalFrame >= fm.length) return;

  const entry = fm[globalFrame];
  if (!entry) return;

  const seq = allSeqs.find((s) => s.id === entry.sequenceId);
  if (!seq || seq.kind === 'fx') return;

  // Compute sequence start frame and local frame from frameMap
  let seqStart = globalFrame;
  while (seqStart > 0 && fm[seqStart - 1]?.sequenceId === entry.sequenceId) seqStart--;
  const seqFrames = fm.filter((e) => e.sequenceId === entry.sequenceId);
  const localFrame = globalFrame - seqStart;

  renderer.renderFrame(seq.layers, localFrame, seqFrames, seq.fps);

  // Composite FX sequences on top of content (without clearing the canvas)
  for (const fxSeq of allSeqs) {
    if (fxSeq.kind !== 'fx') continue;
    if (fxSeq.visible === false) continue;
    if (fxSeq.inFrame != null && globalFrame < fxSeq.inFrame) continue;
    if (fxSeq.outFrame != null && globalFrame >= fxSeq.outFrame) continue;
    const fxLayers = fxSeq.layers.filter((l) => l.visible);
    if (fxLayers.length > 0) {
      renderer.renderFrame(fxLayers, localFrame, seqFrames, seq.fps, false);
    }
  }
});
```

This is nearly identical to the existing `renderFromFrameMap` function. The difference is that `disposeRender` uses `.value` (reactive, subscribes to changes) while `renderFromFrameMap` uses `.peek()` (non-reactive, used in rAF loop).

After this change, the `hasLayers` check at line 11 also needs updating since `layerStore` is removed. Replace with a check that sequences have content:
```typescript
const hasContent = sequenceStore.sequences.value.some(s => s.kind === 'content' && s.keyPhotos.length > 0) || sequenceStore.getFxSequences().length > 0;
```

Also update the preload effect: instead of preloading only activeSequenceFrames, preload ALL content frames from frameMap since the cursor can be in any sequence:
```typescript
const disposePreload = effect(() => {
  const frames = frameMap.value;
  const imageIds = [...new Set(frames.map((f) => f.imageId))];
  renderer.preloadImages(imageIds);
});
```
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>Preview renders the content at the global cursor position regardless of which sequence is "active" in the sidebar. Selecting Sequence 2 while cursor is at frame 10 (in Sequence 1's range) still shows Sequence 1's content at frame 10. The sidebar selection only affects which sequence's layers/properties are shown in the sidebar panels.</done>
</task>

</tasks>

<verification>
1. TypeScript compiles without errors: `cd Application && npx tsc --noEmit`
2. Manual test scenario:
   - Create project with two content sequences (Seq1 with frames 0-50, Seq2 with frames 50-100)
   - Place cursor at frame 10 (within Seq1)
   - Click Seq2 in sidebar list
   - Verify: cursor stays at frame 10, preview still shows Seq1's content at frame 10
   - Verify: sidebar now shows Seq2's layers/properties
3. Verify clicking on a track area in the timeline still seeks and renders correctly
4. Verify playback still renders correctly via the rAF loop
</verification>

<success_criteria>
- Selecting a sequence in the sidebar does NOT move the playhead
- Preview always renders the content that exists at the global cursor position
- Timeline click-to-seek continues working (seeks to clicked position)
- Playback rendering unaffected
- No TypeScript compilation errors
</success_criteria>

<output>
After completion, create `.planning/quick/8-fix-sequence-selection-rendering-cursor-/8-SUMMARY.md`
</output>
