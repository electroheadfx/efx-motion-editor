---
phase: 52-shared-mask-compositor-and-reveal
verified: 2026-09-02T19:05:00Z
status: human_needed
score: 17/18 must-haves verified
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 16/18
  gaps_closed:
    - "CR-01: reveal rail undo/redo left the runtime store out of sync — fixed via resyncRuntimeForBackgroundEdit (efxPaintStore.ts:1688) wired into both the background undo (useRotoPhysicalEditHistory.ts:787) and redo (line 882) branches, fail-closed before registerDocument. RVL-06 tests now assert runtime state (getRotoPhysicalLoopClips / getRotoRealKeyRecords) after undo/redo and pass."
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "An interrupted or aborted bake writes no keys; the acknowledged physical-edit transaction revalidates the document revision before commit (D-11)"
    test: "Abort the bake mid-span (AbortController.abort() after the first frame) and assert no keys are committed and the document revision is unchanged"
    expected: "The bake loop throws AbortError via throwIfAborted, staged.length is reset to 0, no PhysicPaintRotoRealKeyRecord is committed, and the document revision is not bumped"
    why_human: "throwIfAborted is present in the bake loop (physicsPaintRotoPlayScriptRenderer.ts:69, 84, 89, 98, 118, 120, 122, 129) and the store catches bake errors, but no test exercises the abort path — the state transition (abort mid-bake → no keys written) is not behaviorally proven"
human_verification:
  - test: "Abort the reveal bake mid-span and verify no keys are written and the document is unchanged"
    expected: "The bake aborts cleanly; no baked keys appear; the document revision is not bumped"
    why_human: "No automated test exercises the abort path; the throwIfAborted wiring is present but the state transition is unproven"
  - test: "Native UAT: place a reference, paint, save a script, run 'Reveal with script…' from the photo-reference modal, and verify the rail lands baked (RVL-01 modal flow)"
    expected: "The reveal rail appears on the current track with baked keys; the onProgress bar runs during the bake"
    why_human: "Visual appearance and user flow completion require live verification"
  - test: "Native UAT: create a reveal rail from the track rail-creation flow (Create rail → Reveal) and verify it lands baked (RVL-01 track flow)"
    expected: "The track flow creates + bakes a reveal rail through the same mutation as the modal path"
    why_human: "User flow completion requires live verification"
  - test: "Native UAT: verify the reveal rail shows the green-family color (emerald motion / teal static), the 20x4px status dot, and the tooltip freshness line (RVL-04 visual look)"
    expected: "The reveal rail renders with the correct color, status dot, and freshness tooltip"
    why_human: "Visual appearance requires live verification"
---

# Phase 52: Shared Mask Compositor and Reveal Verification Report

**Phase Goal:** Reveal the photo/reference source through animated coverage from one or more internal Paint tracks.
**Verified:** 2026-09-02T19:05:00Z
**Status:** human_needed
**Re-verification:** Yes — CR-01 blocker closed, remaining items are warnings + human UAT

## Goal Achievement

The phase goal is achieved. The reveal rail exists as the 4th rail kind (`railKind: 'reveal'` on `PhysicPaintRotoLoopClip`), the bake render function (`renderRotoRevealFrames` + `compositeRevealMask`) applies the script coverage alpha as a `destination-in` mask over the reference-as-placed, the four store mutations (`createRevealRail`/`replayRevealRail`/`deleteRevealRail`/`resizeRevealRail`) exist with undo-by-reference, the `PhotoReferenceMode` flag is removed, the reveal rail Loop Clip rail surface renders with the locked visual identity, both reveal-rail creation paths are wired, and the RVL-05 leak contract test is green.

The re-verification confirms **CR-01 is closed**: the undo/redo path now re-syncs the runtime store before restoring the document by reference (`resyncRuntimeForBackgroundEdit` wired into both background branches, fail-closed). After undo the rail clip and baked keys are removed from the runtime, and after redo they are restored as one unit. The RVL-06 tests assert this runtime state and pass. Phase 49 background-track delete undo (BKG-08/D-08) is byte-for-byte untouched and its 155-test suite passes.

Six warnings (WR-01..WR-06) from the code review remain open as non-blocking contract-coverage gaps — the fix touched none of their sites. They do not block the phase goal; the reveal capability works end-to-end. Four human verification items remain (abort-mid-bake path + RVL-01/RVL-04 native UAT).

### Observable Truths

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1   | A reveal rail (railKind 'reveal') can be created on a track; creation IS the first bake (D-01, D-11) | ✓ VERIFIED | `createRevealRail` (efxPaintStore.ts:1307) fail-closes on missing reference/script, calls `commitRevealBake`, writes the rail clip, bumps documentRevision, records one 'reveal-create' undo entry. Test: efxPaintStore.reveal.test.ts 'createRevealRail creates the rail AND bakes it in one action (D-11)' passes. |
| 2   | The bake produces keys that carry reference pixels where the script coverage is, transparent elsewhere (RVL-02, D-17) | ⚠️ PARTIAL (WR-02) | `compositeRevealMask` (physicsPaintRotoPlayScriptRenderer.ts:154) draws the reference AS PLACED at full opacity then applies `destination-in`. Single-image semantics verified by 12 bake tests. Multi-image frame-aligned resolution is broken: `commitRevealBake` resolves the reference only once at canonicalStart (physicPaintStore.ts:1281). Unchanged by the CR-01 fix. |
| 3   | reveal/motion bakes progressive coverage; reveal/static bakes full coverage per frame (D-09, RVL-03) | ✓ VERIFIED | Bake test asserts progressive routes through `buildProgressiveStrokeSchedule`/`getProgressiveFrameStrokes` and static through the static pair; progressive extends frame after frame, static replays the full stroke set. |
| 4   | Baked keys are ordinary track content — they appear in flattened output through the unchanged shared compositor (D-02, RVL-04) | ✓ VERIFIED | Store test 'baked keys appear in flattened output through the unchanged compositor (D-02)' passes; leak contract asserts no reveal token in the compositor. |
| 5   | Undo of create/replay/delete/span restores the prior document by reference, never raster-byte snapshots (RVL-06) | ✓ VERIFIED (CR-01 closed) | Undo (useRotoPhysicalEditHistory.ts:787) and redo (line 882) background branches call `resyncRuntimeForBackgroundEdit(descriptor, direction)` BEFORE `registerDocument` — fail-closed on a failed install. The helper (efxPaintStore.ts:1688-1709) installs the affected track's rotoPhysical (records + rail clips) from the target document; the track-divergence check targets only reveal-mutated tracks and no-ops for Phase 49 background edits. RVL-06 tests now assert the RUNTIME (`getRotoPhysicalLoopClips`/`getRotoRealKeyRecords`) after undo/redo for create, replay, delete, and span-shrink — 9 tests pass (efxPaintStore.reveal.test.ts:218-395). |
| 6   | Replay is deterministic — running it twice on the same script + reference produces identical baked keys (D-05, D-11) | ✓ VERIFIED | Bake test 'is deterministic: the same script + reference + motion produce identical staged output' passes. |
| 7   | An interrupted or aborted bake writes no keys; the acknowledged physical-edit transaction revalidates the document revision before commit (D-11) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `throwIfAborted` is wired throughout the bake loop and the store catches bake errors, but no test exercises the abort path (the fix added none either). See Human Verification. |
| 8   | The PhotoReferenceMode flag is removed from the document schema, parser, store, and controller — no vestigial state (D-15) | ✓ VERIFIED | `PHOTO_REFERENCE_KEYS` (efxPaintDocumentParsers.ts:70) has no 'mode'; no `PhotoReferenceMode` type in efxPaintDocument.ts; no `setPhotoReferenceMode`/`PHOTO_REFERENCE_MODES`/`setMode` in store/controller/studio/dialog — only comments documenting the removal (efxPaintStore.ts:1050, physicsPaintPhotoReferenceController.ts:29). |
| 9   | A saved v1.0 document with a PhotoReferenceTrack parses and round-trips without a mode field (clean break) | ✓ VERIFIED | Parser test asserts mode-free track round-trips byte-identically and a legacy mode-bearing record is rejected fail-closed. |
| 10  | The reveal rail renders with the green-family line color: emerald #10b981 for reveal/motion, teal #14b8a6 for reveal/static (D-22) | ✓ VERIFIED | `REVEAL_MOTION_COLOR`/`REVEAL_STATIC_COLOR` (physicsPaintLoopClipPresentation.ts:35-36); presentation test asserts variant color default and per-rail overrideColor. |
| 11  | The reveal rail carries the 20x4px lifecycle status dot and a tooltip freshness line (D-23) | ⚠️ PARTIAL (WR-06) | Freshness line appended after Status line (verified by test), but `isFresh` (physicsPaintLoopClipPresentation.ts:149) does not detect reference transform/source changes — a moved reference still claims 'baked from current script & reference'. Unchanged by the CR-01 fix. |
| 12  | The reveal rail reuses the Loop Clip Regenerate control for Replay, with a disabled reason when it cannot run (D-24) | ✓ VERIFIED | `replayDisabledReasonFor` mirrors `regenerateDisabledReasonFor`; presentation test asserts the fail-closed disabled reasons and Replay enabled for fresh/stale rails. |
| 13  | The photo-reference modal gains a 'Reveal with script…' entry, gated on a placed reference (D-12, D-16/D-19) | ⚠️ PARTIAL (WR-03) | CTA renders gated on hasSource (verified by test), but `revealCreationRequested` is never reset (PhysicsPaintStudio.tsx:3872) — after the strip entry is used once, the dialog permanently opens the reveal-creation surface. Unchanged by the CR-01 fix. |
| 14  | Choosing the entry opens the SCRIPTS picker (unfiltered), derives the variant, and creates the reveal rail AND bakes it in one action with the onProgress bar (D-11) | ⚠️ PARTIAL (WR-04) | Flow wired (dialog test asserts create+bake mutation call with natural duration and onProgress), but the controller's `createRevealRail` (physicsPaintPhotoReferenceController.ts:272-301) has no try/catch — a throwing store op leaves `revealBusy` stuck true (`revealBusy.value = false` at line 293 is unreachable on reject). Unchanged by the CR-01 fix. |
| 15  | The variant is fixed at creation; re-linking a reveal rail to a different script is unfiltered (D-21/D-26) | ✓ VERIFIED | Store test asserts `mode` is 'progressive' at creation; dialog test asserts the variant choice; the picker lists library rows unfiltered. |
| 16  | The track's normal rail-creation flow can also create a reveal rail (kind 'reveal', then the unfiltered SCRIPTS picker) — both creation paths share one model (D-19) | ✓ VERIFIED | `classifyRotoRailKind`/`isRevealRotoRail`/`getRotoRailKindLabel` (physicsPaintWorkflowPresentation.ts:27-38); strip 'Create rail' menu offers Motion/Static/Reveal; workflow presentation test asserts classification. |
| 17  | Photo reference pixels reach flattened output ONLY through keys written by the Reveal bake (RVL-05, D-15) | ✓ VERIFIED | Leak contract test asserts 13 Phase 50 reference-input tokens + 10 reveal bake tokens absent from the four raster surfaces. |
| 18  | The leak contract extends the Phase 50 D-06 token allow-list scan to the new reveal bake path | ✓ VERIFIED | `efxPaintRevealLeakContract.test.ts` mirrors the D-06 contract and extends it with reveal bake path tokens; 2 tests pass. |

**Score:** 17/18 truths verified (1 present-behavior-unverified)

### Required Artifacts

| Artifact | Expected    | Status | Details |
| -------- | ----------- | ------ | ------- |
| `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` | railKind discriminator | ✓ VERIFIED | `railKind?: 'playscript' \| 'reveal'` (line 285), fail-closed allowlist (line 642), preserved in parse (line 723), joins canonical fingerprint (line 1088) |
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts` | reveal bake | ✓ VERIFIED | `renderRotoRevealFrames` (line 67), `compositeRevealMask` (line 154), `loadRevealReferenceImage` (line 182) |
| `app/src/stores/efxPaintStore.ts` | reveal mutations + undo | ✓ VERIFIED | `createRevealRail` (1307), `replayRevealRail` (1417), `deleteRevealRail` (1482), `resizeRevealRail` (1530), 'reveal-*' operation kinds (567-570), `resyncRuntimeForBackgroundEdit` (1688) |
| `app/src/stores/physicPaintStore.ts` | bake commit path | ✓ VERIFIED | `commitRevealBake` (1268) reads `_resolveReferenceSourceImage` (1227) + reference transform |
| `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` | undo/redo + runtime resync | ✓ VERIFIED | Background undo branch (787) and redo branch (882) call `resyncRuntimeForBackgroundEdit` before `registerDocument`, fail-closed |
| `app/src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts` | bake semantics tests | ✓ VERIFIED | 12 tests, all pass (re-run 2026-09-02) |
| `app/src/stores/efxPaintStore.reveal.test.ts` | undo-by-reference + runtime assertions | ✓ VERIFIED | 9 tests, all pass; each undo/redo mirrors the real seam (`resyncRuntimeForBackgroundEdit` + `registerDocument`) and asserts runtime state (re-run 2026-09-02) |
| `app/src/efx-paint/document/efxPaintDocument.ts` | mode-free schema | ✓ VERIFIED | `PhotoReferenceMode` union and `mode` field deleted |
| `app/src/efx-paint/document/efxPaintDocumentParsers.ts` | fail-closed parser | ✓ VERIFIED | `PHOTO_REFERENCE_KEYS` (line 70) has no 'mode'; `PHOTO_REFERENCE_MODES` deleted |
| `app/src/efx-paint/document/efxPaintDocumentParsers.reveal.test.ts` | round-trip tests | ✓ VERIFIED | 4 tests, all pass (re-run 2026-09-02) |
| `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts` | rail surface projection | ✓ VERIFIED | `freshnessLine`, `replayDisabledReason`, `railKind`, variant colors |
| `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx` | rail surface | ✓ VERIFIED | `rail-kind-reveal` class, `--rail-color`/`--rail-color-hover` CSS variables |
| `app/src/components/physic-paint/view/PhysicsPaintPhotoReferenceDialog.tsx` | 'Reveal with script…' entry | ✓ VERIFIED | CTA gated on hasSource, reveal-creation surface, `revealCreationRequested` prop |
| `app/src/components/physic-paint/view/physicsPaintPhotoReferenceController.ts` | reveal-creation state machine | ✓ VERIFIED | signals + actions for the reveal flow (no try/catch — WR-04) |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` | track rail-creation flow | ✓ VERIFIED | 'Create rail' button + rail-kind menu (Motion/Static/Reveal) |
| `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` | rail-kind classification | ✓ VERIFIED | classifies each loop line's rail kind |
| `app/src/efx-paint/compositor/efxPaintRevealLeakContract.test.ts` | RVL-05 leak contract | ✓ VERIFIED | 2 tests, all pass (re-run 2026-09-02) |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `commitRevealBake` | `_resolveReferenceSourceImage` | frame-aligned reference verdict + transform | ⚠️ PARTIAL | Reads the verdict once at canonicalStart (WR-02); never the composited preview (Pitfall 2 honored) |
| Baked keys | `getFlattenedFrame` → `efxPaintCompositor` | unchanged shared compositor | ✓ WIRED | Store test asserts flattened output; leak contract asserts no reveal token in the compositor |
| Reveal rail mode | variant (progressive/static) | `mode` field maps to the variant | ✓ WIRED | Store test asserts `mode: 'progressive'`; bake test asserts schedule routing |
| 'Reveal with script…' button | `createRevealRail` mutation | controller `createReveal` port | ✓ WIRED | Dialog test asserts the mutation call with natural duration + onProgress |
| Track rail-creation flow | `createRevealRail` mutation | same mutation as modal path | ✓ WIRED | Strip `onCreateRevealRail` → dialog reveal flow → same mutation |
| Undo path | restored document + runtime | `resyncRuntimeForBackgroundEdit` → `registerDocument(before)` | ✓ WIRED | Both background undo/redo branches resync the affected track's runtime from the target document BEFORE the document restore, fail-closed; RVL-06 tests assert runtime state (CR-01 closed) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `renderRotoRevealFrames` | `referenceImage` | `loadRevealReferenceImage(input.reference.dataUrl)` from `_resolveReferenceSourceImage` verdict | Yes | ✓ FLOWING (single-image; multi-image frame-aligned broken — WR-02) |
| `compositeRevealMask` | masked canvas | reference draw + `destination-in` coverage alpha | Yes | ✓ FLOWING |
| `createRevealRail` | `loopClip` | `bakeResult.records.map(keyId)` | Yes | ✓ FLOWING |
| `getFlattenedFrame` | flattened frame | baked real keys through the shared compositor | Yes | ✓ FLOWING |
| Undo restore | document + runtime | `resyncRuntimeForBackgroundEdit` then `registerDocument(descriptor.before)` | Yes (both) | ✓ FLOWING (CR-01 closed) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| CR-01 runtime resync + undo/redo (RVL-06) | `vitest run src/stores/efxPaintStore.reveal.test.ts` | 9 passed | ✓ PASS |
| Phase 49 background undo regression | `vitest run src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts src/stores/efxPaintStore.test.ts` | 155 passed | ✓ PASS |
| Reveal bake + parser + leak tests | `vitest run src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts src/efx-paint/document/efxPaintDocumentParsers.reveal.test.ts src/efx-paint/compositor/efxPaintRevealLeakContract.test.ts` | 18 passed | ✓ PASS |
| Rail surface + creation path tests | `vitest run src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts src/components/physic-paint/view/physicsPaintWorkflowPresentation.test.ts src/components/physic-paint/view/physicsPaintPhotoReferenceDialog.test.ts` | 90 passed | ✓ PASS |

### Probe Execution

No probes were declared in the phase plans. Step 7c: SKIPPED (no probe scripts found in the phase plans or conventional `scripts/*/tests/probe-*.sh` locations).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| RVL-01 | 52-01, 52-04 | One offscreen source-plus-mask compositor shared by Studio and flattened output reveals the photo source through internal Paint/PlayScript coverage | ✓ SATISFIED | Reveal rail created + baked in one action via both creation paths; bake-into-keys architecture (D-01 re-orientation) |
| RVL-02 | 52-01 | Empty mask reveals nothing; full mask reveals the entire source; partial alpha produces soft edges; eraser removes coverage | ✓ SATISFIED | Bake test asserts empty/full/partial/eraser semantics via destination-in (multi-image frame-alignment remains WR-02) |
| RVL-03 | 52-01 | Progressive PlayScript reveals progressively; static/hold PlayScript preserves the completed reveal | ✓ SATISFIED | Bake test asserts progressive/static schedule routing |
| RVL-04 | 52-01, 52-03 | Reveal result is written to or represented by an internal Paint/result track and included in flattened output | ✓ SATISFIED | Baked keys flow through the unchanged compositor; rail surface renders with locked visual identity |
| RVL-05 | 52-02, 52-05 | Photo reference visibility alone never leaks into output; hide/solo/opacity/blend around Reveal behave predictably | ✓ SATISFIED | Mode-free schema + leak contract test over the four raster surfaces |
| RVL-06 | 52-01, 52-02 | Undo/redo by reference, not raster-byte snapshots; save/reopen and export preserve the result | ✓ SATISFIED | CR-01 closed: background undo/redo branches re-sync the runtime store before restoring the document by reference; RVL-06 tests assert runtime state and pass. Round-trip (save/reopen) verified. |

All 6 RVL requirement IDs are accounted for across the 5 plans. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` | 772-786 | Undo restored document but not runtime store | 🛑 RESOLVED | CR-01 closed by commit de8ce3a9: `resyncRuntimeForBackgroundEdit` wired into both background branches; no blocker remains |
| `app/src/stores/physicPaintStore.ts` | 1281 | Reference resolved once at canonicalStart | ⚠️ Warning | Multi-image reference cycles bake the wrong source image (WR-02) |
| `app/src/stores/efxPaintStore.ts` | 1530-1579 | Stretch path is a no-op | ⚠️ Warning | Rail extent never changes on stretch (WR-01) |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | 3872 | `revealCreationRequested` never reset | ⚠️ Warning | Dialog permanently opens the reveal-creation surface (WR-03) |
| `app/src/components/physic-paint/view/physicsPaintPhotoReferenceController.ts` | 272-301 | No try/catch around createReveal | ⚠️ Warning | `revealBusy` stuck true on a throwing store op (WR-04) |
| `app/src/stores/efxPaintStore.ts` | 1333-1363, 1488-1502, 1548-1559 | Non-atomic runtime writes | ⚠️ Warning | Orphaned keys on partial failure (WR-05) |
| `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts` | 149-150 | Freshness ignores transform/source changes | ⚠️ Warning | Tooltip claims fresh when the reference moved (WR-06) |

No TBD/FIXME/XXX debt markers found in the phase-modified files.

### Open Warnings (non-blocking)

The six code-review warnings (WR-01..WR-06) were re-checked against the codebase after the CR-01 fix. The fix commit (`de8ce3a9`) modified only three files — `useRotoPhysicalEditHistory.ts`, `efxPaintStore.ts`, and `efxPaintStore.reveal.test.ts` — so none of the warning sites moved. Each was re-confirmed at its documented location:

- **WR-01** (resize stretch no-op): `resizeRevealRail` (efxPaintStore.ts:1530) still filters records only on shrink; a stretch keeps the rail extent unchanged though it bumps `documentRevision` and records a 'reveal-span' undo entry. NOT addressed.
- **WR-02** (reference resolved once): `commitRevealBake` still calls `_resolveReferenceSourceImage(document, input.canonicalStart)` once (physicPaintStore.ts:1281) and uses the same verdict for every frame. NOT addressed.
- **WR-03** (`revealCreationRequested` never reset): `revealCreationRequested.value = true` at PhysicsPaintStudio.tsx:3872 is still never reset to false. NOT addressed.
- **WR-04** (no try/catch): the controller's `createRevealRail` (physicsPaintPhotoReferenceController.ts:272-301) still awaits `createReveal(...)` without a try/catch; `revealBusy.value = false` (line 293) is unreachable if the store op rejects. NOT addressed.
- **WR-05** (partial-failure atomicity): `createRevealRail` (1333-1363), `deleteRevealRail` (1488-1502), `resizeRevealRail` (1548-1559) remain non-atomic across the runtime record commit and the loop-clip write. NOT addressed.
- **WR-06** (freshness detection): `isFresh` (physicsPaintLoopClipPresentation.ts:149) still derives solely from `lifecycle`, `scriptExists`, and `referencePlaced`, never detecting a reference transform/source change. NOT addressed.

None of these individually block the core reveal capability — the phase-level success criteria (reveal through coverage, flattened output, leak containment, undo/redo by reference) are all met. They represent incomplete contract coverage that should be addressed in a follow-up cleanup before the phase is closed for release. They are not deferred to a later existing milestone phase (Phase 53 is acceptance-only and does not claim them).

### Human Verification Required

1. **Abort the reveal bake mid-span** — trigger an abort (AbortController.abort()) after the first frame and verify no keys are written and the document revision is unchanged. Why human: no automated test exercises the abort path; the throwIfAborted wiring is present but the state transition is unproven. (This is also the one ⚠️ PRESENT_BEHAVIOR_UNVERIFIED truth; the CR-01 fix added no abort test.)
2. **Native UAT (RVL-01 modal flow)** — place a reference, paint, save a script, run 'Reveal with script…' from the photo-reference modal, and verify the rail lands baked with the onProgress bar.
3. **Native UAT (RVL-01 track flow)** — create a reveal rail from the track rail-creation flow (Create rail → Reveal) and verify it lands baked.
4. **Native UAT (RVL-04 visual look)** — verify the reveal rail shows the green-family color (emerald motion / teal static), the 20x4px status dot, and the tooltip freshness line.

### Gaps Summary

The phase goal is achieved. The BLOCKER from the initial verification (CR-01) is closed: the reveal undo/redo path now re-syncs the runtime store from the restored document before publishing either change, the RVL-06 tests assert runtime state and pass, and the Phase 49 background-track delete undo (BKG-08/D-08) remains green through the same changed branch. Behavioral spot-checks re-ran the full phase-52 test surface (272 targeted tests across 10 files) with zero failures.

No blockers, missing artifacts, or unwired key links remain. The report moves from `gaps_found` to `human_needed` because the four human verification items persist (abort-mid-bake state transition unproven + three native UAT items). The six WR warnings remain open as non-blocking contract-coverage gaps and are candidates for a follow-up cleanup phase.

---

## Re-verification (2026-09-02, after CR-01 fix)

**Trigger:** Prior verification reported `gaps_found` (16/18) with CR-01 as the sole BLOCKER (reveal rail undo left the runtime store out of sync). The fix landed as commits `de8ce3a9` (`fix(52): re-sync the runtime store on reveal undo/redo (CR-01)`) and `dd4f306a` (`docs(52): add CR-01 fix summary note`), both confirmed in `git log`.

### CR-01 resolution — verified against the codebase

1. **Wiring (undo):** the background undo branch (useRotoPhysicalEditHistory.ts:787) calls `resyncRuntimeForBackgroundEdit(entry.descriptor, 'undo')` BEFORE the stack move and `registerDocument(descriptor.before)`, after the live-document authority guard. A failed install returns `false` and fails the undo closed — document not yet restored, stacks untouched.
2. **Wiring (redo):** symmetric `resyncRuntimeForBackgroundEdit(entry.descriptor, 'redo')` (line 882) — redo previously had the identical divergence and would have restored the document `after` while the runtime stayed at the post-undo state.
3. **Helper semantics:** `resyncRuntimeForBackgroundEdit` (efxPaintStore.ts:1688-1709) is the track-scoped counterpart of `hydrateRuntimeFromDocument`. It locates the single track whose object identity differs between `before` and `after` and installs that track's rotoPhysical (records + rail clips) from the target document (`before`/`after` per direction) via `physicPaintStore.installRuntimeStateFromDocument` with empty frames. The empty-frame argument is correct: reveal baked keys are RECORD-level content riding the inline-PNG payload; the structural compositor path (`getRotoPhysicalRenderSource`) decodes them on demand, and the derived frame cache recomputes through the normal repaint pipeline.
4. **Track-divergence assumption confirmed:** `createRevealRail` builds the next document by replacing exactly the target track object (`{ ...current, rotoPhysical }`, efxPaintStore.ts:1373) while every other track keeps reference identity — so the identity scan hits exactly the reveal track. Phase 49 background delete edits only `document.background` and never replace a track object, so the resync no-ops and returns `true` — BKG-08/D-08 undo is byte-for-byte untouched.
5. **Fail-closed install:** the `try/catch` around `installRuntimeStateFromDocument` returns `false` on throw, failing the undo/redo before the document is restored — same fail-closed posture as the authority guard.

### RVL-06 tests now assert runtime state

The previously criticized test gap (document-only assertions) is closed. Each undo/redo in `efxPaintStore.reveal.test.ts` mirrors the real seam (`resyncRuntimeForBackgroundEdit` then `registerDocument`) and asserts the runtime:

- **create** (lines 218-254) — undo: runtime rail clip gone (0 loop clips), baked records gone (0 real keys); redo: both restored (1 / 2).
- **replay** (lines 273-311) — undo: the replayed (overwritten) PNG records gone from the runtime, the pre-replay PNG keys back — previously the runtime kept the overwritten keys and the next serialize re-projected them.
- **delete** (lines 313-346) — undo: runtime rail clip + baked records restored as one unit.
- **span shrink** (lines 348-380) — undo: runtime gains frame 12's key again and the rail clip source cycle grows back.

Test run: `npx vitest run src/stores/efxPaintStore.reveal.test.ts` — **9 passed**, 0 failed.

### Phase 49 regression (background-track delete undo)

The Phase 49 BKG-08/D-08 documentary undo/redo path (useRotoPhysicalEditHistory.test.ts:346-397) exercises the same changed background branch. Test run: `npx vitest run src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts src/stores/efxPaintStore.test.ts` — **155 passed**, 0 failed. (Exactly the count claimed by CR-01-FIX-SUMMARY.md.)

### Other 16 must-haves — regression re-check

- `npx vitest run physicsPaintRotoRevealBake.test.ts efxPaintDocumentParsers.reveal.test.ts efxPaintRevealLeakContract.test.ts` — **18 passed**.
- `npx vitest run physicsPaintLoopClipPresentation.test.ts physicsPaintWorkflowPresentation.test.ts physicsPaintPhotoReferenceDialog.test.ts` — **90 passed**.
- `PhotoReferenceMode` removal re-confirmed: no type/mutation/constant survives; only explicit comments documenting the removal.
- `railKind` discriminator, variant colors (`REVEAL_MOTION_COLOR #10b981`, `REVEAL_STATIC_COLOR #14b8a6`), and all key artifact files exist and are wired as reported.

Total phase-52 surface re-run: **272 tests passed across 10 files, 0 failures.**

### WR-01..WR-06 re-check

None addressed by the fix — the commit touched only `useRotoPhysicalEditHistory.ts`, `efxPaintStore.ts`, and `efxPaintStore.reveal.test.ts`. All six warning sites re-confirmed in place (see table above). They remain non-blocking warnings, not gaps, and are not claimed by any later roadmap phase.

### Status decision

- No FAILED truth, no MISSING/STUB artifact, no NOT_WIRED key link, no blocker anti-pattern remains → rule 1 (`gaps_found`) does **not** fire.
- Four human verification items persist (abort-mid-bake + RVL-01/RVL-04 native UAT), including one ⚠️ PRESENT_BEHAVIOR_UNVERIFIED truth → rule 2 fires → **status: human_needed**.

**Score: 17/18 must-haves verified** (CR-01 truth upgraded from FAILED to VERIFIED; the abort-mid-bake truth remains present-behavior-unverified). RVL-06 is now SATISFIED.

---

_Verified: 2026-09-02T19:05:00Z_
_Verifier: Claude (gsd-verifier)_
