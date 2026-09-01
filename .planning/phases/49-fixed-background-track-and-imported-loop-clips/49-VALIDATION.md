---
phase: "49"
slug: "fixed-background-track-and-imported-loop-clips"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-08-31"
validated: "2026-09-01"
---

# Phase 49 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | app/vitest.config.ts (existing) |
| **Quick run command** | `pnpm --filter efx-motion-editor exec vitest run {scope}` |
| **Full suite command** | `pnpm --filter efx-motion-editor exec vitest run && pnpm --dir app run typecheck` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter efx-motion-editor exec vitest run {task scope}`
- **After every plan wave:** Run `pnpm --filter efx-motion-editor exec vitest run && pnpm --dir app run typecheck`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 49-01-T1 | 49-01 | 1 | BKG-06, BKG-09 | unit (round-trip/rejection contract) | `pnpm --filter efx-motion-editor exec vitest run src/efx-paint/document/efxPaintBackgroundFallback.test.ts` | ✅ | ✅ green |
| 49-01-T2 | 49-01 | 1 | BKG-06 | unit | `pnpm --filter efx-motion-editor exec vitest run src/efx-paint/document/efxPaintBackgroundFallback.test.ts && pnpm --dir app run typecheck` | ✅ | ✅ green |
| 49-02-T1 | 49-02 | 1 | BKG-02 | unit | `pnpm --filter efx-motion-editor exec vitest run src/efx-paint/utils/naturalFilenameSort.test.ts` | ✅ | ✅ green |
| 49-02-T2 | 49-02 | 1 | BKG-03, BKG-04, BKG-05, BKG-07, BKG-08, BKG-09 | unit (collision truth table, repeat, recalc, linked sources, undo, idempotence) | `pnpm --filter efx-motion-editor exec vitest run src/stores/efxPaintStore.test.ts` | ✅ | ✅ green |
| 49-02-T3 | 49-02 | 1 | BKG-09 | unit (hydration: registers-all/missing/save-dedup) | `pnpm --filter efx-motion-editor exec vitest run src/stores/physicPaintStore.test.ts && pnpm --dir app run typecheck` | ✅ | ✅ green |
| 49-03-T1 | 49-03 | 2 | BKG-06, BKG-09 | unit (fond authority, cache fallback term) | `pnpm --filter efx-motion-editor exec vitest run src/stores/physicPaintStore.test.ts src/efx-paint/compositor/efxPaintCompositeCache.test.ts && pnpm --dir app run typecheck` | ✅ | ✅ green |
| 49-03-T2 | 49-03 | 2 | BKG-06 | unit (selector write-through/reflect/idempotent/photo-absent) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/engine/physicsPaintStudioSettings.test.ts` | ✅ | ✅ green |
| 49-03-T3 | 49-03 | 2 | BKG-06 | unit + source-level (checkerboard IFF no-fond, raster non-regression) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts && pnpm --filter efx-motion-editor exec vitest run && pnpm --dir app run typecheck` | ✅ | ✅ green |
| 49-04-T1 | 49-04 | 3 | BKG-01 | unit (bridge pair correlation/validation + capability delta) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/bridge/physicsPaintBridgeTransport.test.ts` | ✅ | ✅ green |
| 49-04-T2 | 49-04 | 3 | BKG-01, BKG-02 | unit (picker swap, engine identity, natural-sorted confirm) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/BackgroundAssetPickerView.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts` | ✅ | ✅ green |
| 49-04-T3 | 49-04 | 3 | BKG-01, BKG-02 | native (blocking checkpoint: dialog + cross-window library) | — (native UAT) | — | ✅ native UAT passed |
| 49-05-T1 | 49-05 | 4 | BKG-01, BKG-02, BKG-03 | unit (S1 Import control, Confirm-at-playhead, collision copy) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts` | ✅ | ✅ green |
| 49-05-T2 | 49-05 | 4 | BKG-03, BKG-05 | unit (row-local drag: commit-once, row-fixed, resolver-facts) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/hooks/usePhysicsPaintBackgroundClipDrag.test.ts && pnpm --filter efx-motion-editor exec vitest run && pnpm --dir app run typecheck` | ✅ | ✅ green |
| 49-06-T1 | 49-06 | 5 | BKG-04, BKG-07, BKG-08 | unit (section, ledger, keyboard, header blanking, missing-fill) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintBackgroundClipSection.test.ts src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts && pnpm --filter efx-motion-editor exec vitest run && pnpm --dir app run typecheck` | ✅ | ✅ green |
| 49-06-T2 | 49-06 | 5 | BKG-01..BKG-09 | native (blocking phase UAT, 8 parts, discharges 48 Bg-row deferral) | — (native UAT) | — | ✅ native UAT passed |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Full-suite gate (2026-09-01):** `pnpm --filter efx-motion-editor exec vitest run` → 172 files / 3216 tests passed, 0 failed (101 todo); `pnpm --dir app run typecheck` exits 0.

---

## Wave 0 Requirements

- [x] Existing infrastructure covers all phase requirements — no Wave 0 plan needed. Every BKG-01..BKG-09 reference was authored into a plan's must_haves truth and delivered with an automated verify.

---

## Manual-Only Verifications

Automated coverage is green for every BKG requirement (contract/unit suites). The rows below are the `human_judgment: true` aspects from the plan summaries — wire-level unit tests pass, but the rendered look / native interaction needs a real window. All rows were evidenced by the **Phase 49 native UAT (2026-09-01, 49-06 Task 2, 8 parts + interaction deltas)**, which also discharged the Background-row native UAT deferred from Phase 48.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Studio visual parity of background/gaps vs preview/export — fond authority + monitor checkerboard identity | BKG-06 | Native Tauri window visual check | UAT part 5: switch Transparent / White / Paper 1-3, confirm gaps, monitor fond, main preview, and PNG export agree per surface; Transparent + no covering clip shows the checkerboard in the monitor while the export keeps real transparency |
| Empty-state gap display + sequential rail layout (zero clips → fallback display across full range; long ranges clip at the viewport and return on scroll) | BKG-01 | Rendered look of the Bg row in a real window | UAT parts 1/5: open a project with no Bg clips — the row shows the fallback display; add several clips — rails render sequential, non-overlapping, ascending |
| Rail facts visual rendering — badge text (`Cycle {N}f × {R} = {T}f`), shortened treatment + tooltip, partial-cycle diagonal cut, ghost geometry | BKG-05 | Rendered badge/cut/tooltip need visual confirmation | UAT part 4: interrupt a loop and confirm `Loop shortened by next clip` + diagonal cut; move the interrupting clip away and confirm the badge returns to the requested value |
| Repeat control error/loading treatment — invalid input hint `Enter a positive integer.`, prior value stays visible | BKG-04 | Error/loading treatments are native visual surfaces | UAT part 2: set Repeat 3 on a 5-image clip → `Cycle 5f × 3 = 15f`; toggle ∞ → `× ∞`; type an invalid value → hint with prior value preserved |
| Delete interactions — dialog-free delete, Delete/Backspace timeline shortcut, Cmd/Ctrl+Z restore by reference, Cmd/Ctrl+Shift+Z re-delete | BKG-08 | Key interactions need a real window (user scoped undo/redo to delete only) | UAT part 6: delete a clip (sidebar trash or shortcut) — no dialog; undo restores by reference; redo re-deletes |
| Save/reopen hydration of the real runtime — source bytes resolve after reopen (no `Source missing` from a hydration gap) | BKG-09 | Native persistence only provable with the actual app | UAT part 7: save, close, reopen — every clip, source order, repeat, gap, and fallback survives and resolves with real image content |
| Missing-source slate fill + sidebar Bg-row selected treatment (orange, no normal track highlighted) | BKG-05 | Rendered fill color / selected state are native visual surfaces | UAT part 8 + deltas: remove a referenced library image, reopen → affected frames read as the slate fill, not transparent; select a Bg clip → Bg row header selected, normal tracks unhighlighted |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved — 2026-09-01 (full suite green, native UAT passed)

---

## Validation Audit 2026-09-01

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

**Notes:** State A audit of the plan-seeded draft. All 9 BKG requirements cross-reference to green automated suites (verified by `vitest run` 172 files / 3216 passed). The plan-summary `human_judgment: true` items are recorded as Manual-Only and were all evidenced by the approved Phase 49 native UAT.
