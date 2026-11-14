---
phase: quick-261027-klx
plan: W3
wave: 3
status: complete
stop_conditions: []
resolved_conditions: []
commit: 7622f6a8
plan_head_before: c6edcf58a2ccb55b46c99388710174a680fa8fef
plan_head_after: 7622f6a8e98666cacac330098a0ef7426f775ba4
commits: 1
files_changed: 45
insertions: 2217
deletions: 4266
date: 2026-10-27
---

# Phase quick-261027-klx — Wave 3 Summary

**Status: COMPLETE.** The shared layer is watercolor-only: the Roto layer, the
local stroke projection, the script engine identity, SNAP v5 and the
performance instrumentation no longer reference engine-1, and the Studio
allocates every watercolor stroke id from the app-owned `PaintMutationLedger`
through ONE memoized port instance. The app remains **intentionally
non-compiling** for the Wave 4 file set only — the committed census is 17 files
/ 146 errors, every one inside the Wave 4 `<files>` list (plus
`PhysicsPaintStudio.tsx`, which belongs to both Wave 3 and Wave 4).

## What landed (3.1 – 3.9 + 3.8b)

1. **3.1 `AquarelleEnginePort`** — new
   `app/src/components/physic-paint/engine/aquarelleEnginePort.ts`:
   `{ snapshot, restore, exportCanvas(background = 'transparent', texture = true),
   undo: () => boolean, redo: () => boolean, clear }` plus
   `createAquarelleEnginePort(getEngine)` and
   `AquarelleEngineUnavailableError`. `AquarelleCanvasLayer` publishes it via
   the new `onEnginePortReady?: (port | null)` callback seam (construction and
   both cleanup paths). The `WatercolorEngine` itself is never exported and the
   interface was never widened.
2. **3.2 Re-homed members** — `resetBackground`, `clearPreviewBaseImage`,
   `getPreviewBasePaintSource` and `loadReferenceFrame` live in app state
   (`RotoPreviewBasePort` + the cached reference path), not on the port.
   `flushPendingStrokeFinalizations` is the ledger port's injected no-op.
3. **3.3 Roto retype** — `rotoCoordinatorPorts.ts`,
   `rotoEditBufferTransactions.ts`, `rotoSaveTransactions.ts`,
   `useRotoFramePersistenceCoordinator.ts`, `useRotoReferenceController.ts`,
   `rotoCanvasFrames.ts`, `useRotoFrameEditingController.ts`,
   `useRotoPersistenceIntegration.ts`, `useRotoPhysicalEditCoordinator.ts` and
   `useRotoPhysicalEditHistory.ts` now use the local `types/paintCore.ts`
   types and `RotoEditableState` (= watercolor `DocumentSnapshot`).
   `rotoCanvasFrames.ts` keeps the snapshot → transparent export → restore
   ordering, so the exported frame is unchanged.
   `RotoCanvasPort` no longer redeclares `clear` (the narrower signature made
   `RotoCanvasAndPreviewBasePort extends RotoCanvasPort, RotoPreviewBasePort`
   fail with TS2320); it now carries only
   `flushPendingStrokeFinalizations`, and the shared `clear(preserveDry?)`
   comes from `RotoPreviewBasePort`.
4. **3.4 Script identity** — `ROTO_SCRIPT_ENGINE_ID` and every engine-1 shape,
   guard and builder are deleted (`createPersistedRotoScript` is gone;
   `physicsPaintRotoScriptSchema.test.ts` pins its absence).
   `ROTO_SCRIPT_ENGINE_ID_AQUARELLE` is the only produced identity;
   `ROTO_SCRIPT_LEGACY_ENGINE_ID = 'efx-physic-paint'` exists only to CLASSIFY
   an old envelope as refused. The `'efx-physic-paint': 'Brush'` refusal entry
   and Krita are untouched. The duplicate-script ports are renamed per plan:
   `captureBrushScript` / `applyBrushScript` → `captureScript` / `applyScript`,
   with the Studio implementations updated in the same commit.
5. **3.5 Persistence truth** — `shouldPersistRotoFrame` reads
   `shouldPersistRotoFrameFromTruth({ recordedStrokeCount, payloadEventCount,
   bgMode })` from `aquarelleRecordState` + settings. The regression row
   `'261027-klx regression: engine-1 mirror empty, watercolor recorded strokes
   present → persist'` is green in `rotoSaveTransactions.test.ts`.
6. **3.6 Ledger wiring in the Studio** — see the dedicated section below.
7. **3.7 SNAP v5** — see the dedicated evidence section below.
8. **3.8 Performance instrumentation** — engine-1 sample types, metrics and
   the provenance/brush memory sections are gone from
   `physicsPaintPerformanceTrace.ts`, `scriptMemorySnapshot.ts`,
   `studioScriptMemoryGauge.ts` and `moveProvenanceCapture.ts`; every Aquarelle
   and audio counter survives. The move-provenance build marker is
   `MOVE_PROVENANCE_BUILD = 'quick-261027-klx-diag-11-watercolor-only'`.
9. **3.8b Test dispositions** — every file the Wave 3 verify runs is owned by
   this wave and green: the duplicate-script, registry-ownership, reveal-bake,
   completion-guard, script-memory, gauge, snapshot-controller, library and
   Studio suites were retargeted to the watercolor shapes; the Studio test no
   longer performs a module-load read of any deleted module (its only
   `readFileSync` targets are surviving files).
10. **3.9 Commit** `7622f6a8` — `refactor(261027-klx): watercolor-only Roto,
    script and SNAP v5`, 45 files, +2,217 / −4,266. Pathspec-scoped staging
    only.

## Ledger ownership (3.6)

`PhysicsPaintStudio.tsx` now uses the Wave 0 ledger for every stroke id:

- `handleAquarelleStrokeEnd` — `const mutationId =
  paintMutationLedger.allocateStrokeMutation({ primary: paintStroke });` — one
  synchronous allocation, no engine, no raster and no finalization queue on
  the path.
- Duplicate-script copies record through the same call.
- The three clock sites (track-switch restore, launch restore, engine-ready)
  are `paintMutationLedger.reserveNextMutationId(...)`; no engine reserves a
  clock.
- The ONE memoized `rotoMutationPort` is passed to `getEngine`,
  `updateEngine` (both seams), `observeCompletedMutation` and
  `getAcceptedTarget`. The port identity is load-bearing: the clipboard keys
  its accepted-target WeakMap by port object.
- `engineState.saveEngineState/loadEngineState` delegate to
  `aquarelleEnginePortRef.current?.snapshot()/restore()`.
- `flushPendingStrokeFinalizations` is the port's no-op.
- Completion is delivered exactly once per allocation:
  `paintMutationLedger.subscribe((mutation) =>
  canvasCompletedMutationImplRef.current(mutation, rotoMutationPort))`.

Pinned by the new Studio describe `'261027-klx Wave 3 — the app-owned ledger
owns stroke acceptance'` (5 cells): allocation with no
`enqueueRecordedStroke`/`flushPendingStrokeFinalizations`, duplicate-script
allocation through the ledger, exactly one completion per allocation through
the ONE port, three `reserveNextMutationId` sites and no
`reserveMutationClock`, and snapshot/restore through the narrow port.

## SNAP v5 clean break (3.7) — evidence

- `STUDIO_SCRIPT_SNAPSHOT_VERSION = 5`;
  `STUDIO_SCRIPT_SNAPSHOT_VERSIONS = new Set([5])`.
- Container versions 1–4 hit the dedicated
  `fail('snap-v4-retired', 'SNAP predates the watercolor-only format', 4)`
  before the generic version reject (0/≥6 keep the generic `version` code);
  the Rust `STUDIO_SCRIPT_SNAPSHOT_FORMAT_VERSION` stays 1 (S3 avoided).
- The brush body is removed from encode AND decode; every `Reader` bounds
  check is intact.
- The pinned message is exactly:
  `Studio script snapshot could not be restored — it was written by an earlier
  Studio format that predates Water color only. The frame pixels are
  unchanged.`

Green cells in `snapshot/studioScriptSnapshotController.test.ts` (describe
`'studioScriptSnapshotController — SNAP v5 clean break (261027-klx)'`) and
`performance/studioScriptSnapshotCodec.test.ts`:

| File | Cell | What it pins |
|---|---|---|
| codec | `names the clean break for every retired container version (1-4)` | `snap-v4-retired` for 1–4 |
| codec | `rejects an unknown container version with the version code` | 0/≥6 stay generic |
| codec | `carries no brush body: the decoded result is exactly the watercolor container` | no Brush section |
| controller | `refuses every retired container version with the pinned notice` | all four versions, `maxRestoredMutationId: 0` |
| controller | `pins the exact clean-break wording and never shows the generic message` | exact string; no `(corrupt:version)` / `snap-v4-retired` leak |
| controller | `reports exactly once per binding and re-arms on a new bind` | one notice per binding |
| controller | `seeds nothing from a retired container — no rows, no anchors, no bases` | timeline, key anchors and durable bases untouched |
| controller | `keeps the generic message for a genuinely unknown container version` | generic path preserved |

## `getAcceptedTarget` same-then-consume — evidence

`roto/physicsPaintRotoScriptClipboard.test.ts:483`, cell
`'getAcceptedTarget is same-port, same-id and CONSUMES on read (the
ledger-port identity contract)'`:

- same port object + same id → the accepted target
  (`{ ...claim, publishPixels: true, publicationIdentity: undefined }`);
- a SECOND read of the same id → `null` (consume-on-read);
- a structurally identical foreign port → `null` for both ids (a different
  WeakMap key is never the same target).

The Studio satisfies it because every seam reads the ONE memoized
`rotoMutationPort`, never an engine instance that changes identity.

## Commands run and results (re-run post-commit)

| # | Command | Result |
|---|---|---|
| 1 | exact plan `<verify>` — 23-file vitest | PASS — **23 files / 824 tests**, exit 0 (`PhysicsPaintStudio.test.ts` alone: 288) |
| 2 | `pnpm --dir packages/efx-watercolor run check` (`tsc --noEmit`) | PASS — exit 0 |
| 3 | `pnpm --dir packages/efx-watercolor exec vitest run` | PASS — **10 files / 136 passed + 4 skipped (140)** |
| 4 | typecheck census | 17 files / 146 errors, all inside the Wave 3+4 `<files>` union |
| 5 | `git add --` exact paths + commit | PASS — `7622f6a8`, 45 files, +2,217 / −4,266 |
| 6 | post-commit deletion / untracked checks | PASS — **no deletions**, no untracked files, tree clean |

The `[aquarelle-render-split] write failed …` lines in the vitest stderr are
non-fatal host-probe noise (no Tauri runtime in vitest); they do not affect any
test result.

## Typecheck census — 17 files / 146 errors

Paths as tsc emits them (relative to `app/`), with error counts:

```
117  src/components/physic-paint/PhysicsPaintStudio.tsx
  6  src/components/physic-paint/view/RightPanelMemoryTab.tsx
  3  src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts
  3  src/components/physic-paint/view/frameScriptOwnership.test.ts
  3  src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
  2  src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
  2  src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
  1  src/components/physic-paint/view/PhysicsPaintToolRail.tsx
  1  src/components/physic-paint/view/panelSplitShell.test.tsx
  1  src/components/physic-paint/view/frameScriptOwnership.ts
  1  src/components/physic-paint/hooks/usePhysicsPaintWorkflowIntegration.ts
  1  src/components/physic-paint/hooks/usePhysicsPaintSessionController.ts
  1  src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.test.ts
  1  src/components/physic-paint/engine/usePhysicsPaintEngineLifecycle.ts
  1  src/components/physic-paint/engine/usePhysicsPaintEngineActions.ts
  1  src/components/physic-paint/engine/physicsPaintStudioSettings.ts
  1  src/components/physic-paint/engine/PhysicsPaintCanvasMount.runtime.test.ts
```

**Census verdict: PASS.**

- **Every file is inside the Wave 4 `<files>` list**, except
  `PhysicsPaintStudio.tsx`, which the plan lists in both the Wave 3 and the
  Wave 4 blocks. Zero census files outside the union (Wave 2 was 49 files;
  Wave 3 is 17).
- **Error classes:**

| Code | Count | Cause |
|---|---:|---|
| TS2304 | 103 | all in `PhysicsPaintStudio.tsx` — Brush identifiers still read by the Wave 4 branches (`PreviewBackgroundEngine` 30, `flushBrushScriptFrame` 6, `EfxPaintEngine` 5, `studioScriptSnapshotReservedNextMutationIdRef` 5, `applyBrushScriptStrokeAppearance` 2, `brushScriptEditionPort` 1, `resolveFrameScriptOwner` 2, …) |
| TS2307 | 20 | deleted-module imports in Wave 4 files: `@efxlab/efx-physic-paint` 12, `@efxlab/efx-physic-paint/preact` 1, `./brushScriptRecordState` 3, `./BrushModuleSection` 2, `./BrushScriptOverlay` 1, `../view/brushScriptRecordState` 1 |
| TS7006 | 6 | implicit-`any` cascades from those unresolved modules |
| TS2339 | 6 | missing members on the unresolved engine-1 types |
| TS2353 | 4 | `getModule` on `RotoDuplicateWithScriptPorts` (×1), `getEngine` on `MoveProvenanceDeps` (×1), `brush` on the watercolor `ScriptMemorySnapshot` in the Wave 4 right-panel test (×2) |
| TS6196 | 2 | unused `EfxPaintDocument` / `RotoPreviewBasePort` imports in the Studio (Wave 4 cleanup) |
| TS2722 | 2 | possibly-undefined optional call in the Studio's Wave 4 branches |
| TS2724 | 1 | Studio still imports the removed `temporaryErase` export (surviving module, Wave 4 branch) |
| TS6133 | 1 | `handleAquarelleEnginePortReady` declared but not yet consumed — the Wave 4 mount must forward it |
| TS2554 | 1 | one zero-arg call given an argument in a Wave 4 branch |

- The plan's expected state holds: **the Studio's imports of the deleted
  Wave-2 modules are gone** (`applyBrushScriptStrokeAppearance` and
  `brushScriptEditionPort` have no import; their three remaining call sites
  are deliberately Wave 4 surface, as the plan directs). The Studio also no
  longer reads any deleted module at test-load time.

## Deviations from plan

1. **D1 — `flush` is a ledger-port no-op, not an `AquarelleEnginePort`
   member** (the deviation 3.8b requires recording). CONTEXT.md's port list
   names `snapshot/restore/exportCanvas/undo/redo/clear/flush`; watercolor has
   no pending-finalization queue, so `flushPendingStrokeFinalizations` is
   satisfied at the ledger boundary — `getRotoPort(ledger, { … })` injects it —
   and `AquarelleEnginePort` stays at six members.
2. **D2 — `undo`/`redo` return `boolean`.** The Roto frame-editing controller
   gates on the result, and the watercolor engine returns a boolean; the port
   publishes it instead of discarding it.
3. **D3 — `AquarelleExportBackground` is a local union.**
   `@efxlab/efx-watercolor` declares `ExportBackground` but does not re-export
   it from its barrel, so the port declares
   `'transparent' | 'paper' | 'white'` locally rather than editing the
   vendored package outside this wave's `<files>` (TS2459 fix).
4. **D4 — `HostScriptRefusal` imported from `@efxlab/efx-paint-host`** in
   `physicsPaintRotoScriptSchema.ts` (TS2304 ×3) — the type exists in the host
   package's exports and was previously supplied transitively.
5. **D5 — `RotoCanvasPort.clear` removed** to resolve TS2320 on
   `RotoCanvasAndPreviewBasePort`; the shared signature stays on
   `RotoPreviewBasePort`.
6. **D6 — two out-of-wave fixtures retargeted.** `createPersistedRotoScript`
   is deleted by 3.4, and `roto/physicsPaintRotoScriptLibrary.test.ts` +
   `hooks/useRotoScriptLibraryController.test.ts` were its only other
   importers; they now build their fixture with
   `serializeAquarelleRotoScript` + a real `AquarellePayloadEvent` timeline
   (Rule 3 blocking fix — the alternative was leaving two red suites outside
   the wave).
7. **D7 — `resetBackground` is a deliberate no-op at the preview-base seam.**
   The engine-1 mapping called `resetBackground()`; mapping it to
   `clearPreviewBaseImage()` would wipe the visible multiply base and the
   first dirty stroke would erase the cached key's paint. The no-op is
   documented in `useRotoFrameEditingController.ts`.
8. **D8 — `onEnginePortReady` is wired on the Studio side but not forwarded by
   the Wave 4 canvas mount**, so `aquarelleEnginePortRef` stays `null` until
   Wave 4 attaches the prop; `TS6133` names it in the census. Wave 4 owns that
   file and that props change.
9. **D9 — library save and reveal bake fail closed on a script without a
   watercolor wash timeline.** With the Brush body retired, a capture or
   render request that carries no `aquarelleEvents` is refused rather than
   written empty.
10. **D10 — `PaintSeam.onPreviewBaseSettled` added to the completion-guard
    test double.** The settle seam is not part of `RotoPreviewBasePort`, so the
    double declares it explicitly (TS2353 fix).
11. **D11 — reveal-bake harness `bakeEvents` is `Array<readonly unknown[]>`.**
    The pin asserts event-identity (`toBe(events)`), so the harness must store
    the reference, not a copy (TS2339/TS2540 fix).
12. **D12 — the Studio's engine-state generics were retyped to
    `RotoEditableState` at 7 sites** (`RotoPhysicalEditSnapshot`,
    `useRotoPhysicalEditCoordinator`, `replaceFrameStates`,
    `RotoPhysicalEditCoordinatorExecuteInput` ×2,
    `RotoPhysicalEditAcceptedOutput`, `useRotoPhysicalEditHistory`) — the
    port now speaks `DocumentSnapshot`, and the previous explicit
    `EfxPaintDocument` instantiation no longer type-checks (TS2322/TS2345).
13. **D13 — `types/paintCore.ts` was not modified** (read-only this wave); it
    already exports `CompletedPaintMutation`, `PaintHistoryAvailability`,
    `RotoEditableState` and `ToolType`.
14. **D14 — `moveProvenanceCapture`'s Brush/engine sections removed** per 3.8,
    with the build marker bumped to
    `quick-261027-klx-diag-11-watercolor-only` and pinned in the Studio suite.

## Constraints honoured

- Pathspec-scoped staging only: `git add --` with 46 exact paths (45 modified
  + the new `engine/aquarelleEnginePort.ts`). No `git add -A` / `git add .`.
  `.planning/`, `SPECS/`, `app/dist/` and the unrelated dirty `brushes.ts`
  were never staged; `git status` is clean after the commit.
- `pnpm` only, `vitest run` only (never watch), no dev server, no push.
- Preact + `@preact/signals` only; no React patterns, no `useState`.
- Wave 4 imports deliberately NOT fixed: the app stays non-compiling only for
  the Wave 4 file set, exactly as the plan's expected state allows.
- Ledger: `plan_head_before c6edcf58` → `plan_head_after 7622f6a8`, 1 commit
  (measured with `git rev-list --count`).
- Summary written with `status: complete` and deliberately NOT committed.

## Notes for Wave 4

- `PhysicsPaintStudio.tsx` carries 117 of the 146 census errors. The largest
  group is the Brush branch surface (`PreviewBackgroundEngine` ×30,
  `flushBrushScriptFrame` ×6, `EfxPaintEngine` ×5,
  `studioScriptSnapshotReservedNextMutationIdRef` ×5,
  `applyBrushScriptStrokeAppearance` ×2, `brushScriptEditionPort` ×1,
  `resolveFrameScriptOwner` ×2, `temporaryErase` import, and the remainder).
- `handleAquarelleEnginePortReady` exists and is unused: the Wave 4
  `PhysicsPaintCanvasMount` must forward `onEnginePortReady` so the ref is
  populated. Until then `snapshot()`/`restore()` no-op via `?.`.
- The Studio still calls `engineRef.current?.flushPendingStrokeFinalizations()`
  at `:3941` and `engine?.flushPendingStrokeFinalizations()` at `:4700` inside
  Brush branches — Wave 4 removes those paths with the branches.
- The Studio test still contains pins on the Brush canvas mount
  (`'brush: brushScriptEditionPort,'`, `<BrushScriptOverlay`) — they are green
  today because those Wave 4 sources still contain the strings; Wave 4
  rewrites both source and pins.
- `PhysicsPaintStudio.tsx` retains `engine-1` symbol reads at 3 sites
  (`applyBrushScriptStrokeAppearance` ×2, `brushScriptEditionPort` ×1). They
  are the Wave 4 surface the plan explicitly reclassified.

## Self-Check: PASSED

- Commit `7622f6a8` is HEAD; `git show --first-parent --diff-filter=D` lists
  **no deletions**, and `git status --short` is empty (apart from this
  untracked summary file).
- The new `app/src/components/physic-paint/engine/aquarelleEnginePort.ts` is
  present and committed (`create mode 100644`).
- 23-file verify re-run on the committed tree: **23 files / 824 tests passed**.
- Watercolor package: `run check` exit 0; suite **10 files / 136 passed,
  4 skipped**.
- Census re-run on the committed tree: **17 files / 146 errors**, all inside
  the Wave 4 `<files>` list plus the shared `PhysicsPaintStudio.tsx`.
- SNAP v5 pinned message, one-notice-per-binding and no-seeding evidence: all
  green (table above).
- `getAcceptedTarget` same-port/same-id consume-on-read: green (cell quoted
  above).
