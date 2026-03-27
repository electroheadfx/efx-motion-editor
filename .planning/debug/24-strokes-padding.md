---
status: investigating
trigger: "STROKES section has left padding misalignment with other sections like SELECTION, BRUSH, ONION"
created: 2026-03-27T16:35:00Z
updated: 2026-03-27T16:35:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: "CollapsibleSection header has `px-3` left padding causing 12px indentation vs SectionLabel at 0px"
test: "Read CollapsibleSection.tsx header class and SectionLabel.tsx structure"
expecting: "If SectionLabel has no container (0px left) but CollapsibleSection header has px-3 (12px left), this explains misalignment"
next_action: "Confirm by comparing rendered structure in browser"

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: STROKES section header aligns left padding with SELECTION, BRUSH, ONION section labels
actual: User reported STROKES section appears with different left padding than other sections
errors: none (cosmetic/layout issue)
reproduction: Draw strokes, switch to select mode (S key), observe STROKES section header alignment
started: Discovered during UAT Test 1

## Eliminated
<!-- APPEND only - prevents re-investigating -->

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-03-27T16:35:00Z
  checked: "CollapsibleSection.tsx header div"
  found: "Header has class `flex items-center justify-between h-9 px-3 cursor-pointer select-none shrink-0` - px-3 applies 12px left AND right padding"
  implication: "CollapsibleSection header content is indented 12px from left edge"

- timestamp: 2026-03-27T16:35:00Z
  checked: "SectionLabel.tsx component"
  found: "Returns a bare `<span>` with inline styles (font-size, font-weight, letter-spacing, color) - NO container wrapper, NO padding"
  implication: "SectionLabel text sits directly at 0px from left edge of its container"

- timestamp: 2026-03-27T16:35:00Z
  checked: "PaintProperties.tsx section structure"
  found: "BRUSH, SELECTION, SHAPE, FILL sections use `<SectionLabel text=\"X\" />` directly (0px left padding), while STROKES uses `<StrokeList>` which wraps CollapsibleSection (12px left padding)"
  implication: "STROKES header indented 12px from left, other section labels at 0px - causes visual misalignment"

- timestamp: 2026-03-27T16:35:00Z
  checked: "ONION section structure"
  found: "Uses `<button class=\"flex items-center gap-1 cursor-pointer w-full\">` with inline chevron and SectionLabel inside - no px-3 padding, sits at 0px left"
  implication: "ONION also at 0px left, confirms pattern: only STROKES (via CollapsibleSection) has 12px indentation"

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: "CollapsibleSection.tsx header div applies `px-3` (12px left padding) while SectionLabel has no container (0px padding). This causes STROKES section header to appear indented 12px from the left edge while SELECTION, BRUSH, ONION labels appear at the left edge."
fix: ""
verification: ""
files_changed: []
