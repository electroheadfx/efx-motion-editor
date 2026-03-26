---
status: resolved
trigger: "Isolation mode: add layer goes to sequence internal layers instead of timeline"
created: 2026-03-26T00:00:00Z
updated: 2026-03-26T00:00:00Z
---

## Current Focus

hypothesis: addLayerToSequence pushes layer into seq.layers (key photo layers array) instead of creating a new timeline-level sequence aligned with the isolated sequence's in/out range
test: confirmed by reading sequenceStore.addLayerToSequence implementation
expecting: confirmed
next_action: return structured diagnosis

## Symptoms

expected: When isolation is active and user adds a layer (from sidebar AddLayerMenu or timeline AddFxMenu), a NEW timeline-level sequence should be created, time-aligned (inFrame/outFrame matching the isolated sequence's range), appearing as its own row in the timeline
actual: Layer gets added into the isolated sequence's internal layers[] array (alongside its base "Key Photos" layer), appearing as a sub-layer of that sequence instead of a timeline-level entry
errors: none (silent wrong behavior)
reproduction: 1) Isolate a content sequence, 2) Click Add Layer from either sidebar or timeline, 3) Add any FX/content/paint layer -- layer appears inside sequence layers, not as timeline entry
started: introduced in phase 22-02

## Eliminated

(none -- root cause found on first hypothesis)

## Evidence

- timestamp: 2026-03-26T00:01:00Z
  checked: sequenceStore.addLayerToSequence (line 643-662)
  found: Method pushes layer into seq.layers array of the TARGET sequence. `sequences.value.map(s => s.id === sequenceId ? {...s, layers: [...s.layers, layer]} : s)`. This adds to the sequence's INTERNAL layers (same array as the base layer), NOT as a new timeline-level sequence.
  implication: This is the root cause. The method name "addLayerToSequence" is misleading -- it adds a layer INSIDE the sequence, not a new timeline-aligned sequence.

- timestamp: 2026-03-26T00:02:00Z
  checked: Sequence type definition (types/sequence.ts)
  found: Sequence.layers[] is "Ordered bottom-to-top; layers[0] is always the base layer". For content sequences, layers are key-photo-level sub-layers. Timeline-level items are separate Sequence objects with kind='fx' or 'content-overlay' and their own inFrame/outFrame.
  implication: To add a timeline-level layer aligned with an isolated sequence, we need to CREATE A NEW SEQUENCE (fx or content-overlay) with inFrame/outFrame matching the isolated content sequence's frame range.

- timestamp: 2026-03-26T00:03:00Z
  checked: createFxSequence and createContentOverlaySequence in sequenceStore
  found: Both create NEW Sequence objects with their own inFrame/outFrame and add them to the sequences[] array (timeline-level). createFxSequence sets inFrame=0, outFrame=totalFrames. These appear as independent timeline rows.
  implication: The correct approach for isolation-scoped creation is to use createFxSequence/createContentOverlaySequence but set inFrame/outFrame to match the isolated sequence's range instead of 0-to-totalFrames.

- timestamp: 2026-03-26T00:04:00Z
  checked: Timeline AddFxMenu.tsx isolation flow (line 60-64)
  found: When targetSequenceId is set, `sequenceStore.addLayerToSequence(targetSequenceId, fxLayer)` is called. This pushes the FX layer INTO the content sequence's layers[], making it a sub-layer of the content sequence rather than its own timeline-level FX sequence.
  implication: Same wrong call. Should create a new FX sequence with inFrame/outFrame aligned to the isolated sequence.

- timestamp: 2026-03-26T00:05:00Z
  checked: ImportedView.tsx isolation flow (lines 95-108, 161-174, 229-244)
  found: All three content-type handlers (static-image, video, image-sequence) call `sequenceStore.addLayerToSequence(currentIntent.targetSequenceId, layer)` when targetSequenceId is set. Same problem -- pushes content layer INTO the content sequence's layers[] instead of creating a content-overlay sequence.
  implication: Same root cause in all content layer creation paths.

- timestamp: 2026-03-26T00:06:00Z
  checked: AddLayerMenu.tsx (sidebar) -- "Adding to:" indicator color (line 76)
  found: Uses class `text-(--color-accent)`. CSS variable --color-accent is defined as #2D5BE3 (dark blue) in the dark theme. This is unreadable on a dark background.
  implication: Should use a warm yellow/orange color like #F59E0B or #F97316 instead of the accent blue.

- timestamp: 2026-03-26T00:07:00Z
  checked: AddFxMenu.tsx (timeline) -- "Adding to:" indicator color (line 124)
  found: Same class `text-(--color-accent)` -- same unreadable blue text on dark background.
  implication: Both menus need the color fix.

- timestamp: 2026-03-26T00:08:00Z
  checked: How to compute correct inFrame/outFrame for the new timeline sequence
  found: Content sequences don't have inFrame/outFrame -- they are positioned by the frame map (cumulative keyPhoto holdFrames). Need to compute the content sequence's start/end frame from the frameMap or totalFrames of that specific sequence.
  implication: Fix needs to determine the isolated content sequence's frame range to set on the new FX/overlay sequence.

## Resolution

root_cause: |
  `addLayerToSequence()` pushes a layer into a sequence's internal `layers[]` array (key photo sub-layers),
  which is fundamentally wrong for the isolation use case. The user's intent is to create a NEW timeline-level
  sequence (kind='fx' or kind='content-overlay') that is time-aligned (inFrame/outFrame) with the isolated
  content sequence. Instead, layers end up as sub-layers inside the content sequence (next to the base "Key Photos"
  layer), which is invisible in the timeline and renders in the wrong compositing context.

  The method `addLayerToSequence` itself is not conceptually wrong for internal layer operations, but it was
  incorrectly used as the isolation-mode routing target in phase 22-02. The correct approach is to use
  `createFxSequence()` / `createContentOverlaySequence()` with the isolated sequence's frame range as
  inFrame/outFrame.

fix: (not yet applied)
verification: (not yet verified)
files_changed: []
