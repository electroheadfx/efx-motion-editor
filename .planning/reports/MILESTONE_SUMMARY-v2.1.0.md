# Milestone v2.1.0 — Project Summary

**Generated:** 2026-11-14
**Purpose:** Team onboarding and project review
**Milestone:** v2.1.0 — Rail Motion, Timeline Zoom, Vector Painting & Curve Editing (MINOR)
**Status:** Complete — 4/4 phases, 67/67 plans, 38/38 requirements met or accepted. Milestone audit (2026-11-14) verdict `tech_debt`, zero blocking gaps, one user-accepted deviation (MOTN-12 undo half). Version is bumped to 2.1.0 in `app/package.json` and `app/src-tauri/Cargo.toml`; only `v2.1.0-beta1` / `v2.1.0-beta2` tags exist, so the final signed tag and publish remain a user action.

---

## 1. Project Overview

**What this is:** EFX Motion Editor is a macOS desktop application for creating cinematic stop-motion films from photography keyframes. Users import key photographs, arrange them into timed sequences, add overlay layers (static images, image sequences, videos, paint/rotopaint) with blend modes and keyframe animation, apply cinematic FX and GLSL shader effects, import audio with waveform and beat-synced editing, and draw frame-by-frame with a physical watercolour engine. Everything previews in real time and exports as PNG image sequences or video (ProRes/H.264/AV1).

Alongside the photo pipeline stands the **Water color Studio** — its own window (the main window hides while it is open) — where a deterministic multi-track paint document, a Roto timeline, a reusable Scripts library, and a document sound track turn hand-drawn animation into Loop Clips on the main timeline.

**Core value:** The complete stop-motion-to-cinema pipeline must work end-to-end — import key photographs, arrange them into timed sequences, preview in real time, export as PNG image sequences.

**Stack baseline:** Tauri 2.11.5 (Rust) + Preact 11.2.0 + `@preact/signals` 2.11.3 (exactly one `preact` copy workspace-wide) + Vite 5 + Tailwind CSS v4, in a pnpm monorepo (`app/` + `packages/`). Three workspace packages: `efx-paint-host` (engine-agnostic Studio script law: generic `StudioStroke<P>` / `EngineAdapter<P>` over a 60 Hz integer tick grid), `efx-watercolor` (the shipping paint engine), and `efx-spectral` (off the production path since v2.0.0). Rendering is Canvas 2D compositing plus WebGL2 for blur/shaders/motion blur. Project format is the references-only `.mce` package (manifest + `layers/*.json` + `frames/*.webp`).

**Where v2.1.0 sits:** v2.0.0 rebuilt the paint side as a single Water color workstation; v2.0.1 shipped rail editing and the v7 timeline rails with no schema change. v2.1.0 is a **MINOR** milestone that turns every rail into an animatable object, then adds frame-density timeline zoom, a vector painting tool, and painted-stroke curve editing. It is the first milestone since v1.0.0 to extend the paint document model with a new animation system (rail Motion channels) and new stroke geometry (vector anchors), while keeping the one-engine / one-compositor architecture intact.

**Source of truth:** `SPECS/v2.1.0-motion-channels/` — `CONTEXT.md` is the model/intent authority, `README.md` the motion-lane UI contract, `MOTION-CHANNELS.tsx` / `motion-channels.css` the surface reference. Chrome authority is v7; the v3 frame supplies only the animation model.

---

## 2. Architecture & Technical Decisions

### 2.1 Rail motion — the animatable rail model (Phase 59)

- **Motion is a second, independent key system on any rail.** A rail — Standard, Motion, Static, Reveal, or a bare Key Rail — carries Motion keys that never create, alter, or require drawing keys. There is no cycle value and no conversion step.
  - **Why:** The user's model is "animate a character, a bird, a cloud" — the object moves while its drawings keep cycling. Binding motion to drawing keys would force a conversion and break the compositor law.
  - **Where:** `roto/railMotionModel.ts`, `roto/railMotionIdentity.ts`, `roto/railMotionDocumentReconciler.ts`.

- **Durable rail identity is derived and reconciled (Gate B).** A motion-bearing bare Key Rail needed an identity that survives split, merge, delete, copy/paste, and reopen. The phase answered this with a `railId` mint plus a reconciler at the real edit operations, with explicit orphan handling.
  - **Why:** v0.8–v1.0 Key Rails were derived from `firstKeyId` + `keyIds` and had no durable identity; motion attached to such a rail would silently move to another object after an edit.
  - **Where:** `railMotionIdentity.ts`, `railMotionDocumentReconciler.ts`, `physicsPaintRotoLoopGuards`, `railMotionGateBEdits.test.ts`.

- **The transform is applied once, at the compositor.** Rail motion contributes `trackTransforms` at both compositor draw sites (normal and engine overlay). One content raster per track per frame; content cycles while motion continues; nothing re-bakes for a motion edit.
  - **Why:** This is the v1.0 compositor law and REL-03. Baking motion into frames would force re-bakes on every drag and blow the flattened memo.
  - **Where:** `efx-paint/compositor/efxPaintCompositor.ts` (`:265-302, 409-416, 445-452`), `efxPaintCompositeCache.ts`, `efxPaintDocumentRevision.ts`.

- **Canonical revision and raster revision are split.** Motion values join the canonical document revision (save/reopen, undo, revision authority) but never enter the raster/cache key. A motion drag invalidates the composite without invalidating the flattened content memo.
  - **Why:** Sampled values in the flattened cache key would grow the `_flattenedMemo` per drag step (Pitfall 1).
  - **Where:** `physicPaintStore.ts` (`:1983-1989`, `:3512-3596`, `:3678-3696`), `efxPaintCompositeCache.ts` (`:175-186, 222-226`).

- **One pure evaluator: Hold, Ease, Wiggle; unbounded rotation.** Motion channels evaluate in rail-local time with endpoint hold. Rotation is unbounded (0°/360°/720° are distinct keys). Wiggle is seeded from the rail id and deterministic at export. No B-spline — an approximating basis misses its keys.
  - **Where:** `roto/railMotionEvaluator.ts`, `roto/railMotionPath.ts`, `railMotionEvaluator.test.ts`.

- **Pivot is the rail content centre, computed once per rail revision.** It never reads per-frame raster bounds, so a cycling drawing does not wobble.
  - **Why:** Time-invariant by construction; the local-centre pivot is what makes a small object rotate around itself.
  - **Where:** `roto/railMotionPivot.ts`.

- **Hold-only repeat ships in v1; fit-to-span is deferred.** Motion holds past its last key on every occurrence. Motion blur on rail motion is deliberately off in v1 (documented limitation); REL-04's sub-frame paint law is unaffected.
  - **Why:** Both were explicit scope decisions (D-16, D-18), recorded as limitations rather than omissions.

- **Authoring is a gizmo plus numeric fields, with an explicit auto-key gate.** The on-canvas gizmo covers Position, Scale and Rotation; Opacity is numeric-only in the right-panel inspector. Dragging auto-keys only inside a channel that already carries motion — an un-animated channel never mutates silently.
  - **Where:** `PhysicsPaintReferenceTransformHandles.tsx` pattern reused; `railMotionCommands.ts`; `selectedKeyRailInspector` projection.

- **Motion persistence is a conditional canonical term, declared in both languages.** The field is not named `motion` (`PhysicPaintRotoScriptMotionSettings` is a separate system and is never merged). Rust emits the identical block at the identical ordinal; a byte-parity golden fixture pins TS↔Rust.
  - **Where:** `efxPaintCanonicalEncoder.ts`, `app/src-tauri/src/services/script_library.rs` (`canonical_rail_motions`), `railMotionCanonicalParity.test.ts`, `railMotionCanonical.golden.json`, `railMotionPackageRoundTrip.test.ts`.

- **v7 lane surface is the interface, one open block at a time.** 18px lanes, header cluster (icon, label, "N keys", previous/diamond/next), 16×18 cells, 1.5px curves, 6×6 keys with the lighter type rim, rounded selected-rail outline wrapping the rail row plus its expanded channels, 2px post-block gap, measured reorder offsets. Only channels carrying keys render, plus a `+` row; deleting a channel's last key removes its lane.
  - **Where:** `view/timelineRailDesign.ts` (single geometry/palette source), `TimelineMotionChannels.tsx`, `physicsPaintTrackHeaderColumn.tsx`.

- **Three selection scopes stay independent:** rail, drawing key, motion key — each with its own contextual commands. Animate is visible in rail scope only and seeds one identity Position key at the playhead, leaving the block collapsed.

### 2.2 Timeline horizontal zoom — one pitch authority (Phase 60)

- **A single session-only metrics module is the pitch authority.** Every frame→pixel consumer reads it: playhead, ruler, hit-testing, drag, scrub, selection, paste, sound stains, scroll-to-frame, rail geometry, motion lanes. No local `× 18` survives; the literal-`18` audit reached zero and the source-string pins were repointed at the authority.
  - **Why:** Pitfall 8 — a partial conversion produces a timeline where gestures and rendering disagree at non-100% zoom.
  - **Where:** `view/physicsPaintTimelineZoom.ts`, `PhysicsPaintWorkflowStrip.tsx`, `PhysicsPaintTrackRow.tsx`, `usePhysicsPaintRulerScrub.ts`, `usePhysicsPaintCrossTrackDrag.ts`.

- **No Preact context provider and no CSS `transform: scale`.** Module-level components consume the pitch and cannot take props; a CSS scale would double-scale every client-rect-derived mapping (the canvas-zoom prohibition). CSS custom properties are used only for values CSS itself renders.

- **Range and anchoring are locked.** 0.25×–4×, presets `[0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]`, 100% = the base 18px pitch. Cmd/Ctrl+wheel is continuous exponential and keeps the frame under the cursor fixed; the pill steps the ladder from the current value and keeps the playhead frame fixed, falling back to the viewport centre. Plain wheel still scrolls horizontally; trackpad pinch flows through the same Ctrl+wheel branch.
  - **Note:** the fourth pill control ships as a **100%-reset** (square-dimensions icon), not the originally drafted "Fit" — recorded in REQUIREMENTS.md, which is authoritative.

- **Vertical geometry never moves; horizontal terms scale.** Row, lane, and cell heights are fixed. Cell width/gap/pitch, rail line widths, and all frame→pixel mappings scale. Markers (6×6 motion keys, playhead) keep a fixed pixel footprint and stay centred on their scaled slot. The ruler only coarsens: smallest multiple of the 3-frame step that leaves ≥40px per tick, every tick labelled.

- **Zoom is a UI preference, remembered per paint layer.** It never enters `.mce`, schema, project persistence, revision, cache key, or export output. Because the Studio window is destroyed on close, the memory lives in the main realm and is LRU-capped.
  - **Where:** `physicsPaintTimelineZoom.ts` (`resetForStudioOpen` precedent from canvas zoom), `PhysicsPaintTimelineZoomBar.tsx`.

- **The zoom acceptance matrix is the test surface.** `PhysicsPaintWorkflowStrip.zoomMatrix.test.ts` asserts playhead centre, hit-test frame at a fixed `clientX`, ruler extent, sound-stain left/width, Loop Clip extent, and audio visible-frame range at 0.25 / 0.5 / 1 / 2 / 4.

### 2.3 Vector painting — a second stroke kind without a second engine (Phase 61)

- **Vector strokes are geometry (anchors + handles) inside the existing opaque engine payload.** Two anchor kinds only: a Bézier anchor carrying its own coupled handles (with handle break), and an auto-smooth anchor whose handles are derived from neighbours. Grabbing an auto-smooth tangent permanently promotes it to Bézier — "the moment you take control, you own it". No third state.
  - **Where:** `packages/efx-watercolor/src/payload/vectorPath.ts`, `packages/efx-watercolor/src/vector/spine.ts`, `app/src/components/physic-paint/view/vectorPathHandles.ts`.

- **Drawing is auto-smooth by default; Alt places a corner.** Enter or double-click finishes; clicking the first anchor finishes there. Paths are always open — no closed flag, no fill, no join-back segment.

- **Two distinct controls, never a toggling button.** The vector pen is a 5th entry in the real tool rail (`WATERCOLOR_RAIL_TOOLS` in `PhysicsPaintToolRail.tsx`); the spline-pointer lives in the Stroke Settings dialog header and always means *edit the selected path*. Picking a paint tool or the vector tool leaves edit mode. (`AquarelleToolRow.tsx` is dead code and was not built on.)
  - **Why:** A toggle would have two meanings depending on context; separate controls remove the ambiguity.

- **Width is a sparse per-anchor factor, exposed as "Vertex size".** It is a multiplier of the stroke's brush size (0.2–2.0, with a `→ px` readout), not an absolute width. Untouched anchors interpolate from their nearest set neighbours; a uniform stroke writes no width data at all.
  - **Why:** Conditional canonical terms keep an untouched payload byte-identical, and one multiplier keeps the brush Size control coherent.
  - **Correction that mattered:** the factor cannot ride the existing `scriptScale` (the engine clamps it with `Math.min(1, …)`, silently collapsing every widening edit); it needed its own channel.

- **One engine.** The clean "simple ribbon" began as a second deposit mode inside `efx-watercolor` (`renderMode` persisted discriminator) — but the **simple-ribbon render mode was removed before ship** (user-approved override, commits `cb49cc728` / `842b1b9cc` / `b27035712`). No non-test `renderMode` remains; the codec decoder skips the legacy byte and still rejects reserved bits. The one-engine law held: there is still exactly one watercolour deposit and bake path.

- **Per-vertex colour shipped via a user revision of VEC-04.** The original law said width was the only per-vertex property. Quick `261111-wd6` revised it: `VectorAnchor.color?` is explicit and sparse (no default elision), canonical `#rrggbb`, carried in AQTL v2 by `VECTOR_FLAG_ANCHOR_COLOR = 1 << 3` with a trailing per-anchor block, declared in both `.mce` languages, and deposited through the existing pigment channel. There is no per-vertex brush type and no second size channel.

- **Wireframe is a real performance mode.** It covers every stroke on the sheet (spine + width envelope + anchors + handles; hand-painted strokes get spine + envelope). Nothing is captured, reset, re-baked, or persisted while it is on. It generalises the shipped Draft suppression mechanism rather than adding a second suppression path, and is session-only view state.

- **Persistence is a three-deliverable law.** Strokes save as opaque AQTL binary, not field-for-field JSON. A new payload field needs (1) an AQTL v2 encoder, (2) declaration-layer `Mce*` members in both TS and Rust, and (3) a TS round-trip pin — otherwise it is silently dropped on reopen. `TOOL_CODE_BY_NAME` is fail-closed, params are sorted, and unknown override keys are rejected.
  - **Where:** `performance/scriptTimelineCodec.ts`, `app/src/lib/mceFieldContract.test.ts`, `app/src-tauri/src/models/project.rs`.

- **Spline curve mode is a persisted per-stroke field with one evaluator.** Shipped late in the phase (61-30/61-31) behind a one-way decision checkpoint: `curveMode` selects Bézier or Spline evaluation, and the re-sample is mode-aware. This is the field Phase 62 reuses for converted painted strokes.

### 2.4 Painted-stroke curve editing — conversion, not a transient fit (Phase 62)

- **The first committed anchor/handle edit converts the painted stroke into a Phase 61 vector path.** The stroke gains `anchors` (and `curveMode` when non-default), and its `points` become the re-sampled spine. From then on it is a vector stroke in every respect. One-way: the original hand samples exist only in the undo ledger after conversion.
  - **Why:** One data model after the edit, no lingering "converted" mode. This decision **opened the ROADMAP scope gate** on persisting Bézier anchors; REL-02 applies, but no new `.mce` field was invented — `anchors` and `curveMode` already round-tripped since Phase 61.
  - **Where:** `aquarelleRecordState.ts` (`updateAquarellePathInScript` with a `curveMode` options seam), `PhysicsPaintStudio.tsx` (`commitAquarelleVectorPathEdit`).

- **Anchors are fitted lazily, on curve-mode entry.** Never at paint time, never in a background pass. Entering and leaving without a gesture writes nothing. The fit is **interpolating, not approximating**: Douglas-Peucker on the original polyline with tolerance equal to `PATH_SAMPLE_STEP_UV`, plus a turn pass above π/4 to guarantee a retained vertex at every cumulative turn, capped at ~40 anchors with a bounded fallback (tolerance doubling, then index decimation).
  - **Why:** "If it's inefficient, it's the wrong time" — the capture→encode→bake pipeline is the sensitive path. Interpolating anchors mean the curve passes through every anchor and untouched anchors do not move.
  - **Where:** `view/vectorPathFit.ts`, `vectorPathHandles.ts`, `packages/efx-watercolor/src/payload/vectorPath.ts`.

- **Entry turns the wireframe on and shows a ghost of the original spine.** The fitted path, one marker per anchor, and a faint ghost of the recorded spine appear over the paint, so deviation is visible before the irreversible commit. Exit restores the user's previous wireframe/Draft state exactly once.

- **Pressure is remapped by arc length; endpoints pinned.** The hand's heavy/light character survives the reshape. Documented exception: a mouse-painted stroke records only the `-1` speed sentinel, so there is no per-sample pressure to remap and it keeps Phase 61's uniform anchor-width envelope.
  - **Where:** `vectorPathHandles.ts` (`resampleVectorSpineWithPressureLaw`), `aquarelleStrokeBand.ts`.

- **Every path edit preserves the stroke's sample count.** The existing samples are redistributed along the new spine by arc length, so `ticks` and the wet lifetime never change with path length. This deliberately also replaced Phase 61's length-proportional re-sample for drawn vector strokes, and the old pin was retired with a stated reason.
  - **Why:** The sample count *is* ticks; minting more would create a new wet lifetime and change what the user sees.

- **One committed gesture = one ledger entry; the conversion rides the same entry.** One undo restores the hand-painted points and the pre-edit bake exactly. Undo during an in-flight bake cancels the apply, restores the pre-edit script and sheet, and writes no ledger entry — a cancellation token through `runAquarelleScriptRebake` ensures a pending apply cannot publish, and the undo targets *this* edit, never the previous history entry.

- **Loop occurrences are source-only.** Curve mode is offered where the stroke is a real key. The edit re-bakes the source; every linked occurrence presents the new pixels from one source-scoped cache entry. No occurrence-local copy, no materialization, no projection of source strokes into occurrence frames.
  - **Where:** `useRotoFramePersistenceCoordinator.ts` (`buildRotoRealCacheRevision`), `physicsPaintRotoPhysicalModel.ts`, `rotoLivePixelCacheTransactions.ts`.

- **Eligibility is Brush, Water, Pen — never Lift (eraser).** Refusal uses the existing named-reason gate. Curve mode stays single-stroke; no forked editor exists for "script" versus "vector" strokes.

### 2.5 Cross-cutting laws affirmed by this milestone

- **REL-01 — no new runtime dependencies.** `app/package.json` deps unchanged; `Cargo.toml` gained only a feature. Pinned by `railMotionDependencySurface.test.ts`.
- **REL-02 — every new `.mce` field round-trips byte-identically**, declared in both TS and Rust, pinned by tests. Re-enforced on Phase 61's vector fields and on Phase 62's converted strokes.
- **REL-03 — Motion joins the canonical document revision; sampled values never enter the flattened cache key.**
- **REL-04 — Motion-blur export keeps paint on every frame:** integer content raster, fractional transform, flattened-memo bypass; pinned by `railMotionExportParity.test.ts`.
- **Determinism is structural:** 60 Hz integer tick grid, FNV-1a `traceSeed`, no `Math.random()` in deposit or simulation; same script ⇒ same pixels.
- **Session-only view state never enters the document:** canvas zoom, timeline zoom, wireframe toggle. All three are module-level signals with `resetForStudioOpen` semantics.
- **Dual-language `.mce` law is mechanically enforced** by `mceFieldContract.test.ts` and the Rust validation mirrors.
- **Fail-closed parsing and named refusals:** an unreadable value refuses with a visible reason; no silent data drop.
- **Preact reactivity discipline:** no `useState`, signals only; compare-then-write setters so a same-value commit causes no render and no undo entry; narrow signal reads; no render-body signal writes (the `efx-preact-reactivity` skill is the authority).

---

## 3. Phases Delivered

| Phase | Name | Status | Plans | Verification | UAT | Completed |
|-------|------|--------|-------|--------------|-----|-----------|
| 59 | Rail Motion Channels & v7 Interface | Complete | 25/25 | passed — 21/21 truths | 15/15 passed (row 11 undo corrected by audit) | 2026-11-08 (verified 2026-11-10) |
| 60 | Studio Timeline Horizontal Zoom | Complete | 6/6 | passed — 20/20 truths | 5/5 passed | 2026-11-09 |
| 61 | Vector Painting Tool | Complete | 31/31 | passed — 19/19 truths (3 approved overrides) | 21 rows; 16 passed + 5 issues resolved by 61-22…61-30 | 2026-11-12 |
| 62 | Painted-Stroke Curve Editing | Complete | 5/5 | passed — 49/49 truths (2 approved overrides) | 10/10 passed | 2026-11-14 |

**One-liners**

- **Phase 59:** Any rail animates through independent Motion keys applied once at the compositor, with the v7 channel lanes — 25 plans across the model, evaluator, persistence, compositor, lane surface, gizmo, and five rounds of gap/review closure.
- **Phase 60:** Frame density zooms 0.25×–4× from one pitch authority with all vertical geometry fixed, the cursor/playhead anchored, and per-layer memory across Studio reopen.
- **Phase 61:** Pen-drawn vector strokes with per-vertex size and colour, per-stroke style, spline curve mode, wireframe preview, AQTL v2 persistence, and export parity — 31 plans including a spike and two gap-closure rounds.
- **Phase 62:** A selected painted stroke converts to a curve, re-bakes from its recovered pre-script base across every loop occurrence, and undoes an in-flight bake correctly.

**Nyquist coverage:** all four phases have a `VALIDATION.md` and are **COMPLIANT** — no validation gaps remained at close.

**Integration:** 37/38 seams and 4/5 end-to-end flows fully wired; the one exception is the accepted MOTN-12 undo deviation. Verified threads: zoom pitch × motion lanes, compositor transform × vector/curve paint (preview, Play, export), canonical/Rust declaration pair for every Phase 59–62 field, the shared vector editing surface (not forked between Phases 61 and 62), and source-scoped loop invalidation independent of motion.

---

## 4. Requirements Coverage

**38 / 38 met or accepted.** Strict audit score 37/38; one scope deviation accepted by the user.

### Motion — core (MOTN) — Phase 59

- ✅ **MOTN-01** — Motion keys add/edit/remove on any rail kind with no conversion and no cycle value.
- ✅ **MOTN-02** — Motion keys are independent of drawing keys; a rail with no drawing key animates.
- ✅ **MOTN-03** — Position (grouped, or split X + Y in the model), Scale, Rotation, Opacity animate with their own keys.
- ✅ **MOTN-04** — Channels open on demand one at a time; no lane appears by default.
- ✅ **MOTN-05** — Motion lives in rail-local time and survives moving/repeating the rail.
- ✅ **MOTN-06** — Repeat semantics observable: motion holds at the last key (fit-to-span deferred as an opt-in).
- ✅ **MOTN-07** — One raster per track per frame at the compositor; content cycles, motion continues, nothing re-bakes.
- ✅ **MOTN-08** — Edit view, Play, and export produce the same transform, active track included.
- ✅ **MOTN-09** — Rotation unbounded; values hold outside the keyed range; pivot time-invariant in rail space.
- ✅ **MOTN-10** — Ease, Wiggle, Hold attach only to Motion keys; Wiggle seeded and deterministic at export.
- ✅ **MOTN-11** — Three independent selection scopes (rail / drawing key / motion key) with contextual commands.
- ⚠️ **MOTN-12** — Persistence satisfied; **undo/redo half is an accepted deviation**: Motion-only operations are not recorded in the Studio undo ledger, so Cmd+Z after Animate / adding a Motion channel is a no-op. Confirmed live on 2026-11-14, accepted by Laurent Marques the same day (non-destructive; the channel can be removed explicitly). 59-UAT row 11 had misobserved this step; it was not a regression.

### Motion — v7 interface (MUI) — Phase 59

- ✅ **MUI-01** — Coloured chevron (right collapsed / down expanded); grey `minus` when no motion; the minus is a passive indicator.
- ✅ **MUI-02** — 18px lanes, header cluster (icon, label, "N keys", previous/diamond/next), 16×18 rounded cells, 1.5px curves, 6×6 keys with the lighter type rim.
- ✅ **MUI-03** — Rounded bright outline wraps the rail row plus its expanded channels; absent when collapsed.
- ✅ **MUI-04** — Switching rail selection collapses the previous block; one open rail block at a time.
- ✅ **MUI-05** — Header and lanes stay aligned while scrolling (2px post-block gap); reorder insertion indicator uses measured offsets and never lands inside a channel block.
- ✅ **MUI-06** — Previous/next move the cursor to adjacent Motion keys; the diamond adds/removes a key at the current frame; unavailable actions are disabled with a visible reason.

### Timeline zoom (ZOOM) — Phase 60

- ✅ **ZOOM-01** — Cmd/Ctrl+wheel zooms frame density keeping the frame under the cursor fixed.
- ✅ **ZOOM-02** — Zoom pill: minus / percent / plus / 100%-reset over the locked presets; 100% = 18px pitch; playhead anchored with viewport-centre fallback.
- ✅ **ZOOM-03** — Row, lane, and cell heights fixed; only horizontal frame density scales.
- ✅ **ZOOM-04** — UI preference only, remembered per paint layer across Studio reopens; never written to document/schema/persistence/export.
- ✅ **ZOOM-05** — Every frame→pixel consumer reads one pitch authority; the literal-`18` audit is at zero.

### Vector painting (VEC) — Phase 61

- ✅ **VEC-01** — Pen tool draws a vector stroke with corner and smooth anchors.
- ✅ **VEC-02** — Spline pointer edits anchors, coupled handles, handle break, insert, delete, multi-select.
- ✅ **VEC-03** — Stroke width varies per vertex through the sparse anchor width factor ("Vertex size").
- ✅ **VEC-04** — Brush type and colour are per stroke; **per-vertex colour is also supported** after the user's 2026-11-12 revision (sparse `color?`, AQTL v2 bit 3, both `.mce` languages). No per-vertex brush type.
- ✅ **VEC-05** — Wireframe preview shows strokes/paths without render and is the drag-time performance mode.
- ✅ **VEC-06** — Vector strokes persist in `.mce`, survive reopen including curve mode, export as previewed, replay deterministically.
- ✅ **VEC-07** — Undo/redo covers each vector operation as one entry.

### Painted-stroke curve editing (CRV) — Phase 62

- ✅ **CRV-01** — Select a painted Brush/Water/Pen stroke and enter curve mode via the existing spline-pointer; anchors are fitted lazily on entry.
- ✅ **CRV-02** — Anchor/handle edits commit as one ledger entry and re-bake from the recovered pre-script base, preserving sample count, wet lifetime, and the recorded pressure profile.
- ✅ **CRV-03** — Every loop occurrence of the edited stroke is invalidated together; one source-scoped cache entry serves all occurrences.
- ✅ **CRV-04** — Undo during an in-flight bake cancels the apply, restores the exact pre-edit shape, and writes no ledger entry.

### Delivery law — cross-cutting

- ✅ **REL-01** — No new runtime dependencies (Phase 59 enforced; holds across 59–62).
- ✅ **REL-02** — Every new `.mce` field round-trips byte-identically; re-enforced on Phase 61's vector fields.
- ✅ **REL-03** — Motion joins the canonical document revision; sampled values never enter the flattened cache key.
- ✅ **REL-04** — Motion-blur export keeps paint on every frame (integer content raster, fractional transform).

**Approved overrides recorded:** Phase 61 — per-vertex colour revision (quick `261111-wd6`), "Vertex size" = the anchor-width factor (no second size channel), simple-ribbon render mode removed. Phase 62 — A8 first conversion stores `curveMode: 'spline'`; C5 preview uses `DEFAULT_VECTOR_PATH_CURVE_MODE`.

---

## 5. Key Decisions Log

### Rail motion (Phase 59)

| ID | Decision | Why | Reversibility |
|----|----------|-----|---------------|
| D-01..04 | Animate is a rail-scope action that seeds one Position identity key at the playhead; block stays collapsed; chevron is the only feedback | No lane appears by default; no silent second authoring path | Reversible |
| D-05..09 | Gizmo + numeric inspector; gizmo covers Position/Scale/Rotation, Opacity numeric-only; auto-key only inside an already-animated channel; units px / % / ° | Matches existing transform-handle grammar; rejects silent auto-key | Costly (gesture + settlement law) |
| D-10..15 | Only keyed channels render, plus a `+` row; Position = one lane backed by `position-x`/`position-y`; grouped X/Y share key frames; fixed lane order; last-key removal removes the lane | Keeps the model ready for a later Split X/Y with no schema change; reconciles MOTN-04 with the v7 mockup | Costly / one-way for the persisted Position shape |
| D-16 | Hold-only repeat in v1; fit-to-span later as an opt-in absent-means-hold field | No behaviour change when the option arrives | Reversible |
| D-17 | Pivot = rail content centre, computed once per rail revision | Time-invariant; local to the object; avoids wobble from per-frame bounds | Costly (changes how saved rails rotate) |
| D-18 | No motion blur on rail motion in v1 — documented limitation | Transform applies to the integer raster; REL-04 is unaffected | Reversible |
| D-19 | Track opacity × motion opacity | Compositional alpha law | Reversible |

### Timeline zoom (Phase 60)

| ID | Decision | Why |
|----|----------|-----|
| D-01..04 | Pill in the workflow header, always visible; percent readout display-only; Fit/100% is a one-shot computed scale, not a live mode | Mirrors the shipped canvas zoom pill; one number, no second state |
| D-05..08 | Continuous exponential Cmd/Ctrl+wheel; buttons step from the *current* value; pinch uses the same branch; epsilon/clamped ticks are no-ops | Fine control vs discrete ladder; compare-then-write avoids re-renders |
| D-09..11 | Ruler step = smallest multiple of 3 frames with ≥40px per tick, every tick labelled, coarsen-only | Today's ruler is byte-identical at 1×; no sub-division mode to test |
| D-12..14 | Cell width/gap/pitch and rail widths scale; markers keep fixed pixel footprints; no grid-hide threshold | One uniform scale; markers stay visible at 4×; gaps simply antialias at 0.25× |

### Vector painting (Phase 61)

| ID | Decision | Why | Reversibility |
|----|----------|-----|---------------|
| D-01..04 | Two anchor kinds (Bézier + auto-smooth); auto-smooth default, Alt corner; grabbing a derived tangent promotes permanently; no Hermite/TCB/Catmull-Rom menu | One persisted discriminator; interpolating auto-tangent already covers the alternatives | One-way (persisted anchor kind) |
| D-05..07 | Vector pen = 5th tool-rail entry with a non-`P` shortcut; separate spline-pointer in the Stroke Settings header; paths always open | Draw and edit must never share one ambiguous toggle; no fills this phase | Reversible |
| D-08..10 | Numeric width stepper for selected anchors; width = multiplier of brush size; sparse storage, absent = interpolated, uniform writes nothing | Scale control stays coherent; minimal payload; byte-identical untouched strokes | Costly (insert/delete remap law) |
| D-11..14 | One engine; renderMode was an explicit per-stroke discriminator; wet globals at zero in simple mode (collapsed); mode applies to both stroke kinds | All watercolour laws apply in both modes; hybrid is a feature. **Simple-ribbon mode later removed by user override** | One-way while it shipped |
| D-15..16 | Wireframe covers every stroke and suppresses all capture/reset/bake/persist; session-only | Makes drag cost independent of painted-stroke count | Reversible |

### Painted-stroke curve editing (Phase 62)

| ID | Decision | Why | Reversibility |
|----|----------|-----|---------------|
| D-01..02 | First committed gesture converts the painted stroke to a Phase 61 vector path; opens the ROADMAP scope gate but invents no new `.mce` field | One data model after the edit; anchors/curveMode already round-trip | One-way |
| D-03 | Fit lazily on curve-mode entry; entry+exit without a gesture writes nothing | Keeps the paint pipeline free of fit cost | Reversible |
| D-04..05 | Interpolating fit on decimated original samples, curvature-adaptive, ~40-anchor cap | The curve passes through anchors; untouched anchors do not move | Costly (defines first-commit shape) |
| D-06 | Wireframe auto-on for the edit duration with a ghost of the original spine; previous setting restored on exit | The wireframe is the preview before irreversible control | Reversible |
| D-07 | Recorded hand pressure remapped by arc length, endpoints pinned; mouse `-1` sentinel is the one exception | The hand's character survives the reshape; no engine law is duplicated in a view leaf | Costly (pressure lives only in re-sampled points) |
| D-08 | Every path edit preserves the sample count; also replaces Phase 61's length-proportional re-sample | Sample count is ticks and wet lifetime | Costly (retired a shipped pin, with reason) |
| D-09 | Converted stroke's wireframe width is the pressure envelope (uniform envelope for mouse strokes) | Matches the paint's real taper | Reversible |
| D-10..11 | Brush/Water/Pen eligible, Lift refused; loop occurrences source-only | Named refusal; one source cache entry serves every occurrence | Costs if per-occurrence edits are ever added |
| D-12..14 | One gesture = one ledger entry carrying the conversion; undo cancels an in-flight bake; nothing bakes while wireframe is on | Exact pre-edit rollback; cancellation becomes part of the bake contract | Costly |

### Milestone-level precedents reused

- **No approximating basis** (B-spline rejected on motion channels) became the argument that also rejected B-spline vector paths and least-squares curve fitting.
- **Session-only view metrics never enter `.mce`** — applied to timeline zoom and the wireframe toggle.
- **Conditional canonical terms** — applied to rail motion, sparse width, per-vertex colour, and `curveMode`.
- **The pre-script base is the one durable-base authority** — Phase 62's re-bake fails closed on `durable-base-unknown` with zero writes.
- **One source cache entry serves every loop occurrence** — established by the v1.0 resolver and re-asserted for curve edits.

---

## 6. Tech Debt & Deferred Items

### Accepted deviation

- **MOTN-12 (undo half)** — Motion-only operations are not in the Studio undo ledger. Confirmed live 2026-11-14 and accepted the same day. Follow-up candidate: route motion-only commits through the physical edit coordinator (which already carries `railMotions` in its snapshots since 59-07) to produce one ledger entry per operation. Evidence: every Motion command funnels to `useRotoTimelineActions.ts:2454-2472` → `physicPaintStore.replaceRotoPhysicalRailMotions` (`physicPaintStore.ts:5495-5526`), which has no ledger writer.

### Recorded review debt by phase

- **Phase 59** — WR-01: canonical ordering/encoding assumes ASCII rail/key ids with no boundary enforcement (fail-closed at the hash gate). WR-02: cross-track Loop Clip materialized source frames sit outside the paste extent/occupancy model (transaction validates before mutating). WR-07: the Motion sheet's "All" easing button commits twice in property mode (second write idempotent). IN-06: unreachable zero-key guard. IN-07: never-instantiated disabled/reason props on the shared easing control. Records lag: MUI-01..05 never appear in a SUMMARY (closed by 59-VERIFICATION + live UAT); 59-UAT row 11 corrected by the audit.
- **Phase 60** — WR-02: three pointer→frame projections omit the 6px content gutter (pre-existing origin bias 6/pitch). WR-05/WR-06: rail-edit cursor-seat and roto capture settle warnings on post-phase quick surfaces (unrelated to zoom). IN-01..IN-10: playhead/ruler half-cell divergence, ruler overhang, stale port doc comment, dead helper exports, settle-tail catch scope, residual ink-mean band, and the two new pins asserting wiring rather than failing on WR-05/WR-06. ROADMAP SC2/SC5 still say "Fit" and "session-only"; REQUIREMENTS.md (100%-reset, per-layer memory) is authoritative.
- **Phase 61** — CR-01: an unchanged per-vertex colour commit publishes a false refusal banner (no equality guard before the commit call). WR-01: the paint-control seam is fire-and-forget, so refused selection edits silently diverge the live control. WR-02: the orphan-focus window key route can dispatch Studio shortcuts when focus is on body. WR-03: `addKey` claims the in-flight latch after the blank-build await (double-run window). WR-04: curve-mode failure branch discards the restore result behind "restored" copy. Plus displaced prior findings and the three approved overrides.
- **Phase 62** — WR-02: conversion discards recorded stylus tilt (`tx/ty`), accepted for v1 (fixed-rotation anisotropic brushes change dab azimuth). WR-03: commit does not re-read the three busy gates after the durable-base await; accepted for v1, still fail-closed. WR-04: if both cancelled-bake undo replays are refused, undo returns false silently; accepted for v1, fallback restore + refusal copy deferred. IN-01..IN-03: unreachable `Eraser-Vector` label, `anchorWidthTarget` guard missing on the Vertex colour reading, and the `requestAquarellePathEdit` doc/implementation mismatch on selection-before-async-refusal.

### Integration warnings (non-blocking)

1. The canvas painted entrance writes the stroke selection before the async entrance can refuse (`AquarelleStrokeOverlay.tsx:52-56` vs `vectorPathLatches.ts:131-137`) — selection-only; no data loss.
2. Studio redo lacks the in-flight-bake cancel/settle guard undo has (`PhysicsPaintStudio.tsx:6393-6401` vs `6366-6392`) — fails closed at the revision authority, but unpinned.

### Deferred capability (explicitly out of v2.1.0)

- **Motion:** fit-to-span repeat; Split X/Y Position toggle; on-canvas spatial motion-path editing; cross-rail Motion key copy/paste; per-key Bézier handles / full graph editor; Skew/3D/perspective channels; multiple simultaneously expanded motion blocks; motion blur on rail motion; user-placeable pivot.
- **Zoom:** preset dropdown from the percent label; editable percent input; live Fit mode; ruler sub-ticks at high zoom; keyboard zoom shortcuts; VIS-02 30-vs-31 row-height drift (must remain its own pinned change).
- **Vector:** closed paths and filled shapes; full curve-family menu; on-canvas width handles; pressure-seeded widths at draw time; interpolation wiggle on vector strokes.
- **Curve editing:** fit at paint time / anchors-at-birth; pre-fit background cache; least-squares `fit-curve`; materialized occurrence copies or per-occurrence edits; multi-stroke curve editing; editing Lift/eraser strokes; a separate persisted pre-conversion pressure baseline.
- **Milestone backlog carried forward:** Studio API/MCP (v2.3.0, Phase 65); brush tips and Medium engine (v2.2.0, Phases 63–64).

### Deferred debt inherited from earlier milestones

The full list lives in `PROJECT.md` §Known technical debt (VIS-02 token drift, dead `efx-spectral` path, dual paper fingerprint, orphan package files, WINDOWS ledger recount, pre-existing test/typecheck items). None of it blocks v2.1.0.

---

## 7. Getting Started

**Prerequisites:** macOS (Apple Silicon is the shipping target), Node 24.x, pnpm, Rust toolchain.

**Run the app** (the project owner runs the dev server in this repo; agents should not):

```bash
pnpm install
pnpm tauri dev          # full Tauri app (Rust + Vite)
pnpm dev                # Vite front-end only
```

**Test and verify** (never run Vitest in watch mode):

```bash
pnpm --filter efx-motion-editor exec vitest run     # full app suite (~9,221 tests at Phase 62 close)
pnpm --filter efx-motion-editor run typecheck       # tsc --noEmit
pnpm --filter efx-motion-editor exec vitest run <path>  # one file
cargo test --manifest-path app/src-tauri/Cargo.toml # Rust suites
```

Watercolor package tests run through the same Vitest workspace (15 files / 306 tests at Phase 62 close).

**Key directories**

- `app/src/components/physic-paint/` — the Studio: `PhysicsPaintStudio.tsx` (composition and the one path-edit commit seam), `view/` (timeline, tool rail, dialogs, zoom, wireframe, vector handles), `roto/` (physical model, resolver, rail motion, script base/replay/rebake), `engine/` (overlays), `hooks/`, `performance/` (codecs).
- `app/src/efx-paint/` — the v1.0 paint document and compositor (`document/`, `compositor/`).
- `packages/efx-paint-host/` — engine-agnostic Studio script law (`StudioStroke<P>`, `EngineAdapter<P>`).
- `packages/efx-watercolor/` — the shipping engine (`Engine.ts`, `bake/`, `payload/`, `vector/`).
- `app/src-tauri/src/services/script_library.rs` — the Rust canonical mirrors (loop clips, rail motions, physical hash).
- `.planning/phases/59-…` through `62-…` — plans, summaries, verification, UAT, research, reviews.
- `SPECS/v2.1.0-motion-channels/` — the milestone model and v7 UI contract.

**Where to look first**

1. `docs` / `README.md` for the product surface and screenshots.
2. `SPECS/v2.1.0-motion-channels/README.md` for the v7 lane geometry and toggle state machine.
3. `app/src/components/physic-paint/roto/railMotionModel.ts` → `railMotionEvaluator.ts` → `railMotionIdentity.ts` for the Phase 59 mental model.
4. `app/src/components/physic-paint/view/physicsPaintTimelineZoom.ts` for the single pitch authority (Phase 60).
5. `packages/efx-watercolor/src/vector/spine.ts` + `app/src/components/physic-paint/view/vectorPathHandles.ts` for vector geometry (Phase 61).
6. `app/src/components/physic-paint/view/vectorPathFit.ts` + `aquarelleVectorPathCommit.ts` for the conversion and re-bake (Phase 62).
7. `app/src/components/physic-paint/roto/aquarelleScriptBaseAuthority.ts` and `aquarelleScriptReplay.ts` before touching any script edit — the fail-closed base and the undo/redo order are the safety rails.

**Conventions that will bite if ignored**

- Preact + `@preact/signals`, not React. No `useState`; compare-then-write setters; narrow signal reads; never write signals in a render body. Read the `efx-preact-reactivity` skill before touching components.
- Every new `.mce` field must be declared in **both** TS and Rust and pinned; serde silently drops undeclared keys.
- Strokes persist as opaque AQTL binary: a new field needs the codec, both declarations, and a round-trip pin.
- One ledger entry per completed gesture; the ledger snapshot is the only rollback source.
- Session-only view state (zoom, wireframe, selection) never enters the document, revision, or cache key.
- Use `bd` for task tracking, not markdown TODO lists; GSD artifacts and commits follow the lifecycle in `.claude/gsd-core/`.

---

## Stats

- **Timeline:** 2026-11-06 → 2026-11-14 (9 days)
- **Phases:** 4 / 4 complete · **Plans:** 67 / 67
- **Commits:** 796 (single author: Laurent Marques)
- **Files changed:** 1,175 files, +345,353 / −17,866 (includes `.planning/` and generated artifacts)
  - **Code only** (`app/` + `packages/`): 271 files, +75,740 / −3,016
- **Tests at close:** app 438 files / 9,221 tests (1 skipped, 96 todo) + watercolor 15 files / 306 tests; `pnpm typecheck` and `cargo check` pass
- **Verification:** 21 + 20 + 19 + 49 = 109 must-haves passed; all four VALIDATION.md Nyquist COMPLIANT
- **Live UAT:** 15 + 5 + 21 (5 issues resolved) + 10 = 51 rows, all approved or resolved
- **Release state:** version 2.1.0 in `app/package.json` and `app/src-tauri/Cargo.toml`; `v2.1.0-beta1` and `v2.1.0-beta2` tagged; final `v2.1.0` tag and publish pending (user action)

---

*Generated from `.planning/PROJECT.md`, `ROADMAP.md`, `REQUIREMENTS.md`, the four phase `CONTEXT.md` / `VERIFICATION.md` / `UAT.md` / `REVIEW-DISPOSITION.md` sets, and `v2.1.0-MILESTONE-AUDIT.md`.*
