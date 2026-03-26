# Project Research Summary

**Project:** EFX Motion Editor v0.6.0 Various Enhancements
**Domain:** Desktop stop-motion cinematic editor — paint compositing, stroke management, and UX refinements
**Researched:** 2026-03-26
**Confidence:** HIGH

## Executive Summary

v0.6.0 is a focused enhancement milestone adding nine features to the existing paint/roto paint system: luma matte compositing, paper/canvas textures, stroke list panel, Alt+duplicate stroke, non-uniform scale, bezier/spline path editing, sequence-scoped layer creation, paint properties cleanup, and denser motion path dots. The existing stack (Tauri 2.0, Preact Signals, Canvas 2D, WebGL2, p5.brush, perfect-freehand, SortableJS) handles eight of nine features without new dependencies. Only one addition is warranted: `bezier-js ^6.1.4` for cubic spline math in the bezier path editing feature. The recommended build order follows a strict dependency chain: isolated quick wins first, then paint store/interaction extensions, then rendering pipeline changes, then the complex bezier editing feature last.

The most important architectural insight from research is that v0.6.0 features split cleanly into three layers: data model extensions (new optional fields on `PaintStroke`, `PaintElement`, and `LayerSourceData`), interaction extensions (PaintOverlay gesture variants, new edge handles), and rendering pipeline additions (post-process overlays in `paintRenderer.ts`, compositing changes in `previewRenderer.ts`). Features in each layer should be sequenced to avoid destabilizing shared surfaces. The rendering pipeline changes (luma matte, paper textures) are the highest-coordination features and should be built after the interaction changes are stable.

Research identified four pre-existing bugs that new features will expose if not fixed first: `moveElements*` methods missing `paintVersion.value++`, `moveElements*` methods missing `pushAction()` undo support, stroke drag/transform missing undo pushes, and `isPaintEditMode()` checking the wrong condition. These should be addressed as prerequisite tasks before building the features that depend on them. The highest-risk feature is bezier path editing (complex UX, novel data model, potential undo flooding). The safest mitigation is to build it last and limit scope to post-hoc path adjustment of existing strokes — no pen tool for creating new strokes via bezier.

## Key Findings

### Recommended Stack

The existing stack requires no additions for eight of the nine features. Canvas 2D `getImageData`/`putImageData` handles luma matte extraction. `createPattern()` handles paper texture tiling. SortableJS (already installed at ^1.15.7) handles stroke list drag-reorder with the proven `forceFallback: true` pattern from `LayerList.tsx`. Tauri `@tauri-apps/plugin-fs` (already configured) handles loading paper texture images from `~/.config/efx-motion/papers/`.

**Core technologies:**
- `bezier-js ^6.1.4`: cubic/quadratic bezier math for stroke path editing — only new dependency; provides `project()`, `split()`, `getLUT()`, `normal()` without reimplementing 500+ lines of finicky math; ESM, zero deps, actively maintained
- Canvas 2D `getImageData`/`putImageData`: luma matte pixel extraction — native API, no library needed; escalate to WebGL2 shader only if perf is insufficient at target resolution
- SortableJS (existing ^1.15.7): stroke list drag-reorder — proven pattern from `LayerList.tsx`, `forceFallback: true` required for Tauri; `group` isolation required to avoid conflict with existing instances
- `@tauri-apps/plugin-fs` (existing): paper texture file loading — `readDir` + `readFile` pattern already used in `paintPersistence.ts`; async only, never sync
- Paper.js, Fabric.js, konva, bezier-easing: explicitly excluded — wrong scope, wrong paradigm, or already covered by existing stack

### Expected Features

Features were validated against professional VFX tools (Nuke RotoPaint, Silhouette) and digital painting tools (Krita, Rebelle, Procreate) to establish what users expect.

**Must have (table stakes) — users expect these in any paint/roto tool:**
- Stroke list panel with visibility toggle, drag-reorder, delete — every roto tool has this; without it, complex roto work is unmanageable
- Duplicate stroke with Alt+move — universal Figma/Photoshop/After Effects pattern; absence is jarring
- Paint properties panel cleanup — professional tools optimize panel space; current 500+ line component is a maintainability and UX liability
- Sequence-scoped layer creation — standard After Effects behavior; layers belong to the composition you're working in
- Denser motion path dots — visual clarity improvement for short sequences; trivial implementation

**Should have (competitive differentiators):**
- Luma matte compositing — transforms paint from opaque overlay to compositing element; standard VFX workflow (Nuke, Silhouette)
- Paper/canvas texture on paint layer — professional digital painting standard (Krita, Rebelle, Procreate); adds physical quality
- Non-uniform scale for strokes — standard Figma/Photoshop transform; independent X/Y axis scaling
- Bezier/spline stroke path editing — professional path editing (Nuke RotoPaint, Illustrator); converts freehand to editable curves

**Defer (anti-features — explicitly out of scope for v0.6.0):**
- Full vector pen tool (create strokes from scratch via bezier) — scope creep; bezier editing should be limited to post-hoc adjustment of existing freehand strokes
- Real-time paper texture during brush rendering — requires p5.brush shader modification; post-process overlay achieves the same visual result without touching the brush engine
- Per-stroke paper texture — breaks batch FX cache rendering; per-layer texture covers the use case
- Luma matte with full curve editor — over-engineering; threshold + softness covers 95% of use cases

### Architecture Approach

All nine features integrate into the existing three-layer architecture without requiring a new rendering subsystem. The rendering pipeline follows a clear post-process order: render strokes (existing) → paper texture overlay (F2, new post-process pass) → luma matte extraction (F1, modifies compositing in `previewRenderer.ts`) → composite onto photo layer. The interaction layer extends `PaintOverlay.tsx` with new gesture variants (Alt+drag for duplicate, edge handles for non-uniform scale, anchor handles for bezier editing) without changing the underlying event model. The data model uses backward-compatible optional fields throughout, with a single `.mce` format bump to v16 covering the two fields that go into the project file (luma matte composite mode, paper texture path/settings).

**Major components and their v0.6.0 responsibilities:**
1. `types/paint.ts` + `types/layer.ts` — data model extensions: `compositeMode`, `paperTexture`, `visible`, `anchors` fields (all optional, backward-compatible)
2. `stores/paintStore.ts` — new store methods: `toggleElementVisibility`, `reorderElements`, `_notifyVisualChange` helper; fix existing `moveElements*` bugs
3. `lib/paintRenderer.ts` — post-process pipeline: paper texture overlay pass, luma matte render variant (skip bg fill)
4. `lib/previewRenderer.ts` — compositing branch: luma matte extraction step between `renderPaintFrameWithBg` and `ctx.drawImage`
5. `components/canvas/PaintOverlay.tsx` — gesture extensions: Alt+duplicate, edge handles for non-uniform scale, bezier anchor handles
6. `components/sidebar/StrokeListPanel.tsx` (new) — SortableJS stroke list with selection sync, visibility toggle, delete
7. `lib/paperTextures.ts` (new) — async texture load + HTMLImageElement LRU cache
8. `lib/pathSimplify.ts` (new) — Douglas-Peucker point reduction for bezier anchor generation

### Critical Pitfalls

1. **Premultiplied alpha round-trip destroys colors in luma matte** — `getImageData` → modify alpha → `putImageData` quantizes RGB at low alpha values; pastel strokes will shift hue or posterize. Avoid by rendering to an offscreen canvas, applying luma extraction, then compositing via `ctx.drawImage()` (GPU path). Un-premultiply RGB before writing modified alpha.

2. **Missing `paintVersion.value++` makes visual changes invisible** — `moveElements*` methods already have this bug today; all new features will replicate it. Create `_notifyVisualChange(layerId, frame)` helper (markDirty + paintVersion++ + invalidateFrameFxCache) as the first task of the milestone. Grep-audit every `frameData.elements` mutation.

3. **Missing undo on stroke reorder (existing bug, exposed by stroke list panel)** — `moveElements*` methods have no `pushAction()` calls. Fix before building the stroke list panel that elevates reordering to a primary interaction. Add `reorderElements(fromIdx, toIdx)` with proper undo/redo snapshots.

4. **Non-uniform scale breaks `perfect-freehand` rendering** — scaling `stroke.points` with different X/Y factors distorts perpendicular outline offsets (isotropic `size` doesn't know about the aspect ratio change). Solution: store `scaleX`/`scaleY` as stroke transform metadata and apply via `ctx.scale()` at render time, not by mutating points.

5. **Bezier control point drag floods undo history** — 60+ undo entries per second during continuous drag. Solution: snapshot on `pointerdown`, mutate freely during drag with `paintVersion++`, push a single undo action on `pointerup` with before/after state.

## Implications for Roadmap

Based on research, the optimal four-phase structure is driven by three constraints: (1) existing bugs must be fixed before the features that expose them, (2) rendering pipeline features should be built after interaction features are stable, (3) the highest-risk feature (bezier editing) comes last.

### Phase 1: Foundation + Quick Wins

**Rationale:** Three features are completely isolated with zero cross-dependencies. Two are pure UI/routing changes. One is a 5-10 line change to a pure function. Building these first delivers immediate value while establishing the `_notifyVisualChange` helper and fixing pre-existing bugs that would contaminate every subsequent phase.

**Delivers:** Denser motion path dots (5-10 line change to `sampleMotionDots()`), paint properties panel cleanup (component extraction + layout compaction), sequence-scoped layer creation (routing change in `AddLayerMenu`/`AddFxMenu`), `_notifyVisualChange` helper, fixed `moveElements*` paintVersion bug, fixed `moveElements*` undo bug.

**Addresses:** F7 (denser motion path), F5 (paint properties cleanup), F6 (sequence-scoped layers) from FEATURES.md.

**Avoids:** Pre-existing `paintVersion` and undo bugs cascading into Phase 2+ features; `_notifyVisualChange` created here prevents the most common visual-mutation bug in all later phases.

**Research flag:** No deeper research needed. All three features have deterministic implementations with no open design questions.

### Phase 2: Paint Store Interactions

**Rationale:** Duplicate stroke, non-uniform scale, and stroke list panel all extend `PaintOverlay.tsx` and `paintStore`. They share the same surface area and are best built together. The stroke list panel also unblocks Phase 4 (bezier editing benefits from precise stroke selection UX). Non-uniform scale must use the transform-metadata approach (not point mutation) to avoid the `perfect-freehand` distortion pitfall — this is the critical design decision for this phase.

**Delivers:** Alt+duplicate stroke with compound undo, non-uniform scale via stored `scaleX`/`scaleY` transform metadata applied at render time, stroke list panel (SortableJS with unique group name, visibility toggle, selection sync bidirectional with canvas).

**Addresses:** F3 (duplicate stroke), F4 (non-uniform scale), F9 (stroke list panel) from FEATURES.md.

**Avoids:** Non-uniform scale distortion pitfall (transform metadata, not point mutation); SortableJS instance conflict pitfall (unique `group` name, `filter` rules on parent LayerList, `destroy()` on unmount); Alt+drag undo ghost reference pitfall (compound undo action: snapshot-on-pointerdown, single push on pointerup).

**Research flag:** No deeper research needed. SortableJS pattern directly clones `LayerList.tsx`. Non-uniform scale solution (transform metadata + canvas transform) fully documented in research.

### Phase 3: Rendering Pipeline

**Rationale:** Luma matte and paper textures both modify `paintRenderer.ts` and `previewRenderer.ts`. The compositing order matters: paper texture must be applied before luma matte extraction, or texture white areas incorrectly inflate matte alpha, producing strokes more transparent than intended. Building after Phase 2 ensures the paint interaction layer is stable before touching the shared rendering pipeline. Both features also need the `_notifyVisualChange` helper from Phase 1 and should be kept downstream of the FX cache (never baked in).

**Delivers:** Luma matte compositing (threshold, softness, invert toggle, offscreen-canvas-based luma extraction to avoid premultiplied alpha round-trip, export pipeline parity in `exportRenderer.ts`), paper/canvas texture overlay (per-layer, user-loadable from `~/.config/efx-motion/papers/`, async load + LRU cache, multiply/overlay blend, Retina/HiDPI scaling), `.mce` format bump to v16.

**Addresses:** F1 (luma matte), F2 (paper texture) from FEATURES.md.

**Avoids:** Premultiplied alpha round-trip color loss (offscreen canvas + drawImage pipeline, un-premultiply before writing alpha); paper+matte compositing order conflict (texture before matte in `paintRenderer.ts` post-process chain); luma extraction performance trap (cache alongside `_frameFxCache`, invalidate on same triggers); paper texture blocking main thread (async Tauri FS load with loading indicator, never sync).

**Research flag:** Luma matte pixel processing at 1920x1080 + 24fps may require a performance spike. If Canvas 2D is insufficient, the escalation path is a WebGL2 shader following the `glBlur.ts` pattern. Flag for implementation-time decision; no separate research phase needed, the escalation architecture is already fully documented.

### Phase 4: Bezier Path Editing

**Rationale:** The most complex feature in the milestone. Benefits from Phase 2 (stroke list panel for precise stroke selection, edge handle pattern informing anchor handle UX) and Phase 2/3 (stable rendering pipeline for reliable visual feedback during editing). Limited scope is the key risk mitigation: post-hoc path adjustment of existing freehand strokes only. No pen tool. Use Douglas-Peucker point simplification (Path A from architecture research) rather than full cubic bezier fitting to avoid curve-fitting quality risk.

**Delivers:** Bezier path editing mode (enter via double-click or stroke list button on selected stroke), Douglas-Peucker anchor point handles rendered on canvas overlay, drag anchor to reshape path, Delete key to remove anchor, single undo action per drag gesture (snapshot-on-pointerdown / push-on-pointerup), persistence in paint sidecar JSON as optional `anchors` field.

**Addresses:** F8 (bezier/spline path editing) from FEATURES.md.

**Avoids:** Undo history flooding from continuous drag (snapshot + single-push pattern from Phase 2); keyboard shortcut conflicts (all new shortcuts guarded with `isPaintEditMode()`); bezier handles visible on all strokes simultaneously (show handles only on selected stroke, hide on deselect); bezier anchors not persisting across project reload (save `anchors` field in sidecar JSON).

**Research flag:** Phase 4 needs `/gsd:research-phase` before planning. Key unknowns requiring prototyping: (1) Douglas-Peucker tolerance calibration for dense pressure-variable freehand stroke points — too tight produces unwieldy anchor counts, too loose loses the stroke shape; (2) re-densification quality (going from edited anchors back to a dense `points[]` array that renders identically through `perfect-freehand`); (3) UX for entering/exiting path edit mode without conflicting with existing double-click behaviors in select mode.

### Phase Ordering Rationale

- Phase 1 first because pre-existing bugs (`moveElements*` missing paintVersion++ and undo) will be triggered by Phase 2 and Phase 3 features. Fixing them proactively is higher leverage than any new feature.
- Phase 2 before Phase 3 because paint interaction model (PaintOverlay, paintStore) is shared with rendering pipeline tests. Stable interactions make it easier to isolate rendering bugs during Phase 3 work.
- Paper texture (F2) built before or concurrent with luma matte (F1) within Phase 3 because the compositing order (`texture → matte → composite`) must be established first; building them in isolation and merging risks ordering confusion.
- Phase 4 last: highest-risk feature, most open design questions, depends on stable stroke selection UX from Phase 2 and stable rendering feedback from Phase 3. Failure mode here is bounded (complex editing feature, not core workflow).

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (Bezier Path Editing):** Douglas-Peucker tolerance calibration and re-densification quality are empirical unknowns. Recommend `/gsd:research-phase` before planning Phase 4. The bezier-js library itself is well-documented; the unknowns are specific to integrating it with `perfect-freehand`'s rendering model.
- **Phase 3 (Luma Matte performance):** Whether Canvas 2D pixel processing is sufficient at 1920x1080 + 24fps is unknown without profiling. This is a quick spike during Phase 3 planning, not a full research phase — the WebGL2 escalation path is already fully specified in the research files.

Phases with standard patterns (skip research-phase):
- **Phase 1:** All three features have deterministic, fully-specified implementations. Motion path step change is 5-10 lines. Panel cleanup is pure component extraction. Sequence-scoped routing is a single conditional.
- **Phase 2:** SortableJS pattern is a direct clone of `LayerList.tsx`. Non-uniform scale via canvas transform is a proven approach. Alt+duplicate is ~30 lines in `PaintOverlay.tsx`.
- **Phase 3 (Paper Texture):** Canvas 2D `createPattern()` + Tauri async FS is well-established. The main risk (HiDPI scaling) is documented with the fix.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Existing stack verified against codebase; bezier-js selection backed by direct API comparison against alternatives; no speculative dependencies |
| Features | HIGH | Validated against Nuke RotoPaint, Krita, Rebelle, Figma, After Effects with official documentation; competitor analysis grounded in real tool workflows |
| Architecture | HIGH | All 9 features analyzed against actual source files; line numbers cited for every modified component; build order derived from verified dependency graph |
| Pitfalls | HIGH | Pre-existing bugs verified by direct code inspection with line numbers; Canvas 2D premultiplied alpha behavior backed by WHATWG spec and MDN; SortableJS conflict pattern backed by upstream issue tracker |

**Overall confidence:** HIGH

### Gaps to Address

- **Luma matte performance at target resolution:** Canvas 2D `getImageData`/`putImageData` throughput at 1920x1080 + 24fps on M-series Macs is empirically unknown. Research documents the WebGL2 escalation path, but the decision requires a prototype. Address with an early spike during Phase 3 planning.
- **Douglas-Peucker tolerance calibration:** The right tolerance for freehand brush stroke points (dense, pressure-variable) requires empirical testing. Address with a prototype before Phase 4 planning — this is the primary driver for the Phase 4 research flag.
- **Bezier-to-points reconversion quality:** After editing bezier anchors, the re-densified `points[]` array must produce visually identical `perfect-freehand` output. Whether the result feels natural is subjective and requires user testing. Flag for Phase 4 acceptance criteria.
- **Paper texture at Retina/HiDPI:** Research flagged that texture tiles appear half-size on Retina displays without explicit `devicePixelRatio` handling in pattern creation. Document as a required implementation checklist item for Phase 3.

## Sources

### Primary (HIGH confidence)
- Existing codebase (`LayerList.tsx`, `previewRenderer.ts`, `paintStore.ts`, `PaintOverlay.tsx`, `ipc.ts`, `brushP5Adapter.ts`, `MotionPath.tsx`, `paintRenderer.ts`, `shortcuts.ts`) — direct code inspection, all architectural claims verified with file and line number references
- [bezier-js GitHub](https://github.com/Pomax/bezierjs) — v6.1.4 API verified, 354+ commits, actively maintained
- [bezier-js documentation](https://pomax.github.io/bezierjs/) — full API reference for all curve methods
- [MDN getImageData](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/getImageData) — premultiplied alpha behavior documented
- [MDN putImageData](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/putImageData) — lossy round-trip documented
- [MDN globalCompositeOperation](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation) — blend mode reference
- [MDN bezierCurveTo](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/bezierCurveTo) — Canvas 2D bezier rendering
- [MDN Pixel manipulation with canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Pixel_manipulation_with_canvas) — getImageData/putImageData for luma matte
- [Nuke RotoPaint Stroke/Shape List](https://learn.foundry.com/nuke/content/comp_environment/rotopaint/working_stroke_shape_list.html) — stroke list UI patterns
- [Nuke Bezier Tools](https://learn.foundry.com/nuke/content/comp_environment/rotopaint/using_bezier_tools.html) — bezier editing keyboard modifiers, tangent behavior
- [Krita Texture Brush Settings](https://docs.krita.org/en/reference_manual/brushes/brush_settings/texture.html) — texture modes and blend settings
- [WHATWG HTML spec issue #5365](https://github.com/whatwg/html/issues/5365) — ImageData alpha premultiplication spec confirmation
- [Canvas getImageData premultiplied alpha analysis](https://dev.to/yoya/canvas-getimagedata-premultiplied-alpha-150b) — color loss documentation with examples

### Secondary (MEDIUM confidence)
- [Tauri asset protocol discussion](https://github.com/orgs/tauri-apps/discussions/11498) — v2 image loading patterns for paper textures
- [SortableJS nested instances issue #1303](https://github.com/SortableJS/Sortable/issues/1303) — instance conflict behavior documentation
- [Frame.io Mattes Guide](https://workflow.frame.io/guide/mattes) — luma vs alpha matte fundamentals
- [Rebelle Paper Textures](https://www.escapemotions.com/blog/enhancing-your-digital-paintings-with-textures-in-rebelle) — scanned paper workflow
- [Krita-Artists Canvas Texture Discussion](https://krita-artists.org/t/canvas-texture-overlays/40905) — overlay blend technique
- [Figma Alt+Drag Duplicate](https://help.figma.com/hc/en-us/articles/4409078832791-Copy-and-paste-objects) — standard duplicate gesture documentation

### Tertiary (LOW confidence, needs validation)
- @types/bezier-js@^4.1.3 compatibility with bezier-js@^6.1.4 — DefinitelyTyped types may need minor augmentation for v6-specific methods; verify at install time

---
*Research completed: 2026-03-26*
*Ready for roadmap: yes*
