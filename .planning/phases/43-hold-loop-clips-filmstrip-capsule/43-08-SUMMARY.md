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
  - immediate open-edit delivery followed by 12 bounded retries for newly launched Studio windows
  - typed keyboard Delete routing with acknowledgement-gated timeline UI clearing
  - hermetic production-mode Vite budget verification at the locked 1100 kB threshold

affects: [43-10, hold-loop-clips, timeline-canvas, physics-paint-studio, bundle-budget]

actuals:
  tokens: 27698
  tasks: 3
  commits: 11

tech-stack:
  added: []
  patterns:
    - "Closed discriminated request/result envelopes at a cross-window trust boundary, with exact-key runtime guards and bounded identities"
    - "Listener-before-send correlation with bounded retries that reuse one operationId; Studio-side in-flight promise deduplication provides exactly-once mutation and result replay"
    - "One external-synchronization bridge hook per Studio mount; mutable controller/context ports stay in refs instead of adding effect dependencies"
    - "Canvas interactions publish one tooltip request signal to a single DOM tooltip host rather than creating per-capsule elements"
    - "Timeline bridge code stays type-only at module load and resolves runtime operations dynamically at action time"
    - "Fresh Studio launch delivers open-edit immediately, then performs exactly 12 bounded best-effort retries"

key-files:
  created:
    - app/src/components/timeline/TimelineCapsuleTooltip.tsx
    - app/src/components/timeline/TimelineCapsuleTooltip.test.ts
    - app/src/lib/physicPaintLoopOperationBridge.test.ts
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
    - app/src/lib/physicPaintBridge.test.ts
    - app/src/viteBuild.test.ts
    - app/src/types/physicPaint.ts

key-decisions:
  - "Main-timeline Loop Clip mutations never write physicPaintStore directly; the standalone Studio controller remains the sole physical-edit and history authority"
  - "Delete loop keeps a distinct delete-loop request/result identity for correlation and UI feedback, but Studio dispatches unlinkLoop so D-03 unlink-only semantics remain locked"
  - "Repair routes to the existing repairLoop source-regeneration workflow rather than claiming a synchronous data repair; relink carries an explicit non-empty source-key cycle"
  - "Retries reuse one operationId and one request fingerprint; identical requests replay one promise/result, while changed-content operationId reuse fails closed"
  - "Fresh Studio launches receive one immediate open-edit message plus exactly 12 bounded retries; existing-window focus paths remain single-delivery and idempotent"
  - "Timeline interaction and tooltip modules dynamically import bridge operations at action time so the Physics Paint bridge remains outside the eager timeline bundle"
  - "The Vite budget test must force NODE_ENV=production only around its programmatic build and restore the prior value; the locked 1100 kB threshold remains unchanged"

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
        ref: "app/src/components/timeline/TimelineInteraction.test.ts — ten interaction/keyboard tests including typed Delete acknowledgement behavior; combined Plan 43-08 run"
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

duration: 1h 35m
completed: 2026-08-07
---

# Phase 43 Plan 08: Interactive Loop Clip Capsules and Correlated Studio Operations Summary

**Loop Clip capsules now behave as first-class timeline objects with six hit regions, keyboard focus, exact pinned tooltips, additive Studio link badges, and retry-safe mutations executed exactly once by the canonical Physics Paint Studio controller**

## Performance

- **Duration:** 1h 35m
- **Started:** 2026-08-07T09:56:06Z
- **Completed:** 2026-08-07T11:30:45Z
- **Tasks:** 3 plus post-wave regression correction
- **Files modified:** 17 application files plus plan metadata

## Accomplishments

- Added all six locked capsule interaction regions and the one-unit keyboard model: real-key-backed source cells preserve source-key selection/seek, linked first-cycle and ghost occurrences select the Loop Clip without moving the playhead, badges launch/focus loop edit, truncation and outline regions publish the correct tooltip/selection state, and zero-effective anchors retain a non-overlapping 24x24 hit target.
- Added one Preact Signals-backed main-timeline tooltip host with exact English copy for occurrences, truncation, zero-effective and unresolved states; delayed hover, immediate keyboard focus, Escape and pointerleave behavior; viewport clamping; and pinned Edit/Duplicate/Repair/Relink/Unlink/Delete actions with inline guard reasons.
- Replaced the provisional parent-store mutation path with a strict request/result protocol. Tauri targets the Studio/main labels; Browser fallback uses origin-checked postMessage and event.source. One operation ID survives every retry, the child validates active project/layer context, identical in-flight requests execute one controller call and replay the result, and changed-content ID reuse fails closed.
- Kept Phase 43-06 as the only mutation authority: duplicate, unlink, repair and relink dispatch to the existing controller; Delete retains distinct transport identity but invokes unlinkLoop; repair opens the canonical prefilled source-regeneration flow; successful physical edits continue through the Studio history/publication path.
- Added the strictly additive linked-cell visual badge — inset accent border plus 4px top-right dot — without changing cell fill, geometry, palette, legend, drag eligibility or key-selection semantics.
- Corrected the post-wave launch race: a fresh Studio receives open-edit immediately and then exactly 12 bounded retries, while existing Studio focus paths remain idempotent.
- Routed focused-capsule Delete and Backspace through the typed Studio `delete-loop` bridge. Timeline code no longer mutates `physicPaintStore`; UI state clears only after a matching successful acknowledgement and remains intact on rejection or stale acknowledgement.
- Preserved the lazy bundle boundary with action-time bridge imports in timeline modules, and corrected the Vite budget test to build hermetically under `NODE_ENV=production` while retaining the locked 1100 kB limit.

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
9. **Post-wave RED: immediate delivery and keyboard Delete regressions** — `a1719154`
10. **Post-wave GREEN: stable delivery, typed Delete routing and lazy bridge loading** — `eb77e759`
11. **Budget-test correction: hermetic production-mode Vite build** — `8b79e966`

## Files Created/Modified

- `app/src/components/timeline/TimelineInteraction.ts` / `.test.ts` — capsule hit precedence, loop-object selection, tooltip publication, keyboard focus behavior, and acknowledgement-gated typed Delete/Backspace routing without direct physical-store mutation.
- `app/src/components/timeline/TimelineCapsuleTooltip.tsx` / `.test.ts` — single tooltip host, locked copy, visibility controller, pinned action dispatch and correlated bridge operation factory with action-time runtime bridge loading.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — additive link-badge class on linked repetition cells.
- `app/src/components/physic-paint/physicsPaintStudio.css` — inset accent border and 4px corner dot without geometry/palette changes.
- `app/src/types/physicPaint.ts` — closed discriminated loop-operation request/result types and strict exact-key guards.
- `app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.ts` / `.test.ts` — Tauri and Browser request/result transport.
- `app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts` — active-context validation, canonical operation dispatch, in-flight deduplication and result replay.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — one bridge hook wired to the existing Play Script controller.
- `app/src/lib/physicPaintBridge.ts` / `.test.ts` — parent correlation client plus immediate fresh-launch open-edit delivery, 12 bounded retries, focus/launch, timeout and cleanup coverage.
- `app/src/lib/physicPaintLoopOperationBridge.test.ts` — parent listener ordering, correlation, retry-ID reuse and timeout coverage.
- `app/src/viteBuild.test.ts` — hermetic programmatic production build and unchanged 1100 kB resolved budget assertion.

## Decisions Made

- The standalone Studio is the only Loop Clip mutation/history authority. The main timeline sends intent and renders the acknowledged result; it does not synthesize IDs or replace physical loop records.
- Delete remains unlink-only. Its distinct `delete-loop` protocol identity exists solely to preserve action correlation and UI meaning while controller dispatch calls `unlinkLoop`.
- Exactly-once semantics live in the Studio mount. Caching the in-flight result promise closes the race where parent retries arrive before the first controller promise resolves; fingerprint comparison prevents an operation ID from being reused with altered content.
- Cross-window envelopes are closed rather than permissive. Operation-specific fields are allowed only for duplicate/relink, relink cycles must be non-empty and bounded, and result correlation requires operation/project/layer/loop/kind equality.
- The main tooltip remains one canvas-driven host. Signals carry the active request; effects are limited to external window listeners and lifecycle cleanup.
- Keyboard Delete and Backspace are physical Studio operations, not local timeline record edits. Rejection preserves focus/selection/tooltip state, and a delayed acknowledgement cannot clear a newer capsule focus.
- Runtime bridge imports occur only when a timeline action executes; type-only protocol imports preserve compile-time safety without eagerly loading the bridge.
- Programmatic production-build verification owns its environment boundary with `try/finally`; `NODE_ENV=test` must not be allowed to misclassify the desktop bundle budget.

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

**5. [Rule 1 - Bug] Delivered open-edit immediately before bounded fresh-launch retries**
- **Found during:** Post-wave regression review
- **Issue:** Fresh Studio launches did not receive the first open-edit request until the 250 ms retry interval, making delivery scheduling-sensitive and allowing the launch promise to resolve before any request was attempted.
- **Fix:** Await one best-effort delivery immediately after launch, pre-resolve the Tauri event sender, then perform exactly 12 awaited best-effort retries. Existing-window focus paths remain one-shot.
- **Files modified:** `app/src/lib/physicPaintBridge.ts`, `app/src/lib/physicPaintBridge.test.ts`
- **Committed in:** RED `a1719154`, GREEN `eb77e759`

**6. [Rule 2 - Missing Critical Functionality] Routed focused keyboard Delete through Studio authority**
- **Found during:** Post-wave architecture-contract review
- **Issue:** Focused Delete directly replaced Physics Paint loop records from the timeline, bypassing typed correlation, controller guards and Studio history authority.
- **Fix:** Send `delete-loop` through `requestPhysicPaintLoopOperation`, preserve UI state on rejection, clear only after a matching successful acknowledgement, and ignore stale acknowledgements.
- **Files modified:** `app/src/components/timeline/TimelineInteraction.ts`, `app/src/components/timeline/TimelineInteraction.test.ts`
- **Committed in:** RED `a1719154`, GREEN `eb77e759`

**7. [Rule 1 - Bug] Made the Vite budget test model a production build**
- **Found during:** Full-suite verification
- **Issue:** Vitest supplied `NODE_ENV=test` to the programmatic Vite build, producing a development-flavored 1,115.79 kB chunk and a false failure against the production desktop budget.
- **Fix:** Set `NODE_ENV=production` only around `build()` and restore the previous environment in `finally`. The configured and asserted 1100 kB limit remains unchanged; the production chunk is 1,012.28 kB.
- **Files modified:** `app/src/viteBuild.test.ts`
- **Committed in:** `8b79e966`

---

**Total deviations:** 7 (1 user-approved architecture change, 3 Rule 1 bug fixes, 1 Rule 2 critical architecture correction, 2 Rule 3 blocking fixes)
**Impact on plan:** The expanded bridge scope is required to preserve the standalone Studio authority, controller guards and atomic history contract. No dependency, package, schema or unrelated UI changes were introduced.

## Verification

- `pnpm --dir app exec vitest run TimelineCapsuleTooltip physicsPaintBridgeTransport physicPaintLoopOperationBridge` — **38 passed, 0 failed**.
- `pnpm --dir app exec vitest run TimelineInteraction TimelineCapsuleTooltip PhysicsPaintWorkflowStrip` — **88 passed, 0 failed**.
- `pnpm --dir app exec vitest run physicsPaintBridgeTransport physicPaintLoopOperationBridge physicsPaintRotoPlayScriptController` — **127 passed, 0 failed**.
- Post-wave focused bridge/interaction/tooltip gate — **4 files passed; 63 passed, 1 skipped, 0 failed**.
- `pnpm --dir app run typecheck` — **exit 0**.
- `pnpm --dir app exec vitest run src/viteBuild.test.ts` — **11 passed, 0 failed**; production main chunk **1,012.28 kB**, with no chunk-size warning at the locked 1100 kB budget.
- `pnpm build` — **exit 0**; package build, app TypeScript check and production Vite build passed; production main chunk **1,012.28 kB**.
- Three consecutive `pnpm --dir app exec vitest run` stability passes — each **114 files passed, 3 skipped; 1,527 tests passed, 1 skipped, 101 todo, 0 failed**. Each run produced the same **1,012.28 kB** production main chunk and no bridge or chunk-budget failure.
- Acceptance source checks: timeline modules contain no direct `replaceRotoPhysicalLoopClips` mutation path; bridge runtime imports are action-time dynamic imports; `chunkSizeWarningLimit` remains exactly 1100.

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
- The bridge is ready for both Tauri and Browser fallback UAT. Automated evidence proves immediate delivery, bounded retries, payload validation, correlation, typed keyboard Delete, exactly-once controller dispatch and cleanup; this summary does not claim native visual UAT.
- Production build verification is green at the unchanged 1100 kB desktop budget; no deferred chunk-budget item remains.

## Self-Check: PASSED

- FOUND: `.planning/phases/43-hold-loop-clips-filmstrip-capsule/43-08-SUMMARY.md`
- FOUND: `TimelineInteraction.ts`, `TimelineCapsuleTooltip.tsx`, `PhysicsPaintWorkflowStrip.tsx`, `physicPaintLoopOperationBridge.test.ts`
- FOUND commits: `ae0a49d4`, `5aa1f2fe`, `5cc5406b`, `8b91e30e`, `7858f473`, `75bcdf70`, `02fa699d`, `9fcc153e`, `a1719154`, `eb77e759`, `8b79e966`
- Targeted bridge/controller and post-wave regression verification passes; typecheck and production build pass.
- Three consecutive full-suite runs each pass with 1,527 tests passed, 1 skipped and 101 todo; the Vite production chunk is 1,012.28 kB at the unchanged 1100 kB budget.
- No unresolved deferred item remains from Plan 43-08.

---
*Phase: 43-hold-loop-clips-filmstrip-capsule*
*Completed: 2026-08-07*
