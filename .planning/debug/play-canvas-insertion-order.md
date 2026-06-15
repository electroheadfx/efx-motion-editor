---
status: investigating
trigger: "Phase 36.1 Play canvas insertion-order bug"
created: "2026-06-15"
updated: "2026-06-15"
---

# Debug Session: Play canvas insertion-order bug

## Symptoms

- Expected behavior: If existing Play canvas sequence is `C -> h -> l -> o -> e` and a new stroke `x` is painted between `l` and `o`, rendered Play animation should become `C -> h -> l -> x -> o -> e`.
- Actual behavior: Existing sequence renders as `h -> l -> o -> e -> C`. After adding `x` between `l` and `o`, it still renders `h -> l -> o -> e -> C`, with `x` animating in parallel around its painted frame instead of being inserted into the sequence.
- Error messages: No explicit error messages reported.
- Timeline: App was restarted after latest commits on main. Preview background issue is fixed; Play animation order remains wrong.
- Reproduction: On Play canvas, start with saved sequence `C -> h -> l -> o -> e`; paint/add `x` between `l` and `o`; render/play animation.

## Context

Recent commits on main:
- `1a92a29 fix(260615-iui): order play insertions by frame anchors`
- `57957da fix(260615-iui): insert play frame edits sequentially`
- `bbbb97e fix(260615-iui): isolate play brush preview background`
- `be8f6e8 fix(260615-iui): preserve play frame preview during brush edits`

Files likely involved:
- `packages/efx-physic-paint/src/animation/AnimationPlayer.ts`
- `packages/efx-physic-paint/src/animation/AnimationPlayer.test.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts`

Already attempted:
1. Preview fix:
   - `beginPlayFrameEdit` now uses current cached Play frame as temporary engine background.
   - Play preview/save reset the temporary background before rendering.
   - User confirmed preview works.
2. Scheduler fix attempt:
   - `AnimationPlayer.ts` now tries to reconstruct playback order using `playFrame` anchors and insert appended strokes.
   - Tests pass, but live app still renders saved sequence as `h -> l -> o -> e -> C`.
   - Therefore the test likely does not match real runtime stroke data, or wrong metadata/order reaches `AnimationPlayer`.

Hypotheses to investigate:
1. Existing saved strokes may have wrong/missing `playFrame` metadata before they reach `AnimationPlayer`.
2. `annotatePlayFrameStrokes()` may only annotate newly edited strokes and not normalize/reorder older saved strokes.
3. `engine.save()` / `engine.load()` may preserve raw `allActions` order where `C` is last, and `AnimationPlayer.getStrokes()` receives that order without enough reliable `playFrame` metadata.
4. `orderStrokesForPlayback()` in `AnimationPlayer.ts` may not correctly distinguish existing saved anchored sequence strokes from newly appended inserted strokes.
5. Runtime may use package source from `packages/efx-physic-paint/src`; confirm via app Vite aliases if needed.

Debug goal:
Find the actual stroke array passed into `AnimationPlayer.distributeStrokes()` during Play render:
- stroke order
- stroke color/id if visible
- each stroke’s `playFrame`
- each stroke’s timestamp/source index

Then fix scheduler or annotation path so actual runtime sequence becomes `C -> h -> l -> x -> o -> e`. Do not just make tests pass; live behavior must be corrected.

Verification constraints:
- Do not run the dev server; user runs it manually.
- Automated checks that previously passed: `AnimationPlayer.test.ts`, `PhysicsPaintStudio.test.ts`, app typecheck.
- Add/adjust tests so they reflect real failing runtime data shape, especially the case where existing saved sequence renders as `h -> l -> o -> e -> C`.

## Current Focus

- hypothesis: Actual runtime stroke data reaching `AnimationPlayer.distributeStrokes()` is ordered/annotated differently from current tests, likely preserving raw `allActions` order where `C` is last.
- test: Inspect runtime-relevant save/load/annotation path and reproduce the failing data shape in tests.
- expecting: Determine whether missing/wrong `playFrame` metadata or scheduler ordering logic causes `C` to move last and inserted `x` to animate in parallel.
- next_action: gather initial evidence
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- timestamp: 2026-06-15T00:00:00Z
  source: code inspection
  finding: `AnimationPlayer.play()` receives `engine.getStrokes()` in raw `allActions` order and only `orderStrokesForPlayback()` can correct playback order before frame distribution.
- timestamp: 2026-06-15T00:00:00Z
  source: code inspection
  finding: `EfxPaintEngine.save()` / `load()` preserve serialized stroke order and timestamps; no normalization occurs in the save/load path.
- timestamp: 2026-06-15T00:00:00Z
  source: code inspection
  finding: `annotatePlayFrameStrokes()` only annotates indices captured after the Play-frame edit baseline; it does not annotate or reorder older saved strokes.
- timestamp: 2026-06-15T00:00:00Z
  source: browser diagnostics
  finding: Runtime fresh Play strokes were saved in draw order with every stroke stamped `playFrame: 0`; scheduler treated `sourceIndex > playFrame` as insertion, so all strokes after `C` were moved ahead of `C`.
- timestamp: 2026-06-15T00:00:00Z
  source: user verification
  finding: After requiring `playFrame > 0` for insertion detection, fresh `chloe` rendered with `C` first.
- timestamp: 2026-06-15T00:00:00Z
  source: user verification
  finding: Inserted Play-frame edits then appended at the end until appended strokes were sorted by `playFrame` before timestamp during insertion scheduling; after that, `x` inserted between `l` and `o` correctly.

## Eliminated

- Runtime package alias mismatch was not needed to explain the bug; the app imports `@efxlab/efx-physic-paint/animation` and the faulty scheduling is in the package source under test.
- Save/load metadata loss was not the direct root cause for the reported existing sequence: even without `playFrame` metadata, saved strokes still carry timestamps that identify `C` as the earliest stroke.

## Resolution

- root_cause: Fresh Play recordings stamp each stroke with `playFrame: 0`; `orderStrokesForPlayback()` interpreted every later `sourceIndex > playFrame` as an insertion, moving `h/l/o/e` ahead of `C`. After that was fixed, inserted strokes still sorted by timestamp first, so `x` appended at the end instead of inserting at its target Play frame.
- fix: Treat `playFrame: 0` as normal fresh-recorded sequence data, only detect inserted edits for positive Play-frame anchors, and sort appended inserted edits by `playFrame` before timestamp.
- verification: `pnpm --filter @efxlab/efx-physic-paint test -- AnimationPlayer.test.ts`; `pnpm --filter efx-motion-editor typecheck`; user verified fresh `chloe` starts with `C` and inserted `x` lands between `l` and `o`.
- files_changed: `packages/efx-physic-paint/src/animation/AnimationPlayer.ts`, `packages/efx-physic-paint/src/animation/AnimationPlayer.test.ts`, `app/src/components/physic-paint/PhysicsPaintStudio.tsx`.
