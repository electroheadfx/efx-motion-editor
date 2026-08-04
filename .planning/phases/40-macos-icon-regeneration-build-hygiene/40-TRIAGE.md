# Phase 40 Plan 03: Mixed-Import Triage (D-08)

**Compiled:** 2026-08-04
**Baseline:** `baseline-build-warnings.txt` (executor re-capture, `pnpm --dir app build` exit 0, Vite 5.4.21 — 12 mixed-import warnings, 0 chunk-size warnings at the 1100 budget)
**Status:** AWAITING USER APPROVAL — zero source edits made; `git status --porcelain -- app/ packages/` is clean

Classification rules applied (D-08/D-09): FIX requires all three evidence points (module provably eager in the importing module's static graph, no import cycle created, no initialization-timing change). Incomplete evidence means PRESERVE. REPORT-AS-DI when a proper fix requires dependency inversion (documented, never fixed in-phase).

**Baseline observation:** entry chunk measured 969.22 kB in this re-capture (identical content hash `index-DiQjlua3.js` to the research baseline). The 1,074.93 kB noted in the 40-02 SUMMARY was not reproduced by the plain `pnpm --dir app build`; both are under the 1100 budget. No chunk-size warning is emitted.

---

## Triage table

| # | Warning subject (module) | Dynamic import site(s) | Static importers sampled | Classification | Evidence / reason |
|---|--------------------------|------------------------|--------------------------|----------------|-------------------|
| 1 | `@tauri-apps/api/core.js` | `lib/physicPaintBridge.ts:1212,1279`; `components/shader-browser/ShaderBrowser.tsx:400`; `components/sidebar/SidebarFxProperties.tsx:428` | `lib/ipc.ts` + all Tauri plugin internals | **PRESERVE** | Tauri/browser runtime guard. Bridge sites are inside `isTauriRuntime()`-guarded paths (guard at `physicPaintBridge.ts:1287`) with browser `postMessage` fallbacks — the bridge deliberately runs in non-Tauri contexts. ShaderBrowser/SidebarFxProperties sites defer the Tauri invoke to a click handler. Spec-named preserve; converting 4 heterogeneous sites cannot meet the no-init-timing-change bar. |
| 2 | `@tauri-apps/api/event.js` | 19 sites across `bridge/physicsPaintBridgeTransport.ts` (×5), `bridge/physicsPaintSessionFile.ts`, `bridge/usePhysicsPaintParentBridge.ts` (×6), `engine/usePhysicsPaintEngineLifecycle.ts`, `lib/physicPaintBridge.ts` (×9) | `components/canvas/PaintOverlay.tsx`, `main.tsx`, Tauri internals | **PRESERVE** | Tauri/browser runtime guard. Verified pattern at `physicPaintBridge.ts:826-865`: every dynamic import sits inside `if (isTauriRuntime())` blocks with `window.opener?.postMessage` browser fallbacks. Spec-named preserve. |
| 3 | `@tauri-apps/api/window.js` | `components/physic-paint/PhysicsPaintStudio.tsx`; `bridge/usePhysicsPaintParentBridge.ts`; `lib/physicPaintBridge.ts:979` | `lib/exportEngine.ts`, `main.tsx`, Tauri internals | **PRESERVE** | Tauri/browser runtime guard (same bridge pattern; Studio runs in the standalone window context). Spec-named preserve. |
| 4 | `@tauri-apps/plugin-dialog` | `lib/physicPaintBridge.ts:846` | ExportPreview, Toolbar, NewProjectDialog, WelcomeScreen, AudioProperties, ImportedView, shortcuts, unsavedGuard | **PRESERVE** | Tauri/browser runtime guard: paired dynamic import inside the state-save handler (`try/catch` fallback, `physicPaintBridge.ts:844-856`); bridge runs in non-Tauri contexts. Spec-named preserve. |
| 5 | `app/src/lib/appConfig.ts` | `stores/uiStore.ts:180` (`initSidebarLayout`) | LeftPanel, WelcomeScreen, CollapseHandle, `lib/themeManager.ts`, `stores/isolationStore.ts`, `stores/projectStore.ts:22` | **FIX (proposed)** | (a) Eager proven: `themeManager.ts:2` statically imports appConfig; `shortcuts.ts:9` statically imports themeManager; `main.tsx:8` statically imports shortcuts — appConfig already evaluates at startup (also via `projectStore.ts:22`). (b) No cycle: appConfig imports only `@tauri-apps/plugin-store` + `./ipc`; `ipc.ts` imports `@tauri-apps/api/core` + type-only imports — no path back to uiStore. (c) No init-timing change: module body (`new LazyStore('app-config.json')`, appConfig.ts:5) already runs eagerly at startup via the themeManager chain; uiStore is itself statically imported by `main.tsx:11`. |
| 6 | `app/src/stores/timelineStore.ts` | `stores/paintStore.ts:478-479, 545-546` | ~30 modules incl. `main.tsx`, `projectStore.ts:13` | **PRESERVE** | Store-to-store dynamic import inside user-action handlers (`togglePaintMode`, `setBrushColor`) — presumed cycle-breaker (D-09, Pitfall 3). Converting to static would add paintStore→timelineStore→projectStore→paintStore to the static cycle cluster (`timelineStore.ts:2` imports projectStore; `projectStore.ts:24` imports paintStore). Plan must-have: store-to-store dynamics remain dynamic unless the user explicitly approves a proven-safe conversion. |
| 7 | `app/src/stores/layerStore.ts` | `stores/paintStore.ts:478-479, 545-546` | ~25 modules incl. `projectStore.ts:14` | **PRESERVE** | Same store-to-store rule as #6 (paired `Promise.all` dynamic imports at the same two sites). `projectStore.ts:14` statically imports layerStore and `projectStore.ts:24` statically imports paintStore while `paintStore.ts:7` statically imports projectStore — the store cluster already has tight evaluation-order coupling; D-09 conservative default applies. |
| 8 | `@tauri-apps/plugin-fs` | `lib/physicPaintBridge.ts:847` | AudioProperties, ImportedView, assetRemoval, paintPersistence, physicPaintPersistence, `stores/projectStore.ts` | **PRESERVE** | Tauri/browser runtime guard: paired with plugin-dialog in the state-save handler (`Promise.all` at `physicPaintBridge.ts:845-848`), try/catch fallback; bridge runs in non-Tauri contexts. Spec-named preserve. |
| 9 | `app/src/lib/unsavedGuard.ts` | `main.tsx:84` (`onCloseRequested` handler) | `components/layout/Toolbar.tsx`, `lib/shortcuts.ts:8` | **FIX (proposed)** | (a) Eager proven: `shortcuts.ts:8` statically imports unsavedGuard; `main.tsx:8` statically imports shortcuts — unsavedGuard is already in main's eager graph. (b) No cycle: unsavedGuard imports `@tauri-apps/plugin-dialog` + `projectStore` only; nothing imports `main.tsx` (entry module), so no path back can exist. (c) No init-timing change: module body is side-effect-free (type + async function exports only, verified `unsavedGuard.ts:1-40`) and is already eagerly evaluated via the shortcuts chain today; the `onCloseRequested` handler semantics are unchanged. |
| 10 | `app/src/lib/themeManager.ts` | `main.tsx:25` (inside `initTempProjectDir().then(...)`) | `components/layout/ThemeSwitcher.tsx`, `components/timeline/TimelineCanvas.tsx`, `lib/shortcuts.ts:9` | **FIX (proposed)** | (a) Eager proven: `shortcuts.ts:9` statically imports themeManager; `main.tsx:8` statically imports shortcuts — themeManager's module body already evaluates at startup, before the dynamic import could ever run. (b) No cycle: themeManager imports `@preact/signals` + `./appConfig`; appConfig → ipc → api/core + types — no path back to main.tsx. (c) No init-timing change: module body only creates the `currentTheme` signal (verified `themeManager.ts:1-9`); the dynamic import defers nothing at module level because the module is already eager; the `await initTheme()` call remains sequenced after `initTempProjectDir()` — only the import form changes, call order is identical. This addresses the researcher's init-timing caution directly. |
| 11 | `app/src/lib/physicPaintBridge.ts` | `stores/projectStore.ts:61` (`publishScriptLibraryContext`) | bridge transport/session/parent-bridge files, PhysicPaintProperties, `main.tsx:14` | **REPORT-AS-DI** | Direct static cycle on conversion: `physicPaintBridge.ts:23` STATICALLY imports projectStore (used at lines 251, 612, 615, 618 for projectContextId/filePath/authority reads). Making projectStore→physicPaintBridge static creates projectStore ↔ physicPaintBridge. A proper fix requires dependency inversion — e.g. extracting `publishPhysicPaintProjectContext` behind an injected port or into a cycle-free module. Documented for the backlog per D-10; NOT fixed in this phase. |
| 12 | `app/src/lib/paintPreferences.ts` | `stores/paintStore.ts:106, 535, 541` | `components/physic-paint/view/PhysicsPaintRightPanel.tsx`, `components/sidebar/InlineColorPicker.tsx` | **FIX (proposed)** | (a) Eager proven: InlineColorPicker.tsx statically imports paintPreferences and is itself statically imported by `components/sidebar/PaintProperties.tsx` and `components/layout/CanvasArea.tsx` — entry-chunk layout/sidebar components — so paintPreferences already evaluates at startup (PhysicsPaintRightPanel additionally rides the Studio lazy chunk). (b) No cycle: paintPreferences imports only `@tauri-apps/plugin-store` — no path back to paintStore can exist. (c) No init-timing change: module body (`new LazyStore('app-config.json')`) already evaluates eagerly via the InlineColorPicker chain; paintStore is statically imported by `main.tsx:13` and `projectStore.ts:24`. |

---

## Proposed corrections awaiting approval (D-08 gate)

| Row | Edit | Site(s) |
|-----|------|---------|
| #5 | Convert `await import('../lib/appConfig')` to top-level static import in `stores/uiStore.ts` | uiStore.ts:180 (1 site) |
| #9 | Convert `await import('./lib/unsavedGuard')` to top-level static import in `main.tsx` | main.tsx:84 (1 site) |
| #10 | Convert `await import('./lib/themeManager')` to top-level static import in `main.tsx` | main.tsx:25 (1 site) |
| #12 | Convert `import('../lib/paintPreferences')` to top-level static import in `stores/paintStore.ts` | paintStore.ts:106, 535, 541 (3 sites) |

## Preserved with reason (no edit regardless of approval)

- #1, #2, #3, #4, #8 — Tauri/browser runtime guards (spec-named preserves; `isTauriRuntime()` + postMessage fallback pattern)
- #6, #7 — store-to-store dynamic imports, presumed cycle-breakers (D-09, Pitfall 3)

## Reported as dependency-inversion scope (D-10 — never fixed in-phase)

- #11 — `stores/projectStore.ts` ↔ `lib/physicPaintBridge.ts`: bridge statically imports projectStore (line 23); conversion would create a direct static cycle. Proper fix: invert the store→bridge dependency (injected port or cycle-free context-publishing module). Routed to phase SUMMARY + project backlog.

## Approval record

- [ ] PENDING — user decision: approve-all / approve-subset (name rows) / preserve-all

---

*Phase: 40-macos-icon-regeneration-build-hygiene — Plan 40-03 Task 1 output*
