---
phase: 63-brush-tip-pipeline
plan: 04
subsystem: persistence
tags: [brush-tips, package-carrier, content-addressing, save-transaction, serde-roundtrip, preact-signals, tdd]

requires:
  - phase: 63-brush-tip-pipeline
    provides: "63-02's content-addressed brush asset write/read pair, the `brushes/<sha256>.webp` parser (parseBrushAssetRelativePath) and the Rust digest guard"
  - phase: 63-brush-tip-pipeline
    provides: "63-03's BUILTIN_TIPS compile-time defaults the project catalog lists first"
provides:
  - "A refs-only two-language carrier: `.mce` root `brushPack?: { kind, entries }` where each entry carries a package-relative `asset` (`brushes/<64 hex>.webp`), declared in TS and Rust under the field-diff pin, with inline `mask`/`maskDataUrl` refused in the package carrier"
  - "`app/src/stores/aquarelleBrushCatalog.ts`: the project-scoped tip catalog (BUILTIN_TIPS first, customs after), the replace-only unavailable set, an idempotent generation counter and a refs-only pack builder that omits the key when there are no imports"
  - "`app/src/lib/efxPaintBrushAssets.ts`: remembered content-addressed WebP bodies plus per-package-root write marks, so a save COPIES stored bytes and never re-encodes"
  - "The save transaction's brush leg: `brush:<relativePath>` change token, `EfxPaintPackageSaveInput.brushAssets`, staging through `ipcEfxPaintWriteBrushAsset` under the package staging basename, and marks advanced only after commit"
affects: [63-brush-tip-pipeline]

actuals:
  tokens: 18122
  tasks: 2
  commits: 3
  plan_head_before: 2ba18ed72ef4336b68e833013457871cc84237ae
  plan_head_after: ddf016a1b92fbe9060679d8e47ef47060ff91899

tech-stack:
  added: []
  patterns:
    - "Two carrier modes on one entry shape: `TipCarrierMode = 'package' | 'script'` — package carries an `asset` ref only, script carries `maskDataUrl` only, and the retired inline `mask` is refused in BOTH"
    - "Package-side mirror of the app parser: the engine package builds standalone (tsup) and cannot import `app/src`, so `pack.ts` owns a local `/^brushes\\/[0-9a-f]{64}\\.webp$/` predicate; the app parser and the Rust bound guard remain independent re-validations"
    - "Per-package-root pending bookkeeping (`Map<root, Set<digest>>`) instead of a global written set, because Save As must re-stage every asset into the new root"
    - "Content-addressed conflict refusal: re-remembering a digest with a different body throws instead of silently overwriting"
    - "Idempotent store setters: identical replaces/resets do not bump the catalog generation (compare-then-write, no-op is a no-op)"

key-files:
  created:
    - app/src/stores/aquarelleBrushCatalog.ts
    - app/src/stores/aquarelleBrushCatalog.test.ts
    - app/src/lib/efxPaintBrushAssets.ts
    - app/src/lib/efxPaintBrushAssets.test.ts
  modified:
    - packages/efx-watercolor/src/brushes/tips.ts
    - packages/efx-watercolor/src/brushes/pack.ts
    - packages/efx-watercolor/src/brushes/pack.test.ts
    - app/src/types/project.ts
    - app/src-tauri/src/models/project.rs
    - app/src-tauri/src/commands/project.rs
    - app/src-tauri/src/services/project_io.rs
    - app/src-tauri/tests/physic_paint_cache_publication.rs
    - app/src/lib/mceFieldContract.test.ts
    - app/src/lib/efxPaintPersistence.ts
    - app/src/lib/efxPaintPersistence.test.ts
    - app/src/stores/projectStore.ts

key-decisions:
  - "The engine package mirrors the asset-ref regex locally instead of importing `parseBrushAssetRelativePath`: `packages/efx-watercolor` is built standalone by tsup and app code depends on it, so the reverse import would invert the dependency edge. T-63-15 is still met by three independent validations (pack predicate, app parser at intake, Rust bound guard at the load door)"
  - "`aquarelleBrushCatalog` lives in `app/src/stores/` rather than PATTERNS.md's `app/src/components/physic-paint/view/`: BOTH realms import it (the main window publishes the pack, the Studio child applies it) and every cross-realm store in the project lives under `app/src/stores/`. Recorded as a deliberate relocation in the module header, not drift"
  - "The brush change-token value is the digest, and the token identity is the canonical path: an imported tip therefore forces a change entry even when no layer changed, and a second identical save finds an empty change set"
  - "Assets are marked written per package root only after `commitStagedPackage` succeeds; a rollback leaves every digest pending so the next save re-stages exactly what the failed one staged (T-63-12 fail-safe direction)"
  - "The retired D-23 inline-carrier prose was rewritten on both models and in the quick spec (gitignored `SPECS/`): the package carrier refuses `mask` and `maskDataUrl`, so no future reader re-introduces inline bytes (T-63-06)"
  - "`buildProjectBrushPack()` returns `null` when there are no customs and `buildMceProject()` spreads the key conditionally, so a built-ins-only project writes no `brushPack` at all (D-10)"

patterns-established:
  - "A carrier law is stated once in the module header of `pack.ts` and pinned by a negative test per refused member on both sides of the serde boundary"
  - "Save legs that must not re-encode prove it structurally: the persistence module never imports an encoder, and the test asserts the staged bytes equal the remembered bytes AND the published stem equals sha256(bytes)"

requirements-completed: [TIP-08, TIP-09, TIP-11, TIP-15, TIP-16]

coverage:
  - id: D1
    description: "The `.mce` root carries an optional `brushPack` declared in both languages, an absent key round-trips absent, and a present pack survives unchanged"
    requirement: TIP-11
    verification:
      - kind: unit
        ref: "app/src/lib/mceFieldContract.test.ts#Phase 63 brush-tip carrier (TIP-11 / D-10)"
        status: pass
      - kind: unit
        ref: "app/src-tauri/src/models/project.rs#brush_pack_absent_deserializes_to_none_and_reencodes_without_the_key"
        status: pass
      - kind: unit
        ref: "app/src-tauri/src/models/project.rs#brush_pack_present_survives_a_round_trip_unchanged"
        status: pass
    human_judgment: false
  - id: D2
    description: "The one pack builder/parser carries a package-relative asset ref through, refuses inline carriers in the package mode, and refuses an `asset` in the script mode"
    requirement: TIP-15
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/brushes/pack.test.ts#brush pack carrier modes (63-04)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The project-scoped catalog lists the three built-ins first, replaces (never appends) its unavailable set, and builds a refs-only pack that is null when the project has no imports"
    requirement: TIP-11
    verification:
      - kind: unit
        ref: "app/src/stores/aquarelleBrushCatalog.test.ts (12 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A save copies the remembered mask bytes into the same transaction, a second identical save is a true no-op, and a second package root re-stages the asset"
    requirement: TIP-08
    verification:
      - kind: unit
        ref: "app/src/lib/efxPaintBrushAssets.test.ts (10 tests)"
        status: pass
      - kind: unit
        ref: "app/src/lib/efxPaintPersistence.test.ts#63-04: brush assets ride the same save transaction (D-11, T-63-12)"
        status: pass
    human_judgment: false
  - id: D5
    description: "No tip depends on a file outside the package or the app bundle: every entry names `brushes/<sha256>.webp` and any other shape is refused before a write"
    requirement: TIP-09
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/brushes/pack.test.ts#brush pack carrier modes (63-04)"
        status: pass
      - kind: unit
        ref: "app/src/lib/efxPaintPersistence.test.ts#a save refuses a non-canonical asset path before any staging"
        status: pass
    human_judgment: false

duration: 11min
completed: 2026-11-15
status: complete
---

# Phase 63 Plan 04: Brush-Tip Carrier and Save Leg Summary

**Brush tips now travel in the `.mce` as package-relative `brushes/<sha256>.webp` refs declared in both languages, and the save copies remembered mask bytes through the same atomic transaction — never re-encoding**

## Performance

- **Duration:** 11 min
- **Started:** 2026-11-15T11:07:48Z
- **Completed:** 2026-11-15T11:18:50Z
- **Tasks:** 2
- **Files modified:** 16 (4 created, 12 modified)

## Accomplishments

- The carrier is end to end: `AquarelleTip.asset` (engine), `MceProject.brushPack` (TS), `MceProject::brush_pack` (Rust, `#[serde(default, rename = "brushPack", skip_serializing_if = "Option::is_none")]`), and a three-test negative/round-trip pin in `mceFieldContract.test.ts` plus two serde tests in Rust. An absent pack round-trips absent; a present one is byte-preserved.
- `pack.ts` became carrier-mode aware: `buildBrushPackSnapshot`/`parseBrushPackSnapshot`/`asTipRecord` take `TipCarrierMode = 'package' | 'script'`. The package mode refuses `mask` and `maskDataUrl` and validates every `asset` against the canonical shape; the script mode refuses `asset` and requires a string `maskDataUrl`. Eight malformed-ref variants are refused, all 31 package tests pass.
- `aquarelleBrushCatalog` gives the project one tip list: built-ins first from `BUILTIN_TIPS`, customs after, a replace-only unavailable set (D-20), a no-op-preserving generation counter, and `buildProjectBrushPack()` that returns `null` when there are no imports so `buildMceProject()` omits the key entirely (D-10).
- `efxPaintBrushAssets` + the persistence brush leg make save a copy: `brushAssets` enters intake (path and body validated before any write), a `brush:<relativePath>` token carrying the digest forces a change entry per new import, staging goes through `ipcEfxPaintWriteBrushAsset` under the same staging basename, the digest is re-checked against the native write, and the per-root written mark advances only after `commitStagedPackage` succeeds. 64 tests across the two suites pass.
- Plan verification green: package build, `cargo test brush_pack` 2/2, the four app suites 97/97, package `pack.test.ts` 31/31, and `grep -c 'maskDataUrl'` over non-comment lines of `efxPaintPersistence.ts` prints `0`.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end carrier — an asset ref survives build, manifest and parse** — `904fbf4ec` (feat)
2. **Task 2: Save stages stored bytes — untouched reopen is byte-identical** — `1c0cd0bf5` (test, RED) → `ddf016a1b` (feat, GREEN)

_Note: TDD tasks may have multiple commits (test → feat → refactor)_

## Files Created/Modified

- `packages/efx-watercolor/src/brushes/tips.ts` — `AquarelleTip.asset?: string`, the package-relative mask ref
- `packages/efx-watercolor/src/brushes/pack.ts` — carrier modes, the local `BRUSH_ASSET_REF` predicate, `hasMember` refusals, mode params on build/parse/asTipRecord
- `packages/efx-watercolor/src/brushes/pack.test.ts` — eight carrier-mode cases (round trip, refusals, mode law)
- `app/src/types/project.ts` — `MceProject.brushPack`, carrier-law doc on `MceBrushPackSnapshot`
- `app/src-tauri/src/models/project.rs` — `brush_pack` field, rewritten carrier doc, `brush_pack_tests` (absent + round trip)
- `app/src-tauri/src/commands/project.rs`, `services/project_io.rs`, `tests/physic_paint_cache_publication.rs` — `brush_pack: None` in every `MceProject` literal (build fix)
- `app/src/lib/mceFieldContract.test.ts` — Phase 63 block: key set, `brush_pack` → `brushPack` wiring, snapshot shape, no one-language exception
- `app/src/stores/aquarelleBrushCatalog.ts` — the project-scoped catalog, replace-only unavailable set, refs-only pack builder
- `app/src/stores/aquarelleBrushCatalog.test.ts` — 12 standing pins over the four laws
- `app/src/lib/efxPaintBrushAssets.ts` — remembered bytes, per-root marks, canonical path reader
- `app/src/lib/efxPaintBrushAssets.test.ts` — 10 tests: pending per root, fail-closed intake, conflict refusal, defensive copies, path reader
- `app/src/lib/efxPaintPersistence.ts` — `PackageFileTokenKind` gains `'brush'`, `brushAssets` intake, staging loop, post-commit marks
- `app/src/lib/efxPaintPersistence.test.ts` — brush writer mock, four 63-04 transactional cases
- `app/src/stores/projectStore.ts` — `buildMceProject()` spreads the pack when imports exist; `savePackageWithTelemetry` passes `pendingBrushAssets(packageDir)`

## Decisions Made

- **Engine-boundary mirror:** `packages/efx-watercolor` is built standalone by tsup and cannot import `app/src`, so the asset-ref predicate is mirrored locally in `pack.ts`. The app parser at intake and the Rust bound guard remain independent re-validations, satisfying T-63-15 without inverting the dependency edge.
- **Catalog relocation:** `aquarelleBrushCatalog` lives in `app/src/stores/` because both realms import it; the module header records the deviation from PATTERNS.md's directory with its reason.
- **Brush token value is the digest:** the change token is `brush:<relativePath>` with the digest as value, so an import always forces its own entry while a repeat save is empty.
- **Mark-after-commit:** `markBrushAssetsWritten` runs only after the package transaction commits; rollback keeps every asset pending.
- **No key when no imports:** `buildProjectBrushPack()` returns `null` and `buildMceProject()` spreads conditionally, so a built-ins-only project is byte-identical to a pre-63 manifest.
- **Inline-carrier prose retired everywhere:** both model comments and the gitignored quick spec now describe the asset-ref carrier; the script carrier keeps `maskDataUrl`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added the new Rust field to every `MceProject` struct literal**
- **Found during:** Task 1 (cargo verify)
- **Issue:** Adding `brush_pack` broke six initializers: `project_create` (production) and five `project_io.rs`/`physic_paint_cache_publication.rs` test fixtures (`E0063: missing field brush_pack`).
- **Fix:** `brush_pack: None` at each site, with the reason recorded at the production constructor (a brand-new project has no imported tips).
- **Files modified:** app/src-tauri/src/commands/project.rs, app/src-tauri/src/services/project_io.rs, app/src-tauri/tests/physic_paint_cache_publication.rs
- **Verification:** `cargo test --manifest-path app/src-tauri/Cargo.toml brush_pack` compiles and passes 2/2.
- **Committed in:** 904fbf4ec (part of Task 1 commit)

**2. [Rule 2 - Missing Critical] Refused duplicate asset paths and re-checked the native digest**
- **Found during:** Task 2 (save-leg implementation)
- **Issue:** The plan's intake named path/body validation but not a duplicate-path guard or a digest agreement check; either omission would let two entries collide on one staged path or publish bytes under a misleading stem.
- **Fix:** Duplicate `relativePath` in one save throws at intake; `write.data.digest !== asset.digest` throws before the path joins `stagedPaths`.
- **Files modified:** app/src/lib/efxPaintPersistence.ts
- **Verification:** The transactional tests fail closed on both paths (the native mock reports the parsed digest).
- **Committed in:** ddf016a1b (part of Task 2 GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both are compile/correctness requirements with no scope creep; no architectural change.

## Issues Encountered

- The Task 2 test block was first appended to the sibling `per-file change tokens` describe (which owns no mock-install `beforeEach`), so the new cases observed stale mock calls. Moving the block inside `describe('savePackage / loadEfxPaintPersistence')` fixed both failures; no production behavior changed.
- `efxPaintPersistence.test.ts` is detected as binary by grep (it carries a non-UTF8 fixture byte); debugging used `grep -a`.

## TDD Gate Compliance

Plan frontmatter carries `type: execute`, so the plan-level RED→GREEN sequence gate does not apply as a hard machine gate; Task 2 nevertheless executed a genuine RED→GREEN cycle:

- **RED** — `1c0cd0bf5` (`test(63-04)`): the two test suites plus a signatures-only `efxPaintBrushAssets.ts` scaffold. `pnpm ... vitest run src/lib/efxPaintBrushAssets.test.ts src/lib/efxPaintPersistence.test.ts` reported **40 failed | 24 passed (64)**, failing on behavior assertions and thrown scaffold calls (pending semantics, transactional staging, intake refusals) — not on a missing module or a collection fault.
- **GREEN** — `ddf016a1b` (`feat(63-04)`): the module state, the persistence brush leg and the `projectStore` producer. The same command reported **64 passed**, and `tsc --noEmit` stayed clean.
- Task 1 is a `type="tracer"` task and delivered its slice end to end; its tracer feedback gate re-ran the full `<verify>` (package build, 33 app tests, cargo 2/2) after the fixes and before Task 2 expansion.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None - T-63-15 is mitigated by three independent validations (the pack predicate, the app intake parser, and the existing Rust bound guard), T-63-06 by mode-specific refusal tests on both entry members plus rewritten carrier documentation, and T-63-12 by the copy-only save leg with byte-identity and stem-equals-sha256 assertions. T-63-SC holds: no dependency was added to any manifest.

## Next Phase Readiness

- The catalog and the remembered-asset state are now the producer side of the pipeline; plans 63-05..08 can wire import/read-back/UI to `addCustomBrushTip`, `replaceUnavailableTipIds`, `rememberBrushAsset` and the batch read, with no further persistence changes needed.
- The pack builder omits the key for built-ins-only projects, so existing projects keep byte-identical manifests until the first import.
- Open follow-up (deliberate, TIP-F01): orphaned `brushes/*.webp` pruning and tip deletion are not part of this milestone (D-13).

---

*Phase: 63-brush-tip-pipeline*
*Completed: 2026-11-15*

## Self-Check: PASSED

- All four created files exist on disk.
- Commits `904fbf4ec`, `1c0cd0bf5` and `ddf016a1b` are ancestors of HEAD.
