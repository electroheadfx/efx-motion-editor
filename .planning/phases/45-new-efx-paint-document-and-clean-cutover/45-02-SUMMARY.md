---
phase: 45-new-efx-paint-document-and-clean-cutover
plan: 02
subsystem: core
tags: [efx-paint, serde-co-change, opaque-presence-carrier, cache-repoint, rust, typescript]

# Dependency graph
requires:
  - phase: 45
    plan: 01
    provides: EfxPaintDocument v1.0 type + fail-closed parsers + deterministic revision builders (the document payload the new key carries)
provides:
  - "Rust MceProject carries efx_paint_documents as an opaque serde_json map (serde default + skip_serializing_if empty) — the v1.0 document key survives save → open round-trip byte-identical (DOC-05, Pitfall F1 closed with proof)"
  - "Rust physic_paint_outputs demoted to an opaque Vec<serde_json::Value> presence carrier: round-trips legacy blob presence to the TS rejection gate, never interpreted/migrated/rendered (D-02/D-06)"
  - "Legacy Rust structs McePhysicPaintOutput, McePhysicPaintCachedFrame, McePhysicPaintRotoPlaybackSettings deleted (DOC-04)"
  - "create_project_dir creates cache/efx-paint and never creates cache/physic-paint; pre-existing legacy cache directories stay byte-untouched (D-04)"
  - "Native cache transaction service (publish/bind/settle/recover) operates on cache/efx-paint with staging prefix .efx-paint-staging-; no code path can publish into cache/physic-paint (DOC-04)"
affects: [45-03, 45-04, 45-05, 45-06, 45-07, 45-08, phases 46-52]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 6200
  tasks: 3
  commits: 6

# Tech tracking
tech-stack:
  added: []
  patterns: [serde opaque presence carrier, F1 Rust+TS co-change with round-trip proof, D-04 non-destruction test, prefix-locked cache root, TDD RED-GREEN per task]

key-files:
  created: []
  modified:
    - app/src-tauri/src/models/project.rs
    - app/src-tauri/src/commands/project.rs
    - app/src-tauri/src/services/project_io.rs
    - app/src-tauri/src/services/physic_paint_cache.rs
    - app/src-tauri/tests/physic_paint_cache_publication.rs
    - app/src/types/project.ts

key-decisions:
  - "efx_paint_documents lands in BOTH models/project.rs and types/project.ts in the same commit — TS-only addition silently drops the document on save (Pitfall F1, DOC-05 killer); proven by a Rust round-trip test"
  - "physic_paint_outputs is an opaque presence carrier (Vec<serde_json::Value>): presence round-trips to the TS rejection gate, payload is never interpreted, migrated, or rendered (D-02/D-06)"
  - "The cache transaction service is re-pointed, not rewritten: command surface (publish/bind/settle/recover) and transaction-id validation identical — no new IPC surface (T-45-06 Elevation-of-Privilege control)"
  - "Transaction marker/sentinel basenames (.physic-paint-transaction.json / .physic-paint-transaction-) stay unchanged — only the canonical dir and staging prefix move (plan scope)"
  - "D-04 non-destruction proven by test: a pre-existing legacy cache/physic-paint dir with content stays byte-untouched after create_project_dir"

patterns-established:
  - "F1 co-change: Rust model + TS type land in one commit, proven by a Rust save → open round-trip test (TS tests mock IPC and cannot catch a missing Rust field)"
  - "Opaque presence carrier: legacy blobs demoted to serde_json::Value with serde default + skip_serializing_if empty — presence survives, interpretation never happens"
  - "Prefix-locked cache root: path construction is locked to the v1.0 root; staging basename validation rejects ../, absolute paths, NUL (T-45-04)"
  - "D-04 non-destruction test: create_project_dir leaves a pre-existing legacy cache dir byte-untouched"

requirements-completed: [DOC-04, DOC-05]

# Coverage metadata (#1602) — one entry per shipped deliverable. Drives DETERMINISTIC UAT routing in verify-work.
coverage:
  - id: D1
    description: "Rust MceProject carries efx_paint_documents as an opaque serde_json map (serde default + skip_serializing_if empty) and physic_paint_outputs as an opaque Vec<serde_json::Value> presence carrier; the v1.0 document key survives a real save → open round-trip byte-identical and legacy blob presence round-trips"
    requirement: DOC-05
    verification:
      - kind: unit
        ref: "app/src-tauri/src/services/project_io.rs#test_save_and_open_roundtrip"
        status: pass
      - kind: unit
        ref: "app/src-tauri/src/services/project_io.rs#test_legacy_physic_paint_outputs_open_as_opaque_presence"
        status: pass
      - kind: unit
        ref: "app/src-tauri/src/services/project_io.rs#test_save_skips_empty_document_keys"
        status: pass
    human_judgment: false
  - id: D2
    description: "Legacy Rust structs McePhysicPaintOutput, McePhysicPaintCachedFrame, McePhysicPaintRotoPlaybackSettings deleted from models/project.rs; no legacy struct remains reachable from native code"
    requirement: DOC-04
    verification:
      - kind: unit
        ref: "cargo test --manifest-path app/src-tauri/Cargo.toml (whole crate green)"
        status: pass
    human_judgment: false
  - id: D3
    description: "create_project_dir creates cache/efx-paint and never creates cache/physic-paint; a pre-existing legacy cache/physic-paint dir with content stays byte-untouched (D-04)"
    requirement: DOC-04
    verification:
      - kind: unit
        ref: "app/src-tauri/src/services/project_io.rs#test_create_project_dir_creates_subdirectories"
        status: pass
      - kind: unit
        ref: "app/src-tauri/src/services/project_io.rs#test_create_project_dir_leaves_legacy_cache_untouched"
        status: pass
    human_judgment: false
  - id: D4
    description: "Native cache transaction service operates exclusively on cache/efx-paint with staging prefix .efx-paint-staging-; staging basename validation rejects ../, absolute paths, NUL; command surface and transaction-id validation unchanged (T-45-06)"
    requirement: DOC-04
    verification:
      - kind: unit
        ref: "app/src-tauri/src/services/physic_paint_cache.rs#staging_basename_rejects_traversal_and_absolute_paths"
        status: pass
      - kind: unit
        ref: "app/src-tauri/tests/physic_paint_cache_publication.rs (16 integration tests, v1.0 paths)"
        status: pass
    human_judgment: false

# Metrics
duration: 1h50m
completed: 2026-08-23
status: complete
---

# Phase 45: New EFX Paint Document and Clean Cutover — Plan 02 Summary

**Rust + TS serde co-change for the v1.0 document key and re-point of the native cache machinery at cache/efx-paint — the persistence substrate plans 45-04 and 45-05 build on**

## Performance

- **Duration:** 1h50m wall clock
- **Started:** 2026-08-23T16:00:00Z (approx)
- **Completed:** 2026-08-23T17:50:00Z (approx)
- **Tasks:** 3
- **Files modified:** 6 (0 created, 6 modified)

## Accomplishments
- `efx_paint_documents` added to BOTH `models/project.rs` and `types/project.ts` in the same commit (F1 co-change), carried as an opaque serde_json map with `serde default + skip_serializing_if empty` — the v1.0 document key survives a real Rust save → open round-trip byte-identical (DOC-05, Pitfall F1 closed with proof, not hope)
- `physic_paint_outputs` demoted to an opaque `Vec<serde_json::Value>` presence carrier: legacy blob presence round-trips into TS for the rejection gate but is never interpreted, migrated, or rendered (D-02/D-06)
- Legacy Rust structs `McePhysicPaintOutput`, `McePhysicPaintCachedFrame`, `McePhysicPaintRotoPlaybackSettings` deleted — no legacy struct remains reachable from native code (DOC-04)
- `create_project_dir` creates `cache/efx-paint` and never creates `cache/physic-paint`; a pre-existing legacy cache dir with content stays byte-untouched (D-04, proven by test)
- Native cache transaction service re-pointed: `CANONICAL_CACHE_BASENAME = "efx-paint"`, `STAGING_PREFIX = ".efx-paint-staging-"`; command surface and transaction-id validation identical (T-45-06); staging basename validation rejects `../`, absolute paths, NUL (T-45-04)
- 16 integration tests in `physic_paint_cache_publication.rs` updated to the v1.0 paths; whole crate green (38 lib + 16 + 4 + 20 integration), full TS suite green (2692 passed), typecheck clean

## Task Commits

Each task was committed atomically (TDD: test → feat per task):

1. **Task 1: v1.0 document key in Rust+TS models with round-trip proof** - `8a26fa7a` (test) + `8aa1228b` (feat)
2. **Task 2: create_project_dir creates v1.0 cache dir, never legacy dir** - `686fc36f` (test) + `4e51536a` (feat)
3. **Task 3: re-point native cache service to v1.0 directory** - `a98be3e9` (test) + `2f3ec7fc` (feat)

## Files Modified
- `app/src-tauri/src/models/project.rs` - Deleted McePhysicPaintOutput, McePhysicPaintCachedFrame, McePhysicPaintRotoPlaybackSettings; `physic_paint_outputs: Vec<Value>` opaque presence carrier; `efx_paint_documents: HashMap<String, Value>` with serde default + skip_serializing_if empty
- `app/src-tauri/src/commands/project.rs` - `project_create` constructs the new `efx_paint_documents: HashMap::new()` field
- `app/src-tauri/src/services/project_io.rs` - Round-trip test extended with legacy blob + document payload; new tests: opaque presence open, skip-empty save, v1.0 cache dir creation, legacy cache non-destruction; `create_project_dir` creates `cache/efx-paint`
- `app/src-tauri/src/services/physic_paint_cache.rs` - Constants re-pointed to `efx-paint` / `.efx-paint-staging-`; 4 new unit tests (staging basename validation, publish into efx-paint, settle commit/rollback with project-write binding, crafted-basename rejection)
- `app/src-tauri/tests/physic_paint_cache_publication.rs` - 16 integration tests updated to the v1.0 paths and staging prefix
- `app/src/types/project.ts` - `efx_paint_documents?: Record<string, unknown>` added to MceProject and RuntimeMceProject (F1 co-change with Rust)

## Decisions Made
- **F1 co-change in one commit**: the plan's Pitfall F1 is the DOC-05 killer — Rust `MceProject` uses explicit serde fields and silently drops unknown keys on save. The document key landed in both models in the same commit, proven by a Rust round-trip test (TS tests mock IPC and cannot catch a missing Rust field)
- **Opaque presence carrier (D-02/D-06)**: legacy blobs demoted to `serde_json::Value` — presence round-trips to the TS rejection gate, payload is never interpreted, migrated, or rendered
- **Re-point, not rewrite (T-45-06)**: the cache transaction service keeps its command surface and transaction-id validation identical; only the canonical dir and staging prefix move. No new `#[tauri::command]` functions (grep: command count unchanged)
- **Marker/sentinel basenames unchanged**: `.physic-paint-transaction.json` and `.physic-paint-transaction-` sentinels stay — only the canonical dir and staging prefix are in plan scope
- **D-04 non-destruction proven by test**: `test_create_project_dir_leaves_legacy_cache_untouched` writes a legacy dir with content, runs create_project_dir, and asserts the bytes are untouched

## Deviations from Plan

### Auto-fixed Issues

**1. [Test setup - Minor] Settle test required a project-write binding before Commit**
- **Found during:** Task 3 GREEN verification (cargo test)
- **Issue:** The new `settle_commit_swaps_and_rollback_restores_previous_generation` unit test called `settle_cache_generation(Commit)` directly after publish. Commit requires `project_file_matches_marker` (a project-write binding via `bind_cache_transaction_to_project_write`), so the first commit failed with "Physics Paint cache commit does not match the durable project bytes"
- **Fix:** Bound the first generation to a `project.mce` file (with matching bytes) before Commit; the second generation stays unbound so Rollback takes the `rollback_transaction` path (restores the previous generation)
- **Files modified:** app/src-tauri/src/services/physic_paint_cache.rs (test only)
- **Verification:** crate green (38 lib tests)
- **Committed in:** 2f3ec7fc (Task 3 GREEN)

**2. [Test update - Expected] 10 integration tests failed after the constants re-point**
- **Found during:** Task 3 GREEN verification (cargo test)
- **Issue:** `app/src-tauri/tests/physic_paint_cache_publication.rs` (16 tests) used the old `cache/physic-paint` path and `.physic-paint-staging-` prefix; after the constants change, 10 tests failed
- **Fix:** Updated `STAGING_BASENAME` to `.efx-paint-staging-test`, `canonical_dir` to `cache/efx-paint`, the two inline staging names in `delayed_rollback_cannot_delete_a_newer_canonical_generation` to `.efx-paint-staging-first`/`.efx-paint-staging-second`, and the `invalid_names` list in `invalid_staging_authority_rejects_before_any_mutation` to `.efx-paint-staging-` variants. Transaction marker/sentinel basenames intentionally unchanged
- **Files modified:** app/src-tauri/tests/physic_paint_cache_publication.rs
- **Verification:** all 16 integration tests pass
- **Committed in:** 2f3ec7fc (Task 3 GREEN)

---

**Total deviations:** 2 auto-fixed (1 minor test setup, 1 expected test update)
**Impact on plan:** No scope creep; both were test-level corrections required for the re-point to be provable.

## Issues Encountered
- The settle unit test initially missed the project-write binding requirement for Commit — the service's commit-vs-rollback semantics (project_file_matches_marker) are now exercised correctly in the test
- The integration test file was not listed in the plan's `files` for Task 3 but is part of the crate's test surface — updated it to the v1.0 paths so the whole crate stays green

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `efx_paint_documents` in the Rust model is the persistence substrate plan 45-04 (TS persistence) and plan 45-05 (funnel wiring) build on
- The opaque presence carrier keeps legacy `physic_paint_outputs` blobs visible to the 45-03 TS rejection gate — no migration path needed
- The native cache transaction service now stages and commits exclusively under `cache/efx-paint`; the legacy cache path is unreachable from native code
- No blockers; the roto physical model and all existing TS/Rust suites pass with zero regression

---
*Phase: 45-new-efx-paint-document-and-clean-cutover*
*Completed: 2026-08-23*
