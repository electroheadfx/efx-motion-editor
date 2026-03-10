---
status: diagnosed
trigger: "FX layers built at wrong architectural level - per-sequence layers instead of timeline-level sequences"
created: 2026-03-10T12:00:00Z
updated: 2026-03-10T12:30:00Z
---

## Current Focus

hypothesis: FX was implemented as Layer objects inside individual Sequences, but should be Sequence objects on the timeline that composite over all content sequences below them
test: Trace the full data model and rendering pipeline to confirm architectural mismatch
expecting: Every FX creation/render/display path operates within a single sequence scope
next_action: Return structured diagnosis

## Symptoms

expected: FX layers act as timeline-level sequences (like adjustment layers in After Effects/Premiere) that apply across ALL content sequences below them. In/Out frame controls appear on timeline sequences with visual range clipping on the timeline UI.
actual: FX layers are added inside individual sequences via layerStore.add -> sequenceStore.addLayer. They only affect the one sequence they belong to. In/Out controls are on per-layer properties panel.
errors: No runtime errors - architectural mismatch
reproduction: Add any FX layer from AddLayerMenu - it appears in the active sequence's layer list, not as a timeline track
started: Phase 07 initial implementation

## Eliminated

(none - root cause was immediately identifiable from architecture review)

## Evidence

- timestamp: 2026-03-10T12:05:00Z
  checked: AddLayerMenu.tsx handleAddFxLayer (line 290-309)
  found: Calls layerStore.add() which delegates to sequenceStore.addLayer() - adds FX as a Layer inside the active Sequence
  implication: FX creation path is per-sequence, not timeline-level

- timestamp: 2026-03-10T12:07:00Z
  checked: sequenceStore.ts addLayer (line 326-345)
  found: addLayer pushes to activeSequence.layers array - scoped to one sequence only
  implication: No mechanism exists to create timeline-level FX sequences

- timestamp: 2026-03-10T12:09:00Z
  checked: Sequence type (sequence.ts line 4-12)
  found: Sequence = { id, name, fps, width, height, keyPhotos, layers }. No type discriminator (content vs FX). No inFrame/outFrame on Sequence.
  implication: Sequence type has no concept of FX sequences or timeline-level range clipping

- timestamp: 2026-03-10T12:11:00Z
  checked: Preview.tsx renderCurrent (line 20-28)
  found: Gets layers from layerStore.layers (computed from active sequence only) and frames from activeSequenceFrames. Only renders the active sequence's layers.
  implication: Preview cannot composite FX across multiple sequences - only sees one sequence at a time

- timestamp: 2026-03-10T12:13:00Z
  checked: PreviewRenderer.ts renderFrame (line 69-164)
  found: Receives a single layers array and renders them in order. Has full generator/adjustment/content layer support. The rendering engine itself is capable - it just receives the wrong scope of layers.
  implication: Renderer is architecturally sound; the problem is upstream in what data it receives

- timestamp: 2026-03-10T12:15:00Z
  checked: frameMap.ts trackLayouts (line 46-71)
  found: Creates one TrackLayout per Sequence. Only renders keyPhotoRanges - no concept of FX tracks or layers within tracks on timeline.
  implication: Timeline has no way to show FX sequences as distinct tracks

- timestamp: 2026-03-10T12:17:00Z
  checked: TimelineRenderer.ts draw (line 90-244)
  found: Draws track rows from TrackLayout[], which only contain keyPhotoRanges. No rendering of layer-type tracks or FX range bars.
  implication: Timeline renderer cannot visualize FX sequences

- timestamp: 2026-03-10T12:19:00Z
  checked: Layer type inFrame/outFrame (layer.ts line 36-37)
  found: inFrame/outFrame are on the Layer interface, used in PreviewRenderer line 95-96 for per-layer filtering
  implication: Range clipping is per-layer within a sequence, not per-sequence on the timeline

- timestamp: 2026-03-10T12:21:00Z
  checked: PropertiesPanel.tsx InOutSection (line 288-312)
  found: In/Out controls shown in properties panel for FX layers, updating layer.inFrame/outFrame
  implication: Range control is on the wrong entity (Layer instead of Sequence)

## Resolution

root_cause: FX effects were implemented at the Layer level (inside individual Sequences) instead of at the Sequence level (as timeline-level tracks). The entire FX pipeline - creation, storage, rendering, and UI controls - operates within a single sequence's scope, when it should operate across all content sequences as timeline-level adjustment/overlay sequences.

fix: (not applied - diagnosis only)
verification: (not applicable)
files_changed: []
