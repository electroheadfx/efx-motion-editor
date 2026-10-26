---
status: resolved
trigger: "Watercolor script/render split on Loop Clip frames: paint is recorded but not rendered, and a script re-bake replaces the frame's cached rail paint."
created: 2026-10-26
updated: 2026-10-26
---

# Debug Session: watercolor-loop-render-split

## Symptoms (user-supplied, confirmed)

- **Expected behavior:** A paint stroke and the frame's cached rail paint are one consistent render. Painting on a cached rail/Loop Clip frame shows the wash after settle and keeps the rail paint. Select/move/transform/delete updates the render while keeping the rail paint. Empty-script keys keep Water Select/Cmd and Brush Move disabled; the first recorded stroke enables them; deleting the last stroke disables them again. Reopening Studio renders exactly the same frame — no phantom guides, no doubling, no erased paint. No automatic span purge; frameOverrides preserved.
- **Actual behavior:** On a Loop Clip frame rendering cached rail paint with no Water color script (frame 6 of Paint 4), one Water color stroke is recorded in the aquarelle timeline (mutationId 372, playFrame 6, 22 points, bounds x 0.366..0.963, y 0.398..0.629) but the canvas keeps showing only the cached rail paint — the stroke is invisible. Select/Move arms because a script now exists. Selecting/moving re-bakes a stroke-only sheet; before the revert it replaced the frame's cached paint and erased the rail paint; after 7fc6304e the edit is refused instead.
- **Errors:** none reported.
- **Timeline:** User-confirmed 2026-10-26 — since Loop Clip frameOverrides existed. This is not a regression; loop/override frames have always had this display/publish split.
- **Reproduction:** Native Studio on test project. Go to frame 6 of Paint 4 (cached rail paint, no Water color script) and paint one Water color stroke. The timeline records it; the canvas keeps the cached rail paint. Then arm Select/Move (Cmd) and move the stroke; the re-bake path either publishes a stroke-only sheet (pre-revert) or is refused (current).

## Direction (user-confirmed)

- Goal: **find and fix, UAT-gated**. No fix commit until the disk report proves the operative hypothesis AND the user validates the native result.
- **Focus first on the paint-added-but-not-rendered path (H1/H2)**. It creates the phantom. The move-erases path (H3/H4) is the second half of the same invariant and is addressed only after the paint path is proven.
- Instrument before patching. `tdd_mode` is on, but the project law is: validate the live behavior first, then pin regression tests.

## User Laws (hard constraints)

1. **NO SCRIPT on the current key -> NO MOVE/EDIT.** Brush Move greyed; Water color Select greyed and Cmd inert. Painting is always allowed; the first recorded stroke re-enables Select/Move.
2. **Never mass-purge scripts.** frameOverrides at app frames 11 and 15 are real user content. An earlier rail-span migration deleted two scripts; frame 15's script is unrecoverable and its pixels remain. Do not restore it, and do not reintroduce any span purge or retained-union drop.
3. **"Purge is not a solution. A script is content; if it exists it must render."** Avoid phantom strokes. Added strokes are acceptable; added script without rendering is the bug.
4. Do not push; the user drives remote operations.
5. Do not start the dev server; the user runs native UAT. Do not use Chrome DevTools MCP; read the app-written /tmp reports from disk.
6. Preact + @preact/signals only. Run tests with `pnpm exec vitest run` from `app/`; never watch mode.

## Architecture (pre-mapped — verify line numbers, do not re-derive)

### Live paint capture (primary path)
- `PhysicsPaintStudio.tsx:6376` `handleAquarelleCaptureFrame(playFrame, snapshot)`:
  - eager snapshot of the live sheet, then `measureAquarelleCanvasInk(liveAlphaCanvas)`; **early return when `ink < AQUARELLE_MIN_CAPTURE_INK`** (no log) — a silent phantom source.
  - session base: if `aquarelleMergeBaseRef.current?.appFrame !== playFrame`, snapshot `findCachedRotoDisplayFrameRef.current(playFrame)`; otherwise reuse. The base is pinned to the sheet start by design (idempotent re-captures, no pigment compounding).
  - `rotoPersistenceRef.current.captureLivePixels({ appFrame, liveAlphaCanvas, cachedBase, mergeBlend: 'multiply', size })`.
  - one retry only when the capture resolves false and no newer capture for the frame owns the cache.
- `useRotoFramePersistenceCoordinator.ts:528` `captureLivePixels`:
  - `identityKey = resolveRotoLivePixelIdentityKey(document, capture.appFrame)` — **returns null for empty / unresolved-group / ambiguous-group**, in which case capture resolves false immediately at line 564 and nothing is enqueued.
  - identity for group frames = `group:<groupId>:phase:<cycleOffset>`; ordinary = keyId.
  - `produce`: `mergeCachedRotoAlphaFrame(cachedBase, liveAlphaCanvas, ...)` when a base exists, else `encodeRotoFrameFromCanvas(liveAlphaCanvas)` (replace).
  - `commit` → `upsertCachedFrame` → `routeRotoPhysicalPaintFrame` at `:150`.
- `routeRotoPhysicalPaintFrame` (`:150`):
  - ordinary-key → `updateOrdinaryKey`; failure reasons `stale-target`, `lease-or-settlement-rejected`.
  - unresolved-group → `unresolved-target`; ambiguous-group → `ambiguous-target`; empty → `empty-target`.
  - source-occurrence / override / generated-occurrence / group-gap → `executePhysicalEdit({ operationKind: 'paint-group-frame', groupId, appFrame, overrideKeyId, renderedPayload })`, returns `group-frame` ok only when the edit is accepted. A new override key is created unless the target is an existing override.
- `upsertCachedFrame` (`:461`) returns false on any route failure; on `group-frame` it returns **true immediately** — group COW publication, cache settlement, canvas reconciliation, and history are deferred to the matching physical ack.

### Script Apply / move re-bake (second half)
- `PhysicsPaintStudio.tsx:6011` `handleAquarelleMoveStrokes` resets the sheet and calls `rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(frame))`.
- `physicsPaintRotoPlayScriptController.ts:1858` `applyAquarelleEventsToKey` bakes a FRESH sheet from the events and calls `input.publish({ keyId, appFrame, bytes, ... })` directly — **no cached-base composite**. This is H3's mechanical path.

### Display lookup
- `useRotoReferenceController.ts:115` `findCachedRotoDisplayFrame`: `getPhysicalRenderSource(appFrame)` → `findAcceptedRotoPhysicalFrame`; `loop-placeholder` → null; real/generated → `projectPhysicalSource` (with dirty/preview substitution). The coordinator wraps the source in `rejectRotoLoopPlaceholderSource` (`:245`).
- The displayed frame comes from the physical cache; the recorded timeline is NOT replayed on frame arrival. `AquarelleCanvasLayer` wipes the sheet on every frame change.

### Classification
- `roto/physicsPaintRotoGroupLifecycle.ts` `classifyPhysicPaintRotoGroupFrameTarget` yields ordinary-key / source-occurrence / generated-occurrence / override / group-gap / empty / unresolved-group / ambiguous-group, with groupId, cycleOffset, sourceKeyId/keyId.
- `resolveRotoCompletedGroupPaintTarget` (`useRotoFramePersistenceCoordinator.ts:98`) is the sibling mapping used by completed Group Paint.

### Prior resolved session — mandatory context
- `.planning/debug/resolved/watercolor-clears-cached-paint.md` (2026-10-18): the aquarelle sheet is MODE.transparent **opaque transmittance**; it must be merged over the key's cache with **MULTIPLY** (`mergeBlend: 'multiply'`), never source-over, and never with `cachedBase: null` (that produced a destructive replace). The session base is snapshotted once per sheet and must never advance (double density). That fix rides `captureLivePixels` + `mergeCachedRotoAlphaFrame`.
- Its documented caveat: while the watercolor module is active, `excludeActive` hides the active track from the program monitor, so pre-existing paint is not visible under the live sheet during the stroke; only the rebuilt cache shows it after leaving watercolor. This is about the UNDER-paint, not the new stroke.
- Report correction: in `moveProvenanceCapture.ts`, `store.hasEntry` is the **session Brush script store** (`getBrushScriptFrameEntry`), not the pixel cache. `hasEntry:false` does NOT prove the physical capture failed.

### Existing instrumentation convention
- `performance/moveProvenanceCapture.ts` writes `/tmp/efx-move-provenance.json` via `exportWritePng` (DEV only), bumps `MOVE_PROVENANCE_BUILD` per diagnostic revision, and writes a build beacon to `/tmp/efx-build-check.json`. A stale window is distinguishable from a bug.
- Build quick-261026-odd-diag-6-render-target produced the existing owner-resolve evidence. The build marker MUST be bumped for the new report so a stale window is detectable.
- Test project: `/Users/lmarques/Desktop/efx-motion-editor-project-test/test.mce`; layer 7bcc71b6-816d-4b26-8b86-20c37f39787a; track Paint 4 `00a78810-6b85-4141-9779-7f8e94e6d706`; Loop Clip placementStart 6, 10 sourceKeyIds (frames 6..15), repeat 1, progressive, frameOverrides at app frames 11 and 15. Snapshot: `test.mce/scripts/<layer>/<track>-v1.snap` (v2 container). Snapshot on disk after the earlier purge: frames 6..15 have no watercolor/brush scripts; frames 0..4 retain watercolor events. Do not trust old reports; re-capture.

## Hypotheses (prove with instrumentation; do not patch before proof)

- **H1 — live capture merge/identity failure (primary).** Sub-variants, all consistent with "script recorded, rail paint intact, stroke invisible":
  - H1a: `findCachedRotoDisplayFrame(playFrame)` returns null/wrong key on a Loop Clip frame → base null → stroke-only payload. (Would erase on a successful publish, so pair with a refusal/drop to match the observation.)
  - H1b: the live sheet has near-zero ink at capture (`AQUARELLE_MIN_CAPTURE_INK` gate) → capture early-returns, no report trail today.
  - H1c: `resolveRotoLivePixelIdentityKey` returns null (empty/unresolved/ambiguous classification) → capture never enqueues.
  - H1d: correct base and identity but the transaction produce/commit is dropped (revision change, gate, retry exhaustion).
- **H2 — publish/ack/display reconciliation (primary).** `routeRotoPhysicalPaintFrame` refuses (stale-target / lease-or-settlement-rejected), or returns `group-frame` ok but the physical ack never lands or the canvas keeps reading the old key/payload. Must report route kind/keyId, executePhysicalEdit result, and the key the canvas reads after the ack.
- **H3 — script re-bake replaces the payload (secondary).** `applyAquarelleEventsToKey` publishes a stroke-only sheet. Correct fix direction: composite the re-baked sheet over the frame's pixel-only base with the same multiply semantics, then publish the composite — but only after the paint path establishes what the durable base is.
- **H4 — the base is not durable (design gate).** The override payload is a flattened composite; a later session cannot separate rail paint from script paint (merge doubles, replace erases). A composite fix is not acceptable until a stable base is preserved or derived (e.g. the group's source key at the cycle offset, or a preserved base track).

## Eliminated

- hypothesis: H1a–H1d / H2 on an existing-override frame (capture merge/identity/publish/ack failure)
  evidence: run 1 paint chain complete — ink gate passed, base 7c98, multiply merge e02e, route group-frame ok, ack revision 5ef16d55, display e02e
  timestamp: 2026-10-26 19:41
- hypothesis: a target-only fix would suffice (retarget without compositing)
  evidence: move bake ink 4.85 vs display 9.41 — a stroke-only publish over the flattened composite erases the rail paint; run 2 confirmed baseResolved+composed on every edit
  timestamp: 2026-10-26 19:42 / 20:11
- hypothesis: aquarelle guide groups alone cause the script-less-cache ownership
  evidence: purgeAquarelleGuideGroups already runs on every non-live resolve; legacy null-keyId rows, foreign-key rows and non-hydratable rows reproduce the same owner/lock with no guide group present
  timestamp: 2026-10-26 21:26
- hypothesis: Move entry deletes a partial store entry when the engine is empty
  evidence: flushBrushScriptFrame early-returns when an entry exists and the frame is clean (brushScriptRecordState.ts:339); the defect is 'enabled but no handles', not deletion
  timestamp: 2026-10-26 21:26
- hypothesis: the snapshot restore blesses legacy rows with the current key identity
  evidence: restore passes the decoded keyId explicitly (null for v1) and captureEntry keeps it; the key provider fires on live captures only
  timestamp: 2026-10-26 21:26
- hypothesis: a missing `bumpAquarelleStrokesRevision` on a clear / rail-bake path explains the run-4 stale Water gate
  evidence: full audit — every `payloadTimeline`/deleted-id mutator bumps, no code outside the record module mutates the timeline, and run 4's timeline was never cleared (the frames-0/3 scripts stayed session-side). The gate froze on the retired signal graph after `useRotoTimelineModel` rebuilt it; the fresh read is false while the cached computed value stayed true.
  timestamp: 2026-10-26 22:20

## Instrumentation to build (DEV report to /tmp, exportWritePng JSON convention)

Write a report for **each paint capture** and **each script Apply/move** to `/tmp/efx-aquarelle-render-split.json` (new build marker, e.g. `debug-watercolor-loop-render-split-1`), including:

1. `event`: `paint-capture` | `script-bake`; timestamp; build marker.
2. `frame`, `cellKind`, `cellKeyId`, `cellInsideRail`, module/tool.
3. Classification: `classifyPhysicPaintRotoGroupFrameTarget` kind, groupId, cycleOffset, sourceKeyId/keyId; `resolveRotoLivePixelIdentityKey` result (null or group-phase key).
4. Displayed render source: `getRotoPhysicalRenderSource(frame)` kind + keyId; `findCachedRotoDisplayFrame(frame)` keyId/contentRevision; byte digest + ink of the displayed cache.
5. Capture entry: snapshot present, `measureAquarelleCanvasInk`, `AQUARELLE_MIN_CAPTURE_INK` pass/fail; whether the session base was freshly snapshotted or reused; base keyId/null, byte digest, ink.
6. Publish: `route` kind + keyId/groupId + `ok/reason`; `executePhysicalEdit` accepted boolean; `upsertCachedFrame` result; live-pixel transaction enqueue/produce/commit stage reached and any rejection reason.
7. Post-ack: displayed keyId/contentRevision + byte digest/ink after the physical ack; whether the canvas reads the new or old payload.
8. Script: `getAquarelleEventsForFrame(frame)` count; for the bake path, bake source keyId, target keyId, published bytes digest/ink, publish result.

Then request **ONE native paint+select on frame 6** from the user and read the report from disk. Do not ask for a second run until the first report is analyzed.

## Evidence on hand (from the user; do not extrapolate)

- `/tmp/efx-move-provenance.json` build quick-261026-odd-diag-6-render-target, frame 6 owner-resolve:
  - cellKind real, cellKeyId a23d4568-..., cellInsideRail true; module watercolor; hasScript true; one event (mutationId 372, playFrame 6, 22 points, brushId round, on-canvas bounds).
  - `store.hasEntry:false`, `engine.strokeCount:0` — these prove the Brush script store/engine is empty; they say nothing about the physical pixel cache.
  - overlayArmed `{selectMode:false, heldArm:true}` (Cmd held); moveAvailable false (Brush gate); railCleanup null (purge paths removed).

## Evidence (investigation)

- timestamp: 2026-10-26 20:38 (instrumentation revision)
  checked: `tsc --noEmit` + `pnpm exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts` after the probe edits; probe install site; on-disk report presence
  found: typecheck clean; 280/280 Studio contract tests pass (contract literals preserved: ink gate, merge-base check, `const work = enqueue()`, settle condition); `installAquarelleRenderSplitProbe()` runs inside the same DEV engine-ready block as the Move probe (PhysicsPaintStudio.tsx:5762); report /tmp/efx-aquarelle-render-split.json, beacon /tmp/efx-aquarelle-render-split-build.json; Move provenance build bumped to quick-261026-odd-diag-7-render-split; neither new report exists yet — the last /tmp/efx-build-check.json is 20:19, the pre-instrumentation diag-6 run
  implication: diagnostic build is sound and self-identifying; one native paint+select run is the only missing input. No product behavior has been changed.

- timestamp: 2026-10-26 19:40:16Z (native run 1 launch; build beacon debug-watercolor-loop-render-split-1)
  checked: user ran ONE paint+select on Paint 4 frame 6 (`test.mce`): red cached stroke, no script, Select/Move disabled; painted one blue Water color stroke; waited 10 s; moved the blue stroke; waited 10 s
  found: user confirmed red-only frame was not editable; after the blue stroke BOTH red and blue were visible and editable; the move visibly changed the editor overlay but the rendered pixels stayed at the OLD blue position. Report: 24 events, chain complete.
  implication: paint path rendered; move path failed.

- timestamp: 2026-10-26 19:41:44–19:41:45Z (paint capture chain, frame 6)
  checked: studio-capture-entry -> capture-base -> coordinator -> produce -> route -> settlement -> post-ack display
  found: ink 2.8 passes gate (min 1). Classification `override`, group b8575ac4-354c-4ef3-8c5b-8bdd91faab4f, key c8923fa3-ad68-4100-89be-37898407c63c, cycleOffset 0, repeatInstance 0. Base = displayFrame c8923fa3, digest 7c98:ab229f75, bytes 31896, ink 6.67 (the red rail paint). Produce used merge, blend multiply, digest e02e:91c1dff5, bytes 57390, ink 9.41. Route ok `group-frame`, overrideKeyId c8923fa3. Physical finalize accepted revision physical-6939-5ef16d55, affectedFrames [6], selectedKeyId a23d4568. Bridge display = key c8923fa3, revision 5ef16d55, digest e02e:91c1dff5, ink 9.41. RepaintBase after ack = a23d4568, digest 7c98:ab229f75 (source key still holds the red-only base).
  implication: H1a/H1b/H1c/H1d and H2 are REFUTED for a frame whose override already exists. Session base, multiply merge, identity key, group publish, ack, and display reconciliation all worked. The source key a23d4568 is confirmed as the red-only durable base for this frame.

- timestamp: 2026-10-26 19:42:47–19:42:50Z (script move chain, frame 6)
  checked: script-move-entry -> bake target -> route -> publish result -> display after publish
  found: move dx +24.5 px, dy -126.8 px. `bakeTargetKeyId` = a23d4568-06a6-4759-9791-cdf9871b64ae (the SOURCE key), 2 events. Bake digest 9e4e:513daea6, bytes 40526, **ink 4.85** vs display ink 9.41 -> stroke-only sheet. Route classification `override` key c8923fa3, but expectedKeyId a23d4568 -> `{ ok:false, reason:'stale-target' }`. script-bake-result ok:false; display unchanged e02e:91c1dff5 ink 9.41; UI error "Apply Script could not paint the aquarelle wash."
  implication: H3 CONFIRMED mechanically — the re-bake resolves the source key on an override frame and is rejected as stale-target. Retargeting alone would publish a stroke-only sheet (ink 4.85) over the flattened composite (ink 9.41), erasing the red rail paint — exactly the pre-revert destruction. The fix must change BOTH the target (override/display key) and the payload (re-baked sheet composited over the durable red-only base with multiply).

- timestamp: 2026-10-26 19:42:50Z (open question after run 1)
  checked: original phantom scenario coverage
  found: run 1 exercised a frame that ALREADY had an override (`classification: override`). The original phantom evidence had `cellKeyId a23d4568` (source key) and no override. The paint-added-but-not-rendered defect may still exist on a source-occurrence frame (no override yet), where the group edit must create a NEW override and the display must switch to it.
  implication: do not close H1/H2 globally on run 1 alone. A targeted second paint test on a frame with cached rail paint and NO override (e.g. frame 7, or another source-occurrence frame) is required to prove or refute the original phantom. The fix design must cover both target kinds.

- timestamp: 2026-10-26 (axis-1 code proof — exact source of a23d4568)
  checked: `getSource()` (PhysicsPaintStudio.tsx:1654-1659) → `currentPhysicalCell.keyId`; `buildProjectionFromMapping` (physicsPaintRotoPhysicalResolver.ts:3505-3575) builds cells ONLY from `realKeyRecords`; `dispatchApply` (physicsPaintRotoScriptClipboard.ts:956-995) → `prepareTarget` (PhysicsPaintStudio.tsx:2975-3002) resolves `getRotoRealKeyRecord(source.keyId)`; publish (PhysicsPaintStudio.tsx:1695-1724) forwards `frame.keyId` as `expectedKeyId`; `routeRotoPhysicalPaintFrame` (useRotoFramePersistenceCoordinator.ts:157-223) override branch expects the override key.
  found: Group overrides live in `groupOverrideRecords`, NOT `realKeyRecords` (`getRotoRealKeyRecord` falls back there, physicPaintStore.ts:4350-4354). So on an override frame the projection cell — and therefore `getSource().keyId` — is the underlying SOURCE key a23d4568, not the display key c8923fa3. `prepareTarget` validates that source record and returns it as the Apply target; `applyAquarelleEventsToKey` publishes that key as `expectedKeyId`; the route classifies the frame `override` (key c8923fa3) and returns `stale-target`. LATENT SECOND DEFECT on the same line: `prepareTarget` compares `record.appFrame === source.appFrame`, but a source/override record's appFrame is the source/phase frame, so on any repeat instance where they differ, prepareTarget returns null before the route (generic "could not prepare the physical destination").
  implication: axis 1 is a TARGET-RESOLUTION defect, not a bake or route defect. The source snapshot must stay source-key-based (it feeds copy availability, drain/flush, engine identity); the lifecycle mapping belongs in `prepareTarget`.

- timestamp: 2026-10-26 (axis-2 code proof — the re-bake publish has no base composite)
  checked: `applyAquarelleEventsToKey` (physicsPaintRotoPlayScriptController.ts:1858-1900) bakes `frameCount: 1` and publishes `last.bytes` raw; the Studio publish callback (PhysicsPaintStudio.tsx:1695-1750) upserts those bytes directly; `mergeCachedRotoAlphaFrame` / `mergeRotoAlphaCanvases` (physicsPaintRotoAlphaMerge.ts:20-60) is the existing multiply machinery; the PlayScript renderer (physicsPaintRotoPlayScriptRenderer.ts:449) composites only the engine-1 source-over path.
  found: the aquarelle publish is a replace; no durable-base read exists anywhere on this path. The existing merge helper takes a base frame (bytes) + a live canvas and supports `blend: 'multiply'` — exactly the capture law.
  implication: the composite seam is the Studio publish callback (the site the 2026-10-26 revert comment names), not the bake controller. Reuse `mergeRotoAlphaCanvases` + `encodeRotoFrameFromCanvas`; do not add a cache system.

- timestamp: 2026-10-26 (durable base derivation + reconstructibility boundary)
  checked: `proposePhysicPaintRotoGroupFramePaint` (physicsPaintRotoGroupLifecycle.ts:93-183) — the only override creator, storing `appFrame = phase.phaseAppFrame`; display lookup (physicPaintStore.ts:4669-4760); `classifyPhysicPaintRotoGroupFrameTarget` (313-442) source-offset law; run-1 post-ack repaintBase (source key a23d4568, digest 7c98, ink 6.67).
  found: every script-edit-reachable group frame has a `real` projection cell, i.e. an override-over-source or a source-occurrence. For both, the durable pixel-only base is the group's SOURCE key payload at the exact `cycleOffset` (run 1: a23d4568 held the red-only 7c98 bytes while the override c8923fa3 held the flattened 9.41 composite). Not universally reconstructible: gap-filled overrides (the pre-override base was null), generated-phase overrides (base was the interpolated render, not exposed by any public read), and source keys edited after override creation. The move gate already excludes generated cells (`currentCell.kind !== 'real'`) and gaps have no real cell.
  implication: scope the composite to exact-source group frames (source-occurrence + override); fail closed when the base cannot be resolved at publish time; ordinary keys keep replace semantics (their script is the key's complete content).

- timestamp: 2026-10-26 (axis-1 option analysis)
  checked: `getSource` consumers (availability COPY/APPLY gates at clipboard:312-346, `captureScriptForPersistence` flush at 526, `applyCurrentScript` at 786-809, `prepareNavigation` at 1158) vs `prepareTarget`/`targetIsCurrent`.
  found: Option A (getSource returns the override key) would make the source snapshot lag lifecycle changes (an override is created by the paint ack mid-session), reintroduce the `phaseAppFrame` comparison, and change copy/engine identity for no benefit. Option B (lifecycle-aware `prepareTarget` returning `keyId` + `sourceKeyId`, and `targetIsCurrent` comparing `currentSource.keyId === (target.sourceKeyId ?? target.keyId)`) keeps getSource untouched and preserves the async currency guard.
  implication: adopt Option B.

- timestamp: 2026-10-26 (two-axis implementation + automated gates)
  checked: axis 1 (`RotoScriptPhysicalTarget.sourceKeyId`/`durableBaseKeyId`; `targetIsCurrent` compares the projection identity; `prepareTarget` classifies and maps ordinary-key / source-occurrence / override, never uses `record.appFrame`; `resolvePhysicPaintRotoGroupSourceKeyIdAtOffset` exact-offset helper shared with the classifier); axis 2 (new `composeRotoScriptRebakeFrame` premultiply decodes the sheet, multiply-merges over the durable base, re-encodes; publish callback composes before upsert, records `script-bake-composite`, and fails closed with `durable-base-unavailable` when the base cannot be read); probe build marker bumped to `debug-watercolor-loop-render-split-2`.
  found: `pnpm exec tsc --noEmit` clean. Touched suites (Studio contract, clipboard, physical resolver, script rebake): `Test Files 6 passed (6) | Tests 617 passed (617)`. Full `src/components/physic-paint` tree: `Test Files 180 passed (180) | Tests 3915 passed (3915)`. New tests pin: override/source-occurrence accept with `sourceKeyId`+`durableBaseKeyId`, currency refusal when the projection source changes mid-resolution, ordinary-key replace (`durableBaseKeyId` null/undefined), composite ordering (decode premultiply → merge multiply over base → encode), fail-closed on decode/merge/context failure, and the `-2` build marker.
  implication: implementation matches the approved design; no commit made (user law: no fix commit before native UAT). The only remaining gate is the native pass below.

- timestamp: 2026-10-26 20:01–20:11Z (native run 2, build debug-watercolor-loop-render-split-2)
  checked: move/apply chain after the fix; all `script-bake-composite` events; route/ack/display after each move
  found: beacon fresh at 20:01:58Z with `-2`. Every move emitted `script-bake-composite` with `baseResolved:true`, `composed:true`, `composedInk > sheetInk` (frame 7: base 13.65, sheet 4.58, composed 18.42; frame 6: base 13.05, sheet 9.51, composed 22.27; final frame 7 move: base 13.65, sheet 14.96, composed 28.81). Move routes all `ok:true kind:'group-frame'` with `expectedKeyId` equal to the override key; `script-bake-result` and `script-move-result` ok:true; every `bridge-result.displayFrame.digest` equals the published payload digest. No `stale-target`, no `durable-base-unavailable`. User: "All seem work."
  implication: the approved two-axis fix holds on the override frames exercised. The paint captures in this run were on EXISTING override frames (6 and 7); the no-override source-occurrence paint row was not exercised, so it remains to be confirmed.

- timestamp: 2026-10-26 (native run 2 user observations — NEW GATING SCOPE)
  checked: user reported two remaining behaviors on script-less cache frames
  found: (A) "the move/editable tool are active when I am on a frame without script" — law 1 violation. Code pointer: `moveAvailable` (PhysicsPaintStudio.tsx:1559) requires `brushMoveAvailable`, `cell.kind === 'real'`, and only rejects a STALE Brush entry; when `getBrushScriptFrameEntry(cell.appFrame)` is null it falls through and returns true. `brushMoveAvailable` is `frameScriptOwner === 'brush'` (frameModuleLock.ts:39). (B) "when a frame without script auto switch on brush mode ... this frame has no editable script its a cache so it should not switch and I should to be able to choose the paint mode: brush or water color for paint on the cache". Code pointer: `applyFrameModuleState` (:1980) switches `activeModule` to the resolved owner; `resolveFrameScriptOwner` (frameScriptOwnership.ts:21) returns 'brush' when `getBrushScriptForFrame(frame).length > 0` (groups) or a live ledger sample, independent of whether those groups are a genuine editable Brush script; `lockedModuleForOwner` then locks the non-owning module in the top bar.
  implication: the main render-split fix is confirmed, but the empty-script gate (acceptance criterion 3) is not met. A cache-only frame must resolve owner null, must not auto-switch the module, must lock neither module (Brush and Water color both selectable for painting on the cache), and must keep Brush Move / Water Select disabled until a real script exists on the current key.

- timestamp: 2026-10-26 21:26 (gating-scope code proof + owner-resolve probe extension)
  checked: `frameScriptOwnership.ts` (resolver body); `frameModuleLock.ts` + `PhysicsPaintTopBar.tsx:107` + `ModuleSwitcher.tsx:42,52` (lock wiring); `moveAvailable` (:1560-1569) and `watercolorMoveAvailable` (:1574-1578); `applyFrameModuleState` and every call site (launch settle :4732, navigation :4212, completion :5896, aquarelle stroke end :6114, clear/purge/raster seams); `studioScriptSnapshotController.ts:287-318` (`withoutForeignKeyFrames`: legacy null rows kept on non-rail frames) and `:340-399` (save union is frame-keyed, session row wins); `brushScriptHydration.ts:129-147` (refusals: no-entry/empty/partial/generated/watercolor/playback/scrub/edit-cost — NO key identity); `brushScriptEditionPort.ts:156-189` (`listBrushScriptStrokes` returns [] unless `engineHoldsBrushScriptFrame`); Move entry seam (:2193-2206: flush only, never attach); key provider (:1907-1915, live captures only); completion live leg (:5896-5899); `/tmp/efx-move-provenance.json` diag-7 storeFrames (frames 0/3/9/13 have `keyId:null`, `liveKeyId` set, 6/3/6/3 real groups, complete true; frame 6 keyId matches and engineHolds true).
  found: the resolver has no cell context, no key identity and no editability predicate — any stored group list counts as a Brush owner; legacy null rows survive restore by design and pass the move stale check (`entryKeyId === null`); a mismatched-key row resolves 'brush' (auto-switch+lock) while Move rejects it (stale) — the two gates disagree; a missing entry falls through to `true` while the owner signal is stale 'brush'; hydration is navigation-only with no key gate, so launch leaves the ledger empty and Move entry never attaches; cached pixels render but `listBrushScriptStrokes` returns no handles when the engine does not hold the frame. The probe now has a resolve-scoped block (`currentFrame` vs `resolve.frame`, cellKind/cellKeyId/liveKeyId, entry keyId/keyMatchesCell/complete/strokes/points/guideGroups/diffusionFrames/hydratable/engineHolds/purged, liveBrush sample, live real/guide strokes, hasWatercolor, publishedOwner, lockedModule, activeModule before/after, all three gate peeks), build `quick-261026-odd-diag-8-script-gate`; `tsc --noEmit` clean; Studio+frameModuleLock+frameScriptOwnership suites 304/304 pass. No product behavior changed.
  implication: ownership and Move must be re-derived from ONE key-bound, editability-bound predicate; Move entry must attach before arming so an enabled Move always has handles. The native retest report will prove which entry path (legacy null / foreign key / non-hydratable) is present on the offending frame.

- timestamp: 2026-10-26 22:10 (F1–F4 implemented + automated gates)
  checked: `view/frameScriptOwnership.ts`, `view/brushScriptHydration.ts`, `PhysicsPaintStudio.tsx` (cell resolver, moveAvailable, applyFrameModuleState, selectTool Move branch, navigation, raster), `performance/moveProvenanceCapture.ts`, and the three touched suites
  found: F1 — `resolveFrameScriptOwner(frame, cell, liveBrush?)` now REQUIRES the projection cell; `storedBrush` counts only a real cell whose keyId is non-null, an entry with groups, `entry.keyId === cell.keyId`, and `isBrushScriptFrameHydratable(entry)`; the live-ledger leg and the watercolor leg keep their previous semantics (watercolor requires a real cell). F2 — `moveAvailable` = `brushMoveAvailable` && real cell && (`storedLeg` key-bound hydratable entry || `engineHoldsBrushMoveStrokes()`); the computed reads `brushScriptRevision.value` so store mutations re-evaluate without a seam republish, and the engine leg is `getStrokeSerials()` (cheap map copy) minus aquarelle-registered guide ids (never `getStrokes()`, a deep copy). F3 — the `selectTool` Brush Move branch flushes, then demand-attaches via `attemptBrushScriptHydration` with the frame's cell keyId when neither `engineHoldsBrushScriptFrame` nor the engine leg holds strokes, captures `move-entry` provenance, and returns without arming if nothing attached. F4 — `BrushHydrationRequest.keyId` + `foreign-key` refusal (null entry id, null request id, or mismatch), placed after the `generated` gate so existing refusal semantics are preserved; navigation passes the destination cell keyId; the raster handler passes the resolved cell. Probe build `quick-261026-odd-diag-9-empty-script-gate`. One contract pin was invalidated and updated: `brushScriptRevision.value` occurrences 1 -> 2 (coalescing effect + Move gate useComputed), with sanctioned-site documentation; `frameScriptOwnership.test.ts` rewritten to the cell-required API plus fail-closed cases (legacy null keyId, foreign key at the same frame, partial, non-real/null cell); `brushScriptHydration.test.ts` gains the foreign-key cases.
  implication: automated gates all green — `pnpm exec tsc --noEmit` clean; touched suites `Test Files 3 passed (3) | Tests 324 passed (324)` (Studio 283, frameScriptOwnership 14, brushScriptHydration 27); full `src/components/physic-paint` tree `Test Files 180 passed (180) | Tests 3920 passed (3920)`. No product change beyond F1–F4; no commit, no dev server, no push. The one remaining gate is the native retest.

- timestamp: 2026-10-26 20:43–20:45Z (native run 3, build diag-9 — ORDINARY-KEY BASE LOSS REGRESSION)
  checked: user painted one Water color stroke on a cached ordinary key (Paint 3, track c4868e73, frame 9, key 83ce7886) and moved it twice; read the aquarelle probe chain and the on-disk key payloads with PIL alpha statistics.
  found: frame 9 classification `ordinary-key`, renderSource real key 83ce7886, base digest 293d8 (168920 bytes), basePresent true, sessionBase fresh pinned 9. The probe's baseInk 943.86 is ALPHA-BLIND: the other Paint 3 key caches are RGBA with ~92–95% transparent pixels (avg alpha 6–14, mean luminance ~5–8), so transparent black RGB inflates the metric. Paint capture: usedMerge true, blend multiply, produced digest 31a9e (203422 bytes), producedInk 42.71; route ordinary-key ok at revision physical-1744-ba8584f; later captures produced the same payload and were refused `lease-or-settlement-rejected`. Move 1: script-bake target 83ce7886, 1 event, bake digest 119d6 (72150 bytes), bakeInk 17.09; route ordinary-key ok; display becomes 17.09. **No `script-bake-composite` event.** Move 2: bake digest 11792 (71570 bytes), ink 16.24; route ok; display 16.24. On disk the key file is now RGB 1080x1080, 71570 bytes, fully opaque, mean luminance 250.2 (near-white stroke-only sheet); the pre-paint 168920-byte payload is overwritten. Other Paint 3 keys remain RGBA transparent paint layers.
  implication: REGRESSION CONFIRMED on ordinary keys. Axis 2 was gated on `durableBaseKeyId` (group frames only); the ordinary-key branch still REPLACES the key payload with the stroke-only bake, erasing the scriptless cached base. The live capture did merge, but the stored aquarelle sheet is opaque transmittance (white background); whether it preserves the base's opaque paint and how the read-seam matte repair handles it must be verified with alpha-aware probes (ink alone cannot tell). The durable base for an ordinary key is the key's cache as of sheet start; same-session moves can use `aquarelleMergeBaseRef`, but reopen needs a persisted or derived base (H4 for ordinary keys).

- timestamp: 2026-10-26 22:25 (run-3 probe chain re-read + code proof — TWO CLARIFICATIONS)
  checked: `/tmp/efx-aquarelle-render-split.json` (73 events, build `-2`) end to end; `handleAquarelleCaptureFrame` (PhysicsPaintStudio.tsx:6724-6895); `AquarelleCanvasLayer` frame-change/session-end path (509-551); `handleAquarelleSheetSessionEnd` (:6984-6987); `prepareTarget` ordinary-key branch (:3184-3188); publish callback (:1743-1790); `handleAquarelleStrokeEnd` (:6245-6262); promotion capture base (:6771-6804); PIL stats of the key files.
  found: (1) LIVE CAPTURE PRESERVES THE BASE — the first paint capture pinned the pre-paint display payload 293d8 (168920 B) as its fresh session base, produced 31a9e (203422 B) with `multiply`, routed ordinary-key ok at revision physical-1744-ba8584f, committed, and the display after commit was 31a9e; the frame-0 key 32725f84 is a transparent paint layer (3.29% opaque, avg alpha 13.07, visible luminance 104.8), matching a transparent-black paint base under an opaque-white transmittance sheet (multiply output = opaque white matte where the base is transparent; stripOpaqueWhiteMatte at the read seam removes it). So the paint path is correct; the opaque-sheet/matte handling is NOT a second cause. (2) THE MOVE PATH IN RUN 3 RAN AFTER NAVIGATION: frame-leave 9→0 at 20:44:21 invokes `handleAquarelleSheetSessionEnd`, which deliberately clears `aquarelleMergeBaseRef`; the later move at 20:44:43 therefore had no live session base even though it was the same Studio launch. A same-session fix must retain the per-key pre-script base across sheet-session ends (a launch-session map), not just read the live ref. (3) The move target was the ordinary key 83ce7886 with `durableBaseKeyId:null`; the publish callback took the replace branch and never emitted `script-bake-composite`. Route/ack succeeded, so the storage layer is not implicated.
  implication: implement a launch-session ordinary-key durable-base map: record the pre-script display payload at the FIRST recorded stroke (checked before `recordAquarelleStroke`) and the clone/blank promotion base after promotion; `prepareTarget` resolves the map (fallback: a frame with no aquarelle events uses its current display payload as the base and records it); the publish callback composites over those bytes with multiply and fails closed when the base is unknown. Reopen persistence remains the deferred decision.

- timestamp: 2026-10-26 22:35 (ordinary-key durable-base implementation + automated gates)
  checked: `PhysicsPaintStudio.tsx` (durable map + launch reset, first-stroke recorder, promotion recording, prepareTarget resolution, publish-callback ordinary branch, raster invalidation); `physicsPaintRotoScriptClipboard.ts` (`durableBaseBytes` contract); `aquarelleRenderSplitCapture.ts` (alpha proof + build `-3`); `PhysicsPaintStudio.test.ts` contract pins.
  found: implemented `aquarelleDurableBaseByKeyRef: Map<keyId, Uint8Array | null>` (launch-scoped, reset on operationId/layerId replacement): (1) the map is recorded at the FIRST recorded aquarelle stroke, BEFORE the event lands, from the key record payload (`requirePhysicPaintRotoInlineBytes`), ONLY when the frame has zero events and the classifier says `ordinary-key`; a frame that already has a script records a refusal (`script-already-present`) and stays UNKNOWN (the reopen case — recording the flattened payload would double the earlier strokes). (2) Promotions record their seeding base (`clone` → the cloned previous-key bytes, `blank` → `null`) inside `promoteRotoPaintTargetRef`, covering both the first-paint promotion and prepareTarget's promotion. (3) `prepareTarget` ordinary-key resolves the map; when the map misses AND no timeline edit is in flight AND the frame has zero events, it records the key record payload as the base (clipboard Apply onto an unscripted cache key); otherwise the base stays `undefined` (UNKNOWN). (4) The publish callback now composites `durableBaseBytes` with the same `composeRotoScriptRebakeFrame` multiply used for group bases, publishes raw only when the entry is `null` (known-empty), and fails closed (`durable-base-unknown`) with NO cache write when the base is unknown; `script-bake`/`script-bake-composite` report `durableBase: group-source-key | launch-map | known-empty | unknown`. (5) Rastering a key deletes its map entry so the next stroke re-pins the rastered pixels. Alpha-aware probes added: `capture-alpha-proof` (already wired), `durable-base-alpha` (pre-script base), `composite-alpha-proof` (base/sheet/composed + `base->composed` retention + 512px PNG dumps) for BOTH group and ordinary composites.
  gates: `pnpm exec tsc --noEmit` clean; touched suites 362/362 (`PhysicsPaintStudio.test.ts` 283, clipboard 75, rebake 4); full `src/components/physic-paint` tree 180 files / 3920 tests pass. One sanctioned pin updated: the raster handler now reads `scriptCell` (needed for map invalidation); the axis-1 pin now asserts the ordinary-key durable-base resolution instead of the retired one-line replace literal; the build-marker pin moved to `-3`.
  implication: the regression's mechanical cause is fixed in the same-session path and the destructive replace is unreachable (unknown → fail closed). The reopen case is now a VISIBLE refusal, not an erase. No commit; the native UAT on build `-3` and the reopen-durability decision are the remaining gates.

- timestamp: 2026-10-26 21:15Z (native run 4, fresh project — MOTION-RAIL GATE)
  checked: user deleted all rails/keys, started fresh, recreated a Motion rail (cache, no script) and reported that Move/Edit was still available ("the detect if the frame has script or not is wrong, it should hide move/edit tool"); read `/tmp/efx-move-provenance.json` (build diag-9) owner-resolve.
  found: frame 8, cellKind `real`, cellKeyId 9df7a7d4-c4c1-40fe-a8b2-5668eb94548d, cellInsideRail true; `store.hasEntry:false`, engine strokeCount 0, `aquarelle.hasScript:false`, eventCount 0; publishedOwner null, lockedModule null, activeModuleBefore/After `watercolor` (no switch), `brushMoveAvailable:false`, `moveAvailable:false`, **`watercolorMoveAvailable:true`**. The same report's fresh `hasWatercolor:false` proves the computed gate is stale.
  implication: `watercolorMoveAvailable` (PhysicsPaintStudio.tsx:1637) is a computed whose only mutation dependency is `aquarelleStrokesRevision`; `hasAquarelleScriptForFrame` is a fresh read over `payloadTimeline` + deleted ids. A clear/replace path (delete all rails/keys, fresh project restore, Motion/Static/Reveal bake) removed the script without bumping `aquarelleStrokesRevision`, so the computed stayed true. The disarm effect (:2461) only fires when the gate flips false, so Water Select stays armed and editable on a scriptless rail cache. Brush Move is correctly false (owner null). This is the user's "detect if the frame has script is wrong".

- timestamp: 2026-10-26 22:20 (run-4 ROOT CAUSE — signal-graph identity freeze; bump audit)
  checked: `useRotoTimelineModel` graph recreation (`useMemo` keyed on the structural inputs; `model.setCurrentFrame` writes only into the CURRENT graph); `@preact/signals` `useComputed` (stable Computed instance, `$compute.current` updated to the latest closure every render); signals-core 1.13 `Computed._refresh` (the `(OUTDATED | TRACKING) === TRACKING` early return plus `needsToRecompute` over the REGISTERED sources); every `payloadTimeline`/deleted-id mutation and clear/restore/purge path (`aquarelleRecordState.ts`, `aquarelleStrokeSelection.applySnapshotContent`, `studioScriptSnapshotController.restore`); run-4 report vs the render-split report.
  found: (1) NO missing `bumpAquarelleStrokesRevision`. Every mutator bumps (translate/move, transform, step, translate batch, delete, purge-frame-if-removed, purge-all-if-removed, restore-stroke, place, remap, reset-if-content, restore-timeline, snapshot-content), and no code outside the record module touches `payloadTimeline`. The run-4 timeline was never cleared — the earlier frames-0/3 scripts remained session-side — so a bump omission was never required to explain the stale gate. (2) THE GATE FROZE ON A RETIRED GRAPH. `useRotoTimelineModel` recreates the WHOLE signal graph when any structural memo input changes (rails/keys deletion and Motion rail creation both do). The Studio's once-created `useComputed` kept the sources its last evaluation registered — the OLD `currentCell` graph, whose signals are never written again. `_refresh` returns the cached value without invoking `_fn`; the gate kept `true` from the earlier scripted frames while the fresh `hasAquarelleScriptForFrame` read the owner report performs (false) never ran inside the gate. `moveAvailable` escaped only because `brushMoveAvailable`/`brushScriptRevision` changed during the reset, forcing one recompute against the new graph; the Water gate has no such global leg.
  implication: the fix must keep the Computed instances stable (several effects/callbacks capture them without deps) but re-bind them to the live graph: a Studio `rotoModelGeneration` signal bumped in an effect keyed on the model object; both gates read it so their next evaluation happens post-render with the latest closure and re-registers on the new graph. Cell identity is re-read from the O(1) projection (`resolveStudioScriptCell`) — the same context as the owner resolver — and null/non-real/keyless cells fail closed, so a retired model cell can never assert a key. Applied to `moveAvailable` as well (identical latent freeze). Gate diagnostics (`gateCellFrame`, `gateCellKind`, `gateHasWatercolor`, `aquarelleRevision`) added to the owner-resolve report; probe build bumped to `quick-261026-odd-diag-10-model-graph-gate`. Latent hazard recorded, not in this scope: `studioScriptSnapshotController.restore()`'s `missing` branch returns without clearing the module-global timeline — relevant only if one Studio page is rebound across project identities (track switches already reset/restore).

- timestamp: 2026-10-26 21:29–21:31Z (FINAL NATIVE UAT — APPROVED)
  checked: build beacon, `/tmp/efx-move-provenance.json`, `/tmp/efx-aquarelle-render-split.json`, user confirmation.
  found: beacon `quick-261026-odd-diag-10-model-graph-gate` fresh at 21:29:03Z. Owner-resolve at 21:30:19Z on a scripted frame: `gateCellFrame:1`, `gateCellKind:'real'`, `gateHasWatercolor:true`, `watercolorMoveAvailable:true` (correct for a scripted key), `brushMoveAvailable:false`, `moveAvailable:false`, active module unchanged. The final launch's aquarelle report contains only `layer-capture` events (21), so the ordinary-key paint/move/reopen rows were validated in the user's earlier fresh-project pass plus this approval, not re-instrumented in the final launch. User: "approved uat."
  implication: the Motion rail gate and the ordinary-key/reopen behavior are accepted. Reopen durability remains fail-closed (Option D) with A/B persistence deferred to a follow-up. Ready to pin regression tests, archive the session, and commit locally (no push).

- timestamp: 2026-10-26 22:34–22:36Z (FINALIZATION — deferred regression pins + gates)
  checked: `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` (new `261026 watercolor-loop-render-split final regression pins` block, 5 tests); the existing behavioral suites (`frameScriptOwnership` 14, `brushScriptHydration` 27, `frameModuleLock` 10, `physicsPaintRotoScriptRebake` 4, `physicsPaintRotoScriptClipboard` 75, `physicsPaintRotoPhysicalResolver` 204); `pnpm exec tsc --noEmit`; full `src/components/physic-paint` tree.
  found: new pins — (1) the model-graph generation effect (`rotoModelGeneration.value += 1` keyed on `[rotoTimelineModel]`) and exactly one `void rotoModelGeneration.value;` read at the top of EACH gate, with cell identity re-read through `resolveStudioScriptCell` and null/non-real/keyless cells failing closed, plus the DEV gate-context diagnostics; (2) the engine leg uses `getStrokeSerials()` (never `getStrokes()`), excludes aquarelle guide proxies, Move entry passes the projection keyId and refuses to arm without a ledger, the stored leg requires `entry.keyId === scriptCell.keyId` + hydratable, and the owner funnel shares the same cell; (3) the launch-scoped durable-base map (reset on `[operationId, layerId]`; first-stroke pin ordered BEFORE `recordAquarelleStroke`; `script-already-present` refusal for an already-scripted frame; promotion clone/blank recording; raster invalidation; exactly 3 `.set(` sites and 1 `.delete(`; the publish path never touches the map), the two multiply composite sites, the known-empty raw branch, and `durable-base-unknown` returning false BEFORE the only `upsertCachedFrame(`; (4) the override/source-occurrence lifecycle targets, the exact-offset group source key, and the group composite reading the source key payload and failing closed with `durable-base-unavailable` before any cache write; (5) probes remain DEV-gated (`canWrite()` = `import.meta.env.DEV === true`) with build markers `debug-watercolor-loop-render-split-3` / `quick-261026-odd-diag-10-model-graph-gate`.
  gates: `pnpm exec tsc --noEmit` clean. Touched suites `Test Files 7 passed (7) | Tests 622 passed (622)` (Studio 288, clipboard 75, resolver 204, rebake 4, ownership 14, hydration 27, frameModuleLock 10). Full `src/components/physic-paint` tree `Test Files 180 passed (180) | Tests 3925 passed (3925)`.
  implication: every approved root cause now has an automated regression pin; no product behavior changed in finalization. Session resolved, archived to `.planning/debug/resolved/`, knowledge-base prevention entry appended, ONE local commit on dev (no push).

## Current Focus

- status: "FINALIZED — resolved, archived, regression pins landed, one local commit on dev (no push)."
- hypothesis: "RESOLVED and APPROVED by native UAT. Root causes fixed: (1) group target + composite (run 2); (2) empty-script owner/Move gate + legacy fail-closed (F1–F4); (3) model-graph identity freeze for the Water Select gate (diag-10); (4) ordinary-key stroke-only replace — launch-pinned durable base + multiply composite, unknown base fails closed after reopen."
- test: "Final UAT approved 2026-10-26 on build `quick-261026-odd-diag-10-model-graph-gate`. Deferred regression pins added afterwards (model-graph generation re-bind, empty-script owner/Move fail-closed, ordinary-key durable base + `durable-base-unknown` refusal, group source-key exact-offset composite, DEV probe gating)."
- expecting: "No further behavior change in this session."
- next_action: "None — session closed. Follow-up scope (not this pass): decide reopen-durability persistence Option A vs B; frame 9 key 83ce7886's pre-paint payload was destroyed by run 3 and is unrecoverable."
- reopen_design: "DEFERRED — Option D (fail closed after reopen with a visible message) accepted with the final UAT. Persistence options A (base file alongside key) and B (base in the script record / snapshot v3) remain a follow-up decision; no format change in this pass."
- base_loss_note: "Frame 9 key 83ce7886's pre-paint payload (293d8, 168920 B) was overwritten on disk by run 3 and is not recoverable from the package (no sidecar/backup exists). The composite 31a9e that existed between the paint capture and the first move still contained the base paint; if the Studio launch is still open its in-memory history may hold it, but this debug does not rely on that."
- user_decision: "APPROVED 2026-10-26: legacy `keyId:null` rows = Option A, fail closed (no owner, no lock, no Move; cached pixels render; next live paint writes a v2 row; no purge/migration). Sequencing = implement now + one retest (no pre-fix capture run). Earlier approved: fix target and composite together; group source key at the exact cycleOffset is the durable base; fail closed when unresolvable. **REVOKED by run 3:** the earlier scope line 'ordinary keys keep replace' is disproven — an ordinary key can carry scriptless cached paint, and replacing it erases that cache. A new ordinary-key durable-base decision is required. **FINAL NATIVE UAT APPROVED 2026-10-26**; reopen persistence deferred (Option D kept)."
- tdd_note: "Per the approved sequencing, the live behavior was implemented first and the native UAT was the acceptance gate. The deferred regression pins landed in finalization (after the UAT approval): the model-graph generation re-bind on both gates, the empty-script owner/Move fail-closed predicate, the ordinary-key durable-base lifecycle + `durable-base-unknown` refusal, the group source-key exact-offset composite, and the DEV probe gating — see the 22:34Z evidence entry."
- regression_reasoning_checkpoint: |
    hypothesis: "The script Apply/move path erases ordinary-key caches because the publish callback only composites when `durableBaseKeyId` is set, and the ordinary-key mapping sets it to null by design. The stroke-only bake is published as a replace. The live capture's composite is separately suspect on transparent paint layers: multiply of an opaque transmittance sheet over a mostly transparent base produces an opaque sheet, and the base's opaque paint may or may not survive; the alpha-blind ink metric cannot distinguish this."
    confirming_evidence:
      - "Native run 3, frame 9 ordinary key 83ce7886: move bake 119d6 ink 17.09, route ordinary-key ok, display 17.09; no script-bake-composite event; second move 11792 ink 16.24."
      - "On-disk key file is now RGB 1080x1080, 71570 bytes, opaque, mean luminance 250.2; the pre-paint 168920-byte payload is gone."
      - "Sibling Paint 3 keys: RGBA, 92-95% transparent, avg alpha 6-14, mean luminance 5-8 — transparent paint layers, not opaque images."
      - "Publish callback branches on `durableBaseKeyId`; ordinary-key prepareTarget returns durableBaseKeyId null/undefined, so the replace branch runs."
    falsification_test: "If the pre-paint key payload can be shown opaque paint (not a transparent layer) and the live capture preserves it while the move bake alone loses it, the composite axis for ordinary keys is confirmed. If the live capture already loses the base paint despite the merge, the alpha/matte handling is a second cause."
    blind_spots: "The pre-paint bytes are overwritten; the base must be reconstructed from a fresh key or a backup for an exact pixel diff. Reopen durability of an ordinary-key durable base is unresolved (no source key exists). The read-seam matte repair may hide or expose the opaque-sheet behavior; verify the displayed canvas, not only the stored bytes."
- followup_reasoning_checkpoint: |
    hypothesis: "The empty-script gate is broken because frame ownership counts a Brush script store entry (groups, possibly legacy/foreign/partial) as an editable script, and `moveAvailable` does not require any current-key Brush entry at all. The same ownership result auto-switches the module to Brush and locks Water color, so a cache-only frame behaves as if it had a Brush script. Three independent entries converge on the same missing predicate: (a) legacy v1 rows with keyId:null kept by withoutForeignKeyFrames on non-rail frames; (b) v2 rows whose key was replaced at the same frame (a bake/rail/respacing), which the resolver ignores and moveAvailable rejects as stale — producing auto-switch+lock WITHOUT Move; (c) partial or edit-cost rows that nav hydration refuses, leaving the engine empty while Move stays store-enabled (no handles — listBrushScriptStrokes gates on engineHolds)."
    confirming_evidence:
      - "User native run 2: Move/editable active on a frame without script; app auto-switched to Brush on a script-less cache frame; user wants to choose Brush or Water color on the cache."
      - "resolveFrameScriptOwner counts ANY stored groups, no cell/key identity and no editability: frameScriptOwnership.ts:25."
      - "moveAvailable requires only brushMoveAvailable + cell real and rejects only a PROVABLE stale key (entryKeyId !== null): PhysicsPaintStudio.tsx:1560-1569."
      - "applyFrameModuleState switches activeModule on a single owner (:1990-1991) and PhysicsPaintTopBar passes lockedModuleForOwner(frameScriptOwner.value) to ModuleSwitcher (:107), which disables the non-owning slot (:42,:52)."
      - "Hydration runs ONLY from navigateToSyncedPhysicalFrame (:4237); launch settle publishes the owner (:4732) with no attach; planBrushScriptHydration has no key-identity refusal (brushScriptHydration.ts:129-147); Move entry flushes but never attaches (:2193-2206)."
      - "brushed store restore keeps legacy null rows on non-rail frames: studioScriptSnapshotController.ts:287-318; the key provider comment forbids blessing a legacy row with the current key id: brushScriptRecordState.ts:126-128."
    falsification_test: "If the owner-resolve report on the offending cache frame shows owner null and activeModule unchanged, the auto-switch comes from another seam (default module/navigation), not ownership; if Move is disabled there, the reported Move failure was stale state. If the report shows keyMatchesCell true and hydratable true on that frame, the script is genuinely editable and the user's 'cache' reading is wrong for that frame."
    blind_spots: "The exact offending frame/state is not captured yet; the extended report must be taken on that frame (navigation-only row). Legacy null-keyId content policy is a product decision: fail-closed (view-only) is proposed because identity is unprovable; if the user considers those rows real scripts, an adoption rule would be needed instead (not proposed)."
    candidate_causes:
      - "code: ownership resolver has no cell/key identity and no editability predicate"
      - "code: moveAvailable accepts a null-keyId or missing entry and depends on a seam-published owner signal; launch never hydrates the launch frame, and Move entry never attaches"
      - "data: legacy v1 rows carry keyId null; key replacement by bake/rail leaves frame-anchored rows whose identity can no longer be proven"
      - "environment/config: not implicated — the state is reachable from document/snapshot shape alone"
    and_gate: "NO single AND-gate. Three independent entry paths (legacy null identity, key replacement, non-hydratable row) all reach the same missing predicate. Fixing only the resolver leaves Move enabled after a store drop or at launch (no attach); fixing only Move leaves the auto-switch/lock. Ownership and Move must share ONE key-bound editability predicate, and Move entry must be able to attach before arming."
    fix_rationale: "See 'Proposed fix — empty-script gate (awaiting approval)' below."
- reasoning_checkpoint: |
    hypothesis: "On Loop Clip frames the script Apply path targets the projection source key and publishes an un-composited aquarelle bake, so the physical route refuses it (stale-target) or would erase the flattened rail paint."
    confirming_evidence:
      - "Run 1: paint path resolved classification override key c8923fa3, merged display base 7c98 (ink 6.67) × sheet with multiply → e02e (ink 9.41), route group-frame ok, ack revision physical-6939-5ef16d55, display e02e."
      - "Run 1: move path bakeTargetKeyId a23d4568 (source key), bake 9e4e ink 4.85, route classified override c8923fa3 vs expected a23d4568 → stale-target; display stayed e02e; UI error surfaced."
      - "buildProjectionFromMapping builds cells only from realKeyRecords; overrides live in groupOverrideRecords; getSource reads currentPhysicalCell.keyId → source key."
      - "applyAquarelleEventsToKey publishes last.bytes raw; the Studio publish upserts them directly; no base read exists on the path."
      - "Post-ack repaintBase on the source key a23d4568 still holds the red-only 7c98 bytes — the durable base is derivable from the group's source key at cycleOffset."
    falsification_test: "If a native run on a source-occurrence frame (no override yet) shows the painted stroke rendered and the rail paint preserved under the current code, the target-resolution cause is wrong for that kind. If the old aquarelle-charged implementation at 7fc6304e targeted c8923fa3 and still erased the rail paint, the payload axis is independently required (already recorded: ink 4.85 vs 9.41)."
    fix_rationale: "Axis 1 maps the frame through classifyPhysicPaintRotoGroupFrameTarget inside prepareTarget: override → publish expectedKeyId = override key; source-occurrence → expectedKeyId = sourceKeyId (route creates a new override); ordinary-key unchanged; generated/gap → null (already gated). targetIsCurrent keeps its currency guard by comparing the projection identity (target.sourceKeyId ?? target.keyId), so a navigation/source change still refuses. Axis 2 composites the re-baked full-frame script over the durable source-key base with the same multiply law the live capture already uses, then publishes the composite under the lifecycle target — restoring 'script is content, rail paint is the base' without flattening either."
    blind_spots: "The original phantom (paint recorded but not rendered on a no-override source-occurrence frame) is still unreproduced; run 1 had an existing override. Gap-filled and generated-phase overrides cannot derive their original base and stay out of scope (both are unreachable from the move gate). Ordinary-key script apply keeps replace semantics. Mixed engine-1 brush paint on a group frame follows its own capture path (source-over alpha), not this multiply seam."
    candidate_causes:
      - "code: projection cells exclude group overrides, so getSource/prepareTarget resolve the source key on override frames"
      - "code: the aquarelle re-bake publish replaces pixels and never reads the durable base"
      - "data: override payloads are flattened composites; the pixel-only base is only derivable from the group source key at the phase offset (and not at all for gap/generated phases)"
      - "config/environment: not implicated — run 1 is deterministic and the defect reproduces from document shape alone"
    and_gate: "YES. Fixing only the target publishes ink 4.85 over the 9.41 composite and erases the rail paint (the pre-revert destruction). Fixing only the payload keeps publishing to the source key, which both fails the route as stale-target and would overwrite the loop's source content shared by every occurrence. Both axes must land together."
- tdd_checkpoint: "GREEN. Contract tests landed with each implementation step; native UAT approved 2026-10-26; the deferred regression pins landed in finalization (5 new Studio pins + the existing behavioral suites). tsc clean; touched 622/622; full physic-paint 180 files / 3925 tests."

## Reopen durability design (checkpoint — USER DECISION REQUIRED)

**What is missing:** the durable base (an ordinary key's pre-script payload) currently lives only in the launch-scoped `aquarelleDurableBaseByKeyRef`. After the Studio is closed and reopened, a scripted ordinary key has events restored from the script snapshot but no base; the publish fails closed (`durable-base-unknown`), so Move/Apply refuses instead of erasing. This is the safe state shipped now — the options below decide whether reopen becomes editable.

**Constraints for every option**
- The base is pixel content (WebP bytes), not a vector script. It must be captured when the script BEGINS (the same first-stroke seam) and must never advance afterwards (advancing doubles the script on the next bake).
- Renderer code cannot write packages or caches directly (project law: all package/cache IO through Rust).
- No backward-compat/migration code (project law: clean break on format changes); an absent base must keep failing closed.
- The base is only needed while a script exists on the key; rastering or purging the script makes it dead weight.

**Option A — base payload alongside the key record**
- Store a second media reference on/near the key (e.g. `<keyId>.base.webp` referenced from the physical key record or a parallel per-track map).
- Cost: package format fields + Rust write/read + cleanup; roughly doubles the bytes for every scripted key while the script exists.
- Risk: medium. Lifecycle cleanup is manual (raster/purge/move/copy). The base must also be written by the close/save flush, so a crash before save still reopens UNKNOWN.
- Data-model impact: `.mce` package + runtime document schema; snapshot v2 container gains a reference list. No migration needed (absent → UNKNOWN).

**Option B — base inside the watercolor script record (RECOMMENDED if reopen editing is wanted)**
- The script snapshot already owns the per-frame aquarelle events; add the base media reference (or bytes) to that same frame entry. The base lives exactly as long as the script, so purge/raster cleanup is automatic and the transactional unit matches the content.
- Cost: snapshot schema version bump (SNP1 v2 → v3) + parser + save plumbing; a new media write per scripted key; snapshot only (no top-level package change beyond the media folder).
- Risk: medium-high (format change), but no orphan states and no lifecycle table to maintain.
- Data-model impact: script snapshot v3; restore loads the base reference, materializes it at launch (Rust), and seeds the same launch map — the composite path does not change at all.

**Option C — derive by replaying the rail/Brush source**
- Only valid when the base is the deterministic render of a known script (e.g. the key's Brush script replay). Ordinary-key caches can be arbitrary raster (imports, rail cleanup, prior sessions), and no general derivation exists.
- Verdict: rejected as a primary mechanism; could fill the map opportunistically on reopen for the narrow proven subset (not proposed now).

**Option D — keep fail-closed after reopen (SHIPPED NOW)**
- No storage, no format change, zero risk of erasing paint; reopened scripted keys refuse Move/Apply with a visible message until the script is cleared or repainted on that key.
- Cost: no script editing after reopen for existing keys; users must repaint to edit. Render parity is unaffected (pixels still display exactly).
- Data-model impact: none.

**Option E — un-multiply by the deterministic script bake (rejected)**
- Reconstruct `base ≈ composite ÷ bake` from the last bake. Division by near-zero transmittance amplifies quantization/premultiply noise, the last bake may differ (paper/grain/settings, bounds), and clipped pixels lose information. Artifacts would compound on every reopen.
- Verdict: rejected on quality; at best a preview heuristic, never the authoritative base.

**Recommendation:** ship Option D with this pass (done), decide B vs A for the next data-model step. B is cleaner (script-owned lifecycle, no orphans); A is the fallback if snapshot schema churn is undesirable. Doing nothing keeps every reopen refusal safe but permanently limits script editing across sessions.

## Resolution

root_cause: "FOUR contributing causes (AND-gates extended by native runs 3 and 4). (1) TARGET (group frames): script Apply on a Loop Clip frame resolves the underlying projection SOURCE key (a23d4568) instead of the frame's lifecycle target (override key c8923fa3 for an override frame; sourceKeyId for a source-occurrence that must create a new override), so routeRotoPhysicalPaintFrame returns stale-target. (2) PAYLOAD (group frames): the aquarelle re-bake publishes the raw single-frame bake (stroke-only) with no composite over the durable pixel-only base, so any correctly-targeted publish would erase the rail paint. The durable base is the group's SOURCE key payload at the exact cycleOffset (proven by run 1: a23d4568 still holds the red-only 7c98 bytes). (3) ORDINARY-KEY BASE LOSS (run 3, regression introduced by the build `-2` scope line 'ordinary keys keep replace'): an ordinary real key can carry scriptless cached paint, and its script edit took the RAW replace branch (compositing was gated on `durableBaseKeyId`, which ordinary keys set to null), publishing a stroke-only sheet over the key payload — the cached paint was erased on disk. The live capture was already correct (base 293d8 168920 B → produced 31a9e 203422 B with multiply), so the opaque-sheet/matte handling is NOT a second cause. A launch-scoped map is required because `aquarelleMergeBaseRef` is deliberately cleared at every sheet-session end and run 3's move ran after navigation. Latent defect: prepareTarget compares record.appFrame to the instance frame, failing on repeat instances. (4) EMPTY-SCRIPT GATE FREEZE (run 4): `watercolorMoveAvailable` (and latently `moveAvailable`) are once-created Studio computeds. `useRotoTimelineModel` recreates its whole signal graph whenever a structural input changes; a Computed keeps the sources its last evaluation registered, so after the graph swap the gates stayed subscribed to RETIRED signals that are never written again. signals-core `_refresh` then returns the cached value without invoking the closure — a scripted frame's `true` survived onto a scriptless Motion rail cell while the fresh `hasAquarelleScriptForFrame` read was false. `moveAvailable` escaped only because the global brush signals changed during the reset and forced a recompute. NO aquarelle revision bump is missing: every timeline mutator bumps, and run 4's timeline was never cleared."
fix: "APPLIED and committed on dev after the native UAT approval (single local commit; no push). Axis 1 — `RotoScriptPhysicalTarget` extended with `sourceKeyId` (projection identity for the async currency guard) and `durableBaseKeyId` (group source key holding the pixel-only base); `dispatchApply.targetIsCurrent` compares `currentSource.keyId === (target.sourceKeyId ?? target.keyId)`; `prepareTarget` classifies the frame and maps source-occurrence (publish sourceKeyId, route creates the override) / override (publish override key, durable base = group source key at the exact cycleOffset), returns null otherwise, and never uses `record.appFrame`. Axis 2 — new `composeRotoScriptRebakeFrame` premultiply-decodes the baked sheet, multiply-merges it over the durable base via `mergeRotoAlphaCanvases`, and re-encodes; the publish callback records `script-bake-composite` and fails closed (`durable-base-unavailable`) when a group base cannot be read. Ordinary keys — `durableBaseBytes` contract on `RotoScriptPhysicalTarget` (present bytes = known base, present null = known empty, absent = UNKNOWN); launch-scoped `aquarelleDurableBaseByKeyRef: Map<keyId, Uint8Array | null>` reset on launch replacement; the base is recorded at the FIRST recorded aquarelle stroke (pre-script key payload, only when the frame has zero events — a reopened flattened payload records a `script-already-present` refusal instead, preventing doubling), at promotion success (clone bytes / null for blank), and by `prepareTarget`'s gated fallback (clipboard Apply onto an unscripted cache key, only when no timeline edit is in flight); rastering a key deletes its entry. The publish callback composites `durableBaseBytes` with the same multiply, publishes raw only for a known-empty promotion, and otherwise fails closed (`durable-base-unknown`) with NO cache write. Alpha-aware probes added: `durable-base-alpha`, `composite-alpha-proof` (base/sheet/composed opaque+visible fractions, base->composed retention, optional PNG dumps). Probe build marker bumped to `debug-watercolor-loop-render-split-3`. RUN-4 GATE FIX: a Studio-owned `rotoModelGeneration` signal (`useSignal(0)`, bumped in a `useEffect` keyed on the `useRotoTimelineModel` return object) re-binds both once-created gate computeds to the LIVE graph after every rebuild. `moveAvailable` and `watercolorMoveAvailable` read it, keep the model's `currentCell` for the frame (and for frame-change notifications), and re-read the cell identity from the O(1) projection (`resolveStudioScriptCell`) — the owner resolver's context — failing closed on null / non-real / null-keyId cells. `moveAvailable`'s stored-leg key comparison now uses `scriptCell.keyId`. The owner-resolve report gains `gateCellFrame`, `gateCellKind`, `gateHasWatercolor` and `aquarelleRevision`; the Move-provenance build marker is `quick-261026-odd-diag-10-model-graph-gate`."
verification: "NATIVE UAT: APPROVED 2026-10-26 on build `quick-261026-odd-diag-10-model-graph-gate` (Motion rail gate row + ordinary-key paint/move/reopen rows accepted; user: 'approved uat'). Group two-axis fix confirmed on native run 2 (build `-2`): every bake composed over the durable base, routes ok group-frame, display digests match; no stale-target, no durable-base-unavailable. Ordinary-key regression fixed and accepted: launch-pinned durable base + multiply composite; unknown base (reopen) fails closed with a visible message — Option D kept, persistence options A/B deferred to a follow-up. Model-graph gate freeze fixed and accepted: owner-resolve on diag-10 showed gateCellFrame/gateCellKind/gateHasWatercolor live with the correct gate value. FINAL AUTOMATED GATES (after the deferred regression pins): `pnpm exec tsc --noEmit` clean; touched suites 622/622 across 7 files (Studio 288 incl. 5 new final pins, clipboard 75, resolver 204, rebake 4, ownership 14, hydration 27, frameModuleLock 10); full physic-paint tree 180 files / 3925 tests pass. Committed locally on dev (no push)."
files_changed:
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx (DEV capture-trigger probe)
  - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts (DEV capture/route probes)
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts (DEV dispatch/settlement probes)
  - app/src/components/physic-paint/performance/aquarelleRenderSplitCapture.ts (new probe)
  - app/src/components/physic-paint/performance/moveProvenanceCapture.ts (build marker + resolve extras)
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoGroupLifecycle.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptRebake.ts (new)
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptRebake.test.ts (new)
  - app/src/components/physic-paint/view/frameScriptOwnership.ts
  - app/src/components/physic-paint/view/frameScriptOwnership.test.ts
  - app/src/components/physic-paint/view/brushScriptHydration.ts
  - app/src/components/physic-paint/view/brushScriptHydration.test.ts

### Fix design (APPROVED and APPLIED)

**Axis 1 — lifecycle-aware target (correct key, fail-closed otherwise)**
- `physicsPaintRotoScriptClipboard.ts`: extend `RotoScriptPhysicalTarget` with `sourceKeyId?: string | null` (the projection identity used for the async currency guard) and `durableBaseKeyId?: string | null` (group source key whose payload is the pixel-only base). In `dispatchApply`, `targetIsCurrent` compares `currentSource.keyId === (target.sourceKeyId ?? target.keyId)` instead of `target.keyId`; `getSource()` is unchanged.
- `PhysicsPaintStudio.tsx` `prepareRotoScriptTargetRef.current` real-key branch: classify with `classifyPhysicPaintRotoGroupFrameTarget({ document, appFrame: source.appFrame })`:
  - `ordinary-key` → `{ keyId: target.keyId, appFrame: source.appFrame, sourceKeyId: target.keyId, durableBaseKeyId: null, durableBaseBytes }` (only when `target.keyId === source.keyId`); `durableBaseBytes` resolves the launch map, then the gated key-record fallback. SUPERSEDES the build `-2` line 'ordinary keys keep replace' — see 'Ordinary-key durable base (APPLIED after run 3)' below.
  - `source-occurrence` → `{ keyId: target.sourceKeyId, appFrame: source.appFrame, sourceKeyId: target.sourceKeyId, durableBaseKeyId: target.sourceKeyId }` (the route's expectation for a new override).
  - `override` → resolve the group source key at `cycleOffset` via the new helper; require it to equal `source.keyId` (the projection cell identity) and return `{ keyId: target.keyId (override), appFrame: source.appFrame, sourceKeyId, durableBaseKeyId: sourceKeyId }`. Never use the record's appFrame (phaseAppFrame) as the publish frame.
  - `generated-occurrence` / `group-gap` / `unresolved` / `ambiguous` / `empty` → `null` (fail closed; the move gate already blocks generated).
  - Empty/generated promotion branch unchanged.
- `physicsPaintRotoGroupLifecycle.ts`: add `resolvePhysicPaintRotoGroupSourceKeyIdAtOffset(document, groupId, cycleOffset): string | null`, sharing the source-offset computation with the classifier (exact offset only).

**Axis 2 — multiply composite over the durable base (the publish callback)**
- New `roto/physicsPaintRotoScriptRebake.ts`: `composeRotoScriptRebakeFrame({ durableBaseBytes, sheetBytes, appFrame, size })` decodes the baked sheet (premultiply-pinned `createImageBitmap`), merges with `mergeRotoAlphaCanvases(baseFrame, sheetCanvas, size, undefined, 'multiply')`, and re-encodes via `encodeRotoFrameFromCanvas`. Returns null on any decode/merge failure.
- `PhysicsPaintStudio.tsx` publish callback (the REVERTED comment site): when `target.durableBaseKeyId` is set, read the source record payload via `getRotoRealKeyRecord(..., durableBaseKeyId)` + `requirePhysicPaintRotoInlineBytes`, compose, and upsert the COMPOSED bytes with the same `frame.keyId`/`appFrame`; if the base payload cannot be resolved, return false (fail closed — never publish a stroke-only sheet over a group base). Ordinary keys use `durableBaseBytes` (see below). Replace the REVERTED comment with the new law.
- Probe: add `script-bake-composite` (base keyId/digest/ink, sheet digest/ink, composed digest/ink, target kind) to `/tmp/efx-aquarelle-render-split.json` for the next native run; bump the build marker.

**Boundaries (explicit)**
- Generated-occurrence and group-gap frames remain unreachable (move gate) and return null from prepareTarget.
- ~~Ordinary-key script apply keeps replace semantics.~~ REVOKED by native run 3: an ordinary key can carry scriptless cached paint; see 'Ordinary-key durable base (APPLIED after run 3)'.
- No mass purge, no frameOverrides change, no session-base advance (the live capture law is untouched).
- The source occurrence phantom on a no-override frame is verified in the next native pass, not assumed fixed.

**Automated verification after approval**
- `pnpm exec tsc --noEmit` in `app/`; `pnpm exec vitest run` on the touched suites (clipboard, group lifecycle, alpha merge/new rebake helper, PhysicsPaintStudio contract).
- Then ONE native pass (build marker bump): (a) paint a stroke on a source-occurrence frame with cached rail paint and NO override — expect a new override whose display keeps the rail paint and shows the stroke; (b) move the stroke — expect rendered pixels to move, rail paint preserved (display ink > paint ink); (c) reopen Studio — identical render. Read `/tmp/efx-aquarelle-render-split.json` from disk.
- No commit before native UAT passes; no dev server; no push.

### Ordinary-key durable base (APPLIED after run 3)

**Why:** run 3 proved an ordinary real key can carry scriptless cached paint; the build `-2` publish callback composited only when `durableBaseKeyId` was set, so ordinary keys took the raw replace branch and erased the cache after a move. The live capture was already correct (multiply over the pre-paint display payload); only the script-edit path was wrong. The live session base (`aquarelleMergeBaseRef`) cannot serve this path: `handleAquarelleSheetSessionEnd` clears it on every frame leave, and run 3's move ran after navigation.

**Contract** (`physicsPaintRotoScriptClipboard.ts`): `RotoScriptPhysicalTarget.durableBaseBytes?: Uint8Array | null` — present bytes = known base (multiply composite); present `null` = known empty (raw bake); absent (`undefined`) = UNKNOWN → fail closed.

**Lifecycle** (`PhysicsPaintStudio.tsx`):
- `aquarelleDurableBaseByKeyRef: Map<keyId, Uint8Array | null>` — launch-scoped; reset when `launchContext.operationId`/`layerId` changes.
- First recorded stroke (`recordAquarelleOrdinaryDurableBaseRef`, called in `handleAquarelleStrokeEnd` BEFORE the event lands): classifier must be `ordinary-key`, map must miss, and `getAquarelleEventsForFrame` must be 0; base = the key record payload (`getRotoRealKeyRecord` + `requirePhysicPaintRotoInlineBytes`). A frame that already has events records a `script-already-present` refusal and stays UNKNOWN — a reopened flattened payload must never become the base (it would double the earlier strokes on the next bake).
- Promotion success (`promoteRotoPaintTargetRef`): records the seeding base — cloned previous-key bytes, or `null` for a blank.
- `prepareTarget` ordinary-key: resolves the map; if it misses AND no timeline edit is in flight AND the frame has zero events, records the current key payload (clipboard Apply onto an unscripted cache key); else leaves `undefined`. The edit-in-flight gate prevents a reopened flattened payload from becoming a base during a delete-all re-bake.
- Raster handler: deletes the key's map entry so the next stroke re-pins the rastered pixels.
- Publish callback: `durableBaseBytes` present bytes → multiply composite via `composeRotoScriptRebakeFrame`, record `script-bake-composite` (`durableBase:'launch-map'`) + `composite-alpha-proof`; present `null` → raw bake (`known-empty`); absent → `script-bake-result` ok:false reason `durable-base-unknown`, no cache write.
- The map is never advanced to the composed output (advancing would compound the earlier wash dabs on the next bake).

**Probes:** `durable-base-alpha` (pre-script base opaque fraction/avg alpha, PNG dump) and `composite-alpha-proof` (base/sheet/composed + `base->composed` retention, PNG dumps), because the ink metric is alpha-blind on transparent paint layers.

**Known limits:** after reopen the base is UNKNOWN → visible refusal (Option D of the reopen design). Group/source/override paths unchanged. Frame 9's base was destroyed by run 3 and is not recoverable.

## Proposed fix — empty-script gate (APPROVED and APPLIED; native retest pending)

**Law being implemented (user's words):** a cache frame has no editable script on the current key -> no auto-switch, no module lock (Brush and Water color both selectable for painting), Brush Move and Water Select/Cmd disabled. A genuine single-owner key keeps today's auto-switch + lock. Painting is always allowed; the first real stroke creates the key's script and re-enables that module's Select/Move.

**F1 — ONE key-bound, editability-bound ownership predicate** (`view/frameScriptOwnership.ts`)
- New exported `FrameScriptCell { kind: string; keyId: string | null }`.
- `resolveFrameScriptOwner(frame, cell, liveBrush?)` (cell REQUIRED so the compiler forces key context):
  - `storedBrush = cell?.kind === 'real' && cell.keyId !== null && entry exists && entry.groups.length > 0 && entry.keyId === cell.keyId && isBrushScriptFrameHydratable(entry)`.
  - `liveBrushLeg` keeps today's semantics (active + strokeCount > 0 + not purged), cell-independent so the FIRST stroke mid-promotion still owns the frame; Move stays cell-gated in the Studio.
  - `hasWatercolor = cell?.kind === 'real' && hasAquarelleScriptForFrame(frame)`.
  - owner mapping unchanged (brush / watercolor / both / null).
- Studio callers resolve the cell from the O(1) projection (`getRotoPhysicalProjection(layerId, studioActiveTrackId())?.cells[frame]`, keyId only for kind 'real'): `applyFrameModuleState` and the raster handler.
- **Legacy `keyId:null` rows deliberately resolve NO owner (fail closed).** Rationale: identity is unprovable, `withoutForeignKeyFrames` cannot prove them current, and the key-provider comment already forbids blessing a legacy row with the current key's id. Their cached pixels keep rendering; they are not "scripts on the current key". **Decision point for the user — see checkpoint.**

**F2 — Move gate shares the predicate and the engine truth** (`PhysicsPaintStudio.tsx`)
- `moveAvailable` = `brushMoveAvailable` && cell real && (key-bound hydratable entry for `cell.appFrame` || engine holds non-guide strokes for the CURRENT frame). Read `brushScriptRevision.value` inside the computed so any store mutation re-evaluates without waiting for a seam republish (computed value still only propagates when the boolean flips).
- The engine leg preserves the first-stroke re-enable (completion publishes owner brush; the engine holds the stroke) and mid-session paints.
- `watercolorMoveAvailable` (run-4 fix): real cell + current-key script, re-bound to the live signal graph through `rotoModelGeneration`, with the cell identity re-read from the O(1) projection and null / non-real / null-keyId cells failing closed.
- Net effect: a null-keyId row, a foreign-key row, a partial/edit-cost row, or a missing entry can never enable Move. `brushMoveAvailable` still excludes 'both' (mixed state is not a movable Brush script).

**F3 — Move entry attaches before arming** (`selectTool` Brush Move branch)
- Before `selectToolEngine('move')`: if the entry is key-bound + hydratable and `!engineHoldsBrushScriptFrame(engine, frame)` and the engine holds no real strokes, attach via `attemptBrushScriptHydration({ frame, destinationKind: 'real', brushModuleActive: true, wasPlaying: false, scrubActive: false })`.
- If neither the engine nor a successful attach holds strokes, return without arming (defense in depth; F2 already prevents the button state).
- Why not launch hydration: the launch restore is async and races engine-ready; demand-attach at Move entry is order-free and reuses the existing lazy-attach policy. After attach the tool switch re-renders the overlay, which lists handles because the engine now holds them.

**F4 — hydration key gate (defense in depth)** (`view/brushScriptHydration.ts`)
- `BrushHydrationRequest` gains `keyId: string | null` (destination cell key); `planBrushScriptHydration` refuses a new `foreign-key` reason when `entry.keyId` is null/absent or `!== request.keyId`. Navigation passes the destination cell keyId; Move entry passes the current cell keyId.
- Keeps nav hydration from attaching dead outlines to a replaced key even on a path where ownership was not re-resolved.

**Explicit boundaries**
- No snapshot format change, no migration: legacy null rows stay null in the file and view-only until the key is repainted (the next live capture writes a v2 row). No mass purge; frameOverrides and the one-time rail cleanup untouched.
- Water color events keep their global `playFrame` anchor (no key identity in the payload) — out of scope; the watercolor leg is keyed by the real cell only, as today.
- Repeat-instance rail frames: the projection cell identity is the source key; a Brush script bound to it is editable where that identity is the cell, a Water color script still owns the instance. Existing semantics, documented, not changed.
- Owner null leaves `activeModule` untouched (existing rule) and locks nothing (`lockedModuleForOwner(null)` already returns null) — no UI change needed.

**Automated gates after approval (tests land with the implementation, live UAT remains the acceptance gate)**
- New failing-first tests: `frameScriptOwnership.test.ts` (matching keyId+hydratable -> brush; null keyId -> null; mismatched keyId -> null; partial/edit-cost -> null; non-real/missing cell -> null; live sample still brush; watercolor requires real cell; 'both' only when both legs hold), `brushScriptHydration.test.ts` (foreign-key refusal; matching key still hydrates), Studio contract pins (moveAvailable store+engine legs, Move-entry attach, resolver call signature, funnel slice), raster call update.
- `pnpm exec tsc --noEmit` in `app/`; targeted `pnpm exec vitest run` on the touched suites; then the ONE native retest below; no commit before UAT; no dev server; no push.

**Native retest (ONE app launch; probe build marker bumped with the fix)**
1. **Navigation-only row (the diagnostic capture):** open Studio and navigate ONTO the offending cache frame — the one where Move was active / the module auto-switched. Do NOT paint. Expect: active module unchanged; BOTH Brush and Water color clickable (no lock); Brush Move greyed; Water Select/Cmd inert; clicking Move / tapping Cmd does nothing.
2. Read `/tmp/efx-move-provenance.json` (build `quick-261026-odd-diag-10-model-graph-gate`): the `resolve` block on that frame must show the legacy facts (entry `keyId:null` or `keyMatchesCell:false` or `hydratable:false`) with `publishedOwner:null`, `lockedModule:null`, `activeModuleBefore === activeModuleAfter`, `moveAvailable:false`, `watercolorMoveAvailable:false`, and the new gate facts: `gateCellKind` matching the live cell, `gateHasWatercolor:false`, `aquarelleRevision` equal to the live value. If it shows a genuine key-bound hydratable entry, the frame is genuinely scripted — report it instead of expecting null.
3. **Paint-choice row:** on the same cache frame pick the module you want (Brush or Water color) and paint ONE stroke. Expect the stroke to render, the chosen module to own the key (the other slot locks), and that module's Select/Move to enable with visible handles.
4. **Return row:** navigate away and back to that frame. Expect Move/Select still enabled with handles (Move entry attaches if navigation refused), no dead outlines, no doubling.
5. **Regression row:** a key that already owns a Brush script still auto-switches to Brush and locks Water color; a key that owns a Water color script still auto-switches/locks the other way.

- motion_gate_reasoning_checkpoint: |
    hypothesis: "The Water color Select gate froze because its once-created Computed stayed subscribed to the RETIRED timeline signal graph. `useRotoTimelineModel` recreates the whole graph on structural changes (rails/keys deletion + Motion rail creation); a Computed keeps the sources registered by its last evaluation, the retired `currentCell` never changes again, and signals-core `_refresh` returns the cached value without calling the closure. The gate therefore held `true` from an earlier scripted frame while the fresh read is false. No aquarelle revision bump is missing."
    confirming_evidence:
      - "Run 4 owner-resolve: fresh hasWatercolor false, eventCount 0, store hasEntry false, engine 0; computed watercolorMoveAvailable true; owner null; no switch; brushMoveAvailable false; moveAvailable false."
      - "`useRotoTimelineModel` returns a new model only through `useMemo([...structural inputs...])`; the hook body writes frame/selection into the CURRENT graph only (useRotoTimelineModel.ts:144-163)."
      - "`useComputed` memoizes the Computed once and swaps only `$compute.current` (signals/src/index.ts); a Computed's `_sources` are refreshed only when `_fn` runs."
      - "signals-core 1.13 `Computed._refresh`: `(OUTDATED | TRACKING) === TRACKING` returns true; otherwise `needsToRecompute` over the registered sources; retired sources report no change, so the cached value is returned without evaluating the new closure."
      - "Bump audit: every `payloadTimeline`/deleted-id mutator bumps `aquarelleStrokesRevision`; no external timeline mutation exists; the run-4 timeline still held the frames-0/3 scripts, so no clear path was involved."
      - "`moveAvailable` escaped because `brushMoveAvailable`/`brushScriptRevision` changed during the reset, forcing one recompute against the new graph; the Water gate has no such global leg."
    falsification_test: "If the navigation-only native row on build diag-10 still shows watercolorMoveAvailable true with gateHasWatercolor false, the generation re-bind is not the cause; then compare gateCellFrame against the resolver frame and the live launch frame to prove a frame-source divergence, and check whether the generation effect ran (report build + a fresh `aquarelleRevision` sample)."
    fix_rationale: "The generation signal invalidates both gates exactly once after each graph swap, on the post-render closure, so their next evaluation registers on the LIVE graph. Reading the cell identity from the O(1) projection rather than the model cell makes the decision independent of any retired graph, and null / non-real / null-keyId cells fail closed. Stable Computed identities are preserved so the several effects and callbacks that capture the gates without deps keep working."
    blind_spots: "The generation effect runs after paint; a gate read in a signals effect BEFORE that post-render bump still evaluates with the previous closure — but it now reads the fresh frame (`currentCell` of the still-current graph) and fresh projection/script, so the boolean is correct at that instant; the post-render bump then re-registers on the new graph. A track switch is also a graph rebuild; the existing reset/restore bumps cover the script side. The diagnostics prove the gate's own frame context only in DEV."
    candidate_causes:
      - "code: once-created computed bound to a retired signal graph (root cause)"
      - "code: gates trusted the model cell identity instead of the owner resolver's O(1) projection"
      - "data/environment: not implicated — no missing bump and no timeline clear in run 4"
    and_gate: "NO. The single contributing condition is the computed registration on a retired graph; the fresh-identity re-read is a fail-closed hardening, not a second cause."

## Constraints for the fix

- No span purge, no retained-union drop, no mass script deletion. frameOverrides preserved.
- A script that exists must render. No 'purge the phantom' workaround.
- Ride existing machinery (captureLivePixels + mergeCachedRotoAlphaFrame + routeRotoPhysicalPaintFrame). No new cache system.
- Preserve the multiply law and the sheet-start session base (never advance it; never carry the just-committed payload forward).
- Empty-script gate: Water color Select/Cmd and Brush Move stay disabled until a script exists; deleting the last stroke disarms.
- When fixing the script re-bake (H3), composite over the same durable base the live capture uses; do not publish a stroke-only sheet over a flattened override.
- No commit before native UAT passes; do not claim done before UAT.
