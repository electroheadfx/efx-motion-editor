# Quick Task 261124-ujb — Edge transparency and falloff for the Brush family: Research

**Researched:** 2026-11-24
**Domain:** efx-watercolor bristle gather (GLSL) · canonical params + medium records · app paint panel · probe/medium-engine pixel gate
**Measured at:** HEAD `d509a886d` (the spec's anchors were written against `284b174e8`)
**Confidence:** HIGH on every anchor and seam; MEDIUM on one geometry decision (finding 9) the planner must resolve explicitly

## Summary

The spec's law is implementable exactly as written, at the seam it names: `featherFade` in `gatherBristle` already scales coverage and the carried coefficients/alpha together, and every gather consumer reads that one snippet. The deposit's scattering write (`oB = vec4(cB * a, uScatter * a)`) is the only fragment edit; `bristleCoverFS`, `bristleReliefFS` and the threshold block need no edit and follow automatically. All params plumbing is mechanical and matches `feather`.

Two findings change the plan materially:

1. **Probe regression.** `bristle-flat` was deleted by quick 261124-iq9 (only `bristle-round`, `pen`, and the non-bristle presets remain). Every existing bristle probe scenario (`bristle-edge`, `bristle-wet`, `bristle-line`, `bristle-tip`, `bristle-end`) still names `bristle-flat` and now replays an unknown id, which `brushBridge.presetFor` silently resolves to `round` (`brushBridge.ts:86-89`) — a NON-bristle stroke. Their committed baselines are unreproducible at HEAD. The new `edge-transparency` scenario must pin `bristle-round` itself, and its neutral baseline must be captured **before** the engine changes.
2. **Silhouette geometry.** `BRISTLE_FEATHER_EDGE = 0.66` places the visible silhouette at 0.66 of the nominal footprint radius, and the shipped threshold law anchors on exactly that coordinate (`shaders.ts:1184-1185`). The spec's literal `u = clamp(abs(across), 0, 1)` uses the NOMINAL radius, so with `uEdgeStart = 0.55` the visible rim would never reach `1 − amount` (it would read ≈0.51 / 0.76 / 0.94 for falloff 0 / 50 / 100 at amount 100). Normalizing the lateral coordinate by the already-bound `uFeatherEdge` uniform makes all three twin anchors and the spec's landmark table land on the rim the artist sees.

**Primary recommendation:** implement the frozen law inside `BRISTLE_GATHER` at the caps' `featherFade` seam, with `u = clamp(lateral / uFeatherEdge, 0, 1)` reusing the shipped silhouette uniform; add the probe scenario and capture its neutral baseline first; then implement package → records/app; then capture and compare.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Medium record placement**
- `edgeFade` and `edgeFalloff` live INSIDE the Gouache/Pen medium records (`mediums.ts`), carrying defaults 0 and 50.
- Reset restores 0 / 50; re-picking a medium resets both (D-03), same as every other medium param.
- The medium record stays the source of truth; update the key pin in `mediums.test.ts` (sixteen keys).

**Falloff direction**
- Slider 0 = broad (transparency reaches mid-width), 50 = linear, 100 = rim (fade hugs the silhouette).
- Exponent map stays `edgeFalloffExponent(bias) = 2^(2b - 1)` → 0.5 / 1 / 2.
- Do not invert; do not add a second curve.

### Claude's Discretion
- Exact research path for the probe scenario and baseline captures.
- Whether `preInk`-style transient targets are needed (they are not — this is a gather-time factor).
- Test file placement, following existing source-pin patterns.

### Deferred Ideas (OUT OF SCOPE)
None stated in CONTEXT.md. The spec's `## Non-goals` list applies verbatim as out of scope: uniform/global opacity, any alpha-law change (`alpha = darkness`, `displayFS` mode 4, `rasterAlpha.ts`), Body-as-transparency, a curve-type enum, and changes to Watercolor / Water / Pen / Lift / Feather / emboss / dry-edge-takeoff laws.

Note: the two medium records are `watercolor` and `acrylic` (displayed "Gouache"); "Gouache/Pen" are the two bristle *brushes*, and both ride the acrylic record. The spec's step 3 says "both records carry **0** and **50**" — i.e. both medium records gain the two keys.
</user_constraints>

## Anchor re-verification

Every spec anchor re-checked against `d509a886d`. "No drift" = the spec's file:line still points at the described code.

| Spec claim | Current anchor at HEAD | Drift |
|---|---|---|
| `featherFade` scales coverage AND cA/cB/alpha (`shaders.ts:1298-1306`) | `shaders.ts:1298` and `shaders.ts:1303-1306` | No drift |
| Rejection precedent comment (`shaders.ts:1224-1229`) | `shaders.ts:1212-1225` (the quoted sentences at 1215-1225; `float featherFade = 1.0;` at 1226) | 2-4 lines up; content identical |
| `Gathered` struct / `gatherBristle` | `shaders.ts:1080-1086` / `1088-1311`; `float across = q.x;` at `1098` | Located (spec gave no line) |
| Deposit attenuation half (`shaders.ts:1379-1384`) | `shaders.ts:1379-1384` | No drift |
| Scattering write (`shaders.ts:1389-1390`) | `shaders.ts:1385-1391` (`oB = vec4(cB * a, uScatter * a);` at 1390) | No drift |
| `bristleCoverFS` needs no edit (`shaders.ts:1410-1440`) | `shaders.ts:1410-1440`; `float target = a * uCoverTarget * g.alpha;` at 1424; `o0 = vec4(target, 0.0, 0.0, a);` at 1439 | No drift |
| `bristleDepositFS` / relief / touch | deposit `1336`, relief `1449` (`gatherBristle(vUv).coverage` at 1459), touch `1492-1499` | Located |
| `Engine.bindGather` (`Engine.ts:3603-…`) | begins `Engine.ts:3603`, ends `3686`; `uFeatherEdge` already bound at 3625 | No drift |
| bindGather consumers | `Engine.ts:3185` (relief deposit), `3220` (relief erode), `3727` (ink deposit), `3757` (cover) | 4 call sites, all via the one binder |
| `gatherSoftness` twin pattern (`bristles.ts:390-399`) | `bristles.ts:389-399` | No drift |
| `params.ts` canonical + mapping | interface `27-88`, defaults `90-107`, `toEngineParams` `185-212` (`feather: clamp01(num(p.feather, d.feather) / 100)` at 204) | No drift |
| `Engine.ts` Params / DEFAULT_PARAMS | `116-133` / `135-148` | Located |
| `mediums.ts` key union / records | `MediumParamKey` `34-48`; watercolor record derives defaults `67-82`; acrylic literal `113-142` | Located |
| `mediums.test.ts:61` key pin | line 61, `it('carries exactly the fourteen medium keys and never size or lift', …)`; literal list `MEDIUM_KEYS` at 17-32 | No drift |
| `AQUARELLE_GLOBAL_KEYS` line 121 | `aquarelleRecordState.ts:121-138` (16 keys); `AquarelleGlobalKey = keyof AquarelleGlobalParams` at 119; defaults `140-157` | No drift |
| Per-stroke bag carries new keys automatically | snapshot loop `aquarelleRecordState.ts:999`; selection-write allowlist check `1426` | Confirmed |
| `aquarelleParamVisibility.ts` edge group / `BRISTLE_MEDIA` | groups `94-101`; `BRISTLE_MEDIA` `116`; rows `139-189`, Feather row `177`; selectors `197-229` | Located |
| Studio top bar follows | `PhysicsPaintTopBar.tsx:472` gates only the `water` row through `isAquarelleParamRowVisible` — the bar is NOT a generic row enumerator | Caveat (see Integration gotchas) |
| Payload/codec needs nothing | `codec.ts:119` `if (!isRecord(engine['params'])) return false`; `scriptTimelineCodec.ts:734-742` writes `u32 count + key` for ANY key | Confirmed |
| Probe `medium-engine` harness | `run.mjs` (esbuild + headless Chrome), closed scenario list `run.mjs:304-310` and `probe.ts:3768-3777`; `compare.mjs` FIELDS `156` | Located |

## The law at the seams

### 1. The gather — where the multiply lands (`shaders.ts:1088-1311`)

- Add three uniforms to `BRISTLE_GATHER` (declarations `952-1012`): `uEdgeStart`, `uEdgeFade`, `uEdgeFalloff` (extend the block; the uniform names arrive by introspection in `bindGather`, so declaration + binding must land together).
- `Gathered` gains `float film;` (`1080-1086`). **Initialize `g.film = 1.0` in the struct's init block (1090-1094)**: two early returns bypass the fade computation and must stay neutral — `if (nearest < 0 || nearest >= count) return g;` (1102) and `if (inkSum <= 1e-4) return g;` (1142). Everything downstream discards on `a <= 1e-3`, but the `film(0) = 1` invariant should hold on every path the twin pins.
- Compute the factor after `lateral` exists (1163 `float lateral = abs(across);`) — e.g. immediately above `float featherFade = 1.0;` (1226) so the whole edge law reads in one place:
  - `float u = clamp(lateral / max(uFeatherEdge, 1e-4), 0.0, 1.0);` (see finding 9 — this is the one deviation from the literal snippet)
  - `float t = clamp((u - uEdgeStart) / max(1.0 - uEdgeStart, 1e-4), 0.0, 1.0);`
  - `float e = exp2(2.0 * uEdgeFalloff - 1.0);`
  - `float edgeFilm = uEdgeFade <= 0.0 ? 1.0 : 1.0 - uEdgeFade * pow(t, e);` — the early return keeps amount 0 inert by construction (no multiply arithmetic), exactly like the wet-gate idiom.
- Apply at the caps seam: `featherFade *= alongFade * trailSupport;` (1298) then `featherFade *= edgeFilm;`, or a single `featherFade *= alongFade * trailSupport * edgeFilm;` — the shipped block is:

```glsl
g.coverage = inked * featherFade;
g.cA *= featherFade;
g.cB *= featherFade;
g.alpha *= featherFade;
```
(`shaders.ts:1303-1306` — verified verbatim)

- `g.film = edgeFilm;` after that block (before the tip mask at 1309, which multiplies `g.coverage` only and must stay as-is).
- The threshold block (1161-1211) is untouched: the silhouette does not move, no speckle added or removed.

### 2. Deposit scattering — the one fragment edit (`shaders.ts:1336-1392`)

```glsl
if (uMode == 1) {
  oA = vec4(a);
  oB = vec4(a);
} else {
  oA = cA * a;
  oB = vec4(cB * a, uScatter * a);
}
```
(`shaders.ts:1379-1391` — verified verbatim)

Edit only the carried half's alpha channel: `oB = vec4(cB * a, uScatter * a * g.film);`. The attenuation half keeps writing the bare `a` it is handed — **no second fade there** (spec's explicit prohibition). Cost note: `a` already carries the film through `g.coverage`, so both halves compose as `dst·(1−a) + carried·a` with a rim-inert result at amount 100.

### 3. Cover — no edit (`shaders.ts:1410-1440`)

`float target = a * uCoverTarget * g.alpha;` (1424) — `a` and `g.alpha` are both film-scaled by the gather, so the endpoint is `uCoverTarget · g.alpha · edgeFilm` and the factor cancels in the lerp endpoint. `o0 = vec4(target, 0.0, 0.0, a);` (1439) likewise. Verified: no change needed.

### 4. Relief and touch — consequences, no edit

- `bristleReliefFS` (`1449-1466`) writes `uAmount * a` with `a = clamp(gatherBristle(vUv).coverage, 0.0, 1.0)` (1459) — the emboss thins at the rim automatically. No edit.
- `bristleTouchFS` (`1492-1499`) uses `weight = clamp(texture(uCover, vUv).x, 0.0, 1.0)` (1497) — a thinner rim is also a drier one (risk 6). No edit.

### 5. Engine binding (`Engine.ts:3603-3686`)

`bindGather` sets every uniform from constants/params; the precedent for a shipped silhouette constant is `gl.uniform1f(p.u.uFeatherEdge!, BRISTLE_FEATHER_EDGE);` at 3625, and the param precedent is `gl.uniform1f(p.u.uFeather!, clamp(this.params.feather, 0, 1));` at 3623. Add:
- `uEdgeStart` ← `BRISTLE_EDGE_START`
- `uEdgeFade` ← `clamp(this.params.edgeFade, 0, 1)`
- `uEdgeFalloff` ← `clamp(this.params.edgeFalloff, 0, 1)`

All four call sites (3185, 3220, 3727, 3757) inherit them. `bristleContent` is set at 3391; no display change is needed (see risk 5).

### 6. Params plumbing (mirror `feather`)

- `params.ts`: `AquarelleCanonicalParams` gains `edgeFade` / `edgeFalloff` (0..100, defaults 0 / 50); `DEFAULT_CANONICAL_PARAMS` gains the same; `toEngineParams` gains `edgeFade: clamp01(num(p.edgeFade, d.edgeFade) / 100)` and the same for falloff.
- `Engine.ts`: `Params` gains `edgeFade: number; edgeFalloff: number;`; `DEFAULT_PARAMS` gains `edgeFade: 0, edgeFalloff: 0.5` (engine units 0..1).
- Engine units: `edgeFalloff` 0.5 ↔ canonical 50 → `e = exp2(2·0.5 − 1) = 1` (linear). `edgeFade` 0 ↔ canonical 0 (inert).

### 7. Medium records (`mediums.ts`)

- `MediumParamKey` (34-48) gains `'edgeFade' | 'edgeFalloff'` after `'wetSeconds'`.
- Watercolor record derives from `DEFAULT_CANONICAL_PARAMS` (67-82) → add the two derived lines.
- Acrylic (Gouache) literal (113-142) → add `edgeFade: 0, edgeFalloff: 50`.
- Update the "fourteen keys" prose (header line 5, comment line 26) and `mediums.test.ts`: `MEDIUM_KEYS` (17-32) and the pin at 61 (name + list → sixteen).

### 8. App globals and rows

- `aquarelleRecordState.ts`: `AquarelleGlobalParams` gains `edgeFade` / `edgeFalloff`; `DEFAULT_AQUARELLE_PARAMS` gains `0` / `50`; append both to `AQUARELLE_GLOBAL_KEYS` (121-138). Because `AquarelleGlobalKey = keyof AquarelleGlobalParams` (119), the type and the key list stay coupled. The snapshot loop (999) and the selection-write allowlist (1426) then carry the keys automatically — no other record code.
- `aquarelleParamVisibility.ts`: two rows after Feather (177) in the `edge` group, both `paint: BRISTLE_MEDIA`: `{ key: 'edgeFade', label: 'Edge transparency', group: 'edge', paint: BRISTLE_MEDIA }` and `{ key: 'edgeFalloff', label: 'Edge falloff', group: 'edge', paint: BRISTLE_MEDIA }`. Update the "thirteen rows" comment (134-138) → fifteen.
- Both rows render through the existing `GlobalSlider` (`AquarelleGlobalsPanel.tsx:71`); Reset spreads the active record (`onReset` at 153-160), so 0 / 50 restore automatically. The rows disappear for watercolor and the Water tool through the existing filters (197-215), and the panel is mounted both in the editor and the Studio (`WatercolorModuleSection.tsx:17` ← `PhysicsPaintRightPanel.tsx:499`; `PhysicsPaintStudioView.tsx:23` mounts the same `MemoizedPhysicsPaintRightPanel`).

## Risks with evidence

**1 — The rejection precedent (pale lanes / band motifs).** The comment at `shaders.ts:1212-1225` records that every depth selector measured as a lane because a small deposit weight `a` gives the lerp a ~100 px memory. This law is the CAPS' pattern, not a depth fade: it multiplies coverage and the carried coefficients/alpha together (1303-1306) and is smooth and un-noised (no across noise, no cell, no per-dab seed). It is the `alongFade × trailSupport` mechanism applied laterally, i.e. the one depth family that survived (the caps). Residual risk is an along-stroke lane in the band — the probe must run the `lineProfileSet` enclosed-line/tiling detector (below). Fallback if a lane appears: scale the carried coefficients and the cover target only (drop the coverage multiply) and record that the rim then replaces same-sheet paint instead of being inert.

**2 — Falloff direction.** Locked in CONTEXT. Verify at UAT; if inverted, flip the exponent map one line, never add a curve.

**3 — Feather interaction (acrylic default Feather = 85).** The acrylic record states `feather: 85` (`mediums.ts:137`). The feather law raises the THRESHOLD between `featherStart` (≈0.46-0.54 nominal) and 0.66 nominal (`shaders.ts:1184-1185`), so the feathered fringe is exactly the region the new film fades. Both act on coverage semantics but on different quantities: the threshold decides where `inked` is 0/1, the film scales the surviving weight — no step at a threshold boundary by construction. Probe against the acrylic record's own numbers (the `bristleLineParams` pattern). Confirm at UAT row 9.

**4 — Caps seam.** `featherFade = alongFade × trailSupport` (1298) × `edgeFilm` is a plain product of independent one-dimensional profiles; the only double-fade risk is at the stroke's start/end where both are < 1. That is intended (the end fade already carries the film); verify visually at row 9 that the takeoff does not read as a hole. No code change.

**5 — Display terms.** `uEdgeDarken` is 0 whenever the sheet carries bristle content: `gl.uniform1f(p.u.uEdgeDarken, this.bristleContent ? 0 : 0.8);` (`Engine.ts:4243`) — no dark line can be produced by the edge detector on this mark. `uFilmBlur` is the constant `BRISTLE_FILM_BLUR` (0.35, `bristles.ts:237-244`) for bristle content (`Engine.ts:4252`): a display-only 5-tap soften of the paint film (`shaders.ts:1916-1928`). A new soft rim will be softened by the same one-texel blur as every bristle rim — acceptable, and it is one of the reasons the committed/live parity must be re-proven (the export path leaves `uUnderlayOn` off; the soften applies to both live and export display equally). No change proposed.

**6 — Wetness.** `bristleTouchFS` weight = the coverage channel (`shaders.ts:1497`), and `wetAt` = `exp(-age/wetSeconds) × clamp(uCover/uBodyFloor, 0, 1)` (`shaders.ts:804-810`). A thinner rim lowers cover → a drier rim → less pickup/smear exactly at the rim; the deposit's smear gate additionally requires `snapB.a/uBodyFloor ≥ 0.55..0.85` (`shaders.ts:1364`). Expected consequence: at high amount the rim picks up/smears less, so a wet-underlayer drag stops short of the silhouette. This is a visual UAT judgment (row 5/6), not a pin. No code change; document the behavior.

**7 — Medium record placement.** Locked in CONTEXT (records carry 0/50; re-pick resets; Reset restores). Evidence it works with zero extra code: `applyAquarelleMedium` spreads `record.params`, `onReset` spreads the record (AquarelleGlobalsPanel 153-160), and `bristleLineParams` in the probe spreads the same record. The cost is the test-fixture surface (see Test plan).

**8 — Curve cost / NaN.** One `pow` per gather fragment per consumer draw; the gather already runs 5-bristle loops with `noise1`/`smoothstep`, so one `pow` is noise (measure `bakeMs`/`renderMs` in the probe report — durations are printed, never compared). `pow(0.0, 0.5) = 0`, `pow(0,1)=0`, `pow(0,2)=0` — no NaN; `t` is clamped to [0,1] and `1 − uEdgeStart ≥ 0.45 > 0`, so the denominator guard `max(…, 1e-4)` is defensive only. The twin pins the guard.

**9 — Silhouette geometry (found in research; must be decided explicitly).** The shipped gather uses `float lateral = abs(across);` (`shaders.ts:1163`) in units of the NOMINAL footprint radius, and the mark's SILHOUETTE sits at `uFeatherEdge` = `BRISTLE_FEATHER_EDGE = 0.66` of it:

```ts
/**
 * Where the mark's SILHOUETTE sits, in fractions of the nominal bristle
 * footprint radius. The outer third of the footprint is intermittent bristle
 * spill: the reference's visible half-width measures ~0.66 of it (probe:
 * 19 px visible vs 29 px nominal at size 19). Studio's analytic edge anchors
 * here, so Feather opens the edge WITHOUT resizing the brush — an edge at
 * the full nominal radius made F0 50 % wider than F100 (measured: 29 px vs
 * 18.5 px) and the slider read as a size control.
 */
export const BRISTLE_FEATHER_EDGE = 0.66;
```
(`bristles.ts:227-236` — verified verbatim; bound as `uFeatherEdge` at `Engine.ts:3625`, declared `// silhouette radius, in nominal footprint units` at `shaders.ts:963`)

With the spec's literal `u = clamp(abs(across), 0, 1)` and `uEdgeStart = 0.55`, at the visible silhouette (u ≈ 0.66) `t = (0.66 − 0.55)/0.45 ≈ 0.244`, so at amount 100 the visible rim keeps ≈0.51 (falloff 0) / 0.76 (50) / 0.94 (100) of its film — the UAT rows 2-4 ("rim half-transparent", "fade hugs the silhouette", "inert rim") would read weak-to-invisible. What the spec DOES pin is "film at the silhouette is `1 − amount`" (Gates: "the twin's three anchors (film at `lateral = start` is 1; at the silhouette is `1 − amount` …)"), which forces the silhouette-normalized reading. **Recommendation:** `float u = clamp(lateral / max(uFeatherEdge, 1e-4), 0.0, 1.0);` — reuses the already-bound uniform, no new constant, and makes the landmark table exact in visible units (fade midpoint at u = 0.775 → 0.775·0.66 ≈ 0.51 nominal ≈ half the nominal radius). The twin `bristleEdgeFilm(lateral, amount, falloff)` should take `lateral` in SILHOUETTE units (1 = the visible rim) and document that. If the plan instead takes the literal nominal law, it must restate the twin anchors at nominal 1.0 and accept that the visible rim never reaches `1 − amount` — do not do both silently.

## Probe plan

**Harness.** `packages/efx-watercolor/probe/medium-engine/run.mjs` esbuild-bundles `probe.ts`, then runs headless Chrome:

```
node packages/efx-watercolor/probe/medium-engine/run.mjs --gate <name> --scenario <name> [flags]
```

writes `/tmp/medium-engine/<gate>.json` + PNGs; `compare.mjs` reads it against committed `probe/medium-engine/baselines/<gate>.json` on FIELDS (`compare.mjs:156`: 3 digests + digestPigment + byteLength + width + height + 5 alpha-law fields). Environment verified: Chrome present at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, node v24.15.0, pnpm 10.27.0.

**Lockstep lists.** `probe.ts:3768-3777` (`readScenario`) and `run.mjs:304-310` are literal-identical closed lists; both must gain `'edge-transparency'` in the same commit (the harness test at `probe/medium-engine/harness.test.ts:580` pins the resolved-brush literal and `:736` pins `brushId: 'bristle-flat'` in the edge script — both statements are now stale relative to `BRUSH_PRESETS` and must be handled by the scenario work).

**Scenario design (recommended).** One new scenario `edge-transparency`: a SINGLE straight horizontal `bristle-round` stroke at the `bristleLine` geometry (`LINE_Y 0.5`, `LINE_X0 0.15`, `LINE_X1 0.85` — `probe.ts:1754-1756`), params = the acrylic record spread (`bristleLineParams` pattern at 1834) plus explicit `edgeFade` / `edgeFalloff` folded from new operands (`--edge <0..100>`, `--falloff <0..100>`, defaults 0 / 50), a pinned `mutationId` (new constant, e.g. `0x7ee500`), the `pinDry` path already supports `bristle-round` (`probe.ts:1108`). Rationale: identical geometry + seed across captures makes the five combos directly comparable, mirroring 64-03's `--emboss` fold pattern; a five-stroke single sheet would confound y-position with the parameter.

**Measurement.** Reuse `lineProfileSet` (`probe.ts:2273-2518`): it returns `across: { cover, dark, ink }` arrays indexed by ±`LINE_BAND_PX` offsets, `interior` stats over the ≥50 %-peak span, `peakCover`, `rim`/`halo` walks, `stations`, and the `tiling.enclosed` lane detector. Add to the edge-transparency report (or derive in `compare.mjs`):
- `core` = `interior.cover` (the film at |offset| ≤ 8 px) — must equal the neutral capture's core (amount 0 untouched).
- `silhouette` offset = calibrate from THAT capture: the largest |offset| still carrying a designated coverage fraction of peak (e.g. 1 %); a shape-free calibration avoids re-deriving 0.66·r in the probe.
- `mid` = the value at offset = 0.775 × silhouette (t = 0.5 in silhouette units; without normalization the midpoint would be at 0.775 nominal — the capture reveals which law shipped).
- `rim` = the value at the silhouette offset.
- Ratios vs the neutral capture at the same offsets: `rimRatio` ≈ 1 − amount/100 (0 captured → ratio = cover/cover_neutral), `midRatio` ≈ 0.293 / 0.5 / 0.75 for falloff 0 / 50 / 100 at amount 100, `coreRatio` ≈ 1.
- Lane check: the neutral and the two extreme captures must keep `tiling.enclosed` under the pale-line thresholds (`fracPct`, `maxRunPx`) and `tiling.coherence.fracHigh` bounded; straight-line only.

**Baseline handling (order matters).** Capture and commit `baselines/edge-transparency-neutral.json` from the (0, 0) combo and `edge-transparency-neutral-broad.json` from (0, 100) **on the unmodified engine** (the scenario's params bag may already carry the keys — the pre-change `toEngineParams` ignores them and the post-change maps them to the neutral 0 / 0.5). Then implement, re-run the same gates and `node compare.mjs edge-transparency-neutral` / `…-broad` must pass baseline equality (all FIELDS). The sweep captures `(100,0)`, `(100,50)`, `(100,100)` are session captures compared with `--other` against the neutral of the same run.

**Identity caveat.** `neutral-identity` is a NON-bristle `round` stroke (`probe.ts:258 BRUSH_ID = 'round'`, `STROKE_PARAMS` 269-279 without the acrylic record) — it cannot prove Gouache identity. The byte-identity proof for UAT row 1 must be the new (0,0)/(0,100) captures above.

**Curved S.** The harness has no curved-line lateral profile; UAT row 2 ("no banding on a curved S-stroke") is the human check. Do not overreach the probe.

## Test plan

Framework: vitest (existing setup; **`vitest run` only, never watch** — `pnpm --dir packages/efx-watercolor exec vitest run`, `pnpm --dir app exec vitest run`, `pnpm --dir app exec tsc --noEmit`). No new config.

**Package side — write first (TDD), following the pure-twin pattern in `bristles.test.ts` (SOURCE/ENGINE_SOURCE/PACKAGE_SOURCES scans + `expectContains`/`expectNotContains`):**
- `bristles.test.ts`: a new `describe` for `bristleEdgeFilm` — three anchors at amount 1: at `lateral = start` → 1; at the silhouette → 0; at the fade midpoint → 0.5 (falloff 50), 0.293 (falloff 0), 0.75 (falloff 100); `film(0) = 1` for every amount/falloff; amount 0 → exactly 1 for every falloff; non-finite → 1; exponent map anchors 0.5 / 1 / 2; monotonicity (`film` non-increasing in lateral for amount > 0).
- `params.test.ts`: canonical 0..100 → engine 0..1; defaults 0 / 0.5; clamping; absent keys → defaults.
- `mediums.test.ts`: key list literal + the pin at line 61 → sixteen; both records' new values (0 / 50).
- Source pins (new `describe` in `bristles.test.ts` or `scattering.test.ts`, which already pins the gather's single definition and fragment wiring at 585-761): the three uniforms declared in `BRISTLE_GATHER` and bound in `bindGather`; `featherFade *= edgeFilm` present; `g.film` on the S term; **no** second `uEdgeFade` multiply in the attenuation half or in the threshold block; `g.film = 1.0` init; `BRISTLE_GATHER` still defined once.

**App side (update the pins the rows/keys touch):**
- `mediumSelection.test.ts:119` `toHaveLength(16)` → 18 (+ comments at 262 and the "fourteen" prose).
- `aquarelleParamVisibility.test.ts`: counts at 108-114 (`P-A 4` → 6; the test name string), the 13-row literal at 208-225 → 15 rows with `edgeFade|edgeFalloff` after `feather`; group ids unchanged (`paint|drying|edge` for acrylic still holds).
- `AquarelleGlobalsPanel.test.ts`: the Gouache labels pin at 871-884 → `['Pigment','Pickup','Dry speed','Feather','Edge transparency','Edge falloff']`; `RESET_EXPECTED` (215-235) / `ACRYLIC_RESET_EXPECTED` (240-255) gain `edgeFade: 0, edgeFalloff: 50`; the watercolor label list (887-905) unchanged.
- Optional: a small contract test that the two rows are `BRISTLE_MEDIA` and that watercolor/Water contexts exclude them (covered by the count/group pins already).

**Sampling.** Per task commit: the touched side's `vitest run` path. Per wave/end: both package + app suites and `tsc --noEmit`; then the probe gates.

## Integration gotchas

- **Probe regression from `bristle-flat` (biggest gate hazard).** `BRUSH_PRESETS` now holds `round`, `detail`, `rigger`, `flat`, `hake`, `filbert`, `mop`, `sponge`, `spatter`, `sumi`, `dagger`, `bristle-round`, `pen` (`brushes.ts:373-500`); `isBristleResponse` is `bristle-round` / `pen` only; `brushes.test.ts:314` asserts `bristle-flat` is NOT a bristle response. The old probe scenarios still name `bristle-flat` (`probe.ts:1335/1343/1689/1703/1710/1870/1889/2739/3110/3193`) and `resolvedBrush` defaults it for `bristle-line`/`bristle-tip` (`3338`); `presetFor` silently falls back to `round` (`brushBridge.ts:86-89`). Their committed baselines cannot be reproduced at HEAD, and `--brush bristle-flat` now throws in `readBrush` (`probe.ts:3746-3754`). Do not build the new gate on them; do not "fix" them in this task unless the plan explicitly includes it (it would re-baseline five scenarios — out of the spec's scope).
- **Reset/fixtures flow automatically but fixture literals do not.** `onReset` spreads the record; the panel tests enumerate the values, so the fixtures must be updated or the suite fails.
- **Selection edits.** The new keys are inert on selected strokes unless they are in `AQUARELLE_GLOBAL_KEYS` — `updateAquarelleStrokesInScript` refuses any key not in the list (`aquarelleRecordState.ts:1426`). Appending them is what makes the slider release edit the selection (one undo entry via `commitAquarelleSelectionParam`).
- **Top bar.** `PhysicsPaintTopBar.tsx:472` only gates the `water` row; there is no generic top-bar enumeration, so the Studio top bar neither needs nor gains Edge sliders. The Studio's RIGHT PANEL does render them (same `MemoizedPhysicsPaintRightPanel` → `WatercolorModuleSection` → `AquarelleGlobalsPanel`). The task boundary "Studio rows hidden for watercolor/Water" is satisfied by the row table's `BRISTLE_MEDIA` paint filter.
- **Payload/codec.** Nothing: `codec.ts:119` accepts any numeric `engine.params` record; `scriptTimelineCodec.ts:734-742` writes any key. Replay maps through `toEngineParams` (`engineAdapter.ts:423`), so old strokes stay neutral (absent → defaults 0 / 0.5) and new strokes round-trip.
- **Re-render/cached base.** No new target, no transient state (Claude's Discretion already determined none needed): the factor is computed in the gather, so live/committed/re-rendered are identical by construction; the UAT row 8 check remains a formality.
- **Do not run the dev server** (CLAUDE.md) — the probe and vitest are the only automated surfaces.

## Recommended plan shape (3 tasks)

1. **Probe scenario + pre-change identity baselines (data-only, no engine change).** Add `edge-transparency` to both closed lists, the operands, the single-stroke `bristle-round` script, and the profile/ratio report fields; capture `(0,0)` and `(0,100)` and commit both baselines. This is the only window in which the neutral baseline can be captured on the unmodified engine. Also record the pre-change behavior of the (100,·) captures (they render identical to neutral — the keys are ignored), useful evidence for "amount 0 inert" and "old payloads unchanged".
2. **Package core — tests first, one commit.** `bristles.test.ts` (twin + source pins) red → constants (`BRISTLE_EDGE_START ≈ 0.55`, `BRISTLE_EDGE_EXP_MIN 0.5`, `BRISTLE_EDGE_EXP_MAX 2`, `edgeFalloffExponent`, `bristleEdgeFilm`) → `params.ts` + `params.test.ts` → `Engine.ts` Params/DEFAULT_PARAMS/bindGather → `BRISTLE_GATHER` (film + uniforms + edgeFilm math with the silhouette normalization) → deposit S line. Green on `pnpm --dir packages/efx-watercolor exec vitest run`.
3. **Records, app, gates.** `mediums.ts` + `mediums.test.ts` (sixteen); `aquarelleRecordState.ts` keys/defaults; `aquarelleParamVisibility.ts` rows + comments; app test pins/fixtures; then `pnpm --dir app exec vitest run`, `pnpm --dir app exec tsc --noEmit`, re-run the probe gates (`compare.mjs edge-transparency-neutral`, `…-broad`, sweep vs `--other`) and the UAT rows 1-9 hand-off.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The silhouette-normalized `u` (÷ `uFeatherEdge`) is the intended reading of the frozen law | Risk 9 / The law | The effect reads weak at the visible rim; UAT rows 2-4 fail; flipping to the literal nominal law is a one-line change but invalidates the twin anchors' stated positions |
| A2 | `uEdgeStart ≈ 0.55` is acceptable as the shipped start (spec says "~0.55") | The law | Fade band starts too late/early; a constant-only change |
| A3 | The probe report can be extended with ratio fields without re-baselining other gates | Probe plan | Extra probe work; compare.mjs treats unknown fields per gate, so scope stays contained |
| A4 | A dedicated `edge-transparency` scenario (vs reusing `bristle-line` with operands) is the right harness shape | Probe plan | Falls back to `bristle-line` + new operands, which mixes concerns but is workable |

Everything else in this document was read at HEAD this session and quoted verbatim where it is a discrete value.

## Sources

All findings are in-repo, verified this session at `d509a886d`:
`SPECS/v2.2.0-medium-engine/GSD-QUICK-PROMPT-10-edge-transparency.md`; `packages/efx-watercolor/src/playground/{shaders.ts,Engine.ts,bristles.ts,params.ts,mediums.ts,mediums.test.ts,bristles.test.ts,coverage.test.ts,scattering.test.ts,brushes.ts,brushBridge.ts}`; `packages/efx-watercolor/src/payload/codec.ts`; `packages/efx-watercolor/src/adapter/engineAdapter.ts`; `packages/efx-watercolor/probe/medium-engine/{run.mjs,probe.ts,compare.mjs,harness.test.ts}`; `app/src/components/physic-paint/view/{aquarelleRecordState.ts,aquarelleParamVisibility.ts,aquarelleParamVisibility.test.ts,AquarelleGlobalsPanel.tsx,AquarelleGlobalsPanel.test.ts,mediumSelection.test.ts,PhysicsPaintTopBar.tsx,PhysicsPaintRightPanel.tsx,WatercolorModuleSection.tsx}`; `app/src/components/physic-paint/performance/scriptTimelineCodec.ts`; `app/src/components/physic-paint/PhysicsPaintStudioView.tsx`.
