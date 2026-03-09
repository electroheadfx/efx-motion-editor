---
status: diagnosed
phase: 03-project-sequence-management
source: 03-04-SUMMARY.md, 03-05-SUMMARY.md, 03-06-SUMMARY.md
started: 2026-03-09T13:00:00Z
updated: 2026-03-09T13:50:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Welcome Screen Recent Projects
expected: On app launch, WelcomeScreen shows recent projects with readable text contrast (names in light color, dates visible). Projects saved to user directories (e.g. ~/Documents) show as available. Clicking an available project opens it.
result: pass

### 2. Delete 3rd+ Sequence
expected: Create or duplicate sequences until you have 3+. Right-click the 3rd (or later) sequence and click Delete. It should be removed successfully.
result: issue
reported: "Third sequence can be deleted fine but it has a UI issue — context menu opens a scrollbar in the sequence list container. It's a z-index/overflow problem with the menu rendering inside the scrollable area."
severity: minor

### 3. Reorder Sequences via Drag
expected: With 2+ sequences, drag a sequence by its handle to a new position. On drop, the new order persists — the sequence stays where you dropped it.
result: issue
reported: "Can reorder sequences from the timeline in main window, but not from the sequences list in the left sidebar. Drag-and-drop reorder doesn't work in the sidebar."
severity: major

### 4. Add Multiple Key Photos
expected: Select a sequence. Click Add key photo button — popover opens upward with a 4-column image grid. Add a first image. Click Add again — popover opens and you can add a 2nd, 3rd, etc. key photo without issues.
result: issue
reported: "Can add multiple key photos but the key photo strip area is too compact and not acceptable UX. Scrollbar is awkward in the small space. Suggests removing visible scrollbar and using horizontal mouse-wheel scroll instead. The key photo area is very small overall."
severity: minor

### 5. Reorder Key Photos via Drag
expected: With 2+ key photos in a sequence, drag one to a new position in the horizontal strip. On drop, the new order persists.
result: issue
reported: "Drag-and-drop reorder doesn't work at all in the sidebar. Drag-and-drop reorder works only in main window sequences. In the small sidebar space drag-and-drop is impractical — suggests click-to-select + arrow keys to move key photos left/right instead."
severity: major

### 6. Internal Drag Does Not Trigger Import Overlay
expected: When dragging sequences or key photos to reorder, the file import drop zone overlay does NOT appear. Only dragging real files from the OS file manager should trigger it.
result: pass

## Summary

total: 6
passed: 2
issues: 4
pending: 0
skipped: 0

## Gaps

- truth: "Context menu renders without causing scrollbar in the sequence list"
  status: failed
  reason: "User reported: context menu opens a scrollbar in the sequence list container — z-index/overflow problem"
  severity: minor
  test: 2
  root_cause: "Context menu uses position: absolute inside overflow-y: auto container. Absolute positioning does not escape overflow — menu extends beyond visible bounds, expanding scroll height."
  artifacts:
    - path: "Application/src/components/sequence/SequenceList.tsx"
      issue: "Line 233: context menu positioned with absolute inside overflow-constrained parent (line 38: overflow-y-auto)"
  missing:
    - "Use createPortal from preact/compat to render context menu into document.body with position: fixed and getBoundingClientRect coordinates"
  debug_session: ".planning/debug/sequencelist-context-menu-scrollbar.md"

- truth: "Sequences can be dragged to reorder in the left sidebar"
  status: failed
  reason: "User reported: drag-and-drop reorder doesn't work in the sidebar sequences list, only works from timeline in main window"
  severity: major
  test: 3
  root_cause: "Tauri v2 dragDropEnabled defaults to true, intercepting native HTML5 DnD events at the WebView level. SortableJS uses native HTML5 DnD by default (nativeDraggable=true). Tauri swallows the events so onEnd never fires properly. Timeline works because it uses Canvas pointer events, not HTML5 DnD."
  artifacts:
    - path: "Application/src/components/sequence/SequenceList.tsx"
      issue: "SortableJS missing forceFallback: true — uses native HTML5 DnD which Tauri intercepts"
    - path: "Application/src-tauri/tauri.conf.json"
      issue: "No dragDropEnabled setting; Tauri v2 defaults to true, intercepting HTML5 DnD"
  missing:
    - "Add forceFallback: true to Sortable.create options in SequenceList.tsx to bypass HTML5 DnD and use CSS transform + pointer events instead"
  debug_session: ".planning/debug/sequence-list-dnd-reorder.md"

- truth: "Key photo strip has usable UX with adequate space and smooth scrolling"
  status: failed
  reason: "User reported: key photo strip area is too compact, scrollbar is awkward. Suggests horizontal mouse-wheel scroll and more space"
  severity: minor
  test: 4
  root_cause: "Key photo thumbnails hardcoded at 64x48px (w-16 h-12) inside 268px-wide panel with visible native scrollbar consuming vertical space and no horizontal wheel-scroll support."
  artifacts:
    - path: "Application/src/components/sequence/KeyPhotoStrip.tsx"
      issue: "Line 123: w-16 h-12 (64x48px) thumbnails too small; Line 69: overflow-x-auto with visible scrollbar; no onWheel handler for horizontal scroll"
    - path: "Application/src/index.css"
      issue: "No scrollbar-hiding utility classes defined"
  missing:
    - "Increase thumbnail size from w-16 h-12 to w-20 h-14 or w-24 h-16"
    - "Add CSS scrollbar-hidden utility (scrollbar-width: none + ::-webkit-scrollbar { display: none })"
    - "Add onWheel handler to convert vertical scroll to horizontal scrollLeft"
  debug_session: ".planning/debug/keyphotostrip-ux-issues.md"

- truth: "Key photos can be reordered in the sidebar strip"
  status: failed
  reason: "User reported: drag-and-drop reorder doesn't work in sidebar. Suggests click-to-select + arrow keys instead of drag-and-drop in small space"
  severity: major
  test: 5
  root_cause: "Same Tauri HTML5 DnD interception as sequence drag (missing forceFallback: true), compounded by horizontal scroll container conflicting with horizontal drag, and tiny 64x48px cards with no drag handle leaving no clean drag surface."
  artifacts:
    - path: "Application/src/components/sequence/KeyPhotoStrip.tsx"
      issue: "Lines 49-63: SortableJS missing forceFallback: true; overflow-x-auto conflicts with horizontal drag; no drag handle on tiny cards"
  missing:
    - "Replace SortableJS drag-and-drop with click-to-select + arrow key reorder: click selects card (ring border), Left/Right arrows move selected card one position. Remove SortableJS from this component."
  debug_session: ".planning/debug/keyphotstrip-dnd-broken.md"
