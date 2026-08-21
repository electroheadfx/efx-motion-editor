---
phase: 40-macos-icon-regeneration-build-hygiene
reviewed: 2026-08-04T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - app/src-tauri/icons/128x128.png
  - app/src-tauri/icons/128x128@2x.png
  - app/src-tauri/icons/32x32.png
  - app/src-tauri/icons/icon.icns
  - app/src-tauri/icons/icon.ico
  - app/src/main.tsx
  - app/src/stores/paintStore.ts
  - app/src/stores/uiStore.ts
  - app/src/viteBuild.test.ts
  - app/vite.config.ts
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 40: Code Review Report

**Reviewed:** 2026-08-04
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed the four dynamic-to-static import conversions (main.tsx, uiStore.ts, paintStore.ts), the `chunkSizeWarningLimit: 1100` config pin, the extended production-build test seam in viteBuild.test.ts, and the five regenerated binary icon assets (presence/contract only).

The import conversions are correct and low-risk. Cross-checking against `baseline-build-warnings.txt` confirms every converted module was already statically present in the entry chunk via other importers (`shortcuts.ts` statically imports `unsavedGuard` and `themeManager`; `projectStore` statically imports `appConfig`; `InlineColorPicker` statically imports `paintPreferences`). The dynamic imports were pure mixed-import noise, so the conversions change neither chunk contents nor effective evaluation order. Call-order in main.tsx is preserved (`await initTheme()` and the `guardUnsavedChanges()` close handler run at the same points). No circular imports were introduced (`paintPreferences.ts` imports only `@tauri-apps/plugin-store`; `appConfig.ts` -> `ipc.ts` has no back-edge to `uiStore`). A grep for remaining dynamic imports of the four modules returns empty.

The test seam is well built. The D-13 subject-position assertion has real teeth: Rollup emits mixed-import warnings with absolute subject paths (`<abs path> is dynamically imported by ...`), so the `includes()` check matches exactly the subject position and correctly avoids false-fails where a corrected path appears as a static importer (e.g. `unsavedGuard.ts` inside the preserved plugin-dialog warning). The D-14 resolved-limit assertion reads `config.build.chunkSizeWarningLimit` from `configResolved`, so a config typo or a plugin override cannot false-pass. I verified in the installed Vite 5.4.21 reporter source that the chunk-size warning is emitted via `config.logger.warn`, so the customLogger wrap captures it.

No blockers. One warning (unhandled promise rejections on edited lines, risk parity with the prior form) and three info items.

## Warnings

### WR-01: Fire-and-forget persistence promises in setBrushSize / setBrushColor drop rejections silently

**File:** `app/src/stores/paintStore.ts:535` and `app/src/stores/paintStore.ts:541`
**Issue:** `saveBrushSize(brushSize.value)` and `saveBrushColor(color)` are async functions whose returned promises are neither awaited nor `.catch()`-ed. If the Tauri LazyStore write fails (disk error, store corruption, plugin teardown), the rejection is unhandled and the brush preference is silently never persisted — the user sees the new value in-session and loses it on restart with no diagnostics. Note this is risk parity with the pre-conversion form (`import(...).then(m => m.saveBrushSize(...))` was equally unhandled), so the conversion did not regress anything; the edited lines simply carry the pattern forward. Per the review rubric, unhandled promise rejections on edited lines are Warning-tier.
**Fix:**
```ts
setBrushSize(size: number): void {
  brushSize.value = Math.max(BRUSH_SIZE_MIN, Math.min(BRUSH_SIZE_MAX, size));
  saveBrushSize(brushSize.value).catch((err) =>
    console.error('Failed to persist brush size:', err),
  );
},
```
Same for `saveBrushColor`. Alternatively `void saveBrushSize(...)` if the silent-drop semantics are intentional, making the discard explicit.

## Info

### IN-01: Static conversion expands module evaluation to the `/physics-paint` route (verified safe)

**File:** `app/src/main.tsx:7-8`
**Issue:** `themeManager` and `unsavedGuard` are now evaluated at module top level for both routes, whereas before they were only loaded inside the editor-route branch after `initTempProjectDir()` resolved. I traced the module-scope side effects of both graphs and they are safe: `themeManager` only creates a signal; `appConfig`/`paintPreferences` construct `new LazyStore(...)` which defers all I/O until first `get`/`set`; `unsavedGuard` pulls in `projectStore`, which main.tsx already imports transitively via `paintStore` on line 15. No behavioral change on either route. Recorded so the evaluation-scope expansion is a documented, verified consequence rather than an accident.
**Fix:** None required.

### IN-02: Chunk-size warning assertion passes vacuously if minify is ever disabled in the test environment

**File:** `app/src/viteBuild.test.ts:174-186`
**Issue:** Vite 5.4.21 only emits the chunk-size warning when `hasLargeChunks && config.build.minify && !config.build.lib && !config.build.ssr` (verified in the installed reporter source). If `TAURI_ENV_DEBUG` is ever set in the environment running `vitest run`, `minify` resolves to `false`, the warning is suppressed by construction, and the "emits no chunk-size warning" test passes vacuously regardless of bundle size. The D-14 resolved-limit pin (`captured.chunkLimit`) already guards the limit value, but nothing pins that warning *emission* is active during the test build.
**Fix:** Extend `createInputCapturePlugin` to also capture `config.build.minify` and assert it is truthy in the chunk-size test, e.g. `expect(captured.minify, 'minify must be on for the chunk-size warning path to be live').toBeTruthy()`.

### IN-03: Pre-existing bare `require()` calls in paintStore rely on build-time CJS interop (outside phase diff)

**File:** `app/src/stores/paintStore.ts:834-835`
**Issue:** The paint-mode-exit `effect` uses `require('./layerStore')` / `require('./timelineStore')` with the comment "Lazy imports to avoid circular dependencies". This is untouched by phase 40 but observed in a reviewed file. It works in production builds only because Vite's build pipeline enables `transformMixedEsModules`, which rewrites literal `require()` calls into static imports. In dev (native ESM, no CJS transform for source), `require` is undefined and the effect would throw `ReferenceError` when exiting paint mode. The sibling code in the same file (`togglePaintMode` line 477, `setBrushColor` line 544) already uses the correct ESM pattern — `Promise.all([import('./layerStore'), import('./timelineStore')])` — making these two lines an inconsistent, fragile outlier.
**Fix:** Convert to the established dynamic-import pattern used at line 477:
```ts
Promise.all([import('./layerStore'), import('./timelineStore')]).then(
  ([{layerStore}, {timelineStore}]) => { /* ... */ },
);
```
Flag for a future hygiene pass; do not expand phase 40 scope for it.

## Notes on Out-of-Scope Assets

The five icon binaries (`app/src-tauri/icons/*.png`, `icon.icns`, `icon.ico`) were reviewed for presence and contract only. All five exist and were regenerated (size deltas in the diff). Content verification is covered by the phase's `check-unsigned-app-icon.sh` script and UAT, not by source review.

---

_Reviewed: 2026-08-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
