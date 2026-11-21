---
phase: quick/261121-umu
plan: 01
subsystem: paint-engine
tags: [acrylic, bristles, contact-pressure, brush-preset, probe]

requires:
  - phase: 64-medium-engine
    provides: the bristle carrier/gather deposit (64-21..64-24) and bristleContactPressure §3.1
provides:
  - "BrushPreset.pressureLink (compile-time only, absent reads 1); bristle-flat and bristle-round state 0"
  - "bristleContactPressure's 5th argument blends the authored pen toward 1; speed and attack untouched"
  - "recorded before/after long-stroke probe evidence: 0.15 and 0.4 continuous, 1.0 and Dry-70 byte-identical"
affects: [medium-engine, acrylic-uat, studio-paint]

actuals:
  tokens: 4369
  tasks: 3
  commits: 3
  plan_head_before: a7cc74170ce71274626c5730b473b4997253f484
  plan_head_after: 106074578cba8a7fb05ad5dfce58456897b2330f

tech-stack:
  added: []
  patterns:
    - "A per-response compile-time-only engine field (the `group` precedent) instead of a payload/serializer change"

key-files:
  created:
    - packages/efx-watercolor/probe/long-stroke/captures/before/result.json
    - packages/efx-watercolor/probe/long-stroke/captures/after/result.json
  modified:
    - packages/efx-watercolor/src/playground/brushes.ts
    - packages/efx-watercolor/src/playground/bristles.ts
    - packages/efx-watercolor/src/playground/Engine.ts
    - packages/efx-watercolor/src/playground/bristles.test.ts
    - packages/efx-watercolor/src/playground/brushes.test.ts

key-decisions:
  - "pressureLink defaults to 1, i.e. the shipped formula bit for bit — add-alongside, not a promoted default"
  - "pen = authored + (1 - authored) * (1 - link), associated so link 1 returns `authored` exactly"
  - "the link is clamped to 0..1 and a non-finite link reads as the shipped 1 (the module's never-NaN contract)"

requirements-completed: []

metrics:
  duration: 4min
  started: 2026-11-21T21:19:47Z
  completed: 2026-11-21T21:24:06Z
  tasks: 3
  files: 7
  commits: 3
status: complete
---

# Quick 261121-umu: Decouple the acrylic bristle deposit from authored pressure

**The acrylic family now states `pressureLink: 0`, so a light press thins the line through the footprint instead of shutting the carrier/gather contact gate — 0.15 and 0.4 paint continuously while pressure 1.0 stays byte-identical.**

## Performance

- **Duration:** 4min
- **Started:** 2026-11-21T21:19:47Z
- **Completed:** 2026-11-21T21:24:06Z
- **Tasks:** 3/3
- **Files modified:** 5 source/test files + 2 recorded probe captures

## Task Commits

1. **Task 1: Pin the pressure link RED, capture the pre-change probe** - `3497c0705` (test)
2. **Task 2: Add the field, the defaulted link and the one engine argument** - `13906a9f1` (fix)
3. **Task 3: Record the after-probe, gate the pixels, rebuild, run the app suite** - `106074578` (test)

## RED evidence (Task 1, on the untouched source)

`pnpm --dir packages/efx-watercolor exec vitest run src/playground/bristles.test.ts src/playground/brushes.test.ts` → **7 failed | 85 passed (92)**; log kept at `/tmp/umu-red.log`. The seven link-dependent pins failed, the three GUARD pins passed:

| Pin | Suite | Why it failed pre-change |
| --- | --- | --- |
| `pressureLink 0 takes the authored pen out of the contact gate` | bristles | the 5th argument was ignored → 0.063, not 0.42 |
| `pressureLink 0 keeps the speed ramp` | bristles | rest read 0.15 (pen applied), not 1 |
| `pressureLink 0 keeps the attack ramp` | bristles | floor read 0.063·0.45, not 0.42·0.45 |
| `pressureLink interpolates between the authored pressure and 1` | bristles | half-link read 0.063, not 0.42·0.575 |
| `the engine passes the brush pressureLink at its ONE contact-pressure call site` | bristles | the source call site had no 5th argument |
| `only the two acrylic responses state a pressureLink` | brushes | `BRUSH_PRESETS` carried no field → `[]` |
| `buildBrush carries the pressureLink` | brushes | `bristle-flat` built `undefined` |

GUARD pins (pass pre- and post-change, no RED evidence): `an absent pressureLink is the shipped formula, bit for bit`; `a non-finite pressureLink reads as the shipped 1`; `BASE and CUSTOM_BASE do not state a pressureLink`.

## Before/after probe evidence

Harness: `node packages/efx-watercolor/probe/long-stroke/run.mjs` (headless Chrome, real adapter/engine, `bristle-round`, size 40, acrylic record + Dry/Load overrides, 0xc0ffee paper, seeded RNG). Baseline captured **twice byte-identically** at the start SHA before any source edit.

- Before: `/Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/probe/long-stroke/captures/before/result.json`
- After: `/Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/probe/long-stroke/captures/after/result.json`

| p | dry | covered% before → after | load min/mean/max (after) | segments after |
|---|---|---|---|---|
| 0.15 | 0 | **0.00 → 17.13** | 0.48/0.83/0.87 | 184.42 181.33 187.07 190.67 160.36 191.87 194.72 194.94 201.77 166.5 149.34 152.35 |
| 0.4 | 0 | **6.83 → 28.20** | 0.46/0.68/0.74 | 173.03 179.08 182.72 176.24 174.75 189.87 194.27 186.35 206.37 186.47 187.32 187.6 |
| 0.7 | 0 | 33.40 → 42.97 (expected to move, not gated) | 0/0.24/0.8 | 179.64 177.31 182.88 182.25 196.31 188.11 191.49 182.9 177.22 196.16 198.81 205.6 |
| 1.0 | 0 | 57.11 → **57.11 (byte-identical)** | 0/0.32/0.82 | 171.19 169.32 174.6 184.45 177.36 187 183.74 188.92 192.07 198.26 193.68 199.28 |
| 1.0 | 70 | 33.99 → **33.99 (byte-identical)** | 0/0.05/0.47 | 171.64 170.86 178.66 192.64 195.86 197.26 181.6 120.98 50.15 24.93 24.9 7.5 |

The before rows: 0.15 covered 0 with all 12 segments 0 (bristle load still 0.71/0.85/0.94); 0.4 covered 6.83 with `segments[6] = 0.02` and an all-zero tail from index 7. The after rows: every segment > 1 at both light pressures, both covered% strictly below the 1.0 line (authored pressure still owns width), and the 1.0 / Dry-70 controls equal to the pre-change JSON (compared with `JSON.stringify` equality in the pixel gate).

## Untouched-law statement

- **One engine term.** `Engine.ts` has exactly one `bristleContactPressure` call site (pinned by test), now passing `b.pressureLink ?? 1`; `contactPr` still feeds only `carrierPass`, `bristleInk` and `bristleReliefPass`.
- **No Dry/tank change:** `dryDistance`, `loadFactor`, `uDepletion` untouched.
- **No `touchOf` threshold change** and no change to any bristle constant.
- **Speed and attack terms byte-for-byte:** `BRISTLE_PRESSURE_SLOW/FAST/SPEED/ATTACK/ATTACK_FLOOR` and both ramps are unchanged; the link only replaces the `pen` binding.
- **No radius/wet change:** `brushRadius` and `wet` still read the authored `pr`; no shader file, uniform, pass or render target changed (`shaders.ts`, `mediums.ts`, `params.ts`, the bake and adapter trees are untouched).
- **No payload/serializer change:** `pressureLink` is compile-time only; `buildBrush`'s `...rest` spread carries it and `brushBridge.buildBrushForStroke` inherits it from the preset.

## Guardrail audit (against the start SHA)

```
$ cat /tmp/umu-start-sha
a7cc74170ce71274626c5730b473b4997253f484
$ git diff --name-only "$(cat /tmp/umu-start-sha)" -- packages/efx-watercolor/src
packages/efx-watercolor/src/playground/Engine.ts
packages/efx-watercolor/src/playground/bristles.test.ts
packages/efx-watercolor/src/playground/bristles.ts
packages/efx-watercolor/src/playground/brushes.test.ts
packages/efx-watercolor/src/playground/brushes.ts
$ git diff --name-only "$(cat /tmp/umu-start-sha)" -- \
    packages/efx-watercolor/src/playground/shaders.ts \
    packages/efx-watercolor/src/playground/mediums.ts \
    packages/efx-watercolor/src/playground/params.ts \
    packages/efx-watercolor/src/bake packages/efx-watercolor/src/adapter app
(empty)
```

Exactly the five expected files; no protected tree touched.

## Verification gates

| Gate | Command | Result |
| --- | --- | --- |
| Package suite | `pnpm --dir packages/efx-watercolor exec vitest run` | 38 files passed, 859 passed / 8 skipped |
| Probe pixel gate | the Task 3 node gate over after vs before | `PROBE GATE OK` |
| Package rebuild | `pnpm --dir packages/efx-watercolor build` | success (dist gitignored) |
| App suite | `pnpm --dir app exec vitest run src/components/physic-paint` | 280 files / 7042 tests passed |
| Baseline gate | the Task 1 node gate over the before capture | `BASELINE OK` |

## Deviations from Plan

None - plan executed exactly as written. (The plan's measured-anchor HEAD `6024f7454` is one docs commit behind the execution HEAD `a7cc74170`; the package source was verified unchanged between the two, so every recorded baseline number matched the planning table exactly.)

## UAT — automated-ready (the artist runs native UAT; none of these is "done")

| Row | Surface | Expected |
| --- | --- | --- |
| (a) | Studio, acrylic Bristle Round/Flat, Dry 0 / Pigment 100 — very light press | Continuous line, thinner than a full press (no breakup into specks) |
| (b) | Same bag — full press | Unchanged from the shipped look (probe: 1.0 byte-identical) |
| (c) | Same bag — fast gesture at light pressure | Still thins/fades (the speed ramp is untouched) |
| (d) | Same bag — Dry 70, long stroke at full pressure | Still fades mid-stroke (probe: Dry-70 byte-identical) |

## Self-Check: PASSED

- `packages/efx-watercolor/src/playground/brushes.ts` FOUND
- `packages/efx-watercolor/src/playground/bristles.ts` FOUND
- `packages/efx-watercolor/src/playground/Engine.ts` FOUND
- `packages/efx-watercolor/src/playground/bristles.test.ts` FOUND
- `packages/efx-watercolor/src/playground/brushes.test.ts` FOUND
- `packages/efx-watercolor/probe/long-stroke/captures/before/result.json` FOUND
- `packages/efx-watercolor/probe/long-stroke/captures/after/result.json` FOUND
- Commit `3497c0705` FOUND in HEAD history
- Commit `13906a9f1` FOUND in HEAD history
- Commit `106074578` FOUND in HEAD history
