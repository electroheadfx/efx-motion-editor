---
phase: 47-internal-multi-track-timeline-filmstrip-capsules-and-control
verified: 2026-08-25T20:30:00Z
status: human_needed
score: 10/10 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Visually confirm the pinned header column + track CRUD UI in the live Studio: rename edit-in-place on double-click, duplicate flow, acknowledge-and-delete dialog (frame/loop/Hold preview, Cancel, Confirm), header-grab reorder with the live insertion indicator, hover eye/S/pencil/copy/trash tools, '+' add button, and the locked 'Bg' row at the bottom with lock indicator."
    expected: "The header column looks and behaves per the approved tracks-ui.html mockup: 140px pinned column, active row accent (left border + tint + bold name) distinct from selection orange and rail purple/cyan, tools appear on hover without covering the name, no French copy anywhere."
    why_human: "Structural layout and control wiring are unit-proven, but visual fidelity (spacing, hover affordances, dialog styling, tool glyph rendering) requires a native visual pass — no automated check can judge visual appearance."
  - test: "Visually confirm the right-panel Track section: 'Track: <name>' title, the Opacity slider (0..1), and the Blend select with exactly normal/screen/multiply/overlay/add."
    expected: "The section renders the ACTIVE track's values, updates live when the active track changes, and committing a new value is reflected immediately; no opacity/blend compositing math runs in the panel (Phase 48 scope)."
    why_human: "Visual appearance and the live re-render feel of the panel controls cannot be verified by grep or unit tests."
  - test: "Visually confirm the filmstrip capsule rendering for Hold Loop Clips and Background-row clips: source-cycle cell band at the capsule head, ×N/∞ badge, requested-duration badge, compact vs expanded repetition band, diagonal partial-cycle cut, and the 'Loop shortened by next clip' shortened visual."
    expected: "Capsules render per Phase 43-locked rail semantics with the Phase 43 rail (purple/cyan, passive markers, white endpoint cuts) untouched; the badge always shows the REQUESTED duration; English labels only."
    why_human: "Capsule rendering appearance (cell sizing, diagonal cut, hatched vs expanded band, shortened visual) is a visual surface; unit tests assert structure/classes, not the rendered look."
  - test: "Interactively test the cross-track drag: drag a real key / Key Rail / Loop Clip Rail from one row to another with no modifier key."
    expected: "The destination row highlights and a live insertion preview shows the landing frame during the gesture; releasing commits the move with fresh identities and an English success capsule; a rejected move leaves both rows unchanged and surfaces the English reason with the red warning triangle; the header reorder grab never starts a content move and vice versa."
    why_human: "Pointer-gesture feel, destination highlight, and live insertion preview are real-time interaction behavior that automated tests can only approximate."
  - test: "Reconcile the three milestone-tracking inconsistencies found by this verifier."
    expected: "(1) Decide whether TML-06 (filmstrip capsules) should be marked Complete in REQUIREMENTS.md — the code delivers the capsule and all its tests pass, but the marker still reads Pending. (2) Update the ROADMAP phase-47 'Plans: 4/5 plans executed' count to 5/5 — all five plans are marked executed. (3) Update the TML-07 requirement text, which still carries the pre-correction French label 'clip suivant — interrompt la boucle' even though the shipped code deliberately uses the English 'next clip — interrupts the loop' (user copy correction D-14)."
    why_human: "These are documentation/tracking staleness issues, not code failures — a human must confirm the intended reconciliation."
---

# Phase 47: Internal Multi-track Timeline, Filmstrip Capsules, and Controls — Verification Report

**Phase Goal:** Provide a vertically scrollable multi-row Paint timeline inside EFX Paint Studio with track CRUD, active selection, hide/solo, opacity/blend, and filmstrip capsules.
**Verified:** 2026-08-25T20:30:00Z
**Status:** human_needed (10/10 must-haves verified in code; native visual/interaction confirmation pending for the 47-02..47-05 UI surfaces)
**Re-verification:** No — initial verification

## Goal Achievement

The goal-backward check: the codebase observably delivers a vertically scrollable multi-row Paint timeline (every `document.tracks` entry renders as its own row plus exactly one Bg row), full track CRUD (add/rename/duplicate/delete/reorder), active-track selection with an unambiguous accent, hide/solo with a single truth-table filter in the preview path, opacity/blend stored per track with the right-panel surface, and adaptive filmstrip capsules for Hold and Background Loop Clips. All behavior-dependent truths are exercised by passing unit tests; no stub, no placeholder, and no unwired artifact was found.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | EFX Paint Studio renders a vertically scrollable multi-row Paint timeline: every InternalPaintTrack renders as a row plus exactly one fixed Background row; the rows region scrolls vertically with the header column pinned; frame pitch stays 18px (TML-01, roadmap SC 1) | ✓ VERIFIED | `PhysicsPaintWorkflowStrip.tsx:3695` maps `props.tracks` to per-track rows; `PhysicsPaintTrackRow.tsx` renders row + Bg skeleton; vertical pill scrollbar + pinned header (47-01/47-02). `PhysicsPaintWorkflowStrip.viewport.test.ts` suite (32 tests) passes, including "renders every Paint track as a row plus exactly one Background row", "keeps the rows region a distinct band", "caps the default strip height at 270px on overflow". |
| 2 | Track CRUD — add, rename, duplicate, delete, reorder — works through store ops and UI surfaces, and survives save/reopen (TML-02, TML-08, roadmap SC 1) | ✓ VERIFIED | `efxPaintStore.ts` exports addTrack/renameTrack/duplicateTrack/reorderTrack/requestDeleteTrack/commitDeleteTrack; UI surfaces: header '+' + duplicate/copy buttons + rename edit-in-place + `PhysicsPaintDeleteTrackDialog.tsx` + header-grab reorder. Serialize/hydrate round-trip test "round-trips add+rename+duplicate+reorder through serialize/hydrate with the same N tracks in the same order" passes. |
| 3 | Active track selection: row/frame click activates a track via `setActiveTrackId`; the active track is always visually unambiguous (accent left border + tint + bold name, distinct from selection orange and rail purple/cyan); all non-cross mutations route through `studioActiveTrackId()` (TML-03, roadmap SC 2) | ✓ VERIFIED | `efxPaintStore.ts:97` setActiveTrackId; Studio re-reads on `efxPaintVersion.value` (PhysicsPaintStudio.tsx:499, 853); row-header click test "fires onSelectTrack and the active track switches" passes; header column active accent class verified. |
| 4 | Hide/solo truth table applied at the top of `resolvePhysicPaintFrameSource`: no solo → all visible; solo → visible+soloed only; hide wins over solo; hidden or soloed-out active track resolves an empty preview (TML-04, roadmap SC 3) | ✓ VERIFIED | `previewRenderer.ts:108` `resolvePhysicPaintTrackVisibility` called at `previewRenderer.ts:156` before both store reads. Three behavior tests pass: "no solo armed…", "solo armed → only visible+solo…", "soloed-and-hidden track is hidden (hide beats solo)". |
| 5 | Opacity/blend setters store values fail-closed; right-panel Track section binds the opacity slider and a 5-option blend select, re-rendering when the active track or its values change (TML-04, roadmap SC 3) | ✓ VERIFIED | `efxPaintStore.ts` setTrackOpacity (clamp 0..1, non-finite reject) + setTrackBlend (BlendMode union validation); `PhysicsPaintRightPanel.tsx:559-567` Track section (PanelSlider 0..1, select over exactly the 5 BlendModes). All 4 right-panel tests pass. |
| 6 | Hold and Background Loop Clips show as adaptive filmstrip capsules: source-cycle cells, ×N/∞ badge from the requested cycleLabel, requested-duration badge, partial-cycle interruption, single resolver path (TML-06, roadmap SC 4) | ✓ VERIFIED | `physicsPaintFilmstripCapsule.tsx` (5 tests pass: source-cycle cells, ×N/∞ badge from requested label, diagonal partial-cut, compact/expanded threshold, shortened visual+label); `physicsPaintLoopClipPresentation.ts` shortened/partialCycle facts (4 tests pass); caps mounted per row via `loopCapsules` prop and Bg row via `projectBackgroundFrameLoopClipCapsule`. No loop math inside the capsule (grep gate held). |
| 7 | Reorder changes compositor order but not track identity; track-view interactions never mutate another row accidentally; cross-track drag commits only on explicit crossing with byte-identical rows on rejection (TML-05, roadmap SC 5) | ✓ VERIFIED | `reorderTrack` rewrites only order fields with byte-identical IDs (test at efxPaintStore.test.ts:433). `usePhysicsPaintCrossTrackDrag.ts` with `computeCrossTrackDestination`/`computeInsertionFrame` and the D-18 grab-area separation. Hook suite (17 tests) + strip wiring tests pass, incl. "commits the move through moveTrackItems exactly once — source loses the items, the destination gains fresh identities", "a rejected move leaves both rows byte-identical and publishes the specific English reason". |
| 8 | Track CRUD store ops are deterministic: addTrack twice creates two distinct tracks with fresh UUIDs and consecutive auto-names; renameTrack to the same name is a no-op; empty/whitespace-only/control-char names are rejected and the prior name is kept (TML-02 idempotency) | ✓ VERIFIED | efxPaintStore tests for addTrack fresh UUID + 'Paint 1'/'Paint 2', rename no-op and rejection pass. |
| 9 | Store-op rejections leave the document byte-identical; zero Paint tracks can never occur (last-track delete refusal); fresh document always has exactly one Paint track + one Background (TML-04 empty, D-17) | ✓ VERIFIED | Every op builds an immutable next document; `commitDeleteTrack` refuses when `document.tracks.length === 1` (`efxPaintStore.ts:472`); document factory creates 1 default track + background (`efxPaintDocument.ts:111`). |
| 10 | Track CRUD mutations are synchronous on the document and fail-closed on unknown trackId; async revalidation/activate route through `setActiveTrackId` which validates the track exists (TRK-05 backstop) | ✓ VERIFIED | Code reading: all eight ops do `getDocument` → `find` → fail-closed `{ ok: false }` before any write; the full store test suite exercises rejection paths and passes. |

**Score:** 10/10 truths verified (0 behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `app/src/stores/efxPaintStore.ts` | Track CRUD ops + display setters + requestDelete/commitDelete | ✓ VERIFIED | 578 lines; all 8 ops exported, fail-closed result unions; per-track revision bump in setters; serialize/hydrate round-trip. |
| `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` | 30px multi-track row (paint + background) + header | ✓ VERIFIED | 537 lines; hook-free; `PhysicsPaintTrackRowKind` 'paint'/'background'; loop-capsule presentation props. |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` | Multi-row rows region + pinned header + vertical scroll + CRUD wiring | ✓ VERIFIED | 4133 lines; `tracks.map` rows, `renderActiveLane()`, `computeEnsureRowScrollDelta` exported, cross-track drag mounted, delete dialog opened. |
| `app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx` | Pinned header column (rows, Bg last, add, tools, reorder grab) | ✓ VERIFIED | 202 lines; full prop bundle; 'Bg' locked row; reorder insertion indicator. |
| `app/src/components/physic-paint/view/PhysicsPaintDeleteTrackDialog.tsx` | Acknowledge-and-delete dialog with last-track refusal | ✓ VERIFIED | 88 lines; Confirm = commitDeleteTrack, refusal copy, cancel path. |
| `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` | Track section (opacity slider, blend select) | ✓ VERIFIED | 669 lines; Track section at 559-577; PanelSlider reuse; 5 BlendModes. |
| `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts` | Guarded add/duplicate shortcuts | ✓ VERIFIED | 286 lines; Cmd/Ctrl+Shift+N/D under isPhysicsPaintShortcutTarget, mutationLocked skip, no Delete binding. |
| `app/src/components/physic-paint/view/physicsPaintFilmstripCapsule.tsx` | Adaptive filmstrip capsule | ✓ VERIFIED | 92 lines; source-cycle cells, badge, diagonal cut, expansion threshold `FILMSTRIP_CELL_EXPAND_THRESHOLD_PX = 12`. |
| `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts` | Presentation + shortened/partial-cycle facts | ✓ VERIFIED | 356 lines; `shortened`/`partialCycle`/`shortenedLabel`/`interruptionTooltipLine` from the single resolver path. |
| `app/src/components/physic-paint/hooks/usePhysicsPaintCrossTrackDrag.ts` | Cross-track drag gesture + commit port | ✓ VERIFIED | 343 lines; signals + `computeCrossTrackDestination`/`computeInsertionFrame` + `moveTrackItems` port + English reason map. |
| `app/src/lib/previewRenderer.ts` | Hide/solo truth table in the preview filter | ✓ VERIFIED | `resolvePhysicPaintTrackVisibility` (108) called at top of `resolvePhysicPaintFrameSource` (156); loop-placeholder branch untouched. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| Header column | efxPaintStore ops | pointer handlers in PhysicsPaintStudioView/bundle (setActiveTrackId, add, rename, duplicate, request/commitDelete, setVisible/solo) | ✓ WIRED | `physicsPaintTrackHeaderColumn` invoked from `PhysicsPaintWorkflowStrip.tsx:3638` with the full bundle. |
| Right-panel Track section | setTrackOpacity / setTrackBlend | `PhysicsPaintStudio.tsx` props derived from `getEfxPaintDocument(layerId)` + panel select/slider onChange | ✓ WIRED | PhysicsPaintRightPanel imports the setters; the Studio binds them (line 18-19 imports). |
| Studio routing | studioActiveTrackId() | `studioActiveTrackId` + `efxPaintVersion` memo deps; row click → setActiveTrackId | ✓ WIRED | `PhysicsPaintStudio.tsx:635, 1170, 1586, 1924` route through the active-track authority. |
| Filmstrip capsule | presentation + resolver facts | per-row `loopCapsules` from store memoized `getTrackRotoResolutionContext` + shared presentation module (strip computes no loop math) | ✓ WIRED | `PhysicsPaintWorkflowStrip.tsx:479` (ranges) + :505 (background) project through the shared module. |
| Bg row | document.background clips | `projectBackgroundFrameLoopClipCapsule` when clips exist; fallback otherwise | ✓ WIRED | Bg row reads `document.background`; clip display test passes. |
| Cross-track drag | physicPaintStore.moveTrackItems | strip binds `moveTrackItems(layerId, fromTrackId, toTrackId, keys)` at the hook port; publishStatus/setApplyStatus for rejections | ✓ WIRED | `PhysicsPaintWorkflowStrip.tsx:2076-2079`; hook port at usePhysicsPaintCrossTrackDrag.ts:284. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| PhysicsPaintWorkflowStrip rows | props.tracks / activeTrackId / background | `multiTrackRowBundle` ← `getEfxPaintDocument(layerId)` (PhysicsPaintStudio.tsx:2975-2993) | Yes | ✓ FLOWING |
| PhysicsPaintTrackRow cells | per-row trackId reads | `getRotoPhysicalRenderSource(layerId, trackId, frame)` / `getFrame` with the row's trackId | Yes | ✓ FLOWING |
| Right-panel Track section | trackName/trackOpacity/trackBlendMode | `getEfxPaintDocument(layerId)` → active track fields, memo deps on efxPaintVersion | Yes | ✓ FLOWING |
| Filmstrip capsule | presentation facts / geometry | resolver `projectPhysicsPaintLoopClipPresentation` + `projectPhysicsPaintLoopClipGeometry` from store context | Yes | ✓ FLOWING |
| Preview filter | active track visible/solo | document tracks fields via `resolvePhysicPaintTrackVisibility` | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Hide/solo truth table (incl. hide-beats-solo) | `vitest run src/lib/previewRenderer.test.ts` | 15 tests passed | ✓ PASS |
| Track CRUD + setters + serialize/hydrate round-trip | `vitest run src/stores/efxPaintStore.test.ts` | 27 tests passed (42 total across the 2 suites) | ✓ PASS |
| Pinned header column + CRUD interactions + vertical scroll + ensure-active-row | `vitest run src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts` | 17 tests passed | ✓ PASS |
| Multi-row render, per-row reads, row-click active, scrollbar, hide presentation | `vitest run src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts` | 32 tests passed | ✓ PASS |
| Strip wiring (CRUD routing, cross-track mount, D-18) | `vitest run src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` | 127 tests passed | ✓ PASS |
| Right-panel Track section | `vitest run src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts` | 9 tests passed | ✓ PASS |
| Guarded keyboard shortcuts | `vitest run src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts` | 106 tests passed | ✓ PASS |
| Capsule presentation facts | `vitest run src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts` | 16 tests passed | ✓ PASS |
| Filmstrip capsule component | `vitest run src/components/physic-paint/view/physicsPaintFilmstripCapsule.test.ts` | 5 tests passed | ✓ PASS |
| Cross-track drag gesture + commit + rejection | `vitest run src/components/physic-paint/hooks/usePhysicsPaintCrossTrackDrag.test.ts` | 17 tests passed | ✓ PASS |
| Typecheck | `cd app && pnpm exec tsc --noEmit` | exit 0 | ✓ PASS |

### Probe Execution

None declared — the phase plans declare no probe scripts (verification is TDD unit suites + typecheck, all run above).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| TML-01 | 47-01 | Vertically scrollable multi-row Paint timeline | ✓ SATISFIED | rows render + vertical scroll + viewport tests pass |
| TML-02 | 47-01/02/03 | Add/rename/duplicate/delete/reorder + save/reopen | ✓ SATISFIED | store ops + dialog + header drag + shortcuts + round-trip test |
| TML-03 | 47-01/02 | Active track select + unambiguous marking | ✓ SATISFIED | accent + row-click + routing tests pass |
| TML-04 | 47-01/03 | Hide/solo + opacity/blend | ✓ SATISFIED | truth table + setters + right-panel tests pass |
| TML-05 | 47-01/02/05 | Correct row display + routing + no accidental mutation | ✓ SATISFIED | per-row reads + cross-track tests pass |
| TML-06 | 47-04 | Hold/Background Loop Clips as adaptive filmstrip capsules | ✓ SATISFIED (code) — ⚠️ tracker says Pending | capsule + presentation implemented and tested; REQUIREMENTS.md still marks Pending (see findings) |
| TML-07 | 47-02/04 | Distinct fixed Background row | ✓ SATISFIED (code) — ⚠️ requirement text stale | Bg row + lock + capsule clip display; requirement text still carries the pre-correction French label (see findings) |
| TML-08 | 47-01 | CRUD survives save/reopen; reorder keeps identity | ✓ SATISFIED | serialize/hydrate + reorder-order-only tests pass |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ----- | ---- | ------- | -------- | ------ |
| app/src/lib/previewRenderer.ts | 197-217 | 'PLACEHOLDER' tokens | ℹ️ Info | The Phase 43 intentional loop-placeholder render branch (D-28), explicitly byte-unchanged by this phase — not debt. |
| — | — | TBD/FIXME/XXX | — | None found in any phase-47-modified file. |

### Human Verification Required

See the frontmatter `human_verification` list (5 items): visual confirmation of the header/CRUD UI, the right-panel Track section, the filmstrip capsule rendering, the cross-track drag interaction, and a decision on the three milestone-tracking inconsistencies (TML-06 Pending marker, ROADMAP 4/5 plan count, TML-07 French label in the requirement text).

### Findings (tracking/documentation — non-blocking, need a human decision)

1. **TML-06 marked Pending in REQUIREMENTS.md despite complete implementation.** The last REQUIREMENTS.md update (`e417f916 docs(47-02)`) explicitly left TML-06 unmarked (the capsule was still upcoming in plan 47-04), and the 47-04/47-05 docs commits never updated the marker. The code delivers the capsule and all its tests pass. This is a stale tracker, not a code defect — but the requirement traceability file must be reconciled.
2. **ROADMAP "Plans: 4/5 plans executed" is stale.** All five 47-xx plans are marked [x], and the 47-05 docs commit claims "position plan 5 of 5", but the plan-count line still reads 4/5.
3. **TML-07 requirement text carries the pre-correction French label** ('clip suivant — interrompt la boucle'). The shipped code deliberately uses the English 'next clip — interrupts the loop' per the user copy correction (D-14), which is correct; only the requirement text was never updated.

None of these change the code-verified outcome. All three are documentation/tracking items for a human to reconcile.

### Gaps Summary

No code gaps. The phase goal is observably true in the codebase: every must-have truth is verified by existence + substantive implementation + full wiring + passing behavior tests (all 10 phase suites re-run green here; `tsc --noEmit` exit 0). Status is human_needed only because the 47-02..47-05 UI surfaces have not yet had a native visual/interaction UAT recorded, and because the three tracking inconsistencies above need a human decision.

---

_Verified: 2026-08-25T20:30:00Z_
_Verifier: Claude (gsd-verifier)_
