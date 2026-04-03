---
phase: 22
slug: foundation-quick-wins
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 1 | UXP-01 | manual | Visual inspection | N/A | ⬜ pending |
| 22-01-02 | 01 | 1 | UXP-01 | manual | Visual inspection | N/A | ⬜ pending |
| 22-02-01 | 02 | 1 | UXP-02 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 22-03-01 | 03 | 1 | UXP-03 | manual | Visual inspection | N/A | ⬜ pending |
| 22-04-01 | 04 | 1 | UXP-01 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for paintStore moveElements* bug fixes (undo/redo, visual update)
- [ ] Test stubs for sequence-isolated layer creation

*Existing vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Paint properties panel layout | UXP-01 | CSS/layout visual verification | Open paint panel, verify 2-column grid, reduced vertical space |
| Motion path dot density | UXP-03 | SVG visual verification | Select sequence with <30 keyframes, verify increased interpolation dots |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
