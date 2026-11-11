---
phase: 61-vector-painting-tool
plan: 27
subsystem: ui
tags: [vector-path, path-edit-session, watercolor, preact-signals, status-capsule, source-pins]

# Dependency graph
requires:
  - phase: 61-vector-painting-tool
    provides: "61-11's render-body `pathEditExitRequested` marker consumed by the ONE lifecycle effect, and `resolvePathEditGate` kept deliberately target-blind"
  - phase: 61-vector-painting-tool
    provides: "261101-o2m's ONE `settleDraftScript` recompute whose wireframe branch already publishes `WIREFRAME_SETTLE_REFUSED_MESSAGE`"
  - phase: 61-vector-painting-tool
    provides: "61-11/61-19's Anchor width block and `applyAnchorWidths` boolean contract, plus the shipped `armDraft` bundle-result precedent"
provides:
  - "`shouldExitPathEdit` is target-aware: an open edit exits when the selection is null or names a different stroke, compared as string forms"
  - "The dialog's lifecycle effect gains `pathEditTargetMismatch` as a dependency, so the marker reaches the ONE performer on a selection change"
  - "`DRAFT_SETTLE_BUSY_MESSAGE` and the busy settle branch publishing through all three capsule writers"
  - "`ANCHOR_WIDTH_COMMIT_REFUSED_MESSAGE`, `StrokeSettingsDialogBundle.publishRefusal?`, and the Studio's unowned capsule wiring"
affects: [61-28, 61-29, 61-30, 61-31]

# Actuals (#2632) — same estimateTokens scale (chars/4 over the realized diff)
actuals:
  tokens: 7776
  tasks: 3
  commits: 6

plan_head_before: e99e36273e74e56c5f42affeeee6ea5a21a48da0
plan_head_after: e2c9c02b29f322e5548c80a70145b989f40f10d7

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Target-aware exit, target-blind gate: `resolvePathEditGate.enabled` still answers 'may the button be pressed'; only the EXIT predicate compares the open edit with the selection"
    - "A render-body marker only reaches its effect through a dependency — the mismatch boolean is the dependency that makes selection-driven exits fire"
    - "Every refusing exit publishes through the shared capsule before resolving false; no refusal owns another surface's message"
    - "Consume a commit boolean through a continuation, publish only on exact false, and leave the controlled stepper authoritative on refusal"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/strokeSettingsModel.ts
    - app/src/components/physic-paint/view/strokeSettingsModel.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
    - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts
    - app/src/components/physic-paint/view/scriptStrokeEdition.ts
    - app/src/components/physic-paint/view/scriptStrokeEdition.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "`shouldExitPathEdit` compares `pathEditMutationId !== String(selectedMutationId)` — the same string forms `resolvePathEditGate.pressed` uses — rather than coercing either id"
  - "The effect dependency is the render-body `pathEditTargetMismatch` boolean, not a signal read: the effect body stays marker-driven and no signal write enters a render body"
  - "`resolvePathEditGate` was left byte-identical: target awareness on the gate would permanently disable the Edit path button when no edit is open"
  - "The busy settle branch publishes through `setApplyMessage`/`setApplyStatus('error')`/`setLastError` but never claims `scriptApplyRefusalOwnedRef` — the width and settle refusals own no sheet state and must not swallow another surface's message"
  - "`publishRefusal` is optional on the bundle, so an absent Studio port keeps the shipped silent fallback and the dialog stays engine-free"
  - "Three shipped pins were repointed, never deleted (Rule 3 - Blocking): the 61-13 Studio import marker and two dialog commit-call literals, every other assertion preserved"

requirements-completed: [VEC-02, VEC-03, VEC-07]

coverage:
  - id: D1
    description: "Selecting another stroke while a path edit is open exits that edit through the shipped lifecycle effect; the edit can never stay anchored to a stroke the sheet no longer shows, and the gate remains pressable for a single vector stroke with no edit open."
    requirement: VEC-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#61-11 path-edit gate (Edit path header button) > exits when the selection names a different stroke than the open edit"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#61-11 path-edit gate (Edit path header button) > keeps an open edit on a selection that still names its stroke"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts#61-27 WR-04 — selecting another stroke closes the open path edit > computes the target-mismatch marker in the render body, never a session write"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts#61-27 WR-04 — selecting another stroke closes the open path edit > passes both ids to the target-aware exit predicate"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts#61-27 WR-04 — selecting another stroke closes the open path edit > rides the shipped lifecycle effect through the mismatch dependency"
        status: pass
    human_judgment: false
  - id: D2
    description: "A settle refused because another mutation holds the gates publishes one bounded line through the shared status capsule and still resolves false; the wireframe reason keeps precedence, and the track switch's fail-closed abort now has a visible reason."
    requirement: VEC-07
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/scriptStrokeEdition.test.ts#61-27 IN-02 — the busy settle refusal copy > ships the busy refusal as one fixed, non-interpolated string"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-27 IN-02 — a settle refused by a running mutation says so > publishes the busy refusal through the capsule before resolving false"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-27 IN-02 — a settle refused by a running mutation says so > keeps the track switch failing closed on the now-visible refusal"
        status: pass
    human_judgment: false
  - id: D3
    description: "A refused Anchor width commit consumes its boolean and publishes one bounded refusal through the shared capsule with error status; a successful commit publishes nothing, an absent port stays silent, and the controlled stepper snaps back to the document reading."
    requirement: VEC-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#61-27 IN-03 — the refused Anchor width commit copy > ships the refusal as one fixed, non-interpolated string plus one optional port"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts#61-27 IN-03 — a refused Anchor width commit publishes its refusal > consumes the commit result and publishes only on an exact false"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts#61-27 IN-03 — a refused Anchor width commit publishes its refusal > stays silent when the port is absent, and the empty caption and readout are untouched"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-27 IN-03 — the dialog bundle supplies publishRefusal > writes the message, the error status and the last error through the shared capsule"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-27 IN-03 — the dialog bundle supplies publishRefusal > leaves the refusal unowned and the width commit contract untouched"
        status: pass
    human_judgment: false
  - id: D4
    description: "Native UAT: selecting another stroke closes the open path edit and Edit path reopens on the new stroke; a gate-refused track switch says another edit is settling and completes once the apply ends; a refused Anchor width commit returns the knob and explains why in the capsule."
    verification: []
    human_judgment: true
    rationale: "Rows A/B/C are live WKWebView behaviours in the Studio window: whether the overlay's anchors disappear on a list click, whether the capsule's busy line appears during a real Apply, and whether the knob snap-back is accompanied by the refusal copy. vitest renders no DOM and the user runs the app."

duration: 7 min
completed: 2026-11-11
status: complete
---

# Phase 61 Plan 27: the three silent-refusal seams Summary

**A path edit now closes when its stroke leaves the selection, a gate-refused settle and a refused Anchor width commit each publish one bounded line through the shared capsule**

## Performance

- **Duration:** 7 min
- **Started:** 2026-11-11T11:43:21Z
- **Completed:** 2026-11-11T11:50:17Z
- **Tasks:** 3
- **Files modified:** 8 (plus per-task RED evidence under `.red-evidence/61-27-t1..t3/`)

## Accomplishments
- `shouldExitPathEdit` (WR-04) gained `selectedMutationId`/`pathEditMutationId` and now exits when the gate is closed OR the selection is null OR its string form differs from the open edit's id. `resolvePathEditGate` stays byte-identical — the gate answers "may the button be pressed", the exit answers "is the edit still valid".
- The dialog computes `pathEditTargetMismatch` beside the existing `pathEditActive` marker, passes all four arguments, and adds the mismatch to the shipped lifecycle effect's dependency array (`[open, bundle, pathEditGateEnabled, pathEditTargetMismatch]`). That dependency is the missing link of the WR-04 mechanism: without it, a selection change between two single vector strokes never re-ran the ONE performer. `useEffect(` count stays 2 and no signal is written in a render body.
- `DRAFT_SETTLE_BUSY_MESSAGE` (IN-02) ships beside the wireframe refusal, and `settleDraftScript`'s combined busy gate now publishes it through `setApplyMessage`, `setApplyStatus('error')` and `setLastError` before resolving false. The wireframe branch keeps precedence, the branch never rejects, and the track-switch comment now states the true law: every false exit has published its reason.
- `ANCHOR_WIDTH_COMMIT_REFUSED_MESSAGE` and the optional `StrokeSettingsDialogBundle.publishRefusal` (IN-03) let the Anchor width `onChange` consume the commit result and publish only on exact false. The Studio supplies the port through the shared capsule without claiming `scriptApplyRefusalOwnedRef`; the stepper's controlled `value` snaps back on its own, so the refusal is explained rather than silent.
- Ten new source pins across three `61-27` groups plus two new model cases in the shipped path-edit gate group; nothing was deleted. Three shipped pins were repointed at their files' new forms (see Deviations), each keeping its behavioral assertions.
- Threat-mitigated as planned: T-61-80 (busy settle line published before false), T-61-81 (commit boolean consumed, false published), T-61-82 (mismatch predicate + effect dependency), T-61-SC (no dependency added).

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1 RED: failing pins for a target-aware path-edit exit** - `ceeadbb21` (test)
2. **Task 1 GREEN: close the open path edit when the selection leaves its stroke** - `2ba169023` (feat)
3. **Task 2 RED: failing pins for a busy-settle refusal that says so** - `9b5dca592` (test)
4. **Task 2 GREEN: publish a bounded line when the gates refuse the settle** - `67fcb703d` (feat)
5. **Task 3 RED: failing pins for the refused Anchor width commit copy** - `444279506` (test)
6. **Task 3 GREEN: publish a refused Anchor width commit instead of discarding it** - `e2c9c02b2` (feat)

**Plan metadata:** see the final `docs(61-27): complete ...` commit on this branch.

_Note: TDD plans produce RED then GREEN commits per task; no REFACTOR commit was needed._

## TDD Gate Compliance

| Task | RED | GREEN | REFACTOR | Status |
|------|-----|-------|----------|--------|
| 1 | `ceeadbb21` | `2ba169023` | — | Pass |
| 2 | `9b5dca592` | `67fcb703d` | — | Pass |
| 3 | `444279506` | `e2c9c02b2` | — | Pass |

RED evidence (JUnit report, console capture and record) is under
`.planning/phases/61-vector-painting-tool/.red-evidence/61-27-t1/`, `61-27-t2/` and
`61-27-t3/`; all three records returned `RED_EVIDENCE_OK` from
`gsd_run check tdd-red-evidence`.

- Task 1 RED: 219 tests collected, 4 failed — the target-aware model case and all three
  dialog marker/dependency pins. The companion "keeps an open edit on a selection that
  still names its stroke" passed at HEAD by design as a no-regression guard; all 215
  shipped tests still passed.
- Task 2 RED: 433 collected, 3 failed — the busy publish block, the track-switch comment
  law and the `DRAFT_SETTLE_BUSY_MESSAGE` copy pin. All 430 shipped tests still passed.
- Task 3 RED: 626 collected, 5 failed — all five IN-03 pins (the result continuation, the
  optional-port silence, the bundle writer block, the unowned assertion and the constant
  pin). All 621 shipped tests still passed. The missing constant resolved to `undefined`
  through Vite's ESM interop rather than failing at import; the record documents the
  assertion failure as legitimate.
- Tracer feedback gate: Task 1 is `type="tracer"` with no `gate` attribute, auto mode was
  inactive and `human_verify_mode` is `end-of-phase`; the tracer verify was re-run
  end-to-end (219/219) and execution continued with no checkpoint.
- Every task ran above its floor: model 176 → 177 (floor 176/177), dialog 43 → 45
  (floor 40/42), scriptStrokeEdition 31 (floor 31), Studio 402 → 404 (floor 402/404).

## Files Created/Modified
- `app/src/components/physic-paint/view/strokeSettingsModel.ts` — `PathEditExitArgs` gained the two ids; `shouldExitPathEdit` is target-aware; `ANCHOR_WIDTH_COMMIT_REFUSED_MESSAGE` sits beside `ANCHOR_WIDTH_NO_EDIT_REASON`; `StrokeSettingsDialogBundle` gained `publishRefusal?`.
- `app/src/components/physic-paint/view/strokeSettingsModel.test.ts` — the three shipped `shouldExitPathEdit` calls gained the new arguments; two new cases in the path-edit gate group; one `61-27 IN-03` copy/port pin.
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` — `pathEditTargetMismatch` render-body marker, the four-argument predicate call and the new effect dependency; the Anchor width `onChange` continuation publishing on exact false.
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts` — the lifecycle end-marker repointed; `61-27 WR-04` (3 pins) and `61-27 IN-03` (2 pins) groups; two shipped commit-call pins repointed.
- `app/src/components/physic-paint/view/scriptStrokeEdition.ts` — `DRAFT_SETTLE_BUSY_MESSAGE` with the one-bounded-terminal-state contract.
- `app/src/components/physic-paint/view/scriptStrokeEdition.test.ts` — the `61-27 IN-02` copy pin.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — the busy settle branch publishes the line; the dialog bundle supplies `publishRefusal`; the track-switch comment states the true law.
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — `61-27 IN-02` (2 pins) and `61-27 IN-03` (2 pins) groups; the shipped 61-13 import start marker repointed.

## Decisions Made
- **Compare string forms, exactly like the gate.** `pathEditMutationId` is a string and `selectedMutationId` a number; `!== String(selectedMutationId)` keeps one comparison law instead of coercing in two places.
- **The dependency is the boolean, not the ids.** Adding the ids (or a signal read) to the effect would make the effect body signal-driven; the plain render-body marker preserves the 61-11 marker law and keeps `useEffect(` at 2.
- **Keep the gate target-blind.** Making `resolvePathEditGate.enabled` target-aware would permanently disable the Edit path button when no edit is open — the prohibition the plan called out.
- **The refusal owns no sheet state.** Both the settle and the width refusals publish through the three capsule writers but never set `scriptApplyRefusalOwnedRef`; claiming ownership would swallow another surface's message.
- **Optional port, silent fallback.** `publishRefusal?` is optional so the shipped no-port behaviour (snap back, no words) is retained for any caller that has no capsule; the dialog imports no Studio state.
- **Repoint, never delete, shipped pins.** The three shipped pins broken by the mandated source changes were repointed at the consuming forms with their ordering/behavior assertions preserved (61-26 precedent).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Repointed the shipped 61-13 Studio import pin**
- **Found during:** Task 2 GREEN
- **Issue:** The shipped 61-13 pin sliced the Studio source starting at `import {\n  deleteSelectedScriptStroke,`. The plan mandates adding `DRAFT_SETTLE_BUSY_MESSAGE,` as the first member of that import block, so the start marker no longer existed and the pin failed for the wrong reason.
- **Fix:** Repointed the start marker to `import {\n  DRAFT_SETTLE_BUSY_MESSAGE,\n  deleteSelectedScriptStroke,`, keeping every symbol assertion and adding a 61-27 comment; nothing was deleted or relaxed.
- **Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- **Verification:** Studio suite 402/402 at the Task 2 GREEN run; the 31-test scriptStrokeEdition suite also passed.
- **Committed in:** `67fcb703d` (Task 2 GREEN)

**2. [Rule 3 - Blocking] Repointed two shipped dialog commit-call pins**
- **Found during:** Task 3 GREEN
- **Issue:** The `61-19 live` pin and the `61-22 G-11` "keeps every shipped E4 identifier" pin both asserted the exact literal `void bundle.applyAnchorWidths?.(`. The plan mandates wrapping that call in `Promise.resolve(...).then(...)`, so both pins failed on the mandated change rather than on a regression.
- **Fix:** Repointed both to `void Promise.resolve(bundle.applyAnchorWidths?.(` with a 61-27 comment; `anchorWidthPatchValue(value)`, the no-local-writer assertion and every other E4 identifier assertion are unchanged. Nothing was deleted or weakened.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts`
- **Verification:** Dialog suite 45/45 at the Task 3 GREEN run; the full four-suite plan verify passed 657/657.
- **Committed in:** `e2c9c02b2` (Task 3 GREEN)

---

**Total deviations:** 2 auto-fixed (2 blocking). Both were repoints required by the plan's own mandated source changes; no shipped pin was deleted, disabled or weakened.
**Impact on plan:** The plan enumerated three retargeted shipped assertions (dialog end marker + three model calls); the Studio import marker and two dialog commit-call literals were additional. No behavior outside the three seams changed.

## Issues Encountered
- **Plan test-count arithmetic drift (dialog suite).** The plan's floors assumed a 37-test dialog baseline (37 + 3 = 40, then 40 + 2 = 42); the measured baseline was 40, so the dialog suite finished at 43 after Task 1 and 45 after Task 3. All floors are minimums and were exceeded; no pin was added or removed to fit the stated numbers. Model (174 → 176 → 177) and Studio (400 → 402 → 404) matched the plan exactly; scriptStrokeEdition matched at 31.
- **RED constant import resolves to `undefined`.** In Task 3's model test the missing `ANCHOR_WIDTH_COMMIT_REFUSED_MESSAGE` named import failed as an assertion (`expected undefined to be ...`) rather than an import error under Vite's ESM interop, so the RED run still failed on the planned assertion — documented in the RED record's semantic assessment and accepted by `gsd_run check tdd-red-evidence`.
- `requirements ready-ids` reports VEC-02 and VEC-07 `blocked` (shared with sibling plans that have no SUMMARY yet); `requirements mark-complete VEC-03` answered `already_complete` (VEC-02/VEC-03 are already checked in REQUIREMENTS.md), so only VEC-07 waits for its sibling plans.
- No other problems: each RED run failed only on its planned assertions, and every shipped test passed at every stage.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Automated gates: the four plan suites → **657/657** pass (model 177, dialog 45,
  scriptStrokeEdition 31, Studio 404); `pnpm --filter efx-motion-editor exec tsc --noEmit`
  → exit 0.
- **Native UAT rows (user-judged, pending):**
  - **A.** Open Edit path on stroke A, then click stroke B in the list: the overlay's anchors disappear at once, B's row becomes the sheet's subject, and pressing Edit path on B opens B's path.
  - **B.** Start a long Apply, then switch tracks mid-apply: the track does not change and the capsule says another edit is settling; once the apply ends, the switch completes.
  - **C.** Open a path edit, drag the Anchor width stepper on a selection that no longer matches the open edit (select a different stroke first): the knob returns to the document value and the capsule explains why.
- **REQUIREMENTS.md note:** VEC-02 and VEC-03 are already checked; VEC-07 stays open until its sibling plans land because the shared-ID gate blocks the flip from this plan alone.
- Out of this plan's scope (unchanged, still deferred): the path-edit drag lifecycle (61-28), the G-17 replay law (61-29) and every paint re-bake concern.

---
*Phase: 61-vector-painting-tool*
*Completed: 2026-11-11*

## Self-Check: PASSED

- `app/src/components/physic-paint/view/strokeSettingsModel.ts` — FOUND
- `app/src/components/physic-paint/view/strokeSettingsModel.test.ts` — FOUND
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` — FOUND
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts` — FOUND
- `app/src/components/physic-paint/view/scriptStrokeEdition.ts` — FOUND
- `app/src/components/physic-paint/view/scriptStrokeEdition.test.ts` — FOUND
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — FOUND
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — FOUND
- RED evidence records 61-27-t1/t2/t3 — FOUND
- Commit `ceeadbb21` — FOUND (ancestor of HEAD)
- Commit `2ba169023` — FOUND (ancestor of HEAD)
- Commit `9b5dca592` — FOUND (ancestor of HEAD)
- Commit `67fcb703d` — FOUND (ancestor of HEAD)
- Commit `444279506` — FOUND (ancestor of HEAD)
- Commit `e2c9c02b2` — FOUND (ancestor of HEAD)
