# Project Research Summary

**Project:** EFX-Motion Editor
**Domain:** Deterministic frame-indexed desktop paint/compositing workstation (Tauri 2 + Preact 11 + signals) — v2.1.0 adds rail motion channels, timeline horizontal zoom, a vector painting tool, and painted-stroke curve editing
**Researched:** 2026-11-06
**Confidence:** HIGH on stack and integration seams; MEDIUM overall on product-surface decisions

## Executive Summary

This is not a greenfield animation feature — it is four additions to a shipped system whose laws are already fixed: one flattened raster per track per frame, `getFlattenedFrame` as the sole preview/export content path, a 60 Hz integer tick grid with seeded determinism, and a dual-language `.mce` encoding pinned by parity tests. Experts extend this product by reusing what is already there, and the research confirms that is genuinely sufficient: **zero new runtime dependencies are required** for all four capabilities. Motion rides existing Canvas 2D transforms at composite time; the timeline zoom is arithmetic over one derived pitch; the vector tool reuses `bezierPath.ts` and the existing Bézier anchor model; painted-stroke curve editing reuses the aquarelle snapshot ledger. The "no new dependencies" UAT bar is honest, not a compromise.

The recommended architecture is consistent across three of the four research files: **prepare-time geometry, composite-time transform.** Motion keys are rail-local and evaluated per frame; the content raster memo stays motion-free so content cycles while motion continues and nothing re-bakes. Zoom becomes one session-only metrics module that every frame→pixel consumer reads. Vector painting becomes a track content kind that rasterizes into the existing per-track memo, so it inherits hide/solo, ordering, opacity, export and background for free. Curve editing is a derive-then-bake edit: Bézier anchors exist only during the gesture, the durable authority stays `AquarellePoint[]`.

The risks are concentrated and concrete. First, **motion changes pixels without moving key bytes** — if it does not join the canonical revision, the composite freezes after the first edit; if it enters the cache key as sampled values, the unbounded `_flattenedMemo` grows one full composite per drag step in a WKWebView that has already been OOM-killed by that class of accumulation. Second, **rail identity**: motion must outlive drawing keys, and the milestone requirement that *any* rail animates collides with the architecture recommendation to store motion on loop clips only — reported below as an explicitly unresolved decision, not a settled one. Third, **per-vertex watercolour is an engine capability boundary**, not a UI toggle: the delivered engine stamps at a fixed radius with a single stroke colour, so per-vertex width needs segment runs or a payload extension and a measured spike.

## Key Findings

### Recommended Stack

**Verdict: no new runtime dependencies for (a) motion channels, (b) interpolation families, (c) timeline zoom, or (d) vector painting.** Every capability lands on libraries already installed plus in-repo pure math. Exactly one optional contingency exists: `bezier-easing@3.2.0` (MIT, zero deps, ships types) as a 40-line cubic-bezier `x → t` solver — and the recommendation is to write that solver in-repo instead, since `bezier-js` verifiably does not provide it (`project` is nearest-point, not an easing solve).

**Core technologies (all already installed, no version changes):**
- **Canvas 2D transforms + `DOMMatrix`** — rail transform at the compositor. The background transform block is the exact precedent; motion is a second transform in the same chain, no matrix library and no scene graph.
- **`bezier-js@6.1.4`** — path-math authority (split, project, length, LUT). Every new curve family converts to cubic Bézier segments, so one library keeps serving all of them.
- **`fit-curve@0.2.0`** — freehand points → anchors (with a caveat; see Open Decisions 5).
- **`perfect-freehand@1.2.3`** — flat stroke rendering. **Capability boundary:** one global `size`, one colour per stroke; per-point pressure only.
- **`lucide-preact@1.57.0`** — `PenTool` and `SplinePointer` are already exported by the installed version. No icon package, no custom SVG.
- **`@efxlab/efx-paint-host`** — `seededDraw(seed, slot, drawKey)` for deterministic, frame-keyed wiggle. Stateless; the correct primitive.
- **`@efxlab/efx-watercolor`** — render target. Stamp model is fixed-radius-per-stroke and single-colour-per-stroke.
- **`vitest@2.1.9`** — collect pattern is `src/**/*.test.ts` only (`.test.tsx` is not collected; the watercolor package's own tests are not collected today).

**Do not use:** GSAP (proprietary non-GPL-compatible licence *and* a ticker runtime), anime.js / Framer Motion / tween.js / Theatre.js (time-based runtimes with their own clock), paper/konva/fabric (replacements that duplicate the store, undo, persistence and Canvas laws), CSS `transform: scaleX()` or page zoom for the timeline (scales rows, fonts, hit targets; breaks pointer math), charting libraries for an 18px lane, `zod` (fragments the established hand-written parser law).

### Expected Features

Three research files converge on the model, with sharp disagreement on the *surface* (see Open Decisions).

**Must have (table stakes):**
- Motion keys independent of drawing keys, on Position (grouped, or split X/Y), Scale, Rotation, Opacity
- Key at current frame from the lane nav diamond; add/edit from the on-canvas gizmo; numeric entry per channel
- Endpoint hold outside the keyed range; **unbounded rotation** (0°/360°/720° are distinct keys — normalising produces the classic "spins backwards" bug)
- Pivot exists and is **time-invariant in rail space** — never derived from per-frame raster bounds, or a cycling drawing makes the rail wobble
- Transform applied at the compositor (no re-bake); preview equals export
- Hold segment; Ease on a Motion key; prev/next key navigation; delete with one undo
- Collapsed-rail "this rail is animated" signal plus an explicit rail-scope **Animate** empty state
- Three disjoint selection scopes; **Ease / Wiggle / Hold attach only to Motion keys**, never to drawing keys or the rail body
- `.mce` motion persistence and undo/redo per key operation
- Zoom: cursor-anchored Cmd/Ctrl+wheel, zoom pill (minus / percent / plus / Fit), presets 0.25×–4×, 100% = 18px pitch, one pitch authority, fixed heights, instant, session-only
- Vector: pen-tool create (corner/smooth, rubber band, close/finish/cancel), spline-pointer edit (anchors, coupled handles, Alt-break, insert, delete, multi-select), per-vertex width, per-stroke brush and colour, wireframe toggle that doubles as the drag-time mode, new stroke kind persisted and exported

**Should have (differentiators):**
- Seeded, **stepped** Wiggle (held poses, not per-frame jitter) — deterministic at export; AE `wiggle()` + `posterizeTime` is the reference
- Split position with per-axis key counts in one lane header; lane sparkline of the actual evaluated curve (must be data-driven, never decorative)
- Ease preset intensity (0–100%); copy/paste Motion keys across rails; motion path on canvas (spatial Bézier)
- Zoom: keyboard presets, double-click percent to reset, adaptive ruler labels, zoom-to-selection
- Vector: per-vertex colour with segment semantics; live cheap preview while dragging, exact on release; convert an existing freehand stroke into an editable path

**Defer (v1.x / v2+):** full graph/curve editor, per-key curve handles as the primary UI, skew/3D/perspective channels, thumbnails at zoom, vertex snapping, width-profile presets, multiple simultaneously expanded motion blocks, per-vertex brush *type* (no reference implementation anywhere — do not build).

**Explicit anti-features:** baking motion into drawing keys or frame caches; constraining motion keys to drawing keys; silent auto-key on every transform; pivot from per-frame bounds; normalising rotation; five independent curve engines selectable per vertex; re-running the watercolour sim on every pointer move; auto-vectorising every existing paint stroke; persisting zoom in `.mce`; merging the new rail motion with `PhysicPaintRotoScriptMotionSettings`.

### Architecture Approach

The one rule that drives all four verdicts: **the compositor's law is one flattened raster per track per frame, and the persistence law is dual-language conditional encoding.** Anything that changes what a frame looks like without moving key bytes must (i) join the canonical revision and (ii) be applied at composite time. Motion is the first rail property with that profile, which is why it is the most delicate.

**Major components:**
1. **`roto/physicsPaintRotoPhysicalModel.ts` + `script_library.rs`** — durable roto model, fail-closed parser, canonical encoders, revision hash. New optional `railMotion` field (named distinctly from `motion`, which belongs to the script-motion system) emitted as a conditional block at the identical ordinal in both languages.
2. **`roto/timelineRailMotion.ts`** — pure evaluator: `evalRailMotionChannel`, `evalRailMotionAt`, `buildChannelCurvePath`. The *same* easing function feeds the lane curve and the render. Mirroring `keyframeEngine`'s mutable-result pattern avoids allocation on the playback hot path.
3. **`efxPaintCompositor.ts` + a `trackTransforms` port** — apply the transform at **both** draw sites (normal and `engineOverlay`); anchor at the composite canvas centre; identity fast path when no entry so v2.0.1 output stays bit-for-bit identical.
4. **`view/physicsPaintTimelineZoom.ts`** — session-only metrics module (scale, cellWidth, cellGap, pitch, rulerTickWidth) + clamping/anchor helpers, modeled on the shipped `physicsPaintCanvasZoom.ts`. Consumers include module-level components and CSS-driven sizes, so neither a Preact context nor a CSS transform works.
5. **Vector track sub-document** — sibling of `rotoPhysical` on `InternalPaintTrack`, dispatched in `_preResolveTrackContent` *before* the roto branch, rasterized into a canvas and absorbed by the existing per-track memo. `rotoPhysical` and `vector` mutually exclusive on one track in v1.
6. **`view/TimelineMotionChannels.tsx` + store selector** — pure projection of the durable model; expansion belongs to the selected rail; the view must not invent interpolation maths.

**Five patterns to follow:** conditional canonical term (absent = byte-identical); session-only view metrics module; kind dispatch at content resolution; prepare-time geometry + composite-time transform; derive-then-bake durable authority.

**Notable metrics:** `ROTO_CELL_WIDTH_PX = 18` is referenced 56 times in `PhysicsPaintWorkflowStrip.tsx` alone (~66 across five files) and pinned by a source-string test — the pin is a contract to update deliberately, not an obstacle. Row height is 31px in production vs a 30px design token with no production consumer (VIS-02 debt, do not fold into Phase 60). Reorder insertion currently uses `index × rowHeight`, which is invalid once blocks are non-uniform.

### Critical Pitfalls

1. **Motion is invisible to the flattened cache key — or explodes the memo.** The key has no transform term, so a Motion edit can return the previous composite; the naive fix (sampled values in the key) mints one full flattened record per drag step in an unbounded `Map`. Avoid: motion joins the canonical physical revision (which already flows through `_trackContentRevision` → the flattened key), transform applied *after* the raster lookup, and a pin test asserting `_flattenedMemo.size` stays flat across a drag.
2. **Fractional sub-frames silently drop the paint raster in motion-blur export.** `_resolveFlattenedFrame` rejects non-integer frames; the exporter accumulates sub-frames at `frame + i/subFrames`. Avoid: **integer content + fractional transform** — the paint path must define the sub-frame law, never loosen the integer guard. Export-parity UAT: motion-blur on vs off must contain paint on every frame with matching frame counts.
3. **Active-track preview/export drift.** The Studio shows the active track as a live overlay above `getFlattenedFrameExcluding(activeTrack)`; playback switches to the full path. If the transform is applied at the compositor but not the overlay, the active rail **jumps when Play is pressed** — invisible on every other track. This is the highest-value UAT row in Phase 59: put motion on the *active* track and assert edit / Play / export frame equality.
4. **The 18px pitch is a module literal in ~66 places.** Zooming half of them makes the playhead, hit-testing, ruler ticks, sound stains, scroll-to-frame and Loop Clip rails diverge — each a separate literal, so the failure is partial and easy to miss. Avoid: one derived `framePitch` passed to every consumer, never multiplied locally; a zoom matrix test at 0.25/0.5/1/2/4×.
5. **Curve-editing a baked stroke by moving its pixels, or re-rolling its texture.** Deforming the cached raster breaks the transmittance punch (erased regions reappear); re-baking a changed point set shifts the engine's sequential seeded RNG and re-rolls the *entire* texture. Avoid: curve edits are script mutations — edit the payload, recover the durable pre-script base, replay, re-bake; prefer moving existing points over inserting/removing; invalidate every loop occurrence, not just the visible frame.
6. **Rail identity is drawing-key-derived** (`firstKeyId` + `keyIds`), so deleting the first drawing key re-points identity and orphans or duplicates motion. This is Gate B and it is unresolved — see below.

## Implications for Roadmap

The milestone already fixes phase numbers 59–62. Research supports that numbering and the internal build order.

### Phase 59: Rail Motion Channels (with the v7 interface)

**Rationale:** The dual-language encoding is the only change that can invalidate existing files, so it goes first. Composite-time rendering must land before the UI so UAT can validate against real output.
**Delivers:** Independent Motion keys on Position (grouped/split X/Y) / Scale / Rotation / Opacity; rail-local time with repeat = hold or fit-to-span; compositor transform; seeded stepped wiggle; v7 lanes, header chevron states, nav cluster, 6×6 keys, selected-rail outline; `.mce` persistence; undo/redo per key op.
**Suggested internal order (from ARCHITECTURE §12):**
- 59.1 Durable model + guard + parser + TS encoder + Rust mirror + byte-parity fixture (blocks everything)
- 59.2 Pure evaluator + curve-path builder
- 59.3 Store projection, actions, revision wiring
- 59.4 Compositor `trackTransforms` + both draw sites (before UI, so the UI has something real to show)
- 59.5 Timeline UI: channels, headers, toggle, outline, nav cluster, measured row offsets
- 59.6 UAT: independent motion keys, compositor render, three scopes, active-track parity, motion-blur export

**Addresses:** Capability 1 launch set + Capability 2 (Hold/Ease/Wiggle).
**Avoids:** Pitfalls 1–7, 9, 13, 14.

### Phase 60: Studio Timeline Horizontal Zoom

**Rationale:** Must follow 59.5 because zoom touches exactly the pitch sites the motion lanes also touch — doing it in the other order means editing the same expressions twice.
**Delivers:** Cursor-anchored Cmd/Ctrl+wheel; zoom pill; presets 0.25–4; Fit computed and clamped; one `TimelineMetrics` authority replacing every literal; fixed vertical geometry; session-only, reset on Studio close.
**Avoids:** Pitfalls 8, 10, 15; and Pitfall 9's half-cell offset (`framePitch / 2 - 1`).
**Does NOT include:** the 30 vs 31 row-height fix (VIS-02) — separate, pinned change if done at all.

### Phase 61: Vector Painting Tool

**Rationale:** Shares `bezierPath.ts` and extracts the curve-overlay scaffolding Phase 62 then consumes. The real scope risk is the **renderer**, not the pen tool: a live-editable vector stroke needs a cheap path renderer alongside the sim.
**Delivers:** Pen-tool create; spline-pointer edit; per-vertex width; per-stroke brush/colour; wireframe display mode that is also the drag-time performance mode; new vector stroke kind persisted and exported; undo per operation.
**Spike required before the data model is locked:** per-vertex watercolour feasibility — segment runs vs payload extension; seam quality and stroke-count cost. Also settle the sampling law (fixed step vs adaptive) and the determinism pin (same stroke → same raster hash across runs, undo/redo, reopen).
**Avoids:** Pitfall 11 (deterministic replay) and the `pointsToBezierAnchors` trap.

### Phase 62: Painted-Stroke / Painted-Script Curve Editing

**Rationale:** Lowest coupling; depends on Phase 61's editing surface plus the aquarelle ledger. Do not fork a second editor for "script" vs "vector" strokes.
**Delivers:** Curve mode over a selected painted stroke — fit anchors on entry, edit, resample on commit; one ledger entry per commit (modeled on `beginAquarelleTransformEdit`); re-bake from the recovered pre-script base; loop-occurrence invalidation; undo that cancels/settles in-flight bakes.
**Avoids:** Pitfall 12.
**Scope gate:** do not persist Bézier anchors in v1 unless the measured round-trip deviation is visibly unacceptable — and then it is a scope change (declared sidecar + TS/Rust parity), not a detail.

### Phase Ordering Rationale

- Encoding before everything (only irreversible change).
- Composite before UI (UAT needs a real transform).
- Zoom after motion lanes (same files, same expressions).
- Vector before curve editing (shared overlay + hit-testing scaffolding).
- Painted-stroke editing last (depends only on the aquarelle ledger and `bezierPath.ts`).
- All four phases avoid re-baking on motion, a second pitch constant, a second path representation, and a second motion system — the four "never" shortcuts in the pitfalls table.

### Research Flags

**Needs a research/spike phase at plan time:**
- **Phase 59** — Gate A–D must be answered *in the plan*: identity (Gate B), repeat semantics (Gate C), quality at scale (Gate D, with measured numbers), and the sub-frame law. Also needs a TS↔Rust byte-parity fixture for a new optional block (none exists).
- **Phase 61** — genuine engine feasibility spike: per-vertex watercolour (segment runs vs payload extension), sampling law, seam quality, stroke-count cost, and determinism pins.

**Targeted decision, not full research:**
- **Phase 60** — mechanical but wide. The prerequisite is a literal-`18` audit reaching zero, then a zoom matrix test. Standard patterns; skip `--research-phase` unless the audit finds unenumerated consumers.
- **Phase 62** — one measurement gates the design (Bézier round-trip deviation); everything else reuses documented in-repo APIs.

## Open Decisions and Unresolved Disagreements

Research did **not** converge on these. They are recorded as decisions for the roadmapper/phase plan, not as settled conclusions.

### 1. Motion on bare Key Rails (Gate B) — DIRECT CONFLICT, resolve first

- **Milestone requirement (PROJECT.md v2.1.0):** "**Any rail animates** — Standard, Motion, Static, Reveal, and bare Key Rails — with no cycle value required or changed."
- **ARCHITECTURE.md recommendation:** store `railMotion` only on `PhysicPaintRotoLoopClip` (identity = the existing stable `loopId`), and it **explicitly rejects** "auto-adopt a bare Key Rail into a Loop Clip (repeat 1) on first Motion key" as a hidden document mutation that silently changes rail type. Its Open Decision 1 says v1 = loop clips only and "do not build [bare Key Rail] in 59."
- **The blocker:** bare Key Rails have no durable identity of their own — identity is derived (`firstKeyId` + `keyIds`), so deleting the first drawing key re-points it.
- **If the requirement stands,** the likely shape is a durable `railId` minted for every motion-bearing rail, with an explicit split / merge / delete-first-key / copy-paste / undo truth table, plus that field in the owning rail record's revision builder (the loop-clip encoder no longer covers it). STACK.md and PITFALLS.md both describe this path; neither has been designed against the live code.
- **Consequence:** this decision also determines whether the cache/revision reconciliation in Open Decision 2 holds.

### 2. Where motion joins the revision and cache key

- **ARCHITECTURE.md §2.5:** add no transform term to the flattened cache key — the per-track content revision + `frame` already covers it, *provided motion lives inside `encodeCanonicalLoopClips`* (TS and Rust at the identical ordinal).
- **PITFALLS.md Pitfall 1:** the flattened key has no motion term today and must not gain sampled values; it proposes an explicit two-tier split with a **motion revision** (monotonic counter) or transform-after-lookup.
- **STACK.md** agrees with Architecture *and* adds the Gate B caveat: if motion attaches to bare rails via a `railId` outside the loop-clip collection, the owning rail record's revision builder must include it or the composite goes stale.
- **Both agree absolutely:** motion must never be baked, must never enter the per-track *content* raster key, and must never be keyed by sampled values.

### 3. The motion channel curve picker

- **STACK.md:** user-facing set = `Hold · Bézier (handles) · Catmull-Rom (smooth auto) · TCB (advanced tension/bias/continuity)`; Hermite stays the internal basis; B-spline is path-only.
- **FEATURES.md:** offer `Linear · Ease (symmetric auto-smooth + intensity) · Hold` plus per-key Wiggle; **defer** per-key Bézier handles to v1.x; **reject TCB as a type**. Rationale: no shipped 2D tool asks the animator to choose between five spline bases, and a per-key curve-type union is permanent schema weight.
- **Agreed by all:** no B-spline on motion channels (approximating basis — a user sets a key and watches the value miss it); one evaluator; B-spline only as a path-smoothing option with an explicit warning.

### 4. Vector per-vertex properties vs the per-path style model

- **FEATURES.md:** per-vertex **width** is P1 table stakes for a tool that is "painting, not shapes"; per-vertex **colour** is P2 (segment model or defer); per-vertex brush type is rejected.
- **ARCHITECTURE.md:** `EfxPaintVectorPath.style` is **per-path** `{color, size, tool, seed}` — as written, it cannot express per-vertex width.
- **STACK.md:** the geometry side is easy (optional `properties` on `BezierAnchor`); the *engine* side is the wall — `perfect-freehand` has one size and one colour, and the watercolour engine stamps at a fixed radius per stroke with a single stroke colour. Recommendation: **segment runs first** (zero engine risk, existing cache/determinism), payload extension as a measured follow-up.
- **Net:** the launched feature set is not yet expressible in the launched data model. Phase 61 must reconcile `vertices[].properties` vs per-path style vs segment runs before writing the schema.

### 5. Reusing `pointsToBezierAnchors` for painted strokes

- **ARCHITECTURE.md §5.1** lists `pointsToBezierAnchors` as the direct reuse for fitting a painted stroke into anchors.
- **PITFALLS.md Pitfall 11** says **never** reuse it for this without attribute channels: it runs `fitCurve` on x/y only and **drops pressure**, and `MAX_POLYLINE_POINTS = 96` caps the preview polyline.
- Unresolved. Minimum: fit with attribute preservation or accept a documented pressure round-trip.

### 6. Sub-frame motion evaluation

- **STACK.md:** the evaluator is "pure and total … integer frames only."
- **PITFALLS.md Pitfall 2:** rail motion must be evaluated at **fractional** time for motion-blur export sub-frames, applied to an integer content raster.
- Unresolved; Phase 59 must write the sub-frame law explicitly or paint vanishes from motion-blurred exports.

### Also open (converging, lower risk)

- **Repeat semantics (Gate C):** `hold` (rail-local time clamps at the last key) vs `fit` (normalise across the occurrence). All files default to `hold`; must be settled before schema.
- **Channel set:** v7 mockup omits Scale; the v3 model requires it. All research recommends shipping the Scale lane and pinning the channel list in a test.
- **Position lanes:** two channels in the model (`position-x`, `position-y`), one lane in the UI. Model must not change when the UI does.
- **Motion blur on rail motion:** extend velocity sampling to the combined transform, or lock "no motion blur on rail motion" as a documented limitation. Locking is legitimate; silence is not.
- **Track opacity × motion opacity:** multiply (recommended).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | "No new dependency" verified against installed package sources/types and the live repo; MEDIUM only on per-vertex watercolour feasibility and the product fit of B-spline/TCB |
| Features | MEDIUM | HIGH on local codebase facts (read directly); MEDIUM on vendor documentation (single-source web tier); LOW on knowledge-tier comparisons. Curve-family exposure and per-vertex colour are design calls, not unknowns |
| Architecture | HIGH | Every integration seam cites live code — compositor draw sites, canonical encoders, revision/cache chain, the 66 pitch consumers. MEDIUM only on the deferred bare-Key-Rail follow-up, which is an inference from the loop-clip lifecycle |
| Pitfalls | HIGH | Every pitfall grounded in code on disk and the milestone contracts; none is generic advice |

**Overall confidence:** HIGH on *how* to build it; MEDIUM on *what exactly* ships (the surface decisions in Open Decisions 3–5).

### Gaps to Address

- **Gate B identity (blocking)** — decides whether the milestone's "any rail animates" is deliverable in Phase 59 or becomes a follow-up. Do not start 59.1 before this is answered; it changes the persistence seam.
- **Gate C repeat semantics** — must be fixed before the schema is written.
- **Gate D quality at scale** — needs measured numbers (frame time + peak memory for a 4× scaled, rotated, 30-frame rail), not a preference. 2× bake costs 4× memory per axis against an already-pressured 512 MB LRU.
- **`.mce` paint-field enforcement is currently absent.** `mceFieldContract.test.ts` parses only `Mce*` interfaces against `models/project.rs`; the paint document rides as `HashMap<String, Value>`. The milestone constraint says every new field is declared in both languages — but the mechanism does not exist for paint. Either add a typed struct and extend the pin, or add a dedicated load→save→byte-identical round-trip pin. A green `mceFieldContract.test.ts` is **not** evidence motion persists.
- **Four persistence carriers** must be wired in one change or motion silently fails: `serializeRuntimeIntoDocument`, `encodeValidatedEfxPaintTrackContent`, `buildEfxPaintDocumentSyncFingerprint`, and the layer change token. This defect class has already cost the project twice (PKG-06, BKG-09).
- **Per-vertex colour render cost** is unmeasured and is the deciding factor between P1 and P2.
- **Per-vertex watercolour seam quality / stroke-count cost** — Phase 61 spike.
- **6×6 Motion keys** are below the industry's typical 8–10px marker and no source supports 6px as comfortable; v7 locks it, so plan a hover affordance rather than reopening the visual.
- **VIS-02 row-height drift (30 token vs 31 rendered)** — pre-existing debt; do not fold it into Phase 60.
- **`railMotion` naming** — the field must not be called `motion`; that name is already load-bearing for `PhysicPaintRotoScriptMotionSettings`, which the milestone forbids merging.

## Sources

### Primary (HIGH confidence)
- Live code inspection: `efxPaintCompositor.ts`, `efxPaintCompositeCache.ts`, `physicPaintStore.ts` (`_trackContentRevision`, `_preResolveTrackContent`, `_resolveFlattenedFrame`, `serializeRuntimeIntoDocument`), `physicsPaintRotoPhysicalModel.ts` (`encodeCanonicalLoopClips`, `buildPhysicPaintRotoPhysicalRevision`), `script_library.rs` (`canonical_loop_clips`, `canonical_physical_hash`), `efxPaintDocumentRevision.ts`, `efxPaintDocumentParsers.ts`, `PhysicsPaintWorkflowStrip.tsx`, `PhysicsPaintTrackRow.tsx`, `physicsPaintTrackHeaderColumn.tsx`, `timelineRailDesign.ts`, `physicsPaintCanvasZoom.ts`, `bezierPath.ts`, `PaintOverlay.tsx`, `aquarelleStrokeSelection.ts`, `aquarelleBaseRecovery.ts`, `motionBlurEngine.ts`, `exportRenderer.ts`, `mceFieldContract.test.ts`, `usePhysicsPaintCrossTrackDrag.ts`
- Installed package sources/types: `bezier-js`, `perfect-freehand`, `lucide-preact`, `efx-paint-host` (`traceSeed`, `noise`), `efx-watercolor` (`deposit.ts`, `toStudioStroke.ts`)
- Milestone authority: `SPECS/v2.1.0-motion-channels/CONTEXT.md` (§3 model, §3.5 render law, §3.6 Gates A–D, §5.3 vector gates, §5.6 zoom scope), `README.md` (v7 lane contract, geometry, UAT rows), `.planning/PROJECT.md` (v2.1.0 scope + constraints), `.planning/ROADMAP.md`

### Secondary (MEDIUM confidence)
- Toon Boom Harmony 20/24/25/27 (peg vs drawing keys, F5/F6/F7, Separate Positions/Scales, pivot, stop-motion keyframes, timeline zoom)
- Adobe After Effects (keyframes, Separate Dimensions, Easy Ease, hold keyframes, `wiggle`/`seedRandom`/`posterizeTime`, Graph Editor)
- Adobe Illustrator Width tool; Krita Vector Graphics; Inkscape PowerStroke/LPE; TVPaint speed curves; Premiere Pro timeline zoom; Dragonframe scale control
- EsotericSoftware spine-runtimes (`CURVE_LINEAR` / `CURVE_STEPPED` / Bézier timelines)
- Kochanek-Bartels tangent formulas and the Catmull-Rom special case (Charles University lecture notes; Jülich report)
- Live npm registry queries for the alternative-library survey; ScanCode LicenseDB for the GSAP licence verdict

### Tertiary (LOW — flagged, not used alone)
- Knowledge-tier claims about Illustrator Outline view, AE timeline zoom anchoring, Figma pen behaviour, Spine 4.x curve presets
- Unmeasured estimates: per-vertex colour render cost, watercolour seam quality, Bézier round-trip deviation

---
*Research completed: 2026-11-06*
*Supersedes the v2.0.0 research set (2026-10-14), recoverable from git history.*
*Ready for roadmap: yes — with Open Decision 1 (Gate B rail identity) resolved before Phase 59 planning begins.*
