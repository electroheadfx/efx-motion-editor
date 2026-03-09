---
status: resolved
trigger: "Context menu in SequenceList causes scrollbar to appear"
created: 2026-03-09T00:00:00Z
updated: 2026-03-09T00:00:00Z
---

## Current Focus

hypothesis: Context menu uses position:absolute inside an overflow-y:auto container, expanding scrollable content
test: Inspect SequenceList container overflow and context menu positioning
expecting: Menu renders inside scrollable div, pushing content height
next_action: Return diagnosis

## Symptoms

expected: Right-click context menu appears as a floating overlay without affecting scroll
actual: Context menu renders inside overflow-y-auto container, causing a scrollbar to appear
errors: None (visual bug)
reproduction: Right-click any sequence item in the list
started: Since context menu was implemented

## Eliminated

(none needed - root cause identified on first pass)

## Evidence

- timestamp: 2026-03-09
  checked: SequenceList.tsx line 38
  found: Container div has class "overflow-y-auto" — this clips/scrolls any children that exceed bounds
  implication: Absolute-positioned children still participate in scroll height of overflow containers

- timestamp: 2026-03-09
  checked: SequenceList.tsx line 233-265
  found: Context menu uses "absolute right-2 top-9 z-50" — position:absolute relative to SequenceItem (which has class "relative")
  implication: position:absolute is relative to nearest positioned ancestor (the SequenceItem div), but crucially the menu still lives inside the overflow-y-auto scroll container. The menu's bottom edge extends below the container boundary, triggering a scrollbar.

- timestamp: 2026-03-09
  checked: LeftPanel.tsx line 38
  found: SequenceList is rendered directly inside the LeftPanel flex column with no overflow isolation
  implication: The overflow-y-auto on the SequenceList container is the clipping boundary

## Resolution

root_cause: Context menu uses `position: absolute` inside an `overflow-y: auto` container (SequenceList). Absolute positioning does NOT escape overflow containers — the menu element still contributes to the scrollable content area, causing the scrollbar to appear when the menu extends beyond the container bounds.
fix: Use `position: fixed` with calculated viewport coordinates, OR render the context menu through a Preact portal (createPortal) to document.body so it escapes the overflow container entirely.
verification: (pending)
files_changed: []
