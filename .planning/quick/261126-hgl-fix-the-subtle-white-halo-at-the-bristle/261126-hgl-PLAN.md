---
phase: 261126-hgl
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/efx-watercolor/src/playground/shaders.ts
  - packages/efx-watercolor/src/playground/shaders.test.ts
  - packages/efx-watercolor/src/playground/Engine.ts
  - packages/efx-watercolor/src/playground/coverageLifecycle.test.ts
  - packages/efx-watercolor/probe/medium-engine/probe.ts
  - packages/efx-watercolor/probe/medium-engine/run.mjs
  - packages/efx-watercolor/probe/medium-engine/compare.mjs
  - packages/efx-watercolor/probe/medium-engine/harness.test.ts
autonomous: true
requirements:
  - HGL-READOUT
  - HGL-LAW
  - HGL-IDENTITY
  - HGL-PARITY
  - HGL-DETERMINISM
  - HGL-UAT
estimate:
  tokens: 80000
  raw_tokens: 80000
  tasks: 2
  confidence: low
must_haves:
  truths:
    - "At the artist's recipe (Edge 100, noise Feather 100, Pickup 100 AND 0, Body 100, bristle-round) the committed display profile across a stroke's fringe never carries a station lighter than the painted stations on BOTH sides of it: the fringe dip reads at most 1/255 on both lateral axes (`edgeFringeDipPaper` along stroke A over paper, `edgeFringeDipUnder` along stroke B over the different-colour under) at falloff 0 / 50 / 100 (HGL-LAW)."
    - "The composite is the occupancy-normalized coefficient mix `film_out = (1 - aEff)·F_S + aEff·(F_L / presence)` with `aEff = lateralWeight(u, amount, falloff)·cover_L` unchanged: the two coefficient weights total exactly 1 everywhere, and at presence = 1 it is byte-identical to the shipped `mix(F_S, F_L, aEff)` (HGL-LAW)."
    - "The live compositor applies the same normalized weight through the same shared GLSL snippet, so the live-vs-committed settle keeps its existing p95 <= 1/255 bar (`edgePolishP95`), with `edgeEncodeP95 <= 1` and zero texels over (HGL-PARITY)."
    - "Amount 0 is byte-identical: the `edge-layer-neutral` capture's four export digests equal the committed baseline `baselines/edge-layer-neutral.json` with zero drift, and `--edge-structural` reads layerAllocated false / mergeDraws 0 (HGL-IDENTITY)."
    - "Two identical captures of the canonical recipe compare field-identical in `--other` mode, the wall clock excluded (HGL-DETERMINISM)."
    - "The artist's exact green-over-blue recipe reads clean live and committed — Edge 100 / noise Feather / Pickup 100 and 0 — and is handed over as a live UAT row, never claimed here (HGL-UAT)."
  artifacts:
    - path: packages/efx-watercolor/src/playground/shaders.ts
      provides: "the ONE law: layerPresence / layerFilmWeight in STROKE_LAYER_ALPHA, the occupancy-normalized merge mix, the same normalized mix in displayLayerFS, the presence write in bristleCoverLayerFS (o0 = vec4(target, a, 0.0, a))"
    - path: packages/efx-watercolor/src/playground/Engine.ts
      provides: "layerFilm attachment 0 as HALF_FLOAT_RG (R = cover_L, G = the deposit's union presence) with the 42 B/px docstring; no blend, binding or lifecycle change"
    - path: packages/efx-watercolor/src/playground/shaders.test.ts
      provides: "exact-literal pins of the new law, the presence functions, the attachment write and the display mix; every retired-vocabulary negative kept"
    - path: packages/efx-watercolor/src/playground/coverageLifecycle.test.ts
      provides: "the ensureLayer allocation pin moved to [HALF_FLOAT_RG, HALF_FLOAT_R]"
    - path: packages/efx-watercolor/probe/medium-engine/probe.ts
      provides: "the FEATHER operand on edge-layer, the fringe-dip readout on both axes, the presence readback, the normalized expected-mix kernel and the 6 B/texel film accounting"
    - path: packages/efx-watercolor/probe/medium-engine/run.mjs
      provides: "--feather accepted on the two layer scenes, refused elsewhere; --dry and --release stay bristle-end only"
    - path: packages/efx-watercolor/probe/medium-engine/compare.mjs
      provides: "EDGE_FRINGE_DIP_MAX = 1, the two required readings and the bar in edgeLayerFailures"
    - path: packages/efx-watercolor/probe/medium-engine/harness.test.ts
      provides: "the operand pins, the presence/report pins, the memory fixture at 42 B/px and the dip-bar rejection test"
  key_links:
    - from: packages/efx-watercolor/src/playground/shaders.ts
      to: packages/efx-watercolor/src/playground/Engine.ts
      via: "bristleCoverLayerFS writes G = a into layerFilm attachment 0; layerPresence reads .y in the merge and the display; the (ONE, ONE_MINUS_SRC_ALPHA) blend accumulates the union exactly as it accumulates cover_L in R"
    - from: packages/efx-watercolor/src/playground/shaders.ts
      to: packages/efx-watercolor/src/playground/shaders.test.ts
      via: "the shared STROKE_LAYER_ALPHA snippet is pinned verbatim in the merge, both union passes and displayLayerFS"
    - from: packages/efx-watercolor/probe/medium-engine/compare.mjs
      to: packages/efx-watercolor/probe/medium-engine/probe.ts
      via: "EDGE_LAYER_READINGS names edgeFringeDipPaper / edgeFringeDipUnder; edgeSideReadings emits them from the committed dark profile"
    - from: packages/efx-watercolor/probe/medium-engine/probe.ts
      to: packages/efx-watercolor/src/playground/shaders.ts
      via: "edgeLayerFilmWeight mirrors layerFilmWeight and edgeMixedBands applies the layer side with aEff/presence"
---

<objective>
Remove the subtle pale/white halo at a bristle stroke's Feathered fringe on the per-stroke layer path (Edge transparency > 0), without touching the sheet path, the deposit law or the falloff family.

Purpose: the layer film is stored PREMULTIPLIED by the deposit's own occupancy (the union of every dab's a), while the composite weight is `aEff = lateralWeight·cover_L`. At the fringe `mix(F_S, F_L, aEff)` therefore adds only `aEff·presence` of the layer's colour while subtracting `aEff` of the under — the coefficient weights total `1 - aEff·(1 - presence) < 1`, a film with less absorbance than either side, which reads as a thin light ring. The artist's report (two green strokes over a blue wash, Edge 100, noise Feather, Pickup 100) is this ring, and 261125-kvl's UAT carried it as "no white fringe".

Output: ONE law — normalize the layer film by its occupancy, `film_out = (1 - aEff)·F_S + aEff·(F_L / presence)` — with `presence` stored in a new G lane of layerFilm attachment 0 (RG16F), the merge and the live display carrying the same shared snippet, and a probe bar (`edgeFringeDip* <= 1/255`) that forbids any station lighter than both painted sides. Amount 0 is untouched (no layer, zero drift), and the artist's recipe is handed over as a live UAT row.

Grounded hypothesis, restated once so no task re-derives it: `cover_L` is `1 - prod(1 - a_i·T_i·feather_i)` and the layer ink is `presence · Cbar` with `presence = 1 - prod(1 - a_i)` and `Cbar` the same union-weighted mean colour. Dividing the stored film by `presence` recovers `Cbar` exactly, so the normalized mix is a convex combination of the under's film and the stroke's own colour at every occupancy — the pale ring cannot exist, and at `presence = 1` (the solid core of any Body) the law is identical to the shipped one.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@/Users/lmarques/Dev/efx-motion-editor/.planning/quick/261125-kvl-full-implement-the-per-stroke-translucen/261125-kvl-SUMMARY.md
@/Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/src/playground/shaders.ts
@/Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/src/playground/Engine.ts
@/Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/probe/medium-engine/probe.ts
@/Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/probe/medium-engine/compare.mjs

Gates and recipes used below are the ones the 261125-rtc and 261125-kvl quicks established: the headless probe writes `/tmp/medium-engine/<gate>.json`; captures are always re-run under fresh gate names; the amount-0 identity is `run.mjs --gate edge-layer-neutral --scenario edge-layer --size 2048 --edge 0 --falloff 50` then `compare.mjs edge-layer-neutral` against the committed baseline (digests 82374ed4 / 83f54524 / 8aad7f58 / 8a347e61); determinism is a same-parameter pair through `--other`; the falloff sweep is the only vehicle that runs the amount-keyed bars on one capture (it validates all three operands).
</context>

<tasks>

<revision id="R2" by="orchestrator+user" date="2026-11-26">
**The green-over-blue scene is the acceptance surface; the red-over-blue measurements are VOID.**

The artist's screenshot (2026-11-26) pins the surface: a coherent pale/desaturated rim along the stroke's outer contour (left lateral edge and end-cap tip) — not station noise. This reframes the work:

1. **VOID evidence.** `probe/medium-engine --scenario edge-layer`'s under axis is stroke B `#c2402a` (red) over the `#1d3f7a` (blue) wash. A red-over-blue crossing pales by construction (chroma 16-21 at the fringe vs 37 outside and 76 inside), so Task 2's "no coherent trough" verdict and the occupancy-law refutation are void. **Do NOT revert the occupancy law** on that evidence — it stays until the green-over-blue scene is measured.
2. **The bar's metric (user decision).** Lightness AND chroma. Flag any station that is lighter than BOTH the bare under and the core, or loses chroma versus BOTH — measured against the **bare under** (the unpainted wash), never against the feathered tail. The current band stops at 5 % of peak cover, which excludes exactly the rim; extend it out to the bare under.
3. **Coherence guard (user decision).** Require a coherent run, or score a smoothed profile, so the pickup's 2-station alternation is never the target. An alternating station with no coherent band is texture, not the halo.
4. **The scene to build.** A SHORT stroke with a tip, artist's green over a blue wash, at the artist's exact recipe (brush preset, size, Dry, Feather/noise, Edge transparency, Edge falloff, Pickup, both colours) — pending the user's paste. The current edge-layer scene is a long mid-stroke crossing and cannot stand in.
5. **Leading suspect (candidate, not conclusion).** The raw sheet reference at the fringe: `bristleDepositFS` (:1436-1443) reads the layer's own PREMULTIPLIED film as the pickup reference and falls back to the raw sheet when `prev2 = |prev|^2` is tiny — which is every feathered fringe texel, so the under's texture/paleness enters the edge. Test against the pinned surface before changing it; the presence lane from Task 2 is available if occupancy normalization is the answer.
</revision>

<revision id="R1" by="orchestrator" date="2026-11-26">
**The Task 1 RED floor was re-scoped from the Pickup-0 control arm to the artist's Pickup-100 arm.**

Task 1 is COMPLETE (commit `027a26a6d`); do NOT re-run it. It measured, at Feather 100 / Edge 100 / 2048² (1/255, `edgeFringeDipUnder`):

| pickup | falloff 0 | falloff 50 | falloff 100 |
|---|---|---|---|
| 0 (control) | 0.16 | 0.26 | 1.32 |
| 100 (artist) | **11.23** | **7.73** | **6.89** |

The Pickup-0 control is halo-free by design (its fringe never falls below BOTH painted sides), so the original >= 3/255 floor could never be met there; the artist's actual recipe (Pickup 100) reproduces the halo strongly. The measured RED is therefore `edgeFringeDipUnder >= 3/255 on the Pickup-100 arm` — MET (6.89–11.23). The Pickup-0 arm stays a control: the law must keep it <= 1/255 and must not worsen it.

**Execute Task 2 only.** Its GREEN bars are unchanged: every one of the nine layer captures (six Feather-100 + three record-feather) must read `edgeFringeDipPaper` and `edgeFringeDipUnder` <= 1/255, and the amount-0 identity / determinism / parity / gate bars stand as written.
</revision>

<task type="tracer">
  <name>Task 1: RED — wire --feather to the layer scene and read the fringe dip at the artist's recipe</name>
  <files>packages/efx-watercolor/probe/medium-engine/run.mjs, packages/efx-watercolor/probe/medium-engine/probe.ts, packages/efx-watercolor/probe/medium-engine/harness.test.ts</files>
  <action>
No engine or shader change in this task. Extend the probe's input contract and its report, capture the artist's grid and prove the halo exists before any law moves.

1) run.mjs — widen the Feather acceptance. At :603 change the reader's signature to `const readEndPercent = (flagName, scenes = ['bristle-end']) => {` and replace the refusal body with an allowed-scenes test: `if (!scenes.includes(scenario)) { console.error(`${flagName} is only valid with --scenario ${scenes.join(' or ')}`); process.exit(1) }`. Call `const feather = readEndPercent('--feather', LAYER_SCENES)` (LAYER_SCENES is already `['edge-layer', 'bristle-end']` at :379); leave `const dry = readEndPercent('--dry')` and the release reader bristle-end only. Update the two usage lines (:194 and the :299 usage string) so `--feather` reads as an edge-layer / bristle-end operand. The `&feather=` query append at :661 already exists.

2) probe.ts — read the operand. Next to `EDGE_LAYER_PICKUP` (:2024) add `let EDGE_LAYER_FEATHER: number | null = null` (null keeps the acrylic record's own Feather 85; the artist's 100 is the override). Beside `readEdgePickup` (:2168) add a mirror named `readEdgeFeather(scenario: string): number | null` reading the `feather` query key, valid on `edge-layer` and `bristle-end`, null when absent, an integer 0..100 when present, and refusing any other scenario with `'--feather is only valid with --scenario edge-layer or bristle-end'`. Read it in the operand block after `EDGE_LAYER_PICKUP = readEdgePickup(scenario)` (:7042) as `EDGE_LAYER_FEATHER = readEdgeFeather(scenario)`. In `edgeLayerScript` (:2205) after the pickup fold add `if (EDGE_LAYER_FEATHER !== null) params['feather'] = EDGE_LAYER_FEATHER` — the same canonical bag, so the layer scene can carry the artist's Feather 100 while the record's 85 stays the default. Echo it in `edgeLayerReport` beside `edgePickupControl` (:4146): `edgeFeatherControl: EDGE_LAYER_FEATHER,`.

3) probe.ts — the fringe readout, both axes. Extend `EdgeSideReadings` (:3537) with `readonly fringeDip: number | null` (doc: the light-ring score in 1/255 units, computed from the committed display profile) and add `fringeDip: null` to `EDGE_SIDE_ABSENT` (:3569). Add beside `edgeLayerAEff` (:2477):

const EDGE_FRINGE_COVER_FLOOR = 0.05
const EDGE_FRINGE_GAP = 3
function edgeFringeDip(profile: EdgeProfile): number | null {
  if (profile.cover === null) return null
  const n = profile.offsets.length
  const centre = profile.offsets.indexOf(0)
  if (n < 2 * EDGE_FRINGE_GAP + 5 || centre < 0) return null
  let peak = 0
  for (const value of profile.cover) peak = Math.max(peak, value)
  if (!(peak > 0)) return null
  const floor = peak * EDGE_FRINGE_COVER_FLOOR
  // 3-station box smooth of the committed display darkness: the halo is a
  // STATION-SCALE structure; the row mean already averaged the stroke's width.
  const smooth = new Float64Array(n)
  for (let i = 0; i < n; i += 1) {
    const a = profile.dark[Math.max(0, i - 1)]!
    const b = profile.dark[i]!
    const c = profile.dark[Math.min(n - 1, i + 1)]!
    smooth[i] = (a + b + c) / 3
  }
  let score = 0
  for (const dir of [-1, 1] as const) {
    // The contiguous painted band on this side: from the centre outward while
    // the LAYER's own cover row stays at or above the floor.
    const band: number[] = []
    for (let step = 0; ; step += 1) {
      const i = centre + dir * step
      if (i < 0 || i >= n) break
      if (profile.cover[i]! < floor) break
      band.push(i)
    }
    if (band.length < 2 * EDGE_FRINGE_GAP + 3) continue
    for (let j = EDGE_FRINGE_GAP; j < band.length - EDGE_FRINGE_GAP; j += 1) {
      let innerMax = 0
      for (let t = 0; t <= j - EDGE_FRINGE_GAP; t += 1) innerMax = Math.max(innerMax, smooth[band[t]!]!)
      let outerMax = 0
      for (let t = j + EDGE_FRINGE_GAP; t < band.length; t += 1) outerMax = Math.max(outerMax, smooth[band[t]!]!)
      const v = smooth[band[j]!]!
      score = Math.max(score, Math.min(innerMax - v, outerMax - v))
    }
  }
  return round2(Math.max(0, score) * 255)
}

The score is exactly "a station lighter than the painted stations on BOTH sides of it", with a 3-station gap so a multi-pixel ring cannot hide inside its own plateau: a monotone fade scores 0 on the side that fades to white, and the premultiplied film's pale ring scores its depth against the darker core and the darker under. Compute it in `edgeSideReadings` (the profile is already there) and return it; emit `edgeFringeDipPaper: paperReadings.fringeDip,` and `edgeFringeDipUnder: underReadings.fringeDip,` in `edgeLayerReport` beside the polish block (:4107-4109). Do NOT add the two names to compare.mjs's EDGE_LAYER_READINGS in this task — the bar is registered in Task 2, after the law exists.

4) harness.test.ts — pin the contract in the `describe('the scenario and its operands')` block (:2280-2320): `expectContains(RUN, "const feather = readEndPercent('--feather', LAYER_SCENES)")`, `expectContains(RUN, "const readEndPercent = (flagName, scenes = ['bristle-end']) => {")`, `expectContains(PROBE, 'EDGE_LAYER_FEATHER = readEdgeFeather(scenario)')`, `expectContains(PROBE, "if (EDGE_LAYER_FEATHER !== null) params['feather'] = EDGE_LAYER_FEATHER")`, `expectContains(PROBE, 'edgeFeatherControl: EDGE_LAYER_FEATHER,')`, `expectContains(PROBE, 'edgeFringeDipPaper: paperReadings.fringeDip,')`, `expectContains(PROBE, 'edgeFringeDipUnder: underReadings.fringeDip,')`.

5) Capture the artist's grid at 2048² and prove the RED. Six captures at Edge 100, Feather 100 (`--size 2048 --edge 100 --feather 100`), one per pickup x falloff cell: `--pickup 0 --falloff 0 / 50 / 100` and `--pickup 100 --falloff 0 / 50 / 100`. Then run both falloff sweeps to prove the scene still satisfies its existing bars at the new feather setting. The STOP gate is a node assertion over the six captures: `edgeFeatherControl` is 100 everywhere, both dip readings are numbers everywhere, and the PICKUP-0 arm's `edgeFringeDipUnder` reaches at least 3/255 in at least one falloff (the under profile is the artist's shape — a stroke over a different-colour under; the paper profile fades to white and legitimately scores ~0). If the floor is unmet, STOP and report the readings as the quick's valid outcome: the hypothesis did not reproduce.
  </action>
  <verify>
    <automated>node packages/efx-watercolor/probe/medium-engine/run.mjs --gate hgl-p0-f0 --scenario edge-layer --size 2048 --edge 100 --falloff 0 --pickup 0 --feather 100 && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate hgl-p0-f50 --scenario edge-layer --size 2048 --edge 100 --falloff 50 --pickup 0 --feather 100 && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate hgl-p0-f100 --scenario edge-layer --size 2048 --edge 100 --falloff 100 --pickup 0 --feather 100 && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate hgl-p100-f0 --scenario edge-layer --size 2048 --edge 100 --falloff 0 --pickup 100 --feather 100 && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate hgl-p100-f50 --scenario edge-layer --size 2048 --edge 100 --falloff 50 --pickup 100 --feather 100 && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate hgl-p100-f100 --scenario edge-layer --size 2048 --edge 100 --falloff 100 --pickup 100 --feather 100 && node packages/efx-watercolor/probe/medium-engine/compare.mjs hgl-p0-f0 --falloff-sweep hgl-p0-f50 hgl-p0-f100 && node packages/efx-watercolor/probe/medium-engine/compare.mjs hgl-p100-f0 --falloff-sweep hgl-p100-f50 hgl-p100-f100 && node -e "const fs=require('fs');const cap=(g)=>JSON.parse(fs.readFileSync('/tmp/medium-engine/'+g+'.json','utf8'));const p0=['hgl-p0-f0','hgl-p0-f50','hgl-p0-f100'];const p100=['hgl-p100-f0','hgl-p100-f50','hgl-p100-f100'];let worst=0;for(const g of [...p0,...p100]){const d=cap(g);if(d.edgeFeatherControl!==100)throw new Error(g+' did not record Feather 100 ('+d.edgeFeatherControl+')');if(typeof d.edgeFringeDipPaper!=='number'||typeof d.edgeFringeDipUnder!=='number')throw new Error(g+' lacks the fringe dip readings');console.log(g,'dip paper',d.edgeFringeDipPaper,'| under',d.edgeFringeDipUnder);if(p0.includes(g))worst=Math.max(worst,d.edgeFringeDipUnder);}if(!(worst>=3))throw new Error('RED floor unmet: Pickup-0 Under fringe dip '+worst+' < 3/255 — the halo does not reproduce at Feather 100; record the numbers and STOP');console.log('RED confirmed: Pickup-0 Under fringe dip',worst,'/255')" && pnpm --dir packages/efx-watercolor exec vitest run && pnpm --dir packages/efx-watercolor check</automated>
  </verify>
  <done>The layer scene accepts `--feather 0..100` and echoes it as `edgeFeatherControl`; `--dry` / `--release` remain bristle-end only and other scenarios refuse `--feather`; six 2048² captures at Feather 100 exist; both falloff sweeps pass every pre-existing layer bar at the new feather setting (the sweep also validates each capture's amount-keyed invariant); each capture reports `edgeFringeDipPaper` and `edgeFringeDipUnder`, and the Pickup-0 arm reads an Under dip of at least 3/255 (the restored halo); the six dip numbers are recorded for the SUMMARY; package suite and typecheck green. No engine, shader or feed value changed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: The ONE law — occupancy-normalized layer film in the merge and the live display, the presence lane and the fringe bar</name>
  <files>packages/efx-watercolor/src/playground/shaders.ts, packages/efx-watercolor/src/playground/shaders.test.ts, packages/efx-watercolor/src/playground/Engine.ts, packages/efx-watercolor/src/playground/coverageLifecycle.test.ts, packages/efx-watercolor/probe/medium-engine/probe.ts, packages/efx-watercolor/probe/medium-engine/compare.mjs, packages/efx-watercolor/probe/medium-engine/harness.test.ts</files>
  <behavior>
    - "Shared snippet: STROKE_LAYER_ALPHA declares `float layerPresence(vec2 uv)` returning `clamp(texture(uCoverL, uv).y, 0.0, 1.0)` and `float layerFilmWeight(vec2 uv)` returning `layerAEff(uv) / max(layerPresence(uv), 1e-4)`; the merge, both union passes and displayLayerFS carry the snippet verbatim; the cover pass carries neither (it must not read the falloff)."
    - "Merge: `float wl = layerFilmWeight(uv);` and `oA = (inkA + fixedA) * (1.0 - aEff) + layerA * wl - fixedA;` with the B vec4 analog and the S floor; the two exact endpoints and both union passes are unchanged."
    - "Display: `float layerPresence = max(texture(uLayerCover, uv).y, 1e-4); float layerW = layerAeff / layerPresence;` then the three coefficient lines `x = x * (1.0 - layerAeff) + layerX * layerW`; reliefAt and coverRead still use layerAeff; ONE reconstruction; the shipped displayFS carries no layer needle."
    - "Attachment write: bristleCoverLayerFS emits `o0 = vec4(target, a, 0.0, a);`; the clear pass already zeroes the G lane; the existing per-attachment blend accumulates G exactly as it accumulates R."
    - "Probe: presence is read from attachment 0's G lane; edgeLayerFilmWeight mirrors the shader; edgeMixedBands applies the sheet side with aEff and the layer side with aEff/presence; the continuity envelope and the recovered mid alpha use the NORMALIZED layer bands, the core-exact identity keeps the RAW endpoint write."
  </behavior>
  <action>
One law, one commit. No parameter-law retry, no second tuning knob: the only new quantity is the occupancy already implied by the storage.

1) Engine.ts (:1004) — `this.layerFilm = g.target(this.dw, this.dh, [HALF_FLOAT_RG, HALF_FLOAT_R], gl.NEAREST);`. HALF_FLOAT_RG is already declared at :408 and proven renderable by the velocity target (:873). Update the ensureLayer docstring (:993-994) from "40 B/px: the two RGBA16F ink halves 32, the film 4, the two R16F reliefs 2 + 2" to "42 B/px: the two RGBA16F ink halves 32, the film 6 (RG16F 4 + R16F 2), the two R16F reliefs 2 + 2", and the attachment-0 comment (:1000-1003): R = cover_L, G = the deposit's union presence (the same blend accumulates it), attachment 1 stays the MIN lateral field. Do NOT touch the amount-0/brush predicate, bristleLayerInk's two deposit draws, the per-attachment blend state, the fallback two-draw path or mergeStrokeLayer's bindings.

2) shaders.ts — the presence write. In `bristleCoverLayerFS` (:1711) replace `o0 = vec4(target, 0.0, 0.0, a);` with `o0 = vec4(target, a, 0.0, a);` and extend the doc block (:1662-1676): attachment 0 is now `R = cover_L` (the shipped cover lerp's payload) and `G = the union presence`, the (ONE, ONE_MINUS_SRC_ALPHA) blend accumulating both across the stroke's dabs; `.a` stays `a` because the fallback's blendFunc reads SRC_ALPHA from it. The sheet's `bristleCoverFS` (:1513), `bristleDepositFS` and `bristleCoverLayerFS`'s guard/lateral write are untouched.

3) shaders.ts — the shared law. Extend `STROKE_LAYER_ALPHA` (:1640-1647) after `layerAEff` with exactly:

float layerPresence(vec2 uv){
  return clamp(texture(uCoverL, uv).y, 0.0, 1.0);
}
float layerFilmWeight(vec2 uv){
  return layerAEff(uv) / max(layerPresence(uv), 1e-4);
}

and update the snippet's doc (:1634-1639): the layer film is stored premultiplied by its occupancy, so the colour weight is `aEff / presence`; the weight is bounded by `layerAEff <= cover_L <= presence`, and the `1e-4` floor only guards the empty texel.

4) shaders.ts — the merge (:1773-1780). Replace the two mix lines with the occupancy-normalized convex mix (keep the endpoint branches above unchanged):

  // The film is OCCUPANCY-NORMALIZED (261126-hgl): the layer's storage is
  // premultiplied by the deposit's own union presence, so the weight on the
  // layer's COLOUR is aEff / presence and the two weights total exactly 1.
  // The premultiplied form let the under leak at partial occupancy by
  // aEff·(1 - presence) of the under's film — a pale ring, lighter than the
  // paint on both sides of it.
  float wl = layerFilmWeight(uv);
  oA = (inkA + fixedA) * (1.0 - aEff) + layerA * wl - fixedA;
  oB = vec4(
    (inkB.rgb + fixedB.rgb) * (1.0 - aEff) + layerB.rgb * wl - fixedB.rgb,
    max((inkB.a + fixedB.a) * (1.0 - aEff) + layerB.a * wl - fixedB.a, 0.0));

The endpoints (`aEff >= 1 - 1e-4` writes `layerA - fixedA`; `aEff <= 1e-4` copies the sheet ink) and both union passes (`strokeLayerCoverFS`, `strokeLayerReliefFS`, :1784-1803) stay byte-identical on layerAEff.

5) shaders.ts — the live display block in `displaySource(layer)` (:2204-2210). After the `layerAeff` assignment, replace the three mixes with:

      // The SAME occupancy normalization the merge commits (261126-hgl): the
      // colour weight is aEff / presence, so the live surface is what the
      // stroke end will store. The two weights total 1.
      float layerPresence = max(texture(uLayerCover, uv).y, 1e-4);
      float layerW = layerAeff / layerPresence;
      a = a * (1.0 - layerAeff) + layerInk * layerW;
      b = b * (1.0 - layerAeff) + layerBands * layerW;
      scatter = scatter * (1.0 - layerAeff) + layerScatter * layerW;

Update the block's doc (:2166-2183) to name the normalized mix as the one law. `reliefAt` (:2218-2221), `coverRead` (:2224-2226), the `${layer ? LATERAL_WEIGHT : ''}` emission, the shipped `displayFS`, the k-scaling order (`a *= k; b *= k; scatter *= k;` at :2323 before `${layerMix}`) and the layer's own k-scaling (:2201-2203) are untouched.

6) shaders.test.ts — update the stroke-layer pins (:126-247). Merge: replace the two old mix pins with `pin('float wl = layerFilmWeight(uv);')`, `pin('oA = (inkA + fixedA) * (1.0 - aEff) + layerA * wl - fixedA;')`, `pin('(inkB.rgb + fixedB.rgb) * (1.0 - aEff) + layerB.rgb * wl - fixedB.rgb,')`, `pin('max((inkB.a + fixedB.a) * (1.0 - aEff) + layerB.a * wl - fixedB.a, 0.0));')`; keep every endpoint pin verbatim. Shared snippet: add `pin('float layerPresence(vec2 uv){')`, `pin('return clamp(texture(uCoverL, uv).y, 0.0, 1.0);')`, `pin('float layerFilmWeight(vec2 uv){')`, `pin('return layerAEff(uv) / max(layerPresence(uv), 1e-4);')` in the merge/cover/relief loop. Layers' film writes: replace `pin('o0 = vec4(target, 0.0, 0.0, a);')` with `pin('o0 = vec4(target, a, 0.0, a);')`. Display: replace the three mix pins with `pin('float layerPresence = max(texture(uLayerCover, uv).y, 1e-4);')`, `pin('float layerW = layerAeff / layerPresence;')`, `pin('a = a * (1.0 - layerAeff) + layerInk * layerW;')`, `pin('b = b * (1.0 - layerAeff) + layerBands * layerW;')`, `pin('scatter = scatter * (1.0 - layerAeff) + layerScatter * layerW;')`; move the ordering anchor from `mixAt` to `displayLayerFS.indexOf('a = a * (1.0 - layerAeff) + layerInk * layerW;')`. Keep the retired-vocabulary negatives, the ONE-basis count, the shared-snippet-inclusion checks and the "shipped displayFS carries no layer" negatives unchanged.

7) coverageLifecycle.test.ts (:583) — the ensureLayer pin becomes `expectContains(ensure, 'this.layerFilm = g.target(this.dw, this.dh, [HALF_FLOAT_RG, HALF_FLOAT_R], gl.NEAREST);')`.

8) probe.ts — read the presence and normalize the expectation kernel. (a) `EdgeLayerFields` (:2315-2323) gains `presence` (doc: layerFilm attachment 0's G lane — the union occupancy of the deposit) and `cover`'s doc stays R. (b) `readEdgeLayerFields` (:2416-2435): read attachment 0 ONCE with 4 channels, `const film0 = read(film.views[0]!, 4)`, derive `cover[i] = film0[i * 4]!` and `presence[i] = film0[i * 4 + 1]!` into two Float32Arrays, and return them beside `lateral: read(film.views[1]!, 1)`, the two ink halves and relief. (c) Beside `edgeLayerAEff` (:2477) add `function edgeLayerFilmWeight(lateral: number, coverL: number, presence: number): number { const aEff = edgeLayerAEff(lateral, coverL); return aEff / Math.max(presence, 1e-4) }` with a doc mirroring the shader. (d) `edgeMixedBands` (:3043-3060) gains a final parameter `layerWeight = weight` and mixes the layer side with it: `a[c] = sheetA[o + c]! * (1 - weight) + layerA[o + c]! * layerWeight` (b likewise), its doc updated: the sheet side keeps aEff, the layer side is aEff/presence. (e) Add beside `edgeTexelBands` (:3022) `function edgeScaledBands(a: Float32Array, b: Float32Array, i: number, k: number, scale: number): Float64Array` building the 4+4 coefficients multiplied by `scale` and decoding through `edgeTexelBands` — the NORMALIZED layer film's display bands. (f) `edgeSideReadings` (:3751-3799): per texel compute `const bands_l_raw = edgeTexelBands(layer.a, layer.b, fi, k[fi]!)`, `const filmWeight = edgeLayerFilmWeight(layer.lateral[fi]!, c, layer.presence[fi]!)`, `const bands_l = edgeScaledBands(layer.a, layer.b, fi, k[fi]!, filmWeight)`; the continuity envelope's envL, the recovered mid alpha and the max-Aeff debug stay on the frozen aEff, and `coreExact` compares the committed bytes against `bands_l_raw` (the endpoint writes the raw storage — its doc's identity is unchanged). (g) `edgeEncodeResidual` (:3898-3901 and the polish loop :3934): compute `const filmWeight = edgeLayerFilmWeight(layer.lateral[fi]!, layer.cover[fi]!, layer.presence[fi]!)` beside `mixWeight` and pass it as the new argument of both `edgeMixedBands` calls; the debug buckets stay keyed on `mixWeight`. (h) Film byte accounting (:4284-4293, :4412): replace `EDGE_LAYER_FILM_STRIDE = 2` with `const EDGE_LAYER_FILM_BYTES_PER_TEXEL = 6` (RG16F 4 + R16F 2), compute `const filmBytes = it.layerFilm ? it.layerFilm.w * it.layerFilm.h * EDGE_LAYER_FILM_BYTES_PER_TEXEL : 0`, and update the comment: the film is two textures of 4 and 2 B/texel so the uniform `edgeTargetBytes` stride cannot express it.

9) compare.mjs — register the bar. Add `const EDGE_FRINGE_DIP_MAX = 1` beside `EDGE_POLISH_P95` (:1296, with a comment: the fringe's light-ring score in 1/255 units — a station lighter than the painted stations on BOTH sides of it; 261126-hgl). Add `'edgeFringeDipPaper'` and `'edgeFringeDipUnder'` to `EDGE_LAYER_READINGS` (:1324-1365, with a 261126-hgl comment). In `edgeLayerFailures`, after the polish block (:1685-1695), bar both sides:

  for (const side of ['Paper', 'Under']) {
    const field = `edgeFringeDip${side}`
    const value = data[field]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      failures.push(`${field} ${JSON.stringify(value)} is not a non-negative 1/255 reading`)
    } else if (value > EDGE_FRINGE_DIP_MAX) {
      failures.push(
        `${field} ${value}/255 exceeds ${EDGE_FRINGE_DIP_MAX}/255 — a light ring at the fringe: ` +
          'a station inside the painted band is lighter than the painted stations on BOTH sides of it',
      )
    }
  }

Also print the pair in `printDurations` beside the polish line (:2374-2379). Do NOT add any field to `FIELDS` (:156) — the committed amount-0 baseline must stay comparable.

10) harness.test.ts — fixtures and pins. In `validEdgeLayerCapture`'s base object (:2140-2205) add `edgeFringeDipPaper: layer ? 0 : null,` and `edgeFringeDipUnder: layer ? 0 : null,`; in the memory fixture (:2211-2223) move the film to 42 B/px: `layerFilm: layer ? 2048 * 2048 * 6 : 0`, `edgeMemoryLayerBytes: layer ? 2048 * 2048 * 42 : 0`, `edgeMemoryPerTexel: layer ? 42 : 0`, and the MiB rows to the probe's own round2 readings (168 at 2048², the clamped/4K rows from the same per-texel value), updating the 40 B/px docstring to 42. Add a rejection test beside the studio-memory one (:2690-2700): a capture `{ ...validEdgeLayerCapture(100, 50), edgeFringeDipUnder: 2 }` must be rejected with an invariant line naming `edgeFringeDipUnder`; a base capture still passes. Add source pins: `expectContains(COMPARE, 'const EDGE_FRINGE_DIP_MAX = 1')`, `expectContains(COMPARE, "'edgeFringeDipPaper',")`, `expectContains(COMPARE, "'edgeFringeDipUnder',")`, `expectContains(PROBE, 'const EDGE_LAYER_FILM_BYTES_PER_TEXEL = 6')`, `expectContains(PROBE, 'const film0 = read(film.views[0]!, 4)')`, `expectContains(PROBE, 'function edgeLayerFilmWeight(lateral: number, coverL: number, presence: number): number {')`, `expectContains(PROBE, 'layerA[o + c]! * layerWeight')`.

11) Re-capture and prove GREEN. The artist's grid at Feather 100 (the six Task 1 gate names, re-run), the canonical record-feather cell at falloff 0/50/100 (no `--feather`: `hgl-default-f0`, `hgl-default`, `hgl-default-f100` at Edge 100, default pickup), a second `hgl-default-r2` for determinism, and the amount-0 identity capture `edge-layer-neutral` (Edge 0, falloff 50, no feather). Every amount>0 capture must pass its amount-keyed bars through the sweeps; the record asserts `edgeFringeDipPaper` / `edgeFringeDipUnder` <= 1 on all nine layer captures, all four digests equal the committed baseline with zero drift at amount 0, and the `--other` pair field-identical. Record every number for the SUMMARY: the six artist dips, the canonical dips, the encode/polish/continuity/core/midAlpha/cover rows, the digests, the memory row (42 B/px) and the merge timings.
  </action>
  <verify>
    <automated>node packages/efx-watercolor/probe/medium-engine/run.mjs --gate hgl-p0-f0 --scenario edge-layer --size 2048 --edge 100 --falloff 0 --pickup 0 --feather 100 && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate hgl-p0-f50 --scenario edge-layer --size 2048 --edge 100 --falloff 50 --pickup 0 --feather 100 && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate hgl-p0-f100 --scenario edge-layer --size 2048 --edge 100 --falloff 100 --pickup 0 --feather 100 && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate hgl-p100-f0 --scenario edge-layer --size 2048 --edge 100 --falloff 0 --pickup 100 --feather 100 && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate hgl-p100-f50 --scenario edge-layer --size 2048 --edge 100 --falloff 50 --pickup 100 --feather 100 && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate hgl-p100-f100 --scenario edge-layer --size 2048 --edge 100 --falloff 100 --pickup 100 --feather 100 && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate hgl-default-f0 --scenario edge-layer --size 2048 --edge 100 --falloff 0 && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate hgl-default --scenario edge-layer --size 2048 --edge 100 --falloff 50 && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate hgl-default-f100 --scenario edge-layer --size 2048 --edge 100 --falloff 100 && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate hgl-default-r2 --scenario edge-layer --size 2048 --edge 100 --falloff 50 && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate edge-layer-neutral --scenario edge-layer --size 2048 --edge 0 --falloff 50 && node packages/efx-watercolor/probe/medium-engine/compare.mjs hgl-p0-f0 --falloff-sweep hgl-p0-f50 hgl-p0-f100 && node packages/efx-watercolor/probe/medium-engine/compare.mjs hgl-p100-f0 --falloff-sweep hgl-p100-f50 hgl-p100-f100 && node packages/efx-watercolor/probe/medium-engine/compare.mjs hgl-default-f0 --falloff-sweep hgl-default hgl-default-f100 && node packages/efx-watercolor/probe/medium-engine/compare.mjs hgl-default --other hgl-default-r2 && node packages/efx-watercolor/probe/medium-engine/compare.mjs edge-layer-neutral --edge-structural && node packages/efx-watercolor/probe/medium-engine/compare.mjs edge-layer-neutral && node -e "const fs=require('fs');const cap=(g)=>JSON.parse(fs.readFileSync('/tmp/medium-engine/'+g+'.json','utf8'));const layer=['hgl-p0-f0','hgl-p0-f50','hgl-p0-f100','hgl-p100-f0','hgl-p100-f50','hgl-p100-f100','hgl-default-f0','hgl-default','hgl-default-f100'];let over=0;for(const g of layer){const d=cap(g);for(const f of ['edgeFringeDipPaper','edgeFringeDipUnder']){const v=d[f];if(typeof v!=='number')throw new Error(g+' lacks '+f);if(v>1){over+=1;console.error(g,f,v,'> 1/255')}else{console.log(g,f,v,'/255')}}}if(over>0)throw new Error(over+' fringe-dip reading(s) over 1/255 — the ring survives the law');console.log('fringe dip within 1/255 on all nine captures')" && pnpm --dir packages/efx-watercolor exec vitest run && pnpm --dir packages/efx-watercolor check && pnpm --dir app exec vitest run && pnpm --dir app exec tsc --noEmit</automated>
  </verify>
  <done>The merge and displayLayerFS carry the occupancy-normalized mix through the one shared snippet; layerFilm attachment 0 is RG16F with R = cover_L and G = the union presence, written by the cover pass and read by both composite programs; legacy `presence = 1` texels are byte-identical to the shipped law; at the artist's recipe the fringe dip is at most 1/255 on both axes at falloff 0/50/100 on both pickup arms AND at the record feather; the existing bars (encode max 2 / p95 1 / over 0, polish p95 1, continuity 0, coreExact, midAlpha with the strict broad < linear < rim ordering, cover rows within 1/255, lateral saturation, solid band) all pass on every swept capture; amount 0 is byte-identical (four digests equal, zero drift) and structurally bypassed; the determinism pair is field-identical; the film is accounted at 42 B/px; the package suite, package typecheck, app suite and app typecheck are green; all numbers are recorded for the SUMMARY. No change to the sheet path, the one deposit law, the falloff family, the end-density envelope, the cap close-out, the pickup laws or any UI.</done>
</task>

<task type="tracer">
  <name>Task 3: RED — the artist's exact surface: a short Gouache stroke on the blue wash, the coherent-rim readout, and the controls</name>
  <files>packages/efx-watercolor/probe/medium-engine/probe.ts, packages/efx-watercolor/probe/medium-engine/run.mjs, packages/efx-watercolor/probe/medium-engine/compare.mjs, packages/efx-watercolor/probe/medium-engine/harness.test.ts</files>
  <action>
Measurement only. **The Task 2 occupancy law stays exactly as committed — do NOT revert it, do NOT extend it.** No engine or shader change in this task. The red-over-blue `edge-layer` scene cannot judge the halo (a red-over-blue crossing pales by construction), so measure the artist's actual pair.

**THE RECIPE (user-pasted 2026-11-26 — exact; do not substitute):**

| | background wash | foreground stroke |
|---|---|---|
| brush | `bristle-round` (UI name Gouache) | `bristle-round` (Gouache) |
| colour | `#1469e8` | `#f9e01c` |
| size | 272 | 100 |
| Pigment (`load`) | 100 | 100 |
| Pickup | 100 | 100, plus the 0 control |
| Dry speed (`dry`) | 0 | 0 |
| Feather | 100 | 100 |
| Edge transparency (`edgeFade`) | 0 | 100, plus the 0 control |
| Edge falloff (`edgeFalloff`) | 50 | 100, swept 0 / 50 / 100 |

Build both bags from `bristleLineParams(100, size, { dry: 0, feather: 100, edge, falloff, pickup })` and set `load: 100` explicitly on both. The wash is a sheet-path stroke (edge 0); the foreground is the layer stroke. The foreground is a SHORT stroke with a tip, drawn down-and-right inside the wash (~250 px path, smaller than the wash) — the screenshot's surface, not a long crossing.

1) **Scenario `edge-rim`** (new; keep `edge-layer` and `bristle-end` untouched): paint the wash, then the foreground, both through the existing script path. Register it in the scenario whitelist, give it the layer operands only (`--pickup`, `--falloff`, `--feather`, `--edge`; defaults 100 / 100 / 100 / 100) and refuse them elsewhere. `--edge 0` is the sheet-path control (Engine's amount-0 branch, no layer allocated).

2) **Rim readout — both axes, both surfaces.** Two profiles: LATERAL across the foreground's mid-length, and TIP along its axis past the end cap (the screenshot's two arrows). Per station emit the committed display row-mean `dark` and `chroma` (`max(rgb) − min(rgb)`), the layer's own `cover`, and the same pair measured on the LIVE composite (`edgePolish`'s live render, read the same way). References: **bare under** = the wash's display sampled where the foreground's cover is ~0 on the same axis; **core** = the foreground's most-painted station. Metric, emitted per axis per surface:
   - `rimLight = max over coherent runs of (bareUnderDark − stationDark) × 255` (a station lighter than the bare under — the stroke is darker than the wash, so "lighter than both" is "lighter than the bare under")
   - `rimChroma = max over coherent runs of (min(bareUnderChroma, coreChroma) − stationChroma) × 255` (a station less chromatic than both)
   - **coherence guard:** 5-station box-smooth the profile, then require a run of >= 2 consecutive stations over the threshold. A lone alternating station is texture (the pickup mosaic), never the target. Emit the winning station, its run length, and both reference levels so the SUMMARY can show the band.
   - Emit `edgeRimLight{lateral,tip}{Committed,Live}`, `edgeRimChroma{...}`, `edgeRimBand{...}` (station/run/references). `null` when the axis cannot be judged — never a fabricated zero.

3) **Retire the void bar.** In `compare.mjs` remove `EDGE_FRINGE_DIP_MAX` and its two failure lines from `edgeLayerFailures`; keep `edgeFringeDipPaper/Under` emitted as DIAGNOSTICS only, with a comment that the red-over-blue `edge-layer` scene pales by construction and cannot judge the halo. Update `harness.test.ts` pins accordingly (the dip-bar rejection test becomes a "diagnostic, never a failure" pin). Do NOT add the new rim bar in this task — Task 4 registers it once the law exists.

4) **Captures (2048²):** `--scenario edge-rim --pickup 100 --falloff 0 | 50 | 100` (feather 100, edge 100), `--pickup 0 --falloff 100`, and the sheet-path control `--edge 0 --pickup 100 --falloff 100`. Echo `edgePickupControl`, `edgeFeatherControl`, `edgeAmount`, `edgeFalloff` on every capture so a stale file fails by name.

5) **STOP gate (RED):** the layer path must show a coherent rim — `rimLight >= 3/255` OR `rimChroma >= 3/255`, on at least one axis and at least one surface (committed or live) — AND the `--edge 0` sheet-path control must read `<= 1/255` on every rim field. If the layer path does not reproduce a coherent rim, STOP and report all numbers as the quick's valid outcome (the probe scene does not carry the artist's surface).
  </action>
  <verify>
    <automated>node packages/efx-watercolor/probe/medium-engine/run.mjs --gate rim-p100-f0 --scenario edge-rim --size 2048 --pickup 100 --falloff 0 &amp;&amp; node packages/efx-watercolor/probe/medium-engine/run.mjs --gate rim-p100-f50 --scenario edge-rim --size 2048 --pickup 100 --falloff 50 &amp;&amp; node packages/efx-watercolor/probe/medium-engine/run.mjs --gate rim-p100-f100 --scenario edge-rim --size 2048 --pickup 100 --falloff 100 &amp;&amp; node packages/efx-watercolor/probe/medium-engine/run.mjs --gate rim-p0-f100 --scenario edge-rim --size 2048 --pickup 0 --falloff 100 &amp;&amp; node packages/efx-watercolor/probe/medium-engine/run.mjs --gate rim-edge0 --scenario edge-rim --size 2048 --edge 0 --pickup 100 --falloff 100 &amp;&amp; node -e "const fs=require('fs');const cap=(g)=>JSON.parse(fs.readFileSync('/tmp/medium-engine/'+g+'.json','utf8'));const layer=['rim-p100-f0','rim-p100-f50','rim-p100-f100','rim-p0-f100'];const fields=['edgeRimLightLateralCommitted','edgeRimLightTipCommitted','edgeRimChromaLateralCommitted','edgeRimChromaTipCommitted','edgeRimLightLateralLive','edgeRimLightTipLive','edgeRimChromaLateralLive','edgeRimChromaTipLive'];let best=0;for(const g of layer){const d=cap(g);if(d.edgePickupControl===undefined)throw new Error(g+' lacks the control echo');for(const f of fields){const v=d[f];if(typeof v==='number'&&v>best){best=v;console.log('RIM',g,f,v+'/255')}}}for(const f of fields){const d=cap('rim-edge0');const v=d[f];if(typeof v==='number'&&v>1)throw new Error('sheet-path control reads '+v+'/255 on '+f+' — the rim is not layer-specific')}if(!(best>=3))throw new Error('RED floor unmet: the artist pair shows no coherent rim (max '+best+'/255); report the numbers and STOP');console.log('RED confirmed: coherent rim',best,'/255 on the artist pair; edge-0 control <= 1/255')" &amp;&amp; pnpm --dir packages/efx-watercolor exec vitest run &amp;&amp; pnpm --dir packages/efx-watercolor check</automated>
  </verify>
  <done>`edge-rim` reproduces the artist's exact two-brush recipe (blue #1469e8 wash 272 px, edge 0 / falloff 50; yellow #f9e01c 100 px, feather 100, dry 0, pigment 100) with pickup and falloff operands; both rim profiles (lateral + tip) are measured on the committed AND live surfaces as `dark` + `chroma`, against the bare under and the core, with the 5-station coherence guard and >= 2-station runs; the five captures exist and echo their operands; the layer path shows a coherent rim >= 3/255 on at least one axis/surface and the `--edge 0` sheet-path control reads <= 1/255 on every rim field; the void red-over-blue dip bar is retired to a diagnostic; package suite and typecheck green; every number is recorded for the SUMMARY. No engine, shader, comparator bar or app change.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: The ONE law — the layer's pickup reference is its own occupancy-normalized film, and the rim bar is sheet-path parity</name>
  <files>packages/efx-watercolor/src/playground/shaders.ts, packages/efx-watercolor/src/playground/Engine.ts, packages/efx-watercolor/src/playground/shaders.test.ts, packages/efx-watercolor/probe/medium-engine/probe.ts, packages/efx-watercolor/probe/medium-engine/compare.mjs, packages/efx-watercolor/probe/medium-engine/harness.test.ts</files>
  <behavior>
    - "The layer's pickup reference is the layer's own film DIVIDED BY ITS OWN OCCUPANCY: `prevA / max(prevPresence, 1e-4)` and `prevB.xyz / max(prevPresence, 1e-4)`, where `prevPresence` is the 5-tap average of layerFilm attachment 0's G lane (the same ±1.5 px kernel as prevA/prevB). At presence = 1 this is byte-identical to the shipped reference."
    - "The sheet fallback is gated on the layer's LANDED presence, not on the film's absorbance magnitude: `prevW = smoothstep(1e-6, 1e-3, prevPresence)`. Where the layer has landed (any presence) the reference is its own normalized colour; the raw sheet enters only where the layer is truly empty (first contact)."
    - "Nothing outside `if (uSmearSmooth > 0.5)` inside `bristleDepositFS`'s `if (uSmear > 0.0)` branch changes. The sheet path (uSmearSmooth = 0) and the carrier's own pickup are untouched; `snapB.a` stays the SHEET's (the wet/solid gate)."
    - "The rim bar is sheet-path parity: per axis and surface, the layer arm's rimLight and rimChroma are <= the SAME recipe's `--edge 0` control + 1/255. The control is the artist's accepted Amount-0 surface, not a zero-rim one (yellow-over-blue crosses through a pale KM band by construction: 3.41 lateral / 8.98 tip light at falloff 100)."
  </behavior>
  <action>
**Re-scope of the Task 3 STOP gate (documented, not a manufactured RED).** The artist judges Amount 0 clean, so the sheet path is the accepted BASELINE. The control's residual (light 3.41 lateral / 8.98 tip; chroma 9.93 / 21.70 at falloff 100) is the colour pair's own crossing, not the halo. The pre-fix RED is real and layer-specific: at falloff 100 the layer reads 10.58 lateral / 46.68 tip light against the control's 3.41 / 8.98, and 60.36 lateral at falloff 0; the lateral light rim is pickup-dependent (2.06 at pickup 0 vs 10.58 at pickup 100). Record this in the SUMMARY.

1) **shaders.ts — the law.** In `bristleDepositFS`, inside `if (uSmearSmooth > 0.5)`: declare `uniform sampler2D uPrevPresence;` beside `uPrevA`/`uPrevB` (:986-992); take the same 5 taps at the same `po` offsets on `.y`; then:
```
float prevPresence = 0.2 * (texture(uPrevPresence, vUv).y + 4 taps);
float prevDen = max(prevPresence, 1e-4);
vec4 prevA = (0.2 * (5 taps of uPrevA)) / prevDen;
vec4 prevB = (0.2 * (5 taps of uPrevB)) / prevDen;
float prevW = smoothstep(1e-6, 1e-3, prevPresence);
snapA = mix(snapA, prevA, prevW);
snapB = vec4(mix(snapB.xyz, prevB.xyz, prevW), snapB.a);
```
Delete `prev2` (the absorbance-magnitude gate) and the old un-normalized 5-tap block. Update the block's doc: the layer film is stored premultiplied by its union presence, so the REFERENCE is normalized by that presence; where the layer has landed the reference is the stroke's own colour at every occupancy, so the smear cannot drag the carried pigment toward a diluted film; the raw sheet enters only at first contact, never at the feathered fringe.

2) **Engine.ts — bind the presence lane.** In `bristleLayerInk`, bind `layerFilm.tex[0]` (RG16F, `.y` = presence) to the deposit program's `uPrevPresence` beside the existing `uPrevA`/`uPrevB` binds (:4262-4263). No sheet-path bind, no blend, binding or lifecycle change; `uPrevPresence` is null on any program that does not declare it.

3) **shaders.test.ts — pins.** Pin the normalized reference (`float prevPresence = 0.2 * (texture(uPrevPresence, vUv).y`), the divide (`vec4 prevA = (0.2 * ...) / prevDen;` — pin the exact final lines), the presence gate (`float prevW = smoothstep(1e-6, 1e-3, prevPresence);`), and the absence of `prev2` in the layer branch. Keep every retired-vocabulary negative and the sheet-path pins unchanged. coverageLifecycle's allocation pin is unchanged (the G lane already exists from Task 2).

4) **compare.mjs — the rim bar.** Add `EDGE_RIM_PARITY_MAX = 1` and, on `edge-rim` captures only, bar per axis (`Lateral`, `Tip`) and surface (`Committed`, `Live`): `edgeRimLight*` and `edgeRimChroma*` <= the same-recipe `--edge 0` control's same field + 1/255. The control capture must carry its recipe echoes; a missing/mismatched control fails by name. Keep the retired dip readings as diagnostics. Print each layer/control pair.

5) **Captures.** Every falloff needs its own baseline: `--pickup 100 --falloff 0|50|100` (layer) and `--edge 0 --pickup 100 --falloff 0|50|100` (controls), plus `--pickup 0 --falloff 100`; then amount-0 identity (`edge-layer-neutral`, four digests 82374ed4 / 83f54524 / 8aad7f58 / 8a347e61, zero drift) and a determinism pair. Prove every layer arm within parity +1/255 on both axes and both surfaces, the pre-existing `edge-layer`/`bristle-end` bars still green, and the four gates.

Keep: the Task 2 occupancy law (do not revert), the presence G lane, the sheet path, the one deposit law, the falloff family, the end-density envelope, cap close-out e58497d3b, pickup laws 539160b0b/9f8c0fe4a, every UI surface. No stroke replay.
  </action>
  <verify>
    <automated>node packages/efx-watercolor/probe/medium-engine/run.mjs --gate rim2-p100-f0 --scenario edge-rim --size 2048 --pickup 100 --falloff 0 &amp;&amp; node packages/efx-watercolor/probe/medium-engine/run.mjs --gate rim2-ctl-f0 --scenario edge-rim --size 2048 --edge 0 --pickup 100 --falloff 0 &amp;&amp; node packages/efx-watercolor/probe/medium-engine/run.mjs --gate rim2-p100-f50 --scenario edge-rim --size 2048 --pickup 100 --falloff 50 &amp;&amp; node packages/efx-watercolor/probe/medium-engine/run.mjs --gate rim2-ctl-f50 --scenario edge-rim --size 2048 --edge 0 --pickup 100 --falloff 50 &amp;&amp; node packages/efx-watercolor/probe/medium-engine/run.mjs --gate rim2-p100-f100 --scenario edge-rim --size 2048 --pickup 100 --falloff 100 &amp;&amp; node packages/efx-watercolor/probe/medium-engine/run.mjs --gate rim2-ctl-f100 --scenario edge-rim --size 2048 --edge 0 --pickup 100 --falloff 100 &amp;&amp; node packages/efx-watercolor/probe/medium-engine/run.mjs --gate rim2-p0-f100 --scenario edge-rim --size 2048 --pickup 0 --falloff 100 &amp;&amp; node packages/efx-watercolor/probe/medium-engine/compare.mjs rim2-p100-f0 &amp;&amp; node packages/efx-watercolor/probe/medium-engine/compare.mjs rim2-p100-f50 &amp;&amp; node packages/efx-watercolor/probe/medium-engine/compare.mjs rim2-p100-f100 &amp;&amp; node packages/efx-watercolor/probe/medium-engine/compare.mjs rim2-p0-f100 &amp;&amp; node packages/efx-watercolor/probe/medium-engine/run.mjs --gate edge-layer-neutral --scenario edge-layer --size 2048 --edge 0 --falloff 50 &amp;&amp; node packages/efx-watercolor/probe/medium-engine/compare.mjs edge-layer-neutral --edge-structural &amp;&amp; node packages/efx-watercolor/probe/medium-engine/compare.mjs edge-layer-neutral &amp;&amp; pnpm --dir packages/efx-watercolor build &amp;&amp; pnpm --dir packages/efx-watercolor exec vitest run &amp;&amp; pnpm --dir packages/efx-watercolor check &amp;&amp; pnpm --dir app exec vitest run &amp;&amp; pnpm --dir app exec tsc --noEmit</automated>
  </verify>
  <done>The pickup reference is the layer's own occupancy-normalized film with the sheet fallback gated on landed presence; presence = 1 is byte-identical to the shipped reference; the sheet path and the carrier are untouched; each layer rim arm is within +1/255 of its same-recipe sheet control on both axes and both surfaces at falloff 0/50/100 and pickup 0; the pre-fix layer/control gap (10.58 vs 3.41 lateral, 46.68 vs 8.98 tip at falloff 100; 60.36 lateral at falloff 0) is closed; amount 0 is byte-identical (four digests, zero drift) and structurally bypassed; determinism field-identical; the package suite, package typecheck, app suite and app typecheck are green; all numbers recorded for the SUMMARY. No change to the sheet path, the one deposit law, the falloff family, the end-density envelope, the cap close-out, the pickup laws or any UI.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| document film -> probe captures | The headless probe reads /tmp/medium-engine/<gate>.json; a stale or mismatched capture would let a regression read green. |
| shader source -> GPU storage | The presence lane and the normalized weight decide what the committed sheet stores; a silently missing G lane would divide by a guard value and mis-weight the fringe. |
| engine life -> layer targets | The layer targets are allocated lazily and freed on document recreate; an allocation-format change must not disturb the amount-0 branch or target disposal. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|-----------|-----------|----------|-------------|-----------------|
| T-261126-01 | Tampering | probe captures under /tmp/medium-engine | low | mitigate | Every verify run re-captures under its own gate names in the same command chain that reads them; the dip assertion requires `edgeFeatherControl` on each capture, so a capture from a different recipe fails by name; the amount-0 identity is compared against the committed baseline, never against a session file. |
| T-261126-02 | Tampering (integrity) | STROKE_LAYER_ALPHA / strokeLayerMergeFS / displayLayerFS | medium | mitigate | The normalized weight lives in ONE shared snippet pinned verbatim in the merge, both union passes and displayLayerFS by shaders.test.ts; the weight is bounded by `layerAEff <= cover_L <= presence`, and the `max(presence, 1e-4)` guard keeps a never-written G lane from producing an unbounded factor; the probe's continuity/encode/polish bars judge the committed storage against the same law in every mode. |
| T-261126-03 | Tampering | layerFilm attachment 0 format (RG16F) | medium | mitigate | RG16F is already the velocity target's proven format; the cover pass writes `o0 = vec4(target, a, 0.0, a)` so the fallback's SRC_ALPHA blend and the G union both work; the clear pass zeroes G; the probe reads the lane explicitly and coverageLifecycle pins the allocation literal; a driver that dropped G would fail the sweep's continuity/dip bars, not ship silently. |
| T-261126-SC | Tampering | package installs | high | mitigate | This quick adds no npm/pip/cargo dependency and has no install task, so no [ASSUMED]/[SUS] package checkpoint is required. Any future proposal to add a package stops and requires a blocking human-verify checkpoint against the registry listing. |
</threat_model>

<verification>
| # | Gate | Command | Bar |
|---|------|---------|-----|
| 1 | Package suite | `pnpm --dir packages/efx-watercolor exec vitest run` | green (shaders.test.ts and coverageLifecycle.test.ts carry the new pins) |
| 2 | Package typecheck | `pnpm --dir packages/efx-watercolor check` | clean |
| 3 | App suite | `pnpm --dir app exec vitest run` | green |
| 4 | App typecheck | `pnpm --dir app exec tsc --noEmit` | clean |
| 5 | Fringe bar (artist recipe) | six captures at `--edge 100 --feather 100` (pickup 0/100 x falloff 0/50/100) + both `--falloff-sweep` runs | `edgeFringeDipPaper` and `edgeFringeDipUnder` <= 1/255 on every capture; every pre-existing layer bar holds; the sweep's strict broad < linear < rim ordering holds on both sides |
| 6 | Fringe bar (record recipe) | `hgl-default-f0` / `hgl-default` / `hgl-default-f100` (no `--feather`) + `--falloff-sweep hgl-default hgl-default-f100` | same bars at the acrylic record's own Feather 85 |
| 7 | Live/committed parity | the same sweeps | `edgePolishP95 <= 1` and `edgeEncodeP95 <= 1`, zero texels over; the display's normalized weights are the same shared snippet |
| 8 | Amount-0 identity | `run.mjs --gate edge-layer-neutral --scenario edge-layer --size 2048 --edge 0 --falloff 50` + `compare.mjs edge-layer-neutral --edge-structural` + `compare.mjs edge-layer-neutral` | four digests equal the committed baseline (82374ed4 / 83f54524 / 8aad7f58 / 8a347e61), zero drift; layerAllocated false, mergeDraws 0, mergeDrawsFirst 0 |
| 9 | Determinism | `hgl-default` vs `hgl-default-r2` through `--other` | every compared field equal, wall clock excluded |
| 10 | Film accounting | the capture's `edgeMemory*` rows | film 6 B/texel, layer set 42 B/px, the five-target sum consistent, 168 MiB at 2048² |
</verification>

<success_criteria>
- The ONE law is exactly `film_out = (1 - aEff)·F_S + aEff·(F_L / presence)` with `aEff = lateralWeight(u, amount, falloff)·cover_L` untouched; one commit, no second tuning parameter, no parameter-law retry.
- The presence is the layer film's own occupancy, stored in a new G lane of attachment 0 (RG16F), accumulated by the existing (ONE, ONE_MINUS_SRC_ALPHA) blend; the merge and the live display carry the same shared snippet; legacy presence-1 texels are byte-identical to the shipped mix.
- At the artist's recipe (Edge 100, noise Feather 100, Pickup 100 and 0) the fringe dip is at most 1/255 on both lateral axes at every falloff, and the pre-fix Pickup-100 capture read 6.89–11.23/255 on the under axis (the measured RED; the Pickup-0 control read <= 1.32 and is halo-free by design) — RED before, GREEN after, both recorded.
- The sheet path, the one deposit law, the falloff family, the end-density envelope, the cap close-out (e58497d3b), the pickup laws (539160b0b / 9f8c0fe4a) and every UI surface are untouched; amount 0 is byte-identical with zero digest drift.
- The probe and comparator carry the new bar and its required readings; all four gates pass; determinism is field-identical.
- The quick ends automated-ready: the live UAT row (two green strokes over a blue wash, Edge 100, noise Feather, Pickup 100 and 0, live and committed, left edge and bottom tip) is handed to the artist and not claimed.
</success_criteria>

<output>
Create `.planning/quick/261126-hgl-fix-the-subtle-white-halo-at-the-bristle/261126-hgl-SUMMARY.md` when done, carrying: the pre-fix fringe dips (six captures), the post-fix dips (nine captures including the record recipe), the encode / polish / continuity / core / midAlpha / cover numbers, the four amount-0 digests and the zero drift, the determinism verdict, the memory row, the one-law statement, and the live UAT hand-off list. End status: automated-ready.
</output>
