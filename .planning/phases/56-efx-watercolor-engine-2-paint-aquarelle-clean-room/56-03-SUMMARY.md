---
phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room
plan: 03
subsystem: engine
tags: [watercolor, aquarelle, fluid, tide-line, bloom, conservation, four-tools, tdd, determinism]

# Dependency graph
requires:
  - phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room
    plan: 01
    provides: packages/efx-watercolor tracer (depositStroke / EngineAdapter / seededRng law), @efxlab/efx-spectral mixSpectral
provides:
  - FluidSheet (createSheet/step) with wet/mobile/fixed pigment buffers
  - Wet-gated transport (closed neighbourhood conservation) + capillary tide line
  - Drying: edge-localized dry rate, drying-front pigment pull, fix, granulation settle
  - Four-tool sheet deposit (AquarelleTool: brush | water | pen | lift)
  - fluid.test.ts look-law pins (bloom, hard edge, tide line, conservation, tools, determinism)
affects: [56-04, 56-06, 56-07, 56-09]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# commits: MEASURED via git rev-list --count plan_head_before..HEAD (#3968).
actuals:
  tokens: 14488
  tasks: 2
  commits: 2
plan_head_before: 63aad1229e565a7f0412853c1a696f5438820f0b
plan_head_after: 3daabd7054e6694fa3ed025f4634ed1db9d4a5d9

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wet-gated diffusion: flux exists only between two wet pixels (closed neighbourhood) — the conservation law that keeps pigment off dry paper"
    - "Tide line = edge-localized drying + drying-front pigment pull + fix; measured edge/interior ratio 2.43 against the 1.05 bar"
    - "Four tools as distinct deposit modes (not parameter tweaks): brush/pen stamp pigment, water wets only, lift subtracts wet pigment"
    - "Seed consumption is mandatory in deposit — always-on sub-pixel jitter + density noise so two traceSeeds can never alias"

key-files:
  created:
    - packages/efx-watercolor/src/engine/fluid.ts
    - packages/efx-watercolor/src/engine/transport.ts
    - packages/efx-watercolor/src/engine/drying.ts
    - packages/efx-watercolor/src/engine/fluid.test.ts
  modified:
    - packages/efx-watercolor/src/engine/deposit.ts
    - packages/efx-watercolor/src/engine/index.ts
    - packages/efx-watercolor/src/payload/toStudioStroke.ts
    - packages/efx-watercolor/src/adapter/engineAdapter.ts

key-decisions:
  - "AquarelleTool closed union lives in payload/toStudioStroke.ts and is re-exported from engine/deposit — no engine↔payload runtime cycle (payload never imports engine at runtime)"
  - "Tide line is two cooperating mechanisms: capillary velocity toward lower wetness (transport.ts) plus a drying-front pigment pull (drying.ts) — either alone was too weak to overcome a centre-heavy brush stamp's initial gradient"
  - "Brush stamps are flat-top with a soft rim (BRUSH_BODY 0.55) so a wash reads uniform in the middle; pen is thinner (0.42× radius) and harder (PEN_BODY 0.78) at equal size, exactly the AQUA-02 flagged assumption"
  - "depositStroke (canvas tracer, 56-01) keeps its public surface; the four-tool fluid path is depositStrokeOnSheet/stampTool on FluidSheet — the adapter's applyStroke still uses the tracer until the bake/script plans wire the sheet"

patterns-established:
  - "Look-law pins as 32×32 synthetic sheets with integer ticks — never wall clock (DATA-03)"
  - "transferMobile conserves density and moves colour mass proportionally — every transport term goes through it so pigment is never created or destroyed"

requirements-completed: [AQUA-01, AQUA-02]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Wet-in-wet bloom: pigment deposited into a pre-wet region spreads past the stamp footprint after N ticks"
    requirement: AQUA-01
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/engine/fluid.test.ts#brush stamp into a pre-wet region blooms past the stamp footprint"
        status: pass
    human_judgment: false
  - id: D2
    description: "Hard wet-on-dry edge: pigment deposited onto dry paper stays within the stamp footprint ±1px"
    requirement: AQUA-01
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/engine/fluid.test.ts#brush stamp onto dry paper keeps a hard edge with no bloom past the stamp"
        status: pass
    human_judgment: false
  - id: D3
    description: "Tide line: a drying wash concentrates darker pigment along its receding boundary (edge/interior ratio 2.43 > 1.05)"
    requirement: AQUA-01
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/engine/fluid.test.ts#drying a wet wash concentrates darker pigment along its receding boundary"
        status: pass
    human_judgment: false
  - id: D4
    description: "Conservation: pixels the wet mask marks dry stay untouched by transport (R1.3)"
    requirement: AQUA-01
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/engine/fluid.test.ts#a dry pixel adjacent to wet pigment receives zero pigment after N ticks"
        status: pass
    human_judgment: false
  - id: D5
    description: "Four tools only (brush | water | pen | lift) as distinct deposit/transport modes, with fail-closed rejection of any fifth kind"
    requirement: AQUA-02
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/engine/fluid.test.ts#exposes exactly 'brush' | 'water' | 'pen' | 'lift' — no fifth tool kind"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/engine/fluid.test.ts#rejects an unknown tool fail-closed (never a silent fifth mode)"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/engine/fluid.test.ts#tool 'pen' deposits a thinner mark than brush at equal size parameter"
        status: pass
    human_judgment: false
  - id: D6
    description: "Determinism: same stroke + same traceSeed twice yields identical buffer bytes; different seeds diverge; water and pigment use distinct streams (D-20)"
    requirement: AQUA-01
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/engine/fluid.test.ts#same stroke + same traceSeed twice yields identical buffer bytes"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/determinismContract.test.ts#applyStroke/stepTick/captureFrame twice on fresh adapters yields identical bytes"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-10-16
status: complete
---

# Phase 56 Plan 03: Aquarelle Fluid Core Summary

**Wet-in-wet blooms, hard wet-on-dry edges, and dark tide lines are now proven by tests on a clean-room Float32Array fluid sheet — pigment never seeps onto dry paper, exactly four tools exist, and the same script replays to the same bytes.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-10-15T22:50:28Z
- **Completed:** 2026-10-16T00:58Z
- **Tasks:** 2 completed
- **Files modified:** 9

## Accomplishments

- Built the aquarelle fluid core on `FluidSheet` (velocity u/v, wetness, mobile + fixed pigment, and mobile/fixed colour mass) with `createSheet` / `step` that no-op on an idle dry sheet and on `dt=0` (R1.6 + the flagged idempotency assumption).
- Implemented wet-gated transport in `transport.ts`: closed-neighbourhood diffusion (flux only between two wet pixels — the R1.3 conservation law), capillary velocity toward the receding wet boundary, and upwind advection. A dry pixel adjacent to wet pigment receives exactly zero after 30 ticks.
- Implemented drying in `drying.ts`: edge-localized dry rate (the wet front recedes from the outside in), a drying-front pigment pull that piles pigment where the wash sets (the dark rim), `fix` mobile→fixed, and granulation settle. Measured tide-line edge/interior ratio **2.43** against the 1.05 bar. No fifth texture role (P6 / D-21).
- Expanded `deposit.ts` with the four-tool sheet path (`stampTool` / `depositStrokeOnSheet`): `brush` and `pen` stamp pigment (pen is thinner and harder at equal size), `water` wets without pigment, `lift` subtracts wet pigment. Every deposit draws from `seededRng(traceSeed, streamKey)` with distinct `water` / `pigment` streams (D-20).
- Closed the tool union as `AquarelleTool = 'brush' | 'water' | 'pen' | 'lift'` in the payload (AQUA-02 / D-18), with `assertAquarelleTool` throwing on any fifth kind and `payloadCodec.parse` fail-closed on the union.
- Pinned all nine feature behavior cases plus the idle-dry / `dt=0` assumptions in `fluid.test.ts` (TDD RED → GREEN). Full suite 27/27 green across `fluid.test.ts` + `engineAdapter.test.ts` + `determinismContract.test.ts`; `grep Math.random src/engine` is 0 matches; package build and app typecheck clean.

## TDD Gate Compliance

| Gate | Commit | Evidence |
|------|--------|----------|
| RED | `e54e7e9c` `test(56-03): add failing fluid look laws` | `56-03-red-evidence.json` — `RED_EVIDENCE_OK`, target "brush stamp into a pre-wet region blooms past the stamp footprint" failed on `expect(pigmentWithin(...)).toBeGreaterThan(0)` |
| GREEN | `3daabd70` `feat(56-03): implement aquarelle fluid core to the look laws` | 15/15 look-law tests + 12/12 regression tests green |
| REFACTOR | — | Not needed — modules stayed single-purpose on the first green |

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — fluid look laws (bloom, hard edge, tide line, conservation)** - `e54e7e9c` (test)
2. **Task 2: GREEN — implement fluid.ts + transport.ts + drying.ts to the look laws** - `3daabd70` (feat)

**Plan metadata:** see final `docs(56-03)` commit below

## Files Created/Modified

- `packages/efx-watercolor/src/engine/fluid.ts` - FluidSheet buffers, createSheet, step (idle-dry + dt=0 no-ops), transferMobile
- `packages/efx-watercolor/src/engine/transport.ts` - wet-gated diffusion, capillary tide-line velocity, upwind advection
- `packages/efx-watercolor/src/engine/drying.ts` - edge-localized dry rate, drying-front pigment pull, fix, granulation settle
- `packages/efx-watercolor/src/engine/deposit.ts` - four-tool sheet deposit + kept 56-01 canvas tracer
- `packages/efx-watercolor/src/engine/fluid.test.ts` - nine look-law pins + no-op assumptions
- `packages/efx-watercolor/src/payload/toStudioStroke.ts` - AquarelleTool closed union, payload.tool narrowed
- `packages/efx-watercolor/src/adapter/engineAdapter.ts` - parse fail-closed on the tool union

## Decisions Made

- **AquarelleTool lives in payload, re-exported from engine/deposit** — keeps `payload` free of engine runtime imports while the test contract can name the union from the engine surface. No engine↔payload cycle.
- **Tide line is two cooperating mechanisms** (capillary velocity + drying-front pull) — one mechanism alone could not overcome a centre-heavy brush stamp's initial density gradient. Measured ratio 2.43 with both.
- **Always-on seed consumption in deposit** (sub-pixel jitter + density noise) — the determinism law requires two traceSeeds to diverge even at neutral toolOverrides scatter (1.0), which previously produced zero jitter.
- **Canvas tracer kept as-is** — `depositStroke`'s 56-01 public surface stays compatible for the EngineAdapter; the fluid-core path is `depositStrokeOnSheet`. Adapter `stepTick` remains a tracked 56-01 stub until the bake/script plans wire the sheet.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Tightened `AquarelleStrokePayload.tool` to the closed union**
- **Found during:** Task 2 (GREEN) acceptance criterion "Aquarelle tool union type in payload/engine is exactly 'brush' | 'water' | 'pen' | 'lift'"
- **Issue:** the plan's `files_modified` listed only `src/engine/*`, but the acceptance criterion names `payload/engine`. The payload declared `tool: string`, which admits a fifth tool kind at the type level.
- **Fix:** added `AquarelleTool` + `AQUARELLE_TOOLS` to `payload/toStudioStroke.ts`, narrowed `AquarelleStrokePayload.tool` / `AquarelleStroke.tool`, re-exported from `engine/deposit.ts`, and made `payloadCodec.parse` fail-closed on the union (Rule 2: missing fail-closed validation).
- **Files modified:** `packages/efx-watercolor/src/payload/toStudioStroke.ts`, `packages/efx-watercolor/src/adapter/engineAdapter.ts`
- **Commit:** `3daabd70`

**2. [Rule 3 - Blocking] RED needed collectable stubs so tests fail on assertions**
- **Found during:** Task 1 (RED) verify — the plan's `fails_when` rejects a run that "collects zero tests", and tdd.md classifies import/collection errors as `INVALID_RED`.
- **Issue:** writing `fluid.test.ts` against nonexistent modules fails at import time (0 tests collected), which cannot authorize GREEN.
- **Fix:** shipped intentionally-unimplemented stubs (`fluid.ts` allocation + export surface, no-op `step`/`transportStep`/`fixDrying`/`stampTool`) in the RED commit so the suite collected 15 tests and the target failed on a real assertion — the same pattern 56-01 used.
- **Files modified:** `packages/efx-watercolor/src/engine/{fluid,transport,drying}.ts`, `deposit.ts`, `index.ts`
- **Commit:** `e54e7e9c`

## Known Stubs

None new from this plan. Pre-existing 56-01 adapter stubs (`stepTick` no-op, `setInputLocked` / `setAnimationMode` flag sinks) remain open and are already recorded in `.planning/WINDOWS.md`; they close when the script/bake plans wire the FluidSheet into `EngineAdapter`.

## TDD Gate Compliance (record)

RED `e54e7e9c` → GREEN `3daabd70`, in order, no `feat` before `test`. `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` (reason `target_test_failed`, 15 tests collected / 8 failed / 7 passed).

## Self-Check: PASSED

- All 8 created/modified files found on disk
- Both task commits (`e54e7e9c`, `3daabd70`) are ancestors of HEAD
- `grep Math.random packages/efx-watercolor/src/engine` returns 0 matches
- `AquarelleTool` union is exactly `'brush' | 'water' | 'pen' | 'lift'`
