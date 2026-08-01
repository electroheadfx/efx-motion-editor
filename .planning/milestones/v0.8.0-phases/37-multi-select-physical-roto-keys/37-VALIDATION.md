---
phase: 37
slug: multi-select-physical-roto-keys
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-26
---

# Phase 37 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> **D-18 inversion:** native user-owned UAT is BLOCKING before any test creation, modification, deletion, renaming, or execution. No Wave-0 test scaffolding is permitted pre-UAT.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.1.9 |
| **Config file** | `app/vitest.config.ts` (include `src/**/*.test.ts`) |
| **Quick run command** | `pnpm --dir app vitest run src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts` |
| **Full suite command** | `pnpm --dir app vitest run` |
| **Estimated runtime** | ~30–60 seconds |

---

## Sampling Rate

- **After every task commit (production plans, pre-UAT):** bounded static checks only (D-18 forbids test execution/creation before UAT; 36.14 recovery precedent). Pre-existing debt noted in STATE.md 2026-07-24 (typecheck 37 errors, 85 failing tests on retired contracts) — confirm current tree state before Phase 37 starts, or gate only on Phase-37-touched files pre-UAT.
- **After every plan wave (post-UAT):** `pnpm --dir app vitest run`
- **Before `/gsd-verify-work`:** Full suite green + typecheck + build, only after explicit native UAT approval
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD-SELECT | TBD | TBD | 37-MULTI-SELECT-IDENTITY | — | keyId-only selection survives retiming | unit (post-UAT) | `pnpm --dir app vitest run <selection-controller test>` | ❌ post-UAT | ⬜ pending |
| TBD-SELECT-ALL | TBD | TBD | 37-SELECT-ALL | — | select all real keyIds; guarded empty state | unit (post-UAT) | same | ❌ post-UAT | ⬜ pending |
| TBD-DRAG | TBD | TBD | 37-GROUP-DRAG | — | GD-1/GD-2/GD-3 locked mappings | unit (post-UAT) | `pnpm --dir app vitest run src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts` | ❌ post-UAT | ⬜ pending |
| TBD-DELETE | TBD | TBD | 37-GROUP-DELETE | — | GDel-1/GDel-2 locked mappings + survivor | unit (post-UAT) | same | ❌ post-UAT | ⬜ pending |
| TBD-SPACING | TBD | TBD | 37-GROUP-FORCE-SPACING | — | GFS-1/GFS-2/GFS-3 locked mappings | unit (post-UAT) | same | ❌ post-UAT | ⬜ pending |
| TBD-ATOMIC | TBD | TBD | 37-ATOMIC-TRANSACTIONS | — | one history entry; rollback parity | unit (post-UAT) | history/coordinator tests | ❌ post-UAT | ⬜ pending |
| TBD-PARITY | TBD | TBD | 37-DOWNSTREAM-PARITY | — | accepted-map-only downstream | native UAT (user) | manual | manual-only | ⬜ pending |
| TBD-UI | TBD | TBD | 37-UI-INTEGRATION | — | selected/blocked visuals, tooltips, row fit | native UAT (user) — 3 backstops in 37-UI-SPEC | manual | manual-only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs / plan assignment filled by the planner at plan time.*

---

## Wave 0 Requirements

D-18 forbids creating test files before native UAT approval, so no Wave-0 test scaffolding is permitted in this phase. Framework and config already exist.

*Existing infrastructure covers all phase requirements (pre-UAT).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Downstream parity: save/reopen, live pixels, caches, dirty state, playback, onion/reference, preview, export, missing/background rendering, timeline extent derive from accepted map only | 37-DOWNSTREAM-PARITY | Visual/stateful native behavior across the whole editor surface | Native UAT checklist per 37-CONTEXT.md / 37-UI-SPEC |
| Timeline UI integration: selected/blocked key visuals, tooltips, Select All discoverability, 155px row fit, status capsule messages | 37-UI-INTEGRATION | Visual UAT owned by user; 3 backstops defined in 37-UI-SPEC | Native UAT per 37-UI-SPEC backstop checklist |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or post-UAT test dependencies recorded
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (post-UAT test plans)
- [ ] Post-UAT test gaps recorded: NEW resolver test file (group intents + GD/GDel/GFS mappings only — 36.14's deferred single-key resolver coverage is a separate authorized follow-up, NOT Phase 37 scope), selection-controller tests, group presentation tests
- [ ] No watch-mode flags (`vitest run` only)
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
