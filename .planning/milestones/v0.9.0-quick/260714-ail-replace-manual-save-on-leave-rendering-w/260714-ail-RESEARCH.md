# Quick Task 260714-ail: Direct Live Pixel Caching for Physics Paint Roto - Research

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Capture ownership and cached-base composition
- The existing extracted Roto controller transaction owns when and where an automatic cache update commits.
- Capture must reuse the live engine's already-rendered alpha-only pixels at an existing completed-mutation boundary.
- Preserve the existing additive cached-base repaint path for an existing flattened real key: `flattened cached base + current live overlay = updated flattened real-key cache`.
- Never replace an existing cached base with the live overlay alone.
- Raster composition through the established additive repaint helper/path is allowed and is not a second paint render, stroke replay, or physics simulation.
- Opening a cached key still displays its flattened base; new brushes remain a live overlay; Undo affects only new live brushes; undoing all new brushes returns exactly to the original base.
- Paper/background pixels remain outside the paint cache.

### Asynchronous ordering
- Use a monotonic revision per durable source frame.
- Fix source-frame identity and revision when the mutation transaction begins.
- A capture may commit only if its revision is still latest for that source frame when encoding/compositing finishes.
- Different source frames commit independently; do not introduce a global queue.
- Older frame-A results cannot overwrite newer frame-A results or write into frame B after navigation.
- Additive captures bind the correct flattened base and live overlay to their revision.
- Clear, Undo-to-empty, key removal, and deletion increment the frame revision; removal wins over older pending non-empty captures.
- Derived interpolation regeneration starts only from the latest accepted real-key commit.
- Store/project invalidation occurs only for accepted commits, not discarded stale results.
- Do not use timers, polling, or require cancellation.

### Editable Roto JSON
- Keep editable engine/session state only in memory while Physics Paint is open, and only as required for existing live painting and per-brush Undo.
- Do not serialize editable Roto engine JSON into durable project output.
- Do not send or retain editable JSON for the removed Save current/save-on-leave workflow.
- Do not reconstruct old strokes or Undo history after close/reopen.
- Do not retain editable JSON as an optional second durable source of truth.
- Reopening a cached real key loads its flattened pixels as a non-editable base and starts a fresh live editable overlay.
- Do not remove or weaken the in-memory state required by existing per-brush Undo.
- Do not apply this persistence change to Play canvas.

### Accepted contracts that remain closed
- The approved Clear transaction remains intact except for connecting it to the new pixel-first commit boundary; Clear and Delete remain distinct.
- Preserve absolute real-key positions, generated-frame render-only behavior, custom spacing, interpolation settings, real-key-only onion anchors, missing-frame backgrounds, and canonical preview/export projection.
- No backward-compatibility or legacy Roto persistence shims.

### Claude's Discretion
- Select the narrowest existing engine surface-copy API and controller/edit-buffer integration point after tracing the current implementation.
- Coalesce redundant captures only where it preserves the locked per-frame revision semantics.
- Delete obsolete Roto-only save code rather than retaining competing paths.

### Deferred Ideas (OUT OF SCOPE)

None specified in CONTEXT.md.
</user_constraints>

**Researched:** 2026-07-14
**Domain:** Preact/Tauri Canvas 2D mutation transactions, asynchronous frame caching, and project persistence
**Confidence:** HIGH

## Summary

The current engine already separates the non-editable preview base from live dry/display paint surfaces, and `exportCompositeCanvas()` already copies rendered paint pixels rather than simulating strokes. The unsuitable part is the Roto wrapper `exportTransparentStrokeCanvas()`: it switches background mode and reloads serialized engine state, which invokes redraw/replay behavior. The narrow fix is to expose an engine method that copies only the live dry/display surfaces and to notify the application after completed mutations. [VERIFIED: codebase inspection — `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts`, `packages/efx-physic-paint/src/render/canvas.ts`, `app/src/components/physic-paint/roto/rotoCanvasFrames.ts`]

Automatic persistence should be an event-driven controller transaction, not a render effect or save queue. Each mutation captures `{sourceFrame, revision, baseFrame, liveAlphaCanvas}` at transaction start. Encoding and cached-base composition may finish asynchronously, but the controller accepts the result only if that frame's revision remains current. Accepted results alone call the existing real-key upsert/removal store core, which already regenerates interpolation and invalidates timeline, onion, preview, export, and project serialization consumers. [VERIFIED: codebase inspection — `useRotoFrameEditingController.ts`, `physicsPaintRotoAlphaMerge.ts`, `physicPaintStore.ts`, `previewRenderer.ts`, `exportRenderer.ts`]

The old Roto Save current/save-on-leave path should be deleted rather than adapted: it serializes editable engine JSON, uses a global in-flight save, blocks navigation/close, and waits for bridge acknowledgements. Play persistence must retain its separate editable-state and save workflows. [VERIFIED: codebase inspection — `useRotoSaveController.ts`, `useRotoPersistenceIntegration.ts`, `useRotoNavigationCoordinator.ts`, `useRotoCloseLifecycle.ts`, `types/physicPaint.ts`, `physicPaintStore.ts`]

**Primary recommendation:** Add a completed-mutation/live-alpha engine seam, route it into a frame-local latest-wins Roto cache transaction, and remove only the obsolete Roto save/save-on-leave and durable editable-JSON paths.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Detect completed paint mutations | Physics Paint engine | Preact wrapper | The engine knows when deferred stroke finalization, Undo, Clear, and physics drying have actually changed pixels. [VERIFIED: codebase inspection] |
| Copy live alpha pixels | Physics Paint engine | — | The engine owns dry/display canvases and can exclude preview-base/background surfaces without replay. [VERIFIED: codebase inspection] |
| Bind source frame and revision | Roto controller transaction | Session/edit buffer | Frame identity is application state, while revisions must remain independent of component rendering. [VERIFIED: codebase inspection; architecture recommendation] |
| Add cached base to live overlay | Roto raster helper | Roto controller | The existing helper already performs base-first source-over composition. [VERIFIED: codebase inspection] |
| Accept/reject asynchronous results | Roto controller transaction | — | Rejection must occur before any store mutation or project invalidation. [VERIFIED: locked CONTEXT.md decision] |
| Persist real-key pixels and regenerate derived frames | `physicPaintStore` | Persistence adapter | Existing real-key upsert/remove methods own cache metadata, interpolation regeneration, and visual invalidation. [VERIFIED: codebase inspection] |
| Render timeline/onion/preview/export | Existing derived consumers | `physicPaintVersion` signal | Consumers already project store frames and react to accepted visual changes. [VERIFIED: codebase inspection] |
| Persist editable Play state | Existing Play coordinator/store path | Project serializer | Play intentionally retains editable state and is outside this Roto-only change. [VERIFIED: CONTEXT.md and codebase inspection] |

## Project Constraints (from CLAUDE.md)

- Use the project-local GSD installation under `.claude/gsd-core`. [VERIFIED: project `CLAUDE.md`]
- Do not run the application server. [VERIFIED: project `CLAUDE.md`]
- Execute Vitest with `vitest run`; never use watch mode. [VERIFIED: project `CLAUDE.md`]
- Treat the application as Preact, not React; prefer existing Preact-native patterns. [VERIFIED: project `CLAUDE.md`]
- Prefer Signals for shared/fine-grained reactive state, but do not refactor unrelated hooks. [VERIFIED: project `CLAUDE.md`]
- Do not introduce `useEffect` for internal mutation control flow when an event handler, regular function, Signal, or service/controller transaction is sufficient. [VERIFIED: project `CLAUDE.md`]
- Reuse nearby utilities and abstractions; keep the change proportional and avoid mixing state-management approaches without reason. [VERIFIED: project `CLAUDE.md`]

## Standard Stack

No external package installation is needed. Use the repository's existing workspace stack. [VERIFIED: codebase inspection]

### Core

| Library / API | Version | Purpose | Why Standard Here |
|---------------|---------|---------|-------------------|
| Preact | `^10.28.4` | Mounted Studio and controller hooks | Existing application framework. [VERIFIED: `app/package.json`] |
| `@preact/signals` | `^2.8.1` | Visual/project invalidation | `physicPaintVersion` already provides consumer invalidation; revision bookkeeping itself should be a controller-owned `Map`, not render state. [VERIFIED: `app/package.json`, codebase inspection] |
| `@efxlab/efx-physic-paint` | workspace `0.1.0` | Live paint engine and Canvas 2D surfaces | Engine owns the mutation-completion and direct-pixel-copy boundaries. [VERIFIED: workspace package manifests and codebase inspection] |
| Canvas 2D API | Browser native | Copy/merge alpha rasters and PNG encoding | Existing cache and merge path already uses canvases and `toDataURL('image/png')`. [VERIFIED: codebase inspection] |
| Vitest | `^2.1.9` | Engine, controller, mounted, store, renderer, persistence regressions | Existing test framework and mandated runner. [VERIFIED: `app/package.json`, project `CLAUDE.md`] |

### Supporting

| Library / API | Version | Purpose | When to Use |
|---------------|---------|---------|-------------|
| Tauri API | `^2.10.1` | Existing standalone-window bridge and close lifecycle | Preserve Play bridge flows; remove obsolete Roto apply/save waiting without broad bridge refactoring. [VERIFIED: `app/package.json`, codebase inspection] |
| pnpm | `10.27.0` | Workspace commands | Use filtered app/package commands from repository root. [VERIFIED: root `package.json`, environment probe] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Controller-owned `Map<number, number>` revisions | Signal/state revisions | Signals would expose transaction bookkeeping to rendering and create unnecessary reactive coupling. [VERIFIED: architecture analysis constrained by project `CLAUDE.md`] |
| Completed-mutation callback | Pointer-up or `useEffect` observation | Pointer-up precedes deferred stroke finalization; effects cannot reliably bind the exact source frame and pixel revision. [VERIFIED: codebase inspection] |
| Direct dry/display copy | `exportTransparentStrokeCanvas()` | Current wrapper toggles background mode and reloads serialized state, causing redraw/replay work forbidden by the task. [VERIFIED: codebase inspection] |
| Independent frame commits | Global promise queue | A global queue unnecessarily serializes unrelated frames and reproduces navigation blocking. [VERIFIED: CONTEXT.md and codebase inspection] |

**Installation:** None.

## Package Legitimacy Audit

Not applicable: this phase installs no external packages. All named packages already exist in the workspace manifests. [VERIFIED: `package.json`, `app/package.json`, `packages/efx-physic-paint/package.json`]

## Architecture Patterns

### System Architecture Diagram

```text
Native pointer / engine command
          |
          v
EfxPaintEngine mutation
  |-- deferred paint/erase --> finalizeNextPendingStroke -> applyFinalizedStroke
  |-- Undo -----------------> restore snapshot
  |-- Clear ----------------> clear live surfaces/state
  `-- Last/All physics -----> stopPhysics -> forceDryAll
          |
          v
completed-mutation notification
          |
          v
Roto live-cache controller (only in Roto + editable real key)
  1. fix sourceFrame
  2. increment/read frame-local revision
  3. copy live alpha dry+display pixels
  4. bind cached base for this source/revision
          |
          +---------------- empty/removal transaction ----------------+
          |                                                            |
          v                                                            v
base exists? -- yes --> mergeCachedRotoAlphaFrame                remove candidate
     | no                 (async image decode + encode)                 |
     v                                                                  |
encode live frame (may be async)                                        |
          |                                                            |
          +-----------------------+------------------------------------+
                                  v
                   revision still latest for sourceFrame?
                         | no                 | yes
                         v                    v
                  discard silently      store upsert/remove
                  no invalidation             |
                                              v
                              regenerate derived interpolation
                              bump physicPaintVersion/project dirty
                                              |
                                              v
                     timeline / onion / preview / export / project PNG
```

[VERIFIED: codebase inspection and locked CONTEXT.md transaction rules]

### Recommended Project Structure

Keep changes within existing modules; do not create a new state framework. [VERIFIED: project conventions]

```text
packages/efx-physic-paint/src/
├── engine/EfxPaintEngine.ts                 # mutation completion + direct live-alpha copy
├── preact.tsx                               # narrow callback prop/listener wiring
└── engine/*.test.ts                         # engine boundary RED tests (new focused file if needed)

app/src/components/physic-paint/
├── hooks/useRotoFrameEditingController.ts   # invoke mutation/revision transactions
├── roto/physicsPaintRotoAlphaMerge.ts       # retain additive base + overlay helper
├── roto/rotoCanvasFrames.ts                 # replace replaying transparent export usage
├── roto/[revision transaction module].ts    # pure frame-local latest-wins core if extraction keeps tests narrow
├── PhysicsPaintStudio.tsx                   # remove save-only wiring; connect callback
└── view/PhysicsPaintWorkflowStrip.tsx       # remove Save current and save-on-leave copy

app/src/
├── stores/physicPaintStore.ts               # pixel-only Roto accepted commit; preserve Play JSON
├── types/physicPaint.ts                     # remove editableState from Roto apply contract
└── lib/physicPaintRotoDurableCore.test.ts   # mounted/native durable regression path
```

### Pattern 1: Engine-Owned Completed Mutation Notification

**What:** Notify only after pixels have reached their completed mutation state. Paint and erase notify after `applyFinalizedStroke`; Undo and Clear notify after their synchronous surface changes; Last/All physics notify after `stopPhysics()` completes drying. [VERIFIED: codebase inspection]

**When to use:** Every mutation that can change the durable Roto flattened result. Do not notify from pointer-down intent, pointer-up enqueueing, animation ticks, or component effects. [VERIFIED: codebase inspection and locked CONTEXT.md decision]

```ts
// Recommended shape; exact naming is implementation discretion.
type PaintMutationKind = 'paint' | 'erase' | 'undo' | 'clear' | 'physics';

type CompletedPaintMutation = {
  kind: PaintMutationKind;
  isEmpty: boolean;
};

// Invoke after the engine surface mutation has completed.
this.onCompletedMutation?.({ kind: pending.tool, isEmpty: this.actions.length === 0 });
```

[VERIFIED: architecture recommendation grounded in `EfxPaintEngine.ts`]

### Pattern 2: Frame-Local Revision Acceptance

**What:** Use a non-reactive controller-owned revision map. Increment before capture, bind all inputs to that revision, and check again immediately before the store mutation. [VERIFIED: locked CONTEXT.md decision]

```ts
const revisions = new Map<number, number>();

function beginRevision(frame: number): number {
  const revision = (revisions.get(frame) ?? 0) + 1;
  revisions.set(frame, revision);
  return revision;
}

function isLatest(frame: number, revision: number): boolean {
  return revisions.get(frame) === revision;
}

async function commitCapturedMutation(input: CapturedMutation) {
  const rendered = input.baseFrame
    ? await mergeCachedRotoAlphaFrame(input.baseFrame, input.liveAlphaCanvas, input.frame, input.size)
    : encodeLiveAlphaFrame(input.liveAlphaCanvas, input.frame, input.size);

  if (!isLatest(input.frame, input.revision)) return { accepted: false };
  physicPaintStore.upsertRealRotoKeyFrame(input.layerId, rendered, input.background);
  return { accepted: true };
}
```

[VERIFIED: architecture recommendation constrained by existing merge/store APIs]

### Pattern 3: Pixel Commit Without Resetting Editability

**What:** Update durable flattened cache and launch/session cache projection without clearing, loading, or replacing the live engine overlay. The accepted commit is a durability snapshot, not a new editable-session baseline. [VERIFIED: locked CONTEXT.md decision and current Undo-over-base architecture]

**When to use:** After every accepted non-empty live mutation. This preserves per-brush Undo even after one or more automatic cache updates. [VERIFIED: CONTEXT.md]

### Anti-Patterns to Avoid

- **Capture on pointer-up:** final stroke pixels may still be pending in `pendingStrokeFinalizations`. Capture after finalization instead. [VERIFIED: codebase inspection]
- **Reuse `exportTransparentStrokeCanvas()`:** it changes background mode and restores serialized state, which can redraw/replay and perturb active Undo/session state. [VERIFIED: codebase inspection]
- **Reset engine after accepted cache:** this would erase live action/Undo history and incorrectly turn each automatic commit into an editable baseline. [VERIFIED: architecture analysis]
- **Read `currentFrame` after awaiting:** navigation may have changed it; carry the source frame in the transaction closure. [VERIFIED: locked CONTEXT.md decision]
- **Global save/capture queue:** unrelated frames must commit independently. [VERIFIED: CONTEXT.md]
- **Invalidate before acceptance:** stale captures must not regenerate interpolation, bump `physicPaintVersion`, or dirty the project. [VERIFIED: CONTEXT.md]
- **Delete `_editableStates` globally:** Play uses editable state and must remain unchanged. [VERIFIED: codebase inspection and CONTEXT.md]
- **Drive persistence from `useEffect`:** it obscures transaction ownership and creates dependency/rerender races. [VERIFIED: project `CLAUDE.md`; architecture analysis]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cached-base composition | Stroke replay or custom blend simulator | `mergeCachedRotoAlphaFrame()` | Existing raster base-first/source-over merge matches the accepted repaint contract. [VERIFIED: codebase inspection] |
| Derived-frame refresh | Separate interpolation invalidation pipeline | Existing real-key store upsert/remove core | It already regenerates interpolation and performs one visual/project invalidation. [VERIFIED: codebase inspection] |
| Preview/export projection | A new Roto renderer | Existing `PreviewRenderer`/`ExportRenderer` store projection | Both already consume canonical Roto frames and `physicPaintVersion`. [VERIFIED: codebase inspection] |
| Cancellation framework | Abort controllers or timers | Revision comparison at commit boundary | The contract explicitly requires latest-wins without cancellation, timers, or polling. [VERIFIED: CONTEXT.md] |
| Persisted Undo reconstruction | Stroke JSON migration or replay | Fresh live overlay over flattened cached base | Reopen intentionally starts without old Undo history. [VERIFIED: CONTEXT.md] |

**Key insight:** This task changes when durable pixels are sampled and accepted; it should not create a second renderer, persistence model, or state machine. [VERIFIED: architecture synthesis]

## Removal and Preservation Matrix

| Area | Action | Notes |
|------|--------|-------|
| `useRotoSaveController.ts` | Remove or reduce until no Roto manual/save-on-leave render/apply flow remains | Its global in-flight promise, editable-state serialization, and bridge apply workflow conflict with independent live commits. [VERIFIED: codebase inspection] |
| `useRotoPersistenceIntegration.ts` | Replace Roto save integration with live-cache transaction wiring | Preserve unrelated Play coordination. [VERIFIED: codebase inspection] |
| `useRotoApplyLifecycle.ts` / `useRotoApplyResultController.ts` | Remove Roto save acknowledgement state no longer needed | Do not remove bridge result handling still used by Play or other workflows. [VERIFIED: codebase inspection] |
| `useRotoNavigationCoordinator.ts` | Remove save-before-navigation blocking/queuing | Navigation becomes non-blocking; source identity is held by each transaction. [VERIFIED: CONTEXT.md] |
| `useRotoCloseLifecycle.ts` | Remove dirty Roto save-before-close decision path | Closing does not serialize editable Roto JSON; pending captures are not a reason to block navigation/close. [VERIFIED: CONTEXT.md] |
| `PhysicsPaintWorkflowStrip.tsx` | Remove `Save current`, saving/dirty-save copy, and obsolete pending-save controls | Keep timeline, interpolation, key utilities, and Play controls. [VERIFIED: codebase inspection] |
| `physicsPaintStudioKeyboard.ts` | Remove Roto Cmd/Ctrl+S and Cmd/Ctrl+Enter manual-save routing | Preserve Play save/update keyboard behavior. [VERIFIED: codebase inspection] |
| `PhysicsPaintStudio.tsx` | Remove Roto save-only refs/disabled conditions and connect completed mutation | Keep in-memory engine/session state and Play save machinery. [VERIFIED: codebase inspection] |
| `PhysicPaintApplyCanvasPayload.editableState` | Remove from Roto apply/commit contract | Retain editable state in Play payloads. [VERIFIED: codebase inspection and CONTEXT.md] |
| `physicPaintStore.applyCanvas()` Roto `_editableStates` write | Remove | Supply `rotoBackground` explicitly instead of deriving it from editable JSON. [VERIFIED: codebase inspection] |
| `.mce` `editable_state` emission | Gate to Play-owned state only | Do not emit a Roto editable-state second source of truth. [VERIFIED: codebase inspection and CONTEXT.md] |
| General standalone `Save state` / `Load state` debug session controls | Preserve unless proven Roto-cache-specific | These are separate explicit engine-session file controls, not the obsolete Roto Save current workflow. [VERIFIED: codebase inspection] |
| Existing Clear transaction | Preserve behavior; add revision/removal ordering | Clear and Delete remain distinct. [VERIFIED: CONTEXT.md] |

## Common Pitfalls

### Pitfall 1: Capturing Before Deferred Finalization
**What goes wrong:** The cache contains the previous surface or misses the just-finished brush/eraser stroke. [VERIFIED: codebase inspection]
**Why it happens:** `onPointerUp()` queues a pending finalization; `finalizeNextPendingStroke()` later applies pixels. [VERIFIED: codebase inspection]
**How to avoid:** Notify after `applyFinalizedStroke()` and test through the mounted native canvas callback. [VERIFIED: architecture recommendation]
**Warning signs:** A stroke appears live but only enters cache after the next mutation. [ASSUMED]

### Pitfall 2: Treating Automatic Commit as Session Reset
**What goes wrong:** Undo stops at the most recent commit instead of traversing all new live brushes over the cached base. [VERIFIED: architecture analysis]
**Why it happens:** Reloading the accepted flattened cache into the engine destroys or replaces live action history. [VERIFIED: engine/session behavior inspection]
**How to avoid:** Commit a copied raster while leaving engine dry/display/action/Undo state untouched. [VERIFIED: architecture recommendation]
**Warning signs:** Undo after two automatically committed brushes removes neither or only the last cache snapshot. [ASSUMED]

### Pitfall 3: Late Result Uses Current Navigation State
**What goes wrong:** Frame A's encoded pixels overwrite frame B after navigation. [VERIFIED: locked CONTEXT.md hazard]
**Why it happens:** Async completion reads mutable `currentFrame`, current reference base, or current launch cache instead of bound transaction values. [VERIFIED: architecture analysis]
**How to avoid:** Bind source frame, revision, base raster, background metadata, layer, and size before asynchronous work starts. [VERIFIED: CONTEXT.md]
**Warning signs:** Rapid painting/navigation produces a cache on the wrong cell. [ASSUMED]

### Pitfall 4: Removal Loses to an Older Non-Empty Capture
**What goes wrong:** Clear, final Undo, key removal, or Delete appears to succeed and then an older capture resurrects pixels. [VERIFIED: locked CONTEXT.md hazard]
**Why it happens:** Removal does not advance the same revision counter as non-empty commits. [VERIFIED: architecture analysis]
**How to avoid:** Every empty/removal transaction increments the source frame's revision before applying removal. [VERIFIED: CONTEXT.md]
**Warning signs:** Cleared content reappears after image decode or encoding completes. [ASSUMED]

### Pitfall 5: Stale Work Still Invalidates Consumers
**What goes wrong:** Project dirty state, interpolation regeneration, timeline renders, or previews update for a discarded capture. [VERIFIED: locked CONTEXT.md hazard]
**Why it happens:** Store upsert starts before the latest-revision check. [VERIFIED: architecture analysis]
**How to avoid:** Perform the final revision check immediately before the first store mutation. [VERIFIED: CONTEXT.md]
**Warning signs:** `physicPaintVersion` increments more often than accepted commits. [VERIFIED: codebase-based test oracle]

### Pitfall 6: Roto JSON Removal Breaks Play
**What goes wrong:** Play scripts can no longer be edited or updated after project reload. [VERIFIED: codebase inspection]
**Why it happens:** `_editableStates` or `editable_state` is removed globally instead of being gated by workflow ownership. [VERIFIED: architecture analysis]
**How to avoid:** Make the contract change Roto-specific and retain existing Play payload/store/serialization tests. [VERIFIED: CONTEXT.md]
**Warning signs:** Play project round-trip tests fail despite Roto tests passing. [ASSUMED]

## Code Examples

### Direct Alpha Surface Copy

```ts
// Recommended engine API shape based on the existing exportCompositeCanvas implementation.
exportLiveAlphaCanvas(): HTMLCanvasElement {
  this.flushPendingStrokeFinalizations();
  this.renderVisibleWetLayer();

  const canvas = document.createElement('canvas');
  canvas.width = this.width;
  canvas.height = this.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not copy live paint pixels.');

  context.clearRect(0, 0, this.width, this.height);
  context.drawImage(this.dualCanvas.dryCanvas, 0, 0);
  context.drawImage(this.dualCanvas.displayCanvas, 0, 0);
  return canvas;
}
```

This deliberately does not draw `previewBaseCanvas`, switch `bgMode`, call `redrawAll()`, save/load serialized state, or replay actions. [VERIFIED: architecture recommendation based on existing engine surfaces]

### Accepted Commit Boundary

```ts
const revision = beginRevision(sourceFrame);
const liveAlphaCanvas = engine.exportLiveAlphaCanvas();
const boundBase = reference.cachedRepaintBaseFrame?.appFrame === sourceFrame
  ? reference.cachedRepaintBaseFrame
  : null;

const renderedFrame = boundBase
  ? await mergeCachedRotoAlphaFrame(boundBase, liveAlphaCanvas, sourceFrame, canvasSize)
  : buildRotoFrameFromCanvas(liveAlphaCanvas, sourceFrame, canvasSize);

if (!isLatest(sourceFrame, revision)) return;

// First externally visible mutation occurs only after acceptance.
physicPaintStore.upsertRealRotoKeyFrame(layerId, renderedFrame, rotoBackground);
```

[VERIFIED: architecture recommendation based on current APIs and locked ordering]

## State of the Art

| Old Approach | Required Approach | Impact |
|--------------|-------------------|--------|
| Manual `Save current` and save-on-leave | Automatic cache after completed mutation | Durability follows actual pixel changes without explicit user action. [VERIFIED: CONTEXT.md] |
| Serialize engine state, render/export, bridge apply | Copy already-rendered alpha surfaces and commit pixels | Avoids a second render/replay and removes Roto editable JSON durability. [VERIFIED: codebase inspection and CONTEXT.md] |
| Global in-flight Roto save and blocked navigation | Independent per-frame latest-wins revisions | Navigation remains non-blocking and unrelated frames do not serialize each other. [VERIFIED: codebase inspection and CONTEXT.md] |
| Roto editable JSON plus flattened cache | Flattened alpha PNG as sole durable Roto truth | Reopen uses non-editable base plus fresh live overlay. [VERIFIED: CONTEXT.md] |

**Deprecated/outdated for Roto:**
- `Save current`, save pending, dirty-save-on-leave, close-saving, and Roto apply acknowledgement machinery. [VERIFIED: task contract and codebase inspection]
- Roto `editableState` transport and `_editableStates` persistence. [VERIFIED: task contract and codebase inspection]
- `exportTransparentStrokeCanvas()` for live cache commits. [VERIFIED: codebase inspection]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `^2.1.9` [VERIFIED: `app/package.json`] |
| Config file | Existing Vite/Vitest project configuration; do not add one-off config. [VERIFIED: repository conventions] |
| Quick run command | `pnpm --dir app exec vitest run <focused test files>` [VERIFIED: environment/package scripts] |
| Full suite command | `pnpm --dir app exec vitest run` [VERIFIED: project `CLAUDE.md`] |
| Engine package checks | `pnpm --filter @efxlab/efx-physic-paint check && pnpm --filter @efxlab/efx-physic-paint build` [VERIFIED: package scripts] |
| App typecheck | `pnpm --dir app typecheck` [VERIFIED: `app/package.json`] |

### Mandatory Behavior → Test Map

| # | Behavior | Test Layer | Recommended Location | RED Assertion |
|---|----------|------------|----------------------|---------------|
| 1 | Paint commits only after finalization | engine unit | focused `EfxPaintEngine` mutation test | no callback at pointer enqueue; callback after finalized pixels [VERIFIED: required coverage synthesis] |
| 2 | Erase commits after finalization | engine unit | same | copied alpha reflects erase [VERIFIED: required coverage synthesis] |
| 3 | Undo triggers new capture/removal | engine + controller | engine test and revision test | accepted result matches restored pixels [VERIFIED: required coverage synthesis] |
| 4 | Clear uses accepted removal boundary | mounted/controller | durable core + Clear baseline tests | cache removed; older capture cannot restore it [VERIFIED: CONTEXT.md] |
| 5 | Last/All physics commits after stop | engine unit | engine action test | callback follows `forceDryAll`, not start/ticks [VERIFIED: codebase inspection] |
| 6 | Copy excludes preview base/background | engine canvas unit | engine export test | output contains dry/display alpha only [VERIFIED: codebase inspection] |
| 7 | Copy performs no replay/state restore | engine unit/spies | engine export test | no `redrawAll`, `load`, or background mutation [VERIFIED: task contract] |
| 8 | Mounted native mutation reaches cache/store | mounted integration | `physicPaintRotoDurableCore.test.ts` | engine callback updates real-key cache without clicking Save [VERIFIED: closest test inspection] |
| 9 | Existing cached base is retained additively | raster + mounted | `physicsPaintRotoAlphaMerge.test.ts`, durable core | base pixel remains beneath new overlay [VERIFIED: existing helper contract] |
| 10 | Undo all live brushes returns original base | mounted integration | durable core/session tests | final cache/base equals pre-edit flattened key [VERIFIED: CONTEXT.md] |
| 11 | Same-frame latest result wins | pure revision unit | new/extracted transaction test | delayed revision N cannot overwrite N+1 [VERIFIED: CONTEXT.md] |
| 12 | Different frames commit independently | pure revision unit | transaction test | delayed A does not block accepted B [VERIFIED: CONTEXT.md] |
| 13 | Navigation cannot retarget capture | mounted/controller | durable core | source A result never writes frame B [VERIFIED: CONTEXT.md] |
| 14 | Removal beats pending non-empty result | pure + mounted | transaction/Clear test | clear/delete revision rejects older PNG [VERIFIED: CONTEXT.md] |
| 15 | Stale result has no invalidation | store/controller | transaction/store test | no `physicPaintVersion` increment or interpolation regeneration [VERIFIED: CONTEXT.md] |
| 16 | Accepted real key reaches interpolation/onion/timeline | mounted/store | durable core + store tests | derived consumers observe only accepted frame [VERIFIED: codebase inspection] |
| 17 | Preview/export use accepted flattened cache | renderer integration | `previewRenderer.test.ts`, `exportRenderer.test.ts` | canonical output uses updated Roto frame [VERIFIED: codebase inspection] |
| 18 | Project round trip stores flattened PNG only | persistence integration | `physicPaintPersistence.test.ts`, store tests | PNG/cache metadata round-trip; no Roto editable JSON [VERIFIED: codebase inspection] |
| 19 | Reopen starts fresh live overlay/Undo | mounted integration | durable core | cached base visible; old actions unavailable; new brush Undo works [VERIFIED: CONTEXT.md] |
| 20 | Obsolete Roto save UI/blocking gone; Play unchanged | mounted/UI integration | durable core + Studio tests | no Save current/save-on-leave flow; Play render/update and editable state still pass [VERIFIED: task contract] |

### Sampling Rate

- **Per implementation task:** run the focused files changed by that task with `pnpm --dir app exec vitest run ...`. [VERIFIED: project testing constraint]
- **After engine seam:** run package check/build plus focused app integration tests. [VERIFIED: package scripts]
- **Quick-task gate:** run full app `vitest run`, app typecheck, and engine check/build before presenting native UAT. [VERIFIED: project conventions and task contract]
- **Do not run the application server.** [VERIFIED: project `CLAUDE.md`]

### Wave 0 Gaps

- [ ] Focused engine mutation-completion/direct-alpha-copy test file; current app tests do not directly prove native engine finalization callbacks. [VERIFIED: codebase test inspection]
- [ ] Pure revision transaction tests with controllable deferred merge/encode completion. [VERIFIED: codebase test inspection]
- [ ] Extend `physicPaintRotoDurableCore.test.ts` mock engine/canvas to emit a completed mutation instead of clicking `Save current`. [VERIFIED: codebase test inspection]
- [ ] Replace store assertions that expect Roto editable state while retaining explicit Play editable-state round-trip assertions. [VERIFIED: codebase test inspection]

## Minimal Implementation Sequence

### Task 1 — RED engine and revision seams
1. Add failing engine tests for paint, erase, Undo, Clear, physics completion, and alpha-only surface copy. [VERIFIED: test-gap analysis]
2. Add failing pure tests for source binding, same-frame latest-wins, cross-frame independence, removal precedence, and no stale invalidation. [VERIFIED: CONTEXT.md]
3. Implement the narrow engine callback/listener and direct dry/display copy API; implement the controller-owned revision primitive without store side effects. [VERIFIED: architecture recommendation]

### Task 2 — Automatic accepted pixel commits and durable schema cleanup
1. Wire completed engine mutations through `useRotoFrameEditingController` or a focused extracted live-cache controller. [VERIFIED: existing controller responsibility]
2. Bind base/live/source/revision, retain `mergeCachedRotoAlphaFrame()`, and gate store upsert/remove immediately before mutation. [VERIFIED: existing APIs and CONTEXT.md]
3. Keep accepted commits from resetting engine/session Undo state. [VERIFIED: CONTEXT.md]
4. Remove Roto editable JSON from payload, store writes, and `.mce` output while preserving explicit background metadata and all Play state. [VERIFIED: codebase inspection]
5. Convert mounted durable tests to automatic mutation commits and prove derived consumers/project round-trip. [VERIFIED: test-gap analysis]

### Task 3 — Delete obsolete Roto save UX and lifecycle machinery
1. Remove Save current, pending-save controls/status copy, Roto save keyboard shortcuts, navigation blocking, and dirty close-save flow. [VERIFIED: codebase inspection]
2. Delete Roto-only save refs/controllers/result handling that have no remaining caller; do not retain competing compatibility paths. [VERIFIED: CONTEXT.md]
3. Preserve Play render/update/save, Play editable state, key utilities, Clear/Delete distinction, interpolation, onion, timeline, preview, and export contracts. [VERIFIED: CONTEXT.md]
4. Run focused tests, full app `vitest run`, typecheck, and engine package checks/build; then stop and present native UAT without starting the server. [VERIFIED: task and project constraints]

## Native UAT Checklist to Present After Automated Verification

1. Open Physics Paint in Roto mode on an empty real key; paint one brush and confirm its timeline/cache state updates without pressing Save. [VERIFIED: task acceptance intent]
2. Paint a second brush, Undo once, then Undo again; confirm only new live brushes are removed and the frame becomes empty. [VERIFIED: CONTEXT.md]
3. Open an existing cached real key; confirm the flattened base is visible, paint two new brushes, Undo both, and confirm the exact original base remains. [VERIFIED: CONTEXT.md]
4. Paint and immediately navigate to another real key; confirm navigation is not blocked and the source frame receives its own result. [VERIFIED: CONTEXT.md]
5. Rapidly mutate the same frame, including Undo/Clear, and confirm an older pending image never reappears. [VERIFIED: CONTEXT.md]
6. Confirm generated interpolation, onion anchors, timeline cells, parent preview, and export reflect the latest accepted real-key pixels. [VERIFIED: task contract]
7. Save and reopen the project; confirm flattened Roto pixels persist, old Roto brush Undo history does not, and new brushes can be undone normally. [VERIFIED: CONTEXT.md]
8. Confirm `Save current`, dirty-save-on-leave messaging, and save-blocked navigation/close behavior are absent in Roto. [VERIFIED: task contract]
9. Switch to Play; confirm Render/Update/save behavior and project round-trip remain unchanged. [VERIFIED: CONTEXT.md]
10. Confirm Clear remains distinct from Delete and accepted Phase 36.13 spacing/onion/absolute-position behavior is unchanged. [VERIFIED: CONTEXT.md]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | pnpm, Vitest, TypeScript, builds | Yes | `v24.15.0` | None needed. [VERIFIED: environment probe] |
| pnpm | Workspace tests/builds | Yes | `10.27.0` | None needed. [VERIFIED: environment probe and root manifest] |
| Browser Canvas 2D | Engine and mounted canvas tests | Test environment already supplies existing mocks/polyfills | Repository-defined | Extend existing test harness; do not add a package. [VERIFIED: existing tests/codebase inspection] |
| Application server | Native UAT only | Intentionally not started by agent | — | User runs it. [VERIFIED: project `CLAUDE.md`] |

**Missing dependencies with no fallback:** None identified. [VERIFIED: environment audit]

**Missing dependencies with fallback:** None identified. [VERIFIED: environment audit]

## Security Domain

This is a local rendering/persistence transaction change. Authentication, sessions, remote access control, and cryptographic controls are not introduced. [VERIFIED: scoped codebase inspection]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | No | No authentication boundary in this task. [VERIFIED: scope inspection] |
| V3 Session Management | No | Engine editing session is local application state, not an authentication session. [VERIFIED: scope inspection] |
| V4 Access Control | No new control | Existing Tauri/project access boundaries remain unchanged. [VERIFIED: scope inspection] |
| V5 Input Validation | Yes | Preserve real-key/editable-mode guards; bind frame/layer/size/background from trusted controller state and reject stale revisions. [VERIFIED: codebase and CONTEXT.md] |
| V6 Cryptography | No | No cryptographic operation is added. [VERIFIED: scope inspection] |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stale async overwrite of another frame | Tampering | Per-frame monotonic revision and source identity captured before await. [VERIFIED: CONTEXT.md] |
| Cleared/deleted pixels resurrected by late result | Tampering | Increment revision for removal and accept store mutation only if latest. [VERIFIED: CONTEXT.md] |
| Unintended durable editable-state disclosure/bloat | Information Disclosure | Do not transport or serialize Roto engine JSON; retain only flattened pixels and explicit metadata. [VERIFIED: CONTEXT.md] |
| Excessive global serialization/blocking | Denial of Service | Independent frame transactions; no global queue, timers, or polling. [VERIFIED: CONTEXT.md] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A visible symptom of early capture may be that a stroke appears only after the next mutation. | Common Pitfalls | Low; test should assert exact callback/pixel timing rather than symptom alone. |
| A2 | A visible symptom of session reset may be broken multi-brush Undo after automatic commits. | Common Pitfalls | Low; mandatory mounted Undo tests directly verify the contract. |
| A3 | Rapid navigation may visibly put pixels on the wrong timeline cell if source identity is read late. | Common Pitfalls | Low; source-binding tests directly cover it. |
| A4 | Cleared pixels may visibly reappear after delayed image work if removal does not advance revision. | Common Pitfalls | Low; controlled deferred tests directly cover it. |
| A5 | Play round-trip failures are the likely warning sign of overly broad editable-state removal. | Common Pitfalls | Medium; explicit Play regression tests are required regardless of symptom. |

## Open Questions

1. **Should the engine expose one callback property, listener subscription, or command return metadata?**
   - What we know: the Preact wrapper currently exposes engine-ready/native-input callbacks but no completed-mutation event. [VERIFIED: codebase inspection]
   - What's unclear: the smallest type/API shape after implementation-level inspection of all engine constructors and package exports. [VERIFIED: bounded implementation question]
   - Recommendation: use one optional completed-mutation callback/listener with no Preact state dependency; avoid a general event bus. [VERIFIED: architecture recommendation]

2. **Should redundant physics/display notifications be coalesced?**
   - What we know: the user permits coalescing only if per-frame revision semantics remain intact. [VERIFIED: CONTEXT.md]
   - What's unclear: whether any existing engine command emits multiple completed boundaries for one user-visible transaction. [VERIFIED: bounded implementation question]
   - Recommendation: implement correctness first; coalesce only synchronously within a single known engine transaction, never across frames or with timers. [VERIFIED: CONTEXT.md]

3. **Can the old Roto bridge `apply-canvas` variant be deleted completely?**
   - What we know: the old Roto save path uses it, while Play has distinct payload kinds. [VERIFIED: codebase inspection]
   - What's unclear: whether any non-Roto caller still constructs `kind: 'apply-canvas'`. [VERIFIED: final implementation grep required]
   - Recommendation: perform an exact caller audit during Task 3 and delete the variant if no preserved caller remains; do not leave a legacy shim. [VERIFIED: CONTEXT.md]

## Sources

### Primary (HIGH confidence)
- Project `CLAUDE.md` — Preact, Signals, test runner, and no-server constraints. [VERIFIED: codebase inspection]
- Quick-task `260714-ail-CONTEXT.md` — locked product and ordering decisions. [VERIFIED: project planning artifact]
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` — mutation timing, Undo/Clear/physics, export surface. [VERIFIED: codebase inspection]
- `packages/efx-physic-paint/src/render/canvas.ts` — preview-base/dry/display canvas separation. [VERIFIED: codebase inspection]
- `app/src/components/physic-paint/hooks/useRotoFrameEditingController.ts` — current edit, Undo, Clear, snapshot boundaries. [VERIFIED: codebase inspection]
- `app/src/components/physic-paint/roto/rotoCanvasFrames.ts` — current transparent export replay/state-restore path. [VERIFIED: codebase inspection]
- `app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.ts` — accepted additive raster composition. [VERIFIED: codebase inspection]
- `app/src/stores/physicPaintStore.ts` — real-key upsert/remove, interpolation, invalidation, editable-state persistence. [VERIFIED: codebase inspection]
- `app/src/lib/previewRenderer.ts`, `exportRenderer.ts`, `physicPaintPersistence.ts` — canonical consumers and PNG project persistence. [VERIFIED: codebase inspection]
- Existing tests listed in Validation Architecture — current harnesses and gaps. [VERIFIED: codebase inspection]

### Secondary (MEDIUM confidence)
- None required; this is an internal architecture/refactor task governed by repository code and locked project decisions. [VERIFIED: research scope]

### Tertiary (LOW confidence)
- Symptom-only warning signs listed in the Assumptions Log. [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing workspace only; no package recommendation or installation. [VERIFIED: package manifests]
- Architecture: HIGH — mutation, surface, merge, store, consumer, and persistence paths were traced in code and constrained by locked decisions. [VERIFIED: codebase inspection]
- Pitfalls: HIGH for transaction hazards; LOW only for explicitly marked visible symptom predictions. [VERIFIED: CONTEXT.md and Assumptions Log]
- Validation: HIGH — closest unit, mounted, store, renderer, and persistence test suites were identified. [VERIFIED: codebase test inspection]

**Research date:** 2026-07-14
**Valid until:** 2026-08-13, or until the Roto controller/store architecture changes materially.
