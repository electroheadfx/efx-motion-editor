---
phase: 44-integrated-uat-signed-release
plan: 01
subsystem: release
tags: [tauri, macos, version-bump, release-gates, release-contract, apple]

# Dependency graph
requires:
  - phase: 43 (v0.8.1 packaging hotfix, quick 260801-jun)
    provides: releaseContract.test.ts, viteBuild.test.ts, scripts/macos-release.sh (the single-source agreement oracle and gate seams)
provides:
  - five product version surfaces at 0.9.0 in one atomic commit (package.json single source)
  - stale v0.8.1 release bundles archived (not deleted) under bundle/archive-v0.8.1-20260821/
  - 44-GATES.md: six REL-01 gate exit-status evidence in locked D-03 order + two recorded spec-vs-implementation divergences
affects:
  - 44-02 (signed-app UAT judges the 0.9.0 artifact and the recorded truncation-label divergence)
  - 44-03 (release run consumes the 0.9.0 surfaces; clean exactly-one-or-fatal artifact discovery)
  - 44-VALIDATION, verify-work (gate evidence sampling)

# Actuals (#2632) — pairs with the plan's estimate (50000 tokens) to calibrate future estimates.
actuals:
  tokens: 1804    # chars/4 over the realized diff (1936 bytes version-surface diff + 5281 bytes 44-GATES.md)
  tasks: 2        # tasks completed
  commits: 2      # commits made

# Tech tracking
tech-stack:
  added: []       # zero packages installed this phase (T-44-SC mitigated — bump is a config change, not an install)
  patterns:
    - "Single-source version agreement: 5 surfaces edited in one atomic commit, proven by releaseContract.test.ts:53-61"
    - "Gate-run pattern: six REL-01 gates in exact D-03 order AFTER the contract change (Pitfall 8), per-gate exit status captured fresh"

key-files:
  created:
    - .planning/phases/44-integrated-uat-signed-release/44-GATES.md
  modified:
    - app/package.json
    - app/src-tauri/tauri.conf.json
    - app/src-tauri/Cargo.toml
    - app/src-tauri/Cargo.lock
    - scripts/macos-release.sh

key-decisions:
  - "Gate on the amended 1120 kB chunk budget (viteBuild.test.ts:138), recording the spec-1100 divergence — do NOT revert to 1100"
  - "Truncation label judged against the shipped English copy in plan 02's signed-app UAT; French spec label recorded as known divergence, no code change (D-09)"
  - "Archive (not delete) stale v0.8.1 bundles per RESEARCH Open Question 3 — keep the old DMG locally"
  - "Vitest gate invocations use src/... paths (relative to the app workspace root), not app/src/... — the plan's app/-prefixed path resolves to no files"

patterns-established:
  - "Release gate evidence ledger: every gate exit status captured via explicit echo of $?, never assumed from a prior session (D-03)"
  - "Stale-artifact archival before exactly-one-or-fatal discovery: archive dir under bundle/ is invisible to find_release_artifacts' */release/bundle/macos/ glob"

requirements-completed: [REL-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Five product version surfaces bumped 0.8.1 -> 0.9.0 in one atomic commit, all agreeing with app/package.json as single source"
    requirement: REL-01
    verification:
      - kind: unit
        ref: "app/src/releaseContract.test.ts#all product-owned version surfaces agree with app/package.json (single source)"
        status: pass
      - kind: unit
        ref: "app/src/releaseContract.test.ts (full file, 11 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Stale v0.8.1 release bundles archived so find_release_artifacts exactly-one-or-fatal discovery finds zero stale artifacts"
    requirement: REL-01
    verification:
      - kind: manual_procedural
        ref: "find app/src-tauri/target/release/bundle/macos -name '*.app' -> 0; find bundle/dmg -name '*_0.8.1_*.dmg' -> 0; archived count 2 under bundle/archive-v0.8.1-20260821/"
        status: pass
    human_judgment: false
  - id: D3
    description: "All six REL-01 automated gates run green in the locked D-03 order after the 0.9.0 bump, each with recorded exit status in 44-GATES.md"
    requirement: REL-01
    verification:
      - kind: manual_procedural
        ref: "44-GATES.md REL-01-1..REL-01-6 (vitest 2675 tests exit 0, typecheck exit 0, build exit 0, cargo test 20 tests exit 0, bash -n exit 0, preflight PREFLIGHT PASS exit 0)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Chunk-budget spec-vs-implementation divergence (1100 spec vs 1120 actual) recorded, not fixed"
    requirement: REL-01
    verification:
      - kind: unit
        ref: "app/src/viteBuild.test.ts:138 (chunkSizeWarningLimit must resolve to the documented 1120 desktop budget)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Truncation-label divergence (French spec vs shipped English) carried to the plan-02 signed-app UAT to judge against shipped values"
    verification: []
    human_judgment: true
    rationale: "The shipped English label is a user-facing copy judgment; plan 02's native UAT is the human oracle that adjudicates it against the French spec step"

# Metrics
duration: 12min
completed: 2026-08-21
status: complete
---

# Phase 44 Plan 1: v0.9.0 Pre-Release Gate Plan Summary

**Five-surface 0.9.0 version bump (atomic), stale v0.8.1 bundle archival, and all six REL-01 gates green in locked D-03 order with recorded per-gate exit-status evidence**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-21T09:39:30Z
- **Completed:** 2026-08-21T09:51:33Z
- **Tasks:** 2
- **Files modified:** 5 (+1 evidence record created)

## Accomplishments

- All five product version surfaces (`app/package.json`, `app/src-tauri/tauri.conf.json`, `app/src-tauri/Cargo.toml`, `app/src-tauri/Cargo.lock` root-package block, `scripts/macos-release.sh` line 10) bumped `0.8.1` → `0.9.0` in one atomic commit, proven by `releaseContract.test.ts` (single-source agreement oracle, 11/11 green).
- Stale v0.8.1 release bundles archived (not deleted): `EFX Motion Editor.app` (7-août) and `EFX Motion Editor_0.8.1_aarch64.dmg` (4-août) moved to `bundle/archive-v0.8.1-20260821/`. Exactly-one-or-fatal artifact discovery now finds zero stale artifacts.
- All six REL-01 gates ran green in the exact D-03 order AFTER the contract-stable 0.9.0 bump (Pitfall 8 satisfied): vitest 138 files / 2675 tests exit 0, typecheck exit 0, build exit 0, cargo test 20 tests exit 0, `bash -n` exit 0, preflight `PREFLIGHT PASS` exit 0.
- Two spec-vs-implementation divergences recorded in 44-GATES.md (chunk budget 1100-spec vs 1120-actual; truncation label French-spec vs English-shipped), neither "fixed" per D-09.
- `44-COVERAGE.md` (API-coverage reasoned declaration) already committed from planning — verified present, no new API integration.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): v0.9.0 version bump across all five product surfaces (atomic) + single-source contract green** - `d66feaf8` (chore)
2. **Task 2: Archive stale v0.8.1 bundles + run the six REL-01 gates in exact D-03 order with per-gate evidence** - `e5fdd6ef` (chore)

**Plan metadata:** `pending final docs commit`

_Note: the `target/` archival itself is git-ignored; only the 44-GATES.md evidence record is committed in Task 2._

## Files Created/Modified

- `app/package.json` - `"version": "0.9.0"` (single source of truth)
- `app/src-tauri/tauri.conf.json` - `"version": "0.9.0"`
- `app/src-tauri/Cargo.toml` - `version = "0.9.0"`
- `app/src-tauri/Cargo.lock` - root `efx-motion-editor` package block to `version = "0.9.0"` (exactly one changed line; transitive deps untouched)
- `scripts/macos-release.sh` - `PRODUCT_VERSION="0.9.0"` (line 10, the only permitted edit to this frozen file this phase)
- `.planning/phases/44-integrated-uat-signed-release/44-GATES.md` - per-gate exit-status evidence record + archival count + divergences (new)

## Decisions Made

- **Gate on the amended 1120 kB chunk budget** (`viteBuild.test.ts:138`); the spec references 1100. Reverting to 1100 would fail the build for no benefit — recorded as divergence, not changed.
- **Truncation label stays English** in this phase; plan 02's signed-app UAT judges the shipped `Loop shortened by next clip` and records the French-spec mismatch as known divergence.
- **Stale bundles archived, not deleted** — keeps the v0.8.1 DMG locally (RESEARCH Open Question 3 resolution).
- **Vitest paths use `src/...`**, not `app/src/...` — the app workspace's vitest filters relative to `app/`, so the plan's `app/`-prefixed path resolves to no test files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Vitest filter path corrected for gate/verify invocations**
- **Found during:** Task 1 (version bump verification)
- **Issue:** The plan's `<verify>`/acceptance commands spell the test path `app/src/releaseContract.test.ts`. This vitest config (`app/vitest.config.*`) filters relative to the `app` workspace root (`include: src/**/*.test.ts`), so `app/src/releaseContract.test.ts` matches no files and exits with "No test files found, exiting with code 1".
- **Fix:** Use `src/releaseContract.test.ts` (workspace-relative) for every gate/verify invocation. Functional contract is identical — the release-contract test now passes 11/11.
- **Files modified:** none (invocation-only change)
- **Verification:** `pnpm --dir app exec vitest run src/releaseContract.test.ts` → `Test Files 1 passed / Tests 11 passed`; full `5-surface bump verified` chain green.
- **Committed in:** `d66feaf8` (part of Task 1 commit, which the verify proved)

**2. [Rule 3 - Blocking] 44-GATES.md evidence format made machine-checkable**
- **Found during:** Task 2 (gate evidence verification)
- **Issue:** The plan's automated verify runs `grep -c '^REL-01' 44-GATES.md`; the initial table format produced count 0.
- **Fix:** Reformatted the six gate rows as `REL-01-N:`-prefixed lines; `grep -c '^REL-01'` now returns 6.
- **Files modified:** `.planning/phases/44-integrated-uat-signed-release/44-GATES.md`
- **Verification:** `grep -c '^REL-01'` → `6`
- **Committed in:** `e5fdd6ef` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 blocking — command/path and evidence-format correctness). No Rule 1/2/4 deviations.
**Impact on plan:** Both fixes were verification-path/evidence-format corrections; no functional, security, or scope impact. All six gates genuinely passed on the bumped code.

## Issues Encountered

- None beyond the two documented auto-fixes. The `preflight` run took ~35s on re-run (private-asset worktree scan) — expected, not a failure; it returned `PREFLIGHT PASS` exit 0.

## User Setup Required

None - no external service configuration required. Apple credentials are not needed for any step of this plan (D-04 boundary; credentialed `release` is user-run in plan 03).

## Next Phase Readiness

- **Plan 02 (signed-app UAT):** the repo is at a contract-stable 0.9.0 state; the six gates are green; the truncation-label divergence is recorded for UAT judgment. Ready to execute once the user runs the credentialed release (plan 03 sequence) or as planned.
- **Plan 03 (release + publish):** stale artifacts are archived so `find_release_artifacts` will discover exactly the fresh v0.9.0 build; the five surfaces agree at 0.9.0.
- REL-01 is shared with plan 02, so `requirements.mark-complete` for REL-01 is deferred until plan 02's SUMMARY exists (shared-ID gate) — it will flip complete when the last declaring plan finishes.

---
*Phase: 44-integrated-uat-signed-release*
*Completed: 2026-08-21*

## Self-Check: PASSED

- FOUND: `.planning/phases/44-integrated-uat-signed-release/44-01-SUMMARY.md`
- FOUND: `.planning/phases/44-integrated-uat-signed-release/44-GATES.md`
- FOUND: `app/src/releaseContract.test.ts` (oracle, unchanged)
- FOUND: `scripts/macos-release.sh` (frozen except line 10)
- FOUND: commit `d66feaf8` (atomic 5-surface bump)
- FOUND: commit `e5fdd6ef` (gate evidence record)
