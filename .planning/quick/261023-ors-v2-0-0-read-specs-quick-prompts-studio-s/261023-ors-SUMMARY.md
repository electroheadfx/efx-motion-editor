---
phase: quick-261023-ors
plan: 261023-ors
subsystem: physic-paint-studio-script-persistence
tags: [physic-paint, studio, memory-gauge, purge, script-memory, snapshot, delete, rust, tauri, package, app-cache, authority, track-deletion]

# Dependency graph
requires:
  - phase: quick-261023-f9c
    provides: the read-only estimator (`buildScriptMemorySnapshot`) and the DEV probe assembly
  - phase: quick-261023-l35
    provides: SNAP v1 codec, the never-rejecting controller, the app-cache snapshot service/commands, launch restore
  - phase: quick-261023-o3n
    provides: the package-sidecar leg behind `scriptLibraryAuthority`, package-first restore, live authority plumbing
provides:
  - A LAST "Memory" top-pane tab in both modes showing Scripts (watercolor timeline + brush store, per frame and total) and the four frame caches as separate lines
  - Confirmed per-key purge (one frame) and clear-all (active rail only), pixels kept, editability lost and stated
  - `persistAfterPurge`: rewrite the authoritative snapshot leg, then delete the stale app-cache fallback only when bound and clean
  - `studio_script_snapshot_delete` (scope `cache` | `both`) + `ipcStudioScriptSnapshotDelete`
  - The committed rail-delete cascade: `commitDeleteTrack` -> one registered hook -> `remove(..., 'both')`, binding cleared first
affects: [v2.0.0-milestone-close, studio-script-snapshot-hardening]

actuals:
  tokens: 37802   # chars/4 over the 3-commit realized diff (151,208 chars)
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "One assembler, two entry points: the production `readStudioScriptMemorySnapshot` owns the assembly; the DEV probe delegates to it so the numbers can never drift"
    - "Purge marker, not a recapture: a purged brush frame is marked so `flushBrushScriptFrame` returns false until a REAL mutation (`markBrushScriptFrameDirty`) lifts it"
    - "Persist-then-delete: `persistAfterPurge` awaits the FIFO `flushNow()` rewrite first; the cache leg is deleted ONLY when the store is no longer dirty and an authority is bound (a failed rewrite must never delete the fallback)"
    - "Generation-guarded cleanup: a rebind during the rewrite abandons the cache delete (the key it described is gone)"
    - "Process-wide nullable hook for a committed store mutation: `commitDeleteTrack` invokes it inside try/catch after every fail-closed guard; a throw can never block the rail delete"
    - "Fail-closed cascade key: the committed `(layerId, trackId)` names the file, never the binding's own track; no binding or another layer is a no-op"
    - "Bind-before-remove: the controller binding is invalidated synchronously (null identity ref + `bind(null)` -> generation bump + debounce clear) before the delete is dispatched"

key-files:
  created:
    - app/src/components/physic-paint/performance/studioScriptMemoryGauge.ts
    - app/src/components/physic-paint/performance/studioScriptMemoryGauge.test.ts
    - app/src/components/physic-paint/view/RightPanelMemoryTab.tsx
    - app/src/components/physic-paint/snapshot/studioScriptSnapshotTrackDelete.ts
    - app/src/components/physic-paint/snapshot/studioScriptSnapshotTrackDelete.test.ts
    - .planning/quick/261023-ors-v2-0-0-read-specs-quick-prompts-studio-s/261023-ors-SUMMARY.md
  modified:
    - app/src-tauri/src/services/studio_script_snapshot.rs
    - app/src-tauri/src/commands/studio_script_snapshot.rs
    - app/src-tauri/src/lib.rs
    - app/src/lib/ipc.ts
    - app/src/components/physic-paint/performance/scriptMemoryProbe.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.purge.test.ts
    - app/src/components/physic-paint/view/brushScriptRecordState.ts
    - app/src/components/physic-paint/view/brushScriptRecordState.test.ts
    - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts
    - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts
    - app/src/components/physic-paint/view/physicsPaintRightPanelModuleGate.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/stores/efxPaintStore.ts
    - app/src/stores/trackDeleteLaws.test.ts

key-decisions:
  - "The Memory tab recomputes on mount and after 250 ms of quiet following either script revision, plus a 2 s interval for the cache getters; the subscription lives in the tab, never in the Studio body (the l35 save effect stays the only `brushScriptRevision.value` read there)."
  - "`approxBytes` reuses the f9c estimator unchanged: UTF-8 length of `JSON.stringify`, with BOTH retained watercolor copies counted (raw registry + projected entry). No second accounting was invented."
  - "Per-key purge splices only events whose `playFrame` equals the displayed frame; Dry events are sheet actions and are kept; the record clock is not reset."
  - "Clear-all is the ACTIVE rail because the Studio stores are track-scoped; it empties every entry and marks every dropped brush frame plus the caller's current frame."
  - "A purge is never silent: both actions use an inline confirmation in the tab; Cancel leaves stores and files untouched; a successful purge refreshes the gauge immediately."
  - "The stale fallback delete is conditional on a clean store and a bound authority — deleting the cache while a failed rewrite left the fallback as the only copy would lose the script."
  - "The rail cascade deletes scope `both` through the LIVE authority read at dispatch time, so a Save As while the Studio is open retargets the delete correctly."
  - "A stale authority is refused by Rust before resolving a package root; the cache leg is still deleted by `scope=both` only when the authority resolves (unbound projects delete cache only)."

requirements-completed: []

# Metrics
duration: ~2h20m (two executor sessions)
completed: 2026-10-23
status: complete
commits: 3
plan_head_before: 3757640c52c3dfd9f496b0a227e236fa69138c5f
plan_head_after: c1132a139c38f6e8d2edaff35a8ee9692d481cd6
---

# Quick 261023-ors: Studio Script-Memory Gauge, Purge and Rail-Delete Cascade Summary

A LAST "Memory" tab now reports live watercolor and brush script cost against the four frame caches, both purge actions are explicitly confirmed and immediately clean the persisted snapshot, and deleting a rail removes its package sidecar and cache fallback with the Studio binding cleared first.

## Performance

- **Duration:** ~2h20m across two executor sessions (Task 1 committed 18:21, Task 2 20:36, Task 3 20:38)
- **Tasks:** 3/3
- **Files:** 25 changed (2,832 insertions, 111 deletions)
- **Commits:** 3 (measured from the plan ledger)

## Gauge fixture values — FIXTURE-DERIVED

The executor may not run the app or the dev server, so no live heavy-session numbers exist yet. The values below are the deterministic fixtures in `studioScriptMemoryGauge.test.ts`; live in-app figures only after UAT.

| Bucket | Fixture | Basis |
|--------|---------|-------|
| Watercolor frame 0 | 1 stroke, 2 points, estimator-derived bytes | `rawStroke` fixture; `approxBytes` = UTF-8 `JSON.stringify` length of BOTH retained copies (raw registry + projected entry) |
| Watercolor frame 4 | 1 stroke, 2 points, estimator-derived bytes | same fixture, second `playFrame` |
| Brush frame 0 | 1 stroke, 2 points, 100 B | literal per-frame fixture input |
| Brush frame 7 | 3 strokes, 9 points, 900 B | literal per-frame fixture input |
| Brush totals | 4 strokes, 11 points, **1,000 B** | literal totals fixture input |
| Live engine read (frame 3) | 1 brush stroke, 2 points, estimator-derived bytes | `fakeEngine(BRUSH_STROKES)`; `getStrokes` fixture |
| frameLru | 0 B, 0 entries, ceiling 512 MiB (536,870,912 B) | `frameLru.byteTotal` / `entryCount`; `FRAME_LRU_BYTE_CEILING` |
| generatedRenderSource | 4,096 B, 2 entries, ceiling 64 MiB | mocked `getGeneratedRenderSourceCacheStats` |
| rotoCache.realKey | 1,024 B, 1 frame | mocked `getRotoCacheByteStats` |
| rotoCache.generated | 2,048 B, 3 frames | mocked `getRotoCacheByteStats` |
| Frame-cache grand total | **7,168 B** (empty LRU) + live LRU | asserted as the sum of the four caches |
| Script totals in that fixture | watercolor approxBytes 0 (no watercolor seeded); brush total from `getBrushScriptReport()` | asserted separately from every cache byte |

## Purge scope laws

- **Per-key (`purgeAquarelleFrameScript(frame)` + `purgeBrushScriptFrame(frame)`):** removes only events whose `playFrame` equals `frame` plus that frame's registry entry, projected entry, deletion marker and serial; every other frame is untouched; Dry events stay at their index; the record clock is not reset; one revision bump when anything was removed.
- **Clear-all (`purgeAllAquarelleKeyScripts()` + `purgeAllBrushScriptFrames(startFrame)`):** empties every non-Dry event and every registry entry of the ACTIVE rail (the stores are track-scoped), keeps Dry events, clears the per-frame serial counters, and marks every dropped brush frame plus the current frame.
- **Explicit, never silent:** both actions require an inline confirmation; the copy names the frame or the active rail, states that pixels stay, and states that Move/Select/replay (editability) is lost. Cancel changes nothing. The per-key button is enabled only when the displayed frame has a row; clear-all only when the snapshot reports any script strokes.
- **Re-capture law:** after a purge, `flushBrushScriptFrame` on that frame returns false and writes nothing even when the engine still holds strokes; `markBrushScriptFrameDirty` lifts the marker so a REAL mutation captures again (partial, because the pixels are the base). Capture/clear/delete/restore/reset/prune also clear the relevant markers.

## Persistence cleanup order

1. **Rewrite the authoritative leg** — `persistAfterPurge()` awaits the existing FIFO `flushNow()`, so the pruned payload is prepared and written synchronously before anything is deleted.
2. **Abandon on rebind** — if the generation changed while the rewrite ran, the delete is skipped (the key it described is gone).
3. **Delete the stale fallback ONLY when safe** — `isDirty()` must be false (a failed rewrite must NOT delete the fallback) and an authority must be bound (unbound means the cache IS the authority and must stay).
4. **Delete the cache leg** through `remove(identity, authority, 'cache')`; a failure reports `studioScriptSnapshotPurgeFailureMessage(kind)` once and never rejects or blocks painting.

## Rail-delete cascade

- `commitDeleteTrack` invokes `_setEfxPaintTrackScriptDeleteCallback(layerId, trackId)` exactly once, after the four fail-closed guards (no document, unknown track, not acknowledged, last track) and before `severTrackHoldReferences`; the callback is wrapped in try/catch so a failure cannot block the committed delete.
- `createStudioScriptSnapshotTrackDelete(deps)(layerId, trackId)`:
  - no bound identity -> no-op (never guesses a key);
  - bound identity for another layer -> no-op;
  - deleted track IS the bound one -> `clearBinding()` runs SYNCHRONOUSLY first (nulls the identity ref and calls `bind(null)`, which bumps the generation and clears the debounce), so a pending save, prepared payload or in-flight restore cannot rewrite the key;
  - then dispatches `remove({ projectId, layerId, trackId }, liveAuthority, 'both')` fire-and-forget and reports `studioScriptSnapshotTrackDeleteFailureMessage(kind)` once on failure.
- Only the exact `<package>/scripts/<layerId>/<trackId>-v1.snap` and the `<projectId>/<layerId>/<trackId>-v1.snap` cache fallback are named; other rails and every Scripts-library preset (`*.efx-roto-script.json`) are never read or written.
- The Studio registers one hook instance in a mount effect with identity-stable deps and unregisters (`null`) on teardown.

## Verification

| Gate | Command | Result |
|------|---------|--------|
| Task 1 (gauge, panel, module gate, sidebar) | `vitest run .../studioScriptMemoryGauge.test.ts .../PhysicsPaintRightPanel.test.ts .../physicsPaintRightPanelModuleGate.test.ts .../PhysicsPaintRightSidebar.test.ts` | 64 pass, 2 fail — both PRE-EXISTING stale pins in the untouched sidebar test (see Deferred items); gauge 13/13, panel 34/34, module gate 9/9 |
| Task 2 (purge stores, controller, panel) | `vitest run .../aquarelleRecordState.purge.test.ts .../brushScriptRecordState.test.ts .../studioScriptSnapshotController.test.ts .../PhysicsPaintRightPanel.test.ts` | **125/125 pass** (8 + 52 + 31 + 34) |
| Task 3 (cascade, store laws, Studio pins) | `vitest run .../studioScriptSnapshotTrackDelete.test.ts src/stores/trackDeleteLaws.test.ts .../PhysicsPaintStudio.test.ts` | **276/276 pass** (7 + 20 + 249) |
| Rust snapshot service + commands | `cargo test --manifest-path app/src-tauri/Cargo.toml studio_script_snapshot` | **25/25 pass** (both-leg delete, missing silence, scope=cache leaves package, scope=both unbound deletes cache only, stale-authority refusal, key-law refusal before any filesystem touch, all prior read/write laws) |
| Typecheck | `pnpm --filter efx-motion-editor exec tsc --noEmit -p tsconfig.json` | Pre-existing unrelated baseline remains (`projectPaperRaster.test.ts`, `PhysicsPaintPalette.test.ts`, etc.); **ZERO errors in every file this plan touches** |
| Package IO boundary | `vitest run src/efx-paint/efxPaintPackageIoBoundary.test.ts` | **6/6 pass** — no renderer filesystem access enters the gauge, purge or cascade paths |
| Schema/dependency diff | `git diff --stat 3757640c..HEAD` on `app/efx-paint-package`, `app/src/efx-paint/document`, `app/src/types/efxPaintDocument*`, `app/src-tauri/Cargo.toml`, `Cargo.lock`, `app/package.json`, `pnpm-lock.yaml` | empty — no `.mce` manifest/schema change, no new dependency, no LRU policy change |

## Commits

- `538a201b` — feat(quick-261023-ors): show the script-memory gauge in a Memory tab
- `b9dd40d8` — feat(quick-261023-ors): purge scripts per key and per rail with snapshot cleanup
- `c1132a13` — feat(quick-261023-ors): cascade a committed rail delete to its snapshot

Docs artifacts (this SUMMARY, PLAN.md, deferred-items.md) are left uncommitted for the orchestrator's docs commit. STATE.md and ROADMAP.md were not modified.

## Deviations from Plan

1. **`role="tab"` literal count stays 8, not 9.** The plan predicted the sidebar pin would go 8 -> 9. The live source renders every top-pane tab from ONE literal inside the mode-derived map, so adding `memory` changes the rendered button count, not the literal count. The pin stays at 8 with the reason recorded inline; the rendered lists (Memory last in both modes) are pinned in `PhysicsPaintRightPanel.test.ts`. Corrected in Task 1 (`538a201b`).
2. Two pre-existing `PhysicsPaintRightSidebar.test.ts` failures were left untouched per the scope boundary and recorded in `deferred-items.md`: a stale `label="Delete Script"` assertion and a stale `repeat(6, auto)` toolbar pin, both introduced by quick 261022-o2a before this plan started. This quick's own additions to the sidebar file pass.

## Issues Encountered (test authoring only; production behaviour unchanged)

- The panel harness's first Memory-tab expansion renders before the mount effect writes the snapshot; the helper now performs a warm-up `textContent(tree)` read so subsequent expansions find the action buttons.
- The hand-rolled vnode walker joins JSX text with spaces, so the confirmation assertion uses `/Purge the script of Frame\s+5\s*\?/`.
- The cascade test's `vi.fn` needed the explicit `StudioScriptSnapshotTrackDeleteDeps['remove']` generic so `mockResolvedValue` could return a failure result.
- `trackDeleteLaws.test.ts` needed `afterEach` added to the vitest import, and the refusal test now asserts no call before the one successful delete instead of relying on `mockClear`.

## Threat Flags

None beyond the planned register. T-261023-ors-01..06 are mitigated as designed: validated key components before any join and an authority resolved only by Rust; persist-then-delete with a clean/bound guard and the brush purge marker; a debounced, subscription-scoped gauge; confirmed purges with frame/rail-scoped splices; the committed `(layerId, trackId)` only with fixed version 1; and a try/catch plus fire-and-forget cascade that reports once. No new dependency.

## UAT Rows (PASSED — user-approved 2026-10-23)

| # | Row | Expected | Status |
|---|-----|----------|--------|
| 1 | Open a heavy session | Gauge shows scripts and caches separately with plausible values | PASSED |
| 2 | Duplicate several scripted keys | Scripts line grows; caches line stays independent | PASSED |
| 3 | Purge one frame | That frame's script disappears; other frames and pixels unchanged; Move/Select disabled for that key | PASSED |
| 4 | Clear all (active rail) | Scripts line drops to zero for that rail; pixels remain; the Studio stays usable | PASSED |
| 5 | With persistence, close/reopen after a purge | Purged scripts do not come back | PASSED |
| 6 | Cancel the confirmation | Nothing changes | PASSED |
| 7 | Delete a scripted rail in the timeline | Its `scripts/<layerId>/<trackId>-v1.snap` and cache fallback are gone; other rails untouched; reopening shows no orphan script | PASSED |

### UAT feedback folded into the shipped UI (approved 2026-10-23)

- Memory tab: 10px top padding; action buttons no longer inherit uppercase.
- Gauge data is contextual to the active module (Brush or Watercolor), shows only the selected frame, and keeps frame caches in their own section.
- Confirmations are modal dialogs matching the Scripts-tab delete confirmation (Cancel focused, Escape closes, Tab trapped).
- Three purge scopes: **Purge script on frame N** (hidden while any rail is selected), **Purge scripts on rail frames X-Y** for a selected key rail, and **Clear all scripts on <track>** (active track only, never the whole layer).
- Buttons with nothing to purge are hidden, not grayed; actions sit at the top, the editability warning below, then a 12px gap before the details.

## Self-Check: PASSED

- Created/modified files exist: gauge module + test, `RightPanelMemoryTab.tsx`, the cascade factory + test, the Rust delete service/command, `ipc.ts`, the store hook, the Studio wiring + pins, this SUMMARY.
- Commits are ancestors of HEAD: `538a201b`, `b9dd40d8`, `c1132a13`.
- Working tree contains only the uncommitted `.planning/quick/261023-ors-.../` docs directory (PLAN, SUMMARY, deferred-items), as instructed.
