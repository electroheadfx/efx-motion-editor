---
phase: 01
slug: algorithm-port-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — manual verification only |
| **Config file** | none — Wave 0 does not apply |
| **Quick run command** | N/A |
| **Full suite command** | N/A |
| **Estimated runtime** | Manual only |

---

## Sampling Rate

- **After every task commit:** Manual browser-based side-by-side comparison
- **After every plan wave:** Full manual verification of all success criteria
- **Before `/gsd:verify-work`:** Manual verification checklist must be complete
- **Max feedback latency:** Immediate (human judgment)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | PHYS-01 | manual | N/A | N/A | ⬜ pending |
| 01-01-02 | 01 | 1 | PHYS-02 | manual | N/A | N/A | ⬜ pending |
| 01-01-03 | 01 | 1 | PHYS-03 | manual | N/A | N/A | ⬜ pending |
| 01-01-04 | 01 | 1 | CANVAS-01 | manual | N/A | N/A | ⬜ pending |
| 01-01-05 | 01 | 1 | CANVAS-02 | manual | N/A | N/A | ⬜ pending |
| 01-01-06 | 01 | 1 | LIB-02 | manual | N/A | N/A | ⬜ pending |
| 01-01-07 | 01 | 1 | DEMO-01 | manual | N/A | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] No test framework to install — Phase 1 uses manual verification
- [ ] Browser environment required for both original and new demo

*Manual verification only — no automated test infrastructure applicable for paint physics visual verification.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Wet paint spreading matches original | PHYS-01, PHYS-03 | Visual judgment of physics behavior | Run original in Tab A, new in Tab B, compare wet paint behavior |
| Paper texture influences flow field | PHYS-02 | Visual verification of texture interaction | Apply paint near paper texture edges, observe flow |
| Canvas stride = 902 | CANVAS-02 | Must verify against original | Inspect array indexing in new code |
| Dual-layer wet/dry arrays correct | PHYS-01 | Typed array precision matters | Inspect wetLayer Float32Array, dryLayer Uint8Array |
| All 8 brushes functional | DEMO-01 | Each brush produces distinct wet/dry behavior | Test each brush type against original output |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have manual verify (no automated tests applicable)
- [ ] Sampling continuity: manual verification after each task
- [ ] Wave 0 skipped (no test framework for paint physics)
- [ ] nyquist_compliant: true set when all manual verifications pass
- [ ] CANVAS_STRIDE discrepancy (902 vs 904) resolved and documented

**Approval:** {pending / approved YYYY-MM-DD}
