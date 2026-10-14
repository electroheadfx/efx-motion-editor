# Architecture Research — v2.0.0 Multi-Module Paint Workstation

**Domain:** Multi-engine paint workstation over one shared Studio script/bake/timeline engine (Tauri + Preact monorepo)
**Researched:** 2026-10-14
**Confidence:** HIGH (seam map derived from locked specs `SPECS/v1.1.0-*` + live code inspection of `packages/efx-physic-paint` and `app/`; MEDIUM only on spectral.js upstream API details — local oracle `spectral.ts` is the working reference)

---

## 1. System Overview (target state)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  app/ — ONE Studio window + ONE Studio engine (never forked)             │
│                                                                          │
│  TopBar: [existing icons] [MODULE SWITCHER: Brush | Water color | (Krita slot)] │
│                                                                          │
│  ┌────────────────┐  ┌─────────────────────────────────────────────┐    │
│  │ Module options │  │ Shared Studio surface                        │    │
│  │ panels         │  │ Roto timeline · script library · Apply dialog│    │
│  │ (per engine)   │  │ bake host (finalizationQueue pattern)        │    │
│  │                │  │ Loop Clips · cache · export                  │    │
│  └───────┬────────┘  └──────────────────┬──────────────────────────┘    │
│          │ drain options/features       │ script envelope + ticks        │
├──────────┴──────────────────────────────┴────────────────────────────────┤
│  packages/efx-paint-host  — Studio law (Preact-free, engine-agnostic)    │
│    animation/ · util/traceSeed · script/ envelope · time/ ticks +        │
│    diffusionFrames mechanism · bake-host queue pattern                   │
├──────────────────────────────────────────────────────────────────────────┤
│  Engine adapters (opaque payload carriers — host never parses them)      │
│  ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────┐  │
│  │ efx-physic-paint     │ │ efx-watercolor       │ │ efx-krita (slot) │  │
│  │ engine 1 (refactor)  │ │ engine 2 (clean-room)│ │ v2.1.0, OUT      │  │
│  │ brush/core/engine/   │ │ WebGL2 fluid grid    │ │                  │  │
│  │ render/paper         │ │ StrokeWriter-style   │ │                  │  │
│  └──────────┬───────────┘ └──────────┬───────────┘ └──────────────────┘  │
│             │                        │ consumes                          │
│             │ (adopts v2.1.0)        ▼                                   │
│             └──────────── packages/efx-spectral (MIT, shared, tiny)      │
└──────────────────────────────────────────────────────────────────────────┘
```

**The one rule everything else follows:** the Studio script law
(`record → play that engine's physics → bake WebP → cache → timeline reads cache`)
is shared. Engines and per-paint UIs are isolated. Modules change the
options/features surface, never the engine.

---

## 2. (a) The efx-paint-host seam

### 2.1 Where the seam goes

`packages/efx-paint-host` sits **between** `app/` (Studio) and the engine
packages. It is a **move + contract extraction** out of `efx-physic-paint`
(tranche 0b), not a rewrite. Direction of dependency after the split:

```
app/  →  efx-paint-host  →  (nothing engine-specific)
app/  →  efx-physic-paint  →  efx-paint-host      (engine 1 consumes host)
app/  →  efx-watercolor    →  efx-paint-host
efx-watercolor  →  efx-spectral                   (colour math only)
efx-physic-paint →  efx-spectral                  (v2.1.0, NOT v2.0.0)
```

Host is **Preact-free** (decide Q3 of the paint-host spec that way): the
watercolour engine is Preact-free, the host must not force Preact into engine
packages. If anything Preact-flavoured is needed, it lives in a `./preact`
entry exactly like `efx-physic-paint` already does
(`exports: { ".", "./preact", "./animation" }`).

### 2.2 Seam map — what moves out of efx-physic-paint

| Module (today) | Destination | Notes |
|---|---|---|
| `packages/efx-physic-paint/src/animation/` (`AnimationPlayer`, `progressiveStrokeSchedule`, `staticStrokeSchedule`, `recordedStrokeMotion`, `types.ts`) | `efx-paint-host/animation/` | Whole folder (paint-host spec Q1 default). `AnimationStrokeStyleOverride` must lose `physicsMode` at the boundary — that becomes engine payload. |
| `packages/efx-physic-paint/src/util/traceSeed.ts` (`fnv1a`, `hashMutationId`, `seededRng`) | `efx-paint-host/util/traceSeed.ts` | FNV-1a offset 2166136261 / prime 16777619 + mulberry32 stream — this IS the determinism law (R3.1–R3.2). Keep `seededRng(strokeSeed, streamKey)` signature so engine-1 deposit paths re-point without logic changes. |
| Script envelope — today app-owned: `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts` (`PersistedRotoScriptV1`, thumbnail, source, limits) | `efx-paint-host/script/` (generic envelope) | The app schema becomes **engine-1's payload codec** on top of the host envelope. The `kind`/`schemaVersion`/`id`/`name`/timestamps/`thumbnail`/library-row shape is shared Studio law. |
| Tick grid + `diffusionFrames` **mechanism** (today implicit: `PaintStroke.diffusionFrames` + `AnimationConfig.fps`) | `efx-paint-host/time/` | Integer ticks (~1/60 s, exact value fixed at plan time). Host owns the mechanism; each engine owns its cap policy (e.g. watercolour cap 600 is the engine's bake window, not the host's). |
| Bake-host pattern: `app/src/components/physic-paint/pilot/finalizationQueue.ts` (Effect v4 bounded queue, concurrency 2, `beginFlush`, generation-stale commits) | `efx-paint-host` bake host (port the pattern) | R4: **no Web Worker, no new cancellation model**. PlayScript bake aborts on dispose — port that semantics per bake type; long fluid cuissons use the flush-survives-navigation semantics. |

**Stays in `efx-physic-paint` (engine 1 only):** `brush/`, `core/`, `engine/`,
`render/`, `paper`, `BrushOpts`, `PhysicsMode`, `PaintStroke`'s engine-specific
fields, the dual-canvas wet/dry buffers, fluid solver, drying LUT. Its name
keeps meaning engine 1.

**Stays in `app/`:** Studio window/UI, Roto timeline model (keyId/appFrame,
finalizeProposal), compositor (`getFlattenedFrame`), `.mce` IO through Rust,
the script library UI, `physicsPaintRotoPlayScriptController.ts` (re-pointed to
host imports, no behaviour change at the seam — R1.3).

### 2.3 The generic per-engine stroke payload

One shared shape, engine-specific data carried **opaquely**. Host APIs are
parameterised over `P`; host code never reads `P`'s fields (R2.2).

```typescript
// efx-paint-host/script/payload.ts — the ONLY stroke shape the host knows

/** Shared stylus sample. `tick` is the integer tick of this sample (never ms). */
export interface StudioPoint {
  x: number; y: number;
  p: number;            // pressure 0..1
  tx: number; ty: number; tw: number;  // tilt / twist
  tick: number;         // integer tick offset within the stroke
}

/** Host-owned motion schedule input (wiggle / held-pose / drift). */
export interface StudioStrokeMotion {
  strokeDeformation: number;   // 0..100
  strokePosition: number;      // 0..100
}

/**
 * Shared stroke record. `engine` is the opaque per-engine payload slot.
 * Tool ids, colour model, and ALL engine params live inside `engine`.
 */
export interface StudioStroke<P = unknown> {
  pts: readonly StudioPoint[];
  ticks: number;                       // stroke duration on the fixed tick grid
  cuisson: number;                     // diffusion budget in ticks (per-stroke)
  motion: StudioStrokeMotion | null;
  brushId: string;                     // stable id into the engine's brush pack
  toolOverrides: Readonly<Record<string, number | string | boolean>>;
  traceSeed: number;                   // FNV-1a-derived, assigned at record time
  engine: P;                           // OPAQUE — host never inspects this
}

/** Shared script envelope. engineId is the Apply fail-closed discriminator. */
export interface StudioScriptEnvelope<P = unknown> {
  kind: 'efx-studio-paint-script';
  schemaVersion: number;
  engineId: EngineId;                  // 'efx-physic-paint' | 'efx-watercolor' | 'efx-krita'
  id: string; name: string;
  createdAt: string; updatedAt: string;
  source: StudioScriptSource;          // project/layer/frame/dims + display hint only
  thumbnail: StudioScriptThumbnail;    // image/webp dataUrl, shared limits
  brushPack: BrushPackSnapshot;        // TRAVELS IN .mce — deliberate exception to 52.2
  strokes: readonly StudioStroke<P>[];
}

export type EngineId = 'efx-physic-paint' | 'efx-watercolor' | 'efx-krita';
```

**Per-engine payload examples** (each engine defines its own `P`; host code
compiles against `StudioStroke<P>` generically):

```typescript
// efx-physic-paint — engine-1 payload extracted from today's PaintStroke
interface PhysicStrokePayload {
  tool: 'paint' | 'erase' | 'move';
  color: string | null;
  params: BrushOpts;                   // size, opacity, waterAmount, dryAmount, …
  physicsMode: 'local' | 'last' | 'all' | null;
  hasPenInput?: boolean;
}

// efx-watercolor — engine-2 payload (vocab locked in 01-gsd-context R3.1)
interface WatercolorStrokePayload {
  tool: 'brush' | 'water' | 'pen' | 'lift';   // ONLY these four in v2.0.0
  color: string | null;
  params: {
    size: number; water: number; load: number; flow: number;
    bleed: number; dry: number; edge: number; granulation: number;
    // tip/aspect/rotation/size-curve/wetRound ride the brush-pack record,
    // not per-stroke, except toolOverrides
  };
}
```

**Engine adapter contract** (the plug point engines implement; host drives it):

```typescript
export interface EngineAdapter<P> {
  readonly engineId: EngineId;
  readonly payloadCodec: {
    serialize(stroke: EngineStroke<P>): StudioStroke<P>;
    parse(raw: unknown): StudioStroke<P> | null;   // null → fail-closed refuse
  };
  /** Feed one recorded stroke sample stream into the live sim. */
  applyStroke(stroke: StudioStroke<P>, ctx: PlayContext): void;
  /** Advance the engine's physics by one tick. No forced dry at boundaries. */
  stepTick(tick: number): void;
  /** Capture the engine's composited pixels (transparent where unpainted). */
  captureFrame(): CanvasImageSource;
  dispose(): void;
}
```

**Apply is fail-closed across engines** (R2.3, `physicsPaintRotoScriptApplyRefusal`
class): unknown `engineId`, unparseable `engine` payload, or engine mismatch
onto a different engine's layer → named visible refusal, never half-apply.

### 2.4 Parity guard (why this is a refactor, not a rewrite)

R5.2 / A4: the same recorded engine-1 script replayed after the split must bake
the same pixels (golden / delta threshold). R5.3 A5: a **fake engine-2 payload**
must compile against the host API and round-trip record → play → bake with zero
engine-1 types leaking in. A5 is the genericity proof — treat it as the phase's
signature acceptance row.

---

## 3. (b) efx-watercolor plugs into the Studio script law and the compositor

### 3.1 Package and engine shape

`packages/efx-watercolor` = clean-room reimplementation of the published
physics in the local oracle (`SPECS/v1.1.0-water-color/watercolor-playground/src/engine/`,
**no licence → no code copy, method only**). It is UI-free (the oracle proves
this: "The simulation and the rendering don't depend on the UI") and
instantiable per canvas.

Texture layout to reimplement (from the oracle's shader comments):

```
velocity  RG16F   sim grid      water flow
wet       R16F    doc grid      standing water (dries over time)
ink       2×RGBA16F            mobile pigment: A = absorbance 0..3, B.rgb = 4..6, B.a = gouache
fixed     2×RGBA16F            settled pigment
paper     RGBA8                r = lit relief, g = height, b = mottle, a = fleck
```

Transport passes: semi-Lagrangian advection → wet-gated diffusion (bleed) →
capillary flux down the wetness gradient (tide line) → fix → dry. Conservation
law: pigment fluxes gated by mobility on BOTH sides — never seeps onto dry
paper.

### 3.2 Script law integration (the four steps)

| Step | Host provides | Engine-2 provides |
|---|---|---|
| 1. record | envelope + `StudioStroke<P>` + integer-tick snapping (`time/`) + `traceSeed` | payload codec (`brush/water/pen/lift` + watercolour params), brush-pack snapshot entries |
| 2. play | schedule player (`animation/`), `stepTick` drive, `cuisson` budget | the fluid sim evolves — **forcing Dry at frame boundaries is prohibited** (P4); blooms/tide lines must survive into baked frames |
| 3. bake | bake host (finalizationQueue pattern — survives leaving the frame), WebP encode via existing Rust codec path | `captureFrame()` → transparent-where-unpainted pixels |
| 4. after | timeline/cache/Loop Clips/export read **cache only** — unchanged Studio contract | nothing (no live GPU fluid on the timeline, P3) |

The oracle's `StrokeWriter` concept (feed scripted samples along a path with
speed/pressure/taper) is the model for engine-2's `applyStroke`: the host
replays recorded `pts` with recorded per-sample `ticks`; the engine does the
rest. `dt`-in-the-mark is satisfied by the tick grid (Q2=B): record snaps each
sample to the nearest tick and stores the integer.

### 3.3 Compositor integration (unchanged law, new producer)

`getFlattenedFrame` remains the **sole** content path for preview and export
(CMP-01 keystone). Watercolour adds a **fourth paint layer kind** beside Basic
(perfect-freehand) / FX (p5.brush) / Physics (engine 1) — naming is UI-SPEC
scope. What the compositor sees is identical to today's Physics frames:

- baked WebP frames, **transparent where unpainted**;
- v1.0 compositor law: tracks transparent between each other; paper is the
  document fond (`physicPaintStore._resolveDocumentFondInstruction` + `paperPass`);
- **no rebake on paper change** — paper = conditioned height map → valley/peak
  tiles swapped at the composite seam (`app/src/lib/paperPass.ts`,
  `PaperPassTile { valley, peak }`);
- engine-side tooth (granulation settle, dry-brush skip) is the **deposit role**
  of the four-role law — it bakes into the mark, does not make the WebP
  paper-dependent (R2.3).

**Paper pack (rides phase 56):** the oracle's 10 procedural papers (cold press,
hot press, rough, khadi, washi, kraft, …) become clean-room height/mottle/fleck
fields exported as `PaperPassTile`-shaped entries into the **Studio paper
library for ALL paints** (normal, physic, aquarelle, and later krita). This is
the one deliverable of 56 that reaches beyond engine 2.

### 3.4 Determinism

Same script ⇒ same pixels. Seed per stroke through host `traceSeed`
(FNV-1a → `seededRng(strokeSeed, streamKey)`). No `Math.random()` / bare
`rand()` in deposit or sim path (P-level law + R1.5). Sim step count and `dt`
quantisation are fixed by the tick grid — the open point from the grill context
is closed by construction once `time/` is host-owned.

---

## 4. (c) efx-spectral package boundary

**One tiny shared package, zero engine dependencies.**

```
packages/efx-spectral/          # MIT (rvanwijnen/spectral.js method + data)
  NOTICE                        # MIT attribution — required
  src/
    spectralData.ts             # 38-band PRIMARIES, 7-coeff BASIS, display weights (vendored MIT data)
    spectral.ts                 # Pigment { coeffs: Float32Array(7), white },
                                # pigmentFromHex, coeffsToHex, mixToHex, hexToRgb/rgbToHex
    glsl.ts                     # displayBasisGLSL() — GLSL basis export as a string
  (no preact, no host, no engine imports — pure colour math)
```

Surface mirrors the oracle's `spectral.ts` (which is itself the spectral.js
method): `COEFFS = 7` absorbance basis + white gouache channel; display
rebuilds 16 bands with `exp(-A)` → sRGB (ΔE_OK ≈ 0.1–0.2 per spec).

**Dependency law (why this boundary):**

| Placement | Verdict | Why |
|---|---|---|
| `packages/efx-spectral` (chosen) | YES | engine 2 consumes now; engine 1 adopts in v2.1.0 (replaces `mixSubtractive` RYB heuristic) with **no rewrite** — it is already a dependency in the graph, just add the call sites |
| inside `efx-watercolor` | NO | would force engine 1 → engine 2 dependency at adoption time |
| inside `efx-paint-host` | NO | host is the Studio law, not a colour toolbox |
| vendor into each engine | NO | duplicated mixing code — explicitly banned (milestone scope) |

`efx-krita` does **not** consume it (libmypaint mixes internally; smudge ≠
mixing). Engine 2 keeps the GLSL display basis usage engine-side via
`displayBasisGLSL()` — the package exports the string, the engine owns the
shader program.

**Sequencing note (locked in milestone scope):** if plan-time shows phase 56
needs spectral before 57 runs, **create `packages/efx-spectral` early inside 56**
(or pull 57's content forward). Never duplicate the mixing code inside the
watercolor engine to dodge the ordering. Phase 57 then finishes the shared
hardening (NOTICE audit, CPU helper tests, API freeze for engine-1 adoption).

---

## 5. (d) Module switcher over ONE Studio

### 5.1 What a "module" is

A module is a **registration record**, not a window or a Studio fork:

```typescript
interface StudioModule {
  id: EngineId;
  label: 'Brush' | 'Water color' | 'Krita';
  engineAdapter: EngineAdapter<unknown>;      // bound instance
  optionsPanel: ComponentType;                // drains OWN options into the panels
  features: ModuleFeatures;                   // which Studio affordances apply
  brushPackKind: string;                      // pack snapshot namespace in .mce
}
```

- Placement: top-bar icon near the existing icons in
  `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx` (exact placement
  / iconography / panel layout = discuss-phase gray zone, per milestone scope).
- v2.0.0 ships **Brush + Water color**; **Krita is a visible-but-inert slot**
  (or absent) — do NOT implement krita here.
- Switching selects the engine adapter + brush pack + options surface for
  **new work**; it does not migrate or reinterpret existing frames/scripts.

### 5.2 One Studio engine — what never forks

Shared across modules, single implementation each:

- script law: record → play physics → WebP bake → cache (`efx-paint-host`);
- script library lifecycle (load/save/thumbnail/Apply/Loop Clip) — one library,
  rows tagged by `engineId`;
- Roto timeline (keyId/appFrame, finalizeProposal, group ops, interpolation);
- bake host + cache management + WebP runtime + 512 MB LRU;
- compositor `getFlattenedFrame` + export;
- `.mce` package IO through Rust (project_package_fs_scope law).

**Fail-closed Apply across engines:** a script refuses to apply onto a layer of
a different engine (same class as `physicsPaintRotoScriptApplyRefusal`). The
envelope's `engineId` is the discriminator.

### 5.3 What the module changes

Only the options/features surface:

- left/right panels drain the module's own controls (Brush keeps today's
  physics sliders; Water color drains `brush|water|pen|lift` + watercolour
  params + its 14-tip brush set);
- toolbars/feature flags per module (`features`) so shared Studio affordances
  grey out rather than fork;
- brush-pack namespace per module inside the `.mce` snapshot.

**Layer kind is engine-addressed:** a document can hold tracks of different
engines; the switcher changes the active editing surface. Scripts replay only
onto matching-engine tracks.

---

## 6. Recommended package structure (post-split)

```
packages/
  efx-paint-host/               # NEW — Studio law (Preact-free)
    animation/                  # moved: schedules, motion, player (generic over P)
    util/traceSeed.ts           # moved: FNV-1a + seededRng determinism
    script/                     # NEW: StudioScriptEnvelope, StudioStroke<P>,
                                #       EngineAdapter, fail-closed parse
    time/                       # NEW: tick grid, cuisson/diffusionFrames mechanism
    bake/                       # NEW: finalizationQueue pattern (Effect, bounded)
    index.ts
  efx-spectral/                 # NEW — MIT spectral colour (tiny, dep-free)
  efx-physic-paint/             # engine 1 — keeps name, keeps ONLY physics
    brush/ core/ engine/ render/ paper
    (imports efx-paint-host; re-points its animation/traceSeed usages)
  efx-watercolor/               # NEW — engine 2 (clean-room WebGL2)
    engine/ (fluid grid, transport, fix/dry, paper field)
    brushes/ (tip records → pack snapshot)
    payload.ts (WatercolorStrokePayload + codec)
    index.ts (EngineAdapter<WatercolorStrokePayload>)
  efx-krita/                    # v2.1.0 SLOT — do not create in v2.0.0
```

`app/` gains: module registry + switcher in the top bar, per-module option
panels, a fourth paint layer kind wiring, paper-pack library entries. `app/`
re-points imports from `efx-physic-paint/animation` → `efx-paint-host` (one-time
import churn accepted, R1.3).

---

## 7. Data Flow

### Script record → bake (all engines)

```
User stroke (Studio canvas)
  → engine adapter (live paint)
  → record: StudioStroke<P>  { pts/ticks, cuisson, motion, brushId, toolOverrides, traceSeed }
  → StudioScriptEnvelope<P>  (brushPack snapshot attached)
  → Apply / Play:
        host schedule player replays pts on the tick grid
        adapter.stepTick() lets physics evolve (no forced dry)
        cuisson budget (per-stroke) bounds the evolution
  → bake host captures adapter.captureFrame() → WebP (Rust codec) → cache
  → timeline / scrub / Loop Clips / export read cache ONLY
  → getFlattenedFrame stacks transparent paint frames + paperPass fond
```

### Module switch

```
TopBar module icon
  → set active StudioModule (signal — Preact signals only, no useState)
  → panels re-render from module.optionsPanel
  → engine adapter bound for new record/play work
  → existing scripts/frames untouched (engineId fail-closed Apply)
```

---

## 8. Patterns to Follow

### Pattern 1: Generic envelope + opaque engine payload
**What:** host types parameterised over `P`; host never inspects `P`.
**When:** every host API surface (record, play, bake, library).
**Trade-off:** engine freedom without host forks; parse errors must be
fail-closed by each engine's codec. Example in §2.3.

### Pattern 2: EngineAdapter plug point
**What:** one interface (`applyStroke` / `stepTick` / `captureFrame` / `dispose` +
`payloadCodec`) per engine.
**When:** engine 2 and (later) engine 3 land behind it; the Studio drives
adapters, never engine internals. **Trade-off:** slight ceremony per engine;
pays for itself the first time a second engine exists.

### Pattern 3: Bake host = finalizationQueue pattern (ported, not reinvented)
**What:** Effect v4 bounded turn queue, generation-stale commits, `beginFlush`
on nav/close/save/export; PlayScript bake aborts on dispose.
**When:** every bake in every engine. **Trade-off:** Effect machinery is heavier
than a promise chain, but the alternative (boolean-flag FSM) is the known
regression source (efx-async-orchestration law). No Web Worker.

### Pattern 4: Composite-only paper (paperPass)
**What:** paint WebPs stay transparent; paper is a conditioned height map →
valley/peak tiles swapped at the composite seam; no rebake on paper change.
**When:** all paints, including the new paper pack (10 procedural papers).
**Trade-off:** engine-side tooth must be deposit-role only or WebPs become
paper-dependent.

### Pattern 5: Determinism by seeded draws only
**What:** `traceSeed` (FNV-1a) + `seededRng(strokeSeed, streamKey)`; arc-length
keyed draws (resample-stable); no `Math.random()` in deposit/sim.
**When:** every engine, every stochastic pass (bristle lanes, shape detail,
fluid noise, granulation).

---

## 9. Anti-Patterns to Avoid

### Anti-Pattern 1: Engine params in the host API
**What:** `waterAmount`, `physicsMode`, krita preset names on host types.
**Why bad:** engine 3 then needs a host rewrite — exactly what the split is
paying to avoid.
**Instead:** opaque `engine: P` slot + `toolOverrides` bag (§2.3).

### Anti-Pattern 2: Forking the Studio per module
**What:** a watercolour timeline / script library / bake path.
**Why bad:** breaks the shared script law; doubles every bug surface.
**Instead:** one Studio; modules register an adapter + options panel only.

### Anti-Pattern 3: Duplicate mixing code in efx-watercolor
**What:** copying spectral mixing into the watercolor engine to dodge the 56/57
ordering.
**Why bad:** engine-1 adoption then re-does the work; two spectral
implementations drift.
**Instead:** create `packages/efx-spectral` early inside 56 if needed.

### Anti-Pattern 4: Live GPU fluid sim on the timeline
**What:** scrubbing a wet sheet instead of reading the WebP cache.
**Why bad:** breaks the cache contract, non-deterministic playback, export
drift. **Instead:** bake is the only playback path (P3).

### Anti-Pattern 5: Forced Dry at frame boundaries
**What:** drying the sheet each frame to "simplify" the bake.
**Why bad:** kills wet-in-wet blooms and tide lines — the look the engine is
for. **Instead:** per-stroke `cuisson`/`diffusionFrames` budget, physics evolves
across frames (P4).

### Anti-Pattern 6: Web Worker / new cancellation model for the bake
**Why bad:** WebGL2 + canvas encode are main-thread anyway; a second
cancellation model replaces a proven one. **Instead:** port the
`finalizationQueue` + dispose-abort pattern (R4).

### Anti-Pattern 7: "Fixing" the brush-pack snapshot into a disk reference
**Why bad:** old scripts would stop replaying after the pack evolves (the
52.2 refs-only law has this one deliberate exception). **Instead:** snapshot
travels in `.mce` (R3.4).

### Anti-Pattern 8: Compat shims for v1.0.1 scripts/projects
**Why bad:** clean break is decided; migration code is dead weight and slows
the engines. **Instead:** fail-closed named visible errors for unreadable
script/asset (53.1 law) — data honesty, not compatibility.

---

## 10. Integration Points

### Internal boundaries

| Boundary | Communication | Notes |
|---|---|---|
| `app/` ↔ `efx-paint-host` | typed imports | one-time import churn at the split (R1.3); `physicsPaintRotoPlayScriptController.ts`, `finalizationQueue.ts` callers re-point |
| `efx-physic-paint` ↔ `efx-paint-host` | typed imports | engine 1 consumes host; format-identical split guarded by R5.2 replay parity |
| `efx-watercolor` ↔ `efx-paint-host` | `EngineAdapter<P>` | payload codec is engine-owned; host drives ticks/bake |
| `efx-watercolor` ↔ `efx-spectral` | typed imports | `Pigment`, `pigmentFromHex`, `mixToHex`, `displayBasisGLSL` |
| `efx-physic-paint` ↔ `efx-spectral` | **deferred to v2.1.0** | replaces `mixSubtractive` RYB heuristic; not in v2.0.0 |
| Studio ↔ engines | via host + adapter only | Studio never calls engine internals |
| All packages ↔ cache/package FS | Rust only | `project_package_fs_scope` law; static scans pin it |
| `.mce` | manifest + `layers/*.json` + `frames/*.webp` + brush-pack snapshot | brush-pack snapshot = deliberate exception to refs-only law |

### New components (v2.0.0)

| Component | Package/Location | Purpose |
|---|---|---|
| `efx-paint-host` | `packages/efx-paint-host` | Studio law (moved + generic) |
| `efx-spectral` | `packages/efx-spectral` | shared MIT spectral colour |
| `efx-watercolor` | `packages/efx-watercolor` | engine 2 (clean-room WebGL2) |
| Module registry + switcher | `app/` top bar | Brush / Water color / (Krita slot) |
| Per-module options panels | `app/` panels | drain module's own options/features |
| Paper pack (10 papers) | Studio paper library | all paints, composite-only |
| 4th paint layer kind | app document/compositor | paint-aquarelle tracks |

### Modified components

| Component | Change |
|---|---|
| `packages/efx-physic-paint` | loses `animation/`, `traceSeed`; gains host import; engine-1 behaviour unchanged (R5.2) |
| `app/.../physicsPaintRotoScriptSchema.ts` | becomes engine-1 payload codec on host envelope |
| `app/.../physicsPaintRotoPlayScriptController.ts` | re-points to host; bake semantics ported per R4 |
| `app/.../finalizationQueue.ts` | pattern ported into host bake (or re-exported) |
| `app/src/efx-paint/compositor/` | consumes 4th kind frames; `getFlattenedFrame` path unchanged |
| `PhysicsPaintTopBar.tsx` | module switcher icons |
| `.mce` format | brush-pack snapshot slot (clean break, `formatVersion` bump) |

---

## 11. Build Order (hard gates respected)

**Hard gates:** no watercolour before Preact 11 · phase 54 live UAT closes
before 55 opens · 55 is the hard prerequisite of 56 and 57 · v2.1.0 (Krita +
engine-1 spectral adoption) planned only after v2.0.0 closes.

| Order | Phase | Delivers | Gate / exit criterion | Why this position |
|---|---|---|---|---|
| 1 | **54 — Preact 11** | dependency bump + mechanical migration | **hard gate:** `@preact/signals` probe green first (STOP if red); R4.2 live UAT (paint stroke, undo/redo, track switch, Studio open/close, standalone `./preact` mount) closes before 55 opens | engine 2's stack is Preact 11; nothing later builds on a dead major |
| 2 | **55 — efx-paint-host** | tranche 0b split (§2.2 seam map) + generic payload (§2.3) | R5.2 script replay parity vs pre-split golden · R5.3 A1–A5 live UAT · **A5 fake engine-2 payload** proves genericity | pay the split ONCE before engines 2 and 3 exist; every later engine rides it |
| 3a | **56 — efx-watercolor** (may open **efx-spectral early**) | engine 2 core + script record/play + bake + paper pack | A1–A5 (56): pixel-stable bake, blooms visible in baked frames, independent cache ranges, transparent export | consumes host (2) and spectral (3b); clean-room; paper pack is the all-paints deliverable |
| 3b | **57 — efx-spectral** | shared package hardening (if not created inside 56: create it; else finish NOTICE/tests/API freeze) | MIT attribution audited; engine-2 consumption proven; API frozen for engine-1 adoption | **never blocks 56 on ceremony** — content may be pulled forward into 56; 57 closes the shared contract |
| 4 | **Module switcher** | top-bar switcher + per-module panels over one Studio | switch Brush↔Water color with shared script library/timeline; fail-closed cross-engine Apply; Krita slot inert | needs ≥2 modules to be meaningful; ships inside v2.0.0 once 56 lands (shell UI can be built alongside 56, UAT after) |
| 5 | (inside 56) **Paper pack** | 10 procedural papers → Studio library | usable by all paints through `paperPass`; no rebake on change | rides 56 per locked scope |

**Do not reorder 55 after 56** — the host split is the hard prerequisite
("pay it once"). **Do not fold spectral into the watercolor engine** to dodge
the 56/57 ordering. **Do not implement Krita** (v2.1.0 slot).

Milestone note: the specs still say "v1.1.0" for phases 54–57; PROJECT.md has
relocked the milestone as **v2.0.0** (MAJOR — module switcher = new product
shape + accepted clean break). Phase content is unchanged.

---

## 12. Scaling Considerations

| Concern | v2.0.0 (2 engines) | v2.1.0 (3 engines) | Pressure point |
|---|---|---|---|
| Script envelope | one generic shape + 2 codecs | + krita codec | codec registry grows linearly — fine |
| Bake host | one Effect queue per bake session | shared queue discipline | long fluid cuissons × concurrent bakes → bounded concurrency already (2) |
| Brush packs in `.mce` | 2 pack namespaces | 3 | snapshot size — pack snapshot exception is deliberate; watch package weight |
| WebGL contexts | 1 engine canvas at a time (mount/unmount) | same | context loss handlers per engine; do not share contexts across engines |
| 512 MB frame LRU | shared across kinds | shared | heavier watercolour sheets stress the budget — measure, don't pre-squeeze |

---

## Sources

- `SPECS/v1.1.0-paint-host/context.md` — tranche 0b scope, host API law, R5.2/A5 parity, ambiguity Q1–Q4
- `SPECS/v1.1.0-water-color/00-grill-context.md` — locked architecture (3 engines/4 paints), bake model, licence table, packages target, tick grid, brush-pack exception
- `SPECS/v1.1.0-water-color/01-gsd-context.md` — R1–R4 requirements, payload vocab (`brush|water|pen|lift`), tranche split 0/0b/0c/1–5
- `SPECS/v1.1.0-preact11/context.md` — phase 54 gate and R4.2 live UAT rows
- `.planning/PROJECT.md` — v2.0.0 milestone lock (clean break, invariants, semver law)
- `packages/efx-physic-paint/src/{animation,util/traceSeed.ts,types.ts,engine/EfxPaintEngine.ts,index.ts}` — live seam evidence (exports map, `PaintStroke`, `RecordedStrokeGroup`, `enqueueRecordedStroke`)
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts` + `physicsPaintRotoScriptClipboard.ts` — current envelope/clipboard shape
- `app/src/components/physic-paint/pilot/finalizationQueue.ts` — bake-host pattern (Effect, flush-survives-nav)
- `app/src/efx-paint/compositor/` + `app/src/lib/paperPass.ts` — compositor keystone + paper contract
- `SPECS/v1.1.0-water-color/watercolor-playground/src/engine/{Engine.ts,spectral.ts,spectralData.ts}` — local oracle (method reference; **unlicensed, no code copy**)
- [rvanwijnen/spectral.js](https://github.com/rvanwijnen/spectral.js) — MIT spectral colour method (attribution required)
- [msurguy/watercolor-playground](https://github.com/msurguy/watercolor-playground) — provenance URL of the local oracle (no licence)
- [johnowhitaker/inkwash](https://github.com/johnowhitaker/inkwash) — fluid sim origin (no licence; method only)

---
*Architecture research for: v2.0.0 multi-module paint workstation integration*
*Researched: 2026-10-14*
