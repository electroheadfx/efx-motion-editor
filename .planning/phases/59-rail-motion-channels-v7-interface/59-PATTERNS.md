# Phase 59: Rail Motion Channels & v7 Interface - Pattern Map

**Mapped:** 2026-11-06
**Files analyzed:** 22 (6 new production, 1 new CSS-or-extend, 4 new test families, 11 modified)
**Analogs found:** 21 / 22 (the one gap is a genuinely new surface: no existing on-canvas object gizmo bound to a timeline key; the pointer/geometry machinery exists, the binding does not)

Every analog path below was verified git-TRACKED with `git ls-files` (21/21 non-empty). No gitignored mirror paths are named.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `app/src/components/physic-paint/roto/railMotionModel.ts` (NEW) | model (pure) | CRUD / serialize | `roto/physicsPaintRotoPhysicalModel.ts` | exact (same module family) |
| `app/src/components/physic-paint/roto/railMotionEvaluator.ts` (NEW) | utility (pure evaluator) | transform | `roto/aquarelleFramePose.ts` + `roto/physicsPaintRotoPhysicalResolver.ts:6945` (rail-local time) | role-match |
| `app/src/components/physic-paint/roto/railMotionIdentity.ts` (NEW) | utility (pure resolver) | transform | `roto/physicsPaintRotoRailSetSelection.ts` | role-match |
| `app/src/components/physic-paint/roto/railMotionPivot.ts` (NEW) | utility (pure geometry, revision-cached) | batch/transform | `view/physicsPaintCanvasZoom.ts` (session metric shape) + `roto/aquarelleFramePose.ts` | partial |
| `app/src/components/physic-paint/view/TimelineMotionChannels.tsx` (NEW) | component | event-driven UI | `view/PhysicsPaintKeyRail.tsx` + `view/timelineRailDesign.ts` | role-match |
| `app/src/components/physic-paint/physicsPaintStudio.css` (MODIFY; preferred over a new css file) | config (styling) | n/a | existing `.physics-paint-track-row-motion-toggle` / `.physics-paint-key-rail*` blocks | exact |
| `.../roto/railMotionModel.test.ts`, `railMotionIdentity.test.ts`, `railMotionEvaluator.test.ts`, `railMotionRevision.test.ts` (NEW) | test | unit | `roto/physicsPaintRotoLoopClips.test.ts` | exact |
| `app/src/efx-paint/compositor/efxPaintCompositorRailMotion.test.ts` (NEW) | test | unit (mock canvas) | `compositor/` port-mock style; pattern from `efxPaintCompositor.ts` pure ports | role-match |
| `app/src/lib/railMotionExportParity.test.ts` (NEW) | test | unit (render math) | `lib/efxPaintPackageRoundTrip.test.ts` (assertion style) | partial |
| `app/src/components/physic-paint/view/TimelineMotionChannels.test.ts` (NEW) | test (source-string pin) | n/a | `view/PhysicsPaintWorkflowStrip.test.ts` | exact |
| `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` (MODIFY) | model | serialize | itself (`encodeCanonicalLoopClips`, allowlist, revision) | exact |
| `app/src-tauri/src/services/script_library.rs` (MODIFY) | service (canonical hash) | transform | itself (`canonical_loop_clips`, `canonical_physical_hash`, in-file tests) | exact |
| `app/src/efx-paint/compositor/efxPaintCompositor.ts` (MODIFY) | renderer | request-response draw | itself (background transform precedent) | exact |
| `app/src/efx-paint/compositor/efxPaintCompositeCache.ts` (MODIFY: assertion-only, no sampled term) | utility | transform | itself (`deriveEfxPaintFlattenedCacheKey`) | exact |
| `app/src/stores/physicPaintStore.ts` (MODIFY) | store | CRUD + revision | itself (`setRotoPhysicalLoopClips`-family setters, `_resolveFlattenedFrame`) | exact |
| `app/src/components/physic-paint/view/timelineRailDesign.ts` (EXTEND ONLY) | config (design tokens) | n/a | itself | exact |
| `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` (MODIFY) | component | event-driven | itself (inert motion slot, eye/blend buttons) | exact |
| `app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx` (MODIFY) | component | event-driven | itself (header rows band + insertion indicator) | exact |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` (MODIFY) | component | event-driven | itself (rows region, action row, constants) | exact |
| `app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts` (MODIFY) | utility (projection) | transform | itself (`projectSelectedKeyRailInspector`) | exact |
| `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx` (MODIFY) | component (inspector) | event-driven | itself (selectedKeyRail branch) | exact |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (MODIFY) | controller/composition | event-driven | itself (rightPanelPropsMemo, selectedKeyRailInspector memo) | exact |
| `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx` (MODIFY) | component (overlay mount) | n/a | itself (gizmo sibling mounts) | exact |
| `app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx` (MODIFY: add `'rail-motion'` target) | component (gesture overlay) | event-driven | itself | exact |
| `app/src/lib/exportRenderer.ts` / `app/src/lib/previewRenderer.ts` (VERIFY, likely no edit) | renderer | batch | `renderGlobalFrame` fractional split | exact |

**Discovered corrections to the priority list (important for the planner):**

1. The inspector is NOT composed inline in `PhysicsPaintStudio.tsx` — the projected `selectedKeyRail` object is threaded into `PhysicsPaintScriptsPanel.tsx`, which owns the visible branch (`PhysicsPaintScriptsPanel.tsx:147-165`). D-06 lands there.
2. The on-canvas gizmo is mounted in `view/PhysicsPaintStudioView.tsx:323-346`, not in `PhysicsPaintStudio.tsx`. Studio only supplies the props object; source-string pins in `PhysicsPaintStudio.test.ts:1989-1991, 2541-2543` lock both sides.
3. `timelineRailDesign.ts` already carries `motionLaneHeight: 18` and `outlineWidth/outlineRadius` (`:110-112`); Phase 59 consumes them — do not add a second constant.

---

## Pattern Assignments

### `app/src/components/physic-paint/roto/railMotionModel.ts` (model, CRUD/serialize)

**Analog:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts`

**Exact-allowlist + fail-closed shape** (lines 484-535, 540-556):
```ts
const PHYSIC_PAINT_ROTO_LOOP_CLIP_KEYS = new Set([
  ...PHYSIC_PAINT_ROTO_LEGACY_LOOP_CLIP_KEYS,
  'railKind', 'scriptId', 'motion', 'overrideColor', /* ... */
]);
const PHYSIC_PAINT_ROTO_PHYSICAL_DOCUMENT_KEYS = new Set([
  'capacity', 'realKeyRecords', 'groupOverrideRecords', 'interpolation',
  'scriptMotion', 'background', 'selectedKeyId', 'cursorAppFrame',
  'revision', 'loopClips', 'incomingInterpolationBreakKeyIds',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function isBoundedKeyId(value: unknown): value is string {
  return isNonEmptyString(value) && value.length <= PHYSIC_PAINT_ROTO_KEY_ID_MAX_LENGTH;
}
function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
```
Reproduce verbatim for `railMotions` (add `'railMotions'` to the document allowlist, and a `PHYSIC_PAINT_ROTO_RAIL_MOTION_KEYS` set). Note the collision warning already written into the model: the loop-clip `motion?` member belongs to `PhysicPaintRotoScriptMotionSettings` and must never be reused (lines 305-360, 1630-1642).

**Id minting seam** (lines 425-439) — reuse the pattern, do NOT mint inside parsers:
```ts
export function createPhysicPaintRotoKeyId(): string {
  return crypto.randomUUID();
}
```

**Immutable-empty default** (lines 362-366, 390-404) — every absent-means-empty read uses a shared frozen constant (`PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY`); add `PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY` the same way.

**Test analog:** `roto/physicsPaintRotoLoopClips.test.ts` (validation matrix 386-452; byte-identical pin 562-568; revision-change proof 570-579; save→reopen 592-596; absent-means-off key test 609-612).

---

### `app/src/components/physic-paint/roto/railMotionEvaluator.ts` (utility, transform)

**Analog A (pure deterministic numeric evaluation):** `app/src/components/physic-paint/roto/aquarelleFramePose.ts:14-70`
```ts
export interface AquarelleSheetMotion { readonly deformation: number; /* ... */ }
export function isSheetMotionZero(motion: Readonly<AquarelleSheetMotion>): boolean { /* all-zero predicate */ }
export function computeAquarelleSheetPose(
  width: number, height: number, destinationSourceFrame: number, motion: Readonly<AquarelleSheetMotion>,
): AquarelleSheetPose | null {
  if (isSheetMotionZero(motion)) return null; // identity fast path, deterministic on frame + settings only
  /* ... */
}
```
Reproduce: a total function, no DOM/paint imports, one documented identity result, all inputs readonly, purity stated in the header.

**Analog B (rail-local time + clamp-outside-keyed-range):** `roto/physicsPaintRotoPhysicalResolver.ts:6945-6999`
```ts
export function resolvePhysicPaintRotoLoopFrame(context, appFrame): PhysicPaintRotoFrameResolution {
  if (/* malformed context */) throw new Error('PhysicPaintRotoLoopResolution: malformed resolution context.');
  if (!isNonNegativeInteger(appFrame)) return EMPTY_FRAME_RESOLUTION;   // fail-closed, frozen empty
  const offset = appFrame - range.phaseOrigin;
  const cycleOffset = offset % range.cycleLength;                        // no rewrite of stored keys
  const repeatInstance = Math.floor(offset / range.cycleLength);
}
```
Reproduce for `railLocalFrame = appFrame - railStart` (loop rail → `placementStart`; key rail → `firstKeyFrame`) with first/last-key clamping, rotation interpolated linearly in degrees with no wrap.

**Seeded PRNG for Wiggle** (REL/determinism, MOTN-10): use `Random` from `@efxlab/motion-canvas-core`; precedent `app/src/lib/fxGenerators.ts:1,16-31`. Do not hand-roll noise.

---

### `app/src/components/physic-paint/roto/railMotionIdentity.ts` (utility, Gate B)

**Analog:** `app/src/components/physic-paint/roto/physicsPaintRotoRailSetSelection.ts`

**Session-identity contract to copy and NOT extend into persistence** (lines 1-28):
```ts
/*
 * Identity contract (D-01/D-05): rail-set identity is the stable cross-type
 * identity only — `{ kind: 'loop', loopId }` ... `{ kind: 'key-rail', firstKeyId }`.
 * Ownership contract (Pattern 5): ... It never persists, never crosses the
 * bridge, and never joins the physical document allowlist or the canonical
 * revision fingerprint.
 */
export type RailSetIdentity =
  | { readonly kind: 'loop'; readonly loopId: string }
  | { readonly kind: 'key-rail'; readonly firstKeyId: string };
```

**Pure reducer style to copy** (lines 44-82, 190-241): bounded-id guards, `freezeRailSetSelection`, duplicate rejection, explicit branches, no fallback scope. The new durable `railId` is a *different* concept — it lives only in `railMotions`; bind loop rails by `loopId`, bare Key Rails by a minted UUID anchored to the current `firstKeyId`. The hazard is documented at `view/physicsPaintKeyRailPresentation.ts:1-6` (`KeyRailSegment` has no durable id).

---

### `app/src/components/physic-paint/roto/railMotionPivot.ts` (utility, revision-cached)

**Analog A (session-only derived metric, computed not persisted):** `app/src/components/physic-paint/view/physicsPaintCanvasZoom.ts:1-40` — states the "DISPLAY-ONLY, document untouched" boundary in the header and exposes pure derivations plus a `computed`.

**Analog B (pivot + matrix math):** `roto/aquarelleFramePose.ts:72-119` — the pivot-aware draw already exists and documents why both operands must move:
```ts
let drawX = -width / 2;
let drawY = -height / 2;
if (pivot) {
  context.translate(pivot.x + pose.centerX - width / 2, pivot.y + pose.centerY - height / 2);
  drawX = -pivot.x;
  drawY = -pivot.y;
} else {
  context.translate(pose.centerX, pose.centerY);
}
context.rotate(pose.rotation);
context.scale(pose.scale, pose.scale);
context.drawImage(frame, drawX, drawY, width, height);
```
D-17's pivot is the union of the rail's key bounds computed once per rail revision. There is **no existing content-bounds utility** (repo-wide grep for `contentBounds|inkBounds|alphaBounds|boundingBox` matches nothing) — this file has no exact analog; copy the purity/caching shape, design the bounds source under Gate D.

---

### `app/src/components/physic-paint/view/TimelineMotionChannels.tsx` (component, event-driven)

**Analog A (the lane component shape):** `app/src/components/physic-paint/view/PhysicsPaintKeyRail.tsx`

**Pure geometry projection first, JSX second** (lines 34-63):
```ts
export function projectPhysicsPaintKeyRailGeometry(
  segment: KeyRailSegment,
  visibleFrameWindow: { readonly startFrame: number; readonly endFrameExclusive: number },
  framePitch: number,
): PhysicsPaintKeyRailGeometry | null {
  if (segmentEndExclusive <= visibleFrameWindow.startFrame
    || segment.firstKeyFrame >= visibleFrameWindow.endFrameExclusive) return null;
  const clippedStart = Math.max(segment.firstKeyFrame, visibleFrameWindow.startFrame);
  return {
    left: (clippedStart - visibleFrameWindow.startFrame) * framePitch,
    width: projectTimelineRailLineWidth(clippedEnd - clippedStart, framePitch, showEndBoundary),
    showStartBoundary: ..., showEndBoundary,
  };
}
```
The planner should mirror this: export `projectTimelineMotionLaneGeometry` (lane rows + key cell x positions + outline height) as a pure function in the same file or beside it, so MUI-02/03/05 can be unit-tested without a DOM.

**Analog B (the design tokens — the ONLY source):** `app/src/components/physic-paint/view/timelineRailDesign.ts:70-134, 244-258`
```ts
export const TIMELINE_SURFACE = { /* card, rows, motionLane, motionToggleInactive: '#58616B', ... */ };
export const TIMELINE_GEOMETRY = {
  rowHeight: 30, cellWidth: 16, cellHeight: 22, cellRadius: 3,
  cellPitch: 18, cellGap: 2, cellTop: 6,
  motionLaneHeight: 18, outlineWidth: 1.5, outlineRadius: 4,
} as const;
export function resolveTimelineRailPalette(railType, tier) { return TIMELINE_RAIL_PALETTES[railType][tier]; }
export function projectTimelineRailLineWidth(frameCount, pitch = TIMELINE_GEOMETRY.cellPitch, ...): number
```
Rules: consume `TIMELINE_GEOMETRY.cellPitch` / `motionLaneHeight`; never a local `18`. `ROTO_CELL_WIDTH_PX = 18` is pinned in the strip (`PhysicsPaintWorkflowStrip.tsx:601-607`) — Phase 60 unifies pitch, so do not add a third number.

**Analog C (per-cell state matrix):** `timelineRailDesign.ts:153-207` (`resolveTimelineCellPresentation`, `timelineRailCellStyle`) — the same "pure resolver returns a presentation record, JSX maps it" split applies to motion key cells (6×6 keys, lighter rim, selected-rail outline tier).

**Glyphs:** `lucide-preact` — `Minus`, `ChevronRight`, `ChevronDown`, `Plus` (already imported in `PhysicsPaintTrackRow.tsx`, see below).

---

### `app/src/components/physic-paint/physicsPaintStudio.css` (config, extend)

**Analog:** the existing motion-slot and key-rail blocks in the same file.
- `.physics-paint-track-row-motion-toggle` at `physicsPaintStudio.css:7369-7377` (`color: var(--motion-toggle-color, #58616B)`).
- Key-rail blocks at `:5289-5327` (per rail-type/selected variants driven by `data-rail-type` / `data-rail-selected`) and `:5632-5719` (lane/segment/anchor/tooltip).
Project convention is one large `physicsPaintStudio.css`; `PhysicsPaintWorkflowStrip.test.ts:20-21` reads it by path. Prefer extending it over inventing `timelineMotionChannels.css` unless the planner deliberately adds a second file to the pin list.

---

### `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` (MODIFY, model/serialize)

**Term order to preserve exactly** (lines 1551-1575):
```ts
return [
  `records:${encodeRecords(records)}`,
  ...(groupOverrideRecords.length > 0 ? [`group-overrides:${encodeRecords(groupOverrideRecords)}`] : []),
  `interpolation:${validatedBoolean(interpolation.enabled)}`,
  `mode:${encodeCanonicalString(interpolation.mode)}`,
  ...(loopClips.length > 0 ? [`loops:${encodeCanonicalLoopClips(loopClips)}`] : []),
  ...(incomingInterpolationBreakKeyIds.length > 0
    ? [`incoming-breaks:${encodeCanonicalIncomingInterpolationBreakKeyIds(incomingInterpolationBreakKeyIds)}`]
    : []),
].join('');
```
Insert `rail-motions:` **after `loops:` and before `incoming-breaks:`**, emitted only when non-empty (new function `encodeCanonicalRailMotions`, sorted by `railId`, mirroring `encodeCanonicalLoopClips` at 1610-1675).

**Conditional-term precedents** (lines 1626-1657): `railKind` is a canonical term; `photoWiggle` / `keyScriptEdits` / `paintSeedVariation` are deliberately EXCLUDED because their writes re-bake key bytes. Motion is edited independently of the bytes, so it MUST be a term.

**Threading discipline:** `encodePhysicPaintRotoPhysicalContent` (1478-1499) and `buildPhysicPaintRotoPhysicalRevision` (1460-1469) both need the new argument; `buildPhysicPaintRotoProjectEquality` (1578-1597) routes through the same content encoder, so it inherits the term automatically. Add `'railMotions'` to `PHYSIC_PAINT_ROTO_PHYSICAL_DOCUMENT_KEYS` (523-535) and parse it at the document entry (`parsePhysicPaintRotoPhysicalDocument`).

**Byte-identical law:** a zero/absent collection must produce the exact prior revision. Test it with the 562-568 pattern.

---

### `app/src-tauri/src/services/script_library.rs` (MODIFY, canonical hash)

**Mirror at the identical ordinal** (lines 1589-1621):
```rust
let mut source = String::new();
source.push_str(&format!("records:{}", canonical_records(records)?));
if let Some(group_overrides) = group_overrides { if !group_overrides.is_empty() {
    source.push_str(&format!("group-overrides:{}", canonical_records(group_overrides)?)); } }
source.push_str(&format!("interpolation:{}", canonical_boolean(interpolation_enabled)));
source.push_str(&format!("mode:{}", canonical_string(interpolation_mode)));
if !loop_clips.is_empty() { source.push_str(&format!("loops:{}", canonical_loop_clips(loop_clips)?)); }
// <-- rail-motions term belongs HERE, before incoming-breaks
if !incoming_breaks.is_empty() { source.push_str(&format!("incoming-breaks:{}", canonical_incoming_breaks(incoming_breaks)?)); }
```
Guard site: `:1228-1247` — a mismatch returns `"Target physical hash does not match the canonical physical document"`.

**Known divergence to close FIRST (Pitfall 9):** `railKind` is emitted by TS (`physicsPaintRotoPhysicalModel.ts:1629`) and there is **zero** `railKind` in `app/src-tauri/src` (repo-wide grep confirmed this session). Add the parity fixture before the motion term.

**Rust test pattern to copy** (lines 2907-2956): a `motion_document(motion)` fixture builder + "zero encodes identically" / "nonzero changes the source" / "distinct ordinals" assertions. Add `rail_motion_document(...)` beside it.

---

### `app/src/efx-paint/compositor/efxPaintCompositor.ts` (MODIFY, renderer)

**Identity fast path + matrix order + degrees convention** (lines 397-424):
```ts
const backgroundTransformIsIdentity = backgroundTransform.x === 0 && backgroundTransform.y === 0
  && backgroundTransform.scaleX === 1 && backgroundTransform.scaleY === 1 && backgroundTransform.rotation === 0;
ctx.save();
if (backgroundTransformIsIdentity) {
  ctx.drawImage(raster, drawX, drawY, drawWidth, drawHeight);
} else {
  ctx.translate(drawX + drawWidth / 2 + backgroundTransform.x, drawY + drawHeight / 2 + backgroundTransform.y);
  ctx.rotate((backgroundTransform.rotation * Math.PI) / 180);   // the ONE degrees→radians point
  ctx.scale(backgroundTransform.scaleX, backgroundTransform.scaleY);
  ctx.drawImage(raster, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
}
ctx.restore();
```

**Both draw sites must share one helper:**
- overlay site `:313-322` (active track, `engineOverlay`, excluded from the store copy)
- normal site `:343-350`

Add a `trackTransforms?: ReadonlyMap<string, RailMotionTransform>` port to `EfxPaintCompositorPorts` (`:143-208`) and one `applyRailTrackTransform(ctx, transform, pivot): boolean` used by both. Opacity multiply (D-19) happens on `ctx.globalAlpha = track.opacity * (transform?.opacity ?? 1)` at both sites. Motion blur: do not add transform sampling (D-18).

**Cache coupling:** the flattened key is derived at `:254-274`; do NOT add a sampled transform term. `ports.engineOverlay != null` already bypasses the memo — the overlay path must still apply the identical transform.

---

### `app/src/efx-paint/compositor/efxPaintCompositeCache.ts` (MODIFY: prove, don't extend)

**Analog:** `deriveEfxPaintFlattenedCacheKey` (lines 125-204). The pattern to reproduce is the *negative*: every existing term is a revision/config/frame term, never a sampled value. Add a test asserting a motion-only document-state change rotates the key only through `trackContentRevisions` (which carries `buildPhysicPaintRotoPhysicalRevision`), and that no `translate|scale|rotation|opacity` term exists:
```ts
const source = [
  `config:${configTerm}`,
  `tracks:${encodeCanonicalNumber(participatingEntries.length)}:${trackTerms}`,
  `bg:${encodeCanonicalNumber(document.background.revision)}`,
  /* ... */ `frame:${encodeCanonicalNumber(frame)}`,
].join('');
return `flattened-${hashCanonicalPhysicalValue(source)}`;
```
`deriveEfxPaintTrackContentKey` (56-62) is the per-track term — motion rides it automatically because motion is inside `rotoPhysical`.

---

### `app/src/stores/physicPaintStore.ts` (MODIFY, store/CRUD)

**Collection state-map pattern** (lines 500-517, 508-511):
```ts
// Durable Loop Clip collections (Phase 43, D-29). Values are always
// frozen parser output; mutation sites REPLACE the array, never edit in place.
const _rotoPhysicalLoopClips = new Map<string, Map<string, readonly PhysicPaintRotoLoopClip[]>>();
export const rotoPhysicalRevision = signal(0);
```
Add `_rotoPhysicalRailMotions` with the same layerId→trackId→frozen-array nesting, plus reset/clear lines wherever `_rotoPhysicalLoopClips.clear()` appears (653, 670, 1252, 1737, 1826, 1852, 4051, 5204).

**Setter pattern to copy** (lines 4749-4766):
```ts
let validated: readonly PhysicPaintRotoLoopClip[];
try { validated = parsePhysicPaintRotoLoopClips(value); }
catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Invalid Loop Clip collection.' }; }
const nextRevision = buildPhysicPaintRotoPhysicalRevision(/* all collections */);
if (nextRevision === this.getRotoPhysicalContentRevision(layerId, trackId)) return { ok: true };  // idempotent no-op
_getOrCreateLayerTrackMap(_rotoPhysicalLoopClips, layerId).set(trackId, validated);
rotoPhysicalRevision.value = rotoPhysicalRevision.value + 1;
bumpTrackRevision(layerId, trackId);
return { ok: true };
```
Every rail-motion action (Animate, add/remove key, add/remove channel, gizmo settle) must go through this shape: validate → compare revision → replace → bump once. One completed gesture = one bump.

**Revision plumbing** — the new collection must be passed to every existing `buildPhysicPaintRotoPhysicalRevision` call: 1169 (structural cache), 2847 (`serializeRuntimeIntoDocument`), 4157/4164 (edit guard), 4539, 4755. Missing one silently drops motion (Pitfall 5, four carriers: `serializeRuntimeIntoDocument`, `encodeValidatedEfxPaintTrackContent` at `efxPaintDocumentRevision.ts:64-102`, `buildEfxPaintDocumentSyncFingerprint` at `:285-288`, `buildEfxPaintLayerChangeTokenValue` at `efxPaintPersistence.ts:526-532` — the latter three rotate automatically through the revision).

**Flattened path** (lines 2977-3041): integer guard at `:2986` (`if (!Number.isInteger(frame) || frame < 0) return null;`) is the REL-04 failure point; sub-frame export must bypass the flattened memo while reusing integer-keyed `trackRasterMemo`. `_flattenedMemo` at `:569`. `_trackContentRevision` at `:1629-1635` already returns the roto content revision.

**Pivot cache:** cache per (layerId, trackId, contentRevision) with the same clear-on-revision idiom as `_rotoPhysicalStructuralCache` (`:1144-1185`).

---

### `app/src/components/physic-paint/view/timelineRailDesign.ts` (EXTEND ONLY)

No fork of palette/geometry. Add only what the lane surface needs (e.g. `motionKeySize: 6`, `curveWidth: 1.5`, `postBlockGap: 2`, `headerCluster` coordinates) as new `TIMELINE_GEOMETRY` members, and a per-channel accent resolver if v7 differs from rail palette. Keep the module import-free (no Preact/JSX/lucide) so node-environment tests can execute it — the header (`:1-12`) explicitly locks that contract.

---

### `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` (MODIFY, MUI-01)

**The inert slot to replace** (lines 1199-1209):
```tsx
{/* v2.0.1 (README §2): the row's motion slot — an inert placeholder
    that keeps the header rhythm stable while motion channels are
    v2.1.0 scope. Never interactive: no role, no tabIndex, no handler,
    aria-hidden so assistive tech skips the empty slot. */}
<span class="physics-paint-track-row-motion-toggle is-none" title="No motion channels" aria-hidden="true">
  <Minus size={12} />
</span>
```
**Button pattern to copy for the interactive chevron** — the eye toggle (lines 1155-1167): `type="button"`, `class="physics-paint-track-row-tool-button"`, `aria-label`, `aria-pressed`, `title`, `onClick` with `event.stopPropagation()`, `size={12}` lucide icon. Grey `minus` stays non-interactive (MUI-01); only the motion-bearing state becomes a chevron button.

---

### `app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx` (MODIFY, MUI-05)

**Where channel headers must be inserted** (lines 185-233): the `tracks.map` producing one `PhysicsPaintTrackRowHeader` per track, then the Bg row.

**The arithmetic that must be replaced** (lines 38, 214-221):
```tsx
const HEADER_ROW_HEIGHT_PX = 31;   // declared, used arithmetically
{reorderDragTrackId !== null && typeof reorderDragIndex === 'number' ? (
  <div class="physics-paint-track-row-insertion-indicator"
       data-insertion-index={reorderDragIndex}
       style={{ top: `${reorderDragIndex * HEADER_ROW_HEIGHT_PX}px` }} aria-hidden="true" />
) : null}
```
MUI-05: replace with measured offsets (DOM rects or a measured row-height map that includes expanded channel rows). The header band must grow in lockstep with `PhysicsPaintWorkflowStrip.tsx`'s rows region; the strip owns the session state and flows it down as props (component header, lines 10-15 — keep it hook-free).

---

### `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` (MODIFY, host)

**Constants to consume, never re-derive** (lines 601-623):
```ts
const RULER_STEP = 3;
const ROTO_CELL_WIDTH_PX = 18;
const RULER_TICK_WIDTH_PX = RULER_STEP * ROTO_CELL_WIDTH_PX;
const STRIP_ROW_HEIGHT_PX = 31;      // 30px layout + 1px between stacked rows
const STRIP_CHROME_HEIGHT_PX = 132;
const STRIP_MAX_HEIGHT_PX = 270;
```

**Session derivation to extend** — `keyRailSegments` at `:2789` (`deriveKeyRailSegments({...})`), rail extents/selection memo at `:5154-5208` (`selectedRailType`, `selectedRailFrames`, `loopRailTypeByFrame`, `keyRailCoveredFrames`). Add `expandedRailId` + motion-key selection in this same tier; one open block (MUI-04) is enforced by clearing on rail-selection change.

**Rows host** (lines 5851-5917): `renderActiveLane()` inside `rowsRegionRef`; non-active tracks map to `PhysicsPaintTrackRow`. Insert `TimelineMotionChannels` immediately after each rail's row, inside the same scroll container, so header/lane alignment is structural.

**Action bar** (lines 5931-6004): the `physics-paint-roto-action-row` group. Copy the `Add key` / `Create rail` button grammar for the rail-scope `Animate` command:
```tsx
<span class="physics-paint-roto-key-icon-action" onPointerEnter={tooltip.onPointerEnter} ...>
  <button type="button" class="physics-paint-roto-key-icon-button"
          aria-label="Add key"
          aria-disabled={!canAddRotoKey ? 'true' : undefined}
          aria-describedby={!canAddRotoKey && reason ? 'roto-key-action-reason-add' : undefined}
          onClick={() => { tooltip.hide(); if (!canAddRotoKey) return; props.onAddRotoKey?.(); }}>
    <Plus size={18} aria-hidden="true" />
    <span class="physics-paint-roto-key-icon-label">Key</span>
  </button>
  {reason ? <span id="roto-key-action-reason-add" class="physics-paint-sr-only">{reason}</span> : null}
  <PhysicsPaintStyledTooltip visible={tooltip.visible} region="bottom">
    {buildGuardedActionTooltipCopy('Add key', reason)}
  </PhysicsPaintStyledTooltip>
</span>
```
**Disabled-reason helper** (lines 768-776): `buildGuardedActionTooltipCopy(description, disabledReason)` → `unavailable: {reason}`. Use it for MUI-06 nav-cluster disabled states.

---

### `app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts` (MODIFY, inspector projection)

**Analog:** itself, lines 105-144:
```ts
export const KEY_RAIL_EDIT_DISABLED_REASON = 'Select a single rail to edit it.';
export interface SelectedKeyRailInspectorPresentation {
  readonly firstKeyId: string; readonly keyIds: readonly string[];
  readonly firstKeyFrame: number; readonly lastKeyFrame: number;
  readonly framesLabel: string; readonly keysLabel: string;
  readonly typeLabel: 'Standard'; readonly editDisabledReason: string | null;
}
export function projectSelectedKeyRailInspector(segment, options = {}): SelectedKeyRailInspectorPresentation {
  const setSize = options.setSize ?? 1;
  return Object.freeze({ /* ... */ editDisabledReason: setSize >= 2 ? KEY_RAIL_EDIT_DISABLED_REASON : null });
}
```
Add a sibling projection (e.g. `projectRailMotionInspector(record, playhead)`) returning frozen, unit-formatted values (`px`, `%`, `deg`) per D-09 — never JSX. Keep the existing projection unchanged so its source-string consumers stay green.

---

### `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx` (MODIFY, D-06)

**The visible inspector branch** (lines 141-165):
```tsx
// 58-03 RAIL-01 (D-01): selecting a Key Rail takes over the Scripts pane ...
if (selectedKeyRail) {
  return (
    <div class="physics-paint-scripts-panel" role="tabpanel" aria-label={`Selected Key Rail — ${railLabel}`}>
      <div class="physics-paint-loop-clip-inspector-top-actions">
        <IconButton ... disabled={editDisabledReason !== null} disabledReason={editDisabledReason ?? undefined} ... />
      </div>
      <SidebarScrollArea class="physics-paint-scripts-list-scroll-area" interactive>
        <dl class="physics-paint-loop-clip-inspector">
          <div><dt>Frames</dt><dd>{selectedKeyRail.framesLabel}</dd></div>
          ...
        </dl>
      </SidebarScrollArea>
    </div>
  );
}
```
Add the motion value fields inside this `dl`/`SidebarScrollArea` region (Opacity always numeric). Reuse `IconButton` with `disabled` + `disabledReason` for the nav cluster — it already renders the reason element (`keyRailEditReasonId` pattern).

---

### `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (MODIFY, composition)

**Projection memo to copy** (lines 4893-4907):
```ts
// 58-05 (D-01/D-03): the Selected Key Rail inspector, memoized so the
// right-panel identity memo can compare it with Object.is.
const selectedKeyRailInspector = useMemo(() => {
  ...
  return projectSelectedKeyRailInspector(segment, { setSize: effectiveRailSetMembers.length });
}, [/* identity-stable deps */]);
```
**Identity memo discipline** (line 7159): `rightPanelPropsMemo.resolve([...deps], () => ...)` — every new prop must be an explicit dep; never read a signal inside the factory that is not in the dep list (the comment block at 6985-7110 explains the stale-closure law). Add `railMotionInspector` to that dep array and to the props object at `:7206+`.

---

### `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx` (MODIFY, gizmo mount)

**Sibling overlay seat pattern** (lines 323-346): after the reference ghost, before/after the background transform, each gated on `canvasBounds && props.<slot>` with `position: left/top/width/height` from `canvasBounds`:
```tsx
{canvasBounds && props.backgroundTransformHandles ? (
  <div class="physics-paint-background-transform"
       style={{ left: canvasBounds.left, top: canvasBounds.top, width: canvasBounds.width, height: canvasBounds.height }}>
    <PhysicsPaintReferenceTransformHandles {...props.backgroundTransformHandles} />
  </div>
) : null}
```
Add `railMotionTransformHandles` the same way. Pins exist both directions: `PhysicsPaintStudio.test.ts:1989-1991, 2541-2543` assert the prop type and the exact mount line — add a matching pin.

---

### `app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx` (MODIFY, D-05)

**Target discriminator to extend** (lines 58-70):
```ts
export type PhysicsPaintTransformHandleTarget = 'photo-reference' | 'background';
export interface PhysicsPaintReferenceTransformHandlesProps {
  readonly target: 'photo-reference' | 'background';   // required union — no default
  readonly layerId: string | null; readonly currentFrame: number;
  readonly isPlaying: boolean; readonly width: number; readonly height: number; readonly zoom: number;
}
```
Add `'rail-motion'` (third target) rather than forking the component — the gesture machine, threshold, apply bodies, SVG markup and counter-scaling are explicitly shared (header, lines 49-56).

**Gesture bracketing** (lines 81, 236-303, 305-326, 401-414):
```ts
const DRAG_THRESHOLD = 4;
beginInteraction(e.pointerId);                       // pointer-down, before capture
(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
markInteractionActive();                             // on threshold crossing
// pending → move | scale | rotate by handleType
endInteraction(e.pointerId);                         // pointer-up only
```
D-08 auto-key rule lives in the settle path, not in per-move writes: during the drag write a session draft; commit one document mutation at `endInteraction` (one undo step, no memo churn).

**Shared math to reuse, never re-implement** — `app/src/components/canvas/transformHandles.ts`:
- `HandleType` / `HandlePosition` / `LayerBounds` types (`:8-30`)
- `getHandlePositions(bounds, zoom)` (`:134-167`)
- `hitTestHandles(point, handles, zoom, handleScreenSize = 10)` (`:180-196`)
- `getRotationZone(point, bounds, zoom)` (`:207-229`)
- `getCursorForHandle(handle, isRotationZone, rotation)` (`:286-305`)
- `pointInPolygon(point, corners)` (`:315-334`)
- `getLayerBounds` (`:46-124`) is the rotate-corners formula; the rail-motion bounds analog is `getBackgroundBounds` in `view/PhysicsPaintReferenceTransform.ts` (target-dispatched bounds endpoint, handles lines 194-200).

---

### `app/src/lib/exportRenderer.ts` / `previewRenderer.ts` (VERIFY)

**Literal fractional split to preserve** (`exportRenderer.ts:174-176`, `:210-216`):
```ts
const frameIndex = Math.floor(globalFrame);          // integer content lookup
const fractionalOffset = globalFrame - frameIndex;   // fractional transform time
localFrame = frameIndex - seqStart + fractionalOffset;
```
REL-04: keep `frameIndex` integer for paint content; evaluate the rail transform at `globalFrame`/`fractionalOffset`. Do not route sub-frames through `_resolveFlattenedFrame` (it hard-rejects non-integers at `physicPaintStore.ts:2986`).

---

## Shared Patterns

### 1. Conditional canonical term (byte-identical law)
**Source:** `roto/physicsPaintRotoPhysicalModel.ts:1551-1575, 1610-1675` + `app/src-tauri/src/services/script_library.rs:1589-1621, 1382-1517`
**Apply to:** `railMotions` in both encoders, at the identical ordinal (after `loops:`, before `incoming-breaks:`), emitted only when non-empty.
**Rule:** adding a term may change revisions only for documents that carry the new field. If any existing document's revision moves, the term is inserted wrong.

### 2. Fail-closed parser / exact allowlist
**Source:** `roto/physicsPaintRotoPhysicalModel.ts:463-556, 484-535`
**Apply to:** the new collection, its records, per-channel keys, per-key curve/flag fields.
Controls: bounded non-empty ids, plain-prototype `isRecord`, non-negative integers, finite in-range numbers, duplicate rejection, sorted keys, array-length caps, frozen output.

### 3. Session-only view state
**Source:** `roto/physicsPaintRotoRailSetSelection.ts:10-28`
**Apply to:** `expandedRailId`, motion-key selection, three-scope arbitration, drag drafts.
Never persist, never cross the bridge, never join the allowlist or revision fingerprint. The durable `railId` in `railMotions` is a different concept.

### 4. Id minting
**Source:** `roto/physicsPaintRotoPhysicalModel.ts:425-439` (`createPhysicPaintRotoKeyId` → `crypto.randomUUID()`)
**Apply to:** new `railId` and new motion key ids, only at explicit creation seams; parsers never allocate or repair.

### 5. Deterministic seeded noise
**Source:** `app/src/lib/fxGenerators.ts:1,16-31` (`Random` from `@efxlab/motion-canvas-core`)
**Apply to:** Wiggle only. Seeded by stable ids + frame; never `Math.random`.

### 6. Compositor identity fast path / one transform helper
**Source:** `efxPaint/compositor/efxPaintCompositor.ts:397-424` (matrix), `:313-322` and `:343-350` (both draw sites)
**Apply to:** every track with motion. Identity short-circuits to the exact pre-plan draw path; degrees → radians once; opacity multiplies track opacity (D-19); no raster mutation.

### 7. Interaction bracketing / one undo step
**Source:** `view/PhysicsPaintReferenceTransformHandles.tsx:81,236-326,401-414`
**Apply to:** gizmo and lane drags. Draft during drag, one commit at settle, one revision bump.

### 8. Source-string UI pinning
**Source:** `view/PhysicsPaintWorkflowStrip.test.ts:1-60` (`readFileSync` + block slicers) — the established mechanism because vitest collects only `src/**/*.test.ts` (`app/vitest.config.ts:5`).
**Apply to:** MUI-01..06. Never add a `.test.tsx` and expect it to run; the repo's `.test.tsx.test.ts` launcher files exist only to work around that.

### 9. Guarded action + disabled reason
**Source:** `view/PhysicsPaintWorkflowStrip.tsx:768-776` (`buildGuardedActionTooltipCopy`), `view/PhysicsPaintScriptsPanel.tsx:153` (`IconButton disabled + disabledReason + descriptionId`)
**Apply to:** Animate visibility rules (D-01), nav-cluster unavailable actions (MUI-06).

### 10. Test-file grammar
**Source:** `roto/physicsPaintRotoLoopClips.test.ts` (386-452 validation matrix, 562-568 byte-identical, 570-579 revision diff, 592-596 save→reopen, 609-612 absent-means-off) and `script_library.rs:2905-2956` (Rust parity fixtures)
**Apply to:** every new `railMotion*.test.ts` and the Rust parity fixture. Test type is unit/source-string only — no rendered TSX.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `app/src/components/physic-paint/roto/railMotionPivot.ts` | utility | batch/transform | No content-bounds (`contentBounds`/`inkBounds`/`alphaBounds`) utility exists anywhere in the repo; the pivot source and its cost must be designed under Gate D. Only the purity/caching *shape* has analogs (Gate D fallback: geometric union of key bounds). |
| On-canvas gizmo bound to a timeline key | component | event-driven | The pointer/geometry machinery exists (`PhysicsPaintReferenceTransformHandles` + `transformHandles.ts`), but no existing overlay is bound to a key's evaluated value. The new binding (and its draft-transform settlement) is new surface. |

---

## Metadata

**Analog search scope:** `app/src/components/physic-paint/{roto,view}`, `app/src/components/canvas`, `app/src/efx-paint/{compositor,document}`, `app/src/stores`, `app/src/lib`, `app/src-tauri/src/services`.
**Files read this session:** 22 (targeted ranges only; no re-reads).
**Tracked-source gate:** 21/21 named analog paths verified via `git ls-files` (all non-empty).
**Pattern extraction date:** 2026-11-06.
