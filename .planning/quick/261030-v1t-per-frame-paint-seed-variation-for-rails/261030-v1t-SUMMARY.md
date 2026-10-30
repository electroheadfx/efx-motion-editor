---
phase: 261030-v1t-per-frame-paint-seed
plan: 01
subsystem: physic-paint-roto
tags: [aquarelle, bake, determinism, paint-seed, replay-cost, tdd]

requires:
  - phase: 261029-bks
    provides: bake diagnostics (timelineTicks / simulatedTicks / bakeMs) and the skipTicks seam
provides:
  - mixStrokeSeed(strokeSeed, frame) — pure FNV-1a + avalanche per-frame paint salt from @efxlab/efx-paint-host
  - WatercolorEngine.resetSheet() — wipes pigment/water, keeps paper target and paperSeed
  - adapter seams setPaintSeedFrame(frame) / resetSheet() (optional EngineAdapter extensions)
  - "AquarelleBakeOptions.paintSeedVariation 'progressive' | 'static' + diagnostics.paintSeedReplays"
  - "Paint seed variation creation opt-in: dialog card -> controller signal -> Play bake + reveal bake -> Loop Clip flag (canonical fingerprint untouched) -> replay/regenerate/source-edit/link matcher"
  - deterministic cost evidence — 6-frame Motion: OFF 338, progressive 592 (1.75x), static 2028 (6.00x)
affects: [rail-creation-dialog, paint-seed-variation, reveal-rail, play-script, loop-clips]

actuals:
  # chars/4 over the realized plan diff (plan head → final head), same scale as
  # the plan's 110000 estimate.
  tokens: 30017
  tasks: 3
  commits: 6
  plan_head_before: f86a850279e5956e5de1f12b520a588ebb971e6a
  plan_head_after: cfc7b3eabdbdc4f7ceea45dc773e79f36f1f6943

tech-stack:
  added: []
  patterns:
    - "Per-frame paint variety = ONE deterministic replay per output frame; the cumulative sheet is never re-rolled in place"
    - "The salt is a pure mix of the existing traceSeed and the output frame — no persisted salted seed, no unseeded RNG"
    - "One window table is the single tick law shared by the OFF walk and every ON replay; the untouched OFF byte pins prove it did not move"

key-files:
  created:
    - packages/efx-paint-host/src/util/traceSeed.test.ts
  modified:
    - packages/efx-paint-host/src/util/traceSeed.ts
    - packages/efx-paint-host/src/index.ts
    - packages/efx-watercolor/src/playground/Engine.ts
    - packages/efx-watercolor/src/adapter/engineAdapter.ts
    - packages/efx-watercolor/src/adapter/engineAdapter.test.ts
    - packages/efx-watercolor/src/determinismContract.test.ts
    - packages/efx-watercolor/src/bake/aquarelleBake.ts
    - packages/efx-watercolor/src/bake/aquarelleBake.test.ts

key-decisions:
  - "Cost is measured in bake stepTicks on a tick-counting fake WITHOUT the skip seam — a conservative progressive figure (1.75x); static is exactly frameCount x OFF (6.00x)"
  - "Missing setPaintSeedFrame/resetSheet fails closed before any frame — never a deposit-time-only salt fallback (T-03)"
  - "resetSheet keeps paperSeed and the paper target; only pigment/water, the stroke/feed state and the adapter clock are re-armed"
  - "The prefix-law test subtracts adapter-advanced sample ticks: fed samples tick inside renderPartialStrokes and never appear in simulatedTicks (261029-bks counter law)"

duration: 21min
completed: 2026-10-30
status: complete
---

# Quick 261030-v1t (Plan 01): Per-frame paint seed variation — package layer + cost gate

**Pure per-frame paint salt and a reusable-sheet replay bake mode in the packages, with the OFF path byte-identical and the per-frame replay cost measured deterministically for the blocking cost gate.**

## CHECKPOINT DECISION — Option A accepted (blocking-human, resolved)

The human reviewed the measured cost at the blocking decision checkpoint and chose **Option A — cost accepted**. Task 3 (app wiring) proceeded on that decision and is complete: dialog card, controller/regenerate/source-edit/reveal flag, loop-clip persistence + canonical exclusion, rail copy, ON-only diagnostics log, and the app typecheck.

### Deterministic measurement line (printed by the Task 2 test, identical on re-run)

```
[261030-v1t] paint seed variation cost — 6-frame Motion: replays=6 OFF simulatedTicks=338 ON(progressive) simulatedTicks=592 ratio=1.75x ON(static) simulatedTicks=2028 ratio=6.00x | Static (1 frame/settled drawing): replays=6 simulatedTicks=2028 ratio=6.00x
```

- Representative script: three timed strokes (12 / 10 / 8 points, wall-clock 1000 / 2000 / 3000 ms) baked to 6 output frames.
- OFF: 338 bake stepTicks = 296 timeline ticks − 30 adapter-advanced sample ticks + 72 settle.
- ON progressive: 6 replays (one per output frame, windows 0..j each) = 592 ticks, 1.75x OFF.
- ON static: 6 full replays (each held frame is a complete settled drawing) = 2028 = exactly 6 × OFF, 6.00x.
- Measured on a tick-counting fake adapter WITHOUT the skip seam, so every idle-gap tick is simulated. The real adapter has the skip seam, which can only lower the progressive figure; static stays frameCount × FULL replay.

### Projection (grounded in code)

- No live OFF `bakeMs` values are recorded anywhere in the repo, so wall time is projected as a multiplier on the current live OFF bake of the same span:
  - **Static ON ≈ frameCount × current OFF bake wall time** (the tick count is exactly frameCount × OFF).
  - **Progressive ON ≈ 1.75 × current OFF bake wall time** for gap-heavy Motion scripts (idle gaps dominate); denser scripts with more samples per window approach the static bound.
- Encode/capture counts are unchanged (`frameCount` encodes either way); the extra cost is simulation only.
- The live numbers are produced by Task 3's ON-only diagnostics log (`bakeMs`, `simulatedTicks`, `paintSeedReplays`); the diagnostics seam already exposes them, the app-side log line is part of Task 3.

### Options

- **A — Cost accepted:** proceed to Task 3 app wiring and live measurement. ON bakes take on the order of frameCount times longer for static, ~2x for progressive; live bakeMs is logged during UAT.
- **B — Cost rejected:** STOP here. The packages revert to OFF-only behavior (the ON branch simply never runs); the feature is not deliverable under the cumulative-sheet model without a different design.

### What is committed / what remains

- Committed: Task 1 (RED + GREEN), Task 2 (RED + GREEN), and Task 3 (RED + GREEN) — 6 commits.
- Remaining at this writing: the live native UAT rows for the ON path (dialog toggling per rail variant, ON bake wall time read from the ON-only diagnostics log line). Nothing else is outstanding in code.

## Performance

- **Duration:** 21 min (Task 1–2: 9 min through the checkpoint; Task 3: ~12 min)
- **Started:** 2026-10-30T21:32:34Z (plan commit)
- **Checkpoint reached:** 2026-10-30T21:41:41Z
- **Task 3 completed:** 2026-10-30T21:53:50Z
- **Tasks completed:** 3 of 3
- **Files modified:** 24 (23 modified + 1 created)
- **Commits:** 6

## Accomplishments

- `mixStrokeSeed(strokeSeed, frame)` exported from the host: pure FNV-1a + avalanche mix, pinned literal, zero Math.random/clock/crypto (source-scan gate covers the new file).
- `WatercolorEngine.resetSheet()` and the adapter's `setPaintSeedFrame`/`resetSheet` seams: a from-scratch replay starts on identical paper (paperSeed untouched, paper target kept) with the virtual clock and feed state re-armed.
- `bakeProgressive` gained `paintSeedVariation: 'progressive' | 'static'`: one salted from-scratch replay per output frame through ONE shared window table; missing seams fail closed before any frame; OFF path and all 46 pre-existing bake pins unchanged.
- Honest diagnostics: `paintSeedReplays` plus re-walk accounting in `timelineTicks`; the prefix law is pinned numerically (640 timeline − 120 sample ticks + 72 settle = 592).
- App wiring (Task 3): one "Paint seed variation" creation opt-in threads from the dialog card through the controller signal, the Play bake (both modes), the reveal renderer, both stores (create + replay), the Loop Clip persistence allowlist (fail-closed boolean, canonical fingerprint untouched), and the rail set copy. ON logs one cost line (`replays / bake ms / encode ms / simulatedTicks`); OFF is byte-identical.
- Task 3 gate: 475 tests across the eight listed suites pass, and `pnpm --filter efx-motion-editor run typecheck` is clean.

## Task Commits

1. **Task 1 RED: failing pins for the per-frame paint salt** — `7f187f6` (test)
2. **Task 1 GREEN: pure seed mix + reusable sheet** — `0a311bd` (feat)
3. **Task 2 RED: pin the per-frame paint-seed replay law** — `0ecf032` (test)
4. **Task 2 GREEN: replay the bake per output frame under a paint seed** — `03c3ab0` (feat)
5. **Task 3 RED: pin the app wiring across every layer** — `e878e74` (test)
6. **Task 3 GREEN: wire creation, bake, and persistence** — `cfc7b3e` (feat)

_No plan-metadata commit: the orchestrator owns the `.planning/` commit for quick tasks._

## Files Created/Modified

- `packages/efx-paint-host/src/util/traceSeed.ts` — `mixStrokeSeed` (FNV-1a + avalanche over base/frame)
- `packages/efx-paint-host/src/util/traceSeed.test.ts` — purity, distinctness, pinned literal, totality, no-RNG gates
- `packages/efx-paint-host/src/index.ts` — export `mixStrokeSeed`
- `packages/efx-watercolor/src/playground/Engine.ts` — `resetSheet()` (paper kept, state wiped)
- `packages/efx-watercolor/src/adapter/engineAdapter.ts` — salt + both seams; `configure()` mixes the salt
- `packages/efx-watercolor/src/adapter/engineAdapter.test.ts` — seam totality/salt-source pin + GPU-gated paper/salt byte cases
- `packages/efx-watercolor/src/determinismContract.test.ts` — host seed module source scan + pinned mix
- `packages/efx-watercolor/src/bake/aquarelleBake.ts` — option, ON replay branch, window table, walkWindow/applySettle extraction, diagnostics
- `packages/efx-watercolor/src/bake/aquarelleBake.test.ts` — 9 new tests incl. the deterministic cost line

### Task 3 (app wiring)

- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` — optional `paintSeedVariation` on `PhysicPaintRotoLoopClip`, fail-closed allowlist + boolean validator, verbatim normalization; deliberately EXCLUDED from `encodeCanonicalLoopClips`
- `app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts` — duplicated rails keep the flag verbatim
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` — dialog signal + compare-then-write setter, reset on every open, matcher flag, Regenerate `storedSettings`, legacy Source Edit resolution, ON bake options + cost log, per-j static wash selection/decode, new-clip and link writes, reveal passthrough, `zeroDiagnostics` field
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts` — reveal input flag, frameCount, static guard, per-frame wash selection
- `app/src/stores/efxPaintStore.ts` — `createRevealRail` resolves once and writes the reveal clip only when on; `replayRevealRail` forwards the persisted flag
- `app/src/stores/physicPaintStore.ts` — `RevealBakeInput` field + `commitRevealBake` forwarding
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` — "Paint seed variation" card, both tab side-stacks, apply mode only
- Tests: `physicsPaintRotoLoopClips.test.ts`, `physicsPaintRotoRailSetCopy.test.ts`, `physicsPaintRotoPlayScriptController.test.ts`, `physicsPaintRotoPlayScriptController.bake.test.ts`, `physicsPaintRotoPlayScriptRenderer.test.ts`, `physicsPaintRotoRevealBake.test.ts`, `PhysicsPaintPlayScriptDialog.test.ts`, `efxPaintStore.reveal.test.ts`

## Decisions Made

- The per-frame salt is mixed inside `configure()`; a `null` salt reproduces today's exact RNG stream (`seededRandom(traceSeed || 1)`).
- `resetSheet()` deliberately does not re-roll `paperSeed` or redraw the paper — the sheet and its grain are the constant across replays.
- The static replay law guards the trailing Dry on the frame SPAN (not the replay span) so a static replay re-fires it at the same position every time.
- `onStrokeFed` reports only during the final replay (monotonic, never exceeds the total).
- Task 3: the flag is resolved ONCE at confirm (`renderPaintSeedVariation`) — Regenerate restores the frozen Group fact, legacy Source Edit uses the edit target's persisted flag, Apply uses the dialog draft — so the bake and the persisted clip can never disagree.
- Task 3: `paintSeedVariation` stays OUT of the canonical fingerprint (creation-only, like `colorize`/`photoWiggle`/`keyScriptEdits`); every write accompanies a re-bake that moves the key bytes. No Rust change.
- Task 3: OFF static keeps the shared single decode; ON decodes and closes each frame's own bitmap (the reused path is byte-identical to before).

## Deviations from Plan

**1. [Rule 2 - Missing critical functionality] The flag is written on the Link-to-existing-cycle branch too.**
- **Found during:** Task 3, controller wiring.
- **Issue:** The plan lists the new-loop branch (`!isSourceEdit && loopIntentActive`) as the only clip write. The link branch is the default whenever an identical cycle exists, and the linked clip is a NEW record; omitting the flag would make a later Regenerate / Source Edit of that rail re-bake OFF pixels — silently undoing the texture the dialog promised (violates must_have five). The `keyScriptEdits` precedent already writes on both branches.
- **Fix:** Added `...(renderPaintSeedVariation ? { paintSeedVariation: true as const } : {})` to the link branch. Legacy Source Edit / Regenerate / Repair spread `...clip`, preserving the existing member; the resolved flag drives only the bake.
- **Files modified:** `physicsPaintRotoPlayScriptController.ts`
- **Commit:** `cfc7b3e`

No other production work outside the plan. (The Task 2 test law was sharpened; see Issues Encountered.)

## Issues Encountered

**1. Prefix-law test expected 712, measured 592 — the test's law was wrong, not the bake.**
`simulatedTicks` counts bake `stepTick` calls only; each fed sample ticks inside `renderPartialStrokes` (the 261029-bks counter law). A replay's step total is therefore `prefixBudget − samplesFedInThatReplay`. Measured window budgets `[6,6,56,58,6,164]` (prefix 640), samples per replay `[6,12,18,24,30,30]` (sum 120), plus one 72-tick settle → 592. The test now asserts `timelineTicks === Σ prefix` and `simulatedTicks === Σ(prefix − samples) + settle`; the implementation was unchanged.

**2. Determinism source scan flagged doc-comment prose.** The host seed module names `Math.random` in its documentation; the scan strips comments before matching so prose cannot trip (or mask) the gate.

**3. GPU-gated byte cases skip without WebGL2 by design** (`describe.skipIf(!gpu)`); the non-skippable gate is the deterministic mix pin, per the plan.

## Known Stubs

None.

## Threat Flags

None — the executed tasks implemented T-quick-261030-v1t-03 (fail-closed ON branch + blocking cost gate) and T-quick-261030-v1t-04 (pure salt, pinned literal, no persisted salted seed). No new surface beyond the plan's threat model.

## Next Phase Readiness

- `zeroDiagnostics()` now carries `paintSeedReplays: 0`; the app typecheck is clean.
- The ON-only diagnostics line is the live measurement the UAT reads: one `Paint seed variation · N replays · bake X ms · encode Y ms · Z simulated ticks` log per ON bake.
- The plan's `<automated>` gate (the eight app suites + `typecheck`) passes; the remaining closure evidence is the live native UAT rows for the ON path (dialog toggling per rail variant; ON bake wall time from the log line).

---
*Quick: 261030-v1t — per-frame paint seed variation for rails*
*Checkpoint resolved (Option A accepted); Task 3 complete: 2026-10-30*

## Self-Check: PASSED

- All 24 files created/modified in this plan exist on disk.
- Commits `7f187f61`, `0a311bd1`, `0ecf0327`, `03c3ab07`, `e878e74d`, `cfc7b3ea` are ancestors of HEAD.
- Task 3 gate: 8 suites / 475 tests pass; app typecheck clean.
- Suites: watercolor 176 passed / 8 skipped (GPU-gated), host traceSeed 7/7; both package builds succeed.
- SUMMARY intentionally left uncommitted (orchestrator owns `.planning/` commits).
