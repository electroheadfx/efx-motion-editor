---
phase: quick-261023-ors
plan: 261023-ors
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/performance/studioScriptMemoryGauge.ts
  - app/src/components/physic-paint/performance/studioScriptMemoryGauge.test.ts
  - app/src/components/physic-paint/performance/scriptMemoryProbe.ts
  - app/src/components/physic-paint/view/RightPanelMemoryTab.tsx
  - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
  - app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts
  - app/src/components/physic-paint/view/physicsPaintRightPanelModuleGate.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.purge.test.ts
  - app/src/components/physic-paint/view/brushScriptRecordState.ts
  - app/src/components/physic-paint/view/brushScriptRecordState.test.ts
  - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts
  - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts
  - app/src/components/physic-paint/snapshot/studioScriptSnapshotTrackDelete.ts
  - app/src/components/physic-paint/snapshot/studioScriptSnapshotTrackDelete.test.ts
  - app/src/lib/ipc.ts
  - app/src-tauri/src/services/studio_script_snapshot.rs
  - app/src-tauri/src/commands/studio_script_snapshot.rs
  - app/src-tauri/src/lib.rs
  - app/src/stores/efxPaintStore.ts
  - app/src/stores/trackDeleteLaws.test.ts
autonomous: true
requirements: []
estimate:
  tokens: 70000
  raw_tokens: 70000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "A new LAST top-pane tab labelled Memory appears in the right sidebar's top pane in BOTH modes — after Color/Brush/Settings/Paper in watercolor and after Color/Paper in Brush mode — reusing the existing tab button styling and the mode-derived list; no other tab moves or changes."
    - "The Memory tab shows Scripts (watercolor timeline + brush session store, per frame and total) and frame caches/LRU as SEPARATE lines; Motion/Static Rails are derived Loop Clips and never appear because the gauge reads only the watercolor and brush stores."
    - "Purging one key removes only that frame's watercolor events and brush groups; every other frame and every other rail is untouched; the pixels stay and the key loses Move/Select/editability, which the confirmation states explicitly."
    - "Clear-all empties the scripts of the ACTIVE rail only (the Studio stores are track-scoped); pixels stay; Dry events are sheet actions and are kept."
    - "After a purge the persisted snapshot is rewritten immediately through the existing script-library authority seam (package copy when bound, cache when unsaved) and the stale fallback leg is deleted, so a close/reopen cannot restore the purged script; a persistence failure reports once on the existing capsule and never blocks painting or crashes."
    - "Deleting a rail through the acknowledged commitDeleteTrack path also deletes that track's package sidecar `<package>/scripts/<layerId>/<trackId>-v1.snap` and its app-cache fallback, leaving other rails' snapshots and every Scripts-library preset untouched; if the deleted rail is the bound one the Studio clears its binding before the tracks switch."
    - "Neither confirmation can purge silently: Cancel leaves both stores and every persisted file exactly as they were."
  artifacts:
    - "readStudioScriptMemorySnapshot / formatScriptMemoryBytes / buildStudioScriptMemoryFrameRows in app/src/components/physic-paint/performance/studioScriptMemoryGauge.ts"
    - "RightPanelMemoryTab with inline frame/rail confirmations in app/src/components/physic-paint/view/RightPanelMemoryTab.tsx"
    - "Memory tab branch + label in app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx"
    - "purgeAquarelleFrameScript / purgeAllAquarelleKeyScripts in aquarelleRecordState.ts"
    - "purge markers + purgeBrushScriptFrame / purgeAllBrushScriptFrames in brushScriptRecordState.ts"
    - "persistAfterPurge + remove port in studioScriptSnapshotController.ts"
    - "ipcStudioScriptSnapshotDelete + the Rust delete service/command"
    - "createStudioScriptSnapshotTrackDelete + `_setEfxPaintTrackScriptDeleteCallback` invoked by commitDeleteTrack"
  key_links:
    - "Memory tab mount -> debounced read of aquarelleStrokesRevision + brushScriptRevision -> readStudioScriptMemorySnapshot -> buildScriptMemorySnapshot"
    - "purge handler -> store purge (sync, one revision bump) -> edition ports list no strokes -> Move/Select disabled"
    - "purge handler -> controller.persistAfterPurge -> flushNow writes the pruned payload -> remove(cache) only when an authority is bound"
    - "commitDeleteTrack -> _setEfxPaintTrackScriptDeleteCallback(layerId, trackId) -> bind(null) when it is the bound key -> remove(identity, authority, both)"
    - "authority token -> optional_authority_root -> canonical package root -> `<package>/scripts/<layerId>/<trackId>-v1.snap` delete"
---

<objective>
Add the read-only Studio script-memory gauge as a new LAST "Memory" tab in the right sidebar top pane, plus explicit per-key and active-rail purge (both confirmed, both keeping pixels) and the rail-deletion snapshot cascade.

Purpose: the f9c estimator and the l35/o3n snapshot store made script cost measurable and durable, but the artist has no in-Studio view of that cost and no way to reclaim it. This quick surfaces the numbers where the work happens, makes reclaiming explicit (never silent), and closes the persistence loop: a purged script can never come back from the package sidecar or the app cache, and deleting a rail can never leave an orphaned snapshot behind.
Output: a Memory gauge tab, per-key and rail purge actions with confirmations and immediate snapshot cleanup, a delete command on both snapshot legs, and a commitDeleteTrack cascade; tests plus UAT rows for every scope law.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@SPECS/quick-prompts/studio-script-memory-gauge-purge.md
@.planning/quick/261023-f9c-v2-0-0-read-specs-quick-prompts-studio-s/261023-f9c-SUMMARY.md
@.planning/quick/261023-l35-v2-0-0-read-specs-quick-prompts-studio-s/261023-l35-SUMMARY.md
@.planning/quick/261023-o3n-v2-0-0-read-specs-quick-prompts-studio-s/261023-o3n-SUMMARY.md
@app/src/components/physic-paint/performance/scriptMemorySnapshot.ts
@app/src/components/physic-paint/performance/scriptMemoryProbe.ts
@app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
@app/src/components/physic-paint/view/aquarelleRecordState.ts
@app/src/components/physic-paint/view/brushScriptRecordState.ts
@app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts
@app/src/components/physic-paint/PhysicsPaintStudio.tsx
@app/src/lib/ipc.ts
@app/src-tauri/src/services/studio_script_snapshot.rs
@app/src-tauri/src/commands/studio_script_snapshot.rs
@app/src/stores/efxPaintStore.ts

**Scope laws (from the brief — non-negotiable):**
- Placement: a NEW LAST tab in the right sidebar's top pane, labelled "Memory", after Color/Brush/Settings/Paper in watercolor mode and after Color/Paper in Brush mode. Reuse the existing tab/panel styling and the mode-derived list. No modal sprawl, no Tools-popover entry, no Settings-tab entry.
- Gauge content: Scripts (watercolor timeline + brush store, `{strokes, points, approxBytes}` per frame and total) and frame caches/LRU as a SEPARATE line. Motion/Static Rails are derived Loop Clips with no key scripts and are never listed. Reuse the f9c estimator (`approxBytes` = UTF-8 length of JSON.stringify) — do not invent a second accounting.
- Purge actions (both confirmed in the tab, both keeping pixels, both stating that editability is lost): per-key purge (that frame's watercolor events + brush groups); clear-all for the ACTIVE rail (the stores are per active track, so this is every key of the rail being edited).
- Persistence is cleaned by the purge itself — NO separate cleanup button. After a purge the controller rewrites the persisted snapshot through the existing `scriptLibraryAuthority` seam and deletes the stale fallback leg, so a purged script never returns after close/reopen. A persistence failure reports once on the existing capsule and never blocks or crashes.
- Rail deletion: extend the acknowledged `commitDeleteTrack` path so deleting a rail also deletes `<package>/scripts/<layerId>/<trackId>-v1.snap` and the cache fallback. Other rails' snapshots stay untouched; reusable Scripts-library presets (`*.efx-roto-script.json`) are never touched.
- Never purge silently; never touch other frames, other rails or the LRU policy; no new dependency; no `.mce` manifest or document-schema change; tests are `.test.ts` only (Rust tests inline); `vitest run` only; the user runs the app.

**Preconditions verified while planning:**
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` owns the mode-derived top-pane list: `['color', 'brush', 'settings', 'paper']` / `['color', 'paper']`, the `TOP_PANE_TAB_LABELS` map, the `useState<'color' | 'brush' | 'settings' | 'paper'>` union, and the branch chain brush -> settings -> paper -> color fallback. The Memory branch goes between the paper arm and the color fallback.
- The panel is mounted under a `preact/compat` memo (`MemoizedPhysicsPaintRightPanel.ts`); a tab body that reads a signal's `.value` in its own render body still re-renders (the 38-11 signal-bypasses-memo pattern). The Studio's right-panel memo deps must stay free of `currentFrame`/`startFrame`.
- `buildScriptMemorySnapshot` (f9c) is pure and returns watercolor frames + totals, brush frames + totals, the current engine frame, and the frame-cache section. `scriptMemoryProbe.snapshotScriptMemory()` assembles that input from the stores and flushes the CURRENT brush frame from the engine first (a sanctioned, idempotent projection point). `installScriptMemoryProbe` is DEV-guarded AND only called in DEV, so the production gauge needs its own read entry point, not the probe global.
- `flushBrushScriptFrame(frame, strokes, settings)` recaptures from the engine when the frame is dirty or has no entry — a naive purge would be undone at the next frame leave. A purge-marker set consulted by `flushBrushScriptFrame` is required.
- `deleteAquarelleStrokeFromScript` documents that the engine keeps its ledger; `recordAquarelleStroke` is only called for NEW strokes (live stroke end, duplicate/apply). Purging the record state therefore cannot be undone by the engine.
- `brushScriptEditionPort.listBrushScriptStrokes` lists strokes from the store (`getBrushScriptForFrame`) gated by `engineHoldsBrushScriptFrame`, so an empty store entry disables Move/Select for that key. The watercolor overlay walks the record registry, so a purged registry disables it too.
- `commitDeleteTrack(layerId, trackId, acknowledged)` is the only committed rail-delete surface (the strip dialog and the Studio handler both route through it). The strip renders only inside `PhysicsPaintStudioView` (Studio webview), so the Studio's own `efxPaintStore` copy commits the deletion and the Studio's authority ref is available to the cascade.
- The Studio's `launchContextRef.current` is refreshed in the render body, and `engineRef` is live — both are safe stable reads from a ports object created once. The Studio render body may contain exactly ONE `brushScriptRevision.value` read (the l35 save effect): the gauge subscription must live in `RightPanelMemoryTab.tsx`, never in the Studio body.
- `PhysicsPaintStudio.test.ts` pins: the right-panel memo block must not contain `applyStatus`/`applyMessage`/`lastError`; the l35 save effect slice ends at `}, [studioScriptSnapshot]);`; `getAuthority: () => studioScriptSnapshotAuthorityRef.current,` stays verbatim. `PhysicsPaintRightSidebar.test.ts` pins 8 `role="tab"` (becomes 9) and the union string. `physicsPaintRightPanelModuleGate.test.ts` pins both mode arrays and the `useState` union.
- `app/src-tauri/src/services/studio_script_snapshot.rs` already has `validate_snapshot_key_component`, `resolve_snapshot_path`, `resolve_package_snapshot_path`, the shared atomic writer/guarded reader, and the package-first/never-dual-write wrappers. `commands/studio_script_snapshot.rs` has `header()`, `snapshot_root_for()`, `optional_authority_root()` and the two commands registered in `lib.rs`.

**Command conventions:** every path in this plan's body is repo-root-relative. App vitest runs through the workspace filter, so `src/...` is app-relative: `pnpm --filter efx-motion-editor exec vitest run src/components/...`. Rust: `cargo test --manifest-path app/src-tauri/Cargo.toml <filter>`. Tests are `.test.ts` only (a `.test.tsx` target runs zero tests). Vitest `run`, never watch. The user runs the app; do not start a dev server.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: The Memory tab shows the live gauge end to end</name>
  <files>
    app/src/components/physic-paint/performance/studioScriptMemoryGauge.ts,
    app/src/components/physic-paint/performance/studioScriptMemoryGauge.test.ts,
    app/src/components/physic-paint/performance/scriptMemoryProbe.ts,
    app/src/components/physic-paint/view/RightPanelMemoryTab.tsx,
    app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx,
    app/src/components/physic-paint/physicsPaintStudio.css,
    app/src/components/physic-paint/PhysicsPaintStudio.tsx,
    app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts,
    app/src/components/physic-paint/view/physicsPaintRightPanelModuleGate.test.ts,
    app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts
  </files>
  <behavior>
    - `formatScriptMemoryBytes`: 0 -> "0 B", 934 -> "934 B", 1024 -> "1.0 KB", 194_980 -> "190 KB", 79_315_200 -> "75.6 MB" (binary units, one decimal from KB up). Negative/NaN inputs render "0 B" and never throw.
    - `buildStudioScriptMemoryFrameRows(snapshot)` returns one row per app frame present in EITHER the watercolor frames or the brush frames, ascending by frame, with the watercolor stroke/point/byte figures and the brush stroke/point/byte figures side by side; a frame present in only one store shows zeros for the other. It never emits rows for rails — there is no rail input.
    - `readStudioScriptMemorySnapshot({ engine, frame })` returns the exact `buildScriptMemorySnapshot` output assembled from the watercolor registry + projected entries + Dry events, the brush store report, and the four named frame caches (frameLru, generatedRenderSource, rotoCache.realKey, rotoCache.generated); `frameCache.totalBytes` never lands in `watercolor.totals` or `brush.totals`.
    - `readStudioScriptMemorySnapshot({ engine: null, frame })` returns a snapshot with `brush.currentEngineFrame.available === false` and does not throw.
    - `snapshotScriptMemory()` (the DEV probe) returns the same value as `readStudioScriptMemorySnapshot({ engine: registeredEngine, frame: registeredFrame })` for the same stores — one assembler, two entry points.
    - Panel: both mode lists end with `'memory'`; the label map gains `memory: 'Memory'`; the tab renders LAST in each mode; the Memory body renders only for the memory tab and never for brush/settings/paper.
    - Tab body: with a snapshot it renders the Scripts total line, a Watercolor line, a Brush line, one row per frame, and a separate Frame caches line with the cache total plus one row per named cache; when the ports are absent or the read returns null it renders the unavailable copy and no figures.
    - The tab recomputes on mount and after 250 ms of quiet following either script revision; a 2 s interval refreshes the cache line (those stats are plain getters, not signals); cleanup clears the timer and the interval.
  </behavior>
  <action>
    Create `studioScriptMemoryGauge.ts` as the production read entry point: move the assembly body of `scriptMemoryProbe.snapshotScriptMemory()` into `readStudioScriptMemorySnapshot({ engine, frame })` — flush the current brush frame from the engine exactly as the probe does (idempotent; `flushBrushScriptFrame` is a no-op on a clean captured frame), read `getRecordedAquarelleStrokeEntries()`, project `captureAquarelleStrokeRegistry().pairs` into the entries map, read `getRecordedAquarelleDryEvents()`, `getBrushScriptReport()`, `getGeneratedRenderSourceCacheStats()`, `getRotoCacheByteStats()` and the `frameLru` byte/entry totals, then call `buildScriptMemorySnapshot` with the SAME four named caches and notes the probe used. Add `formatScriptMemoryBytes` and `buildStudioScriptMemoryFrameRows`. Make `scriptMemoryProbe.snapshotScriptMemory()` delegate to the new function (its DEV registration and global stay unchanged) so the estimator has exactly one assembler.

    Create `RightPanelMemoryTab.tsx` (new leaf, sibling of `RightPanelPaperTab.tsx`): props `{ ports: StudioScriptMemorySectionPorts; frame: Signal<number> }` where the ports are `{ read: () => ScriptMemorySnapshot | null; purgeFrame: (frame: number) => boolean; clearRail: () => boolean }`. Hold the snapshot in a sign created inside a `useRef` (never `useState`, never a fresh `useSignal` per render), initialize it to null, and read `.value` plus `frame.value` in the render body (the 38-11 bypass pattern). A mount effect computes the first read, then creates one `effect()` subscription on `aquarelleStrokesRevision.value` and `brushScriptRevision.value` with a first-run skip and a 250 ms debounce, plus a 2 s interval for the cache stats; cleanup disposes the effect, clears the timer and the interval. Render the Scripts total, the Watercolor and Brush lines, the per-frame rows (current frame marked), and a visually separate Frame-caches line with the total and per-cache rows; include the brief's warning that purging keeps pixels but loses script editability; render an unavailable line when `read()` is null. Use existing panel classes plus `physics-paint-memory-*` classes only; no new tab styling.

    Add `memory` to `PhysicsPaintRightPanel.tsx`: extend `TOP_PANE_TAB_LABELS`, both mode arrays (`['color', 'brush', 'settings', 'paper', 'memory']`, `['color', 'paper', 'memory']`), the `useState` union and the `effectiveTopPaneTab` type, append a new branch AFTER the paper arm and BEFORE the color fallback rendering `<RightPanelMemoryTab ports={...} frame={...} />` inside a `physics-paint-options-tab-panel physics-paint-options-tab-panel-flat` panel with `aria-label="Memory"`, and add an optional `memorySection?: { ports: StudioScriptMemorySectionPorts; frame: Signal<number> }` prop. The stale-tab fallback keeps only brush/settings watercolor-gated; memory is available in both modes. Add the small additive CSS block to `physicsPaintStudio.css` (memory rows, the confirmation row, the current-frame marker), reusing existing spacing tokens.

    In `PhysicsPaintStudio.tsx`, create `const memoryFrame = useSignal(0)` and one effect syncing `memoryFrame.value = currentFrame` on `[currentFrame, memoryFrame]` (a signal write inside an effect, never in the render body). Create a render-body ref `memorySectionPortsRef` (the `audioSectionPortsRef` / `backgroundClipSectionPortsRef` precedent) whose `read` calls `readStudioScriptMemorySnapshot({ engine: engineRef.current, frame: launchContextRef.current?.startFrame ?? 0 })` and whose purge functions are hoisted function declarations in the component body (Task 2 fills them in; for this task they may return false). Create a second stable ref holding `{ ports, frame: memoryFrame }`, pass it as `memorySection` in the right-panel props factory, and add that stable ref to the memo deps. Keep the l35 save effect and its marker untouched, and keep the right-panel memo block free of `applyStatus` / `applyMessage` / `lastError` (the Studio pins scan that block).

    Update the pins: `physicsPaintRightPanelModuleGate.test.ts` (both mode arrays end with `'memory'`, the union includes `'memory'`, the `memory: 'Memory'` label), `PhysicsPaintRightSidebar.test.ts` (union string and `role="tab"` count 8 -> 9), and add panel-harness cases in `PhysicsPaintRightPanel.test.ts` asserting the Memory tab is last in both modes, that the memory body mounts only for that tab with the sample sections, and that an absent `memorySection` renders an empty body without throwing. Add `studioScriptMemoryGauge.test.ts` covering the formatter, the merged frame rows, the cache/script separation, the null-engine read, and the probe/gauge equivalence.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/performance/studioScriptMemoryGauge.test.ts src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts src/components/physic-paint/view/physicsPaintRightPanelModuleGate.test.ts src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts</automated>
  </verify>
  <done>
    Both modes show Memory as the last top-pane tab; opening it shows Scripts (watercolor + brush, per frame and total) and Frame caches as separate sections, updates after script revisions, and never lists rails. No other tab or pane changes, the Studio pins still pass, and the production path does not depend on the DEV probe global.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Confirmed per-key and active-rail purge, with the snapshot cleaned by the purge itself</name>
  <files>
    app/src/components/physic-paint/view/aquarelleRecordState.ts,
    app/src/components/physic-paint/view/aquarelleRecordState.purge.test.ts,
    app/src/components/physic-paint/view/brushScriptRecordState.ts,
    app/src/components/physic-paint/view/brushScriptRecordState.test.ts,
    app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts,
    app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts,
    app/src/lib/ipc.ts,
    app/src-tauri/src/services/studio_script_snapshot.rs,
    app/src-tauri/src/commands/studio_script_snapshot.rs,
    app/src-tauri/src/lib.rs,
    app/src/components/physic-paint/PhysicsPaintStudio.tsx,
    app/src/components/physic-paint/view/RightPanelMemoryTab.tsx,
    app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts
  </files>
  <behavior>
    - `purgeAquarelleFrameScript(frame)` removes every non-Dry timeline event whose `playFrame` equals `frame` plus its registry entry, projected entry, deletion marker and serial; every Dry event stays in place at its index; every other frame's timeline events, registry entries and serials are untouched; the record clock does not reset; the revision bumps once when anything was removed and not at all otherwise; it returns the removed count.
    - `purgeAllAquarelleKeyScripts()` removes every non-Dry event and every registry entry (including orphaned and deleted ones), keeps Dry events, clears the per-frame serial counters, bumps once when anything was removed, and returns the removed count.
    - `purgeBrushScriptFrame(frame)` drops the frame's entry and dirty mark, records the frame in the purge-marker set and the arrival-base set, and bumps once when an entry was removed; `purgeAllBrushScriptFrames()` drops every entry and marks every dropped frame plus the caller's current frame.
    - Re-capture law: after a purge, `flushBrushScriptFrame` on that frame with engine strokes returns false and writes nothing; `markBrushScriptFrameDirty` on that frame clears the marker so the next flush captures the NEW strokes (as a partial entry, because the pixels are a base); `captureBrushScriptForFrame`, `clearBrushScriptFrame`, `deleteBrushScriptFrame`, `restoreBrushScriptFrames`, `resetBrushScriptStore` and the two prune functions clear the relevant markers; other frames still capture normally.
    - Controller `persistAfterPurge()`: with no bound identity it is a no-op; otherwise it awaits `flushNow()` (the pruned payload is written synchronously at prepare time), and then, ONLY when the content is no longer dirty and an authority is currently bound, calls the new `remove(identity, authority, 'cache')` port and reports `studioScriptSnapshotPurgeFailureMessage(kind)` once when that remove fails. It never rejects.
    - IPC/Rust delete: `ipcStudioScriptSnapshotDelete(projectId, layerId, trackId, authority, scope)` sends the four key headers plus an optional authority and a `scope` header (`cache` | `both`), and returns `{ cacheRemoved, packageRemoved }`. Rust validates every key component before any join, resolves the package root only through `optional_authority_root`, removes a regular file with `remove_file`, treats NotFound as `false` (never an error), and refuses a present-but-stale authority. `scope='cache'` deletes the cache leg only; `scope='both'` always deletes the cache leg and deletes the package leg when (and only when) the authority resolves.
    - UI: the Memory tab's per-key button is enabled only when the displayed frame has a watercolor or brush row, and its inline confirmation names the frame, states that pixels stay and move/select/replay are lost, and offers Cancel and a confirm that calls `ports.purgeFrame(frame)`. Clear-all is enabled only when the snapshot reports any script strokes; its stronger inline confirmation names the active rail, states that every key loses its script and pixels stay, and calls `ports.clearRail()`. Cancel restores the unconfirmed state and changes nothing. The gauge recomputes immediately after a successful purge.
  </behavior>
  <action>
    In `aquarelleRecordState.ts` add `purgeAquarelleFrameScript(frame: number): number` and `purgeAllAquarelleKeyScripts(): number` next to `deleteAquarelleStrokeFromScript`, walking `payloadTimeline` backwards so splices are stable, skipping `isAquarelleDryEvent(event)`, reading `(event.engine as AquarelleStrokePayload).mutationId`, deleting the id from `recordedStrokes`, `recordedStrokeEntries`, `deletedAquarelleStrokeIds` and `aquarelleStrokeSerials`, and bumping `aquarelleStrokesRevision` once through `bumpAquarelleStrokesRevision()` only when something was removed. Per-frame purge also deletes that frame's `aquarelleFrameSerialCounters` entry; clear-all clears the whole counter map. Do not reset `recordClockTick` and do not touch Dry events or their sinks.

    In `brushScriptRecordState.ts` add a module-level `purgedBrushScriptFrames` set with `purgedBrushScriptFrame(frame)` (exported read for tests). `markBrushScriptFrameDirty` deletes the frame from that set before adding the dirty mark. `captureBrushScriptForFrame` deletes it. `flushBrushScriptFrame` returns false without capturing when the frame is not dirty AND either an entry exists OR the purge marker is set (the existing clean-entry early return stays first). `restoreBrushScriptFrames` and `resetBrushScriptStore` clear the whole set; `pruneBrushScriptFramesTo` and `pruneBrushScriptsFromFrame` drop markers for the frames they drop; `clearBrushScriptFrame` and `deleteBrushScriptFrame` drop the marker for their frame. Add `purgeBrushScriptFrame(frame): boolean` (delete entry + dirty mark, add purge marker and arrival-base note, bump once when an entry existed) and `purgeAllBrushScriptFrames(extraFrame: number | null): number` (drop every entry, mark each plus `extraFrame`, add arrival-base notes, clear dirty marks, bump once when anything was removed). Keep the existing EMPTY read identity stability.

    In `studioScriptSnapshotController.ts` add the `remove` dependency (`identity, authority, scope: 'cache' | 'both'` returning the same `StudioScriptSnapshotOperationResult` shape), export `studioScriptSnapshotPurgeFailureMessage(kind)`, and implement `persistAfterPurge(): Promise<void>` exactly as the behavior block states, using the controller's existing FIFO queue via `flushNow()` and reading the authority LIVE after the rewrite. Never reject; report once per failed remove.

    In `ipc.ts` add `ipcStudioScriptSnapshotDelete(projectId, layerId, trackId, authority, scope)` invoking `studio_script_snapshot_delete` with `{ headers: { projectId, layerId, trackId, scope, ...(authority ? { authority } : {}) } }` and mapping failures through `studioScriptSnapshotFailureFrom`. In the Rust service add `SnapshotDeleteOutcome { cache_removed, package_removed }`, a private `delete_snapshot_at(target)` (`fs::remove_file`, NotFound -> Ok(false), anything else -> Io), and the public `delete_snapshot`, `delete_package_snapshot`, `delete_snapshot_legs(cache_root, package_root: Option<&Path>, project_id, layer_id, track_id, scope)` wrappers that resolve through the existing validated path functions — never join an unvalidated component, never delete a directory, never touch anything but the exact `<trackId>-v1.snap` file. In the command file add `StudioScriptSnapshotDeleteResponse` (camelCase `cacheRemoved`/`packageRemoved`), a `scope` header parser accepting only `cache`/`both` (anything else is Refused), and `studio_script_snapshot_delete` using `header()` and `optional_authority_root()`; register it in `lib.rs` beside the other two commands. Add inline Rust tests for: both-leg deletion, missing-file silence, stale-authority refusal, scope=cache leaving the package file, scope=both on an unbound project deleting only the cache, and key-law rejection before any filesystem touch.

    In `PhysicsPaintStudio.tsx` fill the ports: `purgeFrame(frame)` calls `purgeAquarelleFrameScript(frame)` plus `purgeBrushScriptFrame(frame)`, and when the total is greater than zero fires `void studioScriptSnapshot.persistAfterPurge()` before returning true; `clearRail()` calls `purgeAllAquarelleKeyScripts()` plus `purgeAllBrushScriptFrames(launchContextRef.current?.startFrame ?? null)`, and likewise persists. Wire the controller's new `remove` dep to `ipcStudioScriptSnapshotDelete(identity.projectId, identity.layerId, identity.trackId, authority, scope)`. In `RightPanelMemoryTab.tsx` add the two inline confirmation states and the availability gating described in the behavior block, refreshing the snapshot immediately after a successful purge. Update the panel test for the enabled/disabled states and both confirmation paths (Cancel included).
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarelleRecordState.purge.test.ts src/components/physic-paint/view/brushScriptRecordState.test.ts src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts && cargo test --manifest-path app/src-tauri/Cargo.toml studio_script_snapshot</automated>
  </verify>
  <done>
    Confirmations gate both actions; a per-key purge removes only that frame's script and a clear-all empties only the active rail; both keep pixels, disable that key's edit affordances, update the gauge at once, and clean the persisted snapshot so a close/reopen never restores the purged script; a persistence failure shows one capsule message and painting continues.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Deleting a rail deletes its snapshot on both legs</name>
  <files>
    app/src/stores/efxPaintStore.ts,
    app/src/stores/trackDeleteLaws.test.ts,
    app/src/components/physic-paint/snapshot/studioScriptSnapshotTrackDelete.ts,
    app/src/components/physic-paint/snapshot/studioScriptSnapshotTrackDelete.test.ts,
    app/src/components/physic-paint/PhysicsPaintStudio.tsx,
    app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  </files>
  <behavior>
    - `_setEfxPaintTrackScriptDeleteCallback(cb)` registers one process-wide callback; `commitDeleteTrack` invokes it exactly once, after the four fail-closed guards and before any runtime teardown or document mutation, with the committed `(layerId, trackId)`. A refused delete (no document, unknown track, not acknowledged, last track) never invokes it. A throwing callback is swallowed so the delete still commits.
    - `createStudioScriptSnapshotTrackDelete(deps)(layerId, trackId)`: with no bound identity it does nothing (fail closed, no guessed key); when the bound identity is for another layer it does nothing; when the deleted track IS the bound one it calls `clearBinding()` synchronously BEFORE dispatching the delete, so a pending debounce and any in-flight restore are invalidated and a prepared save cannot rewrite the deleted key; then it dispatches `remove({ projectId, layerId, trackId }, liveAuthority, 'both')` fire-and-forget and reports `studioScriptSnapshotTrackDeleteFailureMessage(kind)` once on failure. It never throws and never awaits inside the store call.
    - The cascade deletes only that track's two legs; the Scripts-library presets are never read or written; another rail's sidecar is unaffected.
    - Studio: an effect registers the cascade on mount and unregisters (`null`) on unmount; the handler is created once and reads the identity, controller and authority refs at call time (a save-as rebind is followed).
  </behavior>
  <action>
    In `efxPaintStore.ts` add `export type EfxPaintTrackScriptDelete = (layerId: string, trackId: string) => void`, a module-level nullable ref and `_setEfxPaintTrackScriptDeleteCallback(cb: EfxPaintTrackScriptDelete | null)`. Invoke it inside `commitDeleteTrack` immediately after the last-track guard and before `severTrackHoldReferences`, inside a try/catch that swallows errors, with a comment naming quick-261023-ors and the fail-closed ordering. Do not change the return shape.

    Create `studioScriptSnapshotTrackDelete.ts` with the deps interface and factory described in the behavior block, reusing `studioScriptSnapshotPurgeFailureMessage`-style copy through a new exported `studioScriptSnapshotTrackDeleteFailureMessage(kind)`; the module must be pure (no Preact, no Studio import) and must never reject.

    In `PhysicsPaintStudio.tsx` build one stable handler from the factory reading `studioScriptSnapshotIdentityRef`, `studioScriptSnapshotAuthorityRef`, `studioScriptSnapshotControllerRef` and the existing capsule report, where `clearBinding` also nulls the identity ref and calls `studioScriptSnapshot.bind(null)` synchronously; register it through a mount effect with identity-stable deps and unregister on cleanup. Keep every l35/o3n pin intact, in particular the save effect slice and the `getAuthority` line.

    Add `studioScriptSnapshotTrackDelete.test.ts` covering: no identity -> no call; other layer -> no call; bound track -> `clearBinding` before the remove call (assert call order), the exact identity passed, scope `both`, failure reported once, and no throw on a rejecting remove. Extend `trackDeleteLaws.test.ts` with a `commitDeleteTrack script cascade` describe: invoked once on a committed delete with the right ids, not invoked on any refusal (all four), a throwing callback does not block the commit, and unregistering removes the hook. Add Studio source pins for the registration effect and the bind-before-remove order.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/snapshot/studioScriptSnapshotTrackDelete.test.ts src/stores/trackDeleteLaws.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts</automated>
  </verify>
  <done>
    Deleting a scripted rail through the acknowledged dialog removes `<package>/scripts/<layerId>/<trackId>-v1.snap` and the cache fallback, leaves every other rail and every Scripts-library preset untouched, and a reopen shows no orphan script; a refused delete touches no file, and a cascade failure reports once without blocking the rail delete.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| studio webview -> Rust delete command | the renderer supplies key components, a scope and an opaque authority token that select files to remove |
| authority token -> package root | the capability is exchanged for a canonical package path inside Rust; a stale token must never map to a guessed root |
| purge action -> persisted snapshot | in-memory stores are emptied while an older snapshot may still exist on either leg |
| rail delete -> snapshot files | a committed track deletion must reach exactly one track's two snapshot files, never another rail's |
| gauge read -> stores | a read-only UI surface walks multi-megabyte script state on a debounce |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261023-ors-01 | Tampering | `delete_snapshot_legs` path resolution | high | mitigate | Every key component passes the existing `[A-Za-z0-9._-]{1,128}` no-leading-dot law before any join; the package root comes only from `ScriptLibraryState::resolve_authority_root`; only `remove_file` on the exact `<trackId>-v1.snap` path is allowed (Task 2). |
| T-261023-ors-02 | Tampering / Repudiation | purged script resurrection from a stale snapshot | high | mitigate | `persistAfterPurge` rewrites the authoritative leg synchronously at prepare time, deletes the fallback cache leg only after the rewrite succeeded and only when an authority is bound; the brush store's purge marker stops `flushBrushScriptFrame` from recapturing purged engine strokes (Task 2). |
| T-261023-ors-03 | Denial of service | gauge estimator cost on heavy sessions | medium | mitigate | The estimator runs only while the Memory tab is mounted, on a 250 ms debounce after a revision and a 2 s cache interval; the brush flush is a no-op on a clean captured frame; no render-body subscription exists in the Studio (Task 1). |
| T-261023-ors-04 | Repudiation / data loss | silent or mis-scoped purge | high | mitigate | Both actions require an inline confirmation; Cancel changes nothing; copy states pixels stay and editability is lost; per-key purge splices only events whose `playFrame` equals the displayed frame; clear-all iterates every store entry and never another track (Task 2). |
| T-261023-ors-05 | Elevation of privilege | delete crossing rails, layers or versions | high | mitigate | The cascade uses the committed `(layerId, trackId)` only; the file name is fixed to version 1; the factory refuses without a bound identity and refuses a different layer; Scripts-library preset files are never named by this path (Task 3). |
| T-261023-ors-06 | Denial of service | cascade failure blocking a rail delete | medium | mitigate | The store wraps the callback in try/catch; the cascade never throws and never awaits inside the store call; a failure reports once on the capsule (Task 3). |
| T-261023-ors-SC | Tampering | npm/pip/cargo installs | high | mitigate | No new dependency is planned by any task. If a task reaches for one, the package-legitimacy gate must run first and a blocking human checkpoint is required before install. |
</threat_model>

<verification>
- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/performance/studioScriptMemoryGauge.test.ts src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts src/components/physic-paint/view/physicsPaintRightPanelModuleGate.test.ts src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts`
- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarelleRecordState.purge.test.ts src/components/physic-paint/view/brushScriptRecordState.test.ts src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts`
- `cargo test --manifest-path app/src-tauri/Cargo.toml studio_script_snapshot` (delete path law, both-leg/scope behaviour, missing-file silence, stale-authority refusal)
- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/snapshot/studioScriptSnapshotTrackDelete.test.ts src/stores/trackDeleteLaws.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `pnpm --filter efx-motion-editor run typecheck` (a pre-existing baseline of unrelated errors may remain; every error in a file this plan touches must be zero and called out in the SUMMARY).
- `pnpm --filter efx-motion-editor exec vitest run src/efx-paint/efxPaintPackageIoBoundary.test.ts` (no renderer filesystem access enters the gauge, purge or cascade paths).
- `git diff --stat` must show NO change under `app/efx-paint-package`, `app/src/efx-paint/document`, `app/src/types/efxPaintDocument*` and no new entries in `app/src-tauri/Cargo.toml`, `app/package.json` or `pnpm-lock.yaml`.
</verification>

<success_criteria>
- A "Memory" tab is the LAST top-pane tab in both modes and shows Scripts (watercolor + brush, per frame and total) and frame caches/LRU as separate lines; rails never appear.
- Per-key purge removes only that frame's script; clear-all empties only the active rail; both are confirmed, keep pixels, state the editability loss, and update the gauge immediately.
- Cancel changes nothing in either confirmation.
- After a purge the snapshot is rewritten and the stale fallback deleted, so close/reopen never restores the purged script; any persistence failure reports once on the capsule without blocking or crashing.
- Deleting a rail deletes its package sidecar and cache fallback; other rails and Scripts-library presets are untouched; the Studio binding resets fail-closed when the deleted rail was the bound one.
- No new dependency, no `.mce` manifest or document-schema change, no LRU policy change.
- The SUMMARY records the automated gauge fixture values and file sizes (labelled FIXTURE-DERIVED) and the seven UAT rows below (PENDING — the user runs the app):

| # | Row | Expected |
|---|-----|----------|
| 1 | Open a heavy session | Gauge shows scripts and caches separately with plausible values |
| 2 | Duplicate several scripted keys | Scripts line grows; caches line stays independent |
| 3 | Purge one frame | That frame's script disappears; other frames and pixels unchanged; Move/Select disabled for that key |
| 4 | Clear all (active rail) | Scripts line drops to zero for that rail; pixels remain; the Studio stays usable |
| 5 | With persistence, close/reopen after a purge | Purged scripts do not come back |
| 6 | Cancel the confirmation | Nothing changes |
| 7 | Delete a scripted rail in the timeline | Its `scripts/<layerId>/<trackId>-v1.snap` and cache fallback are gone; other rails untouched; reopening shows no orphan script |
</success_criteria>

<output>
Create `.planning/quick/261023-ors-v2-0-0-read-specs-quick-prompts-studio-s/261023-ors-SUMMARY.md` when done. Record: the gauge fixture values (strokes, points, approxBytes for watercolor and brush, the four cache totals and the grand totals) with their basis labelled FIXTURE-DERIVED — live in-app numbers only after the user's UAT; the purge scope laws (per-key splices only that `playFrame`, Dry events kept, clear-all is the active rail, pixels stay, editability lost); the persistence-cleanup order (rewrite authoritative leg, then delete the stale cache leg only when bound and only when the rewrite left the store clean); the rail cascade (both legs, presets untouched, bind-before-remove); the seven UAT rows above with their status (PENDING until the user runs UAT); and the exact verification commands with their results.
</output>
