---
phase: 261113-fkm-vector-paint-global-colour-apply-replace
plan: 01
subsystem: physic-paint
tags: [watercolor, vector-path, anchor-color, appearance-batch, undo, aqtl]

# Dependency graph
requires:
  - phase: 261111-wd6
    provides: The sparse explicit anchor `color` (VEC-04) that wins over the stroke colour
  - phase: 261111-t74
    provides: The ONE whole-stroke appearance batch (brush id, multipliers, source-pin region)
  - phase: 261024-p5q
    provides: `beginAquarelleAppearanceEdit` and the registry before/after snapshot pair
provides:
  - A whole-stroke colour apply now clears every explicit anchor `color` in the SAME edit
  - A same-colour apply on a coloured-anchor stroke is an edit again (1 + one revision bump)
  - Batch-level D-01/D-02 pins and the wrapper-level one-undo pin
affects: [vector path edit re-bake, Color tab whole-stroke commit, AQTL colour reopen]

actuals:
  tokens: 5140
  tasks: 2
  commits: 3
plan_head_before: 2bcec0649172aefa1fa330a73433040ba9675b3d
plan_head_after: 8adfa44ce580162cbb06d0b3b92611673a7b30de

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sparse-delete helper (`withoutAnchorColor`) mirroring `withoutWidth`: destructure the key away, return the rest object"
    - "Reference identity as the write signal: an untouched anchor or anchor list is never rebuilt or cloned"

key-files:
  created:
    - app/src/components/physic-paint/view/aquarelleRecordState.appearanceColor.test.ts
  modified:
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts

key-decisions:
  - "D-01: a whole-stroke colour IS a replacement — every explicit anchor colour is dropped in the same write and therefore the same undo entry"
  - "D-02: Size is a multiplier channel, not a colour channel — a non-colour patch never enters the anchor-clear block, so no Size code changed"
  - "Only anchors carrying a colour are rebuilt; colourless anchors and an already-colourless array stay reference-identical (byte-identical sparse profile)"
  - "The clear lives inside `updateAquarelleStrokesInScript`, not in a second write path, so one snapshot pair covers undo and the ONE `toStudioStroke` projection keeps `engine.anchors` in agreement"
  - "`withoutAnchorColor` is placed above the batch's doc comment, outside the 261111-t74 source-pin region"

patterns-established:
  - "A colour patch on a vector stroke owns the stroke colour; per-vertex colour is only re-added by the anchor-selection commit (`buildAnchorColorCommit`), whose routing is unchanged"

requirements-completed: [QUICK-261113-FKM]

# Metrics
duration: 8min
completed: 2026-11-13
status: complete
---

# Quick 261113-fkm: Global Colour Replaces Per-Vertex Colours Summary

**A whole-stroke colour apply now clears every explicit per-vertex anchor colour in the same edit, so the global colour survives a path-edit re-bake instead of being overwritten by stale anchor colours.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-11-13T10:18Z (approx.)
- **Completed:** 2026-11-13T10:25Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `updateAquarelleStrokesInScript` now rebuilds the target's anchor list on any colour-carrying patch: every explicit `color` key is removed, while geometry, order, `kind`, handles and `width` factors survive untouched. The rebuilt list reaches `engine.anchors` through the existing `toStudioStroke` projection, so the payload can no longer replay a stale per-vertex colour (`resolveStrokeColors` returns null for a uniform profile).
- A same-colour whole-stroke apply on a coloured-anchor stroke is an edit again: the clear flips `changed`, the batch returns 1, and the revision bumps exactly once. Previously it was silently dropped.
- Reference identity is the write signal: a colourless anchor is returned as-is, a colourless anchor array stays `toBe` the pre-edit array, and a hand-painted stroke never gains an `anchors` key.
- D-02 holds without a code change: a params-only Size patch never enters the clear block; anchor `width` factors and explicit colours survive a Size apply.
- One undo restores the exact pre-edit stroke object (explicit anchor colours included) and the pre-edit timeline entry by reference, proved at the wrapper layer.

## Task Commits

Each task was committed atomically (TDD RED → GREEN; Task 2 is test-only):

1. **Task 1 — RED: A whole-stroke colour apply replaces per-vertex colours in the one batch** - `3fa8e0dda` (test)
2. **Task 1 — GREEN: A whole-stroke colour apply replaces per-vertex colours in the one batch** - `e7016945c` (feat)
3. **Task 2 — One undo restores the per-vertex colours (wrapper-level pin)** - `8adfa44ce` (test)

**Plan metadata:** not committed by the executor (the orchestrator handles the docs commit).

## Files Created/Modified

- `app/src/components/physic-paint/view/aquarelleRecordState.ts` — added the module-local `withoutAnchorColor` helper above the batch doc comment (outside the 261111-t74 source pin), the anchor-clear block in the per-target resolution loop, the `nextAnchors` target field/push/destructure, and the one conditional `anchors` spread in `nextStroke`; extended the batch doc comment with the D-01/D-02 write policy.
- `app/src/components/physic-paint/view/aquarelleRecordState.appearanceColor.test.ts` — new batch-level pin file: clears every explicit colour and re-projects the engine entry; colourless anchors reference-identical; hand-painted stroke gains no key; same-colour apply returns 1; params-only Size never clears; mixed batch writes both targets with one bump.
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts` — local `stroke()` helper gained an optional `anchors` field (spread only when provided) and one wrapper test pinning that a same-colour whole-stroke apply is one undoable edit restoring the pre-edit objects by reference.

## Decisions Made

- **D-01 — global replaces per-vertex.** A whole-stroke colour apply supersedes the explicit anchor colours in the same write, hence the same undo entry. Geometry is never dropped; only `color` keys are removed.
- **D-02 — Size is a multiplier channel.** A patch without a colour never touches the anchor list. No Size code path changed.
- **Helper placement is load-bearing.** `withoutAnchorColor` sits above the batch's doc comment so the 261111-t74 Studio source pin (which slices from `export function updateAquarelleStrokesInScript(` to the curve-mode function) still sees exactly one bump, one timeline write, one neutral constant and one `toolOverrides` spread. Verified by `PhysicsPaintStudio.test.ts` (413 tests green).
- **No re-projection.** The store's anchors are already canonical (every path write goes through `projectVectorPath`); re-projecting would clone every anchor and destroy the untouched-reference law.

## Deviations from Plan

None - plan executed exactly as written.

Task 2 is test-only: `is-behavior-adding: false` (no `tdd` attribute, no `<behavior>` block, test-file-only), so the behavioural TDD gate did not apply to it — following the 61-14 precedent.

## Issues Encountered

- The strict TAP adapter used by `check tdd-red-evidence` refused the RED report because vitest's `not.toBe` diff for an array rendered a multi-line YAML scalar with unindented continuation lines (`Malformed TAP` / `Non-TAP data`). The mixed-batch identity assertion was rewritten as `expect(after === before).toBe(false)` — a compact failure message and a clearer intent — before the RED commit. RED was then verified: `RED_EVIDENCE_OK` (target test failed on its planned assertion, exit 1). Evidence kept at `.planning/quick/261113-fkm-vector-paint-global-colour-apply-replace/red-evidence.json` (raw report in `red-tap.txt`).

## Known Stubs

None — no placeholder values, no unwired data sources, no skipped tests.

## Threat Flags

None — the change only removes keys from an anchor list the store already owns; no wire field, no schema-version bump, no new dependency, no new endpoint or auth path.

## TDD Gate Compliance

- RED: `3fa8e0dda` — `test(261113-fkm-01)`, verified `RED_EVIDENCE_OK` (`target_test_failed`); the named target test failed on `hasOwnColor(anchor) === false` with 3 sibling D-01 tests also failing and the 3 guard tests passing.
- GREEN: `e7016945c` — `feat(261113-fkm-01)`, all 6 batch tests green; the Studio source pin and typecheck green.
- Task 2: `8adfa44ce` — `test(261113-fkm-02)`, test-only by design (no fabricated `feat` commit).

## Verification Run

- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarelleRecordState.appearanceColor.test.ts` — 6/6 pass
- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarelleStrokeSelection.test.ts` — 101/101 pass
- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts` — 413/413 pass (261111-t74 source pin intact)
- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarelleRecordState.path.test.ts` — 16/16 pass
- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarelleRecordState.reopenAnchorColor.test.ts` — 4/4 pass
- `pnpm --prefix app run typecheck` — pass
- Scope: `git diff --name-only <plan-head-before>..HEAD` lists exactly the three `files_modified` paths; `PhysicsPaintStudio.tsx`, `aquarelleStrokeSelection.ts`, `vectorPathHandles.ts`, `packages/efx-watercolor/**`, `app/package.json` and `pnpm-lock.yaml` are unchanged.

## UAT Handoff (native rows — NOT claimed from CI)

1. A vector stroke carrying per-vertex colours: re-enter path edit, select NO vertex, pick a new colour in the Color tab. The whole stroke takes that colour and the old per-vertex variation is gone.
2. Leave and re-enter path edit (or force a replay): the new global colour holds — no per-vertex colour returns. Save, close and reopen the project: the global colour still holds.
3. In the same path edit, select one or two vertices and pick a different colour: those vertices take a per-vertex colour again (the anchor-selection path is the "except if I ask").
4. Undo ONCE right after the global colour apply: the previous per-vertex colours are back in one step; redo re-applies the global colour.
5. A whole-stroke Size apply on a stroke carrying per-vertex size factors AND per-vertex colours leaves both untouched — only the base size changes.
6. Apply a colour to a mixed selection (a coloured vector stroke plus a hand-painted stroke): both take the colour; the hand-painted stroke is otherwise unchanged.

## Next Phase Readiness

- The write policy is data-level and fully pinned; the six native UAT rows above are handed to the user rather than claimed.
- No new stored field, no format-version change, no UI change, no Studio routing change, no dependency.
- Re-adding per-vertex colours remains available only through the anchor-selection colour commit, whose routing is unchanged.

---
*Quick task: 261113-fkm-vector-paint-global-colour-apply-replace*
*Completed: 2026-11-13*

## Self-Check: PASSED

- All three changed files exist on disk and are committed.
- Commits `3fa8e0dda` (RED), `e7016945c` (GREEN) and `8adfa44ce` (wrapper pin) are ancestors of HEAD.
- Full plan verification set green (540 tests across 5 files) plus `pnpm --prefix app run typecheck`.
