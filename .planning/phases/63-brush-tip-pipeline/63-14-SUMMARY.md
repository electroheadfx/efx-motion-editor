---
phase: 63-brush-tip-pipeline
plan: 14
subsystem: native-package-io
tags: [rust, tauri, brush-assets, read-cap, denial-of-service, wr-06, tip-10]

# Dependency graph
requires:
  - phase: 63-brush-tip-pipeline
    plan: 02
    provides: the content-addressed brush asset read/write leg and the five-reason per-entry batch vocabulary
  - phase: 63-brush-tip-pipeline
    plan: 05
    provides: the 64 MP pre-decode import cap (a different boundary from this stored-asset read cap)
provides:
  - BRUSH_ASSET_MAX_READ_BYTES (16 MiB) — the one bound on a stored brush asset read
  - a metadata-only size refusal in read_brush_asset, ahead of the digest and dimension guards
  - pins for the exact boundary (one byte over / exactly at) and for per-entry batch degradation
affects: [phase 63 verification, any future brush-asset read path, project-open brush batch read]

# Actuals (#2632) — same estimateTokens scale (chars/4 over the realized diff).
actuals:
  tokens: 2016
  tasks: 2
  commits: 2

# Plan commit ledger (#3968) — measured, not narrated.
plan_head_before: eb05b91a52c30ff31623cf4751fc4999f9ade12f
plan_head_after: eb329aa2a2653d13597e7d408d1d6485d0113ca3

tech-stack:
  added: []
  patterns:
    - "Metadata-before-read bound: a leaf's length is checked from fs::metadata before fs::read, so a hostile file is refused before its bytes are resident"
    - "Sparse-file boundary fixtures: File::create + set_len pins both ends of a byte-exact cap at zero disk cost"

key-files:
  created: []
  modified:
    - app/src-tauri/src/services/efx_paint_media.rs

key-decisions:
  - "BRUSH_ASSET_MAX_READ_BYTES is 16 MiB with the rationale recorded beside the constant: a 192x192 lossless WebP mask is far under it, and the cap exists so a hostile or corrupted package cannot allocate unbounded memory before the digest and pre-decode dimension guards run (D-12 — all package IO stays in Rust)"
  - "The cap check is fs::metadata on the already-canonicalized leaf, placed after the extension check and strictly before fs::read, so no branch reads the file to discover it is over-cap"
  - "The refusal is EfxPaintMediaError::Io, not Rejected: read_one_brush_asset already maps Io(_) to BRUSH_READ_UNREADABLE, so the cap reuses the existing per-entry vocabulary and never aborts the batch"
  - "The boundary is strict greater-than; a file of exactly the cap is read and reaches the digest check, so a legitimate asset is never refused by the size guard"
  - "One shared sparse_brush_asset helper (File::create + set_len) builds the over-cap and exact-cap fixtures, keeping every pin free of real disk allocation"

patterns-established:
  - "Bound-before-allocate: a size guard reads metadata, never bytes, and returns an Io refusal that maps onto the shipped per-entry reason"
  - "Boundary pair pins: every byte-exact cap ships one over-cap refusal test and one exact-cap admission test"

requirements-completed: [TIP-04, TIP-08, TIP-09, TIP-10]

coverage:
  - id: D1
    description: "read_brush_asset refuses an asset one byte over BRUSH_ASSET_MAX_READ_BYTES from metadata alone, as an Io error, and never reads the file (the discriminator is that it is NOT a digest mismatch)"
    requirement: TIP-10
    verification:
      - kind: unit
        ref: "app/src-tauri/src/services/efx_paint_media.rs#brush_mask_read_cap_refuses_an_asset_one_byte_over_the_limit"
        status: pass
    human_judgment: false
  - id: D2
    description: "the cap is byte-exact: a file of exactly BRUSH_ASSET_MAX_READ_BYTES is read and reaches the digest check (strict greater-than)"
    requirement: TIP-10
    verification:
      - kind: unit
        ref: "app/src-tauri/src/services/efx_paint_media.rs#brush_mask_read_cap_admits_an_asset_exactly_at_the_limit"
        status: pass
    human_judgment: false
  - id: D3
    description: "a batch holding one healthy encoded asset and one over-cap sparse asset returns both entries in input order; the healthy entry stays a full Read and the over-cap entry degrades alone to BRUSH_READ_UNREADABLE"
    requirement: TIP-10
    verification:
      - kind: unit
        ref: "app/src-tauri/src/services/efx_paint_media.rs#brush_mask_batch_read_over_cap_entry_degrades_alone"
        status: pass
    human_judgment: false
  - id: D4
    description: "no sixth brush-read reason joins the wire: the five BRUSH_READ_* constants are unchanged and the existing per-entry mapping test still passes"
    requirement: TIP-10
    verification:
      - kind: unit
        ref: "app/src-tauri/src/services/efx_paint_media.rs#brush_mask_batch_read_returns_every_entry_with_its_own_reason"
        status: pass
      - kind: other
        ref: "grep -n 'pub const BRUSH_READ_' app/src-tauri/src/services/efx_paint_media.rs — exactly five constants, unchanged"
        status: pass
    human_judgment: false

duration: 3 min
completed: 2026-11-15
status: complete
---

# Phase 63 Plan 14: Bounded stored-asset read Summary

**WR-06 closed: `read_brush_asset` now refuses an over-cap brush asset from the leaf's metadata, before a single byte is allocated — the refusal surfaces as the existing per-entry `unreadable` reason, so one hostile or corrupted asset costs one tip and never the batch.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-11-15T15:29:44Z
- **Completed:** 2026-11-15T15:32:32Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- `BRUSH_ASSET_MAX_READ_BYTES` (16 MiB) sits beside `BRUSH_ASSET_ROOT` with its rationale documented: a 192×192 lossless WebP mask is far under the bound, and the cap exists so a hostile or corrupted `.mce` cannot make the read allocate unbounded memory before the digest and the pre-decode dimension guards it was meant to protect (D-12 keeps the cap in Rust).
- `read_brush_asset` inspects the resolved leaf's metadata after the extension check and strictly before `fs::read`: an over-cap file is refused without its contents ever being read, and the refusal stays `EfxPaintMediaError::Io` so `read_one_brush_asset` maps it to the shipped `unreadable` reason — no sixth wire string, no whole-batch failure.
- The boundary is pinned on both sides with sparse-file fixtures: one byte over the cap is refused as `Io` (and explicitly not as a digest mismatch, which reading the all-zero payload first would have produced), while a file of exactly the cap is read and reaches the digest check.
- The batch law is pinned end-to-end: a healthy encoded mask asset and an over-cap sparse asset in the same fixture package both come back in input order, the healthy entry keeps its digest, stored bytes and decoded mask, and the over-cap entry degrades alone to `BRUSH_READ_UNREADABLE` (D-18).
- The whole brush read/write/batch family is green — 20 passed, 0 failed — including the pre-existing digest, missing, staging, round-trip and per-entry-reason pins.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end — an over-cap stored asset is refused before it is read** - `6e10329ea` (feat)
2. **Task 2: Batch degradation — an over-cap asset costs only its own entry** - `eb329aa2a` (test)

**Plan metadata:** see the final `docs(63-14): complete …` commit.

## Files Created/Modified

- `app/src-tauri/src/services/efx_paint_media.rs` — added `BRUSH_ASSET_MAX_READ_BYTES` (16 MiB) with its rationale; `read_brush_asset` now calls `fs::metadata` on the canonicalized leaf after the extension check and returns an `io_error` naming the cap when the length is strictly greater than it, before any `fs::read`; added the three pins plus one shared `sparse_brush_asset` helper (`File::create` + `set_len`) that builds all three sparse fixtures without writing bytes.

## Decisions Made

- **Metadata before bytes.** The check reads only `fs::metadata(&canonical).len()`. The plan's prohibition — never read an over-cap file to discover it is over-cap — is met by construction: the refusal branch sits one line above `fs::read`, and the over-cap pin's discriminator is that the outcome is NOT the digest mismatch that reading would have produced.
- **`Io`, not `Rejected`.** Keeping the refusal an `Io` error is what makes it invisible on the wire: `read_one_brush_asset` already maps `Io(_)` to `BRUSH_READ_UNREADABLE`, the per-entry degradation reason the app turns into an unavailable tip. A `Rejected(_)` arm would have been mislabelled `refused` for a size problem.
- **Strict greater-than, 16 MiB.** A lossless 192×192 mask is orders of magnitude smaller, so the cap never binds a legitimate asset; pinning both ends proves a file at exactly the cap is still read.
- **One sparse-fixture helper.** `sparse_brush_asset` centralises `File::create` + `set_len`; the tests cost no disk and no multi-MiB writes, and the three pins cannot drift in how they build their over-cap leaf.

## Deviations from Plan

None - plan executed exactly as written.

The only implementation choice beyond the letter of the plan is the shared `sparse_brush_asset` helper, which is the plan's own prescribed `File::create` + `set_len` sequence factored for the three call sites; behaviour and assertions are exactly as specified.

## Issues Encountered

None. Both verify gates reported their expected counts on the first run, and the pre-existing brush pins passed unchanged.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- WR-06 is closed at the read leg; the bound is enforced inside the same function every stored-asset read already passes through, so no caller needs an exclusion list.
- The five-reason batch vocabulary is unchanged, so the app's `EfxPaintBrushAssetReadReason` mapping (`app/src/lib/ipc.ts`) needs no change and an over-cap tip renders as an unavailable tip like any other unreadable asset.
- Plans 63-11 and 63-12 remain open in phase 63; nothing in this plan blocks them.
- Regression sweep: `cargo test --manifest-path app/src-tauri/Cargo.toml brush_` → 20 passed, 0 failed (the whole brush read/write/batch family, including the six new-plus-adjusted pins).

## TDD Gate Compliance

- **Task 1** is `type="tracer"` (not `tdd="true"`): production code and its two pins landed together in `feat(63-14)` `6e10329ea`. The tracer feedback gate re-ran the task `<verify>` after the commit (`test result: ok. 2 passed`) and continued — no checkpoint, per the end-of-phase human-verify mode with an automated-only verify.
- **Task 2** is `tdd="true"` but its planned production change is none: the per-entry mapping this pin exercises (`Io(_)` → `BRUSH_READ_UNREADABLE`) already shipped, and the cap it needs was delivered by Task 1 in this same plan. The `test(63-14)` commit `eb329aa2a` is therefore green by construction over that seam — no fabricated RED, matching the recorded 63-09 and 62/CRV-03 precedent.
- **Rust RED gate gap (#4379).** `workflow.tdd_mode` is true, yet the commit-scope RED gate cannot see Rust: `#[test]` lives inside `src/*.rs`, so a RED commit touching it is indistinguishable from ordinary source, and `cargo test`'s console output has no supported RED-evidence adapter. No evidence record was produced; the assertions above are the authoritative evidence.

## Self-Check: PASSED

- `app/src-tauri/src/services/efx_paint_media.rs` — FOUND
- Commits `6e10329ea`, `eb329aa2a` — ancestor of HEAD (FOUND)
- Verify gates: `brush_mask_read_cap` → `test result: ok. 2 passed`; `brush_mask_batch_read_over_cap` → `test result: ok. 1 passed`; `brush_` family → `test result: ok. 20 passed`
- `BRUSH_READ_*` vocabulary — exactly five constants, unchanged

---
*Phase: 63-brush-tip-pipeline*
*Completed: 2026-11-15*
