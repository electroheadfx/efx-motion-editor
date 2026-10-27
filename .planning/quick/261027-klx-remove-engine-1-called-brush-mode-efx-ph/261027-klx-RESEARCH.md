# Quick 261027-klx: Remove engine-1 (`@efxlab/efx-physic-paint`) — Research

**Researched:** 2026-10-27
**Domain:** Paint-engine removal — mutation ledger, paper conditioning port, SNAP container break, Roto engine surface
**Confidence:** HIGH on every code fact below (all read this session); MEDIUM on the Roto replacement path (no replacement exists in the tree — see Q4)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Mutation ledger (blocking prerequisite)
- New app-owned mutation ledger module: `allocateMutationId()`, `reserveNextMutationId(n)`, and an ordered acceptance record providing the `getAcceptedTarget` equivalent.
- Monotonic IDs seeded from restored max + 1. No rasterization, no finalization, no hidden rendering.
- Roto script port reads the ledger; it must not call engine-1 for stroke identity or acceptance.
- Must reproduce current mutation IDs and acceptance ordering. If parity cannot be demonstrated, stop and report (hard gate 4).

#### SNAP v4 clean break
- SNAP bumps 4 -> 5 with no brush body.
- A v4 snapshot is unsupported: show one clean-break notice per project binding (not the generic "unsupported SNAP version" error wording). Watercolor script frames from v4 are not seeded.
- Pin the exact message and the no-silent-resurrection behavior in a test.

#### Plan shape (user-locked)
- ONE master `PLAN.md` with seven wave tasks (Wave 0 through Wave 6). Each task carries files, action, verify, done.
- Each executor dispatch runs EXACTLY ONE wave, commits code atomically with pathspec-scoped adds, writes the per-wave summary, then STOPS.
- Orchestrator waits for an explicit user "go" before dispatching the next wave. No auto-advance.
- Plan-checker scope sanity must treat the seven-wave structure as user-authorized.

#### Do not delete (hard gate 2)
`efx-watercolor`, `efx-paint-host`, `efx-spectral`, Aquarelle layers, `ScriptStrokeOverlay`, `recordedStrokeGroups`, `BrushesDocker`, `BrushResponsePanel`, `WatercolorBrushLibrary`, `aquarelleRecordState`, p5.brush inline FX (`brushP5Adapter` / `brushFxDefaults` / `p5brush.d.ts`), and the Tauri window label + capability `"efx-physic-paint"`.

#### Clean break (hard gate 3)
- No `.mce` migration code and no SNAP v4 compatibility.
- Script `engineId` becomes `efx-watercolor` only.
- Keep the legacy script refusal rows (`unreadable-legacy-script`) and the watercolor `brushPack` validation.

### Claude's Discretion
- Exact ledger file location and API surface (within the app-owned constraint).
- How `frameScriptOwner` runtime derivation collapses to `'watercolor' | null`.
- Per-wave documentation commit structure (code commit by executor; docs commit by orchestrator).

### Deferred Ideas (OUT OF SCOPE)
None recorded in CONTEXT.md.
</user_constraints>

## Summary

Engine-1 is not a "Brush module" bolted onto the Studio — it is the Studio's **only** engine instance. `engineRef.current` is an `EfxPaintEngine`, and it is asked to do five unrelated jobs: (1) allocate/order mutation IDs, (2) rasterize paint, (3) serialize the v1.0 document (`save`/`load`), (4) provide frame/undo/background/reference operations for Roto, and (5) hold the accepted-stroke list that Roto script save/copy/apply reads. Removal is safe only if each job lands somewhere specific; four of the five have a clear home, and the fifth (Q4) does not.

Two findings change the plan's shape:

1. **`getAcceptedTarget` does not need a new ordered record.** It is already app-owned: a `WeakMap` inside `physicsPaintRotoScriptClipboard.ts` (`:319`, populated `:762-775`, read+delete `:1218-1222`). The ledger only has to return a synchronous ID. But the ledger **must** retain accepted stroke groups in acceptance order, because `RotoScriptEnginePort.getStrokes()` is read by save/copy/apply (`:378`, `:486`, `:494`, `:557`) and by the Studio's frame save (`PhysicsPaintStudio.tsx:3981`).
2. **Numeric mutation-ID parity with today is not reproducible.** Engine-1 consumes IDs from three sources that disappear or change: interactive brush strokes (`EfxPaintEngine.ts:4687`), implicit `++` inside `notifyCompletedMutation` for `clear`/`physics` (`:3690` with defaults at `:1862` and `:1655`), and per-navigation fresh IDs in `loadProjectData` (`:5100`). The achievable and testable gate is: monotonic, never-reused IDs seeded from restored max + 1, with acceptance order equal to stroke-end order. Report this explicitly against hard gate 4.

**Primary recommendation:** Split Wave 0 into three independent, testable deliverables — (a) the app-owned ledger plus its adapter for `RotoScriptEnginePort`, (b) the `conditionHeightMap` port with a golden fixture generated *before* deletion, (c) local ownership of the six engine-1 types (`ToolType`, `BgMode`, `PaintStroke`, `PenPoint`, `StackReorderResult`, `RotoEditableState`). Then gate Waves 2–4 behind an explicit decision on Q4: either expose a `WatercolorEngine` handle and write the missing Roto adapters, or keep a slim app-owned engine-state provider. Do not let Wave 4 begin on the assumption that Roto "just retypes".

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Mutation ID allocation + acceptance order | App main realm (new ledger module) | — | Must survive engine deletion; IDs outlive any engine instance and are persisted in SNAP |
| Stroke rasterization | `efx-watercolor` engine (WebGL2 sheet) | — | Only remaining paint engine |
| Brush parameter state (size/opacity/edge/pickup/spread/smoothing/erase strength) | App Studio settings + watercolor brush model | watercolor `setTool` | Engine-1 setters disappear with the package |
| Document serialization (`save`/`load` equivalents) | App Roto (state provider) | watercolor `snapshot`/`restore` | `RotoEditableState = ReturnType<EfxPaintEngine['save']>` disappears |
| Frame capture / export | App Roto (`rotoCanvasFrames.ts`) | Rust WebP encoder | Unchanged ownership; engine surface changes |
| Undo/redo | App Roto physical-edit history (parent-authoritative) | watercolor internal history | Roto history is already app-owned; engine undo only serves sheet ops |
| Script persistence container (SNAP) | App snapshot codec + controller | Rust file IO | Version bump is app-side only (see Q3 trap) |
| Paper height conditioning | App `lib/paperPass.ts` (new local module) | — | Ported from engine-1 before deletion |

## Q1. Mutation ledger (blocking prerequisite)

### 1.1 Where engine-1 allocates IDs today

| # | Site | Verbatim | Consequence after removal |
|---|------|----------|---------------------------|
| 1 | `EfxPaintEngine.ts:2829` | `const mutationId = reservedMutationId ?? this.nextMutationId++` | The only path Roto script acceptance uses today |
| 2 | `EfxPaintEngine.ts:3690` | `private notifyCompletedMutation(kind: CompletedPaintMutation['kind'], mutationId: number = this.nextMutationId++): void {` | **Hidden consumption**: `clear` (`:1862`) and `physics` (`:1655`) allocate an ID purely to notify |
| 3 | `EfxPaintEngine.ts:4687` | `const mutationId = this.nextMutationId++` | Interactive brush stroke — disappears with engine-1 |
| 4 | `EfxPaintEngine.ts:5100` | `mutationId: this.nextMutationId++,` | Every `loadProjectData` assigns **fresh** IDs to loaded strokes |
| 5 | `EfxPaintEngine.ts:2232` | `this.nextMutationId = Math.max(this.nextMutationId, maxMutationId + 1)` | Baseline restore defensive advance |
| 6 | `EfxPaintEngine.ts:810` | `private nextMutationId: number = 1` | Seed value 1 |

`reserveMutationClock` is a **max-raise**, not an assignment, and silently ignores invalid input:

```ts
// packages/efx-physic-paint/src/engine/EfxPaintEngine.ts:2134-2137
reserveMutationClock(minNextMutationId: number): void {
  if (!Number.isInteger(minNextMutationId) || minNextMutationId <= 0) return
  this.nextMutationId = Math.max(this.nextMutationId, minNextMutationId)
}
```

Keep exactly that contract in the new ledger (`reserveNextMutationId`), because three Studio call sites depend on the max-raise being idempotent and order-independent (`PhysicsPaintStudio.tsx:4999`, `:5341`, `:6384`; all feed `Math.max(studioScriptSnapshotReservedNextMutationIdRef.current, restored.maxRestoredMutationId + 1)`).

### 1.2 Acceptance ordering, undo, and state-save interaction

```ts
// packages/efx-physic-paint/src/engine/EfxPaintEngine.ts:2829-2874 (abridged, exact lines)
const mutationId = reservedMutationId ?? this.nextMutationId++
...
const actions = [primary, ...continuations]
this.pushAcceptedActions(actions)
...
this.redoStack = []
this.undoStack.push({ mutationId, actions, checkpoint: null, deferred: ... })
if (this.undoStack.length > 10) this.undoStack.shift()
this.historyEntries = [...this.undoStack]
this.historyIndex = this.undoStack.length
this.notifyHistoryAvailability()
this.pendingStrokeFinalizations.push(pending)
this.markStrokeHandoffComplete()
this.scheduleStrokeFinalization()
return mutationId
```

Three facts the ledger must reproduce:

- **Acceptance is synchronous; rasterization is not.** `pushAcceptedActions` runs before the finalization queue is touched. Ordering is therefore "order of `accept` calls", which the ledger can reproduce exactly.
- **Completion is coupled to rasterization.** `notifyCompletedMutation` only fires from `applyFinalizedStroke` (`:3682-3687`) or from move/erase/physics paths. `drainAcceptedMutations` (`physicsPaintRotoScriptClipboard.ts:484-490`) currently relies on `flushPendingStrokeFinalizations()` + `getStrokes()` to find IDs, then `waitForMutation` waits on the completion listener. **The ledger must emit the completion event itself** (CONTEXT: "no rasterization, no finalization, no hidden rendering"), otherwise copy/apply deadlocks.
- **Undo stack does not need reproducing.** Roto's undo is parent-authoritative (`useRotoPhysicalEditHistory`), and engine-1's 10-entry stack only ever backed brush-mode sheet undo. The ledger needs no undo stack; it needs only the ordered accepted list and the ID clock.

### 1.3 `getAcceptedTarget` — app-owned already

```ts
// app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts:123-130
export interface RotoScriptEnginePort {
  getStrokes: () => PaintStroke[];
  getStrokeCount?: () => number;
  copyLiveAlphaCanvas?: () => HTMLCanvasElement;
  enqueueRecordedStroke: (group: Readonly<RecordedStrokeGroup>) => number;
  flushPendingStrokeFinalizations?: () => void;
  setInputLocked: (locked: boolean) => void;
}
```

- Store: `:319` `const acceptedTargets = new WeakMap<RotoScriptEnginePort, Map<number, RotoScriptAcceptedTarget>>();`
- Populated at enqueue time: `:762-775`
- Read and delete: `:1218-1222`

**Conclusion:** `getAcceptedTarget` needs **no** `aquarelleRecordState` lookup and **no** new ordered acceptance record of its own. It needs only (a) a synchronous `allocateMutationId` return and (b) the WeakMap key to become the ledger adapter object instead of `EfxPaintEngine`. `aquarelleRecordState.ts` records a parallel timeline (`recordAquarelleStroke(mutationId, stroke, keyId)`) and returns `maxMutationId` from `restoreAquarelleRecordTimeline`; it is a *consumer* of IDs, not the allocator. Do not merge the two.

### 1.4 Why the ledger must keep the strokes, not just the IDs

`getStrokes()` is read at `physicsPaintRotoScriptClipboard.ts:378` (source-has-brushes gate), `:486` (pending-ID drain), `:494` (source snapshot), `:557` (persistence capture), and at `PhysicsPaintStudio.tsx:3981` (frame save). The capture path then does:

```ts
// physicsPaintRotoScriptClipboard.ts:557-571 (abridged)
const brushes = normalizeLogicalBrushes(engine.getStrokes());
if (brushes.length === 0 || !engine.copyLiveAlphaCanvas) return null;
const aquarelleEvents = buildAquarelleEventsFromCapture(brushes);
...
scriptAlphaCanvas: engine.copyLiveAlphaCanvas(),
```

and `:746` performs a runtime transform on the same data:

```ts
primary: fromStudioStroke(transformRecordedStrokeForHeldPose(toStudioStroke(brush.primary), {
```

`toStudioStroke`/`fromStudioStroke` are **runtime** imports from engine-1 (`:2`). They must be localized before deletion; the ledger's accepted-stroke type should be that localized `PaintStroke` shape so `normalizeLogicalBrushes` keeps working unchanged.

### 1.5 Proposed ledger API and wiring

```ts
// app/src/components/physic-paint/engine/paintMutationLedger.ts  (location is discretion)
import type { PaintStroke } from ...localized...

export interface AcceptedPaintMutation {
  readonly mutationId: number;
  readonly kind: 'paint' | 'erase' | 'move' | 'physics' | 'clear' | 'undo' | 'redo';
  readonly accepted: readonly PaintStroke[];   // [primary, ...continuations], frozen clones
  readonly acceptedAt: number;
}

export interface PaintMutationLedger {
  allocateMutationId(): number;                       // nextMutationId++
  allocateStrokeMutation(group: Readonly<RecordedStrokeGroup>): number;  // accept + allocate, synchronous
  reserveNextMutationId(n: number): void;             // max-raise, ignores non-int / <= 0
  getAcceptedStrokes(): PaintStroke[];                // acceptance order, fresh clones
  getAcceptedTarget(mutationId: number): AcceptedPaintMutation | null;
  seedFromRestoredMax(max: number): void;             // = reserveNextMutationId(max + 1)
  subscribe(listener: (m: CompletedPaintMutationLocal) => void): () => void;
  setInputLocked(locked: boolean): void;
  setActive(active: boolean): void;
}
```

Wiring map (every existing call site accounted for):

| Current | Replace with |
|---------|--------------|
| `Studio:3758` `allocateMutationId: (stroke) => engine.enqueueRecordedStroke({ primary: aquarelleStrokeToPaintStroke(...) })` | `allocateMutationId: (stroke) => ledger.allocateStrokeMutation({ primary: ... })` — keep the `(stroke) => number` shape |
| `Studio:6773` `const mutationId = mutationEngine.enqueueRecordedStroke({ primary: paintStroke })` | `ledger.allocateStrokeMutation({ primary: paintStroke })` |
| `Studio:2065`, `:6386` `rotoScript.updateEngine(engineRef.current)` | `rotoScript.updateEngine(ledgerAdapter)` where the adapter implements `RotoScriptEnginePort` over the ledger (`getStrokes` → `getAcceptedStrokes`, `enqueueRecordedStroke` → `allocateStrokeMutation`, `setInputLocked` → ledger, `flushPendingStrokeFinalizations` → no-op or watercolor flush) |
| `Studio:4999`, `:5341`, `:6384` `reserveMutationClock(nextMutationId)` | `ledger.reserveNextMutationId(nextMutationId)` |
| `EfxPaintCanvas onCompletedMutation` (`Studio:7704`) → `handleCanvasCompletedMutation` | Ledger `subscribe(...)` invokes the same `canvasCompletedMutationImplRef.current(mutation, ledgerAdapter)` handler, so `observeCompletedMutation` (`:6529`), `getAcceptedTarget` (`:6550`) and `applyCompletedBrushMutation` keep their order |
| `Studio:2955-2956` `saveEngineState`/`loadEngineState` | Unchanged *contract*, new provider (see Q4) |
| `Studio:2967` `flushPendingStrokeFinalizations` | No-op on a ledger-only path; watercolor flush where the sheet has pending work |

`Studio:6529` `rotoScript.observeCompletedMutation(mutationEngine, mutation)` and `:6550` `rotoScript.getAcceptedTarget(mutationEngine, mutationId)` keep working *only* if the same adapter object is used for `updateEngine` and for the completion callback. That identity is load-bearing — the WeakMap is keyed by it.

### 1.6 Parity gate (hard gate 4) — what can and cannot be demonstrated

- **Not demonstrable:** byte-identical numeric IDs across a full session. Three consumption sources vanish (`:4687`, `:3690` default, `:5100` fresh-on-load), and `loadProjectData` re-rolls IDs on every navigation today.
- **Demonstrable (pin these):**
  1. Monotonic, never reused within a session.
  2. Seeded from restored max + 1 at every restore and every engine-ready seam (three call sites above).
  3. Acceptance order == stroke-end order (`allocateStrokeMutation` call order).
  4. SNAP round-trip: write → read → every row's `mutationId` identical.
  5. `getAcceptedTarget` returns the same target object for the same engine key + ID, and deletes it on read (current semantics).
- **Report format:** state 1–5 as met, and state explicitly that numeric identity with engine-1 is out of reach, with the three line references. That is the hard-gate-4 report.

## Q2. `conditionHeightMap` parity

### 2.1 Source and dependencies (complete)

```ts
// packages/efx-physic-paint/src/core/paper.ts:85-92
export function conditionHeightMap(raw: Float32Array): Float32Array {
  let sum = 0
  for (let i = 0; i < raw.length; i++) sum += raw[i]
  const mean = raw.length > 0 ? sum / raw.length : 0.5
  const out = new Float32Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = clamp(0.5 + (raw[i] - mean), 0.1, 0.9)
  return out
}
```

```ts
// packages/efx-physic-paint/src/util/math.ts:56-58
export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
```

**Transitive dependency count: one** (`clamp`). Nothing else. Re-exported at `packages/efx-physic-paint/src/index.ts:5` (`export { conditionHeightMap } from './core/paper'`).

### 2.2 Exact port

Target file `app/src/lib/paperConditioning.ts` (CONTEXT-specified):

- Export `conditionHeightMap` verbatim (the 8-line body above, including comments at `paper.ts:79-84` which carry the locked 260925-dso semantics).
- Export the local `clamp` too, or inline the ternary. Do **not** import from engine-1 — the point is deletion.
- Update the single consumer: `app/src/lib/paperPass.ts:1` (`import { conditionHeightMap } from '@efxlab/efx-physic-paint';`) → `from './paperConditioning'`. `paperPass.ts:267` is the only call site in app code.

### 2.3 Golden fixture — generate BEFORE the package dies

Deterministic function, so a fixture is exact. Pin these inputs (each also covers a branch):

| Case | Why |
|------|-----|
| `new Float32Array(0)` | Empty branch: mean defaults to 0.5, output length 0 |
| 4× `0.5` | Symmetric input → all 0.5 (mean-centre is a no-op) |
| ramp `[0, 0.25, 0.5, 0.75, 1]` | Mean-centre + clamp upper bound (0.1/0.9) |
| `[0, 0, 1, 1]` | Mean 0.5, contrast extremes |
| seeded pseudo-random 256 values in `[0,1]` | The realistic paper-probe shape |
| `[NaN, 0.5, 0.5]` | Pins NaN propagation: `clamp(NaN, …)` returns NaN (both comparisons false) → output `NaN` at index 0 |
| `[0.1, 0.1, 0.9, 0.9]` | Exactly-on-bound values |

Procedure (Wave 0, before any deletion):

1. One-off vitest inside `packages/efx-physic-paint` (its own package config collects `src/**/*.test.ts`) writes `{ input: number[], expected: number[] }` per case as JSON to `app/src/lib/__fixtures__/paperConditioning.golden.json` — or a `node --experimental-strip-types` script importing `src/core/paper.ts`.
2. Commit the fixture.
3. Permanent test at `app/src/lib/paperConditioning.test.ts` — **must live under `app/src/**/*.test.ts`**: `app/vitest.config.ts:5` is `include: ['src/**/*.test.ts', '../packages/efx-paint-host/src/**/*.test.ts']`, so package tests outside those two roots are never collected by the project test command (`pnpm --filter efx-motion-editor exec vitest run`).
4. Compare **byte-wise** (`new Uint8Array(a.buffer)` vs the same for expected), not with `toBeCloseTo` — NaN and −0 must match exactly.

### 2.4 Test that breaks on deletion (must be retargeted in the same wave)

```ts
// app/src/lib/paperPass.frameGuard.test.ts:80-82
it('P4(e) the package exports conditionHeightMap for the shared conditioner', () => {
  expect(packageIndexSource).toMatch(/export\s*\{[^}]*\bconditionHeightMap\b[^}]*\}/);
});
```

`packageIndexSource` is `readFileSync('../../../packages/efx-physic-paint/src/index.ts')` at module load — the file vanishes and the whole suite file throws. Retarget to `app/src/lib/paperConditioning.ts` and change the assertion to `export function conditionHeightMap`.

### 2.5 Scope nuance worth planning for

`paperPass.ts:36-64` states the post-bake tooth belongs to **engine-1 alpha paint**, and `shouldApplyPaperPass` returns `false` whenever `transmittanceSheet` or `transmittanceTrackConverted` is set — i.e. a watercolor document never routes through this pass. Port the conditioner anyway (CONTEXT locks it, and the pass survives as shared composite code), but do **not** expect a visible change from this port, and do **not** delete `applyPaperPass`/`encodePassTiles`.

## Q3. SNAP v4 clean break

### 3.1 Current chain (exact)

| Step | Location | Verbatim / behaviour |
|------|----------|----------------------|
| Version constant | `studioScriptSnapshotCodec.ts:62` | `export const STUDIO_SCRIPT_SNAPSHOT_VERSION = 4;` |
| Accepted set | `:64-69` | `new Set([1, 2, 3, STUDIO_SCRIPT_SNAPSHOT_VERSION])` |
| Version reject | `:891-893` | `if (!STUDIO_SCRIPT_SNAPSHOT_VERSIONS.has(version)) { fail('version', \`unsupported SNAP version ${version}\`, 4); }` |
| Error type | `:138-149` | `class StudioScriptSnapshotCodecError` with `readonly code: StudioScriptSnapshotCodecErrorCode` |
| Decode catch | `studioScriptSnapshotController.ts:785-793` | `const kind = error instanceof StudioScriptSnapshotCodecError ? \`corrupt:${error.code}\` : 'corrupt';` then `reportRestoreFailureOnce(kind)` |
| Missing file | `:776-780` | Silent no-op: `// Silent no-op: the first session on a project has no snapshot yet.` → `status: 'empty'` |
| Dedupe | `:729-733` | `if (restoreFailureReported) return; restoreFailureReported = true; deps.report(...)` |
| Re-arm | `:748` (`bind`) and `:1151` (`reset`) | `restoreFailureReported = false;` |
| Message | `:671-673` | `` return `Studio script snapshot could not be restored (${kind}). The frame pixels are unchanged.`; `` |
| Surface | `PhysicsPaintStudio.tsx:1231-1235` | `report: (message) => { setApplyStatus('error'); setApplyMessage(message); setLastError(message); }` |

**"One notice per project binding" already exists structurally** — `restoreFailureReported` is reset only in `bind()` and `reset()`. A v4-specific notice therefore needs only two changes: a distinct kind, and its wording.

### 3.2 Exact seam for the clean-break notice

Recommended: give the codec a dedicated code rather than reusing `'version'`.

- In the codec, before the generic version reject, special-case the retired container version and throw with a new code, e.g. `fail('snap-v4-retired', 'SNAP v4 predates the watercolor-only format', 4)`. That makes the controller kind `corrupt:snap-v4-retired` with zero changes to the controller's control flow.
- In `studioScriptSnapshotController.ts`, extend the message function (or add a sibling) so `kind === 'corrupt:snap-v4-retired'` yields the locked clean-break wording; every other kind keeps the current text. `studioScriptSnapshotRestoreFailureMessage` is shared only by restore (`:732`), so the change is contained — save/purge have their own builders at `:675` and `:680`.
- Bump `STUDIO_SCRIPT_SNAPSHOT_VERSION` to `5`, and remove `4` from `STUDIO_SCRIPT_SNAPSHOT_VERSIONS`. Keep `1..3`? No — CONTEXT says a v4 snapshot is unsupported and the clean break drops the brush body; v1–v3 are older still. Decision for the planner: keep `1/2/3` in the accepted set only if their watercolor/anchor sections decode without a brush body; otherwise collapse the set to `{5}` and route `1..4` through the same clean-break kind. The locked requirement names v4 explicitly, so the minimum is: `4` → clean-break notice, `5` → accepted.
- Drop the brush section from the encoder. Decode must not require it for v5.

### 3.3 Trap: do **not** bump the Rust format version

```rust
// app/src-tauri/src/services/studio_script_snapshot.rs:63
pub const STUDIO_SCRIPT_SNAPSHOT_FORMAT_VERSION: u32 = 1;
// :127-128
/// The one file name both roots share: `<trackId>-v1.snap`.
format!("{track_id}-v{STUDIO_SCRIPT_SNAPSHOT_FORMAT_VERSION}.{SNAPSHOT_EXTENSION}")
```

The Rust `1` is a **file-name** version, independent of the container's u16. If it is bumped to 2, every existing `-v1.snap` becomes invisible, restore returns `missing`, and `:776-780` swallows it silently — the clean-break notice would **never fire**. Leave it at `1`.

### 3.4 Tests to pin

1. **Codec:** hand-assemble a v4 container (magic `SNP1`, u16 `4`) → expect `StudioScriptSnapshotCodecError` with the new code.
2. **Codec:** a v5 encode→decode round-trip carries the watercolor body and no brush body.
3. **Controller:** two consecutive `restore()` calls against one binding → `deps.report` called **exactly once**; then `bind(newIdentity)` → next restore reports again. (Direct unit test of `restoreFailureReported`.)
4. **Message:** exact-string assertion on the clean-break wording (the generic `could not be restored (corrupt:version)` string must not appear).
5. **No silent resurrection:** a v4 file must not seed any row — assert the restored timeline/store is empty and `maxRestoredMutationId === 0`.

## Q4. Roto physical-edit engine surface — **STOP CONDITION**

### 4.1 What each file actually asks of engine-1

| File | Engine members used (verified) | Aquarelle equivalent | Verdict |
|------|-------------------------------|----------------------|---------|
| `hooks/useRotoPhysicalEditCoordinator.ts` | type `EfxPaintDocument` (`:43`), generic default (`:1051`, `:1085`); `flushPendingStrokeFinalizations` via paint port (`:1810`) | `snapshot`/`restore`; no flush needed | Adaptable — flush becomes a no-op for watercolor |
| `hooks/useRotoPhysicalEditHistory.ts` | **app-local** `EfxPaintDocument` from `app/src/efx-paint/document/efxPaintDocument` (`:89`), `buildEfxPaintDocumentRevision` (`:88`); reads `accepted.after.document.capacity` (`:892`) | Already app-owned | No engine dependency — only the generic default needs retyping |
| `hooks/useRotoFramePersistenceCoordinator.ts` | `ReturnType<EfxPaintEngine['save']>` (`:343`, type-level); `getBackgroundMetadata()` (`:558`, `:579`, `:793`) is an **app** port | `DocumentSnapshot` type | Requires a local `RotoEditableState` type |
| `roto/rotoCoordinatorPorts.ts` | `import type { EfxPaintDocument, EfxPaintEngine }` (`:1`); `engine: EfxPaintEngine \| null` (`:382`); `RotoPhysicalEditEnginePort<EngineState>` = `{ saveEngineState; loadEngineState }` (`:310-313`) | `snapshot()` / `restore(s)` | Requires retyping the generic + port |
| `roto/rotoCanvasFrames.ts` | `engine.save()` (`:136`), `engine.setBgMode('transparent')` (`:140`), `engine.exportCompositeCanvas()` (`:141`), optional `engine.getPreviewBasePaintSource()` (`:145`), `engine.setBgMode(background)` (`:156`), `engine.load(state)` (`:157`) | `exportCanvas(background, texture)` (`Engine.ts:890`), `snapshot()` (`:555`) / `restore()` (`:567`). **No `getPreviewBasePaintSource`** | **STOP** — needs a real rewrite, not a retype |
| `hooks/useRotoFrameEditingController.ts` | `engine.save()` (`:80`), `engine.undo()` (`:102`), `engine.redo()` (`:115`), `engine.resetBackground?.()` (`:136`), `engine.clear()` (`:176`), `engine.clearPreviewBaseImage()` (`:177`), `engine.resetBackground()` (`:178`), `reference.loadReferenceFrame(...)` (`:190`) | `undo()` (`:1271`), `redo()` (`:1273`), `clear()` (`:1246`). **No `resetBackground`, no `clearPreviewBaseImage`, no `loadReferenceFrame`** | **STOP** |
| `hooks/useRotoPersistenceIntegration.ts` | `engine.clearPreviewBaseImage(true)` (`:16`), `engine.resetBackground(true)` (`:17`), `engine.clear()` (`:18`), `engine.flushPendingStrokeFinalizations()` (`:81`), `resetBackground(true)` (`:91`), `clear()` (`:92`) | `clear()` only | **STOP** |
| `roto/rotoEditBufferTransactions.ts` | only `ReturnType<EfxPaintEngine['save']>` (`:5`). The `.clear()` calls at `:108-112` are `Map`/`Set` clears, **not** engine calls | — | Type alias only |
| `roto/rotoSaveTransactions.ts` | only `ReturnType<EfxPaintEngine['save']>` (`:10`); `shouldPersistRotoFrame` (`:45-47`) and `isBackgroundOnlyRotoFrame` (`:52-53`) read `state.tracks[].strokes` and `settings.bgMode` | — | **STOP (semantic)** — see 4.3 |

### 4.2 The handle problem

`WatercolorEngine` is instantiated inside `AquarelleCanvasLayer.tsx` (`:271` `useRef<WatercolorEngine|null>`) and **never exposed**. `PhysicsPaintCanvasMount.tsx:191-235` always renders `<EfxPaintCanvas>` (hidden when the aquarelle layer is active). So today there is no object to substitute for `engineRef.current` on any of the call sites above. Any plan that says "retype the engine" is incomplete until either:

- **Option A (recommended):** `AquarelleCanvasLayer` publishes a handle (ref callback or a module-level `aquarelleEngineHandle` signal), and a thin `AquarelleEnginePort` adapter implements the members Roto needs — `snapshot/restore` → watercolor `snapshot/restore`, `exportCompositeCanvas` + `setBgMode` → `exportCanvas(background)`, `undo/redo/clear` → watercolor equivalents. Missing members (`resetBackground`, `clearPreviewBaseImage`, `getPreviewBasePaintSource`, `loadReferenceFrame`, `flushPendingStrokeFinalizations`) are re-homed into app code that already holds the state (`aquarelleDurableBaseByKeyRef`, `loadCachedRotoReferenceFrame`, `requirePhysicPaintRotoInlineBytes`).
- **Option B:** keep a slim app-owned "engine-state provider" that owns the Roto editable state (a `RotoEditableState` built from `aquarelleRecordState` + key records) and never touches a paint engine. Larger change, but removes the last engine coupling from Roto.

**This is the hard stop.** Wave 4 cannot be planned as mechanical retyping. A decision (and a user "go") is required before any file in this table is edited.

### 4.3 Semantic trap: `shouldPersistRotoFrame` reads engine-1 document strokes

```ts
// app/src/components/physic-paint/roto/rotoSaveTransactions.ts:40-53
/** Active-track engine carrier read: strokes/settings ride the active track in v1.0 documents (D-03). */
  return state.tracks.find((track) => track.id === state.activeTrackId) ?? null;
...
  return (track?.strokes?.length ?? 0) > 0 || (track?.settings?.bgMode ?? 'transparent') !== 'transparent';
```

On a watercolor-only document those `strokes` arrays are the engine-1 mirror — they stop being populated the moment stroke acceptance routes through the ledger. If this predicate is not re-pointed at a watercolor truth source (recorded events per frame / key payload), **every frame will classify as "empty"** and Roto persistence silently drops real paint. Pin this with a test as part of Wave 0 or the earliest wave that touches the ledger.

## Q5. Measurement commands and pinned baselines

### 5.1 Studio chunk (no dev server)

- Current output: `app/dist/PhysicsPaintStudio-DcMFAK_W.js` = **943,411 bytes** (built 2026-10-27 12:04). CONTEXT's "924 KB" is the same artifact expressed in KiB-ish units at an earlier build — **pin bytes, never KB, and never the hash**.
- Build: `pnpm --dir app run build` → runs `tsc --noEmit && vite build` (`app/package.json:9`) and writes `app/dist` (flat files, no `assets/`).
- Measure: `ls -l app/dist/PhysicsPaintStudio-*.js` or `find app/dist -maxdepth 1 -name 'PhysicsPaintStudio-*.js' -exec stat -f '%z %N' {} \;`.
- Alternative that does not write `app/dist`: `pnpm --filter efx-motion-editor exec vitest run src/viteBuild.test.ts` drives a real Vite `build()` into a temp dir (`viteBuild.test.ts:1-30, 140-152`).
- Budget pin: `app/vite.config.ts:297` `chunkSizeWarningLimit: 2000`. Separation pin: `app/src/viteBuild.test.ts:190-201` matches `/PhysicsPaintStudio-[^/]*\.js$/` and requires ≥ 1 chunk.
- Pass/fail rule from CONTEXT: expected 650–700 KB after removal; **stop if the measured bytes exceed 943,411**.

### 5.2 Static census (commands verbatim from inventory §10; measured 2026-10-27)

| Gate | Command | Measured now |
|------|---------|--------------|
| G1 | `grep -rn "@efxlab/efx-physic-paint" app/src packages --include='*.ts' --include='*.tsx' --include='*.json' \| grep -v node_modules \| grep -v dist \| wc -l` | **91** hits / **73** files |
| G2 | `grep -rn "brushScript\|BrushScript" app/src --include='*.ts' --include='*.tsx' \| wc -l` | **1,146** hits / **23** files |
| G3 | `grep -rn "ROTO_SCRIPT_ENGINE_ID\b" app/src --include='*.ts' --include='*.tsx' \| wc -l` | **12** |
| G4 | `grep -rn "SCRIPT_ENGINE_ID\b" app/src-tauri/src \| wc -l` | **5** |
| G5 | `grep -rn "efx-physic-paint" app/src --include='*.ts' --include='*.tsx' \| wc -l` | **132** (must reduce to window-label + legacy-refusal hits only) |
| Import files | `grep -rln "from '@efxlab/efx-physic-paint'" app/src --include='*.ts' --include='*.tsx' \| wc -l` | **62** files (**40** non-test) — inventory says 65; counts drift, re-measure at each wave |

Post-wave zero gate (inventory `:55`): `grep -rn "@efxlab/efx-physic-paint" app packages --include='*.ts' --include='*.tsx' --include='*.json' --include='*.mjs'` → zero.

**Allowed survivors under G5** (all must be justified in the plan):

- `app/src/lib/physicPaintBridge.ts:156` `export const PHYSIC_PAINT_WINDOW_LABEL = 'efx-physic-paint';`
- `app/src/lib/physicPaintFlush.ts:17` `const PHYSIC_PAINT_WINDOW_LABEL = 'efx-physic-paint';`
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptApplyRefusal.ts:66` `'efx-physic-paint': 'Brush',` (legacy refusal rows — CONTEXT keeps them)
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts:82` — comment only
- `app/src/efx-paint/host-split/preSplitGoldenFixture.ts:300` `brushId: 'efx-physic-paint',` — golden fixture; decide keep-as-data or rewrite
- Test fixtures referencing the label (`physicPaintBridge.test.ts`, `PhysicsPaintRightSidebar.test.ts:141`) — keep, they pin the window label

Note G3: `ROTO_SCRIPT_ENGINE_ID` is declared at `physicsPaintRotoScriptSchema.ts:19` as `'efx-physic-paint'`, with `ROTO_SCRIPT_ENGINE_ID_AQUARELLE = 'efx-watercolor'` at `:21`. The clean break flips the default to `efx-watercolor`; every schema/refusal/test site in the 12 hits must be walked, and the v1 brush parser branch (`:333`, `:543`) deleted rather than left as dead code.

## Q6. Trap check — confirmations and contradictions

| Item | Status | Evidence |
|------|--------|----------|
| `fakeEngine2Fixture.ts` is watercolor-only and kept | **Confirmed.** Zero imports; the only `efx-physic-paint` match is a comment. | `app/src/efx-paint/host-split/fakeEngine2Fixture.ts:14` `* Zero engine-1 imports: nothing from \`@efxlab/efx-physic-paint\`, and no` |
| `usePhysicsPaintEngineActions.ts` split boundary | **Contradiction — not a clean boundary.** It is a 149-line pass-through to 14 `EfxPaintEngine` setters: `setTool`, `setPhysicsMode`, `setColorHex`, `setBrushOpacity`, `setBrushSize`, `setBgMode`, `setEmbossStrength`, `setEdgeDetail`, `setPickup`, `setLocalSpreadStrength`, `setAntiAlias`, `setEraseStrength`, `startPhysics`, `stopPhysics` (`:30-122`). `WatercolorEngine` exposes only `setTool(t: Tool)` (`Engine.ts:1064`). All 14 actions need a new home, not a retype. | quoted above; `Engine.ts:1064` `setTool(t: Tool) { this.tool = t; this.updateCursor(); }` |
| `physicsPaintTemporaryErase.ts` has no watercolor path | **CONTRADICTION — inventory marks it DELETE; it is live on the watercolor path.** It exports `temporaryMove`, which `AquarelleCanvasLayer` imports and reads. Its only engine interaction is `engine.setTool` (`:167`), consumed by the display layer, not the engine. Keep the file; localize the `ToolType` import (`:2`). | `AquarelleCanvasLayer.tsx:45` `import { temporaryMove } from '../view/physicsPaintTemporaryErase';` and `:84` `if (aquarelleSelectMode.value || temporaryMove.value) return null;` |
| `recordedStrokeGroups.ts` stays | **Confirmed keep, but it imports engine-1 at type level.** | `:15` `import type { PaintStroke } from '@efxlab/efx-physic-paint';` |
| `stackOrder.ts` stays | **Confirmed keep — and the inventory understates it.** It is a runtime re-export of three functions, not just the type. | `app/src/components/physic-paint/view/stackOrder.ts:7-13` re-exports `clampStackPosition`, `reorderForStackPosition`, `targetIndexForStackPosition`; implementations at `packages/efx-physic-paint/src/engine/stackOrder.ts:21,33,44` must be copied locally |
| `aquarelleStrokeBridge.ts` | Keep; type-only imports. | `import type { PaintStroke, PenPoint } from '@efxlab/efx-physic-paint'` |
| `physicsPaintRotoScriptClipboard.ts` | Keep; **runtime** imports must be localized. | `:2` `import { toStudioStroke, fromStudioStroke, type CompletedPaintMutation, type PaintStroke } from '@efxlab/efx-physic-paint';` |
| `frameScriptOwnership.ts` | Collapse as CONTEXT directs. | `:89-90` `if (hasBrush) return 'brush'; if (hasWatercolor) return 'watercolor';` → `'watercolor' | null` |

### Additional contradiction not in the inventory

`app/src/lib/paperPass.frameGuard.test.ts:80-82` reads the engine-1 package **source file** at module load. Deleting the package breaks the entire suite file (ENOENT), not just one assertion. It must be retargeted in the same wave as the `conditionHeightMap` port (see Q2.4).

## Standard Stack

No new packages. This quick adds zero dependencies; it removes one workspace package.

| Item | Version / fact | Notes |
|------|----------------|-------|
| `@efxlab/efx-physic-paint` | `workspace:*` (`app/package.json:17`) | Being removed |
| `@efxlab/efx-watercolor` | `workspace:*` | Sole remaining paint engine |
| vitest | `^2.1.9` (`app/package.json:52`), config `app/vitest.config.ts` | `include: ['src/**/*.test.ts', '../packages/efx-paint-host/src/**/*.test.ts']` |
| vite | config `app/vite.config.ts`, `chunkSizeWarningLimit: 2000` (`:297`) | Build output `app/dist`, flat |
| Rust / Tauri | `cargo 1.93.1`, `tauri-cli 2.11.4` | Snapshot file version stays `1` |
| Node / pnpm | `v24.15.0` / `10.27.0` | — |

**Installation:** none.

**Package Legitimacy Audit:** not applicable — no packages installed. One package is removed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Stack-order arithmetic | A re-derived position/target law in the app | Copy `clampStackPosition` / `targetIndexForStackPosition` / `reorderForStackPosition` verbatim from `packages/efx-physic-paint/src/engine/stackOrder.ts:21-59` | The law is shared with the brush stack and pinned by tests; a second derivation drifts |
| Paper height conditioning | A new normalization | Verbatim port of `conditionHeightMap` + `clamp` (Q2) | Locked 260925-dso semantics; 8 lines |
| Stroke grouping for script capture | A new normalizer | Keep `normalizeLogicalBrushes` in `recordedStrokeGroups.ts` unchanged | It encodes zero-point-continuation rules (`physicsPaintRotoScriptClipboard.ts:6, 494, 557`) |
| Stroke coordinate mapping | A new UV↔pixel map | Keep `aquarelleStrokeBridge.ts` unchanged | Its header documents the exact failure mode (sub-pixel blob at origin) |
| Version-specific restore messaging | A second reporting channel | Extend the existing `reportRestoreFailureOnce` kind + message builder | Dedupe-per-binding already exists (`:706, :729-733, :748, :1151`) |

## Common Pitfalls

### Pitfall 1: Completion coupled to rasterization
**What goes wrong:** The ledger accepts a stroke but never emits `CompletedPaintMutation`; `waitForMutation` never resolves; copy/apply hangs, `drainAcceptedMutations` never drains.
**Why:** Today completion fires from `applyFinalizedStroke` (`EfxPaintEngine.ts:3682-3687`) — i.e. only after rasterization.
**How to avoid:** Ledger emits completion synchronously in `allocateStrokeMutation`, through the same `canvasCompletedMutationImplRef` handler the canvas uses (`Studio:7704`).
**Warning signs:** `applyStatus` stuck on "Applying", pending-ID sets non-empty.

### Pitfall 2: Adapter identity mismatch
**What goes wrong:** `getAcceptedTarget` returns `null` for every mutation; every script apply refuses.
**Why:** `acceptedTargets` is a `WeakMap` keyed by the engine object (`:319`); a fresh adapter per call is a different key.
**How to avoid:** One memoized adapter instance, passed to both `updateEngine` (`Studio:2065`, `:6386`) and the completion callback (`:6529`, `:6550`).

### Pitfall 3: Silent `missing` swallows the SNAP notice
**What goes wrong:** v4 files produce no notice at all.
**Why:** Bumping the Rust file-name version (`studio_script_snapshot.rs:63`) hides old files → `status: 'empty'` silent no-op (`controller:776-780`).
**How to avoid:** Rust `1` stays; only the container u16 changes.

### Pitfall 4: Package tests never run
**What goes wrong:** A "parity test" placed next to the package passes review but never executes.
**Why:** `app/vitest.config.ts:5` collects only `app/src/**` and `efx-paint-host` tests.
**How to avoid:** Put the permanent parity test at `app/src/lib/paperConditioning.test.ts`.

### Pitfall 5: `shouldPersistRotoFrame` silently empties Roto frames
See Q4.3. Re-point the predicate at a watercolor truth source and test it.

### Pitfall 6: Wave 4 assumed mechanical
Wave 4 touches 5 files with no Aquarelle equivalent. Treat Q4.2 as a gating decision, not a task.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Wave 4's Roto replacement will take **Option A** (expose a watercolor handle + adapters) | Q4 | If Option B is chosen, Wave 4's file list and effort change substantially |
| A2 | SNAP accepted-version set for v5 collapses v1–v4 into the clean-break notice (CONTEXT names only v4) | Q3.2 | If v1–v3 must stay readable, extra decode branches survive |
| A3 | `preSplitGoldenFixture.ts:300` `brushId: 'efx-physic-paint'` is data, not a live specifier | Q5.2 | If it is a live comparison input, the fixture must be regenerated |
| A4 | The paper pass is retained but never fires on watercolor-only documents | Q2.5 | If a mixed document can still contain engine-1 alpha paint, `shouldApplyPaperPass` needs a new truth source |
| A5 | "924 KB" in CONTEXT refers to the same 943,411-byte artifact | Q5.1 | If it refers to a different build, the stop threshold must be restated in bytes |

## Open Questions

1. **Which Roto replacement — Option A or B?**
   - What we know: Aquarelle exposes `snapshot`/`restore`/`exportCanvas`/`undo`/`redo`/`clear`/`setTool`/`setReference`; nothing else.
   - What's unclear: whether the missing members (`resetBackground`, `clearPreviewBaseImage`, `getPreviewBasePaintSource`, `loadReferenceFrame`, `flushPendingStrokeFinalizations`) re-home cleanly into app code.
   - Recommendation: inspect `aquarelleDurableBaseByKeyRef` usage and `loadCachedRotoReferenceFrame` first; if both already hold the needed state, Option A is a small adapter, not a subsystem.

2. **Does `aquarelleRecordState` already record enough to rebuild `getAcceptedStrokes()`?**
   - What we know: it records `mutationId → stroke → keyId` plus payload timelines.
   - What's unclear: whether it preserves continuations and ordering for `normalizeLogicalBrushes`.
   - Recommendation: do not depend on it — keep the ledger's own ordered list (Q1.4).

3. **`preSplitGoldenFixture.ts` disposition** — see A3.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node | build + tests | ✓ | 24.15.0 | — |
| pnpm | workspace install/build | ✓ | 10.27.0 | — |
| vitest | all gates | ✓ | ^2.1.9 (app) | — |
| vite build | chunk measurement | ✓ | via `pnpm --dir app run build` | temp-dir build via `viteBuild.test.ts` |
| Rust / cargo | Tauri snapshot tests | ✓ | cargo 1.93.1 | — |
| tauri-cli | native UAT builds | ✓ | 2.11.4 | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^2.1.9 |
| Config file | `app/vitest.config.ts` — `include: ['src/**/*.test.ts', '../packages/efx-paint-host/src/**/*.test.ts']` |
| Quick run command | `pnpm --filter efx-motion-editor exec vitest run src/lib/paperConditioning.test.ts` |
| Full suite command | `pnpm --filter efx-motion-editor exec vitest run` (never watch mode) |

### Phase Requirements → Test Map
| Req (from CONTEXT) | Behavior | Test Type | Automated Command | File Exists? |
|--------------------|----------|-----------|-------------------|-------------|
| Ledger monotonic + seeded | `allocateMutationId` never reuses after restore | unit | `vitest run src/components/physic-paint/engine/paintMutationLedger.test.ts` | ❌ Wave 0 |
| Ledger acceptance order | ID order == stroke-end order | unit | same file | ❌ Wave 0 |
| `getAcceptedTarget` parity | same target returned then deleted | unit | `vitest run src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts` | ✅ extend |
| No engine-1 in watercolor recording | negative gate | unit/structural | new test asserting no engine-1 import on the watercolor stroke-end path | ❌ Wave 0 |
| `conditionHeightMap` byte parity | golden fixture equality | unit | `vitest run src/lib/paperConditioning.test.ts` | ❌ Wave 0 |
| SNAP v4 clean break | one notice per binding, exact text | unit | `vitest run src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts` + codec test | ✅ extend both |
| `shouldPersistRotoFrame` truth source | watercolor frame persists | unit | `vitest run src/components/physic-paint/roto/rotoSaveTransactions.test.ts` (create if absent) | ❌ |
| Static gates G1–G5 | zero/expected counts | shell | inventory §10 commands | ✅ commands exist |
| Studio chunk | ≤ 943,411 bytes, ≥ 1 separate chunk | build | `pnpm --dir app run build` + `ls -l app/dist/PhysicsPaintStudio-*.js` | ✅ |

### Sampling Rate
- **Per task commit:** the wave's own new/changed test file(s).
- **Per wave merge:** `pnpm --filter efx-motion-editor exec vitest run`.
- **Phase gate:** full suite green + G1 zero + chunk ≤ baseline, before native UAT.

### Wave 0 Gaps
- [ ] `app/src/components/physic-paint/engine/paintMutationLedger.ts` + `.test.ts`
- [ ] `app/src/lib/paperConditioning.ts` + `.test.ts` + `__fixtures__/paperConditioning.golden.json`
- [ ] Local type module (e.g. `app/src/components/physic-paint/types/paintTypes.ts`) for `ToolType`, `BgMode`, `PaintStroke`, `PenPoint`, `StackReorderResult`, `RotoEditableState`
- [ ] Retarget `app/src/lib/paperPass.frameGuard.test.ts:80-82`
- [ ] `rotoSaveTransactions` predicate test
- [ ] Negative test: watercolor stroke recording performs no engine-1 call

*(Framework install: none — vitest is present.)*

## Security Domain

`security_enforcement` is not disabled in `.planning/config.json`; included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | **yes** | SNAP decode: length/offset/identity/version checks in `studioScriptSnapshotCodec.ts`; script schema validation in `physicsPaintRotoScriptSchema.ts` (`engine-mismatch` refusal at `:333-335`) |
| V6 Cryptography | no | No hand-rolled crypto in this change |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed/crafted snapshot file → OOB read or huge allocation | Tampering / DoS | Keep every `Reader` bound check (`fail('truncated'|'count'|'length'…)`); do not relax bounds when dropping the brush section |
| Path traversal via snapshot file name | Tampering | Rust `studio_script_snapshot.rs:445` — only the exact `<trackId>-v{1}.snap` leaf is touched; do not widen |
| Stale/foreign script injected via v4 resurrection | Spoofing | The clean break must not seed rows from v4 (Q3.4 test 5) |
| Cross-track stroke seeding | Tampering | Keep the key-anchor + foreign-key-id guards (`Studio:1200-1218`) |

## Sources

### Primary (HIGH confidence — read this session)
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` — `:810`, `:1655`, `:1862`, `:2134-2137`, `:2140-2160`, `:2232`, `:2823-2874`, `:3229`, `:3682-3695`, `:4687`, `:5097-5105`
- `packages/efx-physic-paint/src/core/paper.ts:79-92`; `packages/efx-physic-paint/src/util/math.ts:52-58`
- `packages/efx-physic-paint/src/engine/stackOrder.ts:12-59`; `packages/efx-physic-paint/src/types.ts` (`ToolType`, `BgMode`)
- `packages/efx-watercolor/src/playground/Engine.ts:555`, `:567`, `:890`, `:1064`, `:1096`, `:1246`, `:1271`, `:1273`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — `:1158-1235`, `:2065`, `:2810`, `:2955-2967`, `:3758`, `:3960-3982`, `:4999`, `:5341`, `:6384`, `:6386`, `:6529`, `:6550`, `:6773`, `:7704`
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts` — `:2`, `:123-130`, `:319`, `:378`, `:484-494`, `:557-571`, `:746`, `:762-775`, `:1218-1222`
- `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts` — `:671-673`, `:706`, `:729-733`, `:748`, `:776-793`, `:1151`
- `app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts` — `:62-69`, `:138-149`, `:891-893`
- `app/src-tauri/src/services/studio_script_snapshot.rs:63`, `:127-128`, `:445`
- `app/src/components/physic-paint/roto/rotoCoordinatorPorts.ts:1`, `:310-313`, `:333-336`, `:381-401`
- `app/src/components/physic-paint/roto/rotoCanvasFrames.ts:135-159`; `rotoSaveTransactions.ts:1-53`; `rotoEditBufferTransactions.ts:1-5`
- `app/src/components/physic-paint/hooks/useRotoFrameEditingController.ts:80-191`; `useRotoPersistenceIntegration.ts:13-92`; `useRotoFramePersistenceCoordinator.ts:343`
- `app/src/components/physic-paint/engine/usePhysicsPaintEngineActions.ts:1-149`; `AquarelleCanvasLayer.tsx:45,84,271`; `PhysicsPaintCanvasMount.tsx:191-235`
- `app/src/components/physic-paint/view/physicsPaintTemporaryErase.ts:2,59,106,167`; `recordedStrokeGroups.ts:15`; `stackOrder.ts:7-13`; `frameScriptOwnership.ts:89-90`
- `app/src/lib/paperPass.ts:1-64,267`; `paperPass.frameGuard.test.ts:80-82`; `app/vitest.config.ts:5`; `app/vite.config.ts:297`; `app/src/viteBuild.test.ts:1-30,140-201`; `app/package.json:9,17,52`
- `SPECS/engine-1-removal/REMOVAL-INVENTORY.md:55`, `:273-285`, `:346`
- `app/dist/PhysicsPaintStudio-DcMFAK_W.js` — 943,411 bytes

### Secondary (MEDIUM confidence)
- None. No web/Context7 lookup was needed; every claim is in-repo.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; versions read from `package.json` and probed on the machine.
- Architecture (ledger, SNAP seam, measurement): HIGH — all line-referenced and quoted.
- Architecture (Roto replacement, Q4): LOW–MEDIUM — the gap is proven (members listed, equivalents checked), but no replacement exists; Option A vs B is an open decision.
- Pitfalls: HIGH — each is derived from a specific line, not from general knowledge.

**Research date:** 2026-10-27
**Valid until:** 2026-11-26 (30 days) — or until any wave lands, whichever is sooner; re-measure the census and chunk at each wave.
