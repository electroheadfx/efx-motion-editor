---
phase: 17
slug: enhancements
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `Application/vitest.config.ts` |
| **Quick run command** | `cd Application && pnpm test --run` |
| **Full suite command** | `cd Application && pnpm test --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd Application && pnpm test --run`
- **After every plan wave:** Run `cd Application && pnpm test --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | ENH-01 | manual | visual | N/A | ⬜ pending |
| TBD | TBD | TBD | ENH-02 | manual | visual | N/A | ⬜ pending |
| TBD | TBD | TBD | ENH-03 | unit | `cd Application && pnpm test --run` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ENH-04 | unit | `cd Application && pnpm test --run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `Application/src/stores/__tests__/soloStore.test.ts` — stubs for solo toggle, preview/export gating
- [ ] `Application/src/lib/__tests__/renderGlobalFrame.solo.test.ts` — stubs for solo-mode rendering bypass

*Existing infrastructure covers collapse/expand (ENH-01/ENH-02 — visual) and Tailwind cleanup (ENH-04 — lint).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Key photo collapse/expand on second click | ENH-01, ENH-02 | CSS transition + click interaction | Click active sequence header twice, verify key photos collapse. Click different sequence, verify auto-expand. |
| Solo button in timeline toolbar | ENH-03 | Visual toolbar button | Click solo button, verify layers/FX disappear from preview. Verify export also strips layers/FX. |
| Gradient picker in ColorPickerModal | ENH-04 | Complex UI interaction | Open color picker, toggle gradient mode, add stops, verify canvas renders gradient. |
| Tailwind v4 syntax cleanup | ENH-04 | Build output inspection | Run build, verify no Tailwind v4 deprecation warnings. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
