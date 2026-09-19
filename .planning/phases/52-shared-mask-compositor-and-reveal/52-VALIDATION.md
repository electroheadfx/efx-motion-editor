---
phase: "52"
slug: "shared-mask-compositor-and-reveal"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-02"
---

# Phase 52 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (project-local, `pnpm --filter efx-motion-editor exec vitest run`) |
| **Config file** | existing `vitest` config (no new config — per project rule "no test config hacks") |
| **Quick run command** | `pnpm --filter efx-motion-editor exec vitest run <file>` — the vitest root is `app/`, so paths are `src/...` (the plans' `app/src/...` form was a documented command-path deviation in every summary) |
| **Full suite command** | `pnpm --filter efx-motion-editor exec vitest run` |
| **Current suite** | green at validation: 3429 passed, 1 skipped, 101 todo |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter efx-motion-editor exec vitest run <touched-test-file>`
- **After every plan wave:** Run `pnpm --filter efx-motion-editor exec vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 52-01-01 | 01 | 1 | RVL-01, RVL-04, RVL-06, D-11 abort truth | T-52-01 / T-52-02 / T-52-03 | Bake-into-keys end-to-end: create + bake + flattened + undo; interrupted/aborted bake writes no keys and never bumps the revision | integration | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts src/stores/efxPaintStore.reveal.test.ts` | ✅ | ✅ green |
| 52-01-02 | 01 | 1 | RVL-02, RVL-03 | T-52-01 | Empty coverage → transparent; full → full reference; partial → soft edges; eraser removes; progressive vs static | unit | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts` | ✅ | ✅ green |
| 52-01-03 | 01 | 1 | RVL-06 | T-52-03 | Undo/redo by reference (create/replay/delete/span) with runtime resync (CR-01) | unit | `pnpm --filter efx-motion-editor exec vitest run src/stores/efxPaintStore.reveal.test.ts` | ✅ | ✅ green |
| 52-02-01 | 02 | 2 | RVL-05 | T-52-04 | Remove PhotoReferenceMode (D-15 clean break) | unit | `pnpm --filter efx-motion-editor exec vitest run src/efx-paint/document/efxPaintDocumentParsers.reveal.test.ts` | ✅ | ✅ green |
| 52-02-02 | 02 | 2 | RVL-06 | T-52-04 | Mode-free PhotoReferenceTrack round-trip; legacy mode rejected fail-closed | unit | `pnpm --filter efx-motion-editor exec vitest run src/efx-paint/document/efxPaintDocumentParsers.reveal.test.ts` | ✅ | ✅ green |
| 52-03-01 | 03 | 2 | RVL-04 | T-52-05 | Reveal rail line color (blue #69BBC8 motion+static — AM-1), no in-line status dot (AM-2), tooltip freshness line (D-23) | unit | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts` | ✅ | ✅ green |
| 52-03-02 | 03 | 2 | RVL-04 | T-52-05 | Replay control reusing Regenerate pattern + disabled reason (D-24) | unit | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts` | ✅ | ✅ green |
| 52-04-01 | 04 | 3 | RVL-01 | T-52-06 | Create Rail dialog Reveal Photo Rail tab + reactive reference guard (G-52-3), "Reveal with script…" CTA origin | unit | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintPhotoReferenceDialog.test.ts src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts` | ✅ | ✅ green |
| 52-04-02 | 04 | 3 | RVL-01 | T-52-06 | Wire creation flow: picker → variant → create + bake with the onProgress bar (D-11/D-26) | unit | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintScriptPickerDialog.test.tsx src/components/physic-paint/view/PhysicsPaintWorkflowStripRailCreate.test.tsx` | ✅ | ✅ green |
| 52-04-03 | 04 | 3 | RVL-01 | T-52-06 | Track rail-creation flow: reveal as the 4th rail kind + the strip "+ Rail" menu (AM-3) | unit | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintWorkflowPresentation.test.ts src/components/physic-paint/view/PhysicsPaintWorkflowStripRailCreate.test.tsx` | ✅ | ✅ green |
| 52-05-01 | 05 | 3 | RVL-05 | T-52-07 | Token allow-list over the four raster surfaces (compositor, flattenedCache, previewRenderer, exportRenderer) + reveal bake path | unit (token allow-list) | `pnpm --filter efx-motion-editor exec vitest run src/efx-paint/compositor/efxPaintRevealLeakContract.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `app/src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts` — covers RVL-01/RVL-02/RVL-03 (bake mask + variant semantics) AND the D-11 abort-mid-bake invariant (abort-before and interrupt-mid-bake reject with AbortError, never resolve partial staged keys; nyquist audit) — 15 tests green
- [x] `app/src/stores/efxPaintStore.reveal.test.ts` — covers RVL-06 (create/replay/delete/span undo by reference + CR-01 runtime resync) AND the D-11 fail-closed commit (an aborted bake commits no keys, writes no rail, no incoming break, revision unbumped; nyquist audit) — 18 tests green
- [x] `app/src/efx-paint/document/efxPaintDocumentParsers.reveal.test.ts` — covers the reveal rail parse round-trip + mode-free PhotoReferenceTrack (RVL-05/RVL-06) — 4 tests green
- [x] `app/src/efx-paint/compositor/efxPaintRevealLeakContract.test.ts` — covers RVL-05 (token allow-list over the four raster surfaces) — 2 tests green

---

## Post-Execution Automated Coverage (UAT fixes + amendments)

The native-UAT gap series (G-52-1..G-52-10), the in-phase amendments (AM-1..AM-3), GSD-52, and AM-4 all landed with automated regression pins beyond the original map:

| Fix | Test files (green) |
|-----|--------------------|
| G-52-2 working-size authority / natural duration / tab flow | `physicsPaintRotoRevealBake.test.ts`, `efxPaintStore.reveal.test.ts`, `physicsPaintRotoPlayScriptController.test.ts`, `PhysicsPaintPlayScriptDialog.test.ts` |
| G-52-3 two-tab Create Rail dialog (Paint Rail / Reveal Photo Rail) | `PhysicsPaintPlayScriptDialog.test.ts`, `physicsPaintRotoPlayScriptController.test.ts` |
| G-52-4 rail tooling interop (railKind round-trip, lifecycle stamping, paste kind) | `useRotoPhysicalEditCoordinator.test.ts`, `physicsPaintRotoGroupLifecycle.test.ts`, store/bridge payload round-trip tests |
| G-52-5 decode-once + unified-ledger undo/redo living | `useRotoPhysicalEditHistory.test.ts` (G-52-5 describe), `efxPaintStore.reveal.test.ts`, ghost suite |
| G-52-6 canonical fingerprint tokenization (O(1) payload) | `physicPaint.test.ts` (G-52-6 describe, mutation-verified), Rust parity vectors re-pinned |
| G-52-7 off-main-thread decode (createImageBitmap) | `rotoCanvasFrames.test.ts` (G-52-7 describes, mutation-verified) |
| G-52-8 per-frame decode/encode storms (registry-first, lazy dataUrl, structural availability) | `rotoCanvasFrames.test.ts`, `physicPaintStore.test.ts`, `physicsPaintProgramMonitor.test.ts`, `previewRenderer.test.ts` |
| G-52-10 registry canvas ownership (no zeroed draw, fail-soft) | `physicsPaintRotoRegistryOwnership.test.ts` (NEW), `physicPaintStore.test.ts`, `physicsPaintRotoPlayScriptRenderer.test.ts`, `physicsPaintRotoRevealBake.test.ts` |
| AM-1/AM-2 blue rail + no in-line dot | `physicsPaintLoopClipPresentation.test.ts` (re-pinned), `PhysicsPaintLoopClipRail.test.tsx` |
| AM-3 always-visible "+ Rail" script picker | `PhysicsPaintScriptPickerDialog.test.tsx`, `PhysicsPaintWorkflowStripRailCreate.test.tsx` |
| GSD-52 loop-rail keyboard-delete focus restore | `physicsPaintRailFocusRestore.test.ts` (NEW) |
| AM-4 leading-wall interpolation break on rail creation | store-level incoming-interpolation break pin |

*Native UAT sessions A/B/C passed 2026-09-04 (all six standing tests + the blocker gap re-runs).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Status |
|----------|-------------|------------|-------------------|--------|
| Reveal rail visual look (blue #69BBC8 line for motion+static, no in-line status dot, tooltip freshness line) | RVL-04 | Pixel-level rail styling is not asserted by unit tests (the presentation projection is) | Native UAT: create a reveal rail, verify blue line + hover #8FCFD9, no in-line dot, tooltip "Status:" line + freshness line | ✅ passed 2026-09-04 (AM-1/AM-2 re-run) |
| Create Rail dialog Reveal Photo Rail tab flow (editable Frames + from-F{n} hint + onProgress bar) | RVL-01 | Modal interaction + progress bar are UI-surface behaviors on top of unit-tested state machine | Native UAT: place reference, open Create Rail dialog, Reveal Photo Rail tab, Create Rail → rail lands baked, dialog closes, same-session scrub clean | ✅ passed 2026-09-04 (G-52-2c/G-52-3/G-52-10 re-runs) |
| "+ Rail" always-visible picker + proactive reference guard | RVL-01 | The picker opens the Photo Reference modal proactively when no reference is placed — a UI-surface behavior | Native UAT: no reference → enter the Reveal tab → Photo Reference modal opens proactively, dialog stays behind it; after import the guard clears | ✅ passed 2026-09-04 |
| Abort the reveal bake mid-span | RVL-01 | Historically manual; now **automated** (nyquist audit) — see `physicsPaintRotoRevealBake.test.ts` + `efxPaintStore.reveal.test.ts` abort tests | Retained as a native sanity row: Cancel generation mid-bake → no keys, no revision bump, dialog closes | ✅ native passed + automated |

---

## Validation Audit 2026-09-04

| Metric | Count |
|--------|-------|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |

The single gap was the D-11 abort-mid-bake invariant (VERIFICATION.md human item 1, `PRESENT_BEHAVIOR_UNVERIFIED`). Resolved by commit `cceff21a` (nyquist audit): renderer-seam abort tests (abort-before + interrupt-mid-bake-after-frame-0) in `physicsPaintRotoRevealBake.test.ts` and the store-seam fail-closed commit in `efxPaintStore.reveal.test.ts`. Full suite 3429 passed (3426 baseline + 3 new), no regressions.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-09-04 — all 6 RVL requirements COVERED by automated tests that pass; remaining behavior is native-UAT-documented and passed (sessions A/B/C).
