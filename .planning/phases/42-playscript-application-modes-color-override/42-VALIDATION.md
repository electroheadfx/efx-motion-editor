---
phase: 42
slug: playscript-application-modes-color-override
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-05
revised: 2026-08-05 (manual plan review — matrix mapped to concrete plan/tasks; PLAY-02 manually reviewed and covered)
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
| **Package animation tests** | `NODE_PATH=app/node_modules app/node_modules/.bin/vitest --run --config /dev/null packages/efx-physic-paint/src/animation/staticStrokeSchedule.test.ts packages/efx-physic-paint/src/animation/progressiveStrokeSchedule.test.ts` |
| **Full suite command** | `pnpm --dir app exec vitest run` + package animation tests + `pnpm --dir app typecheck` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command (controller + renderer tests, plus package schedule tests when the package changes; dialog/panel test files once they exist)
- **After every plan wave:** Run full suite (`pnpm --dir app exec vitest run`) + package animation tests + `pnpm --dir app typecheck`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Test Scaffold Ownership (no separate Wave 0)

Every new test file or test-case group is created by a named plan task inside its own wave — there are no placeholder or Wave-0-only scaffolds:

| Test file / case group | Owning plan.task |
|------------------------|------------------|
| `packages/efx-physic-paint/src/animation/staticStrokeSchedule.test.ts` (new) | **42-01 Task 1** (RED) / 42-01 Task 2 (GREEN) |
| `physicsPaintRotoPlayScriptRenderer.test.ts` — static-mode selection, per-mode paint-only recolor, erase preserved both modes, geometry parity under nonzero Motion, deep-equal snapshot, deep-frozen input (PLAY-02) | **42-02 Task 1** |
| `physicsPaintRotoPlayScriptController.test.ts` — mode/override/dialog-Motion renderer input, no library write port, snapshot metadata untouched (PLAY-02) | **42-02 Task 1** |
| `physicsPaintRotoPlayScriptController.test.ts` — Repeat format + safe-product boundaries, readout derivation, Infinity preserve/restore, D-15 defaults, session memory, cycle-only generation (PLAY-04) | **42-02 Task 2** |
| `physicsPaintRotoPlayScriptController.test.ts` — resetDialogMotion boundary, E5 failure/cancel lifecycle + atomicity, exact applied-summary composition (D-06/D-07, UI-SPEC E5) | **42-02 Task 3** |
| `PhysicsPaintPlayScriptDialog.test.ts` (new) — radiogroup semantics/keyboard, Original-colors default, picker-open-no-override, label switching, readout copy, first-time defaults, reset spy, E5 failure/cancellation rendering | **42-03 Task 2** |
| `PhysicsPaintScriptsPanel.test.ts` — two-line summary rendering of appliedSummary signals, first-time defaults, stability across cancel/failure, tooltip copy | **42-04 Task 1** |

*(Framework install: none — vitest already present.)*

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 42-01-T1 | 42-01 | 1 | PLAY-01 | T-42-01-01 | frameCount normalization bounds schedule volume | unit (package, RED) | package vitest `--config /dev/null` on `staticStrokeSchedule.test.ts`; must exit non-zero | ❌ created by task | ⬜ pending |
| 42-01-T2 | 42-01 | 1 | PLAY-01 | T-42-01-01 | static schedule + progressive regression lock (byte-untouched progressive module) | unit (package, GREEN) | package vitest on `staticStrokeSchedule.test.ts` + `progressiveStrokeSchedule.test.ts`; `git diff --exit-code` on the progressive module | ✅ progressive / ❌ static created by task | ⬜ pending |
| 42-02-T1 | 42-02 | 2 | PLAY-01, PLAY-02 | T-42-02-02 | override is color-only, paint-only, post-Motion in both modes; source snapshot deep-equal + freeze-safe; zero library write ports | unit (tracer) | `pnpm --dir app exec vitest run src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts` | ✅ (extend both) | ⬜ pending |
| 42-02-T2 | 42-02 | 2 | PLAY-04 | T-42-02-01, T-42-02-03 | Repeat strict-regex validation + dynamic safe-product bound floor(MAX_SAFE_INTEGER / cycleLength); Infinity never multiplied; generation pinned to cycle value | unit | quick run command above | ✅ (extend) | ⬜ pending |
| 42-02-T3 | 42-02 | 2 | PLAY-02, PLAY-03 | T-42-02-04 | resetDialogMotion is read-only toward defaults; E5 failure/cancel atomicity (no partial frames/mutations, zero commit calls); summary byte-stable across edits/cancel/failure, exact composed strings | unit | quick run command above | ✅ (extend) | ⬜ pending |
| 42-03-T1 | 42-03 | 3 | PLAY-03, PLAY-04 | T-42-03-01 | dialog mirrors controller validation only — no dialog-side parsing; repeatError/setInfinity wiring | unit (controller) | `pnpm --dir app exec vitest run src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts` | ✅ controller | ⬜ pending |
| 42-03-T2 | 42-03 | 3 | PLAY-03 | T-42-03-01, T-42-03-02 | picker-open-never-overrides contract; controller-only reset boundary; E5 failure renders inline error + hides progress + re-enables controls; cancellation renders no error | unit (component) | `pnpm --dir app exec vitest run src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts` | ❌ created by task | ⬜ pending |
| 42-04-T1 | 42-04 | 4 | PLAY-03 | T-42-04-01 | summary is a read-only signal projection; success-only update; dark-panel tokens only | unit (component) | `pnpm --dir app exec vitest run src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts` | ✅ (extend) | ⬜ pending |
| 42-04-T2 | 42-04 | 4 | All | — | native visual UAT incl. packaged-build picker/CSP check | manual-only | user-run native UAT (project convention — automated-ready until UAT passes); recorded in `42-04-UAT.md` | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Coverage Checklist (explicit)

- [ ] Static schedule semantics + progressive regression lock — 42-01-T1/T2 (package tests + byte-diff gate)
- [ ] PLAY-02 paint/erase/geometry/source-immutability invariants (both modes, deep-equal snapshot, deep-frozen input, thumbnail/metadata untouched, zero library write ports) — 42-02-T1 + 42-02-T3
- [ ] Motion reset controller boundary (`resetDialogMotion`, read-only toward defaults) — 42-02-T3 controller tests + 42-03-T2 dialog spy test
- [ ] Repeat safe-product boundaries (repeat 1; exact floor maximum; maximum + 1; individually-safe-but-product-unsafe; Infinity preserving a large valid repeat; generated count == cycle frames) — 42-02-T2
- [ ] E5 generation failure (error shown, progress hidden, controls re-enabled, dialog open, clean retry, atomicity) and normal cancellation (no error, atomicity) — 42-02-T3 controller tests + 42-03-T2 component tests
- [ ] Success-only exact summary composition (line 1/line 2 exact strings, layer-end boundary range, atomic two-line update, byte-stability across edits/cancel/cancellation/failure, first-time defaults) — 42-02-T3
- [ ] Dialog component states (radiogroup, labels, picker guard, defaults, readout, E5 rendering) — 42-03-T1/T2
- [ ] Panel summary rendering (placement, verbatim signal rendering, tooltip, overflow tokens) — 42-04-T1
- [ ] Full gates: `pnpm --dir app exec vitest run` + package animation tests + `pnpm --dir app typecheck` — every wave gate and the phase gate before UAT
- [ ] Native + packaged-build UAT checkpoint (nine steps incl. packaged-build picker/CSP verification) — 42-04-T2

---

## Requirement Review Notes

- **PLAY-02 — MANUALLY REVIEWED and COVERED (2026-08-05).** The `no-change` assumption decision stands: `PaintStroke.color` remains required in the reusable script model; no schema or document-model generalization; overrideColor remains renderer/application policy. Coverage is the explicit invariant set owned by 42-02 Task 1 (per-mode paint-only recolor, erase preserved both modes, original color into Motion, point-identical geometry under nonzero Motion, deep-equal snapshot, deep-frozen input, zero library write ports) and 42-02 Task 3 (failure/cancel atomicity leaving the source and timeline untouched). PLAY-02 is no longer an unresolved or manually flagged edge.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Both modes live, override live in both modes, reset/E5 flows, panel clarity, loop readout, overflow structure, packaged-build picker/CSP | PLAY-01..04 | Native visual UAT is the project oracle; no Chrome DevTools MCP | User-run native UAT per 42-04 Task 2 nine-step script, recorded in `42-04-UAT.md` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify (only 42-04-T2 is manual by project convention)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Every test scaffold is owned by a named task (no Wave 0 placeholders)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
