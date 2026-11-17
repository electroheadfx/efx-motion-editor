---
phase: 64-medium-engine
plan: 08
subsystem: rendering
tags: [watercolor, webgl2, scattering, kubelka-munk, body, settle, white-gouache-retirement, tdd, pixel-gate]

# Dependency graph
requires:
  - phase: 64-01
    provides: the committed neutral-identity pixel baseline and the medium-engine probe harness (paper, transparent and white exports digested)
  - phase: 64-02
    provides: the canonical `body` key in the aquarelle params bag and its ONE mapping into the engine params (divided by 100, clamped, non-finite to 0)
  - phase: 64-06
    provides: the one Body law module `scattering.ts` (`BODY_CURVE_EXPONENT = 6`, `bodyCurve`) and the cover pass that reads it; the package barrel entry was left to this plan
provides:
  - "`SCATTERING_MAX = 8`, `SCATTER_EPSILON = 1e-3` and `scatteringDeposit(body, amount) = SCATTERING_MAX × bodyCurve(body) × amount`, declared once in `scattering.ts` and re-exported from the package barrel"
  - the scattering scalar S written into the alpha of the second colour vector at all three deposit sites (bucket fill, brush dab, pen splat), riding the pre-existing `inkB.a` channel
  - `settleFS` carrying S into the settled layer (`oB = vec4(B.rgb * uSettle, B.a * uSettle)`) — `fixedB.a` is now the settled scattering 64-10 reads
  - the white-gouache channel retired end to end: no `Pigment.white`, no `WHITE_GOUACHE`, no `bleachFS`, no programs-registry entry, no bleach draw, no settle `keep`, no composite coverage term
  - the MED-37 audit recorded as a test: every shipped pigment construction goes through `pigmentFromHex`, and the stroke payload carries no pigment record
affects: [64-09, 64-10, 64-12]

# Actuals (#2632) — same estimateTokens scale as the plan (chars/4 over the realized diff).
actuals:
  tokens: 10772
  tasks: 2
  commits: 4
plan_head_before: c506ada2359690827ba600a005c339a22ed1ac9c
plan_head_after: 0edfa49e247188c39156086f4ce6981227fe5f01

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One derived scalar, two pre-existing channels: S rides `inkB.a` (mobile) and `fixedB.a` (settled); no render target, texture allocation or simulation pass is added"
    - "Deposit proportional to paint: S = SCATTERING_MAX × bodyCurve(body) × amount, so a faint dab deposits a tiny value and stays a glaze, and the S/absorption ratio is unchanged as pigment builds"
    - "Retire in one pass: writer, shader, program, draw and composite reader of the white channel removed together, with the audit as a test rather than an assumption"
    - "Byte-identity backstops: body 0 reproduces the committed pre-milestone baseline, and body 100 reproduces its own pre-edit capture, because S is transported but not yet read"

key-files:
  created:
    - .planning/phases/64-medium-engine/64-08-red-evidence-task1.json
    - .planning/phases/64-medium-engine/64-08-red-evidence-task2.json
  modified:
    - packages/efx-watercolor/src/playground/scattering.ts
    - packages/efx-watercolor/src/playground/scattering.test.ts
    - packages/efx-watercolor/src/playground/index.ts
    - packages/efx-watercolor/src/playground/Engine.ts
    - packages/efx-watercolor/src/playground/shaders.ts
    - packages/efx-watercolor/src/playground/spectral.ts
    - packages/efx-watercolor/src/playground/coverage.test.ts

key-decisions:
  - "`scatteringDeposit` guards the amount first (zero, negative or non-finite → exactly 0) and only then multiplies, so `0 × Infinity` can never become NaN; the body side is already finite through `bodyCurve` (T-64-22)"
  - "`SCATTER_EPSILON` stays 1e-3 and is not interpolated into a shader here: 64-09 owns the render-side switch; this plan gives the value one home and a recorded reason"
  - "The settle `keep` factor and the `bleach` pass were deleted, never flag-hidden: the channel they faded existed only for the white-gouache hack, and every app pigment carried white 0 since `pigmentFromHex` returned it"
  - "The engine's per-dab `scratchPigment` keeps a coeffs-only shape and remains the only Pigment-shaped literal in Engine.ts; every public pigment comes from `pigmentFromHex`"
  - "`coverage.test.ts`'s import pin was repointed from `import { bodyCurve }` to `import { bodyCurve, scatteringDeposit }` — the import statement changed, the `bodyCurve(P.body)` cover call did not, so the cross-plan contract with 64-06 is intact"

patterns-established:
  - "Law module stays pure: constants and `scatteringDeposit` import nothing from the engine and allocate nothing, so a shader generator can import them later"
  - "Source-scan retirement pins use one-line `expect(source.includes(...), literal)` so a failure names the exact missing/leftover text and keeps the TAP RED evidence parseable"

requirements-completed: [MED-32, MED-33, MED-37]

coverage:
  - id: D1
    description: "`SCATTERING_MAX` is exactly 8 and `SCATTER_EPSILON` exactly 1e-3, both exported, positive and finite, the epsilon far below a Body-50 unit-amount deposit (0.125)"
    requirement: MED-32
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/scattering.test.ts#exports SCATTERING_MAX = 8 and SCATTER_EPSILON = 1e-3"
        status: pass
  - id: D2
    description: "`scatteringDeposit(body, amount)` equals `SCATTERING_MAX × bodyCurve(body) × amount`: exact at 0/0.25/0.5/0.75/1 across four amounts, monotone in body over 201 steps, exactly 0 for a zero, negative or non-finite amount (0 × Infinity included), finite and non-negative on a hostile grid; declared once, allocation-free, no engine import"
    requirement: MED-32
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/scattering.test.ts#the scattering deposit law (D-14 / MED-32)"
        status: pass
  - id: D3
    description: "The bucket fill, the brush dab and the pen splat each write `scatteringDeposit(P.body, amount)` into the second colour vector's alpha — exactly three sites — and Engine.ts reads no pigment white member (`.white` count 0)"
    requirement: MED-33
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/scattering.test.ts#writes scatteringDeposit(P.body, amount) at the three deposit sites and nowhere else"
        status: pass
  - id: D4
    description: "`settleFS` outputs `oA = A * uSettle` and `oB = vec4(B.rgb * uSettle, B.a * uSettle)` with no `keep` factor; `advectInkFS` is untouched and still transports the whole vec4 with `max(b.a + dB.a, 0.0)` — no new uniform, branch or pass"
    requirement: MED-33
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/scattering.test.ts#carries the mobile scattering into the settled layer through settleFS"
        status: pass
      - kind: source-scan
        ref: "packages/efx-watercolor/src/playground/shaders.ts#advectInkFS line 284 unchanged"
        status: pass
  - id: D5
    description: "The white channel has no writer or reader: no `WHITE_GOUACHE`, no `Pigment.white`, `pigmentFromHex` returns `{ coeffs }`, no `bleach` anywhere in shaders or Engine, no `cov`/`gouache` term in displayFS; the mode structure, the paper multiply and the export line are unchanged"
    requirement: MED-33
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/scattering.test.ts#has no gouache coverage term left in the composite or the layout comment"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/scattering.test.ts#retires the white member from the pigment record and its factory"
        status: pass
  - id: D6
    description: "MED-37 retirement audit: the app's two `setPigment` sites and the adapter's one all wrap `pigmentFromHex`, neither file builds a `coeffs:` literal, the engine's one Pigment-shaped literal is the coeffs-only per-dab scratch, and the stroke payload carries no Pigment/coeffs"
    requirement: MED-37
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/scattering.test.ts#constructs a pigment only through pigmentFromHex (MED-37 retirement audit)"
        status: pass
  - id: D7
    description: "The cover pass still reads the shared curve (`coverAmount = bodyCurve(P.body)`, one call site) and `bodyCurve` is still declared once in `scattering.ts`"
    requirement: MED-32
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/coverage.test.ts#the Body cover pass (spec 06 / MED-19..MED-22)"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/scattering.test.ts#keeps the cover pass on the same curve and declares no second one"
        status: pass
  - id: D8
    description: "Body 0 is inert against the committed pre-milestone baseline: the neutral-identity gate equals all six baseline fields after the change"
    requirement: MED-33
    verification:
      - kind: backstop
        ref: "probe/medium-engine compare.mjs neutral-identity vs baselines/neutral-identity.json (d2bd637a / 291d4a11 / 6ba88334)"
        status: pass
  - id: D9
    description: "Body 100 reproduces its own pre-edit capture: cover-on equals cover-on-before on all three digests and the byte length, because S is stored but not yet read (64-10 makes it visible)"
    requirement: MED-33
    verification:
      - kind: backstop
        ref: "probe/medium-engine compare.mjs cover-on --other cover-on-before (4d9ac6c9 / 4f24c2ea / 9bf35e56)"
        status: pass
---

# Phase 64 Plan 08: Scattering transport Summary

`S = 8 × bodyCurve(body) × amount` is deposited at every site, advected by the existing fluid, carried by the settle into `fixedB.a`, and the white-gouache channel that owned that alpha is gone.

## What was built

One derived broadband scalar — no per-band S, no new render target, texture or pass. `scattering.ts` (64-06's law module) gained `SCATTERING_MAX = 8`, `SCATTER_EPSILON = 1e-3` and `scatteringDeposit(body, amount)`; it calls the existing `bodyCurve` and declares no second curve. The bucket fill, the brush dab and the pen splat write the product into the alpha slot of their second colour vector, which lands in the already-allocated `inkB.a`; `advectInkFS` already advects the whole vec4 with its non-negative clamp and needed no edit. `settleFS` now carries the channel (`oB = vec4(B.rgb * uSettle, B.a * uSettle)`) instead of zeroing it, so the fixed layer's alpha is the settled scattering that 64-10's composite will read.

The white-gouache hack is retired in one pass: `Pigment.white`, `WHITE_GOUACHE`, the white interpolation in `pigmentAt`, the settle `keep` factor, `bleachFS`, its program entry, its draw and the three composite coverage expressions are all deleted — not flag-hidden. The shader layout comment now documents `B.a` as scattering for both the ink and the fixed layout.

## Tasks

| Task | Name | RED | GREEN |
|------|------|-----|-------|
| 1 | The one body curve and the scattering deposit law | `00e71275b` (RED_EVIDENCE_OK, 8/19 failing) | `5871a94d4` |
| 2 | Deposit S, carry it through the settle, retire the white channel | `f47bed320` (RED_EVIDENCE_OK, 5/17 failing) | `0edfa49e2` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `coverage.test.ts`'s import literal pin repointed**
- **Found during:** Task 2 GREEN
- **Issue:** 64-06's coverage pin asserted the exact text `import { bodyCurve } from './scattering';`. Task 2's action makes the engine import `bodyCurve` and `scatteringDeposit` together, so the literal no longer matched and the five-suite verify failed on `coverage.test.ts:67`.
- **Fix:** Repointed the import literal to the new shared import. The pinned contract — the cover pass reads `bodyCurve(P.body)` and no second curve exists — is unchanged and still asserted on its own lines.
- **Files modified:** `packages/efx-watercolor/src/playground/coverage.test.ts`
- **Commit:** `0edfa49e2`

**2. [Rule 1 - Test precision] displayFS mode-4 comment reworded**
- **Found during:** Task 2 GREEN
- **Issue:** The composite pin forbids the substring `cov` after the gouache removal, and an unrelated prose comment (about the pigment-alpha law) said "never changes its coverage", tripping the pin on prose rather than on code.
- **Fix:** Reworded that comment to "never changes its opacity". The pin now proves what it was written to prove — no coverage scalar survives — without a false positive on an unrelated word.
- **Files modified:** `packages/efx-watercolor/src/playground/shaders.ts`
- **Commit:** `0edfa49e2`

No authentication gates occurred. No package installs were attempted.

## TDD Gate Compliance

- RED: `00e71275b` `test(64-08): add failing tests for the scattering deposit law` — `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` (8 of 19 failing; the four 64-06 curve tests stay green because the curve is not changed).
- GREEN: `5871a94d4` `feat(64-08): derive the scattering deposit from the one Body curve` follows the RED commit.
- RED: `f47bed320` `test(64-08): pin the S deposit, the settle carry and the white retirement` — `RED_EVIDENCE_OK` (5 of 17 failing, all on their planned anchors).
- GREEN: `0edfa49e2` `feat(64-08): deposit S, carry it through the settle, retire the white channel` follows.
- REFACTOR: not required.
- No gate violations.

## Probe matrix (headless Chrome, real WebGL2, 256x256, fixed seeded scripts)

| Gate | scenario | body | digestPaper | digestTransparent | digestWhite | bakeMs | Comparison | Result |
|------|----------|------|-------------|-------------------|-------------|--------|------------|--------|
| cover-off-before | cover | 0 | d573fa72 | b7614318 | 5218ffb8 | 35 | pre-edit reference capture (before any source edit) | captured |
| cover-on-before | cover | 100 | 4d9ac6c9 | 4f24c2ea | 9bf35e56 | 41 | pre-edit reference capture | captured |
| neutral-identity | neutral | (absent → 0) | d2bd637a | 291d4a11 | 6ba88334 | 74 | committed baseline (d1fd7ea3c) | PASS — all 6 fields equal |
| cover-on | cover | 100 | 4d9ac6c9 | 4f24c2ea | 9bf35e56 | 40 | `--other cover-on-before` | PASS — all 6 fields equal |

Both results are the designed outcome, not a coincidence: at body 0 every S write is exactly 0, and at body 100 the white channel was always 0 in every pigment the app can produce, so removing it and storing an unread S cannot move a pixel. The neutral run's 74 ms `bakeMs` is a cold-start outlier of the harness (the first run compiles every program); the cover pair bakes in 40-41 ms on both sides, so the settle change carries no measurable deposit cost. 64-10 makes S visible and carries the rendered proof.

Exact verify chain (passed end to end):
`pnpm --filter @efxlab/efx-watercolor exec vitest run src/playground/scattering.test.ts src/playground/coverage.test.ts src/playground/shaders.test.ts src/playground/relief.test.ts src/determinismContract.test.ts && pnpm --filter @efxlab/efx-watercolor build && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate neutral-identity && node packages/efx-watercolor/probe/medium-engine/compare.mjs neutral-identity && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate cover-on --body 100 --scenario cover && node packages/efx-watercolor/probe/medium-engine/compare.mjs cover-on --other cover-on-before && pnpm --filter efx-motion-editor exec tsc --noEmit`

Result: 56/56 tests in 5 files, package build (ESM + DTS) success, app `tsc --noEmit` exit 0, both probe comparisons PASS.

## MED-37 retirement audit (recorded, not assumed)

The plan asks for an audit that no shipped code can write the retired white channel. The audit is pinned as a test and its findings are recorded here:

- **App** — `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` constructs pigment at exactly two sites (lines 717 and 951), both `engine.setPigment(pigmentFromHex(colorRef.current))`; the file contains no `coeffs:` literal.
- **Adapter** — `packages/efx-watercolor/src/adapter/engineAdapter.ts` produces pigments only through `pigmentFromHex`: `resolveStrokeColors` maps sampled hexes through the factory and the base install wraps `setPigment(pigmentFromHex(hex))`; no `coeffs:` literal.
- **Engine** — the default pigment is `pigmentFromHex('#2338a8')`; the only other Pigment-shaped value is the per-dab `scratchPigment`, which now carries `coeffs` only and interpolates between two pigments that both came from the factory. Engine.ts reads no `.white` member.
- **Persistence** — `packages/efx-watercolor/src/payload/toStudioStroke.ts` carries no `Pigment` and no `coeffs`: strokes record hex colours, points and the canonical params bag (`body` included), never a pigment record. No project file format can hold the retired channel, so no migration exists and none is needed. The scratch probe harnesses also build pigments only through `pigmentFromHex`.

## Issues Encountered

- **RED report format.** Both RED captures used one-line `expect(source.includes(literal), literal)` pins, so the TAP diagnostics stayed parseable; both records validated as `RED_EVIDENCE_OK` on the first attempt.
- **Composite pin vs prose.** See deviation 2: the `cov` absence pin initially matched the word "coverage" in an unrelated comment; the comment was reworded rather than weakening the pin.

## Known Stubs

None — no hardcoded empty values, placeholder text, mock data sources or skipped tests were introduced.

## Threat Flags

None beyond the plan's threat register (T-64-22 mitigated by the finite `bodyCurve` plus the amount guard; T-64-23 by the end-to-end retirement and its test; T-64-24 by leaving the advection clamp as the only channel path). No new network, auth or file-access surface was added; the change removes surface.

## UAT rows handed to the human

None of this plan's own — its assertions are structural pins and byte-identity backstops (the plan's row ledger assigns it 0 of the phase's 56 classified rows). Scattering becomes visible in 64-10, whose gates carry the rendered proof.

## Next Phase Readiness

- 64-09 can consume `SCATTER_EPSILON` as the render-side switch: it is exported from the law module and the package barrel, stays many orders below every real deposit, and no site retypes it.
- 64-10 reads `fixedB.a` as the settled scattering (and `inkB.a` while mobile): the settle now carries it, and `settleFS` no longer has a `keep` factor or a bleach pass ahead of it.
- `spectral.ts` no longer exposes a gouache pigment; any later spectral work should treat `Pigment` as absorbance-only.
- The `_before` probe captures live in `/tmp/medium-engine/` only (never committed); the committed neutral baseline is untouched at `d1fd7ea3c`.

---

*Phase: 64-medium-engine*
*Completed: 2026-11-17*

## Self-Check: PASSED

- Created files present: `64-08-red-evidence-task1.json`, `64-08-red-evidence-task2.json`, `64-08-SUMMARY.md`
- Commits present and ancestors of HEAD: `00e71275b`, `5871a94d4`, `f47bed320`, `0edfa49e2`
