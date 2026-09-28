# Quick 260928-dh1: Paint-deposit debug — kill the pixel speckle - Research

**Researched:** 2026-09-28
**Domain:** Canvas-2D paint deposit rasterizer + wet/dry transfer (packages/efx-physic-paint)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Deposit-time bristle pass + de-hardcut dryStep.** Velocity/pressure/direction are gesture-sample properties; dryStep is a per-pixel raster transfer (drying.ts:58-158) with no stroke geometry. Anti-accumulation: traces produced once at deposit cannot multiply per physics click.
- **Hard constraint:** the deposit-time bristle pass must be GEOMETRY (ribbon/polygon draws), never a getImageData + per-pixel loop. 9a (260925-dso) deleted those per-stroke pixel passes for latency.
- **Rejected: "both sites"** — one noise generator at deposit; dryStep gets continuous multiplicative modulation only.
- **Trace determinism:** seeded per-stroke — RNG seeded from stroke id + arc-length (not sample index). Unseeded RNG breaks 8b/8c/8d stop-motion determinism law; baked-in bytes would go incoherent with live Spread/thickness parameters.
- **Measure-first ownership:** Task 1 = harness + RED baseline BEFORE any deposit-path edit; Task 2 = the fix; Task 3 = re-run same harness for acceptance.
- **STOP condition:** if velocity/pressure/direction traces need a new stroke-input pipeline beyond a deposit-path change, STOP and report.
- Measurement matrix mandatory: 0/1/2/3 apply-physics clicks at same zoom; physics-without-paper vs paper-without-physics; light vs heavy pressure, slow vs fast stroke, same content.
- Acceptance: zero isolated pixels; continuous falloff; fine contained directional traces; light pressure reads lighter; fast stroke reads more depleted.

### Claude's Discretion
- Exact bristle count / wobble frequency / alpha ranges tuned from v11 oracle starting points (wFreq 0.04–0.12, wAmp 0.3–1.5, width 0.4–2.2px, alpha 0.015–0.06), calibrated against the RED baseline.
- Fix v11's two known limits while porting: deformation variance becomes pressure-dependent; shape noise becomes fbm/non-uniform and pressure-scaled.
- Harness output format (JSON + PNG pairs to /tmp) is Claude's choice, consistent with prior app-written capture files.

### Deferred Ideas (OUT OF SCOPE)
- savedWet round-trip in startPhysics/stopPhysics — do not touch button semantics (one-shot-vs-dose) in this pass.
- Quick 8e (color-blending beading) — DO NOT OPEN.
- mixbox (CC BY-NC) — REJECTED dependency.
</user_constraints>

## Summary

The speckle has TWO located, verified mechanisms — not a hypothesis. (1) `dryStep` hard-cuts the transfer: pixels whose per-step `sa ≤ 0.005` still lose `drain` unconditionally (`wet.alpha[i] -= drain` runs regardless of the transfer gate), so a soft low-density fringe evaporates pixel-by-pixel and survivors straddle the gate = salt-and-pepper. The paper-modulation multiplier `clamp(1.4 - ph*0.8, 0.3, 1.4)` flips individual pixels across that boundary, adding a second per-pixel variance layer, and the `pixelOpacity < 0.99` guard is an on/off discontinuity. (2) At deposit, the existing bristle fringe straddles `DEPOSIT_KEEP_TIER = 70` — the gate's own comment says it "filters bristle trace + anti-aliased edge artifacts", quantizing low-alpha bristle pixels into isolated survivors. `applyPaperPass` is confirmed continuous (GPU drawImage composites, no threshold).

**STOP condition is NOT tripped.** The deposit seam already carries per-sample pressure (`p`) and velocity (`spd`) plus direction (tangent), and `drawBristleTraces` already exists as a geometry pass reading them. The only gap: stroke id (`mutationId`) is not threaded into the raster functions — one extra parameter, not a new stroke-input pipeline.

**Primary recommendation:** Task 1 harness first (seeded LCG over `Math.random` for comparable before/after), then (a) make `drawBristleTraces` the single seeded deposit-time trace generator (geometry, containment-clamped to local ribbon half-width, continuous modulation) and (b) remove every hard cutoff from `dryStep`'s deposit/dry path in favor of continuous multiplicative modulation — keeping tier-70 as include/exclude only.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Gesture capture (x/y/pressure/velocity) | Engine input (pointer) | — | `spd` computed at input from timeStamp deltas (EfxPaintEngine.ts:2848-2862) |
| Trace/bristle generation | Deposit rasterizer (brush/paint.ts) | — | Geometry pass; gesture samples exist only here |
| Hard-cut removal / continuous modulation | dryStep (core/drying.ts) | — | Per-pixel raster transfer; no stroke geometry |
| Paper modulation (keep) | Paper pass (app/src/lib/paperPass.ts) | dryStep multiplier | Continuous tiles; keep per canonical refs |
| Measurement harness | App DEV layer (Studio + engine) | Tauri write_debug_capture | App-written /tmp captures rule |

## Phase Requirements

No REQ IDs were provided for this quick task. Requirements are carried by CONTEXT.md (Task Boundary, Required character 1–4, Hard rule, STOP condition) — see User Constraints above.

## Question A — Deposit rasterizer seam

**Verdict: seam FOUND, carries pressure + velocity + direction. STOP NOT tripped.**

- **The single seam:** `createPaintStrokeRasterContinuationFromCurve` — `packages/efx-physic-paint/src/brush/paint.ts:336-431` [VERIFIED: packages/efx-physic-paint/src/brush/paint.ts:336-431]. Both entries funnel into it: live finalization via `createPaintStrokeRasterContinuation` (paint.ts:303-334) and replay/batch via `renderPaintStroke` (paint.ts:263-301).
- Curve build (both entries): `const sm = smooth(rawPts, 3); return resample(sm, Math.max(3, radius * 0.25))` [VERIFIED: paint.ts:285-288, :321-324].
- **A geometry bristle pass ALREADY slots in:** `drawBristleTraces` (paint.ts:70-137) draws `ctx.stroke()` paths — pure canvas-2d geometry, no pixel loops. Called at paint.ts:380 (pickup-0), :422 (pickup segment), :483 (single-color), timed as stage `'paint-raster-bristles'`.
- **Per-sample inputs at the seam** — `PenPoint { x, y, p, tx, ty, tw, spd }` [VERIFIED: packages/efx-physic-paint/src/types.ts:80-88 — `p` = pressure 0–1, `spd` = speed px/ms]. `lerpPt` preserves `p, tx, ty, tw, spd` through smooth/resample [VERIFIED: packages/efx-physic-paint/src/util/math.ts:118-128]. Velocity computed at input: `if (dt > 0) speed = Math.hypot(x - prev.x, y - prev.y) / dt` [VERIFIED: packages/efx-physic-paint/src/engine/EfxPaintEngine.ts:2848-2862]. Inside the bristle loop: `const pr = hasPenInput ? p.p * 0.7 + 0.3 : ...` [VERIFIED: paint.ts:114], `const skipChance = hasPenInput ? clamp(p.spd * 0.002, 0, 0.15) : 0.025` [VERIFIED: paint.ts:124], `const pMod = hasPenInput ? 0.5 + p.p * 1.0 : 1; ctx.lineWidth = b.width * pMod` [VERIFIED: paint.ts:129-130], tangent/normal at paint.ts:107-111.
- **Only gap:** stroke id is NOT threaded. `const mutationId = reservedMutationId ?? this.nextMutationId++` … `primary.mutationId = mutationId` [VERIFIED: EfxPaintEngine.ts:1997, :2002] but raster functions never receive it. Threading it = one extra parameter through `renderPaintStroke` / `createPaintStrokeRasterContinuation` — NOT a new pipeline.
- **Containment bug (to fix while porting):** bristle offset uses `off = (b.offset + wobble * 0.015) * radius * pr` with `pr = p*0.7+0.3` (no end taper) [VERIFIED: paint.ts:114, :121], while ribbon half-width is `s = Math.max(0.1, (hasPenInput ? curve[i].p : 1) * endTaper)` with `endTaper = Math.pow(Math.sin(t * Math.PI), tPow) * 0.7 + 0.3` [VERIFIED: packages/efx-physic-paint/src/brush/stroke.ts:125-127]. At stroke ends (taper→0.3) bristle offset can reach `radius × p×1.0` vs ribbon `0.3 × radius` → traces escape the footprint. Fix: clamp lateral offset to the local ribbon half-width (`s` from `ribbonWithScales`).

## Question B — dryStep hard-cut inventory

**Confirmed, with two corrections to the brief's line numbers:** `DRY_ALPHA_THRESHOLD = 1` is declared at drying.ts:22 (not :88); `:88` is the `wet.alpha[i] < DRY_ALPHA_THRESHOLD` skip. The `sa > 0.005` gates are at :100, :135, and :216 (forceDryAll) — there is no fourth at :148; `:148` is the post-transfer reset check.

All in `packages/efx-physic-paint/src/core/drying.ts` [VERIFIED — file Read this session]:

| Line | Code (verbatim) | Role |
|------|-----------------|------|
| :22 | `const DRY_ALPHA_THRESHOLD = 1` | Dry-state cutoff |
| :88 | `if (wet.alpha[i] < DRY_ALPHA_THRESHOLD) continue` | Skip not-yet-drying pixels |
| :100 | `if (sa > 0.005) {` | Fully-dry branch transfer gate |
| :109 | `wet.alpha[i] = 0;` | Residue dropped when gate fails |
| :127-129 | `if (paperHeight && pixelOpacity < 0.99) { const ph = paperHeight[i]; sa *= clamp(1.4 - ph * 0.8, 0.3, 1.4) }` | Paper modulation — on/off discontinuity (`< 0.99`) + per-pixel multiplier |
| :135 | `if (sa > 0.005) {` | Fractional transfer gate |
| :145 | `wet.alpha[i] -= drain` | **UNCONDITIONAL even when sa ≤ 0.005** — the core speckle mechanism: fringe loses alpha without transferring; survivors straddle the gate |
| :148 | `if (wet.alpha[i] < DRY_ALPHA_THRESHOLD) {` | Post-transfer reset |
| :206 | `if (wet.alpha[i] < 1) continue` | forceDryAll skip |
| :216 | `if (sa > 0.005)` | forceDryAll transfer gate |

**Second mechanism — deposit keep-gate:** `const DEPOSIT_KEEP_TIER = 70` [VERIFIED: packages/efx-physic-paint/src/core/wet-layer.ts:417]; `if (a < DEPOSIT_KEEP_TIER) continue  // 260924-rm2 deposit keep-gate: include/exclude only, never alpha modulation (filters bristle trace + AA edge artifacts)` [VERIFIED: wet-layer.ts:447]. Bristle globalAlpha 0.015–0.06 → offscreen alpha ~4–15/255 < 70 → dropped in isolation; bristle drawn over layer-saturated body (≥70) survives → quantized isolated pixels. The gate comment itself admits it "filters bristle trace" artifacts.

**Other cutoffs in the deposit/dry path (for completeness):**
- `featherWetEdges`: `if (wet.alpha[i] > 1) continue` + `const frac = 0.35` [VERIFIED: wet-layer.ts:46, :64-65] — continuous feather, keep.
- Dead `transferToWetLayer`: `if (a < 20) continue  // Filter bristle trace + anti-aliased edge artifacts` [VERIFIED: wet-layer.ts:352] — dead path, ignore.
- Compositor display mapping: `if (pixelOpacity >= 0.90)` branch, `if (pixelOpacity < 0.001) continue` [VERIFIED: packages/efx-physic-paint/src/render/compositor.ts:35, :89] — display-only, not deposit; out of scope unless baseline implicates it.
- Fluids structural thresholds (keep): `const inside = (cx, cy) => wet.alpha[cy * canvasW + cx] > 20` [VERIFIED: packages/efx-physic-paint/src/core/fluids.ts:287] — 260924-stb law, structural include/exclude, not alpha modulation.

**applyPaperPass: CONTINUOUS — confirmed.** `encodePassTiles` splits by sign without threshold: `const v = s < 0 ? -s : 0; const u = s > 0 ? s : 0` [VERIFIED: app/src/lib/paperPass.ts:87-113]; `applyPaperPass` is five GPU drawImage composites (capture → multiply valley → lighten peak → destination-in alpha restore → copy back), no threshold [VERIFIED: paperPass.ts:245-276]. Called at `app/src/stores/physicPaintStore.ts:2669`. The brief's paper-pass isolation row is expected to confirm non-culpability.

## Question C — Seeded RNG plumbing

- **No production seeded PRNG exists.** `gauss` uses `Math.random()` (Box-Muller) [VERIFIED: packages/efx-physic-paint/src/util/math.ts:13-16] — shared by bristle offset (paint.ts:88) AND `deformScaled`/`deformNScaled` (stroke.ts:187), so production deposit is ALREADY non-deterministic across replay (pre-existing silhouette boil). Tests achieve determinism only by mocking `Math.random` with an LCG [VERIFIED: packages/efx-physic-paint/src/brush/paint.grainRemoval.test.ts:50-53 — `seed = (1664525 * seed + 1013904223) >>> 0`, start `123456789`].
- **Deterministic noise utility already exists:** value `noise(px,py)` via `_rand(x,y) = _fract(Math.sin(_dot(x,y,12.9898,4.1414))*43758.5453)` and `fbm(x,y,octaves=3)` [VERIFIED: packages/efx-physic-paint/src/util/noise.ts:18-20, :27-44, :55-73], header `:4`: "Required for deterministic replay: no Math.random() in noise path". Use fbm for the shape-noise limit fix — seedable by coordinate offset, no new dependency.
- **Stroke-id hash precedent:** FNV-1a `hashStroke` over `` `${strokeIndex}:${stroke.timestamp}:${stroke.color ?? ''}:${stroke.points.length}` `` (offset 2166136261, prime 16777619) [VERIFIED: packages/efx-physic-paint/src/animation/recordedStrokeMotion.ts:50-58]; integer hash `poseNoise` → [-1,1] at :87-92.
- **Arc-length:** `resample` is equidistant with `spacing` param — arc-length ≈ index × spacing; more robust is accumulating `distXY` per segment [VERIFIED: stroke.ts:75-89]. Arc-length (not sample index) is the locked seed coordinate.
- **Pitfall — LCG test pins will shift:** deterministic deposit digest pins in `physicsWidthScaling.test.ts` / `productionAaSettleMeasurement.test.ts` (and `physicsSettledFootprint`) rely on Math.random draw counts/order; adding a seeded bristle RNG changes draw order → those digests recalculate. The pyp table (260924-rm2) is the calibration oracle. Flag for planner: expect recalibration tasks, do not "fix" by re-tuning the oracle.

## Question D — Invariant contracts (must not regress)

| Invariant | Source of truth (VERIFIED) | Contract |
|-----------|---------------------------|----------|
| 260924-stb thickness field | fluids.ts:247-265 (law comment), :266-269 `WIDTH_SCALE_T_FLOOR = 4`, `WIDTH_SCALE_T_FULL = 6`, `WIDTH_SCALE_RESIDUAL = 0.25`, `WIDTH_SCALE_RADIUS = 2`; `buildWidthScaleField` :276-337 | `f(c) = 0.25 + 0.75 * clamp((T(c) - 4) / (6 - 4), 0, 1)`; "calibrated PRE-RED — never re-calibrated"; reads only wet.alpha, no RNG/clock. Never fix width via opacity. |
| 260924-rm2 DEPOSIT_KEEP_TIER = 70 | wet-layer.ts:417, :447, :450 `let depositAlpha = (a / 255) * 3000` | Law comment :398-416: "Include/exclude ONLY… NEVER scale depositAlpha, wetness, or strokeOpacity… (m7w failure 24f40261 / revert 1648658b…); tier 200 is FORBIDDEN". Gate stays include/exclude; bristle traces must be built to PASS it, not by weakening it. |
| 260925-b7c Spread calibration | texture law asserts at Spread 80 — productionAaSettleMeasurement.test.ts:741 | "when spread engaged" texture law; K=1 default intentional. |
| 260925-dso clean edges | paint.grainRemoval.test.ts:1-60 ("stroke raster must run zero grain/emboss pixel passes"; stage observer) | NO getImageData + per-pixel loops in the stroke raster. `fillPolyGrain`/`applyPaperEmboss` must stay absent from production. |
| 260927-ton width-scaled deformN | stroke.ts:125-127 (ribbon `s`), :173-191 `deformScaled` uses `gauss(0, variance * sMid)`, :198-211 `deformNScaled` divisor `1 + d * 0.65` | deform amplitude follows LOCAL ribbon width. Keep; bristle containment should key off the same `s`. |
| 260925-iy6 paper pass / D-09 fond merge | paperPass.ts:87-113, :245-276; invoked physicPaintStore.ts:2669 | KEEP UNCHANGED — continuous, good. |
| savedWet round-trip (DEFERRED) | EfxPaintEngine.ts:1110-1137 (`this.wet.alpha[i] = this.savedWet.alpha[i] … wet.wetness[i] = 400; this.drying.dryPos[i] = 0`), startPhysics :1095, stopPhysics :1192, writeback :1202-1219 | Do not touch button semantics in this pass. |

## Question E — Measurement harness pattern

- **JSON capture:** Tauri command `write_debug_capture(contents, name)` writes `/tmp/efx-stall-capture-{name}.json`; name must match `[a-z0-9-]+` [VERIFIED: app/src-tauri/src/commands/debug_capture.rs:10-25 — `std::fs::write`, error "name must match [a-z0-9-]+"].
- **PNG capture:** `export_write_png(dir_path, filename, data: Vec<u8>)` — atomic `.png.tmp` + rename [VERIFIED: app/src-tauri/src/commands/export.rs:19-27]; JS wrapper `exportWritePng(dirPath, filename, data: number[])` [VERIFIED: app/src/lib/ipc.ts:785-787]; canvas→bytes via `canvasToPngBytes(canvas)` (`toDataURL('image/png')` + `atob`, null on taint) [VERIFIED: app/src/lib/rotoAlphaCanvasRegistry.ts:38-52].
- **Scripted stroke injection (the pressure × velocity matrix):** precedent in `EfxPaintEngine.pointerInput.test.ts` — `PointerSample { x, y, timeStamp, pressure?, tiltX?, tiltY?, twist?, buttons?, pointerType? }` [VERIFIED: packages/efx-physic-paint/src/engine/EfxPaintEngine.pointerInput.test.ts:11-21]; inject via `engine.onPointerDown(...); for (...) engine.onPointerMove(...); engine.onPointerUp(...)` [VERIFIED: :105-106, :126]. `timeStamp` controls velocity exactly → identical geometry at two speeds; `pressure` controls pressure → identical gesture at two pressures. Meets the brief's requirement that Task 1 re-measures the identical matrix.
- **Engine seam in the app:** `handleCanvasEngineReady = useCallback((readyEngine: EfxPaintEngine) => { canvasEngineReadyImplRef.current(readyEngine); }, [])` [VERIFIED: app/src/components/physic-paint/PhysicsPaintStudio.tsx:3538], wired `onEngineReady: handleCanvasEngineReady` at :3700 — install a DEV harness hook here.
- **Physics clicks:** app "Apply physics" button = `input.engine!.startPhysics(mode)` / `stopPhysics()` [VERIFIED: app/src/components/physic-paint/engine/usePhysicsPaintEngineActions.ts:94-104] → drives 0/1/2/3-click matrix. `flushPendingStrokeFinalizations` is public [VERIFIED: EfxPaintEngine.ts:2154].
- **DEV hook precedent:** `Object.defineProperty(window, '__EFX_PHYSICS_PAINT_PROFILE__', …)` gated `import.meta.env.DEV` [VERIFIED: app/src/components/physic-paint/performance/physicsPaintPerformanceTrace.ts:529-543].
- **Determinism trick for before/after comparability:** install an LCG over `Math.random` for the harness run (same as paint.grainRemoval.test.ts:50-53) — production deform/bristle RNG is unseeded today, so without the LCG the RED baseline and the after-fix run would not be pixel-comparable.

## Question F — Oracle portability (v11 skim)

Source: `/Users/lmarques/Desktop/watercolor-studio-v11.html` (READ-ONLY look oracle).

**drawBristleTraces (:335-382) — constants (all use `Math.random()` → FORBIDDEN as-is, must be re-seeded):**
- `count = Math.max(4, Math.floor(radius * 0.5))` (:340); per-bristle `{offset: (i/(count-1))*2-1+gauss(0,.03), width: .4+Math.random()*1.8, alpha: .015+Math.random()*.06, dark: Math.random()>.5, wFreq: .04+Math.random()*.08, wAmp: .3+Math.random()*1.2}` (:343-344).
- `pr = hasPenInput ? p.p*0.7+0.3 : ...` (:359); `wobble = Math.sin(ci*b.wFreq)*b.wAmp; off = (b.offset+wobble*.015)*radius*pr` (:366-367).
- `skipChance = hasPenInput ? clamp(p.spd*0.002, 0, 0.15) : 0.025` (:371); `if (texHeight && sampleH(bx,by) > .72 && Math.random() > .3) { on=false; continue }` (:372); `if (Math.random() < skipChance)` (:373).
- `pMod = hasPenInput ? 0.5+p.p*1.0 : 1` (:376). Darker tint `rgbHex(cr*.35,…)` (:338) — repo uses `cr*0.7` [VERIFIED: paint.ts:82]; repo already ports this function (paint.ts:70-137 mirrors it).
- Repo already has velocity depletion matching v11: `speedDeplete = hasPenInput ? clamp(1 + pen.spd*0.003, 1, 1.5) : 1` [VERIFIED: paint.ts:294 vs v11 :447].

**fillPolyGrain (:295-317) — the multiplicative-shape reference (its per-pixel loop is FORBIDDEN):**
- `if(grain>0.01) mod *= 1 - grain*.5*(1-fbm((ox+px)*0.08,(oy+py)*0.08,3));` (:310)
- `mod *= clamp(1.3 - sampleH(ox+px,oy+py)*.8*emboss, 0.1, 1.4);` (:311)
- `d[idx+3] = Math.round(clamp(d[idx+3]*mod, 0, 255));` (:312)
- Skip only `if(d[idx+3]<1) continue;` (:308).
- **Forbidden:** `getImageData` (:306) / `putImageData` (:314) per-pixel loop → 260925-dso law violation. Port the FORMULA (continuous multiplicative `mod`), not the loop.

**renderAquarelleStroke (:532-621) — look oracle for edge darkening / blob layering:**
- `pressureMod = hasPenInput ? 0.3+pen.p*0.7 : 1` (:537, stroke-averaged); `blobSpacing = Math.max(radius*0.4, 8)` (:545); `taper = Math.pow(Math.sin(t*Math.PI),0.3)*0.7+0.3` (:551); `blobR = radius*taper*penP*(0.8+Math.random()*0.4)` (:553); `layers = Math.round(35+opac*30)` (:577); `layerAlpha = clamp(0.06*opac*pressureMod, 0.02, 0.08)` (:579); edge darkening `layers*0.12` passes, color ×0.35, `lineWidth = 1 + blob.blobR*0.012` (:607-621).
- Repo has NO aquarelle tool (zero hits in packages/app) — aquarelle is look-reference only, not a target tool.

**Two known limits to fix while porting (locked):** deformation variance must become pressure-dependent (v11 only scales radius + layer alpha by pressure); shape noise must become fbm/non-uniform and pressure-scaled (v11 uses uniform `Math.random()`). Use `util/noise.ts` fbm, pressure-scaled.

## Package Legitimacy Audit

Not applicable — this phase installs **no external packages**. All work uses existing in-repo code (`util/noise.ts` fbm, existing FNV hash pattern, existing canvas-2d geometry).

## Common Pitfalls

### Pitfall 1: Reintroducing per-pixel loops in the raster
**What goes wrong:** a `getImageData` + loop "just for the traces" violates 260925-dso, tanks latency, and re-opens deleted code.
**How to avoid:** traces = `ctx.stroke()` paths only (the existing `drawBristleTraces` shape). The grainRemoval stage observer test (`paint.grainRemoval.test.ts`) must stay green.

### Pitfall 2: Modulating deposit alpha to contain traces (tier-70 violation)
**What goes wrong:** scaling `depositAlpha` to hide fringe pixels repeats the m7w failure (24f40261, revert 1648658b).
**How to avoid:** containment comes from geometry (clamp lateral offset to ribbon `s`), tier-70 stays include/exclude only.

### Pitfall 3: Seeded RNG shifts LCG-pinned deposit digests
**What goes wrong:** changing Math.random draw count/order in the deposit path breaks `physicsWidthScaling` / `productionAaSettleMeasurement` / footprint digest pins → red tests misread as regressions.
**How to avoid:** expect recalibration; pyp table (260924-rm2) + texture law (Spread 80) are the oracles — recalibrate against them, never weaken asserts.

### Pitfall 4: Generating traces in dryStep (anti-accumulation break)
**What goes wrong:** dryStep runs per physics click → a fresh trace layer per click (the live 1/2/3-click degradation).
**How to avoid:** ONE generator at deposit; dryStep gets continuous multiplicative modulation only. The `sa > 0.005` gates become continuous (soft transfer / proportional drain), no new generator.

### Pitfall 5: Fixing "light pressure = lighter" via body opacity
**What goes wrong:** `// Pen pressure affects brush SIZE only, not opacity (user preference)` [VERIFIED: paint.ts:292-293] — changing body opacity breaks a deliberate preference and the stb thickness law.
**How to avoid:** lightness comes from bristle alpha/width/spread (noise layer), not the flat fill.

### Pitfall 6: Harness before any edit
**What goes wrong:** editing the deposit path before the RED baseline destroys the only before/after comparison.
**How to avoid:** Task 1 (harness + RED run) commits before any Task 2 deposit-path edit. If the paper-pass isolation row contradicts the located cause → STOP and re-plan.

## Validation Architecture

`nyquist_validation: true` (.planning/config.json:13).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (never watch — `vitest run`) |
| Config | `app/vitest.config.ts` — `include: ['src/**/*.test.ts']` (`.test.ts` ONLY — a `.test.tsx` runs nothing) |
| Package quick run | `cd packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run <file>` |
| Package full | `cd packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run` |
| App quick run | `cd app && npx vitest run src/path/to/file.test.ts` |
| App full | `cd app && npx vitest run` |

### Phase Requirements → Test Map
| Behavior | Test Type | Command | File Exists? |
|----------|-----------|---------|--------------|
| No per-pixel grain/emboss passes in stroke raster | unit | `… vitest run src/brush/paint.grainRemoval.test.ts` | ✅ existing |
| Tier-70 include/exclude, deposit digest pins | unit | `… vitest run src/**/physicsWidthScaling.test.ts` `productionAaSettleMeasurement.test.ts` | ✅ existing (will need recalibration) |
| Scripted pressure×velocity strokes | unit (harness) | engine pointerInput test pattern | ✅ precedent `EfxPaintEngine.pointerInput.test.ts` |

### Sampling Rate
- **Per task commit:** quick run command above.
- **Per wave merge:** full suite both packages.
- **Phase gate:** full suite green + live UAT of the measurement matrix (0/1/2/3 clicks, pressure×velocity rows) before close.

### Wave 0 Gaps
- [ ] `packages/efx-physic-paint/src/brush/<bristle-seed>.test.ts` — seeded-trace determinism test (same stroke id + arc-length → identical traces).
- [ ] Harness RED-baseline capture is a /tmp artifact (app-written), not a unit test — document the command in Task 1.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The dryStep `sa ≤ 0.005` + unconditional drain is THE dominant speckle mechanism (vs the tier-70 quantization) | B | Task 2 ordering wrong; mitigated by the mandatory Task 1 RED matrix (STOP clause) |
| A2 | Threading `mutationId` into raster functions is a one-param change with no replay side effects | A/C | Seeding plumbing larger than expected; still not a "new stroke-input pipeline" |
| A3 | Compositor display thresholds (compositor.ts:35/:89) do not contribute visible speckle | B | May need a display-side pass; harness row would reveal it |
| A4 | Installing LCG over Math.random in the harness does not change pointer/engine timing enough to alter velocity | E | Baseline matrix skewed; validate with recorded timeStamp assertions |

## Open Questions

1. **Hard-rule granularity for dryStep "continuous"** — does `DRY_ALPHA_THRESHOLD = 1` (an integer alpha state cutoff, not a coverage cutoff) count as a forbidden hard cutoff? It gates the dry-state machine, not pixel alpha visibility.
   - Recommendation: keep it (state machine, not deposit modulation) and make the `sa > 0.005` transfer gates continuous; document in Task 2.
2. **Bristle count vs tier-70** — with containment clamped and alphas in the 0.015–0.06 range, will traces ever reach offscreen alpha ≥ 70 to survive the keep-gate?
   - Recommendation: build-up by overlap (locked requirement #2) — many low-alpha strokes over the layer body accumulate; harness RED/GREEN rows decide. If traces inside the body are dropped, the fix is stacking, never lowering the tier.

## Sources

### Primary (HIGH confidence)
- [VERIFIED] `packages/efx-physic-paint/src/core/drying.ts` (full) — hard-cut inventory
- [VERIFIED] `packages/efx-physic-paint/src/core/wet-layer.ts` (full) — tier-70 law
- [VERIFIED] `packages/efx-physic-paint/src/brush/paint.ts` (full) — seam + bristle pass
- [VERIFIED] `packages/efx-physic-paint/src/brush/stroke.ts` (full) — ribbon/ton/deform
- [VERIFIED] `packages/efx-physic-paint/src/util/noise.ts`, `util/math.ts`, `types.ts`, `animation/recordedStrokeMotion.ts` — RNG plumbing
- [VERIFIED] `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` (targeted ranges) — mutationId, savedWet, pointer velocity
- [VERIFIED] `app/src/lib/paperPass.ts` — applyPaperPass continuity
- [VERIFIED] `app/src-tauri/src/commands/debug_capture.rs`, `export.rs`, `app/src/lib/ipc.ts` — /tmp capture pattern
- [VERIFIED] v11 oracle `/Users/lmarques/Desktop/watercolor-studio-v11.html:293-382, 532-621` — look constants

### Secondary (MEDIUM confidence)
- [VERIFIED] prior quick VERIFICATION/SUMMARY docs (dso, ort) — invariant contract history

### Tertiary (LOW confidence)
- none

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; existing in-repo utilities identified with line evidence
- Architecture: HIGH — seam, mechanisms, and invariants all file:line verified this session
- Pitfalls: HIGH — all from VERIFIED code + prior quick artifacts

**Research date:** 2026-09-28
**Valid until:** 30 days (stable domain — Canvas-2D deposit internals)
