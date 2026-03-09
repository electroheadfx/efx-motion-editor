---
status: resolved
trigger: "sequence drag-and-drop reorder doesn't work in left sidebar SequenceList"
created: 2026-03-09T00:00:00Z
updated: 2026-03-09T00:10:00Z
---

## Current Focus

hypothesis: CONFIRMED - Tauri v2 dragDropEnabled defaults to true, intercepting native HTML5 drag-and-drop events that SortableJS requires in non-fallback mode
test: Checked tauri.conf.json for dragDropEnabled setting; checked SortableJS nativeDraggable detection; verified timeline uses Canvas pointer events not HTML5 DnD
expecting: Adding forceFallback: true to SortableJS config will make it use pointer events instead of HTML5 DnD, bypassing Tauri's interception
next_action: Return diagnosis

## Symptoms

expected: Dragging a sequence in the left sidebar should reorder the list
actual: Order does not update on drop; reverts to original position
errors: none reported
reproduction: Drag a sequence item in the left sidebar SequenceList
started: After plan 03-06 was implemented (DOM revert pattern was added)

## Eliminated

- hypothesis: DOM revert pattern is incorrect (wrong index calculation)
  evidence: Traced removeChild+insertBefore for all edge cases (0->2, 2->0, 0->1, 1->0 in 3-item list). Math is correct.
  timestamp: 2026-03-09T00:05:00Z

- hypothesis: sequenceStore.reorderSequences has a logic bug
  evidence: Splice logic is correct. Same method is called by TimelineInteraction.ts which works.
  timestamp: 2026-03-09T00:02:00Z

- hypothesis: Preact signals reactivity doesn't trigger re-render
  evidence: SequenceList reads sequences.value during render, subscribing to the signal. @preact/signals v2 creates an effect-based updater that calls setState on signal change. The re-render is deferred via microtask but will execute correctly.
  timestamp: 2026-03-09T00:06:00Z

- hypothesis: Preact shouldComponentUpdate prevents DOM node reordering
  evidence: @preact/signals overrides SCU. SequenceItem has HAS_HOOK_STATE (from useState), so SCU returns true. Even if it returned false, Preact's INSERT_VNODE mechanism handles DOM placement independently of child re-rendering.
  timestamp: 2026-03-09T00:07:00Z

- hypothesis: Stale closure in onEnd handler
  evidence: onEnd only uses oldIndex/newIndex from evt and sequenceStore (module-level import). No stale variables captured.
  timestamp: 2026-03-09T00:04:00Z

## Evidence

- timestamp: 2026-03-09T00:01:00Z
  checked: SequenceList.tsx SortableJS setup (lines 18-35)
  found: onEnd handler has proper DOM revert (removeChild + insertBefore) and calls sequenceStore.reorderSequences. useEffect deps are [sequences.length]. This all looks correct.
  implication: The SortableJS integration pattern itself is correct, matching KeyPhotoStrip

- timestamp: 2026-03-09T00:02:00Z
  checked: sequenceStore.reorderSequences (lines 138-155)
  found: Method does splice-based reorder on a new array, assigns to sequences.value, calls markDirty and pushAction. Logic is correct. Same method is called by TimelineInteraction (Canvas pointer events) which works.
  implication: Store method is correct; problem is in the drag mechanism, not the store

- timestamp: 2026-03-09T00:04:00Z
  checked: TimelineInteraction.ts drag reorder (the one that works)
  found: Uses Canvas-based mousedown/mousemove/mouseup pointer events. Calls same reorderSequences store method. Works because it doesn't use HTML5 drag-and-drop.
  implication: The difference between working (timeline) and broken (sidebar) is the event mechanism, not the store logic

- timestamp: 2026-03-09T00:08:00Z
  checked: SortableJS nativeDraggable detection (Sortable.js line 914, 1132)
  found: supportDraggable = 'draggable' in document.createElement('div') which is true in WebKit. nativeDraggable = options.forceFallback ? false : supportDraggable. Since forceFallback is not set, nativeDraggable is true.
  implication: SortableJS uses HTML5 DnD (dragstart/dragover/drop events) by default

- timestamp: 2026-03-09T00:08:30Z
  checked: SortableJS _triggerDragStart (line 1293-1298)
  found: For non-Firefox with nativeDraggable, sets dragEl.draggable=true and initiates native HTML5 drag protocol
  implication: The drag relies on browser HTML5 DnD events that can be intercepted

- timestamp: 2026-03-09T00:09:00Z
  checked: tauri.conf.json (Application/src-tauri/tauri.conf.json)
  found: No dragDropEnabled setting in window config. Tauri v2 defaults dragDropEnabled to true.
  implication: Tauri intercepts native HTML5 drag-and-drop events at the WebView level

- timestamp: 2026-03-09T00:09:30Z
  checked: Tauri v2 dragDropEnabled documentation and GitHub issues
  found: Issue #6695 confirms drag-and-drop not working in WebKit when dragDropEnabled is true. Issue #14373 confirms the flag means "Tauri's internal DnD system is enabled, DOM DnD is disabled." Default is true.
  implication: ROOT CAUSE CONFIRMED - SortableJS HTML5 DnD events are intercepted by Tauri's internal DnD system

## Resolution

root_cause: Tauri v2 defaults dragDropEnabled to true, which intercepts native HTML5 drag-and-drop events at the WebView level. SortableJS detects browser support for draggable and uses native HTML5 DnD by default (nativeDraggable=true). Since Tauri intercepts dragstart/dragover/drop events, SortableJS cannot complete the drag-and-drop operation. The timeline drag works because TimelineInteraction uses Canvas-based pointer events (mousedown/mousemove/mouseup), not HTML5 DnD.
fix: Add forceFallback: true to both SortableJS instances (SequenceList and KeyPhotoStrip). This makes SortableJS use pointer events (CSS transforms for the ghost) instead of HTML5 DnD, bypassing Tauri's interception entirely.
verification: Pending
files_changed:
  - Application/src/components/sequence/SequenceList.tsx
  - Application/src/components/sequence/KeyPhotoStrip.tsx
