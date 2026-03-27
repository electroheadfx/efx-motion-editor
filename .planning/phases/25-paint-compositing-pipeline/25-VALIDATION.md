---
phase: 25
slug: paint-compositing-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (existing project test setup) |
| **Config file** | `Application/vitest.config.ts` or `package.json` vitest section |
| **Quick run command** | `cd Application && npx vitest run --filter lumaKey` |
| **Full suite command** | `cd Application && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd Application && npx vitest run --filter lumaKey`
- **After every plan wave:** Run `cd Application && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 25-01-01 | 01 | 1 | COMP-01 | unit | `npx vitest run --filter lumaKey` | W0 | pending |
| 25-02-01 | 02 | 1 | COMP-01 | unit | `npx vitest run --filter paintStore` | existing | pending |
| 25-03-01 | 03 | 1 | COMP-01 | integration | `npx vitest run --filter previewRenderer` | existing | pending |

*Status: pending · green · red · flaky*

---

## Wave 0 Requirements

- [ ] `Application/src/lib/lumaKey.test.ts` — stubs for luma extraction, luma invert, edge cases
- [ ] `Application/src/lib/lumaKey.ts` — algorithm implementation (new file)
- [ ] Framework install: Vitest already present in project (existing test infrastructure)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Non-destructive: strokes editable after exit paint mode | COMP-01 | Requires full UI interaction to verify edit + re-entry | Paint strokes → exit paint mode → re-enter paint mode → verify strokes are editable |
| Live luma preview during paint | COMP-01 | Visual verification of real-time compositing | Toggle luma key while painting and observe live preview |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
