# Phase 44 — REL-01 Automated Gate Evidence Record

**Date:** 2026-08-21
**Commit under test:** `d66feaf8` (chore(release): bump product version to 0.9.0)
**Gate order:** locked D-03 order — compile-proof gates run only AFTER the contract-stable 0.9.0 bump (Pitfall 8 satisfied).
**Evidence policy:** every exit status was captured fresh this session via `echo "GATE<n>_EXIT=$?"` after each command — never assumed or reused from a prior session.

## Version bump (Task 1)

All five product version surfaces read `0.9.0` in one atomic commit `d66feaf8`:

| Surface | File:Line | Value |
|---------|-----------|-------|
| Single source of truth | `app/package.json:4` | `"version": "0.9.0"` |
| Tauri config | `app/src-tauri/tauri.conf.json:4` | `"version": "0.9.0"` |
| Cargo package | `app/src-tauri/Cargo.toml:3` | `version = "0.9.0"` |
| Cargo.lock root package | `app/src-tauri/Cargo.lock:972` (efx-motion-editor block only) | `version = "0.9.0"` |
| Release script | `scripts/macos-release.sh:10` | `PRODUCT_VERSION="0.9.0"` |

`git diff --stat app/src-tauri/Cargo.lock` → exactly **1 changed line** (1 insertion, 1 deletion).

`pnpm --dir app exec vitest run src/releaseContract.test.ts` → **11 tests passed** (single-source agreement oracle; `releaseContract.test.ts:52-61` asserts all five surfaces equal `packageJson.version`).

> Note: the plan's gate command spelled the test path `app/src/releaseContract.test.ts`; this vitest config filters relative to the `app` workspace root (`include: src/**/*.test.ts`), so the `app/` prefix resolves to no files. The corrected invocation `src/releaseContract.test.ts` was used for every run; functional contract is identical.

## Stale-artifact archival (Task 2)

Stale v0.8.1 release bundles **archived (not deleted)** per Open Question 3:

- Destination: `app/src-tauri/target/release/bundle/archive-v0.8.1-20260821/`
- Archived count: **2** artifacts
  1. `EFX Motion Editor.app` (stale 7-août build) — moved from `bundle/macos/`
  2. `EFX Motion Editor_0.8.1_aarch64.dmg` (stale 4-août) — moved from `bundle/dmg/`
- Post-move discovery check:
  - `bundle/macos/` → zero `.app` (the archived `.app` lives under `archive-v0.8.1-20260821/`, which the `find_release_artifacts` `*/release/bundle/macos/EFX Motion Editor.app` path does NOT match)
  - `bundle/dmg/` → zero `*_0.8.1_*.dmg`
- `find_release_artifacts` (exactly-one-or-fatal, `scripts/macos-release.sh:341-357`) now finds zero stale artifacts → the credentialed run will discover only the fresh v0.9.0 build.

## The six REL-01 gates (D-03 order)

All six ran **after** the 0.9.0 bump (Pitfall 8 satisfied — no compile-proof gate ran against stale 0.8.1 code).

REL-01-1: `pnpm --dir app exec vitest run` — exit 0 — marker: `Test Files 138 passed` / `Tests 2675 passed` — 2026-08-21 11:41:10–11:41:18 (local)
REL-01-2: `pnpm --dir app run typecheck` — exit 0 — marker: `tsc --noEmit` completed, no errors — 2026-08-21 11:41:21 (local)
REL-01-3: `pnpm build` — exit 0 — marker: `✓ built in 3.03s` — 2026-08-21 11:41:41 (local)
REL-01-4: `cargo test --manifest-path app/src-tauri/Cargo.toml` — exit 0 — marker: `test result: ok. 20 passed; 0 failed` — 2026-08-21 ~11:42 (local)
REL-01-5: `bash -n scripts/macos-release.sh` — exit 0 — marker: clean parse (no syntax output) — 2026-08-21 ~11:42 (local)
REL-01-6: `bash scripts/macos-release.sh preflight` — exit 0 — marker: `PREFLIGHT PASS: release configuration, Apple CLI capabilities, resources, and private-asset guards` — 2026-08-21 ~11:46 (local)

## Recorded spec-vs-implementation divergences (recorded, NOT fixed — D-09)

### 1. Chunk-budget divergence (REL-01 encoding)
- **Spec:** Phase 5 references an 1100 kB desktop chunk budget.
- **Implementation:** `app/src/viteBuild.test.ts:138` asserts the amended **1120** budget (`chunkSizeWarningLimit`), and `viteBuild.test.ts:189` records the budget raised 1110 → 1120 after warning-disposition fixes (+9.8 kB).
- **Decision:** gate on 1120 (reverting to 1100 would fail the build for no benefit). Gate 1 (vitest, includes `viteBuild.test.ts`) passed with the 1120 assertion green. No code change made.

### 2. Truncation-label divergence (carried to UAT)
- **Spec:** Phase 5 step 12 asserts the French label `Boucle raccourcie par le clip suivant`.
- **Implementation (43-approved):** English label `Loop shortened by next clip`.
- **Decision:** this plan does not touch the label (D-09); the signed-app UAT in plan 02 judges against the shipped English label and records the divergence as known-spec, not regression.

## Hard boundaries respected

- No Apple credential file accessed, opened, or searched.
- No `release` / `verify-downloaded` run (user-owned, later plans).
- No tag created, no push.
- No dev server started; no Vitest watch mode.
- No global version replace in Cargo.lock (transitive dependency versions untouched — only the `efx-motion-editor` root package block changed).
- No modification of `scripts/macos-release.sh` beyond line 10 (`PRODUCT_VERSION="0.9.0"`).
- No functional source file changed (the only repo file edits are the five version surfaces + this evidence record).
- No package installed (the bump is a config change, not an install — T-44-SC mitigated).
