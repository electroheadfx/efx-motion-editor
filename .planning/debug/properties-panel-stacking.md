---
status: diagnosed
trigger: "selecting different layers in the timeline stacks multiple property bars at the bottom instead of replacing"
created: 2026-03-13T00:00:00Z
updated: 2026-03-13T00:05:00Z
---

## Current Focus

hypothesis: CONFIRMED - SequenceList sidebar handleSelect does not clear layerStore.selectedLayerId, causing stale FX selection to persist
test: traced all selection code paths in sidebar vs timeline
expecting: sidebar sequence click should clear layer selection but does not
next_action: report diagnosis

## Symptoms

expected: Selecting a different layer replaces the bottom properties bar with the new layer's controls
actual: A new bottom bar with opacity appears stacked below the existing one when switching from blur layer to Sequence 1
errors: none
reproduction: Select a Blur FX layer in timeline, then click Sequence 1 in sidebar or timeline
started: After blur feature was added

## Eliminated

- hypothesis: Multiple PropertiesPanel instances mounted in DOM
  evidence: EditorShell.tsx line 45 renders exactly one PropertiesPanel. Grep confirms single import and usage.
  timestamp: 2026-03-13T00:01

- hypothesis: PropertiesPanel returns multiple elements or fragments
  evidence: All three return paths (lines 499, 517, 589) return a single root div with h-14. No fragments or wrappers.
  timestamp: 2026-03-13T00:02

- hypothesis: Second bottom-bar component exists elsewhere
  evidence: Searched all components for h-14 with bg-root -- only PropertiesPanel matches. DropZone returns null normally. CanvasArea bottom bar is inside the CanvasArea div.
  timestamp: 2026-03-13T00:03

- hypothesis: CSS positioning issue causing visual overlap
  evidence: No fixed/absolute/sticky positioning in layout components. PropertiesPanel is in normal flex flow with shrink-0.
  timestamp: 2026-03-13T00:04

## Evidence

- timestamp: 2026-03-13T00:01
  checked: EditorShell.tsx layout
  found: Only ONE PropertiesPanel instance rendered (line 45)
  implication: Stacking is NOT caused by multiple PropertiesPanel mounts

- timestamp: 2026-03-13T00:02
  checked: PropertiesPanel.tsx conditional rendering
  found: Three mutually exclusive return paths - no selected layer (placeholder), FX layer, content layer
  implication: Component always returns a single div, cannot stack from within

- timestamp: 2026-03-13T00:03
  checked: TimelineInteraction.ts content track header click (lines 263-294)
  found: Clicking a content sequence header calls sequenceStore.setActive() and layerStore.setSelected(null), clears selection
  implication: After clicking Sequence 1 in TIMELINE, selectedLayerId becomes null, PropertiesPanel shows placeholder

- timestamp: 2026-03-13T00:04
  checked: TimelineInteraction.ts content track body click (lines 303-317)
  found: Clicking content track body also calls layerStore.setSelected(null) and sequenceStore.setActive()
  implication: Same as above - timeline clicks clear selection correctly

- timestamp: 2026-03-13T00:05
  checked: SequenceList.tsx sidebar handleSelect (line 111-116)
  found: handleSelect calls uiStore.selectSequence() and sequenceStore.setActive() but does NOT call layerStore.setSelected(null) or uiStore.selectLayer(null)
  implication: CRITICAL - clicking Sequence 1 in SIDEBAR leaves FX layer selected in layerStore

- timestamp: 2026-03-13T00:06
  checked: LayerList.tsx handleSelect (line 97-100)
  found: Clicking a content layer calls layerStore.setSelected(layer.id) and uiStore.selectLayer(layer.id) -- correctly switches selection
  implication: Selecting "another layer" from sidebar correctly replaces selection, so PropertiesPanel switches from FX to content bar

- timestamp: 2026-03-13T00:07
  checked: PropertiesPanel.tsx signal subscriptions
  found: Component reads layerStore.selectedLayerId.value (line 484) and sequenceStore.sequences.value (line 489) -- both properly subscribe via @preact/signals auto-tracking
  implication: When layerStore.selectedLayerId changes, component re-renders. When it becomes null, component shows placeholder.

- timestamp: 2026-03-13T00:08
  checked: Layer ID uniqueness concern
  found: Base layers all use id "base" (types/layer.ts line 60). Multiple content sequences each have a layer with id "base". PropertiesPanel loop (line 489) finds FIRST match across all sequences, which may not be the active sequence.
  implication: When user selects base layer via sidebar, PropertiesPanel may show properties for wrong sequence's base layer (minor issue, not stacking cause)

- timestamp: 2026-03-13T00:09
  checked: @preact/signals v2.8.1 conditional rendering behavior
  found: Known GitHub issues (#486, #341, #120) with conditional rendering and signals. The auto-tracking integration can miss re-renders in edge cases with conditional returns.
  implication: Possible contributing factor -- if signal change does not trigger re-render, stale FX bar persists in DOM

## Resolution

root_cause: |
  PRIMARY: SequenceList.tsx handleSelect (line 111-116) does not clear layerStore.selectedLayerId
  when user clicks a content sequence in the sidebar. This leaves the FX layer selected, so
  PropertiesPanel continues showing the FX bar even after the user clicks away from the FX track.

  CONTRIBUTING: When the user then clicks a content layer (e.g., "Key Photos") in the LayerList
  sidebar, layerStore.setSelected("base") fires. PropertiesPanel re-renders and shows the content
  layer bar. But because the content bar has OPACITY controls (which the FX bar also has) and was
  just added, the transition from FX bar to content bar can appear as "stacking" if Preact's DOM
  reconciliation doesn't cleanly replace the old tree -- both the old FX children and new content
  children could briefly coexist in the same root div during reconciliation.

  SECONDARY: All base layers across sequences share id "base" (types/layer.ts:60). When
  PropertiesPanel searches for a layer by ID, it finds the first match across ALL sequences,
  which may not be the active sequence. This could cause the panel to show properties for a
  different sequence's base layer.

fix: |
  1. In SequenceList.tsx handleSelect (line 111-116), add layerStore.setSelected(null) and
     uiStore.selectLayer(null) to clear the FX layer selection when switching content sequences.
  2. Optionally add a key prop to the PropertiesPanel root divs (e.g., key={selectedId ?? 'none'})
     to force Preact to unmount/remount rather than patch, eliminating any reconciliation artifacts.
  3. In types/layer.ts createBaseLayer(), generate a unique ID (crypto.randomUUID()) instead of
     hardcoded "base" to prevent cross-sequence ID collisions.

verification:
files_changed: []
