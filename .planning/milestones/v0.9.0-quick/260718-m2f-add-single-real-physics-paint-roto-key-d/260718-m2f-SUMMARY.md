---
phase: quick-260718-m2f-add-single-real-physics-paint-roto-key-d
plan: 01
subsystem: physics-paint-roto-timeline
tags: [preact, pointer-events, roto, interpolation, drag-drop, undo-redo]

requires:
  - phase: quick-260718-j3h
    provides: finalized real-key deletion and keyboard interaction baseline
provides:
  - single-real-key Pointer Events drag movement in the local Physics Paint Roto timeline
  - atomic canonical move transaction with acknowledgement rollback and local Undo/Redo
  - move-specific adjacent interpolation spacing reconstruction for closer, farther, and generated destinations
  - Studio-authoritative preview validity with requested and effective destination feedback
affects: [physics-paint-roto, interpolation-review, multi-key-selection]

tech-stack:
  added: []
  patterns:
    - Studio-owned canonical candidate resolution shared by drag preview and commit revalidation
    - single frame-mapping move transaction with complete snapshot rollback
    - move-specific interpolation timing reconstruction that preserves unaffected custom spans

key-files:
  created:
    - app/src/components/physic-paint/hooks/useRotoKeyMoveHistory.ts
  modified:
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
    - app/src/components/physic-paint/hooks/useRotoApplyLifecycle.ts
    - app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.ts
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/roto/physicsPaintRotoKeyController.ts
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx

key-decisions:
  - "Single-key movement is non-ripple and keeps every unaffected real key at its canonical source position."
  - "Occupied real keys remain invalid destinations; generated and empty cells are valid when canonical timing resolution accepts them."
  - "Move timing is reconstructed from the intended post-move projection rather than mechanically carrying stale adjacent spacing overrides."
  - "Preview validity is owned by Studio and uses the same canonical resolver as commit; commit still revalidates after the save barrier."
  - "Regression tests are intentionally deferred because the next quick will review interpolation architecture and add deterministic coverage afterward."

patterns-established:
  - "Roto move preview is feedback only; parent-authoritative commit revalidates against the latest launch, cache, lock, and interpolation state."
  - "Requested and effective legal destinations remain distinct through preview, status, focus, history, and persistence."

requirements-completed: [QUICK-260718-M2F]
coverage:
  - id: D1
    description: "A real Roto key can be dragged with click preservation, pointer capture, cancellation cleanup, and edge auto-scroll."
    requirement: QUICK-260718-M2F
    verification:
      - kind: other
        ref: "pnpm --dir app typecheck && pnpm --dir app build"
        status: pass
      - kind: manual_procedural
        ref: "Native UAT approved 2026-07-19"
        status: pass
    human_judgment: true
    rationale: "Pointer feel, compact visual feedback, auto-scroll, cancellation, and native focus behavior require visible native validation."
  - id: D2
    description: "A valid drop performs one atomic canonical move with complete paint payload preservation, acknowledgement rollback, and one Undo/Redo action."
    requirement: QUICK-260718-M2F
    verification:
      - kind: other
        ref: "pnpm --dir app typecheck && pnpm --dir app build"
        status: pass
      - kind: manual_procedural
        ref: "Native UAT approved 2026-07-19"
        status: pass
    human_judgment: true
    rationale: "Pixel identity, persistence, playback, onion, export, and chronological Undo/Redo were confirmed in the native application."
  - id: D3
    description: "Closer, farther, generated, and minimum-spacing moves rebuild affected timing while preserving unrelated custom spans."
    requirement: QUICK-260718-M2F
    verification:
      - kind: other
        ref: "Temporary deterministic A-E production harness; typecheck and production build"
        status: pass
      - kind: manual_procedural
        ref: "Native UAT approved 2026-07-19"
        status: pass
    human_judgment: true
    rationale: "The latest move timing and generated destination projection were validated against real project layouts in the native application."
  - id: D4
    description: "Drag preview validity, valid/generated feedback, and effective destination presentation match authoritative commit validity."
    requirement: QUICK-260718-M2F
    verification:
      - kind: other
        ref: "Temporary deterministic preview/commit harness; typecheck and production build"
        status: pass
      - kind: manual_procedural
        ref: "Native UAT approved 2026-07-19"
        status: pass
    human_judgment: true
    rationale: "The reported visual invalid-versus-success mismatch required native confirmation after the Studio-owned resolver correction."

duration: 1d
completed: 2026-07-19
status: complete
---

# Quick Task 260718-m2f: Single Real Physics Paint Roto Key Drag-and-Drop Summary

**Single real Roto keys now move atomically through canonical timing, preserve complete paint/history state, and present the same requested/effective destination validity before and after release.**

## Performance

- **Duration:** 1 day across implementation and native UAT correction cycles
- **Started:** 2026-07-18T13:53:18Z
- **Completed:** 2026-07-19T09:12:37Z
- **Tasks:** 3, including blocking native UAT
- **Production files modified:** 8

## Accomplishments

- Added deliberate-threshold Pointer Events dragging for one real Roto key with pointer capture, compact source/target feedback, cancellation cleanup, and proportional horizontal edge auto-scroll.
- Routed movement through one complete `frameMappings` move transaction, one local interpolation regeneration, one parent replacement payload, acknowledgement-bound rollback, destination selection, and one local Undo/Redo command.
- Corrected closer/farther timing symmetry by rebuilding moved-key adjacent spacing from the intended post-move projection while preserving unaffected custom spans.
- Accepted generated and empty destinations when canonical resolution succeeds, while keeping generated sources and occupied real-key destinations invalid.
- Unified preview and commit validity under a Studio-owned canonical resolver, including explicit requested-versus-effective legal destination feedback.

## Task Commits

1. **Atomic move transaction and settlement** — `84554c15`
2. **Pointer drag interaction and move history** — `12d15928`
3. **Post-UAT move timing reconstruction** — `07a496a1`
4. **Post-UAT preview/commit feedback alignment** — `f12362c2`
5. **Verifier-found background metadata preservation** — `53c23549`

## Files Created/Modified

- `app/src/components/physic-paint/hooks/useRotoKeyMoveHistory.ts` — Move-specific accepted-command history integrated with existing paint-history ordering.
- `app/src/components/physic-paint/roto/physicsPaintRotoKeyController.ts` — Canonical move transaction and move-specific timing planner.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — Latest-state validation, save barrier, authoritative candidate resolution, final selection, and history wiring.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — Pointer gesture, auto-scroll, valid/generated/effective destination feedback, and accessibility state.
- `app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.ts` — One acknowledgement-aware parent replacement operation and snapshot replay.
- `app/src/components/physic-paint/hooks/useRotoApplyLifecycle.ts` — Matching success/rejection/timeout settlement.
- `app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts` — Authoritative launch replacement settlement.
- `app/src/components/physic-paint/physicsPaintStudio.css` — Compact source, valid/invalid target, and committing visual states.

## Decisions Made

- Non-ripple movement remains the only behavior: no replacement, swap, shift, or multi-selection was introduced.
- Generated interpolation cells are render-only before commit but can express an intended move destination that becomes a real key through canonical regeneration.
- Minimum interpolation spacing clamps to the existing legal projected destination and reports the effective result explicitly.
- Generic key-utility spacing rebasing remains unchanged; move timing uses a dedicated reconstruction path to avoid stale `inBetweenCount` reuse.
- The existing interpolation-number control remains unchanged; its architecture and deterministic regression review are deferred to the next quick.

## Deviations from Plan

### Auto-fixed Issues

**1. Stale adjacent spacing survived closer moves**
- **Found during:** Native UAT timing cycle
- **Issue:** Mechanical endpoint rebasing preserved an obsolete long `inBetweenCount` after moving a key closer.
- **Fix:** Rebuilt affected incoming/outgoing timing from intended post-move display anchors and minimum legal spacing.
- **Committed in:** `07a496a1`

**2. Generated destinations needed to become valid move targets**
- **Found during:** Native UAT timing cycle
- **Issue:** The initial product decision rejected generated destinations, preventing direct repositioning inside interpolation spans.
- **Fix:** Kept generated cells render-only as sources while allowing them as resolved move destinations.
- **Committed in:** `07a496a1`

**3. Preview could visually reject a move that commit accepted**
- **Found during:** Final native UAT feedback cycle
- **Issue:** WorkflowStrip reconstructed timing locally and displayed generic render-only feedback independently of Studio's canonical commit validation.
- **Fix:** Made Studio own candidate resolution and surfaced requested/effective validity consistently in visual, status, title, and accessibility feedback.
- **Committed in:** `f12362c2`

**4. Generic transaction normalization stripped background-only metadata**
- **Found during:** Final goal verification
- **Issue:** Move payloads initially preserved `backgroundOnly`, but generic transaction normalization deleted it before replacement and parent publication.
- **Fix:** Move operations now use the move-specific payload-preserving normalizer; all other key utilities keep existing behavior.
- **Committed in:** `53c23549`

---

**Total deviations:** 4 correctness/product refinements from native UAT and final verification
**Impact on plan:** All changes remained inside the single-key drag and shared atomic transaction boundary; no multi-selection or interpolation architecture redesign was introduced.

## Issues Encountered

- Parent rejection/timeout cannot be safely induced through the production UI; identity-guarded rollback remains implemented but was not fault-injected during native UAT.
- Regression tests were deliberately not added after approval because the immediately following quick will review interpolation behavior and own deterministic timing coverage.

## User Setup Required

None.

## Next Phase Readiness

- Single-key drag is native-approved and ready to serve as the transaction seam for the later multi-selection/group-move quick.
- The next quick should review interpolation architecture and then add deterministic coverage for closer/farther/generated/minimum-spacing behavior without reopening the approved drag interaction.

---
*Quick: 260718-m2f*
*Completed: 2026-07-19*
