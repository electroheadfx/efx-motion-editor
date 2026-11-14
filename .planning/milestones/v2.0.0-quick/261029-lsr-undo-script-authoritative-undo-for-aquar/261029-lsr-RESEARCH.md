# Quick Task 261029-lsr: Script-Authoritative Undo for Aquarelle Strokes — Research

**Researched:** 2026-10-29
**Domain:** Physic Paint aquarelle undo/redo (Preact signals + WebGL watercolor engine)
**Confidence:** HIGH on the seam, the snapshot machinery and the capture gates; MEDIUM on the deterministic pin shape (GPU pixels are not reachable under `vitest run`).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Unrecorded strokes**
- When a stroke was never recorded in the script (script recording OFF, or a raster
  Lift that pins/records nothing), undo stays **engine-only**: restore tiles via the
  existing `undoPaint()` path, no script mutation and no re-bake.
- Script-authoritative undo applies only to strokes that have a recorded script
  event. Never invent a script trace for recording-off paint.

**Re-bake scope/cost**
- Reuse the existing delete machinery: treat an undo of a recorded stroke as a
  **single-stroke delete edit** — `beginAquarelleDeleteEdit([mutationId])` style
  before/after script snapshots, reset the live sheet, re-apply through the shared
  Apply/re-bake path, and record it as one ledger command. Redo is the inverse
  snapshot swap.
- No dedicated lighter re-bake path and no second rendering authority.

**Capture guard**
- Add a **monotonic sheet/capture epoch** that is bumped on every script mutation
  (record, delete, move, undo, redo, reset).
- A capture records the epoch when it starts and **refuses its commit** if the epoch
  moved before the commit lands. Late acks and async merges must be dropped, never
  written into the frame's baked pixels.
- No settle/await barrier before undo: Cmd+Z must stay immediate.

**Undo stack shape**
- Recorded strokes **keep the `paint` ledger entry kind**; the entry carries (or can
  resolve) the script edit identity so undo/redo take the
  `aquarelleScriptHistory.replay` route instead of `undoPaint()`.
- Unrecorded paint entries keep the current `undoPaint()` / `redoPaint()` route.
- The stack model stays one ledger; do not fork a second script-authoritative stack.

### Claude's Discretion
- Exact epoch ownership (ref vs signal vs module counter) and where the check seats.
- Whether the edit identity is stored on the entry or resolved from `mutationId` at
  replay time (the latter keeps the entry shape untouched — prefer it if the
  recorded registry can answer reliably).
- How the deterministic pin measures "display digest == bake digest" using the
  existing `digestRenderedFrameBytes` helper from
  `performance/aquarelleRenderSplitCapture.ts`.

### Deferred Ideas (OUT OF SCOPE)
None recorded in CONTEXT.md.
</user_constraints>

## Summary

The bug is a two-authority split, not a missing feature. A recorded aquarelle stroke pushes a `paint` ledger entry that carries only a `mutationId`, and undo resolves it through `inputRef.current.undoPaint()` → the WatercolorEngine's framebuffer undo — never through the script store. The script keeps the stroke; the engine drops the pixels (or the reverse after a reset). Delete/move/place already solved this: they capture before/after `AquarelleScriptSnapshot`s, swap with a revision-authority guard, reset the live sheet, and re-bake through the one shared Apply path.

**Primary recommendation:** do not invent a new path. Add a *single-stroke undo edit* built with the existing `storeAquarelleEdit` + `restoreAquarelleEditSnapshot` machinery (constructed so `undo` installs the WITHOUT-stroke side), expose it on the existing `AquarelleScriptHistoryRoute` as `hasRecordedStroke` / `replayStroke`, and route the `paint` branch through it. Then close the capture hole with the epoch that already exists per key (`livePixelTransactions.invalidate`) plus a `aquarelleStrokesRevision` read at capture start and at commit.

**The one non-obvious finding:** `applyAquarelleTimeline` itself force-commits pending live-pixel captures at its first `await` — `await ports.flushSourcePublication?.(source.appFrame)` (`app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts:977`). Any epoch check placed *inside* the replay route but *after* that call is already too late. The invalidation must be synchronous, first line of `replay`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Decide undo routing (engine-only vs script) | Edit-history hook (`useRotoPhysicalEditHistory`) | — | It owns the one ledger; `paint` vs `aquarelle-script` is its decision |
| Script snapshot swap + authority guard | Script store (`aquarelleStrokeSelection` / `aquarelleRecordState`) | — | Pure module state; already the sole writer of the timeline |
| Re-bake + publish | Studio replay route (`PhysicsPaintStudio.aquarelleScriptHistory`) | Clipboard Apply (`applyAquarelleTimeline`) | Must reuse the shared Apply path — no second rendering authority |
| Live-sheet reset | Engine layer (`AquarelleCanvasLayer.resetSheet` → `engine.clear()`) | — | Engine owns its own framebuffer and history |
| Stale-capture rejection | Persistence coordinator + live-pixel transactions | Script store (`aquarelleStrokesRevision`) | The transaction already rejects on a per-key revision; the script epoch is the missing second dimension |
| Deterministic pin | Pure test module + source-contract row | — | WebGL cannot run under `vitest run` |

## Q1 — The seam: making a `paint` entry take the script route

The ledger entry is deliberately identity-free:

```ts
interface PaintBarrier {
  readonly kind: 'paint';
  readonly mutationId: number;
}
```
[VERIFIED: app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts:196-199]

The route it would need is already declared, and is currently editId-only:

```ts
export interface AquarelleScriptHistoryRoute {
  replay: (editId: number, direction: 'undo' | 'redo') => Promise<boolean>;
}
```
[VERIFIED: app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts:272-274]

Push site (stroke close): `appliedRef.current.push({ kind: 'paint', mutationId });` [VERIFIED: useRotoPhysicalEditHistory.ts:731]. Undo branch pops *before* calling the engine and reverts on failure — the only branch in the hook that mutates stacks optimistically:

```ts
    if (entry.kind === 'paint') {
      appliedRef.current.pop();
      redoRef.current.push(entry);
      const changed = inputRef.current.undoPaint();
      if (!changed) {
```
[VERIFIED: useRotoPhysicalEditHistory.ts:944-948]

The `aquarelle-script` branch is the correct template — replay first, move stacks only on `true`:

```ts
      const replayed = await route.replay(entry.editId, 'undo');
      if (!replayed) return false;
      const top = appliedRef.current[appliedRef.current.length - 1];
      if (top !== entry) return false;
      appliedRef.current.pop();
```
[VERIFIED: useRotoPhysicalEditHistory.ts:935-939]

**Contract for the planner.** Extend the route rather than the entry:

```ts
export interface AquarelleScriptHistoryRoute {
  replay: (editId: number, direction: 'undo' | 'redo') => Promise<boolean>;
  /** 261029-lsr: true when this mutation id has a live recorded stroke. */
  hasRecordedStroke: (mutationId: number) => boolean;
  /** 261029-lsr: undo/redo one recorded stroke as a script edit + re-bake. */
  replayStroke: (mutationId: number, direction: 'undo' | 'redo') => Promise<boolean>;
}
```

`paint` branch becomes: `hasRecordedStroke(mutationId)` true → `await replayStroke(...)`, move stacks only on `true`; false → the existing `undoPaint()` path unchanged. Redo branch (1098-1110) mirrors it. This satisfies the locked decision "unrecorded strokes stay engine-only" without touching the entry shape.

**Is `mutationId` the recorded registry id?** Yes, same value end to end: `allocateStrokeMutation` result (`PhysicsPaintStudio.tsx:7053`) → `recordAquarelleStrokeWhenEnabled(recordsScript, mutationId, { ...stroke, mutationId }, capturedKeyId)` (`PhysicsPaintStudio.tsx:7082`) → `recordedStrokes.set(mutationId, recorded)` (`aquarelleRecordState.ts:1177`, inside `recordAquarelleStroke`). The `paint` barrier is pushed from `observePaintMutation(mutationId, kind)` via the completion port, i.e. the same ledger id. [VERIFIED: PhysicsPaintStudio.tsx:7053, 7082; useRotoPhysicalEditHistory.ts:196-199, 705]

**Predicate.** `getRecordedAquarelleStroke(mutationId) !== undefined && !isAquarelleStrokeDeleted(mutationId)` — both exported:
```ts
export function getRecordedAquarelleStroke(
  mutationId: number,
): AquarelleStroke | undefined {
  return recordedStrokes.get(mutationId);
}
```
[VERIFIED: aquarelleRecordState.ts:1488-1492] · `export function isAquarelleStrokeDeleted(mutationId: number): boolean { return deletedAquarelleStrokeIds.has(mutationId); }` [VERIFIED: aquarelleRecordState.ts:523-525]

`recordAquarelleStrokeWhenEnabled` returns `false` without recording when the Script switch is off — so recording-off strokes fail the predicate and keep engine-only undo by construction. [VERIFIED: aquarelleRecordState.ts:1202-1204]

## Q2 — Edit identity: build the undo edit, do not delete-and-reuse

The delete machinery lives in `aquarelleStrokeSelection.ts` (not `aquarelleRecordState.ts`, which CONTEXT.md's canonical-refs line implies). Snapshot shape:

```ts
export interface AquarelleScriptSnapshot {
  readonly timeline: readonly AquarellePayloadEvent[];
  readonly deleted: readonly number[];
  readonly registry: AquarelleStrokeRegistrySnapshot;
  revision: number;
}
```
[VERIFIED: app/src/components/physic-paint/view/aquarelleStrokeSelection.ts:488-493]

`revision` is the one mutable field — the swap writes the post-swap revision back into the installed side so the opposite direction can validate against it. Edit store is a monotonic id + 10-entry cap (`const MAX_AQUARELLE_EDITS = 10;` [VERIFIED: aquarelleStrokeSelection.ts:501]; `storeAquarelleEdit` 568-577).

The authority guard:

```ts
  const target = direction === 'undo' ? edit.before : edit.after;
  const liveSide = direction === 'undo' ? edit.after : edit.before;
  if (aquarelleStrokesRevision.value !== liveSide.revision) return null;
  const revert = captureAquarelleSnapshot();
  target.revision = applySnapshotContent(target);
  return revert;
```
[VERIFIED: aquarelleStrokeSelection.ts:736-741]

`applySnapshotContent` restores registry → deleted membership → timeline splice → bump → selection prune, in that order (the comment at 546-552 explains why). `restoreAquarelleSnapshotRaw` is the unguarded rollback for a failed re-bake (748-750).

**Direction trap (the main design risk).** `beginAquarelleDeleteEdit` captures `before` = WITH stroke, `after` = WITHOUT. Calling `restoreAquarelleEditSnapshot(editId, 'undo')` on such an edit installs `before` — it *re-adds* the stroke. A paint undo must *remove* it. So a straight reuse of the delete builder inverts the operation.

**Recommended construction — `beginAquarelleStrokeUndoEdit(mutationId)` in `aquarelleStrokeSelection.ts`, next to `beginAquarelleDeleteEdit` (598-616):**

```ts
// after = the live script WITH the stroke (revision R)
// before = the same content MINUS this stroke, revision also R (never installed as-is)
export function beginAquarelleStrokeUndoEdit(mutationId: number): number | null {
  if (aquarelleScriptEditInFlight) return null;
  if (getRecordedAquarelleStroke(mutationId) === undefined) return null;
  if (isAquarelleStrokeDeleted(mutationId)) return null;
  const after = captureAquarelleSnapshot();
  const timeline = after.timeline.filter(
    (event) => (event.engine as AquarelleStrokePayload).mutationId !== mutationId,
  );
  if (timeline.length === after.timeline.length) return null; // no engine id → not script-owned
  const before: AquarelleScriptSnapshot = {
    timeline,
    deleted: [...after.deleted, mutationId],
    registry: after.registry,   // shared by reference, exactly like a capture pair
    revision: after.revision,   // R; overwritten on install, only read for the redo check
  };
  return storeAquarelleEdit({ before, after });
}
```

Why this is safe against the guard: the live revision is still `R`, `edit.after.revision` is `R`, so the immediate `restoreAquarelleEditSnapshot(editId, 'undo')` passes and installs the WITHOUT side; `applySnapshotContent` then writes the fresh `R+1` into `edit.before.revision`, which is exactly what redo compares against later. Symmetric with how delete behaves. No direction inversion, no revision-relabel hack, no live mutation before the swap.

**Do not use `deleteAquarelleStrokesFromScript` to build the edit.** It mutates live state and bumps the revision (1061-1063), which would invalidate the guard on the very next line.

**Edit identity storage.** CONTEXT prefers resolving from `mutationId` at replay time, and the registry answers reliably (Q1 predicate). Keep a `Map<number, number>` (mutationId → editId) inside the replay-route closure so a second undo of an already-undone stroke can find its edit for redo; build the edit lazily on the first undo. Entry shape stays `{ kind: 'paint', mutationId }`.

## Q3 — The re-bake path, and what is missing from it

Current route (lines 4737-4754):

```ts
      replay: async (editId, direction) => {
        const revert = restoreAquarelleEditSnapshot(editId, direction);
        if (revert === null) return false;
        const playFrame = launchContextRef.current?.startFrame ?? 0;
        aquarelleResetSheetRef.current?.();
        const ok = await rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame));
        if (!ok) {
          restoreAquarelleSnapshotRaw(revert);
          return false;
        }
        rotoScript.notifySourceRevision();
        applyFrameModuleState(playFrame);
        return true;
      },
```
[VERIFIED: app/src/components/physic-paint/PhysicsPaintStudio.tsx:4738-4752]

The delete handler does the same four steps **plus** one predecessor the route lacks:

```ts
        const playFrame = launchContextRef.current?.startFrame ?? 0;
        // 261028-k03d: recover a legacy key's missing durable base BEFORE the
        // edit changes the script, or the publish fails closed.
        await ensureAquarelleDurableBaseRef.current(playFrame);
        aquarelleResetSheetRef.current?.();
        const ok = await rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame));
```
[VERIFIED: PhysicsPaintStudio.tsx:7124-7129]

All six delete/move/place/transform handlers call `ensureAquarelleDurableBaseRef` first (7127, and the move/place/transform siblings at 7212 / 7283 / 7365 region — same pattern). **The replay route does not.** Reusing the route for paint undo therefore inherits a possible fail-closed `durable-base-unknown` on any key whose durable base was never pinned. Recommendation: add the same `await ensureAquarelleDurableBaseRef.current(playFrame)` call at the top of `replay`, before the snapshot swap — for both the existing `aquarelle-script` consumers (a latent bug fix) and the new stroke path.

Sheet reset: `resetSheet` is `stampPendingSettle → onSheetSessionEnd → engine.clear() → painting=false → …` [VERIFIED: app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx:750-758]; the Studio registration also clears `aquarelleMergeBaseRef` and `aquarelleSheetHasPaintRef` [VERIFIED: PhysicsPaintStudio.tsx:8014-8017].

Re-bake body: `applyAquarelleTimeline` rejects when `busy.peek()` and **force-flushes pending live-pixel captures before baking**:

```ts
    if (busy.peek() || !ports.applyAquarelleEvents) return false;
    const acceptedEngineGeneration = engineGeneration;
    const acceptedLaunchGeneration = launchGeneration;
    error.value = null;
    beginOperation(engine);
    let dispatched = false;
    try {
      await ports.flushSourcePublication?.(source.appFrame);
```
[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts:970-977]

`flushSourcePublication` is wired to `rotoPersistence.flushLivePixels(appFrame)` [VERIFIED: PhysicsPaintStudio.tsx:1865]. This is precisely the pre-undo capture that must never commit. **Order of operations at the top of `replay` is therefore load-bearing:** invalidate first (synchronously), then swap, then reset, then bake.

`applyFrameModuleState` resolves and publishes the frame's owner only — `resolveStudioScriptCell → resolveFrameScriptOwner → setFrameScriptOwner(owner)` [VERIFIED: PhysicsPaintStudio.tsx:2185-2189]. It is not a pixel commit; it must still run last so the Brush slot locks/unlocks after the script changed. It cannot be relied on to publish bytes.

Bake publish (for completeness): durable-base composite → `rotoPersistence.upsertCachedFrame` → `loadCachedRotoReferenceFrame` + `physicPaintVersion++`, failing closed with `durable-base-unknown` when the base is unknown (PhysicsPaintStudio.tsx:2007-2074).

## Q4 — Capture commit sites and where the epoch seats

| # | Site | Nature | Needs the epoch? |
|---|------|--------|------------------|
| 1 | `captureLivePixels` → `livePixelTransactions.capture` → commit | Writes live-sheet pixels into the bake cache | **Yes — the harmful site** |
| 2 | `upsertCachedFrame` (bake publish from the replay) | The new authority itself | No — gating it would reject the correct post-undo bake |
| 3 | `applyFrameModuleState` | Owner resolve/publish | No — not a pixel commit |
| 4 | `snapshotCurrentFrame` (edit controller) | Frame snapshot | No live callers found by repo-wide grep; dormant |
| 5 | `queueParentPayload` (parent delivery) | Sends cache payload to the host | Already gated: re-checks `currentRevision !== identity.contentRevision` at 383 |

A per-key monotonic revision already exists and is the right seat. `invalidate` bumps it; both the produce gate and the commit gate compare it:

```ts
    capture<T>(captureInput: …): Promise<boolean> {
      …
      const pixelRevision = invalidate(identity);
```
[VERIFIED: app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.ts:142-151]

```ts
          isStillWanted: (stage) => {
            if (revisions.get(key) === pixelRevision && matchesIdentity(input.identity, input.resolveCurrent())) return true;
```
[VERIFIED: rotoLivePixelCacheTransactions.ts:165-166]

```ts
          commit: async (value) => {
            const current = input.resolveCurrent();
            if (revisions.get(key) !== pixelRevision || !matchesIdentity(input.identity, current)) return reject('stale-before-commit');
```
[VERIFIED: rotoLivePixelCacheTransactions.ts:184-186]

And the coordinator already exposes the invalidation, correctly keyed by (track, frame):

```ts
  const invalidateLivePixels = useCallback((appFrame: number) => {
    const identity = resolveFrameIdentityInput(appFrame);
    return identity ? livePixelTransactionsRef.current.invalidate(identity) : 0;
  }, [resolveFrameIdentityInput]);
```
[VERIFIED: app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts:766-769]

It is exported from the hook (return block at 906-909) and **never called anywhere in the Studio** (repo grep). That is the missing wiring, not a missing mechanism.

**Two-layer epoch recommendation.**

- Layer A (sheet pixels, per key): `rotoPersistence.invalidateLivePixels(playFrame)` as the **first synchronous statement** of `replay`, before `restoreAquarelleEditSnapshot`. Any capture already queued for that key now fails `isStillWanted` *and* `commit`. This is the hard "never leave a capture able to commit pre-undo sheet pixels" requirement.
- Layer B (script mutations, global): `aquarelleStrokesRevision` already is a monotonic sheet epoch — bumped by record (1186), delete (1062), restore (1157), translate/move (652, 743, 870, 946, 1035, 1106, 1137), seed (1285), and `applySnapshotContent` (559) [VERIFIED: aquarelleRecordState.ts:484-489 with bump sites; `export const aquarelleStrokesRevision = signal(0);`]. Thread `getScriptEpoch?: () => number` into `UseRotoFramePersistenceCoordinatorInput` (existing port block at 228-244), stamp it at `captureLivePixels` entry (585-620), and compare it in the transaction's `commit` alongside `matchesIdentity`. This closes the case Layer A cannot see: a *record* (stroke close) does not call `invalidate`.

Both layers are commit-time checks, satisfying the decision that the check must be at commit and that no settle barrier may precede undo. Ownership: Layer A lives in the Studio route; Layer B lives in the coordinator (its natural home — it already owns `revisions`).

## Q5 — Pin strategy under `vitest run`

Test command: `pnpm --filter efx-motion-editor exec vitest run` (`.planning/config.json` → `workflow.test_command`).

Reality check: **a literal display-vs-bake GPU digest pin is not runnable in unit tests.** Every aquarelle bake test mocks the engine package (pattern in `physicsPaintRotoPlayScriptApplyBake.test.ts`); `digestRenderedFrameBytes` is pure but its inputs come from a WebGL canvas that does not exist under vitest.

`digestRenderedFrameBytes` is exactly what the decision asks for and is DOM-free:

```ts
export function digestRenderedFrameBytes(bytes: Uint8Array | null | undefined): string | null {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) return null;
  let hash = 0x811c9dc5;
  for (let index = 0; index < bytes.length; index += 1) {
    hash ^= bytes[index]!;
    hash = Math.imul(hash, 0x01000193);
  }
  return `${bytes.length.toString(16)}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
```
[VERIFIED: app/src/components/physic-paint/performance/aquarelleRenderSplitCapture.ts:75-83]

**Recommended deterministic pin** (three parts, all under `vitest run`):

1. **Pure orchestration pin** — extract the replay body into a pure module with injected ports (`restore(editId, dir)`, `invalidate(frame)`, `resetSheet()`, `rebake(events)`, `publish(bytes)`, `loadDisplay()`), then assert with `digestRenderedFrameBytes`:
   - call order reset-before-rebake and invalidate-before-everything (`expect(events.map(e => e.step)).toEqual(['invalidate','restore','reset','rebake'])`);
   - after undo, `digestRenderedFrameBytes(publishedBytes) === digestRenderedFrameBytes(displayBytes)` where the fake bake returns a fixed `Uint8Array` and the fake display serves the last published payload — the structural form of "display digest == bake digest";
   - a capture queued *before* undo resolves *after* undo and is rejected (`stale-before-commit`), never published.
2. **Routing pin** — extend `useRotoPhysicalEditHistory.test.ts`'s aquarelle harness (it already injects `aquarelleScriptHistory: { replay }` at ~3053 and has the exact stack-movement assertions at 3060-3121) with rows: recorded stroke → `replayStroke` called, `undoPaint` **not** called, stacks move only on `true`; unrecorded stroke → `undoPaint` called, `replayStroke` not called.
3. **Source-contract row** — the house pattern in `PhysicsPaintStudio.test.ts` (`expect(slice(...)).toContain(...)`, e.g. 4471-4491): assert the replay route contains `invalidateLivePixels` **before** `aquarelleResetSheetRef.current?.()` and contains `ensureAquarelleDurableBaseRef.current`.

Existing patterns to copy: `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts` (hook harness, mocked ports), `app/src/components/physic-paint/view/aquarelleRecordState.delete.test.ts` and `aquarelleStrokeSelection.test.ts` (pure module, no DOM), `PhysicsPaintStudio.test.ts` (source slice contracts).

## Q6 — Pitfalls

**P1 — `engine.clear()` is a history step, so a later `undoPaint()` resurrects pre-undo pixels.** `clear()` early-returns only when `!everPainted && !fill`; otherwise it calls `this.beginStep('clear', 'Clear')` [VERIFIED: packages/efx-watercolor/src/playground/Engine.ts:1271-1284]. `undo()` is `if (this.history.canUndo) this.travel('undo')` (1296). After a reset, the top of engine history is the clear step: an engine-only undo would travel *into* the pre-reset sheet. Consequence: once a stroke undo has reset the sheet, any subsequent engine-`undoPaint()` on the same frame is wrong. Route recorded strokes away from it, and never fall back to `undoPaint()` after a reset has run.

**P2 — auto-key-paint composites still call `undoPaint()`.** The `auto-key-paint` entry carries a `mutationId` and its undo runs `if (!inputRef.current.undoPaint()) return false;` before replaying the key (useRotoPhysicalEditHistory.ts:1003; redo `redoPaint()` at 1170). A first stroke recorded under an auto-key acceptance is therefore a recorded stroke that will still diverge. Either route its stroke half through `replayStroke` too, or state the exclusion explicitly in the plan — do not let it be discovered at UAT.

**P3 — the paint cap is 10 and is shared with availability.** `const maximum = Math.min(10, paintAvailabilityRef.current.undo);` (733) trims *oldest paint entries first* when the ledger exceeds it (735-739). Building an undo edit per paint undo consumes the *separate* `MAX_AQUARELLE_EDITS = 10` budget shared with delete/move (501, 572-575). Both caps must hold; a stroke undone twice must reuse one edit id, not mint a second.

**P4 — tombstones are the only deletion truth.** `deleteAquarelleStrokesFromScript` ignores already-deleted ids and returns 0 without bumping (1051-1062); `getAquarelleEventsForFrame` filters tombstones at read time (`return mutationId === undefined || !deletedAquarelleStrokeIds.has(mutationId);`, aquarelleRecordState.ts:1588). The synthetic `before` snapshot must put the id in `deleted` **and** remove the timeline entry — doing only one leaves either a visible-but-filtered stroke or a resurfacing one.

**P5 — replay fails closed and must leave both stacks untouched.** `busy.peek()` (970), `disposed`/`disposalRequested` (965, 979) and the engine/launch generation checks (978-986) all return `false`. The route's rollback is `restoreAquarelleSnapshotRaw(revert)` (4745). Any new code must propagate `false`, never throw, and must not move the ledger stacks (the hook already guarantees this for `aquarelle-script`; the new `paint` branch must copy that, not the optimistic pop at 944-946).

**P6 — mutation locks.** Delete refuses when `isPhysicalMutationLocked()` or when `rotoScript.applying.peek() || rotoScript.mutationLocked.peek()` (PhysicsPaintStudio.tsx:7107-7108). The engine path gets the equivalent guard from the controller (`if (input.isMutationLocked?.()) return false;` useRotoFrameEditingController.ts:123). A script replay route bypasses both unless the guard is placed in `replay` itself.

**P7 — re-bake during playback / frame change.** `applyAquarelleTimeline` captures `engine` and both generations but **not** the playFrame; `getAquarelleEventsForFrame(playFrame)` is read before the await. Undo during a frame change can bake one frame's events onto another sheet session. The engine undo path stops playback (`input.playback.stop()`, useRotoFrameEditingController.ts:124); the script route does not. Add a playback stop or a playFrame equality check around the replay.

**P8 — `hasAquarellePaintScriptForFrame` decides ownership, not `hasAquarelleScriptForFrame`.** A lift-only timeline bakes a blank sheet; gating on "has any script" once wiped real raster pixels (comment at aquarelleRecordState.ts:1607-1616; implementation 1617-1627). If an undo removes the frame's last *paint* stroke leaving only a lift, `applyFrameModuleState` will reclassify the owner — verify that surface in UAT rather than pinning it.

**P9 — live-pixel identity includes `contentRevision`, which script edits do not change.** The transaction identity is `{ launchId, layerId, keyId, contentRevision, appFrame }` (coordinator 660-666) and `matchesIdentity` compares all five (rotoLivePixelCacheTransactions.ts:166). A script mutation does not move `contentRevision`, so Layer B (the `aquarelleStrokesRevision` epoch) is the only thing that can catch a capture straddling a *record*.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Undo of a recorded stroke | A new re-bake path or a second history stack | `storeAquarelleEdit` + `restoreAquarelleEditSnapshot` + the existing `replay` route | The revision guard, 10-cap, rollback and rollback-on-failed-bake already exist and are UAT-proven |
| Detecting stale captures | A new "capture id" set | `livePixelTransactions.invalidate` / `revisions` | The commit gate (`stale-before-commit`) is already wired and perf-instrumented |
| Frame digest | A new hash | `digestRenderedFrameBytes` | Pure FNV-1a, already the render-split identity |
| Script mutation notification | A new event bus | `bumpAquarelleStrokesRevision()` | 16 bump sites already funnel every mutation |

## Implementation Skeleton (for the planner)

```ts
// PhysicsPaintStudio.tsx — aquarelleScriptHistory, extended
aquarelleScriptHistory: {
  hasRecordedStroke: (mutationId) =>
    getRecordedAquarelleStroke(mutationId) !== undefined
    && !isAquarelleStrokeDeleted(mutationId),

  replayStroke: (mutationId, direction) => {
    const playFrame = launchContextRef.current?.startFrame ?? 0;
    rotoPersistence.invalidateLivePixels(playFrame);   // LAYER A — synchronous, first
    let editId = strokeEditIdsRef.current.get(mutationId);
    if (direction === 'undo' && editId === undefined) {
      const created = beginAquarelleStrokeUndoEdit(mutationId);
      if (created === null) return Promise.resolve(false);
      editId = created;
      strokeEditIdsRef.current.set(mutationId, created);
    }
    if (editId === undefined) return Promise.resolve(false);
    return replayWithReBake(editId, direction);        // the existing replay body, + ensureAquarelleDurableBase
  },

  replay: replayWithReBake,                            // unchanged behaviour + durable-base fix
},
```

`replayWithReBake` = `ensureAquarelleDurableBase(playFrame)` → `restoreAquarelleEditSnapshot` → `invalidateLivePixels(playFrame)` (belt and braces for the `aquarelle-script` callers) → `resetSheet()` → `applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame))` → on false `restoreAquarelleSnapshotRaw(revert)` → `notifySourceRevision()` → `applyFrameModuleState(playFrame)`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Undo must not stop playback or await a settle (Cmd+Z immediacy) — so P7's guard must be a peek/compare, not a drain | Q6 P7 | Either a race remains or undo gains latency; needs one line of user confirmation on the interaction |
| A2 | The `paint` barrier is pushed for every recorded stroke, including auto-key composites | Q1, Q6 P2 | If composites push only `auto-key-paint`, P2 needs no change and Q1's predicate is sufficient |
| A3 | A "display digest" in a unit test may be modelled as "the last published payload", since the real display is served from the bake cache | Q5 | If the user expects a live GPU pin, that row is native UAT and the automated pin stops at the orchestration contract |

## Open Questions (RESOLVED)

Both questions were settled before planning; no open decision remains.

1. **(RESOLVED — include, per CONTEXT.md "Auto-key-paint composites")** **Auto-key-paint composites (P2).** Include their stroke half in this quick task, or record them as a known divergence? Decision: include — the locked decision requires it, so the same `hasRecordedStroke` predicate is applied before `undoPaint()`/`redoPaint()` at 1003/1170. Plan coverage: Task 2 behavior rows for auto-key undo/redo plus native UAT row 4.
2. **(RESOLVED — no new gate, UAT row only)** **Stroke undo vs Move/Lift after undo.** Undo now removes a stroke from the script; `hasAquarellePaintScriptForFrame` may flip the frame's module owner. Decision: leave `applyFrameModuleState` as the single owner resolver and observe the surface in native UAT (row 6) rather than adding a gate. Plan coverage: Task 2 keeps `applyFrameModuleState` as the only owner resolver.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node + pnpm | build/test | ✓ | — | — |
| vitest | deterministic pin | ✓ | repo-local | — |
| WebGL / @efxlab/efx-watercolor | real bake digests | ✗ under `vitest run` | — | Orchestration pin + source contract; native UAT for pixels |

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (repo-local) |
| Config file | existing `app` vitest config — no new config |
| Quick run command | `pnpm --filter efx-motion-editor exec vitest run app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts` |
| Full suite command | `pnpm --filter efx-motion-editor exec vitest run` |

### Phase Requirements → Test Map

| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|--------------|
| Recorded stroke undo takes the replay route | unit (hook harness) | `vitest run .../useRotoPhysicalEditHistory.test.ts` | ✅ extend |
| Unrecorded stroke undo stays engine-only | unit (hook harness) | same | ✅ extend |
| `beginAquarelleStrokeUndoEdit` builds before=WITHOUT / after=WITH at the same revision | unit (pure module) | `vitest run .../view/aquarelleStrokeSelection.test.ts` | ✅ extend |
| Guard rejects a newer script mutation | unit (pure module) | same | ✅ |
| Invalidate → restore → reset → rebake order; publish digest == display digest; pre-undo capture rejected | unit (pure orchestration module) | new test file | ❌ Wave 0 |
| Replay route contains durable-base recovery and synchronous invalidation | source contract | `vitest run .../PhysicsPaintStudio.test.ts` | ✅ extend |

### Sampling Rate
- **Per task commit:** the targeted file(s) above.
- **Per wave merge:** `pnpm --filter efx-motion-editor exec vitest run`.
- **Phase gate:** full suite green, then native UAT (user's).

### Wave 0 Gaps
- [ ] Pure replay-orchestration module + its test file (ports injected; digest equality; commit rejection).
- [ ] `beginAquarelleStrokeUndoEdit` + rows in `aquarelleStrokeSelection.test.ts`.
- [ ] `useRotoPhysicalEditHistory.test.ts` route rows (`replayStroke` / `hasRecordedStroke` in the harness at ~3030-3121).

## Security Domain

`security_enforcement` is not set in `.planning/config.json`, so it is enabled; this phase is entirely local in-process state with no new input surface.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | finite/non-negative `mutationId` and `editId` guards already present (`Number.isFinite` in `normalizeAquarelleMutationIds`, 580-591); the new predicate must not trust an id from a stale UI selection |
| V6 Cryptography | no | — |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stale UI id resurrects a deleted stroke | Tampering | `isAquarelleStrokeDeleted` predicate + tombstone filter at `getAquarelleEventsForFrame` |
| Stale async capture overwrites newer pixels | Tampering | `stale-before-commit` revision gate + `aquarelleStrokesRevision` epoch |

## Sources

### Primary (HIGH confidence — read this session)
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts`
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts`
- `app/src/components/physic-paint/view/aquarelleRecordState.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts`
- `app/src/components/physic-paint/hooks/useRotoFrameEditingController.ts`
- `app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.ts`
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts`
- `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx`
- `app/src/components/physic-paint/engine/aquarelleEnginePort.ts`
- `app/src/components/physic-paint/performance/aquarelleRenderSplitCapture.ts`
- `packages/efx-watercolor/src/playground/Engine.ts`
- Test files: `useRotoPhysicalEditHistory.test.ts`, `aquarelleRecordState.delete.test.ts`, `PhysicsPaintStudio.test.ts`, `physicsPaintRotoPlayScriptApplyBake.test.ts`

### Secondary (MEDIUM confidence)
- None — no external documentation was needed; this is an in-repo contract task.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Seam and edit machinery: HIGH — every claim read at file:line this session.
- Re-bake path and capture gates: HIGH — ditto, including the `flushSourcePublication` hazard.
- Pin shape: MEDIUM — the orchestration pin is certain; the claim that no real GPU pin can run under vitest rests on the uniform mocking pattern in existing bake tests, not on a failed attempt.

**Research date:** 2026-10-29
**Valid until:** 2026-11-28 (30 days; fast-moving area, re-verify line numbers if the phase slips)
