---
phase: "62"
slug: "painted-stroke-curve-editing"
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-14"
---

# Phase 62 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.1.9 (monorepo: `efx-motion-editor` app + `@efxlab/efx-watercolor` package) |
| **Config file** | `app/vitest.config.ts` (existing — no Wave 0 install) |
| **Quick run command** | `pnpm --filter efx-motion-editor exec vitest run <suite paths>` |
| **Full suite command** | `pnpm --filter efx-motion-editor exec vitest run` |
| **Estimated runtime** | ~17 s (full suite, 9202 tests) |

---

## Sampling Rate

- **After every task commit:** Run the plan's per-task suite command
- **After every plan wave:** Run the full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~20 s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 62-01-01 | 01 | 1 | CRV-01 | T-62-01 | Conversion writes anchors + spine in one revision, one undo restores hand samples | unit | `vitest run src/components/physic-paint/view/aquarelleRecordState.path.test.ts` | ✅ | ✅ green |
| 62-01-02 | 01 | 1 | CRV-01 | — | Fit is curvature-adaptive, capped, deterministic, anchors land on recorded samples | unit | `vitest run src/components/physic-paint/view/vectorPathFit.test.ts` | ✅ | ✅ green |
| 62-01-03 | 01 | 1 | CRV-02 | — | Edits preserve sample count and remap pressure by arc length | unit | `vitest run src/components/physic-paint/view/vectorPathHandles.test.ts src/components/physic-paint/view/aquarelleRecordState.path.test.ts` | ✅ | ✅ green |
| 62-02-01 | 02 | 2 | CRV-01 | — | Brush/Water/Pen enter; Lift and degenerate strokes refused with named copy | unit | `vitest run src/components/physic-paint/view/strokeSettingsModel.test.ts` | ✅ | ✅ green |
| 62-02-02 | 02 | 2 | CRV-01 | — | Entry fits lazily; the ONE writer seam admits the painted stroke | unit | `vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/view/strokeSettingsModel.test.ts` | ✅ | ✅ green |
| 62-02-03 | 02 | 2 | CRV-01 | — | Every exit routes through `exitPathEdit`; bracket restores wireframe/Draft once | unit | `vitest run src/components/physic-paint/view/vectorPathSession.test.ts src/components/physic-paint/view/vectorPathCurveBracket.test.ts` | ✅ | ✅ green |
| 62-03-01 | 03 | 2 | CRV-01 | — | Armed held fit makes an anchorless stroke drawable/editable in the ONE overlay | unit | `vitest run src/components/physic-paint/engine/VectorPathOverlay.test.ts` | ✅ | ✅ green |
| 62-03-02 | 03 | 2 | CRV-01 | — | Ghost of the recorded spine draws beneath and never enters the document | unit | `vitest run src/components/physic-paint/engine/VectorPathOverlay.test.ts` | ✅ | ✅ green |
| 62-03-03 | 03 | 2 | CRV-01 | — | Construction-view envelope is the recorded pressure band; mouse `-1` sentinel keeps anchor width (D-09) | unit | `vitest run src/components/physic-paint/view/aquarelleStrokeBand.test.ts` | ✅ | ✅ green |
| 62-04-01 | 04 | 3 | CRV-02 | T-62-13 | A cancelled apply publishes nothing — neither terminal, no ledger, no capsule | unit | `vitest run src/components/physic-paint/view/aquarelleVectorPathCommit.test.ts` | ✅ | ✅ green |
| 62-04-02 | 04 | 3 | CRV-04 | T-62-13 | Pending-apply epoch is token-keyed; ONE exit-hook registration re-registers on identity change | unit | `vitest run src/components/physic-paint/view/aquarelleVectorPathCommit.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts` | ✅ | ✅ green |
| 62-04-03 | 04 | 3 | CRV-04 | T-62-13 | Undo addresses the exact editId; stale token never cancels a newer bake | unit | `vitest run src/components/physic-paint/view/vectorPathSession.test.ts` | ✅ | ✅ green |
| 62-05-01 | 05 | 2 | CRV-03 | — | Every real cache key built by ONE source-scoped builder, byte-identical | unit | `vitest run src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.test.ts src/components/physic-paint/roto/rotoPhysicalOwnership.test.ts` | ✅ | ✅ green |
| 62-05-02 | 05 | 2 | CRV-03 | — | Loop adjacency, shared ordering and empty-frame identity pinned; no materialization | unit | `vitest run src/stores/physicPaintStore.rotoLoopClips.test.ts src/components/physic-paint/roto/physicsPaintRotoLoopResolver.test.ts` | ✅ | ✅ green |
| 62-05-03 | 05 | 2 | CRV-03 | — | Occurrence frames list no editable stroke row; curve entrance is source-only | unit | `vitest run src/components/physic-paint/view/aquarelleStrokeSelection.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `app/vitest.config.ts` — existing framework config (vitest 2.1.9)
- [x] Per-suite fixtures already exist beside each module
- [x] No framework install required

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 62-01 rows A–D: fitted anchors sit on the paint with no visible deviation; one anchor edit re-renders at an identical wet lifetime; undo/redo restore the wash; lift-erased regions and grain survive the re-bake | CRV-01, CRV-02 | Requires painting live and visually judging wash shape, wet lifetime, texture and erased-region survival | Paint a Brush stroke, open curve mode, drag an anchor, undo/redo, inspect the wash and erased regions |
| 62-02 row A: one painted Brush stroke lights up the spline-pointer and entry shows the fitted wireframe | CRV-01 | Visual affordance judgement on a real canvas | Select a painted stroke and press the spline-pointer; confirm the fitted wireframe appears |
| 62-02/62-04 row C: every exit restores the pre-entry wireframe and Draft in-app | CRV-01 | Restore half only observable once 62-04 T2 registers the exit hook | Enter curve mode, change wireframe/Draft, exit via dialog close, Escape, rail toggle, pen and colour picker |
| 62-03 rows A–D: fitted path over the paint with the ghost beneath; live drag with a frozen ghost and no wash re-render; real pen taper vs the mouse exception; clean exit vanishes the chrome | CRV-01 | Rendered-result judgement | Enter curve mode on a pen-painted stroke; drag an anchor; compare the construction-view band against a mouse-painted stroke |
| 62-04 rows A–D: cancelled undo restores the pre-edit shape with no new ledger entry and a second undo reaches the previous edit; deferred-settle undo consumes exactly one step; Cmd+Shift+Z does not resurrect; the veil is gone and the next drag commits normally | CRV-02, CRV-04 | In-flight timing is only observable in the packaged editor | Press Cmd+Z while the bake veil is up; press again; then Cmd+Shift+Z; confirm the next drag commits |
| 62-05 rows E–G: one source conversion repaints every occurrence in one gesture release; one undo restores every occurrence; occurrence frames expose no selectable stroke row and the curve entrance stays disabled | CRV-03 | Visual/runtime judgement on the packaged editor (stale pixels, doubled paint) | Convert a stroke on its source frame inside a Loop Clip; step through occurrence frames; undo once |

*Automated coverage is complete for all four requirements; these rows are human visual acceptance, tracked in `62-UAT.md`.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 20 s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-11-14

---

## Validation Audit 2026-11-14

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
