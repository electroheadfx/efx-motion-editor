---
phase: quick-261027-klx
plan: 261027-klx
type: execute
wave: 1
depends_on: []
files_modified:
  # Wave 0 — new modules (no deletions) + the one-line port widening
  - app/src/components/physic-paint/types/paintCore.ts
  - app/src/components/physic-paint/engine/paintMutationLedger.ts
  - app/src/components/physic-paint/engine/paintMutationLedger.test.ts
  - app/src/components/physic-paint/engine/paintMutationLedger.purity.test.ts
  - app/src/components/physic-paint/roto/paintMutationRotoPort.ts
  - app/src/components/physic-paint/roto/paintMutationRotoPort.test.ts
  - app/src/components/physic-paint/roto/rotoFramePersistTruth.ts
  - app/src/components/physic-paint/roto/rotoFramePersistTruth.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
  - app/src/lib/paperConditioning.ts
  - app/src/lib/paperConditioning.test.ts
  - app/src/lib/__fixtures__/paperConditioning.golden.json
  - app/src/lib/paperPass.ts
  - app/src/lib/paperPass.frameGuard.test.ts
  - app/src/components/physic-paint/view/stackOrder.ts
  - app/src/components/physic-paint/view/stackOrder.test.ts
  - app/src/components/physic-paint/view/stackOrder.parity.test.ts
  # Wave 1 — package and config
  - packages/efx-physic-paint/**
  - app/package.json
  - app/vite.config.ts
  - package.json
  - pnpm-lock.yaml
  - app/src/efx-paint/host-split/hostAnimationResidueContract.test.ts
  - app/src/efx-paint/efxPaintCleanBreakContract.test.ts
  # Wave 2 — dedicated app deletes
  - app/src/components/physic-paint/view/brushScriptRecordState.ts
  - app/src/components/physic-paint/view/brushScriptEditionPort.ts
  - app/src/components/physic-paint/view/brushScriptHydration.ts
  - app/src/components/physic-paint/engine/BrushScriptOverlay.tsx
  - app/src/components/physic-paint/view/BrushModuleSection.tsx
  - app/src/components/physic-paint/performance/depositSpeckleCapture.ts
  - app/src/components/physic-paint/performance/depositSpeckleCapture.metrics.test.ts
  - app/src/components/physic-paint/performance/scriptMemoryProbe.ts
  - app/src/components/physic-paint/performance/lookDeltaCapture.ts
  - app/src/efx-paint/host-split/preSplitGoldenFixture.ts
  - app/src/efx-paint/host-split/preSplitGoldenParity.test.ts
  - app/src/efx-paint/host-split/hostSplitSuiteGate.test.ts
  - app/src/components/physic-paint/engine/usePhysicsPaintEngineActions.test.ts
  - app/src/components/physic-paint/view/physicsPaintTemporaryErase.ts
  - app/src/components/physic-paint/view/physicsPaintTemporaryErase.test.ts
  - app/src/components/physic-paint/view/physicsPaintTemporaryMove.test.ts
  # Wave 3 — shared rewrite (+ every test file its verify executes)
  - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
  - app/src/components/physic-paint/engine/aquarelleStrokeBridge.ts
  - app/src/components/physic-paint/engine/aquarelleEnginePort.ts
  - app/src/components/physic-paint/roto/rotoCoordinatorPorts.ts
  - app/src/components/physic-paint/roto/rotoCanvasFrames.ts
  - app/src/components/physic-paint/roto/rotoCanvasFrames.test.ts
  - app/src/components/physic-paint/roto/rotoEditBufferTransactions.ts
  - app/src/components/physic-paint/roto/rotoEditBufferTransactions.test.ts
  - app/src/components/physic-paint/roto/rotoSaveTransactions.ts
  - app/src/components/physic-paint/roto/rotoSaveTransactions.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoRegistryOwnership.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptApplyRefusal.ts
  - app/src/components/physic-paint/view/recordedStrokeGroups.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts
  - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts
  - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts
  - app/src/components/physic-paint/hooks/useRotoFrameEditingController.ts
  - app/src/components/physic-paint/hooks/useRotoFrameEditingController.test.ts
  - app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.ts
  - app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.test.ts
  - app/src/components/physic-paint/hooks/useRotoReferenceController.ts
  - app/src/components/physic-paint/hooks/useRotoReferenceController.test.ts
  - app/src/components/physic-paint/hooks/rotoCompletionPaintGuard.test.ts
  - app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts
  - app/src/components/physic-paint/performance/studioScriptSnapshotCodec.test.ts
  - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts
  - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts
  - app/src/components/physic-paint/performance/physicsPaintPerformanceTrace.ts
  - app/src/components/physic-paint/performance/physicsPaintPerformanceTrace.test.ts
  - app/src/components/physic-paint/performance/scriptMemorySnapshot.ts
  - app/src/components/physic-paint/performance/scriptMemorySnapshot.test.ts
  - app/src/components/physic-paint/performance/studioScriptMemoryGauge.ts
  - app/src/components/physic-paint/performance/studioScriptMemoryGauge.test.ts
  - app/src/components/physic-paint/performance/moveProvenanceCapture.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  # Wave 4 — Studio shell and UI gate (+ every test file its verify executes)
  - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
  - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.test.ts
  - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.runtime.test.ts
  - app/src/components/physic-paint/engine/MemoizedPhysicsPaintCanvasMount.ts
  - app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts
  - app/src/components/physic-paint/engine/physicsPaintStudioSettings.test.ts
  - app/src/components/physic-paint/engine/usePhysicsPaintEngineLifecycle.ts
  - app/src/components/physic-paint/engine/usePhysicsPaintEngineActions.ts
  - app/src/components/physic-paint/engine/usePhysicsPaintEngineActions.test.ts
  - app/src/components/physic-paint/engine/physicsPaintDevExport.ts
  - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
  - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.test.ts
  - app/src/components/physic-paint/hooks/usePhysicsPaintSessionController.ts
  - app/src/components/physic-paint/hooks/usePhysicsPaintWorkflowIntegration.ts
  - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
  - app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts
  - app/src/components/physic-paint/view/physicsPaintRightPanelModuleGate.test.ts
  - app/src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts
  - app/src/components/physic-paint/view/RightPanelMemoryTab.tsx
  - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts
  - app/src/components/physic-paint/view/frameScriptOwnership.ts
  - app/src/components/physic-paint/view/frameScriptOwnership.test.ts
  - app/src/components/physic-paint/view/panelSplitShell.test.tsx
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/shared/activeModule.ts
  - app/src/components/shared/activeModule.test.ts
  - app/src/components/shared/frameModuleLock.ts
  - app/src/components/shared/frameModuleLock.test.ts
  - app/src/components/shared/ModuleSwitcher.tsx
  - app/src/components/shared/ModuleSwitcher.test.tsx
  # Wave 5 — Rust
  - app/src-tauri/src/services/script_library.rs
  - app/src-tauri/tests/script_library_schema.rs
  - app/src-tauri/tests/script_library_transaction_contract.rs
  - app/src-tauri/src/services/studio_script_snapshot.rs
  # Wave 6 — gates
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/lib/paperPass.frameGuard.test.ts
  - app/src/efx-paint/host-split/hostSplitSuiteGate.test.ts
  - app/src/viteBuild.test.ts
  - .planning/quick/261027-klx-remove-engine-1-called-brush-mode-efx-ph/261027-klx-W6-SUMMARY.md
autonomous: false

requirements: []

estimate:
  tokens: 95000
  raw_tokens: 47500
  tasks: 7
  confidence: low

must_haves:
  truths:
    - "The Studio builds and runs with no `@efxlab/efx-physic-paint` package installed: the dependency, both Vite aliases, the optimizeDeps entry, the root build/dev:paint scripts and the lockfile entry are gone; no surviving runtime source imports the specifier; the remaining test/fixture occurrences are enumerated negative guards and refusal rows."
    - "Every watercolor stroke receives its mutation ID from the app-owned ledger: IDs are monotonic, never reused, seeded from the restored max + 1, and acceptance order equals stroke-end order — and the ledger emits the mutation-completion event itself, with no rasterization, finalization or hidden rendering."
    - "Roto script save/copy/apply reads accepted strokes through ONE memoized port object, so `getAcceptedTarget` returns the accepted target for that same key and consumes it; no path calls engine-1 for stroke identity or acceptance."
    - "Paper height conditioning is byte-identical to the engine-1 implementation, proven by a committed golden fixture plus a permanent test that compares bytes (NaN and -0 included)."
    - "SNAP is version 5 with no brush body; a version 1-4 container produces exactly ONE clean-break notice per project binding (never the generic unsupported-version wording) and seeds zero rows (`maxRestoredMutationId === 0`)."
    - "Roto frame persistence classifies a frame from the watercolor recorded-stroke truth source, so a painted watercolor frame still persists after the engine-1 document mirror is gone."
    - "The module surface is watercolor-only: no Brush slot, no `activeModule === 'brush'`, no `frameScriptOwner === 'brush'`, and the Studio renders the Aquarelle layers without the hidden engine-1 canvas."
    - "The Studio chunk measures at or below 943,411 bytes, the 2,000 kB build budget still passes, and the Studio still emits at least one `PhysicsPaintStudio-*.js` chunk."
    - "Every do-not-delete surface survives: efx-watercolor, efx-paint-host, efx-spectral, the Aquarelle layers, ScriptStrokeOverlay, recordedStrokeGroups, BrushesDocker, BrushResponsePanel, WatercolorBrushLibrary, aquarelleRecordState, the p5.brush inline FX modules, and the Tauri window label + capability `efx-physic-paint`."
  artifacts:
    - app/src/components/physic-paint/engine/paintMutationLedger.ts
    - app/src/components/physic-paint/roto/paintMutationRotoPort.ts
    - app/src/components/physic-paint/roto/rotoFramePersistTruth.ts
    - app/src/components/physic-paint/types/paintCore.ts
    - app/src/lib/paperConditioning.ts
    - app/src/lib/__fixtures__/paperConditioning.golden.json
    - app/src/components/physic-paint/view/stackOrder.ts
    - app/src/components/physic-paint/engine/aquarelleEnginePort.ts
    - app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts
    - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts
  key_links:
    - "Aquarelle stroke end -> paintMutationLedger.allocateStrokeMutation -> synchronous completion emit -> Studio completion handler -> rotoScript.getAcceptedTarget(port, mutationId) (WeakMap keyed by the ONE port instance)."
    - "paintMutationLedger.getAcceptedStrokes -> paintMutationRotoPort.getStrokes -> normalizeLogicalBrushes -> script capture/save (brushes + aquarelleEvents + alpha canvas)."
    - "restoreAquarelleRecordTimeline -> maxRestoredMutationId -> paintMutationLedger.seedFromRestoredMax -> next allocation (monotonic, never reused)."
    - "SNAP codec v5 -> controller restore -> retired-version kind -> reportRestoreFailureOnce -> one clean-break notice per binding, zero seeded rows."
    - "aquarelleRecordState recorded strokes -> rotoFramePersistTruth -> shouldPersistRotoFrame (a painted watercolor frame persists)."
    - "AquarelleCanvasLayer -> aquarelleEnginePort (snapshot/restore/exportCanvas/undo/redo/clear) -> Roto coordinator ports (no WatercolorEngine internals leaked)."
---

<objective>
Execute `SPECS/engine-1-removal/REMOVAL-INVENTORY.md` waves 0-6 exactly, removing `@efxlab/efx-physic-paint` (engine-1) so `@efxlab/efx-watercolor` is the only paint engine.

Purpose: engine-1 is the Studio's only engine instance today — it holds stroke identity, rasterization, document serialization, Roto frame operations and the accepted-stroke list. Removal is safe only when each job lands somewhere specific. The runtime win is the duplicated per-stroke finalization that every watercolor stroke currently pays for pixels nobody sees (`PhysicsPaintStudio.tsx:6722-6732` -> `acceptStroke` -> full-frame `savedWet` merge at 1920x1080).

Output: an app-owned mutation ledger, a localized paper conditioner, local paint types, a watercolor-only Roto engine port, SNAP v5 with a pinned clean-break notice, a watercolor-only module surface, and a Studio chunk at or below 943,411 bytes.

Plan shape is USER-LOCKED (CONTEXT.md 2026-10-27): ONE plan, seven wave tasks `Wave 0`-`Wave 6`, one wave per executor dispatch, an explicit user "go" between waves. Do not merge, reorder, or re-scope waves. The seven-wave structure supersedes the default tracer-first ordering; Wave 0 carries the vertical-slice role — one ledger path through allocation, acceptance, completion and the Roto port, proven by tests before anything is deleted.
</objective>

<execution_contract>
## EXECUTION CONTRACT (read before touching anything)

This plan is executed as **seven separate dispatches**, not one run.

1. **One dispatch = exactly ONE wave.** Execute only the wave named in the dispatch prompt. Do not start, preview, or partially land another wave.
2. **Commit that wave's code atomically.** `git add -- <exact paths>` only — never `git add -A`, never `git add .`. Deletions are staged with `git add -- <path>` (git records the removal) or `git rm -- <path>`; use one form consistently inside a wave.
3. **Write the per-wave summary** to `.planning/quick/261027-klx-remove-engine-1-called-brush-mode-efx-ph/261027-klx-W{wave}-SUMMARY.md` (wave number, files touched, commands run with results, gate verdicts, deviations, stop conditions hit).
4. **Then STOP.** Report `## WAVE {n} COMPLETE` with the summary path and the gate results. The orchestrator waits for an explicit user "go" before dispatching the next wave. **No auto-advance.**
5. **Never stage or commit** `.planning/debug/`, `SPECS/`, or a pre-existing unrelated `brushes.ts` modification. If `git status` shows an unrelated dirty file, leave it dirty and say so.
6. **Never push.** The user owns all remote operations.
7. **pnpm only. `vitest run` only (never watch). Never start the dev server.** The user runs the app.
8. **No new dependency, no visual redesign.** This quick removes one workspace package and adds none.
9. **Preact + @preact/signals only** — no `useState`; store setters compare-then-write and never bump on a no-op; no selection logic in effects; no signal writes in a render body; every self-rescheduling path states its termination condition (`efx-preact-reactivity`).
10. **Async discipline** — no new boolean-flag lifecycle clusters; the ledger's completion emit is synchronous and bounded; any queue/flush surface keeps its existing bounded-turn contract (`efx-async-orchestration`).

### Path form
Every path in this plan body is repo-root-relative and every `<automated>` command assumes cwd = checkout root. Only `<required_reading>` inputs are absolute.

### Stop-and-report conditions (halt the dispatch, do not improvise)
- **S1** The ledger cannot demonstrate the semantic contract (monotonic, never reused, seeded from restored max + 1, acceptance order == stroke-end order, completion without rasterization).
- **S2** A file on the do-not-delete list (§Hard gate 2 / inventory §8) appears to be required for deletion, or a planned delete turns out to have a live surviving importer you cannot re-home.
- **S3** Any gate fails twice in a row for the same reason.
- **S4** The Studio chunk exceeds **943,411 bytes** (`ls -l app/dist/PhysicsPaintStudio-*.js`).
- **S5** A delete would drop coverage for a surviving export (e.g. `temporaryMove`), or a test file breaks for a reason outside the wave's stated expected-failure list.
- **S6** A do-not-delete surface (`efx-watercolor`, `efx-paint-host`, `efx-spectral`, Aquarelle layers, `ScriptStrokeOverlay`, `recordedStrokeGroups`, `BrushesDocker`, `BrushResponsePanel`, `WatercolorBrushLibrary`, `aquarelleRecordState`, `brushP5Adapter` / `brushFxDefaults` / `p5brush.d.ts`, Tauri label/capability `efx-physic-paint`) would be modified destructively.

### Gate hygiene rules (apply to every verify command)
- Target only `.test.ts` files. **A `.tsx` test never runs under this project's vitest include** (`app/vitest.config.ts:5` = `['src/**/*.test.ts', '../packages/efx-paint-host/src/**/*.test.ts']`); a `.test.tsx` target "passes" by executing nothing. Use the `.test.tsx.test.ts` launcher instead (e.g. `src/components/shared/ModuleSwitcher.test.tsx.test.ts`).
- Never use `grep -c` on a file whose own header comments carry the token. Use `grep -v '^#' | grep -c` or, for a "must be absent" gate, `! grep -q <pattern> <file>`.
- Never pin a chunk hash (`PhysicsPaintStudio-DcMFAK_W.js`); pin **bytes**.
- Re-measure every census at the start of the wave that needs it; counts drift.

<!-- Comment-text discipline allowlist: these literals ARE the subject of this quick and
     appear inside the verification commands' own greps, so they are named verbatim on
     purpose. The allow markers exempt only the exact literal they name. `WATERCOLOR_ONLY`
     and the quoted module id are named only to say which tokens Wave 4 must DELETE from
     the three gate files — never to keep them there. -->
<!-- planner-discipline-allow: efx-physic-paint -->
<!-- planner-discipline-allow: @efxlab/efx-physic-paint -->
<!-- planner-discipline-allow: const SCRIPT_ENGINE_ID -->
<!-- planner-discipline-allow: WATERCOLOR_ONLY -->
<!-- planner-discipline-allow: 'brush' -->
</execution_contract>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@.claude/skills/efx-preact-reactivity/SKILL.md
@.claude/skills/efx-async-orchestration/SKILL.md
@.planning/quick/261027-klx-remove-engine-1-called-brush-mode-efx-ph/261027-klx-CONTEXT.md
@.planning/quick/261027-klx-remove-engine-1-called-brush-mode-efx-ph/261027-klx-RESEARCH.md
@SPECS/engine-1-removal/REMOVAL-INVENTORY.md

Verified in the live tree on 2026-10-27 (line numbers drift after any edit; re-grep before cutting):

- `app/src/components/physic-paint/view/stackOrder.ts:7-13` — a runtime re-export of three functions from the package. Package implementations at `packages/efx-physic-paint/src/engine/stackOrder.ts:21,33,44` (`clampStackPosition`, `targetIndexForStackPosition`, `reorderForStackPosition`) plus `StackReorderResult`. Arrays are BOTTOM -> TOP; `reorderForStackPosition` returns the SAME reference on a no-op.
- `packages/efx-physic-paint/src/core/paper.ts:85-92` — `conditionHeightMap` (8-line body, one dependency: `clamp` at `src/util/math.ts:56-58`). Re-exported at `src/index.ts:5`.
- `app/src/lib/paperPass.ts:1` — `import { conditionHeightMap } from '@efxlab/efx-physic-paint';`; only call site `:267`.
- `app/src/lib/paperPass.frameGuard.test.ts:80-82` — P4(e) reads the package SOURCE at module load (`readFileSync('.../packages/efx-physic-paint/src/index.ts')`). Deleting the package throws ENOENT for the whole suite file, not one assertion.
- `app/src/efx-paint/host-split/hostAnimationResidueContract.test.ts:235,253` — `readFileSync(ENGINE1_PACKAGE_JSON)` and `readFileSync(ENGINE1_TSUP_CONFIG)` with paths under `packages/efx-physic-paint/`. **Second file that breaks at module load on package deletion** (not in the inventory, not in the research). It is also a `STANDING_PINS`-adjacent pin listed by `hostSplitSuiteGate.test.ts`.
- `app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts` — `STUDIO_SCRIPT_SNAPSHOT_VERSION = 4` (`:62`); `STUDIO_SCRIPT_SNAPSHOT_VERSIONS = new Set([1, 2, 3, 4])` (`:64-69`); generic reject `fail('version', \`unsupported SNAP version ${version}\`, 4)`.
- `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts:671-673` — `studioScriptSnapshotRestoreFailureMessage(kind)` returns `Studio script snapshot could not be restored (${kind}). The frame pixels are unchanged.`; the dedupe flag `restoreFailureReported` is reset only in `bind()` and `reset()`.
- `app/src-tauri/src/services/studio_script_snapshot.rs:63` — `STUDIO_SCRIPT_SNAPSHOT_FORMAT_VERSION: u32 = 1` is the **file-name** version (`<trackId>-v1.snap`), independent of the container u16. Do not bump it.
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts:2` — runtime import `{ toStudioStroke, fromStudioStroke, type CompletedPaintMutation, type PaintStroke }` from engine-1. `:123-130` `RotoScriptEnginePort`; `:319` `acceptedTargets = new WeakMap<RotoScriptEnginePort, Map<number, RotoScriptAcceptedTarget>>()`; `:558` capture gate `brushes.length === 0 || !engine.copyLiveAlphaCanvas`; `:571` `scriptAlphaCanvas: engine.copyLiveAlphaCanvas()`; `:746` `fromStudioStroke(transformRecordedStrokeForHeldPose(toStudioStroke(...)))`.
- `packages/efx-watercolor/src/payload/toStudioStroke.ts:96` — the watercolor `toStudioStroke` exists; `@efxlab/efx-watercolor/payload` exports it. **There is no `fromStudioStroke`** — the inverse must be ported locally.
- `packages/efx-watercolor/src/playground/Engine.ts` public surface: `snapshot()` (:555), `restore()` (:567), `exportCanvas(background, texture)` (:890), `setTool()` (:1064), `setReference()` (:1096), `clear()` (:1246), `undo()` (:1271), `redo()` (:1273), `destroy()` (:1382). **No `resetBackground`, `clearPreviewBaseImage`, `getPreviewBasePaintSource`, `loadReferenceFrame`, `flushPendingStrokeFinalizations`.** `DocumentSnapshot` is exported from `@efxlab/efx-watercolor/playground`.
- `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx:45` — imports `temporaryMove` from `../view/physicsPaintTemporaryErase`; `:84` reads it; `:297` `const engineRef = useRef<WatercolorEngine | null>(null)` — the engine is **never exposed**. `:212-296` the props are callback seams only (`onSnapshotReady`, `onFlushCaptureReady`, `onCaptureFrame`, `onStrokeEnd`, ...).
- `app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx:191-235` — always renders `<EfxPaintCanvas>` inside a div that is only hidden (`opacity: 0`, `pointerEvents: 'none'`) under `aquarelleActive`; also renders `BrushScriptOverlay` when `!aquarelleActive`.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — `:2065` `rotoScript.updateEngine(engineRef.current)`; `:2955-2956` `saveEngineState/loadEngineState`; `:3758` clipboard `allocateMutationId`; `:4999/:5341/:6384` `reserveMutationClock`; `:6386` second `updateEngine`; `:6529` `observeCompletedMutation`; `:6550` `getAcceptedTarget`; `:6579-6580` `if (activeModule.value === 'watercolor') return;` before the cache capture (so `copyLiveAlphaCanvas` is not reached on the watercolor path of the completion handler, but IS still required by the clipboard capture at `:571`); `:6773` `mutationEngine.enqueueRecordedStroke`; `:6722-6732` `handleAquarelleStrokeEnd`.
- `app/src/components/physic-paint/engine/usePhysicsPaintEngineActions.ts:30-122` — 14 engine setters: `selectTool`, `setBrushColor`, `setBrushSize`, `setBrushOpacity`, `setEdgeDetail`, `setPickup`, `setSpread`, `setSmoothing`, `setEraseStrength`, `startPhysics`, `stopPhysics`, plus paper-display `setBackground`, `setGrainStrength`, `setGrainScale`, and `updateSetting`.
- `app/src/efx-paint/host-split/preSplitGoldenFixture.ts:300` — `brushId: 'efx-physic-paint',` inside generated golden data. Consumed only by `preSplitGoldenParity.test.ts` (which the inventory also deletes) and listed by `hostSplitSuiteGate.test.ts` in `PIN_FIXTURES` and `STANDING_PINS`.
- `app/src/components/shared/activeModule.ts` — `ActiveModule = 'brush' | 'watercolor'`, `WATERCOLOR_ONLY = true`, one signal, compare-then-write `setActiveModule`. `frameModuleLock.ts:16` — `FrameScriptOwner = 'brush' | 'watercolor' | 'both' | null`.
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptApplyRefusal.ts:66` — `'efx-physic-paint': 'Brush'` in `ENGINE_DISPLAY_NAMES`. **Pinned by an existing green test**: `app/src/efx-paint/host-split/hostSplitFailClosedApply.test.ts:226` asserts `refusalSource` contains `"'efx-physic-paint': 'Brush'"`.
- `app/src-tauri/src/services/script_library.rs:16` `SCRIPT_ENGINE_ID = "efx-physic-paint"`; `:2152` the `validate_document` engine filter; `:2277/:2429` aquarelle branches in `validate_strokes` / `validate_engine_payload`; `:3107` a test fixture.
- `packages/efx-watercolor/src/determinismContract.test.ts:155-171` — plants `@efxlab/efx-physic-paint` as a NEGATIVE assertion (the package's own deps must not contain it; no source under `src/` may mention it). It is a do-not-delete direction contract, not a live import, and it is the reason G1 cannot be a naive zero-count.
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts:38-39,66,69,70` — `readFileSync` at module load over `brushScriptEditionPort.ts`, `BrushScriptOverlay.tsx`, `scriptMemoryProbe.ts`, `studioScriptMemoryGauge.ts`, `brushScriptRecordState.ts`. Three of those are deleted in Wave 2, so the WHOLE file throws ENOENT until Wave 3 removes those reads (and the pins at `:3456-3537`).
- `app/src/components/shared/frameModuleLock.ts:43-45` — `brushMoveAvailable = owner === 'brush' || owner === 'both'`; imported at `PhysicsPaintStudio.tsx:202`, read `:1697`, `:2329`, `:2575`; test rows at `frameModuleLock.test.ts:88-113`. Under the watercolor-only collapse the same gate becomes `owner === 'watercolor'`.
- `app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts:240,244,298,302` — port members `captureBrushScript` / `applyBrushScript`, implemented at `PhysicsPaintStudio.tsx:3699,3728`. They carry a `RotoPaintScript`, not a Brush script, and they are G2 hits.
- Baselines measured 2026-10-27 with the inventory §10 commands: **G1=91, G2=1,146, G3=12, G4=5, G5=132, 62 importing files**. Studio chunk `app/dist/PhysicsPaintStudio-DcMFAK_W.js` = **943,411 bytes** (built 2026-10-27 12:04).
</context>

<source_audit>
## Multi-source coverage audit

**GOAL** (quick description): remove engine-1 and every Brush runtime path, execute the inventory wave by wave, clean break — COVERED by Wave 1 (package), Wave 2 (dedicated deletes), Wave 3 (shared rewrite), Wave 4 (UI gate), Wave 5 (Rust), Wave 6 (gates).

**REQ** (the user-locked hard gates 1-4 and the gate list): COVERED —
- Hard gate 1 (Wave 0 prerequisites land first and green) — Wave 0.
- Hard gate 2 (do-not-delete list) — stated in `must_haves.truths`, enforced by the Wave 6 do-not-delete probe and stop condition S6.
- Hard gate 3 (clean break, no `.mce` migration, no SNAP v4 compatibility, `engineId` watercolor-only, keep legacy refusal + brushPack validation) — Wave 3 (schema/SNAP), Wave 5 (Rust).
- Hard gate 4 (stop-and-report) — EXECUTION CONTRACT S1-S6.
- Static gates G1-G5, chunk budget, cargo — Wave 6.
- Native UAT rows 1-7 — Wave 6 (report automated-ready only).

**RESEARCH** (features/constraints): COVERED —
- Ledger + `RotoScriptEnginePort` adapter + WeakMap identity — Wave 0 (0.6, 0.7).
- `conditionHeightMap` byte parity + fixture — Wave 0 (0.4).
- Local `BgMode`/`ToolType`/`StackReorderResult`/`PaintStroke`/`PenPoint`/`RotoEditableState` — Wave 0 (0.2).
- `stackOrder` three-function copy + parity — Wave 0 (0.3).
- `paperPass.frameGuard.test.ts` retarget — Wave 0 (0.5).
- `hostAnimationResidueContract.test.ts` module-load break (new, found in planning) — Wave 1 (1.5).
- `physicsPaintTemporaryErase.ts` KEEP/SPLIT + erase-arm removal proof — Wave 2 (2.4) and Wave 3 (3.2).
- `recordedStrokeGroups.ts` / `aquarelleStrokeBridge.ts` / clipboard retype+port — Wave 0 (0.2) and Wave 3 (3.3).
- `usePhysicsPaintEngineActions.ts` split — Wave 4 (4.3).
- `shouldPersistRotoFrame` truth table — Wave 0 (0.8) and Wave 3 (3.5).
- `paperPass` conditioner port, `applyPaperPass`/`encodePassTiles` kept — Wave 0 (0.4).
- `preSplitGoldenFixture.ts` disposition — resolved below and executed in Wave 2 (2.3).
- SNAP codec/controller/message/no-resurrection — Wave 3 (3.7).
- Rust `FORMAT_VERSION` stays 1 — Wave 5 (5.1).

**CONTEXT** (locked decisions, no D-NN ids in this file): COVERED —
- Mutation ledger API + semantic parity + no audit log — Wave 0 (0.6).
- Roto Option A (`AquarelleEnginePort`) + re-homed members — Wave 3 (3.1, 3.2).
- Roto truth table before re-point — Wave 0 (0.8), Wave 3 (3.5).
- Inventory corrections (4) — Wave 0 / 2 / 3 as above.
- Baselines pinned — Wave 0 (0.1), Wave 6.
- SNAP v4 clean break + one notice per binding + pinned message + no seeding — Wave 3 (3.7).
- Plan shape (7 waves, one dispatch per wave) — EXECUTION CONTRACT.
- Module switcher: Brush slot removed, Water color active, Krita inert; `activeModule` collapses; `WATERCOLOR_ONLY` seam deleted — Wave 4 (4.6).
- Script `engineId` watercolor-only; Krita placeholder NOT kept — Wave 3 (3.4), Wave 5.
- "Claude's discretion" items are decided in `<open_item_resolutions>`.

**Non-firing checkpoints:** no external API/SDK is integrated (a workspace package is removed) — the API Coverage checkpoint does not fire. No singular->plural / required->optional / derived->chosen transition (this is plural -> singular) — the Assumption-Delta checkpoint does not fire; the engine identity noun becomes `watercolor` and the decision is recorded as a promoted single source, not a demotion. No ORM/DB schema is in scope — the Schema Push gate does not fire.
</source_audit>

<open_item_resolutions>
## Open items resolved (decisions for the executor — do not re-litigate)

1. **`preSplitGoldenFixture.ts` disposition — DELETE the pair.** `brushId: 'efx-physic-paint'` at `:300` is generated golden DATA, not a live specifier, and its only consumer is `preSplitGoldenParity.test.ts` (inventory §4 deletion). Both files pin the engine-1 host split, which ceases to exist. Wave 2 deletes both and removes their two entries from `hostSplitSuiteGate.test.ts` (`STANDING_PINS` + `PIN_FIXTURES`), recording in the Wave 2 summary that the golden-parity pin is retired because its subject is retired — the surviving host-split pins (`hostImportGraphContract`, `hostAnimationResidueContract`, `hostGenericityRoundTrip`, `hostSplitFailClosedApply`) stay green and untouched in intent.

2. **SNAP accepted-version set — `{5}` only.** `STUDIO_SCRIPT_SNAPSHOT_VERSION = 5`; `STUDIO_SCRIPT_SNAPSHOT_VERSIONS = new Set([5])`. Container versions **1, 2, 3 and 4** all fail with the dedicated code `snap-v4-retired` (one code for the whole retired pre-watercolor-only range), producing the clean-break notice below. Rationale: v1-v4 all carry (or imply) a brush body; keeping them decodable would mean keeping the brush skip logic and risking silent seeding, which the clean break forbids. An unknown version (0, or >= 6) still fails with the generic `version` code.

3. **Wave 1's intentionally broken build — accepted and bounded.** After Wave 1 the app does not typecheck: every surviving engine-1 import is dangling. Wave 1's gate is (a) the MANIFEST/package gate G1m = 0, (b) the two module-load test files retargeted and green, (c) a typecheck error census whose distinct file list must be a subset of the Wave 2-4 expected-failure list. No other error class is acceptable.

4. **`physicsPaintTemporaryErase.ts` erase-arm removal proof.** The engine-1 Alt erase arm calls `engine.setTool` (`:167`). Wave 2 localizes the `ToolType` import and keeps `temporaryMove` + the render gate. Before removing the erase arm, prove no watercolor path arms it: `grep -rn "temporaryErase\|setTemporaryErase" app/src --include='*.ts' --include='*.tsx'` must show no aquarelle-path writer. If a watercolor path does arm it, keep the arm and only localize the type, recording the finding. If nothing writes the erase signal, delete the arm, its exported signal, and the erase cases in `physicsPaintTemporaryErase.test.ts`; keep every `temporaryMove` case.

5. **Test files marked DELETE by the inventory that cover a SURVIVING export are split, not deleted.** `physicsPaintTemporaryMove.test.ts` and `physicsPaintTemporaryErase.test.ts` cover `temporaryMove`, which lives (`AquarelleCanvasLayer.tsx:45,84`). Keep the move cases, delete only the engine-erase cases. `brushScriptRecordState.test.ts` is mixed: delete the Brush half, and move any Aquarelle coexistence assertions into the existing aquarelle test file rather than dropping a green pin.

6. **The "negative test proving watercolor stroke recording no longer touches engine-1" is delivered in two parts.** Wave 0 adds a structural purity test over the NEW modules (`paintMutationLedger`, `paintMutationRotoPort`, `rotoFramePersistTruth`, `paperConditioning` import nothing from engine-1). Wave 3 adds the behavioral half (`handleAquarelleStrokeEnd` allocates through the ledger and completion fires without rasterization). The behavioral half cannot be green before the wiring lands and must not be faked with a skipped test.
</open_item_resolutions>

<tasks>

<!-- ============================================================
     WAVE 0 — prerequisites. NO DELETIONS. Must be green before Wave 1.
     ============================================================ -->
<task type="auto">
  <name>Wave 0: land the blockers — mutation ledger, Roto port, paper conditioner, local types, stack-order copy, Roto truth table</name>
  <files>
    app/src/components/physic-paint/types/paintCore.ts
    app/src/components/physic-paint/engine/paintMutationLedger.ts
    app/src/components/physic-paint/engine/paintMutationLedger.test.ts
    app/src/components/physic-paint/engine/paintMutationLedger.purity.test.ts
    app/src/components/physic-paint/roto/paintMutationRotoPort.ts
    app/src/components/physic-paint/roto/paintMutationRotoPort.test.ts
    app/src/components/physic-paint/roto/rotoFramePersistTruth.ts
    app/src/components/physic-paint/roto/rotoFramePersistTruth.test.ts
    app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
    app/src/lib/paperConditioning.ts
    app/src/lib/paperConditioning.test.ts
    app/src/lib/__fixtures__/paperConditioning.golden.json
    app/src/lib/paperPass.ts
    app/src/lib/paperPass.frameGuard.test.ts
    app/src/components/physic-paint/view/stackOrder.ts
    app/src/components/physic-paint/view/stackOrder.test.ts
    app/src/components/physic-paint/view/stackOrder.parity.test.ts
  </files>
  <action>
    No deletions in this wave. Ordered steps:

    **0.1 Baseline measurement (first).** Run `pnpm --dir app run build`, then `ls -l app/dist/PhysicsPaintStudio-*.js` and record the byte count in the Wave 0 summary. Hard stop S4 if the freshly built Studio chunk exceeds 943,411 bytes — report and stop before any file below is written.

    **0.2 Local paint types — `app/src/components/physic-paint/types/paintCore.ts`.** Pure type declarations, no runtime code, no engine-1 import. Copy the declarations verbatim from the engine-1 package so every existing consumer keeps compiling: `ToolType` (`'paint' | 'erase' | 'move'`, `src/types.ts:60`), `BgMode` (`'transparent' | 'white' | 'canvas1' | 'canvas2' | 'canvas3' | 'photo'`, `src/types.ts:93`), `PenPoint` (`x,y,p,tx,ty,tw,spd`, `:81-89`), `BrushOpts` (`:64-74`), `PaintStroke` (`:172-185`), `PhysicsMode` (`src/types.ts:170`, `'local' | 'last' | 'all' | null` — required by `PaintStroke.physicsMode`), and a local `StackReorderResult<T>` (`{ readonly items: readonly T[]; readonly changed: boolean }`). Copy these THREE additional declarations that surviving consumers still import from the package: `CompletedPaintMutation` (`src/engine/EfxPaintEngine.ts:331-335`, `{ kind: ToolType | 'undo' | 'redo' | 'clear' | 'physics'; isEmpty: boolean; mutationId: number }` — used by `PhysicsPaintStudio.tsx:3`, `physicsPaintRotoScriptClipboard.ts:2`, `useRotoPhysicalEditHistory.ts:62`, `usePhysicsPaintLaunchIntegration.test.ts:3`), `PaintHistoryAvailability` (`src/engine/EfxPaintEngine.ts:337-340`, `{ undo: number; redo: number }`) and `PhysicStrokePayload` (`src/payload/toStudioStroke.ts:26-36`, the eight-field opaque engine slot). Keep `CompletedPaintMutation.kind` and every union member JSON-compatible with what is already stored — never rename a member, never drop `'physics'`. Add `export type RotoEditableState = DocumentSnapshot` importing the type from `@efxlab/efx-watercolor/playground`. Do NOT re-export engine-1 anything and do not add runtime values.

    **0.3 Stack-order law, app-side.** Rewrite `app/src/components/physic-paint/view/stackOrder.ts` to hold the implementations instead of re-exporting: copy `clampStackPosition`, `targetIndexForStackPosition` and `reorderForStackPosition` verbatim from `packages/efx-physic-paint/src/engine/stackOrder.ts:21-59`, keep the header comment's law statement (arrays BOTTOM -> TOP, public position 1 = topmost) and the `StackReorderResult` import from `../types/paintCore`. Then add `stackOrder.parity.test.ts`: a deterministic case table (totals 0/1/2/5/NaN/2.7, positions -3/0/1/2/5/99/NaN/1.5, `fromIndex` -1/0/2/out-of-range) that asserts the local functions return results identical to the package implementations — import the package here on purpose; this file proves the copy before the package dies and is DELETED in Wave 1. Add the permanent `stackOrder.test.ts` pinning the same laws without the package import: `clampStackPosition` NaN -> 1, total <= 1 -> 1, fractions truncated; `targetIndexForStackPosition` zero/negative total -> 0; `reorderForStackPosition` returns the SAME array reference and `changed: false` for an invalid `fromIndex` and for a no-op placement, and `changed: true` only when the array actually moves.

    **0.4 Paper conditioner port + golden fixture.** Create `app/src/lib/paperConditioning.ts` exporting `conditionHeightMap(raw: Float32Array): Float32Array` copied VERBATIM from `packages/efx-physic-paint/src/core/paper.ts:85-92` plus the transitive `clamp` copied from `src/util/math.ts:56-58` (inline the ternary or export a local `clamp`; never import from engine-1). Keep the source's semantics exactly: empty input -> mean 0.5 and empty output; `out[i] = clamp(0.5 + (raw[i] - mean), 0.1, 0.9)`; NaN propagates because both clamp comparisons are false.
    Generate `app/src/lib/__fixtures__/paperConditioning.golden.json` BEFORE the package dies, from the package implementation, as `[{ name, input: (number | "NaN" | "-0")[], expected: (number | "NaN" | "-0")[] }, ...]` for these cases: empty array; four `0.5`s; ramp `[0, 0.25, 0.5, 0.75, 1]`; `[0, 0, 1, 1]`; a seeded pseudo-random 256-value array in `[0,1]` (document the seed in the fixture); `[NaN, 0.5, 0.5]`; `[0.1, 0.1, 0.9, 0.9]`. **JSON cannot represent NaN or -0** — encode non-finite values as the strings `"NaN"` / `"-0"` and have the test map them back (`Number(s)` would collapse `"NaN"` to `NaN` but loses `-0`; map explicitly, `"-0" -> -0`). Assert the encode/decode helper is lossless over the fixture. Generate it with a one-off vitest inside `packages/efx-physic-paint` (its own config collects `src/**/*.test.ts`) or a `node --experimental-strip-types` script, then delete the generator. Commit the fixture.
    Add `app/src/lib/paperConditioning.test.ts` (must live under `app/src/**` or vitest never collects it): for every fixture case compare BYTES — `new Uint8Array(actual.buffer)` vs `new Uint8Array(expected.buffer)` — so NaN and -0 must match exactly; use `toBeCloseTo` nowhere. Add one branch test asserting `conditionHeightMap(new Float32Array(0)).length === 0`.

    **0.5 Switch the consumer and retarget the frame guard.** Change `app/src/lib/paperPass.ts:1` to `import { conditionHeightMap } from './paperConditioning';`. In `app/src/lib/paperPass.frameGuard.test.ts`, delete the module-load `packageIndexSource` read of `packages/efx-physic-paint/src/index.ts` AND the `engineSource` read of `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` (`:25-27`) with its U5 assertions (`:186-188`), then retarget P4(e) at `app/src/lib/paperConditioning.ts` with the assertion `/export function conditionHeightMap/`. Keep every paper-pass assertion that does not read the deleted package. Do NOT delete `applyPaperPass` or `encodePassTiles` and do not change `shouldApplyPaperPass` — the pass survives as shared composite code and never fires on a watercolor document (transmittance documents short-circuit), so expect no visible change from this port.

    **0.6 The app-owned mutation ledger — `app/src/components/physic-paint/engine/paintMutationLedger.ts`.** Pure app module: no engine import, no Preact, no rasterization, no finalization, no rendering. API (locked):
    `allocateMutationId(): number` (post-increment from the clock); `allocateStrokeMutation(group: Readonly<RecordedStrokeGroup>): number` (allocate, append the accepted record, then emit completion synchronously — allocation and acceptance are synchronous and complete before the call returns); `reserveNextMutationId(n: number): void` (max-raise; ignore non-integer and `<= 0`; idempotent and order-independent); `seedFromRestoredMax(max: number): void` (equivalent to `reserveNextMutationId(max + 1)`); `getAcceptedStrokes(): PaintStroke[]` (acceptance order, fresh clones so a caller cannot mutate the ledger); `lookupAcceptedTarget(mutationId: number): AcceptedPaintMutation | null` (READ-ONLY: returns the record and never consumes it — the clipboard's WeakMap owns consumption; do NOT name this `getAcceptedTarget`, which is the clipboard's consume contract); `subscribe(listener): () => void`; `setInputLocked(locked: boolean): void`; `setActive(active: boolean): void`. Seed the clock at 1. Track the ordered accepted list as `{ mutationId, kind, accepted, acceptedAt }`. Emit completion through a synchronous listener list — the ledger itself is the mutation-completion source, so copy/apply can never deadlock waiting on a raster.
    Tests (`paintMutationLedger.test.ts`) must pin ALL of: monotonic and never reused across a long allocation run; `reserveNextMutationId` max-raise semantics including `0`, negatives, non-integers and `NaN` (no clock change) and idempotence under repeated/out-of-order calls; `seedFromRestoredMax(41)` then the next allocation is 42; acceptance order equals allocation order; `getAcceptedStrokes` returns a defensive copy in acceptance order; `lookupAcceptedTarget` returns the same record for the same id on repeated reads (read-only, never consumed) and `null` for an unknown id; every `allocateStrokeMutation` delivers exactly one completion event carrying the allocated id BEFORE the call returns (assert by observing the listener inside a synchronous block); a JSON round-trip of the accepted list restored via `seedFromRestoredMax` then re-serialized is stable (the SNAP v5 save -> restore -> save shape). The clipboard's consume contract (`getAcceptedTarget` same-then-null) is pinned separately in `physicsPaintRotoScriptClipboard.test.ts` in Wave 3.

    **0.7 The ONE Roto port — `app/src/components/physic-paint/roto/paintMutationRotoPort.ts`.** Implement `RotoScriptEnginePort` over the ledger and export a memoized `getRotoPort(...)` returning a STABLE object identity: `getStrokes` -> `ledger.getAcceptedStrokes()`, `getStrokeCount` -> accepted count, `enqueueRecordedStroke` -> `ledger.allocateStrokeMutation`, `setInputLocked` -> ledger, `flushPendingStrokeFinalizations` -> an injected flush (default no-op), `copyLiveAlphaCanvas` -> an injected `() => HTMLCanvasElement | null` getter (the aquarelle sheet snapshot seam; it must be allowed to return null). Load-bearing: the same instance must be passed to `rotoScript.updateEngine(...)` and to the completion callback, because the clipboard's `acceptedTargets` is a `WeakMap` keyed by that object (`physicsPaintRotoScriptClipboard.ts:319`). `paintMutationRotoPort.test.ts` pins: repeated `getRotoPort()` calls return the same object; `WeakMap` round-trip works with two ports (a fresh port is a different key); `getStrokes` reflects acceptance order; `enqueueRecordedStroke` returns the ledger id and emits completion; a null `copyLiveAlphaCanvas` result is passed through, never replaced by a blank canvas.

    **0.7b Widen the port member the port will satisfy — `physicsPaintRotoScriptClipboard.ts`.** Change `copyLiveAlphaCanvas?: () => HTMLCanvasElement;` (`:126`) to `copyLiveAlphaCanvas?: () => HTMLCanvasElement | null;`. Then make the ONE capture site null-safe so this wave still typechecks while the engine is installed: at `:558-571` call the function once into a local and bail out with `return null` when it is `null`, before building the capture (`scriptAlphaCanvas: HTMLCanvasElement` at `:134` stays non-nullable, so a nullable value must not be assigned to it). Today the engine-1 implementation never returns null, so behaviour is unchanged; this only opens the type seam. Do NOT do the rest of the clipboard rewrite (the `toStudioStroke`/`fromStudioStroke` localization, the gate changes) — that is Wave 3 (3.3).

    **0.8 Roto persistence truth table — `app/src/components/physic-paint/roto/rotoFramePersistTruth.ts` + test.** Export a pure `shouldPersistRotoFrameFromTruth(input: { recordedStrokeCount: number; payloadEventCount: number; bgMode: string }): boolean` with EXACTLY the current semantics (`strokes.length > 0 || bgMode !== 'transparent'`) but an explicit truth input, so `rotoSaveTransactions.ts` can re-point its source in Wave 3 without changing the law. `rotoFramePersistTruth.test.ts` is a table-driven test over: no strokes + transparent -> false; no strokes + `white`/`canvas1`/`photo` -> true; one recorded stroke + transparent -> true; payload events with zero live strokes (all deleted) -> false; strokes recorded but the engine-1 mirror empty -> true (this is the regression row that must keep Roto persistence alive after re-pointing); negative counts treated as zero. Do NOT change `rotoSaveTransactions.ts` in this wave — the re-point is Wave 3 (3.5).

    **0.9 Structural purity test — `paintMutationLedger.purity.test.ts`.** Source-scan `paintMutationLedger.ts`, `paintMutationRotoPort.ts`, `rotoFramePersistTruth.ts` and `../../../lib/paperConditioning.ts` (from `engine/paintMutationLedger.purity.test.ts`, `app/src/lib/paperConditioning.ts` resolves three levels up; resolve the absolute path from the test file's own URL rather than guessing a relative hop) and assert none contains the `@efxlab/efx-physic-paint` specifier, an `EfxPaintEngine` reference, or an `enqueueRecordedStroke` call into an engine object. Strip line comments before matching so a comment cannot self-invalidate the gate.

    **0.10 Commit** with pathspec-scoped adds of exactly the files listed in `<files>`. Commit message: `feat(261027-klx): land engine-1 removal blockers (ledger, port, paper, types)`.
  </action>
  <verify>
    <automated>pnpm --dir app run build && ls -l app/dist/PhysicsPaintStudio-*.js && pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/engine/paintMutationLedger.test.ts src/components/physic-paint/engine/paintMutationLedger.purity.test.ts src/components/physic-paint/roto/paintMutationRotoPort.test.ts src/components/physic-paint/roto/rotoFramePersistTruth.test.ts src/lib/paperConditioning.test.ts src/lib/paperPass.frameGuard.test.ts src/components/physic-paint/view/stackOrder.test.ts src/components/physic-paint/view/stackOrder.parity.test.ts && pnpm --dir app run typecheck</automated>
  </verify>
  <done>
    All eight targeted test files green; `pnpm --dir app run typecheck` exits 0 (including `physicsPaintRotoScriptClipboard.ts` after the `copyLiveAlphaCanvas` widening — the capture path bails out on null and never substitutes a blank canvas); the freshly measured Studio chunk is <= 943,411 bytes and its byte count is recorded in the Wave 0 summary; `paintCore.ts` declares all nine borrowed types including `CompletedPaintMutation`, `PaintHistoryAvailability` and `PhysicStrokePayload`; `paperConditioning.test.ts` compares bytes against the committed golden fixture; the stack-order parity test proves the local copy against the still-installed package; the ledger proves monotonic ids, seeded restore, acceptance order, synchronous completion and target read-back; no new module imports engine-1.
  </done>
</task>

<!-- ============================================================
     WAVE 1 — package and config. Build is INTENTIONALLY broken after this.
     ============================================================ -->
<task type="auto">
  <name>Wave 1: delete the engine-1 package and every manifest/alias/script reference; retarget the two module-load test files</name>
  <files>
    packages/efx-physic-paint/**
    app/package.json
    app/vite.config.ts
    package.json
    pnpm-lock.yaml
    app/src/efx-paint/host-split/hostAnimationResidueContract.test.ts
    app/src/efx-paint/efxPaintCleanBreakContract.test.ts
    app/src/components/physic-paint/view/stackOrder.parity.test.ts
  </files>
  <action>
    **1.1 Record the census first.** Re-run the inventory §10 G1 command and the importing-file count; write both numbers into the Wave 1 summary as the pre-deletion baseline.

    **1.2 Delete the package.** `git rm -r -- packages/efx-physic-paint` (production + tests + demo, ~40,200 lines). The package must not survive as an empty directory.

    **1.3 Remove every manifest/config reference.**
    - `app/package.json:17` — drop the `"@efxlab/efx-physic-paint": "workspace:*"` dependency entry.
    - `app/vite.config.ts` — drop BOTH aliases at `:160-161` (`@efxlab/efx-physic-paint/preact` and `@efxlab/efx-physic-paint`) and the `'@efxlab/efx-physic-paint'` entry in `optimizeDeps.exclude` at `:191`. Leave the nearby comment at `:119` only if it still describes a surviving condition; otherwise delete it too. Do not touch any `@efxlab/efx-watercolor` alias.
    - root `package.json` — drop `pnpm --filter @efxlab/efx-physic-paint build && ` from the `build` script and delete the `dev:paint` script entirely.
    - Regenerate the lockfile with `pnpm install` (workspace root). Do not hand-edit `pnpm-lock.yaml`.

    **1.4 Delete the temporary parity file.** Remove `app/src/components/physic-paint/view/stackOrder.parity.test.ts` (its proof is recorded in the Wave 0 summary; the package it imports no longer exists). The permanent `stackOrder.test.ts` stays.

    **1.5 Retarget `app/src/efx-paint/host-split/hostAnimationResidueContract.test.ts`.** It reads `packages/efx-physic-paint/package.json` (`:235`) and `packages/efx-physic-paint/tsup.config.ts` (`:253`) with `readFileSync` at test time — after deletion the whole file throws ENOENT. Replace those two rows with the stronger, intent-preserving assertion: the package DIRECTORY does not exist (`existsSync(resolve(REPO_ROOT, 'packages/efx-physic-paint')) === false`) and therefore publishes no `./animation` export and no tsup animation entry. Keep the `src/animation/` absence row and the `HOST_ANIMATION_INDEX` existence row unchanged. Keep every comment-stripping helper and the `ENGINE1_ANIMATION_SUBPATH` adversarial rows — they still guard against a re-introduced engine-1 animation subpath. Do not weaken any assertion.

    **1.6 Retarget `app/src/efx-paint/efxPaintCleanBreakContract.test.ts`.** Its `SCAN_ROOTS` includes `resolve(REPO_ROOT, 'packages/efx-physic-paint/src')` (`:39`); `walkFiles()` uses an unguarded `readdirSync`, so two of its three cases throw ENOENT after this deletion. Remove that scan root (keep the app src, src-tauri src and efx-paint-host roots) and restate its G5 allowlist rationale in 6.6 as "comment / scan-root definition". Do not weaken any other token scan.

    **1.7 Commit** with pathspec-scoped adds: the deletion, the three manifests, the lockfile, the two retargeted tests, and the removed parity file. Message: `chore(261027-klx): remove the efx-physic-paint package and its config`.

    **Expected state after this wave:** the app DOES NOT typecheck. Every surviving engine-1 import is dangling. That is accepted (see `<open_item_resolutions>` #3) and must be stated in the summary. Do not attempt to fix those imports in this wave — they are Waves 2-4 work.
  </action>
  <verify>
    <automated>test ! -d packages/efx-physic-paint && ! grep -q "efx-physic-paint" app/package.json app/vite.config.ts package.json pnpm-lock.yaml && echo "MANIFEST GATE: 0" && pnpm --filter efx-motion-editor exec vitest run src/efx-paint/host-split/hostAnimationResidueContract.test.ts src/efx-paint/efxPaintCleanBreakContract.test.ts src/lib/paperPass.frameGuard.test.ts src/components/physic-paint/view/stackOrder.test.ts && (pnpm --dir app run typecheck > /tmp/klx-wave1-typecheck.log 2>&1; grep -oE "^[^ (]+\.(ts|tsx)" /tmp/klx-wave1-typecheck.log | sort -u)</automated>
  </verify>
  <done>
    `packages/efx-physic-paint` no longer exists; the manifest/config/lockfile gate prints `MANIFEST GATE: 0`; the two originally module-load-fragile test files plus `stackOrder.test.ts` are green; the typecheck error census is captured and every distinct failing file belongs to the Wave 2-4 expected-failure set (brush store/edition/hydration/overlay/section/probes/fixtures, the Roto + script + snapshot + performance shared files, the Studio shell and UI gate files, and the engine action/lifecycle/settings hooks). No error of any other class (no unrelated type regression) appears.
  </done>
</task>

<!-- ============================================================
     WAVE 2 — dedicated app deletes.
     ============================================================ -->
<task type="auto">
  <name>Wave 2: delete the engine-1-only app modules and their tests, with the research corrections applied</name>
  <files>
    app/src/components/physic-paint/view/brushScriptRecordState.ts
    app/src/components/physic-paint/view/brushScriptRecordState.test.ts
    app/src/components/physic-paint/view/brushScriptEditionPort.ts
    app/src/components/physic-paint/view/brushScriptEditionPort.test.ts
    app/src/components/physic-paint/view/brushScriptHydration.ts
    app/src/components/physic-paint/view/brushScriptHydration.test.ts
    app/src/components/physic-paint/engine/BrushScriptOverlay.tsx
    app/src/components/physic-paint/view/BrushModuleSection.tsx
    app/src/components/physic-paint/performance/depositSpeckleCapture.ts
    app/src/components/physic-paint/performance/depositSpeckleCapture.metrics.test.ts
    app/src/components/physic-paint/performance/scriptMemoryProbe.ts
    app/src/components/physic-paint/performance/lookDeltaCapture.ts
    app/src/components/physic-paint/engine/EfxPaintCanvas.lifecycle.test.ts
    app/src/efx-paint/host-split/preSplitGoldenFixture.ts
    app/src/efx-paint/host-split/preSplitGoldenParity.test.ts
    app/src/efx-paint/host-split/hostSplitSuiteGate.test.ts
    app/src/components/physic-paint/view/physicsPaintTemporaryErase.ts
    app/src/components/physic-paint/view/physicsPaintTemporaryErase.test.ts
    app/src/components/physic-paint/view/physicsPaintTemporaryMove.test.ts
    app/src/components/physic-paint/engine/usePhysicsPaintEngineActions.test.ts
  </files>
  <action>
    Inventory §3 and §4 EXCEPT the research corrections. For every delete, first run `grep -rn "<module basename>" app/src --include='*.ts' --include='*.tsx'` and record surviving importers in the summary. A surviving importer in a Wave 3/4 file is expected and fine (the tree is still non-compiling); a surviving importer you cannot re-home in Waves 3-4 is stop condition S2.

    **2.1 Delete the engine-1-only modules.** `view/brushScriptRecordState.ts`, `view/brushScriptEditionPort.ts`, `view/brushScriptHydration.ts`, `engine/BrushScriptOverlay.tsx`, `view/BrushModuleSection.tsx`, `performance/depositSpeckleCapture.ts`, `performance/scriptMemoryProbe.ts`, `performance/lookDeltaCapture.ts`.

    **2.2 Delete their tests plus the removed-surface tests.** `view/brushScriptRecordState.test.ts` (mixed — see 2.5), `view/brushScriptEditionPort.test.ts`, `view/brushScriptHydration.test.ts`, `engine/EfxPaintCanvas.lifecycle.test.ts`, and `performance/depositSpeckleCapture.metrics.test.ts` — the last one is the engine-1 DEV probe suite and imports `./depositSpeckleCapture` at `:30`, so it dies with its subject. Do not leave it for Wave 3 to trip over.

    **2.3 Delete the host-split golden pair and retire its two gate entries.** Delete `app/src/efx-paint/host-split/preSplitGoldenFixture.ts` and `preSplitGoldenParity.test.ts`. In `app/src/efx-paint/host-split/hostSplitSuiteGate.test.ts` remove `'app/src/efx-paint/host-split/preSplitGoldenParity.test.ts'` from `STANDING_PINS` and `'app/src/efx-paint/host-split/preSplitGoldenFixture.ts'` from `PIN_FIXTURES`. Do not remove or weaken any other pin, and do not renumber the lists' intent (see `<open_item_resolutions>` #1 for the recorded justification). Keep `fakeEngine2Fixture.ts` in `PIN_FIXTURES`.

    **2.4 `view/physicsPaintTemporaryErase.ts` — KEEP / SPLIT (the inventory is wrong here).** This file is LIVE on the watercolor path: `AquarelleCanvasLayer.tsx:45,84` imports and reads `temporaryMove`. Do NOT delete the file. First prove whether any watercolor path arms the erase arm: `grep -rn "temporaryErase\|setTemporaryErase" app/src --include='*.ts' --include='*.tsx'`. If no aquarelle-path writer exists, delete the engine-1 erase arm, its exported signal and its `engine.setTool` call (`:167`), keep `temporaryMove` and its render gate untouched, and localize the `ToolType` import (`:2`) to `../types/paintCore`. If a watercolor path DOES arm it, keep the arm, only localize the type, and record the finding in the summary. Either way the file must end with zero `@efxlab/efx-physic-paint` imports.

    **2.5 Split the mixed test files — never drop coverage for a surviving export.** `view/physicsPaintTemporaryMove.test.ts` and `view/physicsPaintTemporaryErase.test.ts` cover `temporaryMove`, which survives: keep every move case, delete only the engine-erase cases. Also retarget the `ToolType` imports in both tests (`physicsPaintTemporaryErase.test.ts:2`, `physicsPaintTemporaryMove.test.ts`) to `types/paintCore.ts`, and retype the move cases to the surviving `temporaryMove` signal. If a file turns out to test ONLY the erase arm, delete it and record why. For `view/brushScriptRecordState.test.ts`, delete the Brush half and move any Aquarelle coexistence assertion into the existing aquarelle test file rather than dropping it.

    **2.6 Retarget, don't delete, `engine/usePhysicsPaintEngineActions.test.ts`.** Keep the paper-display cases (`setBackground`, `setGrainStrength`, `setGrainScale`, `updateSetting`); remove only the engine-1 tool cases. The source file itself is split in Wave 4.

    **2.7 Commit** with pathspec-scoped adds (deletions + the retargeted/split tests + the gate list edit). Message: `refactor(261027-klx): delete engine-1-only app modules`.

    **Expected state:** still non-compiling, and now with strictly fewer engine-1 references. Report the new G1 census and the remaining expected-failure file list.
  </action>
  <verify>
    <automated>test ! -e app/src/components/physic-paint/view/brushScriptRecordState.ts && test ! -e app/src/efx-paint/host-split/preSplitGoldenFixture.ts && test -e app/src/components/physic-paint/view/physicsPaintTemporaryErase.ts && ! grep -q "@efxlab/efx-physic-paint" app/src/components/physic-paint/view/physicsPaintTemporaryErase.ts app/src/components/physic-paint/view/stackOrder.ts && pnpm --filter efx-motion-editor exec vitest run src/efx-paint/host-split/hostSplitSuiteGate.test.ts src/efx-paint/host-split/hostAnimationResidueContract.test.ts src/efx-paint/host-split/hostImportGraphContract.test.ts src/components/physic-paint/view/stackOrder.test.ts src/components/physic-paint/engine/usePhysicsPaintEngineActions.test.ts && (pnpm --dir app run typecheck > /tmp/klx-wave2-typecheck.log 2>&1; grep -oE "^[^ (]+\.(ts|tsx)" /tmp/klx-wave2-typecheck.log | sort -u)</automated>
  </verify>
  <done>
    Every listed engine-1-only module and its dedicated test are gone (including `performance/depositSpeckleCapture.metrics.test.ts`); `physicsPaintTemporaryErase.ts` still exists with `temporaryMove` intact and zero engine-1 imports (the erase-arm verdict is recorded); `hostSplitSuiteGate.test.ts` is green with exactly the two retired entries removed; the surviving host-split pins are green; the typecheck failure list is strictly smaller than Wave 1's and stays inside this explicit expected-failure set: `view/RightPanelMemoryTab.tsx`, `view/frameScriptOwnership.test.ts`, `view/panelSplitShell.test.tsx`, `view/PhysicsPaintRightPanel.test.ts`, `view/physicsPaintRightPanelModuleGate.test.ts`, `view/physicsPaintRightPanelPaperSingleHome.test.ts`, `performance/scriptMemorySnapshot.test.ts`, `performance/studioScriptMemoryGauge.test.ts`, `PhysicsPaintStudio.test.ts`, `engine/PhysicsPaintCanvasMount.test.ts`, `engine/PhysicsPaintCanvasMount.runtime.test.ts`, `hooks/usePhysicsPaintLaunchIntegration.test.ts`, plus every Wave 3 and Wave 4 source file. No file outside the Wave 3-4 `<files>` sets may appear in the census.
  </done>
</task>

<!-- ============================================================
     WAVE 3 — shared rewrite: Roto, script, snapshot, performance, paper, ledger wiring.
     ============================================================ -->
<task type="auto">
  <name>Wave 3: rewrite the shared layer — Aquarelle engine port, Roto, script, SNAP v5, performance, and the ledger wiring in the Studio</name>
  <files>
    app/src/components/physic-paint/engine/aquarelleEnginePort.ts
    app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
    app/src/components/physic-paint/engine/aquarelleStrokeBridge.ts
    app/src/components/physic-paint/roto/rotoCoordinatorPorts.ts
    app/src/components/physic-paint/roto/rotoCanvasFrames.ts
    app/src/components/physic-paint/roto/rotoCanvasFrames.test.ts
    app/src/components/physic-paint/roto/rotoEditBufferTransactions.ts
    app/src/components/physic-paint/roto/rotoEditBufferTransactions.test.ts
    app/src/components/physic-paint/roto/rotoSaveTransactions.ts
    app/src/components/physic-paint/roto/rotoSaveTransactions.test.ts
    app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
    app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts
    app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts
    app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts
    app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts
    app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts
    app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
    app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts
    app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.test.ts
    app/src/components/physic-paint/roto/physicsPaintRotoRegistryOwnership.test.ts
    app/src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts
    app/src/components/physic-paint/roto/physicsPaintRotoScriptApplyRefusal.ts
    app/src/components/physic-paint/roto/physicsPaintRotoScriptApplyRefusal.test.ts
    app/src/components/physic-paint/view/recordedStrokeGroups.ts
    app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts
    app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts
    app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
    app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts
    app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts
    app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts
    app/src/components/physic-paint/hooks/useRotoFrameEditingController.ts
    app/src/components/physic-paint/hooks/useRotoFrameEditingController.test.ts
    app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.ts
    app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.test.ts
    app/src/components/physic-paint/hooks/useRotoReferenceController.ts
    app/src/components/physic-paint/hooks/useRotoReferenceController.test.ts
    app/src/components/physic-paint/hooks/rotoCompletionPaintGuard.test.ts
    app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts
    app/src/components/physic-paint/performance/studioScriptSnapshotCodec.test.ts
    app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts
    app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts
    app/src/components/physic-paint/performance/physicsPaintPerformanceTrace.ts
    app/src/components/physic-paint/performance/physicsPaintPerformanceTrace.test.ts
    app/src/components/physic-paint/performance/scriptMemorySnapshot.ts
    app/src/components/physic-paint/performance/scriptMemorySnapshot.test.ts
    app/src/components/physic-paint/performance/studioScriptMemoryGauge.ts
    app/src/components/physic-paint/performance/studioScriptMemoryGauge.test.ts
    app/src/components/physic-paint/performance/moveProvenanceCapture.ts
    app/src/components/physic-paint/PhysicsPaintStudio.tsx
    app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  </files>
  <action>
    Work in the order below — each step depends on the previous one. This is the wave with the real design risk; use the stop conditions rather than improvising.

    **3.1 Expose a minimal typed `AquarelleEnginePort` (Option A, locked).** New `app/src/components/physic-paint/engine/aquarelleEnginePort.ts`: a narrow interface `{ snapshot(): DocumentSnapshot; restore(s: DocumentSnapshot): void; exportCanvas(background?: 'transparent' | string, texture?: boolean): HTMLCanvasElement; undo(): void; redo(): void; clear(): void }` plus a factory that wraps an injected `() => WatercolorEngine | null`. **Never export the `WatercolorEngine` itself and never widen this interface** — the point is that Roto cannot reach watercolor internals. Publish it from `AquarelleCanvasLayer` through a new prop (e.g. `onEnginePortReady?: (port: AquarelleEnginePort | null) => void`), following the existing callback-seam style (`onSnapshotReady` / `onResetSheetReady`); call it with the port after engine construction (`~:423`) and with `null` in the cleanup path (`~:346`, `~:706`).

    **3.2 Re-home the members watercolor does not have.** `resetBackground`, `clearPreviewBaseImage`, `getPreviewBasePaintSource` and `loadReferenceFrame` must land in app state, not on the port: use the existing aquarelle cached-base / durable-base state (`aquarelleDurableBaseByKeyRef`, the cached roto reference frame path) and the existing reference loader. `flushPendingStrokeFinalizations` becomes the ledger port's injected no-op on a ledger-only path (watercolor has no pending-finalization queue to flush). Do not add a second source of truth: if the state is already held by `aquarelleRecordState` / the cached reference frame, read it from there.

    **3.3 Retype the Roto layer and localize the stroke projection.** In `rotoCoordinatorPorts.ts`, `rotoEditBufferTransactions.ts`, `rotoSaveTransactions.ts`, `useRotoFramePersistenceCoordinator.ts`, `useRotoReferenceController.ts`, `rotoCanvasFrames.ts`, `useRotoFrameEditingController.ts`, `useRotoPersistenceIntegration.ts`, `useRotoPhysicalEditCoordinator.ts` and `useRotoPhysicalEditHistory.ts`: replace every `EfxPaintDocument` / `EfxPaintEngine` / `ReturnType<EfxPaintEngine['save']>` / engine `BgMode`-`ToolType` import with the local types from `types/paintCore.ts` and `RotoEditableState` (= watercolor `DocumentSnapshot`). Retype `RotoPhysicalEditEnginePort<EngineState>` to the `AquarelleEnginePort` factory. In `rotoCanvasFrames.ts` replace `save`/`load`/`setBgMode`/`exportCompositeCanvas`/`getPreviewBasePaintSource` with `snapshot`/`restore`/`exportCanvas(background)` and the re-homed preview base from 3.2 — this is a real rewrite, not a rename: preserve the current ordering (snapshot -> transparent export -> restore) so the exported frame is unchanged.
    In `physicsPaintRotoScriptClipboard.ts`, replace the engine-1 runtime imports: use `aquarelleToStudioStroke` (already imported from `@efxlab/efx-watercolor/payload`) wherever the old `toStudioStroke` produced a script stroke, and port the INVERSE locally (`fromStudioStroke` has no watercolor equivalent) as a small pure helper next to its only consumer (`:746` held-pose transform) with its own unit cases. Also make the capture gate null-tolerant: `engine.copyLiveAlphaCanvas` may now return `null`, so `if (brushes.length === 0 || !engine.copyLiveAlphaCanvas) return null` plus the `scriptAlphaCanvas: engine.copyLiveAlphaCanvas()` call must both handle a null canvas (a blank canvas must never be substituted — a blank `scriptAlphaCanvas` would be saved as a blank thumbnail). **Extend `physicsPaintRotoScriptClipboard.test.ts` to pin the consume contract**: `getAcceptedTarget(port, id)` returns the accepted target for the same port + id, the SECOND call with the same port + id returns `null` (consumed), and a different port object returns `null` (WeakMap key). Keep `normalizeLogicalBrushes` and `recordedStrokeGroups.ts` semantics unchanged; only their type imports move to `types/paintCore.ts` (and `aquarelleStrokeBridge.ts` likewise).

    **3.4 Script engine identity becomes watercolor-only.** In `physicsPaintRotoScriptSchema.ts`: delete `ROTO_SCRIPT_ENGINE_ID` and every engine-1 shape, guard and builder (the v1 brush parser branch at `~:333` and `~:543` goes, not merely becomes dead code). Keep `ROTO_SCRIPT_ENGINE_ID_AQUARELLE` as the one produced identity, keep `ROTO_SCRIPT_KIND`, and keep ONE legacy-identity literal used only to CLASSIFY an old envelope as refused — name it explicitly (e.g. `ROTO_SCRIPT_LEGACY_ENGINE_ID = 'efx-physic-paint'`) and never use it to build or accept a document. Keep the watercolor `brushPack` validation. In `physicsPaintRotoScriptApplyRefusal.ts` KEEP the `ENGINE_DISPLAY_NAMES` entry `'efx-physic-paint': 'Brush'` and the `unreadable-legacy-script` message — an existing green pin (`hostSplitFailClosedApply.test.ts:226`) requires it; remove only the Krita placeholder if the clean break excludes it (it does not — leave Krita alone). Remove the engine-1 branches from `physicsPaintRotoPlayScriptController.ts`, `physicsPaintRotoPlayScriptRenderer.ts`, `physicsPaintRotoScriptLibrary.ts`, `physicsPaintRotoDuplicateScript.ts`. In `physicsPaintRotoDuplicateScript.ts` rename its two orchestrator port members `captureBrushScript` / `applyBrushScript` (`:240`, `:244`, used `:298`, `:302`) to token-free names (`captureScript` / `applyScript`) and update the Studio's implementations at `PhysicsPaintStudio.tsx:3699`, `:3728` in the same commit — these carry a `RotoPaintScript`, not a Brush script, and the G2 census counts the token. Rewrite `physicsPaintRotoScriptSchema.test.ts` cases that assert engine-1 serialization; keep the legacy-refusal cases and the watercolor `brushPack` cases.

    **3.5 Re-point `shouldPersistRotoFrame` at the truth source.** In `rotoSaveTransactions.ts`, replace the engine-1 `state.tracks[].strokes` read with `shouldPersistRotoFrameFromTruth({ recordedStrokeCount, payloadEventCount, bgMode })`, where the counts come from `aquarelleRecordState` for the frame and `bgMode` from the surviving settings source. Add `rotoSaveTransactions.test.ts` rows for the Wave 0 truth table PLUS the regression row: "engine-1 mirror empty, watercolor recorded strokes present -> persist". Without this row a painted watercolor frame classifies as empty and Roto persistence silently drops real paint.

    **3.6 Wire the ledger into the Studio.** In `PhysicsPaintStudio.tsx`: replace `engineRef.current.enqueueRecordedStroke(...)` at `:6773` (`handleAquarelleStrokeEnd`) and the clipboard `allocateMutationId` at `:3758` with `ledger.allocateStrokeMutation({ primary: ... })` keeping the `(stroke) => number` shape; replace the three `reserveMutationClock` calls (`:4999`, `:5341`, `:6384`) with `ledger.reserveNextMutationId(...)`; pass the ONE memoized port to both `updateEngine` (`:2065`, `:6386`) and the completion path (`:6529` `observeCompletedMutation`, `:6550` `getAcceptedTarget`) — the same object identity, or `getAcceptedTarget` returns null for everything and every script apply refuses; replace `engineState.saveEngineState/loadEngineState` (`:2955-2956`) with `AquarelleEnginePort.snapshot/restore`; make `flushPendingStrokeFinalizations` (`:2967`) the port's no-op. Subscribe the ledger to `canvasCompletedMutationImplRef` so completion keeps its current ordering. Add the Wave 0 resolution's behavioral test: `handleAquarelleStrokeEnd` allocates through the ledger and exactly one completion is delivered, with no rasterization or finalization dependency (assert synchronously). Do not touch the Brush module branches, the canvas-mount props or the tool rail in this wave — those are Wave 4.

    **3.7 SNAP v5 clean break.** In `studioScriptSnapshotCodec.ts`: set `STUDIO_SCRIPT_SNAPSHOT_VERSION = 5`; set `STUDIO_SCRIPT_SNAPSHOT_VERSIONS = new Set([5])`; remove the brush body section from encode AND stop requiring it in decode; before the generic version reject, special-case container versions 1-4 with `fail('snap-v4-retired', 'SNAP predates the watercolor-only format', 4)` so the controller kind becomes `corrupt:snap-v4-retired` with no control-flow change. Every `Reader` bound check stays — do not relax a single bounds check while removing the section. In `studioScriptSnapshotController.ts`: extend `studioScriptSnapshotRestoreFailureMessage` so `kind === 'corrupt:snap-v4-retired'` returns the pinned clean-break wording `Studio script snapshot could not be restored — it was written by an earlier Studio format that predates Water color only. The frame pixels are unchanged.` and every other kind keeps the current text; remove `getBrushFrames` / `restoreBrushScriptFrames` / brush pruning; keep the watercolor + anchors + durable-base sections and keep `restoreFailureReported` (it already gives one notice per binding, reset only in `bind()` and `reset()`). **Do not bump the Rust `STUDIO_SCRIPT_SNAPSHOT_FORMAT_VERSION` (stays 1, a file-name version) — bumping it would hide old files and silence the notice (stop condition S3).**
    Pin in codec/controller tests: a hand-assembled version-4 container (magic `SNP1`, u16 `4`) raises the `snap-v4-retired` code; versions 1, 2 and 3 do the same; an unknown version (0 or 6) keeps the generic `version` code; a v5 encode -> decode round-trip carries the watercolor body and no brush body; two consecutive restores against one binding call `deps.report` EXACTLY once and a `bind(newIdentity)` re-arms it; the exact clean-break string is asserted and the generic `could not be restored (corrupt:version)` wording is asserted absent; a v4 file seeds no rows (`maxRestoredMutationId === 0`, restored timeline empty).

    **3.8 Performance instrumentation.** In `physicsPaintPerformanceTrace.ts`, `scriptMemorySnapshot.ts`, `studioScriptMemoryGauge.ts`, `moveProvenanceCapture.ts`: remove the engine-1 sample types, metrics and provenance/brush memory sections; keep every Aquarelle counter and every counter the `efx-async-orchestration` measurement discipline depends on. Do not remove a counter the profile surface still reads.

    **3.8b Test file-set dispositions (every file this wave's verify runs must be this wave's file).** The wave now OWNS the test files it executes; none may be left broken for another wave:
    - `roto/physicsPaintRotoDuplicateScript.test.ts` — drop the engine-1-only duplicate cases (the `brushScript()` fixture and its capture/apply rows at `:38`, `:181-272`, `:471-472`); keep the ordering/refusal cases that still describe the orchestrator. Rename the port keys to match 3.4.
    - `roto/physicsPaintRotoRegistryOwnership.test.ts` and `roto/physicsPaintRotoRevealBake.test.ts` — their `vi.mock('@efxlab/efx-physic-paint', …)` blocks (`:28`, `:43`) and `PaintStroke` type imports go; retarget the mock to the local `types/paintCore.ts` shape and keep the REFUSAL rows (they pin that an old Brush script is refused).
    - `hooks/rotoCompletionPaintGuard.test.ts` — its `import { EfxPaintEngine }` (`:2`) becomes a local `CompletedPaintMutation` + `PaintStroke` import; the guard's behaviour rows stay unchanged.
    - `performance/scriptMemorySnapshot.test.ts` — remove the `../view/brushScriptHydration` import (`:34`) and every `brushScript` sample/expectation (`:110`, `:170`, `:301`, `:350`, `:392`, `:430`, `:461`); keep every Aquarelle and audio memory counter.
    - `performance/studioScriptMemoryGauge.test.ts` — remove the `../view/brushScriptRecordState` import (`:28-30`) and the `getBrushScriptReport` / `resetBrushScriptStore` rows (`:108`, `:245-263`); keep the watercolor gauge rows.
    - `snapshot/studioScriptSnapshotController.test.ts` — remove the `brushScriptRecordState` import (`:30-35`) and the brush restore/prune/purge cases; the new v5 clean-break, one-notice-per-binding and zero-seeded-rows cases land here.
    - `PhysicsPaintStudio.test.ts` (shared half) — delete the module-load reads at `:38-39` (`brushScriptEditionPort.ts`, `BrushScriptOverlay.tsx`), `:62` (`packages/efx-physic-paint/src/engine/EfxPaintEngine.ts`), `:66` (`scriptMemoryProbe.ts`) and `:70` (`brushScriptRecordState.ts`) plus every pin that asserts those sources (`:3359-3436`, `:3456-3537`, `:3669-3673`, `:3961-3971` and the probe/gauge pins), and every Studio-source pin that names a string this wave changes (the two renamed port keys, `applyBrushScriptStrokeAppearance`, `enqueueRecordedStroke`). They read files this repo no longer has, so leaving them throws ENOENT for the whole file and blocks Wave 4. The UI-side pins on the mount/right panel/module gate are Wave 4's half.
    - Every hook test in `<files>` (`useRotoPhysicalEditCoordinator`, `useRotoPhysicalEditHistory`, `useRotoFramePersistenceCoordinator`, `useRotoFrameEditingController`, `useRotoPersistenceIntegration`, `useRotoReferenceController`) is retyped to the new port signatures — they extend nothing new; they only follow the source.
    **Record in the Wave 3 summary:** `flush` lives on the ledger port as an injected no-op on purpose (watercolor has no pending-finalization queue), a deliberate deviation from the `AquarelleEnginePort` member list in CONTEXT.md (`snapshot/restore/exportCanvas/undo/redo/clear/flush`); the flush member is satisfied at the ledger boundary, not on the engine port.

    **3.9 Commit** with pathspec-scoped adds. Message: `refactor(261027-klx): watercolor-only Roto, script and SNAP v5`.

    **Expected state:** the app compiles except for the Wave 4 file set (canvas mount, right panel + `RightPanelMemoryTab`, tool rail, top bar, module switcher/lock, engine actions/lifecycle/settings, scripts panel, CSS). The Studio's imports of the Wave-2 deleted modules (`applyBrushScriptStrokeAppearance` at `:280`, and any other deleted-module import) MUST be gone from this wave — anything the deleted modules supplied that the Studio still reads becomes Wave 4 surface. Enumerate the residual errors in the summary.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/rotoCanvasFrames.test.ts src/components/physic-paint/roto/rotoEditBufferTransactions.test.ts src/components/physic-paint/roto/rotoSaveTransactions.test.ts src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.test.ts src/components/physic-paint/roto/physicsPaintRotoRegistryOwnership.test.ts src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts src/components/physic-paint/roto/physicsPaintRotoScriptApplyRefusal.test.ts src/components/physic-paint/performance/studioScriptSnapshotCodec.test.ts src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts src/components/physic-paint/performance/physicsPaintPerformanceTrace.test.ts src/components/physic-paint/performance/scriptMemorySnapshot.test.ts src/components/physic-paint/performance/studioScriptMemoryGauge.test.ts src/components/physic-paint/hooks/rotoCompletionPaintGuard.test.ts src/components/physic-paint/hooks/useRotoFrameEditingController.test.ts src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts src/components/physic-paint/hooks/useRotoPersistenceIntegration.test.ts src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts src/components/physic-paint/hooks/useRotoReferenceController.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts && pnpm --dir packages/efx-watercolor run check && pnpm --dir packages/efx-watercolor exec vitest run && (pnpm --dir app run typecheck > /tmp/klx-wave3-typecheck.log 2>&1; grep -oE "^[^ (]+\.(ts|tsx)" /tmp/klx-wave3-typecheck.log | sort -u)</automated>
  </verify>
  <done>
    Every test file listed in this wave's verify is in this wave's `<files>` and green — Roto (including the renamed duplicate-script ports), script, snapshot and performance suites, the new SNAP v5 cases, the exact clean-break message pin, the one-notice-per-binding test and the no-seeded-rows test; `PhysicsPaintStudio.test.ts` no longer reads a deleted module at load; the watercolor package still checks and its own suite is green; `shouldPersistRotoFrame` classifies a watercolor-painted frame as persistable; the Studio allocates every watercolor stroke id from the ledger through ONE port instance and completion fires without rasterization; the residual typecheck failures are confined to the Wave 4 file list; the `flush`-as-ledger-no-op deviation is recorded in the summary.
  </done>
</task>

<!-- ============================================================
     WAVE 4 — Studio shell and UI gate.
     ============================================================ -->
<task type="auto">
  <name>Wave 4: remove the Brush module surface — Studio shell, canvas mount, panels, rails, module gate, CSS</name>
  <files>
    app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
    app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.test.ts
    app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.runtime.test.ts
    app/src/components/physic-paint/engine/MemoizedPhysicsPaintCanvasMount.ts
    app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts
    app/src/components/physic-paint/engine/physicsPaintStudioSettings.test.ts
    app/src/components/physic-paint/engine/usePhysicsPaintEngineLifecycle.ts
    app/src/components/physic-paint/engine/usePhysicsPaintEngineActions.ts
    app/src/components/physic-paint/engine/usePhysicsPaintEngineActions.test.ts
    app/src/components/physic-paint/engine/physicsPaintDevExport.ts
    app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
    app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.test.ts
    app/src/components/physic-paint/hooks/usePhysicsPaintSessionController.ts
    app/src/components/physic-paint/hooks/usePhysicsPaintWorkflowIntegration.ts
    app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
    app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts
    app/src/components/physic-paint/view/physicsPaintRightPanelModuleGate.test.ts
    app/src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts
    app/src/components/physic-paint/view/RightPanelMemoryTab.tsx
    app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
    app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
    app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts
    app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
    app/src/components/physic-paint/view/frameScriptOwnership.ts
    app/src/components/physic-paint/view/frameScriptOwnership.test.ts
    app/src/components/physic-paint/view/panelSplitShell.test.tsx
    app/src/components/physic-paint/physicsPaintStudio.css
    app/src/components/shared/activeModule.ts
    app/src/components/shared/activeModule.test.ts
    app/src/components/shared/frameModuleLock.ts
    app/src/components/shared/frameModuleLock.test.ts
    app/src/components/shared/ModuleSwitcher.tsx
    app/src/components/shared/ModuleSwitcher.test.tsx
    app/src/components/physic-paint/PhysicsPaintStudio.tsx
    app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  </files>
  <action>
    **4.1 Canvas mount — remove engine-1 entirely.** In `PhysicsPaintCanvasMount.tsx` delete `EfxPaintCanvas`, its wrapper div, every engine-1 prop (`onCompletedMutation`, `onPerformanceSample`, `onInputActivity`, `beforeEngineDestroy`, `getStrokeMetadata`, `onEngineReady`, `onNativePenInputReady`), the `BrushScriptOverlay` render and its `brushScriptEditionActive` prop, and the three hard-coded paper URLs (`/img/paper_1.jpg` etc. — they fed the engine-1 constructor). Keep `AquarelleCanvasLayer`, `AquarelleCachedBaseLayer`, the shell ref/style and the aquarelle seams (`onSnapshotReady`, `onFlushCaptureReady`, `onCaptureFrame`, `onSheetSessionEnd`, `onResetSheetReady`, `onDeleteStrokes`, `onMoveStrokes`, `onTransformStrokes`, `onEnginePortReady` from Wave 3). `MemoizedPhysicsPaintCanvasMount.ts` follows the new prop type. Rename nothing else. Update `PhysicsPaintCanvasMount.test.ts` (it `readFileSync`s the deleted `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` at `:10`) and `PhysicsPaintCanvasMount.runtime.test.ts` (it imports `EfxPaintEngine` and mocks `@efxlab/efx-physic-paint/preact` at `:5-8`, `:29`) to the new surface: both pin the MOUNT's shape, not the engine, so keep the structural rows and delete the engine-1 ones.

    **4.2 Settings and lifecycle retype.** `physicsPaintStudioSettings.ts`: replace `BgMode` / `ToolType` / `EfxPaintEngine` imports with `types/paintCore.ts`; keep `StudioBackgroundMode` and every persisted key byte-identical. Its test (`physicsPaintStudioSettings.test.ts:45`) reads `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` to pin the fresh-open defaults — delete that engine-source pin (its subject is gone) and keep the settings unit cases; the test is in this wave's `<files>`. `usePhysicsPaintEngineLifecycle.ts`: retype to the `AquarelleEnginePort` (or remove the `EfxPaintEngine` refs entirely if the hook has no remaining job — decide by what still calls it, and say which in the summary). `physicsPaintDevExport.ts`: retype if it exposes engine-1 state; otherwise leave it. `usePhysicsPaintSessionController.ts`, `usePhysicsPaintWorkflowIntegration.ts`: remove the engine type, keep frame export. `usePhysicsPaintLaunchIntegration.ts`: remove `resetBrushScriptStore` (imports at `:18` and the call at `:167`) and retype `PreviewBackgroundEngine`; `usePhysicsPaintLaunchIntegration.test.ts:3` imports `CompletedPaintMutation` / `PaintStroke` from the deleted package — retarget those types to `types/paintCore.ts` (its source is this wave, so the test is this wave's).

    **4.3 Split `usePhysicsPaintEngineActions.ts` — it is not a clean boundary.** Keep ONLY the paper-display surface: `setBackground`, `setGrainStrength`, `setGrainScale`, `updateSetting` (and their guards `canMutate` / `canUpdatePaperDisplay`, which must stay — the studio-reopen-paper-washout rule depends on `updateSetting` surviving an unready engine). DELETE the 11 engine-1 tool setters (`selectTool`, `setBrushColor`, `setBrushSize`, `setBrushOpacity`, `setEdgeDetail`, `setPickup`, `setSpread`, `setSmoothing`, `setEraseStrength`, `startPhysics`, `stopPhysics`) and every `input.engine!.set*` call. Remove their consumers in the tool rail (4.4) in the same wave. Keep the setters idempotent — an unchanged value must not write.

    **4.4 Right panel and tool rail.** `PhysicsPaintRightPanel.tsx`: remove the `BrushModuleSection` import (`:16`), its render (`:521`) and every `activeModule === 'brush'` branch. `RightPanelMemoryTab.tsx` still imports the Wave-2-deleted `./brushScriptRecordState` (`:38`) and is mounted by `PhysicsPaintRightPanel.tsx:20,381`: remove the whole Brush memory section (its store reads and its rows) and keep the Aquarelle/audio counters. `PhysicsPaintToolRail.tsx`: remove the Brush tool set and every engine-1 tool dispatch; keep the Aquarelle tool row, Dry, Move/Select, and the shared rail behavior. `PhysicsPaintScriptsPanel.tsx`: remove the Brush script rows and branches; keep watercolor script rows and the legacy refused row.
    The three right-panel tests move with it: `PhysicsPaintRightPanel.test.ts` (reads `BrushModuleSection.tsx` at `:659-661`), `physicsPaintRightPanelModuleGate.test.ts` (`:107-108`, `:127` assert `BrushModuleSection` is/`is not` mounted) and `physicsPaintRightPanelPaperSingleHome.test.ts` (`:96` asserts it must remain) must assert the watercolor-only panel instead. Update `panelSplitShell.test.tsx` (`BrushModuleSection` import `:12`, rows `:149-174`, `:278`, `:304`, `:310`) to the surviving sections — its launcher `panelSplitShell.test.tsx.test.ts` is the verify target, not the `.tsx` itself.

    **4.5 `frameScriptOwnership.ts`.** Remove the `brushScriptRecordState` import and the `'brush'`/`'both'` returns (`:88-90`), so the derivation collapses to `'watercolor' | null` (`hasWatercolor ? 'watercolor' : null`). Delete the now-unused `LiveBrushScriptSample` parameter path if nothing else supplies it; otherwise keep the parameter ignored with a comment. Keep the re-export of `FrameScriptOwner` from `frameModuleLock.ts` (it stays the ONE declaration). Rewrite `frameScriptOwnership.test.ts`: drop the `brushScriptRecordState` imports (`:19-24`) and the 15 Brush rows; assert the collapsed truth table (real key + aquarelle script -> `'watercolor'`; non-real cell -> `null`; no script -> `null`).

    **4.6 Module gate collapse — literal-free, both directions.** `activeModule.ts`: `ActiveModule` becomes `'watercolor'` only; delete `WATERCOLOR_ONLY`; keep the single signal, the compare-then-write `setActiveModule` and the localStorage persistence. The stale-value guard must be written WITHOUT the `'brush'` literal: `readStoredModule()` returns `'watercolor'` unconditionally (or reads storage and maps every value to `'watercolor'`), with a comment stating that a stale stored value can never start the removed module. `setActiveModule` clamps to `'watercolor'`; the subscribe write persists `'watercolor'`.
    `frameModuleLock.ts`: `FrameScriptOwner` becomes `'watercolor' | null`; `lockedModuleForOwner` returns `null` (keep the export — the Studio imports it); keep `setFrameScriptOwner` compare-then-write and `clearFrameScriptOwner`; `lockedModuleTooltip` keeps only the watercolor branch (the locked slot is now unreachable). **`brushMoveAvailable` disposition — RETYPE, do not delete:** it is imported at `PhysicsPaintStudio.tsx:202` and read at `:1697`, `:2329`, `:2575`, so deleting it would churn the Move tool for no behaviour gain. Redefine it as `frameScriptOwner.value === 'watercolor'` — under the collapse `'brush'`/`'both'` can no longer occur, and a frame with a watercolor script is exactly the frame Move can translate. Rename nothing.
    `ModuleSwitcher.tsx`: remove the Brush slot; Water color active, Krita display-only and inert (it must never write the signal). `PhysicsPaintTopBar.tsx`: update the lock/tooltip wiring.
    Tests follow in the same commit: `activeModule.test.ts` (delete the `WATERCOLOR_ONLY` import/assertions at `:42`; keep the stale-stored-row as a RAW localStorage string in the stub — never as a typed `setActiveModule` argument), `frameModuleLock.test.ts` (drop the `'brush'`/`'both'` owner rows `:36-136`, including `lockedModuleTooltip('brush')` at `:136`, and pin `brushMoveAvailable` as `'watercolor'`-true / `null`-false), `ModuleSwitcher.test.tsx` (the three-segment Brush surface rows at `:16`, `:103-109`, `:206-227`, `:265-267` become the two-segment watercolor/krita surface).

    **4.7 CSS.** In `physicsPaintStudio.css` (7,588 lines) remove only Brush-module-only rule blocks — those whose selectors no longer exist after 4.1-4.6. Do not restyle anything that still renders. If you cannot prove a rule is dead, leave it; a dead rule is cheaper than a visual regression. Record the removed-block count.

    **4.8 Commit** with pathspec-scoped adds. Message: `refactor(261027-klx): drop the Brush module surface from the Studio`.

    **Expected state:** `pnpm --dir app run typecheck` exits 0.
  </action>
  <verify>
    <automated>pnpm --dir app run typecheck && pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/shared/ModuleSwitcher.test.tsx.test.ts src/components/shared/activeModule.test.ts src/components/shared/frameModuleLock.test.ts src/components/physic-paint/view/PhysicsPaintTopBar.test.ts src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts src/components/physic-paint/view/physicsPaintRightPanelModuleGate.test.ts src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts src/components/physic-paint/view/panelSplitShell.test.tsx.test.ts src/components/physic-paint/view/frameScriptOwnership.test.ts src/components/physic-paint/engine/PhysicsPaintCanvasMount.test.ts src/components/physic-paint/engine/PhysicsPaintCanvasMount.runtime.test.ts src/components/physic-paint/engine/usePhysicsPaintEngineActions.test.ts src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.test.ts && ! grep -rn "WATERCOLOR_ONLY\|'brush'" app/src/components/shared/activeModule.ts app/src/components/shared/frameModuleLock.ts app/src/components/physic-paint/view/frameScriptOwnership.ts</automated>
  </verify>
  <done>
    `pnpm --dir app run typecheck` exits 0; every test file this wave's verify runs is in this wave's `<files>` and green (including the `.test.tsx.test.ts` launcher for `panelSplitShell` and the two right-panel gate suites); the module gate no longer contains a Brush branch or the `WATERCOLOR_ONLY` seam in `activeModule.ts`, `frameModuleLock.ts` or `frameScriptOwnership.ts`, and none of the three contains the `'brush'` literal; `brushMoveAvailable` is retyped to the watercolor-only predicate with its three Studio call sites and its test rows updated; the Studio renders only the Aquarelle surface with no hidden engine-1 canvas; no do-not-delete UI surface (BrushesDocker, BrushResponsePanel, WatercolorBrushLibrary, ScriptStrokeOverlay, recordedStrokeGroups, aquarelleRecordState, rails, compositor) was removed.
  </done>
</task>

<!-- ============================================================
     WAVE 5 — Rust script library.
     ============================================================ -->
<task type="auto">
  <name>Wave 5: collapse the Rust script library to the watercolor engine id and keep the legacy refusal path</name>
  <files>
    app/src-tauri/src/services/script_library.rs
    app/src-tauri/tests/script_library_schema.rs
    app/src-tauri/tests/script_library_transaction_contract.rs
    app/src-tauri/src/services/studio_script_snapshot.rs
  </files>
  <action>
    **5.1 Leave the snapshot file version alone.** `services/studio_script_snapshot.rs:63` `STUDIO_SCRIPT_SNAPSHOT_FORMAT_VERSION: u32 = 1` is the FILE-NAME version (`<trackId>-v1.snap`) and is independent of the container u16 bumped in Wave 3. Do not change it; comment/test edits only. Do not widen the path check at `:445` — only the exact `<trackId>-v1.snap` leaf may be touched.

    **5.2 Script library engine identity.** In `services/script_library.rs`: delete `pub const SCRIPT_ENGINE_ID` (`:16`); in `validate_document` (`:2152`) collapse the engine filter to `*id == SCRIPT_ENGINE_ID_AQUARELLE` so an old Brush document fails validation and surfaces through the existing refusal classification (this IS the clean-break mechanism — do not add migration code and do not add a compatibility branch); in `validate_strokes` (`~:2277`) and `validate_engine_payload` (`~:2429`) remove the engine-1 arms and keep the aquarelle paths (Dry markers legal, aquarelle payload validation). Keep `SCRIPT_KIND`, `SCRIPT_VERSION`, every size/count/file-name bound, `validate_brush_pack` (the watercolor tip pack), and `SCRIPT_ENGINE_ID_AQUARELLE`. Keep the test fixture rows that reference aquarelle.

    **5.3 Tests.** Update `tests/script_library_schema.rs` engine-id cases to the watercolor-only world (a legacy `efx-physic-paint` document is REFUSED, not accepted). Update `tests/script_library_transaction_contract.rs` fixtures. **Do not delete or weaken `legacy_scripts_stay_visible_as_refused_rows`** — it is the row that keeps an old script library from crashing the panel. If a fixture there names the legacy id, keep the literal as refusal INPUT, never as an accepted id.

    **5.4 Commit** with pathspec-scoped adds. Message: `refactor(261027-klx): watercolor-only script library on the Rust side`.
  </action>
  <verify>
    <automated>cargo test --manifest-path app/src-tauri/Cargo.toml && ! grep -q 'const SCRIPT_ENGINE_ID:' app/src-tauri/src/services/script_library.rs && grep -q 'const SCRIPT_ENGINE_ID_AQUARELLE:' app/src-tauri/src/services/script_library.rs && grep -q 'STUDIO_SCRIPT_SNAPSHOT_FORMAT_VERSION: u32 = 1' app/src-tauri/src/services/studio_script_snapshot.rs && test "$(grep -rn 'SCRIPT_ENGINE_ID\b' app/src-tauri/src | wc -l | tr -d ' ')" = "0" && echo "G4: 0"</automated>
  </verify>
  <done>
    `cargo test --manifest-path app/src-tauri/Cargo.toml` is green including `legacy_scripts_stay_visible_as_refused_rows`; the engine-1 constant is gone — the absence gate is boundary-exact (`const SCRIPT_ENGINE_ID:` never matches the retained `const SCRIPT_ENGINE_ID_AQUARELLE:`) and the positive gate proves the aquarelle constant survived; the G4 census is **0** and its matched-lines list is empty (note: `\b` does not match between `D` and `_`, so the aquarelle constant was never a G4 hit); the snapshot file-name version is still `1`.
  </done>
</task>

<!-- ============================================================
     WAVE 6 — full gates and native UAT prep.
     ============================================================ -->
<task type="auto">
  <name>Wave 6: run every full gate, the static census and the chunk budget; prepare the native UAT rows</name>
  <files>
    app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    app/src/lib/paperPass.frameGuard.test.ts
    app/src/efx-paint/host-split/hostSplitSuiteGate.test.ts
    app/src/viteBuild.test.ts
    .planning/quick/261027-klx-remove-engine-1-called-brush-mode-efx-ph/261027-klx-W6-SUMMARY.md
  </files>
  <action>
    Run the gates in this order and record every result verbatim in the Wave 6 summary. Fix only what a gate proves broken; a red gate is never a reason to weaken a pin (stop condition S3 after two attempts).

    **6.1 Typecheck.** `pnpm --dir app run typecheck` — must exit 0.
    **6.2 Full app suite.** `pnpm --dir app exec vitest run` — must exit 0. Every previously skipped-by-target `.tsx` test must be run through its `.test.tsx.test.ts` launcher.
    **6.3 Watercolor package.** `pnpm --dir packages/efx-watercolor run check && pnpm --dir packages/efx-watercolor exec vitest run && pnpm --dir packages/efx-watercolor run build`.
    **6.4 App build and chunk.** `pnpm --dir app run build`; then `ls -l app/dist/PhysicsPaintStudio-*.js`. Pass: at least one chunk matches `/PhysicsPaintStudio-[^/]*\.js$/` and its byte size is <= 943,411 (target 650,000-700,000). `app/vite.config.ts` `chunkSizeWarningLimit: 2000` must not be raised. Stop condition S4 if exceeded.
    **6.5 Rust.** `cargo test --manifest-path app/src-tauri/Cargo.toml`.
    **6.6 Static gates.** The package census is split into TWO measured gates — runtime source and test/fixture occurrences — because the plan deliberately keeps the literal in negative guards and refusal rows. Both run here.
    - **G1-prod = 0** (runtime source only). `grep -rn "@efxlab/efx-physic-paint" app/src packages --include='*.ts' --include='*.tsx' --include='*.json' --include='*.mjs' | grep -v node_modules | grep -v dist | grep -vE '\.test\.(ts|tsx)|__fixtures__|fakeEngine2Fixture' | wc -l` -> **must be 0**. This is the gate that proves no live import survives.
    - **G1-tests** (enumerated, not zero). The exact inventory command `grep -rn "@efxlab/efx-physic-paint" app/src packages --include='*.ts' --include='*.tsx' --include='*.json' | grep -v node_modules | grep -v dist` -> print every `file:line` into the Wave 6 summary and assert each one is exactly one of: (a) a negative guard that plants the literal to prove it cannot re-enter, (b) a legacy-refusal row, (c) a fixture (`fakeEngine2Fixture`, a golden JSON string), or (d) a comment. **No hit may be a live import.** Known survivors that must be enumerated and justified: `packages/efx-watercolor/src/determinismContract.test.ts:162,169` (negative guard in a do-not-delete package — the file asserts the package's own `package.json` and sources NEVER mention engine-1; deleting it would remove a live direction contract), `app/src/efx-paint/host-split/hostImportGraphContract.test.ts:9,283,284,293,301`, `hostGenericityRoundTrip.test.ts:177`, `hostAnimationResidueContract.test.ts:46,48`, `fakeEngine2Fixture.ts:14`, and the refusal rows in `physicsPaintRotoRegistryOwnership.test.ts`, `physicsPaintRotoRevealBake.test.ts`, `rotoCompletionPaintGuard.test.ts`.
    - **G2 = 0.** `grep -rn "brushScript\|BrushScript" app/src --include='*.ts' --include='*.tsx' | wc -l` -> **must be 0**. No test exclusion: the Brush store, its tests, the memory-gauge/snapshot sections, the duplicate-script cases and the Studio pins are all rewritten or deleted by Waves 2-4.
    - **G3 = 0.** `grep -rn "ROTO_SCRIPT_ENGINE_ID\b" app/src | wc -l` -> **must be 0** (the Aquarelle constant is `ROTO_SCRIPT_ENGINE_ID_AQUARELLE`, which `\b` excludes; that is why it is not counted).
    - **G4 = 0, mechanically asserted.** `test "$(grep -rn 'SCRIPT_ENGINE_ID\b' app/src-tauri/src | wc -l | tr -d ' ')" = "0"` AND the matched-lines list must be empty. `\b` does not match between `D` and `_`, so `SCRIPT_ENGINE_ID_AQUARELLE` never counts — 0 is the correct expected value, not a filter artefact.
    - **G5 — allowlisted and printed.** `grep -rn "efx-physic-paint" app/src --include='*.ts' --include='*.tsx' | wc -l` — assert the count equals the number of allowlisted hits, produce the full `file:count` list, and assert every file is in the allowlist below. Baseline 132 (2026-10-27).
    **G5 allowlist (each entry justified):**
    1. Window label — `app/src/lib/physicPaintBridge.ts`, `app/src/lib/physicPaintFlush.ts` and their tests. The Studio window is still named `efx-physic-paint`; the Tauri capability file is untouched.
    2. Legacy refusal — `app/src/components/physic-paint/roto/physicsPaintRotoScriptApplyRefusal.ts` (`'efx-physic-paint': 'Brush'`, required by the existing pin `hostSplitFailClosedApply.test.ts:226`) plus its test, the schema's `ROTO_SCRIPT_LEGACY_ENGINE_ID` classification literal plus its test, and the refusal rows in the host-split contract tests (`hostSplitFailClosedApply.test.ts`, `physicsPaintRotoRevealBake.test.ts`, `physicsPaintRotoRegistryOwnership.test.ts`, `rotoCompletionPaintGuard.test.ts`) that assert an old Brush script is REFUSED.
    3. Negative guards — `app/src/efx-paint/host-split/hostImportGraphContract.test.ts`, `hostAnimationResidueContract.test.ts`, `hostGenericityRoundTrip.test.ts`, `exportRenderer.test.ts` and `fakeEngine2Fixture.ts`, which plant the forbidden literal to prove no engine-1 specifier can re-enter. Deleting these would remove a live architecture pin.
    4. Comments / scan-root definitions only — any remaining hit inside a `//`, `/* */` or doc comment, or a path constant that names the retired package solely to scan for it (e.g. `viteBuild.test.ts`, `PhysicsPaintRightSidebar.test.ts` window-label assertions, and `efxPaintCleanBreakContract.test.ts` after Wave 1 removes the deleted scan root).
    If a hit is outside these four categories it is a real leak: fix the code, do not widen the allowlist.
    **6.7 Do-not-delete probe.** Assert these still exist and were not gutted: `packages/efx-watercolor/package.json`, `packages/efx-paint-host/package.json`, `packages/efx-spectral/package.json`, `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx`, `app/src/components/physic-paint/engine/aquarelleStrokeBridge.ts`, `app/src/components/physic-paint/view/recordedStrokeGroups.ts`, `app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx`, `app/src/components/physic-paint/view/aquarelleRecordState.ts`, `app/src/components/physic-paint/view/BrushesDocker.tsx`, `app/src/components/physic-paint/view/BrushResponsePanel.tsx`, `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx`, `app/src/components/physic-paint/view/WatercolorModuleSection.tsx`, `app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx`, `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts`, `app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts`, `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx`, `app/src/lib/brushP5Adapter.ts`, `app/src/lib/brushFxDefaults.test.ts`, `app/src/types/paint.ts`, `app/src/types/p5brush.d.ts`, `app/src-tauri/capabilities/physics-paint.json`.
    **6.8 Doc reference pass (non-code, no gate).** Confirm no *code* string still points at the package; `.planning/` and `SPECS/` may keep naming engine-1.
    **6.9 Report the native UAT rows 1-7** (inventory §11) as **automated-ready only** — never claim done before the live UAT. Rows: (1) Studio opens Water color only, faster, lower memory; (2) paint/select/move/delete/undo/redo unaffected; (3) Roto keys + Play Script Apply watercolor-only; (4) save/close/reopen/navigate restores SNAP v5 with no brush seeding; (5) script library loads watercolor scripts and shows an old Brush script as a refused legacy row without a crash; (6) composite/export unchanged; (7) devtools memory shows no engine-1 allocations and a smaller Studio chunk.
    **6.10 Commit** the gate-driven fixes (if any) with pathspec-scoped adds. Message: `test(261027-klx): full gates for the engine-1 removal`.
  </action>
  <verify>
    <automated>pnpm --dir app run typecheck && pnpm --dir app exec vitest run && pnpm --dir packages/efx-watercolor run check && pnpm --dir packages/efx-watercolor exec vitest run && pnpm --dir packages/efx-watercolor run build && pnpm --dir app run build && ls -l app/dist/PhysicsPaintStudio-*.js && cargo test --manifest-path app/src-tauri/Cargo.toml && test "$(grep -rn '@efxlab/efx-physic-paint' app/src packages --include='*.ts' --include='*.tsx' --include='*.json' --include='*.mjs' | grep -v node_modules | grep -v dist | grep -vE '\.test\.(ts|tsx)|__fixtures__|fakeEngine2Fixture' | wc -l | tr -d ' ')" = "0" && echo "G1-prod: 0" && echo "G1-tests inventory:" && grep -rn '@efxlab/efx-physic-paint' app/src packages --include='*.ts' --include='*.tsx' --include='*.json' | grep -v node_modules | grep -v dist && test "$(grep -rn 'brushScript\|BrushScript' app/src --include='*.ts' --include='*.tsx' | wc -l | tr -d ' ')" = "0" && echo "G2: 0" && test "$(grep -rn 'ROTO_SCRIPT_ENGINE_ID\b' app/src | wc -l | tr -d ' ')" = "0" && echo "G3: 0" && test "$(grep -rn 'SCRIPT_ENGINE_ID\b' app/src-tauri/src | wc -l | tr -d ' ')" = "0" && echo "G4: 0 (matched-lines list empty)" && echo "G5 count: $(grep -rn 'efx-physic-paint' app/src --include='*.ts' --include='*.tsx' | wc -l | tr -d ' ') — inventory:" && grep -rn 'efx-physic-paint' app/src --include='*.ts' --include='*.tsx' && test -z "$(grep -rl 'efx-physic-paint' app/src --include='*.ts' --include='*.tsx' | grep -vE 'physicPaintBridge|physicPaintFlush|physicsPaintRotoScriptApplyRefusal|physicsPaintRotoScriptSchema|hostSplitFailClosedApply|physicsPaintRotoRevealBake|physicsPaintRotoRegistryOwnership|rotoCompletionPaintGuard|efxPaintCleanBreakContract|hostImportGraphContract|hostAnimationResidueContract|hostGenericityRoundTrip|exportRenderer|fakeEngine2Fixture|viteBuild|PhysicsPaintRightSidebar')" && echo "G5 allowlist: OK" && for p in packages/efx-watercolor/package.json packages/efx-paint-host/package.json packages/efx-spectral/package.json app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx app/src/components/physic-paint/engine/aquarelleStrokeBridge.ts app/src/components/physic-paint/view/recordedStrokeGroups.ts app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx app/src/components/physic-paint/view/aquarelleRecordState.ts app/src/components/physic-paint/view/BrushesDocker.tsx app/src/components/physic-paint/view/BrushResponsePanel.tsx app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx app/src/components/physic-paint/view/WatercolorModuleSection.tsx app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx app/src/components/physic-paint/view/aquarelleStrokeSelection.ts app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx app/src/lib/brushP5Adapter.ts app/src/lib/brushFxDefaults.test.ts app/src/types/paint.ts app/src/types/p5brush.d.ts app/src-tauri/capabilities/physics-paint.json; do test -e "$p" || { echo "DO-NOT-DELETE PROBE MISSING: $p"; exit 1; }; done && echo "DO-NOT-DELETE PROBE: OK"</automated>
  </verify>
  <done>
    Typecheck, the full app suite, the watercolor package check/suite/build, the app production build and the Rust suite are all green in one run; **G1-prod = 0** (no live import of the specifier survives) while **G1-tests** is enumerated file-by-line in the summary and every hit is a negative guard, a refusal row, a fixture or a comment — with `packages/efx-watercolor/src/determinismContract.test.ts` justified as a negative guard in a do-not-delete package; **G2 = 0**, **G3 = 0**, **G4 = 0** with an empty matched-lines list; **G5** hits are printed as a `file:count` list and every file is in the four allowlist categories; the do-not-delete probe passes on all twenty paths; the Studio chunk is <= 943,411 bytes with at least one separate `PhysicsPaintStudio-*.js` chunk; the seven native UAT rows are reported automated-ready and not claimed complete.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| on-disk SNAP file -> app codec | Untrusted, previously-written bytes (magic, u16 version, sections) cross into the decoder |
| on-disk script library JSON -> Rust validator | Untrusted `.efx-roto-script.json` envelopes cross into `validate_document` / `validate_strokes` / `validate_engine_payload` |
| renderer -> Rust file IO | The renderer may only name a `<trackId>-v1.snap` leaf; Rust owns the path |
| package manager -> workspace | Removing a workspace dependency touches the lockfile and install surface |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261027-01 | Tampering / DoS | `studioScriptSnapshotCodec.ts` decode while the brush section is removed | medium | mitigate | Remove only the brush section; keep every `Reader` bound check (`magic`, `truncated`, `count`, `length`, `flags`, `version`). Add a v5 encode->decode round-trip test and keep the truncated-container behaviour covered by the existing codec suite (Wave 3, 3.7). |
| T-261027-02 | Spoofing | Retired-version restore path | medium | mitigate | Versions 1-4 raise `snap-v4-retired` and seed nothing; the controller test asserts `maxRestoredMutationId === 0` and an empty restored timeline, so a stale Brush script can never resurrect into a watercolor session (Wave 3, 3.7). |
| T-261027-03 | Tampering | Script engine identity after the clean break | medium | mitigate | Rust `validate_document` accepts `SCRIPT_ENGINE_ID_AQUARELLE` only; the app schema produces `efx-watercolor` only and uses the legacy literal solely for refusal classification. `legacy_scripts_stay_visible_as_refused_rows` stays green as the regression pin (Wave 3 3.4, Wave 5 5.2-5.3). |
| T-261027-04 | Tampering | SNAP file path selection | low | accept | The Rust file-name version stays `1` and the `<trackId>-v1.snap` leaf check is untouched; no widening is introduced by this change, so the existing control is sufficient and re-verified by the snapshot tests. |
| T-261027-05 | Elevation / Integrity | Deleting the wrong surface during a large removal | high | mitigate | The do-not-delete list is restated in `must_haves.truths`, enforced by the Wave 6 do-not-delete probe (6.7) and by stop conditions S2/S6; every delete proves its importer set before removal (Wave 2). |
| T-261027-06 | Repudiation | A gate silently passing because it executed nothing (`.test.tsx` target) | low | mitigate | Gate hygiene rule: only `.test.ts` targets or their `.test.tsx.test.ts` launchers; `grep -c` is banned on files whose own comments carry the token. |
| T-261027-SC | Tampering | Package-manager installs | high | mitigate | No dependency is added; one workspace dependency is removed. `pnpm install` is run only to regenerate the lockfile from the workspace manifests. Any new package would require the package-legitimacy gate and a blocking human checkpoint — not applicable here, recorded so the row cannot be silently reused. |
</threat_model>

<verification>
## Wave-level verification (each dispatch)

| Wave | Gate | Pass criterion |
|------|------|----------------|
| 0 | build + 8 targeted suites + typecheck | all green; chunk <= 943,411 bytes; golden fixture committed; parity proof recorded |
| 1 | manifest grep + 3 test files + typecheck census | manifest gate 0; the two module-load-fragile files + `stackOrder.test.ts` green; failure set ⊆ Wave 2-4 list |
| 2 | existence checks + 5 test files + typecheck census | deletes landed; `temporaryMove` alive with zero engine-1 imports; gate list green; failure set strictly smaller |
| 3 | the 23 explicitly listed roto/snapshot/performance/hooks/Studio test files + watercolor check + typecheck census | all green; every executed test file is in the wave's `<files>`; SNAP v5 cases green; residual failures ⊆ Wave 4 list |
| 4 | typecheck + 14 named suites (incl. the `panelSplitShell.test.tsx.test.ts` launcher) + module-gate grep | typecheck 0; all suites green; no Brush branch and no `'brush'` literal in the three gate modules |
| 5 | cargo test + boundary-exact constant gates | cargo green incl. legacy refusal; `const SCRIPT_ENGINE_ID:` absent; `const SCRIPT_ENGINE_ID_AQUARELLE:` present; G4 = 0; snapshot file version still 1 |
| 6 | typecheck + full app suite + watercolor check/suite/build + app build + cargo + G1-prod/G1-tests/G2/G3/G4/G5 + do-not-delete probe | every gate green; G1-prod=G2=G3=G4=0; G1-tests and G5 enumerated and allowlisted; probe passes on 20 paths; chunk <= 943,411 bytes |
</verification>

<success_criteria>
- `packages/efx-physic-paint` is gone and no manifest, alias, lockfile entry, script or runtime source specifier references it (G1-prod = 0); every remaining test/fixture occurrence is an enumerated negative guard, refusal row, fixture or comment (G1-tests, allowlisted).
- The app-owned mutation ledger owns stroke identity: monotonic, never reused, seeded from restored max + 1, acceptance order == stroke-end order, completion emitted without rasterization — and the numeric-identity waiver is written into the Wave 0 summary with the three disappearing ID sources cited (`EfxPaintEngine.ts:4687`, `:3690`, `:5100`).
- `conditionHeightMap` is byte-identical to engine-1, proven by the committed golden fixture.
- `stackOrder`'s three functions are app-owned and behaviourally pinned before the package died.
- Roto and script read accepted strokes through ONE memoized port; `getAcceptedTarget` works; watercolor Roto frames still persist.
- SNAP is v5 with no brush body; versions 1-4 produce exactly one pinned clean-break notice per binding and seed zero rows; the Rust file-name version is still 1.
- The Brush module surface is gone from the Studio, the module switcher and the frame-ownership gate.
- G2 = 0, G3 = 0, G4 = 0 (with an empty matched-lines list); G1-tests and G5 are allowlisted, justified and enumerated file-by-file.
- Typecheck, the full app suite, the watercolor package check/suite/build, the app production build, and `cargo test` are green; the Studio chunk is <= 943,411 bytes.
- Every do-not-delete surface survives.
- The seven native UAT rows are reported automated-ready — **not** claimed complete.
</success_criteria>

<output>
Per wave, create `.planning/quick/261027-klx-remove-engine-1-called-brush-mode-efx-ph/261027-klx-W{wave}-SUMMARY.md` and then STOP for the user's "go".
After Wave 6, the orchestrator writes the final `261027-klx-SUMMARY.md` and updates STATE.md.
</output>
