---
phase: 59-rail-motion-channels-v7-interface
verified: 2026-11-07T11:44:27Z
status: gaps_found
score: 18/21 must-haves verified
covered_files: [".planning/phases/59-rail-motion-channels-v7-interface/59-01-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-01-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-02-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-02-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-03-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-03-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-04-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-04-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-05-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-05-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-06-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-06-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-07-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-07-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-08-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-08-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-09-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-09-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-10-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-10-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-11-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-11-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-12-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-12-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-13-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-13-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-14-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-14-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-15-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-15-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-16-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-16-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-17-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-17-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-18-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-18-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-19-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-19-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-20-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-20-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-21-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-21-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-22-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-22-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-23-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-23-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-24-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-24-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-25-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-25-SUMMARY.md", "app/src-tauri/src/services/script_library.rs", "app/src/components/physic-paint/PhysicsPaintStudio.test.ts", "app/src/components/physic-paint/PhysicsPaintStudio.tsx", "app/src/components/physic-paint/hooks/physicsPaintRotoLoopHistory.test.ts", "app/src/components/physic-paint/hooks/physicsPaintRotoRailMotionHistory.test.ts", "app/src/components/physic-paint/hooks/useRotoKeyUtilities.test.ts", "app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts", "app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts", "app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts", "app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts", "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts", "app/src/components/physic-paint/hooks/useRotoTimelineActions.ts", "app/src/components/physic-paint/roto/physicsPaintRotoGroupLifecycle.ts", "app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts", "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts", "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts", "app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.test.ts", "app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts", "app/src/components/physic-paint/roto/physicsPaintRotoRailSetSelection.ts", "app/src/components/physic-paint/roto/physicsPaintRotoSession.test.ts", "app/src/components/physic-paint/roto/railMotionCommands.test.ts", "app/src/components/physic-paint/roto/railMotionCommands.ts", "app/src/components/physic-paint/roto/railMotionDocumentReconciler.test.ts", "app/src/components/physic-paint/roto/railMotionDocumentReconciler.ts", "app/src/components/physic-paint/roto/railMotionEvaluator.test.ts", "app/src/components/physic-paint/roto/railMotionEvaluator.ts", "app/src/components/physic-paint/roto/railMotionIdentity.test.ts", "app/src/components/physic-paint/roto/railMotionIdentity.ts", "app/src/components/physic-paint/roto/railMotionInkScan.test.ts", "app/src/components/physic-paint/roto/railMotionInkScan.ts", "app/src/components/physic-paint/roto/railMotionMergeNotice.test.ts", "app/src/components/physic-paint/roto/railMotionMergeNotice.ts", "app/src/components/physic-paint/roto/railMotionModel.test.ts", "app/src/components/physic-paint/roto/railMotionModel.ts", "app/src/components/physic-paint/roto/railMotionPersistence.test.ts", "app/src/components/physic-paint/roto/railMotionPivot.test.ts", "app/src/components/physic-paint/roto/railMotionPivot.ts", "app/src/components/physic-paint/roto/rotoCoordinatorPorts.ts", "app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx", "app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts", "app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx", "app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx", "app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx", "app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx", "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts", "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx", "app/src/components/physic-paint/view/TimelineMotionChannels.test.ts", "app/src/components/physic-paint/view/TimelineMotionChannels.tsx", "app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts", "app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts", "app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts", "app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx", "app/src/components/physic-paint/view/timelineMotionSurface.contract.test.ts", "app/src/components/physic-paint/view/timelineRailDesign.test.ts", "app/src/components/physic-paint/view/timelineRailDesign.ts", "app/src/components/shared/NumericStepper.test.tsx", "app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts", "app/src/efx-paint/compositor/efxPaintCompositeCache.ts", "app/src/efx-paint/compositor/efxPaintCompositor.ts", "app/src/efx-paint/compositor/efxPaintCompositorRailMotion.test.ts", "app/src/efx-paint/compositor/efxPaintRevealLeakContract.test.ts", "app/src/efx-paint/document/efxPaintCanonicalEncoder.ts", "app/src/efx-paint/document/efxPaintDocumentRevision.ts", "app/src/lib/__fixtures__/railMotionCanonical.golden.json", "app/src/lib/efxPaintPersistence.ts", "app/src/lib/paperPass.frameGuard.test.ts", "app/src/lib/physicPaintBridge.test.ts", "app/src/lib/physicPaintBridge.ts", "app/src/lib/railMotionCanonicalParity.test.ts", "app/src/lib/railMotionDependencySurface.test.ts", "app/src/lib/railMotionExportParity.test.ts", "app/src/lib/railMotionGateBEdits.test.ts", "app/src/lib/railMotionPackageRoundTrip.test.ts", "app/src/stores/efxPaintPersistenceRailMotionRoundTrip.test.ts", "app/src/stores/efxPaintStore.reveal.test.ts", "app/src/stores/efxPaintStore.ts", "app/src/stores/physicPaintStore.rotoRailMotions.test.ts", "app/src/stores/physicPaintStore.test.ts", "app/src/stores/physicPaintStore.ts", "app/src/stores/trackIsolation.test.ts", "app/src/types/physicPaint.test.ts", "app/src/types/physicPaint.ts"]
covered_digest: "v4:sha256:ed3078662089c85ac6703f839615eec516b7c128cd338f559e9e7089d3260ce5"
behavior_unverified: 2
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 17/20
  gaps_closed:
    - "Reveal creation reconciles motion against a loop-clip snapshot that omits the clip appended after the bake, orphaning a neighbouring Key Rail's motion (previous CR-01) - closed by 59-22: the pending clip template is appended to the reconciliation's next snapshot before `reconcileRailMotionsForDocumentEdit`, and the regression row keeps the neighbour record live at the surviving key"
    - "WR-01: the add-channel availability branch and `hasKeylessChannel` input had no production caller - closed by 59-23: the row renders on every expanded block and is gated by one authority"
    - "WR-02: `mergedDrop` on `cutTrackSelection`/`clearTrackFrames` had no production consumer - closed by 59-24: the result contracts no longer carry it; move keeps it"
    - "WR-03: the lane curve omitted `railId`, so its wiggle seed differed from the applied transform - closed by 59-25"
    - "WR-04: the grouped Position lane forwarded `channels[0]`, making `position-y` easing/wiggle unreachable - closed by 59-25"
    - "WR-05: `localeCompare` vs Rust byte-order canonical sort - closed by 59-24: one code-unit comparator at all four sorts plus a mixed-case sixth fixture document"
    - "WR-06: the copy payload derived Key Rail segments with an empty group-owned set - closed by 59-22: one exported `collectRailMotionGroupOwnedKeyIds` feeds the reconciler, the copy payload and the store copy"
  gaps_remaining:
    - "Canonical number encoding diverges between TypeScript and Rust for exponent-notation magnitudes (>= 1e21 or < 1e-6), and the phase's unbounded Scale/Rotation domain plus the free-entry Motion inspector make an in-domain value that the model accepts and the Rust settle hash gate then rejects (current 59-REVIEW.md CR-01)"
  regressions: []
gaps:
  - truth: "Every Motion value the model accepts can settle and persist: the TypeScript and Rust canonical encoders emit the same project hash, so a document the shipped Motion inspector can produce is never rejected by the Rust settle gate (REL-02 cross-language contract, MOTN-12)"
    status: failed
    reason: "`encodeCanonicalNumber` (TS, `app/src/efx-paint/document/efxPaintCanonicalEncoder.ts:16-18`) emits `n${String(value)};`, and ECMAScript `String(number)` switches to exponent notation for |value| >= 1e21 and < 1e-6. Rust `canonical_number` (`app/src-tauri/src/services/script_library.rs:1282-1284`) emits `format!(\"n{value};\")`, which never uses exponent notation. Verified with rustc on this host: `format!(\"{}\", 1e21)` -> `1000000000000000000000`, `format!(\"{}\", 1e-7)` -> `0.0000001`; node `String(1e21)` -> `1e+21`, `String(1e-7)` -> `1e-7`. The divergence was theoretical while the canonical document carried only bounded integers and the [0,1] grain float; Phase 59's D-09 domains (rotation: any finite number; scale: any finite > 0) and the free-entry inspector (`PhysicsPaintScriptsPanel.tsx:220-239`, `NumericStepper.tsx:216-222` with `parseFloat`) make it reachable: typing `2e23` into the Scale field yields model value 1.9999999999999997e21, which `railMotionValueIsValid('scale', ...)` accepts and `writeRailMotionChannelValueAtCursor` writes; typing `1e21` into Rotation is accepted verbatim. The rail-motion write path reports success, then any action-transaction prepare carrying that document fails closed at the Rust hash gate (`script_library.rs:1244-1247`, 'Target physical hash does not match the canonical physical document'). The six golden fixture documents carry only small values, so `rail_motion_canonical_parity` cannot catch it."
    artifacts:
      - path: "app/src/efx-paint/document/efxPaintCanonicalEncoder.ts"
        issue: "`encodeCanonicalNumber` uses `String(value)`, which emits exponent notation for |value| >= 1e21 or < 1e-6; Rust emits plain decimal (lines 16-18)"
      - path: "app/src-tauri/src/services/script_library.rs"
        issue: "`canonical_number` uses `format!(\"n{value};\")` (plain decimal) and its comment at 1251-1257 still claims the document is bounded integers plus the [0,1] grain float (1282-1284)"
      - path: "app/src/components/physic-paint/roto/railMotionModel.ts"
        issue: "D-09 accepts any finite rotation and any finite positive scale, including exponent-magnitude values the encoder pair cannot agree on (168-187)"
      - path: "app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx"
        issue: "The free-entry Motion inspector offers unbounded Scale/Rotation fields with no min/max, so the offending value is reachable from the shipped UI (220-239)"
    missing:
      - "Make the TypeScript encoder print plain decimal notation unconditionally (expand `String(value)`'s exponent form by string surgery, preserving shortest-roundtrip digits), or bound scale/rotation to a range whose string forms agree"
      - "Add fixture documents carrying 1e21 and 1e-7 (e.g. a rail-motion scale/rotation key) so the parity test fails today and passes after the fix, and update the stale Rust comment"
advisory:
  - finding: "The canonical ordering/encoding law assumes ASCII rail/key ids but no boundary enforces it (59-REVIEW.md WR-01)"
    category: security
    reason: "Non-ASCII ids would disagree on ordering, length prefixes, FNV input and id limits; reachable only from a foreign/doctored document or a crafted paste payload, and the failure is fail-closed at the hash gate (no silent corruption). Enforce an explicit ASCII charset at the TS validators and `rail_motion_bounded_id`."
    evidence_status: "code review only; no deterministic repro run in this pass"
  - finding: "Cross-track Loop Clip materialized source frames are outside the paste extent/occupancy model (59-REVIEW.md WR-02)"
    category: other
    reason: "`computePastedExtent` enumerates key-rail destinations and loop end-exclusives but not the frames 59-22 materializes at `destinationStart + offset`; a duplicate can accept a colliding anchor or reject with a generic 'apply-failed' reason, and a negative `destinationStart` is not caught by the lower-bound test. The transaction still validates before mutating, so no corruption."
    evidence_status: "code review only; covered suites green (38 rail-set copy rows, 32 track-isolation rows)"
behavior_unverified_items:
  - truth: "A track with motion shows the coloured chevron (right collapsed, down expanded); a track with no motion shows the grey minus (MUI-01, ROADMAP SC2)"
    test: "Expand/collapse a motion-bearing track's chevron and compare with a motion-free row in the running app."
    expected: "Coloured chevron-right collapsed, chevron-down expanded; a grey 14x14 minus with a visible disabled reason when there is no motion."
    why_human: "Colour, size and glyph rendering are visual; the code path is present (`resolveMotionChevronKind`, aria-expanded/aria-description) but no automated check renders the surface."
  - truth: "The v7 chrome matches its contract: 18px lanes, header cluster with previous/diamond/next, 16x18 cells, 1.5px curves, 6x6 keys with the lighter type rim, rounded outline wrapping row plus expanded channels, one open block at a time, header/lane alignment while scrolling, 2px post-block gap, measured reorder insertion (MUI-02..MUI-05, ROADMAP SC5)"
    test: "Open an expanded motion block in the running app and measure/observe the chrome, the scroll alignment and the reorder indicator."
    expected: "The locked measures and visual contract hold at runtime, including one open block and an indicator that never lands inside a channel block."
    why_human: "Layout, colour and scroll behaviour cannot be certified by grep or a contract test alone; REQUIREMENTS.md keeps MUI-01..MUI-05 Pending for this reason."
---

# Phase 59: Rail Motion Channels & v7 Interface Verification Report

**Phase Goal:** Every rail — Standard, Motion, Static, Reveal, or a bare Key Rail — can be animated by Motion keys that are independent of its drawing keys, and the transform is applied once at the compositor so edit view, Play, and export show the same frame.
**Verified:** 2026-11-07T11:44:27Z
**Status:** gaps_found
**Re-verification:** Yes — after the 59-22..59-25 review gap-closure round

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A Motion key can be added on any rail kind (Standard, Motion, Static, Reveal, bare Key Rail) with no cycle value, no conversion, and without creating or altering a drawing key (SC1, MOTN-01/MOTN-02) | ✓ VERIFIED | `railMotionCommands.ts` `animateRail` binds Loop Clips by `loopId`, mints one UUID for a bare Key Rail and has no rail-kind gate; command tests cover Reveal/Static parity and deep-equality of drawing keys/loops/breaks (82 tests) |
| 2 | Position (grouped or split X + Y), Scale, Rotation, and Opacity each animate with their own keys (SC2, MOTN-03) | ✓ VERIFIED | Add-channel path (`PhysicsPaintTrackRow.tsx:597-660` → `PhysicsPaintWorkflowStrip.tsx` host → `useRotoTimelineActions.ts` → `railMotionCommands.ts` → reducer) is reachable; 59-25 fans easing/wiggle over both Position axes; command suite 82 tests |
| 3 | Channels open on demand, one at a time; no lane appears by default (SC2, MOTN-04) | ✓ VERIFIED | Two-writer session signal + absolute overlay; 59-23 makes the `+` row always render and gates it on `resolveMotionCommandAvailability` (`PhysicsPaintTrackRow.tsx:597-660`); `TimelineMotionChannels.test.ts` 32 rows |
| 4 | A track with motion shows the coloured chevron (right collapsed/down expanded); a track without motion shows the grey minus (SC2, MUI-01) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Logic exists (`resolveMotionChevronKind`, aria-expanded/aria-description, 14x14 button); colour/glyph rendering is visual and MUI-01 stays Pending — see Behavior Unverified Items |
| 5 | The rail transform is applied once at the compositor; one content raster per track per frame; nothing re-bakes (SC3, MOTN-07) | ✓ VERIFIED | Both draw sites pass `ports.trackTransforms?.get(track.id)` into the shared `drawEfxPaintTrack` (`efxPaintCompositor.ts:415,451`); motion enters only as a conditional revision term (`efxPaintCompositeCache.ts:175-225`); `efxPaintCompositorRailMotion.test.ts` passes |
| 6 | Content cycles while motion continues over the rail's full lifecycle (SC3, MOTN-06/MOTN-07) | ✓ VERIFIED | `createRailMotionViewSpanResolver` injected at the store projection (`physicPaintStore.ts`), the track row and the hook; infinity takes `Math.max(fallback, resolver end)`; `railMotionIdentity.test.ts` passes |
| 7 | Edit view, Play, and export render the identical frame, including on the active track (SC4, MOTN-08) | ✓ VERIFIED | One `getFlattenedFrame` path serves preview (`previewRenderer.ts:264,320`) and export; `railMotionExportParity.test.ts` passes its active-track/`trackTransforms` cases |
| 8 | Motion-blur export keeps paint on every frame: integer content raster + fractional transform (SC4, REL-04) | ✓ VERIFIED | `exportRenderer.ts` sub-frame loop (478-490) + fractional offset preserved (176, 210-216); `railMotionExportParity.test.ts` passes |
| 9 | Motion survives save → close → reopen (SC5, MOTN-12 persistence) | ✓ VERIFIED | `railMotions` in the document allowlist (`physicsPaintRotoPhysicalModel.ts:553`), conditional canonical term (1671), byte round-trip tests pass (`railMotionPackageRoundTrip.test.ts`, `railMotionPersistence.test.ts`, `efxPaintPersistenceRailMotionRoundTrip.test.ts`) |
| 10 | Rotation is unbounded and values hold outside the keyed range (SC5, MOTN-09) | ✓ VERIFIED | `railMotionValueIsValid('rotation', value)` returns true for any finite number; evaluator interpolates degrees with no wrap; `railMotionEvaluator.test.ts` 29 rows |
| 11 | Rail / drawing-key / motion-key scopes work independently, each with its own contextual commands (SC5, MOTN-11) | ✓ VERIFIED | `resolveSelectionScope` + `CONTEXTUAL_COMMANDS_BY_SCOPE` (`railMotionCommands.ts:648-669`) drive the strip; exclusivity enforced in the production hosts |
| 12 | Ease, Wiggle, and Hold attach only to Motion keys; Wiggle is seeded and deterministic at export (SC5, MOTN-10) | ✓ VERIFIED | Command layer accepts easing/wiggle only on motion keys; evaluator seeds FNV-1a per rail/channel/frame; 59-25 makes the lane curve use the same `railId` seed |
| 13 | Every key operation is one undo/redo step (SC5, MOTN-12) | ✓ VERIFIED | History snapshot includes `railMotions` (`useRotoPhysicalEditHistory.ts:142,435,513,559`); `physicsPaintRotoRailMotionHistory.test.ts` passes |
| 14 | The v7 chrome matches its contract: 18px lanes, header cluster, 16x18 cells, 1.5px curves, 6x6 keys with lighter type rim, rounded outline wrapping row+channels, one open block, aligned header while scrolling, 2px post-block gap, measured reorder insertion (SC5, MUI-02..MUI-05) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Measures and structure are pinned by `timelineMotionSurface.contract.test.ts` and `PhysicsPaintWorkflowStrip.test.ts` (184 rows); runtime visual/layout behaviour needs the live UAT (MUI-02..MUI-05 stay Pending) |
| 15 | Motion lives in rail-local time; keys survive moving or repeating the rail (SC5, MOTN-05) | ✓ VERIFIED | `resolveRailLocalFrame` subtracts the rail start and clamps; identity returns the same record reference when the start moves; start-move reconciliation tests pass |
| 16 | Rail-set Copy and Duplicate carry the rails' Motion with the rails (plan 59-14, UAT row 6) | ✓ VERIFIED | 59-22 closes WR-06: `collectRailMotionGroupOwnedKeyIds` feeds `buildRotoRailSetCopyPayload`, `copyTrackSelection` and `_resolveRotoRailMotionProjection`; clip-following Key Rail copy row and clip-owned `stale-member` control pass (38 copy rows, 32 track-isolation rows) |
| 17 | Structural edits reconcile Motion in the same commit and a two-sided merge publishes the drop confirmation (plan 59-12/59-15) | ✓ VERIFIED | 59-22 closes the previous CR-01: `createRevealRail` mints `revealLoopId` pre-bake (`efxPaintStore.ts:1600`), passes `pendingLoopClip` (1651), `commitRevealBake` guards duplicate ids before rendering (2388-2395) and appends `{...pendingLoopClip, sourceKeyIds: bakedRecords...}` to the next snapshot before reconciling (2516-2534). Regression `keeps a neighbouring Key Rail motion live when the reveal rewrites its first key` passes: record keeps `railId`, anchor moves to `key-b`, flattened frame 14 reports opacity 0.5. Move-drop publication remains wired (59-20/59-24); cut/clear no longer report an unread drop |
| 18 | TS and Rust canonical rail-kind/ordering encoders agree (plan 59-01/59-04; REL-02 cross-language) | ✓ VERIFIED | 59-24 replaces `localeCompare` with one code-unit `compareCanonicalIds` at all four canonical sorts (`physicsPaintRotoPhysicalModel.ts:1601,1609,1719,1736,1756`), adds the mixed-case `rail-motion-ordering` sixth fixture document and a lifecycle-shape guard; `railMotionCanonicalParity.test.ts` passes and `cargo test --lib rail_motion_canonical_parity` is 3/3 green |
| 19 | Motion joins the canonical document revision; sampled values never enter the flattened cache key (REL-03) | ✓ VERIFIED | Conditional `rail-motions:` term after `loops:`; `trackMotionRevisions` emits a `motion:` term only for participating tracks; cache tests pin the motion-only key rotation and the absence of sampled values |
| 20 | No new runtime dependencies (REL-01) | ✓ VERIFIED | `railMotionDependencySurface.test.ts` passes (bare-import scan, frozen dependency list, non-vacuous check) |
| 21 | Every Motion value the model accepts can settle and persist: the TS and Rust canonical encoders emit the same project hash, so a document the shipped Motion inspector can produce is never rejected by the Rust settle gate (REL-02 cross-language contract, MOTN-12) | ✗ FAILED | `encodeCanonicalNumber` uses `String(value)` (exponent for >= 1e21 or < 1e-6) while Rust `canonical_number` uses plain-decimal `format!`; verified with node and rustc on this host. Reachable via the free-entry Scale/Rotation inspector on the phase's unbounded D-09 domain; the write reports success, then the Rust hash gate (`script_library.rs:1244-1247`) rejects the document. The six golden fixtures carry only small values |

**Score:** 18/21 truths verified (2 present, behavior-unverified; 1 failed)

### Deferred Items

None. Phase 60 (Studio timeline horizontal zoom), Phase 61 (vector painting) and Phase 62 (painted-stroke curve editing) do not cover the canonical-number divergence, so the remaining gap is not deferred.

### Advisory (New Scope, Unevidenced)

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| 1 | 59-REVIEW.md WR-01: the canonical ordering/encoding law assumes ASCII ids but no boundary enforces it | security | New-scope from the post-closure review; theoretical for app-minted UUIDs, fail-closed at the hash gate; no deterministic repro run in this pass |
| 2 | 59-REVIEW.md WR-02: cross-track Loop Clip materialized source frames are outside the paste extent/occupancy model | other | New-scope from the post-closure review; the transaction validates before mutating (no corruption), but a paste can be refused with a generic reason or skip a fitting destination |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/src/components/physic-paint/roto/railMotionModel.ts` | Types, parser, pure reducer | ✓ VERIFIED | Fail-closed caps; D-09 domains; add-channel and paired-axis rules; 19 model rows + 82 command rows |
| `app/src/components/physic-paint/roto/railMotionEvaluator.ts` | Single interpolation authority, curve path | ✓ VERIFIED | Endpoint hold, smoothstep, unbounded rotation, seeded wiggle; curve path now accepts/consumes `{ railId }` (59-25); 29 rows |
| `app/src/components/physic-paint/roto/railMotionCommands.ts` | Availability + command layer | ✓ VERIFIED | `addMotionChannel` and both fan-out setters present; `resolveMotionCommandAvailability` is the one authority consumed by the row (59-23) |
| `app/src/components/physic-paint/roto/railMotionIdentity.ts` | Durable identity + reconciliation | ✓ VERIFIED | Loop Clip binds by loopId, UUID mint, orphan retention; span resolver injected; module stays pure |
| `app/src/components/physic-paint/roto/railMotionDocumentReconciler.ts` | Commit-point reconciler + one ownership authority | ✓ VERIFIED | Exported `collectRailMotionGroupOwnedKeyIds`; `groupOwnedKeyIdsFor` delegates to it (104-118) |
| `app/src/components/physic-paint/roto/railMotionMergeNotice.ts` | Session notice + copy | ✓ VERIFIED | Signals, publish/dismiss, undoable companion; no store import, no persistence |
| `app/src/components/physic-paint/view/TimelineMotionChannels.tsx` | v7 lanes/keys/curve/menu | ✓ VERIFIED | Add-channel row disabled/reason props (59-23); curve call passes `{ railId }` (356) |
| `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` | Chevron, outline, block layout | ✓ VERIFIED | Always-rendered authority-gated `+` row (`597-660`); grouping addressed through the command layer (59-25) |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` | Active-lane host, measured layout, actions | ✓ VERIFIED | `activeMotionAddChannelRow = activeMotionLaneCount > 0` (2848); keyless second derivation deleted; move-drop publish wired |
| `app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts` | Inspector projection | ✓ VERIFIED | `present` derives from channel existence; absent channels marked |
| `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx` | Motion inspector controls | ✓ VERIFIED | Absent channels disabled with visible note; free-entry Scale/Rotation fields are the reachability path for the open CR-01 |
| `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` | Motion actions + copy/duplicate | ✓ VERIFIED | Add-channel action, copy document railMotions and the single commit path wired |
| `app/src/stores/physicPaintStore.ts` | Projection, transform resolution, revisions | ✓ VERIFIED | Transform/view/revision paths present; `RevealLoopClipTemplate` + duplicate guard + pending clip in the next snapshot (2321-2534); shared ownership collector in the projection and copy |
| `app/src/stores/efxPaintStore.ts` | Reveal rail lifecycle | ✓ VERIFIED | `revealLoopId` minted pre-bake, one shared clip base passed as the pending template and reused for the appended clip (1600-1680) |
| `app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts` | Rail-set copy with real ownership | ✓ VERIFIED | Segments with `collectRailMotionGroupOwnedKeyIds(document.loopClips)` (394); Option B loop `sourceEntries` carrier |
| `app/src/efx-paint/compositor/efxPaintCompositor.ts` | One transform application | ✓ VERIFIED | Both draw sites delegate to the shared `drawEfxPaintTrack` |
| `app/src/efx-paint/compositor/efxPaintCompositeCache.ts` | Motion revision in cache key | ✓ VERIFIED | Conditional participating-track term, no sampled values |
| `app/src/lib/exportRenderer.ts`, `app/src/lib/previewRenderer.ts` | Sub-frame export parity | ✓ VERIFIED | Integer content + fractional transform flow |
| `app/src/efx-paint/document/efxPaintCanonicalEncoder.ts` | Cross-language number encoder | ✗ FAILED | `encodeCanonicalNumber` uses `String(value)`; exponent form diverges from Rust plain decimal (the open gap) |
| `app/src-tauri/src/services/script_library.rs` | Rust canonical/guard parity | ✗ FAILED | Rail-kind/ordering parity green (3/3) but `canonical_number` diverges from TS for exponent magnitudes; stale bounded-domain comment |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Animate action | `animateRail` -> store -> bridge -> Rust | command commit path | ✓ WIRED | `commitRailMotionRecords` -> `replaceRotoPhysicalRailMotions`; bridge forwards/reconciles |
| Motion key write/easing/wiggle | store collection | `writeMotionTransformAtCursor` / write value | ✓ WIRED | All refuse absent channels; 59-21 makes the refusal visible |
| Add-channel row + menu | store collection | row -> `onAddMotionChannel` -> `addMotionChannel` -> reducer -> single motion commit | ✓ WIRED | 59-23 renders the row on every expanded block and gates it on the authority; overlay gated on `enabled && open` |
| Copy/Duplicate command | motion payload | `buildRailSetCopyDocument` | ✓ WIRED | 59-22 derives ownership through the shared collector; clip-following Key Rail copies with its own first key and frozen motion |
| Store removal reconciliation | merge-drop notice | `mergedDrop` -> strip publish | ✓ WIRED | `moveTrackItems` result is read by the strip; `cutTrackSelection`/`clearTrackFrames` no longer compute or return a drop (59-24) |
| Reveal creation | motion reconciler | `createRevealRail` pre-bake `loopId` -> `pendingLoopClip` -> next snapshot -> `reconcileRailMotionsForDocumentEdit` | ✓ WIRED | 59-22; duplicate `loopId` fails closed before `renderRotoRevealFrames`; regression asserts a live transform at frame 14 |
| `document.loopClips` | Key Rail segmentation | `collectRailMotionGroupOwnedKeyIds` -> `deriveKeyRailSegments` in both copy paths | ✓ WIRED | One authority consumed by the reconciler, the payload builder, `copyTrackSelection` and `_resolveRotoRailMotionProjection` |
| `trackTransforms` | compositor draw | `drawEfxPaintTrack` | ✓ WIRED | Both draw sites pass the per-track transform |
| Export fractional frame | `getFlattenedFrame` | sub-frame loop | ✓ WIRED | Parity test covers the law |
| TS canonical revision | Rust canonical revision | `rail-motions:` term | ⚠️ PARTIAL | Rail-kind and ordering terms agree (six fixtures, 3 Rust tests); numeric magnitudes >= 1e21 or < 1e-6 diverge — the open gap |
| Inspector fields | channel value write | `projectRailMotionInspector` -> NumericStepper | ✓ WIRED | Absent channels disabled with a visible reason; free-entry values reach the command layer (including exponent magnitudes — the open gap) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| Compositor draw | `trackTransforms` | store projection -> evaluator -> railMotions | Yes | ✓ FLOWING |
| Preview/export renderer | `physicPaintFrame` | store `getFlattenedFrame` -> same evaluator | Yes | ✓ FLOWING |
| Motion lane curves | channel keys | record channels (all five reachable) | Yes | ✓ FLOWING |
| Rail-set copy payload | `railMotions` | `buildRailSetCopyDocument` -> parser input + revision | Yes | ✓ FLOWING |
| Merge-drop notice (move path) | `mergedDrop` | reconciler report -> strip publish | Yes | ✓ FLOWING |
| Merge-drop notice (cut/clear) | `mergedDrop` | removed from the result contracts | N/A | ✓ NOT APPLICABLE (dead path deleted by 59-24) |
| Infinite-clip transform | `endFrameExclusive` | `createRailMotionViewSpanResolver` | Yes | ✓ FLOWING |
| Reveal-creation motion ownership | `anchorKeyId` / views | pending clip in the reconciler next snapshot -> appended clip | Yes | ✓ FLOWING (previously DISCONNECTED; the regression row proves a live transform) |
| Canonical rail-motion revision | `encodeCanonicalNumber` / `canonical_number` | rail-motion key values -> project hash -> Rust gate | No for exponent magnitudes | ✗ DISCONNECTED (open CR-01) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Gap-closure surfaces: reveal bake, copy, track isolation, lanes, row, strip | `cd app && pnpm exec vitest run src/stores/efxPaintStore.reveal.test.ts src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.test.ts src/stores/trackIsolation.test.ts src/components/physic-paint/view/TimelineMotionChannels.test.ts src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx.test.ts src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` | 6 files, 378 tests passed | ✓ PASS |
| Model/evaluator/commands/identity/reconciler/notice/persistence | `cd app && pnpm exec vitest run src/components/physic-paint/roto/railMotion{Commands,Model,Evaluator,Identity,DocumentReconciler,MergeNotice,Persistence}.test.ts` | 7 files, 274 tests passed | ✓ PASS |
| Parity/export/persistence/compositor/round-trip/dependency | `cd app && pnpm exec vitest run src/lib/railMotion{CanonicalParity,ExportParity,GateBEdits,PackageRoundTrip,DependencySurface}.test.ts src/efx-paint/compositor/efxPaintCompositorRailMotion.test.ts src/stores/efxPaintPersistenceRailMotionRoundTrip.test.ts src/stores/physicPaintStore.rotoRailMotions.test.ts src/stores/efxPaintStore.reveal.test.ts` | 9 files, 128 tests passed | ✓ PASS |
| Rust canonical parity | `cargo test --manifest-path app/src-tauri/Cargo.toml --lib rail_motion_canonical_parity` | 3 tests passed (parity, reserved ordinal, malformed rejection) | ✓ PASS |
| Full project suite | `cd app && pnpm exec vitest run` | 395 files passed, 2 skipped (397); 7,894 tests passed, 1 skipped, 96 todo | ✓ PASS |
| CR-01 reveal-creation regression (behavior-dependent) | Included in the first command: `keeps a neighbouring Key Rail motion live when the reveal rewrites its first key (CR-01)` | Passed: record survives with `railId`, anchor `key-b`, flattened frame 14 opacity 0.5 | ✓ PASS |
| Canonical number parity | `rustc` one-off (`format!("{}", 1e21)`) + `node` (`String(1e21)`, `String(1e-7)`) | Rust `1000000000000000000000` / `0.0000001`; TS `1e+21` / `1e-7` | ✗ FAIL (confirms the open gap) |

### Probe Execution

No probes declared or implied. `59-*-PLAN.md` contain no `probe-*.sh` reference and no probe-based verification criterion; Step 7c is not applicable to this phase.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `railMotionCommands.test.ts` | MOTN-01/02/03/04/10 | active | 0 | no | behavioral | PASS |
| `railMotionModel.test.ts` | MOTN-01/02/03/09 | active | 0 | no | value | PASS |
| `railMotionEvaluator.test.ts` | MOTN-09/10 | active | 0 | no | value | PASS |
| `railMotionIdentity.test.ts` | MOTN-05/06 | active | 0 | no | behavioral | PASS |
| `railMotionDocumentReconciler.test.ts` | MOTN-02/05/12 | active | 0 | no | behavioral | PASS |
| `railMotionExportParity.test.ts` | MOTN-07/08/REL-04 | active | 0 | no | behavioral | PASS |
| `railMotionGateBEdits.test.ts` | MOTN-05/12 | active | 0 | no | behavioral | PASS |
| `useRotoTimelineActions.test.ts` | MUI-06, MOTN-11, 59-17/18 | active | 0 | no | behavioral | PASS |
| `efxPaintStore.reveal.test.ts` | MOTN-12, previous CR-01 | active | 0 | no | behavioral | PASS (now includes the neighbour-reveal regression and the duplicate-loopId guard) |
| `physicsPaintRotoRailSetCopy.test.ts` | MOTN-05, WR-06 | active | 0 | no | behavioral | PASS |
| `trackIsolation.test.ts` | MOTN-05, WR-06 | active | 0 | no | behavioral | PASS |
| `railMotionCanonicalParity.test.ts` | REL-02 | active | 0 | no | value + cross-language fixture | PASS (six documents; no exponent-magnitude case — the coverage gap) |
| `PhysicsPaintTrackRow.test.tsx.test.ts` | MUI-01..05 | active | 0 | no | structural | PRESENT_BEHAVIOR_UNVERIFIED (visual) |
| `PhysicsPaintWorkflowStrip.test.ts` | MUI-02..05, MOTN-10 | active | 0 | no | value/structural | PASS |
| `TimelineMotionChannels.test.ts` | MUI-02..04, MOTN-03/04, WR-03 | active | 0 | no | value | PASS |
| `physicsPaintKeyRailPresentation.test.ts` | MUI-06, 59-21 | active | 0 | no | value | PASS |
| `PhysicsPaintScriptsPanel.test.ts` | 59-21 | active | 0 | no | behavioral | PASS |
| `railMotionMergeNotice.test.ts` | MOTN-10 | active | 0 | no | value | PASS |
| `physicPaintStore.rotoRailMotions.test.ts` | MOTN-10/12, WR-02 | active | 0 | no | behavioral | PASS |

**Disabled tests on requirements:** 0 (only `.pending` signal names matched, no skipped assertions).
**Circular patterns detected:** 0.
**Insufficient assertions:** 0 on covered truths; the missing exponent-magnitude fixture is a coverage gap recorded under the open CR-01, not a weak assertion.

### Decision Coverage

All trackable CONTEXT.md decisions are honored by shipped artifacts (19/19; `not_honored: []`). The open CR-01 is an encoder-boundary consequence of D-09's unbounded domain, not an unhonored decision.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MOTN-01 | 59-06/07/08/12 | Add/edit/remove Motion keys on any rail | ✓ SATISFIED | Command tests + wiring; every rail kind binds |
| MOTN-02 | 59-06/07/15 | Motion keys independent of drawing keys | ✓ SATISFIED | Deep-equality command tests; delete re-anchor test; reveal-creation neighbour now re-anchors and stays live |
| MOTN-03 | 59-02/07/10/17/25 | Position (grouped or split), Scale, Rotation, Opacity | ✓ SATISFIED | Add-channel path reachable; all channels carry keys; grouped Position easing/wiggle reaches both axes (59-25) |
| MOTN-04 | 59-02/10/17/23 | Channels open on demand, one at a time | ✓ SATISFIED | Keyless menu + two-writer session signal; always-rendered authority-gated `+` row; no lane by default |
| MOTN-05 | 59-05/06/15/22 | Rail-local time; survives move/repeat | ✓ SATISFIED | Evaluator + identity + start-move reconciliation + copy ownership tests |
| MOTN-06 | 59-05/15/19 | Repeat semantics observable | ✓ SATISFIED | Span resolver extends infinity to the structural effective end; finite repeats covered |
| MOTN-07 | 59-08/09/15/19 | Compositor transform, one raster, content cycles, no re-bake | ✓ SATISFIED | One-raster/no-re-bake verified; infinities keep the transform while content cycles |
| MOTN-08 | 59-09/16 | Edit view, Play, export agree | ✓ SATISFIED | Single flattened path + parity tests |
| MOTN-09 | 59-05/08 | Rotation unbounded, hold outside keys, time-invariant pivot | ✓ SATISFIED | Evaluator + pivot tests (the unbounded domain is also the reachability path of the open encoder gap) |
| MOTN-10 | 59-05/07/12/20/25 | Ease/Wiggle/Hold on Motion keys only, seeded deterministic; merge drop surfaced | ✓ SATISFIED | Command/evaluator tests; move path publishes the non-undoable notice; lane curve uses the rail seed |
| MOTN-11 | 59-12 | Three independent selection scopes | ✓ SATISFIED | Scope resolver + per-scope command table wired; exclusivity enforced in hosts |
| MOTN-12 | 59-03/07/13/14/20/22 | Save/reopen + one undo step per key op; reveal doors reconcile | ✓ SATISFIED | Persistence/round-trip/history tests; reveal creation now reconciles against the clip it appends |
| MUI-01 | 59-11/12 | Coloured chevron / grey minus | ? NEEDS HUMAN | Code present; visual pending live UAT (kept Pending) |
| MUI-02 | 59-10/11 | 18px lanes, header cluster, cells, curves, keys, rim | ? NEEDS HUMAN | Contract tests pin measures; runtime visual pending |
| MUI-03 | 59-10/11 | Rounded outline wraps row + channels, absent collapsed | ? NEEDS HUMAN | Structure present; runtime visual pending |
| MUI-04 | 59-11/12 | One open rail block at a time | ? NEEDS HUMAN | Single-writer signal + tests; live behaviour pending |
| MUI-05 | 59-11/14 | Measured alignment/reorder, 2px post-block gap | ? NEEDS HUMAN | Measured-array tests; live scroll pending |
| MUI-06 | 59-09/12/23 | Previous/next/diamond; disabled with a real reason | ✓ SATISFIED | Availability authority + visible reasons; the `+` row is disabled with the authority's sentence |
| REL-01 | 59-01/16 | No new runtime dependencies | ✓ SATISFIED | Dependency-surface test |
| REL-02 | 59-01/03/13/24 | New `.mce` fields round-trip byte-identically, pinned by a test; cross-language persistence identity | ✗ BLOCKED | Rail-kind and ordering parity green (six fixtures, 3 Rust tests); round-trip tests green — but TS `String(value)` and Rust `Display` diverge for exponent magnitudes, so the Rust hash gate rejects an in-domain rail-motion value (open CR-01) |
| REL-03 | 59-03/09 | Motion in canonical revision; no sampled values in cache key | ✓ SATISFIED | Revision tests + cache tests |
| REL-04 | 59-09/16 | Motion-blur export keeps paint (integer content, fractional transform) | ✓ SATISFIED | Export parity tests |

**Orphaned requirements:** none — every ID mapped to Phase 59 in REQUIREMENTS.md appears in at least one plan frontmatter.

### Prohibitions Review

All phase plans declare prohibitions; every one is `status: unresolved` with `verification: null` (judgment-tier, no wired enforcement). Material checks on this pass:

- **Now honored:** 59-04 sort agreement (59-24's one code-unit comparator plus the mixed-case fixture) and 59-06/59-15's one-transaction / no-silent-drop intent on reveal creation (59-22's pending clip plus the live regression). 59-02 fail-closed parsing, 59-03 conditional canonical term and no sampled cache values, 59-05 single interpolation and no wall-clock wiggle, 59-08 single compositor transform, 59-10 no separate Position-X/Y rows, 59-11 expansion single-writer, 59-12 no drawing-key mutation from motion commands and no notice persistence, 59-17 no React state hook and no direct store setter from the menu, 59-18 same-track motion, 59-19 pure injected resolver, 59-20 no store→notice import and no restore promise on the non-undoable path, 59-21 `present` from channel existence.
- **Still judgment-tier and open for the human checkpoint:** the remaining prohibitions have no wired enforcement; this pass found no evidence that any is violated in the shipped paths, but they are not machine-verified and must not be treated as resolved.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/src/efx-paint/document/efxPaintCanonicalEncoder.ts` / `app/src-tauri/src/services/script_library.rs` | 16-18 / 1282-1284 | TS `String(value)` exponent notation vs Rust `format!` plain decimal | 🛑 BLOCKER | In-domain Scale/Rotation values >= 1e21 (or < 1e-6) produce different project hashes; the write reports success, then the Rust settle gate rejects the document (open CR-01) |
| `app/src-tauri/src/services/script_library.rs` | 1251-1257 | Stale comment claims the document carries only bounded integers plus the [0,1] grain float | ⚠️ WARNING | The premise no longer holds after D-09's unbounded domains; a future reader may trust it |
| `app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts` | 650-709, 859-869, 965-999 | Cross-track loop materialized frames outside `PastedExtent` (current review WR-02) | ⚠️ WARNING | A duplicate can accept a colliding anchor or a paste can fail with a generic `apply-failed` reason; the transaction validates before mutating |
| `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` / `script_library.rs` | 1591-1603 / 1260-1262, 1580-1589 | ASCII-id assumption unenforced (current review WR-01) | ⚠️ WARNING | Foreign/doctored non-ASCII ids would diverge; fail-closed at the hash gate, no silent corruption |
| `app/src/components/physic-paint/roto/railMotionCommands.ts` | 464-466 | Impossible-state guard silently skips a missing paired axis (current review IN-01) | ℹ️ INFO | A violated D-12 invariant would masquerade as a successful single-axis edit |
| `app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts` | 309, 1104 | `localeCompare` remains in two non-canonical ordering sites (current review IN-02) | ℹ️ INFO | Does not change a revision today; same hazard class as the fixed WR-05 |
| `app/src/components/physic-paint/roto/railMotionCommands.ts` | 191-211 | `addMotionChannel` lacks the sibling commands' try/catch around the throwing reducer (IN-04) | ℹ️ INFO | Defensive; duplicate check plus the reducer no-op keep the throw unreachable from valid state |
| `app/src/components/physic-paint/roto/railMotionCommands.ts` / `railMotionIdentity.ts` | 686 / 197 | Dead exports `resolveRecordChannels`, `describeRailMotionOrphan` (IN-05) | ℹ️ INFO | No production consumer |

No `TBD`/`FIXME`/`XXX` debt markers in the implementation files touched by this phase, and no placeholder/empty-return stubs were found on the phase paths.

### Human Verification Required

The 13 live UAT rows in `59-UAT.md` remain `pending`; their status is `live-uat-pending`. Rows 1-3 also carry the v7 chrome visual check (MUI-02..MUI-05). Unlike the previous pass, rows 2, 3, 4, 6 and 9 are no longer structurally blocked, and row 6's `stale-member` caveat is closed by 59-22.

| # | Test | Expected | Why Human |
|---|------|----------|-----------|
| 1 | Animate a Standard rail; place a second Position key; expand; drag/type Position | One Position key seeded; coloured chevron then chevron-down; one lane with 6x6 keys and a 1.5px curve; rail moves; drawing keys unchanged | Live rendering and interaction |
| 2 | Animate a Reveal rail; add a Scale channel key | No conversion; Scale lane appears from the keyless menu; reveal paints scaled; no cycle value | Live gesture and visual response |
| 3 | Animate a bare Key Rail; add Rotation 0deg then 720deg | No conversion/cycle; two keys; 720deg distinct from 0deg; drawing keys untouched | Live gesture |
| 4 | Animate a loop rail (repeat >= 2, including infinity); scrub across boundaries | Motion spans the rail lifecycle; every occurrence shows the same rhythm; hold after the last key; no re-bake flash | Live scrubbing |
| 5 | Move an animated rail; compare the same rail-local frame | Keys follow the rail; identical evaluated transform; no key dropped/duplicated | Live drag and visual comparison |
| 6 | Copy/paste an animated rail; edit the copy | Copy carries its own motion; edits do not cross; source keeps all keys | Live clipboard gesture |
| 7 | Delete a rail's first drawing key | Motion stays with frames unchanged; one undo restores key and motion together | Live delete + undo |
| 8 | Delete the last remaining drawing key | Rail and Motion block disappear; chevron returns to grey minus; one undo restores both | Live delete + undo |
| 9 | Merge two rails where both sides carry motion through the strip move | Session-only confirmation names the dropped tail span and states it cannot be undone; one undo restores rails and tail motion | Live gesture; notice presentation is visual |
| 10 | Save, close, reopen with motion intact | Every rail keeps frames, values, easing, wiggle and rim colour; blocks start collapsed; no revision-mismatch error | Full app lifecycle and persistence |
| 11 | Undo/redo a motion edit (add key, change value) | One undo step per operation; drawing keys untouched | Live undo stack |
| 12 | Export with motion blur; inspect consecutive frames | Every frame carries paint; smooth sub-frame transform; no double transform or re-baked cycle | Requires a real export and pixel inspection |
| 13 | Studio monitor transform matches Play and Edit view | Position, scale, rotation and opacity agree at the same frame; no jump at playback start; active track is not special | Live playback comparison |
| 14 | Create a Reveal rail over a Key Rail that carries motion and continues past the reveal span | The neighbouring Key Rail keeps its motion lane and evaluated transform after creation; deleting the reveal later does not strand the record | Live gesture; the deterministic regression row now passes, so this is the live acceptance check for the previous CR-01 |

### Gaps Summary

The review gap-closure round is genuinely complete in source and in tests. 59-22 closes the previous structural blocker: the reveal bake now knows the Loop Clip it is about to append (`RevealLoopClipTemplate`, pre-bake `revealLoopId`, duplicate-id guard, pending clip appended to the reconciler's next snapshot), and the regression row proves a neighbouring Key Rail's motion survives re-anchored and live (`opacity 0.5` from a flattened build at frame 14). 59-22 also closes WR-06 with one exported group-ownership authority consumed by the reconciler, the copy payload builder and the store copy. 59-23 makes the add-channel row always render and gates it on the single availability authority; 59-24 removes the unread merge-drop from cut/clear and replaces collation ordering with one code-unit comparator plus a mixed-case sixth fixture; 59-25 fans grouped-Position easing/wiggle over both axes and seeds the lane curve with the rail's own id. The focused suites (378 + 274 + 128 tests), the full suite (395 files / 7,894 tests) and the Rust parity tests (3/3) are green.

The phase goal is **not yet fully achieved** because of one open blocker that is a direct consequence of the phase's own domain expansion: **the TypeScript and Rust canonical number encoders disagree for exponent-notation magnitudes (current 59-REVIEW.md CR-01)**. `encodeCanonicalNumber` prints `String(value)` (exponent form at |v| >= 1e21 or < 1e-6) while Rust prints plain decimal. D-09 admits unbounded rotation and any positive scale, and the shipped free-entry Motion inspector can produce such a value (for example `2e23` in Scale, or `1e21` in Rotation); the rail-motion write reports success, then the Rust settle hash gate rejects the document with 'Target physical hash does not match the canonical physical document'. The golden fixtures carry no exponent-magnitude values, so the parity suite cannot see it. This is a carried encoder defect made *reachable* by Phase 59; it does not prevent animation or the compositor transform, but it breaks the phase's cross-language persistence contract (REL-02) for values the phase's model accepts.

The two behavior-unverified truths (chevron rendering, v7 chrome measures) are not blockers by themselves; they remain routed to live UAT and must not be flipped to Complete without it. The current review's WR-01 (ASCII-id assumption) and WR-02 (cross-track paste extent) are carried as warnings, and IN-01..IN-05 as info.

---

_Verified: 2026-11-07T11:44:27Z_
_Verifier: Claude (gsd-verifier)_
