# Pitfalls Research

**Domain:** v0.6.0 Various Enhancements -- Adding luma matte compositing, paper textures, stroke management, bezier path editing, and UX refinements to existing Canvas 2D + p5.brush + paintStore system (Tauri 2.0 + Preact Signals)
**Researched:** 2026-03-26
**Confidence:** HIGH (based on direct codebase analysis + verified Canvas 2D API behavior)

## Critical Pitfalls

### Pitfall 1: Luma Matte Pixel Manipulation Destroys Color Fidelity via Premultiplied Alpha

**What goes wrong:**
The luma matte extraction spec calls for `getImageData()` on the paint canvas, computing `alpha = 255 - luma`, writing the alpha channel, then `putImageData()` back. Canvas 2D internally stores pixel data as premultiplied alpha. The `getImageData()` -> modify -> `putImageData()` round-trip is lossy: RGB values are quantized when alpha is low. Light-colored paint strokes (the exact case luma matte is meant to help with) will have low derived alpha values, causing their RGB to be destroyed or shifted when read back. A pastel blue stroke at alpha=10 might come back as a completely different color.

**Why it happens:**
Canvas spec explicitly states: "pixels that have just been set using putImageData() might be returned to an equivalent getImageData() as different values." This is not a bug -- it is the specified behavior. The smaller the alpha, the coarser the RGB quantization. At alpha=1, only RGB values 0 and 255 survive. At alpha=0, all RGB is lost entirely.

**How to avoid:**
1. **Do the luma matte on an offscreen canvas, never round-trip through putImageData on the main canvas.** Create an offscreen canvas, render paint frame to it, extract ImageData, compute luma alpha, write to a second offscreen canvas via putImageData, then composite that second canvas onto the main renderer using `ctx.drawImage()`. The drawImage path uses the GPU compositing pipeline which avoids the premultiplication round-trip loss.
2. **Un-premultiply BEFORE writing alpha.** The spec recommends: `color = paintPixel / (1.0 - alpha)` to recover pure pigment. Do this division in the pixel loop to compensate for the premultiplication that putImageData will apply.
3. **Clamp alpha minimum to avoid extreme quantization.** If `luma > 250` (near-white), set alpha to 0 rather than 5 -- the tiny alpha values cause the worst color loss and the visual contribution is negligible anyway.
4. **Cache the luma matte result.** The pixel loop over full-resolution ImageData is expensive (e.g., 1920x1080 = 8.3M channel operations). Cache alongside `_frameFxCache` and invalidate on the same triggers.

**Warning signs:**
- Pastel or light-colored strokes appear darker or shift hue after compositing
- Semi-transparent paint regions look "banded" or posterized
- Colors differ between paint edit mode (solid bg) and composited preview

**Phase to address:**
Luma Matte Compositing phase -- must be the first pixel manipulation implemented, since paper textures will composite on top of this result.

---

### Pitfall 2: Missing paintVersion Increment on Visual Changes (Existing Bug + New Features)

**What goes wrong:**
The preview canvas only re-renders when `paintStore.paintVersion` signal increments. Any code path that changes visual state without bumping this counter produces invisible changes -- the data mutates but the canvas shows stale content. This already happens in the existing codebase: `moveElementsForward`, `moveElementsBackward`, `moveElementsToFront`, and `moveElementsToBack` all mutate the elements array order but **never call `paintVersion.value++`**. The stroke list panel, duplicate stroke, non-uniform scale, and bezier editing features will all create new visual-mutation code paths that must each bump the counter.

**Why it happens:**
`paintStore` uses a non-reactive `Map<string, Map<number, PaintFrame>>` for paint data (by design -- making Maps reactive would be expensive). The `paintVersion` counter is the explicit reactivity trigger. It is easy to mutate data and forget the counter bump, especially in helper functions that don't directly interact with the rendering pipeline.

**How to avoid:**
1. **Audit every new function in paintStore.** Before marking a feature complete, grep for all mutations to `frameData.elements` or stroke properties and verify each has a `paintVersion.value++`.
2. **Fix the existing bug first.** Add `paintVersion.value++` to all four `moveElements*` methods before building the stroke list panel that will expose them.
3. **Consider a helper.** Create a `_notifyVisualChange(layerId, frame)` helper that does `markDirty + paintVersion++ + invalidateFrameFxCache` in one call, reducing the chance of forgetting any of the three.
4. **For bezier editing:** Every control point drag must bump paintVersion on each pointer move, not just on pointer up (users expect live preview during drag).

**Warning signs:**
- Stroke reorder in the list panel doesn't update the canvas
- Duplicated stroke appears only after switching frames and back
- Bezier handle drag has no visual feedback until mouse release
- Non-uniform scale preview is frozen during transform

**Phase to address:**
Every single phase in this milestone. Consider creating the `_notifyVisualChange` helper as the very first task.

---

### Pitfall 3: Missing Undo Support on Stroke Reorder (Existing Gap Exposed by Stroke List Panel)

**What goes wrong:**
The stroke list panel will let users drag-reorder strokes via SortableJS. The existing `moveElementsForward/Backward/ToFront/ToBack` methods do not call `pushAction()` -- they have no undo support. A user reorders strokes, realizes it was wrong, presses Cmd+Z, and instead undoes the *previous* paint operation (a stroke draw or delete), leaving the reorder stuck. This is a confusing, destructive UX failure.

**Why it happens:**
The four `moveElements*` methods were added as utility functions called from PaintProperties buttons. They were likely intended as quick helpers and undo was deferred. The stroke list panel makes reordering a primary interaction, elevating this gap from minor to critical.

**How to avoid:**
1. **Add `pushAction` to all four `moveElements*` methods** with proper undo/redo closures that snapshot the element order before mutation and restore it on undo.
2. **For SortableJS drag reorder in the stroke list:** create a new `reorderElements(layerId, frame, fromIndex, toIndex)` method that also pushes an undo action. Don't reuse the existing methods for drag -- they do pair-wise swaps which are wrong for arbitrary index-to-index reorder.
3. **Test undo after every stroke list interaction:** reorder, delete, duplicate, hide/show.

**Warning signs:**
- Cmd+Z after reorder undoes wrong operation
- Multiple rapid reorders stack up as individual non-undoable mutations
- Redo stack gets corrupted (the pointer-based history system truncates on new push)

**Phase to address:**
Stroke List Panel phase -- fix existing methods first, then build the panel.

---

### Pitfall 4: SortableJS in Stroke List Panel Conflicts with Existing SortableJS Instances

**What goes wrong:**
The app already uses SortableJS with `forceFallback: true` in three places: SequenceList, LayerList, and KeyPhotoStrip. Adding a fourth SortableJS instance in the stroke list panel creates potential conflicts: (a) nested SortableJS containers can intercept each other's drag events if the DOM hierarchy overlaps, (b) `forceFallback: true` creates a cloned ghost element that can interfere with Tauri's pointer event handling across multiple active instances, (c) the stroke list will be inside the sidebar which already contains LayerList with its own Sortable.

**Why it happens:**
SortableJS uses document-level event listeners for drag tracking. When multiple Sortable instances exist in nested containers, pointer events can bubble to the wrong handler. The existing `forceFallback: true` setting (needed to bypass Tauri's native HTML5 DnD interception) makes this worse because the fallback mode creates a floating DOM clone that receives pointer events.

**How to avoid:**
1. **Use `group: { name: 'strokes' }` with a unique group name** to isolate the stroke list's drag operations from other Sortable instances.
2. **Set `filter: '.no-drag'`** on the parent LayerList Sortable to prevent it from intercepting drags that originate in the stroke list child container.
3. **Ensure the stroke list Sortable is destroyed on unmount.** Use a `useEffect` cleanup to call `sortable.destroy()` -- leaked instances cause ghost event listeners.
4. **Test the interaction matrix:** drag in stroke list while sidebar is showing layers, drag layer while stroke list is visible, etc.

**Warning signs:**
- Dragging a stroke in the list also starts a layer reorder
- Ghost clone appears at wrong position or doesn't disappear
- Stroke list drag works in isolation but breaks when sidebar sections are expanded

**Phase to address:**
Stroke List Panel phase.

---

### Pitfall 5: Bezier/Spline Editing Creates Unbounded Undo History from Continuous Drag

**What goes wrong:**
When a user drags a bezier control point, each `pointermove` event updates the point position and should bump `paintVersion` for live preview. If each move also pushes a separate undo action, a 1-second drag generates 60+ undo entries. Pressing Cmd+Z would undo one pixel of movement at a time instead of the entire drag operation.

**Why it happens:**
The existing code already handles this pattern for stroke drag/move (isDragging in PaintOverlay), but it does so by directly mutating point arrays during drag and NOT pushing any undo action at all -- the drag is completely non-undoable. Bezier editing needs to do better: live preview during drag, but a single undo entry for the entire drag gesture.

**How to avoid:**
1. **Use the existing `startCoalescing()` / `stopCoalescing()` API from history.ts.** Call `startCoalescing()` on pointerdown when a bezier handle is grabbed, push an initial undo action that snapshots the pre-drag state, then during pointermove just mutate + paintVersion++ without pushing. Call `stopCoalescing()` on pointerup.
2. **Alternatively, snapshot on pointerdown, mutate freely during drag, and push a single undo action on pointerup** that stores the before/after state. This is simpler and matches how the existing transform code works (it just lacks the undo push on pointerup -- another existing gap).
3. **Don't forget to push undo for the EXISTING stroke drag/move and transform operations.** These are currently non-undoable. Fixing them while implementing bezier editing avoids inconsistent undo behavior.

**Warning signs:**
- Cmd+Z after dragging a bezier handle does nothing (no undo was pushed)
- Cmd+Z steps through individual sub-pixel movements instead of undoing the whole drag
- Multiple Cmd+Z required to undo what feels like one operation

**Phase to address:**
Bezier/Spline Stroke Path Editing phase. Also retroactively fix stroke drag/transform undo in the same phase.

---

### Pitfall 6: Non-Uniform Scale Breaks perfect-freehand Stroke Rendering

**What goes wrong:**
The existing uniform scale in PaintOverlay scales all point coordinates by the same factor and also scales `stroke.size`. Non-uniform scale (different X and Y scale factors) cannot simply scale point coordinates and brush size -- perfect-freehand generates stroke outlines based on a single `size` parameter and assumes circular tips. Applying `scaleX=2, scaleY=1` to the points but keeping `size` unchanged produces strokes that look squished rather than stretched, because the outline calculation doesn't know about the aspect ratio change.

**Why it happens:**
`perfect-freehand`'s `getStroke()` takes a scalar `size`, not a vector. The outline algorithm generates equidistant perpendicular offsets from the centerline. Non-uniform scaling of input points changes the centerline shape but the perpendicular offsets remain isotropic.

**How to avoid:**
1. **Apply non-uniform scale as a canvas transform, not a point mutation.** Instead of modifying `stroke.points[i]` directly, store `scaleX` and `scaleY` as stroke metadata and apply `ctx.scale(scaleX, scaleY)` before rendering. This correctly stretches the entire rendered output including the outline thickness.
2. **If storing per-stroke transform metadata**, update the PaintStroke type with an optional `transform?: { scaleX: number; scaleY: number; rotation: number; translateX: number; translateY: number }` field. This is cleaner than baking transforms into points.
3. **For the p5.brush FX pipeline**: the per-stroke transform must be passed to `renderFrameFx()` so the p5.brush canvas also applies it. p5.brush's `brush.push()` and `brush.pop()` manage transform state.
4. **Hit testing must account for the transform.** `findStrokeAtPoint()` currently checks raw point coordinates. With per-stroke transforms, the test point must be inverse-transformed before distance checks.

**Warning signs:**
- Strokes look distorted after non-uniform scale (outline thickness wrong)
- FX strokes (watercolor, ink) don't match the flat stroke's transform
- Select tool can't click on transformed strokes (hit test misaligned)
- Undo after non-uniform scale produces visual artifacts

**Phase to address:**
Non-Uniform Scale phase. Must coordinate with Bezier Editing phase if both modify stroke data representation.

---

### Pitfall 7: Paper Texture Compositing Order Conflicts with Luma Matte

**What goes wrong:**
Paper texture and luma matte compositing both operate on the paint layer's pixel output. If paper texture is applied BEFORE luma matte extraction, the texture's white/light areas inflate the luminance values, causing the matte to make the paint more transparent than intended (texture white = alpha 0). If applied AFTER, the texture correctly modifies only the visible paint but may introduce white fringe around semi-transparent matte edges.

**Why it happens:**
Both operations transform the paint canvas pixels in ways that interact with each other. The compositing order is not obvious and there is no single "correct" answer -- it depends on the desired artistic effect.

**How to avoid:**
1. **Apply luma matte first, then paper texture.** The matte extracts alpha from the raw paint. Then apply paper texture as a multiply blend (or other blend mode) on the already-matted result. This preserves the matte's alpha channel while adding surface texture to the visible paint.
2. **Paper texture should NOT modify the alpha channel.** Apply it to RGB only, using `multiply` or `overlay` composite operation. If the texture image has its own alpha, composite it onto the paint RGB before the matte extraction, not after.
3. **Provide a toggle for texture compositing order** in the properties panel if artists want texture-before-matte for specific effects.
4. **Cache at the right level.** The FX cache currently stores the p5.brush output. Luma matte and paper texture should be applied downstream of the FX cache, in `previewRenderer.ts` at the paint layer compositing step. Don't bake them into the FX cache -- they should be re-applicable without re-rendering all brush FX.

**Warning signs:**
- Paper texture makes strokes invisible (texture white overrides matte alpha)
- Visible "halo" of texture pattern around matte edges
- Changing paper texture requires full FX re-render (should be instant)

**Phase to address:**
Paper Texture phase must come AFTER or concurrent with Luma Matte phase. The compositing pipeline design must account for both.

---

### Pitfall 8: Alt+Drag Duplicate Stroke Creates Ghost References in Undo History

**What goes wrong:**
Alt+drag to duplicate a stroke needs to: (1) deep-clone the selected strokes with new IDs, (2) add them to the frame, (3) select the clones (deselecting originals), (4) begin dragging the clones. If the undo action for the duplicate references the clone objects by reference and the drag then mutates those objects' points in-place, undoing the duplicate removes the elements but the undo closure for the drag still holds references to the now-removed elements. Subsequent redo of the drag tries to mutate objects that no longer exist in the frame's elements array.

**Why it happens:**
The existing drag code mutates `stroke.points[i]` in-place during pointermove. The undo system's closures capture references to these same stroke objects. After undo of the add, the stroke is removed from `frameData.elements` but the undo closure for the drag still references the detached object.

**How to avoid:**
1. **Duplicate + drag must be a single compound undo action.** On pointerdown with Alt held: snapshot the frame state, clone strokes, add to frame, begin drag. On pointerup: push ONE undo action that restores the entire frame to the pre-duplicate snapshot. This avoids the two-action reference problem entirely.
2. **Deep-clone with `structuredClone()` for the undo snapshot**, not reference copies. The existing `pushAction` undo closures in `addElement` use `filter(e => e.id !== element.id)` which works for add/remove, but drag mutations are in-place and need snapshot-based undo.
3. **Generate new IDs with `crypto.randomUUID()` for clones** (already the pattern used elsewhere).
4. **Invalidate FX cache after clone creation** -- new strokes with FX need re-rendering.

**Warning signs:**
- Undo after Alt+drag removes original strokes instead of clones
- Redo after undo shows strokes at wrong positions
- FX cache shows stale rendering after duplicate (missing invalidation)

**Phase to address:**
Duplicate Stroke (Alt+Move) phase.

---

### Pitfall 9: Keyboard Shortcut Conflicts in Paint Edit Mode

**What goes wrong:**
New features add new keyboard shortcuts that conflict with existing paint mode shortcuts. The `isPaintEditMode()` guard in `shortcuts.ts` currently only guards `F` (fit toggle, conflicts with flat preview) and `M` (motion blur, potential paint conflict). New features may add: `B` for bezier tool, `V` for select tool, `A` for select-all, `D` for duplicate, `H` for hide stroke -- all of which are common shortcuts that may conflict with existing global bindings or each other.

**Why it happens:**
`isPaintEditMode()` checks if a paint layer is selected, NOT if paint mode is active. This means global shortcuts are suppressed even when just viewing a paint layer in the sidebar, before entering paint mode. The check should arguably be `paintStore.paintMode.peek()` instead. Additionally, new tool-specific shortcuts (bezier handles, stroke list) add more keys that need guarding.

**How to avoid:**
1. **Audit ALL new keyboard shortcuts against the existing shortcut map** in `shortcuts.ts` and `ShortcutsOverlay.tsx`. There are 30+ existing bindings.
2. **Guard new shortcuts with `isPaintEditMode()`** or a more specific `isPaintToolActive(toolName)` check.
3. **For the stroke list panel:** if it uses keyboard shortcuts (Delete for remove, arrows for navigation), those MUST check whether the stroke list panel is focused/active vs. the timeline/canvas having focus. Otherwise Delete could delete strokes when the user meant to delete a keyframe.
4. **Consider a focus-based shortcut scope** rather than global guards. The current approach of checking mode flags in every handler doesn't scale.

**Warning signs:**
- Pressing a key in the stroke list triggers a global shortcut (e.g., Delete removes a layer)
- Pressing a paint tool shortcut while typing in a stroke rename field
- JKL shuttle controls activate while dragging bezier handles

**Phase to address:**
Every phase that adds keyboard interactions. Particularly critical for Stroke List Panel and Bezier Editing phases.

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Mutating stroke.points in-place during drag | Fast, no allocation | Undo system can't snapshot; reference-sharing bugs between undo closures | Never -- use snapshot-on-pointerdown + restore-on-undo |
| Baking luma matte into the FX cache | One fewer compositing step | Forces full p5.brush re-render when toggling matte on/off | Never -- keep matte downstream of FX cache |
| Skipping `paintVersion++` during pointermove for performance | Fewer signal notifications | Canvas freezes during drag; users think app is broken | Never -- batch with `requestAnimationFrame` if too frequent |
| Loading paper textures synchronously from disk via Tauri FS | Simple code path | Blocks main thread; textures can be large (4K+ images) | Never -- async load with loading indicator |
| Storing per-stroke transform in the points array (baked) | No schema change | Irreversible; can't adjust transform later; breaks undo | Only for "flatten transform" as an explicit user action |

## Integration Gotchas

Common mistakes when connecting to existing subsystems.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| paintStore.paintVersion | Forgetting to bump after visual mutation | Create `_notifyVisualChange(layerId, frame)` helper that does markDirty + paintVersion++ + invalidateFrameFxCache in one call |
| history.pushAction | Pushing during pointermove (60 entries/sec) | Use startCoalescing/stopCoalescing or snapshot-on-down + single-push-on-up |
| SortableJS (stroke list) | Not calling `.destroy()` on component unmount | useEffect cleanup; leaked instances cause phantom drag events |
| p5.brush FX cache | Adding new stroke without invalidating | Call `invalidateFrameFxCache(layerId, frame)` after ANY stroke mutation (add, remove, clone, reorder, transform) |
| isPaintEditMode() guard | Not guarding new shortcuts | Every new single-key shortcut in paint-related features must check this |
| Tauri FS (paper textures) | Sync reads from `~/.config/efx-motion/papers/*` | Use `readDir` + `readFile` via Tauri async FS API; cache loaded textures as `HTMLImageElement` |
| previewRenderer paint layer section | Not applying luma matte before drawImage | Insert matte extraction step between renderPaintFrameWithBg and ctx.drawImage in the `layer.type === 'paint'` branch |
| selectedStrokeIds signal | Setting to same Set reference (Preact Signals won't notify) | Always create `new Set(...)` when modifying; never mutate existing Set |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| getImageData/putImageData per frame for luma matte | Jittery playback, dropped frames | Cache matte result per frame; invalidate only on paint change | >720p at 24fps (8.3M ops/frame at 1080p) |
| Paper texture loaded from disk every frame | Visible hitching during playback | Load once into HTMLImageElement cache; reuse across frames | Any resolution with disk I/O latency |
| Re-rendering all FX strokes when one stroke moves | Multi-second delay after drag | Only invalidate FX cache if moved stroke has FX style; flat strokes don't need FX re-render | >10 FX strokes per frame |
| Stroke list panel re-rendering entire list on paintVersion change | Sidebar becomes sluggish | Use memo/shouldComponentUpdate on individual stroke list items; only re-render changed items | >20 strokes per frame |
| Bezier handle drag triggering full preview render chain | Laggy handle movement | requestAnimationFrame throttle on preview; render only the paint overlay during drag, not the full compositor | Any frame with FX layers or motion blur |
| SortableJS DOM sync on every stroke reorder | Visible flicker in list | Use SortableJS onEnd (not onSort/onChange); batch DOM updates | >15 strokes in list |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Alt+drag duplicates on first pixel of movement | Accidental duplicates when Alt is held for other reasons | Require minimum 3px drag threshold before committing duplicate |
| Stroke list shows internal IDs instead of names | Unusable list for identifying strokes | Auto-name strokes by tool + number (e.g., "Brush 1", "Ink 3") |
| Bezier handles visible on all strokes at once | Visual clutter, impossible to edit specific stroke | Show handles only on selected stroke; dim or hide unselected |
| Paper texture preview not shown in properties panel | Users can't see what texture looks like before applying | Show small thumbnail preview next to texture name in picker |
| Non-uniform scale doesn't show axis constraints | Users can't tell which axis they're scaling | Show different cursor for horizontal vs vertical scale handles |
| Delete key in stroke list deletes wrong thing | Key photo, transition, or layer gets deleted instead of stroke | Route Delete through stroke list focus state before falling through to handleDelete() cascade in shortcuts.ts |
| Luma matte toggle has no visual feedback | Users don't know if matte is active or not | Show indicator in paint layer badge/icon; preview difference when toggling |
| Sequence-scoped layer creation is invisible | Users don't realize layer was added only to isolated sequence | Show sequence name in confirmation toast; highlight target sequence |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Luma matte:** Often missing un-premultiply step -- verify pastel colors survive round-trip by checking specific RGB values before/after
- [ ] **Luma matte:** Often missing export pipeline integration -- verify luma matte is applied in exportRenderer.ts, not just previewRenderer.ts
- [ ] **Paper texture:** Often missing Retina/HiDPI scaling -- verify texture tiles correctly at 2x DPI (common: texture appears half-size on Retina)
- [ ] **Paper texture:** Often missing cache invalidation when user changes texture file -- verify switching textures updates preview immediately
- [ ] **Stroke list panel:** Often missing synchronization with canvas selection -- verify clicking stroke in list selects it on canvas AND clicking on canvas selects it in list
- [ ] **Stroke list panel:** Often missing FX cache invalidation after SortableJS reorder -- verify stroke order change triggers re-render of FX strokes
- [ ] **Alt+drag duplicate:** Often missing FX state clone -- verify duplicated FX stroke retains style and fxState, not just points
- [ ] **Non-uniform scale:** Often missing p5.brush FX rendering -- verify FX strokes render with correct transform (not just flat strokes)
- [ ] **Bezier editing:** Often missing persistence -- verify bezier control points are saved in paint sidecar JSON and survive project reload
- [ ] **Sequence-scoped creation:** Often missing undo -- verify Cmd+Z after sequence-scoped layer add removes the layer from the correct sequence
- [ ] **All features:** Verify paintVersion is bumped on every visual change (automated: grep for element mutations without paintVersion++)

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Premultiplied alpha color loss in matte | LOW | Switch from getImageData/putImageData to offscreen canvas + drawImage pipeline; no data model change needed |
| Missing paintVersion bumps | LOW | Add `_notifyVisualChange` helper; find-and-replace direct mutations; 15-minute fix per callsite |
| Undo history corruption from compound operations | MEDIUM | Refactor affected operations to use snapshot-based undo (structuredClone frame state); requires testing all undo paths |
| SortableJS conflict between panels | LOW | Add group isolation and filter rules; test matrix of drag interactions; 30-minute fix |
| Non-uniform scale baked into points (can't undo) | HIGH | Must migrate all existing stroke data to add transform metadata; write migration for saved projects; multi-hour effort |
| Paper texture compositing order wrong | MEDIUM | Reorder compositing steps in previewRenderer; may need to adjust FX cache boundaries; 1-2 hour refactor |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Premultiplied alpha color loss | Luma Matte Compositing | Automated test: set known RGB+alpha via putImageData, read back, verify within tolerance |
| Missing paintVersion (existing bug) | First task of first phase | Grep audit: every `frameData.elements` mutation has corresponding paintVersion++ |
| Missing undo on reorder (existing bug) | Stroke List Panel (or earlier) | Manual test: reorder via buttons, Cmd+Z restores original order |
| SortableJS instance conflicts | Stroke List Panel | Manual test: drag stroke while layer list visible; drag layer while stroke list visible |
| Bezier drag undo flooding | Bezier Path Editing | Manual test: drag handle, Cmd+Z undoes entire drag in one step |
| Non-uniform scale outline distortion | Non-Uniform Scale | Visual test: compare uniform vs non-uniform scaled stroke at same dimensions |
| Paper + luma matte compositing order | Paper Texture (after Luma Matte) | Visual test: light strokes visible with both texture and matte enabled |
| Alt+drag ghost references | Duplicate Stroke | Test sequence: Alt+drag, Cmd+Z, Cmd+Shift+Z -- no errors, correct visual state |
| Keyboard shortcut conflicts | All phases with new shortcuts | Automated: enumerate all tinykeys bindings, verify no conflicts with isPaintEditMode guard |

## Sources

- Direct codebase analysis of `paintStore.ts` (lines 155-204: moveElements* lack paintVersion++ and pushAction)
- Direct codebase analysis of `shortcuts.ts` (lines 32-39: isPaintEditMode guard; lines 422, 439: existing guards)
- Direct codebase analysis of `previewRenderer.ts` (lines 280-303: paint layer compositing pipeline)
- Direct codebase analysis of `paintRenderer.ts` (lines 249-253: getImageData/putImageData for flood fill)
- Direct codebase analysis of `PaintOverlay.tsx` (lines 787-821: in-place point mutation during drag, no undo push)
- [Canvas getImageData premultiplied alpha quantization](https://dev.to/yoya/canvas-getimagedata-premultiplied-alpha-150b) -- HIGH confidence
- [WHATWG HTML spec issue #5365: ImageData alpha premultiplication](https://github.com/whatwg/html/issues/5365) -- HIGH confidence
- [MDN: putImageData lossy round-trip documentation](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/putImageData) -- HIGH confidence
- [SortableJS nested instances issue #1303](https://github.com/SortableJS/Sortable/issues/1303) -- MEDIUM confidence
- SPECS/FX-Paint-Compositing.md (project spec for luma matte approach)
- Project memory: "Always bump paintVersion" and "Guard shortcuts in paint mode"

---
*Pitfalls research for: v0.6.0 Various Enhancements (luma matte, paper textures, stroke management, bezier editing, UX refinements)*
*Researched: 2026-03-26*
