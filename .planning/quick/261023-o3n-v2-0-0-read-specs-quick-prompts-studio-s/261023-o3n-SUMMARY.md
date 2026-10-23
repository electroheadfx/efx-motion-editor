---
phase: quick-261023-o3n
plan: 261023-o3n
subsystem: physic-paint-studio-script-persistence
tags: [physic-paint, studio, aquarelle, watercolor, brush, script-memory, snapshot, persistence, rust, tauri, package, mce, authority, migration]

# Dependency graph
requires:
  - phase: quick-261023-l35
    provides: SNAP v1 codec, the never-rejecting controller (bind/restore/save/queue/ debounce/close), the app-cache Rust service + commands, launch restore and the fail-closed labels
  - phase: quick-261023-j5b
    provides: apply-settle brush capture (applied/duplicated scripts stay Move-editable)
provides:
  - Package-sidecar snapshot storage at `<package>/scripts/<layerId>/<trackId>-v1.snap`, selected ONLY through the opaque `scriptLibraryAuthority` capability
  - Package-first restore precedence with a missing-only app-cache fallback and a terminal corrupt/foreign/newer-package result
  - Live authority plumbing through the child project-context accept, the controller ports and the Studio (save-as rebind followed)
  - Save As / Duplicate migration of `scripts/<layerId>/*-v1.snap` with a loud abort on any copy failure
affects: [studio-script-snapshot-hardening, studio-script-memory-gauge-purge, v2.0.0-milestone-close]

actuals:
  tokens: 16786
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Capability-to-root exchange in Rust: the renderer sends only the opaque scriptLibraryAuthority token; ScriptLibraryState::resolve_authority_root canonicalizes it and a stale/absent token is refused on both legs"
    - "Never dual-write: a bound authority writes the package copy only; no authority writes the app cache only (unsaved project)"
    - "Package-first precedence: Missing falls through to the l35 cache; Refused/Io is terminal so an older cache can never resurrect a superseded script"
    - "Shared atomic writer / guarded reader (`write_snapshot_at` / `read_snapshot_at`) behind both roots — same 64 MiB cap, temp sibling + fsync + rename, digest from the bytes read"
    - "Live authority read at prepare/restore time (never at bind): a prepared payload keeps the authority it was prepared with, and a save-as republish retargets the NEXT save/restore"
    - "Name-derived migration destinations: Save As copies only validated layer folders and validated `<trackId>-v1.snap` names; symlinks, foreign names and other versions are skipped; a failure is fatal on purpose"

key-files:
  created:
    - .planning/quick/261023-o3n-v2-0-0-read-specs-quick-prompts-studio-s/261023-o3n-SUMMARY.md
  modified:
    - app/src-tauri/src/services/studio_script_snapshot.rs
    - app/src-tauri/src/services/script_library.rs
    - app/src-tauri/src/commands/studio_script_snapshot.rs
    - app/src/lib/ipc.ts
    - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts
    - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts
    - app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts
    - app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "The package path carries no project id: the `.mce` package IS the project, so the same `projectId` that keys the l35 cache is not repeated on disk inside the package."
  - "A corrupt/foreign/newer-version package copy fails closed with the existing status message; falling back to the app cache there could resurrect a script the package copy superseded."
  - "The authority is read LIVE from a plain Studio ref at prepare/restore time — never captured at bind, never frozen at launch — because a Save As while the Studio is open must retarget the next write."
  - "Save As snapshot copying runs AFTER the managed-script loop and propagates any failure, so the existing Save As transaction rolls the destination back rather than silently dropping the script."
  - "Only names drive migration destinations (validated layer folder + validated track id); symlinks, `-v2.snap`, foreign files, hidden temp files and invalid layer folders are skipped."
  - "No new dependency and no `.mce` manifest or document-schema change: snapshots are sidecar files under the existing `scripts/` tree."

requirements-completed: []

# Metrics
duration: 7min
completed: 2026-10-23
status: complete
commits: 3
plan_head_before: 3306259c0552a430f54aa4db619606e21232276f
plan_head_after: 6987642a0161a9889dd480eec648c5fcf29c8811
---

# Quick 261023-o3n: Studio Script Package Persistence Summary

The approved l35 Studio script snapshot now lives inside the `.mce` package at `scripts/<layerId>/<trackId>-v1.snap`, resolved exclusively through the opaque `scriptLibraryAuthority` capability; the app cache remains only the unsaved-project / missing-package fallback, corrupt package copies fail closed, and Save As / Duplicate carries every per-layer snapshot folder.

## Storage paths and format (required record)

- **Package path convention:** `<package>/scripts/<layerId>/<trackId>-v1.snap`
  - one folder per layer, one file per track; version in the file name AND in the unchanged SNAP v1 header.
  - the package root is resolved ONLY in Rust from the opaque capability (`ScriptLibraryState::resolve_authority_root`); no renderer code names or carries a package path for snapshots.
- **Retained app-cache path (unsaved-project / missing-package fallback leg):**
  `<app_data_dir>/studio-script-snapshots/<projectId>/<layerId>/<trackId>-v1.snap` (l35, unchanged bytes and key law).
- **Format version:** 1 — SNAP v1 container (`SNP1` magic, u16 version 1, u16 flags 0; brush block version 1). The SNAP v1 bytes and codec are unchanged from l35; only the root selection is new.
- **Size cap:** 64 MiB per snapshot file, checked from metadata BEFORE any read and before any write — for the cache leg, the package leg and the Save As migration.
- **Key law (T-261023-o3n-01):** layer and track components are 1..=128 bytes of `[A-Za-z0-9._-]` with no leading dot, validated before any join; the package root is canonicalized in Rust.
- **Stale-authority refusal law (T-261023-o3n-02):** an absent `authority` header takes the cache leg; a present header that is not valid UTF-8, is empty, or is not the ACTIVE binding is `refused` on BOTH read and write, with no fallback and no guessed path.
- **Restore precedence (T-261023-o3n-03):** package copy first when the authority resolves; app-cache read ONLY when the package file is `missing`; `refused`/`io` package reads are terminal.

## Measured heavy-fixture file size — FIXTURE-DERIVED (unchanged from l35)

**631,790 bytes (≈ 0.60 MiB / 617 KiB)** for the l35 heavy fixture (3 frames × 40 primary strokes × 180 pixel points, each primary plus one diffusion continuation; the brush section dominates). The SNAP v1 container is byte-identical, so this size is unchanged; the literal pin in `studioScriptSnapshotController.test.ts` (`HEAVY_SNAPSHOT_BYTE_LENGTH = 631_790`) still guards it.

**This number is FIXTURE-DERIVED** — the executor may not run the app or the dev server, so no live heavy-project package file could be measured. It is a codec-size measurement, not an in-app observation.

## What was built

1. **Task 1 — Package leg behind the authority token (Rust + IPC).** `resolve_package_snapshot_path` enforces the key law before joining `<package>/scripts/<layerId>/<trackId>-v1.snap`; the atomic writer and guarded reader were extracted as `write_snapshot_at` / `read_snapshot_at` and wrapped by both roots; `read_snapshot_preferring_package` / `write_snapshot_preferring_package` implement the precedence and never-dual-write laws; `ScriptLibraryState::resolve_authority_root` exposes the canonical root; both commands gained an optional `authority` header resolved by `optional_authority_root` (absent → cache, present-but-unresolvable → `refused`); `ipcStudioScriptSnapshotWrite`/`Read` forward the header only when non-empty. 18 Rust tests (service + command) cover the path law, round trip, atomic replace, precedence, missing fallback, oversized-package refusal, target selection and authority resolution.
2. **Task 2 — Live authority through the Studio.** The controller gained a required `getAuthority()` dep and authority-carrying write/read ports; `restore()` reads it immediately before the read, `prepareSave()` captures it with the identity/bytes and `commitSave()` passes the captured value (a later change never retargets a prepared payload). `acceptPhysicPaintProjectContextPayload` preserves `scriptLibraryAuthority` bounded by `PHYSIC_PAINT_PROJECT_CONTEXT_MAX_SCOPE_LENGTH` (same defect family as the 24e71c34 `projectId` drop). The Studio holds it in a plain ref, sets it from the INCOMING settled launch context before the identity guard and the restore, and refreshes it in `onSettledLaunchContext` (the save-as/rebind seam). 315 assertions across the controller, bridge transport and Studio suites pass.
3. **Task 3 — Save As / Duplicate carries the folders.** `migrate_package_snapshots` enumerates direct layer folders (validated names, real directories), copies only validated `<trackId>-v1.snap` regular files byte-identically through the shared reader/writer, and propagates any failure so `project_save_as_with_script_library` rolls the destination package back. `ScriptLibraryMigration.snapshots_copied` (wire `snapshotsCopied`) reports the count; existing managed-script counters are untouched (asserted in the same run). 12 Rust `script_library` tests pass.

## Verification

| Gate | Command | Result |
|------|---------|--------|
| Rust snapshot service + commands | `cargo test --manifest-path app/src-tauri/Cargo.toml studio_script_snapshot` | 18/18 pass (path law, round trip, atomic replace, precedence, missing fallback, oversized refusal, write targets, authority resolution, header contract) |
| Rust script library + migration | `cargo test --manifest-path app/src-tauri/Cargo.toml script_library` | 12/12 pass (existing suite + valid-pair copy/count, foreign-name and symlink skips, oversized abort) |
| Controller + bridge + Studio pins | `vitest run src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts src/components/physic-paint/bridge/physicsPaintBridgeTransport.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts` | 315/315 pass (24 controller incl. 3 authority tests, 45 bridge incl. the new accept test, 246 Studio pins) |
| Typecheck | `pnpm --filter efx-motion-editor run typecheck` | 15 pre-existing errors in untouched files (identical to the l35 baseline); ZERO in every file this plan touches |
| Package IO boundary | `vitest run src/efx-paint/efxPaintPackageIoBoundary.test.ts` | 6/6 pass — no renderer filesystem access enters the snapshot path |
| Schema/dependency diff | `git diff --stat` on `app/efx-paint-package`, `app/src/efx-paint/document`, `app/src/types/efxPaintDocument*`, `app/src-tauri/Cargo.toml`, `app/package.json`, `pnpm-lock.yaml` | empty — no `.mce` manifest/schema change, no new dependency |

Pre-existing typecheck baseline (unchanged, none touched by this plan): `usePhysicsPaintEngineActions.test.ts`, `physicsPaintRotoBackgroundValidatorParity.test.ts`, `PaperPicker.tsx`, `PhysicsPaintPalette.test.ts`, `physicPaintBridge.ts(2457)`, `projectPaperRaster.test.ts`.

## TDD log

- Task 1: RED = 28 compile errors (missing package APIs / `resolve_authority_root` / `optional_authority_root`); GREEN = 18/18. Tracer feedback gate re-ran the automated verify end to end — passed, expanded.
- Task 2: RED = 8 failing assertions across the three suites; GREEN = 315/315.
- Task 3: RED = 2 compile errors (`no field snapshots_copied`); GREEN = 12/12 `script_library` + 18/18 `studio_script_snapshot`.

## UAT Rows (PENDING — automated-ready; the user runs the app)

The code is automated-ready; none of these rows has live evidence yet. Per project law, the quick is not "done" until the user passes them.

| # | Row | Expected | Status |
|---|-----|----------|--------|
| 1 | Paint watercolor + brush scripts on a saved project, close Studio | `scripts/<layerId>/<trackId>-v1.snap` exists inside the `.mce` package | PENDING |
| 2 | Close/reopen Studio | The same scripts restore; Move/Delete still edit | PENDING |
| 3 | Quit, delete the app-data `studio-script-snapshots/` folder, relaunch and reopen the project | Scripts restore from the package alone | PENDING |
| 4 | Save As (or Duplicate) the project | The new package contains the per-layer scripts and restores them | PENDING |
| 5 | Unsaved project (no `.mce` yet), close Studio | The cache fallback still survives the close | PENDING |
| 6 | Corrupt package snapshot (or bump its version) | Studio opens, one clear status message, pixels intact, no crash | PENDING |

## Deviations from Plan

None — plan executed as written. (One test-authoring fix only: an authority test initially set the content signature before a missing restore, which seeds the saved baseline and correctly produced no write; the signature is now set after the restore. Production behavior was unchanged.)

## Threat Flags

None beyond the planned register; T-261023-o3n-01..06 are mitigated as designed (validated key components before any join, opaque capability checked against the active binding, package-first with missing-only fallback, unchanged SNAP v1 codec validation, name-only migration destinations with a loud abort, and the 64 MiB cap on both legs and migration). No new dependency.

## Commits

- `3f73e1ea` — feat(quick-261023-o3n): store the Studio snapshot in the .mce package
- `8758c27b` — feat(quick-261023-o3n): carry the live package authority through the Studio
- `6987642a` — feat(quick-261023-o3n): carry snapshot folders through Save As / Duplicate

Docs artifacts (this SUMMARY, STATE.md, PLAN.md) are left uncommitted for the orchestrator's docs commit.

## Self-Check: PASSED

- Created/modified files exist: `studio_script_snapshot.rs` (service + commands), `script_library.rs`, `ipc.ts`, the controller + tests, the bridge + test, `PhysicsPaintStudio.tsx` + test, this SUMMARY.
- Commits are ancestors of HEAD: `3f73e1ea`, `8758c27b`, `6987642a`.
- No file deletions in any task commit; working tree clean apart from this SUMMARY (and STATE.md, when updated).
