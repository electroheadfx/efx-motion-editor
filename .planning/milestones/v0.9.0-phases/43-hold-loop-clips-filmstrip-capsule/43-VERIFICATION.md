---
phase: 43-hold-loop-clips-filmstrip-capsule
verified: 2026-08-13T10:05:00Z
status: passed
score: 6/6 must-haves verified
source: codebase verification + native UAT approval (43-UAT.md status: approved)
behavior_unverified: 0
overrides_applied: 0
gaps: []
---

# Phase 43: Hold Loop Clips + Integrated Loop Rail — Verification Report

**Phase Goal:** Static/hold mode materializes the complete script drawing deterministically on every destination frame, and linked Loop Clips replay the timing of their authoritative real source-key positions from 1 to infinity without duplicating durable source assets. Loop Rails own multi-capsule Key Spacing selection and apply complete selected source cycles left-to-right with cumulative downstream ripple and source-attached placement follow in one atomic records-plus-Loop-Clips transaction; physical keys retain ordinary operations and partial spacing within one cycle only. Play Script publishes the current active Paint background in the same physical transaction, including first-document creation on a fresh layer. Loop Clips remain authored exclusively through the integrated Loop Rail and contextual Scripts inspector, while the Motion Editor main timeline shows only passive mode-colored 3px effective-interval paint with canonical endpoint cuts and owns no Loop Clip-specific interaction.
**Verified:** 2026-08-13T10:05:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every static/hold destination frame receives the complete script stroke set; generated keys remain paint content of the opened parent Paint layer composited as one resolved raster per frame | ✓ VERIFIED | `physicsPaintRotoHoldDeterminism.test.ts` (19 tests), `physicPaintStore.rotoHoldComposite.test.ts`, `physicsPaintRotoPlayScriptController.test.ts` all pass; resolver emits one `PhysicPaintRotoFrameResolution` per frame; main editor composites one resolved raster per frame |
| 2 | Identical script/destination/options produce identical output across save/reopen and cache regeneration; zero-variation stable, nonzero deterministic, no render-time jitter | ✓ VERIFIED | `physicsPaintRotoHoldDeterminism.test.ts` (19 tests) pass; determinism contract exercised by named tests; revision fingerprint includes loopClips |
| 3 | Cancellation/staging/transport/timeout/settlement-mismatch never leaves partial records, Loop Clips, background metadata, or history; one Undo/Redo through the atomic commit path; first Play Script on fresh layer creates the physical document with the current active Paint background | ✓ VERIFIED | `useRotoPhysicalEditCoordinator.test.ts` atomic staging/rollback tests pass; fresh-layer first-document creation named test passed; D-58 background publication named test passed; `physicPaintStore.rotoLoopClips.test.ts` commit acceptance passes |
| 4 | 5-position source cycle × 5 resolves across five repetitions storing only the 5 authoritative source keys; rail-owned plain/Shift/Cmd selection, dedup, canonical order, cumulative ripple, source-attached placement follow, one Undo/Redo | ✓ VERIFIED | `physicsPaintRotoLoopClips.test.ts` (74 tests), `physicsPaintRotoLoopResolver.test.ts` (23 tests), `physicsPaintRotoSpacingSelection.test.ts` (7 tests), `useRotoTimelineActions.test.ts` (D-57 ripple + dedup named tests) all pass; resolver stores only authoritative source keys with modulo resolution |
| 5 | Next-clip priority truncation with half-open boundaries and re-expansion; conditional 3px integrated Loop Rail with tooltip/contextual Scripts inspector; passive Motion Editor `{startFrame, frameCount, mode}` markers with zero Loop Clip-specific interaction; `clip bloquant` never appears | ✓ VERIFIED | `physicsPaintRotoLoopGuards.test.ts` (38 tests), `PhysicsPaintLoopClipRail.test.tsx`, `PhysicsPaintScriptsPanel.test.tsx` pass; all 6 structural sentinels pass; `TimelineInteraction.ts`/`TimelineCanvas.tsx` have ZERO loop/capsule references; `frameMap.ts` projects `{startFrame, frameCount, mode}` only; prohibited term absent from production files |
| 6 | Loop Clips authored exclusively through the integrated Loop Rail and contextual Scripts inspector; no dedicated actions popover or replacement specialized transport retained | ✓ VERIFIED | `PhysicsPaintStudio.tsx:1144` wires Studio-local `openLoopEdit` route; `PhysicsPaintScriptsPanel.tsx` Play-to-Edit swap + inspector facts; deleted modules (`TimelineCapsuleTooltip.tsx`, `loopCapsuleGeometry.ts`, `PhysicsPaintLoopClipLane.tsx`) confirmed gone with no stale references |

**Score:** 6/6 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` | Loop Clip record model + four-allowlist parse gauntlet + revision fingerprint | ✓ VERIFIED | `PhysicPaintRotoLoopClip` at 266, `parsePhysicPaintRotoLoopClips` at 682, loopClips in document keys at 417 |
| `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` | Lazy interval derivation + per-frame typed resolution + D-24 boundary algebra | ✓ VERIFIED | `PhysicPaintRotoFrameResolution` union at 3123, `derivePhysicPaintRotoLoopRanges` at 3211, `resolvePhysicPaintRotoLoopFrame` at 3363 |
| `app/src/stores/physicPaintStore.ts` | Linked-loop render source, loop-aware end frame, atomic loopClips commit acceptance | ✓ VERIFIED | `getRotoPhysicalEndFrame` at 1824, `getRotoPhysicalUnresolvedLoops` at 1845, `getRotoPhysicalRenderSource` at 1877 |
| `app/src/lib/physicPaintPersistence.ts` | loopClips in persisted document keys, save mapping, hydration | ✓ VERIFIED | `loopClips` in PERSISTED_DOCUMENT_KEYS at 22, save at 233, hydration at 408 |
| `app/src/lib/frameMap.ts` | Passive marker projection `{startFrame, frameCount, mode}` only | ✓ VERIFIED | `deriveMainEditorLoopRanges` at 139, `getTimelineRepeatDurationMarkers` at 153 |
| `app/src/types/timeline.ts` | `TimelineRepeatDurationMarker` with no identity/metadata | ✓ VERIFIED | Interface at 12: `{startFrame, frameCount, mode}` only |
| `app/src/components/timeline/TimelineRenderer.ts` | Passive 3px purple/cyan markers with white endpoint cuts | ✓ VERIFIED | `drawPhysicPaintRepeatDurationMarkers` at 515, markerH=3, `#06B6D4`/`#8B5CF6`, white `#F8FAFC` cuts |
| `app/src/components/timeline/TimelineInteraction.ts` | ZERO Loop Clip-specific interaction | ✓ VERIFIED | Zero loop/capsule references (boundary holds) |
| `app/src/components/timeline/TimelineCanvas.tsx` | ZERO Loop Clip-specific interaction | ✓ VERIFIED | Zero loop/capsule/tooltip references (boundary holds) |
| `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx` | Integrated 3px rail with plain/range/toggle gestures, keyboard, tooltip | ✓ VERIFIED | 231 lines, gestures + double-click edit + Enter/Space/Escape |
| `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts` | Derived name, Cycle math, Effective duration, mode, status | ✓ VERIFIED | `projectPhysicsPaintLoopClipPresentation` at 62, cycleLabel, statusLabelFor |
| `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx` | Contextual Scripts inspector with Play-to-Edit swap | ✓ VERIFIED | Inspector facts (Name, Placement, Cycle, Effective, Group Type, Status), Pencil icon |
| `app/src/components/physic-paint/roto/physicsPaintRotoSpacingSelection.ts` | Rail-owned plain/range/toggle selection reducer | ✓ VERIFIED | Anchor, primary, reconciliation, dedup |
| `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts` | Atomic records+loopClips staging, rollback, background publication | ✓ VERIFIED | 1915 lines, atomic staging + rollback + D-58 background publication |
| `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` | D-57 cumulative ripple, placementStart follow, dedup | ✓ VERIFIED | Ripple at 1167, dedup at 604-705 |
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` | Play Script background publication, openLoopEdit, preflight | ✓ VERIFIED | `openLoopEdit` at 590, `rotoBackground` in publications at 1101/1133/1217/1538 |
| `app/src/lib/exportEngine.ts` | D-28 export preflight block + placeholder variant | ✓ VERIFIED | `findUnresolvedExportLoop` at 68, block message at 89/98 |
| `app/src/lib/physicPaintBridge.ts` | Fresh-layer first-document creation, background metadata | ✓ VERIFIED | Bridge apply path traced |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | Studio-local openLoopEdit route | ✓ VERIFIED | `openLoopEdit` at 1144 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `PhysicsPaintLoopClipRail.tsx` | `physicsPaintLoopClipPresentation.ts` | `projectPhysicsPaintLoopClipPresentation` + `projectPhysicsPaintLoopClipGeometry` imports | ✓ WIRED | Rail renders presentation tooltip lines and geometry |
| `PhysicsPaintLoopClipRail.tsx` | `useRotoTimelineActions.ts` | `onSelectLoopClip` prop → rail-owned selection gesture | ✓ WIRED | plain/range/toggle gestures flow to selection reducer |
| `PhysicsPaintStudio.tsx` | `physicsPaintRotoPlayScriptController.ts` | `rotoPlayScript.openLoopEdit(loopId)` at 1144 | ✓ WIRED | Studio-local Edit dialog route |
| `physicsPaintRotoPlayScriptController.ts` | `physicPaintStore.ts` | `rotoBackground` in publications → atomic commit acceptance | ✓ WIRED | D-58 background publication named test passed |
| `physicPaintStore.ts` | `physicsPaintRotoPhysicalResolver.ts` | `getRotoPhysicalRenderSource` → `resolvePhysicPaintRotoLoopFrame` | ✓ WIRED | linked-unresolved branch at 2072 |
| `frameMap.ts` | `TimelineRenderer.ts` | `getTimelineRepeatDurationMarkers` → `drawPhysicPaintRepeatDurationMarkers` | ✓ WIRED | Passive `{startFrame, frameCount, mode}` only |
| `physicsPaintRotoPhysicalModel.ts` | `physicPaintPersistence.ts` | loopClips in PERSISTED_DOCUMENT_KEYS → save/hydration | ✓ WIRED | Four-allowlist gauntlet + revision fingerprint |
| `useRotoTimelineActions.ts` | `useRotoPhysicalEditCoordinator.ts` | D-57 ripple proposal → atomic records+loopClips staging | ✓ WIRED | Cumulative ripple + placementStart follow in one transaction |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `physicsPaintRotoPhysicalResolver.ts` | `PhysicPaintRotoFrameResolution` | `derivePhysicPaintRotoLoopRanges` from persisted loopClips + source key appFrames | Yes — modulo resolution `sourceIndex = (frame - placementStart) % cycleLength` | ✓ FLOWING |
| `physicPaintStore.ts` | `getRotoPhysicalRenderSource` | Resolver per-frame resolution | Yes — real/linked/linked-unresolved/empty typed union | ✓ FLOWING |
| `frameMap.ts` | `TimelineRepeatDurationMarker` | `deriveMainEditorLoopRanges` from store ranges | Yes — `{startFrame, frameCount, mode}` only | ✓ FLOWING |
| `TimelineRenderer.ts` | marker paint | `drawPhysicPaintRepeatDurationMarkers` | Yes — 3px purple/cyan + white endpoint cuts | ✓ FLOWING |
| `PhysicsPaintLoopClipRail.tsx` | rail geometry | `projectPhysicsPaintLoopClipGeometry` from range + visible window | Yes — real range data, not static | ✓ FLOWING |
| `exportEngine.ts` | `findUnresolvedExportLoop` | `getRotoPhysicalUnresolvedLoops` from store | Yes — real unresolved-loop query | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full test suite | `pnpm --dir app exec vitest run` | 120 files / 1948 tests passed / 1 skipped / 101 todo | ✓ PASS |
| Typecheck | `pnpm --dir app run typecheck` | exit 0 | ✓ PASS |
| Focused loop suite | `vitest run physicsPaintRotoLoopClips physicsPaintRotoLoopResolver physicsPaintRotoLoopGuards physicsPaintRotoHoldDeterminism physicsPaintRotoLoopHistory physicsPaintRotoSpacingSelection` | 167 tests passed | ✓ PASS |
| Store/export/preview/coordinator/rail suite | `vitest run physicPaintStore.rotoLoopClips physicPaintStore.rotoHoldComposite exportEngine.loops previewRenderer.loops useRotoPhysicalEditCoordinator PhysicsPaintLoopClipRail physicsPaintLoopClipPresentation PhysicsPaintScriptsPanel` | 153 tests passed | ✓ PASS |
| Fresh-layer first-document creation | named test `-t "creates the canonical physical document on a fresh layer"` | passed | ✓ PASS |
| D-58 background publication | named test `-t "carries the current background only on the deferred Play Script payload"` | passed | ✓ PASS |
| D-57 cumulative ripple | named test (useRotoTimelineActions) | passed | ✓ PASS |
| Dedup of identical cycles | named test (useRotoTimelineActions) | passed | ✓ PASS |
| Export preflight block | named test (exportEngine.loops) | passed | ✓ PASS |
| Sentinel: frameMap passive marker | `frameMap.test.ts:310` | passed | ✓ PASS |
| Sentinel: TimelineInteraction zero loop refs | `TimelineInteraction.test.ts:9` | passed | ✓ PASS |
| Sentinel: TimelineCapsuleTooltip deleted | `TimelineCapsuleTooltip.test.ts:9` | passed | ✓ PASS |
| Sentinel: WorkflowStrip no popover | `PhysicsPaintWorkflowStrip.test.ts:1260` | passed | ✓ PASS |
| Sentinel: loop operation bridge | `physicPaintLoopOperationBridge.test.ts:9` | passed | ✓ PASS |
| Sentinel: bridge background | `physicPaintBridge.test.ts:2208` | passed | ✓ PASS |

### Probe Execution

No probe scripts were declared in PLAN files or found under `scripts/*/tests/probe-*.sh` for this phase. Step 7c: SKIPPED (no probes declared).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| HOLD-01 | 43-04 | Every static/hold destination frame receives the complete script stroke set, supporting progressive-then-hold workflows on adjacent ranges | ✓ SATISFIED | `physicsPaintRotoHoldDeterminism.test.ts` (19 tests) pass; resolver emits complete stroke set per destination frame |
| HOLD-02 | 43-04 | Static/hold reuses the deterministic Script Motion model — zero variation stable, nonzero deterministic, identical inputs identical output across save/reopen and cache regeneration | ✓ SATISFIED | Determinism tests pass; revision fingerprint includes loopClips; no random render-time jitter |
| HOLD-03 | 43-04 | Static/hold reuses the existing commit path; no cancellation/failure leaves a partial destination range; first Play Script on fresh layer atomically creates the canonical physical document with current active `rotoBackground`; later transactions replace stale parent background metadata | ✓ SATISFIED | `useRotoPhysicalEditCoordinator.test.ts` atomic staging/rollback pass; fresh-layer first-document named test passed; D-58 background publication named test passed |
| HOLD-04 | 43-03, 43-09 | Generated keys remain paint content of the opened parent Paint layer; main editor composites one resolved Paint raster per frame | ✓ SATISFIED | `physicPaintStore.rotoHoldComposite.test.ts` passes; one `PhysicPaintRotoFrameResolution` per frame |
| HOLD-05 | 43-01, 43-02, 43-05, 43-06, 43-08, 43-11, 43-12, 43-13, 43-14 | Loop Clips persist as canonical linked loop regions with source-key-timed modulo resolution, half-open boundaries, next-clip priority, re-expansion; rail-owned multi-capsule Key Spacing with cumulative ripple and source-attached placement follow in one atomic transaction; physical selection authoritative within one cycle only; one Undo/Redo | ✓ SATISFIED | `physicsPaintRotoLoopClips.test.ts` (74), `physicsPaintRotoLoopResolver.test.ts` (23), `physicsPaintRotoLoopGuards.test.ts` (38), `physicsPaintRotoLoopHistory.test.ts` (6), `physicsPaintRotoSpacingSelection.test.ts` (7), `useRotoTimelineActions.test.ts` all pass |
| HOLD-06 | 43-07, 43-08, 43-11, 43-12, 43-13, 43-14, 43-15 | Conditional 3px integrated Loop Rail with tooltip/contextual Scripts inspector; passive Motion Editor `{startFrame, frameCount, mode}` markers with zero Loop Clip-specific interaction; `clip bloquant` prohibited | ✓ SATISFIED | `PhysicsPaintLoopClipRail.test.tsx`, `PhysicsPaintScriptsPanel.test.tsx` pass; all 6 sentinels pass; TimelineInteraction/TimelineCanvas zero references; prohibited term absent from production files |

All 6 HOLD requirement IDs (HOLD-01 through HOLD-06) are accounted for. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `app/src/lib/exportEngine.ts` | 78 | WR-01: export preflight compares global export frames against layer-local loop ranges | ⚠️ Warning (advisory) | Fails open on resume and over-blocks on initial export for sequences with `inFrame > 0`. Advisory — native UAT approved the export block behavior; no critical impact proven |
| `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx` | 95-108 | WR-02: double-click dead zone (220–250 ms) | ⚠️ Warning (advisory) | Second click in the 30 ms window is neither double-click nor clean single click. Advisory — native UAT approved rail interaction |
| `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx` | 181 | WR-03: rail uses `requestedEnd` instead of truncated `effectiveEnd` for finite loops | ⚠️ Warning (advisory) | Rail clip drawn wider than frames that actually resolve for parent-truncated finite loops. Advisory — native UAT approved rail geometry |
| `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts` | 1157 | IN-01: dead ternary in `cancelPhysicalEdit` | ℹ️ Info | Both branches identical; cosmetic |
| `app/src/lib/exportEngine.ts` | 97 | IN-02: `missingSourceFrame` assumes consecutive source frames | ℹ️ Info | Message accuracy only; guard unaffected |
| `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` | 1036, 1524 | IN-03: formatting defects (brace on same line) | ℹ️ Info | Cosmetic |
| `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` | 123 | IN-04: dense-array assumption for `physicalCells` | ℹ️ Info | Holds today; implicit contract |
| `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts` | 299 | IN-05: production `console.error` | ℹ️ Info | Console noise; failure already tracked in refs |

No TBD/FIXME/XXX debt markers found in phase-modified files. No stub patterns found — all artifacts are substantive and wired.

### Human Verification Required

None. The phase was verified through the native UAT path — `43-UAT.md` status is `approved` (user approved 2026-08-08: "congrats I approve all for this phase"). All 20 numbered areas plus Issue #0/#0b/#1/#2 checks were exercised by the user on the packaged app. No additional human verification items remain.

### Gaps Summary

No gaps found. All 6 must-haves verified, all 6 HOLD requirements satisfied, all key links wired, all data flows real, full test suite (120 files / 1948 tests) passes, typecheck clean, and native UAT approved.

The 3 code-review warnings (WR-01, WR-02, WR-03) and 5 info items in `43-REVIEW.md` are advisory per the phase's acceptance oracle (native UAT approval). They do not block goal achievement. Two minor copy deviations were noted and approved by the user in native UAT: the export block message uses "Group" terminology instead of the plan's "Loop Clip" copy, and the truncation label appears as "shortened by the next clip" in the controller readout rather than the presentation module's status label.

---

_Verified: 2026-08-13T10:05:00Z_
_Verifier: Claude (gsd-verifier)_
