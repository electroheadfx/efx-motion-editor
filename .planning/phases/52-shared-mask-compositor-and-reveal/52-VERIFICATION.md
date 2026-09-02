---
phase: 52-shared-mask-compositor-and-reveal
verified: 2026-09-02T16:35:00Z
status: gaps_found
score: 16/18 must-haves verified
behavior_unverified: 1
overrides_applied: 0
gaps:
  - truth: "Undo of create/replay/delete/span restores the prior document by reference (RVL-06)"
    status: failed
    reason: "CR-01 (code review): the undo path (useRotoPhysicalEditHistory.ts:772-786) restores the document via registerDocument(entry.descriptor.before) but never re-syncs the runtime store. The reveal mutations mutate the runtime (commitRevealBake commits baked records, replaceRotoPhysicalLoopClips writes the rail clip). After undo the runtime still holds the rail clip + baked keys; the Studio renders rails from the runtime (PhysicsPaintStudio.tsx:622), so the rail stays visible after undo, and the next serializeRuntimeIntoDocument re-projects the orphaned keys back into the document. The RVL-06 tests (efxPaintStore.reveal.test.ts:209-228) only assert the document object, never the runtime, so the divergence is not caught."
    artifacts:
      - path: app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
        issue: "Undo/redo for background entries calls registerDocument(before/after) and never re-hydrates the runtime store"
      - path: app/src/stores/efxPaintStore.reveal.test.ts
        issue: "RVL-06 tests assert only the document rotoPhysical projection, never physicPaintStore.getRotoPhysicalLoopClips / getRotoRealKeyRecords after undo"
    missing:
      - "Re-hydrate the runtime from the restored document after registerDocument in the undo path (hydrateRuntimeFromDocument exists at efxPaintStore.ts:1631 but is not wired into the undo path), OR do not record reveal undo entries until the runtime rollback seam exists"
      - "Add a runtime assertion to the RVL-06 tests: physicPaintStore.getRotoPhysicalLoopClips(layerId, trackId) and getRotoRealKeyRecords must be empty after undo"
  - truth: "The bake produces keys that carry reference pixels where the script coverage is, transparent elsewhere (RVL-02 generation-time, D-17)"
    status: partial
    reason: "WR-02 (code review): commitRevealBake resolves the reference only once at canonicalStart (physicPaintStore.ts:1281) and passes the same verdict.dataUrl to renderRotoRevealFrames for every frame. For a multi-image reference cycle, all baked keys use the image at source frame canonicalStart instead of frame-aligned images 0/1/2. The D-15 frame-aligned contract is violated for multi-image references. Tests only exercise single-image references."
    artifacts:
      - path: app/src/stores/physicPaintStore.ts
        issue: "_resolveReferenceSourceImage(document, input.canonicalStart) called once; same dataUrl used for every frame of the span"
    missing:
      - "Resolve the reference per frame inside the bake loop (or pass a per-frame resolver into renderRotoRevealFrames) so frame canonicalStart + i uses _resolveReferenceSourceImage(document, canonicalStart + i)"
      - "Add a multi-image reference test asserting each baked key carries the frame-aligned image"
  - truth: "Undo of create/replay/delete/span restores the prior document by reference (RVL-06) — span stretch honors D-07"
    status: partial
    reason: "WR-01 (code review): resizeRevealRail stretch is a no-op — the rail extent never changes. A stretch (newEndExclusive > current end) keeps every key, survivingKeyIds equals the full sourceKeyIds, repeat stays 1, and no lifecycle fields are set. The D-07 contract ('stretching keeps existing keys and leaves the new frames empty until a voluntary Replay') is not honored — the new frames are never part of the rail. Shrink works (deletes outside keys)."
    artifacts:
      - path: app/src/stores/efxPaintStore.ts
        issue: "resizeRevealRail (lines 1530-1579) only filters records on shrink; stretch leaves the rail extent unchanged yet still bumps documentRevision and records a 'reveal-span' undo entry"
    missing:
      - "On a stretch, update the clip's span metadata (lifecycle phaseOrigin/originalEndExclusive/visibleRanges or increase repeat) so the resolver derives the new extent"
      - "Add a test asserting the derived range's effectiveEnd after a stretch"
  - truth: "The photo-reference modal gains a 'Reveal with script…' entry, gated on a placed reference (D-12 creation guard, D-16/D-19)"
    status: partial
    reason: "WR-03 (code review): the strip's 'Reveal' entry sets revealCreationRequested.value = true (PhysicsPaintStudio.tsx:3872) and never resets it. After the strip entry is used once, every subsequent open of the photo reference dialog shows the reveal-creation surface instead of the normal dialog — the user can never reach the opacity/lock/source controls again without a full Studio remount."
    artifacts:
      - path: app/src/components/physic-paint/PhysicsPaintStudio.tsx
        issue: "revealCreationRequested.value = true at line 3872 is never reset to false"
    missing:
      - "Reset revealCreationRequested.value = false when the flow completes (after createRevealRail succeeds) or when the dialog closes (onClose), or make the dialog consume the one-shot flag"
  - truth: "Choosing the entry opens the SCRIPTS picker, derives the variant, and creates the reveal rail AND bakes it in one action with the existing onProgress bar (D-11)"
    status: partial
    reason: "WR-04 (code review): createRevealRail in the controller (physicsPaintPhotoReferenceController.ts:272-301) awaits createReveal(...) without a try/catch. If the store op throws (e.g. _revealScriptLoader rejects at efxPaintStore.ts:1327), revealBusy.value stays true and the dialog's Create button is permanently disabled with 'Baking…' — the user cannot cancel or retry."
    artifacts:
      - path: app/src/components/physic-paint/view/physicsPaintPhotoReferenceController.ts
        issue: "No try/catch around await createReveal(...); a throwing store op leaves revealBusy stuck true"
    missing:
      - "Wrap the await createReveal(...) in a try/catch that sets revealBusy.value = false and revealError.value to a generic failure copy on throw"
  - truth: "Undo of create/replay/delete/span restores the prior document by reference (RVL-06) — mutations are atomic"
    status: partial
    reason: "WR-05 (code review): the reveal mutations are not atomic across the runtime writes. createRevealRail commits the baked records via commitRevealBake first, then calls replaceRotoPhysicalLoopClips; if the loop clip write fails, the baked keys remain in the runtime with no rail record and no undo entry. deleteRevealRail and resizeRevealRail have the same ordering hazard in reverse. Any partial state leaves orphaned keys that the next serialize re-projects into the document."
    artifacts:
      - path: app/src/stores/efxPaintStore.ts
        issue: "createRevealRail (1333-1363), deleteRevealRail (1488-1502), resizeRevealRail (1548-1559) are not atomic across runtime writes"
    missing:
      - "Order the writes so a failure cannot leave orphaned state (validate the loop clip collection before committing records, or roll back the records on a loop clip failure)"
  - truth: "The reveal rail carries the 20x4px lifecycle status dot and a tooltip with the Loop Clip facts plus a freshness line (D-23)"
    status: partial
    reason: "WR-06 (code review): isFresh (physicsPaintLoopClipPresentation.ts:149-150) is computed from lifecycle === 'synchronized' && scriptExists !== false && referencePlaced !== false. It never detects a reference transform change (setPhotoReferenceTransform) or a source image replacement (setPhotoReferenceSource). After the user moves the reference, the baked keys are stale but the tooltip still says 'baked from current script & reference'. The referencePlaced boolean is derived from photoReference !== null, which cannot distinguish a moved reference from an unchanged one."
    artifacts:
      - path: app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts
        issue: "Freshness line does not detect reference transform/source changes"
    missing:
      - "Feed a reference-content token (e.g. _referenceSourceRevision plus the transform) into the presentation options and compare it against a bake-time snapshot stored on the rail record"
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
**Verified:** 2026-09-02T16:35:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

The phase goal is substantially achieved: the reveal rail exists as the 4th rail kind (`railKind: 'reveal'` on `PhysicPaintRotoLoopClip`), the bake render function (`renderRotoRevealFrames` + `compositeRevealMask`) applies the script coverage alpha as a `destination-in` mask over the reference-as-placed, the four store mutations (`createRevealRail`/`replayRevealRail`/`deleteRevealRail`/`resizeRevealRail`) exist with undo-by-reference, the `PhotoReferenceMode` flag is removed, the reveal rail Loop Clip rail surface renders with the locked visual identity, both reveal-rail creation paths are wired, and the RVL-05 leak contract test is green.

However, the code review's critical finding (CR-01) is confirmed in the codebase: the undo path restores the document by reference but never re-syncs the runtime store, so after undo the rail stays visible and the next serialize re-projects the orphaned keys back into the document. This is a user-visible functional defect in the RVL-06 undo behavior and blocks full goal achievement. Six additional warnings (WR-01..WR-06) are confirmed as partial implementations.

### Observable Truths

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1   | A reveal rail (railKind 'reveal') can be created on a track; creation IS the first bake (D-01, D-11) | ✓ VERIFIED | `createRevealRail` (efxPaintStore.ts:1307) fail-closes on missing reference/script, calls `commitRevealBake`, writes the rail clip, bumps documentRevision, records one 'reveal-create' undo entry. Test: efxPaintStore.reveal.test.ts 'createRevealRail creates the rail AND bakes it in one action (D-11)' passes. |
| 2   | The bake produces keys that carry reference pixels where the script coverage is, transparent elsewhere (RVL-02, D-17) | ⚠️ PARTIAL (WR-02) | `compositeRevealMask` (physicsPaintRotoPlayScriptRenderer.ts:154) draws the reference AS PLACED at full opacity then applies `destination-in`. Single-image semantics verified by 12 bake tests. Multi-image frame-aligned resolution is broken: `commitRevealBake` resolves the reference only once at canonicalStart (physicPaintStore.ts:1281). |
| 3   | reveal/motion bakes progressive coverage; reveal/static bakes full coverage per frame (D-09, RVL-03) | ✓ VERIFIED | Bake test asserts progressive routes through `buildProgressiveStrokeSchedule`/`getProgressiveFrameStrokes` and static through the static pair; progressive extends frame after frame, static replays the full stroke set. |
| 4   | Baked keys are ordinary track content — they appear in flattened output through the unchanged shared compositor (D-02, RVL-04) | ✓ VERIFIED | Store test 'baked keys appear in flattened output through the unchanged compositor (D-02)' passes; leak contract asserts no reveal token in the compositor. |
| 5   | Undo of create/replay/delete/span restores the prior document by reference, never raster-byte snapshots (RVL-06) | ✗ FAILED (CR-01) | Undo path (useRotoPhysicalEditHistory.ts:772-786) calls `registerDocument(before)` and never re-syncs the runtime store. The rail stays visible after undo (Studio renders from runtime at PhysicsPaintStudio.tsx:622) and the next `serializeRuntimeIntoDocument` re-projects the orphaned keys. Tests only assert the document object. |
| 6   | Replay is deterministic — running it twice on the same script + reference produces identical baked keys (D-05, D-11) | ✓ VERIFIED | Bake test 'is deterministic: the same script + reference + motion produce identical staged output' passes. |
| 7   | An interrupted or aborted bake writes no keys; the acknowledged physical-edit transaction revalidates the document revision before commit (D-11) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `throwIfAborted` is wired throughout the bake loop and the store catches bake errors, but no test exercises the abort path. See Human Verification. |
| 8   | The PhotoReferenceMode flag is removed from the document schema, parser, store, and controller — no vestigial state (D-15) | ✓ VERIFIED | `PHOTO_REFERENCE_KEYS` (efxPaintDocumentParsers.ts:70) has no 'mode'; no `PhotoReferenceMode` type in efxPaintDocument.ts; no `setPhotoReferenceMode`/`PHOTO_REFERENCE_MODES`/`setMode` in store/controller/studio/dialog. |
| 9   | A saved v1.0 document with a PhotoReferenceTrack parses and round-trips without a mode field (clean break) | ✓ VERIFIED | Parser test asserts mode-free track round-trips byte-identically and a legacy mode-bearing record is rejected fail-closed. |
| 10  | The reveal rail renders with the green-family line color: emerald #10b981 for reveal/motion, teal #14b8a6 for reveal/static (D-22) | ✓ VERIFIED | `REVEAL_MOTION_COLOR`/`REVEAL_STATIC_COLOR` (physicsPaintLoopClipPresentation.ts:35-36); presentation test asserts variant color default and per-rail overrideColor. |
| 11  | The reveal rail carries the 20x4px lifecycle status dot and a tooltip freshness line (D-23) | ⚠️ PARTIAL (WR-06) | Freshness line appended after Status line (verified by test), but `isFresh` does not detect reference transform/source changes — a moved reference still claims 'baked from current script & reference'. |
| 12  | The reveal rail reuses the Loop Clip Regenerate control for Replay, with a disabled reason when it cannot run (D-24) | ✓ VERIFIED | `replayDisabledReasonFor` mirrors `regenerateDisabledReasonFor`; presentation test asserts the fail-closed disabled reasons and Replay enabled for fresh/stale rails. |
| 13  | The photo-reference modal gains a 'Reveal with script…' entry, gated on a placed reference (D-12, D-16/D-19) | ⚠️ PARTIAL (WR-03) | CTA renders gated on hasSource (verified by test), but `revealCreationRequested` is never reset — after the strip entry is used once, the dialog permanently opens the reveal-creation surface. |
| 14  | Choosing the entry opens the SCRIPTS picker (unfiltered), derives the variant, and creates the reveal rail AND bakes it in one action with the onProgress bar (D-11) | ⚠️ PARTIAL (WR-04) | Flow wired (dialog test asserts create+bake mutation call with natural duration and onProgress), but the controller's `createRevealRail` has no try/catch — a throwing store op leaves `revealBusy` stuck true. |
| 15  | The variant is fixed at creation; re-linking a reveal rail to a different script is unfiltered (D-21/D-26) | ✓ VERIFIED | Store test asserts `mode` is 'progressive' at creation; dialog test asserts the variant choice; the picker lists library rows unfiltered. |
| 16  | The track's normal rail-creation flow can also create a reveal rail (kind 'reveal', then the unfiltered SCRIPTS picker) — both creation paths share one model (D-19) | ✓ VERIFIED | `classifyRotoRailKind`/`isRevealRotoRail`/`getRotoRailKindLabel` (physicsPaintWorkflowPresentation.ts:27-38); strip 'Create rail' menu offers Motion/Static/Reveal; workflow presentation test asserts classification. |
| 17  | Photo reference pixels reach flattened output ONLY through keys written by the Reveal bake (RVL-05, D-15) | ✓ VERIFIED | Leak contract test asserts 13 Phase 50 reference-input tokens + 10 reveal bake tokens absent from the four raster surfaces. |
| 18  | The leak contract extends the Phase 50 D-06 token allow-list scan to the new reveal bake path | ✓ VERIFIED | `efxPaintRevealLeakContract.test.ts` mirrors the D-06 contract and extends it with reveal bake path tokens; 2 tests pass. |

**Score:** 16/18 truths verified (1 failed, 1 present-behavior-unverified)

### Required Artifacts

| Artifact | Expected    | Status | Details |
| -------- | ----------- | ------ | ------- |
| `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` | railKind discriminator | ✓ VERIFIED | `railKind?: 'playscript' \| 'reveal'` (line 285), fail-closed allowlist (line 642), preserved in parse (line 723), joins canonical fingerprint (line 1088) |
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts` | reveal bake | ✓ VERIFIED | `renderRotoRevealFrames` (line 67), `compositeRevealMask` (line 154), `loadRevealReferenceImage` (line 182) |
| `app/src/stores/efxPaintStore.ts` | reveal mutations + undo | ✓ VERIFIED | `createRevealRail` (1307), `replayRevealRail` (1417), `deleteRevealRail` (1482), `resizeRevealRail` (1530), 'reveal-*' operation kinds (567-570) |
| `app/src/stores/physicPaintStore.ts` | bake commit path | ✓ VERIFIED | `commitRevealBake` (1268) reads `_resolveReferenceSourceImage` (1227) + reference transform |
| `app/src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts` | bake semantics tests | ✓ VERIFIED | 12 tests, all pass |
| `app/src/stores/efxPaintStore.reveal.test.ts` | undo-by-reference tests | ✓ VERIFIED | 9 tests, all pass (but only assert the document object, not the runtime — see CR-01) |
| `app/src/efx-paint/document/efxPaintDocument.ts` | mode-free schema | ✓ VERIFIED | `PhotoReferenceMode` union and `mode` field deleted |
| `app/src/efx-paint/document/efxPaintDocumentParsers.ts` | fail-closed parser | ✓ VERIFIED | `PHOTO_REFERENCE_KEYS` (line 70) has no 'mode'; `PHOTO_REFERENCE_MODES` deleted |
| `app/src/efx-paint/document/efxPaintDocumentParsers.reveal.test.ts` | round-trip tests | ✓ VERIFIED | 4 tests, all pass |
| `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts` | rail surface projection | ✓ VERIFIED | `freshnessLine`, `replayDisabledReason`, `railKind`, variant colors |
| `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx` | rail surface | ✓ VERIFIED | `rail-kind-reveal` class, `--rail-color`/`--rail-color-hover` CSS variables |
| `app/src/components/physic-paint/view/PhysicsPaintPhotoReferenceDialog.tsx` | 'Reveal with script…' entry | ✓ VERIFIED | CTA gated on hasSource, reveal-creation surface, `revealCreationRequested` prop |
| `app/src/components/physic-paint/view/physicsPaintPhotoReferenceController.ts` | reveal-creation state machine | ✓ VERIFIED | signals + actions for the reveal flow (no try/catch — WR-04) |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` | track rail-creation flow | ✓ VERIFIED | 'Create rail' button + rail-kind menu (Motion/Static/Reveal) |
| `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` | rail-kind classification | ✓ VERIFIED | classifies each loop line's rail kind |
| `app/src/efx-paint/compositor/efxPaintRevealLeakContract.test.ts` | RVL-05 leak contract | ✓ VERIFIED | 2 tests, all pass |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `commitRevealBake` | `_resolveReferenceSourceImage` | frame-aligned reference verdict + transform | ⚠️ PARTIAL | Reads the verdict once at canonicalStart (WR-02); never the composited preview (Pitfall 2 honored) |
| Baked keys | `getFlattenedFrame` → `efxPaintCompositor` | unchanged shared compositor | ✓ WIRED | Store test asserts flattened output; leak contract asserts no reveal token in the compositor |
| Reveal rail mode | variant (progressive/static) | `mode` field maps to the variant | ✓ WIRED | Store test asserts `mode: 'progressive'`; bake test asserts schedule routing |
| 'Reveal with script…' button | `createRevealRail` mutation | controller `createReveal` port | ✓ WIRED | Dialog test asserts the mutation call with natural duration + onProgress |
| Track rail-creation flow | `createRevealRail` mutation | same mutation as modal path | ✓ WIRED | Strip `onCreateRevealRail` → dialog reveal flow → same mutation |
| Undo path | restored document | `registerDocument(before)` | ✗ NOT_WIRED | Runtime store never re-synced after undo (CR-01) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `renderRotoRevealFrames` | `referenceImage` | `loadRevealReferenceImage(input.reference.dataUrl)` from `_resolveReferenceSourceImage` verdict | Yes | ✓ FLOWING (single-image; multi-image frame-aligned broken — WR-02) |
| `compositeRevealMask` | masked canvas | reference draw + `destination-in` coverage alpha | Yes | ✓ FLOWING |
| `createRevealRail` | `loopClip` | `bakeResult.records.map(keyId)` | Yes | ✓ FLOWING |
| `getFlattenedFrame` | flattened frame | baked real keys through the shared compositor | Yes | ✓ FLOWING |
| Undo restore | document | `registerDocument(descriptor.before)` | Yes (document) / No (runtime) | ⚠️ HOLLOW — runtime store not re-synced (CR-01) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Reveal bake + store + parser + leak tests | `vitest run src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts src/stores/efxPaintStore.reveal.test.ts src/efx-paint/document/efxPaintDocumentParsers.reveal.test.ts src/efx-paint/compositor/efxPaintRevealLeakContract.test.ts` | 27 passed | ✓ PASS |
| Rail surface + creation path tests | `vitest run src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts src/components/physic-paint/view/physicsPaintWorkflowPresentation.test.ts src/components/physic-paint/view/physicsPaintPhotoReferenceDialog.test.ts` | 90 passed | ✓ PASS |

### Probe Execution

No probes were declared in the phase plans. Step 7c: SKIPPED (no probe scripts found in the phase plans or conventional `scripts/*/tests/probe-*.sh` locations).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| RVL-01 | 52-01, 52-04 | One offscreen source-plus-mask compositor shared by Studio and flattened output reveals the photo source through internal Paint/PlayScript coverage | ✓ SATISFIED | Reveal rail created + baked in one action via both creation paths; bake-into-keys architecture (D-01 re-orientation) |
| RVL-02 | 52-01 | Empty mask reveals nothing; full mask reveals the entire source; partial alpha produces soft edges; eraser removes coverage | ✓ SATISFIED | Bake test asserts empty/full/partial/eraser semantics via destination-in |
| RVL-03 | 52-01 | Progressive PlayScript reveals progressively; static/hold PlayScript preserves the completed reveal | ✓ SATISFIED | Bake test asserts progressive/static schedule routing |
| RVL-04 | 52-01, 52-03 | Reveal result is written to or represented by an internal Paint/result track and included in flattened output | ✓ SATISFIED | Baked keys flow through the unchanged compositor; rail surface renders with locked visual identity |
| RVL-05 | 52-02, 52-05 | Photo reference visibility alone never leaks into output; hide/solo/opacity/blend around Reveal behave predictably | ✓ SATISFIED | Mode-free schema + leak contract test over the four raster surfaces |
| RVL-06 | 52-01, 52-02 | Undo/redo by reference, not raster-byte snapshots; save/reopen and export preserve the result | ✗ BLOCKED | Undo-by-reference at the document level works, but the runtime store is not re-synced after undo (CR-01) — the rail stays visible and the next serialize re-projects the orphaned keys. Round-trip (save/reopen) is verified. |

All 6 RVL requirement IDs are accounted for across the 5 plans. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` | 772-786 | Undo restores document but not runtime store | 🛑 Blocker | Rail stays visible after undo; next serialize re-projects orphaned keys (CR-01) |
| `app/src/stores/physicPaintStore.ts` | 1281 | Reference resolved once at canonicalStart | ⚠️ Warning | Multi-image reference cycles bake the wrong source image (WR-02) |
| `app/src/stores/efxPaintStore.ts` | 1530-1579 | Stretch path is a no-op | ⚠️ Warning | Rail extent never changes on stretch (WR-01) |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | 3872 | `revealCreationRequested` never reset | ⚠️ Warning | Dialog permanently opens the reveal-creation surface (WR-03) |
| `app/src/components/physic-paint/view/physicsPaintPhotoReferenceController.ts` | 272-301 | No try/catch around createReveal | ⚠️ Warning | `revealBusy` stuck true on a throwing store op (WR-04) |
| `app/src/stores/efxPaintStore.ts` | 1333-1363, 1488-1502, 1548-1559 | Non-atomic runtime writes | ⚠️ Warning | Orphaned keys on partial failure (WR-05) |
| `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts` | 149-150 | Freshness ignores transform/source changes | ⚠️ Warning | Tooltip claims fresh when the reference moved (WR-06) |

No TBD/FIXME/XXX debt markers found in the phase-modified files.

### Human Verification Required

1. **Abort the reveal bake mid-span** — trigger an abort (AbortController.abort()) after the first frame and verify no keys are written and the document revision is unchanged. Why human: no automated test exercises the abort path; the throwIfAborted wiring is present but the state transition is unproven.
2. **Native UAT (RVL-01 modal flow)** — place a reference, paint, save a script, run 'Reveal with script…' from the photo-reference modal, and verify the rail lands baked with the onProgress bar.
3. **Native UAT (RVL-01 track flow)** — create a reveal rail from the track rail-creation flow (Create rail → Reveal) and verify it lands baked.
4. **Native UAT (RVL-04 visual look)** — verify the reveal rail shows the green-family color (emerald motion / teal static), the 20x4px status dot, and the tooltip freshness line.

### Gaps Summary

The phase goal is substantially achieved — the reveal rail works end-to-end: model, bake, store mutations, flattened output, rail surface, both creation paths, and the RVL-05 leak contract are all present, wired, and tested (117 reveal-related tests pass).

The blocking gap is **CR-01**: the undo path restores the document by reference but never re-syncs the runtime store. After undo, the rail stays visible (the Studio renders rails from the runtime) and the next `serializeRuntimeIntoDocument` re-projects the orphaned keys back into the document — effectively undoing the undo. The RVL-06 tests only assert the document object, so the divergence is not caught. The fix is to re-hydrate the runtime from the restored document after `registerDocument` in the undo path (`hydrateRuntimeFromDocument` already exists at efxPaintStore.ts:1631) and to add runtime assertions to the RVL-06 tests.

Six additional warnings (WR-01..WR-06) are confirmed as partial implementations: resize stretch is a no-op, multi-image reference resolution is not frame-aligned, `revealCreationRequested` is never reset, the controller lacks a try/catch, the mutations are not atomic across runtime writes, and the freshness line does not detect reference transform/source changes. None of these individually block the core reveal capability, but they represent incomplete contract coverage that should be addressed before the phase is closed.

---

_Verified: 2026-09-02T16:35:00Z_
_Verifier: Claude (gsd-verifier)_
