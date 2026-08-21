---
phase: quick-260716-dby
plan: 01
type: execute
mode: quick-full
wave: 1
depends_on: []
autonomous: false
requirements:
  - QUICK-260716-DBY
files_modified:
  # Task 1 production only — contracts, parent authority lifecycle, native service
  - app/src/types/physicPaint.ts
  - app/src/lib/ipc.ts
  - app/src/lib/physicPaintBridge.ts
  - app/src/stores/projectStore.ts
  - app/src/components/physic-paint/bridge/physicsPaintLaunchContext.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts
  - app/src-tauri/src/lib.rs
  - app/src-tauri/src/commands/mod.rs
  - app/src-tauri/src/commands/project.rs
  - app/src-tauri/src/commands/script_library.rs
  - app/src-tauri/src/services/mod.rs
  - app/src-tauri/src/services/project_io.rs
  - app/src-tauri/src/services/script_library.rs
  # Task 2 production only — mounted standalone integration
  - app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.ts
  - app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
  - app/src/components/physic-paint/hooks/useRotoScriptClipboardController.ts
  - app/src/components/physic-paint/hooks/useRotoScriptLibraryController.ts
  - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
  - app/src/components/physic-paint/hooks/usePhysicsPaintStudioViewModel.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
  - app/src/components/physic-paint/physicsPaintStudio.css
must_haves:
  truths:
    - "A saved project owns a durable library of autonomous `efx-physics-paint-roto-script` documents with `schemaVersion: 1`, one UUID-named `.efx-roto-script.json` file per preset under its canonical `scripts/` directory, with no `.mce` registry or index file."
    - "Save Script is unavailable for an unsaved project with the exact reason `Save the project first.`; on an editable real Roto source it captures the approved live recorded-script boundary rather than the clipboard, always creates a new preset, preserves the clipboard/history/cache ownership, and derives `[project name]-[layer name]-[frame number]`, `-2`, `-3` names from the current validated scan."
    - "The durable DTO preserves complete ordered raw logical brush groups and all deterministic replay metadata while excluding mounted/apply/engine-generation mutation state; schema v1 tolerates safe unknown optional fields, while unknown schema versions and malformed/oversized data fail nonfatally."
    - "The standalone exposes only typed operations, operation IDs, opaque UUID script IDs, and validated save/name payloads; the parent attaches its own current saved-project authority, and native independently checks managed active-project state before constructing canonical `<root>/scripts/<id>.efx-roto-script.json` paths and performing atomic operations."
    - "A strict WebP thumbnail is persisted as a validated `data:image/webp;base64,...` data URL with actual MIME, dimensions preserving aspect ratio inside an approximately 96×64 maximum box, and quality around 0.8; it shows the preset's brushes over capture-time Roto background/paper, flattens transparency to white, excludes unrelated cached-reference pixels, and fails without writing a preset if actual WebP cannot be proven."
    - "SCRIPTS beside TOOL/ONION/MOTION scans on every required lifecycle trigger, keeps valid rows available when individual files are invalid, reports skipped counts locally and details through the existing LOG, sorts immutable creation time newest-first, and clears rows/selection on project close."
    - "Selection is inert; explicit Load revalidates by opaque ID and replaces the approved deeply immutable clipboard boundary, after which the existing Apply path alone supplies current Motion, fresh mutation IDs, per-brush Undo/Redo, additive cached repaint, target ownership, and final publication."
    - "Inline Rename changes only unique bounded display name and `updatedAt`; confirmed Delete removes only the selected validated managed file; missing or externally changed operations fail safely and rescan; neither operation changes an already loaded clipboard."
    - "Save As preserves the source library, copies only valid managed scripts, semantically deduplicates identical same-ID content, remaps differing valid same-ID content to a fresh UUID, and never overwrites unrelated or invalid destination content."
    - "The compact keyboard-accessible SCRIPTS UI keeps four usable tabs and six Lucide toolbar controls at 286–340 px and stacked mobile widths, shows 40–56 px thumbnails/provenance/count rows without horizontal overflow, and keeps Import disabled with `Import from another project — coming later`."
    - "Execution stops after production implementation as `production-ready for native UAT`; no new regression test is created or modified until the user explicitly approves native UAT A–M, after which all 47 required regressions and the ordered final gates are completed."
  artifacts:
    - path: "app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts"
      provides: "Authoritative frontend v1 DTO/parser/serializer and runtime conversion contract"
    - path: "app/src-tauri/src/services/script_library.rs"
      provides: "Project-authority resolution, strict validation, canonical managed paths, atomic operations, scan, and Save As migration"
    - path: "app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.ts"
      provides: "Strict script-only capture-time WebP composition and validation"
    - path: "app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts"
      provides: "Focused Signals library controller with explicit lifecycle transactions"
    - path: "app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx"
      provides: "Compact accessible SCRIPTS toolbar, rows, inline Rename, Delete confirmation, and status surface"
    - path: ".planning/quick/260716-dby-implement-durable-project-scoped-physics/260716-dby-POST-UAT-PLAN.md"
      provides: "After explicit A–M approval, a separately checked bounded continuation that owns all deferred regression and final-gate work"
    - path: "app/src-tauri/tests/script_library_schema.rs"
      provides: "Post-UAT disjoint native schema integration coverage created only by the continuation plan"
    - path: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts"
      provides: "Existing deferred mounted integration test file modified only by the post-UAT continuation"
  key_links:
    - from: "PhysicsPaintScriptsPanel Save action"
      to: "approved RotoScriptClipboardController source handoff"
      via: "RotoScriptLibraryController capture port calls controller-owned persistence capture without reading or replacing the clipboard"
      pattern: "captureScriptForPersistence|saveActiveFrame"
    - from: "standalone library controller"
      to: "parent bridge and native project-scoped script service"
      via: "token-free typed operation/result envelopes with operation IDs and opaque script IDs; parent verifies the mounted relationship and attaches its own current authority before native independently resolves managed active-project state"
      pattern: "script-library-request|script-library-result|operationId|scriptId"
    - from: "native active project authority"
      to: "managed JSON file"
      via: "canonical root plus fixed scripts directory and canonical UUID filename construction, with symlink and containment checks"
      pattern: "scripts|efx-roto-script\\.json|canonicalize"
    - from: "persisted v1 document"
      to: "approved reusable Apply workflow"
      via: "strict parse and fresh deep-cloned/frozen clipboard replacement; Apply implementation remains the existing controller path"
      pattern: "replaceClipboardFromPersisted|applyScript"
    - from: "projectStore Save As"
      to: "destination project library"
      via: "native validation/copy/dedupe/remap transaction completes before active authority and launch context switch"
      pattern: "saveProjectAs|migrate.*script|authority"
    - from: "launch/update context"
      to: "durable provenance and availability"
      via: "parent-sourced project name, saved availability, stable layer ID/name, and current real-frame metadata; no authority capability, filesystem path, or path-derived display metadata is exposed to standalone"
      pattern: "projectName|layerId|layerName|saved"
---

<objective>
Implement the complete durable, project-scoped Physics Paint Roto script library on top of the native-UAT-approved Copy Script / Apply Script contract, then enforce the user-owned native-UAT boundary before adding regression coverage.

Purpose: Turn the approved mounted-session reusable script into a secure autonomous project asset without forking replay, leaking filesystem authority, weakening Roto ownership/cache/history behavior, or allowing automation to substitute for mounted visual proof.
Output: Production schema, strict WebP capture, typed bridge/native filesystem authority, Save As migration, Signals controller, SCRIPTS UI, an explicit blocking native-UAT checkpoint, and—only after approval—the complete 47-item regression and final-verification suite.

Decision traceability: D-01 project storage authority; D-02 Save As collision semantics; D-03 inline unique Rename; D-04 invalid-file isolation and LOG routing; D-05 compact SCRIPTS UI; D-06 parent-sourced project/layer metadata; D-07 approved clipboard/Apply contracts; D-08 persistence/schema/lifecycle invariants. The invoking prompt's corrections override conflicting research recommendations for kind, schema field, extension, thumbnail sizing/data URL, default naming, replay metadata, and safe handling of unknown optional v1 fields.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/quick.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@/Users/lmarques/Dev/efx-motion-editor/CLAUDE.md
@/Users/lmarques/Dev/efx-motion-editor/.planning/STATE.md
@/Users/lmarques/Dev/efx-motion-editor/.planning/quick/260716-dby-implement-durable-project-scoped-physics/260716-dby-CONTEXT.md
@/Users/lmarques/Dev/efx-motion-editor/.planning/quick/260716-dby-implement-durable-project-scoped-physics/260716-dby-RESEARCH.md
@/Users/lmarques/Dev/efx-motion-editor/.planning/quick/260715-kgf-implement-functional-physics-paint-roto-/260715-kgf-SUMMARY.md
@/Users/lmarques/Dev/efx-motion-editor/.planning/quick/260715-kgf-implement-functional-physics-paint-roto-/260715-kgf-VERIFICATION.md
@/Users/lmarques/Dev/efx-motion-editor/.planning/quick/260715-kgf-implement-functional-physics-paint-roto-/260715-kgf-UAT.md
@/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
@/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.tsx
@/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
@/Users/lmarques/Dev/efx-motion-editor/app/src/lib/physicPaintBridge.ts
@/Users/lmarques/Dev/efx-motion-editor/app/src/stores/projectStore.ts
@/Users/lmarques/Dev/efx-motion-editor/app/src-tauri/src/lib.rs
@/Users/lmarques/Dev/efx-motion-editor/app/src-tauri/src/commands/project.rs
</context>

<production_files>
## Initial production files

### Task 1 — bounded contracts, authority, and lifecycle foundation (13 files)
- `app/src/types/physicPaint.ts`
- `app/src/lib/ipc.ts`
- `app/src/lib/physicPaintBridge.ts`
- `app/src/stores/projectStore.ts`
- `app/src/components/physic-paint/bridge/physicsPaintLaunchContext.ts`
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts`
- `app/src-tauri/src/lib.rs`
- `app/src-tauri/src/commands/mod.rs`
- `app/src-tauri/src/commands/project.rs`
- `app/src-tauri/src/commands/script_library.rs`
- `app/src-tauri/src/services/mod.rs`
- `app/src-tauri/src/services/project_io.rs`
- `app/src-tauri/src/services/script_library.rs`

### Task 2 — bounded mounted standalone integration (13 files)
- `app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.ts`
- `app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts`
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts`
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.ts`
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts`
- `app/src/components/physic-paint/hooks/useRotoScriptClipboardController.ts`
- `app/src/components/physic-paint/hooks/useRotoScriptLibraryController.ts`
- `app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts`
- `app/src/components/physic-paint/hooks/usePhysicsPaintStudioViewModel.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx`
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx`
- `app/src/components/physic-paint/physicsPaintStudio.css`

The executor may use the closest existing seam instead of a listed speculative module when inspection proves that file does not need modification, but must remain within each task's bounded production concern and approximate 15-file ceiling.
</production_files>

<post_uat_test_files>
## Deferred, disjoint post-UAT test artifacts

Tasks 1–2 may RUN existing tests but MUST NOT create or modify any path below. Rust regressions are new integration-test artifacts, never colocated edits to production Rust files.

- `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts`
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.test.ts`
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts`
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts`
- `app/src/components/physic-paint/bridge/physicsPaintLaunchContext.test.ts`
- `app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.test.ts`
- `app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.test.ts`
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts`
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `app/src/lib/physicPaintBridge.test.ts`
- `app/src/stores/projectStore.test.ts`
- `app/src-tauri/tests/script_library_schema.rs`
- `app/src-tauri/tests/script_library_filesystem.rs`
- `app/src-tauri/tests/script_library_lifecycle.rs`
</post_uat_test_files>

<tasks>

<task type="auto">
  <name>Task 1: Build bounded native contracts and parent-owned project lifecycle foundation</name>
  <files>app/src/types/physicPaint.ts, app/src/lib/ipc.ts, app/src/lib/physicPaintBridge.ts, app/src/stores/projectStore.ts, app/src/components/physic-paint/bridge/physicsPaintLaunchContext.ts, app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts, app/src-tauri/src/lib.rs, app/src-tauri/src/commands/mod.rs, app/src-tauri/src/commands/project.rs, app/src-tauri/src/commands/script_library.rs, app/src-tauri/src/services/mod.rs, app/src-tauri/src/services/project_io.rs, app/src-tauri/src/services/script_library.rs</files>
  <action>Implement only the D-01/D-02/D-04/D-06/D-08 contracts, parent project lifecycle, and native managed service foundation in this task. Do not add standalone UI, controller, capture, thumbnail, or mounted request integration, and do not edit any `<post_uat_test_files>` path.

Define the autonomous DTO with exact `kind: "efx-physics-paint-roto-script"`, `schemaVersion: 1`, canonical UUID `id`, fixed `<id>.efx-roto-script.json` filename, capture-time project/layer/frame/dimensions/background metadata, strict thumbnail metadata (`mimeType`, actual dimensions, quality, data URL), and ordered raw logical brush groups. Serialize field-by-field; preserve all deterministic replay fields and strip only mounted-session, mutation/apply/generation, waiter/progress, cache/publication, and equivalent runtime ownership state. Known v1 documents tolerate safe unknown optional fields; unknown schema versions fail nonfatally. Implement matching strict frontend and authoritative Rust validation with bounded file/count/string/brush/continuation/point/numeric/date/UUID/Base64/WebP constraints and per-file invalid isolation.

Correct the authority boundary per D-01/D-06: launch/update context exposed to the standalone contains only parent-sourced project display name, `saved` availability, stable layer ID/name, frames, dimensions, and background. It contains no project root, filesystem path, or authority token. The standalone request DTO defined here contains only operation ID/kind, opaque script ID where applicable, Rename name where applicable, and the full validated save DTO where applicable. The parent listener—not the standalone—uses its current mounted window/project relationship to attach the parent's current saved-project authority when invoking native IPC. Native independently resolves/checks that parent-provided authority against managed active saved-project state and the fixed canonical project root. If existing Tauri architecture supports a stronger active-state command boundary that takes no token while preventing direct standalone invocation, use and document that actual mechanism instead; never invent arbitrary path input or expose authority capability in standalone context/messages.

Implement parent-owned authority lifecycle and native attachment for initial permanent save, saved project open, ordinary save, Save As, project switch, and close. Unsaved/null-`filePath` and `temp-project` states have no durable library authority. Save As migration completes before parent/native active state and launch context switch: copy only validated source managed documents, preserve source, semantic-dedupe identical same-ID contents, remap differing valid or invalid-occupied collisions to a fresh UUID while updating JSON `id` and filename, preserve invalid/unrelated destination content, and return structured diagnostics.

Implement Rust managed active-project state/service/commands for scan/load/save/rename/delete/migrate. Construct only canonical `<root>/scripts/<id>.efx-roto-script.json`; reject traversal, separators, absolute/extra segments, wrong extension, filename/JSON-ID mismatch, symlinked directory/files, non-regular files, canonical escapes, stale parent authority, unrelated files, and temporary project roots. Scan ignores unrelated/temp files, isolates invalid managed files, and never deletes them. Save and Rename use unique same-directory temporary writes, flush/close, atomic replacement, previous-content preservation, and owned-temp cleanup. Rename changes only unique normalized bounded `name` and `updatedAt`; Delete removes only the reread/revalidated selected managed file; missing/external changes return safe structured results. Register only focused commands/state through existing conventions.

Before finishing, run the deferred-file guard as a separate command before baseline commands. Existing deferred tests may be run, never edited. Report this task as foundation ready for mounted integration, not user-visible completion.</action>
  <verify>
    <automated>test -z "$(git -C /Users/lmarques/Dev/efx-motion-editor status --porcelain -- app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.test.ts app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts app/src/components/physic-paint/bridge/physicsPaintLaunchContext.test.ts app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.test.ts app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.test.ts app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts app/src/components/physic-paint/PhysicsPaintStudio.test.ts app/src/lib/physicPaintBridge.test.ts app/src/stores/projectStore.test.ts app/src-tauri/tests/script_library_schema.rs app/src-tauri/tests/script_library_filesystem.rs app/src-tauri/tests/script_library_lifecycle.rs)"</automated>
    <automated>pnpm --filter efx-motion-editor typecheck && cargo check --manifest-path /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/Cargo.toml && git -C /Users/lmarques/Dev/efx-motion-editor diff --check</automated>
  </verify>
  <done>Durable DTO/contracts, parent-owned saved-project authority lifecycle, parent-to-native attachment, native active-project service/commands, canonical atomic operations, Save As migration, and token-free standalone launch/request types exist within the bounded production file set; no deferred test artifact changed.</done>
</task>

<task type="auto">
  <name>Task 2: Integrate the mounted standalone library and compact SCRIPTS surface</name>
  <files>app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.ts, app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts, app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts, app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.ts, app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts, app/src/components/physic-paint/hooks/useRotoScriptClipboardController.ts, app/src/components/physic-paint/hooks/useRotoScriptLibraryController.ts, app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts, app/src/components/physic-paint/hooks/usePhysicsPaintStudioViewModel.ts, app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx, app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx, app/src/components/physic-paint/physicsPaintStudio.css</files>
  <action>Build the bounded mounted production integration for D-03/D-04/D-05/D-07/D-08 on Task 1's contracts without editing deferred tests. Keep the standalone transport token-free: requests carry typed operation kind/ID, opaque script ID where applicable, and validated save/name payloads only; results correlate by operation ID/kind. The parent bridge verifies the currently mounted window/project association and attaches its own current authority before native IPC. Never expose or resend authority/path data in launch/update context, controller state, LOG output, or standalone request fields.

Narrowly extend `RotoScriptClipboardController` with `captureScriptForPersistence()` and `replaceClipboardFromPersisted()` at the approved ownership boundary. Save captures the active editable real frame—not clipboard—through the accepted cooperative drain/finalization handoff, rejects generated/cached-only/empty sources, and leaves clipboard, frame, Undo/Redo, cache ownership, and history unchanged. Load revalidates fresh persisted data and deep-clones/freezes it into the one reusable clipboard. Existing `applyScript()` remains the sole replay path with current Motion, fresh mutation IDs, exact destination ownership/interpolation spacing, per-brush Undo/Redo, additive cached repaint, generated rejection, and final-composite publication unchanged.

Create the strict thumbnail helper from the captured script-only live-alpha surface after drain. Reuse capture-time Roto background/paper rendering, flatten transparency to white, exclude cached base/reference pixels, preserve aspect inside approximately 96×64 (including 96×54 for 16:9), and persist explicit `mimeType: "image/webp"`, actual integer dimensions, quality around `0.8`, and validated `data:image/webp;base64,...`. Verify non-null encoding, actual MIME/signature/dimensions/limits; no cached base, fallback format, alternate rasterizer, or partial Save on failure.

Create a focused Signals `RotoScriptLibraryController` behind typed ports with rows, stable selection, busy operation, concise status, skipped count, inline Rename state/error, confirmation state, and computed availability. Use explicit lifecycle actions rather than broad effects/watchers: saved open/context settle, close clear, every SCRIPTS entry, Save, Rename, Delete, Save As context change, Refresh, and missing-file recovery. Save is disabled until permanent `filePath` with exact reason `Save the project first.`; it always creates a fresh UUID and derives `[project]-[layer]-[frame]`, then `-2`, `-3`, from the current validated scan. Sort immutable `createdAt` newest-first with stable ID tie; Rename keeps the row in place; invalid files remain omitted while valid rows stay available and details route to existing LOG.

Wire Studio as composition only and pass a compact view model to `PhysicsPaintRightPanel`. Add `SCRIPTS` beside TOOL/ONION/MOTION in one nonwrapping strip and a one-row Lucide toolbar for Save, Load, Rename, Delete, Refresh, and visibly disabled Import. Use semantic buttons, accessible names/tooltips, exact Import tooltip `Import from another project — coming later`, stable keyed listbox/option rows, 40–56 px aspect-preserving thumbnail, ellipsized name/provenance/count, selected state, keyboard navigation, inline unique Rename with Enter/Escape and persistent duplicate error, and existing-pattern named Delete confirmation. Preserve internal scrolling and prevent horizontal page overflow at 286–340 px and stacked mobile widths.

Run the same deferred-file guard separately before baselines. Baselines may include existing focused `vitest run` suites, typecheck, Cargo check/existing tests, package check/build, root build, and `git diff --check`; they do not prove pixel layout or authorize completion. Do not start a server or use Chrome DevTools. End with exactly `production-ready for native UAT`.</action>
  <verify>
    <automated>test -z "$(git -C /Users/lmarques/Dev/efx-motion-editor status --porcelain -- app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.test.ts app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts app/src/components/physic-paint/bridge/physicsPaintLaunchContext.test.ts app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.test.ts app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.test.ts app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts app/src/components/physic-paint/PhysicsPaintStudio.test.ts app/src/lib/physicPaintBridge.test.ts app/src/stores/projectStore.test.ts app/src-tauri/tests/script_library_schema.rs app/src-tauri/tests/script_library_filesystem.rs app/src-tauri/tests/script_library_lifecycle.rs)"</automated>
    <automated>pnpm --filter efx-motion-editor typecheck && cargo check --manifest-path /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/Cargo.toml && pnpm --filter @efxlab/efx-physic-paint check && pnpm --filter @efxlab/efx-physic-paint build && pnpm -C /Users/lmarques/Dev/efx-motion-editor build && git -C /Users/lmarques/Dev/efx-motion-editor diff --check</automated>
  </verify>
  <done>The mounted token-free request/result flow, approved capture/load seams, strict small WebP helper, Signals controller, lifecycle triggers, Studio wiring, and complete compact accessible SCRIPTS UI exist within the bounded production file set; deferred tests remain untouched and status is only `production-ready for native UAT`.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking-human">
  <name>Task 3: Stop for user-owned mounted native UAT A–M</name>
  <files>Task 1 and Task 2 production files only for measured fixes; no test or verification artifact</files>
  <action>STOP after Task 2. Do not create/modify any `<post_uat_test_files>` path, create a final verifier artifact, invoke `gsd-verifier`, mark STATE or this quick complete, or begin post-UAT automation. Production fixes for failed A–M checks may touch only the Task 1/2 production files required by the measured failure, followed by proportionate existing baselines and return to this checkpoint. The only status before full approval is `production-ready for native UAT`.

If execution cannot safely pause, terminate and print the exact command `/gsd-quick resume implement-durable-project-scoped-physics`. That command is used only after explicit approval of every A–M item and must route to the post-UAT planning continuation defined below.</action>
  <what-built>The production durable project-scoped Physics Paint Roto script library, including native managed persistence, parent-owned authority attachment, Save As migration, approved Save/Load/Apply boundaries, strict WebP thumbnails, and compact SCRIPTS UI.</what-built>
  <how-to-verify>
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
  </how-to-verify>
  <verify>
    <automated>test -z "$(git -C /Users/lmarques/Dev/efx-motion-editor status --porcelain -- app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.test.ts app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts app/src/components/physic-paint/bridge/physicsPaintLaunchContext.test.ts app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.test.ts app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.test.ts app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts app/src/components/physic-paint/PhysicsPaintStudio.test.ts app/src/lib/physicPaintBridge.test.ts app/src/stores/projectStore.test.ts app/src-tauri/tests/script_library_schema.rs app/src-tauri/tests/script_library_filesystem.rs app/src-tauri/tests/script_library_lifecycle.rs)"</automated>
    <human-check>User performs mounted native UAT A–M and explicitly approves the entire checklist.</human-check>
  </verify>
  <done>Execution remains stopped until explicit A–M approval. No tests or final verifier run before approval; failed UAT receives production-only repair and retest.</done>
  <resume-signal>After all A–M pass, run exactly `/gsd-quick resume implement-durable-project-scoped-physics`; otherwise report the failed item and mounted behavior.</resume-signal>
</task>

</tasks>

<post_uat_continuation>
## Required post-UAT replanning and regression continuation

After explicit A–M approval, `/gsd-quick resume implement-durable-project-scoped-physics` MUST invoke the planner in post-UAT continuation mode. The planner creates a second bounded plan in this same directory, `/Users/lmarques/Dev/efx-motion-editor/.planning/quick/260716-dby-implement-durable-project-scoped-physics/260716-dby-POST-UAT-PLAN.md`, split into multiple focused test/verification units with disjoint file ownership. That continuation plan is checker-validated and then executed. The initial quick remains in progress: do not update STATE as complete and do not create final `260716-dby-VERIFICATION.md` until the continuation has finished. The continuation's last unit returns control to the quick orchestrator; only the orchestrator invokes `gsd-verifier` and may claim final verification.

### Complete 1–47 regression mapping

1. `physicsPaintRotoScriptSchema.test.ts` — round-trip ordered logical brushes and durable metadata.
2. `physicsPaintRotoScriptSchema.test.ts` — omit mutation/apply/waiter/generation/session/cache ownership fields.
3. `physicsPaintRotoScriptSchema.test.ts` — preserve primary-plus-continuation grouping and order.
4. `physicsPaintRotoScriptSchema.test.ts` — preserve point dynamics, complete params/opacity, pen, diffusion, physics mode, and all supported deterministic replay fields.
5. `physicsPaintRotoScriptSchema.test.ts` — accept safe unknown optional v1 fields and reject unknown `schemaVersion`.
6. `physicsPaintRotoScriptSchema.test.ts` + `script_library_schema.rs` — reject malformed/oversized numeric, point, continuation, tool, parameter, date, UUID, Base64, WebP, dimension, and limit violations.
7. `physicsPaintRotoScriptLibrary.test.ts` + `script_library_schema.rs` — isolate invalid managed files while retaining valid rows.
8. `script_library_filesystem.rs` — native operations reach only the managed active project's canonical `scripts/` directory.
9. `script_library_filesystem.rs` — reject traversal, absolute forms, separators, symlinks, escapes, stale parent authority, arbitrary path payloads, and direct standalone authority selection.
10. `script_library_filesystem.rs` — enforce canonical UUID plus `.efx-roto-script.json` filename.
11. `script_library_filesystem.rs` — Save/Rename use same-directory atomic replacement with flush/close.
12. `script_library_filesystem.rs` — failed writes preserve prior content and clean only owned temp files.
13. `script_library_filesystem.rs` — Delete cannot remove unrelated, invalid, symlinked, or nonselected files.
14. `script_library_filesystem.rs` — missing `scripts/` scans as an empty valid library.
15. `script_library_lifecycle.rs` — Save As copies valid files, preserves source, dedupes identical IDs, remaps differing/occupied collisions, and preserves invalid/unrelated destination content.
16. `script_library_filesystem.rs` — no `.mce` registry or `scripts/index.json` is created or consulted.
17. `projectStore.test.ts` + `PhysicsPaintStudio.test.ts` — unsaved project disables Save with exact reason and never targets temp-project.
18. `physicsPaintRotoScriptClipboard.test.ts` + `PhysicsPaintStudio.test.ts` — Save captures active editable real frame, not clipboard.
19. `physicsPaintRotoScriptClipboard.test.ts` — generated, empty, and cached-only sources reject.
20. `physicsPaintRotoScriptClipboard.test.ts` — queued/finalizing work uses approved cooperative drain/publication handoff.
21. `physicsPaintRotoScriptClipboard.test.ts` + `PhysicsPaintStudio.test.ts` — Save leaves clipboard, frame, history, cache ownership, and Apply availability unchanged.
22. `physicsPaintRotoScriptLibrary.test.ts` + `script_library_filesystem.rs` — repeated Save creates independent UUID files without overwrite.
23. `physicsPaintRotoScriptLibrary.test.ts` — exact `[project]-[layer]-[frame]`, `-2`, `-3` names derive from current validated scan.
24. `physicsPaintRotoScriptThumbnail.test.ts` — actual MIME/data URL/signature are WebP.
25. `physicsPaintRotoScriptThumbnail.test.ts` — actual dimensions preserve aspect inside approximately 96×64, including 96×54 for 16:9.
26. `physicsPaintRotoScriptThumbnail.test.ts` — transparent capture flattens white.
27. `physicsPaintRotoScriptThumbnail.test.ts` — capture-time paper/background uses existing renderer.
28. `physicsPaintRotoScriptThumbnail.test.ts` — cached-reference/base pixels are excluded.
29. `physicsPaintRotoScriptThumbnail.test.ts` + `PhysicsPaintStudio.test.ts` — null/wrong-MIME/signature/oversized encoding writes no partial preset and reports safely.
30. `usePhysicsPaintLaunchIntegration.test.ts` + `physicsPaintRotoScriptLibrary.test.ts` + `script_library_lifecycle.rs` — scan on saved open/context settle, each SCRIPTS entry, Save, Rename, Delete, Save As, Refresh; no watcher.
31. `physicsPaintRotoScriptLibrary.test.ts` + `script_library_schema.rs` — Refresh discovers manual valid file while isolating malformed files.
32. `physicsPaintRotoScriptLibrary.test.ts` — immutable `createdAt` descending with stable ID tie order.
33. `physicsPaintRotoScriptLibrary.test.ts` — Rename retains order and `createdAt`.
34. `PhysicsPaintStudio.test.ts` — selection alone leaves clipboard/frame/Apply unchanged.
35. `physicsPaintRotoScriptLibrary.test.ts` + `script_library_filesystem.rs` — external deletion during Load/Rename/Delete fails safely, logs, rescans, and drops only stale row.
36. `physicsPaintRotoScriptClipboard.test.ts` — explicit Load parses fresh data and replaces clipboard with deep clone/freeze.
37. `physicsPaintRotoScriptClipboard.test.ts` — loaded clipboard has no live binding to DTO, file, row, or source objects.
38. `physicsPaintRotoScriptClipboard.test.ts` + `PhysicsPaintStudio.test.ts` — later Rename/Delete leaves loaded clipboard reusable.
39. `PhysicsPaintStudio.test.ts` — Load never replays; subsequent Apply invokes exact approved existing callback/controller path.
40. `physicsPaintRotoScriptClipboard.test.ts` — Apply uses current visible Motion, not persisted Motion.
41. `physicsPaintRotoScriptClipboard.test.ts` + approved existing Apply suites — fresh mutation IDs, per-brush Undo/Redo, additive cached repaint, empty ownership, generated rejection, absolute interpolation spacing, and one final publication remain unchanged.
42. `PhysicsPaintRightPanel.test.ts` + `PhysicsPaintScriptsPanel.test.ts` — TOOL/ONION/MOTION/SCRIPTS expose semantic tabs and stable selected view state.
43. `PhysicsPaintScriptsPanel.test.ts` + `PhysicsPaintRightPanel.test.ts` — semantic rows expose stable IDs/classes/view-model state, 40–56 px thumbnail metadata, ellipsized provenance/count, and deterministic CSS invariants for `white-space`, `min-width`, grid columns, and overflow.
44. `PhysicsPaintScriptsPanel.test.ts` — accessible names/tooltips, keyboard selection/Rename, availability, and exact disabled reasons.
45. `PhysicsPaintScriptsPanel.test.ts` — Delete confirmation contains selected name before dispatch.
46. `PhysicsPaintScriptsPanel.test.ts` — disabled Import has exact tooltip and dispatches no operation.
47. `PhysicsPaintScriptsPanel.test.ts` + `PhysicsPaintStudio.test.ts` — concise statuses/skipped count and detailed failures route through existing LOG/status boundary.

Regression 43's semantic DOM/view-model checks and deterministic CSS rule checks detect contract regressions only; jsdom/source assertions do not prove pixels, fit, or visual layout. Native UAT L remains authoritative for clipping, wrapping, overlap, scrollability, and page overflow. Do not start a server or use Chrome DevTools.

### Ordered continuation commands

1. `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.test.ts -x`
2. `cargo test --manifest-path /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/Cargo.toml --test script_library_schema -- --nocapture`
3. `cargo test --manifest-path /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/Cargo.toml --test script_library_filesystem -- --nocapture`
4. `cargo test --manifest-path /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/Cargo.toml --test script_library_lifecycle -- --nocapture`
5. `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts -x`
6. `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts -x`
7. `pnpm --filter efx-motion-editor exec vitest run src/lib/physicPaintBridge.test.ts src/components/physic-paint/bridge/physicsPaintLaunchContext.test.ts src/components/physic-paint/bridge/usePhysicsPaintParentBridge.test.ts src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.test.ts src/stores/projectStore.test.ts -x`
8. Run relevant existing Physics Paint subtree and approved Copy/Apply suites with `pnpm --filter efx-motion-editor exec vitest run ...`; never watch mode.
9. `pnpm --filter efx-motion-editor typecheck && cargo check --manifest-path /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/Cargo.toml && pnpm --filter @efxlab/efx-physic-paint check && pnpm --filter @efxlab/efx-physic-paint build && pnpm -C /Users/lmarques/Dev/efx-motion-editor build && git -C /Users/lmarques/Dev/efx-motion-editor diff --check`
10. Return control to the quick orchestrator. Only it invokes `gsd-verifier` and creates the final verification artifact.
</post_uat_continuation>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Standalone webview → parent bridge | Untrusted/duplicated typed messages may request filesystem-affecting operations but may carry only operation IDs/kinds, opaque script IDs, Rename names, and validated Save DTOs—never authority capabilities or paths. |
| Parent bridge → native commands | The parent verifies the mounted window/project relationship and attaches its own current saved-project authority; native independently resolves managed active-project state and never trusts standalone authority/path input. |
| Native authority → project filesystem | Managed IDs become canonical `<root>/scripts/<id>.efx-roto-script.json` paths; traversal, symlinks, stale roots, unrelated files, and races must not escape containment. |
| External JSON → durable parser/runtime clipboard | Manually edited or malformed files cross strict schema/size/count/numeric/WebP validation before selectable rows or immutable replay data exist. |
| Live engine/frame → persisted preset | Mutable accepted work crosses the approved cooperative drain into an autonomous DTO and script-only thumbnail without changing clipboard/history/cache ownership. |
| Persisted preset → existing Apply | Loaded data crosses into the immutable clipboard replacement boundary; no engine mutation occurs until the existing Apply transaction is explicitly invoked. |
| Source project → Save As destination | Valid autonomous files cross project roots with collision/dedupe/remap rules while source, invalid destination content, and unrelated files remain intact. |
| Production automation → native UAT → regression stage | Automated baselines cannot authorize test creation or completion; explicit mounted user approval is the hard gate for Task 3. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-260716-DBY-01 | Spoofing | project authority lifecycle | high | mitigate | Keep authority parent/native-owned, verify the mounted window/project relationship in parent, independently resolve managed active-project state in native, rotate on project switch/Save As, clear on close, and expose no authority token to standalone. |
| T-260716-DBY-02 | Tampering | native managed path construction | high | mitigate | Accept canonical UUID IDs only; construct fixed directory/extension internally; reject separators, absolute/traversal input, filename-ID mismatch, symlinks, nonregular files, and canonical escapes. |
| T-260716-DBY-03 | Tampering | Save/Rename/Delete | high | mitigate | Revalidate immediately before operation, use unique same-directory temp plus flush/close/atomic replace, preserve previous content on failure, and delete only the exact selected validated managed file. |
| T-260716-DBY-04 | Tampering | Save As collisions | high | mitigate | Validate source/destination documents, semantic-dedupe identical same-ID content, fresh-ID remap differing content, preserve source and invalid/unrelated destination files, and switch authority only after migration result. |
| T-260716-DBY-05 | Information Disclosure | bridge and persisted metadata | high | mitigate | Never expose or persist absolute/root/session paths or authority capabilities in standalone context/messages; bridge only typed display metadata, operation IDs, opaque script IDs, and validated payloads; sanitize diagnostics before LOG display. |
| T-260716-DBY-06 | Denial of Service | scan/parser/Base64 payloads | high | mitigate | Enforce byte, candidate, brush, continuation, point, string, dimension, decoded-thumbnail, and finite-number limits before expensive processing; isolate failures per file. |
| T-260716-DBY-07 | Tampering | thumbnail payload | high | mitigate | Require fixed data URL prefix, actual WebP MIME, Base64 validation, RIFF/WEBP signature, bounded actual dimensions/bytes, and no fallback or partial preset on encoding failure. |
| T-260716-DBY-08 | Repudiation | external changes and operation results | medium | mitigate | Correlate request/result by operation ID and kind, rescan after missing/external changes, preserve concise local status and structured LOG details, and never silently delete malformed files. |
| T-260716-DBY-09 | Elevation of Privilege | arbitrary frontend filesystem access | critical | mitigate | Expose standalone only to token-free typed parent-bridge operations; parent attaches current authority, native checks managed active state, and no library command accepts standalone root/path/authority selection or reuses generic path-bearing commands. |
| T-260716-DBY-10 | Tampering | persisted replay data → engine | high | mitigate | Field-by-field parse into fresh DTO/runtime objects, strip ephemeral ownership, deep-freeze through the approved controller, and retain the existing Apply path as sole replay owner. |
| T-260716-DBY-11 | Denial of Service | effect-driven lifecycle races | medium | mitigate | Use a focused Signals controller, explicit lifecycle actions, operation locks/correlation, and disposal cleanup rather than broad effect synchronization or a permanent watcher. |
| T-260716-DBY-12 | Repudiation | UAT/test execution boundary | high | mitigate | Blocking-human Task 3 forbids deferred tests until explicit A–M approval; resume replans a separately checked post-UAT plan; production status remains `production-ready for native UAT`; only the orchestrator runs the final verifier after continuation gates pass. |
| T-260716-DBY-SC | Tampering | package installs | low | accept | No package installation is planned; use existing Preact Signals, Lucide, Tauri, pnpm workspace, Canvas, and Rust dependencies. |
</threat_model>

<source_coverage_audit>

| SOURCE | ID | Feature/Requirement | Task | Status | Notes |
|--------|----|---------------------|------|--------|-------|
| GOAL | QUICK-260716-DBY | Durable project-scoped Physics Paint Roto script library on approved Copy/Apply | 1–3 + continuation | COVERED | Bounded production, native UAT stop, complete deferred mapping, replanning, and orchestrator-only final verification are explicit. |
| REQ | Production split | Production only → blocking UAT → post-approval tests/final gates | 1–3 + continuation | COVERED | Task 3 blocks; exact resume command creates the separately checked post-UAT plan. |
| REQ | Schema corrections | Exact kind, `schemaVersion: 1`, extension, safe unknown-v1 handling | 1, 3 | COVERED | Prompt corrections supersede conflicting research schema/version/extension advice. |
| REQ | Thumbnail corrections | Aspect-preserving ~96×64 strict WebP data URL and metadata | 1–3 | COVERED | Production capture, UAT D, regressions 24–29. |
| REQ | Replay metadata correction | Preserve all deterministic supported replay metadata | 1, 3 | COVERED | Field classification is based on deterministic replay versus ephemeral mounted/apply/engine state. |
| REQ | Native UAT A–M | Complete mounted user checklist | 2 | COVERED | All thirteen checks are included verbatim in operational form. |
| REQ | Regression 1–47 | Complete post-UAT automated coverage | continuation | COVERED | Every numbered item remains mapped to concrete disjoint files and ordered commands in `<post_uat_continuation>`. |
| CONTEXT | D-01 | Hybrid typed parent/native authority; no arbitrary paths | 1–2, continuation | COVERED | Standalone is token-free; parent attaches current authority and native independently checks managed active state. |
| CONTEXT | D-02 | Save As copy/dedupe/remap/preserve behavior | 1–3 | COVERED | Production migration, UAT K, filesystem regression 15. |
| CONTEXT | D-03 | Inline unique bounded Rename; ID filename stable | 1–3 | COVERED | Production UI/native transaction, UAT I, library/UI regressions. |
| CONTEXT | D-04 | Invalid files omitted, valid retained, skipped count and LOG, no deletion | 1–3 | COVERED | Parser isolation, UAT J, regressions 7/31/35/47. |
| CONTEXT | D-05 | Four compact tabs, icon toolbar, rows, exact disabled Import | 1–3 | COVERED | Production responsive UI, UAT L, regressions 42–47. |
| CONTEXT | D-06 | Parent-sourced project/layer metadata; capture-time durability | 1–2, continuation | COVERED | Token-free launch/update context carries name/saved/layer metadata with no path derivation; continuation covers lifecycle contracts. |
| CONTEXT | D-07 | Approved clipboard and sole Apply contracts | 1–3 | COVERED | Narrow controller seams, UAT G/H/M, regressions 36–41. |
| CONTEXT | D-08 | Autonomous files, saved gating, naming, schema, scan lifecycle, sort | 1–3 | COVERED | All persistence/lifecycle invariants are production, UAT, and regression requirements. |
| RESEARCH | Focused Signals controller and Studio wiring | Explicit actions, compact view model, no broad effect sync | 1, 3 | COVERED | Matches project Preact guidance. |
| RESEARCH | Native canonical containment/atomic operations | Managed authority service and strict filesystem validation | 1, 3 | COVERED | Adopted where consistent with locked decisions. |
| RESEARCH | Suggested kind/version/extension/256×144/name/unknown-field rejection | Conflicts with authoritative prompt | none | SUPERSEDED | Replaced by exact prompt corrections; not a planning gap. |
| CONTEXT | Deferred real cross-project Import | Import implementation | none | EXCLUDED | Only the locked disabled UI control is included. |
| CONTEXT | Deferred registry/index | `.mce` registry or `scripts/index.json` | none | EXCLUDED | Explicitly prohibited and negatively covered by regression 16. |
| CONTEXT | Deferred arbitrary-path API | Generic frontend filesystem paths | none | EXCLUDED | Explicitly prohibited. |
| CONTEXT | Deferred second Apply | Alternate replay path | none | EXCLUDED | Existing approved Apply remains sole replay path. |
</source_coverage_audit>

<verification>
1. Tasks 1 and 2 each run a separate `git status --porcelain -- <explicit deferred paths>` guard before baseline commands; any deferred TypeScript or Rust integration-test change fails the task.
2. Task 3 is the blocking-human stop. Native A–M approval is the sole authorization to resume into post-UAT continuation planning; production failures return to production-only repair and this checkpoint.
3. The initial plan contains no post-UAT executor or final-verifier task. After approval, the exact resume command creates and checks `260716-dby-POST-UAT-PLAN.md`, whose focused units implement regressions 1–47 and ordered gates.
4. Only after that continuation finishes does control return to the quick orchestrator; only the orchestrator invokes `gsd-verifier` and creates final `260716-dby-VERIFICATION.md`.
5. No server is started and Chrome DevTools is not used. JavaScript tests use pnpm with `vitest run`; native tests use the existing Cargo manifest. Native UAT L, not jsdom/source assertions, remains layout authority.
</verification>

<success_criteria>
- The project contains a secure autonomous script library with exact schema kind/version/extension, complete deterministic replay metadata, strict validation, strict small WebP preview, and no path/registry/index leakage.
- Save, scan, Load, Rename, Delete, Refresh, project open/close, SCRIPTS entry, and Save As behave exactly as locked while preserving the approved clipboard/Apply/cache/history/Motion contracts.
- The SCRIPTS surface is compact, accessible, responsive, and reports local status plus detailed existing LOG diagnostics without implementing real Import.
- Production execution stops and reports only `production-ready for native UAT`; all A–M mounted checks receive explicit user approval before any new regression work begins.
- After explicit A–M approval, the separately checked post-UAT continuation implements all 47 mapped regressions and ordered focused/broad/static/build gates; only after it finishes does the quick orchestrator invoke the final GSD verifier.
</success_criteria>

<output>
After Task 2, stop at Task 3 and report only `production-ready for native UAT`. Print the exact resume command `/gsd-quick resume implement-durable-project-scoped-physics`. After explicit A–M approval, that resume invokes post-UAT continuation planning and creates `/Users/lmarques/Dev/efx-motion-editor/.planning/quick/260716-dby-implement-durable-project-scoped-physics/260716-dby-POST-UAT-PLAN.md`; it does not execute tests directly from this initial plan. The quick remains in progress and STATE remains incomplete until the checked continuation plan finishes, its SUMMARY is recorded, and the quick orchestrator—not an executor task—runs the final verifier and creates `/Users/lmarques/Dev/efx-motion-editor/.planning/quick/260716-dby-implement-durable-project-scoped-physics/260716-dby-VERIFICATION.md`.
</output>
