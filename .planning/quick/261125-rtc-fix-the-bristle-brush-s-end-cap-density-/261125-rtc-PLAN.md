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
    - "The medium-engine probe's bristle-end and bristle-line scenarios run the real bristle-round (Gouache) response on both the live and the bake lane: the report echoes bristle-round and the gather census counts bristleInk calls greater than zero on every capture."
    - "Before any law change, the terminal density block reproduces on the repointed probe at Dry 70 (pigment end-zone mean minus body-zone mean at least 0.02 at stroke size 300 and at least 0.01 at stroke size 100)."
    - "After the one law change, every matrix cell (5 sizes x Dry 0/70 x stop+bake) and every release-sweep cell (sizes 100 and 300 x Dry 0/70 x release 0.1/0.5/0.9) reads end-to-body pigment density within the declared bar and the coverage inked-fraction gap within its bar. The lift cell is an OBSERVATION cell asserted only to its declared non-regression band: no admissible stamp-time trigger reaches the live lift's pre-release dabs, so its verdict belongs to the live UAT, never to a bar it cannot reach."
    - "The body and start zones stay within the declared drift on every cell: the fix changes the end, never the reference."
    - "The end silhouette stays ragged (flatPct and longestFlatRunPx bars) and the pale-line ENCLOSED and halo readings do not regress versus the pre-fix bristle-round captures."
    - "The law is one gather change with a named constant and a bound uniform, deterministic across two identical runs (byte-identical digests); a diff-scope gate over `git diff --name-only b12d769b1` passes with no path touched outside the plan's declared file set (plus `.planning/`), so no Spec 10 layer, edge-parameter or composite-law source moves."
  artifacts:
    - path: packages/efx-watercolor/probe/medium-engine/probe.ts
      provides: "bristle-end/bristle-line repointed to bristle-round; dry/feather/release operands; density zones on transparent/pigment/coverage; one shared tap+gather census installed before the drive branch and reported as endCensus for BOTH lanes (the bake included); end-setup echo"
    - path: packages/efx-watercolor/probe/medium-engine/run.mjs
      provides: "the new flag contract (dry, feather, release, stroke-size up to 400) validated at the CLI before any capture runs"
    - path: packages/efx-watercolor/probe/medium-engine/end-density.mjs
      provides: "the pre-declared bar as executable code over paired rtc-pre-/rtc-post- captures"
    - path: packages/efx-watercolor/src/playground/shaders.ts
      provides: "the ONE gather law over the terminal dab"
    - path: packages/efx-watercolor/src/playground/bristles.ts
      provides: "the law's named magnitude constant (the BRISTLE_TAKEOFF_SHIFT precedent)"
    - path: packages/efx-watercolor/src/playground/scattering.test.ts
      provides: "the exact-literal pins of the new law, the new constant's value pin, and every pre-existing negative pin, kept verbatim"
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
      via: "reads the endMetrics.density, gather and endCensus blocks the probe writes into every bristle-end capture - including the bake lane: one census installed before the drive branch spans the adapter's script loop (probe.ts 5329-5339) on the same captured engine, so the bake report carries taps, endCaps, last40 and endCapCalls exactly like a live capture"
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

Output: a repaired probe (the bristle scenarios currently resolve to the watercolor round
fallback because `bristle-flat` was retired by 261124-iq9), a 41-cell pre-fix matrix (20 stop+bake
cells, a 12-cell release-pressure sweep at the two sampling extremes - sizes 100 and 300 - across
both drys, one lift observation cell and 8 pale-line cells), one proven
law with its regression pins, a deliberate edge-layer-neutral re-capture if the shipped gather
moves it, and 10 live UAT rows handed off unclaimed.

The lift cell is measured, reported and paired pre/post, but never asserted to the absolute bar:
the live lane stamps its terminal dabs before it knows the stroke ended, the catch-up dab cannot
lighten committed film, and a pressure-collapse gate would fire mid-stroke on every
pressure-linked taper. The lift's verdict therefore belongs to the press-move-release UAT rows;
a lift that still blocks is reported, never silently passed.

Execution shape: Task 1 is the tracer - one capture end-to-end through the repaired probe, proving
the measurement pipeline on the real brush before any matrix expansion. Task 2 expands to the full
matrix and the writer map with NO law change. Task 3 implements and proves the ONE law against the
bar Task 2 fixed, then hands off UAT.

Scope guards: no Spec 10 layer code (deposit routing, lateral field, merge, display branch,
encoder - FROZEN per 261125-kvl), no edgeFade/edgeFalloff, no composite-law change, no depth fade,
no law triggered only by the live release event (the bake must receive the same law), no
catch-up-only patch. Release pressure stays a measured candidate trigger: if the 12-cell sweep
shows it moves the block, a pressure-driven gate is admissible because the recorded pressures ride
the bake too. `bristle-edge`, `bristle-wet` and
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
  <name>Measure the full matrix and bisect the density writers with no law change</name>
  <files>packages/efx-watercolor/probe/medium-engine/end-density.mjs</files>
  <action>
1. Create `packages/efx-watercolor/probe/medium-engine/end-density.mjs`, the bar as code (sibling of compare.mjs, no package installs). CLI: `--pre <dir>` and optional `--post <dir>`; without `--assert` it is report-only but exits 1 if any expected pre capture is missing or lacks the gather proof; with `--assert` it pairs every pre cell with its post twin by suffix and enforces the constants declared at the top of the file (below). It discovers captures as `<dir>/rtc-pre-<suffix>.json` and `<dir>/rtc-post-<suffix>.json`. The pre set is exactly 41 cells: 20 matrix cells `s{050,100,150,200,300}-d{00,70}-{stop,bake}`, 12 release cells `s{100,300}-d{00,70}-stop-rp{10,50,90}`, 1 lift `s100-d70-lift`, and 8 line cells `{line,line-over}-s{035,100}-mut{1,2}`. The determinism pair `det-s100-d70-stop-a/-b` is required in `--assert` mode only. It prints one row per cell: effectiveSampleScale, pigment body/end/delta, coverage inked body/end/gap, transparent body/end/delta, end flatPct and longestFlatRunPx, gather calls and endCapCalls, and the census tap/endCap counts with the cell's drive name.

   Declared bar constants (pre-declared now, never tuned after seeing post values):
   - `PIGMENT_GAP_MAX = 0.02` and `COVERAGE_GAP_MAX = 0.03`, applied to the 32 MATRIX and RELEASE cells only. A cell passes when its post `abs(end minus body)` is at most the constant - the end reads at the body's density on both the carried-pigment and the inked-fraction surfaces, for every cell, defect or not.
   - `LIFT_OBSERVE_DRIFT_MAX = 0.01` - the lift cell `s100-d70-lift` is an OBSERVATION cell. Its post pigment `abs(end minus body)` must be at most its pre value plus 0.01, and its structural bars (body/start drift, silhouette, census) must hold; it is never asserted to `PIGMENT_GAP_MAX`. Declared before any post capture: the moving lift's terminal dabs are stamped before the engine knows the stroke ended, the catch-up dab cannot lighten committed film, and a pressure-collapse gate would fire mid-stroke on every pressure-linked taper - so no admissible stamp-time trigger reaches the live lift's end. The press-move-release UAT rows are that path's judge; a lift that still blocks is reported, never promoted to a pass.
   - `BODY_DRIFT_MAX = 0.01`, `START_DRIFT_MAX = 0.01` (zone mean, pigment and transparent), `BODY_THICKNESS_DRIFT_MAX = 2` px.
   - `FLAT_PCT_GROWTH_MAX = 5` points and `LONGEST_RUN_MAX_PX = 40` on the end silhouette; `START_SHAPE_DRIFT = { flatPct 5, longest 3, spread 3 }`.
   - `BAKE_LIVE_GAP_MAX = 0.02`: at the same size and dry, the bake cell's pigment end-minus-body delta sits within 0.02 of the stop cell's.
   - `LINE_FRAC_GROWTH_MAX = 0.5` points, `LINE_RUN_GROWTH_MAX = 3` px with an absolute 20 px cap, per `lineSurfaces` entry's `tiling.enclosed`; `LINE_HALO_PEAK_GROWTH = 0.05` and `LINE_HALO_RUN_GROWTH = 2` rows. The doc's absolute ENCLOSED target (no more than 1 percent and 20 px) is printed beside the comparison; it gates only when the pre capture already meets it.
   - Every post cell (line cells included): brush equals 'bristle-round', `endCensus` is non-null with `taps` greater than zero and `endCensus.drive` equal to the cell's own drive, and `gather.calls` greater than zero. This is the bake-lane census proof: a bake capture with `endCensus: null` or zero taps fails the bar.
   - The determinism pair: identical `digestPaper`, `digestTransparent`, `digestWhite`, `digestPigment` and `byteLength`.

2. Capture the full 41-cell pre set at sheet 1080, Feather 100 (the artist's bag: acrylic record, Pickup already 100, Body 100):
   - Matrix: for size in 50 100 150 200 300, for dry in 0 70, for drive in stop bake, run `--scenario bristle-end --stroke-size SIZE --drive DRIVE --dry DRY --feather 100 --size 1080 --gate rtc-pre-s<3-digit size>-d<2-digit dry>-<drive>`.
   - Release sweep, stop, at sizes 100 and 300 across both drys: the same loop with `--release 0.1`, `0.5`, `0.9` and gates `rtc-pre-s{100,300}-d{00,70}-stop-rp10` / `rp50` / `rp90` (12 cells). The two sizes bracket the sampling law (2x at 100, 16x at 300), and the default stop cell (authored 0.75) is the fourth pressure point at EVERY size and dry, so the release axis is still probed across all five sizes. This satisfies the CONTEXT's "release pressure is a probe axis" without a full cross product: for bristle-round the gather's pressure is provably constant (pressureLink 0 forces contactPr 1.0), so the sweep is empirical confirmation at the extremes, not a search.
   - Lift: `--scenario bristle-end --stroke-size 100 --drive lift --dry 70 --feather 100 --size 1080` as `rtc-pre-s100-d70-lift`; this re-establishes the approved-lift baseline for the ROUND tip - the 2026-11-23 lift numbers were measured on the retired flat tip and must not be reused. Its verdict is the observation band, never `PIGMENT_GAP_MAX`.
   - Pale line: `--scenario bristle-line --band 140 --size 1080` at `--stroke-size 35` and `100`, `--mut 1` and `2`, bare and with `--over` (8 cells, gates `rtc-pre-line-...` / `rtc-pre-line-over-...`).
   The two Task 1 captures are re-run by the matrix loop with identical seeds; byte-identical output is expected.

3. Bisect the writers from the captures alone - no source edits. Extract into the SUMMARY, per family: the pigment/coverage/transparent deltas, the census tap count and endCap count, the final 40 taps' x and authored pressure (read from `endCensus.last40` in every cell, the bake family included - the shared census makes the bake's taps a first-class report field), and the block's left edge (end median minus endZonePx) versus the last taps' positions. Answer these questions with numbers:
   - Catch-up: compare stop and bake cells at each size/dry. If the gap is the same, the catch-up dab is not the writer.
   - Release pressure: compare the three release cells against the default stop cell at every size and dry. If the gap is flat, release pressure is not the writer.
   - Dry: compare Dry 0 and Dry 70 at each size; state whether the block is size-grown, dry-grown or both.
   - Channel: state which surface carries the block (pigment carried density, coverage inked fraction, or the transparent composite) at each size - the law must target the channel the measurement names.
   - Which dabs write the block: the taps within one endZonePx of the end median, their spacing/advance, and whether the writer set is one terminal dab or the near-stationary pile. This decides the admissible law form in Task 3.
   - Record the recorded pale-line baseline numbers (ENCLOSED fracPct and maxRunPx per surface entry, halo peakRel and run per side) as the no-lane reference.

4. Report the writer map and the table in the phase SUMMARY. Do not change any law, constant or uniform in this task.
  </action>
  <verify>
    <automated>node packages/efx-watercolor/probe/medium-engine/end-density.mjs --pre /tmp/medium-engine</automated>
    [UNVALIDATABLE: end-density.mjs is created by this task]
  </verify>
  <done>All 41 pre cells exist with the gather proof and a populated census on BOTH lanes (the bake cells carry taps greater than zero and their own drive name), the checker reports the full pre table plus the pale-line baselines, and the SUMMARY states the writer map: catch-up refuted or confirmed, release pressure refuted or confirmed, the carrying channel, whether the block is one terminal dab or a pile-up, and whether the lift's writer is reachable by a stamp-time gate (if not, the lift stays in its observation band).</done>
</task>

<task type="auto">
  <name>Implement the ONE gather law, prove it against the declared bar, pin it and hand off UAT</name>
  <files>packages/efx-watercolor/src/playground/shaders.ts, packages/efx-watercolor/src/playground/bristles.ts, packages/efx-watercolor/src/playground/Engine.ts, packages/efx-watercolor/src/adapter/engineAdapter.ts, packages/efx-watercolor/src/playground/scattering.test.ts, packages/efx-watercolor/probe/medium-engine/baselines/edge-layer-neutral.json</files>
  <behavior>
    - The gather source contains the new law as one literal line with the new named constant, the takeoff lines kept verbatim, and the uniform declared and bound exactly once.
    - Both existing terminal-path pins still hold: the uEndCap declaration and binding, and the stamp call literal that passes bristleEndCap into bristleInk (unchanged unless the law extends the signature, in which case both pins update to the new exact literal).
    - Every pre-existing negative pin in scattering.test.ts still passes: no takeoff factor multiplies cA, cB, alpha or coverage, and no depth-fade identifier enters the gather.
    - The new magnitude constant is association-pinned in scattering.test.ts's gather bindings table (the BRISTLE_TAKEOFF_SHIFT precedent at 988) and its value pinned in the same file; bristles.test.ts is not touched (it pins only the sizing constants, never a gather constant).
  </behavior>
  <action>
Implement exactly ONE law chosen from the Task 2 writer map, then prove it on the same pixels.

1. Admissible forms, in the research's ranked order. The measurement selects; the bar decides.
   - Law A (preferred): a TERMINAL trailing THRESHOLD shift mirroring the 2026-11-23 takeoff. In `gatherBristle`, the takeoff raises the threshold on the leading frontier (`smoothstep(0.45, 1.05, -q.y)`); the end law raises it on the trailing side for the dabs that write the block - one new literal line, one new uniform, one new declared constant next to BRISTLE_TAKEOFF_SHIFT (place it at 169 with a comment stating the measured basis). Do not alter the takeoff lines. The terminal gate must be settable at stamp time on BOTH lanes: the live release already flags its catch-up dab (`bristleEndCap` around the trace at 3067-3077, bound to `uEndCap` at 4003); the bake sets the equivalent flag on its final fed sample(s) from the adapter (`feedDueSample` at 477-521 knows `active.index` reaches `pts.length` - set the terminal flag after the final `scriptMove` and BEFORE that sample's `engine.tick`, so the flagged tick is the one that stamps). Carry the gate as a NEW engine flag mirroring `bristleEndCap` - a new field on the stamp state read by a new line in `bindGather` for the law's own uniform - never by widening `uEndCap`, which already drives `exposedTrail` and the cap silhouette; one law, one uniform. If the writer map shows ONE terminal dab is too narrow, extend the same flag to the final K recorded samples in the adapter and the equivalent live-side signal; do not invent a second law.
     The gate is a TERMINAL DAB SET, never a single event, and nothing it can do is retroactive: the deposit is a lerp toward the carried colour, so a dab stamped with reduced coverage can only add less, never erase film an earlier dab already committed. Consequence, declared before the measurement: the moving lift's terminal dabs are unreachable by any stamp-time trigger - the live lane stamps them before it knows the stroke ended, and a pressure-collapse gate would fire mid-stroke on every pressure-linked taper and move the body. If the writer map shows the lift's writer is that unreachable set, the lift stays an observation row and the UAT judges it; do not add a live-only trigger to move it.
   - Law B (only if the writer map shows the block is the near-stationary pile and Law A's one-dab window cannot cover it): the same threshold mechanism gated on a stamp-time stall signal (the dab-centre advance since the previous dab, or the terminal segment), body-inert by construction and proven on both lanes. Still one law, one constant, one uniform.
   - Forbidden: any depth fade (it cannot remove committed film - refuted 2026-11-23), any law only the live release event can trigger (the bake has no pointerup and no catch-up), a catch-up-only patch, body darkening, and any Spec 10 layer, edgeFade/edgeFalloff, composite-law or Body-law change. Release pressure is not pre-judged: the sweep decides whether it moves the block, and a pressure-keyed gate is admissible only if the same recorded pressures reach the bake. If the measurement demands touching the 2026-11-23 takeoff itself, STOP and report - that is outside this quick.

2. Wire it exactly as the takeoff is wired: constant in bristles.ts, uniform declared in the gather source and bound in Engine.bindGather next to `uTakeoffShift`/`uEndCap`, value 0 on every non-terminal dab so the body is bit-identical by construction. Tune only the new constant's magnitude against the bar.

3. Prove on pixels: re-run the same 41 cells with `rtc-post-` prefixes plus two identical determinism captures (`rtc-post-det-s100-d70-stop-a` and `-b`, both `--stroke-size 100 --drive stop --dry 70 --feather 100 --size 1080`). Run the checker in assert mode and iterate the constant until it passes, or stop if no admissible magnitude passes. The lift cell is checked against its observation band only - never `PIGMENT_GAP_MAX`; a lift that does not improve is reported in the SUMMARY and left to the UAT, not treated as a checker failure.

4. Pin the law in scattering.test.ts only: the new gather line, the uniform declaration, the bindGather line, the constant import, and the new constant's value (`expect(BRISTLE_<NAME>).toBe(<value>)` beside the gather describe, where the law's literals already live); keep the takeoff literals and every negative pin byte-identical. bristles.test.ts stays untouched - it pins the sizing constants (BRISTLE_CAP/MIN/SPACING_PX) and no gather constant. If the law extends `bristleInk`'s signature, update the two stamp-call pins (scattering.test.ts 695 and 1440) to the new exact literal. Pins are written after the pixel law proves, per the standing project override - the probe is the test here, the unit pins are the regression net.

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
    [UNVALIDATABLE: end-density.mjs is created by task 2]
    [VALIDATED: bash -n over the command line exit 0]
    [VALIDATED: bash -n over the command line exit 0]
    [VALIDATED: bash -n over the command line exit 0]
    [VALIDATED: bash -n over the command line exit 0]
    [VALIDATED: bash -n over the command line and node --check probe/medium-engine/run.mjs exit 0]
    [VALIDATED: bash -n over the command line and node --check probe/medium-engine/compare.mjs exit 0]
    [VALIDATED: bash -n over the command line and node --check probe/medium-engine/compare.mjs exit 0]
    [VALIDATED: node --check over the -e payload saved as .cjs exit 0; the payload was also run read-only at plan time and reported one .planning path, in scope]
  </verify>
  <done>The checker's assert mode passes on the 32 matrix and release cells (pigment end-to-body within 0.02 of the body's density, coverage inked gap within 0.03), the bake cells match their stop twins with a populated census, the lift sits inside its declared observation band and is reported rather than passed, body and start stay within drift, the silhouette and pale-line bars hold, and the determinism pair is byte-identical. The law is one named constant plus one uniform with the takeoff untouched; the pins are updated in scattering.test.ts with the negative pins kept; the diff-scope gate reports only declared paths; gates are green apart from the recorded pre-existing failures; the SUMMARY carries the writer map, the lift observation, the drift decision and the 10 unclaimed UAT rows.</done>
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
| T-RTC-04 | Repudiation | the pre-declared bar | medium | mitigate | bar constants (including the lift's observation band) declared and committed in end-density.mjs before any post capture; `--assert` pairs every cell; the lift can never be promoted to an absolute pass; determinism pair byte-identical |
| T-RTC-05 | Repudiation | the shared tap census | low | mitigate | one install before the drive branch spans both lanes; every cell must carry `endCensus.taps` greater than zero and its own drive name, so a null or crossed census fails the bar instead of silently standing in for the bake |
| T-RTC-SC | Tampering | package supply chain | high | mitigate | no package installs in this plan; esbuild and Chrome are pre-existing local tooling; stop and escalate if any install is proposed |
</threat_model>

<verification>
Overall phase checks, all from the repo root:

1. `node packages/efx-watercolor/probe/medium-engine/end-density.mjs --pre /tmp/medium-engine --post /tmp/medium-engine --assert` exits 0.
2. The 41 pre and 41 post captures exist, every one echoes brush bristle-round, carries a populated `endCensus` (taps greater than zero, its own drive name) and gather calls greater than zero; the bake family's census proves the gather ran on the bake lane and gives it the same tap positions the live lanes report.
3. The determinism pair is digest-identical on all four surfaces and byteLength.
4. `pnpm --dir packages/efx-watercolor exec vitest run` and `pnpm --dir packages/efx-watercolor exec tsc --noEmit` pass; `pnpm --dir app exec vitest run` and `pnpm --dir app exec tsc --noEmit` pass apart from the recorded physicPaintBridge full-suite timeout, shown green in isolation.
5. `compare.mjs edge-layer-neutral --edge-structural` passes; the baseline state (unchanged or deliberately re-captured with the moved fields recorded) is stated in the SUMMARY.
6. The SUMMARY carries the writer map, the law chosen with the measurement that selected it, the lift observation with its pre/post numbers, the pin changes, and the 10-row UAT table with no row claimed passed.
7. The diff-scope gate passes: `git diff --name-only b12d769b1` lists only the plan's declared files plus `.planning/`, so no frozen surface moved.
</verification>

<success_criteria>
- The probe's end and pale-line scenarios exercise the real bristle-round gather on both live and bake lanes, proven by the census and the brush echo.
- The block reproduces pre-fix at the stated thresholds on the repointed probe.
- The full matrix is measured before and after with the same names, seeds and metrics; the pre-declared bar passes on the 32 matrix and release cells, and the lift is reported against its declared observation band, never promoted to an absolute pass.
- ONE law, one constant, one uniform: the body, start, silhouette and pale-line floors hold, and the bake matches the live end without a catch-up dab.
- Spec 10 layer code, edge params, composite law and the 2026-11-23 takeoff are untouched, proven by the diff-scope gate; the edge-layer-neutral baseline moved only if reported and documented.
- Regression pins updated with every negative pin kept; the four gates are green apart from the recorded pre-existing failures.
- 10 live UAT rows handed off, none claimed passed.
</success_criteria>

<output>
Create `/Users/lmarques/Dev/efx-motion-editor/.planning/quick/261125-rtc-fix-the-bristle-brush-s-end-cap-density-/261125-rtc-SUMMARY.md` when done. It must carry: the pre/post table per cell, the writer map with the census evidence, the law and its measurement basis, the lift's pre/post numbers against its observation band (reported, never claimed as a pass), the pin changes, the edge-layer-neutral decision, the gate results with the pre-existing failures named, and the 10 unclaimed UAT rows.
</output>
