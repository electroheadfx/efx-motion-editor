# Architecture Research

**Domain:** v1.0.0 multi-track EFX Paint document integration into the existing EFX Motion Editor monorepo (Tauri 2.0 main editor + standalone `efx-physic-paint` window)
**Researched:** 2026-08-23
**Confidence:** HIGH — all integration points verified by direct repo inspection of the locked spec (`SPECS/milestone-v1.0.0-plan.md`) and the existing stores/bridge/renderer/persistence code. The open questions are internal seam choices, not ecosystem unknowns.

## Standard Architecture

### System Overview (post-v1.0.0)

The architectural invariant is locked: **one parent Paint layer → one EFX Paint document → many internal Paint frame tracks → one flattened frame result delivered to the unchanged main-editor compositor.** The main editor never iterates internal tracks.

```
┌─────────────────────────── Main editor window (Tauri "main") ───────────────────────────┐
│  Sequence (UNCHANGED)                                                                   │
│  ├── Paint layer A ──► EFX Paint document (NEW, owned by parent layer)                  │
│  │       ├── Photo/reference track (NEW)                                                │
│  │       ├── Paint frame track 1 (NEW)                                                 │
│  │       ├── Paint frame track 2 (NEW)                                                 │
│  │       ├── Paint frame track 3 (NEW)                                                 │
│  │       ├── Background track with Loop Clips (NEW)                                   │
│  │       ├── Document fallback: solid or transparent (NEW)                              │
│  │       └── ONE flattened frame result ──► existing parent-layer boundary             │
│  ├── Paint layer B ──► its own independent EFX Paint document                          │
│  └── Other main-editor layers (UNCHANGED)                                              │
│                                                                                         │
│  timelineStore / audioStore / projectStore / physicPaintStore (13 signal stores)        │
│  lib/previewRenderer.ts (UNCHANGED parent-layer compositor — consumes one raster)      │
│  lib/physicPaintBridge.ts (MOD — document/track revisioned messages)                   │
└───────────────┬─────────────────────────────────────────────────────────────────────────┘
                │ Tauri events (emitTo 'efx-physic-paint') + launch URL context
                │ (existing patterns: PHYSIC_PAINT_*_EVENT constants)
┌───────────────▼──────────── EFX Paint window (label "efx-physic-paint") ────────────────┐
│  Same SPA bundle, parsed via parsePhysicsPaintLaunchContext(location)                   │
│  PhysicsPaintStudio + hooks/ controllers (signals boundary)                            │
│  ├── NEW efx-paint/ document model + track-local stores (signals)                       │
│  ├── NEW efx-paint/ internal compositor (one shared path)                              │
│  ├── NEW multi-row timeline strip (extends PhysicsPaintWorkflowStrip)                  │
│  ├── roto/ physicsPaintRoto* (MOD — track-local addressing, shared Loop Clip resolver) │
│  └── audio/ efxPaintAudioPreview* (REUSE v0.9.0 Phase 41 as-is)                        │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                │
┌───────────────▼──────────── packages/efx-physic-paint ──────────────────────────────────┐
│  engine/EfxPaintEngine.ts (REUSE — render host for staged frames, unchanged API)       │
│  animation/ progressiveStrokeSchedule / recordedStrokeMotion / staticStrokeSchedule     │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Status |
|-----------|----------------|--------|
| `app/src/stores/efxPaintStore.ts` | NEW. The v1.0.0 EFX Paint document store: `EfxPaintDocument` (version, parentLayerId, documentRevision, activeTrackId, tracks, photoReference, background, compositeRevision), track CRUD, hide/solo/opacity/blend, per-track revision, composite revision. Keyed `layerId → document`. | **New** |
| `app/src/efx-paint/document/` | NEW. Pure document model: `EfxPaintDocument`/`InternalPaintTrack`/`PhotoReferenceTrack`/`BackgroundTrack`/`FrameLoopClip` types, fail-closed parsers, revision builders, clean-break validation (reject pre-v1.0 data explicitly). | **New** |
| `app/src/efx-paint/compositor/` | NEW. The deterministic internal compositor: document fallback → Background clip → participating Paint tracks (hide/solo truth table) → per-track real/generated/cached content → stable-order composite with per-track opacity/blend → one flattened raster + composite revision. **One shared path for Studio preview and flattened output.** | **New** |
| `app/src/efx-paint/background/` | NEW. Fixed Background track model: one row beneath Paint tracks, non-overlapping clips, gaps/fallback, imported still/sequence source refs. Reuses the existing Loop Clip resolver. | **New** |
| `app/src/efx-paint/photo-reference/` | NEW. One photo/reference track: source reference, mode (`reference-only`/`reveal-source`/`masked-transform-source`), Studio visibility, exclusion from flattened output. | **New** |
| `app/src/efx-paint/mask/` | NEW. Shared mask compositor + Reveal: offscreen source-plus-mask compositing, alpha-vs-luma interpretation, optional inversion, revision invalidation. | **New** |
| `app/src/stores/physicPaintStore.ts` | Track-local Roto/PlayScript state. Extend the `Map<layerId, Map<number, T>>` pattern to `Map<layerId, Map<trackId, Map<number, T>>>`. Keep the counter-signal + lease-authority pattern. | **Modified** |
| `app/src/stores/paintStore.ts` | Track-local Paint frames. Same `layerId → trackId → frame` extension. | **Modified** |
| `app/src/lib/physicPaintBridge.ts` | Launch context + all request/result listen branches. Add document/track revision to messages; async PlayScript/Reveal revalidate parent+document+track revision before commit. | **Modified** |
| `app/src/lib/previewRenderer.ts` | Main-editor parent-layer compositor. **Unchanged boundary** — it consumes one flattened raster per frame via the existing `resolvePhysicPaintFrameSource`/`getFrame` path. No internal-track iteration. | **Unmodified** (reads new flattened output) |
| `app/src/lib/physicPaintPersistence.ts` + `app/src/types/project.ts` | `.mce` v1.0 document schema + PNG sidecars. Clean break: pre-v1.0 Paint data rejected explicitly, no legacy reader/renderer/cache path reachable. | **Modified** |
| `app/src/stores/projectStore.ts` | Save/open flow. Save the v1.0 document (staging/commit transaction); on open, reject pre-v1.0 Paint data explicitly. | **Modified** |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` + `useRotoTimelineModel.ts` | Multi-row internal timeline: N Paint rows + one fixed Background row + one photo/reference row, filmstrip capsules, active-track visibility. | **Modified** |
| `app/src/components/physic-paint/audio/efxPaintAudioPreview*` | Read-only audio preview. **Reuse v0.9.0 Phase 41 as-is** — the spec's audio requirements are a subset of the Phase 41 contract. | **Unmodified** |
| `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` + `physicsPaintRotoLoopClips.ts` | Loop Clip resolver (modulo, finite/infinite, next-clip interruption, half-open intervals). **Reuse verbatim** for Background clips (`sourceKind: 'imported-background'`) and Hold clips (`sourceKind: 'playscript-hold'`). | **Modified** (track-local addressing) |
| Main-editor sequence/layer model (`timelineStore`, `layerStore`, `audioStore`, `playbackEngine`) | Outer stack, timing, audio, export. **Unchanged** per the ownership boundary. | **Unmodified** |

## Recommended Project Structure (new files only)

```
app/src/
├── efx-paint/                        # NEW — v1.0.0 EFX Paint document domain
│   ├── document/                     # pure model + parsers + revision
│   │   ├── efxPaintDocument.ts       #   EfxPaintDocument / InternalPaintTrack / PhotoReferenceTrack / BackgroundTrack / FrameLoopClip
│   │   ├── efxPaintDocumentParsers.ts # fail-closed guards (isEfxPaint* pattern)
│   │   ├── efxPaintDocumentRevision.ts # document/track/composite revision builders
│   │   └── efxPaintCleanBreak.ts     #   explicit pre-v1.0 rejection
│   ├── compositor/                   # one shared internal composition path
│   │   ├── efxPaintCompositor.ts     #   fallback → Background → Paint tracks → flattened raster
│   │   ├── efxPaintHideSolo.ts       #   hide/solo truth table (pure)
│   │   └── efxPaintCompositeCache.ts #  track-revision-keyed cache
│   ├── background/                   # fixed Background track
│   │   ├── efxPaintBackgroundTrack.ts #  one row, non-overlapping clips, gaps/fallback
│   │   └── efxPaintBackgroundLoop.ts #  Background clip resolution (reuses Loop Clip resolver)
│   ├── photo-reference/
│   │   └── efxPaintPhotoReference.ts #  source ref + mode + Studio visibility
│   └── mask/
│       ├── efxPaintMaskCompositor.ts #  offscreen source-plus-mask compositing
│       └── efxPaintReveal.ts         #  Reveal semantics (alpha/luma, inversion)
├── stores/
│   ├── efxPaintStore.ts              # NEW — document store (signals)
│   ├── physicPaintStore.ts           # MOD — track-local Roto/PlayScript state
│   └── paintStore.ts                 # MOD — track-local Paint frames
├── lib/
│   ├── physicPaintBridge.ts          # MOD — document/track revisioned messages
│   ├── physicPaintPersistence.ts     # MOD — v1.0 document + sidecars, clean break
│   └── previewRenderer.ts            # UNMODIFIED — consumes one flattened raster
└── components/physic-paint/
    ├── view/
    │   ├── PhysicsPaintWorkflowStrip.tsx  # MOD — multi-row timeline
    │   └── useRotoTimelineModel.ts        # MOD — track rows + capsules
    └── roto/
        ├── physicsPaintRotoPhysicalResolver.ts  # MOD — track-local + shared Loop Clip resolver
        └── physicsPaintRotoLoopClips.ts         # MOD — track-local addressing
```

### Structure Rationale

- **`efx-paint/` as a new top-level domain folder:** the v1.0.0 document is a distinct domain (document model, compositor, background, photo-reference, mask) that must not be entangled with the existing `physic-paint/` component tree. It mirrors the existing decomposition discipline (compact focused modules, pure model + fail-closed parsers) while keeping the new document boundary explicit.
- **`document/` pure model separate from `stores/`:** the model is serializable and testable without Preact; the store adds reactivity. This matches the existing `physicsPaintRotoPhysicalModel.ts` (pure) vs `physicPaintStore.ts` (reactive) split.
- **`compositor/` as its own folder:** the internal compositor is the milestone's keystone — one shared path for Studio preview and flattened output. It must be importable by both the Studio surface and the persistence/export path without pulling in UI.
- **`background/` and `photo-reference/` separate from `document/`:** each is a distinct track type with its own rules (Background: non-overlap + fallback; photo/reference: mode + exclusion). Keeping them separate prevents the document model from becoming a god-object.
- **`mask/` separate:** Reveal is a Phase 8 capability layered on the compositor; isolating it keeps the Phase 4 compositor stable and independently testable.
- **Reuse `physicsPaintRotoLoopClips.ts` rather than a new Background loop module:** the resolver already implements the spec's exact loop formula. A second scheduler would duplicate the off-by-one risk the spec's risk register calls out.

## Architectural Patterns

### Pattern 1: One parent layer → one document → many tracks → one flattened result (the invariant)

**What:** Every parent Paint layer owns exactly one `EfxPaintDocument`. The document owns all internal tracks, the Background track, the photo/reference track, and the mask compositor. For every application frame, the internal compositor produces exactly one flattened raster, published through the existing parent Paint-layer boundary. The main editor composites that parent raster exactly once with the unchanged outer layer stack.

**When to use:** Always — this is the locked architectural invariant. Any design that leaks internal tracks into the main-editor sequence/layer model violates the spec.

**Trade-offs:** The main editor cannot edit internal tracks directly (by design). All multi-track editing happens inside the EFX Paint window. This is the correct trade-off: it keeps the main editor unchanged and the flattened-result contract simple.

**Example:**
```typescript
// app/src/efx-paint/document/efxPaintDocument.ts (NEW)
export interface EfxPaintDocument {
  version: number;              // 1
  parentLayerId: string;
  documentRevision: number;
  activeTrackId: string;
  tracks: InternalPaintTrack[]; // stable IDs, never array indices
  photoReference: PhotoReferenceTrack | null;
  background: BackgroundTrack;
  compositeRevision: number;
}
```

### Pattern 2: Track-local addressing — `layerId → trackId → frame`

**What:** Extend the existing `Map<string, Map<number, T>>` store pattern (already used by `physicPaintStore` and `paintStore`) to `Map<layerId, Map<trackId, Map<number, T>>>`. Keep the counter-signal pattern (`paintVersion`/`rotoPhysicalRevision`-style) for controlled re-renders; never make the Maps reactive.

**When to use:** For all track-local Paint/Roto/PlayScript frames, caches, and dirty state (Phase 2).

**Trade-offs:** One extra key level per lookup. Negligible for the frame counts involved; the alternative (a flat `layerId → frame` map with track tags) breaks the real-key/cache boundary and makes track deletion orphan-prone.

**Example:**
```typescript
// app/src/stores/physicPaintStore.ts (MOD)
const _rotoRealKeyRecords = new Map<string, Map<string, Map<string, PhysicPaintRotoRealKeyRecord>>>();
// layerId → trackId → keyId → record
```

### Pattern 3: Revision-based async authority (parent/document/track)

**What:** Every async PlayScript/Reveal operation revalidates parent layer revision, document revision, AND track revision before commit. Stale work fails closed. This is the established Phase 36.8/43.2 lease pattern, extended with the document and track revision levels.

**When to use:** For all async operations that mutate track state (PlayScript apply, Reveal, Background clip import, Hold Loop creation).

**Trade-offs:** More revision fields to thread through bridge messages. Necessary: the spec's risk register lists "stale async job commits to wrong track" as a data-corruption risk.

**Example:**
```typescript
// app/src/lib/physicPaintBridge.ts (MOD)
export interface PhysicPaintRotoAuthorityRequest {
  operationId: string;
  layerId: string;
  documentRevision: number;  // NEW
  trackId: string;           // NEW
  trackRevision: number;     // NEW
  // ...existing fields
}
```

### Pattern 4: One shared internal composition path (Studio preview + flattened output)

**What:** The internal compositor is a single module used by both the Studio preview surface and the flattened-output/persistence path. There is never a second composition path. The main renderer never iterates internal tracks.

**When to use:** Always — the spec's stop condition "Studio and parent flattened output differ" is only satisfiable if both consume the same compositor.

**Trade-offs:** The compositor must be UI-free (no Preact imports) so persistence/export can call it. This is a clean separation, not a cost.

**Composition order (per application frame, from spec Phase 4):**
1. Resolve the document fallback: solid background or transparency.
2. Resolve the fixed Background track clip at the frame (modulo source mapping, finite/infinite repeat, gaps, next-clip interruption).
3. Composite the Background contribution beneath all internal Paint tracks.
4. Resolve each participating internal Paint track.
5. Apply the internal hide/solo truth table.
6. Resolve real/generated/cached track frame content and linked Hold Loop occurrences.
7. Composite Paint tracks in stable order.
8. Apply internal track opacity and blend mode.
9. Produce one flattened raster and composite revision.
10. Publish/persist that raster through the existing parent Paint-layer boundary.
11. Let the main editor apply parent transform, opacity, blend, outer ordering, motion blur, transitions, preview, and export exactly once.

### Pattern 5: Linked source-frame references + modulo resolver (no duplicated assets)

**What:** Hold and Background loops share one Loop Clip resolver: `sourceIndex = (applicationFrame - startFrame) mod cycleLength`, `requestedDuration = finite ? cycleLength × repeatCount : infinity`, `boundary = min(nextClipStart, parentEnd)`, `effectiveDuration = min(requestedDuration, boundary - startFrame)`. Repetitions reuse linked source-frame references; durable images are never duplicated.

**When to use:** For all Hold and Background Loop Clips. The resolver already exists in `physicsPaintRotoPhysicalResolver.ts`/`physicsPaintRotoLoopClips.ts` — reuse it verbatim with `sourceKind` distinguishing `playscript-hold` from `imported-background`.

**Trade-offs:** Effective duration is derived, not stored. Requested repeat count is authoritative and stored. This is the spec's explicit rule.

### Pattern 6: Staging/commit persistence transaction

**What:** Persist the v1.0 document through the existing staging/commit transaction pattern (`publishPhysicPaintCacheGeneration`/`settlePhysicPaintCacheGeneration` in `physicPaintPersistence.ts`). Undo snapshots metadata and asset references, never large PNG bytes.

**When to use:** For all v1.0 document saves and undo/redo operations.

**Trade-offs:** Slightly more ceremony than a direct write. Necessary: the spec's memory rule and the clean-break contract.

### Pattern 7: Real-key/cache boundary per track

**What:** Durable real keys and accepted local assets are authoritative; generated interpolation/caches are rebuildable. This boundary is preserved per track. Generated cache absence must never be confused with a missing real key.

**When to use:** For all track-local Roto/PlayScript state.

**Trade-offs:** Cache regeneration must produce the same flattened output (spec acceptance). The existing `_tryRegenerateGeneratedRotoCache` pattern already guarantees this.

### Pattern 8: Clean-break document boundary

**What:** v1.0.0 is a clean format break. Pre-v1.0 Paint data is rejected explicitly — no legacy schema reader, no converter, no compatibility shim, no old-project renderer, no second cache/history path. Every new v1.0 document starts with one default Paint track, one fixed Background track, and the configured fallback.

**When to use:** Always — the spec's clean-break contract. The old one-track renderer and old Paint persistence path are deleted or made unreachable.

**Trade-offs:** Existing Paint projects are discarded or recreated by the user. This is the locked spec decision (project convention: no backward compat for old projects).

## Data Flow

### Per-frame flattened output (the core flow)

```
Application frame F
        ↓
efxPaintCompositor.compositeFrame(document, F)
        ↓
1. document fallback (solid | transparent)
        ↓
2. Background track: resolve clip at F
   (modulo source mapping, finite/infinite repeat, gaps, next-clip interruption)
        ↓
3. composite Background beneath Paint tracks
        ↓
4. resolve each participating Paint track
        ↓
5. hide/solo truth table (no solo → all visible; solo → visible+soloed; hide wins)
        ↓
6. per-track real/generated/cached content + linked Hold Loop occurrences
        ↓
7. composite Paint tracks in stable order
        ↓
8. per-track opacity + blend mode (blendModeToCompositeOp)
        ↓
9. ONE flattened raster + compositeRevision
        ↓
10. publish through existing parent Paint-layer boundary
    (physicPaintStore.getFrame(layerId, F) — UNCHANGED consumer contract)
        ↓
11. main editor composites parent layer exactly once with outer stack
```

### Save/reopen (v1.0 document)

```
Save:
  efxPaintStore.toMceDocument() → staging (publishPhysicPaintCacheGeneration)
    → settlePhysicPaintCacheGeneration → .mce v1.0 document + PNG sidecars
  (projectStore.saveProject: savePaintData → savePhysicPaintDataWithProjectWrite)

Open:
  projectStore.openProject → loadPhysicPaintData(projectRoot, outputs)
    → if pre-v1.0 Paint data: FAIL EXPLICITLY (no partial mutation, no legacy renderer)
    → else: parse v1.0 document → efxPaintStore.loadFromMceDocument
```

### Async PlayScript/Reveal commit (track-scoped)

```
Studio action (active track T)
        ↓
requestAuthority({ layerId, documentRevision, trackId, trackRevision })
        ↓ (revalidate parent + document + track revision)
render staged frames (track-local)
        ↓
commit(publication, expectedRevision) → finalizeProposal (single authority)
        ↓
semantic delta on track T → documentRevision++ → compositeRevision++
        ↓
undo snapshot (metadata + asset refs, NOT PNG bytes)
```

### Loop resolution (Background clip)

```
Clip: start=0, cycle=5 images, repeat=3
cycleLength = 5
requestedDuration = 5 × 3 = 15
boundary = min(nextClipStart=15, parentEnd) = 15
effectiveDuration = min(15, 15 - 0) = 15
interval = [0, 15)  →  visible frames 0–14
sourceIndex = (F - 0) mod 5
```

## Scaling Considerations

Not user-count scaling (single-user desktop); the real constraints are frame counts, track count, and asset weight.

| Concern | Current behavior | v1.0.0 impact | Mitigation |
|---------|------------------|---------------|------------|
| Track count | n/a (one flat frame map per layer) | N internal tracks per document | Stable IDs + `layerId → trackId → frame` maps; track CRUD is O(tracks) not O(frames). No per-track render loop in the main editor. |
| Cache footprint | PNG sidecars per real key; compression deferred | Track-local caches multiply by track count; loop occurrences add ZERO sidecars | Reuse the real-key/cache boundary per track; occurrences reuse source payloads. Revisit compression separately. |
| Composite cost | One parent-layer composite per frame | One internal composite (N tracks) + one parent composite | The internal compositor is a single Canvas 2D pass; per-track cache keys include track revision + composition dependencies so unchanged tracks skip re-composite. |
| Async commit size | Bounded by `PHYSIC_PAINT_MAX_APPLY_FRAMES = 600` | Hold cycle bounded by cycle length, NOT requested duration | Enforce cycle-length capacity check at authority time; repeats are free (linked refs). |
| Bundle size | entry chunk near 1100 kB budget | New `efx-paint/` domain adds code | Keep the compositor UI-free and the document model pure; the 1100 kB budget + production bundle guard remain the correctness gate. |
| Undo memory | Metadata + asset refs (no PNG bytes) | Track-scoped undo snapshots | Reference-based history per track; never raster-byte snapshots. |

### Scaling Priorities

1. **First bottleneck:** composite cost with many tracks. Fix: per-track cache keys + skip unchanged tracks (the spec's "track cache key includes track revision and composition dependencies").
2. **Second bottleneck:** cache footprint with many tracks × many frames. Fix: loop occurrences reuse source payloads (zero sidecars); revisit PNG compression separately.

## Anti-Patterns

### Anti-Pattern 1: `Sequence.frameTracks` / internal tracks as main-editor rows

**What people do:** Add internal tracks to the main-editor sequence/timeline so they're visible in the main window.
**Why it's wrong:** Becomes an unrelated main-editor rewrite; can alter duration, outer layers, preview, and export. Explicitly forbidden by the spec.
**Do this instead:** Store every internal track only inside the parent Paint layer's EFX Paint document. The main editor sees one Paint layer result.

### Anti-Pattern 2: Direct main-renderer iteration over internal tracks

**What people do:** Have `previewRenderer.renderFrame` loop over internal tracks to composite them.
**Why it's wrong:** Breaks the one-flattened-result contract; the main renderer would need to know internal track semantics, hide/solo, and composition order.
**Do this instead:** The internal compositor produces one flattened raster; the main renderer consumes it via the existing parent-layer boundary (`resolvePhysicPaintFrameSource`/`getFrame`).

### Anti-Pattern 3: Duplicated durable assets for loop repetitions

**What people do:** Expand `5f × 3` into 15 staged frames "so the rest of the pipeline doesn't change."
**Why it's wrong:** Violates the locked spec (no duplicated durable images), breaks "edit source → all occurrences update," inflates cache/sidecar footprint, and makes repeat-count edits a re-render.
**Do this instead:** Linked source-frame references + modulo resolver; occurrences reuse source payloads.

### Anti-Pattern 4: Double-applied parent opacity/blend

**What people do:** Copy parent layer opacity/blend into internal tracks "for consistency."
**Why it's wrong:** The parent opacity/blend is applied once by the main editor after flattening; copying it internally double-applies the visual effect.
**Do this instead:** Internal track opacity/blend applied once inside EFX Paint; parent opacity/blend applied once by the main editor. Never copied.

### Anti-Pattern 5: Legacy one-track schema or renderer remains reachable

**What people do:** Keep the old Paint persistence path "just in case" or add a best-effort converter.
**Why it's wrong:** Unsupported old projects can enter a partially compatible state and force permanent dual maintenance. Explicitly forbidden by the clean-break contract.
**Do this instead:** Delete or make unreachable the old one-track renderer and old Paint persistence path; reject pre-v1.0 Paint data explicitly.

### Anti-Pattern 6: Track identity by array position

**What people do:** Use `tracks[index]` as the track address.
**Why it's wrong:** Reorder/history/cache corruption — the spec's risk register lists this as a data-corruption risk.
**Do this instead:** Stable IDs everywhere; reorder changes compositor order but not identity; duplicate creates fresh identities.

### Anti-Pattern 7: Two composition paths (Studio vs flattened)

**What people do:** A fast Studio preview path and a separate flattened-output path.
**Why it's wrong:** Studio and parent flattened output differ — a user-visible output mismatch and a spec stop condition.
**Do this instead:** One shared internal composition path for Studio preview and flattened output.

### Anti-Pattern 8: Photo/reference track leaking into output

**What people do:** Let reference visibility automatically enter the flattened output.
**Why it's wrong:** Reference-only photo pixels leak into output — a spec stop condition.
**Do this instead:** Explicit source mode (`reference-only`/`reveal-source`/`masked-transform-source`); reference visibility never automatically enters flattened output.

## Integration Points (new vs modified, explicit)

### Internal Boundaries

| Boundary | Communication | New/Modified | Notes |
|----------|---------------|--------------|-------|
| parent Paint layer → EFX Paint document | `EfxPaintDocument` owned by `parentLayerId`; persisted in `.mce` v1.0 | **New** | One document per parent layer; clean-break rejection of pre-v1.0 data |
| EFX Paint document → internal compositor | `efxPaintCompositor.compositeFrame(document, F)` → one flattened raster | **New** | One shared path for Studio preview and flattened output |
| internal compositor → main editor | existing parent-layer boundary (`physicPaintStore.getFrame(layerId, F)`) | **Unmodified** | Main renderer never iterates internal tracks |
| Studio surface → track-local stores | signals + `finalizeProposal` single authority | **Modified** | `layerId → trackId → frame` addressing; parent/document/track revision revalidation |
| async PlayScript/Reveal → document | bridge messages with `documentRevision` + `trackId` + `trackRevision` | **Modified** | Stale work fails closed |
| Background track → Loop Clip resolver | `sourceKind: 'imported-background'` (reuse `physicsPaintRotoLoopClips.ts`) | **Modified** | Same resolver as Hold clips; no second scheduler |
| photo/reference track → mask compositor | source ref + mode; Reveal = source pixels + Paint/PlayScript coverage alpha | **New** | Reference visibility never leaks into output |
| audio preview → multi-track playback | reuse v0.9.0 Phase 41 (`efxPaintAudioPreview*`) | **Unmodified** | All internal tracks share one application-frame cursor |
| persistence → `.mce` v1.0 | `physicPaintPersistence.ts` staging/commit transaction | **Modified** | Clean break; pre-v1.0 data fails explicitly |
| multi-row timeline → track model | `PhysicsPaintWorkflowStrip.tsx` + `useRotoTimelineModel.ts` | **Modified** | N Paint rows + one Background row + one photo/reference row |

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Image import (Background still/sequence, photo source) | Reuse `imageStore` LRU pool + `importImages` IPC + `efxasset://` transport | No new dependency; imported source assets remain local and authoritative after save/reopen |
| Audio preview | Reuse Phase 41 `efxPaintAudioPreviewStore`/`efxPaintAudioMonitor`/`efxPaintAudioOwnership` | Read-only revisioned context; no doubled playback engine |

## Suggested Build Order (answers question d)

```
Phase 1  New EFX Paint document + clean cutover        [document model, parsers, clean-break rejection]
Phase 2  Track-local Paint/Roto/PlayScript + caches     [layerId → trackId → frame addressing]
Phase 3  Internal multi-track timeline + controls       [multi-row strip, filmstrip capsules]
Phase 4  Internal compositor + flattened parent result  [one shared composition path]
Phase 5  Fixed Background track + imported Loop Clips    [reuse Loop Clip resolver]
Phase 6  Photo/reference track                          [source ref + mode + exclusion]
Phase 7  Read-only audio preview                        [reuse Phase 41 as-is]
Phase 8  Shared mask compositor + Reveal               [offscreen source-plus-mask]
Phase 9  Integrated v1.0.0 acceptance                   [automated gates + native UAT]
```

**Ordering rationale:**
- **1 before everything:** the document model and clean-break rejection are the foundation; every later phase addresses state inside the document. Deleting the legacy path first prevents any new feature from accidentally depending on it.
- **2 before 3:** the multi-row timeline shows frame keys/caches on the correct row — it needs track-local state to exist first.
- **3 before 4:** the compositor consumes track-local state and the hide/solo/opacity/blend controls that the timeline exposes.
- **4 before 5/6/8:** the flattened-result contract is the milestone's keystone; Background (5), photo/reference (6), and Reveal (8) all feed the same compositor. Landing the compositor first keeps each later track type a clean addition.
- **5 before 6:** the Background track and photo/reference track are distinct, but the Background track's Loop Clip resolver is the same machinery Reveal's source handling builds on.
- **7 is independent:** audio preview reuses Phase 41 as-is; it can land any time after the shared application-frame cursor exists (Phase 3).
- **8 last:** Reveal layers on the compositor (4), the photo/reference track (6), and Paint/PlayScript coverage (2). It is the deepest integration.
- **Hard dependency:** Phase 4's flattened output must be the ONLY path — do not build a Studio-only preview path in Phase 3 that Phase 4 has to replace.

## Sources

All findings from direct repository inspection + the locked spec (HIGH confidence):

- `SPECS/milestone-v1.0.0-plan.md` — architectural invariant, ownership boundaries, locked MVP scope, canonical document concept, identity/asset/history rules, clean-break boundary, composition order, loop resolution formula, forbidden sequence-level assumptions, risk register, 9-phase structure
- `app/src/stores/physicPaintStore.ts` — `Map<layerId, Map<number, T>>` pattern, counter-signal + lease-authority pattern, `toMceOutputs`/`loadFromMceOutputs`, `_rotoPhysicalStructuralCache` signal graph
- `app/src/stores/paintStore.ts` — single-track paint store, `paintVersion` signal, `pushAction` undo/redo
- `app/src/lib/previewRenderer.ts` — `renderFrame` signature, `resolvePhysicPaintFrameSource`, `collectPhysicPaintFrameSources`, `getPreviewPhysicPaintFrameCacheKey`, `blendModeToCompositeOp` (the parent-layer boundary the flattened raster flows through)
- `app/src/lib/physicPaintBridge.ts` — event constants, launch context, request/result listener patterns, authority request/result
- `app/src/lib/physicPaintPersistence.ts` — staging/commit transaction (`publishPhysicPaintCacheGeneration`/`settlePhysicPaintCacheGeneration`), `stableSegment` hashing
- `app/src/lib/paintPersistence.ts` — sidecar JSON at `paint/{layerId}/frame-NNN.json`
- `app/src/stores/projectStore.ts` — save/open flow (`savePaintData` → `savePhysicPaintDataWithProjectWrite`; `loadPhysicPaintData` → `loadPaintData`)
- `app/src/types/project.ts` — `.mce` v15 format, `physic_paint_outputs`, `McePhysicPaintRotoPhysicalDocument`, `McePhysicPaintRotoLoopClip`
- `app/src/types/physicPaint.ts` — `PhysicPaintRotoPhysicalDocumentPayload`, `PhysicPaintLaunchContext`, `EfxPaintAudioPreviewContext`
- `app/src/types/paint.ts`, `app/src/types/layer.ts` — `PaintFrame`, `LayerType` (`'paint'`/`'physic-paint'`), `BlendMode`
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` — canonical keyId/appFrame records, revision builder, fail-closed parsers
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` + `physicsPaintRotoLoopClips.ts` — Loop Clip resolver (modulo, finite/infinite, next-clip interruption, half-open intervals)
- `app/src/components/physic-paint/audio/efxPaintAudioPreviewStore.ts` + `efxPaintAudioMonitor.ts` + `efxPaintAudioOwnership.ts` — v0.9.0 Phase 41 read-only audio preview (reuse as-is)
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` + `hooks/useRotoTimelineModel.ts` — Canvas 2D Roto strip + filmstrip capsule (multi-row extension point)
- `app/src/stores/imageStore.ts` — LRU image/sequence pool (Background/photo import reuse)

---
*Architecture research for: EFX Motion Editor v1.0.0 — multi-track EFX Paint document, internal compositor, Background track, photo/reference track, Reveal mask compositor*
*Researched: 2026-08-23*
