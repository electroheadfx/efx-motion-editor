# Phase 48: Internal Compositor and Flattened Parent Result - Research

**Researched:** 2026-08-28
**Domain:** In-repo architecture — deterministic Canvas 2D multi-track compositing inside the v1.0 EFX Paint document (Tauri 2.0 + Preact Signals monorepo)
**Confidence:** HIGH — every load-bearing claim verified by direct source reads this session; the milestone research (2026-08-23, HIGH) already covers ecosystem questions; zero new dependencies required.

## Project Constraints (from CLAUDE.md)

- Use the project-local GSD install from `.claude/gsd-core`.
- Do NOT run the dev server (the user runs it).
- Tests: `vitest run` only — never watch mode. Configured command: `pnpm --filter efx-motion-editor exec vitest run` [VERIFIED: .planning/config.json].
- Preact + @preact/signals (NOT React): consult `efx-preact-reactivity` skill before any component/hook/effect/store work — idempotent store setters, identity-stable effect deps, narrow signal reads, no render-body signal writes, loop termination. Applies at the store + Studio integration seams; the compositor module itself must stay UI-free (no Preact imports).
- Use pnpm, not npm (monorepo; `app/` directory).
- All user-facing copy is English (carried from Phase 47 D-14).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Opacity/blend application (CMP-03)**
- **D-01:** Internal track opacity is applied **before** blend mode (After Effects convention): the track's own pixels are scaled by its opacity first, then the blend mode composites that result onto the stack below. A 50%-opacity multiply track multiplies by its half-strength color.
- **D-02:** The flattened parent raster uses **straight alpha** at the boundary to the main editor (unmultiplied RGBA); the main editor's compositor handles the alpha math. Enforced with a pixel test: a 50%-alpha white pixel must composite as 50% white, never a dark gray.

**Background track resolution (CMP-06)**
- **D-03:** The compositor fully resolves Background clips **now** — modulo source mapping, finite/infinite repeat, gaps, and next-clip interruption — reusing the existing Loop Clip resolver. The document model already carries `background.clips`. Phase 49 then only adds the import/repeat/fallback-config UI.
- **D-04:** The Background track **stays visible when a Paint track is soloed** — only Paint tracks participate in the solo truth table. The Background's own `visible` flag still controls it.

**Studio preview surface (CMP-01)**
- **D-05:** The Studio canvas shows the **flattened composite** (all visible tracks composited — the program monitor), exactly what the main editor will show. Painting, onion-skin, and stroke-editing still target the active track; hide/solo lets the user focus.
- **D-06:** Onion skinning shows the **active track's previous/next frames ghosted on top of the current composite** — the ghost is the active track's raw frames, not re-composited.

**Flattened raster caching (CMP-04)**
- **D-07:** The flattened raster uses **per-track caches + a composite pass**: each track's frame content is cached keyed by track revision + composition dependencies; the composite pass combines the cached track rasters into the flattened result. When one track changes, only that track's cache recomputes, then the composite pass re-runs.
- **D-08:** The **composite pass result is cached per frame** (keyed by composite revision + frame), so playback draws the cached flattened raster instead of re-running the composite pass every tick. The cache invalidates when any participating track/clip/source/fallback changes.

**Missing source/asset states (CMP-05)**
- **D-09:** A missing source frame renders **transparent** in the flattened raster — fail-closed, matching Phase 46 D-13. The Studio surfaces the issue via the existing status capsule (red warning triangle). No placeholder ever leaks into the flattened output or export.

**Per-track content resolution (CMP-01, step 6)**
- **D-10:** When a track has multiple content sources at the same frame, the resolution precedence is **Roto timeline wins**: real key > generated interpolation > Hold Loop Clip > cached frame. Matches the current single-track resolver (`isPhysicalRotoWorkflowLayer` → `getRotoPhysicalRenderSource`, else `getFrame`).

**Main-editor delivery (CMP-01, step 10)**
- **D-11:** The main editor consumes the flattened raster via a new **store function `getFlattenedFrame(layerId, frame)`** that returns the composited raster + cache key, mirroring the current `getRotoPhysicalRenderSource` pattern. The compositor module is called by the store; the main renderer just draws the result. Replaces the current `getRotoPhysicalRenderSource(layerId, getActiveTrackId(layerId), frame)` single-track call.

### Claude's Discretion
- Exact cache-key structure for the flattened raster (composite revision + per-track content revisions + frame) and the composite-revision bump semantics (number vs derived hash).
- Exact store/function shape for `getFlattenedFrame` and the compositor module layout in `app/src/efx-paint/compositor/`.
- How the Studio status capsule flags missing sources (reuse the existing red-warning-triangle pattern).
- The pixel-tolerance policy values for the pixel acceptance matrix (existing policy reused).

### Deferred Ideas (OUT OF SCOPE)
- Background import/repeat/fallback-config UI — **Phase 49**.
- Photo/reference track — **Phase 50** (compositor anticipates it but renders no reference surface in Phase 48).
- Shared mask compositor and Reveal — **Phase 52**.
- Exact flattened cache-key structure and composite-revision bump semantics — researcher/planner discretion.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CMP-01 | One shared internal composition path resolves all Paint tracks into one deterministic per-frame flattened raster for Studio preview and flattened output | Architecture Patterns P1 (composition pipeline), `efx-paint/compositor/` layout [CITED: .planning/research/ARCHITECTURE.md]; spec composition order quoted verbatim below; delivery seam D-11 verified against `previewRenderer.ts:152-178` |
| CMP-02 | Internal hide/solo truth table applied | Existing pure predicate `resolvePhysicPaintTrackVisibility` verified at `previewRenderer.ts:108-116` — extract/generalize into the compositor; D-04 (Background exempt from solo) is new scope |
| CMP-03 | Internal opacity/blend applied once inside EFX Paint; parent applied once by main editor | D-01/D-02 locked; `blendModeToCompositeOp` verified at `previewRenderer.ts:76-91`; parent application sites verified at `previewRenderer.ts:487-488, 507-508, 549-550` |
| CMP-04 | Track cache key includes track revision + composition dependencies; parent cache invalidates on any participating change | `buildEfxPaintCompositeRevision` verified at `efxPaintDocumentRevision.ts:139-157` — **finding: it excludes track content and background clips, so it is necessary but NOT sufficient for the flattened key** (see Architecture Patterns P4) |
| CMP-05 | Missing source/asset states explicit and recoverable | D-09 fail-closed transparent + status capsule; existing `loop-placeholder` render-source kind verified at `physicsPaintRotoPhysicalModel.ts:171-179`; reconciliation risk documented in Pitfall P-48-4 |
| CMP-06 | Pixel acceptance matrix passes | Spec matrix rows quoted verbatim below; vitest node env has NO real Canvas 2D — pixel truth must be verified via recording-mock contract tests + native UAT (see Validation Architecture + Open Question 4) |
</phase_requirements>

## Summary

Phase 48 is greenfield module work on entirely verified seams. The `app/src/efx-paint/compositor/` folder does not exist yet (only `app/src/efx-paint/document/` exists today); the document model (`EfxPaintDocument`, `InternalPaintTrack`, `BackgroundTrack`, `FrameLoopClip`), the deterministic revision builders, the Loop Clip resolver, the hide/solo predicate, and the blend-mode mapping all exist and are verified below. The work is: (1) a UI-free compositor module implementing the spec's 11-step composition order, (2) per-track raster caches + a per-frame composite cache keyed by a revision tuple the planner must design (the existing `buildEfxPaintCompositeRevision` covers configuration only, not content), (3) a new store delivery function `getFlattenedFrame(layerId, frame)` replacing the active-track-only call in `previewRenderer.ts`, and (4) switching the Studio canvas from active-track view to program-monitor composite (D-05) with onion ghosts on top (D-06).

Three findings this session change the plan's shape versus the CONTEXT.md code anchors: (a) the cited Loop Clip resolver file `physicsPaintRotoLoopClips.ts` does not exist — the resolver lives in `physicsPaintRotoPhysicalResolver.ts` (5948 lines); (b) the filmstrip capsule projection `projectBackgroundFrameLoopClipCapsule` was **deleted** in commit 346d47bc (Phase 47 UAT round 6) and must not be resurrected — D-03 needs a *compositor-side* Background resolution, not the removed UI projection; (c) `compositeRevision` in the document schema currently has **no consumer** outside document parsing/revision tests — nothing bumps or reads it at runtime, so the D-08 cache key must derive from content (recommended) rather than rely on the counter being wired.

**Primary recommendation:** Build `efx-paint/compositor/` as a pure module (no Preact, no DOM construction — injected decode/canvas ports), composite via Canvas 2D `globalAlpha`-then-`globalCompositeOperation` (implements D-01 order natively), key the flattened cache with a derived hash over `buildEfxPaintCompositeRevision(document)` + per-track content revisions + background clip terms + frame, and verify the pixel matrix with recording-context contract tests now + native UAT pixel checks at phase gate.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Composition pipeline (fallback → Background → Paint tracks → flattened raster) | `efx-paint/compositor/` (pure TS module) | — | One shared path for Studio/main/export (Pitfall 8); must be UI-free so persistence/export can call it |
| Hide/solo truth table | `efx-paint/compositor/` (pure function) | — | Single source of truth; Phase 47's `resolvePhysicPaintTrackVisibility` is the active-track-only predecessor |
| Per-track content resolution (real > generated > Hold > cached) | `physicPaintStore` (`getRotoPhysicalRenderSource` / `getFrame`) | compositor calls per participating track | D-10; the store owns runtime maps; compositor must not reach into store internals |
| Background clip resolution (modulo, finite/infinite, gaps, interruption) | `physicsPaintRotoPhysicalResolver.ts` (existing resolver) | compositor adapter for `FrameLoopClip` records | D-03; document `FrameLoopClip` ≠ resolver's `PhysicPaintRotoLoopClip` — a thin mapping adapter is required (see Pitfall P-48-2) |
| Flattened cache (per-track + composite pass) | compositor module (cache owned beside pipeline) | store publishes revision inputs | D-07/D-08; cache keys derived, not stored |
| Store delivery `getFlattenedFrame(layerId, frame)` | `efxPaintStore` or `physicPaintStore` (planner discretion per D-11) | — | Mirrors `getRotoPhysicalRenderSource` pattern; the only seam `previewRenderer.ts` calls |
| Studio program-monitor surface | `PhysicsPaintStudio.tsx` / `PhysicsPaintStudioView.tsx` canvas stack | compositor output | D-05/D-06; existing playback surface resolves via `getRotoPhysicalRenderSource` at `PhysicsPaintStudio.tsx:1974, 2512` |
| Parent opacity/blend/transform | main editor `previewRenderer.ts` (UNCHANGED) | — | Pitfall 6; internal compositor never reads parent properties |

## Standard Stack

**Zero new runtime or dev dependencies** [VERIFIED: .planning/research/SUMMARY.md — "the spec is implementable on existing machinery with zero new dependencies"; confirmed this session by `app/package.json` read — no compositing/canvas packages present and none needed].

### Core (all existing, all verified in-repo this session)

| Asset | Location | Purpose | Why Standard |
|-------|----------|---------|--------------|
| Canvas 2D `globalCompositeOperation` | platform API | Internal track compositing | Same engine for Studio/main/export guarantees pixel parity (both Tauri webviews + export use the same WebKit canvas stack) |
| `blendModeToCompositeOp` | `app/src/lib/previewRenderer.ts:76-91` | BlendMode → composite-op mapping | Existing, matches the document's BlendMode union 1:1 (verbatim below) |
| `resolvePhysicPaintTrackVisibility` | `app/src/lib/previewRenderer.ts:108-116` | Locked hide/solo truth table | Implements CMP-02 predicate; generalize to all tracks (D-04 adds Background exemption) |
| Loop Clip resolver (`derivePhysicPaintRotoLoopRanges`, `resolvePhysicPaintRotoLoopFrame`) | `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:5478, 5655` | Modulo source mapping, finite/infinite repeat, next-clip interruption, half-open ranges | D-03 reuse; single resolver owns effective-duration (Pitfall 10) |
| `buildEfxPaintCompositeRevision` / `buildEfxPaintTrackRevision` | `app/src/efx-paint/document/efxPaintDocumentRevision.ts:139-157, 127-131` | Deterministic config/content fingerprints | CMP-04 foundation; derived hash, equal content → equal revision |
| `getRotoPhysicalRenderSource` / `getFrame` | `app/src/stores/physicPaintStore.ts:2326, 1133` | Per-track content resolution | D-10 precedence already encoded (real > generated > placeholder/null) |
| Preview image cache pattern (`imageCache` keyed by `getPreviewPhysicPaintFrameCacheKey`) | `app/src/lib/previewRenderer.ts:147-149, 255-257, 726-740` | dataUrl decode + cache | D-07 per-track cache mirrors this pattern |
| Status capsule (`setApplyStatus('error')` + red warning triangle) | Phase 46/47 established port (STATE.md 47-05) | Missing-source surfacing | D-09 reuses it verbatim |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Canvas 2D compositor | PixiJS/WebGL scene graph | Forbidden by milestone research ("What NOT to use") — forks the proven path, breaks Studio/export parity |
| Derived-hash cache keys | Bump `document.compositeRevision` counter on every mutation | Counter is unwired today (finding c); derived hash is idempotent and survives save/reopen deterministically |
| Recording-mock pixel tests | `node-canvas` devDependency for true pixel assertions in vitest | New dependency (needs legitimacy gate + user approval); duplicates no production path but slows installs — **not recommended**; see Open Question 4 |

**Installation:** none.

## Package Legitimacy Audit

**No external packages are installed by this phase.** The compositor is pure TypeScript over platform Canvas 2D and existing in-repo modules. The only candidate addition discussed (`node-canvas` for true pixel tests in vitest) is NOT recommended and is listed in the Assumptions Log (A2); if the planner or user elects it, it must pass `gsd_run query package-legitimacy check --ecosystem npm canvas` before any install task.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Application frame F
        │
        ▼
physicPaintStore.getFlattenedFrame(layerId, F)          ← NEW (D-11)
        │
        ▼
efx-paint/compositor/compositeFrame(document, runtimeAccess, F)
        │
        ├─ 1. document fallback: transparent | solid color      [document.background.fallback]
        ├─ 2. Background track (if visible; EXEMPT from solo — D-04)
        │      └─ FrameLoopClip → resolver adapter → source frame or GAP→fallback
        ├─ 3. participating Paint tracks = sortBy(order) → hide/solo filter (CMP-02)
        ├─ 4. per-track content (D-10 precedence):
        │      isPhysicalRotoWorkflowLayer → getRotoPhysicalRenderSource(layerId, trackId, F)
        │      else getFrame(layerId, trackId, F)
        │      missing source → TRANSPARENT + capsule flag (D-09, CMP-05)
        ├─ 5. per-track cache lookup: key = (trackId, trackContentRevision, F)   [D-07]
        ├─ 6. composite pass, stable order bottom→top:
        │      ctx.globalAlpha = track.opacity            ← opacity FIRST (D-01)
        │      ctx.globalCompositeOperation = blendModeToCompositeOp(track.blendMode)
        │      ctx.drawImage(trackRaster, 0, 0)
        ├─ 7. flattened raster (STRAIGHT ALPHA — D-02) + flattened cache store
        │      key = (compositeConfigHash, Σ track content revisions, bg terms, F)  [D-08]
        ▼
ONE flattened raster + cache key
        │
        ├─► Studio program monitor (D-05) + onion ghosts of ACTIVE track on top (D-06)
        └─► previewRenderer.renderFrame → parent layer drawImage exactly once
                (parent opacity/blend/transform applied HERE, unchanged — CMP-03)
                → main preview AND export (exportRenderer reuses PreviewRenderer.renderFrame)
```

### Recommended Project Structure (new files only)

```
app/src/efx-paint/compositor/           # NEW — one shared internal composition path
├── efxPaintCompositor.ts               #   compositeFrame(): the 11-step pipeline, pure
├── efxPaintHideSolo.ts                 #   hide/solo truth table (pure; CMP-02, D-04)
├── efxPaintTrackContent.ts             #   per-track content resolution port (D-10)
├── efxPaintBackgroundResolution.ts     #   FrameLoopClip → resolver adapter (D-03)
└── efxPaintCompositeCache.ts           #   per-track raster cache + flattened frame cache (D-07/D-08)
```

(Folder layout per [CITED: .planning/research/ARCHITECTURE.md §Recommended Project Structure]; filenames at planner discretion per CONTEXT.md Claude's Discretion.)

### Pattern 1: Composition pipeline (spec-locked order)

The spec's composition order is normative [VERIFIED: SPECS/milestone-v1.0.0-plan.md §Phase 4, read this session]:

> 1. Resolve the document fallback: solid background or transparency.
> 2. Resolve the fixed Background track clip at the frame, including modulo source mapping, finite/infinite repeat, gaps, and next-clip interruption.
> 3. Composite the Background contribution beneath all internal Paint tracks.
> 4. Resolve each participating internal Paint track.
> 5. Apply internal hide/solo truth table.
> 6. Resolve real/generated/cached track frame content and linked Hold Loop occurrences.
> 7. Composite Paint tracks in stable order.
> 8. Apply internal track opacity and blend mode.
> 9. Produce one flattened raster and composite revision.
> 10. Publish/persist that raster through the existing parent Paint-layer boundary.
> 11. Let the main editor apply parent transform, opacity, blend, outer ordering, motion blur, transitions, preview, and export exactly once.

### Pattern 2: Opacity-before-blend via Canvas 2D drawing state (D-01)

Canvas 2D natively implements the locked AE convention: `globalAlpha` scales the source pixels at draw time and the composite/blend operator then combines that result with the backdrop. Implementation per track:

```typescript
// Source: pattern verified at app/src/lib/previewRenderer.ts:487-488 (parent-layer application)
ctx.globalAlpha = track.opacity;                                      // opacity FIRST (D-01)
ctx.globalCompositeOperation = blendModeToCompositeOp(track.blendMode);
ctx.drawImage(trackRaster, 0, 0);
```

The blend map, verbatim [VERIFIED: app/src/lib/previewRenderer.ts:76-91]:

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

And the BlendMode union it must cover, verbatim [VERIFIED: app/src/efx-paint/document/efxPaintDocument.ts:17]:

```typescript
export type BlendMode = 'normal' | 'screen' | 'multiply' | 'overlay' | 'add';
```

Note: `blendModeToCompositeOp` is currently module-private in `previewRenderer.ts` — the compositor needs it exported (or moved to a shared lib module). Do not duplicate the switch (Pitfall 8 discipline).

### Pattern 3: Hide/solo truth table (CMP-02, D-04)

Existing predicate, verbatim [VERIFIED: app/src/lib/previewRenderer.ts:108-116]:

```typescript
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

The compositor generalizes this into a pure `participatingTracks(document): InternalPaintTrack[]` that (a) sorts by `order` (never identity — Pitfall 1), (b) applies the truth table, and (c) keeps the Background track governed only by its own `visible` flag (D-04). Background fields, verbatim [VERIFIED: app/src/efx-paint/document/efxPaintDocument.ts:62-68]:

```typescript
export interface BackgroundTrack {
  readonly id: string;
  readonly clips: readonly FrameLoopClip[];
  readonly fallback: BackgroundFallback;
  readonly visible: boolean;
  readonly revision: number;
}
```

### Pattern 4: Derived flattened cache key (D-07/D-08, CMP-04)

**Key finding:** `buildEfxPaintCompositeRevision` covers configuration ONLY — verbatim [VERIFIED: app/src/efx-paint/document/efxPaintDocumentRevision.ts:139-157]:

```typescript
export function buildEfxPaintCompositeRevision(value: unknown): string {
  const document = parseEfxPaintDocument(value);
  const orderedTracks = [...document.tracks].sort((a, b) => a.id.localeCompare(b.id));
  const tracksTerm = orderedTracks.map((track) => [
    encodeCanonicalString(track.id),
    encodeCanonicalNumber(track.order),
    validatedBoolean(track.visible),
    validatedBoolean(track.solo),
    encodeCanonicalNumber(track.opacity),
    encodeCanonicalString(track.blendMode),
  ].join('')).join('');
  const backgroundTerm = [
    encodeCanonicalString(document.background.id),
    validatedBoolean(document.background.visible),
    encodeCanonicalBackgroundFallback(document.background.fallback),
  ].join('');
  const source = `tracks:${orderedTracks.length}:${tracksTerm}bg:${backgroundTerm}`;
  return `composite-${hashCanonicalPhysicalValue(source)}`;
}
```

It excludes: track `frames`/`rotoPhysical`/`loopClips` content, and `background.clips`. CMP-04 requires invalidation when "any participating internal track, Background clip, source image, or fallback changes." Recommended key composition (planner finalizes):

```
flattenedKey(layerId, frame) = hash(
  buildEfxPaintCompositeRevision(document),          // config: order/vis/solo/opacity/blend/fallback
  perTrack: (trackId, trackContentRevision) sorted,  // content: roto contentRevision / frames fingerprint
  background: (background.revision, per-clip revision terms),
  frame
)
```

Per-track content revision at runtime comes from the same source `getRotoPhysicalRenderSource` uses — `_resolveRotoPhysicalStructural(layerId, trackId).contentRevision` [VERIFIED: app/src/stores/physicPaintStore.ts:2328-2331] — plus the cached-frames path key idiom (`physic-paint:${layerId}:${frame}:${dataUrl.slice(0,96)}:${dataUrl.length}`) [VERIFIED: app/src/lib/previewRenderer.ts:175]. Prefer derived hashes over wiring the unwired `compositeRevision` counter (finding c).

### Pattern 5: Per-track content resolution precedence (D-10)

The current single-track call sites to replace/generalize, verbatim [VERIFIED: app/src/lib/previewRenderer.ts:152-178]:

```typescript
function resolvePhysicPaintFrameSource(layerId: string, frame: number): PreviewPhysicPaintFrameSource | null {
  if (!resolvePhysicPaintTrackVisibility(layerId, getActiveTrackId(layerId))) return null;
  if (isPhysicalRotoWorkflowLayer(layerId)) {
    const source = physicPaintStore.getRotoPhysicalRenderSource(layerId, getActiveTrackId(layerId), frame);
    if (!source || source.kind === 'loop-placeholder' || source.layerId !== layerId || source.appFrame !== frame) return null;
    return {
      layerId,
      frame,
      cacheKey: `physic-paint:${layerId}:physical:${source.cacheRevision}`,
      renderedFrame: source.renderedFrame,
    };
  }
  const renderedFrame = physicPaintStore.getFrame(layerId, getActiveTrackId(layerId), frame);
  ...
}
```

The render-source union the compositor consumes per track, verbatim [VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:146-185] — kinds are `'real'`, `'generated'`, `'loop-placeholder'` (no payload; missing source), with `PhysicPaintRotoPhysicalRenderableSource = Exclude<…, { kind: 'loop-placeholder' }>`. The compositor maps `loop-placeholder`/null → transparent + capsule flag (D-09), never a placeholder raster (see Pitfall P-48-4).

### Anti-Patterns to Avoid

- **Re-implementing the compositor per surface** (Pitfall 8): Studio preview, main preview, and export MUST consume the same `compositeFrame`. Export already routes through `PreviewRenderer.renderFrame` [VERIFIED: app/src/lib/exportRenderer.ts:1, 180-358 — `import {getPreviewPhysicPaintFrameCacheKey, PreviewRenderer, …} from './previewRenderer'`], so one seam change in `previewRenderer.ts` covers both main preview and export.
- **Baking parent opacity/blend into the flattened raster** (Pitfall 6): parent application sites stay exactly where they are (`previewRenderer.ts:487-488` et al.); the compositor reads only document-owned state. Contract test: parent 50% × internal 50% = 25% effective.
- **A second Background loop scheduler** (Pitfall 10): reuse `derivePhysicPaintRotoLoopRanges`/`resolvePhysicPaintRotoLoopFrame` through a thin `FrameLoopClip`→resolver-input adapter. Do not copy the modulo math.
- **Resurrecting the deleted filmstrip capsule projection** [VERIFIED: commit 346d47bc removed `physicsPaintFilmstripCapsule.tsx` and the per-row capsule projection chain "from every track row (incl. the Background row)"]: D-03 is compositor-side resolution, not UI.
- **Track identity by `order`/array index** (Pitfall 1): sort by `order` for compositing, key everything by `track.id`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Blend-mode math | Custom per-pixel blend functions | Canvas 2D `globalCompositeOperation` + `blendModeToCompositeOp` | Per-pixel blends would diverge between surfaces and break the pixel matrix; the platform engine IS the parity guarantee |
| Background loop resolution | New modulo/repeat scheduler | `derivePhysicPaintRotoLoopRanges` / `resolvePhysicPaintRotoLoopFrame` (physicsPaintRotoPhysicalResolver.ts:5478/5655) | Off-by-one seam class already solved and truth-table tested (Pitfall 10) |
| Hide/solo logic | Inline visibility checks at call sites | One pure truth-table function in the compositor | Pitfall M8: Studio/flattened drift |
| Revision hashing | Ad-hoc string concatenation keys | `buildEfxPaintCompositeRevision`/`buildEfxPaintTrackRevision` + `efxPaintCanonicalEncoder` | Delimiter-collision-safe, order-independent, validate-then-hash (efxPaintDocumentRevision.ts:1-11 header) |
| Image decode/cache | New decode pool | Mirror `imageCache` pattern (previewRenderer.ts:255-257, 726-740) keyed by revision-aware cache key | Proven preload/failedImages semantics; decode-once, draw-many |
| Missing-source UX | Placeholder pixels in output | Transparent + status capsule (D-09) | Placeholders are preview-only chrome; never in flattened output/export |

**Key insight:** this phase's risk is not "how to composite" (Canvas 2D does it) but "how to guarantee one authority" — every hand-rolled variant is a second source of truth that drifts.

## Runtime State Inventory

This phase replaces a call path (`resolvePhysicPaintFrameSource` active-track call → `getFlattenedFrame`) but renames/migrates nothing persisted. All five categories answered explicitly:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `.mce` documents already persist `tracks[].frames` (cachePath refs), `background.clips`, per-track content — schema unchanged by this phase. PNG sidecars under `cache/efx-paint/<stableSegment>/<trackId>/` unchanged | None — no data migration (compositor reads existing state) |
| Live service config | None — single-process Tauri app, no external services | None — verified: no service config carries compositor state |
| OS-registered state | None | None — verified: no scheduled tasks/plists/units reference these modules |
| Secrets/env vars | None | None — verified: no env vars read by preview/compositor paths |
| Build artifacts | In-memory only: `previewRenderer.imageCache` (keyed by old cache-key format), `_rotoPhysicalStructuralCache` memo in physicPaintStore | Runtime-only: caches rebuild on launch; no artifact cleanup needed. Note: old-format keys in a long-lived session would go stale only if the module were hot-swapped — not a shipping scenario |

## Common Pitfalls

### Pitfall P-48-1: Stale CONTEXT.md code anchors (meta-pitfall — planner must adjust)

**What goes wrong:** The planner targets files that don't exist or were deleted.
**Verified corrections:**
- CONTEXT.md cites `app/src/components/physic-paint/roto/physicsPaintRotoLoopClips.ts` as "the Loop Clip resolver" — **that file does not exist** (only `physicsPaintRotoLoopClips.test.ts`, which tests persistence round-trips). The resolver is `physicsPaintRotoPhysicalResolver.ts` (5948 lines; exports at 5478/5655).
- CONTEXT.md §47-P04 reference to `projectBackgroundFrameLoopClipCapsule` — **deleted** in commit 346d47bc with the whole filmstrip capsule layer.
- `getEfxPaintDocument` in previewRenderer is an import alias of `getDocument` from `efxPaintStore` [VERIFIED: previewRenderer.ts:17 `import {getDocument as getEfxPaintDocument} from '../stores/efxPaintStore'`].
**How to avoid:** Use the verified anchors in this document.

### Pitfall P-48-2: `FrameLoopClip` ≠ `PhysicPaintRotoLoopClip` (D-03 adapter gap)

**What goes wrong:** The Background resolver reuse stalls because the document's Background clip record doesn't match the resolver's input type.
**Why it happens:** Document `FrameLoopClip` carries `{ id, startFrame, sourceFrameRefs: string[], repeat: {mode:'finite',count}|{mode:'infinite'}, sourceKind: 'playscript-hold'|'imported-background', revision }` [VERIFIED: efxPaintDocument.ts:30-37], while the resolver consumes `PhysicPaintRotoLoopClip` with `phaseOrigin`/`placementStart`/sourceKeyIds semantics over real-key identities (`PhysicPaintRotoLoopDerivationInput` at resolver 5442-5448 requires `identities`, `loopClips`, `capacity`, `interpolationEnabled`).
**How to avoid:** A pure adapter maps Background clips + source-frame records into the resolver's derivation input; resolver output (`PhysicPaintRotoLoopRange` — half-open `[placementStart, effectiveEnd)`, `truncated`, `partialCycle`, `unresolved.missingSourceKeyIds` [VERIFIED: resolver 5338-5364]) drives both pixels and capsule flags.
**Warning signs:** Duplicated modulo math appearing in `efx-paint/`.

### Pitfall P-48-3: Cache key under-coverage (CMP-04)

**What goes wrong:** Editing a Background clip or a track's cached frames doesn't invalidate the flattened raster — stale pixels in playback/export.
**Why it happens:** `buildEfxPaintCompositeRevision` excludes track content and background clips (Pattern 4). A key built on it alone misses content edits.
**How to avoid:** Composite key = config hash + per-track content revisions + background clip/revision terms + frame (Pattern 4). Test: edit track B content → track A's per-track cache entry unchanged, flattened key changes; edit a Background clip's repeat → flattened key changes.
**Warning signs:** Scrubbing shows old pixels after an edit until a track visibility toggle.

### Pitfall P-48-4: Placeholder-vs-transparent conflict on missing sources (D-09 vs D-28 status quo)

**What goes wrong:** Today a `'loop-placeholder'` source renders a **marked visible placeholder** in preview (alternating `#1A1A2A`/`#1A2A1A` stripes + 'Loop source missing' text [VERIFIED: previewRenderer.ts:196-218]) and export preflight blocks the range (43-09). D-09 locks: missing source renders **transparent** in the flattened raster, surfaced via the status capsule, and "no placeholder ever leaks into the flattened output or export."
**Why it happens:** Two sanctioned behaviors for the same condition now exist; the compositor must pick D-09 for its output.
**How to avoid:** The compositor emits transparent + a missing-source report (consumed by the Studio capsule). Decide explicitly (planner checkpoint) whether the Studio program monitor also switches from placeholder-stripe rendering to transparent+capsule, and whether the 43-09 export preflight block still applies to Hold-loop ranges or is superseded by fail-closed transparency. **This changes user-visible behavior — flag for the user in the plan.**
**Warning signs:** Pixel matrix passing while export still hard-blocks on a range D-09 says renders transparent.

### Pitfall P-48-5: Double-premultiplied dark halos (Pitfall 7, D-02)

**What goes wrong:** Straight-alpha track PNGs drawn through intermediate canvases pick up premultiplication mismatches; semi-transparent edges render dark.
**How to avoid:** Locked pixel test — a 50%-alpha white pixel must composite as 50% white, never dark gray. Keep the boundary raster straight-alpha; never premultiply by hand.
**Warning signs:** Dark fringes on semi-transparent strokes in main preview but not Studio (or vice versa) = a seam mismatch.

### Pitfall P-48-6: Composite cost at playback rates

**What goes wrong:** Re-running the composite pass every tick stutters 15/24 fps playback with 3+ tracks.
**How to avoid:** D-07/D-08 discipline: per-track raster caches keyed by content revision; composite result cached per frame; playback draws the cached flattened raster. Decode source dataUrls once into the per-track cache (decode-per-frame is the Performance Trap in PITFALLS.md).
**Warning signs:** CPU spikes per tick; playback smooth on track count 1 but not 3.

## Code Examples

### Per-track composite step (the core loop)

```typescript
// Source: pattern from app/src/lib/previewRenderer.ts:487-488 + D-01 lock
for (const track of participatingTracks(document)) {       // sorted by order, truth-table filtered
  const raster = trackRasterCache.get(track.id, contentRevision, frame)
    ?? decodeAndCache(trackContent);                       // D-07 per-track cache
  ctx.globalAlpha = track.opacity;                          // opacity BEFORE blend (D-01)
  ctx.globalCompositeOperation = blendModeToCompositeOp(track.blendMode);
  ctx.drawImage(raster, 0, 0);
}
// ctx state restored after each track; result is STRAIGHT alpha (D-02)
```

### Recording-context contract test idiom (existing pattern)

```typescript
// Source: app/src/lib/previewRenderer.test.ts:124-207 (RecordingCanvasContext + stubbed HTMLCanvasElement)
// The vitest node environment has NO real Canvas 2D — existing renderer tests record
// operations on a mock context and assert order/values:
//   expect(ops).toEqual([{op:'set globalAlpha', value:0.5}, {op:'set globalCompositeOperation', value:'multiply'}, {op:'drawImage', ...}])
// The pixel acceptance matrix uses this idiom for unit gates; true pixel checks are native UAT.
```

### Missing-source mapping (D-09)

```typescript
// Source: union verified at physicsPaintRotoPhysicalModel.ts:146-185
if (!source || source.kind === 'loop-placeholder') {
  missing.push({ trackId, frame, missingSourceKeyIds: source?.missingSourceKeyIds ?? [] });
  continue;  // track contributes TRANSPARENT pixels; capsule flags it — no placeholder raster
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-track active-only resolution (`resolvePhysicPaintFrameSource`) | Flattened multi-track `getFlattenedFrame(layerId, frame)` | This phase (D-11) | previewRenderer stops knowing about activeTrackId for content |
| Studio active-track canvas view | Studio program-monitor composite + onion ghosts | This phase (D-05/D-06) | Studio shows what the main editor shows |
| Filmstrip capsule projection for Background clips | Deleted (346d47bc); loop facts in tooltips only | Phase 47 UAT round 6 | Do NOT resurrect capsules for D-03 |

**Deprecated/outdated:**
- `resolvePhysicPaintFrameSource`'s active-track-only path: replaced by the flattened delivery at the physic-paint branch (the function's non-physic-paint concerns remain).
- The 47-01 hide/solo preview filter applied ONLY to the active track: superseded by the full truth table in the compositor (CMP-02).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Canvas 2D applies `globalAlpha` to the source before the compositing/blending operator (the D-01 ordering is native behavior). Two WHATWG spec fetches this session truncated before the normative drawing-model steps, so this is training knowledge, not session-verified | Pattern 2 | LOW risk — if reversed, opacity/blend matrix rows fail; mitigation: the D-02/matrix pixel checks ARE the executable verification, plus a cheap Wave 0 smoke test (50% white over black via `source-over`, then with `multiply`) in native UAT |
| A2 | True pixel assertions could be added in vitest via the `canvas` npm package (dev-only) — NOT verified this session, NOT recommended | Standard Stack / Validation | If the planner/user elects it: new dependency requires the package-legitimacy gate and user approval first |
| A3 | The flattened raster's canvas dimensions are not defined in the document model (`EfxPaintDocument` has no width/height [VERIFIED: efxPaintDocument.ts:71-80]); frames carry per-frame `width`/`height` (CachedFrameReference, efxPaintDocument.ts:40-44) | Open Questions | If no frame exists at F on any track, the compositor needs a size authority — assumption: parent layer/sequence canvas size supplies it; planner must confirm with the user or existing Studio canvas sizing |
| A4 | Studio composite transport cost (canvas → the Studio playback surface) is assumed acceptable via direct canvas/ImageBitmap handoff rather than `toDataURL` round-trips per frame | Open Questions | If the Studio surface requires dataUrl PNG payloads (like `PhysicPaintRenderedFrame`), per-frame encode cost may force a transport decision; planner should inspect `cachedRotoPlaybackComposition` before locking D-11's return shape |

## Open Questions

1. **Raster size authority for empty frames/documents**
   - What we know: frames carry width/height; the document carries none; the Studio canvas stack sizes itself from mounted canvases.
   - What's unclear: what size the flattened raster takes when no participating track has content at frame F (pure fallback/gap frames).
   - Recommendation: use the parent layer's canvas dimensions (same source `renderFrame` uses for its canvas sync, previewRenderer.ts:362-375); confirm with user.

2. **Missing-source Studio surface (Pitfall P-48-4)**
   - What we know: D-28 placeholder rendering (preview) + 43-09 export preflight block exist; D-09 locks transparent + capsule for flattened output/export.
   - What's unclear: whether Studio's program monitor keeps placeholder stripes (as view chrome over transparency) or goes transparent+capsule only, and whether the export preflight block is retained for Hold-loop ranges.
   - Recommendation: planner adds a `checkpoint:human-verify` — this is user-visible behavior on a previously locked surface.

3. **Where `getFlattenedFrame` lives and its return shape**
   - What we know: D-11 says "a new store function … mirroring the current `getRotoPhysicalRenderSource` pattern"; `PreviewPhysicPaintFrameSource` (previewRenderer.ts:139-145) is the renderer-facing shape (`layerId`, `frame`, `cacheKey?`, `renderedFrame`).
   - What's unclear: whether the flattened raster crosses the seam as a canvas/ImageBitmap or as a `PhysicPaintRenderedFrame` dataUrl (performance, A4).
   - Recommendation: return the existing `PreviewPhysicPaintFrameSource`-compatible shape so `previewRenderer` changes stay minimal; measure before introducing a new transport.

4. **Pixel-matrix verification strategy**
   - What we know: vitest runs in node env with mocked canvas (no pixel truth); spec demands "Studio flattened pixels, main preview, and export must satisfy the existing pixel tolerance policy."
   - What's unclear: the "existing pixel tolerance policy" has no in-repo implementation found this session (only recording-mock tests; `tolerance` appears only in `paintRenderer.test.ts` for fill logic) — the policy may be a UAT/visual convention rather than code.
   - Recommendation: unit gates = recording-context contract tests (op order, alpha values, cache keys, truth table); pixel truth = native UAT per matrix row (project precedent: "Accept summarized render UAT evidence"). Do not add a canvas dependency without user approval (A2).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build/test | ✓ | v24.15.0 | — |
| pnpm | install/test (monorepo) | ✓ | 10.27.0 | — |
| vitest | unit gates | ✓ | ^2.1.9 (app/package.json) | — |
| TypeScript | typecheck gate | ✓ | ~5.9.3 (app/package.json) | — |
| Canvas 2D in tests | pixel matrix | ✗ (node env, mocked) | — | Recording-context contract tests + native UAT (Open Question 4) |

**Missing dependencies with no fallback:** none blocking.
**Missing dependencies with fallback:** real Canvas 2D in vitest → recording-mock + native UAT.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^2.1.9 [VERIFIED: app/package.json] |
| Config file | `app/vitest.config.ts` — `include: ['src/**/*.test.ts']`, default node environment, no setup file [VERIFIED: app/vitest.config.ts] |
| Quick run command | `pnpm --filter efx-motion-editor exec vitest run src/efx-paint` [CITED: .planning/config.json test_command base] |
| Full suite command | `pnpm --filter efx-motion-editor exec vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CMP-01 | One shared path: same compositeFrame consumed by Studio + flattened delivery | unit (contract) | `pnpm --filter efx-motion-editor exec vitest run src/efx-paint/compositor` | ❌ Wave 0 |
| CMP-02 | Hide/solo truth table incl. Background exemption (D-04) | unit (pure fn truth table) | same, `efxPaintHideSolo` tests | ❌ Wave 0 |
| CMP-03 | Opacity-before-blend op sequence; parent never applied internally (25% contract) | unit (recording-context op assertions) | same | ❌ Wave 0 |
| CMP-04 | Flattened key invalidates on track content / clip / fallback change; per-track cache isolation | unit | same | ❌ Wave 0 |
| CMP-05 | Missing source → transparent + missing report; capsule flag path | unit | same | ❌ Wave 0 |
| CMP-06 | Pixel acceptance matrix rows (blend modes, hidden/soloed, empty upper, Background loops/gaps, parent opacity/blend) | unit (recording-context) + native UAT (pixel truth) | unit command above; UAT at phase gate | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter efx-motion-editor exec vitest run src/efx-paint`
- **Per wave merge:** `pnpm --filter efx-motion-editor exec vitest run` + `pnpm --filter efx-motion-editor exec tsc --noEmit`
- **Phase gate:** Full suite green + native UAT pixel matrix before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `app/src/efx-paint/compositor/efxPaintCompositor.test.ts` — covers CMP-01/CMP-03/CMP-06 unit rows
- [ ] `app/src/efx-paint/compositor/efxPaintHideSolo.test.ts` — CMP-02 truth table (no solo / solo / hide-wins / Background exempt / unknown-track fail-closed)
- [ ] `app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts` — CMP-04 invalidation matrix
- [ ] Shared recording-canvas fixture for compositor tests (mirror `previewRenderer.test.ts:124-207` idiom)
- [ ] No framework install needed — vitest infrastructure covers the phase

## Security Domain

Security enforcement is enabled (absent from config = enabled). This phase adds no IPC commands, no file paths, no network, no new CSP surface — the compositor consumes already-validated in-memory document/runtime state.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes (inherited) | Document/track/clip inputs already pass the fail-closed parsers (`parseEfxPaintDocument`, `parseInternalPaintTrack` — efxPaintDocumentRevision.ts:28); the compositor must NOT re-accept unvalidated raw data — consume parsed documents only |
| V6 Cryptography | no | `hashCanonicalPhysicalValue` is explicitly non-cryptographic change detection (efxPaintDocumentRevision.ts:9-10) — do not repurpose as a security boundary |
| V12 File Handling | no (unchanged) | No new sidecar paths; existing `isSafeEfxPaintCachePath` gate (Phase 46 T-46-04) unchanged |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stale cache serving wrong pixels after an edit | Tampering (integrity) | CMP-04 derived-revision keys; invalidation matrix tests (Wave 0) |
| Unvalidated document reaching the compositor | Tampering | Parse-at-boundary (existing); compositor typed to `EfxPaintDocument`, never `unknown` |
| Track identity confusion via `order`/index | Tampering / Info disclosure | Identity by `track.id`; sort-only use of `order` (Pitfall 1) |
| DoS via pathological track/clip counts in composite pass | Denial of Service | Per-track caches + per-frame composite cache (D-07/D-08); no unbounded materialization of ∞ loops (resolver derives, never expands — Pitfall 11 discipline) |

## Sources

### Primary (HIGH confidence — read this session)
- `app/src/efx-paint/document/efxPaintDocument.ts` (full file) — document/track/background/clip model, verbatim quotes
- `app/src/efx-paint/document/efxPaintDocumentRevision.ts` (full file) — revision builders incl. `buildEfxPaintCompositeRevision` coverage gap finding
- `app/src/lib/previewRenderer.ts:17, 70-249, 300-379` — blend map, hide/solo predicate, single-track resolution to replace, image cache, parent opacity/blend sites
- `app/src/stores/physicPaintStore.ts:2326-2445, 1133, 319` — `getRotoPhysicalRenderSource` (full lifecycle-target switch), `getFrame` signature, track-local `_frames` map
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:5319-5448` — loop range/resolution contracts
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:146-215` — render-source union
- `app/src/types/physicPaint.ts:1773-1785` — `PhysicPaintRenderedFrame`
- `SPECS/milestone-v1.0.0-plan.md` §Phase 4 (composition order, requirements, pixel matrix), §UAT, §release stop conditions — verbatim quotes
- `app/vitest.config.ts`, `app/package.json`, `app/src/lib/previewRenderer.test.ts:124-207` — test infrastructure reality
- `git show 346d47bc --stat` — filmstrip capsule deletion scope
- `.planning/STATE.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, phase 45/46/47 context chain

### Secondary (MEDIUM confidence)
- `.planning/research/SUMMARY.md`, `ARCHITECTURE.md`, `PITFALLS.md` (2026-08-23, HIGH-rated milestone research) — compositor folder layout, pitfall set, zero-new-dependency conclusion

### Tertiary (LOW confidence)
- WHATWG HTML canvas compositing/drawing-model semantics (A1) — official spec fetched twice this session but truncated before normative steps; claim remains `[ASSUMED]` with an executable mitigation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; every reused asset verified by direct file reads with verbatim quotes
- Architecture: HIGH — composition order spec-locked; all seams verified; three CONTEXT.md anchor corrections documented
- Pitfalls: HIGH — in-repo verified (stale anchors, resolver type gap, cache-key coverage, placeholder conflict); canvas alpha-ordering claim is the single [ASSUMED] item with a cheap executable check

**Research date:** 2026-08-28
**Valid until:** 2026-09-27 (stable — all in-repo claims; re-verify if Phase 48 planning slips past a milestone research refresh)
