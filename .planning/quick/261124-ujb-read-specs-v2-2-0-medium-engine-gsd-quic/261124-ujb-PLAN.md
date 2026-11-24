---
phase: 261124-ujb
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/efx-watercolor/probe/medium-engine/probe.ts
  - packages/efx-watercolor/probe/medium-engine/run.mjs
  - packages/efx-watercolor/probe/medium-engine/compare.mjs
  - packages/efx-watercolor/probe/medium-engine/harness.test.ts
  - packages/efx-watercolor/probe/medium-engine/baselines/edge-transparency-neutral.json
  - packages/efx-watercolor/probe/medium-engine/baselines/edge-transparency-neutral-broad.json
  - packages/efx-watercolor/src/playground/bristles.ts
  - packages/efx-watercolor/src/playground/bristles.test.ts
  - packages/efx-watercolor/src/playground/params.ts
  - packages/efx-watercolor/src/playground/params.test.ts
  - packages/efx-watercolor/src/playground/Engine.ts
  - packages/efx-watercolor/src/playground/shaders.ts
  - packages/efx-watercolor/src/playground/scattering.test.ts
  - packages/efx-watercolor/src/playground/mediums.ts
  - packages/efx-watercolor/src/playground/mediums.test.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.ts
  - app/src/components/physic-paint/view/aquarelleParamVisibility.ts
  - app/src/components/physic-paint/view/mediumSelection.test.ts
  - app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts
  - app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
  - app/src/components/physic-paint/view/brushGroupMedium.test.ts
autonomous: true
requirements: []
user_setup: []

estimate:
  tokens: 92000
  raw_tokens: 46000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Edge transparency 0 is inert by construction: with amount 0 the edge film early-returns 1 and the probe captures at (amount 0, falloff 0) and (0, 100), painted by a live `bristle-round` stroke (`brushId: 'bristle-round'` on the script entry, so `gatherBristle` runs), are byte-identical to baselines captured from the pre-change engine (UAT row 1)."
    - "The film fades the whole carried film together: coverage, cA, cB and alpha all carry `edgeFilm`, and the scatter S term carries `g.film` — so at amount 100 the rim is inert (no deposit, no erase), never an eraser, and no milky white rim appears from Body (UAT rows 3 and 5)."
    - "film(0) = 1 at every amount and falloff (the core never moves), film(rim) = 1 − amount at every falloff, and the fade midpoint reads 0.293 / 0.5 / 0.75 at amount 1 for falloff 0 / 50 / 100 (the landmark table)."
    - "Falloff 0 reads broad (transparency reaches mid-width), 50 linear, 100 rim (fade hugs the silhouette), and the three points are separated in the probe's lateral profile by more than the tolerance."
    - "Both params are canonical: they live inside the Gouache and Pen medium records with 0 / 50, Reset restores 0 / 50, and re-picking a medium resets both like every other medium param (D-03)."
    - "Both rows are acrylic-only: visible for Gouache, absent for watercolor and the Water tool, so `uEdgeFade` stays 0 for watercolor and its render is identical (UAT row 7)."
    - "The visible silhouette is unchanged: the paper threshold is untouched, cells beyond the silhouette clamp to the full rim factor so the edge narrows at amount 100 by design, and amount 0 leaves the footprint byte-identical."
    - "Every capture the probe comparisons run satisfies the visible-alpha contract for its capture type: the live bristle-response `edge-transparency` capture reports the bristle skip with no delta/samples, one shared predicate makes the probe and the comparator agree, a non-bristle capture can never carry a skip, and a bristle capture can never report a delta beside its skip."
  artifacts:
    - packages/efx-watercolor/probe/medium-engine/baselines/edge-transparency-neutral.json
    - packages/efx-watercolor/probe/medium-engine/baselines/edge-transparency-neutral-broad.json
    - packages/efx-watercolor/src/playground/bristles.ts
    - packages/efx-watercolor/src/playground/shaders.ts
    - packages/efx-watercolor/src/playground/Engine.ts
    - packages/efx-watercolor/src/playground/params.ts
    - packages/efx-watercolor/src/playground/mediums.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/aquarelleParamVisibility.ts
  key_links:
    - from: app/src/components/physic-paint/view/aquarelleParamVisibility.ts
      to: app/src/components/physic-paint/view/aquarelleRecordState.ts
      via: "the two new rows' keys must exist in AQUARELLE_GLOBAL_KEYS and DEFAULT_AQUARELLE_PARAMS, otherwise the snapshot loop and the selection-write allowlist silently drop them"
    - from: app/src/components/physic-paint/view/aquarelleRecordState.ts
      to: packages/efx-watercolor/src/playground/mediums.ts
      via: "both new keys must exist in the medium records, otherwise Reset cannot restore 0 / 50 and re-pick cannot reset them"
    - from: packages/efx-watercolor/src/playground/mediums.ts
      to: packages/efx-watercolor/src/playground/params.ts
      via: "the canonical param spread feeds the record bag; the record's edgeFade / edgeFalloff must map through toEngineParams"
    - from: packages/efx-watercolor/src/playground/params.ts
      to: packages/efx-watercolor/src/playground/Engine.ts
      via: "toEngineParams must emit normalised 0..1 edgeFade / edgeFalloff into Params, consumed by bindGather"
    - from: packages/efx-watercolor/src/playground/Engine.ts
      to: packages/efx-watercolor/src/playground/shaders.ts
      via: "bindGather must bind uEdgeStart / uEdgeFade / uEdgeFalloff under the BRISTLE_GATHER program for every consumer (deposit, cover, relief)"
    - from: packages/efx-watercolor/src/playground/shaders.ts
      to: packages/efx-watercolor/src/playground/bristles.ts
      via: "the shader's exponent map must mirror the tested twin's edgeFalloffExponent, and the gather must use the silhouette constant chain"
    - from: packages/efx-watercolor/probe/medium-engine/probe.ts
      to: packages/efx-watercolor/src/playground/brushes.ts
      via: "the edge-transparency script entry's own `brushId: 'bristle-round'` — the only id `isBristleResponse` accepts (with `pen`); the `entry.brushId ?? BRUSH_ID` default stamps `round`, a non-bristle preset whose path never runs `gatherBristle`, so the lateral film would never execute"
---

<objective>
Deliver Spec 10: two bristle-only sliders — Edge transparency (amount) and Edge falloff (shape bias) — driving one lateral `edgeFilm` that scales the whole carried film in `gatherBristle`, per D-01..D-03.

Purpose: The artist gets a transparent border on Gouache/Pen marks — the core keeps its paint, the rim thins, and the falloff picks whether the fade hugs the silhouette or reaches mid-width. Neutral at amount 0; the rim is inert at amount 100; watercolor stays silent.

Output: probe scenario `edge-transparency` with two pre-change identity baselines; twin + exponent map + three uniforms in the package; the one fragment edit; canonical params, medium records and two app rows; package and app test suites green; probe sweep green; UAT rows 1-9 handed off.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@SPECS/v2.2.0-medium-engine/GSD-QUICK-PROMPT-10-edge-transparency.md
@.planning/quick/261124-ujb-read-specs-v2-2-0-medium-engine-gsd-quic/261124-ujb-CONTEXT.md
@.planning/quick/261124-ujb-read-specs-v2-2-0-medium-engine-gsd-quic/261124-ujb-RESEARCH.md

Key anchors at HEAD d509a886d (verified in research):
- `shaders.ts:1226` `float featherFade = 1.0;` … `:1298` `featherFade *= alongFade * trailSupport;` … `:1303-1306` the four `*= featherFade` multiplies. The lateral film multiplies `featherFade` before those four lines.
- `shaders.ts:1080-1086` the `Gathered` struct ends `float alpha;` — append `float film;`.
- `shaders.ts:1089-1094` the struct init (`g.coverage = 0.0; … g.alpha = 0.0;`) — add `g.film = 1.0;` there, and at both early returns (`:1102`, `:1142`) the struct is returned from that init so `film` is already 1.
- `shaders.ts:952-1012` uniform declarations (`uFeatherEdge` at 963); `Engine.ts:3603-3686` `bindGather` (`uFeatherEdge` bound at 3625).
- `shaders.ts:1379-1390` deposit halves — attenuation `oA = vec4(a); oB = vec4(a);` (1383-1384, UNTOUCHED), carried `oA = cA * a; oB = vec4(cB * a, uScatter * a);` (1389-1390) — the ONLY shader arithmetic edit is the `uScatter * a * g.film` on line 1390.
- `shaders.ts:1161-1211` threshold block — untouched. `:1212-1225` the rejection precedent comment — untouched.
- `bristles.ts:367-399` helpers + `gatherSoftness` (the twin pattern). `:401+` the pure-twin section.
- `mediums.ts:119-141` acrylic record literal; `mediums.test.ts:61` the fourteen-key pin; `:17-32` the `MEDIUM_KEYS` literal.
- `aquarelleRecordState.ts:121-157` `AQUARELLE_GLOBAL_KEYS` (16) + `DEFAULT_AQUARELLE_PARAMS`; `:234-248` `applyAquarelleMedium` compare-then-write spread.
- `aquarelleParamVisibility.ts:116` `BRISTLE_MEDIA`; `:177` the Feather row; `:134-138` the row-count comment.
- Probe: `probe.ts` scenario dispatcher `resolvedBrush` chain (`bristle-flat` for `bristle-line` / `bristle-tip`); `run.mjs` closed `--scenario` list; `compare.mjs:156` `FIELDS` + `SCENARIO_INVARIANTS` + `scenarioInvariantFailures`.

Sequential execution on the main tree — no worktrees. Do not run the dev server. Never run vitest in watch mode.

Task ordering is load-bearing: Task 1 must capture the two identity baselines BEFORE Task 2 changes the engine — that is the only window in which the pre-change engine still exists.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Probe scenario `edge-transparency` + pre-change identity baselines</name>
  <files>packages/efx-watercolor/probe/medium-engine/probe.ts, packages/efx-watercolor/probe/medium-engine/run.mjs, packages/efx-watercolor/probe/medium-engine/compare.mjs, packages/efx-watercolor/probe/medium-engine/harness.test.ts, packages/efx-watercolor/probe/medium-engine/baselines/edge-transparency-neutral.json, packages/efx-watercolor/probe/medium-engine/baselines/edge-transparency-neutral-broad.json</files>
  <action>
Add the `edge-transparency` probe scenario and its comparator, then capture both identity baselines from the UNMODIFIED engine. This task is data + harness only — it must not touch `src/`.

1. `probe.ts` — extend the closed scenario list in `readScenario` with `edge-transparency`, and extend the `resolvedBrush` chain so `edge-transparency` resolves to `'bristle-round'` (the `bristle-flat` brush was deleted by quick 261124-iq9; old bristle scenarios that silently fall back are out of scope — do not re-baseline them). The chain only drives the report echo: the scenario's script entry MUST stamp `brushId: 'bristle-round'` literally (the way `bristleTipScript` carries its own `brushId`), because `toStudioStroke` stamps `entry.brushId ?? BRUSH_ID` and `BRUSH_ID` is `'round'` — a NON-bristle preset — and `presetFor` silently resolves any unknown id (like the now-deleted `bristle-flat`) to `round`. A `round` stroke never runs `gatherBristle`, so the lateral film would never execute and the identity baselines would prove nothing. Add two scenario-only knobs, `edgeAmount` and `edgeFalloff` (integers 0..100), parsed like the existing `readSize`/`readEmboss` knobs and rejected on any other scenario. Reuse the LINE geometry constants and `straightLine` exactly as `bristle-tip` does; build the params bag from the acrylic record via `bristleLineParams(...)` and fold `edgeFade: edgeAmount, edgeFalloff` into `entry.params` so they ride the existing loose params bag (no new `ScriptEntry` field). The report block must emit `brush`, `strokeBrush` (the script entry's own `brushId` — the live-response proof, distinct from the `resolvedBrush` echo), `width`, `edgeAmount`, `edgeFalloff`, `edgeAcross { offsets, cover, ink }` from `lineProfileSet(engine)`, and `edgeTiling { enclosed }` reusing the existing lane bars. Record body 100 in the params bag so the S law is exercised.

   **Visible-alpha contract (blocker).** This capture is a BRISTLE capture: `beginBristles` sets `bristleContent`, so `drawDisplay` binds `uFilmBlur = BRISTLE_FILM_BLUR` and `displayFS` mode 4 shades RGB but not alpha — exported RGB and pigment alpha disagree at the fringe BY DESIGN (`alphaLaw.ts:111-119`). The probe's visible-alpha selection (`probe.ts:3559`, currently `scenario.startsWith('bristle-')`) MUST report `BRISTLE_VISIBLE_ALPHA_SKIP` for `edge-transparency`, and the comparator's bristle detection (`compare.mjs:220`, same prefix) MUST accept that skip for this capture — otherwise every mode-1 identity compare and all three `--differs-from` sweeps fail on the alpha-law contract. Introduce ONE shared capture-type predicate used by BOTH files — e.g. `isBristleCapture(scenario) = scenario.startsWith('bristle-') || scenario === 'edge-transparency'`, or derive the type from the scenario's `strokeBrush` — so the probe and the comparator can never disagree. Do NOT weaken the comparator's refusal of a skip for a non-bristle capture, and do NOT rename the scenario (the spec fixes its name).

2. `run.mjs` — add `edge-transparency` to the closed `--scenario` literal list (the echoed usage message too, keeping the substrings the harness pins), and add `--edge` / `--falloff` operand parsing (integers 0..100, valid only with the new scenario) passed into the page query the same way `--size`/`--body` are.

3. `compare.mjs` — add `SCENARIO_INVARIANTS['edge-transparency'] = edgeTransparencyFailures` and implement it with the reference-aware signature `(actual, reference)`. Calibrate the visible silhouette from the REFERENCE cover profile: the largest `|offset|` whose cover is at least 2 % of `peakCover`, taken as the min of the left and right sides, guarded to at least 8 px. Sample three stations — core at offset 0, mid at `round(0.775 * silhouette)`, rim at `silhouette` — from both the `cover` and `ink` arrays. The `cover` array carries the asserted film bars (it is the coverage channel — the film `gatherBristle` scales): core 1 (bar ±0.02); mid `1 - amount * 0.5 ** e`; rim `1 - amount`, where `amount = actual.edgeAmount / 100`, `b = actual.edgeFalloff / 100`, `e = 2 ** (2 * b - 1)`, tolerances ±0.12. The `ink` array is supporting evidence only: report it in the failure message and assert direction only (ink at the rim strictly below ink at the core when `amount > 0`) — it is a seven-channel pigment sum that mixes colour coefficients, so it does not carry the ratio bars. Require `actual.strokeBrush === 'bristle-round'` (the stroke's own id — the `brush` echo reflects `resolvedBrush`, not the stroke) and `actual.brush === 'bristle-round'` and `actual.width === reference.width`. Reuse the three existing ENCLOSED lane bars (`ENCLOSED_MEAN_MAX_PCT`, `ENCLOSED_FRAC_MAX_PCT`, `ENCLOSED_MAX_RUN_PX`) on the new profile. The per-capture mid bar already separates the three falloff shapes (0.293 / 0.5 / 0.75 differ by more than 0.2), so do not add cross-capture machinery. Use the same shared capture-type predicate as `probe.ts` for the `alphaLawFailures` bristle branch (`compare.mjs:220`) — the two sides must agree on which captures are bristle captures.

4. `harness.test.ts` — RED first. Update the `resolvedBrush` literal pin (it currently lists the old chain) to include the new branch, extend the closed-list substring pins for `edge-transparency`, and add source pins that the scenario emits `edgeAmount` / `edgeFalloff` / `edgeAcross` / `edgeTiling`, and that `edgeTransparencyFailures` exists with the reference-aware signature and the three station bars. Also pin the new script's own `brushId: 'bristle-round'` literal (the way the `bristle-edge` block pins `bristleTipScript`'s literal at `:736`) and the report's `strokeBrush` echo, plus that the invariant requires `strokeBrush` to equal `'bristle-round'` — the `resolvedBrush` pin alone proves only the echo, not the stroke. Finally, replace the literal pin at `harness.test.ts:453` (`scenario.startsWith('bristle-')`) with the shared capture-type predicate and pin the alpha-law contract in BOTH directions: (a) the `edge-transparency` capture reports `visibleAlphaSkip` (the `BRISTLE_VISIBLE_ALPHA_SKIP` reason) with `visibleAlphaMaxDelta === null` and `visibleAlphaSamples === 0`, and `alphaLawFailures` accepts it; (b) a non-bristle capture carrying a skip is still refused; (c) a bristle capture reporting a delta beside its skip is still refused.

5. Capture the two identity baselines from the current HEAD engine, BEFORE any `src/` change. The gate name is the capture filename: `run.mjs --gate <name>` writes `/tmp/medium-engine/<name>.json`, and `compare.mjs <gate>` (mode 1) compares that capture against the committed `probe/medium-engine/baselines/<gate>.json` — so capture, copy into `baselines/`, then re-capture and compare to prove reproducibility:
   - `node packages/efx-watercolor/probe/medium-engine/run.mjs --gate edge-transparency-neutral --scenario edge-transparency --edge 0 --falloff 0 --size 1080`, copy `/tmp/medium-engine/edge-transparency-neutral.json` → `packages/efx-watercolor/probe/medium-engine/baselines/edge-transparency-neutral.json`;
   - `node packages/efx-watercolor/probe/medium-engine/run.mjs --gate edge-transparency-neutral-broad --scenario edge-transparency --edge 0 --falloff 100 --size 1080`, copy → `packages/efx-watercolor/probe/medium-engine/baselines/edge-transparency-neutral-broad.json`.
   Add provenance fields to both (`capturedFromCommit` = current HEAD short sha, `capturedAt` = ISO date, `kind`, and a `note` stating these are pre-change identity baselines for amount 0 in silhouette units). Mirror the `neutral-identity.json` provenance shape. Both captures must carry `visibleAlphaSkip` (the bristle reason) with `visibleAlphaMaxDelta: null` and `visibleAlphaSamples: 0` — verify this before committing the baselines; a real delta here means the capture-type predicate is not wired. Then re-run each gate from a clean `/tmp` and `compare.mjs <gate>` must pass — both mode-1 checks must be green at this point (the engine is unchanged, so the only thing under test is probe determinism).
  </action>
  <verify>
    <automated>pnpm --dir packages/efx-watercolor exec vitest run probe/medium-engine/harness.test.ts && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate edge-transparency-neutral --scenario edge-transparency --edge 0 --falloff 0 --size 1080 && node packages/efx-watercolor/probe/medium-engine/compare.mjs edge-transparency-neutral && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate edge-transparency-neutral-broad --scenario edge-transparency --edge 0 --falloff 100 --size 1080 && node packages/efx-watercolor/probe/medium-engine/compare.mjs edge-transparency-neutral-broad</automated>
  </verify>
  <done>
  Both closed lists contain `edge-transparency`; the scenario's script entry stamps `brushId: 'bristle-round'` (a live bristle response — `gatherBristle` and the lateral film actually run) and the report echoes it as `strokeBrush`, resolves `bristle-round` at size 1080, and reports `edgeAmount`, `edgeFalloff`, `edgeAcross { offsets, cover, ink }` and `edgeTiling.enclosed`. Both mode-1 identity comparisons pass against baselines captured from the unmodified engine, and both baseline files carry provenance. Both captures report the bristle `visibleAlphaSkip` with no delta/samples, the probe and the comparator agree through one shared capture-type predicate, and `harness.test.ts` is green including the updated `resolvedBrush` pin and the three alpha-law direction pins. No file under `packages/efx-watercolor/src/` or `app/src/` was modified.
  </done>
</task>

<task type="tdd">
  <name>Task 2: Package core — twin, uniforms, gather film, one deposit edit</name>
  <files>packages/efx-watercolor/src/playground/bristles.ts, packages/efx-watercolor/src/playground/bristles.test.ts, packages/efx-watercolor/src/playground/params.ts, packages/efx-watercolor/src/playground/params.test.ts, packages/efx-watercolor/src/playground/Engine.ts, packages/efx-watercolor/src/playground/shaders.ts, packages/efx-watercolor/src/playground/scattering.test.ts</files>
  <action>
RED → GREEN, tests first.

RED (write failing tests):
- `bristles.test.ts` — a `bristleEdgeFilm` describe pinning all three anchors: at `lateral = BRISTLE_EDGE_START` the film is 1 for every amount and falloff; at `lateral = 1` (silhouette) it is `1 - amount`; at the fade midpoint it is 0.5 / 0.293 / 0.75 for amount 1 and falloff 50 / 0 / 100 (use `toBeCloseTo`, matching the existing twin describes). Pin amount 0 inert for all three falloffs, `film(0) = 1` at every combo, and non-finite inputs (`NaN`, `Infinity`) returning the neutral 1. Pin the spec's monotone gate: for amount > 0, `film` is non-increasing across a lateral sweep 0 → 1 (about 20 steps) at every falloff 0 / 50 / 100 (each sample no greater than the previous, + 1e-9 slack). Add a constants-declaration scan for `BRISTLE_EDGE_START`, `BRISTLE_EDGE_EXP_MIN = 0.5`, `BRISTLE_EDGE_EXP_MAX = 2`, and an `edgeFalloffExponent` describe pinning 0 → 0.5, 50 → 1, 100 → 2 and monotonicity between. Document in the twin's JSDoc that `lateral` is in SILHOUETTE units — 1 is the visible rim, not the nominal footprint.
- `params.test.ts` — canonical → engine mapping for `edgeFade` (0 → 0, 50 → 0.5, 100 → 1, default 0) and `edgeFalloff` (0 → 0, 50 → 0.5, 100 → 1, default 0.5), written as literal expectations like the existing size-mapping tests. Also extend the existing full-object pin at `params.test.ts:66-68` — the 'maps the seven canonical globals onto 0..1' test asserts the WHOLE `toEngineParams(...)` result with a 16-key `.toEqual` literal ending `wetSeconds: 7` — adding `edgeFade: 0, edgeFalloff: 0.5` (the default case for that input), or convert it to per-key assertions; `toEqual` is exact-key, so the two new return keys otherwise turn the package suite red.
- `scattering.test.ts` — source pins: the three uniforms declared in the BRISTLE_GATHER uniform block and all three bound in `bindGather` from `this.params`; `featherFade *= edgeFilm` present; `g.film = edgeFilm` present; `g.film` on the S term of `bristleDepositFS`; the `Gathered` struct carries `float film`; and negative pins that the attenuation half of `bristleDepositFS` contains NO `g.film` (slice the attenuation half between its own boundaries) and that the threshold block (the slice before the rejection comment) contains no edge factor. Also pin that `bristleCoverFS` source is unchanged in its target line and that no `uEdge` identifier appears in the relief or touch programs.

GREEN (implement):
1. `bristles.ts` — in the trace/edge constants section added by 64-23, add `BRISTLE_EDGE_START = 0.55`, `BRISTLE_EDGE_EXP_MIN = 0.5`, `BRISTLE_EDGE_EXP_MAX = 2`. Add `edgeFalloffExponent(bias) = 2 ** (2 * bias - 1)` clamped to the exp bounds, and the pure twin `bristleEdgeFilm(lateral, amount, falloff)` beside `gatherSoftness`, mirroring its style: neutral 1 on non-finite input or amount <= 0; `u = clamp01(lateral)` (silhouette units); `t = clamp((u - START) / max(1 - START, 1e-4), 0, 1)`; `1 - amount * t ** exponent`. State in the JSDoc that cells beyond the silhouette clamp to the full rim factor by design — at amount 100 they go inert and the edge narrows; that is intended, not a threshold change.
2. `params.ts` — `AquarelleCanonicalParams.edgeFade` / `.edgeFalloff` (0..100), defaults 0 / 50 in `DEFAULT_CANONICAL_PARAMS`, and `toEngineParams` emitting `clamp01(num(…, default) / 100)` for both. No other change.
3. `Engine.ts` — `Params.edgeFade` (default 0) and `Params.edgeFalloff` (default 0.5) in the interface and `DEFAULT_PARAMS`. In `bindGather`, bind `uEdgeStart` from `BRISTLE_EDGE_START`, `uEdgeFade` from `this.params.edgeFade`, `uEdgeFalloff` from `this.params.edgeFalloff` (the constant for the start, params for the other two) — bound unconditionally so every consumer gets them.
4. `shaders.ts` — three edits only, no others: (a) declare `uEdgeStart`, `uEdgeFade`, `uEdgeFalloff` in the BRISTLE_GATHER uniform block next to `uFeatherEdge`; (b) append `float film;` to the `Gathered` struct and initialise `g.film = 1.0;` in the struct init so both early returns carry the neutral 1; (c) immediately before `featherFade *= alongFade * trailSupport;` compute the lateral film in SILHOUETTE units — `float edgeU = clamp(lateral / max(uFeatherEdge, 1e-4), 0.0, 1.0);` then `t`, `e = exp2(2.0 * uEdgeFalloff - 1.0)`, and `float edgeFilm = uEdgeFade <= 0.0 ? 1.0 : 1.0 - uEdgeFade * pow(t, e);` — then `featherFade *= edgeFilm;` and `g.film = edgeFilm;`. Add a short GLSL comment stating that cells beyond the silhouette clamp to the full rim factor by design (they go inert at amount 100 and the edge narrows — intended, not a threshold change) so a later reader does not "fix" it. Do NOT touch the threshold block, do NOT add a fade to the attenuation half, do NOT edit `bristleCoverFS`, `bristleReliefFS` or `bristleTouchFS`.
5. `shaders.ts` — the single arithmetic edit in `bristleDepositFS`: change the carried S term from `uScatter * a` to `uScatter * a * g.film`. Nothing else on those lines changes.
  </action>
  <verify>
    <automated>pnpm --dir packages/efx-watercolor exec vitest run && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate edge-transparency-neutral --scenario edge-transparency --edge 0 --falloff 0 --size 1080 && node packages/efx-watercolor/probe/medium-engine/compare.mjs edge-transparency-neutral && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate edge-transparency-neutral-broad --scenario edge-transparency --edge 0 --falloff 100 --size 1080 && node packages/efx-watercolor/probe/medium-engine/compare.mjs edge-transparency-neutral-broad</automated>
  </verify>
  <done>
  The twin, the exponent map and the three constants exist and pass their describes; `edgeFalloffExponent` reads 0.5 / 1 / 2 at bias 0 / 50 / 100. Canonical params map 0/50/100 → 0/0.5/1 with defaults 0 and 50. `bindGather` binds all three uniforms for every consumer. The gather carries `film`, initialises it to 1, multiplies `featherFade` once, and the deposit's S term carries `g.film` — with the attenuation half, threshold block, cover, relief and touch programs untouched (pinned negatively). The full package vitest suite is green, and both amount-0 probe captures are still byte-identical to the pre-change baselines — proving the change is inert at amount 0 (UAT row 1 automated proxy).
  </done>
</task>

<task type="auto">
  <name>Task 3: Medium records, app rows, app pins, and the probe sweep</name>
  <files>packages/efx-watercolor/src/playground/mediums.ts, packages/efx-watercolor/src/playground/mediums.test.ts, app/src/components/physic-paint/view/aquarelleRecordState.ts, app/src/components/physic-paint/view/aquarelleParamVisibility.ts, app/src/components/physic-paint/view/mediumSelection.test.ts, app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts, app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts, app/src/components/physic-paint/view/brushGroupMedium.test.ts</files>
  <action>
1. `mediums.ts` — extend `MediumParamKey` with `'edgeFade'` and `'edgeFalloff'`. Append `edgeFade: 0, edgeFalloff: 50` as the last two keys of the acrylic record literal (after `wetSeconds`). The watercolor record is NOT a spread of the acrylic literal: `WATERCOLOR_PARAMS` (`mediums.ts:67-82`) is a field-by-field derivation literal typed `Readonly<Record<MediumParamKey, number>>`, so name the two entries it needs explicitly, derived not retyped: `edgeFade: DEFAULT_CANONICAL_PARAMS.edgeFade,` and `edgeFalloff: DEFAULT_CANONICAL_PARAMS.edgeFalloff,` — omitting them fails `tsc` against the `Record` type and the derivation pin at `mediums.test.ts:167-181`. Update the "fourteen keys" header comments to sixteen.
2. `mediums.test.ts` — extend the `MEDIUM_KEYS` literal with both keys and rename/extend the key pin from fourteen to sixteen; append `edgeFade: 0, edgeFalloff: 50` to every record `toEqual` literal at the same position as the record (JSON.stringify order matters).
3. `aquarelleRecordState.ts` — add `edgeFade` and `edgeFalloff` to `AquarelleGlobalParams`, add `DEFAULT_AQUARELLE_PARAMS` 0 / 50, and append both keys at the end of `AQUARELLE_GLOBAL_KEYS` so the snapshot loop and the selection-write allowlist carry them automatically. No other change — `applyAquarelleMedium`'s compare-then-write spread and the panel's Reset spread already handle record keys generically (D-01/D-03 need no new code).
4. `aquarelleParamVisibility.ts` — add two rows in the `edge` group immediately after Feather: `{ key: 'edgeFade', label: 'Edge transparency', group: 'edge', paint: BRISTLE_MEDIA }` and `{ key: 'edgeFalloff', label: 'Edge falloff', group: 'edge', paint: BRISTLE_MEDIA }`. Update the row-count prose comment from thirteen to fifteen. No new UI component — both render through the existing `GlobalSlider`, whose 0 / 50 / 100 are the three named shapes.
5. Update the app pins (write them first, then the code above makes them pass): `mediumSelection.test.ts` — the 16-key pin at :119 and the second literal list at :141-159 grow to 18, the "fourteen" comment at :262 becomes sixteen, and the snapshot/allowlist tests gain assertions that the two new keys round-trip; `aquarelleParamVisibility.test.ts` — the acrylic key union at :47 gains `edgeFade|edgeFalloff`, the counts test at :108-114 goes P-A 4 → 6, and the 13-row literal at :208-225 becomes 15 rows with the two new rows inserted directly after `feather`; `AquarelleGlobalsPanel.test.ts` — the Gouache labels pin at :871-884 becomes `['Pigment', 'Pickup', 'Dry speed', 'Feather', 'Edge transparency', 'Edge falloff']`, and BOTH reset fixtures (:215-235 and :240-255) gain `edgeFade: 0, edgeFalloff: 50` appended in record order; `brushGroupMedium.test.ts` — its own `MEDIUM_KEYS` literal grows by both keys (and the "ten of the fourteen" comment, if present at HEAD, becomes the corrected count).
6. Run the app gates, then the probe sweep at the three non-neutral points. Each sweep runs under its own gate name and compares with `compare.mjs <gate> --differs-from edge-transparency-neutral` — which resolves the committed neutral baseline as its reference (committed wins over `/tmp`), requires all three digests to differ, and runs `edgeTransparencyFailures(actual, reference)` on the station bars (core unchanged, rim at `1 - amount`, mid at the falloff's exponent, no lane).
  </action>
  <verify>
    <automated>pnpm --dir packages/efx-watercolor exec vitest run && pnpm --dir app exec vitest run && pnpm --dir app exec tsc --noEmit && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate edge-transparency-broad --scenario edge-transparency --edge 100 --falloff 0 --size 1080 && node packages/efx-watercolor/probe/medium-engine/compare.mjs edge-transparency-broad --differs-from edge-transparency-neutral && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate edge-transparency-linear --scenario edge-transparency --edge 100 --falloff 50 --size 1080 && node packages/efx-watercolor/probe/medium-engine/compare.mjs edge-transparency-linear --differs-from edge-transparency-neutral && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate edge-transparency-rim --scenario edge-transparency --edge 100 --falloff 100 --size 1080 && node packages/efx-watercolor/probe/medium-engine/compare.mjs edge-transparency-rim --differs-from edge-transparency-neutral</automated>
  </verify>
  <done>
  Both records carry `edgeFade: 0, edgeFalloff: 50` as their last two keys — the acrylic literal states them, the watercolor record derives them from `DEFAULT_CANONICAL_PARAMS` (also 0 / 50); the key pin, the record literals and the header comments read sixteen. `AQUARELLE_GLOBAL_KEYS` and `DEFAULT_AQUARELLE_PARAMS` carry both keys, so Reset restores 0 / 50 and re-picking a medium resets them (D-01/D-03). The two rows render for Gouache only — absent for watercolor and the Water tool. Package vitest, app vitest and `tsc --noEmit` are green. The three sweep captures at (100, 0), (100, 50), (100, 100) all differ from the neutral baseline on every digest and pass the station bars: core unchanged, rim at `1 - amount`, mid at the falloff's exponent, band clean. Automated-ready; UAT rows 1-9 are the human hand-off.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user input → canonical params | param values are integers from a slider; already clamped by `clamp01(num(…)/100)` |
| canonical params → GL uniforms | values cross into shader arithmetic; non-finite or out-of-range would poison the film |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261124-01 | Tampering | `bristleEdgeFilm` / gather GLSL | low | mitigate | Both the twin and the GLSL guard non-finite and amount <= 0 to the neutral 1; `max(1.0 - uEdgeStart, 1e-4)` and `max(uFeatherEdge, 1e-4)` prevent divide-by-zero; `clamp01` bounds `lateral`. |
| T-261124-02 | Tampering | `toEngineParams` edgeFade / edgeFalloff | low | mitigate | `clamp01(num(value, default) / 100)` mirrors every other canonical param; non-numeric falls back to the documented default (0 / 50). |
| T-261124-03 | Denial of service | `pow(t, e)` per gather fragment | low | accept | One `pow` against a 5-bristle gather loop measured as noise on the probe; guarded at `t = 0` and `e = 0.5` (twin pins). |
| T-261124-04 | Information disclosure | probe captures in `/tmp/medium-engine/` | low | accept | Local, transient, same as every existing probe gate; no secrets. |
| T-261124-SC | Tampering | package installs | low | accept | No new packages in this task; the supply-chain gate does not fire. |
</threat_model>

<verification>
- `pnpm --dir packages/efx-watercolor exec vitest run` — twin anchors, exponent map, param mapping, source pins (uniforms declared+bound, `featherFade *= edgeFilm`, `g.film` on S, no second fade in the attenuation half, no edge factor on the threshold, cover/relief/touch untouched), medium record literals, probe harness pins.
- `pnpm --dir app exec vitest run` — key pins, row visibility, count and literal pins, Gouache labels, both reset fixtures, medium re-pick.
- `pnpm --dir app exec tsc --noEmit` — the widened interfaces compile.
- Probe: two mode-1 identity checks at amount 0 against the pre-change baselines (byte equality, UAT row 1 automated proxy); three `--differs-from` sweeps at (100, 0), (100, 50), (100, 100) with the station bars and lane bars.
- Out of scope: old bristle scenarios whose baselines are unreproducible after the `bristle-flat` deletion — do not re-baseline.
- Never run the dev server; never run vitest in watch mode.
</verification>

<success_criteria>
- The twin's three anchors and the landmark table are pinned in package tests; `edgeFalloffExponent` reads 0.5 / 1 / 2.
- `gatherBristle` multiplies `featherFade` by one lateral `edgeFilm`, exposes it as `g.film`, initialises it to 1 on every return path, and the deposit's S term carries it — with the attenuation half, threshold, cover, relief and touch untouched.
- `bindGather` binds the three uniforms for every consumer; the package compiles.
- Both params are canonical (canonical params → engine params → `AQUARELLE_GLOBAL_KEYS` / defaults), live in both medium records with 0 / 50, restore on Reset, and reset on re-pick.
- Both rows are acrylic-only and render through the existing `GlobalSlider`.
- Amount 0 is byte-identical to pre-change (probe mode 1); the three non-neutral sweep points satisfy the station bars.
- Package vitest, app vitest and `tsc --noEmit` green. UAT rows 1-9 handed off — do not claim UAT done.
</success_criteria>

<output>
Create `.planning/quick/261124-ujb-read-specs-v2-2-0-medium-engine-gsd-quic/261124-ujb-SUMMARY.md` when done
</output>
