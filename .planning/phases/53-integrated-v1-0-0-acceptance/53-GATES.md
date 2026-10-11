# Phase 53 — REL-01 Automated Gate Evidence Record

**Date:** 2026-10-11
**Commit under test:** `0dc40f8b` (worktree HEAD — the 1.0.0 bump `359ada83` plus the user-approved D-21 scoped WINDOWS.md #90 fix merge)
**Gate order:** locked spec order — compile-proof gates run only AFTER the contract-stable 1.0.0 bump (`359ada83`, 2026-10-11 08:29:37 +0200; every gate timestamp below post-dates it — Pitfall 8 satisfied).
**Evidence policy:** every exit status was captured fresh in this session via `GATE_N_EXIT=$?` immediately after each command — never assumed or reused from a prior session.

## Version bump (Task 1)

All five product version surfaces read `1.0.0` in one atomic commit `359ada83`:

| Surface | File:Line | Value |
|---------|-----------|-------|
| Single source of truth | `app/package.json:4` | `"version": "1.0.0"` |
| Tauri config | `app/src-tauri/tauri.conf.json:4` | `"version": "1.0.0"` |
| Cargo package | `app/src-tauri/Cargo.toml:3` | `version = "1.0.0"` |
| Cargo.lock root package | `app/src-tauri/Cargo.lock:1068` (efx-motion-editor block only) | `version = "1.0.0"` |
| Release script | `scripts/macos-release.sh:10` | `PRODUCT_VERSION="1.0.0"` |

`git show 359ada83 --stat` → exactly **6 files changed, 1 line each**; the `Cargo.lock` change is exactly **1 changed line** (the `efx-motion-editor` root package block — no global replace).

`pnpm --dir app exec vitest run src/releaseContract.test.ts` → **11 tests passed** (single-source agreement oracle; `releaseContract.test.ts:53-61` asserts all five surfaces equal `packageJson.version`). Re-confirmed inside the full run of gate REL-01-1: `✓ src/releaseContract.test.ts (11 tests)`.

README `## Release` section refreshed to the v1.0.0 milestone paragraph in the same commit (skill hard rule 3).

## Precondition record (Task 2 gate)

The full vitest suite was green at HEAD **before any other gate ran** — precondition run 2026-10-11 10:16:46 (local): `Test Files 259 passed | 2 skipped (261)` / `Tests 4809 passed | 1 skipped | 96 todo`, **0 failed test files, exit 0**. The WINDOWS.md #90 circular-import failure (paintStore/projectStore) was cleared by the user-approved D-21 scoped fix, merged as `0dc40f8b` before this run. The 2 skipped files (glslRuntime, exportSidecar) are authored skips.

## Stale-artifact archival (Task 2)

Stale v0.9.0 release bundles **archived (not deleted)** per the 44-GATES Task 2 pattern:

- Destination: `app/src-tauri/target/release/bundle/archive-v0.9.0-20261011/`
- Archived count: **2** artifacts
  1. `EFX Motion Editor.app` (`CFBundleShortVersionString` 0.9.0; inner binary `Contents/MacOS/efx-motion-editor` mtime 2026-09-18) — moved from `bundle/macos/`
  2. `EFX Motion Editor_0.9.0_aarch64.dmg` (2026-08-21, 15,704,448 bytes) — moved from `bundle/dmg/`
- Post-move discovery check:
  - `bundle/macos/` → **zero `.app`** (`find … -maxdepth 1 -name "*.app" | wc -l` → 0)
  - `bundle/dmg/` → **zero `*_0.9.0_*.dmg`** (`find … -name "*_0.9.0_*.dmg" | wc -l` → 0); `bundle_dmg.sh`, `icon.icns`, `notarization-evidence` remain in place
- Location note: `target/` is per-checkout (gitignored). The bound execution worktree has no `target/`; the stale bundles existed only in the repo-root checkout — the directory the credentialed wrapper (plan 53-03) scans — and were archived there. The repo-root `bundle/macos/` now holds zero `.app` and `bundle/dmg/` zero `_0.9.0_` DMGs.
- `find_release_artifacts` (exactly-one-or-fatal, `scripts/macos-release.sh:341-357`) now finds zero stale artifacts → the credentialed run will discover only the fresh v1.0.0 build.

## The six REL-01 gates (spec order)

All six ran **after** the 1.0.0 bump (Pitfall 8 satisfied — no compile-proof gate ran against pre-bump version surfaces).

REL-01-1: `pnpm --dir app exec vitest run` — exit 0 — marker: `Test Files 259 passed | 2 skipped (261)` / `Tests 4809 passed | 1 skipped | 96 todo` (0 failed test files) — 2026-10-11 10:18:43 (local)
REL-01-2: `pnpm --dir app run typecheck` — exit 0 — marker: `tsc --noEmit` completed, no errors — 2026-10-11 10:18:56 (local)
REL-01-3: `pnpm build` — exit 0 — marker: `✓ built in 3.23s` — 2026-10-11 10:19:29 (local)
REL-01-4: `cargo test --manifest-path app/src-tauri/Cargo.toml` — exit 0 — marker: `test result: ok. 63 passed; 0 failed` (every suite reports 0 failed) — 2026-10-11 10:20:18 (local)
REL-01-5: `bash -n scripts/macos-release.sh` — exit 0 — marker: clean parse (no syntax output) — 2026-10-11 10:20:23 (local)
REL-01-6: `bash scripts/macos-release.sh preflight` — exit 0 — marker: `PREFLIGHT PASS: release configuration, Apple CLI capabilities, resources, and private-asset guards` — 2026-10-11 10:21:03 (local)

## Hard boundaries respected (hard-boundaries footer)

- No Apple credential file accessed, opened, or searched.
- No global version replace in Cargo.lock (transitive dependency versions untouched — only the `efx-motion-editor` root package block changed).
- No modification of `scripts/macos-release.sh` beyond line 10 (`PRODUCT_VERSION="1.0.0"`).
- No functional source file changed (the only repo file edits are the five version surfaces + README + this evidence record).
- No test-config change, no skipped or narrowed test run, no dev server started, no Vitest watch mode (D-21 release-only stop-and-flag held: no gate needed a fix).
