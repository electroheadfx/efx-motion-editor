# Phase 64: Medium Engine (extension) — Pattern Map

**Mapped:** 2026-11-19
**Scope:** Plans 64-21 … 64-24 only (acrylic bristle deposit). Plans 64-01…64-20 are executed and verified; this map covers only the files those four new plans create or modify. Every path below is git-tracked source (verified with `git ls-files`).
**Files analyzed:** 20 (18 modified, 2 new)
**Analogs found:** 20 / 20 (14 exact, 6 role-match, 0 none)

> Classification note: the canonical role vocabulary (controller/component/service/…) is adapted here because this phase is a GPU engine + document-format extension, not a web CRUD app. Role labels below name the actual module class.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/efx-watercolor/src/playground/bristles.ts` (NEW) | utility (deterministic generator) | transform (pure RNG → `Float32Array`) | `packages/efx-watercolor/src/playground/brushes.ts` (`bristleTip` + `buildBrush` seeded derivation) | role-match |
| `packages/efx-watercolor/src/playground/Engine.ts` | engine core (service) | event-driven per-dab pipeline + batch replay | itself — every seam has an in-file precedent (`cover`/`relief`/`paperSeed`) | exact (in-file) |
| `packages/efx-watercolor/src/playground/shaders.ts` | shader library (source of GLSL) | GPU fragment transform | `FOOTPRINT_MASK` + `bodyCoverFS` + `paperFieldFS` noise family in the same file | exact (in-file) |
| `packages/efx-watercolor/src/playground/brushes.ts` | config (preset registry) | static transform | `bristle-flat` / `bristle-round` / `bristleTip` in the same file | exact (in-file) |
| `packages/efx-watercolor/src/playground/mediums.ts` | config (frozen record registry) | static transform | `MediumParamKey` / `MediumRecord` / `WATERCOLOR_PARAMS` in the same file | exact (in-file) |
| `packages/efx-watercolor/src/playground/params.ts` | utility (the ONE mapping) | transform | `toEngineParams` in the same file | exact (in-file) |
| `packages/efx-watercolor/src/adapter/engineAdapter.ts` | adapter (option → engine state) | request-response (one-shot setup) | `AquarelleAdapterOptions.light` (64-07) → `engine.setLight` | exact (in-file) |
| `packages/efx-watercolor/src/bake/aquarelleBake.ts` | bake service | batch | `AquarelleBakePaper` + `aquarellePaperCacheFingerprint` | exact (in-file) — conditional change |
| `packages/efx-watercolor/src/payload/toStudioStroke.ts` | projection (payload) | transform | `traceSeed ← hashMutationId` (D-20) | exact — VERIFY ONLY, expected no edit |
| `packages/efx-watercolor/src/playground/bristles.test.ts` (NEW, likely) | test (unit) | deterministic replay | `packages/efx-watercolor/src/playground/relief.test.ts` (source-slice idiom) | role-match |
| `packages/efx-watercolor/probe/medium-engine/probe.ts` | probe harness (page) | batch measurement | `readScenario` / `watercolor50Script` in the same file | exact (in-file) |
| `packages/efx-watercolor/probe/medium-engine/run.mjs` | probe harness (CLI) | batch measurement | `--scenario` / `--brush` closed lists in the same file | exact (in-file) |
| `app/src/components/physic-paint/view/aquarelleRecordState.ts` | store (Preact signals) | transform (record ⇄ params) | `applyAquarelleMedium` / `setAquarelleParam` / `snapshotAquarelleRecord` | exact (in-file) |
| `app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx` | component | request-response (slider edits) | `GLOBAL_ROWS` + `GlobalSlider` + `onReset` | exact (in-file) |
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts` | call site (plumbing) | request-response | `light: input.light` option pass-through at `:158-163` | exact (in-file) |
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` | call site (plumbing) | request-response | `createDefaultAquarelleAdapter(... light)` at `:4357-4371` | exact (in-file) |
| `app/src/efx-paint/document/efxPaintDocument.ts` | model (document TS shape) | persistence | `PaintDocumentLight` / `readonly light?` | exact (in-file) |
| `app/src/efx-paint/document/efxPaintDocumentParsers.ts` | parser | file-I/O (fail-closed) | `normalizeDocumentLight` (64-05) | exact (in-file) |
| `app/src-tauri/src/models/project.rs` | model (Rust declaration pin) | persistence | `MceDocumentLight` declaration-class struct | exact (in-file) |
| `app/src/lib/mceFieldContract.test.ts` | test (dual-language tripwire) | contract | `MceDocumentLight` describe at `:446-474` | exact (in-file) |

---

## Pattern Assignments

### `packages/efx-watercolor/src/playground/bristles.ts` (NEW — utility, transform)

**Analog:** `packages/efx-watercolor/src/playground/brushes.ts` (the repo's only deterministic procedural-set generator) — **read-as-law source**: `.planning/spikes/002-acrylic-bristle-deposit/workbench/src/playground/bristles.ts` (tracked, 99 lines). Do **not** copy it verbatim; it was written against the spike workbench, has no engine dependencies, and its header must be rewritten to the repo's banner style.

**Banner/imports pattern** (`brushes.ts` has no header banner; `params.ts:1-8` shows the house style — a boxed comment naming the file and its single responsibility):
```ts
// ============================================================
//  params.ts — the ONE canonical ↔ vendor Params mapping.
//  ... Never store the mapped 0..1 values in the payload.
// ============================================================
```

**Seeded-derivation pattern** (`brushes.ts:569-590`):
```ts
export function buildBrush(preset: BrushPreset, seed = 7): Brush {
  ...
    const f = source(tipSize, new Noise(seed + hashString(preset.id)));
  ...
}
function hashString(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
```

**Core pattern — the seed order is the contract** (read-as-law, `workbench/src/playground/bristles.ts:23-26, 40-43, 61-99`):
```ts
export const BRISTLE_CAP = 256;
export const BRISTLE_SPACING_PX = 1.1;
export const BRISTLE_MIN = 40;

export function bristleCount(halfWidthPx: number): number {
  if (!Number.isFinite(halfWidthPx) || halfWidthPx <= 0) return BRISTLE_MIN;
  return clamp(Math.round(clamp((2 * halfWidthPx) / BRISTLE_SPACING_PX, BRISTLE_MIN, BRISTLE_CAP)), BRISTLE_MIN, BRISTLE_CAP);
}
...
while (i < n) {
  // §4.2 run header — ONE draw per field, even when the run is clipped.
  const run = 3 + Math.floor(rng() * 14);
  const d = 0.75 + rng() * 0.6;
  ...
  for (let k = 0; k < run && i < n; k += 1, i += 1) { /* 8-float stride */ }
}
```
Law to carry over unchanged: one RNG (`traceSeed`), fixed call order, 8-float stride, `spacing = 2 / n`, radius `max(radiusScale · spacing · halfWidth, 0.8)`. Cite the notes' § numbers in the ported header exactly as the spike does (§4.1, §4.2, §3.1).

**Testing analog:** `packages/efx-watercolor/src/playground/relief.test.ts:121-155` (behavioural pin + source-slice). The natural new test asserts byte-identity of `makeBristles(n, seededRandom(k))` across two calls and that `bristleCount` clamps at 40/256.

---

### `packages/efx-watercolor/src/playground/Engine.ts` (engine core — the main target)

**Analog:** in-file precedents throughout (see per-seam line numbers below). This file is 2920 lines; the excerpts below are the exact ranges to copy.

#### (a) Format constants — line 264-271; `FLOAT_R` does NOT exist yet

```ts
const HALF_FLOAT_RG: Format = { internal: GL_RG16F, format: GL_RG, type: GL_HALF_FLOAT };
const HALF_FLOAT_R: Format = { internal: GL_R16F, format: GL_RED, type: GL_HALF_FLOAT };
const HALF_FLOAT_RGBA: Format = { internal: GL_RGBA16F, format: GL_RGBA, type: GL_HALF_FLOAT };
const RGBA8: Format = { internal: GL_RGBA8, format: GL_RGBA, type: GL_UNSIGNED_BYTE };
const FLOAT_RG: Format = { internal: GL_RG32F, format: GL_RG, type: GL_FLOAT };
```
The last-touch target needs a new constant beside these:
```ts
const FLOAT_R: Format = { internal: GL_R32F, format: GL_RED, type: GL_FLOAT };
```
Verified: no `FLOAT_R` / `R32F` / `FLOAT_R` occurrence exists anywhere under `packages/efx-watercolor/src/` today.

#### (b) Target allocation — `:522-542`

```ts
  private allocateTargets() {
    ...
    // Phase 64: the thickness field — one channel on the document grid, the same
    // shape `wet` uses. Not a ping-pong pair: nothing advects it.
    this.relief = g.target(this.dw, this.dh, [HALF_FLOAT_R], gl.LINEAR);
    // SPIKE 001: the coverage channel — one channel on the document grid. A
    // ping-pong pair because 64-14 advects it and its undo needs both halves.
    this.cover = g.double(this.dw, this.dh, [HALF_FLOAT_R], gl.LINEAR);
    this.paper = g.target(this.dw, this.dh, [RGBA8], gl.LINEAR);
    this.wetMask = g.target(...);
```
- `cover` (`g.double`) is the exact analog for the **last-touch ping-pong pair** (swap into the write half with a non-zero sentinel cleared in `createDocument`/`resetSheet`).
- `relief` (`g.target`) is the analog for the **static 1×256 shape target** — but that target is document-independent, so it must NOT join `allocateTargets()` (which reallocates per document) and must NOT join `docTargets()`. Nearest precedent for a non-document target: `this.paper`/`this.wetMask`… note both ARE in `docTargets()`. A `1×256` target is genuinely novel — flag it in the plan.
- Hazard: `scattering.test.ts:439-442` pins **eleven** `g.target|g.double` allocations in `allocateTargets()`. A new doc-sized pair makes it twelve.

#### (c) Program registry — `:436-468`

```ts
    this.programs = { splat, stamp, relief, fill, advectVelocity, ..., coverDeposit, coverMask };
    // `scattering.test.ts` pins that literal's program count (23).
    this.programs.bodyCover = this.g.program(S.bodyCoverFS);
    this.programs.advectCover = this.g.program(S.advectCoverFS);
    this.programs.coverClear = this.g.program(S.coverClearFS);
```
Copy the **outside-the-literal** registration for every new bristle program (`carrierBristle`, `depositBristle`, `coverBristle`, optionally `touchBristle`) — it keeps the pinned 23-entry literal green, exactly as `coverageLifecycle.test.ts:229-235` asserts for `advectCover`.

#### (d) The four-list rule (history) — the single most important constraint

Any new document channel must be added to **all** of these together (the comment in each list says so):

`allocateHistory()` `:544-553`:
```ts
    this.history = new History(this.g, this.dw, this.dh, [
      { formats: [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA, HALF_FLOAT_R, HALF_FLOAT_R, HALF_FLOAT_R], documents: 2 }, // mobile pigment + water + thickness + coverage
      { formats: [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA], documents: 1 },                                           // fixed pigment
    ]);
```

`docTargets()` `:556-562`:
```ts
    return [this.velocity.read, this.velocity.write, this.pressure.read, this.pressure.write, this.divergence, this.curl,
      this.ink.read, this.ink.write, this.fixed, this.wet.read, this.wet.write, this.paper, this.wetMask, this.relief,
      this.cover.read, this.cover.write];
```

`snapshotLayers()` `:2492-2497`:
```ts
  private snapshotLayers() {
    return [this.ink.read.views[0], this.ink.read.views[1], this.wet.read.views[0], this.relief.views[0], this.cover.read.views[0]];
  }
```

`travel()` pool-0 map `:1628-1631`:
```ts
    const layers = [
      [[ink.read.views[0], ink.write.views[0]], [ink.read.views[1], ink.write.views[1]], [wet.read.views[0], wet.write.views[0]], [this.relief.views[0]], [this.cover.read.views[0], this.cover.write.views[0]]],
      [[this.fixed.views[0]], [this.fixed.views[1]]],
    ];
```

WholeDoc (`LayerId` `:137`, `WholeDoc` `:143`, `captureWhole` `:657-671`, `uploadWhole` `:674-689`, resize copy `:615/626-630`):
```ts
export type LayerId = 'inkA' | 'inkB' | 'fixedA' | 'fixedB' | 'wet' | 'relief' | 'cover';
export interface WholeDoc { w: number; h: number; rect: Rect | null; layers: Record<LayerId, Uint16Array> }
...
        wet: read(this.wet.read.views[0], 1),
        relief: read(this.relief.views[0], 1),
        cover: read(this.cover.read.views[0], 1),
...
    for (const t of [this.cover.read, this.cover.write]) up(t.tex[0], gl.RED, whole.layers.cover);
...
    const old = { targets: this.docTargets(), ink: this.ink.read, fixed: this.fixed, wet: this.wet.read, relief: this.relief, cover: this.cover.read };
    ...
    copy(old.cover, [this.cover.read, this.cover.write]);   // SPIKE 001: and its coverage
```

**Hazard — the 32-bit read path.** `WholeDoc.layers` is typed `Uint16Array` and `captureWhole`/`uploadWhole` go through `Graphics.readHalf` / `uploadHalf` (`packages/efx-watercolor/src/playground/gl.ts:200-249`), which are half-float only. A `FLOAT_R` (R32F) last-touch layer needs either:
1. new `readFloat`/`uploadFloat` helpers in `gl.ts` mirroring `readHalf`/`uploadHalf` (`gl.readPixels(..., gl.RED, gl.FLOAT, ...)`), plus widening `WholeDoc.layers` to `Record<LayerId, Uint16Array | Float32Array>`, **or**
2. storing last-touch as `HALF_FLOAT_R` (loses timestamp precision at large `now` values — measure before deciding).

The plan must pick one explicitly; the skill's target table (`.claude/skills/spike-findings-efx-motion-editor/references/bristle-deposit.md`, "3. Targets") specifies `FLOAT_R`.

#### (e) Stroke start — seed the bristle set here, not per-dab

Scripted path `:1029-1046`:
```ts
  scriptBegin(tool: Tool, x: number, y: number, pressure: number, ...): boolean {
    if (this.stroke) return false;
    ...
    this.stroke = {
      pointerId: SCRIPT_POINTER, pointerType: 'pen', tool, started: false, ending: false,
      x: 0, y: 0, cx: 0, cy: 0, pr: 0, t: this.clock(), speed: 0, simPressure: 0.45, carry: 0, travelled: 0, moved: false,
      dx: this.lastDir[0], dy: this.lastDir[1], angle: this.lastAngle, azimuth: null,
      widthFrom: 1, widthTo: 1,
      pigFrom: null, pigTo: null,
    };
```
Live path `:1784-1790` — the same literal, second site. Both must seed the bristle set (or one shared `beginStroke` helper) from `this.rng` (installed per-stroke by the adapter, `engineAdapter.ts:336-342`). Do **not** draw from `this.rng` anywhere else in the stroke path without accounting for the order: `eachDab` (`:2254-2266`) already draws `scatter`/`sizeJitter` per dab, so seeding at stroke start precedes those draws deterministically.

#### (f) The insertion point for carrier → cover → gather

`stamp()` brush case `:2188-2201` (exact):
```ts
        this.eachDab(s, x, y, r, (dx, dy, dr, angle) => {
          // spec 06: the cover pass draws here, before this dab's deposit
          if (coverAmount > 0) this.coverPass(dx, dy, dr, angle, coverAmount, coverDensity, coverRelief, dryness, grainThr);
          // SPIKE 001: source-over inside the pigment layer, replacing "erase
          // the underlayer, then deposit". No snapshot, no full-document pass,
          // no cached-base punch callback. Body 0 keeps the additive brushInk
          // path unchanged, so the neutral gate stays byte-identical.
          if (coverAmount > 0) this.coverageDeposit(dx, dy, dr, angle, coverAmount, coverDensity, c, c1[3]!, dryness, grainThr);
          else this.brushInk(dx, dy, dr, angle, c0, c1, dryness, grainThr);
          if (reliefAmount > 0) this.brushRelief(dx, dy, dr, angle, reliefAmount, dryness, grainThr);
          // soft brushes wet a little beyond the tip; textured ones keep their
          // edges. A waterless brush never wakes the fluid sim at all.
          if (wet > 0) this.brushWet(dx, dy, dr * (1 + 0.12 * b.wetRound), angle, wet, b.wetRound, dryness, grainThr);
        });
```
Required order (skill §2): `bristleTravel()` → `carrierPass()` **before** `coverPass()` → `coverageDeposit()`/`brushInk()` → `bristleInk()` gather → `brushRelief()` → `brushWet()`. The carrier must sample the canvas **before** the dab deposits.

Per-stamp undo protection pattern that the gather must reuse (`:2171-2187`) — one `touch()` + one `history.protect(1, ...)` per stamp, rect grown by `r * (1 + b.sizeJitter + b.scatter)`:
```ts
          const coverRect = this.stampRect(x, y, r * (1 + b.sizeJitter + b.scatter), this.dw, this.dh, 2);
          this.touch(coverRect);
          const m = PROTECT_MARGIN;
          this.history.protect(1, { x0: Math.max(0, coverRect.x0 - m), ... }, this.fixed.views);
```
`touch()` `:2478-2490` protects pool 0 via `snapshotLayers()` — with the new layer present, one `touch()` covers it automatically.

#### (g) Paper seed — the existing nondeterminism

`:342` `private paperSeed = 0;` · `:334` `private rng: () => number = Math.random;`
```ts
  private createDocument([w, h]: [number, number]) {
    ...
    this.paperSeed = this.rng();          // :574 — rolled once at construction
    this.paperScale = PAPER_UNITS / this.dh;
    ...
    this.drawPaper(this.paper, this.paperOrigin, this.paperScale);
```
```ts
  setPaper(p: PaperPreset) {              // :1189-1194 — never re-seeds
    if (p === this.paperPreset) return;
    this.paperPreset = p;
    this.drawPaper(this.paper, this.paperOrigin, this.paperScale);
    this.redraw();
  }
```
The seed already rides undo state (`:747` `paper: { id, seed: this.paperSeed, origin, scale, strength }`; `:770` restore) and drives `uSeed` in `drawPaper` (`:1298`). The new setter should copy `setLight`'s shape exactly (`:1168-1180`):
```ts
  setLight(next: Partial<LightSettings>) {
    const azimuth = next.azimuth === undefined ? this.light.azimuth : Number.isFinite(next.azimuth) ? next.azimuth : DEFAULT_LIGHT.azimuth;
    ...
    const resolved: LightSettings = { azimuth: ((azimuth % 360) + 360) % 360, elevation: clamp(elevation, 0, 90), intensity: clamp(intensity, 0, 4) };
    if (resolved.azimuth === this.light.azimuth && resolved.elevation === this.light.elevation && resolved.intensity === this.light.intensity) return;
    this.light = resolved;
    this.redraw();
  }
```
i.e. `setPaperSeed(seed?: number)`: non-finite → keep current; equal → return; else assign + `drawPaper(...)` + `redraw()`. `resetSheet()` (`:1574-1582`) must keep its documented promise — "must never re-roll `paperSeed`, redraw the paper or recreate targets" — while clearing the new wetness state to its sentinel.

---

### `packages/efx-watercolor/src/playground/shaders.ts` (shader library)

**Analog:** in-file. Do not create a separate shader module — the skill's Studio touch point names `playground/shaders.ts`; the spike's `bristleShaders.ts` (`workbench/src/playground/bristleShaders.ts`, 359 lines) is a read-as-law source.

**Header pattern** `:12-15`:
```ts
const HEADER = `#version 300 es
precision highp float;
in vec2 vUv;`
```

**The single footprint law** — `FOOTPRINT_MASK` `:476-510` (keep as the ONLY footprint law; the gather's square cull is an early-out only):
```ts
const FOOTPRINT_MASK = `... float footprintMask() { ... float ramp = smoothstep(th, th + 0.5, t); ... f *= 1.0 - smoothstep(0.82, 1.0, max(abs(q.x), abs(q.y))); ... }`
```
**Cover fragment analog** — `bodyCoverFS` `:529-538` (`f = uAmount * mix(m, 1.0 - exp(-uDensity * m), uShape)`); the bristle cover variant replaces `m` with the gathered `coverage` (D-21) and must keep the same blend (`ZERO, ONE_MINUS_SRC_COLOR` into fixed then relief — `Engine.ts:2364-2385`).

**Noise family** — `paperFieldFS` `:638-683` (`pcg`, `hash(vec2 c, float salt)` with `uSeed`, `hash2`, `vnoise`, `fbm`, `cells`, `blobs`). Reuse these helpers for the gather's per-bristle streaks/tooth; the spike's `NOISE` (`bristleShaders.ts:24-52`) duplicates them — copy the **calls**, not the duplicate implementations.

**Deposit / scatter law** — the bristle deposit writes additive absorbance with `S` on `o1.a`: mirror `coverDepositFS` `:562-572` and the `c1[3] = scatteringDeposit(P.body, amount)` law at `Engine.ts:2170`. The spike's shader computes it in GLSL (`bristleShaders.ts:320` `float scatter = pow(clamp(uBody, 0.0, 1.0), 6.0) * amount;`) — that exponent is `bodyCurve`'s GLSL twin; `scattering.ts` remains the one TS declaration (`scattering.test.ts:245-256` pins exactly one `bodyCurve(` call site in the engine).

**Read-as-law gather excerpt** (`workbench/src/playground/bristleShaders.ts:241-297`) — quote the § numbers into the port:
```glsl
  for (int o = -2; o <= 2; o++){
    ...
    float radius = max(shape.x * spacingPx, 0.8);          // §4.1
    float profile = 1.0 - offset * offset; profile *= profile;   // §5.1
    ...
    float ink = profile * min(load * 1.5, 1.0) * touch * broken * landed;   // §3.2
    g.cA += ink * pa; g.cB += ink * pb.rgb; g.alpha += ink * pb.a;
  }
  ...
  float body = mix(wide / 5.0 * presence, local, uHairs);   // §4.5
  float coverage = body * (0.3 + 0.7 * uPressure) * dryEdge;
  g.coverage = smoothstep(threshold - uSoftness, threshold + uSoftness, coverage);
```
Mixing law: coefficient space only — `mix(canvasCoeffs, carriedCoeffs, deposit)`, never RGB. Last-touch stamp reads `mix(prev, uNow, weight)` with `weight = clamp(cover * uAmount, 0, 1)` (`bristleShaders.ts:346-358`) — never an in-place read-modify-write (no compute in WebGL2).

---

### `packages/efx-watercolor/src/playground/brushes.ts` (preset registry)

**Analog:** in-file. `:544-559` is the seam:
```ts
  define({
    id: 'bristle-flat', name: 'Bristle Flat', hint: 'Thick acrylic flat: directional hair marks, hard body',
    group: 'acrylic',
    aspect: 0.28, rotation: 'follow',
    water: 0.05, load: 1.5, flow: 0.5, capacity: 1.8, grain: 0.15,
    spacing: 0.1, roughness: 0.55, stampJitter: 0.06,
    tip: bristleTip,
  }),
  define({
    id: 'bristle-round', name: 'Bristle Round', hint: 'Round acrylic brush with body: springy, loaded hairs',
    group: 'acrylic',
    aspect: 0.7, rotation: 'follow',
    water: 0.06, load: 1.4, capacity: 1.6, grain: 0.15,
    roughness: 0.4, spacing: 0.14,
    tip: bristleTip,
  }),
```
D-26: only these two carry the gather. The plan turns `bristleTip` (`:230-242`, 14 hair segments from `N.rnd()`) into geometric settings **in addition to** the tip — every other preset keeps its tip. `BrushPreset` `:14-71` gains the carrier geometry fields (count/halfWidth derive from `aspect`/`size` already; `pickup`/`refill`/`wetSeconds` are medium params, not preset params — decision for 64-24). `buildBrush` `:569-584` and `brushGroupOf`/`brushSections` `:268-305` need no change.

---

### `packages/efx-watercolor/src/playground/mediums.ts` (record registry)

**Analog:** in-file. `:25-43` is the key union + record:
```ts
export type MediumParamKey =
  | 'water' | 'load' | 'flow' | 'bleed' | 'dry' | 'edge' | 'granulation' | 'viscosity' | 'body' | 'emboss'

export interface MediumRecord {
  readonly id: MediumId
  readonly name: string
  readonly params: Readonly<Record<MediumParamKey, number>>
}
```
Watercolor params are **derived, never retyped** `:60-71`:
```ts
const WATERCOLOR_PARAMS: Readonly<Record<MediumParamKey, number>> = Object.freeze({
  water: DEFAULT_CANONICAL_PARAMS.water, ... emboss: DEFAULT_CANONICAL_PARAMS.emboss,
})
```
Acrylic record `:125-140` (add `pickup`/`refill`/`wetSeconds`; spike defaults `pickup 0.6`, `refill 0.6`, `wetSeconds 7`):
```ts
  Object.freeze({
    id: 'acrylic',
    name: 'Acrylic',
    params: Object.freeze({ water: 8, load: 100, flow: 50, bleed: 10, dry: 70, edge: 65, granulation: 25, viscosity: 90, body: 85, emboss: 40 }),
  }),
```
Rule: adding a key to `MediumParamKey` forces every record to declare it (the type is `Record<MediumParamKey, number>`), so all five records grow the key. `mediumById` `:144-146` never throws.

---

### `packages/efx-watercolor/src/playground/params.ts` (the ONE mapping)

**Analog:** in-file `:119-138`. `AquarelleCanonicalParams` `:16-50` gains `feather`/`pickup`/`refill` (0..100; `wetSeconds` stays record-only, no global) and `toEngineParams` gains the same `/100` + clamp treatment as the 64 keys:
```ts
export function toEngineParams(canonical: ...): Partial<Params> {
  const p = (canonical ?? {}) as Partial<AquarelleCanonicalParams>
  const d = DEFAULT_CANONICAL_PARAMS
  return {
    size: sizeToEngineScale(num(p.size, d.size)),
    water: num(p.water, d.water) / 100,
    ...
    viscosity: clamp01(num(p.viscosity, d.viscosity) / 100),
    body: clamp01(num(p.body, d.body) / 100),
    emboss: clamp01(num(p.emboss, d.emboss) / 100),
  }
}
```
Defaults `:52-65` — new keys default to the value that leaves the shipped output byte-identical (Feather 0 → today's footprint edge; pickup/refill at the spike defaults if they must be non-zero for acrylic… but a default that is *absent* must map neutrally; record `0` here and let the acrylic record carry 60/60). `num()` `:67-69` and `clamp01()` `:77-79` are the only helpers; never inline a second band check.

---

### `packages/efx-watercolor/src/adapter/engineAdapter.ts` (paper seed option)

**Analog:** `AquarelleAdapterOptions.light` `:57-79` — copy the doc-comment shape verbatim for `paperSeed?: number`:
```ts
  /**
   * 64-07 (MED-17): the paint-layer document's emboss light, applied ONCE
   * before the first `applyStroke` so the bake's very first dab is lit. ...
   * Absent leaves the engine's own default in force — the adapter never manufactures one.
   */
  light?: LightSettings
```
**Application site** `:271-276` (one pass-through write, never a clamp/default):
```ts
  if (options.light && engine) {
    engine.setLight({ ...options.light })
  }
```
The paper seed goes **before** this and before `applyPaper` ordering matters — actually after `new WatercolorEngine` (`:236`) and before `applyPaper(undefined, options.paperPreset)` (`:267`), because `drawPaper` binds `uSeed`. `createDocument` rolls the seed from `this.rng()` (`Engine.ts:574`) — but note `setRandom(seededRandom(1))` is installed at `:250`, i.e. *after* the constructor; `createDocument` runs in the constructor, so `paperSeed` today comes from `Math.random`. Installing `options.paperSeed` before the first `drawPaper` is the fix.

**Existing determinism seams to respect:**
- `:249-250` `engine?.setClock(() => virtualNow)` / `engine?.setRandom(seededRandom(1))`
- `:336-342` per-stroke seed — **unchanged**, `traceSeed` is already the bristle RNG key:
```ts
    engine.setRandom(
      seededRandom(
        paintSeedFrame === null ? stroke.traceSeed || 1 : mixStrokeSeed(stroke.traceSeed || 1, paintSeedFrame),
      ),
    )
```
- `:450-459` `resetSheet()` re-installs `seededRandom(1)` — "Same construction-time stream: the sheet is constant across replays". A pinned seed must survive this too.

**Fail-closed construction** `:233-242` (unchanged, but new setup must sit inside the same guarded path).

---

### `packages/efx-watercolor/src/payload/toStudioStroke.ts` (VERIFY ONLY)

**Analog:** `:24` (`traceSeed ← hashMutationId(mutationId)` documented) and `:225`:
```ts
    traceSeed: salt === null ? baseSeed : mixStrokeSeed(baseSeed, salt),
```
Per Claude's Discretion (64-CONTEXT), no new per-stroke field is needed — the bristle set is a pure function of `traceSeed`. The plan should verify this seam and change nothing; `EngineAdapter.configure` already re-installs the stream per stroke. **Do not** add a `bristleSeed` field.

---

### `packages/efx-watercolor/src/bake/aquarelleBake.ts` (conditional)

**Analog:** `:69-81`:
```ts
export interface AquarelleBakePaper {
  readonly paperId: string
  readonly grainStrength: number
  readonly grainScale: number
}

export function aquarellePaperCacheFingerprint(paper: AquarelleBakePaper): string {
  return `paper:${paper.paperId}|str:${paper.grainStrength}|scl:${paper.grainScale}`
}
```
If the recorded paper seed changes the baked pixels (it does — it gates the tooth threshold), the seed **must join the cache fingerprint** or stale WebP frames are served. `AquarelleBakeOptions` `:151-160` carries `paper?`; the seed option should mirror `light`'s precedent: an adapter option plus (if the app passes it via the bake) one additive `options` field. Decide in 64-21.

---

### App call sites — `physicsPaintRotoPlayScriptRenderer.ts` / `physicsPaintRotoPlayScriptController.ts`

**Analog:** the `light` pass-through, both sites (exact):
```ts
  const adapter = createAquarelleEngineAdapter({
    width: input.size.width,
    height: input.size.height,
    paperPreset: paper ? paperPresetForStudioId(paper.paperId) : undefined,
    paperStrength: paper?.grainStrength,
    // 64-07 (MED-17): render state beside the paper — in place before the
    // reveal bake's first stroke.
    light: input.light,
  });
```
```ts
  return createAquarelleEngineAdapter({
    width: size.width,
    height: size.height,
    paperPreset: paper ? paperPresetForStudioId(paper.paperId) : undefined,
    paperStrength: paper?.grainStrength,
    light,
  });
```
`createDefaultAquarelleAdapter(size, paper?, light?)` (`controller:4357-4371`) gains `paperSeed?` in the same positional style. The renderer also builds `createAquarelleBake(adapter, { paper: {...} })` at `:173-181`.

---

### `app/src/components/physic-paint/view/aquarelleRecordState.ts` (params surface)

**Analog:** in-file. `:68-92` interface, `:96-109` frozen key list, `:111-124` defaults, `:131-133` signal. The one-write law for a medium switch `:176-190`:
```ts
export function applyAquarelleMedium(id: string): void {
  const record = mediumById(id); if (record === null) return;
  const current = aquarelleParams.value; const params = record.params;
  const differs = (Object.keys(params) as MediumParamKey[]).some((key) => current[key] !== params[key]);
  if (differs) { aquarelleParams.value = { ...current, ...params }; }
  if (aquarelleSelectedMediumId.value !== record.id) { aquarelleSelectedMediumId.value = record.id; }
}
```
Compare-then-write per-key setter `:392-397`; the per-stroke snapshot loops `AQUARELLE_GLOBAL_KEYS` (`:680-715`, loop at `:691`) so new keys join the recorded bag **automatically** — but only if they are added to the key array at `:96-109`. Three new keys (Feather, Pickup, Refill) → 15 keys; `snapshotAquarelleRecord` needs no edit. D-04 warning: `commitAquarelleSelectionParam(s)` in `aquarellePaintControls.ts` is selection-only and returns null with no selection — never route a medium switch or a global through it without a selection.

---

### `app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx` (13 rows)

**Analog:** in-file `:48-59`:
```ts
const GLOBAL_ROWS: ReadonlyArray<{ key: AquarelleGlobalKey; label: string }> = Object.freeze([
  ... 10 rows ...   // Water / Pigment / Flow / Bleed / Edges / Grain / Dry speed / Viscosity / Body / Emboss
]);
```
Add Feather / Pickup / Refill after Body (order per Claude's Discretion). Everything else is data-driven: `GLOBAL_MIN/GLOBAL_MAX` `:61-62`, `GlobalSlider` → `SliderStepper` (step 1, ariaLabel), row map `:230-238`, `onGlobalChange` → `setAquarelleParam`, `onGlobalCommit` → `commitAquarelleSelectionParam`, reset `:136-144` (loops `GLOBAL_ROWS` with `Math.round(DEFAULT_PARAMS[row.key] * 100)` then one `commitAquarelleSelectionParams(next)`). Narrow signal reads are already the component's style (project rule: no React patterns, signals only).

---

### `app/src/efx-paint/document/efxPaintDocument.ts` + `efxPaintDocumentParsers.ts` (paper seed document field)

**Analog (TS model):** `:23` `export type PaintDocumentLight = LightSettings;` and `:262` `readonly light?: PaintDocumentLight;` — add `readonly paperSeed?: number` beside it.

**Analog (parser):** `normalizeDocumentLight` `:568-602` — the exact fail-closed optional-field shape:
```ts
export function normalizeDocumentLight(value: unknown): PaintDocumentLight | undefined {
  if (value === undefined) return undefined;
  if (!isPlainRecord(value)) { throw new Error('EfxPaintDocument: light must be a record of ...'); }
  const unknown = Object.keys(value).filter((key) => !LIGHT_KEYS.has(key));
  if (unknown.length > 0) { throw new Error(`... unknown members (${unknown.join(', ')}) ...`); }
  for (const key of LIGHT_KEYS) { if (!(key in value)) throw new Error(`... missing member "${key}".`); }
  ... finite / band checks ...
  return Object.freeze({ ... });
}
```
and the truly-absent law in `parseEfxPaintDocument` `:665-676`:
```ts
  const light = normalizeDocumentLight(value.light);
  ...
    ...(light === undefined ? {} : { light }),
```
plus `DOCUMENT_KEYS` `:64` gains the key (it is the primary unknown-member gate). For a scalar seed the normalizer is simpler (`typeof number && Number.isFinite`, finite integer band if the plan picks one), but the "absent stays absent, never a manufactured default" law is identical.

---

### `app/src-tauri/src/models/project.rs` (Rust declaration pin)

**Analog:** `:433-447` — the declaration-class struct (never constructed by the package carrier):
```rust
/// Phase 64-05 (MED-17): the per-paint-layer-document emboss light.
/// Declaration-class pin only (DATA-04 / D-27 pattern): ...
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MceDocumentLight {
    pub azimuth: f64,
    pub elevation: f64,
    pub intensity: f64,
}
```
Add `MceDocumentPaperSeed { pub seed: f64 }` (or a bare `f64` field if the contract test's parse model supports non-struct members — check `parseRustStructs`). Snake_case↔camelCase uses `#[serde(rename = ...)]` (`:458, :463`). The doc comment must state whether the launch envelope/carrier carries it (the light's comment explains why it does NOT).

---

### `app/src/lib/mceFieldContract.test.ts` (dual-language tripwire)

**Analog:** `:154-167` `expectMemberKeys` and the Phase 64 light describe `:446-474`:
```ts
  expectMemberKeys('MceDocumentLight', ['azimuth', 'elevation', 'intensity']);
  // plus the explicit ban on claiming a one-language exception
```
Add a sibling describe for the seed. Header rule `:6-18`: serde silently drops undeclared keys; both directions are bugs; `ALLOWED_ONE_LANGUAGE` is the only sanctioned asymmetry. If the seed ships on TS **and** Rust in the same task, no allowance is needed.

---

### `packages/efx-watercolor/probe/medium-engine/probe.ts` + `run.mjs` (harness)

**Analog:** the twin closed lists and the operand readers. `probe.ts:1309-1318`:
```ts
function readScenario(): string {
  const raw = new URLSearchParams(location.search).get('scenario')
  if (raw === null || raw === '') return 'neutral'
  if (raw !== 'cover' && raw !== 'cover-over-wet' && raw !== 'watercolor-50' && raw !== 'white-over-blue' && raw !== 'cover-advect' && raw !== 'cover-lift' && raw !== 'cover-textured' && raw !== 'red-over-blue-50') {
    throw new Error(...)
  }
  return raw
}
```
`run.mjs:206-217` duplicates that list literally; `:235-240` is the `--brush` operand pattern (reject empty/flag-like only; the page resolves the id):
```js
const brushFlag = args.indexOf('--brush')
const brush = brushFlag >= 0 ? args[brushFlag + 1] : undefined
if (brush !== undefined && (brush === '' || brush.startsWith('--'))) { ... process.exit(1) }
```
Add a bristle scenario (e.g. `bristle-20`) to **both** lists in the same task, plus a `--bristle` / `--bristles <n>` operand if the plan needs to force the count. `readBrush` `:1292-1300` resolves against `BRUSH_PRESETS`; `main()` `:1331-1374` reports `bakeMs`/`renderMs`/digests/`verdict` — `bakeMs`/`renderMs` are measured, never gated (64-17 contract). Gate JSONs land in `/tmp/medium-engine/<gate>.json` (`run.mjs:130-132, 250, 366`); committed references live in `probe/medium-engine/baselines/` and are never written by the tool.

**Measured frontier to gate against** (skill `references/bristle-deposit.md`, "Frontier"): bristle+Body-100 = 675.5 ms @1080² / 1169 ms @2K vs baseline 551.5 / 994 (same Body). The plan states its scenario's delta against **those** numbers, not the no-Medium build.

---

## Pinned Structural Test Suites to Amend (same task as the source change)

These suites derive literal shapes from `Engine.ts`/`shaders.ts` by source slicing. Every one below must be amended **in the same task** that changes the source, or the package suite goes red mid-plan.

### `packages/efx-watercolor/src/playground/relief.test.ts`
- `:121-130` exact allocation pin: `expect(allocations[0]).toBe('this.relief = g.target(this.dw, this.dh, [HALF_FLOAT_R], gl.LINEAR);')`.
- `:137-154` docTargets ordering: `entries[last] === 'this.cover.write'`, `[last-1] === 'this.cover.read'`, `[last-2] === 'this.relief'` → inserting a last-touch pair changes **three** index assertions; the new pair must be appended after `cover.write` (or the test's intent restated).
- `:162-174` pool-0 formats array `['HALF_FLOAT_RGBA','HALF_FLOAT_RGBA','HALF_FLOAT_R','HALF_FLOAT_R','HALF_FLOAT_R']` → becomes six entries including `FLOAT_R`.
- `:177-216` `snapshotLayers` and `travel` pool-0 literal arrays + `pool0[last]`/`[last-1]` index assertions.
- `:226-235` `LayerId` literal and `captureWhole`/`uploadWhole` `toContain` pins.
- `:239-242` resize copy pins (`relief: this.relief`, `copy(old.relief, [this.relief]);`).

### `packages/efx-watercolor/src/playground/coverageLifecycle.test.ts`
- `:229-235` "registers the program outside the pinned 23-entry literal" — the bristle programs follow this pattern; add equivalent presence/order pins if the plan wants them guarded.
- `:281` `LayerId` literal; `:287` pool-0 formats literal; `:294` snapshot literal; `:302` travel pool-0 literal; `:306-313` captureWhole/upload pins.
- `:315-336` **the arithmetic gate**: `expect(formats).toBe(5)`, `expect(snapshot).toBe(5)`, `expect(travelPool0).toBe(5)` plus cross-equalities → becomes **6** (a sixth channel added to only some of the lists must still fail).

### `packages/efx-watercolor/src/playground/scattering.test.ts`
- `:226-243` exactly three `scatteringDeposit(P.body, amount)` sites and the exact `gl.uniform4f(p.u.uColor1, ...)` / `const c1 = [...]` literals — a bristle deposit site that reuses `c1[3]` keeps the count at three; one that adds a fourth call changes it.
- `:245-256` exactly one `bodyCurve(` call site in the engine (the cover pass reads the shared curve). A bristle cover that also reads `bodyCurve` breaks this — prefer passing the already-computed `coverAmount`.
- `:437-462` "declares no additional render target, program or history layer":
  - `:439-442` **eleven** `g.target|g.double` allocations in `allocateTargets()` → twelve with the last-touch pair.
  - `:444-448` **twenty-three** programs inside the literal → unchanged if the new programs register outside it.
  - `:451-456` pool-0 history literal `'{ formats: [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA, HALF_FLOAT_R, HALF_FLOAT_R, HALF_FLOAT_R], documents: 2 }'`.
  - `:457-461` snapshot literal `'return [this.ink.read.views[0], ..., this.cover.read.views[0]];'`.
- `:431-434` fixed-target literal `'this.fixed = g.target(this.dw, this.dh, [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA], gl.LINEAR);'` (unchanged unless fixed grows a third attachment).

### `packages/efx-watercolor/src/determinismContract.test.ts`
- `:217-237` `makeStroke(viscosity?, emboss?, body?)` — extend the parameter list additively (`pickup`/`refill`/`feather`), preserving the "omitting keeps the recorded bag exactly as before" law at `:208-215`.
- `:239-266` `PAPER_SEED = 0xc0ffee` + `withSeededMathRandom(seed, fn)` — **the workaround the recorded paper seed replaces**. Once `options.paperSeed` pins the constructor draw, new rows should pass the seed through the option and the helper can be retired (or kept for pre-seed rows; do not delete a pin a green row still relies on).
- `:268-306` `replayBytes()` / `replayRun(stroke)` — both construct via `withSeededMathRandom(PAPER_SEED, () => createAquarelleEngineAdapter({ width, height, canvas }))`; add seed-passing variants rather than rewriting both helpers in one step.
- `:312-318` double-replay byte equality (`det-paper-baseline` in the spike: `7d58f971` vs `c5594fba` proves today's gap).
- `:320-325` `traceSeed = hashMutationId` projection — unchanged.
- `:440-465` unseeded-RNG source scan covers `src/engine`, `src/payload`, `src/vector` — **not** `src/playground`, so the engine's `Math.random` default is not caught by it; do not assume this gate protects the new file, and do not add `Math.random` to `src/payload`/`src/engine` while pinning the seed.

### `packages/efx-watercolor/src/playground/*.test.ts` (new)
`bristles.test.ts` follows `relief.test.ts`'s source-slice idiom (`sliceBetween(ENGINE_SOURCE, '...', '...')` + exact `toContain`/`toBe` pins). Repo rule: vitest collects only `.test.ts` — a `.test.tsx` target exits 0 while running nothing.

---

## Shared Patterns

### 1. The four-list history rule (applies to 64-24's last-touch channel)
**Source:** `Engine.ts:544-553`, `:556-562`, `:2492-2497`, `:1628-1631` (all carry the same comment: "Grow all three lists together or the atlas copies the wrong layer"), plus `captureWhole`/`uploadWhole` `:657-689` and the resize copy `:615, :626-630`.
**Apply to:** any new pool-0 layer. One channel = six edit sites + WholeDoc + `LayerId` + the arithmetic gate.

### 2. Target allocation + ping-pong
**Source:** `cover` `g.double(...)` (`Engine.ts:538`) and `wet` `g.double(this.dw, this.dh, [HALF_FLOAT_R], gl.LINEAR)` (`:532`).
**Apply to:** the last-touch pair. Upload the initial (sentinel) state into the **write** half then swap, so the first carrier pass reads it. A cleared R32F reads 0 = "touched at t=0" — clear to a one-week-old value.

### 3. Per-dab pipeline order
**Source:** `Engine.ts:2188-2201` (the exact `eachDab` body quoted above).
**Apply to:** `stamp()`'s brush case only (`bristle-flat`/`bristle-round`); pen case `:2225-2233` stays untouched (D-12).

### 4. Fail-closed optional document field, TS + Rust in one pass
**Source:** light end to end — `efxPaintDocument.ts:23, :262` → `efxPaintDocumentParsers.ts:64, :568-602, :665-676` → `project.rs:433-447` → `mceFieldContract.test.ts:154-167, :446-474`.
**Apply to:** the paper seed. Absent stays absent; never manufacture a default; unknown/missing members throw; same-task dual-language update; no `ALLOWED_ONE_LANGUAGE` entry.

### 5. Canonical 0..100 ⇄ engine 0..1, one mapping
**Source:** `params.ts:119-138`; `mediums.ts:60-71` derives from `DEFAULT_CANONICAL_PARAMS` rather than retyping.
**Apply to:** Feather/Pickup/Refill (`/100` + `clamp01`) and the acrylic record keys. Never store mapped values in the payload; never add a second clamp site.

### 6. Determinism / replay
**Source:** `engineAdapter.ts:336-342` (`traceSeed` → `setRandom`), `:450-459` (reset to `seededRandom(1)`), `Engine.ts:574` (the unrecorded paper draw), `toStudioStroke.ts:225`.
**Apply to:** the bristle set (pure function of `traceSeed`, seed order fixed) and the paper seed (recorded, applied before the first `drawPaper`). Do not rely on `Math.random` anywhere on the replay path.

### 7. Probe methodology
**Source:** `probe.ts:1309-1318` + `run.mjs:206-217` twin closed lists; `run.mjs:235-240` operand validation; `main()` `:1331-1374` report shape.
**Apply to:** the bristle scenario and its cost gates. One engine per page; `bakeMs`/`renderMs` measured but not gated; neutral-identity byte equality before believing any delta.

### 8. Preact signal write law (app-side files)
**Source:** `aquarelleRecordState.ts:176-190, :392-397` (compare-then-write, one write per setter).
**Apply to:** every new global. Never write a signal in a render body; never replace `useSignal` with React state (project rule).

---

## Read-As-Law Sources (tracked, NOT files to copy verbatim)

| Source | What it dictates |
|---|---|
| `.planning/spikes/002-acrylic-bristle-deposit/workbench/src/playground/bristles.ts` (99 lines) | count/stride/seed-order table; port into `playground/bristles.ts` with the house banner and unit test |
| `.planning/spikes/002-acrylic-bristle-deposit/workbench/src/playground/bristleShaders.ts` (359 lines) | carrier/gather/cover/touch fragment structure and the § citations (§3.1–§5.5); re-derive against this tree's `FOOTPRINT_MASK`, `bodyCoverFS`, noise family |
| `.planning/spikes/002-acrylic-bristle-deposit/README.md` | formula table with § numbers, 64-21…64-24 slicing, non-portable list (no compute passes, no dual f16 buffers, no RGB smear, no smudge/wipe/resample) |
| `.claude/skills/spike-findings-efx-motion-editor/references/bristle-deposit.md` | targets table, per-dab order, measured costs, determinism contract, frontier numbers |
| `.planning/spikes/002-acrylic-bristle-deposit/workbench/src/playground/Engine.ts` | the spike's `stamp()` on top of spike 001 — layout reference only; predates 64-20's `advectCover`/`coverClear`/`FILM_PRESENCE` |
| `/Users/lmarques/Dev/craft-brushes/notes/brush-blending.md` | §-numbered reverse engineering; every formula must cite its § |

## No Analog Found

| File / concern | Role | Data flow | Reason |
|---|---|---|---|
| `Engine.ts` — a `1 × 256` document-independent static target | engine core | — | Every existing target is document-sized or a sim grid; `allocateTargets()` is document-scoped. The plan must place this in the constructor/dispose path, outside `allocateTargets`/`docTargets`. |
| `gl.ts` — 32-bit read/upload of a `FLOAT_R` layer | utility (GL helper) | file-I/O analogue | `gl.ts` only has `readHalf` (`:200-238`) and `uploadHalf` (`:241-249`). Either add a float path or use `HALF_FLOAT_R`; see hazard above. |
| A fragment-pass reservoir carrier (`1 × 256`, MRT ping-pong) | shader | GPU transform | No compute passes exist; nearest structural precedent is `advectCover`'s double-buffered MRT fragment pass (`coverageLifecycle.test.ts:239-274`), not a per-bristle invocation. Follow the spike law, not an in-tree copy. |

## Metadata

**Analog search scope:** `packages/efx-watercolor/src/playground/`, `src/adapter/`, `src/bake/`, `src/payload/`, `probe/medium-engine/`, `app/src/components/physic-paint/`, `app/src/efx-paint/document/`, `app/src/lib/`, `app/src-tauri/src/models/`, `.planning/spikes/002-acrylic-bristle-deposit/`
**Files scanned:** 21 production/test sources + 5 spike artifacts (all git-tracked; verified via `git ls-files`)
**Pattern extraction date:** 2026-11-19
