---
phase: "53"
slug: "integrated-v1-0-0-acceptance"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-10"
---

# Phase 53 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | app/vitest config (pnpm workspace) |
| **Quick run command** | `pnpm --filter efx-motion-editor exec vitest run <file.test.ts>` |
| **Full suite command** | `pnpm --filter efx-motion-editor exec vitest run` |
| **Estimated runtime** | ~90 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter efx-motion-editor exec vitest run <touched test file>`
- **After every plan wave:** Run `pnpm --filter efx-motion-editor exec vitest run` (+ `tsc --noEmit`)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 53-01-01 | 01 | 1 | ACC-01 | — | N/A | cli | `pnpm --filter efx-motion-editor exec vitest run && pnpm --filter efx-motion-editor exec tsc --noEmit` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Fix or route the RED vitest suite `PhysicsPaintStudioView.test.ts` (`_setPaintMarkDirtyCallback is not a function`, circular init — WINDOWS.md #90) — ACC-01 cannot close while the full suite is red (research recommends a pre-53 quick).

*If none after fix: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Native UAT — 17-step surface (document init, legacy rejection, track CRUD, Background loops, fallback, Reveal, save/reopen, main-editor parity) | ACC-02 | Native macOS app + WKWebView; vitest is blind to live surfaces | Worksheet rows against the packaged app; user executes and records verdicts |
| Signed/notarized downloaded-artifact verification | ACC-03 | Requires credentials, network, GitHub publish | Release wrapper `~/.config/efx/scripts/efx-release-efx-motion`; verify downloaded .dmg signature + notarization ticket before publication |
| Pending native UAT carry rows (kov Reveal WR-01/02/03, j5r) | ACC-02 | Live native surface | Fold into Phase 53 worksheet per D-04/D-12..D-16 carry pattern |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
