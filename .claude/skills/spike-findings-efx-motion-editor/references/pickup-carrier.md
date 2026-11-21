# Pickup Carrier

The bristle carrier's pickup chain and how to diagnose it. Spike 003 proved the
chain is intact and named the one term that collapsed the drag hue: the FIRST
dab's travel. Read this before touching `bristleCarrierFS`, the travel anchor,
the carrier taps, or anything that claims a pickup regression.

## Requirements

From the `acrylic-bristle-deposit` idea (MANIFEST), spike 003's requirements —
non-negotiable for the real build:

- **Keep the first-dab travel anchor (`c0ab29b2c`).** The first dab's travel is
  0, never the page-corner distance. Do not "fix" a drag metric by reverting it.
- **Diagnose pickup regressions by the per-dab carrier terms on the real
  engine** (a prototype tap on `carrierPass` + `readBristles()`), never from the
  final hue metric alone.

## How to Build It

The chain (`shaders.ts`, `bristleCarrierFS`):

```
pickup = clamp(pickupRate * thirst * travel * wet * touch, 0, 0.75)
travel = travelPx / (2 * r * sheetH)            // brush widths
wet    = mean over 3 taps of exp(-age/T) * clamp(cover / 0.5, 0, 1)
thirst = 0.15 + 2.4 * smoothstep(0.35, 0.9, fract(seed * 7.31))
touch  = touchOf(touchReach + contact * rim * 0.45, pressure)
```

The anchor: `bristlePrev` is nulled so the first call returns zero travel; every
later dab uses the real per-dab travel (measured 0.0265 brush widths at both
sizes 4 and 17 — the law is scale-invariant).

Probe recipe (`packages/efx-watercolor/probe/pickup-collapse/`, preserved in
`sources/003-pickup-collapse/`):

```bash
node packages/efx-watercolor/probe/pickup-collapse/run.mjs --label head-17 --blue-size 17
# A/B the anchor: revert ONLY c0ab29b2c's Engine.ts hunk, run, then restore
git show c0ab29b2c -- packages/efx-watercolor/src/playground/Engine.ts | git apply -R
node packages/efx-watercolor/probe/pickup-collapse/run.mjs --label old-17 --blue-size 17
git checkout -- packages/efx-watercolor/src/playground/Engine.ts   # git diff must be empty
```

- Scene: exactly `port-comparison`'s `band-p100-dry50` (yellow `#e8c21a` band,
  blue `#5994e4` 0.12→0.88 at y = 0.50, bristle-flat, dry 50, pickup 100,
  refill 0, body 0, paperSeed `0xc0ffee`, 800×600).
- Readouts at dab 1 / 5 / 20 / 50 / 100 / 300 through a prototype tap on
  `carrierPass` (per-dab uniforms + pre-dab fields) and `readBristles()`.
- `--centre/--rim` pin the same bristle indices across builds. Size 17 is the
  valid lens on the size-4 committed capture (460 dabs, 40 bristles, centre
  index 16, rim 0).

## What to Avoid

- **Do not revert the first-dab anchor to restore the drag hue.** The collapse
  (211→78 on `5b0cad17f`) was the anchor's absence; the anchor is correct. The
  first dab seeds the stroke's colour under the current tap law because the
  core's per-dab pickup is ~0.5 % and its taps sample the stroke's own film.
  Treat the consequence as a follow-up decision about the tap law, not a revert.
- **Do not trust the nominal centre bristle.** A one-texel seam can sit at
  v = 0.5 (row 299 read cover 0.000 / stale stamp): pick the near-centre
  bristle whose taps are on the band's paint and record the nominal index.
- **Do not conclude "wet collapsed" from the dry-sentinel residual.**
  A texel freshens only by `(1 − cover)` per touch; a Body-0 cover ≤ 0.5 needs
  10–40 touches before `exp(−age/7)` is live. Measured at the first dab's core:
  wet 0.969, touch 1.0, thirst identical — travel was the only differing term.
- **Do not diagnose from the final hue metric alone.**

## Constraints

- Numbers (size 17): OLD anchor dab 1 travel 314.99 px = 7.61 BW → pickup 0.75
  (cap) → carried hue 77.0 (rim 72.1); HEAD dab 1 travel 0 → pickup 0 → hue
  214.5 (rim 213.9). Every dab from 2 on is identical in both builds
  (travel 0.0265 BW, pickup 0.003–0.009). Size 4 (1123 dabs) reproduces the
  committed pair: OLD 314.99 px = 18.58 BW → hue 73.8; HEAD 0 → 214.5, drifting
  only to 210.2 over 300 dabs.
- The rim keeps dragging in BOTH builds (hue 61.7 HEAD / 57.8 OLD at dab 300):
  the chain is intact; only the core's first dab differed.
- The gather deposit did not collapse (stored coverage a 0.19–0.24, smear
  0.09–0.29 at size 17 in both builds).
- Probe result JSONs live in `/tmp/pickup-collapse/` and are not committed;
  re-running reproduces them (seeded paper, fixed script).

## Origin

Synthesized from spike 003 (`pickup-collapse`, VALIDATED, idea
`acrylic-bristle-deposit`). Source files: `sources/003-pickup-collapse/`
(README, probe.ts, run.mjs, index.html).

Application-level compositing and live/committed parity laws live in
`Skill("efx-studio-paint")`.
