---
phase: 61-vector-painting-tool
plan: 29
subsystem: ui
tags: [vector-path, path-edit, g17, replay-geometry, spine-sampling, tdd, gap-closure]

# Dependency graph
requires:
  - phase: 61-vector-painting-tool
    provides: "61-10's path write law (`updateAquarellePathInScript`, same-index reprojection, T-61-34) and the 61-10 test group this plan extends"
  - phase: 61-vector-painting-tool
    provides: "61-02's `sampleVectorPath` spine sampler and `projectVectorPath`, plus 61-09's `buildVectorStroke` six-field point stamp (the shape authority)"
  - phase: 61-vector-painting-tool
    provides: "61-15/61-20/61-26's commit -> `runAquarelleScriptRebake` -> `applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame))` seam and its Draft/wireframe defer route"
provides:
  - "`updateAquarellePathInScript` re-derives `points` from the anchors it stores through `sampleVectorPath`, stamped p 1 / tx 0 / ty 0 / tw 0 in both renderMode branches"
  - "A written G-17 diagnosis: probe 1 is the only broken layer; the rebake/apply, the defer route and the three early returns are ruled out as independent causes"
  - "Three new pins in the `61-29 G-17` group (replay via getAquarelleEventsForFrame, undo/redo through beginAquarellePathEdit, anchors-only write) and the one retargeted overlay points assertion"
affects: [61-30, 61-31]

# Actuals (#2632) — same estimateTokens scale (chars/4 over the realized diff)
actuals:
  tokens: 3903
  tasks: 3
  commits: 5

plan_head_before: 397b0c748c26b0d1989511b0a5aa70ed26624e01
plan_head_after: 91b3d569fab74cfa96862ae18f50e548aa36312f

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A path write re-derives the derived geometry it owns: sample the persisted anchors through the ONE spine authority and stamp the commit's exact six-field shape, so the record can never hold a spine that disagrees with its path"
    - "Diagnose the seam in writing before changing it: four ordered probes with runtime observations, one broken layer named, each downstream consumer characterised as propagation or ruled out"
    - "Regression pins after the live fix: replay through the real bake input, undo/redo through the real selection wrapper, and an anchors-only write that proves the change test reads anchors, never points"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts
    - app/src/components/physic-paint/engine/VectorPathOverlay.test.ts

key-decisions:
  - "The write samples the PROJECTED anchors (`projectVectorPath(normaliseAquarelleAnchors(anchors))`) — the same list it persists — so the stored spine can never disagree with the stored path"
  - "The sampling sits AFTER the idempotency return, so an unchanged anchor list still samples nothing, stores nothing and bumps nothing (REL-02 / D-10)"
  - "The stamp mirrors `buildVectorStroke` exactly (p 1, tx 0, ty 0, tw 0); `toStudioStroke` rebuilds each `tick` from the new points, so the entry's two halves agree"
  - "Task 3's pins landed after the GREEN fix: they are regression pins for a live bug, not a second RED, and the plan-level RED gate was already satisfied by the two failing-pin commits"
  - "The overlay assertion is RETARGETED, not deleted: params, same index, engine anchors and the single bump keep their exact assertions while the points expectation becomes the sampled law"

requirements-completed: [VEC-02, VEC-07]

coverage:
  - id: D1
    description: "A committed path edit reaches the rendered paint: the recorded stroke's `points`, the payload entry's `pts`, and therefore every replay of the frame carry the NEW geometry (G-17)."
    requirement: VEC-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts#61-29 G-17 — the path write carries the replay geometry > re-samples the recorded points from the new anchors so every replay paints the new curve"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts#61-29 G-17 — the path write carries the replay geometry > keeps the payload entry’s pts and engine.anchors on the same path"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#VectorPathOverlay — the path-edit seam (task 1) > replaces the recorded path at the same timeline index, bumps once, and repeats at zero"
        status: pass
    human_judgment: false
  - id: D2
    description: "The path write re-derives the sampled spine from the persisted anchors, and its point count follows the anchor geometry; the sample shape is identical to buildVectorStroke's (p 1, tx 0, ty 0, tw 0)."
    requirement: VEC-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts#61-29 G-17 — the path write carries the replay geometry > re-derives the point count from the anchor geometry on every path write"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts#61-29 G-17 — the path write carries the replay geometry > stamps every re-derived sample with the buildVectorStroke point shape"
        status: pass
    human_judgment: false
  - id: D3
    description: "Undo restores the pre-edit anchors AND the pre-edit points in one step, redo restores the re-sampled pair, every replay reads the new spine through getAquarelleEventsForFrame, and an anchors-only change (identical spine) is still a write."
    requirement: VEC-07
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts#61-29 G-17 — the path write carries the replay geometry > feeds the new spine to every replay through getAquarelleEventsForFrame"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts#61-29 G-17 — the path write carries the replay geometry > restores the pre-edit spine on undo and the re-sampled spine on redo in ONE step"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts#61-29 G-17 — the path write carries the replay geometry > treats an anchors-only change as a write even when the sampled spine is identical"
        status: pass
      - kind: integration
        ref: "pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarelleRecordState.path.test.ts src/components/physic-paint/view/aquarelleRecordState.test.ts src/components/physic-paint/view/aquarelleRecordState.anchor.test.ts src/components/physic-paint/engine/VectorPathOverlay.test.ts -> 91 passed (12 + 4 + 3 + 72)"
        status: pass
      - kind: integration
        ref: "pnpm --filter @efxlab/efx-watercolor exec vitest run src/payload/toStudioStroke.test.ts src/vector/spine.test.ts -> 51 passed (18 + 33)"
        status: pass
      - kind: integration
        ref: "pnpm --filter efx-motion-editor exec tsc --noEmit -> exit 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "Native UAT: the painted wash follows the edited curve after the ordinary bake, after a Draft settle, and after a forced Shift+R replay; one undo returns the paint to the pre-edit curve and one redo brings it back."
    verification: []
    human_judgment: true
    rationale: "Rows A-D are live WKWebView render outcomes in the Studio window: whether the deposited wash visibly follows the new curve, whether the Draft settle and a forced replay agree with the ordinary bake, and whether one undo/redo step flips the paint. The harness proves the recorded geometry and the replay input, not the rendered sheet."

duration: 7 min
completed: 2026-11-11
status: complete
---

# Phase 61 Plan 29: the path edit reaches the paint Summary

**A committed path edit now re-derives the sampled spine from the anchors it stores, so the payload's `pts`, every bake, every Draft settle and any forced Shift+R replay paint the new curve — and one undo restores the old spine with the old anchors**

## Performance

- **Duration:** 7 min
- **Started:** 2026-11-11T12:00:31Z
- **Completed:** 2026-11-11T12:07:32Z
- **Tasks:** 3
- **Files modified:** 3 (plus committed RED evidence under `.red-evidence/61-29-t1/` and `61-29-t2/`)

## Confirmed G-17 cause (investigation order walked before any edit)

The four ordered probes were walked IN ORDER and recorded in
`.planning/phases/61-vector-painting-tool/.red-evidence/61-29-t1/g17-diagnosis.md`,
with the raw runtime observations preserved in `probe.txt`:

1. **`updateAquarellePathInScript` — BROKEN.** After a write to moved anchors the
   stored `anchors` changed (`anchors[1].y = 0.62`) while the stored `points`
   stayed byte-identical to the pre-edit spine (302 stations, y = 0.5 instead of
   the sampled 304 stations with y = 0.6). The `{ ...stroke }` spread carried the
   old points.
2. **Commit -> rebake -> apply — PROPAGATION, not a cause.** The
   `getAquarelleEventsForFrame(601)` entry showed `engine.anchors` already moved
   (`0.62`) while its `pts` kept the old coordinates (`pts[0].y = 0.5`). The apply
   faithfully projects whatever the record holds: `toStudioStroke` maps
   `s.points` into `pts`.
3. **Defer route — PROPAGATION, not a cause.** The Draft/wireframe branch
   (`PhysicsPaintStudio.tsx:10177-10183`) records the edit and returns; the later
   `settleDraftScript` replays `getAquarelleEventsForFrame(playFrame)`
   (`:5451`) — the same stale entries. It owns no separate geometry source, and
   61-18 refuses a wireframe settle outright.
4. **The three early returns — RULED OUT.** `beginAquarellePathEdit` returned a
   non-null edit id with one revision bump and the second edit landed
   (`anchors[1].y = 0.64`), so the guards in `commitAquarelleVectorPathEdit`
   (`:10161-10163`) did not fire; a guard refusal would have left no undo entry
   at all.

The fix therefore belongs to probe 1, and the shipped assertion that encoded the
bug (`expect(strokeAfter.points).toEqual(editedStroke().points)`) was retargeted,
not deleted.

## Accomplishments

- **Task 1 — the proof and the written diagnosis.** A throwaway runtime probe
  observed probes 1, 2 and 4 (deep-linked in `probe.txt`, deleted before the RED
  commit); probe 3 was evidenced from the shipped Studio code paths. Two pins were
  added: the stored points must equal the spine sampled from the NEW anchors, and
  the payload entry's `pts` must agree with its `engine.anchors`. Both failed on
  HEAD exactly at the points coordinate (0.5 vs 0.6) while the anchors/revision
  assertions passed.
- **Task 2 — the fix.** `updateAquarellePathInScript` now derives
  `const { points: sampledSpine } = sampleVectorPath(nextAnchors)` after the
  idempotency return, maps it to `{ x, y, p: 1, tx: 0, ty: 0, tw: 0 }` and carries
  `points: nextPoints` in BOTH `nextStroke` branches. The doc block now states the
  re-derivation law instead of claiming points survive. Two pins prove the count
  follows the geometry (2 -> 451 on a widened path) and that every re-derived
  sample carries the commit shape (old p 0.25 becomes 1).
- **Task 3 — every consumer agrees.** The replay pin reads the real bake input
  (`getAquarelleEventsForFrame(601)`) and requires `pts` to equal the re-sampled
  spine exactly; the undo/redo pin takes one real `beginAquarellePathEdit`
  gesture and requires undo to restore the OLD points array and redo the new
  spine; the anchors-only pin changes a width factor, proving the change test
  reads anchors, never points. The overlay points assertion was retargeted to the
  sampled law while params/index/engine-anchors/single-bump stayed untouched.
- **Threat-mitigated as planned:** T-61-86 (the write re-derives `points`, so the
  record cannot hold a spine disagreeing with its path), T-61-87 (the diagnosis
  names the seam in writing and the replay pin asserts the replay input), T-61-SC
  (no dependency added — one derived local and one spread field).

## Task Commits

Each task was committed atomically (TDD RED then GREEN per the tdd contract):

1. **Task 1 RED: prove the path write leaves the stale replay spine** - `ba6267c25` (test)
2. **Task 2 RED: pin the re-derived count and the stamped point shape** - `c557b22ad` (test)
3. **Task 2 GREEN: re-derive the replay spine on every path write** - `1ab0c5e62` (feat)
4. **Task 3: pin replay, undo/redo and the anchors-only write** - `624020ed8` (test)
5. **Task 3 fix: use the real simple-ribbon render mode in the G-17 fixture** - `91b3d569f` (test)

**Plan metadata:** see the final `docs(61-29): complete ...` commit on this branch.

_Note: Task 3 is test-only (no production change), so it lands as one `test` commit; no REFACTOR commit was needed._

## TDD Gate Compliance

| Task | RED | GREEN | REFACTOR | Status |
|------|-----|-------|----------|--------|
| 1 | `ba6267c25` | n/a (tracer proof; production fix is Task 2) | — | Pass |
| 2 | `c557b22ad` | `1ab0c5e62` | — | Pass |
| 3 | n/a (test-only regression pins after the fix) | — | — | Pass |

RED evidence (JUnit report, console capture and record) is under
`.planning/phases/61-vector-painting-tool/.red-evidence/61-29-t1/` and `61-29-t2/`;
both records returned `RED_EVIDENCE_OK` from `gsd_run check tdd-red-evidence`.

- Task 1 RED: 7 collected, 2 failed — both at the points coordinate assertion
  (0.5 where the re-sampled spine requires 0.6). The 5 shipped 61-10 tests passed.
- Task 2 RED: 9 collected, 4 failed — Task 1's two pins plus the count pin (2 vs
  451) and the shape pin (0.25 vs 1); the 5 shipped tests stayed green.
- Tracer feedback gate: Task 1 is `type="tracer"` with no `gate` attribute; auto
  mode was inactive and `human_verify_mode` is `end-of-phase`, so the verify was
  re-run end-to-end (still 2 failed / 5 passed, i.e. the RED slice intact) and
  execution continued with no checkpoint.
- Every task ran at its floor: path suite 5 -> 7 -> 9 -> 12; overlay suite stays 72.

## Files Created/Modified

- `app/src/components/physic-paint/view/aquarelleRecordState.ts` — `sampleVectorPath` import; the derived `nextPoints` stamp after the idempotency return; `points: nextPoints` in both `nextStroke` branches; the doc block rewritten to the re-derivation law.
- `app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts` — the `61-29 G-17` group: five pins (stored spine, entry halves, count, shape, replay, undo/redo, anchors-only) built on `G17_PRE_ANCHORS` / `G17_NEXT_ANCHORS` / `G17_WIDE_ANCHORS`, all expected values sampled through `sampleVectorPath`. No shipped assertion was weakened or moved.
- `app/src/components/physic-paint/engine/VectorPathOverlay.test.ts` — the ONE retargeted assertion: the points expectation is now the spine sampled from `nextAnchors` in the six-field shape, with params/index/engine-anchors/single-bump kept and the pre-edit-points inequality added.
- `.planning/phases/61-vector-painting-tool/.red-evidence/61-29-t{1,2}/{g17-diagnosis.md,probe.txt,red.txt,console.txt,junit.xml,red-record.json,run-start.txt}` — the committed diagnosis and RED evidence for both tasks.

## Decisions Made

- **Sample the projected anchors.** The spine is derived from `projectVectorPath(normaliseAquarelleAnchors(anchors))` — exactly the list persisted — so the record can never hold a spine that disagrees with its stored path.
- **Sampling after the idempotency return.** An unchanged path still samples nothing, stores nothing and bumps nothing; the no-op path stays free.
- **The stamp is the commit's shape.** p 1 / tx 0 / ty 0 / tw 0 mirror `buildVectorStroke`, and `toStudioStroke` rebuilds each `tick` from the new points, so a replayed edit is indistinguishable from a fresh draw.
- **The retarget keeps the shipped assertions.** Only the points expectation changed; same index, engine anchors, params and the single bump stay exact.
- **Regression pins after the fix.** Task 3 adds no production code, so its pins land as one `test` commit rather than a second RED; the plan-level RED gate was already satisfied twice.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed an invalid render mode in the G-17 fixture**
- **Found during:** Task 3 final verification (`tsc --noEmit` failed)
- **Issue:** `g17VectorStroke` set `renderMode: 'vector'`, which is not an `AquarelleRenderMode` (`'watercolor' | 'simple-ribbon'`). Vitest strips types so the suites passed, but the type check failed.
- **Fix:** Use `'simple-ribbon'`, the vector-family render mode.
- **Files modified:** `app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts`
- **Commit:** `91b3d569f`

## Issues Encountered

- **Evidence is tracked despite the plan's table.** The artifacts table said the phase-dir evidence is "not tracked", but this phase's established convention (61-07 through 61-28) commits the `.red-evidence` records; both 61-29 task directories were committed with their RED commits.
- **Throwaway probe.** A temporary probe test obtained the runtime observations for probes 1, 2 and 4 and was deleted before the RED commit; its raw output is preserved as `.red-evidence/61-29-t1/probe.txt` and summarised in `g17-diagnosis.md`.
- **Working-tree hygiene.** The pre-existing unstaged `packages/efx-watercolor/probe/vector-spine/result.json` and the older untracked `.red-evidence` directories (61-03 through 61-25) were deliberately left untouched; only 61-29 files were staged.
- No product-code problems: every RED run failed only on its planned assertions, every shipped test passed at every stage, and no shipped assertion other than the one retarget was edited.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Automated gates: the four-file suite -> **91/91** (12 + 4 + 3 + 72); watercolor
  package -> **51/51** (18 + 33); `pnpm --filter efx-motion-editor exec tsc --noEmit`
  -> exit 0.
- **Native UAT rows (user-judged, pending — this is the reported surface):**
  - **A.** Draw one vector stroke, open Edit path, drag its middle anchor well away, release, and wait for the bake: the painted wash follows the NEW curve without any refresh.
  - **B.** With Draft on: make the same edit (the canvas keeps the old pixels, by design), turn Draft off: the recomputed paint follows the NEW curve.
  - **C.** Make the same edit, then force a replay with Shift+R: the result matches A — no revert to the pre-edit geometry.
  - **D.** Undo once: the paint returns to the pre-edit curve in one step; redo once: it returns to the edited curve.
- **REQUIREMENTS.md:** VEC-02 was already complete; VEC-07 is now marked complete by this plan.
- Out of this gap-closure scope (unchanged, still deferred): painted-stroke curve editing (Phase 62), closed/filled paths, and the multi-curve menu.

---
*Phase: 61-vector-painting-tool*
*Completed: 2026-11-11*

## Self-Check: PASSED

- `app/src/components/physic-paint/view/aquarelleRecordState.ts` — FOUND
- `app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts` — FOUND
- `app/src/components/physic-paint/engine/VectorPathOverlay.test.ts` — FOUND
- `.red-evidence/61-29-t1/{g17-diagnosis.md,probe.txt,red-record.json}` — FOUND
- `.red-evidence/61-29-t2/{red.txt,red-record.json}` — FOUND
- Commit `ba6267c25` — FOUND (ancestor of HEAD)
- Commit `c557b22ad` — FOUND (ancestor of HEAD)
- Commit `1ab0c5e62` — FOUND (ancestor of HEAD)
- Commit `624020ed8` — FOUND (ancestor of HEAD)
- Commit `91b3d569f` — FOUND (ancestor of HEAD)
