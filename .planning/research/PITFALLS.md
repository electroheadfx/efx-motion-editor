# Pitfalls Research

**Domain:** Adding four features to a shipped, signals-heavy Tauri 2 + Preact 11 paint workstation — (Phase 59) per-rail Motion channels on a raster-flattening compositor, (Phase 60) Studio timeline horizontal zoom over a hard-coded 18px frame pitch, (Phase 61) a vector painting tool in a deterministic raster engine, (Phase 62) curve editing of already-baked painted strokes
**Researched:** 2026-11-06
**Confidence:** HIGH — every pitfall below is grounded in code on disk (`app/src`, `packages/`) and the milestone contracts (`CONTEXT.md` §3/§3.5/§5.6, `README.md` §4, `PROJECT.md` v2.1.0 section); no pitfall is generic advice carried in from outside.

Scope: mistakes likely when **adding** these four features to **this** system. It supersedes the v2.0.1-milestone pitfalls research (2026-10-14), recoverable from git history. Each pitfall names its owning phase; cross-phase seams are called out explicitly because Phase 59 lands the row/height math Phase 60 depends on, and Phase 61's stroke payload feeds Phase 62's editor.

Ground truths used throughout:

- The compositor already produces **one flattened raster per track per frame** — `compositeFrame` walks tracks bottom-to-top and `drawImage`s each track raster with opacity/blend only. There is **no transform stage** today (`app/src/efx-paint/compositor/efxPaintCompositor.ts`).
- `getFlattenedFrame` is documented as the **sole content path** for preview and export (`PROJECT.md` architecture paragraph), and `_resolveFlattenedFrame` **rejects non-integer frames** (`app/src/stores/physicPaintStore.ts:2986`).
- The flattened cache key (`deriveEfxPaintFlattenedCacheKey`) is composed of `config: / tracks: (content revision + frame) / bg: / fallback: / bgtransform: / clips: / excl: / fond:0 / bg:0 / bgsrc: / solo: / frame:` — **there is no motion term**, and `_flattenedMemo` is an unbounded `Map` of full flattened records.
- Rail identity today is **derived from drawing keys**: key rails use `firstKeyId` + `keyIds`; loop rails use `loopId` with occurrence math (`placementStart`, `cycleOffset`, `visibleRanges`).
- `ROTO_CELL_WIDTH_PX = 18` is a module literal referenced **56 times** in `PhysicsPaintWorkflowStrip.tsx` alone — 66 times across 5 files (including the hook, the audio controller and two test files).
- The paint engine is deterministic **by sequential seeded consumption**: `seededRng(stroke.traceSeed, 'deposit')` draws in point order, so changing the point set or order re-rolls the whole wash texture.
- Paint internals are **not** covered by the `.mce` field-diff contract test: `mceFieldContract.test.ts` parses only `Mce*` interfaces in `types/project.ts` / `types/audio.ts` against `src-tauri/src/models/project.rs`, while the paint document rides as `HashMap<String, Value>` on the Rust side.

---

## Critical Pitfalls

### Pitfall 1: Motion is invisible to the flattened cache key (or it explodes the memo)

**What goes wrong:**
Motion keys are added and the channels render, but the composited canvas does not move — or moves once and freezes after the first edit. The flattened cache key has no term for a rail's transform, so a Motion-key edit produces the same key and `_resolveFlattenedFrame` returns the previous record. The obvious fix — mixing the sampled transform into the key — is worse: `_flattenedMemo` is a plain unbounded `Map` holding full flattened records, so every drag step of a Motion key mints a new entry. A 30-frame HD rail dragged across 100 steps allocates ~100 full composites in the WKWebView that has previously been OOM-killed by exactly this class of accumulation.

**Why it happens:**
The key was designed for "document content changed" (per-track `contentRevision` + frame), not "the transform of unchanged content changed". Motion breaks the assumption that content revision + frame fully determines the output. And the memo has no LRU/cap because at one entry per (config, tracks, frame) the working set was bounded by playback range.

**How to avoid:**
Split the pipeline into two tiers inside Phase 59:
1. **Content tier** (existing key): per-track source rasters, invalidated by content revision. Motion must not touch this tier — the milestone's own render law says motion never re-bakes.
2. **Composite tier**: look up the per-track rasters, then apply each rail's evaluated transform during `compositeFrame`. Key this tier by a *motion revision* (a monotonically bumped counter per rail / per document), never by sampled values.

If a transform term must enter any key, include the motion **revision string**, and bound the memo (LRU) in the same change. Add a pin test: mutate a Motion key → the composite changes, and `_flattenedMemo.size` does **not** grow per drag step.

**Warning signs:**
- Channels show curves and "N keys", canvas is static until you switch tracks or reopen
- `_flattenedMemo.size` climbs monotonically while dragging a key
- Memory climbs across a scrub of one animated rail; the Studio gets slower the longer it stays open
- "It works after I delete the cache" (i.e. after a document write clears the memo)

**Phase to address:** Phase 59 (compositor + memo seam). Phase 60 must not assume memo semantics changed.

---

### Pitfall 2: Fractional sub-frames silently drop the paint raster in motion-blur export

**What goes wrong:**
`renderFrameWithMotionBlur` accumulates sub-frames at `globalFrame + i/subFrames` and passes that fractional `physicPaintFrame` down. `_resolveFlattenedFrame` rejects `!Number.isInteger(frame)` and returns `null`, so **paint disappears from every motion-blurred export sub-frame** while the timeline preview and the non-blurred export look correct. The user sees a paint layer that "flickers out" only in the final video.

**Why it happens:**
The paint compositor was built frame-integral by contract ("one raster per track per frame"), and its guard is honest about that. Export's sub-frame accumulation predates paint tracks being rail-animated; until now fractional paint lookups were simply never useful.

**How to avoid:**
Phase 59 must define the sub-frame law explicitly and implement it in the paint path, not by loosening the integer guard:
- **Content** is sampled at the nearest integer frame (content cycles on frame boundaries — `CONTEXT.md` §3.5).
- **Motion** is evaluated at fractional time and the resulting transform is applied to the integer content raster.

This means either a paint-specific sub-frame compose API (integer content + fractional transform) or teaching the exporter to request sub-frames through the compositor with a transform argument. Never call `getFlattenedFrame` with a fractional frame. Add an export-parity UAT: the same rail with motion exported with motion blur on vs off must contain paint on every frame, and the frame count must match.

**Warning signs:**
- Paint present in PNG sequence export, absent in ProRes/H.264 export with motion blur enabled
- `collectExportPhysicPaintFrameSources` never sees the frames that are missing
- The bug disappears when shutter angle / sub-frame count is 1
- Only layers with rail motion are affected

**Phase to address:** Phase 59 (compositor seam + export parity UAT). It is a Phase 59 blocker because the milestone's render law is defined there.

---

### Pitfall 3: Motion blur never sees rail motion (and can mis-measure it as stationary)

**What goes wrong:**
`VelocityCache.computeForLayer` derives `dx/dy/dRotation/dScale` from `layer.keyframes`, and the motion-blur block only runs for content layers with `layer.keyframes` and does not treat `physic-paint` as a blurred layer. A rail animated purely by Motion keys gets **zero motion blur**; worse, if the layer also has stationary keyframes, `isStationary` (threshold 0.5) reports "not moving" while the rail is visibly sweeping across the canvas.

**Why it happens:**
Velocity has been a property of keyframe interpolation since before paint tracks existed. Paint layers were spatially invariant — the transform was never applied — so there was nothing to measure.

**How to avoid:**
Phase 59 must make an explicit decision and write it down, rather than inherit it by omission:
- **Option A (recommended):** extend velocity sampling to the combined layer transform (layer keyframes × rail motion), key the `VelocityCache` by the motion revision, and make `isStationary` evaluate the combined transform.
- **Option B:** lock "no motion blur on rail motion" as a documented v2.1.0 limitation and surface it in the UI copy. Locking is legitimate; silence is not.

Either way, add a test that a rail with only Motion keys produces non-zero velocity when Option A is chosen, and that a stationary rail produces zero.

**Warning signs:**
- Blur ghosting on content overlays but a crisp moving rail
- Shutter-angle changes have no visible effect on an animated rail
- `velocityCache` has no entry for the paint layer id during a rail move

**Phase to address:** Phase 59 (decision + seam). Verification rides the existing motion-blur export path.

---

### Pitfall 4: Active-track preview/export drift because the live overlay bypasses the compositor transform

**What goes wrong:**
While editing, the Studio shows the active track as live engine/DOM layers stacked **above** a composite built with `getFlattenedFrameExcluding(activeTrack)`, because the live canvas supplies in-progress pixels. Playback switches to `getFlattenedFrame` including the track. If the rail transform is applied at the compositor but not to the live overlay (or applied with a different resample), the active rail **jumps when Play is pressed**, and the PNG export matches neither. This is invisible on every non-active track, which makes it easy to miss in review.

**Why it happens:**
The live overlay is a passive raster stack; transforms were never applied to paint at all, so the two paths were trivially identical. The exclusion path exists for performance/latency and is correct only while the transform is identity.

**How to avoid:**
Define one transform application point and route all three paths through it: edit base, live overlay, export. Concretely, the live overlay wrapper must receive the same evaluated transform (or the overlay raster must be composed offscreen and transformed identically). Add a UAT row: put motion on the **active** track, scrub in edit mode, press Play; frame 0 must match the painted/edited frame and the exported frame byte-for-byte.

**Warning signs:**
- The active track looks right until Play; other tracks are fine
- Preview vs PNG export differ only for the selected/animated track
- Switching the active track "fixes" the frame
- The discrepancy scales with the transform magnitude (rotation/scale is worse than translation)

**Phase to address:** Phase 59 (render-law integration across `PhysicsPaintProgramMonitor` and the Studio view). It is the highest-value UAT row in the phase.

### Pitfall 5: Two-stage resampling softens scale/rotation (Gate D is a memory decision, not a polish decision)

**What goes wrong:**
Content rasters are already produced at a working resolution (decoded/WebP frames, HD-capped, LRU-backed). Applying scale/rotation at composite time resamples an **already resampled** raster. At 2×–4× the rail looks soft compared with the drawing-key preview; at rotation, edges shimmer, and the result changes with the playback path (sub-frame vs whole-frame). The reflex fix — "bake motion into drawing keys" — violates the milestone's render law and re-bakes on every motion edit. The opposite reflex — "bake everything at 2×" — multiplies the 512 MB LRU pressure and can OOM on a multi-track document.

**Why it happens:**
Gate D explicitly asks "bake 2× or vector?" and the phase has not answered it yet. Raster resampling quality and cache memory are coupled: higher-resolution source rasters are the only way to keep scale-up sharp, but they cost 4× memory per 2× dimension, and the document already keeps multiple frame representations (bytes, ImageBitmap, flattened records).

**How to avoid:**
Answer Gate D in the Phase 59 plan with measured numbers, not a preference:
- Render one 30-frame rail at 4× scale and rotate it through 360°, on the largest realistic document, and record frame time + peak memory.
- Choose exactly one: **2× bake** (sharpness, 4× memory, bounded cache) or **vector re-render** (sharp at any scale, but the engine must re-render per frame and the determinism rules apply — see Pitfall 11).
- Pin the choice with a cropped UAT comparison at 1×, 2× and 4× and with a memory ceiling in the test.

Do not let "scale is just a transform" ship without a measured answer.

**Warning signs:**
- "It looks soft when scaled" reported only after the zoom milestone lands (4× makes it obvious)
- Memory spikes the first time a scaled rail plays, then stays high
- Rotation shows stair-stepping/aliasing at some angles only
- The plan describes Gate D as "bake 2×" with no measurement

**Phase to address:** Phase 59 (Gate D in the phase plan; the answer constrains the cache).

---

### Pitfall 6: Motion persists in the session but not to disk / not across realms (the PKG-06 / BKG-09 defect class)

**What goes wrong:**
Motion keys work in the Studio, survive undo, and look done. Then: reopen the project and the keys are gone; or edit in the Studio and the main window still shows the old state; or the parent never receives the change at all. This is not hypothetical — this codebase has already lost exactly this class of data twice (display prefs needed the sync fingerprint; docSync replaced the parent's byte records with media refs).

**Why it happens:**
The paint document is a **hand-maintained projection** across four carriers, and motion must be added to each:
1. `serializeRuntimeIntoDocument` maps `frames` / `rotoPhysical` per track — a new field can be dropped here.
2. `encodeValidatedEfxPaintTrackContent` enumerates the track content revision (id/name/order/visible/solo/opacity/blend/revision + frames + loops + roto). If motion is not in it, the revision does not rotate and the dirty token never fires.
3. `buildEfxPaintDocumentSyncFingerprint` (= revision + `|photoDisplay:` + `|bgDisplay:` + `|audios:`) carries fields deliberately excluded from the revision. A view-only motion part must ride here or the child realm never syncs.
4. The layer change token gates cross-realm updates.

Separately, `PROJECT.md` states the milestone constraint "`.mce` gains motion persistence, so every new field is declared in BOTH TS and Rust under the field-diff pin" — but `mceFieldContract.test.ts` **does not parse the paint document**: Rust carries it as `pub efx_paint_documents: HashMap<String, Value>` / `efx_paint: HashMap<String, Value>`, so serde preserves whatever TS writes without a typed struct to diff against. The "both languages" rule is therefore currently **unenforced** for paint fields.

**How to avoid:**
Treat motion as content and wire all carriers in one change, with pin tests:
- Mutate a Motion key → assert document revision, sync fingerprint, and layer change token all change.
- Reopen → keys at identical frames, identical curve paths.
- Studio edit → main window reflects it without a manual refresh.
- Compute the dirty/save path from the same revision (do not hand-roll a second "motion dirty" flag).

For the `.mce` pin: either add the motion fields to a typed Rust struct and extend the field-diff test, or document explicitly in the phase plan that the paint document is opaque and add a dedicated TS↔JSON round-trip pin (load → save → byte-identical motion block). The current test passing is **not** evidence that motion persists.

**Warning signs:**
- Motion keys present in-session, absent after reopen
- Studio shows the change; the main-window monitor does not until a reload
- The saved `.mce` JSON has no motion block (or has a stale one)
- `mceFieldContract.test.ts` green while motion fields changed — expected, and therefore not proof

**Phase to address:** Phase 59 (document projection + carriers + pins). The milestone explicitly changes `.mce`, so this phase owns the schema decision.

---

### Pitfall 7: Rail identity is drawing-key-derived — motion keys break it (Gate B)

**What goes wrong:**
Motion is supposed to be independent of drawing keys (CONTEXT §3.2; UAT row 8: a Motion key must animate a rail span with no drawing key). But the rail identity today is `{kind:'key-rail', firstKeyId, keyIds}` — it *is* the drawing-key set. Then:
- deleting the **first** drawing key re-points `firstKeyId` → motion attaches to another rail or vanishes;
- a split / +Key dissolve changes `keyIds` → motion is orphaned or duplicated;
- copying/pasting a rail duplicates drawings but drops motion (or worse, shares it);
- undo of a split restores a different key set than the motion was written against;
- a loop rail's motion must resolve per **occurrence** (`placementStart` + `cycleOffset`), not per document frame, and "repeat = hold" vs "fit-to-span" must be defined on the occurrence.

**Why it happens:**
Motion is the first data that must outlive drawing keys. Every identity rule in the system was written when a rail without drawing keys could not exist. `README.md` §6.7 calls this out as Gate B with a default (loop clips only) that has not been decided.

**How to avoid:**
Decide Gate B in the Phase 59 plan before coding:
- **Option A (recommended long-term):** introduce a durable `railId` for every motion-bearing rail, including bare key rails, and define split / merge / delete-first-key / copy-paste / undo semantics in a table (who keeps the motion, who inherits it, when it is dropped).
- **Option B (README default, acceptable for v1):** restrict motion to loop clips with a stable `loopId`; bare key rails stay static. Document it and make the UI honest (no motion affordance on bare rails).

Whichever is chosen, write the tests **before** the feature: delete-first-key, split, copy/paste, undo/redo. Motion must travel with its rail or be explicitly dropped — never silently re-point.

For loops, pin rail-local time: a Motion key at rail-local frame 0 must render at `placementStart + k*period + cycleOffset` for occurrence k. Test hold (freeze at last key) and fit-to-span (scale the track to the occurrence length) on the **second** occurrence, not the first.

**Warning signs:**
- Motion "jumps" to a different rail after deleting the first key
- Copy/paste duplicates drawings but the pasted rail is static
- Undo restores geometry but not motion (or vice versa)
- Motion appears correct on occurrence 1 and offset on occurrence 2
- A rail with only Motion keys has no row in the timeline (identity lookup returns nothing)

**Phase to address:** Phase 59 (Gate B; identity + occurrence math). Phase 62 must not assume a stroke edit is the only invalidation — rail splits affect it too.
---

### Pitfall 8: The 18px frame pitch is a module literal in 66 places — zooming half of them

**What goes wrong:**
Phase 60 flips the zoom control on and everything works at 1×. At 0.25× or 4×, some surfaces scale and some do not: the playhead sits a fraction of a cell off, clicking a cell selects its neighbour, the ruler ticks drift from the cells, the sound stain detaches from its clip, Loop Clip rails keep their 1× width, and the insertion frame lands one column away. Each of these is a separate literal in a different file, so the failure is partial and easy to miss.

**Why it happens:**
`ROTO_CELL_WIDTH_PX = 18` is the design's single source **at 1×**, but many consumers independently convert frames to pixels:
- cell grid: `gridTemplateColumns: repeat(n, 18px)` (`PhysicsPaintWorkflowStrip.tsx:5290`)
- playhead: `left = 6 + clampedFrame * ROTO_CELL_WIDTH_PX + 8` (~1051)
- ruler tick: `flex: 0 0 ${RULER_TICK_WIDTH_PX}px`, `RULER_TICK_WIDTH_PX = RULER_STEP * 18` = 54 (~607, ~5817)
- scroll-to-frame: `target = frame * 18 + 18/2 - clientWidth/2` (~4581–4606)
- drag/hit-test: `round((clientX - origin)/18)`, `floor(relativeX/18)`, `round((clientX - contentLeft + scrollLeft)/18)` (~3226, ~3373, ~3866, ~4167, ~3601)
- ghost / push / set-drag previews multiply frame deltas by 18 (~5130, ~5517–5611)
- Loop Clip rail `framePitch={ROTO_CELL_WIDTH_PX}` (~5228, ~5260, ~3529, ~3747)
- sound stain: `soundStainLeftPx(startFrame, ROTO_CELL_WIDTH_PX)` (already parameterized — the call site is the problem)
- audio visible window: `scrollLeft / ROTO_CELL_WIDTH_PX` (`physicsPaintAudioController.ts`)
- `README.md` §4 also adds 18px channel rows whose geometry must scale/not scale with the same rules

There is one latent seam already: `usePhysicsPaintCrossTrackDrag` accepts an optional `zoom` (default 1) and `computeInsertionFrame` computes `pitch = framePitch * zoom` (`usePhysicsPaintCrossTrackDrag.ts:98,202`). Nothing else has that seam, so a partial conversion would make only that hook correct.

**How to avoid:**
Make zoom a **single derivation**, not a per-call-site change:
- Derive `framePitch = ROTO_CELL_WIDTH_PX * zoom` once in the strip (or a view-model) and pass it into every consumer. The hooks already take `framePitch` (group rail drag, Loop Clip presentation, background clip drag/resize, cross-track drag) — plumb one value, never multiply locally.
- Any place that computes a pixel offset from a frame must take `framePitch` (and, where relevant, the cell width) as a parameter; the half-cell offset becomes `framePitch / 2 - 1`.
- Keep the zoom **session-only** and out of the document/export path (Phase 60's locked scope). Zoom is presentation, never content.

Add a zoom matrix test at 0.25, 0.5, 1, 2, 4 that asserts: playhead centre, hit-test frame at a given clientX, ruler tick extent, sound-stain left/width, Loop Clip rail extent, and the audio visible frame range.

**Warning signs:**
- Everything is correct at 1× and only at 1×
- The playhead is off by a few pixels that scale with zoom
- Clicking a cell selects an adjacent frame only when zoomed
- Ruler labels no longer sit over their cells
- Sound stain and Loop Clip rails keep their unzoomed width
- A test suite that never sets zoom (all existing tests use 18)

**Phase to address:** Phase 60 (single seam + matrix test). Phase 59 should avoid hard-coding any *new* pixel math into the expanded channel rows for the same reason.

---

### Pitfall 9: Half-cell offsets, 31/30 row drift, and index-based offsets break when rows are no longer uniform

**What goes wrong:**
Three independent geometry assumptions collide in Phase 59/60:
1. The playhead centres with a literal `+8` (half of 18 minus half of the 2px line). At 0.25× that arithmetic is wrong; at 4× it is wrong in the other direction.
2. The row height is **31px** in production (`STRIP_ROW_HEIGHT_PX = 31`, `HEADER_ROW_HEIGHT_PX = 31`, and the CSS `height: 31px` rules) while the design token says **30** (`TIMELINE_GEOMETRY.rowHeight = 30` in `timelineRailDesign.ts:98`). The token has tests pinning 30 but no production consumer, so "read the token" is the wrong fix and "change the token" breaks tests without changing the UI.
3. The header-column reorder insertion indicator is `top: reorderDragIndex * HEADER_ROW_HEIGHT_PX` (`physicsPaintTrackHeaderColumn.tsx:218`). With expanded channel blocks, rows are no longer `index × 31`; the indicator lands inside a channel block and the drop target lies about where the row will go.

The README's integration map is explicit: inserted channel rows must add exactly 18px on **both** the header and the rows side, and the 2px post-block gap must match on both sides. Any mismatch desynchronizes lanes from headers while scrolling.

**Why it happens:**
The v2.0.1 surface is uniform by construction, so index math was safe. Expanded blocks introduce variable heights in exactly the two places that share the index math, and the design token is a parallel copy that drifted.

**How to avoid:**
- Phase 59: replace index math with **measured row offsets** computed once from the same model that renders the rows, and share that model with the header column (a single `rowOffsets: number[]`). Test expand/collapse at 3 and 4 channels.
- Phase 59: the selected-rail outline height is `30 + 18 × channels` (README §2) and must use the live row height, not the token.
- Phase 60: keep row and lane heights **fixed** (locked scope) — zoom changes only the pitch. Do not "fix" 30 vs 31 as part of zoom; if it is fixed at all, fix it in a separate, pinned change.
- The half-cell offset becomes `framePitch / 2 - 1` and must be asserted at every zoom preset.

**Warning signs:**
- Outline/selection is 1px off (the 31/30 drift showing through)
- The insertion indicator drops inside a motion channel block
- Header labels and lane cells drift apart only when a rail is expanded
- A test that reads `TIMELINE_GEOMETRY.rowHeight` passes while the UI is 31px
- The playhead is centred at 1× but not at 0.25×/4×

**Phase to address:** Phase 59 (measured offsets + lockstep test), Phase 60 (zoom-invariant geometry). The 30/31 token drift is tracked as VIS-02 in `PROJECT.md`; do not fold it into either phase silently.

---

### Pitfall 10: Zooming materializes the wrong thing (DOM width, ruler labels, scroll anchor)

**What goes wrong:**
The timeline is fully materialized: `frameCells` spans the whole document and the grid renders one column node per frame. At 4× the content is four times wider in CSS pixels; the scroller's anchor resets or jumps; ruler labels (one per `RULER_STEP` = 3 frames = 54px at 1×) collide at 0.25× (13.5px) or become sparse at 4×. The audio preview's visible frame window (`scrollLeft / ROTO_CELL_WIDTH_PX`) and the sound stain silently disagree with the new scale. The user zooms in and the viewport "teleports".

**Why it happens:**
Zoom is a pixel-density change over a fixed set of frame columns — no frames are added — but scroll position, ruler labels and audio ranging were all derived from the assumption that 1 frame = 18px. `CONTEXT.md` §5.6 locks "row, lane and cell heights stay fixed", so the *vertical* geometry is safe; the horizontal derivations are not.

**How to avoid:**
- Keep frame count as the source of truth; derive pixel widths from `framePitch` (never materialize extra frames). At 4× the grid is wider but the node count is unchanged — that is fine; do not virtualize in this phase.
- Preserve the **anchor frame** across zoom: read the frame at the viewport centre (or under the cursor for Cmd+wheel) before applying zoom, then set `scrollLeft` so that frame stays put. Test at both viewport edges.
- Choose an adaptive ruler step for label legibility, but keep tick width = `step × framePitch` so ticks stay cell-aligned; labels may thin out, cells may not.
- Route `goToFrame`, the audio visible window and the sound stain through `framePitch`.
- Keep Fit clamps inside [0.25, 4] and make the session-only reset to 1× deterministic on Studio reopen.

**Warning signs:**
- Zoom jumps the scroller to origin (or to the document start)
- The frame under the cursor changes after Cmd+wheel
- Ruler labels overlap at 0.25×
- Scrollbar thumb / scrollWidth disagree with the visible cells
- Audio snippet visibility lags the painted sound stain when zoomed

**Phase to address:** Phase 60 (scroll anchoring + ruler step + audio/stain plumbing).

---

### Pitfall 11: A vector tool that does not replay through the deterministic engine

**What goes wrong:**
The vector tool looks correct on canvas, but the same stroke produces a different wash after undo/redo, after reopen, or when the script is played back. Width/color changes along the stroke apply only to the first segment or drop entirely. The wireframe preview stutters on dense curves.

**Why it happens:**
Determinism in this engine is **sequential seeded consumption**, not per-point independence: `seededRng(stroke.traceSeed, 'deposit')` is consumed stamp by stamp in point order, and the host and engine already differ in how draws are keyed (arc-length vs sample order, per `traceSeed.ts`). A vector representation introduces a new sampling law — unless that law is fixed and shared, the stamp sequence changes and the whole texture re-rolls. Per-vertex properties are also easy to lose: `pointsToBezierAnchors` runs `fitCurve` on x/y only and **drops pressure**, and `MAX_POLYLINE_POINTS = 96` caps the preview polyline. The live `StrokeWriter` jitter uses `Math.random` and is documented as live-only; leaking it into a baked vector stroke breaks replay.

**How to avoid:**
- Define the vector payload as an ordered sample list with **per-vertex attributes** (pressure/size, color, brush/tool) and a **fixed re-sampling rule** (e.g. arc-length resample at authored curvature), shared by preview and bake.
- Serialize it through the existing script envelope and the fail-closed Apply; malformed vector data is rejected, never partially applied.
- Pin determinism: same vector stroke → identical baked raster hash across two runs, after undo/redo, and after reopen. Test the host and engine sampling agreement explicitly.
- Do **not** reuse `pointsToBezierAnchors` unless it carries the attribute channels; raise or deliberately decimate for `MAX_POLYLINE_POINTS`.
- Wireframe preview: cache projected points and redraw on change; avoid per-vertex DOM nodes and per-frame allocations (WKWebView layout thrash).

**Warning signs:**
- "It looked different after I reopened it"
- Per-vertex color/width ignored beyond the first stop
- The preview polyline is visibly coarser than the baked stroke (96-point cap)
- `Math.random` in a path that feeds the bake
- Apply accepts a vector payload with missing vertex attributes

**Phase to address:** Phase 61 (payload contract + determinism pins). Phase 62 consumes the same payload shape for curve editing — settle it here.

---

### Pitfall 12: Curve-editing a baked stroke by moving its pixels (or re-rolling its texture)

**What goes wrong:**
The user drags a bezier handle on a painted stroke. If the editor deforms the cached raster, the stroke "melts": it no longer matches a replay of its script, and the lift/erase transmittance punch (applied to the cached raster, never alpha) is corrupted — erased regions reappear or the wash doubles. If instead the editor re-bakes a changed point set, the engine's sequential RNG stream shifts and the **entire texture re-rolls** — the user sees a different stroke, not a reshaped one. Loop Clips make it worse: editing the source frame must invalidate every occurrence.

**Why it happens:**
The bake cache is keyed by stroke identity/content, and the engine's texture depends on draw order and point count. Base recovery (`aquarelleBaseRecovery`) is only valid outside script coverage; a handle edit can expand coverage. Lift is a transmittance punch on the cache, not an alpha edit, so pixel deformation is not recoverable.

**How to avoid:**
- Curve edits are **script mutations**: edit the vector payload, invalidate the bake, recover the durable pre-script base, replay, re-bake. Never mutate cached pixels in place.
- Preserve determinism where possible: prefer moving existing points over inserting/removing them, so the per-point RNG consumption is unchanged; if the point count must change, decide explicitly (and preview) whether the texture re-rolls. A stable per-point seed is a valid alternative if the phase accepts it.
- Define invalidation across Loop Clips: a source-frame edit invalidates every occurrence (`sourceFrameRefs`, track/clip revisions), not just the visible frame.
- Undo/redo must act on the script state and settle in-flight bakes: a stale bake landing after an undo is a visible regression. Use the existing bounded bake queue and revision checks.
- Re-verify base recovery's provenance guards after the edit — a widened script area must rebuild the base, not invert an invalid one.

**Warning signs:**
- The edited stroke's texture differs from a freshly drawn identical shape — and the user notices
- Erased/lifted regions reappear after a curve edit
- Loop occurrences keep the old shape while the source frame updates
- Undo restores geometry but not pixels
- Bake queue depth grows during rapid handle drags
- The editor can produce a state where the cached raster and the script disagree

**Phase to address:** Phase 62 (re-bake pipeline + loop invalidation + undo/bake settling).

---

## Moderate Pitfalls

### Pitfall 13: Two motion systems collide (`PhysicPaintRotoScriptMotionSettings` vs Motion channels)

**What goes wrong:**
`PROJECT.md` carries the constraint that `PhysicPaintRotoScriptMotionSettings` (script-motion wiggle, quick 261030-ey9) is a **different system** and must not be merged with Motion channels. Both are "motion" on the paint side; a refactor that unifies the types or reuses the wiggle evaluation produces double motion, or silently changes existing script playback.

**How to avoid:** Keep the types and evaluators separate; name the new model distinctly (rail motion) and add a static scan/pin that the two settings types never import each other. Document the difference in the phase plan.

**Warning signs:** A diff that touches both; "motion" used unqualified in code; existing script replay changes after the phase.

**Phase to address:** Phase 59.

### Pitfall 14: The channel-set contract disagrees with the mockup (Scale lane)

**What goes wrong:**
The v3 model requires Position, **Scale**, Rotation, Opacity; the v7 mockup shows only Position, Rotation, Opacity. Shipping whichever is easier creates a spec-vs-UI mismatch that will be flagged at UAT, and the outline height (`30 + 18 × channels`) and the expand math depend on the count.

**How to avoid:** Decide in the Phase 59 plan (README default: add Scale as a 4th lane; Position one lane vs X/Y is a separate decision) and pin the channel list in a test. UAT row 3 must assert the exact rows rendered.

**Warning signs:** UAT screenshots show 3 lanes while the spec says 4; two sources of truth for `channels`.

**Phase to address:** Phase 59.

### Pitfall 15: Zoom sneaks into the document

**What goes wrong:**
Zoom is session-only by locked scope (`CONTEXT.md` §5.6: "no document/schema/export change"). A convenient "restore zoom on reopen" persists it into `.mce`, which violates the milestone contract and creates an export/schema delta nobody asked for.

**How to avoid:** Keep zoom in view state only; add a test that document revision and export fingerprint are unchanged after zooming; explicitly rule out `.mce` changes for Phase 60.

**Warning signs:** A schema diff for zoom; a project reopens at a non-1× zoom; export tests change.

**Phase to address:** Phase 60.
---

## Technical Debt Patterns

Shortcuts that look reasonable in the phase and cost later. "Never" means this codebase has already paid for the mistake once.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Multiply `× zoom` ad hoc at each of the 66 pitch sites | Tiny per-site diff | Divergence at non-1×; the suite stays green because it only tests 18 | **Never** — derive one `framePitch` and pass it |
| Put sampled motion values in the flattened cache key | No compositor change | One full flattened record per drag step in an unbounded `Map` → WKWebView OOM | **Never** |
| Bake motion into drawing keys | "It just works" | Re-bake per motion edit; violates the render law; cache churn | **Never** |
| Restrict motion to loop clips (README default) | No rail-identity work | Bare key rails stay static; a later migration | Acceptable for v1 **only if documented and the UI is honest** |
| Skip motion blur for rail motion silently | No velocity work | Inconsistent with content layers; users report it as a bug | Acceptable **only as a locked, documented limitation** (Option B in Pitfall 3) |
| Reuse `pointsToBezierAnchors` for vector strokes | No new fitter | Per-vertex pressure/props dropped; replay drift | **Never** without attribute channels |
| Deform cached pixels for curve edits | Instant preview | Replay mismatch; lift/transmittance algebra broken | **Never** |
| Fix the 30 vs 31 row drift inside the zoom phase | One-line cleanup | Cross-cutting visual change mixed with zoom; breaks token tests | Only as a **separate**, pinned change — not smuggled into Phase 60 |
| Hard-code `+8` / `18` into the new channel-row math | Copies the existing shape | A second unzoomed geometry family in Phase 60 | **Never** — parameterize while writing it |
| Accept unbounded memo growth "temporarily" | Faster feature | The exact class of prior OOM kills; hard to attribute later | **Never** in this runtime |
| Persist zoom in `.mce` | "Nice to have" | Violates Phase 60's locked scope; schema/export delta | **Never** in this milestone |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `_flattenedMemo` ↔ `compositeFrame` | Assume the content revision covers motion | Motion revision term **or** transform-after-lookup; never sampled values in the key |
| Export sub-frame accumulation ↔ `getFlattenedFrame` | Pass the fractional `physicPaintFrame` straight in | Integer content + fractional transform; a paint-specific sub-frame compose path |
| `VelocityCache` ↔ paint layers | Assume keyframes describe all motion | Combine layer keyframes × rail motion, or lock the limitation explicitly |
| Studio child realm ↔ main realm | Add the motion field only to the document revision | Add view-only parts to `buildEfxPaintDocumentSyncFingerprint`; pin a mutation → fingerprint change |
| `serializeRuntimeIntoDocument` ↔ track revisions | Hand-map frames/roto only | Map the motion model too; compute the dirty token from the same revision (no second flag) |
| `.mce` TS ↔ Rust field-diff pin | Believe the pin covers the paint document | It does not — paint rides as `serde_json::Value`; extend the pin or add a dedicated round-trip pin |
| Header column ↔ rows region | Add 18px on one side only, or use `index × 31` | One measured row-offset model shared by both; 18px + 2px gap on both sides |
| Loop Clip rail ↔ motion | Treat rail-local frame 0 as document frame 0 | Resolve per occurrence via `placementStart` + `cycleOffset`; test occurrence 2 |
| Sound stain / audio window ↔ zoom | Keep dividing by `ROTO_CELL_WIDTH_PX` | Pass `framePitch`; the stain helpers are already parameterized |
| Cross-track drag ↔ zoom | Reimplement the pitch math | Reuse `computeInsertionFrame(pointerX, scrollLeft, zoom, framePitch)`, the one hook that already multiplies correctly |
| Vector preview ↔ bake host | Preview uses live jitter (Math.random) | The preview must render from the same deterministic sample list as the bake |
| Curve editor ↔ bake queue | Fire bakes without revision checks | Cancel/settle on undo; revision-check before a bake lands |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Memo growth per motion drag step | Memory climbs during a drag; Studio slows over a session | Transform-after-lookup, or motion-revision keys + LRU | Within one drag of a 30-frame HD rail (~100 full records) |
| Motion re-bake | Seconds per frame, new cache entries per edit | Compositor transform; no re-bake for motion | Immediately on the first animated rail |
| 4× wide grid with full document extent | Scroll jank, layout thrash | Derive widths from pitch, keep node count = frame count | Long documents at 4× |
| Per-vertex allocations / DOM in the wireframe preview | Stutter while dragging handles | Cached projected points, single canvas path, redraw on change | Dense curves near `MAX_POLYLINE_POINTS` |
| Per-sub-frame flattened lookups | Motion-blur export slows / drops paint | One content raster per track + fractional transform | Sub-frame count > 1 |
| Synchronously invalidating every loop occurrence on a source edit | Edits feel blocked on a long document | Mark dirty, re-bake lazily/queued; pin queue depth | Many occurrences × many frames |
| Header/rows lockstep measured in the wrong order | Visible 1-frame desync while scrolling | Single model computed once per render; no per-region remeasure | Any expanded rail |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Trusting motion fields loaded from `.mce` (opaque `serde_json::Value`) | NaN/Infinity or wrong-typed transforms reach the compositor; malformed payloads crash or corrupt the document | Validate fail-closed on load: reject or deterministically drop the motion block; never partial-apply |
| Bypassing the fail-closed script Apply for vector payloads | Malformed vector strokes execute in the engine | Serialize through the same envelope/validation; reject with a real reason |
| Accepting partial motion data from the child realm | Studio and main diverge silently | Sync fingerprint + revision gates; a rejected sync must keep the old state, not a half-applied one |
| Adding a new local IPC/API surface for motion without the existing validation | Widens the trust boundary | Reuse the existing store/controller seam; no new ad-hoc endpoints in these phases |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| A toggle that promises channels with no data | User clicks, nothing happens, trust erodes | Grey `minus` + `aria-disabled` with the real reason (README UAT 6) |
| Active-track motion jumps on Play | Reads as "the app is broken", not "a bug in a new feature" | Fix Pitfall 4 before any visual polish |
| Expanding a rail hides the previous one without a cue | Users think their keys disappeared | Expanding the selected rail collapses the other; keep the selection outline visible (design default) |
| Curve edit changes the stroke's texture | User believes the edit destroyed their art | Preserve point order when possible; otherwise preview before commit |
| Zoom teleports the viewport | User loses their place while navigating | Anchor on the frame under the cursor/centre |
| Motion-key nav buttons silently no-op | User cannot tell missing plumbing from a bug | Disable with a real reason when the store action is absent |
| Ruler labels collide at 0.25× | Timeline becomes unreadable at the zoom-out users try first | Adaptive label step, fixed tick pitch |

## "Looks Done But Isn't" Checklist

- [ ] **Motion cache:** A Motion-key edit updates the composite — and `_flattenedMemo.size` does **not** grow per drag step.
- [ ] **Persistence:** Reopen the project → every Motion key is at the same frame with the same curve; the document revision and sync fingerprint changed when it was edited.
- [ ] **Cross-realm:** Studio-side motion shows in the main window without a reload.
- [ ] **Export:** Motion-blur export contains paint on every sub-frame; the frame count matches the blur-off export.
- [ ] **Active track:** Edit mode, Play, and PNG export agree for the **active** animated track.
- [ ] **Identity:** Delete the first drawing key, split a rail, copy/paste, undo — motion travels with its rail or is explicitly dropped.
- [ ] **Loop occurrence:** Hold and fit-to-span are correct on occurrence 2, not only occurrence 1.
- [ ] **Zoom matrix:** At 0.25/0.5/1/2/4×: playhead centred, hit-test exact, ruler ticks cell-aligned, sound stain aligned, Loop Clip width correct, audio window correct.
- [ ] **Row lockstep:** Expanding a rail adds exactly 18px per channel to **both** header and rows, plus the 2px gap; the reorder indicator uses measured offsets.
- [ ] **Vector replay:** The same vector stroke bakes to the same raster hash across two runs, after undo/redo, and after reopen; per-vertex properties survive.
- [ ] **Curve edit:** The edited stroke re-bakes from the recovered base; lift-stamped regions survive; every loop occurrence updates; undo cannot leave a stale bake.
- [ ] **Schema law:** Any `.mce` motion field has a real TS↔Rust pin (or a documented round-trip pin), not just the passing `mceFieldContract.test.ts`.
- [ ] **Scope law:** Zoom changes nothing in the document or export; no motion fields are merged with `PhysicPaintRotoScriptMotionSettings`.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Stale composite after a Motion-key edit | LOW | Clear the affected memo (document-write path already does), then fix the key/revision seam |
| Paint missing in sub-frame export | MEDIUM | Add the integer-content + fractional-transform path; re-export; verify frame count |
| Memo OOM / runaway growth | HIGH | Bound the memo (LRU), remove sampled values from keys, restart the Studio; verify memory across a scrub |
| Motion lost on reopen | MEDIUM | Audit the four carriers (`serializeRuntimeIntoDocument`, content encoder, sync fingerprint, change token); migration is **not** available — no backward compat for old projects |
| Rail identity orphaned (split/delete-first-key) | HIGH | Prefer a durable `railId`; if motion was restricted to loop clips, re-attach by `loopId`; add repair-on-load only if the data cannot be reconstructed |
| Zoom misalignment | LOW–MEDIUM | Collapse to one `framePitch` seam; rerun the zoom matrix; fix the half-cell offset formula |
| Vector replay drift | MEDIUM | Fix the sampling law; re-bake affected strokes from the script; compare hashes |
| Pixel-deformed stroke after an in-place curve edit | HIGH | Recover from the durable pre-script base, replay, accept that the pre-edit bake is lost; block in-place edits in code |
| Stale loop occurrence after a source edit | LOW | Invalidate all occurrences by revision; re-bake on demand |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Motion missing from the cache key / memo explosion | Phase 59 | Pin test: key edit changes the composite; memo size flat across a drag |
| 2. Fractional sub-frame paint loss | Phase 59 | Motion-blur on/off export parity, frame count match |
| 3. Motion blur blind to rail motion | Phase 59 | Velocity non-zero for a motion-only rail (or the limitation is locked + documented) |
| 4. Active-track live-overlay drift | Phase 59 | Edit → Play → export frame equality on the active animated track |
| 5. Two-stage resample at scale/rotation (Gate D) | Phase 59 | Measured memory + cropped 1×/2×/4× comparison; Gate D answered in the plan |
| 6. Motion persistence / sync carriers | Phase 59 | Revision + sync fingerprint + change token all rotate; reopen test; `.mce` round-trip pin |
| 7. Drawing-key-derived rail identity (Gate B) | Phase 59 | delete-first-key / split / copy-paste / undo tests; occurrence-2 hold & fit tests |
| 8. The 66-site 18px pitch | Phase 60 | Zoom matrix at 0.25/0.5/1/2/4× (playhead, hit-test, ruler, stain, Loop Clip, audio) |
| 9. Half-cell offset + 31/30 drift + index offsets | Phase 59 (measured offsets), Phase 60 (zoom-invariant) | Header/rows lockstep at 3 and 4 channels; indicator never inside a block; outline height from live row height |
| 10. Zoom materialization / scroll anchor / ruler labels | Phase 60 | Anchor frame preserved at both edges; labels legible at 0.25×; Fit clamps |
| 11. Vector determinism and payload | Phase 61 | Same stroke → same raster hash across runs/reopen; per-vertex props survive; fail-closed Apply |
| 12. Curve-editing baked strokes | Phase 62 | Re-bake from recovered base; lift survives; loop occurrences update; undo cancels in-flight bakes |
| 13. Two motion systems collide | Phase 59 | Static scan: the two settings types never import each other; script replay unchanged |
| 14. Channel-set contract vs mockup | Phase 59 | Rendered channel list pinned in a test; UAT asserts the rows |
| 15. Zoom in the document | Phase 60 | Document revision and export fingerprint unchanged after zoom; no schema diff |

## Sources

Code verified on disk (2026-11-06):

- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — `ROTO_CELL_WIDTH_PX` (56 refs), `RULER_STEP`, `RULER_TICK_WIDTH_PX`, `STRIP_ROW_HEIGHT_PX = 31`, playhead `+8` offset, `gridTemplateColumns`, scroll-to-frame, drag/hit-test math, ghost/set-drag previews, Loop Clip `framePitch`
- `app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx` — `HEADER_ROW_HEIGHT_PX = 31`, `index × 31` reorder indicator
- `app/src/components/physic-paint/view/timelineRailDesign.ts` — `TIMELINE_GEOMETRY.rowHeight = 30`, `cellPitch = 18`, `motionLaneHeight = 18`
- `app/src/components/physic-paint/physicsPaintStudio.css` — 31px row rules
- `app/src/efx-paint/compositor/efxPaintCompositeCache.ts` — flattened key terms (no motion term), unbounded `createKeyedMemo`
- `app/src/efx-paint/compositor/efxPaintCompositor.ts` — per-track `drawImage`, no transform stage
- `app/src/stores/physicPaintStore.ts` — `_resolveFlattenedFrame` integer guard, `_flattenedMemo`, `getFlattenedFrame*`, `serializeRuntimeIntoDocument`
- `app/src/efx-paint/document/efxPaintDocumentRevision.ts` — content encoder, `computeDocumentRevision`, `buildEfxPaintDocumentSyncFingerprint`, `buildEfxPaintCompositeRevision`
- `app/src/lib/previewRenderer.ts` — paint branch without `layer.transform`; motion-blur block limited to keyframed content layers
- `app/src/lib/exportRenderer.ts` — sub-frame accumulation passing fractional `physicPaintFrame`
- `app/src/lib/motionBlurEngine.ts` — `VelocityCache`/`isStationary` from `KeyframeValues`
- `app/src/lib/mceFieldContract.test.ts`; `app/src-tauri/src/models/project.rs` (`HashMap<String, Value>` paint carriers); `app/src/types/project.ts` (`efxPaint?: Record<string, unknown>`)
- `app/src/components/physic-paint/hooks/usePhysicsPaintCrossTrackDrag.ts` — existing `zoom` seam and `framePitch × zoom`
- `app/src/components/physic-paint/view/physicsPaintAudioController.ts`, `soundBandGeometry.ts`, `physicsPaintLoopClipPresentation.ts` — pitch consumers
- `packages/efx-watercolor/src/engine/deposit.ts` — sequential `seededRng(traceSeed, 'deposit')`
- `packages/efx-paint-host/src/util/traceSeed.ts` — `hashMutationId` / `mixStrokeSeed`, host-vs-engine draw keying
- `app/src/components/physic-paint/roto/aquarelleBaseRecovery.ts`, `aquarelleLiftErase.ts` — base recovery and transmittance punch
- `app/src/lib/bezierPath.ts`, `app/src/types/paint.ts` — `pointsToBezierAnchors` (2D only, drops pressure), `BezierAnchor`, `MAX_POLYLINE_POINTS = 96`
- `app/src/components/physic-paint/view/PhysicsPaintProgramMonitor.tsx` — `getFlattenedFrameExcluding` live-overlay path

Specs and planning:

- `SPECS/v2.1.0-motion-channels/CONTEXT.md` — §3 v3 model, §3.5 render law, §3.6 Gates A–D, §5.6 locked zoom scope
- `SPECS/v2.1.0-motion-channels/README.md` — §2 geometry, §3 toggle state machine, §4 integration map, §5 UAT, §6 open decisions
- `.planning/PROJECT.md` — v2.1.0 scope (Phases 59–62, API/MCP at 63), constraints (dual-language `.mce`, 60 Hz determinism, one `preact` copy), known debt (VIS-02 row height, rail accent, dual paper fingerprint), the `PhysicPaintRotoScriptMotionSettings` separation constraint
- `.planning/ROADMAP.md` — phase numbering (59 next; 57 retired, never reused)

---

*Pitfalls research for: EFX-Motion Editor v2.1.0 — rail motion channels, Studio timeline zoom, vector painting, painted-stroke curve editing*
*Researched: 2026-11-06*
