# Phase 56: efx-watercolor (engine 2, paint-aquarelle, clean-room) - Pattern Map

**Mapped:** 2026-10-15
**Files analyzed:** 22 (new + modified across `packages/efx-watercolor`, `packages/efx-spectral`, host seam, Studio UI, `.mce` contract)
**Analogs found:** 18 / 22

Scope note: Phase 56 is the first real consumer of the Phase 55 host seam
(`StudioStroke<P>` / `EngineAdapter<P>`). Most analogs are therefore the seam
itself plus engine-1's projection/bake/UI surfaces. The engine core (fluid grid +
spectral pigment) is **clean-room** (D-17 / P1) — analogs there are *structural
only* (module roles, buffer shapes), never code to copy. No RESEARCH.md exists
for this phase; canonical technical context lives in
`.planning/research/ARCHITECTURE.md` §2 and the refs listed in `56-CONTEXT.md`.

**Tracked-source gate:** every analog path below is git-tracked source (verified
via `git ls-files`). No `.gsd/capabilities/*` or other install mirrors named.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/efx-watercolor/` scaffold (`package.json`, `tsup.config.ts`, `tsconfig*.json`) | config | n/a | `packages/efx-physic-paint/package.json` + `packages/efx-paint-host/tsup.config.ts` | exact (sibling workspace package) |
| `packages/efx-watercolor/src/index.ts` (export surface) | config | n/a | `packages/efx-physic-paint/src/index.ts` | exact |
| `packages/efx-watercolor/src/engine/` + `src/core/` (fluid grid, pigment deposit, diffusion, wet/dry) | service | batch / transform | `packages/efx-physic-paint/src/core/` (`fluids.ts`, `diffusion.ts`, `drying.ts`, `wet-layer.ts`) | role-match (module roles + buffer discipline only — CLEAN-ROOM P1: no code copy) |
| `packages/efx-watercolor/src/shaders/` (GPU fluid / pigment) | utility | transform | none — engine-1 is CPU `Float32Array`; shaders are new surface | no-analog |
| `packages/efx-watercolor/src/brushes/` (14 tips, categories, per-brush multipliers) | model / utility | transform | `packages/efx-physic-paint/src/types.ts` `BrushOpts` (lines 64–74) + `packages/efx-physic-paint/src/brush/` | role-match (option-bag + tip asset shape) |
| `packages/efx-watercolor/src/papers/` (10 procedural + 3 real-tile refs) | model / utility | transform | `packages/efx-physic-paint/src/core/paper.ts` (`conditionHeightMap`) + `PaperConfig` in `types.ts` (lines 29–32) | role-match |
| `packages/efx-watercolor/src/payload/toStudioStroke.ts` (`AquarelleStrokePayload`, Dry event) | model | CRUD (serialize/parse) | `packages/efx-physic-paint/src/payload/toStudioStroke.ts` | exact (same projection shape; new `P`) |
| `packages/efx-watercolor/src/adapter/` (`EngineAdapter<P>` impl) | service | request-response + batch | `packages/efx-paint-host/src/script/payload.ts` `EngineAdapter` (lines 85–113) + `app/src/efx-paint/host-split/fakeEngine2Fixture.ts` | role-match (interface + fake-engine-2 pin shape) |
| `packages/efx-spectral/` (if created early, D-29) | utility | transform | `packages/efx-paint-host/` scaffold only | partial (no spectral-mixing analog in tree — vendor MIT `spectral.js`, never re-implement) |
| `packages/efx-paint-host/src/index.ts` + `src/script/` (consumed seam; extend only if codec needs a new export) | model / config | CRUD | itself — `EngineId` already names `'efx-watercolor'` (`script/payload.ts` line 19) | exact |
| Watercolour script codec + Dry payload-event kind | model | CRUD | `packages/efx-paint-host/src/script/payload.ts` (envelope) + `packages/efx-paint-host/src/script/refusal.ts` (fail-closed) + `toStudioStroke.ts` field-mapping header | role-match |
| `app/src/lib/paperPass.ts` (extend to 13-paper library; composite-only law unchanged) | utility | transform (composite) | itself | exact |
| `app/src/components/physic-paint/roto/physicsPaintRotoScriptApplyRefusal.ts` (extend named cross-engine cases) | utility | request-response | itself + `packages/efx-paint-host/src/script/refusal.ts` | exact |
| Bake host wiring (`createBakeHost`, `flush-survives-navigation` for long cuisson) | service | event-driven / batch | `packages/efx-paint-host/src/bake/bakeHost.ts` (already ported) ← pattern from `app/src/components/physic-paint/pilot/finalizationQueue.ts` | exact (consume `createBakeHost`; do not re-port) |
| `app/src/components/shared/ModuleSwitcher.tsx` (new) + mounts in `Toolbar.tsx` / `PhysicsPaintTopBar.tsx` | component | request-response | `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx` `segmentedButtonClass` (lines 85–87) + `app/src/components/layout/Toolbar.tsx` | role-match |
| Aquarelle options panel (globals + collapsible Brush response) in right sidebar | component | request-response | `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` (`PanelSlider` lines 133–170, global-then-per-brush stacking) | role-match |
| Brushes docker (D-07 tip picker: categories, search, import) | component | CRUD | `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx` (list + library surface) | partial (list/library shape; Krita-docker layout is new) |
| Paper picker popover + strength/scale sliders (shared panel) | component | request-response | `app/src/components/layout/Toolbar.tsx` motion-blur popover (lines 137–213) + `PhysicsPaintTopBar.tsx` `PAPER_TEXTURES` (lines 22–34) | role-match |
| Aquarelle tool row (`brush\|water\|pen\|lift`) + Dry action button | component | request-response | `PhysicsPaintRightPanel.tsx` `SmoothingButton` segmented row (lines 178–189) | role-match |
| `.mce` fields TS (`app/src/types/project.ts`) + Rust (`src-tauri/src/models/project.rs`) — paper state on fond, brush-pack snapshot, aquarelle payload | model | CRUD | existing `Mce*` members in both files + `app/src/lib/mceFieldContract.test.ts` | exact |
| `app/src/lib/mceFieldContract.test.ts` (extend member set; every new field joins the diff) | test | n/a | itself | exact |
| Standing pins: determinism, real-watercolor genericity, Dry-event codec, fail-closed cross-engine Apply | test | n/a | `app/src/efx-paint/host-split/hostGenericityRoundTrip.test.ts`, `app/src/paintVersionDisciplineContract.test.ts`, `app/src/lib/mceFieldContract.test.ts` | exact (same standing-pin family) |
| `app/public/img/paper_1.jpg` / `paper_2.jpg` / `paper_3.jpg` → Studio paper library (PAPER-04) | asset / config | file-I/O | `PhysicsPaintTopBar.tsx` `PAPER_TEXTURES` (lines 22–26) | exact (assets already in tree) |
| `physicPaintStore` fond authority (`_resolveDocumentFondInstruction` / paper display state, PAPER-03) | store / service | CRUD | `app/src/stores/physicPaintStore.ts` `_resolveFondSource` + `_rotateFlattenedMemoOnFondChange` (lines 1542–1621) | exact (extend, do not fork) |

## Pattern Assignments

### 1. `packages/efx-watercolor/` package scaffold (config)

**Analog:** `packages/efx-physic-paint/package.json` + `packages/efx-paint-host/tsup.config.ts`

Workspace shape is settled — `pnpm-workspace.yaml` globs `packages/*`, so the
new package joins with zero workspace edits. Follow the host's Preact-free
posture for the engine core (CONTEXT "engine is Preact-free and implements
`EngineAdapter<P>`").

**package.json shape** (`packages/efx-physic-paint/package.json`, lines 25–52):
```json
"type": "module",
"main": "./dist/index.mjs",
"types": "./dist/index.d.ts",
"exports": {
  ".": { "types": "./dist/index.d.ts", "import": "./dist/index.mjs" },
  "./preact": { "types": "./dist/preact.d.ts", "import": "./dist/preact.mjs" }
},
"dependencies": { "@efxlab/efx-paint-host": "workspace:*" },
"peerDependencies": { "preact": ">=11.0.0" },
"peerDependenciesMeta": { "preact": { "optional": true } }
```
`efx-watercolor` mirrors this with `"@efxlab/efx-paint-host": "workspace:*"` and
(depends on plan-time D-29) `"@efxlab/efx-spectral": "workspace:*"`. Do NOT add
`efx-physic-paint` as a dependency (integration-point law).

**tsup entry map** (`packages/efx-paint-host/tsup.config.ts`):
```typescript
export default defineConfig({
  entry: { index: 'src/index.ts', animation: 'src/animation/index.ts' },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  tsconfig: 'tsconfig.build.json',
  outExtension: () => ({ js: '.mjs' }),
})
```
Watercolour adds its own entries (`index` + any `./shaders` / `./papers`
sub-entry the plan needs). Keep `dts: true` + `.mjs` out-extension — the app
imports through the exports map, not source paths.

**Workspace singletons:** root `package.json` `pnpm.overrides` pins preact /
signals / motion-canvas-core. If spectral or a shader runtime needs a singleton,
extend that same map — never introduce a second override mechanism.

---

### 2. `packages/efx-watercolor/src/payload/toStudioStroke.ts` (model, CRUD)

**Analog:** `packages/efx-physic-paint/src/payload/toStudioStroke.ts`

This is the ONLY place engine field names meet host field names. Copy the
projection discipline verbatim (field-mapping header comment, opaque `engine: P`
slot, `traceSeed` from `hashMutationId`, `DIFFUSION_CAP = 600`).

**Imports + payload shape** (lines 21–38):
```typescript
import type { PaintStroke, PenPoint } from '../types'
import { hashMutationId } from '@efxlab/efx-paint-host'
import type { StudioStroke, StudioPoint } from '@efxlab/efx-paint-host/animation'

export interface PhysicStrokePayload {
  tool: string
  color: string | null
  params: Record<string, number>
  mutationId?: number
  hasPenInput?: boolean
  physicsMode?: string | null
  diffusionFrames?: number
  timestamp: number
  playFrame?: number
}
const DIFFUSION_CAP = 600
```

**Projection core** (lines 44–73) — the shape `AquarelleStrokePayload` mirrors:
```typescript
export function toStudioStroke(s: Readonly<PaintStroke>): StudioStroke<PhysicStrokePayload> {
  const pts: StudioPoint[] = s.points.map((p, i) => ({
    x: p.x, y: p.y, p: p.p, tx: p.tx, ty: p.ty, tw: p.tw, tick: i,
  }))
  return {
    pts,
    ticks: Math.max(1, pts.length - 1),
    cuisson: s.diffusionFrames !== undefined && s.diffusionFrames > 0
      ? Math.min(DIFFUSION_CAP, Math.trunc(s.diffusionFrames))
      : 0,
    motion: null,
    brushId: 'efx-physic-paint',
    toolOverrides: {},
    traceSeed: hashMutationId(s.mutationId),
    recordedOrder: s.timestamp,
    playFrame: s.playFrame ?? null,
    color: s.color,
    engine: { /* opaque engine-private fields */ },
  }
}
```

**D-16 Dry event:** add a distinguished payload event kind to the watercolour
script codec (no pts, no brush — just tick + dry), one payload union, one
ordering law. Do NOT use a second events array and do NOT flag the next stroke.
The host's `EngineId` already includes `'efx-watercolor'`
(`packages/efx-paint-host/src/script/payload.ts` line 19).

---

### 3. `packages/efx-watercolor/src/adapter/` — `EngineAdapter<P>` (service)

**Analog (interface):** `packages/efx-paint-host/src/script/payload.ts` lines 85–113
**Analog (test double):** `app/src/efx-paint/host-split/fakeEngine2Fixture.ts`
(via `hostGenericityRoundTrip.test.ts`)

**The one plug point** (`packages/efx-paint-host/src/script/payload.ts`):
```typescript
export interface EngineAdapter<P = unknown> {
  readonly engineId: EngineId
  readonly payloadCodec: {
    serialize(stroke: unknown): StudioStroke<P>
    parse(raw: unknown): StudioStroke<P> | null   // total, fail-closed
  }
  // — Live playback (AnimationPlayer) —
  setInputLocked(locked: boolean): void
  setAnimationMode(mode: boolean): void
  getStrokes(): readonly StudioStroke<P>[]
  renderPartialStrokes(strokeData: ReadonlyArray<{ stroke: StudioStroke<P>; pointCount: number }>): void
  renderAllStrokes(): void
  exportCompositeCanvas(): HTMLCanvasElement
  // — Bake (55-07 bake host) —
  applyStroke(stroke: StudioStroke<P>): void
  stepTick(tick: number): void
  captureFrame(): CanvasImageSource
  dispose(): void
}
```

`payloadCodec.parse` must stay total and fail-closed (null on any malformed
input) — the host never reads `P`. The fake-engine-2 pin
(`hostGenericityRoundTrip.test.ts`, header lines 1–18) is the standing proof
that a second payload round-trips; the watercolour adapter should be testable
the same way.

---

### 4. Bake host — consume `createBakeHost` (service, event-driven)

**Analog:** `packages/efx-paint-host/src/bake/bakeHost.ts` (the already-ported host API)
**Pattern origin:** `app/src/components/physic-paint/pilot/finalizationQueue.ts`

Do NOT re-port the queue. `createBakeHost` is exported for this phase
(`packages/efx-paint-host/src/index.ts` lines 43–53) with the two D-21 semantics:

```typescript
export type BakeTurnMode = 'abort-on-dispose' | 'flush-survives-navigation';
export interface BakeHostTurn<T> {
  produce: () => T | Promise<T>;
  commit?: (value: T) => void | boolean | Promise<void | boolean>;
  isStillWanted?: (stage: BakeTurnStage) => boolean;
  mode?: BakeTurnMode;   // long cuisson → 'flush-survives-navigation'
}
```

**Pattern properties to preserve when wiring the watercolour bake path** (from
`finalizationQueue.ts` header lines 12–22):
- BOUNDED TURNS via `Queue.bounded` slot pool (`BAKE_TURN_CONCURRENCY = 2`)
- GENERATION-STALE commit guard — a cancelled/interrupted turn never commits
- `beginFlush()` forced-flush escape for navigation / save / export
- NEVER-REJECTING produce/commit — a bad bake is DATA (`failed`/`rejected`),
  not a dead Effect fiber

`diffusionFrames` ≤ 600 is script-owned cap policy (D-19); the host owns the
uncapped `cuissonTicks` mechanism (`packages/efx-paint-host/src/time/`).

---

### 5. `app/src/lib/paperPass.ts` (utility, composite transform)

**Analog:** itself — the composite-only paper contract PAPER-02 locks.

The 13-paper library plugs into this seam; changing paper swaps tiles only —
**no rebake** (D-21). The routine is already the single canvas/export seam
through `_resolveFlattenedFrame`.

**Tile contract** (lines 24–28, 87–113):
```typescript
export interface PaperPassTile {
  readonly valley: HTMLCanvasElement;  // multiply, floor at paper's own tint
  readonly peak: HTMLCanvasElement;    // lighten, tint-scaled fiber lift
}
export function encodePassTiles(
  height: Float32Array, width: number, heightPx: number,
  strength: number, tint: { r: number; g: number; b: number },
): { valley: Uint8ClampedArray; peak: Uint8ClampedArray }
```

**Application — 5 GPU drawImage composites, no per-frame pixel work** (lines 245–276):
```typescript
export function applyPaperPass(
  ctx: CanvasRenderingContext2D, width: number, height: number,
  tile: PaperPassTile | null,
): void {
  if (!tile) return;
  // 1. capture  2. multiply valley  3. lighten peak
  // 4. destination-in original (alpha restore)  5. copy back
}
```

**Cache discipline** (lines 31–33, 53): `TILE_CACHE_ENTRY_LIMIT = 12`,
`TILE_CACHE_BYTE_BUDGET = 64MB`, key `v1:${paper}:${w}x${h}:${scale}:${strength}`.
13 papers × sizes will pressure this — the entry/byte bounds are the knob.

**D-21 engine-side vs display-side split:** granulation settle / dry-brush skip
is the deposit role and bakes into transparent pixels. `paperPass` is display
fond only. Never fold engine paper influence into this module.

---

### 6. Owned-refusal surface (utility, request-response)

**Analog:** `app/src/components/physic-paint/roto/physicsPaintRotoScriptApplyRefusal.ts`
**Code source:** `packages/efx-paint-host/src/script/refusal.ts`

Host yields CODES; the Studio mapper names them. There is NO second error
channel (D-10 / D-25).

**Host codes** (`packages/efx-paint-host/src/script/refusal.ts` lines 13–16):
```typescript
export type HostScriptRefusalCode =
  | 'unknown-engine-id'
  | 'malformed-engine-payload'
  | 'engine-mismatch'
  | 'unreadable-legacy-script'
```

**Studio naming pattern** (`physicsPaintRotoScriptApplyRefusal.ts` lines 65–120):
```typescript
const ENGINE_DISPLAY_NAMES: Record<string, string> = {
  'efx-physic-paint': 'Brush',
  'efx-watercolor': 'Water color',
  'efx-krita': 'Krita',
};
export function buildRotoScriptApplyRefusalMessage(
  error: RotoScriptOperationError | HostRefusalInput | null | undefined,
): string | null {
  // switch on error.code → named English line; default → null
}
```

`ENGINE_DISPLAY_NAMES` already names `'efx-watercolor': 'Water color'` — the
cross-engine mismatch line is prepared. Extend the switch with any new named
watercolour cases on the SAME surface (`scriptApplyRefusalOwnedRef` /
`clearOwnedScriptApplyRefusal`); never invent a parallel channel.

---

### 7. `app/src/lib/mceFieldContract.test.ts` (standing pin, DATA-04)

**Analog:** itself — every new `.mce` field joins this diff.

**The law** (header lines 5–16): a field TS emits and Rust omits is dropped by
serde on every save→close→reopen; a field Rust declares and TS never emits is
dead weight. Both directions fail here.

**Surfaces parsed** (lines 104–111):
```typescript
const RUST_SRC = readFileSync(
  fileURLToPath(new URL('../../src-tauri/src/models/project.rs', import.meta.url)), 'utf8');
const TS_SOURCES = [
  readFileSync(fileURLToPath(new URL('../types/project.ts', import.meta.url)), 'utf8'),
  readFileSync(fileURLToPath(new URL('../types/audio.ts', import.meta.url)), 'utf8'),
].join('\n');
```

**Action for Phase 56:** declare each new field (aquarelle brush properties,
per-engine stroke payload in the envelope, paper state on the fond, brush-pack
snapshot) in BOTH `app/src/types/project.ts` and
`src-tauri/src/models/project.rs`, then let the diff fail until both sides
agree. `ALLOWED_ONE_LANGUAGE` (lines 121–123) is for intentional asymmetry only
— brush-pack snapshot (D-23) travels in `.mce` deliberately and is NOT a
one-language field.

---

### 8. Module switcher + top-bar (component, request-response)

**Analog:** `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx`
(segmented family) + `app/src/components/layout/Toolbar.tsx` (top-bar host)

**Segmented visual language** (`PhysicsPaintTopBar.tsx` lines 85–87, 118–120):
```typescript
function segmentedButtonClass(active: boolean) {
  return `physics-paint-segmented-button${active ? ' active' : ''}`;
}
// ...
<div class="physics-paint-segmented-row" role="group" aria-label="Background">
  {BACKGROUND_OPTIONS.map((option) => (
    <button class={segmentedButtonClass(...)} ...>
```
CSS family lives in `app/src/components/physic-paint/physicsPaintStudio.css`
(`.physics-paint-segmented-row` / `.physics-paint-segmented-button`, lines 501–621).

**Top-bar host layout** (`Toolbar.tsx` lines 91–122): flex row, `w-11 h-11`
icon buttons, `w-px h-6 bg-(--color-border-subtle)` separators, spacer
`flex-1` before right-side mode buttons. UI-SPEC (2026-10-15) requires ONE
shared `ModuleSwitcher` component mounted in BOTH `Toolbar.tsx` and
`PhysicsPaintTopBar.tsx`, one active-module signal — not two implementations.

**D-01/D-03:** segmented 3-slot, text labels "Brush | Water color | Krita";
Krita slot inert + greyed + "coming in v2.1.0" tooltip. D-02: switching drains
module options into panels only — document/timeline stay put.

---

### 9. Right sidebar — shared/module param split (component)

**Analog:** `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx`

**Slider row wrapper** (lines 133–170) — D-06's control family call site:
```typescript
function PanelSlider(props: { id, label, value, min, max, onChange, suffix?, step?, disabled?, commitOnRelease? }) {
  const clampedValue = Math.max(props.min, Math.min(props.max, props.value));
  return (
    <div class="physics-paint-option-row">
      <SliderStepper
        id={props.id} label={props.label} value={clampedValue}
        onChange={props.onChange} step={props.step ?? 1}
        min={props.min} max={props.max} disabled={props.disabled}
        ariaLabel={props.label} commitOnRelease={props.commitOnRelease}
      />
    </div>
  );
}
```

**Segmented option button** (lines 178–189) — reuse for the D-13 tool row:
```typescript
function SmoothingButton(props: { label, value, active, disabled?, onSelect }) {
  return (
    <button type="button"
      class={`physics-paint-segmented-button${props.active ? ' active' : ''}`}
      disabled={props.disabled}
      onClick={() => props.onSelect(props.value)}>
      {props.label}
    </button>
  );
}
```

**Global-then-per-brush stacking (D-04):** the panel already stacks globals
(size/opacity/edge/pickup) above mode-gated per-param rows
(`physicsMode === 'local' ? <PanelSlider .../> : null`, line 653). Aquarelle
copies that: 8 globals first, then a `RuleSectionHeader`-headed collapsible
"Brush response" with 8 ×multiplier sliders (0.5–2.0) each showing
`global × multiplier`.

**Collapsible / section headers** (`app/src/components/shared/RuleSectionHeader.tsx`,
lines 14–48 — purely presentational):
```typescript
export function RuleSectionHeader({ text }: { text: string }) { /* rule + uppercase label + rule */ }
```

**Control family (D-06):** `SliderStepper` (`app/src/components/shared/SliderStepper.tsx`,
props lines 28–61) for every continuous param; `NumericStepper` only where
integers matter. Never introduce a competing slider.

**D-05 hard boundary:** SHARED (Color / Size / Opacity / Paper id+strength+scale)
always visible; MODULE-ONLY (`water, load, flow, bleed, dry, edge, granulation`,
tool selector, tip picker, multipliers) only while that module is active. Never
show watercolour params in the Brush module panel and vice versa. AQUA-04 `size`
maps to the shared Size — no duplicate.

---

### 10. Determinism / traceSeed (shared utility)

**Analog:** `packages/efx-paint-host/src/util/traceSeed.ts` (exported from the
host entry, `index.ts` lines 6–14)

**The law (D-20 / 55 D-25):** no `Math.random()` in deposit/sim path; every
stroke seeds from `hashMutationId`.

```typescript
export function fnv1a(source: string): number            // offset 2166136261, prime 16777619
export function hashMutationId(mutationId: number | string | undefined): number
export function seededRng(strokeSeed: number, streamKey: string): () => number
export function seededDraw(strokeSeed: number, slot: string, drawKey: string): number
export function seededRange(strokeSeed, slot, drawKey, min, max): number
export function traceShapeNoise(strokeSeed, arcLength, bristleIndex, channel): number
```

Watercolour deposit/sim/granulation draws all key off `(strokeSeed, slot, key)`
— stream keys separate roles so water never lands on pigment's pattern.

---

### 11. Paper display state on the fond (store, CRUD)

**Analog:** `app/src/stores/physicPaintStore.ts` `_resolveFondSource` +
`_resolveDocumentFondInstruction` + `_rotateFlattenedMemoOnFondChange`
(lines 1538–1621)

**Resolution precedence (total, deterministic)** (lines 1528–1533):
1. active track's paper entry in `_rotoBackgroundMetadata` governs
   (`transparent` → null, never throw);
2. no entry → document fallback (transparent / solid color / paper).

**Display-class change-token rotation (D-22 / PAPER-03):** paper display edits
MUST rotate the change token or display-only edits revert on reopen — the
PKG-06/BKG-09 lesson. The memo-clear guard to copy
(lines 1606–1621):
```typescript
function _fondSourceSignature(source: FondSource | null): string {
  if (!source) return 'none';
  if (source.kind === 'color') return `color:${source.color}`;
  const metadata = source.metadata;
  return `paper:${metadata.background}:${metadata.grainStrength}:${metadata.color ?? ''}:${metadata.grainScale ?? 1}`;
}
function _rotateFlattenedMemoOnFondChange(layerId: string, efxDocument: EfxPaperDocument): void {
  const signature = _fondSourceSignature(_resolveFondSource(layerId, efxDocument));
  if (_flattenedFondSignatures.get(layerId) === signature) return;
  _flattenedFondSignatures.set(layerId, signature);
  _flattenedMemo.delete(layerId);
  _trackRasterMemo.delete(layerId);
}
```

Paper state (id, strength, scale) joins this authority — controls live in the
shared panel (D-10), state lives on the fond.

---

### 12. Standing contract pins (test family)

**Analogs:**
- `app/src/lib/mceFieldContract.test.ts` — TS↔Rust field diff (DATA-04)
- `app/src/efx-paint/host-split/hostGenericityRoundTrip.test.ts` — fake
  engine-2 record→play→bake with assertable pixels (D-05/D-06/HOST-04)
- `app/src/paintVersionDisciplineContract.test.ts` — source-scan bump+subscribe
  discipline (no DOM mount)
- `app/src/efx-paint/host-split/hostSplitFailClosedApply.test.ts` — fail-closed
  cross-engine Apply

**Shape** (from `hostGenericityRoundTrip.test.ts` header lines 1–18):
> Genericity is a contract, not a visible behavior. Family:
> paintVersionDisciplineContract / efxPaintCleanBreakContract /
> hostSplitFailClosedApply — a normal `.test.ts` on the existing vitest setup.

Phase 56 pins join this family on the existing setup
(`pnpm --filter efx-motion-editor exec vitest run`) — **no new vitest config**
(CONTEXT "Existing Code Insights"). Watch the `.test.ts` collection law: a
`.test.tsx` target exits 0 while running nothing.

---

## Shared Patterns

### Determinism / traceSeed
**Source:** `packages/efx-paint-host/src/util/traceSeed.ts`
**Apply to:** every watercolour deposit/sim/granulation draw; the script codec's
`traceSeed` field (`hashMutationId(mutationId)`).
No `Math.random()` in the sim path (D-20).

### Owned-refusal (one error channel)
**Source:** `app/src/components/physic-paint/roto/physicsPaintRotoScriptApplyRefusal.ts`
**Apply to:** cross-engine Apply refusals (D-25), unreadable scripts, Dry-event
codec failures. Host supplies codes; Studio names them. Never a second channel.

### paintVersion bump + subscribe
**Source:** `app/src/paintVersionDisciplineContract.test.ts` + `efx-preact-reactivity` skill
**Apply to:** every aquarelle store setter and every render `useEffect` that
draws paint. Bump on mutations; subscribe in render effects. Mandatory skill:
`.claude/skills/efx-preact-reactivity/SKILL.md`.

### SliderStepper / NumericStepper control family
**Source:** `app/src/components/shared/SliderStepper.tsx`, `NumericStepper.tsx`
**Apply to:** all 8 aquarelle globals, all 8 ×multipliers (0.5–2.0), paper
strength/scale, shared Size/Opacity. Never fork a slider.

### `physics-paint-segmented-button` visual family
**Source:** `app/src/components/physic-paint/physicsPaintStudio.css` (lines 501–621)
**Apply to:** ModuleSwitcher (D-01), aquarelle tool row (D-13), any future
mode-group. One CSS family, no second segmented language.

### Effect v4 bounded-queue bake host
**Source:** `packages/efx-paint-host/src/bake/bakeHost.ts` (`createBakeHost`)
**Apply to:** watercolour WebP bake + cache (`diffusionFrames` ≤ 600, survives
leaving the frame → `mode: 'flush-survives-navigation'`). Never re-implement
the queue; never introduce a Web Worker.

### `.mce` dual-language field law (DATA-04)
**Source:** `app/src/lib/mceFieldContract.test.ts` + `app/src/types/project.ts` +
`src-tauri/src/models/project.rs`
**Apply to:** every new field (aquarelle payload, paper state on fond,
brush-pack snapshot D-23, envelope engine payload). Declare in BOTH languages.

### Package scaffold (workspace join)
**Source:** `packages/efx-physic-paint/package.json` + `packages/efx-paint-host/tsup.config.ts`
**Apply to:** `packages/efx-watercolor/` and (if created) `packages/efx-spectral/`.
`workspace:*` deps, `tsup` dts + `.mjs`, root `pnpm.overrides` for singletons.

### Display-class change-token rotation
**Source:** `physicPaintStore._rotateFlattenedMemoOnFondChange` (lines 1615–1621)
**Apply to:** paper display state (id/strength/scale) on the fond — every
display-only edit rotates the token (PAPER-03 / D-22).

### Chunk budget
**Source:** memory law — viteBuild 2000 kB desktop ceiling
**Apply to:** shaders / spectral data / paper tiles. Pressure here is a
plan-time line-move item, not a mid-phase raise.

## No Analog Found

| File / surface | Role | Data Flow | Reason |
|---|---|---|---|
| `packages/efx-watercolor/src/shaders/` (GPU fluid / pigment) | utility | transform | Engine-1 is CPU `Float32Array`; no shader surface in tree. Clean-room P1 — published method only (SPECS/v1.1.0-water-color, oracle README/engine read-only). |
| Spectral pigment mixing (`packages/efx-spectral/` core) | utility | transform | No spectral mixer in tree. Vendor MIT `rvanwijnen/spectral.js` + attribution (Q6) — never re-implement (D-29). |
| Brushes docker (D-07 Krita-style category list) | component | CRUD | No category-grouped brush library in tree; `PhysicsPaintScriptsPanel.tsx` is the closest list/library shape only. Categories are a data-model concern (D-07). |
| Dry timeline event kind (D-15/D-16) | model | event-driven | New payload union member — no prior distinguished event kind in the script codec. One union, one ordering law, one codec. |
| Fluid-grid wet-state + `diffusionFrames` cuisson for watercolour | service | batch | Engine-1's `diffusion`/`drying` modules are structural analogs only (clean-room: copy roles and buffer discipline, never code). |

## Metadata

**Analog search scope:** `packages/efx-paint-host/**`, `packages/efx-physic-paint/**`,
`app/src/lib/`, `app/src/components/shared/`, `app/src/components/layout/`,
`app/src/components/physic-paint/` (view + roto + pilot), `app/src/stores/`,
`app/src/types/`, `app/src/efx-paint/host-split/`, `src-tauri/src/models/`
**Files scanned:** ~40 (targeted reads + greps; 3–5 strong analog clusters)
**Pattern extraction date:** 2026-10-15
**Upstream inputs:** `56-CONTEXT.md` (D-01..D-29), `56-UI-SPEC.md` (component
inventory + design system), `.planning/research/ARCHITECTURE.md` §2, `55-PATTERNS.md`
