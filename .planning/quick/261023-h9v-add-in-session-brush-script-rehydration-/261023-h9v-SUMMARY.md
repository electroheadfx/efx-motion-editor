---
phase: quick-261023-h9v
plan: 261023-h9v
subsystem: physic-paint
tags: [preact-signals, brush-script, navigation, rehydration, move-overlay, dev-probe, budget]
requires:
  - quick 261023-g4p
    provides: per-frame brush script store, completion listener, shared Move/script-edition seam
  - quick 261023-f9c
    provides: DEV script-memory probe and snapshot builder
provides:
  - complete/partial per-frame brush script bookkeeping with sticky completeness
  - pure fail-closed hydration policy with measured restore budget
  - silent engine baseline restore preserving stored mutationIds without undo history
  - liveness-gated Move listing (no dead outlines) and undo/redo script freshness
  - DEV probe complete/hydratable rows and complete/partial totals
affects: [physic-paint navigation, brush Move surface, DEV script-memory probe]
actuals:
  tokens: 26564
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns:
    - "Completeness is sticky per captured frame; only an explicit clear forgets arrival-base knowledge"
    - "Silent baseline restore mirrors loadProjectData: same mutationIds, no notification, no history"
    - "Fail-closed navigation policy: every refusal keeps the cached-pixel path"
    - "Probe hydratable verdict derives from the same budget constants as the live gate"
key-files:
  created:
    - app/src/components/physic-paint/view/brushScriptHydration.ts
    - app/src/components/physic-paint/view/brushScriptHydration.test.ts
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.restoreBaseline.test.ts
  modified:
    - app/src/components/physic-paint/view/brushScriptRecordState.ts
    - app/src/components/physic-paint/view/brushScriptRecordState.test.ts
    - app/src/components/physic-paint/view/brushScriptEditionPort.ts
    - app/src/components/physic-paint/view/brushScriptEditionPort.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/performance/scriptMemorySnapshot.ts
    - app/src/components/physic-paint/performance/scriptMemorySnapshot.test.ts
    - app/src/components/physic-paint/performance/scriptMemoryProbe.ts
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
key-decisions:
  - "Only complete entries hydrate; completion is sticky and explicit clear wipes arrival-base knowledge"
  - "engine.clear()'s 'clear' notification never writes the store; only explicit clear/prune/track-switch/dispose drop entries"
  - "Hydration runs only on a real-key arrival in Brush mode, idle (no playback/scrub), within the measured budget"
  - "Budget is measured, not byte-based: 600 points / 10 strokes / 0 diffusion frames at 1920x1080"
  - "A stroke-count ceiling is required because per-stroke full-frame replay cost dominates points"
patterns-established:
  - "Observed reference loader records every arrival base before the cached-pixel fallback"
  - "Probe hydratable = complete AND within budget, using the live policy constants"
requirements-completed: []
duration: 12min
completed: 2026-10-23
status: complete
commits: 3
plan_head_before: 986ad9788a824b6fa8b9b4cdcd95bc571d6c1d93
plan_head_after: 62bdaea42f20f1746b1671682aba602520b21d7f
---

# Quick 261023-h9v: In-session Brush Script Rehydration Summary

**Complete brush keys now round-trip silently through store -> navigation -> engine with preserved mutationIds and a live Move overlay, while partial, physics-diffusion and over-budget frames keep the cached-pixel path.**

## Performance

- **Duration:** 12 min (first to last task commit)
- **Started:** 2026-10-23T11:22:25Z
- **Completed:** 2026-10-23T11:34:03Z
- **Tasks:** 3
- **Files modified:** 13 (10 modified, 3 created)

## Accomplishments

- A brush key painted in the current Studio session is flushed on leave, silently restored on return, and listed/edited by the Move surface with no cached pixel base painted under it (no double paint).
- Completeness is explicit and sticky per frame: a cached-base arrival makes every capture of that frame partial; only an explicit user clear forgets the arrival base.
- `engine.clear()` no longer destroys the retained script. Its `'clear'` completion notification is ignored by the listener; only explicit clear, physical prune, launch/dispose reset, or active-track switch drop entries.
- Undo/redo refresh the retained script and overlay promptly, including the engine's deferred-undo path that emits no completed-mutation notification.
- The Move listing and hit-test are liveness-gated on engine-held mutationIds, so stale/partial entries never render dead outlines while live partial entries still edit in-visit.
- The DEV probe reports `complete`/`hydratable` per brush row and `completeFrames`/`partialFrames` totals, using the same budget constants as the live gate.

## The Completeness / Navigation Law as Implemented

1. **Capture** (`brushScriptRecordState.ts`) stores one frozen, ordered group list per frame. Entry completeness defaults to "no cached base arrived for this frame this session"; once captured partial, later captures keep the partial flag. Continuation diffusion counts are summed with the engine's 600-frame cap.
2. **Arrival observation** (`PhysicsPaintStudio.tsx`): one observed loader wraps every cached-pixel arrival seam (navigation fallback, frame-change reference effect, engine-ready load, display-state reload, display-port restore) and records `hadBase` when the loader painted bytes or a cached display frame exists.
3. **Navigation** flushes the outgoing frame, calls `engine.clear()`, then attempts hydration with `{frame, destinationKind, brushModuleActive, wasPlaying, scrubActive}`. On refusal it runs the observed loader, preserving today's behavior.
4. **Policy** (`brushScriptHydration.ts`) refuses, in order: no entry, empty projection, partial, non-real destination, watercolor, playback, scrub, budget. Only then does it call `restoreStrokesBaseline`.
5. **Silent restore** (`EfxPaintEngine.restoreStrokesBaseline`): validates the whole list first, clones/freezes points, keeps stored primary mutationIds, restores continuations as zero-point diffusion records, reseeds paint order and serials, defensively advances `nextMutationId`, clears undo/redo/history, marks the composite dirty, redraws synchronously, and emits no completed mutation.
6. **Liveness** (`engineHoldsBrushScriptFrame`) requires every stored primary mutationId in the engine's serial map; listing/hit-test return empty otherwise. The frame-change reference effect returns early for a hydrated baseline, so cached pixels never clobber it.
7. **Completion law** (`applyCompletedBrushMutation`): `clear` never writes the store; paint/move/erase/physics only mark the frame dirty; undo/redo flush from the engine. The Studio wraps controller undo/redo so the deferred path also refreshes.

## Task Commits

Each task was committed atomically (code only; planning docs left uncommitted for the orchestrator):

1. **Task 1: End-to-end rehydration** - `de9b37d8` (feat)
2. **Task 2: Arrival seams, clobber guards, undo/redo freshness, track reset** - `acb4c0d4` (refactor)
3. **Task 3: Probe completeness, measured restore cost, SUMMARY** - `62bdaea4` (feat)

**Plan metadata:** not committed (explicit task constraint: the orchestrator commits `.planning/` docs).

## Measured Restore Cost

Measured 2026-10-23 through the engine suite's mock-canvas harness driving the real `redrawAll` (mock `renderPaintStroke` deposition; real engine ledger, saved-wet scan, drying and fluid steps). Timings are synchronous wall-clock; point fixtures at 100x100 are the median of 3 after warmup, HD point fixtures and single-diffusion-frame results are single timed restores on a fresh engine.

| Fixture | Strokes | Points | Diffusion frames | Surface | Restore |
|---|---|---|---|---|---|
| light 10x60 | 10 | 600 | 0 | 1920x1080 | 233.3 ms |
| typical 25x90 | 25 | 2250 | 0 | 1920x1080 | 601.2 ms |
| heavy 40x180 | 40 | 7200 | 0 | 1920x1080 | 1101.7 ms |
| ceiling 40x600 | 40 | 24000 | 0 | 1920x1080 | 1492.2 ms |
| light 10x60 | 10 | 600 | 0 | 100x100 | 10.0 ms |
| typical 25x90 | 25 | 2250 | 0 | 100x100 | 31.2 ms |
| heavy 40x180 | 40 | 7200 | 0 | 100x100 | 59.2 ms |
| ceiling 40x600 | 40 | 24000 | 0 | 100x100 | 96.0 ms |
| point ceiling | 40 | 24000 | 0 | 800x600 | 591.4 ms |
| fixed-cost probe | 10 | 10 | 0 | 1920x1080 | 177.7 ms |
| fixed-cost probe | 20 | 20 | 0 | 1920x1080 | 344.2 ms |
| fixed-cost probe | 5 | 300 | 0 | 1920x1080 | 106.3 ms |
| 1 diffusion frame | 1 | 60 | 1 | 100x100 | 21.1 ms |
| 1 diffusion frame | 1 | 60 | 1 | 800x600 | 250.1 ms |
| 1 diffusion frame | 1 | 60 | 1 | 1280x720 | 331.3 ms |
| 1 diffusion frame | 1 | 60 | 1 | 1920x1080 | 705.4 ms |
| 300 diffusion frames | 10 | 600 | 300 | 100x100 | 1296.5 ms |
| 300 diffusion frames | 10 | 600 | 300 | 800x600 | 61048.1 ms |

Findings:
- Point replay cost is dominated by a **per-stroke fixed cost of ~17.5 ms at 1920x1080** (the full-frame saved-wet accumulation scan inside `applyStrokeToEngine`), plus ~0.04 ms per extra point. A points-only cap cannot bound the cost (600 strokes x 1 point would pass a 600-point cap but take seconds).
- **Diffusion replay is unaffordable for navigation**: one frame already costs 705 ms at 1920x1080, and 300 frames cost 61 s at 800x600. Physics-run frames therefore never hydrate.
- The provisional g4p byte basis (24000 points ~= 2.3 MB) did not predict replay time and was replaced by the measured basis.

## Final Budget Constants

`app/src/components/physic-paint/view/brushScriptHydration.ts`:

- `MAX_HYDRATION_POINTS = 600`
- `MAX_HYDRATION_STROKES = 10` (added; see Deviations)
- `MAX_HYDRATION_DIFFUSION_FRAMES = 0`

Worst allowed restore is the 10x60 light fixture: ~200-233 ms measured at 1920x1080 (largest supported working canvas), under the ~250 ms target. Over-budget frames fail closed to cached pixels and are reported `hydratable=false` in the probe; there is no silent partial hydrate.

## Verification Results

- **Task 3 app suites:** `scriptMemorySnapshot.test.ts` (17), `brushScriptRecordState.test.ts` (26), `brushScriptHydration.test.ts` (23), `brushScriptEditionPort.test.ts` (15), `PhysicsPaintStudio.test.ts` (227) — **5 files, 308 tests passed** (Task 1 suites re-run after the budget change).
- **Engine contract:** `EfxPaintEngine.restoreBaseline.test.ts` — 11 tests passed.
- **Engine regressions:** `moveTranslate` (19), `erasePointerDelete` (15), `strokeReorder` (17) — **62 tests passed**.
- **Package build:** `pnpm --filter @efxlab/efx-physic-paint build` — ESM + DTS build success.
- **Typecheck:** `pnpm --filter efx-motion-editor run typecheck` reports the documented pre-existing baseline exactly — 15 errors in 6 untouched files (`PaperPicker.tsx`, `physicPaintBridge.ts`, `usePhysicsPaintEngineActions.test.ts`, `physicsPaintRotoBackgroundValidatorParity.test.ts`, `PhysicsPaintPalette.test.ts`, `projectPaperRaster.test.ts`). **Zero errors in files touched by this plan.**
- The temporary restore-cost measurement file was deleted before committing; it is not part of the suite.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added a stroke-count budget constant**
- **Found during:** Task 3 (measured restore cost)
- **Issue:** The planned points/diffusion ceilings did not bound replay cost. The measured per-stroke fixed cost is ~17.5 ms at 1920x1080, so a frame with many short strokes passes a points-only cap yet blocks for seconds (DoS surface T-261023-h9v-02).
- **Fix:** Added `MAX_HYDRATION_STROKES = 10`, checked by `isWithinBrushHydrationBudget` and the probe's `isBrushScriptFrameHydratable`, with a dedicated refusal test and boundary test.
- **Files modified:** `app/src/components/physic-paint/view/brushScriptHydration.ts`, `brushScriptHydration.test.ts`, `scriptMemorySnapshot.ts`, `scriptMemorySnapshot.test.ts`
- **Verification:** All policy and snapshot suites pass; the gate refuses 11 strokes even with 11 total points.
- **Committed in:** `62bdaea4` (Task 3 commit)

**2. [Rule 2 - Threat mitigation] Lowered the provisional budget constants from measurements**
- **Found during:** Task 3 (measured restore cost)
- **Issue:** Provisional `MAX_HYDRATION_POINTS = 24000` / `MAX_HYDRATION_DIFFUSION_FRAMES = 300` allowed 1.5 s point restores and 61 s diffusion restores at realistic canvas sizes.
- **Fix:** Tuned to 600 points / 10 strokes / 0 diffusion frames so the worst allowed restore stays under ~250 ms at 1920x1080; documented the measured basis in the module header. Over-budget frames fall back to cached pixels and report `hydratable=false`.
- **Files modified:** `app/src/components/physic-paint/view/brushScriptHydration.ts`
- **Verification:** Policy boundary/refusal tests, snapshot hydratability tests, and every Task 1 suite pass after the change.
- **Committed in:** `62bdaea4` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 missing-critical/security).
**Impact on plan:** Both are required for the threat-model DoS mitigation and the "measured budget" task instruction. No architecture, schema, persistence, or dependency change. The feature is deliberately limited to light frames (<=10 strokes, <=600 points, no diffusion) on HD canvases; heavier frames remain view-only on return.

## Issues Encountered

- Diffusion replay cost was far higher than the provisional cap assumed (705 ms for a single frame at 1920x1080). Resolved by setting the diffusion ceiling to zero: physics-run frames keep cached pixels, which is visible in the probe as `hydratable=false`.
- Point replay cost scales with the number of strokes because each replayed stroke runs a full-frame saved-wet scan; documented and gated with the stroke ceiling.

## Known Stubs

None. No placeholder values, TODO/FIXME markers, or unwired data sources were introduced.

## Threat Flags

None beyond the plan's threat model. T-261023-h9v-01 (tampering) is covered by whole-list validation before mutation in `restoreStrokesBaseline`; T-261023-h9v-02 (DoS) is covered by the measured strokes/points/diffusion ceilings; T-261023-h9v-03 (DEV probe) keeps the existing DEV guard.

## User Setup Required

None.

## Live UAT (all PENDING — the user runs the app; none may be marked passed by the executor)

| # | Row | Status |
|---|-----|--------|
| 1 | Paint on brush keys A and B; navigate away and back: each key shows its strokes exactly once, and Move lists them with outlines/badges (complete hydration, no double paint). | PENDING |
| 2 | On a key with pre-existing cached paint, brush an extra stroke; navigate away and back: cached pixels show once and Move lists nothing for that key (partial, view-only). | PENDING |
| 3 | Hydrate a key, enter Move, press Undo: the stroke disappears from canvas and overlay; Redo restores both. | PENDING |
| 4 | During playback and during a ruler scrub, no brush script appears; the release settle on a complete key rehydrates it editable. | PENDING |
| 5 | Navigate to a generated/interpolated frame: pixels only, no script; navigate to the real key: script hydrates. | PENDING |
| 6 | Clear a hydrated key with the Clear action: canvas blank, probe entry gone, return stays blank (no resurrection). | PENDING |
| 7 | Switch active track at the same frame: no previous-track outlines or strokes; store resets; returning to the old track shows cached pixels until repainted. | PENDING |
| 8 | Watercolor paint/select/move/undo behavior is unchanged. | PENDING |
| 9 | A heavy painted frame restores synchronously within the documented budget; if the frame exceeds the budget, it shows cached pixels and the probe reports hydratable=false (documented fallback, no silent corruption). | PENDING |
| 10 | DEV probe `window.__EFX_SCRIPT_MEMORY__.snapshot()` shows brush rows with complete/hydratable matching what Move lists. | PENDING |

## Next Phase Readiness

- In-session re-entry editing works for light complete frames; heavy and physics-diffusion frames intentionally fall back to cached pixels.
- Live UAT is the only remaining gate; no app run or server start was performed here.
- No persistence/package/schema change: stored scripts remain session-only, so relaunch behavior is unchanged.

## Self-Check: PASSED

- Created files exist: SUMMARY, `brushScriptHydration.ts`, `brushScriptHydration.test.ts`, `EfxPaintEngine.restoreBaseline.test.ts`.
- Task commits exist and are ancestors of HEAD: `de9b37d8`, `acb4c0d4`, `62bdaea4`.
