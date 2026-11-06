---
phase: 59-rail-motion-channels-v7-interface
plan: 08
subsystem: compositor
tags: [typescript, canvas-2d, affine-transform, cache-key, revision-terms, pivot-memo, tdd, motn-07, motn-08, motn-09, rel-03]

# Dependency graph
requires:
  - phase: 59-05
    provides: "The single rail-motion evaluator (`evaluateRailMotion`, `resolveRailLocalFrame`) — endpoint hold, bounded values"
  - phase: 59-06
    provides: "Rail views (`assignRailMotionRailViews`) and reconciliation (`reconcileRailMotions`) — frame-range authority"
  - phase: 59-07
    provides: "`rasterRevision` vs canonical `contentRevision`, and the structural cache entry carrying rail motion"
provides:
  - "One affine transform per animated track, applied at both compositor draw sites through a shared draw helper; identity transforms take a zero-op fast path"
  - "`trackTransforms` compositor port and `EfxPaintTrackMotionTransform` (normalized pivot 0..1)"
  - "`trackMotionRevisions` key input and the conditional `motion:` term — a collection revision, never a sampled value"
  - "`resolveRailMotionPivot` / `computeRailInkBounds`: pure, memoized, injected-measurer pivot from drawing-key ink bounds"
  - "`measureRailMotionRasterInk`: the bounded 256px alpha scan, kept out of the store (P4(c))"
affects: [59-09, 59-11, 59-12, 59-13, 59-14, 59-16]

actuals:
  tokens: 28662
  tasks: 3
  commits: 6

plan_head_before: d3cb1d7d14055a483df3464cd908e02a6b40da68
plan_head_after: b3ef91e2d

tech-stack:
  added: []
  patterns:
    - "One transform application site: both compositor draw paths share `drawEfxPaintTrack`; a second application anywhere else is the forbidden second path"
    - "Cache keys carry collection revisions, never sampled values — `motion:` follows the `excl:`/`fond:0`/`bg:0`/`solo:` conditional-emission precedent so motion-free keys stay byte-identical"
    - "Pivot measured once per rail + pixel-identity revision with an injected measurer; the store resolves the decoded raster and a DOM-side module owns the bounded alpha scan"
    - "Pixel-array canvas APIs stay out of `physicPaintStore.ts` (P4(c)); pixel work lives in roto modules next to its consumers"

key-files:
  created:
    - app/src/efx-paint/compositor/efxPaintCompositorRailMotion.test.ts
    - app/src/components/physic-paint/roto/railMotionPivot.ts
    - app/src/components/physic-paint/roto/railMotionPivot.test.ts
    - app/src/components/physic-paint/roto/railMotionInkScan.ts
    - app/src/components/physic-paint/roto/railMotionInkScan.test.ts
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-08-task1.json
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-08-task2.json
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-08-task3.json
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence/red-59-08-task1.xml
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence/red-59-08-task2.xml
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence/red-59-08-task3.xml
  modified:
    - app/src/efx-paint/compositor/efxPaintCompositor.ts
    - app/src/efx-paint/compositor/efxPaintCompositeCache.ts
    - app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts
    - app/src/stores/physicPaintStore.ts
    - app/src/lib/paperPass.frameGuard.test.ts

key-decisions:
  - "The pivot is keyed on `structural.rasterRevision` (pixel identity), never the canonical revision: a motion-only edit must not re-scan 24 key rasters (T-59-24). The resolver argument keeps the name `contentRevision` with a doc note that callers pass the pixel-identity revision."
  - "Both draw sites share one helper (`drawEfxPaintTrack`) instead of duplicating an op sequence — the plan allowed either, and the single-helper form makes one-site-only drift structurally impossible. The D-19 alpha product therefore has exactly one expression in the file."
  - "The alpha scan lives in `railMotionInkScan.ts`, not the store: `paperPass.frameGuard.test.ts` P4(c) bans `getImageData`/`putImageData` in `physicPaintStore.ts`. The store only resolves the decoded raster and delegates."
  - "The pivot is stored in normalized raster coordinates so the compositor never reads an intrinsic raster size; the fallback is the documented raster centre 0.5/0.5 and still transforms (`measured: false` is legitimate, not an error)."
  - "The rail-view projection memo is invalidated by structural-entry identity (the structural cache's own pattern), not by explicit hooks; the per-frame path re-derives nothing."

patterns-established:
  - "Shared draw helper for every track raster: transform + alpha + blend + drawImage in one place"
  - "Conditional cache-key term: emitted only when its collection is non-empty, sorted and length-prefixed with the canonical encoder"
  - "Injected measurer for pixel work: pure pivot module + DOM scan module + store resolution glue"

requirements-completed: [REL-03]

coverage:
  - id: D1
    description: "Rail transform applied once at the compositor to both draw sites (normal track and Studio engine overlay), with identity fast path and the `track.opacity × motion.opacity` product"
    requirement: MOTN-07
    verification:
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositorRailMotion.test.ts#compositeFrame — rail motion transform (MOTN-07/MOTN-08)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Flattened cache key gains a motion collection term; motion-free keys stay byte-identical and no sampled value ever enters a key"
    requirement: REL-03
    verification:
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts#deriveEfxPaintFlattenedCacheKey — motion term (59-08 / REL-03)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Memoized rail-space pivot from drawing-key ink bounds with a bounded, injected alpha scan and a measured Gate D cost"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionPivot.test.ts#resolveRailMotionPivot"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionInkScan.test.ts#measureRailMotionRasterInk"
        status: pass
    human_judgment: false
  - id: D4
    description: "Live edit-view / Play / export visual parity for an animated rail, including the Studio overlay track"
    requirement: MOTN-08
    verification: []
    human_judgment: true
    rationale: "Live canvas rendering in the Tauri WebView is not observable from the node test environment; export parity is completed by 59-09's sub-frame export law and the live UAT rows land in 59-14."

metrics:
  duration: "3h 50m"
  completed: "2026-11-06"
  files_modified: 5
  files_created: 11
  status: complete
---

# Phase 59 Plan 08: Compositor Rail Motion, Cache Motion Term, and Memoized Pivot Summary

**Rail motion now reaches the canvas through exactly one transform path at the compositor, re-composites on a motion collection revision without ever sampling a value into a key, and pivots on an ink-bounds centre measured once per rail revision.**

## Performance

- **Duration:** ~3h 50m wall clock (11:56Z–15:46Z; includes idle gaps between tool runs)
- **Started:** 2026-11-06T11:56Z
- **Completed:** 2026-11-06T15:46Z
- **Tasks:** 3
- **Files modified:** 5 source/test files; 5 source/test files created, plus 6 RED evidence artifacts

## Accomplishments

- **One transform application site, proven identical for both draw paths.** `EfxPaintTrackMotionTransform` (normalized pivot), the `trackTransforms` port, `isEfxPaintTrackMotionIdentity`, and a shared `drawEfxPaintTrack` helper now serve both the Studio engine-overlay branch and the normal store-raster branch. Op order is `translate(pivotX·w + dx, pivotY·h + dy) → rotate(radians) → scale(s,s) → translate(−pivotX·w, −pivotY·h)` between `save()` and `drawImage()`; the blend-mode assignment stays before the transform ops. The 7-row suite pins the overlay site, the pivot sequence, the D-19 alpha product, the identity zero-op fast path (whole op list equals the pre-59 baseline), un-animated sibling parity, and raster-memo reuse across a motion-only edit.
- **The flattened cache key carries the motion collection, never a value.** `trackMotionRevisions` is filtered to participating tracks and sorted by track id; the `motion:` term is emitted only when non-empty. Two pinned literals (`flattened-137-220a58d8`, `flattened-232-7bad3bb5`) prove motion-free keys are byte-identical to the pre-change derivation; a motion-only edit rotates `motion:` while `tracks:` stays put; a drawing-key edit rotates both.
- **The store supplies both maps at the single composite call site.** `_trackContentRevision` returns `structural.rasterRevision` (motion-independent); the new `_trackMotionRevision` is the only other canonical reader besides `getRotoPhysicalContentRevision` (grep: exactly two lines). A per-track projection memo (structural-entry identity) builds loop-clip and key-rail sources, derives segments, assigns and reconciles views, and caches a half-open frame→view lookup. Tracks with no view at a frame contribute no transform entry at all — the compositor's absent path stays the common path.
- **The pivot is stable and cheap.** `resolveRailMotionPivot` unions drawing-key ink boxes (degenerate/non-finite skipped, centre clamped 0..1), ignores keys with no alpha ink, and memoizes per `railId + revision` with a 512-entry FIFO. The production scan draws the already-decoded raster into a 256px-long-edge offscreen canvas, reads alpha once, and never triggers a decode. **Gate D measured:** 24 keys / 1920px source / 256×144 scan grid → first resolution **2.319 ms**, memo hit **0.0023 ms**, zero measures on the second call.

## Task Commits

Tasks 1–2 followed separate RED → GREEN commits; Task 3's validated RED run and implementation landed in one commit (see TDD Gate Compliance).

1. **Task 1 RED: add failing rail motion compositor pins** - `ea6f9e7f9` (test)
2. **Task 1 GREEN: apply rail motion at both compositor draw sites** - `03c2278a3` (feat)
3. **Task 2 RED: add failing rail motion cache-term pins** - `8119c49b0` (test)
4. **Task 2 GREEN: supply rail transforms and the motion key term from the store** - `6619bace1` (feat)
5. **Task 3: pivot rail motion on memoized drawing-key ink bounds** - `7c8fec55d` (feat, includes its RED evidence)
6. **Guard reconciliation: move the pivot alpha scan out of the store** - `b3ef91e2d` (fix)

**Plan metadata:** `docs(59-08): complete ... plan` (final commit)

_Note: TDD tasks have multiple commits (test → feat)._

## TDD Gate Compliance

All three RED records were validated by `gsd_run check tdd-red-evidence` with verdict `RED_EVIDENCE_OK` (JUnit format, target test failed with exit 1, zero report errors, semantic assessment recorded):

| Task | Record | Target test | Outcome | Commits |
|------|--------|-------------|---------|---------|
| 1 | `red-evidence-59-08-task1.json` | `compositeFrame — rail motion transform (MOTN-07/MOTN-08) > applies translate, rotate, scale, translate around the normalized pivot at the normal draw site` | failed as expected (7 tests, 6 failures) | `ea6f9e7f9` → `03c2278a3` |
| 2 | `red-evidence-59-08-task2.json` | `deriveEfxPaintFlattenedCacheKey — motion term (59-08 / REL-03) > rotates the key on a motion-only edit while the content revisions stay put` | failed as expected (22 tests, 1 failure) | `8119c49b0` → `6619bace1` |
| 3 | `red-evidence-59-08-task3.json` | `resolveRailMotionPivot > measures each source exactly once and returns zero measures on a memo hit` | failed as expected (12 tests, 9 failures) | `7c8fec55d` (combined) |

**Commit-boundary violation (advisory):** Task 3 has no standalone `test(59-08)` commit. The RED evidence was captured against the actual failing suite with the implementation temporarily reverted (backup `/tmp/59-08-task3-backup/railMotionPivot.impl.ts`, restored afterwards); the test file, implementation and evidence were then committed together in `7c8fec55d`. Evidence is valid — only the commit split is missing.

## Files Created/Modified

- `app/src/efx-paint/compositor/efxPaintCompositor.ts` — `EfxPaintTrackMotionTransform`, `isEfxPaintTrackMotionIdentity`, `trackTransforms` port, and the shared `drawEfxPaintTrack` helper used by both draw sites (alpha product + blend + transform + drawImage).
- `app/src/efx-paint/compositor/efxPaintCompositorRailMotion.test.ts` — 7 rows over a recording 2D context: pivot op sequence, overlay-site parity, D-19 alpha product, identity zero-op/baseline equality, un-animated sibling parity, raster-memo reuse, exact identity predicate.
- `app/src/efx-paint/compositor/efxPaintCompositeCache.ts` — `trackMotionRevisions` input, participating/sorted terms, conditional `motion:` key term, `EMPTY_MOTION_REVISIONS`.
- `app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts` — motion term rows with pinned motion-free literals, motion-only rotation, sorted determinism, hidden-track filtering, revision stability.
- `app/src/stores/physicPaintStore.ts` — projection memo, frame→view lookup, transform resolver, pivot measurer delegation, `_trackContentRevision` → raster revision, `_trackMotionRevision`, `trackTransforms`/`trackMotionRevisions` at the composite call site.
- `app/src/components/physic-paint/roto/railMotionPivot.ts` — pure `computeRailInkBounds` + memoized `resolveRailMotionPivot` with the injected measurer and a 512-entry FIFO.
- `app/src/components/physic-paint/roto/railMotionPivot.test.ts` — 12 rows including the Gate D benchmark.
- `app/src/components/physic-paint/roto/railMotionInkScan.ts` — bounded offscreen alpha scan (256px long edge) with normalized bounds.
- `app/src/components/physic-paint/roto/railMotionInkScan.test.ts` — fake-canvas contract: scan grid, normalized bounds, no upscale, ink-less key, zero-size, null context, released raster, purity.
- `app/src/lib/paperPass.frameGuard.test.ts` — U2 compositor pin re-pointed at the shared helper call (intent unchanged).

## Decisions Made

- **Pivot memo key is the raster revision, not the canonical revision.** Motion edits must not re-scan key rasters; `structural.rasterRevision` is the pixel identity by 59-07's construction. The API parameter keeps its plan-mandated name with a doc note.
- **One shared draw helper over two inline sequences.** The plan's acceptance criteria offered either; the helper form makes the "no second application site" prohibition structural. Consequence: `globalAlpha` has one product expression in the file rather than two (see Deviations).
- **The scan lives outside the store.** P4(c) is an absolute source-level ban on pixel-array APIs in `physicPaintStore.ts`; the store resolves decoded rasters and delegates to `measureRailMotionRasterInk`.
- **A fallback pivot still transforms.** `measured: false` only means no ink/decode; it is not an error and does not suppress motion.
- **`motion:` follows the established conditional-term precedent.** Non-empty only, sorted, length-prefixed; every pre-59 key stays byte-identical, which the pinned literals enforce.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] P4(c) guard banned pixel-array canvas APIs in the store**
- **Found during:** full-suite verification after Task 3
- **Issue:** `app/src/lib/paperPass.frameGuard.test.ts` P4(c) asserts `physicPaintStore.ts` contains no `getImageData`/`putImageData` (the real-time playback guardrail). The planned production measurer put the alpha scan in the store.
- **Fix:** Extracted the bounded scan into `app/src/components/physic-paint/roto/railMotionInkScan.ts` (`measureRailMotionRasterInk`), with `railMotionInkScan.test.ts` covering it via a fake canvas. The store now only resolves the decoded raster (alpha-canvas registry, then decode LRU) and delegates; `railMotionPivot.ts` remains pure.
- **Files modified:** `app/src/stores/physicPaintStore.ts`, `app/src/components/physic-paint/roto/railMotionInkScan.ts` (new), `app/src/components/physic-paint/roto/railMotionInkScan.test.ts` (new)
- **Verification:** P4(c) passes; `grep -n "getImageData\|putImageData" app/src/stores/physicPaintStore.ts` returns nothing; the new module suite passes 7/7; full suite exits 0.
- **Committed in:** `b3ef91e2d`

**2. [Rule 3 - Blocking] U2 guard pinned the pre-refactor inline overlay call**
- **Found during:** full-suite verification after Task 1
- **Issue:** U2 asserted `/drawImage\(ports\.engineOverlay!\.raster/`, but Task 1 moved both sites onto `drawEfxPaintTrack(ctx, ports.engineOverlay!.raster, ...)`.
- **Fix:** Re-pinned the regex to `drawEfxPaintTrack\(\s*ctx,\s*ports\.engineOverlay!\.raster,` with a comment naming the 59-08 shared helper. The guard's intent — the overlay raster draws at the track slot inside the compositor's ordered loop — is unchanged.
- **Files modified:** `app/src/lib/paperPass.frameGuard.test.ts`
- **Verification:** U2 passes; the full suite exits 0.
- **Committed in:** `b3ef91e2d`

### Process and design deviations (additive, no behavior outside the planned contract)

- **Three files beyond the plan's `files_modified` list:** `railMotionInkScan.ts`, `railMotionInkScan.test.ts` (P4(c) extraction) and `paperPass.frameGuard.test.ts` (U2 re-pin).
- **The plan's verification bullet "exactly two product expressions" is realized as one.** The shared helper is the single product site; the remaining `globalAlpha = 1` assignments are pre-existing background/clip resets, not track draws. The acceptance criteria explicitly allow the shared-helper form.
- **Task 3's RED/GREEN share one commit** (see TDD Gate Compliance).

---

**Total deviations:** 2 auto-fixed (both Rule 3 blocking), 3 process/design notes
**Impact on plan:** Both auto-fixes were required to keep existing guards meaningful under the planned refactor; no scope creep and no behavior change beyond the plan's contract.

## Issues Encountered

- The first pinned cache-key literal was unstable because `createEfxPaintDocument` mints a `crypto.randomUUID()` background id. Fixed by pinning `background: { id: 'background-fixed' }` and re-verifying the literals across two runs.
- Floating-point union centres produced `0.39999999999999997`; assertions use `toBeCloseTo(..., 12)`.
- A doc comment wrote the literal `structural.contentRevision`, which tripped the two-line grep gate; the comment now names "the structural content revision" instead.
- Typecheck flagged unused `source` parameters in the test file; renamed to `_source`.

## Threat Surface Scan

No new security-relevant surface beyond the plan's threat register. Mitigations landed: T-59-22 (finite-checked parser values, clamped opacity, floored scale, single application site, identity fast path pinned by a zero-op assertion); T-59-23 (`motion:` carries the collection revision only; tests pin no sampled value in any key and untouched `tracks:` on a motion-only edit); T-59-24 (256px bounded scan, one measure per rail + raster revision, memo-hit assertion, Gate D numbers recorded); T-59-SC (no package install).

## Known Stubs

None. Every port, term and memo path is read by production code; the fallback pivot is a documented, tested contract rather than a placeholder.

## User Setup Required

None.

## Next Phase Readiness

- 59-09 can consume `trackTransforms`/`trackMotionRevisions` for the sub-frame export law; the transform is already frame-fraction-friendly because the compositor never reads intrinsic raster sizes.
- 59-11/59-12/59-13 can drive motion edits knowing the cache rotates on the collection revision and every animated track reaches the canvas through one path.
- Requirements: REL-03 is marked complete (both clauses delivered by 59-07 + 59-08 and pinned deterministically). MOTN-07/08/09 remain pending live UAT, export parity (59-09) and the animate/gizmo UI (59-12/59-13).
- Verification state: typecheck exit 0; compositor suites 11 files / 139 tests pass; `paperPass.frameGuard.test.ts` passes; full suite 387 files / 7589 tests pass (2 skipped files, 1 skipped test, 96 todo); `grep 'structural.contentRevision'` = exactly 2 lines; `grep globalAlpha` shows the single product on the shared helper.

## Self-Check: PASSED

All claimed files exist and all six plan commits are ancestors of HEAD.
