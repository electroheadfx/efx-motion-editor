# Phase 13: Sequence Fade In/Out - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a Transition FX system with three transition types on sequences and FX layers:
- **Fade In / Fade Out** — applies to sequences and FX layers, to/from transparency or solid color
- **Cross Dissolve** — between sequences only, blends one into the next during an overlap zone

Transitions are visual objects rendered ON the sequence/FX bar on the timeline — selectable, deletable, with DaVinci Resolve-style transparent overlay graphic. Properties editable in sidebar.

</domain>

<decisions>
## Implementation Decisions

### Transition object model
- **D-01:** Transitions are overlay objects rendered ON sequences/FX bars — not on a separate track
- **D-02:** Three transition types: Fade In, Fade Out, Cross Dissolve
- **D-03:** Fade In/Out applies to both sequences and FX layers; Cross Dissolve is sequences-only
- **D-04:** Each transition stores: type, duration (frames), mode (transparency/solid), color (when solid), curve (easing)

### Timeline visual style (DaVinci Resolve-inspired)
- **D-05:** Transparent overlay with white outline border + single diagonal line — content (thumbnails, pink boundary marker) visible underneath
- **D-06:** Fade In: diagonal from bottom-left to top-right, graduated transparency dark→clear (left to right)
- **D-07:** Fade Out: diagonal from top-left to bottom-right, graduated transparency clear→dark (left to right)
- **D-08:** Cross Dissolve: single diagonal from bottom-left to top-right, two triangular transparency zones (left triangle slightly darker = outgoing, right triangle lighter = incoming)
- **D-09:** Pink boundary marker renders BEHIND the cross dissolve overlay but is visible through transparency
- **D-10:** Transition objects are selectable (click) and deletable (Delete key)
- **D-11:** Transition labels: "In" on fade in, "Out" on fade out, "Cross Dissolve" on cross dissolve

### Cross dissolve mechanics
- **D-12:** Cross dissolve creates an overlap zone — Seq 2 slides left to overlap Seq 1 by the dissolve duration
- **D-13:** During overlap: Seq 1 opacity ramps 100%→0% while Seq 2 ramps 0%→100% with cubic easing
- **D-14:** Total timeline duration SHORTENS by the overlap amount (no extra frames created)
- **D-15:** Cross dissolve is centered on the original sequence boundary (pink marker stays at center)

### Fade rendering
- **D-16:** Fade supports two modes: opacity fade (for transparent PNG+alpha export) and solid color fade (configurable color, default black)
- **D-17:** Natural cubic interpolation for all transition curves (reuse existing `applyEasing` from keyframeEngine.ts)
- **D-18:** Fade is visible in real-time preview playback and correctly rendered in PNG export

### Sequence name handling
- **D-19:** Sequence names render at bottom-left of the sequence bar (existing behavior)
- **D-20:** When fade in is present at sequence start, name shifts right past the transition object
- **D-21:** Short sequences clip or hide the name when too narrow (natural CSS/canvas overflow)

### Sidebar properties (when transition selected)
- **D-22:** Duration — NumericInput in frames (reuse existing NumericInput component)
- **D-23:** Mode — Toggle: Transparency / Solid Color (fade in/out only)
- **D-24:** Color — Color picker, visible only in Solid mode, default black (fade in/out only)
- **D-25:** Curve — Dropdown: Linear / Ease In / Ease Out / Ease In-Out (reuse existing EasingType)
- **D-26:** Cross dissolve sidebar shows Duration and Curve only (always opacity-based, no mode/color)

### Claude's Discretion
- Transition data structure details (property on Sequence vs standalone store)
- Timeline Canvas 2D rendering implementation for diagonal/gradient
- Hit testing approach for transition click targets
- .mce format version bump strategy for transition persistence
- How user adds a transition (context menu, drag from palette, button)

</decisions>

<specifics>
## Specific Ideas

- "Inspire from DaVinci Resolve" — transparent overlay, single diagonal, white outline border
- Cross dissolve should show the pink vertical boundary line through its transparency
- Fade gradient is horizontal (left-to-right or right-to-left), not vertical
- Labels on transitions: "In", "Out", "Cross Dissolve"
- Transition is a new FX system — not just properties on sequences

</specifics>

<canonical_refs>
## Canonical References

### Design reference images
- `.planning/phases/13-sequence-fade-in-out/design/final-design-overview.png` — Full design spec: fade in/out, cross dissolve, short sequence name behavior
- `.planning/phases/13-sequence-fade-in-out/design/fade-in-out-detail.png` — Fade In + Fade Out visual style on sequence with thumbnails
- `.planning/phases/13-sequence-fade-in-out/design/cross-dissolve-detail.png` — Cross dissolve centered on pink marker, transparent overlay
- `.planning/phases/13-sequence-fade-in-out/design/short-sequences.png` — Name clipping behavior at various sequence widths

### Pencil source file
- `pencil-new.pen` — Pencil MCP design file with all transition mockups (nodes: `j6cLR`, `HNWH7`, `iBef0`, `q6zwI`)

### Existing code to build on
- `Application/src/lib/keyframeEngine.ts` — `applyEasing()` and `lerp()` functions for cubic interpolation curves
- `Application/src/lib/previewRenderer.ts` — Canvas 2D compositing engine, `renderFrame()` with blend modes and opacity
- `Application/src/components/Preview.tsx` — Frame compositing pipeline: content sequence → overlay sequences (FX + content-overlay)
- `Application/src/types/sequence.ts` — `Sequence` interface (needs fade/transition properties)
- `Application/src/types/project.ts` — `MceSequence` interface (.mce file format, needs version bump)
- `Application/src/components/timeline/TimelineRenderer.ts` — Canvas 2D timeline rendering (needs transition overlay drawing)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `keyframeEngine.ts` — `applyEasing(t, easing)` with linear/ease-in/ease-out/ease-in-out curves, `lerp()` — directly reusable for fade interpolation
- `NumericInput` component in `shared/` — reuse for duration input in sidebar properties
- `EasingType` union type — reuse for transition curve selection
- `PreviewRenderer.renderFrame()` — already handles `globalAlpha` per layer, can be extended for sequence-level opacity

### Established Patterns
- FX sequences use `inFrame/outFrame` for temporal range — transitions can follow similar pattern
- Overlay compositing: `Preview.tsx` iterates overlay sequences in reverse order with `clearCanvas=false` — fade needs to modify the content sequence's composite before overlays
- Timeline Canvas 2D rendering: `TimelineRenderer.ts` draws tracks, thumbnails, range bars — transition overlay would be drawn on top of existing sequence bars
- Signal store pattern: transition state could extend `sequenceStore` or live in a new store

### Integration Points
- `Preview.tsx renderFromFrameMap()` — fade opacity must be applied here during compositing
- `TimelineRenderer` — needs to draw transition overlays (diagonal + border) on top of sequence bars
- `TimelineInteraction` — needs hit testing for transition click/selection
- `projectStore` save/load — needs serialization of transition data in .mce format
- Sidebar properties — needs new `TransitionProperties` component when a transition is selected

</code_context>

<deferred>
## Deferred Ideas

- Phase 14 (Cross-Sequence Transitions) may overlap with the cross dissolve implemented here — reconcile scope during Phase 14 planning
- Drag-to-resize transition duration on timeline — could be added as enhancement
- Transition presets/favorites — future phase
- Wipe transitions (directional wipe, iris wipe) — future transition types

</deferred>

---

*Phase: 13-sequence-fade-in-out*
*Context gathered: 2026-03-20*
