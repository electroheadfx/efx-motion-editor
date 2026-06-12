# Phase 36: Physics Paint UI Rebuild, Session Persistence, and Output Proof - Research

**Researched:** 2026-06-12  
**Domain:** Preact/Tauri standalone physics paint UI, editable JSON persistence, rendered PNG/cache proof output  
**Confidence:** HIGH for codebase-specific implementation seams; MEDIUM for official API docs; LOW for broad UX guidance

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
## Implementation Decisions

### UI Rebuild and Visual Cutline
- **D-01:** Phase 36 must replace the old toolbar structure with the redesigned layout: top bar, left sidebar tools, main paint canvas, right sidebar color/options, and bottom physics-paint timeline/workflow strip.
- **D-02:** Use the existing EFX Motion app UI language/components/buttons as the visual base. Use the Pencil design for placement/layout, not for inventing unrelated styles.
- **D-03:** Use the SVG assets provided in `SPECS/physics-paint-ui/icons/` for the left-sidebar tools.
- **D-04:** Every existing engine/apply/save/load control must remain functional in its new location. Genuinely new affordances may be disabled or deferred if they would require large new systems.
- **D-05:** Remove the large bottom diagnostics/log grid. It previously showed Layer, Start frame, Canvas size, Engine ready, Canvas mounted, Active tool, Color, Brush size, Opacity, Physics mode, Bridge transport mode, and Last error. Keep only compact user-facing status/errors/logs in the top bar.
- **D-06:** `Grain` is renamed to `Grain strength` and must keep four choices: `None`, `Soft`, `Med`, `Hard`.
- **D-07:** Remove custom FPS from the UI. Play canvas preview uses the current project FPS.
- **D-08:** The right-sidebar mini blend/color area is for lightweight color blending and brush-color selection. Do not add a second full `EfxPaintEngine`/canvas for this in Phase 36 if that is heavy; prefer a lightweight local preview and reuse existing EFX Motion color picker/palette code where practical.
- **D-09:** The new spreadsheet/timeline is physics-paint-specific and should not be copied from the main EFX Motion timeline, though it should share app visual style.
- **D-10:** `Save roto frame` and `Save play` must use the same button style family as EFX Motion UI, not mismatched colors.
- **D-11:** `Roto canvas` and `Play canvas` are workflow tabs/segments in the same bottom strip. They are both visible, but the active workflow controls the editable mode and primary actions.

### Save and Output Behavior
- **D-12:** Phase 36 keeps manual explicit save/publish. `Save roto frame` manually publishes the current roto frame. `Save play` manually publishes the generated play range. Auto-save/auto-publish is deferred to Phase 38.
- **D-13:** `Save roto frame` defaults to save-and-next: it saves/publishes the current roto frame and advances to the next synced frame.
- **D-14:** `Play` is preview only. It must not finalize EFX cache/source output until the user clicks `Save play`.
- **D-15:** When `Save play` succeeds, keep the Physics Paint UI/window open, show a publication summary, and let the user continue painting/adjusting. Do not automatically close the standalone window.
- **D-16:** Normal artist workflow is `Save roto frame` and `Save play`. Debug output export is not the final artist workflow.
- **D-17:** Phase 36 must provide both an inspectable UI summary and dev/debug export proof for generated output. The normal UI should show summaries such as generated frame count, start frame, canvas size, success, and errors.
- **D-18:** Exporting generated PNGs plus `manifest.json` is a dev/debug inspection artifact only. It must only appear for users in dev mode / development environment, not in the final app.
- **D-19:** The dev/debug PNG+manifest export lives in the top bar status area, collapsed by default.

### Source Modes and Timeline Lanes
- **D-20:** The timeline must show two visible rows: `Roto frames` as per-frame cells, and `Play canvas` / script play as a start square plus range bar.
- **D-21:** Phase 36 uses two exclusive source modes: Roto frame-by-frame mode and Play canvas mode. It does not mix script-play output with roto corrections on the same final output.
- **D-22:** The inactive lane remains visible for context but is subdued/disabled and not editable until its workflow tab is active.
- **D-23:** The Play canvas range should show a current-position/interpolation marker, for example `[0]----•---[50]`, where `•` represents the current frame/state inside the play range.
- **D-24:** Clicking inside a Play canvas range moves the current frame/marker for inspection/preview. It must not convert modes or destroy source data.
- **D-25:** Conversion between Play and Roto is explicit through the workflow tabs, never by casual lane clicks. Any destructive conversion requires confirmation.
- **D-26:** Physics Paint frame navigation must stay synced with EFX Motion current frame. Previous/next frame controls move both the EFX Motion current frame and the EFX Physics Paint frame together.
- **D-27:** Roto previous/next buttons move to the previous/next immediate frame. `Shift+←` / `Shift+→` can navigate previous/next saved roto frame if implemented.
- **D-28:** The Play canvas frame-count field defines the range length. It should also drive a ghost/preview range before `Save play` when feasible.

### Onion Skin and Preview
- **D-29:** Roto canvas has onion-skin controls with a global on/off plus previous and next toggles/checkboxes.
- **D-30:** Onion skin can show previous frames, next frames, or both. Default count is `1`; planner may cap at `3` unless implementation finds a better small bound.
- **D-31:** Onion skin should preview available Play canvas frames too, when applicable and not during live Play preview.
- **D-32:** Live Play canvas preview temporarily disables onion skin to avoid confusing overlays during playback.
- **D-33:** Suggested onion rendering: previous frames in light cyan/blue, next frames in light orange/yellow, with opacity decreasing by distance. Onion frames are preview-only and not editable.

### Clear, Replace, and Destructive Conversion Rules
- **D-34:** `Clear frame` clears only the active workflow source. In Roto mode, it clears the current roto frame/source. In Play mode, it clears the play range/source.
- **D-35:** Clearing a Roto frame does not require a modal warning. Clearing a Play canvas range requires a confirmation dialog because it modifies/deletes the range/source.
- **D-36:** Saving over existing output in the same mode replaces that same-mode output with clear feedback. Do not build advanced conflict handling in Phase 36.
- **D-37:** Play→Roto conversion converts the whole rendered Play range into roto frame-by-frame images, then loses/deletes the editable Play script source. This requires confirmation.
- **D-38:** Roto→Play conversion replaces roto frames starting at the current frame for the current `Play canvas` frameCount range, then loses those roto images in that range. This requires confirmation and should state the affected frame span/count.
- **D-39:** If Play rendered frames needed for Play→Roto conversion are missing, require the user to save/regenerate Play output first rather than fabricating incomplete roto frames.

### Shortcuts
- **D-40:** Physics Paint shortcuts are contextual to the Physics Paint window/surface only and must not conflict with the main editor when focus is outside Physics Paint or inside an input.
- **D-41:** Accepted general shortcuts: `Cmd+Z` undo, `Cmd+Shift+Z` redo, `Esc` stop preview / close dialog / cancel active interaction, `Cmd+S` save the active workflow (`Save roto frame` in Roto mode, `Save play` in Play mode), and `?` show shortcuts/help.
- **D-42:** Accepted Roto mode shortcuts: `←` / `→` previous/next synced frame, `Shift+←` / `Shift+→` previous/next saved roto frame if implemented, `G` focus/go-to-frame, `O` onion on/off, `[` / `]` onion count down/up, `Cmd+Enter` save roto frame and go next, `Delete` clear current roto frame/source with the active-mode warning rules.
- **D-43:** Accepted Play mode shortcuts: `Space` play/stop preview, `Enter` play/stop preview when not inside an input, `Cmd+S` save play, `Esc` stop preview before falling back to cancel/close behavior.

### Claude's Discretion
Planner/researcher may choose the safest technical implementation for lightweight color blending, dev-mode detection, exact unsaved-change guard placement, and exact visual styling details, but must preserve the user-facing decisions above.

### Deferred Ideas (OUT OF SCOPE)
## Deferred Ideas

- Phase 38: true persisted source-lane data model for roto-frame and script-play sources.
- Phase 38: hybrid/mixing model where script play can be the base and roto corrections can be layered on top.
- Phase 38: auto-save/auto-publish policy.
- Phase 38: conflict/overlap handling for script-play ranges and roto fixes.
- Phase 38 or later: edit script source from any frame in its range.
- Phase 38 or later: multiple stacked roto lanes / arbitrary layer mixing.
- Later if needed: second full physics-paint engine/canvas for mini blend preview. Phase 36 should attempt lightweight blending first and defer if a full engine is required.
</user_constraints>

## Summary

Phase 36 should be planned as a standalone UI refactor plus behavior-preservation pass, not as a new editor-integration milestone. The existing `PhysicsPaintStudio` already owns launch context parsing, Tauri/browser bridge detection, engine readiness, play preview, current-frame apply, play-range apply, and apply-result handling; the planner should preserve those seams while moving controls into the new top/left/right/bottom layout. [VERIFIED: codebase]

The current editable persistence path is already viable for `SAVE-01` and `SAVE-02`: the toolbar saves `engine.save()` as JSON through Tauri dialog/fs APIs or browser Blob download, and loads validated JSON back with `engine.load()`. [VERIFIED: codebase] The package `SerializedProject` stores `version`, dimensions, strokes, and settings rather than raw canvas/image buffers, so saved JSON is editable engine state, not flattened output. [VERIFIED: codebase]

Output proof should be implemented as two lanes: normal artist publication actions (`Save roto frame`, `Save play`) and dev-only debug artifact export (PNG frames plus `manifest.json`). Current apply payloads already include rendered PNG data URLs and `editableState`; the plan should add a dev export utility around the same capture data rather than creating a second renderer or resurrecting headless batch replay. [VERIFIED: codebase]

**Primary recommendation:** Rebuild the Physics Paint Studio as a Preact component split around existing engine actions, keep all engine/bridge behavior in `PhysicsPaintStudio`, move current toolbar state/actions into layout-specific child components, and add dev-only PNG+manifest proof export from the existing `exportCompositeCanvas()` / `AnimationPlayer` capture path. [VERIFIED: codebase]

## Project Constraints (from CLAUDE.md)

- Use GSD tools from `/Users/lmarques/Dev/efx-motion-editor/.claude/get-shit-done` per project instruction; in this environment the available GSD shim was `/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/bin/gsd-tools.cjs`. [VERIFIED: codebase]
- Do not run the server; the user runs it. [VERIFIED: CLAUDE.md]
- Use `pnpm`, not `npm`, for project commands because the root package manager is `pnpm@10.27.0` and user memory explicitly says the monorepo uses pnpm. [VERIFIED: codebase]
- Do not replace p5.brush or perfect-freehand paint paths; physics paint is an additive standalone package tool. [VERIFIED: REQUIREMENTS.md]
- Preserve queued/interactive physics paint quality; do not return to the rejected headless adapter or O(n²) batch replay approach. [VERIFIED: REQUIREMENTS.md]
- Bump explicit version signals after non-reactive Map mutations; `physicPaintStore` already uses `physicPaintVersion` for this pattern. [VERIFIED: codebase]
- Shortcuts must be guarded in paint contexts and avoid conflicts with the main editor. [VERIFIED: CONTEXT.md]

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-REBUILD-01 | User can use a rebuilt physics paint package UI with clear layout, modern controls, and polished interaction states. | Use the locked top/left/main/right/bottom layout and preserve every existing control currently in `PhysicsPaintStudioToolbar`. [VERIFIED: CONTEXT.md] |
| UI-REBUILD-02 | Rebuilt UI remains standalone-package-first and does not add editor integration scope beyond proof artifacts. | Keep logic in the existing standalone `/physics-paint` route/window and bridge payloads; do not add `.mce`, editor layer creation, or Tauri child-window IPC beyond existing open/apply bridge. [VERIFIED: codebase] |
| SAVE-01 | User can save the standalone paint session as JSON. | Existing toolbar `onSave` serializes `engine.save()` and uses Tauri `save` + `writeTextFile`, with browser Blob fallback. [VERIFIED: codebase] |
| SAVE-02 | User can reload saved JSON and continue testing the same paint session. | Existing file input parses JSON, validates `SerializedProject`, then calls `engine.load(parsed)`. [VERIFIED: codebase] |
| OUT-01 | User can export the current rendered paint result as PNG or still image. | Existing `applyCanvas` uses `engine.exportCompositeCanvas().toDataURL('image/png')`; reuse that for still export proof. [VERIFIED: codebase] |
| OUT-02 | User can produce a frame-sequence or cache-manifest proof from the live engine. | Existing `applyPlayCanvas` captures `AnimationPlayer` frames as PNG data URLs with app frame indexes; wrap captured frames with `manifest.json` for dev proof. [VERIFIED: codebase] |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Rebuilt physics paint UI layout | Browser / Client | Standalone package route | Preact components render and handle local UI state in the physics-paint window. [VERIFIED: codebase] |
| Engine painting/erasing/settings | Browser / Client | Physics paint package engine | Existing `EfxPaintEngine` methods (`setTool`, `setBrushSize`, `setBrushOpacity`, etc.) are invoked directly from the standalone UI. [VERIFIED: codebase] |
| Editable session save/load JSON | Browser / Client | Tauri plugins when available | `engine.save()`/`engine.load()` are client-side engine APIs; Tauri dialog/fs only chooses and writes files in desktop runtime. [VERIFIED: codebase] |
| Rendered still PNG export | Browser / Client | Tauri/browser file APIs | `exportCompositeCanvas().toDataURL('image/png')` produces still output from the live canvas. [VERIFIED: codebase] |
| Play preview and sequence capture | Browser / Client | Physics paint package animation module | `AnimationPlayer.play()` renders frame callbacks from the live engine and locks input during playback. [VERIFIED: codebase] |
| Apply/publish to editor cache proof | Browser / Client | Existing app bridge/store | Existing bridge applies rendered-output-only payloads to `physicPaintStore`; full editor integration remains future scope. [VERIFIED: codebase] |
| Dev-only PNG+manifest export | Browser / Client | — | It should be generated from already captured PNG frame payloads in development mode; no backend service is required. [VERIFIED: CONTEXT.md] |
| Validation tests | Browser / Client test runner | Vitest | Existing app test config includes `src/**/*.test.ts`. [VERIFIED: codebase] |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `preact` | Installed `^10.28.4`; package package uses `^10.29.0`; npm latest 10.29.2 published/modified 2026-05-17. | UI components/hooks for the rebuilt standalone Physics Paint Studio. | Project already uses Preact and `@efxlab/efx-physic-paint/preact`; do not add React or a heavy UI framework. [VERIFIED: codebase] |
| `@preact/signals` | Installed `^2.8.1`; npm latest 2.9.1 published/modified 2026-05-25. | Existing reactive store/version signal patterns. | Existing `physicPaintVersion` and other stores use signals for non-reactive Map invalidation. [VERIFIED: codebase] |
| `@efxlab/efx-physic-paint` | Workspace `0.1.0`. | Physics paint engine, canvas component, serialization, animation player. | This is the phase's target package; it exports main, `preact`, and `animation` entrypoints. [VERIFIED: codebase] |
| `@tauri-apps/plugin-dialog` | Installed `^2.6.0`; npm latest 2.7.1 published/modified 2026-05-02. | Native save dialog for JSON/debug artifacts in Tauri runtime. | Existing toolbar already uses `save()` for JSON export. [VERIFIED: codebase] |
| `@tauri-apps/plugin-fs` | Installed `^2.4.5`; npm latest 2.5.1 published/modified 2026-05-02. | Native `writeTextFile` for saving JSON text in Tauri runtime. | Existing toolbar already uses `writeTextFile()` for JSON export. [VERIFIED: codebase] |
| `vitest` | Installed `^2.1.9`; npm latest 4.1.8 published/modified 2026-06-01. | Unit tests for payload contracts, store behavior, export helpers. | Existing config and tests use Vitest under `app/src/**/*.test.ts`. [VERIFIED: codebase] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vite` | Installed `5.4.21`; npm latest 8.0.16 published/modified 2026-06-01. | Existing app/package build tooling. | Use existing scripts only; do not change Vite major version during this UI phase. [VERIFIED: codebase] |
| `@tauri-apps/api` | Installed `^2.10.1`. | Runtime bridge detection, events, window close behavior. | Preserve current bridge listeners and avoid extra editor integration scope. [VERIFIED: codebase] |
| Browser `Blob`, `URL.createObjectURL`, `<a download>` | Native browser APIs. | Browser fallback for JSON/PNG/manifest download. | Existing JSON fallback uses this pattern; use it for dev artifacts when not in Tauri. [VERIFIED: codebase] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Existing Preact components/CSS | Add a UI component library | Rejected for this phase because the project already uses custom EFX Motion UI language and the context explicitly says to reuse app visual language. [VERIFIED: CONTEXT.md] |
| Existing `AnimationPlayer` capture | Headless batch replay/render adapter | Rejected because project requirements explicitly exclude headless batch adapter replay and prior phases found quality/performance problems. [VERIFIED: REQUIREMENTS.md] |
| Existing Tauri/browser save fallback | Backend service/file server | Not needed; all required artifacts are client-generated files. [VERIFIED: codebase] |
| Lightweight color preview | Second `EfxPaintEngine` mini canvas | Defer unless cheap; context explicitly says not to add a second full engine/canvas if heavy. [VERIFIED: CONTEXT.md] |

**Installation:**

No new external packages are recommended for Phase 36. [VERIFIED: codebase]

```bash
pnpm install
```

**Version verification:** Versions above were checked from `package.json`/workspace package files and `npm view` during research. [VERIFIED: npm registry]

## Package Legitimacy Audit

> Phase 36 should install no new external packages. Existing dependencies were audited only to avoid recommending new installs. [VERIFIED: codebase]

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `preact` | npm | Existing project dependency; latest flagged as published recently | 18,378,382/wk | github.com/preactjs/preact | SUS by seam: too-new | Keep existing pinned range; do not newly install/upgrade in this phase. [VERIFIED: npm registry] |
| `@preact/signals` | npm | Existing project dependency; latest flagged as published recently | 1,604,772/wk | github.com/preactjs/signals | SUS by seam: too-new | Keep existing pinned range; do not newly install/upgrade in this phase. [VERIFIED: npm registry] |
| `@tauri-apps/plugin-dialog` | npm | Existing project dependency | 783,677/wk | github.com/tauri-apps/plugins-workspace | OK | Approved existing dependency. [VERIFIED: npm registry] |
| `@tauri-apps/plugin-fs` | npm | Existing project dependency | 278,170/wk | github.com/tauri-apps/plugins-workspace | OK | Approved existing dependency. [VERIFIED: npm registry] |
| `vitest` | npm | Existing dev dependency; latest flagged as published recently | 56,565,939/wk | github.com/vitest-dev/vitest | SUS by seam: too-new | Keep existing pinned range; do not newly install/upgrade in this phase. [VERIFIED: npm registry] |
| `vite` | npm | Existing dev dependency; latest flagged as published recently | 135,762,169/wk | github.com/vitejs/vite | SUS by seam: too-new | Keep existing pinned 5.4.21; do not upgrade major during this phase. [VERIFIED: npm registry] |

**Packages removed due to [SLOP] verdict:** none. [VERIFIED: npm registry]  
**Packages flagged as suspicious [SUS]:** existing `preact`, `@preact/signals`, `vitest`, and `vite` latest publications were flagged by the seam as `too-new`; planner should not add install/upgrade tasks for them. [VERIFIED: npm registry]

## Architecture Patterns

### System Architecture Diagram

```text
User input / pointer / controls
        |
        v
PhysicsPaintStudio standalone route/window
        |
        +--> Top bar: brush size, opacity, background, paper grain, grain strength, compact status
        |
        +--> Left sidebar: paint, physics paint, erase, undo, clear, physics last/all, dry
        |
        +--> Main canvas: EfxPaintCanvas -> EfxPaintEngine
        |
        +--> Right sidebar: brush color/palette + tool options
        |
        +--> Bottom strip: Roto canvas workflow + Play canvas workflow + state save/load + timeline lanes
        |
        +--> Decision: user action?
              |
              +--> Save state JSON -> engine.save() -> Tauri save/writeTextFile OR Blob download
              |
              +--> Load state JSON -> parse/validate SerializedProject -> engine.load()
              |
              +--> Save roto frame -> exportCompositeCanvas().toDataURL('image/png')
              |        -> apply-canvas payload with editableState -> existing bridge/store
              |
              +--> Play preview -> AnimationPlayer.play(frameCount, project FPS) -> preview only
              |
              +--> Save play -> AnimationPlayer frame capture -> apply-play-canvas payload
              |        -> existing bridge/store + visible publication summary
              |
              +--> Dev export proof -> PNG data URLs + manifest.json download, dev-only, collapsed
```

### Recommended Project Structure

```text
app/src/components/physic-paint/
├── PhysicsPaintStudio.tsx              # keep engine, launch context, bridge, apply, playback orchestration
├── PhysicsPaintStudioToolbar.tsx       # replace or decompose old toolbar; retire old layout after behavior parity
├── PhysicsPaintTopBar.tsx              # brush/background/grain/status controls
├── PhysicsPaintToolRail.tsx            # left-sidebar tools and SVG icons
├── PhysicsPaintRightPanel.tsx          # color picker/palette/tool options
├── PhysicsPaintWorkflowStrip.tsx       # roto/play controls, state save/load, frame lanes
├── physicsPaintDevExport.ts            # dev-only PNG/manifest helpers, testable without UI
├── physicsPaintStudio.css              # new EFX-style standalone layout classes
└── *.test.ts                           # helper/contract tests where logic is extracted
```

### Component Responsibilities

| Component/Module | Responsibility | Do Not Put Here |
|------------------|----------------|-----------------|
| `PhysicsPaintStudio.tsx` | Own engine refs, bridge mode, launch context, apply result lifecycle, player lifecycle, output capture. [VERIFIED: codebase] | Visual-only markup details that obscure behavior seams. |
| `PhysicsPaintTopBar.tsx` | Brush size, opacity, background, paper grain, `Grain strength`, compact status/errors/dev export toggle. [VERIFIED: CONTEXT.md] | Large diagnostics grid. |
| `PhysicsPaintToolRail.tsx` | Left sidebar action order and icon mapping. [VERIFIED: CONTEXT.md] | Engine creation or bridge apply logic. |
| `PhysicsPaintRightPanel.tsx` | Color picker/palette, shape detail, pickup, spread, smoothing, erase strength. [VERIFIED: CONTEXT.md] | A second engine/canvas unless explicitly proven cheap. |
| `PhysicsPaintWorkflowStrip.tsx` | Roto/play tabs, save roto frame, play/stop, save play, frame count, save/load state, two-lane timeline. [VERIFIED: CONTEXT.md] | Main EFX timeline duplication. |
| `physicsPaintDevExport.ts` | Convert captured PNG data URLs and metadata into downloadable artifacts/manifest. [VERIFIED: codebase] | Normal artist publish flow. |

### Pattern 1: Extract Actions Before Re-skinning
**What:** First name and isolate all current behaviors (`saveState`, `loadState`, `saveRotoFrame`, `playPreview`, `savePlay`, `clearFrame`, `startPhysics`, `forceDry`) as callbacks, then wire them into new layout components. [VERIFIED: codebase]  
**When to use:** Use throughout Phase 36 because D-04 requires every existing control to remain functional in its new location. [VERIFIED: CONTEXT.md]  
**Example:**
```typescript
// Source: app/src/components/physic-paint/PhysicsPaintStudio.tsx [VERIFIED: codebase]
const applyCanvas = useCallback(async () => {
  if (!engine || !launchContext || !readyToApply) return;
  const canvas = engine.exportCompositeCanvas();
  const payload = {
    kind: 'apply-canvas',
    layerId: launchContext.layerId,
    startFrame: launchContext.startFrame,
    editableState: engine.save(),
    renderedFrame: { frameIndex: 0, appFrame: launchContext.startFrame, dataUrl: canvas.toDataURL('image/png') },
  };
}, [engine, launchContext, readyToApply]);
```

### Pattern 2: Keep Editable State and Rendered Output Separate
**What:** Treat `SerializedProject` as editable state and PNG data URLs as rendered/cache proof; do not try to reconstruct editable strokes from PNGs. [VERIFIED: codebase]  
**When to use:** Save/load JSON, save roto frame, save play, dev manifest, clear/replace warnings. [VERIFIED: CONTEXT.md]  
**Example:**
```typescript
// Source: app/src/types/physicPaint.ts [VERIFIED: codebase]
export interface PhysicPaintApplyPlayCanvasPayload {
  kind: 'apply-play-canvas';
  startFrame: number;
  frameCount: number;
  frames: PhysicPaintRenderedFrame[];
  editableState: SerializedProject;
}
```

### Pattern 3: Dev Export Is a Sidecar of Existing Capture
**What:** Build manifest proof from the same captured frame payloads used by `applyPlayCanvas`, plus engine/session metadata. [VERIFIED: codebase]  
**When to use:** OUT-02 debug export. [VERIFIED: REQUIREMENTS.md]  
**Example:**
```typescript
// Source pattern from PhysicsPaintStudio.tsx [VERIFIED: codebase]
const frames = await capturePlayFrames(frameCount);
const manifest = {
  kind: 'physics-paint-debug-export',
  startFrame: launchContext.startFrame,
  frameCount,
  canvas: { width: frames[0]?.width, height: frames[0]?.height },
  frames: frames.map(frame => ({ appFrame: frame.appFrame, frameIndex: frame.frameIndex, file: `frame-${String(frame.frameIndex).padStart(4, '0')}.png` })),
};
```

### Anti-Patterns to Avoid
- **Closing the standalone window after `Save play`:** Current `handleApplyResult` closes on success; Phase 36 D-15 requires keeping the UI/window open and showing a publication summary. [VERIFIED: codebase]
- **Exposing custom FPS:** Current toolbar has FPS; D-07 removes it and requires project FPS for preview. [VERIFIED: CONTEXT.md]
- **Large diagnostics grid:** Current bottom grid must be removed; keep compact status/errors in the top bar. [VERIFIED: CONTEXT.md]
- **Second full engine for mini color preview:** D-08 says prefer lightweight preview and defer a full extra engine/canvas if heavy. [VERIFIED: CONTEXT.md]
- **Headless batch replay:** Explicitly excluded by requirements; use live engine/AnimationPlayer capture. [VERIFIED: REQUIREMENTS.md]
- **Treating lane UI as full Phase 38 source model:** Phase 36 should show two visible rows and exclusive workflows, but true source-lane persistence is deferred. [VERIFIED: CONTEXT.md]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Physics paint rendering | New canvas renderer or batch adapter | Existing `EfxPaintEngine`, `EfxPaintCanvas`, `AnimationPlayer` | Existing engine preserves interactive simulation quality; batch replay is explicitly excluded. [VERIFIED: REQUIREMENTS.md] |
| Editable session format | Custom JSON schema | `engine.save()` / `engine.load()` and `SerializedProject` validation | Existing engine serialization stores strokes/settings and is already validated by app types. [VERIFIED: codebase] |
| Native save dialog/files | Custom native bridge | Existing `@tauri-apps/plugin-dialog` `save()` and `@tauri-apps/plugin-fs` `writeTextFile()` | Current code already handles Tauri and browser fallback. [VERIFIED: codebase] |
| App bridge transport | New IPC protocol | Existing `PHYSIC_PAINT_APPLY_EVENT` / result events and payload validators | The bridge already validates payloads and applies them to `physicPaintStore`. [VERIFIED: codebase] |
| UI framework | New component library | Existing Preact + project CSS/buttons | Project uses custom EFX Motion styling and locked decisions require matching it. [VERIFIED: CONTEXT.md] |
| Timeline system | Main editor timeline clone | Small physics-paint-specific workflow strip | D-09 says the physics paint spreadsheet/timeline should not be copied from the main EFX Motion timeline. [VERIFIED: CONTEXT.md] |
| Complex source conflict handling | Full overlap/merge editor | Same-mode replace with feedback; destructive confirmations only | D-36 defers advanced conflict handling. [VERIFIED: CONTEXT.md] |

**Key insight:** The hard parts already exist as engine, serialization, animation, and bridge seams; Phase 36 planning should spend effort on layout, behavior preservation, state summaries, and proof artifacts, not on new infrastructure. [VERIFIED: codebase]

## Common Pitfalls

### Pitfall 1: Accidentally Breaking Existing Apply Behavior While Re-skinning
**What goes wrong:** New buttons look correct but fail to send the same `apply-canvas` / `apply-play-canvas` payloads. [VERIFIED: codebase]  
**Why it happens:** The old toolbar mixes UI controls and engine mutations; moving controls without extracting callbacks can drop side effects. [VERIFIED: codebase]  
**How to avoid:** Create action callbacks in `PhysicsPaintStudio` and pass them down; add tests around pure payload/helper logic. [VERIFIED: codebase]  
**Warning signs:** `physicPaintBridge.test.ts` still passes but manual UI no longer updates app cache because UI integration is untested. [VERIFIED: codebase]

### Pitfall 2: Closing the Window After Save Play
**What goes wrong:** Current success handling calls `closePhysicsPaintWindow()` for all successful apply results. [VERIFIED: codebase]  
**Why it happens:** Existing behavior predates D-15. [VERIFIED: CONTEXT.md]  
**How to avoid:** Change success handling so `Save play` and likely `Save roto frame` show a summary and keep the window open unless a separate explicit close action exists. [VERIFIED: CONTEXT.md]  
**Warning signs:** `handleApplyResult` still calls `closePhysicsPaintWindow()` unconditionally. [VERIFIED: codebase]

### Pitfall 3: Mistaking Debug Export for Artist Workflow
**What goes wrong:** Users see PNG/manifest export as primary action instead of `Save roto frame` / `Save play`. [VERIFIED: CONTEXT.md]  
**Why it happens:** OUT-01/OUT-02 mention export proof, but D-16 through D-19 restrict debug output visibility. [VERIFIED: CONTEXT.md]  
**How to avoid:** Keep normal publish controls prominent; put dev export in collapsed top status area and gate by development mode. [VERIFIED: CONTEXT.md]  
**Warning signs:** Export PNG/manifest buttons appear in the main bottom workflow strip in production UI. [VERIFIED: CONTEXT.md]

### Pitfall 4: Overbuilding Phase 38 Source Lanes
**What goes wrong:** Plan expands into hybrid source persistence, overlap handling, arbitrary roto lanes, or auto-publish. [VERIFIED: CONTEXT.md]  
**Why it happens:** The visual timeline suggests deeper data-model work. [VERIFIED: CONTEXT.md]  
**How to avoid:** Implement two visible rows with exclusive active workflow and clear labels, but keep persistent source-lane data-model work deferred. [VERIFIED: CONTEXT.md]  
**Warning signs:** New tasks mention `.mce` source-lane schema, hybrid mixing, arbitrary stacked roto lanes, or conflict resolution. [VERIFIED: CONTEXT.md]

### Pitfall 5: Running the Server During Implementation/Validation
**What goes wrong:** Agent starts dev server despite project instruction. [VERIFIED: CLAUDE.md]  
**Why it happens:** UI phases often invite local server checks. [ASSUMED]  
**How to avoid:** Use build/typecheck/test commands only; leave live server validation to the user. [VERIFIED: CLAUDE.md]  
**Warning signs:** Plan includes `pnpm dev`, `pnpm dev:paint`, or Tauri runtime launch as automated task. [VERIFIED: codebase]

## Code Examples

Verified patterns from existing code and official docs:

### Save Editable JSON State
```typescript
// Source: app/src/components/physic-paint/PhysicsPaintStudioToolbar.tsx [VERIFIED: codebase]
const data = engine.save();
const serialized = JSON.stringify(data, null, 2);
// In Tauri: save({ defaultPath, filters }) then writeTextFile(selectedPath, serialized).
// In browser: Blob + URL.createObjectURL + anchor.download.
```

### Load Editable JSON State
```typescript
// Source: app/src/components/physic-paint/PhysicsPaintStudioToolbar.tsx [VERIFIED: codebase]
const parsed = JSON.parse(String(reader.result ?? ''));
if (!isSerializedProject(parsed)) throw new Error(INVALID_STATE_COPY);
engine.load(parsed);
```

### Capture Current Still PNG
```typescript
// Source: app/src/components/physic-paint/PhysicsPaintStudio.tsx [VERIFIED: codebase]
const canvas = engine.exportCompositeCanvas();
const dataUrl = canvas.toDataURL('image/png');
```

### Capture Play Frames From Live Engine
```typescript
// Source: app/src/components/physic-paint/PhysicsPaintStudio.tsx [VERIFIED: codebase]
playerRef.current?.play({
  frameCount,
  fps,
  onFrame: (frameIndex, canvas) => {
    captured.push({ frameIndex, appFrame: launchContext.startFrame + frameIndex, dataUrl: canvas.toDataURL('image/png') });
  },
  onComplete: () => resolve(captured),
});
```

### Preact Hook/Event Pattern
```typescript
// Source: https://preactjs.com/guide/v10/hooks/ [CITED: https://preactjs.com/guide/v10/hooks/]
const onClick = useCallback(() => {
  // update state or invoke stable action
}, []);
return <button onClick={onClick}>Save</button>;
```

### Tauri Save Dialog Pattern
```typescript
// Source: https://v2.tauri.app/reference/javascript/dialog/ [CITED: https://v2.tauri.app/reference/javascript/dialog/]
import { save } from '@tauri-apps/plugin-dialog';
const filePath = await save({
  filters: [{ name: 'JSON', extensions: ['json'] }],
  defaultPath: 'data.json',
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Old toolbar plus large diagnostics grid | Production layout with top bar, left rail, main canvas, right panel, bottom workflow strip | Phase 36 locked decision | Planner should schedule layout/component decomposition rather than incremental toolbar tweaks. [VERIFIED: CONTEXT.md] |
| `[apply canvas]` / `[apply play canvas]` labels | `Save roto frame` / `Save play` artist workflow | Phase 36 locked decision | Same behavior must be renamed/restyled and summarized clearly. [VERIFIED: CONTEXT.md] |
| Custom FPS UI | Project FPS, no custom FPS control | Phase 36 locked decision | Remove FPS input from visible UI; pass project/default FPS internally. [VERIFIED: CONTEXT.md] |
| Export/apply closes standalone on success | Keep window open after `Save play`, show publication summary | Phase 36 locked decision | Modify `handleApplyResult` success behavior. [VERIFIED: CONTEXT.md] |
| Headless adapter replay | Live interactive engine/AnimationPlayer capture | v0.8.0 milestone boundary | Avoid prior quality/performance failure path. [VERIFIED: REQUIREMENTS.md] |

**Deprecated/outdated:**
- Old bottom diagnostics grid: remove and replace with compact top status/errors. [VERIFIED: CONTEXT.md]
- Visible custom FPS control: remove from UI. [VERIFIED: CONTEXT.md]
- Headless batch adapter/renderFromStrokes integration: excluded from v0.8.0. [VERIFIED: REQUIREMENTS.md]
- Auto-save/auto-publish: deferred to Phase 38. [VERIFIED: CONTEXT.md]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | UI phases often invite accidental dev-server runs. | Common Pitfalls | Low; project instruction already forbids running the server. |
| A2 | Development-mode gating can likely use Vite/Tauri environment checks such as `import.meta.env.DEV`. | Open Questions | Medium; planner should verify current project env conventions before implementation. |

## Open Questions

1. **Where should project FPS come from inside the standalone Physics Paint route?**
   - What we know: D-07 removes custom FPS and says preview uses current project FPS. [VERIFIED: CONTEXT.md]
   - What's unclear: Current `PhysicPaintLaunchContext` does not include FPS. [VERIFIED: codebase]
   - Recommendation: Add optional `fps` to launch context or derive from existing sequence context in the bridge, defaulting to 24 only as fallback. [ASSUMED]

2. **How much of source-lane state should be real in Phase 36?**
   - What we know: D-20 requires two visible rows; Phase 38 defers true source-lane model. [VERIFIED: CONTEXT.md]
   - What's unclear: Whether timeline lane cells should read only from current output maps or add minimal internal UI state for ghost ranges. [VERIFIED: codebase]
   - Recommendation: Use existing `physicPaintStore.getFrames(layerId)` for output markers and local UI state for active/ghost play range; avoid new persisted source schema. [ASSUMED]

3. **Exact dev-mode detection for debug export visibility.**
   - What we know: D-18 requires debug export only in dev/development environment. [VERIFIED: CONTEXT.md]
   - What's unclear: No existing helper was found in researched files. [VERIFIED: codebase]
   - Recommendation: Planner should add a tiny helper and test it; verify current Vite/Tauri environment behavior before wiring UI. [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Typecheck/test/build tooling | yes | v24.15.0 | none needed. [VERIFIED: shell] |
| pnpm | Monorepo scripts | yes | 10.27.0 | none; use pnpm per project memory/instructions. [VERIFIED: shell] |
| npm registry access | Version audit only | yes | npm 11.12.1 | Do not install new packages; use pinned deps. [VERIFIED: shell] |
| Tauri runtime/plugins | Native save dialog/fs in app runtime | not probed by running app | installed deps in package.json | Browser Blob download fallback exists for save JSON. [VERIFIED: codebase] |
| Browser FileReader/Blob APIs | Browser fallback save/load | available in target browser runtime | native | Tauri plugins where available. [VERIFIED: codebase] |

**Missing dependencies with no fallback:** none identified for planning. [VERIFIED: shell]  
**Missing dependencies with fallback:** Tauri runtime availability was not runtime-probed because the project instruction says not to run the server/app; browser fallback exists for current JSON save. [VERIFIED: CLAUDE.md]

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest installed as `^2.1.9` in root `package.json`; npm latest is 4.1.8. [VERIFIED: codebase] |
| Config file | `/Users/lmarques/Dev/efx-motion-editor/app/vitest.config.ts` includes `src/**/*.test.ts`. [VERIFIED: codebase] |
| Quick run command | `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app vitest run src/types/physicPaint.test.ts src/stores/physicPaintStore.test.ts src/lib/physicPaintBridge.test.ts` [VERIFIED: codebase] |
| Full suite command | `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app vitest run` [VERIFIED: codebase] |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-REBUILD-01 | Layout/action mapping preserves tools/settings/save/load/play/apply actions | component/unit helper tests plus manual UI | `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app vitest run src/components/physic-paint/*.test.ts` | Wave 0 gap |
| UI-REBUILD-02 | Standalone-first bridge remains rendered-output-only and no editor integration scope added | unit | `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app vitest run src/lib/physicPaintBridge.test.ts` | yes |
| SAVE-01 | Save state serializes `engine.save()` JSON and fallback/native paths are selected | unit helper | `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app vitest run src/components/physic-paint/physicsPaintSessionFile.test.ts` | Wave 0 gap |
| SAVE-02 | Load state validates `SerializedProject` and calls `engine.load()` | unit helper | `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app vitest run src/components/physic-paint/physicsPaintSessionFile.test.ts src/types/physicPaint.test.ts` | partial |
| OUT-01 | Still export uses PNG data URL and correct frame metadata | unit helper / manual smoke | `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app vitest run src/components/physic-paint/physicsPaintDevExport.test.ts` | Wave 0 gap |
| OUT-02 | Frame-sequence manifest maps frameIndex/appFrame/files and preserves canvas dimensions | unit helper | `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app vitest run src/components/physic-paint/physicsPaintDevExport.test.ts` | Wave 0 gap |

### Sampling Rate
- **Per task commit:** `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app vitest run <changed-test-file>` [VERIFIED: codebase]
- **Per wave merge:** `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app vitest run` plus `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app typecheck` or root `pnpm build` if package changes require it. [VERIFIED: codebase]
- **Phase gate:** Full app Vitest suite and typecheck/build green before `/gsd-verify-work`; do not run dev server. [VERIFIED: CLAUDE.md]

### Wave 0 Gaps
- [ ] `app/src/components/physic-paint/physicsPaintSessionFile.test.ts` — covers SAVE-01/SAVE-02 extracted save/load helpers. [VERIFIED: codebase]
- [ ] `app/src/components/physic-paint/physicsPaintDevExport.test.ts` — covers OUT-01/OUT-02 manifest/still export helpers. [VERIFIED: codebase]
- [ ] `app/src/components/physic-paint/physicsPaintWorkflowState.test.ts` — covers UI mode switching, destructive confirmation predicates, dev-mode gate predicates. [ASSUMED]
- [ ] Component smoke/manual checklist for left rail icons, top bar controls, right panel options, bottom strip workflows because current Vitest config does not show a component testing setup. [VERIFIED: codebase]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth/session system in this standalone UI phase. [VERIFIED: codebase] |
| V3 Session Management | no | Saved paint session is local JSON file, not authenticated web session. [VERIFIED: codebase] |
| V4 Access Control | limited | Keep Tauri fs scope and dialog-selected paths; do not write arbitrary paths without user selection. [CITED: https://v2.tauri.app/reference/javascript/fs/] |
| V5 Input Validation | yes | Validate loaded `SerializedProject` and apply payloads before engine/store mutation. [VERIFIED: codebase] |
| V6 Cryptography | no | No cryptographic operations required. [VERIFIED: codebase] |

### Known Threat Patterns for Preact/Tauri local file UI

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed JSON session load causes runtime crash or bad engine state | Tampering / Denial of Service | Keep `isSerializedProject` validation before `engine.load()` and show user-facing error. [VERIFIED: codebase] |
| Oversized debug frame export freezes UI | Denial of Service | Keep `clampPhysicPaintFrameCount` max 600 and consider a smaller dev-export confirmation for large ranges. [VERIFIED: codebase] |
| Arbitrary filesystem writes | Elevation of Privilege / Tampering | Use Tauri `save()` dialog result and `writeTextFile`; Tauri fs scope rules restrict file access. [CITED: https://v2.tauri.app/reference/javascript/dialog/] |
| XSS through manifest/session file names or status text | Spoofing / Tampering | Render text via Preact text nodes, avoid `dangerouslySetInnerHTML`, sanitize generated file names. [ASSUMED] |
| Invalid apply payload mutates editor cache | Tampering | Existing bridge calls `isPhysicPaintApplyPayload` before store mutation and rejects forbidden fields such as `engine`/`internals`. [VERIFIED: codebase] |

## Sources

### Primary (HIGH confidence)
- `/Users/lmarques/Dev/efx-motion-editor/CLAUDE.md` — project instructions. [VERIFIED: codebase]
- `/Users/lmarques/Dev/efx-motion-editor/.planning/phases/36-physics-paint-ui-rebuild-session-persistence-and-output-proo/36-CONTEXT.md` — locked Phase 36 decisions. [VERIFIED: CONTEXT.md]
- `/Users/lmarques/Dev/efx-motion-editor/.planning/REQUIREMENTS.md` — v0.8.0 requirements and exclusions. [VERIFIED: REQUIREMENTS.md]
- `/Users/lmarques/Dev/efx-motion-editor/SPECS/physics-paint-ui/ui-connection-phase-36.md` — old/new UI mapping and anchors. [VERIFIED: codebase]
- `/Users/lmarques/Dev/efx-motion-editor/SPECS/physics-paint-ui/ui-feature-phase-36-and-more.md` — source lane/save behavior concepts. [VERIFIED: codebase]
- `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.tsx` — current engine/apply/play lifecycle. [VERIFIED: codebase]
- `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudioToolbar.tsx` — current controls and JSON save/load. [VERIFIED: codebase]
- `/Users/lmarques/Dev/efx-motion-editor/app/src/types/physicPaint.ts` — launch/apply contracts and validation. [VERIFIED: codebase]
- `/Users/lmarques/Dev/efx-motion-editor/app/src/stores/physicPaintStore.ts` — rendered frames/editable state store. [VERIFIED: codebase]
- `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/types.ts` — `SerializedProject` shape. [VERIFIED: codebase]
- `/Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint/src/animation/AnimationPlayer.ts` — live engine frame playback/capture. [VERIFIED: codebase]
- `npm view` and `package-legitimacy` seam — package version/legitimacy audit. [VERIFIED: npm registry]

### Secondary (MEDIUM/LOW confidence)
- Preact hooks guide — `useState`, `useRef`, `useEffect`, `useCallback`, JSX event handler patterns. [CITED: https://preactjs.com/guide/v10/hooks/]
- Tauri v2 dialog reference — `save()` returns selected path or null and accepts filters/defaultPath. [CITED: https://v2.tauri.app/reference/javascript/dialog/]
- Tauri v2 fs reference — `writeTextFile` and fs scope constraints. [CITED: https://v2.tauri.app/reference/javascript/fs/]
- Vitest config docs — `vitest.config.ts` config precedence and `test` options. [CITED: https://vitest.dev/config/]

### Tertiary (LOW confidence)
- General UX/implementation assumptions in the Assumptions Log, marked `[ASSUMED]` inline. [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — based on existing package files, code imports, and npm/version audit; no new packages recommended. [VERIFIED: codebase]
- Architecture: HIGH — based on current component/store/bridge/package source and locked Phase 36 context. [VERIFIED: codebase]
- Pitfalls: HIGH for codebase-specific pitfalls, LOW for general UX assumptions. [VERIFIED: codebase]

**Research date:** 2026-06-12  
**Valid until:** 2026-07-12 for codebase-specific architecture; 2026-06-19 for npm latest-version/package audit because JS tooling moves quickly. [ASSUMED]
