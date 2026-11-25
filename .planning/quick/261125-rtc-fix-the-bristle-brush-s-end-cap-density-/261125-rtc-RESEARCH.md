# Quick Task 261125-rtc: Bristle End-Cap Density Block at Edge Transparency 0 — Research

**Researched:** 2026-11-25
**Domain:** efx-watercolor bristle gather + carrier (WebGL2) and the headless-Chrome medium-engine probe
**Confidence:** MEDIUM — the writer map and constraints are source-proven (HIGH); the culprit term is not statically decidable and is staged as a measurement (MEDIUM/LOW, flagged below)

## Summary

At Edge transparency 0 the Spec 10 layer is bypassed, so the defect lives in the shipped bristle path:
`gatherBristle` + the carrier + the dab sequence (`[CITED: 261125-rtc-CONTEXT.md]`). The deposit is a
LERP whose fixed point is the carried coefficients — repeated dabs cannot deepen a texel past them — so a
visible "density" block is an INKED-FRACTION (coverage vs paper-threshold) effect or a carried-colour
difference, never a per-texel depth effect. That structural fact refutes the depth-fade family by
construction and independently of the negative pins.

At Dry 0 the carried colour is constant along the stroke (zero depletion, refill 0, pickup gated off on
own paint), and for the artist's brush (`bristle-round`, `pressureLink: 0, speedLink: 0`) the gather's
`uPressure` is a constant 1.0 — so the authored release pressure and `simPressure` cannot move the gather.
The catch-up dab (`uEndCap`) only LIGHTENS coverage, and the bake (no catch-up) still shows the block —
`uEndCap` is refuted as the dark writer. What remains unmeasured is which coverage term gives the body its
lighter inked fraction; the probe must decide it on pixels.

**MAJOR finding — the probe harness no longer exercises the bristle path.** Every bristle scenario passes
`brushId: 'bristle-flat'`, retired by quick 261124-iq9. `presetFor` silently resolves an unknown id to the
watercolor `'round'`, so `isBristleResponse` is false and the captures run the classic watercolor path. The
harness must be repointed to `'bristle-round'` before any measurement; the 2026-11-23 numbers remain valid
because they predate the retirement.

**Primary recommendation:** repoint and extend the probe first (brush id, size 300, Dry/Feather/release
operands, pigment + coverage zone metrics), capture the 5-size x Dry 0/70 matrix on the `stop` and `bake`
drives, bisect the writers on pixels, then implement ONE threshold-based terminal law (never a depth
multiply) that brings the end's inked fraction to the body's while keeping the ragged silhouette.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Probe size matrix**
- Sizes (canonical px): **50, 100, 150, 200, 300** — the artist's own sweep (five sizes stepping by 50).
  Note `BRISTLE_SAMPLE_TABLE` supersampling changes across these cells (50 -> 1x, 100 -> 2x, 200 -> 4x,
  300 -> 16x), so the probe must record the effective sample factor.
- Dry: **0 and 70** (the two artist cells; 70 is the acrylic/Gouache default).
- Brush bag: Gouache (the `acrylic` record) with **Pickup 100, Feather 100**.
- Release pressure is a probe axis: the reproduction must cover the release catch-up at its actual pressure,
  not only a scripted constant.

**Target end look**
- **End density matches body density.** The terminal block fades until the stroke's end reads at the body's
  density — as if the stroke kept going — with the end's ragged silhouette preserved.
- The start / landing-ramp texture is **untouched**: the body is the reference, not something to darken.

**Fix mechanism**
- **Measure first, then ONE law.** The probe must bisect the density writers (release catch-up deposit /
  release pressure / trailing rect) at the 5 sizes x Dry 0/70 before any law changes, and the fix must be
  one law proven on pixels.
- **Bake parity is mandatory**: the bake path has no catch-up dab (2026-11-23 evidence), so a catch-up-only
  patch cannot be the fix. The law must make the bake's end match its body too.
- Depth-fade caution: lateral depth fades have written pale lanes before, and the film lerp holds committed
  film wherever `a` is small. Any density law must prove no lane returns.

### Claude's Discretion
- Probe scenario shape and naming (extend `bristle-end` or add a size x dry x pressure matrix), the exact
  metric definitions for "end density vs body density", and the law choice after the measurement.

### Off-limits (from the brief)
- No changes to the Spec 10 layer code (deposit routing, lateral field, merge, display branch, encoder —
  FROZEN per 261125-kvl), the edge params (`edgeFade`/`edgeFalloff`), or the composite law.

### Deferred Ideas (OUT OF SCOPE)
None recorded in CONTEXT.md — `## Deferred Ideas` is absent. The brief's off-limits list is reproduced above.
</user_constraints>

## Q1 — Density writers at the terminal dab (file:line evidence)

Write path: `processInput` → `trace` (subdivide, spacing) → `stampScripted` → `stamp` → `eachDab` →
`carrierPass` (reservoirs) then `bristleInk` (the deposit lerp) then the coverage write.

### The carried colour (per-texel depth source)
```glsl
// shaders.ts:888-903 (carrier)
vec4 carriedA = mix(paintA, canvasA, pickup);
vec3 carriedB = mix(paintB.rgb, canvasB, pickup);
float carriedAlpha = mix(paintB.a, canvasAlpha, pickup);
...
float load = state.x - uDepletion * shape.z * uTravelPx * touch * (0.35 + 0.65 * uPressure);
load = clamp(load + pickup * 0.25, 0.0, 1.0);
```
```glsl
// shaders.ts:885-886
float pickup = clamp(uPickupRate * thirst * uTravel * wet * touch * liftGate, 0.0, 0.75);
float refill = clamp(uRefillRate * uTravel * state.x, 0.0, 1.0);
```
On own paint `liftGate` is driven to 0 by the same-colour cosine (`liftGate *= 1.0 - smoothstep(0.975,
0.995, samePaint)` — shaders.ts:873), and the acrylic record sets `refill: 0` (mediums.ts:150). At Dry 0
`depletion` is exactly 0 (`Engine.ts:3901`):
```ts
const depletion = dryRate <= 0 ? 0 : (1 / (dryDistance * loadFactor)) / Math.min(this.dw, this.dh);
```
→ **At Dry 0 the carried colour is constant along the stroke**; at Dry 70 it only decreases (the end gets
LIGHTER, not darker). `[VERIFIED: shaders.ts:885-903, Engine.ts:3901, mediums.ts:150]`

### The deposit is a lerp with the carried coefficients as fixed point
```glsl
// shaders.ts:1347-1350 (deposit cull and weight)
if (abs(q.x) > 1.15 || abs(q.y) > 1.15) discard;
Gathered g = gatherBristle(vUv);
float a = clamp(g.coverage, 0.0, 1.0);
if (a <= 1e-3) discard;
```
The four draws (attenuation on ink and fixed, carried add, coverage write) implement exactly
`ink <- ink*(1-a) + carried*a` with the same `a` (`Engine.ts:4097-4128`). With `a = 1` a single dab sets
`ink = carried`; more dabs cannot exceed it; a later `a = 0` leaves the earlier film untouched. **Therefore
the terminal block is an inked-fraction/coverage effect, not a per-texel depth effect.** `[VERIFIED:
shaders.ts:1347-1350, Engine.ts:4097-4128]`

### The gather's coverage (the only lever)
```glsl
// shaders.ts:1291-1298
float trailSupport = 1.0 - smoothstep(0.95, 1.2, q.y);
float coverage = body * (0.3 + 0.7 * uPressure) * dryEdge * alongFade * trailSupport;
featherFade *= alongFade * trailSupport;
```
```glsl
// shaders.ts:1300-1306
float inked = uSoftness > 0.0
  ? smoothstep(threshold - uSoftness, threshold + uSoftness, coverage)
  : step(threshold, coverage);
g.coverage = inked * featherFade;
g.cA *= featherFade;  g.cB *= featherFade;  g.alpha *= featherFade;
```
`threshold` is the paper tooth plus the Feather rim shift, and the accepted 2026-11-23 takeoff:
```glsl
// shaders.ts:1209-1210
float takeoff = smoothstep(0.45, 1.05, -q.y);
threshold += takeoff * (0.3 + 0.7 * uPressure) * uTakeoffShift;
```
The cap (`uEndCap` → `exposedTrail`) multiplies `coverage`/`featherFade` by `alongFade` (≤1) and raises
the takeoff threshold — it can only LIGHTEN. `[VERIFIED: shaders.ts:1209-1210, 1253-1257, 1268-1282,
1291-1306]`

### Why release pressure and `simPressure` are inert for the artist's brush
```ts
// brushes.ts:480-485
id: 'bristle-round', name: 'Gouache', hint: 'Round acrylic brush with body: springy, loaded hairs',
group: 'acrylic', pressureLink: 0, speedLink: 0,
```
```ts
// bristles.ts:334-342 — bristleContactPressure
const speedRamp = smoothstep(0, BRISTLE_PRESSURE_SPEED, v) * speedLinkClamped;
return mix(BRISTLE_PRESSURE_SLOW, BRISTLE_PRESSURE_FAST, speedRamp) * pen *
  mix(BRISTLE_PRESSURE_ATTACK_FLOOR, 1, attackRamp)
```
With `pressureLink: 0, speedLink: 0`, `pen` is forced to 1, `speedRamp` to 0, and after the
`BRISTLE_PRESSURE_ATTACK` ramp (~19.4 px at a 1080 sheet) `contactPr` is exactly 1.0 for the whole stroke.
`contactPr` is what the gather and carrier bind as `uPressure` (`Engine.ts:3297-3298, 3356, 3997-4003`).
`simPressure` (`Engine.ts:3051-3052`) is therefore irrelevant to this defect. `[VERIFIED: brushes.ts:480-485,
bristles.ts:294-298, 334-342, Engine.ts:3051-3052, 3297-3298, 3356, 3988-4003]`

### The catch-up dab and the release paths
```ts
// Engine.ts:3067-3077
if (s.started && (!s.moved || s.ending) && (s.x !== s.cx || s.y !== s.cy)) {
  // 2026-11-20: a catch-up dab is not followed by a movement dab, so its
  // trailing half is exposed — stamp it as a tentative end impression.
  this.bristleEndCap = true;
  try {
    this.trace(s, s.cx, s.cy, s.cx, s.cy, s.pr, 0, 0);
  } finally {
    this.bristleEndCap = false;
  }
}
```
The catch-up arrives at `s.pr` (the authored/resolved pressure), but with `pressureLink: 0` its gather
pressure is 1.0 like every dab. `uEndCap` sets `exposedTrail = 1`, which widens `along` to `abs(q.y)` and
lets `alongFade` fade both halves — a LIGHTENING, and the bake (no catch-up) still exhibits the block.
→ **`uEndCap` / the catch-up deposit is refuted as the dark writer.** `[VERIFIED: Engine.ts:3067-3077,
4003; CITED: .planning/debug/resolved/acrylic-stroke-end-cap.md]`

### Reconciliation with the 2026-11-23 debug
- Measured residual terminal pigment block ~0.62–0.68 vs body 0.55–0.60, present in every path including
  the approved lift and the bake `[CITED: .planning/debug/resolved/acrylic-stroke-end-cap.md]`.
- Pre-fix wall at x=1015 every row, flat over 83% of the width; the takeoff now grades every path into
  tooth specks (stop 21.9% flat / 12 px, bake 23.7% / 15 px) `[VERIFIED: scattering.test.ts:1385-1394]`.
- Writers the prior debug refuted: catch-up as the silhouette writer, `simPressure` saturation,
  `trailSupport` as the shape writer `[CITED: .planning/debug/resolved/acrylic-stroke-end-cap.md]`.
- The transparent-export metric and the pigment metric disagree in that record (end zoneDark 0.5489 vs body
  0.5782 on transparent, pigment darker at the end). The probe's `bristleEndMetrics` reads the TRANSPARENT
  export only (`probe.ts:4665`), so the artist-visible pigment block is not currently measured.

### The remaining question the probe must answer
The static map leaves no term that systematically darkens the end beyond the body at Dry 0. The only
end-exclusive geometry is that the last dab's trailing rim has no later dab — but the test comment states
that "an interior texel's last dab sits at its trailing rim" too (`scattering.test.ts:1408-1409`), so the
body and the end are structurally alike there. The block is therefore either (a) the end written at full
coverage while the body's inked fraction is lower for a reason not visible statically (`broken`/`dryness`
base, load depletion at Dry 70, or the display path), or (b) an absolute-vs-relative effect (the body
lightens along travel, so the unchanged terminal band reads darker). **The measurement must separate
"end darker (absolute)" from "body lighter (absolute)" on the pigment and coverage rasters before a law is
chosen.** `[ASSUMED]`

## Q2 — The probe harness

### CLI and outputs
```bash
node packages/efx-watercolor/probe/medium-engine/run.mjs --gate <gate> --scenario bristle-end \
  [--stroke-size <1..200>] [--drive stop|lift|decay|mouse|mouse-lift|bake] [--mut <int>] [--band <16..400>] [--size <32..4096>]
```
- One gate = one bundle (esbuild, untracked `probe/bundle.js`) + one headless-Chrome WebGL2 run.
- Outputs `/tmp/medium-engine/<gate>.json` plus `<gate>-{transparent,coverage,pigment,start,end,end-pigment,end-coverage}.png` `[VERIFIED: run.mjs:404-421, 507-527]`.
- `--drive` is bristle-end only and a closed list (`run.mjs:510-527`; `probe.ts:4386-4404`).
- `--size` is the SHEET side; the stroke's own size is `--stroke-size` (run.mjs header + 404-421).

### The harness bug (must fix before measuring)
```ts
// probe.ts:4504-4509
function configureLiveEnd(
  engine: WatercolorEngine,
  bag: Record<string, number>,
  mut: number,
  brushId = 'bristle-flat',
```
```ts
// probe.ts:4876-4885 — the bake lane
params: bristleLineParams(body, strokeSize),
brushId: 'bristle-flat',
```
```ts
// brushBridge.ts:86-89
function presetFor(brushId: string): BrushPreset {
  const presetId = TIP_TO_PRESET[brushId] ?? (BRUSH_PRESETS.some((b) => b.id === brushId) ? brushId : 'round')
  return BRUSH_PRESETS.find((b) => b.id === presetId) ?? BRUSH_PRESETS[0]!
}
```
```ts
// brushes.ts:311-312
export function isBristleResponse(b: { id: string; textureId?: string | null }): boolean {
  return b.id === 'bristle-round' || b.id === 'pen';
}
```
`'bristle-flat'` is absent from `TIP_TO_PRESET` and from `BRUSH_PRESETS` (retired by 261124-iq9), so
`presetFor` resolves it to `'round'`; `stamp`'s `const bristle = isBristleResponse(b)` (`Engine.ts:3226`)
is then false and the captures run the classic watercolor path. The same literal appears in `bristle-line`
and `bristle-tip` (`probe.ts:1348, 1356, 1702, 1716, 1723, 1883, 1902, 4508, 4884, 4967`).
**Repoint all of them to `'bristle-round'` — do not re-add the retired id to Engine.ts** (pinned:
`brushes.test.ts:314` expects `isBristleResponse({ id: 'bristle-flat' })` false; `engineTraceSpacing.test.ts:362`
expects `ENGINE_SOURCE` not to contain `'bristle-flat'`). `[VERIFIED: probe.ts:4504-4509, 4876-4885,
brushBridge.ts:86-89, brushes.ts:311-312, Engine.ts:3226]`

### Current operands and gaps
| Need | Current state | Gap |
|---|---|---|
| Brush | `brushId = 'bristle-flat'` (live + bake) | resolves to watercolor `round` — broken |
| Sizes 50/100/150/200/300 | `readStrokeSize` throws above 200 (`probe.ts:1935-1942`); run.mjs refuses >200 (`run.mjs:410-415`) | size 300 blocked |
| Dry 0 / 70 | `bristleLineParams` spreads `...acrylic.params` (dry 70, feather 85) — no override | no `--dry` |
| Feather 100 | record is 85 (`mediums.ts:148`) | no `--feather` |
| Release pressure | pen drives use `END_PRESS = 0.75` (`probe.ts:4361`); `decay` moves 0.75→0.10 (`4368-4372`); no release-sample pressure | no `--release` |
| Effective sample factor | not recorded | add to the report |
| End vs body density | `bristleEndMetrics` reads TRANSPARENT only; body = 0.40–0.55 dw, end = `endMedian-30 .. endMedian-2` (`probe.ts:4665-4798`) | no pigment/coverage zone densities, no inked fraction |
| Census pressure | `taps.push({ ..., pr: Number(args[3]) })` (`probe.ts:4585-4586`) — the AUTHORED pr, not `contactPr` | records the wrong field after the repoint |

**Sampling-factor correction:** canonical 50 → `sizeToEngineScale(50) = 1` → `engineScaleToSize(1) = 80` →
`bristleSampleScale(80) = 1.6`, not 1. `LEGACY_SIZE_MAX_PX = 80`, table anchors `[50,1]` and `[100,2]`
(`params.ts:155-159, 175-194`; `bristles.ts:187-214`). Effective factors: **50 → 1.6x, 100 → 2x, 150 → 3x,
200 → 4x, 300 → 16x**. Record the computed value in every capture. `[VERIFIED: params.ts:155-159, 175-194;
bristles.ts:187-214]`

### Recommended probe scenario shape (Claude's discretion)
Extend `bristle-end` rather than adding a new scenario — its six drives, census, fine end profile and
PNG set already exist. Minimal additions:
1. Repoint `brushId` to `'bristle-round'` everywhere (live, bake, line, tip).
2. Widen `--stroke-size` to `1..400` in both `run.mjs` and `probe.ts` (needed for the 300 cell).
3. Add `--dry <0..100>` and `--feather <0..100>`, applied AFTER the `...acrylic.params` spread inside
   `bristleLineParams` so the record still wins where the flag is absent. This is the artist's "Gouache bag
   with Pickup 100, Feather 100".
4. Add `--release <0..1>` — the final sample's authored pressure on the `stop`/`lift`/`mouse-lift` drives
   (the mouse drives keep the -1 sentinel). This is the release-pressure axis the CONTEXT requires.
5. Metrics: pass the pigment and coverage canvases to `bristleEndMetrics` and compute the SAME body/end
   zone means on each, plus an inked-fraction (share of band cells above a coverage threshold in the
   coverage raster) and the report's `effectiveSampleScale`.

**Matrix:** drives `{stop, bake}` x sizes `{50,100,150,200,300}` x Dry `{0,70}` = 20 captures, plus a
release-pressure sweep at size 150 and 200 (`--release 0.1 / 0.5 / 0.9`) = 6. `stop` vs `bake` is the
discriminating pair (catch-up vs none). Sheet `--size 1080` to match the scene's constants
(`END_JITTER_UV_X = 1 / 1080`, `probe.ts:4365-4366`) and the 2026-11-23 record.

## Q3 — Fix candidates, homes and risks

| # | Candidate law | Home | Verdict |
|---|---|---|---|
| 1 | **Terminal-dab trailing threshold** (end-match via the paper threshold, mirroring the takeoff) | `shaders.ts` gather (a second shift beside line 1210) + `Engine.ts` to signal the terminal dab on BOTH paths | **Preferred** — only family that can lighten the end to the body's inked fraction while breaking the block into tooth specks (silhouette preserved); needs a last-dab signal the bake can set |
| 2 | Mirror the takeoff over the trailing half of EVERY dab (symmetric `abs(q.y)`) | `shaders.ts` only | High risk — changes the body (the reference), and the test comment warns "a symmetric along fade would erase the core" (`scattering.test.ts:1408-1409`) |
| 3 | Depth fade of the terminal deposit / cap (the artist's "fade the deposit") | `shaders.ts` alongFade or a new multiplier | **Refuted + pinned out** — the lerp holds committed film (pale-lane history `shaders.ts:1172-1183`); negative pins `scattering.test.ts:1397-1400` forbid `g.cA/g.cB/g.alpha *= takeoff` and `coverage * takeoff` |
| 4 | Treat the release pressure (make the terminal dab pressure-sensitive) | `bristles.ts`/`Engine.ts` | Inert for `bristle-round` (`pressureLink: 0`) and would change the whole brush's response + the body — contradicts "body is the reference" |
| 5 | Catch-up-only hardening (`uEndCap`/`alongFade`) | `shaders.ts` | **Rejected** — cannot satisfy bake parity (no catch-up in bake) |

**Open design point for #1:** the engine needs a "terminal dab" signal that both the live and bake paths
set deterministically. The live path has `bristleEndCap`; the bake replays scripted points and never stamps
a catch-up (`probe.ts:4874-4887`), so the signal must be derived from the stroke's own end (e.g. the last
trace/dab of a stroke, set for both paths) without touching the frozen layer routing.

### Regression pins any law change must update deliberately
- `scattering.test.ts:1393-1454` — exact-line pins on the takeoff, `dryCap`/`capW`/`exposedTrail`/`along`/
  `hairEnd`/`alongFade`/`trailSupport`/`coverage`/`featherFade`, plus `ENGINE_SOURCE` lines 1438-1440.
- `scattering.test.ts:1397-1400, 1405-1407` — negative pins (no depth multiply, no `lateralFade`/
  `raggedFade`/`fadeAlong`).
- `bristles.test.ts` — every declared constant exactly once with exact-literal pins; a new constant needs
  the same treatment.
- `harness.test.ts` — 136 source-scan tests over the comment-stripped probe; a grep found **no**
  `bristle-end` pin, but new operands in `run.mjs`/`probe.ts` may trip existing pins — verify.
- `probe/medium-engine/baselines/edge-layer-neutral.json` is the Spec 10 amount-0 identity digest; a
  shipped-gather law change WILL change that digest — re-capture deliberately and document it (as 64-17
  did for the cover baselines), never silently.
- No `bristle-end` baseline is committed (verified by listing `baselines/`), so the matrix needs report
  captures, not compare gates, until a law is chosen.

## Q4 — Commands and gates

```bash
pnpm --dir packages/efx-watercolor exec vitest run
pnpm --dir app exec vitest run
pnpm --dir app exec tsc --noEmit
node packages/efx-watercolor/probe/medium-engine/run.mjs --gate rtc-s100-dry0-stop \
  --scenario bristle-end --stroke-size 100 --drive stop --size 1080
```
- `app/package.json` defines `"test": "vitest"` (watch) — `exec vitest run` is required for one-shot mode.
- Package suite at the kvl HEAD: 43 files, ~1085 passed, 8 skipped `[CITED: 261125-kvl-SUMMARY.md:338]`.
- Known pre-existing app failure: `physicPaintBridge.test.ts` one-shot-listener timeout under the full
  suite (passes in isolation) `[CITED: .planning/debug/resolved/acrylic-stroke-end-cap.md]`. Judge app
  totals against the current HEAD, not a remembered count.
- `node run.mjs` writes an untracked `probe.bundle.js` inside the probe directory (`git ls-files` returns
  nothing for it) — non-destructive, but it lands in the working tree.
- No server, no vitest watch, no push.

### Validation Architecture (compact)
| Behavior | Test type | Automated command | File exists? |
|---|---|---|---|
| The terminal law is a threshold shift, not a depth multiply | unit (source pins) | `pnpm --dir packages/efx-watercolor exec vitest run src/playground/scattering.test.ts` | ✅ (pins at 1393-1454) |
| Every new constant is declared once in `bristles.ts` | unit (source pins) | same suite, `bristles.test.ts` | ✅ |
| The gather law is inert on interior dabs (body byte-identical) | probe | `run.mjs --scenario bristle-end --drive stop --stroke-size 100 --dry 0` vs a pre-fix capture | ❌ Wave 0 (pigment/coverage zone metrics) |
| Bake end matches its body (no catch-up) | probe | `run.mjs ... --drive bake` | ❌ Wave 0 |
| The five sizes x Dry 0/70 match | probe + UAT | the matrix above, then live UAT | ❌ Wave 0 |
| No pale lane returns | probe | the `bristle-line` lane gates + the end fine profile | ✅/partial |

**Wave 0 gaps:** the probe extensions (item 1-5 above) and a committed pre-fix capture set for the matrix.
**Security domain:** not applicable — headless shader/probe work with no untrusted input surface.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The residual is an inked-fraction/coverage effect (the lerp's fixed point is the carried colour) | Q1, Summary | A carried-colour difference would move the law into the carrier; the probe metrics must confirm |
| A2 | At Dry 70 the block is relatively darker because the body lightens (load depletion), not absolutely darker | Q1 | The law's target (end vs body) would be chosen on the wrong side; the measurement separates absolute vs relative |
| A3 | The 2026-11-23 measurements predate the `bristle-flat` retirement and stay valid | Summary | If the retirement predates them, the record measured the classic path; the repoint must reproduce first |
| A4 | `harness.test.ts` has no `bristle-end` pin (grep-based observation) | Q3 | New probe edits could trip an unknown pin; run the suite first |
| A5 | A capture costs seconds (one bundle + one Chrome run) — not measured this session | Q2 | The matrix may need batching/background runs |

## Open Questions

1. **Does the block reproduce at all once the probe is repointed to `bristle-round`?** (RESOLVED: the plan's
   tracer gates the repoint on two decisive captures - size 100 and size 300 at Dry 70 - and stops before
   the matrix or any law if the pigment block or the gather proof is missing.)
2. **Absolute or relative block?** (RESOLVED: every capture reports body and end zone means separately on the
   pigment, coverage and transparent rasters; the law may only move the end, and the body/start drift bars
   enforce it.)
3. **Which engine signal can mark the terminal dab on the bake path** without touching the frozen Spec 10
   routing? (RESOLVED: the adapter's `feedDueSample` marks its final fed sample(s); the live lane's
   equivalent is the ending tick's catch-up dab, and the measure-first writer map decides whether that
   terminal set covers the writer. The moving lift's pre-release dabs are unreachable by either signal, so
   the lift is an observation cell judged by live UAT.)

## Sources

### Primary (read this session)
- `packages/efx-watercolor/src/playground/shaders.ts` — 792-908 (carrier), 1096-1220 (gather, takeoff),
  1250-1309 (cap, coverage, inked), 1340-1391 (deposit lerp), 1394-1414 (coverage write).
- `packages/efx-watercolor/src/playground/Engine.ts` — 2939-2960, 3044-3083, 3106-3189, 3201-3260,
  3268-3377, 3804-3819, 3832-3941, 3988-4010, 4073-4130.
- `packages/efx-watercolor/src/playground/bristles.ts` — 130-149, 169, 180-214, 294-298, 334-342, 398-411,
  640-700. `brushes.ts` — 294-312, 470-500. `brushBridge.ts` — 86-89.
- `packages/efx-watercolor/src/playground/mediums.ts` — 104-153. `params.ts` — 155-159, 160-214.
- `packages/efx-watercolor/probe/medium-engine/probe.ts` — 1842-1856, 1933-1943, 4346-4445, 4480-4580,
  4660-4798, 4874-4887. `run.mjs` — 404-421, 507-527.
- `packages/efx-watercolor/src/playground/scattering.test.ts` — 1385-1459.
- `.planning/quick/261125-rtc-.../261125-rtc-CONTEXT.md`; `.planning/debug/resolved/acrylic-stroke-end-cap.md`;
  `.planning/quick/261125-kvl-.../261125-kvl-SUMMARY.md` — 36-75, 163-180, 338.

### Secondary (MEDIUM confidence)
- None fetched — this is a codebase/engine investigation.

## Metadata

**Confidence breakdown:**
- Standard stack / constants: HIGH — every value read from source this session.
- Architecture (write path, fixed point, pressure law): HIGH — traced through the real functions.
- Mechanism (which term gives the body its lighter inked fraction): MEDIUM/LOW — the static map is
  exhausted; the probe must decide it.
- Pitfalls / pins / off-limits: HIGH — enumerated from the tests and the kvl summary.

**Research date:** 2026-11-25
**Valid until:** 30 days (stable engine internals) or until the probe repoint lands.
