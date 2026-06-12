---
phase: 36
slug: physics-paint-ui-rebuild-session-persistence-and-output-proo
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-12
---

# Phase 36 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^2.1.9` |
| **Config file** | `app/vitest.config.ts` |
| **Quick run command** | `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app vitest run <changed-test-file>` |
| **Full suite command** | `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app vitest run` |
| **Estimated runtime** | TBD during Wave 0 |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app vitest run <changed-test-file>`.
- **After every plan wave:** Run `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app vitest run` plus `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app typecheck`.
- **Before `/gsd-verify-work`:** Full app Vitest suite and typecheck/build must be green.
- **Max feedback latency:** TBD after Wave 0 establishes concrete test runtimes.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 36-W0-01 | TBD | 0 | UI-REBUILD-01 | — | N/A | unit/helper | `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app vitest run src/components/physic-paint/physicsPaintWorkflowState.test.ts` | ❌ W0 | ⬜ pending |
| 36-W0-02 | TBD | 0 | SAVE-01, SAVE-02 | T-36-01 | Validate loaded session JSON before engine mutation | unit/helper | `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app vitest run src/components/physic-paint/physicsPaintSessionFile.test.ts src/types/physicPaint.test.ts` | ❌ W0 / partial | ⬜ pending |
| 36-W0-03 | TBD | 0 | OUT-01, OUT-02 | T-36-02 | Clamp export ranges and produce bounded manifest output | unit/helper | `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app vitest run src/components/physic-paint/physicsPaintDevExport.test.ts` | ❌ W0 | ⬜ pending |
| 36-W0-04 | TBD | 0 | UI-REBUILD-02 | T-36-03 | Reject editor-unsafe apply payloads and avoid new editor integration scope | unit | `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app vitest run src/lib/physicPaintBridge.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `app/src/components/physic-paint/physicsPaintSessionFile.test.ts` — covers SAVE-01/SAVE-02 extracted save/load helpers.
- [ ] `app/src/components/physic-paint/physicsPaintDevExport.test.ts` — covers OUT-01/OUT-02 manifest/still export helpers.
- [ ] `app/src/components/physic-paint/physicsPaintWorkflowState.test.ts` — covers UI mode switching, destructive confirmation predicates, and dev-mode gate predicates.
- [ ] Manual smoke checklist for left rail icons, top bar controls, right panel options, and bottom strip workflows because current Vitest config does not provide component/browser UI testing.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Rebuilt standalone UI layout and polished interaction states | UI-REBUILD-01 | No component/browser UI test harness is currently configured | User runs the app and verifies painting, erasing, tool/settings changes, save/load, play, apply, and export controls in the rebuilt Physics Paint UI. |
| Live engine PNG/still export visual output | OUT-01 | PNG visual fidelity requires canvas/runtime confirmation | User exports the current rendered result and inspects the generated PNG/still image. |
| Frame-sequence/cache-manifest proof from live engine | OUT-02 | Requires runtime canvas output and generated artifacts | User runs the dev export flow and verifies frame files/manifest metadata match the selected range and canvas dimensions. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency measured and recorded
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
