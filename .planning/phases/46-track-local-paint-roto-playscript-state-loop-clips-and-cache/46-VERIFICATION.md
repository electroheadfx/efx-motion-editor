---
phase: 46-track-local-paint-roto-playscript-state-loop-clips-and-cache
verified: 2026-08-24
verifier: verification-agent
diff_base: 65e7757b (docs(46): create phase plan) → HEAD
status: human_needed
verdict: GO — phase goal achieved, all 8 requirements accounted for, 0 blocking findings
---

# Phase 46 Verification — Track-local Paint/Roto/PlayScript State, Loop Clips, and Caches

## Goal

Move editable and generated state from **parent-layer/frame addressing** to **parent-document/internal-track/frame addressing** (`parentLayerId → trackId → frame`) inside the v1.0 EFX Paint document built in Phase 45 — covering Paint frames, Roto real keys, generated interpolation/caches, Script Motion, PlayScript output, linked Hold Loop Clips, per-track revision/dirty state with track-aware cache invalidation, track-aware edit ops and undo/redo, async parent+document+track revalidation, and fail-closed track deletion.

## Verdict

**GO.** The goal is achieved. The runtime store, persistence boundary, async authority, edit-op layer, undo ledger, and deletion path are all track-addressed by stable UUID `trackId` (never array index). All 8 requirement IDs (TRK-01..TRK-08) are implemented, tested, and marked complete in `.planning/REQUIREMENTS.md`. Full suite green: **2794 passed / 1 skipped / 101 todo / 0 failed / 148 files**; `tsc --noEmit` clean. Code review produced 5 non-blocking findings (1 medium-low, 4 low/info) — none affects the phase goal (detailed in §Findings).

## Requirement Traceability — every ID accounted for

All TRK IDs in the plan frontmatter map 1:1 to `.planning/REQUIREMENTS.md` §TRK (lines 21–28, all `[x]` Complete; traceability table lines 137–144). No ID is missing, duplicated, or unaccounted.

| ID | Requirement (abridged) | Plan(s) | Code evidence | Test evidence | Status |
|----|------------------------|---------|---------------|---------------|--------|
| TRK-01 | Each internal Paint track owns its frames, Roto real keys, generated interpolation, Script Motion, PlayScript output | 46-01, 46-02 | `physicPaintStore.ts`: 16 per-track maps `Map<layerId, Map<trackId, T>>` (lines 319–344); track-scoped accessors; `efxPaintStore.ts:250` `serializeRuntimeIntoDocument` iterates `document.tracks` by id (never `tracks[0]`) | `trackIsolation.test.ts` (30 tests), `efxPaintMultiTrackProjection.test.ts` (5 tests) | ✅ |
| TRK-02 | Each track owns linked Hold Loop Clips; shared resolver, modulo, interruption | 46-06 | `getTrackRotoResolutionContext(layerId, trackId)` provenance pair (physicPaintStore.ts:2240); resolver `physicsPaintRotoPhysicalResolver.ts` byte-untouched since phase base (git diff 65e7757b..HEAD empty) | `trackIsolation.test.ts` (46-06 suite), `efxPaintTrackCache.test.ts` (8 tests) | ✅ |
| TRK-03 | Per-track revision + dirty state, track-aware cache invalidation | 46-01, 46-02 | `trackRevisions` signal map (physicPaintStore.ts:59), `getTrackPaintVersion`/`getTrackRotorRevision`/`bumpTrackRevision` (71–99); composite memo key `${layerId}\0${trackId}` (line 455), single invalidation point (line 99); cache paths `buildEfxPaintFrameCachePath(layerId, trackId, frame)` (efxPaintPersistence.ts:103–108) | `trackIsolation.test.ts`, `efxPaintPersistence.test.ts`, `efxPaintMultiTrackProjection.test.ts` | ✅ |
| TRK-04 | Copy/cut/paste/duplicate/clear/undo/redo track-aware | 46-03 | `copyTrackSelection`/`cutTrackSelection`/`pasteTrackSelection`/`duplicateTrackFrames`/`clearTrackFrames`/`moveTrackItems` (physicPaintStore.ts:2548–2732); `RotoPhysicalEditHistoryIdentity.trackId` + dedupe `operationId:trackId` + `withoutRasterBytes` + auto-activation (useRotoPhysicalEditHistory.ts:88,117,600,637,737); `setActiveTrackId`/`getActiveTrackId` (efxPaintStore.ts:85–115); fresh identities + `loop-source-outside-pasted-set` closed rejection (physicsPaintRotoRailSetCopy.ts:155, 563–571) | `trackIsolation.test.ts`, `useRotoPhysicalEditHistory.test.ts`, `physicsPaintRotoRailSetCopy.test.ts` | ✅ |
| TRK-05 | Async revalidates parent, document, track revision before commit | 46-04 | `PhysicPaintRotoAuthorityRequest/Result` carry `trackId`+`trackRevision`+`documentRevision` (types/physicPaint.ts); `getPhysicPaintRotorAuthority` chain parent → document → track, fail-closed `'Track is unavailable.'`; commit gate compares `authority.trackId !== payload.trackId` + both revision terms (physicPaintBridge.ts:355–369) | `physicPaintBridgeAuthority.test.ts` (9 tests), `physicPaintBridge.test.ts` | ✅ |
| TRK-06 | One track's edits never touch another; stale async cannot commit to another selected track | 46-04 | Commit gate reads captured `payload.trackId`, never live `activeTrackId` (bridge 355–369 with comment); transport lease-track check `submittedLeaseToken.trackId !== payload.trackId` (bridge:438); lease identity embeds trackId (physicPaintStore.ts:382) | `trackIsolation.test.ts` (46-04 Task 3 stale-async laws), `physicPaintBridge.test.ts` | ✅ |
| TRK-07 | Track deletion cannot orphan accepted assets silently | 46-05 | `TrackDeletePreview`/`requestDeleteTrack`/`commitDeleteTrack` (efxPaintStore.ts:118–210) with acknowledge gate + `last-track` refusal; `severTrackHoldReferences` (physicPaintStore.ts:206); nearest-adjacent re-point (efxPaintStore.ts:220); sidecar deletions ride `settlePreparedEfxPaintSave` commit arm only (efxPaintPersistence.ts:300–316); `takePendingTrackDeletions` | `trackDeleteLaws.test.ts` (15 tests), `efxPaintPersistence.test.ts` | ✅ |
| TRK-08 | Editing one Hold source frame updates every linked occurrence without duplicating assets | 46-06 | `validateTrackHoldLoopClipRefs` closed `'empty-source-refs'`/`'foreign-source-refs'` before parse-persist (physicPaintStore.ts:2036–2051); atomic per-track memo invalidation via `bumpTrackRevision` (proven by derive spy); `'linked-unresolved'` never persisted (virtual-only) | `efxPaintTrackCache.test.ts`, `trackIsolation.test.ts` | ✅ |

## Must-Have Cross-Check (per plan, condensed)

All six plans' `must_haves.truths` were checked against the code; every one holds:

- **46-01 (tracer):** 16/16 runtime maps re-keyed `layerId → trackId` (count grep = 16); per-track signal map with global `physicPaintVersion` clock kept; leases carry `trackId` on the token and the scope string; `mountTrackRuntime`/`removeTrackRuntime` exported with the full inventory sweep + `trackRevisions` entry delete + lease settle; old-signature call sites gone from `physicPaintStore` consumers (the only remaining bare `getFrame(layerId, frame)` calls are in `paintStore.ts` — the inline EFX Paint store, explicitly out of scope per the locked naming contract).
- **46-02:** single-track guard strings gone (grep finds none); serialize/hydrate iterate `document.tracks` by id and project per track; cache path embeds `trackId` between stable segment and file name; save/load carriers are `trackId → appFrame → frame`; fingerprint terms track-augmented.
- **46-03:** all five ops + `moveTrackItems` exist with explicit trackId; fresh identities (D-05); Hold re-pointing fail-closed `loop-source-outside-pasted-set` (D-06); deep-copied destination assets (D-07); move = cut+paste+delete (D-09); unified track-tagged ledger, `operationId:trackId` dedupe, 10-cap preserved, no raster bytes (D-01..D-03), auto-activation (D-04).
- **46-04:** authority request/result carry the three dimensions; fail-closed foreign track (`'Track is unavailable.'`, zeroed capacity, no auto-create); commit gate re-requests authority for the **captured** trackId — never the live active track; transport lease cross-track rejection; per-track stale-async laws proven.
- **46-05:** preview (frameCount/loopClipCount/holdReferenceCount/isLastTrack) before mutation; acknowledge gate; last-track refusal; teardown reuses `removeTrackRuntime`; Hold severing keep-verbatim with memo invalidation; nearest-adjacent next-first; single dirty callback; sidecar deletions only in the commit arm, rollback keeps, list clears on read.
- **46-06:** resolution context built exclusively from the owning track's maps with provenance pair; resolver untouched; zero-real-keys answers `'linked-unresolved'`; boundary frame belongs to exactly one clip (half-open by placementStart); creation gate closes empty/foreign refs before parse; unresolved never persisted; healing on re-add.

## Edge Coverage (46-EDGE-COVERAGE.json)

All 16 probes (TRK-01/02/03/08 adjacency+empty+ordering, TRK-04/05/06/07 unclassified) are **resolved explicit** in the plans' must_haves and covered by tests:

| Probe | Resolution evidence |
|-------|---------------------|
| TRK-01 adjacency (same appFrame two tracks) | trackIsolation base law — per-byte isolation tests |
| TRK-01 empty (empty-but-present track) | trackIsolation empty-track test (`hasTrackRuntime` true, empty records) |
| TRK-01 ordering (per-track records sorted) | trackIsolation ordering test |
| TRK-02 adjacency / empty / ordering | 46-06 Task 1 tests 1/2/3 (adjacency, zero-real-keys unresolved, boundary) |
| TRK-03 adjacency (track A bump leaves B revision) | 46-01 Task 2 test 1; 46-04 stale-async laws |
| TRK-03 empty (fresh mount baseline not-dirty) | 46-01 Task 2 test 2 |
| TRK-03 ordering (memo keyed layer+track) | 46-01 Task 2 test 3; 46-06 derive-spy no-cross-track-invalidation |
| TRK-04/05/06/07 unclassified | covered by 46-03/04/05 unit suites + flagged for live native UAT (§Human-needed) |

## Review Findings Disposition (46-REVIEW.md, 5 findings)

| ID | Severity | Verified in code | Assessment vs phase goal |
|----|----------|------------------|--------------------------|
| **F-01** | MEDIUM-LOW (genuine) | `applyPhysicPaintRotoGroupFramePaint` (~line 1861) and `applyCommittedReferencedActionDeletion` (~line 2124) resolve `getEfxPaintDocument(layerId)?.activeTrackId` at apply time instead of the captured lease-token `trackId` | **Does not block the goal.** Both are legacy single-track-era apply paths (launch IS the document, D-03 comment in code); the authoritative async commit gate (replace-roto-key-frames, the D-19/D-20 path) is correctly captured — `payload.trackId`, never the live active track. The general case fails closed on the revision/equality guard; the exposure is a narrow window (mid-flight active-track switch **and** byte-identical tracks). State is still track-addressed; only the apply-time target resolution is stale. **Recommend a small follow-up fix:** prefer `leaseToken.trackId` (fall back to active only when no token), plus a regression test with two identical-content tracks. |
| F-02 (LOW) | `getTrackPaintVersion`/`getTrackRotorRevision` ignore `_layerId` (physicPaintStore.ts:71–76) | Safe today (UUID trackIds, no cross-layer collision); API invites caller error. **Accepted** — drop/validate the parameter in a follow-up. |
| F-03 (INFO) | `expectedTrackRevision`/`expectedDocumentRevision` optional; gate skips when absent (bridge 366–367) | Deliberate (test fixtures); tests document the semantics explicitly. **Accepted** — consider tightening the child contract comment. |
| F-04 (INFO) | `commitDeleteTrack` nearest-adjacent fallback `?? document.activeTrackId` unreachable (efxPaintStore.ts:222) | Last-track refusal guarantees a survivor; no runtime risk. **Accepted** — defensive replacement with `projectedTracks[0]?.id` is optional. |
| F-05 (LOW) | Same-track `moveTrackItems` reuses `'duplicate-destination-frame'` reason (physicPaintStore.ts:2713) | Cosmetic; same-track move untested (coverage gap 1). **Accepted.** |

No finding blocks closure. F-01 is the only one that touches track identity and it is explicitly out of the phase's authoritative commit path; it is recorded for a follow-up (Phase 47 drag/apply work).

## Regression Check

- No prior `VERIFICATION.md` exists in `.planning/phases/` — this is the first; the full suite (2794 passed, 148 files, including all pre-phase-46 suites) stands as the regression gate and is **green**.
- `pnpm --dir app exec tsc --noEmit` — clean.
- The do-not-fork resolver (`physicsPaintRotoPhysicalResolver.ts`) has zero diff since the phase base commit.
- Old single-track guard strings (`'must have exactly one default Paint track'`) are gone from `efxPaintStore.ts`.
- Working tree is clean (only pre-existing untracked planning files); all 44 phase commits are on `milestone/v1.0.0`.

## Human-Needed Items (live native UAT — cannot be auto-verified)

| Item | Requirement | What to check | From |
|------|-------------|---------------|------|
| Operation-matrix UAT | TRK-04 | copy/cut/paste/duplicate/clear/undo/redo × same-track × cross-track in the running Studio, including the auto-activation visual of the target track on undo | 46-03 C8 |
| Async PlayScript capture | TRK-05/06 | Start a long PlayScript render on track A, switch to track B mid-flight; the commit must land on A only; fail-closed 'Track is unavailable.' surface | 46-04 C8 |
| Track-delete dialog | TRK-07 | Delete a track with accepted caches: dialog states the frame count, confirm removes track + no orphan sidecars on disk after the next save; last-track refusal message; Hold cells answer unresolved placeholders | 46-05 C9 |
| Track-local Hold surface | TRK-02/08 | Edit a Hold source frame → every linked occurrence updates in place; delete a source → cells become placeholders; clip editor rejects empty/foreign refs in the real timeline | 46-06 C13 |
| Sidecar cleanup on disk | TRK-07 | After a committed delete + save, verify `cache/efx-paint/<stableLayer>/<trackId>/` is removed and survivor directories remain | 46-05 D-15 |
| F-01 follow-up (recommended) | TRK-06 hardening | After the follow-up fix, a mid-flight switch between two identical-content tracks before a group-frame-paint commit lands on the captured track | 46-REVIEW F-01 |

## Method / Evidence Notes

- The path in the verification request read `.planning/phases/46-track-local-paint-physics-…`, but the on-disk directory is the **roto-playscript** slug (also the slug in REQUIREMENTS.md and all PLAN/SUMMARY frontmatter); this file is placed in the actual phase directory.
- Suite counts per new phase suite: trackIsolation 30, trackDeleteLaws 15, efxPaintTrackCache 8, physicPaintBridgeAuthority 9, efxPaintMultiTrackProjection 5 (matches summaries; 46-REVIEW re-ran 81/81 across the phase core suites).
- 44 commits between the phase base and HEAD, matching the summaries' commit claims (test → feat per task, docs close-outs).
