---
phase: 48
slug: internal-compositor-and-flattened-parent-result
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-28
completed: 2026-08-30
---

# Phase 48 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (node env, mocked canvas — recording-context idiom per RESEARCH.md) |
| **Config file** | `app/vitest.config.ts` |
| **Quick run command** | `pnpm --dir app vitest run` |
| **Full suite command** | `pnpm --dir app vitest run && pnpm --dir app typecheck` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --dir app vitest run`
- **After every plan wave:** Run `pnpm --dir app vitest run && pnpm --dir app typecheck`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 48-TBD  | TBD  | TBD  | CMP-01..06  | —          | N/A             | unit      | `pnpm --dir app vitest run` | ✅ | ⬜ pending |

*Populated by /gsd-validate-phase or execute-phase once PLAN.md task IDs exist. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* Vitest + recording-context canvas mocks already exist (per RESEARCH.md — pixel truth cannot run in vitest; unit gates assert op order/alpha/cache keys).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pixel acceptance matrix (opaque/semi-transparent/multiply/screen/overlay/add, hidden/soloed, empty upper frame, Background loops, gaps, parent opacity/blend) | CMP-01, CMP-02, CMP-03, CMP-05 | Pixel truth cannot run in vitest — node env has mocked canvas; true pixel verification is native UAT per matrix row (RESEARCH.md) | Native UAT: build each matrix row scenario in Studio, compare Studio preview vs main preview vs export output per row |
| Missing-source Studio surface (placeholder chrome vs transparent+capsule; export preflight block retention) | CMP-06 | User-visible behavior conflict (D-28 vs D-09) flagged as checkpoint:human-verify candidate in RESEARCH.md | Native UAT: detach a source, observe Studio surface and export preflight behavior |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
