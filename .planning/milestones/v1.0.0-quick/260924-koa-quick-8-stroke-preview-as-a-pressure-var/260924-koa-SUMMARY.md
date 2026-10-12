---
phase: quick-260924-koa
plan: 260924-koa
status: complete
subsystem: physics-paint-render
tags: [physic-paint, stroke-preview, ribbon, canvas-2d, pressure, tdd, red-green]

# Dependency graph
requires: []
provides:
  - "Filled, pressure-varying live stroke preview ribbon (single fill, no stroke()/setLineDash() on the preview path)"
  - "Queued strokes render as their own sized ribbons via drawQueuedStrokePolyline(ctx, points, style)"
  - "drawDashedPath and PreviewPathPoint/pathX/pathY helpers removed from packages/efx-physic-paint/src"
affects: [native-UAT-260924-koa]

# Actuals (#2632)
actuals:
  tokens: 4368        # 17470 diff chars / 4 over f92254f7..d6883fc3
  tasks: 3
  commits: 4
  plan_head_before: f92254f78c4e761ca72dce1c196435c658d88b13

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared fillRibbonPolygon + buildPreviewRibbon pipeline for live and queued previews (same shape family)"
    - "Recording CanvasRenderingContext2D mock (fills[]/strokes[]/dashes[]/events[]) for canvas-draw contract pins"

key-files:
  created:
    - packages/efx-physic-paint/src/render/canvas.strokePreviewRibbon.test.ts
    - .planning/quick/260924-koa-quick-8-stroke-preview-as-a-pressure-var/deferred-items.md
  modified:
    - packages/efx-physic-paint/src/render/canvas.ts
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.cooperativeFinalization.contract.red.test.ts

key-decisions:
  - "Package vitest runs via the app's vitest binary from the package dir — `pnpm --filter @efxlab/efx-physic-paint exec vitest run` fails (vitest not installed in the package)"
  - "Leg 2's plan-literal assertion (pen run >= 2x uniform at same index) is geometrically unsatisfiable since ribbon() caps p at 1; pinned the valid direction uniform >= 2x pen at the same index plus pen max >= 2x pen min"
  - "Pre-existing liveAlphaCache suite failure attributed to base f92254f7 and deferred — not absorbed"

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Live in-progress preview draws as a filled, pressure-tapering ribbon (no dashed outline)"
    verification:
      - kind: unit
        ref: "packages/efx-physic-paint/src/render/canvas.strokePreviewRibbon.test.ts (Legs 1-2)"
        status: pass
  - id: D2
    description: "Queued strokes render as their own brush-sized filled ribbons from pending style"
    verification:
      - kind: unit
        ref: "packages/efx-physic-paint/src/render/canvas.strokePreviewRibbon.test.ts (Leg 3) + EfxPaintEngine.cooperativeFinalization.contract.red.test.ts retargeted pin"
        status: pass
  - id: D3
    description: "Clear-on-commit leaves only true paint plus queued ribbons (no leftover preview fill)"
    verification:
      - kind: unit
        ref: "packages/efx-physic-paint/src/render/canvas.strokePreviewRibbon.test.ts (Leg 4) + Leg 5 pointer-up control"
        status: pass
  - id: D4
    description: "Native visual UAT: pressure ribbon live, sized preview replaced cleanly, two sized queues, committed stroke + cursor unchanged"
    verification:
      - kind: manual_procedural
        ref: "user native UAT — 4 rows pending (see Native UAT section)"
        status: unknown

requirements-completed: []
---

# Phase quick-260924-koa Plan 260924-koa: Summary

Stroke previews (live + queued) now render as filled, brush-sized, pressure-varying
ribbons built from the existing smooth → resample → ribbon() pipeline, replacing the
1.5px dashed centerline — display-overlay only, with committed-stroke geometry untouched.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | RED — pin filled pressure-varying preview, sized queued ribbon, clear-on-commit | 55e518ac | canvas.strokePreviewRibbon.test.ts |
| 2 | GREEN — fill live ribbon, size queued ribbon, retarget legacy pin | 6ee405b7 | canvas.ts, EfxPaintEngine.ts, cooperativeFinalization.contract.red.test.ts |
| 3 | Full suite, typecheck, hand off to native UAT | 004b7d03, d6883fc3 | canvas.ts (type fix), EfxPaintEngine.ts (restore) |

## RED evidence (Task 1, before any production edit)

- Command: `cd packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/render/canvas.strokePreviewRibbon.test.ts`
  (the plan's `pnpm --filter @efxlab/efx-physic-paint exec vitest run` fails: `Command "vitest" not found`)
- Result at base `f92254f7`: **4 failed | 1 passed, exit 1**
- Leg 1 FAIL — `expected 0 to be greater than or equal to 1` (fills.length: dashed outline strokes instead of fill)
- Leg 2 FAIL — `expected 0 to be greater than or equal to 1` (pressure never reaches fill geometry)
- Leg 3 FAIL — `expected 0 to be greater than or equal to 1` (queued draw is a bare dashed centerline)
- Leg 4 FAIL — first fill assertion `0 >= 1` (live preview never fills at base)
- Leg 5 PASS — engine pointer-up clears `previewStroke` (control leg, green at base as planned)
- No production file modified in the RED commit.

## GREEN + full gates (Task 2/3, at final HEAD d6883fc3)

- Targeted: pin file 5/5 + cooperativeFinalization 34/34 + pointerInput 16/16 = **55 passed**
- Package suite: **13/14 files, 138/139 tests passed** — single failure is pre-existing (see Deferred)
- Package `tsc --noEmit`: **clean**
- App suite: **228 files passed, 4268 tests passed / 0 failed**
- Source sweep: zero references to `drawDashedPath` / `PreviewPathPoint` / `pathX` / `pathY` under `packages/efx-physic-paint/src`
- No server started; committed stroke / finalization / applyStrokeToEngine / brush cursor untouched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan's package test command does not work**
- **Found during:** Task 1
- **Issue:** `pnpm --filter @efxlab/efx-physic-paint exec vitest run …` fails with `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL — Command "vitest" not found` (vitest is only a devDependency of `efx-motion-editor`, not of the package).
- **Fix:** Equivalent invocation using the app's vitest binary run from the package dir: `cd packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run <paths>` (default include `**/*.test.ts`, no config file needed). No package installed.
- **Files modified:** none (invocation only)

**2. [Rule 1 - Bug in plan spec] Leg 2 assertion direction is unsatisfiable**
- **Found during:** Task 1
- **Issue:** The plan pins `mid-stroke width of the pen run >= 2x uniform run at the same index`, but `ribbon()` computes `w = halfWidth * max(0.1, p * endTaper)` with `p <= 1`, so pen width is pointwise `<=` uniform width — the literal assertion can never pass at GREEN.
- **Fix:** Pinned the same property in the valid direction: at the index where the pen run is thinnest (low-pressure head sample), `uniform >= 2 * pen`; plus `penMax >= 2 * penMin` along the stroke (visible thick/thin variation). Pressure feeding fill geometry is fully pinned; constant-lineWidth implementations fail both.
- **Files modified:** packages/efx-physic-paint/src/render/canvas.strokePreviewRibbon.test.ts

**3. [Rule 1 - Type error] readonly points vs `smooth(PenPoint[])`**
- **Found during:** Task 3 (`tsc --noEmit`)
- **Issue:** `buildPreviewRibbon(pts: readonly PenPoint[])` passed the readonly array to `smooth(pts: PenPoint[], …)` — TS2345 (the RED run never typechecked, as the plan anticipated).
- **Fix:** Documented cast at the single call site (`smooth` never mutates its input — it builds fresh arrays).
- **Files modified:** packages/efx-physic-paint/src/render/canvas.ts
- **Commit:** 004b7d03

**4. [Rule 1 - Commit hygiene] `004b7d03` mis-staged a base-version revert of EfxPaintEngine.ts**
- **Found during:** Task 3 (post-commit inspection)
- **Issue:** The base-attribution step (`git checkout f92254f7 -- <files>`) left the base `EfxPaintEngine.ts` in the git index; `004b7d03` therefore committed that stale index entry and reverted the GREEN engine changes while the worktree stayed correct.
- **Fix:** Immediate follow-up commit `d6883fc3` re-staged the worktree (GREEN) engine file; final verification (55/55 targeted, 13/14 package, tsc clean, sweep) re-run at `d6883fc3`.
- **Files modified:** packages/efx-physic-paint/src/engine/EfxPaintEngine.ts

### Minor harness note (not a behavior deviation)
- Leg 5's engine harness adds `getBoundingClientRect` on `dryCanvas` and places the release event on the last raw point (`dist < 1.5`) so `consumePointerSamples` does not append a third point — with the plan's minimal state list alone, `extractPenPoint` would throw and the control leg could not pass at base.

## Deferred Issues

- `packages/efx-physic-paint/src/engine/EfxPaintEngine.liveAlphaCache.test.ts` — 1 failing test
  (`preserves displayed wet alpha when local pre-stroke preparation bakes a distant stroke`, line 152).
  **Pre-existing:** reproduced at base `f92254f7` with the base versions of this quick's production files restored; fails in isolation. Out of scope; logged in
  `.planning/quick/260924-koa-quick-8-stroke-preview-as-a-pressure-var/deferred-items.md`
  and in the cross-phase `.planning/WINDOWS.md` ledger (kind: deviation).

## Known Stubs

None — no placeholder values, TODOs, or unwired data sources in any file created or modified by this quick.

## Threat Flags

None — no new network endpoints, auth paths, file-access patterns, or schema changes; the change is confined to display-overlay drawing (threat register T-koa-01/02/03 as planned).

## Native UAT (pending — user runs the app; executor did not start a server)

1. **Live pressure ribbon** — while drawing, the in-progress stroke shows as a brush-sized filled ribbon whose width visibly varies with pen pressure (thick/thin along the stroke).
2. **Sized preview during render window** — after pointer-up, the queued preview shows the same sized ribbon, then is replaced by the true paint with **no leftover outline/artifact**.
3. **Two queued strokes both sized** — two rapid strokes show two sized ribbons (not bare centerlines) while draining.
4. **Committed stroke + cursor unchanged** — committed stroke pixels/geometry identical to before the quick; brush cursor ring/crosshair unchanged.

Status: **automated-ready** — not done, awaiting native UAT on the 4 rows above.

## Self-Check: PASSED

- All 6 key files exist (4 source/test + SUMMARY + deferred-items).
- All 4 commits found in history: 55e518ac, 6ee405b7, 004b7d03, d6883fc3.
- Zero unexpected file deletions in `f92254f7..HEAD`.
