---
status: diagnosed
trigger: "Dragging inside ColorPickerModal propagates to elements beneath, causing key solid cards to drag in background"
created: 2026-03-24T00:00:00Z
updated: 2026-03-24T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Two compounding issues cause drag propagation
test: Traced DOM hierarchy and event handling
expecting: N/A - root cause found
next_action: Report diagnosis

## Symptoms

expected: Dragging inside ColorPickerModal (e.g. selecting angle text, dragging color area) should only affect the modal
actual: Drag events propagate to elements beneath the modal, causing key solid cards to be dragged in background
errors: N/A (behavioral, not error)
reproduction: Open ColorPickerModal from a key solid card, then drag inside the modal (e.g. select angle text)
started: Unknown

## Eliminated

## Evidence

- timestamp: 2026-03-24T00:01:00Z
  checked: ColorPickerModal render site in KeyPhotoCard (KeyPhotoStrip.tsx line 434-449)
  found: ColorPickerModal is rendered INSIDE the KeyPhotoCard div, which is a direct child of the stripRef container that SortableJS manages
  implication: The modal's entire DOM tree (including the fixed-position overlay) is a descendant of a SortableJS-managed element

- timestamp: 2026-03-24T00:02:00Z
  checked: SortableJS configuration in KeyPhotoStripInline (KeyPhotoStrip.tsx lines 100-115)
  found: No `handle` or `filter` option is set. forceFallback=true is set. Compare to LayerList.tsx which uses handle='.layer-drag-handle' and SequenceList.tsx which uses handle='.seq-drag-handle'
  implication: SortableJS treats ANY mousedown/touchstart inside any direct child of stripRef as a drag-start trigger. There is no handle constraint and no filter to exclude modal elements.

- timestamp: 2026-03-24T00:03:00Z
  checked: ColorPickerModal event handling (ColorPickerModal.tsx lines 388-404)
  found: The modal's outer div (fixed inset-0 z-50) only has onClick={handleCancel}. The inner modal div only has onClick stopPropagation. The color area and hue slider have onPointerDown with stopPropagation (lines 219, 243). But there is NO onMouseDown stopPropagation on the modal wrapper — only onClick and onPointerDown on specific sub-elements.
  implication: SortableJS with forceFallback=true listens for mousedown (not pointerdown) on the container. The modal stops click and pointerdown on some elements, but does NOT stop mousedown propagation on the modal boundary itself.

- timestamp: 2026-03-24T00:04:00Z
  checked: Whether createPortal is used
  found: Neither KeyPhotoStrip.tsx nor ColorPickerModal.tsx imports or uses createPortal
  implication: Despite the comment "Color picker modal rendered at top level (fixed positioning)" (line 433), the modal is NOT rendered at the DOM top level. It is visually overlaid via CSS fixed positioning but remains a DOM descendant of the KeyPhotoCard, which is a child of the SortableJS container.

## Resolution

root_cause: Two compounding issues: (1) ColorPickerModal is rendered inside the KeyPhotoCard DOM tree without using createPortal, so it remains a DOM descendant of the SortableJS-managed stripRef container. (2) The SortableJS instance on KeyPhotoStripInline has NO `filter` or `handle` option, meaning ANY mousedown inside any child of stripRef triggers drag. SortableJS with forceFallback=true intercepts mousedown events at the container level before the modal's onClick/onPointerDown stopPropagation can prevent it (different event types). Result: dragging inside the color picker's gradient angle input, text fields, or any area that doesn't explicitly stopPropagation on mousedown causes SortableJS to initiate a card drag.
fix: Two possible approaches (either alone would fix it, both together is ideal): (A) Render ColorPickerModal via createPortal(modal, document.body) so it escapes the SortableJS container entirely — this is the cleanest fix. (B) Add a `filter` option to the SortableJS config to exclude modal elements, e.g. filter: '.fixed' or a custom class. A third complementary option: add onMouseDown={e => e.stopPropagation()} to the ColorPickerModal's outermost wrapper div, but this only helps if the modal stays in-tree. Approach (A) — portal — is the recommended primary fix because it also prevents any future event-type mismatches and is consistent with how the FramesPopover already uses fixed positioning but would similarly benefit from portaling.
verification:
files_changed: []
