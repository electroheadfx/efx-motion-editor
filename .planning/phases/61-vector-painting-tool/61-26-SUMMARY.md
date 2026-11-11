---
phase: 61-vector-painting-tool
plan: 26
subsystem: ui
tags: [vector-path, watercolor, script-rebake, selection, stale-sheet, preact-signals, source-pins]

# Dependency graph
requires:
  - phase: 61-vector-painting-tool
    provides: "61-17's wireframe refusal at the `setAquarelleSelectMode` entry choke point — the authority this plan's up-front Shift+A refusal mirrors"
  - phase: 61-vector-painting-tool
    provides: "61-14's revision-authoritative `restoreAquarelleEditSnapshot` and quick 261029-lsr's content-checked `reanchorAquarelleEditFromLiveContent`"
  - phase: 61-vector-painting-tool
    provides: "61-18's `draftPixelsDirty` stale-sheet invariant, cleared only by the ONE `settleDraftScript`"
provides:
  - "`handleToggleSelectAllAquarelleStrokes` refuses up front under the wireframe and re-checks the authoritative Select entry before any selection write"
  - "`commitAquarelleVectorPathEdit`'s failure tail re-anchors the attempted side first, consumes the restore result, and publishes the honest 'could not be rolled back' copy when the rollback fails closed"
  - "`handleAquarelleStrokeEnd` consumes `bakeAquarelleVectorCommit`'s boolean through a continuation and arms `setDraftPixelsDirty(true)` when the bake was refused, publishing nothing"
affects: [61-27, 61-28, 61-29, 61-30, 61-31]

# Actuals (#2632) — same estimateTokens scale (chars/4 over the realized diff)
actuals:
  tokens: 4894
  tasks: 3
  commits: 6

plan_head_before: f60aee0914a656c19ce36fe27a7293adb6868936
plan_head_after: d7540b0a658c6a119fa4f880fbb6897319b2ae20

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A refused entry stays authoritative: the caller re-checks the entry signal after attempting it, so no write depends on the attempt having succeeded"
    - "Re-anchor before an authority-checked restore: the content-checked re-seat turns the routine bumped-revision failure into a successful rollback while a foreign mutation still fails closed"
    - "Consume the boolean, never discard it: a refused bake arms the existing stale-sheet invariant instead of publishing an error"
    - "Guard clauses only: no new field, signal or dependency — all three seams ride existing handlers with unchanged dependency arrays"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "Shift+A refuses up front on `wireframeMode` before ANY read or write, then re-checks `aquarelleSelectMode` after the entry attempt — the entry choke point stays authoritative rather than being duplicated with a divergent gate"
  - "The WR-02 tail re-anchors the ATTEMPTED side with `reanchorAquarelleEditFromLiveContent(editId, 'undo')` BEFORE the revision-authoritative restore: the normal failure (this edit's own side still live) re-seats the revision and the restore succeeds; a foreign mutation still fails closed"
  - "The restore result is consumed (`!== null`) and the fallback copy is a ternary on it, with the apply error kept ahead of it — the capsule can no longer claim a restore the guard refused"
  - "The WR-03 draw site consumes the bake boolean through `.then((baked) => { if (!baked) setDraftPixelsDirty(true); })`: a refused bake arms the ONE stale-sheet invariant and publishes no capsule; `setDraftPixelsDirty` is compare-then-write so repeated false results do not churn"
  - "Four shipped source pins were repointed, never deleted (Rule 3 - Blocking): three restore markers at the consuming form and the stroke-end TAIL at the continuation, each keeping its index-ordering assertions; the TAIL pin was additionally strengthened with the vector-guard-before-tail ordering and the stale-arm assertion"

requirements-completed: [VEC-02, VEC-07]

coverage:
  - id: D1
    description: "Shift+A under the wireframe view writes NO stroke selection — the shortcut returns before any read or write, and a refused Select entry can never leave an orphan selection behind; outside the wireframe the shipped two-way behaviour (enter Move/Edit when needed, select all or clear) is byte-identical and the keyboard dispatch is unchanged."
    requirement: VEC-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-26 WR-01 — Shift+A under the wireframe leaves no orphan selection > refuses up front on the wireframe view, before any read or write"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-26 WR-01 — Shift+A under the wireframe leaves no orphan selection > re-checks the authoritative Select entry before any selection write"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-26 WR-01 — Shift+A under the wireframe leaves no orphan selection > leaves the accepted path byte-identical"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-26 WR-01 — Shift+A under the wireframe leaves no orphan selection > keeps the Shift+A dispatch routed to the shipped action slot"
        status: pass
    human_judgment: false
  - id: D2
    description: "A failed path-edit re-bake re-anchors the attempted side before the authority-checked restore, consumes the restore result, and publishes 'restored' only when the restore actually ran; a rollback that fails closed says so instead of claiming a restore."
    requirement: VEC-07
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-26 WR-02 — a failed path-edit re-bake restores for real or says it could not > re-anchors the attempted side before the authority-checked restore"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-26 WR-02 — a failed path-edit re-bake restores for real or says it could not > consumes the restore result instead of discarding it"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-26 WR-02 — a failed path-edit re-bake restores for real or says it could not > ternaries the fallback copy on the restore result, keeping the apply error ahead of it"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-26 WR-02 — a failed path-edit re-bake restores for real or says it could not > no longer discards the restore as a standalone statement"
        status: pass
    human_judgment: false
  - id: D3
    description: "A vector stroke committed while another script re-bake is in flight consumes the bake's false result and arms the stale-sheet invariant, so the ONE Draft/wireframe settle re-renders it; nothing is published to the capsule and the stroke is still recorded before it bakes."
    requirement: VEC-07
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-26 WR-03 — a vector stroke committed during an in-flight bake marks the sheet stale > consumes the bake result through a continuation instead of discarding it"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-26 WR-03 — a vector stroke committed during an in-flight bake marks the sheet stale > arms the stale-sheet invariant when the bake reports false"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-26 WR-03 — a vector stroke committed during an in-flight bake marks the sheet stale > no longer fires the bake as a discarded statement"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-26 WR-03 — a vector stroke committed during an in-flight bake marks the sheet stale > still records the stroke before it bakes"
        status: pass
    human_judgment: false
  - id: D4
    description: "Native UAT: Shift+A under the wireframe changes nothing and restores the shipped selection behaviour once wireframe is off; a failed path-edit re-bake's capsule matches whether the pre-edit path actually came back; a vector stroke drawn during an in-flight bake reappears at the next settle with no error capsule."
    verification: []
    human_judgment: true
    rationale: "Rows A/B/C are live WKWebView behaviours in the Studio window: whether the rail's Select chip stays dark and no outline appears, whether the capsule's copy matches the canvas geometry, and whether an in-flight-bake stroke reappears at the next settle. vitest renders no DOM and the user runs the app."

duration: 7 min
completed: 2026-11-11
status: complete
---

# Phase 61 Plan 26: the three silent-refusal seams Summary

**Shift+A gains a wireframe refusal with a post-entry re-check, a failed path-edit re-bake re-anchors before its authority-checked restore and reports the real rollback outcome, and a vector stroke committed during an in-flight bake arms the stale-sheet retry instead of vanishing**

## Performance

- **Duration:** 7 min
- **Started:** 2026-11-11T11:20:18Z
- **Completed:** 2026-11-11T11:27:07Z
- **Tasks:** 3
- **Files modified:** 2 (plus per-task RED evidence under `.red-evidence/61-26-t1..t3/`)

## Accomplishments
- `handleToggleSelectAllAquarelleStrokes` (WR-01) returns immediately on `wireframeMode.peek()` — before any read — and after attempting the Select entry re-checks `aquarelleSelectMode.peek()`, so the selection write never depends on an entry that the wireframe choke point refused. The accepted path and the `Shift+A` keyboard dispatch are byte-identical.
- `commitAquarelleVectorPathEdit`'s `onFailure` (WR-02) now calls `reanchorAquarelleEditFromLiveContent(editId, 'undo')` BEFORE the revision-authoritative restore, captures the restore result instead of discarding it, and publishes 'the path edit was restored' vs 'the path edit could not be rolled back' from that real result. The normal bumped-revision failure now rolls back for real; a foreign mutation still fails closed and says so.
- `handleAquarelleStrokeEnd` (WR-03) consumes `bakeAquarelleVectorCommit()`'s boolean through a continuation: a false result (the in-flight branch that calls no callback) arms `setDraftPixelsDirty(true)`, so the ONE `settleDraftScript` re-renders the stroke. No capsule is published and the stroke is still recorded before the bake.
- Twelve new source pins across three `61-26 WR-01/WR-02/WR-03` describe groups; nothing was deleted. Four shipped pins were repointed at the same bodies' new forms (see Deviations), each keeping its ordering assertions — and the stroke-end TAIL pin was strengthened with the vector-guard ordering and the stale-arm assertion.
- No new field, signal or dependency was added: all three seams are guard clauses or continuations inside existing handlers, and every dependency array is unchanged.

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1 RED: failing pins for the wireframe Shift+A refusal** - `940edffbd` (test)
2. **Task 1 GREEN: refuse the Shift+A selection behind a refused Select entry** - `3d40e997f` (feat)
3. **Task 2 RED: failing pins for the honest path-edit failure tail** - `04e53727e` (test)
4. **Task 2 GREEN: publish the real path-edit rollback state** - `9eefd4e81` (feat)
5. **Task 3 RED: failing pins for the in-flight bake stale-sheet retry** - `bee7e9f58` (test)
6. **Task 3 GREEN: arm the stale-sheet retry when a vector bake is refused** - `d7540b0a6` (feat)

**Plan metadata:** see the final `docs(61-26): complete ...` commit on this branch.

_Note: TDD plans produce RED then GREEN commits per task; no REFACTOR commit was needed._

## TDD Gate Compliance

| Task | RED | GREEN | REFACTOR | Status |
|------|-----|-------|----------|--------|
| 1 | `940edffbd` | `3d40e997f` | — | Pass |
| 2 | `04e53727e` | `9eefd4e81` | — | Pass |
| 3 | `bee7e9f58` | `d7540b0a6` | — | Pass |

RED evidence (JUnit report, console capture and record) is under
`.planning/phases/61-vector-painting-tool/.red-evidence/61-26-t1/`, `61-26-t2/` and
`61-26-t3/`; all three records returned `RED_EVIDENCE_OK` from
`gsd_run check tdd-red-evidence`.

- Task 1 RED: 392 tests collected, 2 failed — the up-front wireframe guard and the
  post-entry `aquarelleSelectMode` re-check. The accepted-path and keyboard-dispatch pins
  passed at HEAD by design as no-regression guards; all 388 shipped tests still passed.
- Task 2 RED: 396 collected, 4 failed — all four WR-02 pins (no content-checked re-anchor,
  the restore result discarded, the unconditional `??` fallback, the standalone discard).
  All 392 shipped tests still passed.
- Task 3 RED: 400 collected, 4 failed — all four WR-03 pins (the fire-and-forget discard,
  no stale arm, the discard statement still present, no record-before-bake ordering).
  All 396 shipped tests still passed.
- Each task ran with the plan's floor exactly met: 392 → 396 → 400
  (`PhysicsPaintStudio.test.ts`). Auto mode was inactive, `human_verify_mode` is
  `end-of-phase`, and each task's `<verify>` is automated-only, so the verify was re-run
  end-to-end and execution continued with no checkpoint.

## Files Created/Modified
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — the wireframe early-return and post-entry re-check in `handleToggleSelectAllAquarelleStrokes` (+9 lines); the re-anchor-then-consume failure tail in `commitAquarelleVectorPathEdit` (+12/−2); the boolean-consuming bake continuation in `handleAquarelleStrokeEnd` (+10/−1). Comments record the seam laws.
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — three new describe groups (12 pins) plus four repointed shipped pins. Existing groups and assertions were not weakened or removed.

## Decisions Made
- **Early return plus a post-entry re-check, not one or the other.** The up-front `wireframeMode.peek()` return makes the wireframe case write nothing and read nothing; the post-entry `aquarelleSelectMode.peek()` re-check keeps the entry choke point authoritative for every other refusal (scriptless keys, a race that flips the view). The two guards answer different questions and neither can be dropped.
- **Re-anchor before restore.** `restoreAquarelleEditSnapshot` is revision-authoritative, so it fails closed whenever anything bumped since the edit began — which is exactly the routine failure this tail handles. The re-anchor is content-checked: with this edit's own side still live it re-seats the revision and the restore succeeds; with a foreign mutation it refuses, and the honest could-not-roll-back copy fires.
- **The restore result is data.** Capturing `!== null` and ternary-ing the fallback copy on it is what retires the unconditional `??` claim. The apply error stays first in the precedence chain, so a specific refusal still wins over the fallback sentence.
- **The bake boolean arms the existing invariant.** `draftPixelsDirty` is the ONE stale-sheet signal and `settleDraftScript` the only clearer; a false bake result just arms it. Nothing is published: a stroke silently deferred to the next settle is not an error, and a capsule would be noise.
- **No new state.** All three seams are guard clauses or a continuation in existing handlers; dependency arrays are unchanged, satisfying the plan's no-new-field/signal/dependency prohibition and keeping the reactivity contract intact.
- **Repoint, never delete, shipped pins.** The tasks' mandated source changes rename the exact lines four shipped pins sliced; the pins were repointed at the consuming forms with their ordering assertions preserved (and the TAIL pin strengthened), following the 61-24 Rule 3 precedent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Repointed three shipped restore markers at the consuming form**
- **Found during:** Task 2 GREEN
- **Issue:** Three shipped pins in the `61-10` and `61-20 G-8` groups sliced the Studio source with `commit.indexOf("restoreAquarelleEditSnapshot(editId, 'undo');")`. The plan's mandated consuming form turns that statement into `restoreAquarelleEditSnapshot(editId, 'undo') !== null;`, so the marker no longer existed and the pins failed for the wrong reason.
- **Fix:** Repointed the same three markers at the consuming form, keeping every `toBeGreaterThan` / ordering assertion identical; a short 61-26 comment records why the marker moved. Nothing was deleted or relaxed.
- **Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- **Verification:** Studio suite 396/396 at the Task 2 GREEN run; the three repointed pins still assert restore-before-publish and the one-record-per-route counts.
- **Committed in:** `9eefd4e81` (Task 2 GREEN)

**2. [Rule 3 - Blocking] Repointed the shipped stroke-end TAIL pin at the continuation**
- **Found during:** Task 3 GREEN
- **Issue:** The `61-15` shipped pin asserted the exact line `if (isVectorAquarelleStroke(stroke)) void bakeAquarelleVectorCommit();`. The mandated consuming continuation replaces that line, so the exact-string `split(TAIL).length - 1` expectation failed.
- **Fix:** Repointed `TAIL` at `void bakeAquarelleVectorCommit().then((baked) => {`, keeping the exactly-one count and every ordering assertion (try → record → erase → tail → catch), and added two assertions the old pin could not make: the vector guard precedes the tail, and the continuation contains `if (!baked) setDraftPixelsDirty(true);`. The shipped one-bake-per-file dependency-array pin is unchanged.
- **Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- **Verification:** Studio suite 400/400 at the Task 3 GREEN run.
- **Committed in:** `d7540b0a6` (Task 3 GREEN)

---

**Total deviations:** 2 auto-fixed (2 blocking). Both were repoints with preserved or strengthened assertions; no shipped pin was deleted, disabled or weakened.
**Impact on plan:** Necessary for the plan's own mandated source changes; no scope creep, no behaviour outside the three seams.

## Issues Encountered
- `requirements ready-ids .planning/phases/61-vector-painting-tool/61-26-PLAN.md VEC-02,VEC-07` reports both IDs `blocked` (they are shared with sibling plans that have no SUMMARY yet), so `requirements mark-complete` was skipped this run. The frontmatter still declares both IDs; REQUIREMENTS.md's VEC-07 checkbox stays open until the sibling plans complete.
- No other problems: each RED run failed only on its planned assertions, and every shipped test passed at every stage.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Automated gates: `PhysicsPaintStudio.test.ts` → **400/400** pass (the plan's floor, exactly);
  the two leaf suites that own the seam helpers → **82/82** pass;
  `pnpm --filter efx-motion-editor exec tsc --noEmit` → exit 0;
  full `src/components/physic-paint` run → **250 files / 6319 tests** pass.
- **Native UAT rows (user-judged, pending):**
  - **A.** Turn wireframe on, press Shift+A: nothing highlights, the rail's Select chip stays dark, and no stroke outline appears. Turn wireframe off, press Shift+A: every listed stroke selects as before; press it again: the selection clears.
  - **B.** With Draft on, draw a vector path, then force a re-bake failure (Script re-apply refusal) while editing a path: the capsule reflects whether the pre-edit path came back; the canvas never shows the edited geometry after a capsule that said it could not roll back.
  - **C.** Draw a vector stroke while another stroke's bake is still running: the stroke appears when the next settle runs (leave the frame or finish the edit), and no error capsule is published.
- **REQUIREMENTS.md note:** VEC-02 is already checked; VEC-07 stays open until its sibling plans land because the shared-ID gate blocks the flip from this plan alone.
- Out of this plan's scope (unchanged, still deferred): the path-edit drag lifecycle (61-28), the widened paint re-bake (61-29), the curve-mode switch (61-30/61-31), the overlay conformance (61-25) and width discoverability (61-22).

---
*Phase: 61-vector-painting-tool*
*Completed: 2026-11-11*

## Self-Check: PASSED

- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — FOUND
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — FOUND
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — RED evidence records 61-26-t1/t2/t3 FOUND
- Commit `940edffbd` — FOUND (ancestor of HEAD)
- Commit `3d40e997f` — FOUND (ancestor of HEAD)
- Commit `04e53727e` — FOUND (ancestor of HEAD)
- Commit `9eefd4e81` — FOUND (ancestor of HEAD)
- Commit `bee7e9f58` — FOUND (ancestor of HEAD)
- Commit `d7540b0a6` — FOUND (ancestor of HEAD)
