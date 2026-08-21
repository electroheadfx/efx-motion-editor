---
phase: 40-macos-icon-regeneration-build-hygiene
verified: 2026-08-04T18:30:00Z
status: passed
score: 15/15 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 40: macOS Icon Regeneration + Build Hygiene Verification Report

**Phase Goal:** The release presents a legible, recognizable macOS identity and an explicit, test-pinned desktop build policy.
**Verified:** 2026-08-04T18:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 5 tracked icons regenerated from SPECS/efxmotioneditor-icon-2.png via `pnpm tauri icon` (794×794 direct, no upscale) | ✓ VERIFIED | Commit `6cee9d0e` touches exactly the 5 tracked binaries (size deltas, 0 insertions/deletions of text); icon files dated Aug 4 15:21 |
| 2 | Exactly 5 modified / 0 untracked icon files — no Square logos, StoreLogo, 64x64.png, icon.png, ios/, android/ in tracked tree | ✓ VERIFIED | `git show --stat 6cee9d0e` = exactly 5 files; `ls app/src-tauri/icons/` = exactly 5 entries; no extras committed |
| 3 | releaseContract.test.ts green: exact EXPECTED_ICONS array, non-empty files, `icns` magic bytes | ✓ VERIFIED | Ran `vitest run src/releaseContract.test.ts` — pass (8/8 in file); `head -c 4 icon.icns` = `icns` |
| 4 | D-05 check script proven against FRESH unsigned bundle (CFBundleIconFile declared, resource non-empty, icns magic); release script byte-identical | ✓ VERIFIED | Probe run: positive exit 0 with PASS line naming icon.icns; negative `/nonexistent/EFX.app` exit 1; bundle Info.plist mtime Aug 4 15:43:56 2026 (fresh, not the 2026-08-01 stale bundle); `git diff e2914295..HEAD -- scripts/macos-release.sh` empty |
| 5 | No project-side resampling/image math; zero new dependencies (D-02 backstop) | ✓ VERIFIED | `git diff --stat '**/package.json' pnpm-lock.yaml` empty; phase diff contains no image-processing code; only @tauri-apps/cli pipeline used |
| 6 | Icon legible in Finder, Dock, Cmd-Tab, DMG (ICON-04) | ✓ VERIFIED (human gate) | User APPROVED at plan 40-01 Task 3 checkpoint on 2026-08-04 (checkpoint:human-verify gate="blocking" completed; recorded in 40-01-SUMMARY.md) |
| 7 | `chunkSizeWarningLimit: 1100` in build block with four-point D-11 rationale comment directly above (BUILD-01) | ✓ VERIFIED | `git diff app/vite.config.ts` = exactly 6 added lines in the build block; comment contains `packaged Tauri desktop app`, `500 kB default`, `monitored`, `not a performance claim`, `must not be raised again without measurement` |
| 8 | Resolved-limit assertion reads config via configResolved and asserts exactly 1100 (D-14) | ✓ VERIFIED | `captured.chunkLimit = config.build.chunkSizeWarningLimit` (line 83); `toBe(1100)` (line 131); red-at-500 evidence recorded in 40-02-SUMMARY.md; test passes |
| 9 | All build warnings captured via createLogger() customLogger wrap, unfiltered, replacing logLevel:'silent' (D-12) | ✓ VERIFIED | `warnings: string[]` module-scope (line 55); wrap pushes `String(msg)` unfiltered (line 59); `customLogger: logger` in build call (line 98); no `logLevel: 'silent'` remains |
| 10 | Two intentional chunk separations prefix-pinned — `src/project-*.js` retained + `PhysicsPaintStudio-*.js` added; no hashes/counts (D-15) | ✓ VERIFIED | Prefix regex at line 169; build seam run emits separate `PhysicsPaintStudio-Ca16rXOC.js` (388 kB) and `src/project-wE3JOdA4.js`; no content-hash pins or exact counts in test source |
| 11 | No chunk-size warning emitted at the 1100 budget | ✓ VERIFIED | Seam run: entry chunk 1,071.23 kB (under 1100); chunk-size-absence assertion green; baseline grep `Some chunks are larger` = 0 |
| 12 | Executor-recaptured baseline + all 12 warnings classified with per-case evidence; user approved BEFORE any edit (D-07/D-08) | ✓ VERIFIED | `baseline-build-warnings.txt` non-empty with 12 `is dynamically imported by` lines; 40-TRIAGE.md has 12 classification rows each with evidence/reason; approval record (approve-all, 2026-08-04) precedes correction commit `c97c5780` |
| 13 | Only approved corrections applied; guards/lazy chunks/cycle-breakers untouched; no global suppression (BUILD-02/D-09) | ✓ VERIFIED | Phase source diff = exactly uiStore.ts (+2/−1), main.tsx (+4/−2), paintStore.ts (+6/−3); static imports at uiStore.ts:3, main.tsx:7-8, paintStore.ts:7; store-to-store dynamics still dynamic (paintStore.ts:478-479, 545-546); Tauri guard dynamics untouched; no filter/log-override added |
| 14 | CORRECTED_MIXED_IMPORT_PATHS + D-13 non-return assertion green; DI case documented for backlog (BUILD-03/D-10/D-13) | ✓ VERIFIED | 4-path constant + subject-position assertion (`is dynamically imported by`) at lines 69-74, 201-202; D-13 test passes against real captured warnings (incl. preserved warning #4); #11 projectStore↔physicPaintBridge DI documented in 40-03-SUMMARY.md |
| 15 | Full suite green post-triage; post-triage build delta recorded (corrected gone, preserved present) | ✓ VERIFIED | Verifier re-ran both seam files: 19/19 pass (releaseContract 8 + viteBuild 11); post-merge full-suite 1018 passed recorded; delta 12→8 warnings with all 8 preserved subjects present recorded in 40-03-SUMMARY.md and TRIAGE approval record |

**Score:** 15/15 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/src-tauri/icons/32x32.png` | Regenerated | ✓ VERIFIED | 2560 bytes, Aug 4 15:21, in commit 6cee9d0e |
| `app/src-tauri/icons/128x128.png` | Regenerated | ✓ VERIFIED | 22100 bytes |
| `app/src-tauri/icons/128x128@2x.png` | Regenerated | ✓ VERIFIED | 77560 bytes |
| `app/src-tauri/icons/icon.icns` | Regenerated | ✓ VERIFIED | 2328084 bytes, `icns` magic bytes confirmed |
| `app/src-tauri/icons/icon.ico` | Regenerated | ✓ VERIFIED | 95742 bytes |
| `check-unsigned-app-icon.sh` | New, executable | ✓ VERIFIED | `-rwxr-xr-x`, extract-and-eval sed range, local die(), no source/codesign/spctl/stapler |
| `app/vite.config.ts` | chunkSizeWarningLimit: 1100 + D-11 comment | ✓ VERIFIED | 6 added lines in build block only |
| `app/src/viteBuild.test.ts` | chunkLimit capture, warnings customLogger, separation pins, D-13 | ✓ VERIFIED | All constructs present; 11/11 tests pass |
| `baseline-build-warnings.txt` | Raw build output | ✓ VERIFIED | Non-empty, 12 mixed-import warnings, 0 chunk-size warnings |
| `40-TRIAGE.md` | 12-row classification + approval record | ✓ VERIFIED | All rows classified; approve-all + applied-commit record present |
| `app/src/stores/uiStore.ts`, `app/src/main.tsx`, `app/src/stores/paintStore.ts` | Approved static conversions only | ✓ VERIFIED | Import-form-only changes; call order preserved (`await initTheme()` after `initTempProjectDir()`, main.tsx:26-27) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| Icon generation | 5-file tracked tree | staging dir + selective copy | ✓ WIRED | Commit 6cee9d0e contains exactly the 5 declared files; exact-array contract green |
| check-unsigned-app-icon.sh | scripts/macos-release.sh | sed range extract-and-eval at runtime | ✓ WIRED | Script extracts `/CFBundleIconFile raw/,/icns magic bytes/p` and evals; never sources; probe PASS + fail-closed negative |
| UAT bundle | fresh build output | mtime guard | ✓ WIRED | Info.plist mtime Aug 4 15:43:56 2026 matches SUMMARY record; not the 2026-08-01 stale bundle |
| configResolved capture plugin | resolved chunkSizeWarningLimit | `captured.chunkLimit` | ✓ WIRED | Assertion targets resolved value; red-at-500 proved it reads config not source text |
| customLogger wrap | `warnings` capture array | unfiltered `String(msg)` push | ✓ WIRED | D-13 and chunk-size assertions consume the array; both green on real build output |
| D-08 approval checkpoint | source edits | approval-before-edit ordering | ✓ WIRED | Approval record (approve-all) predates correction commit c97c5780; TRIAGE documents zero-edit state at Task 1 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| D-05 check passes on fresh bundle | `bash check-unsigned-app-icon.sh` | exit 0, PASS line naming icon.icns | ✓ PASS |
| D-05 check fails closed on missing bundle | `bash check-unsigned-app-icon.sh /nonexistent/EFX.app` | exit 1, `ERROR: App bundle is missing Contents/Info.plist` | ✓ PASS |
| Release contract test | `vitest run src/releaseContract.test.ts` | 8/8 pass | ✓ PASS |
| Build seam (1100 limit, separations, D-13, no chunk-size warning) | `vitest run src/viteBuild.test.ts` | 11/11 pass; entry 1,071.23 kB; PhysicsPaintStudio chunk separate | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| `.planning/phases/40-macos-icon-regeneration-build-hygiene/check-unsigned-app-icon.sh` | `bash check-unsigned-app-icon.sh` | exit 0 | PASS |
| Same script, negative case | `bash check-unsigned-app-icon.sh /nonexistent/EFX.app` | exit 1 (fail-closed) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ICON-01 | 40-01 | Icon replaced from SPECS 794×794 source, no manual upscale | ✓ SATISFIED | Commit 6cee9d0e; contract test green |
| ICON-02 | 40-01 | Tracked 5-file set remains release authority | ✓ SATISFIED | Exact-array assertion green; no extras |
| ICON-03 | 40-01 | Release-contract + packaged .app icon validation without touching signing | ✓ SATISFIED | D-05 probe pass; macos-release.sh byte-identical |
| ICON-04 | 40-01 | Legibility UAT in Finder/Dock/Cmd-Tab/DMG | ✓ SATISFIED | User approved at Task 3 checkpoint 2026-08-04 |
| BUILD-01 | 40-02 | chunkSizeWarningLimit 1100 + documented desktop rationale | ✓ SATISFIED | Config diff + resolved-limit test |
| BUILD-02 | 40-03 | Only provably ineffective mixed imports corrected; guards/lazy/cycle-breakers preserved; DI reported | ✓ SATISFIED | TRIAGE + scoped diff + preserves verified dynamic |
| BUILD-03 | 40-02 + 40-03 | Build seam verifies limit, HTML entry, assets, chunk separation, non-return — no hashes/counts | ✓ SATISFIED | 11/11 seam tests green |

No orphaned requirements — REQUIREMENTS.md maps exactly these 7 IDs to Phase 40, and all are claimed by plans.

### Prohibitions

| Prohibition | Status | Evidence |
|-------------|--------|----------|
| scripts/macos-release.sh byte-identical (D-06) | ✓ HELD | `git diff e2914295..HEAD -- scripts/macos-release.sh` empty; grep-pinned contract tests green |
| SPECS artwork never modified (D-01) | ✓ HELD | SPECS/ is gitignored read-only input; no phase commit touches it |
| Zero new dependencies (D-02) | ✓ HELD | package.json/pnpm-lock.yaml diffs empty |
| No global warning suppression (BUILD-02/D-09) | ✓ HELD | No filter/log-override constructs added; 8 preserved warnings still emitted (visible in verifier's seam run output) |

### Anti-Patterns Found

None. Debt-marker scan (TBD/FIXME/XXX) over all phase-modified files: clean. No placeholder/empty-implementation patterns. Code review (40-REVIEW.md): 0 critical, 1 warning (WR-01 dropped persistence promises — risk parity with pre-conversion form, advisory), 3 info. Advisory only; no blocker.

### Deviations Reviewed

1. **40-01:** `tauri build` required explicit `--bundles app,dmg --ci` in non-TTY shell — same unsigned build intent, no scope change. Acceptable.
2. **40-03:** D-13 assertion shape changed from path-anywhere to subject-position matching (`<path> is dynamically imported by`). Verified sound: baseline confirms `unsavedGuard.ts` appears inside preserved warning #4 as a static importer, so the planned shape would false-fail. Subject-position matching preserves the non-return contract and is validated by the passing test against real captured warnings. Acceptable and necessary.

### Human Verification Required

None outstanding. ICON-04 visual UAT was completed and approved by the user at the plan 40-01 Task 3 blocking checkpoint (2026-08-04).

### Gaps Summary

None. All 7 requirement IDs satisfied, all must-haves verified against the codebase, all probes and seam tests re-run green by this verifier.

---

_Verified: 2026-08-04T18:30:00Z_
_Verifier: Claude (gsd-verifier)_
