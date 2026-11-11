---
phase: "61"
slug: "vector-painting-tool"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-10"
---

# Phase 61 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^2.1.9` |
| **Config file** | `app/vitest.config.ts` — `include: ['src/**/*.test.ts', '../packages/efx-paint-host/src/**/*.test.ts']` |
| **Quick run command** | `pnpm --filter efx-motion-editor exec vitest run <path>` |
| **Full suite command** | `pnpm --filter efx-motion-editor exec vitest run` |
| **Engine package suite** | `pnpm --filter @efxlab/efx-watercolor exec vitest run` |
| **Estimated runtime** | app suite ~2–4 min; single file < 15 s |

**Never `pnpm test`** — `app/package.json:11` defines it as bare `vitest` (watch mode), which `CLAUDE.md` forbids.
**Vitest collects only `*.test.ts`** — a `.test.tsx` target exits 0 while running nothing; the tree's workaround is `Foo.test.tsx.test.ts`.

---

## Sampling Rate

- **After every task commit:** the single test file touched (`vitest run <path>`)
- **After every plan wave:** `vitest run` for the affected package(s) — app and/or `@efxlab/efx-watercolor`
- **Before `/gsd-verify-work`:** full `vitest run` (app) + `@efxlab/efx-watercolor` suite green, plus the Wave 0 probe result JSON committed as evidence
- **Max feedback latency:** ~15 s per task, ~4 min per wave

---

## Per-Task Verification Map

The planner fills the Task ID / Plan / Wave / Threat Ref columns. The requirement→test mapping is fixed by research and must not be re-derived:

| Requirement | Behavior | Test Type | Automated Command | File Exists |
|---|---|---|---|---|
| VEC-01 | Spine passes through its anchors; Alt places a corner | unit | `pnpm --filter @efxlab/efx-watercolor exec vitest run src/vector/spine.test.ts` | ✅ 61-02 (33 tests) |
| VEC-01 | Ribbon tool appears in the rail as a 5th, visually separated entry with `aria-pressed` | vnode harness | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintToolRail.test.ts` | ✅ 61-08 |
| VEC-02 | Anchor/handle hit-test priority over strokes; 8 px pad at any zoom | unit | `… vitest run src/components/physic-paint/view/scriptStrokeTransform.test.ts` | ✅ extended 61-09 |
| VEC-02 | Insert/delete change the anchor list and the spine in one commit | unit | `… vitest run src/components/physic-paint/engine/VectorPathOverlay.test.ts` | ✅ 61-10 (`commits ONCE`, `ONE commit`) |
| VEC-03 | Sparse width: absent factor interpolates; uniform stroke stores nothing | unit | `pnpm --filter @efxlab/efx-watercolor exec vitest run src/payload/toStudioStroke.test.ts` | ✅ 61-03 / 61-04 |
| VEC-04 | Brush id + colour are stroke-level; no per-vertex fields exist in the payload type | source/type pin | `… vitest run src/components/physic-paint/view/strokeSettingsModel.test.ts` + AQTL field pin | ✅ 61-03 / 61-12 |
| VEC-05 | Wireframe on ⇒ no capture, no reset, no rebake, no cross-realm persist | source-contract | `… vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts` | ✅ 61-13 |
| VEC-05 | Toggle is not in `.mce`, the revision, any cache key, or export | source-contract | `… vitest run src/efx-paint/compositor/vectorStrokeExportParity.test.ts` + `efxPaintCompositeCache.test.ts` | ✅ 61-14 |
| VEC-06 | AQTL encode→decode round-trips anchors, kinds, sparse widths, `renderMode` | unit | `… vitest run src/components/physic-paint/performance/scriptTimelineCodec.test.ts` | ✅ 61-05 |
| VEC-06 | Reopen: encode→decode→replay produces identical bytes | integration (headless engine) | `pnpm --filter @efxlab/efx-watercolor exec vitest run src/determinismContract.test.ts` | ✅ 61-05 / 61-14 |
| VEC-06 | New fields declared in BOTH TS and Rust | field-diff | `… vitest run src/lib/mceFieldContract.test.ts` | ✅ 61-06 |
| VEC-07 | Each operation is exactly one undo entry | unit | `… vitest run src/components/physic-paint/engine/VectorPathOverlay.test.ts` | ✅ 61-10 / 61-11 / 61-12 |
| All | Determinism: same script ⇒ same pixels, twice, per mode | contract | `pnpm --filter @efxlab/efx-watercolor exec vitest run src/determinismContract.test.ts` | ✅ 61-07 |
| All | No unseeded RNG in the new module | static scan | same file — widened to cover `src/vector` | ✅ 61-02 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Gap-closure wave (61-21 … 61-31), audited 2026-11-11

| Requirement | Behavior | Plan | Automated Command | Status |
|---|---|---|---|---|
| VEC-01 | Live rubber band: the draft draws the next-click curve from the cursor; a move never places or commits | 61-21 | `… vitest run src/components/physic-paint/engine/VectorPathOverlay.test.ts` + `view/vectorPathSession.test.ts` | ✅ green (76 + 18) |
| VEC-01 | Pen gesture: smooth per click, corner on Alt+click, commit carries anchors + sampled points; per-path spline evaluation | 61-10 / 61-31 | same overlay suite | ✅ green |
| VEC-01 | Pen/path key handlers stand down on focused text entry and focusable controls | 61-21 | same overlay suite (`61-21 WR-05`, `61-16`) | ✅ green |
| VEC-02 | Hit priority, coupled handles + Alt break, insert-on-spine, multi-select delete, adjacency refusal | 61-09 / 61-10 | `… vitest run src/components/physic-paint/view/vectorPathHandles.test.ts` + overlay | ✅ green (51 + 76) |
| VEC-02 | Selected-anchor ring draws on the open edit only; accent-only, fails closed | 61-22 | same overlay suite (`61-22 G-11`) | ✅ green |
| VEC-02 | The open path edit outranks the picker; Alt hold and latch are refused during an edit | 61-23 | `… vitest run src/components/physic-paint/view/aquarelleColorPicker.test.ts` | ✅ green (45) |
| VEC-02 | Path edit exits on selection retarget; refused width commit publishes honest copy | 61-27 | `… vitest run src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts` + `view/strokeSettingsModel.test.ts` | ✅ green (49 + 182) |
| VEC-02 | Edit-lifetime drag law: close/retarget cancels the drag, clears the preview, releases the capture; a press that hits nothing cannot phantom-commit | 61-28 | `… vitest run src/components/physic-paint/engine/VectorPathOverlay.test.ts` | ✅ green (`61-28 CR-01`) |
| VEC-02 | G-17: every path write re-samples the replay points from the new anchors; undo/redo carry the new spine | 61-29 | `… vitest run src/components/physic-paint/view/aquarelleRecordState.path.test.ts` | ✅ green (14) |
| VEC-02 | Curve-mode edit path: promotion/insert/hit-test/draft all read the path's own mode; Spline shows no handle dot | 61-30 / 61-31 | overlay + `view/vectorPathHandles.test.ts` | ✅ green |
| VEC-03 | Anchor width control mounts in list view + Paint tab; readout numeric; mixed reported per anchor | 61-22 / 61-27 | `… vitest run src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts` + `view/strokeSettingsModel.test.ts` | ✅ green |
| VEC-03 | Engine accepts the per-sample width factor and ramps between samples | 61-04 | `pnpm --filter @efxlab/efx-watercolor exec vitest run src/playground/engineScriptWidth.test.ts` | ✅ green (10) |
| VEC-04 | Per-stroke brush type + colour reads/patches; colour patch writes the stroke and both entry colour slots in one undo step | 261024-p5q | `… vitest run src/components/physic-paint/view/aquarelleStrokeSelection.test.ts` + model | ✅ green (79 + 182) |
| VEC-04 | Vector pen tooltip verbatim; picker disabled only by the rail gate | 61-25 | `… vitest run src/components/physic-paint/view/PhysicsPaintToolRail.test.ts` | ✅ green (20) |
| VEC-05 | Wireframe construction view: envelope + spine + anchors + handles, no rendered band for a vector stroke, bounds/badge kept | 61-13 / 61-25 | overlay (`the wireframe drawing law`, `UI-03/UI-04`) | ✅ green |
| VEC-05 | Wireframe gates: no capture, no reset, no rebake; settle refused with fixed copy | 61-13 / 61-18 | `… vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts` + `view/aquarelleVectorPathCommit.test.ts` | ✅ green (406 + 6) |
| VEC-05 | Shift+A under the wireframe leaves no orphan selection (early return + post-entry re-check) | 61-26 | Studio suite (`61-26 WR-01`) | ✅ green |
| VEC-05 | Wireframe/draft flags never reach persisted bytes | 61-14 | `… vitest run src/efx-paint/compositor/vectorStrokeExportParity.test.ts` | ✅ green (11) |
| VEC-06 | AQTL v2 vector + curve-mode round trip; unknown mode refused; absent mode absent | 61-05 / 61-30 | `… vitest run src/components/physic-paint/performance/scriptTimelineCodec.test.ts` | ✅ green (32) |
| VEC-06 | Payload codec: vector fields round-trip deep-equal, unknown `renderMode`/`curveMode` fail closed | 61-03 / 61-30 | `pnpm --filter @efxlab/efx-watercolor exec vitest run src/payload/codec.test.ts` | ✅ green (35) |
| VEC-06 | `.mce` field contract on BOTH languages (`anchors`, `renderMode`, `curveMode`) | 61-06 / 61-30 | `… vitest run src/lib/mceFieldContract.test.ts` | ✅ green (17) |
| VEC-06 | Save → reopen bake-input parity: pts, anchors, render mode, sparse widths; undone/redone edit byte-identical | 61-14 | `… vitest run src/efx-paint/compositor/vectorStrokeExportParity.test.ts` | ✅ green |
| VEC-06 | **A spline stroke must survive reopen: `restoreAquarelleRecordTimeline` rebuilds the stroke WITH `curveMode` and the next Save keeps it** | gap test / fixed 61 | `… vitest run src/components/physic-paint/view/aquarelleRecordState.reopenCurveMode.test.ts` | ✅ green (4) — fixed f2e3177db |
| VEC-06 | **A duplicated/+Key spline stroke must keep its mode through `aquarelleStrokeFromScriptEvent`** | gap test / fixed 61 | `… vitest run src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.curveMode.test.ts` | ✅ green (2) — fixed f2e3177db |
| VEC-07 | One undo entry per operation: draw, anchor drag, handle drag, insert, delete, width commit (multi-anchor = one bump) | 61-10 / 61-11 / 61-12 / 61-20 | overlay + Studio (`61-20 G-8`) | ✅ green |
| VEC-07 | Undo restores the pre-edit path, redo re-applies it; a no-op/repeat write stores nothing | 61-29 | record-state path suite + export parity | ✅ green |
| VEC-07 | Curve-mode switch is ONE edit, one undo restores both strokes, no seed-salt bump, repeat press stores nothing | 61-31 | `… vitest run src/components/physic-paint/view/aquarelleStrokeSelection.test.ts` + record-state path | ✅ green |

Measured 2026-11-11 at HEAD: the rows above executed as 162 (overlay group) + 406 (model/dialog/selection/rail/picker/edition) + 477 (Studio/codec/contract/record-state) + 96 (roto copy/prev-key/key utilities/export parity) + 133 (watercolor vector/spine/toStudioStroke/codec/determinism) + 10 (engine width) = **1,284 passing tests**, plus the two failing gap files (below).

---

## How the three contract families are proven

1. **Determinism** — `determinismContract.test.ts` already proves "twice on fresh adapters yields identical bytes" and pins the seed literal `mixStrokeSeed(hashMutationId(42), 3) === 179180383`. Extend with a `renderMode` parameter and an undo/redo arm. Pin `paperSeed` before constructing bare engines (the paper-seed trap) or the failure reads as a determinism regression.
2. **`.mce` round-trip** — AQTL is the only layer that can lose information, because Rust is opaque and accepts unknown engine keys. The proof is a `serialize → bytes → parse → deep-equal` unit test plus byte-identity after replay, with a non-default `renderMode` and a sparse width profile in the fixture. Do **not** assert that Rust validates the new fields; it does not.
3. **Undo semantics** — assert the *count* of history entries after: one anchor drag, one handle drag, one insert, one delete, one width commit, and one no-op drag (must produce zero). Compare-then-write setters and `updateAquarelleStrokesInScript`'s unchanged-target skip are what make the no-op case pass. A multi-select width commit must be **one** entry and **one** revision bump — one call with all ids, not a loop.

---

## Wave 0 Requirements

- [x] `packages/efx-watercolor/probe/vector-spine/` — clone of `probe/watercolor-opacity/` (`probe.ts`, `index.html`, `run.mjs`). Must answer the five ROADMAP spike questions: segment-runs vs payload-extension seam scan, sampling law at 1×/4×/16× tick density, seam step metric across segment joins, dab-count cost vs stroke count at 1920×1080 / 2048×1536 / 3072×2304, and byte-identity across runs. **This probe gates the data model.** — landed 61-01, `VECTOR-SPINE PASS`
- [x] `packages/efx-watercolor/src/vector/spine.test.ts` — spine evaluation, arc-length station assignment, duplicate-anchor fallback, centripetal handle golden values (exact) — 61-02
- [x] `packages/efx-watercolor/src/payload/toStudioStroke.test.ts` — sparse width projection, absent-means-uniform, `renderMode` default — 61-03 / 61-04
- [x] `app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts` — AQTL v2 round trip including absent fields and the v1 refusal/acceptance decision — 61-05
- [x] `app/src/lib/mceFieldContract.test.ts` — extended `expectMemberKeys` for the new `Mce*` members; no new `ALLOWED_ONE_LANGUAGE` entries — 61-06
- [x] `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — wireframe gate pins mirroring the Draft block — 61-13
- [x] `app/src/components/physic-paint/view/PhysicsPaintToolRail.test.ts` — fifth-entry pin (`.test.ts`, not `.test.tsx`) — 61-08
- [x] Undo-granularity test for the new gestures (extend `useRotoPhysicalEditHistory` coverage or add a focused file) — 61-10 / 61-11 / 61-12 via `VectorPathOverlay.test.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Seam quality on a tapered multi-width stroke at 100% zoom | VEC-03 | The seam metric is measured in the Wave 0 probe; human judgment decides whether the measured seam is visible in the shipped product | Draw a stroke, set three vertices to 0.4 / 1.8 / 1.0, inspect the joins at 100% and 400% zoom |
| Wireframe reads as a usable editing surface, not a debug view | VEC-05 | Visual judgment against the Studio palette and `physics-paint-segmented-button` grammar | Toggle wireframe on a sheet with mixed vector and hand-painted strokes; confirm spine, width envelope, anchors and handles are legible |
| Editing responsiveness at the measured reference stroke count | VEC-05 | Depends on the probe-measured reference count; native-feel judgment | Load the reference-count sheet, drag an anchor, confirm no visible lag |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15 s per task
- [x] `nyquist_compliant: true` set in frontmatter — both curve-mode transport gaps closed 2026-11-11 (f2e3177db)

**Approval:** validated 2026-11-10 — app suite 421 files / 8712 tests green; engine suite 16 files / 299 tests green.

Every row of the Per-Task Verification Map resolved to an existing, green test file after
execution. The one anticipated gap — the unseeded-RNG scan not covering the new `src/vector`
root — was closed by 61-02, which also added a zero-file guard so a rename cannot empty the
scan silently. Three behaviours remain manual-only by design (see above).

## Validation Audit 2026-11-10

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

## Validation Audit 2026-11-11 — post gap-closure wave (61-21 … 61-31)

Re-audit after the eleven gap-closure plans. Every pre-existing map row was re-executed and
the new plans' suites were run in place (measured counts in the gap-closure table above).
All eleven plans' declared coverage rows resolve to green behavioral tests; the two escalated
gaps sit at integration seams no plan claimed — which is exactly the class this audit exists
to find.

| Metric | Count |
|---|---|
| Gaps found | 2 |
| Resolved | 2 (fixed at f2e3177db — `restoreAquarelleRecordTimeline` and `aquarelleStrokeFromScriptEvent` now carry `curveMode` on the same conditional-spread law as `anchors`/`renderMode`) |
| Escalated | 0 |

Post-fix verification: both gap suites green (4 + 2), full app suite green
(426 files, 8892 tests), `tsc --noEmit` clean.

### Escalated gaps (BLOCKER)

**1. VEC-06 / REL-02 — a spline vector stroke does not survive reopen.**
- **Test:** `app/src/components/physic-paint/view/aquarelleRecordState.reopenCurveMode.test.ts`.
  Three of its four tests fail at HEAD; the absence test passes.
- **Observed:** after the shipped reopen chain (`encodeScriptTimelineBinary` →
  `decodeScriptTimelineBinary` → `restoreAquarelleRecordTimeline`, the chain
  `studioScriptSnapshotController.ts:755` runs), the recorded stroke's `curveMode` is
  `undefined` and the re-projected payload entry has no `engine.curveMode`. The second saved
  entry is not `toStrictEqual` the first (REL-02). The mode survives the AQTL wire; it is
  lost in the rebuild.
- **Cause:** `restoreAquarelleRecordTimeline` (`app/src/components/physic-paint/view/aquarelleRecordState.ts`,
  the stroke literal at lines 1719-1739) reconstructs `anchors` and `renderMode` but never
  reads `engine.curveMode`. 61-30 added the field without updating this rebuild.
- **Impact:** every spline path opens as Bézier after a Studio reopen; the next save writes
  the degraded bytes onward.

**2. VEC-06 / VEC-02 — a duplicated / +Key spline stroke loses its mode.**
- **Test:** `app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.curveMode.test.ts`.
  The spline case fails at HEAD; the absent-mode case passes.
- **Observed:** `aquarelleStrokeFromScriptEvent(eventWithSpline, 9).curveMode` is `undefined`.
- **Cause:** `aquarelleStrokeFromScriptEvent`
  (`app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts:181-206`) carries
  `anchors` and `renderMode` conditionally (61-24) but not `curveMode` (61-30). The same
  projection feeds `copyAquarelleScriptToFrame` (Duplicate) and
  `physicsPaintRotoRailKeyScripts.ts` (+Key / rail copies).
- **Impact:** a copied spline stroke keeps its anchors but re-evaluates as Bézier.

**Suggested fix (developer):** thread `engine.curveMode` through both rebuilds with the same
conditional-spread convention already used for `anchors`/`renderMode`
(`engine.curveMode !== undefined ? { curveMode: engine.curveMode } : {}`), so absence stays
absence. Both new test files should then turn green without modification.
