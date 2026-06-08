---
phase: 35
slug: interactive-physics-paint-controls
status: consistent
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-08
updated: 2026-06-08
---

# Phase 35 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + TypeScript typecheck + package demo build checks |
| **Config file** | `app/vitest.config.ts`, `app/tsconfig.json`, package scripts for `@efxlab/efx-physic-paint` |
| **Quick run command** | `pnpm --dir app test --run` |
| **Full suite command** | `pnpm --dir app typecheck && pnpm --dir app test --run && pnpm --filter @efxlab/efx-physic-paint check && pnpm --filter @efxlab/efx-physic-paint demo:build` |
| **Estimated runtime** | ~30 seconds for app checks; package demo build may add additional time |

---

## Sampling Rate

- **After every task commit:** Run the task-specific `<automated>` command from the active plan.
- **After every plan wave:** Run all automated commands for plans completed in that wave, then the full suite command before moving to dependent waves.
- **Before `/gsd-verify-work`:** Full suite must be green, and Plan 35-05 human UAT checkpoint must be approved or captured as a follow-up gap.
- **Max feedback latency:** 30 seconds for app unit/typecheck loops; package demo build is acceptable as a wave/end-of-phase gate.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 35-01-T1 | 35-01 | 1 | PAINT-04, DIAG-01 | T-35-01, T-35-02, T-35-03 | Layer/payload contracts reject editable engine state and preserve existing paint types | typecheck | `pnpm --dir app typecheck` | Plan-defined files | pending |
| 35-01-T2 | 35-01 | 1 | PAINT-04, DIAG-01 | T-35-01, T-35-02 | Rendered-output store writes bounded frames and bumps `physicPaintVersion` | unit/typecheck | `pnpm --dir app test --run app/src/stores/physicPaintStore.test.ts && pnpm --dir app typecheck` | `app/src/stores/physicPaintStore.test.ts` | pending |
| 35-02-T1 | 35-02 | 2 | PAINT-04, DIAG-01 | T-35-04, T-35-05 | Open bridge rejects non-physics layers and uses safe browser/Tauri launch paths | typecheck | `pnpm --dir app typecheck` | Plan-defined files | pending |
| 35-02-T2 | 35-02 | 2 | PAINT-04, DIAG-01 | T-35-06 | Physic Paint layer creation is additive and does not alter Paint / Rotopaint | typecheck | `pnpm --dir app typecheck` | Plan-defined files | pending |
| 35-03-T1 | 35-03 | 2 | PAINT-01, PAINT-02, PAINT-03, DIAG-01 | T-35-07 | Standalone diagnostics validate launch context/readiness before apply | package check/build | `pnpm --filter @efxlab/efx-physic-paint check && pnpm --filter @efxlab/efx-physic-paint demo:build` | Plan-defined files | pending |
| 35-03-T2 | 35-03 | 2 | PAINT-01, PAINT-02, PAINT-03, DIAG-01 | T-35-08, T-35-09, T-35-10, T-35-18 | Standalone emits rendered-output-only apply payloads and clamps sequence length | package check/build | `pnpm --filter @efxlab/efx-physic-paint check && pnpm --filter @efxlab/efx-physic-paint demo:build` | Plan-defined files | pending |
| 35-04-T1 | 35-04 | 3 | PAINT-01, PAINT-02, PAINT-03, PAINT-04, DIAG-01 | T-35-11, T-35-12, T-35-19, T-35-21 | App apply bridge validates payload/layer/frame data, rejects invalid input, and emits operationId-matched result feedback | unit/typecheck | `pnpm --dir app test --run app/src/stores/physicPaintStore.test.ts app/src/lib/physicPaintBridge.test.ts && pnpm --dir app typecheck` | `app/src/lib/physicPaintBridge.test.ts` | pending |
| 35-04-T2 | 35-04 | 3 | PAINT-04 | T-35-13, T-35-14 | Preview draws only physics rendered outputs for `physic-paint` layers and preserves existing paint paths | typecheck | `pnpm --dir app typecheck` | Plan-defined files | pending |
| 35-05-T1 | 35-05 | 4 | PAINT-01, PAINT-02, PAINT-03, PAINT-04, DIAG-01 | T-35-16, T-35-20 | Final copy/result loop remains visible and operationId-matched | typecheck/package check/build | `pnpm --dir app typecheck && pnpm --filter @efxlab/efx-physic-paint check && pnpm --filter @efxlab/efx-physic-paint demo:build` | Plan-defined files | pending |
| 35-05-T2 | 35-05 | 4 | PAINT-01, PAINT-02, PAINT-03, PAINT-04, DIAG-01 | T-35-15, T-35-17 | Live UAT verifies editor-to-standalone-to-editor workflow without Claude running the server | full suite + human UAT | `pnpm --dir app typecheck && pnpm --dir app test --run && pnpm --filter @efxlab/efx-physic-paint check && pnpm --filter @efxlab/efx-physic-paint demo:build` | Plan-defined files | pending |

*Status: pending · green · red · flaky*

---

## Wave 0 Requirements

No separate Wave 0 scaffold is required. Concrete tests are created inside the relevant TDD tasks before implementation:

- Plan 35-01 Task 2 creates `app/src/stores/physicPaintStore.test.ts` for rendered-output store behavior.
- Plan 35-04 Task 1 creates `app/src/lib/physicPaintBridge.test.ts` for app-side bridge result feedback, operationId matching, listener result dispatch, and invalid payload rejection.

All implementation tasks include `<verify><automated>...</automated></verify>` commands, so the plan set is Nyquist-compliant.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full editor-to-standalone-to-editor interactive workflow | PAINT-01, PAINT-02, PAINT-03, PAINT-04, DIAG-01 | Requires user-run dev server, live standalone window behavior, canvas painting, and preview/timeline visual confirmation | Execute Plan 35-05 Task 2 steps: create/select Physic Paint layer, click `[open fx paint canvas]`, paint/erase/change settings, run `[apply canvas]`, run `[apply play canvas]`, verify result feedback and preview output, and confirm existing basic paint/p5.brush FX paths remain available |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are covered by explicit TDD test creation inside the task
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references through in-task TDD test creation
- [x] No watch-mode flags
- [x] Feedback latency target declared for app checks; package build used as wave/end gate
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validation contract consistent with plans 35-01 through 35-05; execution status pending
