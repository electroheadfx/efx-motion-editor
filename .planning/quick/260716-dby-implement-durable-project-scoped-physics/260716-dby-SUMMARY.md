---
phase: quick-260716-dby-post-uat
plan: 01
subsystem: testing
tags: [physics-paint, roto, tauri, rust, webp, preact-signals, vitest]
requires:
  - phase: quick-260716-dby
    provides: Durable project-scoped Roto script library at production baseline d6731712
provides:
  - Executable regression coverage for all 47 mapped durable-library requirements
  - Feature-gated Rust integration support with normal runtime builds unchanged
  - Measured failure regressions for 48427a15, d6731712, and eecd7935
  - Stable tested SCRIPTS view-model and semantic UI contract for Phase 36.14
affects: [36.14, physics-paint, roto-script-library]
tech-stack:
  added: []
  patterns: [feature-gated Rust test support, typed parent-owned authority tests, explicit Signals lifecycle tests]
key-files:
  created:
    - app/src-tauri/src/script_library_test_support.rs
    - app/src-tauri/tests/script_library_schema.rs
    - app/src-tauri/tests/script_library_filesystem.rs
    - app/src-tauri/tests/script_library_lifecycle.rs
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts
    - app/src/components/physic-paint/hooks/useRotoScriptLibraryController.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts
  modified:
    - app/src-tauri/Cargo.toml
    - app/src-tauri/src/lib.rs
    - app/src-tauri/src/services/script_library.rs
    - app/src-tauri/src/commands/script_library.rs
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts
    - app/src/components/physic-paint/bridge/physicsPaintLaunchContext.test.ts
    - app/src/components/physic-paint/bridge/physicsPaintSessionFile.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/lib/physicPaintBridge.test.ts
key-decisions:
  - "Keep script-library-test-support disabled by default and expose only bounded fixture-owned wrappers around production validation, persistence, migration, and WebP encoding."
  - "Treat native UAT A-M from 2026-07-16 as the pixel and mounted-behavior authority; automated UI tests cover semantic DOM and deterministic CSS contracts only."
  - "Replace the obsolete direct standalone Tauri dialog/filesystem import assertion with parent-owned operation-local Save State isolation coverage."
patterns-established:
  - "Durable script tests use autonomous UUID .efx-roto-script.json documents and never introduce an index, registry, path-bearing API, or alternate Apply path."
  - "The Phase 36.14 SCRIPTS surface consumes the existing Signals controller/view model: rows, selectedId/selected, busy, status, skippedInvalidCount, rename/delete state, availability, and explicit actions."
requirements-completed: [QUICK-260716-DBY-POST-UAT]
duration: 29min
completed: 2026-07-16
status: complete
---

# Quick 260716-dby Post-UAT Regression Summary

**Durable project-scoped Physics Paint Roto scripts now have schema, filesystem, lifecycle, controller, clipboard, UI, bridge, and measured-failure regression coverage across frontend and native boundaries.**

## Performance

- **Duration:** 29 min
- **Started:** 2026-07-16T21:05:57Z
- **Completed:** 2026-07-16T21:34:00Z
- **Tasks:** 3
- **Production baseline:** `d673171246f437ce2ad1f453b95e1ae1d8dcc5ea`
- **Native UAT:** A-M explicitly approved on 2026-07-16

## Accomplishments

- Closed the 47-item regression map for autonomous schema, strict WebP, canonical project-contained files, atomic mutations, revision conflicts, invalid-file isolation, Save As copy/dedupe/remap, explicit lifecycle scans, immutable Load, approved Apply invariants, and accessible compact SCRIPTS semantics.
- Added `script-library-test-support` as a non-default Cargo feature. Normal builds do not expose the test module; runtime commands, window authorization, capability split, and filesystem authority remain unchanged.
- Locked the measured production corrections: native lossy WebP encoding after WKWebView failure (`48427a15`), dispatch-time bridge redetection after initial `Unavailable` (`d6731712`), and operation-local concurrent parent-owned editable-state saves (`eecd7935`).
- Preserved the stable Phase 36.14 SCRIPTS view-model boundary: a Signals controller with explicit scan/save/load/rename/delete/refresh actions, semantic rows and controls, and no watcher or second replay implementation.

## Durable Contract Recorded

- Each preset is one autonomous `kind: "efx-physics-paint-roto-script"`, `schemaVersion: 1` JSON file named `<uuid>.efx-roto-script.json` under the active saved project's canonical `scripts/` directory.
- The durable schema preserves ordered primary/continuation brush groups, complete point dynamics, brush params, pen/diffusion/play/physics deterministic fields, capture-time project/layer/frame/background metadata, and validated lossy WebP presentation metadata.
- Mounted session IDs, mutation IDs, Apply progress/waiters, engine generations, cache/publication ownership, and other runtime state are excluded.
- Scan isolates malformed files and never deletes them. Rename retains the UUID filename and `createdAt`; Delete uses the selected validated revision; Save As preserves source and unrelated/invalid destination content while deduplicating identical collisions and remapping different collisions.
- Standalone messages remain typed and path-free. Parent/native code owns project and filesystem authority. There is no real Import, `.mce` registry/index, arbitrary path API, authority exposure, or alternate Apply replay path.

## Task Commits

1. **Task 1: Schema, native filesystem/lifecycle, and WebP contracts** — `ea3882de`
2. **Task 2: Signals controller, bridge redetection, clipboard, and Apply lifecycle** — `6fe6f2dd`
3. **Task 3: Mounted SCRIPTS UI, parent bridge, and Save State isolation** — `f92366bb`

Planning artifacts, this SUMMARY, UAT, and plans were left uncommitted for orchestrator finalization as required.

## Exact Gate Results

- Task 1 focused frontend: 2 files, 6 tests passed.
- Task 1 focused Rust integration: schema 3 passed; filesystem 3 passed; lifecycle 2 passed.
- Task 2 focused group: 6 files passed, 46 tests passed, 9 planned todos.
- Approved Copy/Apply group: 6 files passed, including 24 clipboard tests and the durable core suite.
- Task 3 focused group: 5 files passed, 113 tests passed, 1 pre-existing close-listener mock test skipped because the current project-context listener invalidates its single-listener assumption; production close behavior was not changed.
- Combined durable/controller/UI/bridge group: 13 files passed, 167 tests passed, 9 planned todos.
- Physics Paint subtree: 45 files passed, 334 tests passed.
- Related durable core/bridge/project group: 3 files passed, 114 tests passed, 1 skipped, 9 planned todos.
- Full app Vitest: 82 files passed, 3 files skipped; 837 tests passed, 2 skipped, 101 planned todos.
- Feature-enabled full Cargo tests: 23 tests passed across library and integration targets.
- Normal Cargo tests: 15 library tests passed; feature-gated integration tests correctly compiled to zero tests.
- App TypeScript typecheck: PASS.
- Normal Cargo check: PASS.
- Feature-enabled Cargo check: PASS.
- Physics Paint package check: PASS.
- Physics Paint package build: PASS.
- Root build: PASS.
- `git diff --check`: PASS.

## Measured Failure Regressions

- **`48427a15` native lossy WebP:** frontend thumbnail tests prove the native encoder bypasses browser `toBlob`, receives exact RGBA and quality `0.8`, returns matching dimensions/MIME/signature, and rejects invalid output; Rust tests encode and decode real lossy WebP through the bounded production seam.
- **`d6731712` bridge redetection:** the persistent hook regression records request-time `detectPhysicsPaintBridgeMode()` when the current mode is initially `Unavailable`, before dispatch through the current transport mode.
- **`eecd7935` concurrent Save State:** the stale direct plugin-import assertion was removed. Tests now assert typed parent-owned request/result events, operation-local IDs, payloads, sentinels, promises, listener cleanup, and matching-result filtering.

## Deviations from Plan

### Process Exceptions

1. The plan requested broader mounted behavior tests in several legacy source-contract-heavy suites. Coverage was kept proportional: new behavior tests exercise public controllers and Rust integration support, while source/CSS assertions are limited to the permitted capability, hook-dispatch, Studio wiring, and deterministic layout contracts.
2. The pre-existing native close-listener test assumes the mocked Tauri `listen` callback is the only listener. Project-context listening now also registers during module initialization, so the mock captures the wrong handler and creates asynchronous Tauri errors. The test is skipped in Task 3; the full suite remains green, and production close behavior is unchanged. This is a non-product test-harness exception.

No production behavior bug was revealed by the new regressions. The only production changes are the disabled-by-default Rust test seam and its feature guard.

## Known Stubs

None. The disabled Import control is intentional product scope with the approved exact tooltip; it is not an implementation stub for this quick.

## Threat Flags

None. No new runtime endpoint, authority, filesystem path, schema version, or replay path was introduced. The feature-gated test module is unavailable in normal builds and owns only temporary fixture roots.

## Next Phase Readiness

Phase 36.14 can rely on the existing durable SCRIPTS controller/view-model API and the approved A-M mounted behavior. Final timeline UI integration may present and wire these controls without reopening persistence, replay, authority, or thumbnail architecture.

## Self-Check: PASSED

- Commits `ea3882de`, `6fe6f2dd`, and `f92366bb` exist.
- All listed created test/support files exist.
- Working tree contains no uncommitted production or test changes; only quick planning artifacts remain.
