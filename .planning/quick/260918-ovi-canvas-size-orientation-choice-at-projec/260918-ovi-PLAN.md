---
phase: quick-260918-ovi
plan: 260918-ovi
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/project/canvasFormatPresets.ts
  - app/src/components/project/canvasFormatPresets.test.ts
  - app/src/components/project/NewProjectDialog.tsx
  - app/src/stores/projectStore.ts
  - app/src/stores/projectStore.test.ts
  - app/src/stores/projectStore.efxPaintCutover.test.ts
  - app/src/lib/ipc.ts
  - app/src-tauri/src/commands/project.rs
  - app/src/stores/sequenceStore.ts
  - app/src/stores/sequenceStore.test.ts
  - app/src/components/physic-paint/engine/physicsPaintCanvasSizing.test.ts
  - app/src/lib/exportEngine.test.ts
  - app/src/components/views/SettingsView.tsx
  - app/src/components/views/SettingsView.test.tsx
autonomous: true
requirements: []
estimate:
  tokens: 55000
  raw_tokens: 48000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - "At project creation the user picks one of four platform-verified presets (HD 1920x1080 default, HD Vertical 1080x1920, Portrait 1080x1350, Square 1080x1080) or a Custom W x H with each side clamped to [16, 1920], and the project boots at exactly those dims."
    - "The chosen dims travel dialog -> projectStore.createProject -> projectCreate IPC -> Rust project_create -> MceProject -> store signals -> manifest, with no site manufacturing 1920x1080."
    - "Sequences created after project creation stamp the project dims (not 1920x1080) into their persisted record, via provider injection from projectStore (no circular import)."
    - "Save and reopen round-trips the chosen dims through the package manifest unchanged, for every preset and for a custom size."
    - "SettingsView's post-creation resolution editor offers the same preset set (no 4K option); its long edge can never exceed 1920."
    - "Physics working size, export sizing, compositor buffers, Studio canvas, and every render/export surface stay data-driven against projectStore.width/height with zero surviving fixed-ratio assumptions in the four audited sites."
  artifacts:
    - app/src/components/project/canvasFormatPresets.ts — shared preset table + clampCustomSize + type definitions (single source of truth for dialog and SettingsView)
    - app/src/components/project/canvasFormatPresets.test.ts — preset table contract, clamp bounds, custom-size validation
    - app/src/components/project/NewProjectDialog.tsx — preset pill + Custom branch with two NumericSteppers; new state via signals only (efx-preact-reactivity)
    - app/src/stores/projectStore.ts — createProject signature gains width/height; wires _setSequenceProjectDimensionsProvider at module init
    - app/src/lib/ipc.ts — projectCreate(name, fps, dirPath, width, height)
    - app/src-tauri/src/commands/project.rs — project_create accepts width/height: u32 with 1..=1920 sanity clamp; returns them verbatim
    - app/src/stores/sequenceStore.ts — _setSequenceProjectDimensionsProvider + createSequence/createFxSequence/createContentOverlaySequence read provider dims
    - app/src/components/views/SettingsView.tsx — COMMON_RESOLUTIONS deleted; consumes shared preset table; current custom size still renders as fallback option
    - app/src/components/views/SettingsView.test.tsx — source-scan contract (no 3840, no 4K literal, consumes shared helper)
    - app/src/stores/projectStore.test.ts — createProject threading + manifest round-trip with non-default dims
    - app/src/stores/projectStore.efxPaintCutover.test.ts — the three existing positional createProject callers (:1310, :1321, :1333) updated to explicit HD dims (1920, 1080) so the 5-arg signature keeps `tsc --noEmit` green; assertions unchanged
    - app/src/stores/sequenceStore.test.ts — provider-injection law + three factories stamp provider dims
    - app/src/components/physic-paint/engine/physicsPaintCanvasSizing.test.ts — identity at 1080x1920, 1080x1350, 1080x1080; downscale at 1081x1921
    - app/src/lib/exportEngine.test.ts — export sizing follows mocked vertical dims
  key_links:
    - "NewProjectDialog.handleCreate -> projectStore.createProject(name, fps, dirPath, width, height) -> ipc.projectCreate(name, fps, dirPath, width, height) -> Rust project_create(app, name, fps, dir_path, width, height) -> MceProject{width, height, ..} -> batch {width.value = result.data.width; height.value = result.data.height}."
    - "projectStore module init: _setSequenceProjectDimensionsProvider(() => ({width: width.value, height: height.value})) — the same module-body init pattern as _setMarkDirtyCallback (projectStore.ts:1060) and _setPhysicPaintCompositorSizeProvider (projectStore.ts:1082); sequenceStore never imports projectStore."
    - "canvasFormatPresets.PRESETS consumed by NewProjectDialog (creation choice) AND SettingsView (post-creation editor) — one shared table, so the 4K option cannot silently reappear in one surface while the other stays clamped."
    - "NumericStepper clampToStep (renderer, per-emit) + Rust project_create sanity clamp (1..=1920 per side, defense-in-depth) — two independent bounds on the only path that lets the user reach a Rust command parameter that sizes canvas allocations."
---

<objective>
Add a canvas-format choice at project creation so users can pick HD 1920x1080 (default), HD Vertical 1080x1920 (Story / Reels / Shorts), Portrait 1080x1350 (4:5 Post), Square 1080x1080 (1:1), or a Custom W x H clamped to a 1920 long edge — and guarantee every width/height consumer in the app renders/exports correctly at any reachable ratio.

Today: `NewProjectDialog` never asks for canvas size; Rust `project_create` hardcodes 1920x1080 (app/src-tauri/src/commands/project.rs:54-55); three `sequenceStore` factories stamp 1920x1080 into every new sequence record (app/src/stores/sequenceStore.ts:108-109, :236-237, :267-268); SettingsView's resolution select offers a 4K option that escapes the locked HD cap (app/src/components/views/SettingsView.tsx:5-9). The 2026-09-18 audit verified every other read site (export engine, compositor, preview, Studio canvas, fullscreen, paint overlays, launch context) is already data-driven against `projectStore.width/height` — zero structural fixed-ratio surgery, escalation clause does not fire.

Decisions implemented (from 260918-ovi-CONTEXT.md):
- D-preset-set: HD 1920x1080 (16:9, YouTube classic, default) / HD Vertical 1080x1920 (9:16, Story / Reels / Shorts, Instagram / Facebook / YouTube / TikTok) / Portrait 1080x1350 (4:5, Post Instagram / Facebook) / Square 1080x1080 (1:1, Post fallback) / Custom… — English labels with platform annotations.
- D-control: segmented pill preferred (consistency with FPS row); Custom entry uses the Phase 52.2 NumericStepper verbatim (`- [field] +`), step=1, integer, sane minimum per side (16 px — discretion), long edge clamped to 1920.
- D-audit: every width/height read site is data-driven (audit already verified); the four point-fix sites are the only edits.
- D-settings-cap: SettingsView drops the 4K preset and clamps to the 1920 long edge (locked 2026-09-18).

Threading model: Research Finding 3 Option A (IPC threading) — dims are born correct at the source. The store's signal adoption at projectStore.ts:786-791 (`width.value = result.data.width`) means the manifest build at :388-389 and hydrate at :449-450 already round-trip any returned dims; no manifest schema change.

Purpose: unlock vertical + portrait + square authoring for the platform mix users actually deliver to in 2026, without breaking the data-driven render pipeline the audit verified.
Output: threaded dims plumbing, preset/custom UI in the creation dialog, SettingsView aligned to the same preset table, and a test surface proving persistence, physics scale, and the no-16:9-assumption law.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260918-ovi-canvas-size-orientation-choice-at-projec/260918-ovi-CONTEXT.md
@.planning/quick/260918-ovi-canvas-size-orientation-choice-at-projec/260918-ovi-RESEARCH.md
@app/src/components/project/NewProjectDialog.tsx
@app/src/components/shared/NumericStepper.tsx
@app/src/stores/projectStore.ts
@app/src/stores/sequenceStore.ts
@app/src/lib/ipc.ts
@app/src/components/views/SettingsView.tsx
@app/src/components/physic-paint/engine/physicsPaintCanvasSizing.ts
@app/src-tauri/src/commands/project.rs

Verified code facts (2026-09-18, from 260918-ovi-RESEARCH.md — all citations verified in-repo):
- F1 hardcode: `app/src-tauri/src/commands/project.rs:54-55` — `width: 1920, height: 1080` in `project_create`'s returned MceProject.
- F2/F3/F4 hardcodes: `app/src/stores/sequenceStore.ts:108-109, :236-237, :267-268` — same literal in `createSequence`, `createFxSequence`, `createContentOverlaySequence`. Sequence width/height are read in exactly ONE place (manifest serialize `projectStore.ts:220-221`, hydrate `:537-538`); no renderer reads them. The fix keeps the manifest honest.
- F5 SettingsView: `app/src/components/views/SettingsView.tsx:5-9` — COMMON_RESOLUTIONS includes `{label: '3840x2160 (4K)', w: 3840, h: 2160}`; select writes via `projectStore.setResolution(w, h)` (projectStore.ts:742-746), so the fix is just the preset list.
- Provider-injection precedent: `_setMarkDirtyCallback` wired at `projectStore.ts:1060` and `_setPhysicPaintCompositorSizeProvider` at `:1082` — both work around the ESM module-body cycle (sequenceStore / physicPaintStore cannot import projectStore). The new `_setSequenceProjectDimensionsProvider` uses the same pattern, wired alongside them at module init.
- createProject current signature: `projectStore.ts:763` — `async createProject(projectName: string, projectFps: number, projectDirPath: string)`. Caller: `NewProjectDialog.tsx:58`. Existing test callers use positional args (`projectStore.efxPaintCutover.test.ts:1310, :1321, :1333` — the only other callers repo-wide, verified 2026-09-18); keep positional and append `width, height` (Claude's discretion — no options-object refactor). Those three call sites are updated to explicit HD dims in Task 1 GREEN step 8, and the file is in this plan's scope.
- IPC wrapper: `app/src/lib/ipc.ts:46-48` — `projectCreate(name, fps, dirPath)` -> `safeInvoke<MceProject>('project_create', {name, fps, dirPath})`. Tauri auto-camelCases JS args to snake_case Rust params.
- Rust signature: `app/src-tauri/src/commands/project.rs:30-35` — `pub fn project_create(app: tauri::AppHandle, name: String, fps: u32, dir_path: String) -> Result<MceProject, String>`. Add `width: u32, height: u32` and a sanity clamp `width.clamp(1, 1920)` / `height.clamp(1, 1920)` before constructing MceProject (defense-in-depth, ASVS V5).
- NumericStepper contract: `app/src/components/shared/NumericStepper.tsx:28-58` — controlled component, `value`/`onChange`/`step`/`min`/`max`/`ariaLabel`; clamp+snap on every emission via `clampToStep` (`:70-76`); integer mode at `step >= 1`; hold-to-repeat 400ms/60ms. Custom entry: two steppers, `step={1}`, `min={16}`, `max={1920}` on each field — clamping each side to ≤1920 makes the long-edge constraint hold structurally.
- NewProjectDialog uses `useState` for name/fps/dirPath (pre-existing, lines 12-16). Project rule ("No useState — Preact signals only", efx-preact-reactivity skill) applies to NEW state only: preset selection + custom W/H signals are mandatory; existing useState fields stay untouched (out of scope to refactor).
- Physics sizing law (legit constant, do not touch): `PHYSICS_PAINT_WORKING_LONG_EDGE = 1920` (`physicsPaintCanvasSizing.ts:3`) with `scale = Math.min(1, 1920 / Math.max(w, h))` — orientation-agnostic by design. This IS the long-edge clamp enforcement for physics.
- Legit constants NOT to touch: `DEFAULT_PHYSICS_PAINT_CANVAS_WIDTH/HEIGHT = 1000/650` (degenerate fallback only); `FALLBACK_COMPOSITE_SIZE = {1920, 1080}` in `physicPaintStore.ts:452` (test-only fallback); stylesheet `aspect-ratio: 1000/650` in `physicsPaintStudio.css:56` (pre-JS fallback); `PREVIEW_WIDTH/HEIGHT` in `ShaderBrowser.tsx` (fixed shader-preview cards, 8:5 not 16:9); `aspect-ratio: 4/3` in background picker tile (fixed UI grid); `window.open(width=1280,height=900)` in `physicPaintBridge.ts:3489` (Studio OS window chrome); test fixtures (may keep 16:9 fixtures); `project.meta` (Motion Canvas scaffold, dead).
- Test command convention: `pnpm --filter efx-motion-editor exec vitest run <paths>` — never watch mode (project rule).
- Existing test patterns: `projectStore.test.ts` `describe('AUDIO-07: buildMceProject')` (:85+) and `describe('AUDIO-07: hydrateFromMce')` (:171+) with `makeMinimalMceProject` factory; `physicsPaintCanvasSizing.test.ts` has 4 existing cases; `exportEngine.test.ts` mocks projectStore at :62-63 with `{peek: () => 4, value: 4}` shape; `sequenceStore.test.ts` exists (14 kB).
- Existing dialog failure contract: NewProjectDialog handleCreate routes failures through `showProjectIoFailureDialog('save', err)` (quick-260913-05k round 3) — do not regress; the dialog is unmounted by `closeProject` before a create/save failure surfaces, so inline setError renders nowhere.
</context>

<tasks>

<task type="tracer">
  <name>Task 1 (tracer, RED-first): HD Vertical 1080x1920 threads end-to-end — dialog preset pill, store signature, IPC, Rust, sequence factories, manifest round-trip</name>
  <files>app/src/components/project/canvasFormatPresets.ts, app/src/components/project/canvasFormatPresets.test.ts, app/src/components/project/NewProjectDialog.tsx, app/src/stores/projectStore.ts, app/src/lib/ipc.ts, app/src-tauri/src/commands/project.rs, app/src/stores/sequenceStore.ts, app/src/stores/sequenceStore.test.ts, app/src/stores/projectStore.test.ts, app/src/stores/projectStore.efxPaintCutover.test.ts, app/src/components/physic-paint/engine/physicsPaintCanvasSizing.test.ts, app/src/lib/exportEngine.test.ts</files>
  <behavior>
    End-to-end tracer — one vertical preset (HD Vertical 1080x1920) chosen in the dialog produces a project whose store signals, manifest bytes, and derived sequence records all carry 1080x1920, with physics working size and export sizing following.

    RED cases — write first, run, capture the failures (each names a missing module/signature/behavior, never a tautology):

    New `app/src/components/project/canvasFormatPresets.test.ts` — `describe('canvasFormatPresets (260918-ovi)')`, importing from `'./canvasFormatPresets'` (module does not exist — the import failure is the RED signal):
    - "exports the HD and HD Vertical presets with platform annotations": `CANVAS_FORMAT_PRESETS` contains an entry `{id: 'hd', width: 1920, height: 1080}` with a label containing `'HD'` and `'1920x1080'` and `'16:9'` and `'YouTube'`; and an entry `{id: 'hd-vertical', width: 1080, height: 1920}` whose label contains `'HD Vertical'`, `'1080x1920'`, `'9:16'`, `'Story'`, `'Reels'`, `'Shorts'`.
    - "the default preset is HD": `DEFAULT_CANVAS_FORMAT_PRESET_ID === 'hd'`.
    - "clampCustomSize clamps each side to [16, 1920]": `clampCustomSize(8, 5000)` returns `{width: 16, height: 1920}`; `clampCustomSize(1080, 1920)` returns the input unchanged; `clampCustomSize(1920, 1920)` returns `{1920, 1920}`; non-integer input is rounded.

    Extend `app/src/stores/projectStore.test.ts` (in the `AUDIO-07: buildMceProject` and `AUDIO-07: hydrateFromMce` describes, using the existing `makeMinimalMceProject` factory):
    - "buildMceProject round-trips non-default dims": set `projectStore.width.value = 1080; projectStore.height.value = 1920;` then `buildMceProject()` returns an object with `width: 1080, height: 1920` (passes today — pins the law).
    - "hydrateFromMce restores vertical dims": hydrate a `makeMinimalMceProject({width: 1080, height: 1920})` fixture; assert `projectStore.width.value === 1080` and `projectStore.height.value === 1920` (passes today — pins the law).
    - New `describe('createProject threading (260918-ovi)')`: with the existing IPC mock pattern, call `await projectStore.createProject('Fresh', 24, '/projects/Fresh.mce', 1080, 1920)`; assert the mocked `projectCreate` IPC was called with `( 'Fresh', 24, '/projects/Fresh.mce', 1080, 1920 )`; assert the store adopted the returned dims. RED today because the signature takes only 3 args.

    Extend `app/src/stores/sequenceStore.test.ts`:
    - New `describe('sequence factory project dims (260918-ovi)')`: call the exported `_setSequenceProjectDimensionsProvider(() => ({width: 1080, height: 1920}))` (does not exist — RED), then `sequenceStore.createSequence('S')` returns a record with `width: 1080, height: 1920`; same for `createFxSequence('F', layer, 100)` and `createContentOverlaySequence('O', layer, 100)`. Include a cleanup that restores the default provider in `afterEach` so sibling describes are not polluted.

    Extend `app/src/components/physic-paint/engine/physicsPaintCanvasSizing.test.ts` (existing 4-case describe):
    - "1080x1920 vertical is identity": `getPhysicsPaintWorkingSize(1080, 1920)` returns `{width: 1080, height: 1920}` (max edge = 1920 = cap → scale 1; passes today — pins the law for vertical).
    - "1080x1350 portrait and 1080x1080 square are identity": both return their inputs (passes today — pins the law).
    - "1081x1921 downscales to the 1920 long edge": result has `Math.max(width, height) === 1920` and the other side is `Math.round(1081 * (1920/1921))` (passes today — pins the cap behavior).

    Extend `app/src/lib/exportEngine.test.ts` (existing projectStore mock at :62-63):
    - "export sizing follows vertical project dims": change the mock to `width: {peek: () => 1080, value: 1080}, height: {peek: () => 1920, value: 1920}`; assert the export width/height math (the existing `exportWidth/exportHeight` surface) reflects 1080x1920 x the resolution multiplier (passes today — pins the data-driven law).

    GREEN implementation — minimum to flip the RED cases, keeping HD + HD Vertical only:

    1. Create `app/src/components/project/canvasFormatPresets.ts`: export `CANVAS_FORMAT_PRESET_IDS` union, `CanvasFormatPreset` interface `{id, width, height, label}`, `CANVAS_FORMAT_PRESETS: readonly CanvasFormatPreset[]` with the HD + HD Vertical entries (Portrait/Square land in Task 2), `DEFAULT_CANVAS_FORMAT_PRESET_ID = 'hd'`, and `clampCustomSize(width: number, height: number): {width: number; height: number}` that rounds and clamps each side to `[16, 1920]` (export the bounds as `CUSTOM_CANVAS_FORMAT_MIN_SIDE = 16` and `CUSTOM_CANVAS_FORMAT_MAX_SIDE = 1920` so the dialog and the contract test share them).

    2. `app/src-tauri/src/commands/project.rs`: change `project_create` signature to `pub fn project_create(app: tauri::AppHandle, name: String, fps: u32, dir_path: String, width: u32, height: u32) -> Result<MceProject, String>`; before constructing MceProject, clamp `let width = width.clamp(1, 1920); let height = height.clamp(1, 1920);` with a brief comment citing defense-in-depth (ASVS V5) and the renderer's NumericStepper clamp as the primary bound. Return `MceProject { .., width, height, .. }` — the F1 literal at :54-55 disappears.

    3. `app/src/lib/ipc.ts`: change `projectCreate` signature to `(name: string, fps: number, dirPath: string, width: number, height: number)` and pass `{name, fps, dirPath, width, height}` to `safeInvoke`.

    4. `app/src/stores/projectStore.ts`: change `createProject` signature to `(projectName: string, projectFps: number, projectDirPath: string, width: number, height: number)`; pass `width, height` to `projectCreate` at :771. The batch block at :786-791 already adopts `result.data.width/height` — no change needed there.

    5. `app/src/stores/sequenceStore.ts`: at module scope next to `_markDirty`, add `let _projectDimensionsProvider: (() => {width: number; height: number}) | null = null;` and `export function _setSequenceProjectDimensionsProvider(fn: () => {width: number; height: number}) { _projectDimensionsProvider = fn; }`. Add a private `function getProjectDimensions(): {width: number; height: number}` that returns `_projectDimensionsProvider?.() ?? {width: 1920, height: 1080}` (fallback matches the boot default; the provider is always wired in production at module init). In `createSequence` (:108-109), `createFxSequence` (:236-237), and `createContentOverlaySequence` (:267-268), replace the literal `width: 1920, height: 1080` with a spread of `getProjectDimensions()` — `...getProjectDimensions(),` placed so `width` and `height` land on the new Sequence record.

    6. `app/src/stores/projectStore.ts` module init: at the existing provider-wiring block (after `_setMarkDirtyCallback` at :1060), add `_setSequenceProjectDimensionsProvider(() => ({width: width.value, height: height.value}));` with a comment referencing the 260918-ovi quick and the circular-import pattern. Import `_setSequenceProjectDimensionsProvider` from `./sequenceStore` alongside the existing `_setMarkDirtyCallback` import at :11.

    7. `app/src/components/project/NewProjectDialog.tsx`: add a signals-only preset section between FPS and Location. Import `signal` from `@preact/signals` at module scope (per efx-preact-reactivity — no `useState` for the new state). Create `const selectedPresetId = signal<CanvasFormatPresetId>(DEFAULT_CANVAS_FORMAT_PRESET_ID);` at module scope. Render a new `CANVAS FORMAT` label + a segmented pill matching the FPS row's styling (same `flex items-center gap-1 rounded-lg bg-(--color-bg-input) p-1 w-fit` container, same per-option `flex items-center rounded-md px-4 py-2 cursor-pointer transition-colors` + accent when active). Render one pill option per entry in `CANVAS_FORMAT_PRESETS` (currently two — HD and HD Vertical). In `handleCreate`, resolve `const preset = CANVAS_FORMAT_PRESETS.find(p => p.id === selectedPresetId.value) ?? CANVAS_FORMAT_PRESETS[0];` and call `projectStore.createProject(name.trim(), fps, packageDirPath, preset.width, preset.height);`. Do not refactor the existing `useState` fields (out of scope).

    8. `app/src/stores/projectStore.efxPaintCutover.test.ts`: the three pre-existing positional callers (`createProject('Fresh', 24, '/projects/Fresh.mce')` at :1310, :1321, :1333 — verified the only other callers repo-wide) raise TS2554 against the new 5-required-arg signature. Append the explicit HD dims at each site — `createProject('Fresh', 24, '/projects/Fresh.mce', 1920, 1080)` — keeping positional style per the context-section decision (no options-object refactor). Do NOT make the new params optional-with-defaults: that reintroduces the "site manufactures 1920x1080 by default" failure mode (F1) this quick exists to eliminate. The suite's `ipcProjectCreate` mock (:71, wired at :119) is a `vi.fn()` — arg-count agnostic, no mock change needed; the tests' assertions (path registration, save-refusal rollback) are untouched and must stay green.
  </behavior>
  <action>
    Order: (a) write every RED test surface above and run the targeted vitest command — capture the RED proof verbatim (module-not-found for canvasFormatPresets, type errors for the new signatures, provider-not-a-function for sequenceStore); (b) implement the GREEN steps in the numbered order (Rust first so `cargo check` gates the signature change, then IPC, then store, then sequenceStore, then helper module, then dialog UI, then the efxPaintCutover call-site updates in step 8); (c) re-run the targeted command — all cases pass; (d) run `cd /Users/lmarques/Dev/efx-motion-editor/app/src-tauri && cargo check` to prove the Rust signature change compiles; (e) run `pnpm --filter efx-motion-editor exec tsc --noEmit` to prove the TS signature chain is consistent — step 8 is what makes this gate reachable: without it the three pre-existing callers fail TS2554. Commit as two atomic commits — `test(260918-ovi): RED — vertical preset threading` after step (a), then `feat(260918-ovi): thread canvas format through create flow` after step (e). Do not touch SettingsView in this task (Task 3 owns it). Do not add Portrait/Square/Custom to the preset table (Task 2 owns them).
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor && pnpm --filter efx-motion-editor exec vitest run src/components/project/canvasFormatPresets.test.ts src/stores/projectStore.test.ts src/stores/projectStore.efxPaintCutover.test.ts src/stores/sequenceStore.test.ts src/components/physic-paint/engine/physicsPaintCanvasSizing.test.ts src/lib/exportEngine.test.ts && cd app/src-tauri && cargo check && cd ../.. && pnpm --filter efx-motion-editor exec tsc --noEmit</automated>
  </verify>
  <done>RED proof captured verbatim in the SUMMARY (module-not-found for canvasFormatPresets, signature mismatch for createProject/projectCreate, missing _setSequenceProjectDimensionsProvider). All targeted vitest cases pass: preset helper, store threading + manifest round-trip at 1080x1920, sequence factories stamping provider dims, physics identity at 1080x1920/1080x1350/1080x1080 + downscale at 1081x1921, export sizing following mocked vertical dims. `cargo check` and `tsc --noEmit` both clean — reachable because the three efxPaintCutover call sites now pass explicit `1920, 1080` and keep their existing assertions green. Rust project_create no longer carries the `width: 1920, height: 1080` literal; sequenceStore's three factories no longer carry it either; the dialog has a working HD/HD Vertical pill that drives createProject with the chosen dims.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Portrait + Square presets and the Custom… entry with two NumericSteppers</name>
  <files>app/src/components/project/canvasFormatPresets.ts, app/src/components/project/canvasFormatPresets.test.ts, app/src/components/project/NewProjectDialog.tsx</files>
  <behavior>
    Extend `canvasFormatPresets.test.ts`:
    - "exports Portrait and Square presets with platform annotations": `CANVAS_FORMAT_PRESETS` contains `{id: 'portrait', width: 1080, height: 1350}` with a label containing `'Portrait'`, `'1080x1350'`, `'4:5'`, `'Post'`; and `{id: 'square', width: 1080, height: 1080}` with a label containing `'Square'`, `'1080x1080'`, `'1:1'`, `'Post fallback'`.
    - "preset order is hd, hd-vertical, portrait, square": the array's `id` sequence equals `['hd', 'hd-vertical', 'portrait', 'square']`.
    - "CUSTOM_CANVAS_FORMAT_MIN_SIDE is 16 and CUSTOM_CANVAS_FORMAT_MAX_SIDE is 1920": both constants exported with those values.

    Extend the dialog surface (source-scan or component-test — pick whichever the existing dialog test precedent supports; there is no existing NewProjectDialog test, so a component-render test using the same harness as `NumericStepper.test.tsx` is acceptable, or a source-scan contract):
    - "Custom… branch renders two NumericSteppers with step=1, min=16, max=1920": when the Custom… pill option is active, the dialog renders two `NumericStepper` instances, one labelled for width and one for height, each receiving `step={1}`, `min={CUSTOM_CANVAS_FORMAT_MIN_SIDE}`, `max={CUSTOM_CANVAS_FORMAT_MAX_SIDE}`.
    - "Create with Custom… calls createProject with the clamped custom dims": with the Custom… branch active and the steppers set to 1500 x 2200 (via their onChange), clicking Create calls `projectStore.createProject` with `(name, fps, dirPath, 1500, 1920)` — the height is clamped by the stepper's own clampToStep at emission time, so the store receives the already-clamped value.

    Implementation:
    1. Extend `CANVAS_FORMAT_PRESETS` in `canvasFormatPresets.ts` with the Portrait and Square entries (order: hd, hd-vertical, portrait, square). Labels per D-preset-set: `'Portrait — 1080x1350 (4:5) · Post (Instagram / Facebook)'` and `'Square — 1080x1080 (1:1) · Post fallback'`.
    2. Add `CUSTOM_CANVAS_FORMAT_PRESET_ID = 'custom'` and a type union update so `selectedPresetId` can hold `'custom'`. The Custom… pill option is a fifth segment whose label is just `'Custom…'` (no dims).
    3. In `NewProjectDialog.tsx`: add module-scope signals `const customWidth = signal<number>(1920);` and `const customHeight = signal<number>(1080);` (sensible defaults matching HD). When `selectedPresetId.value === 'custom'`, render a `W x H` row beneath the pill with two `NumericStepper` instances: `value={customWidth.value} onChange={(v) => { customWidth.value = v; }}` and the height twin. Each gets `step={1}`, `min={CUSTOM_CANVAS_FORMAT_MIN_SIDE}`, `max={CUSTOM_CANVAS_FORMAT_MAX_SIDE}`, `ariaLabel='Custom width (px)'` / `'Custom height (px)'`. In `handleCreate`, branch: if preset id is `'custom'`, use `clampCustomSize(customWidth.value, customHeight.value)`; else use the preset dims. NumericStepper's `clampToStep` already bounds each emission to [16, 1920], so `clampCustomSize` is a defensive second pass.
    4. Keep all new state in module-scope signals; do not introduce `useState` (efx-preact-reactivity).
  </behavior>
  <action>
    RED first: extend `canvasFormatPresets.test.ts` with the new preset-table and constant cases (fails — module exports don't include them yet); add the dialog-surface cases in the harness the existing project supports (NumericStepper.test.tsx is the component-test precedent). Run and capture RED. GREEN: extend the preset table, add the custom-id union member, wire the Custom… branch in the dialog. Re-run targeted tests; then `pnpm --filter efx-motion-editor exec tsc --noEmit`. Commit: `feat(260918-ovi): add Portrait, Square, and Custom canvas formats`.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor && pnpm --filter efx-motion-editor exec vitest run src/components/project && pnpm --filter efx-motion-editor exec tsc --noEmit</automated>
  </verify>
  <done>CANVAS_FORMAT_PRESETS has the four fixed presets in the locked order with platform-annotated English labels; CUSTOM_MIN/MAX_SIDE constants are 16 and 1920; the dialog renders a 5-segment pill (HD / HD Vertical / Portrait / Square / Custom…); the Custom… branch renders two NumericSteppers with step=1, min=16, max=1920 and drives createProject with the clamped custom dims; all new state is in signals (zero new useState); targeted tests and tsc pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: SettingsView aligns to the shared preset table — 4K dropped, 1920 long-edge cap enforced</name>
  <files>app/src/components/views/SettingsView.tsx, app/src/components/views/SettingsView.test.tsx, app/src/components/project/canvasFormatPresets.ts</files>
  <behavior>
    New `app/src/components/views/SettingsView.test.tsx` — source-scan contract (the SettingsView is a thin select over projectStore; a contract test is the right surface, mirroring the 260918-o0n TimelineInteraction region pattern):
    - "SettingsView consumes the shared preset table": the file imports `CANVAS_FORMAT_PRESETS` from `'../project/canvasFormatPresets'` (or the relative path that resolves).
    - "no 4K escape": the file does NOT contain the literal `'3840'`, `'2160'`, or `'4K'` (filtered to exclude comments — `grep -v '^\s*//'` before counting).
    - "no COMMON_RESOLUTIONS local table": the file does NOT declare `const COMMON_RESOLUTIONS`.
    - "current custom size still offered as a fallback option": the file retains a branch that, when the current project dims are not in the preset table, renders an extra `<option>` carrying the live `WxH` label (preserves today's UX for projects created outside the preset set).
    - "preset options call projectStore.setResolution with preset dims": the `onChange` handler resolves the chosen option against `CANVAS_FORMAT_PRESETS` and calls `projectStore.setResolution(preset.width, preset.height)`.

    Implementation:
    1. Delete the `COMMON_RESOLUTIONS` constant from `SettingsView.tsx` (lines 5-9).
    2. Import `CANVAS_FORMAT_PRESETS` from `'../project/canvasFormatPresets'`.
    3. Replace the `<select>`'s option source: map over `CANVAS_FORMAT_PRESETS` and render one `<option>` per preset with `value={preset.id}` (or `${preset.width}x${preset.height}` — discretion) and label `{preset.label}`.
    4. Retain the fallback branch: if the current project dims are not in the preset table, render an extra `<option>` with the live `${projectStore.width.value}x${projectStore.height.value}` label so the select always shows the project's current size.
    5. Update the `onChange` handler to resolve the chosen option against `CANVAS_FORMAT_PRESETS` and call `projectStore.setResolution(preset.width, preset.height)`; the fallback branch is a no-op onChange (it represents the current size).
  </behavior>
  <action>
    RED first: write `SettingsView.test.tsx` with the source-scan contract; run — fails on the 4K literal and the COMMON_RESOLUTIONS declaration. GREEN: refactor SettingsView per the implementation steps. Re-run; then the full SettingsView-adjacent suites and `tsc --noEmit`. Commit: `feat(260918-ovi): align SettingsView with the canvas format preset table`.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor && pnpm --filter efx-motion-editor exec vitest run src/components/views src/components/project && pnpm --filter efx-motion-editor exec tsc --noEmit</automated>
  </verify>
  <done>SettingsView.tsx no longer declares COMMON_RESOLUTIONS, contains no '3840'/'2160'/'4K' literal (comment-filtered), imports CANVAS_FORMAT_PRESETS from the shared helper, maps preset options from the shared table, retains the live-size fallback option for out-of-preset projects, and its onChange calls projectStore.setResolution with the preset dims. The source-scan contract is green; tsc is clean. Post-creation resolution can never exceed the 1920 long edge.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| renderer → Rust `project_create` | Custom W x H numbers cross from dialog state into a Tauri command parameter that sizes subsequent canvas allocations. The only new untrusted-input surface in this quick. |
| SettingsView select → `projectStore.setResolution` | Post-creation dims mutation; today it can escape the 52.1 HD cap via the 4K option. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-260918-ovi-01 | Tampering | Custom… NumericStepper → `projectStore.createProject` → `projectCreate` IPC → Rust `project_create` | medium | mitigate | Two independent bounds: (1) `NumericStepper.clampToStep` clamps every emission (button, hold-repeat, typed commit) to `[16, 1920]` per side at the renderer; (2) Rust `project_create` applies `width.clamp(1, 1920)` / `height.clamp(1, 1920)` defense-in-depth before constructing `MceProject`. u32 serde already rejects negative/huge values. ASVS V5 input validation. |
| T-260918-ovi-02 | Denial of service | Canvas allocation sized by attacker-controlled width/height | medium | mitigate | Same clamps as T-01 bound the allocation to ≤1920 per side (max ~3.7 Mpx RGBA ≈ 15 MB) — within the existing 52.1 HD working envelope. No new DoS surface beyond what HD already permits. |
| T-260918-ovi-03 | Tampering | SettingsView preset list could silently reintroduce a 4K option in a future edit | low | mitigate | `SettingsView.test.tsx` source-scan contract pins the absence of `'3840'`/`'2160'`/`'4K'` literals (comment-filtered) and the consumption of the shared `CANVAS_FORMAT_PRESETS` table — any regression fails the contract. |
| T-260918-ovi-04 | Integrity | Sequence factories stamping stale dims | low | mitigate | Provider is wired once at `projectStore` module init and reads live `width.value`/`height.value` at every factory call; the createProject batch updates signals before any user-driven sequence creation can run. Test pins the provider-stamping law for all three factories. |
| T-260918-ovi-SC | Tampering | pnpm installs | low | accept | No dependency changes in this quick — no package-legitimacy gate required. |
</threat_model>

<verification>
- RED proof: the SUMMARY carries the failing Task 1 / Task 2 / Task 3 RED run output verbatim (module-not-found for `canvasFormatPresets`, signature mismatch on the new `createProject`/`projectCreate`/`project_create` params, missing `_setSequenceProjectDimensionsProvider`, SettingsView 4K literal hits).
- Targeted gates (each task's `<verify>`): all pass after that task's GREEN.
- Rust: `cd app/src-tauri && cargo check` — clean (signature change compiles).
- Types: `pnpm --filter efx-motion-editor exec tsc --noEmit` — clean.
- Wider suite: `pnpm --filter efx-motion-editor exec vitest run` — 0 new failures; pre-existing red suites named per `.planning/STATE.md` Blockers (the 52.2-03 known-red list: roto persistence x7, base64ToBytes frame-transport token, efxPaintPersistence base64) are attributed, not silently absorbed. The full suite is long — background it and resume only on completion per the user's background-gates preference.
- Scope gate: `git diff --name-only` lists only the 14 files in this plan's frontmatter plus `.planning/` artifacts.
- Law check (read the diff, not grep): the F1/F2/F3/F4 literals are gone; `PHYSICS_PAINT_WORKING_LONG_EDGE`, `DEFAULT_PHYSICS_PAINT_CANVAS_WIDTH/HEIGHT`, `FALLBACK_COMPOSITE_SIZE`, shader-preview cards, stylesheet `aspect-ratio` fallbacks, `project.meta`, Studio OS window chrome, and test fixtures are untouched; no new `useState` in NewProjectDialog (all new state in signals).
</verification>

<human_verification>
Native UAT — OWED BY THE USER after execution; the executor must leave it pending and never claim it passed. Lands on the Phase 53 acceptance surface.
1. Create HD Vertical project: New Project → pick HD Vertical → Create. Expected: the main-editor canvas is 1080x1920 (vertical); the Studio canvas is vertical; export PNG produces 1080x1920 frames.
2. Save / reopen round-trip: paint a stroke in the Studio, save, close, reopen. Expected: project reopens at 1080x1920; the painted stroke is intact.
3. Custom size: New Project → Custom… → set 1200 x 1800 via steppers (click, hold-to-repeat, typed entry, Enter commit). Expected: project boots at 1200x1800; save/reopen preserves it.
4. Custom clamp: try to enter 2000 for height. Expected: the stepper clamps to 1920 on commit (typed or button).
5. SettingsView: open Settings on a 1080x1920 project. Expected: the resolution select offers the four presets (no 4K), shows HD Vertical selected; switching to Square changes the canvas to 1080x1080; switching back to HD Vertical restores.
6. Horizontal default unchanged: New Project → accept the HD default → Create. Expected: a 1920x1080 project, identical to today's behavior.
7. Sequence records: in a 1080x1920 project, add a sequence, an FX layer, and an imported overlay. Expected (manifest inspection): each sequence record's width/height is 1080/1920.
</human_verification>

<success_criteria>
- The four fixed presets (HD / HD Vertical / Portrait / Square) plus a Custom… entry are selectable at project creation, with the long edge clamped to 1920 by construction.
- `project_create` (Rust), `projectCreate` (IPC), `createProject` (store), and the three `sequenceStore` factories carry zero surviving `width: 1920, height: 1080` literals.
- SettingsView offers the same preset set with no 4K option; the source-scan contract pins it.
- Save/reopen round-trips any chosen dims through the package manifest (tested at 1080x1920 plus the preset table).
- Physics working size, export sizing, compositor, Studio canvas all follow project dims — pinned by the law tests at 1080x1920 / 1080x1350 / 1080x1080 and the 1081x1921 downscale.
- All targeted suites green, `cargo check` and `tsc --noEmit` clean, no file outside the plan's scope modified, native UAT left explicitly pending.
</success_criteria>

<output>
Create `.planning/quick/260918-ovi-canvas-size-orientation-choice-at-projec/260918-ovi-SUMMARY.md` when done (include the RED proofs, the law-pinning test list, and the pending native UAT rows).
</output>
