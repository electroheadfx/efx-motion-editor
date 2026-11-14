---
phase: 261107-ux2-rail-motion-first-span-never-interpolate
plan: 01
subsystem: rail-motion
tags: [rail-motion, interpolation, easing, hold, position-pair, quick-task]
requires:
  - phase: 59-rail-motion-channels-v7-interface
    provides: applyAddChannelEdit seeding authority, evaluateRailMotionChannel interpolation authority, Motion sheet Hold/Ease toggle
provides:
  - Eased opening seed for every newly added Motion channel (single and grouped Position)
  - End-to-end regression pins through evaluateRailMotionChannel for the first and later spans
  - Command-layer and action-layer seed pins aligned with the eased seed law
affects: [59-rail-motion-channels-v7-interface, rail-motion UAT]
actuals:
  tokens: 2245
  tasks: 2
  commits: 3
tech-stack:
  added: []
  patterns:
    - "Seed law expressed at the seeding authority (applyAddChannelEdit); the evaluator stays untouched"
    - "RED test commit then GREEN fix commit for the TDD task; separate atomic commit for the pin alignment task"
key-files:
  created: []
  modified:
    - app/src/components/physic-paint/roto/railMotionModel.ts
    - app/src/components/physic-paint/roto/railMotionModel.test.ts
    - app/src/components/physic-paint/roto/railMotionCommands.test.ts
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts
key-decisions:
  - "The add-channel seed now carries easing 'ease': it is the OUTGOING key of the first span, so its easing alone decides whether that span interpolates."
  - "A single seed key stays inert — the evaluator holds the last key at and after the end — so an untouched channel cannot start animating."
  - "No migration and no load-time rewrite: a pre-existing project keeps its held opening key; the user remedy is selecting that local-0 key and pressing Ease (one click)."
  - "The evaluator, hold|ease union, segment semantics, D-12 sibling step-hold rule, seed frame, identity values and wiggle are unchanged."
requirements-completed: [QUICK-261107-UX2]
coverage:
  - id: D1
    description: "A newly added Motion channel seeds its opening key with easing 'ease' for single channels and for the grouped Position pair."
    requirement: QUICK-261107-UX2
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionModel.test.ts#add-channel seeds identity keys at frame 0 with ease; add-channel seeds both Position axes with zero"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionCommands.test.ts#59-17 rail motion commands — add a Motion channel (G1)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#seeds Scale through the ONE motion setter; adds the grouped Position pair in ONE edit through the same door"
        status: pass
    human_judgment: false
  - id: D2
    description: "The first span of an added channel interpolates: paint key at local 0 + written key at local 4 yields a strict intermediate at local 2 (exact smoothstep midpoint), and both grouped Position axes ease together."
    requirement: QUICK-261107-UX2
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionModel.test.ts#a newly added channel eases its FIRST span toward the next written key (261107-ux2); a grouped Position pair eases BOTH axes on the first span from the seeded identity"
        status: pass
    human_judgment: false
  - id: D3
    description: "A channel carrying only the opening seed key evaluates to its identity everywhere, and an authored per-key Hold still steps its outgoing span."
    requirement: QUICK-261107-UX2
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionModel.test.ts#a channel carrying ONLY the seeded opening key still evaluates to its identity everywhere; an explicit per-key Hold still steps the outgoing span"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionEvaluator.test.ts (30 tests, unchanged)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Live visible UAT in the native app: frame 2 and frame 6 both interpolate on a fresh rail; an untouched channel never moves; authored Hold still steps; an old project's held opening key is fixed by Ease; Scale/Rotation handle drag eases from the opening key."
    requirement: QUICK-261107-UX2
    verification: []
    human_judgment: true
    rationale: "The defect was reported from live Studio UAT; only the running app can show that the painted stroke is now a genuine intermediate pose rather than pixel-identical to frame 0."
metrics:
  duration: ~5min
  completed: 2026-11-07
status: complete
---

# Quick 261107-ux2: Rail-Motion First Span Never Interpolates — Summary

**The add-channel seeding authority now writes the opening key with easing `ease`, so a newly added Motion channel interpolates its first span instead of holding pixel-identical to frame 0 until the second written key.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-11-07T21:16:00Z (approx)
- **Completed:** 2026-11-07T21:21:39Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Root cause fixed at the single seeding authority: `applyAddChannelEdit` seeded the rail-local frame-0 key with `easing: 'hold'`, and the evaluator's outgoing-hold short-circuit made the first span flat. The seed literal is now `'ease'` with a comment recording the law.
- End-to-end regressions pin the reported case through `evaluateRailMotionChannel`: with paint keys at 0/4/9 and motion keys written at 4 and 9, frame 2 now evaluates to the exact smoothstep midpoint (1 → 3 gives 2), and frame 6 lands strictly between 3 and 5 — both spans interpolate.
- The grouped Position pair behaves identically: with position-x written at local 4 (`value 100`, `pairedValue 40`), frame 2 reads x=50 and y=20 from the local-0 identity.
- A single seed key remains inert (evaluates to its identity at every frame), and authored per-key Hold still steps — the evaluator file is byte-identical.
- Command-layer and action-layer seed pins now express the eased seed; the hand-built easing fan-out fixtures and the pre-existing-record hold fixtures were left untouched and stay green.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): pin the eased opening seed and first-span interpolation** — `7dd377201` (test)
2. **Task 1 (GREEN): ease the add-channel opening seed so the first span interpolates** — `487932264` (fix)
3. **Task 2: align command and action seed pins with the eased opening key** — `3138361ad` (test)

TDD note: Task 1 was executed RED-first as two commits (failing tests, then the seed fix), per the plan's allowed two-commit shape.

## TDD Evidence

### RED

- **Command:** `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/railMotionModel.test.ts`
- **Result:** exit code 1 — `Tests  4 failed | 75 passed (79)`
- **Target failures (all on the planned assertions, no syntax/import/fixture faults):**
  - `add-channel seeds identity keys at frame 0 with ease` — received `easing: 'hold'` for the Scale and Opacity seeds.
  - `add-channel seeds both Position axes with zero` — received `easing: 'hold'` for both axes.
  - `a newly added channel eases its FIRST span toward the next written key (261107-ux2)` — `expected 2 to be 1` at local frame 2 (the reported pixel-identical first span).
  - `a grouped Position pair eases BOTH axes on the first span from the seeded identity` — `expected 50` but received `0` at local frame 2.
- **Semantic assessment:** every failure is the planned behavior assertion; the new single-key-inert and explicit-hold guards passed before the fix, proving they pin unchanged behavior rather than the defect.

### GREEN

- `railMotionModel.test.ts` + `railMotionEvaluator.test.ts`: **109 passed (2 files)** — the evaluator's 30 tests unchanged.

### REFACTOR

- None needed; the fix is one literal plus its law comment.

## Files Created/Modified

- `app/src/components/physic-paint/roto/railMotionModel.ts` — `applyAddChannelEdit`'s `seedKey` now returns `easing: 'ease'` and carries the 261107-ux2 law comment (seed = outgoing key of the first span; single key inert; Hold remains authorable per key).
- `app/src/components/physic-paint/roto/railMotionModel.test.ts` — flipped the add-channel seed pins to `ease`; added the single-channel two-span regression, the grouped Position regression, the single-key-inert guard and the explicit-Hold step guard; imports `evaluateRailMotionChannel`.
- `app/src/components/physic-paint/roto/railMotionCommands.test.ts` — `identitySeed` helper returns `ease` and its docstring states the law; the add-channel test title now says "seeded with ease". Consumers at 1773/1795/1796/1810/1821 needed no change beyond the helper.
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts` — action-level Scale and grouped Position seed assertions and comments now expect `ease`; the pre-existing-record fixtures at the `seedMotionRail` / `scaleOnly` inputs remain `hold` on purpose.

## Decisions Made

- Seed `'ease'` at the seeding authority only; the evaluator, `hold | ease` union, `resolveRailMotionSegment`, `upsertRailMotionKey`, `railMotionStepValueAt`, the D-12 sibling rule, the Motion sheet Hold/Ease toggle, the seed frame (rail-local 0), identity values and wiggle 0 are all unchanged.
- No persisted field, format, serializer, parser, canonical revision term or migration changed.
- Pre-existing projects keep their held opening key by design (clean break, no backward-compat code); the documented one-click remedy is selecting the local-0 key in the Motion sheet and pressing Ease.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Untouched Hold Coverage (verified green, unmodified)

- `railMotionEvaluator.test.ts` hold-step, single-key-hold and wiggle-around-hold tests (30 tests pass).
- Persisted hold fixtures: `railMotionCanonicalParity.test.ts` (14), `railMotionPackageRoundTrip.test.ts` (5), `railMotionExportParity.test.ts` (14) — 33 passed, files byte-identical.
- Hand-built easing fan-out assertions in `railMotionCommands.test.ts` (the authored `ease,hold` second key) — untouched and green.

## Verification Results

| Gate | Command | Result |
|------|---------|--------|
| Model + evaluator | `vitest run railMotionModel.test.ts railMotionEvaluator.test.ts` | 109 passed (2 files) |
| Command + action | `vitest run railMotionCommands.test.ts useRotoTimelineActions.test.ts` | 293 passed (2 files) |
| Persistence guards | `vitest run railMotionCanonicalParity.test.ts railMotionPackageRoundTrip.test.ts railMotionExportParity.test.ts` | 33 passed (3 files) |
| Full suite | `vitest run` | 8063 passed, 1 skipped, 96 todo (8160 tests); 399 files passed, 2 skipped; **0 failed** |
| Typecheck | `pnpm --filter efx-motion-editor run typecheck` | clean (no errors) |
| Scope tripwire | `git diff --name-only e926fb8b6 -- app/src` | exactly the 4 planned files; `railMotionEvaluator.ts` byte-identical |

## UAT Rows Handed to the User (live visible UAT)

1. Fresh rail with paint keys at 0/4/9: add a Motion channel, write a value at frame 4 (and 9), scrub to frame 2 — the painted stroke is a genuine intermediate pose, no longer pixel-identical to frame 0; frame 6 also interpolates (both spans).
2. Add a Motion channel and write nothing: scrub the rail — the pose never moves (single seed key inert).
3. Select a Motion key, press Hold in the Motion sheet, scrub its outgoing span — the value still steps at the next key (explicit Hold preserved).
4. Open a project created before this fix whose opening motion key was seeded as Hold: the first span still holds; select that local-0 key and press Ease to make it interpolate (one-click remedy, no migration).
5. Scale/Rotation handle drag on a rail without that channel: the auto-added channel now eases from the opening key to the dragged key instead of holding until it.

## Next Phase Readiness

- The fix is confined to the seeding authority; no persistence carrier, store, hook or component changed, so Phase 59 behavior elsewhere is untouched.
- Live UAT rows above remain the done gate (automated-green is not done).

## Self-Check: PASSED

- All 4 planned source/test files exist on disk.
- Commits `7dd377201` (test), `487932264` (fix), `3138361ad` (test) are ancestors of HEAD.
