---
phase: 43-hold-loop-clips-filmstrip-capsule
plan: 08
subsystem: timeline-ui
status: complete
tags: [timeline, loop-clips, preact, tauri-events, postmessage, correlation, tooltip, vitest]

requires:
  - phase: 43-hold-loop-clips-filmstrip-capsule
    plan: 06
    provides: canonical duplicateLinkedLoop, unlinkLoop, repairLoop, relinkLoop controller operations and launch-or-focus loop-edit bridge
  - phase: 43-hold-loop-clips-filmstrip-capsule
    plan: 07
    provides: compact capsule geometry, hit extents, source-cell identity, truncation and zero-effective presentation model
provides:
  - six-region Loop Clip capsule interaction with loop-object selection and one-unit keyboard focus
  - one main-timeline flat-multiline tooltip host with locked copy, delayed hover, immediate focus, Escape dismissal, and pinned actions
  - strict correlated parent-to-child Loop Clip mutation protocol over Tauri events and origin-checked Browser postMessage
  - retry-safe exactly-once Studio dispatch through the Phase 43-06 canonical loop controller
  - additive linked-cell badge in the Studio workflow strip with unchanged geometry and palette
  - inline controller guard reasons while unresolved Loop Clip records remain authoritative in Studio
  - pre-existing chunk-budget failure recorded for dedicated follow-up

affects: [43-10, hold-loop-clips, timeline-canvas, physics-paint-studio, bundle-budget]

actuals:
  tokens: 24923
  tasks: 3
  commits: 8

tech-stack:
  added: []
  patterns:
    - "Closed discriminated request/result envelopes at a cross-window trust boundary, with exact-key runtime guards and bounded identities"
    - "Listener-before-send correlation with bounded retries that reuse one operationId; Studio-side in-flight promise deduplication provides exactly-once mutation and result replay"
    - "One external-synchronization bridge hook per Studio mount; mutable controller/context ports stay in refs instead of adding effect dependencies"
    - "Canvas interactions publish one tooltip request signal to a single DOM tooltip host rather than creating per-capsule elements"

key-files:
  created:
    - app/src/components/timeline/TimelineCapsuleTooltip.tsx
    - app/src/components/timeline/TimelineCapsuleTooltip.test.ts
    - app/src/lib/physicPaintLoopOperationBridge.test.ts
    - .planning/phases/43-hold-loop-clips-filmstrip-capsule/deferred-items.md
  modified:
    - app/src/components/timeline/TimelineInteraction.ts
    - app/src/components/timeline/TimelineInteraction.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.ts
    - app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.test.ts
    - app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts
    - app/src/lib/physicPaintBridge.ts
    - app/src/types/physicPaint.ts

key-decisions:
  - "Main-timeline Loop Clip mutations never write physicPaintStore directly; the standalone Studio controller remains the sole physical-edit and history authority"
  - "Delete loop keeps a distinct delete-loop request/result identity for correlation and UI feedback, but Studio dispatches unlinkLoop so D-03 unlink-only semantics remain locked"
  - "Repair routes to the existing repairLoop source-regeneration workflow rather than claiming a synchronous data repair; relink carries an explicit non-empty source-key cycle"
  - "Retries reuse one operationId and one request fingerprint; identical requests replay one promise/result, while changed-content operationId reuse fails closed"
  - "The pre-existing 1100 kB chunk-budget failure is deferred rather than weakening the test threshold or expanding this interaction plan into bundle architecture work"

patterns-established:
  - "Cross-window mutation protocol: exact payload guard -> active project/layer validation -> canonical controller call -> fully correlated closed result"
  - "Browser results return to event.source; Tauri results target main; both transports share the same request/result guards"
  - "Tooltip operation factories accept an injectable bridge seam for behavioral tests while production defaults use the correlated Studio request client"

requirements-completed: [HOLD-06]

coverage:
  - id: D1
    description: "Six capsule hit regions distinguish real source keys from linked occurrences; badge, anchor, truncation, band/ghost and outline actions preserve the locked selection and seek semantics"
    requirement: HOLD-06
    verification:
      - kind: unit
        ref: "app/src/components/timeline/TimelineInteraction.test.ts — eight interaction/keyboard tests; combined Plan 43-08 run"
        status: pass
    human_judgment: false
  - id: D2
    description: "The main timeline has one tooltip host with exact occurrence/truncation/zero-effective/unresolved copy, 1000ms hover delay, immediate focus, Escape, pointerleave cancellation and 8px viewport clamping"
    requirement: HOLD-06
    verification:
      - kind: unit
        ref: "app/src/components/timeline/TimelineCapsuleTooltip.test.ts — nine copy, lifecycle, positioning and action tests"
        status: pass
    human_judgment: false
  - id: D3
    description: "Pinned duplicate, unlink, delete, repair and relink actions use a strict correlated Studio bridge with timeout, retry, stale-context rejection, exactly-once controller dispatch and result replay"
    requirement: HOLD-06
    verification:
      - kind: integration
        ref: "physicsPaintBridgeTransport.test.ts + physicPaintLoopOperationBridge.test.ts + physicsPaintRotoPlayScriptController.test.ts — 127 tests passed"
        status: pass
    human_judgment: false
  - id: D4
    description: "Linked and linked-unresolved Studio workflow cells retain their existing fill and 18x24 geometry while adding the inset accent border and 4px corner dot"
    requirement: HOLD-06
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts — 71 tests passed in combined Plan run"
        status: pass
    human_judgment: false
  - id: D5
    description: "Native canvas tooltip positioning, capsule focus-ring legibility, pointer hit comfort and linked-cell badge visual fidelity"
    requirement: HOLD-06
    verification: []
    human_judgment: true
    rationale: "Automated tests prove geometry, dispatch, copy and CSS contracts; native visual/interaction polish remains the user's Phase 43-10 UAT surface and is not claimed here"

duration: 1h 3m
completed: 2026-08-07
---

# Phase 43 Plan 08: Interactive Loop Clip Capsules and Correlated Studio Operations Summary

**Loop Clip capsules now behave as first-class timeline objects with six hit regions, keyboard focus, exact pinned tooltips, additive Studio link badges, and retry-safe mutations executed exactly once by the canonical Physics Paint Studio controller**

## Performance

- **Duration:** 1h 3m
- **Started:** 2026-08-07T09:56:06Z
- **Completed:** 2026-08-07T10:59:32Z
- **Tasks:** 3
- **Files modified:** 15 application files plus plan metadata/deferred tracking

## Accomplishments

- Added all six locked capsule interaction regions and the one-unit keyboard model: real-key-backed source cells preserve source-key selection/seek, linked first-cycle and ghost occurrences select the Loop Clip without moving the playhead, badges launch/focus loop edit, truncation and outline regions publish the correct tooltip/selection state, and zero-effective anchors retain a non-overlapping 24x24 hit target.
- Added one Preact Signals-backed main-timeline tooltip host with exact English copy for occurrences, truncation, zero-effective and unresolved states; delayed hover, immediate keyboard focus, Escape and pointerleave behavior; viewport clamping; and pinned Edit/Duplicate/Repair/Relink/Unlink/Delete actions with inline guard reasons.
- Replaced the provisional parent-store mutation path with a strict request/result protocol. Tauri targets the Studio/main labels; Browser fallback uses origin-checked postMessage and event.source. One operation ID survives every retry, the child validates active project/layer context, identical in-flight requests execute one controller call and replay the result, and changed-content ID reuse fails closed.
- Kept Phase 43-06 as the only mutation authority: duplicate, unlink, repair and relink dispatch to the existing controller; Delete retains distinct transport identity but invokes unlinkLoop; repair opens the canonical prefilled source-regeneration flow; successful physical edits continue through the Studio history/publication path.
- Added the strictly additive linked-cell visual badge — inset accent border plus 4px top-right dot — without changing cell fill, geometry, palette, legend, drag eligibility or key-selection semantics.

## Task Commits

Each task followed TDD RED/GREEN commits; the approved Task 2 bridge correction added a second RED/GREEN pair:

1. **Task 1 RED: capsule interaction specifications** — `ae0a49d4`
2. **Task 1 GREEN: six hit regions and keyboard focus unit** — `5aa1f2fe`
3. **Task 2 RED: main-timeline tooltip specifications** — `5cc5406b`
4. **Task 2 GREEN: tooltip host and pinned actions** — `8b91e30e`
5. **Task 3 RED: linked-cell badge contract** — `7858f473`
6. **Task 3 GREEN: additive Studio linked-cell badge** — `75bcdf70`
7. **Task 2 architecture RED: typed bridge/protocol coverage** — `02fa699d`
8. **Task 2 architecture GREEN: correlated Studio operation bridge** — `9fcc153e`

## Files Created/Modified

- `app/src/components/timeline/TimelineInteraction.ts` / `.test.ts` — capsule hit precedence, loop-object selection, tooltip publication and keyboard focus behavior.
- `app/src/components/timeline/TimelineCapsuleTooltip.tsx` / `.test.ts` — single tooltip host, locked copy, visibility controller, pinned action dispatch and correlated bridge operation factory.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — additive link-badge class on linked repetition cells.
- `app/src/components/physic-paint/physicsPaintStudio.css` — inset accent border and 4px corner dot without geometry/palette changes.
- `app/src/types/physicPaint.ts` — closed discriminated loop-operation request/result types and strict exact-key guards.
- `app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.ts` / `.test.ts` — Tauri and Browser request/result transport.
- `app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts` — active-context validation, canonical operation dispatch, in-flight deduplication and result replay.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — one bridge hook wired to the existing Play Script controller.
- `app/src/lib/physicPaintBridge.ts` — parent correlation client with listener-before-send, focus/launch, retry, timeout and cleanup.
- `app/src/lib/physicPaintLoopOperationBridge.test.ts` — parent listener ordering, correlation, retry-ID reuse and timeout coverage.

## Decisions Made

- The standalone Studio is the only Loop Clip mutation/history authority. The main timeline sends intent and renders the acknowledged result; it does not synthesize IDs or replace physical loop records.
- Delete remains unlink-only. Its distinct `delete-loop` protocol identity exists solely to preserve action correlation and UI meaning while controller dispatch calls `unlinkLoop`.
- Exactly-once semantics live in the Studio mount. Caching the in-flight result promise closes the race where parent retries arrive before the first controller promise resolves; fingerprint comparison prevents an operation ID from being reused with altered content.
- Cross-window envelopes are closed rather than permissive. Operation-specific fields are allowed only for duplicate/relink, relink cycles must be non-empty and bounded, and result correlation requires operation/project/layer/loop/kind equality.
- The main tooltip remains one canvas-driven host. Signals carry the active request; effects are limited to external window listeners and lifecycle cleanup.

## Deviations from Plan

### Approved Architecture Deviation

**1. [Rule 4 - Architecture] Replaced direct parent-store mutations with a typed parent-to-child request/result bridge**
- **Found during:** Task 2 architecture review checkpoint
- **Issue:** The plan's original file list implied direct tooltip-to-controller wiring, but the standalone Studio owns the canonical controller and physical-edit history. Direct parent-store writes would bypass controller guards, repair semantics, atomic publication and Undo/Redo.
- **Approved change:** Widen Task 2 to the shared protocol, Browser/Tauri transport, Studio bridge hook, parent correlation helper and focused tests. Preserve the tooltip's narrow operation-factory seam.
- **Files modified:** `physicPaint.ts`, `physicsPaintBridgeTransport.ts`, `usePhysicsPaintParentBridge.ts`, `physicPaintBridge.ts`, `PhysicsPaintStudio.tsx`, tooltip source/specs and bridge specs.
- **Verification:** RED commit `02fa699d`; GREEN commit `9fcc153e`; focused 38 tests, combined 88 tests, and bridge/controller 127 tests all pass; typecheck exits 0.

### Auto-fixed Issues

**2. [Rule 1 - Bug] Ensured Browser result calls omit an absent parent target**
- **Found during:** Task 2 architecture GREEN focused run
- **Issue:** Handler tests observed an explicit second `undefined` argument, obscuring the intended result-port contract.
- **Fix:** Funnel every result path through a publisher that passes the Browser source only when present.
- **Files modified:** `app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts`
- **Committed in:** `9fcc153e`

**3. [Rule 3 - Blocking] Added realistic timeline authority and async timer ordering to bridge tests**
- **Found during:** Task 2 architecture GREEN focused run
- **Issue:** The tooltip bridge test had no Physics Paint sequence/layer, so production correctly failed closed; the timeout test advanced fake time before asynchronous runtime detection and launch had installed the timeout.
- **Fix:** Seed the minimum Physics Paint sequence fixture and wait for first delivery before advancing the timeout clock.
- **Files modified:** `TimelineCapsuleTooltip.test.ts`, `physicPaintLoopOperationBridge.test.ts`
- **Committed in:** `9fcc153e`

**4. [Rule 3 - Blocking] Fail closed when launch context has no project**
- **Found during:** Final typecheck
- **Issue:** `PhysicPaintLaunchContext.project` is optional at the type boundary, so active-context extraction could not safely dereference it.
- **Fix:** Return no active operation context until a project context exists; child requests then receive the existing project-context-changed rejection.
- **Files modified:** `app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts`
- **Committed in:** `9fcc153e`

---

**Total deviations:** 4 (1 user-approved architecture change, 1 Rule 1 bug fix, 2 Rule 3 blocking fixes)
**Impact on plan:** The expanded bridge scope is required to preserve the standalone Studio authority, controller guards and atomic history contract. No dependency, package, schema or unrelated UI changes were introduced.

## Verification

- `pnpm --dir app exec vitest run TimelineCapsuleTooltip physicsPaintBridgeTransport physicPaintLoopOperationBridge` — **38 passed, 0 failed**.
- `pnpm --dir app exec vitest run TimelineInteraction TimelineCapsuleTooltip PhysicsPaintWorkflowStrip` — **88 passed, 0 failed**.
- `pnpm --dir app exec vitest run physicsPaintBridgeTransport physicPaintLoopOperationBridge physicsPaintRotoPlayScriptController` — **127 passed, 0 failed**.
- `pnpm --dir app run typecheck` — **exit 0**.
- `pnpm --dir app exec vitest run` — **1,524 passed, 1 skipped, 101 todo; 1 pre-existing failure** in `src/viteBuild.test.ts` because the main chunk exceeds the 1100 kB warning budget.
- Baseline proof at pre-GREEN commit `02fa699d`: the same build test already failed with a **1,112.66 kB** main chunk; current output is **1,115.79 kB**. The issue is recorded in `deferred-items.md`; the locked warning threshold was not weakened.
- Acceptance source check: `TimelineCapsuleTooltip.tsx` contains no `replaceRotoPhysicalLoopClips` or `createPhysicPaintRotoKeyId` direct-mutation path.

## Deferred Issues

- **Production chunk budget:** pre-existing at `02fa699d`, outside this plan's interaction/bridge scope. Requires dedicated bundle splitting or dependency-budget work. See `.planning/phases/43-hold-loop-clips-filmstrip-capsule/deferred-items.md`.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: cross-window-mutation-protocol | `app/src/types/physicPaint.ts`, `app/src/lib/physicPaintBridge.ts`, `app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts` | New Tauri/postMessage mutation surface not listed in the original plan threat register; mitigated with origin checks, exact-key guards, bounded identities, active project/layer validation, full result correlation, request fingerprinting and exactly-once replay. |

## Known Stubs

None. The existing `loop-placeholder` domain state in `PhysicsPaintStudio.tsx` is a real playback state from earlier Phase 43 work, not an implementation stub introduced by this plan.

## Authentication Gates

None.

## User Setup Required

None - no dependencies, external services, environment variables or manual configuration were added.

## Next Phase Readiness

- Plan 43-10 can perform native UAT for pointer hit comfort, focus return, tooltip placement/copy, operation guard feedback, repair/relink workflows and linked-cell badge fidelity.
- The bridge is ready for both Tauri and Browser fallback UAT. Automated evidence proves payload validation, correlation, retry behavior, exactly-once controller dispatch and cleanup; this summary does not claim native visual UAT.
- The chunk-budget failure remains a separate bundle-architecture concern and does not invalidate the passing Plan 43-08 behavior suites.

## Self-Check: PASSED

- FOUND: `.planning/phases/43-hold-loop-clips-filmstrip-capsule/43-08-SUMMARY.md`
- FOUND: `TimelineInteraction.ts`, `TimelineCapsuleTooltip.tsx`, `PhysicsPaintWorkflowStrip.tsx`, `physicPaintLoopOperationBridge.test.ts`
- FOUND commits: `ae0a49d4`, `5aa1f2fe`, `5cc5406b`, `8b91e30e`, `7858f473`, `75bcdf70`, `02fa699d`, `9fcc153e`
- Targeted and combined Plan 43-08 verification passes; bridge/controller verification passes; typecheck passes.
- Full-suite exception is honestly recorded with a reproducible pre-GREEN baseline and deferred ledger entry; no passing claim is made for the chunk-budget assertion.

---
*Phase: 43-hold-loop-clips-filmstrip-capsule*
*Completed: 2026-08-07*
