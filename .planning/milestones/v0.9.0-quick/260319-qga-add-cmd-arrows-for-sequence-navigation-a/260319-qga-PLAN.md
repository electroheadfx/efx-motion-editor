---
phase: quick-41
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - Application/src/lib/shortcuts.ts
  - Application/src/components/overlay/ShortcutsOverlay.tsx
autonomous: true
requirements: [NAV-CMD-ARROWS]

must_haves:
  truths:
    - "Cmd+Left jumps playhead to previous sequence start (same as PageUp)"
    - "Cmd+Right jumps playhead to next sequence start (same as PageDown)"
    - "Cmd+Shift+Left jumps playhead to frame 0 (same as Home)"
    - "Cmd+Shift+Right jumps playhead to last frame (same as End)"
    - "Shortcuts overlay shows the new Cmd+Arrow bindings in Navigation section"
  artifacts:
    - path: "Application/src/lib/shortcuts.ts"
      provides: "Cmd+Arrow and Cmd+Shift+Arrow shortcut bindings"
      contains: "$mod+ArrowLeft"
    - path: "Application/src/components/overlay/ShortcutsOverlay.tsx"
      provides: "Updated navigation section with new shortcut hints"
  key_links:
    - from: "Application/src/lib/shortcuts.ts"
      to: "Application/src/lib/sequenceNav.ts"
      via: "findPrevSequenceStart / findNextSequenceStart calls"
      pattern: "find(Prev|Next)SequenceStart"
---

<objective>
Add Cmd+Arrow keyboard shortcuts for sequence navigation and timeline start/end, targeting laptop users without extended keyboards (no Home/End/PageUp/PageDown keys).

Purpose: Laptop users currently have no way to jump between sequences or to timeline boundaries because those shortcuts require keys that only exist on extended keyboards.
Output: Four new Cmd+Arrow shortcuts in shortcuts.ts and updated ShortcutsOverlay hints.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/get-shit-done/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@Application/src/lib/shortcuts.ts
@Application/src/lib/sequenceNav.ts
@Application/src/components/overlay/ShortcutsOverlay.tsx

<interfaces>
From Application/src/lib/sequenceNav.ts:
```typescript
export function findPrevSequenceStart(layouts: TrackLayout[], currentFrame: number): number | null;
export function findNextSequenceStart(layouts: TrackLayout[], currentFrame: number): number | null;
```

From Application/src/lib/shortcuts.ts (existing patterns used by Home/End/PageUp/PageDown):
```typescript
// Home → seekToFrame(0)
// End → seekToFrame(Math.max(0, totalFrames - 1))
// PageUp → findPrevSequenceStart(trackLayouts.peek(), currentFrame) ?? seekToFrame(0)
// PageDown → findNextSequenceStart(trackLayouts.peek(), currentFrame) ?? seekToFrame(lastFrame)
```

ShortcutsOverlay Navigation section (lines 44-52):
```typescript
{
  title: 'Navigation',
  entries: [
    {keys: 'Home', description: 'Go to start of timeline'},
    {keys: 'End', description: 'Go to end of timeline'},
    {keys: 'PgUp', description: 'Jump to previous sequence'},
    {keys: 'PgDn', description: 'Jump to next sequence'},
    {keys: '\u21E7\u2318T', description: 'Cycle theme'},
    {keys: '?', description: 'Toggle this help'},
  ],
},
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Cmd+Arrow shortcut bindings for sequence navigation and timeline bounds</name>
  <files>Application/src/lib/shortcuts.ts</files>
  <action>
Add four new tinykeys bindings in the `mountShortcuts` function, placed immediately after the existing PageDown handler (line ~452, before the closing `});`):

1. `'$mod+ArrowLeft'` — same logic as PageUp: calls `findPrevSequenceStart(trackLayouts.peek(), timelineStore.currentFrame.peek())`, seeks to result or frame 0 as fallback.

2. `'$mod+ArrowRight'` — same logic as PageDown: calls `findNextSequenceStart(trackLayouts.peek(), timelineStore.currentFrame.peek())`, seeks to result or last frame as fallback.

3. `'$mod+Shift+ArrowLeft'` — same logic as Home: `playbackEngine.seekToFrame(0)`.

4. `'$mod+Shift+ArrowRight'` — same logic as End: `playbackEngine.seekToFrame(Math.max(0, timelineStore.totalFrames.peek() - 1))`.

Each handler must follow the existing pattern:
- Check `shouldSuppressShortcut(e)` first
- Check `isFullscreen.peek()` guard
- Call `e.preventDefault()`
- Execute the navigation logic

IMPORTANT: These Cmd+Arrow combos must NOT conflict with the existing bare arrow handlers (lines 185-232) because tinykeys matches on modifier combinations — `$mod+ArrowLeft` is distinct from `ArrowLeft`. No existing bindings need to be changed.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor && grep -c '\$mod+Arrow' Application/src/lib/shortcuts.ts | grep -q '4' && echo "PASS: 4 Cmd+Arrow bindings found" || echo "FAIL"</automated>
  </verify>
  <done>Four new Cmd+Arrow bindings registered in shortcuts.ts, each with proper suppress/fullscreen guards, reusing existing sequenceNav functions and playbackEngine.seekToFrame.</done>
</task>

<task type="auto">
  <name>Task 2: Update ShortcutsOverlay with Cmd+Arrow hints in Navigation section</name>
  <files>Application/src/components/overlay/ShortcutsOverlay.tsx</files>
  <action>
In the `SHORTCUT_GROUPS` array, update the Navigation group (title: 'Navigation') entries to include the new Cmd+Arrow shortcuts alongside the existing keys. Update the entries array to be:

```typescript
{keys: 'Home / \u2318\u2190', description: 'Go to start of timeline'},
{keys: 'End / \u2318\u21E7\u2192', description: 'Go to end of timeline'},
```

Wait — re-reading the user request: Cmd+Arrows = sequence navigation, Cmd+Shift+Arrows = timeline start/end. So the mapping is:

- `Cmd+Left` / `Cmd+Right` = sequence navigation (like PgUp/PgDn)
- `Cmd+Shift+Left` / `Cmd+Shift+Right` = timeline start/end (like Home/End)

Update entries to show both key options separated by " / ":

```typescript
{keys: 'Home / \u21E7\u2318\u2190', description: 'Go to start of timeline'},
{keys: 'End / \u21E7\u2318\u2192', description: 'Go to end of timeline'},
{keys: 'PgUp / \u2318\u2190', description: 'Jump to previous sequence'},
{keys: 'PgDn / \u2318\u2192', description: 'Jump to next sequence'},
```

Unicode references: \u2318 = Cmd, \u21E7 = Shift, \u2190 = left arrow, \u2192 = right arrow.

Keep the remaining Navigation entries (Cycle theme, Toggle help) unchanged.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor && grep -c '\u2318\u2190\|\u2318\u2192' Application/src/components/overlay/ShortcutsOverlay.tsx | grep -qE '[2-4]' && echo "PASS: Cmd+Arrow hints in overlay" || echo "FAIL"</automated>
  </verify>
  <done>Navigation section of ShortcutsOverlay shows both extended keyboard keys (Home/End/PgUp/PgDn) and Cmd+Arrow alternatives side by side for each navigation action.</done>
</task>

</tasks>

<verification>
1. Open the app, hover over the timeline, press Cmd+Right — playhead jumps to the start of the next sequence
2. Press Cmd+Left — playhead jumps to start of current or previous sequence
3. Press Cmd+Shift+Left — playhead jumps to frame 0
4. Press Cmd+Shift+Right — playhead jumps to last frame
5. Press ? to open shortcuts overlay, check Navigation tab shows Cmd+Arrow hints
6. Verify bare arrow keys still work as before (scrub in timeline, nudge on canvas)
</verification>

<success_criteria>
- All four Cmd+Arrow shortcuts work for sequence navigation and timeline bounds
- Existing arrow key behavior unchanged (no regressions in scrub/nudge)
- Shortcuts overlay documents the new bindings alongside existing Home/End/PgUp/PgDn
</success_criteria>

<output>
After completion, create `.planning/quick/260319-qga-add-cmd-arrows-for-sequence-navigation-a/260319-qga-SUMMARY.md`
</output>
