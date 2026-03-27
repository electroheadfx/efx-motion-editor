---
status: investigating
trigger: "STROKES section positioned after SELECTION and before BRUSH - per UAT gap, STROKES should be after SELECTION and before BRUSH"
created: 2026-03-27T16:35:00Z
updated: 2026-03-27T16:37:00Z
---

## Current Focus
hypothesis: The StrokeList is placed before SELECTION in PaintProperties.tsx per D-02 spec ("at top"), but the user expects STROKES AFTER SELECTION and BEFORE BRUSH per UAT report
test: Compare D-02 spec vs UAT expectation
expecting: D-02 says "at top (above SELECTION)" but user expects "after SELECTION"
next_action: Confirm root cause - spec interpretation mismatch

## Symptoms
expected: STROKES section positioned after SELECTION and before BRUSH (per UAT gap truth)
actual: STROKES section appears BEFORE SELECTION (at top of select-mode block)
reproduction: Switch to select tool, observe STROKES appears at top of properties panel before SELECTION section
started: Discovered during UAT

## Eliminated

## Evidence
- timestamp: 2026-03-27T16:35:00Z
  checked: PaintProperties.tsx lines 142-305 (select mode block)
  found: Lines 145-146 place `<StrokeList layerId={layer.id} />` BEFORE `<SectionLabel text="SELECTION" />` on line 148
  implication: StrokeList is at the TOP of the select-mode div, BEFORE SELECTION

- timestamp: 2026-03-27T16:36:00Z
  checked: 24-CONTEXT.md D-02 definition
  found: "D-02: STROKES section appears at the top of PaintProperties (above the existing Select All/Delete Selected row) when in select mode"
  implication: D-02 spec says STROKES should be ABOVE SELECTION (at top), which is what was implemented

- timestamp: 2026-03-27T16:36:00Z
  checked: 24-UAT.md gap for ordering issue
  found: Gap truth says "STROKES section positioned after SELECTION and before BRUSH" but reason says "per plan D-02 ordering" - D-02 actually says "at top (above SELECTION)"
  implication: User expectation (after SELECTION) contradicts D-02 spec (above SELECTION)

## Resolution
root_cause: "D-02 spec says 'STROKES at top of PaintProperties (above SELECTION)' - implementation correctly placed StrokeList before SELECTION section. However, the user expects STROKES AFTER SELECTION and BEFORE BRUSH, which is the opposite of what D-02 specifies. The implementation correctly followed the written spec, but the spec itself (D-02) contradicts the user's expected ordering."
fix: "Move `<StrokeList layerId={layer.id} />` from line 146 (before SELECTION SectionLabel) to after the SELECTION section content (after line 303's closing `</div>`) but before the 'Copy to Next Frame' section and BRUSH section. Specifically: close the first select-mode div after SELECTION content, insert StrokeList, then open a new div for Copy to Next Frame."
verification: ""
files_changed: ["Application/src/components/sidebar/PaintProperties.tsx"]
