---
phase: 46-track-local-paint-roto-playscript-state-loop-clips-and-cache
reviewed: 2026-08-24
depth: standard
files_reviewed: 65
status: issues_found
---

# Phase 46 Review — track-local paint/roto/playscript state, loop clips, and cache

- **Phase**: 46-track-local-paint-roto-playscript-state-loop-clips-and-cache
- **Review depth**: standard
- **Diff base**: `65e7757b` (docs(46): create phase plan) → `HEAD` (milestone/v1.0.0)
- **Date**: 2026-08-24
- **Verification**: full app suite green (148 files, 2794 passed, 1 skipped, 101 todo), `pnpm --dir app run typecheck` clean. Phase core suites re-run: trackIsolation (30), trackDeleteLaws (15), efxPaintTrackCache (8), physicPaintBridgeAuthority (9), rotoPhysicalStructuralCache (14), efxPaintMultiTrackProjection (5) — 81/81 green.

## Scope reviewed

All phase-46 source diffs: `physicPaintStore.ts` (re-key, leases, per-track revision signals, structural memo, teardown, copy/cut/paste/move, Hold context + refs validation), `physicPaintBridge.ts` (3-dim authority, commit gate, apply paths), `efxPaintStore.ts`, `efxPaintPersistence.ts`, `useRotoPhysicalEditHistory.ts`, `physicsPaintRotoRailSetCopy.ts`, the eight roto hooks, `rotoLaunchHydration.ts`, `rotoSaveTransactions.ts`, `projectStore.ts` (save funnel), `sequenceStore.ts`, `frameMap.ts`, `previewRenderer.ts`, `exportEngine.ts`, `PhysicPaintProperties.tsx`, `types/physicPaint.ts` validators, `efxPaintDocumentRevision.ts`, and the new/updated test suites (trackIsolation, trackDeleteLaws, efxPaintTrackCache, physicPaintBridgeAuthority, efxPaintMultiTrackProjection, TimelineRenderer, LoopClipRail, rotoSaveTransactions, playscript bridge, session, rotoFrameDraw, physicPaint types).

## Summary

The phase delivers on its 6 laws. The re-key is structurally sound: 16 runtime maps addressed layerId → trackId, one composite-key structural memo per (layer, track) deleted by the single `bumpTrackRevision` invalidation point, track-scoped leases with trackId in the scope string, a captured-track commit gate in the authoritative replace-roto-key-frames path, per-track undo ledger dedupe with raster-stripped snapshots, and fail-closed track deletion with sidecar removal riding the save transaction. Tests are behavior-level and unusually honest (they document the optional-term semantics explicitly). Verification of the full branch is green.

Five findings follow: one genuine (but narrow) track-identity gap in two apply-time paths, one misleading API, one unreachable fallback that is latent-hazardous, one naming smell, and three test-coverage gaps. None block closure; the first is worth a small follow-up fix.

## Findings

### F-01 — LIVE activeTrackId resolved at apply time in two bridge paths (track identity, MEDIUM-LOW)

`app/src/lib/physicPaintBridge.ts`:

- `applyPhysicPaintRotoGroupFramePaint` (≈line 1859): `const requestTrackId = getEfxPaintDocument(request.layerId)?.activeTrackId ?? '';` — the document read and the `replaceRotoPhysicalDocument` write target the **live** active track at apply time.
- `applyCommittedReferencedActionDeletion` (≈line 2122): identical pattern for the undo/redo committed-action deletion.

Both paths already hold the captured identity: the operation lease token carries `trackId` (acquired at launch against the then-active track), and the lease validation passes `input.leaseToken?.trackId`. The document read/replace should prefer `leaseToken.trackId` (fall back to the document's active track only when no token is present) — or carry `trackId` in the group-frame-paint request surface, which currently has none (`PHYSIC_PAINT_ROTO_GROUP_FRAME_PAINT_REQUEST_KEYS` unchanged).

**Failure mode**: a mid-flight active-track switch (or delete-then-repoint) between launch and apply re-routes the apply to the new track under the old track's lease. The `currentDocument.revision !== expectedRevision` guard fails closed in the general case, but two tracks with byte-identical content (two empty tracks, or two identical documents) have equal revisions — in that narrow window the paint/commit lands on the wrong track and the store's lease check cannot detect it (the store validates the lease against the trackId argument it is given, never the caller's intent).

Contrast: the 46-04 gate path (`replace-roto-key-frames`) is correctly captured — `payload.trackId`, never the live active track. These two paths are the only live-resolves left in the phase.

### F 02 — `getTrackPaintVersion` / `getTrackRotorRevision` ignore the layerId parameter (LOW)

`app/src/stores/physicPaintStore.ts:71-78`: both functions key the revision entry by `trackId` only and discard `_layerId`. Safe today only because track ids are UUIDs (no cross-layer collision), but the API invites a caller to pass the wrong layer and receive a plausible answer. Drop the parameter or validate it. (The same lazily-recreated-on-read entry is documented in the trackIsolation teardown test.)

### F 03 — Commit gate terms are silently optional (INFO)

`types/physicPaint.ts` allows `expectedTrackRevision`/`expectedDocumentRevision` to be `undefined`, and the gate (`physicPaintBridge.ts` replace-roto-key-frames arm) skips each check when absent. The optionality is deliberate ("construction-only test fixtures") and the tests document the semantics explicitly (trackIsolation test 922 and bridgeAuthority test 367 omit the document term and rely on the track term only). No finding on the design itself — but nothing enforces that real children always send both terms; a future caller can silently degrade the 3-dim gate to 1-dim. Consider making the strictness part of the child's contract comment (e.g. in `useRotoPlayScriptController`) or requiring the fields when `expectedRotoRevision` is present.

### F 04 — `commitDeleteTrack` nearest-adjacent fallback is unreachable and latent-hazardous (INFO)

`app/src/stores/efxPaintStore.ts` (~line 220): `projectedTracks[deletedIndex]?.id ?? projectedTracks[deletedIndex - 1]?.id ?? document.activeTrackId`. The last fallback can never be reached (last-track refusal guarantees ≥1 survivor and `deletedIndex` always has a neighbor), and if it ever WERE reached with `activeTrackId === trackId` it would re-point the active track at the just-deleted track. Replace with the first survivor (or `projectedTracks[0]?.id`) for defensiveness. No runtime risk today.

### F 05 — Reason-name reuse: same-track move reuses `duplicate-destination-frame` (LOW)

`physicPaintStore.moveTrackItems` (line 2713) returns `'duplicate-destination-frame'` for `fromTrackId === toTrackId` — a refusal of an impossible operation, not a destination collision. The same reason is used for genuine destination frame collisions. Cosmetic but the two meanings are easy to confuse in diagnostics; a `same-track-move` reason would be clearer. (This is the only same-track move; no test covers it — see F 07.)

## Verified-correct (highlights)

- **Teardown completeness**: `removeTrackRuntime` deletes all 16 per-track maps + structural memo composite key + `trackRevisions` entry, settles the track's leases (settled-identity), and prunes alpha canvases with the correct ordering — dataUrls captured before map deletion, `_isDataUrlReferenced` evaluated after, so only other tracks' references keep a canvas alive.
- **Sidecar deletion (D-15)**: every deletion dir is validated by `isSafeEfxPaintCachePath` at prepare (throws on unsafe), rides the same cache transaction, removed only in the commit arm after publication, never on rollback, and the store-side list is clear-on-read. The trackDeleteLaws suite asserts the exact `remove()` call contract under commit, rollback, and re-save.
- **Cache invalidation**: single invalidation point `bumpTrackRevision` deletes exactly the `${layerId}\0${trackId}` memo key on every mutation path; the efxPaintTrackCache suite proves with a derive spy that a source edit rebuilds exactly one memo (never the sibling's), and that repeated reads add zero rebuilds.
- **Hold creation gate**: `validateTrackHoldLoopClipRefs` checks the owning track's real-key map only (no cross-track lookup) and gates `replaceRotoPhysicalLoopClips` before parse-persist for static clips; severed D-31 clips bypass the gate on hydration (direct map writes in `installRuntimeStateFromDocument`), so project reload of a severed document is safe.
- **Undo ledger**: dedupe key is operationId+trackId (cross-track ops emit one acceptance per track); snapshots are stripped of raster bytes; replay auto-activates the command's track before the seam; a command whose track no longer exists fails closed at the replay-authority check.
- **3-dim authority**: revalidation chain parent → document → track with no active-track fallback and no auto-create; the request's trackId is echoed on every success AND failure; the mid-flight active-switch test proves the commit lands on the captured track, never the live one; per-track stale-async isolation proven (B-dirty does not fail A).
- **Re-pointing fail-closed (D-06)**: `repointLoopClipSources` returns null when any source ref is outside the pasted set → the paste rejects `'loop-source-outside-pasted-set'` with zero mutation.

## Test/fixture observations

- **Behavior-level assertions**: new suites assert byte-identical survivors, memo rebuild counts via the single `derivePhysicPaintRotoLoopRanges` spy, fs mock remove()/writeFile contracts, and revision hashes — not implementation internals. The in-memory fs/ipc doubles (`publishPhysicPaintCacheGeneration` + `exchangeGeneration`) are faithful to the plugin-fs and ipc idioms.
- **Coverage gaps (minor)**:
  1. Same-track `moveTrackItems` (from === to) is untested (F 05).
  2. `removeTrackRuntime`'s alpha-canvas registry prune (the last loop in the function) is not directly asserted — the deep-copy test proves frame-map survival, not registry survival.
  3. No test locks the intended behavior for F-01 (a mid-flight switch between two identical-content tracks before a group-frame-paint commit would show the live-resolve). Adding it after the fix documents the captured-identity contract.
  4. `setRotoPlaybackSettings` does not bump the per-track revision or global clock (only `_markProjectDirty`) — pre-existing, out of phase scope; noted because the 46 re-key leaves it as the only mutation surface that does not route through `bumpTrackRevision`, which is consistent (playback settings are launch-runtime state, never persisted) but worth a one-line comment.
