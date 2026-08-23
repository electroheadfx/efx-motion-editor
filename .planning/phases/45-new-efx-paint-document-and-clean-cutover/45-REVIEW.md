---
phase: 45-new-efx-paint-document-and-clean-cutover
reviewed: 2026-08-23T00:00:00Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - app/src/lib/efxPaintPersistence.ts
  - app/src/stores/projectStore.ts
  - app/src/stores/efxPaintStore.ts
  - app/src/stores/physicPaintStore.ts
  - app/src/efx-paint/document/efxPaintDocument.ts
  - app/src/efx-paint/document/efxPaintDocumentParsers.ts
  - app/src/efx-paint/document/efxPaintCleanBreak.ts
  - app/src/lib/physicPaintBridge.ts
  - app/src/lib/ipc.ts
  - app/src/lib/autoSave.ts
  - app/src/types/physicPaint.ts
  - app/src/components/timeline/AddFxMenu.tsx
  - app/src/components/layout/Toolbar.tsx
  - app/src/components/physic-paint/bridge/physicsPaintLaunchContext.ts
  - app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts
  - app/src/components/physic-paint/roto/rotoLaunchHydration.ts
  - app/src/components/physic-paint/hooks/usePhysicsPaintSessionController.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/roto/useRotoPhysicalEditCoordinator.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts
  - app/src-tauri/src/lib.rs
  - app/src-tauri/src/commands/project.rs
  - app/src-tauri/src/commands/physic_paint_cache.rs
  - app/src-tauri/src/services/physic_paint_cache.rs
  - app/src-tauri/src/services/project_io.rs
  - app/src-tauri/capabilities/default.json
  - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
findings:
  critical: 0
  warning: 8
  info: 3
  total: 11
status: issues_found
---

# Phase 45: Code Review Report

**Reviewed:** 2026-08-23T00:00:00Z
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Summary

Reviewed the v1.0 EFX Paint document cutover end-to-end at standard depth: the
fail-closed document parsers, the clean-break rejection gate, the two-resource
cache transaction protocol (TS staging + native publish/settle/recover), the
save/load funnels in `projectStore`, and the launch-context document carrier
across the Rust/TS boundary (parent construction, `isPhysicPaintLaunchContext`,
`parseCanonicalPhysicsPaintLaunchValue`, child hydration, engine adoption).

The core transaction protocol is sound: publish/swap/settle/recover correctly
preserves the previous generation on rollback, the digest binding between the
`.mce` bytes and the cache transaction is ordered correctly (bind before rename,
verified in `project_io.rs`), the launch-carrier document is validated
fail-closed at construction and re-validated at hydration, and the `fs:scope`
capability covers every path the persistence layer touches (canonical sidecars,
staging generations, and recursive removal).

The findings below are robustness and data-integrity defects, not outright
crashes or exploitable injection. No BLOCKER-level issue was provable in the
reviewed scope; the most serious ones (WR-02, WR-03, WR-04) concern failure
paths that convert a recoverable error into a permanently stuck or silently
diverged state.

## Critical Issues

No critical issues found.

## Warnings

### WR-01: Save-path sidecar guard is applied to load only, contradicting the module's ASVS V12 contract

**File:** `app/src/lib/efxPaintPersistence.ts:229` (and docblock lines 16-18)
**Issue:** The module docblock promises "guarding every path with `isSafeEfxPaintCachePath` (T-45-11, ASVS V12)". The loader enforces it (`loadEfxPaintDocuments`, line 331), but the save path does not: `prepareEfxPaintSave` builds the staging path with `write.path.slice(EFX_PAINT_CACHE_DIR.length)` with no prefix/safety check on `ref.cachePath` before writing sidecars under `cache/.efx-paint-staging-<uuid>/`. Today the inputs are internally generated canonical paths (unreachable), but the documented ASVS V12 defense is enforced on one side only — any future document source feeding `saveEfxPaintDocumentsWithProjectWrite` (e.g. a document-import path) becomes a real path-traversal write with zero guard. The asymmetry contradicts the stated security contract.
**Fix:** guard each `ref.cachePath` with `isSafeEfxPaintCachePath` in `prepareEfxPaintSave` (and fail closed) before computing the staging path, mirroring the loader:

```ts
if (!isSafeEfxPaintCachePath(ref.cachePath)) {
  throw new Error(`EFX Paint frame ${layerId}:${appFrame} has an unsafe sidecar path.`);
}
```

### WR-02: Commit-settlement errors are swallowed while rollback errors are thrown

- **File:** `src/lib/efxPaintPersistence.ts:263`
- **Issue:** `if (!result.ok && action === 'rollback') throw` — a failed `settle(commit)` is silently ignored while the caller receives success and `savedDocumentCache` is updated. The `.mce` was already written referencing the new canonical sidecar paths, but the `.physic-paint-transaction.json` marker stays active. The next save's `publish_cache_generation` calls `recover_cache_transaction`, which retries the commit; if the same error recurs (e.g. sentinel check failure), every subsequent save fails with "A Physics Paint cache transaction is already active" until manual cache cleanup. The data-integrity asymmetry is unjustified: a commit failure is at least as serious as a rollback failure.
- **Fix:**
```ts
if (!result.ok) throw new Error(result.error);
```

### WR-03: saveProjectAs rolls back store pointers after a successful disk write

- **File:** `app/src/stores/projectStore.ts:797-810`
- **Issue:** `bindScriptLibraryAuthority(newFilePath)` (line 797), `addRecentProject` (799-803) and `setLastProjectPath` (804) run inside the `try` AFTER the `.mce` was written and the cache transaction committed (via `saveEfxPaintDocumentsWithProjectWrite`). If any of them throws, the catch block (805-810) reverts `dirPath`/`filePath`/`scriptLibraryAuthority` to the previous values while the file on disk is at the new path. Subsequent saves silently target the OLD path and the new file on disk goes stale — state/disk divergence with no user feedback.
- **Fix:** move the bind/Recents steps after the store-state update (or out of the rollback scope) so the rollback only applies when the disk write itself failed.

### WR-04 — Stale pre-45 transaction markers make projects unopenable before the rejection gate runs

- **File:** `app/src-tauri/src/commands/project.rs:143` and `app/src-tauri/src/services/physic_paint_cache.rs:512-525`
- **Issue:** `project_open` calls `recover_cache_transaction(&canonical)?` BEFORE the open and therefore before the TS clean-break gate. The pre-45-02 cache protocol used the SAME marker file `.physic-paint-transaction.json` with `.physic-paint-staging-*` basenames; the new `validate_staging_basename` rejects that prefix. A project directory that crashed mid-save under the old protocol (a still-active marker) now fails `read_marker` → `validate_marker` → `recover_cache_transaction` returns Err → `project_open` returns Err → the clean-break no-recourse dialog never runs and the project cannot be opened at all. A legitimately v1.0 project sharing a `cache/` dir with a stale legacy marker is also unopenable.
- **Fix:** treat an unparseable/legacy-format marker as "no marker" (log + `cleanup_stale_staging_generations`) instead of propagating the error, so the gate can take over and the designed rejection dialog runs.

### WR-05 — EFX Paint sidecar load failures are silent to the user

- **File:** `app/src/stores/projectStore.ts:834`; callers `app/src/components/layout/Toolbar.tsx:47-51`, `app/src/components/project/WelcomeScreen.tsx:168,181`, `app/src/lib/shortcuts.ts:95`
- **Issue:** `loadEfxPaintDocuments` throws fail-closed on a missing sidecar PNG, empty sidecar, unsafe cache path, or duplicate frame claim across tracks. All openProject callers catch only with `console.error`. The open silently does nothing — the current project stays open (fail-closed is correct) but the user has zero feedback about why the open failed. A project whose `cache/efx-paint` sidecars are missing (copied `.mce` without the cache) becomes unopenable with no explanation.
- **Fix:** wrap the load in `openProject` and route the error into the existing error-surface (dialog / toast) instead of relying on `console.error`.

### WR-06 — Auto-save failures are unhandled promise rejections

- **File:** `app/src/lib/autoSave.ts:15,46`
- **Issue:** `projectStore.saveProject()` is invoked fire-and-forget with no `.catch`. If a save fails persistently (e.g. `serializeEfxPaintDocument` throws for a layer, or a cache settlement failure from WR-02), every auto-save rejects silently, the user gets no warning, and can quit with unsaved EFX Paint work. The 60-second interval retries forever but never surfaces the condition.
- **Fix:** `.catch()` the auto-save calls and surface a non-blocking "auto-save failed" indicator.

### WR-07 — `saveProjectAs` lacks the `isSaving` concurrency guard and can race auto-save

- **File:** `app/src/stores/projectStore.ts:751` (guard present at line 702 for `saveProject`)
- **Issue:** `saveProject` is guarded with `isSaving`, but `saveProjectAs` is not. An auto-save and a Save As in flight concurrently both publish cache generations; the second `publish_cache_generation` fails with "A Physics Paint cache transaction is already active", so the user sees a spurious failure for a valid action. The shared `.mce.tmp` temp file in `project_io.rs` also makes the two writes race.
- **Fix:** apply the same `isSaving` guard to `saveProjectAs` (or serialize through a single save mutex).

### WR-08 — Loader never verifies `document.parentLayerId` matches the persisted map key

- **File:** `app/src/lib/efxPaintPersistence.ts:322-347`; gate `app/src/efx-paint/document/efxPaintCleanBreak.ts:82-100`
- **Issue:** The rejection gate only checks that a map key exists for the layer's `source.layer_id`; the loader registers documents under their INNER `parentLayerId` (`efxPaintStore.registerDocument` keys by `document.parentLayerId`) and hydrates the runtime under that key. If the persisted `parentLayerId` differs from the map key (`efx_paint_documents: { "layer-A": { parentLayerId: "layer-B", ... } }`), the gate passes but `serializeEfxPaintDocument("layer-A")` then throws "No EFX Paint document for layer" on every save (aborting all saves), while the runtime is installed under "layer-B" and renders against the wrong layer. Hand-crafted/inconsistent files reach this state.
- **Fix:** in `loadEfxPaintDocuments`, reject any entry where `document.parentLayerId !== layerId` (fail closed), and surface the error through the WR-05 path.

## Info

### IN-01 — Loaded frames hardcode `frameIndex: 0`

- **File:** `app/src/lib/efxPaintPersistence.ts:339`
- **Issue:** the loader sets `frameIndex: 0` on every hydrated frame, and the filename term in `buildEfxPaintFrameCachePath` embeds `frameIndex`. This is consistent because the runtime normalizes every frame to `frameIndex: 0` (e.g. `physicPaintStore.ts:899`), so the round-trip is stable — but the round-trip correctness relies on both sides agreeing on the normalization; a comment noting that invariant would prevent a regression.

### IN-02 — Legacy staging generations are never cleaned

- **File:** `app/src-tauri/src/services/physic_paint_cache.rs:611-624`
- **Issue:** `cleanup_stale_staging_generations` only removes `.efx-paint-staging-*` dirs. `.physic-paint-staging-*` generations left by interrupted pre-45 saves in the same `cache/` accumulate forever on upgraded projects.

### IN-03 — `saveProject` reports failure when Recents registration fails after a committed save

- **File:** `app/src/stores/projectStore.ts:739-744`
- **Issue:** `addRecentProject`/`setLastProjectPath` run inside `saveProject`'s try AFTER the `.mce` was written and the cache committed, with no catch (unlike `saveProjectAs`). If they reject, the save is reported as failed even though it fully committed, and the user may retry and double-write.

---

_Reviewed: 2026-08-23T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
