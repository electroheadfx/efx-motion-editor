---
phase: 261126-rov
plan: 01
subsystem: medium-engine/bristle-deposit
tags: [bristle, displacement, perlin, big-brush-smoothing, smear, end-cap, uat-approved]
requires:
  - 261126-n20 frozen bars (ridgeEnvelope.mjs PRE + ENVELOPE, compare.mjs blend worm bar) — untouched
  - 261126-rov Task 1 probes (alongCoherence, pngMid crops, RED baselines, commit 41f3a008e)
provides:
  - a per-stroke seeded three-octave Perlin fBm displacing the bristle run lattice at EVERY Size, Pickup-gated
  - no separate pickup/blend-line displacement (the artist's live ruling; the ink smear stays on the body lattice)
  - big-brush smoothing above Size 200 px (the smear hash blends to its smooth mean; the cap ramp/stagger smooths)
  - the never-fixed pale cap band removed (the END impression keeps full film weight; a mid-stroke pause catches up uncapped)
affects:
  - every bristle gather consumer (deposit, cover, relief, stroke layer) through the shared gather
  - anything that reads the bristle run lattice, the smear hash or the stroke-end cap
tech-stack:
  added: []
  patterns:
    - classic 2D Perlin gradient noise on the engine's own pcg/hash21 family (no loops, no pow)
    - stroke-anchored along coordinate on the virtual clock (deterministic re-bake)
    - one canonical-Size blend (200..300 px) drives both big-brush smoothings; both binds are 0 at or below 200 px
key-files:
  created: []
  modified:
    - packages/efx-watercolor/src/playground/shaders.ts
    - packages/efx-watercolor/src/playground/bristles.ts
    - packages/efx-watercolor/src/playground/Engine.ts
    - packages/efx-watercolor/src/playground/scattering.test.ts
decisions:
  - verdict: SHIPPED — UAT approved live 2026-11-26 ("FIXED you! close le ticket quick")
  - the PICKUP field was removed live — no micro displacement on the blend colour lines
  - the Size gate was removed live — the displacement applies at every brush size ("the 400 px was just to show the effect")
  - the frozen ridge/blend bars were never met by the dual law and were NOT tuned; the live eye is the arbiter for this law
  - the end cap no longer fades the film on the end impression; a pause is not an end ("the cap that was never fixed")
metrics:
  duration: ~4h across two executor sessions and the orchestrator's live UAT loop
  completed: 2026-11-26
status: complete
actuals:
  tokens: 48500
  tasks: 2
  commits: 1
  plan_head_before: 41f3a008e
  plan_head_after: 384fe2a70
---

# Phase 261126-rov Plan 01: Interior displacement law for the bristle runs — SHIPPED

## Verdict

**SHIPPED and UAT-approved live (2026-11-26).** The artist's verdicts during the
trial: "work nice" (body displacement, blend lines clean), "parfait" (big-brush
smoothing), "FIXED you! close le ticket quick" (the cap band). The plan's dual
law was reverted by the executor once the frozen bars rejected it; the artist's
live rulings then reshaped the law into what shipped, and the body-only version
was re-applied, measured and approved. Code: `384fe2a70`.

## The shipped laws (4)

**1. BODY displacement — the seeded interior displacement.**
`gatherBristle` computes `acrossLookup` from the true across and, behind the
Pickup gate, adds a per-stroke seeded three-octave Perlin fBm:

```glsl
float displaceGate = smoothstep(0.0, 0.15, uSmear);
if (uDisplaceAmp > 0.0 && displaceGate > 0.0) {
  float interior = 1.0 - smoothstep(uDisplaceRim.x, uDisplaceRim.y, abs(across));
  float alongWarp = (uAlongPx + q.y * uHalfWidthPx) / max(uHalfWidthPx, 1.0);
  acrossLookup = clamp(across + uDisplaceAmp * displaceGate * interior *
    perlinFbm(vec2(across * uDisplaceCells.x, alongWarp * uDisplaceCells.y) + uDisplaceSeed),
    -1.0, 1.0);
}
```

The run index AND the per-bristle offset read `acrossLookup`; `lateral`, the
tooth and the streak laws keep the true across; `struct Gathered` is not
widened. `perlinFbm` = 0.5714·n(p) + 0.2857·n(2p + (17.3,11.1)) +
0.1429·n(4p + (31.7,23.9)) over a classic 2D Perlin (hashed corner gradients
from hash21 at the 37/17 and 71/53 offsets, quintic fade, ×1.8 normalisation;
no loops, no pow). Constants: cells 0.5/0.6, amp 0.5, rim 0.75/0.95 — bound as
uniforms from `bristles.ts` so the shader cannot drift from the twins.

**Determinism.** The seed is a per-stroke pair derived from the recorded
bristle set (`set.data[4]`/`[12]` × 137/149, non-finite → 0) — no extra RNG
draw, so a re-bake replays the same field. The along coordinate is anchored to
the paint location on the virtual clock (`uAlongPx + q.y * uHalfWidthPx`), so
every covering dab evaluates one stroke-wide wave instead of averaging out.

**2. No pickup-field displacement (live ruling).**
An earlier version added a SECOND low-frequency field on the ink smear index
(the plan's dual law). The artist's live ruling removed it: "no micro
displacement on the colour blend". The ink smear lookup is `g.nearest` again,
so the blend colour lines follow the runs the body field waves and nothing
finer. The body field is still Pickup-gated (`uSmear` 0..0.15 → inert at
Pickup 0).

**3. Big-brush smoothing above Size 200 px (the artist's pixelation report).**
One canonical-Size blend (`BRISTLE_BIG_FROM_PX 200` → `BRISTLE_BIG_TO_PX 300`,
smoothstepped) drives two uniforms, both exactly 0 at or below 200 px:
- `uSmearSmoothBig`: `smearWeight` mixes the 6-px hash cell toward
  `smoothSmearMean` (E[min(k·h, cap)], the stroke layer's existing law) via
  `max(uSmearSmooth, uSmearSmoothBig)` — the hard 6-px colour rectangles that
  read as pixelation on big brushes collapse to the smooth mean, and the tuned
  mean pickup drag is preserved.
- `uCapBlurBig`: the cap's per-hair stagger flattens (`mix(fadeStreak, 0.5, …)`)
  and the ramp edge widens (`capW * mix(0.4, 1.0, …)`).

**4. The pale cap band — "the cap that was never fixed".**
Two mechanisms removed, both at EVERY size:
- **A pause is not an end** (Engine): the rest catch-up no longer sets
  `bristleEndCap`. Previously every pointer hesitation stamped a capped
  tentative end; when the stroke resumed, the faded dab stayed as a pale band
  across the body (pronounced on big brushes and on the stroke layer). Resting
  now catches up at full weight; the cap is stamped only when the stroke
  actually ends (including a pause-then-lift for a bristle stroke that has
  moved; a pure tap keeps its single press impression; non-bristle tools keep
  the shipped trailing catch-up).
- **The END impression keeps full film weight** (shader): `filmFade =
  mix(featherFade, 1.0, uEndCap)`. The cap still breaks the end through the
  COVERAGE THRESHOLD (`alongFade` multiplies coverage before the test), so the
  end dissolves into full-depth bristle specks — no post-threshold alpha/film
  fade, which was the pale stripe that survived under the next stroke when a
  stylus pressure release ended a sweep. The START cap keeps the shipped film
  fade (its zone is repainted by the dabs ahead).

## Why the plan changed (live rulings, recorded)

- **Pickup field removed** — the artist's screenshot review after the live
  trial: no displacement on the blend colour lines ("I dont want micro
  displacement on this part").
- **Size gate removed** — "it should apply to 400 size brush? you are mad? I
  never asked that, the 400 pixels was just to show the effect". The law now
  applies at every Size; Pickup 0 remains the only passive control for the
  displacement.
- **Big-brush smoothing added** — "can you on the big brush size > 200 pixels,
  add a smooth blur for avoid pixelate look".
- **Cap band fix added** — "it happen again when j'utilise le stylo avec la
  pression et que je pein en balayant la tablette et je relache la pression
  dans le mouvement"; "this problem come from a alpha end cap which vary on
  lenght pen pressure". The artist called it "the cap that was never fixed".

## Measured evidence

**The shipped displacement reproduces the judged crops byte-for-byte.** A
re-run of the executor's head-amplitude cell with the final body field
(`n20d-livedraft1080b`, s400 e50 stop m2, 1080²) returns the executor's exact
digests — paper `336f6a58`, transparent `3e2d1fbd`, white `d0f61269`, pigment
`4a470b86` — so the tree renders the look the artist approved.

**The pause fix leaves the stroke-end surface untouched.** The probe's s400 e50
stop scene is byte-identical before/after (`n20d-smooth-s400` vs
`n20d-capfix-s400`: all four digests and `endPreGap` equal) — the drive never
rests mid-stroke, so no rest catch-up fires.

**The end-cap band is gone and the gap is closed.** With the shipped end rule
at Size 100, both the stop and the pressure-decay drives (`n20d-capend-s100-*`)
read `endPreGap {largestRunPx: 0, maxDepth: 0, bracketed: false}`, end-boundary
spread 33–36 px at 5.4–14.5 % flat (a broken end, not a wall), thickness
tapering 159 → 146–151 px over the last 10 %. The same rule at s400 closed the
previously measured 18 px / depth 0.2218 end seam to 0 / 0.

**Big-brush smoothing.** The smear-mean blend and the cap-ramp smoothing are
structurally 0 at or below 200 px (both binds); the colour tiles that motivated
the request are the 6-px hash cells the mean removes.

**Frozen bars (untouched).** The ridge/blend instruments and their bars were
never edited. The plan's dual law failed them (ridge PEAK at s200 e0 m2 7.50 >
7.01, fillers +2.98/+2.01; blend worm 3/6 best at the head amplitude) and was
reverted whole — that is why this SUMMARY replaces the measured-negative
record. The shipped body-only law was not re-scored against those bars: they
describe the removed pickup field and the removed Size-150 identity, and the
artist's live rulings superseded them for this law. The instruments and their
provenance remain in history (`41f3a008e`, `b58a19579`, `63e32db1a`).

## Controls

- The BODY displacement is gated on Pickup (`smoothstep(0, 0.15, uSmear)`): at
  Pickup 0 the gather lookup is the shipped one.
- The Size-150 byte-identity control is RETIRED with the Size gate (live
  ruling). The big-brush smoothings keep their own ≤200 px identity (both
  uniforms exactly 0).
- The cap fix intentionally changes stroke ends at every pickup — that is the
  requested behaviour, not a regression.

## Gates

- `pnpm --dir packages/efx-watercolor exec vitest run` — 43 files, **1132
  passed, 8 skipped**.
- `pnpm --dir packages/efx-watercolor exec tsc --noEmit` — clean.
- `pnpm --dir packages/efx-watercolor build` (tsup) — OK.
- `pnpm --dir app exec vitest run` — **9876 passed, 4 skipped, 96 todo** (469
  files). One known load-flake failed on the first run and passed on the re-run.
- `pnpm --dir app exec tsc --noEmit` — clean.

## Live UAT rows (approved)

1. **Body displacement at the artist's normal sizes** — live during the
   stroke: the dark bristle-run bands read organically wavy (the three-frequency
   mix); the pickup/blend colour lines show no displacement of their own
   ("work nice").
2. **Big-brush smoothing above 200 px** — the colour-blend pixelation is gone
   and the cap reads smoother ("parfait").
3. **Stylus pressure-release sweeps** — sweeping the tablet and releasing
   pressure mid-move leaves no pale cap band in the body or under the next
   stroke, including with Edge transparency 100; the stroke ends still break up
   ("FIXED you! close le ticket quick").

## Deviations from the authored plan

1. The PICKUP field (plan must_haves truth #5) was removed live; the ink smear
   index stays `g.nearest`.
2. The Size gate and the Size-150 identity were removed live; the law applies
   at every Size.
3. The 180-cell frozen-bar matrix and the amplitude/cells ladders were
   superseded: the dual law was measured, reverted, then reshaped by the live
   rulings. The bars and instruments were not tuned.
4. `bristleDisplace.test.ts` never shipped; its source pins live in the amended
   `scattering.test.ts` pins instead.
5. New laws outside the authored plan were added on the artist's request: the
   big-brush smoothing pair (>200 px) and the cap band fix (pause + end film).

## Files at the end state

- `packages/efx-watercolor/src/playground/shaders.ts` — Perlin helpers, the
  body field in `gatherBristle`, the smear big-brush blend, the cap ramp
  smoothing and the end film rule.
- `packages/efx-watercolor/src/playground/bristles.ts` — the big-brush band
  (200/300 px) and the displacement constants.
- `packages/efx-watercolor/src/playground/Engine.ts` — the per-stroke seed
  derivation, the new uniform binds, and the pause-vs-end catch-up split.
- `packages/efx-watercolor/src/playground/scattering.test.ts` — amended pins
  for every changed law.
- Task 1's probe commit (`41f3a008e`: `ridge.ts`, `probe.ts`, `run.mjs`,
  `harness.test.ts`) remains in history as the instrument/provenance record.

## Next

- Close the quick (this record + STATE) — done by the orchestrator docs commit.
- Then the agreed order: **Spec 11 (Feather noise / organic edges)** via
  `/gsd-quick --full`, then the **Density colour falloff/easing** ticket.
