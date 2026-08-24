---
phase: 46
slug: track-local-paint-roto-playscript-state-loop-clips-and-cache
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-23
updated: 2026-08-24
---

# Phase 46 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (workspace) |
| **Config file** | root `vitest` workspace config (`app/vitest.config.ts`) |
| **Quick run command** | `pnpm --filter efx-motion-editor exec vitest run <file>` |
| **Full suite command** | `pnpm --filter efx-motion-editor exec vitest run` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter efx-motion-editor exec vitest run <targeted-file>`
- **After every plan wave:** Run `pnpm --filter efx-motion-editor exec vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Reference | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 46-01-T1..T3 | 01 | 1 | TRK-01, TRK-03 | T-46-01..T-46-05 | Re-key runtime maps to `layerId→trackId`; per-track signal map + `bumpTrackRevision`; track-owned frames/keys never cross tracks; per-track cache invalidation | unit | `vitest run src/stores/trackIsolation.test.ts src/stores/physicPaintStore.test.ts src/stores/physicPaintStore.rotoPhysicalStructuralCache.test.ts` | ✅ | ✅ green |
| 46-02-T1..T3 | 02 | 2 | TRK-01, TRK-03 | T-46-06 | Relax `efxPaintStore` single-track guards; `buildEfxPaintFrameCachePath(layerId, trackId, frame)`; per-track save/load carriers; drop cross-track same-appFrame throw | unit | `vitest run src/efx-paint/document/efxPaintMultiTrackProjection.test.ts src/lib/efxPaintPersistence.test.ts src/stores/projectStore.efxPaintCutover.test.ts src/stores/efxPaintStore.test.ts` | ✅ | ✅ green |
| 46-03-T1..T3 | 03 | 3 | TRK-04 | T-46-07..T-46-10 | Track-scoped copy/cut/paste/duplicate/clear with fresh identities + fail-closed Hold re-pointing; unified track-tagged undo/redo with auto-activation | unit | `vitest run src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.test.ts src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts src/stores/trackIsolation.test.ts` | ✅ | ✅ green |
| 46-04-T1..T3 | 04 | 4 | TRK-05, TRK-06 | T-46-11..T-46-13 | Three-dim authority (trackId + trackRevision + documentRevision); capture-then-revalidate; stale async never writes to another selected track | unit | `vitest run src/lib/physicPaintBridgeAuthority.test.ts src/lib/physicPaintBridge.test.ts src/stores/trackIsolation.test.ts` | ✅ | ✅ green |
| 46-05-T1..T3 | 05 | 5 | TRK-07 | T-46-14..T-46-16 | Acknowledge-delete removes track AND cached sidecars transactionally; last Paint track refused; nearest-adjacent activation | unit | `vitest run src/stores/trackDeleteLaws.test.ts src/lib/efxPaintPersistence.test.ts src/stores/trackIsolation.test.ts` | ✅ | ✅ green |
| 46-06-T1..T3 | 06 | 6 | TRK-02, TRK-08 | T-46-17..T-46-18 | Track-local Hold ownership via shared resolver (do-not-fork); live single-source; source-frame edit invalidates every linked occurrence w/o duplication | unit | `vitest run src/stores/efxPaintTrackCache.test.ts src/stores/trackIsolation.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `app/src/stores/physicPaintStore.test.ts` + `app/src/stores/trackIsolation.test.ts` — track re-key isolation (covers TRK-01/03)
- [x] `app/src/efx-paint/document/efxPaintMultiTrackProjection.test.ts` — serialize/hydrate on multi-track documents (relaxed guard)
- [x] `app/src/lib/physicPaintBridgeAuthority.test.ts` — D-19/D-20 revalidate stale on track switch
- [x] `app/src/stores/trackDeleteLaws.test.ts` — D-14..D-17 deletion laws

*All Wave 0 files exist and pass green (347 targeted tests, 1 skipped).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Acknowledge-delete dialog copy and flow (D-14) | TRK-07 | Native UI confirm; dialog copy must be plain and explicit per user lock | Delete a track with accepted caches; verify the dialog states the accepted-frame count; confirm removal; verify no orphan PNG sidecars remain on disk |
| Deleting the last Paint track is refused (D-17) | TRK-07 | Native UI message visibility | With one Paint track left, attempt delete; verify block message |
| Undo auto-activates the non-active target track (D-04) | TRK-04 | Visual selection behavior | Edit track A, switch to track B, undo; verify track A becomes active and the edit is reverted |
| Async work completes on the original captured track after a mid-flight switch (D-19) | TRK-05 | Timing-dependent behavior | Start a long PlayScript render on track A, switch to track B mid-flight; verify the commit lands on track A only |
| Operation-matrix UAT — same-track and cross-track (copy/cut/paste/duplicate/clear/undo/redo) | TRK-04 | Interactive multi-track surface; unit tests cannot judge the running Studio UX | Exercise the full operation matrix across two tracks in the running Studio; verify exact-track targeting and the auto-activation visual (cross-track half blocked until Phase 47 track CRUD) |
| Track-local Hold surface (source edit → linked cells update in place; source delete → placeholders; empty/foreign refs rejected in the timeline UI) | TRK-02, TRK-08 | Interactive timeline behavior | Edit a Hold source frame and verify every linked occurrence updates; delete a source and verify unresolved placeholder cells; verify the clip editor rejects empty/foreign refs |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-24
