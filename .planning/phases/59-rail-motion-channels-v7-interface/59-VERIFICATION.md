---
phase: 59-rail-motion-channels-v7-interface
verified: 2026-11-06T19:11:38Z
status: gaps_found
score: 13/20 must-haves verified
covered_files: [".planning/phases/59-rail-motion-channels-v7-interface/59-01-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-01-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-02-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-02-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-03-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-03-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-04-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-04-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-05-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-05-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-06-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-06-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-07-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-07-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-08-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-08-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-09-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-09-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-10-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-10-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-11-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-11-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-12-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-12-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-13-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-13-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-14-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-14-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-15-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-15-SUMMARY.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-16-PLAN.md", ".planning/phases/59-rail-motion-channels-v7-interface/59-16-SUMMARY.md", "app/src-tauri/src/services/script_library.rs", "app/src/components/physic-paint/PhysicsPaintStudio.tsx", "app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts", "app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts", "app/src/components/physic-paint/hooks/useRotoTimelineActions.ts", "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts", "app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts", "app/src/components/physic-paint/roto/physicsPaintRotoRailSetSelection.ts", "app/src/components/physic-paint/roto/railMotionCommands.ts", "app/src/components/physic-paint/roto/railMotionDocumentReconciler.ts", "app/src/components/physic-paint/roto/railMotionEvaluator.ts", "app/src/components/physic-paint/roto/railMotionIdentity.ts", "app/src/components/physic-paint/roto/railMotionModel.ts", "app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx", "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx", "app/src/components/physic-paint/view/TimelineMotionChannels.tsx", "app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts", "app/src/efx-paint/compositor/efxPaintCompositeCache.ts", "app/src/efx-paint/compositor/efxPaintCompositor.ts", "app/src/lib/exportRenderer.ts", "app/src/lib/physicPaintBridge.ts", "app/src/lib/previewRenderer.ts", "app/src/stores/physicPaintStore.ts"]
covered_digest: "v4:sha256:23b3a44422ee2ed58d4de94add9d0feaa24ce988d73e0e850959c7ab438203bc"
behavior_unverified: 2
overrides_applied: 0
gaps:
  - truth: "Position (grouped or split X + Y), Scale, Rotation, and Opacity each animate with their own keys (ROADMAP SC2, MOTN-03)"
    status: failed
    reason: "No production code dispatches the `add-channel` reducer edit. `applyAnimateEdit` seeds only position-x/position-y; every value/key/easing/wiggle write path refuses a channel the record does not already carry. The `+` add-channel menu is gated by `motionChannelMenuOpen`/`onAddMotionChannel`, which no production host supplies (they default to false/undefined), so Scale, Rotation and Opacity can never acquire a key."
    artifacts:
      - path: "app/src/components/physic-paint/roto/railMotionModel.ts"
        issue: "applyAnimateEdit (line 559) seeds only `position-x` and `position-y`"
      - path: "app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx"
        issue: "motionChannelMenuOpen defaults false (line 928) and is only forwarded from props (line 1282); no host passes it"
      - path: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx"
        issue: "the active-lane TimelineMotionBlock host (lines 6240-6275) omits motionChannelMenuOpen/onAddMotionChannel; no `add-channel` dispatch exists anywhere in app/src"
    missing:
      - "A production host writer for motionChannelMenuOpen plus an add-channel command that dispatches the reducer's `add-channel` edit"
      - "Availability + failure publication for the new command (MUI-06's 'never a silent no-op' contract)"

  - truth: "Channels open on demand, one at a time; no lane appears by default (ROADMAP SC2, MOTN-04)"
    status: failed
    reason: "Same root cause as the channel-set gap. The keyless add-channel menu is unreachable, so no user can open Scale/Rotation/Opacity. Lanes can only render channels a record already carries, and a record can only ever carry Position."
    artifacts:
      - path: "app/src/components/physic-paint/view/TimelineMotionChannels.tsx"
        issue: "TimelineMotionChannelMenu exists (line 510) but is rendered only when channelMenuOpen is true (PhysicsPaintTrackRow.tsx line 597), which never happens in production"
      - path: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx"
        issue: "active-lane host does not wire the menu props"
    missing:
      - "Same fix as the channel-set gap: a reachable add-channel affordance wired to the reducer"

  - truth: "Content cycles while motion continues; the rail transform spans the rail's full lifecycle, not one occurrence (ROADMAP SC3, MOTN-06/MOTN-07)"
    status: failed
    reason: "`deriveRailMotionRailViews` treats an `infinity` Loop Clip as a single visible occurrence (`railViewOccurrences` returns 1), so `endFrameExclusive = placementStart + sourceKeyIds.length`. `_railMotionViewAtFrame` is half-open and `_trackMotionTransformAtFrame` returns null outside the view. The resolver extends the content to capacity/parent end, so after the first cycle the content keeps looping while the transform disappears."
    artifacts:
      - path: "app/src/components/physic-paint/roto/railMotionIdentity.ts"
        issue: "railViewOccurrences returns 1 for 'infinity' (line 168); endFrameExclusive uses it (line 209)"
      - path: "app/src/stores/physicPaintStore.ts"
        issue: "_railMotionViewAtFrame gates on [startFrame, endFrameExclusive) (lines 1268-1279); _trackMotionTransformAtFrame returns null when no view covers the frame (lines 1327-1340)"
    missing:
      - "Extend an infinite clip's motion view to its real resolved duration (capacity/parent end) before evaluating the transform"
      - "A deterministic test that an infinite clip's transform survives past the first occurrence"

  - truth: "Rail-set Copy and Duplicate carry the rails' Motion with the rails (MOTN-01/MOTN-05; plan 59-14; UAT row 6)"
    status: failed
    reason: "`buildRailSetCopyDocument` builds the copy source document without `railMotions` and hashes a 4-argument revision, so the parsed document carries the frozen empty collection. `copyRailSet`/`duplicateRailSet` are the production Copy/Duplicate commands (PhysicsPaintStudio.tsx lines 3943/3951). Copy, Cut/Paste and Duplicate therefore drop motion."
    artifacts:
      - path: "app/src/components/physic-paint/hooks/useRotoTimelineActions.ts"
        issue: "buildRailSetCopyDocument (lines 4926-4955) omits railMotions and calls buildPhysicPaintRotoPhysicalRevision with 4 arguments"
    missing:
      - "Read the track's railMotions, include them in the physical document, and hash them with the 6-argument revision"
      - "A test asserting the copy payload's railMotions is non-empty and re-keyed"

  - truth: "Structural edits reconcile Motion at the commit point and a two-sided merge publishes the drop confirmation (plan 59-12/59-15 merge notice)"
    status: failed
    reason: "The store's selection-removal path computes the reconciliation then keeps only `.railMotions`; `droppedRailId`/`droppedRailFrames` are discarded, so the merge-drop notice can never fire on this path. `moveTrackItems` and cut reach it (PhysicsPaintWorkflowStrip.tsx line 3885 -> store lines 5863/5945). In addition `replaceRotoPhysicalLoopClips`/`replaceRotoPhysicalRecords` are public structural doors that never reconcile motion (WR-04)."
    artifacts:
      - path: "app/src/stores/physicPaintStore.ts"
        issue: "_applyRotoTrackSelectionRemoval (lines 6055-6068) destructures only `.railMotions` and drops the reconciliation report"
      - path: "app/src/stores/physicPaintStore.ts"
        issue: "replaceRotoPhysicalLoopClips (lines 5156-5206) writes loop clips without reconciling railMotions"
    missing:
      - "Publish droppedRailId/droppedRailFrames from every commit path that can merge rails"
      - "Funnel the direct loop-clip/records doors through the reconciler or remove them"

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
  - test: "UAT row 2 - Animate a Reveal rail and set a Scale key twice."
    expected: "No conversion; a Scale lane appears; the reveal paints scaled; no cycle value."
    why_human: "Live gesture; NOTE: CR-03 makes the Scale lane unreachable, so this row is expected to FAIL until the add-channel gap is fixed."
  - test: "UAT row 3 - Animate a bare Key Rail; Rotation 0deg then 720deg."
    expected: "No conversion/cycle; Rotation lane shows two keys; 720deg distinct from 0deg; drawing keys untouched."
    why_human: "Live gesture; the Rotation lane is unreachable under CR-03 today."
  - test: "UAT row 4 - Animate a loop rail (repeat >= 2); scrub across repeat boundaries."
    expected: "Motion lanes span the rail lifecycle; every occurrence shows the same rhythm; hold after the last key; no re-bake flash."
    why_human: "Live scrubbing; NOTE: CR-04 makes an infinite clip's transform disappear after the first occurrence."
  - test: "UAT row 5 - Move an animated rail and compare the same rail-local frame."
    expected: "Key frames follow the rail; the evaluated transform is identical at the same rail-local frame; no key dropped/duplicated."
    why_human: "Live drag and visual comparison."
  - test: "UAT row 6 - Copy/paste an animated rail and edit the copy."
    expected: "The pasted rail carries its own motion; edits do not cross; the source keeps all keys."
    why_human: "Live clipboard gesture; NOTE: CR-01 makes the pasted copy motion-free."
  - test: "UAT row 7 - Delete a rail's first drawing key."
    expected: "Motion stays with frames unchanged; one undo restores key and motion together."
    why_human: "Live delete + undo observation."
  - test: "UAT row 8 - Delete the last remaining drawing key."
    expected: "Rail and Motion block disappear; chevron returns to grey minus; one undo restores both."
    why_human: "Live delete + undo observation."
  - test: "UAT row 9 - Merge two rails where both sides carry motion."
    expected: "A session-only confirmation row names the dropped tail span; one undo restores rails, tail motion and dismisses the notice."
    why_human: "Live gesture; NOTE: CR-02 drops the merge report on the store removal path, so the notice may not appear."
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
---

# Phase 59: Rail Motion Channels & v7 Interface Verification Report

**Phase Goal:** Every rail — Standard, Motion, Static, Reveal, or a bare Key Rail — can be animated by Motion keys that are independent of its drawing keys, and the transform is applied once at the compositor so edit view, Play, and export show the same frame.
**Verified:** 2026-11-06T19:11:38Z
**Status:** gaps_found
**Re-verification:** No — initial verification (no prior VERIFICATION.md exists)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A Motion key can be added on any rail kind (Standard, Motion, Static, Reveal, bare Key Rail) with no cycle value, no conversion, and without creating or altering a drawing key (SC1, MOTN-01/MOTN-02) | ✓ VERIFIED | `railMotionCommands.ts` `animateRail` binds Loop Clips by `loopId`, mints one UUID for a bare Key Rail, has no rail-kind gate; the command tests cover Reveal/Static parity and deep-equality of drawing keys/loops/breaks (`railMotionCommands.test.ts`, 67 pass) |
| 2 | Position (grouped or split X+Y), Scale, Rotation, and Opacity each animate with their own keys (SC2, MOTN-03) | ✗ FAILED | CR-03: `applyAnimateEdit` seeds only `position-x`/`position-y`; no production `add-channel` dispatch; every write path refuses an absent channel. Scale/Rotation/Opacity can never carry keys |
| 3 | Channels open on demand, one at a time; no lane appears by default (SC2, MOTN-04) | ✗ FAILED | CR-03: `motionChannelMenuOpen` defaults false and no host wires it; `onAddMotionChannel` is never supplied; `TimelineMotionChannelMenu` is unreachable |
| 4 | A track with motion shows the coloured chevron (right collapsed/down expanded); a track without motion shows the grey minus (SC2, MUI-01) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Logic exists (`resolveMotionChevronKind`, aria-expanded/aria-description, 14x14 button); colour/glyph rendering is visual and MUI-01 stays Pending — see Human Verification |
| 5 | The rail transform is applied once at the compositor; one content raster per track per frame; nothing re-bakes (SC3, MOTN-07) | ✓ VERIFIED | Both draw sites pass `ports.trackTransforms?.get(track.id)` into the shared `drawEfxPaintTrack` (`efxPaintCompositor.ts` 415/451); motion enters only as a conditional revision term (`efxPaintCompositeCache.ts` 181-225); parity tests pass |
| 6 | Content cycles while motion continues over the rail's full lifecycle (SC3, MOTN-06/MOTN-07) | ✗ FAILED | CR-04: `railViewOccurrences('infinity')` returns 1, so an infinite clip's view ends after one occurrence; `_trackMotionTransformAtFrame` then returns null and the transform vanishes while the resolver keeps cycling content |
| 7 | Edit view, Play, and export render the identical frame, including on the active track (SC4, MOTN-08) | ✓ VERIFIED | One `getFlattenedFrame` path serves preview (`previewRenderer.ts` 264/320) and export; `railMotionExportParity.test.ts` passes its active-track/trackTransforms cases |
| 8 | Motion-blur export keeps paint on every frame: integer content raster + fractional transform (SC4, REL-04) | ✓ VERIFIED | `exportRenderer.ts` sub-frame loop (478-484) + fractional offset preserved (346/360); store splits content frame vs transform frame (3300-3520); parity test covers fractional delivery and the memo bypass |
| 9 | Motion survives save → close → reopen (SC5, MOTN-12 persistence) | ✓ VERIFIED | `railMotions` in the allowlist, conditional canonical term, byte round-trip test and store-leg round trip pass (`railMotionPackageRoundTrip.test.ts`, `railMotionPersistence.test.ts`, `efxPaintPersistenceRailMotionRoundTrip.test.ts`) |
| 10 | Rotation is unbounded and values hold outside the keyed range (SC5, MOTN-09) | ✓ VERIFIED | Evaluator interpolates degrees with no wrap; endpoint hold tested (`railMotionEvaluator.test.ts`, 29 pass; model accepts any finite rotation) |
| 11 | Rail / drawing-key / motion-key scopes work independently, each with its own contextual commands (SC5, MOTN-11) | ✓ VERIFIED | `resolveSelectionScope` + `CONTEXTUAL_COMMANDS_BY_SCOPE` drive the strip (WorkflowStrip 3260-3267); exclusivity enforced in the production hosts (6248-6253 motion select clears drawing keys; 6687 and 4743 clear motion on drawing-key selection) |
| 12 | Ease, Wiggle, and Hold attach only to Motion keys; Wiggle is seeded and deterministic at export (SC5, MOTN-10) | ✓ VERIFIED | Command layer accepts easing/wiggle only on motion keys; evaluator seeds FNV-1a per rail/channel/frame with a deterministic `Random`; tests pin determinism and range |
| 13 | Every key operation is one undo/redo step (SC5, MOTN-12) | ✓ VERIFIED | History snapshot includes `railMotions`; `snapshotRecordsEqual`/`snapshotCanonicalContentEqual` compare it; `snapshotRevision` passes the 6th argument; `physicsPaintRotoRailMotionHistory.test.ts` passes |
| 14 | The v7 chrome matches its contract: 18px lanes, header cluster, 16x18 cells, 1.5px curves, 6x6 keys with lighter type rim, rounded outline wrapping row+channels, one open block, aligned header while scrolling, 2px post-block gap, measured reorder insertion (SC5, MUI-02..MUI-05) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Measures and structure are pinned by `timelineMotionSurface.contract.test.ts` and `PhysicsPaintWorkflowStrip.test.ts`; runtime visual/layout behaviour needs the live UAT (MUI-02..MUI-05 stay Pending) |
| 15 | Motion lives in rail-local time; keys survive moving or repeating the rail (SC5, MOTN-05) | ✓ VERIFIED | `resolveRailLocalFrame` subtracts the rail start and clamps; identity returns the same record reference when the start moves; start-move reconciliation is tested |
| 16 | Rail-set Copy and Duplicate carry the rails' Motion with the rails (plan 59-14, UAT row 6) | ✗ FAILED | CR-01: `buildRailSetCopyDocument` omits `railMotions` and hashes a 4-arg revision; the production Copy/Duplicate commands therefore produce motion-free payloads |
| 17 | Structural edits reconcile Motion in the same commit and a two-sided merge publishes the drop confirmation (plan 59-12/59-15) | ✗ FAILED | CR-02: `_applyRotoTrackSelectionRemoval` keeps only `.railMotions` and discards `droppedRailId`/`droppedRailFrames`; the direct loop-clip/records doors never reconcile (WR-04) |
| 18 | TS and Rust canonical encoders agree for every rail kind (plan 59-01; REL-02 cross-language) | ✓ VERIFIED | `cargo test --lib script_library` ran 23 tests green including `canonical_rail_motions_*` and `rail_motion_canonical_parity*`; TS parity suite passes against the golden fixture |
| 19 | Motion joins the canonical document revision; sampled values never enter the flattened cache key (REL-03) | ✓ VERIFIED | Conditional `rail-motions:` term after `loops:`, one structural revision authority, `_trackMotionRevision` null when motion-free; cache tests pin the motion-only key rotation and the absence of sampled values |
| 20 | No new runtime dependencies (REL-01) | ✓ VERIFIED | `railMotionDependencySurface.test.ts` passes (bare-import scan, frozen dependency list, non-vacuous check) |

**Score:** 13/20 truths verified (2 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/src/components/physic-paint/roto/railMotionModel.ts` | Types, parser, pure reducer | ✓ VERIFIED | 768 lines; fail-closed caps; `add-channel` branch exists but is never dispatched (see gap) |
| `app/src/components/physic-paint/roto/railMotionEvaluator.ts` | Single interpolation authority, curve path | ✓ VERIFIED | 390 lines; endpoint hold, smoothstep, unbounded rotation, seeded wiggle |
| `app/src/components/physic-paint/roto/railMotionCommands.ts` | Availability + command layer | ✓ VERIFIED | 861 lines; every command wired except add-channel (no such command exists) |
| `app/src/components/physic-paint/roto/railMotionIdentity.ts` | Durable identity + reconciliation | ✓ VERIFIED | Loop Clip binds by loopId, UUID mint, orphan retention; infinity span is the CR-04 defect |
| `app/src/components/physic-paint/roto/railMotionDocumentReconciler.ts` | Commit-point reconciler | ✓ VERIFIED | Wired at bridge 1968 and coordinator 2497; the store removal path drops its report (CR-02) |
| `app/src/components/physic-paint/view/TimelineMotionChannels.tsx` | v7 lanes/keys/curve/menu | ⚠️ ORPHANED (menu) | Lanes verified; `TimelineMotionChannelMenu` is unreachable because no host passes `channelMenuOpen` |
| `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` | Chevron, outline, block layout | ✓ VERIFIED | Motion props declared and rendered; grouped lane addresses `channels[0]` (WR-02) |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` | Active-lane host, measured layout, actions | ✓ VERIFIED | Chevron/outline/reorder measured; add-channel props omitted (CR-03) |
| `app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts` | Inspector projection | ✓ VERIFIED | Projects all five channels; no `present` flag (IN-02) |
| `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` | Motion actions + copy/duplicate | ⚠️ PARTIAL | Motion actions wired; copy document omits railMotions (CR-01) |
| `app/src/stores/physicPaintStore.ts` | Projection, transform resolution, revisions | ✓ VERIFIED | Transform/view/revision paths present; removal report discarded (CR-02) |
| `app/src/efx-paint/compositor/efxPaintCompositor.ts` | One transform application | ✓ VERIFIED | Both draw sites delegate to the shared `drawEfxPaintTrack` |
| `app/src/efx-paint/compositor/efxPaintCompositeCache.ts` | Motion revision in cache key | ✓ VERIFIED | Conditional participating-track term, no sampled values |
| `app/src/lib/exportRenderer.ts`, `app/src/lib/previewRenderer.ts` | Sub-frame export parity | ✓ VERIFIED | Integer content + fractional transform flow |
| `app/src-tauri/src/services/script_library.rs` | Rust canonical/guard parity | ✓ VERIFIED | 23 tests green |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Animate action | `animateRail` -> store -> bridge -> Rust | command commit path | ✓ WIRED | `commitRailMotionRecords` -> `replaceRotoPhysicalRailMotions`; bridge forwards/reconciles |
| Motion key write/easing/wiggle | store collection | `writeMotionTransformAtCursor` / write value | ✓ WIRED | All refuse absent channels (the CR-03 symptom) |
| Add-channel menu | host state | `motionChannelMenuOpen` / `onAddMotionChannel` | ✗ NOT_WIRED | No production supplier; menu unreachable |
| Copy/Duplicate command | motion payload | `buildRailSetCopyDocument` | ✗ NOT_WIRED | Omits `railMotions`; payload motion always empty |
| Store removal reconciliation | merge-drop notice | `droppedRailId`/`droppedRailFrames` | ✗ NOT_WIRED | Report discarded at `physicPaintStore.ts` 6055-6067 |
| `trackTransforms` | compositor draw | `drawEfxPaintTrack` | ✓ WIRED | Both draw sites pass the per-track transform |
| Export fractional frame | `getFlattenedFrame` | sub-frame loop | ✓ WIRED | Parity test covers the law |
| TS canonical revision | Rust canonical revision | `rail-motions:` term | ✓ WIRED | Golden fixture + 23 Rust tests |
| Inspector fields | channel value write | `projectRailMotionInspector` -> NumericStepper | ✓ WIRED | Absent-channel edits are refused with a message (IN-02: no availability flag) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| Compositor draw | `trackTransforms` | store projection -> evaluator -> railMotions | Yes | ✓ FLOWING |
| Preview/export renderer | `physicPaintFrame` | store `getFlattenedFrame` -> same evaluator | Yes | ✓ FLOWING |
| Motion lane curve | channel keys | record channels | Yes (Position only) | ✓ FLOWING |
| Rail-set copy payload | `railMotions` | `buildRailSetCopyDocument` | No — empty collection | ✗ DISCONNECTED |
| Merge-drop notice | `droppedRailFrames` | reconciler report | Computed then discarded | ✗ DISCONNECTED |
| Infinite-clip transform | `endFrameExclusive` | `railViewOccurrences` | Truncated to one cycle | ✗ STATIC after first cycle |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase motion model/evaluator/commands/identity/persistence/pivot/reconciler/lanes/export/canonical parity | `pnpm --filter efx-motion-editor exec vitest run` on the 11 phase suites | 11 files, 301 tests passed, 0 failed | ✓ PASS |
| Rust canonical + guard parity | `cargo test --manifest-path app/src-tauri/Cargo.toml --lib script_library` | 23 passed, 0 failed (run recorded in 59-UAT.md; first invocation raced a rebuild and ran 0 tests) | ✓ PASS |
| Phase test quality | grep for `.skip`/`xit`/`xdescribe` in phase test files | No skipped/disabled phase tests | ✓ PASS |
| Probe execution | No `probe-*.sh` declared in any 59-*-PLAN.md; not a migration/CLI phase | Step 7c not applicable | ? SKIP |

### Probe Execution

No probes declared or implied. `59-*-PLAN.md` contain no `probe-*.sh` reference and no probe-based verification criterion; Step 7c is not applicable to this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MOTN-01 | 59-06/07/08/12 | Add/edit/remove Motion keys on any rail | ✓ SATISFIED | Command tests + wiring; every rail kind binds |
| MOTN-02 | 59-06/07/15 | Motion keys independent of drawing keys | ✓ SATISFIED | Deep-equality command tests; delete re-anchor test |
| MOTN-03 | 59-02/07/10 | Position (grouped or split), Scale, Rotation, Opacity | ✗ BLOCKED | CR-03: only Position channels can exist in production; REQUIREMENTS.md's "Complete" is contradicted by the code |
| MOTN-04 | 59-02/10 | Channels open on demand, one at a time | ✗ BLOCKED | CR-03: add-channel unreachable; REQUIREMENTS.md's "Complete" is contradicted by the code |
| MOTN-05 | 59-05/06/15 | Rail-local time; survives move/repeat | ✓ SATISFIED | Evaluator + identity + start-move reconciliation tests |
| MOTN-06 | 59-05/15 | Repeat semantics observable | ✗ BLOCKED | Infinite repeat truncates the motion span (CR-04); finite repeats work |
| MOTN-07 | 59-08/09/15 | Compositor transform, one raster, content cycles, no re-bake | ✗ BLOCKED | One-raster/no-re-bake verified; "content cycles while motion continues" fails for infinite clips |
| MOTN-08 | 59-09/16 | Edit view, Play, export agree | ✓ SATISFIED | Single flattened path + parity tests |
| MOTN-09 | 59-05/08 | Rotation unbounded, hold outside keys, time-invariant pivot | ✓ SATISFIED | Evaluator + pivot tests |
| MOTN-10 | 59-05/07/12 | Ease/Wiggle/Hold on Motion keys only, seeded deterministic | ✓ SATISFIED | Command/evaluator tests; merge-notice publishing path is incomplete (CR-02), see gap |
| MOTN-11 | 59-12 | Three independent selection scopes | ✓ SATISFIED | Scope resolver + per-scope command table wired; exclusivity enforced in hosts |
| MOTN-12 | 59-03/07/13/14 | Save/reopen + one undo step per key op | ✓ SATISFIED | Persistence/round-trip/history tests |
| MUI-01 | 59-11/12 | Coloured chevron / grey minus | ? NEEDS HUMAN | Code present; visual pending live UAT (kept Pending) |
| MUI-02 | 59-10/11 | 18px lanes, header cluster, cells, curves, keys, rim | ? NEEDS HUMAN | Contract tests pin measures; runtime visual pending |
| MUI-03 | 59-10/11 | Rounded outline wraps row + channels, absent collapsed | ? NEEDS HUMAN | Structure present; runtime visual pending |
| MUI-04 | 59-11/12 | One open rail block at a time | ? NEEDS HUMAN | Single-writer signal + tests; live behaviour pending |
| MUI-05 | 59-11/14 | Measured alignment/reorder, 2px post-block gap | ? NEEDS HUMAN | Measured-array tests; live scroll pending |
| MUI-06 | 59-09/12 | Previous/next/diamond; disabled with a real reason | ✓ SATISFIED | Availability authority + visible reasons; nav/diamond routed to commands |
| REL-01 | 59-01/16 | No new runtime dependencies | ✓ SATISFIED | Dependency-surface test |
| REL-02 | 59-01/03/13 | New `.mce` fields round-trip byte-identically | ✓ SATISFIED | TS round trips + 23 Rust tests |
| REL-03 | 59-03/09 | Motion in canonical revision; no sampled values in cache key | ✓ SATISFIED | Revision tests + cache tests |
| REL-04 | 59-09/16 | Motion-blur export keeps paint (integer content, fractional transform) | ✓ SATISFIED | Export parity tests |

**Orphaned requirements:** none — every ID mapped to Phase 59 in REQUIREMENTS.md appears in at least one plan frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `railMotionModel.ts` | 559-587 | `animate` seeds only the two Position channels | 🛑 BLOCKER | No path seeds Scale/Rotation/Opacity (CR-03) |
| `PhysicsPaintWorkflowStrip.tsx` | 6240-6275 | Active-lane host omits `motionChannelMenuOpen`/`onAddMotionChannel` | 🛑 BLOCKER | Add-channel menu unreachable (CR-03) |
| `PhysicsPaintTrackRow.tsx` | 928, 1282 | `motionChannelMenuOpen = false` default; no host supplier | 🛑 BLOCKER | Menu never opens (CR-03) |
| `useRotoTimelineActions.ts` | 4926-4955 | Copy document omits `railMotions`; 4-arg revision | 🛑 BLOCKER | Copy/Duplicate drop motion (CR-01) |
| `physicPaintStore.ts` | 6055-6067 | Reconciliation report discarded (`.railMotions` only) | 🛑 BLOCKER | Merge-drop notice never fires on this path (CR-02) |
| `railMotionIdentity.ts` | 168-171, 209 | `infinity` mapped to one occurrence | 🛑 BLOCKER | Infinite clip transform disappears after cycle 1 (CR-04) |
| `TimelineMotionChannels.tsx` | 355 | `buildRailMotionCurvePath(channel, frameCount, laneHeight)` without `railId` | ⚠️ WARNING | Lane wiggle seed differs from the applied transform (WR-01) |
| `PhysicsPaintTrackRow.tsx` | 562 | `laneChannelId = lane.channels[0]?.id ?? 'position-x'` | ⚠️ WARNING | A grouped Position lane can only address `position-x`; `position-y` easing/wiggle is unreachable (WR-02) |
| `physicsPaintRotoPhysicalModel.ts` vs `script_library.rs` | 1722 / 1600 | `localeCompare` (TS) vs byte order (Rust) | ⚠️ WARNING | Ordering divergence latent for non-ASCII ids; app-minted UUIDs collide-free today (WR-03) |
| `physicPaintStore.ts` | 5735 | `groupOwnedKeyIds: new Set()` in copy segment derivation | ⚠️ WARNING | Copy can split rails that a group owns (WR-05) |
| `physicPaintStore.ts` | 5156-5206 | `replaceRotoPhysicalLoopClips` never reconciles motion | ⚠️ WARNING | Structural door bypasses the commit-point reconciler (WR-04) |
| `physicsPaintRotoRailSetSelection.ts` | 452-468 | `clearSelectionForScope` defined and tested but no production caller | ℹ️ INFO | Exclusivity is enforced inline in the hosts; the helper is dead export |
| `railMotionCommands.ts` | imports | Unused imports (IN-03), production-dead exports (IN-04), dead `hasMotionRecord` input (IN-05) | ℹ️ INFO | Cosmetic; no behavioural impact |

No `TBD`/`FIXME`/`XXX` markers, no placeholder/coming-soon text, and no empty-return stubs were found in the phase-modified core files.

### Human Verification Required

The 13 live UAT rows authored by plan 59-14 are all still `pending`; they are listed in the frontmatter `human_verification` section. Rows 1-3 additionally carry the v7 chrome visual check (MUI-02..MUI-05); rows 4, 6 and 9 are expected to fail today because of CR-04, CR-01 and CR-02 respectively.

### Gaps Summary

The architectural core of the phase is real: durable rail identity, a fail-closed persisted collection, a single evaluator, one compositor transform application, a revision/cache split, and cross-language canonical parity are implemented, wired, and covered by 301 passing TS tests and 23 passing Rust tests. The goal is nevertheless not achieved, for two goal-level reasons and two commit-path reasons:

1. **Only Position can carry motion (CR-03).** The phase goal says "every rail … can be animated by Motion keys"; the roadmap's SC2 says Position, Scale, Rotation and Opacity each animate with their own keys. In the shipped code the add-channel affordance has no production host and no reducer dispatch, so Scale, Rotation and Opacity are structurally unreachable. REQUIREMENTS.md marks MOTN-03/MOTN-04 Complete on the strength of tests that exercise the reducer directly, not the product path — this is exactly the "green tests stand in for the goal" failure the review surfaced.
2. **Infinite Loop Clips lose their transform after one cycle (CR-04).** Content keeps cycling but motion stops being applied, violating SC3 and MOTN-06/MOTN-07.
3. **Copy/Duplicate drop motion (CR-01).** The production copy builder omits `railMotions`, so the copy does not animate.
4. **The merge-drop confirmation never fires on the store removal path (CR-02).** The reconciler computes the dropped tail but the caller discards the report.

The two behaviour-unverified truths (chevron rendering, v7 chrome measures) are not blockers by themselves; they are routed to live UAT and must not be flipped to Complete without it.

### Deferred Items

None. Phase 60 (zoom), 61 (vector) and 62 (curve editing) do not cover any failed truth, so no gap was deferred.

---

_Verified: 2026-11-06T19:11:38Z_
_Verifier: Claude (gsd-verifier)_
