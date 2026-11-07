---
phase: 59-rail-motion-channels-v7-interface
verified: 2026-11-07T12:40:59Z
status: human_needed
score: 19/21 must-haves verified
covered_files: [".planning/phases/59-rail-motion-channels-v7-interface/59-01-PLAN.md",".planning/phases/59-rail-motion-channels-v7-interface/59-01-SUMMARY.md",".planning/phases/59-rail-motion-channels-v7-interface/59-02-PLAN.md",".planning/phases/59-rail-motion-channels-v7-interface/59-02-SUMMARY.md",".planning/phases/59-rail-motion-channels-v7-interface/59-03-PLAN.md",".planning/phases/59-rail-motion-channels-v7-interface/59-03-SUMMARY.md",".planning/phases/59-rail-motion-channels-v7-interface/59-04-PLAN.md",".planning/phases/59-rail-motion-channels-v7-interface/59-04-SUMMARY.md",".planning/phases/59-rail-motion-channels-v7-interface/59-05-PLAN.md",".planning/phases/59-rail-motion-channels-v7-interface/59-05-SUMMARY.md",".planning/phases/59-rail-motion-channels-v7-interface/59-06-PLAN.md",".planning/phases/59-rail-motion-channels-v7-interface/59-06-SUMMARY.md",".planning/phases/59-rail-motion-channels-v7-interface/59-07-PLAN.md",".planning/phases/59-rail-motion-channels-v7-interface/59-07-SUMMARY.md",".planning/phases/59-rail-motion-channels-v7-interface/59-08-PLAN.md",".planning/phases/59-rail-motion-channels-v7-interface/59-08-SUMMARY.md",".planning/phases/59-rail-motion-channels-v7-interface/59-09-PLAN.md",".planning/phases/59-rail-motion-channels-v7-interface/59-09-SUMMARY.md",".planning/phases/59-rail-motion-channels-v7-interface/59-10-PLAN.md",".planning/phases/59-rail-motion-channels-v7-interface/59-10-SUMMARY.md",".planning/phases/59-rail-motion-channels-v7-interface/59-11-PLAN.md",".planning/phases/59-rail-motion-channels-v7-interface/59-11-SUMMARY.md",".planning/phases/59-rail-motion-channels-v7-interface/59-12-PLAN.md",".planning/phases/59-rail-motion-channels-v7-interface/59-12-SUMMARY.md",".planning/phases/59-rail-motion-channels-v7-interface/59-13-PLAN.md",".planning/phases/59-rail-motion-channels-v7-interface/59-13-SUMMARY.md",".planning/phases/59-rail-motion-channels-v7-interface/59-14-PLAN.md",".planning/phases/59-rail-motion-channels-v7-interface/59-14-SUMMARY.md",".planning/phases/59-rail-motion-channels-v7-interface/59-15-PLAN.md",".planning/phases/59-rail-motion-channels-v7-interface/59-15-SUMMARY.md",".planning/phases/59-rail-motion-channels-v7-interface/59-16-PLAN.md",".planning/phases/59-rail-motion-channels-v7-interface/59-16-SUMMARY.md",".planning/phases/59-rail-motion-channels-v7-interface/59-17-PLAN.md",".planning/phases/59-rail-motion-channels-v7-interface/59-17-SUMMARY.md",".planning/phases/59-rail-motion-channels-v7-interface/59-18-PLAN.md",".planning/phases/59-rail-motion-channels-v7-interface/59-18-SUMMARY.md",".planning/phases/59-rail-motion-channels-v7-interface/59-19-PLAN.md",".planning/phases/59-rail-motion-channels-v7-interface/59-19-SUMMARY.md",".planning/phases/59-rail-motion-channels-v7-interface/59-20-PLAN.md",".planning/phases/59-rail-motion-channels-v7-interface/59-20-SUMMARY.md",".planning/phases/59-rail-motion-channels-v7-interface/59-21-PLAN.md",".planning/phases/59-rail-motion-channels-v7-interface/59-21-SUMMARY.md",".planning/phases/59-rail-motion-channels-v7-interface/59-22-PLAN.md",".planning/phases/59-rail-motion-channels-v7-interface/59-22-SUMMARY.md",".planning/phases/59-rail-motion-channels-v7-interface/59-23-PLAN.md",".planning/phases/59-rail-motion-channels-v7-interface/59-23-SUMMARY.md",".planning/phases/59-rail-motion-channels-v7-interface/59-24-PLAN.md",".planning/phases/59-rail-motion-channels-v7-interface/59-24-SUMMARY.md",".planning/phases/59-rail-motion-channels-v7-interface/59-25-PLAN.md",".planning/phases/59-rail-motion-channels-v7-interface/59-25-SUMMARY.md","app/src-tauri/Cargo.toml","app/src-tauri/src/services/script_library.rs","app/src/components/physic-paint/PhysicsPaintStudio.test.ts","app/src/components/physic-paint/PhysicsPaintStudio.tsx","app/src/components/physic-paint/hooks/physicsPaintRotoLoopHistory.test.ts","app/src/components/physic-paint/hooks/physicsPaintRotoRailMotionHistory.test.ts","app/src/components/physic-paint/hooks/useRotoKeyUtilities.test.ts","app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts","app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts","app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts","app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts","app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts","app/src/components/physic-paint/hooks/useRotoTimelineActions.ts","app/src/components/physic-paint/roto/physicsPaintRotoGroupLifecycle.ts","app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts","app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts","app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts","app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.test.ts","app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts","app/src/components/physic-paint/roto/physicsPaintRotoRailSetSelection.ts","app/src/components/physic-paint/roto/physicsPaintRotoSession.test.ts","app/src/components/physic-paint/roto/railMotionCommands.test.ts","app/src/components/physic-paint/roto/railMotionCommands.ts","app/src/components/physic-paint/roto/railMotionDocumentReconciler.test.ts","app/src/components/physic-paint/roto/railMotionDocumentReconciler.ts","app/src/components/physic-paint/roto/railMotionEvaluator.test.ts","app/src/components/physic-paint/roto/railMotionEvaluator.ts","app/src/components/physic-paint/roto/railMotionIdentity.test.ts","app/src/components/physic-paint/roto/railMotionIdentity.ts","app/src/components/physic-paint/roto/railMotionInkScan.test.ts","app/src/components/physic-paint/roto/railMotionInkScan.ts","app/src/components/physic-paint/roto/railMotionMergeNotice.test.ts","app/src/components/physic-paint/roto/railMotionMergeNotice.ts","app/src/components/physic-paint/roto/railMotionModel.test.ts","app/src/components/physic-paint/roto/railMotionModel.ts","app/src/components/physic-paint/roto/railMotionPersistence.test.ts","app/src/components/physic-paint/roto/railMotionPivot.test.ts","app/src/components/physic-paint/roto/railMotionPivot.ts","app/src/components/physic-paint/roto/rotoCoordinatorPorts.ts","app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx","app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts","app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx","app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx","app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx","app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx","app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts","app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx","app/src/components/physic-paint/view/TimelineMotionChannels.test.ts","app/src/components/physic-paint/view/TimelineMotionChannels.tsx","app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts","app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts","app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts","app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx","app/src/components/physic-paint/view/timelineMotionSurface.contract.test.ts","app/src/components/physic-paint/view/timelineRailDesign.test.ts","app/src/components/physic-paint/view/timelineRailDesign.ts","app/src/components/shared/NumericStepper.test.tsx","app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts","app/src/efx-paint/compositor/efxPaintCompositeCache.ts","app/src/efx-paint/compositor/efxPaintCompositor.ts","app/src/efx-paint/compositor/efxPaintCompositorRailMotion.test.ts","app/src/efx-paint/compositor/efxPaintRevealLeakContract.test.ts","app/src/efx-paint/document/efxPaintCanonicalEncoder.test.ts","app/src/efx-paint/document/efxPaintCanonicalEncoder.ts","app/src/efx-paint/document/efxPaintDocumentRevision.ts","app/src/lib/__fixtures__/railMotionCanonical.golden.json","app/src/lib/efxPaintPersistence.ts","app/src/lib/paperPass.frameGuard.test.ts","app/src/lib/physicPaintBridge.test.ts","app/src/lib/physicPaintBridge.ts","app/src/lib/railMotionCanonicalParity.test.ts","app/src/lib/railMotionDependencySurface.test.ts","app/src/lib/railMotionExportParity.test.ts","app/src/lib/railMotionGateBEdits.test.ts","app/src/lib/railMotionPackageRoundTrip.test.ts","app/src/stores/efxPaintPersistenceRailMotionRoundTrip.test.ts","app/src/stores/efxPaintStore.reveal.test.ts","app/src/stores/efxPaintStore.ts","app/src/stores/physicPaintStore.rotoRailMotions.test.ts","app/src/stores/physicPaintStore.test.ts","app/src/stores/physicPaintStore.ts","app/src/stores/trackIsolation.test.ts","app/src/types/physicPaint.test.ts","app/src/types/physicPaint.ts"]
covered_digest: "v4:sha256:cee8afb9e4a2f1df598135d7716a1ddc105a0c846adface554e94cb6c6c3cfe3"
behavior_unverified: 2
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 18/21
  gaps_closed:
    - "Negative zero across the Tauri IPC boundary (truth 21 / REL-02): `encodeCanonicalNumber` now normalizes `-0` to `+0` before taking the IEEE-754 bit pattern, matching what the JSON transport delivers to Rust. `JSON.stringify(-0)` is `'0'`, so the renderer's in-memory hash and the Rust prepare gate's recomputed hash agree for every value the model accepts. Verified independently over a real rail-motion document carrying a `-0` rotation key: in-memory and post-transport hashes are both `project-477-4f706e1`."
  gaps_remaining: []
  regressions: []
advisory:
  - finding: "The canonical ordering/encoding law assumes ASCII rail/key ids but no boundary enforces it (59-REVIEW.md WR-01)"
    category: security
    reason: "Non-ASCII ids would disagree on ordering, length prefixes, FNV input and id limits; reachable only from a foreign/doctored document or a crafted paste payload, and the failure is fail-closed at the hash gate (no silent corruption). Enforce an explicit ASCII charset at the TS validators and `rail_motion_bounded_id`."
    evidence_status: "code review only; no deterministic repro run in this pass; flagged file unchanged since the prior verification"
  - finding: "Cross-track Loop Clip materialized source frames are outside the paste extent/occupancy model (59-REVIEW.md WR-02)"
    category: other
    reason: "`computePastedExtent` enumerates key-rail destinations and loop end-exclusives but not the frames 59-22 materializes at `destinationStart + offset`; a duplicate can accept a colliding anchor or reject with a generic 'apply-failed' reason, and a negative `destinationStart` is not caught by the lower-bound test. The transaction still validates before mutating, so no corruption."
    evidence_status: "code review only; covered suites green; flagged files unchanged since the prior verification"
behavior_unverified_items:
  - truth: "A track with motion shows the coloured chevron (right collapsed, down expanded); a track with no motion shows the grey minus (MUI-01, ROADMAP SC2)"
    test: "Expand/collapse a motion-bearing track's chevron and compare with a motion-free row in the running app."
    expected: "Coloured chevron-right collapsed, chevron-down expanded; a grey 14x14 minus with a visible disabled reason when there is no motion."
    why_human: "Colour, size and glyph rendering are visual; the code path is present (`resolveMotionChevronKind`, aria-expanded/aria-description) but no automated check renders the surface."
  - truth: "The v7 chrome matches its contract: 18px lanes, header cluster with previous/diamond/next, 16x18 cells, 1.5px curves, 6x6 keys with the lighter type rim, rounded outline wrapping row plus expanded channels, one open block at a time, header/lane alignment while scrolling, 2px post-block gap, measured reorder insertion (MUI-02..MUI-05, ROADMAP SC5)"
    test: "Open an expanded motion block in the running app and measure/observe the chrome, the scroll alignment and the reorder indicator."
    expected: "The locked measures and visual contract hold at runtime, including one open block and an indicator that never lands inside a channel block."
    why_human: "Layout, colour and scroll behaviour cannot be certified by grep or a contract test alone; REQUIREMENTS.md keeps MUI-01..MUI-05 Pending for this reason."
human_verification:
  - test: "Animate a Standard rail; place a second Position key; expand; drag/type Position"
    expected: "One Position key seeded; coloured chevron then chevron-down; one lane with 6x6 keys and a 1.5px curve; rail moves; drawing keys unchanged"
    why_human: "Live rendering and interaction"
  - test: "Animate a Reveal rail; add a Scale channel key"
    expected: "No conversion; Scale lane appears from the keyless menu; reveal paints scaled; no cycle value"
    why_human: "Live gesture and visual response"
  - test: "Animate a bare Key Rail; add Rotation 0deg then 720deg"
    expected: "No conversion/cycle; two keys; 720deg distinct from 0deg; drawing keys untouched"
    why_human: "Live gesture"
  - test: "Animate a loop rail (repeat >= 2, including infinity); scrub across boundaries"
    expected: "Motion spans the rail lifecycle; every occurrence shows the same rhythm; hold after the last key; no re-bake flash"
    why_human: "Live scrubbing"
  - test: "Move an animated rail; compare the same rail-local frame"
    expected: "Keys follow the rail; identical evaluated transform; no key dropped/duplicated"
    why_human: "Live drag and visual comparison"
  - test: "Copy/paste an animated rail; edit the copy"
    expected: "Copy carries its own motion; edits do not cross; source keeps all keys"
    why_human: "Live clipboard gesture"
  - test: "Delete a rail's first drawing key"
    expected: "Motion stays with frames unchanged; one undo restores key and motion together"
    why_human: "Live delete + undo"
  - test: "Delete the last remaining drawing key"
    expected: "Rail and Motion block disappear; chevron returns to grey minus; one undo restores both"
    why_human: "Live delete + undo"
  - test: "Merge two rails where both sides carry motion through the strip move"
    expected: "Session-only confirmation names the dropped tail span and states it cannot be undone; one undo restores rails and tail motion"
    why_human: "Live gesture; notice presentation is visual"
  - test: "Save, close, reopen with motion intact"
    expected: "Every rail keeps frames, values, easing, wiggle and rim colour; blocks start collapsed; no revision-mismatch error"
    why_human: "Full app lifecycle and persistence"
  - test: "Undo/redo a motion edit (add key, change value)"
    expected: "One undo step per operation; drawing keys untouched"
    why_human: "Live undo stack"
  - test: "Export with motion blur; inspect consecutive frames"
    expected: "Every frame carries paint; smooth sub-frame transform; no double transform or re-baked cycle"
    why_human: "Requires a real export and pixel inspection"
  - test: "Studio monitor transform matches Play and Edit view"
    expected: "Position, scale, rotation and opacity agree at the same frame; no jump at playback start; active track is not special"
    why_human: "Live playback comparison"
---

# Phase 59: Rail Motion Channels & v7 Interface Verification Report

**Phase Goal:** Every rail — Standard, Motion, Static, Reveal, or a bare Key Rail — can be animated by Motion keys that are independent of its drawing keys, and the transform is applied once at the compositor so edit view, Play, and export show the same frame.
**Verified:** 2026-11-07T12:40:59Z
**Status:** human_needed
**Re-verification:** Yes — after `9817da784` (negative-zero transport fix, following `ab9093c79` and `797929fd9`)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A Motion key can be added on any rail kind (Standard, Motion, Static, Reveal, bare Key Rail) with no cycle value, no conversion, and without creating or altering a drawing key (SC1, MOTN-01/MOTN-02) | ✓ VERIFIED | `railMotionCommands.ts` `animateRail` binds Loop Clips by `loopId`, mints one UUID for a bare Key Rail and has no rail-kind gate; command tests cover Reveal/Static parity and deep-equality of drawing keys/loops/breaks; the full suite stays green |
| 2 | Position (grouped or split X + Y), Scale, Rotation, and Opacity each animate with their own keys (SC2, MOTN-03) | ✓ VERIFIED | Add-channel path (`PhysicsPaintTrackRow.tsx` → `PhysicsPaintWorkflowStrip.tsx` → `useRotoTimelineActions.ts` → `railMotionCommands.ts` → reducer) is reachable; 59-25 fans easing/wiggle over both Position axes; command suite green |
| 3 | Channels open on demand, one at a time; no lane appears by default (SC2, MOTN-04) | ✓ VERIFIED | Two-writer session signal + absolute overlay; 59-23 makes the `+` row always render and gates it on `resolveMotionCommandAvailability`; `TimelineMotionChannels.test.ts` green |
| 4 | A track with motion shows the coloured chevron (right collapsed/down expanded); a track without motion shows the grey minus (SC2, MUI-01) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Logic exists (`resolveMotionChevronKind`, aria-expanded/aria-description, 14x14 button); colour/glyph rendering is visual and MUI-01 stays Pending — see Behavior Unverified Items |
| 5 | The rail transform is applied once at the compositor; one content raster per track per frame; nothing re-bakes (SC3, MOTN-07) | ✓ VERIFIED | Both draw sites pass `ports.trackTransforms?.get(track.id)` into the shared `drawEfxPaintTrack`; motion enters only as a conditional revision term; `efxPaintCompositorRailMotion.test.ts` green |
| 6 | Content cycles while motion continues over the rail's full lifecycle (SC3, MOTN-06/MOTN-07) | ✓ VERIFIED | `createRailMotionViewSpanResolver` injected at the store projection, the track row and the hook; infinity takes `Math.max(fallback, resolver end)`; `railMotionIdentity.test.ts` green |
| 7 | Edit view, Play, and export render the identical frame, including on the active track (SC4, MOTN-08) | ✓ VERIFIED | One `getFlattenedFrame` path serves preview and export; `railMotionExportParity.test.ts` green |
| 8 | Motion-blur export keeps paint on every frame: integer content raster + fractional transform (SC4, REL-04) | ✓ VERIFIED | `exportRenderer.ts` sub-frame loop + fractional offset preserved; `railMotionExportParity.test.ts` green |
| 9 | Motion survives save → close → reopen (SC5, MOTN-12 persistence) | ✓ VERIFIED | `railMotions` in the document allowlist, conditional canonical term, byte round-trip tests green (`railMotionPackageRoundTrip.test.ts`, `railMotionPersistence.test.ts`, `efxPaintPersistenceRailMotionRoundTrip.test.ts`) |
| 10 | Rotation is unbounded and values hold outside the keyed range (SC5, MOTN-09) | ✓ VERIFIED | `railMotionValueIsValid('rotation', value)` returns true for any finite number; evaluator interpolates degrees with no wrap; `railMotionEvaluator.test.ts` green |
| 11 | Rail / drawing-key / motion-key scopes work independently, each with its own contextual commands (SC5, MOTN-11) | ✓ VERIFIED | `resolveSelectionScope` + `CONTEXTUAL_COMMANDS_BY_SCOPE` drive the strip; exclusivity enforced in the production hosts |
| 12 | Ease, Wiggle, and Hold attach only to Motion keys; Wiggle is seeded and deterministic at export (SC5, MOTN-10) | ✓ VERIFIED | Command layer accepts easing/wiggle only on motion keys; evaluator seeds FNV-1a per rail/channel/frame; 59-25 makes the lane curve use the same `railId` seed |
| 13 | Every key operation is one undo/redo step (SC5, MOTN-12) | ✓ VERIFIED | History snapshot includes `railMotions`; `physicsPaintRotoRailMotionHistory.test.ts` green |
| 14 | The v7 chrome matches its contract: 18px lanes, header cluster, 16x18 cells, 1.5px curves, 6x6 keys with lighter type rim, rounded outline wrapping row+channels, one open block, aligned header while scrolling, 2px post-block gap, measured reorder insertion (SC5, MUI-02..MUI-05) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Measures and structure are pinned by `timelineMotionSurface.contract.test.ts` and `PhysicsPaintWorkflowStrip.test.ts`; runtime visual/layout behaviour needs the live UAT (MUI-02..MUI-05 stay Pending) |
| 15 | Motion lives in rail-local time; keys survive moving or repeating the rail (SC5, MOTN-05) | ✓ VERIFIED | `resolveRailLocalFrame` subtracts the rail start and clamps; identity returns the same record reference when the start moves; start-move reconciliation tests green |
| 16 | Rail-set Copy and Duplicate carry the rails' Motion with the rails (plan 59-14, UAT row 6) | ✓ VERIFIED | `collectRailMotionGroupOwnedKeyIds` feeds `buildRotoRailSetCopyPayload`, `copyTrackSelection` and `_resolveRotoRailMotionProjection`; copy and track-isolation suites green |
| 17 | Structural edits reconcile Motion in the same commit and a two-sided merge publishes the drop confirmation (plan 59-12/59-15) | ✓ VERIFIED | 59-22 pending-clip reconciliation and the neighbour-reveal regression are green; move-drop publication remains wired; cut/clear no longer report an unread drop |
| 18 | TS and Rust canonical rail-kind/ordering encoders agree (plan 59-01/59-04; REL-02 cross-language) | ✓ VERIFIED | One code-unit `compareCanonicalIds` at all four canonical sorts; `rail-motion-ordering` sixth fixture; `railMotionCanonicalParity.test.ts` (14 tests) and `cargo test --lib rail_motion_canonical_parity` (3/3) green |
| 19 | Motion joins the canonical document revision; sampled values never enter the flattened cache key (REL-03) | ✓ VERIFIED | Conditional `rail-motions:` term after `loops:`; `trackMotionRevisions` emits a `motion:` term only for participating tracks; cache tests green |
| 20 | No new runtime dependencies (REL-01) | ✓ VERIFIED | `railMotionDependencySurface.test.ts` green (bare-import scan, frozen dependency list, non-vacuous check) |
| 21 | Every Motion value the model accepts can settle and persist: the TS and Rust canonical encoders emit the same project hash, so a document the shipped Motion inspector can produce is never rejected by the Rust settle gate (REL-02 cross-language contract, MOTN-12) | ✓ VERIFIED | `encodeCanonicalNumber` normalizes `-0` to `+0` before `DataView.setFloat64` (`value === 0 ? 0 : value`); the Tauri IPC is JSON and `JSON.stringify(-0)` is `'0'`, so Rust receives `+0` and both sides emit `n0000000000000000;`. The prepare path is unchanged: `physicsPaintRotoScriptLibrary.ts:220-221` hashes the in-memory proposal with `buildPhysicPaintRotoProjectEquality` and sends the same document; `script_library.rs:1244-1247` recomputes from the transmitted document. Independent probe over the real document path: a rail-motion document with a `-0` rotation key hashes `project-477-4f706e1` both in memory and after `JSON.parse(JSON.stringify(...))`. Encoder pin: 15 tests including `[-0, '0000000000000000']` and a 14-value transport-invariance loop; parity pin: 14 tests including the document-level transport invariant. Full vitest 396 files / 7,911 passed; Rust 200 passed; tsc clean |

**Score:** 19/21 truths verified (2 present, behavior-unverified)

### Deferred Items

None. Phase 60 (Studio timeline horizontal zoom), Phase 61 (vector painting) and Phase 62 (painted-stroke curve editing) do not cover the canonical-number or IPC value-preservation contract, and the remaining items are live-UAT evidence, not deferred work.

### Advisory (New Scope, Unevidenced)

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| 1 | 59-REVIEW.md WR-01: the canonical ordering/encoding law assumes ASCII ids but no boundary enforces it | security | New-scope from the post-closure review; theoretical for app-minted UUIDs, fail-closed at the hash gate; flagged files unchanged since the prior verification; no deterministic repro |
| 2 | 59-REVIEW.md WR-02: cross-track Loop Clip materialized source frames are outside the paste extent/occupancy model | other | New-scope from the post-closure review; the transaction validates before mutating (no corruption), but a paste can be refused with a generic reason or skip a fitting destination; flagged files unchanged since the prior verification |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/src/components/physic-paint/roto/railMotionModel.ts` | Types, parser, pure reducer | ✓ VERIFIED | Fail-closed caps, D-09 domains, add-channel and paired-axis rules all present and green; `-0` is still an accepted domain value, which is now harmless because the canonical encoder normalizes it before hashing |
| `app/src/components/physic-paint/roto/railMotionEvaluator.ts` | Single interpolation authority, curve path | ✓ VERIFIED | Endpoint hold, smoothstep, unbounded rotation, seeded wiggle; curve path consumes `{ railId }` |
| `app/src/components/physic-paint/roto/railMotionCommands.ts` | Availability + command layer | ✓ VERIFIED | `addMotionChannel` and both fan-out setters present; `resolveMotionCommandAvailability` is the one authority consumed by the row; `writeRailMotionChannelValueAtCursor` passes values to the reducer unchanged |
| `app/src/components/physic-paint/roto/railMotionIdentity.ts` | Durable identity + reconciliation | ✓ VERIFIED | Loop Clip binds by loopId, UUID mint, orphan retention; span resolver injected; module stays pure |
| `app/src/components/physic-paint/roto/railMotionDocumentReconciler.ts` | Commit-point reconciler + one ownership authority | ✓ VERIFIED | Exported `collectRailMotionGroupOwnedKeyIds`; `groupOwnedKeyIdsFor` delegates to it |
| `app/src/components/physic-paint/roto/railMotionMergeNotice.ts` | Session notice + copy | ✓ VERIFIED | Signals, publish/dismiss, undoable companion; no store import, no persistence |
| `app/src/components/physic-paint/view/TimelineMotionChannels.tsx` | v7 lanes/keys/curve/menu | ✓ VERIFIED | Add-channel row disabled/reason props; curve call passes `{ railId }` |
| `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` | Chevron, outline, block layout | ✓ VERIFIED | Always-rendered authority-gated `+` row; grouping addressed through the command layer |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` | Active-lane host, measured layout, actions | ✓ VERIFIED | `activeMotionAddChannelRow` follows the lane count; keyless second derivation deleted; move-drop publish wired |
| `app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts` | Inspector projection | ✓ VERIFIED | `present` derives from channel existence; absent channels marked |
| `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx` | Motion inspector controls | ✓ VERIFIED | Absent channels disabled with a visible note; free-entry fields reach the command layer, and `-0` no longer forks the hash |
| `app/src/components/shared/NumericStepper.tsx` | Shared numeric field | ✓ VERIFIED | Free-entry `-0.0001` can still yield `-0`, but the canonical encoder now normalizes it, so the value settles and persists like `0` |
| `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` | Motion actions + copy/duplicate | ✓ VERIFIED | Add-channel action, copy document railMotions and the single commit path wired |
| `app/src/stores/physicPaintStore.ts` | Projection, transform resolution, revisions | ✓ VERIFIED | Transform/view/revision paths present; pending reveal clip and duplicate guard wired; shared ownership collector in the projection and copy |
| `app/src/stores/efxPaintStore.ts` | Reveal rail lifecycle | ✓ VERIFIED | `revealLoopId` minted pre-bake, one shared clip base passed as the pending template and reused for the appended clip |
| `app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts` | Rail-set copy with real ownership | ✓ VERIFIED | Segments with `collectRailMotionGroupOwnedKeyIds`; Option B loop `sourceEntries` carrier |
| `app/src/efx-paint/compositor/efxPaintCompositor.ts` | One transform application | ✓ VERIFIED | Both draw sites delegate to the shared `drawEfxPaintTrack` |
| `app/src/efx-paint/compositor/efxPaintCompositeCache.ts` | Motion revision in cache key | ✓ VERIFIED | Conditional participating-track term, no sampled values |
| `app/src/lib/exportRenderer.ts`, `app/src/lib/previewRenderer.ts` | Sub-frame export parity | ✓ VERIFIED | Integer content + fractional transform flow |
| `app/src/efx-paint/document/efxPaintCanonicalEncoder.ts` | Cross-language number encoder | ✓ VERIFIED | IEEE-754 binary64 bits, big-endian, 16 lowercase hex; `-0` normalized to `+0` before encoding so the in-memory hash matches the JSON-transported document; every decimal-formatting path removed |
| `app/src-tauri/src/services/script_library.rs` | Rust canonical/guard parity | ✓ VERIFIED | `canonical_number` emits `value.to_bits()`; the prepare gate recomputes from the transmitted document; with TS normalizing `-0`, both languages hash `+0` identically |
| `app/src/efx-paint/document/efxPaintCanonicalEncoder.test.ts` | Focused encoder pin | ✓ VERIFIED | 15 tests: 0/`-0`/±powers/12.5/0.25/1e-6/1e20 rows, exponent magnitudes including `5e-324`, the former tie double, distinct-double rows, a `-0` normalization row, a 14-value transport-invariance row, optional wrapper, string encoding |
| `app/src/lib/railMotionCanonicalParity.test.ts` | Cross-language golden parity + document transport pin | ✓ VERIFIED | 14 tests; 7 documents, all hash identically after a JSON transport round trip; the fixture's expected values are frozen literals; no `-0` appears in any fixture document |
| `app/src/lib/__fixtures__/railMotionCanonical.golden.json` | Cross-language golden documents | ✓ VERIFIED | Seven documents; `untouched` and `rail-motion-empty` share `project-574-2ec2df1c` byte-for-byte; `rail-motion-exponent` carries `1e-7`, `1e21` and the former tie double |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Animate action | `animateRail` -> store -> bridge -> Rust | command commit path | ✓ WIRED | `commitRailMotionRecords` -> `replaceRotoPhysicalRailMotions`; bridge forwards/reconciles |
| Motion key write/easing/wiggle | store collection | `writeMotionTransformAtCursor` / write value | ✓ WIRED | All refuse absent channels; 59-21 makes the refusal visible |
| Add-channel row + menu | store collection | row -> `onAddMotionChannel` -> `addMotionChannel` -> reducer -> single motion commit | ✓ WIRED | 59-23 renders the row on every expanded block and gates it on the authority; overlay gated on `enabled && open` |
| Copy/Duplicate command | motion payload | `buildRailSetCopyDocument` | ✓ WIRED | 59-22 derives ownership through the shared collector; clip-following Key Rail copies with its own first key and frozen motion |
| Store removal reconciliation | merge-drop notice | `mergedDrop` -> strip publish | ✓ WIRED | `moveTrackItems` result is read by the strip; `cutTrackSelection`/`clearTrackFrames` no longer compute or return a drop |
| Reveal creation | motion reconciler | `createRevealRail` pre-bake `loopId` -> `pendingLoopClip` -> next snapshot -> `reconcileRailMotionsForDocumentEdit` | ✓ WIRED | 59-22; duplicate `loopId` fails closed before rendering; regression asserts a live transform at frame 14 |
| `document.loopClips` | Key Rail segmentation | `collectRailMotionGroupOwnedKeyIds` -> `deriveKeyRailSegments` in both copy paths | ✓ WIRED | One authority consumed by the reconciler, the payload builder, `copyTrackSelection` and `_resolveRotoRailMotionProjection` |
| `trackTransforms` | compositor draw | `drawEfxPaintTrack` | ✓ WIRED | Both draw sites pass the per-track transform |
| Export fractional frame | `getFlattenedFrame` | sub-frame loop | ✓ WIRED | Parity test covers the law |
| TS canonical revision | Rust canonical revision | `rail-motions:` term | ✓ WIRED | Encoder parity is exact (binary64 bits both sides); the one value the JSON transport cannot preserve (`-0`) is normalized by the TS encoder, so the prepare gate recomputes the same hash. Only production Rust call site of `canonical_physical_hash` is the prepare gate (`script_library.rs:1244`) |
| Inspector fields | channel value write | `projectRailMotionInspector` -> NumericStepper | ✓ WIRED | Absent channels disabled with a visible reason; free-entry values reach the command layer and settle after normalization |

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
| Reveal-creation motion ownership | `anchorKeyId` / views | pending clip in the reconciler next snapshot -> appended clip | Yes | ✓ FLOWING |
| Canonical rail-motion revision | `encodeCanonicalNumber` / `canonical_number` | rail-motion key values -> project hash -> Rust gate | Yes — all finite accepted values, including `-0`, hash identically before and after the JSON transport | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Focused canonical set (encoder + parity) | `cd app && npx vitest run src/efx-paint/document/efxPaintCanonicalEncoder.test.ts src/lib/railMotionCanonicalParity.test.ts` | 2 files, 29 tests passed (encoder 15, parity 14) | ✓ PASS |
| Full project suite | `cd app && npx vitest run` | 396 files passed, 2 skipped (398); 7,911 tests passed, 1 skipped, 96 todo | ✓ PASS |
| Rust full suite | `cargo test --manifest-path app/src-tauri/Cargo.toml` | 200 passed, 0 failed (116 lib + 20 + 39 + 4 + 21) | ✓ PASS |
| Rust canonical rail-motion parity | `cargo test --manifest-path app/src-tauri/Cargo.toml --lib rail_motion_canonical_parity` | 3 passed (parity, reserved ordinal, malformed rejection) | ✓ PASS |
| Rust script-library transaction contract | `cargo test --manifest-path app/src-tauri/Cargo.toml --test script_library_transaction_contract` | 21 passed, 0 failed | ✓ PASS |
| Typecheck | `cd app && npx tsc --noEmit` | exit 0, no diagnostics | ✓ PASS |
| `-0` document-path probe (independently run, temporary test deleted) | Real `rail-motion` document with a rotation key value of `-0`, hashed in memory and after `JSON.parse(JSON.stringify(...))` | In-memory `project-477-4f706e1`; transported `project-477-4f706e1`; canonical source contains `n0000000000000000;` and not `n8000000000000000;` | ✓ PASS (gap closed) |
| Old-encoder model | `DataView.setFloat64(0, -0)` bits vs normalized path | Old: `n8000000000000000;`; normalized: `n0000000000000000;`; `JSON.stringify(-0) === '0'` | ✓ PASS (the fix is load-bearing) |
| Document-level transport pin sensitivity | Re-hash each of the 7 frozen documents after `JSON.parse(JSON.stringify(...))` and compare every numeric value with `Object.is` | 0 numeric divergences in all 7 documents; 0 `-0` literals anywhere in the fixture | ✓ PASS (pin exercises the document path) but NOT sensitive to `-0` by itself — the leaf-level `-0` and 14-value transport rows are what catch that regression |
| Plan artifact verification | `gsd_run query verify.artifacts` over all 25 plans | 109/109 declared artifacts present and substantive | ✓ PASS |
| Decision coverage gate | `gsd_run query check.decision-coverage-verify` | 19/19 trackable CONTEXT.md decisions honored (`not_honored: []`) | ✓ PASS |

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
| `efxPaintStore.reveal.test.ts` | MOTN-12, previous CR-01 | active | 0 | no | behavioral | PASS |
| `physicsPaintRotoRailSetCopy.test.ts` | MOTN-05, WR-06 | active | 0 | no | behavioral | PASS |
| `trackIsolation.test.ts` | MOTN-05, WR-06 | active | 0 | no | behavioral | PASS |
| `railMotionCanonicalParity.test.ts` | REL-02 | active | 0 | no | value + cross-language fixture + document transport | PASS; the fixture pin covers whole-document transport stability but contains no `-0`, so it is not by itself the `-0` regression catcher |
| `efxPaintCanonicalEncoder.test.ts` | REL-02 | active | 0 | no | value | PASS; 15 tests, including the `-0` row and the 14-value JSON-transport invariance row that would fail under the old sign-bit encoder |
| `PhysicsPaintTrackRow.test.tsx` | MUI-01..05 | active | 0 | no | structural | PRESENT_BEHAVIOR_UNVERIFIED (visual) |
| `PhysicsPaintWorkflowStrip.test.ts` | MUI-02..05, MOTN-10 | active | 0 | no | value/structural | PASS |
| `TimelineMotionChannels.test.ts` | MUI-02..04, MOTN-03/04, WR-03 | active | 0 | no | value | PASS |
| `physicsPaintKeyRailPresentation.test.ts` | MUI-06, 59-21 | active | 0 | no | value | PASS |
| `PhysicsPaintScriptsPanel.test.ts` | 59-21 | active | 0 | no | behavioral | PASS |
| `railMotionMergeNotice.test.ts` | MOTN-10 | active | 0 | no | value | PASS |
| `physicPaintStore.rotoRailMotions.test.ts` | MOTN-10/12, WR-02 | active | 0 | no | behavioral | PASS |

**Disabled tests on requirements:** 0 (no skipped assertions; the `skipped` count in the full run is file-level, unrelated to requirement tests).
**Circular patterns detected:** 0. The golden fixture's expected values are frozen literals, not recomputed by the system under test.
**Insufficient assertions:** 0 on covered truths. The transport boundary is now covered at both levels: a document-level invariant over all 7 frozen documents and a value-level `-0`/14-value invariance pin. Residual limitation: the document-level fixture pin alone would not have caught the `-0` regression because no fixture carries `-0`; the value-level pin is the regression catcher. This does not weaken the truth — the end-to-end document path was independently reproduced with a real `-0` value and settles identically.

### Decision Coverage

All trackable CONTEXT.md decisions are honored by shipped artifacts (19/19; `not_honored: []`). The former `-0` boundary issue was an encoding-transport consequence of D-09's unbounded domain, not an unhonored decision; it is now closed at the encoder.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MOTN-01 | 59-06/07/08/12 | Add/edit/remove Motion keys on any rail | ✓ SATISFIED | Command tests + wiring; every rail kind binds |
| MOTN-02 | 59-06/07/15 | Motion keys independent of drawing keys | ✓ SATISFIED | Deep-equality command tests; delete re-anchor test; reveal-creation neighbour re-anchors and stays live |
| MOTN-03 | 59-02/07/10/17/25 | Position (grouped or split), Scale, Rotation, Opacity | ✓ SATISFIED | Add-channel path reachable; all channels carry keys; grouped Position easing/wiggle reaches both axes |
| MOTN-04 | 59-02/10/17/23 | Channels open on demand, one at a time | ✓ SATISFIED | Keyless menu + two-writer session signal; always-rendered authority-gated `+` row; no lane by default |
| MOTN-05 | 59-05/06/15/22 | Rail-local time; survives move/repeat | ✓ SATISFIED | Evaluator + identity + start-move reconciliation + copy ownership tests |
| MOTN-06 | 59-05/15/19 | Repeat semantics observable | ✓ SATISFIED | Span resolver extends infinity to the structural effective end; finite repeats covered |
| MOTN-07 | 59-08/09/15/19 | Compositor transform, one raster, content cycles, no re-bake | ✓ SATISFIED | One-raster/no-re-bake verified; infinities keep the transform while content cycles |
| MOTN-08 | 59-09/16 | Edit view, Play, export agree | ✓ SATISFIED | Single flattened path + parity tests |
| MOTN-09 | 59-05/08 | Rotation unbounded, hold outside keys, time-invariant pivot | ✓ SATISFIED | Evaluator + pivot tests |
| MOTN-10 | 59-05/07/12/20/25 | Ease/Wiggle/Hold on Motion keys only, seeded deterministic; merge drop surfaced | ✓ SATISFIED | Command/evaluator tests; move path publishes the non-undoable notice; lane curve uses the rail seed |
| MOTN-11 | 59-12 | Three independent selection scopes | ✓ SATISFIED | Scope resolver + per-scope command table wired; exclusivity enforced in hosts |
| MOTN-12 | 59-03/07/13/14/20/22 | Save/reopen + one undo step per key op; reveal doors reconcile | ✓ SATISFIED | Persistence/round-trip/history tests; reveal creation reconciles against the clip it appends |
| MUI-01 | 59-11/12 | Coloured chevron / grey minus | ? NEEDS HUMAN | Code present; visual pending live UAT (kept Pending) |
| MUI-02 | 59-10/11 | 18px lanes, header cluster, cells, curves, keys, rim | ? NEEDS HUMAN | Contract tests pin measures; runtime visual pending |
| MUI-03 | 59-10/11 | Rounded outline wraps row + channels, absent collapsed | ? NEEDS HUMAN | Structure present; runtime visual pending |
| MUI-04 | 59-11/12 | One open rail block at a time | ? NEEDS HUMAN | Single-writer signal + tests; live behaviour pending |
| MUI-05 | 59-11/14 | Measured alignment/reorder, 2px post-block gap | ? NEEDS HUMAN | Measured-array tests; live scroll pending |
| MUI-06 | 59-09/12/23 | Previous/next/diamond; disabled with a real reason | ✓ SATISFIED | Availability authority + visible reasons; the `+` row is disabled with the authority's sentence |
| REL-01 | 59-01/16 | No new runtime dependencies | ✓ SATISFIED | Dependency-surface test |
| REL-02 | 59-01/03/13/24 | New `.mce` fields round-trip byte-identically, pinned by a test; cross-language persistence identity | ✓ SATISFIED | Save→reopen round-trip pins green; encoder parity exact at the bit level; `-0` normalized so the JSON transport cannot fork the hash; independent document-path probe produced one hash on both sides |
| REL-03 | 59-03/09 | Motion in canonical revision; no sampled values in cache key | ✓ SATISFIED | Revision tests + cache tests |
| REL-04 | 59-09/16 | Motion-blur export keeps paint (integer content, fractional transform) | ✓ SATISFIED | Export parity tests |

**Orphaned requirements:** none — every ID mapped to Phase 59 in REQUIREMENTS.md appears in at least one plan frontmatter. All 22 IDs (MOTN-01..12, MUI-01..06, REL-01..04) are accounted for, and no plan declares an ID outside the roadmap set.

### Prohibitions Review

All phase plans declare prohibitions; the statements remain `status: unresolved` (judgment-tier, no wired enforcement). This pass found no evidence that any is violated in the shipped paths. The previously honored prohibitions remain in force (one code-unit comparator, one-transaction reveal creation, fail-closed parsing, conditional canonical term, single interpolation, single compositor transform, no direct store setter from the menu, same-track motion, pure injected resolver, `present` from channel existence). The remaining prohibitions have no wired enforcement and must not be treated as resolved; they remain open for the human checkpoint. Plans 59-22..59-25 declare no prohibitions.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts` | 650-709, 859-869, 965-999 | Cross-track loop materialized frames outside `PastedExtent` (59-REVIEW WR-02) | ⚠️ WARNING | A duplicate can accept a colliding anchor or a paste can fail with a generic `apply-failed` reason; the transaction validates before mutating. Advisory: new-scope, no deterministic repro, files unchanged since prior verification |
| `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` / `script_library.rs` | 1591-1603 / 1260-1262, 1580-1589 | ASCII-id assumption unenforced (59-REVIEW WR-01) | ⚠️ WARNING | Foreign/doctored non-ASCII ids would diverge; fail-closed at the hash gate, no silent corruption. Advisory: new-scope, no deterministic repro, files unchanged since prior verification |
| `app/src/components/physic-paint/roto/railMotionCommands.ts` | 464-466 | Impossible-state guard silently skips a missing paired axis (59-REVIEW IN-01) | ℹ️ INFO | A violated D-12 invariant would masquerade as a successful single-axis edit |
| `app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts` | 309, 1104 | `localeCompare` remains in two non-canonical ordering sites (59-REVIEW IN-02) | ℹ️ INFO | Does not change a revision today; same hazard class as the fixed WR-05 |
| `app/src/components/physic-paint/roto/railMotionCommands.ts` | 191-211 | `addMotionChannel` lacks the sibling commands' try/catch around the throwing reducer (IN-04) | ℹ️ INFO | Defensive; duplicate check plus the reducer no-op keep the throw unreachable from valid state |
| `app/src/components/physic-paint/roto/railMotionCommands.ts` / `railMotionIdentity.ts` | 686 / 197 | Dead exports `resolveRecordChannels`, `describeRailMotionOrphan` (IN-05) | ℹ️ INFO | No production consumer |

The previous 🛑 BLOCKER (`-0` accepted and stored, in-memory hash diverging from the IPC-transported document) is **resolved** by `9817da784`: the canonical encoder normalizes the sign of zero, so the in-memory and transmitted documents hash identically. No `TBD`/`FIXME`/`XXX` debt markers exist in the files modified since the prior verification (`efxPaintCanonicalEncoder.ts`, `efxPaintCanonicalEncoder.test.ts`, `railMotionCanonicalParity.test.ts`), and no placeholder/empty-return stubs were found on the phase paths.

### Human Verification Required

The 13 live UAT rows in `59-UAT.md` remain `pending`; their status is `live-uat-pending`. Rows 1-3 also carry the v7 chrome visual check (MUI-02..MUI-05). Automated checks passed for the structural contracts; the two behavior-unverified truths are covered by row 1 and the chrome checks.

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

### Gaps Summary

The `9817da784` fix is real, correctly scoped, and I confirmed it in source and by independent reproduction rather than by the commit message. `encodeCanonicalNumber` now writes `value === 0 ? 0 : value` into the `DataView` before taking the IEEE-754 binary64 bits. Because the Tauri IPC boundary is JSON and `JSON.stringify(-0)` is `'0'`, the Rust prepare gate only ever sees `+0`; normalizing the sign at the one canonical encoder makes the renderer's in-memory hash and the Rust-recomputed hash agree for every value the model accepts. I reproduced the old failure class with a real `rail-motion` document carrying a `-0` rotation key: in-memory and post-`JSON.parse(JSON.stringify(...))` hashes are both `project-477-4f706e1`, and the canonical source contains `n0000000000000000;`, not `n8000000000000000;`. The temporary probe was deleted after the run.

Both added pins are present. `efxPaintCanonicalEncoder.test.ts` (15 tests) includes the `[-0, '0000000000000000']` row, an explicit `-0 === 0` encoding equality row, and a 14-value JSON-transport invariance loop (including `-0`, `1e21`, the former tie double, and `4.1629419827416937e-53`). `railMotionCanonicalParity.test.ts` (14 tests) adds a document-level invariant that every frozen fixture document hashes identically after the transport. On the specific question of whether that document-level pin would have caught this regression: it exercises the document path, but **it would not have caught the `-0` regression on its own**, because none of the seven frozen documents contains a `-0` value — I verified zero numeric transport divergences across all seven with `Object.is`. The value-level `-0` row and the 14-value transport loop are the regression catchers; the document-level pin remains a valid whole-document transport guard. This is a test-coverage nuance, not a contract failure, and it does not block the phase.

The end-to-end settle contract is now complete for every accepted value. The only production Rust call site of `canonical_physical_hash` is the prepare gate (`script_library.rs:1244`), which recomputes from the transmitted document; the renderer hashes the in-memory proposal at `physicsPaintRotoScriptLibrary.ts:220-221`; both now agree. Non-negative-zero finite doubles round-trip exactly through JSON, and `NaN`/`Infinity` are rejected by `isFiniteNumber`, so `-0` was the only fork class. The previous score of 18/21 with one failed truth is now 19/21: the two remaining items are the present-but-behavior-unverified visual truths (chevron rendering and v7 chrome), which belong to human verification, together with the 13 pending live UAT rows.

All other phase truths remain verified by the green focused and full suites (396 files / 7,911 tests, 2 skipped files), the Rust suite (200 tests including parity 3/3 and the 21-test transaction contract) and the clean typecheck. The phase goal is met in the codebase; the remaining work is live human UAT evidence, not an automated gap. One tracking note, non-blocking: `59-REVIEW-DISPOSITION.md` still lists CR-01 as `open` because it was recorded before `9817da784`; the code finding is closed by this fix, and the disposition record is a planning artifact, not a code gap.

---

_Verified: 2026-11-07T12:40:59Z_
_Verifier: Claude (gsd-verifier)_
