# Phase 46: Track-local Paint/Roto/PlayScript State, Loop Clips, and Caches - Pattern Map

**Mapped:** 2026-08-23
**Files analyzed:** 10 (5 modified code, 5 new tests)
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/src/stores/physicPaintStore.ts` | store | state / CRUD | itself (re-key target) + `efxPaintStore.ts` (signal pattern) | exact (self) |
| `app/src/stores/efxPaintStore.ts` | store | transform / CRUD (serialize-hydrate) | itself (relax single-track guard) | exact (self) |
| `app/src/lib/physicPaintBridge.ts` | bridge / middleware | request-response / async | itself (authority pattern) | exact (self) |
| `app/src/lib/efxPaintPersistence.ts` | utility / service | file-I/O | itself (cache-path scheme) | exact (self) |
| `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` | hook / ledger | event-driven (undo/redo) | itself (10-level ledger) | exact (self) |
| `app/src/stores/physicPaintStore.test.ts` | test | state / isolation | itself (existing test, extend) | exact |
| `app/src/stores/efxPaintStore.test.ts` | test | transform / projection | `efxPaintStore.test.ts` (existing) | exact |
| `app/src/lib/physicPaintBridgeAuthority.test.ts` | test | async authority | `physicPaintBridge.test.ts` (existing) | role-match |
| `app/src/stores/trackDeleteLaws.test.ts` | test | store laws | `physicPaintStore.test.ts` | role-match |
| `app/src/stores/efxPaintTrackCache.test.ts` | test | cache invalidation | `physicPaintStore.rotoPhysicalStructuralCache.test.ts` | role-match |
| `app/src/stores/trackIsolation.test.ts` | test | isolation | `physicPaintStore.rotoLoopClips.test.ts` | role-match |

**Reused verbatim (NO change — do not fork):**
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` — `resolvePhysicPaintRotoLoopFrame` (Hold scheduler, `linked-unresolved` fail-closed)
- `app/src/efx-paint/document/efxPaintDocument.ts` — already track-shaped document model
- `app/src/efx-paint/document/efxPaintDocumentRevision.ts` — `buildEfxPaintDocumentRevision` / `buildEfxPaintTrackRevision` / `buildEfxPaintCompositeRevision`
- `app/src/efx-paint/document/efxPaintDocumentParsers.ts` — fail-closed parser (already multi-track; duplicate-ID check exists)

---

## Pattern Assignments

### `app/src/stores/physicPaintStore.ts` (store, state/CRUD)

**Analog:** itself — this is the sole runtime owner; re-key every `Map<layerId, …>` to `Map<layerId, Map<trackId, …>>` and split the two global counters into a per-track signal map.

**Current single-dimension store shape to re-key** (lines 39, 122-152, 249):
```typescript
// physicPaintStore.ts:39
export const physicPaintVersion = signal(0);
// physicPaintStore.ts:122-152 — each currently Map<layerId, T>:
const _frames = new Map<string, Map<number, PhysicPaintRenderedFrame>>();
const _rotoRealKeyRecords = new Map<string, Map<string, PhysicPaintRotoRealKeyRecord>>();
const _rotoPhysicalInterpolationState = new Map<string, PhysicPaintRotoInterpolationState>();
const _rotoPhysicalLoopClips = new Map<string, readonly PhysicPaintRotoLoopClip[]>();
const _rotoPhysicalOperationLeases = new Map<string, PhysicPaintRotoPhysicalOperationLeaseToken>();
export const rotoPhysicalRevision = signal(0);   // physicPaintStore.ts:152 — single global, MUST split
```
**Target per-track signal map** (RESEARCH Pattern 1 — per-track granular reactivity, Pitfall 4):
```typescript
export const physicPaintVersion = signal(0);   // keep as global event clock (bump on ANY mutation)
const trackRevisions = new Map<string, { paint: Signal<number>; roto: Signal<number> }>();
export function bumpTrackRevision(layerId: string, trackId: string): void {
  const entry = trackRevisions.get(trackId);
  if (entry) { entry.paint.value++; entry.roto.value++; }
  physicPaintVersion.value++;
  _rotoPhysicalStructuralCache.delete(layerId); // clear structural memo
}
```
**Do NOT conflate** the runtime `Signal<number>` counters with the durable `InternalPaintTrack.revision` / `FrameLoopClip.revision` hash fields (`efxPaintDocument.ts:56,36`) — those are `buildEfxPaintTrackRevision` outputs (Pitfall 4, RESEARCH note).

**Version/notify convention to preserve** (line 457 `_notifyVisualChange`): every mutation bumps `physicPaintVersion` AND fires `_markProjectDirty` — the "always bump AND subscribe" rule.

**Lease-token pattern to extend with `trackId`** (lines 43-48, 198-219): the operation-lease identity is `projectContextId + layerId + generation`; Phase 46 adds `trackId`. `_validateRotoPhysicalLayerPublication` (line 198) is the fail-closed stale/missing/mismatched token authority — extend it to include the track dimension for D-19/D-20.

---

### `app/src/stores/efxPaintStore.ts` (store: transform / serialize-hydrate)

**Analog:** itself — relax the single-track guard at lines 82 and 118; keep document authority + signal pattern.

**Signal/notify pattern to keep** (lines 29-36):
```typescript
export const efxPaintVersion = signal(0);
const _documents = new Map<string, EfxPaintDocument>();
function _notifyChange(): void { efxPaintVersion.value++; _markProjectDirty?.(); }
```

**THE single-track guards to relax** (lines 82-84 and 118-120) — the ONLY hard blocker to multi-track runtime (RESEARCH "Deprecated/outdated"):
```typescript
// efxPaintStore.ts:82-84 — THROWS on multi-track today
if (document.tracks.length !== 1 || document.tracks[0].id !== document.activeTrackId) {
  throw new Error(`EFX Paint document for layer "${layerId}" must have exactly one default Paint track.`);
}
const track = document.tracks[0];
```
Both `serializeRuntimeIntoDocument` (line 79) and `hydrateRuntimeFromDocument` (line 114) must iterate `document.tracks` **by `id`** (never `tracks[0]`, Pitfall 1) and project track-scoped runtime per track. The projection shape is `EfxPaintRuntimeProjection` (frames + rotoPhysical) — extend it to carry `trackId`.

**Frame sidecar projection** (lines 87-94) now keys off the track's `frames`; `buildEfxPaintFrameCachePath(layerId, frame)` gains a `trackId` argument (see persistence file below).

### `app/src/lib/physicPaintBridge.ts` (bridge, request-response + async authority)

**Analog:** itself — extend the authority request/result contract with `documentRevision + trackId + trackRevision`; keep the fail-closed `'Roto authority became stale'` pattern (line 353).

**The three-dimension fail-closed authority commit gate** (lines 345-353) — the pattern to extend (D-19/D-20):
```typescript
if (payload.projectContextId && payload.frameCount !== undefined && payload.expectedLayerEndExclusive !== undefined && payload.expectedRotoRevision) {
  const authority = getPhysicPaintRotoAuthority({
    operationId: payload.operationId, projectContextId: payload.projectContextId,
    layerId: payload.layerId, canonicalStart: payload.startFrame,
  });
  if (!authority.ok) return applyFailureResult(payload, authority.error ?? 'Roto authority rejected the batch.');
  if (authority.layerEndExclusive !== payload.expectedLayerEndExclusive || authority.rotoRevision !== payload.expectedRotoRevision)
    return applyFailureResult(payload, 'Roto authority became stale before commit.');
  ...
}
```

**The authority result `failure(...)` closed shape** (lines 444-462): a closure that returns a fail-closed result with zeroed capacity/empty frames on any mismatch. Add `trackId`/`trackRevision`/`documentRevision` to `PhysicPaintRotoAuthorityRequest` and the result; revalidate parent (`projectContextId !== projectStore.projectContextId.peek()`, line 463), then document, then track (lines 463-466). Also add `trackId` to `extractAuthorityEnvelopeFields` (line 523) and the strict `isPhysicPaintRotoAuthorityRequest` gate.

**Capture-then-revalidate rule (D-19/D-20):** the async commit path must read the CAPTURED `trackId`/revisions from the authority, never `activeTrackId` at commit time (Pitfall 2). On any mismatch or missing track → `applyFailureResult`, no partial write.

### `app/src/lib/efxPaintPersistence.ts` (utility/service, file-I/O)

**Analog:** itself — the PNG sidecar scheme; add `trackId` to `buildEfxPaintFrameCachePath`.

**The cache-path builder to extend** (lines 87-92) — MUST embed `trackId` between the stable segment and the file name for D-15 sidecar deletion:
```typescript
export function buildEfxPaintFrameCachePath(
  layerId: string,
  frame: Pick<PhysicPaintRenderedFrame, 'appFrame' | 'frameIndex'>,
): string {
  return `${EFX_PAINT_CACHE_DIR}/${stableSegment(layerId)}/${frameFileName(frame)}`;
}
```
**Target:** `cache/efx-paint/<stableSegment(layerId)>/<trackId>/frame-N.png`.

**Prefix-locked guard to reuse on EVERY cache path incl. trackId** (lines 121-125, ASVS V12):
```typescript
export function isSafeEfxPaintCachePath(cachePath: unknown): cachePath is string {
  if (typeof cachePath !== 'string' || !cachePath.startsWith(`${EFX_PAINT_CACHE_DIR}/`)) return false;
  if (cachePath.includes('\\') || cachePath.startsWith('/') || cachePath.includes('\0')) return false;
  return cachePath.split('/').every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}
```

**Two-resource transaction to reuse for D-15 delete** (lines 252-275 `settlePreparedEfxPaintSave`): the `.efx-paint-staging-<uuid>` basename (line 30) + `publishPhysicPaintCacheGeneration` + `settlePhysicPaintCacheGeneration(action: 'commit'|'rollback')`. Track-sidecar removal in D-15 goes through this transaction with the `trackId`-prefixed paths, never an ad-hoc `rm` (Pitfall 7).

**Save/load iterators already track-aware** (lines 203-216 save, 325-346 load): they already loop `for (const track of document.tracks)` — only `trackId` needs embedding in the `cachePath` written into `frames[].cachePath`. Open question Q1 (recompute path on save) must be specified in the Plan.

### `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` (hook/ledger, event-driven)

**Analog:** itself — add a `trackId` tag to each entry identity and snapshot; keep the 10-level cap and reference-based snapshot shape (D-01..D-04).

**The identity to extend with `trackId`** (lines 81-86):
```typescript
export interface RotoPhysicalEditHistoryIdentity {
  launchOperationId: string;
  layerId: string;
  projectContextId: string | null;
  capacity: number;
  // + trackId: string   <-- Phase 46 (D-01 unified stack, each entry tagged with its mutating track)
}
```

**Command entry shape to add `trackId` to** (lines 109-118): `RotoPhysicalEditCommand` carries `operationId`/`operationKind`/`before`/`after`/`acceptedRevision`/`selectedKeyId`/`selectedAppFrame`; the snapshot (`RotoPhysicalEditSnapshot`) is refs + revision hash — NO raster bytes (D-03, Pitfall 17 verified).

**The exact 10-level cap eviction** (lines 503-507):
```typescript
const trimAppliedHistory = useCallback(() => {
  if (appliedRef.current.length <= 10) return;
  const evicted = appliedRef.current.splice(0, appliedRef.current.length - 10);
  releaseReferencedEntries(evicted, 'eviction');
}, [releaseReferencedEntries]);
```

**Replay-through-coordinator authority (D-01/D-04) to mirror:** `undo()` (line 663) validates current state equals the command's `after` side via `snapshotReplayAuthorityEqual`, then calls `coordinator.executePhysicalEdit({ operationKind: 'undo', historyProvenance: {...} })` (lines 705-718). Phase 46 adds a track authority check: replay only pops/auto-activates the entry's `trackId`; a non-active target auto-activates (D-04). `recordAcceptedEdit` (line 562) dedupes by `operationId` — add `trackId` so a cross-track edit never collides.

---

## Shared Patterns

### Per-track revision signal map (Pitfall 4 — global-counter over-subscription)
**Source:** `physicPaintStore.ts:39,152` (current single global counters) → split per RESEARCH Pattern 1.
**Apply to:** all `physicPaintStore` track mutations.
```typescript
export const physicPaintVersion = signal(0);                              // global clock
const trackRevisions = new Map<string, { paint: Signal<number>; roto: Signal<number> }>();
// bumpTrackRevision(layerId, trackId): bump per-track signals + global clock + clear structural memo
```

### Fail-closed parsing (ASVS V5 — duplicate track IDs)
**Source:** `app/src/efx-paint/document/efxPaintDocumentParsers.ts:34,158,263`
**Apply to:** any untrusted document/track payload read path. Already rejects duplicate track IDs (lines 292-298) and dangling `activeTrackId` (299-301). Never allocate IDs in the parser.
```typescript
const seenTrackIds = new Set<string>();
for (const track of tracks) {
  if (seenTrackIds.has(track.id)) throw new Error(`EfxPaintDocument: duplicate track id "${track.id}".`);
  seenTrackIds.add(track.id);
}
if (!tracks.some((track) => track.id === value.activeTrackId)) { /* throw dangling-active */ }
```

### Hold linked-source resolution (TRK-08, D-10..D-13) — reuse, do NOT fork
**Source:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:5570`
`resolvePhysicPaintRotoLoopFrame(context, appFrame)` returns kinds `'real' | 'linked' | 'linked-generated' | 'linked-gap' | 'linked-unresolved' | 'empty'` (lines 5306-5342). The `'linked-unresolved'` state (line 5611) IS the D-13 fail-closed source-missing behavior. Hold clips are `FrameLoopClip` with `sourceKind: 'playscript-hold'` (`efxPaintDocument.ts:35`) — pass the track's loopClips into the resolver; never build a second scheduler.

### Fresh-identity paste (D-05/D-06/D-07)
**Source:** `app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts` — `buildRotoRailSetCopyPayload` (line 188) allocates `createPhysicPaintRotoKeyId()` fresh identities; `RotoRailSetFreshIdentityAllocation` (line 90) prescribes fresh keyId → fresh loopId. Re-point Hold `sourceFrameRefs` to the destination track's copied source frames; if impossible → reject explicitly (D-06), never a cross-track/foreign reference.

### Cache transaction publish/settle (D-15, A5)
**Source:** `src/lib/efxPaintPersistence.ts:284-275` (two-resource stage→publish→settle) + `src/lib/ipc.ts` `publishPhysicPaintCacheGeneration`/`settlePhysicPaintCacheGeneration`. Apply to D-15 track-sidecar deletion.

### Test structure (new test files)
**Analog:** `src/stores/efxPaintStore.test.ts` (lines 1-47).
```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
// ...import store symbols...
beforeEach(() => { reset(); _setEfxPaintMarkDirtyCallback(() => {}); });
const makeFrame = (frameIndex: number, appFrame: number): PhysicPaintRenderedFrame => ({...});
```
**Run command (CLAUDE.md):** `pnpm --filter efx-motion-editor exec vitest run <file>` — never watch mode.

## No Analog Found

All Phase 46 files have exact/self or existing in-repo analogs — there are NO new external dependencies and no greenfield modules. Every "deceptively complex" primitive (resolver, history, authority, cache transaction, revision builder) already exists with tests and is REUSED, not rebuilt (RESEARCH Don't Hand-Roll table). The 5 new test files map to existing test files as analogs listed above.

## Metadata

**Analog search scope:** `app/src/stores/`, `app/src/lib/`, `app/src/efx-paint/document/`, `app/src/components/physic-paint/hooks/`, `app/src/components/physic-paint/roto/`
**Files scanned:** 10 (5 mod + 5 new)
**Pattern extraction date:** 2026-08-23
**Key risk (planner):** sequence the `physicStore` re-key so a half-track-scoped runtime never lands against the still-single-track Phase 45 `efxPaintStore` serializer — relax the two guards (82/118) in the same wave as the store re-key (RESEARCH primary recommendation).
