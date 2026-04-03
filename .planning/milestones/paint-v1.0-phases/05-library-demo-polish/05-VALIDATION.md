---
phase: 5
slug: library-demo-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.2 |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `pnpm run build && pnpm exec tsc --noEmit` |
| **Full suite command** | `pnpm exec vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm run build && pnpm exec tsc --noEmit`
- **After every plan wave:** Run `pnpm exec vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | LIB-01 | unit | `pnpm exec vitest run src/__tests__/exports.test.ts -t "exports"` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | LIB-02 | smoke | `pnpm run build && pnpm exec tsc --noEmit` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 1 | LIB-03 | unit | `pnpm exec vitest run src/__tests__/preact-wrapper.test.tsx` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 2 | DEMO-02 | manual | `pnpm run dev` (browser verification) | manual-only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — vitest configuration with preact/jsdom support
- [ ] `src/__tests__/exports.test.ts` — stubs for LIB-01 (package exports resolve)
- [ ] `src/__tests__/preact-wrapper.test.tsx` — stubs for LIB-03 (wrapper renders)
- [ ] Framework install: `pnpm add -D vitest @vitest/browser jsdom`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Demo app starts and renders canvas | DEMO-02 | Requires browser with canvas support | 1. Run `pnpm run dev` 2. Open localhost:5173 3. Verify canvas renders with toolbar 4. Switch tools, adjust sliders |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
