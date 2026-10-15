---
phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room
plan: 01
subsystem: engine
tags: [watercolor, aquarelle, spectral, kubelka-munk, engine-adapter, tdd, pnpm-workspace]

# Dependency graph
requires:
  - phase: 55-efx-paint-host-engine-1-host-split
    provides: StudioStroke<P> / EngineAdapter<P> seam, hashMutationId / seededRng determinism law, DIFFUSION_CAP mechanism
provides:
  - packages/efx-spectral (@efxlab/efx-spectral) — vendored MIT reflectance tables + mixSpectral subtractive pigment mix
  - packages/efx-watercolor (@efxlab/efx-watercolor) — Preact-free engine 2 consuming the host seam
  - One-stroke EngineAdapter tracer: deposit → stepTick → captureFrame with transparent unpainted pixels
  - Standing pins: determinism double-replay, unseeded-RNG source scan, engine-1 dependency direction
affects: [56-02, 56-03, 56-04, 56-09, 57-efx-spectral]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 17182
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added: ["@efxlab/efx-spectral", "@efxlab/efx-watercolor"]
  patterns:
    - "Kubelka-Munk spectral mix (method-level MIT port) — subtractive, never RGB average"
    - "EngineAdapter<P> consumer with total fail-closed payloadCodec.parse"
    - "Per-stroke seededRng(traceSeed, 'deposit') scatter — no unseeded RNG in deposit/payload"

key-files:
  created:
    - packages/efx-spectral/package.json
    - packages/efx-spectral/NOTICE
    - packages/efx-spectral/src/spectralData.ts
    - packages/efx-spectral/src/mix.ts
    - packages/efx-spectral/src/mix.test.ts
    - packages/efx-spectral/src/index.ts
    - packages/efx-watercolor/package.json
    - packages/efx-watercolor/tsup.config.ts
    - packages/efx-watercolor/tsconfig.json
    - packages/efx-watercolor/src/index.ts
    - packages/efx-watercolor/src/engine/deposit.ts
    - packages/efx-watercolor/src/brushes/tips.ts
    - packages/efx-watercolor/src/payload/toStudioStroke.ts
    - packages/efx-watercolor/src/adapter/engineAdapter.ts
    - packages/efx-watercolor/src/adapter/engineAdapter.test.ts
    - packages/efx-watercolor/src/determinismContract.test.ts
  modified: [pnpm-lock.yaml]

key-decisions:
  - "mixSpectral implements the published rvanwijnen/spectral.js Kubelka-Munk method (KS/KM + concentration = factor^2 * tintingStrength^2 * luminance) — that exact weighting is what makes yellow+blue land green-dominant rather than teal"
  - "Reflectance tables vendored as data only (BASE_SPECTRA / CIE_CMF / CONVERSION) with an MIT NOTICE naming rvanwijnen/spectral.js; nothing copied from the unlicensed watercolor-playground or inkwash sources (P1/D-17)"
  - "Deposit path mixes overlapping pigment via mixSpectral(existing, incoming, coverage) so a yellow stroke under a blue stroke goes green through the engine path, not just the unit test"
  - "payloadCodec.parse validates every shared StudioStroke field plus the engine bag shape and returns null on any malformation (T-56-03 fail-closed)"

patterns-established:
  - "Workspace package scaffold for Preact-free engines: type:module, tsup dts + .mjs out-extension, workspace:* deps"
  - "Standing-pin family (determinismContract / mix.test) as normal .test.ts source-scan + replay contracts"

requirements-completed: [AQUA-06, DATA-04]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Yellow + blue mixes green through packages/efx-spectral (subtractive, not RGB average)"
    requirement: AQUA-06
    verification:
      - kind: unit
        ref: "packages/efx-spectral/src/mix.test.ts#yellow + blue returns a green-dominant colour"
        status: pass
    human_judgment: false
  - id: D2
    description: "One brush stroke deposits spectral pigment through EngineAdapter and leaves unpainted pixels transparent"
    requirement: AQUA-06
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/adapter/engineAdapter.test.ts#applyStroke + stepTick + captureFrame paints the stroke bbox and leaves the far corner transparent"
        status: pass
    human_judgment: false
  - id: D3
    description: "Replaying the identical script twice yields byte-identical captured pixels"
    requirement: AQUA-06
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/determinismContract.test.ts#applyStroke/stepTick/captureFrame twice on fresh adapters yields identical bytes"
        status: pass
    human_judgment: false
  - id: D4
    description: "Engine 2 imports host + spectral and never engine 1"
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/determinismContract.test.ts#package.json dependencies omit engine 1 and include host + spectral"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-10-16
status: complete
---

# Phase 56 Plan 01: EFX Watercolor Engine 2 Tracer Summary

**Two workspace packages now carry the thinnest end-to-end aquarelle path: one stroke deposits Kubelka-Munk spectral pigment through `EngineAdapter<P>`, replays byte-identically, and leaves unpainted pixels at alpha 0.**

## Accomplishments

- Created `@efxlab/efx-spectral` — vendored MIT reflectance tables (`BASE_SPECTRA`, `CIE_CMF`, `CONVERSION`) with a `NOTICE` naming rvanwijnen/spectral.js, and `mixSpectral(a, b, t)` implementing the published Kubelka-Munk method. Yellow (#FFFF00) + blue (#0000FF) at t=0.5 mixes to a green-dominant colour in both the mix unit test and the engine deposit path.
- Created `@efxlab/efx-watercolor` — Preact-free engine 2 mirroring the physic-paint package shape (tsup dts + `.mjs`, `workspace:*` deps on host + spectral, no engine-1 dependency).
- Implemented the thin deposit path: `AquarelleTip` + `TIPS` with categories in the data model, `depositStroke` stamping along `stroke.pts` with `mixSpectral` colour and `seededRng(traceSeed, 'deposit')` scatter, `AquarelleStrokePayload` + `toStudioStroke` with `traceSeed = hashMutationId(mutationId)` and `cuisson` clamped via `DIFFUSION_CAP = 600`.
- Implemented `createAquarelleEngineAdapter(): EngineAdapter<AquarelleStrokePayload>` with `engineId: 'efx-watercolor'`, a total fail-closed `payloadCodec.parse`, bake methods `applyStroke`/`stepTick`/`captureFrame`, and idempotent `dispose`.
- Added standing pins in the paintVersionDisciplineContract / hostGenericityRoundTrip family: double-replay byte-equality, unseeded-RNG source scan over `src/engine` + `src/payload`, and the engine-1 dependency-direction pin.

## What Was Verified

- `pnpm --filter @efxlab/efx-spectral exec vitest run` — 2 passed
- `pnpm --filter @efxlab/efx-watercolor build` — ESM + DTS success
- `pnpm --filter @efxlab/efx-watercolor exec vitest run` — 12 passed (6 tracer + 6 standing pins)
- `pnpm --filter efx-motion-editor run typecheck` — clean
- Acceptance greps: `Math.random` 0 matches in `packages/efx-watercolor/src`, `efx-physic-paint` 0 matches in `packages/efx-watercolor`, `NOTICE` contains "MIT" and "rvanwijnen/spectral.js", package deps include host + spectral and omit engine 1.

## TDD Gate Compliance

| Task | RED commit | GREEN commit | Gate verdict |
|------|-----------|--------------|--------------|
| 1 (tracer, tdd) | `d53fed29` test(56-01) — `RED_EVIDENCE_OK` on target test "applyStroke + stepTick + captureFrame paints the stroke bbox and leaves the far corner transparent" | `1e62e2f1` feat(56-01) | PASS |
| 2 (auto, test-only) | n/a — test-only task, gate exempt | `a750b08c` test(56-01) | PINS_GREEN_AT_BIRTH |

Task 1 RED evidence record: `.planning/phases/56-efx-watercolor-engine-2-paint-aquarelle-clean-room/56-01-red-evidence.json` — classifier verdict `RED_EVIDENCE_OK` (reason `target_test_failed`), semantic assessment confirms the target executed and failed on the planned assertion (deposit stub wrote no pigment → `painted === 0`), not a load/fixture fault. Task 2 pins are preservation/contract pins the tracer already satisfies; green-at-birth is the correct verdict (no RED manufactured by breaking production source).

## Deviations from Plan

None — plan executed as written.

## Known Stubs

| File | Line | Reason |
|------|------|--------|
| packages/efx-watercolor/src/adapter/engineAdapter.ts | 139 | `setInputLocked` is a no-op flag sink — AnimationPlayer live-playback wiring is a later plan's scope (tracer pins the bake path only) |
| packages/efx-watercolor/src/adapter/engineAdapter.ts | 142 | `setAnimationMode` is a no-op flag sink — same later-plan scope as above |
| packages/efx-watercolor/src/adapter/engineAdapter.ts | 174 | `stepTick` is a no-op — diffusion/drying cuisson lands in 56-03; this plan pins the one-stroke deposit case (flagged assumption AQUA-01/AQUA-06) |

Both stub families are recorded in `.planning/WINDOWS.md` as `stub` kind so `/gsd-ship` sees them.

## Self-Check: PASSED
