---
phase: quick-261027-klx
plan: W5
wave: 5
status: complete
stop_conditions: []
resolved_conditions: []
commit: 5330b441
plan_head_before: a57e02798342e8b01c92dacf0f698a22f37e2c96
plan_head_after: 5330b441f8f2b9cbae81317848996533067ae497
commits: 1
files_changed: 6
insertions: 81
deletions: 141
date: 2026-10-27
---

# Phase quick-261027-klx — Wave 5 Summary (Rust script library)

**Status: COMPLETE.** The Rust script library now accepts exactly one engine
identity — `efx-watercolor` — and refuses a legacy `efx-physic-paint` document
through the existing validator, with no migration code and no compatibility
branch. `SCRIPT_ENGINE_ID` is deleted, the engine-1 stroke/payload validation
arms are gone, the legacy refusal row and every size/count/file-name bound
survive, and `STUDIO_SCRIPT_SNAPSHOT_FORMAT_VERSION` stays `1`.

## What landed (5.1 – 5.4)

1. **5.1 Snapshot file version untouched.** `studio_script_snapshot.rs:63`
   still declares `STUDIO_SCRIPT_SNAPSHOT_FORMAT_VERSION: u32 = 1`. Only the
   doc comment changed: it now states the value is the FILE-NAME version
   (`<trackId>-v1.snap`) and is independent of the app-side container header
   (SNAP v5 after Wave 3). The path check at `:445` / `:502` was **not**
   widened — the suffix is still built from the constant, so only the exact
   `<trackId>-v1.snap` leaf is ever resolved.
2. **5.2 Engine identity collapsed.**
   - `pub const SCRIPT_ENGINE_ID` deleted; `SCRIPT_ENGINE_ID_AQUARELLE` is the
     only engine constant, now documented as the sole accepted id with the
     retired literal allowed only as refusal input in tests.
   - `validate_document` filter is `*id == SCRIPT_ENGINE_ID_AQUARELLE`. A
     legacy Brush document returns `Err("Invalid script engineId")` — the
     clean-break refusal mechanism, not a migration.
   - `validate_strokes`: engine-1 continuation machinery removed (`aquarelle`
     local, `continuations_in_group`, the `!aquarelle` continuation gate and
     its "Too many brush continuations" arm). Dry markers are still legal
     empty-pt entries and do not consume a brush slot; every non-Dry stroke is
     a primary against `MAX_BRUSHES`, and `MAX_TOTAL_POINTS` still bounds the
     whole document.
   - `validate_envelope_stroke`: `continuation` parameter removed; an empty-pt
     non-Dry stroke is always rejected; `cuisson` must always be `0`; the
     `brushId == engine_id`, point, tick, motion, color and payload checks are
     unchanged.
   - `validate_engine_payload`: the entire engine-1 `paint`/`erase` arm
     (tool, params table, `antiAlias`, `hasPenInput`, `physicsMode`,
     continuation-requires-`diffusionFrames`) deleted; the function keeps the
     `"Invalid engine payload"` object guard and delegates to
     `validate_engine_payload_aquarelle`.
   - Kept intact: `SCRIPT_KIND`, `LEGACY_SCRIPT_KIND`, `SCRIPT_VERSION`,
     `SCRIPT_EXTENSION`, `MAX_FILE_BYTES`, `MAX_CANDIDATES`, `MAX_NAME_CHARS`,
     `MAX_METADATA_CHARS`, `MAX_BRUSHES`, `MAX_CONTINUATIONS` (still used by
     the strokes-array bound), `MAX_POINTS_PER_BRUSH`, `MAX_TOTAL_POINTS`,
     `MAX_THUMBNAIL_BYTES`, `validate_brush_pack` (watercolor tip pack), the
     `unreadable-legacy-script` refusal classification and
     `row_from_legacy_document`.
3. **5.3 Tests.** `tests/script_library_schema.rs` builds an aquarelle
   document (brush stroke + legal Dry marker) and adds
   `refuses_legacy_engine1_document` backed by a `legacy_engine1_document`
   fixture that keeps the retired literal strictly as refusal INPUT.
   `legacy_scripts_stay_visible_as_refused_rows` is untouched and green.
   `tests/script_library_transaction_contract.rs` `action_document` is
   aquarelle (engineId, brushPack kind, brushId, `tool: "brush"` payload with
   a `wc/round-small` tip). The `artifact()` keystone double keeps its
   `efx-physic-paint` bytes: they are opaque retained bytes, never validated
   or accepted as a document. The lib unit test
   `validate_document_accepts_engine1_document` became
   `validate_document_refuses_legacy_engine1_document` (same full legacy body,
   inverted assertion).
4. **5.4 Commit** `5330b441` —
   `refactor(261027-klx): watercolor-only script library on the Rust side`,
   6 files, +81 / −141, pathspec-scoped staging only.

## Verification (post-commit, on `5330b441`)

| # | Command | Result |
|---|---|---|
| 1 | exact plan `<verify>`: `cargo test --manifest-path app/src-tauri/Cargo.toml` + the four boundary greps | **PASS** — exit 0; listed targets 104 + 20 + 39 + 4 + 21 passed, 0 failed |
| 2 | `! grep -q 'const SCRIPT_ENGINE_ID:' …/script_library.rs` | PASS — boundary-exact absence (does not match `SCRIPT_ENGINE_ID_AQUARELLE`) |
| 3 | `grep -q 'const SCRIPT_ENGINE_ID_AQUARELLE:' …/script_library.rs` | PASS — the positive gate proves the aquarelle constant survived |
| 4 | `grep -q 'STUDIO_SCRIPT_SNAPSHOT_FORMAT_VERSION: u32 = 1' …/studio_script_snapshot.rs` | PASS — file-name version still 1 |
| 5 | `test "$(grep -rn 'SCRIPT_ENGINE_ID\b' app/src-tauri/src \| wc -l)" = "0"` | **G4: 0** — matched-lines list empty |
| 6 | `cargo test … --features script-library-test-support --test script_library_schema` | **PASS — 6/6**, including `legacy_scripts_stay_visible_as_refused_rows` and the new `refuses_legacy_engine1_document` |
| 7 | `cargo test … --features script-library-test-support --test script_library_lifecycle` | PASS — 2/2 |
| 8 | `cargo test … --features script-library-test-support --lib -- engine` | PASS — 4/4 (`refuses_legacy_engine1_document`, `accepts_aquarelle_engine_and_dry_marker`, `rejects_engine1_tool_on_aquarelle_stroke`, `rejects_third_engine_id`) |
| 9 | `cargo check --manifest-path app/src-tauri/Cargo.toml` | PASS — no warnings, no errors |
| 10 | post-commit `git status` / `--diff-filter=D` | PASS — tree clean, **no deletions** |

Note on the exact verify: `script_library_schema.rs` / `filesystem.rs` /
`lifecycle.rs` are gated by `#![cfg(feature = "script-library-test-support")]`,
so the plain command reports "0 passed" for them by design. Rows 6–8 run those
targets with the feature enabled, which is what proves the 5.3 requirement and
the `legacy_scripts_stay_visible_as_refused_rows` done criterion.

## Deviations from plan

### Auto-fixed Issues

**1. [Rule 3 – Blocking issue] Two script fixtures outside this wave's `<files>` were retargeted to aquarelle.**
- **Found during:** 5.3 (feature-enabled suite run)
- **Issue:** `tests/script_library_filesystem.rs` and
  `tests/script_library_lifecycle.rs` build an `efx-physic-paint` document and
  save it through `FixtureLibrary::save` → `validate_document`. After 5.2 they
  cannot validate, so both suites would go red; the wave's `<done>` requires
  the Rust suite green. Neither file is listed in the Wave 5 `<files>` block.
- **Fix:** retargeted both `document()` helpers to `efx-watercolor`
  (engineId, brushPack kind, brushId, `tool: "brush"` payload with a
  `wc/round-small` tip). No assertion, bound or capability check was changed.
- **Files modified:** `app/src-tauri/tests/script_library_filesystem.rs`,
  `app/src-tauri/tests/script_library_lifecycle.rs`
- **Commit:** `5330b441`

### Out-of-scope observation (NOT fixed)

`tests/script_library_filesystem.rs::capability_split_denies_standalone_filesystem_authority`
fails when the feature-enabled suite runs: `capabilities/physics-paint.json:16`
contains `"dialog:allow-open"` (added by Phase 49, commit `452de56c`), and the
2026-07 stale assertion forbids `dialog:` in the standalone capability. It is
pre-existing, unrelated to engine-1 (neither the capability file nor that test
was touched by this wave), and outside Wave 5's scope — per the scope boundary
it was not fixed. The exact Wave 5 `<verify>` command and every script-library
target are unaffected.

## Facts worth carrying to Wave 6

- A **pre-envelope** legacy script (`kind: "efx-physics-paint-roto-script"`)
  still lands as a visible refused row (`unreadable-legacy-script`,
  `skipped_invalid_count` stays 0) — the panel-crash guarantee is intact.
- A **post-envelope** engine-1 script (`kind: "efx-studio-paint-script"`,
  `engineId: "efx-physic-paint"`) is now refused at validation and surfaces as
  an `invalid-managed-script` diagnostic (`skipped_invalid_count`), i.e. it is
  skipped, not listed. This is the intended clean break; UAT row 5 covers the
  visible behaviour of an old Brush *script library*.
- The retired literal survives in Rust **only** as test refusal input and in
  the `artifact()` keystone byte fixture; no production constant remains.

## Constraints honoured

- Pathspec-scoped staging only (`git add --` with six exact paths). No
  `git add -A` / `git add .`. `.planning/`, `SPECS/`, `app/dist/` and unrelated
  dirty files were never staged; `git status` is clean after the commit.
- `pnpm`/`cargo` only, no dev server, no push.
- Ledger measured, not narrated: `a57e0279..5330b441` = **1 commit**.
- Summary written with `status: complete` and deliberately NOT committed.

## Self-Check: PASSED

- Commit `5330b441` is HEAD; `git show --first-parent --diff-filter=D` lists no
  deletions; `git status --short` is empty apart from this untracked summary.
- Exact `<verify>` chain re-run on the committed tree: PASS, `G4: 0`.
- `legacy_scripts_stay_visible_as_refused_rows`: **ok** (6/6 schema target).
- `STUDIO_SCRIPT_SNAPSHOT_FORMAT_VERSION: u32 = 1` unchanged and pinned by the
  verify grep; the `:445`/`:502` path law was not widened.
