---
phase: "58"
slug: "rail-editing-regressions"
status: validated
nyquist_compliant: true
wave_0_complete: false
created: "2026-11-03"
---

# Phase 58 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (app workspace) |
| **Config file** | `app/vite.config.ts` (project's existing setup — no phase-specific config) |
| **Quick run command** | `pnpm --filter efx-motion-editor exec vitest run <phase test files>` |
| **Full suite command** | `pnpm --filter efx-motion-editor exec vitest run` |
| **Estimated runtime** | ~2.5 s quick (9 files, 1013 tests) · ~12 s full (367 files, 7081 tests) |

---

## Sampling Rate

- **After every task commit:** Run the plan's `<verify><automated>` vitest command
- **After every plan wave:** Run the full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 58-01-01 | 01 | 1 | RAIL-06, RAIL-07 | T-58-01 | Single-reference drag accepted only under Law A | unit | `vitest run physicsPaintRotoLoopGuards.test.ts` | ✅ | ✅ green |
| 58-01-02 | 01 | 1 | RAIL-06, RAIL-07 | T-58-01 | D-11 locked copy preserved for ≥2 references | unit | `vitest run physicsPaintRotoLoopGuards.test.ts` | ✅ | ✅ green |
| 58-02-01 | 02 | 1 | RAIL-03, RAIL-07 | T-58-03 | Provenance-free record builder writes no scriptId/railKind/motion | unit | `vitest run physicsPaintRotoKeyRailCycle.test.ts` | ✅ | ✅ green |
| 58-02-02 | 02 | 1 | RAIL-04, RAIL-05 | T-58-04 | Confirm publishes exactly one loop transaction | unit | `vitest run physicsPaintRotoPlayScriptController.test.ts` | ✅ | ✅ green |
| 58-02-03 | 02 | 1 | RAIL-04, RAIL-05 | T-58-04 | Cancel-after-open performs zero writes | unit | `vitest run physicsPaintRotoPlayScriptController.test.ts` | ✅ | ✅ green |
| 58-03-01 | 03 | 1 | RAIL-01, RAIL-03 | — | Inspector takeover exposes Edit Rail only for a Selected Key Rail | unit | `vitest run physicsPaintKeyRailPresentation.test.ts PhysicsPaintScriptsPanel.test.ts` | ✅ | ✅ green |
| 58-03-02 | 03 | 1 | RAIL-01 | — | Double-click and Enter forward the same intent | unit | `vitest run PhysicsPaintKeyRail.test.tsx PhysicsPaintWorkflowStrip.test.ts` | ✅ | ✅ green |
| 58-04-01 | 04 | 2 | RAIL-01, RAIL-02 | — | Reduced form shows only Cycle and Infinity, Cycle prefilled at 1 | unit | `vitest run PhysicsPaintPlayScriptDialog.test.ts` | ✅ | ✅ green |
| 58-04-02 | 04 | 2 | RAIL-01, RAIL-02 | — | Create Cycle vs Update Rail labeling by clip kind | unit | `vitest run PhysicsPaintPlayScriptDialog.test.ts` | ✅ | ✅ green |
| 58-05-01 | 05 | 2 | RAIL-01 | — | Selected inspector is referentially stable and resolves the rail-set anchor | unit | `vitest run PhysicsPaintStudio.test.ts` | ✅ | ✅ green |
| 58-06-01 | 06 | 1 | RAIL-04, RAIL-05 | T-58-09 | In-flight cancel never calls commit; lands 'cancelled' with zero history | unit | `vitest run physicsPaintRotoPlayScriptController.test.ts` | ✅ | ✅ green |
| 58-06-02 | 06 | 1 | RAIL-04, RAIL-05 | T-58-10 | Busy-phase cancel is a no-op; failed commit leaves Create Cycle usable | unit | `vitest run physicsPaintRotoPlayScriptController.test.ts` | ✅ | ✅ green |
| 58-07-01 | 07 | 1 | RAIL-06, RAIL-07 | T-58-11, T-58-12 | Order-breaking single-reference move rejected; sourceKeyIds never re-sorted | unit | `vitest run physicsPaintRotoLoopGuards.test.ts` | ✅ | ✅ green |
| 58-07-02 | 07 | 1 | RAIL-06, RAIL-07 | T-58-11 | Empty, single-source, dangling-source, and unreferenced edges pinned | unit | `vitest run physicsPaintRotoLoopGuards.test.ts` | ✅ | ✅ green |
| 58-08-01 | 08 | 1 | RAIL-02, RAIL-04 | T-58-13 | Enter and primary button share one confirm gate; stale frames error cannot veto | unit | `vitest run PhysicsPaintPlayScriptDialog.test.ts` | ✅ | ✅ green |
| 58-08-02 | 08 | 1 | RAIL-02, RAIL-04 | T-58-13 | Full, Reveal, and stack-collision surfaces keep prior precedence | unit | `vitest run PhysicsPaintPlayScriptDialog.test.ts` | ✅ | ✅ green |
| 58-09-01 | 09 | 1 | RAIL-03, RAIL-07 | T-58-14, T-58-15 | One accepted delete on a stale document persists the bounded extent and prunes orphan overrides atomically | unit | `vitest run useRotoPhysicalEditCoordinator.test.ts` | ✅ | ✅ green |
| 58-09-02 | 09 | 1 | RAIL-03, RAIL-07 | T-58-14 | Derivation, classifier, and group proposers stop at the surviving source extent (reveal rails exempt) | unit | `vitest run physicsPaintRotoLoopGuards.test.ts physicsPaintRotoGroupParity.test.ts` | ✅ | ✅ green |
| 58-09-03 | 09 | 1 | RAIL-03, RAIL-07 | T-58-15, T-58-16 | Stale-override contraction pruned in the rebuilt clip; Group-owned deletes refused with the locked copy | unit | `vitest run physicsPaintRotoPlayScriptController.test.ts physicsPaintRotoLoopGuards.test.ts useRotoTimelineActions.test.ts` | ✅ | ✅ green |
| 58-10-01 | 10 | 2 | RAIL-06, RAIL-07 | — | Final-mapping source-order guard rejects order-breaking partial-cycle group moves with the D-16 copy | unit | `vitest run physicsPaintRotoLoopGuards.test.ts` | ✅ | ✅ green |
| 58-10-02 | 10 | 2 | RAIL-06, RAIL-07 | — | UI dispatch: a rejected group drag never calls executePhysicalEdit; an accepted drag commits once | unit | `vitest run useRotoTimelineActions.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — no Wave 0 bootstrap needed. The phase only added test files beside existing source in the project's established vitest setup.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cancel/Escape during the in-flight authority window and during committing | RAIL-04 | Timing-sensitive live gesture inside the Studio window; the controller contract is unit-pinned but the visible dialog behavior needs human judgment | Open Edit Rail on a Key Rail, press Create Cycle, hit Cancel/Escape while the button shows preparing, then again while committing; confirm no clip appears and Undo history is unchanged |
| Single-key drag on a Motion/Static/Reveal rail in the live Studio | RAIL-06 | Pointer gesture and rail rendering cannot be asserted without the packaged app | Drag one referenced key across a valid and an invalid destination; confirm the accepted move re-derives the cycle and the rejected move shows the locked D-12/D-16 copy |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-11-03

## Validation Audit 2026-11-03

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
