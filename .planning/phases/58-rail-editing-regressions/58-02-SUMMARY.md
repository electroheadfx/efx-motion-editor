---
phase: 58-rail-editing-regressions
plan: 02
subsystem: physics-paint roto key-rail cycle conversion
tags: [preact, physics-paint, roto, key-rail, loop-clips, standard-rail, vitest, rail-editing]

# Dependency graph
requires:
  - phase: 43
    provides: Loop Clip records, the loop-only publication path, buildStandardStackedLoopClip's strict-whitelist writer, and useRotoPhysicalEditHistory
  - phase: 52
    provides: the reveal railKind discriminator and the Standard rail classification (isStandardMergedLoopClip / classifyLoopClipRailKind)
provides:
  - buildKeyRailStandardLoopClip strict-whitelist Standard record writer
  - Controller 'key-rail-create' mode with openKeyRailCycleEdit / confirmKeyRailCycle / keyRailCycleEditTarget
  - Span-based Key Rail cycle law (lastKeyFrame - firstKeyFrame + 1) with a capacity-clamped lifecycle
  - One loop-only commit and exactly one undo/redo command per conversion
affects: [58-03, 58-04, 58-05, 58-verify-work, Studio Key Rail menu]

actuals:
  tokens: 10685
  tasks: 3
  commits: 4
  plan_head_before: 6e9b7d7ba4f4748063d4e4298fa77fb3bdd54bfc
  plan_head_after: 385a1670145cdcb2cf753d475312e093bc256b3d
  commits_measured: 4

tech-stack:
  added: []
  patterns:
    - "Strict-whitelist record conversion: build a NEW Standard clip literal, never spread a source record, so provenance and Reveal members cannot leak"
    - "Frozen segment target at open + full revalidation against fresh authority at confirm (stale-key, ordering, ownership)"
    - "The dialog mode owns its confirm: 'key-rail-create' routes before the stack/loop-edit/reveal branches"

key-files:
  created:
    - app/src/components/physic-paint/roto/physicsPaintRotoKeyRailCycle.test.ts
    - .planning/phases/58-rail-editing-regressions/58-02-RED-EVIDENCE.json
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts

key-decisions:
  - "openKeyRailCycleEdit reads only the accepted local document and freezes the segment with cycleFrameCount = lastKeyFrame - firstKeyFrame + 1; a gapped segment at 10,12,15 is a 6-frame cycle, never the 3-key count (D-09)."
  - "confirmKeyRailCycle revalidates every keyId against fresh authority.physicalRecords (present, strictly increasing) and refuses keys owned by any loop sourceKeyIds OR frameOverrides before any publication; the plan's T-58-02 mitigation is fully implemented."
  - "The lifecycle reuses the private buildNewLoopLifecycle so a finite repeat clamps to authority.physicalCapacity and infinity stays lifecycle-less (T-58-03)."
  - "confirm() routes 'key-rail-create' ahead of the stack branch so an explicitly opened reduced modal can never be consumed by a stack/tab confirm (WR-06's dialog-owns-confirm principle)."
  - "openKeyRailCycleEdit clears any stale loop-edit target, repair id and preflight snapshot before showing the reduced modal, so no prior edit-mode computed leaks into the new surface."
  - "Refusals inside confirm return through rejectLoopOp (logged, zero commits) and keep the modal open; the frozen target is only cleared on success or cancel (D-11/T-58-04)."

requirements-completed: [RAIL-03, RAIL-04, RAIL-05, RAIL-07]

coverage:
  - id: D1
    description: "A Key Rail segment opens the reduced create dialog with Cycle 1, Infinity off, the frozen span target, and zero writes"
    requirement: RAIL-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts#opens the create dialog from a gapped segment with Cycle 1, Infinity off, and zero writes"
        status: pass
    human_judgment: false
  - id: D2
    description: "Confirming converts the segment into one provenance-free Standard clip through exactly one loop-only commit (affectedEndAppFrame anchor - 1, freshKeyIds [])"
    requirement: RAIL-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts#converts the segment into ONE provenance-free Standard loop-only commit"
        status: pass
    human_judgment: false
  - id: D3
    description: "The conversion records as exactly one command: undo restores the pre-conversion Key Rail, redo re-applies it, availability {1,0} -> {0,1} -> {1,0}"
    requirement: RAIL-04
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts#records the conversion as exactly one undoable command and restores the Key Rail"
        status: pass
    human_judgment: false
  - id: D4
    description: "Cancel, stale targets, already-owned keys, and non-increasing frames all write nothing; two confirms in one tick produce one commit"
    requirement: RAIL-05
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts#cancel after open writes nothing and leaves the history availability at {0,0}"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts#refuses a STALE target at confirm with zero commits and no history entry (T-58-02)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts#refuses keys already owned through a loop source cycle at open and at confirm"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts#refuses keys already owned through a loop frame override at open"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts#two confirm calls in the same tick produce exactly ONE commit (T-58-04)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The Standard record shape, span law (cycleLength 6 for 10,12,15; extents 16 and 22), single-key 1-frame rule, lifecycle-less infinity, and segment disappearance are pinned pure"
    requirement: RAIL-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoKeyRailCycle.test.ts (8 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "A gapped Standard clip opened later through openLoopEdit and updated through updateLoop keeps the span extent (10 + 6 * 2 = 22)"
    requirement: RAIL-07
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts#a Standard clip opened later keeps the span-based extent through updateLoop"
        status: pass
    human_judgment: false
  - id: D7
    description: "The live Studio Key Rail menu opens this dialog and the converted rail visibly renders as Standard"
    requirement: RAIL-03
    verification: []
    human_judgment: true
    rationale: "58-04/58-05 own the panel/menu and dialog rendering; this plan ships the logic tracer and controller contract only, so end-to-end Studio confirmation belongs to phase UAT."

duration: 8 min
completed: 2026-11-03
status: complete
---

# Phase 58 Plan 02: Key Rail → Standard cycle conversion summary

**A gapped Key Rail segment converts into one provenance-free Standard loop clip with a span-based 6-frame lifecycle, published through exactly one loop-only commit and undone/redone as one command.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-11-03T11:54:00Z
- **Completed:** 2026-11-03T12:03:00Z
- **Tasks:** 3
- **Files modified:** 5 (2 production sources, 2 specs, 1 RED evidence record)
- **Commits:** 4 (measured from `6e9b7d7ba..385a16701`)

## Accomplishments

- `buildKeyRailStandardLoopClip` publishes a strict-whitelist Standard record: `scriptId`, `motion`, `overrideColor`, `railKind`, `colorize`, `colorizeMix`, and `photoWiggle` are absent (not `undefined`-valued), so Regenerate/Replay can never rebuild one script over the segment.
- The controller gains a `'key-rail-create'` mode: `openKeyRailCycleEdit` freezes the segment and prefills Cycle 1 / Infinity off with zero writes; `confirmKeyRailCycle` revalidates against fresh authority and emits ONE loop-only commit (`affectedStartAppFrame` 10, `affectedEndAppFrame` 9, `freshKeyIds: []`).
- The span law is pinned from two independent paths: the resolver derives `cycleLength` 6 for keys at 10, 12, 15, and the lifecycle stamps `originalEndExclusive` 16 (repeat 1) / 22 (repeat 2); a single key yields a 1-frame cycle (D-08).
- The real history harness proves the conversion is exactly one command: availability `{1,0}` → `{0,1}` → `{1,0}`, undo restores the empty loop collection, redo restores the clip.
- Every refusal path (stale key, already-owned source key, already-owned frame override, non-increasing frames, cancel) commits nothing and leaves history at `{0,0}`; duplicate confirm produces one commit.

## TDD

- **RED:** `test(58-02): add failing Key Rail cycle conversion spec` (`05801da21`). The target test `opens the create dialog from a gapped segment with Cycle 1, Infinity off, and zero writes` failed on its planned `typeof openKeyRailCycleEdit === 'function'` assertion; the three remaining conversion cases threw because the method did not exist. Classifier verdict: `RED_EVIDENCE_OK` (`target_test_failed`, tap-flat, 267 tests: 263 pass, 4 fail). Evidence at `.planning/phases/58-rail-editing-regressions/58-02-RED-EVIDENCE.json`.
- **GREEN:** `feat(58-02): convert a Key Rail segment into one Standard cycle` (`d2f8edf20`). Controller spec 267/267 passed, then the planned pnpm verify re-ran green; tracer feedback gate passed end-to-end before expansion.
- **Task 2 pins:** born green (`PINS_GREEN_AT_BIRTH`) — the Task 1 implementation already defines the record/span behavior, so no RED was manufactured and no production source was weakened. 8/8 passed.
- **Task 3 pins:** tests only, born green against the Task 1 implementation. 272/272 controller tests passed.
- Gate order verified: the `test(58-02)` commit precedes its `feat(58-02)` commit; no REFACTOR commit was needed.

## Task Commits

1. **Task 1 RED: Key Rail cycle conversion spec** - `05801da21` (test)
2. **Task 1 GREEN: controller + record builder** - `d2f8edf20` (feat)
3. **Task 2: pure record-shape / span / single-key spec** - `692b4a05e` (test)
4. **Task 3: refusal / duplicate-confirm / later Standard edit pins** - `385a16701` (test)

_Note: TDD tasks produce a RED commit before the implementation commit._

## Files Created/Modified

- `app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.ts` — added `buildKeyRailStandardLoopClip`, a strict-whitelist literal mirroring `buildStandardStackedLoopClip`.
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` — extended `RotoPlayScriptDialogMode` with `'key-rail-create'`; exported `KeyRailCycleEditTarget`; added the `keyRailCycleEditTarget` signal, `openKeyRailCycleEdit`, `confirmKeyRailCycle`, the parsedRepeat branch, confirm routing, cancel cleanup, and the `resolveKeyRailFrames` / `loopClipsOwnAnyKey` helpers.
- `app/src/components/physic-paint/roto/physicsPaintRotoKeyRailCycle.test.ts` — pure 8-test spec for record shape, span law, single-key rule, infinity, and segment disappearance.
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts` — the conversion tracer (open/commit/history/cancel) and the Task 3 refusal pins.
- `.planning/phases/58-rail-editing-regressions/58-02-RED-EVIDENCE.json` — RED TAP evidence record consumed by the TDD gate.

## Decisions Made

- The conversion is a loop-only mutation: `buildLoopOnlyPublication` is reused unchanged, so records stay byte-identical to authority and `semanticDelta.loopOnly` is true (D-06/RAIL-04).
- Ownership is checked through both `sourceKeyIds` and `frameOverrides`; conversion can never duplicate ownership (T-58-02).
- `cycleFrameCount` is the span, not the key count, in both `parsedRepeat` and `buildNewLoopLifecycle` (D-09).
- `confirm()` treats `'key-rail-create'` as owning its confirm ahead of the stack branch, because the modal was explicitly opened (WR-06 principle).
- The opened mode detaches stale `loopEditTargetId` / `sourceEditRepairId` / `loopPreflightSnapshot` values before showing the reduced surface.
- `buildKeyRailStandardLoopClip` takes only the closed creation inputs; there is no source-record spread and no resolver intent or semantic-delta kind change.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The frame-override ownership fixture was initially rejected by `isPhysicPaintRotoLoopClip` because a lifecycle `frameOverride` must fall inside a visible range. The fixture's visible range was widened to 10–20 (test-only fixture correction), after which ownership refusal was pinned.
- The RED TAP report used the app-local `vitest --reporter=tap-flat` binary so the pnpm wrapper's banner could not contaminate the report (same approach as 58-01). The planned pnpm verify command was used for every acceptance run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- RAIL-03/04/05 are automated-ready; the live Studio menu and dialog rendering remain with 58-03/58-04/58-05 and phase UAT.
- `openKeyRailCycleEdit` returns `Promise<RotoPlayScriptLoopOpResult>` on every path, matching 58-05's always-Promise handler contract.
- No `.mce`, schema, store, parser, or Rust changes; `app/src/types` and `src-tauri` are untouched.

## Self-Check: PASSED

All created/modified files exist on disk, and all four task commits (`05801da21`, `d2f8edf20`, `692b4a05e`, `385a16701`) are ancestors of HEAD. Full verification passed: 280/280 tests across both specs, `tsc --noEmit` clean, and no changes under `app/src/types` or `src-tauri`.

---
*Phase: 58-rail-editing-regressions*
*Completed: 2026-11-03*
