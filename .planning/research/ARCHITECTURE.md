# Architecture Research — v2.1.0 Rail Motion Channels

**Domain:** Adding per-rail motion animation, timeline horizontal zoom, a vector painting layer, and painted-stroke curve editing to a shipped Tauri 2 + Preact 11 paint workstation
**Researched:** 2026-11-06
**Confidence:** HIGH on every integration seam (each claim cites live code); MEDIUM on the deferred bare-Key-Rail follow-up (Gate B, `SPECS/v2.1.0-motion-channels/CONTEXT.md` §3.6)

This document assumes the shipped architecture as fact: Tauri 2 + Preact 11 + `@preact/signals`; paint side under `app/src/components/physic-paint/`; durable model in `roto/physicsPaintRotoPhysicalModel.ts`; loop clips carry `loopId` / `placementStart` / `sourceKeyIds` / `repeat` / `mode` / `railKind`; bare Key Rails are derived (`deriveKeyRailSegments` in `view/physicsPaintKeyRailPresentation.ts`, identity `firstKeyId` only); the Studio strip is `view/PhysicsPaintWorkflowStrip.tsx` with `ROTO_CELL_WIDTH_PX = 18`; the compositor flattens one raster per track per frame; `.mce` persistence is dual-language (TS interface AND Rust struct, pinned by `app/src/lib/mceFieldContract.test.ts`).

---

## 0. Verdicts

| # | Question | Verdict | Minimal durable identity |
|---|---|---|---|
| A | Where does rail motion live? | Extend `PhysicPaintRotoLoopClip` with an optional **`railMotion`** field (field name deliberately NOT `motion` — that name belongs to `PhysicPaintRotoScriptMotionSettings`) | `loopId` (already stable) |
| B | How does timeline zoom enter? | One session-only metrics module in `view/` that every pitch consumer reads; no context provider, no CSS scale transform | none (session-only, not persisted) |
| C | Where does vector painting live? | A **`vector`** sub-document on `InternalPaintTrack`, sibling of `rotoPhysical`; v1 forbids both non-null; renderer feeds the existing per-track raster memo | `keyId` per vector key (same identity idea as roto keys) |
| D | Can curve editing reuse Bézier tooling? | Yes — reuse `app/src/lib/bezierPath.ts` math and the `PaintOverlay` interaction model; durable authority stays `AquarellePoint[]`, chains stay in the existing edit ledger | none (derived anchors, resampled on commit) |

**The one architectural rule that drives all four verdicts:** the compositor's law is one flattened raster per track per frame, and the persistence law is dual-language conditional encoding. Anything that changes what a frame looks like without moving key bytes must (i) join the canonical revision and (ii) be applied at composite time. Motion is the first rail property with that profile, which is why it is the most delicate of the four.

---

## 1. System Overview (target state)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Studio surface (Preact)                                                     │
│                                                                              │
│  PhysicsPaintWorkflowStrip.tsx   ← motion channel lanes, zoom metrics        │
│    ├─ track header column (185px) ← live motion toggle + channel headers     │
│    ├─ key rail / loop rail / reveal rail                                 │
│    ├─ TimelineMotionChannels (NEW) ← pure projection of railMotion            │
│    └─ ruler, sound stains, playhead, ghosts                                   │
│                                                                              │
│  stores/physicPaintStore.ts                                                   │
│    ├─ _resolveRotoPhysicalStructural  (revision + decode)                    │
│    ├─ _trackContentRevision           (structural.contentRevision)           │
│    ├─ _preResolveTrackContent         (roto branch | legacy branch  [+ vector])│
│    └─ _resolveFlattenedFrame          (content revs, flattened key, memo,     │
│                                        ports, compositeFrame)  [+ transforms] │
├──────────────────────────────────────────────────────────────────────────────┤
│  efx-paint/compositor (pure, port-driven)                                    │
│    compositeFrame() → per track: resolveTrackContent(frame)                  │
│                       → apply transform (NEW) → ctx.drawImage(raster)        │
│    → one flattened canvas                                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│  Durable model (TS)                      Durable model (Rust mirror)         │
│    physicsPaintRotoPhysicalModel.ts  ↔  src-tauri/src/services/script_library│
│    buildPhysicPaintRotoPhysicalRevision   canonical_physical_hash            │
│    encodeCanonicalLoopClips (1610)        canonical_loop_clips (~1382)       │
│    (layer JSON, not models/project.rs — mceFieldContract does NOT apply)     │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|---|---|---|
| `roto/physicsPaintRotoPhysicalModel.ts` | Durable roto model, strict parser, canonical encoders, revision hash | `efxPaintDocumentRevision.ts`, `physicPaintStore.ts`, Rust mirror |
| `src-tauri/src/services/script_library.rs` | Handwritten Rust mirror of the canonical encoding | TS encoders (byte parity is the contract) |
| `efx-paint/document/efxPaintDocumentRevision.ts` | Track/collection revision terms (`frames:`, `loops:`, `roto:`) | store, flattened cache key |
| `efx-paint/document/efxPaintDocumentParsers.ts` | Fail-closed allowlist parsing (`TRACK_KEYS`, line 69) | document load/save |
| `efx-paint/compositor/efxPaintCompositor.ts` | Pure per-frame flatten; per-track raster memo; background transform | store ports |
| `efx-paint/compositor/efxPaintCompositeCache.ts` | Flattened cache key (config/tracks/bg/bgtransform/…) | store |
| `stores/physicPaintStore.ts` | Structural resolution, content revisions, flattened frame assembly | everything above + UI |
| `view/PhysicsPaintWorkflowStrip.tsx` | Timeline chrome, lanes, gestures, ruler, stains, playhead | store, rails, header column |
| `view/physicsPaintTrackHeaderColumn.tsx` | Pinned header rows (30px track rows) | strip |
| `view/timelineRailDesign.ts` | Single source of lane geometry (pitch/cell/curve/outline) | rails, strip |
| `view/physicsPaintCanvasZoom.ts` | Precedent: session-only zoom signals + anchoring helpers | canvas view |

---

## 2. Question A — Rail motion persistence and render

### 2.1 Recommendation

Extend the existing loop clip. Add one optional field to `PhysicPaintRotoLoopClip` (`physicsPaintRotoPhysicalModel.ts:305-362`):

```ts
// New types, placed beside PhysicPaintRotoScriptMotionSettings (NOT reusing it)
export interface TimelineRailMotionKey {
  /** Rail-local frame (0 = rail start). Never an app frame. */
  readonly frame: number;
  readonly value: number;
}

export interface TimelineRailMotionChannel {
  readonly id: 'position-x' | 'position-y' | 'scale' | 'rotation' | 'opacity';
  readonly keys: readonly TimelineRailMotionKey[];
}

export interface TimelineRailMotion {
  readonly channels: readonly TimelineRailMotionChannel[];
  /** How rail-local time maps onto the occurrence: hold or fit-to-span. */
  readonly repeat: 'hold' | 'fit';
}

// On PhysicPaintRotoLoopClip:
readonly railMotion?: TimelineRailMotion;
```

Why the clip and not a new record collection:

- The clip already *is* the rail's durable identity (`loopId`) and already owns placement (`placementStart`), duration (`sourceKeyIds.length × repeat`) and type (`railKind`). A motion record would have to duplicate all four and then answer "what happens when the clip moves / repeats / is deleted" — questions the clip answers for free.
- A motion record separated from the clip would need a foreign key with the same lifetime as the clip. That is a 1:1 relationship expressed as two collections; there is no second consumer.
- A new top-level `.mce` collection would also break the current layering: roto lives *inside* `layers/<layerId>.json` (`preparePackageLayer`, `app/src/lib/efxPaintPersistence.ts:544`, `layerFile: buildLayerFileRelativePath(layerId)` at 582), not in `models/project.rs`. New collections inflate the dual-language surface (`mceFieldContract.test.ts`) for no gain.

**Rejected alternatives**

| Alternative | Why rejected |
|---|---|
| Auto-adopt a bare Key Rail into a Loop Clip (repeat 1) on first Motion key | Hidden document mutation on a user gesture; silently changes rail type; collides with the explicit rail-edit prompt contract; merges two rail kinds into one, breaking the design's distinct chrome |
| Separate motion collection keyed by `loopId` | Duplicate identity, duplicate lifecycle rules, extra dual-language struct, extra orphan handling |
| Store motion on the drawing key | Contradicts v3: Motion keys are independent of drawing keys; a rail with no drawing key must animate (`CONTEXT.md` §3) |
| Reuse `PhysicPaintRotoScriptMotionSettings` | It is script deformation/position jitter (`physicsPaintRotoPhysicalModel.ts:237-247`) applied during *bake*; rail motion is applied at *composite*. Different evaluation point, different lifetime, different semantics |

### 2.2 Minimal durable identity and its invariants

**Identity = `loopId`.** Motion is a property of the loop clip. No second identity, no cross-record reference.

| # | Invariant | Why it matters |
|---|---|---|
| I1 | `railMotion` is optional; absent means "no motion" and encodes zero bytes | Every existing `.mce` stays byte-identical; no migration (`feedback_no_backward_compat` is satisfied by no format change) |
| I2 | Motion keys are rail-local frames; they are never rewritten when `placementStart` moves | Move/repeat must not require touching motion (v3: motion is in rail-local time) |
| I3 | Motion never enters content resolution and never touches key bytes | Motion re-evaluates per frame at composite; no re-bake, no source-key reads |
| I4 | Motion is written only when non-empty, exactly like `colorize`, `photoWiggle`, `keyScriptEdits`, `paintSeedVariation` | Conditional-term idiom keeps absent-case output byte-identical |
| I5 | Motion **must** join the physical revision | Unlike the re-bake-only flags, motion changes rendering without changing key bytes — if it is not in the hash, two different documents hash the same |
| I6 | Split does not split motion; merge never unions motion | Splitting a rail duplicates the clip: copy `railMotion` verbatim to both halves. Merge (if ever added) keeps the target's motion, discards the source's — document it |
| I7 | Deleting the clip deletes its motion; deleting source keys does not | Single owner. Dangling `sourceKeyIds` already legal; motion keeps animating |
| I8 | `railMotion` never changes `placementStart`, `repeat`, `sourceKeyIds`, `mode`, `railKind` | Motion is a view-time transform, not a structural rail edit |
| I9 | Channel order and key order in the encoding are canonical (fixed channel id list, keys sorted by frame) | TS and Rust must produce identical bytes |

### 2.3 Lifecycle truth table

| Event | Motion outcome |
|---|---|
| Rail moved (drag) | Unchanged — rail-local frames |
| Rail repeated (repeat N > 1) | Unchanged — per-occurrence evaluation uses rail-local time |
| Source key deleted | Clip survives; motion survives; cycle length shrinks |
| Source key added | Same |
| Rail split | Motion copied verbatim to both halves (I6) |
| Rail deleted | `railMotion` deleted with the clip |
| Track hidden / soloed | No change; the transform is applied inside the per-track draw, so visibility rules are untouched |
| Copy/paste of a rail | If rail copy exists today, copy `railMotion` with the clip |
| Undo | Whatever the existing snapshot mechanism does with the clip — `railMotion` is part of the record, so it rides along with no new ledger |
| Export | Evaluated per frame at composite; nothing baked into keys |

### 2.4 Dual-language obligations (the `.mce` law)

The physical roto blob is persisted inside the layer JSON, so `mceFieldContract.test.ts` (which pins `models/project.rs` against `types/project.ts` / `types/audio.ts`) is **not** the gate. The gate is the TS strict parser plus byte parity between the TS and Rust canonical encoders.

| Layer | Function | Change |
|---|---|---|
| TS type guard | `isPhysicPaintRotoLoopClip` (`:861`) | Accept and validate `railMotion` (channel ids in the fixed list, finite numbers, frames finite, repeat in `hold \| fit`) |
| TS parser | `parsePhysicPaintRotoLoopClips` (`:1140-1209`) | Frozen verbatim copy of the optional fields — add `railMotion` copying so parse→encode round-trips |
| TS canonical encoder | `encodeCanonicalLoopClips` (`:1610-1675`) | Add a **conditional** `railmotion:` block at the identical ordinal in the record (after the existing optional blocks). Emit only when present |
| TS content encoder | `encodePhysicPaintRotoPhysicalContent` (`:1478-1575`) | No change — loops term already flows through |
| TS revision | `buildPhysicPaintRotoPhysicalRevision` (`:1460`) | No change — it hashes the encoded content, so `railmotion:` rotates it automatically |
| Rust mirror | `canonical_loop_clips` (`script_library.rs` ≈ `:1382`) | Add the same conditional block at the **same ordinal**, same number formatting |
| Rust hash | `canonical_physical_hash` (`:1550`) | No structural change — the loops term is hashed as-is. If motion is emitted inside the loop record, it joins the hash automatically |

Two traps:

1. **Ordinal parity.** `canonical_loop_clips` is handwritten; the existing comment in `encodeCanonicalLoopClips` already records that adding a term forces an identical-ordinal Rust mirror. Put `railmotion` after the last existing optional block in both languages and add a parity fixture (encode in TS, hash, compare against a Rust-produced fixture) to the existing canonical tests.
2. **Do not copy the re-bake exclusion.** The comment near `encodeCanonicalLoopClips` explains that `photoWiggle`, `keyScriptEdits`, `paintSeedVariation` are deliberately excluded because every write re-bakes key bytes. Motion has no such re-bake, so it must be **inside** the encoded record, not excluded from the hash.

### 2.5 Revision and cache wiring

No new plumbing is needed for persistence or flattened invalidation:

- `encodeValidatedEfxPaintTrackContent` (`efxPaintDocumentRevision.ts:60-122`) emits `roto:<buildPhysicPaintRotoPhysicalRevision(...)>`. Motion in the physical revision rotates the document revision, so save fingerprints and cache keys follow.
- `deriveEfxPaintFlattenedCacheKey` (`efxPaintCompositeCache.ts:125-204`) already includes the `frame` term and the per-track content revisions. A per-frame transform is therefore already inside the key space; **do not add a transform term** — it would be redundant and would churn the key on every frame for no reason.
- `deriveEfxPaintTrackContentKey(trackId, contentRevision, frame)` keeps the per-track raster memo content-keyed, so motion does **not** invalidate rasters. This is exactly the "1 raster per track per frame; content cycles, motion continues" law.

### 2.6 Compositor integration

`compositeFrame(document, frame, size, ports)` (`efxPaintCompositor.ts:243`) draws per participating track at 313-351. Two changes:

1. **Add a `trackTransforms` port** (a map `trackId → TimelineTrackTransform | null`, resolved in the store before the call). Prefer a precomputed map over a `resolveTrackTransform` callback: the compositor stays pure and the store already has the loop ranges resolved.
2. **Apply the transform at both draw sites**:
   - normal path: before `ctx.drawImage(resolution.raster, 0, 0, size.width, size.height)` (`:349`);
   - `engineOverlay` path (`:313-322`) — otherwise an overlay track silently ignores motion.

Semantics:

```ts
interface TimelineTrackTransform {
  readonly translateX: number;   // canvas px, already scaled by scale
  readonly translateY: number;
  readonly scale: number;        // default 1
  readonly rotation: number;     // radians
  readonly opacity: number;      // 0..1, multiplied into globalAlpha
}
```

- **Anchor = composite canvas centre**, not the content bounding box. The content bbox changes as the cycle advances (that is the whole point of cycling content under constant motion); anchoring to it would make a perfect loop wobble. Centre-anchored is deterministic and cheap.
- `ctx.globalAlpha = track.opacity × transform.opacity`, restored after draw.
- **Identity fast path:** when the map has no entry, draw exactly as today (no `save`/`restore`), preserving v2.0.1 output bit-for-bit.
- Precedent to copy verbatim: the background transform at 397-423 (contain-fit × clip scale, then translate to centre + `x`/`y`, rotate degrees→radians, scale, `drawImage`).

Everything else stays: `participatingPaintTracks` (`efxPaintHideSolo.ts`, kind-agnostic), `trackRasterMemo`, background, exclusion/solo, fond resolution.

### 2.7 Timeline (UI) integration

The motion lane is a **pure projection** of the durable model. New module `view/TimelineMotionChannels.tsx` plus a store selector that returns `TimelineMotionRailModel` (contract already written in `SPECS/v2.1.0-motion-channels/README.md`).

- Channel curves: 1.5 px cubic paths, viewBox `0 0 railWidth 18`. The model/selector supplies the path (README §6.3: the view must not invent interpolation maths). A pure `buildChannelCurvePath(channel, railWidth)` belongs beside the evaluator so the *same* easing function feeds the curve and the render.
- Expansion belongs to the **selected rail** (design default, one open block per timeline). State lives in the selection/view model, never on the track record.
- Row rhythm: expanded block = 30 px rail row (shipped strip uses 31 px; see §2.8) + 18 px per channel + 2 px post-block gap, mirrored in the header column.
- The reorder insertion indicator currently uses `index × 30px`; with expanded blocks the offsets are non-uniform. Switch to measured row offsets (`getBoundingClientRect` once per drag start, or a computed offsets array) — never arithmetic that can land inside a channel block.
- Nav cluster actions (`previous` / `next` / `diamond`) route through store actions that manipulate `railMotion`; if an action is missing, render disabled with a real reason — never a silent no-op (README §4).

### 2.8 New vs modified (Question A)

| Kind | Item |
|---|---|
| NEW | `TimelineRailMotion`, `TimelineRailMotionKey`, `TimelineRailMotionChannel` types (`physicsPaintRotoPhysicalModel.ts`) |
| NEW | `roto/timelineRailMotion.ts` — `evalRailMotionChannel`, `evalRailMotionAt`, `buildChannelCurvePath` (pure, shared UI/render) |
| NEW | `view/TimelineMotionChannels.tsx` (+ CSS in `physicsPaintStudio.css`) |
| NEW | Store selector projecting `TimelineMotionRailModel`; motion mutation actions |
| NEW | `trackTransforms` port + `TimelineTrackTransform` type on the compositor ports |
| MODIFIED | `PhysicsPaintRotoLoopClip`, `isPhysicPaintRotoLoopClip`, `parsePhysicPaintRotoLoopClips`, `encodeCanonicalLoopClips` (TS) |
| MODIFIED | `canonical_loop_clips` (Rust), parity fixture |
| MODIFIED | `efxPaintCompositor.ts` draw sites (normal + engineOverlay) |
| MODIFIED | `physicPaintStore.ts`: `_resolveFlattenedFrame` (transforms), `_trackContentRevision` unchanged, new action |
| MODIFIED | `PhysicsPaintWorkflowStrip.tsx`, `physicsPaintTrackHeaderColumn.tsx`, `PhysicsPaintTrackRow.tsx` (toggle) |
| UNTOUCHED | `mceFieldContract.test.ts`, `models/project.rs`, `.mce` top level |

---

## 3. Question B — Timeline horizontal zoom

### 3.1 Recommendation

One **session-only metrics module** `view/physicsPaintTimelineZoom.ts`, modeled directly on `view/physicsPaintCanvasZoom.ts` (module-level `@preact/signals`, presets, `clampZoomScale`, `resetForStudioOpen`, compare-then-write setters). It exports:

```ts
interface TimelineMetrics {
  readonly scale: number;        // 0.25 .. 4
  readonly cellWidth: number;    // 16 × scale
  readonly cellGap: number;      // 2 × scale
  readonly pitch: number;        // 18 × scale  (cellWidth + cellGap)
  readonly rulerTickWidth: number; // 3 × pitch
}
```

plus pure helpers: `clampTimelineZoomScale`, `nextTimelineZoomPreset`, `frameToPx(frame, metrics)`, `pxToFrame(px, metrics)`, `resolveAnchoredScrollLeft(...)`, and `timelineMetrics()`.

Everything that maps frames to pixels reads `pitch` (or `cellWidth`) from this one object. Presets `[0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]`, min `0.25`, max `4` (`CONTEXT.md` §5.6).

**Why not a Preact context:** the consumers include module-level components (`soundStain*` at `PhysicsPaintWorkflowStrip.tsx:2296-2400`) and CSS-driven sizes; a context would force those through props or hooks they do not have. **Why not a CSS `transform: scale`:** it double-scales client-rect math used by every drag/scrub handler — the canvas zoom module already records this exact prohibition. **CSS custom properties** are used only for values CSS itself renders: `--roto-cell-width`, `--roto-cell-gap`, `--roto-ruler-tick`.

### 3.2 The duplication that must be fixed first

Zoom cannot be correct while pitch is defined in more than one place. Today:

| Source | Value | File |
|---|---|---|
| `ROTO_CELL_WIDTH_PX = 18` | 18 | `PhysicsPaintWorkflowStrip.tsx:601-623` |
| `ROW_CELL_WIDTH_PX = 18` | 18 | `PhysicsPaintTrackRow.tsx:64` |
| hard-coded `18` in loop geometry | 18 | `PhysicsPaintTrackRow.tsx:398` |
| `.physics-paint-roto-cell { width: 16px }` | 16 | `physicsPaintStudio.css` (~4999) |
| `.physics-paint-ruler-tick { flex: 0 0 54px }` | 54 | `physicsPaintStudio.css` (~5025, pre-inline-override) |
| `TIMELINE_GEOMETRY.cellPitch = 18`, `cellWidth = 16`, `cellGap = 2`, `cellHeight = 22` | design | `timelineRailDesign.ts:97-113` |

The new module becomes the single source; the constants become derived getters or are deleted. `timelineRailDesign.ts` keeps the *design* geometry (heights, radii, outline) and takes pitch as a parameter (as `projectTimelineRailLineWidth(frameCount, pitch, endVisible, gap)` at 251-259 already does).

### 3.3 What scales and what stays fixed

| Scales with zoom | Stays fixed |
|---|---|
| cell width (16 → 16×scale) | row height (31 shipped; design 30) |
| gap (2 → 2×scale) | cell height (22), lane height (18) |
| pitch (18 → 18×scale) | header column width (185 px) |
| ruler tick width (3×pitch) | 6 px gutter left of the lanes |
| every `frame → px` mapping | strip chrome 132 px, max height 270 px |
| drag/scrub deltas (÷ pitch) | `RULER_STEP = 3` frames |
| rail line widths (`frameCount × pitch − gap`) | outline radius/stroke (1.5 px / 4 px) |

`frameCount × pitch − gap` is unchanged as a *rule*; both terms scale, so the visual result is a uniform scale.

### 3.4 Call-site inventory (all must read the metrics module)

| Group | Sites |
|---|---|
| Lane width | `PhysicsPaintWorkflowStrip.tsx:2716` |
| Grid / cells | `:5290`; `PhysicsPaintTrackRow.tsx:699` |
| Ruler | `:5774-5840`, inline tick `flex: 0 0 ${RULER_TICK_WIDTH_PX}px` at `:5818` |
| Rails `framePitch` | `:5228`, `:5260`; props into `PhysicsPaintKeyRail.tsx` / `PhysicsPaintLoopClipRail.tsx` (`Math.round(dx / framePitch)`) |
| Ruler scrub | `usePhysicsPaintRulerScrub.ts` (`cellWidthPx` option already exists) |
| Sound stains | `:2296-2400`; `soundBandGeometry.ts:91,96` (already pitch-parameterized) |
| Visibility window | `:2520-2521` (`scrollLeft / ROTO_CELL_WIDTH_PX`) |
| Drag deltas | `:3226`, `:3373`, `:3866` |
| Ghosts | `:3601-3700`, `:5130-5131`, `:5517-5611` |
| Scroll-to-frame | `:4581-4606` |
| Playhead origin | strip playhead block (follows the 6 px gutter) |
| Rail line width | `timelineRailDesign.ts:251-259` (pass scaled gap) |
| Scroll container padding | `.physics-paint-timeline-scroll` 6 px + scroll-snap (~4952-4975) |

### 3.5 Anchoring rules

- **Cmd/Ctrl + wheel:** keep the frame under the cursor fixed.
  `frameAtCursor = (scrollLeft + cursorX − laneOrigin) / oldPitch`; then `newScrollLeft = frameAtCursor × newPitch + laneOrigin − cursorX`.
  `resolveCursorAnchoredPan` in `physicsPaintCanvasZoom.ts` is the analogous helper.
- **Pill minus/plus and Fit:** keep the playhead frame visible at the same screen position (fallback: viewport centre).
- Compare-then-write signal setters (canvas zoom precedent) so a no-op wheel does not re-render.
- **Session-only:** reset on Studio close/open; no `.mce`, no schema, no revision, no export change (`CONTEXT.md` §5.6).

### 3.6 Header-column lockstep

The header column is a fixed 185 px column with 30/31 px rows; it has no horizontal cells. What must stay in lockstep is the **row flow**: the channel header rows added in §2.7 must use the same 18 px and 2 px post-block gap as the lanes. Zoom does not change vertical geometry, so lockstep is preserved *if* both sides read the same row-height constants — introduce a single `TIMELINE_ROW` constants module or have the header column import from `timelineRailDesign.ts` rather than re-declaring `30`.

### 3.7 New vs modified (Question B)

| Kind | Item |
|---|---|
| NEW | `view/physicsPaintTimelineZoom.ts` (metrics, presets, helpers, signals, reset) |
| NEW | Zoom pill UI in the strip chrome (minus / percent / plus / Fit) |
| MODIFIED | `PhysicsPaintWorkflowStrip.tsx` (all pitch sites), `PhysicsPaintTrackRow.tsx`, `physicsPaintTrackHeaderColumn.tsx`, `physicsPaintStudio.css`, `timelineRailDesign.ts` (accept pitch), `PhysicsPaintKeyRail.tsx` / `PhysicsPaintLoopClipRail.tsx` (already prop-driven)` |
| UNTOUCHED | document schema, revisions, cache keys, compositor |

---

## 4. Question C — Vector painting layer

### 4.1 Recommendation

Add a **track-kind slot** rather than a second rendering pipeline:

```ts
// app/src/efx-paint/document/efxPaintDocument.ts
export interface EfxPaintVectorVertex {
  readonly x: number; readonly y: number;          // app canvas coordinates
  readonly pressure: number;                        // 0..1
  readonly inHandle?: { x: number; y: number };     // relative, cubic
  readonly outHandle?: { x: number; y: number };
}

export interface EfxPaintVectorPath {
  readonly id: string;
  readonly interpolation: 'bezier';
  readonly closed: boolean;
  readonly vertices: readonly EfxPaintVectorVertex[];
  readonly style: { color: string; size: number; tool: string; seed: number };
}

export interface EfxPaintVectorKey {
  readonly keyId: string;
  readonly frame: number;                           // app frame, like roto real keys
  readonly paths: readonly EfxPaintVectorPath[];
}

export interface EfxPaintVectorDocument {
  readonly schemaVersion: 1;
  readonly keys: readonly EfxPaintVectorKey[];
}

// InternalPaintTrack gains:
readonly vector?: EfxPaintVectorDocument | null;
```

**v1 rule: `rotoPhysical` and `vector` are mutually exclusive on one track** (both non-null = fail-closed parse error). This keeps `_preResolveTrackContent` a two-way dispatch, keeps the reveal/loop machinery out of scope, and avoids inventing a compositing order between two content models on one rail.

### 4.2 Why it coexists with the raster frame model

- **Durable only real keys.** Generated frames are never persisted (`deriveVectorFrame` is a pure function of `(keys, frame, interpolationMode)`). This mirrors the roto model, where generated bytes are runtime caches — except vector needs no byte cache at all.
- **The renderer produces a canvas, not a cache.** `_preResolveTrackContent` (`physicPaintStore.ts:1868-1912`) currently branches `roto` → then legacy `getFrame`. Insert a `vector` branch **before** roto: rasterize `deriveVectorFrame(...)` into a canvas sized to the composite. The per-track memo (`trackRasterMemo`, keyed by `deriveEfxPaintTrackContentKey`) absorbs per-frame work; nothing durable is written.
- **No image caches** is a scope gate, not an optimization preference (`CONTEXT.md` §5.3 gate 7: "real object animation in the canvas, not image caches").
- **Compositor untouched.** It still receives "one raster per track per frame" through `resolveTrackContent`; it neither knows nor cares that the raster came from a vector sampler. This is the strongest reason for the slot-over-pipeline design: it inherits hide/solo, opacity, blend mode, ordering, background and export for free.
- **Script replay law.** The per-stroke script replay law applies to raster engines (`toStudioStroke` → engine bake). Vector strokes are already the durable drawing; replay would be a no-op. Do not route vector through `AquarelleScriptSnapshot`.

### 4.3 Persistence

- Lives in `layers/<layerId>.json` as a track sub-object (same place as `rotoPhysical`); no media projection (no bytes).
- `TRACK_KEYS` (`efxPaintDocumentParsers.ts:69`) gains `'vector'`; `parseInternalPaintTrack` (`:238-295`) validates it fail-closed (finite numbers, unique `keyId`, `interpolation === 'bezier'`).
- `encodeValidatedEfxPaintTrackContent` (`efxPaintDocumentRevision.ts:60-122`) gains a conditional `vector:` term so revisions rotate on edits. Emit only when present so absent-case output is byte-identical.
- **No Rust struct, no `mceFieldContract.test.ts` change** — lawful because Rust never parses layer sub-files; `models/project.rs` has no layer-content struct. State this explicitly in the plan: the exemption is about *layer scope*, not about vector being special. If Rust ever validates layer content, this becomes a dual-language obligation overnight.
- Interpolation mode (hold / linear / smooth) follows the existing document-level interpolation model rather than a per-track control, unless the phase decides otherwise.

### 4.4 Rails and UI

- Reuse the key-rail presentation: a vector track's real keys feed `deriveKeyRailSegments` as the key source, one rail, identity `firstKeyId`. No new rail kind in v1.
- The paint surface gets a vector tool (pen/curve) that appends to the active key's `paths`; the `PaintOverlay` Bézier interaction (§5) is the natural base.
- Adding a vector track is an explicit action; never auto-convert a raster track.

### 4.5 New vs modified (Question C)

| Kind | Item |
|---|---|
| NEW | Vector types in `efxPaintDocument.ts`; `efx-paint/vector/deriveVectorFrame.ts` (pure sampler) and `renderVectorFrame.ts` (canvas rasterizer) |
| NEW | Vector tool UI in the paint surface |
| MODIFIED | `InternalPaintTrack`, `TRACK_KEYS`, `parseInternalPaintTrack`, `encodeValidatedEfxPaintTrackContent`, `_preResolveTrackContent` |
| UNTOUCHED | compositor, cache-key structure, `mceFieldContract.test.ts`, Rust |

---

## 5. Question D — Painted-stroke curve editing

### 5.1 Reuse map (what actually exists)

| Need | Reuse | Notes |
|---|---|---|
| Fit anchors from sampled points | `pointsToBezierAnchors` (`app/src/lib/bezierPath.ts:54`) | fit-curve based |
| Render / sample | `sampleBezierPath` (`:244`) | pure |
| Insert anchor on a segment | `insertAnchorOnSegment` (`:282`) | |
| Delete anchor | `deleteAnchor` (`:330`) | |
| Coupled handle drag | `updateCoupledHandle` (`:361`) | |
| Segment drag | `dragSegment` (`:404`) | |
| Hit testing | `findNearestSegment` (`:439`), `hitTestAnchor` (`:477`) | |
| Interaction model (overlay, zoom-compensated handles) | `app/src/components/canvas/PaintOverlay.tsx:440 drawBezierOverlay` | Copy the model, not the file |

**Do not cite `MotionPath.tsx` / `keyframeEngine` as the reuse source** — those use polynomial easing, not Bézier anchors/handles. Naming them in a plan sends the implementer to the wrong math.

### 5.2 Durable representation

The durable authority for a painted stroke stays `AquarellePoint[]` inside `AquarelleStroke` (`packages/efx-watercolor/src/payload/toStudioStroke.ts:112-123`; points carry `x, y, p, tx, ty, tw`). Bézier anchors are a **view/edit representation**: fit on entering curve mode, resample on commit. Every edit then flows through the existing ledger:

`captureAquarelleSnapshot` (`aquarelleStrokeSelection.ts:658`) → mutate points → `applySnapshotContent` (`:707`) / `storeAquarelleEdit` (`:721`, 10-entry cap) → undo via `restoreAquarelleEditSnapshot` (`:972`).

Model the curve edit on `beginAquarelleTransformEdit` (`:883`): capture once at gesture start, mutate in-memory during the drag, store one ledger entry per commit. Never one entry per pointermove.

### 5.3 Optional durable anchors — explicit decision required

Persisting anchors (e.g. `pathAnchors` on the stroke record) would avoid a fit/resample round trip but:

- the aquarelle stroke payload is validated by Rust (`script_library.rs:2323-2492`); unknown engine keys are tolerated but numeric `params` must be finite, so anchors must be a declared field, not stuffed into `engine.params`;
- it rotates the persisted script revision on every curve edit.

**Recommendation: do not persist anchors in v1.** Fit on mode entry, resample on commit, and measure the round-trip deviation in the phase's tests. If deviation is visibly unacceptable, add a declared sidecar with TS + Rust parity — and treat that as a scope change, not a detail.

### 5.4 New vs modified (Question D)

| Kind | Item |
|---|---|
| NEW | `view/useAquarelleCurveEditing.ts` (anchor state, hit test, gestures) and a `drawCurveEditOverlay` renderer modeled on `PaintOverlay` |
| NEW | `beginAquarelleCurveEdit` in `aquarelleStrokeSelection.ts` (snapshot-heavy, one ledger entry per commit) |
| MODIFIED | Curve-mode toggle in the paint toolbar; overlay stacking above `PaintOverlay` |
| UNTOUCHED | `bezierPath.ts` (reused as-is), stroke payload format, ledger semantics |

---

## 6. Architectural Patterns

### Pattern 1: Conditional canonical term (absent = byte-identical)

**What:** New durable fields are emitted only when present, at a fixed ordinal, in both the TS encoder and the Rust mirror.
**When:** Any new `.mce` field in the physical model, including `railMotion`.
**Trade-offs:** Keeps old files byte-stable and migration-free; costs an ordinal-parity discipline and a fixture test.
**Example:** `encodeCanonicalLoopClips` (`:1610-1675`) and the Rust `canonical_loop_clips` (~`:1382`) emitting `scriptId`, `syncState`, etc. conditionally.

### Pattern 2: Session-only view metrics module

**What:** A module-level signal store + pure helpers that owns a transient view parameter, with a reset hook.
**When:** Zoom, pan, overlays — anything the document must not know about.
**Trade-offs:** No persistence risk and no plumbing; the module must be imported by every consumer (a missed import is a silent bug), so add a lint/test that forbids literal `18` in the strip/row files.
**Example:** `view/physicsPaintCanvasZoom.ts` and the new `view/physicsPaintTimelineZoom.ts`.

### Pattern 3: Kind dispatch at content resolution

**What:** The store answers "what raster is this track at frame N" by branching on the track's content kind before the legacy byte path.
**When:** Adding a content model (vector) that must reuse compositing, hide/solo, and export.
**Trade-offs:** One more branch and a mutual-exclusion rule; in exchange the compositor stays untouched and no second pipeline is born.
**Example:** `_preResolveTrackContent` (`physicPaintStore.ts:1868-1912`) — `roto` branch today, `vector` branch before it.

### Pattern 4: Prepare-time geometry, composite-time transform

**What:** Key bytes and rasters are prepared per content revision; motion transforms are applied when drawing.
**When:** Any animation that must not disturb key content (motion channels).
**Trade-offs:** The per-track raster memo survives motion edits (cheap), but every frame redraws `drawImage` with a new matrix (correct and still O(tracks)).
**Example:** background transform (`efxPaintCompositor.ts:397-423`) + the new `trackTransforms`.

### Pattern 5: Derive-then-bake durable authority

**What:** An expressive edit representation (Bézier anchors) exists only during an edit; the durable form (points) is regenerated on commit through the existing snapshot ledger.
**When:** Curve editing painted strokes.
**Trade-offs:** Zero format change and full undo parity; the round trip must be measured.
**Example:** `beginAquarelleTransformEdit` (`:883`) → `storeAquarelleEdit` (`:721`).

---

## 7. Data Flow

### 7.1 Composite frame (target)

```
frame requested
  → _resolveFlattenedFrame (~physicPaintStore.ts:2938)
       participating tracks → track content revisions
       → deriveEfxPaintFlattenedCacheKey (frame + revisions + bgtransform…)
         hit → return
       → NEW: resolve trackTransforms (evaluate railMotion per track at frame,
              rail-local, then map to canvas transform)
       → per track: resolveTrackContent(frame)
            roto → cached/generated raster
            vector → NEW deriveVectorFrame + rasterize into canvas
            legacy bytes → getFrame
       → compositeFrame(... ports { …existing, trackTransforms })
            per track: save → translate(center + t) → rotate → scale →
                       globalAlpha = opacity × t.opacity → drawImage(raster) → restore
       → flattened canvas
```

### 7.2 Motion edit flow

```
UI nav cluster / lane gesture
  → store action: add/remove/move rail motion key (validated, rail-local frame)
  → new clip record with railMotion (immutable update)
  → replaceRotoPhysicalLoopClips (store :4718)
  → structural resolve → revision rotates (railmotion in the physical hash)
  → flattened cache invalidated; rasters untouched
  → UI projection re-derives TimelineMotionRailModel
```

### 7.3 Zoom flow

```
wheel / pill / Fit
  → clamp scale to [0.25, 4] (compare-then-write)
  → metrics recomputed (pitch, cellWidth, gap, ruler tick)
  → CSS custom properties updated (cell width, gap, tick)
  → scrollLeft recomputed to anchor cursor frame (wheel) or playhead (pill/Fit)
  → strip re-renders lanes/rails/grid from the same metrics
  → Studio close → reset
```

### 7.4 Curve edit flow

```
enter curve mode on a selected stroke → pointsToBezierAnchors(points)
pointer gesture → hitTestAnchor / findNearestSegment → mutate anchors in memory
commit → sampleBezierPath → rebuild points (pressure/handles mapped)
       → captureAquarelleSnapshot once at gesture start (or at commit)
       → storeAquarelleEdit (one entry) → stroke revision rotates
```

---

## 8. Modified Pipelines (impact summary)

| Pipeline | Files | Impact |
|---|---|---|
| Canonical encode / hash | `physicsPaintRotoPhysicalModel.ts`, `script_library.rs` | Motion term; parity fixture |
| Document revision | `efxPaintDocumentRevision.ts` | Motion free via `roto:`; vector needs its own conditional term |
| Strict parse | `efxPaintDocumentParsers.ts`, `parsePhysicPaintRotoLoopClips` | `railMotion`, `vector` allowlist + validation |
| Content resolution | `physicPaintStore.ts` `_preResolveTrackContent` | New vector branch |
| Flatten | `physicPaintStore.ts` `_resolveFlattenedFrame` | Track transforms resolved pre-composite |
| Composite | `efxPaintCompositor.ts` | Transform at both draw sites |
| Timeline UI | strip, header column, track row, rails, CSS | Motion lanes, zoom metrics, toggle |

---

## 9. Scaling Considerations

| Concern | Small (current docs) | Large (hundreds of keys, 20 tracks) | Mitigation |
|---|---|---|---|
| Motion evaluation | trivial | O(tracks × channels × keys) per frame | Cache evaluated transforms per (track, frame) inside the flattened pass; channels are tiny arrays |
| Per-track raster churn | low | re-resolve per frame for cycled content | Already content-keyed; motion must never enter the content key |
| Zoom redraw | trivial | full lane re-render per wheel tick | Compare-then-write; batch wheel events per animation frame |
| Vector sampling | trivial | O(paths × vertices) per frame | Pure sampler; cache per `(key pair, t)` inside the memo; no durable images |
| Curve resample | low | thousands of points per stroke | Sample adaptively (deviation-bounded); run off the pointer path (on commit) |
| Revision hashing | low | many clips with motion | Same FNV-1a path; keep motion keys minimal and canonical |

---

## 10. Anti-Patterns

1. **Baking motion into key bytes.** Destroys loops, forces re-bake per motion edit, violates "content cycles, motion continues."
2. **CSS `transform: scale` for zoom.** Double-scales every `getBoundingClientRect` computation; drag/scrub silently drift.
3. **Naming the new field `motion`.** Collides with `PhysicPaintRotoScriptMotionSettings`; a future reader will merge the two systems.
4. **Excluding `railMotion` from the canonical hash.** Justified only for re-bake flags; motion would make two different documents hash identically.
5. **Adding a transform term to the flattened cache key.** The `frame` term already covers it; a transform term churns keys and hides real revision bugs.
6. **Anchoring motion to the content bbox.** Wobbling loops; anchor to the composite centre.
7. **Persisting generated vector frames or image caches.** Violates gate 7 and the "real object animation" scope.
8. **Storing Bézier anchors in numeric `engine.params`.** Rust validates finite numbers only; it will parse and then silently diverge.
9. **Auto-adopting a bare Key Rail on first Motion key.** Hidden mutation; changes rail type; blocked by Gate B anyway.
10. **A second pitch constant.** Zoom will misalign rows/rails/scroll; enforce one metrics source with a literal-`18` lint.
11. **Expansion state on the track record.** Design says selection owns it; persisting it would also leak into revisions.
12. **Clipping applied per-frame instead of per-container.** The v7 outline/curve clipping must live on the rounded container, not per draw call.

---

## 11. Integration Points

### Internal boundaries

| Boundary | Contract | Change |
|---|---|---|
| TS ↔ Rust canonical | Byte-identical encoding, same ordinals | `railmotion` term both sides |
| Model ↔ store | `replaceRotoPhysicalLoopClips` immutable replacement | Motion rides the clip record; no new action path for persistence |
| Store ↔ compositor | Ports only (`resolveTrackContent`, `trackRasterMemo`, …) | Add `trackTransforms` |
| Compositor ↔ UI | Raster only | Unchanged |
| Layer JSON ↔ `.mce` | Layer sub-file, not `models/project.rs` | No `mceFieldContract` change for motion or vector |
| Selection ↔ view model | `TimelineMotionRailModel` projection | New selector; expansion in selection/view state |
| Zoom ↔ every frame→px consumer | Single `TimelineMetrics` | New module; delete duplicate constants |

### External services

None new. No network, no registry, no native command surface added by any of the four features. (The existing Rust WebP / 512 MB LRU path is untouched; vector and motion deliberately avoid it.)

---

## 12. Suggested Build Order and Dependencies

```
59  Rail motion channels (v2.1.0)
 59.1  Durable model + encoders            ← blocks all
       types, guard, parser, TS encoder, Rust mirror, parity fixture
 59.2  Pure evaluator + curve path builder ← after 59.1 (types)
 59.3  Store: projection, actions, revisions ← after 59.1/59.2
 59.4  Compositor: trackTransforms + both draw sites ← after 59.2/59.3
 59.5  Timeline UI: channels, headers, toggle, outline, nav cluster ← after 59.3
 59.6  UAT (v3 rows: independent motion keys, compositor render, three scopes)
60  Timeline horizontal zoom                 ← after 59.5 (same files; avoid churn)
61  Vector painting                          ← after 60; owns bezierPath reuse prep
 61.1  Vector model + sampler + renderer + store branch
 61.2  Vector tool UI + rail presentation
62  Painted-stroke curve editing             ← after 61 (shares bezierPath + overlay)
```

Why this order:

- 59.1 first because the dual-language encoding is the only change that can invalidate existing files; everything else is additive.
- 59.4 before 59.5 so the UI can be validated against real rendering (UAT row 9 needs a real transform).
- 60 after 59.5 because zoom touches every pitch site the motion lanes also touch — doing it in the other order means editing the same expressions twice.
- 61 before 62 because 62's overlay/gesture code benefits from the vector tool's hit-testing scaffolding, and both share `bezierPath.ts`; 61 can land the shared curve-overlay extraction.
- 62 last: lowest coupling, depends only on the aquarelle ledger and `bezierPath.ts`.

Research flags:

| Phase | Flag |
|---|---|
| 59.1 | Needs a byte-parity fixture between TS and Rust (no existing fixture covers a new optional block) |
| 59.2 | Needs a decision on easing semantics (hold/linear/cubic) and seeded-wiggle determinism |
| 59.3 | Needs the store action surface confirmed (prev/next/diamond) before UI enables buttons |
| 59.4 | Needs the transform anchor confirmed (centre recommended) and engineOverlay parity |
| 59.5 | Needs measured row offsets for the reorder indicator; v7 geometry exact |
| 60 | Needs the literal-`18` audit to reach zero before zoom ships |
| 61 | Needs a vector sampling quality decision (fixed step vs adaptive) |
| 62 | Needs round-trip deviation measurement before the "no persisted anchors" decision is final |

---

## 13. Open Decisions

1. **Gate B (rail identity).** v1 = loop clips only. Bare Key Rail follow-up = minted `railId` + `sourceKeyIds` membership snapshot, intersection per segment on split, merge never unions. Do not build in 59.
2. **Position lanes.** One lane (v7) vs X/Y lanes (v3 prototype). Recommendation: two channels in the model (`position-x`, `position-y`), one lane in the UI initially with a later split — the model must not change when the UI does.
3. **Scale lane.** The v7 mockup omits it; the v3 model requires it. Recommendation: ship the lane.
4. **Repeat semantics.** `hold` (rail-local frame clamps at the last key) vs `fit` (rail-local time normalized to the occurrence). Default `hold`.
5. **Expansion ownership.** Selected rail only (design default).
6. **Track opacity × motion opacity.** Multiply (recommended) vs motion overrides.
7. **Vector track creation flow.** Explicit action; never auto-convert.
8. **Curve anchors persistence.** Not persisted in v1 (recommended), pending deviation measurement.
9. **Zoom gap scaling.** All pitch terms scale per `CONTEXT.md` §5.6; confirm the 2 px post-block vertical gap stays unscaled (vertical geometry does not zoom).

---

## 14. Confidence Assessment

| Area | Level | Reason |
|---|---|---|
| Motion persistence (A) | HIGH | Loop clip structure, parser, TS/Rust encoders, revision and cache wiring all read directly; only the encoding ordinal is a discipline, not an unknown |
| Motion render (A) | HIGH | Compositor ports/draw sites and the background-transform precedent read directly; the only judgement call is the anchor point |
| Zoom (B) | HIGH | Every pitch consumer enumerated by line; a session-only zoom module already exists as precedent |
| Vector (C) | HIGH on integration, MEDIUM on scope | Dispatch and persistence seams are clear; interpolation/quality choices are product decisions |
| Curve editing (D) | HIGH | `bezierPath.ts` API and the aquarelle ledger are both stable and read directly; only round-trip fidelity is unmeasured |
| Bare Key Rail follow-up | MEDIUM | Deferred by Gate B; the described model is an inference from the loop-clip lifecycle |

---

## 15. Sources

- Live code (all line references above): `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts`, `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx`, `PhysicsPaintTrackRow.tsx`, `physicsPaintTrackHeaderColumn.tsx`, `timelineRailDesign.ts`, `physicsPaintCanvasZoom.ts`, `soundBandGeometry.ts`, `usePhysicsPaintRulerScrub.ts`, `PhysicsPaintKeyRail.tsx`, `PhysicsPaintLoopClipRail.tsx`, `aquarelleStrokeSelection.ts`, `app/src/components/physic-paint/physicsPaintStudio.css`, `app/src/efx-paint/compositor/efxPaintCompositor.ts`, `efxPaintCompositeCache.ts`, `efxPaintHideSolo.ts`, `app/src/efx-paint/document/efxPaintDocument.ts`, `efxPaintDocumentParsers.ts`, `efxPaintDocumentRevision.ts`, `app/src/stores/physicPaintStore.ts`, `app/src/lib/bezierPath.ts`, `app/src/lib/efxPaintPersistence.ts`, `app/src/components/canvas/PaintOverlay.tsx`, `packages/efx-watercolor/src/payload/toStudioStroke.ts`, `app/src-tauri/src/services/script_library.rs`, `app/src/lib/mceFieldContract.test.ts`.
- Specs: `SPECS/v2.1.0-motion-channels/CONTEXT.md` (§3 v3 model, §3.6 Gates A-D, §5.3 vector gates, §5.6 zoom scope), `SPECS/v2.1.0-motion-channels/README.md` (motion-lane contract, geometry, toggle state machine, integration map).
- Template: `.claude/gsd-core/templates/research-project/ARCHITECTURE.md`.
- Confidence tiers assigned by the GSD seam; code inspection is HIGH for seams, MEDIUM for deferred/deferred-product decisions.
