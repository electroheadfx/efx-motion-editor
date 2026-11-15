---
phase: 63-brush-tip-pipeline
plan: 09
subsystem: engine
tags: [rust, cargo-test, brush-tips, fresh-profile, portability, provisioning, digest, webp]

requires:
  - phase: 63-brush-tip-pipeline
    provides: "63-02's content-addressed write_brush_asset/read_brush_asset pair, the bound-path guard and the lossless mask codec the copy is verified through"
provides:
  - "brush_asset_survives_a_fresh_profile_directory_copy: a package directory copied alone with fs::copy reproduces the stored WebP byte for byte, its digest still equals the 64-hex stem, and it decodes to the same 36,864-byte mask"
  - "A provisioning guard: create_project_dir never creates brushes/, pinned by an explicit non-existence assertion and a recorded D-20 reason at the provisioning site"
affects: [63-brush-tip-pipeline]

actuals:
  tokens: 1321
  tasks: 2
  commits: 2
  plan_head_before: f9ba025b953c5fd1a6fd519e66917114152bd20e
  plan_head_after: eaaadbb91dc4f896d566bdcfe2e1aa7f81620c8e

tech-stack:
  added: []
  patterns:
    - "Portability proof at the test level: a recursive fs::copy of the whole package, then identity checks through the production read path — bytes equal, digest equals stem, decoded mask equals the mask minted at setup"
    - "Negative-provisioning assertion placed beside the positive directory assertions so a future provisioning addition trips the same test"

key-files:
  created: []
  modified:
    - app/src-tauri/src/services/efx_paint_media.rs
    - app/src-tauri/src/services/project_io.rs

key-decisions:
  - "The single encode_mask_webp happens at setup, exactly as import mints an asset; the copy leg itself is filesystem-only — no re-encode, no read-back-and-write (D-11/D-12). The plan's 'no encoder in the test' applies to the copy path"
  - "The copy helper lives in the test module rather than production code: the plan adds no runtime slice, and nothing in the shipped app copies a package directory"
  - "Task 2 is a guard-pinning task, not a new behavior: create_project_dir already created no brushes/ and the plan forbids adding it, so the assertion is green by construction — no RED was fabricated (fail-fast rule 1, 63-03 precedent)"
  - "The provisioning guard asserts absence directly (assert!(!test_dir.join(\"brushes\").exists())) instead of an exact directory listing, matching the file's existing cache/videos negative assertions while keeping every pre-existing positive assertion intact"

patterns-established:
  - "Fresh-profile portability is proven by copying bytes and then re-validating the copy through the same bound guard and digest law as the original (T-63-13/T-63-24), never by trusting that a copy succeeded"
  - "A provisioning invariant is recorded twice: a doc comment stating the reason at the provisioning site, and an assertion that fails loudly if the invariant is ever broken"

requirements-completed: [TIP-16]

coverage:
  - id: D1
    description: "A package directory copied alone to a fresh root reproduces every stored brush asset byte for byte, and the decoded mask is identical"
    requirement: TIP-16
    verification:
      - kind: unit
        ref: "app/src-tauri/src/services/efx_paint_media.rs#brush_asset_survives_a_fresh_profile_directory_copy"
        status: pass
    human_judgment: false
  - id: D2
    description: "A freshly created project root has no brushes/ directory, the pre-existing provisioning assertions are unchanged, and the reason is recorded at the provisioning site"
    requirement: TIP-16
    verification:
      - kind: unit
        ref: "app/src-tauri/src/services/project_io.rs#test_create_project_dir_creates_subdirectories"
        status: pass
      - kind: unit
        ref: "app/src-tauri/src/services/project_io.rs#test_create_project_dir_leaves_legacy_cache_untouched"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-11-15
status: complete
---

# Phase 63 Plan 09: Portability and Provisioning Summary

**A package directory copied alone reproduces its brush masks byte for byte through the production read path, and a new project is pinned against ever gaining an empty `brushes/` tree**

## Performance

- **Duration:** 3 min
- **Started:** 2026-11-15T11:01:28Z
- **Completed:** 2026-11-15T11:04:02Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `brush_asset_survives_a_fresh_profile_directory_copy` writes a real encoded mask asset into a temp package, recursively copies the WHOLE directory to a second temp root with `fs::copy` only, then proves three things about the copy: the file bytes equal the original bytes, the digest recomputed from the copy equals the 64-hex filename stem, and decoding the copied asset yields the same 36,864-byte mask that was encoded at setup. The copy is also re-read through `read_brush_asset`, so it passes the same bound-path guard and digest law as the original rather than being trusted because it copied.
- `create_project_dir` gains no brush provisioning: the test asserts `brushes/` does not exist after creation, beside the existing `cache/` and `videos/` negative assertions, and the doc comment at the provisioning site records the D-20 reason — a new project carries only the three compile-time built-in tips, which are never written into a project; `brushes/` first appears when the first imported asset is written by the atomic writer.
- Plan verification: `cargo test brush_asset` 2/2 passed, `cargo test create_project_dir` 2/2 passed, `cargo test bound_guard` 2/2 still green, and `git diff --quiet HEAD -- app/src-tauri/Cargo.toml` exits 0 (no dependency change, T-63-SC).

## Task Commits

Each task was committed atomically:

1. **Task 1: Fresh-profile copy — the package reproduces its own masks** — `c318b50ba` (test)
2. **Task 2: Provisioning guard — a new project has no brush folder** — `eaaadbb91` (test)

_Note: the plan frontmatter is `type: execute`; see `## TDD Gate Compliance` for the commit-shape record._

## Files Created/Modified

- `app/src-tauri/src/services/efx_paint_media.rs` — `copy_directory_tree` test helper and `brush_asset_survives_a_fresh_profile_directory_copy`, with the T-63-13 / T-63-24 assertions and a comment distinguishing the one setup encode from the encoder-free copy leg
- `app/src-tauri/src/services/project_io.rs` — D-20 paragraph on `create_project_dir`'s doc comment and the `brushes` non-existence assertion in `test_create_project_dir_creates_subdirectories`

## Decisions Made

- **One encode, at setup only:** a genuine lossless WebP cannot be produced without an encoder, and the task's action compares the decoded mask to "the mask that was encoded at the start". The copy leg is therefore the only path the "no encoder" acceptance governs, and it is `fs::copy` only. A test comment states this so a future reader cannot mistake the setup encode for a copy-time re-encode.
- **Copy helper in the test module:** the plan deliberately adds no runtime slice, and the shipped app has no package-directory copy operation. Putting `copy_directory_tree` in the test keeps production surface unchanged while still exercising a real two-root filesystem copy.
- **Absence assertion instead of a directory listing:** the existing test enumerates positives and negates `cache`, `cache/physic-paint` and `videos` individually. The `brushes` guard follows that exact idiom, so "the existing list assertion stays intact" (the acceptance wording) holds literally — no pre-existing assertion was touched in intent or order.
- **Behavior 3 needs no new test:** "a brush asset written into an already-created project root still lands at `brushes/<64 hex>.webp`" is already pinned by 63-02's `brush_mask_asset_round_trips_through_disk_and_decodes_byte_identical`, whose fixture root has no `brushes/` and whose write creates it through the atomic writer. Task 2's action enumerates only the three explicit edits, so no cross-module duplicate was added.

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

Plan frontmatter carries `type: execute`; Task 2 carries `tdd="true"` and the phase runs with `workflow.tdd_mode=true`, so `task.is-behavior-adding` on the plan returns `true` (`tdd_true` / `has_behavior_block` / `has_source_files` all true). Task 2 nevertheless lands as a single `test(63-09)` commit (`eaaadbb91`) with no preceding RED, deliberately:

- All three `<behavior>` bullets already hold in HEAD. The plan's `<action>` explicitly prohibits adding `brushes` provisioning; the deliverable is the guard, not new production behavior.
- A RED assertion for "no `brushes` directory" passes immediately, which is `unexpected_green` under the fail-fast rules. Investigating (rule 1) confirms the feature already exists by design, not that the test is wrong.
- Per `tdd.md` fail-fast rule 1 and the 63-03 precedent, no RED was fabricated (adding the wrong behavior solely to make a test fail is exactly the fabrication the rule forbids). Green-by-construction is recorded here instead.

Observed commit order for the plan: `test(63-09)` (`c318b50ba`) → `test(63-09)` (`eaaadbb91`). No `feat(63-09)` commit exists because the plan intentionally adds no production behavior.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None - T-63-13 is mitigated and tested (byte equality plus re-validation through `read_brush_asset`), T-63-24 is mitigated and tested (digest recomputed from the copy compared with the stem), the fresh-profile copy path does not widen the frames MEDIA lock (the `bound_guard` pins stay green), and T-63-SC holds: no crate or dependency change.

## Next Phase Readiness

- The phase's portability law (TIP-16) is now proven at the filesystem level: a project travels as a directory and reproduces its masks exactly, so backup/restore and fresh-profile flows need no brush-specific migration.
- The provisioning law (D-20) is pinned both by assertion and by recorded reason; any future addition of `brushes` to `create_project_dir` fails `test_create_project_dir_creates_subdirectories` immediately.
- No runtime wiring is involved — both deliverables are test-level pins over behavior shipped by 63-02, so there is nothing left unexercised by the app.

---

*Phase: 63-brush-tip-pipeline*
*Completed: 2026-11-15*

## Self-Check: PASSED

- Both modified files exist on disk.
- Commits `c318b50ba` and `eaaadbb91` are ancestors of HEAD.
