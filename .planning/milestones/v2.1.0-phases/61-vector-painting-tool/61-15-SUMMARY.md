---
phase: 61-vector-painting-tool
plan: 15
subsystem: ui
tags: [preact, signals, watercolor, vector-path, rebake, tdd]

# Dependency graph
requires:
  - phase: 61-vector-painting-tool
    provides: 61-10 path-edit seam, 61-11 Anchor width bundle, the shared apply-refusal capsule and the single-flight script edit latch
provides:
  - A leaf vector-commit seam (fixed Script-Off copy, vector predicate, Draft/wireframe route, single-flight reset+apply)
  - Script-Off vector draws refused before the ledger allocates, without resetting the sheet
  - The stroke-end vector bake tail that puts a committed draw on the live sheet
  - commitAquarelleVectorPathEdit as the ONE writer and ONE bake for a user path edit
  - An async path-edit prop across the mount and layer seams
affects: [61-16, 61-17, 61-18, 61-20]

actuals:
  tokens: 8662
  tasks: 2
  commits: 4
  plan_head_before: 4e1a806fa664b92d46110573b32310a540a523ca
  plan_head_after: f0497865545172918b50cfbe02fbbcbcf9337b40

tech-stack:
  added: []
  patterns:
    - "Inject the sequence ports (isInFlight/begin/end/reset/apply/terminal callbacks) into a leaf module so ordering is unit-testable without the Studio"
    - "ONE async commit callback per gesture: guards, durable-base recovery, post-await latch read, single write, single bake"

key-files:
  created:
    - app/src/components/physic-paint/view/aquarelleVectorPathCommit.ts
    - app/src/components/physic-paint/view/aquarelleVectorPathCommit.test.ts
  modified:
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx

key-decisions:
  - "The in-flight latch is cleared in the sequence's finally BEFORE the terminal callbacks run, so onFailure's snapshot restore cannot be refused by its own latch"
  - "The path-edit commit reads draftMode/wireframeMode only after ensureAquarelleDurableBaseRef resolves (the WR-03 precedent), and only via .peek()"
  - "A failed draw bake and a failed path-edit bake use contextual fallback copy (record landed / edit restored) instead of the move handler's stroke-restored line"
  - "The 61-11 Anchor width bundle keeps its own beginAquarellePathEdit call: the plan's one-writer law covers the overlay path-edit gesture, not the width batch"

requirements-completed: [VEC-01, VEC-02, VEC-07]

coverage:
  - id: D1
    description: "A finished vector draw is re-baked onto the live sheet the moment its commit resolves"
    requirement: VEC-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleVectorPathCommit.test.ts#61-15 the vector commit route > rebakes only when neither the Draft nor the wireframe latch is on"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-15 vector draw bake seam in the Studio > tails the stroke end with exactly one vector bake, after the record and the lift erase"
        status: pass
    human_judgment: true
    rationale: "Unit and source pins prove the route and the tail; only a live Studio draw proves the pixels actually appear without a settle."
  - id: D2
    description: "A Script-Off vector draw is refused with one fixed message and records nothing"
    requirement: VEC-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-15 vector draw bake seam in the Studio > refuses a Script-Off vector draw before the ledger allocates, without resetting the sheet"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleVectorPathCommit.test.ts#61-15 the vector commit route > treats only a non-empty anchor list as a vector stroke, and ships fixed Script-Off copy"
        status: pass
    human_judgment: false
  - id: D3
    description: "A completed path edit re-bakes the live sheet through reset + apply, deferring in Draft or wireframe"
    requirement: VEC-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-10 vector path edit wiring in the Studio > commits a readable edit through one async seam: guards, post-await Draft read, restore on failure"
        status: pass
    human_judgment: true
    rationale: "Source pins prove the seam and the route; only a live anchor/handle drag proves the edited path is visible in the same gesture."
  - id: D4
    description: "Every overlay path edit has exactly one writer, and a failed bake restores the pre-edit script and reports null"
    requirement: VEC-07
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-10 vector path edit wiring in the Studio > commits a readable edit through one async seam: guards, post-await Draft read, restore on failure"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-10 vector path edit wiring in the Studio > refuses a missing or unreadable path through the capsule and stores nothing"
        status: pass
    human_judgment: false
  - id: D5
    description: "The path-edit prop surfaces the async edit id so the mount and layer compile without loosening the result"
    requirement: VEC-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-10 vector path edit wiring in the Studio > threads the mount prop into the layer seam through one ref"
        status: pass
      - kind: integration
        ref: "pnpm --filter efx-motion-editor exec tsc --noEmit"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-11-10
status: complete
---

# Phase 61 Plan 15: Vector Path Commit Bake Summary

**A drawn or edited vector path now re-bakes onto the live sheet on commit, with Script-Off draws refused through the fixed capsule and every overlay path edit funnelled through one async writer**

## Performance

- **Duration:** 6 min
- **Started:** 2026-11-10T21:28:14Z
- **Completed:** 2026-11-10T21:34:28Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added the leaf `aquarelleVectorPathCommit.ts` seam: fixed Script-Off message, the `anchors` vector predicate, the Draft/wireframe route decision, and one single-flight reset+apply sequence with exactly one terminal callback.
- `handleAquarelleStrokeEnd` now refuses a Script-Off vector draw before the ledger allocates (no sheet reset), and tails an accepted vector draw with one `bakeAquarelleVectorCommit()` re-bake so the committed path reaches pixels.
- Added `commitAquarelleVectorPathEdit` as the ONE writer and ONE bake for a user path edit: move-style guards, durable-base recovery, the post-await Draft/wireframe read, one `beginAquarellePathEdit`, and a deferred-pixels route or one reset+apply.
- A failed path-edit bake restores the pre-edit snapshot before publishing, returns null, and records nothing — the seam 61-20 will attach its ledger entry to.
- Widened the mount's `onAquarelleVectorPathEdit` to `Promise<number | null>`; the layer prop stays `void`-returning (a Promise-returning function is assignable).

## Task Commits

Each task was committed atomically (TDD: test → feat):

1. **Task 1 RED: pin the vector commit bake seam and the Script-Off refusal** - `1967168c0` (test)
2. **Task 1 GREEN: bake a committed vector path onto the live sheet** - `9287961a7` (feat)
3. **Task 2 RED: pin the shared vector path edit commit seam** - `177125dc9` (test)
4. **Task 2 GREEN: commit a path edit through ONE writer and re-bake the sheet** - `f04978655` (feat)

**Plan metadata:** recorded with the docs commit that carries this SUMMARY.

## Files Created/Modified

- `app/src/components/physic-paint/view/aquarelleVectorPathCommit.ts` - the leaf route + single-flight sequence, no Studio import
- `app/src/components/physic-paint/view/aquarelleVectorPathCommit.test.ts` - six behaviour tests (vector-ness, fixed copy, route, success/failure/rejection/already-in-flight)
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - the Script-Off refusal, the draw bake tail, and the shared async path-edit commit
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - two new 61-15 source pins, one new guard-order pin, replaced 61-10 pins, refreshed cross-cutting counts
- `app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx` - the async path-edit prop

## Decisions Made

- The sequence clears the in-flight latch in `finally` before `onSuccess`/`onFailure`, so the failure restore can never be refused by its own latch.
- The commit reads `draftMode`/`wireframeMode` only after the durable-base await — the WR-03 hazard would otherwise skip the re-render over fresh pixels.
- Failure copy is contextual: a draw bake failure says the path was recorded but the sheet did not refresh; a path-edit failure says the edit was restored. The move handler's "stroke was restored" line would be false for a draw.
- The vector tail sits inside the existing `try` after the lift erase call, so a failed record (the catch) never bakes.
- The 61-11 Anchor width bundle keeps its own `beginAquarellePathEdit` call — it is a different gesture (width batch), and its shipped pin is preserved.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Refreshed two shipped cross-cutting count pins**
- **Found during:** Task 1 GREEN and Task 2 GREEN
- **Issue:** The shipped exact-count pins became false once the plan's mandated call sites landed: `buildRotoScriptApplyRefusalMessage` went 12 → 14 (the draw bake and the path-edit bake are the twelfth and thirteenth call sites) and `await ensureAquarelleDurableBaseRef.current(` went 9 → 10 (the shared path-edit commit recovers its base first).
- **Fix:** Updated both counts to the exact new totals, documented each new site in the adjacent comments, and added `commitAquarelleVectorPathEdit` to the durable-base handler loop. The assertions still enforce an exact count — nothing was relaxed or deleted.
- **Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- **Verification:** 376 Studio tests pass; the new seams are explicitly listed in the pins.
- **Committed in:** `9287961a7` (Task 1) and `f04978655` (Task 2)

**2. [Rule 2 - Missing Critical] Contextual failure copy instead of the move handler's restore line**
- **Found during:** Task 1 GREEN and Task 2 GREEN
- **Issue:** The plan says to publish "the existing apply-refusal message". The existing fallback chain ends in "the stroke was restored", which is false for a draw (nothing is restored) and imprecise for a rejected path edit only when the snapshot restore is what happened.
- **Fix:** Kept `buildRotoScriptApplyRefusalMessage(error) ?? error?.message` and replaced only the final fallback with truthful, seam-specific copy for the draw bake and the path-edit bake.
- **Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- **Verification:** Source pins assert the publication shape; no test depended on the move-specific fallback text.
- **Committed in:** `9287961a7` and `f04978655`

---

**Total deviations:** 2 auto-fixed (1 stale exact-count pin, 1 copy correctness)
**Impact on plan:** Both were required to keep shipped assertions true and user-facing messages honest. No scope creep.

## Issues Encountered

- The first GREEN typecheck failed because the delegating handler returned `null` from a non-async function typed `Promise<number | null>`; making the delegator `async` fixed it without changing the pinned refusal text.
- `pnpm --filter efx-motion-editor exec vitest run` from the repo root initially looked like it could miss the app cwd; it resolved correctly with the app-local path (the RED/GREEN commands were run from `app/` with plain `pnpm exec`).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G-1/G-2 bake seams are implemented and pinned; live UAT should confirm the sheet visibly shows a drawn path and an edited path in the same gesture (D1/D3 are human-judgment rows).
- 61-16/61-17 can build on the leaf sequence; 61-18 depends directly on `commitAquarelleVectorPathEdit`; 61-20 can record the ledger entry on this commit's success branches — one per gesture.
- No blockers introduced: the refusal and the bake both fail closed, and the pre-edit snapshot restores on a failed path-edit bake.

---
*Phase: 61-vector-painting-tool*
*Completed: 2026-11-10*

## Self-Check: PASSED

- FOUND: app/src/components/physic-paint/view/aquarelleVectorPathCommit.ts
- FOUND: app/src/components/physic-paint/view/aquarelleVectorPathCommit.test.ts
- FOUND: 1967168c0
- FOUND: 9287961a7
- FOUND: 177125dc9
- FOUND: f04978655
