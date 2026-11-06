---
phase: 59-rail-motion-channels-v7-interface
verified: 2026-11-06T21:55:09Z
status: gaps_found
score: 17/20 must-haves verified
covered_files: [".planning/phases/59-rail-motion-channels-v7-interface/59-01-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-01-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-02-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-02-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-03-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-03-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-04-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-04-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-05-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-05-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-06-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-06-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-07-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-07-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-08-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-08-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-09-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-09-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-10-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-10-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-11-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-11-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-12-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-12-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-13-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-13-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-14-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-14-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-15-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-15-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-16-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-16-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-17-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-17-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-18-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-18-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-19-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-19-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-20-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-20-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-21-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-21-SUMMARY.md", "app/src-tauri/src/services/script_library.rs", "app/src/components/physic-paint/PhysicsPaintStudio.tsx", "app/src/components/physic-paint/hooks/physicsPaintRotoRailMotionHistory.test.ts", "app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts", "app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts", "app/src/components/physic-paint/hooks/useRotoTimelineActions.ts", "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts", "app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.test.ts", "app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts", "app/src/components/physic-paint/roto/physicsPaintRotoRailSetSelection.ts", "app/src/components/physic-paint/roto/railMotionCommands.test.ts", "app/src/components/physic-paint/roto/railMotionCommands.ts", "app/src/components/physic-paint/roto/railMotionDocumentReconciler.test.ts", "app/src/components/physic-paint/roto/railMotionDocumentReconciler.ts", "app/src/components/physic-paint/roto/railMotionEvaluator.test.ts", "app/src/components/physic-paint/roto/railMotionEvaluator.ts", "app/src/components/physic-paint/roto/railMotionIdentity.test.ts", "app/src/components/physic-paint/roto/railMotionIdentity.ts", "app/src/components/physic-paint/roto/railMotionInkScan.test.ts", "app/src/components/physic-paint/roto/railMotionMergeNotice.test.ts", "app/src/components/physic-paint/roto/railMotionMergeNotice.ts", "app/src/components/physic-paint/roto/railMotionModel.test.ts", "app/src/components/physic-paint/roto/railMotionModel.ts", "app/src/components/physic-paint/roto/railMotionPersistence.test.ts", "app/src/components/physic-paint/roto/railMotionPivot.test.ts", "app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts", "app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx", "app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx.test.ts", "app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx", "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts", "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx", "app/src/components/physic-paint/view/TimelineMotionChannels.test.ts", "app/src/components/physic-paint/view/TimelineMotionChannels.tsx", "app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts", "app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts", "app/src/efx-paint/compositor/efxPaintCompositeCache.ts", "app/src/efx-paint/compositor/efxPaintCompositor.ts", "app/src/efx-paint/compositor/efxPaintCompositorRailMotion.test.ts", "app/src/lib/exportRenderer.ts", "app/src/lib/physicPaintBridge.ts", "app/src/lib/previewRenderer.ts", "app/src/lib/railMotionCanonicalParity.test.ts", "app/src/lib/railMotionDependencySurface.test.ts", "app/src/lib/railMotionExportParity.test.ts", "app/src/lib/railMotionGateBEdits.test.ts", "app/src/lib/railMotionPackageRoundTrip.test.ts", "app/src/stores/efxPaintPersistenceRailMotionRoundTrip.test.ts", "app/src/stores/efxPaintStore.reveal.test.ts", "app/src/stores/efxPaintStore.ts", "app/src/stores/physicPaintStore.rotoRailMotions.test.ts", "app/src/stores/physicPaintStore.ts"]
covered_digest: "v4:sha256:e6fca080fcf2d4030e4e7894b34c9ed348c8f42c7b9e020352257c69dd0937ad"
behavior_unverified: 2
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 13/20
  gaps_closed:
    - "Position (grouped or split X + Y), Scale, Rotation, and Opacity each animate with their own keys — closed by 59-17 (add-channel row, menu, host action, command, reducer)"
    - "Channels open on demand, one at a time; no lane appears by default — closed by 59-17"
    - "Content cycles while motion continues over the rail's full lifecycle — closed by 59-19 (injected span resolver at all three projection sites)"
    - "Rail-set Copy and Duplicate carry the rails' Motion with the rails — closed by 59-18 (copy document carries railMotions into both the parser and the 6-argument revision)"
    - "The move/removal commit returns the merge-drop report and the strip publishes it; reveal delete/resize/bake reconcile motion inside the same transaction — closed by 59-20"
    - "The motion inspector flags absent channels instead of silently refusing edits — closed by 59-21"
  gaps_remaining:
    - "Reveal creation reconciles motion against a loop-clip snapshot that omits the clip appended after the bake, orphaning a neighbouring Key Rail's motion (CR-01 in 59-REVIEW.md)"
  regressions: []
gaps:
  - truth: "Structural edits reconcile Motion at the commit point and a two-sided merge publishes the drop confirmation (plan 59-12/59-15)"
    status: failed
    reason: "commitRevealBake reconciles railMotions against `nextLoopClips`, which is built only from the clips that already exist (it substitutes baked keys into current clips but cannot add the reveal clip that creation is about to append). createRevealRail calls the bake at efxPaintStore.ts:1598, builds the clip from bakeResult.records at 1636-1666, and appends it at 1668. During reconciliation the freshly baked keys are therefore unowned, so deriveKeyRailSegments merges them with a neighbouring Key Rail that continues past the bake span; onMergeRails adopts the record onto a baked key, and when the clip is appended the record matches no view and is orphaned. Deterministic verifier repro (temporary test, removed): Key Rail key-a@10 + key-b@14 with a motion record anchored at key-a; create a reveal over [10,12) -> clip owns [bakedA, bakedB], Key Rail segment [key-b], record { railId: 'rail-moving', anchor: bakedA }, active [], orphaned ['rail-moving']."
    artifacts:
      - path: "app/src/stores/physicPaintStore.ts"
        issue: "commitRevealBake builds nextLoopClips with a map over currentLoopClips only (2460-2471) and reconciles at 2472-2484 before the reveal clip exists"
      - path: "app/src/stores/efxPaintStore.ts"
        issue: "createRevealRail bakes at 1598 then builds (1636-1666) and appends (1668) the loop clip in a later store call; the motion write inside the bake cannot see it"
    missing:
      - "Reconcile the bake against the clip it is about to create: pass a pending-clip template (loopId, placementStart, repeat, mode, railKind and provenance) into commitRevealBake, then append { ...template, sourceKeyIds: bakedRecords.map(r => r.keyId) } to nextLoopClips before reconcileRailMotionsForDocumentEdit; createRevealRail generates the loopId before the bake and appends the same clip"
      - "Add a regression test: Key Rail keys at 10 and 14 with a motion record anchored at the frame-10 key; create a reveal over [10,12); assert the record survives with the same railId, an anchor at the frame-14 key, and a live view binding"
behavior_unverified_items:
  - truth: "A track with motion shows the coloured chevron (right collapsed, down expanded); a track with no motion shows the grey minus (MUI-01, ROADMAP SC2)"
    test: "Expand/collapse a motion-bearing track's chevron and compare with a motion-free row in the running app."
    expected: "Coloured chevron-right collapsed, chevron-down expanded; a grey 14x14 minus with a visible disabled reason when there is no motion."
    why_human: "Colour, size and glyph rendering are visual; the code path is present (resolveMotionChevronKind) but no automated check renders the surface."
  - truth: "The v7 chrome matches its contract: 18px lanes, header cluster with previous/diamond/next, 16x18 cells, 1.5px curves, 6x6 keys with the lighter type rim, rounded outline wrapping row plus expanded channels, one open block at a time, header/lane alignment while scrolling, 2px post-block gap, measured reorder insertion (MUI-02..MUI-05, ROADMAP SC5)"
    test: "Open an expanded motion block in the running app and measure/observe the chrome, the scroll alignment and the reorder indicator."
    expected: "The locked measures and visual contract hold at runtime, including one open block and an indicator that never lands inside a channel block."
    why_human: "Layout, colour and scroll behaviour cannot be certified by grep or a contract test alone; REQUIREMENTS.md keeps MUI-01..MUI-05 Pending for this reason."
human_verification:
  - test: "UAT row 1 - Animate a Standard rail, place a second Position key, expand, drag/type Position."
    expected: "Animate seeds one Position key; coloured chevron then chevron-down; one Position lane with 6x6 keys and a 1.5px curve; rail moves; drawing keys unchanged."
    why_human: "Live rendering and interaction; the automated tests do not render the running Studio."
  - test: "UAT row 2 - Animate a Reveal rail and add a Scale channel key."
    expected: "No conversion; a Scale lane appears from the keyless menu; the reveal paints scaled; no cycle value."
    why_human: "Live gesture. The 59-17 gap closure makes the lane reachable; visual response still needs the running app."
  - test: "UAT row 3 - Animate a bare Key Rail; add Rotation, 0deg then 720deg."
    expected: "No conversion/cycle; Rotation lane shows two keys; 720deg distinct from 0deg; drawing keys untouched."
    why_human: "Live gesture. The Rotation lane is reachable after 59-17."
  - test: "UAT row 4 - Animate a loop rail (repeat >= 2, including infinity); scrub across repeat boundaries."
    expected: "Motion lanes span the rail lifecycle; every occurrence shows the same rhythm; hold after the last key; no re-bake flash."
    why_human: "Live scrubbing. The 59-19 resolver extends the infinite span; runtime feel needs observation."
  - test: "UAT row 5 - Move an animated rail and compare the same rail-local frame."
    expected: "Key frames follow the rail; the evaluated transform is identical at the same rail-local frame; no key dropped/duplicated."
    why_human: "Live drag and visual comparison."
  - test: "UAT row 6 - Copy/paste an animated rail and edit the copy."
    expected: "The pasted rail carries its own motion; edits do not cross; the source keeps all keys."
    why_human: "Live clipboard gesture. Note: WR-06 can still refuse Copy with 'stale-member' for a Key Rail that directly follows a Loop Clip without a break."
  - test: "UAT row 7 - Delete a rail's first drawing key."
    expected: "Motion stays with frames unchanged; one undo restores key and motion together."
    why_human: "Live delete + undo observation."
  - test: "UAT row 8 - Delete the last remaining drawing key."
    expected: "Rail and Motion block disappear; chevron returns to grey minus; one undo restores both."
    why_human: "Live delete + undo observation."
  - test: "UAT row 9 - Merge two rails where both sides carry motion through the strip move."
    expected: "A session-only confirmation row names the dropped tail span and states it cannot be undone; one undo restores rails and tail motion."
    why_human: "Live gesture. The 59-20 move wrapper publishes the drop; the notice presentation is visual."
  - test: "UAT row 10 - Save, close, reopen with motion intact."
    expected: "Every rail keeps frames, values, easing, wiggle and rim colour; blocks start collapsed; no revision-mismatch error."
    why_human: "Full app lifecycle and persistence."
  - test: "UAT row 11 - Undo/redo a motion edit (add key, change value)."
    expected: "One undo step per operation; drawing keys untouched."
    why_human: "Live undo stack behaviour."
  - test: "UAT row 12 - Export with motion blur and inspect consecutive frames."
    expected: "Every exported frame carries paint; smooth sub-frame transform; no double-applied transform or re-baked cycle."
    why_human: "Requires a real export and pixel inspection."
  - test: "UAT row 13 - Studio monitor transform matches Play and Edit view."
    expected: "Position, scale, rotation and opacity agree at the same frame; no jump at playback start; active track is not special."
    why_human: "Live playback comparison."
  - test: "UAT row 14 - Create a Reveal rail over a Key Rail that carries motion and continues past the reveal span."
    expected: "The neighbouring Key Rail keeps its motion lane and evaluated transform after creation; deleting the reveal later does not strand the record."
    why_human: "Live gesture; the deterministic verifier repro already shows this FAILS today (record orphaned). The row becomes the acceptance check after the CR-01 fix."
  - test: "Resolve the 59-04 sort-agreement prohibition: decide whether non-UUID rail ids (mixed case/punctuation) must canonicalize identically across TS and Rust."
    expected: "Either use a byte-order comparator in both languages and add a mixed-id parity fixture, or explicitly narrow the accepted rail-id charset."
    why_human: "The current localeCompare (TS) vs byte order (Rust) divergence is a judgment call about the cross-language contract; the golden fixture only covers lowercase hex UUIDs."
---

# Phase 59: Rail Motion Channels & v7 Interface Verification Report

**Phase Goal:** Every rail — Standard, Motion, Static, Reveal, or a bare Key Rail — can be animated by Motion keys that are independent of its drawing keys, and the transform is applied once at the compositor so edit view, Play, and export show the same frame.
**Verified:** 2026-11-06T21:55:09Z
**Status:** gaps_found
**Re-verification:** Yes — after gap-closure plans 59-17 through 59-21

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A Motion key can be added on any rail kind (Standard, Motion, Static, Reveal, bare Key Rail) with no cycle value, no conversion, and without creating or altering a drawing key (SC1, MOTN-01/MOTN-02) | ✓ VERIFIED | `railMotionCommands.ts` `animateRail` binds Loop Clips by `loopId`, mints one UUID for a bare Key Rail, has no rail-kind gate; command tests cover Reveal/Static parity and deep-equality of drawing keys/loops/breaks |
| 2 | Position (grouped or split X + Y), Scale, Rotation, and Opacity each animate with their own keys (SC2, MOTN-03) | ✓ VERIFIED | 59-17 wires the full path: `PhysicsPaintTrackRow.tsx:593,643-677` (add-channel row) → `PhysicsPaintWorkflowStrip.tsx:6321-6329,6367-6369` (host) → `useRotoTimelineActions.ts:2836-2852` (action) → `railMotionCommands.ts:191-211` → `railMotionModel.ts:683-717` (add-channel reducer). Tests `useRotoTimelineActions.test.ts:4925-5073`, `railMotionCommands.test.ts:1382-1438`. WR-04: grouped Position lane edits `position-x` for easing/wiggle |
| 3 | Channels open on demand, one at a time; no lane appears by default (SC2, MOTN-04) | ✓ VERIFIED | Two-writer module signal `railMotionChannelMenuRailId` (`PhysicsPaintTrackRow.tsx:394-404`), read at `1057-1058`, host at `1354-1362`; the menu is an absolute overlay over the block (`TimelineMotionBlock:649-671`); `PhysicsPaintWorkflowStrip.test.ts:2962` covers the measured add-channel row |
| 4 | A track with motion shows the coloured chevron (right collapsed/down expanded); a track without motion shows the grey minus (SC2, MUI-01) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Logic exists (`resolveMotionChevronKind`, aria-expanded/aria-description, 14x14 button); colour/glyph rendering is visual and MUI-01 stays Pending — see Human Verification |
| 5 | The rail transform is applied once at the compositor; one content raster per track per frame; nothing re-bakes (SC3, MOTN-07) | ✓ VERIFIED | Both draw sites pass `ports.trackTransforms?.get(track.id)` into the shared `drawEfxPaintTrack` (`efxPaintCompositor.ts` 415/451); motion enters only as a conditional revision term (`efxPaintCompositeCache.ts` 181-225); `efxPaintCompositorRailMotion.test.ts` passes |
| 6 | Content cycles while motion continues over the rail's full lifecycle (SC3, MOTN-06/MOTN-07) | ✓ VERIFIED | 59-19 injects `createRailMotionViewSpanResolver` at the store projection (`physicPaintStore.ts:1247`), the track row (`PhysicsPaintTrackRow.tsx:436`) and the hook (`useRotoTimelineActions.ts:2148`); `deriveRailMotionRailViews` takes `Math.max(fallback, resolver end)` for infinity (`railMotionIdentity.ts:233-282`); test `railMotionIdentity.test.ts:356` |
| 7 | Edit view, Play, and export render the identical frame, including on the active track (SC4, MOTN-08) | ✓ VERIFIED | One `getFlattenedFrame` path serves preview (`previewRenderer.ts` 264/320) and export; `railMotionExportParity.test.ts` passes its active-track/trackTransforms cases |
| 8 | Motion-blur export keeps paint on every frame: integer content raster + fractional transform (SC4, REL-04) | ✓ VERIFIED | `exportRenderer.ts` sub-frame loop (478-484) + fractional offset preserved (346/360); store splits content frame vs transform frame; parity test covers fractional delivery and the memo bypass |
| 9 | Motion survives save → close → reopen (SC5, MOTN-12 persistence) | ✓ VERIFIED | `railMotions` in the allowlist, conditional canonical term, byte round-trip tests pass (`railMotionPackageRoundTrip.test.ts`, `railMotionPersistence.test.ts`, `efxPaintPersistenceRailMotionRoundTrip.test.ts`) |
| 10 | Rotation is unbounded and values hold outside the keyed range (SC5, MOTN-09) | ✓ VERIFIED | Evaluator interpolates degrees with no wrap; endpoint hold tested (`railMotionEvaluator.test.ts`; model accepts any finite rotation) |
| 11 | Rail / drawing-key / motion-key scopes work independently, each with its own contextual commands (SC5, MOTN-11) | ✓ VERIFIED | `resolveSelectionScope` + `CONTEXTUAL_COMMANDS_BY_SCOPE` drive the strip; exclusivity enforced in the production hosts (motion select clears drawing keys; drawing-key selection clears motion) |
| 12 | Ease, Wiggle, and Hold attach only to Motion keys; Wiggle is seeded and deterministic at export (SC5, MOTN-10) | ✓ VERIFIED | Command layer accepts easing/wiggle only on motion keys; evaluator seeds FNV-1a per rail/channel/frame with a deterministic `Random`; tests pin determinism and range. WR-03 affects only the lane preview curve seed, not the applied transform |
| 13 | Every key operation is one undo/redo step (SC5, MOTN-12) | ✓ VERIFIED | History snapshot includes `railMotions`; `snapshotRecordsEqual`/`snapshotCanonicalContentEqual` compare it; `snapshotRevision` passes the 6th argument; `physicsPaintRotoRailMotionHistory.test.ts` passes |
| 14 | The v7 chrome matches its contract: 18px lanes, header cluster, 16x18 cells, 1.5px curves, 6x6 keys with lighter type rim, rounded outline wrapping row+channels, one open block, aligned header while scrolling, 2px post-block gap, measured reorder insertion (SC5, MUI-02..MUI-05) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Measures and structure are pinned by `timelineMotionSurface.contract.test.ts` and `PhysicsPaintWorkflowStrip.test.ts`; runtime visual/layout behaviour needs the live UAT (MUI-02..MUI-05 stay Pending) |
| 15 | Motion lives in rail-local time; keys survive moving or repeating the rail (SC5, MOTN-05) | ✓ VERIFIED | `resolveRailLocalFrame` subtracts the rail start and clamps; identity returns the same record reference when the start moves; start-move reconciliation tests pass |
| 16 | Rail-set Copy and Duplicate carry the rails' Motion with the rails (plan 59-14, UAT row 6) | ✓ VERIFIED | 59-18 reads the active track's collection (`useRotoTimelineActions.ts:4990`), hashes it with the 6-argument revision (`5001`), and wires the Studio port (`PhysicsPaintStudio.tsx:3171`); tests `useRotoTimelineActions.test.ts:4692-4827`, `physicsPaintRotoRailSetCopy.test.ts:914-935`. WR-06 can still refuse Copy with 'stale-member' for a Key Rail directly following a Loop Clip without a break |
| 17 | Structural edits reconcile Motion in the same commit and a two-sided merge publishes the drop confirmation (plan 59-12/59-15) | ✗ FAILED | The move/removal report and reveal delete/resize/bake are closed (59-20), but reveal CREATION reconciles against a snapshot that omits the clip appended after the bake, silently orphaning a neighbouring Key Rail's motion. Deterministic repro: record `{ railId: 'rail-moving', anchor: key-a }`, keys `key-a@10`/`key-b@14`, reveal over [10,12) → clip owns baked keys, Key Rail segment `[key-b]`, active `[]`, orphaned `['rail-moving']` |
| 18 | TS and Rust canonical encoders agree for every rail kind (plan 59-01; REL-02 cross-language) | ✓ VERIFIED | 23 Rust tests green including `canonical_rail_motions_*` and `rail_motion_canonical_parity*`; TS parity suite passes against the golden fixture. WR-05: the fixture covers only lowercase hex UUIDs; `localeCompare` vs Rust byte order diverges for mixed-case/punctuation ids (flagged prohibition) |
| 19 | Motion joins the canonical document revision; sampled values never enter the flattened cache key (REL-03) | ✓ VERIFIED | Conditional `rail-motions:` term after `loops:`, one structural revision authority, `_trackMotionRevision` null when motion-free; cache tests pin the motion-only key rotation and the absence of sampled values |
| 20 | No new runtime dependencies (REL-01) | ✓ VERIFIED | `railMotionDependencySurface.test.ts` passes (bare-import scan, frozen dependency list, non-vacuous check) |

**Score:** 17/20 truths verified (2 present, behavior-unverified)

### Deferred Items

None. Phase 60 (Studio timeline horizontal zoom), Phase 61 (vector painting tool) and Phase 62 (painted-stroke curve editing) do not cover the reveal-creation reconciliation, so the remaining gap is not deferred.

### Advisory (New Scope, Unevidenced)

None. The one blocker is a carried-forward gap family (structural-edit reconciliation) and carries a deterministic failing repro; no unevidenced new-scope finding was promoted.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/src/components/physic-paint/roto/railMotionModel.ts` | Types, parser, pure reducer | ✓ VERIFIED | Fail-closed caps; `add-channel` branch now dispatched by the production command |
| `app/src/components/physic-paint/roto/railMotionEvaluator.ts` | Single interpolation authority, curve path | ✓ VERIFIED | Endpoint hold, smoothstep, unbounded rotation, seeded wiggle; curve path can omit `railId` (WR-03) |
| `app/src/components/physic-paint/roto/railMotionCommands.ts` | Availability + command layer | ✓ VERIFIED | `addMotionChannel` present and wired; no `try/catch` guard (IN-01) and the availability branch is dead (WR-01) |
| `app/src/components/physic-paint/roto/railMotionIdentity.ts` | Durable identity + reconciliation | ✓ VERIFIED | Loop Clip binds by loopId, UUID mint, orphan retention; span resolver injected; module stays pure |
| `app/src/components/physic-paint/roto/railMotionDocumentReconciler.ts` | Commit-point reconciler | ✓ VERIFIED | Wired at the bridge, coordinator, removal helper and reveal delete/resize/bake; the reveal-create caller supplies an incomplete next snapshot (CR-01) |
| `app/src/components/physic-paint/roto/railMotionMergeNotice.ts` | Session notice + copy | ✓ VERIFIED | Signals, publish/dismiss, undoable companion; no store import, no persistence |
| `app/src/components/physic-paint/view/TimelineMotionChannels.tsx` | v7 lanes/keys/curve/menu | ✓ VERIFIED | Menu is now reachable; add-channel row and absolute overlay verified |
| `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` | Chevron, outline, block layout | ✓ VERIFIED | Add-channel row/menu wired; grouped lane addresses `channels[0]` (WR-04) |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` | Active-lane host, measured layout, actions | ✓ VERIFIED | Add-channel and move-wrapper publish wired at the active and non-active hosts |
| `app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts` | Inspector projection | ✓ VERIFIED | `present` derives from channel existence (176/241); 59-21 disabled/aria/note wiring verified |
| `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx` | Motion inspector controls | ✓ VERIFIED | Absent channels are disabled with a visible note and a guarded no-op |
| `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` | Motion actions + copy/duplicate | ✓ VERIFIED | `addMotionChannel` action and copy document railMotions both wired |
| `app/src/stores/physicPaintStore.ts` | Projection, transform resolution, revisions | ✓ VERIFIED | Transform/view/revision paths present; removal report returned; `commitRevealBake` next snapshot lacks the pending reveal clip (CR-01) |
| `app/src/stores/efxPaintStore.ts` | Reveal rail lifecycle | ✓ VERIFIED | Delete/resize reconcile before writing; creation appends the clip after the bake (CR-01) |
| `app/src/efx-paint/compositor/efxPaintCompositor.ts` | One transform application | ✓ VERIFIED | Both draw sites delegate to the shared `drawEfxPaintTrack` |
| `app/src/efx-paint/compositor/efxPaintCompositeCache.ts` | Motion revision in cache key | ✓ VERIFIED | Conditional participating-track term, no sampled values |
| `app/src/lib/exportRenderer.ts`, `app/src/lib/previewRenderer.ts` | Sub-frame export parity | ✓ VERIFIED | Integer content + fractional transform flow |
| `app/src-tauri/src/services/script_library.rs` | Rust canonical/guard parity | ✓ VERIFIED | 23 tests green; byte-order sort (WR-05 divergence with TS) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Animate action | `animateRail` -> store -> bridge -> Rust | command commit path | ✓ WIRED | `commitRailMotionRecords` -> `replaceRotoPhysicalRailMotions`; bridge forwards/reconciles |
| Motion key write/easing/wiggle | store collection | `writeMotionTransformAtCursor` / write value | ✓ WIRED | All refuse absent channels; 59-21 makes the refusal visible |
| Add-channel row + menu | store collection | row -> `onAddMotionChannel` -> `addMotionChannel` -> reducer -> single motion commit | ✓ WIRED | Closed by 59-17; host wiring at `PhysicsPaintWorkflowStrip.tsx:6321-6329,6367-6369` |
| Copy/Duplicate command | motion payload | `buildRailSetCopyDocument` | ✓ WIRED | Rail motion read from the same active track and hashed with the 6-argument revision |
| Store removal reconciliation | merge-drop notice | `mergedDrop` -> strip publish | ✓ WIRED | `moveTrackItems` result is read at `PhysicsPaintWorkflowStrip.tsx:3921-3939`; `cutTrackSelection`/`clearTrackFrames` have no production callers (WR-02) |
| Reveal creation | motion reconciler | `commitRevealBake` next snapshot -> `createRevealRail` clip append | ✗ NOT_WIRED | The clip is appended after the reconciliation; baked keys are unowned during the merge classification (CR-01) |
| `trackTransforms` | compositor draw | `drawEfxPaintTrack` | ✓ WIRED | Both draw sites pass the per-track transform |
| Export fractional frame | `getFlattenedFrame` | sub-frame loop | ✓ WIRED | Parity test covers the law |
| TS canonical revision | Rust canonical revision | `rail-motions:` term | ✓ WIRED | Golden fixture + 23 Rust tests; ordering caveat WR-05 |
| Inspector fields | channel value write | `projectRailMotionInspector` -> NumericStepper | ✓ WIRED | Absent channels disabled with a visible reason (59-21) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| Compositor draw | `trackTransforms` | store projection -> evaluator -> railMotions | Yes | ✓ FLOWING |
| Preview/export renderer | `physicPaintFrame` | store `getFlattenedFrame` -> same evaluator | Yes | ✓ FLOWING |
| Motion lane curves | channel keys | record channels (all five now reachable) | Yes | ✓ FLOWING |
| Rail-set copy payload | `railMotions` | `buildRailSetCopyDocument` -> parser input + revision | Yes | ✓ FLOWING |
| Merge-drop notice (move path) | `mergedDrop` | reconciler report -> strip publish | Yes | ✓ FLOWING |
| Merge-drop notice (cut/clear) | `mergedDrop` | reconciler report | Computed but no production consumer | ⚠️ ORPHANED |
| Infinite-clip transform | `endFrameExclusive` | `createRailMotionViewSpanResolver` | Yes | ✓ FLOWING |
| Reveal-creation motion ownership | `anchorKeyId` / views | reconciler next snapshot -> clip append | Record is orphaned after creation | ✗ DISCONNECTED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase motion model/evaluator/commands/identity/reconciler/merge-notice/persistence/lane/export/canonical/copy surfaces | `pnpm exec vitest run` on 15 phase suites | 15 files, 829 tests passed, 0 failed | ✓ PASS |
| Track row chrome/add-channel/menu surface | `pnpm exec vitest run src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx.test.ts` | 1 file, 44 tests passed | ✓ PASS |
| CR-01 reveal-creation orphaning | Temporary `src/stores/zz-verifier-cr01.test.ts` (removed after the run) | Failed as designed: `active []`, `orphaned ['rail-moving']`; clip owns baked keys; Key Rail segment `[key-b]` | ✗ FAIL (confirms the blocker) |
| Full project gates | `pnpm run build`; `vitest run` | Reportedly green (7871 tests / 395 files); not independently re-run in this pass | ? SKIP (orchestrator-reported) |

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
| `useRotoTimelineActions.test.ts` | 59-17/59-18, MUI-06, MOTN-11 | active | 0 | no | behavioral | PASS |
| `efxPaintStore.reveal.test.ts` | MOTN-12 | active | 0 | no | behavioral | PASS (no reveal-creation-with-neighbour case — the CR-01 coverage gap) |
| `PhysicsPaintTrackRow.test.tsx.test.ts` | MUI-01..05 | active | 0 | no | structural | PRESENT_BEHAVIOR_UNVERIFIED (visual) |
| `PhysicsPaintWorkflowStrip.test.ts` | MUI-02..05, MOTN-10 | active | 0 | no | value/structural | PASS |
| `TimelineMotionChannels.test.ts` | MUI-02..04, MOTN-03/04 | active | 0 | no | value | PASS |
| `physicsPaintKeyRailPresentation.test.ts` | MUI-06, 59-21 | active | 0 | no | value | PASS |
| `PhysicsPaintScriptsPanel.test.ts` | 59-21 | active | 0 | no | behavioral | PASS |
| `railMotionMergeNotice.test.ts` | MOTN-10 | active | 0 | no | value | PASS |
| `physicPaintStore.rotoRailMotions.test.ts` | MOTN-10/12 | active | 0 | no | behavioral | PASS |

**Disabled tests on requirements:** 0 (only `.pending` signal names matched, no skipped assertions).
**Circular patterns detected:** 0.
**Insufficient assertions:** 0 on covered truths; the missing reveal-creation neighbour test is a coverage gap recorded under the CR-01 gap, not a weak assertion.

### Decision Coverage

All trackable CONTEXT.md decisions are honored by shipped artifacts (19/19; `not_honored: []`).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MOTN-01 | 59-06/07/08/12 | Add/edit/remove Motion keys on any rail | ✓ SATISFIED | Command tests + wiring; every rail kind binds |
| MOTN-02 | 59-06/07/15 | Motion keys independent of drawing keys | ✓ SATISFIED | Deep-equality command tests; delete re-anchor test. The CR-01 orphaning is a reveal-creation transaction defect tracked under the failed structural-reconciliation truth |
| MOTN-03 | 59-02/07/10/17 | Position (grouped or split), Scale, Rotation, Opacity | ✓ SATISFIED | Add-channel path reachable end to end (59-17); all channels carry keys; WR-04 limits per-axis easing/wiggle on the grouped lane |
| MOTN-04 | 59-02/10/17 | Channels open on demand, one at a time | ✓ SATISFIED | Keyless menu + two-writer session signal; no lane by default |
| MOTN-05 | 59-05/06/15 | Rail-local time; survives move/repeat | ✓ SATISFIED | Evaluator + identity + start-move reconciliation tests |
| MOTN-06 | 59-05/15/19 | Repeat semantics observable | ✓ SATISFIED | Span resolver extends infinity to the structural effective end; finite repeats covered |
| MOTN-07 | 59-08/09/15/19 | Compositor transform, one raster, content cycles, no re-bake | ✓ SATISFIED | One-raster/no-re-bake verified; infinities now keep the transform while content cycles |
| MOTN-08 | 59-09/16 | Edit view, Play, export agree | ✓ SATISFIED | Single flattened path + parity tests |
| MOTN-09 | 59-05/08 | Rotation unbounded, hold outside keys, time-invariant pivot | ✓ SATISFIED | Evaluator + pivot tests |
| MOTN-10 | 59-05/07/12/20 | Ease/Wiggle/Hold on Motion keys only, seeded deterministic; merge drop surfaced | ✓ SATISFIED | Command/evaluator tests; the move path publishes the non-undoable notice (59-20); WR-03 is a preview-seed mismatch |
| MOTN-11 | 59-12 | Three independent selection scopes | ✓ SATISFIED | Scope resolver + per-scope command table wired; exclusivity enforced in hosts |
| MOTN-12 | 59-03/07/13/14/20 | Save/reopen + one undo step per key op; reveal doors reconcile | ✓ SATISFIED | Persistence/round-trip/history tests; reveal delete/resize/bake reconcile. Creation is tracked by the failed structural-reconciliation truth |
| MUI-01 | 59-11/12 | Coloured chevron / grey minus | ? NEEDS HUMAN | Code present; visual pending live UAT (kept Pending) |
| MUI-02 | 59-10/11 | 18px lanes, header cluster, cells, curves, keys, rim | ? NEEDS HUMAN | Contract tests pin measures; runtime visual pending |
| MUI-03 | 59-10/11 | Rounded outline wraps row + channels, absent collapsed | ? NEEDS HUMAN | Structure present; runtime visual pending |
| MUI-04 | 59-11/12 | One open rail block at a time | ? NEEDS HUMAN | Single-writer signal + tests; live behaviour pending |
| MUI-05 | 59-11/14 | Measured alignment/reorder, 2px post-block gap | ? NEEDS HUMAN | Measured-array tests; live scroll pending |
| MUI-06 | 59-09/12/21 | Previous/next/diamond; disabled with a real reason | ✓ SATISFIED | Availability authority + visible reasons; absent-channel inspector rows disabled with a note |
| REL-01 | 59-01/16 | No new runtime dependencies | ✓ SATISFIED | Dependency-surface test |
| REL-02 | 59-01/03/13 | New `.mce` fields round-trip byte-identically | ✓ SATISFIED | TS round trips + 23 Rust tests; ordering caveat WR-05 |
| REL-03 | 59-03/09 | Motion in canonical revision; no sampled values in cache key | ✓ SATISFIED | Revision tests + cache tests |
| REL-04 | 59-09/16 | Motion-blur export keeps paint (integer content, fractional transform) | ✓ SATISFIED | Export parity tests |

**Orphaned requirements:** none — every ID mapped to Phase 59 in REQUIREMENTS.md appears in at least one plan frontmatter.

### Prohibitions Review

All 21 plans declare 69 prohibitions; every one is `status: unresolved` with `verification: null` (judgment-tier, no wired enforcement). Material checks on this pass:

- **Honored:** 59-02 fail-closed parser; 59-03 conditional canonical term and no sampled cache values; 59-04 Rust fail-closed guard; 59-05 single interpolation and no wall-clock wiggle; 59-08 single compositor transform; 59-10 no separate Position-X/Y rows (the grouped lane is the intended shape); 59-11 expansion single-writer; 59-12 no drawing-key mutation from motion commands and no notice persistence; 59-17 no React state hook and no direct store setter from the menu; 59-18 same-track motion; 59-19 pure injected resolver; 59-20 no store→notice import, no restore promise on the non-undoable path, no fourth notice member; 59-21 `present` from channel existence and the absent-field guard.
- **Flagged — 59-04 sort agreement:** "MUST NOT sort records differently between languages … without a fixture that proves agreement" is not honored. TS uses `localeCompare` (`physicsPaintRotoPhysicalModel.ts:1722,1742`) while Rust uses byte order (`script_library.rs:1596-1601`); the golden fixture only covers lowercase hex UUIDs. This is WR-05 and is routed to the human checkpoint.
- **Flagged — 59-06/59-15 transaction and silent-drop intent:** reveal creation writes the reconciled motion inside the bake and appends the clip in a later store call, and the neighbour's motion is silenced with no notice. The record is retained as orphaned rather than dropped, but the intent of the one-transaction and no-silent-drop prohibitions is not met on this path. Tracked by the failed truth and CR-01.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `physicPaintStore.ts` / `efxPaintStore.ts` | 2460-2484 / 1598-1668 | Reveal creation reconciles motion before the reveal clip exists, then appends the clip | 🛑 BLOCKER | A neighbouring Key Rail's authored motion is silently orphaned (CR-01); confirmed by a deterministic repro |
| `railMotionCommands.ts` | 472-544 | `add-motion-channel` availability branch + `hasKeylessChannel` input have no production caller | ⚠️ WARNING | Dead API surface; the row gates itself (WR-01) |
| `physicPaintStore.ts` | 3265-3274, 5846-5854, 5935-5940 | `mergedDrop` on `cutTrackSelection`/`clearTrackFrames` has no production consumer | ⚠️ WARNING | A merge drop through these methods would still be silent; moveTrackItems is wired (WR-02) |
| `TimelineMotionChannels.tsx` | 356 | `buildRailMotionCurvePath(channel, frameCount, laneHeight)` omits `railId` | ⚠️ WARNING | Preview wiggle seed differs from the applied transform (WR-03) |
| `PhysicsPaintTrackRow.tsx` | 608 | Grouped Position lane forwards `channels[0]` (always `position-x`) | ⚠️ WARNING | `position-y` easing/wiggle is unreachable from the grouped lane (WR-04) |
| `physicsPaintRotoPhysicalModel.ts` / `script_library.rs` | 1722/1742 / 1596-1601 | `localeCompare` vs byte-order sort | ⚠️ WARNING | Canonical ordering diverges for non-UUID ids; fixture does not prove agreement (WR-05) |
| `physicsPaintRotoRailSetCopy.ts` | 376-380 | `groupOwnedKeyIds: new Set()` in copy segment derivation | ⚠️ WARNING | Copy can fail closed with `'stale-member'` for a Key Rail directly following a Loop Clip without a break (WR-06) |
| `railMotionCommands.ts` | 191-211 | `addMotionChannel` calls the reducer without the sibling commands' `try/catch` | ℹ️ INFO | A reducer throw would escape the menu handler; channel ids are typed today (IN-01) |
| `useRotoTimelineActions.ts` | 2154-2157, 2796, 2818 | Motion key set/remove bypass `railMotionCursorFrame`'s clamp | ℹ️ INFO | Latent; UI disables the diamond outside the lane (IN-02) |
| `railMotionIdentity.ts` / `railMotionCommands.ts` | 197 / 633 | `describeRailMotionOrphan` and `resolveRecordChannels` have no production consumer | ℹ️ INFO | Dead exports (IN-03) |

No `TBD`/`FIXME`/`XXX` debt markers in implementation files (the only `XXX` hit is a test data string), and no placeholder/empty-return stubs were found on the phase paths.

### Human Verification Required

The 13 live UAT rows from plan 59-14 remain pending, plus the reveal-creation acceptance row and the 59-04 ordering decision. They are listed in the frontmatter `human_verification` section. Rows 1-3 additionally carry the v7 chrome visual check (MUI-02..MUI-05). Unlike the previous pass, rows 2, 3, 4, 6 and 9 are no longer structurally blocked: the add-channel lane, infinite span, copy motion and move-drop notice are wired in the current tree.

### Gaps Summary

The gap-closure round closed four of the five prior gaps in source and in tests: the add-channel path is reachable end to end (59-17), the copy document carries and hashes railMotions (59-18), the infinite Loop Clip view extends through the injected span resolver (59-19), the move/removal path returns and publishes the merge drop while every reveal delete/resize/bake reconciles motion inside its transaction (59-20), and the inspector now flags absent channels instead of silently refusing (59-21). The focused phase suites are green (15 files, 829 tests; the row launcher adds 44).

The phase goal is still not achieved because of one confirmed goal-level defect: **reveal creation orphans a neighbouring Key Rail's motion (CR-01)**. The bake reconciles rail motion against a loop-clip snapshot built from the clips that already exist; the reveal clip is constructed from the baked records and appended only afterwards. The freshly baked keys are therefore unowned during reconciliation, the neighbouring Key Rail segment is classified as a merge, its record is re-anchored onto a baked key, and the appended clip immediately makes that key group-owned — leaving the record matched by no view. The deterministic repro shows `active []` and `orphaned ['rail-moving']`: the Motion lanes disappear, the authored transform stops applying, and a later reveal delete cannot revive the record. This is the same structural-edit reconciliation must-have the previous pass flagged; the 59-20 fixes closed the delete/resize/replay and move-drop halves but not creation.

The two behavior-unverified truths (chevron rendering, v7 chrome measures) are not blockers by themselves; they remain routed to live UAT and must not be flipped to Complete without it. WR-03..WR-06 and IN-01..IN-03 are carried as warnings/info; WR-05 also leaves the 59-04 sort-agreement prohibition unresolved.

---

_Verified: 2026-11-06T21:55:09Z_
_Verifier: Claude (gsd-verifier)_
