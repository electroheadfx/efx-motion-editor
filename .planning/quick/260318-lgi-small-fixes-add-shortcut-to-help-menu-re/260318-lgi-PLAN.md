---
phase: quick
plan: 260318-lgi
type: execute
wave: 1
depends_on: []
files_modified:
  - Application/src-tauri/src/lib.rs
  - Application/src/main.tsx
  - Application/src/components/sequence/SequenceList.tsx
  - Application/src/components/sequence/KeyPhotoStrip.tsx
autonomous: true
requirements: [QUICK-LGI]
must_haves:
  truths:
    - "View > Zoom In menu item shows +/= as shortcut hint and triggers context-aware zoom"
    - "Non-selected sequences in sidebar display at full opacity"
    - "First key photo thumbnail in sidebar does not have clipped ring/border at top or left edges"
    - "Clicking on sidebar sequence header or empty background area deselects the currently selected key photo"
  artifacts:
    - path: "Application/src-tauri/src/lib.rs"
      provides: "View menu Zoom In label updated to show + shortcut"
    - path: "Application/src/main.tsx"
      provides: "Context-aware menu:zoom-in/out listeners"
    - path: "Application/src/components/sequence/SequenceList.tsx"
      provides: "Full opacity on non-selected sequences, key photo deselect on header click"
    - path: "Application/src/components/sequence/KeyPhotoStrip.tsx"
      provides: "No border clipping on first key photo, deselect on background click"
  key_links:
    - from: "Application/src-tauri/src/lib.rs"
      to: "Application/src/main.tsx"
      via: "menu:zoom-in / menu:zoom-out Tauri event"
      pattern: "emit.*menu:zoom"
---

<objective>
Four small UI/UX fixes: (1) Add [+] shortcut display to View menu Zoom In and make menu zoom context-aware, (2) Remove opacity on non-selected sidebar sequences, (3) Fix clipped border on first key photo thumbnail, (4) Allow deselecting key photo by clicking sequence header or background.

Purpose: Polish pass on sidebar and menu behavior.
Output: Updated Rust menu, main.tsx listeners, SequenceList, KeyPhotoStrip components.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/get-shit-done/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@Application/src-tauri/src/lib.rs
@Application/src/main.tsx
@Application/src/components/sequence/SequenceList.tsx
@Application/src/components/sequence/KeyPhotoStrip.tsx
@Application/src/stores/sequenceStore.ts
@Application/src/lib/shortcuts.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: View menu shortcut label + context-aware menu zoom + sequence opacity fix</name>
  <files>Application/src-tauri/src/lib.rs, Application/src/main.tsx, Application/src/components/sequence/SequenceList.tsx</files>
  <action>
1. In `Application/src-tauri/src/lib.rs`, update the `zoom_in_item` label from `"Zoom In"` to `"Zoom In (+/=)"` so the native View menu shows the shortcut hint. Similarly update `zoom_out_item` label to `"Zoom Out (-)"`. These menu items have `None::<&str>` for the accelerator (correct -- bare keys are handled by tinykeys), so only the display label changes.

2. In `Application/src/main.tsx`, make the `menu:zoom-in` and `menu:zoom-out` listeners context-aware like the tinykeys handlers. Import `uiStore` and `timelineStore`, then change:
   - `listen('menu:zoom-in', ...)` to check `uiStore.mouseRegion.peek()`: if `'timeline'` call `timelineStore.zoomIn()`, else call `canvasStore.zoomIn()`.
   - `listen('menu:zoom-out', ...)` to check `uiStore.mouseRegion.peek()`: if `'timeline'` call `timelineStore.zoomOut()`, else call `canvasStore.zoomOut()`.

3. In `Application/src/components/sequence/SequenceList.tsx`, in the `SequenceItem` component's root `<div>` (line ~212), remove the opacity conditional. Change `opacity: isActive ? 1 : 0.5` to simply remove the `opacity` property entirely from the style object. Non-selected sequences should render at full opacity.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>View menu shows "+/=" and "-" shortcut hints in labels; menu zoom is context-aware; all sequences render at full opacity regardless of selection state.</done>
</task>

<task type="auto">
  <name>Task 2: Fix key photo border clipping + add click-to-deselect key photo</name>
  <files>Application/src/components/sequence/KeyPhotoStrip.tsx, Application/src/components/sequence/SequenceList.tsx</files>
  <action>
1. **Fix border clipping on first key photo:** In `KeyPhotoStripInline` component in `KeyPhotoStrip.tsx`, the strip container div (line ~117) has `class="flex gap-1 overflow-x-auto scrollbar-hidden pb-1"`. The `ring-2` on the selected `KeyPhotoCard` gets clipped at top and left edges because the parent has no padding. Add `p-0.5` (2px padding) to the strip container so the ring has room to render on all sides. Change the class to `"flex gap-1 overflow-x-auto scrollbar-hidden p-0.5"` (replacing `pb-1` with `p-0.5` which provides uniform 2px padding including bottom).

2. **Deselect key photo on sequence header click:** In `SequenceList.tsx`, the `handleSelect` callback already calls `sequenceStore.clearKeyPhotoSelection()` (line ~127), so clicking a sequence header already deselects any selected key photo. This is already correct.

3. **Deselect key photo on background click:** In `KeyPhotoStripInline` in `KeyPhotoStrip.tsx`, add an `onClick` handler to the strip container div that calls `sequenceStore.clearKeyPhotoSelection()` only when the click target is the container itself (not a child card). This handles clicking the empty background area of the key photo strip:
   ```
   onClick={(e) => {
     if (e.currentTarget === e.target) {
       sequenceStore.clearKeyPhotoSelection();
     }
   }}
   ```

4. **Also handle click on the sequence card background area in SequenceList.tsx:** In the `SequenceItem` component, the outer wrapper div (the rounded-lg one, line ~207) should also deselect key photos when clicked directly (not on the header row or key photo strip). Add an `onClick` handler to this outer div:
   ```
   onClick={(e) => {
     if (e.currentTarget === e.target) {
       sequenceStore.clearKeyPhotoSelection();
     }
   }}
   ```
   This covers clicking on any padding/gap area within the active sequence card.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>First key photo ring-2 border not clipped at top/left; clicking strip background, sequence header, or sequence card background deselects key photo selection.</done>
</task>

</tasks>

<verification>
- `cd Application && npx tsc --noEmit` passes with no type errors
- Visual: Open app, check View menu shows "Zoom In (+/=)" and "Zoom Out (-)"
- Visual: Multiple sequences in sidebar all display at same full opacity
- Visual: Select a key photo, then click the sequence header row -- key photo deselection clears
- Visual: First key photo with ring highlight shows full border on all sides (no clipping)
</verification>

<success_criteria>
- View > Zoom In menu label includes "+/=" shortcut hint
- View > Zoom Out menu label includes "-" shortcut hint
- Menu-triggered zoom is context-aware (timeline vs canvas based on mouse region)
- Non-selected sequences render at full opacity (no 0.5 transparency)
- Key photo ring-2 border visible on all 4 sides including first item
- Key photo can be deselected by clicking sequence header or strip background
</success_criteria>

<output>
After completion, create `.planning/quick/260318-lgi-small-fixes-add-shortcut-to-help-menu-re/260318-lgi-SUMMARY.md`
</output>
