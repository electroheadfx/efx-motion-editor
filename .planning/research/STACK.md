# Stack Research

**Domain:** v2.1.0 stack delta — rail motion channels, interpolation curve families, Studio timeline horizontal zoom, vector painting + painted-stroke curve editing
**Researched:** 2026-11-06
**Mode:** Ecosystem (stack additions/changes for NEW capabilities only; the shipped Tauri 2.11.5 / Preact 11.1.1 / signals 2.11.3 / pnpm / Rust stack is not re-researched)
**Confidence:** HIGH on the "no new runtime dependency" verdict and on every integration point (verified against installed package sources and the live repo); MEDIUM on per-vertex watercolour feasibility (engine capability boundary — needs a phase-level spike); MEDIUM on the product fit of B-spline for motion channels (non-interpolating basis — a design call, not a technical one).

---

## Headline Verdict

**Zero new runtime dependencies are required for (a), (b), (c) and (d).** Every capability lands on libraries already installed, plus pure in-repo math and the existing Canvas 2D compositor. The repo's own v2.1.0 UI contract already states the bar (`README.md` §5 UAT 13: "no new dependencies"), and the stack supports that bar honestly — not as a compromise.

There is exactly **one defensible optional addition**: `bezier-easing@3.2.0` (MIT, zero dependencies, 17.8 kB unpacked, ships its own types) — a 40-line cubic-bezier `x → t` solver that `bezier-js` does not provide. Recommendation: **write the solver in-repo anyway.** `bezier-easing` is the contingency only if owning the numeric solver is judged riskier than a dependency.

Everything else on the "obvious" shortlist is either redundant with an installed library, a time-based animation runtime that conflicts with the frame-indexed determinism law, a full vector-editor scene graph that would replace rather than augment the existing architecture, or a licence that is not GPL-compatible.

---

## Recommended Stack

### Core Technologies (reuse — no version changes)

| Technology | Installed version | Licence | Purpose in v2.1.0 | Why it fits |
|---|---|---|---|---|
| Canvas 2D `ctx.translate/rotate/scale/drawImage` | WKWebView built-in | platform | Rail transform application at the compositor (position / scale / rotation / opacity) | The compositor already applies a transform this exact way for the Background clip (`efxPaintCompositor.ts:397-422`) and the layer path (`previewRenderer.ts:1333-1340`, `1420-1427`). Motion is a second transform in the same chain — no matrix library, no scene graph. |
| `DOMMatrix` | WKWebView built-in | platform | Optional matrix composition / inspection in tests | Already used in production (`TimelineRenderer.ts:1337`). Covers any matrix need a rail transform has; a matrix package would be pure duplication. |
| `bezier-js` | **6.1.4** | MIT | Cubic Bézier evaluation, segment split, nearest-point projection, length, LUT | Already the path-math authority in `app/src/lib/bezierPath.ts` (split at `insertAnchorOnSegment`, project at `findNearestSegment`). Every new curve family converts to cubic Bézier segments, so this one library keeps serving all of them. |
| `fit-curve` | **0.2.0** | MIT | Freehand `[x,y,pressure][]` → cubic Bézier anchors | Already used by `pointsToBezierAnchors`. The vector tool and painted-stroke editing both consume it unchanged. |
| `perfect-freehand` | **1.2.3** | MIT | Flat stroke outline rendering from sampled points | Already the flat renderer. **Capability boundary:** one global `size`, one colour per stroke; per-point pressure only (installed `types.d.ts` verified). Per-vertex size/colour therefore needs segment runs or a custom outline — no library fixes this. |
| `lucide-preact` | **1.57.0** | ISC | `PenTool` and `SplinePointer` tool icons | **Both icons are already exported by the installed version** (verified in `lucide-preact.d.ts`). No upgrade, no icon package, no custom SVG. |
| `@preact/signals` | **2.11.3** | MIT | Session zoom signal, motion/evaluator-facing signals | Existing reactivity law; zoom is session-only display state like the shipped canvas zoom. |
| `@efxlab/efx-paint-host` | workspace 0.1.0 | GPL-3.0-or-later | Deterministic seeded noise (`fnv1a`, `seededRng`, `seededDraw`, `seededRange`) and the generic `StudioStroke<P>` payload for vector strokes | The determinism primitives are already public package exports and already imported by app code. `seededDraw(seed, slot, drawKey)` is stateless — the correct primitive for a frame-keyed wiggle. |
| `@efxlab/efx-watercolor` | workspace 0.1.0 | GPL-3.0-or-later | Rendering target for vector/painted strokes in the Studio | The engine's stamp model is fixed-radius-per-stroke and single-colour-per-stroke (`engine/deposit.ts:540-595`) — see (d) for what that means for per-vertex properties. |
| `vitest` | **2.1.9** | MIT | Curve evaluator, zoom law, schema pins | Existing test runner. Include pattern is `src/**/*.test.ts` + host tests only (`app/vitest.config.ts:5`). |

### New Dependencies

| Need | Can it be built with what is installed? | New dependency required? |
|---|---|---|
| 2D transform channels (a) | Yes — Canvas 2D transforms + signals + document schema | **No** |
| Bézier / Hermite / Catmull-Rom / TCB / B-spline / hold / ease (b) | Yes — all are pure scalar math; `bezier-js` covers the path side | **No** (optional `bezier-easing@3.2.0`, see above) |
| Seeded wiggle (b) | Yes — `seededDraw`/`fnv1a` from the paint host + ~20 lines of value-noise smoothing | **No** |
| Cursor-anchored horizontal zoom (c) | Yes — pure arithmetic; the anchored-pan law already exists as a pattern | **No** |
| Vector painting with editable Bézier paths (d) | Yes — `bezier-js` + `fit-curve` + `sampleBezierPath` + `perfect-freehand` | **No** |
| Per-vertex paint properties (d) | Geometry: yes. Watercolour per-vertex radius/pigment: **not supported by the current engine** — engine payload/renderer work, not a library | **No** (feasibility flag, not a dependency) |

### Development Tools

| Tool | Purpose | Notes |
|---|---|---|
| `vitest run` (2.1.9) | Golden tests for each curve family; phase-by-phase pins | New tests must be `.test.ts` (the include pattern does not collect `.test.tsx`). The watercolor package's own `.test.ts` files are **not** collected today — if Phase 61 extends the engine, either put the tests under `app/src/**/*.test.ts` or deliberately extend the include; do not treat a green suite as engine coverage. |
| `tsc --noEmit` (TypeScript ~5.9.3) | Type gates for the new public types | Existing shims `app/src/types/bezier-js.d.ts` and `app/src/types/fit-curve.d.ts` stay as-is. |

---

## Capability-by-Capability

### (a) 2D transform keyframe animation on timeline rails

**Verdict: build entirely on the existing stack. No new dependency.**

**Data model.** Add a new rail-motion record (a small closed type) to the v1.0 EFX Paint document — `app/src/efx-paint/document/efxPaintDocument.ts` — carried on the loop clip / rail identity. Do **not** reuse `PhysicPaintRotoLoopClip.motion` (`PhysicPaintRotoScriptMotionSettings`, `physicsPaintRotoPhysicalModel.ts:237-247`): that is the shipped per-stroke deformation system and the milestone context explicitly forbids merging the two. The name is also already load-bearing — the canonical loop-clip encoder reads `clip.motion!.deformation/position/rotation/scale` under `scriptId` (`physicsPaintRotoPhysicalModel.ts:1634-1639`), so name the new record distinctly (e.g. `railMotion`) rather than widening that union.

Store each channel as a **scalar** channel internally (`x`, `y`, `scaleX`, `scaleY`, `rotation`, `opacity`) even when the UI presents Position as one lane. Grouping is a presentation concern; independent per-axis curves are a Maya/Softimage requirement and the v2 prototype calls for them. Each key carries its outgoing interpolation settings (curve kind + params), matching the existing `Keyframe.easing` "curve to the NEXT keyframe" law (`types/layer.ts:80`).

**Evaluation.** New pure module, e.g. `app/src/lib/railMotion.ts`:
- `evaluateRailMotion(record, occurrenceLocalFrame) -> {x, y, scaleX, scaleY, rotation, opacity}`.
- Rail-local / occurrence-local frame, never the source-cycle frame. A cycled rail must keep cycling content while motion continues across the full occurrence (CONTEXT §3.5) — evaluating in source-cycle time would reset motion every cycle.
- Reuse the mutable-result pattern from `keyframeEngine._interpolateAtMutable` to avoid allocation on the playback hot path.
- Pure and total: no store imports, no `Math.random()`, no wall clock, integer frames only.

**Application point.** `app/src/efx-paint/compositor/efxPaintCompositor.ts`, the per-track draw loop (`:326-352`):
`ctx.save()` → `ctx.globalAlpha = track.opacity * railOpacity` → translate to the content centre → `ctx.rotate` → `ctx.scale` → `ctx.drawImage(resolution.raster, ...)` → `ctx.restore()`. This is the same shape as the Background transform block at `:414-422`.

**Cache law (critical).**
- The **per-track raster memo** (`deriveEfxPaintTrackContentKey`) must stay motion-free: motion is draw-time, so the content raster is reused and no re-bake happens (the spec's "content cycles, motion continues, no re-bake").
- The **flattened memo key needs no new term** when the motion record lives on `PhysicPaintRotoLoopClip` and joins `encodeCanonicalLoopClips`. Verified chain: `_trackContentRevision` (`physicPaintStore.ts:1629-1635`) returns the track's `structural.contentRevision`; `buildPhysicPaintRotoPhysicalRevision` (`physicsPaintRotoPhysicalModel.ts:1460`) already includes `loops:${encodeCanonicalLoopClips(loopClips)}` (`:1570`). Adding the motion field to that encoder — **and to the Rust twin `canonical_loop_clips` in `app/src-tauri/src/services/script_library.rs` at the identical ordinal** — rotates the physical revision, the per-track content term and the flattened key together. No motion edit can serve a stale flattened raster, at any frame.
- The **real trap is the encoder allowlist, not the cache key.** `encodeCanonicalLoopClips` deliberately omits `photoWiggle`, `keyScriptEdits` and `paintSeedVariation` (`:1643-1657`) because each write accompanies a re-bake that already moves the key bytes. Motion is the opposite case — it changes compositor output with **no** bake — so it must be a canonical term, exactly like `railKind` (`:1629`). Reusing the "excluded anyway" reasoning would ship a cache that ignores motion edits.
- **Gate B caveat:** if motion also attaches to bare Key Rails via a `railId` outside the loop-clip collection, the owning rail record's revision builder must include it; loop clips no longer cover that case.

**Schema / persistence.** New optional field on the rail record, absent = no motion, no migration code (consistent with the v2.0.0 clean-break law). Because the EFX Paint document rides opaquely in Rust (`MceProject` carries `efx_paint_documents: HashMap<String, Value>`, `app/src-tauri/src/models/project.rs:38-42`), verify whether a Rust struct change is actually required; the `mceFieldContract.test.ts` diff and the document parser (`efxPaintDocumentParsers.ts`) plus canonical encoder/revision fixtures are the real gates. Requirement from PROJECT.md still applies: declare the field in both languages where a typed struct exists.

**Quality at scale (Gate D).** Canvas 2D resamples the raster. Set `ctx.imageSmoothingQuality = 'high'` and/or bake 2× (the Rust WebP codec and `createImageBitmap` resize path already exist). No library.

---

### (b) Interpolation curve families + seeded wiggle + hold/ease

**Verdict: one in-repo pure math module. No new dependency.**

**One evaluator covers three families exactly.** Kochanek-Bartels (TCB) is an interpolating cubic Hermite spline. With per-key tangents:

```
p(t) = h00(t)·P0 + h10(t)·m0 + h01(t)·P1 + h11(t)·m1
h00 = 2t³-3t²+1   h10 = t³-2t²+t   h01 = -2t³+3t²   h11 = t³-t²
```

- **Hermite** = explicit tangents.
- **Catmull-Rom** = the TCB special case T = C = B = 0, tangent = (P[i+1] − P[i−1]) / 2.
- **TCB** = tension / continuity / bias weights on the neighbour differences (formulas verified against the sources below).
- **Non-uniform key spacing** (the normal case here — keys live on arbitrary frames): scale tangents by segment durations using the documented time-aware variant, not the uniform formula.
- **Endpoints**: phantom keys or one-sided tangents; decide per channel and pin it with a golden fixture.

**B-spline is different and must be labelled honestly.** Uniform cubic B-spline is an *approximating* basis: the curve does not pass through its control keys. Recommendation: **do not offer B-spline for motion channels** (users will set a key and watch the value miss it). Offer it only for vector path smoothing, where approximating is desirable. If it must exist in the curve picker, convert it to Bézier segments via the standard uniform-B-spline-to-Bézier formula and label it "approximating".

**Bézier** is a *per-segment time warp*, not a value interpolant: `t' = cubicBezierEase(t)` then lerp. `bezier-js` does **not** expose an `x → t` solver (verified: `get`, `derivative`, `project`, `split`, `length`, `getLUT`, `reduce` only — `project` is nearest-point, not an easing solve). Implement the standard Newton-Raphson + bisection fallback (~40 lines) and golden-test it against known CSS `cubic-bezier` values. This is the only place where a dependency was even defensible (`bezier-easing@3.2.0`, MIT, zero deps, ships types).

**Hold** = step (`value = value of previous key`). **Ease** = a UI action that writes Bézier handle values on the selected motion key(s) (an "Easy Ease" generator), not a distinct interpolation family.

**User-facing curve set (opinionated):** `Hold · Bézier (handles) · Catmull-Rom (smooth auto) · TCB (advanced tension/bias/continuity)`. Hermite stays the internal basis; B-spline stays path-only.

**Every family is representable as cubic Bézier segments.** Hermite/CR/TCB → Bézier via `cp1 = P0 + m0/3`, `cp2 = P1 − m1/3`. B-spline → Bézier via the fixed uniform conversion. Consequence: the 18px motion-lane curve (`MOTION-CHANNELS.tsx` renders `<path d={curvePath}>`) is generated exactly, with no sampling and no charting library, from the same math that evaluates playback and export.

**Seeded wiggle.** Use `seededDraw(seed, slot, drawKey)` (stateless, exported by `@efxlab/efx-paint-host`) to generate value-noise knots, and smooth between them with Hermite/smoothstep. Key the hash by rail identity + channel id + **rail-local integer frame**; stream-key the channel (`'position-x'`, `'rotation'`, …). This gives the same pixels in preview and export by construction. Never `Math.random()`. Amplitude/frequency live on the Motion key, consistent with the "Ease/Wiggle/Hold belong to Motion keys" law. Do not use the paint-specific `traceShapeNoise`/`mixStrokeSeed` — they are arc-length/paint-frame keyed, not rail-time keyed.

**Shared math, not a second evaluator.** Extract the scalar primitives into `app/src/lib/curveMath.ts` (Hermite basis, tangent policies, cubic-bezier solve, step, value-noise). `keyframeEngine.ts` and the new motion module both consume it. Do **not** rewrite the shipped layer keyframe semantics or extend `EasingType`'s existing switch (it is also used by `transitionEngine.ts`); add the richer curve union in the new module.

---

### (c) Studio timeline horizontal zoom

**Verdict: pure arithmetic. No new dependency.**

The frame→pixel mapping is a hard-coded `ROTO_CELL_WIDTH_PX = 18` at `PhysicsPaintWorkflowStrip.tsx:605`, referenced **56 times in that file** (65 across the view directory), and **pinned by a source-string test** at `PhysicsPaintWorkflowStrip.test.ts:936` (`expect(code).toContain('ROTO_CELL_WIDTH_PX = 18')`). Phase 60 must therefore:

1. Replace the constant use sites with one derived pitch, e.g. `resolveTimelinePitch(zoom) = TIMELINE_GEOMETRY.cellPitch * zoom` (base pitch 18 lives in `view/timelineRailDesign.ts:97-113`).
2. Thread that pitch through ruler ticks, playhead, scroll/seek, drag ghosts, sound stains, scroll-to-frame, and the `repeat(${n}, ${pitch}px)` grid. The v7 rail-line width rule (`frameCount × pitch − gap`) already consumes the pitch — no rule change.
3. Deliberately update the pinned test (the pin is a contract, not an obstacle).

**Anchoring math** (cursor fixed under the wheel): `frameAtCursor = (cursorX − railStart) / pitch`; after zoom, `scrollFrame' = frameAtCursor − (cursorX − railStart) / pitch'`. Button steps and Fit anchor on the playhead, falling back to the viewport centre. This is the same anchor-preservation law as the shipped canvas zoom (`physicsPaintCanvasZoom.ts::resolveCursorAnchoredPan`, pure and tested) — reuse the *pattern and helper shape*, not the module, because the timeline scrolls instead of centre-panning.

Also reuse the existing preset/step law shape: `PHYSICS_PAINT_ZOOM_PRESETS`, `clampZoomScale`, `nextScalePreset` (`physicsPaintCanvasZoom.ts:96-121`). Presets `[0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]`, session-only signal, reset on Studio close, no document/schema/export change.

**Do not** implement zoom as CSS `transform: scaleX()` or browser page zoom: both scale row heights, fonts and hit targets, violate the "frame density only" scope, and break pointer math.

---

### (d) Vector painting tool + painted-stroke curve editing

**Verdict: reuse the existing Bézier architecture. No new dependency. One feasibility flag on per-vertex watercolour.**

**Canonical geometry already exists.** `app/src/lib/bezierPath.ts` + `BezierAnchor` (`types/paint.ts:46-54`) are the project's anchor model: absolute anchor + `handleIn`/`handleOut` + `cornerMode`, with split (`insertAnchorOnSegment`), projection (`findNearestSegment`), hit-testing, and sampling (`sampleBezierPath`). Do not introduce a second path type.

**Curve family = handle-generation policy, not a new geometry engine.** Store cubic Bézier anchors; compute handles from neighbours for Catmull-Rom / smooth, from TCB parameters for TCB, via the uniform formula for B-spline, and leave them user-owned for corner/Bézier mode. Because every family converts to cubic segments (see (b)), `bezier-js` keeps serving split/project/length and `sampleBezierPath` keeps serving render densification. One geometry, five editing behaviours.

**Freehand → vector.** `fit-curve` unchanged (`pointsToBezierAnchors`), with the existing tolerance-clamping loop. Painted-stroke editing (Phase 62) starts from the stroke's recorded points, fits anchors, then edits as above — the stroke keeps its paint payload.

**Per-vertex paint properties — geometry side.** Extend `BezierAnchor` with an optional `properties` field (e.g. `{ size?, color?, opacity? }`). Optional and absent-means-stroke-level keeps every existing stroke valid; the renderer interpolates along the segment. This is a type/schema change, not a library need.

**Per-vertex paint properties — Studio/watercolour side (feasibility flag).**
- `perfect-freehand` cannot vary size or colour per point; variable width is pressure + `thinning` only.
- The watercolour engine stamps with a **fixed radius per stroke** and a **single stroke colour** (`engine/deposit.ts:540-595`: `radius` from the brush response, `color` from `stroke.engine.color`); per-point pressure modulates pigment **strength**, not radius.
- Therefore per-vertex size/colour requires either (i) **segment runs** — split the path into runs and record each as its own stroke with its own size/colour, reusing the shipped script/bake/cache path unchanged, or (ii) a **payload extension** — add a per-vertex style array to `AquarelleStrokePayload` (the opaque `engine: P` slot, which the host contract deliberately never inspects) and teach `stampAt` to honour it.
- Both are engine/app work, not a dependency. Recommendation: **segment runs for the first ship** (zero engine risk, existing cache/determinism), with the payload extension as the follow-up if brush-continuity at run seams is unacceptable. Budget a spike in Phase 61 to measure seam quality and stroke-count cost before locking the data model.

**Where the vector stroke lives.** Keep `StudioStroke<P>` untouched (host-split import graph is pinned). Vector geometry and per-vertex styles ride inside `AquarelleStrokePayload` (`packages/efx-watercolor/src/payload/toStudioStroke.ts:63-75`) or in an app-level vector record; the host never needs to know what a Bézier is. Every new persisted field is a `.mce` field and must follow the dual-declaration / parser / fixture law.

**Icons and wireframe.** `PenTool` and `SplinePointer` already exist in `lucide-preact@1.57.0` (verified). Wireframe preview is Canvas 2D `stroke()` on the sampled/Bezier path with a dashed style, hiding the rendered stroke layer — no renderer library.

---

## Integration Points by Phase

| Phase | New code (pure where possible) | Existing surfaces touched | Stack risk |
|---|---|---|---|
| **59 — Rail motion** | `app/src/lib/curveMath.ts`, `app/src/lib/railMotion.ts`; motion types in `efxPaintDocument.ts` | `efxPaintCompositor.ts` track loop; `buildPhysicPaintRotoPhysicalRevision` / `encodeCanonicalLoopClips` + Rust `canonical_loop_clips`; document parsers/fixtures; `PhysicsPaintWorkflowStrip.tsx` lanes; `mceFieldContract` fixtures | Add the motion field to the loop-clip canonical encoder **and** the Rust twin at the identical ordinal; do not follow the `photoWiggle`/`keyScriptEdits` exclusion precedent (motion never bakes). Keep the content raster memo motion-free. |
| **60 — Timeline zoom** | `resolveTimelinePitch`, zoom signal + pill, anchored-scroll helper | `PhysicsPaintWorkflowStrip.tsx:605` and its 56 use sites; `timelineRailDesign.ts`; `PhysicsPaintWorkflowStrip.test.ts:936` pin | Zoom formula leaking into only some of the 56 sites → misaligned ruler/playhead/hit-testing. |
| **61 — Vector tool** | Curve-policy module (handles from neighbours), `BezierAnchor.properties`, vector stroke payload | `bezierPath.ts`, `PaintOverlay.tsx`, `paintRenderer.ts`, `aquarelle` deposit/payload, Studio tool rail | Per-vertex watercolour is the feasibility gate; segment-run seams and stroke-count cost need a spike. |
| **62 — Painted-stroke curve editing** | Reuse the curve-policy + anchor conversion | `paintStore` stroke records, `PhysicsPaintStrokeSettingsDialog.tsx`, Studio script strokes | Same engine boundary as 61; do not fork a second editor for "script" vs "vector" strokes. |

---

## Installation

```bash
# Required: none.
# The v2.1.0 capabilities add no runtime dependency.

# OPTIONAL CONTINGENCY ONLY (do not install by default):
# cubic-bezier x -> t solver if the in-repo Newton/bisection solve is rejected.
# pnpm add -F efx-motion-editor bezier-easing@^3.2.0   # MIT, 0 deps, ships types
```

---

## Alternatives Considered

| Recommended | Alternative | When the alternative would be right | Why not here |
|---|---|---|---|
| In-repo `curveMath.ts` (Hermite + tangent policies + B-spline basis + bezier solve) | `bezier-easing@3.2.0` | If the team refuses to own a numeric root solver | Covers only cubic-bezier timing; none of Hermite/CR/TCB/B-spline. A 40-line solver is smaller than the dependency review. |
| In-repo curve math | `cubic-spline@3.0.3`, `splines@1.0.0`, `curve-interpolator@3.3.1` | Never for this feature set | Each covers one family (natural cubic or Catmull-Rom only); none has TCB/B-spline; combining them is more code than writing the basis once. |
| Existing `bezierPath.ts` | `paper@0.17.0`, `konva@10.9.1`, `fabric@7.4.0` | A greenfield vector editor with its own scene graph, hit-testing, serialization and render loop | These are replacements, not additions: they duplicate the store, undo, persistence, engine and Canvas compositor laws the product is built on. |
| Canvas 2D transforms / `DOMMatrix` | `gl-matrix` | 3D or heavy per-frame matrix algebra | 2D affine transforms are 6 numbers; Canvas already applies them. |
| Existing zoom helpers as a pattern | `react-zoom-pan-pinch`, `@use-gesture/*` | React app with no zoom law | Preact app; a proven Preact zoom law already ships in `physicsPaintCanvasZoom.ts`. |
| SVG `<path>` for the lane curve | `d3-shape`, Chart.js, uPlot | Real charts with axes and scales | An 18px lane needs a `d` string, which the evaluator produces exactly from cubic segments. |
| Hand-written document parsers | `zod` | If the repo had no parser law | `efxPaintDocumentParsers.ts` + fail-closed refusals + fixtures are the established contract; adding a schema library now fragments it. |
| Pure scalar evaluators | `xstate@6.0.0-alpha.53`, `effect@4.0.0-rc.115` (already installed for async pilots) | Async orchestration, lifecycle, queues | Interpolation is pure arithmetic; an orchestrator adds no value and would obscure determinism. Do not widen the pilot for this. |

---

## What NOT to Use

| Avoid | Version / licence (verified 2026-11-06) | Why | Use instead |
|---|---|---|---|
| **GSAP** | 3.15.1 — proprietary "Standard No-Charge" licence (`LicenseRef-scancode-gsap-standard-no-charge-2025`), **not OSI, not GPL-compatible** | The project is GPL-3.0-or-later; GSAP's Webflow licence conflicts with that posture and forbids some competing tools. It is also a ticker-based runtime — the inverse of a deterministic, frame-indexed evaluator. | `curveMath.ts` |
| **anime.js** | 4.5.0 MIT | Time-based animation runtime with its own clock; DOM/SVG-centric; duplicates easing and timeline concepts. | `curveMath.ts` |
| **motion (Framer Motion)** | 14.9.1 MIT | React/DOM animation library; Preact + Canvas + frame-indexed app gets nothing from it. | `curveMath.ts` |
| **@tweenjs/tween.js** | 25.0.0 MIT | Owns an update loop and interpolates on wall-clock time; cannot guarantee preview/export pixel parity at integer frames. | Pure `evaluate(frame)` |
| **Theatre.js / @theatre/core** | 0.7.2 Apache-2.0 | A full animation sequencer + studio UI + its own serialization; would duplicate the timeline, motion keys and `.mce` persistence and introduce a second editing surface. | Existing timeline + document schema |
| **d3-ease / d3-interpolate** | 3.0.2 BSD-3-Clause / 3.0.2 ISC | Redundant with `applyEasing`; no TCB/B-spline; pulls d3 module conventions for four functions. | `curveMath.ts` |
| **svg-path-properties** | 2.2.0 ISC | Path length / point-at-length — `bezier-js` `length()`/`getLUT()` already cover it. | `bezier-js` |
| **svg-path-parser / svg-pathdata** | — | Only needed for SVG import/export, which is not in scope. | Internal anchor model |
| **flatten-js** | 0.6.9 MIT | Planar geometry / boolean ops — out of scope for a paint path editor. | `bezier-js` |
| **Rive / lottie-web** | — | Different product shape (runtime animation formats) and a second document model. | Native document + Canvas |
| **CSS `transform: scaleX()` / page zoom for the timeline** | platform | Scales rows, fonts and hit targets; violates "frame density only" and breaks pointer mapping. | Derived pitch multiplication |
| **Charting libraries for the motion lane** | — | The lane is 18px of cubic path; chart scales/axes/legends are dead weight. | SVG `d` from the evaluator |
| **A second path representation** (Hermite/B-spline objects) | — | Duplicates split/project/hit-test/sampling and forks the undo/persistence law. | Cubic Bézier anchors + handle policies |
| **Greedy engine rewrite for per-vertex watercolour** | — | The stamp model is fixed-radius/single-colour; a rushed rewrite risks the shipped determinism and bake law. | Segment runs first; payload extension as a measured follow-up |

---

## Stack Patterns by Variant

**If B-spline must pass through its keys:**
- It cannot — B-spline is approximating by definition. Use Catmull-Rom for interpolating smoothness, or label the option "B-spline (approximating)".
- Because users reasonably expect a key to be a value.

**If per-vertex watercolour is required in v2.1.0:**
- Ship segment runs (each run its own stroke with its own size/colour) on the existing script/bake/cache path.
- Because it requires zero engine change and preserves determinism; measure seam continuity before considering the payload extension.

**If per-vertex colour is needed only in the flat editor renderer:**
- Render per-segment runs with round caps, or interpolate a Canvas gradient per segment.
- Because `perfect-freehand` has no per-point colour.

**If motion must apply to bare Key Rails (not only Loop Clips):**
- Allocate a stable `railId` and key the motion record on it (Gate B), with split/delete rules — and add that field to the owning rail record's revision builder, since `encodeCanonicalLoopClips` no longer covers it.
- Because `loopId` only exists for loop clips, and the v3 model requires a stable animated identity.

**If motion keys are edited while the playhead sits on the same frame:**
- Store motion inside the loop-clip canonical encoder (TS + Rust at the identical ordinal) so the physical revision and the flattened key rotate together; do not add a parallel cache-key term.
- Because the flattened key is derived from each track's content revision, and that revision already tracks `loopClips`; the frame term alone would not distinguish motion edits, but a canonical term makes them indistinguishable from any other content edit.

**If the lane must show draggable Bézier handles (v7 "curves edit directly"):**
- Reuse `curveMath` for handle→value math and render handles as SVG; no chart lib.
- Because the lane model already supplies `curvePath` and the editor's anchor model already supports handles.

---

## Version Compatibility

| Package A | Compatible with | Notes |
|---|---|---|
| `bezier-js@6.1.4` | TypeScript ~5.9.3 | Existing local shim `app/src/types/bezier-js.d.ts`; no change needed. |
| `fit-curve@0.2.0` | TypeScript ~5.9.3 | Existing shim `app/src/types/fit-curve.d.ts`. |
| `perfect-freehand@1.2.3` | Preact/Vite app | Renderer-only, DOM-free; no peer constraints. |
| `lucide-preact@1.57.0` | `preact@11.1.1` | Installed copy resolved against Preact 11.1.1; `PenTool` + `SplinePointer` verified present. |
| `@preact/signals@2.11.3` | `preact@11.1.1` | Declared peer `>= 10.25.0 || >=11.0.0-0`; single preact copy workspace-wide is a hard law. |
| `bezier-easing@3.2.0` (optional) | TypeScript ~5.9.3 | Zero dependencies; ships `src/index.d.ts`; MIT. No `@types` package needed. |
| Canvas 2D / `DOMMatrix` | WKWebView (macOS) | `DOMMatrix` already used in `TimelineRenderer.ts`; `imageSmoothingQuality` is available. |
| `vitest@2.1.9` | `.test.ts` only | `app/vitest.config.ts:5` includes `src/**/*.test.ts` and host tests; the watercolor package's tests are not collected. |

---

## Confidence Assessment

| Area | Confidence | Reason |
|---|---|---|
| No-new-dependency verdict | **HIGH** | Verified against installed package sources/types and the live npm registry; no capability requires a library. |
| Curve-family math (Hermite/CR/TCB) | **HIGH** | Standard basis; TCB formulas and the Catmull-Rom special case corroborated (lecture notes + Jülich report). Golden fixtures will pin the implementation. |
| B-spline is non-interpolating | **HIGH** | Textbook basis property; drives the path-only recommendation. |
| `bezier-js` lacks an easing solve | **HIGH** | Installed source inspected: no `ease`, no `x→t`; `project` is nearest-point. |
| `perfect-freehand` per-point limits | **HIGH** | Installed `types.d.ts` inspected: one `size`, one `easing`, per-point pressure only. |
| Compositor/zoom integration points | **HIGH** | Direct repo inspection: `efxPaintCompositor.ts`, `physicsPaintCanvasZoom.ts`, `PhysicsPaintWorkflowStrip.tsx:605`, `timelineRailDesign.ts`, the pinned test. |
| Motion revision / cache law | **HIGH** | Direct source trace: `_trackContentRevision` → `buildPhysicPaintRotoPhysicalRevision` → `encodeCanonicalLoopClips` (`loops:` term), with the Rust twin at `script_library.rs`. |
| Per-vertex watercolour feasibility | **MEDIUM** | Engine stamps are fixed-radius/single-colour today; segment runs will work, seam quality and cost are unmeasured — needs a Phase 61 spike. |
| GSAP licence verdict | **MEDIUM** | Web search + ScanCode licence entry; clear that it is proprietary and not GPL-compatible. |
| Product fit of curve families | **MEDIUM** | A design decision (B-spline, TCB exposure) rather than a technical unknown. |

---

## Sources

- Live npm registry queries, 2026-11-06 — versions and licences for `bezier-js@6.1.4`, `fit-curve@0.2.0`, `perfect-freehand@1.2.3`, `lucide-preact@1.57.0`, `p5.brush@2.1.3-beta`, `bezier-easing@3.2.0`, `cubic-spline@3.0.3`, `splines@1.0.0`, `curve-interpolator@3.3.1`, `d3-interpolate@3.0.2`, `d3-ease@3.0.2`, `gsap@3.15.1`, `animejs@4.5.0`, `motion@14.9.1`, `@tweenjs/tween.js@25.0.0`, `konva@10.9.1`, `fabric@7.4.0`, `paper@0.17.0`, `flatten-js@0.6.9`, `@theatre/core@0.7.2`, `svg-path-properties@2.2.0` — HIGH for registry facts.
- Installed package sources/types: `bezier-js/src/bezier.js`, `perfect-freehand/dist/types/types.d.ts`, `lucide-preact.d.ts`, `packages/efx-paint-host/src/util/{traceSeed,noise}.ts`, `packages/efx-watercolor/src/engine/deposit.ts`, `packages/efx-watercolor/src/payload/toStudioStroke.ts` — HIGH (direct inspection).
- Repo integration surfaces: `app/src/efx-paint/compositor/efxPaintCompositor.ts`, `app/src/components/physic-paint/view/physicsPaintCanvasZoom.ts`, `PhysicsPaintWorkflowStrip.tsx`, `PhysicsPaintWorkflowStrip.test.ts`, `timelineRailDesign.ts`, `app/src/lib/bezierPath.ts`, `app/src/lib/keyframeEngine.ts`, `app/src/types/paint.ts`, `app/src/types/layer.ts`, `app/src/efx-paint/document/*`, `app/src/stores/physicPaintStore.ts:1629-1635`, `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:1460-1660`, `app/src-tauri/src/services/script_library.rs`, `app/vitest.config.ts` — HIGH (direct inspection).
- Kochanek-Bartels tangent formulas, Catmull-Rom as T=C=B=0, non-uniform timing variant, endpoint handling — [Charles University lecture notes](https://cgg.mff.cuni.cz/~pepca/lectures/pdf/hw-08-math.en.pdf) and [Jülich report](https://juser.fz-juelich.de/record/189426/files/J%C3%BCl_2948_Gro%C3%9F.pdf), corroborated across independent sources — MEDIUM after cross-check.
- GSAP licensing — [ScanCode LicenseDB: gsap-standard-no-charge-2025](https://scancode-licensedb.aboutcode.org/gsap-standard-no-charge-2025.html) and [GSAP 3.13 release notes](https://gsap.com/blog/3-13/) — MEDIUM.
- Milestone contracts: `SPECS/v2.1.0-motion-channels/CONTEXT.md` (§3 model, §5.3 vector gate, §5.6 zoom scope, §6 conflicts, §12 do-not-merge) and `README.md` (v7 lane surface, UAT 13 "no new dependencies") — HIGH (authored project authority).

---

*Stack research for: v2.1.0 rail motion channels, interpolation curve families, timeline zoom, vector painting*
*Researched: 2026-11-06*
*Previous milestone stack research (v2.0.0, 2026-10-14) is superseded by this file and remains recoverable from git history.*
