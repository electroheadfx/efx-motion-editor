# Quick Task 260715-kgf: Functional Physics Paint Roto Copy Script / Apply Script - Research

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Copy and navigation handoff
- Temporarily block new source input only for the handoff duration.
- Await every already accepted queued or actively finalizing mutation through its normal cooperative `CompletedPaintMutation` path.
- Snapshot the final source script only after that drain completes, then complete Copy Script or navigation.
- Never force a synchronous flush or cancel accepted work.
- Resume input immediately after Copy Script; navigation remains protected through the destination transition.

### Multi-brush Apply progress
- Queue copied brushes in script order through the normal accepted-mutation pipeline.
- Report progress as completed brushes out of total brushes, not merely queued brushes.
- Scope progress to a distinct Apply operation identity and its expected mutation IDs so unrelated native painting, stale completions, or another operation cannot increment it.
- Protect input and navigation for the Apply operation until all copied brushes complete or the operation is explicitly cancelled.
- Report success only after the final expected brush completes. Each brush remains its own normal Undo/Redo transaction.

### True empty destination ownership
- Prepare the accepted Phase 36.13 destination target/spacing transaction before replay.
- Make the true empty destination a durable real key with the first accepted replay brush.
- If zero replay brushes are accepted, do not publish ownership and leave the frame truly empty.
- If a later brush fails after earlier brushes were accepted, retain the accepted partial result as normal independently undoable paint; do not claim full Apply success or publish ownership for unaccepted work.

### Temporary UAT UI
- Add `Copy Script` and `Apply Script` controls after Delete in the existing action row.
- Use current control styling with minimal layout changes.
- Expose native enabled/disabled behavior and reasons.
- Show one concise inline status such as `Copied 4`, `Applying 2/4`, `Applied 4`, or `Failed`.
- Leave detailed LOG presentation and the final visual redesign to Phase 36.14.

### Locked product and architecture constraints
- A script is an immutable deep copy of `EfxPaintEngine.getStrokes()` and is separate from real-key Copy/Paste.
- The clipboard is Studio-session-only and is never serialized, bridged, cached, or reconstructed from pixels.
- Generated and cached-only frames cannot be sources; generated destinations cannot be promoted or mutated.
- Apply is reusable and additive over cached alpha base plus the existing live overlay.
- Preserve every recorded stroke property and continuation relationship; current Motion values transform geometry deterministically using the destination real source frame.
- Add only the smallest engine API that submits an immutable recorded stroke through the existing cooperative mutation pipeline.
- Every replayed brush must update normal action history, publish `CompletedPaintMutation`, remain independently undoable/redoable, and obey existing Redo invalidation and stale-work protection.
- Use a focused Preact-native clipboard/controller or transaction boundary. Keep `PhysicsPaintStudio` as composition and wiring and expose a stable Phase 36.14 integration contract.
- Implement the mounted production path before finalizing regression tests. Automated success means ready for native UAT, not native completion.

### Claude's Discretion
- Exact module, signal, type, operation identity, mutation ID, disabled-reason, status, and error contract names may follow existing project conventions.
- Exact cancellation representation may follow existing navigation/disposal/generation invalidation boundaries, provided accepted work is not synchronously discarded and stale completion cannot publish over newer state.

### Deferred Ideas (OUT OF SCOPE)
- Phase 36.14 retains final UI fidelity, layout, accessibility, status/LOG presentation, selection protection, and integration polish.
</user_constraints>

## Summary

The implementation should be a narrow extension of the accepted engine mutation path, not a replay renderer. `EfxPaintEngine` already assigns mutation identity at acceptance, stores the immutable point payload immediately in `allActions`, creates one history entry per accepted brush, clears Redo on new acceptance, finalizes FIFO in cooperative turns, keeps queued outlines visible, rejects stale continuation turns with `strokeFinalizationGeneration`, and publishes `CompletedPaintMutation` only at its normal completion boundary. [VERIFIED: codebase `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts:179-220,1161-1262,1663-1726`] The missing engine seam is one public method that performs the same acceptance transaction for a supplied immutable recorded brush and returns its new mutation ID; it must not call `renderPartialStrokes`, `redrawAll`, `renderAllStrokes`, `flushPendingStrokeFinalizations`, or any cache/export path. [VERIFIED: codebase `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts:1028-1055,1188-1193,1802-1813`]

The Studio side should own a focused session controller containing the script clipboard, source binding, completion ledger, and one active Apply transaction. `PhysicsPaintStudio` should only wire engine completion events, current Roto source/display identity, persistence callbacks, navigation protection, and temporary view props. This matches the existing controller/port pattern used by `useRotoNavigationCoordinator`, `useRotoKeyUtilities`, and `createRotoSession`, while keeping the script clipboard separate from the existing `RotoSessionCopiedKey`. [VERIFIED: codebase `app/src/components/physic-paint/hooks/useRotoNavigationCoordinator.ts:25-82`; `app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts:51-93`; `app/src/components/physic-paint/roto/physicsPaintRotoSession.ts:86-114`]

**Primary recommendation:** add `EfxPaintEngine.enqueueRecordedStroke(...) -> mutationId`, extract the existing held-pose geometry transform into a pure exported helper, and implement a session-only `useRotoScriptClipboardController` that drains via observed completion IDs, applies sequentially, and delegates every accepted completion to the existing automatic live-pixel cache publication. [VERIFIED: codebase seam analysis]

## Project Constraints (from CLAUDE.md)

- Use the project-local GSD installation under `.claude/gsd-core`; do not run the application server. [VERIFIED: codebase `CLAUDE.md:1-4`]
- Use `vitest run` only; never use Vitest watch mode. [VERIFIED: codebase `CLAUDE.md:6-10`]
- This is Preact, not React; prefer existing Preact Signals/controller patterns and avoid effect-driven control flow or new state abstractions unless needed. [VERIFIED: codebase `CLAUDE.md:12-129`]
- Preserve nearby conventions and do not refactor unrelated code. [VERIFIED: codebase `CLAUDE.md:117-129`]
- Use pnpm; the workspace pins pnpm 10.27.0. [VERIFIED: codebase `package.json:3`; environment `pnpm --version` = 10.27.0]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Accept one replay brush | Physics engine module | Studio controller | Engine alone owns mutation IDs, history, FIFO continuations, previews, and completion publication. [VERIFIED: codebase `EfxPaintEngine.ts:179-220,1663-1726`] |
| Script clipboard and Apply operation | Browser/client session controller | Studio wiring | Clipboard is ephemeral UI-session state and must not enter store, bridge, cache, or serialization. [VERIFIED: CONTEXT locked decision; codebase existing session controller pattern] |
| Source/display eligibility and true-empty target | Roto model/controller | Persistence coordinator | `rotoSourceDisplayModel` owns source/display projection and Phase 36.13 spacing; persistence owns durable real-key publication. [VERIFIED: codebase `rotoSourceDisplayModel.ts:28-97`; `useRotoFramePersistenceCoordinator.ts:74-112`] |
| Pixel publication | Roto persistence coordinator | Parent bridge/store | Completed engine mutations already trigger alpha capture, latest-write-wins commit, store refresh, generated-frame refresh, and parent payload delivery. [VERIFIED: codebase `PhysicsPaintStudio.tsx:458-495`; `useRotoFramePersistenceCoordinator.ts:74-132`] |
| Temporary controls/status | Workflow strip view | Studio view model | Existing key utility row and status stack are the minimal UAT surface. [VERIFIED: codebase `PhysicsPaintWorkflowStrip.tsx:538-546`; `PhysicsPaintStudio.tsx:505-515`] |

## Current Contracts and Exact Seams

### 1. Engine acceptance, history, cooperative finalization

- Native pointer acceptance occurs in `onPointerUp`: allocate `nextMutationId`, deep-freeze points, append a `PaintStroke` to `allActions`, clear `redoStack`, create a deferred history entry, cap Undo at exactly 10, enqueue finalization, and return without rasterizing synchronously. [VERIFIED: codebase `EfxPaintEngine.ts:1663-1726`]
- FIFO completion advances at most one continuation step after visible compositing, waits for drawing/input inactivity, preserves active work across pointerdown, and draws queued outlines until raster publication. [VERIFIED: codebase `EfxPaintEngine.ts:1070-1089,1136-1185`; regression `EfxPaintEngine.cooperativeFinalization.contract.red.test.ts:438-503`]
- `completeActiveStrokeFinalization` clears the history entry's deferred payload and then publishes `CompletedPaintMutation` with the accepted mutation ID. Generation mismatch prevents stale active work from publishing. [VERIFIED: codebase `EfxPaintEngine.ts:1222-1262`; regression `EfxPaintEngine.cooperativeFinalization.contract.red.test.ts:396-409`]
- Undo identifies the logical transaction by mutation ID, removes the accepted action and trailing grouped actions, cancels queued/active work safely when necessary, restores snapshots for finalized work, and publishes restored pixels only after restoration. Redo restores the same transaction; a fresh native acceptance invalidates Redo. [VERIFIED: codebase `EfxPaintEngine.ts:736-810,1710-1718`; regressions `EfxPaintEngine.cooperativeFinalization.contract.red.test.ts:149-353`; `EfxPaintEngine.liveAlphaCache.test.ts:156-270`]

**Smallest engine interface:**

```ts
// Recommended public interface; exact name is discretionary.
enqueueRecordedStroke(stroke: Readonly<PaintStroke>): number
```

The method should clone the supplied stroke, ignore its copied `mutationId`, allocate a new accepted mutation ID, preserve `tool`, points, color, params, timestamp, `hasPenInput`, `physicsMode`, `playFrame`, and deterministic continuation metadata, then execute the same acceptance helper used by `onPointerUp`. [VERIFIED: codebase `PaintStroke` shape at `packages/efx-physic-paint/src/types.ts:169-180`; acceptance path at `EfxPaintEngine.ts:1681-1726`] Refactor only the acceptance block into one private helper so pointer and replay cannot drift; do not expose queue internals. [VERIFIED: codebase seam analysis]

### 2. Physics continuation ownership

`allActions` can contain a visible brush followed by a zero-point `diffusionFrames` continuation. The exact Undo/Redo baseline groups that trailing continuation with the preceding mutation-bearing brush, preserves order in both directions, and does not replay finalized history. [VERIFIED: regression `EfxPaintEngine.cooperativeFinalization.contract.red.test.ts:149-173,263-299`] Serialization preserves `diffusionFrames`, and replay applies it only after the corresponding action is complete. [VERIFIED: codebase `EfxPaintEngine.ts:1046-1052,1807-1810,1839-1857`]

**Implementation requirement:** normalize the immutable `getStrokes()` snapshot into logical brush groups before Apply: a point-bearing accepted stroke owns immediately trailing zero-point continuation actions until the next point-bearing stroke. Preserve their relative order and metadata. [VERIFIED: codebase representation and accepted history regression] The engine submission should append the cloned primary and its normalized continuation metadata atomically to the same history entry, while only the primary enters the raster queue; completion must occur after its continuation work. [VERIFIED: codebase history invariant `EfxPaintEngine.ts:65-70,736-810`] Do not submit continuation records as independent Apply progress units. [VERIFIED: CONTEXT “completed brushes out of total brushes” plus grouped-history baseline]

### 3. Completion ledger, Copy drain, and Apply progress

`getStrokes()` already returns a deep copy of points and params, including accepted-but-not-yet-finalized actions. [VERIFIED: codebase `EfxPaintEngine.ts:1010-1017`] Therefore Copy/navigation must not treat the snapshot itself as proof of completion. The controller should maintain a session ledger of mutation IDs observed through the mounted `onCompletedMutation` callback. At handoff, lock input, snapshot the current mutation-bearing IDs from `getStrokes()`, wait until every ID is in the completion ledger, then call `getStrokes()` again for the immutable clipboard snapshot. [VERIFIED: codebase completion wiring `preact.tsx:39-56`; Studio callback `PhysicsPaintStudio.tsx:458-495`]

For Apply, allocate `operationId`, enqueue one logical brush at a time in script order, record each returned mutation ID in `expectedMutationIds`, and advance `completed/total` only when `onCompletedMutation` matches both the active operation and an uncompleted expected ID. [VERIFIED: existing operation-ID precedent `useRotoFramePersistenceCoordinator.ts:92-103`; CONTEXT locked decision] Sequential enqueueing is recommended: enqueue the next brush only after the prior expected completion. This naturally preserves continuation order, bounds queued memory, makes partial failure explicit, and still uses the cooperative pipeline. [VERIFIED: codebase FIFO semantics and CONTEXT partial-failure rule]

Cancellation/disposal should mark the operation inactive and prevent further enqueueing; it must continue accepting completion/cache publication for already accepted IDs. [VERIFIED: CONTEXT locked cancellation rule] Never overwrite `EfxPaintCanvas`'s single completion listener; route the existing Studio callback first through the script controller, then through the unchanged Roto live-cache handler. [VERIFIED: codebase `preact.tsx:55`; `PhysicsPaintStudio.tsx:458-495`]

### 4. Deterministic Motion transform

`AnimationPlayer.applyWiggle` currently implements the accepted held-pose behavior: clamp percentages, derive a stable seed from stroke index/timestamp/color/point count, quantize to two-frame held poses, apply whole-stroke Move offsets, apply per-point Deform offsets, and return a cloned stroke preserving non-point metadata. [VERIFIED: codebase `AnimationPlayer.ts:227-249,268-280,355-386`; regressions `AnimationPlayer.test.ts:469-516`]

Extract the smallest pure helper from this implementation, for example:

```ts
transformRecordedStrokeForHeldPose(
  stroke: Readonly<PaintStroke>,
  input: { destinationSourceFrame: number; strokeIndex: number; deformation: number; position: number },
): PaintStroke
```

Use the **destination real source frame**, not the display frame or generated owner, as the pose input. Preserve timestamp, tool, color, params, pressure/tilt/twist/speed, play metadata, physics mode, and continuation metadata; only point `x/y` changes. [VERIFIED: CONTEXT locked decision; source/display identity `rotoTimelineSelectors.ts:29-55`; transform implementation `AnimationPlayer.ts:245-248`] Keep zero Motion as an identity-preserving fast path. [VERIFIED: regression `AnimationPlayer.test.ts:469-480`]

### 5. Roto source/display and true-empty transaction

- Eligibility comes from `currentFrameSelectionKind`: `real-key`, `generated-interpolation`, or `empty`; generated displays are input-disabled and must remain render-only. [VERIFIED: codebase `rotoTimelineSelectors.ts:16-27,58-90`; `PhysicsPaintStudio.tsx:173-177,440-443`]
- A cached-only reference is not an editable script source because cached pixels are loaded as a non-editable preview base and editable stroke state is not reconstructed. [VERIFIED: codebase `useRotoReferenceController` usage at `PhysicsPaintStudio.tsx:177,247-260`; project decision in `.planning/STATE.md:121`]
- Phase 36.13's canonical empty-target transaction is `saveRotoRealKeyTransaction`/`resolveRotoRealKeySaveTarget`; it preserves absolute source identity and distant/custom spacing overrides. [VERIFIED: codebase `rotoKeyTransactions.ts:38-46`; `rotoSourceDisplayModel.ts:60-97`; regression `rotoSourceDisplayModel.test.ts:33-69,103-115`]

For a true-empty destination, compute this transaction before replay but do not publish it yet. On the first successful `enqueueRecordedStroke`, bind the Apply to `sourceFrameOverride`/`target.displayFrame` and pass its interpolation settings into the normal first completed-mutation cache capture. Zero accepted brushes must discard the prepared transaction. [VERIFIED: CONTEXT locked decision; existing empty-save integration `PhysicsPaintStudio.tsx:461-490`]

### 6. Cached base, live overlay, and publication

The first edit intent marks the live overlay dirty and removes the cached preview base from engine display without deleting the durable cached frame; Undo of the last overlay action returns ownership to the cached base. [VERIFIED: codebase `useRotoFrameEditingController.ts:91-129`; `rotoEditBufferTransactions.ts:33-63`] Every completed mutation captures live alpha, additively merges the matching cached base, and commits through per-source revision checks. [VERIFIED: codebase `PhysicsPaintStudio.tsx:478-490`; `useRotoFramePersistenceCoordinator.ts:114-132`; `rotoLivePixelCacheTransactions.ts:18-57`] The commit updates the store, interpolation/generated frames, launch context, confirmed cache, and parent bridge payload; later revisions suppress stale writes. [VERIFIED: codebase `useRotoFramePersistenceCoordinator.ts:74-112`; `rotoLivePixelCacheTransactions.ts:29-49`]

Apply must reuse this callback unchanged. Do not capture pixels directly in the script controller and do not wait for parent bridge delivery to count a brush as engine-completed; engine progress and cache/bridge delivery are separate concerns. Final functional success should require all expected engine completions and no enqueue failure, while existing cache publication remains observable through its own error path. [VERIFIED: codebase separation `PhysicsPaintStudio.tsx:458-495`; CONTEXT progress definition]

### 7. Separate clipboard and Preact controller shape

The existing real-key clipboard is `copiedKeyRef`/`RotoSessionCopiedKey`, reset through `resetSession`, and copied/pasted as cached-frame transactions. [VERIFIED: codebase `useRotoKeyUtilities.ts:52-93`; `physicsPaintRotoSession.ts:16-19,157-183`] The script clipboard must be a separate ref/signal owned by a new focused controller and absent from `PhysicPaintLaunchContext`, `physicPaintStore`, bridge payloads, engine save/load, and key-session reset. [VERIFIED: CONTEXT locked decision; current persistence surfaces]

Recommended controller interface:

```ts
{
  clipboard: Signal<RotoPaintScript | null>;
  state: Signal<ScriptOperationState>;
  availability: Signal<ScriptActionAvailability>;
  copyScript(): Promise<boolean>;
  applyScript(): Promise<boolean>;
  observeCompletedMutation(mutation: CompletedPaintMutation): void;
  prepareNavigation(targetFrame: number): Promise<boolean>;
  dispose(): void;
}
```

Use Signals/computed for cross-view availability/status and refs/maps for mutable completion ledgers and operation internals. Avoid a web of `useEffect`; perform copy/apply/navigation transitions through explicit controller actions. [VERIFIED: project Preact guidance; codebase `createRotoSession` Signals pattern]

## Recommended Task Decomposition

1. **Engine tracer:** extract the native acceptance helper and add `enqueueRecordedStroke`; prove new identity, immutable cloning, FIFO completion, one history entry, 10-level cap, Redo invalidation, queued preview, generation guard, and grouped continuation behavior. [VERIFIED: codebase seams above]
2. **Pure Motion seam:** extract held-pose transform from `AnimationPlayer` and reuse it from both playback and script Apply; prove destination-source-frame determinism and metadata preservation. [VERIFIED: codebase `AnimationPlayer.ts:227-249`]
3. **Script controller:** implement session clipboard, source binding/refresh/freeze, completion ledger, operation identity, expected IDs, sequential Apply, partial failure, cancellation/disposal, and input/navigation protection. [VERIFIED: CONTEXT locked decisions]
4. **Roto integration:** wire source eligibility, Phase 36.13 prepared target, first-accept ownership, cached-base additivity, and existing completed-mutation cache publication without duplicating persistence logic. [VERIFIED: codebase `PhysicsPaintStudio.tsx:458-495`]
5. **Temporary UAT surface:** add Copy Script and Apply Script after Delete, disabled reasons, and one concise inline status through the existing workflow view-model seam. [VERIFIED: codebase `PhysicsPaintWorkflowStrip.tsx:538-546`]
6. **Mounted-path regressions and gates:** add focused behavior tests after production wiring, then run immutable baseline tests, package/app typechecks, package build, and native UAT A–M. [VERIFIED: CONTEXT completion boundary]

## Pitfalls / Do Not Hand-Roll

- **Do not use synchronous flush APIs:** `save`, `load`, `getCanvas`, `exportCompositeCanvas`, `renderAllStrokes`, and `flushPendingStrokeFinalizations` can force synchronous completion and violate the handoff decision. [VERIFIED: codebase `EfxPaintEngine.ts:881-918,934-944,1028-1032,1188-1193`]
- **Do not use playback rendering as mutation ownership:** `renderPartialStrokes` resets/replays surfaces and does not create accepted mutation history. [VERIFIED: codebase `EfxPaintEngine.ts:1039-1055`]
- **Do not preserve copied mutation IDs:** IDs identify destination acceptance/history and Apply progress; copied source IDs belong only to clipboard provenance. [VERIFIED: codebase mutation identity usage `EfxPaintEngine.ts:48-70,736-810`]
- **Do not count queue acceptance as completion:** live alpha is authoritative only after the normal completion callback. [VERIFIED: codebase `EfxPaintEngine.ts:1252-1262`; `PhysicsPaintStudio.tsx:458-490`]
- **Do not publish the true-empty key before first acceptance:** otherwise a zero-brush/failed Apply creates false durable ownership. [VERIFIED: CONTEXT locked decision]
- **Do not let unrelated completion events advance Apply:** match operation state plus expected mutation ID and de-duplicate repeated IDs. [VERIFIED: CONTEXT locked decision]
- **Do not replace the real-key clipboard:** script reuse and pixel-key Copy/Paste have different data, eligibility, persistence, and lifecycle contracts. [VERIFIED: codebase existing clipboard plus CONTEXT]
- **Do not mutate generated destinations or use display frame as durable identity:** retain source/display separation and Phase 36.13 spacing. [VERIFIED: codebase `rotoTimelineSelectors.ts`; `rotoSourceDisplayModel.ts`]

## Focused Regression Matrix

| # | Behavior / gate | Primary test location |
|---|---|---|
| 1 | `getStrokes()` clipboard is deeply immutable | new script-controller test + existing engine API |
| 2 | Real editable source copies; cached-only/generated/true-empty source rejects with reason | new controller test + `rotoTimelineSelectors.test.ts` |
| 3 | Copy locks input only during drain and resumes immediately | new mounted/controller test |
| 4 | Navigation drains accepted work, freezes clipboard, then transitions | new controller/navigation test |
| 5 | Drain waits queued and active IDs through normal completion; no flush/cancel | new engine/controller integration test |
| 6 | Source-bound clipboard refreshes after native completion, Undo, and Redo | new controller test using completion events |
| 7 | Bound source becoming empty clears clipboard; disposal clears session state | new controller test |
| 8 | Enqueue clones supplied data and allocates a fresh mutation ID | `EfxPaintEngine` test |
| 9 | Script order is FIFO and queued outlines remain represented | `EfxPaintEngine.cooperativeFinalization...test.ts` extension |
| 10 | Trailing physics continuation remains attached and ordered with its brush | same engine contract test |
| 11 | Each brush publishes one expected `CompletedPaintMutation` | engine/controller integration test |
| 12 | Apply progress is completed/total; unrelated/stale/duplicate completions are ignored | controller test |
| 13 | Apply protects input/navigation until success or explicit cancellation | controller/mounted test |
| 14 | Repeated Apply reuses the same clipboard and adds paint | mounted Studio test |
| 15 | Every replay brush is independently Undoable/Redoable within exact 10-level cap | engine test + immutable Undo/Redo baseline |
| 16 | Fresh accepted replay invalidates Redo | engine test |
| 17 | Prepared true-empty target remains empty when zero brushes are accepted | controller/Roto transaction test |
| 18 | First accepted brush claims true-empty target with exact Phase 36.13 spacing | controller + `rotoSourceDisplayModel.test.ts` |
| 19 | Later enqueue failure retains accepted partial work and reports Failed | controller/mounted test |
| 20 | Motion uses destination real source frame, held deterministically; Move preserves spacing and metadata | pure transform + `AnimationPlayer.test.ts` |
| 21 | Cached-base additive live alpha, revision LWW, timeline/generated/preview/export publication | persistence tests + mounted Studio test |
| 22 | Temporary buttons appear after Delete with native disabled state/reasons and concise status | `PhysicsPaintWorkflowStrip.test.ts` + Studio view-model test |

**Immutable baseline gates:** keep green `EfxPaintEngine.cooperativeFinalization.contract.red.test.ts`, `EfxPaintEngine.liveAlphaCache.test.ts`, `AnimationPlayer.test.ts`, `rotoLivePixelCacheTransactions.test.ts`, `rotoEditBufferTransactions.test.ts`, `rotoSourceDisplayModel.test.ts`, `rotoTimelineSelectors.test.ts`, `physicsPaintRotoSession.test.ts`, and `PhysicsPaintStudio.test.ts`. [VERIFIED: codebase existing tests]

## Validation Architecture

| Property | Value |
|---|---|
| Framework | Vitest 2.1.9 in app workspace [VERIFIED: codebase `app/package.json:44-48`] |
| Existing config | `app/vitest.config.ts` [VERIFIED: codebase] |
| Focused engine run | `pnpm --filter efx-motion-editor exec vitest run ../packages/efx-physic-paint/src/engine/EfxPaintEngine.cooperativeFinalization.contract.red.test.ts ../packages/efx-physic-paint/src/engine/EfxPaintEngine.liveAlphaCache.test.ts ../packages/efx-physic-paint/src/animation/AnimationPlayer.test.ts` |
| Focused app run | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts src/components/physic-paint/roto/rotoSourceDisplayModel.test.ts src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts` |
| Full app suite | `pnpm --filter efx-motion-editor exec vitest run` |
| Static gates | `pnpm --filter @efxlab/efx-physic-paint check && pnpm --filter @efxlab/efx-physic-paint build && pnpm --filter efx-motion-editor typecheck` |

Wave 0 should add one engine submission contract test and one pure script-controller test file before the mounted wiring slice; do not create a new Vitest config. [VERIFIED: project instructions and existing config]

## Security Domain

| ASVS Category | Applies | Control |
|---|---|---|
| V2 Authentication | No | Local desktop session; no authentication surface in this task. [VERIFIED: task scope/codebase] |
| V3 Session Management | Yes, local operation lifecycle | Operation identity, disposal cancellation, and session-only clipboard prevent stale cross-launch publication. [VERIFIED: CONTEXT locked decision] |
| V4 Access Control | Yes, workflow eligibility | Reject generated/cached-only sources and generated destinations at controller and view availability seams. [VERIFIED: codebase selection model plus CONTEXT] |
| V5 Input Validation | Yes | Validate finite frame IDs, normalized Motion percentages, non-empty logical brushes, and active expected mutation IDs before state transitions. [VERIFIED: existing normalization patterns `rotoSourceDisplayModel.ts:115-117`; `AnimationPlayer.ts:268-271`] |
| V6 Cryptography | No | No secrets or cryptographic data. [VERIFIED: task scope] |

Primary threats are stale completion/state confusion (Tampering), wrong source/display identity (Tampering), and unbounded duplicate completion/progress updates (Denial of Service/state corruption). Mitigate with operation IDs, expected-ID sets, source-bound revisions, generation checks, and idempotent completion handling. [VERIFIED: existing codebase patterns and CONTEXT]

## Environment Availability

| Dependency | Available | Version | Notes |
|---|---:|---:|---|
| Node.js | Yes | 24.15.0 | Local runtime probe. [VERIFIED: environment] |
| pnpm | Yes | 10.27.0 | Matches repository pin. [VERIFIED: environment and `package.json`] |
| Vitest | Yes | 2.1.9 | Existing app dev dependency; use run mode. [VERIFIED: `app/package.json`] |
| TypeScript | Yes | 5.9.3 | Existing workspace dependency. [VERIFIED: package manifests] |

No external package installation is required; no package-legitimacy audit is needed. [VERIFIED: codebase-only design]

## Open Risks

1. **Continuation representation is partly legacy/implicit.** Zero-point `diffusionFrames` actions are grouped by ordering rather than an explicit parent ID. The implementation should centralize logical-brush grouping and test malformed leading continuations instead of spreading assumptions across controller and engine. [VERIFIED: codebase `EfxPaintEngine.ts:677-688`; grouped-history regression]
2. **The current completion listener is singular.** Script tracking must compose inside the existing Studio callback, not install a competing engine listener. [VERIFIED: codebase `EfxPaintEngine.ts:215,608-610`; `preact.tsx:55`]
3. **Undo/Redo reuses the brush mutation ID.** The source clipboard refresh ledger must treat each completion event as a new source revision even when the mutation ID repeats; the live-pixel cache already does this correctly. [VERIFIED: codebase `EfxPaintEngine.ts:771,796,808`; regression `rotoLivePixelCacheTransactions.test.ts:154-176`]
4. **Automatic cache publication is asynchronous after engine completion.** Native UAT must verify preview/timeline/export visibility after cache/bridge settling, while Apply progress itself remains tied to engine completions. [VERIFIED: codebase async capture `rotoLivePixelCacheTransactions.ts:32-56`; parent queue `useRotoFramePersistenceCoordinator.ts:42-59`]

## Confidence and Sources

**Overall confidence: HIGH.** This is codebase-only implementation research against current accepted tests and production symbols; no external package or fast-moving API claim is involved. [VERIFIED: codebase]

### Primary sources
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` — mutation acceptance, history, continuations, completion, replay, cache capture hooks.
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.cooperativeFinalization.contract.red.test.ts` — immutable cooperative/Undo/Redo baselines.
- `packages/efx-physic-paint/src/animation/AnimationPlayer.ts` and `.test.ts` — deterministic held-pose Move/Deform.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — mounted completion-to-cache publication and wiring seam.
- `app/src/components/physic-paint/roto/rotoSourceDisplayModel.ts` and tests — source/display identity and Phase 36.13 target/spacing.
- `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts` and `rotoLivePixelCacheTransactions.ts` — cached-base merge, revision guards, automatic publication.
- `app/src/components/physic-paint/roto/physicsPaintRotoSession.ts` and `useRotoKeyUtilities.ts` — separate real-key clipboard and Preact Signals/controller precedent.

## Assumptions Log

All prescriptive recommendations are derived from locked CONTEXT decisions and verified current code seams. No training-only package, compliance, retention, or performance claim is used. [VERIFIED: research scope]
