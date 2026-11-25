---
phase: 261125-kvl
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/efx-watercolor/probe/medium-engine/probe.ts
  - packages/efx-watercolor/probe/medium-engine/run.mjs
  - packages/efx-watercolor/probe/medium-engine/compare.mjs
  - packages/efx-watercolor/probe/medium-engine/harness.test.ts
  - packages/efx-watercolor/probe/medium-engine/baselines/edge-layer-neutral.json
  - packages/efx-watercolor/src/playground/params.ts
  - packages/efx-watercolor/src/playground/params.test.ts
  - packages/efx-watercolor/src/playground/mediums.ts
  - packages/efx-watercolor/src/playground/mediums.test.ts
  - packages/efx-watercolor/src/playground/bristles.ts
  - packages/efx-watercolor/src/playground/bristles.test.ts
  - packages/efx-watercolor/src/playground/spectral.ts
  - packages/efx-watercolor/src/playground/shaders.ts
  - packages/efx-watercolor/src/playground/shaders.test.ts
  - packages/efx-watercolor/src/playground/Engine.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.ts
  - app/src/components/physic-paint/view/aquarelleParamVisibility.ts
  - app/src/components/physic-paint/view/mediumSelection.test.ts
  - app/src/components/physic-paint/view/brushGroupMedium.test.ts
  - app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts
  - app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
autonomous: true
requirements:
  - EDGE-IDENTITY
  - EDGE-CONTINUITY
  - EDGE-GLAZE
  - EDGE-FALLOFF
  - EDGE-PARITY
  - SPEC10-PLUMBING
  - G1
  - G2
  - G3
  - G4
  - G5

estimate:
  tokens: 240000
  raw_tokens: 120000
  tasks: 6
  confidence: low

must_haves:
  truths:
    - "Amount 0 (Edge transparency 0): a fresh engine's two-stroke visit reproduces the shipped display bytes — every profile row matches the pre-change baseline within 2e-4, no layer target is allocated, no merge draw is submitted, and the visit capture digest reports 36a3f71d (drift surfaced, not hidden)."
    - "Amount 100: a straight Gouache stroke's edge band is continuous — no holes, no pale fringe, no washed-out mark — and the stroke's core reads the layer's full paint at 0/255 through the encoder."
    - "Over a same-visit under-stroke the faded band is a between-mix of both strokes' display bands — never paler than both, the under-stroke's hue survives (a glaze, not a wash)."
    - "Falloff 0 / 50 / 100 strictly orders the band's midpoint alpha broad < linear < rim, while the core stays opaque at every falloff."
    - "The merged sheet re-rendered through the real display matches the live composite's band values within the encoder bar: max <= 2/255, p95 <= 1/255, zero texels over; the 50 %-over-white reading in LINEAR light is <= 1/255 (spike measured 0.08/255); the capture round trip is byte-identical and the same script twice is byte-identical."
    - "Pointer, scripted and bake strokes commit exactly once at stroke end inside the stroke's own undo transaction — including the FIRST Edge-active stroke on a fresh engine; an interrupted stroke (key leave, tool switch, sheet reset, undo/redo, resize) discards the layer and leaves the sheet exactly as before the stroke."
  artifacts:
    - packages/efx-watercolor/src/playground/Engine.ts
    - packages/efx-watercolor/src/playground/shaders.ts
    - packages/efx-watercolor/src/playground/spectral.ts
    - packages/efx-watercolor/src/playground/bristles.ts
    - packages/efx-watercolor/src/playground/params.ts
    - packages/efx-watercolor/src/playground/mediums.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/aquarelleParamVisibility.ts
    - packages/efx-watercolor/probe/medium-engine/probe.ts
    - packages/efx-watercolor/probe/medium-engine/compare.mjs
    - packages/efx-watercolor/probe/medium-engine/run.mjs
    - packages/efx-watercolor/probe/medium-engine/baselines/edge-layer-neutral.json
  key_links:
    - from: packages/efx-watercolor/src/playground/Engine.ts
      to: packages/efx-watercolor/src/playground/Engine.ts
      via: "bristleInk routes the two ink draws into layerInk, the cover draw into a two-attachment layerFilm (cover + lateral), the relief pass into layerRelief — and skips the sheet's fixed attenuation draw, bristleTouch and the relief erode"
    - from: packages/efx-watercolor/src/playground/Engine.ts
      to: packages/efx-watercolor/src/playground/Engine.ts
      via: "one commitLayer() call in processInput's s.ending branch, before this.stroke = null — the single hook that already serves pointer, scripted and bake strokes"
    - from: packages/efx-watercolor/src/playground/Engine.ts
      to: packages/efx-watercolor/src/playground/Engine.ts
      via: "the merge writes ink.write/cover.write/mergeRelief then blits back into ink.read/cover.read/relief over the merge rect — never a swap"
    - from: packages/efx-watercolor/src/playground/Engine.ts
      to: packages/efx-watercolor/src/playground/shaders.ts
      via: "drawDisplay selects displayLayerFS only when the render target is null and a layer is open; every export binds the shipped displayFS"
    - from: packages/efx-watercolor/src/playground/params.ts
      to: packages/efx-watercolor/src/playground/Engine.ts
      via: "edgeFade 0 keeps ensureLayer() unreachable — the amount-0 bypass is a branch, never a value"
    - from: packages/efx-watercolor/src/playground/Engine.ts
      to: packages/efx-watercolor/src/playground/Engine.ts
      via: "openLayer() at scriptBegin and the pointerdown site is gated on this.params.edgeFade > 0 && s.tool === 'brush' && isBristleResponse(this.brush) — the same per-stroke predicate processInput/stamp compute (:2744, :2767, :2883), never the sheet-sticky bristleContent flag"
---

<objective>
Implement the per-stroke translucent stroke layer for Edge transparency exactly as frozen by spike 006: lazy layer targets, deposit routing, the MIN lateral field, the stroke-end band-mix merge with the frozen encoder, the live display branch, the Studio wiring and the Spec 10 parameter plumbing.

Purpose: give Gouache/Pen strokes a genuine lateral translucency — the paper or the under-stroke shows through the edge in its own colour, proportionally — which cannot be expressed as any per-dab deposit into the sheet (the fixed point of the one lerp is always the pigment target). The stroke composites once, as a layer, over the sheet.

Output: one quick, staged along the design's four stages (engine layer + identity, alpha profile, Studio parity, UAT hand-off), executed as sequential tasks on the main tree and ending automated-ready. The live UAT rows are handed to the artist, never claimed here.

Execution shape: Task 1 is the Wave-0 probe and the PRE-change baselines (the ujb lesson: the gate must exist before the source moves). Task 2 is data-only plumbing, inert at edgeFade 0. Task 3 is the tracer — the thinnest end-to-end slice: one straight amount-100 stroke over paper, allocated, routed, merged and committed through the real engine. Tasks 4-6 expand from that slice (live display + parity, Studio rows, the full gate suite and the UAT hand-off).

Budget note (accepted, not an unremarked overrun — ADR-2629 D5): the six-task, single-quick shape is the LOCKED CONTEXT delivery decision ("One quick"). Its calibrated estimate is 240k tokens (raw 120k, confidence low) — 2.4x the 100k smart-zone budget. That overrun is ACCEPTED with the lock; the quick is deliberately NOT sliced, and the checker's over-budget warning is recorded here as a decision, not a defect.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@/Users/lmarques/Dev/efx-motion-editor/.planning/quick/261125-kvl-full-implement-the-per-stroke-translucen/261125-kvl-CONTEXT.md
@/Users/lmarques/Dev/efx-motion-editor/.planning/quick/261125-kvl-full-implement-the-per-stroke-translucen/261125-kvl-RESEARCH.md
@/Users/lmarques/Dev/efx-motion-editor/SPECS/v2.2.0-medium-engine/DESIGN-stroke-layer-transparency.md
@/Users/lmarques/Dev/efx-motion-editor/.planning/spikes/006-stroke-layer-transparency/RESUME.md
@/Users/lmarques/Dev/efx-motion-editor/.planning/quick/261124-ujb-read-specs-v2-2-0-medium-engine-gsd-quic/261124-ujb-SUMMARY.md
@/Users/lmarques/Dev/efx-motion-editor/.planning/spikes/006-stroke-layer-transparency/probe/merge.ts
@/Users/lmarques/Dev/efx-motion-editor/.planning/spikes/006-stroke-layer-transparency/probe/q4.ts

# The frozen law — restated once here so no task re-derives it.

Per display band i over the 16 display bands:
  u = clamp(MIN over covering dabs of |across| / uFeatherEdge, 0, 1), uFeatherEdge = 0.66 (BRISTLE_FEATHER_EDGE)
  t = clamp((u - 0.30) / 0.70, 0, 1)
  e = 2^(2b - 1)
  A = 1 - amount * t^e
  A_eff = A * cover_L
  band_out,i = A_eff * band_L,i + (1 - A_eff) * band_S,i
  S_out likewise.
band_* is the display band value — Kubelka-Munk reflectance over white when S > 1e-3, legacy exp(-k) otherwise. Never a transmittance.

Encoder (frozen, do not re-derive): 8 compiled bands [1,3,5,7,9,10,11,13]; rank-one Jacobian; 4 LM iterations hard cap; seed mix(base, layer, aEff) in coefficient space; residual judged through all 16 bands; in-place write-back display = fit.
cover_out = 1 - (1 - cover_sheet) * (1 - A * cover_L); relief_out = relief_sheet + A_eff * relief_L.

Amount 0 is a BRANCH, not a value: no layer target is allocated, no merge draw is submitted, the shipped deposit path runs and the sheet is byte-identical (measured 203/255 divergence if the layer path ran at amount 0).

No parameter-law form from quick 261124-ujb may reappear: no uniform share, no pigment-share film, no threshold dissolve, no deposit-weight film, no depth film, no gather film. No tuning parameter beyond amount, start, falloff, maxIter.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Wave-0 probe — the edge-layer scenario, the comparator machinery and PRE-change baselines</name>
  <files>packages/efx-watercolor/probe/medium-engine/probe.ts, packages/efx-watercolor/probe/medium-engine/run.mjs, packages/efx-watercolor/probe/medium-engine/compare.mjs, packages/efx-watercolor/probe/medium-engine/harness.test.ts, packages/efx-watercolor/probe/medium-engine/baselines/edge-layer-neutral.json</files>
  <action>
Build the verification surface BEFORE any src/ edit, so the baselines are provably pre-change.

Recover the reverted machinery from `git show 5e6e7a37a^:packages/efx-watercolor/probe/medium-engine/probe.ts` and `git show 5e6e7a37a^:packages/efx-watercolor/probe/medium-engine/compare.mjs` — the `edgeTransparencyScript()`, the `edgeAcross { offsets, cover, ink, dark }` / `stations` metrics, the `--edge` / `--falloff` CLI flags, the `EDGE_IDENTITY_TOLERANCE = 2e-4` identity exemption and the print/station bars. Adapt, do not redesign: the reverted scenario targeted the gather film; this one targets the stroke layer.

Add the `edge-layer` scenario: cold paper preset, paper seed 0xc0ffee, strength 1, brush `bristle-round`, Body 100, the two straight strokes of `probe/q4.ts` (stroke A, then stroke B) driven through the adapter loop (`adapter.applyStroke(makeStroke(entry))` + `adapter.stepTick(tick)` + `adapter.fix()`), the ADAPTER's resetSheet for replay. Read `edgeFade` / `edgeFalloff` from the canonical bag through `toEngineParams` (before Task 2 the keys are silently dropped — that is what makes this baseline pre-change); echo `edgeAmount` (canonical edgeFade) and `edgeFalloff` into `writeResult` for the comparator. Add the closed-list entries in run.mjs (the `scenarioRaw !== ...` chain and its usage/error strings) and probe.ts (the nested scenario ternary) — the two lists must stay literal-identical. Extend the harness.test.ts pins that quote those literal chains.

Wire the comparator: add `edge-layer` to the alpha-law bristle predicate in compare.mjs (the `String(data.scenario).startsWith('bristle-')` line) and an `edge-layer` entry in SCENARIO_INVARIANTS calling a new `edgeLayerFailures`. Reintroduce the profile-identity machinery: `EDGE_IDENTITY_TOLERANCE = 2e-4`, the row-by-row comparison of the station/`edgeAcross` profile arrays, and the digest-drift exemption for `mode === 'baseline'` captures whose `edgeAmount === 0` (digest differences counted and printed as drift, never silently passed; any profile row moving fails).

The scenario must report, at amount > 0: the across-stations profile (cover, dark, ink per offset), band continuity (no interior hole), core exactness, the betweenness check for stroke B over stroke A, the falloff-ordering check, the encoder residual (merged sheet band values vs the live band mix computed from the read-back layer + sheet textures), the 50 %-over-white linear-light reading (DESIGN 6.5) as `linearHalfOnWhite` — over bare paper, at the station whose aEff is nearest 0.5, the max per-channel |displayed linear RGB − (0.5 · layerLinear + 0.5)| in 1/255, computed as `Σ band_i · w_i` in LINEAR light (never the companded sRGB darkness, which does not halve) — the capture round trip and a same-script-twice comparison. The layer-side readings must degrade gracefully at amount 0 (the engine has no layer yet) — report them as absent, never crash.

Capture and commit `baselines/edge-layer-neutral.json` from THIS tree: `node packages/efx-watercolor/probe/medium-engine/run.mjs --gate edge-layer-neutral --scenario edge-layer --size 2048 --edge 0 --falloff 50` then `node packages/efx-watercolor/probe/medium-engine/compare.mjs edge-layer-neutral`. Record in the same commit the observed RED at amount 100 (`--edge 100`): the scenario must fail against the layer bars on the pre-change engine — that failure is the tracer's target.

Do NOT touch packages/efx-watercolor/src/ or app/src/ in this task.
  </action>
  <verify>
    <automated>node packages/efx-watercolor/probe/medium-engine/run.mjs --gate edge-layer-neutral --scenario edge-layer --size 2048 --edge 0 --falloff 50 && node packages/efx-watercolor/probe/medium-engine/compare.mjs edge-layer-neutral && pnpm --dir packages/efx-watercolor exec vitest run</automated>
    [VALIDATED: bash -n exit 0]
  </verify>
  <done>An `edge-layer` capture exists at 2048² with the pre-change neutral baseline committed; the comparator passes the amount-0 run against it (profile rows identical to 4 dp, digests reported); the capture carries `linearHalfOnWhite` and the layer-side readings as absent at amount 0; the amount-100 run fails the layer bars (the documented red); both closed scenario lists and the harness pins accept the new name; the package suite is green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Spec 10 plumbing — canonical params, Engine Params, the sixteen-key records and the two Gouache-only rows</name>
  <files>packages/efx-watercolor/src/playground/params.ts, packages/efx-watercolor/src/playground/params.test.ts, packages/efx-watercolor/src/playground/mediums.ts, packages/efx-watercolor/src/playground/mediums.test.ts, packages/efx-watercolor/src/playground/bristles.ts, packages/efx-watercolor/src/playground/bristles.test.ts, packages/efx-watercolor/src/playground/Engine.ts, app/src/components/physic-paint/view/aquarelleRecordState.ts, app/src/components/physic-paint/view/aquarelleParamVisibility.ts, app/src/components/physic-paint/view/mediumSelection.test.ts, app/src/components/physic-paint/view/brushGroupMedium.test.ts, app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts, app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts</files>
  <behavior>
    - `toEngineParams` maps canonical edgeFade 0..100 to 0..1 through the ONE clamp01 table; edgeFalloff 50 -> 0.5; missing or non-finite input falls back to the canonical defaults (0 and 50).
    - `edgeFalloffExponent(0) === 0.5`, `edgeFalloffExponent(0.5) === 1`, `edgeFalloffExponent(1) === 2`, and a non-finite bias returns 1.
    - The medium records carry exactly sixteen keys; watercolor derives both edge keys from the canonical defaults (0 / 50), acrylic states 0 / 50 literally.
    - The two new rows sit after Feather, are bristle-only (`paint: BRISTLE_MEDIA`), and the row table is exactly fifteen entries.
    - The app bag, the Reset batch and the selection write allowlist grow by exactly the two keys (18-key bag, 15-row table, 16-key Reset patch).
  </behavior>
  <action>
Re-apply selected hunks of `1c5a27f4b` — params and Engine Params only, plus the three-uniform bind — and the whole record/UI/test surface of `e08e356f9`, excluding every film-law hunk.

From 1c5a27f4b, take verbatim: params.ts (`edgeFade` / `edgeFalloff` on AquarelleCanonicalParams with the 0 / 50 defaults, `clamp01(num(...) / 100)` in toEngineParams, the same doc comments adapted from film wording to the stroke-layer wording), Engine.ts (the two `Params` fields, the two `DEFAULT_PARAMS` values 0 / 0.5, the `BRISTLE_EDGE_START` import, and the three `gl.uniform1f(p.u.uEdgeStart!/uEdgeFade!/uEdgeFalloff!)` lines in bindGather bound unconditionally). The bindGather lines are inert on any program that does not declare those uniforms — keep them because they are the single push point the plumbing commits define; do not add the uniforms to the gather shader source.

Add to bristles.ts ONLY `BRISTLE_EDGE_START = 0.30` (DESIGN 3.3 pins 0.30, not the film's 0.55) and `edgeFalloffExponent(bias)` as the tested TS twin of `e = 2^(2b - 1)` (clamped 0.5..2; non-finite -> 1). Do NOT add the rejected film twin or any gather film constant.

From e08e356f9, take the whole surface: mediums.ts (16-key MediumParamKey, watercolor derived from DEFAULT_CANONICAL_PARAMS, acrylic literal 0 / 50 — adapt the doc comments to say the layer's lateral alpha, never the gather film), aquarelleRecordState.ts (the two AquarelleGlobalParams fields, the two AQUARELLE_GLOBAL_KEYS entries, the 0 / 50 defaults, the sixteen-key comment), aquarelleParamVisibility.ts (the two rows `Edge transparency` / `Edge falloff` after Feather, both `paint: BRISTLE_MEDIA`, the comment moved to fifteen rows), and the moved pins in mediumSelection.test.ts (18-key bag), brushGroupMedium.test.ts (sixteen keys), aquarelleParamVisibility.test.ts (fifteen rows), AquarelleGlobalsPanel.test.ts (sixteen-key Reset patch), mediums.test.ts (sixteen keys), params.test.ts (the two mappings and the defaults).

Keep the layer's law words straight: `edgeFade` is the layer alpha amount 0..1 (0 neutral), `edgeFalloff` is the shape bias (0 broad / 50 linear / 100 rim). No behaviour change lands in this task beyond the inert defaults.
  </action>
  <verify>
    <automated>pnpm --dir packages/efx-watercolor exec vitest run && pnpm --dir packages/efx-watercolor build && pnpm --dir app exec vitest run && pnpm --dir app exec tsc --noEmit</automated>
    [VALIDATED: bash -n exit 0]
  </verify>
  <done>Canonical edgeFade / edgeFalloff (0 / 50) flow through the ONE mapping to `Params` (0 / 0.5); the three uniforms are bound in bindGather; the sixteen-key records, the 18-key app bag, the 15-row table and the 16-key Reset patch all pin green; BRISTLE_EDGE_START is 0.30 and the exponent twin matches 0.5 / 1 / 2; both suites and both typechecks pass.</done>
</task>

<task type="tracer">
  <name>Task 3: Tracer — one amount-100 stroke end-to-end: lazy layer targets, deposit routing, lateral field, stroke-end merge with the frozen encoder</name>
  <files>packages/efx-watercolor/src/playground/Engine.ts, packages/efx-watercolor/src/playground/shaders.ts, packages/efx-watercolor/src/playground/spectral.ts, packages/efx-watercolor/src/playground/shaders.test.ts</files>
  <action>
Wire ONE stroke through every layer the feature touches, committed into the sheet at stroke end.

Targets (Engine.allocateTargets / docTargets / restore): add `layerInk` (DoubleTarget, [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA], LINEAR), `layerFilm` (Target, [HALF_FLOAT_R, HALF_FLOAT_R], NEAREST — attachment 0 cover, attachment 1 lateral), `layerRelief` (Target, [HALF_FLOAT_R], LINEAR), and a doc-sized `mergeRelief` scratch (Target, [HALF_FLOAT_R]), plus fields `layerOpen` (bool), `layerStroke` (Stroke | null), `layerRect` (Rect | null), and the probe diagnostics `layerAllocated` / `mergeDraws`. Lazy: `ensureLayer()` allocates on the first stroke whose `this.params.edgeFade > 0 && s.tool === 'brush' && isBristleResponse(this.brush)` — the SAME per-stroke predicate the Lifecycle paragraph pins, so the first Edge stroke on a fresh engine allocates on its own identity, not on a flag a previous stroke left behind; nothing is allocated at amount 0 or for a non-bristle tool; the set is kept for the engine's life, added to docTargets() for disposal/wipe reach, and the fields are nulled on document recreate so the next edge stroke re-allocates. At stroke start the layer is cleared: clearTarget for layerInk and layerRelief (zero), and a tiny `strokeLayerClearFS` writing 0 to attachment 0 and 1 to attachment 1 into layerFilm — gl.clearTarget clears to zero and the lateral MIN field must start at 1.0. Register every new program OUTSIDE the pinned twenty-three-entry `this.programs` literal (coverageLifecycle's count pin stays 23).

Lifecycle: `openLayer(s)` at the two stroke-creation sites (`scriptBegin` near :1491, after `this.stroke` is assigned, and the pointer path near :2430, after the stroke literal), gated on `this.params.edgeFade > 0 && s.tool === 'brush' && isBristleResponse(this.brush)` — the SAME per-stroke predicate `processInput` and `stamp` already compute (:2744, :2767, :2883), so the layer opens on exactly the strokes whose dabs go through `bristleInk` and on no other stroke. Do NOT gate on `bristleContent`: that flag is set only inside `beginBristles()` (:3391), reached from `stamp()` on the stroke's first dab (:2884-2887) AFTER both creation sites, so on a fresh engine the first Edge stroke would open no layer and silently run the shipped deposit path; and it is sheet-sticky (cleared only by clear / resetSheet / restore), so it cannot serve as a per-stroke medium test. `isBristleResponse` accepts Gouache (`bristle-round`) and Pen (`pen`) — the two media the UI exposes both rows for. Record the owning stroke (`layerStroke = s`) at open and assert `layerStroke === s` at commit. The gate reads `this.params.edgeFade` at stroke start while the law reads the same `this.params` live, so a mid-stroke amount change moves the displayed band and the merge together; only the open/closed decision is fixed at stroke start (the UI is a settings panel, and a stroke interrupted by a control change runs through the discard path anyway). Accumulate `layerRect` as the rect union in `bristleInk` (the same stampRect it already touches). `commitLayer()` runs ONCE in `processInput`'s `s.ending` branch, BEFORE `this.stroke = null`, inside the stroke's open undo step and after the end-cap dab; it merges over `layerRect`, increments `mergeDraws`, then clears the layer and closes it. Every one of the SIX sites that null `this.stroke` outside the ending branch calls `discardLayer()` — clear the targets, close, merge nothing: `clear` (:2156), `resetSheet` (:2187), `abortStroke` (:2205), `restore` (:1172), `travel` (:2247 — undo/redo, also reached through abortStroke, swaps the sheet targets from history, so a surviving layer would leak into the next stroke) and `resizeDocument` (:942 — it reallocates every document target, so the layer fields are nulled there and the next Edge stroke re-allocates). clear / resetSheet already wipe every `docTargets()` target; the `discardLayer()` call there is the close (and the explicit intent).

Deposit routing (bristleInk): while a layer is open, the two ink draws (mode 1 attenuation, mode 0 carried add) bind `layerInk` instead of `this.ink.read`; SKIP the `g.draw(this.fixed, rect)` settled-half draw (the layer has no settled pool); the cover draw uses a NEW `bristleCoverLayerFS` — a copy of bristleCoverFS that recomputes the four `across` lines from uniforms in main() (never widen `struct Gathered`) and emits two attachments, cover `vec4(target, 0, 0, a)` at location 0 and `vec4(clamp(abs(across) / uFeatherEdge, 0, 1))` at location 1, with per-attachment blend `blendFunci(0, ONE, ONE_MINUS_SRC_ALPHA)` and `blendEquationi(1, MIN)`, drawn into `layerFilm`. Keep the shipped `if (a <= 1e-3) discard;`. Also route the per-dab calls: skip `bristleTouch` (the sheet's lastTouch is untouched by the layer's paint), route `bristleReliefPass` into `layerRelief`, and skip the negative-emboss `bristleReliefErode` on the layer path. Leave the carrier pass, pickup snapshot and brushWet unchanged (pickup stays sheet-side; the wet sim is the UAT row).

The merge (over layerRect, three cheap passes plus copy-back): `strokeLayerMergeFS` is the frozen encoder — 8 compiled bands [1,3,5,7,9,10,11,13] generated from the DISPLAY_BANDS / BASIS / SCATTER constants (a new emitter in spectral.ts, never retyped, no uniform mask), rank-one Jacobian, 4 LM iterations (`uMaxIter` bound to 4), seed mix(base, layer, aEff), seed-state selection by residual, LM step rejection, S >= 0, exact endpoints at aEff >= 1 - 1e-4 and aEff <= 1e-4. It samples the SUM in-shader: `base = texture(uInkA) + texture(uFixedA)` and `baseB = texture(uInkB) + texture(uFixedB)` (G5 — the same visit's earlier stroke may still sit in ink), the layer's own two attachments, layerFilm's cover and lateral, and produces `enc = fit(T)` where T is the band mix; writes `oA = encA / k - texture(uFixedA)` and `oB = encB / k - texture(uFixedB)` (including .a = S) into ink.write.

`k` is the display's own granulation step, named exactly where it comes from: `shaders.ts:1932` `gran = 1 + uGranulation * (0.5 - paper.g) * 2.2` and `:1937` `k = mix(gran * (1 + uEdgeDarken * edge), 1.0, uFlat)`, applied at `:1938` (`a *= k; b *= k; scatter *= k`) AFTER the ink+fixed sum and BEFORE the band reconstruction. Every merge runs against the LIVE compositor display (`target === null`, `flat = false` → `uFlat = 0`, Engine.ts:4297) and `uEdgeDarken = 0` there because `bristleContent` is true (`:4243`; `beginBristles` set it at THIS stroke's first dab, before any merge), so `k` reduces to `gran` with `uGranulation = params.granulation * 0.55` (`:4238`) and `paper.g` the RAW paper texel (`texture(uPaper, uv).g`; the display's `mix(..., vec4(0.5), uFlat)` is the identity at uFlat 0). Bind those three to the merge and clamp `k` to at least 1e-3 so a pathological granulation can never yield Inf.

The division is NOT a deviation from the frozen `ink = fit − fixed`: the frozen law fixes the DISPLAY-BAND value and the identity `display = ink + fixed = fit` in display-band space. The engine's display inserts `k` between the storage sum and the band reconstruction, so the storage-domain form that reproduces `display band = fit` is `ink = fit/k − fixed`; the frozen `fit − fixed` is exactly its `k = 1` case (the spike probe carried no granulation). Say this in the shader header AND carry it as a gate — Task 4's merged-band comparison decodes the committed sheet through the same `k`. The frozen spike digest `3170f21b` is a probe-domain digest and does NOT apply verbatim to the engine's k-scaled store; a mismatch there is not a regression.

T itself is computed on the display-domain states: a 5-tap film soften of the sheet (`uFilmBlur` weight, the same taps as displayFS) and of the layer, each then multiplied by k — the display band value is the polished state's band value (DESIGN 3.3). Pass 2 writes cover_out = 1 - (1 - cover_S) * (1 - A * cover_L) into cover.write. Pass 3 writes relief_out = relief_S + aEff * relief_L into mergeRelief. Then blit ink.write -> ink.read (both attachments), cover.write -> cover.read and mergeRelief -> relief over the merge rect only — NEVER swap (read stays authoritative; a swap would make read stale inside lastAdvectRect minus mergeRect). Verify blitFramebuffer works on HALF_FLOAT attachments in Wave 0; if it does not, add a trivial copy program per target.

The lateral profile law is exactly the frozen form: u from layerFilm.r, t = clamp((u - uEdgeStart) / (1 - uEdgeStart), 0, 1), e = exp2(2 * uEdgeFalloff - 1), A = 1 - uEdgeFade * pow(t, e), aEff = clamp(A * cover_L, 0, 1). BRISTLE_EDGE_START (0.30) is bound as uEdgeStart.

Add to shaders.test.ts a pin that the shipped displayFS source is unchanged in kind (no layer samplers, no uEdgeFade) and that the merge shader's band list is exactly the eight frozen indices. Do NOT touch displayFS, bristleCoverFS, bristleDepositFS or struct Gathered in this task.
  </action>
  <verify>
    <automated>node packages/efx-watercolor/probe/medium-engine/run.mjs --gate edge-layer-a100 --scenario edge-layer --size 2048 --edge 100 --falloff 50 && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate edge-layer-neutral --scenario edge-layer --size 2048 --edge 0 --falloff 50 && node packages/efx-watercolor/probe/medium-engine/compare.mjs edge-layer-neutral && pnpm --dir packages/efx-watercolor exec vitest run</automated>
    [VALIDATED: bash -n exit 0]
  </verify>
  <done>At amount 100 the stroke's dabs land only in the layer (the sheet is untouched until the merge), including the FIRST Edge-active stroke on a FRESH engine (the per-stroke predicate opens it, not the sheet-sticky flag); the merge runs exactly once at stroke end (mergeDraws === 1) inside the stroke's undo step, writing fit/k - fixed with the frozen encoder, with k the display's own granulation step (`gran`, shader header documents why the /k preserves the frozen display-band identity); the merged sheet shows a continuous band with an exact core; at amount 0 layerAllocated is false, mergeDraws is 0 and the neutral gate still passes the pre-change baseline; the package suite is green.</done>
</task>

<task type="auto">
  <name>Task 4: The live display branch and the parity bars — displayLayerFS, the basis-function emitter, the polish symmetry</name>
  <files>packages/efx-watercolor/src/playground/shaders.ts, packages/efx-watercolor/src/playground/spectral.ts, packages/efx-watercolor/src/playground/Engine.ts, packages/efx-watercolor/src/playground/shaders.test.ts</files>
  <action>
Convert `export const displayFS` into a source function `displaySource(layer: boolean)`; `displayFS = displaySource(false)` must emit the current string byte-for-byte (same template expansions in the same order, no new samplers, no new uniforms) and `displayLayerFS = displaySource(true)` adds the layer block. Register `displayLayer` outside the pinned program literal.

Add `displayBasisFnGLSL()` in spectral.ts: it wraps the SAME generated block that displayBasisGLSL emits in a `vec3 displayBasisBands(vec4 a, vec3 b, float scatter)` function (the block already reads locals named a, b, scatter and writes rgb; declare `float tr;` inside). Both emitters must be generated from the same DISPLAY_BANDS / BASIS / DISPLAY_RGB_WEIGHTS tables — assert in shaders.test.ts that the two strings carry identical numeric tuples per band. The shipped displayFS keeps calling `${displayBasisGLSL()}` untouched.

In the layer variant, insert the mix exactly where the shipped source has finished its polish — after the 5-tap film soften and after `a *= k; b *= k; scatter *= k;` — so the sheet state is the display-domain state the merge also targeted. Sample the layer's two attachments with the same 5-tap soften (`filmAt` pattern without a fixed half) and multiply by the same k. Compute u = clamp(layerLateral, 0, 1), t = clamp((u - uEdgeStart) / (1 - uEdgeStart), 0, 1), e = exp2(2 * uEdgeFalloff - 1), A = 1 - uEdgeFade * pow(t, e), aEff = clamp(A * layerCover, 0, 1); skip the layer reconstruction when layerCover <= 1e-4. Because the band->rgb map is linear (rgb += band_i * w_i with shared weights), the exact band mix equals `rgb = mix(displayBasisBands(sheet), displayBasisBands(layer), aEff)` — this is the frozen mix, not an approximation; say so in a comment. In the layer variant: the emboss shade lights relief_out = relief_S + aEff * relief_L (sample layerRelief); the mode-4 underlay branch uses cover_out = 1 - (1 - cover_S) * (1 - A * cover_L) in place of the raw cover read; everything downstream (tSrgb, lit, modes 2/4/paper) stays the shipped code.

In `drawDisplay`: choose `displayLayer` only when the render target is null AND `layerOpen` is true (exports always pass a target, so they structurally bind the shipped program); bind layerInk.tex[0] / .tex[1], layerFilm.tex[0] (cover) / .tex[1] (lateral), layerRelief.tex[0] at units 10-14 and bind uEdgeFade / uEdgeStart / uEdgeFalloff there (the shared bindGather push does not reach a display program).

Parity accounting, exactly: the gate is law-domain. The merge's target T is band values of the polished states; the committed sheet decodes to band(k * (ink + fixed)) = band(enc) = T — the probe MUST apply the same `k` (`gran` at the live render: `1 + (params.granulation * 0.55) * (0.5 - paper.g) * 2.2`, the value Task 3 binds to the merge) when it decodes the committed sheet, or the comparison measures the granulation step instead of the encoder residual. The 50 %-over-white row is the same decode: `linearHalfOnWhite <= 1/255` (spike measured 0.08/255) asserted in `edgeLayerFailures` beside the encoder residual, computed in linear light, never as companded sRGB darkness. The one asymmetry the probe must NOT hide is the display's second film-blur on the stored field — report it as `edgePolishDelta` (max / p95 / count over 2/255) in the capture, and state in the shader header that the film blur is a spatial pre-filter that cannot be inverted pointwise; UAT row 6 judges the settle. If `edgePolishDelta`'s p95 exceeds 2/255, first try sampling the merge on raw states (drop the blur from the target only) and record both numbers; do not switch the gate to byte equality.
  </action>
  <verify>
    <automated>node packages/efx-watercolor/probe/medium-engine/run.mjs --gate edge-layer-a100 --scenario edge-layer --size 2048 --edge 100 --falloff 50 && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate edge-layer-a100-r2 --scenario edge-layer --size 2048 --edge 100 --falloff 50 && node packages/efx-watercolor/probe/medium-engine/compare.mjs edge-layer-a100 --other edge-layer-a100-r2 && pnpm --dir packages/efx-watercolor exec vitest run</automated>
    [VALIDATED: bash -n exit 0]
  </verify>
  <done>The live compositor shows the band mix while a stroke is live (paper and under-stroke through the fade, solid core), the exports remain the shipped displayFS (no layer samplers bound), the probe's law-domain live-vs-merged comparison meets max <= 2/255, p95 <= 1/255 with zero texels over for falloff 0 / 50 / 100 over paper and over the same-visit stroke, `linearHalfOnWhite` reads <= 1/255, `edgePolishDelta` is measured and reported, and the two same-parameter captures compare field-for-field in `--other` mode (same-session determinism, never a self-comparison); package suite green.</done>
</task>

<task type="auto">
  <name>Task 5: Studio parity — pointer, scripted, bake, capture, undo, interruptions and the 4K memory budget</name>
  <files>packages/efx-watercolor/probe/medium-engine/probe.ts, packages/efx-watercolor/probe/medium-engine/compare.mjs, packages/efx-watercolor/src/playground/Engine.ts, packages/efx-watercolor/src/adapter/engineAdapter.ts, packages/efx-watercolor/src/playground/coverageLifecycle.test.ts</files>
  <action>
Prove the Studio-facing gates on the real paths.

G1: drive a POINTER stroke with edgeFade > 0 through the `driveBristleEnd` model (scriptBegin, relabel the stroke's pointerId to the live pointer, push into live.queue, tick, then `stroke.ending = true`, tick, settle, 1x1 readPixels fence) and assert mergeDraws === 1, the merge ran before the next stroke read the sheet, and the onStrokeEnd callback fired after the commit. G2: the adapter loop (applyStroke -> Studio apply) runs the same single merge. G3: re-render / bake replay of the merged sheet must render byte-identically at amount 0 and within 2/255 at amount 100 (the same seeded replay: the adapter's resetSheet, pinned lastDir [1,0] / lastAngle 0). G4: at amount 0 assert layerAllocated === false AND mergeDraws === 0 structurally (the counters, not the absence of visible effect) and the capture bytes equal the pre-change neutral baseline profile with digests reported. G5: the same-visit two-stroke scene proves the merge's base is the SUMMED sheet (ink.read + fixed): after stroke A is still mobile in ink, stroke B's merge reads A. G5 is asserted by the `edge-layer` scenario invariant (the capture carries the summed-base readings), NOT by a committed `baselines/edge-layer-g15.json` — no task creates that baseline and none should: a reference captured after the change would make the comparison vacuous, and `--other` never consults `baselines/` at all.

Undo/capture: captureSheet/restoreSheet stay unchanged; assert stroke undo restores the pre-merge sheet byte-for-byte over the merge rect and redo re-applies it; assert the sheet outside the merge rect is unchanged by the merge (read ink.read + fixed + cover.read + relief before and after, compare outside-rect bytes). Interruption: verify every Studio path that abandons a stroke routes through one of the SIX stroke-null sites — `clear` / `resetSheet` / `abortStroke` / `restore` / `travel` (undo/redo, also reached through abortStroke) / `resizeDocument`; if a caller bypasses them, add the layer discard to that caller's path (research assumption A5) — the sheet must be byte-identical to before the stroke after a key leave or a tool switch, and an undo/redo (`travel`) or a resize with a layer open must discard it too (a surviving layer leaks into the next stroke; a resize reallocates the targets under it). `discardLayer()` must be idempotent — `abortStroke` reaches `travel`, so two discards in one call path are normal.

Memory: measure the layer set plus mergeRelief at the Studio's sheet sizes (1080² and 4K) against the 160 MiB ceiling and record the numbers in the capture; at 4K the layer set is ~250 MB by design — record the measured figure and flag it for the artist (not a pass/fail here, but it must be a number, not an assumption).

Extend compare.mjs's `edge-layer` invariant with these rows and keep the alpha-law predicate covering the scenario.
  </action>
  <verify>
    <automated>node packages/efx-watercolor/probe/medium-engine/run.mjs --gate edge-layer-g15 --scenario edge-layer --size 2048 --edge 100 --falloff 50 && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate edge-layer-g15-r2 --scenario edge-layer --size 2048 --edge 100 --falloff 50 && node packages/efx-watercolor/probe/medium-engine/compare.mjs edge-layer-g15 --other edge-layer-g15-r2 && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate edge-layer-neutral --scenario edge-layer --size 2048 --edge 0 --falloff 50 && node packages/efx-watercolor/probe/medium-engine/compare.mjs edge-layer-neutral && pnpm --dir packages/efx-watercolor exec vitest run</automated>
    [VALIDATED: bash -n exit 0]
  </verify>
  <done>G1-G5 each hold on the real engine paths: pointer and scripted strokes merge once inside their own undo transaction, the bake replay agrees within 2/255, amount 0 allocates nothing and draws no merge, and the merge base is the summed sheet (asserted by the `edge-layer` scenario invariant, reached in `--other` mode — no `edge-layer-g15` baseline exists); the two same-parameter captures compare field-for-field; stroke undo/redo round-trips the pre-merge sheet; an interrupted stroke — including undo/redo and a resize — leaves the sheet byte-identical; the memory figures for 1080² and 4K are recorded.</done>
</task>

<task type="auto">
  <name>Task 6: Automated-ready close — the full gate suite, the probe ladder and the UAT hand-off</name>
  <files>packages/efx-watercolor/probe/medium-engine/probe.ts, packages/efx-watercolor/probe/medium-engine/compare.mjs</files>
  <action>
Run the complete ladder and record the numbers; claim nothing the tree cannot show.

Gate suite in this order: `pnpm --dir packages/efx-watercolor exec vitest run`; `pnpm --dir packages/efx-watercolor build`; `pnpm --dir app exec vitest run`; `pnpm --dir app exec tsc --noEmit`; `pnpm --dir packages/efx-watercolor check` (the script exists — `tsc --noEmit`). Probe ladder at 2048²: the neutral gate (amount 0, falloff 50) against the pre-change baseline; the amount-100 runs at falloff 0 / 50 / 100 over paper and over the same-visit stroke; the G1/G2 pointer and scripted runs; the bake replay; the capture round trip; the same script twice (byte-identical, compared with `--other` between two gate names); the amount-0 structural row (layerAllocated false, mergeDraws 0). Run every gate twice and compare the digest fields for cross-process determinism (the visit's everPainted crop covers the whole 2048² sheet, so digests are comparable — never compare two differently cropped single-stroke captures).

Record in the SUMMARY: the encoder residual (max / p95 / over), `linearHalfOnWhite` (the 50 %-over-white linear-light reading, bar <= 1/255; spike measured 0.08/255), edgePolishDelta, the merge's `k` range and its provenance (the display's granulation step — `fit/k − fixed` is the storage-domain form of the frozen `fit − fixed`, with the spike digest `3170f21b` NOT applicable verbatim), the per-station print retention, the falloff-ordering readings, the 1080²/4K memory figures, the merge cost measured at 2K (the frozen ~21 ms budget; report the real number), and the two pre-existing engine facts left untouched (the stroke-start lastDir/lastAngle carry and the capture-bbox drift) as reuse rules, not defects.

Write the UAT hand-off list VERBATIM as handed to the artist, never claimed: (1) amount 0 identical to today's brush and watercolor unchanged; (2) amount 50 / 100, falloff 50 on paper — continuous stroke, smooth translucent edge, no banding; (3) amount 100 falloff 0 vs 100 side by side — visibly different distribution, the rim setting keeps the middle solid; (4) a stroke over another stroke (same visit and over a committed key) — the under-colour shows through the fade, no pale band, no white fringe, no holes; (5) Feather 0/85 x falloff 0/100 — no seam at the caps or the rim; (6) leave/reopen, forced re-render, Undo/Redo — identical; (7) Pen (small) and Gouache (large) — the band scales with the stroke; (8) the wet/pickup row — the layer's own wetness is not simulated (self-pickup and wet-on-wet drag within one stroke), pickup stays sheet-side; (9) the bristle-gap row — the base survives in the layer's own gaps (print retention 95-96 % at the band edge): no pale band in the gaps, the mark keeps its character; (10) mid-stroke interruption discards the layer — differs from today's partial-dab persistence.

State the end status as automated-ready.
  </action>
  <verify>
    <automated>pnpm --dir packages/efx-watercolor exec vitest run && pnpm --dir packages/efx-watercolor build && pnpm --dir app exec vitest run && pnpm --dir app exec tsc --noEmit && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate edge-layer-neutral --scenario edge-layer --size 2048 --edge 0 --falloff 50 && node packages/efx-watercolor/probe/medium-engine/compare.mjs edge-layer-neutral && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate edge-layer-a100 --scenario edge-layer --size 2048 --edge 100 --falloff 50 && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate edge-layer-a100-r2 --scenario edge-layer --size 2048 --edge 100 --falloff 50 && node packages/efx-watercolor/probe/medium-engine/compare.mjs edge-layer-a100 --other edge-layer-a100-r2</automated>
    [VALIDATED: bash -n exit 0]
  </verify>
  <done>All seven gates pass in the recorded order; the probe ladder's numbers are recorded in the SUMMARY; the UAT rows are listed as handed to the artist with no row claimed; the quick ends automated-ready with the two pre-existing engine facts explicitly untouched.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| UI params -> engine uniforms | The two new knobs cross from a 0..100 record into 0..1 uniforms and into a bounded nonlinear fit; a non-finite value here poisons a whole-stroke encode. |
| stroke lifecycle -> layer targets | A layer that outlives its stroke leaks paint from one stroke into the next sheet commit. |
| shader source -> amount-0 path | Any edit that reaches the shipped gather/display programs can drift the byte-identical amount-0 result. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261125-kvl-01 | Tampering | params.ts toEngineParams / Engine bindGather / merge LM fit | medium | mitigate | Both knobs pass clamp01(num/100) at the boundary and clamp(0,1) at the uniform bind; the falloff exponent guards non-finite input (returns 1); the LM fit's exact-endpoint short-circuits at aEff >= 1 - 1e-4 and <= 1e-4 bound the iterates; a NaN would fail the probe's station bars. |
| T-261125-kvl-02 | Information disclosure (paint leakage) | layer targets vs the SIX stroke-null sites | high | mitigate | discardLayer() clears and closes the layer at every non-ending stroke drop — clear (:2156), resetSheet (:2187), abortStroke (:2205), restore (:1172), travel (:2247) and resizeDocument (:942) — and commitLayer() always clears after the merge; the probe's interruption row asserts sheet bytes unchanged after a key leave, a tool switch, an undo/redo and a resize; G4 asserts no layer exists at amount 0. |
| T-261125-kvl-03 | Tampering (integrity) | shipped gather/display shader source | high | mitigate | New behaviour lives in new programs only; displayFS is emitted byte-identically from displaySource(false); struct Gathered is never widened; the 23-program literal pin stays; the amount-0 profile-identity gate at 2e-4 with digest-drift reporting is the arbiter. |
| T-261125-kvl-SC | Tampering | package installs | high | mitigate | This quick adds no npm/pip/cargo dependency; no install task exists, so no [ASSUMED]/[SUS] package checkpoint is required. If a task ever proposes one, it stops and requires a human-verify checkpoint against the registry listing. |

</threat_model>

<verification>
| # | Gate | Command | Bar |
|---|------|---------|-----|
| 1 | Package suite | `pnpm --dir packages/efx-watercolor exec vitest run` | green |
| 2 | Package build then app suite | `pnpm --dir packages/efx-watercolor build && pnpm --dir app exec vitest run` | green (app resolves the package through dist) |
| 3 | App typecheck | `pnpm --dir app exec tsc --noEmit` | clean |
| 4 | Amount-0 identity | `node packages/efx-watercolor/probe/medium-engine/run.mjs --gate edge-layer-neutral --scenario edge-layer --size 2048 --edge 0 --falloff 50` + `node packages/efx-watercolor/probe/medium-engine/compare.mjs edge-layer-neutral` | every profile row within 2e-4 of the PRE-change baseline; digests reported as drift (36a3f71d expected); layerAllocated false, mergeDraws 0 |
| 5 | Alpha-profile bars | `--edge 100 --falloff {0,50,100}` over paper and the same-visit stroke | continuity (no holes, no pale band); betweenness (glaze not wash); falloff ordering broad < linear < rim; core exact 0/255; live vs merged band values max <= 2/255, p95 <= 1, zero over — the merged side decoded through the display's own `k` (`gran`, the granulation step); 50 %-over-white `linearHalfOnWhite` <= 1/255 in LINEAR light; edgePolishDelta reported |
| 6 | Determinism | capture round trip; same script twice; gate run twice | capture byte-identical; the script twice byte-identical; digests identical across processes (full-sheet visit crop) |
| 7 | G1-G5 | the pointer drive, the adapter drive, the bake replay, the amount-0 structural row, the same-visit summed-base scene — every one carried by the `edge-layer` scenario invariant, which runs in EVERY comparator mode (no `edge-layer-g15` baseline exists or is created) | all five hold; merge inside the stroke's undo transaction before onStrokeEnd; interrupted stroke (incl. undo/redo, resize) leaves the sheet untouched |
</verification>

<success_criteria>
- Every one of the seven gates passes with recorded numbers, not assertions.
- The frozen composite law and encoder are implemented exactly as stated in `<context>` — no new tuning parameter, no film-law form, no uniform band mask.
- Amount 0 is a branch: none of the layer targets exist, no merge draw is submitted, and the sheet reproduces the pre-change profile; the digests are reported, not silently equated.
- Amount > 0 shows a live band mix (paper and under-stroke through the fade, solid core) and commits once at stroke end inside the stroke's own undo transaction for pointer, scripted and bake strokes alike.
- The layer opens on exactly the Edge-active bristle strokes — including a fresh engine's FIRST one — and on no other stroke: the gate is the per-stroke predicate `s.tool === 'brush' && isBristleResponse(this.brush)`, never the sheet-sticky `bristleContent`.
- The write-back is `fit/k − fixed` with `k` named as the display's own granulation step; the frozen display-band identity is preserved and the spike digest `3170f21b` is documented as not applying verbatim.
- The two pre-existing engine facts (stroke-start lastDir/lastAngle carry, capture-bbox drift) are untouched and documented as reuse rules.
- The quick ends automated-ready; every live UAT row is handed to the artist and none is claimed.
- Accepted scope: the single-quick, six-task shape is the locked CONTEXT delivery decision; its 240k-token estimate (raw 120k, 2.4x the 100k smart zone, confidence low) is accepted with the lock, not sliced.
</success_criteria>

<output>
Create `.planning/quick/261125-kvl-full-implement-the-per-stroke-translucen/261125-kvl-SUMMARY.md` when done, carrying the measured gate numbers, the UAT hand-off list and the end status (automated-ready).
</output>
