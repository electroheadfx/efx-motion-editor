---
phase: 261029-lsr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts
  - app/src/components/physic-paint/roto/aquarelleScriptReplay.ts
  - app/src/components/physic-paint/roto/aquarelleScriptReplay.test.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts
  - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts
  - app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.ts
  - app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
autonomous: true
requirements:
  - UNDO-ROUTE
  - UNDO-REBAKE
  - UNDO-CAPTURE-EPOCH
  - UNDO-PIN
  - UNDO-AUTOKEY
  - UNDO-PLAYBACK
user_setup: []

estimate:
  # Per-task projection at execution-turn boundaries (each task ends with its own
  # commit; the next task re-reads only its own files):
  #   Task 1 (stroke edit builder + re-anchor + replay orchestrator + pins): 20000
  #   Task 2 (ledger routing + Studio route wiring + contract migration):    24000
  #   Task 3 (capture epoch + source contract):                              14000
  #   Sum: 58000 < smart-zone budget. PhysicsPaintStudio.tsx (9.7k lines) is
  #   edited at named anchors only — never read whole.
  # estimate-calibration: factor 1, applied false, sample_count 0 -> confidence low.
  tokens: 58000
  raw_tokens: 58000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Undoing a recorded aquarelle stroke removes it from BOTH the script and the frame's pixels: the frame is re-baked through the shared Apply path and the displayed frame digest equals the published bake digest (the user's stated invariant)."
    - "Undoing a stroke that was never recorded (Script switch off / raster Lift that pins nothing) stays engine-only: no script mutation, no sheet reset, no re-bake — `undoPaint()` exactly as today."
    - "Redo re-installs the same stroke from the SAME stored edit id (one script edit per stroke; the 10-entry edit ledger and the 10-entry paint ledger both hold), and a second undo/redo cycle on that stroke still uses that one id."
    - "A live-pixel capture started before an undo can never commit its pre-undo sheet pixels after the undo: rejected before produce and again at commit, at both layers (per-key `invalidateLivePixels` and the `aquarelleStrokesRevision` epoch)."
    - "After undo the replay fails closed (returns false, never throws) on a stale snapshot revision, a locked mutation, or a failed bake — the ledger stacks stay untouched, and a bake failure re-anchors the cached edit id so the next Cmd+Z retries the same stroke instead of failing the revision guard forever."
    - "Auto-key-paint composites route their stroke half through the script route too; the stroke rollback after a rejected key replay uses the inverse script replay and never `redoPaint()` once a reset has run."
    - "A script-authoritative undo pressed during playback stops playback first and bakes the frame captured at replay entry (one playFrame per replay), never a frame that moved mid-replay."
  artifacts:
    - app/src/components/physic-paint/roto/aquarelleScriptReplay.ts
    - app/src/components/physic-paint/roto/aquarelleScriptReplay.test.ts
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
    - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts
    - app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - .planning/quick/261029-lsr-undo-script-authoritative-undo-for-aquar/261029-lsr-SUMMARY.md
  key_links:
    - "useRotoPhysicalEditHistory paint/auto-key-paint branch -> route.hasRecordedStroke(mutationId) -> route.replayStroke(mutationId, direction) -> PhysicsPaintStudio.runScriptReplay -> runAquarelleScriptReplay"
    - "runAquarelleScriptReplay first synchronous step -> rotoPersistence.invalidateLivePixels(playFrame) (per-key revision bump) -> any queued capture fails isStillWanted and commit"
    - "runAquarelleScriptReplay -> ensureAquarelleDurableBase(playFrame) BEFORE prepare/build (base recovery bumps aquarelleStrokesRevision) -> beginAquarelleStrokeUndoEdit -> storeAquarelleEdit (shared 10-cap) -> restoreAquarelleEditSnapshot"
    - "restore -> aquarelleResetSheetRef (engine.clear) -> applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame)) -> upsertCachedFrame publish -> applyFrameModuleState owner resolve"
    - "captureLivePixels stamps getScriptEpoch() -> RotoLivePixelCapture.isStillCurrent -> transaction isStillWanted + commit reject 'stale-before-commit'"
    - "replayStroke false after the replay reached 'rebake' -> reanchorAquarelleEditRevision(editId, direction) -> the next Cmd+Z passes the revision guard (retryable); an evicted edit id drops the cache entry so the next undo rebuilds it"
    - "existing 261022-pim route-contract rows (PhysicsPaintStudio.test.ts:3211-3225, 4107-4112) -> migrated onto the runScriptReplay slice + aquarelleScriptReplay.ts, so the full suite stays green"
---

<objective>
Make undo/redo of aquarelle strokes script-authoritative: a recorded stroke undo/redo mutates the recorded script, resets the live sheet and re-bakes the frame through the existing Apply path, so the frame can never drift from its bake. Unrecorded strokes keep the engine-only `undoPaint()` route, and no in-flight capture may commit pre-undo sheet pixels.

Purpose: today a recorded stroke pushes a `paint` ledger entry carrying only a `mutationId`, and undo runs `AquarelleEnginePort.undo()` — a framebuffer-tile restore that never touches the script. The script keeps the stroke, the engine drops the pixels (or the reverse after a reset), and Move/Lift then see a display that disagrees with the script.

Output: a synthetic single-stroke undo edit builder, a pure replay orchestrator (invalidate -> durable base -> prepare -> restore -> reset -> rebake) shared by the `aquarelle-script` route and the new stroke route, routing of `paint` / `auto-key-paint` ledger entries through `hasRecordedStroke` / `replayStroke`, a capture epoch (per-key revision + `aquarelleStrokesRevision`) checked at produce and commit, deterministic orchestration pins, and a source-contract row.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/PROJECT.md
@CLAUDE.md
@.claude/skills/efx-preact-reactivity/SKILL.md
@.claude/skills/efx-async-orchestration/SKILL.md
@.planning/quick/261029-lsr-undo-script-authoritative-undo-for-aquar/261029-lsr-CONTEXT.md
@.planning/quick/261029-lsr-undo-script-authoritative-undo-for-aquar/261029-lsr-RESEARCH.md

**Base branch:** `dev` HEAD (user-confirmed). `v2.0.0/lift-three-state` is 61 commits
behind — do NOT use it.

**Decision aliases.** CONTEXT.md's decision sections are unnumbered; this plan cites
them as D-01..D-08 (stable aliases, in CONTEXT order) so coverage is traceable:

| Alias | CONTEXT section | Meaning |
|-------|-----------------|---------|
| D-01 | Unrecorded strokes | Engine-only undo; never invent a script trace |
| D-02 | Re-bake scope/cost | Reuse the delete machinery (snapshots + shared Apply); one ledger command; redo = inverse swap |
| D-03 | Capture guard | Monotonic epoch, stamped at capture start, refused at commit; no settle barrier before undo |
| D-04 | Undo stack shape | Keep the `paint` entry kind; resolve the script identity; one ledger |
| D-05 | Deterministic pin shape | Orchestration pin (order + digest equality + rejected capture) + source contract; real pixels are native UAT |
| D-06 | Auto-key-paint composites | The same recorded-stroke predicate gates their stroke half |
| D-07 | Undo during playback | Stop playback first, exactly like the engine undo path |
| D-08 | Claude's Discretion | Epoch ownership/seating, identity storage, digest measurement |

**Planning-time corrections to RESEARCH.md (verified at HEAD, follow these):**

- **R-1 — base recovery bumps the script revision.** `ensureAquarelleDurableBaseRef.current`
  calls `bumpAquarelleStrokesRevision()` on its no-payload path
  (`PhysicsPaintStudio.tsx:6161`). Therefore a stroke undo edit must be BUILT after
  `ensureBase` resolves, never before it — otherwise its `after.revision` is stale and
  `restoreAquarelleEditSnapshot` fails closed on every undo. Callers that already follow
  that order: move (`:7212`/`:7213`), appearance (`:7283`/`:7286`) and transform
  (`:7365`/`:7368`). Delete does NOT: it calls `beginAquarelleDeleteEdit` at `:7117` and
  only reaches `ensureAquarelleDurableBaseRef` at `:7127`, so on a key whose base had to
  be recovered its failure-path restore can miss the guard — that staleness is
  PRE-EXISTING and explicitly out of scope here (do not "fix" delete in this task).
  Reorder (`:7430`) and place (`:7482`) run no `ensureBase` at all. The derived rule is
  unchanged and applies to the new stroke builder: build the stroke undo edit AFTER
  `ensureBase`, which the replay module's step order does.
- **R-1b — a failed re-bake leaves the edit's live side stale.** `restoreAquarelleSnapshotRaw`
  applies content through `applySnapshotContent`, which bumps `aquarelleStrokesRevision`
  (`aquarelleStrokeSelection.ts:559`) without writing the fresh revision back into the
  edit. So after `restore(editId,'undo')` (R -> R+1) plus the raw rollback (R+1 -> R+2),
  the cached edit's `after.revision` is still R and every retry fails the guard at
  `:738`. The fix is `reanchorAquarelleEditRevision(editId, direction)` (Task 1) called
  from `replayStroke` when the replay returns false after reaching `rebake` (Task 2).
- **R-2 — the routing predicate must NOT exclude tombstones.** RESEARCH's predicate was
  `getRecordedAquarelleStroke(m) !== undefined && !isAquarelleStrokeDeleted(m)`. After an
  undo the stroke is tombstoned, so that predicate would send the REDO of the same paint
  entry down the engine path — the exact bug. Route on
  `getRecordedAquarelleStroke(m) !== undefined`; keep the tombstone refusal inside
  `beginAquarelleStrokeUndoEdit` (an already-deleted stroke cannot be undone twice).
- **R-3 — the test command root is `app/`.** `pnpm --filter efx-motion-editor exec vitest run`
  executes with cwd `app/` and `app/vitest.config.ts` collects `src/**/*.test.ts`, so the
  vitest path argument is app-package-relative (`src/components/...`). Verified at HEAD:
  `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts`
  -> 13 passed. The `app/`-prefixed form finds no files. `files` entries in this plan stay
  repo-root-relative; only the vitest argv is app-relative.

**Baseline at HEAD (do not re-derive):** `aquarelleStrokeSelection.test.ts` 34 passed,
`useRotoPhysicalEditHistory.test.ts` 58 passed, `PhysicsPaintStudio.test.ts` 288 passed,
`rotoLivePixelCacheTransactions.test.ts` 13 passed, `pnpm --filter efx-motion-editor typecheck`
clean in ~9 s.

**Anchors (line numbers are HEAD references, re-locate by the quoted literal):**
- `useRotoPhysicalEditHistory.ts:196-199` `PaintBarrier`; `:208-212` `AutoKeyPaintHistoryEntry`;
  `:272-274` `AquarelleScriptHistoryRoute`; `:929-956` script + paint undo branches;
  `:995-1029` auto-key undo; `:1084-1110` script + paint redo; `:1141-1173` auto-key redo.
- `aquarelleStrokeSelection.ts:488-516` snapshot shape + capture; `:554-577` apply/store;
  `:598-616` `beginAquarelleDeleteEdit`; `:730-750` restore/rollback.
- `PhysicsPaintStudio.tsx:4737-4754` the route; `:7040-7095` stroke record;
  `:7106-7150` delete handler; `:6142-6250` `ensureAquarelleDurableBaseRef`;
  `:8014-8018` reset-sheet registration; `:1490` durable-base ref next to which the edit-id
  map is declared; `:3618` `rotoCachedPlayback`; `:2142` `isPhysicalMutationLocked`.
- `useRotoFramePersistenceCoordinator.ts:228-245` input ports; `:585-750` `captureLivePixels`;
  `:766-769` `invalidateLivePixels`; `:906-909` exports.
- `rotoLivePixelCacheTransactions.ts:34-43` `RotoLivePixelCapture`; `:134-193` invalidate +
  capture/commit gates.
</context>

## Source Coverage Audit

| SOURCE | ID | Feature / requirement | Task | Status |
|--------|----|-----------------------|------|--------|
| GOAL | — | Undo removes both the script event and the live paint; frame stays equal to its bake | 01-03 | COVERED |
| GOAL | — | Deterministic pin: after undo, display digest == bake digest | 01 | COVERED |
| CONTEXT | D-01 | Unrecorded strokes stay engine-only | 02 | COVERED |
| CONTEXT | D-02 | Reuse delete machinery; redo = inverse snapshot swap; one ledger | 01, 02 | COVERED |
| CONTEXT | D-03 | Monotonic capture epoch, refuse commit if it moved, no settle barrier | 03 | COVERED |
| CONTEXT | D-04 | Keep `paint` kind; resolve script identity; one ledger | 01, 02 | COVERED |
| CONTEXT | D-05 | Orchestration pin + source contract; native UAT for pixels | 01, 03 | COVERED |
| CONTEXT | D-06 | Auto-key-paint composites included | 02 | COVERED |
| CONTEXT | D-07 | Stop playback first | 02 | COVERED |
| CONTEXT | D-08 | Epoch ownership, identity storage, digest measurement (discretion) | 01, 03 | COVERED |
| RESEARCH | Q2 | `beginAquarelleStrokeUndoEdit` (do not reuse the delete builder; direction trap) | 01 | COVERED |
| RESEARCH | Q3 | Latent bug: route lacks `ensureAquarelleDurableBaseRef` | 01, 02 | COVERED |
| RESEARCH | Q3 | `invalidateLivePixels` must precede the snapshot swap and the force-flush | 01, 02 | COVERED |
| RESEARCH | P1 | `engine.clear()` is a history step — never fall back to `undoPaint()` after a reset | 02 | COVERED |
| RESEARCH | P3 | Both 10-caps hold; one stroke undone twice reuses one edit id | 01, 02 | COVERED |
| RESEARCH | P4 | Synthetic `before` removes the timeline entry AND adds the tombstone | 01 | COVERED |
| RESEARCH | P5 | Fail closed: propagate false, never throw, stacks untouched | 01, 02 | COVERED |
| RESEARCH | P6 | Mutation-lock guard inside the replay route | 02 | COVERED |
| RESEARCH | P7 | Stop playback; one playFrame per replay | 02 | COVERED |
| RESEARCH | P8 | `applyFrameModuleState` stays the single owner resolver; UAT row, no new gate | 02 | COVERED |
| RESEARCH | P9 | Layer B epoch is required because `contentRevision` does not move on script edits | 03 | COVERED |
| RESEARCH | R-1 | Base recovery bumps the revision -> build the edit after `ensureBase` | 01 | COVERED |
| RESEARCH | R-2 | Predicate must not exclude tombstones (redo routing) | 02 | COVERED |

No deferred ideas exist in CONTEXT.md. No item is MISSING.

<tasks>

<task type="tdd" tdd="true">
  <name>Task 1: Stroke undo edit builder + pure replay orchestrator (and their pins)</name>
  <files>
    app/src/components/physic-paint/view/aquarelleStrokeSelection.ts,
    app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts,
    app/src/components/physic-paint/roto/aquarelleScriptReplay.ts,
    app/src/components/physic-paint/roto/aquarelleScriptReplay.test.ts
  </files>
  <behavior>
    - `beginAquarelleStrokeUndoEdit(m)`: `after` is the live snapshot WITH the stroke (revision R), `before` is the same content MINUS that stroke's timeline entry AND WITH `m` added to `deleted`, revision also R. `restoreAquarelleEditSnapshot(id,'undo')` immediately after the build returns non-null (the guard compares the live R against `after.revision` R) and installs the WITHOUT side.
    - After that undo, the stroke is tombstoned (`isAquarelleStrokeDeleted(m)` true) AND its timeline entry is gone; `getAquarelleEventsForFrame(frame)` contains no event for `m`.
    - The same edit redoes (reinstalls WITH, tombstone cleared) and undoes again: one edit id serves the whole cycle, no second edit is minted.
    - `beginAquarelleStrokeUndoEdit` returns null for: unknown id, already-deleted id, an id with no timeline entry (not script-owned), empty/non-finite id, and while `aquarelleScriptEditInFlight` is true.
    - Dry (global) events survive the synthetic `before` timeline filter untouched.
    - Orchestrator order on success: `invalidate` is the first step and happens before any await; then `ensure-base`; then `prepare`; then `restore`; then `reset`; then `rebake`; then `notify` and `publish-owner`.
    - Digest equality: after the orchestrator runs, `digestRenderedFrameBytes(displayBytes) === digestRenderedFrameBytes(publishedBakeBytes)` where the fake display prefers live-sheet pixels when the sheet still holds any.
    - Fail closed: `restore` null -> false, no reset/rebake/owner publish; `rebake` false or a rejecting `rebake` -> rollback called, false returned, no throw; `prepare` null -> false; `ensure-base` rejection is swallowed and the replay continues (the bake refuses on its own).
    - Retryability (`reanchorAquarelleEditRevision`): build, undo (revision R -> R+1), then a raw rollback (`restoreAquarelleSnapshotRaw(revert)`, revision R+1 -> R+2) leaves the edit's `after.revision` at R — the immediate retry of `restoreAquarelleEditSnapshot(id,'undo')` returns null (this is the strand). `reanchorAquarelleEditRevision(id,'undo')` returns true, does NOT bump the revision and does NOT change content; the retry then returns non-null and installs the WITHOUT side.
    - Re-anchoring forgives ONLY the attempted direction: after `reanchorAquarelleEditRevision(id,'undo')` a `redo` on the same edit still returns null (its live side keeps the stale revision). An unknown/evicted edit id returns false.
  </behavior>
  <action>
Write the failing pins first, then implement.

(A) `aquarelleStrokeSelection.ts` — add `getRecordedAquarelleStroke` to the existing `./aquarelleRecordState` import list and `type AquarelleStrokePayload` to the existing `@efxlab/efx-watercolor/payload` import. Add `beginAquarelleStrokeUndoEdit(mutationId: number): number | null` immediately AFTER `beginAquarelleDeleteEdit`:
- Refuse (return null) when `aquarelleScriptEditInFlight`, when `!Number.isFinite(mutationId)`, when `getRecordedAquarelleStroke(mutationId) === undefined`, when `isAquarelleStrokeDeleted(mutationId)`, and when the filtered timeline length is unchanged.
- `const after = captureAquarelleSnapshot();` then `const timeline = after.timeline.filter((event) => isAquarelleDryEvent(event) ? true : (event.engine as AquarelleStrokePayload).mutationId !== mutationId);` — Dry events are global and must survive; ordering of the survivors is preserved.
- Build `before` as `{ timeline, deleted: [...after.deleted, mutationId], registry: after.registry, revision: after.revision }` (registry shared by reference so the redo side keeps the same stroke objects) and return `storeAquarelleEdit({ before, after })`.
- Do NOT call `deleteAquarelleStrokesFromScript` (it mutates live state and bumps the revision, invalidating the guard on the next line). Do NOT reorder or relabel revisions — the guard must pass on the immediate undo (D-02, RESEARCH Q2).
- Doc comment must state the direction contract: `after` = WITH the stroke, `before` = WITHOUT; `undo` installs WITHOUT; the revision on `before` is R only until the install writes R+1 back (that is what redo validates against).
- Add `export function reanchorAquarelleEditRevision(editId: number, direction: 'undo' | 'redo'): boolean` immediately AFTER `restoreAquarelleSnapshotRaw`: look the edit up (`aquarelleEdits.get(editId)`), return false when absent; take `const liveSide = direction === 'undo' ? edit.after : edit.before;`, assign `liveSide.revision = aquarelleStrokesRevision.value;`, return true. It must NOT bump the revision, NOT reinstall content, NOT touch the opposite side, and NOT prune the edit. Doc comment: the failed-bake rollback bumps the revision without writing it back into the edit, so a retry would fail the guard forever; re-seating the attempted side keeps that one retry alive without forgiving a foreign mutation (the opposite side and every other edit stay fail-closed).

(B) `aquarelleStrokeSelection.test.ts` — add a `describe('261029-lsr script-authoritative stroke undo edit', ...)` in the house style (seed with `recordAquarelleStroke(<unique id>, stroke({ points: [...], playFrame }))`, unique id blocks around 9700-9799). Cover every `<behavior>` row above, including the Dry-survival row (record a Dry via `emitAquarelleDry` — import it from `./aquarelleRecordState` — if its signature allows a standalone dry; otherwise seed a dry event through the same helper the existing dry tests use), the in-flight refusal (set `setAquarelleScriptEditInFlight(true)` / reset in a `finally`), and the two retryability rows: build -> `restoreAquarelleEditSnapshot(id,'undo')` -> `restoreAquarelleSnapshotRaw(revert)` -> `restoreAquarelleEditSnapshot(id,'undo')` returns null -> `reanchorAquarelleEditRevision(id,'undo')` -> the same restore returns non-null; plus the redo-still-null and unknown-id cases.

(C) NEW `app/src/components/physic-paint/roto/aquarelleScriptReplay.ts` — the ONE replay orchestration, pure and injectable (no signals, no DOM, no imports beyond types):
- `export type AquarelleReplayDirection = 'undo' | 'redo';`
- `export type AquarelleReplayStep = 'invalidate' | 'ensure-base' | 'prepare' | 'restore' | 'reset' | 'rebake';`
- `export interface AquarelleReplayPorts<Revert> { invalidate: () => void; ensureBase: () => Promise<boolean>; prepare?: () => number | null; restore: (editId: number, direction: AquarelleReplayDirection) => Revert | null; resetSheet: () => void; rebake: () => Promise<boolean>; rollback: (revert: Revert) => void; notify: () => void; publishOwner: () => void; }`
- `export async function runAquarelleScriptReplay<Revert>(input: { direction: AquarelleReplayDirection; editId?: number; ports: AquarelleReplayPorts<Revert>; onStep?: (step: AquarelleReplayStep) => void; }): Promise<boolean>`
- Body order, exactly: (1) `onStep('invalidate'); ports.invalidate();` — synchronous, before ANY `await`; (2) `onStep('ensure-base');` then await `ports.ensureBase()` inside a try/catch that swallows a rejection (the publish refuses on its own); (3) resolve the edit id: `let editId = input.editId ?? (onStep('prepare'), ports.prepare?.() ?? undefined);` and return false when still undefined/null; (4) `onStep('restore'); const revert = ports.restore(editId, direction); if (revert === null) return false;` (5) `onStep('reset'); ports.resetSheet();` (6) `onStep('rebake');` then `let ok = false; try { ok = await ports.rebake(); } catch { ok = false; } if (!ok) { ports.rollback(revert); return false; }` (7) `ports.notify(); ports.publishOwner(); return true;`.
- The module must never throw to its caller and never reorder steps. Doc comment: invalidate first because `applyAquarelleTimeline` force-flushes pending live-pixel captures at its own first await, and ensureBase precedes prepare because base recovery can bump `aquarelleStrokesRevision` (R-1).

(D) NEW `app/src/components/physic-paint/roto/aquarelleScriptReplay.test.ts` — the deterministic orchestration pin (D-05), importing `digestRenderedFrameBytes` from `../performance/aquarelleRenderSplitCapture`. Build a fake two-authority world, not a tautology:
- `sheetBytes: Uint8Array | null` starts as a pre-undo payload; `publishedBytes: Uint8Array | null` starts null; `displayBytes()` returns `sheetBytes ?? publishedBytes` (the live sheet wins while it holds pixels — the exact split this task closes).
- `resetSheet` sets `sheetBytes = null`; `rebake` sets `publishedBytes` to a post-undo byte array and returns true; every port pushes its name into a `steps` array (also fed by `onStep`).
- Row 1 (order): `expect(steps.filter((s) => s !== 'ensure-base' && s !== 'prepare')).toEqual(['invalidate','restore','reset','rebake'])` and `expect(steps[0]).toBe('invalidate')` and `expect(steps.indexOf('ensure-base')).toBeLessThan(steps.indexOf('prepare'))` and `prepare < restore`.
- Row 2 (digest equality, the user's invariant): after the run, `expect(digestRenderedFrameBytes(displayBytes())).toBe(digestRenderedFrameBytes(publishedBytes))` and `expect(displayBytes()).toEqual(expectedPostUndoBytes)`. Add a negative control proving the pin bites: a second run whose `resetSheet` is a no-op leaves `sheetBytes` non-null and the two digests differ — assert that inequality, so a future removal of the reset fails this file.
- Row 3 (fail closed): `restore` returning null -> false with no `reset`/`rebake` steps; `rebake` returning false -> `rollback` called and false; `rebake` rejecting -> `rollback` called, false, no rejection escapes (`await expect(...).resolves.toBe(false)`); `prepare` null -> false with no `restore` step.
- Row 4 (pre-built edit id): passing `editId` skips `prepare` entirely (no 'prepare' step) — the `aquarelle-script` callers' path.

Use `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/aquarelleScriptReplay.test.ts` while iterating (cwd is `app/`; see R-3).
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarelleStrokeSelection.test.ts src/components/physic-paint/roto/aquarelleScriptReplay.test.ts && pnpm --filter efx-motion-editor typecheck</automated>
  </verify>
  <done>`beginAquarelleStrokeUndoEdit` builds a WITH/AFTER, WITHOUT/BEFORE edit at one revision and installs WITHOUT on the immediate undo; `reanchorAquarelleEditRevision` re-seats only the attempted side so a post-rollback retry passes the guard while the opposite direction stays fail-closed; the replay orchestrator enforces invalidate -> ensure-base -> prepare -> restore -> reset -> rebake, returns false on every failure without throwing, and its pin proves display digest == bake digest plus a negative control; both target suites and the app typecheck are green (aquarelleStrokeSelection grows from 34 tests).</done>
</task>

<task type="tdd" tdd="true">
  <name>Task 2: Route recorded strokes through the script replay (ledger + Studio route)</name>
  <files>
    app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts,
    app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts,
    app/src/components/physic-paint/PhysicsPaintStudio.tsx,
    app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  </files>
  <behavior>
    - `paint` undo with `hasRecordedStroke(m) === true`: `replayStroke(m,'undo')` is called, `undoPaint()` is NOT, the stacks move only when the replay resolves true, and a false replay leaves `{undo, redo}` availability unchanged.
    - `paint` undo with `hasRecordedStroke(m) === false`: `undoPaint()` is called exactly as today, `replayStroke` is NOT, and the existing optimistic pop/rollback behaviour is preserved.
    - `paint` redo is symmetric for both arms.
    - `auto-key-paint` undo with a recorded stroke: `replayStroke(m,'undo')` runs FIRST (no `undoPaint()`); when the key replay is rejected the rollback calls `replayStroke(m,'redo')` (never `redoPaint()`) and both stacks stay untouched.
    - `auto-key-paint` undo with an unrecorded stroke keeps the current `undoPaint()` / `redoPaint()` calls.
    - `auto-key-paint` redo with a recorded stroke: the key replay runs first, then `replayStroke(m,'redo')`; a false stroke redo returns false without moving the stacks.
    - `replayStroke` retryability: a replay that returned false after its `onStep` reported `rebake` calls `reanchorAquarelleEditRevision(editId, direction)` and keeps the cache entry; a false replay that never reached `rebake` leaves the cache exactly as it was.
    - Migrated source contract: the 261022-pim route row still proves restore -> reset -> shared apply -> raw rollback -> notify -> owner publish (now sliced from `runScriptReplay` + `aquarelleScriptReplay.ts`), and the owner-publish ordering row still proves `notifySourceRevision` before `applyFrameModuleState`.
  </behavior>
  <action>
Write the failing hook rows first, then implement.

(A) `useRotoPhysicalEditHistory.ts`:
- Extend the interface at `:272-274` to `export interface AquarelleScriptHistoryRoute { replay: (editId: number, direction: 'undo' | 'redo') => Promise<boolean>; hasRecordedStroke: (mutationId: number) => boolean; replayStroke: (mutationId: number, direction: 'undo' | 'redo') => Promise<boolean>; }` with a doc note that `hasRecordedStroke` answers "is this mutation id a recorded script stroke" (a tombstoned stroke still answers true so its REDO can route — R-2).
- `undo`, `paint` branch: read `const route = inputRef.current.aquarelleScriptHistory;` and, when `route !== undefined && route.hasRecordedStroke(entry.mutationId)`, run the SAME protocol as the `aquarelle-script` branch: `const replayed = await route.replayStroke(entry.mutationId, 'undo'); if (!replayed) return false;` then re-read the top (`if (top !== entry) return false;`), pop applied, push redo, `publishAvailability()`, return true. Never fall back to `undoPaint()` after a false replay (P1). Keep the existing optimistic engine path untouched for the false arm.
- `undo`, `auto-key-paint` branch (`:995-1028`): compute `const route = inputRef.current.aquarelleScriptHistory;` and `const recordedStroke = route !== undefined && route.hasRecordedStroke(entry.mutationId);`. Replace `if (!inputRef.current.undoPaint()) return false;` with: recorded -> `if (!await route.replayStroke(entry.mutationId, 'undo')) return false;`; else the existing `undoPaint()` call unchanged. In the `!autoKeyAccepted` rollback (`:1022-1027`) replace the bare `inputRef.current.redoPaint();` with: recorded -> `await route.replayStroke(entry.mutationId, 'redo');` (result intentionally not gating the return, mirroring today's unchecked `redoPaint()`), else `inputRef.current.redoPaint();`.
- `redo`, `paint` branch (`:1098-1110`): mirror the undo protocol exactly (replayStroke first, stacks only on true) for the recorded arm; keep the optimistic `redoPaint()` arm.
- `redo`, `auto-key-paint` branch (`:1141-1172`): keep the key replay first; replace the trailing bare `inputRef.current.redoPaint();` with recorded -> `const strokeRedone = await route.replayStroke(entry.mutationId, 'redo'); if (!strokeRedone) { publishAvailability(); return false; }`, else the existing call.
- Do not add a second stack, a new entry kind, or any optional-route fallback beyond "no route -> engine path".

(B) `useRotoPhysicalEditHistory.test.ts` — extend `createAquarelleHarness` (`:3020-3057`) with `const hasRecordedStroke = vi.fn<(mutationId: number) => boolean>(() => false);` and `const replayStroke = vi.fn<(mutationId: number, direction: 'undo' | 'redo') => Promise<boolean>>(async () => true);`, pass both in `aquarelleScriptHistory: { replay, hasRecordedStroke, replayStroke }`, and return them. Add a `describe('261029-lsr recorded-stroke routing', ...)` covering every `<behavior>` row: recorded undo/redo, unrecorded undo/redo, auto-key recorded undo with rollback, auto-key unrecorded unchanged, and the `undoPaint`/`redoPaint` not-called assertions. Seed entries with `observePaintMutation(<id>, 'paint')` and the existing `reconcilePaintBarriers` / auto-key reservation helpers already used in this file (copy the auto-key setup from the neighbouring D-14 rows; do not invent a new harness).

(C) `PhysicsPaintStudio.tsx`:
- Declare `const aquarelleStrokeEditIdsRef = useRef<Map<number, number>>(new Map());` next to `aquarelleDurableBaseByKeyRef` (`:1490`) with a doc note: mutationId -> the ONE script edit id that undoes this stroke (P3: a stroke undone twice reuses this id).
- Add `getRecordedAquarelleStroke` and `isAquarelleStrokeDeleted` to the existing `./view/aquarelleRecordState` import block; add `beginAquarelleStrokeUndoEdit` to the existing `./view/aquarelleStrokeSelection` block; import `{ runAquarelleScriptReplay }` (and its types if needed) from `./roto/aquarelleScriptReplay`.
- Add `reanchorAquarelleEditRevision` to the existing `./view/aquarelleStrokeSelection` import block and import `type AquarelleReplayStep` alongside `runAquarelleScriptReplay` from `./roto/aquarelleScriptReplay`.
- Define ONE local `runScriptReplay` (a `useCallback`) immediately BEFORE `const rotoMoveHistory = useRotoPhysicalEditHistory<RotoEditableState>(` (`:4671`) — the migrated test slices exactly that range, so nothing may sit between the helper and the hook call. Signature `({ direction, editId, prepare, onStep })` with `direction: 'undo' | 'redo'`, `editId?: number`, `prepare?: () => number | null`, `onStep?: (step: AquarelleReplayStep) => void`. Body, exactly in this order: capture `const playFrame = launchContextRef.current?.startFrame ?? 0;` ONCE (never re-read after an await — P7); then the GUARD BLOCK BEFORE ANY SIDE EFFECT — `if (isPhysicalMutationLocked()) return false;`, then `if (rotoScript.applying.peek() || rotoScript.mutationLocked.peek()) return false;`, then `if (isAquarelleScriptEditInFlight()) return false;`, and ONLY THEN `rotoCachedPlayback.stop();` (D-07 by way of the engine undo order at `useRotoFrameEditingController.ts:122-124`: a refused Cmd+Z must not stop playback); then `return runAquarelleScriptReplay({ direction, editId, onStep, ports: {...} })` with these EXACT literals (the migrated source contract asserts them verbatim): `invalidate: () => { rotoPersistence.invalidateLivePixels(playFrame); }`, `ensureBase: () => ensureAquarelleDurableBaseRef.current(playFrame)`, `prepare,`, `restore: (targetEditId, dir) => restoreAquarelleEditSnapshot(targetEditId, dir)`, `resetSheet: () => { aquarelleResetSheetRef.current?.(); }`, `rebake: () => rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame))`, `rollback: (revert) => { restoreAquarelleSnapshotRaw(revert); }`, `notify: () => { rotoScript.notifySourceRevision(); }`, `publishOwner: () => { applyFrameModuleState(playFrame); }`. Deps `[isPhysicalMutationLocked, rotoScript, rotoPersistence]`. Guards run before the module, so a refused replay never invalidates a live capture and never stops playback.
- Replace the route object (`:4737-4754`) with these three members, EXACT literals: `replay: (editId, direction) => runScriptReplay({ direction, editId }),`; `hasRecordedStroke: (mutationId) => getRecordedAquarelleStroke(mutationId) !== undefined,` (R-2: no tombstone term); and `replayStroke: async (mutationId, direction) => { ... }` whose body is, in order: (1) `let reachedRebake = false;` plus `const onStep = (step: AquarelleReplayStep) => { if (step === 'rebake') reachedRebake = true; };` (2) `const cached = aquarelleStrokeEditIdsRef.current.get(mutationId);` (3) `const ok = cached !== undefined ? await runScriptReplay({ direction, editId: cached, onStep }) : direction === 'redo' ? false : await runScriptReplay({ direction, onStep, prepare: () => { const created = beginAquarelleStrokeUndoEdit(mutationId); if (created !== null) aquarelleStrokeEditIdsRef.current.set(mutationId, created); return created; } });` (4) `if (!ok && reachedRebake) { const editId = aquarelleStrokeEditIdsRef.current.get(mutationId); if (editId !== undefined && !reanchorAquarelleEditRevision(editId, direction)) aquarelleStrokeEditIdsRef.current.delete(mutationId); }` (5) `return ok;`. State the rationale in a doc comment: `reachedRebake` is the only proof that the restore succeeded and the raw rollback thus ran (the module returns false before `rebake` when `restore` is null), so the re-anchor is confined to the self-inflicted revision drift and never forgives a foreign script mutation; the cache delete covers a 10-cap-evicted edit, after which the next undo rebuilds it from live state.
- Keep the `aquarelle-script` semantics intact: the `replay` path still restores first (inside the module, after the invalidate + durable-base recovery), resets the sheet, awaits the shared Apply, rolls the script back raw on failure, then notifies and republishes the owner. The delete/move/place/transform/reorder handlers are NOT edited (their own guards stay; `ensureBase` exists only where it exists today — R-1, including the pre-existing delete/reorder/place ordering gap that is out of scope).
- Leave `applyFrameModuleState` as the single owner resolver (P8). No new owner gate.

(D) `PhysicsPaintStudio.test.ts` — migrate the TWO existing rows whose asserted text this plan replaces, in the same commit as the route rewrite (test-first: rewrite the assertions, watch them fail, then implement):
- In `it('the replay port restores the snapshot, resets the sheet, and awaits the shared apply')` (`:3211-3225`): keep the route slice (`studio.indexOf('aquarelleScriptHistory: {')` up to `studio.indexOf('undoPaint:', replayStart)`) and assert it contains `replay: (editId, direction) => runScriptReplay({ direction, editId }),`, `hasRecordedStroke: (mutationId) =>` and `replayStroke: async (mutationId, direction) =>`. Then slice the helper with `const runReplayStart = studio.indexOf('const runScriptReplay = useCallback(');` and `const runReplay = studio.slice(runReplayStart, studio.indexOf('const rotoMoveHistory = useRotoPhysicalEditHistory', runReplayStart));` (the generic `useRotoPhysicalEditHistory<RotoEditableState>(` is the real call — search without the paren, and expect exactly one match) and assert it contains `restore: (targetEditId, dir) => restoreAquarelleEditSnapshot(targetEditId, dir)`, `aquarelleResetSheetRef.current?.();`, `rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame))`, `restoreAquarelleSnapshotRaw(revert)`, `rotoScript.notifySourceRevision()`, that `rotoPersistence.invalidateLivePixels(playFrame)` indexes BEFORE `aquarelleResetSheetRef.current?.();`, and that `isPhysicalMutationLocked()` indexes BEFORE `rotoCachedPlayback.stop();`. Keep the region-scoped negatives `not.toContain('applyCurrentScript')` and `not.toContain('physicalEditCoordinator')` ON the runReplay slice — never on the wider hook-input region, which legitimately contains `physicalEditCoordinator` at `:4680-4684`.
- In `it('republishes on the aquarelle stroke-end, delete and history seams')` (`:4092-4113`): replace only the third block (the `replay: async (editId, direction) => {` slice at `:4107-4112`) with the same `runReplay` slice and assert it contains `notify: () => { rotoScript.notifySourceRevision(); }` and `publishOwner: () => { applyFrameModuleState(playFrame); }`; the notify-before-owner-publish ordering now lives in the module, so additionally assert `aquarelleScriptReplay.indexOf('ports.notify();')` is less than `aquarelleScriptReplay.indexOf('ports.publishOwner();')`.
- Add ONE source read near the existing reads: `const aquarelleScriptReplay = readFileSync(fileURLToPath(new URL('./roto/aquarelleScriptReplay.ts', import.meta.url)), 'utf8');` and assert on it the two literals that MOVED into the module — `if (revert === null) return false;` and `ports.rollback(revert)`. Task 3 reuses this binding; do not declare it twice.
- Do not touch the delete-handler row (`:3190-3209`) or any move/appearance/transform/place/reorder row — those handlers are unchanged.

Run the hook suite and the source contract while iterating: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts`.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts src/components/physic-paint/roto/aquarelleScriptReplay.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts && pnpm --filter efx-motion-editor typecheck</automated>
  </verify>
  <done>Every recorded-stroke ledger branch (paint and auto-key-paint, undo and redo) calls `replayStroke` and never `undoPaint()`/`redoPaint()`; unrecorded entries keep the engine path byte-for-byte; the Studio route exposes `hasRecordedStroke` / `replayStroke` and its shared `replay` runs invalidate -> durable base -> prepare -> restore -> reset -> rebake with the guard block BEFORE the playback stop; a false replay after `rebake` re-anchors (or drops) the cached edit id so the stroke stays retryable; both former route-contract rows are migrated onto `runScriptReplay` + `aquarelleScriptReplay.ts`; hook suite, source contract, replay pin and typecheck green (58 -> more hook tests; PhysicsPaintStudio.test.ts stays 288 + the new rows).</done>
</task>

<task type="tdd" tdd="true">
  <name>Task 3: Capture epoch (script revision) at stamp and commit + source contract</name>
  <files>
    app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.ts,
    app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts,
    app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts,
    app/src/components/physic-paint/PhysicsPaintStudio.tsx,
    app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  </files>
  <behavior>
    - A capture stamped before an undo and whose `isStillCurrent` returns false at produce time is rejected before the producer runs (`stale-before-produce`), and its commit never runs.
    - A capture whose epoch moved only AFTER produce settles is rejected at commit (`stale-before-commit`) and its bytes are never published.
    - A capture whose `isStillCurrent` stays true commits exactly as today (accepted outcome, pixels published).
    - A capture with `isStillCurrent` undefined behaves exactly as today (no new rejection; the 13 existing transaction tests stay green untouched).
    - The coordinator stamps the script epoch synchronously at `captureLivePixels` entry and compares it at produce and at commit; the Studio supplies `getScriptEpoch: () => aquarelleStrokesRevision.peek()`.
  </behavior>
  <action>
Write the failing transaction rows first, then implement.

(A) `rotoLivePixelCacheTransactions.ts` — add to `RotoLivePixelCapture<T>` (`:34-43`): `/** 261029-lsr: commit-time identity beyond the per-key revision (the script epoch). Absent = no extra gate. */ isStillCurrent?: () => boolean;`. In `isStillWanted` (`:165-169`) prepend `if (input.isStillCurrent !== undefined && !input.isStillCurrent()) { reject(stage === 'before-produce' ? 'stale-before-produce' : 'stale-before-commit'); return false; }`. In `commit` (`:184-186`) prepend the same guard with `return reject('stale-before-commit');`. The exact literal `input.isStillCurrent !== undefined && !input.isStillCurrent()` must appear exactly twice — the `!== undefined` term is load-bearing (a bare `!input.isStillCurrent?.()` would reject every legacy capture).

(B) `rotoLivePixelCacheTransactions.test.ts` — new `describe('261029-lsr script epoch gate', ...)` reusing the existing harness helpers in this file (the same `createRotoLivePixelCacheTransactions()` + fake produce/commit used by the revision rows; no DOM). Rows: reject-before-produce, reject-before-commit (flip the epoch after the producer resolves — use a deferred promise), accept when stable, and absent-`isStillCurrent` unchanged. Do not edit the 13 existing rows.

(C) `useRotoFramePersistenceCoordinator.ts` — add to `UseRotoFramePersistenceCoordinatorInput` (`:228-245`): `/** 261029-lsr: monotonic script epoch (aquarelleStrokesRevision); a capture refuses to commit when it moved. */ getScriptEpoch?: () => number;`. In `captureLivePixels`, capture `const scriptEpoch = inputRef.current.getScriptEpoch?.();` at the top (synchronously, before any await) and pass `isStillCurrent: scriptEpoch === undefined ? undefined : () => (inputRef.current.getScriptEpoch?.() ?? null) === scriptEpoch,` into the `livePixelTransactionsRef.current.capture({...})` call (`:667-749`). No other behaviour changes; `invalidateLivePixels` (`:766-769`) stays exactly as exported (it is Layer A and the Studio route calls it).

(D) `PhysicsPaintStudio.tsx` — pass `getScriptEpoch: () => aquarelleStrokesRevision.peek(),` in the `useRotoFramePersistenceCoordinator({ ... })` input object at `:1378` (a `peek` read inside a callback: no subscription, no render-body read). `aquarelleStrokesRevision` is already imported at `:195`. No other change.

(E) `PhysicsPaintStudio.test.ts` — add the source-contract rows in the house `toContain` / index style. Reuse the `aquarelleScriptReplay` source binding Task 2 already added (do NOT declare it twice) and add two more reads: `const livePixelTransactions = readFileSync(fileURLToPath(new URL('./roto/rotoLivePixelCacheTransactions.ts', import.meta.url)), 'utf8');` and `const persistenceCoordinator = readFileSync(fileURLToPath(new URL('./hooks/useRotoFramePersistenceCoordinator.ts', import.meta.url)), 'utf8');`. Assert:
- `studio` contains `hasRecordedStroke: (mutationId) =>` and `replayStroke: async (mutationId, direction) =>` (the authored form — the helper is async) and `getScriptEpoch: () => aquarelleStrokesRevision.peek(),`.
- `aquarelleScriptReplay` step order by index on the port CALLS (not the type union or `onStep` labels): `ports.invalidate()` < `ports.restore(` < `ports.resetSheet()` < `ports.rebake()`, and `ports.ensureBase()` before `ports.prepare`.
- `livePixelTransactions` contains the guard literal exactly twice (`livePixelTransactions.split('input.isStillCurrent !== undefined && !input.isStillCurrent()').length - 1 === 2`).
- `persistenceCoordinator` contains `getScriptEpoch` and `isStillCurrent`.
Use positive assertions only — no negative substring gates (comment-text discipline).

Run the targeted files while iterating:
`pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts`.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts && pnpm --filter efx-motion-editor typecheck</automated>
  </verify>
  <done>A capture stamped before a script mutation cannot commit its pixels (rejected before produce and again at commit), a stable capture commits unchanged, captures without the port behave exactly as before (13 existing rows untouched), and the source contract pins the route members, the step order, the guard literal count and the epoch threading; target suites and typecheck green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|---------|-------------|
| UI/live state -> script store | A stale `mutationId` or a stale edit id from a previous frame crosses into the revision-authoritative snapshot swap |
| async capture pipeline -> bake cache | A capture queued before a script mutation lands its pre-mutation pixels after the mutation |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261029-01 | Tampering | `beginAquarelleStrokeUndoEdit` / `restoreAquarelleEditSnapshot` | medium | mitigate | Finite-only ids, refusal for unknown/already-tombstoned ids, and the existing `aquarelleStrokesRevision` guard fail closed (null -> replay false, stacks untouched) |
| T-261029-02 | Tampering | `rotoLivePixelCacheTransactions.commit` | high | mitigate | Two-layer commit-time gate: per-key revision (`stale-before-commit`) plus the `aquarelleStrokesRevision` epoch via `isStillCurrent`; late acks are dropped, never baked |
| T-261029-03 | Tampering | replay route ordering | medium | mitigate | `invalidateLivePixels` is the first synchronous step, before the snapshot swap and before `applyAquarelleTimeline`'s force-flush; pinned by the orchestration test and the source contract |
| T-261029-04 | Denial of service (data loss) | failed replay / failed bake | low | accept | Fail closed returns false with the script rolled back (`restoreAquarelleSnapshotRaw`); the ledger stays untouched and `reanchorAquarelleEditRevision` re-seats the attempted side, so the undo is retryable — no throw reaches the shortcut handler |
| T-261029-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package installs in this plan; no dependency, manifest or lockfile change is authorized |

ASVS V5 note: no new input surface. Ids come from the app-owned mutation ledger, not from user text; the finite/integer guards already in `aquarelleRecordState` (`normalizeAquarelleMutationIds` style) are reused.
</threat_model>

<verification>
## Automated gates

1. Targeted suites (app package, cwd `app/` via pnpm):
   `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/aquarelleScriptReplay.test.ts src/components/physic-paint/view/aquarelleStrokeSelection.test.ts src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts`
2. Full suite: `pnpm --filter efx-motion-editor exec vitest run` (HEAD baseline: app 360 files / 6,316 tests) — never watch mode.
3. Typecheck: `pnpm --filter efx-motion-editor typecheck` (clean at HEAD in ~9 s).

## The invariant the pin must prove

After a recorded-stroke undo the displayed frame and the published bake are the SAME bytes:
`digestRenderedFrameBytes(displayBytes) === digestRenderedFrameBytes(publishedBakeBytes)`,
using the existing FNV-1a helper in `performance/aquarelleRenderSplitCapture.ts` — not merely
"a re-bake was requested". The negative control in `aquarelleScriptReplay.test.ts` (no reset ->
digests differ) is what keeps the pin honest.

## Migrated source-contract rows (coverage is moved, never dropped)

`PhysicsPaintStudio.test.ts:3211-3225` (the 261022-pim replay-port body) and `:4107-4112`
(the notify -> owner-publish ordering) assert Studio text this plan removes. Task 2
migrates both onto the `runScriptReplay` slice and `roto/aquarelleScriptReplay.ts`, so the
rows still prove restore -> reset -> shared apply -> raw rollback -> notify -> owner
publish, invalidate-before-reset, and guards-before-playback-stop. Those two rows are the
reason Task 2's `<verify>` runs `PhysicsPaintStudio.test.ts` — the plan's "full suite green"
criterion is only satisfiable once they are owned by a task.

## Retryability after a failed bake (must_haves truth 5)

A false replay that reached `rebake` means the restore succeeded and `restoreAquarelleSnapshotRaw`
ran, bumping the revision without writing it back into the edit — so Task 2 re-anchors the
cached edit id (`reanchorAquarelleEditRevision`, Task 1) before returning false. A false
replay that never reached `rebake` (missing request, refused prepare, stale-authority
`restore` null) is a genuine fail-closed and is NOT re-anchored: a foreign script mutation
must keep failing the guard. Residual, out of scope: if the 10-entry edit cap evicted the
record before the failure, there is nothing to re-anchor; the cache entry is dropped and
that particular redo cannot be replayed (it could not be before this plan either).

## Native UAT rows (the user's — real GPU pixels are out of reach under `vitest run`)

1. Script ON, one stroke, Cmd+Z: the stroke leaves the canvas AND the script; Cmd+Shift+Z restores both; a second Cmd+Z removes it again.
2. Immediately after the undo, Move (M) and Lift see the same pixels as the canvas (no ghost stroke).
3. Script OFF, one stroke, Cmd+Z: pixels are removed with no script mutation and no full re-bake flash.
4. Auto-key: create key + first stroke, Cmd+Z once removes both; redo restores both.
5. Undo pressed while playback is running: playback stops, then the frame re-bakes.
6. P8 ownership row: undoing the frame's last paint stroke (leaving a lift-only or empty script) re-resolves the module owner (Brush slot unlocks/locks) — observed, not gated by new code.
7. Record ON, paint a stroke, then immediately (within the capture quiet window) press Cmd+Z after switching nothing: the frame settles to the post-undo bake with no pre-undo pixels reappearing.

## Known limitation (pre-existing, out of scope)

A mixed frame (Script toggled mid-frame) whose UNRECORDED entry sits BELOW a recorded one still
routes that unrecorded entry to `undoPaint()`; after a script re-bake the engine history is a
re-bake history, so that entry is no better off than it is today after a delete/move. The plan's
rule is the literal P1 one: recorded strokes never touch `undoPaint()`, and a false script replay
never falls back to it. Do not widen the aquarelle engine port (`aquarelleEnginePort.ts` says
"Do NOT widen") to add a history reset.
</verification>

<success_criteria>
- [ ] `beginAquarelleStrokeUndoEdit` builds `after` = WITH, `before` = WITHOUT (tombstone + timeline removal), both at the live revision, and the immediate undo passes the guard.
- [ ] `reanchorAquarelleEditRevision` re-seats only the attempted side after a failed re-bake, so the next Cmd+Z retries the same stroke; the opposite direction stays fail-closed and nothing else is forgiven.
- [ ] The two existing route-contract rows (`PhysicsPaintStudio.test.ts:3211-3225`, `4107-4112`) are migrated onto the new slices by the task that replaces their text, and that task's verify runs `PhysicsPaintStudio.test.ts`.
- [ ] `runAquarelleScriptReplay` enforces invalidate -> ensure-base -> prepare -> restore -> reset -> rebake, returns false on every failure path, and never throws.
- [ ] The orchestration pin asserts step order, display-digest == bake-digest, the negative control, and the rejected pre-undo capture.
- [ ] `paint` and `auto-key-paint` undo/redo route recorded strokes through `replayStroke` and unrecorded strokes through `undoPaint()` / `redoPaint()`; no fallback after a false replay.
- [ ] The Studio route exposes `hasRecordedStroke` / `replayStroke`, wraps both through one `runScriptReplay` whose mutation guards run BEFORE `rotoCachedPlayback.stop()` (a refused replay stops nothing), and keeps `applyFrameModuleState` as the only owner resolver.
- [ ] A capture stamped before a script mutation is rejected before produce and at commit; the epoch is threaded from `aquarelleStrokesRevision` through the coordinator into the transaction.
- [ ] No new dependency, no new vitest config, no daemon/flag shim; the five target suites (including `PhysicsPaintStudio.test.ts`), the full app suite and typecheck are green.
</success_criteria>

<output>
Create `.planning/quick/261029-lsr-undo-script-authoritative-undo-for-aquar/261029-lsr-SUMMARY.md` when done. It must state, verbatim, the locked signal decisions: (a) recorded strokes are script-authoritative through `runAquarelleScriptReplay`, unrecorded strokes stay engine-only; (b) `invalidateLivePixels(playFrame)` is the first synchronous step of the replay route; (c) the capture gate is two-layered (per-key revision + `aquarelleStrokesRevision` epoch) and runs at produce and commit; (d) the deterministic pin is an orchestration pin — native UAT owns real pixels.
</output>
