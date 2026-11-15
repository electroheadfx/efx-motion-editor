---
phase: 63-brush-tip-pipeline
plan: 02
subsystem: engine
tags: [rust, tauri, webp, sha256, package-io, typescript, vitest, brush-tips]

requires:
  - phase: 63-brush-tip-pipeline
    provides: "63-01's two-branch mask derivation law and module registry — the 36,864-byte mask this plan encodes, stores and decodes"
provides:
  - "encode_mask_webp / decode_mask_webp: the pinned lossless brush-asset WebP profile (quality 100, method 6, exact alpha, no trivial-payload retry) and the 192×192 mask round trip"
  - "parse_webp_dimensions: a bounded RIFF header walk (VP8X / VP8 / VP8L) that refuses a non-192×192 declaration before any decoded buffer is allocated"
  - "The brush-asset disk leg: brushes/<sha256>.webp write/read through the bound-path guard with digest equality enforced on both directions"
  - "A sibling brushes/ branch in the bound-path guard, with the frames/ MEDIA lock provably unchanged"
  - "Four native commands and their ipc wrappers, including a one-call batch read with per-entry failure reasons"
  - "TypeScript brush-asset path helpers (build + fail-closed parse) that mint exactly the shape the Rust parser accepts"
affects: [63-brush-tip-pipeline]

actuals:
  tokens: 16534
  tasks: 3
  commits: 3
  plan_head_before: 60985e12faa0dedbbdae2b1cd23848595e11b994
  plan_head_after: 756068506b3127d104dd3254d4b174fdedd2b139

tech-stack:
  added: []
  patterns:
    - "Content-addressed asset law: the filename stem IS the SHA-256 of the stored bytes, checked before any IO on write and again after read, so a rename or corruption is a typed refusal"
    - "Header-first dimension gate: declared WebP size is parsed from a bounded RIFF walk before decode_rgba, so a hostile payload allocates nothing (T-63-03)"
    - "Batch reads degrade per entry to a fixed reason vocabulary and never reject the call; single-command failures keep the camelCase rejection labels"
    - "Sibling guard branches rather than a widened lock: brushes/ has its own parser and its own pin; the frames/ accept-set is untouched"

key-files:
  created: []
  modified:
    - app/src-tauri/src/services/frame_codec.rs
    - app/src-tauri/src/services/efx_paint_media.rs
    - app/src-tauri/src/commands/efx_paint_media.rs
    - app/src-tauri/src/lib.rs
    - app/src/lib/efxPaintPackage.ts
    - app/src/lib/efxPaintPackage.test.ts
    - app/src/lib/ipc.ts

key-decisions:
  - "The asset stem hashes the stored WebP bytes, not the source mask, so a copy or restore can be verified without decoding anything"
  - "decode_mask_webp is the only mask decoder: it checks declared dimensions from the header before decode_rgba and re-checks after, with WrongSize and Undecodable as separate rejection labels"
  - "The batch command returns both the exact stored WebP bytes and the decoded mask, because paint needs the mask while save must copy the stored bytes without re-encoding (D-11)"
  - "The batch's five reasons (missing / unreadable / wrong-size / digest-mismatch / refused) are deliberately a separate vocabulary from the rejection labels: one bad entry must not reject the whole call (D-18)"
  - "write_brush_asset derives the staging root in Rust exactly like write_frame_media; the renderer supplies only a validated basename, never a destination root"
  - "A malformed brush stem is unsupportedPackagePath and a foreign leaf extension is wrongExtension, so the guard's taxonomy stays the existing one"

patterns-established:
  - "Scalar predicate assertions on typed rejection variants (rejected(...) equality) so each guard row fails with the exact reason, not just 'an error'"
  - "Synthetic VP8X headers let tests prove refusal ordering without allocating or decoding a real hostile image"

requirements-completed: []

coverage:
  - id: D1
    description: "A 36,864-byte mask encodes to a lossless WebP and decodes back byte-identical, including a uniform mask that would trigger the frame path's trivial-payload retry"
    requirement: TIP-08
    verification:
      - kind: unit
        ref: "app/src-tauri/src/services/frame_codec.rs#brush_mask_round_trip_is_byte_identical, brush_mask_uniform_mask_round_trips_without_the_trivial_payload_retry"
        status: pass
      - kind: unit
        ref: "app/src-tauri/src/commands/efx_paint_media.rs#brush_mask_command_round_trip_returns_the_same_mask_bytes"
        status: pass
    human_judgment: false
  - id: D2
    description: "The encode command refuses a body that is not exactly 36,864 bytes; the write command refuses a stem that is not the SHA-256 of its bytes; the read refuses content that disagrees with its name"
    requirement: TIP-09
    verification:
      - kind: unit
        ref: "app/src-tauri/src/commands/efx_paint_media.rs#brush_mask_encode_command_refuses_a_body_that_is_not_192_squared_bytes"
        status: pass
      - kind: unit
        ref: "app/src-tauri/src/services/efx_paint_media.rs#brush_mask_write_refuses_a_stem_that_is_not_the_digest_of_its_bytes, brush_mask_read_refuses_content_that_disagrees_with_the_name"
        status: pass
    human_judgment: false
  - id: D3
    description: "A WebP declaring 20000×20000 is refused as wrong-size from the header before decoding; the bounded parser reads VP8X, VP8 and VP8L declarations and returns None for unparseable bytes"
    requirement: TIP-10
    verification:
      - kind: unit
        ref: "app/src-tauri/src/services/frame_codec.rs#brush_mask_decode_refuses_declared_dimensions_other_than_192_before_decoding, brush_mask_dimension_parser_reads_every_declared_size_kind"
        status: pass
      - kind: unit
        ref: "app/src-tauri/src/commands/efx_paint_media.rs#brush_mask_decode_command_refuses_a_hostile_declared_size_before_decoding"
        status: pass
    human_judgment: false
  - id: D4
    description: "The bound guard admits exactly brushes/<64 lower-hex>.webp (canonical and staged), refuses every malformed brush path and a symlinked leaf, and the frames MEDIA lock still refuses brush-shaped paths"
    requirement: TIP-09
    verification:
      - kind: unit
        ref: "app/src-tauri/src/services/efx_paint_media.rs#bound_guard_admits_exactly_the_brush_asset_shape, bound_guard_refuses_everything_outside_the_transaction_file_set, media_lock_stays_locked_to_the_frames_webp_tree"
        status: pass
    human_judgment: false
  - id: D5
    description: "One batch read returns N results in input order, each independently ok or failed, with reasons missing, unreadable, wrong-size, digest-mismatch and refused"
    requirement: TIP-10
    verification:
      - kind: unit
        ref: "app/src-tauri/src/services/efx_paint_media.rs#brush_mask_batch_read_returns_every_entry_with_its_own_reason"
        status: pass
    human_judgment: false
  - id: D6
    description: "The TypeScript path helpers mint exactly the Rust-accepted shape and fail closed on traversal, upper-case, off-by-one stems, foreign extensions and extra segments"
    requirement: TIP-08
    verification:
      - kind: unit
        ref: "app/src/lib/efxPaintPackage.test.ts#brush asset references (63-02, D-10)"
        status: pass
      - kind: other
        ref: "pnpm --filter efx-motion-editor exec tsc --noEmit"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-11-15
status: complete
---

# Phase 63 Plan 02: Brush Mask Asset Boundary Summary

**Content-addressed lossless WebP brush assets at `brushes/<sha256>.webp`: one higher-effort encode profile, a header-first 192×192 gate, write/read digest law, and a one-call batch read that degrades per entry**

## Performance

- **Duration:** 8 min
- **Started:** 2026-11-15T10:42:42Z
- **Completed:** 2026-11-15T10:50:42Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- `encode_mask_webp` adds a separate higher-effort profile (quality 100, method 6, alpha compression 0, exact alpha) on the existing lossless codec, expands the 36,864 alpha bytes into RGBA with constant RGB 255, refuses a wrong-length input before allocating, and never applies the frame path's trivial-payload retry.
- `decode_mask_webp` is the single mask decoder. `parse_webp_dimensions` walks a bounded RIFF header (VP8X canvas size, VP8 frame header, VP8L packed size) and the decoder refuses a non-192×192 declaration before `decode_rgba` runs — a synthetic 20000×20000 header returns `wrongSize` with no decoded buffer, and the post-decode size check stays as the second line.
- The disk leg lives in `efx_paint_media.rs`: `BRUSH_ASSET_ROOT`, the one `parse_brush_asset_relative_path` shell, a sibling `brushes/` branch in `resolve_package_bound_path`, and `write_brush_asset`/`read_brush_asset` that digest the bytes and compare with the filename stem in both directions (`DigestMismatch`).
- Four commands (`efx_paint_encode_brush_mask`, `efx_paint_write_brush_asset`, `efx_paint_decode_brush_mask`, `efx_paint_read_brush_assets`) are registered in `lib.rs`; the batch takes `packageDir` as a header and `{entries}` as JSON, returns per-entry results in input order, and never aborts for one failing entry.
- TypeScript gains `BRUSH_ASSETS_DIR`, `BRUSH_ASSET_DIGEST_PATTERN`, `buildBrushAssetRelativePath`, the fail-closed `parseBrushAssetRelativePath`, four ipc wrappers decoding base64 locally, and the `digestMismatch`/`wrongSize`/`undecodable` rejection labels.
- Plan verification: 134/134 Rust lib tests, brush filter 14/14, bound_guard 2/2, the frames MEDIA-lock pin green, vitest `efxPaintPackage` 98/98, `tsc --noEmit` exit 0, and no dependency-file diff against the plan base.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end mask asset — encode, write, read back identical (tracer)** — `428b96357` (feat)
2. **Task 2: Bound guard — brushes branch without widening the frames lock** — `2fd04cbfc` (test)
3. **Task 3: Batch read and TypeScript path helpers** — `756068506` (feat)

_Note: the plan frontmatter is `type: execute`; see `## TDD Gate Compliance` for the commit-shape record._

## Files Created/Modified

- `app/src-tauri/src/services/frame_codec.rs` — brush-mask constants, `encode_mask_webp`, `parse_webp_dimensions`, `decode_mask_webp`, plus five `brush_mask_*` tests
- `app/src-tauri/src/services/efx_paint_media.rs` — `BRUSH_ASSET_ROOT`, brush path parser, `brushes/` bound-guard branch, `write_brush_asset`/`read_brush_asset`/`read_brush_assets`, `DigestMismatch`/`WrongSize`/`Undecodable` rejections, and the guard/batch pins
- `app/src-tauri/src/commands/efx_paint_media.rs` — three brush commands, the batch command with its request/response wire shapes, and three command-level tests
- `app/src-tauri/src/lib.rs` — all four brush commands registered in `generate_handler!`
- `app/src/lib/efxPaintPackage.ts` — brush asset dir/digest constants and build/parse helpers
- `app/src/lib/efxPaintPackage.test.ts` — brush asset reference contract (12 new cases)
- `app/src/lib/ipc.ts` — four brush IPC wrappers and the extended rejection label set

## Decisions Made

- **Digest of the stored bytes:** the stem is the SHA-256 of the WebP file, not of the source mask. A restored package can therefore be verified without decoding, and a renamed or corrupted asset is `digestMismatch` on read.
- **Header-first gate:** `decode_mask_webp` owns the ordering (declared size → decode → post-decode size). No caller can decode first and check later, which is what makes the DoS mitigation structural rather than conventional.
- **Separate batch vocabulary:** the five batch reasons are stable wire strings, and `read_one_brush_asset` maps the typed error taxonomy into them. Unknown single-command labels degrade to `io` in the TS normalizer; unknown batch reasons degrade to `refused`.
- **Sibling, not widening:** the brush branch is a separate `if` in the bound guard with its own parser, and the MEDIA-lock pin gained a row proving `brushes/<digest>.webp` is still refused there.
- **Testability without `Request`:** body handling lives in `encode_brush_mask_bytes` / `decode_brush_mask_bytes`, so the acceptance rows are pinned as unit tests without constructing a private-field `tauri::ipc::Request`.

## Deviations from Plan

### One shape addition: two extra rejection labels

- **Found during:** Task 1 (decode command)
- **Issue:** `decode_mask_webp` distinguishes `wrong-size` from `unreadable`, but `EfxPaintMediaRejection` had no variants to carry them, so the decode command could only have answered with a generic `io`.
- **Fix:** added `WrongSize` (`wrongSize`) and `Undecodable` (`undecodable`) alongside the planned `DigestMismatch`, and extended `EFX_PAINT_MEDIA_REJECTION_LABELS` so the TS normalizer keeps them typed instead of degrading them to `io`.
- **Files modified:** `app/src-tauri/src/services/efx_paint_media.rs`, `app/src/lib/ipc.ts`
- **Verification:** the hostile-header row asserts the exact `WrongSize` variant; the TS label array is covered by the existing normalizer tests and the app typecheck.
- **Committed in:** `428b96357` (Task 1) and `756068506` (Task 3)

**Total deviations:** 1 shape addition (Rule 2 — the named-refusal acceptance criterion cannot be met without it). No auto-fixed bugs, no blocking issues.
**Impact on plan:** none on scope; the taxonomy stays total and every new label is handled by the TS side.

## TDD Gate Compliance

Plan frontmatter carries `type: execute`, and no task declares `tdd="true"`; `task.is-behavior-adding` returned false for all three, so the plan-level RED→GREEN sequence gate does not apply. Observed commit order is `feat(63-02)` (`428b96357`) → `test(63-02)` (`2fd04cbfc`) → `feat(63-02)` (`756068506`): Task 1 is a tracer that intentionally delivers the slice end-to-end before Task 2 pins the guard rows, matching the 63-01 precedent. No RED was fabricated.

## Issues Encountered

- The first Task 1 test compile failed because `unwrap_err` needs `Debug` on the success type; the three brush response structs gained `#[derive(Debug)]`.
- `cargo test ... --lib bound_guard` does not select the frames MEDIA-lock pin (its name is `media_lock_stays_locked_to_the_frames_webp_tree`). The pin was run explicitly and is green; both test names are documented in the coverage block.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None - every new surface (brush tree traversal, hostile declared dimensions, name/content disagreement) is covered by the plan's threat register (T-63-01, T-63-03, T-63-05), and no crate or npm dependency was added (T-63-SC).

## Next Phase Readiness

- Plans 63-03/63-04 can consume the four commands: the built-in bake writes through `write_brush_asset`, and save passes the batch's `webpBase64` bytes straight back through `write_brush_asset` with a staging basename, so a stored mask is never re-encoded.
- `TIP-08`, `TIP-09` and `TIP-10` are deliberately NOT marked complete at plan level: their save/open halves (63-04), import-cap halves (`file.size` ≤ 64 MB, decoded pixels ≤ 64 MP in 63-05/63-06) and the reopen UAT row (63-07) still own part of each requirement, mirroring the 63-01 sharing note.
- The app never calls these wrappers yet; wiring arrives with the import surface and the built-in bake, which is expected plan scope rather than a stub.

---
*Phase: 63-brush-tip-pipeline*
*Completed: 2026-11-15*

## Self-Check: PASSED

- All seven modified files exist on disk.
- Commits `428b96357`, `2fd04cbfc`, `756068506` are ancestors of HEAD.
