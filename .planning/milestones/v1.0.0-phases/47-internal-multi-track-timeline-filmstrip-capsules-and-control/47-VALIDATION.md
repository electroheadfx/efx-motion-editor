---
phase: 47
slug: internal-multi-track-timeline-filmstrip-capsules-and-control
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-24
---

# Phase 47 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^2.1.9 |
| **Config file** | `app/vite.config.*` (project test setup — reuse existing; no one-off configs) |
| **Quick run command** | `pnpm --filter efx-motion-editor exec vitest run app/src/stores/efxPaintStore.test.ts` (store-op wave) |
| **Full suite command** | `pnpm --filter efx-motion-editor exec vitest run` |
| **Estimated runtime** | ~60-120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter efx-motion-editor exec vitest run <affected test file> -t <case>`
- **After every plan wave:** Run `pnpm --filter efx-motion-editor exec vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TML-01 | 47-01/47-02 | 1/2 | Multi-row scrollable Paint timeline with internal track rows | T-47-01 | Every InternalPaintTrack renders as a row + exactly one Bg row; vertical pill scrollbar on overflow | unit | `pnpm vitest run src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts` | ✅ | ✅ green |
| TML-02 | 47-01/47-02/47-03 | 1/2 | Add/rename/duplicate/delete/reorder tracks | T-47-01/T-47-02 | Fail-closed CRUD store ops + UI (rename/duplicate/delete dialog/reorder) + guarded shortcuts | unit | `pnpm vitest run src/stores/efxPaintStore.test.ts src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts src/stores/trackDeleteLaws.test.ts` | ✅ | ✅ green |
| TML-03 | 47-01/47-02 | 1/2 | Active track selectable + visually unambiguous | T-47-01 | Active accent class moves on switch; ensure-active-row auto-scroll | unit | `pnpm vitest run src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts` | ✅ | ✅ green |
| TML-04 | 47-01/47-03 | 1/2 | Hide/solo tracks + per-track opacity/blend | T-47-03 | Setters fail-closed + per-track revision; right-panel opacity slider + 5-option blend select; hide/solo toggles | unit | `pnpm vitest run src/stores/efxPaintStore.test.ts src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts` | ✅ | ✅ green |
| TML-05 | 47-01/47-02/47-05 | 1/2/4 | Frame keys/caches on correct row; cross-track drag routes to destination; rejections surface | T-47-04/T-47-05 | Per-row reads never leak; cross-track gesture read-only until release; moveTrackItems commit + English rejection publication | unit | `pnpm vitest run src/components/physic-paint/hooks/usePhysicsPaintCrossTrackDrag.test.ts src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx` | ✅ | ✅ green |
| TML-06 | 47-04 | 3 | Hold Loop Clips as adaptive filmstrip capsules | T-47-04 | REMOVED by user demand (commit 346d47bc). Surviving loop-facts presentation (cycle label, effective duration, shortened state) feeds the rail tooltip | unit | `pnpm vitest run src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx` | ✅ | ✅ green |
| TML-07 | 47-02/47-04 | 2/3 | Fixed Background row beneath Paint rows | T-47-02-04 | Bg row locked/muted/last, no hover/duplicate/delete/grab; exactly one Bg row | unit | `pnpm vitest run src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts` | ✅ | ✅ green |
| TML-08 | 47-01 | 1 | Track CRUD survives save/reopen; reorder changes compositor order not identity | T-47-01 | serialize/hydrate round-trip preserves N tracks/order/ids; reorder writes order field only; real saveProject persists added track | unit/integration | `pnpm vitest run src/stores/efxPaintStore.test.ts src/stores/efxPaintPersistenceMultiTrackRoundTrip.test.ts src/stores/projectSaveMultiTrack.test.ts src/lib/efxPaintPersistence.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*(Detailed per-task map filled during execution — Wave 0 fills the gaps below.)*

---

## Wave 0 Requirements

- [x] `app/src/stores/efxPaintStore.test.ts` — track CRUD + hide/solo/opacity/blend store-op cases (add/rename/duplicate/reorder/set*), revision bumps, serialize/hydrate round-trip (TML-02/04/08). 27 tests, all green.
- [x] `app/src/lib/previewRenderer.test.ts` — hide/solo truth-table filter cases for `resolvePhysicPaintFrameSource` (TML-04). Green.
- [x] Multi-row strip component tests — N rows + Bg row render, vertical scroll, pinned header, ensure-active-row-visible (TML-01/03). `physicsPaintTrackHeaderColumn.test.ts` (18 tests) + `PhysicsPaintWorkflowStrip.viewport.test.ts` (27 tests), all green.
- [x] Cross-track drag gesture test — boundary-crossing → destination row highlight → `moveTrackItems` commit; rejection → status capsule publication (TML-05). `usePhysicsPaintCrossTrackDrag.test.ts` (18 tests) + `PhysicsPaintWorkflowStrip.test.ts` (130 tests), all green.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Hide/solo/opacity/blend immediately reflected in the Studio composite | TML-04 | Blend modes and composite look are visual — assert observable result in the live editor, not renderer internals | Set track opacity/blend in Studio; verify composite changes live; toggle hide/solo and verify visible rows + composite |
| Filmstrip capsule visuals (linked band, ×N/∞, shortened state) | TML-06 | REMOVED by user demand in UAT Round 6 (commit 346d47bc) — the capsule rendering layer is gone; the surviving loop-facts presentation is automated-tested and feeds the rail tooltip | N/A — feature removed; loop facts verified in the rail tooltip |
| Track CRUD survives save/reopen (visual persistence) | TML-08 | Save/reopen is a live-app flow | Add/rename/duplicate/reorder tracks; save; reopen project; verify state preserved and identity stable |
| Cross-track drag never mutates another row accidentally | TML-05 | Interactive gesture behavior | Drag between rows; verify destination highlight, commit on release, rejection surfacing; verify no unselected row mutated |

*If none: "All phase behaviors have automated verification."*

---

## Validation Audit 2026-08-27

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All 8 requirements (TML-01..TML-08) verified COVERED by passing behavioral tests (452 tests across the 15 candidate files, full suite 2940 green). TML-06 capsule rendering confirmed removed (commit 346d47bc); the surviving loop-facts presentation is tested. No new test files required.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-08-27
