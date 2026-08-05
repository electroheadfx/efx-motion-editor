---
phase: 42
slug: playscript-application-modes-color-override
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-05
---

# Phase 42 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (app workspace) |
| **Config file** | `app/vitest.config.ts` — include `src/**/*.test.ts` |
| **Quick run command** | `pnpm --dir app exec vitest run src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts` |
| **Package animation tests** | `NODE_PATH=app/node_modules app/node_modules/.bin/vitest --run --config /dev/null packages/efx-physic-paint/src/animation/staticStrokeSchedule.test.ts` |
| **Full suite command** | `pnpm --dir app exec vitest run` (97 test files) + package animation tests + `pnpm --dir app typecheck` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command (controller + renderer tests, plus package schedule test when the package changes)
- **After every plan wave:** Run full suite (`pnpm --dir app exec vitest run`) + package animation tests + `pnpm --dir app typecheck`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 42-TBD | TBD | TBD | PLAY-01 | — | N/A | unit (package) | package vitest `--config /dev/null` on `staticStrokeSchedule.test.ts` + `progressiveStrokeSchedule.test.ts` | ❌ W0 / ✅ progressive | ⬜ pending |
| 42-TBD | TBD | TBD | PLAY-01 | — | N/A | unit | `pnpm --dir app exec vitest run src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts` | ✅ (extend) | ⬜ pending |
| 42-TBD | TBD | TBD | PLAY-02 | — | N/A | unit | renderer test file above | ❌ W0 (new cases) | ⬜ pending |
| 42-TBD | TBD | TBD | PLAY-02 | — | Source snapshot never written; thumbnail untouched | unit (contract) | controller test (assert no library write port invoked during confirm) | ❌ W0 (new cases) | ⬜ pending |
| 42-TBD | TBD | TBD | PLAY-03 | — | N/A | unit (component) | `pnpm --dir app exec vitest run src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts` (+ new dialog test file) | ✅ panel / ❌ W0 dialog | ⬜ pending |
| 42-TBD | TBD | TBD | PLAY-04 | — | N/A | unit | controller test file above | ❌ W0 (new cases) | ⬜ pending |
| 42-TBD | TBD | TBD | All | — | N/A | manual-only | user-run native UAT (project convention — automated-ready until UAT passes) | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs / plans / waves: filled by planner output.*

---

## Wave 0 Requirements

- [ ] `packages/efx-physic-paint/src/animation/staticStrokeSchedule.test.ts` — covers PLAY-01 schedule semantics (complete set, full points, every frame, deterministic under transform)
- [ ] New test cases in `physicsPaintRotoPlayScriptRenderer.test.ts` — static mode selection, color override paint-only/erase-preserved, geometry-parity under Motion (PLAY-02)
- [ ] New test cases in `physicsPaintRotoPlayScriptController.test.ts` — option signals, session memory across open/close (D-10), loop readout derivation, Infinity restore (PLAY-04), D-15 first-time defaults
- [ ] New dialog component test (no `PhysicsPaintPlayScriptDialog.test.ts` exists today) — radiogroup semantics/keyboard (D-05), Original-colors default, picker-open does not create override (Pitfall 3, D-09)
- [ ] Extend `PhysicsPaintScriptsPanel.test.ts` — two-line summary content (PLAY-03)

*(Framework install: none — vitest already present.)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Both modes live, override live in both modes, panel clarity, loop readout | PLAY-01..04 | Native visual UAT is the project oracle; no Chrome DevTools MCP | User-run native UAT of the Scripts panel and PlayScript application |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
