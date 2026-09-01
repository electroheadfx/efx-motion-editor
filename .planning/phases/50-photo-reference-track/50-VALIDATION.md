---
phase: "50"
slug: "photo-reference-track"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-01"
---

# Phase 50 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | app/vitest.config.ts (resolved by `vitest run`) |
| **Quick run command** | `pnpm --filter efx-motion-editor exec vitest run` |
| **Full suite command** | `pnpm --filter efx-motion-editor exec vitest run && pnpm --dir app run typecheck` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter efx-motion-editor exec vitest run`
- **After every plan wave:** Run `pnpm --filter efx-motion-editor exec vitest run && pnpm --dir app run typecheck`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 50-01-01 | 01 | 1 | REF-01, REF-05 | T-50-01-01 / T-50-01-02 | exact-member fail-closed parse of the track; deterministic canonical revision term excluding display prefs | unit | `vitest run src/efx-paint/document/efxPaintDocumentParsers.test.ts` | ✅ | ✅ green |
| 50-01-02 | 01 | 1 | REF-01, REF-05 | T-50-01-01 / T-50-01-02 | mode-union edges, opacity/transform boundary validation, revision stability under field reorder | unit | `vitest run src/efx-paint/document && pnpm --dir app run typecheck` | ✅ | ✅ green |
| 50-02-01 | 02 | 2 | REF-02 | T-50-02-01 | library asset IDs only; source/mode mutations undoable by reference; display prefs no-undo no-revision-bump | unit | `vitest run src/stores/efxPaintStore.photoReference.test.ts` | ✅ | ✅ green |
| 50-02-02 | 02 | 2 | REF-04 | T-50-02-03 | fail-closed null on missing source + `:missing` revision suffix; frame-aligned clamp at sequence end | unit | `vitest run src/stores/efxPaintStore.photoReference.test.ts src/stores/physicPaintStore.test.ts` | ✅ | ✅ green |
| 50-02-03 | 02 | 2 | REF-03, REF-05 | T-50-02-02 | structural D-06 exclusion (byte-identical flattened output); idempotent serialize/hydrate | unit | `vitest run src/stores/efxPaintStore.photoReference.test.ts src/stores/physicPaintStore.test.ts && pnpm --dir app run typecheck` | ✅ | ✅ green |
| 50-03-01 | 03 | 3 | REF-01 | — | non-selectable Photo row; passive band/empty lane; eye toggle drives visibleInStudio | unit | `vitest run src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx` | ✅ | ✅ green |
| 50-03-02 | 03 | 3 | REF-01, REF-04 | T-50-03-01 / T-50-03-02 | natural filename sort before store call; library asset IDs only; replace-on-confirm one undoable op | unit | `vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx` | ✅ | ✅ green |
| 50-04-01 | 04 | 4 | REF-03 | T-50-04-01 / T-50-04-02 | monitor-paint-only ghost draw; fail-closed draw decision (null/hidden/playing/missing) | unit | `vitest run src/components/physic-paint/view/PhysicsPaintReferenceGhost.test.ts` | ✅ | ✅ green |
| 50-04-02 | 04 | 4 | REF-04 | T-50-04-01 / T-50-04-02 | missing-source capsule with red warning; ghost absent during playback; no compositor input | unit | `vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/view/PhysicsPaintReferenceGhost.test.ts` | ✅ | ✅ green |
| 50-05-01 | 05 | 5 | REF-02 | T-50-05-01 | mode switch one undoable mutation; flag-only (no compositor change) | unit | `vitest run src/components/physic-paint/view/PhysicsPaintPhotoReferenceDialog.test.ts` | ✅ | ✅ green |
| 50-05-02 | 05 | 5 | REF-03 | T-50-05-02 | transform writes display properties only; never layerStore/keyframeStore/compositor | unit | `vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/view/PhysicsPaintReferenceTransform.test.ts` | ✅ | ✅ green |
| 50-05-03 | 05 | 5 | REF-02 | T-50-05-01 / T-50-05-02 | Escape re-lock (one Escape per layer); section mount; flag-only mode | unit | `vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/view/PhysicsPaintPhotoReferenceDialog.test.ts && pnpm --dir app run typecheck` | ✅ | ✅ green |
| 50-06-01 | 06 | 6 | REF-05 | T-50-06-01 | round-trip preserves all seven track fields; idempotent serialize→hydrate→serialize | unit | `vitest run src/stores/efxPaintPersistenceMultiTrackRoundTrip.test.ts` | ✅ | ✅ green |
| 50-06-02 | 06 | 6 | REF-05 | T-50-06-02 | D-06 non-regression token scan over compositor/cache/preview/export; end-to-end wiring | unit + human | `vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts && pnpm --dir app run typecheck` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> **Note (UAT round-3 rename):** Plan 50-05's section test file `PhysicsPaintPhotoReferenceSection.test.ts` was renamed to `PhysicsPaintPhotoReferenceDialog.test.ts` in commit `400eb9d5` when the right-panel section was refactored into the movable Photo Reference dialog per the user's mockup. The 22-test contract suite (mode/opacity/lock/source-facts) lives there now.

---

## Wave 0 Requirements

- [x] Existing infrastructure covers all phase requirements (vitest + `app/vitest.config.ts` already present; zero packages installed this phase)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Native UAT — full user flow in the running app (import → Photo row band → ghost overlay → mode switch → opacity slider → transform with lock/Escape → save → reopen → everything restored; reference never appears in flattened output or export) | REF-05 | The automated contracts prove wiring and the persistence round-trip, but the actual visual/behavioral flow (ghost rendering, live opacity preview, canvas transform gestures, save/reopen in the packaged app) requires the user to run the app | 7 items in `50-UAT.md` — **passed 2026-09-01** (7/7, 4 issues fixed and re-validated) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-09-01

---

## Validation Audit 2026-09-01

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All 14 tasks across 6 plans have automated verification; all 5 requirements (REF-01..REF-05) are COVERED by passing contract suites (199 targeted tests green, full suite 3299 green, tsc clean). The only human-verification item is the native UAT, which passed 7/7 on 2026-09-01. No gaps — the phase is Nyquist-compliant.
