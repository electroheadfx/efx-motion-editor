---
phase: 63-brush-tip-pipeline
plan: 07
subsystem: storage
tags: [brush-tips, project-open, mask-registry, project-scope, cross-realm, tdd, preact-signals]

requires:
  - phase: 63-brush-tip-pipeline
    provides: "63-02's one-shot native brush-asset read and its five-reason taxonomy"
  - phase: 63-brush-tip-pipeline
    provides: "63-03's built-in tips/masks and the module-level mask registry"
  - phase: 63-brush-tip-pipeline
    provides: "63-04's replace-only project catalog and the package carrier law"
  - phase: 63-brush-tip-pipeline
    provides: "63-05's cross-realm catalog payload plus publisher/installer"
provides:
  - "loadProjectBrushSet: one native read per open — validated entries with decoded 36,864-byte masks, per-tip failures, unavailable ids and stored WebP bodies"
  - "openProject registers the set after the close/reset and before hydrate, gated by a monotonic open token that a close also bumps"
  - "Per-tip degradation: unavailable tips stay listed with null digest/mask, paint with the neutral round preset, and collapse into one aggregate unavailable state"
  - "resetAquarelleBrushState: close/New Project restores exactly the three built-ins, clears the unavailable set and empties the stored-asset cache"
  - "Every applied open and every reset publishes the catalog snapshot (masks + stored WebP bytes) to the Studio through the main-realm transport"
affects: [63-08, 63-09, verify-work]

actuals:
  tokens: 15277
  tasks: 3
  commits: 5
  plan_head_before: bc0a216a9a1f35fd5d64b98733aee9b486ad4736
  plan_head_after: 5ec3a029e3ea071bd6ed01e4fec8be80096beed5

tech-stack:
  added: []
  patterns:
    - "A loader that mirrors efxPaintMediaMaterialize: one native batch read, collected failures, immutable frozen result — the open never throws"
    - "Planned-order degradation: one pass builds the listed entries, the unavailable ids and the failures, so listing order is snapshot order and the three views cannot drift"
    - "Cycle-safe publisher hook: the catalog store exposes _setBrushCatalogPublisher; the bridge (which imports the store) installs it, the store never imports the bridge"
    - "A close bumps the open-request token, so an in-flight open can neither apply nor publish over the closed project"

key-files:
  created:
    - app/src/lib/efxPaintBrushSet.ts
  modified:
    - app/src/lib/efxPaintBrushSet.test.ts
    - app/src/stores/projectStore.ts
    - app/src/stores/aquarelleBrushCatalog.ts
    - app/src/stores/aquarelleBrushCatalog.test.ts
    - app/src/stores/projectStore.efxPaintCutover.test.ts
    - app/src/lib/physicPaintBridge.ts
    - app/src/lib/physicPaintBridge.test.ts

key-decisions:
  - "Unavailable tips are LISTED with digest/mask null and only stay out of the mask registry; the library greys them instead of losing them (D-18). A record whose only carrier violation is its asset ref is recovered by dropping that member and re-validating, so it too can be listed."
  - "The loader distinguishes invalid-entry (carrier law violated beyond the asset member) from invalid-asset-ref (a valid tip with a missing/invalid asset ref): only the latter is listed and marked unavailable."
  - "The publisher hook lives in the catalog store and is installed by installPhysicPaintBrushCatalogRequestListener. A direct projectStore call would invert the existing edge (physicPaintBridge imports projectStore), and the store is the single choke point for both the open apply and the close reset."
  - "closeProject bumps openRequestSeq. A user close during an open must invalidate that open, which the Task 1 token check then turns into a clean abandonment before apply/hydrate/publish."
  - "The published payload keeps carrying each custom tip's decoded mask AND stored WebP bytes: the Studio's roto-script save leg has no other source for maskDataUrl (TIP-17)."

patterns-established:
  - "An open's brush set is loaded, then registered after the reset and before hydrate, so painting from a half-registered state is impossible by construction (TIP-12 / D-17)."
  - "Project-scoped catalog state is replace-only end to end: apply replaces, close resets to the three built-ins, and generation bumps invalidate every derived cache."

requirements-completed: [TIP-07, TIP-10, TIP-12, TIP-17]

coverage:
  - id: D1
    description: "loadProjectBrushSet reads the whole brush set with exactly one injected-port call and pairs each healthy tip with its decoded 36,864-byte mask; an absent brushPack asks the native boundary for nothing"
    requirement: "TIP-07"
    verification:
      - kind: unit
        ref: "app/src/lib/efxPaintBrushSet.test.ts#reads the whole set with exactly one call and pairs each tip with its mask"
        status: pass
      - kind: unit
        ref: "app/src/lib/efxPaintBrushSet.test.ts#an absent brushPack asks the native boundary for nothing"
        status: pass
    human_judgment: false
  - id: D2
    description: "Per-tip degradation: a refused batch, a single failed entry, a digest mismatch, an invalid or absent asset ref each keep the tip listed and unavailable with its reason preserved; three failures collapse into one aggregate unavailable state"
    requirement: "TIP-10"
    verification:
      - kind: unit
        ref: "app/src/lib/efxPaintBrushSet.test.ts#a refused batch degrades every requested tip, keeps each listed, and never throws"
        status: pass
      - kind: unit
        ref: "app/src/lib/efxPaintBrushSet.test.ts#three failures produce one aggregate unavailable state with three ids"
        status: pass
      - kind: unit
        ref: "app/src/stores/aquarelleBrushCatalog.test.ts#an unavailable custom stays listed yet paints with the neutral round fallback, never a partial mask"
        status: pass
    human_judgment: false
  - id: D3
    description: "openProject loads the set before the close/reset, applies it after the reset and before hydrate, remembers the stored bytes and marks them written for the package root"
    requirement: "TIP-12"
    verification:
      - kind: unit
        ref: "app/src/lib/efxPaintBrushSet.test.ts#applies the set after the close/reset and before hydrate (source-order pin)"
        status: pass
      - kind: unit
        ref: "app/src/stores/aquarelleBrushCatalog.test.ts#replaces customs, registry and unavailable set from ONE open and marks its assets written"
        status: pass
    human_judgment: false
  - id: D4
    description: "Open B replaces open A; close/New Project restores exactly the three built-ins and empties the stored-asset cache; the published payload carries each custom tip's mask and stored WebP bytes"
    requirement: "TIP-17"
    verification:
      - kind: unit
        ref: "app/src/stores/aquarelleBrushCatalog.test.ts#opening B replaces open A: only B is listed, resolvable and remembered"
        status: pass
      - kind: unit
        ref: "app/src/stores/aquarelleBrushCatalog.test.ts#close resets to exactly the three built-ins and empties the asset cache"
        status: pass
      - kind: unit
        ref: "app/src/stores/aquarelleBrushCatalog.test.ts#the published payload carries each custom tip mask and its stored WebP bytes"
        status: pass
      - kind: unit
        ref: "app/src/lib/physicPaintBridge.test.ts#installing the catalog transport wires the store publisher (63-07 / TIP-17)"
        status: pass
    human_judgment: false
  - id: D5
    description: "An open superseded by a later open never applies its stale brush set, and never emits a catalog snapshot"
    requirement: "TIP-12"
    verification:
      - kind: integration
        ref: "app/src/stores/projectStore.efxPaintCutover.test.ts#a superseded open never applies its stale brush set over the newer project"
        status: pass
      - kind: integration
        ref: "app/src/stores/projectStore.efxPaintCutover.test.ts#a superseded open never emits a catalog snapshot"
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-11-15
status: complete
---

# Phase 63 Plan 07: Project-Open Brush Set Summary

**A project's brush masks are now decoded once and registered before the first replay, degrade per tip without ever aborting the open, replace wholesale across projects, and reset to the three built-ins on close — with the Studio receiving masks plus stored WebP bytes on every open and reset.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-11-15T12:44:01Z
- **Completed:** 2026-11-15T13:01:28Z
- **Tasks:** 3
- **Files modified:** 9 (8 code/test files + 1 RED evidence record)

## Accomplishments

- `loadProjectBrushSet` turns the `.mce` root `brushPack` into applicable state with ONE native batch read: validated package entries, decoded masks, stored WebP bodies, unavailable ids, and per-tip failures that are logged but never thrown.
- `openProject` now loads the set before the close/reset and applies it after the reset and before `hydrateFromMce`; a monotonic request token (also bumped by `closeProject`) makes a superseded open abandon before it can apply, hydrate or publish.
- Degradation is honest and per tip (D-18): unavailable tips stay listed with null digest/mask so the library can grey them, paint with the neutral round preset, and collapse into one aggregate unavailable state with every reason preserved.
- `resetAquarelleBrushState` makes the catalog project-scoped (D-20): close and New Project restore exactly the three built-ins, clear the unavailable set and empty the stored-asset cache.
- Every applied open and every reset publishes the catalog snapshot to the Studio, including each custom tip's decoded mask and stored WebP bytes — the only source the Studio's roto-script save leg has for `maskDataUrl`.

## Task Commits

Each task was committed atomically (Task 2 required two RED commits — see deviations):

1. **Task 1: End-to-end open — one package's tips are registered before hydrate** - `31e197965` (feat)
2. **Task 2: Degrade per tip — unavailable, round fallback, one warning** - `312de1bbc` (test, RED) → `c880091f0` (test, RED consistency fix) → `a288198ba` (feat, GREEN)
3. **Task 3: Replace on open, reset on close, publish to the Studio** - `5ec3a029e` (feat)

**Plan metadata:** docs commit follows this summary.

## Files Created/Modified

- `app/src/lib/efxPaintBrushSet.ts` (created) — the fail-closed open-leg loader: one native read, planned-order entries/unavailable/failures, asset-ref recovery, batch and per-entry degradation.
- `app/src/lib/efxPaintBrushSet.test.ts` (created, then extended) — the loader laws plus the source-order pin (`load` < `close` < `apply` < `hydrate`).
- `app/src/stores/aquarelleBrushCatalog.ts` — `applyProjectBrushSet` (replace customs, registry, unavailable set; remember + mark written), `resetAquarelleBrushState`, and `_setBrushCatalogPublisher` fired on every apply and reset.
- `app/src/stores/aquarelleBrushCatalog.test.ts` — open-replace, close-reset, round-fallback, publish-count and payload-bytes pins.
- `app/src/stores/projectStore.ts` — brush-set load/apply seams with token checks, close-time token bump and reset call.
- `app/src/stores/projectStore.efxPaintCutover.test.ts` — integration harness for the two superseded-open acceptance tests.
- `app/src/lib/physicPaintBridge.ts` — the main-realm catalog installer now wires and restores the store publisher.
- `app/src/lib/physicPaintBridge.test.ts` — installer-wires-publisher pin.
- `.planning/phases/63-brush-tip-pipeline/63-07-red-evidence-task2.json` — Task 2 RED evidence (TAP, 6 failing / 20 passing, `RED_EVIDENCE_OK`).

## Decisions Made

- Unavailable tips stay listed with null digest/mask; only the registry excludes them. A record whose only carrier violation is its `asset` member is recovered by dropping that member and re-validating, so it can be listed too.
- `invalid-entry` (a carrier violation beyond the asset member) and `invalid-asset-ref` (a valid tip with a missing/invalid ref) are distinct: only the latter is listed and marked unavailable; neither reaches the read port.
- The publisher is a hook in the catalog store installed by `installPhysicPaintBrushCatalogRequestListener`. Direct calls from `projectStore` would invert the existing dependency edge (the bridge imports the project store), and the store is the single choke point for both the open apply and the close reset.
- `closeProject` bumps the open-request token so a user close during an open invalidates it; the open adopts the post-close token when it initiated the close itself.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected an internally inconsistent RED assertion before GREEN**
- **Found during:** Task 2 (Degrade per tip)
- **Issue:** The first RED capture asserted two contradictory laws for a record with an invalid asset ref — one test expected it unlisted, another expected it listed with a null mask. The plan is explicit that unavailable entries must still be listed so the library can grey them.
- **Fix:** Corrected the listing assertion to expect the recovered tip first with a null mask; re-ran the RED capture (same 6 failing loader assertions, target test failing on the listing join) and re-validated `RED_EVIDENCE_OK`. The correction is its own commit (`c880091f0`) so the GREEN commit stays production-only.
- **Files modified:** `app/src/lib/efxPaintBrushSet.test.ts`, `63-07-red-evidence-task2.json`
- **Verification:** `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK`; later GREEN run 26/26.
- **Committed in:** `c880091f0`

**2. [Rule 2 - Missing Critical] Extended the cutover harness beyond the declared file list for the superseded-open laws**
- **Found during:** Tasks 1 and 3
- **Issue:** The plan lists no project-store test harness, but the token gating ("never applies its stale brush set", "never emits a catalog snapshot") can only be proven by driving `openProject` concurrently.
- **Fix:** Extended `projectStore.efxPaintCutover.test.ts` (already used by this phase) with a deferred-read superseded-open scenario and a publisher-count assertion.
- **Files modified:** `app/src/stores/projectStore.efxPaintCutover.test.ts`
- **Verification:** 30/30 tests in the harness.
- **Committed in:** `31e197965` and `5ec3a029e`

**3. [Rule 3 - Blocking] Publisher wiring through a store hook instead of a direct projectStore import**
- **Found during:** Task 3 (publish after open and reset)
- **Issue:** `physicPaintBridge` imports `projectStore`, so a static import of the publisher from `projectStore` would create an ESM cycle.
- **Fix:** The catalog store exposes `_setBrushCatalogPublisher`; the main-realm catalog installer wires it to `publishPhysicPaintBrushCatalog` and restores it on cleanup. The open apply and the close reset both publish through this one hook.
- **Files modified:** `app/src/stores/aquarelleBrushCatalog.ts`, `app/src/lib/physicPaintBridge.ts`
- **Verification:** bridge wiring test plus the cutover publish-count test.
- **Committed in:** `5ec3a029e`

---

**Total deviations:** 3 auto-fixed (1 bug, 1 missing critical, 1 blocking)
**Impact on plan:** All three were required for correctness or testability. No scope creep beyond the plan's stated laws.

## Issues Encountered

- The Task 2 RED type reshape (`digest`/`mask` nullable) required one optional-chaining accessor fix in the Task 1 test; `tsc --noEmit` is clean after it.

## Known Stubs

None — no placeholder values, TODOs, or unwired data sources were introduced.

## Threat Flags

None — no new network endpoints, auth paths or trust boundaries. The loader stays behind the Rust pre-decode guard (T-63-20) and the replace-only lifecycle (T-63-21).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The open/close lifecycle is project-scoped end to end; 63-08 can build the save leg on `markBrushAssetsWritten` plus `buildProjectBrushPack` without re-deriving masks.
- Plan-level verification is green: 213 assertions across the four plan suites (1 pre-existing skip), 54 persistence assertions, 30 cutover tests, `tsc --noEmit` clean.
- The ordering pin fails if registration is ever moved after `hydrateFromMce`.

## Self-Check: PASSED

- SUMMARY exists at `.planning/phases/63-brush-tip-pipeline/63-07-SUMMARY.md`
- Commits `31e197965`, `312de1bbc`, `c880091f0`, `a288198ba`, `5ec3a029e` are ancestors of HEAD
- Created artifacts exist: `app/src/lib/efxPaintBrushSet.ts`, `63-07-red-evidence-task2.json`

---
*Phase: 63-brush-tip-pipeline*
*Completed: 2026-11-15*
