# Quick Task 260918-ovi: Canvas Size + Orientation Choice at Project Creation — Research

**Researched:** 2026-09-18
**Domain:** Project creation dialog, width/height data flow, render/export sizing
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Preset set (labels English, word + dimensions + platform annotation):**
  - HD — 1920×1080 (16:9) — default, current behavior (YouTube classic)
  - HD Vertical — 1080×1920 (9:16) · Story / Reels / Shorts (Instagram / Facebook / YouTube / TikTok)
  - Portrait — 1080×1350 (4:5) · Post (Instagram / Facebook)
  - Square — 1080×1080 (1:1) · Post fallback
  - Custom… — two W×H fields using the 52.2 stepper component (− [field] +), integers, sane minimum per side, long edge clamped to 1920 (52.1 HD cap; 2K stays v1.2.0), inline validation, steppers + keyboard
- **Control shape:** segmented pill preferred (consistency with FPS row); MAY become select/radio list — planner/executor discretion within dialog consistency.
- **Audit clause (NON-NEGOTIABLE):** every width/height read site must be data-driven; sweep for hardcoded 16:9 / 1920×1080 and fix each to read project dims. **ESCALATION CLAUSE:** structural fixed-ratio surgery (not point reads) → STOP and report; becomes an intermediate phase.
- **Tests:** preset persists through save/reopen (manifest round-trip); physics scale for both orientations; no surviving 16:9 assumption in audited sites; vitest run, never watch.
- **Native UAT (user-side):** create vertical project → paint in Studio → save → reopen → export PNG, both orientations.

### Claude's Discretion
- Exact control component (pill vs select/radio) within dialog consistency
- "Sane minimum per side" value for custom entry
- createProject signature shape (params vs options object)
- Internal plumbing of dims from dialog → store

### Deferred Ideas (OUT OF SCOPE)
- Platform safe-zone overlays
- 2K/4K project resolution (stays v1.2.0)
</user_constraints>

## Summary

The audit's headline: **the render/export pipeline is already fully data-driven.** Every surface that produces pixels — export engine, compositor buffers, preview, Studio canvas, fullscreen, paint overlays — reads `projectStore.width/height` (or receives dims derived from them through the launch context / size-provider injection). The only surviving hardcodes are (1) the **creation-time defaults** (`projectStore` signal init, `closeProject`/`reset`, Rust `project_create`), (2) **sequence-record defaults** in `sequenceStore` (three factory functions stamp 1920×1080 into every new sequence's persisted record — inert data, but a lie in the manifest), and (3) one UI surface (`SettingsView` resolution select, which offers 4K contrary to the HD cap). **No structural fixed-ratio surgery found — the escalation clause does not fire.** All finds are point reads.

**Primary recommendation:** Thread `width/height` from NewProjectDialog → `projectStore.createProject` → IPC `project_create` (Rust) so the dims are born correct; fix the three `sequenceStore` factories to read project dims via the codebase's established provider-injection pattern; reuse `NumericStepper` verbatim for the Custom… entry. No manifest schema change — `width`/`height` are already first-class `u32` fields on `MceProject` and round-trip today.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Preset/custom UI state | Browser (dialog component) | — | Local dialog state; must use signals, not useState (project rule) |
| Project dims authority | Renderer store (`projectStore` signals) | — | Single source of truth; manifest serialize/hydrate already wired |
| Manifest persistence | Rust (`project_create`, `project_save`) | Renderer IPC wrapper | Serde round-trips width/height as u32; `project_create` currently manufactures 1920×1080 |
| Physics working size | Renderer pure fn (`getPhysicsPaintWorkingSize`) | — | Orientation-agnostic by design (long-edge cap) |
| Export sizing | Renderer (`exportEngine`) | Rust FFmpeg receives sized frames | Already data-driven |

## Finding 1 — 16:9 / 1920×1080 Audit (LOAD-BEARING)

### FIX sites (hardcodes that must become data-driven)

| # | Site | What it does | Fix type |
|---|------|--------------|----------|
| F1 | `app/src-tauri/src/commands/project.rs:54-55` | `project_create` returns `MceProject` with hardcoded `width: 1920, height: 1080` [VERIFIED: app/src-tauri/src/commands/project.rs:50-55] — quote: `Ok(MceProject { version: 1, name, fps, width: 1920, height: 1080,` | Point: thread w/h params through IPC, or overwrite via `setResolution` before initial save |
| F2 | `app/src/stores/sequenceStore.ts:108-109` | `createSequence` stamps `width: 1920, height: 1080` into the new Sequence record [VERIFIED: app/src/stores/sequenceStore.ts:103-112] — quote: `const seq: Sequence = { id: genId(), kind: 'content', name, fps: 24, width: 1920, height: 1080, keyPhotos: [],` | Point: read project dims at creation. **Circular-import guard:** `projectStore` imports `sequenceStore` (projectStore.ts:1033), so use the codebase's provider-injection pattern (`_setMarkDirtyCallback` precedent in same file) or pass dims from callers |
| F3 | `app/src/stores/sequenceStore.ts:236-237` | `createFxSequence` same hardcode [VERIFIED: app/src/stores/sequenceStore.ts:231-242] — quote: `const seq: Sequence = { id: genId(), kind: 'fx', name, fps: 24, width: 1920, height: 1080, keyPhotos: [],` | Point: same mechanism as F2 |
| F4 | `app/src/stores/sequenceStore.ts:267-268` | `createContentOverlaySequence` same hardcode [VERIFIED: app/src/stores/sequenceStore.ts:262-273] — quote: `const seq: Sequence = { id: genId(), kind: 'content-overlay', name, fps: 24, width: 1920, height: 1080, keyPhotos: [],` | Point: same mechanism as F2 |
| F5 | `app/src/components/views/SettingsView.tsx:5-9` | `COMMON_RESOLUTIONS` offers only 16:9 landscape options including `3840x2160 (4K)` [VERIFIED: app/src/components/views/SettingsView.tsx:5-9] — quote: `const COMMON_RESOLUTIONS = [ {label: '1920x1080 (1080p)', w: 1920, h: 1080}, {label: '1280x720 (720p)', w: 1280, h: 720}, {label: '3840x2160 (4K)', w: 3840, h: 2160}, ];` | Open question (see Q1): post-creation resolution change escapes the HD cap and offers no vertical presets. Not a data-driven break (writes via `setResolution`) but contradicts the locked cap |

**F2–F4 impact note:** sequence `width`/`height` are read in exactly ONE place — manifest serialization (`projectStore.ts:220-221` `width: seq.width, height: seq.height,` [VERIFIED: app/src/stores/projectStore.ts:216-221]) and hydrated back at `:537-538`. No renderer reads them. The fix keeps the manifest honest; it is not load-bearing for rendering.

### Creation-default sites (LEGIT — defaults, overwritten at create/open; do not "fix")

| Site | Why it's fine |
|------|---------------|
| `projectStore.ts:54-55` signal init `signal(1920)`/`signal(1080)` [VERIFIED: app/src/stores/projectStore.ts:54-55] | Boot default; createProject and hydrateFromMce overwrite before any pixel is sized. Matches the locked HD default |
| `projectStore.ts:1026-1027` (`closeProject`) and `:1053-1054` (`reset()`) | Store-reset defaults between projects; same overwrite logic applies |
| `app/src-tauri/src/commands/project.rs:17-24` `project_get_default` | Dead legacy IPC — TS wrapper `projectGetDefault` (ipc.ts:42-44) has **zero call sites** [VERIFIED: grep across app/src found only the wrapper definition]. Leave untouched |

### LEGIT constants (explicitly do NOT touch)

| Constant | Site | Why legit |
|----------|------|-----------|
| `PHYSICS_PAINT_WORKING_LONG_EDGE = 1920` | `physicsPaintCanvasSizing.ts:3` | The 52.1 HD working-space cap — orientation-agnostic by design: `scale = Math.min(1, PHYSICS_PAINT_WORKING_LONG_EDGE / Math.max(projectWidth, projectHeight))` [VERIFIED: app/src/components/physic-paint/engine/physicsPaintCanvasSizing.ts:5-12]. CONTEXT names this constant as legit. This IS the "long edge clamped to 1920" enforcement for physics |
| `DEFAULT_PHYSICS_PAINT_CANVAS_WIDTH/HEIGHT = 1000/650` | `physicsPaintCanvasSizing.ts:1-2` | Degenerate-input fallback only (projectWidth ≤ 0) |
| `FALLBACK_COMPOSITE_SIZE = {width: 1920, height: 1080}` | `physicPaintStore.ts:452` | Used only when `_compositorSizeProvider` is null; production wires project dims at `projectStore.ts:1082` (`_setPhysicPaintCompositorSizeProvider(() => ({width: width.value, height: height.value}))` [VERIFIED: app/src/stores/projectStore.ts:1082]). Test-only fallback |
| `aspect-ratio: 1000 / 650` | `physicsPaintStudio.css:56` (`.demo-canvas-shell`) | Pre-JS stylesheet fallback; `PhysicsPaintCanvasMount.tsx:85` overrides inline with `aspectRatio: ${props.width} / ${props.height}` [VERIFIED: app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx:84-87] |
| `PREVIEW_WIDTH/HEIGHT 200×140`, `640×400` canvases | `ShaderBrowser.tsx:18-19, 316-331`; `SidebarFxProperties.tsx:380-381, 409` | Fixed shader-preview card surfaces, not project-sized output (and 8:5, not 16:9) |
| `aspect-ratio: 4 / 3` | `physicsPaintStudio.css:6241` (background picker tile) | Fixed UI tile grid |
| `project.meta` `size: {x: 1920, y: 1080}` | `app/src/project.meta:9-12` | Motion Canvas scaffold; `project.ts` is not imported by any runtime code — dead |
| `window.open(..., 'width=1280,height=900')` | `physicPaintBridge.ts:3489` | Studio OS window chrome, not project canvas |
| 1920×1080 in test fixtures (`__fixtures__/*.mce.json`, `testUtils/packageFixture.ts:141-142`) | — | Fixture data; tests may keep 16:9 fixtures, add vertical ones as needed |
| Comments mentioning 1920×1080 | `webpFrameCodec.ts:63`, `frame_codec.rs:29`, `EfxPaintEngine.ts:2290`, `drying.ts:185`, `Preview.tsx:15`, `PhysicsPaintStudio.tsx:4057`, `projectStore.ts:839` | Documentation only |

### OK sites (already data-driven — verified, no action)

| Surface | Site(s) | Mechanism |
|---------|---------|-----------|
| Export frame sizing | `exportEngine.ts:161-162` (`projectStore.width.peek()/height.peek()`), `:180-181` (`Math.round(projectWidth * settings.resolution)`), `:208-209` (canvas sized), `:302-303` (sidecar dims) | Project dims × multiplier |
| Export renderer | `exportRenderer.ts:103-106, 168-169, 290, 385-386` | All canvas-relative |
| FCPXML sidecar | `exportSidecar.ts:44-45, 80` | From input params |
| Export preview | `ExportPreview.tsx:17-21, 47-52, 80` | Aspect-preserved scale, container `aspectRatio: ${baseWidth}/${baseHeight}` |
| Format selector | `FormatSelector.tsx:28-29` | Base dims × multiplier labels |
| Main preview compositor | `previewRenderer.ts:187` (paper canvas), `:452-456` (offscreen `off.width = projW`) | Project dims |
| Paper raster | `projectPaperRaster.ts:15-78` | Parameterized w/h, content-keyed cache |
| Canvas area layout | `CanvasArea.tsx:59-63, 416-417` | `projectStore.width.value`px style |
| Zoom/pan/fit | `canvasStore.ts:30-31, 50-51, 134-136` | Project dims |
| Fullscreen letterbox | `FullscreenOverlay.tsx:91-93` | `Math.min(screenW / projW, screenH / projH)` — ratio-agnostic |
| Canvas overlays | `MotionPath.tsx:104-105`, `TransformOverlay.tsx:137-138+`, `PaintOverlay.tsx:631-632+`, `OnionSkinOverlay.tsx:34-35, 95-96` | Project dims |
| Paint stores | `paintStore.ts:656-657, 697-698, 734-735`, `paintPersistence.ts:80-81` | Project dims |
| Studio launch | `physicPaintBridge.ts:3355-3356` + caller `PhysicPaintProperties.tsx:81-84` (`canvas: { width: projectStore.width.peek(), height: projectStore.height.peek() }`) [VERIFIED: app/src/components/sidebar/PhysicPaintProperties.tsx:78-87] | Project dims ride the launch context |
| Studio canvas sizing | `PhysicsPaintStudio.tsx:899-901` (`launchContext?.width ?? DEFAULT…` → `getPhysicsPaintWorkingSize`) + `PhysicsPaintCanvasMount.tsx:85` | Working size = long-edge cap scale; orientation-agnostic |
| Reveal bake size | `physicPaintStore.ts:1728-1730` | Size provider → working size |
| Background contain-fit | `efxPaintCompositor.ts:306` (`Math.min(size.width / sourceWidth, size.height / sourceHeight)`) | Ratio-agnostic |
| Manifest round-trip | Serialize `projectStore.ts:388-389`; hydrate `:449-450`; Rust `models/project.rs:20-21` (`pub width: u32, pub height: u32` on `MceProject` [VERIFIED: app/src-tauri/src/models/project.rs:16-21]) | **No schema change needed** |
| Launch context validation | `physicPaintBridge.ts:3522-3524` (`isFinitePositiveNumber`: `value > 0` only) | No upper bound / no ratio constraint — vertical passes |

**Audit conclusion: zero STRUCTURAL finds. Escalation clause does not fire.**

## Finding 2 — 52.2 Stepper Component

**File:** `app/src/components/shared/NumericStepper.tsx` (the mandated 52.2-03 control).

Signature [VERIFIED: app/src/components/shared/NumericStepper.tsx:28-58] — verbatim prop contract:
```typescript
export interface NumericStepperProps {
  /** Controlled value — the stepper never owns domain state. */
  value: number;
  /** Called once per committed step (button press, hold-repeat, or field commit). */
  onChange: (value: number) => void;
  /** The field's own step (D-24: fps 0.5, everything else keeps its current step). */
  step: number;
  min?: number;
  max?: number;
  precision?: number;
  ariaLabel: string;
  disabled?: boolean;
  // ... onFocus/onBlur/ariaDescribedBy/class/inputClass/buttonClass/children
}
```

Behavior contract (all verified in the same file):
- **Clamp+snap on every emission** — `clampToStep` (lines 70-76) snaps to step grid then clamps min/max; button presses, hold-repeat, and typed commits all funnel through it.
- **Keyboard:** `type="text" inputMode="decimal"`; Enter commits + blurs; Escape reverts + blurs; blur commits (lines 242-259).
- **Hold-to-repeat:** 400ms delay then 60ms interval (exported constants `NUMERIC_STEPPER_REPEAT_DELAY_MS = 400` / `NUMERIC_STEPPER_REPEAT_INTERVAL_MS = 60`, lines 21-24).
- **Integer mode:** `step >= 1` → `precision` defaults to 0 decimals (`formatStepperValue`, lines 61-67).
- Controlled component — dialog owns the value (signals, per project rules).

**Custom-entry mapping:** two steppers, `step={1}`, `min={<sane minimum — discretion>}`, `max={1920}` on each field. Clamping each side to ≤1920 makes the long-edge constraint (`max(w,h) ≤ 1920`) hold structurally. Usage precedent: `PhysicsPaintWorkflowStrip.tsx:1186` (fps field), `ColorPickerModal.tsx:442+`, `KeyPhotoStrip.tsx:246`.

## Finding 3 — createProject Plumbing

Current flow [VERIFIED: app/src/components/project/NewProjectDialog.tsx:55-61]:
```typescript
const packageDirPath = `${dirPath}/${name.trim()}.mce`;
await projectStore.createProject(name.trim(), fps, packageDirPath);
await projectStore.saveProjectAs(toPackageManifestPath(packageDirPath));
```

Chain:
1. `projectStore.createProject(projectName, projectFps, projectDirPath)` — projectStore.ts:763. Calls `closeProject()`, rotates ids, then `projectCreate(name, fps, dirPath)` IPC, then `batch { width.value = result.data.width; height.value = result.data.height; ... }` (lines 786-791). **The store adopts whatever dims Rust returns.**
2. IPC wrapper `projectCreate(name, fps, dirPath)` — ipc.ts:46-48, single object arg `{ name, fps, dirPath }`.
3. Rust `project_create(app, name, fps, dir_path)` — commands/project.rs:30-68; creates dir, registers asset scope, returns `MceProject` with the F1 hardcode.
4. `saveProjectAs` writes the manifest via `buildMceProject()` which reads the **signals** (`width: width.value, height: height.value` — :388-389). Hydration restores them (:449-450).

**Two viable threading options (discretion — both preserve the round-trip):**

| Option | Change | Pros | Cons |
|--------|--------|------|------|
| **A (recommended): IPC threading** | `NewProjectDialog` passes w/h → `createProject(name, fps, dirPath, width, height)` → `projectCreate` IPC gains `width`/`height` → Rust `project_create` accepts `width: u32, height: u32` and returns them verbatim | Dims born correct at the source; no window where signals hold wrong dims; Rust stops manufacturing a default | Touches 4 layers (dialog, store, ipc.ts, Rust command) |
| **B: zero-Rust** | Dialog calls `projectStore.setResolution(w, h)` between `createProject` and `saveProjectAs` | No Rust change; manifest already built from signals | Signals transiently hold 1920×1080 inside createProject; relies on call ordering |

Either way: **no manifest schema change** — `width`/`height: u32` already on `MceProject` (models/project.rs:20-21) and `MceSequence` (:97-98), serde round-trips them, TS `hydrateFromMce` reads them.

**Note for planner:** `NewProjectDialog` currently uses `useState` throughout (lines 12-16) — pre-existing code, but project rule is signals-only ("No useState — Preact signals only", memory; efx-preact-reactivity skill). New preset/custom state MUST use signals; do not refactor the existing fields unless the plan chooses to (small scope).

## Finding 4 — Test Surface

| Requirement | Test file (established pattern) | Notes |
|-------------|--------------------------------|-------|
| Manifest round-trip of chosen dims | `app/src/stores/projectStore.test.ts` — `describe('AUDIO-07: buildMceProject')` (:85+) and `describe('AUDIO-07: hydrateFromMce')` (:171+); `makeMinimalMceProject` factory at :172 takes overrides | Add: set non-default dims → `buildMceProject()` → assert `project.width/height`; hydrate a fixture with vertical dims → assert signals |
| Physics scale, both orientations | `app/src/components/physic-paint/engine/physicsPaintCanvasSizing.test.ts` — existing 4-test describe [VERIFIED: file read in full] | Add: `getPhysicsPaintWorkingSize(1080, 1920)` → identity `{1080, 1920}` (vertical not downscaled — max edge = 1920 = cap); `(1080, 1350)` and `(1080, 1080)` → identity; >1920 vertical (e.g. 1081×1921) → downscaled to long edge 1920 |
| Export sizing with vertical dims | `app/src/lib/exportEngine.test.ts` — projectStore mock pattern `:62-63` (`width: { peek: () => 4, value: 4 }`) | Mock vertical dims; assert `exportWidth/Height` and canvas sizing follow |
| Dialog preset/custom logic | No existing `NewProjectDialog` test — component-test precedent exists (KeyPhotoStrip, 47-03 panel contracts). Keep dialog logic in a pure helper (preset table + clamp) for unit tests | Also candidate for the "no surviving 16:9 assumption" grep contract |
| Stepper reuse | `NumericStepper` already covered by 52.2's `numericStepperSweep` source-scan contract | No new stepper tests needed; integration via dialog tests |

Run: `pnpm --filter efx-motion-editor exec vitest run` (config `workflow.test_command`). Never watch mode.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (run via pnpm filter) |
| Config file | existing app vitest config (no Wave 0 needed) |
| Quick run command | `pnpm --filter efx-motion-editor exec vitest run <file>` |
| Full suite command | `pnpm --filter efx-motion-editor exec vitest run` |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | File |
|-----|----------|-----------|------|
| Preset persists | save/reopen round-trips width/height | unit | `projectStore.test.ts` (exists) |
| Physics scale both orientations | working size correct for 9:16, 4:5, 1:1 | unit | `physicsPaintCanvasSizing.test.ts` (exists) |
| No surviving 16:9 assumption | audit fixes hold | unit / grep contract | new or folded into above |
| Custom entry clamps | long edge ≤ 1920, min per side | unit | new (dialog helper) |

### Wave 0 Gaps
- None — existing test infrastructure covers all requirements; new tests slot into existing files + one new dialog-helper test file.

## Security Domain

Minimal surface: the Custom… entry is numeric input feeding a Rust command parameter. Mitigations already structural: `NumericStepper.clampToStep` bounds input renderer-side; Rust `width`/`height` are `u32` (negative/huge values fail serde). If Option A lands, add a Rust-side sanity bound (e.g. 1..=1920 per side) in `project_create` — defense-in-depth for a param that sizes canvas allocations (ASVS V5 input validation). No auth/session/crypto/access-control surface.

## Open Questions

1. **SettingsView resolution select (F5)** — offers 4K (violates the locked HD cap) and no vertical presets; it is a post-creation escape hatch.
   - What we know: it writes via `setResolution` (data-driven), so vertical projects survive it; but selecting 4K exceeds the 52.1 cap the dialog clamps to.
   - Recommendation: flag to user at plan time — options: (a) leave untouched (out of scope, pre-existing), (b) align presets with the new set + drop 4K. Cheap either way; decision belongs to the user since CONTEXT locks the cap.

2. **Sane minimum per side for Custom…** — discretion. Recommendation: 16 px (arbitrary but safe; below thumbnail-useful sizes the app still renders correctly — all math verified ratio/size-agnostic down to 1 px, and `getPhysicsPaintWorkingSize` guards `<= 0`).

## Sources

### Primary (HIGH confidence)
- All findings verified by direct `Read`/`rg` of the repo this session — file:line citations inline with verbatim quotes per the in-repo value provenance rule.

**Confidence breakdown:**
- Audit (Finding 1): HIGH — every listed site opened and read; OK-sites sampled across all required categories (export, compositor, thumbnails-as-frame-data, Studio, preview, Rust).
- Stepper (Finding 2): HIGH — component read in full.
- Plumbing (Finding 3): HIGH — full chain traced dialog → store → IPC → Rust → manifest.
- Tests (Finding 4): HIGH — test files read, patterns confirmed.

**Research date:** 2026-09-18
**Valid until:** 2026-10-18 (stable — internal codebase facts)
