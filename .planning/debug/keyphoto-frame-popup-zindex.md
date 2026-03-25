---
status: awaiting_human_verify
trigger: "keyphoto-frame-popup-zindex"
created: 2026-03-25T00:00:00Z
updated: 2026-03-25T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - FramesPopover renders inside KeyPhotoCard which has overflow-hidden + opacity stacking context, trapping fixed-position popover behind sibling DOM elements
test: Portal FramesPopover to document.body (same pattern as context menu in SequenceList.tsx line 386)
expecting: Popup renders above all sidebar content
next_action: Await human verification that the popup now renders above all sidebar content

## Symptoms

expected: When clicking to change the frame of a key photo in the sidebar, a popup with frame thumbnails should appear fully visible above all other sidebar content.
actual: The frame selection popup renders behind/under other sidebar elements (z-index issue). The popup with frame thumbnails (showing "1f", "2f", "4f" labels and an "Increase frames" tooltip) is partially obscured by other sequence items above it.
errors: No JS errors reported — purely visual z-index stacking issue.
reproduction: Click on the "change frame" button of a key photo in the sidebar sequence list. The popup appears but is visually behind neighboring sequence items.
started: Recurring issue — was fixed before but regressed.

## Eliminated

- hypothesis: FramesPopover has too-low z-index value
  evidence: Already has zIndex 9999 (fixed in commit 2b3e990). The issue is stacking context, not z-index value.
  timestamp: 2026-03-25

- hypothesis: FramesPopover uses absolute positioning trapped by overflow-hidden
  evidence: Already uses position:fixed (fixed in commit ac3b119). But fixed positioning still participates in ancestor stacking contexts.
  timestamp: 2026-03-25

## Evidence

- timestamp: 2026-03-25
  checked: KeyPhotoStrip.tsx FramesPopover component (lines 237-248)
  found: Uses position:fixed with zIndex:9999. Already fixed in commits ac3b119 and 2b3e990.
  implication: z-index value and positioning type are not the issue

- timestamp: 2026-03-25
  checked: KeyPhotoCard parent div (line 357-363 of KeyPhotoStrip.tsx)
  found: Has class "overflow-hidden" AND style "opacity: isActiveByFrame ? 1 : 0.7". opacity < 1 creates a new stacking context. Also, the SequenceItem wrapper (SequenceList.tsx line 233) has "overflow-hidden" class.
  implication: FramesPopover is trapped in a stacking context. Even with position:fixed and z-index:9999, it renders behind sibling elements that are later in DOM order.

- timestamp: 2026-03-25
  checked: SequenceList.tsx context menu (line 386)
  found: Context menu uses createPortal(menu, document.body) to escape stacking contexts. This is the correct pattern.
  implication: FramesPopover should use the same portal pattern to escape its parent stacking context.

- timestamp: 2026-03-25
  checked: Git history for previous z-index fixes
  found: Commits ac3b119 (fixed positioning) and 2b3e990 (z-index 9999) partially addressed this but didn't use portal. The regression indicates the fix was incomplete - stacking context issues weren't fully resolved.
  implication: Portal to document.body is the definitive fix, as it completely removes the element from the parent stacking context hierarchy.

## Resolution

root_cause: FramesPopover renders inside KeyPhotoCard which creates a stacking context (via opacity < 1 on inactive cards, and overflow-hidden on multiple parent containers). Even with position:fixed and zIndex:9999, the popover is confined to its ancestor stacking context and renders behind sibling SequenceItem elements that appear later in DOM order. Previous fixes (ac3b119, 2b3e990) addressed positioning and z-index but didn't escape the stacking context.
fix: Wrap FramesPopover in createPortal(popover, document.body) to render it outside the parent stacking context entirely, matching the pattern already used by the context menu in SequenceList.tsx.
verification: TypeScript compiles cleanly (pre-existing errors only). Awaiting human visual verification.
files_changed: [Application/src/components/sequence/KeyPhotoStrip.tsx]
