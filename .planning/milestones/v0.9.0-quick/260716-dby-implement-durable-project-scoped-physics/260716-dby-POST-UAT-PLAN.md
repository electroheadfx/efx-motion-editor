---
phase: quick-260716-dby-post-uat
plan: 01
type: execute
mode: quick-full-post-uat
wave: 1
depends_on: []
autonomous: true
production_head: d6731712
requirements:
  - QUICK-260716-DBY-POST-UAT
files_modified:
  # Task 1 — schema, thumbnail, and native integration regressions
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.test.ts
  - app/src-tauri/tests/script_library_schema.rs
  - app/src-tauri/tests/script_library_filesystem.rs
  - app/src-tauri/tests/script_library_lifecycle.rs
  - app/src-tauri/Cargo.toml
  - app/src-tauri/src/lib.rs
  - app/src-tauri/src/services/script_library.rs
  - app/src-tauri/src/commands/script_library.rs
  # Task 2 — controller, clipboard, launch, bridge-hook, and lifecycle regressions
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts
  - app/src/components/physic-paint/hooks/useRotoScriptLibraryController.test.ts
  - app/src/components/physic-paint/bridge/physicsPaintLaunchContext.test.ts
  - app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.test.ts
  - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.test.ts
  - app/src/stores/projectStore.test.ts
  # Task 3 — mounted UI/bridge/Studio regressions and execution summary
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/lib/physicPaintBridge.test.ts
  - app/src/components/physic-paint/bridge/physicsPaintSessionFile.test.ts
  - .planning/quick/260716-dby-implement-durable-project-scoped-physics/260716-dby-SUMMARY.md
must_haves:
  truths:
    - "All 47 deferred requirements from the authoritative quick plan are mapped to behavioral tests and focused-to-broad commands without changing the native-UAT-approved production contract."
    - "Schema and native integration regressions prove autonomous `efx-physics-paint-roto-script` documents with `schemaVersion: 1`, UUID `.efx-roto-script.json` files, bounded validation, canonical containment, atomic operations, revision conflicts, malformed isolation, and Save As copy/dedupe/remap/source-preservation behavior."
    - "Thumbnail regressions prove approximately 96×64 actual lossy WebP at quality 0.8, strict browser WebP behavior, the bounded parent/native encoder path added in `48427a15`, main-window-only dispatch, capture-time paper/background, white transparency flattening, script-only pixels, and no partial preset on failure."
    - "Signals/controller regressions prove request-time bridge-mode redetection after an initial `Unavailable` state as fixed in `d6731712`, generation-based stale-result rejection, explicit lifecycle scans/clear, external-change recovery, deterministic naming/order, and no watcher or broad synchronization effect."
    - "Clipboard and mounted integration regressions prove Save captures the active editable real frame without changing the reusable clipboard, Load explicitly installs an independent immutable clipboard, and the existing Apply path alone retains current Motion, fresh mutation IDs, destination ownership, generated-frame rejection, absolute spacing, per-brush Undo/Redo, additive repaint, and final publication."
    - "UI regressions prove semantic DOM, keyboard and focus behavior, exact disabled reasons/tooltips, status/LOG routing, and deterministic compact CSS invariants while leaving native UAT L as the sole pixel/layout authority."
    - "Parent-owned Save State regressions cover the secure bridge and overlapping request isolation from `eecd7935`; the stale source-text expectation for direct standalone dialog/filesystem imports is replaced rather than preserved."
    - "The standalone capability remains split and contains no generic filesystem/path/dialog authority; project and filesystem authority stay parent/native-owned."
    - "Every focused Rust/Vitest gate, the broader native/app/Physics Paint gates, typechecks, package builds, root build, and `git diff --check` pass before the English SUMMARY records `status: complete`."
  artifacts:
    - path: "app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts"
      provides: "Frontend schema round-trip, stripping, ordering, deterministic metadata, validation-limit, and malformed-document regressions for mappings 1–7."
    - path: "app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.test.ts"
      provides: "Strict browser/native WebP composition and failure regressions for mappings 24–29 and measured failure `48427a15`."
    - path: "app/src-tauri/Cargo.toml"
      provides: "Non-default `script-library-test-support` Cargo feature, disabled in normal builds."
    - path: "app/src-tauri/src/lib.rs"
      provides: "Feature-gated narrow test-support module wrapping controlled production script-library behavior without publishing services or commands."
    - path: "app/src-tauri/tests/script_library_schema.rs"
      provides: "Native schema parity, malformed isolation, validation limits, and lossy WebP request/output validation through the test-only support surface."
    - path: "app/src-tauri/tests/script_library_filesystem.rs"
      provides: "Canonical managed containment, atomicity, revision conflicts, safe delete, missing-directory, no-index, and main-window/split-capability regressions."
    - path: "app/src-tauri/tests/script_library_lifecycle.rs"
      provides: "Saved-project authority and Save As copy/dedupe/remap/source-preservation lifecycle regressions."
    - path: "app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts"
      provides: "Signals controller operation generation, naming, sorting, scan triggers, external change, status, and project lifecycle regressions."
    - path: "app/src/components/physic-paint/hooks/useRotoScriptLibraryController.test.ts"
      provides: "Persistent hook/controller request-time bridge redetection regression for production fix `d6731712`."
    - path: "app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts"
      provides: "Mounted compact toolbar/list/rename/delete/accessibility/status behavior and deterministic CSS contract checks."
    - path: "app/src/components/physic-paint/bridge/physicsPaintSessionFile.test.ts"
      provides: "Parent-owned native Save State bridge and overlapping request isolation regressions for `eecd7935`."
    - path: ".planning/quick/260716-dby-implement-durable-project-scoped-physics/260716-dby-SUMMARY.md"
      provides: "English quick execution summary with `status: complete`, exact commits, tests, gates, and any evidenced unrelated full-suite failures."
  key_links:
    - from: "frontend persisted schema tests"
      to: "native schema integration tests"
      via: "shared exact kind/version/extension, field/range/date/Base64/WebP constraints, ordered logical brush groups, and safe unknown optional version-1 fields"
      pattern: "efx-physics-paint-roto-script|schemaVersion|efx-roto-script"
    - from: "thumbnail composition test"
      to: "parent/native WebP encoder command"
      via: "bounded operation-correlated RGBA request, main-window authorization, lossy quality 0.8 encoding, and validated actual output dimensions"
      pattern: "encodeWebp|script_library_encode_thumbnail_webp|quality"
    - from: "persistent library hook"
      to: "standalone request transport"
      via: "dispatch-time bridge-mode lookup and Tauri redetection after initial `Unavailable`"
      pattern: "detectPhysicsPaintBridgeMode|sendPhysicPaintScriptLibraryRequest"
    - from: "library Save and Load actions"
      to: "approved clipboard controller"
      via: "cooperative active-frame persistence capture and explicit deep-cloned/frozen clipboard replacement without a second replay path"
      pattern: "captureScriptForPersistence|replaceClipboardFromPersisted|applyScript"
    - from: "standalone state Save"
      to: "main-window dialog/write authority"
      via: "operation-local request/result listener, sentinel, payload, and result promise so overlapping saves cannot cross-acknowledge"
      pattern: "PHYSIC_PAINT_STATE_SAVE_REQUEST_EVENT|operationId|parent-owned-native-save"
    - from: "mounted SCRIPTS panel"
      to: "Signals library view model and existing LOG"
      via: "semantic controls and explicit callbacks; concise local status plus detailed diagnostics routed through the existing error/status seam"
      pattern: "PhysicsPaintScriptsPanel|aria-live|log"
---

<objective>
Encode the explicitly approved native A–M behavior for quick 260716-dby as durable regressions, including the two measured UAT failure fixes and the concurrent parent-owned Save State isolation fix, then run the complete ordered verification ladder.

Purpose: Preserve the mounted production contract at head `d6731712` without adapting production behavior to tests, reopening approved visual decisions, weakening parent/native authority, or allowing regression coverage to create a second Apply or generic standalone filesystem path.
Output: Exactly three atomic implementation tasks covering requirements 1–47, focused Rust and Vitest regressions, broader native/app/package/build gates, and an English `260716-dby-SUMMARY.md`; final verifier ownership remains with the quick orchestrator.

Authorization evidence: `/Users/lmarques/Dev/efx-motion-editor/.planning/quick/260716-dby-implement-durable-project-scoped-physics/260716-dby-UAT.md` records explicit A–M approval on 2026-07-16. This authorizes deferred regression creation only. Locked decisions D-01 through D-08 and the original plan contracts remain authoritative.
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
@/Users/lmarques/Dev/efx-motion-editor/.planning/quick/260716-dby-implement-durable-project-scoped-physics/260716-dby-PLAN.md
@/Users/lmarques/Dev/efx-motion-editor/.planning/quick/260716-dby-implement-durable-project-scoped-physics/260716-dby-PRODUCTION-CHECKPOINT.md
@/Users/lmarques/Dev/efx-motion-editor/.planning/quick/260716-dby-implement-durable-project-scoped-physics/260716-dby-REVIEW.md
@/Users/lmarques/Dev/efx-motion-editor/.planning/quick/260716-dby-implement-durable-project-scoped-physics/260716-dby-UAT.md

@/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts
@/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.ts
@/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
@/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
@/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/hooks/useRotoScriptLibraryController.ts
@/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
@/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
@/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/bridge/physicsPaintSessionFile.ts
@/Users/lmarques/Dev/efx-motion-editor/app/src/lib/physicPaintBridge.ts
@/Users/lmarques/Dev/efx-motion-editor/app/src/stores/projectStore.ts
@/Users/lmarques/Dev/efx-motion-editor/app/src-tauri/src/services/script_library.rs
@/Users/lmarques/Dev/efx-motion-editor/app/src-tauri/src/commands/script_library.rs
@/Users/lmarques/Dev/efx-motion-editor/app/src-tauri/capabilities/default.json
@/Users/lmarques/Dev/efx-motion-editor/app/src-tauri/capabilities/physics-paint.json
</context>

<execution_rules>
- Begin by confirming `git rev-parse HEAD` is `d673171246f437ce2ad1f453b95e1ae1d8dcc5ea` or a descendant containing `d6731712`, `48427a15`, and `eecd7935`; stop on a divergent production baseline.
- Tests encode approved behavior. Production edits are allowed only for the smallest test seam needed to exercise a private Rust command/service boundary or for a real behavior defect revealed by a regression. Never change production merely to satisfy an assertion shape.
- Prefer behavior through existing public interfaces. Source/config contract assertions are reserved for Tauri capability isolation and deterministic CSS rules that jsdom cannot observe.
- Use Preact-native mounted tests with existing dependencies and configuration. Do not add a test configuration, testing package, package install, server process, browser automation, or Chrome DevTools.
- Run Vitest with `vitest run`; use `--bail=1` for focused fail-fast commands. Vitest 2 in this repository does not accept `-x`.
- Use pnpm and the existing Cargo manifest. Do not use npm.
- Task 1, Task 2, and Task 3 each end in one atomic production/test commit for that task. Task 3 creates the final SUMMARY after all gates pass but leaves planning documentation uncommitted for the orchestrator.
- Do not update `.planning/STATE.md`, do not create `260716-dby-VERIFICATION.md`, and do not invoke the final verifier. Return control to the quick orchestrator after the SUMMARY exists.
</execution_rules>

<tasks>

<task type="auto">
  <name>Task 1: Lock durable schema, native filesystem security, lifecycle, and WebP contracts</name>
  <files>app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts, app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.test.ts, app/src-tauri/tests/script_library_schema.rs, app/src-tauri/tests/script_library_filesystem.rs, app/src-tauri/tests/script_library_lifecycle.rs, app/src-tauri/Cargo.toml, app/src-tauri/src/lib.rs, app/src-tauri/src/services/script_library.rs, app/src-tauri/src/commands/script_library.rs</files>
  <action>Create the two frontend test files and three Rust integration-test files named above. Keep Task 1 ownership limited to mappings 1–16 and 24–29 plus the native security and Save As lifecycle portions required by D-01, D-02, D-04, D-06, and D-08.

For `physicsPaintRotoScriptSchema.test.ts`, build independent literal fixtures around the public serializer/parser/row helpers. Prove exact `kind: "efx-physics-paint-roto-script"`, `schemaVersion: 1`, canonical UUID IDs, and `.efx-roto-script.json`; ordered primary-plus-continuation groups; complete point dynamics, params/opacity, pen, diffusion, `playFrame`, `physicsMode`, and every supported deterministic replay field; removal of mutation/session/apply/waiter/generation/cache/publication ownership; capture-time project/layer/frame/background metadata; safe unknown optional version-1 fields; rejection of unknown schema versions and malformed/oversized UUID/date/numeric/tool/parameter/point/continuation/Base64/WebP/dimension/count inputs. Assert fresh object creation rather than fixture aliasing. Mapping coverage: 1–7.

For `physicsPaintRotoScriptThumbnail.test.ts`, use a deterministic canvas/context fake or the closest existing canvas test seam to prove aspect fitting inside 96×64 including 96×54 for 16:9, white fill for transparency, capture-time solid/paper composition before script alpha, exclusion of any cached-base input, quality exactly 0.8, and strict data URL/MIME/signature/dimensions/size validation. Add both paths: strict browser `toBlob('image/webp', 0.8)` with null/wrong-MIME/non-WebP/oversize failure, and the bounded native encoder port introduced by `48427a15` where RGBA length, requested dimensions, returned dimensions, MIME, bytes, and quality must correlate. Prove encoder failure prevents a valid thumbnail result; Task 2/3 will prove this prevents persistence. Mapping coverage: 24–29.

For Rust, define a non-default Cargo feature named `script-library-test-support` in `app/src-tauri/Cargo.toml`. Under `#[cfg(feature = "script-library-test-support")]` only, expose `pub mod script_library_test_support` from `app/src-tauri/src/lib.rs`. This module must be a narrow wrapper over the actual production script-library implementation: it may bind a uniquely named fixture root under `std::env::temp_dir()`, invoke controlled scan/load/save/rename/delete/migrate operations, call production schema validation and native lossy WebP encoding validation, and provide deterministic failure injection where atomicity/error tests require it. Every path accepted by the support API must be resolved beneath the module-owned temporary root with deterministic cleanup guards; expose no arbitrary project path, Tauri IPC/capability surface, command adapter, window handle, or broad `services` module. The feature has no default activation, is test-only, and must leave the normal library/runtime API and security boundary unchanged.

Use that feature-gated support from the three external integration tests rather than trying to import private `services` or command helpers. `script_library_schema.rs` proves frontend/native schema parity, safe optional version-1 fields, strict limits, canonical Base64, decodable one-image-chunk WebP with exact dimensions, malformed isolation, and real lossy WebP output validation. `script_library_filesystem.rs` proves canonical active-project `scripts/` containment, UUID filename construction, stale authority rejection, traversal/absolute/separator/symlink/nonregular/escape rejection, same-directory atomic replacement, previous-content preservation on injected failure, owned-temp cleanup, external revision conflict behavior, safe exact-file Delete, empty scan when `scripts/` is missing, and absence of `.mce` registry or `scripts/index.json`. It also reads the two capability JSON files only as a security contract check: the standalone capability has core window/event permissions only and no generic filesystem, path, dialog, invoke, or project-authority permission. `script_library_lifecycle.rs` proves Save As copies validated managed files, preserves source, deduplicates semantically identical same-ID documents, remaps differing valid or invalid-occupied collisions with updated JSON ID/filename, preserves malformed and unrelated destination files, and keeps destination results loadable. Mapping coverage: 6–16, 22, 30–31 where native lifecycle behavior applies.

The native lossy WebP command currently couples `WebviewWindow` authorization to encoding. Keep `require_main_window` and all runtime native commands private. The feature-gated support may call only a bounded production encoder/validator seam and may not impersonate a Tauri window or expose command invocation. Prove encoder operation IDs/dimensions/quality/RGBA lengths are bounded, output is actual decodable WebP with requested dimensions, quality 0.8 is accepted, and malformed/oversized requests fail through the test support. Prove the main-window-only command restriction and capability split through the safest existing colocated unit test and narrow source/config contract assertions; do not publish command helpers merely for integration tests.

Preferred resolution is the feature-gated integration support above. If implementation inspection shows that colocated Rust unit tests can materially more safely cover every native behavior without an external seam, the executor may deviate only by keeping those test modules bounded beside the production implementation, removing any need for external private access, retaining all three named integration-test responsibilities or equivalently focused commands, and documenting in the Task 1 commit/SUMMARY how the checker concern is resolved. In either path, normal builds must not enable test support and the production API/security contract must remain unchanged. No other production edit is permitted unless a test reveals a real approved-contract bug.

Run the focused frontend and three focused Rust integration gates. Commit Task 1 atomically with only its test artifacts and any strictly necessary Rust seam/real-bug fix.</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.test.ts --bail=1</automated>
    <automated>cargo test --manifest-path /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/Cargo.toml --features script-library-test-support --test script_library_schema -- --nocapture && cargo test --manifest-path /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/Cargo.toml --features script-library-test-support --test script_library_filesystem -- --nocapture && cargo test --manifest-path /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/Cargo.toml --features script-library-test-support --test script_library_lifecycle -- --nocapture</automated>
    <automated>git -C /Users/lmarques/Dev/efx-motion-editor diff --check</automated>
  </verify>
  <done>Mappings 1–16 and 24–29 have executable frontend/native regressions; the `48427a15` native lossy WebP path, caller restriction, exact bounds/output, split capabilities, canonical filesystem authority, atomicity, conflicts, malformed isolation, no registry/index, and Save As lifecycle contracts are proven. Task 1 is committed atomically without production test accommodation.</done>
</task>

<task type="auto">
  <name>Task 2: Lock Signals controller, bridge redetection, clipboard, Apply, and explicit lifecycle behavior</name>
  <files>app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts, app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts, app/src/components/physic-paint/hooks/useRotoScriptLibraryController.test.ts, app/src/components/physic-paint/bridge/physicsPaintLaunchContext.test.ts, app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.test.ts, app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.test.ts, app/src/stores/projectStore.test.ts</files>
  <action>Create `physicsPaintRotoScriptLibrary.test.ts` and `useRotoScriptLibraryController.test.ts`, then extend only the listed existing tests. Own mappings 17–23 and 30–41, implementing D-03, D-04, D-06, D-07, and D-08 without duplicating Task 1 native assertions or Task 3 mounted panel assertions.

In `physicsPaintRotoScriptLibrary.test.ts`, exercise the controller through typed fake ports and controlled promises. Cover unsaved gating with exact `Save the project first.` and no request/temp-project persistence; Save source capture before thumbnail/persistence; new UUID on every Save; exact `[project]-[layer]-[frame]`, `-2`, `-3` naming from the current validated scan; immutable `createdAt` descending plus stable ID tie sort; Rename preserving order/created time and using expected revision; duplicate Unicode-NFC name retaining edit state and concise error; Delete selection recovery; skipped-invalid status and detailed LOG routing; external deletion/replacement on Load/Rename/Delete failing safely and rescanning; and every explicit scan trigger: saved open/context settle, each SCRIPTS entry, Save, Rename, Delete, Save As context transition, and Refresh. Prove context and operation generations reject stale results after project switch/close/dispose, overlapping mutations cannot publish, project close clears synchronously, and no timer/watcher/broad effect is required by driving only public explicit actions. Mapping coverage: 17, 22–23, 30–35, 47 controller portion.

In `useRotoScriptLibraryController.test.ts`, mount a tiny Preact harness with existing Preact/test utilities and mock the established bridge modules at their public seam. Regress the exact `d6731712` failure: initial mode is `Unavailable`, Tauri becomes available without recreating the persistent controller, the next request calls `detectPhysicsPaintBridgeMode()` at dispatch time, and transport receives the newly detected current mode. Also prove later requests use the latest mode, operation-correlated results settle only their matching promise, timeout/disposal clears pending operations, and stale/unrelated results do not mutate controller state. Do not reimplement hook internals in the expected values.

Extend `physicsPaintRotoScriptClipboard.test.ts` through the approved controller interface. Prove persistence capture uses the active editable real frame and cooperative accepted-mutation drain, rejects generated/empty/cached-only sources, returns script plus the matching immutable script-alpha snapshot, and leaves existing clipboard identity, source frame, Undo/Redo/history/cache ownership, and Apply availability unchanged. Prove explicit persisted Load creates a deep clone/freeze with no live binding to DTO/file/row/source objects and remains reusable after durable Rename/Delete. Reuse existing Apply harnesses to assert Load does not replay; subsequent Apply alone uses current visible Motion rather than persisted values, creates fresh mutation IDs, retains exact target ownership, rejects generated destinations, preserves absolute interpolation spacing, creates per-brush Undo/Redo entries, merges cached repaint additively, and publishes one final composite. Do not create a second replay callback or alter `applyScript()`. Mapping coverage: 18–21 and 36–41.

Extend launch/context/parent-hook tests only where they provide behavioral leverage: parent-sourced project name/saved/context ID and stable layer ID/name survive parsing without filesystem paths; launch replacement preserves the immutable clipboard while the library context explicitly clears/rescans; Save As rotates context only after the migration/save transaction and retains source state on failure; open/save-as/close deliver the expected lifecycle transitions. Extend `projectStore.test.ts` with focused injected/native mocks for Save As source preservation, destination authority remap/dedupe result handling, context publication ordering, failure rollback, and close clear. Do not assert implementation-specific hook ordering when public state/results can prove behavior.

Run Task 2 focused suites, then the approved Copy/Apply regression set. If a regression reveals a real production defect, make only the smallest production correction at the owning seam and include it in this atomic commit; otherwise commit tests only.</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts src/components/physic-paint/hooks/useRotoScriptLibraryController.test.ts src/components/physic-paint/bridge/physicsPaintLaunchContext.test.ts src/components/physic-paint/bridge/usePhysicsPaintParentBridge.test.ts src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.test.ts src/stores/projectStore.test.ts --bail=1</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts src/components/physic-paint/roto/rotoApplyTransactions.test.ts src/components/physic-paint/roto/rotoCacheTransactions.test.ts src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts src/components/physic-paint/roto/rotoSourceDisplayModel.test.ts src/lib/physicPaintRotoDurableCore.test.ts --bail=1</automated>
    <automated>git -C /Users/lmarques/Dev/efx-motion-editor diff --check</automated>
  </verify>
  <done>Mappings 17–23 and 30–41 are covered through controller/clipboard/lifecycle interfaces; `d6731712` request-time redetection, stale generation handling, Save capture stability, explicit immutable Load, current Motion and all approved Apply invariants, explicit scans, external changes, Save As ordering, and project close clear are proven. Task 2 is committed atomically without adapting approved behavior to tests.</done>
</task>

<task type="auto">
  <name>Task 3: Lock mounted SCRIPTS UI, parent bridge and Save State isolation, then run all gates</name>
  <files>app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts, app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts, app/src/components/physic-paint/PhysicsPaintStudio.test.ts, app/src/lib/physicPaintBridge.test.ts, app/src/components/physic-paint/bridge/physicsPaintSessionFile.test.ts, .planning/quick/260716-dby-implement-durable-project-scoped-physics/260716-dby-SUMMARY.md</files>
  <action>Create `PhysicsPaintScriptsPanel.test.ts` and extend the four listed existing suites. Own mappings 42–47 plus mounted integration portions of 17, 21, 29, 34, 38, 39, and 41. Keep D-01, D-04, D-05, D-07, and D-08 exact. Native UAT L remains the visual/layout authority; automated UI tests assert semantic DOM and deterministic CSS rules only and must not claim pixel proof.

Mount `PhysicsPaintScriptsPanel` and, where needed, `PhysicsPaintRightPanel` with Preact's existing renderer/test utilities and real Signals controller/view-model values. Prove TOOL/ONION/MOTION/SCRIPTS are semantic tabs with stable selected panel state; entering SCRIPTS explicitly scans; the toolbar has exactly one row of six Lucide-backed semantic buttons in Save/Load/Rename/Delete/Refresh/Import order; every control has an accessible name and title; unsaved Save exposes exact `Save the project first.` through a focusable described wrapper; disabled Import exposes exact `Import from another project — coming later` and dispatches nothing; availability follows selection/busy state; rows use stable option IDs/selected state, validated thumbnail metadata, ellipsized name/provenance/count semantics, and keyboard Arrow/Home/End/Enter/Delete behavior. Prove inline Rename Enter commit, Escape cancel, duplicate error persistence, and focus-contained Delete confirmation with selected name, Tab/Shift+Tab wrapping, Escape cancel, and focus restoration. Prove concise status/skipped count is live and detailed failures reach the existing LOG/error routing seam.

Add deterministic CSS contract assertions in the panel test by reading only the relevant named rule blocks from `physicsPaintStudio.css`: nonwrapping four-tab strip, six equal toolbar columns, `min-width: 0` on shrinkable row/panel content, thumbnail size within the locked 40–56 px range, text overflow/ellipsis, internal vertical scrolling, narrow single-column panel behavior, and no rule that forces horizontal page overflow. These assertions document structural invariants only; SUMMARY must cite native UAT L for actual fit, clipping, overlap, scrolling, and visual quality.

Extend `PhysicsPaintStudio.test.ts` with mounted/wiring assertions that Save invokes active-frame persistence capture rather than clipboard data, thumbnail failure/null/wrong output produces no library save request and routes an error, selection alone changes neither clipboard/frame/Apply state, Rename/Delete after Load leave the loaded clipboard reusable, Load never invokes replay, Apply delegates to the approved existing controller callback, operation completion retains final publication behavior, and library status/diagnostics route to the right panel LOG. Prefer behavioral module seams over adding more broad source concatenation checks.

Extend `physicPaintBridge.test.ts` to prove typed operation/result correlation, parent attachment of current saved-project authority, rejection of stale or absent authority, native thumbnail request/result correlation and bounds, main-window-targeted encoding, project/layer metadata without path leakage, and no generic standalone filesystem capability. Capability JSON/source checks are acceptable here because permissions are not observable in jsdom; keep them narrowly scoped to the two capability files and command/event names.

Update `physicsPaintSessionFile.test.ts` for `eecd7935`. Remove the stale source-text expectation that standalone code imports Tauri dialog/filesystem plugins directly. Replace it with behavioral tests proving the default Tauri path sends a parent-owned typed Save State request, uses an operation-local payload/listener/sentinel/result promise, accepts only its matching result, cleans up its listener, and does not expose direct dialog/path/write authority to the standalone. Add an overlapping-save regression with two distinct states and out-of-order results proving each operation persists/acknowledges only its own JSON and cannot consume the other operation's result. Preserve existing injected adapter and browser fallback coverage.

After focused Task 3 suites pass, run the complete ordered ladder: all three Rust integration tests, full Cargo tests, focused durable/controller/UI/bridge suites, relevant Physics Paint subtree, approved Copy/Apply regressions, full app Vitest when practical, app typecheck, Cargo check, Physics Paint package check/build, root build, and `git diff --check`. If full app Vitest has an unrelated pre-existing failure, rerun the failing file on unchanged production evidence, record the exact command/output and why it is unrelated in SUMMARY, and do not hide it; all in-scope suites must still pass. Do not weaken or skip an in-scope gate.

Commit Task 3 test/production changes atomically after code gates pass. Then create `260716-dby-SUMMARY.md` in English using the standard quick summary shape with frontmatter `status: complete`, production baseline `d6731712`, explicit A–M approval date, Task 1/2/3 commit hashes, requirement mapping closure, measured regressions `48427a15`, `d6731712`, and `eecd7935`, exact gate results, and any evidenced unrelated full-suite failure. Leave the SUMMARY and all planning documentation uncommitted for the orchestrator. Do not update STATE and do not create VERIFICATION.</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts src/lib/physicPaintBridge.test.ts src/components/physic-paint/bridge/physicsPaintSessionFile.test.ts --bail=1</automated>
    <automated>cargo test --manifest-path /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/Cargo.toml --features script-library-test-support --test script_library_schema -- --nocapture && cargo test --manifest-path /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/Cargo.toml --features script-library-test-support --test script_library_filesystem -- --nocapture && cargo test --manifest-path /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/Cargo.toml --features script-library-test-support --test script_library_lifecycle -- --nocapture && cargo test --manifest-path /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/Cargo.toml --features script-library-test-support && cargo test --manifest-path /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/Cargo.toml</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.test.ts src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts src/components/physic-paint/hooks/useRotoScriptLibraryController.test.ts src/components/physic-paint/bridge/physicsPaintLaunchContext.test.ts src/components/physic-paint/bridge/usePhysicsPaintParentBridge.test.ts src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.test.ts src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts src/lib/physicPaintBridge.test.ts src/components/physic-paint/bridge/physicsPaintSessionFile.test.ts src/stores/projectStore.test.ts --bail=1</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint --bail=1 && pnpm --filter efx-motion-editor exec vitest run src/lib/physicPaintRotoDurableCore.test.ts src/lib/physicPaintBridge.test.ts src/stores/projectStore.test.ts --bail=1</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run --bail=1</automated>
    <automated>pnpm --filter efx-motion-editor typecheck && cargo check --manifest-path /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/Cargo.toml && cargo check --manifest-path /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/Cargo.toml --features script-library-test-support && pnpm --filter @efxlab/efx-physic-paint check && pnpm --filter @efxlab/efx-physic-paint build && pnpm -C /Users/lmarques/Dev/efx-motion-editor build && git -C /Users/lmarques/Dev/efx-motion-editor diff --check</automated>
    <automated>test -f /Users/lmarques/Dev/efx-motion-editor/.planning/quick/260716-dby-implement-durable-project-scoped-physics/260716-dby-SUMMARY.md && rg -n '^status: complete$|d6731712|48427a15|eecd7935' /Users/lmarques/Dev/efx-motion-editor/.planning/quick/260716-dby-implement-durable-project-scoped-physics/260716-dby-SUMMARY.md</automated>
  </verify>
  <done>Mappings 42–47 and every mounted cross-cutting portion are covered; the exact compact accessible SCRIPTS semantics, deterministic CSS invariants, status/LOG routing, native thumbnail bridge, secure parent-owned Save State, overlapping save isolation, and no generic standalone filesystem capability are proven. All ordered gates pass or an evidenced unrelated full-app failure is explicitly isolated without hiding any in-scope failure. Task 3 code is committed atomically, the English SUMMARY exists with `status: complete` and is left uncommitted, and control is returned to the orchestrator without STATE or VERIFICATION changes.</done>
</task>

</tasks>

<requirement_test_matrix>

| Req | Required regression | Primary task/test artifact | Focused command |
|-----|---------------------|----------------------------|-----------------|
| 1 | Round-trip ordered logical brushes and durable metadata | T1 `physicsPaintRotoScriptSchema.test.ts` | Task 1 Vitest |
| 2 | Strip mutation/apply/waiter/generation/session/cache ownership | T1 schema test | Task 1 Vitest |
| 3 | Preserve primary and continuation grouping/order | T1 schema test | Task 1 Vitest |
| 4 | Preserve points, params, opacity, pen, diffusion, physics mode, deterministic replay fields | T1 schema test | Task 1 Vitest |
| 5 | Accept safe optional version-1 fields; reject unknown schema version | T1 schema + Rust schema | Task 1 Vitest + `script_library_schema` |
| 6 | Reject malformed and oversized numeric/point/continuation/tool/parameter/date/UUID/Base64/WebP/dimension/limit inputs | T1 schema + Rust schema | Task 1 Vitest + `script_library_schema` |
| 7 | Isolate invalid managed files while retaining valid rows | T1 Rust schema; T2 controller | `script_library_schema` + Task 2 Vitest |
| 8 | Native operations stay inside active canonical `scripts/` | T1 Rust filesystem | `script_library_filesystem` |
| 9 | Reject traversal, absolute/separator/symlink/escape/stale authority and standalone authority selection | T1 Rust filesystem | `script_library_filesystem` |
| 10 | Canonical UUID plus `.efx-roto-script.json` filename | T1 schema + Rust filesystem | Task 1 Vitest + `script_library_filesystem` |
| 11 | Save/Rename same-directory atomic replacement with flush/close | T1 Rust filesystem | `script_library_filesystem` |
| 12 | Failed writes preserve prior content and clean owned temp | T1 Rust filesystem | `script_library_filesystem` |
| 13 | Delete cannot remove unrelated/invalid/symlinked/nonselected files | T1 Rust filesystem | `script_library_filesystem` |
| 14 | Missing `scripts/` scans as empty valid library | T1 Rust filesystem | `script_library_filesystem` |
| 15 | Save As copy/preserve/dedupe/remap/preserve invalid-unrelated | T1 Rust lifecycle; T2 project lifecycle | `script_library_lifecycle` + Task 2 Vitest |
| 16 | No `.mce` registry or `scripts/index.json` | T1 Rust filesystem | `script_library_filesystem` |
| 17 | Unsaved project exact disabled reason and no temp persistence | T2 controller/project; T3 mounted UI | Task 2 + Task 3 Vitest |
| 18 | Save captures active editable real frame, not clipboard | T2 clipboard; T3 Studio | Task 2 + Task 3 Vitest |
| 19 | Generated, empty, cached-only source rejection | T2 clipboard | Task 2 Vitest |
| 20 | Cooperative drain/publication handoff | T2 clipboard | Task 2 Vitest |
| 21 | Save leaves clipboard/frame/history/cache/Apply availability unchanged | T2 clipboard; T3 Studio | Task 2 + Task 3 Vitest |
| 22 | Repeated Save creates independent UUID files | T1 filesystem; T2 controller | `script_library_filesystem` + Task 2 Vitest |
| 23 | Exact base, `-2`, `-3` names from current validated scan | T2 controller | Task 2 Vitest |
| 24 | Actual WebP MIME/data URL/signature | T1 thumbnail + Rust schema | Task 1 Vitest + `script_library_schema` |
| 25 | Aspect fit inside ~96×64 including 96×54 | T1 thumbnail + native encoder | Task 1 Vitest + `script_library_schema` |
| 26 | Transparent capture flattens white | T1 thumbnail | Task 1 Vitest |
| 27 | Capture-time paper/background renderer | T1 thumbnail | Task 1 Vitest |
| 28 | Cached-reference/base pixels excluded | T1 thumbnail | Task 1 Vitest |
| 29 | Invalid encoding writes no partial preset and reports safely | T1 thumbnail; T3 Studio | Task 1 + Task 3 Vitest |
| 30 | Scan on open/context, SCRIPTS, Save/Rename/Delete/Save As/Refresh; no watcher | T2 controller/launch/lifecycle | Task 2 Vitest |
| 31 | Refresh finds manual valid files and isolates malformed | T1 Rust schema; T2 controller | `script_library_schema` + Task 2 Vitest |
| 32 | `createdAt` descending with stable ID tie | T2 controller | Task 2 Vitest |
| 33 | Rename retains order and `createdAt` | T2 controller | Task 2 Vitest |
| 34 | Selection alone changes nothing | T2 controller; T3 Studio | Task 2 + Task 3 Vitest |
| 35 | External delete/change fails safely, logs, rescans, drops stale row only | T1 revision/filesystem; T2 controller | `script_library_filesystem` + Task 2 Vitest |
| 36 | Explicit Load parses fresh data and deep-clones/freezes clipboard | T2 clipboard | Task 2 Vitest |
| 37 | Loaded clipboard has no live binding | T2 clipboard | Task 2 Vitest |
| 38 | Rename/Delete after Load leaves clipboard reusable | T2 clipboard; T3 Studio | Task 2 + Task 3 Vitest |
| 39 | Load never replays; Apply uses approved callback/controller | T2 clipboard; T3 Studio | Task 2 + Task 3 Vitest |
| 40 | Apply uses current visible Motion | T2 clipboard | Task 2 approved Copy/Apply gate |
| 41 | Fresh IDs, Undo/Redo, additive repaint, ownership, generated rejection, absolute spacing, final publication | T2 approved suites; T3 Studio wiring | Task 2 approved gate + Task 3 Vitest |
| 42 | Four semantic tabs and stable selected view | T3 panel/right panel | Task 3 Vitest |
| 43 | Semantic compact rows and deterministic CSS invariants | T3 panel/right panel | Task 3 Vitest; native UAT L remains visual authority |
| 44 | Accessible toolbar, keyboard selection/Rename, exact disabled reasons | T3 panel | Task 3 Vitest |
| 45 | Focus-contained Delete confirmation names selection | T3 panel | Task 3 Vitest |
| 46 | Exact disabled Import tooltip and no dispatch | T3 panel | Task 3 Vitest |
| 47 | Concise status/skipped count and detailed LOG routing | T2 controller; T3 panel/Studio | Task 2 + Task 3 Vitest |

Measured-failure regressions are additional mandatory coverage: `48427a15` is owned by Task 1 thumbnail/native tests; `d6731712` by Task 2 hook dispatch-time redetection; `eecd7935` by Task 3 Save State overlap tests.
</requirement_test_matrix>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| External managed JSON → frontend/native validators | Untrusted project files may be malformed, oversized, externally replaced, or crafted to desynchronize frontend/native behavior. |
| Standalone webview → parent bridge | Typed requests are untrusted and must not carry filesystem paths, project roots, generic invocation, or self-selected authority. |
| Parent bridge → native managed state/filesystem | Parent attaches current authority; native independently validates active state, caller restrictions, IDs, revisions, containment, and operation serialization. |
| Thumbnail RGBA → parent/native encoder → persisted WebP | Bounded raw pixels cross an operation-correlated bridge and must produce exact validated lossy WebP without format fallback or filesystem access. |
| Persisted document → immutable clipboard → existing Apply | Loaded data must become independent immutable runtime state and cannot mutate the engine until the existing Apply path is explicitly invoked. |
| Standalone Save State → parent dialog/write bridge | Concurrent save requests must remain operation-local and cannot cross-consume payloads, results, paths, or acknowledgements. |
| Automated UI tests → approved mounted UI | jsdom/CSS assertions can prove semantics and deterministic rules, not actual pixel fit; native UAT L remains authoritative. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-260716-DBY-PU-01 | Spoofing | script authority and caller identity | high | mitigate | Rust filesystem tests reject stale authority and non-main authority/thumbnail callers; bridge tests prove only parent-attached current authority reaches native. |
| T-260716-DBY-PU-02 | Tampering | managed path and atomic mutations | high | mitigate | Rust integration tests cover canonical UUID names, containment, symlinks, traversal forms, expected revisions, atomic replace, prior-content preservation, and exact-file Delete. |
| T-260716-DBY-PU-03 | Tampering | Save As collision migration | high | mitigate | Lifecycle tests prove semantic dedupe, fresh-ID remap, source preservation, invalid/unrelated destination preservation, and destination loadability. |
| T-260716-DBY-PU-04 | Information Disclosure | standalone capabilities and messages | critical | mitigate | Capability and bridge contract tests prove no generic filesystem/path/dialog/project-authority permission or payload is exposed to standalone. |
| T-260716-DBY-PU-05 | Denial of Service | schema/Base64/WebP/candidate limits | high | mitigate | Frontend/native parity tests exercise byte, count, point, continuation, numeric, date, dimensions, RGBA, Base64, and decoded-image bounds with per-file isolation. |
| T-260716-DBY-PU-06 | Tampering | WebP encoder request/result | high | mitigate | Tests cover main-window restriction, operation correlation, exact RGBA length, dimensions, quality 0.8, lossy WebP decoding, output size, and no fallback/partial persistence. |
| T-260716-DBY-PU-07 | Repudiation | stale async operation results | medium | mitigate | Controller/hook tests prove operation and context generations, request/result kind/ID correlation, timeout/disposal cleanup, and stale publication rejection. |
| T-260716-DBY-PU-08 | Elevation of Privilege | direct standalone state Save | critical | mitigate | Save State tests replace the obsolete direct-import contract with parent-owned typed requests and prove overlapping operations cannot obtain or acknowledge another save's path/payload/result. |
| T-260716-DBY-PU-09 | Tampering | persisted replay into engine | high | mitigate | Clipboard and mounted tests prove deep clone/freeze, explicit Load, no live binding, no replay on Load, and sole use of approved Apply with current destination Motion and ownership. |
| T-260716-DBY-PU-10 | Repudiation | automated visual claims | low | accept | Native UAT A–M, especially L, is already explicitly approved; automated tests are limited to semantic DOM and deterministic CSS invariants and SUMMARY cites that boundary. |
| T-260716-DBY-PU-SC | Tampering | package installation | low | accept | No package install is planned; tests use existing Preact, Signals, Vitest, Cargo, image/WebP, and workspace tooling. |
</threat_model>

<source_coverage_audit>

| SOURCE | ID | Feature/Requirement | Task | Status | Notes |
|--------|----|---------------------|------|--------|-------|
| GOAL | QUICK-260716-DBY-POST-UAT | Encode approved durable script-library behavior and run final automated gates | 1–3 | COVERED | Three bounded tasks own schema/native, controller/clipboard/lifecycle, and mounted UI/bridge/full gates. |
| REQ | 1–16 | Schema/native filesystem/lifecycle regressions | 1 | COVERED | Explicit matrix rows and focused Rust/frontend commands. |
| REQ | 17–23 | Save/source/naming/controller regressions | 2, 3 | COVERED | Controller and mounted integration split without duplicate ownership. |
| REQ | 24–29 | Strict browser/native WebP regressions | 1, 3 | COVERED | Includes measured packaged WKWebView failure fix `48427a15`. |
| REQ | 30–41 | Explicit lifecycle, immutable Load, approved Apply regressions | 2, 3 | COVERED | Includes dispatch-time bridge redetection fix `d6731712`. |
| REQ | 42–47 | Compact semantic/accessibility/status UI regressions | 3 | COVERED | Native UAT L remains pixel/layout authority. |
| REQ | Concurrent Save State | Parent-owned secure save and overlap isolation | 3 | COVERED | Includes `eecd7935` and replaces stale direct-import assertion. |
| CONTEXT | D-01 | Hybrid parent/native authority; no arbitrary paths | 1, 3 | COVERED | Native containment/caller tests plus bridge/capability tests. |
| CONTEXT | D-02 | Save As copy/dedupe/remap/source preservation | 1, 2 | COVERED | Native lifecycle plus parent transaction ordering. |
| CONTEXT | D-03 | Inline unique Rename, stable ID filename | 2, 3 | COVERED | Controller validation/revision and mounted keyboard/error behavior. |
| CONTEXT | D-04 | Invalid isolation, skipped status, LOG, no deletion | 1–3 | COVERED | Native isolation, controller diagnostics, mounted LOG. |
| CONTEXT | D-05 | Four tabs, six controls, compact rows/accessibility | 3 | COVERED | Semantic DOM/CSS regression; no pixel-proof claim. |
| CONTEXT | D-06 | Parent-sourced project/layer metadata | 1–3 | COVERED | Schema durability, launch context, bridge no-path tests. |
| CONTEXT | D-07 | Immutable clipboard and sole approved Apply | 2, 3 | COVERED | Save capture/Load independence/current Motion/full Apply invariants. |
| CONTEXT | D-08 | Autonomous files, naming, scan lifecycle, sort | 1–3 | COVERED | Exact persistence and lifecycle contracts mapped. |
| RESEARCH | Signals controller and explicit lifecycle | No watcher/broad effect synchronization | 2 | COVERED | Controlled-promise tests drive public actions and generations. |
| RESEARCH | Canonical native containment/atomicity | Filesystem safety and revision conflicts | 1 | COVERED | Rust integration tests; seam changes are narrowly bounded. |
| UAT | A–M approved | Mounted production behavior is authoritative | 1–3 | COVERED | Tests encode approval; UAT L remains visual authority. |
| CONTEXT | Deferred real Import | Cross-project Import implementation | none | EXCLUDED | Only exact disabled control regression is included. |
| CONTEXT | Deferred registry/index | `.mce` registry or `scripts/index.json` | none | EXCLUDED | Prohibited and negatively exercised by requirement 16. |
| CONTEXT | Deferred generic filesystem/path API | Standalone arbitrary filesystem authority | none | EXCLUDED | Prohibited and covered by security/capability regressions. |
| CONTEXT | Deferred second Apply | Alternate replay implementation | none | EXCLUDED | Existing approved Apply remains sole path. |
</source_coverage_audit>

<verification>
1. Task 1 proves schema/native security/lifecycle/WebP behavior and commits atomically.
2. Task 2 proves Signals/controller/clipboard/launch/project lifecycle and approved Apply behavior and commits atomically.
3. Task 3 proves mounted UI/bridge/Save State behavior, runs focused-to-broad gates, commits code atomically, and writes the uncommitted English SUMMARY.
4. Every original requirement 1–47 is present exactly once in the matrix with primary tests and commands; cross-cutting mounted checks are explicitly identified rather than silently duplicated.
5. No test configuration, package install, server, watch mode, Chrome DevTools, STATE update, or VERIFICATION artifact is introduced.
6. Production behavior is changed only for a narrow test seam or an evidenced real regression, never to accommodate assertion structure.
7. The executor returns to the quick orchestrator after SUMMARY creation; only the orchestrator commits planning docs, updates quick data/STATE, runs the final verifier, and creates final VERIFICATION.
</verification>

<success_criteria>
- All 47 deferred regressions plus the `48427a15`, `d6731712`, and `eecd7935` measured fixes have durable executable coverage.
- Frontend/native schema validation, strict WebP production, canonical secure filesystem operations, external revisions, Save As lifecycle, split capabilities, and absence of a registry/index or generic standalone filesystem authority are proven.
- Signals controller operations, explicit scan/clear lifecycle, request-time bridge redetection, immutable Save/Load clipboard semantics, current Motion, and every approved Apply ownership/history/cache/publication invariant remain green.
- Mounted SCRIPTS semantics, accessibility, keyboard/focus behavior, exact reasons/tooltips, LOG routing, and deterministic CSS rules are covered without claiming automated pixel proof.
- Rust focused and full tests, Physics Paint focused/subtree tests, full app Vitest when practical, typechecks, Cargo check, package check/build, root build, and `git diff --check` complete with honest evidence.
- Three atomic task commits exist; `260716-dby-SUMMARY.md` exists in English with `status: complete` and remains uncommitted for the orchestrator; STATE and VERIFICATION are untouched.
</success_criteria>

<output>
Create `/Users/lmarques/Dev/efx-motion-editor/.planning/quick/260716-dby-implement-durable-project-scoped-physics/260716-dby-SUMMARY.md` only in Task 3 after all in-scope gates pass. Return control to the quick orchestrator. Do not create `/Users/lmarques/Dev/efx-motion-editor/.planning/quick/260716-dby-implement-durable-project-scoped-physics/260716-dby-VERIFICATION.md` and do not update `/Users/lmarques/Dev/efx-motion-editor/.planning/STATE.md`.
</output>
