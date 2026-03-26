# Feature Research

**Domain:** Stop-motion editor VFX paint/compositing enhancements (v0.6.0)
**Researched:** 2026-03-26
**Confidence:** MEDIUM-HIGH (domain patterns well-established; implementation specifics verified against codebase)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist once a paint/roto paint system is in place. Missing these = product feels incomplete for the workflow.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Stroke list panel in roto paint | Every roto tool (Nuke, Silhouette, Natron) has a stroke/shape list with visibility toggle, reorder, delete. Users cannot manage complex roto work without seeing what strokes exist. | MEDIUM | Nuke shows: name, visible toggle, lock, color, blend mode, lifetime. For EFX-Motion, start simpler: name, visible eye icon, delete button, drag-to-reorder (SortableJS already in project). Selection sync with canvas. |
| Duplicate stroke with Alt+move | Universal pattern across Figma, Photoshop, Illustrator, After Effects. Alt/Option+drag = duplicate-and-move in one gesture. Users expect this in any tool with selectable objects. | LOW | Already have select-mode drag (PaintOverlay lines 787-821). Alt+drag = deep-clone selected strokes with new IDs, insert into frame, start dragging the clones. ~30 lines of logic. |
| Paint properties panel cleanup | Current PaintProperties.tsx is 400+ lines of vertically stacked sections with inconsistent collapse states. As features grow, panel must not become unusable. Space optimization is table stakes for professional tools. | LOW-MEDIUM | Consolidate related controls, use icon-only toggle buttons where possible, consistent section collapse behavior. Standard UI housekeeping. |
| Sequence-scoped layer creation | When a sequence is isolated/solo'd, new layers should belong to that sequence, not the globally active one. Standard After Effects behavior: layers belong to the composition you're working in. | LOW | `sequenceStore.addLayer()` already uses `activeSequenceId`. Fix: when isolation is active, `activeSequenceId` reflects the isolated sequence. Small routing change. |

### Differentiators (Competitive Advantage)

Features that set the product apart from basic paint tools and move toward professional VFX compositing.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Luma matte compositing for FX paint | Enables paint layers to composite over photographs without alpha channel. Paint on white background; brightness extracts the matte. This is how traditional VFX roto paint works (Nuke, Silhouette). Transforms paint layer from "opaque overlay" to "compositing element." | MEDIUM | Render paint to offscreen canvas, getImageData(), convert luminance to alpha (ITU-R BT.601: R*0.299 + G*0.587 + B*0.114), putImageData(), composite result. Need threshold/softness controls. |
| Paper/canvas texture on paint layer | Professional digital painting tools (Rebelle, Krita, Procreate) all have paper textures that interact with paint. Adds physical quality to brush strokes. Differentiates from flat digital look. | MEDIUM | Tiled texture overlay as per-layer post-process. Multiply/overlay blend a grayscale texture image on the paint canvas. User-loadable from `~/.config/efx-motion/papers/*` via Tauri FS. |
| Non-uniform scale for paint strokes | Current scale is uniform (corner-drag scales proportionally). Non-uniform allows horizontal or vertical stretching independently. Standard in Figma, Photoshop, After Effects for transform operations. | MEDIUM | Add edge-drag handles (midpoints of bounding box edges). Edge handle drag scales one axis only. Must scale stroke points around center with independent X/Y factors. |
| Bezier/spline stroke path editing | Allows editing the path of an already-drawn stroke by converting it to bezier control points. Standard in Nuke RotoPaint, Illustrator, Figma. Transforms freehand strokes into precise, editable curves. | HIGH | Need: (1) curve fitting algorithm to convert point array to cubic bezier, (2) render control points and tangent handles, (3) handle drag interactions with keyboard modifiers, (4) convert edited bezier back to point array. |
| Denser motion path interpolation visual | Current `sampleMotionDots()` samples one dot per integer frame. Short sequences produce sparse dots that look angular instead of smooth. | LOW | Change loop step to fractional value (0.25-0.5). `interpolateAt()` already handles fractional frames via polynomial interpolation. Cap max dots for performance. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Full vector path editor (Illustrator-style pen tool) | Users see bezier editing and want full pen tool, anchor point operations, path boolean ops | Massive scope creep. This is a motion editor, not a vector illustration tool. Path editing for roto is different from general vector editing. | Scope bezier editing to post-hoc path adjustment of existing freehand strokes only. No pen tool for creating strokes from scratch via bezier. |
| Real-time paper texture in brush rendering | Users want texture visible while drawing each stroke, not just on final composite | p5.brush renders on WebGL2 canvas. Adding texture interaction during drawing requires shader modification in p5.brush internals (treated as external library). Performance cost per stroke. | Apply paper texture as post-process overlay on the entire paint layer. Texture visible immediately after stroke render completes. Fast, decoupled from brush engine. |
| Per-stroke paper texture settings | Different textures per stroke like Krita's per-brush texture mode | Exponentially increases UI complexity and storage. Per-frame FX cache renders all strokes together; per-stroke texture breaks batch rendering. | Per-layer paper texture. One texture for the entire paint layer with intensity/scale/blend mode controls. |
| Luma matte with custom curves/levels | Full luminance curve editor for matte extraction like Nuke's advanced matte tools | Over-engineering for stop-motion paint layers, which are simpler than VFX plate work. | Threshold + softness slider (two parameters). Covers 95% of use cases. Users adjust paint opacity/color to control matte density. |

## Feature Dependencies

```
[Luma Matte Compositing]
    (standalone -- modifies previewRenderer paint layer compositing path)

[Paper/Canvas Texture]
    (standalone -- post-process on paint layer rendering)

[Stroke List Panel]
    requires  [existing paintStore element management]
    enhances  [Duplicate Stroke]
    enhances  [Bezier Path Editing]

[Duplicate Stroke (Alt+move)]
    requires  [existing select-mode drag infrastructure]

[Non-Uniform Scale]
    requires  [existing selection bounds + transform handles]
    enhances  [existing uniform scale]

[Paint Properties Cleanup]
    (standalone -- pure UI refactor)
    enhances  [Stroke List Panel] (panel space freed)

[Bezier/Spline Path Editing]
    requires  [Stroke List Panel] (need precise stroke selection)
    requires  [existing select-mode infrastructure]

[Sequence-Scoped Layer Creation]
    requires  [existing isolationStore + addLayer flow]

[Denser Motion Path]
    requires  [existing sampleMotionDots + interpolateAt]
```

### Dependency Notes

- **Bezier Path Editing requires Stroke List Panel:** Users need precise stroke selection before entering path edit mode. The stroke list provides explicit stroke targeting instead of hit-testing ambiguity on overlapping strokes.
- **Stroke List Panel enhances Duplicate Stroke:** After Alt+duplicating, the new stroke appears in the list with a visible name, making it easy to track what was created.
- **Non-Uniform Scale enhances existing uniform scale:** Must coexist. Corner handles = uniform scale (current). Edge handles = non-uniform scale (new). Standard Figma/Photoshop pattern.
- **Luma Matte and Paper Texture are independent:** Both modify the paint rendering pipeline at different stages. Luma matte affects compositing (how paint composites onto scene). Paper texture affects appearance (how paint looks on its canvas). They compose naturally: paint -> paper texture overlay -> luma matte extraction -> composite onto scene.

## MVP Definition

### Phase 1: Core Paint Workflow (High Value, Lower Risk)

Must-build features that directly improve the existing paint workflow.

- [ ] Stroke list panel -- essential for managing complex roto work, unblocks path editing later
- [ ] Duplicate stroke with Alt+move -- tiny implementation, huge UX win, universally expected
- [ ] Paint properties panel cleanup -- necessary before adding more controls
- [ ] Sequence-scoped layer creation -- small fix with large correctness impact
- [ ] Denser motion path interpolation -- tiny change, visible improvement

### Phase 2: Compositing & Texture (Medium Value, Medium Risk)

Features that upgrade paint from drawing tool to compositing tool.

- [ ] Luma matte compositing -- transforms paint layer utility, requires pixel manipulation
- [ ] Paper/canvas texture -- adds physical quality, requires Tauri FS for user textures
- [ ] Non-uniform scale -- enhances existing transform, moderate complexity

### Phase 3: Advanced Editing (High Value, High Risk)

- [ ] Bezier/spline stroke path editing -- most complex feature, benefits from stroke list being solid first

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Risk | Priority |
|---------|------------|---------------------|------|----------|
| Stroke list panel | HIGH | MEDIUM | LOW | P1 |
| Duplicate stroke (Alt+move) | HIGH | LOW | LOW | P1 |
| Paint properties cleanup | MEDIUM | LOW | LOW | P1 |
| Sequence-scoped layer creation | MEDIUM | LOW | LOW | P1 |
| Denser motion path | LOW | LOW | LOW | P1 |
| Luma matte compositing | HIGH | MEDIUM | MEDIUM | P2 |
| Paper/canvas texture | MEDIUM | MEDIUM | LOW | P2 |
| Non-uniform scale | MEDIUM | MEDIUM | LOW | P2 |
| Bezier/spline path editing | HIGH | HIGH | HIGH | P3 |

**Priority key:**
- P1: Quick wins + infrastructure (stroke list unblocks P3)
- P2: Compositing upgrades that change paint layer's role
- P3: Complex editing feature, benefits from P1 infrastructure

## Competitor Feature Analysis

| Feature | Nuke RotoPaint | Silhouette | Krita | EFX-Motion Approach |
|---------|---------------|------------|-------|---------------------|
| Stroke list | Full list: visible, lock, overlay color, blend mode, lifetime. Drag reorder. Groups as folders. Rename. Right-click duplicate. | Tree view with grouping, per-shape attributes. | Layer-based (not per-stroke). | Simplified: name, eye (visible), delete, drag-reorder via SortableJS. Selection syncs with canvas. |
| Luma matte | Node-based compositing with dedicated luma matte node. Threshold, softness, gain. | Full keying pipeline with ML-assisted mattes. | N/A (painting app). | Per-layer toggle: "Composite via Luma Matte" checkbox. Threshold + softness sliders. In previewRenderer paint path. |
| Paper texture | N/A (VFX tool). | N/A (VFX tool). | Per-brush texture via pattern overlay. Modes: multiply, subtract, lightness map. Cutoff, strength. | Per-layer post-process. Tiled grayscale texture multiplied/overlaid on paint canvas. Intensity + scale + blend mode. User-loadable from config dir. |
| Bezier editing | Full bezier and B-spline tools. Click+drag for tangents. Shift for tangent sync. Ctrl to break angle. Cusp/smooth toggle. | X-splines, B-splines, Bezier splines. | Bezier tool for vector layers. | Post-hoc conversion: freehand stroke -> bezier control points. Edit handles to reshape. Simpler than Nuke (editing existing strokes only, not creating from scratch). |
| Duplicate | Right-click -> Duplicate in stroke list. | Clone tool, copy/paste shapes. | Ctrl+J, Ctrl+C/V. | Alt/Option+drag in select mode. Single gesture duplicate-and-position. |
| Non-uniform scale | Full transform gizmo per shape/group. | Transform tool with independent axis. | Transform tool with lock aspect ratio toggle. | Edge-drag on selection bounds = single-axis scale. Corner-drag = uniform (existing). |

## Detailed Feature Specifications

### 1. Luma Matte Compositing

**How it works in VFX (HIGH confidence):**
- Paint is drawn on a solid background (typically white or black)
- The paint layer's luminance (brightness) is extracted as transparency matte
- White areas = fully opaque (paint visible). Black areas = fully transparent (underlying image shows through). Gray = partial transparency.
- Two modes: "Luma" (bright = opaque) and "Inverted Luma" (dark = opaque, for dark paint on white bg)

**Implementation approach:**
- In `previewRenderer.ts` paint layer compositing (line ~280), after `renderPaintFrameWithBg()` on offscreen canvas, apply luma-to-alpha pixel manipulation before compositing onto main canvas
- Algorithm: `getImageData()`, loop pixels, `alpha = 0.299*R + 0.587*G + 0.114*B` (ITU-R BT.601), `putImageData()`
- Inverted mode: `alpha = 255 - luminance` (for dark paint on white background, which is the common case)
- Controls: enable checkbox, threshold (0-255, clamp low values to transparent), softness (remap range), invert toggle
- Store as paint layer properties (extend `LayerSourceData` for `type: 'paint'` with optional `lumaMatte?: { enabled: boolean; threshold: number; softness: number; invert: boolean }`)
- Performance: pixel-by-pixel loop on offscreen canvas per frame. For 1920x1080 = ~8M pixel operations. Profile needed but likely acceptable at 15fps for stop-motion.

**Dependency on existing architecture:** Modifies the paint layer branch in `previewRenderer.ts` (lines 280-303). Also needs parallel change in `exportRenderer.ts` for export consistency.

### 2. Paper/Canvas Texture

**How it works in painting apps (HIGH confidence):**
- **Krita:** Grayscale pattern images modulate brush alpha. Modes: multiply (soft), subtract (harsh), lightness map (applies texture lightness values to paint). Cutoff controls limit which grayscale ranges affect strokes. Strength slider controls intensity.
- **Rebelle:** Scanned real paper textures applied as canvas surface. Papers interact with watercolor physics. NanoPixel technology for infinite zoom.
- **Common approach:** Grayscale height map tiled across canvas, blended with paint via multiply or overlay composite operation.

**Implementation approach:**
- Post-process on paint layer: after `renderPaintFrameWithBg()`, draw tiled texture image with `globalCompositeOperation = 'multiply'` (or overlay)
- Tiling: create pattern via `ctx.createPattern(textureImg, 'repeat')`, apply with `fillRect` at configured scale
- Texture source: load PNG/JPG from `~/.config/efx-motion/papers/` via Tauri `readDir()` + `readFile()`
- Controls: texture selector (thumbnail grid from discovered files), intensity (0-1 via globalAlpha), scale (50-400%), blend mode (multiply/overlay/soft-light)
- Bundled defaults: 3-4 textures shipped with app (cold press watercolor, hot press smooth, canvas, kraft paper) as grayscale PNGs
- p5.brush `grain` parameter already adds per-brush-style texture, but it operates during WebGL2 rendering. Layer-level texture adds independent, controllable surface quality.
- Paper texture applied BEFORE luma matte extraction (if both enabled): paint -> texture overlay -> luma matte -> composite

**Data model:** Extend paint layer source: `paperTexture?: { path: string; intensity: number; scale: number; blendMode: 'multiply' | 'overlay' | 'soft-light' }`

### 3. Duplicate Stroke with Alt+Move

**How it works universally (HIGH confidence):**
- Figma: Alt/Option+drag duplicates and moves in one gesture
- Photoshop: Alt+drag with Move tool duplicates layer/selection
- After Effects: Alt+drag duplicates layer
- Industry-standard: modifier key during drag initiation = clone-and-move

**Implementation approach:**
- In PaintOverlay `handlePointerDown` select-mode section (line ~554): when `e.altKey` is true during drag start on selected strokes:
  1. Deep-clone each selected stroke: `{ ...stroke, id: crypto.randomUUID(), points: stroke.points.map(p => [...p]) }`
  2. Insert clones into `paintFrame.elements` array
  3. Update selection to point at clone IDs (deselect originals)
  4. Start drag on clones (existing drag logic handles the rest)
- Undo: single `pushAction` removes all cloned strokes
- FX cache: invalidate after clone (cloned strokes may have FX styles)
- Edge case: clone eraser strokes too, not just brush strokes

### 4. Non-Uniform Scale

**How it works in design tools (HIGH confidence):**
- Figma: side handles scale one axis; corner handles scale both. Shift constrains to uniform.
- Photoshop Free Transform: handles at midpoints of edges for single-axis, corners for proportional
- After Effects: separate Scale X and Scale Y properties in transform

**Implementation approach:**
- Add edge handles (midpoints of selection bounding box edges) alongside existing corner handles
- Edge handle visual: small rectangles (not circles) to distinguish from corner handles
- `hitTestHandle()` extended to detect 'top', 'bottom', 'left', 'right' edge handles
- Drag behavior:
  - Top/bottom edge handle: compute scaleY only, scaleX = 1
  - Left/right edge handle: compute scaleX only, scaleY = 1
  - Apply: `point.x = center.x + (point.x - center.x) * scaleX`; same for Y
- Brush size: do NOT scale brush size for non-uniform transforms. Stroke points move but brush diameter stays constant. This avoids needing separate sizeX/sizeY on PaintStroke.
- Existing corner handles keep uniform scale behavior (current code, lines 759-777)

### 5. Paint Properties Panel Cleanup

**Current state (from code review):**
- 400+ lines of JSX with mixed collapsed/expanded sections
- Background color, selection tools, FX controls, onion skin, tablet settings all in one scroll
- Inconsistent button sizing and spacing
- Many sections only relevant for specific tool modes

**Approach:**
- Show only tool-relevant controls (brush settings when brush active, selection tools when select active)
- Icon-only toggle buttons for binary options (filled/outline, onion skin on/off)
- Consistent collapsible sections with uniform chevron behavior
- 2-column grids for related controls (size + opacity side by side)
- Move stroke list panel here or adjacent
- Extract sub-components for testability

### 6. Sequence-Scoped Layer Creation

**Standard behavior (After Effects model, HIGH confidence):**
- Layers belong to compositions. Working in a comp = new layers appear in that comp.
- EFX-Motion equivalent: when a sequence is isolated (solo mode), new layers should target that sequence.

**Implementation approach:**
- `sequenceStore.addLayer()` uses `activeSequenceId`. Check if `isolationStore.hasIsolation` is true and exactly one sequence is isolated -- if so, target that sequence for addLayer
- Alternatively: when entering isolation on a sequence, set `activeSequenceId` to match
- Existing add layer flows (AddLayerMenu, AddFxMenu) all go through `sequenceStore.addLayer()` so the fix is centralized

### 7. Denser Motion Path Interpolation

**Current behavior (from code review):**
- `sampleMotionDots()` iterates `frame = firstFrame; frame <= lastFrame; frame++`
- Short sequences (5 frames between keyframes) produce only 5 dots
- Path appears sparse and angular

**Implementation approach:**
- Change step: `const step = Math.max(0.25, (lastFrame - firstFrame) / 60)` -- adaptive, ensures ~60 dots max
- Or simpler: always use `frame += 0.5` for 2x density, cap at 200 dots
- `interpolateAt()` uses polynomial cubic interpolation -- already handles fractional frames
- Non-keyframe fractional dots rendered smaller (2px vs 4px) so keyframe markers still stand out
- Performance: 60-200 SVG circle elements is negligible

### 8. Bezier/Spline Stroke Path Editing

**How it works in Nuke RotoPaint (HIGH confidence):**
- Click to place bezier control points, click+drag to set tangent handles
- Shift while moving handles: moves both tangent handles together (keep angle consistent)
- Ctrl/Cmd while dragging: temporarily breaks tangent angle (creates cusp)
- Right-click point: cusp/de-smooth or smooth toggle
- Add points: dedicated tool, click on spline to insert
- Remove points: right-click point -> delete, or dedicated remove tool

**Implementation approach for EFX-Motion (post-hoc editing, not creation):**
1. **Curve fitting:** Convert existing `PaintStroke.points[]` to cubic bezier segments using Philip J. Schneider's algorithm (Graphics Gems). Input: point samples with tolerance parameter. Output: array of `{p0, p1, p2, p3}` cubic bezier control points.
2. **Edit mode entry:** Double-click a selected stroke (or button in stroke list) enters bezier edit mode. Render: filled circles for anchor points (on-curve), hollow circles for handle endpoints (off-curve), thin lines connecting handle to anchor.
3. **Interactions:**
   - Drag anchor: moves on-curve point
   - Drag handle: adjusts tangent direction/length
   - Alt+drag handle: break tangent symmetry (cusp)
   - Double-click anchor: toggle smooth/cusp
   - Click on curve between anchors: add new anchor point (subdivide bezier)
   - Delete key on selected anchor: remove point, reconnect neighbors
4. **Reconversion:** After editing, sample the bezier curve at regular intervals to regenerate `points[]` with interpolated pressure values from neighboring original points.
5. **Scope limits:** Only brush strokes (not shapes/fills). Only adjusts path geometry (not pressure profile -- pressure interpolated from original). No pen tool for creating new strokes via bezier.

**Risk:** Curve fitting quality -- if the bezier approximation visibly deviates from the freehand stroke, users will be frustrated. Need adjustable tolerance. Reconversion (bezier -> points) must produce strokes that render identically to the edited path through perfect-freehand.

### 9. Stroke List Panel

**How Nuke's stroke/shape list works (HIGH confidence):**
- Columns: visible (eye), lock, overlay color, stroke color, invert, blend mode, motion blur, lifetime
- Reorder by drag-and-drop
- Groups as folders for organizing related strokes
- Double-click to rename (must be unique names)
- Right-click context menu: copy, cut, paste, duplicate
- Selection in list syncs with viewport selection

**Implementation approach:**
- Panel placement: new section in sidebar when in paint edit mode (replaces or augments current selection controls in PaintProperties)
- Row contents (v1): stroke color dot, auto-generated name, eye toggle, delete button
- Drag-to-reorder via SortableJS (already used in sidebar for sequence/layer reorder, `forceFallback: true` for Tauri)
- Click to select (syncs with `paintStore.selectedStrokeIds`). Multi-select with Cmd/Ctrl+click.
- Auto-naming: "Brush 1", "Eraser 2", etc. (based on tool type and creation order)
- Compact rows (~24px height) for dense lists
- Visual indicators: stroke with FX shows style badge (wc/ink/ch/pe/mk)

**Data model changes:** `PaintElement` needs:
- `name?: string` -- optional display name (auto-generated if absent for backward compat)
- `visible?: boolean` -- default true for backward compat. When false, skip in `renderPaintFrame()` / `renderFlatElements()`

## Sources

- [Nuke RotoPaint Stroke/Shape List](https://learn.foundry.com/nuke/content/comp_environment/rotopaint/working_stroke_shape_list.html) -- stroke list UI patterns, columns, hierarchy
- [Nuke Bezier Tools](https://learn.foundry.com/nuke/content/comp_environment/rotopaint/using_bezier_tools.html) -- bezier editing keyboard modifiers, tangent handle behavior
- [Nuke Editing Existing Splines](https://learn.foundry.com/nuke/content/comp_environment/rotopaint/editing_existing_splines.html) -- adding/moving/deleting control points
- [Nuke Stroke Attributes](https://learn.foundry.com/nuke/content/comp_environment/rotopaint/editing_stroke_attrs.html) -- per-stroke properties
- [Frame.io Mattes Guide](https://workflow.frame.io/guide/mattes) -- luma vs alpha matte fundamentals
- [Krita Texture Brush Settings](https://docs.krita.org/en/reference_manual/brushes/brush_settings/texture.html) -- texture modes: multiply, subtract, lightness map, strength, cutoff
- [Rebelle Paper Textures](https://www.escapemotions.com/blog/enhancing-your-digital-paintings-with-textures-in-rebelle) -- scanned paper workflow, NanoPixel technology
- [Krita-Artists Canvas Texture Discussion](https://krita-artists.org/t/canvas-texture-overlays/40905) -- overlay blend technique for canvas textures
- [Figma Alt+Drag Duplicate](https://help.figma.com/hc/en-us/articles/4409078832791-Copy-and-paste-objects) -- standard duplicate gesture
- [Canvas 2D getImageData MDN](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/getImageData) -- pixel manipulation for luma extraction
- [Canvas 2D setTransform MDN](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/setTransform) -- transform matrix for non-uniform scale
- [Primer on Bezier Curves](https://pomax.github.io/bezierinfo/) -- comprehensive bezier math reference
- [Konva Ignore Stroke On Transform](https://konvajs.org/docs/select_and_transform/Ignore_Stroke_On_Transform.html) -- stroke width behavior during non-uniform scale

---
*Feature research for: EFX-Motion v0.6.0 Various Enhancements*
*Researched: 2026-03-26*
