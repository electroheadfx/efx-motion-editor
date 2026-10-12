---
phase: 46-track-local-paint-roto-playscript-state-loop-clips-and-cache
plan: 03
subsystem: core
tags: [physic-paint, multi-track, track-scoped-ops, cross-track-move, track-tagged-history, fresh-identities, undo-redo, typescript, vitest]

# Dependency graph
requires:
  - phase: 46
    plan: 01
    provides: track-addressed runtime (Map<layerId, Map<trackId, T>>), per-track revisions, track lifecycle primitives
  - phase: 46
    plan: 02
    provides: multi-track serialize/hydrate projection, trackId cache paths, per-track save/load carriers
  - phase: 45
    provides: EfxPaintDocument v1.0 with stable UUID track ids, activeTrackId, and the 45-01 documentRevision builders
provides:
  - "Track-scoped copy/cut/paste/duplicate/clear store ops (copyTrackSelection/cutTrackSelection/pasteTrackSelection/duplicateTrackFrames/clearTrackFrames) that route only through the 46-01 per-track maps with fresh keyId/loopId allocations (D-05), fail-closed Hold re-pointing (D-06), and deep-copied destination assets (D-07)"
  - "Store-level cross-track move primitive moveTrackItems(layerId, fromTrackId, toTrackId, keys) — provably copy-paste-delete with fresh identities, fail-closed on unre-pointable Hold clips (D-08/D-09); the primitive Phase 47 drag calls"
  - "Unified document-wide track-tagged undo/redo: every history command carries the mutating trackId, recordAcceptedEdit dedupes on operationId+trackId, stored snapshots hold records + refs + revision hash only (D-03), undo/redo auto-activate the entry's track via efxPaintStore.setActiveTrackId before replay (D-04), and the 10-level operation cap holds (D-02)"
affects: [46-04, 46-05, 46-06, 47]

# Actuals — pairs with the plan's estimate to calibrate future estimates.
actuals:
  tokens: 22000
  tasks: 3
  commits: 6

# Tech tracking
tech-stack:
  added: []
  patterns: [track-tagged history commands, operationId+trackId dedupe, raster-stripped history snapshots, fail-closed cross-track Hold re-pointing, move = copy-paste-delete]

key-files:
  created: []
  modified:
    - app/src/stores/physicPaintStore.ts
    - app/src/stores/efxPaintStore.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/stores/trackIsolation.test.ts
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.test.ts
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts
    - app/src/components/physic-paint/hooks/physicsPaintRotoLoopHistory.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts

key-decisions:
  - "The rail-set copy engine (buildRotoRailSetCopyPayload) gains source/target track context: the fresh-identity allocation produces new keyIds/loopIds (D-05); Hold clips pasted across tracks are re-pointed to the destination track's freshly allocated source frames; an unre-pointable Hold rejects the paste with a closed result — never a dangling or foreign-track reference (D-06)"
  - "Cross-track paste deep-copies the underlying source frame assets so the destination track is fully self-contained; the no-durable-asset-duplication contract applies only to linked repeats inside ONE Loop Clip (D-07)"
  - "moveTrackItems is implemented verbatim as D-09: cut (fresh-identity clipboard payload) then paste into the destination then delete from the source; a failed move returns ok:false and the source stays untouched; the destination identity is always fresh"
  - "The undo/redo ledger is one document-wide stack; each physical command carries the accepted edit's trackId; recordAcceptedEdit dedupes on operationId+trackId so one cross-track operation's per-track acceptances all record and same-opId/same-track duplicates still collapse (D-01)"
  - "Stored history snapshots are sanitized at record time: the cached repaint base is nulled and the four per-frame raster maps are emptied — records + refs + the prior deterministic revision hash only, never raster bytes (D-03); the undo/redo recompute path stays the single source of raster truth"
  - "undo()/redo() validate the live source against the entry's snapshot (existing snapshotReplayAuthorityEqual path) and, when the entry's trackId is not the document's active track, call the new efxPaintStore.setActiveTrackId FIRST so replay targets the live document (D-04); setActiveTrackId validates the track exists (fail closed) and bumps documentRevision via the 45-01 builders since activeTrackId is a docrev term"

requirements-completed: [TRK-04]

# Coverage metadata — one entry per shipped deliverable.
coverage:
  - id: C1
    description: "Track-scoped copy/cut/paste/duplicate/clear store ops with fresh identities: every op takes an explicit trackId, routes only through the per-track maps, allocates fresh keyIds/loopIds (D-05), and a paste into track B never changes A's records, caches, or revisions"
    verification:
      - kind: unit
        ref: "app/src/stores/trackIsolation.test.ts#46-03 Task 1 (same-track copy/paste, cross-track paste isolation, Hold re-pointing, partial-loop reject, deep-copy assets, clear)"
        status: pass
    human_judgment: false
  - id: C2
    description: "Cross-track Hold re-pointing fail-closed (D-06): a Hold Loop Clip pasted into B is re-pointed to B's copied frames; a partial selection whose Hold source frames are not part of the pasted set rejects explicitly (ok:false + reason) and writes nothing — never a cross-track or dangling reference"
    verification:
      - kind: unit
        ref: "app/src/stores/trackIsolation.test.ts#cross-track Hold re-pointing + partial-loop-overlap rejection"
        status: pass
    human_judgment: false
  - id: C3
    description: "Store-level cross-track move (D-08/D-09): moveTrackItems(layerId, fromTrackId, toTrackId, keys) removes source items and adds fresh-identity destination copies at the same appFrames; the result equals cutTrackSelection+pasteTrackSelection exactly; a move whose Hold re-pointing is impossible fails closed and the source stays untouched"
    verification:
      - kind: unit
        ref: "app/src/stores/trackIsolation.test.ts#46-03 Task 2 (move semantics, cut-paste equivalence, Hold re-pointing + colliding fail-closed)"
        status: pass
    human_judgment: false
  - id: C4
    description: "Track-tagged unified undo/redo (D-01..D-04): the applied-stack top entry carries the mutating trackId; undoing a B entry with A active auto-activates B via efxPaintStore.setActiveTrackId FIRST (before the coordinator replay) and bumps documentRevision through the 45-01 builders; replay leaves the other track's records untouched"
    requirement: TRK-04
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts#46-03 Task 3 (track tagging + auto-activation)"
        status: pass
    human_judgment: false
  - id: C5
    description: "operationId+trackId dedupe and the 10-level cap: 12 track-tagged acceptances from 6 cross-track operations (one acceptance per track under the same operationId) record and trim to the 10-entry cap; same operationId on the same track still collapses"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts#12 ordinary edits trim to the 10-level cap + same-opId same-track dedupe"
        status: pass
    human_judgment: false
  - id: C6
    description: "No raster bytes in history entries (D-03): a stored command's snapshots carry records + refs + the revision hash only — a deep walk of the stored after-snapshot finds no data: raster outside the canonical record dataUrls (cached repaint base and frame maps stripped at record time)"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts#no stored snapshot field holds a dataUrl raster"
        status: pass
    human_judgment: false
  - id: C7
    description: "No regression: full suite 2752 passed / 1 skipped / 101 todo / 0 failed / 148 files; app typecheck clean; the four pre-existing history-adjacent suites still pass with the trackId-bearing identity fixtures"
    verification:
      - kind: unit
        ref: "pnpm --filter efx-motion-editor exec vitest run && pnpm --dir app exec tsc --noEmit"
        status: pass
    human_judgment: false
  - id: C8
    description: "Live operation-matrix UAT (copy/cut/paste/duplicate/clear/undo/redo x same-track x cross-track) in the running Studio with visible auto-activation of the target track"
    verification: []
    human_judgment: true
    rationale: "The plan's flagged assumption (edge TRK-04 unclassified): the full operation matrix is unit-tested here, but live native UAT of the multi-track Studio surface (including the auto-activation visual and the move drag — the gesture itself is Phase 47) is pending; unit tests cannot judge the interactive UX"

# Metrics
duration: 33min
completed: 2026-08-24
status: complete
---

# Phase 46 Plan 03: Track-scoped Ops and Track-Tagged Undo/Redo Summary

**Copy/cut/paste/duplicate/clear and the store-level cross-track move become track-aware with fresh identities and fail-closed Hold re-pointing; undo/redo becomes one document-wide track-tagged ledger that auto-activates the mutating track, caps at 10, and stores refs + revision hash only**

## Performance

- **Duration:** ~33 min wall clock (23:29 first Task-1 test commit to 00:02 final Task-3 feat commit)
- **Started:** 2026-08-23T23:29:00Z
- **Completed:** 2026-08-24T00:02:00Z
- **Tasks:** 3
- **Commits:** 6 (3 test + 3 feat) + close-out
- **Files modified:** 13

## Accomplishments

- **Track-scoped copy/cut/paste/duplicate/clear (TRK-04, SC 4):** five store ops on physicPaintStore that accept an explicit trackId and route only through the 46-01 per-track maps. `copyTrackSelection` builds a clipboard payload through the fresh-identity rail-set engine (new keyIds/loopIds, D-05); `cutTrackSelection` = copy + remove with the partial-loop-overlap guard; `pasteTrackSelection` applies through the three-port `_applyRotoTrackPaste` with fresh identities and publishes the fresh frames; `duplicateTrackFrames`/`clearTrackFrames` are direct per-track mutations. A paste into track B never touches A's records, caches, or revision values (isolation proven per-byte in tests).
- **Hold re-pointing fail-closed (D-06, T-46-07):** `buildRotoRailSetCopyPayload` gains source/target track context; a Hold Loop Clip pasted across tracks re-points `sourceFrameRefs` to the destination track's freshly allocated ids for the same source frames; a partial selection whose Hold source frames are NOT part of the pasted set returns a closed `ok:false` failure and writes nothing — a cross-track or dangling reference can never survive the paste boundary (ASVS V4).
- **Deep-copy assets (D-07):** the destination track's pasted frames hold their own bytes (equal to the source bytes but owned by the destination — deleting B leaves A's frames and caches intact).
- **Cross-track move primitive (D-08/D-09):** `moveTrackItems(layerId, fromTrackId, toTrackId, keys)` is implemented verbatim as copy-paste-delete with fresh identities and is proven equivalent to cut-then-paste; a move whose Hold re-pointing is impossible fails closed and the source items stay in place. This is the exact function Phase 47's drag gesture calls.
- **Track-tagged unified undo/redo (D-01..D-04):** `RotoPhysicalEditHistoryIdentity` and `RotoPhysicalEditCommand` gain `trackId`; `recordAcceptedEdit` dedupes on `operationId + trackId` so one cross-track operation's per-track acceptances all record; `undo()`/`redo()` auto-activate the entry's track via the new fail-closed `efxPaintStore.setActiveTrackId` (documentRevision bumped through the 45-01 builders) before replaying through the coordinator seam; the 10-level operation cap holds; stored snapshots are sanitized at record time (cached repaint base nulled, frame maps emptied) so entries carry records + refs + the prior deterministic revision hash only — never raster bytes (D-03).
- **Gates:** full suite 2752 passed / 1 skipped / 101 todo / 0 failed / 148 files; `pnpm --dir app exec tsc --noEmit` clean.

## Task Commits

Each task was committed atomically (TDD: test → feat per task):

1. **Task 1: track-scoped copy/cut/paste/duplicate/clear** - `636b8e9b` (test) + `8c5d2a6e` (feat)
2. **Task 2: store-level cross-track move primitive** - `6095dd9b` (test) + `556bf4f0` (feat)
3. **Task 3: unified track-tagged undo/redo with auto-activation** - `d6e0ac67` (test) + `eea0a68d` (feat)

**Plan metadata:** close-out commit follows this summary.

## Files Created/Modified

- `app/src/stores/physicPaintStore.ts` - Modified: `copyTrackSelection`, `cutTrackSelection`, `pasteTrackSelection(layerId, targetTrackId, payload, destinationAppFrame?)`, `duplicateTrackFrames`, `clearTrackFrames`, `moveTrackItems(layerId, fromTrackId, toTrackId, keys)`; helpers `_applyRotoTrackSelectionRemoval` (breaks→records→loops→frames order) and `_applyRotoTrackPaste` (three ports + fresh-frame publication)
- `app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts` - Modified: `buildRotoRailSetCopyPayload` with source/target track context and closed Hold re-pointing failure (`loop-source-outside-pasted-set`)
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts` - Modified: clipboard paste port carries the target track context
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` - Modified: identity + command gain `trackId`; dedupe key `operationId:trackId`; `withoutRasterBytes` sanitizer in `recordAcceptedEdit`; auto-activation (`getActiveTrackId`/`setActiveTrackId`) in `undo()`/`redo()` before the replay seam; the 10-cap trim unchanged
- `app/src/stores/efxPaintStore.ts` - Modified: `getActiveTrackId(layerId)` and `setActiveTrackId(layerId, trackId)` (fail-closed on missing document/track; documentRevision bumped via the 45-01 builders; no-op when already active)
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - Modified: the history identity passes `trackId: trackIdOfLaunch(launchContext)`
- `app/src/stores/trackIsolation.test.ts` - Modified: Task 1 (6 tests) + Task 2 (3 tests) track-scoped suites
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts` - Modified: Task 3 suite (5 tests); existing fixtures gain `trackId`; the two-track document fixture carries a canonical track revision
- `app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.test.ts`, `useRotoPhysicalEditCoordinator.test.ts`, `physicsPaintRotoLoopHistory.test.ts`, `physicsPaintRotoLoopGuards.test.ts`, `physicsPaintRotoPlayScriptController.test.ts` - Modified: identity fixture literals gain `trackId` (mechanical, required by the new required field)

## Decisions Made

- **TrackId is the op identity (TRK-01):** every new store op signature takes an explicit trackId and routes only through the 46-01 per-track maps — no `tracks[0]`, no index math (Pitfall 1), no ambient "current track" capture in the store layer.
- **Fresh identities are absolute (D-05):** copy/paste/move never reuse source keyIds/loopIds; the destination is a fully self-contained copy of the source payload.
- **Hold re-pointing is fail-closed (D-06):** a re-pointable Hold is re-pointed to the destination's freshly allocated frames; an unre-pointable one rejects the whole paste/move with a closed result rather than leaving a foreign-track reference (T-46-07 disposition).
- **Undo is one document-wide stack (D-01..D-04):** the history hook is unchanged in shape (no second ledger, no new effects — the Preact effect-subscription shape is preserved); each entry tags its track, dedupe keys on `operationId:trackId`, replay revalidates the live source, auto-activates the target track first, and the 10-cap trim is byte-identical.
- **History entries are reference-based (D-03):** the sanitized snapshot rides the coordinator's immutable accepted snapshot but with the rasterized repaint base and per-frame maps stripped; the recompute path stays the single source of raster truth (T-46-09 disposition).

## Deviations from Plan

### Auto-fixed Issues

**1. Raster-strip sanitizer in recordAcceptedEdit (D-03 enforcement)**
- **Found during:** Task 3 (unified track-tagged undo/redo)
- **Issue:** the plan's action steps list the no-bytes contract only as Task 3 Test 5's assertion ("the snapshots carry records + refs + the prior revision hash only") but do not state that `recordAcceptedEdit` must strip the captured snapshot — the coordinator's accepted snapshots legitimately ride the cached repaint base and per-frame raster maps. A history entry built from the raw snapshot would fail Test 5's deep-walk and violate the prohibition "Never store raster bytes in undo entries".
- **Fix:** added `withoutRasterBytes(snapshot)` in the history hook, applied to both `before`/`after` at command construction: cached repaint base → null, frameStates/previewFrames/capturedFrames/confirmedFrames → empty Maps. Canonical record dataUrls (cached sidecar refs) are untouched.
- **Files modified:** app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
- **Verification:** Task 3 Test 5 (no raster outside canonical record paths), full suite green, typecheck clean.
- **Committed in:** eea0a68d (Task 3 feat commit)

**2. PhysicsPaintStudio identity gains trackId (required by the new identity type)**
- **Found during:** Task 3 (unified track-tagged undo/redo)
- **Issue:** the plan's `files_modified` list for Task 3 omits PhysicsPaintStudio.tsx, but the hook is instantiated there and the identity type now requires `trackId` — tsc fails without it.
- **Fix:** the Studio's history identity passes `trackId: trackIdOfLaunch(launchContext)` (the launch carries the document's active track; auto-activation in undo/redo keeps it current).
- **Files modified:** app/src/components/physic-paint/PhysicsPaintStudio.tsx
- **Verification:** typecheck clean; the live launch identity stays single-track-correct for the whole Phase 47 surface.
- **Committed in:** eea0a68d (Task 3 feat commit)

**3. Fixture trackId in four pre-existing history-identity suites (mechanical)**
- **Found during:** Task 3 (unified track-tagged undo/redo)
- **Issue:** the `trackId` field on `RotoPhysicalEditHistoryIdentity` broke type assignment in 25 identity literals across `useRotoPhysicalEditHistory.test.ts`, `useRotoPhysicalEditCoordinator.test.ts`, `physicsPaintRotoLoopHistory.test.ts`, `physicsPaintRotoLoopGuards.test.ts`, `physicsPaintRotoPlayScriptController.test.ts`.
- **Fix:** each fixture identity gained `trackId: 'track-a'` (a neutral constant — these suites exercise same-track semantics only).
- **Files modified:** the five test files above
- **Verification:** typecheck clean; all five suites pass (284 tests in the touched files).
- **Committed in:** eea0a68d (Task 3 feat commit)

**4. Canonical revision for the two-track fixture (fail-closed document boundary)**
- **Found during:** Task 3 (unified track-tagged undo/redo)
- **Issue:** the new `registerTwoTrackDocument` fixture seeded track A with `revision: 'seed-a'`; `setActiveTrackId` runs the 45-01 docrev builders which re-parse fail-closed, so the non-canonical revision threw `PhysicPaintRotorPhysicalDocument: canonical revision mismatch` on undo. This is correct store behavior (documents enter the store only after fail-closed loader validation) — the fixture was the invalid side.
- **Fix:** the fixture computes `buildPhysicPaintRotorPhysicalRevision(aRecords, {enabled:false, mode:'duplicate'}, [], [])` for the seeded records.
- **Files modified:** app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts
- **Verification:** Task 3 Tests 1/3 pass; typecheck clean.
- **Committed in:** eea0a68d (Task 3 feat commit)

---

**Total deviations:** 4 auto-fixed (2 plan-scope extensions, 2 mechanical test/fixture corrections)
**Impact on plan:** all extensions enforce the plan's own truth contracts (D-03 no-bytes, D-01 track identity) that the action text implied but did not state as implementation steps; no scope creep, no new user-facing surface beyond the plan's stated symbols.

## Issues Encountered

- The two-track fixture's seeded revision was non-canonical, surfacing only under `setActiveTrackId` (the 45-01 docrev re-parse). The store behaved as designed (fail-closed); the fixture was corrected to compute the canonical revision (deviation 4 above).
- The Task 1 same-track copy/paste tests needed the `normalizeTrackDocument` compare helper to exclude the revision field — two independent scenarios carry fresh identity UUIDs so their deterministic revisions differ by design; the equivalence compare is over keyId→appFrame mappings instead.
- The 46-02-pre-existing round-trip identity expectations are unchanged: no existing test required rewriting beyond the mechanical `trackId` fixture additions.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The edit operation layer is fully track-aware: every op takes explicit trackIds, cross-track transfer is fail-closed with fresh identities, and undo/redo is one document-wide track-tagged ledger with auto-activation — ROADMAP SC 1..4 are now test-proven (SC 1 cross-track isolation, SC 4 exact-target operations).
- 46-04 (async revalidation with track-aware revision checks) can rely on the auto-activation seam (`setActiveTrackId` docrev bump) and the per-track revision signals from 46-01; 46-05 (track deletion) can build on the same per-track maps without history-scope surprises.
- Phase 47's internal multi-track timeline drag will call `moveTrackItems` directly — the primitive is exported, fail-closed, and equivalence-proven.
- No blockers; full suite and typecheck green.

---
*Phase: 46-track-local-paint-roto-playscript-state-loop-clips-and-cache*
*Completed: 2026-08-24*
