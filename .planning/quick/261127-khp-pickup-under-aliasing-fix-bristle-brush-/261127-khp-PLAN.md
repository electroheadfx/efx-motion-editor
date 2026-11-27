---
phase: 261127-khp
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/efx-watercolor/src/playground/bristles.ts
  - packages/efx-watercolor/src/playground/shaders.ts
  - packages/efx-watercolor/src/playground/Engine.ts
  - packages/efx-watercolor/src/playground/scattering.test.ts
  - packages/efx-watercolor/probe/medium-engine/probe.ts
  - packages/efx-watercolor/probe/medium-engine/run.mjs
  - packages/efx-watercolor/probe/medium-engine/compare.mjs
  - packages/efx-watercolor/probe/medium-engine/harness.test.ts
autonomous: true
requirements:
  - KHP-READOUT
  - KHP-LAW
  - KHP-HASH
  - KHP-IDENTITY
  - KHP-MEAN
  - KHP-BLEED
  - KHP-PARITY
  - KHP-DETERMINISM
  - KHP-PERF
  - KHP-UAT
estimate:
  tokens: 60000
  raw_tokens: 120000
  tasks: 3
  confidence: high
must_haves:
  truths:
    - "Pickup 0 is byte-identical: every Pickup-0 capture's four export digests (`digestPaper`, `digestTransparent`, `digestWhite`, `digestPigment`) equal the RED baseline, and no pre-dab snapshot sample is taken at Pickup 0 — the Engine's `if (this.params.pickup > 0) this.bristleSnapshot(rect);` guard and the shader's `if (uSmear > 0.0)` guard both stay (KHP-IDENTITY)."
    - "The law is ONE mean-preserving average of the pickup's under reference: the pre-dab snapshot pair (`uSnapA` and `uSnapB.xyz`) is the 5-tap mean at the centre and the four 1.5-px diagonal corners in the stroke frame — the SAME optical kernel the stroke layer already applies to its own film — on BOTH the sheet arm and (before the `underW` composition) the layer arm; `snapB.a` stays pointwise for the solid-under gate (KHP-LAW)."
    - "At the artist's cell (under #1a88ec Size 250 Pigment 100 Pickup 100 Dry 0 Edge 0; judged #f9e01c Size 250 Pigment 100 Pickup 100 Dry 0 Edge 100) the run-scale stripe RMS falls to at most max(1.0/255, half its RED reading), and every other cell that cleared the RED floor obeys the same bar; the Edge-0 twin obeys it too (KHP-LAW)."
    - "The n20 hash-mean extension below 200 px is applied ONLY when a RED flat-under reading on the Edge-0 arm is at least that same-size cell's GREEN bar (`flat >= max(1.0, half the painted RED)`); when applied, the hash arm's blend becomes `max(max(uSmearSmooth, uSmearSmoothBig), 1.0 - uSmearSmoothBig)` while `uCapBlurBig` keeps the shipped 200–300 blend, and the flat floor must halve (KHP-HASH)."
    - "The pickup mean is preserved: the body under-share moves by at most 0.03 from RED, the under colour does not bleed past the boundary by more than 2.5 px (and never grows by more than 2 px over RED), the blurred-under control never worsens by more than 0.75/255, and over paper the body mean moves by at most 1/255 with no stripe increase (KHP-MEAN, KHP-BLEED)."
    - "Bake equals re-render: the one-shot and split replays export byte-identically to the visit (`pickupUnderReplayIdentical` true, split digest equal), and the live/committed display keeps the existing polish law; the live surface itself stays an UNCLAIMED UAT row (KHP-PARITY, KHP-UAT)."
    - "All five gates pass (package vitest run, package tsc, package build, app vitest run, app tsc), the committed `edge-layer-neutral` and `neutral-identity` captures still compare, the bake cost is recorded at most 25% over RED, and no coverage/one-lerp, lateral-alpha, medium-record or UI file is touched (KHP-PERF)."
  artifacts:
    - path: packages/efx-watercolor/src/playground/bristles.ts
      provides: "BRISTLE_PICKUP_UNDER_PX = 1.5 — the under-average's corner reach, declared beside the other gather constants"
    - path: packages/efx-watercolor/src/playground/shaders.ts
      provides: "pickupUnderMean(sampler2D, vec2) and uPickupUnderPx in BRISTLE_GATHER; the two calls in bristleDepositFS inside the uSmear guard, with snapB.a left pointwise"
    - path: packages/efx-watercolor/src/playground/Engine.ts
      provides: "bindGather binds uPickupUnderPx from BRISTLE_PICKUP_UNDER_PX unconditionally (every gather consumer); the Pickup-0 snapshot guard unchanged"
    - path: packages/efx-watercolor/probe/medium-engine/probe.ts
      provides: "the pickup-under scenario (artist's exact under + judged stroke, four under kinds), the run-scale stripe/body-share/bleed/replay instruments, the PNG crop, the recipe echoes"
    - path: packages/efx-watercolor/probe/medium-engine/run.mjs
      provides: "--scenario pickup-under, --under painted|flat|blurred|none, the updated closed lists and allowlists, the &under= query append"
    - path: packages/efx-watercolor/probe/medium-engine/compare.mjs
      provides: "SCENARIO_INVARIANTS['pickup-under'] and pickupUnderFailures: the Pickup-0 control at most 1.0/255, the replay identity, the echo and finiteness bars"
    - path: packages/efx-watercolor/probe/medium-engine/harness.test.ts
      provides: "the scene/operand/readout pins, the comparator invariant fixture and rejection test, the source pins"
    - path: packages/efx-watercolor/src/playground/scattering.test.ts
      provides: "the updated smear-law pins: one pickupUnderMean call per reference, the pointwise snapB.a read, the helper's five taps, the guard ordering, the Engine bind, the bristles constant"
  key_links:
    - from: packages/efx-watercolor/src/playground/Engine.ts
      to: packages/efx-watercolor/src/playground/shaders.ts
      via: "bindGather's uPickupUnderPx binding feeds pickupUnderMean's uAxis/uSheet step; only uSmear > 0 reaches it"
    - from: packages/efx-watercolor/probe/medium-engine/probe.ts
      to: packages/efx-watercolor/probe/medium-engine/run.mjs
      via: "the pickup-under report's pickupUnderStripeRms / BodyShare / BoundaryBleedPx / replay fields, keyed by --scenario pickup-under --under"
    - from: packages/efx-watercolor/probe/medium-engine/compare.mjs
      to: packages/efx-watercolor/probe/medium-engine/probe.ts
      via: "pickupUnderFailures bars the probe's own report fields on every capture"
---

<objective>
Kill the pickup-under aliasing in the bristle medium. The pickup reads the pre-dab sheet pointwise (`cA = mix(cA, snapA, smear)` / `cB = mix(cB, snapB.xyz, smear)`), so a stroke with Pickup > 0 crossing a painted under of contrasting colour inherits the under's per-bristle film as regular longitudinal stripes — at Edge 0 and Edge 100, at every brush Size (the artist's cells: blue #1a88ec Size 250 Pigment 100 Pickup 100 Dry 0 Edge 0, then yellow #f9e01c Size 150 (and 250/400) Pigment 100 Pickup 100 Dry 0 Edge 100). The fix is ONE mean-preserving law: the UNDER reference used for pickup is a small local mean of the pre-dab snapshot pair, on both the sheet and layer arms, inside the existing Pickup guard — nothing else moves. The n20 hash mean is extended below its 200 px floor ONLY if the probe measures that the hash alone keeps an Edge-0 cell above its bar.

Purpose: remove a visible paint defect without touching the one-lerp deposit, the lateral alpha law, the medium records, or any UI.
Output: the one law + its source pins, the `pickup-under` probe scene with RED-then-GREEN measured bars, the committed RED evidence and GREEN acceptance, and an unclaimed live UAT hand-off.

Probe-first discipline (efx-studio-paint): reproduce through the real engine before changing a law; the RED bake is captured and judged BEFORE the law exists; a bar that cannot be met by the measured law is a STOP with the measured negative, never a partial law.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/skills/efx-studio-paint/SKILL.md
@/Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/src/playground/shaders.ts
@/Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/src/playground/Engine.ts
@/Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/src/playground/bristles.ts
@/Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/src/playground/scattering.test.ts
@/Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/probe/medium-engine/probe.ts
@/Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/probe/medium-engine/run.mjs
@/Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/probe/medium-engine/compare.mjs
@/Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/probe/medium-engine/harness.test.ts
@/Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/probe/medium-engine/blend.ts

# The shipped laws this quick must not touch

- The one law: a dab REPLACES pigment (`ink <- ink*(1-a) + C*a`, `fixed <- fixed*(1-a)`, `cover <- cover*(1-a) + T*a`). No new deposit term.
- The lateral alpha law: `aEff = lateralWeight(u, amount, falloff) * cover_L`. No change.
- The stroke-layer law: the self-similar reference `reference = uSnap*(1 - cover_L*sqrt(cover_L)) + prev`, the 1.5 exponent, the samePaint gate, the solid-under gate `smoothstep(0.55, 0.85, snapB.a/uBodyFloor)`, the five-tap layer-film average — all stay verbatim.
- Medium records, params, and every shell/UI file (`aquarelleParamVisibility`, panels, Studio) are out of scope.

# Probe conventions (established by 261124-…261127-jox)

- The probe is scratch harness only: `node packages/efx-watercolor/probe/medium-engine/run.mjs --gate <name> --scenario <scene> …` writes `/tmp/medium-engine/<gate>.json` and extracts PNGs beside it; `compare.mjs <gate>` reads committed baselines, `--other` compares same-session captures, and a run never starts a dev server.
- Gate names are fresh per capture; the crops for this quick must land under `/tmp/medium-engine/261127-khp-*`.
- The RED matrix is captured and judged before the law; the GREEN matrix re-runs the same cells under new gate names and is compared field by field to the RED JSONs (digests only for the Pickup-0 controls, which must be byte-identical).
- The scene's own work runs through the real `WatercolorEngine` + `createAquarelleEngineAdapter`; determinism comes from the per-stroke `mutationId` seeds. Vitest runs are always `vitest run` — never watch.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: RED — the pickup-under scene, its stripe/bleed instruments, and the committed RED matrix</name>
  <files>packages/efx-watercolor/probe/medium-engine/probe.ts, packages/efx-watercolor/probe/medium-engine/run.mjs, packages/efx-watercolor/probe/medium-engine/harness.test.ts</files>
  <behavior>
    - The scene paints the artist's exact under (#1a88ec, Gouache/bristle-round record, Size 250, Pigment 100 = the record's load, Pickup 100, Dry 0, Edge 0) left-to-right at y = 0.52*sheet from x 0.35 to 0.92, fixes it, then paints the judged stroke (#f9e01c, same record, Size --stroke-size, Pigment 100, Pickup --pickup, Dry 0, Edge --edge with falloff 50) at the same y from x 0.10 to 0.90 — entering the under at x = 0.35 — settles and fixes.
    - `--under painted|flat|blurred|none` selects the under kind: painted = the artist's recipe above; flat = a watercolor `round` wash of the same blue at Body 100 (no bristle runs, no pickup); blurred = the painted under passed through a CPU 5x5 box blur of the pigment/cover layers between the under's fix and the judged stroke; none = bare paper. Unknown kinds and the flag on any other scenario are refused, never ignored.
    - The report carries the run-scale stripe RMS (the detrended RGB deviation profile sampled at 0.5 px stations across the judged stroke's under-overlap, band-limited to 1–3 px), its total AC RMS, dominant wavelength and band share; the body under-share; the boundary bleed in px; the replay digests; the recipe echoes (kind, size, pickup, edge, the two hex colours, the boundary x); a 1:1 crossing crop as `pngMid` and the full sheet as `pngTransparent`.
    - RED floors: the artist cell (painted, Size 250, Edge 100, Pickup 100) reads `pickupUnderStripeRms` at least 2.0/255 AND at least 3x its same-cell Pickup-0 control; every Pickup-0 control reads at most 1.0/255; the Edge-0 twin reads at least 1.5/255 AND at least 2x its control. Every other cell is recorded.
    - A miss on the artist floor is a measured negative: print the numbers and STOP — do not proceed to the law.
    - The hash trigger is computed from the RED matrix and written to `/tmp/medium-engine/261127-khp-hash-extension.json`: for each judged size, flat-under Edge-0 versus that size's painted Edge-0 GREEN bar `max(1.0, half the painted RED)`; `apply` is true iff any size triggers.
  </behavior>
  <action>
    Follow the probe house style of the `bristle-line`/`bristle-blend`/`edge-rim` scenes; this task adds NO engine or shader change.

    1) `probe.ts` — the scene. Add the scenario constants: `PICKUP_UNDER_BLUE = '#1a88ec'`, `PICKUP_UNDER_YELLOW = '#f9e01c'`, `PICKUP_UNDER_UNDER_SIZE = 250`, the two mutation ids, the under's y = 0.52 and the points arrays (under x 0.35→0.92, judged x 0.10→0.90 at the same y, same cadence as the existing straight lines). Add `type UnderKind = 'painted' | 'flat' | 'blurred' | 'none'` and `readUnderKind()` reading the `under` query param, defaulting `painted`, throwing on anything else. Extend `readScenario`'s closed literal (the long `raw !== ...` chain near :8757) with `'pickup-under'`.

    2) `probe.ts` — the script builder `pickupUnderScript(kind, strokeSize, pickup, edge): readonly ScriptEntry[]`: the under entry uses `brushId: 'bristle-round'` and `params: bristleLineParams(100, PICKUP_UNDER_UNDER_SIZE, { dry: 0, pickup: 100, edge: 0, falloff: 50 })`; the judged entry uses `brushId: 'bristle-round'` and `params: bristleLineParams(100, strokeSize, { dry: 0, pickup, edge, falloff: 50 })`; both `settle: SETTLE_TICKS` and fixed after. For `flat`, replace the under entry with a plain watercolor band entry (default brush `round`, the same blue, `body: 100`) shaped like `whiteOverBlueScript`'s band. For `none`, omit the under entry. For `blurred`, keep the painted under entry and, after the under's `adapter.fix()` inside the drive loop and BEFORE the judged entry, run `blurWholeSheet(engine, sheet)`.

    3) `probe.ts` — `blurWholeSheet(engine, sheet)`: `captureSheet()`, and for `inkA`, `inkB`, `fixedA`, `fixedB`, `cover` run a separable 5x5 box blur in the half-float domain (`fromHalf` → sum/25 → `toHalf`; skip `wet`, `relief` and the exact-f32 `lastTouch`), then `restoreSheet()` and throw if it returns false. The blur softens the under's boundary on this control by design; the blurred cell is exempt from the bleed bar.

    4) `probe.ts` — the instruments. Add `rgbaBilinear(data, w, h, x, y)` and `pickupUnderProfile(...)`: at three x stations inside the under (0.45, 0.55, 0.65 of the sheet), sample vertical stations at 0.5 px across the judged stroke's intersection with the under (half-window = min(size, 250)/2 minus 10 px), compute the per-channel profile means, then the per-station RGB deviation magnitude, and feed it to the existing `shareSpectrum` from `blend.ts` with `{ stationPx: 0.5, bandLoPx: 1, bandHiPx: 3 }`. Report `pickupUnderStripeRms` = mean over the three stations of `acRms * sqrt(bandShare)` (0..255 units, round2), `pickupUnderStripeAc` = mean `acRms`, `pickupUnderStripePeakPx` = median `peakPx`, `pickupUnderStripeBandShare` = mean `bandShare`. Also report the same spectrum on the 4–32 px band as a diagnostic (`pickupUnderStripeWide*`) so the SUMMARY can state where the defect lives.

    5) `probe.ts` — the body share, bleed and replay. `pickupUnderBodyShare`: underRef = mean RGB of the under above the judged stroke at x 0.55; strokeRef = mean RGB of the judged stroke over paper at x 0.25; crossing = mean RGB of the judged body over x 0.45–0.85, y within ±size/4; share = dot(crossing − strokeRef, underRef − strokeRef) / max(|underRef − strokeRef|^2, 1e-6), round4. `pickupUnderBoundaryBleedPx`: along the judged centreline, compare each x from the boundary to +20 px against the far-field mean at x at least boundary + 12, and report the largest distance where the colour deviates by more than 2/255 (0 when none), round2. The replay reuses `edgeLayerVisitReport`'s pattern: `adapter.resetSheet()`, `pinStrokeStart(engine)`, replay the script (re-blurring between entries for `blurred`) once one-shot and once split with `renderPartialStrokes`, and report `pickupUnderReplayIdentical` (visit digest = one-shot = split), `pickupUnderReplayDigest`, `pickupUnderReplaySplitDigest`, `pickupUnderReplayMaxDelta`, `pickupUnderReplayDiffTexels`. Emit `pngMid` from a 1:1 crossing crop (boundary − 40 to boundary + size + 40, y ±(size/2 + 20)) and `pngTransparent` from the full export.

    6) `probe.ts` — drive and dispatch. Add a `scenario === 'pickup-under'` branch to the script ternary in `run()` and to the scene drive block (the same partial-stroke-first, tick-settle, fix cadence the edge scenes use, with the blur hook between entries). Add the `pickup-under` report spread in the run branches that build the result object. Add `pickup-under` to the scenes that accept the edge/pickup knobs: `readEdgeKnob`, `readEdgePickup` and `readEdgeFeather` (Feather stays at the record's 85; the flag is accepted but not needed), and to `readEdgeWetUnder`'s allowlist only if the implementation shares that guard — never silently ignore a knob.

    7) `run.mjs` — the operands. Add `'pickup-under'` to the scenario closed literal and both usage strings (:339 and the `:194` region), to `LAYER_SCENES` (so `--edge`, `--falloff`, `--pickup` and `--stroke-size` allow it), and to `PICKUP_SCENES`; add the stroke-size allowlist clause. Add `const readUnder = (scenario) => { ... }`: `--under` absent → undefined; value must be one of painted/flat/blurred/none; the flag is refused off `pickup-under`; return the value. Add `(under === undefined ? '' : '&under=' + under)` to `pageQuery` beside the `&feather=` append (:744).

    8) `harness.test.ts` — the pins. In the scenario/operands contract block (near :2280), add source pins for both closed lists (`'pickup-under'` in RUN's literal and in PROBE's `readScenario` chain), the `--under` reader and its refusal, the scene constants (`PICKUP_UNDER_BLUE`, `PICKUP_UNDER_YELLOW`, `PICKUP_UNDER_UNDER_SIZE = 250`), the report fields (`pickupUnderStripeRms:`, `pickupUnderStripePeakPx:`, `pickupUnderBodyShare:`, `pickupUnderBoundaryBleedPx:`, `pickupUnderReplayIdentical:`), and the blur helper. Do NOT pin the comparator yet — Task 3 registers it.

    9) Capture the RED matrix (25 gates) and commit the source. The gate names prefix `261127-khp-r-` so the crops land at `/tmp/medium-engine/261127-khp-r-*-mid.png` and `-transparent.png`. Judge it exactly as the verify below. If the artist floor is unmet, write the measured numbers into the summary inputs and STOP — a measured negative is a valid Task 1 outcome, and the law must not be written.
  </action>
  <verify>
    <automated>for size in 40 150 250 400; do for edge in 0 100; do node packages/efx-watercolor/probe/medium-engine/run.mjs --gate 261127-khp-r-painted-e${edge}-s${size} --scenario pickup-under --size 2048 --stroke-size ${size} --edge ${edge} --pickup 100 --under painted || exit 1; node packages/efx-watercolor/probe/medium-engine/run.mjs --gate 261127-khp-r-p0-e${edge}-s${size} --scenario pickup-under --size 2048 --stroke-size ${size} --edge ${edge} --pickup 0 --under painted || exit 1; done; done && for size in 40 150 250 400; do node packages/efx-watercolor/probe/medium-engine/run.mjs --gate 261127-khp-r-flat-e0-s${size} --scenario pickup-under --size 2048 --stroke-size ${size} --edge 0 --pickup 100 --under flat || exit 1; done && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate 261127-khp-r-flat-e100-s250 --scenario pickup-under --size 2048 --stroke-size 250 --edge 100 --pickup 100 --under flat && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate 261127-khp-r-blur-e100-s250 --scenario pickup-under --size 2048 --stroke-size 250 --edge 100 --pickup 100 --under blurred && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate 261127-khp-r-blur-e0-s250 --scenario pickup-under --size 2048 --stroke-size 250 --edge 0 --pickup 100 --under blurred && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate 261127-khp-r-none-e100-s250 --scenario pickup-under --size 2048 --stroke-size 250 --edge 100 --pickup 100 --under none && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate 261127-khp-r-none-e0-s250 --scenario pickup-under --size 2048 --stroke-size 250 --edge 0 --pickup 100 --under none && node -e "const fs=require('fs');const C=(g)=>{const p='/tmp/medium-engine/'+g+'.json';if(!fs.existsSync(p))throw new Error('missing '+p);const d=JSON.parse(fs.readFileSync(p,'utf8'));if(d.scenario!=='pickup-under')throw new Error(g+' scenario '+d.scenario);return d};const F=['pickupUnderStripeRms','pickupUnderStripeAc','pickupUnderStripePeakPx','pickupUnderStripeBandShare','pickupUnderBodyShare','pickupUnderBoundaryBleedPx'];const E=(d,g,k,s,p,e)=>{if(d.pickupUnderKind!==k)throw new Error(g+' kind '+d.pickupUnderKind);if(d.pickupUnderSize!==s)throw new Error(g+' size '+d.pickupUnderSize);if(d.pickupUnderPickup!==p)throw new Error(g+' pickup '+d.pickupUnderPickup);if(d.pickupUnderEdge!==e)throw new Error(g+' edge '+d.pickupUnderEdge);for(const f of F)if(typeof d[f]!=='number')throw new Error(g+' lacks '+f);if(d.pickupUnderReplayIdentical!==true)throw new Error(g+' replay not identical');return d};const sizes=[40,150,250,400];const R={};for(const s of sizes)for(const e of [0,100]){R['p'+e+'s'+s]=E(C('261127-khp-r-painted-e'+e+'-s'+s),'painted-e'+e+'-s'+s,'painted',s,100,e);R['z'+e+'s'+s]=E(C('261127-khp-r-p0-e'+e+'-s'+s),'p0-e'+e+'-s'+s,'painted',s,0,e);if(R['z'+e+'s'+s].pickupUnderStripeRms>1.0)throw new Error('Pickup-0 control over 1.0/255 at edge '+e+' size '+s)}for(const s of sizes)R['f0s'+s]=E(C('261127-khp-r-flat-e0-s'+s),'flat-e0-s'+s,'flat',s,100,0);R.f100=E(C('261127-khp-r-flat-e100-s250'),'flat-e100-s250','flat',250,100,100);R.b100=E(C('261127-khp-r-blur-e100-s250'),'blur-e100-s250','blurred',250,100,100);R.b0=E(C('261127-khp-r-blur-e0-s250'),'blur-e0-s250','blurred',250,100,0);R.n100=E(C('261127-khp-r-none-e100-s250'),'none-e100-s250','none',250,100,100);R.n0=E(C('261127-khp-r-none-e0-s250'),'none-e0-s250','none',250,100,0);for(const k of Object.keys(R)){const d=R[k];console.log(k,'stripe',d.pickupUnderStripeRms,'ac',d.pickupUnderStripeAc,'peak',d.pickupUnderStripePeakPx,'bandShare',d.pickupUnderStripeBandShare,'share',d.pickupUnderBodyShare,'bleed',d.pickupUnderBoundaryBleedPx)}const a=R.p100s250,z=R.z100s250,a0=R.p0s250,z0=R.z0s250;if(!(a.pickupUnderStripeRms>=2.0))throw new Error('RED floor unmet: artist stripe '+a.pickupUnderStripeRms+'/255 under 2.0 — STOP with the measured negative');if(!(a.pickupUnderStripeRms>=3*z.pickupUnderStripeRms))throw new Error('RED floor unmet: artist '+a.pickupUnderStripeRms+' not 3x the Pickup-0 control '+z.pickupUnderStripeRms+' — STOP with the measured negative');if(!(a0.pickupUnderStripeRms>=1.5))throw new Error('RED floor unmet: edge-0 twin '+a0.pickupUnderStripeRms+' under 1.5 — STOP with the measured negative');if(!(a0.pickupUnderStripeRms>=2*z0.pickupUnderStripeRms))throw new Error('RED floor unmet: edge-0 twin not 2x its control — STOP with the measured negative');const trig={apply:false,rows:[]};for(const s of sizes){const bar=Math.max(1.0,0.5*R['p0s'+s].pickupUnderStripeRms);const flat=R['f0s'+s].pickupUnderStripeRms;const row={size:s,flat:flat,paintedEdge0:R['p0s'+s].pickupUnderStripeRms,bar:bar,triggers:flat>=bar};if(row.triggers)trig.apply=true;trig.rows.push(row);console.log('trigger size',s,'flat',flat,'painted',row.paintedEdge0,'bar',bar,row.triggers?'TRIGGERS':'no')}fs.writeFileSync('/tmp/medium-engine/261127-khp-hash-extension.json',JSON.stringify(trig,null,2));console.log('RED confirmed; HASH_EXTENSION='+(trig.apply?'yes':'no'))" && test $(ls /tmp/medium-engine/261127-khp-r-*-mid.png | wc -l) -eq 25 && pnpm --dir packages/efx-watercolor exec vitest run && pnpm --dir packages/efx-watercolor check</automated>
  </verify>
  <done>
    The `pickup-under` scene runs all 25 RED cells with the four under kinds; the artist cell reproduces at least 2.0/255 and at least 3x its Pickup-0 control, the Edge-0 twin at least 1.5/255 and at least 2x its control, every Pickup-0 control at most 1.0/255; the RED matrix, the trigger file and 25 full-resolution crossing crops are on disk under `/tmp/medium-engine/261127-khp-*`; the scene pins are in `harness.test.ts`; package vitest and tsc are green. If the artist floor was unmet, the measured numbers are recorded and the task stopped there.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: GREEN — the ONE under-average law (and the measured n20 hash-mean extension only if the RED floor demands it)</name>
  <files>packages/efx-watercolor/src/playground/bristles.ts, packages/efx-watercolor/src/playground/shaders.ts, packages/efx-watercolor/src/playground/Engine.ts, packages/efx-watercolor/src/playground/scattering.test.ts</files>
  <behavior>
    - The pickup's under reference is the 5-tap mean of the pre-dab snapshot pair: the centre plus the four corners at ±1.5 px along the stroke normal and tangent (the SAME 0.2-weight kernel the stroke layer already applies to its own film, rotated into the stroke frame). It applies identically to `uSnapA` and to `uSnapB.xyz`, before the layer's `underW` composition, and only inside `if (uSmear > 0.0)`.
    - `snapB.a` stays the pointwise read (the solid-under gate and the layer composition's alpha), the pickup weight `smearWeight`, the samePaint gate, the `underW` lines, the two mix lines, the one-lerp deposit, the lateral alpha law and the medium record are verbatim.
    - Pickup 0 is byte-identical: the pre-dab snapshot is still not taken, and every Pickup-0 capture's four export digests equal its RED counterpart.
    - GREEN: the artist cells (painted, Edge 100 and Edge 0, Size 250) read at most max(1.0/255, half their RED stripe RMS); the body under-share moves by at most 0.03; the boundary bleed is at most 2.5 px and grows by at most 2 px over RED; the flat-under Edge-0 cells meet the hash bar (halved when the extension applies, within 0.75/255 when it does not); every GREEN capture's replay is byte-identical.
    - The hash extension is applied iff `/tmp/medium-engine/261127-khp-hash-extension.json` says `apply: true`: the hash arm's blend becomes the max of the three terms `max(max(uSmearSmooth, uSmearSmoothBig), 1.0 - uSmearSmoothBig)` — the n20 mean extended below 200 px while a 250 px stroke keeps its shipped 0.5 blend and `uCapBlurBig` keeps the shipped 200–300 blend verbatim. It is not applied otherwise.
    - If the bars cannot be met by this measured law, STOP with the measured negative: no second tuning parameter, no size gate, no partial law.
  </behavior>
  <action>
    The ONE law, minimal diff. First read `/tmp/medium-engine/261127-khp-hash-extension.json`; if it is missing or the RED captures are absent, STOP — Task 2 cannot be judged without the RED matrix.

    1) `bristles.ts` — declare `export const BRISTLE_PICKUP_UNDER_PX = 1.5` beside the other gather constants (`BRISTLE_SMEAR_PERIOD_PX`, `BRISTLE_SMEAR_CAP`, `BRISTLE_BIG_FROM_PX`), with a comment: the pickup under reference's local mean — the centre plus four 1.5 px diagonal corners in the stroke frame; the SAME optical kernel the layer film already uses; the shipped sheet read at Pickup 0 is untouched because the whole block is gated.

    2) `shaders.ts` — in `BRISTLE_GATHER` (the string that declares `uSmearPeriodPx`, `uSmearCap`, `uSmearSmooth`, `uSmearSmoothBig`, `uAxis`, `uSheet`, and defines `smearWeight` near :1253), add `uniform float uPickupUnderPx;` and ONE helper: `vec4 pickupUnderMean(sampler2D ref, vec2 uv){` with `vec2 n = (uPickupUnderPx * uAxis) / uSheet;`, `vec2 t = (uPickupUnderPx * vec2(-uAxis.y, uAxis.x)) / uSheet;`, and `return 0.2 * (texture(ref, uv) + texture(ref, uv + n + t) + texture(ref, uv - n + t) + texture(ref, uv + n - t) + texture(ref, uv - n - t));`. Passing a sampler is established by the gather's own `bristleTex(sampler2D t, int idx)`; the step is componentwise in uv so `uAxis`/`uSheet` keep their existing doc-frame meaning.

    3) `shaders.ts` — in `bristleDepositFS` inside `if (uSmear > 0.0)` (near :1632-1725), keep `vec4 snapB = texture(uSnapB, vUv);` and the solid gate line verbatim, then replace the single `vec4 snapA = texture(uSnapA, vUv);` with `vec4 snapA = pickupUnderMean(uSnapA, vUv);` and add `snapB.xyz = pickupUnderMean(uSnapB, vUv).xyz;`. Everything after — the `uSmearSmooth > 0.5` layer branch, `underW`, the two composition lines, samePaint and the two mixes — stays byte-identical, so the layer's own film average (`prevA`/`prevB`) and its `snapB.a` read are untouched. Extend the block comment above with the one-line reason (the under's per-bristle film aliased into longitudinal stripes; the reference is now its local mean, mean-preserving, gated by Pickup).

    4) `Engine.ts` — import `BRISTLE_PICKUP_UNDER_PX` and add `gl.uniform1f(p.u.uPickupUnderPx!, BRISTLE_PICKUP_UNDER_PX);` in `bindGather` beside the `uSmearPeriodPx`/`uSmearCap` binds (:4155). Bind unconditionally like the other gather constants; the shader only reads it inside the Pickup guard.

    5) Conditional n20 hash extension — only if `apply` is true. In `smearWeight`, change the final `return mix(raw, smoothSmearMean(k, uSmearCap), max(uSmearSmooth, uSmearSmoothBig));` to use `max(max(uSmearSmooth, uSmearSmoothBig), 1.0 - uSmearSmoothBig)`. Do NOT touch `uCapBlurBig` (still `bigBrush`) or the `uSmearSmoothBig` bind. If `apply` is false, leave the line verbatim and record that the hash floor did not demand it.

    6) `scattering.test.ts` — update the smear-law pins. Replace the two one-read pins at :1462-1463 with: exactly one `pickupUnderMean(uSnapA, vUv)` call and one `pickupUnderMean(uSnapB, vUv)` call in the deposit; exactly one pointwise `texture(uSnapB, vUv)` (the gate); exactly one `vec4 pickupUnderMean(` definition in the gather; pins for `uniform float uPickupUnderPx;`, the `n`/`t` step lines, the `0.2 *` weight and the four corner taps; index checks that both calls sit after the `if (uSmear > 0.0) {` anchor. Keep the solid-gate, samePaint, `underW`, composition and mix pins verbatim. Add the Engine bind pin (`gl.uniform1f(p.u.uPickupUnderPx!, BRISTLE_PICKUP_UNDER_PX);`) and the bristles constant pin (`export const BRISTLE_PICKUP_UNDER_PX = 1.5`). If the hash extension applied, update the :1319 pin to the new max-of-three expression and pin that `uCapBlurBig` still binds `bigBrush`.

    7) Run the GREEN primary cells (9 gates, names prefixed `261127-khp-g-`) and judge exactly as the verify below: the artist Edge-100 and Edge-0 cells, both Pickup-0 controls, the flat Edge-0 size sweep and flat Edge-100 at 250. The remaining evidence cells are Task 3's job — do not re-run them here. If a bar is unmet, STOP with the measured negative; do not tune the footprint, add a size gate, or ship a partial law.
  </action>
  <verify>
    <automated>for edge in 0 100; do node packages/efx-watercolor/probe/medium-engine/run.mjs --gate 261127-khp-g-painted-e${edge}-s250 --scenario pickup-under --size 2048 --stroke-size 250 --edge ${edge} --pickup 100 --under painted || exit 1; node packages/efx-watercolor/probe/medium-engine/run.mjs --gate 261127-khp-g-p0-e${edge}-s250 --scenario pickup-under --size 2048 --stroke-size 250 --edge ${edge} --pickup 0 --under painted || exit 1; done && for size in 40 150 250 400; do node packages/efx-watercolor/probe/medium-engine/run.mjs --gate 261127-khp-g-flat-e0-s${size} --scenario pickup-under --size 2048 --stroke-size ${size} --edge 0 --pickup 100 --under flat || exit 1; done && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate 261127-khp-g-flat-e100-s250 --scenario pickup-under --size 2048 --stroke-size 250 --edge 100 --pickup 100 --under flat && node -e "const fs=require('fs');const C=(g)=>{const p='/tmp/medium-engine/'+g+'.json';if(!fs.existsSync(p))throw new Error('missing '+p);return JSON.parse(fs.readFileSync(p,'utf8'))};const trig=JSON.parse(fs.readFileSync('/tmp/medium-engine/261127-khp-hash-extension.json','utf8'));const D=(a,b,label)=>{const g=C(a),r=C(b);if(g.scenario!=='pickup-under')throw new Error(a+' wrong scenario');if(g.pickupUnderReplayIdentical!==true)throw new Error(a+' replay not identical');if(g.pickupUnderPickup===0){for(const k of ['digestPaper','digestTransparent','digestWhite','digestPigment'])if(g[k]!==r[k])throw new Error(a+' Pickup-0 digest '+k+' moved');if(g.pickupUnderStripeRms>1.0)throw new Error(a+' Pickup-0 stripe '+g.pickupUnderStripeRms);console.log(label,'Pickup-0 byte-identical');return null}const bar=Math.max(1.0,0.5*r.pickupUnderStripeRms);console.log(label,'red',r.pickupUnderStripeRms,'green',g.pickupUnderStripeRms,'bar',bar,'share',r.pickupUnderBodyShare,g.pickupUnderBodyShare,'bleed',r.pickupUnderBoundaryBleedPx,g.pickupUnderBoundaryBleedPx);if(g.pickupUnderStripeRms>bar)throw new Error(label+' GREEN bar unmet: '+g.pickupUnderStripeRms+' over '+bar+' — STOP with the measured negative');if(Math.abs(g.pickupUnderBodyShare-r.pickupUnderBodyShare)>0.03)throw new Error(label+' body share moved by more than 0.03');if(g.pickupUnderBoundaryBleedPx>2.5)throw new Error(label+' bleed over 2.5 px');if(g.pickupUnderBoundaryBleedPx>r.pickupUnderBoundaryBleedPx+2)throw new Error(label+' bleed grew by more than 2 px');return g};D('261127-khp-g-painted-e100-s250','261127-khp-r-painted-e100-s250','artist-e100');D('261127-khp-g-painted-e0-s250','261127-khp-r-painted-e0-s250','artist-e0');D('261127-khp-g-p0-e100-s250','261127-khp-r-p0-e100-s250','p0-e100');D('261127-khp-g-p0-e0-s250','261127-khp-r-p0-e0-s250','p0-e0');for(const s of [40,150,250,400]){const g=C('261127-khp-g-flat-e0-s'+s),r=C('261127-khp-r-flat-e0-s'+s);const bar=Math.max(1.0,0.5*r.pickupUnderStripeRms);console.log('flat-e0-s'+s,'red',r.pickupUnderStripeRms,'green',g.pickupUnderStripeRms,'bar',bar,'extension',trig.apply);if(trig.apply){if(g.pickupUnderStripeRms>bar)throw new Error('flat-e0-s'+s+' hash mean did not collapse: '+g.pickupUnderStripeRms+' over '+bar+' — STOP with the measured negative')}else if(g.pickupUnderStripeRms>r.pickupUnderStripeRms+0.75)throw new Error('flat-e0-s'+s+' stripe grew without the hash extension')}console.log('GREEN primary confirmed')" && pnpm --dir packages/efx-watercolor exec vitest run && pnpm --dir packages/efx-watercolor check</automated>
  </verify>
  <done>
    The one under-average law is in place (helper + uniform + two calls, pointwise `snapB.a`), the hash extension is applied or not exactly as the RED trigger measured, the source pins are updated and green, the artist Edge-100 and Edge-0 cells meet max(1.0/255, half RED) with the body share, bleed and replay bars, the Pickup-0 digests are byte-identical, and package vitest + tsc are green.
  </done>
</task>

<task type="auto">
  <name>Task 3: the remaining GREEN matrix, the registered comparator bar, the full gates and the unclaimed UAT hand-off</name>
  <files>packages/efx-watercolor/probe/medium-engine/compare.mjs, packages/efx-watercolor/probe/medium-engine/harness.test.ts</files>
  <action>
    1) `compare.mjs` — register the scene. Add `'pickup-under': pickupUnderFailures,` to `SCENARIO_INVARIANTS` (near :2371) and define `pickupUnderFailures(data, reference)`: require the recipe echoes (`pickupUnderKind` in painted/flat/blurred/none, `pickupUnderSize` 1..800, `pickupUnderPickup` 0..100, `pickupUnderEdge` 0..100) and the finite numeric readings (`pickupUnderStripeRms`, `pickupUnderStripeAc`, `pickupUnderStripePeakPx`, `pickupUnderStripeBandShare`, `pickupUnderBodyShare`, `pickupUnderBoundaryBleedPx`); when `pickupUnderPickup === 0` require `pickupUnderStripeRms` at most 1.0 (the clean-control law); require `pickupUnderReplayIdentical === true` and `pickupUnderReplaySplitDigest === pickupUnderReplayDigest`; require `pickupUnderReplayMaxDelta` at most 0. The RED/GREEN ratio bar is NOT permanent here — the comparator cannot tell a RED capture from a GREEN one; the ratio is judged by the verify chains and recorded in the summary. Add a short `printPickupUnder` print block beside the existing scene printers so the stripe/peak/share/bleed numbers always show.

    2) `harness.test.ts` — the comparator contract. Add a `validPickupUnderCapture()` fixture matching the probe's report shape (painted, size 250, pickup 100, edge 100, finite readings, replay identical). Add two rejection tests: `{ ...validPickupUnderCapture(), pickupUnderPickup: 0, pickupUnderStripeRms: 1.5 }` must be rejected with a line naming `pickupUnderStripeRms`; `{ ...validPickupUnderCapture(), pickupUnderReplayIdentical: false }` must be rejected with a line naming the replay. Add source pins: `'pickup-under': pickupUnderFailures,`, `function pickupUnderFailures(`, `'pickupUnderStripeRms'`, `'pickupUnderReplayIdentical'`, and the Pickup-0 at-most-1.0 bar.

    3) Run the remaining GREEN cells (16 gates, prefixed `261127-khp-g-`): painted Edge 100 and Edge 0 at Sizes 40/150/400, the Pickup-0 sweep at all four sizes on both edges, blurred Edge 100/Edge 0 at 250, and none/paper Edge 100/Edge 0 at 250, plus one determinism re-run of the artist cell (`261127-khp-g-painted-e100-s250-r2`). Do not re-run Task 2's nine cells. Then judge the full 25 RED/GREEN pairs with the same bars: painted/reproduced cells at most max(1.0, half RED), body share within 0.03, bleed at most 2.5 px and at most RED + 2 px; blurred cells stripe at most RED + 0.75 and share within 0.03; the none/paper cells' body mean within 1/255 and stripe at most RED + 0.75; every Pickup-0 digest identical; every replay identical. If a cell fails, STOP with the measured negative and do not claim the quick.

    4) Re-run the committed identity gates: `--gate edge-layer-neutral --scenario edge-layer --size 2048 --edge 0 --falloff 50` then `compare.mjs edge-layer-neutral --edge-structural` and `compare.mjs edge-layer-neutral` (the four digests and the layer-structural zero); `--gate neutral-identity` with no operands then `compare.mjs neutral-identity` (the sheet path's Pickup-0 byte identity). Compare the determinism pair with `compare.mjs 261127-khp-g-painted-e100-s250 --other 261127-khp-g-painted-e100-s250-r2` (wall clock excluded).

    5) All five gates: `pnpm --dir packages/efx-watercolor exec vitest run`, `pnpm --dir packages/efx-watercolor check`, `pnpm --dir packages/efx-watercolor run build`, `pnpm --dir app exec vitest run`, `pnpm --dir app exec tsc --noEmit`. Record the bake cost (the artist RED vs GREEN `bakeMs`, at most 25% over RED) and the crop inventory: 25 RED and 26 GREEN (25 cells + the `-r2` determinism re-run) `-mid.png`/`-transparent.png` files under `/tmp/medium-engine/261127-khp-*`.

    6) Hand off, do not claim. Write the SUMMARY inputs for the orchestrator: the RED matrix table (every cell: kind/size/edge/pickup, stripe RMS, peak px, band share, body share, bleed), the trigger decision, the GREEN matrix table, the RED/GREEN ratios, the determinism verdict, the committed-gate verdicts, the five gate results, the cost, the one-law statement, and the UNCLAIMED live UAT rows naming the exact surfaces: the artist's blue-then-yellow pair live (Edge 100, Pickup 100, Sizes 40/150/250/400) with the stripes gone; the same after settle; leave/reopen plus a forced re-render; Undo/Redo of the judged stroke; Edge 0 Pickup 100 over the painted under; the Pickup-0 control (no change); the stroke over bare paper (no new band or edge); the green pickup mean preserved (the body still drags the under's colour, no darker/lighter body); and the same pair at the artist's 150 px judged size. Finish automated-ready — the live surface is the artist's to judge.
  </action>
  <verify>
    <automated>for edge in 0 100; do for size in 40 150 400; do node packages/efx-watercolor/probe/medium-engine/run.mjs --gate 261127-khp-g-painted-e${edge}-s${size} --scenario pickup-under --size 2048 --stroke-size ${size} --edge ${edge} --pickup 100 --under painted || exit 1; node packages/efx-watercolor/probe/medium-engine/run.mjs --gate 261127-khp-g-p0-e${edge}-s${size} --scenario pickup-under --size 2048 --stroke-size ${size} --edge ${edge} --pickup 0 --under painted || exit 1; done; done && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate 261127-khp-g-blur-e100-s250 --scenario pickup-under --size 2048 --stroke-size 250 --edge 100 --pickup 100 --under blurred && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate 261127-khp-g-blur-e0-s250 --scenario pickup-under --size 2048 --stroke-size 250 --edge 0 --pickup 100 --under blurred && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate 261127-khp-g-none-e100-s250 --scenario pickup-under --size 2048 --stroke-size 250 --edge 100 --pickup 100 --under none && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate 261127-khp-g-none-e0-s250 --scenario pickup-under --size 2048 --stroke-size 250 --edge 0 --pickup 100 --under none && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate 261127-khp-g-painted-e100-s250-r2 --scenario pickup-under --size 2048 --stroke-size 250 --edge 100 --pickup 100 --under painted && node -e "const fs=require('fs');const C=(g)=>{const p='/tmp/medium-engine/'+g+'.json';if(!fs.existsSync(p))throw new Error('missing '+p);return JSON.parse(fs.readFileSync(p,'utf8'))};const trig=JSON.parse(fs.readFileSync('/tmp/medium-engine/261127-khp-hash-extension.json','utf8'));const sizes=[40,150,250,400];const R=(g)=>C('261127-khp-r-'+g),G=(g)=>C('261127-khp-g-'+g);const bar=(r)=>Math.max(1.0,0.5*r.pickupUnderStripeRms);const pairs=[];for(const s of sizes)for(const e of [0,100]){pairs.push({k:'painted-e'+e+'-s'+s,painted:true});pairs.push({k:'p0-e'+e+'-s'+s,painted:false,control:true})}for(const s of sizes)pairs.push({k:'flat-e0-s'+s,flat:true});pairs.push({k:'flat-e100-s250',flat:true});pairs.push({k:'blur-e100-s250',blur:true});pairs.push({k:'blur-e0-s250',blur:true});pairs.push({k:'none-e100-s250',none:true});pairs.push({k:'none-e0-s250',none:true});for(const p of pairs){const g=G(p.k),r=R(p.k);if(g.pickupUnderReplayIdentical!==true)throw new Error(p.k+' replay not identical');if(p.control){for(const d of ['digestPaper','digestTransparent','digestWhite','digestPigment'])if(g[d]!==r[d])throw new Error(p.k+' Pickup-0 digest '+d+' moved');if(g.pickupUnderStripeRms>1.0)throw new Error(p.k+' control over 1.0/255');console.log(p.k,'Pickup-0 byte-identical');continue}if(p.painted){const b=bar(r);console.log(p.k,'red',r.pickupUnderStripeRms,'green',g.pickupUnderStripeRms,'bar',b,'share',r.pickupUnderBodyShare,g.pickupUnderBodyShare,'bleed',r.pickupUnderBoundaryBleedPx,g.pickupUnderBoundaryBleedPx);if(g.pickupUnderStripeRms>b)throw new Error(p.k+' GREEN bar unmet: '+g.pickupUnderStripeRms+' over '+b);if(Math.abs(g.pickupUnderBodyShare-r.pickupUnderBodyShare)>0.03)throw new Error(p.k+' body share moved');if(g.pickupUnderBoundaryBleedPx>2.5)throw new Error(p.k+' bleed over 2.5 px');if(g.pickupUnderBoundaryBleedPx>r.pickupUnderBoundaryBleedPx+2)throw new Error(p.k+' bleed grew');continue}if(p.flat){const b=bar(r);console.log(p.k,'red',r.pickupUnderStripeRms,'green',g.pickupUnderStripeRms,'bar',b,'extension',trig.apply);if(trig.apply){if(g.pickupUnderStripeRms>b)throw new Error(p.k+' hash mean did not collapse')}else if(g.pickupUnderStripeRms>r.pickupUnderStripeRms+0.75)throw new Error(p.k+' stripe grew');continue}if(p.blur){console.log(p.k,'red',r.pickupUnderStripeRms,'green',g.pickupUnderStripeRms,'share',r.pickupUnderBodyShare,g.pickupUnderBodyShare);if(g.pickupUnderStripeRms>r.pickupUnderStripeRms+0.75)throw new Error(p.k+' stripe worsened');if(Math.abs(g.pickupUnderBodyShare-r.pickupUnderBodyShare)>0.03)throw new Error(p.k+' share moved');continue}if(p.none){console.log(p.k,'red',r.pickupUnderStripeRms,'green',g.pickupUnderStripeRms,'share',r.pickupUnderBodyShare,g.pickupUnderBodyShare);if(g.pickupUnderStripeRms>r.pickupUnderStripeRms+0.75)throw new Error(p.k+' stripe grew over paper');if(Math.abs(g.pickupUnderBodyShare-r.pickupUnderBodyShare)>0.03)throw new Error(p.k+' paper share moved')}}console.log('GREEN full matrix confirmed')" && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate edge-layer-neutral --scenario edge-layer --size 2048 --edge 0 --falloff 50 && node packages/efx-watercolor/probe/medium-engine/compare.mjs edge-layer-neutral --edge-structural && node packages/efx-watercolor/probe/medium-engine/compare.mjs edge-layer-neutral && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate neutral-identity && node packages/efx-watercolor/probe/medium-engine/compare.mjs neutral-identity && node packages/efx-watercolor/probe/medium-engine/compare.mjs 261127-khp-g-painted-e100-s250 --other 261127-khp-g-painted-e100-s250-r2 && test $(ls /tmp/medium-engine/261127-khp-*-mid.png | wc -l) -eq 51 && pnpm --dir packages/efx-watercolor exec vitest run && pnpm --dir packages/efx-watercolor check && pnpm --dir packages/efx-watercolor run build && pnpm --dir app exec vitest run && pnpm --dir app exec tsc --noEmit</automated>
  </verify>
  <done>
    All 25 GREEN cells are captured and every RED/GREEN pair meets its bar (or the task stopped with a measured negative); the comparator invariant and its pins are in place; the determinism pair is field-identical; the committed `edge-layer-neutral`/`neutral-identity` gates still compare; all five gates are green; the bake cost and the 25 RED + 26 GREEN full-resolution crops are recorded; the unclaimed live UAT rows naming every surface are handed to the artist; nothing outside the eight listed files changed.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| probe harness → engine GL | In-process, read-only exports; the new taps read only the engine's own pre-dab snapshot pair, never another target |
| snapshot tap → document edge | The ±1.5 px corner offsets can point outside the painted rect; the snapshot targets are CLAMP_TO_EDGE, so the read clamps, never wraps |
| capture → comparator | The report's numeric fields drive the bar; a missing/renamed field must fail loudly, never pass silently |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261127-01 | Tampering | `pickupUnderMean` in `BRISTLE_GATHER` | medium | mitigate | Only `uSnapA`/`uSnapB` are sampled (helper takes the sampler, callers pass the two snapshot uniforms); calls are pinned inside `if (uSmear > 0.0)`; Pickup 0 digests byte-identical to RED |
| T-261127-02 | Information disclosure | the averaged under across a colour boundary | medium | mitigate | Boundary-bleed readout at most 2.5 px and at most RED + 2 px on every painted cell; over-paper body mean within 1/255; live UAT row |
| T-261127-03 | Denial of service | deposit cost (8 extra snapshot fetches per fragment) | low | mitigate | `bakeMs` RED vs GREEN recorded, at most 25% over RED; the law adds no extra draw and no new target |
| T-261127-04 | Tampering | Pickup-0 identity / the committed gates | high | mitigate | The Engine's `pickup > 0` snapshot guard and the `uSmear > 0` shader guard stay; Pickup-0 digests equal RED; `edge-layer-neutral` and `neutral-identity` re-compared to their committed baselines |
| T-261127-SC | Tampering | package installs | high | mitigate | No install task exists in this quick; any new dependency is out of scope and would need the Package Legitimacy Gate plus a blocking human checkpoint |
</threat_model>

<verification>
| # | Gate | Command | Bar |
|---|------|---------|-----|
| 1 | Package suite | `pnpm --dir packages/efx-watercolor exec vitest run` | green; the updated smear-law pins and the new scene/comparator pins |
| 2 | Package typecheck | `pnpm --dir packages/efx-watercolor check` | clean |
| 3 | Package build | `pnpm --dir packages/efx-watercolor run build` | clean |
| 4 | App suite | `pnpm --dir app exec vitest run` | green |
| 5 | App typecheck | `pnpm --dir app exec tsc --noEmit` | clean |
| 6 | RED matrix | 25 `261127-khp-r-*` captures, judged by the Task 1 node script | artist cell at least 2.0/255 and 3x its Pickup-0 control; Edge-0 twin at least 1.5/255 and 2x its control; every Pickup-0 control at most 1.0/255 |
| 7 | GREEN matrix | 25 `261127-khp-g-*` captures, compared field by field to the RED JSONs | painted/reproduced cells at most max(1.0/255, half RED); body share within 0.03; bleed at most 2.5 px and RED + 2 px; blur at most RED + 0.75/255; over paper within 1/255 and no stripe increase |
| 8 | Pickup-0 identity | every `-p0-` capture | four digests byte-identical to RED; stripe at most 1.0/255 |
| 9 | Hash trigger | `261127-khp-hash-extension.json` | the extension applied iff a flat Edge-0 reading at a judged size is at least that size's GREEN bar; when applied, the flat floor halves |
| 10 | Determinism | `compare.mjs 261127-khp-g-painted-e100-s250 --other 261127-khp-g-painted-e100-s250-r2` | every compared field equal, wall clock excluded |
| 11 | Committed identity gates | `edge-layer-neutral` + `--edge-structural`, `neutral-identity` | the committed baselines compare; layerAllocated false / mergeDraws 0 on the neutral gate |
| 12 | Bake = re-render | every capture's replay rows | visit = one-shot = split digest; replay max delta 0 |
| 13 | Cost | the artist RED vs GREEN `bakeMs` | recorded, at most 25% over RED |
| 14 | Crops | `ls /tmp/medium-engine/261127-khp-*-mid.png | wc -l` | 51 full-resolution crossing crops (25 RED + 26 GREEN, the `-r2` re-run included), plus the transparent sheets |
| 15 | UAT hand-off | the SUMMARY | the live rows are listed and UNCLAIMED; nothing is claimed as live-verified |
</verification>

<success_criteria>
- The ONE law is exactly the mean-preserving 5-tap under-reference average (centre + four 1.5 px stroke-frame corners), applied to `uSnapA` and `uSnapB.xyz` inside the existing Pickup guard on both arms; `snapB.a`, the solid gate, samePaint, `underW`, the mixes, the one-lerp deposit and the lateral alpha law are untouched. One commit of the law, no second tuning parameter, no size gate.
- The n20 hash-mean extension is present only when the RED probe measured that the hash alone keeps an Edge-0 cell above its GREEN bar; the cap-alpha big-brush blend is untouched either way.
- Pickup 0 is byte-identical against the RED matrix and against the committed `neutral-identity` gate; the committed `edge-layer-neutral` gate still compares structurally.
- At the artist's exact pair the run-scale stripe RMS falls to at most max(1.0/255, half its RED reading) on both Edge 100 and Edge 0; the body under-share moves by at most 0.03; the under colour bleeds at most 2.5 px past the boundary; over paper the body mean moves by at most 1/255 with no new stripe.
- Bake equals re-render on every capture; determinism is field-identical; the live surface remains an unclaimed UAT row with the exact sizes and edges named.
- All five gates pass; the cost and 25+25 full-resolution crops under `/tmp/medium-engine/261127-khp-*` are recorded; no coverage/one-lerp, lateral-alpha, medium-record or UI file changed; nothing was pushed and no dev server was started.
- If the measured bars cannot be met by the measured law, the quick ends with the measured negative in the SUMMARY — no partial law, no retry with a second parameter.
</success_criteria>

<output>
Create `.planning/quick/261127-khp-pickup-under-aliasing-fix-bristle-brush-/261127-khp-SUMMARY.md` when done, carrying: the RED matrix table (kind/size/edge/pickup/stripe RMS/peak px/band share/body share/bleed), the hash-trigger decision with its per-size readings, the GREEN matrix table, the RED-to-GREEN ratios, the Pickup-0 digest identity, the determinism and replay verdicts, the committed-gate verdicts, the five gate results, the bake cost, the one-law statement (and the hash extension's presence or absence), the file list, and the UNCLAIMED live UAT rows naming every surface. End status: automated-ready.
</output>
