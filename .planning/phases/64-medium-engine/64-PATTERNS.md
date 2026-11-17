# Phase 64: Medium Engine - Pattern Map

**Mapped:** 2026-11-17
**Files analyzed:** 24 (14 modified, 3 new, 7 test surfaces)
**Analogs found:** 23 / 24 (one partial: the new medium-record module)

Every path below is git-tracked source, verified with `git ls-files`. Line numbers were
re-read from the live tree (CONTEXT.md's cited lines had drifted) and are accurate as of
this mapping.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/efx-watercolor/src/playground/params.ts` | model | transform | itself — `toEngineParams` is the ONE mapping | exact (self-extension) |
| `packages/efx-watercolor/src/playground/mediums.ts` **(NEW)** | model | static data / CRUD-read | `playground/brushes.ts` (`BASE` + `define`) + `params.ts` (`DEFAULT_CANONICAL_PARAMS`) | role-match |
| `packages/efx-watercolor/src/playground/brushes.ts` | model | static data | itself — `define()` / `BRUSH_PRESETS` table | exact (self-extension) |
| `packages/efx-watercolor/src/playground/index.ts` | config | export barrel | itself (line 13–34 export block) | exact (self-extension) |
| `packages/efx-watercolor/src/playground/Engine.ts` | engine service | event-driven (per-dab) + stateful GPU | itself — `lift()`, `brushInk()`, `allocateTargets()`, `captureWhole()` | exact (self-extension) |
| `packages/efx-watercolor/src/playground/shaders.ts` | GPU program | transform | itself — `stampFS`, `liftFS`, `paperLightFS`, `displayFS` | exact (self-extension) |
| `packages/efx-watercolor/src/adapter/engineAdapter.ts` | adapter | batch replay | `AquarelleAdapterOptions` + `applyPaper` (249–261) | exact (self-extension) |
| `app/.../view/aquarelleRecordState.ts` | store | CRUD | `setAquarelleParam` (308–313), `selectAquarelleTip` (373–409) | exact (self-extension) |
| `app/.../view/AquarelleGlobalsPanel.tsx` | component | request-response | `GLOBAL_ROWS` (31–39), `GlobalSlider` (44–64), `onReset` (86–94) | exact (self-extension) |
| `app/.../view/PhysicsPaintTextureMenu.tsx` (analog only) | component | popover/event | fixed-position `role="menu"` + outside-close effect (33–101) | role-match |
| `app/.../view/aquarellePaintControls.ts` | controller | event handler seam | `pickAquarelleBrush` (42–51) | exact (self-extension) |
| `app/.../view/WatercolorBrushLibrary.tsx` | component | list render | `BrushSection` (288–326), `BrushCard` (251–282) | exact (self-extension) |
| `app/.../view/RightPanelPaperTab.tsx` | component | request-response | `PaperPicker` grain rows + props threading | role-match |
| `app/.../view/PhysicsPaintRightPanel.tsx` | component | wiring | paper-tab props block (335–348) | exact |
| `app/.../engine/AquarelleCanvasLayer.tsx` | integration | rAF / event-driven | `applyLiveConfig` (311–356), `applyPaper` (721–736) | exact |
| `app/src/efx-paint/document/efxPaintDocument.ts` | model | persistence shape | `grainScale` optional member + `normalizeGrainScale` (36–62) | role-match |
| `app/src/efx-paint/document/efxPaintDocumentParsers.ts` | parser | fail-closed | `DOCUMENT_KEYS` allowlist (63), `parseBackgroundFallback` (297–338) | exact |
| `app/src/types/project.ts` | types (TS) | persistence | `McePaperDisplayState` (293–297) | exact |
| `app/src-tauri/src/models/project.rs` | types (Rust) | persistence | `McePaperDisplayState` (427–433) + serde renames | exact |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | integration | cache seam | `getContentSignature` (1368) | exact |
| `app/.../snapshot/studioScriptSnapshotController.ts` | service | cache contract | `getContentSignature` deps doc (122–127) | role-match (doc + tests only) |
| `app/src/lib/mceFieldContract.test.ts` | test | contract | `expectMemberKeys` (154–167) | exact (self-extension) |
| `packages/.../playground/params.test.ts` | test | numeric pin | literal-table pin (whole file) | exact (self-extension) |
| `packages/.../playground/shaders.test.ts` | test | source pin | string-contains shader pin | exact (self-extension) |
| `packages/.../determinismContract.test.ts` | test | replay pin | double-replay byte equality (272–286) | role-match |
| `packages/.../playground/dryMedia.test.ts` | test | preset law | group-of-presets + shader pin | role-match |
| `app/.../view/AquarelleGlobalsPanel.test.ts` | test | component pin | existing row/Reset pins | exact (self-extension) |

`app/.../view/aquarelleStrokeSelection.ts` is a **negative reference only** — D-04 says a
medium switch must never route through it. No edit expected; see "Negative references".

---

## Pattern Assignments

### `packages/efx-watercolor/src/playground/params.ts` (model, transform)

**Analog:** itself — this file already owns the only canonical ↔ vendor translation.

**Mapping law** (lines 42–44, 84–100):
```ts
function num(v: number | undefined, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

export function toEngineParams(canonical): Partial<Params> {
  return {
    size: sizeToEngineScale(num(p.size, d.size)),
    water: num(p.water, d.water) / 100,
    ...
    lift: num(p.lift, d.lift) / 100,
  }
}
```

**Invariant the new code must respect:** `viscosity`, `body`, `emboss` enter
`AquarelleCanonicalParams` + `DEFAULT_CANONICAL_PARAMS` (0..100 canonical) and are divided by
100 *here and nowhere else*. Never read the canonical bag directly in the engine. Non-finite
input falls back to the default — never NaN. Header comment at 1–8 states the law: "Live and
bake BOTH map through toEngineParams() so the two halves cannot drift".

`DEFAULT_CANONICAL_PARAMS` (30–40) is the neutral-by-default carrier: the three new keys
default to `0`, so a pre-milestone stroke maps exactly as today.

---

### `packages/efx-watercolor/src/playground/mediums.ts` (NEW) (model, static data)

**Analogs:** `playground/brushes.ts` (the frozen data-table idiom) and `params.ts`
(`DEFAULT_CANONICAL_PARAMS` as the neutral record).

**Data-table idiom** (`brushes.ts:213–221`):
```ts
const BASE: Omit<BrushPreset, 'id' | 'name' | 'hint' | 'tip'> = { aspect: 1, ... };
const define = (p: Partial<BrushPreset> & Pick<BrushPreset, 'id' | 'name' | 'hint' | 'tip'>): BrushPreset =>
  ({ ...BASE, ...p });
```

**Frozen constant idiom** (`params.ts:30`):
```ts
export const DEFAULT_CANONICAL_PARAMS: Readonly<AquarelleCanonicalParams> = Object.freeze({ ... });
```

**Invariant:** a medium is `{ id, name, params }` — a plain serializable record, no class,
no function, no hidden behaviour (spec 04 §1). Five built-ins, fixed ids
(`watercolor | gouache | pastel | graphite | acrylic`); the `watercolor` record IS
`DEFAULT_CANONICAL_PARAMS` with every new key 0 (spec 04 amendment). Medium params must be
typed as a subset/Pick over the canonical bag so a medium can never invent a field. Export
through `playground/index.ts` (13–34) so the app imports from `@efxlab/efx-watercolor`
(the package root re-exports `./playground`, `src/index.ts:15`).

---

### `packages/efx-watercolor/src/playground/brushes.ts` (model, static data)

**Analog:** itself — `BrushPreset` (11–60), `BASE`/`define` (213–221), `BRUSH_PRESETS`
(223–391), `buildBrush` (400–415).

**Invariant:** strictly additive.
- Add `group?: 'watercolor' | 'gouache' | 'pastel' | 'graphite' | 'acrylic'` to
  `BrushPreset` (11–60). Compile-time TS only — no Rust, no serialized format, no
  machine-library change (spec 07 §1). An absent `group` reads as `watercolor`.
- **Never rename or remove an existing preset id.** The id is persisted in strokes and
  `presetFor()` falls back to `round`; `BRUSH_PRESETS` array order IS the display order
  (spec 07 guardrail).
- The 8 new responses use `define({...})` on top of `BASE` so every unlisted field keeps the
  base value — that is what keeps a new preset's behaviour predictable.
- Procedural tips are generated in tip space (`tip()` helper at 185–197) and are
  deterministic (seeded by `hashString(preset.id)` in `buildBrush`), so the acrylic bristle
  striation must be a procedural tip, never a machine-scoped texture.

---

### `packages/efx-watercolor/src/playground/Engine.ts` (engine service, event-driven)

**Analog:** itself. Seven distinct sub-patterns, each with its own invariant.

**(a) Params bag — additive keys only** (15–30):
```ts
export interface Params {
  size: number; water: number; load: number; flow: number; bleed: number;
  dry: number; edge: number; granulation: number; lift: number;
}
export const DEFAULT_PARAMS: Params = { size: 0.5, water: 0.6, ..., lift: 0.22 };
```

**(b) Target allocation + memory gauge** (164–167, 404–431):
```ts
const HALF_FLOAT_R: Format = { internal: GL_R16F, format: GL_RED, type: GL_HALF_FLOAT };
...
this.wet = g.double(this.dw, this.dh, [HALF_FLOAT_R], gl.LINEAR);
this.paper = g.target(this.dw, this.dh, [RGBA8], gl.LINEAR);
...
this.history = new History(this.g, this.dw, this.dh, [
  { formats: [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA, HALF_FLOAT_R], documents: 2 }, // pool 0
  { formats: [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA], documents: 1 },               // pool 1
]);
private docTargets(): Target[] { return [this.velocity.read, ..., this.wetMask]; }
```

**Invariant:** exactly ONE new target — `this.relief = g.target(this.dw, this.dh,
[HALF_FLOAT_R], gl.LINEAR)` beside the other document targets. It must also join
`docTargets()` (so `clear()` / `resizeDocument()` dispose-and-recreate it) and the memory
gauge comment block. If relief joins undo pool 0, **pool 0's `formats` array must gain
`HALF_FLOAT_R` and `snapshotLayers()` must list the relief framebuffer** — the two lists are
positionally paired; a mismatch corrupts undo.

**(c) Per-dab loop — the ONE seam for both new draws** (1922–1950, 1997–2009, 2011–2044):
```ts
this.eachDab(s, x, y, r, (dx, dy, dr, angle) => {
  this.brushInk(dx, dy, dr, angle, c0, c1, dryness, grainThr);
  if (wet > 0) this.brushWet(...);
});
...
private eachDab(s, x, y, r, fn) { ... fn(dx, dy, dr, this.brushAngle(s)); }
...
private brushInk(...) {
  this.touch(this.stampRect(x, y, r, this.dw, this.dh, 1.5));
  gl.enable(gl.BLEND); gl.blendEquation(gl.FUNC_ADD); gl.blendFunc(gl.ONE, gl.ONE);
  this.drawStamp(this.ink.read, x, y, r, angle, c0, c1, 0, grain, grainThr);
  gl.disable(gl.BLEND);
}
```

**Invariant:** the cover pass and the thickness deposit both slot inside this callback —
cover **before** `brushInk`, thickness deposit before or after (different targets). The
deposit amount is the dab's own `amount` (computed at 1934) × `P.emboss` (D-10) — no second
load/capacity term. `case 'pen'` (1968–1976) takes neither: it splats via `splatInk`
(2102–2111), has no tip footprint and no dab loop (D-12 declared behaviour).

**(d) Cover pass — reuse the Lift program, protect both pools first** (2143–2182):
```ts
private lift(x, y, r, angle, amount) {
  const b = this.liftBrush ?? this.brush;
  const rect = this.stampRect(x, y, r, this.dw, this.dh, 2);
  this.touch(rect);
  const m = PROTECT_MARGIN;
  this.history.protect(1, { ...rect expanded by m... }, this.fixed.views);
  const p = this.programs.lift; p.bind();
  gl.uniform1f(p.u.uRound, 0);
  gl.enable(gl.BLEND); gl.blendEquation(gl.FUNC_ADD);
  gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR);
  gl.uniform1f(p.u.uAmount, amount);
  g.draw(this.ink.read, rect);   // ... this.wet.read, this.fixed
  gl.disable(gl.BLEND);
}
```

**Invariant (ordering hazard, spec 06 §4):** the cover pass runs before `brushInk`, so
`brushInk`'s own `touch()` protection is too late. The cover pass must protect **pool 0
(relief included)** and **pool 1 (fixed)** itself, before its first draw. The
protect-both-pools-before-mutating idiom already exists in `clear()` (1384–1398):
```ts
if (this.everPainted) {
  this.history.protect(0, this.everPainted, this.snapshotLayers());
  this.history.protect(1, this.everPainted, this.fixed.views);
}
for (const t of this.docTargets()) if (t !== this.paper) g.clearTarget(t);
```
`body = 0` takes **no** cover pass at all (bit-identity gate). `uAmount = min(1, P.body)` —
not the Lift tool's own `0.9` clamp (spec 06 §3).

**(e) Whole-document snapshot — thickness lives with the paint** (64–70, 524–550):
```ts
export type LayerId = 'inkA' | 'inkB' | 'fixedA' | 'fixedB' | 'wet';
export interface WholeDoc { w: number; h: number; rect: Rect | null; layers: Record<LayerId, Uint16Array>; }
```
`captureWhole()` reads every `LayerId`; `uploadWhole()` uploads every one with
`g.uploadHalf(tex, ..., format, data)`. Add `relief` to `LayerId` and both bodies — or a
restored sheet loses thickness while its strokes survive (spec 05 §7). It is document-grid,
so it obeys the same crop `rect`.

**(f) Final composite bindings** (2376–2405):
```ts
gl.uniform1i(p.u.uInkA, g.bindTex(0, this.ink.read.tex[0]));
... uInkB 1, uFixedA 2, uFixedB 3, uWet 4, uPaper 5
gl.uniform1i(p.u.uRef, g.bindTex(6, ref ? ref.tex : this.paper.tex[0]));
```
**Invariant:** units 0–6 are taken; the thickness sampler takes **unit 7**. Add
`uniform1f(p.u.uLightAzimuth/uLightElevation/uLightIntensity, ...)` here — the app sets them
once per document, so they are plain uniforms, not per-draw state.

**(g) The two — and only two — viscosity sites** (2227, 2275):
```ts
gl.uniform1f(P.advectVelocity.u.uDissipation, Math.exp(-dt * (3.0 - flow * 2.4)) * (fixing ? Math.exp(-dt * 7) : 1));
...
gl.uniform1f(P.advectWet.u.uSpread, 0.12);
```
**Invariant:** viscosity may only **raise** dissipation (additive term inside the existing
`exp`, never replacing `flow`) and spread becomes exactly `0.12 * (1 - viscosity * 0.9)`.
Both already-applied sites are the same frame loop — no third site, no per-stroke re-read of
settled pigment.

**(h) Idempotent public setters — the engine-side compare-then-write law** (752, 1013–1030):
```ts
setParams(p: Partial<Params>) { Object.assign(this.params, p); }
set paperTexture(v: number) { v = clamp(v, 0, 1); if (v === this.paperStrength) return; this.paperStrength = v; this.redraw(); }
setPaper(p: PaperPreset) { if (p === this.paperPreset) return; this.paperPreset = p; this.drawPaper(...); this.redraw(); }
```
**Invariant:** the new `setLight()` follows `setPaper`/`paperTexture` exactly — clamp,
compare, assign, `redraw()`. `redraw()` (1290) only sets `dirtyAll` + schedules: it never
touches paint.

**(i) Program registration** (328–350): add the new fragment program to the
`this.programs` record beside `lift`/`stamp`. One program, one entry; no second program for
the cover pass (it reuses `lift`).

---

### `packages/efx-watercolor/src/playground/shaders.ts` (GPU program, transform)

**Analog:** itself. The header comment block (3–9) documents the target layout and must be
updated with the relief channel.

**Footprint computation to mirror — `stampFS`** (46–73):
```glsl
vec2 p = vUv - uPoint; p.x *= uAspect;
vec2 q = vec2(dot(p, uAxis), dot(p, vec2(-uAxis.y, uAxis.x))) / uRadius;
q.y /= uTipAspect;
float a = uTipRotation;
vec2 tq = vec2(q.x * cos(a) - q.y * sin(a), q.x * sin(a) + q.y * cos(a));
if (abs(q.x) > 1.0 || abs(q.y) > 1.0) discard;
...
float t = texture(uTip, uv).r;
...
float h = texture(uPaper, vUv).g;
f *= mix(1.0, smoothstep(uGrainThr - 0.08, uGrainThr + 0.08, h), uGrain);
```

**Invariant:** the thickness deposit program is a single-output copy of this footprint —
same tip sample, `uAspect`/`uTipAspect`/`uTipRotation`/`uRound`, and the **same**
`uGrain`/`uGrainThr` paper-tooth gate (spec 05 §2). The **cover pass does not** add that gate
(D-11: uniform erase, no speckles) — it reuses `liftFS` verbatim (280–300), whose envelope is
`uAmount * exp(-pow(dot(q,q), 2.0)) * mix(t, 1.0, uRound)` with the unconditional square crop.

**Light maths to reuse — `paperLightFS`** (528–542):
```glsl
float l = texture(uField, vUv - vec2(uTexel.x, 0.0)).x, r = texture(uField, vUv + vec2(uTexel.x, 0.0)).x;
float b = texture(uField, vUv - vec2(0.0, uTexel.y)).x, t = texture(uField, vUv + vec2(0.0, uTexel.y)).x;
vec3 n = normalize(vec3((l - r) * uBump, (b - t) * uBump, 1.0));
vec3 L = normalize(vec3(-0.5, 0.6, 0.62));
float lit = 0.5 + (dot(n, L) - L.z) * 1.3 + (f.x - 0.5) * 0.25;
```

**Invariant:** the emboss derives its normal the same way at **one document texel** (D-13),
but `L` comes from `uLightAzimuth`/`uLightElevation` normalised in the shader, and the term
is a **gradient** — at zero thickness it must yield exactly `1.0` (D-09), so zero thickness is
byte-identical at any intensity. `uLightIntensity = 0` is also exactly `1.0` (spec 05
guardrail: mix with factor 0, never multiply by a small number).

**Composite — `displayFS`** (620–742). Three anchored facts:
```glsl
float k = mix(gran * (1.0 + uEdgeDarken * edge), 1.0, uFlat);
a *= k; b *= k;                                     // 675-676 — D-16: also scale S
...
float cov = 1.0 - exp(-2.2 * iB.a);                 // 683 — spec 08 retires this channel
...
if (uMode == 2) { ... return; }                     // 687
if (uMode == 4) { ... return; }                     // 701
...
vec3 col = rgb * paperCol;                          // 728 — D-15: stays THE final multiply
```
**Invariant:** `paperCol` stays the final RGB multiply on **every** `uMode` path (D-15). The
KM scattering path runs only where `S` is non-zero; `S ≈ 0` takes an early-out using today's
exact `exp(-K)` arithmetic (D-17) — the old maths literally runs, so the watercolor path costs
what it costs today. Granulation/edge modulation must scale the scattering scalar too
(D-16). The `settleFS` body (248–258, `oB = vec4(B.rgb * uSettle * keep, 0.0)`) and
`bleachFS` (262–271) are where `fixedB.a` is zeroed today — spec 08 carries `S` through there
and retires the bleach path.

---

### `packages/efx-watercolor/src/adapter/engineAdapter.ts` (adapter, batch replay)

**Analog:** `AquarelleAdapterOptions` (57–70) + `applyPaper` (249–261):
```ts
export interface AquarelleAdapterOptions { width?: number; height?: number; canvas?: HTMLCanvasElement; paperPreset?: PaperPreset; paperStrength?: number }
...
const applyPaper = (paper, preset): void => {
  if (!engine) return
  const resolved = preset ?? resolveBakePaperPreset(paper, options.paperPreset)
  if (resolved) engine.setPaper(resolved)
  const strength = paper?.grainStrength
  if (typeof strength === 'number' && Number.isFinite(strength)) engine.paperTexture = clamp01(strength)
}
applyPaper(undefined, options.paperPreset)      // BEFORE the first applyStroke
```

**Invariant:** the document light is a render setting like the paper, so it must be applied
here **before the first `applyStroke`** — otherwise a re-bake on a replayed sheet lights the
new thickness with today's light while the live canvas used the document's. Clamp +
finite-check exactly as `paperTexture` does; absent options keep the default light.

---

### `app/src/components/physic-paint/view/aquarelleRecordState.ts` (store, CRUD)

**Analog:** itself.

**Bag + key list + defaults** (61–111):
```ts
export interface AquarelleGlobalParams { size: number; water: number; ...; lift: number; }
export type AquarelleGlobalKey = keyof AquarelleGlobalParams;
export const AQUARELLE_GLOBAL_KEYS: readonly AquarelleGlobalKey[] = Object.freeze([ 'size', 'water', ..., 'lift' ]);
export const DEFAULT_AQUARELLE_PARAMS: Readonly<AquarelleGlobalParams> = Object.freeze({ ..., lift: 22 });
export const aquarelleParams = signal<AquarelleGlobalParams>({ ...DEFAULT_AQUARELLE_PARAMS });
```

**Compare-then-write law** (308–313):
```ts
export function setAquarelleParam(key: AquarelleGlobalKey, value: number): void {
  if (!Number.isFinite(value)) return;
  const current = aquarelleParams.value;
  if (current[key] === value) return;
  aquarelleParams.value = { ...current, [key]: value };
}
```

**Invariant:**
- `viscosity`, `body`, `emboss` join the interface, the key list **and** the defaults (all
  0). Adding a key to the interface without the key list is a silent hole: `snapshotAquarelleRecord`
  (588–623) iterates `AQUARELLE_GLOBAL_KEYS`, so a key missing from the list is never
  recorded and a stroke replays with the engine default.
- The medium application is ONE spread assignment on this bag in one handler (D-04):
  `aquarelleParams.value = { ...current, ...mediumParams }`, plus the selected-medium id in
  its own signal — never a `setAquarelleParam` cascade. Follow the compare-then-write shape:
  build `next` and only assign if it actually differs.
- `snapshotAquarelleRecord` (588–623) already snapshots every key at record time — that is
  the "per-stroke params authoritative, medium id advisory" law. Nothing extra needed beyond
  the key-list membership.
- **Selection-edit allowlist** (1013–1028): `updateAquarelleStrokesInScript` refuses the
  WHOLE batch if any param key is not in `AQUARELLE_GLOBAL_KEYS`. So the new keys must be in
  the list or a slider release on them silently no-ops (returns 0). This is the mirror image
  of the recording hole — one list, two consumers.
- A new `aquarelleSelectedMediumId = signal<string | null>('watercolor')` follows the
  `aquarelleSelectedTipId`/`setAquarelleSelectedTextureId` idiom (116, 336–339): narrow
  read, compare-then-write setter.

---

### `app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx` (component, request-response)

**Analog:** itself — `GLOBAL_ROWS` (31–39), `GlobalSlider` (44–64), `onReset` (86–94):
```tsx
const GLOBAL_ROWS: ReadonlyArray<{ key: AquarelleGlobalKey; label: string }> = Object.freeze([
  { key: 'water', label: 'Water' }, { key: 'load', label: 'Pigment' }, ...
]);
...
<div class="physics-paint-option-row">
  <SliderStepper label={props.label} value={...} onChange={props.onChange} onCommit={props.onCommit}
    step={1} min={0} max={100} ariaLabel={props.label} />
</div>
...
const onReset = () => {
  const next: Record<string, number> = {};
  for (const row of GLOBAL_ROWS) {
    const value = Math.round(DEFAULT_PARAMS[row.key] * 100);
    next[row.key] = value;
    setAquarelleParam(row.key, value);
  }
  void commitAquarelleSelectionParams(next);
};
```

**Invariant:** the medium dropdown is the **first row**, then the 10 global rows. Adding
rows is data-only — `GLOBAL_ROWS` drives both the render and the Reset batch, so Reset
automatically covers exactly the rows present. **But** Reset must cover exactly the 10
medium keys and never `size` (not a row) and never `lift` (the eraser popover owns it) — so
`lift` must NOT gain a `GLOBAL_ROWS` entry, and the Reset loop must stay over the rows only.
`DEFAULT_PARAMS[row.key] * 100` requires the engine default to exist for each new key.

The Continuous `onChange` → `setAquarelleParam`, release `onCommit` → selection commit split
(71–79) is the existing contract; new rows inherit both for free.

---

### Medium dropdown row (component, popover/event) — analog `PhysicsPaintTextureMenu.tsx`

**Analog:** `PhysicsPaintTextureMenu` (33–101):
```tsx
const open = aquarelleTextureMenuOpen.value;
const anchor = aquarelleTextureMenuAnchor.value;
useEffect(() => {
  if (!open) return undefined;
  const onPointerDown = (event) => { ... if (menuRef.current?.contains(target)) return; setOpen(false); };
  const onKeyDown = (event) => { if (event.key !== 'Escape') return; setOpen(false); event.preventDefault(); event.stopPropagation(); };
  window.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('keydown', onKeyDown, true);
  return () => { ... };
}, [open]);
if (!open || anchor === null) return null;
```

**Invariant:** event-handler-only state writes; `role="menu"`; outside-pointerdown and Escape
close, both captured at window level. The open/close signal is compare-then-write. The
**pick** handler is D-03: picking the already-selected medium must still re-apply the full
record, so the medium id setter may early-return on equality but the params write must not be
skipped when the params actually drift. The row shell reuses `physics-paint-option-row` so it
lines up with the slider rows directly below it.

---

### `app/src/components/physic-paint/view/aquarellePaintControls.ts` (controller, event seam)

**Analog:** `pickAquarelleBrush` (42–51) + `PAINT_ONLY` (28):
```ts
export function pickAquarelleBrush(presetId: string): Promise<boolean> | null {
  selectAquarelleTip(presetId);
  return commitAquarelleSelectionAppearance(
    { brushId: presetId, toolOverrides: { ...aquarelleToolOverrides.peek() } },
    PAINT_ONLY,
  );
}
```

**Invariant:** the group → medium application runs **inside this one handler**, after the
response pick, and **only when the group changed** (D-05). One store write for the params bag
plus one medium-id write; no per-key setter cascade; never from a render body. The selection
commit path (`commitAquarelleSelectionParams`) remains selection-only and is **not** the
medium path — see Negative references.

---

### `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx` (component, list)

**Analog:** `BrushSection` (288–326) + `BrushCard` (251–282) + library root (333–374):
```tsx
function BrushSection(props: { id: 'responses'; title: string; children?: ComponentChildren }) {
  return (
    <section data-testid={`watercolor-brush-section-${props.id}`}
      style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div class="watercolor-brush-section-title"
        style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em',
                 textTransform: 'uppercase', color: 'var(--sidebar-text-secondary, #9aa5b1)' }}>
        {props.title}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>{props.children}</div>
    </section>
  );
}
...
<div data-testid="watercolor-brush-import-row" style={{ gridColumn: '1 / -1' }}>
  <WatercolorTextureStrip /><WatercolorTextureImport />
</div>
<BrushSection id="responses" title="Brushes">
  {BRUSH_PRESETS.map((preset) => <BrushCard key={preset.id} ... />)}
</BrushSection>
```

**Invariant:** widen `BrushSection`'s `id` from the literal `'responses'` to the group union;
render five sections in the fixed order `WATERCOLOR · GOUACHE · CHALK · GRAPHITE · ACRYLIC`
(D-18/D-19), each with its own 2-column grid. `BrushCard` unchanged (D-20: no extra group
indication). The texture strip + import row stay above the grid, untouched. A group with no
reachable response is simply not rendered. No collapse, no filter, no search, no counts.

---

### `app/src/components/physic-paint/view/RightPanelPaperTab.tsx` (component, request-response)

**Analog:** the tab's prop-threading shape (11–37) plus `PaperPicker`'s row idiom —
`SliderStepper` with `step`/`min`/`max`/`ariaLabel` inside a titled section.

**Invariant:** the three light rows go **below** the paper-grain rows; the tab heading
becomes "Paper & Light" (D-06). Every new prop is `optional` with a default equal to today's
light (D-09) — the tab is mounted from `PhysicsPaintRightPanel` and from nothing else, but an
absent prop must never produce NaN or a different image. Value flow is
`prop → onChange` upward, never a direct store write inside the tab (the tab stays a
presentational port, like `PaperPicker`).

---

### `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` (component, wiring)

**Analog:** the paper-tab props block (335–348):
```tsx
<RightPanelPaperTab
  paperId={paperId} background={background}
  grainStrength={grainStrength} grainScale={grainScale}
  onPaperIdChange={onPaperIdChange} onBackgroundChange={onBackgroundChange}
  onGrainStrengthChange={onGrainStrengthChange} onGrainScaleChange={onGrainScaleChange}
  disabled={engineControlsDisabled}
/>
```

**Invariant:** the light props join this exact block, sourced from the **per paint-layer
document record** (D-08) — the same record the paper rides — not from project-wide settings.
Keep `disabled={engineControlsDisabled}` on the new controls.

---

### `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` (integration, rAF)

**Analog:** `applyPaper` (721–736) — the exact guard-diffed document-render-setting apply:
```ts
let lastPaperId = ''; let lastPaperStrength = -1;
const applyPaper = () => {
  const paperId = getPaperIdRef.current();
  const strength = getPaperGrainStrengthRef.current?.();
  const nextStrength = typeof strength === 'number' && Number.isFinite(strength)
    ? Math.max(0, Math.min(1, strength)) : -1;
  if (paperId === lastPaperId && nextStrength === lastPaperStrength) return;
  lastPaperId = paperId; lastPaperStrength = nextStrength;
  engine.setPaper(paperPresetForStudioId(paperId));
  if (nextStrength >= 0) engine.paperTexture = nextStrength;
};
applyPaper();
```

**Invariant:** the light follows this shape — getters (never value props, so the canvas mount
memo stays stable), a last-value guard, engine setter, and **no redraw of paint** (the engine
setter owns `redraw()`). `applyLiveConfig` (311–356) is where the live params bag reaches the
engine — `engine.setParams(toEngineParams({ ...aquarelleParams.value, size: aquarelleActiveCanonicalSize() }))`;
the new globals ride that call for free once `toEngineParams` knows them. Never write a
signal from this layer's render body.

---

### `app/src/efx-paint/document/efxPaintDocument.ts` (model, persistence shape)

**Analog:** the optional-member + normalize idiom (36–62):
```ts
export const GRAIN_SCALE_MIN = 0.1; export const GRAIN_SCALE_MAX = 10;
export function isGrainScaleValue(value: unknown): value is number { ... }
export function normalizeGrainScale(value: unknown): number { return isGrainScaleValue(value) ? value : 1; }
...
| { readonly mode: 'paper'; readonly texture: PaperTexture; readonly grainStrength: number;
    readonly grainScale?: number; }
```

**Invariant:** the light is an **optional** member of the document record with a `DEFAULT_*`
constant equal to today's light (azimuth/elevation from `paperLightFS`'s
`normalize(vec3(-0.5, 0.6, 0.62))`, intensity 1.0) and a `normalize*` helper that maps
absent/invalid to that default — never throws, never NaN. Optional member + parser
normalization is the project's stated idiom ("not legacy migration").

---

### `app/src/efx-paint/document/efxPaintDocumentParsers.ts` (parser, fail-closed)

**Analog:** `DOCUMENT_KEYS` (63) + `parseBackgroundFallback` (297–338):
```ts
const DOCUMENT_KEYS = new Set(['version', 'parentLayerId', 'documentRevision', 'activeTrackId', 'tracks', 'background', 'photoReference', 'audios', 'compositeRevision']);
const FALLBACK_PAPER_KEYS = new Set(['mode', 'texture', 'grainStrength', 'grainScale']);
...
const required: readonly string[] = ['mode', 'texture', 'grainStrength'];
if (!hasOnlyKeys(value, FALLBACK_PAPER_KEYS) || required.some((key) => !(key in value))) throw new Error(...);
if (!isPaperTextureValue(value.texture)) throw new Error(...);
if (typeof value.grainStrength !== 'number' || !Number.isFinite(value.grainStrength) || value.grainStrength < 0) throw new Error(...);
return Object.freeze({ ... grainScale: normalizeGrainScale(value.grainScale) });
```

**Invariant:** a total, fail-closed parser. Add `'light'` to `DOCUMENT_KEYS` or every
document save/load throws on the new member; add a `LIGHT_KEYS` allowlist set; absent →
today's light (the D-29 idiom: "Absent → identity so documents predating the member
normalize; present → fail-closed exact-member record"); present → every key validated finite
and in range, unknown member throws. `Object.freeze` the result.

---

### `app/src/types/project.ts` + `app/src-tauri/src/models/project.rs` (types, dual language)

**Analog:** `McePaperDisplayState` — TS 293–297, Rust 427–433:
```ts
export interface McePaperDisplayState { id: string; strength: number; scale: number; }
```
```rust
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McePaperDisplayState { pub id: String, pub strength: f64, pub scale: f64 }
```

**Invariant:** declared in **BOTH** languages in the **same pass**, with identical wire keys.
A camelCase wire key needs a Rust `#[serde(rename = "...")]` on the snake_case field — see
`MceAquarelleBrushProperties` (Rust 441–456: `#[serde(rename = "sizeCurve")] pub size_curve`).
The `MceProject.efx_paint_documents` carrier stays opaque (`Record<string, unknown>` /
`HashMap<String, Value>`), so this is a **declaration-only pin**, exactly like
`McePaperDisplayState` — the parser test reads both sources as text.

---

### `app/src/lib/mceFieldContract.test.ts` (test, contract)

**Analog:** itself — `expectMemberKeys` (154–167):
```ts
function expectMemberKeys(name: string, keys: readonly string[]): void {
  expect(ts.has(name), `TS parser missed ${name}`).toBe(true);
  expect(rust.has(name), `Rust parser missed ${name}`).toBe(true);
  // every listed key present on both sides, and no other one-language key
  const problems = diffMember(name, tsKeys, rustKeys);
  expect(problems, `${name} field-diff violations:\n${problems.join('\n')}`).toEqual([]);
}
```
Plus the literal allowlist snapshot (402–408) which fails if anyone adds an
`ALLOWED_ONE_LANGUAGE` entry.

**Invariant:** add one `describe` block calling `expectMemberKeys('MceDocumentLight',
['azimuth','elevation','intensity'])` (final key set per plan). Do **not** add the light to
`ALLOWED_ONE_LANGUAGE`. The existing "literal snapshot" test at 402–408 will catch a sneaky
allowlist edit.

---

### `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (integration, cache seam)

**Analog:** line 1368:
```ts
// The aquarelle store revision is the content fingerprint: it bumps on ...
getContentSignature: () => `${aquarelleStrokesRevision.peek()}`,
```

**Invariant:** "any script mutation must change it". A light change is not a script
mutation, but it **is** a render change that must invalidate the frame cache, so the
signature must also carry the light (read with `.peek()` — no subscription from this call
site). Keep the getter pure and cheap: a string, no allocation-heavy JSON of the whole
document.

---

### `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts` (service, cache contract)

**Analog:** the deps contract (122–127):
```ts
export interface StudioScriptSnapshotControllerDeps {
  getIdentity: () => StudioScriptSnapshotIdentity | null;
  getWatercolorEvents: () => readonly AquarellePayloadEvent[];
  /** Opaque content fingerprint; any script mutation must change it. */
  getContentSignature: () => string;
  ...
}
```

**Invariant:** this controller owns the **contract text**, and its test
(`studioScriptSnapshotController.test.ts:294`) supplies the getter. If the light joins the
fingerprint, update the contract comment and add a test row proving a light change changes
the signature — do not fork a second signature channel.

---

### Tests

| Test surface | Analog | What to pin |
|---|---|---|
| `packages/.../playground/params.test.ts` | the literal output table (7–17) | `toEngineParams` maps the 3 new canonicals at 0 → engine 0 exactly (neutral default); non-finite → default |
| `packages/.../playground/shaders.test.ts` | string-contains shader pins (16–22) | new program contains the tip footprint uniforms; `displayFS` contains the `S≈0` early-out; `col = rgb * paperCol` still present |
| `packages/.../determinismContract.test.ts` | double-replay byte equality (272–286) | same script ⇒ identical bytes twice on fresh adapters, with emboss/body/viscosity set |
| `packages/.../playground/dryMedia.test.ts` | "only chalk opts into the dry path" (30–38) | group classification per preset id, and the 15 legacy ids unchanged |
| `app/.../view/AquarelleGlobalsPanel.test.ts` | existing row + Reset pins | 10 rows + medium dropdown; Reset writes exactly the 10 medium keys |
| new bit-identity test | the adapters' literal-table style | `S = 0`, `emboss = 0`, `Body = 0`, viscosity default each compared as **pixel buffers**, not visually |

---

## Shared Patterns

### Compare-then-write (efx-preact-reactivity rule 3)
**Sources:** `aquarelleRecordState.ts:308–313`, `:336–339`, `WatercolorBrushLibrary.tsx:96–102`
**Apply to:** every new signal setter, engine setter, and guard-diffed apply.
```ts
if (current[key] === value) return;
aquarelleParams.value = { ...current, [key]: value };
```

### One store write per user action
**Source:** `aquarellePaintControls.ts:65–70` (batch arrives as ONE patch, one undo entry)
**Apply to:** medium switch, group → medium, Reset.
```ts
if (Object.keys(params).length === 0) return null;
return commitAquarelleSelectionAppearance({ params }, PAINT_ONLY);
```
The medium path differs from this only in the target: it writes the **live bag**, not the
selection (D-04). Still one write.

### Snapshot-before-mutation / protect-before-draw
**Sources:** `Engine.ts:2151` (`lift`), `:2074–2077` (`touch`), `:1384–1398` (`clear`)
**Apply to:** the cover pass, the thickness deposit, the Lift tool's thickness erosion.
```ts
this.history.begin('brush', ...);                       // the step exists first
this.history.protect(0, rectExpanded, this.snapshotLayers());
this.history.protect(1, rectExpanded, this.fixed.views);
// only now mutate
```

### Single canonical ↔ vendor mapping
**Source:** `params.ts:84–100`
**Apply to:** `viscosity`, `body`, `emboss` (and any future global).
Never read the canonical bag in the engine; never store 0..1 values in a payload.

### Fail-closed, total parsers — declared in BOTH languages
**Sources:** `efxPaintDocumentParsers.ts:297–338`, `types/project.ts:293–297`,
`src-tauri/src/models/project.rs:427–433`, `mceFieldContract.test.ts:154–167`
**Apply to:** the document `light` field.
Absent → identity default; present → allowlist + finite + range checks; unknown member throws; declared in both languages in the same change.

### Idempotent engine setter + redraw, never paint mutation
**Sources:** `Engine.ts:752`, `:1013–1030`, `:2376–2405`
**Apply to:** `setLight`, `setParams` of the new globals.
Compare → clamp → assign → `redraw()`. `redraw()` only marks the display dirty.

### Doc-key allowlist must move with the type
**Sources:** `efxPaintDocumentParsers.ts:63` (`DOCUMENT_KEYS`), `aquarelleRecordState.ts:80–90`
(`AQUARELLE_GLOBAL_KEYS`), `:1013–1028` (same list as write allowlist)
**Apply to:** every new persisted key and every new global.
The same key list is a write allowlist in one place and a record loop in another — adding the
field to the interface only is the classic silent hole.

### GPU program registration is one table
**Source:** `Engine.ts:328–350`
**Apply to:** the thickness deposit program.
One entry; reuse `lift` for the cover pass; no second program for the same maths.

---

## Negative references (do NOT copy)

| Site | Why |
|---|---|
| `aquarelleStrokeSelection.ts:735–753` `commitAquarelleSelectionAppearance` | Returns `null` with no active selection — it cannot set the **next** stroke's values. D-04 supersedes spec 07 §2's parenthetical: a medium switch is never a selection edit. |
| `aquarellePaintControls.ts:54–70` `commitAquarelleSelectionParam(s)` | Selection-only, same reason. |
| `Engine.ts:1987` `Math.min(0.9, P.lift * dwell)` | The Lift tool's own clamp. The cover pass must use `Math.min(1, P.body)` so full Body reaches a true zero (spec 06 §3). |
| `shaders.ts:70–71` grain re-threshold | `stampFS`'s paper-tooth gate is correct for the **thickness deposit** (spec 05) but must NOT be added to the cover pass (D-11). |
| `shaders.ts:683–685, 696, 709, 729` `cov`/gouache channel | Reassigned to scattering in spec 08; do not extend it for coverage. |
| `Engine.ts:1394` `if (t !== this.paper) g.clearTarget(t)` | Correct for `clear()`, but remember `relief` must be in `docTargets()` for this loop to reach it. |

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `packages/efx-watercolor/src/playground/mediums.ts` (NEW) | model | static data | No existing "named parameter-set" module. Partial analogs only: `brushes.ts` for the frozen table idiom, `params.ts` for the canonical defaults record. Planner should build it from spec 04's record shape and the amendment table. |

## Metadata

**Analog search scope:** `packages/efx-watercolor/src/{playground,adapter,payload}`,
`app/src/components/physic-paint/{view,engine,snapshot,roto}`,
`app/src/efx-paint/document`, `app/src/types`, `app/src-tauri/src/models`.
**Files scanned:** 28 read in full or in targeted ranges; 24 classified.
**Pattern extraction date:** 2026-11-17
**Tracking verified:** every analog path above passes `git ls-files`; no `.gsd/` mirror or
`dist/` path is cited. Build from `packages/efx-watercolor/src/`, never `dist/`.
