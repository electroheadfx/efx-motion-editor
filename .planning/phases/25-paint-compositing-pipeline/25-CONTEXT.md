# Phase 25: Paint Compositing Pipeline - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver luma key compositing for paint layers: white background as luma key, luma invert mode for white paint strokes, non-destructive exit/entry to composite layer mode. Replaces "Show Seq BG" with Luma Key, removes background color setting.

</domain>

<decisions>
## Implementation Decisions

### Luma Key Mode (replaces Show Seq BG)
- **D-01:** Replace "Show Seq BG" checkbox with **Luma Key** toggle in PaintProperties
- **D-02:** White background is always the luma key — `paintBgColor` setting is removed (white is the key, always)
- **D-03:** Luma key is real-time during paint edit — white pixels = transparent = photo shows through
- **D-04:** Exit paint mode: layer becomes a normal compositable layer with blend mode + opacity
- **D-05:** Re-enter paint mode: can still edit strokes — changes update live (non-destructive)

### Luma Invert Mode
- **D-06:** Add **Luma Invert** option alongside Luma Key toggle
- **D-07:** When enabled: extract luma → convert to grayscale → invert
- **D-08:** Effect: black strokes on white BG → white strokes after invert
- **D-09:** This allows "white paint" strokes over photos — normally impossible since white = transparent

### Non-Destructive Workflow
- **D-10:** Exit paint mode: layer is a normal compositable layer (blend mode + opacity work)
- **D-11:** Re-enter paint mode: strokes remain editable, changes propagate live
- **D-12:** Use existing flatten/cache infrastructure (frame FX cache from Phase 5) for performance when needed

### Watercolor Constraint
- **D-13:** Watercolor brush style requires white background — soft edges achieved by opacity falloff to white
- **D-14:** White paint in watercolor = transparent (subtractive medium — white is paper, not pigment)
- **D-15:** User adds paper texture as separate image layer underneath paint layer if physical media appearance needed

### Removed Features (not in this phase)
- **D-16:** Background color setting removed — white is always the key
- **D-17:** Key color picker removed (white is the fixed key)
- **D-18:** Paper texture in paint layer removed — user uses image layer underneath instead
- **D-19:** Gray background (COMP-02) obsolete — white is the luma key

### Claude's Discretion
- Exact luma extraction algorithm (grayscale formula: luminance weights or simple average)
- Whether luma invert preview is live during paint or only on exit
- Flatten/cache trigger timing (exit paint, or explicit "flatten" action)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Paint rendering
- `Application/src/lib/paintRenderer.ts` — `renderPaintFrameWithBg()` renders paint to offscreen canvas
- `Application/src/stores/paintStore.ts` — `paintBgColor`, `paintMode`, `showSequenceOverlay` signals
- `Application/src/types/paint.ts` — PaintLayer, PaintFrame, PaintElement types

### Preview rendering (compositing point)
- `Application/src/lib/previewRenderer.ts` — Lines 280-318: paint layer composite with `showSequenceOverlay`; this is where luma key must be applied

### Existing FX cache (non-destructive flatten)
- `Application/src/lib/previewRenderer.ts` — `renderGlslFxImage()` with frame cache invalidation
- `Application/src/stores/paintStore.ts` — `invalidateFrameFxCache()`, `_notifyVisualChange()`

### Requirements
- `.planning/REQUIREMENTS.md` — COMP-01, COMP-02, COMP-03, COMP-04, COMP-05 requirements (COMP-02-05 addressed differently)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `paintBgColor` signal: currently stores background color — must be removed or ignored
- `showSequenceOverlay` signal: "Show Seq BG" checkbox — replaced by Luma Key toggle
- `paintMode` signal: edit mode vs composite mode — extend for non-destructive exit/entry
- `frameFxCache` in previewRenderer: existing flatten/cache infrastructure
- `renderPaintFrameWithBg()`: renders paint to offscreen canvas — where white key must be applied
- Color picker: already exists, but key color is fixed (white)

### Established Patterns
- Non-destructive FX workflow: draw flat → select → apply → flatten (Phase 5)
- `paintVersion.value++` for triggering visual re-renders after paint data mutations
- `pushAction()` for undo/redo with snapshot/restore
- Blend mode application via `globalCompositeOperation` in previewRenderer

### Integration Points
- PaintProperties panel: "Show Seq BG" checkbox → replace with Luma Key toggle
- previewRenderer.ts: paint layer composite (lines 280-318) → apply luma key here
- paintStore: `paintBgColor` → remove or ignore; white is always the key
- Layer list: paint layer type — exit/entry to composite mode must update layer state

</code_context>

<specifics>
## Specific Ideas

- "I could paint in black on white BG for white paint on photography"
- "I like white paint"
- Paper texture as separate image layer underneath paint for physical media look
- Non-destructive: exit paint → composite normally → re-enter to edit anytime

</specifics>

<deferred>
## Deferred Ideas

### Paper texture in paint layer
Paper texture should be added as an image layer underneath paint layer, not inside paint layer. User composites: image layer (paper) → paint layer (with luma key). Out of scope for this phase.

### Key color picker
White is the fixed luma key. No custom key color in this phase. Future phase could add custom key color if needed.

### Gray background (COMP-02)
COMP-02 is obsolete. White background is always the luma key.

</deferred>

---

*Phase: 25-paint-compositing-pipeline*
*Context gathered: 2026-03-27*
