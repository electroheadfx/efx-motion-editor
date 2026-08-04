---
phase: 40
slug: macos-icon-regeneration-build-hygiene
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-04
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
| 40-TBD-ICON01 | TBD | TBD | ICON-01 | T-40-01 | Trusted 794×794 source only; official `tauri icon` CLI parser (no custom decoding) | manual/generation + contract test | `pnpm --dir app exec vitest run src/releaseContract.test.ts` | ✅ | ⬜ pending |
| 40-TBD-ICON02 | TBD | TBD | ICON-02 | — | N/A | unit (contract) | `pnpm --dir app exec vitest run src/releaseContract.test.ts` | ✅ (coverage exists verbatim) | ⬜ pending |
| 40-TBD-ICON03 | TBD | TBD | ICON-03 | T-40-03 | No signing/notarization drift; unsigned-build icon check only | integration (shell check, unsigned build) | D-05 phase check script against `target/release/bundle/macos/EFX Motion Editor.app` | ❌ W0 | ⬜ pending |
| 40-TBD-BUILD01 | TBD | TBD | BUILD-01 | — | N/A | unit (build seam) | `pnpm --dir app exec vitest run src/viteBuild.test.ts` | ✅ (new assertions added) | ⬜ pending |
| 40-TBD-BUILD02 | TBD | TBD | BUILD-02 | T-40-02 | No global warning suppression; module-path-absence assertions pin corrected imports | triage checkpoint + build seam | `pnpm --dir app exec vitest run src/viteBuild.test.ts` | ✅ | ⬜ pending |
| 40-TBD-BUILD03 | TBD | TBD | BUILD-03 | T-40-02 | Same as BUILD-02 | integration (real programmatic build, ~60–90s) | `pnpm --dir app exec vitest run src/viteBuild.test.ts` | ✅ (extended) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] D-05 phase check script (extract-and-run the packaged-icon block from `scripts/macos-release.sh`) — covers ICON-03 against the unsigned build

*Both test seams (`app/src/releaseContract.test.ts`, `app/src/viteBuild.test.ts`) already exist with the needed capture patterns; no framework install, no fixtures.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Icon legibility 16→512 across Finder/Dock/Cmd-Tab/DMG; user recognizes EFX Motion Editor | ICON-04 | Visual judgment; user is the visual oracle (D-06) | User UAT after unsigned build + D-05 check: inspect icon in Finder (list/icon view), Dock, Applications, application switcher, and mounted DMG at sizes 16×16 through 512×512; confirm genuine alpha corners, no placeholder, no unreadable prior icon |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
