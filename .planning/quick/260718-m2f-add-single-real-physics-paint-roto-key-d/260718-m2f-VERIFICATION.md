---
phase: quick-260718-m2f-add-single-real-physics-paint-roto-key-d
verified: 2026-07-19T09:37:37Z
status: passed
score: 7/7 must-haves verified
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "Generated cells reject the drop as destinations"
    reason: "The initial destination prohibition was superseded by the approved final product behavior: generated cells remain invalid drag sources, but may be requested destinations when the canonical move-timing resolver produces a legal effective real-key destination. Native UAT approved this behavior on 2026-07-19."
    accepted_by: "Laurent Marques"
    accepted_at: "2026-07-19T09:37:37Z"
re_verification:
  previous_status: gaps_found
  previous_score: 6/7
  gaps_closed:
    - "Move transaction normalization now preserves backgroundOnly metadata through local replacement and parent publication."
  gaps_remaining: []
  regressions: []
---

# Quick Task 260718-m2f Verification Report

**Goal:** Add safe single-real-key Physics Paint Roto drag movement through the canonical atomic transaction, persistence, settlement, and local history seams without introducing multi-selection or a general interpolation redesign.

**Verified:** 2026-07-19T09:37:37Z  
**Status:** PASSED  
**Re-verification:** Yes — after corrective commit `53c23549`

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | One valid drag creates one non-ripple atomic move mapping and leaves unrelated canonical source frames fixed. | VERIFIED | `buildRotoKeyMoveTransaction()` constructs exactly one `{ fromFrame, toFrame, mode: 'move' }` mapping and rebuilds the final source set without shifting remaining sources (`physicsPaintRotoKeyController.ts:283-349`). The final projection explicitly rejects movement of unaffected keys (`:261-269`). |
| 2 | Invalid, occupied, same-source, stale, out-of-range, and newly locked drops do not commit; generated destination behavior follows the approved final decision. | VERIFIED (override applied) | Workflow and Studio revalidate current candidate/range/locks before transaction construction (`PhysicsPaintWorkflowStrip.tsx:362-404`, `PhysicsPaintStudio.tsx:787-838`). Occupied and same-source targets reject. Generated sources cannot initiate drag; generated requested destinations are accepted only through canonical timing resolution, per the approved superseding decision. |
| 3 | Destination ownership and spacing are resolved after removing the source, and the final canonical projection remains valid. | VERIFIED | `resolveRotoKeyMoveTiming()` removes the source, builds the remaining model and overrides, resolves the requested destination, rebuilds final timing, validates the moved projection, and checks every remaining key's display position (`physicsPaintRotoKeyController.ts:183-280`). Preview and commit share this resolver through Studio (`PhysicsPaintStudio.tsx:96-116`, `:776-838`). |
| 4 | Pointer capture, threshold, compact preview, Escape-first cancellation, cleanup, scroll-aware hit testing, and edge auto-scroll preserve click behavior. | VERIFIED | One scalar gesture session uses a 6px threshold, Pointer Events, capture, `elementFromPoint`, scroller containment, timestamp-scaled rAF scrolling, idempotent cleanup, Escape capture handling, lost-capture cancellation, model invalidation, and destination focus (`PhysicsPaintWorkflowStrip.tsx:169-203`, `:362-569`). Native UAT approved on 2026-07-19. |
| 5 | A committed move preserves the complete real-key/cache/editable/preview/dirty/background payload, regenerates once locally, and publishes one parent replacement payload. | VERIFIED | Move-specific normalization spreads the complete frame and removes only generated-interpolation ownership fields (`physicsPaintRotoKeyController.ts:736-760`). `makeTransaction()` now selects `normalizeMoveRealKeyFrames()` only for `operation === 'move'`, while non-move utilities retain `normalizeRealKeyFrames()` (`:599-615`). Local state maps and complete snapshots preserve editable, preview, captured, dirty, reference, repaint-base, and engine state (`PhysicsPaintStudio.tsx:560-675`). Persistence performs one local `replaceRotoKeyFrames()` and sends one `replace-roto-key-frames` payload (`useRotoPersistenceIntegration.ts:129-195`). |
| 6 | Matching acceptance finalizes once; transport/parent/timeout failure rolls back only under the original identity; replacement/disposal prevents stale settlement. | VERIFIED | Settlement is bound to operation ID, kind, layer, and start frame, clears timeout/pending ownership before one callback, and has explicit transport, parent, timeout, launch-replacement, and disposal outcomes (`useRotoApplyLifecycle.ts:51-135`). Launch replacement cancels before pending state reset (`usePhysicsPaintLaunchIntegration.ts:89-96`). Studio rollback/finalization rechecks launch identity (`PhysicsPaintStudio.tsx:591-706`, `:847-880`). |
| 7 | Accepted move, Undo, and Redo are one chronological local action with paint barriers and do not alter the global application timeline. | VERIFIED | The focused history hook stores only move commands and opaque paint barriers, records accepted moves only, advances replay history only after acknowledged success, and resets on launch identity change (`useRotoKeyMoveHistory.ts:43-176`). Studio wires paint mutation IDs before early returns and routes tool-rail Undo/Redo through the coordinator (`PhysicsPaintStudio.tsx:757-774`, `:977-1025`). Native UAT approved on 2026-07-19. |

**Score:** 7/7 must-haves verified, including one approved product-decision override.

## Corrective Payload Trace

The previous sole gap is closed through the complete payload path:

1. `buildRotoKeyMoveTransaction()` initially normalizes move frames with `normalizeMoveRealKeyFrames()` (`physicsPaintRotoKeyController.ts:283-286`).
2. `normalizeMoveRealKeyFrame()` starts from `{ ...frame }`, preserving `backgroundOnly`, `onionDataUrl`, pixel data, dimensions, and other non-generated metadata; it deletes only generated-interpolation linkage fields (`:746-760`).
3. The generic `makeTransaction()` boundary now branches on `input.operation === 'move'` and reuses the move-specific normalizer (`:599-603`). Non-move operations still use `normalizeRealKeyFrames()`, whose existing cleanup behavior is unchanged (`:603`, `:763-787`).
4. Studio passes `transaction.realKeyFrames` into the move-specific persistence seam (`PhysicsPaintStudio.tsx:830-871`).
5. Local replacement and parent payload creation clone frames with object spread and do not strip `backgroundOnly` (`useRotoPersistenceIntegration.ts:137-147`, `:158-188`).
6. The payload validator explicitly accepts optional boolean `backgroundOnly` on Roto cache frames (`types/physicPaint.ts:338-350`).
7. The receiving store copies the complete frame into the real-key layer and passes `frame.backgroundOnly` into durable cache metadata before one interpolation regeneration (`physicPaintStore.ts:807-849`).
8. Transport sends the payload object directly through Tauri or same-origin `postMessage` without remapping frame fields (`physicsPaintBridgeTransport.ts:84-98`).

Result: `backgroundOnly: true` now survives transaction normalization, optimistic local replacement, transport validation, parent publication, and durable store replacement.

## Required Artifacts

| Artifact | Status | Details |
|---|---|---|
| `app/src/components/physic-paint/roto/physicsPaintRotoKeyController.ts` | VERIFIED | Substantive move-only timing/transaction implementation; corrective normalization branch present. |
| `app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.ts` | VERIFIED | One local replacement, one parent payload, acknowledgement settlement, and transport-failure handling. |
| `app/src/components/physic-paint/hooks/useRotoApplyLifecycle.ts` | VERIFIED | Idempotent operation-bound settlement across all terminal outcomes. |
| `app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts` | VERIFIED | Launch replacement cancels move settlement before clearing pending state; disposal is wired. |
| `app/src/components/physic-paint/hooks/useRotoKeyMoveHistory.ts` | VERIFIED | Focused accepted-move history with paint-order barriers. |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` | VERIFIED | Captured Pointer Events gesture, authoritative candidate feedback, cleanup, scrolling, and focus handoff. |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | VERIFIED | Save barrier, latest-state revalidation, transaction construction, ownership mapping, settlement, rollback, finalization, and history wiring. |
| `app/src/components/physic-paint/physicsPaintStudio.css` | VERIFIED | Grab/source/valid/invalid/committing states preserve existing focus outlines and cell layout. |

## Key Link Verification

| From | To | Status | Evidence |
|---|---|---|---|
| Workflow strip | Studio | WIRED | Threshold-crossed valid release invokes `onMoveRotoKey(sourceFrame, requestedDestinationFrame)` and uses the resolved effective destination for focus (`PhysicsPaintWorkflowStrip.tsx:501-533`). |
| Studio | Roto key controller | WIRED | Studio imports and calls `resolveRotoKeyMoveTiming()` and `buildRotoKeyMoveTransaction()` after the live-pixel barrier and latest-state re-read (`PhysicsPaintStudio.tsx:38`, `:787-838`). The PLAN's literal `moveKey` grep pattern is stale, but the intended link is present. |
| Move history | Persistence | WIRED | Replay snapshots build one move transaction and call `commitRotoKeyMove()` (`PhysicsPaintStudio.tsx:708-755`). |
| Apply lifecycle | Move history/finalization | WIRED | Matching settlement invokes Studio's accepted/failure callback; accepted moves alone are recorded (`useRotoApplyLifecycle.ts:82-120`, `PhysicsPaintStudio.tsx:847-871`). |
| Move history | Studio Undo/Redo | WIRED | Tool rail delegates to Studio's combined async Undo/Redo, with completed paint mutations registered as chronological barriers (`PhysicsPaintStudio.tsx:757-774`, `:977-1025`). |

## Scope Isolation

- Full production diff `d525344b..53c23549`: 8 Physics Paint files, 1,518 insertions and 39 deletions.
- Corrective diff `f12362c2..53c23549`: exactly one file and four changed lines in `makeTransaction()`.
- No test/spec files changed.
- No package or lockfile changes.
- No changes to general interpolation modules such as `rotoSourceDisplayModel.ts`, `physicsPaintRotoWorkflow.ts`, `useRotoInterpolationController.ts`, `physicPaintStore.ts`, or shared Physics Paint types.
- Gesture and transaction state remains scalar (`sourceFrame`, one requested/effective destination, one frame mapping). No selection arrays, marquee/range selection, group move, ripple, replacement, or swapping implementation was introduced.

## Automated Gates

| Check | Result | Status |
|---|---|---|
| `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app typecheck` | `tsc --noEmit` completed successfully. | PASS |
| `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app build` | Vite 5.4.21 transformed 1,086 modules and completed the production build. | PASS |
| Regression tests | Not run or modified, per explicit task authorization. Deterministic interpolation coverage remains assigned to the next quick. | NOT APPLICABLE |
| Native UAT | Approved by the user on 2026-07-19. | PASS |

## Anti-Pattern Scan

No unreferenced `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, placeholder text, prohibited selection/ripple additions, whitespace defects, or test changes were found in the quick diff. Existing defensive no-op callback initializers and error logging are substantive lifecycle plumbing, not stubs.

## Requirements Coverage

| Requirement | Status | Evidence |
|---|---|---|
| `QUICK-260718-M2F` | SATISFIED | All seven merged must-haves verified; corrective metadata path closed; production gates and native UAT passed; scope exclusions preserved. |

## Final Verdict

The corrective commit `53c23549` closes the sole verification gap. Move payloads preserve `backgroundOnly` through the complete transaction, local replacement, transport, validation, and receiving-store path, while non-move utility normalization remains unchanged. The complete single-key drag goal is achieved, generated-destination behavior matches the explicitly approved final decision, and no multi-selection or general interpolation redesign was introduced.

---

_Verified: 2026-07-19T09:37:37Z_  
_Verifier: Claude (gsd-verifier)_
