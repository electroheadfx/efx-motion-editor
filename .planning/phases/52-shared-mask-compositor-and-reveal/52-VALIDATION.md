---
phase: "52"
slug: "shared-mask-compositor-and-reveal"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| **Quick run command** | `pnpm --filter efx-motion-editor exec vitest run <file>` |
| **Full suite command** | `pnpm --filter efx-motion-editor exec vitest run` |
| **Estimated runtime** | ~120 seconds |

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
| 52-01-01 | 01 | 1 | RVL-01, RVL-04, RVL-06 | T-52-01 / T-52-02 / T-52-03 | Bake-into-keys end-to-end: create + bake + flattened + undo | integration | `pnpm --filter efx-motion-editor exec vitest run app/src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts app/src/stores/efxPaintStore.reveal.test.ts` | ❌ W0 | ⬜ pending |
| 52-01-02 | 01 | 1 | RVL-02, RVL-03 | T-52-01 | Empty coverage → transparent; full → full reference; partial → soft edges; eraser removes; progressive vs static | unit | `pnpm --filter efx-motion-editor exec vitest run app/src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts` | ❌ W0 | ⬜ pending |
| 52-01-03 | 01 | 1 | RVL-06 | T-52-03 | Undo/redo by reference (create/replay/delete/span) | unit | `pnpm --filter efx-motion-editor exec vitest run app/src/stores/efxPaintStore.reveal.test.ts` | ❌ W0 | ⬜ pending |
| 52-02-01 | 02 | 2 | RVL-05 | T-52-04 | Remove PhotoReferenceMode (D-15 clean break) | unit | `pnpm --filter efx-motion-editor exec vitest run app/src/efx-paint/document/efxPaintDocumentParsers.reveal.test.ts` | ❌ W0 | ⬜ pending |
| 52-02-02 | 02 | 2 | RVL-06 | T-52-04 | Mode-free PhotoReferenceTrack round-trip; legacy mode rejected fail-closed | unit | `pnpm --filter efx-motion-editor exec vitest run app/src/efx-paint/document/efxPaintDocumentParsers.reveal.test.ts` | ❌ W0 | ⬜ pending |
| 52-03-01 | 03 | 2 | RVL-04 | T-52-05 | Reveal rail color + status dot + tooltip freshness | unit | `pnpm --filter efx-motion-editor exec vitest run app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts` | ✅ | ⬜ pending |
| 52-03-02 | 03 | 2 | RVL-04 | T-52-05 | Replay control reusing Regenerate pattern + disabled reason | unit | `pnpm --filter efx-motion-editor exec vitest run app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts` | ✅ | ⬜ pending |
| 52-04-01 | 04 | 3 | RVL-01 | T-52-06 | "Reveal with script…" button gated on placed reference | unit | `pnpm --filter efx-motion-editor exec vitest run app/src/components/physic-paint/view/physicsPaintPhotoReferenceDialog.test.ts` | ✅ | ⬜ pending |
| 52-04-02 | 04 | 3 | RVL-01 | T-52-06 | Wire creation flow: picker → variant → create + bake | unit | `pnpm --filter efx-motion-editor exec vitest run app/src/components/physic-paint/view/physicsPaintPhotoReferenceDialog.test.ts` | ✅ | ⬜ pending |
| 52-04-03 | 04 | 3 | RVL-01 | T-52-06 | Track rail-creation flow: reveal as 4th rail kind | unit | `pnpm --filter efx-motion-editor exec vitest run app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.test.ts` | ✅ | ⬜ pending |
| 52-05-01 | 05 | 3 | RVL-05 | T-52-07 | Token allow-list over the four raster surfaces | unit (token allow-list) | `pnpm --filter efx-motion-editor exec vitest run app/src/efx-paint/compositor/efxPaintRevealLeakContract.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `app/src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts` — covers RVL-01/RVL-02/RVL-03 (bake mask + variant semantics)
- [ ] `app/src/stores/efxPaintStore.reveal.test.ts` — covers RVL-06 (create/replay/delete/span undo by reference)
- [ ] `app/src/efx-paint/document/efxPaintDocumentParsers.reveal.test.ts` — covers the reveal rail parse round-trip
- [ ] `app/src/efx-paint/compositor/efxPaintRevealLeakContract.test.ts` — covers RVL-05 (token allow-list over the four raster surfaces)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Reveal rail visual look (emerald/teal line, status dot, tooltip freshness) | RVL-04 | Pixel-level rail styling is not asserted by unit tests | Native UAT: create a reveal rail, verify green-family color, 20x4px status dot, tooltip freshness line |
| "Reveal with script…" modal flow with onProgress bar | RVL-01 | Modal interaction + progress bar are UI-surface behaviors | Native UAT: place reference, paint, save script, run "Reveal with script…", verify rail lands baked |
| Track rail-creation flow (kind `reveal` → picker → create + bake) | RVL-01 | Track rail-creation entry point is a UI-surface behavior | Native UAT: place reference, create a reveal rail from the track flow, verify rail lands baked |
| Fail-closed capsule warnings (missing reference / deleted script) | RVL-05 | Status-capsule surface is visual | Native UAT: remove reference after creation, Replay → red warning capsule, keys untouched |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
