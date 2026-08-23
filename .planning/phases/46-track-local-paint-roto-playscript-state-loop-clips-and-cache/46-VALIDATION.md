---
phase: 46
slug: track-local-paint-roto-playscript-state-loop-clips-and-cache
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-23
---

# Phase 46 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (workspace) |
| **Config file** | root `vitest` workspace config |
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

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD-01 | 01 | 1 | TRK-01 | T-46-01 | Track-owned frames/keys never cross tracks | unit | `vitest run app/src/stores/physicPaintStore.test.ts` | ❌ W0 | ⬜ pending |
| TBD-02 | 01 | 1 | TRK-02 | — | Shared loop resolver reused for Hold clips (no second scheduler) | unit | `vitest run physicsPaintRotoLoopResolver.test.ts` (extended) | ✅ | ⬜ pending |
| TBD-03 | 01 | 1 | TRK-03 | T-46-02 | Per-track cache invalidation via embedded `trackId` | unit | `vitest run efxPaintTrackCache.test.ts` (new) | ❌ W0 | ⬜ pending |
| TBD-04 | 02 | 1 | TRK-04 | — | Track-aware copy/cut/paste/duplicate/clear/undo/redo targets exact internal track | unit | `vitest run physicsPaintRotoRailSetCopy.test.ts` + `useRotoPhysicalEditHistory.test.ts` (extended) | ✅ | ⬜ pending |
| TBD-05 | 02 | 1 | TRK-05 | T-46-03 | Async revalidate parent+document+track before commit; fail-closed on mismatch | unit | `physicPaintBridge.test.ts` (extended) | ❌ W0 | ⬜ pending |
| TBD-06 | 02 | 1 | TRK-06 | T-46-03 | One-track edits never touch another track's real keys or caches | unit | `trackIsolation.test.ts` (new) | ❌ W0 | ⬜ pending |
| TBD-07 | 03 | 2 | TRK-07 | T-46-04 | Acknowledge-delete removes track AND cached sidecars; last Paint track refused | unit | `rotoCacheTransactions.test.ts` (extended) + `trackDeleteLaws.test.ts` (new) | ✅ / ❌ W0 | ⬜ pending |
| TBD-08 | 03 | 2 | TRK-08 | — | Source-frame edit invalidates every linked Hold occurrence atomically; no asset duplication | unit | `physicsPaintRotoHoldDeterminism.test.ts` (extended) | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `app/src/stores/physicPaintStore.test.ts` — track re-key isolation (covers TRK-01/03)
- [ ] `app/src/efx-paint/document/efxPaintMultiTrackProjection.test.ts` — serialize/hydrate on multi-track documents (relaxed guard)
- [ ] `app/src/lib/physicPaintBridgeAuthority.test.ts` — D-19/D-20 revalidate stale on track switch
- [ ] `app/src/stores/trackDeleteLaws.test.ts` — D-14..D-17 deletion laws

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Acknowledge-delete dialog copy and flow (D-14) | TRK-07 | Native UI confirm; dialog copy must be plain and explicit per user lock | Delete a track with accepted caches; verify the dialog states the accepted-frame count; confirm removal; verify no orphan PNG sidecars remain on disk |
| Deleting the last Paint track is refused (D-17) | TRK-07 | Native UI message visibility | With one Paint track left, attempt delete; verify block message |
| Undo auto-activates the non-active target track (D-04) | TRK-04 | Visual selection behavior | Edit track A, switch to track B, undo; verify track A becomes active and the edit is reverted |
| Async work completes on the original captured track after a mid-flight switch (D-19) | TRK-05 | Timing-dependent behavior | Start a long PlayScript render on track A, switch to track B mid-flight; verify commit lands on track A only |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
