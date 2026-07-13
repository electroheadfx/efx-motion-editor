---
status: resolved
trigger: "Run exactly Debug 08 — Onion Skin, Preview, and Export Parity."
created: 2026-07-13T00:00:00Z
updated: 2026-07-13T23:50:00Z
---

# Debug Session: Debug 08 — Onion Skin, Preview, and Export Parity

## Symptoms

expected: |
  All downstream Roto consumers use the same canonical source/display model as the workflow timeline: onion skin, Physics Paint preview, parent EFX Motion preview, playback, persistence/hydration, and export. A real key has one absolute durable source identity shared by source key, marker, paint/cache key, persistence key, and hydrated key. Interpolation changes only display projection, generated render-only frames, and preview/export sequence. Generated frames remain non-durable, non-editable, non-anchor, non-Copy, and non-persisted.
actual: |
  Debug 08 is an audit-first downstream-consumer investigation. Current behavior is not presumed broken. Existing Debugs 01–07 are native-UAT accepted and committed and must not be reopened. Production code may change only after exact path tracing, a parity report, and genuine failing regression tests demonstrate a remaining user-visible divergence.
errors: No explicit runtime error supplied. Potential failures are source/display, spacing, ownership, range, onion-anchor, preview, hydration, playback, or export parity divergences.
started: Debug 08 is the final numbered debug of Phase 36.13, after Debugs 01–07 were native-UAT accepted and committed.
reproduction: |
  Establish exact regression tests using distinct paint payloads A/B/C/D/E/F. Test compact and custom distant source models immediately, after ON->OFF->ON, after close/reopen while ON and OFF, and after project save/load while ON and OFF. Compare workflow projection, Physics Paint preview, parent preview, playback, export, persistence, and hydration frame-for-frame rather than by count alone.

## Canonical Contract

- A real Roto key has one absolute durable source identity shared by source key, marker, paint/cache key, persistence key, and hydrated key.
- Interpolation changes only display projection, generated render-only frames, and preview/export frame sequence.
- Generated frames are render-only, non-durable, non-editable, cannot become onion anchors or Copy sources, cannot become persistence identities, and cannot silently become real keys.
- With N in-betweens, compact adjacent real keys are separated by exactly N+1 visible frames.
- No downstream consumer may invent a separate spacing model.

### Compact truth table

```text
durable source keys: 0[A] / 1[B] / 2[C]
in-betweens: 2

OFF real positions:
0[A] / 1[B] / 2[C]

ON real positions:
0[A] / 3[B] / 6[C]

ON generated positions:
1 / 2 between A and B
4 / 5 between B and C
```

Preview, parent preview, playback, and export must use the same ON sequence.

### Multiple custom segments truth table

```text
durable source keys:
0[A] / 1[B] / 2[C] / 3[D] / 14[E] / 26[F]

in-betweens: 2

OFF real positions:
0[A] / 1[B] / 2[C] / 3[D] / 14[E] / 26[F]

ON real positions:
0[A] / 3[B] / 6[C] / 9[D] / 14[E] / 26[F]

ON generated positions:
1 / 2
4 / 5
7 / 8
10 / 11 / 12 / 13
15 through 25
```

Independent custom segments:

```text
source segment 3 -> 14
display segment 9 -> 14
generated displays 10 / 11 / 12 / 13

source segment 14 -> 26
display segment 14 -> 26
generated displays 15 through 25
```

No consumer may compact E or F to global slots such as 12 or 15.

## Onion-Skin Contract

- Onion skin is anchored only to neighboring real Roto keys.
- For compact ON real keys 0[A]/3[B]/6[C], editing B at display 3/source 1 uses A source/display 0 and C source 2/display 6. Generated displays 2 or 4 must not be anchors.
- Generated display 1 or 2 previews generated content but resolves surrounding real anchors A display 0/source 0 and B display 3/source 1.
- Generated display 4 or 5 resolves B display 3/source 1 and C display 6/source 2.
- Generated display 12 resolves D display 9/source 3 and E display 14/source 14.
- Generated display 20 resolves E display 14/source 14 and F display 26/source 26.
- Distant real keys remain valid onion anchors. Generated frames never become previous or next anchors.

## Preview, Playback, Parent Preview, and Export Contract

All consumers must derive from the same canonical inputs:

```text
durable real source keys
global in-between count
per-segment spacing overrides
generated render-only cache/projection
```

They must not derive spacing from current Studio selection, transient editable frame, stale cached arrays, playback-local rules, renderer-specific ordinal spacing, temporary UI projection, or a second source/display converter.

For the same persisted model, these must agree exactly:

```text
workflow timeline projection
Physics Paint preview
parent preview
playback
export frame sequence
close/reopen hydration
project save/load hydration
```

## Interpolation OFF Contract

Disabling interpolation must remove generated frames from Physics Paint preview, parent preview, playback/export while preserving durable real source keys, paint/cache identities, custom spacing metadata, and distant-key range.

Custom OFF sequence:

```text
0[A] / 1[B] / 2[C] / 3[D] / 14[E] / 26[F]
```

Re-enable must restore real displays:

```text
0[A] / 3[B] / 6[C] / 9[D] / 14[E] / 26[F]
```

and all exact generated positions. OFF must not delete or flatten custom overrides.

## Persistence, Hydration, and Range Contract

Test downstream consumers:

1. immediately after model creation;
2. after ON -> OFF -> ON;
3. after closing/reopening Physics Paint while ON;
4. after closing/reopening Physics Paint while OFF;
5. after project save/load while ON;
6. after project save/load while OFF.

Immediate and hydrated results must be identical. Close/reopen must not repair a stale preview or export model.

For the model ending at real display 26, preview/playback/export must include the canonical sequence through 26, include final F, generate no source-less tail beyond 26, and not export empty timeline space after 26.

## Required Diagnosis Before Production Edits

Trace and report every path before changing production code.

### Onion path

```text
selected display frame
-> real/generated classification
-> surrounding source-key resolution
-> previous/current/next reference selection
-> onion payloads sent to renderer
```

Report whether onion receives real source keys, projected real display keys, mixed real/generated cache frames, or stale Studio-local arrays. Identify the first exact symbol where a generated frame can become an anchor or a distant anchor can be lost.

### Parent preview path

```text
canonical source model
-> projection/cache generation
-> apply/close transport
-> parent preview inputs
-> parent frame rendering
```

Identify whether parent preview consumes canonical generated cache or reconstructs spacing independently.

### Export path

```text
persisted source model
-> hydrated interpolation settings
-> generated projection
-> export frame enumeration
-> exported payload sequence
```

Identify whether export uses source frames as displays, applies only global count, ignores overrides, reads transient Studio state, compacts distant keys, omits final F, or includes stale generated frames while OFF.

### Mandatory parity report before edits

Report:

- current onion anchor source;
- current parent-preview frame source;
- current export frame source;
- first divergence for every failing consumer;
- duplicated spacing implementations;
- smallest canonical correction boundary;
- genuine RED tests reproducing the visible contract.

Do not modify production code before this report and RED evidence exist.

## Required TDD Coverage

1. Onion anchors, compact: real B at display 3 uses A/C; generated 1/2 use A/B; generated 4/5 use B/C; generated frames never appear in anchor list.
2. Onion anchors, custom: generated 12 uses D/E; generated 20 uses E/F; D/E/F retain source identities 3/14/26; generated frames remain non-editable.
3. Preview parity: exact ordered identities for compact ON/OFF, custom ON/OFF, ON->OFF->ON, close/reopen, save/load. Compare frame position, real/generated classification, source ownership, paint payload, and final range.
4. Export parity: exact same canonical sequence as preview, including overrides, final frame 26, no tail, OFF omission of generated frames, OFF retention of distant real keys, and identical save/reopen export.
5. Generated guards through actual downstream boundaries: generated current preview allowed, but non-editable, non-real, non-anchor, non-Copy, non-persisted, and source-model preserving.
6. Distinct A/B/C/D/E/F payloads detect overwritten paint, source/display mismatch, wrong anchor ownership, stale generated payload, preview/export disagreement, and hydration under wrong keys.

Tests comparing only frame counts are insufficient.

## Audit-First Rule

For every scenario:

1. establish the regression test;
2. run it against current production code;
3. if it passes, preserve the path and do not rewrite it;
4. if it fails, record the first exact divergence;
5. implement only the smallest correction required.

Do not perform broad renderer refactoring without a proven failing boundary.

## Scope and Constraints

- Preserve all native-UAT accepted Debug 01–07 contracts: extracted Studio architecture, absolute identity, Save current, reusable Copy/Paste, immediate action/launch refresh, independent distant segments, and Insert/Duplicate/Delete override behavior.
- Do not move Roto ownership back into PhysicsPaintStudio.tsx.
- Do not add internal Roto useEffect synchronization, timers, polling, sleeps, delayed refresh, forced remounts, artificial navigation, mirrored source/display arrays, renderer-specific spacing, compatibility shims, editable generated frames, generated durable keys, source identity changes, key utility changes, or unrelated UI scope.
- Business rules remain in pure model, selector, transaction, preview, or export modules. Preact hooks/controllers remain thin.
- Use one canonical projection shared by timeline, preview, onion, and export.
- Do not start the development server.
- Do not commit.
- Do not mark Debug 08, Phase 36.13, or milestone UAT accepted/complete.
- Stop when Debug 08 is automated-ready for native UAT.

## Required Verification

- focused onion-anchor tests;
- focused preview parity tests;
- focused export parity tests;
- generated-frame guard tests;
- persistence/hydration tests with custom distant segments;
- parent preview integration tests;
- complete Physics Paint matrix;
- typecheck;
- production build;
- git diff check.

## Current Focus

hypothesis: "The corrected real/generated/empty onion contract and deterministic mounted readiness harness are automated-ready; native UAT must confirm the visible Tauri workflow."
test: "Run native UAT for real, generated, and empty selected displays; direction combinations; Onion Value 0/30/100; close/reopen persistence; and no durable-key creation from generated or empty selections."
expecting: "Previous and Next independently resolve the nearest strict surrounding real keys for every selected display class; opacity affects overlays only; generated and empty selections remain non-durable; preview/export remain unchanged."
next_action: "Await native onion UAT result without marking Debug 08 or Phase 36.13 accepted."

reasoning_checkpoint:
  hypothesis: "`markCurrentFrameDirty` admits a true-empty selected display, which makes later Save current treat editable engine state as a new durable real key and emit the observed apply-canvas payload."
  confirming_evidence:
    - "The corrected mounted tracer directly observed one apply-canvas payload at sourceFrame/startFrame/appFrame 10 for interpolation OFF, while expecting none."
    - "Prior path tracing found `markCurrentFrameDirty` rejects generated selections only; the Save path then permits empty/custom-position real-key creation."
  falsification_test: "After guarding the empty selection at `markCurrentFrameDirty`, the same mounted tracer would still emit an apply-canvas payload at display 10, proving another mutation path enables persistence independently."
  fix_rationale: "Blocking dirty-state creation at the first exact mutation-enabling boundary prevents empty displays from entering Save current while preserving existing Save semantics for canonical real keys and avoiding downstream symptom guards."
  blind_spots: "Need to confirm the controller already receives or can consume canonical selection classification without introducing mirrored state, and run adjacent real-key Save tests to ensure legitimate edits remain enabled."

### Mandatory native-path diagnosis report before onion edits

- selected display -> classification: `PhysicsPaintStudio.currentFrame` is `launchContext.startFrame`; `useRotoTimelineModel`/`selectRotoTimelineView` classifies it from the canonical projection (`projection.generatedFrames`) plus generated cache identity. `findCachedRotoDisplayFrame(currentFrame)` correctly prefers the generated cache payload for a generated selected display.
- canonical projected real sequence: parent `createPhysicPaintLaunchContext` supplies `physicPaintStore.getRotoCacheFrames(layerId)` without a frame window. Store regeneration calls `getExpandedRotoRealKeyFrames`; real entries carry durable `sourceFrame` and projected `displayFrame` (for the custom contract: 0/3/6/9/14/26). The native Tauri transport serializes the full `cachedRotoFrames` array; no native-side truncation was found.
- launch/store/dirty candidates: `PhysicsPaintStudio` passes the complete `launchContext.cachedRotoFrames`, complete `physicPaintStore.getRotoCacheFrames(layerId)`, local `rotoPreviewFramesRef.current`, and `dirtyRotoFramesRef.current` to `projectRotoOnionPreviewFrames`. The actual launch/store arrays contain real and generated displays across the whole 0..26 canonical range; preview frames are source-keyed after save, and dirty preview frames override the same candidate key only when dirty.
- actual candidate contents/window/staleness: the inputs are not bounded and are not stale at initial native launch. `addCandidate` spreads `frame` first and then assigns `appFrame: anchorFrame`, so each admitted real candidate retains its projected display identity. Focused mounted tests now prove both a short projected previous anchor and a distant custom previous anchor render correctly.
- why ideal isolated tests passed: they exercise the same valid projected-real selection behavior. The remaining discrepancy is narrower: mounted Studio starts on a generated display and emits no onion images even though real-display starts work.
- first exact symbol losing distant previous anchor: none reproduced in current code. The native mounted long-custom test retains the nearest previous real anchor, so the UAT symptom is not caused by selector candidate identity or launch-window truncation.
- first exact symbol losing generated-selection anchors: not yet confirmed. Current evidence bounds it after canonical launch-cache construction and specifically to the mounted generated-selection path. The next boundary test will distinguish pure-selector output from Studio control/overlay suppression.
- payload lookup -> renderer: real onion payload ownership comes from `onionDataUrl` when present, otherwise the candidate's `dataUrl`; generated current payload comes from `findCachedRotoDisplayFrame`. The canvas overlay currently renders only `onionPreviewFrames.map(...)`; current generated content is rendered separately as `cachedRotoReferenceUrl`, not as part of the selector output.
- hard-coded/fixed opacity symbol: `getOnionFrameOpacity(distance)` returns only `ONION_DEPTH_OPACITY = [0.5, 0.25, 0.15]`; `PhysicsPaintStudio` calls it without `onion.opacity`. `PhysicsPaintRightPanel` clamps an opacity field but exposes no opacity slider; its "Onion value" range edits `count`. Parent EFX Motion uses `paintStore.onionSkinOpacity` with range 0..100, default 0.3 (30%), immediate signal persistence across ordinary close/reopen, and reset only on project/store reset.
- smallest shared correction: keep selection pure and all existing ownership boundaries. Normalize candidate values so `appFrame` is the projected anchor after spreading payload fields; expose a pure overlay-opacity calculation that multiplies the existing depth falloff by the parent-compatible 0..100 onion opacity; add a right-panel opacity slider matching parent range/default semantics; initialize/update Physics Paint onion state from the shared parent opacity signal without effects or mirrored persistence. If native RED proves generated current composition absent, add it at the thin Studio render composition using the existing `findCachedRotoDisplayFrame` lookup, without making generated frames anchors or durable/editable.

### Corrected-contract mandatory native-path diagnosis report (before further production edits)

- real/generated/empty selection entry: `createPhysicPaintLaunchContext` always preserves the selected timeline display as `startFrame`; `PhysicsPaintStudio.currentFrame` reads that value unchanged. `selectRotoTimelineView` classifies generated positions, but has no explicit real/generated/empty selection kind.
- does anchor lookup exit early for generated or empty selections: no. `PhysicsPaintStudio` calls `projectRotoOnionPreviewFrames` for every selected display. Its only selection-related early return is `if (input.isPlaying) return []`; it neither rejects generated selections nor empty selections.
- does anchor lookup require a current Roto payload first: no. `projectRotoOnionPreviewFrames` selects strict `< currentFrame` and `> currentFrame` candidates without looking up current content. Separately, `createRotoReferenceLoader.load` calls `findCachedRotoReferenceFrame` for the current display and clears the engine preview base when none exists; that current-preview behavior does not gate onion projection.
- does anchor lookup search only a local display window: no. The 120-cell `PhysicsPaintWorkflowStrip.buildFrameCells` window is presentation-only. Onion projection receives the complete `launchContext.cachedRotoFrames`, complete store cache, and local preview/dirty collections; no visible-window slicing occurs.
- does anchor lookup read mixed generated/real identities instead of the canonical real-key sequence: yes. The first call-site divergence is `PhysicsPaintStudio` passing mixed launch/store caches and source-keyed/local preview maps directly to `projectRotoOnionPreviewFrames`. The first selector divergence is `projectRotoOnionPreviewFrames.addCandidate`: it rejects explicitly tagged generated/background frames but admits any untagged preview frame as a real anchor and trusts `displayFrame ?? appFrame`. It therefore does not resolve payload ownership against `rotoTimelineModel.view.value.projection.realKeys`, and a source-keyed dirty preview can be admitted at a non-canonical display identity.
- generated current path: `findCachedRotoDisplayFrame` explicitly prefers the generated cache payload at the selected display, so generated current paint can appear in the engine preview base. Generated frames are rejected as onion anchors by `addCandidate`, and generated edit/save mutation is blocked by `useRotoFrameEditingController.markCurrentFrameDirty`, `guardRotoSaveFrame`, and the parent bridge guard.
- empty current path: `findCachedRotoDisplayFrame` returns null, and `createRotoReferenceLoader.load` clears only the current engine preview base. Onion anchors should still project. However empty selections are not classified as non-editable: the first durable-key divergence is `useRotoFrameEditingController.markCurrentFrameDirty`, which guards generated selections only and marks an empty display dirty. `useRotoSaveController.saveRotoFrame` then blocks generated only, calls `saveRealKeyAtDisplayFrame`, and `guardRotoSaveFrame` explicitly describes empty/custom positions as real-key creation targets. Selection alone creates no key, but painting/saving an empty selection can create one, violating the corrected contract.
- first exact symbol per corrected-contract divergence:
  - generated/empty onion early exit: none in the onion selector; only playback suppresses onions.
  - current-payload prerequisite: none for anchors; `createRotoReferenceLoader.load` affects current preview only.
  - local-window truncation: none; `buildFrameCells` is not an onion input.
  - mixed cache identities: `PhysicsPaintStudio` onion call arguments, then `projectRotoOnionPreviewFrames.addCandidate` permissive untagged admission.
  - empty durable-key creation: `useRotoFrameEditingController.markCurrentFrameDirty` is the first mutation-enabling symbol; `useRotoSaveController.saveRotoFrame`/`guardRotoSaveFrame` complete persistence.
- why the previous mounted 10/10 contract omitted empty behavior: its helper mounted only real displays 6/14 and generated displays 4/12/20; direction and opacity cases all reused real display 14. The tests inherited the prior product assumption encoded in `guardRotoSaveFrame` that an empty/custom position is a valid new-key target, so no before/between/after-empty selection was represented and the automated-ready claim could not test the corrected contract.
- smallest shared correction boundary: extend the pure timeline selection model to expose a single current selection kind (`real-key | generated-interpolation | empty`), and make the pure onion projector resolve payloads only for the canonical ordered `projection.realKeys` source/display pairs. Thin Studio/controllers consume that classification to keep both generated and empty selections non-editable/non-durable while still rendering current generated preview and strict surrounding real onions. This avoids a second spacing model, mirrored arrays, effects, or ownership returning to `PhysicsPaintStudio.tsx`.

### Mandatory pre-edit parity report

- current onion anchor source: `projectRotoOnionPreviewFrames` merges launch/store/dirty preview inputs by projected display identity, but admits only `source === 'real-key'` frames (or legacy untagged real inputs); generated interpolation and background-only frames are rejected before previous/next selection.
- current Physics Paint preview source: `findCachedRotoDisplayFrame` prefers generated cache for generated display positions, then local preview, then launch/store real cache and confirmed real frames. Generated current preview is visible but non-editable.
- current parent-preview frame source: `PreviewRenderer` calls `physicPaintStore.getRotoFrame(layerId, displayFrame)`, which reads the parent store's merged real/generated display cache generated from the canonical projection.
- current playback frame source: `physicsPaintRotoSession.playbackFrameNumbers` orders the union of projected real and generated display identities; `useRotoNavigationCoordinator` resolves payloads at those exact identities and `useRotoCachedPlayback` does not calculate spacing.
- current export frame source: `ExportRenderer` delegates payload collection and rendering to the same `PreviewRenderer` lookup as parent preview; it has no Roto-specific spacing converter. Export range remains parent timeline/sequence driven and needs exact final-frame coverage.
- current persistence/hydration source: `physicPaintStore.toMceOutputs` serializes durable rendered frames, interpolation settings, and `_getCombinedRotoMetadata`; the latter includes `_rotoGeneratedCacheMetadata`. `loadFromMceOutputs` accepts generated metadata and then regenerates the display cache from real keys and settings.
- duplicated spacing implementations: none found across timeline, store cache, playback, parent preview, or export. Timeline and store regeneration both delegate to `getExpandedRotoRealKeyFrames`; other consumers enumerate or look up that projection.
- first divergence candidate — persistence: `_getCombinedRotoMetadata` is passed directly to `roto_cache_metadata`, allowing derived `generated-interpolation` identities to become persisted/hydrated metadata despite the render-only contract.
- first divergence candidate — range: `getExpandedRotoRealKeyFrames` has a last-source-key span branch for models with more than two keys; an exact custom 0/1/2/3/14/26 test must establish whether it emits any display beyond 26.
- passing boundaries to preserve: onion generated-anchor rejection, generated key-action/Copy guards, bridge mutation guard, shared parent preview/export lookup, playback enumeration, and launch hydration's use of parent canonical cache.
- smallest correction boundary if RED confirms persistence: serialize only real-key durable Roto metadata and ignore persisted generated metadata on hydration; continue regenerating generated cache exclusively from durable real keys, settings, and overrides. No projection, renderer, controller, or Studio rewrite is justified.

## Evidence

- timestamp: 2026-07-13T23:50:00Z
  checked: native clarification that a generated frame must behave like its owning real key for onion traversal
  found: Frame 15 duplicated real key 13 as its current generated preview. With Onion Value 1, the selector still counted key 13 as the previous onion, producing an identical image hidden beneath the current preview; Value 2 only appeared to work because it reached the next distinct key. A RED test reproduced `[13,17]` instead of `[6,17]` for keys 6/13/17 and generated frame 15 owned by 13.
  implication: Generated current frames now use their canonical `fromSourceFrame` owner as the traversal pivot. The owner remains the visible current generated preview but is excluded from onion overlays, exactly like selecting the owner real key. Value 1 at generated frame 15 resolves previous key 6 and next key 17; Value 2 expands to two neighboring real keys per direction when available. Focused pure/mounted contracts pass; the complete Physics Paint matrix passes 40 files / 537 tests with 19 existing todos; typecheck, build, and `git diff --check` pass. Native UAT remains required.

- timestamp: 2026-07-13T23:38:00Z
  checked: native clarification that Onion Value is neighboring real-key depth, not absolute display-frame reach
  found: A red-capable selector test reproduced the native failure exactly. With real keys 6 and 13, untagged local/generated preview frames at displays 7–12 were admitted as anchor candidates. At display 7 with Onion Value 1, the selector returned real key 6 plus fake display 8 instead of real key 13. Value 2 appeared to work only because the second slot reached the actual real key. The same contamination caused displays after real key 17 to lose that key as the nearest anchor.
  implication: Preview/generated/empty display frames must never create onion anchor slots. The selector now seeds anchors only from canonical real-key launch/store frames; local dirty previews may replace the payload of an already-known real-key anchor but cannot add a new anchor identity. Exact tests prove displays 7–12 resolve keys 6/13 with value 1, and displays 18–20 resolve key 17 with value 1 or keys 13/17 with value 2. Focused mounted contracts, 40 files / 536 tests with 19 existing todos, typecheck, production build, and `git diff --check` pass. Native UAT remains required.

- timestamp: 2026-07-13T23:24:00Z
  checked: failed native UAT against the actual visible onion surface
  found: The generated and true-empty mounted tests asserted that onion image nodes and payload identities existed, but did not assert browser layer visibility. `.physics-paint-onion-overlay.canvas-region` used z-index 3 while the engine's second opaque canvas used z-index 4, so the live canvas painted over every onion image. This single renderer-boundary defect explains both native failures: generated interpolation did not visibly show transparent onions, and an empty selected frame did not visibly show the nearest previous real paint even though its image node existed.
  implication: The earlier automated-ready claim was false for the visible surface. A red-capable CSS layer-order contract now requires onion composition at z-index 5, above both engine canvases. The one-line production correction passes the focused layer-order RED/GREEN test, generated/empty mounted payload tests, the 40-file / 535-test Physics Paint matrix with 19 existing todos, typecheck, production build, and `git diff --check`. Native UAT remains required and no acceptance is recorded.

- timestamp: 2026-07-13T23:10:00Z
  checked: deterministic mounted Studio readiness correction and complete corrected-contract verification
  found: The test harness now routes every mounted `PhysicsPaintStudio` render through exact engine/canvas and browser bridge lifecycle signals, then asserts the exact ready status element. The mounted alpha-merge path also has deterministic test-only `Image`, `drawImage`, and output-canvas behavior. `physicPaintRotoDurableCore.test.ts` passed five consecutive complete-file runs (5 files / 230 tests total). The corrected Debug 08 matrix passed 8 files / 206 tests with 19 existing todos; Studio architecture passed 2 files / 107 tests; the complete Physics Paint matrix passed 42 files / 558 tests with 19 existing todos. Typecheck, production build, and `git diff --check` passed.
  implication: The persisted timing blocker is resolved without production readiness changes, sleeps, polling, assertion weakening, or Vitest configuration changes. Debug 08 is automated-ready for native UAT only; no UAT acceptance is recorded.
- timestamp: 2026-07-13T22:18:00Z
  checked: complete mounted harness lifecycle and readiness helpers
  found: `flushStudioReady` is a bounded retry loop over the stale text `Engine not ready`, but production readiness is exposed as `missingConditions` with exact messages `Engine is still initializing` and `Canvas is still mounting`. The helper can therefore return before the mounted Studio is ready. The same test shim exposes a deterministic existing signal: `EfxPaintCanvas` invokes `onEngineReady(mountedEngine)`, and `PhysicsPaintCanvasMount` then invokes `onCanvasMounted(true)` plus the Studio engine callback. Cleanup does unmount every tracked root before clearing mocks/globals, and the launch-listener test proves listener disposal reaches zero; no production listener leak is yet observed.
  implication: The leading hypothesis is a test-only readiness helper waiting on obsolete text rather than the existing engine/canvas-ready callbacks. Confirm causally by instrumenting the harness signal and using it as the sole readiness gate.
- timestamp: 2026-07-13T22:10:00Z
  checked: corrected-contract verification after the mounted generated/empty mutation-intent tracer passed
  found: The selection-kind production guard is confirmed at the mounted public boundary: generated display 4 and true-empty interpolation-OFF display 10 emit no apply payload, preserve durable keys, and gain no real cache ownership. Focused architecture assertions were updated from the obsolete generated-only API to the canonical `real-key | generated-interpolation | empty` contract. Typecheck, production build, and `git diff --check` pass.
  implication: The production correction is sound, but the required matrix is not yet green because the broader mounted durable-core file remains timing-sensitive.
- timestamp: 2026-07-13T22:08:00Z
  checked: complete `physicPaintRotoDurableCore.test.ts` reruns after correcting stale test fixtures
  found: Three stale fixtures assumed empty displays could be created by Save current. The basic save fixture was corrected to launch on an existing real key, and the far-save fixture now includes real key 14 plus its 3→14 spacing override. Each far-save ON/OFF case passes when focused, but repeated complete-file runs still fail nondeterministically in one or two mounted save cases with zero apply payloads or incomplete readiness assertions.
  implication: This is a precise automated-gate blocker in the mounted test harness/readiness lifecycle, not a reproduced onion/projection/persistence product divergence. Debug 08 cannot yet be declared automated-ready.
- timestamp: 2026-07-13T21:10:00Z
  checked: corrected focused Vitest invocation
  found: The harness blocked the exact command pending user approval, so no valid product assertion result is available yet.
  implication: This is a human-action checkpoint. Production remains unchanged until the corrected tracer runs.
- timestamp: 2026-07-13T21:08:00Z
  checked: parameterized mutation-intent test callback at physicPaintRotoDurableCore.test.ts:2293
  found: Each case object includes `label`, but the callback destructured only `display` and `interpolationEnabled` while line 2296 interpolated `label`. The callback now destructures `label`; no production file was changed.
  implication: The focused rerun can now produce a valid product RED or GREEN at the mounted public boundary.
- timestamp: 2026-07-13T21:05:00Z
  checked: human-action result for the focused mounted mutation-intent tracer
  found: Both parameterized cases failed before product assertions with `ReferenceError: label is not defined` at `physicPaintRotoDurableCore.test.ts:2296`. This is an invalid test-harness RED caused by an out-of-scope test-only variable reference.
  implication: Correct only the test callback variable binding and rerun the focused tracer. Production code remains frozen unless a genuine contract assertion then fails.
- timestamp: 2026-07-13T21:00:00Z
  checked: existing mounted generated/true-empty mutation-attempt tracer
  found: The tracer is already present in `physicPaintRotoDurableCore.test.ts` and exercises the mounted Studio public boundary for generated display 4 and true-empty interpolation-OFF display 10. It injects edited engine state, fires canvas PointerDown and Save current, then asserts zero apply payloads, unchanged durable source keys, and no real-key cache ownership at the selected display. The focused Vitest invocation was blocked by the harness pending Bash approval.
  implication: No further test edit or production edit is justified until this exact red-capable tracer is run. User approval is the only current blocker.
- timestamp: 2026-07-13T20:30:00Z
  checked: human-action checkpoint result for corrected mounted true-empty tracer
  found: The corrected focused command passed all four mounted cases. Empty selections before the first key, between real keys with interpolation OFF, and after the final key rendered the correct surrounding real onions, loaded no current preview base, created no apply payload or durable key, and had no cache frame at the selected display. The edited source-keyed false-anchor case also passed.
  implication: The prior display-10 RED was invalid because that display was generated by the configured 3→14 segment. Preserve the production current-preview/onion path unless a new genuine mounted/public RED appears; proceed with contract-matrix expansion and required verification.
- timestamp: 2026-07-13T20:12:00Z
  checked: corrected mounted/public empty-selection tracer setup
  found: Replaced the mislabeled generated-display case with actual empty selections before the first key, between real keys with interpolation OFF, and after the final key. Each asserts surrounding real onions, no current preview base, no apply payload, unchanged durable keys, and no cache identity at the selected display. The exact approved focused command was requested twice but the harness still reports that Bash approval is required.
  implication: No production code has been changed for this reopened contract. The next valid TDD decision depends on running the corrected true-empty tracer, not on the earlier generated-display failure.
- timestamp: 2026-07-13T20:08:00Z
  checked: exact canonical projection for the mounted RED's selected display 10
  found: The test config defines source segment 3→14 with `inBetweenCount: 4`; its canonical real displays are D=9 and E=14, so display 10 is the first generated interpolation owned by D, not an empty selection. `findCachedRotoDisplayFrame` correctly selects the generated display-10 payload and the loader calls `setPreviewBaseImageUrl(D)`; repeated calls reflect load lifecycle, not surrounding-candidate aliasing.
  implication: The observed RED contradicts the test name rather than production. Strict TDD requires moving the tracer to actual empty before/between/after displays before any production correction.
- timestamp: 2026-07-13T19:02:00Z
  checked: corrected product contract against existing mounted coverage
  found: Existing mounted Debug 08 tests cover real display 14 and generated displays 4/12/20, but no empty selected positions before, between, or after real keys. The current automated-ready conclusion therefore cannot falsify empty-selection suppression or current-payload-dependent anchor lookup.
  implication: Reopen investigation in place and trace real/generated/empty mounted paths before any new production edit.
- timestamp: 2026-07-13T19:08:00Z
  checked: pure selector and mounted Studio onion call site
  found: `projectRotoOnionPreviewFrames` has only one selection-related early return (`isPlaying`); it does not classify or require a current real/generated/empty payload. `PhysicsPaintStudio` invokes it unconditionally for the selected display and supplies full launch/store arrays plus local preview/dirty state. Anchor lookup is not bounded to the visible 120-cell timeline window.
  implication: Empty/generated overlay suppression is not caused by an explicit selector early exit or a current-payload requirement. Remaining corrected-contract risk is candidate identity mixing and the separate edit/save path for empty selections.
- timestamp: 2026-07-13T19:18:00Z
  checked: mounted/public-boundary TDD tracer setup
  found: Added mounted tests for empty display 10 resolving D/E without a selection-created durable key, and for edited projected B never becoming its own previous onion through a source-keyed local preview. No production code was changed for the corrected contract. Three attempts to run the focused Vitest command were blocked by the harness pending Bash approval.
  implication: Strict TDD correctly blocks production edits until the mounted tracer is actually observed RED; user approval of the focused pnpm/Vitest command is the only current checkpoint.
- timestamp: 2026-07-13T12:12:00Z
  checked: canonical source/display projection and store cache generation
  found: rotoSourceDisplayModel delegates all projection to getExpandedRotoRealKeyFrames; physicPaintStore regeneration uses that same projection for real display keys and generated metadata, and getRotoCacheFrames exposes the merged display sequence.
  implication: Workflow timeline and Physics Paint cached preview share one spacing implementation; custom segment parity should be tested rather than rewritten.
- timestamp: 2026-07-13T12:13:00Z
  checked: onion candidate construction
  found: projectRotoOnionPreviewFrames rejects every explicit non-real source before anchoring, uses displayFrame/appFrame for real-key anchors, and merges launch/store/dirty preview frames by display identity.
  implication: Generated cache frames cannot become onion anchors through this selector; distant projected real keys remain eligible.
- timestamp: 2026-07-13T12:14:00Z
  checked: persistence serialization boundary
  found: physicPaintStore.toMceOutputs serializes _getCombinedRotoMetadata into roto_cache_metadata; that combined map includes _rotoGeneratedCacheMetadata even though generated render frames are excluded from durable _frames.
  implication: A direct contract divergence candidate exists: generated render-only metadata is persisted and rehydrated, contrary to the non-persisted requirement. This requires a genuine RED regression test before production change.
- timestamp: 2026-07-13T12:02:00Z
  checked: session and repository state
  found: Debug 08 is an untracked active session on clean branch phase-36.13-debugs; no Debug 01–07 production changes are pending.
  implication: Investigation can audit current committed behavior without confounding local production edits.
- timestamp: 2026-07-13T12:03:00Z
  checked: project/debugger skill rules
  found: Audit must establish a deterministic red-capable Vitest seam before production edits; Preact changes must preserve existing architecture and avoid effect/state duplication.
  implication: Consumer tracing and exact literal truth-table tests precede any fix.
- timestamp: 2026-07-13T12:36:00Z
  checked: first focused test invocation
  found: `pnpm --dir app vitest run ...` failed before Vitest with EACCES because pnpm interpreted the app directory as the executable.
  implication: This is not RED evidence about product behavior; rerun using `pnpm --dir app exec vitest run ...`.
- timestamp: 2026-07-13T15:42:00Z
  checked: focused Debug 08 A/B/C/D/E/F store persistence and hydration regression
  found: Genuine RED. `toMceOutputs` returned 29 metadata entries instead of six durable real keys, including all generated displays and trailing generated displays 27/28 after final real F at display 26.
  implication: Both candidate divergences are directly observed at the public store seam: generated metadata is persisted, and projection generates a source-less final tail.
- timestamp: 2026-07-13T15:51:00Z
  checked: fixes and automated verification
  found: Projection now emits generated frames only between adjacent real keys; serialization writes only durable real metadata and explicitly persists the override array; hydration ignores generated metadata and regenerates from real keys/settings. Focused Debug 08, onion, workflow, store, preview, and export tests pass. Complete Physics Paint matrix passes 42 files / 541 tests with 19 existing todos. Typecheck, production build, and `git diff --check` pass.
  implication: Debug 08 was automated-ready for the first native UAT; the subsequent onion rejection reopened this session.
- timestamp: 2026-07-13T17:38:00Z
  checked: generated display 4 at launch-cache, pure-selector, and mounted-render boundaries
  found: The launch cache contains generated display 4 with B payload, and `projectRotoOnionPreviewFrames` returns surrounding real B/C for the exact launch/store inputs. The generated current payload is loaded into the engine preview base. After the test commits each controlled checkbox update and reacquires the rerendered input, the mounted Studio renders both B/C anchors.
  implication: Canonical candidates, generated current preview, and mounted surrounding-real rendering are correct. The earlier empty-overlay result was a stale controlled-input test-harness artifact.
- timestamp: 2026-07-13T17:42:00Z
  checked: complete mounted Debug 08 native onion contract after harness isolation
  found: Six anchor/direction cases pass, including long custom and generated displays 4/12/20. Only four opacity cases fail, all at lookup of the absent `physics-onion-opacity` input.
  implication: The genuine remaining product correction is the missing parent-compatible opacity control, persistence, and alpha wiring; no anchor-selector production change is justified.

## Eliminated

- hypothesis: `projectRotoOnionPreviewFrames.addCandidate` overwrites projected real `appFrame` with durable/source identity because of object spread order.
  evidence: Source constructs `{ ...frame, appFrame: anchorFrame, ... }`, so projected identity wins. Mounted native tests pass for both short projected and distant custom previous anchors.
  timestamp: 2026-07-13T17:35:00Z
- hypothesis: Generated selections suppress onion controls or mounted surrounding-anchor rendering because generated frames are non-editable.
  evidence: Launch/pure selector return surrounding anchors, generated current payload loads into the engine preview base, and the mounted test renders B/C, D/E, and E/F once controlled checkbox events are committed against current DOM nodes. The prior empty result came from firing sequential state changes through stale pre-render input elements.
  timestamp: 2026-07-13T17:42:00Z

## Resolution

root_cause: Debug 08 contained multiple downstream parity defects. Projection generated a source-less tail after the final real key; generated metadata crossed the durable persistence boundary; Physics Paint lacked parent-compatible onion opacity; the onion overlay rendered below the opaque second engine canvas; untagged generated/local preview displays could consume Onion Value slots; and generated selections traversed from their display position instead of their owning real key, causing the owner paint to consume Value 1 while already visible as the current preview.
fix: Stop final-tail generation, persist only durable real-key metadata, regenerate generated cache from real keys/settings, add the shared 0..100 Onion Value control and alpha wiring, place onion composition above both engine canvases, seed anchor identity only from canonical real keys, allow dirty previews to replace only an existing real-key payload, and use a generated frame's canonical owner source key as the onion traversal pivot. Generated/empty selections remain render-only and non-durable.
verification: Final complete Physics Paint matrix passes 40 files / 537 tests with 19 existing todos. Focused real/generated/empty onion, key-depth, generated-owner, opacity, persistence, preview/export, and mounted durable-core contracts pass. Typecheck, production build (1,086 modules), and `git diff --check` pass. User completed native UAT and stated all behavior works, Debug 08 is finished, and Phase 36.13 is approved.
files_changed:
  - /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/roto/physicsPaintRotoWorkflow.ts
  - /Users/lmarques/Dev/efx-motion-editor/app/src/stores/physicPaintStore.ts
  - /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/roto/physicsPaintRotoWorkflow.test.ts
  - /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/roto/rotoOnionPreview.test.ts
  - /Users/lmarques/Dev/efx-motion-editor/app/src/stores/physicPaintStore.test.ts
  - /Users/lmarques/Dev/efx-motion-editor/app/src/lib/previewRenderer.test.ts
  - /Users/lmarques/Dev/efx-motion-editor/app/src/lib/exportRenderer.test.ts
  - /Users/lmarques/Dev/efx-motion-editor/app/src/lib/physicPaintBridge.test.ts
  - /Users/lmarques/Dev/efx-motion-editor/app/src/lib/physicPaintRotoDurableCore.test.ts
  - /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/roto/rotoOnionPreview.ts
  - /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
  - /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts
  - /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.test.ts
  - /Users/lmarques/Dev/efx-motion-editor/app/src/lib/frameMap.test.ts
