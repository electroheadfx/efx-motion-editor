---
phase: quick-261022-mvs
plan: 261022-mvs
subsystem: physic-paint
tags: [aquarelle, watercolor, bake, apply-progress, preact-signals, progress-pill, uat-approved]

# Dependency graph
requires:
  - quick: 261022-ljt
    provides: aquarelle Play per-frame commit progress (onCommit seam this plan leaves untouched)
provides:
  - AquarelleBakeOptions.onStrokeFed per-stroke progress seam with a single-frame host yield
  - Guarded aquarelle Apply progress publisher driving the shared Apply pill and `Applying k/N` status
affects: [physic-paint roto Apply, aquarelle Play Script, future aquarelle bake consumers]

actuals:
  tokens: 6590
  tasks: 2
  commits: 2
  plan_head_before: fa2d5781ea50d61b5d78b35c968628c599a07feb
  plan_head_after: 2bd6af0fe59994212b4dd2dfd51d0eb91efefb22

tech-stack:
  added: []
  patterns:
    - "Per-stroke progress callback inside the bake turn, Dry excluded"
    - "MessageChannel macrotask yield between strokes, only for frameCount: 1"
    - "Guarded progress publisher: settled/disposed/generation early returns plus numeric clamps"

key-files:
  created: []
  modified:
    - packages/efx-watercolor/src/bake/aquarelleBake.ts
    - packages/efx-watercolor/src/bake/aquarelleBake.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx

key-decisions:
  - "Progress denominator is the non-Dry stroke-event count in both the bake and the controller, so 0/N and k/N always agree"
  - "The host yield is gated on a listener existing AND frameSpan === 1 so Play and every other bake consumer keep their current scheduling"
  - "A non-finite completed count is ignored rather than written as 0 — the plan's behavior test requires an unchanged pill"

requirements-completed: [MVS-01, MVS-02]

coverage:
  - id: D1
    description: "Watercolor Apply shows the shared Apply pill at 0/N, advances k/N per fully fed stroke (Dry excluded), then clears and shows Applied"
    requirement: MVS-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts#261022 aquarelle Apply progress"
      - kind: unit
        ref: "packages/efx-watercolor/src/bake/aquarelleBake.test.ts#261022 per-stroke progress (Apply parity)"
    human_judgment: true
    rationale: "Unit tests cannot observe the WKWebView pill painting; the plan's live UAT rows 1-4 are the visible verdict."
  - id: D2
    description: "Enabling the progress listener changes neither the baked bytes nor the stepped tick sequence"
    requirement: MVS-01
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/bake/aquarelleBake.test.ts#yielding between strokes leaves the image and the tick sequence unchanged"
        status: pass
    human_judgment: false
  - id: D3
    description: "Late progress after dispose or launch replacement cannot move the pill or restore a status line; brush Apply and Play remain unchanged"
    requirement: MVS-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts#a late callback after launch replacement does not move progress"
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts#a late callback after dispose does not move progress or resurrect status"
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts#apply burst"
    human_judgment: true
    rationale: "Live rows 2-4 verify brush Apply, Play Script, and navigation/close behavior in the real Studio window."

duration: 6min
completed: 2026-10-22
status: complete
---

# Phase quick-261022-mvs: Watercolor Apply progress

**Watercolor Apply now drives the shared 0/N to N/N Apply pill per fully fed stroke, with a macrotask yield that leaves the baked pixels and tick sequence byte-identical**

## Performance

- **Duration:** 6 min
- **Started:** 2026-10-22T14:33:00Z
- **Completed:** 2026-10-22T14:39:22Z
- **Tasks:** 2
- **Files modified:** 6 (4 production, 2 test)

## Accomplishments

- `AquarelleBakeOptions.onStrokeFed` fires once per fully fed stroke during progressive replay, cumulative and Dry-excluded, in both the recorded-timeline and point-weight paths.
- A `MessageChannel` host yield between strokes (single-frame bakes only) lets the pill paint; a test pins identical committed bytes and `stepsByFrame` with and without a listener.
- The aquarelle Apply branch seeds `{ completed: 0, total: N }` and the exact brush-mode `Applying k/N` string, clamps over-counts, and clears the pill in a `finally`.
- Late callbacks after launch replacement or dispose are ignored by `progressSettled` / `disposed` / `disposalRequested` / `launchGeneration` guards; terminal status writes are suppressed after disposal.

## Task Commits

Each task was committed atomically:

1. **Task 1: Aquarelle bake reports per-stroke progress during progressive replay** - `81b92953` (feat)
2. **Task 2: Watercolor Apply drives the shared progress pill and status** - `2bd6af0f` (feat)

**Plan metadata:** orchestrator-owned docs commit (SUMMARY/PLAN/STATE not committed by the executor)

_Note: TDD tasks; RED evidence captured before each implementation (3 reporting tests and 4 aquarelle Apply tests failed against unchanged code)._

## Files Created/Modified

- `packages/efx-watercolor/src/bake/aquarelleBake.ts` — new `onStrokeFed` option, `yieldToHost`, per-stroke `reportFed` in both feed paths, async turn work.
- `packages/efx-watercolor/src/bake/aquarelleBake.test.ts` — new `261022 per-stroke progress (Apply parity)` block (4 cases).
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts` — `onProgress` port field, guarded progress publisher, `countAquarelleStrokeEvents`, guarded terminal writes, unconditional pill clear.
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts` — harness `overrides` parameter plus aquarelle fixtures and the `261022 aquarelle Apply progress` block (4 cases).
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` — forwards `onStrokeFed` into the bake; `frameCount: 1` unchanged.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — port binding destructures `onProgress` and forwards `onStrokeFed`.

## Decisions Made

- **Denominator = non-Dry stroke events** on both sides (controller and bake) so the seeded 0/N and the reported denominator agree; Dry stays a timeline action (D-15).
- **Yield only when a listener exists and `frameSpan === 1`** so Play's per-frame path and non-progressive bakes keep their exact scheduling.
- **Non-finite completed counts are ignored** (see Deviations).

## Deviations from Plan

### Plan-internal interpretation

**1. Non-finite completed count is ignored, not written as 0**
- **Found during:** Task 2
- **Issue:** The action text says "non-finite completed becomes 0", but the plan's own behavior test ("clamps an over-count and ignores a non-finite count") requires the pill to stay at `{ completed: 2, total: 2 }` after `onProgress(Number.NaN, 2)`. Writing 0 would fail that test.
- **Fix:** The publisher returns early on a non-finite completed value; totals that are non-positive or non-finite still fall back to the stroke count, and finite counts are truncated and clamped into `0..total`.
- **Files modified:** `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts`
- **Verification:** `261022 aquarelle Apply progress` suite passes (53/53).
- **Committed in:** `2bd6af0f`

**Total deviations:** 1 interpretation (plan text vs. its own acceptance test). No scope creep.

## Issues Encountered

- The app typecheck resolves `@efxlab/efx-watercolor` through the gitignored `dist/` build output, so the new option was invisible (`TS2353`) until `pnpm --filter @efxlab/efx-watercolor run build` regenerated `dist`. After the rebuild the typecheck error set is byte-identical to the 16-error baseline.
- `gsd_run` is not on PATH in this executor shell; the CLI was invoked via `.claude/gsd-core/bin/gsd_run`.

## Deferred Issues

Five app-suite failures are pre-existing and unrelated to this quick (none import the touched modules):

- `src/lib/exportEngine.test.ts` — `solo narrows the scan to the soloed visible track`
- `src/lib/paperPass.frameGuard.test.ts` — `P4(f)` looks for `getFlattenedFrameExcluding(` in the store source
- `src/efx-paint/compositor/efxPaintCompositorMatrix.test.ts` — matrix rows 8 and 9 (solo)
- `src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts` — pinned header label cell for every row

See [deferred-items.md](./deferred-items.md).

## User Setup Required

None — no external service configuration required.

## Live UAT Rows — PASSED (user-approved 2026-10-22)

The user ran the live gate in the Physic Paint Studio and approved it on 2026-10-22.

| # | Action | Expected | Observed | Status |
|---|--------|----------|----------|--------|
| 1 | Watercolor mode, copy a multi-stroke paint script, Apply it to another key | Pill appears at 0/N, advances k/N while the wash bakes, clears, then `Applied`; applied wash looks unchanged | User-approved | PASSED |
| 2 | Brush (engine-1) Apply | Progress behavior and result unchanged | User-approved | PASSED |
| 3 | Watercolor Play Script and brush Play Script | Progress and pixels unchanged | User-approved | PASSED |
| 4 | Navigate or close the Studio during a watercolor Apply | After returning, no Apply pill or `Applying` status from the old run | User-approved | PASSED |

## Next Phase Readiness

Closed: live UAT approved 2026-10-22 (Physic Paint Studio):
1. Watercolor Apply: pill advances 0/N → N/N, then `Applied`; wash unchanged.
2. Brush Apply progress and result unchanged.
3. Watercolor and brush Play Script unchanged.
4. Navigate/close mid-Apply: no stale pill or status on return.

`frameCount: 1`, the visible settle cap, paper setup, Dry ordering, the non-progressive bake path, Play, and brush Apply were not modified.

---
*Phase: quick-261022-mvs*
*Completed: 2026-10-22*

## Self-Check: PASSED

- All 6 modified files exist.
- Commits `81b92953` (Task 1) and `2bd6af0f` (Task 2) are ancestors of HEAD.
- SUMMARY self-check appended after verification.
