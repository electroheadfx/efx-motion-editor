---
phase: quick-5
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - Application/src/components/timeline/TimelineInteraction.ts
  - Application/src/components/timeline/TimelineCanvas.tsx
  - Application/src/components/timeline/TimelineRenderer.ts
  - Application/src/lib/shortcuts.ts
autonomous: true
must_haves:
  truths:
    - "Clicking on a content sequence track header in the timeline selects that sequence (sets activeSequenceId and uiStore.selectedSequenceId)"
    - "Selected content sequence track shows visual highlight (matching FX track selection pattern)"
    - "Pressing Delete/Backspace when a content sequence is selected removes it immediately without confirmation dialog"
    - "FX layer delete via Delete/Backspace still works as before (selected layer takes priority)"
    - "Undo restores a deleted sequence"
  artifacts:
    - path: "Application/src/components/timeline/TimelineInteraction.ts"
      provides: "Content track header click selects sequence"
    - path: "Application/src/components/timeline/TimelineRenderer.ts"
      provides: "Visual highlight for selected content sequence"
    - path: "Application/src/lib/shortcuts.ts"
      provides: "Delete key removes selected content sequence"
  key_links:
    - from: "TimelineInteraction.ts"
      to: "sequenceStore.setActive + uiStore.selectSequence"
      via: "pointerDown on content track header"
      pattern: "sequenceStore\\.setActive|uiStore\\.selectSequence"
    - from: "shortcuts.ts handleDelete"
      to: "sequenceStore.remove"
      via: "fallback after layer check"
      pattern: "sequenceStore\\.remove"
---

<objective>
Enable selecting a content (Key) sequence by clicking its track header on the timeline, with visual highlight feedback, and allow deleting the selected sequence via Delete/Backspace key without confirmation dialog.

Purpose: Currently content sequences can only be selected/deleted via the sidebar SequenceList context menu (with confirmation). FX layers can be selected by clicking their timeline track. This brings content sequences to parity with FX layers for timeline-based selection and keyboard delete.

Output: Modified TimelineInteraction, TimelineRenderer, TimelineCanvas, and shortcuts.ts
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@Application/src/components/timeline/TimelineInteraction.ts
@Application/src/components/timeline/TimelineRenderer.ts
@Application/src/components/timeline/TimelineCanvas.tsx
@Application/src/lib/shortcuts.ts
@Application/src/stores/sequenceStore.ts
@Application/src/stores/uiStore.ts
@Application/src/stores/layerStore.ts
@Application/src/lib/frameMap.ts

<interfaces>
<!-- Key types and contracts the executor needs -->

From stores/sequenceStore.ts:
- `sequenceStore.setActive(id: string | null)` — sets activeSequenceId, clears selectedKeyPhotoId
- `sequenceStore.remove(id: string)` — removes sequence by ID with undo support
- `sequenceStore.sequences` — Signal<Sequence[]>
- `sequenceStore.activeSequenceId` — Signal<string | null>

From stores/uiStore.ts:
- `uiStore.selectSequence(id: string | null)` — sets selectedSequenceId signal
- `uiStore.selectedSequenceId` — Signal<string | null>
- `uiStore.selectedLayerId` — Signal<string | null>

From stores/layerStore.ts:
- `layerStore.selectedLayerId` — Signal<string | null>
- `layerStore.setSelected(id: string | null)`
- `layerStore.remove(id: string)` — removes layer (routes FX layers to sequence-aware method)

From lib/frameMap.ts:
- `trackLayouts` — computed<TrackLayout[]> — one entry per content sequence with sequenceId, startFrame, etc.

From TimelineRenderer.ts:
- `DrawState.selectedFxSequenceId` — already passed to renderer for FX highlight
- FX track highlight pattern: `isSelected ? '#1A1520' : FX_TRACK_BG` for background, left accent border with track color
- Content tracks drawn at line 175+, FX tracks at line 136+

From TimelineInteraction.ts:
- `trackIndexFromY(clientY)` — returns content track index from Y coordinate
- Content track header click currently only initiates drag reorder (lines 263-283), no selection
- FX track click calls `selectFxSequenceLayer()` to select FX layer for properties panel
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add content sequence selection on timeline track header click and visual highlight</name>
  <files>
    Application/src/components/timeline/TimelineInteraction.ts
    Application/src/components/timeline/TimelineRenderer.ts
    Application/src/components/timeline/TimelineCanvas.tsx
  </files>
  <action>
**TimelineInteraction.ts:**

1. In `onPointerDown`, at the content track header area (line ~263, `if (localX < TRACK_HEADER_WIDTH)`), BEFORE the drag-reorder check, add sequence selection logic:
   - Get the track from `trackLayouts.peek()` at `trackIndex`
   - If valid track found, call `sequenceStore.setActive(track.sequenceId)` and `uiStore.selectSequence(track.sequenceId)`
   - Also clear any selected FX layer: `layerStore.setSelected(null)` and `uiStore.selectLayer(null)` — so Delete key targets the sequence, not a stale layer
   - The existing drag-reorder logic should still work (it starts on pointerDown and completes on pointerUp)

2. In `onPointerDown`, when clicking on a content track body area (lines 293-297, the else branch after ruler/playhead check), also select that sequence:
   - Compute trackIndex from Y
   - If valid track, call `sequenceStore.setActive(track.sequenceId)` and `uiStore.selectSequence(track.sequenceId)`
   - Clear selected layer: `layerStore.setSelected(null)` and `uiStore.selectLayer(null)`
   - Still seek playhead as before

3. In `selectFxSequenceLayer` (line 165), this already selects the FX layer via `layerStore.setSelected` and `uiStore.selectLayer`. No changes needed — when an FX track is clicked, the layer selection takes priority over sequence selection in the delete handler.

**TimelineRenderer.ts:**

1. Add `selectedContentSequenceId` to `DrawState` interface (alongside existing `selectedFxSequenceId`).

2. Add private field `private selectedContentSequenceId: string | null = null;` (matching the FX pattern at line 66).

3. In `draw()` method, read and store it: `if (state.selectedContentSequenceId !== undefined) { this.selectedContentSequenceId = state.selectedContentSequenceId; }`

4. In the content track drawing loop (line 178+), check if `tracks[ti].sequenceId === this.selectedContentSequenceId`. If selected:
   - Use a highlight background color for the track: `'#151A20'` instead of `TRACK_BG` (`'#111111'`)
   - Use a highlight header color: `'#101520'` instead of `TRACK_HEADER_BG` (`'#0D0D0D'`)
   - Draw a 2px left accent border in `'#4488FF'` (a blue accent, distinguishing from FX colors)
   - Adjust header fillRect x offset by 2px when selected (same pattern as FX track selection at lines 335-343)

**TimelineCanvas.tsx:**

1. In the `effect()` that calls `renderer.draw()`, add `selectedContentSequenceId` to the draw state:
   - Read `uiStore.selectedSequenceId.value` (import uiStore if not already imported — it IS already imported via layerStore chain... actually check: uiStore is not directly imported. Import it.)
   - Wait, actually `uiStore` is NOT imported in TimelineCanvas.tsx currently. But `sequenceStore` is. Use `sequenceStore.activeSequenceId.value` as the selectedContentSequenceId since `setActive` is called on selection.
   - Add to draw call: `selectedContentSequenceId: sequenceStore.activeSequenceId.value`
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>Clicking a content sequence track header or body in the timeline selects that sequence visually (highlighted track) and sets it as active. Selected layer is cleared so delete targets the sequence.</done>
</task>

<task type="auto">
  <name>Task 2: Wire Delete/Backspace key to remove selected content sequence without confirmation</name>
  <files>
    Application/src/lib/shortcuts.ts
  </files>
  <action>
Modify the `handleDelete()` function in shortcuts.ts (line 76):

Current logic:
1. If a layer is selected (`uiStore.selectedLayerId`), delete the layer
2. Otherwise no-op

New logic:
1. If a layer is selected (`uiStore.selectedLayerId`), delete the layer (unchanged — FX layers still delete via this path)
2. **Else if** a content sequence is selected (`uiStore.selectedSequenceId`), check if it is a content sequence (not FX):
   - Get the sequence: `const seq = sequenceStore.getById(uiStore.selectedSequenceId.value)`
   - If `seq && seq.kind === 'content'`:
     - Call `sequenceStore.remove(seq.id)` — this is already undoable
     - Call `uiStore.selectSequence(null)` to clear selection
     - NO confirmation dialog (per user request: "delete it without warning")
   - Do NOT delete FX sequences via this path (FX sequences are deleted by deleting their layer, which auto-removes empty FX sequences)

Import `sequenceStore` at the top of shortcuts.ts (it is not currently imported — add: `import {sequenceStore} from '../stores/sequenceStore';`).

IMPORTANT: Do NOT add a confirmation dialog. The user explicitly wants deletion without warning. Undo via Cmd+Z provides the safety net.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>Delete/Backspace removes the selected content sequence immediately without confirmation. FX layer deletion still works. Undo restores the deleted sequence.</done>
</task>

</tasks>

<verification>
1. TypeScript compiles without errors: `cd Application && npx tsc --noEmit`
2. App builds successfully: `cd Application && npm run build`
3. Manual verification:
   - Click a content sequence track header on the timeline -> track highlights
   - Click a different content sequence track -> highlight moves
   - Click an FX track -> content highlight clears, FX highlights
   - Select a content sequence on timeline, press Delete -> sequence removed immediately (no dialog)
   - Press Cmd+Z -> sequence restored
   - Select an FX layer, press Delete -> FX layer removed (existing behavior preserved)
</verification>

<success_criteria>
- Content sequence tracks are selectable by clicking their header or body area on the timeline
- Selected content track shows visual highlight (tinted background + accent border)
- Delete/Backspace removes selected content sequence without confirmation dialog
- FX layer deletion via Delete/Backspace still works when an FX layer is selected
- Undo (Cmd+Z) restores deleted sequences
- TypeScript compiles cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/5-select-a-key-sequence-like-with-fx-layer/5-SUMMARY.md`
</output>
