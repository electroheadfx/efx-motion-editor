---
phase: 38
slug: multi-copy-paste-and-tooltip-polish
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-27
---

# Phase 38 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^2.1.9 (app/package.json) |
| **Config file** | existing project config — use as-is (no test config hacks) |
| **Quick run command** | `pnpm --dir app vitest run <file>` |
| **Full suite command** | `pnpm --dir app vitest run` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Production wave runs NO tests (D-15 — native UAT is blocking before any test creation/execution). Post-UAT: targeted file `pnpm --dir app vitest run <file>`
- **After every plan wave:** `pnpm --dir app vitest run` (post-UAT waves only)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

All automated test tasks live in the post-UAT wave per D-15. Production tasks verify via native user-owned UAT (blocking).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 38-XX-resolver-accept | TBD | post-UAT | 38-* | — | N/A | unit (resolver) | `pnpm --dir app vitest run app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts` | ✅ extend | ⬜ pending |
| 38-XX-resolver-reject | TBD | post-UAT | 38-* | — | N/A | unit (resolver) | same file | ✅ extend | ⬜ pending |
| 38-XX-delta-validation | TBD | post-UAT | 38-* | — | N/A | unit | same file or dedicated validator describe | ✅ extend | ⬜ pending |
| 38-XX-selection-aftermath | TBD | post-UAT | 38-* | — | N/A | unit | `pnpm --dir app vitest run app/src/components/physic-paint/roto/physicsPaintRotoMultiSelection.test.ts` | ✅ extend | ⬜ pending |
| 38-XX-clipboard-shape | TBD | post-UAT | 38-* | — | N/A | unit | session or key-utilities test | ⚠️ check at planning | ⬜ pending |
| 38-XX-capsule-context | TBD | post-UAT | 38-* | — | N/A | unit | `pnpm --dir app vitest run app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.test.ts` | ✅ extend (lines 159–225 assert baseline; updated post-UAT) | ⬜ pending |
| 38-XX-tooltip-placement | TBD | post-UAT | 38-* | — | N/A | unit (pure function) | new describe in a view test file | ❌ add post-UAT | ⬜ pending |
| 38-XX-propagation | TBD | post-UAT | 38-* | — | N/A | static/typecheck + targeted test | `pnpm --dir app typecheck` | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None for infrastructure — test framework, resolver/presentation/selection test files all exist and follow the locked-mapping pattern. New tests are added **only after native UAT approval** (D-15); Wave 0 must not create them.

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Group Copy/Paste end-to-end (copy 2+ selected keys, paste anchored at destination, atomic reject with capsule reason, one Undo) | 38-* | Native user-owned UAT is the blocking acceptance gate per D-15; live interaction feel and playback/cache parity need real UI | User: multi-select real keys → Copy → navigate to empty destination → Paste → verify placement, fresh keys, reject case, Undo/Redo |
| Capsule idle context follows navigation/selection; no permanent baseline line | 38-* | Visual/navigation behavior, user approval required | User: navigate cells of each kind (real key, generated, empty) → observe capsule line; confirm no `Missing frames play transparent/background` filler |
| Tooltip placement/notch/multiline across mounts (header, capsule, cells, action row, tube/log) | 38-* | Visual polish + viewport clamp behavior across window sizes | User: hover/focus each tooltip source → verify opposite-side placement, notch pointing at control, wrapped text, no `...`, clamped inside viewport |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
