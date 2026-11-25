---
phase: 261125-rtc
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/efx-watercolor/probe/medium-engine/probe.ts
  - packages/efx-watercolor/probe/medium-engine/run.mjs
  - packages/efx-watercolor/probe/medium-engine/harness.test.ts
  - packages/efx-watercolor/probe/medium-engine/end-density.mjs
  - packages/efx-watercolor/src/playground/shaders.ts
  - packages/efx-watercolor/src/playground/bristles.ts
  - packages/efx-watercolor/src/playground/Engine.ts
  - packages/efx-watercolor/src/adapter/engineAdapter.ts
  - packages/efx-watercolor/src/playground/scattering.test.ts
  - packages/efx-watercolor/probe/medium-engine/baselines/edge-layer-neutral.json
autonomous: true
requirements:
  - RTC-PROBE
  - RTC-MATRIX
  - RTC-END-DENSITY
  - RTC-BAKE-PARITY
  - RTC-BODY-INERT
  - RTC-NO-LANE
  - RTC-DETERMINISM
  - RTC-UAT-HANDOFF
estimate:
  tokens: 90000
  raw_tokens: 90000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - "The medium-engine probe's bristle-end and bristle-line scenarios run the real bristle-round (Gouache) response on both the live and the bake lane: the report echoes bristle-round on all 41 captures; every one of the 33 bristle-end captures (20 matrix + 12 release + 1 lift) carries a populated census with gather calls greater than zero, taps greater than zero and its own drive name; and every one of the 8 pale-line captures is proven on the `lineSurfaces` tiling (ENCLOSED, coherence) and halo readings its own report carries."
    - "Before any law change, the terminal density block reproduces on the repointed probe at Dry 70 (pigment end-zone mean minus body-zone mean at least 0.02 at stroke size 300 and at least 0.01 at stroke size 100). (Task 1, committed; not re-opened.)"
    - "The bar is re-declared on the measured visible block before any law: the end window is anchored to the last recorded census dab at [lastTap − 2.4r, lastTap + 1.05r] with lastTap from endCensus.last40 and r = strokeSize/2 document px (raster-clamped), the metrics are the raw pigment zone mean, the coverage inked share and the visible-composite mean, their tolerances are 0.02 / 0.03 / 0.02, and that declaration plus the per-cell report is written into the plan and mirrored in the SUMMARY before the first shader edit."
    - "If and only if the re-measurement's sign verdict is UNIFORM on all three series (raw pigment, coverage inked share, visible composite) across the 32 matrix and release cells, one relative law lands: then every one of those cells reads |end − body| within 0.02 on the raw pigment mean, 0.03 on the coverage inked share and 0.02 on the visible composite on the frozen window. If the verdict is OPPOSITE on any series, no shader, constant, uniform, adapter or pin file moves and the SUMMARY reports the measured gaps and the stop as the quick's valid outcome. The lift cell is an OBSERVATION cell asserted only to its declared non-regression band: no admissible stamp-time trigger reaches the live lift's pre-release dabs, so its verdict belongs to the live UAT, never to a bar it cannot reach."
    - "The body and start zones stay within the declared drift on every one of the 33 bristle-end cells: the fix changes the end, never the reference."
    - "The end silhouette stays ragged (flatPct and longestFlatRunPx bars) and the pale-line tiling (ENCLOSED, coherence) and halo readings do not regress versus the pre-fix bristle-round captures."
    - "On the UNIFORM verdict, the law is one gather change with one named bound constant and one uniform, relative to the stroke's own moving-dab terms (no fixed end-to-body delta, no per-size/per-dry table), deterministic across two identical runs (byte-identical digests); a diff-scope gate over `git diff --name-only b12d769b1` passes with no path touched outside the plan's declared file set (plus `.planning/`), so no Spec 10 layer, edge-parameter or composite-law source moves."
  artifacts:
    - path: packages/efx-watercolor/probe/medium-engine/probe.ts
      provides: "bristle-end/bristle-line repointed to bristle-round; dry/feather/release operands; the census-anchored visible-block window (lastTap from endCensus.last40, r = strokeSize/2) with raw-pigment, coverage-inked and visible-composite zone reads on that window; one shared tap+gather census installed before the drive branch and reported as endCensus for BOTH lanes (the bake included); end-setup echo"
    - path: packages/efx-watercolor/probe/medium-engine/run.mjs
      provides: "the new flag contract (dry, feather, release, stroke-size up to 400) validated at the CLI before any capture runs"
    - path: packages/efx-watercolor/probe/medium-engine/end-density.mjs
      provides: "the re-declared bar as executable code over paired rtc-pre-/rtc-post- captures: the frozen census-anchored window, the three metrics and tolerances, the per-cell report and the per-series sign verdict"
    - path: packages/efx-watercolor/src/playground/shaders.ts
      provides: "the ONE relative gather law over the terminal dab chain"
    - path: packages/efx-watercolor/src/playground/bristles.ts
      provides: "the law's named bound constant (the BRISTLE_TAKEOFF_SHIFT precedent)"
    - path: packages/efx-watercolor/src/playground/scattering.test.ts
      provides: "the exact-literal pins of the new law, the named bound's value pin, and every pre-existing negative pin, kept verbatim"
  key_links:
    - from: packages/efx-watercolor/probe/medium-engine/probe.ts
      to: packages/efx-watercolor/src/playground/shaders.ts
      via: "gather uniforms bound in Engine.bindGather and consumed by gatherBristle; the census proves both lanes reach bristleInk"
    - from: packages/efx-watercolor/src/playground/Engine.ts
      to: packages/efx-watercolor/src/playground/shaders.ts
      via: "bindGather binds the law's uniform per dab (the uTakeoffShift and uEndCap precedents)"
    - from: packages/efx-watercolor/src/adapter/engineAdapter.ts
      to: packages/efx-watercolor/src/playground/Engine.ts
      via: "when the chosen law needs a terminal signal, the adapter's final fed sample marks it before that sample's tick; the live lane's equivalent is the ending tick's catch-up dab. Neither reaches the moving lift's pre-release dabs, which is why the lift cell is an observation cell and not a bar"
    - from: packages/efx-watercolor/probe/medium-engine/end-density.mjs
      to: packages/efx-watercolor/probe/medium-engine/probe.ts
      via: "reads the census-anchored density block the probe writes into every bristle-end capture - including the bake lane: density.window { lastTapX, radiusPx, lo, hi, widthPx } and density.zones.transparent|pigment|coverage|visible { body|end { mean, inked } }; one census installed before the drive branch spans the adapter's script loop on the same captured engine, so the bake report carries taps, endCaps, last40 and endCapCalls exactly like a live capture and its last40 attests the window anchor"
---

<objective>
Fix the Gouache (bristle-round) stroke's terminal density block at Edge transparency 0 (Spec 10
bypassed, amount-0 identity): at Dry 0 and Dry 70, sizes 50/100/150/200/300, a press-move-release
stroke ends in a dark full-width block whose area grows with brush size while the body reads
lighter. The 2026-11-23 takeoff law fixed the terminal SILHOUETTE and left this residual DEPOSIT
block to live UAT; the artist has now confirmed it across the five-size sweep.

Purpose: measure the block through the real engine on the real bristle path, then change ONE
gather law that makes the end read at the body's density on both the live stop and the bake lane,
without touching the body, the landing ramp, the silhouette or the pale-line floors.

The first measurement diagnosed its own bar as wrong: the old end window started 26.7-48.8
document px AHEAD of the last recorded dab in every cell, sampling the leading frontier of the
terminal dabs where a trailing-side law is inert. The bar is therefore re-declared on the measured
visible block (census-anchored window, raw pigment + coverage-inked + visible-composite metrics)
and FROZEN before any law; the law lands only if the re-measured sign is uniform, otherwise the
plan stops and reports.

Output: a repaired probe (the bristle scenarios previously resolved to the watercolor round
fallback because `bristle-flat` was retired by 261124-iq9), a re-declared bar with a 41-cell
pre-fix matrix re-measured on the visible-block window (20 stop+bake cells, a 12-cell
release-pressure sweep at the two sampling extremes - sizes 100 and 300 - across both drys, one
lift observation cell and 8 pale-line cells), one proven relative law with its regression pins
(or a measured, reported stop when the signs stay opposite), a deliberate edge-layer-neutral
re-capture if the shipped gather moves it, and 10 live UAT rows handed off unclaimed.

The lift cell is measured, reported and paired pre/post, but never asserted to the absolute bar:
the live lane stamps its terminal dabs before it knows the stroke ended, the catch-up dab cannot
lighten committed film, and a pressure-collapse gate would fire mid-stroke on every
pressure-linked taper. The lift's verdict therefore belongs to the press-move-release UAT rows;
a lift that still blocks is reported, never silently passed.

Execution shape: Task 1 is the tracer - one capture end-to-end through the repaired probe, proving
the measurement pipeline on the real brush before any matrix expansion (complete: commit
d79f9e48a, not re-opened). Task 2 freezes the re-declared visible-block bar,
implements it in the probe and the checker, re-measures the full matrix with NO law change, and
reports the per-series sign verdict (commit 3e1112d69 belongs to the first Task 2, the 41-cell pre
matrix; this re-scoped Task 2 replaces it). Task 3 implements and proves the ONE relative law against the
frozen bar ONLY if that verdict is uniform; if the signs stay opposite it stops and reports, which
completes the quick.

Scope guards: no Spec 10 layer code (deposit routing, lateral field, merge, display branch,
encoder - FROZEN per 261125-kvl), no edgeFade/edgeFalloff, no composite-law change, no depth fade,
no law triggered only by the live release event (the bake must receive the same law), no
catch-up-only patch. Release pressure was probed as a measured candidate trigger: the committed
sweep reads it inert at s100 (bit-identical rp10/50/90), so it is not the law's lever and the law
need not depend on it. `bristle-edge`, `bristle-wet` and
`bristle-tip` stay on their current ids in this quick: their committed baselines are keyed to the
pre-261124 subject and repointing them is a separate re-capture; Task 1 records that finding, it
does not change them.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@/Users/lmarques/Dev/efx-motion-editor/.planning/quick/261125-rtc-fix-the-bristle-brush-s-end-cap-density-/261125-rtc-CONTEXT.md
@/Users/lmarques/Dev/efx-motion-editor/.planning/quick/261125-rtc-fix-the-bristle-brush-s-end-cap-density-/261125-rtc-RESEARCH.md
@/Users/lmarques/Dev/efx-motion-editor/.planning/debug/resolved/acrylic-stroke-end-cap.md

Do not load the three engine sources whole - shaders.ts, bristles.ts and mediums.ts together are
about 35k tokens, more than half of it irrelevant to this quick. Read only these ranges:
shaders.ts 1096-1220 (gather, takeoff), 1250-1309 (cap, coverage, inked), 1340-1414 (deposit
lerp, coverage write); bristles.ts 130-214 (constants, sample table) and 294-344 (contact
pressure); mediums.ts 104-153 (the acrylic record).

Probe anchors verified at HEAD b12d769b1 (read these ranges, do not assume drift is safe):
probe.ts `bristleLineParams` 1847, `readStrokeSize` 1935, `configureLiveEnd` 4504,
`driveBristleEnd` 4558, `bristleEndMetrics` 4665, `endEdgeStats` 4626, `bristleEndScript` 4876,
`resolvedBrush` 5112, the bristle-end scenario call 5142-5143, the live drive call 5219-5220,
the end report 5522-5538. run.mjs flag contract header 100-260, `--stroke-size` 407-421,
`--mut`/`--band` 426-455, `--drive` 510-528, `pageQuery` 530-546, bundle and Chrome 549-607.
Harness pins harness.test.ts 580, 736, 833. Engine catch-up 3067-3077, `bindGather` 3960-4044
(`uTakeoffShift` 3990, `uEndCap` 4003), `bristleInk` 4073. Adapter `feedDueSample` 477-521.
Gather literals scattering.test.ts 1370-1439 and the `stamp` call pin 695. Bristle constants
bristles.ts 130-214, `bristleContactPressure` 320-344.

After the Task 1/Task 2 commits (d79f9e48a, 3e1112d69) the probe anchors drifted; re-grep before
editing: probe.ts `driveBristleEnd` ~4652, `bristleEndMetrics` ~4757 (density zones ~4917-5010),
`bristleEndScript` ~5046, the shared census install ~5409-5441, the bristle-end report object
~5745-5777. end-density.mjs: the bar constants ~57-100, `endReadings` ~190, the pre table ~244.
Confirm the anchor units: the census records `stampScripted`'s x as a document-width fraction
(0.85 at the drive's end x = 918 px on a 1080 sheet), and the rasters are read at that same dw.
</context>

<tasks>

<task type="tracer">
  <name>Repair the probe onto the real bristle path and reproduce the block end-to-end</name>
  <files>packages/efx-watercolor/probe/medium-engine/probe.ts, packages/efx-watercolor/probe/medium-engine/run.mjs, packages/efx-watercolor/probe/medium-engine/harness.test.ts</files>
  <action>
Repoint the end and pale-line scenarios onto the brush the artist actually holds, then prove one capture measures the defect end-to-end.

1. Repoint exactly these literals to 'bristle-round' (bristle-flat is absent from BRUSH_PRESETS since 261124-iq9, so `presetFor` silently resolves it to the watercolor 'round' and every current bristle capture measures the wrong brush):
   - `configureLiveEnd`'s `brushId` default at ~4508 (the edge-layer caller already passes 'bristle-round' explicitly at ~3472).
   - `bristleEndScript`'s entry at ~4884 (the bake lane).
   - The two `bristleLineScript`/`bristleLineOverEntry` entries at ~1883 and ~1902 - the pale-line gate must exercise the gather to be a no-lane gate at all.
   - The `resolvedBrush` chain at ~5112: keep `bristle-tip` on 'bristle-flat', and add `bristle-line` and `bristle-end` to the 'bristle-round' branch, so the report echoes the brush actually used. Do NOT touch the `bristle-edge` (1348/1356), `bristle-wet` (1702/1716/1723) or `bristleTipScript` (4967) ids: their committed baselines key to the pre-261124 subject; record that as a finding in the SUMMARY, do not repoint them here.
   - Update the exact-literal harness pin at harness.test.ts ~580 to the new chain; the pins at ~736 and ~833 stay (their literals still exist).

2. Add the end-scenario operands in BOTH files, validated before any capture runs:
   - `--stroke-size` bound widens from 1..200 to 1..400 in run.mjs (~412) and `readStrokeSize` in probe.ts (~1939); the five canonical cells are 50/100/150/200/300, and 300 is needed.
   - `--dry` and `--feather`: integers 0..100. `--release`: a finite number 0..1. All three are refused by run.mjs unless `--scenario bristle-end`, and `--release` is refused unless `--drive` is absent, 'stop' or 'bake' - the pen lanes whose end is one terminal authored pressure. `lift` and `decay` carry their own measured pressure tails (END_LIFT_PRESSURES; the 0.75-to-0.10 decay ramp) and the mouse drives keep the -1 sentinel, so an override there would silently rewrite a tail the capture is supposed to measure. Append `&dry=`, `&feather=`, `&release=` to `pageQuery`. Update the header flag contract block with the new bounds and operands.
   - In probe.ts add `readEndSetup(): { dry: number | null; feather: number | null; release: number | null }` with the same numeric validation; it is read once beside `readEndDrive()` (~5116) and passed to the drive, the script and the metrics. The probe is the second line of defence: the scenario path throws when a release override is set on a lift/mouse/mouse-lift drive, mirroring run.mjs.
   - Apply the overrides in `bristleLineParams(body, strokeSize, overrides?)` AFTER the `...acrylic.params` spread and before the pinned `body` - the acrylic record is Feather 85 and the artist's bag is Feather 100, so the override must win. Thread the setup through `driveBristleEnd`, `endDriveSamples`, `endBakePoints` and `bristleEndScript`. `--release` replaces the LAST authored pen sample's pressure (the catch-up dab then derives its own pressure from it through the engine; record the census `pr` values rather than assuming them).

3. Extend the measurement so the block is attributable per surface:
   - `bristleEndMetrics(transparent, pigment, coverage, setup)` keeps every existing key verbatim and adds `density: { endZonePx, effectiveSampleScale, zones: { transparent, pigment, coverage } }`. Each surface's zones are `body` and `end`, each `{ mean, inked }`. The end window is `max(END_BLOCK_PX, round(0.25 * thickness.body.meanPx))` ending 2 px before the measured end median (the block's area grows with the brush, so the window must scale with the measured body thickness). Readers: transparent keeps the existing min-channel darkness and `END_DARK_THRESHOLD`; pigment uses the `bandPigment` luminance reader (255 minus mean RGB, over 255) and the same threshold; coverage reads alpha/255 with a 0.5 inked threshold. `inked` is the share of zone cells at or above the surface threshold. `effectiveSampleScale = bristleSampleScale(engineScaleToSize(sizeToEngineScale(setup.strokeSize)))` - import `sizeToEngineScale`/`engineScaleToSize` from params and `bristleSampleScale` from bristles; the expected factors are 1.6/2/3/4/16 for 50/100/150/200/300.
   - Add ONE shared census, installed at ~5179 immediately after `capturedEngine` is resolved and BEFORE the drive branch, only for scenario bristle-end, covering BOTH lanes (the `stampScripted` shadow at ~4582 is the precedent). It wraps `stampScripted` on the captured engine to record every tap's x, y, authored pressure and endCap flag (keep the final 40, not 8 - the writer set must be measurable at size 300), and wraps `bristleInk` to count calls and how many ran with `bristleEndCap` true. `driveBristleEnd` takes the shared recorder as a parameter and installs no shadow of its own. The bake lane needs no second install: its entry runs through the same `adapter.applyStroke` script loop (5329-5339) on the same captured engine, so the one shadow spans it. After the script loop, `bristleEndReport` (5522) emits for BOTH lanes `endCensus: { drive, taps, endCaps, last40 }` and `gather: { calls, endCapCalls }` built from the shared recorder - a bake capture's `endCensus` is a populated object, never null. This is the proof the real gather ran on both lanes (the current broken probe would report zero), and it is the declared input Task 2 reads the bake family's tap positions from.
   - Add `endSetup: { dry, feather, release, strokeSize, brush: resolvedBrush }` (nulls where absent) to the bristle-end report; the existing `dryEcho` only fires when a script entry pins dry, and the live drive carries no entry.

4. Reproduce, do not fix. Capture the two decisive cells and assert the block and the gather proof:
   - `rtc-pre-s100-d70-stop` (size 100, Dry 70, stop, Feather 100, sheet 1080) and `rtc-pre-s300-d70-stop` (same at 300). Both names belong to Task 2's matrix; capture them now.
   - The gate: brush is 'bristle-round'; gather calls are at least 50; effectiveSampleScale is 2 at s100 and 16 at s300; the pigment end-zone mean minus the body-zone mean is at least 0.01 at s100 and at least 0.02 at s300. If either cell fails, STOP and report the measured numbers and the writer map so far - do not proceed to the matrix on a premise that did not reproduce.

No source law changes in this task. No dev server, no vitest watch, no push, no docs commits.
  </action>
  <verify>
    <automated>
pnpm --dir packages/efx-watercolor exec vitest run probe/medium-engine/harness.test.ts
node packages/efx-watercolor/probe/medium-engine/run.mjs --gate rtc-pre-s100-d70-stop --scenario bristle-end --stroke-size 100 --drive stop --dry 70 --feather 100 --size 1080
node packages/efx-watercolor/probe/medium-engine/run.mjs --gate rtc-pre-s300-d70-stop --scenario bristle-end --stroke-size 300 --drive stop --dry 70 --feather 100 --size 1080
node -e "const a=require('/tmp/medium-engine/rtc-pre-s100-d70-stop.json'),b=require('/tmp/medium-engine/rtc-pre-s300-d70-stop.json'); const g=(r,n)=>{ if(r.brush!=='bristle-round') throw new Error(n+' brush '+r.brush); if(!r.gather||!(r.gather.calls>=50)) throw new Error(n+' gather '+(r.gather&&r.gather.calls)); if(!r.endCensus||!(r.endCensus.taps>0)) throw new Error(n+' census '+(r.endCensus&&r.endCensus.taps)); const d=r.endMetrics.density; const want=n==='s100'?2:16; if(d.effectiveSampleScale!==want) throw new Error(n+' scale '+d.effectiveSampleScale); const gap=d.zones.pigment.end.mean-d.zones.pigment.body.mean; console.log(n+' pigment gap '+gap.toFixed(4)); return gap; }; const g1=g(a,'s100'),g2=g(b,'s300'); if(!(g1>=0.01)) throw new Error('s100 block did not reproduce: '+g1.toFixed(4)); if(!(g2>=0.02)) throw new Error('s300 block did not reproduce: '+g2.toFixed(4)); console.log('REPRODUCED')"
pnpm --dir packages/efx-watercolor exec tsc --noEmit
    </automated>
    [VALIDATED: bash -n over the command line and node --check probe/medium-engine/run.mjs exit 0]
    [VALIDATED: bash -n over the command line and node --check probe/medium-engine/run.mjs exit 0]
    [VALIDATED: bash -n over the command line and node --check probe/medium-engine/run.mjs exit 0]
    [VALIDATED: node --check over the -e payload saved as .cjs exit 0]
    [VALIDATED: bash -n over the command line exit 0]
  </verify>
  <done>The end and pale-line scenarios resolve to bristle-round, the report proves the gather ran (calls greater than zero, brush echoed) and carries a populated `endCensus` (taps greater than zero, the cell's own drive name) built from the one shared install, the new operands validate at both layers, the density zones exist on all three surfaces, and the s100/s300 Dry 70 captures reproduce the pigment block above the stated thresholds. The adjacent broken scenarios are recorded, not touched.</done>
</task>

<task type="auto">
  <name>Freeze the visible-block bar, re-measure the 41-cell pre matrix on the census-anchored window and report the sign verdict</name>
  <files>packages/efx-watercolor/probe/medium-engine/probe.ts, packages/efx-watercolor/probe/medium-engine/end-density.mjs, packages/efx-watercolor/probe/medium-engine/harness.test.ts</files>
  <action>
The completed measurement diagnosed its own window as wrong, so the fix is a re-declaration, not a law: the old end window `[endMedian - max(30, round(0.25 * thickness)), endMedian - 2]` starts 26.7-48.8 document px AHEAD of the last recorded dab in every cell (s100-d70-stop: last tap 917.6, window [958, 995]), and the stroke travels +x, so every sampled pixel lies on the LEADING side of the dabs that wrote the block - a trailing-side law is inert there. The visible block spans roughly `[lastTap - 1.3...2.4r, lastTap + 1.05r]` (s100-d70: darkness 0.66 to 0.75 from x about 820 to x about 995; s300-d70: 0.62 to 0.81 from x about 700 to x about 1060). This task freezes the re-declared bar, implements it in the probe and the checker, re-measures ALL 41 cells and reports the sign verdict. It changes NO shader, engine, adapter or gather law.

1. THE FROZEN PRE-DECLARATION - declared here, before any law, mirrored verbatim into the SUMMARY before the first shader edit, and never tuned after seeing post values:
   - WINDOW: `lastTap = endCensus.last40.at(-1).x` (the census records stampScripted's x as a document-width fraction - multiply by dw for raster px; the drive's end x 0.85 reads 918 on a 1080 sheet); `r = strokeSize / 2` document px. End window `[lastTap * dw - 2.4r, lastTap * dw + 1.05r]` clamped to `[0, dw - 1]`. Body zone unchanged at `[round(0.40 * dw), round(0.55 * dw)]`. A bristle-end capture with no census tap fails - never a silent fallback to the old window. The anchor is the LAST recorded dab: the catch-up included on the live lanes, the final scripted sample on the bake.
   - METRICS, each over that window versus the body zone, on every marked row: RAW-P = the pigment zone MEAN, `(255 - mean RGB) / 255` on the pigment raster; RAW-C = the INKED SHARE, the fraction of zone cells with coverage alpha / 255 at least 0.5; VIS = the visible-composite MEAN, `1 - min(r*a + 255*(1-a), g*a + 255*(1-a), b*a + 255*(1-a)) / 255` read per pixel on the transparent raster - exactly the `endFine.vis` reader, the composite over white the eye sees. The raw transparent mean stays a report-only diagnostic column.
   - TOLERANCES on the 32 MATRIX and RELEASE cells, post-fix: `|RAW-P end - body| <= 0.02`, `|RAW-C end - body| <= 0.03`, `|VIS end - body| <= 0.02`. The lift stays an OBSERVATION cell: its pigment gap may grow by at most 0.01 versus its pre twin, with the VIS gap printed beside it and never asserted.
   - SIGN RULE: per cell, sign = sign(end - body) on RAW-P, RAW-C and VIS. A series is OPPOSITE when at least one cell reads end > body + 0.001 and at least one reads end < body - 0.001; otherwise it is UNIFORM (zero cells are neutral). The overall verdict is UNIFORM only when all three series are UNIFORM; otherwise OPPOSITE. UNIFORM admits Task 3's relative law; OPPOSITE stops it - a valid outcome, not a failure of this task.
   - STRUCTURAL BARS unchanged: `BODY_DRIFT_MAX = 0.01`, `START_DRIFT_MAX = 0.01`, `BODY_THICKNESS_DRIFT_MAX = 2` px, `FLAT_PCT_GROWTH_MAX = 5` points, `LONGEST_RUN_MAX_PX = 40`, `START_SHAPE_DRIFT = { flatPct 5, longest 3, spread 3 }`, `BAKE_LIVE_GAP_MAX = 0.02`, the pale-line growth bars (0.5 point ENCLOSED share, 3 px run under the absolute 20 px cap, coherence 0.05 / 0.05, halo 0.05 peak / 2 rows per side, the doc's absolute ENCLOSED target gating only where the pre cell already met it), the census/gather/brush proof on the 33 bristle-end cells, and the determinism pair.

2. Implement the declaration in probe.ts:
   - `bristleEndMetrics(transparent, pigment, coverage, strokeSize, taps: readonly EndTap[])` - add the census taps to the signature; the bristle-end report object passes `endCensus?.taps ?? []`. Derive `lastTap = taps[taps.length - 1]`; throw a named error when it is absent (this runs only for bristle-end, where the census is the declared proof).
   - Add `visibleDark(x, cr)` verbatim as the `endFine.vis` formula, and `zoneReadRaster(read, threshold, x0, x1)` - the existing `zoneRead` clamped instead to `[0, dw - 1]`. The anchored window must not be clipped by `scanHi` (about 0.94 * dw = 1015 on a 1080 sheet): at size 300 the window reaches about 1075 and the observed block reaches x about 1060. Keep `zoneRead` for the existing zoneDark and along profiles so those fields stay byte-identical.
   - Replace `bodyThicknessMean` / `endZonePx` with `window: { lastTapX, radiusPx, lo, hi, widthPx }` inside `endMetrics.density`, add `zones.visible`, and read `zones.transparent|pigment|coverage|visible` over the SAME anchored window (body zone unchanged). Keep every other endMetrics key byte-identical: end/start stats and zoneDark/contrastDelta, thickness.*, endFine, endAlongDark, startAlongDark, startProfilePx, endProfilePx, effectiveSampleScale.
   - If a harness source-scan pin trips on the changed probe text, update only the exact literal that moved; no new pin is added for the window - the capture is the proof.

3. Rewrite end-density.mjs to read the re-declared block:
   - Replace the `endZonePx` read with the window fields; declare `PIGMENT_GAP_MAX = 0.02`, `COVERAGE_GAP_MAX = 0.03` and the new `VISIBLE_GAP_MAX = 0.02` at the top beside the structural bars; read `zones.visible`.
   - Pre mode stays report-only and exits 1 only on capture integrity (missing cell, brush echo not 'bristle-round', null or zero census, crossed drive, zero gather) - NEVER on a pre gap or on the sign verdict: the pre run measures the defect.
   - Print one row per bristle-end cell: drive, effectiveSampleScale, lastTapX, radiusPx, window lo-hi, RAW-P body/end/delta/sign, RAW-C body/end/gap/sign, VIS body/end/delta/sign, transparent raw body/end, end flatPct and longestFlatRunPx, gather calls/endCapCalls, census taps/endCaps. Keep the pale-line table and its absolute-target note unchanged.
   - After the table print the SIGN VERDICT: for each of RAW-P, RAW-C and VIS the positive/negative/zero cell counts over the 32 cells plus UNIFORM or OPPOSITE, with the extreme deltas named per series.
   - In `--assert` mode add the three tolerances and keep every structural, pale-line and determinism bar as declared (including the lift's observation band).

4. Re-run the FULL 41-cell pre set at sheet 1080, Feather 100 with the SAME gate names and commands as the committed run, because the probe now writes the new window and metrics (the files are NOT byte-identical to the first pre set - record that in the SUMMARY):
   - Matrix: for size in 50 100 150 200 300, for dry in 0 70, for drive in stop bake, run `--scenario bristle-end --stroke-size SIZE --drive DRIVE --dry DRY --feather 100 --size 1080 --gate rtc-pre-s<3-digit size>-d<2-digit dry>-<drive>`.
   - Release sweep, stop, at sizes 100 and 300 across both drys: the same loop with `--release 0.1`, `0.5`, `0.9` and gates `rtc-pre-s{100,300}-d{00,70}-stop-rp10` / `rp50` / `rp90` (12 cells).
   - Lift: `--scenario bristle-end --stroke-size 100 --drive lift --dry 70 --feather 100 --size 1080` as `rtc-pre-s100-d70-lift`; its verdict is the observation band, never `PIGMENT_GAP_MAX`.
   - Pale line: `--scenario bristle-line --band 140 --size 1080` at `--stroke-size 35` and `100`, `--mut 1` and `2`, bare and with `--over` (8 cells, gates `rtc-pre-line-...` / `rtc-pre-line-over-...`).

5. Carry the writer map - do not re-derive it wholesale: catch-up refuted (stop and bake gaps match within 0.02; capped dabs fire in only 6 stop captures, none in bake); release pressure inert at s100 (bit-identical rp10/50/90); writer = the terminal dab chain's own footprints; channel = the coverage inked share plus the carried-pigment zone mean (at s100-d70 the end's INKED texels read pigment about 0.96 versus the body's about 0.72 while coverage is sparser, 0.73 versus 0.88). Re-check each claim against the new window's numbers and restate any claim the re-measurement moves.

6. Report in the SUMMARY: the frozen declaration verbatim, the per-cell table, the per-series sign verdict with its counts and extremes, and the writer map re-checked. Do not change any law, constant or uniform in this task.
  </action>
  <verify>
    <automated>node packages/efx-watercolor/probe/medium-engine/end-density.mjs --pre /tmp/medium-engine</automated>
    [UNVALIDATABLE: end-density.mjs is rewritten by this task and the pre set it reads is produced by the capture loop in this same task]
  </verify>
  <done>All 41 pre cells are re-captured with the census-anchored window and the three metrics; every bristle-end capture reports its own lastTapX, radiusPx and window bounds beside RAW-P, RAW-C and VIS; the checker prints the per-cell table and the per-series SIGN VERDICT; and the SUMMARY states the frozen declaration verbatim, the verdict (UNIFORM or OPPOSITE with positive/negative/zero counts and extreme deltas), and the re-checked writer map. No shader, engine, adapter or gather law is touched; a harness literal moves only if a pin trips.</done>
</task>

<task type="auto">
  <name>Implement the ONE relative gather law if the sign is uniform, prove it against the frozen bar, pin it and hand off UAT</name>
  <files>packages/efx-watercolor/src/playground/shaders.ts, packages/efx-watercolor/src/playground/bristles.ts, packages/efx-watercolor/src/playground/Engine.ts, packages/efx-watercolor/src/adapter/engineAdapter.ts, packages/efx-watercolor/src/playground/scattering.test.ts, packages/efx-watercolor/probe/medium-engine/baselines/edge-layer-neutral.json</files>
  <behavior>
    - The gather source contains the new law as ONE new gather expression with the new named bound constant, the takeoff lines kept verbatim, and the uniform declared and bound exactly once.
    - The fade's magnitude is derived per stroke from the gather's own moving-dab terms - no fixed end-to-body delta, no per-size or per-dry table, no literal tuned to an average cell.
    - Both existing terminal-path pins still hold: the uEndCap declaration and binding, and the stamp call literal that passes bristleEndCap into bristleInk (unchanged unless the law extends the signature, in which case both pins update to the new exact literal).
    - Every pre-existing negative pin in scattering.test.ts still passes: no takeoff factor multiplies cA, cB, alpha or coverage, and no depth-fade identifier enters the gather.
    - The new named bound constant is association-pinned in scattering.test.ts's gather bindings table (the BRISTLE_TAKEOFF_SHIFT precedent at 988) and its value pinned in the same file; bristles.test.ts is not touched (it pins only the sizing constants, never a gather constant).
  </behavior>
  <action>
Implement exactly ONE law chosen from the Task 2 writer map, then prove it on the same pixels.

0. ADMISSIBILITY GATE. First read the SUMMARY's frozen SIGN VERDICT (Task 2). If it is OPPOSITE on ANY of RAW-P, RAW-C or VIS: STOP. Do not edit shaders.ts, bristles.ts, Engine.ts, engineAdapter.ts, scattering.test.ts or baselines/edge-layer-neutral.json; do not retune the window, a metric or a tolerance; do not touch the takeoff. The plan completes as measurement plus stop: the SUMMARY states the verdict with its per-series counts and extremes and the measured gaps, and no row is claimed fixed. If it is UNIFORM, proceed - the three-series uniformity is the law's premise, not a tunable.

1. The ONE admissible law: a PER-STROKE NORMALIZED FADE of the terminal dab chain toward the stroke's OWN body density. The measurement selected the channel; the frozen bar decides.
   - Normalization is the law: the fade's magnitude is derived per stroke from the gather's own moving-dab terms (the same dryEdge / alongFade / trailSupport / cap factors that give an interior dab its coverage), so the terminal chain's coverage converges to the coverage a moving dab of the SAME stroke carries - never to a fixed numeric target, never to a per-size or per-dry table, never to a constant end-to-body delta. A named constant may bound or shape the fade (declared and pinned like BRISTLE_TAKEOFF_SHIFT, with its measured basis in the comment) but it must not encode the end-to-body magnitude; if the measured gaps vary per cell, the law must not be a constant.
   - One gather change, one named bound constant, one uniform. The 2026-11-23 takeoff stays byte-identical: BRISTLE_TAKEOFF_SHIFT, uTakeoffShift and the `smoothstep(0.45, 1.05, -q.y)` band are not touched.
   - The terminal set is marked at stamp time on BOTH lanes: the live lane's dabs stamped once `ending` is set (the catch-up included - the engine already sets `bristleEndCap` around that trace at 3067-3077), and the adapter's final fed sample(s) (`feedDueSample` at 477-521 reaches `active.index` = `pts.length` - set the flag after the final `scriptMove` and BEFORE that sample's `engine.tick`, so the flagged tick is the one that stamps). Carry the gate as a NEW engine flag mirroring `bristleEndCap`, read by a new line in `bindGather` for the law's own uniform - never by widening `uEndCap`, which drives `exposedTrail` and the cap silhouette. If the re-measurement shows one terminal dab is too narrow, extend the same flag to the final K recorded samples; still one law, one uniform.
   - Bake parity is structural: the same flag, the same law, the same gather on both lanes, no dependence on the catch-up dab (the bake has none). Nothing is retroactive: the deposit is a lerp toward the carried colour, so a lighter terminal dab can only add less, never erase film an earlier dab already committed, and the body stays bit-identical because the flag is 0 on every non-terminal dab.
   - The lift stays outside the absolute bar by construction: its terminal dabs are stamped before the engine knows the stroke ended, and a pressure-collapse gate would fire mid-stroke on every pressure-linked taper and move the body - so no stamp-time trigger reaches the live lift's end and the moving-lift rows remain the live UAT's to judge. A lift that still blocks is reported, never silently passed.
   - Forbidden: any fixed end-to-body delta or averaged magnitude, any re-tuning of the frozen window / metrics / tolerances, any per-size or per-dry correction table, any depth fade (it cannot remove committed film - refuted 2026-11-23), any law only the live release event can trigger, a catch-up-only patch, body darkening, and any Spec 10 layer, edgeFade/edgeFalloff, composite-law or Body-law change. Release pressure is already measured inert at s100 (bit-identical rp10/50/90) and is not the law's lever. If the uniform sign cannot be corrected without changing the 2026-11-23 takeoff itself, STOP and report - that is outside this quick.

2. Wire it exactly as the takeoff is wired: bound constant in bristles.ts, uniform declared in the gather source and bound in Engine.bindGather next to `uTakeoffShift`/`uEndCap`, value 0 on every non-terminal dab so the body is bit-identical by construction. Tune only the named bound's value against the frozen bar - never the window, the metrics or the tolerances.

3. Prove on pixels: re-run the same 41 cells with `rtc-post-` prefixes plus two identical determinism captures (`rtc-post-det-s100-d70-stop-a` and `-b`, both `--stroke-size 100 --drive stop --dry 70 --feather 100 --size 1080`). Run the checker in assert mode (it now enforces the re-declared three-metric bar on the frozen window) and iterate the named bound until it passes, or stop if no admissible value passes. The lift cell is checked against its observation band only - never the absolute gaps; a lift that does not improve is reported in the SUMMARY and left to the UAT, not treated as a checker failure.

4. Pin the law in scattering.test.ts only: the new gather expression (pinned as its exact source text), the uniform declaration, the bindGather line, the constant import, and the named bound's value (`expect(BRISTLE_<NAME>).toBe(<value>)` beside the gather describe, where the law's literals already live); keep the takeoff literals and every negative pin byte-identical. bristles.test.ts stays untouched - it pins the sizing constants (BRISTLE_CAP/MIN/SPACING_PX) and no gather constant. If the law extends `bristleInk`'s signature, update the two stamp-call pins (scattering.test.ts 695 and 1440) to the new exact literal. Pins are written after the pixel law proves, per the standing project override - the probe is the test here, the unit pins are the regression net.

5. Re-run the pale-line half through the same checker and confirm no lane: ENCLOSED and halo growth bars as declared in Task 2.

6. Edge-layer-neutral re-capture, deliberately: run `node packages/efx-watercolor/probe/medium-engine/run.mjs --gate edge-layer-neutral --scenario edge-layer --size 2048 --edge 0 --falloff 50`, then `node packages/efx-watercolor/probe/medium-engine/compare.mjs edge-layer-neutral --edge-structural` and `node packages/efx-watercolor/probe/medium-engine/compare.mjs edge-layer-neutral`. The amount-0 visit draws through the shipped bristle gather, so a gather-law change is EXPECTED to move some digests. If and only if drift is reported: copy `/tmp/medium-engine/edge-layer-neutral.json` over the committed baseline, state in the SUMMARY exactly which fields moved and why (the law, not a hidden regression), and confirm --edge-structural still passes (layerAllocated false, mergeDraws 0). Never re-capture silently and never re-capture without running the compare first.

7. Gates: `pnpm --dir packages/efx-watercolor exec vitest run`, `pnpm --dir packages/efx-watercolor exec tsc --noEmit`, `pnpm --dir app exec vitest run`, `pnpm --dir app exec tsc --noEmit`. Known pre-existing failures to distinguish, not fix: the app suite's `physicPaintBridge.test.ts` one-shot-listener timeout under the full suite - re-run that file alone to show it passes; the bristle-line HALO row was a recorded HEAD failure before this quick - the no-lane bar is relative to the repointed pre captures.

8. UAT hand-off: write a 10-row table in the SUMMARY - the five sizes at Dry 0 and Dry 70, Gouache bag (Pickup 100, Feather 100), press-move-release - each row stating the live check (the end reads at the body's density, the ragged end silhouette preserved). Claim NO row passed; automated-ready only.
  </action>
  <verify>
    <automated>
node packages/efx-watercolor/probe/medium-engine/run.mjs --gate rtc-post-det-s100-d70-stop-a --scenario bristle-end --stroke-size 100 --drive stop --dry 70 --feather 100 --size 1080
node packages/efx-watercolor/probe/medium-engine/run.mjs --gate rtc-post-det-s100-d70-stop-b --scenario bristle-end --stroke-size 100 --drive stop --dry 70 --feather 100 --size 1080
node packages/efx-watercolor/probe/medium-engine/end-density.mjs --pre /tmp/medium-engine --post /tmp/medium-engine --assert
pnpm --dir packages/efx-watercolor exec vitest run
pnpm --dir packages/efx-watercolor exec tsc --noEmit
pnpm --dir app exec vitest run
pnpm --dir app exec tsc --noEmit
node packages/efx-watercolor/probe/medium-engine/run.mjs --gate edge-layer-neutral --scenario edge-layer --size 2048 --edge 0 --falloff 50
node packages/efx-watercolor/probe/medium-engine/compare.mjs edge-layer-neutral --edge-structural
node packages/efx-watercolor/probe/medium-engine/compare.mjs edge-layer-neutral
node -e "const {execSync}=require('child_process'); const allowed=['packages/efx-watercolor/probe/medium-engine/probe.ts','packages/efx-watercolor/probe/medium-engine/run.mjs','packages/efx-watercolor/probe/medium-engine/harness.test.ts','packages/efx-watercolor/probe/medium-engine/end-density.mjs','packages/efx-watercolor/src/playground/shaders.ts','packages/efx-watercolor/src/playground/bristles.ts','packages/efx-watercolor/src/playground/Engine.ts','packages/efx-watercolor/src/adapter/engineAdapter.ts','packages/efx-watercolor/src/playground/scattering.test.ts','packages/efx-watercolor/probe/medium-engine/baselines/edge-layer-neutral.json']; const changed=execSync('git diff --name-only b12d769b1',{encoding:'utf8'}).trim().split('\n').filter(Boolean); const outside=changed.filter((p)=>!allowed.includes(p)&&!p.startsWith('.planning/')); if(outside.length) throw new Error('out-of-scope paths moved: '+outside.join(', ')); console.log('diff scope clean: '+changed.length+' paths, all declared')"
    </automated>
    [VALIDATED: bash -n over the command line and node --check probe/medium-engine/run.mjs exit 0]
    [VALIDATED: bash -n over the command line and node --check probe/medium-engine/run.mjs exit 0]
    [UNVALIDATABLE: end-density.mjs is rewritten by task 2; the pre and post captures are produced by the runs in this plan]
    [VALIDATED: bash -n over the command line exit 0]
    [VALIDATED: bash -n over the command line exit 0]
    [VALIDATED: bash -n over the command line exit 0]
    [VALIDATED: bash -n over the command line exit 0]
    [VALIDATED: bash -n over the command line and node --check probe/medium-engine/run.mjs exit 0]
    [VALIDATED: bash -n over the command line and node --check probe/medium-engine/compare.mjs exit 0]
    [VALIDATED: bash -n over the command line and node --check probe/medium-engine/compare.mjs exit 0]
    [VALIDATED: node --check over the -e payload saved as .cjs exit 0; the payload was also run read-only at plan time and reported one .planning path, in scope]
  </verify>
  <done>If the sign verdict was OPPOSITE: no source, pin or baseline file moved and the SUMMARY states the stop with the frozen declaration, the per-series verdict and the measured gaps - that completes the plan. If it was UNIFORM: the checker's assert mode passes on the 32 matrix and release cells (|RAW-P end - body| within 0.02, |RAW-C| within 0.03 and |VIS| within 0.02 on the frozen census-anchored window), the bake cells match their stop twins with a populated census, the lift sits inside its declared observation band and is reported rather than passed, body and start stay within drift, the silhouette and pale-line bars hold, and the determinism pair is byte-identical. The law is one per-stroke normalized fade with one named bound constant and one uniform, the takeoff untouched; the pins are updated in scattering.test.ts with the negative pins kept; the diff-scope gate reports only declared paths; gates are green apart from the recorded pre-existing failures; the SUMMARY carries the frozen declaration, the writer map, the lift observation, the drift decision and the 10 unclaimed UAT rows.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| CLI to probe page | `--dry`/`--feather`/`--release`/`--stroke-size` cross from argv into engine params; numeric only, but a bad bound silently changes what the capture measures |
| probe capture to committed baseline | `/tmp/medium-engine/edge-layer-neutral.json` can be copied over the committed Spec 10 identity baseline |
| measurement to claim | the pre/post table is the only evidence for the law; a mistuned or re-tuned bar would launder a failing law |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-RTC-01 | Tampering | run.mjs flag parsing and probe.ts operand readers | low | mitigate | integer/range validation in both layers, `--release` refused on the lanes whose end is a measured pressure tail (lift, decay) or the -1 sentinel (mouse drives), unknown values throw rather than default |
| T-RTC-02 | Denial of service | headless capture loop (41 pre + 41 post runs) | low | accept | existing `--size` bound 32..4096, new `--stroke-size` bound 1..400, 600 s Chrome timeout; local trusted CLI only |
| T-RTC-03 | Tampering | baselines/edge-layer-neutral.json | medium | mitigate | re-capture only after the compare reports drift, moved fields recorded, `--edge-structural` must stay green, pre-fix captures use distinct `rtc-pre-` prefixes and are never rewritten by post runs |
| T-RTC-04 | Repudiation | the re-declared bar and its sign verdict | medium | mitigate | the window is anchored to a measured tap (`lastTap` from `endCensus.last40`, `r = strokeSize/2`), never chosen; the window, three metrics, three tolerances and the sign rule are frozen in the plan and mirrored in the SUMMARY before the first shader edit; bar constants (including the lift's observation band) declared and committed in end-density.mjs before any post capture; `--assert` pairs every cell; the lift can never be promoted to an absolute pass; determinism pair byte-identical |
| T-RTC-05 | Repudiation | the shared tap census | low | mitigate | one install before the drive branch spans both lanes; every one of the 33 bristle-end cells must carry `endCensus.taps` greater than zero and its own drive name, so a null or crossed census fails the bar instead of silently standing in for the bake; the 8 pale-line cells are gated on their own lineSurfaces bars |
| T-RTC-06 | Tampering | the frozen window/metric declaration | medium | mitigate | an OPPOSITE sign verdict must stop the law, never motivate a window, metric or tolerance change; the declaration is carried verbatim in the plan and the SUMMARY so any later change is visible; Task 3's gate forbids editing shader, engine, adapter, pin or baseline files on an OPPOSITE verdict |
| T-RTC-SC | Tampering | package supply chain | high | mitigate | no package installs in this plan; esbuild and Chrome are pre-existing local tooling; stop and escalate if any install is proposed |
</threat_model>

<verification>
Overall phase checks, all from the repo root:

1. When the sign verdict is UNIFORM, `node packages/efx-watercolor/probe/medium-engine/end-density.mjs --pre /tmp/medium-engine --post /tmp/medium-engine --assert` exits 0; on an OPPOSITE verdict the post half is not run (item 8).
2. On the UNIFORM verdict, the 41 pre and 41 post captures exist and every one echoes brush bristle-round. The 33 bristle-end captures (20 matrix + 12 release + 1 lift) each carry a populated `endCensus` (taps greater than zero, its own drive name), gather calls greater than zero, and the census-anchored `density.window` (lastTapX, radiusPx, lo, hi) with RAW-P, RAW-C and VIS body/end readings; the bake family's census proves the gather ran on the bake lane and attests the same window anchor the live lanes use. The 8 pale-line captures carry their `lineSurfaces` ENCLOSED, coherence and halo readings, each held to its growth bar against the pre-fix twin; they emit no endCensus, gather, endMetrics, endSetup or drive, so no end-field assertion applies to them.
3. On the UNIFORM verdict, the determinism pair is digest-identical on all four surfaces and byteLength.
4. `pnpm --dir packages/efx-watercolor exec vitest run` and `pnpm --dir packages/efx-watercolor exec tsc --noEmit` pass; `pnpm --dir app exec vitest run` and `pnpm --dir app exec tsc --noEmit` pass apart from the recorded physicPaintBridge full-suite timeout, shown green in isolation.
5. `compare.mjs edge-layer-neutral --edge-structural` passes; the baseline state (unchanged or deliberately re-captured with the moved fields recorded) is stated in the SUMMARY.
6. The SUMMARY carries the frozen re-declaration verbatim, the per-series sign verdict, the re-checked writer map, and then either the relative law (with the measurement that selected it, the lift observation with its pre/post numbers, the pin changes, and the 10-row UAT table with no row claimed passed) or, on an OPPOSITE verdict, the measured stop with its numbers and no claimed fix.
7. The diff-scope gate passes: `git diff --name-only b12d769b1` lists only the plan's declared files plus `.planning/`, so no frozen surface moved.
8. If the sign verdict is OPPOSITE, no shader, engine, adapter, pin or baseline path appears in the diff and the SUMMARY states the stop; the quick is reported as measured-but-withheld, not failed.
</verification>

<success_criteria>
- The probe's end and pale-line scenarios exercise the real bristle-round gather on both live and bake lanes, proven by the census on the 33 bristle-end captures and by the brush echo plus the lineSurfaces ENCLOSED, coherence and halo bars on the 8 pale-line captures.
- The block reproduces pre-fix at the stated thresholds on the repointed probe (Task 1).
- The bar is re-declared on the measured visible block - the census-anchored window [lastTap - 2.4r, lastTap + 1.05r], the RAW pigment mean, the coverage inked share and the visible-composite mean, with tolerances 0.02 / 0.03 / 0.02 - frozen in the plan and mirrored in the SUMMARY before any shader edit, and the re-measurement reports a per-series sign verdict with its counts and extremes.
- If the verdict is UNIFORM, the full matrix is measured before and after with the same names, seeds, frozen window and metrics; the re-declared bar passes on the 32 matrix and release cells, and the lift is reported against its declared observation band, never promoted to an absolute pass. If it is OPPOSITE, the plan completes with the measured stop and no source file moves.
- ONE relative law, one named bound, one uniform: the fade is normalized per stroke against the gather's own moving-dab terms (no fixed end-to-body delta); the body, start, silhouette and pale-line floors hold, and the bake matches the live end without a catch-up dab.
- Spec 10 layer code, edge params, composite law and the 2026-11-23 takeoff are untouched, proven by the diff-scope gate; the edge-layer-neutral baseline moved only if reported and documented.
- Regression pins updated with every negative pin kept; the four gates are green apart from the recorded pre-existing failures.
- 10 live UAT rows handed off, none claimed passed.
</success_criteria>

<output>
Create `/Users/lmarques/Dev/efx-motion-editor/.planning/quick/261125-rtc-fix-the-bristle-brush-s-end-cap-density-/261125-rtc-SUMMARY.md` when done. It must carry: the frozen pre-declaration verbatim (window, three metrics, three tolerances, sign rule), the re-measured pre/post table per cell with lastTap/radius/window and the RAW-P, RAW-C and VIS gaps, the per-series sign verdict, the re-checked writer map with the census evidence, and then EITHER the relative law with its measurement basis, the lift's pre/post numbers against its observation band (reported, never claimed as a pass), the pin changes, the edge-layer-neutral decision, the gate results with the pre-existing failures named, and the 10 unclaimed UAT rows - OR, when the verdict is OPPOSITE, the measured stop with its per-series numbers, no law, no pin changes and no row claimed fixed.
</output>
