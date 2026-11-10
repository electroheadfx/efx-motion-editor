---
phase: 61-vector-painting-tool
plan: 19
subsystem: ui
tags: [preact, signals, vector-path, anchor-width, fail-closed, shared-commit, tdd, gap-closure]

# Dependency graph
requires:
  - phase: 61-vector-painting-tool
    provides: 61-15 the shared commitAquarelleVectorPathEdit (the ONE writer/bake seam) and 61-18 the wireframe refusal that precedes it
provides:
  - resolveAnchorWidthTarget — the ONE fail-closed target decision for the width commit
  - ANCHOR_WIDTH_EMPTY_READING and ANCHOR_WIDTH_NO_EDIT_REASON — the empty reading and its stated reason, owned by the model
  - applyAnchorWidths routing the write through commitAquarelleVectorPathEdit (one ledger entry per gesture)
  - The Anchor width control inert with a stated reason whenever its commit would be refused
affects: [61-20]

actuals:
  tokens: 4421
  tasks: 2
  commits: 4
  plan_head_before: 5172cafe702831393242787589492150d0e13c42
  plan_head_after: 76494ae019fedc7b095d02d48ff3316f65dd52d9

tech-stack:
  added: []
  patterns:
    - "Resolve the WRITE target from the open edit's session id and fail closed on any disagreement — never from the dialog selection alone"
    - "Shadow the reading to the model's empty constant instead of inventing a second disabled boolean: disabled and caption stay one branch"
    - "One shared commit is the only begin: the bundle delegates, so a multi-anchor gesture can never fork the ledger"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/strokeSettingsModel.ts
    - app/src/components/physic-paint/view/strokeSettingsModel.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
    - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts

key-decisions:
  - "resolveAnchorWidthTarget requires exactly one integer id AND a non-empty string session id equal to String(ids[0]); every other combination returns null, so the commit refuses with no write, no re-bake and no ledger entry (T-61-63)"
  - "The reading is shadowed by ANCHOR_WIDTH_EMPTY_READING on a null target instead of adding a second availability boolean — anchorWidthEmpty and disabled={anchorWidthEmpty} keep their shipped single-branch meaning"
  - "The no-edit reason and the shipped empty-selection copy share ONE caption span, branching only the child, so the testid-before-style ordering (and the shipped no-style pin) is untouched"
  - "The Studio imports resolveAnchorWidthTarget as a VALUE and converts the previous type-only import block; commitAquarelleVectorPathEdit joins the settings-memo deps because it is a stable useCallback"
  - "applyAnchorWidths widens to boolean | Promise<boolean>; the dialog already fires it with void, so the refusal is failure-as-data with no await, toast or retry"

requirements-completed: [VEC-03]

coverage:
  - id: D1
    description: "The Anchor width commit writes to the stroke the open path edit names; the target is resolved from pathEditMutationId and refuses on a selection/edit mismatch (G-5)"
    requirement: VEC-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#61-19 anchor-width target (the width commit writes one named path) > targets the selected stroke when the open edit names it"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#61-19 anchor-width target (the width commit writes one named path) > targets nothing when the open edit names a different stroke"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#61-19 anchor-width target (the width commit writes one named path) > targets nothing for a multi-selection"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#61-19 anchor-width target (the width commit writes one named path) > targets nothing for a non-integer id or an empty session id"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-11 Anchor width bundle wiring in the Studio > resolves the write target from the open path edit, never from ids[0]"
        status: pass
    human_judgment: false
  - id: D2
    description: "A width commit with no open path edit is refused instead of writing the selected stroke's anchors at indices that belong to another path (G-5)"
    requirement: VEC-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#61-19 anchor-width target (the width commit writes one named path) > targets nothing when no path edit is open"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/strokeSettingsModel.test.ts#61-19 anchor-width target (the width commit writes one named path) > targets nothing for an empty selection"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-11 Anchor width bundle wiring in the Studio > resolves the write target from the open path edit, never from ids[0]"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Anchor width control states why it is inert when there is no open path edit, inside the shipped caption span, instead of looking live and doing nothing (G-5, T-61-64)"
    requirement: VEC-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts#61-11 E4 rows: the Anchor width block > 61-19 inert: no open path edit reads empty and one caption span serves both reasons"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts#61-11 E4 rows: the Anchor width block > 61-19 inert cause: the reading is shadowed by the resolved target, never guessed"
        status: pass
    human_judgment: true
    rationale: "The source pins prove the wiring and the exact copy; only a live sheet proves the disabled control shows the no-edit reason on screen."
  - id: D4
    description: "One width change over N anchors remains exactly one ledger entry and one re-bake, routed through the shared path-edit commit (G-8, VEC-03 / T-61-38)"
    requirement: VEC-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-11 Anchor width bundle wiring in the Studio > commits every selected anchor in exactly ONE path edit"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-11 Anchor width bundle wiring in the Studio > resolves the write target from the open path edit, never from ids[0]"
        status: pass
      - kind: grep
        ref: "grep -c \"beginAquarellePathEdit(\" app/src/components/physic-paint/PhysicsPaintStudio.tsx -> 1"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts#61-11 E4 rows: the Anchor width block > 61-19 live: the shipped commit call and clamp are untouched, and no local writer exists"
        status: pass
    human_judgment: false
  - id: D5
    description: "The read seam stays selection-based and the Edit-path gate keeps working; no shipped pin is weakened and no new surface appears on the row"
    requirement: VEC-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-11 Anchor width bundle wiring in the Studio > supplies readVectorAnchors from the record seam, refusing not-quite-one vector stroke"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts#61-11 Edit path header button (E2)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts#61-11 E4 rows: the Anchor width block > 61-19 no new surface: one stepper, and the caption testid still precedes its style"
        status: pass
    human_judgment: false

# Metrics
duration: 9min
completed: 2026-11-10
status: complete
---

# Phase 61 Plan 19: Anchor Width Targets the Open Path Edit Summary

**The Anchor width commit now resolves its target from the open path edit and refuses on any disagreement — writing through the shared commit so one gesture stays one ledger entry — while the control states why it is inert when no edit is open**

## Performance

- **Duration:** 9 min
- **Started:** 2026-11-10T22:00:00Z
- **Completed:** 2026-11-10T22:08:11Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added `resolveAnchorWidthTarget` to `strokeSettingsModel.ts`: exactly one integer id AND a non-empty string `pathEditMutationId` equal to `String(ids[0])` resolves the target; an empty selection, a multi-selection, a non-integer id, an empty session id, or a selection/edit mismatch all resolve null. The Studio commit refuses on null with no write, no re-bake and no ledger entry (G-5, T-61-63).
- Added `ANCHOR_WIDTH_EMPTY_READING` and `ANCHOR_WIDTH_NO_EDIT_REASON`; `readAnchorWidthReading` now returns the constant for the empty case so the rule is stated once, and the shipped deep-equal pin (`{ value: 1, mixed: false, count: 0 }`) stays green.
- Rewrote the Studio's `applyAnchorWidths`: the recorded-stroke read and `buildAnchorWidthCommit` now run against the resolved TARGET, and the write is `commitAquarelleVectorPathEdit(target, next).then((editId) => editId !== null)` — one width change over N anchors remains exactly one `beginAquarellePathEdit`, one ledger entry and one re-bake (G-8, VEC-07).
- Widened `applyAnchorWidths` to `boolean | Promise<boolean>` and added the shared commit (a stable `useCallback`) to the settings-memo dependency list, preserving memo identity.
- The dialog resolves the same target from `ids` + `pathEditMutationId.value`, shadows the reading to `ANCHOR_WIDTH_EMPTY_READING` on a null target, and branches only the caption's CHILD: the no-edit reason when no edit is open, the shipped empty-selection copy otherwise. `anchorWidthEmpty`, `disabled={anchorWidthEmpty}` and the outer `{anchorWidthEmpty ? (` span are byte-unchanged; the caption testid still precedes its style attribute (T-61-64).
- All four shipped 61-11 dialog pins and the shipped Studio bundle pins pass without modification; the two 61-11 pins that named the removed `ids[0]` route were replaced in the RED commit, as the plan directs.

## Task Commits

Each task was committed atomically (TDD: test → feat):

1. **Task 1 RED: pin the fail-closed anchor-width target and the shared-commit route** - `34fd45128` (test)
2. **Task 1 GREEN: resolve the anchor-width write target from the open path edit** - `4c8a00c07` (feat)
3. **Task 2 RED: pin the Anchor width control's stated inert reason** - `508aed23c` (test)
4. **Task 2 GREEN: state why the Anchor width control is inert** - `76494ae01` (feat)

**Plan metadata:** recorded with the docs commit that carries this SUMMARY.

## Files Created/Modified

- `app/src/components/physic-paint/view/strokeSettingsModel.ts` - the fail-closed target resolver, the empty-reading constant, the no-edit reason, the widened bundle type
- `app/src/components/physic-paint/view/strokeSettingsModel.test.ts` - one new describe with six resolver cases (168 → 174)
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - the target-resolved width commit, the value import, the memo dep
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - two rebuilt 61-11 pins plus the new target-resolution pin (378 → 379; the two replaced pins keep their count)
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` - the shadowed reading and the two-reason caption child
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts` - four new source-pin cases (28 → 32) and the two constant imports

## Decisions Made

- The target decision lives in the model as ONE pure function, so the Studio, the dialog and the tests share a single truth (a mismatch can never be resolved differently in two places).
- The dialog reads EMPTY rather than "unavailable": the shipped empty branch already yields a disabled control plus a caption, so the inert state reuses it instead of adding a second gate that could disagree.
- The refusal returns `false` (failure-as-data) through the promise, matching 61-15's commit contract; the dialog's shipped `void` call shape is untouched.
- The empty-reading constant is reused inside `readAnchorWidthReading` so the literal object appears once in the model.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The RED source pin asserted the constant's VALUE, which a source pin can never contain**
- **Found during:** Task 2 GREEN (first dialog suite run)
- **Issue:** the new inert pin did `expect(emptyBranch).toContain(ANCHOR_WIDTH_NO_EDIT_REASON)`, comparing dialog SOURCE against the constant's value; the source carries the identifier, so the assertion could never pass once GREEN was correct.
- **Fix:** the pin now asserts the string `'ANCHOR_WIDTH_NO_EDIT_REASON'` and a comment points to the inert-cause case, which pins the constant's exact value.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts`
- **Verification:** 32/32 dialog tests, 585/585 across the three suites.
- **Committed in:** `76494ae01`

---

**Total deviations:** 1 auto-fixed (a test-authoring bug the GREEN run surfaced)
**Impact on plan:** None on scope. The intended behaviour was unchanged; only the assertion's reference form was corrected, and no shipped pin was weakened.

## Issues Encountered

- `gsd_run check tdd-red-evidence` initially returned `INVALID_RED (invalid_record)` for Task 1 because the record carried `reportPath` but not the embedded `output` the classifier consumes; embedding the JUnit XML in `output` (as prior plans in this phase do) produced `RED_EVIDENCE_OK`.
- `pnpm exec vitest run` prints pre-existing sourcemap warnings from `@efxlab/motion-canvas-core`; unrelated and not addressed (out of scope).

## TDD Gate Compliance

- Task 1: `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK`, reason `target_test_failed` (5 failing / 548 passing of 553 at RED: the three fail-closed resolver cases, both new Studio bundle pins). The target was `61-19 anchor-width target (the width commit writes one named path) > targets nothing when no path edit is open`. GREEN: 581/581 across the three suites.
- Task 2: `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK`, reason `target_test_failed` (2 failing / 30 passing of 32 at RED: the inert caption and the inert-cause pins). The target was `61-11 E4 rows: the Anchor width block > 61-19 inert: no open path edit reads empty and one caption span serves both reasons`. GREEN: 32/32, then 585/585 across the three suites.
- Both GREEN commits were preceded by their RED commit; no production code was written before its RED, and the Task 1 RED scratch stub in `strokeSettingsModel.ts` was replaced during GREEN and never committed (the 61-11 precedent).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G-5 and the width half of G-8 are implemented and pinned: the width commit targets the open path edit's stroke or refuses, and every gesture stays ONE ledger entry through the shared commit.
- Live UAT rows: (1) select a vector stroke and open the sheet WITHOUT entering Edit path — the Anchor width control must be disabled with "Open Edit path on this stroke to set anchor widths."; (2) enter Edit path, select anchors and change Anchor width — the sheet must re-bake once and one Undo must revert the whole change; (3) open Edit path, select no anchors — the caption must read "Select anchors on the canvas to set their width."
- 61-20 can build on this; no blockers. Out of scope and unchanged: WR-01 through WR-05, IN-01 through IN-03.

---
*Phase: 61-vector-painting-tool*
*Completed: 2026-11-10*

## Self-Check: PASSED

- FOUND: app/src/components/physic-paint/view/strokeSettingsModel.ts
- FOUND: app/src/components/physic-paint/view/strokeSettingsModel.test.ts
- FOUND: app/src/components/physic-paint/PhysicsPaintStudio.tsx
- FOUND: app/src/components/physic-paint/PhysicsPaintStudio.test.ts
- FOUND: app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
- FOUND: app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts
- FOUND: 34fd45128
- FOUND: 4c8a00c07
- FOUND: 508aed23c
- FOUND: 76494ae01
