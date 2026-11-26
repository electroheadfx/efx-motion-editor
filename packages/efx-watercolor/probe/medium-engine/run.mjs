#!/usr/bin/env node
// ============================================================
//  run.mjs — build the medium-engine pixel gate and execute it in
//  headless Chrome (real WebGL2).
//
//  Scratch harness only: nothing here is imported by the package.
//  Usage: node packages/efx-watercolor/probe/medium-engine/run.mjs --gate <name>
//           [--scenario cover] [--emboss <0..100>] [--body <0..100>] [--light <0..4>]
//           [--size <32..4096>]
//
//  64-03: `--emboss` folds a thickness value into the fixed stroke's
//  params bag (probe.ts does the folding); the gate name is unchanged,
//  so the emboss-100 capture compares against the SAME plan-01 baseline.
//  The value is echoed by the probe report, never baked into the JSON
//  shape the compare step reads.
//
//  64-04: `--light` sets the emboss light intensity (0..4, the engine's
//  clamp band) before the three exports. Omitted leaves DEFAULT_LIGHT
//  (intensity 1); 0 is the unlit identity gate for a lit stroke.
//
//  64-06: `--body` folds the canonical Body value into EVERY stroke's
//  params bag, and `--scenario cover` renders the two-stroke cover script
//  (dark across, fix, light crossing at an angle, fix) instead of the
//  plan-01 single stroke. Omitted keeps the neutral script, so a plain
//  `--gate neutral-identity` run still reproduces the committed baseline.
//  The probe report also carries `bakeMs` (script + settle, exports
//  excluded) for the cover-on / cover-off cost comparison.
//
//  64-10 adds `--size <32..4096>`, the square sheet side (absent keeps the
//  phase-default 256). `--size 1024` is the high-definition sheet the
//  composite-cost matrix measures — no HD constant exists in the phase docs,
//  so the probe fixes its own and later plans reuse it. Every report also
//  carries `renderMs`, the render phase's wall clock (the three exports and
//  their readbacks), printed beside `bakeMs`; compare.mjs prints both
//  durations when two gates are compared.
//
//  quick-261117-tq7 adds `--scenario cover-over-wet`: the cover geometry with
//  the dark entry left MOBILE (no fix), so the covering stroke meets wet `ink`
//  as well as settled pigment — one mechanism (each covering dab's own
//  coverage term, plus its coverPass erosion) reaches both underlayers. Two
//  historical captures stay committed as digest-differs anchors only:
//    baselines/cover-over-wet-prefix.json    the engine BEFORE the cover
//                                            feature (no erasure at all)
//    baselines/cover-over-wet-subtract.json  the pre-CR-01 clamped subtract
//  and baselines/cover-over-wet.json is the standing capture, re-captured by
//  64-17 under the coverage model: it supersedes the 261117-tq7 rev-4 capture
//  (the engine's model changed in 64-13) and the two historical references
//  are untouched measurement records. The report carries four region means,
//  and compare.mjs asserts the self-contained outcome on them: the covering
//  stroke deposited pigment, the crossing is never blanker than the covering
//  stroke alone and reads below the untouched dark band, bare paper stays the
//  empty control. 64-17 retires both directional claims — the coverage
//  crossing reads ABOVE both erase-era references by construction (49.66 vs
//  the prefix's 34.05 and the subtract's 30.74, because the covering stroke
//  now commits its own near-opaque body, own-pigment 14.54 against 3.47), so
//  neither claim measures the erased underlayer any more. The digest-differs
//  check stays as the change detector.
//  (These are region-PIGMENT means on the transparent export, not coverage
//  fields: 64-31 moved only the coverage claims to the coverage raster.)
//
//  64-17 digests the pigment sheet: every report carries `digestPigment` (the
//  mode-4 compositor export), and a capture that lacks any of the FOUR digests
//  is refused below. The comparison field is `digestPigment`; the one baseline
//  captured before the export existed (`neutral-identity`) is handled
//  explicitly by compare.mjs.
//
//  64-31 restates the shipped alpha law (2026-11-21) across all three probe
//  files in one voice, with no flag and no scenario changed. In three parts:
//    - committed and exported storage alpha is OPAQUE — every export carries
//      coverage-free straight alpha, and no alpha is derived from coverage;
//    - coverage lives only in the coverage raster, a probe-only instrument
//      that is never an export channel;
//    - the display alpha is the DARKNESS of the visible pigment (1 − min(rgb)
//      of the compositor view), never composed with a coverage term.
//  Every report therefore carries two law blocks beside the digests:
//  `opaqueExportMinAlpha` / `opaqueExportMinAlphaSurface` and
//  `visibleAlphaMaxDelta` / `visibleAlphaSamples` / `visibleAlphaWorstAt` —
//  or, on a bristle capture, the visible-alpha check reported as skipped with
//  `visibleAlphaSkip` and its film-blur reason. compare.mjs enforces both
//  halves in every mode.
//
//  64-17 also adds `--scenario watercolor-50`: the spike's 50 rapid #cc2222
//  strokes on blank paper at Body 0, captured at `--size 1080` as the second
//  half of the Body-0 identity law.
//
//  64-17 adds `--scenario white-over-blue`: Spike 001's criterion-1 scene — a
//  saturated #0044dd band at Body 0, fixed, then a #f0f0f0 diagonal at
//  `--body` (default 100) crossing it. The report carries the crossing box's
//  mean channels, blue excess, the coverage raster's mean coverage, the
//  transparent sheet's darkness conversion, and the covered-paper-white scan;
//  compare.mjs gates them in EVERY mode, keyed on the capture's own body.
//
//  64-14 adds `--scenario cover-advect`: the cover geometry with the covering
//  stroke left wet, so the coverage channel can be read mid-script — the
//  crossing coverage on the coverage raster before and after eight extra wet
//  ticks, plus the covered-paper-white scan. compare.mjs gates those readings
//  in EVERY mode, keyed `'cover-advect'`.
//
//  64-14 also adds `--scenario cover-lift`: the fully fixed cover geometry
//  followed by a LIFT stroke across the covering diagonal — the crossing
//  coverage on the coverage raster before and after the lift, then the
//  paper-white scan. compare.mjs gates those readings in EVERY mode, keyed
//  `'cover-lift'`.
//
//  64-16 adds `--brush <id>`: the covering stroke's brush preset. The page
//  resolves the id against BRUSH_PRESETS and throws on an unknown one with the
//  known list, so the id list stays in one place; this parser only rejects an
//  empty token. `cover-textured` is the cover geometry with the light
//  diagonal stamped by that brush (default chalk), measured as a coverage
//  spread on TEXTURED_BOX; `red-over-blue-50` is task 2's criterion-2
//  scenario, declared in both closed lists now so the two files cannot drift.
//
//  64-23 adds `--scenario bristle-edge`: two horizontal `bristle-flat` strokes
//  on one sheet, identical but for the Feather global (0 upper, 100 lower).
//  The report carries each stroke's edge softness and variation in doc pixels,
//  the measured edge half-width and each stroke's plateau alpha; compare.mjs
//  gates the relation facts (D-22's direction, non-zero variation, width
//  inside the stroke) in every mode.
//
//  64-24 adds `--scenario bristle-wet` — the wetness acceptance on one sheet
//  and one brush: two identical light bands, the LEFT one aged thirty virtual
//  seconds (a `water` swash carries the clock-only advance and re-wets it
//  without touching its last touch), the RIGHT one fresh, then one dark
//  crossing stroke over both. The report carries `pickupFreshMean` and
//  `pickupAgedWetMean` (mean film darkness on the transparent export over each
//  band's crossing region) and the capture's `wetMode`; compare.mjs gates the
//  relation facts only.
//  64-24 also adds `--wet-mode <0|1>` (default 1): the recorded A/B control —
//  1 is the shipped §3.4 timestamp law, 0 is 64-21's `wet × coverage` proxy.
//  The A/B proof is `compare.mjs <gate> --differs-from <proxyGate>`; the proxy
//  capture is never committed as a baseline.
//
//  Final flag contract (later phases inherit it, do not retype it):
//    run.mjs --gate <name>            required; [A-Za-z0-9._-]+, names the JSON
//             [--scenario cover]      omitted renders the plan-01 single stroke
//             [--scenario cover-over-wet]
//                                     cover geometry, dark entry left mobile
//             [--scenario cover-advect]
//                                     cover geometry, covering stroke left wet
//             [--scenario cover-lift]
//                                     fixed cover geometry, then a Lift stroke
//             [--scenario watercolor-50]
//                                     the 50-rapid-stroke identity passage
//             [--scenario white-over-blue]
//                                     the criterion-1 crossing at --body
//             [--scenario cover-textured]
//                                     cover geometry, covering stroke at --brush
//             [--scenario red-over-blue-50]
//                                     the criterion-2 red-over-blue crossing
//             [--scenario bristle-edge]
//                                     two Feather-0/100 strokes, edge census
//             [--scenario bristle-wet]
//                                     two ages on one sheet; pickup readings
//  2026-11-22 also adds `--stroke-size`, the stroke's own `size` key for the
//  bristle-line scenario only — the pale-line sweep needs several widths on
//  the same 1080 sheet, and the canvas flag `--size` cannot carry both.
//             [--scenario bristle-line]
//                                     one straight bristle-flat stroke at the
//                                     acrylic record (Body via --body, default
//                                     0); three-field across profiles + PNGs
//             [--stroke-size <1..400>]  bristle-line/bristle-end only: the
//                                     stroke's `size` key (omitted keeps
//                                     STROKE_PARAMS' 12; 261125-rtc widened
//                                     the band from 200 for the artist's
//                                     300-size end sweep)
//             [--band <16..400>]      bristle-line only: the across-profile
//                                     half-width in document px (default 140,
//                                     the full brush — the artist-visible
//                                     lane sat at ±62 px, outside the old 48)
//             [--over]                bristle-line only: paint the wide
//                                     low-load wet understory first; file the
//                                     capture as `bristle-line-over`
//             [--scenario bristle-tip]
//                                     one bristle-flat line for the texture-tip
//                                     A/B (`probe/tip-ab` is the probe's own
//                                     deterministic mask)
//             [--texture <mask id>]   bristle-tip only: the mask id the stroke
//                                     carries; omitted is the plain leg
//             [--scenario bristle-end]
//                                     2026-11-23 / quick 261125-rtc: ONE end
//                                     path on the artist's bristle-round bag
//                                     (acrylic record; Body via --body,
//                                     default 100), then settle + fix. The
//                                     report carries endCensus (drive, taps,
//                                     endCaps, the final 40 taps — populated
//                                     on BOTH the live and the bake lane),
//                                     gather (calls, endCapCalls), endSetup,
//                                     the endMetrics census and its 2x crops.
//             [--drive <stop|lift|decay|mouse|mouse-lift|bake>]
//                                     bristle-end only: which end path runs
//                                     (omitted is stop; bake rides the
//                                     adapter's scripted replay)
//             [--dry <0..100>]        bristle-end only: the acrylic Dry key
//             [--feather <0..100>]    bristle-end only: the acrylic Feather key
//             [--release <0..1>]      bristle-end only: the LAST authored
//                                     sample's pressure (stop and bake only;
//                                     the default stop authors 0.75)
//             [--scenario emboss-smooth]
//                                     quick 261123-hr5: a +15 impasto, then
//                                     the same band at --emboss (default
//                                     -15); relief/pigment readings before
//                                     and after the smoothing pass
//             [--emboss <-100..100>]  SIGNED (261123-hr5): negative subtracts
//                                     thickness; omitted writes no emboss key
//             [--body <0..100>]       omitted writes no body key
//             [--light <0..4>]        omitted keeps DEFAULT_LIGHT
//             [--size <32..4096>]     omitted keeps the 256 square
//             [--brush <id>]          omitted keeps the entry default (round;
//                                     cover-textured defaults to chalk)
//             [--wet-mode <0|1>]      omitted keeps 1 (the shipped §3.4
//                                     timestamp law); 0 is the A/B proxy
//    compare.mjs <gate>               committed-baseline equality (12 fields)
//    compare.mjs <gate> --other <g>   same-session equality; never a baseline
//    compare.mjs <gate> --differs-from <n>
//                                     committed baseline <n> when it exists,
//                                     else the same-session capture; all
//                                     three exported-background digests must
//                                     differ and the dimensions must agree
//    compare.mjs <gate> --relief-smooth
//                                     quick 261123-hr5: the signed-emboss
//                                     smoothing relation, self-contained on
//                                     the capture's own six readings
//
//  quick 261125-kvl (Spec 10) adds `--scenario edge-layer`: the per-stroke
//  translucent stroke layer's scene — spike 006's two straight `bristle-round`
//  strokes (A horizontal then B vertical, so they cross) at the acrylic
//  record's bag with Body 100, each split at 3/4 so the OPEN layer can be read
//  before its stroke-end merge clears it, then completed, settled and fixed.
//  Two knobs fold into the entries' canonical bag: `--edge` (Edge
//  transparency, the layer alpha amount) and `--falloff` (Edge falloff, the
//  band's shape bias), both integers 0..100, omitted keeping 0 / 50. Both are
//  `edge-layer` only and are refused on any other scenario. The report carries
//  `edgeAmount` / `edgeFalloff`, the two sides' lateral profile set
//  (`edgeAcrossPaper` for A's band over paper, `edgeAcross` for B's band over
//  the same-visit A), the per-side readings the sweep orders
//  (`edgeMidAlpha*` / `edgeMidCover*` / `edgeCoreExact*` / `edgeContinuity*` /
//  `edgePrintRetention*`), the coefficient-mix identity (`edgeEncodeMax` /
//  `P95` / `Over`), the live-vs-committed settle (`edgePolishMax` / `P95`), the
//  structural counters (`layerAllocated` / `mergeDraws` / `mergeDrawsFirst`),
//  the capture round trip and the split-vs-one-shot replay digest. Every
//  layer-domain reading is ABSENT (null) on a tree without the layer; the
//  comparator fails it by name.
//             [--scenario edge-layer]
//                                     spike 006's two-stroke layer scene
//             [--edge <0..100>]       edge-layer only: the layer alpha amount
//             [--falloff <0..100>]    edge-layer only: 0 broad / 50 linear /
//                                     100 rim
//             [--pickup <0..100>]     edge-layer only: overrides the record's
//                                     canonical 100 (the pickup-0 control)
//             [--wet-under]           edge-layer only: skip the fix after the
//                                     FIRST stroke (wet under-paint arm); absent
//                                     keeps the shipped dry-under scene
//    compare.mjs <a> --falloff-sweep <b> <c>
//                                     the ONLY cross-capture falloff ordering
//                                     (broad < linear < rim, strict, both
//                                     sides), on three /tmp captures
//    compare.mjs <gate> --edge-structural
//                                     edge-layer only: the structural counters,
//                                     self-contained on one capture
//
//  2026-11-22 adds `--scenario bristle-line` — the acrylic pale-line defect's
//  reproduction at the ARTIST'S parameters. ONE straight bristle-flat stroke
//  (`pressureLink 0`/`speedLink 0` are the brush preset's own fields), the
//  acrylic medium record with Body overridden (`--body`, default 0 — the
//  artist's value; the record states 100 and is NOT changed), at
//  `--size 1080`. The report carries the echoed params bag, the record's own
//  Body, and a three-surface across-stroke profile set (`lineSurfaces`:
//  postApply / postSettle / postFix) over the coverage channel, the displayed
//  film darkness and the raw delivered ink absorbance. Three PNG data URLs
//  ride the report; THIS script writes them beside the JSON
//  (`/tmp/medium-engine/<gate>-<kind>.png`) and strips the base64 from the
//  saved JSON so the record stays comparable.
//
//  The scenario closed lists here and in probe.ts (readScenario) must stay
//  literal-identical: a name accepted here but unknown to the probe fails at
//  capture, and a name the probe knows but this parser rejects can never be
//  requested.
//
//  Writes /tmp/medium-engine/<name>.json. The committed reference lives
//  at probe/medium-engine/baselines/<name>.json and is NEVER written by
//  this script — a gate run must not be able to move its own target.
// ============================================================

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..', '..', '..')
const outDir = '/tmp/medium-engine'
const bundlePath = join(here, 'probe.bundle.js')

const args = process.argv.slice(2)
const gateFlag = args.indexOf('--gate')
const gate = gateFlag >= 0 ? args[gateFlag + 1] : undefined
if (!gate) {
  console.error(
    'usage: node run.mjs --gate <name> [--scenario cover|cover-over-wet|cover-advect|cover-lift|watercolor-50|white-over-blue|cover-textured|red-over-blue-50|bristle-edge|bristle-wet|bristle-line|bristle-end|bristle-tip|emboss-smooth|edge-layer] [--edge <0..100>] [--falloff <0..100>] [--pickup <0..100>] [--wet-under] [--emboss <-100..100>] [--body <0..100>] [--light <0..4>] [--size <32..4096>] [--brush <id>] [--wet-mode <0|1>] [--texture <mask id>] [--drive <stop|lift|decay|mouse|mouse-lift|bake>] [--stroke-size <1..400>] [--dry <0..100>] [--feather <0..100>] [--release <0..1>]   (e.g. neutral-identity)',
  )
  console.error(
    '       every operand except --gate is optional and additive; an omitted operand writes no key/value, so the neutral gate keeps reproducing the committed baseline',
  )
  process.exit(1)
}
if (!/^[A-Za-z0-9._-]+$/.test(gate)) {
  console.error(`invalid --gate "${gate}" (letters, digits, dot, underscore, hyphen only)`)
  process.exit(1)
}

// 64-03: optional thickness knob. Omitted means the neutral (absent-key)
// script — the exact pre-milestone stroke the baseline captured.
// quick 261123-hr5: SIGNED band (-100..100) — the negative half erodes
// thickness, and on `emboss-smooth` this operand is the smooth value.
const embossFlag = args.indexOf('--emboss')
const embossRaw = embossFlag >= 0 ? args[embossFlag + 1] : undefined
let emboss
if (embossRaw !== undefined) {
  emboss = Number(embossRaw)
  if (!Number.isFinite(emboss) || emboss < -100 || emboss > 100) {
    console.error(`invalid --emboss "${embossRaw}" (expected -100..100)`)
    process.exit(1)
  }
}

// 64-04: optional light-intensity knob (0..4). Omitted keeps the default.
const lightFlag = args.indexOf('--light')
const lightRaw = lightFlag >= 0 ? args[lightFlag + 1] : undefined
let light
if (lightRaw !== undefined) {
  light = Number(lightRaw)
  if (!Number.isFinite(light) || light < 0 || light > 4) {
    console.error(`invalid --light "${lightRaw}" (expected 0..4)`)
    process.exit(1)
  }
}

// 64-06: optional Body knob (0..100). Omitted keeps the neutral bag.
const bodyFlag = args.indexOf('--body')
const bodyRaw = bodyFlag >= 0 ? args[bodyFlag + 1] : undefined
let body
if (bodyRaw !== undefined) {
  body = Number(bodyRaw)
  if (!Number.isFinite(body) || body < 0 || body > 100) {
    console.error(`invalid --body "${bodyRaw}" (expected 0..100)`)
    process.exit(1)
  }
}

// 64-06: optional scenario. Omitted keeps the plan-01 single stroke.
// quick-261117-tq7 adds `cover-over-wet` (cover geometry, dark entry mobile).
// 64-17 adds `watercolor-50` (the 50-rapid-stroke identity passage) and
// `white-over-blue` (the criterion-1 crossing); 64-14 adds `cover-advect`
// (cover geometry, covering stroke left wet) and `cover-lift` (fixed cover
// geometry, then a Lift stroke); 64-24 adds `bristle-wet` (two ages on one
// sheet); 64-29 adds `bristle-tip` (the texture-tip A/B); quick 261123-hr5
// adds `emboss-smooth` (the signed-emboss smoothing relation); quick
// 261125-kvl adds `edge-layer` (the per-stroke translucent stroke layer). This
// closed list and probe.ts readScenario's must stay literal-identical.
const scenarioFlag = args.indexOf('--scenario')
const scenarioRaw = scenarioFlag >= 0 ? args[scenarioFlag + 1] : undefined
let scenario
if (scenarioRaw !== undefined) {
  if (scenarioRaw !== 'cover' && scenarioRaw !== 'cover-over-wet' && scenarioRaw !== 'watercolor-50' && scenarioRaw !== 'white-over-blue' && scenarioRaw !== 'cover-advect' && scenarioRaw !== 'cover-lift' && scenarioRaw !== 'cover-textured' && scenarioRaw !== 'red-over-blue-50' && scenarioRaw !== 'bristle-edge' && scenarioRaw !== 'bristle-wet' && scenarioRaw !== 'bristle-line' && scenarioRaw !== 'bristle-tip' && scenarioRaw !== 'bristle-end' && scenarioRaw !== 'emboss-smooth' && scenarioRaw !== 'edge-layer') {
    console.error(
      `invalid --scenario "${scenarioRaw}" (expected "cover", "cover-over-wet", "watercolor-50", "white-over-blue", "cover-advect", "cover-lift", "cover-textured", "red-over-blue-50", "bristle-edge", "bristle-wet", "bristle-line", "bristle-end", "emboss-smooth", "edge-layer" or "bristle-tip")`,
    )
    process.exit(1)
  }
  scenario = scenarioRaw
}

// quick 261125-kvl (Spec 10): the two edge knobs — Edge transparency (the
// layer alpha amount) and Edge falloff (the band's shape bias). Integers
// 0..100; omitted keeps the canonical defaults 0 / 50. `edge-layer` only:
// any other scenario is refused here first, never silently ignored.
const edgeFlag = args.indexOf('--edge')
const edgeRaw = edgeFlag >= 0 ? args[edgeFlag + 1] : undefined
let edge
if (edgeRaw !== undefined) {
  const value = Number(edgeRaw)
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    console.error(`invalid --edge "${edgeRaw}" (expected an integer 0..100)`)
    process.exit(1)
  }
  if (scenario !== 'edge-layer') {
    console.error('--edge is only valid with --scenario edge-layer')
    process.exit(1)
  }
  edge = value
}

const falloffFlag = args.indexOf('--falloff')
const falloffRaw = falloffFlag >= 0 ? args[falloffFlag + 1] : undefined
let falloff
if (falloffRaw !== undefined) {
  const value = Number(falloffRaw)
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    console.error(`invalid --falloff "${falloffRaw}" (expected an integer 0..100)`)
    process.exit(1)
  }
  if (scenario !== 'edge-layer') {
    console.error('--falloff is only valid with --scenario edge-layer')
    process.exit(1)
  }
  falloff = value
}

// 261126 (Spec 10 pickup leg): Pickup — the ONE carrier/deposit knob
// (canonical 0..100). Omitted keeps the acrylic record's canonical 100, so
// the committed edge-layer baseline is unchanged; the operand exists so a
// capture can carry the pickup-0 control over the SAME scene. `edge-layer`
// only, refused elsewhere here first.
const pickupFlag = args.indexOf('--pickup')
const pickupRaw = pickupFlag >= 0 ? args[pickupFlag + 1] : undefined
let pickup
if (pickupRaw !== undefined) {
  const value = Number(pickupRaw)
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    console.error(`invalid --pickup "${pickupRaw}" (expected an integer 0..100)`)
    process.exit(1)
  }
  if (scenario !== 'edge-layer') {
    console.error('--pickup is only valid with --scenario edge-layer')
    process.exit(1)
  }
  pickup = value
}

// 261126 (Spec 10 pickup leg): the wet-under control — skip the explicit fix
// after the FIRST stroke so its last-touch stamp survives into the second
// stroke's gather. `edge-layer` only; the shipped scene stays dry-under.
const wetUnder = args.includes('--wet-under')
if (wetUnder && scenario !== 'edge-layer') {
  console.error('--wet-under is only valid with --scenario edge-layer')
  process.exit(1)
}

// 64-10: optional square-sheet size. Omitted keeps the phase-default sheet,
// so the neutral gate still reproduces the committed 256x256 baseline.
const sizeFlag = args.indexOf('--size')
const sizeRaw = sizeFlag >= 0 ? args[sizeFlag + 1] : undefined
let size
if (sizeRaw !== undefined) {
  size = Number(sizeRaw)
  if (!Number.isInteger(size) || size < 32 || size > 4096) {
    console.error(`invalid --size "${sizeRaw}" (expected an integer 32..4096)`)
    process.exit(1)
  }
}

// 64-16: the brush operand. Only an empty token / a missing value is rejected
// here — the page resolves the id against BRUSH_PRESETS and throws with the
// known list, so the id list stays in one place.
const brushFlag = args.indexOf('--brush')
const brush = brushFlag >= 0 ? args[brushFlag + 1] : undefined
if (brush !== undefined && (brush === '' || brush.startsWith('--'))) {
  console.error(`invalid --brush "${brush}" (expected a non-empty brush id)`)
  process.exit(1)
}

// 2026-11-22: the bristle-line stroke's own `size` key — the canvas flag
// `--size` already owns the sheet dimension, so the pale-line size sweep
// needs this separate operand. Refused for every other scenario here first.
// quick 261125-rtc: the band widens to 1..400 — the artist's end-block sweep
// reaches the canonical Size 300 (effective 16x sampling), which the old
// 200 ceiling refused.
const strokeSizeFlag = args.indexOf('--stroke-size')
const strokeSizeRaw = strokeSizeFlag >= 0 ? args[strokeSizeFlag + 1] : undefined
let strokeSize
if (strokeSizeRaw !== undefined) {
  const value = Number(strokeSizeRaw)
  if (!Number.isFinite(value) || value < 1 || value > 400) {
    console.error(`invalid --stroke-size "${strokeSizeRaw}" (expected 1..400)`)
    process.exit(1)
  }
  if (scenario !== 'bristle-line' && scenario !== 'bristle-end') {
    console.error('--stroke-size is only valid with --scenario bristle-line or bristle-end')
    process.exit(1)
  }
  strokeSize = value
}

// 2026-11-22: the across band the line profile samples. A large brush is
// wider than the ±48 default, and the lane must be judged against the
// stroke's true support; bristle-line only, refused elsewhere here first.
const mutFlag = args.indexOf('--mut')
const mutRaw = mutFlag >= 0 ? args[mutFlag + 1] : undefined
let mut
if (mutRaw !== undefined) {
  const value = Number(mutRaw)
  if (!Number.isFinite(value) || value < 0) {
    console.error(`invalid --mut "${mutRaw}" (expected a non-negative integer)`)
    process.exit(1)
  }
  if (scenario !== 'bristle-line' && scenario !== 'bristle-end') {
    console.error('--mut is only valid with --scenario bristle-line or bristle-end')
    process.exit(1)
  }
  mut = Math.floor(value)
}

const bandFlag = args.indexOf('--band')
const bandRaw = bandFlag >= 0 ? args[bandFlag + 1] : undefined
let band
if (bandRaw !== undefined) {
  const value = Number(bandRaw)
  if (!Number.isFinite(value) || value < 16 || value > 400) {
    console.error(`invalid --band "${bandRaw}" (expected 16..400)`)
    process.exit(1)
  }
  if (scenario !== 'bristle-line' && scenario !== 'bristle-end') {
    console.error('--band is only valid with --scenario bristle-line or bristle-end')
    process.exit(1)
  }
  band = Math.round(value)
}

// 2026-11-22: the `--over` understory — a bare flag, accepted only for the
// bristle-line scenario. File the capture under `bristle-line` (bare paper)
// or `bristle-line-over` (wet understory); both gate ids dispatch to the same
// comparator bars, so only the capture's own readings differ.
const overFlag = args.indexOf('--over')
let over
if (overFlag >= 0) {
  if (scenario !== 'bristle-line') {
    console.error(
      '--over is only valid with --scenario bristle-line (file the capture as bristle-line or bristle-line-over)',
    )
    process.exit(1)
  }
  over = 1
}

// 64-24: the §3.4 A/B mode. Omitted keeps the probe's default (1, the
// shipped timestamp law); 0 selects 64-21's `wet × coverage` proxy, the
// recorded control. A value the page would refuse is refused here first.
const wetModeFlag = args.indexOf('--wet-mode')
const wetModeRaw = wetModeFlag >= 0 ? args[wetModeFlag + 1] : undefined
let wetMode
if (wetModeRaw !== undefined) {
  if (wetModeRaw !== '0' && wetModeRaw !== '1') {
    console.error(`invalid --wet-mode "${wetModeRaw}" (expected 0 or 1)`)
    process.exit(1)
  }
  wetMode = Number(wetModeRaw)
}

// 64-29: the texture-tip A/B's masked leg. The id rides the one bristle line
// as `brush.textureId`; the probe registers its own deterministic mask under
// `probe/tip-ab`, so the flag is a selector, never a file path. bristle-tip
// only — any other scenario would paint a line this gate cannot judge.
const textureFlag = args.indexOf('--texture')
const textureRaw = textureFlag >= 0 ? args[textureFlag + 1] : undefined
let texture
if (textureRaw !== undefined) {
  if (textureRaw === '' || textureRaw.startsWith('--')) {
    console.error(`invalid --texture "${textureRaw}" (expected a non-empty mask id)`)
    process.exit(1)
  }
  if (scenario !== 'bristle-tip') {
    console.error('--texture is only valid with --scenario bristle-tip')
    process.exit(1)
  }
  texture = textureRaw
}

// bristle-end (2026-11-23): which end path the capture drives. One stroke per
// capture; the value is a closed list so an unknown drive can never fall back
// to a capture that judges something else. bristle-end only.
const driveFlag = args.indexOf('--drive')
const driveRaw = driveFlag >= 0 ? args[driveFlag + 1] : undefined
let drive
if (driveRaw !== undefined) {
  if (
    driveRaw !== 'stop' && driveRaw !== 'lift' && driveRaw !== 'decay' &&
    driveRaw !== 'mouse' && driveRaw !== 'mouse-lift' && driveRaw !== 'bake'
  ) {
    console.error(
      `invalid --drive "${driveRaw}" (expected "stop", "lift", "decay", "mouse", "mouse-lift" or "bake")`,
    )
    process.exit(1)
  }
  if (scenario !== 'bristle-end') {
    console.error('--drive is only valid with --scenario bristle-end')
    process.exit(1)
  }
  drive = driveRaw
}

// quick 261125-rtc: the end journal's bag overrides and the release-pressure
// axis. `--dry` and `--feather` are the acrylic record's own two keys (the
// artist's cells: Dry 0 and 70, Feather 100), folded into every stroke's
// params bag; `--release` replaces the LAST authored sample's pressure so the
// release catch-up is captured at its actual pressure. All three are
// bristle-end only, and `--release` is refused on the paths whose release
// pressure the script's own points define (only stop and bake are overridable;
// the default stop cell already authors 0.75).
const readEndPercent = (flagName) => {
  const flag = args.indexOf(flagName)
  const raw = flag >= 0 ? args[flag + 1] : undefined
  if (raw === undefined) return undefined
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    console.error(`invalid ${flagName} "${raw}" (expected an integer 0..100)`)
    process.exit(1)
  }
  if (scenario !== 'bristle-end') {
    console.error(`${flagName} is only valid with --scenario bristle-end`)
    process.exit(1)
  }
  return value
}
const dry = readEndPercent('--dry')
const feather = readEndPercent('--feather')

const releaseFlag = args.indexOf('--release')
const releaseRaw = releaseFlag >= 0 ? args[releaseFlag + 1] : undefined
let release
if (releaseRaw !== undefined) {
  const value = Number(releaseRaw)
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    console.error(`invalid --release "${releaseRaw}" (expected 0..1)`)
    process.exit(1)
  }
  if (scenario !== 'bristle-end') {
    console.error('--release is only valid with --scenario bristle-end')
    process.exit(1)
  }
  if (drive !== undefined && drive !== 'stop' && drive !== 'bake') {
    console.error(`--release is refused on the "${drive}" drive (stop and bake only)`)
    process.exit(1)
  }
  release = value
}

const pageQuery =
  `gate=${encodeURIComponent(gate)}` +
  (scenario === undefined ? '' : `&scenario=${scenario}`) +
  (edge === undefined ? '' : `&edge=${edge}`) +
  (falloff === undefined ? '' : `&falloff=${falloff}`) +
  (pickup === undefined ? '' : `&pickup=${pickup}`) +
  (wetUnder ? '&wetUnder=1' : '') +
  (emboss === undefined ? '' : `&emboss=${emboss}`) +
  (body === undefined ? '' : `&body=${body}`) +
  (light === undefined ? '' : `&light=${light}`) +
  (size === undefined ? '' : `&size=${size}`) +
  (brush === undefined ? '' : `&brush=${encodeURIComponent(brush)}`) +
  (strokeSize === undefined ? '' : `&strokeSize=${strokeSize}`) +
  (band === undefined ? '' : `&band=${band}`) +
  (mut === undefined ? '' : `&mut=${mut}`) +
  (over === undefined ? '' : '&over=1') +
  (wetMode === undefined ? '' : `&wetMode=${wetMode}`) +
  (texture === undefined ? '' : `&texture=${encodeURIComponent(texture)}`) +
  (drive === undefined ? '' : `&drive=${encodeURIComponent(drive)}`) +
  (dry === undefined ? '' : `&dry=${dry}`) +
  (feather === undefined ? '' : `&feather=${feather}`) +
  (release === undefined ? '' : `&release=${release}`)
const resultPath = join(outDir, `${gate}.json`)

const esbuildCandidates = [
  join(repoRoot, 'node_modules/.pnpm/esbuild@0.27.7/node_modules/esbuild/bin/esbuild'),
  join(repoRoot, 'node_modules/.bin/esbuild'),
]
const esbuild = esbuildCandidates.find((path) => existsSync(path))
if (!esbuild) {
  console.error('esbuild not found; candidates:\n  ' + esbuildCandidates.join('\n  '))
  process.exit(1)
}

const chromeCandidates = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
]
const chrome = chromeCandidates.find((path) => existsSync(path))
if (!chrome) {
  console.error('Chrome/Chromium not found; candidates:\n  ' + chromeCandidates.join('\n  '))
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })

console.log(`[probe] bundling probe.ts (gate=${gate}) ...`)
const build = spawnSync(
  esbuild,
  [
    join(here, 'probe.ts'),
    '--bundle',
    '--format=iife',
    '--platform=browser',
    '--target=es2022',
    '--log-level=warning',
    `--outfile=${bundlePath}`,
  ],
  { encoding: 'utf8' },
)
if (build.status !== 0) {
  console.error(build.stderr || build.stdout || 'esbuild failed')
  process.exit(build.status ?? 1)
}
if (build.stderr.trim()) console.error(build.stderr.trim())

console.log('[probe] running headless Chrome (WebGL2) ...')
const t0 = Date.now()
const run = spawnSync(
  chrome,
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader',
    '--hide-scrollbars',
    '--window-size=512,512',
    '--allow-file-access-from-files',
    '--dump-dom',
    `file://${join(here, 'index.html')}?${pageQuery}`,
  ],
  { encoding: 'utf8', timeout: 600000, maxBuffer: 64 * 1024 * 1024 },
)
const elapsedMs = Date.now() - t0
if (run.error) {
  console.error('[probe] Chrome failed:', run.error.message)
  process.exit(1)
}

const dom = run.stdout ?? ''
const match = dom.match(/<pre id="result"[^>]*>([\s\S]*?)<\/pre>/)
const statusMatch = dom.match(/<p id="status">([\s\S]*?)<\/p>/)
const status = statusMatch ? statusMatch[1].trim() : '(missing)'

function unescapeHtml(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

if (!match || match[1].trim().length === 0) {
  console.error(`[probe] no result element content (status=${status}, chrome exit=${run.status}, ${elapsedMs} ms)`)
  if (run.stderr) console.error(run.stderr.slice(0, 4000))
  writeFileSync(join(outDir, 'dom.html'), dom)
  console.error(`[probe] DOM saved to ${join(outDir, 'dom.html')}`)
  process.exit(1)
}

let result
try {
  result = JSON.parse(unescapeHtml(match[1]))
} catch (error) {
  writeFileSync(join(outDir, 'dom.html'), dom)
  console.error(`[probe] result JSON parse failed: ${error.message} (DOM saved to ${join(outDir, 'dom.html')})`)
  process.exit(1)
}

// 64-17: four digests — a capture that fails to produce the coverage sheet is
// refused instead of being compared on the three backgrounds alone.
const digests = ['digestPaper', 'digestTransparent', 'digestWhite', 'digestPigment']
const missing = digests.filter((key) => typeof result[key] !== 'string')
if (missing.length > 0) {
  console.error(`[probe] result is missing ${missing.join(', ')} (verdict=${result.verdict ?? '(missing)'})`)
  if (result.error) console.error(`[probe] probe error: ${result.error}`)
  writeFileSync(join(outDir, 'dom.html'), dom)
  console.error(`[probe] DOM saved to ${join(outDir, 'dom.html')}`)
  process.exit(1)
}
if (result.gate !== gate) {
  console.error(`[probe] result gate "${result.gate}" does not match request "${gate}"`)
  process.exit(1)
}

// 2026-11-22 (bristle-line): the report carries up to three PNG data URLs.
// Write them BESIDE the JSON and strip the base64 from the saved record, so
// the JSON stays the small comparable capture and the images stay on disk.
// A scenario that emits no PNG keeps this block inert.
const pngPaths = {}
for (const [key, kind] of [
  ['pngTransparent', 'transparent'],
  ['pngCoverage', 'coverage'],
  ['pngPigment', 'pigment'],
  // bristle-end (2026-11-23): the 2x start/end crops beside the full sheet,
  // plus the end crop in the engine's pigment and coverage channels.
  ['pngStart', 'start'],
  ['pngEnd', 'end'],
  ['pngEndPigment', 'end-pigment'],
  ['pngEndCoverage', 'end-coverage'],
]) {
  const url = result[key]
  if (typeof url !== 'string') continue
  const encoded = url.match(/^data:image\/png;base64,(.*)$/s)
  if (!encoded) {
    console.error(`[probe] ${key} is not a PNG data URL; left in the JSON`)
    continue
  }
  const path = join(outDir, `${gate}-${kind}.png`)
  writeFileSync(path, Buffer.from(encoded[1], 'base64'))
  delete result[key]
  pngPaths[kind] = path
}

// Keep the capture pristine: wall clock and machine strings are printed,
// never written, so the JSON is exactly the rendered-bytes record.
writeFileSync(resultPath, JSON.stringify(result, null, 2) + '\n')

console.log('')
console.log('================ medium-engine pixel gate ================')
console.log(`gate      : ${result.gate}`)
console.log(`scenario  : ${result.scenario ?? '(neutral)'}`)
console.log(`brush     : ${result.brush ?? '(default)'}`)
console.log(`emboss    : ${result.emboss === null ? '(absent)' : result.emboss}`)
console.log(`body      : ${result.body === null ? '(absent)' : result.body}`)
console.log(`light     : ${result.light === null ? '(default)' : result.light}`)
console.log(`bake      : ${result.bakeMs ?? 'n/a'} ms (script + settle, exports excluded)`)
console.log(`render    : ${result.renderMs ?? 'n/a'} ms (exports + readbacks)`)
console.log(`sheet     : ${result.width}x${result.height} (${result.byteLength} bytes/export)`)
console.log(`renderer  : ${result.renderer ?? 'n/a'}`)
console.log(`paper     : ${result.digestPaper}`)
console.log(`transparent: ${result.digestTransparent}`)
console.log(`white     : ${result.digestWhite}`)
console.log(`pigment   : ${result.digestPigment}`)
if (typeof result.coverCoverageP10 === 'number') {
  console.log(
    `spread    : P10 ${result.coverCoverageP10} | P90 ${result.coverCoverageP90} | covered ${result.coverCoverageCoveredFraction} | blue ${result.coverCrossBlueExcess} | mean ${result.coverCoverageMean} | paperWhite ${result.coveredPaperWhitePct}%`,
  )
}
if (typeof result.lumaRatio === 'number') {
  console.log(
    `criterion2: luma ${result.finalLuma} / ${result.referenceLuma} = ${result.lumaRatio} | hue ${result.deltaHue} deg | paperWhite ${result.coveredPaperWhitePct}%`,
  )
}
if (typeof result.pickupFreshMean === 'number') {
  console.log(
    `wetness   : mode ${result.wetMode} | fresh ${result.pickupFreshMean} | agedWet ${result.pickupAgedWetMean} (band darkness, 0..255)`,
  )
}
if (typeof result.edgeAmount === 'number') {
  console.log(
    `edge      : amount ${result.edgeAmount} | falloff ${result.edgeFalloff} | layer ${result.layerAllocated ?? 'absent'} | merge draws ${result.mergeDraws ?? 'absent'} (first ${result.mergeDrawsFirst ?? 'absent'})`,
  )
  console.log(
    `edge      : sweep midAlpha paper ${result.edgeMidAlphaPaper ?? 'absent'} / under ${result.edgeMidAlphaUnder ?? 'absent'} | core ${result.edgeCoreExactPaper ?? 'absent'} / ${result.edgeCoreExactUnder ?? 'absent'} | continuity ${result.edgeContinuityPaper ?? 'absent'} / ${result.edgeContinuityUnder ?? 'absent'}`,
  )
  console.log(
    `edge      : lateral u=1 at ${result.edgeLateralSatPaper ?? 'absent'} / ${result.edgeLateralSatUnder ?? 'absent'} px | cover half ${result.edgeCoverHalfPaper ?? 'absent'} / ${result.edgeCoverHalfUnder ?? 'absent'} | cover 5% ${result.edgeCoverReachPaper ?? 'absent'} / ${result.edgeCoverReachUnder ?? 'absent'} | solid band ${result.edgeSolidHalfPaper ?? 'absent'} / ${result.edgeSolidHalfUnder ?? 'absent'} (aEff >= 0.9; paper/under)`,
  )
  console.log(
    `edge      : encode max ${result.edgeEncodeMax ?? 'absent'} | p95 ${result.edgeEncodeP95 ?? 'absent'} | over ${result.edgeEncodeOver ?? 'absent'} (1/255, coefficient mix)`,
  )
  console.log(
    `edge      : polish max ${result.edgePolishMax ?? 'absent'} | p95 ${result.edgePolishP95 ?? 'absent'} | over ${result.edgePolishOver ?? 'absent'} (p95 bar 1/255; rim max/over reported — UAT row 6 judges the settle)`,
  )
  console.log(
    `edge      : capture round trip ${result.edgeCaptureRoundTrip ?? 'absent'} | replay identical ${result.edgeReplayIdentical ?? 'absent'} | print ${result.edgePrintRetentionPaper ?? 'absent'} / ${result.edgePrintRetentionUnder ?? 'absent'}`,
  )
}
if (result.lineSurfaces && typeof result.lineSurfaces === 'object') {
  console.log(`params    : ${JSON.stringify(result.paramsEcho ?? null)}`)
  console.log(`body      : override ${result.lineBodyOverride} | record ${result.recordBody} (the record is NOT changed)`)
  for (const [surface, set] of Object.entries(result.lineSurfaces)) {
    const inner = set?.interior ?? {}
    const fmt = (s) => (s ? `min ${s.min} @ ${s.at >= 0 ? '+' : ''}${s.at} px` : 'n/a')
    console.log(
      `surface ${surface}: interior ${inner.span?.[0] ?? '?'}..${inner.span?.[1] ?? '?'} px | cover ${fmt(inner.cover)} | dark ${fmt(inner.dark)} | ink ${fmt(inner.ink)}`,
    )
  }
  for (const [kind, path] of Object.entries(pngPaths)) console.log(`png ${kind}: ${path}`)
}
console.log(`result JSON: ${resultPath}`)
console.log(`total probe: ${elapsedMs} ms`)
console.log('=========================================================')
