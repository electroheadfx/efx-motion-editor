# Quick 260716-dby Production Checkpoint

Status: production-ready for native UAT retest

## Production commits

- `c764544e` — `feat(260716-dby): add durable script library foundation`
- `6677c805` — `feat(260716-dby): mount project Roto script library`
- `5f1e3b8d` — `fix(260716-dby): secure script authority and persistence`
- `2e06e2bc` — `fix(260716-dby): stabilize library capture and UI lifecycle`
- `3ed051f7` — `fix(260716-dby): guard missing library project context`
- `c67fd1aa` — `fix(260716-dby): isolate standalone filesystem authority`
- `40edb4cc` — `fix(260716-dby): serialize library context and validate WebP`
- `eecd7935` — `fix(260716-dby): isolate concurrent state saves`
- `48427a15` — `fix(260716-dby): encode script thumbnails natively`
- `d6731712` — `fix(260716-dby): resolve library bridge on demand`

## Exact changed production files

- `app/src-tauri/src/commands/mod.rs`
- `app/src-tauri/src/commands/script_library.rs`
- `app/src-tauri/src/lib.rs`
- `app/src-tauri/src/services/mod.rs`
- `app/src-tauri/src/services/project_io.rs`
- `app/src-tauri/src/services/script_library.rs`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.ts`
- `app/src/components/physic-paint/bridge/physicsPaintLaunchContext.ts`
- `app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts`
- `app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts`
- `app/src/components/physic-paint/hooks/useRotoScriptLibraryController.ts`
- `app/src/components/physic-paint/physicsPaintStudio.css`
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts`
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts`
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts`
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.ts`
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx`
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx`
- `app/src/lib/ipc.ts`
- `app/src/lib/physicPaintBridge.ts`
- `app/src/main.tsx`
- `app/src/stores/projectStore.ts`
- `app/src/types/physicPaint.ts`

## Production review closure

- BLOCKER-01 closed: authority bind/clear/migration are main-window-only in native code; migration source must match native active state.
- BLOCKER-02 closed: Save As keeps source context active until the native destination save/migration transaction succeeds and restores a pre-existing destination `.mce` on migration failure.
- HIGH-01/HIGH-02/MEDIUM-01 closed: native/frontend validation now aligns deterministic optional fields, safe integers/dates, canonical Base64, parsed WebP dimensions, stable SHA-256 revisions, and real Unicode NFC.
- HIGH-03/HIGH-04 closed: one locked persistence capture returns script plus exact live-alpha canvas, and required paper raster readiness is awaited before persistence.
- HIGH-05/HIGH-06 closed: explicit project-context events clear/rescan library state, with context/operation generations, busy exclusion, disposal checks, and stale-result rejection.
- HIGH-07/MEDIUM-02/MEDIUM-03 closed: narrow layout is a vertically scrolling single column; rename has no nested interaction; delete uses Escape/focus restoration; disabled reasons are focusable and described.
- HIGH-08 closed: Rename/Delete carry and revalidate stable expected revisions immediately before mutation.
- Final BLOCKER closed: Tauri capabilities are split by window; the standalone has only core window/event permissions, and native editable-state Save is routed through a typed parent-owned dialog/write bridge.
- Final HIGH context/race finding closed: every create/open/close/switch/Save As rotates a non-authority opaque context ID, standalone stale-result identity uses it, and native scan/load/save/rename/delete/migration are serialized under managed active-project state.
- Final HIGH WebP finding closed: frontend validation now checks canonical RIFF length/chunks/padding and one image chunk; native additionally decodes with the existing image crate WebP feature and rejects malformed/trailing/non-decodable or dimension-mismatched payloads.
- Final advisory closed: the delete confirmation contains Tab/Shift+Tab focus and retains Escape/restoration behavior.
- Final concurrency blocker closed: each parent-owned native editable-state Save now owns an operation-local payload, listener, sentinel, and result promise, so overlapping saves cannot persist or acknowledge another request's JSON.
- Native UAT B/D failure 1 closed: packaged WKWebView cannot encode WebP, so thumbnail composition now sends bounded RGBA through an operation-correlated parent bridge to a main-window-only native lossy WebP encoder.
- Native UAT B/D failure 2 closed: the persistent script-library controller captured its initial `Unavailable` bridge mode; requests now read the latest mode and redetect Tauri at action time before dispatch.

## Exact production review fix files

- `app/src-tauri/Cargo.lock`
- `app/src-tauri/Cargo.toml`
- `app/src-tauri/src/commands/project.rs`
- `app/src-tauri/src/commands/script_library.rs`
- `app/src-tauri/src/lib.rs`
- `app/src-tauri/src/services/script_library.rs`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts`
- `app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts`
- `app/src/components/physic-paint/hooks/useRotoScriptLibraryController.ts`
- `app/src/components/physic-paint/physicsPaintStudio.css`
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts`
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts`
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts`
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.ts`
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx`
- `app/src/lib/ipc.ts`
- `app/src/lib/physicPaintBridge.ts`
- `app/src/stores/projectStore.ts`
- `app/src/types/physicPaint.ts`
- `app/src-tauri/capabilities/default.json`
- `app/src-tauri/capabilities/physics-paint.json`
- `app/src/components/physic-paint/bridge/physicsPaintSessionFile.ts`
- `app/src/components/physic-paint/view/PhysicsPaintStudioToolbar.tsx`
- `app/src/main.tsx`

## Baseline commands and results

- Deferred post-UAT file guard before Task 1 baseline: PASS.
- `pnpm --filter efx-motion-editor typecheck`: PASS.
- `cargo check --manifest-path /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/Cargo.toml`: PASS.
- `pnpm --filter @efxlab/efx-physic-paint check`: PASS.
- `pnpm --filter @efxlab/efx-physic-paint build`: PASS.
- `pnpm -C /Users/lmarques/Dev/efx-motion-editor build`: PASS.
- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts src/lib/physicPaintRotoDurableCore.test.ts --bail=1`: PASS; existing focused suites passed. The first attempted form used unsupported Vitest `-x`; it was rerun with `--bail=1`.
- `git -C /Users/lmarques/Dev/efx-motion-editor diff --check`: PASS.
- Deferred post-UAT file guard before Task 2 commit and before checkpoint return: PASS.
- Production review rerun `pnpm --filter efx-motion-editor typecheck`: PASS.
- Production review rerun `cargo check --manifest-path app/src-tauri/Cargo.toml`: PASS.
- Production review rerun focused existing Vitest suites: PASS, 75 passed and 1 skipped.
- Production review rerun Physics Paint package check/build: PASS.
- Production review rerun root build: PASS.
- Production review rerun `git diff --check`: PASS.
- Production review deferred-test guard relative to `75998aa2`: PASS.
- Final review capability/schema validation through `cargo check --manifest-path app/src-tauri/Cargo.toml`: PASS; both capability files were accepted.
- Final review `pnpm --filter efx-motion-editor typecheck`: PASS.
- Final review focused existing `vitest run` suites: PASS (75 passed, 1 skipped).
- Final review Physics Paint package check/build: PASS.
- Final review root build: PASS.
- Final review `git diff --check`: PASS.
- Final review deferred-test guard relative to `75998aa2`: PASS.
- Concurrent Save State fix `pnpm --filter efx-motion-editor typecheck`: PASS.
- Concurrent Save State focused suite: 7 behavioral tests passed; 1 legacy source-text assertion failed because it requires direct standalone `plugin-dialog`/`plugin-fs` imports that the split-capability security correction intentionally removed. The test was not edited before native UAT and is deferred for the approved post-UAT regression update.
- Concurrent Save State independent source review: PASS; no blocker/high defect remains.
- Concurrent Save State `git diff --check` and deferred-test guard: PASS.

These are mechanical regression baselines only and are not visible feature evidence.

## Deferred-test guard

No deferred post-UAT TypeScript or Rust test artifact was created or modified relative to base commit `75998aa2f7dded08b1203ab6e8b85f64d416d597`.

## Failed native UAT D correction

- Mounted evidence: Save aborted with `Error: Actual WebP encoding is unavailable in this WKWebView`; the SCRIPTS list remained empty because persistence correctly did not start.
- Root cause: composition/downscaling succeeded, but packaged macOS WKWebView returned a non-WebP result for `canvas.toBlob('image/webp', 0.8)`.
- Fix commit: `48427a15` — `fix(260716-dby): encode script thumbnails natively`.
- Fix files: `app/src/types/physicPaint.ts`, `app/src/lib/ipc.ts`, `app/src/lib/physicPaintBridge.ts`, `app/src/main.tsx`, `app/src/components/physic-paint/PhysicsPaintStudio.tsx`, `app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.ts`, `app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.ts`, `app/src-tauri/Cargo.toml`, `app/src-tauri/Cargo.lock`, `app/src-tauri/src/commands/script_library.rs`, `app/src-tauri/src/services/script_library.rs`, `app/src-tauri/src/lib.rs`.
- Production correction: standalone composition now extracts exact bounded RGBA, sends an operation-correlated Base64 request only to `main`, and receives validated WebP only from the `efx-physic-paint` result event. The main-window-only native command encodes lossy WebP with quality `0.8`, validates exact dimensions and payload with the authoritative decoder, and performs no filesystem access. Browser development retains strict actual-WebP `toBlob`; no PNG/JPEG fallback exists.
- Temporary probe: `pnpm --filter efx-motion-editor exec vitest run src/tmpWebpUatProbe.test.ts --bail=1` — PASS (1 test). It forced `toBlob` to return PNG, injected the native encoder port, asserted thumbnail success, and asserted `toBlob` was not called. The probe was deleted before commit.
- Gates: app typecheck PASS; Cargo check PASS with `webp 0.3.1`/`libwebp-sys` on macOS; existing focused suites PASS (75 passed, 1 skipped); Physics Paint package check/build PASS; root build PASS; `git diff --check` PASS; deferred-test guard relative to `75998aa2` PASS.
- Independent source review: operation IDs are locally correlated with listener-before-send and timeout cleanup; request/result dimensions, quality, canonical Base64, exact RGBA length, output size, MIME, and dimensions are bounded/validated; native invocation is restricted to `window.label() == "main"`; result targets only `efx-physic-paint`; no path, authority, project, script, provenance, generic invoke, filesystem capability, or fallback image format was added.
- Required native retest: repeat B first-save flow and D WebP inspection, including row preview, capture-time paper/background, white transparency flattening, approximately 96×64 aspect fit, and JSON `mimeType`, actual dimensions, `quality: 0.8`, and real WebP data URL. Dependent first-save persistence must now create exactly one autonomous JSON and row. Do not infer approval for A–M from this correction.

## Unresolved native evidence

- Actual packaged WKWebView WebP canvas encoding remains unproven. Production rejects null output, non-`image/webp` MIME, non-RIFF/WEBP signatures, and oversized payloads; native UAT must prove that the packaged runtime produces actual WebP.
- Thumbnail paper/background fidelity and script-only exclusion of cached-reference pixels require mounted visual inspection.
- Four-tab/six-control fit, list scrolling, keyboard interaction, and absence of horizontal page overflow at 286–340 px and stacked mobile widths require mounted visual inspection.
- Full Save As transaction/rollback behavior, collision handling, external-replacement conflicts, malformed-file isolation, reopen discovery, and loaded clipboard independence require filesystem-backed native UAT.
- Caller-window-label enforcement, split-capability isolation, parent-owned editable-state Save, project-context transition delivery, and operation serialization passed compile/static verification but still require packaged two-window native evidence.
- Real decoder rejection of malformed/trailing/polyglot WebP is implemented and compile-checked; packaged valid WebP production and filesystem acceptance still require native UAT.

## Blocking native UAT A–M

A. Unsaved project: confirm Save is disabled and exposes `Save the project first.`.

B. First save: paint three brushes on an editable real Roto frame; Save creates exactly one JSON under `scripts/` and a newest-first row with exact default name, thumbnail, project/layer/frame provenance, and brush count.

C. Multiple presets: save the same source three times; confirm three independent UUID files, deterministic base/`-2`/`-3` display names, and no overwrite.

D. WebP: inspect rows and JSON; preview includes capture-time background/paper, transparent background is white, aspect ratio fits the approximately 96×64 maximum, and JSON contains explicit MIME/actual dimensions/quality plus validated WebP data URL rather than PNG, JPEG, raw pixels, or cached base.

E. Other frames: save distinct real frames; confirm distinct provenance/previews and that prior rows remain available.

F. Close/reopen: close and reopen the saved project; confirm scripts are rediscovered from `scripts/` without `.mce` records, a registry, or an index.

G. Explicit Load: selection alone changes nothing; Load reports selected name/count and replaces the reusable clipboard; existing Apply retains visible Motion, per-brush Undo/Redo, additive cached repaint, exact destination ownership, and one final cache publication.

H. Loaded independence: after Load, Rename and Delete the durable entry; confirm the loaded clipboard is unchanged and remains reusable.

I. Rename: inline Rename supports Enter/Escape and duplicate feedback; successful Rename changes only display name/updated time, leaves UUID filename unchanged, does not reorder, and persists across reopen.

J. Refresh/manual files: add one valid new-ID managed file and one malformed managed JSON; Refresh shows the valid row, reports malformed input via skipped count/LOG, retains valid rows, and never deletes malformed input.

K. Save As: Save As to a new project; confirm valid scripts copy with source intact, identical collisions dedupe, differing collisions remap, invalid/unrelated destination content is preserved, and Load/Apply works in destination.

L. Responsive UI: at normal, narrow 286–340 px, and stacked mobile widths, visually confirm four tabs and six controls stay usable with no clipping, overlap, wrapping, or page overflow; verify keyboard behavior, accessible names/tooltips, and exact disabled Import tooltip. Native UAT is the visual/layout authority.

M. Smoke: confirm normal Copy/Apply/Discard/Undo/Redo, rapid paint, navigation, cached-base additive repaint, generated-frame rejection, interpolation spacing, preview, and export remain unchanged.

## Resume command after explicit A–M approval

`/gsd-quick resume implement-durable-project-scoped-physics`
