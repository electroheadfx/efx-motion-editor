---
phase: 45
slug: new-efx-paint-document-and-clean-cutover
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-23
---

# Phase 45 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | existing project vitest config (no new config — per project constraint) |
| **Quick run command** | `pnpm vitest run <changed-test-file>` |
| **Full suite command** | `pnpm vitest run` |
| **Estimated runtime** | ~60–120 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run <changed-test-file>`
- **After every plan wave:** Run `pnpm vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | DOC-01..06 | T-45-XX / — | N/A | unit | `pnpm vitest run` | TBD | ⬜ pending |

*Filled by planner/executor as tasks are defined. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Existing vitest infrastructure covers all phase requirements (per project constraint: `vitest run`, never watch mode; no one-off test configs)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Main-editor sequence timing and outer layer composition unchanged | DOC-06 (success criterion 5) | Visual/interaction UAT — user performs native UAT | Open a v1.0 project with EFX Paint layers; scrub/play sequence; verify composition identical to pre-change behavior |
| Pre-v1.0 project rejection UX | DOC-02 | User-facing error surface | Open a pre-v1.0 Paint project; confirm explicit unsupported error, no partial mutation, no fallback rendering |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
