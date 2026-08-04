---
phase: 41
slug: efx-paint-audio-preview-monitoring-toggle
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-04
---

# Phase 41 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.1.9 |
| **Config file** | `app/vitest.config.ts` |
| **Quick run command** | `pnpm --dir app exec vitest run <file>` |
| **Full suite command** | `pnpm --dir app exec vitest run` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --dir app exec vitest run <file>`
- **After every plan wave:** Run `pnpm --dir app exec vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 41-01-01 | 01 | 0 | AUDIO-01..06 | — | Truth table locked before implementation | unit | `pnpm --dir app exec vitest run <truth-table-test>` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Frame→audio truth-table document + test suite (locked entry artifact per roadmap)
- [ ] Audio preview context schema/guard tests (revisioned payload)
- [ ] Drift-correction tests
- [ ] First-player-wins ownership guard tests
- [ ] Monitoring toggle tests
- [ ] `releaseContract.test.ts` extension for any `connect-src` grant (CSP proof, packaged-app discipline per D-04)

*Existing vitest infrastructure covers the runner; Wave 0 creates the phase-specific test files above.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Audible frame-synced monitoring in EFX Paint (no drift, no doubled audio) | AUDIO-01..05 | Requires live native UAT (real audio output, two windows) | Native UAT per project convention — user verifies live |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
