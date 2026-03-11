---
phase: quick-4
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - Application/src/components/sequence/SequenceList.tsx
  - Application/src/components/timeline/TimelineRenderer.ts
  - Application/src/components/timeline/TimelineInteraction.ts
autonomous: true
requirements: [FX-SIDEBAR-HIDE, FX-BULLET-VIS, FX-BULLET-TOGGLE]
must_haves:
  truths:
    - "FX sequences (kind === 'fx') do not appear in the sidebar SEQUENCES panel"
    - "When an FX sequence has visible === false, its bullet/dot in the timeline header disappears"
    - "Clicking the bullet/dot area in the FX timeline header toggles the FX sequence visibility"
  artifacts:
    - path: "Application/src/components/sequence/SequenceList.tsx"
      provides: "Filtered sequence list excluding FX sequences"
    - path: "Application/src/components/timeline/TimelineRenderer.ts"
      provides: "Conditional bullet rendering based on visibility"
    - path: "Application/src/components/timeline/TimelineInteraction.ts"
      provides: "Bullet click detection and visibility toggle"
  key_links:
    - from: "Application/src/components/sequence/SequenceList.tsx"
      to: "sequenceStore.sequences"
      via: "filter kind !== 'fx'"
      pattern: "sequences\\.filter.*kind.*content"
    - from: "Application/src/components/timeline/TimelineInteraction.ts"
      to: "sequenceStore.toggleFxSequenceVisibility"
      via: "click handler on FX header dot area"
      pattern: "toggleFxSequenceVisibility"
---

<objective>
Fix three FX layer UX issues: (1) hide FX sequences from the sidebar SEQUENCES panel, (2) hide the timeline bullet/dot when an FX layer's eye visibility is toggled off, and (3) allow clicking the timeline bullet to toggle visibility.

Purpose: FX sequences are internal effect containers that should not clutter the user-facing sequence list. The bullet visibility and click-to-toggle provide intuitive FX layer control directly from the timeline.
Output: Three targeted code changes across SequenceList, TimelineRenderer, and TimelineInteraction.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@Application/src/components/sequence/SequenceList.tsx
@Application/src/components/timeline/TimelineRenderer.ts
@Application/src/components/timeline/TimelineInteraction.ts
@Application/src/stores/sequenceStore.ts
@Application/src/types/sequence.ts
@Application/src/lib/frameMap.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Hide FX sequences from sidebar and conditionally render timeline bullet</name>
  <files>Application/src/components/sequence/SequenceList.tsx, Application/src/components/timeline/TimelineRenderer.ts</files>
  <action>
1. In SequenceList.tsx, filter out FX sequences from the sidebar list. Change line 15 from:
   `const sequences = sequenceStore.sequences.value;`
   to:
   `const sequences = sequenceStore.sequences.value.filter(s => s.kind !== 'fx');`
   This ensures only content sequences appear in the SEQUENCES panel. The SortableJS `onEnd` reorder indices still work correctly because they reference the filtered array positions, and `sequenceStore.reorderSequences()` operates on the full array by old/new index -- but since we only show content sequences, we need to map visual indices back to the full array. Actually, reorderSequences takes array-level indices. Since we filter, the visual indices won't match the store indices. Fix: use `sequenceStore.getContentSequences()` for display, and map the SortableJS oldIndex/newIndex through the content-only array to find the actual sequence IDs, then reorder by ID. Simpler approach: just filter the display array and update the onEnd handler to find the actual store indices:
   - Get the content-only sequences array for rendering
   - In onEnd, get the sequence IDs from the content array at oldIndex/newIndex
   - Find their positions in the full sequences array
   - Call reorderSequences with those full-array positions

   Implementation:
   ```
   const allSequences = sequenceStore.sequences.value;
   const sequences = allSequences.filter(s => s.kind !== 'fx');
   ```
   In the SortableJS onEnd callback, map indices:
   ```
   const contentSeqs = sequenceStore.sequences.peek().filter(s => s.kind !== 'fx');
   const movedSeq = contentSeqs[oldIndex];
   const targetSeq = contentSeqs[newIndex];
   if (movedSeq && targetSeq) {
     const allSeqs = sequenceStore.sequences.peek();
     const actualOld = allSeqs.findIndex(s => s.id === movedSeq.id);
     const actualNew = allSeqs.findIndex(s => s.id === targetSeq.id);
     if (actualOld !== -1 && actualNew !== -1) {
       sequenceStore.reorderSequences(actualOld, actualNew);
     }
   }
   ```
   Keep the SortableJS DOM revert pattern (removeChild/insertBefore) unchanged.

2. In TimelineRenderer.ts `drawFxTrack()` method (around line 340-355), conditionally skip drawing the color dot when the FX track is not visible. Currently the dot is always drawn at `dotX + 3, dotY`. Wrap the dot drawing in a visibility check:
   ```
   if (isVisible) {
     ctx.beginPath();
     ctx.arc(dotX + 3, dotY, 3, 0, Math.PI * 2);
     ctx.fill();
   }
   ```
   The name text is already dimmed when hidden (fillStyle uses '#555555'), which is good. The dot simply should not render when hidden.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>FX sequences no longer appear in the sidebar SEQUENCES panel. The colored bullet/dot in the timeline FX track header disappears when the FX sequence is hidden (visible === false). Content sequence reordering still works correctly with the filtered list.</done>
</task>

<task type="auto">
  <name>Task 2: Add click-to-toggle visibility on FX timeline bullet</name>
  <files>Application/src/components/timeline/TimelineInteraction.ts</files>
  <action>
In TimelineInteraction.ts, modify the FX header pointer-down handler to detect clicks on the bullet/dot area and toggle visibility instead of starting a reorder drag.

The bullet dot is drawn at x=9 (dotX=6, center at dotX+3=9), y=center of FX_TRACK_HEIGHT. The hit area for the dot should be approximately x < 18px (within the dot region) from the left edge of the canvas.

In the `onPointerDown` method, inside the FX header detection block (around line 213, the `if (localX < TRACK_HEADER_WIDTH && fxIdx >= 0 && fxIdx < fxTracks.length)` block):

Before starting the reorder drag, check if the click is on the bullet area (localX < 18). If so, toggle visibility and return without starting drag:

```typescript
if (localX < TRACK_HEADER_WIDTH && fxIdx >= 0 && fxIdx < fxTracks.length) {
  const fxSeqId = fxTracks[fxIdx].sequenceId;

  // Click on bullet/dot area (x < 18px) toggles visibility
  if (localX < 18) {
    sequenceStore.toggleFxSequenceVisibility(fxSeqId);
    return;
  }

  // Rest of header: initiate FX reorder drag
  this.isDraggingFxReorder = true;
  // ... existing code ...
}
```

This gives a generous 18px wide hit zone for the 6px diameter dot, making it easy to click.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>Clicking the bullet/dot area (leftmost ~18px) in an FX track header toggles the FX sequence visibility on/off. Clicking elsewhere in the header still initiates reorder drag as before.</done>
</task>

</tasks>

<verification>
1. `cd Application && npx tsc --noEmit` -- no type errors
2. Manual verification: Open project with FX layers. Confirm FX sequences do NOT appear in sidebar SEQUENCES panel. Confirm content sequences still appear and can be reordered.
3. Manual verification: Toggle FX eye icon off in properties. Confirm the colored dot in the timeline FX header disappears.
4. Manual verification: Click the dot area in an FX timeline header. Confirm it toggles visibility (dot appears/disappears, FX overlay shows/hides in preview).
</verification>

<success_criteria>
- FX sequences (kind === 'fx') are completely hidden from the sidebar SEQUENCES panel
- Content sequences still render, reorder, and function normally in the sidebar
- Hidden FX sequences (visible === false) show no bullet/dot in the timeline header
- Clicking the bullet/dot area in the FX timeline header toggles visibility
- No TypeScript compilation errors
</success_criteria>

<output>
After completion, create `.planning/quick/4-fix-fx-layers-hide-from-sidebar-sequence/4-SUMMARY.md`
</output>
