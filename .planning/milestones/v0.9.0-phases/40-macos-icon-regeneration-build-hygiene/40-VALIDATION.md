---
phase: 40
slug: macos-icon-regeneration-build-hygiene
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-04
validated: 2026-08-21
---

# Phase 40 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (project-pinned; run via pnpm) |
| **Config file** | existing app vitest setup (no new config — "No test config hacks") |
| **Quick run command** | `pnpm --dir app exec vitest run src/releaseContract.test.ts` |
| **Full suite command** | `pnpm --dir app exec vitest run` (never watch mode) |
| **Estimated runtime** | ~90 seconds (full suite includes the ~60–90s programmatic build seam) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --dir app exec vitest run src/releaseContract.test.ts` (fast, pure fs/JSON)
- **After every plan wave:** Run `pnpm --dir app exec vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 40-01-T1 | 40-01 | 1 | ICON-01, ICON-02 | T-40-01 | Trusted 794×794 source only; official `tauri icon` CLI parser (no custom decoding) | manual/generation + contract test | `pnpm --dir app exec vitest run src/releaseContract.test.ts` + git-status guard (5 modified / 0 untracked) | ✅ | ✅ green |
| 40-01-T2 | 40-01 | 1 | ICON-03 | T-40-02, T-40-03 | No signing/notarization drift; unsigned-build icon check only; fail-closed on missing bundle | integration (shell check, unsigned build) | `bash .planning/phases/40-macos-icon-regeneration-build-hygiene/check-unsigned-app-icon.sh` against fresh `target/release/bundle/macos/EFX Motion Editor.app` | ✅ W0 (script created by this task) | ✅ green |
| 40-01-T3 | 40-01 | 1 | ICON-04 | — | N/A | manual-only (blocking human-verify checkpoint; user is visual oracle per D-06) | — (see Manual-Only Verifications) | — | ✅ green (manual-only, user UAT approved) |
| 40-02-T1 | 40-02 | 1 | BUILD-01 | T-40-04 | Resolved-limit assertion reads config via configResolved; no source-text false-pass; D-11 comment wording is a verification target | unit (build seam, red-then-green) | `pnpm --dir app exec vitest run src/viteBuild.test.ts` | ✅ (assertions added by task) | ✅ green |
| 40-02-T2 | 40-02 | 1 | BUILD-03 | T-40-05, T-40-06 | Unfiltered warning capture; prefix-based separation pins only; no content hashes or exact counts | unit (build seam) | `pnpm --dir app exec vitest run src/viteBuild.test.ts` | ✅ (extended by task) | ✅ green |
| 40-03-T1 | 40-03 | 2 | BUILD-02 | T-40-07 | Zero source edits before approval gate (`git status` clean on app/ + packages/) | evidence capture + classification | `test -s baseline-build-warnings.txt && test -s 40-TRIAGE.md && git status clean` | ✅ (created by task) | ✅ green |
| 40-03-T2 | 40-03 | 2 | BUILD-02 | T-40-07 | User approval precedes every import edit (D-08); preserve is the default (D-09) | blocking decision checkpoint | — (user gate) | — | ✅ green (approve-all recorded in 40-TRIAGE.md) |
| 40-03-T3 | 40-03 | 2 | BUILD-02, BUILD-03 | T-40-08, T-40-09 | No global warning suppression; module-path-absence assertions pin corrected imports; DI cases documented, never implemented | triage application + build seam non-return + full suite | `pnpm --dir app exec vitest run` + post-triage build delta vs baseline | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] D-05 phase check script (extract-and-run the packaged-icon block from `scripts/macos-release.sh`) — covers ICON-03 against the unsigned build. **Planned as 40-01 Task 2** (creates `check-unsigned-app-icon.sh` in the phase directory and proves it against the fresh unsigned build); `wave_0_complete` flips when that task lands.

*Both test seams (`app/src/releaseContract.test.ts`, `app/src/viteBuild.test.ts`) already exist with the needed capture patterns; no framework install, no fixtures.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Icon legibility 16→512 across Finder/Dock/Cmd-Tab/DMG; user recognizes EFX Motion Editor | ICON-04 | Visual judgment; user is the visual oracle (D-06) | User UAT after unsigned build + D-05 check: inspect icon in Finder (list/icon view), Dock, Applications, application switcher, and mounted DMG at sizes 16×16 through 512×512; confirm genuine alpha corners, no placeholder, no unreadable prior icon |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-08-21

## Validation Audit 2026-08-21

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All requirements (ICON-01/02/03, BUILD-01/02/03) verified green on 2026-08-21: `releaseContract.test.ts` 11/11, `viteBuild.test.ts` 11/11, D-05 `check-unsigned-app-icon.sh` PASS + fail-closed exit 1, BUILD-02 evidence gate (baseline + triage present, app/packages clean). ICON-04 remains manual-only per D-06 (user is the visual oracle; UAT approved at Task 3 checkpoint).
