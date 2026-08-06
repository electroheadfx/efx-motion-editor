---
phase: 43
slug: hold-loop-clips-filmstrip-capsule
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-06
---

# Phase 43 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^2.1.9 |
| **Config file** | `app/vitest.config.ts` |
| **Quick run command** | `pnpm --dir app exec vitest run <file>` |
| **Full suite command** | `pnpm --dir app exec vitest run` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --dir app exec vitest run <changed-area spec>`
- **After every plan wave:** Run `pnpm --dir app exec vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green + typecheck; native visual UAT (user-run) is the final oracle
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 43-TBD | TBD | 0 | HOLD-02 | — | N/A | unit | `pnpm --dir app exec vitest run <new determinism spec>` | ❌ W0 | ⬜ pending |
| 43-TBD | TBD | 0 | HOLD-05 | T-43-DoS | Crafted huge repeat counts bounded; O(1) modulo, no materialized frame lists | unit | `pnpm --dir app exec vitest run <new loop resolver spec>` | ❌ W0 | ⬜ pending |
| 43-TBD | TBD | 0 | HOLD-05 | T-43-parse | Fail-closed parse; dangling refs preserved verbatim + marked unresolved | unit | `pnpm --dir app exec vitest run <new loopClips persistence spec>` | ❌ W0 | ⬜ pending |
| 43-TBD | TBD | 1 | HOLD-01 | — | N/A | unit | `pnpm --dir app exec vitest run physicsPaintRotoPlayScriptRenderer` | ✅ | ⬜ pending |
| 43-TBD | TBD | 1 | HOLD-03 | — | N/A | unit | `pnpm --dir app exec vitest run physicsPaintRotoPlayScriptController` | ✅ extend | ⬜ pending |
| 43-TBD | TBD | 1 | HOLD-04 | — | N/A | unit (store-level) | `pnpm --dir app exec vitest run physicPaintStore` | ✅ extend | ⬜ pending |
| 43-TBD | TBD | 2 | HOLD-06 | — | N/A | unit (geometry/copy) + native UAT | `pnpm --dir app exec vitest run TimelineRenderer` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs finalized by the planner; this map is the requirement-level contract.*

---

## Wave 0 Requirements

- [ ] New resolver spec for loop projection: modulo mapping, real-wins precedence, next-clip boundary (3 valid kinds per D-24), loop-loop priority (D-14), zero-effective, re-expansion, half-open intervals — covers HOLD-05
- [ ] New persistence spec: loopClips round-trip save/reopen, absent-field v0.8.1 load, stale keyId verbatim preservation (D-31), Save As atomic copy — covers HOLD-05 / D-29..D-31
- [ ] New determinism spec: byte-identical dataUrls across regeneration for zero and nonzero Motion — covers HOLD-02
- [ ] History/Undo spec extension: loop-only op snapshot, generation+shrink one-undo coherence (D-06/D-10) — covers HOLD-03
- [ ] Controller spec extension: repairLoop (regenerate + sourceKeyIds retarget as one commit; destination-overlap rejection preserves the unresolved record verbatim) and relinkLoop (guard rejections on empty/dangling/cross-authority targets; post-relink re-derivation) — covers D-31 / HOLD-05
- [ ] No framework install needed — infrastructure exists

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Filmstrip capsule visual states (badges, bands, truncation diagonal, zoom levels) | HOLD-06 | Native visual rendering is the user's oracle; MCP Chrome DevTools not allowed | User runs app, opens a loop clip project, inspects capsule at multiple zoom levels and truncation states |
| Badge click → loop-edit dialog flow (incl. Studio closed) | HOLD-06 | Cross-window parent→child bridge behavior needs live app | User clicks capsule badge with Studio open and closed; verifies dialog reopens in loop-edit mode |
| Unresolved-loop repair/relink recovery flow (D-31) | HOLD-05/HOLD-06 | End-to-end recovery UX (fixture project with dangling refs, dialog prefill, one-Undo atomicity) needs live app | User opens the executor-prepared fixture with a dangling loop record; verifies the red error outline + tooltip remedy line, runs `Repair loop…` → `Regenerate source cycle` (loop re-resolves, export unblocks), then `Relink loop…` on a second fixture (loop retargets to the chosen cycle); confirms an unrepaired record survives save/reopen verbatim |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
