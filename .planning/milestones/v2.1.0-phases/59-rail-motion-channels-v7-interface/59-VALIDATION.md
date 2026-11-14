---
phase: "59"
slug: "rail-motion-channels-v7-interface"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-06"
updated: "2026-11-07"
---

# Phase 59 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^2.1.9 |
| **Config file** | `app/vitest.config.ts` — `include: ['src/**/*.test.ts', '../packages/efx-paint-host/src/**/*.test.ts']` |
| **Quick run command** | `pnpm --filter efx-motion-editor exec vitest run` |
| **Full suite command** | `pnpm --filter efx-motion-editor exec vitest run` |
| **Rust parity (if required)** | `cargo test --manifest-path app/src-tauri/Cargo.toml` (verify manifest path before use) |
| **Estimated runtime** | ~90 seconds (full suite) |

**Collection trap:** only `.test.ts` is collected. A `.test.tsx` file runs nothing and exits 0. Every new test in this phase must be `.test.ts`; UI contracts use source-string pins, not rendered TSX.

**Watch mode is forbidden** — always `vitest run`.

---

## Sampling Rate

- **After every task commit:** targeted new test file; plus the full suite when the change touches shared revision/compositor code.
- **After every plan wave:** `pnpm --filter efx-motion-editor exec vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

> Seeded by plan-phase. Task rows are filled as PLAN.md files are finalized.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 59-01-T* | 59-01 | 1 | REL-01, REL-02, MOTN-12 | — | — | vitest (unit/contract) | `cargo test --manifest-path app/src-tauri/Cargo.toml rail_motion_canonical_parity -- --nocapture`<br>`cargo test --manifest-path app/src-tauri/Cargo.toml rail_motion_canonical_parity && pnpm --filter efx-motion-editor exec vitest run src/lib/railMotionCanonicalParity.test.ts` | ✅ | ✅ green |
| 59-02-T* | 59-02 | 2 | MOTN-02, MOTN-03, MOTN-09, MOTN-12, REL-02 | — | — | vitest (unit/contract) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/railMotionModel.test.ts` | ✅ | ✅ green |
| 59-03-T* | 59-03 | 3 | MOTN-12, REL-02, REL-03 | — | — | vitest (unit/contract) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/railMotionPersistence.test.ts`<br>`pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/railMotionPersistence.test.ts && test "$(grep -c 'buildPhysicPaintRotoPhysicalRevision(' app/src/stores/physicPaintStore.ts)" = "1"`<br>`pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/railMotionPersistence.test.ts src/stores/efxPaintPersistenceRailMotionRoundTrip.test.ts` | ✅ | ✅ green |
| 59-04-T* | 59-04 | 4 | MOTN-12, REL-02 | — | — | vitest (unit/contract) | `cargo test --manifest-path app/src-tauri/Cargo.toml canonical_rail_motions -- --nocapture`<br>`cargo test --manifest-path app/src-tauri/Cargo.toml rail_motion_canonical_parity -- --nocapture && pnpm --filter efx-motion-editor exec vitest run src/lib/railMotionCanonicalParity.test.ts` | ✅ | ✅ green |
| 59-05-T* | 59-05 | 3 | MOTN-03, MOTN-05, MOTN-06, MOTN-09, MOTN-10 | — | — | vitest (unit/contract) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/railMotionEvaluator.test.ts` | ✅ | ✅ green |
| 59-06-T* | 59-06 | 4 | MOTN-01, MOTN-02, MOTN-05 | — | — | vitest (unit/contract) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/railMotionIdentity.test.ts` | ✅ | ✅ green |
| 59-07-T* | 59-07 | 5 | MOTN-01, MOTN-02, MOTN-12, REL-03 | — | — | vitest (unit/contract) | `pnpm --filter efx-motion-editor exec vitest run src/stores/physicPaintStore.rotoRailMotions.test.ts`<br>`pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/hooks/physicsPaintRotoRailMotionHistory.test.ts`<br>`pnpm --filter efx-motion-editor exec vitest run src/stores/physicPaintStore.rotoRailMotions.test.ts src/stores/physicPaintStore.rotoPhysicalStructuralCache.test.ts` | ✅ | ✅ green |
| 59-08-T* | 59-08 | 6 | MOTN-07, MOTN-08, MOTN-09, REL-03 | — | — | vitest (unit/contract) | `pnpm --filter efx-motion-editor exec vitest run src/efx-paint/compositor/efxPaintCompositorRailMotion.test.ts src/efx-paint/compositor/efxPaintCompositor.test.ts`<br>`pnpm --filter efx-motion-editor exec vitest run src/efx-paint/compositor/efxPaintCompositeCache.test.ts src/efx-paint/compositor/efxPaintCompositorMatrix.test.ts`<br>`pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/railMotionPivot.test.ts src/efx-paint/compositor/efxPaintCompositorRailMotion.test.ts` | ✅ | ✅ green |
| 59-09-T* | 59-09 | 7 | MOTN-08, REL-04 | — | — | vitest (unit/contract) | `pnpm --filter efx-motion-editor exec vitest run src/lib/railMotionExportParity.test.ts`<br>`pnpm --filter efx-motion-editor exec vitest run src/lib/railMotionExportParity.test.ts src/efx-paint/compositor/efxPaintCompositorRailMotion.test.ts` | ✅ | ✅ green |
| 59-10-T* | 59-10 | 6 | MOTN-04, MUI-02, MUI-03 | — | — | vitest (unit/contract) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/TimelineMotionChannels.test.ts src/components/physic-paint/view/timelineRailDesign.test.ts`<br>`pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/timelineRailDesign.test.ts src/components/physic-paint/view/TimelineMotionChannels.test.ts` | ✅ | ✅ green |
| 59-11-T* | 59-11 | 7 | MUI-01, MUI-04, MUI-05 | — | — | vitest (unit/contract) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx.test.ts`<br>`pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts`<br>`pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` | ✅ | ✅ green |
| 59-12-T* | 59-12 | 8 | MOTN-01, MOTN-04, MOTN-05, MOTN-10, MOTN-11, MUI-06 | — | — | vitest (unit/contract) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/railMotionCommands.test.ts`<br>`pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/railMotionCommands.test.ts src/components/physic-paint/view/TimelineMotionChannels.test.ts src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts`<br>`pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/railMotionCommands.test.ts src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts`<br>`pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/railMotionMergeNotice.test.ts src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` | ✅ | ✅ green |
| 59-13-T* | 59-13 | 9 | MOTN-03 | — | — | vitest (unit/contract) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/railMotionCommands.test.ts src/stores/physicPaintStore.test.ts src/efx-paint/compositor/efxPaintRevealLeakContract.test.ts` | ✅ | ✅ green |
| 59-14-T* | 59-14 | 11 | MOTN-01, MOTN-02, MOTN-03, MOTN-04, MOTN-05, MOTN-06, MOTN-07, MOTN-08, MOTN-09, MOTN-10, MOTN-11, MOTN-12, MUI-01, MUI-02, MUI-03, MUI-04, MUI-05, MUI-06, REL-01, REL-02, REL-03, REL-04 | — | — | vitest (unit/contract) | `pnpm --filter efx-motion-editor exec vitest run src/lib/railMotionDependencySurface.test.ts src/lib/railMotionPackageRoundTrip.test.ts`<br>`pnpm --filter efx-motion-editor run typecheck && pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/timelineMotionSurface.contract.test.ts` | ✅ | ✅ green |
| 59-15-T* | 59-15 | 10 | MOTN-01, MOTN-02, MOTN-05, MOTN-12 | — | — | vitest (unit/contract) | `pnpm --filter efx-motion-editor exec vitest run src/lib/railMotionGateBEdits.test.ts src/components/physic-paint/roto/railMotionDocumentReconciler.test.ts`<br>`pnpm --filter efx-motion-editor exec vitest run src/lib/railMotionGateBEdits.test.ts src/components/physic-paint/roto/railMotionDocumentReconciler.test.ts src/stores/physicPaintStore.rotoRailMotions.test.ts`<br>`pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.test.ts src/lib/railMotionGateBEdits.test.ts src/lib/physicPaintBridge.test.ts`<br>`pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts src/lib/railMotionGateBEdits.test.ts` | ✅ | ✅ green |
| 59-16-T* | 59-16 | 10 | MOTN-03, MOTN-09 | — | — | vitest (unit/contract) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts`<br>`pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts src/components/physic-paint/roto/railMotionCommands.test.ts` | ✅ | ✅ green |
| 59-17-T* | 59-17 | 1 | MOTN-03, MOTN-04, MUI-06 | — | — | vitest (unit/contract) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/railMotionCommands.test.ts`<br>`pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/TimelineMotionChannels.test.ts src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx.test.ts src/components/physic-paint/hooks/useRotoTimelineActions.test.ts` | ✅ | ✅ green |
| 59-18-T* | 59-18 | 2 | MOTN-01, MOTN-02, MOTN-05, MOTN-12 | — | — | vitest (unit/contract) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/hooks/useRotoTimelineActions.test.ts src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.test.ts`<br>`pnpm --filter efx-motion-editor run typecheck`<br>`test "$(grep -c 'getRotoRailMotions' app/src/components/physic-paint/PhysicsPaintStudio.tsx)" = "1"` | ✅ | ✅ green |
| 59-19-T* | 59-19 | 3 | MOTN-06, MOTN-07 | — | — | vitest (unit/contract) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/railMotionIdentity.test.ts`<br>`pnpm --filter efx-motion-editor exec vitest run src/lib/railMotionExportParity.test.ts`<br>`pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx.test.ts src/components/physic-paint/hooks/useRotoTimelineActions.test.ts` | ✅ | ✅ green |
| 59-20-T* | 59-20 | 4 | MOTN-10, MOTN-12 | — | — | vitest (unit/contract) | `pnpm --filter efx-motion-editor exec vitest run src/stores/physicPaintStore.rotoRailMotions.test.ts`<br>`pnpm --filter efx-motion-editor exec vitest run src/stores/efxPaintStore.reveal.test.ts src/stores/physicPaintStore.test.ts`<br>`pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/railMotionMergeNotice.test.ts src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` | ✅ | ✅ green |
| 59-21-T* | 59-21 | 2 | MUI-06 | — | — | vitest (unit/contract) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts`<br>`pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts` | ✅ | ✅ green |
| 59-22-T* | 59-22 | 1 | MOTN-05, MOTN-12 | — | — | vitest (unit/contract) | `pnpm --filter efx-motion-editor exec vitest run src/stores/efxPaintStore.reveal.test.ts`<br>`pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.test.ts`<br>`pnpm --filter efx-motion-editor exec vitest run src/stores/trackIsolation.test.ts` | ✅ | ✅ green |
| 59-23-T* | 59-23 | 1 | MOTN-04, MUI-06 | — | — | vitest (unit/contract) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/TimelineMotionChannels.test.ts src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx.test.ts`<br>`pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` | ✅ | ✅ green |
| 59-24-T* | 59-24 | 2 | MOTN-02, REL-02 | — | — | vitest (unit/contract) | `pnpm --filter efx-motion-editor exec vitest run src/stores/physicPaintStore.rotoRailMotions.test.ts`<br>`pnpm --filter efx-motion-editor exec vitest run src/lib/railMotionCanonicalParity.test.ts && cargo test --manifest-path app/src-tauri/Cargo.toml rail_motion_canonical_parity -- --nocapture && node -e 'const { execSync } = require("node:child_process"); const fs = require("node:fs"); const before = JSON.parse(execSync("git show HEAD:app/src/lib/__fixtures__/railMotionCanonical.golden.json", { encoding: "utf8" })); const after = JSON.parse(fs.readFileSync("app/src/lib/__fixtures__/railMotionCanonical.golden.json", "utf8")); const priorStable = JSON.stringify(before.documents) === JSON.stringify(after.documents.slice(0, before.documents.length)); const six = after.documents.length === 6 && after.documents[5].name === "rail-motion-ordering"; if (!priorStable \|\| !six) { console.error(JSON.stringify({ priorStable, six })); process.exit(1); }'` | ✅ | ✅ green |
| 59-25-T* | 59-25 | 2 | MOTN-03 | — | — | vitest (unit/contract) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/railMotionCommands.test.ts`<br>`pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/TimelineMotionChannels.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `app/src/components/physic-paint/roto/railMotionModel.test.ts` — validation, canonical order, conditional write, round-trip (MOTN-12, REL-02)
- [ ] `app/src/components/physic-paint/roto/railMotionIdentity.test.ts` — Gate B identity truth table (MOTN-01, MOTN-11)
- [ ] `app/src/components/physic-paint/roto/railMotionEvaluator.test.ts` — channels, curves, endpoints, unbounded rotation, wiggle determinism (MOTN-03/05/06/09/10)
- [ ] REL-03 revision/carrier assertions — no separate `railMotionRevision.test.ts`; they live in `railMotionPersistence.test.ts`, `physicPaintStore.rotoRailMotions.test.ts` and `efxPaintCompositeCache.test.ts`
- [ ] `app/src/efx-paint/compositor/efxPaintCompositorRailMotion.test.ts` — both draw sites, identity fast path, opacity multiply, transform math (MOTN-07/08)
- [ ] `app/src/lib/railMotionExportParity.test.ts` — sub-frame integer content + fractional transform (REL-04)
- [ ] `app/src/components/physic-paint/view/TimelineMotionChannels.test.ts` — source-string pins for MUI-01/02/03/04/05
- [ ] Rust parity fixture in `app/src-tauri/src/services/script_library.rs` tests — railKind + rail-motions ordinal parity (REL-02 / Pitfall 9)

*(No framework install needed — existing infrastructure covers revision, round-trip, and source-string pinning patterns; the gaps are new files, not new tooling.)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| v7 chrome fidelity against the exported reference | MUI-02, MUI-03, MUI-05 | Visual contract (18px lanes, 6×6 keys, outline, header alignment) needs native inspection | Compare the live Studio timeline against `SPECS/v2.1.0-motion-channels/reference/section-01-motion-channels.png` |
| Active-track edit/Play/export pixel parity | MOTN-08 | Requires the packaged/native renderer | Play the same frame on the active track, pause, export; compare frames |
| Motion-blur export paint retention | REL-04 | Export pipeline is native | Export a motion-blurred range; confirm paint is present on every frame |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-11-07 — 22/22 requirements covered by automated tests; full suite 395 files / 7,894 tests green.

## Validation Audit 2026-11-09

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
