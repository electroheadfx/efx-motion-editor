---
phase: 47
slug: internal-multi-track-timeline-filmstrip-capsules-and-control
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| TBD | TBD | TBD | TML-01..TML-08 | T-47-01..T-47-03 / — | See threat model per plan | unit/integration | `vitest run` per file above | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*(Detailed per-task map filled during execution — Wave 0 fills the gaps below.)*

---

## Wave 0 Requirements

- [ ] `app/src/stores/efxPaintStore.test.ts` — track CRUD + hide/solo/opacity/blend store-op cases (add/rename/duplicate/reorder/set*), revision bumps, serialize/hydrate round-trip (TML-02/04/08). Existing file covers delete; the new ops need cases.
- [ ] `app/src/lib/previewRenderer.test.ts` (or nearest existing renderer test) — hide/solo truth-table filter cases for `resolvePhysicPaintFrameSource` (TML-04). Verify the exact existing test file name in Wave 0.
- [ ] Multi-row strip component tests — N rows + Bg row render, vertical scroll, pinned header, ensure-active-row-visible (TML-01/03).
- [ ] Cross-track drag gesture test — boundary-crossing → destination row highlight → `moveTrackItems` commit; rejection → status capsule publication (TML-05).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Hide/solo/opacity/blend immediately reflected in the Studio composite | TML-04 | Blend modes and composite look are visual — assert observable result in the live editor, not renderer internals | Set track opacity/blend in Studio; verify composite changes live; toggle hide/solo and verify visible rows + composite |
| Adaptive filmstrip capsule visuals (linked band, ×N/∞, shortened state) | TML-06 | Capsule is a visual contract (Phase 43 locked rail semantics) | Create Hold/Background Loop Clips; verify capsule badges, linked repetition band, ×N/∞, requested/effective duration, partial-cycle interruption per UI-SPEC |
| Track CRUD survives save/reopen (visual persistence) | TML-08 | Save/reopen is a live-app flow | Add/rename/duplicate/reorder tracks; save; reopen project; verify state preserved and identity stable |
| Cross-track drag never mutates another row accidentally | TML-05 | Interactive gesture behavior | Drag between rows; verify destination highlight, commit on release, rejection surfacing; verify no unselected row mutated |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
