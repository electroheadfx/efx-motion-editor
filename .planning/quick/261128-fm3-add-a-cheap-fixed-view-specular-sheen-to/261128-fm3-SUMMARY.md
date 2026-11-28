---
phase: 261128-fm3
plan: 01
subsystem: paint-engine
tags: [shader, emboss, blinn, specular, efx-watercolor, display]

requires:
  - phase: 64-medium-engine
    provides: the MED-15 emboss (litDelta, the uFlat gate, one displaySource feeding displayFS and displayLayerFS)
provides:
  - a view-fixed Blinn sheen folded into the ONE emboss shade (uniform vec3 uSpecHalf + four EMBOSS_SPEC_* constants)
  - displayFS and displayLayerFS carry the identical term by construction (one shared source)
affects: [medium-engine, studio-paint-display, emboss-tuning]

actuals:
  tokens: 5111
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "One shared displaySource: a new display term is added ONCE and both variants inherit it"
    - "Blinn half-vector built on the CPU once per draw, uploaded as one vec3 — never normalized per fragment"

key-files:
  created: []
  modified:
    - packages/efx-watercolor/src/playground/shaders.ts
    - packages/efx-watercolor/src/playground/Engine.ts
    - packages/efx-watercolor/src/playground/emboss.test.ts

key-decisions:
  - "The zero subtraction happens AFTER the exponent: max(pow(dot(n,H),g) - pow(H.z,g), 0) keeps the flat-field identity exact while letting a 16th-power gloss render; pow(H.z,g) is never precomputed on the CPU (ulp drift would break the exact zero)"
  - "The term is folded into the existing shade before the single clamp, so every mode and both display variants inherit it and the alpha is never scaled"
  - "The highlight is a pigment/transmittance LIFT (a sheen), not an additive white glint; per-medium gloss is deferred"

requirements-completed: [SPEC-SHEEN-TERM, SPEC-HALF-VECTOR, SPEC-IDENTITY, SPEC-PINS, SPEC-GATES]

status: complete
commits: 2
plan_head_before: abdfa12ec1de9b44a2cf167e202a2e6b6c9b8914
plan_head_after: 45747d672d166579de8ecbcddc7b756294feb35f

metrics:
  duration: ~4 minutes
  completed: 2026-11-28
---

# Phase 261128-fm3 Plan 01: Fixed-view specular sheen Summary

Cheap view-fixed Blinn sheen folded into the existing emboss shade — one CPU-built half-vector uniform, four calibration constants, zero new fetches, samplers or texture units.

## The shipped law (as built)

In the ONE `displaySource` block (both `displayFS` and `displayLayerFS` are emitted from it):

    specGate  = smoothstep(EMBOSS_SPEC_DEPTH_LO, EMBOSS_SPEC_DEPTH_HI, c)
    specDelta = uLightIntensity * uReliefBump * specGate * EMBOSS_SPEC_GAIN *
                max(pow(max(dot(n, uSpecHalf), 0.0), EMBOSS_SPEC_GLOSS)
                    - pow(uSpecHalf.z, EMBOSS_SPEC_GLOSS), 0.0)
    shade     = clamp(1.0 + (litDelta + specDelta) * (1.0 - uFlat), 0.0, EMBOSS_SHADE_MAX)

`H = normalize(L + V)` with `V = (0,0,1)` is built ONCE per draw in
`Engine.drawDisplay` from the radians light (`lightAz` / `lightEl`) and uploaded
as ONE `uniform vec3 uSpecHalf` — no per-fragment `normalize`, no new texture
fetch, sampler or unit. The four relief taps and the centre tap already sampled
in the emboss block are reused as-is.

**Exact neutral identity.** A flat field gives `n = (0,0,1)` exactly, so
`dot(n, uSpecHalf)` evaluates to `uSpecHalf.z` bit-exactly and both `pow`
operands are one evaluation whose difference is exactly 0 — the same
zero-gradient subtraction the diffuse term performs with `dot(n, L) - L.z`.
`uLightIntensity` and `uReliefBump` multiply (never offset), the shared
`(1.0 - uFlat)` gate applies to the SUM, and a texel with zero thickness never
enters the block (`if (c > 0.0){`).

**The vacated literal, and why.** A literal `max(dot(n, H) - H.z, 0.0)` cannot
carry the 16th-power gloss: a typical crest delta (<= 0.2) raised to 16 is
~1e-12, so the sheen would never render. The zero subtraction therefore happens
AFTER the exponent. `pow(H.z, g)` is deliberately NOT precomputed on the CPU:
GPU vs CPU `pow` can differ by one ulp and would break the exact flat-zero
identity.

**Constants (calibration start values — the artist's live UAT may retune them;
the law does not change):**

| Constant | Value | Role |
|---|---|---|
| `EMBOSS_SPEC_GAIN` | 1.0 | deliberately modest next to `EMBOSS_GAIN` 2.3 |
| `EMBOSS_SPEC_GLOSS` | 16.0 | low gloss: a broad, soft crest highlight |
| `EMBOSS_SPEC_DEPTH_LO` | 0.05 | smoothstep band floor: thin films stay clean (no 1-texel speckle) |
| `EMBOSS_SPEC_DEPTH_HI` | 0.35 | full sheen where a stroke core accumulates |

`EMBOSS_SHADE_MAX` stays 1.5. One global gain/gloss serves every medium;
per-medium gloss is DEFERRED (the engine has no medium identity and this quick
adds none).

## Accepted tradeoff

Because the term only lifts pigment/transmittance inside the one shade, the
highlight cannot read brighter than the fond under the multiply compositor — it
is a sheen, not an additive white glint. A true additive glint needs a different
compositing route and is out of scope for this quick.

## Files changed (exact anchors)

- `packages/efx-watercolor/src/playground/shaders.ts`
  - MED-15 doc law updated: spec row, identity paragraph, five-tap/no-extra-fetch fact, one half-vector uniform, lift-not-glint + deferred per-medium gloss (~2381-2432)
  - `uniform vec3 uSpecHalf` + the four `EMBOSS_SPEC_*` constants beside `EMBOSS_GAIN` / `EMBOSS_SHADE_MAX` (~2546-2571)
  - the thickness-gated term and the fold into `shade` inside the shared emboss block (~2659-2680)
- `packages/efx-watercolor/src/playground/Engine.ts`
  - `RELIEF_BUMP` comment no longer claims there is no specular (~275-289)
  - `drawDisplay`: `lightAz` / `lightEl` hoisted (still exactly two radian conversions), half-vector built with `Math.hypot` and uploaded with one `uniform3f` (~4887-4904); no `bindTex` added
- `packages/efx-watercolor/src/playground/emboss.test.ts`
  - updated declaration / fold / upload pins; mode-4 slice pinned free of `specDelta`; new describe `displayFS specular sheen (quick 261128-fm3)` covering identity shape, thickness gate, cost (five `texture(`, zero added `normalize`, exactly the shipped ten samplers) and the identical `displayLayerFS` term

## Gates

| Gate | Result |
|---|---|
| `pnpm --dir packages/efx-watercolor exec vitest run src/playground/emboss.test.ts` | 19 passed |
| `pnpm --dir packages/efx-watercolor exec vitest run` (full) | 1172 passed, 8 skipped, 2 failed (both PRE-EXISTING, see Deviations) |
| `pnpm --dir packages/efx-watercolor check` (tsc --noEmit) | clean (exit 0) |
| `pnpm --dir packages/efx-watercolor build` (tsup ESM + DTS) | success |
| Change surface `git diff base..HEAD` | only the three package files (192 insertions / 12 deletions) |
| `grep -rn "uSpecHalf" app/src` | no matches (no app-side change) |
| bindTex ledger in `drawDisplay` | unchanged [0..13] — no new texture unit |
| medium plumbing | none (only comments mention "medium") |

The optional headless-Chrome probe (`--gate neutral-identity`) was not run: the
neutral script deposits no thickness (emboss defaults to 0), so `shade` stays 1
and the committed baseline is structurally untouched; the gate is exact by
construction.

## Live UAT rows — UNCLAIMED (the artist's Studio eye is the only look gate)

| # | Surface | What to judge | State |
|---|---|---|---|
| 1 | Live during a stroke | a lit embossed stroke's crests catch a soft fixed-view sheen; thin films stay clean (no sparkle) | UNCLAIMED |
| 2 | After settle and after a forced re-render | the committed stroke reads the same as the live one | UNCLAIMED |
| 3 | Region pick | `uFlat` hides the sheen together with the rest of the emboss | UNCLAIMED |
| 4 | Light intensity 0 | the render matches the unlit look exactly | UNCLAIMED |

No row is claimed as passed; the look is explicitly NOT approved.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The plan's "exactly one normalize(" cost pin contradicts the shipped block**
- **Found during:** Task 1 (writing the pins)
- **Issue:** the displayFS emboss slice (`float shade = 1.0;` .. `if (uMode == 4){`) already contains TWO `normalize(` calls — the central-difference normal and the light vector (`vec3 L = normalize(vec3(...))`, itself pinned by the existing light-reconstruction test). A pin of exactly one could never go green without deleting the light normalize and breaking that other pin.
- **Fix:** the new pin asserts the slice keeps exactly those two and that the sheen region adds none (`normalize(` count 2, spec slice contains no `normalize(`) — the plan's intent (no per-fragment half-vector normalize).
- **Files modified:** `packages/efx-watercolor/src/playground/emboss.test.ts`
- **Commit:** 8c092efd8

**2. [Rule 3 - Blocking] The plan's required "acrylic/gouache gloss" wording trips a shipped pin**
- **Found during:** Task 2 (full suite)
- **Issue:** `scattering.test.ts` pins `expectNotContains(SHADERS_SOURCE, 'gouache')` (the retired gouache coverage term must never return); the plan asked for the literal phrase "watercolor matte vs acrylic/gouache gloss" in the shaders.ts note.
- **Fix:** reworded to "a matte watercolor versus a glossier acrylic finish" — same deferred per-medium gloss statement, banned literal avoided.
- **Files modified:** `packages/efx-watercolor/src/playground/shaders.ts`
- **Commit:** 45747d672

### Out-of-scope pre-existing failures (not fixed — scope boundary)

`dryMedia.test.ts` fails 2 tests at the plan's base tree: the `pen` (Pen 1B) preset carries `ACRYLIC_RESPONSE_PHYSICS` (roughness 0.4) while `DRY_IDS` in the test is `['bristle-round']`. Neither `brushes.ts` nor `dryMedia.test.ts` is touched by this quick (`git diff base..HEAD` lists only the three package files; `stampFS` is untouched), so the failures predate this quick and were left alone per the plan's "fix a regression ONLY in the three named files".

## Auth gates

None.

## Known Stubs

None — no placeholder values, no unwired data, no TODO/FIXME introduced.

## Self-Check: PASSED

- shaders.ts, Engine.ts, emboss.test.ts present and committed at 8c092efd8 / 45747d672
- Commits found: 8c092efd8 (feat), 45747d672 (fix)
