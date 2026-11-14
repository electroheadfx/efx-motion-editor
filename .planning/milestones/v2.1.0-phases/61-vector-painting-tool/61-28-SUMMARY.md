---
phase: 61-vector-painting-tool
plan: 28
subsystem: ui
tags: [vector-path, path-edit-session, pointer-capture, gesture-lifecycle, preact-signals, source-pins]

# Dependency graph
requires:
  - phase: 61-vector-painting-tool
    provides: "61-25's overlay chrome/band law and its shipped anchor-drag preview, plus the 67-test overlay baseline this plan extends"
  - phase: 61-vector-painting-tool
    provides: "61-10's clear-before-commit law (T-61-30): the preview signal clears BEFORE `onPathEdit`, so a same-tick repeat finds nothing"
  - phase: 61-vector-painting-tool
    provides: "61-16's release-after-commit law (T-61-57): pointer capture is released after the commit decision, never in a way that could swallow the edit"
provides:
  - "`surfaceRef` on the overlay root, plus ONE `editMutationId`-keyed cleanup effect that clears `dragRef`, clears `vectorPathEditDrag` compare-then-write and releases the captured pointer on edit close or retarget"
  - "Target guards at the top of `continueEditDrag` and `finishEditDrag`: a drag whose stroke is not the open edit's target can neither preview nor commit"
  - "A start-of-gesture reset at the top of `startEditDrag`: every press first ends the drag before it, even a press that hits nothing"
  - "Five new pins in the `61-28 CR-01` overlay group (two behavioural through the real handlers, three source pins)"
affects: [61-29, 61-30, 61-31]

# Actuals (#2632) — same estimateTokens scale (chars/4 over the realized diff)
actuals:
  tokens: 3273
  tasks: 2
  commits: 4

plan_head_before: b6f1ad2be3505c5349df756dd75884afd989a887
plan_head_after: 38a91ef382ed7be6bab44ed7d79ad85d9e280f17

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "An edit-lifetime effect keyed on the primitive `editMutationId`: early-return on a live drag, compare-then-write via `.peek()`, release through the root `surfaceRef`, and never a commit"
    - "A start-of-gesture reset ABOVE every gesture branch: a press owns ending the previous gesture, so no abandoned drag can ride a later release into a commit"
    - "A target guard as the second statement of each live handler, before any write or callback; the guard performs no cleanup because the effect owns the clearing"
    - "The harness pins the mounted-effect and guard source text statically while the start-of-gesture law runs behaviourally through the real pointer handlers"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/engine/VectorPathOverlay.tsx
    - app/src/components/physic-paint/engine/VectorPathOverlay.test.ts

key-decisions:
  - "The effect compares `String(drag.mutationId) === editMutationId` (the latch is already `string | null`) so one comparison law covers both the closed and the retargeted case; the live-drag early return precedes every clearing step"
  - "The `finishEditDrag` guard sits before `dragRef.current = null` and before the shipped clear-before-commit block, so the T-61-30 order is byte-identical"
  - "The start-of-gesture reset lives after the primary-button guard and before the target check: a press that hits nothing still ends the previous drag, which is exactly the CR-01 phantom-commit path"
  - "The guards perform no cleanup — the effect owns the clearing — so a same-tick stray event can neither preview nor commit the stale stroke"
  - "Every preview clear is compare-then-write (`.peek() !== null` first), including the two new clearing sites, per the mandatory `efx-preact-reactivity` skill"

requirements-completed: [VEC-02, VEC-07]

coverage:
  - id: D1
    description: "A new press always ends the drag before it, even a press that hits nothing: the previous pointer's capture is released once and the abandoned gesture commits nothing on the release that follows."
    requirement: VEC-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#61-28 CR-01 - the edit-lifetime drag law > ends the previous drag when a new press hits nothing, and releases its capture"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#61-28 CR-01 - the edit-lifetime drag law > commits nothing from the abandoned drag after the empty press"
        status: pass
    human_judgment: false
  - id: D2
    description: "An edit that closes or retargets mid-drag leaves no drag state, no stale preview and no captured pointer: one `editMutationId`-keyed effect clears all three without committing, and both live handlers refuse a non-matching drag before any preview write or `onPathEdit`."
    requirement: VEC-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#61-28 CR-01 - the edit-lifetime drag law > adds one editMutationId-keyed effect that clears the drag, the preview and the capture"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#61-28 CR-01 - the edit-lifetime drag law > keeps a live gesture when the drag still belongs to the open edit"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#61-28 CR-01 - the edit-lifetime drag law > refuses a non-matching drag before any preview write or commit in both handlers"
        status: pass
    human_judgment: false
  - id: D3
    description: "Native UAT: Escape or a selection change mid-drag closes the edit with nothing left to commit; an empty press mid-drag followed by a release moves no anchor; a normal drag still lands exactly one undoable edit."
    verification: []
    human_judgment: true
    rationale: "Rows A/B/C are live WKWebView gesture sequences in the Studio window: whether releasing a stale captured pointer changes nothing, whether the anchors vanish on Escape, and whether a normal drag commits once. The harness materializes vnodes with no DOM and mocks `preact/hooks`, so a mounted re-render with a surviving `dragRef` is not expressible — only the user can judge the gesture."

duration: 3 min
completed: 2026-11-11
status: complete
---

# Phase 61 Plan 28: the edit-lifetime drag law Summary

**A path-edit drag now belongs to the edit that opened it — closing or retargeting the edit cancels the gesture, clears the preview and releases the pointer, and a press that hits nothing can no longer let an abandoned drag commit**

## Performance

- **Duration:** 3 min
- **Started:** 2026-11-11T11:52:54Z
- **Completed:** 2026-11-11T11:56:04Z
- **Tasks:** 2
- **Files modified:** 2 (plus per-task RED evidence under `.red-evidence/61-28-t1/` and `61-28-t2/`)

## Accomplishments

- **Start-of-gesture reset (Task 1).** `startEditDrag` now captures the previous `dragRef.current` after the primary-button guard and before any target check, sets it to null, clears `vectorPathEditDrag` through its compare-then-write form and calls `releasePointerCapture(event.currentTarget, previousDrag.pointerId)`. A press that hits nothing still ends the gesture before it, closing the CR-01 path where a release after an empty press committed the abandoned drag's moved anchors — the RED test proved that commit happened once at HEAD.
- **Edit-lifetime cleanup effect (Task 2).** A new `surfaceRef` sits beside `dragRef` and the overlay root carries `ref={surfaceRef}`. One effect keyed on `[editMutationId]` returns when there is no drag, returns when the drag still belongs to the open edit (`editMutationId !== null && String(drag.mutationId) === editMutationId`), and otherwise clears `dragRef`, clears the preview compare-then-write and releases the captured pointer through `surfaceRef`. It covers both endings — the edit closed and the edit retargeted to another stroke — and commits nothing: an abandoned gesture is cancelled, never flushed.
- **Target guards (Task 2).** `continueEditDrag` and `finishEditDrag` each refuse as their second statement when `editTargetMutationId === null || drag.mutationId !== editTargetMutationId`, before any preview write and before `onPathEdit`. The guards do no cleanup; the effect owns it. The shipped `finishEditDrag` clear-before-commit block (T-61-30), promotion branch and release-after-commit order (T-61-57) are untouched, as is `cancelEditDrag`.
- **Pins.** The `61-28 CR-01` group adds five tests: two behavioural through the real pointer handlers (empty-press capture release; no commit after the empty press) and three source pins (the effect + `surfaceRef`; the live-drag early return; the two guards and their ordering before every write/commit). No shipped pin was modified — the suite grew 67 → 69 → 72.
- **Threat-mitigated as planned:** T-61-83 (target guards bar a cross-stroke commit), T-61-84 (capture released by the effect and by every new press), T-61-85 (preview cleared compare-then-write at both new sites), T-61-SC (no dependency added — one ref, one effect, three guard clauses).

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1 RED: failing pins for the edit-lifetime drag law** - `bb956d6a5` (test)
2. **Task 1 GREEN: end the previous drag at the start of every press** - `c00ec50ed` (feat)
3. **Task 2 RED: failing source pins for the edit-lifetime cleanup** - `c6f6603a0` (test)
4. **Task 2 GREEN: cancel an edit-lifetime drag on close or retarget** - `38a91ef38` (feat)

**Plan metadata:** see the final `docs(61-28): complete ...` commit on this branch.

_Note: TDD plans produce RED then GREEN commits per task; no REFACTOR commit was needed._

## TDD Gate Compliance

| Task | RED | GREEN | REFACTOR | Status |
|------|-----|-------|----------|--------|
| 1 | `bb956d6a5` | `c00ec50ed` | — | Pass |
| 2 | `c6f6603a0` | `38a91ef38` | — | Pass |

RED evidence (JUnit report, console capture and record) is under
`.planning/phases/61-vector-painting-tool/.red-evidence/61-28-t1/` and `61-28-t2/`;
both records returned `RED_EVIDENCE_OK` from `gsd_run check tdd-red-evidence`.

- Task 1 RED: 69 tests collected, 2 failed — the capture-release assertion (0 calls where the
  law requires 1) and the phantom commit (`onPathEdit` called once after the empty press).
  All 67 shipped tests passed, so the failures are the missing law, not a fixture problem.
- Task 2 RED: 72 collected, 3 failed — all three source pins: `surfaceRef` absent, the
  effect anchor at -1, and a guard count of 0 where the law requires 2. The 69 shipped and
  newly added Task 1 tests all passed.
- Tracer feedback gate: Task 1 is `type="tracer"` with no `gate` attribute, auto mode was
  inactive (`_auto_chain_active` false, `auto_advance` false) and `human_verify_mode` is
  `end-of-phase`; the tracer verify was re-run end-to-end (69/69 after GREEN) and execution
  continued with no checkpoint.
- Every task ran at its floor: overlay 67 → 69 (floor 69) → 72 (floor 72).

## Files Created/Modified

- `app/src/components/physic-paint/engine/VectorPathOverlay.tsx` — `surfaceRef` beside `dragRef`; the `ref={surfaceRef}` root; ONE `editMutationId`-keyed cleanup effect; the start-of-gesture reset in `startEditDrag`; the same target guard as the second statement of `continueEditDrag` and `finishEditDrag`.
- `app/src/components/physic-paint/engine/VectorPathOverlay.test.ts` — the `61-28 CR-01 - the edit-lifetime drag law` group: two behavioural pins and three source pins, with a shared `overlaySurface()` capture stub. No shipped pin touched.
- `.planning/phases/61-vector-painting-tool/.red-evidence/61-28-t1/{console.txt,junit.xml,red-record.json}` and `.red-evidence/61-28-t2/{console.txt,junit.xml,red-record.json}` — the committed RED evidence for both tasks.

## Decisions Made

- **One comparison law for close and retarget.** `editMutationId` is already `string | null`, so `String(drag.mutationId) === editMutationId` covers a closed latch (null) and a retargeted edit without coercing either side.
- **The live-drag early return precedes every clearing step.** An unrelated render of the mounted leaf must never disturb the gesture in progress; the effect only acts when the drag no longer belongs to the open edit.
- **The guard sits before `dragRef.current = null` in `finishEditDrag`.** Placing it earlier keeps the shipped clear-before-commit block byte-identical and guarantees a refused drag cannot reach the promotion or the commit.
- **Guards clean nothing; the effect owns the clearing.** A same-tick stray event is refused without side effects, and the effect is the single cleanup site for both endings.
- **The reset runs before the target check.** The plan's CR-01 fix requires that a press hitting nothing still ends the previous gesture; placing the reset anywhere below the target check would leave the phantom-commit path open.
- **Compare-then-write at both new preview sites.** `.peek() !== null` guards every clear, per the mandatory `efx-preact-reactivity` skill; no signal is written in a render body and the effect stays keyed on a primitive.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Shared-ID requirement gate.** `requirements ready-ids ... VEC-02 VEC-07` reports both `blocked`: 61-29, 61-30 and 61-31 also declare these IDs and have no SUMMARY yet, so `requirements mark-complete` was not called. Both IDs stay open in REQUIREMENTS.md until the sibling plans land; this plan's pins and coverage prove its share.
- **zsh lacks `PIPESTATUS`.** The type-check exit code was captured with `; echo "TSC_EXIT=$?"` instead of a `PIPESTATUS` array; the result is the same (exit 0, zero output lines).
- No product-code problems: every RED run failed only on its planned assertions, every shipped test passed at every stage, and no shipped pin needed repointing.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Automated gates: the overlay suite → **72/72** pass; Studio + overlay → **476/476**
  (404 + 72); `pnpm --filter efx-motion-editor exec tsc --noEmit` → exit 0 (no output).
- **Native UAT rows (user-judged, pending):**
  - **A.** Open Edit path on stroke A, press an anchor and drag halfway, then press Escape without releasing: the edit closes, the anchors vanish, and releasing the pointer outside changes nothing.
  - **B.** Open Edit path on A, start dragging an anchor, then select stroke B in the list while still dragging: A's edit closes and a release over the canvas neither moves A nor commits anything.
  - **C.** Open Edit path on A, drag an anchor part way, press again on empty canvas without releasing, then release: no anchor moves. Then drag normally once: exactly one edit lands, undoable with one Cmd+Z.
- **REQUIREMENTS.md note:** VEC-02 and VEC-07 remain open because the shared-ID gate blocks the flip from this plan alone; the sibling plans that also declare them must land first.
- Out of this plan's scope (unchanged, still deferred): the G-17 replay law (61-29), the path-edit bake copy (61-26) and every paint re-bake concern.

---
*Phase: 61-vector-painting-tool*
*Completed: 2026-11-11*

## Self-Check: PASSED

- `app/src/components/physic-paint/engine/VectorPathOverlay.tsx` — FOUND
- `app/src/components/physic-paint/engine/VectorPathOverlay.test.ts` — FOUND
- RED evidence records 61-28-t1/t2 — FOUND
- Commit `bb956d6a5` — FOUND (ancestor of HEAD)
- Commit `c00ec50ed` — FOUND (ancestor of HEAD)
- Commit `c6f6603a0` — FOUND (ancestor of HEAD)
- Commit `38a91ef38` — FOUND (ancestor of HEAD)
