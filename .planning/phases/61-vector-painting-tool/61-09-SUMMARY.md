---
phase: 61-vector-painting-tool
plan: 09
subsystem: ui
tags:
  - watercolor
  - vector-path
  - overlay
  - preact-signals
  - canvas-geometry
  - tdd

# Dependency graph
requires:
  - phase: 61-02
    provides: "The vector spine authority — sampleVectorPath, resolveAnchorHandles, sampleVectorWidths, normaliseVectorAnchors, isUniformWidthProfile — re-exported from the package payload entry by this plan"
  - phase: 61-03
    provides: "The persisted vector-path shape (anchors + renderMode) and the AquarelleRenderMode union"
  - phase: 61-07
    provides: "resolveRenderModeForBrushId — the brush-id → mode law the commit stamps"
  - phase: 61-08
    provides: "vectorPenActive / pathEditMutationId / vectorDrawDraft and the draft actions (begin/append/clear)"
provides:
  - "vectorPathHandles.ts — the UI-SPEC screen-pixel constants, the uv/layer-pixel bridge, handle-before-anchor hit priority, the adjacency refusal, pure insert/delete list operations, the projection (spine + widths + envelope) and buildVectorStroke"
  - "VectorPathOverlay.tsx — one spine polyline, one marker per anchor, bezier handle dots with connectors and the width envelope, plus the draw gesture that commits ONE VectorPathCommit"
  - "The mount beside AquarelleStrokeOverlay and the layer's handleVectorCommit, forwarding the assembled stroke to the layer's EXISTING onStrokeEnd seam"
  - "packages/efx-watercolor payload entry now re-exports the 61-02 spine geometry so the app and the overlay read one curve authority"
affects:
  - 61-10 (path edit reuses hitTestVectorPath, projectVectorPath and the overlay's drawn markers)
  - 61-11..61-14 (the bake reads the anchors / renderMode / sampled points this plan records)

# Actuals (#2632) — measured on the plan's own scale (chars/4 over the realized diff)
actuals:
  tokens: 17799
  tasks: 3
  commits: 3
plan_head_before: ef0bd04ac6361e302a5e04a86cd10854e75aebff
plan_head_after: 4e9c6c93b194c1abc0cdfee0f4ee2b9073b4b8a9

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Overlay chrome is SCREEN-pixel: every marker constant is divided by physicsPaintCanvasZoom.effectiveScale before it is drawn (the shipped scriptStrokeTransform law)"
    - "Commit-through-the-existing-seam: a new interactive layer hands a typed commit to the layer, which assembles the stroke with the same snapshot/selection expressions the hand-painted literal uses and calls props.onStrokeEnd"
    - "The draft is cleared BEFORE the commit, so a same-tick repeat gesture finds nothing and commits nothing (T-61-30)"
    - "Plain .test.ts vnode walk (materialize/walk) for a Preact component plus source-string pins for the window key listener, because the vitest config collects only src/**/*.test.ts in the node environment"

key-files:
  created:
    - app/src/components/physic-paint/view/vectorPathHandles.ts
    - app/src/components/physic-paint/view/vectorPathHandles.test.ts
    - app/src/components/physic-paint/engine/VectorPathOverlay.tsx
    - app/src/components/physic-paint/engine/VectorPathOverlay.test.ts
  modified:
    - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
    - packages/efx-watercolor/src/payload/index.ts

key-decisions:
  - "The width envelope draws only for a NON-uniform profile (D-10's 'no rung for an absent factor'), with VECTOR_ENVELOPE_BASE_UV = 0.02 × sheet height as a display-only base half-width; the baked thickness stays the brush's own radius times the same factor."
  - "renderMode resolves from resolveRenderModeForBrushId(aquarelleBrushForActiveTool().brushId) at finish time — the same brush-id law the record path stamps — so the overlay never reads colour, params or the clock; geometry is its half of the contract."
  - "The stroke assembly is the pure buildVectorStroke(commit, source) in vectorPathHandles.ts: every required field has a stated, unit-pinned source, while the layer only supplies the live values."
  - "Recorded vector paths draw even while the pen is released (root pointerEvents: none, markers still visible); the key listener binds only while the pen is active."
  - "Double-click uses Preact's onDblClick prop — the real dblclick event — and a real double-click's second pointerdown is already absorbed by the adjacency refusal, so no duplicate anchor is appended."

patterns-established:
  - "A new interactive canvas layer receives callbacks only and never imports an engine, bake, adapter or record module; commits leave as a typed value."
  - "Geometry authority stays in the package: the app imports the spine and never re-samples a curve or re-derives a tangent."

requirements-completed: [VEC-01, VEC-07]

coverage:
  - id: D1
    description: "A committed vector stroke draws its spine, one marker per anchor, bezier handle dots and a width envelope on the canvas; nothing is drawn for a stroke with no anchors; marker chrome keeps its screen size at every zoom."
    requirement: VEC-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/vectorPathHandles.test.ts#counter-scaling — a screen-pixel extent shrinks by the zoom factor"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#VectorPathOverlay — rendered geometry (task 1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Draw mode places anchors: plain click = smooth anchor, Alt+click = corner, adjacency refused, click on the first anchor finishes there, Enter and double-click finish once, Escape cancels with zero commits, and zero/one-anchor finishes record nothing."
    requirement: VEC-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#VectorPathOverlay — draw gesture (task 2)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/vectorPathHandles.test.ts#adjacency — a duplicate click never appends"
        status: pass
    human_judgment: false
  - id: D3
    description: "A finished path records exactly one entry, one payload-timeline event and one revision bump through the existing stroke seam; a repeat finish adds nothing; an empty/one-anchor path adds no entry and allocates no serial; the committed vector stroke lists as one ordinary paint row keyed by serial."
    requirement: VEC-07
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#VectorPathOverlay — one entry per finished path (task 3)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Live Studio UAT: draw three anchors, finish, see one new stroke and one undo entry; Escape mid-path leaves nothing behind."
    verification: []
    human_judgment: true
    rationale: "The plan records this as an end-of-phase manual UAT row; the unit pins prove the commit seam and the row shape but not the rendered canvas or the Studio window's undo entry in a running app."

duration: 10min
completed: 2026-11-10
status: complete
---

# Phase 61 Plan 09: Vector Path Drawing Summary

**The vector pen now draws on the real canvas — clicks place smooth anchors, Alt places corners, Enter/double-click/first-anchor finish an open path, Escape cancels, and the finished path lands as one recorded stroke through the same stroke-end seam a hand-painted gesture uses.**

## Performance

- **Duration:** 10 min (measured from the first plan artifact; pre-artifact reading excluded)
- **Started:** 2026-11-10T14:19:36Z
- **Completed:** 2026-11-10T14:29:41Z
- **Tasks:** 3
- **Files created/modified:** 6 (4 created, 2 modified)

## Accomplishments

- `vectorPathHandles.ts` carries the whole draw/edit geometry law: the UI-SPEC screen-pixel constants (9px anchor body, 8px hit pad, 3.5px core radius, 7px handle, 3px drag threshold, 6px adjacency, 12px first-anchor hit), the uv ↔ layer-pixel bridge, `screenPadToUv`, handle-before-anchor hit priority, the adjacency refusal, pure insert/delete operations, the projection and `buildVectorStroke`.
- `VectorPathOverlay.tsx` draws every recorded vector stroke of the edit frame — spine polyline, one marker per anchor (circle for auto, 9px square for bezier), bezier handles with connectors and the sparse-profile envelope — counter-scaled by the effective zoom, and draws the in-progress draft the same way.
- The draw gesture commits exactly once with `{ anchors, renderMode, points }`; the draft is cleared before `onCommitPath`, so a same-tick second Enter or double-click is a no-op.
- `AquarelleCanvasLayer` mounts the overlay directly above `AquarelleStrokeOverlay` and assembles the complete `AquarelleStroke` with the SAME snapshot/selection expressions the hand-painted literal uses, then forwards once to `onStrokeEndRef.current?.(stroke)` — no record call, no new layer prop, no second revision bump.
- `packages/efx-watercolor/src/payload/index.ts` now re-exports the 61-02 spine, so the app reads `sampleVectorPath` / `resolveAnchorHandles` / `sampleVectorWidths` from one authority instead of re-deriving the curve.

## Task Commits

TDD Tasks 1 and 2 share one RED commit and one GREEN implementation commit (see Deviations):

1. **Task 1 RED: failing tests for the vector handles and the overlay** - `5f786b610` (test)
2. **Task 1+2 GREEN: the handle geometry, the overlay, the draw gesture and the layer mount** - `5f8a5f2d8` (feat)
3. **Task 3: one entry per finished path, no empty commit, the ordinary stroke row** - `4e9c6c93b` (test)

**Plan metadata:** included in the `docs(61-09)` completion commit.

## TDD Gate Compliance

| Gate | Evidence |
|------|----------|
| Task 1 RED | `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK` (`target_test_failed`). Both target files ran: 48 tests, 37 failed on assertions, 11 passed (the constants and the empty-path cases). A shape-only scratch stub (never committed) let the brand-new modules load so every failure was an assertion, never a load error. |
| Task 1+2 GREEN | `vitest run vectorPathHandles.test.ts VectorPathOverlay.test.ts` → 48/48 passed; committed as `feat`. |
| Task 2 | Shares the Task 1 RED record: the gesture pins were authored in the same RED commit (`5f786b610`), so a separate GREEN gate would have been the same run. |
| Task 3 | `type="auto"` — no RED gate required by the plan; three new pins added on the GREEN seam, overlay file 24/24 passed. |
| REFACTOR | Not needed — no cleanup beyond the in-cycle test corrections recorded below. |

The commit order is RED → GREEN.

## Files Created/Modified

- `app/src/components/physic-paint/view/vectorPathHandles.ts` - constants, uv/layer-pixel bridge, hit priority, adjacency, insert/delete, projection with envelope, `buildDraftPath`, `buildVectorStroke`
- `app/src/components/physic-paint/view/vectorPathHandles.test.ts` - 27 pins: literal constants, counter-scaling at zoom 1/2/4, uv round-trip, hit priority (handle over anchor, null, auto anchors own no handle, zoom-scaled pad), adjacency, list operations, projection element counts, per-field stroke assembly
- `app/src/components/physic-paint/engine/VectorPathOverlay.tsx` - the overlay: drawn geometry, draft, pointer gesture, key law, window listener bound only while the pen is active
- `app/src/components/physic-paint/engine/VectorPathOverlay.test.ts` - 24 pins: rendered geometry, the eight gesture cases, clear-before-commit ordering, authority boundary, record-seam counts and the row shape
- `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` - `handleVectorCommit`, the `VectorPathOverlay` mount, the `getRecordedAquarelleStrokeEntries` / `buildVectorStroke` / `clearVectorDraft` imports
- `packages/efx-watercolor/src/payload/index.ts` - re-export of `../vector/spine` from the payload entry

## Verification Run

- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/vectorPathHandles.test.ts src/components/physic-paint/engine/VectorPathOverlay.test.ts` → 48 passed (task 1/2 gate), then 24 passed in the overlay file (task 3 gate)
- `pnpm --filter efx-motion-editor exec vitest run` (full app suite) → 416 files passed | 2 skipped, 8553 tests passed | 1 skipped | 96 todo
- `pnpm --filter efx-motion-editor run typecheck` (tsc --noEmit) → clean
- `grep -n "captureFrame\|scriptBegin\|applyStroke" app/src/components/physic-paint/engine/VectorPathOverlay.tsx` → no match (no bake authority)
- Source pins: the layer contains `<VectorPathOverlay`, `buildVectorStroke(` and `onStrokeEndRef.current?.(`, and contains no `recordAquarelleStroke`

## Decisions Made

- **Envelope only for a sparse profile.** A uniform width profile draws no envelope, mirroring D-10's "no rung for an absent factor"; `VECTOR_ENVELOPE_BASE_UV = 0.02` × sheet height is a display-only base half-width so the relative profile is visible without pretending to be the baked thickness.
- **The commit's mode comes from the brush id.** `resolveRenderModeForBrushId(aquarelleBrushForActiveTool().brushId)` is the same law 61-07's record path stamps, so a renamed or remapped brush cannot make the commit and the recorded stroke disagree.
- **The layer owns assembly, the module owns its proof.** `buildVectorStroke` is pure and unit-pinned field by field; the layer passes `colorRef.current`, `snapshotAquarelleRecord()` values, `toolForSelection()`, `aquarelleVisibleSettleTicks`, `Date.now()` and `getPlayFrameRef.current()` — the exact expressions the hand-painted literal already uses.
- **Recorded vector paths stay visible while the pen is released.** The root becomes `pointerEvents: 'none'` instead of unmounting, so the path chrome remains a truthful preview; the key listener is bound only while the pen is active, so Escape never steals a Studio shortcut with no draft.
- **Preact's `onDblClick`, not React's `onDoubleClick`.** Preact binds the real `dblclick` event through `onDblClick`; the gesture pin was corrected to the framework's actual prop (behavior pin unchanged).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The package payload entry did not export the spine geometry**
- **Found during:** Task 1 (geometry module)
- **Issue:** `sampleVectorPath`, `resolveAnchorHandles`, `sampleVectorWidths`, `normaliseVectorAnchors` and `isUniformWidthProfile` were not reachable from `@efxlab/efx-watercolor` or `/payload` — only the anchor/render-mode types were re-exported — so the plan's "one curve authority" law was unimplementable from the app.
- **Fix:** Added `export * from '../vector/spine'` to `packages/efx-watercolor/src/payload/index.ts` (no name collisions in the entry) and rebuilt the package (`pnpm --filter @efxlab/efx-watercolor build`) so the app's node resolution sees the new exports.
- **Files modified:** `packages/efx-watercolor/src/payload/index.ts`
- **Verification:** the 27 geometry tests and the overlay's 24 tests import the spine through the payload entry and pass; `tsc --noEmit` is clean.
- **Committed in:** `5f8a5f2d8` (Task 1+2 GREEN)

**2. [Rule 1 - Bug] Two RED test defects blocked the typecheck gate**
- **Found during:** Task 1+2 GREEN (first `tsc --noEmit` run)
- **Issue:** (a) the double-click pin read `root.props['onDoubleClick']`, a React prop name Preact neither types nor binds (`onDblClick` maps to the real `dblclick` event, so the shipped feature would have been dead); (b) the declared `bezier()` fixture helper was unused, which fails the repo's `noUnusedLocals`.
- **Fix:** Switched the handler and the pin to `onDblClick` (assertion intent unchanged: the overlay root owns a double-click finish), and used `bezier(0.7, 0.4)` for the Alt-corner expectation so the helper is exercised.
- **Files modified:** `app/src/components/physic-paint/engine/VectorPathOverlay.tsx`, `app/src/components/physic-paint/engine/VectorPathOverlay.test.ts`
- **Verification:** `tsc --noEmit` clean; 48/48 then 24/24 tests pass.
- **Committed in:** `5f8a5f2d8` (Task 1+2 GREEN)

### Process deviation

**Tasks 1 and 2 share one implementation commit.** The RED commit (`5f786b610`) contains both tasks' pins because the renderer and the gesture live in one new module; an intermediate commit would therefore have had failing tests. The GREEN commit keeps every commit green, and the task ownership is recorded above.

---

**Total deviations:** 2 auto-fixed (1 Rule 1, 1 Rule 3) + 1 process split
**Impact on plan:** The package re-export is required by the plan's own "one curve authority" law; the test corrections preserve every planned assertion. No product scope change and no behavior outside the plan.

## Issues Encountered

- The RED run initially classified as `INVALID_RED (no_target_test_failure)` because a missing bracket in one fixture made esbuild reject the overlay test file, so no individual tests from that file ran; fixing the bracket produced 37 failing tests on assertions and `RED_EVIDENCE_OK`.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. The scratch RED stub was replaced by the committed overlay before a GREEN commit; no placeholder branch, hardcoded empty data or unwired component remains. The width envelope is intentionally absent for a uniform profile (D-10), not a stub.

## Threat Surface

- T-61-28 (non-finite pointer coordinates): the pointer is converted to uv and rejected when non-finite before it can reach the draft; `normaliseVectorAnchors` refuses duplicates at the projection boundary.
- T-61-29 (unbounded draft): the adjacency refusal and the first-anchor finish bound the path; no duplicate click can append a zero-length segment.
- T-61-30 (double commit): `clearVectorDraft()` runs before `onCommitPath`, and the seam test asserts one entry, one timeline event and one revision bump after a repeated finish.
- T-61-31 (overlay gaining bake authority): the overlay imports no engine/bake/adapter/record module and is pinned by a source scan; the commit lives in `AquarelleCanvasLayer` and leaves through `props.onStrokeEnd`.
- T-61-SC (package installs): no dependency was added.

## Next Phase Readiness

- 61-10 can hit-test through `hitTestVectorPath` and project through `projectVectorPath`; both already carry the screen-pixel counter-scaling the edit handles need.
- The layer's `handleVectorCommit` is the template a path-edit commit should mirror: assemble with the same expressions, forward once to `onStrokeEnd`.
- The end-of-phase manual UAT row remains: draw three anchors, finish, see one new stroke and one undo entry; Escape mid-path leaves nothing behind.

---
*Phase: 61-vector-painting-tool*
*Completed: 2026-11-10*

## Self-Check: PASSED

- All four created files exist on disk.
- All three plan commits (`5f786b610`, `5f8a5f2d8`, `4e9c6c93b`) are ancestors of HEAD.
- No commit deletes a tracked file.
