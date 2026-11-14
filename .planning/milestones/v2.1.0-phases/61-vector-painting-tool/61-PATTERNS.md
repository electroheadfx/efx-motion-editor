# Phase 61: Vector Painting Tool - Pattern Map

**Mapped:** 2026-11-10
**Files analyzed:** 42 (11 new, 31 modified)
**Analogs found:** 42 / 42 (34 exact / in-file precedent, 8 role-match, 0 none)

**Tracked-source gate (#3645):** every analog path below was verified with
`git ls-files -- <path>` and printed a tracked source file. No analog in this
document points at a gitignored `.gsd/capabilities/**` install mirror; all live
in the tracked product trees `app/src/**`, `app/src-tauri/**` and
`packages/efx-watercolor/**`.

**Do NOT build on (confirmed unmounted / legacy in UI-SPEC):**
`app/src/components/physic-paint/view/AquarelleToolRow.tsx` (no production
mount — `panelSplitShell.test.tsx:173`), `view/BrushesDocker.tsx`, and
`app/src/components/overlay/PaintToolbar.tsx`.

**Naming note:** paths for the four new app-side modules and the new probe are
proposals; the *role + analog assignment* per row is the binding output. All
modified paths are exact.

---

## File Classification

### New files

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `packages/efx-watercolor/src/vector/spine.ts` | utility | transform | `app/src/components/physic-paint/view/aquarelleStrokeBand.ts` (pure, Preact-free geometry module + reuse contract) | role-match |
| `packages/efx-watercolor/src/vector/spine.test.ts` | test | transform | `packages/efx-watercolor/src/payload/toStudioStroke.test.ts` (fixture + sectioned pins) | role-match |
| `packages/efx-watercolor/probe/vector-spine/probe.ts` | test-harness | batch / measurement | `packages/efx-watercolor/probe/watercolor-opacity/probe.ts` | exact |
| `packages/efx-watercolor/probe/vector-spine/index.html` | test-harness | — | `packages/efx-watercolor/probe/watercolor-opacity/index.html` | exact |
| `packages/efx-watercolor/probe/vector-spine/run.mjs` | test-harness | batch | `packages/efx-watercolor/probe/watercolor-opacity/run.mjs` | exact |
| `app/src/components/physic-paint/view/vectorPathSession.ts` | store | event-driven | `view/scriptStrokeEdition.ts` (session-only view signals) + `view/physicsPaintCanvasZoom.ts` | role-match |
| `app/src/components/physic-paint/view/vectorPathHandles.ts` | utility | transform | `view/scriptStrokeTransform.ts` (handle law + hit-test) | role-match |
| `app/src/components/physic-paint/view/vectorPathSession.test.ts` | test | event-driven | `view/physicsPaintCanvasZoom.test.ts` | role-match |
| `app/src/components/physic-paint/view/vectorPathHandles.test.ts` | test | transform | `view/scriptStrokeTransform.test.ts` | role-match |
| `app/src/components/physic-paint/engine/VectorPathOverlay.tsx` | component | event-driven (pointer gestures) | `engine/ScriptStrokeOverlay.tsx` | role-match |
| `app/src/components/physic-paint/engine/vectorPathOverlay.test.tsx.test.ts` | test | event-driven | `view/panelSplitShell.test.tsx.test.ts` (the `.test.tsx.test.ts` workaround) | role-match |
| `app/src/components/physic-paint/view/aquarelleRecordState.test.ts` | test | CRUD | in-file precedent in `aquarelleRecordState.transform.test.ts` (payload fixtures + restore pins), node environment | exact |
| `app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts` | test | CRUD | same, focused on `updateAquarellePathInScript` | exact |
| `app/src/components/physic-paint/view/aquarelleRecordState.renderMode.test.ts` | test | CRUD | same, focused on `updateAquarelleRenderModeInScript` (anchors-or-none batch) | exact |
| `app/src/efx-paint/compositor/vectorStrokeExportParity.test.ts` | test | transform | `packages/efx-watercolor/src/payload/toStudioStroke.test.ts` (fixture built through the real projection) | role-match |

### Modified tests (phase close-out)

| Modified File | Role | Data Flow | Closest Analog / In-file precedent | Match Quality |
|---------------|------|-----------|--------------------------------------|---------------|
| `app/src/components/physic-paint/engine/aquarelleStrokeBridge.test.ts` | test | transform | in-file: `readFileSync` source pins + `makeRuntimeStroke` fixtures | exact |
| `app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts` | test | transform | in-file: key-derivation fixtures | exact |

### Modified files — engine package

| Modified File | Role | Data Flow | Closest Analog / In-file precedent | Match Quality |
|---------------|------|-----------|--------------------------------------|---------------|
| `packages/efx-watercolor/src/payload/toStudioStroke.ts` | model | transform | in-file: `AquarelleStrokePayload` (:63) + `toStudioStroke` (:129) | exact |
| `packages/efx-watercolor/src/payload/toStudioStroke.test.ts` | test | transform | in-file: sections 1/2/3 + `makeRuntimeStroke` | exact |
| `packages/efx-watercolor/src/payload/codec.ts` | codec | transform | in-file: `isStrokeShape` membership gate (:110) + total `parse` | exact |
| `packages/efx-watercolor/src/payload/codec.test.ts` | test | transform | in-file | exact |
| `packages/efx-watercolor/src/playground/Engine.ts` | engine | streaming | in-file: `trace()` (:1653) / `stamp()` (:1699) / `radius()` (:1564) | exact |
| `packages/efx-watercolor/src/playground/brushes.ts` | config | CRUD (preset table) | in-file: `define()` (:169) + `BRUSH_PRESETS` (:171) | exact |
| `packages/efx-watercolor/src/adapter/engineAdapter.ts` | adapter | streaming | in-file: EXTENSION seam (`setPaper`/`setPaintSeedFrame`/`resetSheet`) | exact |
| `packages/efx-watercolor/src/adapter/engineAdapter.test.ts` | test | streaming | in-file | exact |
| `packages/efx-watercolor/src/determinismContract.test.ts` | test | — | in-file: `collectSources` scan roots (:1-60) | exact |

### Modified files — app

| Modified File | Role | Data Flow | Closest Analog / In-file precedent | Match Quality |
|---------------|------|-----------|--------------------------------------|---------------|
| `app/src/components/physic-paint/performance/scriptTimelineCodec.ts` | codec | transform | in-file: AQTL v1 `encodeStroke` (:417) / `decodeStroke` (:601) | exact |
| `app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts` | test | transform | in-file | exact |
| `app/src/types/project.ts` | model | CRUD | in-file: `MceEngineStrokePayload` declaration | exact |
| `app/src-tauri/src/models/project.rs` | model | CRUD | in-file: mirrored struct (declaration only — Rust never parses AQTL) | exact |
| `app/src/lib/mceFieldContract.test.ts` | test | — | in-file: `expectMemberKeys` (:242) | exact |
| `app/src/components/physic-paint/view/aquarelleRecordState.ts` | store | CRUD | in-file: `updateAquarelleStrokesInScript` (:714) — the ONE commit seam | exact |
| `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` | store | event-driven | in-file: `setAquarelleSelectMode` (:326) — the single mode choke point | exact |
| `app/src/components/physic-paint/view/aquarelleStrokeBand.ts` | utility | transform | in-file: `buildStrokeBand` / `buildStrokeBandCached` | exact |
| `app/src/components/physic-paint/view/strokeSettingsModel.ts` | model | CRUD | in-file: `WATERCOLOR_SETTINGS_FIELDS` (:80) | exact |
| `app/src/components/physic-paint/view/strokeSettingsModel.test.ts` | test | CRUD | in-file | exact |
| `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` | component | request-response | in-file: `numericFields.map` (:1434) / `segmentedFields.map` (:1458) / header buttons (:811-898) | exact |
| `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx` | component | request-response | in-file: host-tool buttons (:144-204) | exact |
| `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts` | middleware (shortcut authority) | event-driven | in-file: the `b/w/e/p` arm (:365-374) | exact |
| `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts` | test | event-driven | in-file | exact |
| `app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx` | component | CRUD | in-file: `BRUSH_PRESETS` map (:124, :171) | exact |
| `app/src/components/physic-paint/view/watercolorStrokeThumb.ts` | utility | transform | in-file: `getStrokeThumb` (:161) + `tipCache`/`thumbCache` | exact |
| `app/src/components/physic-paint/view/scriptStrokeEdition.ts` | store | event-driven | in-file: `draftMode` (:134) / `frozenCacheVisible` (:171) | exact |
| `app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx` | component | event-driven | in-file: gesture refs + render order | exact |
| `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` | component | streaming | in-file: overlay mount (:873-997) | exact |
| `app/src/lib/physicPaintDraftMode.ts` | middleware | pub-sub (cross-realm) | in-file: `publishStudioDraftMode` / listener | exact |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | component | event-driven | in-file: Draft gate sites (:5359 … :5955) + publisher (:10691) | exact |
| `app/src/components/physic-paint/physicsPaintStudio.css` | config | — | in-file: `.physics-paint-icon-button` (:595-716) / `.physics-paint-tool-rail` (:611-667) | exact |

---

## Pattern Assignments

### `packages/efx-watercolor/src/vector/spine.ts` (utility, transform)

**Analog:** `app/src/components/physic-paint/view/aquarelleStrokeBand.ts`

The new module is the phase's only genuinely new math surface: one stroke's
anchors → a sampled spine + a per-sample width envelope. Copy the analog's
**module contract header** and **purity law**, not its geometry.

**Module contract header pattern** (aquarelleStrokeBand.ts:1-45):

```typescript
// ============================================================
//  aquarelleStrokeBand — the ONE preview footprint band for both
//  stroke kinds (quick 261101-mvg, "Preview stroke size").
//
//  REUSE CONTRACT: the next quick (Draft mode) must import THIS
//  module and never rebuild paint footprint geometry. ...
//
//  PURITY: no Preact, no signals, no DOM, no stateful engine
//  import. ...
//
//  The only module state is a bounded, revision-keyed paint cache;
// ============================================================
```

**Purity + typed export pattern** (aquarelleStrokeBand.ts:62-77):

```typescript
const DEG = Math.PI / 180;

/** The drawn footprint of one recorded stroke, in canvas px. */
export interface StrokeBandGeometry {
  /** Closed-on-render polygon; the renderer appends Z. Empty = draw nothing. */
  readonly polygonPx: CanvasPoint[];
}
```

**Fail-closed numeric reader pattern** — copy the shape of
`toStudioStroke.ts:92-99` (total, only finite numbers accepted, absent → null):

```typescript
export function paintSeedSaltOf(
  params: Readonly<Record<string, unknown>> | undefined,
): number | null {
  const raw = params?.[PAINT_SEED_SALT_PARAM]
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null
  const salt = Math.trunc(raw)
  return salt < 0 ? null : salt
}
```

**Core math is NOT in the codebase** — take it from RESEARCH.md Q11
(centripetal Catmull-Rom, α = 0.5; `m1` tangent formula; Bézier handles at
`P1 ± m1/3`). Suggested exported surface:
`sampleVectorPath(anchors, kind) → { points, widths }`,
`resolveWidthAt(anchorIndex, t)`, `isUniformWidthProfile(profile)`.

**Determinism hazard (Pitfall 3):** this file lands in a directory the
determinism scan does not read yet — see the `determinismContract.test.ts`
assignment below.

---

### `packages/efx-watercolor/src/vector/spine.test.ts` (test, transform)

**Analog:** `packages/efx-watercolor/src/payload/toStudioStroke.test.ts`

**Fixture + sectioned pin pattern** (toStudioStroke.test.ts, whole file):

```typescript
function makeRuntimeStroke(overrides: Partial<AquarelleStroke> = {}): AquarelleStroke { /* … */ }
const BASE_SEED = hashMutationId(42)
// section 1: shape / section 2: seed / section 3: fail-closed
```

Copy: one `make*` fixture factory with a `Partial<T>` override bag, numbered
sections with a comment banner, and pins that assert *exact numbers* (e.g.
`expect(mixStrokeSeed(BASE_SEED, 3)).toBe(179180383)`). New pins the phase
needs:

- identical anchors → byte-identical sampled points (two calls, same array).
- corner anchor (`alt: true`) → tangent is the chord, never the Catmull-Rom
  neighbour blend (D-02).
- uniform width profile → `widths` is `undefined`, never an array of equal
  values (D-10 absent-means-uniform).

Run: `pnpm --filter @efxlab/efx-watercolor exec vitest run src/vector/spine.test.ts`.

---

### `packages/efx-watercolor/probe/vector-spine/{probe.ts,index.html,run.mjs}` (test-harness, batch)

**Analog:** `packages/efx-watercolor/probe/watercolor-opacity/` (three tracked files)

**Harness contract** (probe.ts): a `Rig` class, `seededRandom` mulberry32,
`withSeededMathRandom` around engine construction (the paper-pixel trap),
results written to `<pre id="result">` **and** `console.log('PROBE_RESULT', …)`,
plus `/tmp/<name>/result.json`. `run.mjs` esbuild-bundles `probe.ts`, launches
headless Chrome with `--enable-unsafe-swiftshader`, polls the result, prints a
verdict string and exits non-zero on failure.

Copy the file trio verbatim and change: the probe name, the scenarios (Q4's
dab-count table: 1920x1080 / 2048x1536 / 3072x2304), and the verdict text.
This is Wave 0 — it must land **before** the `Engine.ts` deposit work so the
dab-count baseline exists pre-change.

---

### `app/src/components/physic-paint/view/vectorPathSession.ts` (store, event-driven)

**Analogs:** `view/scriptStrokeEdition.ts` (session-only view signals) and
`view/physicsPaintCanvasZoom.ts` (display-only module store)

**Session-only signal pattern with the law spelled out**
(scriptStrokeEdition.ts:125-161):

```typescript
/**
 * 261101-o2m: the Move/Edit **Draft** VIEW mode. ON suspends ONLY the
 * watercolor engine re-render: ... Session/UI state only — never written to
 * the document, never part of the undo stack, never persisted. Read by the
 * Stroke settings strip leaf (render), the cached-base leaf and the Studio
 * event handlers (`.peek()` only); NEVER the Studio render body (rule 5).
 */
export const draftMode = signal(false);

/** Compare-then-write — 1000 identical calls notify zero times (rule 3). */
export function setDraftPixelsDirty(on: boolean): void {
  if (draftPixelsDirty.value === on) return;
  draftPixelsDirty.value = on;
}
```

**Display-only module store pattern** (physicsPaintCanvasZoom.ts:192-240):
module-level `signal(...)` + `computed(...)` exports, `setSignal` helper doing
`Object.is(target.peek(), value)` compare-then-write, and a single frozen
object export (`physicsPaintCanvasZoom`) as the public surface.

Suggested surface for this phase (D-06 / D-15 / D-16):

```typescript
export const vectorPenActive = signal(false);      // host tool latch, never an AquarelleTool
export const wireframeVisible = signal(false);     // D-15 latch, session-only
export const vectorSelectedAnchor = signal<number | null>(null);
export const vectorPathGesture = signal<VectorPathGesture | null>(null);
export const setVectorPenActive / setWireframeVisible / setVectorSelectedAnchor ...
```

Rules to carry over verbatim: no signal write in a render body, compare-then-write
on every setter, and every mutator must be safe to call 1000 times.

---

### `app/src/components/physic-paint/view/vectorPathHandles.ts` (utility, transform)

**Analog:** `view/scriptStrokeTransform.ts`

Copy the constants block and the hit-test law wholesale (scriptStrokeTransform.ts:67-82):

```typescript
export const SCRIPT_TRANSFORM_HANDLE_SIZE_PX = 9;
export const SCRIPT_TRANSFORM_HIT_PAD_PX = 8;
export const SCRIPT_TRANSFORM_ROTATE_STEM_PX = 28;
export const SCRIPT_TRANSFORM_ROTATE_RADIUS_PX = 7;
export const SCRIPT_TRANSFORM_ROTATE_SNAP_RAD = Math.PI / 12;
export const SCRIPT_TRANSFORM_SCALE_MIN_FACTOR = 0.1;
export const SCRIPT_TRANSFORM_SCALE_MAX_FACTOR = 10;
```

**Hit-test pattern** (`hitTestScriptStrokeTransformHandle`, half-extent =
`size/2 + pad`) and the **identity guard** `isIdentityScriptStrokeTransform`
are the two functions to mirror for anchors (9 px body / 8 px pad) and for the
Bézier handle stems. The anchored-geometry core (`rotateScriptPoint`,
`scaleScriptPoint`) shows the "pure point math, no DOM" split this module needs.

**Pointer gesture threshold** — `DRAG_THRESHOLD_PX = 3`
(`engine/ScriptStrokeOverlay.tsx`) so a click that never moves is a select, not
an edit.

---

### `app/src/components/physic-paint/engine/VectorPathOverlay.tsx` (component, event-driven)

**Analog:** `app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx`

**Gesture-surface pattern** (ScriptStrokeOverlay.tsx):

```typescript
const SELECTED_STROKE_COLOR = '#38bdf8';
const OUTLINE_DARK = '#111111';
const OUTLINE_LIGHT = '#ffffff';
const TRANSFORM_HANDLE_COLOR = '#f59e0b';
const DRAG_THRESHOLD_PX = 3;
```

- **pointerdown priority:** handle first, then stroke (copy the branch order).
- **pointerup identity guard:** `if (!crossed || isIdentityScriptStrokeTransform(transform)) return;`
  — never commit an unmoved drag.
- **`drag.update` during the move, commit on release** — the Studio's
  drag-updates-playhead-only law applies to view gestures; anchors commit on
  pointerup.
- **render order** for the wireframe is fixed by UI-SPEC: envelope → spine →
  rungs → anchors → handles. Use `vectorEffect="non-scaling-stroke"` on every
  path so the overlay stays screen-pixel crisp at any canvas zoom.
- **testids** follow the existing grammar: `stroke-size-band`,
  `stroke-lift-ribbon` → `vector-path-envelope`, `vector-path-spine`,
  `vector-path-anchor`, `vector-path-handle`.

The overlay mounts **above** the vendor canvas and **below** the cursor — the
same slot `AquarelleStrokeOverlay` occupies (AquarelleCanvasLayer.tsx:873-997).

---

### `app/src/components/physic-paint/engine/vectorPathOverlay.test.tsx.test.ts` (test)

**Analog:** `view/panelSplitShell.test.tsx.test.ts`

`.test.tsx` files run **zero** tests under `app/vitest.config.ts`
(`include: ['src/**/*.test.ts', …]`). Copy the double-extension filename
workaround; do not "fix" the config.

---

### `packages/efx-watercolor/src/payload/toStudioStroke.ts` (model, transform)

**Analog:** in-file. This is THE engine→host projection and the natural home
for every new persisted vector field.

**Current payload shape** (toStudioStroke.ts:63-73) — extend here, never widen
`AquarelleTool` (RESEARCH Q6):

```typescript
export interface AquarelleStrokePayload {
  tool: AquarelleTool
  color: string | null
  params: Record<string, number>
  brushId: string
  toolOverrides?: AquarelleToolOverrides
  mutationId?: number
  diffusionFrames?: number
  timestamp: number
  playFrame?: number
}
```

**Runtime shape** (toStudioStroke.ts:111-123) and the projection (:129-169)
must stay in lockstep — every new optional field is copied explicitly into both
the `StudioStroke` top level and the `engine: { … }` slot.

**Conditional-canonical rule (D-10 / D-12):** write a field only when present
and non-default, exactly like `toolOverrides` (:152, :162):

```typescript
toolOverrides: s.toolOverrides ? { ...s.toolOverrides } : {},
...
toolOverrides: s.toolOverrides ? { ...s.toolOverrides } : undefined,
```

Apply to: `anchors` (absent when the stroke is a plain freehand path),
`anchorKind` (absent when every anchor is derived), `widths` (absent when the
profile is uniform), `renderMode` (absent means `'watercolor'`). Untouched
strokes must stay byte-identical — that is the sparse-law proof.

---

### `packages/efx-watercolor/src/payload/codec.ts` (codec, transform)

**Analog:** in-file. The membership gate is total and fail-closed.

**Membership + clone pattern** (codec.ts:110 area):

```typescript
// isStrokeShape — a payload is a stroke only when the tool is in the closed union
AQUARELLE_TOOLS.includes(engine['tool'])
```

**Why this matters:** the codec's `parse` drops anything it does not know. Any
new payload field must be added here (and to `cloneStrokeForWire`) or it is
silently lost between realms — the most likely silent failure mode of this
phase. Add a round-trip pin in `codec.test.ts` for each new field.

---

### `packages/efx-watercolor/src/playground/Engine.ts` (engine, streaming)

**Analog:** in-file. Deposit changes ride existing code paths; do not add a
second renderer.

**Stroke/sample state** (Engine.ts:91-111): `interface Sample { x; y; p; t; tx; ty }`
(the queued sample — RESEARCH's "QueueItem" is conceptual) and
`interface Stroke { … carry: number; // distance travelled since the last stamp }`.

**C-03 cap — the reason per-vertex width cannot ride `maxRadius`** (:191-192, :844):

```typescript
private scriptScale = 1;
...
this.scriptScale = maxRadius ? Math.min(1, maxRadius / this.radius(tool, 1, 0)) : 1;
```

`Math.min(1, …)` means `scriptScale` can only SHRINK. A widening width profile
must be applied inside `radius()`/`sizeMult()`, not through `scriptBegin`'s
`maxRadius`.

**Dab law to preserve** (`trace()`, :1653-1689):

```typescript
const fine = this.radius(...) * this.spacingFrac(...);
const n = clamp(Math.ceil(approx / Math.max(fine, 1e-5)), 1, 48);
while (len - pos >= spacing - s.carry) { /* … */ this.stamp(/* … */); }
s.carry += len - pos;
s.travelled += len;
```

**The `simple-ribbon` deposit mode is a branch inside `trace`/`stamp`**
(C-04): `aquarelleBake.ts` only advances ticks and captures frames, so the
mode switch belongs here. Keep the branch free of `Math.random()` —
`seededRandom`/`traceSeed` only.

**`sizeMult()` / `radius()`** (:1561-1580) are the one width authority; the
per-sample width multiplier enters there.

---

### `packages/efx-watercolor/src/playground/brushes.ts` (config, preset table)

**Analog:** in-file. `const define = (p) => ({ ...BASE, ...p })` (:169) and
`export const BRUSH_PRESETS: BrushPreset[] = [` (:171).

Add the `simple-ribbon` preset as one more `define({...})` entry with a
distinct `id`. Then verify the two consumers that enumerate presets:
`PhysicsPaintBrushMenu.tsx` (must not offer it as a paint tip) and
`watercolorStrokeThumb.ts` (needs a crisp-sweep preview branch).

---

### `packages/efx-watercolor/src/adapter/engineAdapter.ts` (adapter, streaming)

**Analog:** in-file EXTENSION seam. `HOST_TICK_HZ = 60`, `HOST_DT = 1/60`.

**Existing optional-seam precedent** (`setPaper` / `isAwake` / `fix` /
`skipTicks` / `setPaintSeedFrame` / `resetSheet`): optional methods added to
`AquarelleEngine` without changing the host `EngineAdapter<P>` contract. Add
the render-mode / wireframe seam the same way — never a required member.

**Feed loop** (`feedDueSample`): `scriptBegin(...)` → `scriptMove(...)` →
`tick(HOST_DT)`. The vector path's per-sample `tw` (width) already travels on
`StudioPoint`; the adapter only needs to forward it if the engine branch reads
it (check the `Sample` interface first).

---

### `packages/efx-watercolor/src/determinismContract.test.ts` (test)

**Analog:** in-file `collectSources(...)` scan roots. **Must be widened in the
same commit as `src/vector/`**: today it scans only `src/engine` and
`src/payload`, so a `Math.random()` in the new spine module would go
unpunished (Pitfall 3). Add the `src/vector` root and the dependency pin at
:191 keeps enforcing "no engine-1 dependency".

---

### `app/src/components/physic-paint/performance/scriptTimelineCodec.ts` (codec, transform)

**Analog:** in-file AQTL v1. This is the persistence deliverable that the
opaque binary demands (C-02).

**Contract header** (:1-57) — copy the format, then extend it.

**Magic + version** (:67, :70):

```typescript
export const SCRIPT_TIMELINE_BINARY_MAGIC = 'AQTL';
export const SCRIPT_TIMELINE_BINARY_VERSION = 1;
```

Bump to `2`, and add a version-refusal arm beside the existing one at :728-729
so a v1 file is rejected with a typed error rather than misparsed (the project
law: no backward compat for old projects — clean break, no migration code).

**Fail-closed field list** (`encodeStroke`, :417-523): explicit per-field
asserts, sorted `params`, presence bytes, 16-byte point records. New fields go
in as **(a)** a presence byte, **(b)** a fail-closed reader in `decodeStroke`
(:601), **(c)** a typed `ScriptTimelineCodecErrorCode` (:78-89) when an
override bitmask contains an unknown key (:111-119 `OVERRIDE_KEYS`).

---

### `app/src/types/project.ts` + `app/src-tauri/src/models/project.rs` (model, CRUD)

**Analog:** in-file mirror pair. Every field must be declared in BOTH files
(dual-language `.mce` law).

TypeScript side: extend the engine stroke payload declaration that carries the
opaque `engine` record. Rust side: the mirrored struct — **declaration only**;
Rust stores the AQTL bytes opaquely and never parses them.

Gate: `app/src/lib/mceFieldContract.test.ts` field-diff. Add the new members to
the `expectMemberKeys('MceEngineStrokePayload', [...])` list (:242) and keep
`ALLOWED_ONE_LANGUAGE` untouched (only `MceSequence.fps` may be one-language).

---

### `app/src/components/physic-paint/view/aquarelleRecordState.ts` (store, CRUD)

**Analog:** in-file. `updateAquarelleStrokesInScript` (:714) is the ONE commit
seam for a vector-path edit.

**Commit law to copy exactly:**

1. validate the whole patch first (all-or-nothing),
2. skip unchanged targets (compare-then-write),
3. regenerate through `toStudioStroke` (never mutate the projected stroke),
4. replace at the SAME timeline index,
5. bump `bumpAquarelleStrokesRevision()` once, at the end.

Also here: `AquarelleGlobalParams` (:43), `aquarelleActiveTool` (:94),
`setAquarelleParam` (:201) / `setAquarelleTool` (:214) compare-then-write,
`selectAquarelleTip` (:236). D-13's "seven wet globals collapse & zero" is a
write through `setAquarelleParam` for each wet key — one event-handler batch,
never a render-body write.

---

### `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` (store)

**Analog:** in-file `setAquarelleSelectMode` (:326-356) — the SINGLE
entry/exit choke point. Copy this shape for the vector pen / edit-path mode:

- disarm the other host modes on entry (picker, motion boundaries),
- reset the type filter before delegating (because the delegate early-returns
  on an unchanged value),
- route the Draft reset through the settle (`setDraftMode(false)` refuses while
  dirty),
- compare-then-write on the dismissal flag.

The vector pen is a **host tool** exactly like `aquarelleSelectMode` /
`aquarellePickerActive` — never a member of `AquarelleTool`.

---

### `app/src/components/physic-paint/view/aquarelleStrokeBand.ts` (utility)

**Analog:** in-file. Extend the existing band family for the per-vertex width
profile rather than building a parallel envelope.

- `buildStrokeBand` / `buildStrokeBandCached` (cache stamp `revision|width|height`)
- `trimStrokeBandCache` (called from `listSelectableAquarelleStrokes`)
- `paintTipForStroke` / `paintRadiusDocFor` stay the radius authorities.

The REUSE CONTRACT at :1-45 forbids a second footprint implementation; the
wireframe envelope and the "Preview stroke size" band must be the same code
with the same vertex budget.

---

### `app/src/components/physic-paint/view/strokeSettingsModel.ts` (model, CRUD)

**Analog:** in-file field table.

**Field declaration pattern** (strokeSettingsModel.ts:38-54, 80-97):

```typescript
export interface StrokeSettingsField {
  readonly key: string;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly kind: 'numeric' | 'segmented';
  readonly options?: readonly StrokeSettingsFieldOption[];
  readonly paramKey?: string;
  readonly fallback?: number;
}
```

Add the "Anchor width" row as a **new numeric field** on the watercolor table
with UI-SPEC's bounds (`min 0.2`, `max 2.0`, `step 0.1`) — but note these are
multiplier units, not the 0-100 canonical units of the wet rows, so it must be
read/written through its own patch path, not `buildAppearancePatch`.

Render-mode is a `segmented` field (`Render`: `Watercolor` | `Ribbon`) OR the
advanced disclosure's switch — UI-SPEC §6 fixes the copy; either way the
`options: [{ label, value }]` shape is the pattern.

---

### `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` (component)

**Analog:** in-file, three regions.

**Header button pattern** (:811-898) — the spline-pointer button (D-06) is this
exact shape, 22x22 in CSS:

```tsx
<button
  type="button"
  data-testid="stroke-settings-preview-stroke-size"
  class="physics-paint-stroke-settings-header-button physics-paint-stroke-settings-preview-toggle"
  aria-pressed={previewStrokeSize}
  aria-label="Preview stroke size"
  title="Preview stroke size — draw every stroke as the area it covers"
  onPointerDown={(event) => event.stopPropagation()}
  onClick={() => setStrokeSizePreview(!strokeSizePreview.peek())}
>
  <Spline size={12} aria-hidden="true" />
</button>
```

The `stopPropagation` is mandatory: the header is the drag handle.

**Numeric row pattern** (:1434-1457) — `SliderStepper` with `commitOnRelease`,
`allowOutOfRangeEntry`, `mixed`:

```tsx
<SliderStepper
  label={field.label}
  ariaLabel={field.label}
  value={reading.value}
  min={field.min} max={field.max} step={field.step}
  mixed={reading.mixed}
  commitOnRelease
  allowOutOfRangeEntry
  onChange={(value) => { void bundle.applyAppearance(ids, buildAppearancePatch(engineModule, field.key, value)); }}
/>
```

`SliderStepper` lives at `app/src/components/shared/SliderStepper.tsx:264`;
import path `'../../shared/SliderStepper'`.

**Segmented row pattern** (:1458-1497): `role="group"` + `aria-label`, each
option a `<button aria-pressed={active}>` styled with `SEGMENT_STYLE` /
`SEGMENT_ACTIVE_STYLE`, red italic `Mixed` caption when readings disagree.

---

### `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx` (component)

**Analog:** in-file. Two regions.

**Paint-tool row** (:52-63) — the closed union, four entries; do NOT add a fifth
`AquarelleTool`:

```typescript
const WATERCOLOR_RAIL_TOOLS: ReadonlyArray<{
  id: AquarelleTool; label: string; shortcut?: string;
  Icon: (props: { size?: number }) => ComponentChildren;
}> = Object.freeze([
  { id: 'brush', label: 'Brush', shortcut: 'B', Icon: Paintbrush },
  ...
]);
```

**Host-tool button pattern** (:144-204) — copy this verbatim for "Vector pen"
(`PenTool`/`Spline` from `lucide-preact`, both verified exported) and for
"Wireframe":

```tsx
<button
  type="button"
  class={`physics-paint-icon-button${pickerActive ? ' active' : ''}`}
  data-testid="aquarelle-picker-toggle"
  disabled={disabled}
  title="Picker (I) — …"
  aria-label="Picker"
  aria-pressed={pickerActive}
  onClick={() => { setAquarelleSelectMode(false); /* … */ toggleAquarellePickerLatched(); }}
>
  <Pipette size={18} />
</button>
```

Placement is fixed by UI-SPEC: the 5th entry sits after `lift`, separated by a
1 px `#5a5e63` rule; the wireframe latch goes **after Motion boundaries,
before Dry** (:194-204). Active-state precedence is already modelled by
`isActive = !selectActive && !pickerActive && !motionBoundaryActive && active === id`
(:117) — add the new latch to that predicate.

Icons: `import { Droplet, Eraser, Paintbrush, Pen, Pipette, RefreshCcwDot, Scan, Wind } from 'lucide-preact';` (:4).

---

### `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts` (middleware)

**Analog:** in-file, the paint-tool shortcut arm (:365-374). Add `V` in the
same switch, gated by `isPaintEditMode()` and the existing text-field guards.

Rules to copy: one shortcut authority (never a second listener), bail when a
text field / contenteditable owns the key, and route every shortcut through the
module's setter — never write a signal directly from the handler.

---

### `app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx` (component)

**Analog:** in-file `BRUSH_PRESETS` mapping (:124 for the lift branch, :171-195
for the brush branch). The `simple-ribbon` preset must be **filtered out** of
the paint-tip list (it is a deposit mode, not a tip) — one `.filter(p => p.id !== 'simple-ribbon')`
in both mapping sites.

---

### `app/src/components/physic-paint/view/watercolorStrokeThumb.ts` (utility)

**Analog:** in-file `getStrokeThumb` (:161-183) + `tipCache` / `thumbCache`.
`STROKE_THUMB_WIDTH/HEIGHT = 150/44`, `STROKE_THUMB_HEX = '#2338a8'`,
`strokeThumbPainter` spy seam.

Add a crisp-sweep branch for `simple-ribbon` keyed by preset id, so the brush
menu shows a hard-edged sweep instead of a watercolor blur. Keep the cache
key + `clearStrokeThumbCache` discipline.

---

### `app/src/components/physic-paint/view/scriptStrokeEdition.ts` (store)

**Analog:** in-file. The **wireframe** latch is this exact signal style
(:134-177) — session-only, compare-then-write setter, never persisted, never
undoable, read only by narrow leaves:

```typescript
export const frozenCacheVisible = signal(true);

export function setFrozenCacheVisible(on: boolean): void {
  if (frozenCacheVisible.value === on) return;
  frozenCacheVisible.value = on;
}
```

Add `wireframeVisible` here (not in a new module) so the overlay's narrow leaf
reads one store. The engine/Studio realm needs it pushed across — see
`physicPaintDraftMode.ts` below.

---

### `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` (component)

**Analog:** in-file mount region (:873-997). `AquarelleStrokeOverlay` mounts
above the vendor canvas and below the cursor; `VectorPathOverlay` takes the
same slot (or a sibling branch selected by the tool latch). Cursor signals are
compare-then-write; the live-paint opacity gate stays untouched.

---

### `app/src/lib/physicPaintDraftMode.ts` (middleware, pub-sub cross-realm)

**Analog:** in-file. This is the template for pushing the session-only
wireframe flag from the main window realm to the Studio realm:

```typescript
export const PHYSIC_PAINT_DRAFT_MODE_EVENT = …;
export const PHYSIC_PAINT_DRAFT_HEARTBEAT_MS = 5000;
export const PHYSIC_PAINT_DRAFT_STALE_MS = 20000;
export function readDraftModePayload(...)
export function setStudioDraftModeActive(...)   // transition law + release handler
export function publishStudioDraftMode(...)
export function installPhysicPaintDraftModeListener(...)
```

Copy: the Tauri-runtime guard (silent no-op in a browser), the heartbeat +
staleness window, the one release handler, and the "publish only on a real
transition" law. Do not invent a second transport.

---

### `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (component)

**Analog:** in-file Draft gates (:5359, :5436, :5501, :5711, :5731, :5918,
:5927, :5955) and the cross-realm publisher (:10691):

```typescript
const active = draftMode.value || draftPixelsDirty.value;
publishStudioDraftMode(active);
```

The wireframe `D-15` "nothing baked while on" gate belongs at the same bake
boundaries — guard the rebake/capture call sites, never the render body.

---

### `app/src/components/physic-paint/physicsPaintStudio.css` (config)

**Analog:** in-file. `.physics-paint-icon-button` rules at :595, :602, :679,
:694, :699, :708, :716; `.physics-paint-tool-rail` at :611, :616, :623, :667.
The 1 px separator and the wireframe button reuse the existing button rules;
the spline-pointer header button reuses `.physics-paint-stroke-settings-header-button`
(22x22, `:6262`/`:6268` for the `aria-pressed='true'` state).

---

## Shared Patterns

### Authentication / authorization
**N/A.** This is a local desktop editor; the "guard" equivalent is the
`isPaintEditMode()` + text-field guard pair in the keyboard authority and the
`disabled` prop on every rail button. Apply both to every new control.

### Session-only view state (the phase's cross-cutting law — D-16)
**Sources:** `view/physicsPaintCanvasZoom.ts:1-18` (display-only header),
`view/scriptStrokeEdition.ts:125-177` (draft + cache-eye signals),
`lib/physicPaintDraftMode.ts` (cross-realm transport).
**Apply to:** vector pen latch, edit-path latch, wireframe latch, anchor
selection, active gesture.
Rule: never in `.mce`, never in the revision, never in a cache key, never in
export. Model it exactly like the Phase 60 zoom store.

### Compare-then-write setters (efx-preact-reactivity rule 3)
**Source:** `view/physicsPaintCanvasZoom.ts:232-237`
```typescript
function setSignal<T>(target: Signal<T>, value: T): boolean {
  if (Object.is(target.peek(), value)) return false;
  target.value = value;
  return true;
}
```
**Apply to:** every new setter, every session signal, every mode latch.

### No signal writes in a render body (rule 6) / narrow reads (rule 5)
**Source:** `view/aquarelleStrokeBand.ts:1-45` purity note +
`view/scriptStrokeEdition.ts:125-132` ("Read by the leaf; NEVER the Studio
render body"). **Apply to:** the overlay, the rail, the settings dialog.

### ONE commit seam for a scripted edit
**Source:** `view/aquarelleRecordState.ts:714` `updateAquarelleStrokesInScript`
+ `view/aquarelleStrokeSelection.ts:862-880` `beginAquarelleAppearanceEdit`.
**Apply to:** every anchor/width/render-mode edit. One patch validation, one
`toStudioStroke` regeneration, one revision bump, one undoable ledger command.

### Conditional canonical terms (sparse persistence)
**Source:** `payload/toStudioStroke.ts:152,162` (`toolOverrides` present-only)
+ `payload/toStudioStroke.ts:84-99` (`paintSeedSaltOf` absent → null).
**Apply to:** `anchors`, `anchorKind`, `widths`, `renderMode`. Absent means the
documented default; untouched strokes stay byte-identical.

### Fail-closed binary codec
**Source:** `performance/scriptTimelineCodec.ts:1-57`, `:67-102`, `:417-523`,
`:601`, `:712-729`. **Apply to:** AQTL v2. Magic + version bump, explicit field
list, no unknown-key tolerance, typed error codes, no legacy reader.

### Determinism
**Source:** `packages/efx-watercolor/src/determinismContract.test.ts` +
`payload/toStudioStroke.ts:132-153` (`hashMutationId` / `mixStrokeSeed`).
**Apply to:** `Engine.trace`/`stamp` branch and `vector/spine.ts`. No
`Math.random()`, no `Date.now()`, seeded mulberry32 only. Widen the scan roots.

### Engine seam extension
**Source:** `adapter/engineAdapter.ts` optional EXTENSION members.
**Apply to:** render-mode / wireframe plumbing — optional methods, never a
breaking change to `EngineAdapter<P>`.

### Test conventions
- `app/vitest.config.ts` collects `src/**/*.test.ts` only — a `.test.tsx`
  runs zero tests; use `Foo.test.tsx.test.ts`.
- `packages/efx-watercolor` has `"test": "vitest run"`, vitest ^2.1.9, no local
  config; run `pnpm --filter @efxlab/efx-watercolor exec vitest run <file>`.
- Never `pnpm test` (watch mode is forbidden in this repo).

---

## Partial / No Analog Found

Aspects with no direct codebase precedent — the planner must take these from
RESEARCH.md rather than copy code.

| Aspect | Owning file | Why no analog | Source to use |
|--------|-------------|---------------|---------------|
| Centripetal Catmull-Rom spine sampling (α = 0.5, `m1` tangent, handles at `P1 ± m1/3`) | `packages/efx-watercolor/src/vector/spine.ts` | No sampler exists in the package; `src/vector/` is a new directory | RESEARCH.md Q11 |
| Two anchor kinds (coupled-handle Bézier vs derived auto-smooth) with permanent promotion on grab | `vector/spine.ts` + `vectorPathSession.ts` | First editable-path model in the codebase; the closest editable geometry is the transform box | CONTEXT D-01/D-02/D-03 |
| AQTL **v2** anchor encoding | `performance/scriptTimelineCodec.ts` | v1 has no anchor concept; only the v1 shape exists to extend | C-02 + the v1 header contract |
| A second `Engine.trace` deposit mode (`simple-ribbon`) | `playground/Engine.ts` | Engine has one deposit path today; the mode branch is new | CONTEXT D-11/D-14, RESEARCH Q1/Q4 |
| Per-vertex width envelope inside `Engine.radius()` | `playground/Engine.ts` | `scriptScale` is clamped to `Math.min(1, …)` and cannot widen (C-03) | RESEARCH Q2 + CONTEXT D-08/D-09 |

---

## Metadata

**Analog search scope:** `app/src/components/physic-paint/**`,
`app/src/lib/**`, `app/src/types/**`, `app/src-tauri/src/models/**`,
`packages/efx-watercolor/src/**`, `packages/efx-watercolor/probe/**`.
**Files scanned:** ~60 (Read: 22 files in full or targeted ranges; Grep/Glob: remainder).
**Analogs: 12 chains / 25 distinct analog files.** Stopped at the 3-5 strong
matches per file rule; no further widening produced new information.
**Tracked-source gate:** `git ls-files --` verified all 32 cited analog paths
(no `.gsd/capabilities/**` mirror referenced).
**Pattern extraction date:** 2026-11-10.

**Key corrections carried into this map:**
- C-01: the real rail seam is `WATERCOLOR_RAIL_TOOLS` (PhysicsPaintToolRail.tsx:52-63), not the unmounted `AquarelleToolRow.tsx`.
- C-02: AQTL is opaque binary → persistence is three deliverables (codec v2, TS/Rust declaration pair, round-trip pin).
- C-03: `Engine.ts:844` clamps `scriptScale` with `Math.min(1, …)`.
- C-04: `aquarelleBake.ts` never stamps; the mode lives in `Engine.trace`/`stamp`.
- RESEARCH's "QueueItem" is `interface Sample` at `Engine.ts:91`.
