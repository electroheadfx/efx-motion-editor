---
phase: 59-rail-motion-channels-v7-interface
plan: 13
subsystem: ui
tags: [preact-signals, rail-motion, canvas-gizmo, pointer-gesture, d-08, tdd]

requires:
  - phase: 59-rail-motion-channels-v7-interface
    provides: 59-02 value conversions, 59-05 rail-motion evaluator, 59-06 rail views, 59-07 motion store setter and revision, 59-12 command layer, rail-local frame helper and availability table
provides:
  - "'rail-motion' as a third target on the shared transform handles: Position, corner Scale and Rotation, no Opacity affordance"
  - writeMotionTransformAtCursor (D-08 channel gate, grouped Position pair in one call) and resolveMotionGizmoAvailability and mergeRailMotionDraft in the pure command layer
  - Session-only draft signal driving the gesture preview; exactly one store commit at pointer-up; pointercancel commits nothing
  - getFlattenedMemoEntryCountForTests read-only memo probe; +1 flattened entry per commit, 0 per draft step
  - Third handles mount in PhysicsPaintStudioView, fed by a railMotionGizmo computed whose PRIMITIVE signature keys the canvas-stack memo
affects: [59-14 UAT, 59-15 settlement consumer, 59-16 numeric entry]

actuals:
  # chars/4 over the realized plan diff (RED + GREEN). Includes the generated
  # red-evidence XML (~180k chars of serialized vitest output); source-only is
  # ~15,772 tokens. Counted as produced, not flattered toward the 45,000 estimate.
  tokens: 81678
  tasks: 1
  commits: 2

tech-stack:
  added: []
  patterns:
    - Session-only draft signal is the whole gesture surface; the store sees one settle per drag
    - Partial display-unit values (px / percent / degrees) with the present channels AS the D-08 gate input
    - Primitive signature string as the memo key for a rebuilt computed payload (identity-stable dep arrays)

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/roto/railMotionCommands.ts
    - app/src/components/physic-paint/roto/railMotionCommands.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx
    - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/stores/physicPaintStore.ts
    - app/src/stores/physicPaintStore.test.ts
    - app/src/efx-paint/compositor/efxPaintRevealLeakContract.test.ts

key-decisions:
  - Position is committed as ONE grouped call through a new explicit `pairedValue` input, because the derived sibling read would include outgoing wiggle at a key frame and a second read could disagree with the gesture sample.
  - The gizmo payload is a computed in useRotoTimelineActions exposing a primitive `signature`; the Studio memo depends on that signature, not the payload identity, so the canvas-stack memo keeps hitting.
  - The Studio drives the mount from a `railMotionGizmo` computed that returns null unless the 59-06 view carries a non-null railId AND the command layer enables the gizmo, so mount gate and D-08 verdict cannot disagree.
  - Rail geometry reuses the shared bounds core against the project canvas (working size / zoom); only corner handles are interactive because the model has one uniform Scale channel.
  - Display units at the component boundary (px / percent / degrees) reuse the 59-02 pair; the evaluator keeps being the ONE degrees-to-radians conversion.

patterns-established:
  - "Gesture preview: pointer moves merge a pure `mergeRailMotionDraft` result into a session signal; the document is untouched until pointer-up."
  - "One commit per gesture: the only `writeMotionTransformAtCursor` call site sits inside handlePointerUp; pointercancel clears the draft and ends the interaction."
  - "Availability gates the mount, not the gesture: an un-animated rail, a channel-less rail, or an out-of-span playhead renders no gizmo at all."

requirements-completed: [MOTN-03]

coverage:
  - id: D1
    description: "The command layer writes Position (grouped pair), Scale (percent -> factor) and Rotation (degrees, never wrapped) at the rail-local cursor, and refuses a channel with no keys without mutating the collection."
    requirement: MOTN-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionCommands.test.ts#59-13 rail motion commands — gizmo transform write"
        status: pass
    human_judgment: false
  - id: D2
    description: "Gizmo availability refuses an un-animated rail, a channel-less rail, an Opacity-only rail and an out-of-span playhead, each with a visible reason."
    requirement: MOTN-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionCommands.test.ts#59-13 rail motion commands — gizmo availability"
        status: pass
    human_judgment: false
  - id: D3
    description: "The draft reducer is pure and frozen, the command layer imports no store, exactly one write call sits in handlePointerUp, no opacity affordance exists, no rotation wrap exists, and the Studio mounts three gated handles instances."
    requirement: MOTN-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionCommands.test.ts#59-13 rail motion commands — draft merge reducer"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionCommands.test.ts#59-13 rail motion commands — purity and source pins"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintRevealLeakContract.test.ts#59-13 keeps each handles target on its own write endpoint"
        status: pass
    human_judgment: false
  - id: D4
    description: "One motion commit grows the flattened memo by exactly one entry; an identical commit adds none (T-59-42)."
    requirement: MOTN-03
    verification:
      - kind: unit
        ref: "app/src/stores/physicPaintStore.test.ts#59-13: one motion commit adds exactly one flattened memo entry; an identical commit adds none"
        status: pass
    human_judgment: false
  - id: D5
    description: "A live drag on the canvas previews with the draft, commits once on release, and drags start from the evaluated transform at the playhead."
    requirement: MOTN-03
    verification: []
    human_judgment: true
    rationale: "The pointer gesture only exists inside the running Studio window; vitest proves the pure sink, the source wiring and the memo delta, not a native drag. Live visual UAT is the project's rule before claiming done."

# Metrics
duration: 7min
completed: 2026-11-06
status: complete
---

# Phase 59 Plan 13: Rail-Motion Canvas Gizmo Summary

Direct-manipulation Position/Scale/Rotation gizmo on the selected animated rail, with a session-only drag draft and exactly one motion commit per gesture.

## Performance

- **Duration:** 7 min (measured commit window; the plan began in the prior session)
- **Started:** 2026-11-06T17:02:33Z (RED commit)
- **Completed:** 2026-11-06T17:09:09Z
- **Tasks:** 1
- **Files modified:** 10 source/test files (+ 2 generated red-evidence artifacts)

## Accomplishments

- The shared transform handles component gained a third, additive `'rail-motion'` target: pointer moves merge a frozen `RailMotionTransformValues` partial into a session `draftTransform` signal, `handlePointerUp` settles once through `writeMotionTransformAtCursor`, and `onPointerCancel` clears the draft without committing.
- The pure command layer now owns the whole safety story: `resolveMotionGizmoAvailability` answers rail/channel/span refusals, `writeMotionTransformAtCursor` applies the D-08 gate to every present channel (grouped Position requires BOTH axes), converts display units through the 59-02 pair, and delegates to `setMotionKeyAtCursor`.
- Position is written as ONE atomic pair via the explicit `pairedValue` input, closing the hazard where a derived sibling read would include outgoing wiggle at a key frame.
- The Studio wires a `railMotionGizmo` computed through a primitive signature so the canvas-stack memo keeps its identity while re-resolving on motion revisions, rail selection and playhead moves.
- The flattened-memo probe pins the performance contract: one commit = one new `motion:` memo entry, an identical commit = zero, and the N draft steps touch no store at all.

## Task Commits

Each task was committed atomically (TDD split):

1. **Task 1 (tracer): Rail-motion gizmo target, end-to-end with the D-08 gate and one commit per drag**
   - `297d53189` (test) — failing pins: gizmo transform write, availability, draft reducer, purity/source pins, memo delta, reveal-leak extension
   - `b43bd7569` (feat) — command API, handles target, third mount, store probe, Studio wiring

**Plan metadata:** docs commit created after this summary (see ledger below)

## Files Created/Modified

- `app/src/components/physic-paint/roto/railMotionCommands.ts` — `RailMotionTransformValues`, `resolveMotionGizmoAvailability`, `mergeRailMotionDraft`, `writeMotionTransformAtCursor`; explicit `pairedValue` on `setMotionKeyAtCursor`.
- `app/src/components/physic-paint/roto/railMotionCommands.test.ts` — 23 new tests covering every behavior row (write, refusal, purity, source pins).
- `app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx` — third target, draft signal, gated single commit, pointercancel, corner-only interactivity, partial-to-full draft merge for geometry.
- `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx` — third handles mount gated on `railMotion?.view.railId`.
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` — `RailMotionGizmoBundle`, `railMotionGizmo` computed (evaluated display values, availability, signature, commit/report), return entry.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — `railMotionTransformHandles` envelope and primitive-signature memo dep.
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — existing union pin updated to the three-member union.
- `app/src/stores/physicPaintStore.ts` — `getFlattenedMemoEntryCountForTests` read-only seam.
- `app/src/stores/physicPaintStore.test.ts` — memo-delta test (one commit adds one entry; repeat adds none).
- `app/src/efx-paint/compositor/efxPaintRevealLeakContract.test.ts` — rail-motion tokens stay out of the four raster surfaces; one write endpoint per target.

## Decisions Made

- Position commits as ONE grouped call with an explicit `pairedValue`, not two sequential `setMotionKeyAtCursor` calls: the derived sibling value comes from `evaluateRailMotionChannel`, which includes outgoing wiggle at a key frame, so a second evaluation could overwrite the gesture sample.
- The hook exposes a computed payload plus a primitive `signature`; the Studio memo depends on the signature so the object identity churn of the computed cannot defeat `canvasStackPropsMemo`.
- The mount gate and the D-08 verdict share one source: the computed returns null unless the 59-06 view has a non-null `railId` and the command layer enables the gizmo.
- Only corner handles are interactive for rail motion: the model carries one uniform `scale` channel, so per-axis edge handles would have no honest target.
- Rail geometry derives from the project canvas (working size divided by zoom) and reuses `getReferenceBounds`; no document read, no decode, no per-frame loop.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Additive wiring in the timeline-actions hook and the Studio (files outside `files_modified`)**
- **Found during:** Task 1
- **Issue:** The mount must be fed from Studio-local rail selection, but the only live rail-view projection lives in `readActiveRailMotionState` inside `useRotoTimelineActions`; no existing prop carried the records/view/evaluated values to the canvas stack.
- **Fix:** Added `RailMotionGizmoBundle` + a `railMotionGizmo` computed to the hook (null unless mounted and enabled; display-unit evaluated values; commit through the 59-07 setter; `signature` for memo keying), plus a `railMotionTransformHandles` envelope and one memo dep in `PhysicsPaintStudio.tsx`. Both are additive; no existing export changed shape.
- **Files modified:** `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts`, `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- **Commit:** `b43bd7569`

**2. [Rule 3 - Blocking] Pre-existing union pin in PhysicsPaintStudio.test.ts**
- **Found during:** Task 1 (typecheck/test triage)
- **Issue:** The 260922-rd4 pin asserted the exact two-member union `"target: 'photo-reference' | 'background'"`, which the additive third target necessarily breaks.
- **Fix:** Updated the pin to the three-member union (the reveal-leak pin separately proves the legacy branches are unchanged).
- **Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- **Commit:** `b43bd7569`

**3. [Rule 1 - Bug] RED-authored rotation test used out-of-span cursor frames**
- **Found during:** GREEN (first verify run: 1 of 195 failing)
- **Issue:** The no-normalization test drove cursor frames 24/25, i.e. rail-local 14/15, but `railMotionCursorFrame` clamps to `[0, endFrameExclusive - startFrame - 1]` = `[0, 10]`, so the keys landed at frame 10. The test, not the implementation, encoded a wrong span assumption.
- **Fix:** Moved the assertions to in-span cursors 14/15 (rail-local 4/5); the separate clamp test still proves the out-of-span behavior.
- **Files modified:** `app/src/components/physic-paint/roto/railMotionCommands.test.ts`
- **Commit:** `b43bd7569` (test correction inside the GREEN commit; the RED evidence already recorded the target test failures)

**4. [Rule 3 - Blocking] Typecheck corrections in GREEN**
- **Found during:** `pnpm --filter efx-motion-editor run typecheck`
- **Issue:** (a) the hook imported `writeMotionTransformAtCursor` but the commit deliberately lives in the handles component (single call site); (b) the handles `transform` local unified `PhotoReferenceTransform` with the partial draft values, breaking every geometry call and the rotation cursor.
- **Fix:** Removed the unused import; rebuilt a full `PhotoReferenceTransform` from the draft partial over the evaluated transform before any geometry call.
- **Files modified:** `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts`, `app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx`
- **Commit:** `b43bd7569`

## TDD Gate Compliance

- RED: `297d53189` — `test(59-13): add failing rail-motion gizmo pins`; 25 target-test failures, all inside the 59-13 describes (per-test TypeErrors through namespace casts for the not-yet-written API), validated with `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK` / `target_test_failed`.
- GREEN: `b43bd7569` — `feat(59-13): rail-motion canvas gizmo with D-08 gate and one commit per drag`; the full verify suite (195 tests) and the related pin suites (609 tests) pass, and `typecheck` exits 0.

## Verification

- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/railMotionCommands.test.ts src/stores/physicPaintStore.test.ts src/efx-paint/compositor/efxPaintRevealLeakContract.test.ts` → 3 files, 195 tests passed.
- Related pins: `PhysicsPaintStudio.test.ts`, `PhysicsPaintStudioView.test.ts`, `physicsPaintTrackHeaderColumn.test.ts`, `PhysicsPaintWorkflowStrip*.test.ts` → 6 files, 609 tests passed.
- `pnpm --filter efx-motion-editor run typecheck` → exit 0.
- Acceptance greps: `writeMotionTransformAtCursor(` = 1 (inside `handlePointerUp`); `setBackgroundTransform(layerId` = 1; `setPhotoReferenceTransform(layerId` = 1; rotation-normalization pattern = 0 in both new files; `<PhysicsPaintReferenceTransformHandles ` in `PhysicsPaintStudioView.tsx` = 3.
- Tracer feedback gate: automated `<verify>` re-ran end-to-end after the GREEN commit and passed; auto mode inactive, `human_verify_mode=end-of-phase`, so the visible drag remains a UAT row (D5) rather than a gate here.

## Known Stubs

None.

## Self-Check: PASSED

- `app/src/components/physic-paint/roto/railMotionCommands.ts` — FOUND
- `app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx` — FOUND
- `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx` — FOUND
- `app/src/stores/physicPaintStore.ts` — FOUND
- Commit `297d53189` — FOUND
- Commit `b43bd7569` — FOUND

## Ledger

- `plan_head_before`: `9ec77fa80a6aaffaf03765fc2eee52975b51c450`
- `plan_head_after`: `b43bd756907a9c48d4256b391b5478b292242b5e`
- `commits`: 2 (measured with `git rev-list --count plan_head_before..HEAD`)
