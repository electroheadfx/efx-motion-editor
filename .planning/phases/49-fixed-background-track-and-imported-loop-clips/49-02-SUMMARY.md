---
phase: 49-fixed-background-track-and-imported-loop-clips
plan: 02
subsystem: store
tags: [efx-paint, background-track, clip-crud, natural-sort, hydration, undo, tdd]

# Dependency graph
requires:
  - phase: 49-fixed-background-track-and-imported-loop-clips (49-01)
    provides: extended BackgroundFallback union (paper arm) the fallback setter round-trips
  - phase: 48-internal-compositor-and-flattened-parent-result
    provides: deriveEfxPaintBackgroundResolution resolver authority (placementStart/effectiveEnd/truncated/partialCycle) used for collision verdicts
  - phase: 45-new-efx-paint-document-and-clean-cutover
    provides: v1.0 EfxPaintDocument model, BackgroundTrack/FrameLoopClip/FrameLoopClipRepeat shapes, canonical revision encoder
provides:
  - D-02 natural original-filename ordering util (sortImagesByOriginalFilename, Intl.Collator numeric+base)
  - Five Background clip document ops on efxPaintStore: addBackgroundClip, moveBackgroundClip, setBackgroundClipRepeat, deleteBackgroundClip, setBackgroundFallback
  - Locked rejection-reason union: 'start-collision' | 'invalid-repeat' | 'clip-not-found' | 'invalid-source-refs'
  - Undo-by-reference acceptance descriptors for all five op kinds on the unified 10-level ledger
  - Source-byte hydration on document register/hydrate: hydrateBackgroundSourceImages (injectable ports) + hydrateBackgroundSourceImagesFromLibrary (production efxasset:// path)
affects: [49-03, 49-04, 49-05, 49-06, Phase 50 photoReference]

# Actuals (#2632) — pairs with the plan's estimate (95000 tokens)
actuals:
  tokens: 13682    # chars/4 over the realized diff (54730 chars)
  tasks: 3         # tasks completed
  commits: 6       # commits made

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure document mutation idiom: validate → immutable spread → canonical-revision idempotence compare → single documentRevision bump → _documents.set → _notifyChange() once (addTrack/renameTrack shape)"
    - "Resolver as single authority: store ops never pre-compute/cache effective extents; collision verdicts derive from deriveEfxPaintBackgroundResolution only"
    - "Injectable-ports hydration: hydrateBackgroundSourceImages(document, ports) is the testable unit; hydrateBackgroundSourceImagesFromLibrary supplies production ports (imageStore.getById + assetUrl + fetch→blob→FileReader→dataUrl + registerBackgroundSourceImage)"
    - "Fire-and-forget async byte-warming: registration stays synchronous; pending decodes resolve conservatively (null this tick, re-render on decode-complete) and never touch documentRevision/undo/dirty"

key-files:
  created:
    - app/src/efx-paint/utils/naturalFilenameSort.ts
    - app/src/efx-paint/utils/naturalFilenameSort.test.ts
  modified:
    - app/src/stores/efxPaintStore.ts
    - app/src/stores/efxPaintStore.test.ts
    - app/src/stores/physicPaintStore.ts
    - app/src/stores/physicPaintStore.test.ts

key-decisions:
  - "Hydration factored into a testable hydrateBackgroundSourceImages(document, ports) with injectable ports plus a production wrapper hydrateBackgroundSourceImagesFromLibrary — the plan's 'no new export unless the hydration helper is factored out' clause applied because the tests need the export"
  - "Hydration wired into hydrateRuntimeFromDocument in efxPaintStore.ts (Rule 3 deviation — the plan's Task 3 files_modified listed only physicPaintStore.ts + test, but the hydrate seam lives in efxPaintStore.ts, already a plan-modified file)"
  - "Registration is runtime-only: no documentRevision bump, no undo record, no dirty callback — re-saving a hydrated document produces an identical dedup fingerprint (BKG-09 save dedup proven by test)"
  - "Unknown asset ids resolve to null and are skipped at hydration — the knownSources-miss path reports them (D-10 fail-closed), never a throw and never placeholder content"

patterns-established:
  - "Pattern: every Background clip op returns a closed result { ok: true, ... } | { ok: false, reason } with the fixed English reason string the UI maps verbatim (D-04)"
  - "Pattern: shared start-collision verdict over resolver-derived existing extents — reject only when landing ∈ [existing.placementStart, existing.effectiveEnd); exclusive-end adjacency accepted; downstream extent never a rejection"
  - "Pattern: repeat validation coerces only true integers ≥ 1 (1 = once) and { mode: 'infinite' }; 0/negative/non-integer/non-finite rejected uncommitted with prior value preserved"
  - "Pattern: sourceFrameRefs stored once per clip (library asset IDs only, D-09); repeat instance k maps to refs[k mod cycleLength]; empty refs rejected at the store boundary"

requirements-completed: [BKG-02, BKG-03, BKG-04, BKG-05, BKG-07, BKG-08, BKG-09]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "D-02 natural original-filename ordering util — sortImagesByOriginalFilename orders by original_path basename via Intl.Collator(numeric, base), never by asset UUID, stable for equal basenames, full-path fallback, input not mutated"
    requirement: BKG-02
    verification:
      - kind: unit
        ref: "app/src/efx-paint/utils/naturalFilenameSort.test.ts#orders numeric-suffixed filenames naturally (shot_1 < shot_2 < shot_10)"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/utils/naturalFilenameSort.test.ts#orders UUID-named assets by original filename, never by asset id, and is stable for equal basenames"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/utils/naturalFilenameSort.test.ts#falls back to the full path when no basename separator exists and compares case-insensitively"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/utils/naturalFilenameSort.test.ts#does not mutate the input array and returns an empty array for empty input"
        status: pass
    human_judgment: false
  - id: D2
    description: "BKG-03 start-collision law — addBackgroundClip/moveBackgroundClip reject only strictly-occupied landings with reason 'start-collision'; exclusive-end adjacency and gaps accept; zero-clip document accepts any landing; downstream extent never a rejection"
    requirement: BKG-03
    verification:
      - kind: unit
        ref: "app/src/stores/efxPaintStore.test.ts#collision truth table: rejects landings strictly inside an existing clip, accepts the exclusive end and gaps (BKG-03, D-04)"
        status: pass
      - kind: unit
        ref: "app/src/stores/efxPaintStore.test.ts#accepts any landing frame >= 0 on a document with zero clips (empty probe)"
        status: pass
      - kind: unit
        ref: "app/src/stores/efxPaintStore.test.ts#downstream extent: a clip longer than the gap to the next clip commits with repeat verbatim (BKG-03/D-03)"
        status: pass
      - kind: unit
        ref: "app/src/stores/efxPaintStore.test.ts#moveBackgroundClip repositions a clip, rejects occupied landings, and is a no-op at the same position"
        status: pass
    human_judgment: false
  - id: D3
    description: "BKG-04 repeat contract + BKG-09 idempotence — setBackgroundClipRepeat accepts integers ≥ 1 and { mode: 'infinite' }, rejects 0/negative/non-integer/non-finite uncommitted; repeat/fallback setters are revision-stable no-ops on same-value writes; create always allocates a fresh id"
    requirement: BKG-04
    verification:
      - kind: unit
        ref: "app/src/stores/efxPaintStore.test.ts#a repeat edit leaves every other clip byte-identical (no cross-clip ripple)"
        status: pass
      - kind: unit
        ref: "app/src/stores/efxPaintStore.test.ts#idempotence: repeat and fallback setters are revision-stable no-ops on same-value writes; create always allocates a fresh id (BKG-09)"
        status: pass
    human_judgment: false
  - id: D4
    description: "BKG-05 deterministic recalculation + BKG-07 linked sources — deleting/moving a next clip re-derives the predecessor natural end untruncated from the document record only; a 5-ref clip at x3 keeps exactly 5 refs and maps instance k to refs[k mod 5]"
    requirement: BKG-05
    verification:
      - kind: unit
        ref: "app/src/stores/efxPaintStore.test.ts#deterministic recalculation: deleting the next clip re-derives the predecessor natural end untruncated (BKG-05)"
        status: pass
      - kind: unit
        ref: "app/src/stores/efxPaintStore.test.ts#linked sources: a 5-ref clip at x3 keeps exactly 5 refs and maps instance k to refs[k mod 5] (BKG-07)"
        status: pass
    human_judgment: false
  - id: D5
    description: "BKG-08 undo-by-reference — every op emits an acceptance descriptor the unified 10-level ledger records by reference; record → undo → redo restores exact prior state for all five op kinds (clip deletion one undo step, restore-by-reference)"
    requirement: BKG-08
    verification:
      - kind: unit
        ref: "app/src/stores/efxPaintStore.test.ts#undo: every op emits an acceptance descriptor; record → undo → redo restores exact state for all five kinds (BKG-08)"
        status: pass
    human_judgment: false
  - id: D6
    description: "BKG-09 source-byte hydration — hydrateBackgroundSourceImages registers each distinct clip ref exactly once with decoded bytes; missing assets register nothing and resolve to the missing verdict; pending decodes resolve conservatively and re-render on completion; registration touches no document revision (save dedup)"
    requirement: BKG-09
    verification:
      - kind: unit
        ref: "app/src/stores/physicPaintStore.test.ts#REGISTERS ALL: hydrating a document whose clips reference {a,b} and {b,c} registers each distinct ref exactly once with decoded bytes"
        status: pass
      - kind: unit
        ref: "app/src/stores/physicPaintStore.test.ts#MISSING IS EXPLICIT: a clip referencing an asset absent from the library registers nothing and resolves to the missing verdict"
        status: pass
      - kind: unit
        ref: "app/src/stores/physicPaintStore.test.ts#RED 10 background source-image port: pending decode returns null this tick, raster after the decode completes"
        status: pass
      - kind: unit
        ref: "app/src/stores/physicPaintStore.test.ts#SAVE DEDUP: hydration registration touches no document revision — two save projections of the same hydrated document produce an identical dedup fingerprint"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-08-31
status: complete
---

# Phase 49 Plan 2: Background Clip CRUD Ops, Natural Sort, and Source-Byte Hydration Summary

**Delivered the pure/testable core of the Background authoring surface: the D-02 natural original-filename sort util, five Background clip document ops on efxPaintStore (create/move/repeat/delete/fallback) with the locked start-collision law and closed rejection-reason union, undo-by-reference descriptors for all five op kinds, and the source-byte hydration that makes saved Background clips resolvable after reopen — all proven by a 3-task TDD contract suite (BKG-02/03/04/05/07/08/09).**

## Performance

- **Duration:** 20 min
- **Started:** 2026-08-31T11:20:00Z
- **Completed:** 2026-08-31T11:40:34Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- **D-02 natural sort util** (`sortImagesByOriginalFilename`): orders imported images by ORIGINAL FILENAME basename via `Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })` — `shot_1 < shot_2 < shot_10` — never by asset UUID, stable for equal basenames, full-path fallback when no separator exists, input never mutated. The comparator contains zero references to asset `id`.
- **Five Background clip document ops** on efxPaintStore following the addTrack/renameTrack pure-mutation idiom: `addBackgroundClip(layerId, { startFrame, sourceFrameRefs, repeat })`, `moveBackgroundClip(layerId, clipId, startFrame)`, `setBackgroundClipRepeat(layerId, clipId, repeat)`, `deleteBackgroundClip(layerId, clipId)`, `setBackgroundFallback(layerId, fallback)`. Each validates → immutable-spreads `background` (clips sorted by startFrame for stable ascending render order) → canonical-revision idempotence compare → single `documentRevision + 1` bump → `_documents.set` → `_notifyChange()` once → returns `{ ok: true, ... }` with the acceptance descriptor.
- **Locked rejection-reason union** for 49-04/49-05/49-06 to consume: `'start-collision' | 'invalid-repeat' | 'clip-not-found' | 'invalid-source-refs'`. The UI maps these to the locked English copy verbatim (D-04).
- **BKG-03 collision law proven by truth table**: reject only when landing ∈ `[existing.placementStart, existing.effectiveEnd)` (resolver-derived); landing at the exclusive end (zero-gap adjacency) ACCEPTS; gaps accept; zero-clip documents accept any landing ≥ 0; a clip longer than the gap to the next clip commits with its repeat verbatim (interruption is a resolver/render concern, never a stored-data truncation).
- **BKG-04 repeat contract**: integers ≥ 1 (1 = once) and `{ mode: 'infinite' }` accepted; 0/negative/non-integer/non-finite rejected uncommitted with the prior value preserved; a repeat edit leaves every other clip byte-identical (no cross-clip ripple).
- **BKG-05 deterministic recalculation**: deleting/moving a next clip re-derives the predecessor natural end untruncated from the document record only — no stored pre-computed extents, resolver is the single authority.
- **BKG-07 linked sources**: `sourceFrameRefs` stored once per clip (library asset IDs only, D-09); repeat instance k maps to `refs[k mod cycleLength]`; empty refs rejected at the store boundary.
- **BKG-08 undo-by-reference**: every op emits an acceptance descriptor the unified 10-level ledger records by reference; record → undo → redo restores exact prior state for all five op kinds (clip deletion is one undo step, restore-by-reference).
- **BKG-09 source-byte hydration**: `hydrateBackgroundSourceImages(document, ports)` (injectable ports) + `hydrateBackgroundSourceImagesFromLibrary(document)` (production path: `imageStore.getById` → `assetUrl` → `fetch` → blob → FileReader → dataUrl → `registerBackgroundSourceImage`). Wired fire-and-forget at the end of `hydrateRuntimeFromDocument`. Registration is runtime-only — no documentRevision bump, no undo record, no dirty callback — proven by the SAVE DEDUP test (identical dedup fingerprint across two save projections). Missing assets register nothing and resolve through the knownSources-miss path to transparent + missing report (D-10 fail-closed). Pending decodes resolve conservatively (null this tick, re-render on decode-complete).

## Task Commits

Each task was committed atomically (TDD: test → feat):

1. **Task 1: `sortImagesByOriginalFilename` util — natural original-filename ordering (D-02)** - `2f40f5a1` (test: RED), `e83a7399` (feat: GREEN)
2. **Task 2: Background clip CRUD document ops + fallback setter — collision verdicts, idempotence, undo descriptors** - `071c269b` (test: RED), `98056ff8` (feat: GREEN)
3. **Task 3: source-byte hydration on document register/hydrate — the sole production writer of registerBackgroundSourceImage (Pitfall 5, BKG-09)** - `0e6e328f` (test: RED), `379d6bda` (feat: GREEN)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified

- `app/src/efx-paint/utils/naturalFilenameSort.ts` - New D-02 util: module-level `Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })`, `sortImagesByOriginalFilename(images)` returning a NEW array sorted by `original_path` basename (split on '/', last segment, full-path fallback — the imageStore.ts:199 pattern). No asset `id` in the comparator.
- `app/src/efx-paint/utils/naturalFilenameSort.test.ts` - New 4-test contract suite: numeric ordering, UUID-vs-filename ordering + stability, full-path fallback + case-insensitivity, input immutability + empty probe.
- `app/src/stores/efxPaintStore.ts` - Five Background clip ops + fallback setter with the shared start-collision verdict, repeat validation, closed rejection results, acceptance descriptors, and the `setBackgroundFallback` round-trip of the extended union.
- `app/src/stores/efxPaintStore.test.ts` - Background clip behavior suite: collision truth table, empty probe, downstream extent, deterministic recalculation, no cross-clip ripple, linked-source mapping, idempotence, move semantics, fallback round-trip, and record → undo → redo for all five op kinds.
- `app/src/stores/physicPaintStore.ts` - `hydrateBackgroundSourceImages` (injectable ports), `_decodeEfxAssetBytes` (fetch → blob → FileReader → dataUrl), `hydrateBackgroundSourceImagesFromLibrary` (production ports), plus the `imageStore`/`assetUrl` imports.
- `app/src/stores/physicPaintStore.test.ts` - Hydration contract suite: REGISTERS ALL (dedupe across clips), MISSING IS EXPLICIT (fail-closed missing verdict), CONSERVATIVE DURING DECODE (null this tick, re-render on decode-complete), SAVE DEDUP (no revision churn).

## Decisions Made

- **Hydration factored into a testable unit with injectable ports**: `hydrateBackgroundSourceImages(document, ports)` takes `{ resolveAssetUrl, decodeBytes, register }`; `hydrateBackgroundSourceImagesFromLibrary` supplies the production ports. The plan's "no new export unless the hydration helper is factored out" clause applied — the tests need the export, so it is exported.
- **Wiring location (Rule 3 deviation)**: the plan's Task 3 `files_modified` lists only `physicPaintStore.ts` + test, but the hydrate seam (`hydrateRuntimeFromDocument`) lives in `efxPaintStore.ts`. Wired the fire-and-forget call there — `efxPaintStore.ts` is already a plan-modified file (Task 2). Documented in Deviations below.
- **Registration is runtime-only**: no documentRevision bump, no undo record, no dirty callback. The SAVE DEDUP test proves re-saving a hydrated document produces an identical dedup fingerprint.
- **Unknown asset ids resolve to null and are skipped** at hydration — the knownSources-miss path reports them (D-10 fail-closed), never a throw and never placeholder content.
- **Test observability without widening the public surface**: since the registry `_backgroundSourceImages` is private, tests use a fake `register` port that both records calls AND forwards to the real `registerBackgroundSourceImage` (so the compositor resolves bytes). No public read accessor was added.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Hydration wired into `hydrateRuntimeFromDocument` in efxPaintStore.ts**
- **Found during:** Task 3 (GREEN, wiring)
- **Issue:** The plan's Task 3 `files_modified` lists only `app/src/stores/physicPaintStore.ts` + test, but the document register/hydrate seam (`hydrateRuntimeFromDocument`) lives in `app/src/stores/efxPaintStore.ts`. Without wiring there, the hydration step would never run on reopen — every reopened clip would report Source missing (Pitfall 5).
- **Fix:** Added `hydrateBackgroundSourceImagesFromLibrary` to the physicPaintStore import in efxPaintStore.ts and a fire-and-forget call at the end of `hydrateRuntimeFromDocument`. `efxPaintStore.ts` is already a plan-modified file (Task 2), so no new file entered scope. The call is fire-and-forget: document registration stays synchronous; pending decodes resolve conservatively (null this tick, re-render on decode-complete); registration is runtime-only (no documentRevision bump, no undo record, no dirty callback).
- **Files modified:** app/src/stores/efxPaintStore.ts
- **Verification:** physicPaintStore.test.ts 69 passed; plan-level targeted suites 112 passed; full suite 3099 passed | 1 skipped | 101 todo; `pnpm --dir app run typecheck` exits 0
- **Committed in:** 379d6bda (Task 3 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The wiring was necessary for the plan's own goal (reopen-path hydration, Pitfall 5) — without it the hydration step would be dead code. No scope creep; the change is confined to an already-plan-modified file.

## Issues Encountered

- **`flatDocument is not defined` (RED phase, Task 3):** the first hydration describe block was placed OUTSIDE the `getFlattenedFrame` describe, but the harness helpers (`flatDocument`, `FLAT_LAYER`, `DeferredFlatTestImage`, `makeFrame`, `getEfxPaintDocument`) are scoped inside it. Fixed by moving the block inside the `getFlattenedFrame` describe and adding the missing closing `});`.
- **MISSING IS EXPLICIT test failed (GREEN phase, Task 3):** the `hydrationPorts` helper's `resolveAssetUrl` treated any `asset-*` ref as present, so 'asset-missing' WAS registered. Fixed by overriding `resolveAssetUrl` in the MISSING test to return null for 'asset-missing' (only 'asset-present' resolves).
- **Typecheck error `Module '"./imageStore"' has no exported member 'getById'`:** `getById` is a method on the `imageStore` const object, not a named export. Fixed by importing `{ imageStore }` and calling `imageStore.getById(ref)`.
- **Existing test safety:** `hydrateRuntimeFromDocument` is called in efxPaintStore.test.ts and efxPaintPersistenceMultiTrackRoundTrip.test.ts; the fire-and-forget hydration fails closed (fetch on `efxasset://` fails in tests → null → nothing registers), so no regression.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **49-04/49-05/49-06 consume these ops and the locked reason strings without re-deriving law.** Final op signatures:
  - `addBackgroundClip(layerId, { startFrame, sourceFrameRefs, repeat })`
  - `moveBackgroundClip(layerId, clipId, startFrame)`
  - `setBackgroundClipRepeat(layerId, clipId, repeat)`
  - `deleteBackgroundClip(layerId, clipId)`
  - `setBackgroundFallback(layerId, fallback)`
  - Rejection-reason union: `'start-collision' | 'invalid-repeat' | 'clip-not-found' | 'invalid-source-refs'`
- **Hydration entry points:** `hydrateBackgroundSourceImages(document, ports)` (testable, injectable ports) and `hydrateBackgroundSourceImagesFromLibrary(document)` (production), already wired into `hydrateRuntimeFromDocument`.
- **49-03** (fond re-wire + selector) can consume `setBackgroundFallback` with the extended union from 49-01.
- The `photo` mode remains reserved for the Phase 50 photoReference track (D-11).

## Self-Check: PASSED

- FOUND: app/src/efx-paint/utils/naturalFilenameSort.ts
- FOUND: app/src/efx-paint/utils/naturalFilenameSort.test.ts
- FOUND: 2f40f5a1 (RED), e83a7399 (GREEN), 071c269b (RED), 98056ff8 (GREEN), 0e6e328f (RED), 379d6bda (GREEN)

---
*Phase: 49-fixed-background-track-and-imported-loop-clips*
*Completed: 2026-08-31*
