---
phase: 44
slug: integrated-uat-signed-release
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-21
---

# Phase 44 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (app) + cargo tests (Tauri) |
| **Config file** | `app/vitest.config.ts`, `app/src-tauri/Cargo.toml` |
| **Quick run command** | `pnpm --dir app exec vitest run` |
| **Full suite command** | `pnpm --dir app exec vitest run && pnpm --dir app run typecheck && pnpm build && cargo test --manifest-path app/src-tauri/Cargo.toml` |
| **Estimated runtime** | ~180 seconds (vitest 138 files / 2675 tests + build + cargo 20 tests) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --dir app exec vitest run`
- **After every plan wave:** Run the full suite command (REL-01 six-gate chain)
- **Before `/gsd-verify-work`:** Full suite + release preflight must be green
- **Max feedback latency:** ~300 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 44-01-01 | 01 | 1 | REL-01 | — / — | version single-source consistency | unit | `pnpm --dir app exec vitest run releaseContract` | ✅ | ✅ green |
| 44-01-02 | 01 | 1 | REL-01 | — / — | all six gates green before release | auto | full suite command + `bash -n scripts/macos-release.sh` + `bash scripts/macos-release.sh preflight` | ✅ | ✅ green |
| 44-02-01 | 02 | 2 | REL-02 | — / — | signed packaged-app UAT full spec pass incl. Phase 43 handoff | manual | user-run native UAT | ✅ | ✅ manual-only |
| 44-03-01 | 03 | 3 | REL-03 | — / — | verify-downloaded + stop-condition checklist before publish | auto+manual | `bash scripts/macos-release.sh verify-downloaded <dmg>` + user publish | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **None** — Existing infrastructure covers all phase requirements: `app/src/releaseContract.test.ts`, `app/src/viteBuild.test.ts`, and the six release gates already ship green at HEAD.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Native packaged-app UAT full spec pass | REL-02 | Packaged-app UAT is the user's oracle; needs the built/signed app and visual confirmation | Walk the spec step list (icon → hydration → audio → toggle → progressive apply → 5-frame cycle → infinity → truncation → next-clip move/remove → color override → save/reopen/export) plus Phase 43 signed boundary (linked-loop preview/export parity + unresolved-loop export block) in the packaged app |
| Credentialed signed release run | REL-01/03 | Credentials are user-owned; never enter agent context | User runs `efx-release-efx-motion` wrapper (sources Apple env file, runs `bash scripts/macos-release.sh release`, trap-unsets vars) and reports output |
| Downloaded-artifact verify + visible launch | REL-03 | Icon caches lie; verify on the downloaded artifact not dev machine | `bash scripts/macos-release.sh verify-downloaded <downloaded.dmg>`, install into Applications, launch visibly |
| GitHub publish Latest | REL-03 | Public, irreversible | `gh release draft → upload DMG → publish as Latest` after stop-condition checklist green |

*Note: not all behaviors have automated verification — the release pipeline is user-run by design (D-04).*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (release gates)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 300s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-08-21

---

## Validation Audit 2026-08-21

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All automated requirements are covered by existing green tests (`app/src/releaseContract.test.ts` 11/11, full six-gate suite 138 files / 2675 tests at release). REL-02 native UAT and GitHub publish are manual-only by design (user-owned credentials D-04; packaged app is the user's oracle). No gaps to fill.
