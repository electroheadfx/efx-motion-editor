# Phase 48: Internal Compositor and Flattened Parent Result - Pattern Map

**Mapped:** 2026-08-28
**Files analyzed:** 9 (5 new compositor modules, 3 new tests, 3 modified runtime files)
**Analogs found:** 9 / 9 (all new files have exact or role-match analogs; all seams verified in-repo)

**Anchor corrections applied (Pitfall P-48-1):** the Loop Clip resolver lives in `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` (exports at 5478/5655), NOT the nonexistent `physicsPaintRotoLoopClips.ts`. `projectBackgroundFrameLoopClipCapsule` was deleted in commit 346d47bc — do not resurrect it. `getEfxPaintDocument` in previewRenderer is an import alias of `getDocument` from `efxPaintStore` (previewRenderer.ts:17).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/src/efx-paint/compositor/efxPaintCompositor.ts` (new) | pure pipeline module | transform (sync frame-in/raster-out) | `app/src/efx-paint/document/efxPaintDocumentRevision.ts` + composite idiom in `app/src/lib/previewRenderer.ts:486-490` | exact (module style) + exact (draw idiom) |
| `app/src/efx-paint/compositor/efxPaintHideSolo.ts` (new) | pure predicate module | transform | `resolvePhysicPaintTrackVisibility` in `app/src/lib/previewRenderer.ts:108-116` | exact |
| `app/src/efx-paint/compositor/efxPaintTrackContent.ts` (new) | port/adapter module | request-response (per-track content query) | `resolvePhysicPaintFrameSource` in `app/src/lib/previewRenderer.ts:152-178` | exact |
| `app/src/efx-paint/compositor/efxPaintBackgroundResolution.ts` (new) | adapter module | transform (FrameLoopClip → resolver input) | `_resolveRotoPhysicalStructural` in `app/src/stores/physicPaintStore.ts:487-516` | role-match |
| `app/src/efx-paint/compositor/efxPaintCompositeCache.ts` (new) | cache module | memoized lookup | `_rotoPhysicalStructuralCache` in `app/src/stores/physicPaintStore.ts:452-519` + `imageCache`/`getPhysicPaintImageSource` in `app/src/lib/previewRenderer.ts:255-257, 726-747` | exact (two halves) |
| `app/src/efx-paint/compositor/*.test.ts` (new, 3 files) | test | contract/unit | `app/src/lib/previewRenderer.test.ts:1-213` (recording-canvas fixture) | exact |
| `app/src/lib/previewRenderer.ts` (modified) | renderer (main-editor boundary) | request-response | self — replace physic-paint branch call at 497-525; export `blendModeToCompositeOp` at 76-91 | exact (self) |
| `app/src/stores/physicPaintStore.ts` (modified, add `getFlattenedFrame`) | store | request-response | `getRotoPhysicalRenderSource` at 2326-2450 (delivery shape) + `getFrame` at 1133-1135 | exact |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (modified, program monitor + onion ghosts) | component | event-driven (signal subscriptions) | playback resolution at 1971-1993; onion projection at 2507-2515; status capsule at 622/705/3251 | exact (self) |

## Pattern Assignments

### `app/src/efx-paint/compositor/efxPaintCompositor.ts` (pure pipeline module, transform)

**Module style analog:** `app/src/efx-paint/document/efxPaintDocumentRevision.ts`

**Module header + purity contract** (efxPaintDocumentRevision.ts lines 1-11 — copy this doc-comment convention):
```typescript
/**
 * Deterministic document/track/composite revision builders (Phase 45-01
 * Task 3).
 *
 * Mirrors the canonical encoding of `buildPhysicPaintRotoPhysicalRevision`:
 * validate-then-hash; records sorted by stable identity (track id
 * localeCompare); strings length-prefixed to prevent delimiter collisions;
 * ...
 */
```
The compositor module must follow the same purity contract stated in `efxPaintDocument.ts:1-9`: "deliberately free of Preact imports, signals, and side effects — the pure-model/reactive-store split." Type imports from the document model use the `import type { ... } from '../document/efxPaintDocument'` idiom (efxPaintDocumentRevision.ts:22-27).

**Composite draw idiom analog:** `app/src/lib/previewRenderer.ts`

**Opacity-before-blend per-layer draw** (lines 486-490 — the D-01 order, copy exactly per track):
```typescript
ctx.save();
ctx.globalCompositeOperation = blendModeToCompositeOp(layer.blendMode);
ctx.globalAlpha = effectiveOpacity;
ctx.drawImage(off.canvas, 0, 0, logicalW, logicalH);
ctx.restore();
```
(Note: the parent site sets composite-op then alpha; Canvas 2D applies `globalAlpha` to the source at draw time regardless — the D-01 contract is verified by the pixel matrix, not by assignment order. Keep `save`/`restore` around every track.)

**Blend-mode map to export** (lines 76-91 — currently module-private; export it, do NOT duplicate the switch per Pitfall 8):
```typescript
function blendModeToCompositeOp(mode: BlendMode): GlobalCompositeOperation {
  switch (mode) {
    case 'normal':
      return 'source-over';
    case 'screen':
      return 'screen';
    case 'multiply':
      return 'multiply';
    case 'overlay':
      return 'overlay';
    case 'add':
      return 'lighter';
    default:
      return 'source-over';
  }
}
```
It covers the document's `BlendMode` union 1:1 (efxPaintDocument.ts:17: `'normal' | 'screen' | 'multiply' | 'overlay' | 'add'`).

---

### `app/src/efx-paint/compositor/efxPaintHideSolo.ts` (pure predicate module, transform)

**Analog:** `app/src/lib/previewRenderer.ts`

**Hide/solo truth table** (lines 98-116 — generalize from active-track-only to `participatingTracks(document): InternalPaintTrack[]`; add D-04 Background exemption governed only by `background.visible`):
```typescript
/**
 * 47-01 hide/solo preview filter (TML-04/Pitfall M8). The truth table:
 * - no solo armed → every track whose `visible !== false` resolves visible;
 * - any solo armed → only tracks that are `visible !== false` AND soloed show;
 * - hide always wins over solo (`visible: false` is hidden even when soloed);
 * - unknown track id or absent document fails closed to hidden.
 * ...
 */
export function resolvePhysicPaintTrackVisibility(layerId: string, trackId: string): boolean {
  const document = getEfxPaintDocument(layerId);
  if (!document) return false;
  const track = document.tracks.find((candidate) => candidate.id === trackId);
  if (!track || track.visible === false) return false;
  const soloArmed = document.tracks.some((candidate) => candidate.solo === true);
  if (!soloArmed) return true;
  return track.solo === true;
}
```
New version differences: pure (takes `EfxPaintDocument`, not `layerId`), sorts by `order` for compositing but keys by `track.id` (Pitfall 1 — never use `order`/index as identity), Background evaluated separately via `document.background.visible` only.

---

### `app/src/efx-paint/compositor/efxPaintTrackContent.ts` (port/adapter, request-response)

**Analog:** `app/src/lib/previewRenderer.ts`

**Single-track resolution to generalize into the per-track port** (lines 152-178 — the D-10 precedence `isPhysicalRotoWorkflowLayer → getRotoPhysicalRenderSource, else getFrame` is already encoded here):
```typescript
function resolvePhysicPaintFrameSource(layerId: string, frame: number): PreviewPhysicPaintFrameSource | null {
  if (!resolvePhysicPaintTrackVisibility(layerId, getActiveTrackId(layerId))) return null;
  if (isPhysicalRotoWorkflowLayer(layerId)) {
    const source = physicPaintStore.getRotoPhysicalRenderSource(layerId, getActiveTrackId(layerId), frame);
    // Phase 43 (D-28): the 'loop-placeholder' variant carries no payload — it
    // renders through the marked placeholder path below, and export blocks the
    // range in its preflight before any frame renders (43-09).
    if (!source || source.kind === 'loop-placeholder' || source.layerId !== layerId || source.appFrame !== frame) return null;
    return {
      layerId,
      frame,
      cacheKey: `physic-paint:${layerId}:physical:${source.cacheRevision}`,
      renderedFrame: source.renderedFrame,
    };
  }
  const renderedFrame = physicPaintStore.getFrame(layerId, getActiveTrackId(layerId), frame);
  if (!renderedFrame) return null;
  return {
    layerId,
    frame,
    cacheKey: `physic-paint:${layerId}:${frame}:${renderedFrame.dataUrl.slice(0, 96)}:${renderedFrame.dataUrl.length}`,
    renderedFrame,
  };
}
```
New version differences: takes an explicit `trackId` (not `getActiveTrackId`), and per D-09 the `loop-placeholder`/null case maps to **transparent + missing-source report**, never a placeholder raster (Pitfall P-48-4 — the 196-218 stripe placeholder stays preview-only chrome; compositor output never contains it). The port must be an injected interface so the pure compositor never imports the store (Architecture Responsibility Map: "compositor must not reach into store internals").

**Revision-aware cache-key idiom** (line 148 — reuse for per-track cache keys):
```typescript
export function getPreviewPhysicPaintFrameCacheKey(source: PreviewPhysicPaintFrameSource): string {
  return source.cacheKey ?? `physic-paint:${source.layerId}:${source.frame}:${source.renderedFrame.dataUrl.slice(0, 96)}:${source.renderedFrame.dataUrl.length}`;
}
```

---

### `app/src/efx-paint/compositor/efxPaintBackgroundResolution.ts` (adapter, transform)

**Analog:** `app/src/stores/physicPaintStore.ts` (how the store builds resolver inputs from runtime maps)

**Derivation-input assembly + memoized resolver context** (lines 487-517 — copy this shape: sort records, build `identities`, call `derivePhysicPaintRotoLoopRanges` once per content revision, query per frame via the returned context):
```typescript
const records = Array.from(recordMap.values()).sort((a, b) => a.appFrame - b.appFrame);
const identities = records.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame }));
// ...
loopResolution: derivePhysicPaintRotoLoopRanges({
  identities,
  loopClips,
  capacity,
  interpolationEnabled: interpolation.enabled,
}),
```

**Resolver contract consumed** (`physicsPaintRotoPhysicalResolver.ts`, verified):
- `derivePhysicPaintRotoLoopRanges(input: PhysicPaintRotoLoopDerivationInput): PhysicPaintRotoLoopResolutionContext` (line 5478) — fail-closed validation throws on malformed input; never throws on unresolved source references (D-31).
- `resolvePhysicPaintRotoLoopFrame(context, appFrame): PhysicPaintRotoFrameResolution` (line 5655) — half-open `[placementStart, effectiveEnd)` ranges; out-of-domain frames resolve `'empty'`.
- `PhysicPaintRotoLoopRange` (5338-5364) carries `placementStart`, `phaseOrigin`, `cycleLength`, `sourceKeyIds`, `repeat: number | 'infinity'`, `effectiveEnd`, `truncated`, `partialCycle`, `unresolved.missingSourceKeyIds`.

**Pitfall P-48-2 gap to bridge:** document `FrameLoopClip` (efxPaintDocument.ts:30-37) carries `{ id, startFrame, sourceFrameRefs: string[], repeat: {mode:'finite',count}|{mode:'infinite'}, sourceKind, revision }` — it does NOT match the resolver's `PhysicPaintRotoLoopClip` (`phaseOrigin`/`placementStart`/`sourceKeyIds`). The adapter's whole job is this mapping; never copy the modulo math into `efx-paint/` (Pitfall 10).

---

### `app/src/efx-paint/compositor/efxPaintCompositeCache.ts` (cache module, memoized lookup)

**Analog A:** `app/src/stores/physicPaintStore.ts` — identity-comparison memo (lines 452-519):
```typescript
const _rotoPhysicalStructuralCache = new Map<string, RotoPhysicalStructuralCacheEntry>();

/** Composite structural memo key: `${layerId}\0${trackId}` (46-01 TRK-03). */
function _rotoPhysicalStructuralCacheKey(layerId: string, trackId: string): string {
  return `${layerId}\0${trackId}`;
}
// ...
const cached = _rotoPhysicalStructuralCache.get(cacheKey);
if (cached
  && cached.recordMap === recordMap
  && cached.groupOverrideMap === groupOverrideMap
  && cached.interpolation === interpolation
  // ... identity-compare every input; hit only when ALL match
) return cached;
// recompute, then:
_rotoPhysicalStructuralCache.set(cacheKey, entry);
```

**Analog B:** `app/src/lib/previewRenderer.ts` — decode-once/draw-many image cache (lines 255-257, 726-747):
```typescript
private imageCache: Map<string, HTMLImageElement>; // imageId -> loaded HTMLImageElement
private loadingImages: Set<string>; // imageIds currently loading
private failedImages: Set<string>; // imageIds that failed to load
// ...
private getPhysicPaintImageSource(frame: PreviewPhysicPaintFrameSource): HTMLImageElement | null {
  const cacheKey = getPreviewPhysicPaintFrameCacheKey(frame);
  const cached = this.imageCache.get(cacheKey);
  if (cached) return cached;
  if (this.loadingImages.has(cacheKey) || this.failedImages.has(cacheKey)) return null;

  this.loadingImages.add(cacheKey);
  const img = new Image();
  img.onload = () => {
    this.loadingImages.delete(cacheKey);
    this.imageCache.set(cacheKey, img);
    this.onImageLoaded?.();
  };
  img.onerror = () => { /* ... failedImages.add ... */ };
  img.src = frame.renderedFrame.dataUrl;
  return null;
}
```

**Key composition for D-07/D-08 (CMP-04, Pitfall P-48-3):** `buildEfxPaintCompositeRevision` (efxPaintDocumentRevision.ts:139-157) covers configuration ONLY (order/vis/solo/opacity/blend + background id/visible/fallback). The flattened key MUST add per-track content revisions (from `_resolveRotoPhysicalStructural(...).contentRevision`, physicPaintStore.ts:2328-2331, or the dataUrl-slice idiom at previewRenderer.ts:175) + `background.revision` + per-clip revision terms + frame. Use the canonical encoder helpers (`encodeCanonicalString`/`encodeCanonicalNumber`/`hashCanonicalPhysicalValue` from `efxPaintCanonicalEncoder.ts`) — never ad-hoc string concatenation (delimiter-collision discipline, efxPaintDocumentRevision.ts:1-11). The unwired `document.compositeRevision` counter is NOT a valid key source (research finding c).

---

### `app/src/efx-paint/compositor/*.test.ts` (3 new test files, contract/unit)

**Analog:** `app/src/lib/previewRenderer.test.ts`

**Store mocks + stubbed canvas/Image globals** (lines 14-27, 196-213):
```typescript
vi.mock('../stores/paintStore', () => ({
  paintStore: { getFrame: vi.fn(() => null) },
}));

vi.mock('../stores/projectStore', () => ({
  projectStore: {
    width: { peek: () => 4, value: 4 },
    height: { peek: () => 3, value: 3 },
  },
}));
// ...
beforeEach(() => {
  _setPhysicPaintMarkDirtyCallback(() => {});
  physicPaintStore.reset();
  resetEfxPaintStore();
  registerDocument(makeTrackDocument('roto-layer'));
  clearProjectPaperRasterCache();
  offscreenOperations = [];
  vi.stubGlobal('window', { devicePixelRatio: 1 });
  vi.stubGlobal('document', { createElement: (tag: string) => tag === 'canvas' ? new TestCanvas(offscreenOperations) : {} });
  vi.stubGlobal('Image', TestImage);
  vi.stubGlobal('HTMLImageElement', TestImage);
  vi.stubGlobal('HTMLCanvasElement', TestCanvas);
});
```

**RecordingCanvasContext fixture** (lines 45-127 — copy this class shape for compositor op-order assertions; records `fillRect`/`drawImage`/`save`/`restore` with the `globalAlpha` and `globalCompositeOperation` values in effect at record time):
```typescript
type RecordedCanvasOp =
  | { type: 'fillRect'; x: number; y: number; w: number; h: number; fillStyle: string; globalAlpha: number; globalCompositeOperation: GlobalCompositeOperation }
  | { type: 'drawImage'; source: string; args: number[] }
  | /* ... save/restore/scale/clearRect/createPattern ... */;

class RecordingCanvasContext {
  operations: RecordedCanvasOp[];
  fillStyle: string | CanvasGradient | CanvasPattern = '#000000';
  globalAlpha = 1;
  globalCompositeOperation: GlobalCompositeOperation = 'source-over';
  private stateStack: Array<Pick<RecordingCanvasContext, 'fillStyle' | 'globalAlpha' | 'globalCompositeOperation'>> = [];
  // save() pushes state; restore() pops it; fillRect/drawImage record the op
  // with the CURRENT globalAlpha/globalCompositeOperation values.
}
```

**Document-fixture builder** (lines 31-39 — reuse for multi-track truth-table tests):
```typescript
function makeTrackDocument(layerId: string): EfxPaintDocument {
  const document = createEfxPaintDocument(layerId);
  const track = document.tracks[0];
  return {
    ...document,
    activeTrackId: TEST_TRACK_ID,
    tracks: [{ ...track, id: TEST_TRACK_ID, frames: {}, rotoPhysical: null, loopClips: [] }],
  };
}
```

**Source-contract test idiom** (lines 215-230 — `readSource` + `toContain` assertions pinning integration seams; the compositor gets one seam test asserting previewRenderer calls `getFlattenedFrame`):
```typescript
const root = resolve(__dirname, '../..');
const readSource = (path: string) => readFileSync(resolve(root, path), 'utf8');
// ...
expect(source).toContain("import {drawRotoFrameComposite, resolveMissingRotoFrameDraw} from './rotoFrameDraw'");
```

Test command: `pnpm --filter efx-motion-editor exec vitest run src/efx-paint` (never watch mode).

---

### `app/src/lib/previewRenderer.ts` (modified — renderer boundary)

Self-analog; the change is a surgical branch replacement.

**Current physic-paint branch to modify** (lines 497-525):
```typescript
} else if (layer.type === 'physic-paint') {
  const paintLayerId = layer.source.type === 'physic-paint' ? layer.source.layerId : layer.id;
  const frameSource = resolvePhysicPaintFrameSource(paintLayerId, physicPaintLookupFrame);
  // ... D-28 placeholder arm at 500-512 stays preview-chrome per P-48-4 decision ...
  const source = frameSource ? this.getPhysicPaintImageSource(frameSource) : null;
  // ...
  if (backgroundDraw || source) {
    // ...
    ctx.save();
    ctx.globalCompositeOperation = blendModeToCompositeOp(layer.blendMode);
    ctx.globalAlpha = effectiveOpacity;
    if (backgroundDraw) drawRotoFrameComposite(ctx, backgroundDraw, logicalW, logicalH, null, paperCanvas, source);
    else if (source) ctx.drawImage(source, 0, 0, logicalW, logicalH);
    ctx.restore();
  }
}
```
Replace the `resolvePhysicPaintFrameSource(paintLayerId, …)` call with the store's `getFlattenedFrame(layerId, frame)` result shaped as the existing `PreviewPhysicPaintFrameSource` (lines 139-145: `{ layerId, frame, cacheKey?, renderedFrame }`) so `getPhysicPaintImageSource` and the parent opacity/blend block (519-524) stay untouched. **Pitfall 6 guard:** parent `effectiveOpacity`/`blendMode` application at 519-524 must remain the ONLY parent application — the compositor never reads parent properties. Also export `blendModeToCompositeOp` (76-91) for the compositor instead of duplicating it. Export already routes through this same branch (`exportRenderer.ts` imports `PreviewRenderer` — one seam covers main preview AND export, Pitfall 8).

**Signal-subscription idiom to preserve** (line 444):
```typescript
// Subscribe callers that render inside signal effects to physics paint mutations.
void physicPaintVersion.value;
```

---

### `app/src/stores/physicPaintStore.ts` (modified — add `getFlattenedFrame(layerId, frame)`)

**Delivery-shape analog:** `getRotoPhysicalRenderSource` (lines 2326-2450) — D-11 says mirror this pattern. Key conventions to copy:
- Guard-first entry (line 2327): `if (!Number.isInteger(appFrame) || appFrame < 0) return null;`
- Resolve content revision alongside content (lines 2328-2331): `const structural = _resolveRotoPhysicalStructural(layerId, trackId); … const contentRevision = structural.contentRevision;`
- Return a discriminated union carrying a revision-aware `cacheRevision` (e.g. line 2417): `` cacheRevision: `${contentRevision}:real:${record.keyId}` ``

**Simple getter shape analog:** `getFrame` (lines 1133-1135):
```typescript
getFrame(layerId: string, trackId: string, frame: number): PhysicPaintRenderedFrame | null {
  return _frames.get(layerId)?.get(trackId)?.get(frame) ?? null;
},
```

**Where it lives:** planner discretion per D-11. If placed in `physicPaintStore` (recommended — it owns the runtime maps the compositor's content port needs), add a method to the `physicPaintStore` object literal (starts line 1132). If placed in `efxPaintStore`, follow its module-function style (`getDocument` at lines 67-70: plain exported function over a module-level `Map`, no Preact hooks). Either way: the store calls the pure compositor module with an injected runtime-access port; the compositor never imports the store.

**Return shape (Open Question 3 recommendation):** return a `PreviewPhysicPaintFrameSource`-compatible value (`{ layerId, frame, cacheKey, renderedFrame }`) so previewRenderer changes stay minimal; measure before introducing a canvas/ImageBitmap transport (A4).

---

### `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (modified — program monitor + onion ghosts)

Self-analog for the surface; the reactivity discipline comes from the `efx-preact-reactivity` skill (mandatory — see Shared Patterns).

**Playback surface resolution to generalize** (lines 1971-1993 — currently resolves the ACTIVE track via `getRotoPhysicalRenderSource`; D-05 switches this to the composite):
```typescript
const rotoCachedPlaybackAvailableFrames = useMemo(() => {
  if (rotoPlaybackLayerId === null) return [];
  return rotoPlaybackFrameNumbers.flatMap((appFrame) => {
    const source = physicPaintStore.getRotoPhysicalRenderSource(rotoPlaybackLayerId, trackIdOfLaunch(launchContext), appFrame);
    if (!source) return [];
    switch (source.kind) {
      case 'loop-placeholder':
        return [];
      case 'real':
      case 'generated':
        return [{ appFrame, frame: source.renderedFrame }];
      default: {
        const exhaustive: never = source;
        throw new Error(`Unhandled Roto physical render-source kind: ${JSON.stringify(exhaustive)}`);
      }
    }
  });
}, [rotoPlaybackLayerId, rotoPlaybackFrameNumbers]);
```
Copy the never-fallback exhaustive `switch` + `default: never` throw convention (also at PhysicsPaintStudio.tsx — Pitfall 7 "never-fallback convention").

**Onion projection to keep on top of the composite** (lines 2507-2515 — D-06 ghosts are the active track's raw frames via the existing projection, unchanged):
```typescript
const onionPreviewFrames = useMemo(() => projectRotoOnionPreviewFrames({
  currentFrame,
  isPlaying,
  onion,
  realKeyRecords: rotoKeyRecords,
  getRenderSource: (appFrame) => launchContext ? physicPaintStore.getRotoPhysicalRenderSource(launchContext.layerId, trackIdOfLaunch(launchContext), appFrame) : null,
  previewFrames: rotoOnionPreviewFrames,
  dirtyFrames: rotoOnionDirtyFrames,
}), [currentFrame, isPlaying, onion, rotoKeyRecords, launchContext, rotoOnionPreviewFrames, rotoOnionDirtyFrames]);
```

**Status capsule for missing sources (D-09)** (lines 622, 705, 3251 — reuse verbatim):
```typescript
const [applyStatus, setApplyStatus] = useState<ApplyStatus>('idle');
// ... on failure:
setApplyStatus('error');
// ... surfaced at 3251:
statusMessage: …(applyStatus !== 'success' ? applyMessage : null), statusIsError: applyStatus === 'error', …
```

## Shared Patterns

### Pure/reactive module split
**Source:** `app/src/efx-paint/document/efxPaintDocument.ts:1-9` and `app/src/stores/efxPaintStore.ts:1-14`
**Apply to:** All 5 new compositor files (pure side) and both store modifications (reactive side)
```typescript
/**
 * Pure v1.0 EFX Physic Paint document model (Phase 45-01).
 * ... deliberately free of Preact imports, signals, and side effects —
 * the pure-model/reactive-store split mirrors `physicsPaintRotoPhysicalModel.ts`
 * (pure) vs `physicPaintStore.ts` (reactive).
 */
```
Compositor modules: no Preact imports, no DOM construction — injected decode/canvas ports. Stores: signals + plain functions only, never hooks.

### Deep-frozen readonly outputs
**Source:** `efxPaintDocument.ts:82-122` (`Object.freeze` on every factory output, `readonly` fields throughout the model)
**Apply to:** compositor result records, cache entries, adapter outputs.

### Derived-hash revisions (validate-then-hash, canonical encoding)
**Source:** `efxPaintDocumentRevision.ts:117-157` + `efxPaintCanonicalEncoder.ts`
**Apply to:** `efxPaintCompositeCache.ts` key derivation. Sort records by stable identity (`id.localeCompare`), length-prefix strings, equal content → equal hash. `hashCanonicalPhysicalValue` is non-cryptographic change detection — never a security boundary.

### Per-track revision bump + memo invalidation
**Source:** `physicPaintStore.ts:89-106` (`bumpTrackRevision`: bumps track paint+roto signals + global `physicPaintVersion`, deletes the structural memo entry, fires dirty callback)
**Apply to:** any new mutation touching track content/background clips must ride `bumpTrackRevision`; the composite cache subscribes via the derived key (content changes → key changes → miss → recompute). MEMORY rule: always bump AND subscribe.

### Idempotent store setters (efx-preact-reactivity skill, hard rule)
**Source:** `physicPaintStore.ts:1153-1167` (`setRotoBackgroundMetadata` compare-then-write guard) + `.claude/skills/efx-preact-reactivity/SKILL.md` §3
**Apply to:** any new setter added to either store. "Called 1000× with the same value, does it bump 0 times?" A no-op write must not bump any revision signal (the 16 GB OOM incident class).
```typescript
const current = _rotoBackgroundMetadata.get(layerId)?.get(trackId);
if (current
  && current.background === metadata.background
  && current.paperGrain === metadata.paperGrain
  && current.grainStrength === metadata.grainStrength
  && current.color === metadata.color) return;
_getOrCreateLayerTrackMap(_rotoBackgroundMetadata, layerId).set(trackId, { ...metadata });
bumpTrackRevision(layerId, trackId);
```

### Narrow signal reads + identity-stable effect deps (efx-preact-reactivity §4/§5/§6)
**Source:** `PhysicsPaintStudio.tsx:1969-1993, 2501-2515` + skill SKILL.md
**Apply to:** the Studio program-monitor change. Per-tick composite output must flow to a narrow leaf canvas component (the 38.1-D-01 live-surface pattern), not a `.value` read in the Studio root render body. No signal writes in render bodies (guarded compare-then-write echo only). Memo dep arrays enumerate exactly real inputs (see the comment at 2501-2504).

### Never-fallback exhaustive switches
**Source:** `PhysicsPaintStudio.tsx:1981-1991`, `physicPaintStore.ts:2402-2405`
**Apply to:** compositor handling of the render-source union (`'real' | 'generated' | 'loop-placeholder'`) and resolution kinds. `default: { const exhaustive: never = x; throw new Error(...) }` — a future variant is a compile-time error.

### Track identity discipline
**Source:** `physicPaintStore.ts:50-58` (per-track maps "keyed by trackId (the stable UUID identity from the document — never an array index)")
**Apply to:** all compositor caches and the hide/solo sort. Sort by `order` for compositing sequence; key EVERYTHING by `track.id` (Pitfall 1).

### Fail-closed missing sources (D-09)
**Source:** `previewRenderer.ts:162` (null/placeholder guard) + Phase 46 D-13
**Apply to:** compositor + Studio capsule. Missing source → transparent pixels + `missing[]` report entry → status capsule with red warning triangle. No placeholder raster in flattened output or export (Pitfall P-48-4; the placeholder stripes at previewRenderer.ts:196-218 stay preview-only chrome pending the planner's human-verify checkpoint on Studio surface behavior).

## No Analog Found

None — every new file has an exact or role-match in-repo analog. The only genuinely new construction is the `FrameLoopClip` → `PhysicPaintRotoLoopClip` mapping inside `efxPaintBackgroundResolution.ts` (Pitfall P-48-2); the planner should design it from the two verbatim type contracts quoted above rather than from an existing adapter.

## Metadata

**Analog search scope:** `app/src/efx-paint/document/`, `app/src/lib/` (previewRenderer + test), `app/src/stores/` (physicPaintStore, efxPaintStore), `app/src/components/physic-paint/` (Studio + roto resolver), `.claude/skills/efx-preact-reactivity/`
**Files scanned:** 9 source files + 1 skill index
**Pattern extraction date:** 2026-08-28
