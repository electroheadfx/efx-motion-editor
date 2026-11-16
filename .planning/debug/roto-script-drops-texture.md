---
status: diagnosed
trigger: "roto-script-drops-texture"
created: 2026-11-15T00:00:00Z
updated: 2026-11-15T21:50:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED. The texture axis dies in the per-track Studio script snapshot (SNP1 / AQTL), not in the Roto script save/apply legs. AQTL's stroke engine block has no `textureId` field on either encode or decode; `restore()` replaces the payload timeline wholesale from the decoded snapshot, so every Studio boot / layer switch / track reseed silently strips `engine.textureId` from all previously recorded strokes. Strokes painted after the restore also carry none because the texture pick is Studio-realm session state that resets with the realm. Save/Copy Script then faithfully captures an already-textureless timeline.
test: DONE — parsed the real UAT saved script and proved the AQTL round-trip signature on its strokes.
expecting: n/a — root cause established.
next_action: Report ROOT CAUSE FOUND (diagnosis only, no fix per task).

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Save a script from a project with an imported tip, then apply it in a project that never imported that tip — the script's strokes paint the carried texture with no neutral round fallback, and no catalog row appears for the script tip.
actual: User reported verbatim: "No work, apply script and play script with motion/static/reveal draw to neutral round fallback. The saved or copied script doesn't not store texture choice for each strokes." Applying the script normally, AND playing it in motion / static / reveal draw modes, all render with a neutral round tip instead of the stroke's chosen texture.
errors: None reported.
reproduction: UAT Test 5. Import a PNG/JPG tip in project A, paint strokes with it, save a Roto script. Open project B which never imported that tip. Apply the script (and play it in motion/static/reveal modes) — strokes paint neutral round.
started: Discovered during UAT of Phase 63 (brush tip pipeline), 2026-11-15. Suspected regression from quick-261115-oh9 (texture becomes a setting of the brush response).

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: Script apply/bake leg ignores `engine.textureId` and falls back to the response tip (stale readers).
  evidence: Bake configure() reads `payload.textureId ?? null` and calls `buildBrushForStroke(brushId, { textureId })` (engineAdapter.ts:291-323); brushBridge resolves `resolveMask(textureId) ?? base.tip`. Serializer/parse/clipboard all engine-spread `textureId`. Unit suites (76/76) pin `serialize -> parse keeps engine.textureId` and `load leg registers the carried mask`. Readers are wired; drop must be upstream (capture) or in the brushPack (save leg).
  timestamp: 2026-11-15T01:10:00Z

- hypothesis: The save leg (capture -> referencedCustomBrushIds -> buildScriptBrushEntries -> serialize -> Rust write) drops or refuses the texture entry.
  evidence: Real artifact `.efx-roto-script.json` from the UAT contains `brushPack.entries` for all 3 imported tips WITH `maskDataUrl` (2719/5835/7799 B payloads) and no refusal occurred, so `buildScriptBrushEntries` (physicsPaintRotoScriptLibrary.ts:350-371) and the missing-bytes check (saveActiveFrame) ran clean. `serializeAquarelleRotoScript` spreads `engine: { ...event.engine }` (physicsPaintRotoScriptSchema.ts:193); Rust `validate_document` returns the Value unchanged before `atomic_write_json` (script_library.rs:2547-2586). The saved strokes genuinely never had `textureId` in the captured events.
  timestamp: 2026-11-15T21:42:00Z

- hypothesis: The import -> selection -> mask-registry chain is broken in the Studio realm (import registers only in main; push omits mask).
  evidence: `applyBrushImportRequest` registers mask + catalog entry + webp bytes in one batch and publishes the catalog BEFORE answering (efxPaintBrushImport.ts:142-160). The Studio applies `applyBrushCatalogPayload`, which registers masks into its own registry and remembers webp bytes (aquarelleBrushCatalog.ts:399-437). The artifact's brushPack proves the push arrived with bytes in the Studio realm. Import auto-select (`WatercolorBrushLibrary.tsx:252`) is therefore reachable and sound.
  timestamp: 2026-11-15T21:44:00Z

- hypothesis: `aquarelleEventsFromScript` IN-03 fallback (`stored?.brushId || 'wc/round-medium'`) is the neutral-round source for library scripts.
  evidence: Persisted library scripts always carry `aquarelleEvents` (aquarellePersistedToRuntime sets them, physicsPaintRotoScriptSchema.ts:288-296), so the persisted-first branch returns them as-is (play controller:4368-4370) and the fallback never runs for a loaded library script. `persist...` round-trip preserves `brushId: engine.brushId` (schema:274).
  timestamp: 2026-11-15T21:45:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-11-15T00:00:00Z
  checked: UAT record .planning/phases/63-brush-tip-pipeline/63-UAT.md
  found: Gap G-63-5 failed; test 5 "Roto script carrier" expected carried texture, got neutral round fallback; all other 5 tests pass (Studio import, library, persistence, fresh-install built-ins, project scoping).
  implication: The capture/persistence path for project saves works (test 3 passes) — the failure is specific to the Roto script carrier path (save/apply/play of scripts), narrowing the suspect set to script serialization and script apply.

- timestamp: 2026-11-15T00:55:00Z
  checked: packages/efx-watercolor/src/payload/toStudioStroke.ts; app/.../aquarelleRecordState.ts; app/.../engine/AquarelleCanvasLayer.tsx
  found: Recording leg DOES carry texture: onStrokeEnd spreads `...(recordedTool !== 'lift' && snap.textureId !== null ? { textureId: snap.textureId } : {})` into the AquarelleStroke, and toStudioStroke writes `engine.textureId` only when defined and tool !== 'lift' (toStudioStroke.ts:207).
  implication: If the script lacks texture, the likely null is `snap.textureId` at record time (aquarelleBrushForActiveTool gates it on `resolveMask(textureId) !== null` in the Studio realm) OR the captured events are not the painted ones.

- timestamp: 2026-11-15T01:00:00Z
  checked: physicsPaintRotoScriptSchema.ts serialize/parse; physicsPaintRotoScriptClipboard.ts capture/apply clones; engineAdapter.ts configure
  found: serialize writes `engine: { ...event.engine }`; isEnginePayloadAquarelleStroke accepts optional non-empty `engine.textureId`; aquarellePersistedToRuntime rebuilds `engine: { ...engine }`; clipboard clones spread engine; bake configure() consumes `payload.textureId`.
  implication: With a textureId present in the event, every script seam preserves it. The failure must begin where textureId is absent from the event OR where the brushPack entry is missing/unusable.

- timestamp: 2026-11-15T01:05:00Z
  checked: physicsPaintRotoScriptLibrary.ts saveActiveFrame / referencedCustomBrushIds / buildScriptBrushEntries / registerScriptBrushMasks; unit suites
  found: referencedCustomBrushIds collects only ids found IN the captured events (`engine.brushId`, `engine.textureId` starting `wc/custom-`); buildScriptBrushEntries builds carry entries from customBrushTips + stored asset bytes and the save REFUSES by name when referenced bytes are missing — yet the user reports no error. 76/76 unit tests pass, including oh9 texture pins (serialize->parse, load-leg registration, missing-refusal).
  implication: A silent save with no texture implies referencedCustomBrushIds returned EMPTY — i.e., the captured events never carried `engine.textureId`. The tests pass because they inject textureId synthetically; they do not prove the real capture contains it.

- timestamp: 2026-11-15T01:08:00Z
  checked: UAT test contrast: test 3 (project persistence) passes with texture replay; test 5 (script carrier) fails
  found: Project save/restore and script save share the capture source (payloadTimeline via getAquarelleEventsForFrame), but project restore resolves texture through `replaceMaskRegistry` on project open while scripts resolve through `registerScriptBrushMasks` on load.
  implication: Either the capture itself drops textureId only for the script snapshot (captureFreeze/deepFreeze or a different capture port), or the brushPack/registration leg is the drop. Must read the actual Studio save wiring (capturePersistence port) before concluding.

- timestamp: 2026-11-15T21:40:00Z
  checked: Real UAT artifact on disk — `/Users/lmarques/Desktop/efx-motion-editor-project-test/v2.1.0-phase-60-2.mce/scripts/c649ad32-e5d6-4693-a5fe-f993da122c69.efx-roto-script.json` (saved 2026-11-15T20:35:57Z = 21:35:57 local, inside the UAT window), plus the project's `brushes/` (3 custom WebP tips imported 21:14-21:20 local) and `scripts/<layerId>/<trackId>-v1.snap` (SNP1, 21:36 local).
  found: The saved script has `brushPack.entries` = 3 custom tips each with `maskDataUrl`, and 38 persisted events (23 brush strokes + 15 Dry) for frame 0. EVERY stroke's `engine.brushId` is a built-in response (`stipple` x6 @21:26, `filbert` x5 @21:32, `spatter` x4, `sponge` x4 @21:32:25, `filbert` x4 @21:32:59-21:33). ZERO strokes carry `engine.textureId`; the string "textureId" does not occur anywhere in the file. The `.snap` also contains no `textureId`/`wc/custom-` strings.
  implication: The user's report is literally true — the saved script stores no texture choice. The tips DID travel in brushPack (so the save leg and catalog push worked); the captured events themselves lacked the texture. The failure is upstream of the save, in what the recorded timeline held at save time.

- timestamp: 2026-11-15T21:42:00Z
  checked: Point-coordinate quantization census on the artifact's 23 strokes (AQTL quantizes point x/y to u16 UV: `quantizeUv` in scripts' comparison of `x*65535` to integers).
  found: Strokes 0-18 (painted 21:26:06-21:32:26) are 100% quantized to the u16 grid on both axes (e.g. stroke 0: x=0.7038529030289159 = 46127/65535). Strokes 19-22 (painted 21:32:59-21:33:02) are raw floats (0/8, 0/1 quantized). A 33-second gap separates the two groups.
  implication: Stellar proof that the timeline was RESTORED through the binary snapshot between 21:32:26 and 21:32:59: the earlier strokes came back from AQTL decode (quantized), the later ones were live-painted (raw). The restore is what stripped the texture from strokes 0-18; strokes 19-22 were painted after the Studio realm reset, when the session-only texture selection was back to null. The 21:35 save captured exactly that mixed, textureless timeline.

- timestamp: 2026-11-15T21:44:00Z
  checked: `app/src/components/physic-paint/performance/scriptTimelineCodec.ts` encodeStroke (635-743) and decodeStroke (998-1014); `performance/studioScriptSnapshotCodec.ts` encode/decode (536, 614); `snapshot/studioScriptSnapshotController.ts` restore (676-778); `view/aquarelleRecordState.ts` restoreAquarelleRecordTimeline (1771-1860); PhysicsPaintStudio.tsx restore call sites (5880, 6510).
  found: The AQTL stroke engine block persists `tool, color, brushId, params, toolOverrides, mutationId, diffusionFrames, timestamp, playFrame` + vector block — and NEVER reads or writes `textureId`. DecodeStroke rebuilds the engine payload at 998-1014 with no `textureId` member. `restore()` decodes the snapshot at 712 and calls `restoreAquarelleRecordTimeline(watercolorSeed.events, …)` at 755, which REPLACES `payloadTimeline` wholesale (aquarelleRecordState.ts:1781). PhysicsPaintStudio invokes `restore()` at 5880 (track bind) and 6510 (Studio session).
  implication: THE DROP POINT. `engine.textureId` is structurally absent from the per-track snapshot format. Any Studio boot / layer switch / track reseed round-trips the recorded timeline through AQTL and loses every stroke's texture axis. The Roto script save (captureScriptForPersistence -> captureFrameScript -> getAquarelleEventsForFrame, physicsPaintRotoScriptClipboard.ts:578/599, aquarelleRecordState.ts:2154) then faithfully serializes an already-stripped timeline.

- timestamp: 2026-11-15T21:46:00Z
  checked: Texture-selection lifecycle: `aquarelleSelectedTextureId` (aquarelleRecordState.ts:132), writers (WatercolorTextureStrip.tsx:99 chip pick; WatercolorBrushLibrary.tsx:252 import auto-select), the bind/record gate (aquarelleRecordState.ts:360-368), canvas spread (AquarelleCanvasLayer.tsx:629-631, 535), resume/settle mutators.
  found: The selection is Studio-realm module state only. No production code resets it on response change, track switch or project switch (grep: only tests clear it), and nothing restores it on Studio boot — a fresh Studio realm starts with null. The gate silently converts null OR unresolvable ids into null at both the live binding and the record snapshot; the settle path mutates `diffusionFrames` in place (aquarelleRecordState.ts:2050-2054) so it does not re-drop. `restoreAquarelleRecordTimeline` WOULD preserve `engine.textureId` if the event carried it (1808-1810 spreads it) — but AQTL decode never provides it.
  implication: Two contributing conditions form the observed failure (AND-gate): (1) the snapshot codec strips textureId from restored strokes, and (2) any stroke painted after a Studio realm reset records no texture because the pick itself is session-only. Both are needed to explain the artifact: strokes 0-18 stripped by (1), strokes 19-22 born textureless under (2). Even a user who correctly picks a texture and paints gets a textureless saved script if any Studio reseed happens before the save.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: "AND-gate: (1) PRIMARY — the per-track Studio script snapshot (SNP1/AQTL, scriptTimelineCodec.ts encodeStroke 635-743 / decodeStroke 998-1014) does not encode or decode `engine.textureId`, and the Studio restore path (studioScriptSnapshotController.ts restore 676, decode 712, restoreAquarelleRecordTimeline call 755; invoked from PhysicsPaintStudio.tsx:5880/6510; aquarelleRecordState.ts:1771 replaces payloadTimeline wholesale) silently strips the texture axis from every previously recorded stroke on any Studio boot / layer switch / track reseed; the later Save/Copy Script faithfully captures the stripped timeline, so the saved script has no texture to carry. Proven by the real UAT artifact: strokes 0-18 are u16-quantized (AQTL round-trip signature) and all 23 strokes lack engine.textureId. (2) SECONDARY — the texture choice is Studio-realm session-only state (aquarelleRecordState.ts:132) that is not restored on boot and is silently nulled by the bind/record gate (aquarelleRecordState.ts:360-368; AquarelleCanvasLayer.tsx:629-631), so strokes painted after the restore record no texture at all. The capture/serialize/Rust/parse/apply/bake legs are all faithful and were wrongly suspected."
fix: [diagnosis only — no fix implemented per task]
verification: "Evidence: real saved script at <project>.mce/scripts/c649ad32-e5d6-4693-a5fe-f993da122c69.efx-roto-script.json has 3-tip brushPack and 23 strokes with zero engine.textureId; strokes 0-18 quantized to u16 UV (restored via AQTL), 19-22 raw (live). Code chain: AQTL encode 635-743 / decode 998-1014 omit textureId; restore replaces timeline; save captures it."
files_changed: []
