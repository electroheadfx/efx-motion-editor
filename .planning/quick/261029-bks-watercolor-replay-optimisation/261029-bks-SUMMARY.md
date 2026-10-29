---
phase: quick-261029-bks
plan: 261029-bks
subsystem: watercolor bake replay + Physic Paint render-split telemetry
tags: [watercolor, bake, idle-gap, clock-skip, diagnostics, render-split, perf]

# Dependency graph
requires:
  - "packages/efx-watercolor existing bake pipeline: stepTick / advanceClock / fix / isAwake seams and the timed tick budget"
provides:
  - "EngineAdapter.skipTicks(fromTick, toTick) — clock-only advance, per-tick advanceClock, no engine.tick, no render"
  - "AquarelleBakeDiagnostics + AquarelleBakeOptions.onDiagnostics — exactly one record per bake() on timed / fallback / legacy"
  - "AquarelleApplyDiagnostics (bake record + adapterCreateMs) forwarded by bakeAquarelleEventsToFrame / applyAquarelleEventsToKey"
  - "script-bake and lift-erase render-split events now carry diagnostics"
affects: [physic-paint-apply, physic-paint-lift-erase, watercolor-bake-profiling]

# Actuals (#2632) — chars/4 over the realized diff (66,499 chars), never a harness count.
actuals:
  tokens: 16625
  tasks: 2
  commits: 2
plan_head_before: d7d43a8be6dc79f7d2ad1b90cadbf1bf9f1aa379
plan_head_after: 27702a84322f6bdf2664125fbaacc64c6fae3612

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Capability-seam gate: canSkip requires BOTH skipTicks and isAwake; an adapter without the seam steps every tick and receives zero probes"
    - "Clock-only advance accumulates one advanceClock(1000 * HOST_DT) per tick, never a single multiply — bit-identical virtual clock"
    - "Counted-step wrapper: the bake counts every step it drives on the adapter, and nothing else"

key-files:
  created:
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptApplyBake.test.ts
  modified:
    - packages/efx-watercolor/src/adapter/engineAdapter.ts
    - packages/efx-watercolor/src/adapter/engineAdapter.test.ts
    - packages/efx-watercolor/src/bake/aquarelleBake.ts
    - packages/efx-watercolor/src/bake/aquarelleBake.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "skipTicks mirrors stepTick's `disposed || !engine` early-return BEFORE any clock add, so a disposed adapter's clock cannot drift"
  - "The sleep-transition boundary tick is always simulated; only the remainder of the gap is skipped"
  - "canSkip gates on skipTicks presence, not isAwake — existing doubles therefore keep their pinned tick counts with no isAwake probes"
  - "Exactly three gap walks route through stepGap: pre-stroke, trailing-Dry pre-gap, window tail; all other loops keep their tick law"
  - "Diagnostics are emitted from the bake's finally on every path, and a throwing consumer is swallowed (T-bks-02)"
  - "simulatedTicks counts actual stepTick calls only (sample ticks inside the adapter and the Dry drain excluded); per-gap stepped + skipped === gap length, never a global identity"
  - "adapterCreateMs = adapter create span (dynamic import + construction) + the finally teardown span, never the bake itself; the callback fires after both disposes"
  - "The app helper holds the bake record in a { current } holder so TypeScript cannot narrow a bare let to null through the callback"

patterns-established:
  - "Optional capability seam on a concrete adapter, consumed through an intersection cast — keeps the host EngineAdapter interface untouched"
  - "Opt-in telemetry callback with a finally emission and a swallowing try/catch — observability can never alter bake behaviour"

requirements-completed: []

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "skipTicks advances the virtual clock only, per tick, and is safe before and after dispose"
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/adapter/engineAdapter.test.ts#skipTicks (261029-bks)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Idle gaps step while the engine is awake and become clock-only once asleep; skip-ON bytes and final clock are strictly equal to skip-OFF"
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/bake/aquarelleBake.test.ts#261029-bks idle-gap clock skip"
        status: pass
    human_judgment: false
  - id: D3
    description: "onDiagnostics fires once per bake across timed/fallback/legacy and on failure, with the documented counters"
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/bake/aquarelleBake.test.ts#261029-bks bake diagnostics"
        status: pass
    human_judgment: false
  - id: D4
    description: "The app helper forwards onDiagnostics, merges a finite adapterCreateMs, and disposes bake then adapter before the callback"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptApplyBake.test.ts#261029-bks"
        status: pass
    human_judgment: false
  - id: D5
    description: "script-bake and both lift-erase recovery flows carry diagnostics on success and failure"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#261029-bks threads the bake diagnostics into script-bake and lift-erase"
        status: pass
    human_judgment: false
  - id: D6
    description: "Native UAT: Apply on a long-gap script is visibly faster, the applied key is pixel-identical, and Lift erase is unchanged"
    verification: []
    human_judgment: true
    rationale: "Visible speed and visual identity on real recorded timelines cannot be asserted from vitest; they need the user's Studio session and the /tmp render-split artifact"

# Metrics
duration: 12min
completed: 2026-10-29
status: complete
---

# Quick 261029-bks: Watercolor Replay Optimisation Summary

**Recorded-timeline watercolor replay now skips idle-gap ticks with a clock-only advance once the engine reads asleep, and every Apply/Lift reports measured bake diagnostics — output bytes and the final virtual clock stay bit-identical.**

## Performance

- **Duration:** 12 min (executor resume 08:14:09 → final task commit 08:26:07; excludes the overnight pause before execution)
- **Started:** 2026-10-29T08:14:09+01:00
- **Completed:** 2026-10-29T08:26:07+01:00
- **Tasks:** 2 / 2
- **Files modified:** 8 (1 created, 7 modified; 1,131 insertions, 109 deletions)

The optimisation targets the dominant cost in a recorded script: artist pauses are preserved as wall-clock ticks, and a 435 s pause is ~26,100 simulated 60 Hz ticks whose only observable effect is advancing the virtual clock. On the synthetic long-gap fixture (`gapScript(1000)`) the bake now simulates 78 of 424 timeline ticks and skips 335 across 2 gaps — about 21% of the timeline still executing on the engine, with byte-identical captures. Actual saving on the user's recordings is the native UAT measurement, not claimed here.

## Accomplishments

- Added `skipTicks(fromTick, toTick)` to the aquarelle engine adapter: clock-only advance guarded by the exact `stepTick` early-return, one `advanceClock(1000 * HOST_DT)` per tick, no `engine.tick`, no render.
- Routed exactly three gap walks through a new `stepGap` inside `bakeProgressive` (pre-stroke, trailing-Dry pre-gap, window tail), with a mandatory boundary tick at the awake→asleep transition and per-gap invariants.
- Added `AquarelleBakeDiagnostics` / `onDiagnostics`, emitted exactly once per `bake()` from a `finally` on timed, fallback and legacy paths — including failed/cancelled bakes — and never throwing into the bake.
- Wired the app: the bake helper merges a measured `adapterCreateMs` (creation span + teardown span) and fires after both disposes; `applyAquarelleEventsToKey` passes it through; the Studio's `script-bake` and both Lift base-recovery `lift-erase` flows carry `diagnostics` on success and failure.
- Kept every existing package assertion intact: adapters without the seam step every tick and receive zero `isAwake` probes.

## Task Commits

Each task was committed atomically (code only — the docs artifacts are the orchestrator's):

1. **Task 1: package adapter seam + gap walk + diagnostics + parity tests** — `f574cba5` (perf)
2. **Task 2: app helper diagnostics + adapterCreateMs + render-split wiring + tests** — `27702a84` (perf)

Plan metadata (SUMMARY / STATE / ROADMAP) is intentionally left uncommitted by this executor.

## Files Created/Modified

- `packages/efx-watercolor/src/adapter/engineAdapter.ts` (+20) — `skipTicks` declaration and clock-only implementation.
- `packages/efx-watercolor/src/adapter/engineAdapter.test.ts` (+19) — seam presence and no-throw before/after dispose.
- `packages/efx-watercolor/src/bake/aquarelleBake.ts` (+394/−109) — `stepGap`, seam gate, counted steps, per-bake counters, once-per-bake diagnostics, encode timing.
- `packages/efx-watercolor/src/bake/aquarelleBake.test.ts` (+463) — skipping adapter double, 15 truth-table/parity/diagnostics rows.
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` (+59) — `AquarelleApplyDiagnostics`, `adapterCreateMs`, finally emission, pass-through.
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptApplyBake.test.ts` (new, 215) — mocked proof of forwarding, merge, failure emission, dispose-then-callback order, throwing consumer.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (+30/−16) — local diagnostics capture on the apply port and both Lift recovery bakes; added to the render-split records.
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` (+40) — static pin on the Studio wiring.

## Measured Evidence

| Gate | Command | Result |
|---|---|---|
| 1 | `pnpm --filter @efxlab/efx-watercolor run check` | clean |
| 2 | `pnpm --filter @efxlab/efx-watercolor run test` (vitest run) | 154 passed, 4 skipped (158) |
| 3 | `pnpm --filter @efxlab/efx-watercolor run build` | success (required before app gates — the app reads `dist`) |
| 4 | `pnpm --filter efx-motion-editor run typecheck` | clean |
| 5 | targeted 7 suites (apply-bake, controller, controller.bake, reveal-bake, registry-ownership, renderer, Studio) | 481 passed (7 files) |
| 6 | `pnpm --filter efx-motion-editor exec vitest run` (full app suite) | 351 passed \| 2 skipped (353 files); 6,247 passed \| 1 skipped \| 96 todo (6,344); exit 0 |

Cross-cutting checks:

- `grep -n 'stepGap(' packages/efx-watercolor/src/bake/aquarelleBake.ts` → 4 lines (1 `function` declaration + 3 calls).
- `grep -n 'adapter\.stepTick(' packages/efx-watercolor/src/bake/aquarelleBake.ts` → 1 line (inside the `countedStep` factory).
- `countedStep(diagnostics)` bindings → exactly 2 (`aquarelleBake.ts:420` in `bakeProgressive`, `:781` in `bake`).
- Test edits are purely additive: removed-line count is 0 in all three modified test files.
- No new dependency, no `packages/efx-paint-host` change, no `FIX_SETTLE_TICKS` / settle-cap change, no `useState` / signal / effect added (the Studio change is local-variable plumbing only).

## Decisions Made

- `skipTicks` keeps `stepTick`'s `disposed || !engine` guard before the first clock add; a clock add before the guard would desynchronise a disposed adapter from a no-skip run.
- The sleep transition costs exactly one boundary `stepTimeline` tick, then the remainder of the gap skips; this preserves the tick that flushes the sleeping render.
- `canSkip` requires both `skipTicks` and `isAwake`, and short-circuits before any probe — this is what keeps the pre-existing doubles' pinned tick counts valid without edits.
- The trailing-Dry pre-gap uses `stepGap(cursor, windowEnd)` then sets `cursor = windowEnd` before the untouched Dry applies, so the Dry ordering law is unchanged.
- Diagnostics emission lives in the bake's `finally`, with a swallowing catch around the consumer (T-bks-02), so observability can never fail a bake.
- `simulatedTicks` counts actual adapter `stepTick` calls through `countedStep`; sample ticks inside the adapter and the Dry drain are not counted. The pinned invariant is per gap (stepped + skipped === gap length), never a global two-term subtraction.
- `adapterCreateMs` is the create span plus the teardown span (`bake.dispose(); adapter.dispose();`), and the callback runs after both disposes — the cost of creation and teardown is measurable without contaminating bake time.
- The helper stores the bake record in a `{ current }` holder because a bare `let` assigned inside a callback is narrowed to `null` by TypeScript.

## Deviations from Plan

**No existing assertion was edited.** All three modified test files have zero removed lines. The following are adjustments to newly authored tests/implementation during RED→GREEN, all before the first commit:

1. **[New fixture]** Row (e1) of the idle-gap suite was given `withFix: true`, so the cook-to-sleep settle steps run at indices 0..71 and stay outside the gap's `[80, 125)` tick range. Without the fix seam the settle guard steps landed inside the filter and the row matched its own settle. Test fixture only — no implementation change.
2. **[Implementation shape]** `stepGap` was first written as a `const` arrow; gate 4 (`stepGap(` → 4 lines) required a `function` declaration to match the plan's count target. Same semantics.
3. **[Comments]** Two comments containing the literal `adapter.stepTick(` were reworded so the only grep match is the `countedStep` factory body (gate 5 target: 1 line).
4. **[New test typing]** The apply-bake test's `publish` mock needed a declared parameter plus a typed `published` array; `vi.fn(async () => true)` produced `[]` tuple calls (TS2493/TS2532) on the app typecheck.
5. **[New test slicing]** The Studio pin's `script-bake` slice originally started from the apply port, which ends before the record (the record sits inside the publish body); it now slices from the Studio source.
6. **[Process]** The plan frontmatter is `type: execute`, so the plan-level TDD gate does not apply. Task 1 captured genuine RED→GREEN. Task 2's mocked suite and Studio pin were authored alongside the wiring and did fail first on their own typecheck and pin-marker errors before passing; the wiring itself is verified by the targeted suites.

## Issues Encountered

- None blocking. Two environment facts shaped the gates: the app resolves the package's `dist`, so the package build must precede any app check; and vitest collects only `src/**/*.test.ts`, so the new app test is a `.test.ts` file.

## User Setup Required

Native UAT remains the user's (automated gates do not claim it):

1. Apply a watercolor script containing a long idle gap, then read `/tmp/efx-aquarelle-render-split.json`: `script-bake.diagnostics.skippedGapTicks` > 0 and close to the gap length; `simulatedTicks` a small fraction of `timelineTicks`; `path === 'timed'`; `adapterCreateMs` present and small. Report the saving as `simulatedTicks / timelineTicks`.
2. Compare `bakeFrame.digest` and `bakeInk` against a previous Apply of the same untouched script — both must be unchanged.
3. Perform one scripted Lift (or legacy-key base recovery) and read the `lift-erase` events: `diagnostics` present on both `base-recovery-ok` and `base-recovery-failed`.
4. Judge only what automation cannot: the applied key and the Lift erase look identical to before, and Apply on a long-gap script is visibly faster.

## Next Phase Readiness

- The render-split artifact now splits `bakeMs`, `encodeMs`, `adapterCreateMs`, `timelineTicks`, `simulatedTicks`, `skippedGapTicks`, `gapCount` and `settleTicks`, so any follow-up profiling can separate creation, simulation and encode costs without new instrumentation.
- The seam is capability-gated; adapters and test doubles without `skipTicks` keep the original tick law, so later bake work does not have to re-verify this optimisation.
- No "done" claim until the native UAT rows above pass.

## Self-Check: PASSED

- Created files exist: `261029-bks-SUMMARY.md`, `physicsPaintRotoPlayScriptApplyBake.test.ts`.
- Commits are ancestors of HEAD: `f574cba5`, `27702a84`.
- Measured commits from the plan ledger (`d7d43a8b..HEAD`): 2, matching the frontmatter.
