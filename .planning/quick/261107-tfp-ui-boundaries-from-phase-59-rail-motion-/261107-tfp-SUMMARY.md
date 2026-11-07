---
phase: 261107-tfp-ui-boundaries-from-phase-59-rail-motion-
plan: 01
subsystem: ui
tags: [preact, signals, rail-motion, alpha-scan, gizmo, bounds, memo]

# Dependency graph
requires:
  - phase: 59-08
    provides: the bounded 256px rail ink scanner and the railId + rasterRevision pivot memo (resolveRailMotionPivot)
  - phase: 59-13
    provides: the rail-motion gizmo payload + target-dispatched handles and buildRailMotionEditCss
provides:
  - getRailMotionBounds — the pivot-based mirror of the compositor's translate/rotate/scale op order
  - resolveRailMotionKeyInkBounds and unionRailInkBoxes served from the SAME memo entry as the rail pivot
  - getRotoRailMotionCanvasInk(layerId, trackId, frame) — the displayed key's normalized ink box plus the compositor pivot
  - the gizmo payload's inkBase field and its primitive signature terms
  - the rail-motion bounds dispatch (ink base when measured, full-raster getReferenceBounds otherwise)
affects: [59 rail motion UAT, studio canvas gizmo, future rail-motion boundary work]

actuals:
  tokens: 10770
  tasks: 3
  commits: 3
  plan_head_before: 902690280d06c2e6a6d77063ce07a691931ae043
  plan_head_after: 9582d2d144093ea6665515534c534c718b8dadb2

tech-stack:
  added: []
  patterns:
    - "One memo, two views: resolveRailMotionKeyInkEntry fills the union pivot and the per-key boxes together so the gizmo and the compositor never measure a key twice"
    - "Displayed-key dispatch: a real/loop key sizes the box on its own ink, a generated in-between unions its two flanking keys, no measurable ink keeps the legacy full-raster geometry"
    - "A single displayed box returns the memoized frozen object itself, which is what makes the repeated-call identity hold"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/roto/railMotionPivot.ts
    - app/src/components/physic-paint/roto/railMotionPivot.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintReferenceTransform.ts
    - app/src/components/physic-paint/view/PhysicsPaintReferenceTransform.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
    - app/src/stores/physicPaintStore.ts
    - app/src/stores/physicPaintStore.rotoRailMotions.test.ts

key-decisions:
  - "The base rect is the DISPLAYED drawing key's ink at the cursor frame — never the rail union, the layer, or the project raster (D-01); a generated in-between uses the union of its two flanking source keys"
  - "Unmeasurable ink (empty key, undecoded raster, missing render source, no bound rail) keeps today's getReferenceBounds full-raster geometry unchanged (D-02)"
  - "The box applies the compositor pivot and op order; getReferenceBounds, getBackgroundBounds, transformBoundsCore and buildRailMotionEditCss are untouched (D-03)"
  - "Reuse the Phase 59-08 scanner and memo: no new pixel API in the store, no per-frame scan, no image decode (D-04)"
  - "No new UI, CSS, gesture-semantics change, persisted field, or signal (D-05)"

patterns-established:
  - "Shared ink cache entry `{ pivot, boxes }` keyed `${railId}:${rasterRevision}`; a single measurement pass fills both views"
  - "Rail-motion bounds dispatch: background → getBackgroundBounds; rail-motion with inkBase → getRailMotionBounds; everything else → getReferenceBounds"

requirements-completed: [QUICK-261107-TFP]

coverage:
  - id: D1
    description: "The canvas boundary box hugs the displayed key's alpha ink instead of the whole project raster; a generated in-between uses the union of its two flanking source keys"
    requirement: QUICK-261107-TFP
    verification:
      - kind: unit
        ref: "app/src/stores/physicPaintStore.rotoRailMotions.test.ts#returns the displayed key ink box, the rail union pivot and a null base for an ink-less key"
        status: pass
      - kind: unit
        ref: "app/src/stores/physicPaintStore.rotoRailMotions.test.ts#unions the two flanking source keys for a generated in-between"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintReferenceTransform.test.ts#getRailMotionBounds (261107 live UAT) (7 tests)"
        status: pass
    human_judgment: true
    rationale: "Geometry and per-key dispatch are unit-proven; the box visually hugging the painted content in the native Studio needs live UAT."
  - id: D2
    description: "A displayed key with no measured ink falls back to today's full-raster box; the getter returns null outside the rail span, for a negative/non-finite frame, for a missing track or with no rail motion"
    requirement: QUICK-261107-TFP
    verification:
      - kind: unit
        ref: "app/src/stores/physicPaintStore.rotoRailMotions.test.ts#returns null outside the rail span and for an unusable frame or track"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintReferenceTransform.test.ts#reproduces getReferenceBounds corner-for-corner for a full-frame base (fallback equality)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The box stays aligned with the composited paint under Position/Scale/Rotation (compositor pivot + op order) and the gesture bodies keep their current mapping"
    requirement: QUICK-261107-TFP
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintReferenceTransform.test.ts#getRailMotionBounds (261107 live UAT) (transform, pivot, zoom and fallback cases)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionCommands.test.ts (101 tests, gesture/handles pins)"
        status: pass
    human_judgment: true
    rationale: "The op-order mirror is unit-proven; the visual alignment during live drags is a human call."
  - id: D4
    description: "Ink measurement is memoized per rail + raster revision and shared with the pivot, so no second alpha scan and no per-frame pixel work is added"
    requirement: QUICK-261107-TFP
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionPivot.test.ts#resolveRailMotionKeyInkBounds (shared-memo measure counts and identity)"
        status: pass
      - kind: unit
        ref: "app/src/stores/physicPaintStore.rotoRailMotions.test.ts#repeated-call base identity"
        status: pass
      - kind: unit
        ref: "app/src/lib/paperPass.frameGuard.test.ts (P4(c): no pixel-array API in the store)"
        status: pass
    human_judgment: false

metrics:
  duration: 10min
  completed: 2026-11-07
  status: complete
---

# Quick 261107-tfp: Canvas boundary box hugs the displayed key's ink Summary

**The studio rail-motion boundary box now sizes itself on the displayed drawing key's alpha ink (generated in-betweens union their two flanking keys) and pivots on the compositor's own anchor, with today's full-raster box kept as the unmeasurable fallback.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-11-07T20:37:55Z
- **Completed:** 2026-11-07T20:47:24Z
- **Tasks:** 3 (all TDD: RED pin commit → GREEN source commit → wiring commit)
- **Files modified:** 8

## Accomplishments

- `getRailMotionBounds` mirrors the compositor op order (`translate(pivot+offset) → rotate → scale → translate(-pivot)`); its center is the TRANSFORMED PIVOT, and a full-frame base with pivot 0.5/0.5 reproduces `getReferenceBounds` corner-for-corner (fallback equality pinned).
- `resolveRailMotionKeyInkBounds` and `unionRailInkBoxes` extended `railMotionPivot.ts`; the pivot and the per-key boxes are filled by ONE measurement pass into a shared `{ pivot, boxes }` memo entry keyed `${railId}:${rasterRevision}` — repeated calls perform zero alpha scans.
- `getRotoRailMotionCanvasInk(layerId, trackId, frame)` returns the displayed key's normalized ink box plus the union pivot, resolving the displayed key through `getRotoPhysicalRenderSource` (`'real'` → its key; `'generated'` → the two flanking keys) and returning null outside the rail span, for a negative/non-finite frame, a missing track, or with no rail motion.
- The gizmo payload gained `inkBase` plus primitive signature terms (`'full'` sentinel when null), so the canvas-stack memo re-resolves on a key/ink change without touching the existing gates or the literal `selectedChannel,` pin.
- The handles dispatch rail-motion bounds through `getRailMotionBounds` only when `inkBase` is present; background and photo paths and every gesture body are byte-identical to before.

## Task Commits

Each task was committed atomically:

1. **Task 1: Pin per-key rail ink boxes and pivot-exact gizmo geometry (RED)** - `71ee7d504` (test)
2. **Task 2: Per-key rail ink boxes and pivot-exact motion bounds (GREEN)** - `dc4592a9c` (feat)
3. **Task 3: Size the rail-motion box on the displayed key's ink (wiring)** - `9582d2d14` (feat)

**Plan metadata:** orchestrator-owned docs commit (SUMMARY/STATE/PLAN not committed by this executor)

## Files Created/Modified

- `app/src/components/physic-paint/roto/railMotionPivot.ts` - keyed ink sources, shared `{ pivot, boxes }` memo entry, `resolveRailMotionKeyInkBounds`, `unionRailInkBoxes`.
- `app/src/components/physic-paint/roto/railMotionPivot.test.ts` - keyed fixtures, union helper cases, shared-memo measure counts and identity.
- `app/src/components/physic-paint/view/PhysicsPaintReferenceTransform.ts` - `getRailMotionBounds` (compositor op-order mirror, transformed-pivot center).
- `app/src/components/physic-paint/view/PhysicsPaintReferenceTransform.test.ts` - seven geometry cases plus the full-frame `getReferenceBounds` equality guard.
- `app/src/stores/physicPaintStore.ts` - pivot call-site keyed sources; `getRotoRailMotionCanvasInk` beside `getRotoPhysicalTrackMotionTransform`.
- `app/src/stores/physicPaintStore.rotoRailMotions.test.ts` - fake-alpha-canvas harness and three per-key ink rows (displayed key, generated union, null paths).
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` - `inkBase` on the gizmo payload and primitive signature terms.
- `app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx` - `PhysicsPaintRailMotionInkBase` prop and the bounds dispatch branch.

## Decisions Made

- The getter returns the memoized frozen box object directly when exactly one key is displayed; a multi-key (generated) base is a fresh `unionRailInkBoxes` result. That is what makes the repeated-call identity hold with zero extra cache state.
- The new store describe restores mocks in `beforeEach` because the 59-15 describe leaves a `replaceRotoPhysicalRailMotions` rejection spy installed (the vitest config sets no `restoreMocks`). File-local hygiene; no existing test changed.
- The memo-identity assertion covers the single-key path; the generated union is compared component-wise because normalized scan bounds carry float noise (`0.5000000000000001`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fallback-equality assertion used the wrong canvas-size pairing**
- **Found during:** Task 2 (`getRailMotionBounds` GREEN)
- **Issue:** The Task 1 fallback test called `getReferenceBounds(transform, PROJECT_W, PROJECT_H, 2, PROJECT_W, PROJECT_H)` but the legacy helper takes the WORKING canvas size (project × zoom). The handles pass `width/height` (working) with `imageSize` = working/zoom (project), so the test asserted 1100 against 600.
- **Fix:** Call it with the working canvas (`PROJECT_W * 2`, `PROJECT_H * 2`) and document the pairing; the geometry itself was correct.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintReferenceTransform.test.ts`
- **Verification:** All 32 geometry/pivot tests green; full physic-paint tree 226/226 files green.
- **Committed in:** `dc4592a9c` (Task 2 commit — the file is one of the eight declared paths, so no scope widening)

**2. [Rule 1 - Bug] Plan's rotation example arithmetic was inconsistent with the compositor law**
- **Found during:** Task 1 (geometry pins)
- **Issue:** The plan's `<behavior>` states that pivot 0.25/0.25 with rotation 90° "maps (750,600) to about (50,450)". Under the plan's own op order, BR (750,600) maps to **(-150, 700)**; (50,450) is where the base-rect CENTRE (500,400) maps.
- **Fix:** Pinned the formula-correct (-150, 700) and the fixed pivot corner (250,200); the pivot math is the compositor's, not the example's.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintReferenceTransform.test.ts`
- **Verification:** Rotation cases green; corner-on-pivot case proves the pivot is the fixed point.
- **Committed in:** `71ee7d504` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 — one test-arithmetic bug, one plan-example arithmetic slip)
**Impact on plan:** No production behavior differs from the plan's intent; both fixes are geometry assertions pinned to the compositor law.

## Issues Encountered

- The Task 3 RED rows initially failed on a leaked mock: the 59-15 describe spies on `replaceRotoPhysicalRailMotions` (returning `{ ok: false }`) without restoring, and the file's vitest config sets no `restoreMocks`. The new describe now calls `vi.restoreAllMocks()` in `beforeEach`; the existing describes were left untouched.
- Union arithmetic over normalized scan bounds produces `0.5000000000000001`; the generated-in-between case compares with `toBeCloseTo(…, 12)`.
- No tests were skipped. `src/stores` reports 24 pre-existing `todo` entries, none in the files this plan touched (out of scope, untouched).

## User Setup Required

None - no external service configuration required.

## Verification

- Task 1/2 suites: `railMotionPivot.test.ts` + `PhysicsPaintReferenceTransform.test.ts` + `physicPaintStore.rotoRailMotions.test.ts` — 55 tests green.
- Task 3 contract pins: `PhysicsPaintStudio.test.ts` + `railMotionCommands.test.ts` + `railMotionBoundaryTool.test.ts` + `paperPass.frameGuard.test.ts` — 461 tests green.
- Extra regression nets: `useRotoTimelineActions.test.ts` + `timelineMotionSurface.contract.test.ts` — 206 green; full `src/components/physic-paint` tree — 226 files / 5,589 tests green; `src/stores` — 27 files / 576 green (+24 pre-existing todo).
- `pnpm --dir app run typecheck`: clean.
- Scope check: `git diff --name-only 902690280..HEAD` lists exactly the eight `files_modified` paths.

## Known Stubs

None.

## Threat Flags

None — no new network endpoint, auth path, file access pattern or schema change; the getter reads the already-decoded raster registry through the existing bounded measurer and adds no pixel-array API to the store (P4(c) green).

## Next Phase Readiness

- The boundary box can now be validated live in the Studio (UAT): frame-to-frame re-fit, generated in-between union, and the unmeasurable-key fallback are the three visible rows.
- No blockers; the compositor path, the gesture semantics and the persistence format are unchanged.

## Self-Check: PASSED

- Files exist: all eight modified paths verified in `git diff --name-only 902690280..HEAD`.
- Commits exist: `71ee7d504`, `dc4592a9c`, `9582d2d14` are ancestors of HEAD.

---
*Phase: 261107-tfp-ui-boundaries-from-phase-59-rail-motion-*
*Completed: 2026-11-07*
