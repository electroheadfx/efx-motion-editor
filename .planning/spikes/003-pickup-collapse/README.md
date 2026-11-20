---
spike: 003
idea: acrylic-bristle-deposit
name: pickup-collapse
type: standard
validates: "Given the band-p100-dry50 drag scene on the real engine, when only the first-dab travel anchor differs (c0ab29b2c vs 5b0cad17f), then the per-dab carried-hue trajectory names the single pickup-chain term that turned 211 -> 78 (5b0cad17f) into 213 -> 205 (HEAD)"
verdict: VALIDATED
related: [002]
tags: [watercolor, acrylic, bristles, pickup, travel, wetness, probe, headless-chrome, phase-64]
---

# Spike 003: Pickup-Collapse Diagnosis

Measurement only. No engine edits beyond a temporary, byte-restored anchor toggle.

## What This Validates

The committed port-comparison capture measures the drag pair
`band-p0-dry50` vs `band-p100-dry50` at crossing hue **211.14 -> 77.63** on
`5b0cad17f` and **213.07 -> 205.19** on HEAD `c0ab29b2c`. The only engine
change between those commits is the `bristleTravel` first-dab anchor
(`bristlePrev` nulled; first call returns zero travel). Question: which term
of the carrier's pickup chain lost its contribution?

The chain (shaders.ts `bristleCarrierFS`):

```
pickup = clamp(pickupRate · thirst · travel · wet · touch, 0, 0.75)
travel = travelPx / (2·r·sheetH)                 // brush widths
wet    = mean over 3 taps of exp(-age/T)·clamp(cover/0.5, 0, 1)
thirst = 0.15 + 2.4·smoothstep(0.35, 0.9, fract(seed·7.31))
touch  = touchOf(touchReach + contact·rim·0.45, pressure)
```

## How to Run

```bash
# HEAD build (Engine.ts clean)
node packages/efx-watercolor/probe/pickup-collapse/run.mjs --label head-17 --blue-size 17

# old anchor: revert ONLY c0ab29b2c's Engine.ts hunk, run, restore
git show c0ab29b2c -- packages/efx-watercolor/src/playground/Engine.ts | git apply -R
node packages/efx-watercolor/probe/pickup-collapse/run.mjs --label old-17 --blue-size 17
git checkout -- packages/efx-watercolor/src/playground/Engine.ts   # git diff must be empty
```

Scene: exactly `port-comparison`'s `band-p100-dry50` — yellow `#e8c21a` band
(size = blue·0.12/0.085), settle 8, blue `#5994e4` 0.12 -> 0.88 at y = 0.50,
bristle-flat, dry 50, pickup 100, refill 0, body 0, `paperSeed 0xc0ffee`,
800×600. Readouts at dab 1 / 5 / 20 / 50 / 100 / 300 via a prototype tap on
`carrierPass` (per-dab uniforms + pre-dab fields) and `readBristles()`.
`--centre/--rim` pin the same bristle indices across builds.

## Results

Size 17 (460 dabs, 40 bristles, centre = 16, rim = 0):

| after dab | travelPx | travel BW | wet C | touch C | pickup C | hue C | hue R |
|---|---|---|---|---|---|---|---|
| HEAD 1 | 0.00 | 0.0000 | 0.969 | 1.000 | **0.0000** | 214.5 | 213.9 |
| OLD 1 | 314.99 | 7.6109 | 0.969 | 1.000 | **0.7500** | **77.0** | **72.1** |
| HEAD 5 | 1.09 | 0.0265 | 0.943 | 1.000 | 0.0093 | 211.9 | 193.1 |
| OLD 5 | 1.09 | 0.0265 | 0.533 | 1.000 | 0.0052 | 76.9 | 69.6 |
| HEAD 300 | 1.09 | 0.0265 | 0.355 | 1.000 | 0.0035 | 209.4 | 61.7 |
| OLD 300 | 1.09 | 0.0265 | 0.547 | 1.000 | 0.0054 | 75.8 | 57.8 |

Size 4 (1123 dabs, pinned 16/0) reproduces the committed pair: OLD dab 1 travel
314.99 px = 18.58 BW -> pickup 0.75 -> carried hue 73.8 (film 72.7-73.3);
HEAD dab 1 travel 0 -> pickup 0 -> carried hue 214.5, drifting only to 210.2
over 300 dabs (film 205.9-207.3 against the committed 205.19).

- **The one term that differs is `travel`, and only on the first dab**
  (314.99 px -> 0). `wet` (0.969), `thirst`, `touch` (1.0) are identical at
  dab 1; every dab from 2 on has identical travel (0.0265 brush widths at
  both sizes), wet, touch and pickup (0.003-0.009) in both builds.
- One dab decides the stroke because the core's per-dab pickup is ~0.5 %, and
  the core's taps sample the stroke's own film: the reservoir's colour is
  frozen after dab 1. OLD freezes it yellow (pickup 0.75 capped, 75 % of the
  band's absorbance), HEAD freezes it blue.
- The rim keeps dragging in BOTH builds (hue 61.7 at HEAD / 57.8 at OLD,
  dab 300) because its taps sample the exposed band: the chain is intact.
- The gather's deposit path did not collapse: stored coverage a 0.19-0.24 and
  smear weight 0.09-0.29 at size 17 in both builds (0.30-0.55 at size 4).

## Investigation Trail

1. First run showed the nominal centre bristle (across −0.0157) reading the
   dry sentinel with a nonzero cover. A field dump found a one-texel seam in
   the band's deposit at v = 0.5 (row 299: cover 0.000, stamp −604800) — a
   sampling coincidence, not the brush's core. The reported centre is now the
   near-centre bristle whose taps sit on the band's paint (index 16); the
   nominal index is kept in the record (`centreNominalIndex`).
2. The touch field's sentinel residual matters: a texel only freshens by
   `(1 − cover)` per touch, and a Body-0 cover is ≤ 0.5, so ten to forty
   touches are needed before `exp(−age/7)` is live. Over the band (touched by
   the band's own dabs) it is live; at the first dab's core it is 0.969 —
   so `wet` was NOT the collapsed term.
3. Both sizes agree: the geometry is scale-invariant (0.0265 brush widths per
   dab at size 4 and size 17), so size 17 is a valid lens on the size-4
   committed capture.

## Constraints / Limitations

- Probe is scratch; the JSON records are at `/tmp/pickup-collapse/` and are
  not committed. Re-running reproduces them (seeded paper, fixed script).
- The band stroke's own first dab also had a huge travel at the OLD anchor,
  so the band's head differs slightly (smear at size 4: 0.444 vs 0.299 at
  dab 1). That is downstream of the same `travel` term, not a second change.
- Verdict: VALIDATED — the collapse is `uTravel` on the first dab; the anchor
  fix (c0ab29b2c) is correct and must stay. The consequence for the drag
  metric should be handled as a follow-up decision (the first dab's pickup is
  the stroke's colour seed at the current tap law), not by reverting it.
