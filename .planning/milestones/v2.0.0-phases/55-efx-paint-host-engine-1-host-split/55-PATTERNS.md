# Phase 55: efx-paint-host (engine-1 host split) - Pattern Map

**Mapped:** 2026-10-14
**Files analyzed:** 17 (new + modified + moved)
**Analogs found:** 15 / 17

Scope note: this phase is a **move + contract extraction**, not a rewrite. Most
"new" files are the move surface itself — their analog is the pre-split file,
and the pattern to copy is **identity of behavior** (D-04 golden proves the move
changed nothing). The genuinely new surfaces are the generic payload/envelope
contracts, the tick grid, the bake host (pattern port), and the standing pins.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/efx-paint-host/` package scaffold (`package.json`, `tsup.config.ts`, `tsconfig*.json`) | config | n/a | `packages/efx-physic-paint/package.json` + `packages/efx-physic-paint/tsup.config.ts` | exact (sibling workspace package) |
| `packages/efx-paint-host/index.ts` (export surface) | config | n/a | `packages/efx-physic-paint/src/index.ts` | exact |
| `packages/efx-paint-host/animation/` whole folder (`AnimationPlayer.ts`, `progressiveStrokeSchedule.ts`, `staticStrokeSchedule.ts`, `recordedStrokeMotion.ts`, `types.ts`, `index.ts` + 4 tests) | utility | transform / request-response | `packages/efx-physic-paint/src/animation/` (itself — whole-folder move, D-18) | exact (move as-is; only boundary types genericized) |
| `packages/efx-paint-host/util/traceSeed.ts` | utility | transform | `packages/efx-physic-paint/src/util/traceSeed.ts` (itself) | exact (move as-is, signature kept, D-25) |
| `packages/efx-paint-host/script/payload.ts` (`StudioPoint`, `StudioStrokeMotion`, `StudioStroke<P>`, `StudioScriptEnvelope<P>`, `EngineId`, `EngineAdapter<P>`) | model | CRUD (serialize/parse) | `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts` (`PersistedRotoScriptV1` family) | role-match (envelope + codec shape; new is generic over `P`) |
| `packages/efx-paint-host/script/` fail-closed parse / refusal codes | utility | request-response | `physicsPaintRotoScriptSchema.ts` `isPersistedRotoScriptV1` (lines 197–211) + `physicsPaintRotoScriptApplyRefusal.ts` | role-match |
| `packages/efx-paint-host/time/` (integer tick grid, `diffusionFrames` mechanism) | utility | transform | `packages/efx-physic-paint/src/animation/types.ts` `AnimationConfig.fps` (line 28) + `packages/efx-physic-paint/src/types.ts` `PaintStroke.diffusionFrames` (line 180) | partial (mechanism extracted from two implicit sites) |
| `packages/efx-paint-host/bake/` (bake host) | service | event-driven / batch | `app/src/components/physic-paint/pilot/finalizationQueue.ts` | role-match (port the PATTERN per D-21, not copy-paste) |
| `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts` (modified → engine-1 payload codec on host envelope) | model | CRUD | itself (modification) | exact |
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` (re-pointed imports only, R1.3) | controller | event-driven | itself (re-point only) | exact |
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts` (re-point `@efxlab/efx-physic-paint/animation` → host) | service | batch / file-I/O (WebP bake) | itself (re-point) | exact |
| `app/src/components/physic-paint/roto/physicsPaintRotoScriptApplyRefusal.ts` (extend with 4 named cross-engine cases, D-11) | utility | request-response | itself (extension of the owned-refusal mapper) | exact |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (wire new refusal cases through existing surface, D-09/D-10) | component | request-response | itself (`buildRotoScriptApplyRefusalMessage` + `clearOwnedScriptApplyRefusal` call sites) | exact |
| Standing pins (golden re-bake, fake engine-2 round-trip, import-graph, no-partial) | test | n/a | `app/src/paintVersionDisciplineContract.test.ts`, `app/src/lib/mceFieldContract.test.ts`, `app/src/efx-paint/efxPaintCleanBreakContract.test.ts` | exact (same standing-pin family, D-03) |
| Script library refused rows (D-16 clean-break visibility) | component / model | CRUD | `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts` (`RotoScriptLibraryRow`, `rows` signal) | role-match |
| Test-only stub `EngineAdapter<P>` + fake engine-2 payload fixture (D-06/D-08) | test | n/a | ARCHITECTURE.md §2.3 shape only | no-analog (new contract fixture) |
| Golden pre-split fixture (recorded engine-1 script + baked frames) | test | batch | none in tree (CONTEXT measured fact: no golden harness exists) | no-analog (built first, on pre-split code, D-04) |

## Pattern Assignments

### `packages/efx-paint-host/` package scaffold (config)

**Analog:** `packages/efx-physic-paint/package.json` + `packages/efx-physic-paint/tsup.config.ts`

This is the workspace-package shape the host must mirror. `pnpm-workspace.yaml`
already globs `packages/*`, so the host joins with zero workspace edits.

**package.json exports map** (`packages/efx-physic-paint/package.json` lines 29–42):
```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.mjs"
  },
  "./preact": {
    "types": "./dist/preact.d.ts",
    "import": "./dist/preact.mjs"
  },
  "./animation": {
    "types": "./dist/animation.d.ts",
    "import": "./dist/animation.mjs"
  }
}
```
Host mirrors `.` + `./animation`. Per D-17 the host is **Preact-free** — add
`./preact` only if something Preact-flavoured is actually needed (it should not
be). `peerDependencies`/`peerDependenciesMeta` for preact are engine-side
concerns and do NOT copy over.

**tsup entry map** (`packages/efx-physic-paint/tsup.config.ts` lines 3–16):
```typescript
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    preact: 'src/preact.tsx',
    animation: 'src/animation/index.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['preact', 'preact/hooks'],
  tsconfig: 'tsconfig.build.json',
  outExtension: () => ({ js: '.mjs' }),
})
```
Host entry map: `index` + `animation` (and `./script` / `./time` if split as
sub-entries — Claude's discretion per CONTEXT). Drop the preact externals.

**Workspace singleton note (CONTEXT "Workspace singletons via root
`pnpm.overrides`"):** root `package.json` `pnpm.overrides` currently pins
`preact` / `@preact/signals` / `@efxlab/motion-canvas-core`. The host needs no
new override (it is Preact-free); if the plan re-points a singleton, follow the
same `pnpm.overrides` shape — do not introduce a second mechanism.

---

### `packages/efx-paint-host/animation/` (utility, transform) — WHOLE-FOLDER MOVE

**Analog:** `packages/efx-physic-paint/src/animation/` (itself)

**Do not rewrite.** D-18 moves the folder whole; the pre-split golden (D-04)
proves the move changed nothing. The only edits at the boundary:

1. Import re-points inside the folder (`../types` → the host's own types /
   the generic `StudioStroke<P>` seam).
2. `AnimationStrokeStyleOverride` **must lose `physicsMode`** (D-18) — that
   field becomes engine payload.

**Current boundary leak — `types.ts` lines 8, 18–23** (`packages/efx-physic-paint/src/animation/types.ts`):
```typescript
import type { BrushOpts, PaintStroke, ToolType } from '../types'
// ...
export interface AnimationStrokeStyleOverride {
  tool: ToolType
  color: string | null
  params: Partial<BrushOpts>
  physicsMode?: 'local' | null    // ← LOSES this at the host boundary (D-18)
}
```
After the split this override style carries only the generic shared fields
(tool/color are engine-1 vocabulary — see the genericity note below); engine-1's
`physicsMode` rides the `engine: P` payload slot.

**Second boundary leak — `AnimationPlayer.ts` lines 7–11**:
```typescript
import type { EfxPaintEngine } from '../engine/EfxPaintEngine'
import type { AnimationConfig, AnimationState, FrameStroke } from './types'
import type { PaintStroke } from '../types'
import { transformRecordedStrokeForHeldPose } from './recordedStrokeMotion'
import { buildProgressiveStrokeSchedule, getProgressiveFrameStrokes } from './progressiveStrokeSchedule'
```
`EfxPaintEngine` is an engine-1 type. At the host seam the player must drive
the generic `EngineAdapter<P>` (ARCHITECTURE.md §2.3: `applyStroke` /
`stepTick` / `captureFrame` / `dispose`) instead of the concrete engine class.
This is the one place the "move whole" folder still needs the contract
extraction work — the schedule builders themselves (`progressiveStrokeSchedule.ts`,
`staticStrokeSchedule.ts`) only need `PaintStroke` → `StudioStroke<P>` at their
type surface.

**Core pattern to keep intact — `AnimationPlayer.ts` lines 26–43 (play/stop) and 57–79 (tick):**
```typescript
play(config: AnimationConfig): void {
  this.config = config
  this.playing = true
  this.currentFrame = 0
  this.engine.setInputLocked(true)
  this.engine.setAnimationMode(true)
  this.frameStrokes = buildProgressiveStrokeSchedule(this.engine.getStrokes(), config.frameCount)
  this.lastFrameTime = 0
  this.rafId = requestAnimationFrame(this.tick)
}
```
The frame-clock shape (`1000 / fps`, catch-up modulo at line 63, `onFrame` /
`onComplete` at 65/73) is behavior the golden covers — change the engine type,
not the clock.

**Animation folder inventory** (move all of it):
`AnimationPlayer.ts` (110), `AnimationPlayer.test.ts` (527),
`progressiveStrokeSchedule.ts` (170) + test (58), `staticStrokeSchedule.ts` (48)
+ test (89), `recordedStrokeMotion.ts` (92) + test (108), `types.ts` (49),
`index.ts` (8). The tests move with the folder and become the host's first
coverage (CONTEXT "Reusable Assets").

---

### `packages/efx-paint-host/util/traceSeed.ts` (utility, transform) — MOVE AS-IS

**Analog:** `packages/efx-physic-paint/src/util/traceSeed.ts` (itself)

D-25: keep the `seededRng(strokeSeed, streamKey)` signature so engine-1 deposit
paths re-point without logic changes. This module IS the determinism law the
golden re-bake depends on — zero non-deterministic sources.

**Public surface to keep byte-stable** (`traceSeed.ts` lines 15–87):
```typescript
export function fnv1a(source: string): number          // offset 2166136261, prime 16777619
export function hashMutationId(mutationId: number | undefined): number
export function seededRng(strokeSeed: number, streamKey: string): () => number  // mulberry32
export function arcSlot(arcLength: number): string
export function seededDraw(strokeSeed: number, slot: string, drawKey: string): number
export function seededRange(...): number
export function traceShapeNoise(...): number
```

**Hidden dependency the move must resolve** (line 12):
```typescript
import { fbm } from './noise'
```
`util/noise.ts` (deterministic value-noise FBM, "no Math.random() in noise
path") is imported by `traceShapeNoise`. Either move `noise.ts` alongside into
`efx-paint-host/util/` (it is pure host-safe determinism), or leave it and have
the host depend on nothing engine-specific — per the seam map
"efx-paint-host → (nothing engine-specific)", moving `noise.ts` with
`traceSeed.ts` is the clean answer. Layout is Claude's discretion (CONTEXT).

---

### `packages/efx-paint-host/script/payload.ts` (model, CRUD) — NEW GENERIC CONTRACT

**Analog:** `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts`

The app schema's envelope shape is what becomes host law; the per-engine stroke
fields become opaque `P`. Authoritative shape is ARCHITECTURE.md §2.3 — copy
the interface bodies from there (they are already written as
`efx-paint-host/script/payload.ts`).

**Today's envelope — `physicsPaintRotoScriptSchema.ts` lines 57–67:**
```typescript
export interface PersistedRotoScriptV1 {
  kind: typeof ROTO_SCRIPT_KIND;
  schemaVersion: typeof ROTO_SCRIPT_SCHEMA_VERSION;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  source: PersistedRotoScriptSourceV1;
  thumbnail: PersistedRotoScriptThumbnailV1;
  brushes: PersistedRotoScriptBrushV1[];   // ← becomes strokes: readonly StudioStroke<P>[]
}
```
Shared Studio law that lifts to the host (ARCHITECTURE.md §2.2 row 3):
`kind`/`schemaVersion`/`id`/`name`/timestamps/`thumbnail`/library-row shape.
The `kind` constant becomes `'efx-studio-paint-script'` and gains
`engineId: EngineId` (D-15: `'efx-physic-paint' | 'efx-watercolor' | 'efx-krita'`
— package identities, not display names).

**Today's per-stroke fields that become opaque `P` — lines 40–50:**
```typescript
export interface PersistedRotoScriptStrokeV1 {
  tool: PaintStroke['tool'];
  points: PaintStroke['points'];
  color: string | null;
  params: PaintStroke['params'];          // ← engine-1 BrushOpts → P
  timestamp: number;
  hasPenInput?: boolean;
  diffusionFrames?: number;               // ← MECHANISM to host time/; cap policy stays engine
  playFrame?: number;
  physicsMode?: PaintStroke['physicsMode']; // ← engine-1 P (D-18)
}
```
Host-side shared stroke fields (ARCHITECTURE.md §2.3 `StudioStroke<P>`):
`pts` (with integer `tick` per sample), `ticks`, `cuisson`, `motion`,
`brushId`, `toolOverrides`, `traceSeed`, `engine: P` (OPAQUE — host never
inspects, R2.2).

**Fail-closed parse pattern — `isPersistedRotoScriptV1` lines 197–211:**
```typescript
export function isPersistedRotoScriptV1(value: unknown): value is PersistedRotoScriptV1 {
  if (!isRecord(value) || value.kind !== ROTO_SCRIPT_KIND || value.schemaVersion !== ROTO_SCRIPT_SCHEMA_VERSION) return false;
  if (!isCanonicalRotoScriptId(value.id) || !normalizeRotoScriptName(value.name)) return false;
  if (!isIsoDate(value.createdAt) || !isIsoDate(value.updatedAt) || Date.parse(value.updatedAt) < Date.parse(value.createdAt)) return false;
  if (!isSource(value.source) || !isThumbnail(value.thumbnail)) return false;
  if (!Array.isArray(value.brushes) || value.brushes.length < 1 || value.brushes.length > ROTO_SCRIPT_LIMITS.brushes) return false;
  // ...per-brush/per-stroke validation, totalPoints budget...
  return true;
}
```
This is the model for the host's fail-closed `payloadCodec.parse(raw): StudioStroke<P> | null`
— total, pure, returns null on any named failure (D-11 cases 2/3/4). No throw
mid-parse that leaves a half-built document (D-12 refuse-before-write).

**Stroke serialization clamp pattern — `serializeRotoScriptStroke` lines 107–148:**
```typescript
points: stroke.points.map((point) => ({
  x: schemaRange(point.x, -1_000_000, 1_000_000, 0),
  y: schemaRange(point.y, -1_000_000, 1_000_000, 0),
  p: schemaRange(point.p, 0, 1, 0),
  // ...
})),
// positive-only optional member — zero must not leak into persisted shape:
...(typeof stroke.diffusionFrames === 'number' && stroke.diffusionFrames > 0
  ? { diffusionFrames: Math.min(600, Math.max(1, Math.round(stroke.diffusionFrames))) }
  : {}),
```
The `schemaRange` projection (line 102) and the positive-only optional-member
discipline are patterns to keep when engine-1's codec sits on top of the host
envelope. Note the `Math.min(600, …)` clamp here is **engine-1's cap policy**
(D-20) — the host `cuisson`/`diffusionFrames` mechanism must not bake 600 in.

---

### `packages/efx-paint-host/time/` (utility, transform) — NEW (tick grid)

**Analogs:** `packages/efx-physic-paint/src/animation/types.ts` line 28
(`fps: number` in `AnimationConfig`) + `packages/efx-physic-paint/src/types.ts`
line 180 (`diffusionFrames?: number  // v2 format`).

No single analog — the mechanism is implicit across these two sites today
(ARCHITECTURE.md §2.2 row 4). The host extracts it into an explicit integer
tick grid (~1/60 s, exact tick value is a plan-time item — D-23). Integer
ticks only, never raw ms (DATA-03). Each `StudioPoint.tick` is "the integer
tick of this sample" (ARCHITECTURE.md §2.3). Host owns the mechanism; each
engine owns its cap policy (D-20) — do not put a 600 (or any) cap in the host.

---

### `packages/efx-paint-host/bake/` (service, event-driven/batch) — PATTERN PORT

**Analog:** `app/src/components/physic-paint/pilot/finalizationQueue.ts`

D-21 is explicit: **port the pattern, not a copy-paste**. No Web Worker, no new
cancellation model. The three properties to carry (header comment lines 14–20):
BOUNDED TURNS, BACKPRESSURE, INTERRUPTION.

**Bounded-slot core — lines 101–105:**
```typescript
// The slot pool IS the concurrency bound: a turn holds one token for the
// whole produce/commit window...
const slots = Effect.runSync(Queue.bounded<number>(concurrency));
for (let token = 0; token < concurrency; token += 1) Effect.runSync(Queue.offer(slots, token));
```
`FINALIZATION_TURN_CONCURRENCY = 2` (line 34) is the current bound — carry the
shape (`Queue.bounded` slot pool), and let the host pick its own constant.

**Generation-stale commit guard — lines 165–176 + 203/220:**
```typescript
const interrupt = (): void => {
  generation += 1;                 // structural guarantee: live turns can no longer pass pre-commit
  const turns = [...liveTurns];
  for (const turn of turns) turn.cancel();
  // ...
};
// inside the turn program:
if (turnGeneration !== generation) return;   // before produce AND before commit
```
This is the "generation-stale commits" semantics D-21 names — a cancelled turn
never commits, even if its produce settles later.

**Forced-flush escape — `beginFlush` lines 145–157:**
```typescript
const beginFlush = (): (() => void) => {
  flushDepth += 1;
  lifecycle.beginFlushing();
  const signal = flushSignal;
  flushSignal = deferred<void>();
  signal.resolve();
  // ...returns a release closure (once-only)
};
```
Navigation/close/save/export need this. Bake-type semantics to port per D-21:
PlayScript bake **aborts on dispose**; long fluid cuissons use
**flush-survives-navigation**.

**Never-rejecting produce/commit — lines 204–237:**
```typescript
const produced = yield* Effect.promise(async (): Promise<Produced<T>> => {
  try { return { ok: true, value: await turn.produce() }; }
  catch { return { ok: false }; }
});
// a produce failure is DATA, not a typed Effect error — the turn settles
// `failed` and the queue keeps accepting (v4's tryPromise catch would kill the fiber)
```
Carry this idiom: the host bake host must not die its fiber on a bad bake.

**What NOT to port blindly:** `finalizationQueue` imports
`readLastInteractionAt` (gesture idle scheduler) and
`finalizationLifecycle` / `isFinalizationDrainable` (xstate machine) — both are
app-side lifecycle. The host is UI-free and Preact-free (D-17); the bake host
needs its own minimal lifecycle gate (or a pluggable one), not the Studio's
gesture scheduler. The Effect v4 bounded-queue mechanics are the portable part.

---

### `packages/efx-paint-host/index.ts` (config, export surface)

**Analog:** `packages/efx-physic-paint/src/index.ts` (lines 1–23)

Mirror the export-surface discipline: explicit named re-exports, type exports
grouped, one-line provenance comments where a decision pinned the export. The
host's public entry must carry **zero engine-1 types** (D-07 import-graph pin
enforces this) — that is the delta versus the engine-1 index, which exports
`EfxPaintEngine`, `BrushOpts`, `PaintStroke`, `PhysicsMode`, etc.

Also mirror the `./animation` sub-path style from
`packages/efx-physic-paint/src/animation/index.ts` (lines 1–8):
```typescript
// @efxlab/efx-physic-paint/animation -- Animation sub-path export
export { AnimationPlayer } from './AnimationPlayer'
export { buildProgressiveStrokeSchedule, getProgressiveFrameStrokes } from './progressiveStrokeSchedule'
// ...
export type { AnimationConfig, AnimationState, AnimationStrokeStyleOverride, AnimationWiggleConfig, FrameStroke } from './types'
```
becomes `@efxlab/efx-paint-host/animation` (minus `physicsMode` on the override,
D-18).

---

### `app/.../physicsPaintRotoScriptSchema.ts` (model, CRUD) — MODIFY → engine-1 codec

**Analog:** itself (modification on top of the host envelope)

After the split this file keeps engine-1's `P` codec (`serialize` / `parse` of
`PhysicStrokePayload`) on top of `StudioScriptEnvelope<PhysicStrokePayload>`
from the host. The current file's validate/clamp/total-guard patterns (excerpts
above) are the ones to keep — the shape changes, the discipline does not.
Existing test `physicsPaintRotoScriptSchema.test.ts` is the baseline.

---

### `app/.../physicsPaintRotoPlayScriptController.ts` (controller, event-driven) — RE-POINT ONLY

**Analog:** itself (R1.3: re-point only, no behaviour change at the seam)

The controller does not import `@efxlab/efx-physic-paint` directly today (its
imports are app-local + `@preact/signals`); the bake path runs through
`physicsPaintRotoPlayScriptRenderer.ts`, which does. Re-point sites for the
split (measured 2026-10-14):

- `physicsPaintRotoPlayScriptRenderer.ts:2` — `buildProgressiveStrokeSchedule`,
  `buildStaticStrokeSchedule`, `getProgressiveFrameStrokes`,
  `getStaticFrameStrokes`, `transformRecordedStrokeForHeldPose` from
  `@efxlab/efx-physic-paint/animation` → `@efxlab/efx-paint-host/animation`
- `physicsPaintRotoScriptClipboard.ts:3` — `transformRecordedStrokeForHeldPose`
  from `@efxlab/efx-physic-paint/animation` → host
- Test mocks of the animation sub-path (`vi.mock('@efxlab/efx-physic-paint/animation', …)`)
  in `physicsPaintRotoRevealBake.test.ts:56`,
  `physicsPaintRotoRegistryOwnership.test.ts:41`,
  `physicsPaintRotoPlayScriptRenderer.test.ts:31`, and the direct import in
  `physicsPaintRotoHoldDeterminism.test.ts:7` — re-point the mock target too.

`playFrame` / held-pose / progressive-vs-static behavior is covered by the
golden (D-02 wants progressive + static + held-pose/motion wiggle + cuisson tail
+ at least one erase in the one fixture) — do not "clean up" the controller
while re-pointing (feedback_pencil_preserve_work / R1.3).

---

### `app/.../physicsPaintRotoScriptApplyRefusal.ts` (utility, request-response) — EXTEND

**Analog:** itself (extension of the existing owned-refusal mapper)

D-09/D-10/D-11: **no second error channel**. Extend this mapper with the four
named cross-engine cases, and surface them on the existing apply-status /
lastError line.

**Current mapper shape — lines 46–61:**
```typescript
export function buildRotoScriptApplyRefusalMessage(
  error: RotoScriptOperationError | null | undefined,
): string | null {
  if (!error) return null;
  switch (error.code) {
    case 'apply-empty-target-failed':
      return ROTO_SCRIPT_APPLY_REFUSAL_EMPTY_TARGET;
    case 'apply-partial-failure':
    case 'apply-cancelled':
      return usableMessage(error.message);
    case 'apply-invalidated':
      return ROTO_SCRIPT_APPLY_REFUSAL_INVALIDATED;
    default:
      return null;
  }
}
```
Add the four named cases (D-11) through the same switch: (1) unknown
`engineId`, (2) malformed/unparseable engine payload, (3) engine mismatch onto a
different engine's layer (named, e.g. "this script is for Water color, not
Brush" — display name mapped in the Studio from D-15's package ids), (4)
unreadable/legacy script ("this script is from an older version", D-16). The
host stays UI-free: it yields a typed refusal with no wording; the Studio
boundary names it (D-09).

---

### `app/.../PhysicsPaintStudio.tsx` (component, request-response) — WIRE EXISTING SURFACE

**Analog:** itself (the owned-refusal refs)

**Owned-refusal pattern — lines 1288–1294:**
```typescript
const scriptApplyRefusalOwnedRef = useRef(false);
const clearOwnedScriptApplyRefusal = useCallback(() => {
  if (!scriptApplyRefusalOwnedRef.current) return;
  scriptApplyRefusalOwnedRef.current = false;
  setApplyMessage('');
  setApplyStatus('idle');
}, [setApplyMessage, setApplyStatus]);
```

**Call-site pattern — lines 1316–1331:**
```typescript
setLastError(null);
clearOwnedScriptApplyRefusal();
// `setLastError` value alone is discarded by its empty destructure. The
// message must also reach setApplyMessage / setApplyStatus.
const message = buildRotoScriptApplyRefusalMessage(error) ?? error?.message ?? null;
if (message) {
  setLastError(message);
  setApplyMessage(message);
  setApplyStatus('error');
  scriptApplyRefusalOwnedRef.current = true;
}
```
New refusal cases flow through this exact path — no modal, no red-triangle
(D-10: the Phase 46 timeline-paste rejection vocabulary stays distinct). The
contract assertions in `PhysicsPaintStudio.test.ts` (~lines 2237–2291: "must
consult the refusal mapper", `clearOwnedScriptApplyRefusal()` on both apply
paths, single import of the mapper) are the baseline the extension must keep
green or consciously extend.

---

### Standing pins (test, n/a) — NEW GUARDS JOIN THIS FAMILY

**Analogs (same family, D-03):**
- `app/src/paintVersionDisciplineContract.test.ts` — source-scan pin
  (regex over `useEffect` blocks, no DOM mount)
- `app/src/lib/mceFieldContract.test.ts` — dual-surface declaration diff pin
- `app/src/efx-paint/efxPaintCleanBreakContract.test.ts` — repo-walk +
  forbidden-token + exact-path allowlist pin

**Source-scan skeleton — `paintVersionDisciplineContract.test.ts` lines 1–21:**
```typescript
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Pure source/text contract assertions ... Source scan only — no DOM mount
// (releaseContract style).
const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAINT_OVERLAY = join(APP_DIR, 'src', 'components', 'canvas', 'PaintOverlay.tsx');
const paintOverlay = readFileSync(PAINT_OVERLAY, 'utf8');
```

**Repo-walk + allowlist skeleton — `efxPaintCleanBreakContract.test.ts` lines 32–63:**
```typescript
const APP_ROOT = resolve(__dirname, '../..');
const REPO_ROOT = resolve(APP_ROOT, '..');
const SCAN_ROOTS = [
  resolve(APP_ROOT, 'src'),
  resolve(APP_ROOT, 'src-tauri/src'),
  resolve(REPO_ROOT, 'packages/efx-physic-paint/src'),
];
const FORBIDDEN_TOKENS = [ /* ... */ ];
const ALLOWLIST = new Set([
  'app/src/efx-paint/document/efxPaintCleanBreak.ts',
  // exact relative paths only
]);
```
This is the exact shape for **D-07's import-graph pin** (walk
`efx-paint-host`'s public entry points; fail if any import resolves into
`efx-physic-paint` or any engine package) and for the source-level dynamic-import
leak scan. Note the clean-break contract already scans
`packages/efx-physic-paint/src` — extend `SCAN_ROOTS` with
`packages/efx-paint-host/src` when the host exists.

**Where the new pins live (D-03, D-05, D-07, D-12):** normal `.test.ts` on the
existing vitest setup (`pnpm --filter efx-motion-editor exec vitest run` —
remember the memory note: vitest collects only `.test.ts`, not `.test.tsx`).
No one-off config (feedback_no_test_config_hacks). Same family as
`paintVersion` / `mceFieldContract` / `preactSingleCopy`.

---

### Script library refused rows (component/model, CRUD) — D-16

**Analog:** `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts`

**Row shape + signal surface — `RotoScriptLibraryRow` (schema lines 69–80) and
the library (lines 53, 108–110):**
```typescript
export interface RotoScriptLibraryRow {
  id: string;
  revision: string;
  integritySha256: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  source: PersistedRotoScriptSourceV1;
  thumbnail: PersistedRotoScriptThumbnailV1;
  brushCount: number;
}
// library:
readonly row: RotoScriptLibraryRow;
rows: Signal<readonly RotoScriptLibraryRow[]>;
selected: ReadonlySignal<RotoScriptLibraryRow | null>;
```
D-16: old scripts **stay visible as refused rows** carrying the named
clean-break message. Deletion stays the user's explicit action — the clean break
is a parse refusal, not data destruction. A refused row is a `RotoScriptLibraryRow`
plus a refusal state the existing apply-status line can name; do not invent a
second list or a second status channel.

---

## Shared Patterns

### 1. Standing contract pin (source-scan / repo-walk / allowlist)
**Source:** `app/src/paintVersionDisciplineContract.test.ts`,
`app/src/lib/mceFieldContract.test.ts`,
`app/src/efx-paint/efxPaintCleanBreakContract.test.ts`
**Apply to:** golden re-bake pin (D-03), fake engine-2 round-trip pin (D-05),
import-graph pin (D-07), no-partial pin (D-12). All are normal `.test.ts` on
the existing vitest setup — a regression is caught the moment it lands.

### 2. Owned-refusal pattern (one error channel)
**Source:** `physicsPaintRotoScriptApplyRefusal.ts` +
`PhysicsPaintStudio.tsx` (`scriptApplyRefusalOwnedRef`,
`clearOwnedScriptApplyRefusal`, `buildRotoScriptApplyRefusalMessage`)
**Apply to:** all four named cross-engine refusal cases (D-11) and the clean-break
case (D-13/D-16). Host yields a typed refusal; the Studio names it on the
existing apply-status / lastError line. No second channel, no modal, no
red-triangle reuse (D-10).

### 3. Fail-closed total parse (validate-to-completion before any write)
**Source:** `isPersistedRotoScriptV1` + `serializeRotoScriptStroke` in
`physicsPaintRotoScriptSchema.ts` (pure, total, clamped, named-failure)
**Apply to:** `payloadCodec.parse(raw): StudioStroke<P> | null` and every Apply
path (D-12: refuse-before-write + a no-partial pin asserting the document is
untouched on each refusal case).

### 4. Workspace package scaffold
**Source:** `packages/efx-physic-paint/package.json` (exports map) +
`tsup.config.ts` (entry map) + root `pnpm.overrides` shape
**Apply to:** `packages/efx-paint-host` scaffold. `pnpm-workspace.yaml` already
globs `packages/*`. Host mirrors `.` + `./animation` exports; `./preact` only if
needed (D-17: host is Preact-free).

### 5. Effect v4 bounded-queue produce/commit (port, don't copy)
**Source:** `app/src/components/physic-paint/pilot/finalizationQueue.ts`
**Apply to:** the host bake host (D-21). Portable parts: `Queue.bounded` slot
pool, generation-stale guard, `beginFlush`, never-rejecting produce/commit.
Do not port the app lifecycle (`finalizationLifecycle`, gesture idle scheduler)
into the host.

### 6. paintVersion bump + subscribe (must survive the re-point)
**Source:** `app/src/paintVersionDisciplineContract.test.ts` (and the
`efx-preact-reactivity` skill)
**Apply to:** any `app/` file touched by the import re-point (R1.3: no behaviour
change at the seam). The pin keeps the bump+subscribe shape from being
"modernized" away.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| Test-only stub `EngineAdapter<P>` + fake engine-2 payload (D-06/D-08) | test | n/a | New contract fixture. Shape is ARCHITECTURE.md §2.3 `EngineAdapter<P>` (`applyStroke` / `stepTick` / `captureFrame` / `dispose`) with real lifecycle methods that record calls and emit deterministic blank/tinted frames (D-06). Test-only — NOT published from the host, NOT importable by `app/` or engines (D-08). |
| Golden pre-split fixture (recorded engine-1 script + baked frames) | test | batch | No golden/parity harness exists in tree (CONTEXT measured fact). Built FIRST, entirely on pre-split code (D-04), by the same deterministic path the pin re-bakes. One fixture, broad seam coverage (progressive + static + held-pose/motion + cuisson tail + ≥1 erase) (D-02). Target delta zero (D-01) — do NOT use `computeTierParityMetrics` (false green). |

## Gotchas the planner should carry into PLAN.md

1. **`traceSeed.ts` → `./noise` (fbm) dependency.** The seam map moves
   `traceSeed` only, but `traceShapeNoise` imports `fbm` from `./noise.ts`
   (deterministic value-noise, "no Math.random()"). Move `noise.ts` with it
   (host-safe, pure) — otherwise the host depends on engine-1 for noise.
2. **`AnimationPlayer` engine type is the real boundary work.** The folder moves
   whole (D-18), but `AnimationPlayer.ts:7` imports `EfxPaintEngine` (engine-1).
   Replace with the generic `EngineAdapter<P>` drive. Schedules themselves only
   need `PaintStroke` → `StudioStroke<P>` at the type surface.
3. **`AnimationStrokeStyleOverride.physicsMode` is removed at the boundary**
   (D-18) — it becomes engine payload. Same for `PaintStroke.diffusionFrames`'s
   engine-side cap policy (`Math.min(600, …)` is engine-1's, D-20).
4. **Re-point the test mocks too.** `vi.mock('@efxlab/efx-physic-paint/animation')`
   appears in three roto tests plus one direct import — retargeting production
   imports but not mocks breaks the suite.
5. **vitest collects only `.test.ts`.** A `.test.tsx` verify target exits 0
   while running nothing (memory). New pins must be `.test.ts`.
6. **D-04 sequencing is the guard.** Capture the golden on pre-split code and
   check it in BEFORE any module moves — a post-move capture is split-vs-itself.
7. **Do not use `computeTierParityMetrics`** for the golden (D-01) — it compares
   the final-tier plane against itself (false green). The golden is an
   independent pixel-by-pixel oracle.
8. **`EfxPaintCleanBreakContract.test.ts` `SCAN_ROOTS`** should gain
   `packages/efx-paint-host/src` when the host exists (it already walks
   `packages/efx-physic-paint/src`).
9. **Chunk-budget watch (deferred, release gate):** new package may shift vite
   chunking — the 2000 kB viteBuild ceiling is a release gate, not this phase's
   deliverable (memory feedback_chunk_budget_desktop).

## Metadata

**Analog search scope:** `packages/efx-physic-paint/src/` (animation/, util/,
types.ts, index.ts, package scaffold), `app/src/components/physic-paint/roto/`,
`app/src/components/physic-paint/pilot/`, `app/src/components/physic-paint/PhysicsPaintStudio.tsx`,
standing contract pins under `app/src/**` (`*Contract.test.ts`,
`paintVersionDisciplineContract.test.ts`).
**Files scanned:** 17 move/modify targets + 5 pin-family analogs + package scaffold
**Pattern extraction date:** 2026-10-14
**Tracked-source gate:** every analog path above verified via `git ls-files --`
(non-empty, tracked). No gitignored mirror paths emitted.
