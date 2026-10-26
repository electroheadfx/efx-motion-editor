import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const backgroundPickerView = readFileSync(fileURLToPath(new URL('./view/BackgroundAssetPickerView.tsx', import.meta.url)), 'utf8');
const capability = readFileSync(fileURLToPath(new URL('../../../src-tauri/capabilities/physics-paint.json', import.meta.url)), 'utf8');
const trackRow = readFileSync(fileURLToPath(new URL('./view/PhysicsPaintTrackRow.tsx', import.meta.url)), 'utf8');
const headerColumn = readFileSync(fileURLToPath(new URL('./view/physicsPaintTrackHeaderColumn.tsx', import.meta.url)), 'utf8');

const studio = readFileSync(fileURLToPath(new URL('./PhysicsPaintStudio.tsx', import.meta.url)), 'utf8');
const studioView = readFileSync(fileURLToPath(new URL('./view/PhysicsPaintStudioView.tsx', import.meta.url)), 'utf8');
const main = readFileSync(fileURLToPath(new URL('../../main.tsx', import.meta.url)), 'utf8');
const scriptsPanel = readFileSync(fileURLToPath(new URL('./view/PhysicsPaintScriptsPanel.tsx', import.meta.url)), 'utf8');
const workflowStrip = readFileSync(fileURLToPath(new URL('./view/PhysicsPaintWorkflowStrip.tsx', import.meta.url)), 'utf8');
const rightPanel = readFileSync(fileURLToPath(new URL('./view/PhysicsPaintRightPanel.tsx', import.meta.url)), 'utf8');
const toolRail = readFileSync(fileURLToPath(new URL('./view/PhysicsPaintToolRail.tsx', import.meta.url)), 'utf8');
const topBar = readFileSync(fileURLToPath(new URL('./view/PhysicsPaintTopBar.tsx', import.meta.url)), 'utf8');
const playScriptDialog = readFileSync(fileURLToPath(new URL('./view/PhysicsPaintPlayScriptDialog.tsx', import.meta.url)), 'utf8');
const photoReferenceDialog = readFileSync(fileURLToPath(new URL('./view/PhysicsPaintPhotoReferenceDialog.tsx', import.meta.url)), 'utf8');
const launchIntegration = readFileSync(fileURLToPath(new URL('./hooks/usePhysicsPaintLaunchIntegration.ts', import.meta.url)), 'utf8');
const navigationCoordinator = readFileSync(fileURLToPath(new URL('./hooks/useRotoNavigationCoordinator.ts', import.meta.url)), 'utf8');
const physicalEditCoordinator = readFileSync(fileURLToPath(new URL('./hooks/useRotoPhysicalEditCoordinator.ts', import.meta.url)), 'utf8');
const historyHook = readFileSync(fileURLToPath(new URL('./hooks/useRotoPhysicalEditHistory.ts', import.meta.url)), 'utf8');
const memoizedTopBarPath = fileURLToPath(new URL('./view/MemoizedPhysicsPaintTopBar.ts', import.meta.url));
const memoizedTopBar = existsSync(memoizedTopBarPath) ? readFileSync(memoizedTopBarPath, 'utf8') : '';
const memoizedPlayScriptDialogPath = fileURLToPath(new URL('./view/MemoizedPhysicsPaintPlayScriptDialog.ts', import.meta.url));
const memoizedPlayScriptDialog = existsSync(memoizedPlayScriptDialogPath) ? readFileSync(memoizedPlayScriptDialogPath, 'utf8') : '';
const rightPanelRegionPath = fileURLToPath(new URL('./view/PhysicsPaintRightPanelRegion.tsx', import.meta.url));
const rightPanelRegion = existsSync(rightPanelRegionPath) ? readFileSync(rightPanelRegionPath, 'utf8') : '';
const canvasMount = readFileSync(fileURLToPath(new URL('./engine/PhysicsPaintCanvasMount.tsx', import.meta.url)), 'utf8');
// 261022-pim: the Water color stroke select surface — overlay leaf + layer mount.
const aquarelleCanvasLayer = readFileSync(fileURLToPath(new URL('./engine/AquarelleCanvasLayer.tsx', import.meta.url)), 'utf8');
const aquarelleStrokeOverlay = readFileSync(fileURLToPath(new URL('./engine/AquarelleStrokeOverlay.tsx', import.meta.url)), 'utf8');
// 261023-g4p: ONE shared gesture implementation + ONE shared edition module.
const scriptStrokeOverlay = readFileSync(fileURLToPath(new URL('./engine/ScriptStrokeOverlay.tsx', import.meta.url)), 'utf8');
const scriptStrokeEdition = readFileSync(fileURLToPath(new URL('./view/scriptStrokeEdition.ts', import.meta.url)), 'utf8');
// 261023-g4p Task 3: the brush adapter of the same seam.
const brushScriptEditionPortSource = readFileSync(fileURLToPath(new URL('./view/brushScriptEditionPort.ts', import.meta.url)), 'utf8');
const brushScriptOverlay = readFileSync(fileURLToPath(new URL('./engine/BrushScriptOverlay.tsx', import.meta.url)), 'utf8');
const memoizedCanvasMountPath = fileURLToPath(new URL('./engine/MemoizedPhysicsPaintCanvasMount.ts', import.meta.url));
const memoizedCanvasMount = existsSync(memoizedCanvasMountPath) ? readFileSync(memoizedCanvasMountPath, 'utf8') : '';
const engineLifecycle = readFileSync(fileURLToPath(new URL('./engine/usePhysicsPaintEngineLifecycle.ts', import.meta.url)), 'utf8');
const bridge = readFileSync(fileURLToPath(new URL('../../lib/physicPaintBridge.ts', import.meta.url)), 'utf8');
const types = readFileSync(fileURLToPath(new URL('../../types/physicPaint.ts', import.meta.url)), 'utf8');
const projectTypes = readFileSync(fileURLToPath(new URL('../../types/project.ts', import.meta.url)), 'utf8');
const store = readFileSync(fileURLToPath(new URL('../../stores/physicPaintStore.ts', import.meta.url)), 'utf8');
const css = readFileSync(fileURLToPath(new URL('./physicsPaintStudio.css', import.meta.url)), 'utf8');
// 49-03 (D-12, T-49-03-03): the raster non-regression surface — the
// transparency checkerboard must exist ONLY as a paint layer in the Studio
// monitor stack, never in the compositor, flattened cache, preview, or export.
const compositor = readFileSync(fileURLToPath(new URL('../../efx-paint/compositor/efxPaintCompositor.ts', import.meta.url)), 'utf8');
const flattenedCache = readFileSync(fileURLToPath(new URL('../../efx-paint/compositor/efxPaintCompositeCache.ts', import.meta.url)), 'utf8');
const previewRenderer = readFileSync(fileURLToPath(new URL('../../lib/previewRenderer.ts', import.meta.url)), 'utf8');
const exportRenderer = readFileSync(fileURLToPath(new URL('../../lib/exportRenderer.ts', import.meta.url)), 'utf8');
// 50-05 (Task 2, S4): the reference transform handles surface — the interactive
// overlay + the pure bounds geometry it consumes.
const referenceTransformHandles = readFileSync(fileURLToPath(new URL('./view/PhysicsPaintReferenceTransformHandles.tsx', import.meta.url)), 'utf8');
const referenceTransform = readFileSync(fileURLToPath(new URL('./view/PhysicsPaintReferenceTransform.ts', import.meta.url)), 'utf8');
const studioKeyboard = readFileSync(fileURLToPath(new URL('./view/physicsPaintStudioKeyboard.ts', import.meta.url)), 'utf8');
// 261022-ujp: the watercolor payload reorder + the engine paint-order projection.
const aquarelleRecordStateSource = readFileSync(fileURLToPath(new URL('./view/aquarelleRecordState.ts', import.meta.url)), 'utf8');
const paintEngineSource = readFileSync(fileURLToPath(new URL('../../../../packages/efx-physic-paint/src/engine/EfxPaintEngine.ts', import.meta.url)), 'utf8');
// 260922-rd4: the background transform wiring pins (STEP F).
const backgroundClipSection = readFileSync(fileURLToPath(new URL('./view/PhysicsPaintBackgroundClipSection.tsx', import.meta.url)), 'utf8');
// 261023-j5b: the paint-settings carrier seams (probe + store entry).
const scriptMemoryProbeSource = readFileSync(fileURLToPath(new URL('./performance/scriptMemoryProbe.ts', import.meta.url)), 'utf8');
// quick-261023-ors: the ONE assembler moved to the production gauge; the pin
// follows the code home (the probe now delegates).
const studioScriptMemoryGaugeSource = readFileSync(fileURLToPath(new URL('./performance/studioScriptMemoryGauge.ts', import.meta.url)), 'utf8');
const brushScriptRecordStateSource = readFileSync(fileURLToPath(new URL('./view/brushScriptRecordState.ts', import.meta.url)), 'utf8');

describe('Physics Paint Play Script integration contract', () => {
  it('wires focused Roto script, Play Script, and cached playback controllers', () => {
    expect(studio).toContain('useRotoScriptLibraryController');
    expect(studio).toContain('useRotoPlayScriptController');
    expect(studio).toContain('rotoCachedPlayback');
    expect(studio).toContain('applyPreparedScript(preparation)');
    expect(studio).toContain('activateAndLoad(selectedId, preparation)');
    expect(studio).not.toContain('renderFromStrokes');
  });

  it('installs the parent Roto authority listener in the app entry point', () => {
    expect(main).toContain('installPhysicPaintRotoAuthorityListener');
    expect(main).toContain('installPhysicPaintRotoAuthorityListener()');
    expect(bridge).toContain('PHYSIC_PAINT_ROTO_AUTHORITY_REQUEST_EVENT');
    expect(bridge).toContain('PHYSIC_PAINT_ROTO_AUTHORITY_RESULT_EVENT');
  });

  it('installs the image-library request listener in the app entry point (49-04 picker)', () => {
    // The main webview must register the request listener or the Studio's
    // emitTo('main', ...) has no receiver and every picker request times out.
    expect(main).toContain('installPhysicPaintImageLibraryListener');
    expect(main).toContain('installPhysicPaintImageLibraryListener()');
    expect(bridge).toContain('PHYSIC_PAINT_IMAGE_LIBRARY_REQUEST_EVENT');
    expect(bridge).toContain('PHYSIC_PAINT_IMAGE_LIBRARY_RESULT_EVENT');
  });

  it('keeps Save, Load/Paintbrush, Create Rail, and cached Roto playback distinct', () => {
    const save = scriptsPanel.indexOf('label="Save Script"');
    const paintbrush = scriptsPanel.indexOf('label="Load + Apply to Frame"');
    const playScript = scriptsPanel.indexOf('label="Create Rail…"');
    expect(save).toBeGreaterThan(-1);
    expect(paintbrush).toBeGreaterThan(save);
    expect(playScript).toBeGreaterThan(paintbrush);
    expect(scriptsPanel).not.toContain('toggleRotoPlayback');
  });

  it('contains no obsolete separate Play workflow transport, persistence, launch, conversion, or CSS surface', () => {
    const production = [studio, bridge, types, projectTypes, store, css].join('\n');
    const obsolete = [
      ['apply', 'play', 'canvas'].join('-'), ['convert', 'play', 'to', 'roto'].join('-'), ['convert', 'roto', 'to', 'play'].join('-'), ['update', 'play', 'render', 'options'].join('-'),
      ['usePhysicsPaint', 'PlayCoordinator'].join(''), ['usePlay', 'EditCacheController'].join(''), ['usePlay', 'PreviewController'].join(''), ['useRotoPlay', 'ConversionController'].join(''),
      ['playScript', 'Ranges'].join(''), ['play', 'script', 'ranges'].join('_'), ['playStart', 'Frame'].join(''), ['playFrame', 'Count'].join(''), ['playRender', 'Options'].join(''), ['maxPlayFrame', 'Count'].join(''),
      ['physics', 'paint', 'play', 'range'].join('-'), ['physics', 'paint', 'workflow', 'tab--play'].join('-'), ['play', 'range', 'marker'].join('-'), ['play', 'conversion'].join('-'),
    ];
    for (const symbol of obsolete) expect(production).not.toContain(symbol);
  });

  it('retains authoritative replacement, new Play Script, and cached Roto playback names', () => {
    expect(types).toContain("kind: 'replace-roto-key-frames'");
    expect(studio).toContain('rotoPlayScript');
    expect(studio).toContain('rotoCachedPlayback');
  });

  it('extends Studio cached playback through the composite content extent (48-06 UAT-D)', () => {
    // UAT-D: keys/rails up to frame 17 played only 0-10 — the range came from
    // the LAUNCH track's end alone. Playback enumerates the flattened composite
    // (CMP-01), so the range must be the max end across EVERY Paint track.
    expect(studio).toContain('getEndFrame: () => launchContext ? physicPaintStore.getRotoPhysicalCompositeEndFrame(launchContext.layerId) : null,');
    expect(studio).not.toContain('getEndFrame: () => launchContext ? physicPaintStore.getRotoPhysicalEndFrame(launchContext.layerId, trackIdOfLaunch(launchContext)) : null,');
    expect(studio).toContain('getFrame: findCachedRotoDisplayFrame,');
    expect(navigationCoordinator).toContain('const playbackEndFrame = input.playback.getEndFrame();');
    expect(navigationCoordinator).toContain('Array.from({ length: playbackEndFrame }');
    expect(navigationCoordinator).not.toContain('const lastRealFrame = assignments.length > 0');
  });

  it('refreshes the current canvas immediately after accepted generated Group publications', () => {
    const finalizeStart = physicalEditCoordinator.indexOf('const finalizeAccepted = useCallback(');
    const finalizeEnd = physicalEditCoordinator.indexOf('const finalizeFailed = useCallback(', finalizeStart);
    const finalizeAccepted = physicalEditCoordinator.slice(finalizeStart, finalizeEnd);
    expect(finalizeStart).toBeGreaterThanOrEqual(0);
    expect(finalizeAccepted).toContain("pending.operationKind === 'play-script'");
    expect(finalizeAccepted).toContain("pending.operationKind === 'regenerate-group'");
    expect(finalizeAccepted).toContain('portsRef.current.reference.reconcileCurrentFrame(after.currentAppFrame);');
  });

  it('routes rail, keyboard, and sidebar Loop Clip edits through one Studio-local controller callback', () => {
    expect(studio).toContain('selectedLoopClipId.value = loopId;\n      return rotoPlayScript.openLoopEdit(loopId);');
    expect(studio).toContain('getLoopEditSnapshot: (placementStart) => {');
    expect(studio).toContain('physicPaintStore.getRotoPhysicalDocument(launchContext.layerId, studioActiveTrackId())');
    expect(studio).toContain('const layerEndExclusive = physicPaintStore.getRotoPhysicalCapacity(launchContext.layerId, studioActiveTrackId());');
    expect(studio).toContain('layerEndExclusive,');
    expect(studio).toContain('remainingCapacity: Math.max(0, layerEndExclusive - placementStart)');
    expect(studio).toContain('rotoParentEndExclusive: launchContext ? physicPaintStore.getRotoPhysicalCapacity(launchContext.layerId, trackIdOfLaunch(launchContext)) : 0,');
    expect(studio).not.toContain('rotoParentEndExclusive: rotoPhysicalCapacity');
    expect(studio).not.toContain('layerEndExclusive: physicalCapacity');
    expect(studio).toContain('onOpenLoopEdit: handleOpenRotoLoopEdit,');
    expect(studio).toContain('onOpenRotoLoopEdit: handleOpenRotoLoopEdit,');
    expect(studio).toContain('onCloseLoopClip: handleCloseRotoLoopClip,');
    expect(studio).toContain('selectedLoopClipId.value = null;');
    expect(scriptsPanel).toContain('void onOpenLoopEdit(selectedLoopClip.loopId);');
    expect(scriptsPanel).not.toContain('onOpenLoopEdit?.');
  });

  it('routes every paint-path document and record read through the live active track (47-01 multi-track)', () => {
    // 47-01 UAT: painting on a NEW track stored nothing — the completed-mutation
    // handler, the first-paint key promotion, and the script target resolver all
    // read the LAUNCH track's document/records. Each must resolve the document's
    // live activeTrackId so a paint on the new track persists to the new track.
    expect(studio).toContain('const document = launch ? physicPaintStore.getRotoPhysicalDocument(launch.layerId, studioActiveTrackId()) : null;');
    expect(studio).toContain('const document = physicPaintStore.getRotoPhysicalDocument(launchContext.layerId, studioActiveTrackId());');
    expect(studio).toContain('const record = physicPaintStore.getRotoRealKeyRecord(launch.layerId, studioActiveTrackId(), source.keyId);');
    // 261019-mj2 UAT: the created key is resolved from the accepted document
    // (realm authority) instead of a post-acceptance store read that could lag
    // the publication.
    expect(studio).toContain('const created = accepted.after.records.find((record) => record.appFrame === source.appFrame);');
    // Navigation selection writes must land on the active track, never the launch track.
    expect(studio).toContain('if (launch) physicPaintStore.setRotoPhysicalSelection(launch.layerId, studioActiveTrackId(), selectedKeyId.value, frame);');
    expect(studio).toContain('const selectedRecord = physicPaintStore.getRotoRealKeyRecordByAppFrame(launchContext.layerId, studioActiveTrackId(), frame);');
    expect(studio).toContain('physicPaintStore.setRotoPhysicalSelection(launchContext.layerId, studioActiveTrackId(), selectedKeyId.value, frame);');
    // 48-06 (R-2click): the startFrame propagation reseed must also read the
    // LIVE active track — the launch snapshot's activeTrackId is stale after a
    // track switch, so the rAF reseed looked up the key on the wrong track,
    // found nothing, and cleared the synchronous click selection (the first
    // click selected, the reseed cleared, only the second click survived).
    expect(studio).toContain('const liveTrackId = getEfxPaintDocument(next.layerId)?.activeTrackId ?? trackIdOfLaunch(next);');
    expect(studio).toContain('physicPaintStore.getRotoRealKeyRecordByAppFrame(next.layerId, liveTrackId, next.startFrame)?.keyId ?? null');
    expect(studio).not.toContain('physicPaintStore.getRotoRealKeyRecordByAppFrame(next.layerId, trackIdOfLaunch(next), next.startFrame)');
    // The timeline-actions resolver ports (capacity, parent end, loop clips,
    // interpolation breaks) feed the first-paint key promotion — the launch
    // track's breaks/clips fail validation against the new track's empty key
    // set, so every port must resolve the live active track.
    expect(studio).toContain('getCapacity: () => launchContext ? physicPaintStore.getRotoPhysicalCapacity(launchContext.layerId, studioActiveTrackId()) : 1,');
    expect(studio).toContain('getParentEndExclusive: () => launchContext\n      ? physicPaintStore.getRotoPhysicalCapacity(launchContext.layerId, studioActiveTrackId())\n      : 0,');
    expect(studio).toContain('getRotoLoopClips: () => launchContext ? physicPaintStore.getRotoPhysicalLoopClips(launchContext.layerId, studioActiveTrackId()) : [],');
    expect(studio).toContain('getIncomingInterpolationBreakKeyIds: () => launchContext\n      ? physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(launchContext.layerId, studioActiveTrackId())\n      : [],');
    expect(studio).toContain('getCurrentSettings: () => launchContext ? physicPaintStore.getRotoInterpolationSettings(launchContext.layerId, studioActiveTrackId()) : { enabled: false, inBetweenCount: 1, mode: \'duplicate\', deform: 0, position: 0 },');
    expect(studio).toContain('getStoreRotoFrames: () => launchContext ? physicPaintStore.getRotoCacheFrames(launchContext.layerId, studioActiveTrackId()) : [],');
    expect(studio).toContain('getFailureStatus: () => launchContext ? physicPaintStore.getRotoInterpolationFailureStatus(launchContext.layerId, studioActiveTrackId()) : null,');
    // History identity and adjacent-key navigation must also follow the active track.
    expect(studio).toContain('trackId: studioActiveTrackId(),');
    expect(studio).toContain('const currentRecord = physicPaintStore.getRotoRealKeyRecord(layerId, studioActiveTrackId(), currentKeyId);');
  });

  it('resets the track-scoped edit buffers on an in-place active-track switch (48-06 UAT-A)', () => {
    // UAT-A: any physical edit after a track switch failed closed with
    // "Frame-indexed child state is not completely owned by the pre-state
    // real-key identities", and the failed edit's recovery lease then disabled
    // every paint tool. The frame-indexed edit state holds TRACK-scoped content
    // in studio-wide buffers; the track-switch effect must reset it exactly
    // like a launch replacement does. A visibility flip of the SAME track keeps
    // the buffers (same content authority).
    const effectStart = studio.indexOf('const lastReferenceDisplayStateRef = useRef');
    const effectEnd = studio.indexOf('rotoNavigation.configureRuntimePort', effectStart);
    expect(effectStart).toBeGreaterThanOrEqual(0);
    expect(effectEnd).toBeGreaterThan(effectStart);
    const effect = studio.slice(effectStart, effectEnd);
    expect(effect).toContain('const lastEditStateTrackIdRef = useRef<string | null>(null);');
    expect(effect).toContain('if (lastEditStateTrackIdRef.current !== trackId) {');
    expect(effect).toContain('rotoEditBuffer.resetForLaunch();');
    expect(effect).toContain('rotoPersistence.confirmedFramesRef.current = new Map();');
    expect(effect).toContain('rotoEditableFramesRef.current = [];');
    expect(effect).toContain('cachedRotoReferenceUrlRef.current = null;');
    expect(effect).toContain('cachedRotoRepaintBaseFrameRef.current = null;');
    expect(effect).toContain('setCachedRotoRepaintBaseFrame(null);');
    // The reset must run BEFORE the cross-track selection guard's early return
    // so a cross-track click (crossTrackSelectionPendingRef) never skips it.
    expect(effect.indexOf('rotoEditBuffer.resetForLaunch();')).toBeLessThan(effect.indexOf('crossTrackSelectionPendingRef.current'));
  });

  it('syncs the child document to the main window so track CRUD survives the project save (47-01 persistence)', () => {
    // The Studio window owns its own efxPaintStore instance; the main window's
    // save path serializes ITS document. The child must push every document
    // mutation (track CRUD) to the main window or the added track never lands
    // in the .mce.
    expect(studio).toContain('sendEfxPaintDocumentSync(');
    expect(studio).toContain("if (layerId && (mode === 'Tauri' || mode === 'Browser fallback')) {");
    // 52.1 (gesture-idle scheduler): mutations set a dirty flag; the push runs
    // once on the idle transition, not once per mutation.
    expect(studio).toContain('documentSyncDirty.value = true;');
    expect(studio).toContain('if (!interactionIdle.value) return;');
    expect(studio).toContain('if (!documentSyncDirty.value) return;');
    // 52.1 (Part 1): the dirty flag is set ONLY on structural changes
    // (efxPaintVersion) — physical edits (physicPaintVersion) ship via
    // applyPayload and must NOT re-trigger a full-document sync.
    expect(studio).toContain('}, [efxPaintVersion.value]);');
    expect(studio).not.toContain('[efxPaintVersion.value, physicPaintVersion.value]');
    // 52.1 (Part 1): the flush (save/export) pushes the document ONLY when a
    // structural change is pending — the auto-save → flush path must not
    // re-serialize the full document on physical edits.
    expect(studio).toContain('if (!documentSyncDirty.peek()) return;');
    expect(main).toContain('installPhysicPaintEfxPaintDocumentListener()');
    // The main-window listener is fail-closed (canonical parser) and
    // idempotency-guarded by document revision (the launch push is a no-op).
    expect(bridge).toContain("PHYSIC_PAINT_EFX_PAINT_DOCUMENT_EVENT = 'physic-paint:efx-paint-document'");
    expect(bridge).toContain('installPhysicPaintEfxPaintDocumentListener');
    expect(bridge).toContain('parseEfxPaintDocument(fromTransportPayload(incoming.document ?? payload))');
    // Display-persistence fix (uncommitted, 2026-09-21): the idempotency guard
    // moved from the bare document revision to the sync fingerprint — the
    // revision plus the photo-reference display term — so a display-only change
    // is no longer skipped as "equal". Same law, wider comparison.
    expect(bridge).toContain('buildEfxPaintDocumentSyncFingerprint(current) === buildEfxPaintDocumentSyncFingerprint(document)');
    // 49-06 (UAT round 11): the child carries its runtime background source
    // bytes with the sync (the main window's registry is only hydrated at
    // project load), and the listener registers them BEFORE the revision guard.
    expect(studio).toContain('getBackgroundSourceImageBytes(ref)');
    expect(bridge).toContain('registerBackgroundSourceImage(ref, bytes)');
  });

  it('the per-row frame-blending toggle ships to the parent through the physical coordinator (quick-260913-52r D)', () => {
    // The direct store write shipped nowhere: the 52.1 auto-push keys on
    // efxPaintVersion, and the doc-sync mirror refuses the reference-shaped
    // wire document (canonical revision mismatch). The one path that reaches
    // the parent runtime — and therefore the save and the reopen — is the
    // physical coordinator's interpolation op.
    expect(studio).toContain("operationKind: 'set-interpolation-enabled',");
    expect(studio).toContain('void physicalEditCoordinator.executePhysicalEdit({');
    expect(studio).not.toContain('markDocumentSyncDirtyRef');
  });
});

describe('Physics Paint canonical Group authority boundary (43.2-17, D-05/D-38)', () => {
  it('derives accepted Groups from the canonical store and existing physicPaintVersion channel', () => {
    const storeImport = studio
      .split('\n')
      .find((line) => line.includes("from '../../stores/physicPaintStore';"));
    expect(storeImport).toContain('physicPaintRotoPhysicalOperationLeaseVersion');
    expect(storeImport).toContain('physicPaintStore');
    expect(storeImport).toContain('physicPaintVersion');
    // 47-01 UAT round 8: the strip subscriptions read the THROTTLED paint
    // revision (trailing 150ms flush) so a stroke burst does not re-render the
    // whole Studio per paint event. The live active-track id is a memo key too
    // (studio-realm-divergence): the throttled revisions lag 1-2s behind
    // setActiveTrackId, which left the rich lane painting the previous track's
    // keys at the new row until the throttle fired. rotoPhysicalRevision is the
    // STRUCTURAL clock (record/loop/break replacement only, never stroke frame
    // writes) — a move/cut/paste repaints the lane immediately instead of
    // sitting in the stroke throttle's 1s stale window.
    expect(studio).toContain('const rotoLoopClips = useMemo(() => launchContext ? physicPaintStore.getRotoPhysicalLoopClips(launchContext.layerId, activeTrackIdForReads) : PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY, [launchContext?.layerId, activeTrackIdForReads, rotoPhysicalRevision.value, throttledPaintRevision.value, throttledEfxRevision.value]);');
    expect(studio).toContain('getRotoPhysicalDocument: (layerId, trackId) => physicPaintStore.getRotoPhysicalDocument(layerId, trackId),');
    expect(studio).toContain('getRotoPhysicalRenderSource: (layerId, trackId, appFrame) => physicPaintStore.getRotoPhysicalRenderSource(layerId, trackId, appFrame),');
    // studio-onion-skinning: the onion memo must resolve render sources on the
    // LIVE active track (the same authority rotoKeyRecords reads) — the launch
    // snapshot's activeTrackId is frozen at launch, so trackIdOfLaunch here
    // dropped every candidate after an in-Studio track switch (keyId mismatch
    // at rotoOnionPreview.ts:124 → empty projection → no onion).
    expect(studio).toContain('getRenderSource: (appFrame) => launchContext ? physicPaintStore.getRotoPhysicalRenderSource(launchContext.layerId, activeTrackIdForReads, appFrame) : null,');
    expect(studio).toContain('}), [currentFrame, isPlaying, onion, rotoKeyRecords, activeTrackIdForReads, launchContext, rotoOnionPreviewFrames, rotoOnionDirtyFrames]);');
    expect(studio.includes('getRotoPhysicalRenderSource(launchContext.layerId, trackIdOfLaunch(launchContext), appFrame)')).toBe(false);

    for (const secondAuthority of [
      'useSignal<readonly PhysicPaintRotoLoopClip',
      'useState<readonly PhysicPaintRotoLoopClip',
      'useState<PhysicPaintRotoLoopClip',
      'resolvePhysicPaintRotoGroupLifecycleFrame',
      'const [rotoLoopClips',
      'const groupDocument = useSignal',
      'const groupVersion = useSignal',
    ]) expect(studio).not.toContain(secondAuthority);
  });

  it('routes Group Paint activation and completion by Group identity and restores accepted content when capture rejects', () => {
    expect(studio).toContain('resolveRotoCompletedGroupPaintTarget(document, currentFrame, currentCellKeyId)');
    expect(studio).toContain("paintTarget?.kind === 'group-frame'");
    expect(studio).not.toContain("groupTarget?.kind === 'group-gap'");
    expect(studio).toContain('resolveRotoCompletedGroupPaintTarget(document, appFrame, currentCellKeyId)');
    expect(studio).toContain("completedTarget.kind === 'group-frame'");
    expect(studio).toContain('keyId: keyId ?? undefined');
    expect(studio).toContain('if (!await capture && shouldReloadRotoFrameAfterFailedCapture()) {');
    expect(studio).toContain('engineRef.current as PreviewBackgroundEngine | null,\n          undefined,\n          true,');
  });

  it('stamps records-only ownership rebuilds with the complete canonical revision', () => {
    const replacementStart = studio.indexOf('const replacePhysicalRecordsWithOwnership = (');
    const replacementEnd = studio.indexOf('const replacePhysicalDocumentWithOwnership = (', replacementStart);
    const replacement = studio.slice(replacementStart, replacementEnd);
    expect(replacementStart).toBeGreaterThanOrEqual(0);
    expect(replacement).toContain('getRotoPhysicalLoopClips(layerId, studioActiveTrackId())');
    expect(replacement).toContain('getRotoPhysicalIncomingInterpolationBreakKeyIds(layerId, studioActiveTrackId())');
    expect(replacement).toContain('getRotoGroupOverrideRecords(layerId, studioActiveTrackId())');
    expect(replacement).toContain('records,\n      interpolation,\n      currentLoopClips,\n      currentIncomingBreaks,\n      currentGroupOverrides,');
    expect(replacement).toContain('contentRevision: nextRevision');
  });

  it('keeps deferred Group and Action editing surfaces absent from the accepted Studio UI', () => {
    const production = [studio, studioView, scriptsPanel, workflowStrip, rightPanel, toolRail, topBar, playScriptDialog].join('\n');
    for (const deferredSurface of [
      'Update Action from Group Frame',
      'Relink Group',
      // 'Push Right' / 'Push Left' were removed from this deferred list by
      // 43.5-05 — the directional Push tools are now an accepted armed-tool
      // surface in the strip's bottom action row.
      'Key Group',
      'Scissor Group',
      'Action Content Editor',
      'Add Paint Track',
    ]) expect(production).not.toContain(deferredSurface);
  });
});

describe('Physics Paint Group and Action cross-selection (43.2-15)', () => {
  it('derives deduplicated placement-ordered linked Groups from accepted Action identity', () => {
    expect(studio).toContain('const activeLinkedLoopClipId = useSignal<string | null>(null);');
    expect(studio).toContain('function getLinkedRotoGroupsForAction(');
    expect(studio).toContain('.filter((loopClip) => loopClip.scriptId === actionId)');
    expect(studio).toContain('if (!groupsById.has(loopClip.loopId)) groupsById.set(loopClip.loopId, loopClip);');
    expect(studio).toContain('left.placementStart - right.placementStart || left.loopId.localeCompare(right.loopId)');
    expect(studio).toContain('[launchContext?.layerId, activeTrackIdForReads, rotoPhysicalRevision.value, throttledPaintRevision.value, throttledEfxRevision.value]');
  });

  it('reveals only an available source Action when a stable Group is selected', () => {
    const selectionStart = studio.indexOf('const handleSelectRotoLoopClip = useCallback((');
    const selectionEnd = studio.indexOf('const handleOpenRotoLoopEdit', selectionStart);
    const selection = studio.slice(selectionStart, selectionEnd);
    expect(selectionStart).toBeGreaterThanOrEqual(0);
    expect(selection).toContain('const selectedGroup = rotoLoopClips.find((loopClip) => loopClip.loopId === next.primaryLoopClipId);');
    expect(selection).toContain('loopScriptRows.some((row) => row.id === selectedGroup.scriptId)');
    expect(selection).toContain('rotoScriptLibrary.select(selectedGroup.scriptId);');
    expect(selection).not.toContain('rotoScriptLibrary.select(loopId);');
  });

  it('activates an Action without seeking or creating orange operation selection', () => {
    const activationStart = studio.indexOf('const handleScriptRowActivate = useCallback(async (id: string) => {');
    const activationEnd = studio.indexOf('const handleSelectedScriptLoadAndApply', activationStart);
    const activation = studio.slice(activationStart, activationEnd);
    expect(activationStart).toBeGreaterThanOrEqual(0);
    expect(activation).toContain('const loaded = await rotoScriptLibrary.activateAndLoad(id);');
    expect(activation).toContain('chooseCursorRelativeLinkedGroup(linkedGroups, cursorFrame)');
    expect(activation).toContain('activeLinkedLoopClipId.value =');
    for (const forbidden of ['selectedLoopClipId.value =', 'selectedLoopClipIds.value =', 'handleNavigateToSyncedFrame', 'navigateToSyncedPhysicalFrame']) {
      expect(activation).not.toContain(forbidden);
    }
  });

  it('passes passive Action linkage to the Group Rail without changing selected Group scope', () => {
    expect(studio).toContain('linkedRotoLoopClipIds: linkedRotoGroups.map((group) => group.loopId)');
    expect(studio).toContain('linkedRotoActionName: selectedAction?.name ?? null');
    expect(workflowStrip).toContain('linkedLoopClipIds={props.linkedRotoLoopClipIds ?? []}');
    expect(workflowStrip).toContain('linkedActionName={props.linkedRotoActionName ?? null}');
    expect(workflowStrip).toContain('selectedLoopClipIds={props.selectedRotoLoopClipIds ?? []}');
  });

  it('projects one cursor-relative current Group without mutating the cursor', () => {
    expect(studio).toContain('const effectiveLinkedGroup = linkedRotoGroups.find((group) => group.loopId === activeLinkedLoopClipId.value)');
    expect(studio).toContain('?? chooseCursorRelativeLinkedGroup(linkedRotoGroups, currentFrame);');
    expect(studio).toContain('currentIndex: effectiveLinkedGroupIndex,');
    expect(studio).toContain('total: linkedRotoGroups.length,');
  });

  it('navigates explicitly by placement without wrapping and seeks only after selecting the target Group', () => {
    const navigationStart = studio.indexOf('const navigateLinkedGroup = useCallback((targetIndex: number) => {');
    const navigationEnd = studio.indexOf('const rotoNavigationActions', navigationStart);
    const navigation = studio.slice(navigationStart, navigationEnd);
    expect(navigationStart).toBeGreaterThanOrEqual(0);
    expect(navigation).toContain('if (targetIndex < 0 || targetIndex >= linkedRotoGroups.length) return;');
    expect(navigation).toContain('handleSelectRotoLoopClip(target.loopId);');
    expect(navigation).toContain('activeLinkedLoopClipId.value = target.loopId;');
    expect(navigation).toContain('handleNavigateToSyncedFrame(target.placementStart);');
    expect(navigation.indexOf('handleNavigateToSyncedFrame(target.placementStart);')).toBeGreaterThan(navigation.indexOf('handleSelectRotoLoopClip(target.loopId);'));
    expect(navigation).not.toContain('% linkedRotoGroups.length');
  });

  it('wires zero, one, and many navigation through stable Actions inspector props', () => {
    expect(studio).toContain('linkedGroupNavigation: linkedRotoGroups.length === 0 || effectiveLinkedGroupIndex < 0');
    expect(studio).toContain('onPrevious: handlePreviousLinkedGroup');
    expect(studio).toContain('onNext: handleNextLinkedGroup');
    expect(studio).toContain('onGoToGroup: handleGoToLinkedGroup');
  });
});

describe('Physics Paint Roto rail and physical spacing selection wiring', () => {
  it('owns session-only physical and rail selection Signals without effect mirroring', () => {
    expect(studio).toContain('const rotoSpacingSelection = useSignal<PhysicsPaintRotoSpacingSelection | null>(null);');
    expect(studio).toContain('const selectedLoopClipIds = useSignal<readonly string[]>([]);');
    expect(studio).toContain('const loopSelectionAnchorId = useSignal<string | null>(null);');
    expect(studio).toContain('getRotoSpacingSelection: () => reconcilePhysicsPaintRotoSpacingSelection(');
    expect(studio).toContain('getSelectedLoopClipIds: () => effectiveRotoLoopClipSelection?.selectedLoopClipIds ?? []');
    expect(studio).toContain('selectedRotoLoopClipIds: effectiveSelectedLoopClipIds');
    expect(studio).toContain('rotoSpacingSelection: effectiveRotoSpacingSelection');
    expect(studio).not.toContain('selectedRotoLoopSourceKeyIds');
    expect(studio).not.toContain('useState<PhysicsPaintRotoSpacingSelection');
    expect(studio).not.toContain('useEffect(() => {\n    rotoSpacingSelection');
    expect(studio).not.toContain('useEffect(() => {\n    selectedLoopClipIds');
  });

  it('makes rail and physical-key selection mutually exclusive in synchronous handlers', () => {
    expect(studio).toContain('const clearRotoLoopSelection = useCallback(() => {');
    expect(studio).toContain('selectedLoopClipIds.value = [];\n    loopSelectionAnchorId.value = null;\n    selectedLoopClipId.value = null;');
    expect(studio).toContain('const handleSelectRotoLoopClip = useCallback((\n    loopId: string | null,\n    gesture: PhysicsPaintRotoSpacingSelectionGesture = \'plain\',');
    expect(studio).toContain('selectedKeyIds.value = [];\n    selectionAnchorKeyId.value = null;\n    rotoSpacingSelection.value = null;');
    expect(studio).toContain('clearRotoLoopSelection();\n    const current = rotoSpacingSelection.peek();');
    expect(studio).toContain('clearRotoLoopSelection();\n    const result = toggleRotoKeySelection(');
    expect(studio).toContain('clearRotoLoopSelection();\n    const next = collapseRotoKeySelection(keyId);');
    expect(studio).toContain('clearRotoLoopSelection();\n    const result = extendRotoKeySelectionRange(');
  });

  it('publishes canonical null-key authority before activating Group selection', () => {
    const selectionStart = studio.indexOf('const handleSelectRotoLoopClip = useCallback((');
    const selectionEnd = studio.indexOf('const handleOpenRotoLoopEdit', selectionStart);
    const selection = studio.slice(selectionStart, selectionEnd);
    expect(selectionStart).toBeGreaterThanOrEqual(0);
    expect(selection).toContain('selectedKeyId.value = null;');
    expect(selection).toContain('physicPaintStore.setRotoPhysicalSelection(\n        launchContext.layerId,\n        studioActiveTrackId(),\n        null,\n        currentFrame,\n      );');
    // studio-realm-divergence: a selection write must follow the LIVE active
    // track (the clicked row), never the frozen launch snapshot — a Paint n
    // write to trackIdOfLaunch left the target track's selection stale and the
    // group-lifecycle stale-doc barrier rejected every later delete there.
    expect(selection).not.toContain('setRotoPhysicalSelection(\n        launchContext.layerId,\n        trackIdOfLaunch(launchContext),');
    expect(selection).toContain('selectedKeyIds.value = [];\n    selectionAnchorKeyId.value = null;\n    rotoSpacingSelection.value = null;');

    const clearPrimaryIndex = selection.indexOf('selectedKeyId.value = null;');
    const clearMultiIndex = selection.indexOf('selectedKeyIds.value = [];');
    const publishCanonicalIndex = selection.indexOf('physicPaintStore.setRotoPhysicalSelection(');
    const publishGroupIndex = selection.indexOf('selectedLoopClipIds.value = next.selectedLoopClipIds;');
    const revealActionIndex = selection.indexOf('rotoScriptLibrary.select(selectedGroup.scriptId);');
    expect(clearMultiIndex).toBeGreaterThan(clearPrimaryIndex);
    expect(publishCanonicalIndex).toBeGreaterThan(clearMultiIndex);
    expect(publishGroupIndex).toBeGreaterThan(publishCanonicalIndex);
    expect(revealActionIndex).toBeGreaterThan(publishGroupIndex);
  });

  it('replaces the primary selection before publishing the complete Select All set', () => {
    const selectAllStart = studio.indexOf('const selectAllRotoKeys = useCallback(() => {');
    const selectAllEnd = studio.indexOf('const [, setLastError]', selectAllStart);
    const selectAll = studio.slice(selectAllStart, selectAllEnd);
    expect(selectAllStart).toBeGreaterThanOrEqual(0);
    expect(selectAll).toContain('selectedKeyId.value = null;');
    expect(selectAll).toContain('physicPaintStore.setRotoPhysicalSelection(\n        launchContext.layerId,\n        studioActiveTrackId(),\n        null,\n        currentFrame,\n      );');
    expect(selectAll).toContain('selectAllRotoKeyIds(\n      orderedRealKeyIds,\n      null,\n    );');
    expect(selectAll).toContain('rotoSpacingSelection.value = null;');
    expect(selectAll).toContain('selectedLoopClipIds.value = [];');
    expect(selectAll).toContain('loopSelectionAnchorId.value = null;');
    expect(selectAll).toContain('selectedLoopClipId.value = null;');
    expect(selectAll).toContain("setApplyMessage('All keys selected');");

    const clearPrimaryIndex = selectAll.indexOf('selectedKeyId.value = null;');
    const clearStoreIndex = selectAll.indexOf('physicPaintStore.setRotoPhysicalSelection(');
    const publishAllIndex = selectAll.indexOf('selectedKeyIds.value = next.selectedKeyIds;');
    expect(clearStoreIndex).toBeGreaterThan(clearPrimaryIndex);
    expect(publishAllIndex).toBeGreaterThan(clearStoreIndex);
  });

  it('builds physical history snapshots from live launch, store, selection, and cursor authority', () => {
    const snapshotStart = studio.indexOf('getLiveSourceSnapshot: () => {');
    const snapshotEnd = studio.indexOf('referencedActionHistory:', snapshotStart);
    const snapshot = studio.slice(snapshotStart, snapshotEnd);
    expect(snapshotStart).toBeGreaterThanOrEqual(0);
    expect(snapshot).toContain('const liveLaunch = launchContextRef.current;');
    expect(snapshot).toContain('const liveSelectedKeyId = selectedKeyId.peek();');
    expect(snapshot).toContain('physicPaintStore.getRotoRealKeyRecords(layerId, studioActiveTrackId())');
    expect(snapshot).toContain('physicPaintStore.getRotoGroupOverrideRecords(layerId, studioActiveTrackId())');
    expect(snapshot).toContain('physicPaintStore.getRotoPhysicalLoopClips(layerId, studioActiveTrackId())');
    expect(snapshot).toContain('physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(layerId, studioActiveTrackId())');
    expect(snapshot).toContain('currentAppFrame: liveLaunch?.startFrame ?? 0,');
    expect(snapshot).not.toContain('acceptedOutput');
  });

  it('settles accepted move, Undo, and Redo through the shared Group-aware selection reducer', () => {
    const routeStart = studio.indexOf('physicalEditCoordinatorRouteRef.current = {');
    const routeEnd = studio.indexOf('const handlePhysicsPaintKeyDown', routeStart);
    const route = studio.slice(routeStart, routeEnd);
    expect(routeStart).toBeGreaterThanOrEqual(0);
    expect(route).toContain('resolvePostAcceptanceRotoStudioSelection({');
    expect(route).toContain('selectedLoopClipIds: selectedLoopClipIds.peek(),');
    expect(route).toContain('selectedLoopClipId: selectedLoopClipId.peek(),');
    expect(route).toContain('operationKind: accepted.operationKind,');
    expect(route).toContain('selectedLoopClipIds.value = nextSelection.selectedLoopClipIds;');
    expect(route).toContain('selectedLoopClipId.value = nextSelection.selectedLoopClipId;');
    expect(route).toContain('selectedKeyIds.value = nextSelection.keySelection.selectedKeyIds;');
    expect(route).toContain('selectionAnchorKeyId.value = nextSelection.keySelection.anchorKeyId;');
  });

  it('resets all spacing selection on launch replacement and session reset, while accepted spacing keeps identities', () => {
    expect(studio).toContain('rotoSpacingSelection.value = null;');
    expect(studio).toContain('selectedLoopClipIds.value = [];');
    expect(studio).toContain('loopSelectionAnchorId.value = null;');
    expect(studio).toContain('resetRotoSpacingSelectionSession');
    expect(studio).toContain("operationKind: accepted.operationKind");
    expect(studio).not.toContain("accepted.operationKind === 'force-spacing'\n          ? null");
  });

  it('routes proxy gestures and clears active key selection when an empty frame is selected', () => {
    expect(studio).toContain('selectPhysicsPaintRotoSpacingProxyPlain(');
    expect(studio).toContain('togglePhysicsPaintRotoSpacingProxy(');
    expect(studio).toContain('extendPhysicsPaintRotoSpacingProxyRange(');
    expect(studio).toContain('selectedKeyIds.value = next?.selectedSourceKeyIds ?? [];');
    expect(studio).toContain('onSelectRotoSpacingProxy: handleSelectRotoSpacingProxy');
    expect(studio).toContain('onClearRotoSpacingSelection: handleClearRotoSpacingSelection');
    expect(studio).toContain('const handleClearRotoKeySelection = useCallback(() => {\n    publishOperationResult(null);\n    selectedKeyIds.value = [];\n    selectionAnchorKeyId.value = null;');
    expect(studio).toContain('onClearRotoKeySelection: handleClearRotoKeySelection');
  });

  it('clears the pre-paste single-rail/key selection when the pasted set becomes the active rail-set selection (UAT-4 Defect 2)', () => {
    // After a single-rail Paste/Duplicate the pasted set becomes the rail-set
    // selection. The pre-paste single-rail/key signals must clear so the
    // selection PAINT equals the selection MODEL — otherwise the original rail
    // stays painted selected alongside the pasted set.
    expect(studio).toContain(`if (accepted.operationKind === 'paste' || accepted.operationKind === 'delete-rails') {`);
    expect(studio).toContain('selectedRotoKeyRail.value = null;');
    expect(studio).toContain('selectedKeyId.value = null;');
    expect(studio).toContain('selectedKeyIds.value = [];');
    expect(studio).toContain('selectionAnchorKeyId.value = null;');
    expect(studio).toContain('selectedLoopClipId.value = null;');
    expect(studio).toContain('selectedLoopClipIds.value = [];');
  });
});

describe('Physics Paint Key Rail selection authority (43.4-06)', () => {
  it('owns exact Key Rail identity as session-only Signal state', () => {
    expect(studio).toContain("import { deriveKeyRailSegments } from './view/physicsPaintKeyRailPresentation';");
    expect(studio).toContain('type RotoKeyRailSelection');
    expect(studio).toContain('const selectedRotoKeyRail = useSignal<RotoKeyRailSelection | null>(null);');
    expect(studio).toContain('Session-local Key Rail selection');
    expect(studio).toContain('never persisted and never sent across the bridge');
    expect([bridge, types, projectTypes, store].join('\n')).not.toContain('selectedRotoKeyRail');
  });

  it('makes Key Rail, Group Rail, and physical selection mutually exclusive synchronously', () => {
    const keyRailStart = studio.indexOf('const handleSelectRotoKeyRail = useCallback((');
    const keyRailEnd = studio.indexOf('const handleSelectRotoLoopClip', keyRailStart);
    const keyRailSelection = studio.slice(keyRailStart, keyRailEnd);
    expect(keyRailStart).toBeGreaterThanOrEqual(0);
    expect(keyRailSelection).toContain('clearRotoLoopSelection();');
    expect(keyRailSelection).toContain('selectedKeyId.value = null;');
    expect(keyRailSelection).toContain('selectedKeyIds.value = [];');
    expect(keyRailSelection).toContain('selectionAnchorKeyId.value = null;');
    expect(keyRailSelection).toContain('rotoSpacingSelection.value = null;');
    expect(keyRailSelection).toContain('selectedRotoKeyRail.value = selection;');
    expect(keyRailSelection).toContain('physicPaintStore.setRotoPhysicalSelection(');

    const groupStart = studio.indexOf('const handleSelectRotoLoopClip = useCallback((');
    const groupEnd = studio.indexOf('const handleOpenRotoLoopEdit', groupStart);
    expect(studio.slice(groupStart, groupEnd)).toContain('selectedRotoKeyRail.value = null;');

    for (const handler of [
      'const handleSelectRotoSpacingProxy = useCallback((',
      'const handleToggleRotoKeySelection = useCallback(',
      'const handleCollapseRotoSelectionToKey = useCallback(',
      'const handleExtendRotoKeySelection = useCallback(',
    ]) {
      const start = studio.indexOf(handler);
      const end = studio.indexOf('\n  const ', start + handler.length);
      expect(start, handler).toBeGreaterThanOrEqual(0);
      expect(studio.slice(start, end)).toContain('selectedRotoKeyRail.value = null;');
    }
  });

  it('clears Key Rail selection on launch replacement and Select All', () => {
    const launchStart = studio.indexOf('if (next?.operationId !== current?.operationId || next?.layerId !== current?.layerId) {');
    const launchEnd = studio.indexOf('} else if (next && next.startFrame !== current?.startFrame)', launchStart);
    expect(studio.slice(launchStart, launchEnd)).toContain('selectedRotoKeyRail.value = null;');

    const selectAllStart = studio.indexOf('const selectAllRotoKeys = useCallback(() => {');
    const selectAllEnd = studio.indexOf('const [, setLastError]', selectAllStart);
    expect(studio.slice(selectAllStart, selectAllEnd)).toContain('selectedRotoKeyRail.value = null;');
  });

  it('fails closed when accepted Key Rail identity no longer exactly matches canonical derivation', () => {
    expect(studio).toContain('const keyRailGroupOwnedKeyIds = useMemo(() => {');
    expect(studio).toContain('clip.sourceKeyIds.forEach((keyId) => owned.add(keyId));');
    expect(studio).toContain('(clip.frameOverrides ?? []).forEach((override) => owned.add(override.keyId));');
    expect(studio).toContain('const keyRailSegments = useMemo(() => deriveKeyRailSegments({');
    expect(studio).toContain('incomingInterpolationBreakKeyIds: new Set(rotoIncomingInterpolationBreakKeyIds),');
    expect(studio).toContain('groupOwnedKeyIds: keyRailGroupOwnedKeyIds,');
    expect(studio).toContain('const effectiveSelectedRotoKeyRail = reconcileRotoKeyRailSelection(');
    expect(studio).toContain('selection.firstKeyId === segment.firstKeyId');
    expect(studio).toContain('selection.keyIds.length === segment.keyIds.length');
    expect(studio).toContain('selection.keyIds.every((keyId, index) => keyId === segment.keyIds[index])');
    expect(studio).toContain('if (selectedRotoKeyRail.peek() !== null\n    && (effectiveSelectedRotoKeyRail === null || selectedKeyId.value !== null || selectedKeyIds.value.length > 0)) {\n    selectedRotoKeyRail.value = null;\n  }');
    expect(studio).not.toContain('keyRailSegments[0]');
  });

  it('clears Key Rail selection when any physical key is selected (43.4 defect 3)', () => {
    const reconcileStart = studio.indexOf('const effectiveSelectedRotoKeyRail = reconcileRotoKeyRailSelection(');
    const reconcileEnd = studio.indexOf('const orderedRotoLoopClipIds', reconcileStart);
    const reconcile = studio.slice(reconcileStart, reconcileEnd);
    expect(reconcileStart).toBeGreaterThanOrEqual(0);
    expect(reconcile).toContain('selectedRotoKeyRail.peek() !== null');
    expect(reconcile).toContain('selectedKeyId.value !== null');
    expect(reconcile).toContain('selectedKeyIds.value.length > 0');
    expect(reconcile).toContain('selectedRotoKeyRail.value = null;');
  });

  it('feeds classifier and strip paint from the reconciled selection with mode-resolved Rail deletion copy', () => {
    expect(studio).toContain('getSelectedKeyRail: () => effectiveSelectedRotoKeyRail,');
    expect(studio).toContain('selectedRotoKeyRail: effectiveSelectedRotoKeyRail');
    expect(studio).toContain('onSelectRotoKeyRail: handleSelectRotoKeyRail');
    expect(studio).toContain('onRotoKeyRailDragRejected: handleRotoKeyRailDragRejected');
    expect(studio).toContain('rotoParentEndExclusive: launchContext ? physicPaintStore.getRotoPhysicalCapacity(launchContext.layerId, trackIdOfLaunch(launchContext)) : 0');
    expect(studio).toContain("const deletedGroupMode = rotoLoopClips.find((clip) => clip.loopId === target.groupId)?.mode\n      ?? 'progressive';");
    expect(studio).toContain("target.operationKind === 'delete-group'\n      ? deletedGroupMode === 'static'\n        ? `Deleted Static Rail at F${target.phaseOrigin}.`\n        : `Deleted Motion Rail at F${target.phaseOrigin}.`\n      : `Deleted F${target.appFrame} from Rail at F${target.phaseOrigin}.`");
  });

  it('pins the shared rail focus treatment on both :focus and :focus-visible — no selection box (43.4 defect 6/8, 47 close-out UAT round 10)', () => {
    const focusRule = css.slice(css.indexOf('.physics-paint-rail-target:focus,'));
    expect(focusRule).toContain('.physics-paint-rail-target:focus,\n.physics-paint-rail-target:focus-visible {');
    expect(focusRule).toContain('outline: none');
    // The selection ring was removed: every rail family selects with the same
    // orange segment, and frames/keys paint an orange background fill.
    expect(css).not.toContain('.physics-paint-rail-target:focus-visible::after');
    expect(css).not.toContain('.physics-paint-key-rail-target:focus,');
    expect(css).not.toContain('.physics-paint-key-rail-target:focus-visible {\n  outline: 2px solid #2d5be3');
  });
});

describe('Physics Paint multi-rail selection SET wiring (43.6-01)', () => {
  it('owns the session-only rail-set Signal and clears it on launch replacement', () => {
    expect(studio).toContain('const railSetSelection = useSignal<RailSetSelectionState | null>(null);');
    const launchStart = studio.indexOf('if (next?.operationId !== current?.operationId || next?.layerId !== current?.layerId) {');
    const launchEnd = studio.indexOf('} else if (next && next.startFrame !== current?.startFrame)', launchStart);
    expect(studio.slice(launchStart, launchEnd)).toContain('railSetSelection.value = null;');
  });

  it('derives one canonical cross-type ordering authority for gestures and reconcile', () => {
    expect(studio).toContain('const orderedRailSetIdentities = useMemo(\n    () => deriveRailSetOrder({');
    expect(studio).toContain('keyRailSegments,');
    expect(studio).toContain('loopRanges: loopResolutionContext?.ranges ?? [],');
  });

  it('reconciles the set against fresh ordering on every render and clears invalid sets (Pitfall 2)', () => {
    const reconcileStart = studio.indexOf('const effectiveRailSetSelection = reconcileRailSetSelection(');
    const reconcileEnd = studio.indexOf('const timelineOccupiedRotoFrames', reconcileStart);
    const reconcile = studio.slice(reconcileStart, reconcileEnd);
    expect(reconcileStart).toBeGreaterThanOrEqual(0);
    expect(reconcile).toContain('railSetSelection.value,');
    expect(reconcile).toContain('orderedRailSetIdentities,');
    expect(reconcile).toContain('railSetSelection.peek() !== null && effectiveRailSetSelection === null');
    expect(reconcile).toContain('railSetSelection.value = null;');
  });

  it('routes Loop Rail modifier gestures through the set reducer and collapses on plain (D-04)', () => {
    const selectionStart = studio.indexOf('const handleSelectRotoLoopClip = useCallback((');
    const selectionEnd = studio.indexOf('const handleOpenRotoLoopEdit', selectionStart);
    const selection = studio.slice(selectionStart, selectionEnd);
    expect(selectionStart).toBeGreaterThanOrEqual(0);
    expect(selection).toContain("gesture === 'toggle' || gesture === 'range' || gesture === 'union'");
    expect(selection).toContain('updatePhysicsPaintRotoRailSetSelection(');
    expect(selection).toContain('seedRailSetSelection(railSetSelection.peek(),');
    expect(selection).toContain('updatePhysicsPaintRotoRailSetSelection(currentSet,');
    expect(selection).toContain('orderedRailSetIdentities,');
    expect(selection).toContain('railSetSelection.value = next;');
    expect(selection).toContain('railSetSelection.value = null;');
  });

  it('routes Key Rail modifier gestures through the set reducer and collapses on plain (D-04)', () => {
    const selectionStart = studio.indexOf('const handleSelectRotoKeyRail = useCallback((');
    const selectionEnd = studio.indexOf('const handleSelectRotoLoopClip', selectionStart);
    const selection = studio.slice(selectionStart, selectionEnd);
    expect(selectionStart).toBeGreaterThanOrEqual(0);
    expect(selection).toContain("gesture === 'toggle' || gesture === 'range' || gesture === 'union'");
    expect(selection).toContain('updatePhysicsPaintRotoRailSetSelection(');
    expect(selection).toContain('seedRailSetSelection(railSetSelection.peek(),');
    expect(selection).toContain('updatePhysicsPaintRotoRailSetSelection(currentSet,');
    expect(selection).toContain('railSetSelection.value = next;');
    expect(selection).toContain('railSetSelection.value = null;');
  });

  it('seeds the set from the plain-selected single-rail signals on the first modifier gesture (43.6-08 M1)', () => {
    const keyRailStart = studio.indexOf('const handleSelectRotoKeyRail = useCallback((');
    const keyRailEnd = studio.indexOf('const handleSelectRotoLoopClip', keyRailStart);
    const keyRailHandler = studio.slice(keyRailStart, keyRailEnd);
    expect(keyRailStart).toBeGreaterThanOrEqual(0);
    expect(keyRailHandler).toContain("selectedRotoKeyRail.value !== null");
    expect(keyRailHandler).toContain("{ kind: 'key-rail', firstKeyId: selectedRotoKeyRail.value.firstKeyId }");

    const loopStart = studio.indexOf('const handleSelectRotoLoopClip = useCallback((');
    const loopEnd = studio.indexOf('const handleOpenRotoLoopEdit', loopStart);
    const loopHandler = studio.slice(loopStart, loopEnd);
    expect(loopStart).toBeGreaterThanOrEqual(0);
    expect(loopHandler).toContain('selectedLoopClipId.value !== null');
    expect(loopHandler).toContain("{ kind: 'loop', loopId: selectedLoopClipId.value }");
  });

  it('seeds the set from the live cross-type single-rail signal with key-rail-first ordering (43.6-10 WR-01)', () => {
    // Cross-type, key-rail-first direction: the Key Rail handler must also read
    // the Loop rail's live signal so a plain-selected Loop rail is carried into
    // the set when the first modifier gesture lands on a Key rail.
    const keyRailStart = studio.indexOf('const handleSelectRotoKeyRail = useCallback((');
    const keyRailEnd = studio.indexOf('const handleSelectRotoLoopClip', keyRailStart);
    const keyRailHandler = studio.slice(keyRailStart, keyRailEnd);
    expect(keyRailStart).toBeGreaterThanOrEqual(0);
    expect(keyRailHandler).toContain('selectedRotoKeyRail.value !== null');
    expect(keyRailHandler).toContain('selectedLoopClipId.value !== null');
    // Key-rail-first derivation order inside the Key Rail handler.
    expect(keyRailHandler.indexOf('selectedRotoKeyRail.value !== null'))
      .toBeLessThan(keyRailHandler.indexOf('selectedLoopClipId.value !== null'));

    // Cross-type, loop-first direction: the Loop Rail handler must also read
    // the Key rail's live signal so a plain-selected Key rail is carried into
    // the set when the first modifier gesture lands on a Loop rail.
    const loopStart = studio.indexOf('const handleSelectRotoLoopClip = useCallback((');
    const loopEnd = studio.indexOf('const handleOpenRotoLoopEdit', loopStart);
    const loopHandler = studio.slice(loopStart, loopEnd);
    expect(loopStart).toBeGreaterThanOrEqual(0);
    expect(loopHandler).toContain('selectedRotoKeyRail.value !== null');
    expect(loopHandler).toContain('selectedLoopClipId.value !== null');
    // Key-rail-first derivation order inside the Loop Rail handler.
    expect(loopHandler.indexOf('selectedRotoKeyRail.value !== null'))
      .toBeLessThan(loopHandler.indexOf('selectedLoopClipId.value !== null'));
  });

  it('collapses the set as its own Escape layer before key-selection collapse (D-04)', () => {
    const collapseStart = studio.indexOf('collapseRotoSelection: () => {');
    const collapseEnd = studio.indexOf('toggleShortcuts:', collapseStart);
    const collapse = studio.slice(collapseStart, collapseEnd);
    expect(collapseStart).toBeGreaterThanOrEqual(0);
    // 261022-mne: a pointer-driven set collapse never ends the session Solo —
    // the keyboard Escape layer disarms before this handler runs.
    expect(collapse).toContain('if (railSetSelection.value !== null) {\n          railSetSelection.value = null;\n          return;\n        }');
    expect(collapse).not.toContain('disarmSolo()');
    expect(collapse).toContain('if (selectedKeyIds.value.length <= 1) return;');
  });

  it('supplies no solo playback window or content-start port (261022-iff)', () => {
    // The one global Solo is a composite-path track focus: it never filters or
    // re-anchors playback. The rail-solo window derivation is deleted
    // end-to-end, so the Studio's playback port carries neither getter.
    expect(studio).not.toContain(['getSolo', 'Window'].join(''));
    expect(studio).not.toContain(['getSolo', 'ContentStart'].join(''));
    expect(studio).not.toContain(['resolveSession', 'SoloWindow'].join(''));
    // Play still re-anchors at the cursor over the full composite range.
    expect(studio).toContain('getCurrentAppFrame: () => currentFrame,');
  });

  it('supplies the rail-selection playback RANGE at Play press (261022-jq0)', () => {
    // JQ0: the Studio maps the three existing selection authorities to ONE
    // contiguous range-only window. The derivation never consults the session
    // solo arm (a composite-path track focus), never hides per-frame content,
    // and keeps the play-from-cursor port for the no-selection path.
    expect(studio).toContain('getPlaybackWindow: () => resolveRotoSelectionPlaybackWindow(),');
    const start = studio.indexOf('const resolveRotoSelectionPlaybackWindow');
    const end = studio.indexOf('const handleRotoPlaybackPlaying', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const resolver = studio.slice(start, end);
    expect(resolver).toContain('deriveRotoSelectionPlaybackWindow({');
    expect(resolver).toContain('effectiveRailSetSelection');
    expect(resolver).toContain('effectiveSelectedRotoKeyRail');
    expect(resolver).toContain('effectiveSelectedLoopClipIds');
    expect(resolver).toContain('keyRailSegments');
    expect(resolver).toContain('loopRanges: loopResolutionContext?.ranges ?? [],');
    expect(resolver).toContain('getRotoPhysicalCompositeEndFrame');
    expect(resolver).not.toContain(['physicsPaint', 'SoloArm'].join(''));
    expect(resolver).not.toContain(['disarm', 'Solo'].join(''));
    expect(studio).toContain('getCurrentAppFrame: () => currentFrame,');
  });

  it('clears the set on Select All and spacing selection (D-04 key selection)', () => {
    const selectAllStart = studio.indexOf('const selectAllRotoKeys = useCallback(() => {');
    const selectAllEnd = studio.indexOf('const [, setLastError]', selectAllStart);
    expect(studio.slice(selectAllStart, selectAllEnd)).toContain('railSetSelection.value = null;');
    const spacingStart = studio.indexOf('const handleSelectRotoSpacingProxy = useCallback((');
    const spacingEnd = studio.indexOf('const handleClearRotoSpacingSelection', spacingStart);
    expect(studio.slice(spacingStart, spacingEnd)).toContain('railSetSelection.value = null;');
  });

  it('paints the shared anchor tick with the D-01 geometry and pointer-events none', () => {
    const tickRule = css.slice(css.indexOf('.physics-paint-rail-anchor-tick {'));
    expect(tickRule).toContain('width: 2px;');
    expect(tickRule).toContain('height: 8px;');
    expect(tickRule).toContain('background: #f2f5f7;');
    expect(tickRule).toContain('opacity: 0.7;');
    expect(tickRule).toContain('top: 4px;');
    expect(tickRule).toContain('pointer-events: none;');
  });
});

describe('261022-iff one global Solo: no per-track document solo route', () => {
  it('retires the document solo setter and the row-bundle solo intent', () => {
    // The one global Solo is a session-only track focus (physicsPaintSoloArm);
    // the persisted document `solo` field stays parseable but inert.
    expect(studio).not.toContain(['setTrack', 'Solo'].join(''));
    expect(studio).not.toContain(['onToggle', 'Solo'].join(''));
    // The multi-track row bundle still carries the surviving per-track intents.
    expect(studio).toContain('onToggleTrackVisible: multiTrackRowBundle.onToggleTrackVisible,');
    expect(studio).toContain('onToggleBlend: multiTrackRowBundle.onToggleBlend,');
  });
});

describe('261022-mne session Solo persists through frame navigation and selection changes', () => {
  function sliceFromStudio(startMarker: string, endMarker: string): string {
    const start = studio.indexOf(startMarker);
    const end = studio.indexOf(endMarker, start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    return studio.slice(start, end);
  }

  it('never disarms Solo from the mutation-lock effect', () => {
    const lockEffect = sliceFromStudio(
      'if (mutationLocked && !isPushCommitInFlight()) disarmPushTool();',
      '}, [mutationLocked]);',
    );
    // Frame navigation rides the same lock (prepareNavigation begins a script
    // operation), so the lock effect keeps push-disarm behavior only.
    expect(lockEffect).toContain('if (mutationLocked && !isPushCommitInFlight()) disarmPushTool();');
    expect(lockEffect).toContain('if (!isPushCommitInFlight()) disarmPushTool();');
    expect(lockEffect).not.toContain('disarmSolo()');
  });

  it('never disarms Solo from clearRotoLoopSelection', () => {
    const clearBody = sliceFromStudio(
      'const clearRotoLoopSelection = useCallback(() => {',
      '}, []);',
    );
    expect(clearBody).toContain('selectedLoopClipIds.value = [];\n    loopSelectionAnchorId.value = null;\n    selectedLoopClipId.value = null;');
    expect(clearBody).not.toContain('disarmSolo()');
  });

  it('never disarms Solo from Select All or the rail and frame-cell handlers', () => {
    const selectAllBody = sliceFromStudio(
      'const selectAllRotoKeys = useCallback(() => {',
      '}, [currentFrame, launchContext, rotoKeyRecords, publishOperationResult]);',
    );
    const loopHandler = sliceFromStudio(
      'const handleSelectRotoLoopClip = useCallback((',
      'const handleOpenRotoLoopEdit',
    );
    const frameCellHandler = sliceFromStudio(
      'const handleSelectTrackFrame = useCallback(',
      'const handleSelectTrackRail = useCallback(',
    );
    const trackRailHandler = sliceFromStudio(
      'const handleSelectTrackRail = useCallback(',
      'const navigateLinkedGroup = useCallback(',
    );
    for (const region of [selectAllBody, loopHandler, frameCellHandler, trackRailHandler]) {
      expect(region).not.toContain('disarmSolo()');
    }
  });

  it('keeps exactly the launch-replacement and unmount Solo disarm call sites', () => {
    expect((studio.match(/disarmSolo\(\)/g) ?? []).length).toBe(2);
    // A replaced launch never inherits a stale session focus.
    const launchReplacement = sliceFromStudio(
      'if (next?.operationId !== current?.operationId || next?.layerId !== current?.layerId) {',
      '} else if (next && next.startFrame !== current?.startFrame) {',
    );
    expect(launchReplacement).toContain('disarmSolo()');
    // The arm survives the whole Studio session; unmount is the session boundary.
    expect(studio).toContain('useEffect(() => () => {\n    disarmSolo();\n  }, []);');
  });
});

describe('Physics Paint selection-scoped Group deletion (43.2-17)', () => {
  it('wires direct Group lifecycle deletion and removes the routine scope-choice modal', () => {
    expect(studio).toContain('executeGroupLifecycleDelete:');
    expect(studio).toContain('requestSoleOccurrenceDeleteWarning:');
    expect(studio).not.toContain('requestGroupDeleteChoice:');
    expect(studio).not.toContain('type GroupDeleteChoice =');
    expect(studio).not.toContain('Choose what to remove.');
    expect(studio).not.toContain('>Delete Group</span>');
    expect(studio).not.toContain('Remove only F{groupDeleteDialog.appFrame}.');
  });

  it('renders only the focused sole-occurrence Delete Frame warning', () => {
    expect(studio).toContain('Delete the only frame in “{soleOccurrenceDeleteDialog.groupName}”?');
    expect(studio).toContain('This is the Rail’s only frame. Delete Frame will remove the whole Rail and its uniquely owned data. The Script is kept.');
    expect(studio).toContain('>Delete Frame</button>');
    expect(studio).toContain('>Cancel</button>');
    expect(studio).not.toContain('This frame belongs to a {groupDeleteDialog.groupType} Group.');
  });

  it('keeps the sole-occurrence warning keyboard-safe and restores focus after Cancel, rejection, or acceptance', () => {
    expect(studio).toContain('role="dialog"');
    expect(studio).toContain('aria-modal="true"');
    expect(studio).toContain('soleOccurrenceDeleteCancelRef.current?.focus();');
    expect(studio).toContain("if (event.key === 'Escape')");
    expect(studio).toContain("if (event.key !== 'Tab') return;");
    expect(studio).toContain('soleOccurrenceDeleteReturnFocusRef.current?.focus();');
    expect(studio).toContain('role="alert"');
  });

  it('submits the exact direct lifecycle command and waits for parent acceptance without moving cursor authority', () => {
    expect(studio).toContain("operationKind: target.operationKind");
    expect(studio).toContain('dispatchAndWaitForAcceptedRotoPhysicalEdit(');
    expect(studio).toContain('physicalEditCoordinator.acceptedOutput,');
    expect(studio).toContain('groupId: target.groupId,');
    expect(studio).toContain('appFrame: target.appFrame,');
    expect(studio).toContain('return accepted !== null;');
  });
});

describe('Physics Paint Roto keyboard shortcut wiring', () => {
  it('shares the exact key utility references with keyboard and visible-button paths', () => {
    expect(studio).toContain('copyRotoKey: copyRotoFrame,');
    expect(studio).toContain('pasteRotoKey: pasteRotoFrame,');
    expect(studio).toContain('onCopyRotoFrame: copyRotoFrame');
    expect(studio).toContain('onPasteRotoFrame: pasteRotoFrame');
    expect(studio).toContain('deleteRotoKey: rotoPhysicalActions.deleteRotoFrame,');
    expect(studio).toContain('onDeleteRotoFrame: rotoPhysicalActions.deleteRotoFrame,');
  });

  it('advertises the Copy, Paste, Backspace, and Delete shortcuts', () => {
    expect(studioView).toContain('Cmd/Ctrl+C copy selected key(s) · Cmd/Ctrl+V paste at current frame');
    expect(studioView).toContain('Backspace / Delete remove selected real key');
  });
});

function countOccurrences(source: string, literal: string): number {
  return source.split(literal).length - 1;
}

// Phase 43 Plan 09 Task 3 (D-28, audit finding 6) re-sourced by Phase 48-05
// (CMP-01), then made STRUCTURAL by G-52-8 (FIX 2): Studio playback
// availability is document-presence over the structural playback frame list —
// a placeholder frame plays transparent (the 48-03 D-09 missing-source report
// carries the reason) instead of being excluded from availability, exactly as
// under the flattened law, but answering the question never flattens (each
// flatten composites a photo-weight raster — 15 storms per Studio mount on a
// reveal rail). The frame is still never offered as real key content (key
// identity derives from the projection cell only).
describe('Physics Paint Studio loop placeholder contract (D-28, flattened-sourced)', () => {
  it('sources the playback availability memo structurally so Studio playback and the program monitor never diverge from the main editor (G-52-8)', () => {
    // Document-presence over the structural frame list — never a flatten, and
    // never a per-track render-source probe (a blend-mode probe would ENCODE
    // an interpolated raster per generated frame).
    expect(studio).toContain('getEfxPaintDocument(rotoPlaybackLayerId)');
    expect(studio).toContain('return rotoPlaybackFrameNumbers.map((appFrame) => ({ appFrame, frame: true }));');
    expect(studio).not.toContain('physicPaintStore.getFlattenedFrame(rotoPlaybackLayerId');
    expect(studio).not.toContain('getRotoPhysicalRenderSource(rotoPlaybackLayerId');
    expect(studio).not.toContain('Unhandled Roto physical render-source kind');
  });

  it('keeps the availability memo deps and return shape so the playback transport consumer contract is unchanged', () => {
    expect(studio).toContain('}, [rotoPlaybackLayerId, rotoPlaybackFrameNumbers]);');
  });

  it('never offers a placeholder frame as key content — key identity derives from the projection cell only', () => {
    expect(studio).toContain("currentPhysicalCell.kind === 'real'");
    // The current-frame selection kind has no placeholder arm: loop frames
    // are not real cells, so they can never become key selections.
    expect(studio).not.toContain("currentPhysicalCell.kind === 'loop-placeholder'");
  });
});

describe('Physics Paint navigation render localization', () => {
  it('uses dedicated compat wrappers while keeping TopBar and Play Script dialog plain', () => {
    expect(topBar).toContain('export function PhysicsPaintTopBar(');
    expect(playScriptDialog).toContain('export function PhysicsPaintPlayScriptDialog(');
    expect(memoizedTopBar).toContain("import { memo } from 'preact/compat';");
    expect(memoizedTopBar).toContain("import { PhysicsPaintTopBar } from './PhysicsPaintTopBar';");
    expect(memoizedTopBar).toContain('export const MemoizedPhysicsPaintTopBar = memo(PhysicsPaintTopBar);');
    expect(memoizedPlayScriptDialog).toContain("import { memo } from 'preact/compat';");
    expect(memoizedPlayScriptDialog).toContain("import { PhysicsPaintPlayScriptDialog } from './PhysicsPaintPlayScriptDialog';");
    expect(memoizedPlayScriptDialog).toContain('export const MemoizedPhysicsPaintPlayScriptDialog = memo(PhysicsPaintPlayScriptDialog);');
    expect(studioView).toContain("import { MemoizedPhysicsPaintTopBar } from './MemoizedPhysicsPaintTopBar';");
    expect(studioView).toContain("import { MemoizedPhysicsPaintPlayScriptDialog } from './MemoizedPhysicsPaintPlayScriptDialog';");
    expect(studioView).toContain('<MemoizedPhysicsPaintTopBar {...topBar} />');
    expect(studioView).toContain('<MemoizedPhysicsPaintPlayScriptDialog {...playScriptDialog} />');
    expect(studioView).not.toContain('<PhysicsPaintTopBar {...topBar} />');
    expect(studioView).not.toContain('<PhysicsPaintPlayScriptDialog {...playScriptDialog} />');
  });

  it('keeps TopBar and dialog props identity-stable on frame-only Studio renders', () => {
    expect(studio).toContain('const topBarPropsMemo = useRef(createIdentityMemo()).current;');
    expect(studio).toContain('const playScriptDialogPropsMemo = useRef(createIdentityMemo()).current;');
    const topBarStart = studio.indexOf('const topBar = topBarPropsMemo.resolve(');
    const topBarEnd = studio.indexOf('const toolRail = toolRailPropsMemo.resolve(', topBarStart);
    const topBarBlock = studio.slice(topBarStart, topBarEnd);
    const topBarDeps = topBarBlock.slice(0, topBarBlock.indexOf('], () =>'));
    expect(topBarStart).toBeGreaterThanOrEqual(0);
    expect(topBarBlock).toContain('settings.size');
    expect(topBarBlock).toContain('readyToApply');
    expect(topBarBlock).toContain('staticControlsLocked');
    for (const invalidator of ['currentFrame', 'startFrame', 'rotoNavigationGeneration']) expect(topBarDeps).not.toContain(invalidator);

    const dialogStart = studio.indexOf('const playScriptDialog = playScriptDialogPropsMemo.resolve(');
    const dialogEnd = studio.indexOf('const canvasEngineReadyImplRef =', dialogStart);
    const dialogBlock = studio.slice(dialogStart, dialogEnd);
    expect(dialogStart).toBeGreaterThanOrEqual(0);
    // D-08R: settings.color is a deliberate dep — the live brush-color prop must re-resolve on
    // right-panel picks; frame-only invalidators below stay excluded.
    expect(dialogBlock).toContain('[rotoPlayScript, playScriptConfirmationOpen, playButtonRef, settings.color]');
    expect(dialogBlock).toContain('brushColor: settings.color');
    for (const invalidator of ['currentFrame', 'startFrame', 'rotoNavigationGeneration']) expect(dialogBlock).not.toContain(invalidator);
  });

  it('propagates the primitive open transition through the exact memoized dialog props contract', () => {
    const dialogStart = studio.indexOf('const playScriptDialog = playScriptDialogPropsMemo.resolve(');
    const dialogEnd = studio.indexOf('const canvasEngineReadyImplRef =', dialogStart);
    const dialogBlock = studio.slice(dialogStart, dialogEnd);
    const dialogDeps = dialogBlock.slice(0, dialogBlock.indexOf('], () =>'));
    const dialogPropsStart = playScriptDialog.indexOf('export interface PhysicsPaintPlayScriptDialogProps');
    const dialogPropsEnd = playScriptDialog.indexOf('// D-05:', dialogPropsStart);
    const dialogPropsBlock = playScriptDialog.slice(dialogPropsStart, dialogPropsEnd);
    const dialogComponentStart = playScriptDialog.indexOf('export function PhysicsPaintPlayScriptDialog');
    const dialogComponent = playScriptDialog.slice(dialogComponentStart);
    const dialogSignatureEnd = dialogComponent.indexOf('}: PhysicsPaintPlayScriptDialogProps) {');
    const dialogSignature = dialogComponent.slice(0, dialogSignatureEnd);

    expect(dialogStart).toBeGreaterThanOrEqual(0);
    expect(dialogSignatureEnd).toBeGreaterThanOrEqual(0);
    expect({
      studioReadsPrimitiveOpenOnce: studio.match(/rotoPlayScript\.confirmationOpen\.value/g)?.length === 1
        && studio.includes('const playScriptConfirmationOpen = rotoPlayScript.confirmationOpen.value;'),
      studioMemoDependsOnPrimitiveOpen: dialogDeps.includes('playScriptConfirmationOpen'),
      studioPassesPrimitiveOpenProp: dialogBlock.includes('confirmationOpen: playScriptConfirmationOpen'),
      dialogDeclaresPrimitiveOpenProp: dialogPropsBlock.includes('confirmationOpen: boolean;'),
      dialogConsumesPrimitiveOpenProp: dialogSignature.includes('confirmationOpen,') && dialogComponent.includes('if (!confirmationOpen) return null;'),
      dialogDoesNotHideOpenSubscriptionBehindMemo: !dialogComponent.includes('playScript.confirmationOpen.value'),
    }).toEqual({
      studioReadsPrimitiveOpenOnce: true,
      studioMemoDependsOnPrimitiveOpen: true,
      studioPassesPrimitiveOpenProp: true,
      dialogDeclaresPrimitiveOpenProp: true,
      dialogConsumesPrimitiveOpenProp: true,
      dialogDoesNotHideOpenSubscriptionBehindMemo: true,
    });
  });

  it('preserves focus and keyboard behavior beneath the memoized dialog boundary', () => {
    expect(playScriptDialog).toContain('inputRef.current?.focus()');
    expect(playScriptDialog).toContain('returnFocusRef.current?.focus()');
    expect(playScriptDialog).toContain("event.key === 'Escape'");
    expect(playScriptDialog).toContain("event.key === 'Enter'");
    expect(playScriptDialog).not.toContain("event.key !== 'Tab'");
  });

  it('gates the complete physical mutation surface from the reactive lease registry', () => {
    expect(studio).toContain("import { effect, signal, useComputed, useSignal, type ReadonlySignal } from '@preact/signals';");
    expect(studio).toContain('physicPaintRotoPhysicalOperationLeaseVersion.value;');
    expect(studio).toContain('physicPaintStore.isRotoPhysicalOperationAvailable(');
    expect(studio).toContain('const mutationLocked = rotoScript.mutationLocked.value || !physicalMutationAvailable.value;');
    expect(studio).toContain("physicalEditCoordinator.acknowledgePhysicalEditSettlement(accepted.operationId, 'release');");
    expect(studio).not.toContain('useEffect(() => {\n    physicalMutationAvailable');
  });

  it('keeps navigation-only mutation locking out of static Studio region identities', () => {
    expect(studio).toContain('const staticControlsLocked = mutationLocked && !rotoScriptNavigationLocked;');
    const toolRailStart = studio.indexOf('const toolRail = toolRailPropsMemo.resolve(');
    const toolRailEnd = studio.indexOf('const rightPanel = rightPanelPropsMemo.resolve(', toolRailStart);
    const toolRailBlock = studio.slice(toolRailStart, toolRailEnd);
    expect(toolRailBlock).toContain('staticControlsLocked');
    expect(toolRailBlock).not.toContain('disabled: !engine || mutationLocked');
  });

  it('moves the complete right-panel rail, shell, toggle, and inner panel into one memoized region', () => {
    expect(rightPanelRegion).toContain("import { memo } from 'preact/compat';");
    expect(rightPanelRegion).toContain("import { MemoizedPhysicsPaintRightPanel } from './MemoizedPhysicsPaintRightPanel';");
    expect(rightPanelRegion).toContain('function PhysicsPaintRightPanelRegionImpl(');
    expect(rightPanelRegion).toContain('export const PhysicsPaintRightPanelRegion = memo(PhysicsPaintRightPanelRegionImpl);');
    expect(rightPanelRegion).toContain('class="physics-paint-right-panel-rail"');
    expect(rightPanelRegion).toContain('aria-label="Physics Paint right panel collapsed"');
    expect(rightPanelRegion).toContain('aria-label="Open brush options panel"');
    expect(rightPanelRegion).toContain('title="Open brush options panel"');
    expect(rightPanelRegion).toContain('class="physics-paint-right-panel-shell"');
    expect(rightPanelRegion).toContain('aria-label="Close brush options panel"');
    expect(rightPanelRegion).toContain('title="Close brush options panel"');
    expect(rightPanelRegion).toContain('>▸</button>');
    expect(rightPanelRegion).toContain('<MemoizedPhysicsPaintRightPanel {...rightPanel} />');
    expect(studioView).toContain("import { PhysicsPaintRightPanelRegion } from './PhysicsPaintRightPanelRegion';");
    expect(countOccurrences(studioView, '<PhysicsPaintRightPanelRegion')).toBe(1);
    expect(studioView).not.toContain('physics-paint-right-panel-rail');
    expect(studioView).not.toContain('physics-paint-right-panel-shell');
  });

  it('gives the right-panel region stable frame-independent layout inputs and one counter owner', () => {
    expect(studio).toContain('const layoutPropsMemo = useRef(createIdentityMemo()).current;');
    expect(studio).toContain('const handleSetRightPanelCollapsed = useCallback((collapsed: boolean) => {');
    const layoutStart = studio.indexOf('const layout = layoutPropsMemo.resolve(');
    const layoutEnd = studio.indexOf('const topBar = topBarPropsMemo.resolve(', layoutStart);
    const layoutBlock = studio.slice(layoutStart, layoutEnd);
    const layoutDeps = layoutBlock.slice(0, layoutBlock.indexOf('], () =>'));
    expect(layoutBlock).toContain('rightPanelCollapsed');
    expect(layoutBlock).toContain('handleSetRightPanelCollapsed');
    for (const invalidator of ['currentFrame', 'startFrame', 'rotoNavigationGeneration']) expect(layoutDeps).not.toContain(invalidator);
    expect(countOccurrences(rightPanelRegion, "recordPhysicsPaintPerformanceCounter('render.rightPanelRegion')")).toBe(1);
    expect(studioView).not.toContain("recordPhysicsPaintPerformanceCounter('render.rightPanelRegion')");
  });

  it('keeps navigation-only status out of the right-panel identity boundary', () => {
    const memoStart = studio.indexOf('const rightPanel = rightPanelPropsMemo.resolve(');
    const memoEnd = studio.indexOf('const viewModel = usePhysicsPaintStudioViewModel', memoStart);
    const memoBlock = studio.slice(memoStart, memoEnd);
    for (const invalidator of ['applyStatus', 'applyMessage', 'lastError', 'scriptLoadAndApplyDisabledReason']) {
      expect(memoBlock).not.toContain(invalidator);
    }
    const propsStart = rightPanel.indexOf('export interface PhysicsPaintRightPanelProps');
    const propsEnd = rightPanel.indexOf('const DEFAULT_PALETTE', propsStart);
    const propsBlock = rightPanel.slice(propsStart, propsEnd);
    for (const deadProp of ['devExportEnabled', 'devExportBusy', 'applyStatus', 'applyMessage', 'error?:', 'onExportDebugProof', 'onSaveState', 'onLoadState']) {
      expect(propsBlock).not.toContain(deadProp);
    }
  });

  it('derives frame-sensitive Load and Apply availability inside the Scripts subscriber', () => {
    expect(scriptsPanel).not.toContain('loadAndApplyDisabledReason: string | null');
    expect(scriptsPanel).toContain('const actionMutationDisabledReason = library.actionMutationDisabledReason.value;');
    expect(scriptsPanel).toContain('const loadAndApplyDisabledReason = actionMutationDisabledReason');
    expect(scriptsPanel).toContain('?? (!library.selected.value');
    expect(studio).not.toContain('const scriptLoadAndApplyDisabledReason =');
  });

  it('keeps Undo and Redo count-free while preserving narrow availability-driven disabling', () => {
    const childStart = toolRail.indexOf('function PhysicsPaintHistoryActionButton');
    const railStart = toolRail.indexOf('function PhysicsPaintToolRailImpl');
    const railEnd = toolRail.indexOf('export const PhysicsPaintToolRail', railStart);
    const historyActionButton = toolRail.slice(childStart, railStart);
    expect(childStart).toBeGreaterThanOrEqual(0);
    expect(childStart).toBeLessThan(railStart);
    expect(historyActionButton).toContain('historyAvailability?.value');
    expect(historyActionButton).toContain("const count = item.id === 'undo' ? availability?.undo ?? 0 : availability?.redo ?? 0;");
    expect(historyActionButton).toContain('disabled={disabled || count === 0}');
    expect(historyActionButton).toContain('title={item.label}');
    expect(historyActionButton).toContain('aria-label={item.label}');
    expect(historyActionButton).not.toContain('physics-paint-history-badge');
    expect(historyActionButton).not.toContain('available)');
    expect(toolRail.slice(railStart, railEnd)).not.toContain('historyAvailability?.value');
    expect(css).not.toContain('.physics-paint-history-badge');
  });
});

describe('Canvas navigation render localization', () => {
  it('assembles stable CanvasStack and CanvasMount props with named callback boundaries', () => {
    expect(studio).toContain('const canvasStackPropsMemo = useRef(createIdentityMemo()).current;');
    expect(studio).toContain('const canvasMountPropsMemo = useRef(createIdentityMemo()).current;');
    expect(studio).toContain('const handleCanvasEngineReady = useCallback(');
    expect(studio).toContain('const handleCanvasCompletedMutation = useCallback(');
    expect(studio).toContain('const canvasMount = canvasMountPropsMemo.resolve(');
    expect(studio).toContain('const canvasStack = canvasStackPropsMemo.resolve(');
    expect(studio).not.toContain('onEngineReady: (readyEngine) => {');
    expect(studio).not.toContain('onCompletedMutation: (mutation, mutationEngine) => {');
  });

  it('routes navigation-fresh engine and mutation behavior through stable implementation refs', () => {
    expect(studio).toContain('canvasEngineReadyImplRef.current = (readyEngine) => {');
    expect(studio).toContain('canvasCompletedMutationImplRef.current = (mutation, mutationEngine) => {');
    expect(studio).toContain('canvasEngineReadyImplRef.current(readyEngine);');
    expect(studio).toContain('canvasCompletedMutationImplRef.current(mutation, mutationEngine);');
    expect(studio).toContain('const handleCanvasEngineReady = useCallback(');
    expect(studio).toContain('const handleCanvasCompletedMutation = useCallback(');
  });

  it('keeps CanvasMount plain and mounts its dedicated wrapper from memoized CanvasStack', () => {
    expect(canvasMount).toContain('export function PhysicsPaintCanvasMount(');
    expect(countOccurrences(canvasMount, 'memo(')).toBe(0);
    expect(memoizedCanvasMount).toContain('export const MemoizedPhysicsPaintCanvasMount = memo(PhysicsPaintCanvasMountRenderCounted);');
    // Water color's cached base is rendered under the live canvas — engine-1's
    // preview base is invisible while the aquarelle layer is up.
    expect(canvasMount).toContain('aquarelleActive && props.aquarelleCachedBaseUrl');
    expect(canvasMount).toContain('class="aquarelle-cached-base"');
    expect(studioView).toContain('const MemoizedPhysicsPaintCanvasStack = memo(PhysicsPaintCanvasStackImpl);');
    expect(studioView).toContain('<MemoizedPhysicsPaintCanvasMount');
    expect(studioView).toContain('aquarelleCachedBaseUrl={props.cachedRotoPlaybackActive ? null : props.cachedRotoReferenceUrl ?? null}');
    expect(studioView).not.toContain('<PhysicsPaintCanvasMount key={canvas.canvasKey} {...canvas.mount} />');
  });
});

describe('Workflow navigation render localization', () => {
  it('assembles Workflow with named stable callbacks instead of inline action closures', () => {
    for (const handler of [
      'handleRotoInterpolationModeChange',
      'handleToggleRotoKeySelection',
      'handleCollapseRotoSelectionToKey',
      'handleExtendRotoKeySelection',
      'handleRotoGroupDragRejected',
      'handleNavigateToSyncedFrame',
    ]) {
      expect(studio).toContain(`const ${handler} = useCallback(`);
    }
    const workflowStart = studio.indexOf('workflow: {');
    const workflowEnd = studio.indexOf('status: { shortcutsVisible }', workflowStart);
    const workflowBlock = studio.slice(workflowStart, workflowEnd);
    expect(workflowStart).toBeGreaterThanOrEqual(0);
    expect(workflowBlock).not.toContain('onRotoInterpolationModeChange: (');
    expect(workflowBlock).not.toContain('onNavigateToSyncedFrame: (');
    expect(workflowBlock).toContain('onRotoInterpolationModeChange: handleRotoInterpolationModeChange');
    expect(workflowBlock).toContain('onNavigateToSyncedFrame: handleNavigateToSyncedFrame');
    // 260911-s1j: the popover's enable toggle is retired — the Studio wires no
    // onRotoInterpolationEnabledChange (the row blend button owns on/off).
    expect(studio).not.toContain('onRotoInterpolationEnabledChange');
    expect(studio).not.toContain('handleRotoInterpolationEnabledChange');
  });

  it('writes the document-level interpolation mode to EVERY track and preserves each track\'s enabled flag (260911-s1j)', () => {
    const handlerStart = studio.indexOf('const handleRotoInterpolationModeChange = useCallback(');
    expect(handlerStart).toBeGreaterThanOrEqual(0);
    const handlerEnd = studio.indexOf('const handleSelectRotoSpacingProxy = useCallback(', handlerStart);
    const handler = studio.slice(handlerStart, handlerEnd);
    expect(handler).toContain('getEfxPaintDocument(layerId)');
    expect(handler).toContain('for (const track of document.tracks)');
    expect(handler).toContain('physicPaintStore.getRotoPhysicalInterpolationState(layerId, track.id)');
    expect(handler).toContain('physicPaintStore.setRotoPhysicalInterpolationState(layerId, track.id, { enabled: current.enabled, mode })');
    expect(handler).toContain('physicalEditCoordinator.pendingOperationId.value !== null');
    // The old active-track coordinator path is gone entirely.
    expect(studio).not.toContain('useRotoInterpolationController');
    expect(studio).not.toContain('updateRotoInterpolationSettings');
  });

  it('keeps ordinary Workflow frame navigation outside physical edit, document replacement, and history authority', () => {
    const handlerStart = studio.indexOf('const handleNavigateToSyncedFrame = useCallback(');
    const handlerEnd = studio.indexOf('const navigateLinkedGroup = useCallback(', handlerStart);
    const handler = studio.slice(handlerStart, handlerEnd);
    expect(handlerStart).toBeGreaterThanOrEqual(0);
    expect(handler).toContain('requestRotoFrameNavigationRef.current(frame)');

    const requestStart = navigationCoordinator.indexOf('const requestNavigation = useCallback(');
    const requestEnd = navigationCoordinator.indexOf('const createNavigationActions = useCallback(', requestStart);
    const request = navigationCoordinator.slice(requestStart, requestEnd);
    expect(requestStart).toBeGreaterThanOrEqual(0);
    expect(request).toContain('runtimePortRef.current.navigateToSyncedFrame(targetFrame)');

    const navigationStart = studio.indexOf('const navigateToSyncedPhysicalFrame = useCallback(');
    const navigationEnd = studio.indexOf('rotoNavigation.configureRuntimePort(', navigationStart);
    const navigation = studio.slice(navigationStart, navigationEnd);
    expect(navigationStart).toBeGreaterThanOrEqual(0);
    expect(navigation).toContain('engine.clear();');
    expect(navigation).toContain('physicPaintStore.setRotoPhysicalSelection(');
    expect(navigation).toContain('scheduleRotoStartFramePropagation(frame);');
    expect(navigation).toContain('sendPhysicPaintFrameSyncMessage(frame, bridgeMode)');
    expect(studio).toContain('rotoNavigation.configureRuntimePort({ navigateToSyncedFrame: navigateToSyncedPhysicalFrame });');

    const navigationOnlyBoundary = [handler, request, navigation].join('\n');
    for (const editOrHistoryAuthority of [
      'executePhysicalEdit',
      'dispatchAndWaitForAcceptedRotoPhysicalEdit',
      'replacePhysicalDocumentWithOwnership',
      'replacePhysicalRecordsWithOwnership',
      'replaceRotoPhysicalDocument',
      'rotoMoveHistory',
      'undoPaint',
      'redoPaint',
    ]) {
      expect(navigationOnlyBoundary).not.toContain(editOrHistoryAuthority);
    }
  });

  it('wires the seek path: skips the playback stop when playing and seeks after navigation (D-02)', () => {
    const navigationStart = studio.indexOf('const navigateToSyncedPhysicalFrame = useCallback(');
    const navigationEnd = studio.indexOf('rotoNavigation.configureRuntimePort(', navigationStart);
    const navigation = studio.slice(navigationStart, navigationEnd);
    expect(navigationStart).toBeGreaterThanOrEqual(0);
    // Seek-while-playing keeps the playback timer running through the flush.
    expect(navigation).toContain('const wasPlaying = rotoCachedPlayback.isActive;');
    const wasPlayingIndex = navigation.indexOf('const wasPlaying = rotoCachedPlayback.isActive;');
    const stopIndex = navigation.indexOf('rotoCachedPlayback.stop();');
    expect(wasPlayingIndex).toBeGreaterThanOrEqual(0);
    expect(stopIndex).toBeGreaterThan(wasPlayingIndex);
    expect(navigation.slice(wasPlayingIndex, stopIndex)).toContain('if (!wasPlaying) {');
    // The seek call is the single audio funnel and lands AFTER the frame-sync.
    const syncIndex = navigation.indexOf('sendPhysicPaintFrameSyncMessage(frame, bridgeMode)');
    const seekIndex = navigation.indexOf('rotoCachedPlayback.seek(frame);');
    expect(syncIndex).toBeGreaterThanOrEqual(0);
    expect(seekIndex).toBeGreaterThan(syncIndex);
  });

  it('wires the audible scrub path: scrubActiveRef gates seek vs scrub and scrubEnd on release (D-02 amendment)', () => {
    const navigationStart = studio.indexOf('const navigateToSyncedPhysicalFrame = useCallback(');
    const navigationEnd = studio.indexOf('rotoNavigation.configureRuntimePort(', navigationStart);
    const navigation = studio.slice(navigationStart, navigationEnd);
    expect(navigationStart).toBeGreaterThanOrEqual(0);
    // The audio funnel routes by the scrub-active flag — scrub (audible
    // snippet) while the ruler gesture is armed, seek (silent re-anchor) after.
    expect(navigation).toContain('if (scrubActiveRef.current) {');
    expect(navigation).toContain('rotoCachedPlayback.scrub(frame);');
    expect(navigation).toContain('rotoCachedPlayback.seek(frame);');
    // The strip props carry the scrub lifecycle: armed sets the flag and clears
    // any stale playhead feed; release clears the flag, stops the snippet, and
    // runs the ONE settle navigation at the final frame.
    expect(studio).toContain('onScrubStart: () => { scrubActiveRef.current = true; rotoScrubFrameSignal.value = null; }');
    const scrubEndStart = studio.indexOf('onScrubEnd: (frame) => {');
    expect(scrubEndStart).toBeGreaterThanOrEqual(0);
    const scrubEnd = studio.slice(scrubEndStart, studio.indexOf('},', scrubEndStart));
    expect(scrubEnd).toContain('scrubActiveRef.current = false;');
    expect(scrubEnd).toContain('rotoCachedPlayback.scrubEnd(frame);');
    expect(scrubEnd).toContain('void requestRotoFrameNavigationRef.current(frame);');
  });

  it('gates mid-drag seeks to the playhead feed + audio snippet only (G-52-9 drag-gate)', () => {
    const handlerStart = studio.indexOf('const handleNavigateToSyncedFrame = useCallback(');
    expect(handlerStart).toBeGreaterThanOrEqual(0);
    const handlerEnd = studio.indexOf('}, [', handlerStart);
    const handler = studio.slice(handlerStart, handlerEnd);
    // The scrub-armed branch runs FIRST and returns before the full navigation:
    // playhead feed write + audible snippet, nothing else.
    const gateIndex = handler.indexOf('if (scrubActiveRef.current) {');
    expect(gateIndex).toBeGreaterThanOrEqual(0);
    const gate = handler.slice(gateIndex);
    expect(gate).toContain('rotoScrubFrameSignal.value = frame;');
    expect(gate).toContain('rotoCachedScrub(frame);');
    expect(gate).toContain('return;');
    // The full navigation (publishOperationResult + requestRotoFrameNavigation)
    // is only reachable BELOW the gate's early return.
    expect(handler.indexOf('publishOperationResult(null);')).toBeGreaterThan(gateIndex);
    // The strip receives the scrub playhead feed as a signal reference.
    expect(studio).toContain('rotoScrubFrame: rotoScrubFrameSignal,');
    // The sticky feed clears once the settle propagation catches up.
    expect(studio).toContain('if (scrubFrame !== null && launchContext?.startFrame === scrubFrame) {');
  });
});

describe('localized render instrumentation', () => {
  it('assigns each non-Workflow render counter to its app-owned implementation body', () => {
    const owners = [
      [studio.slice(studio.indexOf('export function PhysicsPaintStudio()'), studio.indexOf('async function dispatchAndWaitForAcceptedRotoPhysicalEdit')), 'render.studio'],
      [studioView.slice(studioView.indexOf('export function PhysicsPaintStudioView'), studioView.length), 'render.studioView'],
      [rightPanelRegion.slice(rightPanelRegion.indexOf('function PhysicsPaintRightPanelRegionImpl'), rightPanelRegion.length), 'render.rightPanelRegion'],
      [studioView.slice(studioView.indexOf('function PhysicsPaintCanvasStack'), studioView.indexOf('export interface PhysicsPaintStudioViewProps')), 'render.canvasStack'],
      [topBar.slice(topBar.indexOf('export function PhysicsPaintTopBar'), topBar.length), 'render.topBar'],
      [toolRail.slice(toolRail.indexOf('function PhysicsPaintToolRailImpl'), toolRail.indexOf('export const PhysicsPaintToolRail')), 'render.toolRailImpl'],
      [rightPanel.slice(rightPanel.indexOf('export function PhysicsPaintRightPanel'), rightPanel.length), 'render.rightPanelImpl'],
      [playScriptDialog.slice(playScriptDialog.indexOf('export function PhysicsPaintPlayScriptDialog'), playScriptDialog.length), 'render.playScriptDialog'],
      [canvasMount.slice(canvasMount.indexOf('export function PhysicsPaintCanvasMount'), canvasMount.length), 'render.canvasMount'],
    ] as const;

    for (const [owner, counter] of owners) {
      expect(countOccurrences(owner, `recordPhysicsPaintPerformanceCounter('${counter}')`), counter).toBe(1);
    }
  });

  it('locks CanvasStack observer setup and cleanup counters to the existing effect', () => {
    const stack = studioView.slice(studioView.indexOf('function PhysicsPaintCanvasStack'), studioView.indexOf('export interface PhysicsPaintStudioViewProps'));
    for (const counter of [
      'observer.canvasStack.resize.install',
      'observer.canvasStack.resize.cleanup',
      'observer.canvasStack.mutation.install',
      'observer.canvasStack.mutation.cleanup',
    ]) {
      expect(countOccurrences(stack, `recordPhysicsPaintPerformanceCounter('${counter}')`), counter).toBe(1);
    }
    expect(stack).toContain('}, []);');
  });

  it('locks CanvasMount request, observer, and transparent lifecycle proxy counters', () => {
    for (const counter of [
      'render.efxChildRequest',
      'observer.canvasMount.resize.install',
      'observer.canvasMount.resize.cleanup',
      'lifecycle.canvasMount.engineReady',
      'lifecycle.canvasMount.beforeDestroy',
    ]) {
      expect(countOccurrences(canvasMount, `recordPhysicsPaintPerformanceCounter('${counter}')`), counter).toBe(1);
    }
    expect(canvasMount).toContain('}, [props.height, props.width]);');
    expect(canvasMount).toContain('return onEngineReadyRef.current(engine);');
    expect(canvasMount).toContain('beforeEngineDestroyRef.current = props.beforeEngineDestroy;');
    expect(canvasMount).toContain('return beforeEngineDestroyRef.current?.(engine);');
  });

  it('locks engine lifecycle counters to the current tablet and external cleanup effects', () => {
    for (const counter of [
      'lifecycle.engine.tabletListener.install',
      'lifecycle.engine.tabletListener.cleanup',
      'lifecycle.engine.externalState.cleanup',
    ]) {
      expect(countOccurrences(engineLifecycle, `recordPhysicsPaintPerformanceCounter('${counter}')`), counter).toBe(1);
    }
    expect(engineLifecycle).toContain('}, []);');
    expect(engineLifecycle).toContain('}, [engine, input.launchContext?.layerId, efxPaintVersion.value]);');
  });

  it('retains Plan 09 wrappers while adding the Plan 11 CanvasStack memo and three Studio identity resolves', () => {
    expect(countOccurrences(toolRail, 'memo(')).toBe(1);
    expect(countOccurrences(rightPanel, 'memo(')).toBe(0);
    expect(countOccurrences(memoizedTopBar, 'memo(')).toBe(1);
    expect(countOccurrences(memoizedPlayScriptDialog, 'memo(')).toBe(1);
    expect(countOccurrences(rightPanelRegion, 'memo(')).toBe(1);
    expect(countOccurrences(studioView, 'memo(')).toBe(1);
    expect(countOccurrences(canvasMount, 'memo(')).toBe(0);
    // layout, topBar, toolRail, rightPanel, playScriptDialog, canvasStack,
    // canvasMount, referenceDialog (50-UAT modal redesign), scriptPickerDialog
    // (261022-o2a: the Tools Create Rail / Load + Apply picker is owned by the
    // Studio and rendered by the view), strokeSettingsDialog
    // (261024-p5q: the active module's Stroke Settings callback bundle).
    expect(countOccurrences(studio, 'PropsMemo.resolve(')).toBe(10);
    expect(studioView).toContain('}, []);');
    expect(canvasMount).toContain('}, [props.height, props.width]);');
  });
});

describe('Physics Paint monitor fond + transparency checkerboard (49-03, D-11/D-12)', () => {
  it('resolves the monitor fond from the document fallback via the store instruction (no inline derivation remains)', () => {
    // The canvas-stack memo reads the SAME resolved document-fallback
    // instruction the flattened path uses — one authority, two consumers
    // (Pitfall 1). The per-track roto background metadata fond walk is gone.
    expect(studio).toContain('physicPaintStore.getDocumentFondInstruction(programMonitorLayerId)');
    expect(studio).toContain('const fondBackground = fondInstruction ? fondInstructionToFondMetadata(fondInstruction) : null;');
    expect(studio).toContain('function fondInstructionToFondMetadata(');
    // The old inline walk (ordered-track getRotoBackgroundMetadata scan) must
    // not survive alongside the re-wire.
    expect(studio).not.toContain('for (const track of [...document.tracks].sort((left, right) => left.order - right.order))');
    expect(studio).not.toContain('physicPaintStore.getRotoBackgroundMetadata(programMonitorLayerId, track.id)');
  });

  it('shows the checkerboard only in the no-fond case and keeps the fond layer as today', () => {
    // The checkerboard flag is true ONLY when the effective fond is fully
    // transparent for the current frame: transparent fallback (no fond
    // instruction) AND the engine-side active background mode is transparent
    // (settings.background — the fond=fallback mapping is not fully wired yet,
    // so a paper/solid engine mode suppresses the checkerboard even while the
    // document fallback is still transparent) AND no clip covering the frame
    // (the gap verdict, consumed from the store's already-resolved
    // background-frame plumbing).
    expect(studio).toContain('const showTransparencyCheckerboard = programMonitorLayerId !== null');
    expect(studio).toContain('&& fondInstruction === null');
    expect(studio).toContain("&& settings.background === 'transparent'");
    expect(studio).toContain("&& physicPaintStore.getBackgroundFrameVerdict(programMonitorLayerId, currentFrame) === 'gap'");
    expect(studio).toContain('showTransparencyCheckerboard,');
    // The view renders the checkerboard layer beneath the monitor content,
    // conditioned on the flag; the fond layer keeps its own fondBackground
    // condition (one branch, tested both ways).
    expect(studioView).toContain('showTransparencyCheckerboard?: boolean;');
    expect(studioView).toContain('props.showTransparencyCheckerboard ? (');
    expect(studioView).toContain('class="physics-paint-transparency-checkerboard"');
    expect(studioView).toContain('props.fondBackground ? (');
    expect(studioView).toContain('class="physics-paint-fond-layer"');
  });

  it('uses the two-gray repeating-conic-gradient treatment clipped to canvas bounds', () => {
    expect(css).toContain('.physics-paint-transparency-checkerboard');
    expect(css).toContain('background: repeating-conic-gradient(#777 0% 25%, #d8d8d8 0% 50%) 0 0 / 20px 20px;');
    expect(css).toContain('position: absolute;');
    expect(css).toContain('z-index: 0;');
    expect(css).toContain('pointer-events: none;');
    expect(css).toContain('overflow: hidden;');
    // The layer is positioned at the canvas bounds (the same inline style the
    // fond layer uses), so the checkerboard is clipped to the canvas.
    expect(studioView).toContain('left: canvasBounds.left, top: canvasBounds.top, width: canvasBounds.width, height: canvasBounds.height');
  });

  it('keeps the checkerboard out of the flattened raster, preview, and export (T-49-03-03)', () => {
    // The treatment exists ONLY as a paint layer in the Studio monitor stack —
    // never a document state, never in the compositor, flattened cache, main
    // preview, or export renderer.
    const rasterSurface = [compositor, flattenedCache, previewRenderer, exportRenderer].join('\n');
    expect(rasterSurface).not.toContain('repeating-conic-gradient');
    expect(rasterSurface).not.toContain('transparency-checkerboard');
    expect(rasterSurface).not.toContain('#777 0% 25%');
  });
});

describe('Physics Paint background swatch write-through (49-04 UAT fix)', () => {
  it('writes the document fallback on swatch click so the monitor fond resolves the paper/solid/transparent record', () => {
    // The 49-03 S6 write-through helper (backgroundModeToFallback) existed but
    // the click path never invoked it — the document fallback stayed
    // transparent and the monitor showed black (checkerboard suppressed). The
    // wrapper must call setBackgroundFallback with backgroundModeToFallback for
    // the launch layer, and the topBar must consume the wrapper, not the raw
    // engine action.
    // 56-05 widened the handler parameter to StudioBackgroundMode (BgMode | PaperTexture).
    expect(studio.indexOf('const handleBackgroundChange = (mode: StudioBackgroundMode) => {')).toBeGreaterThan(-1);
    expect(studio.indexOf('setBackground(mode);')).toBeGreaterThan(-1);
    expect(studio.indexOf('setBackgroundFallback(layerId, backgroundModeToFallback(mode, settings));')).toBeGreaterThan(-1);
    // 261017-vcn I-04 remainder: Background / Grain rows left the top bar —
    // the topBar memo no longer names those handlers. The background path
    // stays on handleBackgroundChange (consumed by the Paper tab's Transparent
    // / White arms). Scalar predicates keep TAP diagnostics one-line.
    expect(studio.indexOf('onBackgroundChange: handleBackgroundChange')).toBeGreaterThan(-1);
    // topBar memo deps end at the slim brush/opacity set (no background/grain).
    const topBarStart = studio.indexOf('const topBar = topBarPropsMemo.resolve(');
    const topBarEnd = studio.indexOf('const toolRail = toolRailPropsMemo.resolve(', topBarStart);
    const topBarBlock = studio.slice(topBarStart, topBarEnd);
    const topBarDeps = topBarBlock.slice(0, topBarBlock.indexOf('], () =>'));
    expect(topBarDeps.indexOf('settings.size')).toBeGreaterThan(-1);
    expect(topBarDeps.indexOf('settings.opacity')).toBeGreaterThan(-1);
    expect(topBarDeps.indexOf('settings.background'), 'topBar deps must drop background').toBe(-1);
    expect(topBarDeps.indexOf('settings.grainStrength'), 'topBar deps must drop grainStrength').toBe(-1);
    expect(topBarDeps.indexOf('settings.grainScale'), 'topBar deps must drop grainScale').toBe(-1);
    expect(topBarDeps.indexOf('handleBackgroundChange'), 'topBar deps must drop background handler').toBe(-1);
    expect(topBarDeps.indexOf('handleGrainStrengthChange'), 'topBar deps must drop strength handler').toBe(-1);
    expect(topBarDeps.indexOf('handleGrainScaleChange'), 'topBar deps must drop scale handler').toBe(-1);
    expect(topBarDeps.indexOf('setGrainScale'), 'topBar deps must drop setGrainScale').toBe(-1);
  });
});

describe('Physics Paint scoped background asset picker (49-04, S2)', () => {
  it('wires the signal-driven picker controller to the image-library bridge consumer and imageStore import path', () => {
    expect(studio).toContain('useBackgroundAssetPickerController({');
    expect(studio).toContain('requestLibrary: () => requestImageLibrary()');
    // quick-260921-bjm: this line used to assert
    // `importFiles: (paths: string[], projectDir: string) => imageStore.importFiles(paths, projectDir)`
    // — which PINNED the defect. The picker runs in the Studio webview, so that
    // call wrote the CHILD realm's imageStore module instance: a different
    // module instance from the main webview's, and never the one
    // projectStore.buildMceProject() reads for the manifest `images` array. The
    // bytes landed on disk, the library record vanished on close. The import now
    // crosses the bridge and is performed by the main realm.
    expect(studio).toContain('importFiles: async (paths: string[], _projectDir: string) => {');
    expect(studio).toContain('const result = await requestImageImport(paths);');
    expect(studio).toContain("if (!result.ok) throw new Error(result.error ?? 'Image import failed');");
    expect(studio).not.toContain('imageStore.importFiles');
    expect(studio).toContain('openNativeImageDialog({');
    expect(studio).toContain("filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'tiff', 'tif', 'heic', 'heif'] }]");
    expect(studio).toContain('refreshLibrary: async () => {');
    expect(studio).toContain('mergeImageLibraries(result.ok ? result.images : [], studioImages)');
    // The controller is signal-driven — no useState hook call in the new
    // picker wiring (the only "useState" occurrence is the comment).
    expect(backgroundPickerView).not.toContain('useState(');
    expect(backgroundPickerView).toContain('useSignal');
    expect(backgroundPickerView).toContain('useComputed');
  });

  it('mounts the picker as an overlay inside the canvas region — the engine canvas never unmounts (D-01 lock)', () => {
    expect(studioView).toContain('backgroundPicker?: ComponentProps<typeof BackgroundAssetPickerView>');
    expect(studioView).toContain('{backgroundPicker?.open ? <BackgroundAssetPickerView {...backgroundPicker} /> : null}');
    // The picker overlay renders AFTER the always-mounted canvas stack in the
    // JSX — a sibling overlay, never a replacement. The engine canvas stays
    // mounted underneath (D-01 lock).
    const canvasStackIndex = studioView.indexOf('<MemoizedPhysicsPaintCanvasStack {...canvas} />');
    const pickerOverlayIndex = studioView.indexOf('{backgroundPicker?.open ? <BackgroundAssetPickerView');
    expect(canvasStackIndex).toBeGreaterThanOrEqual(0);
    expect(pickerOverlayIndex).toBeGreaterThan(canvasStackIndex);
    // The canvas mount is unconditional — never gated on the picker being closed.
    expect(studioView).toContain('<MemoizedPhysicsPaintCanvasMount');
    expect(studioView).toContain('aquarelleCachedBaseUrl={props.cachedRotoPlaybackActive ? null : props.cachedRotoReferenceUrl ?? null}');
    expect(studioView).not.toContain('!backgroundPicker?.open ? <MemoizedPhysicsPaintCanvasStack');
  });

  it('emits the confirmed selection natural-sorted by original filename (D-02, one ordering authority)', () => {
    expect(studio).toContain('sortImages: (images: readonly MceImageRef[]) => sortImagesByOriginalFilename(images, (image) => image.original_filename)');
    expect(backgroundPickerView).toContain('sortImagesByOriginalFilename(images, (image) => image.original_filename)');
    expect(backgroundPickerView).toContain('buildConfirmedImageIds(');
    // The picker never re-derives ordering from asset UUIDs or click order.
    expect(backgroundPickerView).not.toContain('.sort((a, b) => a.id');
  });

  it('keeps the picker decoupled from sequenceStore and audioStore (Pitfall 4)', () => {
    const pickerSurface = [backgroundPickerView, studioView].join('\n');
    expect(pickerSurface).not.toContain('sequenceStore');
    expect(pickerSurface).not.toContain('audioStore');
    expect(pickerSurface).not.toContain('getAllAssetUsages');
    expect(pickerSurface).not.toContain('cascadeRemoveAsset');
  });

  it('grants exactly the dialog:allow-open capability with no fs:* permission (Pitfall 3)', () => {
    expect(capability).toContain('"dialog:allow-open"');
    expect(capability).not.toContain('fs:');
    expect(capability).not.toContain('"fs:');
  });
});

describe('Physics Paint Bg-row Import control + Confirm placement flow (49-05, S1/D-03/D-04)', () => {
  it('mounts the Import icon button on the locked Bg header with the 24px hit target and aria-label (S1)', () => {
    // The Bg row header carries exactly ONE action — the Import control —
    // alongside the lock indicator (D-06 lock semantics: no reorder grab, no
    // duplicate/delete hover actions).
    expect(trackRow).toContain('aria-label="Import images"');
    expect(trackRow).toContain('class="physics-paint-bg-import-button"');
    expect(trackRow).toContain('onClick={() => onImportBackground?.()}');
    expect(trackRow).toContain('ImagePlus size={14}');
    // The 24px hit target is enforced in the stylesheet (UI-SPEC accessibility).
    expect(css).toContain('.physics-paint-bg-import-button');
    expect(css).toContain('width: 24px;');
    expect(css).toContain('height: 24px;');
  });

  it('threads onImportBackground from the strip through the header column to the Bg header', () => {
    // The strip exposes the intent and forwards it to the hook-free header
    // column, which passes it to the Bg PhysicsPaintTrackRowHeader.
    expect(workflowStrip).toContain('onImportBackground?: () => void;');
    expect(workflowStrip).toContain('onImportBackground: props.onImportBackground,');
    expect(headerColumn).toContain('onImportBackground?: () => void;');
    expect(headerColumn).toContain('onImportBackground={onImportBackground}');
    // The Studio routes the intent to the 49-04 picker swap (engine untouched).
    expect(studio).toContain('onImportBackground: () => backgroundPicker.openPicker(),');
  });

  it('Confirm calls addBackgroundClip exactly once with the placement frame, natural-sorted refs, and finite-1 repeat (BKG-02/D-03)', () => {
    // 49-06 (UAT round 2): the handler reads the clicked empty Bg cell frame
    // (the placement gesture) at Confirm time, falling back to the playhead
    // when no frame was clicked, and passes the natural-sorted ids as the
    // source-frame cycle order with the finite-1 default repeat.
    // 49-06 (UAT round 7): the ADD branch is the ternary's else — a replace
    // target routes to setBackgroundClipSource instead.
    expect(studio).toContain('const result = replaceTarget');
    expect(studio).toContain('? setBackgroundClipSource(layerId, replaceTarget, sortedIds)');
    expect(studio).toContain(': addBackgroundClip(layerId, {');
    expect(studio).toContain('const landingFrame = backgroundPlacementFrame.value ?? currentFrame;');
    expect(studio).toContain('startFrame: landingFrame,');
    expect(studio).toContain('sourceFrameRefs: sortedIds,');
    expect(studio).toContain("repeat: { mode: 'finite', count: 1 },");
    // Exactly one call site — the handler invokes the store op once per Confirm.
    const callSites = studio.split('addBackgroundClip(layerId, {').length - 1;
    expect(callSites).toBe(1);
  });

  it('rejects a playhead strictly inside an existing clip with the exact locked copy and keeps the picker open (BKG-03/D-04)', () => {
    // The rejection copy appears EXACTLY once and matches the UI-SPEC table
    // verbatim; the picker stays open so the selection survives (no cancel in
    // the rejection branch).
    const copy = "Couldn't place the clip here. The playhead is inside an existing clip. Nothing changed.";
    const occurrences = studio.split(copy).length - 1;
    expect(occurrences).toBe(1);
    expect(studio).toContain("if (result.reason === 'start-collision') {");
    expect(studio).toContain("setApplyStatus('error');");
    expect(studio).toContain(`setApplyMessage("${copy}");`);
    // The rejection branch returns WITHOUT closing the picker.
    const rejectionBranch = studio.slice(studio.indexOf("if (result.reason === 'start-collision') {"), studio.indexOf('backgroundPicker.cancel();'));
    expect(rejectionBranch).not.toContain('backgroundPicker.cancel()');
    // The capsule announces rejections with role="alert" (UI-SPEC).
    expect(workflowStrip).toContain("role={props.isError ? 'alert' : 'status'}");
  });

  it('closes the picker on success and leaves Cancel with zero store interaction', () => {
    // Success path closes the picker (the rail reflects accepted state via the
    // existing reactive plumbing).
    expect(studio).toContain('backgroundPicker.cancel();');
    // Cancel routes to the wrapper that ALSO clears the replace target — the
    // controller's cancel only clears the open/selection/status signals, never
    // a store op (49-06 UAT round 7: a stale replace target would swap the
    // wrong clip on the next confirm).
    expect(studio).toContain('onCancel: handleCancelBackgroundPicker,');
    expect(backgroundPickerView).toContain('const cancel = () => {');
    expect(backgroundPickerView).toContain('open.value = false;');
    expect(backgroundPickerView).not.toContain('addBackgroundClip');
  });
});

describe('Physics Paint Photo row reference picker swap (50-03, S2/D-01/D-02/D-03)', () => {
  it('reuses the BackgroundAssetPickerView region swap for the reference picker (D-01)', () => {
    // The reference picker is a SECOND instance of the same full-area region
    // swap — the engine canvas stays mounted underneath, never replaced.
    expect(studioView).toContain('referencePicker?: ComponentProps<typeof BackgroundAssetPickerView>');
    expect(studioView).toContain('{referencePicker?.open ? <BackgroundAssetPickerView {...referencePicker} /> : null}');
    // The reference overlay renders AFTER the always-mounted canvas stack.
    const canvasStackIndex = studioView.indexOf('<MemoizedPhysicsPaintCanvasStack {...canvas} />');
    const referenceOverlayIndex = studioView.indexOf('{referencePicker?.open ? <BackgroundAssetPickerView');
    expect(canvasStackIndex).toBeGreaterThanOrEqual(0);
    expect(referenceOverlayIndex).toBeGreaterThan(canvasStackIndex);
  });

  it('threads the photo/reference intents from the workflow block to the dialog and the reference picker', () => {
    // The workflow block forwards the document's photo/reference track and the
    // open-dialog intent; the dialog bundle owns Import/Replace (D-03, via the
    // picker) and the store ports (Remove → clearPhotoReference + the unified
    // undo ledger, D-03 remove).
    expect(studio).toContain('photoReference: multiTrackRowBundle.photoReference,');
    expect(studio).toContain('onOpenReference: () => { referenceDialogOpen.value = true; },');
    expect(studio).toContain('onImportSource: () => referencePicker.openPicker(),');
    expect(studio).toContain('clearReference: (layerId: string) => {');
    expect(studio).toContain('const result = clearPhotoReference(layerId);');
    expect(studio).toContain('if (result.ok && result.descriptor) rotoMoveHistory.recordBackgroundEdit(result.descriptor);');
  });

  it('assembles the referencePicker view-model block with reference copy and a replace-on-confirm handler', () => {
    expect(studio).toContain('referencePicker: {');
    expect(studio).toContain("title: 'Import reference images',");
    expect(studio).toContain('onConfirm: handleConfirmReferencePicker,');
    expect(studio).toContain('onCancel: handleCancelReferencePicker,');
    expect(studio).toContain('onImport: referencePicker.importImages,');
  });

  it('Confirm calls setPhotoReferenceSource exactly once and announces the replacement capsule note (D-03)', () => {
    expect(studio).toContain('const result = setPhotoReferenceSource(layerId, sortedIds);');
    expect(studio).toContain("publishOperationResult('Reference source replaced.');");
    // Exactly one call site — the handler invokes the store op once per Confirm.
    const callSites = studio.split('setPhotoReferenceSource(layerId, sortedIds)').length - 1;
    expect(callSites).toBe(1);
    // The reference confirm handler REPLACES the source — it never adds a clip.
    const confirmHandler = studio.slice(
      studio.indexOf('const handleConfirmReferencePicker = (sortedIds: string[]) => {'),
      studio.indexOf('const handleCancelReferencePicker = () => {'),
    );
    expect(confirmHandler).not.toContain('addBackgroundClip');
  });

  it('Confirm records the source-set descriptor as one unified-ledger undo entry (50-03 D-03, G-52-5)', () => {
    const confirmHandler = studio.slice(
      studio.indexOf('const handleConfirmReferencePicker = (sortedIds: string[]) => {'),
      studio.indexOf('const handleCancelReferencePicker = () => {'),
    );
    // The dropped descriptor left an unrecorded document replacement in the
    // chain — every ledger entry recorded BEFORE a reference placement or
    // replacement failed the live-authority guard forever (undo/redo died).
    expect(confirmHandler).toContain('if (result.descriptor) rotoMoveHistory.recordBackgroundEdit(result.descriptor);');
  });

  it('hydrates the confirmed reference source bytes through the library path (REF-04)', () => {
    expect(studio).toContain('hydrateReferenceSourceImagesFromLibrary(');
    expect(studio).toContain('referencePicker.images.peek()');
    expect(studio).toContain('referencePicker.projectDir.peek()');
  });

  it('Cancel returns to the Studio untouched — zero store interaction', () => {
    expect(studio).toContain('onCancel: handleCancelReferencePicker,');
    expect(studio).toContain('const handleCancelReferencePicker = () => {');
    expect(studio).toContain('referencePicker.cancel();');
    // The reference picker's cancel never mutates the document.
    expect(backgroundPickerView).not.toContain('setPhotoReferenceSource');
  });

  it('keeps the picker title configurable with the Bg copy as the default', () => {
    expect(backgroundPickerView).toContain('title?: string;');
    expect(backgroundPickerView).toContain("const title = props.title ?? 'Import background images';");
    expect(backgroundPickerView).toContain('aria-label={title}');
  });
});

describe('Physics Paint Background Clip section (49-06, S5 right-panel properties)', () => {
  it('builds the backgroundClipSection prop with the selection signal and identity-stable ports', () => {
    // The Studio assembles the section props: the 49-05 selection signal (read
    // by the right panel to flip the Track tab) and the store/imageStore ports.
    expect(studio).toContain('const selectedBackgroundClipId = useSignal<string | null>(null);');
    expect(studio).toContain('backgroundClipSection: launchContext?.layerId');
    expect(studio).toContain('{ layerId: launchContext.layerId, selectedBackgroundClipId, ports: backgroundClipSectionPortsRef.current }');
    // The ports are identity-stable (useRef) so the memo stays cacheable.
    expect(studio).toContain('const backgroundClipSectionPortsRef = useRef({');
    expect(studio).toContain('getDocument: (layerId: string) => getEfxPaintDocument(layerId) ?? undefined,');
    expect(studio).toContain('setRepeat: (layerId: string, clipId: string, repeat: FrameLoopClipRepeat) => setBackgroundClipRepeat(layerId, clipId, repeat),');
    expect(studio).toContain('deleteClip: (layerId: string, clipId: string) => {');
    expect(studio).toContain('replaceSource: (_layerId: string, clipId: string) => {');
    expect(studio).toContain('backgroundReplaceTargetClipId.value = clipId;');
    expect(studio).toContain('resolveFilename: (sourceRef: string) => imageStore.getById(sourceRef)?.original_path,');
  });

  it('re-resolves the right-panel memo on the selection signal so a rail click flips the section', () => {
    // The 38-11 signal-bypasses-memo pattern: the selection signal is a memo
    // dep AND the panel reads its .value directly, so a Bg rail click flips
    // the Track tab to the Background Clip section without a Studio render.
    const memoStart = studio.indexOf('const rightPanel = rightPanelPropsMemo.resolve(');
    const memoEnd = studio.indexOf('const viewModel = usePhysicsPaintStudioViewModel', memoStart);
    const memoBlock = studio.slice(memoStart, memoEnd);
    expect(memoBlock).toContain('selectedBackgroundClipId');
    expect(memoBlock).toContain('backgroundClipSectionPortsRef');
    expect(rightPanel).toContain('const selectedBackgroundClipId = backgroundClipSection?.selectedBackgroundClipId.value ?? null;');
  });

  it('renders the Background Clip section mutually exclusively with the Track section', () => {
    // Clip selected → the section mounts keyed by clip id (fresh draft state);
    // no clip → the existing Track section renders unchanged (UI-SPEC empty row).
    expect(rightPanel).toContain("import { PhysicsPaintBackgroundClipSection, type PhysicsPaintBackgroundClipSectionProps } from './PhysicsPaintBackgroundClipSection';");
    expect(rightPanel).toContain('backgroundClipSection?: PhysicsPaintBackgroundClipSectionProps;');
    expect(rightPanel).toContain('<PhysicsPaintBackgroundClipSection key={selectedBackgroundClipId} {...backgroundClipSection!} />');
    // 261018-0ox I-10: the Track tab body lives in RightPanelTrackTab.
    expect(rightPanel).toContain('<RightPanelTrackTab');
    const trackTab = readFileSync(fileURLToPath(new URL('./view/RightPanelTrackTab.tsx', import.meta.url)), 'utf8');
    expect(trackTab).toContain('aria-label="Track options"');
    expect(trackTab).toContain('Track: {props.trackName}');
  });

  it('keeps the section copy and accessibility contract verbatim from the UI-SPEC table', () => {
    const section = readFileSync(fileURLToPath(new URL('./view/PhysicsPaintBackgroundClipSection.tsx', import.meta.url)), 'utf8');
    expect(section).toContain('aria-label="Background Clip"');
    expect(section).toContain('aria-label="Repeat"');
    expect(section).toContain('aria-describedby="physics-bg-repeat-hint"');
    expect(section).toContain('aria-label="Loop indefinitely"');
    expect(section).toContain('aria-pressed={isInfinite}');
    expect(section).toContain('aria-label="Delete clip"');
    expect(section).toContain('Enter a positive integer.');
    expect(section).toContain('image(s)');
    // No raw UUID/keyId may render (UI-SPEC copywriting contract): the VIEW
    // renders filenames and frame numbers only — the controller may use clip.id
    // internally for the store ops, but the render surface never prints it.
    const viewStart = section.indexOf('export function PhysicsPaintBackgroundClipSection');
    const viewBlock = section.slice(viewStart);
    expect(viewBlock).not.toContain('clip.id');
  });
});

describe('Physics Paint Bg rail timeline delete (49-06 UAT)', () => {
  it('routes Delete/Backspace through one shared dialog-free handler that records a unified-ledger undo step', () => {
    // The shared handler mirrors the section's D-08 delete: store op, record the
    // descriptor so Cmd/Ctrl+Z restores the clip, clear the selection on success
    // so the Track section stays reachable.
    expect(studio).toContain('const handleDeleteSelectedBackgroundClip = useCallback(() => {');
    expect(studio).toContain('const result = deleteBackgroundClip(layerId, clipId);');
    expect(studio).toContain('if (result.ok) {');
    expect(studio).toContain('if (result.descriptor) rotoMoveHistory.recordBackgroundEdit(result.descriptor);');
    expect(studio).toContain('selectedBackgroundClipId.value = null;');
    // The keyboard state/actions expose a SELECTED Bg clip to the dispatcher.
    expect(studio).toContain('hasSelectedBackgroundClip: selectedBackgroundClipId.value !== null,');
    expect(studio).toContain('deleteBackgroundClip: handleDeleteSelectedBackgroundClip,');
    // The sidebar trash delete rides the same unified-ledger undo step.
    expect(studio).toContain('if (result.ok && result.descriptor) rotoMoveHistory.recordBackgroundEdit(result.descriptor);');
    // The unified ledger records the delete as one undoable command.
    expect(historyHook).toContain("const recordBackgroundEdit = useCallback((descriptor: BackgroundEditDescriptor) => {");
    expect(historyHook).toContain("appliedRef.current.push({ kind: 'background', descriptor });");
    expect(historyHook).toContain('registerDocument(entry.descriptor.before);');
    expect(historyHook).toContain('registerDocument(entry.descriptor.after);');
    expect(historyHook).toContain('recordBackgroundEdit,');
  });

  it('paints the Bg row header selected in the left sidebar when a Bg rail is selected (no normal track selected)', () => {
    // The strip derives the Bg-selected state from the forwarded selection id.
    expect(workflowStrip).toContain('backgroundSelected: (props.selectedBackgroundClipId ?? null) !== null,');
    // The column blanks every normal track's active highlight and marks the
    // Bg row selected (visual selection only — the document active track and
    // the rich lane are unchanged).
    expect(headerColumn).toContain("readonly backgroundSelected?: boolean;");
    expect(headerColumn).toContain("const effectiveActiveTrackId = backgroundSelected ? '' : activeTrackId;");
    expect(headerColumn).toContain('selected={backgroundSelected}');
    expect(trackRow).toContain("physics-paint-track-row-header-selected");
    expect(trackRow).toContain("aria-pressed={selected ? 'true' : undefined}");
    expect(css).toContain('.physics-paint-track-row-header-background.physics-paint-track-row-header-selected');
  });
});

describe('Physics Paint missing Background source placeholder fill (49-06 UAT)', () => {
  it('renders a solid color for a missing Background clip instead of transparent, while track sources stay transparent', () => {
    // The compositor owns ONE deterministic constant — shared by Studio preview,
    // main preview, and export (same pure path, CMP-01).
    expect(compositor).toContain('export const EFX_PAINT_BACKGROUND_MISSING_FILL');
    expect(compositor).toContain("ctx.fillStyle = EFX_PAINT_BACKGROUND_MISSING_FILL;");
    expect(compositor).toContain("ctx.globalCompositeOperation = 'destination-over';");
    // The D-09 track-missing branch still pushes the report entry WITHOUT a fill.
    const trackMissingBlock = compositor.slice(
      compositor.indexOf('if (resolution.kind === \'missing\')'),
      compositor.indexOf('// 2-3. Background contribution'),
    );
    expect(trackMissingBlock).not.toContain('fillStyle');
  });
});

describe('Physics Paint reference ghost mount + missing-source capsule (50-04, S3/D-04/D-06/D-14)', () => {
  it('mounts the reference ghost in the monitor-paint layer seat above the composite (S3)', () => {
    // The Studio threads a referenceGhost config into the canvas stack; the view
    // renders the ghost layer as a sibling of the onion overlay (z-index 5).
    expect(studio).toContain('referenceGhost: programMonitorLayerId ? {');
    expect(studio).toContain('zoom: paperTextureScale,');
    expect(studio).toContain('onMissingSourceChange: handleReferenceMissingSourceChange,');
    expect(studioView).toContain('referenceGhost?: ComponentProps<typeof PhysicsPaintReferenceGhostLayer> | null;');
    expect(studioView).toContain('{canvasBounds && props.referenceGhost ? (');
    expect(studioView).toContain('<PhysicsPaintReferenceGhostLayer {...props.referenceGhost} />');
    // The ghost layer renders AFTER the tracks group (above the composite).
    const tracksGroupIndex = studioView.indexOf('physics-paint-tracks-group');
    const ghostIndex = studioView.indexOf('physics-paint-reference-ghost');
    expect(tracksGroupIndex).toBeGreaterThanOrEqual(0);
    expect(ghostIndex).toBeGreaterThan(tracksGroupIndex);
  });

  it('surfaces the missing reference source through the status capsule with the red warning triangle (D-04)', () => {
    expect(studio).toContain('const handleReferenceMissingSourceChange = useCallback((missing: boolean) => {');
    expect(studio).toContain("setApplyStatus('error');");
    expect(studio).toContain("setApplyMessage('Missing reference source — use Replace source to re-link.');");
  });

  it('keeps the ghost monitor-paint only — no reference input reaches the compositor or export (D-06)', () => {
    // The ghost draw module is imported only by the Studio view layer; the
    // compositor/flattened cache/preview/export never reference the ghost or the
    // photo/reference track.
    expect(compositor).not.toContain('drawReferenceGhost');
    expect(flattenedCache).not.toContain('drawReferenceGhost');
    expect(previewRenderer).not.toContain('drawReferenceGhost');
    expect(exportRenderer).not.toContain('drawReferenceGhost');
    expect(compositor).not.toContain('photoReference');
  });

  it('hides the ghost during playback by not drawing (D-14)', () => {
    // The ghost layer passes isPlaying into the draw; the decision returns
    // draw:false during playback (no opacity trick, no cache entry).
    expect(studio).toContain('referenceGhost: programMonitorLayerId ? {');
    expect(studio).toContain('isPlaying,');
  });
});

describe('Physics Paint reference transform handles (50-05, S4/D-13/D-06)', () => {
  it('writes the transform to the display property setter, never layerStore/keyframeStore (D-13)', () => {
    // The reference is not a layer: the handles write to setPhotoReferenceTransform
    // (a display preference) and must never import layerStore/keyframeStore.
    expect(referenceTransformHandles).toContain('setPhotoReferenceTransform');
    expect(referenceTransformHandles).not.toContain("from '../../../stores/layerStore'");
    expect(referenceTransformHandles).not.toContain("from '../../../stores/keyframeStore'");
  });

  it('mounts the transform handles overlay above the ghost layer (S4)', () => {
    // The Studio threads a referenceTransformHandles config into the canvas stack;
    // the view renders the overlay as a sibling of the ghost layer (z-index 6).
    // 260922-rd4: the envelope is now gated on the photo lock (mutual
    // exclusion) — same seat, same zoom, mount only while unlocked.
    expect(studio).toContain('referenceTransformHandles: programMonitorLayerId');
    expect(studio).toContain("stackDocument?.photoReference?.transformLocked === false");
    expect(studio).toContain('zoom: paperTextureScale,');
    expect(studioView).toContain('referenceTransformHandles?: ComponentProps<typeof PhysicsPaintReferenceTransformHandles> | null;');
    expect(studioView).toContain('{canvasBounds && props.referenceTransformHandles ? (');
    expect(studioView).toContain('<PhysicsPaintReferenceTransformHandles {...props.referenceTransformHandles} />');
    // The overlay renders AFTER the ghost layer (above it).
    const ghostIndex = studioView.indexOf('physics-paint-reference-ghost');
    const transformIndex = studioView.indexOf('physics-paint-reference-transform');
    expect(ghostIndex).toBeGreaterThanOrEqual(0);
    expect(transformIndex).toBeGreaterThan(ghostIndex);
  });

  it('is locked by default — no handles, no canvas grab (D-13)', () => {
    // While transformLocked is true the overlay renders pointer-events none, so
    // painting gestures pass through to the engine canvas beneath.
    expect(referenceTransformHandles).toContain('transformLocked');
    expect(referenceTransformHandles).toContain("pointerEvents: 'none'");
    expect(referenceTransformHandles).toContain("pointerEvents: 'all'");
  });

  it('passes painting through the overlay WRAPPER — it is pointer-events none even with no reference (50-UAT round 2 regression)', () => {
    // The .physics-paint-reference-transform wrapper is mounted over the canvas
    // region on EVERY layer launch (with or without a photo reference). Removing
    // the photo reference does NOT unmount it, so the wrapper itself must be
    // pointer-events none — otherwise it swallows every paint gesture and the
    // brush cursor turns into the default arrow ("I can't anymore paint").
    const wrapperRule = css.split('}')
      .find((block) => block.includes('.physics-paint-reference-transform') && block.includes('pointer-events: none'));
    expect(wrapperRule, 'Missing pointer-events: none on .physics-paint-reference-transform').toBeDefined();
    expect(wrapperRule).toContain('z-index: 6');
  });

  it('keeps the transform monitor-paint only — never the compositor or cache keys (D-13, D-06)', () => {
    // The transform writes to display properties only; the compositor/flattened
    // cache/preview/export never reference the transform handles or the
    // photo/reference transform.
    expect(compositor).not.toContain('setPhotoReferenceTransform');
    expect(flattenedCache).not.toContain('setPhotoReferenceTransform');
    expect(previewRenderer).not.toContain('setPhotoReferenceTransform');
    expect(exportRenderer).not.toContain('setPhotoReferenceTransform');
    expect(compositor).not.toContain('PhysicsPaintReferenceTransformHandles');
  });

  it('computes the bounds in working space from the accepted display transform (D-13)', () => {
    // The pure geometry module computes the SAME bounding box the ghost draws
    // (natural size scaled by zoom, centered, then rotated/scaled).
    expect(referenceTransform).toContain('export function getReferenceBounds');
    // 260922-rd4: the math moved into the shared core (base = image or
    // contain-fit rect) — getReferenceBounds stays a thin byte-identical wrapper.
    expect(referenceTransform).toContain('baseWidth * zoom');
    expect(referenceTransform).toContain('transform.rotation');
    expect(referenceTransform).toContain('function transformBoundsCore');
  });

  it('renders a VISIBLE and interactive rotation handle above the top edge (D-13 spec)', () => {
    // The spec (D-13) requires a rotation handle. It is a decorative stem +
    // knob (stem line pointer-events none; the SVG wrapper is pointer-events
    // none) whose knob is a DIRECT rotate target in handlePointerDown — checked
    // before the corner/edge handles and the corner rotation zones.
    expect(referenceTransformHandles).toContain('const rotHandle = {');
    expect(referenceTransformHandles).toContain('topMid.x + (normalX / normalLen) * (20 / zoom)');
    expect(referenceTransformHandles).toContain('cursor: getCursorForHandle(null, true, transform.rotation)');
    expect(referenceTransformHandles).toContain("handleType: 'rotate',");
    expect(referenceTransformHandles).toContain('startBounds: bounds');
  });
});

describe('Physics Paint photo reference dialog mount + Escape re-lock (50-UAT/50-05, S5/D-13/D-06)', () => {
  it('mounts the Photo Reference dialog opened from the strip camera icon (S5/50-UAT)', () => {
    // The Studio threads a referenceDialog bundle into the view (memo re-resolves
    // on every document mutation); the camera icon opens it; the right-panel
    // Track option tab no longer carries the Photo Reference section (50-UAT
    // modal redesign — all controls moved into the floating dialog).
    expect(studio).toContain('const referenceDialog = referenceDialogPropsMemo.resolve(');
    expect(studio).toContain('referenceDialogOpen.value = true;');
    expect(studio).toContain('photoReferenceSectionPortsRef');
    expect(studioView).toContain('<PhysicsPaintPhotoReferenceDialog {...referenceDialog} />');
    expect(studioView).toContain('MemoizedPhysicsPaintPlayScriptDialog');
    expect(rightPanel).not.toContain('photoReferenceSection');
  });

  it('wires the section ports to the store setters (display preferences)', () => {
    // The section ports route opacity → setPhotoReferenceOpacity, lock →
    // setPhotoReferenceTransformLocked (display preferences, no undo). The
    // Phase 50 mode port is REMOVED (52-02, D-15 clean break).
    expect(studio).toContain('setOpacity: (layerId: string, opacity: number) => setPhotoReferenceOpacity(layerId, opacity)');
    // 260922-rd4: the photo lock port now also cross-locks the background on
    // unlock (mutual exclusion) — the photo store op itself is unchanged.
    expect(studio).toContain('const result = setPhotoReferenceTransformLocked(layerId, locked);');
    expect(studio).toContain('if (result.ok && !locked) setBackgroundTransformLocked(layerId, true);');
  });

  it('wires Escape to re-lock the transform from anywhere in reference-transform mode (D-13)', () => {
    // The keyboard action returns true only when the transform was actually
    // unlocked; the Escape layer consumes at most one layer (Pitfall 2).
    expect(studio).toContain('relockReferenceTransform: () => {');
    expect(studio).toContain('setPhotoReferenceTransformLocked(layerId, true);');
    expect(studioKeyboard).toContain('relockReferenceTransform?: () => boolean;');
    expect(studioKeyboard).toContain('if (actions.relockReferenceTransform?.())');
  });

  it('keeps the mode switch flag-only — no compositor change (D-06)', () => {
    // The mode switch writes to the photo/reference track only; the compositor
    // never references the mode or the section.
    expect(compositor).not.toContain('setPhotoReferenceMode');
    expect(compositor).not.toContain('PhysicsPaintPhotoReferenceSection');
    expect(compositor).not.toContain('photoReference');
  });
});

describe('Physics Paint photo reference end-to-end integration contract (50-06, REF-05)', () => {
  it('wires the full flow: import → Photo row band → ghost → mode → opacity → transform → Escape re-lock → save/reopen', () => {
    // Import source (D-01/D-03): the dialog's Import/Replace button opens the
    // reference picker; Confirm replaces the source via setPhotoReferenceSource.
    expect(studio).toContain('onImportSource: () => referencePicker.openPicker(),');
    expect(studio).toContain('const result = setPhotoReferenceSource(layerId, sortedIds);');
    // 50-UAT redesign: the photo/reference is a strip camera icon, NOT a track
    // row — the timeline lane carries no Photo band (the ghost is the visual).
    expect(trackRow).not.toContain('physics-paint-photo-reference-band');
    // Ghost overlay (S3): the ghost draws in the monitor-paint layer seat.
    expect(studio).toContain('referenceGhost: programMonitorLayerId ? {');
    expect(studioView).toContain('<PhysicsPaintReferenceGhostLayer {...props.referenceGhost} />');
    // Opacity slider (D-12): routes opacity → setPhotoReferenceOpacity.
    expect(studio).toContain('setOpacity: (layerId: string, opacity: number) => setPhotoReferenceOpacity(layerId, opacity)');
    // Transform handles (D-13): the overlay writes to setPhotoReferenceTransform.
    expect(referenceTransformHandles).toContain('setPhotoReferenceTransform');
    // Escape re-lock (D-13): the keyboard action re-locks the transform.
    expect(studio).toContain('relockReferenceTransform: () => {');
    expect(studioKeyboard).toContain('if (actions.relockReferenceTransform?.())');
    // Save/reopen (REF-05): the reopen path hydrates the reference source bytes.
    expect(studio).toContain('hydrateReferenceSourceImagesFromLibrary(');
  });

  it('re-opens a persisted reference — the launch path hydrates the reference source bytes like the background (50-UAT round-2)', () => {
    // The Physic Paint reopen path installs the carried document and hydrates the
    // source registries from the loaded project library. It hydrated the
    // BACKGROUND (Phase 49 round-7 fix) but NOT the reference — registerDocument
    // alone left `_referenceSourceImages` empty, so every reopened reference
    // resolved 'missing' and the ghost stayed invisible until a fresh Replace.
    // The reference hydrates alongside the background WITH the library fallback.
    expect(launchIntegration).toContain('registerDocument(hydration.context.document);');
    expect(launchIntegration).toContain("void hydrateBackgroundSourceImagesFromLibrary(hydration.context.document, launchLibrary);");
    expect(launchIntegration).toContain("void hydrateReferenceSourceImagesFromLibrary(hydration.context.document, launchLibrary);");
  });

  it('keeps the reference out of flattened output in every mode — no reference input reaches the compositor, cache, preview, or export (D-06)', () => {
    // The D-06 exclusion is structural: the compositor, flattened cache, preview
    // renderer, and export renderer receive NO reference-input threading, so the
    // reference never reaches flattened output in any mode — even after
    // save/reopen (the persistence path carries the track, not the raster).
    const rasterSurface = [compositor, flattenedCache, previewRenderer, exportRenderer].join('\n');
    const referenceTokens = [
      'photoReference',
      'drawReferenceGhost',
      'getReferenceSourceFrameVerdict',
      'registerReferenceSourceImage',
      'setPhotoReferenceSource',
      'setPhotoReferenceVisible',
      'setPhotoReferenceOpacity',
      'setPhotoReferenceTransform',
      'setPhotoReferenceTransformLocked',
      'PhysicsPaintReferenceGhostLayer',
      'PhysicsPaintReferenceTransformHandles',
      'PhysicsPaintPhotoReferenceSection',
      'getReferenceBounds',
    ];
    for (const token of referenceTokens) {
      expect(rasterSurface).not.toContain(token);
    }
  });
});

describe('Physics Paint photo reference dialog structural lock (WR-03)', () => {
  it('keeps the retired timeline + Rail dropdown entry point retired while the Tools picker returns (261022-cfn superseded by 261022-o2a)', () => {
    // 261022-cfn removed the AM-3 picker whose only entry point was the
    // timeline + Rail dropdown. 261022-o2a reintroduces the picker through a
    // NEW entry point (the Tools popover's Create Rail / Load + Apply
    // buttons); the retired entry point must stay retired. The picker is
    // owned by the Studio (intent signal + identity memo) and rendered by the
    // view — the strip's action row only opens it, it never renders it.
    expect(studio).toContain('scriptPickerIntent');
    expect(studio).toContain('scriptPickerDialogPropsMemo.resolve(');
    expect(studio).toContain('openScriptPicker');
    expect(workflowStrip).toContain('onOpenScriptPicker');
    expect(studioView).toContain('scriptPickerDialog');
    expect(studioView).toContain('PhysicsPaintScriptPickerDialog');
    // The retired timeline + Rail dropdown path stays retired: the strip's
    // action row carries no picker markup or row data of its own.
    const actionRowStart = workflowStrip.indexOf('physics-paint-toolbox-scripts-row');
    const actionRowEnd = workflowStrip.indexOf('physics-paint-toolbox-actions-row', actionRowStart);
    expect(actionRowStart).toBeGreaterThan(-1);
    const actionRow = workflowStrip.slice(actionRowStart, actionRowEnd === -1 ? undefined : actionRowEnd);
    expect(actionRow).not.toContain('PhysicsPaintScriptPickerDialog');
    expect(actionRow).not.toContain('script-picker');
  });

  // WR-03 structural lock (260920-kov): the reveal-creation entry reaches the
  // Create Rail dialog through the Scripts tab's Create Rail flow and NOTHING
  // else. The photo reference dialog stays a pure reference control surface —
  // its props carry no reveal member, so it cannot receive reveal state without
  // this test failing. Pairs with the behavioural legs in
  // physicsPaintRotoPlayScriptController.test.ts.
  it('feeds the photo reference dialog from a memo whose input list carries no reveal term', () => {
    expect(studio).toContain(`const referenceDialog = referenceDialogPropsMemo.resolve(
    [referenceDialogOpen.value, launchContext?.layerId, efxPaintVersion.value, photoReferenceSectionPortsRef.current, referencePicker],
    () => ({
      open: referenceDialogOpen.value,
      layerId: launchContext?.layerId ?? null,
      ports: photoReferenceSectionPortsRef.current,
      onClose: () => { referenceDialogOpen.value = false; },
      onImportSource: () => referencePicker.openPicker(),
    }),`);
    // The dialog's prop surface is exactly { open, layerId, ports, onClose,
    // onImportSource } — there is no reveal input to receive reveal state.
    expect(photoReferenceDialog).toContain(`export interface PhysicsPaintPhotoReferenceDialogProps {
  /** Dialog visibility (owned by the Studio — set from the strip camera icon). */
  open: boolean;
  /** The launch layer; null means no Studio target (dialog renders nothing). */
  layerId: string | null;
  /** Store ports — production defaults hit the real store. */
  ports?: Partial<PhysicsPaintPhotoReferencePorts>;
  /** Close intent (Escape, header X). */
  onClose: () => void;
  /** Import/Replace source intent — opens the full-area reference picker. */
  onImportSource: () => void;
}`);
    // The dialog's receipt surface — the destructured props — carries no reveal
    // member either, so no call site can hand it reveal state.
    expect(photoReferenceDialog).toContain(`export function PhysicsPaintPhotoReferenceDialog({
  open,
  layerId,
  ports,
  onClose,
  onImportSource,
}: PhysicsPaintPhotoReferenceDialogProps) {`);
    // Every reference to "reveal" in this file is prose asserting the ABSENCE
    // of the flow (the 52-05 comment), never code.
    expect(photoReferenceDialog.toLowerCase().match(/reveal/g)).toHaveLength(2);
    // The dialog is fed ONLY from the bundle above — a direct prop spread would
    // escape the memo-input lock. 260923-fhn: the render line additionally
    // requires !pickerOpen (parents step aside while a gallery picker is open).
    expect(studioView).toContain('{referenceDialog && !pickerOpen ? <PhysicsPaintPhotoReferenceDialog {...referenceDialog} /> : null}');
  });
});

// 52.2-15 (D-16, sensitivity-map row 2): both Studio flush paths drain through
// ONE pilot flush pipeline instance. A component-level test cannot mount the
// Studio (Tauri window/engine deps), so the wiring is pinned by contract — the
// same style as the rest of this suite. The join itself (two overlapping
// callers → one drain, one push) is pinned behaviorally in the pipeline's own
// suite; these cases prove the Studio callers cannot bypass that join.
describe('52.2-15 one flushed drain for both Studio flush paths (D-16)', () => {
  const listenerFlush = (() => {
    const start = studio.indexOf('flushStudioStateRef.current = async () => {');
    return start === -1 ? '' : studio.slice(start, studio.indexOf('installPhysicPaintFlushRequestListener', start));
  })();
  const closeFlush = (() => {
    const start = studio.indexOf('usePhysicsPaintCloseFlush(');
    return start === -1 ? '' : studio.slice(start, start + 3600);
  })();

  it('creates exactly one pipeline instance and routes both flush paths through it', () => {
    expect(studio).toContain("import { createFlushPipeline, type FlushStep, type FlushPipeline } from './pilot/flushPipeline';");
    // One instance, however many callers: a second instance would let a close
    // start a second sequence while the requested flush is still in flight
    // (T-52.2-54 — two pushes for one document).
    expect((studio.match(/createFlushPipeline\(/g) ?? [])).toHaveLength(1);
    expect(listenerFlush).toContain('runStudioFlush([');
    expect(closeFlush).toContain('runStudioFlush([');
    // The one shared runner is the single place the pipeline is entered, so
    // the two paths cannot diverge.
    expect(studio).toContain('await flushPipeline.flush({ steps });');
  });

  it('keeps the close sequence: engine settle, aquarelle capture + live-pixel flush, playback settings, documentSync push', () => {
    const order = [
      'engineRef.current?.flushPendingStrokeFinalizations()',
      'flushAquarellePixels(currentFrame)',
      'rotoPlaybackSettingsController.flush()',
      'flushDocumentSyncRef.current()',
    ];
    const positions = order.map((step) => closeFlush.indexOf(step));
    expect(positions).not.toContain(-1);
    expect([...positions].sort((left, right) => left - right)).toEqual(positions);
    // The aquarelle sheet is invisible to the engine-1 stroke counter/queue
    // until captured; the close gate therefore always flushes in Roto.
    expect(closeFlush).toContain("() => workflowMode === 'roto'");
    // Brush: copyLiveAlphaCanvas composites the cosmetic wet display on top of
    // the dry canvas. Closing right after a stroke captured that fluorescent
    // wet look; settle the wet layer before the capture.
    expect(closeFlush).toContain("if (activeModule.value === 'watercolor') engineRef.current?.flushPendingStrokeFinalizations();");
    expect(closeFlush).toContain('else engineRef.current?.forceDry();');
  });

  it('keeps the requested-flush sequence: idle-gated engine settle, aquarelle capture + live-pixel flush, documentSync push', () => {
    const order = [
      'readInteractionIdle()',
      'flushAquarellePixels()',
      'pushLiveProjection(layerId, mode)',
    ];
    const positions = order.map((step) => listenerFlush.indexOf(step));
    expect(positions).not.toContain(-1);
    expect([...positions].sort((left, right) => left - right)).toEqual(positions);
    // Same settle-before-capture law on the save path.
    expect(listenerFlush).toContain('else engineRef.current?.forceDry();');
  });

  it('forces the aquarelle capture before the save/close drain and waits for promotion-deferred captures', () => {
    const helperStart = studio.indexOf('const flushAquarellePixels = useCallback(');
    const helperBlock = helperStart === -1
      ? ''
      : studio.slice(helperStart, studio.indexOf('// CACHE MERGE BASE', helperStart));
    const captureIndex = helperBlock.indexOf('aquarelleFlushCaptureRef.current?.()');
    const awaitIndex = helperBlock.indexOf('await Promise.allSettled(inFlight)');
    const drainIndex = helperBlock.indexOf('flushLivePixels(appFrame)');
    expect(captureIndex).toBeGreaterThan(-1);
    expect(awaitIndex).toBeGreaterThan(captureIndex);
    expect(drainIndex).toBeGreaterThan(awaitIndex);
    // A capture suspended on the auto-key promotion enqueues only after the
    // promise resolves; the flush must wait or it drains an empty queue.
    expect(studio).toContain('aquarelleCapturesInFlightRef.current.add(run)');
  });

  it('rejects a blank aquarelle sheet before it can overwrite painted cache pixels', () => {
    const captureStart = studio.indexOf('const handleAquarelleCaptureFrame = useCallback(');
    const captureBlock = captureStart === -1
      ? ''
      : studio.slice(captureStart, studio.indexOf('const flushAquarellePixels = useCallback(', captureStart));
    const snapshotIndex = captureBlock.indexOf('const liveAlphaCanvas = snapshot()');
    const inkIndex = captureBlock.indexOf('measureAquarelleCanvasInk(liveAlphaCanvas)');
    const guardIndex = captureBlock.indexOf('if (ink < AQUARELLE_MIN_CAPTURE_INK) return');
    const seqIndex = captureBlock.indexOf('const seq = ++aquarelleCaptureSeqRef.current');
    expect(snapshotIndex).toBeGreaterThan(-1);
    expect(inkIndex).toBeGreaterThan(snapshotIndex);
    expect(guardIndex).toBeGreaterThan(inkIndex);
    expect(seqIndex).toBeGreaterThan(guardIndex);
    // Calibrated on saved payloads: painted sheets score 4.6-11.3, blank
    // textured sheets 0.05-0.12 on this per-mille scale.
    expect(studio).toContain('const AQUARELLE_MIN_CAPTURE_INK = 1;');
  });

  it('keeps a non-flushed outcome visible to the facade and the unmount teardown intact', () => {
    // The facade's fail-closed contract depends on the flush closure throwing:
    // the pipeline never rejects, so the runner rethrows the outcome.
    expect(studio).toContain("if (outcome.status === 'flushed') return;");
    expect(listenerFlush).toContain('runStudioFlush([');
    expect(studio).toContain('return () => unlisten?.();');
  });

  it('drains the capture queue through the pipeline port before the caller steps', () => {
    expect(studio).toContain('drain: () => rotoPersistenceRef.current.drainLivePixelQueue()');
    expect(studio).toContain('interrupt: () => rotoPersistenceRef.current.interruptLivePixels()');
  });
});

// 260921-e21: the three Studio-origin surfaces — the reference selection, the
// background image keyframes and the tracks added with (+) — reach the save
// realm ONLY through the child→main document sync. The diagnosis at base
// (probes recorded in 260921-e21-RED-EVIDENCE.json) exonerates every link
// downstream of the push: the child transport, the parent apply, the reopen
// carrier and the child hydration each carry all three surfaces when they are
// driven directly. The link that can lose them is the child PUSH WIRING here,
// and it has two drop shapes: a pending change is consumed BEFORE the push mode
// is confirmed (so a change pending while the bridge mode is still unresolved
// is cleared with no push and no retry), and the push guard latches its
// fingerprint BEFORE the send resolves (so a send that fails suppresses that
// content for the rest of the session). A component-level test cannot mount the
// Studio (Tauri window/engine deps), so the wiring is pinned by contract — the
// same style as the 52.2-15 suite above.
describe('Studio-origin document state reaches the save realm (quick-260921-e21)', () => {
  const closePushPath = (() => {
    const start = studio.indexOf('flushDocumentSyncRef.current = async () => {');
    return start === -1 ? '' : studio.slice(start, studio.indexOf('// Non-gesture path:', start));
  })();
  const schedulerPushPath = (() => {
    const start = studio.indexOf('// Non-gesture path:');
    return start === -1 ? '' : studio.slice(start, studio.indexOf('// 52.1 (flush-before-save/export)', start));
  })();
  const pushPath = (() => {
    const start = studio.indexOf('const pushLiveProjection = (layerId');
    return start === -1 ? '' : studio.slice(start, studio.indexOf('const documentSyncDirtyRef = useRef(signal(false));', start));
  })();

  it('PIN 1 (reference selection): the close flush consumes the pending change only after a push with a confirmed mode', () => {
    // The close flush is the LAST automatic chance for an image-reference
    // selection to reach the save realm. Clearing the pending flag while the
    // bridge mode is still unresolved loses it outright: nothing bumps the
    // document version again, so no later flush ever re-marks it.
    expect(closePushPath).not.toBe('');
    const modeGate = closePushPath.indexOf("mode === 'Tauri'");
    expect(modeGate, 'the close flush must confirm the push mode before it consumes the pending change').toBeGreaterThan(-1);
    const clear = closePushPath.indexOf('documentSyncDirty.value = false;');
    expect(clear).toBeGreaterThan(modeGate);
  });

  it('PIN 2 (background keyframes): neither scheduler flush consumes the pending change before the push mode is confirmed', () => {
    // A background keyframe placement is not a gesture: it flushes on the
    // non-gesture debounce, and again on the idle transition. Both bodies must
    // leave the change pending when no push could be attempted.
    const bodies = schedulerPushPath.split('const tryFlush = () => {').slice(1);
    expect(bodies).toHaveLength(2);
    for (const body of bodies) {
      const modeGate = body.indexOf("mode === 'Tauri'");
      expect(modeGate).toBeGreaterThan(-1);
      const clear = body.indexOf('documentSyncDirty.value = false;');
      expect(clear).toBeGreaterThan(modeGate);
    }
  });

  it('PIN 3 ((+) track with its content): a failed push is retryable, never latched away', () => {
    // A track added with (+) and painted on travels only through this push. The
    // guard latches its fingerprint before the send resolves, so a failed send
    // would suppress that track for the rest of the session unless the wiring
    // re-arms the guard on the failure path.
    expect(pushPath).not.toBe('');
    expect(pushPath).toContain('sendEfxPaintDocumentSync(');
    expect(pushPath).toContain('.catch(');
    expect(pushPath).toContain('documentSyncPushGuardRef.current = createDocumentSyncPushGuard();');
  });
});

describe('quick-260922-al1 explicit Action-apply refusal on the status capsule', () => {
  const loadAndApplyBody = (() => {
    const start = studio.indexOf('const handleSelectedScriptLoadAndApply = useCallback(async () => {');
    return start === -1 ? '' : studio.slice(start, studio.indexOf('const handleApplyScript = useCallback(() => {', start));
  })();
  const applyScriptBody = (() => {
    const start = studio.indexOf('const handleApplyScript = useCallback(() => {');
    return start === -1 ? '' : studio.slice(start, studio.indexOf('const handleDiscardScript = useCallback(() => {', start));
  })();
  const rowActivateBody = (() => {
    const start = studio.indexOf('const handleScriptRowActivate = useCallback(async (id: string) => {');
    return start === -1 ? '' : studio.slice(start, studio.indexOf('const handleSelectedScriptLoadAndApply = useCallback(async () => {', start));
  })();

  it('routes BOTH apply entry points through the refusal helper and the capsule', () => {
    // The `setApplyStatus`/`setApplyMessage` pair is the ONLY real surface: the
    // Studio destructures `setLastError` with an empty slot, so its value is
    // discarded and a refused apply used to reach the user as nothing at all.
    for (const [name, body] of [['handleSelectedScriptLoadAndApply', loadAndApplyBody], ['handleApplyScript', applyScriptBody]] as const) {
      expect(body, `${name} must be sliceable for this pin`).not.toBe('');
      expect(body, `${name} must consult the refusal mapper`).toContain('buildRotoScriptApplyRefusalMessage(error)');
      expect(body, `${name} must keep the clipboard message for unaffected codes`).toContain('?? error?.message ?? null');
      expect(body, `${name} must publish the message to every surface`).toContain('setLastError(message);');
      expect(body, `${name} must publish the message to the capsule`).toContain('setApplyMessage(message);');
      expect(body, `${name} must mark the capsule as an error`).toContain("setApplyStatus('error');");
    }
  });

  it('clears the refusal line on a successful apply, and never marks a success as an error', () => {
    // code review CR-01: the refusal this path published must not outlive a
    // later success — the capsule would otherwise keep showing a stale
    // "nothing changed" line, since `applyStatus` never reaches 'success' on
    // the script apply path.
    expect(loadAndApplyBody).toContain('clearOwnedScriptApplyRefusal();');
    expect(applyScriptBody).toContain('clearOwnedScriptApplyRefusal();');
    // 55-06: handleSelectedScriptLoadAndApply has TWO mutually exclusive error
    // publications — the refused-row branch (host codes, D-09/D-11) and the
    // apply-failure branch (clipboard codes). handleApplyScript keeps one.
    for (const [name, body, expectedErrors] of [
      ['handleSelectedScriptLoadAndApply', loadAndApplyBody, 2],
      ['handleApplyScript', applyScriptBody, 1],
    ] as const) {
      const clears = body.split('setLastError(null);').length - 1;
      expect(clears, `${name} must clear the last error exactly once`).toBe(1);
      // Error publications sit AFTER the success clear — a success can never
      // take an error branch.
      const errors = body.split("setApplyStatus('error');").length - 1;
      expect(errors, `${name} must mark an error ${expectedErrors === 1 ? 'exactly once' : 'in each refusal branch'}`).toBe(expectedErrors);
      // The success clear precedes the apply-failure error publication — the
      // refused-row branch (55-06) is an EARLY RETURN before the success path,
      // so success can never reach it. lastIndexOf finds the apply-failure one.
      expect(body.indexOf('setLastError(null);')).toBeLessThan(body.lastIndexOf("setApplyStatus('error');"));
      // Ownership is taken on failure branches only.
      const owns = body.split('scriptApplyRefusalOwnedRef.current = true;').length - 1;
      expect(owns, `${name} must take refusal ownership on each error branch`).toBe(expectedErrors);
      expect(body.indexOf('setLastError(null);')).toBeLessThan(body.lastIndexOf('scriptApplyRefusalOwnedRef.current = true;'));
    }
    // The helper is ownership-gated and returns the capsule to idle — it can
    // never wipe a message another surface posted, and never claims 'success'.
    expect(studio).toContain('if (!scriptApplyRefusalOwnedRef.current) return;');
    expect(studio).toContain('scriptApplyRefusalOwnedRef.current = false;');
    expect(studio).toContain('setApplyMessage(null);');
    expect(studio).toContain("setApplyStatus('idle');");
  });

  it('keeps both callbacks identity-stable with the setter set they use declared', () => {
    expect(loadAndApplyBody).not.toBe('');
    expect(studio).toContain('}, [rotoScript, rotoScriptLibrary, setLastError, setApplyMessage, setApplyStatus, clearOwnedScriptApplyRefusal, flushBrushScriptAfterApply]);');
    expect(studio).toContain('}, [rotoScript, setLastError, setApplyMessage, setApplyStatus, clearOwnedScriptApplyRefusal, flushBrushScriptAfterApply]);');
    // The shared post-apply capture seam is itself identity-stable.
    expect(studio).toContain('}, [rotoScript]);\n  const handleScriptRowActivate = useCallback(');
  });

  it('does NOT change handleScriptRowActivate — it loads, it never applies', () => {
    expect(rowActivateBody).not.toBe('');
    expect(rowActivateBody).toContain('rotoScriptLibrary.activateAndLoad(id);');
    expect(rowActivateBody).not.toContain('applyScript');
    expect(rowActivateBody).not.toContain('setApplyStatus');
    expect(rowActivateBody).not.toContain('setApplyMessage');
    expect(rowActivateBody).not.toContain('buildRotoScriptApplyRefusalMessage');
  });

  it('adds no second refusal route: the mapper is imported once and called only at the apply/refusal sites', () => {
    // 55-06 (D-09): one import + three call sites — two in
    // handleSelectedScriptLoadAndApply (refused-row branch + apply-failure
    // branch) and one in handleApplyScript.
    // 261022-pim: a fourth site — the Alt+click delete re-bake failure in
    // handleAquarelleDeleteStroke — reuses the SAME mapper and capsule.
    // 261022-tv1: a fifth site — the stroke-move re-bake failure in
    // handleAquarelleMoveStroke — reuses the same mapper. No second import,
    // no new status surface.
    // 261022-ujp: a sixth site — the stroke stack step re-bake failure in
    // handleAquarelleStepStroke — same mapper, same capsule.
    // 261024-mz5: a seventh site — the watercolor transform re-bake failure in
    // handleAquarelleTransformStrokes — same mapper, same capsule.
    // 261024-p5q: an eighth site — the watercolor appearance re-bake failure in
    // handleAquarelleAppearanceStrokes — same mapper, same capsule.
    // 261024-vga: a ninth site — the exact stack placement re-bake failure in
    // handleAquarellePlaceStroke — same mapper, same capsule.
    const mentions = studio.split('buildRotoScriptApplyRefusalMessage').length - 1;
    expect(mentions).toBe(10); // one import + nine call sites
    expect(studio).toContain("import { buildRotoScriptApplyRefusalMessage } from './roto/physicsPaintRotoScriptApplyRefusal';");
  });

  it('surfaces through the EXISTING capsule bundle — no toast, no dialog, no new status surface', () => {
    // The capsule reads this exact pair; the refusal change adds copy to it and
    // must not have introduced a competing surface.
    expect(studio).toContain(": (applyStatus !== 'success' ? applyMessage : null), statusIsError: applyStatus === 'error',");
  });
});

describe('quick-260922-qad Studio open viewport positioning wiring', () => {
  it('passes the launch startFrame into the strip as timelineOpenFrame', () => {
    // The one-shot positioning behaviour is proven by the strip's viewport
    // legs; this pin only guarantees the wiring exists on the workflow object.
    expect(studio).toContain('timelineOpenFrame: launchContext?.startFrame ?? null');
  });
});

describe('260922-rd4 background transform via the shared photo-reference handles path', () => {
  it('pins (1) the Studio passes target: background to the background handles envelope', () => {
    expect(studio).toContain("target: 'background' as const,");
    expect(studio).toContain('backgroundTransformHandles: programMonitorLayerId');
    // Mutual exclusion: the envelope mounts only while the background lock is open.
    expect(studio).toContain("stackDocument?.background.transformLocked === false");
  });

  it('pins (2) PhysicsPaintStudioView mounts a target="background" handles instance', () => {
    expect(studioView).toContain('backgroundTransformHandles?: ComponentProps<typeof PhysicsPaintReferenceTransformHandles> | null;');
    expect(studioView).toContain('class="physics-paint-background-transform"');
    expect(studioView).toContain('<PhysicsPaintReferenceTransformHandles {...props.backgroundTransformHandles} />');
  });

  it('pins (3) ONE handles component carries target: photo-reference | background and dispatches setBackgroundTransform (reuse)', () => {
    expect(referenceTransformHandles).toContain("target: 'photo-reference' | 'background'");
    expect(referenceTransformHandles).toContain('setBackgroundTransform');
    // The photo write endpoint still exists — same component, dispatch only.
    expect(referenceTransformHandles).toContain('setPhotoReferenceTransform');
    // Shared bounds core: both wrappers, one rotation/offset implementation.
    expect(referenceTransform).toContain('export function getReferenceBounds');
    expect(referenceTransform).toContain('export function getBackgroundBounds');
    expect(referenceTransform).toContain('function transformBoundsCore');
  });

  it('pins (4) the Background Clip section wires setTransformLocked', () => {
    expect(backgroundClipSection).toContain('setTransformLocked: (layerId: string, locked: boolean) => PhotoReferenceDisplayResult;');
    expect(backgroundClipSection).toContain('aria-label="Lock background transform"');
    expect(backgroundClipSection).toContain('toggleTransformLocked');
    // Studio port wires the store op and the mutual-exclusion cross-lock.
    expect(studio).toContain('setTransformLocked: (layerId: string, locked: boolean) => {');
    expect(studio).toContain('setBackgroundTransformLocked(layerId, locked)');
    expect(studio).toContain('setPhotoReferenceTransformLocked(layerId, true);');
    // Escape chain: background relock after the reference relock.
    expect(studio).toContain('relockBackgroundTransform: () => {');
    expect(studioKeyboard).toContain('relockBackgroundTransform?: () => boolean;');
    expect(studioKeyboard).toContain('if (actions.relockBackgroundTransform?.())');
  });
});

describe('261008-ig1 Task 2 — Studio multi-clip selection, open target, and reveal contract', () => {
  it('owns the selection, modal open target, import mode, and reveal signals', () => {
    expect(studio).toContain('const selectedSoundId = useSignal<string | null>(null);');
    // 261008-ryq: the 'list' open mode is gone — the target is clipId | '' | null.
    expect(studio).toContain('const audioModalTarget = useSignal<string | null>(null);');
    expect(studio).not.toContain("useSignal<'list' | string | null>");
    expect(studio).toContain("const audioImportMode = useSignal<'append' | 'replace'>('append');");
    expect(studio).toContain('const revealRequest = useSignal<{ frame: number; nonce: number } | null>(null);');
  });

  it('header launcher auto-selects the first clip (empty state at zero); dblclick targets the clip', () => {
    expect(studio).not.toContain("audioModalTarget.value = 'list'");
    expect(studio).not.toContain('audios.length === 1');
    expect(studio).toContain('audios.length === 0');
    expect(studio).toContain("audioModalTarget.value = ''");
    expect(studio).toContain('selectedSoundId.value = audios[0].id');
    expect(studio).toContain("audioModalTarget.value = selectedSoundId.peek() ?? ''");
    expect(studio).toContain('audioModalTarget.value = clipId');
    expect(studio).toContain('audioModalTarget.value !== null');
    expect(studio).toContain("audioModalTarget.value = null");
  });

  it('exposes the selected sound to the dispatcher and the Audio-tab ports to the panel (261008-ryq)', () => {
    // Keyboard state/actions: one-shot removal of the selected sound clip.
    expect(studio).toContain('hasSelectedSoundClip: selectedSoundId.value !== null,');
    expect(studio).toContain('removeSelectedSound: () => audioModalController.removeSelected(),');
    // Sidebar Audio tab: lazy ports gated on a layerId, refreshed with the
    // version-driven panel memo.
    expect(studio).toContain('audioSectionPorts: launchContext?.layerId ? audioSectionPortsRef.current : undefined,');
    expect(studio).toContain('audioSectionPortsRef');
    // The controller instance is handed to the ports through a latest ref.
    expect(studio).toContain('audioModalControllerRef.current = audioModalController;');
  });

  it('routes band settles by the patch clipId through the per-clip store door (no slot shim)', () => {
    expect(studio).toContain('patch.clipId');
    expect(studio).toContain('patchDocumentSound(layerId, patch.clipId');
    expect(studio).not.toContain('setDocumentSoundSlot');
  });

  it('feeds the strip the audios list and reveals on a fresh nonce', () => {
    expect(studio).toContain('documentAudios: resolveDocumentAudios()');
    expect(studio).toContain('revealSoundClip');
    expect(studio).toContain('nonce: (previous?.nonce ?? 0) + 1');
    expect(studio).not.toContain('documentSound: resolveDocumentSound()');
  });

  it('ensures peaks once per distinct sourceId (Set in-flight guard)', () => {
    expect(studio).toContain('[...new Set(audios.map((clip) => clip.sourceId))]');
    expect(studio).toContain('soundPeaksEnsureRef = useRef<Set<string>>(new Set())');
  });
});

// 261017-w4x I-05 (Q3): Opacity is top-bar only for every paint mode. The
// top-bar slider must route at call time the same way Brush size already does
// — watercolor writes aquarelleParams.load (Pigment), Brush mode writes
// settings.opacity. Without the watercolor arm, deleting the Paint-tab Opacity
// orphans Pigment until I-01 lands. Scalar predicates keep TAP diagnostics
// one-line (project idiom).
describe('261017-w4x I-05 top-bar opacity call-time router', () => {
  it('handleOpacityChange routes watercolor to setAquarelleParam(\'load\') and else to setBrushOpacity', () => {
    // 261018-f15 C2: the routers extract to identity-stable useCallbacks so the
    // Paint-tab pair can share ONE write-through. The call-time module read and
    // both arms stay locked.
    const routerStart = studio.indexOf('const handleOpacityChange = useCallback(');
    expect(routerStart, 'handleOpacityChange must exist').toBeGreaterThan(-1);
    const routerEnd = studio.indexOf('const topBar = topBarPropsMemo.resolve(', routerStart);
    expect(routerEnd, 'router ends before the topBar memo').toBeGreaterThan(routerStart);
    const opacityHandler = studio.slice(routerStart, routerEnd);
    expect(
      opacityHandler.includes('setAquarelleParam(\'load\''),
      'handleOpacityChange watercolor arm must write aquarelleParams.load',
    ).toBe(true);
    expect(
      opacityHandler.includes('setBrushOpacity'),
      'handleOpacityChange else-arm must write settings.opacity via setBrushOpacity',
    ).toBe(true);
    // Call-time module read — never capture activeModule in the memo deps.
    expect(
      opacityHandler.includes('activeModule.value === \'watercolor\''),
      'handleOpacityChange must read activeModule.value at call time',
    ).toBe(true);
    // The topBar memo binds the shared router (not a bare setter).
    const topBarStart = studio.indexOf('const topBar = topBarPropsMemo.resolve(');
    const topBarEnd = studio.indexOf('const toolRail = toolRailPropsMemo.resolve(', topBarStart);
    const topBarBlock = studio.slice(topBarStart, topBarEnd);
    expect(topBarBlock).toContain('onOpacityChange: handleOpacityChange');
    expect(
      topBarBlock.includes('onOpacityChange: setBrushOpacity,'),
      'onOpacityChange must not be a bare setBrushOpacity binding',
    ).toBe(false);
    // Memo deps stay the slim set — no activeModule captured for the router.
    const topBarDeps = topBarBlock.slice(0, topBarBlock.indexOf('], () =>'));
    expect(topBarDeps.indexOf('activeModule'), 'topBar deps must not capture activeModule').toBe(-1);
  });

  it('Brush size router stays the locked pattern sibling of the opacity router', () => {
    const routerStart = studio.indexOf('const handleBrushSizeChange = useCallback(');
    expect(routerStart, 'handleBrushSizeChange must exist').toBeGreaterThan(-1);
    const routerEnd = studio.indexOf('const handleOpacityChange = useCallback(', routerStart);
    const sizeHandler = studio.slice(routerStart, routerEnd);
    expect(sizeHandler).toContain("setAquarelleParam('size', value)");
    expect(sizeHandler).toContain('setBrushSize(value)');
    const topBarStart = studio.indexOf('const topBar = topBarPropsMemo.resolve(');
    const topBarEnd = studio.indexOf('const toolRail = toolRailPropsMemo.resolve(', topBarStart);
    const topBarBlock = studio.slice(topBarStart, topBarEnd);
    expect(topBarBlock).toContain('onBrushSizeChange: handleBrushSizeChange');
  });
});

// Quick 261019-mj2 Task 3: direct-paint auto-key self-promotion. Painting an
// empty OR generated/interpolated cell starts the stroke immediately on the
// warm canvas while a blank real key is promoted in parallel. The pointerdown
// handler must never intercept the gesture (no preventDefault/stopPropagation/
// setPointerCapture, no buffering) — the engine receives it untouched.
describe('261019-mj2 Task 3 direct-paint auto-key self-promotion', () => {
  function section(source: string, startMarker: string, endMarker: string): string {
    const start = source.indexOf(startMarker);
    expect(start, `missing start marker: ${startMarker}`).toBeGreaterThan(-1);
    const end = source.indexOf(endMarker, start + startMarker.length);
    expect(end, `missing end marker: ${endMarker}`).toBeGreaterThan(start);
    return source.slice(start, end);
  }

  it('shares ONE promotion helper between script targets and pointerdown', () => {
    expect(studio).toContain('promoteRotoPaintTargetRef.current = async (');
    const promotionHelper = section(
      studio,
      'promoteRotoPaintTargetRef.current = async (',
      'prepareRotoScriptTargetRef.current = async (',
    );
    // Empty AND generated cells promote; only a real-key branch stays outside.
    // Quick 261022-cfn Task 1: both non-real kinds use the ONE shared resolver;
    // only the base selection and the rail join differ between them.
    expect(promotionHelper).not.toContain('resolvePreviousRealKeyPayload');
    expect(promotionHelper).toContain('resolvePreviousRealKeyBase({');
    expect(promotionHelper).toContain('records: physicPaintStore.getRotoRealKeyRecords(launch.layerId, studioActiveTrackId())');
    expect(promotionHelper).toContain('cachedRotoFrames: latestRotoFramesRef.current');
    expect(promotionHelper).toContain('}, source.appFrame);');
    const unavailableIndex = promotionHelper.indexOf("source.selectionKind === 'generated-interpolation' && resolution.kind === 'unavailable'");
    expect(unavailableIndex).toBeGreaterThan(-1);
    // Generated + unavailable fails closed BEFORE any dispatch (no blank key).
    expect(unavailableIndex).toBeLessThan(promotionHelper.indexOf('physicalKeyUtilities.addEmptyKey('));
    expect(promotionHelper).toContain("return fail('previous-key-bytes-unavailable');");
    // Generated + clone relabels only appFrame; no blank frame is built.
    const cloneBaseBlock = section(
      promotionHelper,
      "if (source.selectionKind === 'generated-interpolation' && resolution.kind === 'clone') {",
      '} else {',
    );
    expect(cloneBaseBlock).toContain('frameIndex: resolution.payload.frameIndex');
    expect(cloneBaseBlock).toContain('appFrame: source.appFrame');
    expect(cloneBaseBlock).toContain('bytes: resolution.payload.bytes');
    expect(cloneBaseBlock).not.toContain('buildBlankRotoFrame');
    expect(cloneBaseBlock).toContain("baseKind = 'clone';");
    // Empty + a previous record (clone or unavailable) and generated + blank
    // use a blank base; only the no-previous-key case opens a new rail.
    const blankBaseBlock = section(promotionHelper, '} else {', '// A previous real key');
    expect(blankBaseBlock).toContain('buildBlankRotoFrame(canvasWidth, canvasHeight, source.appFrame)');
    expect(blankBaseBlock).toContain("baseKind = 'blank';");
    expect(promotionHelper).toContain("const joinPreviousRail = resolution.kind !== 'blank';");
    expect(promotionHelper).toContain('{ joinPreviousRail },');
    // The base AND its kind are pinned before dispatch.
    expect(promotionHelper.indexOf('pendingEntry.blankFrame = baseFrame;')).toBeGreaterThan(-1);
    expect(promotionHelper.indexOf('pendingEntry.baseKind = baseKind;')).toBeGreaterThan(-1);
    expect(promotionHelper.indexOf('pendingEntry.baseKind = baseKind;')).toBeLessThan(promotionHelper.indexOf('physicalKeyUtilities.addEmptyKey('));
    expect(promotionHelper).toContain('physicalKeyUtilities.addEmptyKey(');
    expect(promotionHelper).toContain('acceptedBefore');
    expect(promotionHelper).toContain('blankFrame: baseFrame');
    // prepareRotoScriptTarget routes both non-real kinds through the helper.
    const prepareBlock = section(
      studio,
      'prepareRotoScriptTargetRef.current = async (',
      '// RARE BLANK-AFTER-PLAY guard',
    );
    expect(prepareBlock).toContain('promoteRotoPaintTargetRef.current(');
    expect(prepareBlock).toContain("source: 'auto-key-paint'");
    // The pointerdown orchestration wrapper (which owns the pending entry +
    // exemption) delegates to the ONE helper above.
    const beginBlock = section(studio, 'beginRotoFrameEditImplRef.current = (', 'const beginRotoFrameEdit = useCallback(');
    expect(beginBlock).toContain('startRotoPaintPromotion({');
    expect(studio).toContain('void promoteRotoPaintTargetRef.current(input)');
    // 261022-cfn + follow-up: two addEmptyKey call sites — the auto-paint
    // promotion and the single-purpose + Rail new-rail action.
    expect(studio.match(/physicalKeyUtilities\.addEmptyKey\(/g) ?? []).toHaveLength(2);
    const newRailBlock = section(
      studio,
      'const handleCreateRotoKeyRail = useCallback(',
      'const beginRotoFrameEdit = useCallback(',
    );
    expect(newRailBlock).toContain('buildBlankRotoFrame(canvasWidth, canvasHeight, appFrame)');
    expect(newRailBlock).toContain('{ forceNewSegment: true }');
    expect(newRailBlock).toContain("currentFrameSelectionKind === 'real-key'");
  });

  it('never intercepts the pointer gesture (no preventDefault / stopPropagation / setPointerCapture)', () => {
    const beginBlock = section(studio, 'beginRotoFrameEditImplRef.current = (', 'const beginRotoFrameEdit = useCallback(');
    expect(beginBlock).not.toContain('preventDefault');
    expect(beginBlock).not.toContain('stopPropagation');
    expect(beginBlock).not.toContain('setPointerCapture');
    // Names are assembled at runtime so the dead-artifact grep gate over the
    // source tree (which includes this file) stays at zero hits.
    for (const deadArtifact of [
      'rotoFirst' + 'StrokeBuffer',
      'replayBuffered' + 'Stroke',
      'replayBuffered' + 'Samples',
      'replay' + 'StrokeRef',
    ]) {
      expect(studio).not.toContain(deadArtifact);
    }
  });

  it('passes the pointer event from the capture listener into the Studio intent', () => {
    expect(studioView).toContain('onInputIntent?: (event: PointerEvent) => void;');
    expect(studioView).toContain('onPointerDownCapture={(event) => props.onInputIntent?.(event)}');
    expect(studio).toContain('beginRotoFrameEditImplRef.current(event);');
  });

  it('gates promotion on the effective paint-producing tool and a non-transform target', () => {
    const beginBlock = section(studio, 'beginRotoFrameEditImplRef.current = (', 'const beginRotoFrameEdit = useCallback(');
    expect(beginBlock).toContain("resolveEffectiveTool(settings.tool) === 'paint'");
    expect(beginBlock).toContain("aquarelleActiveTool.value === 'brush'");
    expect(beginBlock).toContain("aquarelleActiveTool.value === 'water'");
    expect(beginBlock).toContain("aquarelleActiveTool.value === 'pen'");
    expect(beginBlock).toContain('physics-paint-reference-transform');
    expect(beginBlock).toContain('physics-paint-background-transform');
    expect(beginBlock).toContain('event.button !== 0');
    expect(beginBlock).toContain('isPlaying');
    // One promotion per launch/frame while it is in flight.
    expect(beginBlock).toContain('pendingFirstPaintTargetRef.current');
    expect(beginBlock).toContain('rotoEditBuffer.markDirty(currentFrame)');
    expect(beginBlock).toContain('rotoSession.markLiveOverlayDirty(currentFrame)');
    expect(beginBlock).toContain('syncPendingRotoFrames()');
    expect(beginBlock).not.toContain('markCurrentFrameDirty(');
  });

  it('clears a generated display synchronously before dispatch and registers a same-frame sheet reset', () => {
    const beginBlock = section(studio, 'beginRotoFrameEditImplRef.current = (', 'const beginRotoFrameEdit = useCallback(');
    const clearBlock = section(studio, 'const clearGeneratedRotoDisplayForPaint = useCallback(', 'beginRotoFrameEditImplRef.current = (');
    expect(clearBlock).toContain('clearPreviewBaseImage()');
    expect(clearBlock).toContain('resetBackground()');
    expect(clearBlock).toContain('.clear()');
    expect(clearBlock).toContain('aquarelleResetSheetRef.current?.()');
    expect(clearBlock.indexOf('clearPreviewBaseImage()')).toBeLessThan(clearBlock.indexOf('.clear()'));
    expect(beginBlock).toContain('clearGeneratedRotoDisplayForPaint()');
    // Reset registration flows AquarelleCanvasLayer → CanvasMount → Studio.
    const aquarelleLayer = readFileSync(fileURLToPath(new URL('./engine/AquarelleCanvasLayer.tsx', import.meta.url)), 'utf8');
    expect(aquarelleLayer).toContain('onResetSheetReady?: (resetSheet: () => void) => void;');
    expect(aquarelleLayer).toContain('const onResetSheetReadyRef = useRef(props.onResetSheetReady);');
    expect(aquarelleLayer).toContain('onResetSheetReadyRef.current?.(resetSheet);');
    expect(canvasMount).toContain('onAquarelleResetSheetReady?: (resetSheet: () => void) => void;');
    expect(canvasMount).toContain('onResetSheetReady={(resetSheet) => onAquarelleResetSheetReadyRef.current?.(resetSheet)}');
    expect(studio).toContain('const handleAquarelleResetSheetReady = useCallback((resetSheet: () => void) => {');
  });

  it('awaits the created key before both capture paths write pixels', () => {
    const completedBlock = section(studio, 'canvasCompletedMutationImplRef.current = (', 'const handleCanvasCompletedMutation = useCallback(');
    const awaitIndex = completedBlock.indexOf('await pendingFirstPaintTarget.promise');
    expect(awaitIndex).toBeGreaterThan(-1);
    expect(awaitIndex).toBeLessThan(completedBlock.indexOf('rotoPersistence.captureLivePixels('));
    expect(completedBlock).toContain('firstPaintTarget.ok');
    expect(completedBlock).toContain('keyId = firstPaintTarget.keyId');
    expect(completedBlock).toContain('pendingSelfPromotionForCompletedFrame');
    const captureBlock = section(studio, 'const handleAquarelleCaptureFrame = useCallback(', '// CACHE MERGE BASE');
    const aquarelleAwaitIndex = captureBlock.indexOf('await pendingFirstPaintTarget.promise');
    expect(aquarelleAwaitIndex).toBeGreaterThan(-1);
    expect(aquarelleAwaitIndex).toBeLessThan(captureBlock.indexOf('captureLivePixels('));
    // Quick 261022-cfn Task 1: the pending base kind chooses the aquarelle merge
    // base — a cloned base multiplies over the previous key's paint; a blank
    // base encodes the sheet alone.
    expect(captureBlock).toContain("cachedBase = pendingFirstPaintTarget.baseKind === 'clone' ? pendingFirstPaintTarget.blankFrame : null;");
    expect(captureBlock).toContain('aquarelleMergeBaseRef.current = { appFrame: playFrame, base: cachedBase }');
  });

  it('keeps the watercolor cached base visible while painting on an already painted key', () => {
    // Engine-1 is hidden in Water color, so the DOM multiply base IS the
    // visible cached paint. Clearing the reference on the first dirty stroke
    // made the existing paint vanish while the new stroke was painted; the
    // composite only came back on the next clean frame-enter.
    const referenceBlock = section(studio, 'const rotoFrameEditing = useRotoFrameEditingController({', 'const beginRotoFrameEditImplRef');
    expect(referenceBlock).toContain('clearReference: () => {');
    expect(referenceBlock).toContain("if (activeModule.value === 'watercolor') return;");
    expect(referenceBlock).toContain('clearCachedRotoReferenceUrl();');
  });

  it('keeps the aquarelle merge base at sheet start so re-captures cannot compound density', () => {
    // The same live sheet is re-captured on settle, frame-leave and close.
    // Advancing the base to the payload just committed made each pass multiply
    // the sheet over itself: pigment density compounded and the reopened cache
    // displayed darker than the paint (darker-on-reopen).
    const captureBlock = section(studio, 'const handleAquarelleCaptureFrame = useCallback(', '// CACHE MERGE BASE');
    expect(captureBlock).not.toContain('base: committed');
    // The base is read once per sheet session ...
    expect(captureBlock).toContain('if (aquarelleMergeBaseRef.current?.appFrame !== playFrame)');
    expect(captureBlock).toContain('The sheet ACCUMULATES strokes until the session ends');
    // ... and cleared only where the sheet itself is reset or ends.
    expect(studio).toContain('const handleAquarelleSheetSessionEnd = useCallback(() => {');
    expect(studio).toContain('aquarelleMergeBaseRef.current = null');
  });

  it('forces a promotion-deferred capture through the flush gate the navigation flush already passed', () => {
    // The frame-leave flush runs while the capture is still awaiting the
    // promotion, so the capture is enqueued AFTER that flush returned. Without
    // a second forced flush it sits out CAPTURE_PRODUCE_QUIET_MS (6000ms) and
    // leaving/closing inside that window strands the pixels — the empty cache
    // on return / after key change.
    const completedBlock = section(studio, 'canvasCompletedMutationImplRef.current = (', 'const handleCanvasCompletedMutation = useCallback(');
    expect(completedBlock).toContain('deferredPromotionCapture = true');
    const engineCaptureIndex = completedBlock.indexOf('rotoPersistence.captureLivePixels(');
    const engineFlushIndex = completedBlock.indexOf('rotoPersistence.flushLivePixels(appFrame)');
    expect(engineCaptureIndex).toBeGreaterThan(-1);
    expect(engineFlushIndex).toBeGreaterThan(engineCaptureIndex);
    expect(completedBlock).toContain('if (deferredPromotionCapture)');

    const captureBlock = section(studio, 'const handleAquarelleCaptureFrame = useCallback(', '// CACHE MERGE BASE');
    const enqueueIndex = captureBlock.indexOf('const work = enqueue()');
    const aquarelleFlushIndex = captureBlock.indexOf('rotoPersistenceRef.current.flushLivePixels(playFrame)');
    expect(enqueueIndex).toBeGreaterThan(-1);
    expect(aquarelleFlushIndex).toBeGreaterThan(enqueueIndex);
    // Guarded by the pending-promotion branch and applied to the retry turn.
    expect(captureBlock).toContain('if (pendingFirstPaintTarget === null) return;');
    expect((captureBlock.match(/flushDeferredPromotionCapture\(\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('releases the accepted settlement lease even when the post-acceptance aftermath throws', () => {
    // An accepted edit that never acks keeps its exclusive store lease: the
    // canvas stack stays pointer-events:none for the rest of the session
    // (Brush: pointer cursor, no ring). The aquarelle layer sets its own
    // pointer-events, which is why Water color still paints under that lock.
    const routeBlock = section(studio, 'physicalEditCoordinatorRouteRef.current = {', '// 47-03 Task 2');
    const tryIndex = routeBlock.indexOf('try {');
    const finallyIndex = routeBlock.indexOf('} finally {');
    const ackIndex = routeBlock.indexOf('acknowledgePhysicalEditSettlement');
    expect(tryIndex).toBeGreaterThan(-1);
    expect(finallyIndex).toBeGreaterThan(tryIndex);
    expect(ackIndex).toBeGreaterThan(finallyIndex);
    expect(routeBlock).toContain('catch (error)');
    expect(routeBlock).toContain("console.error('[PhysicsPaintStudio] physical settlement aftermath failed:'");
  });

  it('suppresses the accepted-key cache reload for a self-promotion and pins the blank base', () => {
    const acceptanceBlock = section(studio, 'const acceptedSelectedKeyId = accepted?.after.selectedKeyId ?? null;', 'return transition;');
    expect(acceptanceBlock).toContain('acceptedSelfPromotion');
    const guardIndex = acceptanceBlock.indexOf('if (!acceptedSelfPromotion)');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeLessThan(acceptanceBlock.indexOf('loadCachedRotoReferenceFrame('));
    expect(acceptanceBlock).toContain('setCachedRotoRepaintBaseFrame(pendingSelfPromotion.blankFrame)');
    expect(acceptanceBlock).toContain('cachedRotoRepaintBaseFrameRef.current = pendingSelfPromotion.blankFrame');
    expect(acceptanceBlock).toContain("base: pendingSelfPromotion.baseKind === 'clone' ? pendingSelfPromotion.blankFrame : null");
    expect(acceptanceBlock).toContain('acknowledgePhysicalEditSettlement');
  });

  it('skips the blank-key reconcile so the first auto-key stroke is never wiped', () => {
    // paste-key settlement ALWAYS reconciles. For a self-promotion the accepted
    // key is blank, so the reconcile's engine.clear(true) + atomic dry clear
    // erased the live first stroke the instant the key appeared. The port must
    // detect the pending promotion and keep the live engine untouched.
    const reconcileBlock = section(studio, 'reconcileCurrentFrame: (appFrame) => {', 'engineState: {');
    expect(reconcileBlock).toContain("pendingPromotion?.source === 'auto-key-paint'");
    expect(reconcileBlock).toContain('pendingPromotion.launchOperationId === launchForPromotion.operationId');
    expect(reconcileBlock).toContain('pendingPromotion.layerId === launchForPromotion.layerId');
    expect(reconcileBlock).toContain('pendingPromotion.appFrame === appFrame');
    expect(reconcileBlock).toContain('cachedRotoRepaintBaseFrameRef.current = pendingPromotion.blankFrame');
    expect(reconcileBlock).toContain('setCachedRotoRepaintBaseFrame(pendingPromotion.blankFrame)');
    const guardIndex = reconcileBlock.indexOf("pendingPromotion?.source === 'auto-key-paint'");
    expect(guardIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeLessThan(reconcileBlock.indexOf('loadCachedRotoReferenceFrame('));
  });

  it('exempts only the canvas input lock while a self-promotion is in flight', () => {
    expect(studio).toContain('const rotoInputDisabled = mutationLocked && !autoKeyPromotionPaintExempt.value;');
    expect(studio).toContain('const autoKeyPromotionPaintExempt = useSignal(false);');
    expect(studio).not.toContain("Créez une key");
    expect(studio).not.toContain('Generated frame ${currentFrame} is render-only.');
    expect(studio).not.toContain('lockInputForWarm(FRESH_FRAME_WARM_MS)');
  });

  it('discards the stroke and replays an accepted-but-unvalidated key on failure', () => {
    const failureBlock = section(studio, 'const handleRotoPaintPromotionFailure = useCallback(', 'const startRotoPaintPromotion = ');
    expect(failureBlock).toContain('engineRef.current?.undo()');
    expect(failureBlock).toContain('aquarelleResetSheetRef.current?.()');
    expect(failureBlock).toContain('acceptedBefore');
    expect(failureBlock).toContain("operationKind: 'undo'");
    expect(failureBlock).toContain('historyProvenance');
    expect(failureBlock).toContain('setLastError');
    expect(studio).toContain('source: \'auto-key-paint\'');
  });

  it('never renders the removed Create key fallback in auto-paint', () => {
    expect(studioView).not.toContain('createKeyFallback');
    expect(studioView).not.toContain('physics-paint-create-key-fallback');
    expect(studioView).not.toContain('Create key');
    expect(css).not.toContain('.physics-paint-create-key-fallback');
    expect(studio).not.toContain('autoKeyFallbackFrame');
    expect(studio).not.toContain('handleCreateKeyFallback');
    expect(studio).not.toContain("source: 'create-key-button'");
  });
});

// Quick 261019-mj2 Task 4 (D-14): the composite undo ledger reserves the NEXT
// accepted command from a NO-ARGUMENT beginAutoKeyPaintGroup() call placed
// immediately before the promotion starts. The coordinator mints the
// operationId at dispatch, so any pre-minted id argument would be stale.
describe('261019-mj2 Task 4 composite auto-key undo reservation', () => {
  function section(source: string, startMarker: string, endMarker: string): string {
    const start = source.indexOf(startMarker);
    expect(start, `missing start marker: ${startMarker}`).toBeGreaterThan(-1);
    const end = source.indexOf(endMarker, start + startMarker.length);
    expect(end, `missing end marker: ${endMarker}`).toBeGreaterThan(start);
    return source.slice(start, end);
  }

  it('arms the no-argument reservation immediately before the promotion start', () => {
    const beginBlock = section(studio, 'beginRotoFrameEditImplRef.current = (', 'const beginRotoFrameEdit = useCallback(');
    expect(beginBlock).toMatch(/rotoMoveHistory\.beginAutoKeyPaintGroup\(\);\s*void startRotoPaintPromotion\(\{/);
    // NO pre-minted operation id ever reaches the reservation.
    expect(studio).not.toContain('beginAutoKeyPaintGroup(pendingOperationId');
    expect(studio).not.toMatch(/beginAutoKeyPaintGroup\([^)]/);
  });

  it('cancels the reservation when the promotion fails so no held acceptance survives', () => {
    const failureBlock = section(studio, 'const handleRotoPaintPromotionFailure = useCallback(', 'const startRotoPaintPromotion = ');
    expect(failureBlock).toContain('rotoMoveHistory.cancelAutoKeyPaintGroup();');
  });
});

// 261022-pim: Water color stroke select + Alt+click delete surface.
describe('261022-pim watercolor stroke select surface', () => {
  it('mounts the stroke overlay inside the layer above the canvas and below the brush cursor', () => {
    const overlayIndex = aquarelleCanvasLayer.indexOf('<AquarelleStrokeOverlay');
    expect(overlayIndex).toBeGreaterThan(-1);
    expect(overlayIndex).toBeGreaterThan(aquarelleCanvasLayer.indexOf('ref={attachEngine}'));
    expect(overlayIndex).toBeLessThan(aquarelleCanvasLayer.indexOf('<AquarelleBrushCursor />'));
    // 261023-g4p: the adapter carries the watercolor identity only; the ONE
    // shared gesture implementation owns the surface.
    expect(aquarelleStrokeOverlay).toContain('testId="aquarelle-stroke-overlay"');
    expect(aquarelleStrokeOverlay).toContain('badgeTestId="aquarelle-stroke-badge"');
    expect(aquarelleStrokeOverlay).toContain('ghostTestId="aquarelle-drag-ghost"');
    expect(scriptStrokeOverlay).toContain('data-testid={props.testId}');
    expect(scriptStrokeOverlay).toContain("pointerEvents: 'auto'");
    // 261022-tv1: a Cmd release mid-drag must not unmount the ghost surface;
    // 261024-mz5 Task 2: nor may an in-flight transform preview.
    expect(scriptStrokeOverlay).toContain('if (!selectMode && !moveArmed && drag === null && transformPreview === null) return null;');
  });

  it('applies selection in the pointer handler and reads Alt for delete', () => {
    expect(scriptStrokeOverlay).toContain('onPointerDown={handlePointerDown}');
    expect(scriptStrokeOverlay).toContain('selectScriptStrokeAt(');
    expect(scriptStrokeOverlay).toContain('event.altKey');
    expect(aquarelleStrokeOverlay).not.toContain('onPointerDown');
    expect(scriptStrokeOverlay).not.toContain('useEffect');
    expect(scriptStrokeOverlay).not.toContain('useSignal');
  });

  it('renders the select/Move toggle in the watercolor rail bound to the select signal', () => {
    const watercolorRail = toolRail.slice(
      toolRail.indexOf('function WatercolorRail'),
      toolRail.indexOf('export interface PhysicsPaintToolRailProps'),
    );
    expect(watercolorRail).toContain('data-testid="aquarelle-select-toggle"');
    expect(watercolorRail).toContain('onClick={() => toggleAquarelleSelectMode()}');
    expect(watercolorRail).toContain('aria-pressed={selectActive}');
    expect(watercolorRail).toContain('const selectActive = aquarelleSelectMode.value || temporaryMove.value;');
    // Select/Move owns the active state: the paint tool is deselected.
    expect(watercolorRail).toContain('const isActive = !selectActive && active === id;');
    expect(watercolorRail).toContain('aquarelleLiveStrokeCount.value === 0');
    // Better hover text: the shortcut, the drag, the Backspace delete and the
    // 261022-ujp Space step live on it.
    expect(watercolorRail).toContain('Select — Cmd toggles Select on/off · Drag moves the selected stroke · Corner handles scale · Edge handles resize width or height · Top handle rotates · Backspace deletes the selected stroke · < sends the selected stroke one step back · > one step forward');
    expect(toolRail).toContain("'Move — Cmd toggles Move on/off · Click selects a stroke · Drag moves the selected stroke · Corner handles scale · Edge handles resize width or height · Top handle rotates · Backspace deletes the selected stroke · < sends the selected stroke one step back · > one step forward'");
    expect(toolRail).toContain('title={item.tooltip ?? item.label}');
  });

  it('greys Move and makes Cmd inert when there is no live script (both modes)', () => {
    expect(studio).toContain("isMoveAvailable: () => (activeModule.peek() === 'watercolor'");
    expect(studio).toContain('? aquarelleLiveStrokeCount.peek() > 0');
    expect(studio).toContain(': moveAvailable.peek()),');
    // Deleting the last selectable stroke leaves select mode.
    const selectionSource = readFileSync(fileURLToPath(new URL('./view/aquarelleStrokeSelection.ts', import.meta.url)), 'utf8');
    expect(selectionSource).toContain('if (aquarelleLiveStrokeCount.value === 0) setAquarelleSelectMode(false);');
  });

  it('applies the empty-script Move law to activation and exits a stale Move', () => {
    expect(studio).toContain("const moveAvailable = useComputed(");
    // quick-261026-odd: a rail frame resolves as a REAL key (D-26), so the
    // cell kind alone never sees it — the loop-range test is the second half.
    expect(studio).toContain("if (cell.kind !== 'real') return false;");
    expect(studio).toContain('return !isRotoLoopRailFrame(rotoTimelineModel.loopResolutionContext.value.ranges, cell.appFrame);');
    expect(studio).toContain("if (tool === 'move' && activeModule.peek() === 'brush' && !moveAvailable.peek()) return;");
    expect(studio).toContain("if (activeModule.value !== 'brush' || settings.tool !== 'move') return;");
    expect(studio).toContain('if (moveAvailable.value || mutationLocked) return;');
    expect(studio).toContain('selectTool(lastNonMoveToolRef.current, settings.physicsMode);');
    // The owner funnel repairs pre-guard guide captures before resolving.
    expect(studio).toContain('purgeAquarelleGuideGroups(frame);');
    // A derived cell or a Loop Clip rail frame drops any stale capture.
    expect(studio).toContain('purgeBrushScriptFrame(currentFrame);');
    expect(studio).toContain('dropNonKeyCellBrushScript(currentFrame);');
    expect(studio).toContain('clearFrameScriptOwner();');
    expect(studio).toContain('const railOwned = isRotoLoopRailFrame(');
    expect(studio).toContain("if (activeModule.peek() === 'brush' && settingsRef.current.tool === 'move') {");
    expect(studio).toContain('if (moveAvailable.peek()) {');
    const acceptanceAnchor = studio.indexOf('const beforeKeyIds = new Set(');
    const acceptanceStart = studio.lastIndexOf("if (transition === 'accepted' && accepted) {", acceptanceAnchor);
    expect(studio.slice(acceptanceStart, acceptanceAnchor)).toContain('applyFrameModuleState(currentFrame);');
    const revealStart = studio.indexOf('createReveal: async (input) => {');
    const revealEnd = studio.indexOf('mapRevealRailRejectionReason', revealStart);
    expect(studio.slice(revealStart, revealEnd)).toContain('applyFrameModuleState(launchContextRef.current?.startFrame ?? 0);');
  });

  it('keeps the new signals out of the Studio and layer render bodies', () => {
    expect(studio).not.toContain('aquarelleSelectMode.value');
    expect(studio).not.toContain('aquarelleLiveStrokeCount.value');
    expect(studio).not.toContain('aquarelleSelectedStrokeMutationId.value');
    // 261023-g4p: the shared edition signals stay leaf-only too.
    expect(studio).not.toContain('scriptSelectMode.value');
    expect(studio).not.toContain('scriptSelectedStrokeId.value');
    expect(studio).not.toContain('scriptStrokeDrag');
    expect(studio).not.toContain('temporaryMove.value');
    // The held-Cmd / select reads live in the brush-cursor leaf, never the layer body.
    expect(aquarelleCanvasLayer.indexOf('temporaryMove.value')).toBeGreaterThan(
      aquarelleCanvasLayer.indexOf('function AquarelleBrushCursor'),
    );
    expect(aquarelleCanvasLayer.indexOf('aquarelleSelectMode.value')).toBeGreaterThan(
      aquarelleCanvasLayer.indexOf('function AquarelleBrushCursor'),
    );
  });

  it('wires the delete callback through the canvas mount props and memo deps', () => {
    expect(canvasMount).toContain('onAquarelleDeleteStrokes?: (mutationIds: readonly number[]) => void;');
    expect(canvasMount).toContain(
      'onDeleteStrokes={(mutationIds) => onAquarelleDeleteStrokesRef.current?.(mutationIds)}',
    );
    expect(studio).toContain('onAquarelleDeleteStrokes: handleAquarelleDeleteStrokes,');
    expect(studio).toContain('getAquarellePaperId, handleAquarelleDeleteStrokes, handleAquarelleTransformStrokes]');
  });
});

// 261022-pim Task 3: delete + re-bake is ONE aquarelle-script ledger command.
// The delete handler records the edit only after the re-bake succeeds; the
// replay port swaps the snapshot, resets the live sheet, awaits the SAME
// shared apply, and rolls the raw snapshot back on failure. Neither path
// consults the coordinator.
describe('261022-pim aquarelle delete undo wiring', () => {
  const deleteHandlerStart = studio.indexOf('const handleAquarelleDeleteStrokes = useCallback(');
  const deleteHandlerEnd = studio.indexOf('const canvasMountPropsMemo', deleteHandlerStart);
  const deleteHandler = studio.slice(deleteHandlerStart, deleteHandlerEnd);

  it('records the edit as one aquarelle-script command only after the re-bake succeeds', () => {
    expect(deleteHandlerStart).toBeGreaterThan(-1);
    expect(deleteHandler).toContain('const editId = beginAquarelleDeleteEdit(frameIds);');
    expect(deleteHandler).not.toContain('deleteAquarelleStrokeForEdit');

    // 261022-pim: the re-bake reads the RECORDED timeline, never the live
    // engine capture — a completed Apply refreshes the display and drops the
    // guide strokes, so applyCurrentScript refused silently on the 2nd delete.
    const applySite = deleteHandler.indexOf('const ok = await rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame));');
    const successSite = deleteHandler.indexOf('if (ok) {');
    const recordSite = deleteHandler.indexOf('rotoMoveHistory.recordAquarelleScriptEdit(editId);');
    expect(applySite).toBeGreaterThan(-1);
    expect(deleteHandler).not.toContain('applyCurrentScript');
    expect(successSite).toBeGreaterThan(applySite);
    expect(recordSite).toBeGreaterThan(successSite);

    // Failure restores the pre-attempt script.
    const rollbackSite = deleteHandler.indexOf("restoreAquarelleEditSnapshot(editId, 'undo')");
    expect(rollbackSite).toBeGreaterThan(recordSite);
  });

  it('the replay port restores the snapshot, resets the sheet, and awaits the shared apply', () => {
    const replayStart = studio.indexOf('aquarelleScriptHistory: {');
    expect(replayStart).toBeGreaterThan(-1);
    const replayPort = studio.slice(replayStart, studio.indexOf('undoPaint:', replayStart));

    expect(replayPort).toContain('const revert = restoreAquarelleEditSnapshot(editId, direction);');
    expect(replayPort).toContain('if (revert === null) return false;');
    expect(replayPort).toContain('aquarelleResetSheetRef.current?.();');
    expect(replayPort).toContain('const ok = await rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame));');
    expect(replayPort).not.toContain('applyCurrentScript');
    expect(replayPort).toContain('restoreAquarelleSnapshotRaw(revert);');
    expect(replayPort).toContain('return false;');
    expect(replayPort).toContain('rotoScript.notifySourceRevision();');
    expect(replayPort).not.toContain('physicalEditCoordinator');
  });

  it('wires the Delete/Backspace action and the Cmd tap toggle (watercolor only)', () => {
    // 261023-g4p: the Studio delegates; the ONE consume law (active port +
    // selected id, peek-only) lives in the shared edition module.
    expect(studio).toContain('deleteSelectedAquarelleStroke: () => deleteSelectedScriptStroke(),');
    expect(scriptStrokeEdition).toContain('if (!port.isActive()) return false;');
    expect(scriptStrokeEdition).toContain('const ids = [...scriptSelectedStrokeIds.peek()];');
    expect(scriptStrokeEdition).toContain('port.deleteStrokes(ids);');
    // The watercolor port reuses the same handlers the overlay/keyboard use.
    expect(studio).toContain("isActive: () => activeModule.peek() === 'watercolor' && aquarelleSelectMode.peek(),");
    expect(studio).toContain('deleteStrokes: (ids) => handleAquarelleDeleteStrokes(ids),');
    expect(studio).toContain('moveStrokes: (ids, dxPx, dyPx) => handleAquarelleMoveStrokes(ids, dxPx, dyPx),');
    expect(studio).toContain('stepStroke: (mutationId, direction) => handleAquarelleStepStroke(mutationId, direction),');
    // A Cmd tap toggles the persistent select mode in watercolor mode.
    expect(studio).toContain('onMetaTap: () => {');
    expect(studio).toContain("if (activeModule.peek() === 'watercolor') {");
    expect(studio).toContain('toggleAquarelleSelectMode();');
    // Brush mode: Cmd selects Move itself (previous tool deselected); a second
    // tap returns to the last non-Move tool, and the Move gate matches the rail.
    expect(studio).toContain("const lastNonMoveToolRef = useRef<'paint' | 'erase'>('paint');");
    expect(studio).toContain("if (settings.tool !== 'move') lastNonMoveToolRef.current = settings.tool;");
    expect(studio).toContain('selectTool(lastNonMoveToolRef.current, settings.physicsMode);');
    expect(studio).toContain("if (settings.tool === 'paint' && moveAvailable.peek()) {");
    expect(studio).toContain("selectTool('move', settings.physicsMode);");
  });

  it('declares the aquarelle ledger entry and replay port in the history hook', () => {
    expect(historyHook).toContain("readonly kind: 'aquarelle-script';");
    expect(historyHook).toContain('readonly editId: number;');
    expect(historyHook).toContain('const recordAquarelleScriptEdit = useCallback((editId: number) => {');
    expect(historyHook).toContain("await route.replay(entry.editId, 'undo')");
    expect(historyHook).toContain("await route.replay(entry.editId, 'redo')");
  });
});

// 261022-tv1: Cmd+drag stroke move. During the gesture the overlay writes
// only the ghost signal; the release path is begin edit -> reset sheet ->
// await the shared apply -> record on success -> raw rollback on failure.
describe('261022-tv1 watercolor stroke move wiring', () => {
  const moveHandlerStart = studio.indexOf('const handleAquarelleMoveStrokes = useCallback(');
  const moveHandlerEnd = studio.indexOf('// 56-12 CACHE WRITE', moveHandlerStart);
  const moveHandler = studio.slice(moveHandlerStart, moveHandlerEnd);

  it('exists and owns the release path in order (begin -> reset -> await apply -> record on success -> rollback)', () => {
    expect(moveHandlerStart).toBeGreaterThan(-1);
    const beginSite = moveHandler.indexOf('const editId = beginAquarelleMoveEdit(frameIds, delta.x, delta.y);');
    const resetSite = moveHandler.indexOf('aquarelleResetSheetRef.current?.();');
    const applySite = moveHandler.indexOf('const ok = await rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame));');
    const successSite = moveHandler.indexOf('if (ok) {');
    const recordSite = moveHandler.indexOf('rotoMoveHistory.recordAquarelleScriptEdit(editId);');
    const rollbackSite = moveHandler.indexOf("restoreAquarelleEditSnapshot(editId, 'undo')");
    expect(beginSite).toBeGreaterThan(-1);
    expect(resetSite).toBeGreaterThan(beginSite);
    expect(applySite).toBeGreaterThan(resetSite);
    expect(successSite).toBeGreaterThan(applySite);
    expect(recordSite).toBeGreaterThan(successSite);
    expect(rollbackSite).toBeGreaterThan(recordSite);
    // The re-bake reads the RECORDED timeline, never the live engine capture.
    expect(moveHandler).not.toContain('applyCurrentScript');
  });

  it('converts the pointer delta through the one bridge and never captures the engine', () => {
    expect(moveHandler).toContain('aquarelleEnginePixelDeltaToUv(');
    expect(moveHandler).not.toContain('mutationEngine');
    expect(moveHandler).not.toContain('engineRef');
    expect(moveHandler).not.toContain('clipboard');
  });

  it('gates on the same tokens as the delete handler', () => {
    expect(moveHandler).toContain('if (isPhysicalMutationLocked()) return;');
    expect(moveHandler).toContain('if (rotoScript.applying.peek() || rotoScript.mutationLocked.peek()) return;');
    expect(moveHandler).toContain("if (rotoTimelineModel.currentCell.peek().kind !== 'real') return;");
    expect(moveHandler).toContain('if (isAquarelleScriptEditInFlight()) return;');
  });

  it('wires the move callback through the canvas mount props and memo deps', () => {
    expect(canvasMount).toContain('onAquarelleMoveStrokes?: (mutationIds: readonly number[], dxPx: number, dyPx: number) => void;');
    expect(canvasMount).toContain('onMoveStrokes={(mutationIds, dxPx, dyPx) => onAquarelleMoveStrokesRef.current?.(mutationIds, dxPx, dyPx)}');
    expect(studio).toContain('onAquarelleMoveStrokes: handleAquarelleMoveStrokes,');
    expect(studio).toContain('handleAquarelleMoveStrokes, getAquarellePlayFrame, getAquarellePaperId, handleAquarelleDeleteStrokes, handleAquarelleTransformStrokes]');
    expect(aquarelleCanvasLayer).toContain('onMoveStrokes?: (mutationIds: readonly number[], dxPx: number, dyPx: number) => void;');
    expect(aquarelleCanvasLayer).toContain('onMoveStrokes={(mutationIds, dxPx, dyPx) => onMoveStrokesRef.current?.(mutationIds, dxPx, dyPx)}');
    expect(aquarelleStrokeOverlay).toContain('onMoveStrokes: (mutationIds: readonly number[], dxPx: number, dyPx: number) => void;');
  });

  it('keeps the gesture surface in the ONE shared overlay leaf and the ghost signal out of the Studio', () => {
    expect(scriptStrokeOverlay).toContain('DRAG_THRESHOLD_PX');
    expect(scriptStrokeOverlay).toContain('onPointerMove={handlePointerMove}');
    expect(scriptStrokeOverlay).toContain('onPointerUp={handlePointerUp}');
    expect(scriptStrokeOverlay).toContain('onPointerCancel={handlePointerCancel}');
    expect(scriptStrokeOverlay).toContain('data-testid={dragged ? props.ghostTestId : undefined}');
    expect(scriptStrokeOverlay).toContain('setPointerCapture(');
    expect(scriptStrokeOverlay).toContain(
      'if (!selectMode && !moveArmed && drag === null && transformPreview === null) return null;',
    );
    expect(scriptStrokeOverlay).not.toContain('useEffect');
    expect(scriptStrokeOverlay).not.toContain('useState');
    // No second gesture copy remains in the adapter.
    expect(aquarelleStrokeOverlay).not.toContain('DRAG_THRESHOLD_PX');
    expect(aquarelleStrokeOverlay).not.toContain('handlePointerMove');
    expect(studio).not.toContain('aquarelleStrokeDrag');
  });

  it('clears a stale ghost when select mode disarms or a script edit begins', () => {
    const selectionSource = readFileSync(fileURLToPath(new URL('./view/aquarelleStrokeSelection.ts', import.meta.url)), 'utf8');
    expect(selectionSource).toContain('clearAquarelleStrokeDrag();');
    const beginMove = selectionSource.slice(selectionSource.indexOf('export function beginAquarelleMoveEdit('));
    expect(beginMove.indexOf('clearAquarelleStrokeDrag();')).toBeGreaterThan(-1);
    expect(beginMove.indexOf('clearAquarelleStrokeDrag();')).toBeLessThan(
      beginMove.indexOf('if (aquarelleScriptEditInFlight) return null;'),
    );
    // The disarm law itself is shared.
    const disarm = scriptStrokeEdition.slice(scriptStrokeEdition.indexOf('export function setScriptSelectMode('));
    expect(disarm.slice(0, disarm.indexOf('export interface ScriptStrokeDrag'))).toContain('clearScriptStrokeDrag();');
  });

  it('keeps the 261022-pim delete pins intact', () => {
    expect(studio).toContain('const handleAquarelleDeleteStrokes = useCallback(');
    expect(studio).toContain('onAquarelleDeleteStrokes: handleAquarelleDeleteStrokes,');
    expect(scriptStrokeOverlay).toContain('selectScriptStrokeAt(');
  });
});

// 261022-ujp: '<' / '>' step a selected/hovered stroke one paint position in
// BOTH modules. The key branch precedes playback and consumes the key only
// with a concrete target; the watercolor path is one revision-authoritative
// edit, the brush path is a paint-order projection over an untouched ledger.
describe('261022-ujp stroke stack step', () => {
  it('retires the < and > shortcut while keeping Space on playback', () => {
    expect(studioKeyboard).not.toContain('stepSelectedStroke');
    expect(studioKeyboard).not.toContain("event.key === '<'");
    expect(studioKeyboard).toContain('actions.toggleRotoPlayback();');
  });

  it('no longer wires a Studio stack-step shortcut action', () => {
    // 261024-vga: the Stack section owns exact placement; the keyboard path
    // is gone from both the Studio action map and the shared helper.
    expect(studio).not.toContain('stepSelectedStroke:');
    expect(scriptStrokeEdition).not.toContain('stepSelectedScriptStroke');
    // The watercolor registration keeps its own mode + selection gate.
    expect(studio).toContain("isActive: () => activeModule.peek() === 'watercolor' && aquarelleSelectMode.peek(),");
    // Peek-only: the Studio render body never subscribes these signals.
    expect(studio).not.toContain('aquarelleSelectMode.value');
    expect(studio).not.toContain('aquarelleSelectedStrokeMutationId.value');
    expect(studio).not.toContain('scriptSelectMode.value');
    expect(studio).not.toContain('scriptSelectedStrokeId.value');
  });

  it('orders the watercolor handler: begin -> reset -> await apply -> record on success -> rollback', () => {
    const handlerStart = studio.indexOf('const handleAquarelleStepStroke = useCallback(');
    const handlerEnd = studio.indexOf('// 56-12 CACHE WRITE', handlerStart);
    expect(handlerStart).toBeGreaterThan(-1);
    const handler = studio.slice(handlerStart, handlerEnd);
    const beginSite = handler.indexOf('const editId = beginAquarelleReorderEdit(mutationId, direction);');
    const resetSite = handler.indexOf('aquarelleResetSheetRef.current?.();');
    const applySite = handler.indexOf('const ok = await rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame));');
    const successSite = handler.indexOf('if (ok) {');
    const recordSite = handler.indexOf('rotoMoveHistory.recordAquarelleScriptEdit(editId);');
    const rollbackSite = handler.indexOf("restoreAquarelleEditSnapshot(editId, 'undo')");
    expect(beginSite).toBeGreaterThan(-1);
    expect(resetSite).toBeGreaterThan(beginSite);
    expect(applySite).toBeGreaterThan(resetSite);
    expect(successSite).toBeGreaterThan(applySite);
    expect(recordSite).toBeGreaterThan(successSite);
    expect(rollbackSite).toBeGreaterThan(recordSite);
    // Shared gates, same order as delete/move; flag cleared even on throw.
    expect(handler).toContain('if (isPhysicalMutationLocked()) return;');
    expect(handler).toContain('if (rotoScript.applying.peek() || rotoScript.mutationLocked.peek()) return;');
    expect(handler).toContain("if (rotoTimelineModel.currentCell.peek().kind !== 'real') return;");
    expect(handler).toContain('if (isAquarelleScriptEditInFlight()) return;');
    expect(handler).toContain('} finally {');
    expect(handler).toContain('setAquarelleScriptEditInFlight(false);');
    expect(handler).not.toContain('engineRef');
    expect(handler).not.toContain('clipboard');
    expect(handler).not.toContain('applyCurrentScript');
  });

  it('swaps payload entries by index and never touches Dry, ticks, or the registry order', () => {
    const reorderStart = aquarelleRecordStateSource.indexOf('export function stepAquarelleStrokeInScript(');
    expect(reorderStart).toBeGreaterThan(-1);
    const reorder = aquarelleRecordStateSource.slice(
      reorderStart,
      aquarelleRecordStateSource.indexOf('export function deleteAquarelleStrokesFromScript', reorderStart),
    );
    // Index assignment, not a splice: every per-stroke field and the Map
    // insertion order (newest-last hit-testing) stay untouched. The entries are
    // REPLACED with recording-slot-swapped copies (snapshots hold references).
    expect(reorder).toContain('payloadTimeline[index] = partnerReplacement;');
    expect(reorder).toContain('payloadTimeline[partnerIndex] = movedReplacement;');
    expect(reorder).toContain('withRecordedSlot(entry, partnerSlot)');
    expect(reorder).toContain('withRecordedSlot(partnerEntry, movedSlot)');
    expect(reorder).toContain('isAquarelleDryEvent(event)');
    expect(reorder).not.toContain('.splice(');
    expect(reorder).not.toContain('setAquarelleStrokeDiffusionFrames');
    expect(reorder).not.toContain('deleteAquarelleStrokeFromScript');
  });

  it('projects paint order in the engine without reordering the acceptance ledger', () => {
    expect(paintEngineSource).toContain('private strokeStack: PaintStroke[] = []');
    const pushStart = paintEngineSource.indexOf('private pushAcceptedActions(');
    expect(pushStart).toBeGreaterThan(-1);
    const push = paintEngineSource.slice(pushStart, paintEngineSource.indexOf('private redrawAll()', pushStart));
    expect(push).toContain('this.allActions.push(...actions)');
    expect(push).toContain('stack.push(...actions)');
    // Both accepted-action sites funnel through the one helper.
    expect(paintEngineSource).toContain('this.pushAcceptedActions(actions)');
    expect(paintEngineSource).toContain('this.pushAcceptedActions([{');
    // Render, read, and serialize follow the projection.
    const redrawStart = paintEngineSource.indexOf('private redrawAll()');
    const redraw = paintEngineSource.slice(redrawStart, paintEngineSource.indexOf('private replayDiffusion(', redrawStart));
    expect(redraw).toContain('const ordered = this.liveActionsInPaintOrder()');
    expect(paintEngineSource).toContain('return this.liveActionsInPaintOrder().map(s => ({');
    expect(paintEngineSource).toContain('strokes: this.liveActionsInPaintOrder().map(s => ({');
    // clear resets it; load reseeds it from the loaded ledger.
    expect(paintEngineSource).toContain('this.strokeStack = []');
    expect(paintEngineSource).toContain('this.strokeStack = [...this.allActions]');
    // The step keeps the move-commit contract and never reorders allActions.
    expect(paintEngineSource).toContain('public getMoveTargetMutationId(): number | null');
    expect(paintEngineSource).toContain("return this.state.tool === 'move' ? this.moveHoverTargetId : null");
    expect(paintEngineSource).toContain('public sendStrokeForward(mutationId: number): boolean');
    const stepStart = paintEngineSource.indexOf('private stepStrokeInStack(');
    expect(stepStart).toBeGreaterThan(-1);
    const step = paintEngineSource.slice(stepStart, paintEngineSource.indexOf('private cursorGlyphMode(', stepStart));
    expect(step).toContain('this.flushPendingStrokeFinalizations()');
    expect(step.indexOf('this.redoStack = []')).toBeGreaterThan(-1);
    expect(step.indexOf('this.redoStack = []')).toBeLessThan(
      step.indexOf("this.notifyCompletedMutation('move', mutationId)"),
    );
    expect(step).not.toContain('this.allActions.push');
  });

  it('keeps the 261022-pim delete and 261022-tv1 move pins intact', () => {
    expect(studio).toContain('deleteSelectedAquarelleStroke: () => deleteSelectedScriptStroke(),');
    expect(studio).toContain('const handleAquarelleMoveStrokes = useCallback(');
    expect(studioKeyboard).toContain('deleteSelectedAquarelleStroke?: () => boolean;');
  });
});

// 261023-g4p Task 3: Brush Move parity — the engine by-id APIs, the brush
// port registration, the ONE tool-selection funnel and the mount wiring.
describe('261023-g4p brush Move script-edition surface', () => {
  it('exposes the by-id engine APIs and keeps the erase path on the same removal core', () => {
    expect(paintEngineSource).toContain('private removeStrokeEntry(mutationId: number): boolean {');
    expect(paintEngineSource).toContain('public deleteStroke(mutationId: number): boolean {');
    expect(paintEngineSource).toContain('public moveStroke(mutationId: number, dxPx: number, dyPx: number): boolean {');
    expect(paintEngineSource).toContain('public getStrokeSerials(): Map<number, number> {');
    expect(paintEngineSource).toContain('public setStrokeLabelsSuppressed(suppressed: boolean): void {');
    expect(paintEngineSource).toContain('public setCursorVisible(visible: boolean): void {');
    // deleteStrokes (the 261024-mz5 batch core): drain first, one 'erase',
    // zero removals leave state untouched; deleteStroke delegates to it.
    const deleteStart = paintEngineSource.indexOf('public deleteStrokes(mutationIds: readonly number[]): number {');
    const deleteBody = paintEngineSource.slice(deleteStart, paintEngineSource.indexOf('public moveStroke(', deleteStart));
    expect(deleteBody).toContain('this.flushPendingStrokeFinalizations()');
    expect(deleteBody.indexOf('this.flushPendingStrokeFinalizations()')).toBeLessThan(
      deleteBody.indexOf('if (this.removeStrokeEntry(mutationId)) removed.push(mutationId)'),
    );
    expect(deleteBody).toContain('if (removed.length === 0) return 0');
    expect(deleteBody).toContain("this.notifyCompletedMutation('erase', removed[0]!)");
    // moveStrokes (the 261024-mz5 batch core): the SAME commit contract as
    // the pointer drag — drain, map points, redo cleared, one 'move', one
    // replay — and moveStroke delegates to it.
    const moveStart = paintEngineSource.indexOf('public moveStrokes(');
    expect(moveStart).toBeGreaterThan(-1);
    const moveBody = paintEngineSource.slice(moveStart, paintEngineSource.indexOf('public getStrokeSerials()', moveStart));
    expect(moveBody).toContain('this.flushPendingStrokeFinalizations()');
    expect(moveBody).toContain('this.redoStack = []');
    expect(moveBody).toContain('this.redrawAfterScriptEdit()');
    expect(moveBody).toContain("this.notifyCompletedMutation('move', targets[0]!.mutationId)");
    expect(paintEngineSource).toContain('return this.moveStrokes([mutationId], dxPx, dyPx) > 0');
    // The erase gesture now funnels through removeStrokeEntry too.
    expect(paintEngineSource).toContain('if (this.removeStrokeEntry(mid)) removed++');
    // Suppression gates are the tool gate + an early return.
    expect(paintEngineSource).toContain('if (this.strokeLabelsSuppressed === true) return');
    expect(paintEngineSource).toContain('if (this.cursorVisible === false) return null');
    // redrawDisplayOverlays draws only when bounds survive (null drops the draw).
    expect(paintEngineSource).toContain('const cursorRect = this.overlayBoundsForCursor()');
  });

  it('registers BOTH module ports and configures the brush context from a render-body ref', () => {
    expect(studio).toContain('setScriptStrokeEditionPorts({');
    expect(studio).toContain('brush: brushScriptEditionPort,');
    expect(studio).toContain('configureBrushScriptEdition(brushScriptEditionDepsRef.current);');
    expect(studio).toContain('const brushScriptEditionDepsRef = useRef<BrushScriptEditionContext>({');
    expect(studio).toContain('getEngine: () => engineRef.current,');
    expect(studio).toContain('getPlayFrame: () => launchContextRef.current?.startFrame ?? 0,');
    expect(studio).toContain("isActive: () => activeModule.peek() === 'brush' && settings.tool === 'move',");
    expect(studio).toContain('isLocked: () => isPhysicalMutationLocked(),');
    // Studio teardown detaches the port from the dead session.
    expect(studio).toContain('configureBrushScriptEdition(null);');
    // The watercolor port keeps its exact previous contract.
    expect(studio).toContain("isActive: () => activeModule.peek() === 'watercolor' && aquarelleSelectMode.peek(),");
    expect(studio).toContain('deleteStrokes: (ids) => handleAquarelleDeleteStrokes(ids),');
    expect(studio).toContain('moveStrokes: (ids, dxPx, dyPx) => handleAquarelleMoveStrokes(ids, dxPx, dyPx),');
    expect(studio).toContain('stepStroke: (mutationId, direction) => handleAquarelleStepStroke(mutationId, direction),');
    // The brush port is the ONE adapter; the shared seam picks the active one.
    expect(brushScriptEditionPortSource).toContain('export const brushScriptEditionPort: ScriptStrokeEditionPort = {');
    expect(scriptStrokeEdition).toContain('if (watercolor?.isActive()) return watercolor;');
    expect(scriptStrokeEdition).toContain('if (brush?.isActive()) return brush;');
  });

  it('funnels every tool selection through the Move-arming wrapper', () => {
    expect(studio).toContain('selectTool: selectToolEngine,');
    expect(studio).toContain('const selectTool = useCallback((tool: ToolType, physicsMode?: \'local\' | null) => {');
    const wrapperStart = studio.indexOf('const selectTool = useCallback((tool: ToolType');
    const wrapperBody = studio.slice(wrapperStart, studio.indexOf('// 49-04 UAT fix', wrapperStart));
    // Refused selection = exact passthrough (no engine writes, no flag change).
    expect(wrapperBody).toContain('if (!activeEngine || isPhysicalMutationLocked()) {');
    expect(wrapperBody).toContain('selectToolEngine(tool, physicsMode);');
    // Move entry: flush the outgoing frame, arm the engine Move, stand down
    // the engine badges and cursor.
    expect(wrapperBody).toContain("if (activeModule.peek() === 'brush' && tool === 'move') {");
    expect(wrapperBody).toContain('flushBrushScriptFrame(');
    expect(wrapperBody).toContain('activeEngine.getStrokes(),');
    // 261023-j5b: the capture carries the visit's paint globals.
    expect(wrapperBody).toContain('activeEngine.getFramePaintSettings() ?? activeEngine.getPaintRenderSettings(),');
    expect(wrapperBody).toContain('activeEngine.setStrokeLabelsSuppressed(true);');
    expect(wrapperBody).toContain('activeEngine.setCursorVisible(false);');
    // Any other tool restores both.
    expect(wrapperBody).toContain('activeEngine.setStrokeLabelsSuppressed(false);');
    expect(wrapperBody).toContain('activeEngine.setCursorVisible(true);');
    // The rail and the Cmd tap both use the wrapper (existing pins above).
    expect(studio).toContain('onSelectTool: selectTool,');
    expect(studio).toContain('selectTool(lastNonMoveToolRef.current, settings.physicsMode);');
    expect(studio).toContain("selectTool('move', settings.physicsMode);");
    // The hook itself is untouched.
    expect(studio).toContain('usePhysicsPaintEngineActions({ engine, settings, setSettings, isMutationLocked: isPhysicalMutationLocked });');
  });

  it('re-applies the Move suppression for a recreated engine', () => {
    const readyStart = studio.indexOf('installScriptMemoryProbe(readyEngine');
    const readyBody = studio.slice(readyStart, studio.indexOf('installLookDeltaCapture', readyStart));
    expect(readyBody).toContain("if (activeModule.peek() === 'brush' && settingsRef.current.tool === 'move') {");
    expect(readyBody).toContain("readyEngine.setTool('move');");
    expect(readyBody).toContain('readyEngine.setStrokeLabelsSuppressed(true);');
    expect(readyBody).toContain('readyEngine.setCursorVisible(false);');
    expect(readyBody).toContain('flushBrushScriptFrame(');
    expect(readyBody).toContain('readyEngine.getStrokes(),');
    expect(readyBody).toContain('readyEngine.getFramePaintSettings() ?? readyEngine.getPaintRenderSettings(),');
    expect(readyBody.indexOf('settingsRef.current.tool')).toBeGreaterThan(-1);
  });

  it('mounts the brush overlay from the canvas mount only while Move is armed', () => {
    expect(canvasMount).toContain('brushScriptEditionActive?: boolean;');
    expect(canvasMount).toContain('getBrushScriptPlayFrame?: () => number;');
    expect(canvasMount).toContain('const getBrushScriptPlayFrameRef = useRef(props.getBrushScriptPlayFrame);');
    expect(canvasMount).toContain('getBrushScriptPlayFrameRef.current = props.getBrushScriptPlayFrame;');
    expect(canvasMount).toContain('{!aquarelleActive && (props.brushScriptEditionActive ?? false) ? (');
    expect(canvasMount).toContain('<BrushScriptOverlay');
    expect(canvasMount).toContain('getPlayFrame={() => getBrushScriptPlayFrameRef.current?.() ?? 0}');
    // The engine surface stays mounted underneath.
    expect(canvasMount.indexOf('<EfxPaintCanvas')).toBeLessThan(canvasMount.indexOf('<BrushScriptOverlay'));
    expect(studio).toContain('brushScriptEditionActive: settings.tool === \'move\',');
    expect(studio).toContain('getBrushScriptPlayFrame,');
    expect(studio).toContain('settings.tool, getBrushScriptPlayFrame, handleAquarelleStrokeEnd');
    // The adapter owns no gesture logic — it renders the ONE shared surface.
    expect(brushScriptOverlay).toContain('port={brushScriptEditionPort}');
    expect(brushScriptOverlay).toContain('selectMode={props.active}');
    expect(brushScriptOverlay).toContain('moveArmed={false}');
    expect(brushScriptOverlay).toContain('testId="brush-script-overlay"');
    expect(brushScriptOverlay).toContain('badgeTestId="brush-stroke-badge"');
    expect(brushScriptOverlay).toContain('ghostTestId="brush-drag-ghost"');
    expect(brushScriptOverlay).not.toContain('onPointerDown');
  });

  it('keeps the brush port peek-only and lock-gated', () => {
    expect(brushScriptEditionPortSource).toContain('void brushScriptRevision.value;');
    expect(brushScriptEditionPortSource).toContain('if (!resolved || resolved.context.isLocked()) return false;');
    expect(brushScriptEditionPortSource).toContain('if (!deleted) return false;');
    // 261023-j5b: every accepted edit flush carries the visit's paint
    // settings (captured snapshot first, live globals as the fallback).
    expect(brushScriptEditionPortSource).toContain('function resolvePaintSettings(engine: BrushScriptEditionEngine): PaintRenderSettings {');
    expect(brushScriptEditionPortSource).toContain('return engine.getFramePaintSettings() ?? engine.getPaintRenderSettings();');
    // 261024-mz5 Task 2: the transform batch is the fourth flush site.
    // 261024-p5q Task 1: the appearance batch is the fifth flush site.
    // 261024-vga: the exact-placement flush is the sixth flush site.
    expect(brushScriptEditionPortSource.match(/resolvePaintSettings\(resolved\.engine\),/g)).toHaveLength(6);
    expect(brushScriptEditionPortSource).toContain('flushBrushScriptFrame(');
    expect(brushScriptEditionPortSource).toContain('resolved.engine.getStrokes(),');
    // The Studio render body never subscribes the store revision. The ONE
    // allowed read is the snapshot coalescing effect (quick-261023-l35
    // Task 3), which lives inside a useEffect, never the render body.
    expect(studio.match(/brushScriptRevision\.value/g)).toHaveLength(1);
    const coalescingEffectStart = studio.indexOf('// quick-261023-l35 Task 3: ONE coalescing subscription');
    expect(coalescingEffectStart).toBeGreaterThan(-1);
    expect(studio.indexOf('brushScriptRevision.value')).toBeGreaterThan(coalescingEffectStart);
  });
});

// 261024-mz5 Task 1: the Studio selection is a SET. The shared overlay owns
// the modifier law (Cmd/Ctrl toggles, Shift adds, plain replaces, empty clears),
// captures the id array at pointerdown, and hands the WHOLE array to the batch
// callbacks. The Studio registers batch port ops and still never subscribes the
// edition signals in its render body.
describe('261024-mz5 Studio multi-select surface', () => {
  it('registers batch delete/move port ops', () => {
    expect(studio).toContain('deleteStrokes: (ids) => handleAquarelleDeleteStrokes(ids),');
    expect(studio).toContain('moveStrokes: (ids, dxPx, dyPx) => handleAquarelleMoveStrokes(ids, dxPx, dyPx),');
    expect(studio).toContain('const handleAquarelleDeleteStrokes = useCallback((ids: readonly number[]) => {');
    // 261024-p5q: the move handler is now async and returns whether the
    // re-bake succeeded, so the Stroke Settings dialog commits geometry only
    // on a true result.
    expect(studio).toContain('const handleAquarelleMoveStrokes = useCallback(async (');
    expect(studio).toContain('): Promise<boolean> => {');
    // Frame filter before any mutation.
    expect(studio).toContain('aquarelleStrokesOnFrame(ids, launchContextRef.current?.startFrame ?? 0)');
    // The shared consume law passes the whole set.
    expect(scriptStrokeEdition).toContain('port.deleteStrokes(ids);');
    expect(scriptStrokeEdition).toContain('const ids = [...scriptSelectedStrokeIds.peek()];');
  });

  it('keeps the edition signals out of the Studio render body', () => {
    expect(studio).not.toContain('scriptSelectedStrokeIds.value');
    expect(studio).not.toContain('scriptSelectedStrokeId.value');
    expect(studio).not.toContain('scriptStrokeDrag');
    expect(studio).not.toContain('scriptStrokeTransform');
  });

  it('the shared overlay owns the modifier selection law and the batch hand-off', () => {
    expect(scriptStrokeOverlay).toContain('event.metaKey');
    expect(scriptStrokeOverlay).toContain('event.ctrlKey');
    expect(scriptStrokeOverlay).toContain('event.shiftKey');
    expect(scriptStrokeOverlay).toContain('toggleScriptStrokeSelection(');
    // The id array is captured at pointerdown — a later selection change must
    // not retarget an in-flight gesture.
    expect(scriptStrokeOverlay).toContain('mutationIds: ids');
    expect(scriptStrokeOverlay).toContain('props.onMoveStrokes(');
    expect(scriptStrokeOverlay).toContain('props.onDeleteStrokes(');
    // Cancel clears the ghost and commits nothing.
    expect(scriptStrokeOverlay).toContain('clearScriptStrokeDrag();');
    expect(scriptStrokeOverlay).not.toContain('useEffect');
    expect(scriptStrokeOverlay).not.toContain('useSignal');
  });
});

// 261024-mz5 Task 2: transform handles. The overlay renders the union box and
// the nine handles ONLY when the adapter supplies a commit callback; a handle
// hit wins over a stroke hit; pointermove writes only the preview signal and
// pointerup commits through the adapter. The watercolor adapter stays
// un-wired until Task 3 can commit the re-bake.
describe('261024-mz5 Studio transform handles surface', () => {
  it('renders the union box and the nine handles only behind an adapter callback', () => {
    expect(scriptStrokeOverlay).toContain(
      'onTransformStrokes?: (mutationIds: readonly number[], transform: ScriptStrokeTransform) => void;',
    );
    expect(scriptStrokeOverlay).toContain('data-testid="stroke-transform-box"');
    expect(scriptStrokeOverlay).toContain('data-testid="stroke-transform-handle-rotate"');
    expect(scriptStrokeOverlay).toContain('data-testid={`stroke-transform-handle-scale-${handle.id}`}');
    // The preview keeps the surface mounted mid-gesture.
    expect(scriptStrokeOverlay).toContain(
      'if (!selectMode && !moveArmed && drag === null && transformPreview === null) return null;',
    );
    // Handles are gated on the adapter callback: an adapter that cannot
    // commit never shows them. Both adapters supply it after 261024-mz5 Task 3.
    expect(scriptStrokeOverlay).toContain('selectionBox !== null && props.onTransformStrokes !== undefined');
    expect(aquarelleStrokeOverlay).toContain('onTransformStrokes={props.onTransformStrokes}');
  });

  it('hit-tests the handle BEFORE the stroke and previews without mutating', () => {
    const handleSite = scriptStrokeOverlay.indexOf('hitTestScriptStrokeTransformHandle(point, selectionBox)');
    const strokeSite = scriptStrokeOverlay.indexOf('props.port.hitTestStroke(point, playFrame, size)');
    expect(handleSite).toBeGreaterThan(-1);
    expect(strokeSite).toBeGreaterThan(handleSite);

    expect(scriptStrokeOverlay).toContain('buildScriptStrokeTransform(');
    expect(scriptStrokeOverlay).toContain('setScriptStrokeTransform({ ids: gesture.mutationIds, ...transform });');
    // Release clears the preview and commits; cancel clears and commits nothing.
    expect(scriptStrokeOverlay).toContain('clearScriptStrokeTransform();');
    expect(scriptStrokeOverlay).toContain('props.onTransformStrokes?.(gesture.mutationIds, transform);');
    expect(scriptStrokeOverlay).toContain('isIdentityScriptStrokeTransform(transform)');
    expect(scriptStrokeOverlay).not.toContain('useEffect');
    expect(scriptStrokeOverlay).not.toContain('useSignal');
  });

  it('points at a hittable stroke on hover and keeps handle cursors first (261025-d3r revision)', () => {
    expect(scriptStrokeOverlay).toContain(
      'const clickable = props.port.hitTestStroke(point, playFrame, size) !== null;',
    );
    expect(scriptStrokeOverlay).toContain(
      "(event.currentTarget as HTMLElement).style.cursor = clickable ? 'pointer' : 'default';",
    );
    const handleCursorSite = scriptStrokeOverlay.indexOf(
      '(event.currentTarget as HTMLElement).style.cursor = cursorForHandle(hovered.id);',
    );
    const strokeCursorSite = scriptStrokeOverlay.indexOf(
      'const clickable = props.port.hitTestStroke(point, playFrame, size) !== null;',
    );
    expect(handleCursorSite).toBeGreaterThan(-1);
    expect(strokeCursorSite).toBeGreaterThan(handleCursorSite);
  });

  it('wires the brush adapter, the port and the engine transform core', () => {
    expect(brushScriptOverlay).toContain('onTransformStrokes={(mutationIds, transform) =>');
    expect(brushScriptOverlay).toContain('brushScriptEditionPort.transformStrokes(mutationIds, transform)');

    expect(brushScriptEditionPortSource).toContain('export function transformBrushScriptStrokes(');
    expect(brushScriptEditionPortSource).toContain('resolved.engine.transformStrokes(mutationIds, transform)');
    expect(brushScriptEditionPortSource).toContain('transformStrokes: (mutationIds, transform) => {');
    expect(brushScriptEditionPortSource).toContain('transformStrokes(mutationIds: readonly number[], transform: ScriptStrokeTransform): number;');
    // The shared seam exposes the preview signal as compare-then-write.
    expect(scriptStrokeEdition).toContain('export function setScriptStrokeTransform(');
    expect(scriptStrokeEdition).toContain('export function clearScriptStrokeTransform(): void {');

    const transformStart = paintEngineSource.indexOf('public transformStrokes(');
    expect(transformStart).toBeGreaterThan(-1);
    const transformBody = paintEngineSource.slice(
      transformStart,
      paintEngineSource.indexOf('public getStrokeSerials()', transformStart),
    );
    expect(transformBody).toContain('this.flushPendingStrokeFinalizations()');
    expect(transformBody).toContain('const cos = Math.cos(transform.angleRad)');
    expect(transformBody).toContain('const sin = Math.sin(transform.angleRad)');
    expect(transformBody).toContain('const scaledX = transform.anchorX + (p.x - transform.anchorX) * transform.scaleX');
    expect(transformBody).toContain('const scaledY = transform.anchorY + (p.y - transform.anchorY) * transform.scaleY');
    expect(transformBody).toContain('const dx = scaledX - transform.centerX');
    expect(transformBody).toContain('const dy = scaledY - transform.centerY');
    expect(transformBody).toContain('x: transform.centerX + dx * cos - dy * sin,');
    expect(transformBody).toContain('y: transform.centerY + dx * sin + dy * cos,');
    // The Move law: redo dies, one 'move', one replay, no checkpoint.
    expect(transformBody).toContain('this.redoStack = []');
    expect(transformBody).toContain('this.redrawAfterScriptEdit()');
    expect(transformBody).toContain("this.notifyCompletedMutation('move', targets[0]!.mutationId)");
    expect(transformBody).toContain('this.updateMoveHover()');
    // Identity and non-finite transforms return before any mutation.
    expect(transformBody).toContain('Math.abs(transform.angleRad) < 1e-6');
    expect(transformBody).toContain('Math.abs(transform.scaleX - 1) < 0.01');
    expect(transformBody).toContain('Math.abs(transform.scaleY - 1) < 0.01');
    expect(transformBody).not.toContain('params =');
    expect(transformBody).not.toContain('params:');
  });

  it('keeps the transform signals out of the Studio render body', () => {
    expect(studio).not.toContain('scriptStrokeTransform');
    expect(studio).not.toContain('scriptStrokeTransform.value');
  });
});

// 261023-h9v Task 1: navigation rehydration — the completeness law, the
// silent baseline restore, and the completion-listener fix. Navigation is
// the ONE place a retained script may re-enter the engine.
describe('261023-h9v brush script rehydration surface', () => {
  const navigationStart = studio.indexOf('const navigateToSyncedPhysicalFrame = useCallback(async (frame: number) => {');
  const navigationBody = studio.slice(
    navigationStart,
    studio.indexOf('const lastReferenceDisplayStateRef', navigationStart),
  );
  const listenerStart = studio.indexOf('canvasCompletedMutationImplRef.current = (mutation, mutationEngine) => {');
  const listenerBody = studio.slice(
    listenerStart,
    studio.indexOf('rotoMoveHistory.observePaintMutation', listenerStart),
  );
  const clearSourceStart = studio.indexOf('const clearActiveSource = useCallback(');
  const clearSourceBody = studio.slice(
    clearSourceStart,
    studio.indexOf('const navigateToSyncedPhysicalFrame', clearSourceStart),
  );

  it('decides attach-or-cached-pixels once per navigation, pixels BEFORE the ledger', () => {
    expect(navigationStart).toBeGreaterThan(-1);
    expect(navigationBody).toContain('engine.clear();');
    expect(navigationBody).toContain('const hydrationRequest: BrushHydrationRequest = {');
    expect(navigationBody).toContain('frame,');
    expect(navigationBody).toContain('destinationKind,');
    expect(navigationBody).toContain("brushModuleActive: activeModule.peek() !== 'watercolor',");
    expect(navigationBody).toContain('wasPlaying: wasPlaying || rotoCachedPlayback.isActive,');
    expect(navigationBody).toContain('scrubActive: scrubActiveRef.current,');
    expect(navigationBody).toContain('const hydrationPlan = planBrushScriptHydration(hydrationRequest);');
    // Refusal = the observed cached-pixel path (which records the arrival base).
    expect(navigationBody).toContain('loadReferenceObserved(frame, engine as PreviewBackgroundEngine);');
    // Pixels FIRST, ledger SECOND — the loader's internal engine.clear() must
    // run before the attach or the attached ledger would be wiped.
    expect(navigationBody.indexOf('engine.clear();')).toBeLessThan(
      navigationBody.indexOf('loadCachedRotoReferenceFrame(frame, engine as PreviewBackgroundEngine)'),
    );
    expect(navigationBody.indexOf('loadCachedRotoReferenceFrame(frame, engine as PreviewBackgroundEngine)')).toBeLessThan(
      navigationBody.indexOf('hydrateBrushScriptFrame(engine, hydrationRequest)'),
    );
    // Attach success records NO arrival base (the entry must stay complete);
    // the arrival note exists only on the attach-refusal path.
    const refusalIndex = navigationBody.indexOf('noteBrushScriptArrivalBase(frame, loaded || findCachedRotoDisplayFrame(frame) !== null);');
    expect(refusalIndex).toBeGreaterThan(
      navigationBody.indexOf('hydrateBrushScriptFrame(engine, hydrationRequest)'),
    );
    expect(navigationBody).toContain('if (!loaded) {');
    // 261023-j5b: the no-cache fallback repaints faithfully with the entry's
    // captured paint globals.
    expect(navigationBody).toContain('engine.restoreStrokesBaseline(');
    expect(navigationBody).toContain('hydrationPlan.entry.groups,');
    expect(navigationBody).toContain('hydrationPlan.entry.paintSettings ?? null,');
    // The post-flush generated repaint stays a cached-pixel path.
    expect(navigationBody).toContain("?.cells[frame]?.kind === 'generated'");
  });

  it('wraps the hydration attempt and the observed loader as stable callbacks', () => {
    const observedStart = studio.indexOf('const loadReferenceObserved = useCallback(');
    expect(observedStart).toBeGreaterThan(-1);
    const observedBody = studio.slice(observedStart, studio.indexOf('const hydrateBrushScriptFrame', observedStart));
    expect(observedBody).toContain('const loaded = loadCachedRotoReferenceFrame(frame, targetEngine);');
    expect(observedBody).toContain('noteBrushScriptArrivalBase(frame, loaded || findCachedRotoDisplayFrame(frame) !== null);');
    expect(observedBody).toContain('[findCachedRotoDisplayFrame, loadCachedRotoReferenceFrame],');

    const hydrateStart = studio.indexOf('const hydrateBrushScriptFrame = useCallback(');
    const hydrateBody = studio.slice(hydrateStart, studio.indexOf('const clearActiveSource', hydrateStart));
    expect(hydrateBody).toContain('attemptBrushScriptHydration(targetEngine, request),');
    expect(hydrateBody).toContain('useCallback(');
  });

  it('routes every completion through the ONE completion law and never drops on clear', () => {
    const brushCompletion = listenerBody.slice(listenerBody.indexOf("if (activeModule.peek() !== 'watercolor') {"));
    expect(brushCompletion).toContain('applyCompletedBrushMutation(kind, scriptFrame, mutationEngine);');
    // engine.clear() notifies 'clear' on every navigation — the listener must
    // never delete the entry the navigation flush just recorded.
    expect(brushCompletion).not.toContain('deleteBrushScriptFrame');
    expect(brushCompletion).not.toContain('markBrushScriptFrameDirty');
    expect(brushCompletion).not.toContain("kind === 'clear'");
  });

  it('drops the retained script on an explicit user clear only', () => {
    expect(clearSourceStart).toBeGreaterThan(-1);
    expect(clearSourceBody).toContain('if (rotoFrameEditingRef.current.clearCurrentFrame()) {');
    expect(clearSourceBody).toContain("if (activeModule.peek() === 'brush') clearBrushScriptFrame(currentFrame);");
    expect(clearSourceBody.indexOf('clearCurrentFrame()')).toBeLessThan(
      clearSourceBody.indexOf('clearBrushScriptFrame('),
    );
  });

  it('imports the rehydration seam and retires the raw completion writes', () => {
    expect(studio).toContain("} from './view/brushScriptHydration';");
    expect(studio).toContain('applyCompletedBrushMutation,');
    expect(studio).toContain('attemptBrushScriptHydration,');
    expect(studio).toContain('engineHoldsBrushScriptFrame,');
    expect(studio).toContain('clearBrushScriptFrame,');
    expect(studio).toContain('noteBrushScriptArrivalBase,');
    expect(studio).not.toContain('deleteBrushScriptFrame');
  });

  // 261023-h9v Task 2: arrival seams, clobber guards, undo/redo freshness.
  it('wires the frame-editing loader through the live-handle guard', () => {
    expect(studio).toContain('loadReferenceFrame: loadReferenceForFrameEditing,');
    const helperStart = studio.indexOf('const loadReferenceForFrameEditing = useCallback(');
    expect(helperStart).toBeGreaterThan(-1);
    const helperBody = studio.slice(helperStart, studio.indexOf('const hydrateBrushScriptFrame', helperStart));
    expect(helperBody).toContain('if (engineHoldsBrushScriptFrame(targetEngine, frame)) return true;');
    expect(helperBody).toContain('return loadReferenceObserved(frame, targetEngine);');
    expect(helperBody.indexOf('engineHoldsBrushScriptFrame')).toBeLessThan(
      helperBody.indexOf('return loadReferenceObserved'),
    );
  });

  it('uses the observed loader at every arrival seam that can be painted', () => {
    // Navigation refusal branch (Task 1) and display-port real-key loads.
    expect(navigationBody).toContain('loadReferenceObserved(frame, engine as PreviewBackgroundEngine);');
    // Display-state effect reload.
    const effectStart = studio.indexOf('const lastReferenceDisplayStateRef = useRef<string | null>(null);');
    const effectBody = studio.slice(effectStart, studio.indexOf('rotoNavigation.configureRuntimePort', effectStart));
    expect(effectBody).toContain('loadReferenceObserved(currentFrame, engine);');
    // Display-port real-key / blank-real-key restore.
    const portStart = studio.indexOf('rotoNavigation.configureDisplayPort({');
    const portBody = studio.slice(portStart, studio.indexOf('const rotoMoveHistory = useRotoPhysicalEditHistory', portStart));
    expect(portBody).toContain('loadReferenceObserved(frame, engine as PreviewBackgroundEngine);');
    // Engine-ready loader.
    expect(studio).toContain("if (workflowMode === 'roto') loadReferenceObserved(currentFrame, readyEngine as PreviewBackgroundEngine);");
  });

  it('guards the engine-ready flush against an empty fresh engine', () => {
    const readyStart = studio.indexOf('installScriptMemoryProbe(readyEngine');
    const readyBody = studio.slice(readyStart, studio.indexOf('installLookDeltaCapture', readyStart));
    expect(readyBody).toContain('if (readyEngine.getStrokes().length > 0) {');
    expect(readyBody.indexOf('if (readyEngine.getStrokes().length > 0) {')).toBeLessThan(
      readyBody.indexOf('flushBrushScriptFrame('),
    );
  });

  it('drops the brush store on an in-place track switch', () => {
    const effectStart = studio.indexOf('const lastReferenceDisplayStateRef = useRef<string | null>(null);');
    const effectBody = studio.slice(effectStart, studio.indexOf('rotoNavigation.configureRuntimePort', effectStart));
    expect(effectBody).toContain('if (hadPreviousTrack) {');
    expect(effectBody).toContain('resetBrushScriptStore();');
    expect(effectBody.indexOf('if (hadPreviousTrack) {')).toBeLessThan(
      effectBody.indexOf('resetBrushScriptStore();'),
    );
  });

  it('clears the retained script when the display port clears the canvas', () => {
    const portStart = studio.indexOf('rotoNavigation.configureDisplayPort({');
    const portBody = studio.slice(portStart, studio.indexOf('const rotoMoveHistory = useRotoPhysicalEditHistory', portStart));
    const clearStart = portBody.indexOf('clearCanvas: (frame) => {');
    expect(clearStart).toBeGreaterThan(-1);
    const clearBody = portBody.slice(clearStart, portBody.indexOf('navigate:', clearStart));
    expect(clearBody).toContain('engine.clear();');
    expect(clearBody).toContain('clearBrushScriptFrame(frame);');
    expect(clearBody.indexOf('engine.clear();')).toBeLessThan(
      clearBody.indexOf('clearBrushScriptFrame(frame);'),
    );
  });

  it('refreshes the retained script after a successful controller undo/redo', () => {
    const refreshStart = studio.indexOf('const refreshBrushScriptAfterHistory = useCallback(');
    expect(refreshStart).toBeGreaterThan(-1);
    const refreshBody = studio.slice(refreshStart, studio.indexOf('const rotoFrameEditing', refreshStart));
    expect(refreshBody).toContain('applyCompletedBrushMutation(kind, launchContextRef.current?.startFrame ?? 0, engineRef.current);');

    const wiringStart = studio.indexOf('undoPaint: () => {');
    const wiringBody = studio.slice(wiringStart, studio.indexOf('const rotoMoveHistoryUndo', wiringStart));
    expect(wiringBody).toContain("if (undone) refreshBrushScriptAfterHistory('undo');");
    expect(wiringBody).toContain("if (redone) refreshBrushScriptAfterHistory('redo');");
  });
});

// 261023-j5b Task 2: the frame's paint globals must travel with every
// script capture so the first faithful rebake replays the painted look.
describe('261023-j5b paint-settings carrier seams', () => {
  it('the frame-leave capture carries the visit paint settings', () => {
    const navigationStart = studio.indexOf('const navigateToSyncedPhysicalFrame = useCallback(async (frame: number) => {');
    const navigationBody = studio.slice(
      navigationStart,
      studio.indexOf('const lastReferenceDisplayStateRef', navigationStart),
    );
    expect(navigationBody).toContain('engine ? engine.getFramePaintSettings() ?? engine.getPaintRenderSettings() : null,');
  });

  it('the shared gauge assembler flush carries the engine paint settings', () => {
    // quick-261023-ors: the flush moved into readStudioScriptMemorySnapshot;
    // the DEV probe delegates to it, so the carrier law lives in the gauge.
    expect(studioScriptMemoryGaugeSource).toContain(
      'engine.getFramePaintSettings() ?? engine.getPaintRenderSettings()',
    );
    expect(scriptMemoryProbeSource).toContain('readStudioScriptMemorySnapshot({');
    expect(scriptMemoryProbeSource).not.toContain('getFramePaintSettings');
  });

  it('the store entry carries the STICKY paintSettings snapshot', () => {
    expect(brushScriptRecordStateSource).toContain('readonly paintSettings?: PaintRenderSettings | null;');
    expect(brushScriptRecordStateSource).toContain(
      'paintSettings: previous?.paintSettings ?? paintSettings ?? null,',
    );
  });

  it('the engine exposes the faithful rebake and the single edit seam', () => {
    expect(studio).toContain('hydrateBrushScriptFrame(engine, hydrationRequest)');
    expect(paintEngineSource).toContain('public rebakeStrokesFaithfully(settings?: PaintRenderSettings | null): number');
    // 261023-j5b follow-up: the base clear is complete-ledger driven, not
    // detached-visit driven (a Duplicate-derived live visit must clear too).
    expect(paintEngineSource).toContain('if (this.scriptBaseClearPending === true && this.cachedBaseClearedThisVisit !== true) {');
    expect(paintEngineSource).toContain('this.clearPreviewBaseImage(true)');
    expect(paintEngineSource).toContain('public setScriptBaseClearPending(pending: boolean): void');
    expect(paintEngineSource).toContain('this.redrawAfterScriptEdit()');
  });

  it('a cleared-base capture encodes the live canvas alone, never the cached base', () => {
    expect(paintEngineSource).toContain('public isLiveCanvasWholeFrame(): boolean');
    expect(studio).toContain('const liveCanvasWholeFrame = mutationEngine.isLiveCanvasWholeFrame();');
    expect(studio).toContain('const cachedBase = liveCanvasWholeFrame');
    expect(studio).toContain('baseCanvas: liveCanvasWholeFrame');
  });

  it('an applied or duplicated script is captured for Move at apply settle', () => {
    expect(brushScriptRecordStateSource).toContain('export function adoptBrushScriptFrameAsComplete(');
    // The generic Apply entry points refresh the store as soon as they settle.
    expect(studio).toContain('const flushBrushScriptAfterApply = useCallback(() => {');
    expect(studio).toContain('flushBrushScriptAfterApply();');
    // Duplicate adopts the blank-born destination as COMPLETE.
    expect(studio).toContain('adoptBrushScriptFrameAsComplete(');
    expect(studio).toContain('rotoScript.source.peek().appFrame,');
  });
});

// quick-261023-l35: the Studio script snapshot — restore before the surface is
// published, a bounded save on close, and the engine clock reservation.
describe('261023-l35 studio script snapshot seams', () => {
  it('restores the script BEFORE the launch context is applied', () => {
    const restoreIndex = launchIntegration.indexOf('await input.restoreStudioScriptSnapshot?.(');
    const applyIndex = launchIntegration.indexOf('applyPhysicsPaintLaunchContext(settledContext');
    expect(restoreIndex).toBeGreaterThan(-1);
    expect(applyIndex).toBeGreaterThan(restoreIndex);
    // The restore receives the SETTLED context (the durable projectId lands at
    // settle) and its carried document (the active-track authority).
    expect(launchIntegration).toContain('restoreStudioScriptSnapshot?.(settledContext, settledContext.document)');
  });

  it('supplies a restoring callback keyed on the durable project identity', () => {
    expect(studio).toContain('restoreStudioScriptSnapshot: async (context, document) => {');
    expect(studio).toContain('const projectId = context.project?.projectId ?? \'\';');
    expect(studio).toContain('const trackId = typeof carriedTrackId === \'string\' ? carriedTrackId : \'\';');
    expect(studio).toContain('studioScriptSnapshot.bind(identity);');
    expect(studio).toContain('engineRef.current?.reserveMutationClock(nextMutationId);');
  });

  it('re-applies the reserved mutation clock at the engine-ready seam', () => {
    expect(studio).toContain('const reservedMutationId = studioScriptSnapshotReservedNextMutationIdRef.current;');
    expect(studio).toContain('readyEngine.reserveMutationClock(reservedMutationId);');
  });

  it('bounds the close-path save and keeps a dirty script pending', () => {
    expect(studio).toContain('() => workflowMode === \'roto\' || studioScriptSnapshot.isDirty(),');
    expect(studio).toContain('const STUDIO_SCRIPT_SNAPSHOT_CLOSE_BUDGET_MS = 2000;');
    expect(studio).toContain('studioScriptSnapshot.flushNow(),');
    expect(studio).toContain('window.setTimeout(resolve, STUDIO_SCRIPT_SNAPSHOT_CLOSE_BUDGET_MS);');
  });

  it('drops the binding on Studio disposal', () => {
    expect(studio).toContain('studioScriptSnapshot.reset();');
  });

  it('carries the durable projectId on the launch project context', () => {
    expect(types).toContain('projectId?: string;');
    expect(bridge).toContain('projectId: projectStore.projectId.peek()');
  });
});

// quick-261023-l35 Task 2: brush frames in the same snapshot.
describe('261023-l35 brush frames in the Studio script snapshot', () => {
  it('feeds the per-frame brush ledger to the controller', () => {
    expect(studio).toContain('getBrushFrames: () => getBrushScriptFrameEntries(),');
    expect(studio).toContain('${aquarelleStrokesRevision.peek()}:${brushScriptRevision.peek()}');
  });

  it('captures the current brush frame before the snapshot save on close', () => {
    const closeStart = studio.indexOf('usePhysicsPaintCloseFlush(');
    const closeBody = studio.slice(closeStart, studio.indexOf('// 41-05 (D-08): release the audio engine on Studio unmount', closeStart));
    const captureIndex = closeBody.indexOf('flushBrushScriptFrame(');
    const saveIndex = closeBody.indexOf('studioScriptSnapshot.flushNow(),');
    expect(captureIndex).toBeGreaterThan(-1);
    expect(saveIndex).toBeGreaterThan(captureIndex);
    // Watercolor mode has its own capture step; the brush capture is gated out.
    expect(closeBody).toContain("if (activeModule.peek() === 'watercolor') return;");
    expect(closeBody).toContain('engineRef.current?.getFramePaintSettings() ?? engineRef.current?.getPaintRenderSettings()');
  });
});

// quick-261023-l35 Task 3: save discipline — the coalescing subscription, the
// cross-track handoff, and the disposal path.
describe('261023-l35 save discipline in the Studio', () => {
  it('subscribes to BOTH store revisions with a first-run skip', () => {
    const effectStart = studio.indexOf('// quick-261023-l35 Task 3: ONE coalescing subscription');
    const effectBody = studio.slice(effectStart, studio.indexOf('}, [studioScriptSnapshot]);', effectStart));
    expect(effectStart).toBeGreaterThan(-1);
    expect(effectBody).toContain('aquarelleStrokesRevision.value;');
    expect(effectBody).toContain('brushScriptRevision.value;');
    expect(effectBody).toContain('let seedRun = true;');
    expect(effectBody).toContain('studioScriptSnapshot.markDirty();');
    expect(effectBody).toContain('studioScriptSnapshot.dispose();');
  });

  it('saves the outgoing key, resets both stores, then binds and restores', () => {
    const switchStart = studio.indexOf('if (lastEditStateTrackIdRef.current !== trackId) {');
    const switchBody = studio.slice(switchStart, studio.indexOf('const engine = engineRef.current as PreviewBackgroundEngine | null;', switchStart));
    const flushCapture = switchBody.indexOf('aquarelleFlushCaptureRef.current?.();');
    const brushCapture = switchBody.indexOf('flushBrushScriptFrame(');
    const saveOutgoing = switchBody.indexOf('void studioScriptSnapshot.saveNow();');
    const resetBrush = switchBody.indexOf('resetBrushScriptStore();');
    const resetWatercolor = switchBody.indexOf('resetAquarelleRecordState();');
    const bindIncoming = switchBody.indexOf('studioScriptSnapshot.bind(incomingIdentity);');
    const restoreIncoming = switchBody.indexOf('void studioScriptSnapshot.restore()');
    expect(flushCapture).toBeGreaterThan(-1);
    expect(brushCapture).toBeGreaterThan(flushCapture);
    expect(saveOutgoing).toBeGreaterThan(brushCapture);
    expect(resetBrush).toBeGreaterThan(saveOutgoing);
    expect(resetWatercolor).toBeGreaterThan(resetBrush);
    expect(bindIncoming).toBeGreaterThan(resetWatercolor);
    expect(restoreIncoming).toBeGreaterThan(bindIncoming);
    // Restore is dispatched, never awaited inside the synchronous effect.
    expect(switchBody).not.toContain('await studioScriptSnapshot.restore()');
    // The incoming restore reserves the engine clock past restored ids.
    expect(switchBody).toContain('engineRef.current?.reserveMutationClock(nextMutationId);');
  });
});

// quick-261023-o3n: the Studio carries the LIVE package authority. It is a
// plain ref (no signal, no state) set from the incoming settled context before
// the launch restore, and refreshed by every project-context republish so a
// Save As while the Studio is open is followed on the next write.
describe('261023-o3n live package authority in the Studio', () => {
  it('holds the authority in a plain ref and reads it live from the controller deps', () => {
    expect(studio).toContain('const studioScriptSnapshotAuthorityRef = useRef<string | null>(null);');
    expect(studio).toContain('getAuthority: () => studioScriptSnapshotAuthorityRef.current,');
    expect(studio).toContain('bytes,\n        authority,');
    expect(studio).toContain('identity.trackId,\n        authority,');
  });

  it('sets the authority from the INCOMING settled context before the identity guard and the restore', () => {
    const restoreStart = studio.indexOf('restoreStudioScriptSnapshot: async (context, document) => {');
    const authorityIndex = studio.indexOf(
      'studioScriptSnapshotAuthorityRef.current = context.project?.scriptLibraryAuthority ?? null;',
      restoreStart,
    );
    const guardIndex = studio.indexOf("const projectId = context.project?.projectId ?? '';", restoreStart);
    const restoreIndex = studio.indexOf('studioScriptSnapshot.restore()', restoreStart);
    expect(restoreStart).toBeGreaterThan(-1);
    // The launchContextRef still holds the PREVIOUS context at this moment, so
    // the authority must come from the incoming argument, before the guard.
    expect(authorityIndex).toBeGreaterThan(restoreStart);
    expect(guardIndex).toBeGreaterThan(authorityIndex);
    expect(restoreIndex).toBeGreaterThan(authorityIndex);
  });

  it('refreshes the authority from every settled project-context republish (save-as rebind)', () => {
    const settledStart = studio.indexOf('onSettledLaunchContext: (context) => {');
    const authorityIndex = studio.indexOf(
      'studioScriptSnapshotAuthorityRef.current = context.project?.scriptLibraryAuthority ?? null;',
      settledStart,
    );
    const updateIndex = studio.indexOf('rotoScriptLibrary.updateProjectContext(context)', settledStart);
    expect(settledStart).toBeGreaterThan(-1);
    expect(authorityIndex).toBeGreaterThan(settledStart);
    expect(updateIndex).toBeGreaterThan(authorityIndex);
  });
});

// quick-261023-ors Task 3: a committed rail delete cascades to that rail's
// snapshot on BOTH legs. The hook is registered ONCE (identity-stable deps) and
// the binding is invalidated synchronously BEFORE the delete is dispatched.
describe('261023-ors rail-delete snapshot cascade in the Studio', () => {
  it('registers the store hook once and unregisters it on teardown', () => {
    expect(studio).toContain(
      "import { createStudioScriptSnapshotTrackDelete } from './snapshot/studioScriptSnapshotTrackDelete';",
    );
    expect(studio).toContain('_setEfxPaintTrackScriptDeleteCallback(cascade);');
    expect(studio).toContain('return () => _setEfxPaintTrackScriptDeleteCallback(null);');
  });

  it('reads the live identity, authority and capsule ports through refs', () => {
    const start = studio.indexOf('const cascade = createStudioScriptSnapshotTrackDelete({');
    const body = studio.slice(start, studio.indexOf('}, [studioScriptSnapshot]);', start));
    expect(start).toBeGreaterThan(-1);
    expect(body).toContain('getIdentity: () => studioScriptSnapshotIdentityRef.current,');
    expect(body).toContain('getAuthority: () => studioScriptSnapshotAuthorityRef.current,');
    expect(body).toContain('ipcStudioScriptSnapshotDelete(');
    expect(body).toContain("setApplyStatus('error');");
    expect(body).toContain('setApplyMessage(message);');
    expect(body).toContain('setLastError(message);');
  });

  it('clears the identity ref and the controller binding before the factory dispatches', () => {
    const start = studio.indexOf('clearBinding: () => {');
    const body = studio.slice(start, studio.indexOf('remove: (identity, authority, scope)', start));
    const nullIndex = body.indexOf('studioScriptSnapshotIdentityRef.current = null;');
    const bindIndex = body.indexOf('studioScriptSnapshot.bind(null);');
    expect(start).toBeGreaterThan(-1);
    expect(nullIndex).toBeGreaterThan(-1);
    // bind() bumps the generation and clears the debounce SYNCHRONOUSLY, so an
    // in-flight restore and a prepared save are both invalidated first.
    expect(bindIndex).toBeGreaterThan(nullIndex);
  });
});

// quick-261024-m20: every accepted physical replace remaps BOTH session stores
// (brush ledger + watercolor record state) by key identity AFTER the store
// commit; a failed replace calls neither.
describe('261024-m20 accepted-replace key-identity remaps', () => {
  it('calls both remaps after each accepted replace and never on failure', () => {
    const recordsStart = studio.indexOf('const replacePhysicalRecordsWithOwnership = (');
    const documentStart = studio.indexOf('const replacePhysicalDocumentWithOwnership = (', recordsStart);
    const documentEnd = studio.indexOf('const physicalEditCoordinator = useRotoPhysicalEditCoordinator', documentStart);
    expect(recordsStart).toBeGreaterThanOrEqual(0);
    expect(documentStart).toBeGreaterThan(recordsStart);
    expect(documentEnd).toBeGreaterThan(documentStart);
    const recordsSlice = studio.slice(recordsStart, documentStart);
    const documentSlice = studio.slice(documentStart, documentEnd);

    // ONE wrapper drives both stores.
    expect(studio).toContain('const applyScriptRecordRemaps = (');
    expect(studio).toContain('remapBrushScriptsForRecords(beforeRecords, nextRecords)');
    expect(studio).toContain('remapAquarelleScriptsForRecords(beforeRecords, nextRecords)');

    // Identical-revision branch: the remap runs only inside the ok branch.
    expect(recordsSlice).toContain('if (identicalRevisionResult.ok) applyScriptRecordRemaps(beforeRecords, records);');

    // Normal records path: the remap call follows the commit guard.
    const recordsGuard = recordsSlice.indexOf('if (!result.ok) return result;');
    const recordsCall = recordsSlice.indexOf('applyScriptRecordRemaps(beforeRecords, records);', recordsGuard);
    expect(recordsGuard).toBeGreaterThanOrEqual(0);
    expect(recordsCall).toBeGreaterThan(recordsGuard);

    // Document path: same law, with the accepted document records.
    expect(documentSlice).toContain('applyScriptRecordRemaps(beforeRecords, document.realKeyRecords);');
    const documentGuard = documentSlice.indexOf('if (!result.ok) return result;');
    const documentCall = documentSlice.indexOf('applyScriptRecordRemaps(beforeRecords, document.realKeyRecords);', documentGuard);
    expect(documentGuard).toBeGreaterThanOrEqual(0);
    expect(documentCall).toBeGreaterThan(documentGuard);
  });
});

// 261024-mz5 Task 3: the Water color half of the shared transform surface.
// The adapter now supplies the transform callback, the mount threads it like
// the delete/move callbacks, and the Studio commits it through the SAME guard
// chain + Apply pipeline as a move, with ONE bridge crossing for the centre
// and a NEGATED screen angle (uv y points up).
describe('261024-mz5 watercolor transform surface', () => {
  it('threads the transform callback from the adapter through the mount to the Studio', () => {
    // Adapter: prop + port operation.
    expect(aquarelleStrokeOverlay).toContain('onTransformStrokes: (mutationIds: readonly number[], transform: ScriptStrokeTransform) => void;');
    expect(aquarelleStrokeOverlay).toContain('onTransformStrokes={props.onTransformStrokes}');
    expect(aquarelleStrokeOverlay).toContain('transformStrokes: props.onTransformStrokes,');
    // Canvas layer: ref + one render-body assignment (the delete/move pattern).
    expect(aquarelleCanvasLayer).toContain('onTransformStrokes?: (mutationIds: readonly number[], transform: ScriptStrokeTransform) => void;');
    expect(aquarelleCanvasLayer).toContain('const onTransformStrokesRef = useRef(props.onTransformStrokes);');
    expect(aquarelleCanvasLayer).toContain('onTransformStrokesRef.current = props.onTransformStrokes;');
    expect(aquarelleCanvasLayer).toContain('onTransformStrokes={(mutationIds, transform) => onTransformStrokesRef.current?.(mutationIds, transform)}');
    // Mount: same ref pattern, the aquarelle-prefixed prop name.
    expect(canvasMount).toContain('onAquarelleTransformStrokes?: (mutationIds: readonly number[], transform: ScriptStrokeTransform) => void;');
    expect(canvasMount).toContain('const onAquarelleTransformStrokesRef = useRef(props.onAquarelleTransformStrokes);');
    expect(canvasMount).toContain('onAquarelleTransformStrokesRef.current = props.onAquarelleTransformStrokes;');
    expect(canvasMount).toContain('onTransformStrokes={(mutationIds, transform) => onAquarelleTransformStrokesRef.current?.(mutationIds, transform)}');
    // Studio: the mount prop and the registered watercolor port operation.
    expect(studio).toContain('onAquarelleTransformStrokes: handleAquarelleTransformStrokes,');
    expect(studio).toContain('transformStrokes: (ids, transform) => handleAquarelleTransformStrokes(ids, transform),');
    expect(studio).toContain('aquarelleEnginePixelToUv');
  });

  it('commits a watercolor transform through the move guard chain and the shared Apply pipeline', () => {
    const start = studio.indexOf('const handleAquarelleTransformStrokes = useCallback(');
    expect(start).toBeGreaterThan(-1);
    const body = studio.slice(start, studio.indexOf('const handleAquarelleStepStroke', start));
    // The move guard chain, unchanged and peek-only. 261024-p5q: the handler
    // is async and reports whether the re-bake succeeded (false on every
    // guard/refusal) so the dialog never advances on a refused commit.
    expect(body).toContain('if (isPhysicalMutationLocked()) return false;');
    expect(body).toContain('if (rotoScript.applying.peek() || rotoScript.mutationLocked.peek()) return false;');
    expect(body).toContain("if (rotoTimelineModel.currentCell.peek().kind !== 'real') return false;");
    expect(body).toContain('if (isAquarelleScriptEditInFlight()) return false;');
    expect(body).toContain('const playFrame = launchContextRef.current?.startFrame ?? 0;');
    expect(body).toContain('const frameIds = aquarelleStrokesOnFrame(ids, playFrame);');
    expect(body).toContain('if (frameIds.length === 0) return false;');
    // ONE bridge crossing each for the centre and the edge anchor; the screen
    // angle is NEGATED for uv and the per-axis scale passes through.
    expect(body).toContain('const center = aquarelleEnginePixelToUv(');
    expect(body).toContain('{ x: transform.centerX, y: transform.centerY },');
    expect(body).toContain('const anchor = aquarelleEnginePixelToUv(');
    expect(body).toContain('{ x: transform.anchorX, y: transform.anchorY },');
    expect(body).toContain('anchorUvX: anchor.x,');
    expect(body).toContain('anchorUvY: anchor.y,');
    expect(body).toContain('angleRad: -transform.angleRad,');
    expect(body).toContain('scaleX: transform.scaleX,');
    expect(body).toContain('scaleY: transform.scaleY,');
    expect(body).toContain('const editId = beginAquarelleTransformEdit(frameIds, {');
    expect(body).toContain('if (editId === null) return false;');
    // begin -> reset -> await apply -> record on success -> raw rollback on failure.
    const reset = body.indexOf('aquarelleResetSheetRef.current?.();');
    const apply = body.indexOf('await rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame))');
    const record = body.indexOf('rotoMoveHistory.recordAquarelleScriptEdit(editId)');
    const rollback = body.indexOf("restoreAquarelleEditSnapshot(editId, 'undo')");
    expect(reset).toBeGreaterThan(-1);
    expect(apply).toBeGreaterThan(reset);
    expect(record).toBeGreaterThan(apply);
    expect(rollback).toBeGreaterThan(apply);
    expect(body).toContain("?? 'Could not re-apply the watercolor script — the stroke was restored.'");
    // The refusals surface and the in-flight flag clears in `finally`.
    expect(body).toContain('setAquarelleScriptEditInFlight(true);');
    expect(body).toContain('setAquarelleScriptEditInFlight(false);');
  });

  it('mentions the corner scale, edge resize and the top rotate handle in both tooltips', () => {
    expect(toolRail).toContain('Corner handles scale · Edge handles resize width or height · Top handle rotates');
  });
});

// quick 261024-vga: the Stroke Settings Stack section's watercolor commit
// channel. One exact placement = begin edit -> reset sheet -> await the shared
// apply -> record on success -> rollback on failure, exactly like the step and
// move paths, and the bundle callback is the dialog's only reorder seam.
describe('261024-vga watercolor exact stack placement wiring', () => {
  const placeHandlerStart = studio.indexOf('const handleAquarellePlaceStroke = useCallback(');
  const placeHandlerEnd = studio.indexOf('// 261023-g4p: register BOTH module ports', placeHandlerStart);
  const placeHandler = placeHandlerStart >= 0 && placeHandlerEnd > placeHandlerStart
    ? studio.slice(placeHandlerStart, placeHandlerEnd)
    : '';

  it('exists and owns the place path in order (begin -> reset -> await apply -> record on success -> rollback)', () => {
    expect(placeHandlerStart).toBeGreaterThan(-1);
    expect(placeHandlerEnd).toBeGreaterThan(placeHandlerStart);
    const beginSite = placeHandler.indexOf('beginAquarellePlaceEdit(mutationId, positionFromTop)');
    const resetSite = placeHandler.indexOf('aquarelleResetSheetRef.current?.();');
    const applySite = placeHandler.indexOf('await rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame))');
    const recordSite = placeHandler.indexOf('rotoMoveHistory.recordAquarelleScriptEdit(editId)');
    const rollbackSite = placeHandler.indexOf("restoreAquarelleEditSnapshot(editId, 'undo')");
    expect(beginSite).toBeGreaterThan(-1);
    expect(resetSite).toBeGreaterThan(beginSite);
    expect(applySite).toBeGreaterThan(resetSite);
    expect(recordSite).toBeGreaterThan(applySite);
    expect(rollbackSite).toBeGreaterThan(recordSite);
  });

  it('gates on the same peek-only tokens as the step handler', () => {
    expect(placeHandler).toContain('if (isPhysicalMutationLocked()) return;');
    expect(placeHandler).toContain('if (rotoScript.applying.peek() || rotoScript.mutationLocked.peek()) return;');
    expect(placeHandler).toContain("if (rotoTimelineModel.currentCell.peek().kind !== 'real') return;");
    expect(placeHandler).toContain('if (isAquarelleScriptEditInFlight()) return;');
    expect(placeHandler).toContain('finally {');
    expect(placeHandler).toContain('setAquarelleScriptEditInFlight(false);');
  });

  it('never captures the engine, the clipboard or a second apply path', () => {
    expect(placeHandler).not.toContain('engineRef');
    expect(placeHandler).not.toContain('clipboard');
    expect(placeHandler).not.toContain('applyCurrentScript');
  });

  it('wires the watercolor bundle callback and the memo dependency', () => {
    expect(studio).toContain('reorderStroke: (mutationId, positionFromTop) => handleAquarellePlaceStroke(mutationId, positionFromTop),');
    const memoStart = studio.indexOf('const strokeSettingsDialog = strokeSettingsDialogPropsMemo.resolve(');
    expect(memoStart).toBeGreaterThan(-1);
    const memoDepEnd = studio.indexOf('() => {', memoStart);
    expect(memoDepEnd).toBeGreaterThan(memoStart);
    expect(studio.slice(memoStart, memoDepEnd)).toContain('handleAquarellePlaceStroke');
  });
});

// ============================================================
//  quick-261025-awl Task 2 — explicit-selection module ownership.
//
//  ONE stable funnel resolves the frame's script owner; every
//  explicit-selection / ownership-changing seam republishes it.
//  Playback and mid-drag scrubs never switch, and 'clear' never
//  overwrites the destination owner.
// ============================================================
describe('quick-261025-awl explicit-selection module ownership', () => {
  it('declares ONE stable applyFrameModuleState callback with the owner rule', () => {
    expect(studio).toContain('const applyFrameModuleState = useCallback(');
    const start = studio.indexOf('const applyFrameModuleState = useCallback(');
    const end = studio.indexOf('// 261023-g4p: the brush script-edition port', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const funnel = studio.slice(start, end);
    // quick-261026-odd: a Loop Clip rail frame is pixel-only by law and never
    // publishes an owner — even when it resolves as a real baked key.
    expect(funnel).toContain('const railOwned = isRotoLoopRailFrame(');
    expect(funnel).toContain('const owner = railOwned ? null : resolveFrameScriptOwner(frame, liveBrush ?? null);');
    expect(funnel).toContain("if (owner === 'brush' || owner === 'watercolor') {");
    expect(funnel).toContain('if (activeModule.peek() !== owner) activeModule.value = owner;');
    expect(funnel).toContain('setFrameScriptOwner(owner);');
    expect(funnel).toContain('    [],');
  });

  it('gates the navigation funnel between the outgoing flush and the pixel snapshot', () => {
    const navigationStart = studio.indexOf('const navigateToSyncedPhysicalFrame = useCallback(');
    const navigationEnd = studio.indexOf('rotoNavigation.configureRuntimePort(', navigationStart);
    const navigation = studio.slice(navigationStart, navigationEnd);
    expect(navigationStart).toBeGreaterThan(-1);

    const funnel = 'if (!wasPlaying && !rotoCachedPlayback.isActive) applyFrameModuleState(frame);';
    const funnelIndex = navigation.indexOf(funnel);
    const flushIndex = navigation.indexOf('flushBrushScriptFrame(');
    const snapshotIndex = navigation.indexOf('rotoPersistence.snapshotLivePixels(currentFrame);');
    expect(funnelIndex).toBeGreaterThan(-1);
    expect(flushIndex).toBeGreaterThan(-1);
    expect(snapshotIndex).toBeGreaterThan(-1);
    expect(funnelIndex).toBeGreaterThan(flushIndex);
    expect(funnelIndex).toBeLessThan(snapshotIndex);
    // The destination module governs hydration (read after the funnel).
    expect(funnelIndex).toBeLessThan(navigation.indexOf('const hydrationPlan = planBrushScriptHydration(hydrationRequest);'));
  });

  it('publishes the owner on BOTH launch-restore exits, after the restore', () => {
    const restoreStart = studio.indexOf('restoreStudioScriptSnapshot: async (context, document) => {');
    const restoreEnd = studio.indexOf('usePhysicsPaintWorkflowIntegration({', restoreStart);
    const restore = studio.slice(restoreStart, restoreEnd);
    expect(restoreStart).toBeGreaterThan(-1);

    expect(countOccurrences(restore, 'applyFrameModuleState(context.startFrame);')).toBe(2);
    const restoreAwait = restore.indexOf('const restored = await studioScriptSnapshot.restore();');
    expect(restoreAwait).toBeGreaterThan(-1);
    expect(restore.indexOf('applyFrameModuleState(context.startFrame);', restoreAwait)).toBeGreaterThan(restoreAwait);
  });

  it('republishes on a cross-track switch before the mutation-clock early return', () => {
    const switchStart = studio.indexOf('void studioScriptSnapshot.restore().then((restored) => {');
    const switchEnd = studio.indexOf('} else {', switchStart);
    const switchBlock = studio.slice(switchStart, switchEnd);
    expect(switchStart).toBeGreaterThan(-1);
    expect(switchBlock).toContain('applyFrameModuleState(launchContextRef.current?.startFrame ?? currentFrame);');
    expect(switchBlock.indexOf('applyFrameModuleState(launchContextRef.current?.startFrame ?? currentFrame);'))
      .toBeLessThan(switchBlock.indexOf('if (restored.maxRestoredMutationId <= 0) return;'));
  });

  it('refreshes after a non-clear brush completion and never on clear', () => {
    const completionStart = studio.indexOf('canvasCompletedMutationImplRef.current = (mutation, mutationEngine) => {');
    const blockStart = studio.indexOf("if (activeModule.peek() !== 'watercolor') {", completionStart);
    const blockEnd = studio.indexOf('rotoMoveHistory.observePaintMutation(', blockStart);
    const block = studio.slice(blockStart, blockEnd);
    expect(blockStart).toBeGreaterThan(-1);
    expect(block).toContain("if (kind !== 'clear') {");
    expect(block).toContain('applyFrameModuleState(scriptFrame, {');
    expect(block).toContain('strokeCount: mutationEngine.getStrokeCount(),');
    expect(block.indexOf("if (kind !== 'clear') {"))
      .toBeLessThan(block.indexOf('applyFrameModuleState(scriptFrame, {'));
  });

  it('republishes on the aquarelle stroke-end, delete and history seams', () => {
    const strokeEndStart = studio.indexOf('const handleAquarelleStrokeEnd = useCallback(');
    const strokeEndEnd = studio.indexOf('const handleAquarelleStrokeSettled = useCallback(', strokeEndStart);
    expect(studio.slice(strokeEndStart, strokeEndEnd))
      .toContain('applyFrameModuleState(launchContextRef.current?.startFrame ?? 0);');

    const deleteStart = studio.indexOf('const handleAquarelleDeleteStrokes = useCallback(');
    const deleteEnd = studio.indexOf('const handleAquarelleMoveStrokes', deleteStart);
    const deleteHandler = studio.slice(deleteStart, deleteEnd);
    const refreshIndex = deleteHandler.indexOf('applyFrameModuleState(playFrame);');
    const clearRefusalIndex = deleteHandler.indexOf('clearOwnedScriptApplyRefusal();');
    const nextReturnIndex = deleteHandler.indexOf('return;', refreshIndex);
    expect(refreshIndex).toBeGreaterThan(clearRefusalIndex);
    expect(nextReturnIndex).toBeGreaterThan(refreshIndex);

    const replayStart = studio.indexOf('replay: async (editId, direction) => {');
    const replayEnd = studio.indexOf('return true;', replayStart);
    const replay = studio.slice(replayStart, replayEnd);
    expect(replay).toContain('rotoScript.notifySourceRevision();');
    expect(replay.indexOf('applyFrameModuleState(playFrame);'))
      .toBeGreaterThan(replay.indexOf('rotoScript.notifySourceRevision();'));
  });

  it('republishes on clearActiveSource, clearCanvas and every Memory purge seam', () => {
    const clearSourceStart = studio.indexOf('const clearActiveSource = useCallback(');
    const clearSourceEnd = studio.indexOf('const navigateToSyncedPhysicalFrame', clearSourceStart);
    const clearSource = studio.slice(clearSourceStart, clearSourceEnd);
    expect(clearSource).toContain('clearBrushScriptFrame(currentFrame);');
    expect(clearSource).toContain('applyFrameModuleState(currentFrame);');

    const clearCanvasStart = studio.indexOf('clearCanvas: (frame) => {');
    const clearCanvasEnd = studio.indexOf('navigate: navigateToSyncedPhysicalFrame', clearCanvasStart);
    const clearCanvas = studio.slice(clearCanvasStart, clearCanvasEnd);
    expect(clearCanvas).toContain('clearBrushScriptFrame(frame);');
    expect(clearCanvas).toContain('applyFrameModuleState(frame);');

    const purgeStart = studio.indexOf('function purgeMemoryScriptFrame(frame: number): boolean {');
    const railStart = studio.indexOf('function purgeMemoryRailScripts(', purgeStart);
    const clearStart = studio.indexOf('function clearMemoryRailScripts(', railStart);
    const clearEnd = studio.indexOf('const handleRightPanelColorCommit', clearStart);
    const purgeFrame = studio.slice(purgeStart, railStart);
    const purgeRail = studio.slice(railStart, clearStart);
    const purgeClear = studio.slice(clearStart, clearEnd);
    expect(purgeStart).toBeGreaterThan(-1);

    expect(purgeFrame).toContain('frame === (launchContextRef.current?.startFrame ?? -1)');
    expect(purgeFrame).toContain('applyFrameModuleState(frame);');
    expect(purgeRail).toContain('frames.includes(liveFrame)');
    expect(purgeRail).toContain('applyFrameModuleState(liveFrame);');
    expect(purgeClear).toContain('const liveFrame = launchContextRef.current?.startFrame;');
    expect(purgeClear).toContain('applyFrameModuleState(liveFrame);');
  });

  it('wires the brush port delete callback and clears the lock on unmount', () => {
    expect(studio).toContain('onScriptChanged: (frame) => {');
    expect(studio).toContain('applyFrameModuleState(frame);');
    expect(studio).toContain('clearFrameScriptOwner();');
    const teardownStart = studio.indexOf('useEffect(() => () => {\n    clearFrameScriptOwner();');
    expect(teardownStart).toBeGreaterThan(-1);

    // ONE notify site in the port, inside deleteBrushScriptStrokes only.
    expect(brushScriptEditionPortSource).toContain('resolved.context.onScriptChanged?.(resolved.frame);');
    expect(countOccurrences(brushScriptEditionPortSource, 'onScriptChanged?.(')).toBe(1);
    const deleteStart = brushScriptEditionPortSource.indexOf('export function deleteBrushScriptStrokes(');
    const deleteEnd = brushScriptEditionPortSource.indexOf('/** Single-stroke wrapper', deleteStart);
    expect(brushScriptEditionPortSource.slice(deleteStart, deleteEnd))
      .toContain('resolved.context.onScriptChanged?.(resolved.frame);');
  });
});

describe('quick-261025-awl Raster handler (D-04)', () => {
  const handlerStart = studio.indexOf(
    'const rasterKeyImplRef = useRef<(frame: number) => Promise<void>>(async () => {});',
  );
  const handlerEnd = studio.indexOf('const handleRasterKeyRequest = useCallback(', handlerStart);
  const handler = studio.slice(handlerStart, handlerEnd);

  it('exists with the stable strip callback wired into the workflow props', () => {
    expect(handlerStart).toBeGreaterThan(-1);
    expect(handlerEnd).toBeGreaterThan(handlerStart);
    expect(studio).toContain('const handleRasterKeyRequest = useCallback((frame: number) => {');
    expect(studio).toContain('void rasterKeyImplRef.current(frame);');
    expect(studio).toContain('onRasterKey: handleRasterKeyRequest, frameScriptOwner,');
  });

  it('refuses in the documented guard order', () => {
    const guards = [
      'if (!engine) return;',
      'if (isPhysicalMutationLocked()) return;',
      'if (rotoScript.applying.peek() || rotoScript.mutationLocked.peek()) return;',
      'if (rotoCachedPlayback.isActive) return;',
      'if (!readyToApply) return;',
      'if (frame !== (launchContextRef.current?.startFrame ?? -1)) return;',
      'if (owner === null) return;',
    ];
    let previous = -1;
    for (const guard of guards) {
      const index = handler.indexOf(guard);
      expect(index, guard).toBeGreaterThan(previous);
      previous = index;
    }
    expect(handler).toContain('const owner = resolveFrameScriptOwner(frame, {');
    expect(handler).toContain('active: activeModule.peek() === \'brush\',');
    expect(handler).toContain('strokeCount: engine.getStrokeCount(),');
    // The frame identity is re-checked after the awaited pixel flush.
    expect(
      countOccurrences(
        handler,
        'if (frame !== (launchContextRef.current?.startFrame ?? -1)) return;',
      ),
    ).toBe(2);
  });

  it('runs capture, verification, ledger clear and reload strictly before the purge', () => {
    const order = [
      'engine.flushPendingStrokeFinalizations();',
      'engine.forceDry();',
      'rotoPersistenceRef.current.snapshotLivePixels(frame);',
      'await flushAquarellePixels(frame);',
      'findCachedRotoDisplayFrameRef.current(frame)',
      'engine.clearPreviewBaseImage(true);',
      'engine.resetBackground(true);',
      'engine.clear();',
      'loadCachedRotoReferenceFrame(frame, engine)',
      'purgeMemoryScriptFrame(frame);',
      'applyFrameModuleState(frame);',
    ];
    let previous = -1;
    for (const step of order) {
      const index = handler.indexOf(step);
      expect(index, step).toBeGreaterThan(previous);
      previous = index;
    }
    expect(handler).toContain('if (owner !== \'watercolor\') {');
  });

  it('fails closed with the nothing-changed copy for both pre-purge failures', () => {
    expect(handler).toContain(
      '"The key\'s painted pixels are not available — nothing changed."',
    );
    expect(handler).toContain(
      '"The key\'s painted pixels could not be reloaded — nothing changed."',
    );
    expect(handler).toContain("'Rastering the key failed — nothing changed.'");
    // Both failure paths return before the purge call.
    const firstReturnAfterFailure = handler.indexOf('return;', handler.indexOf('findCachedRotoDisplayFrameRef.current(frame)'));
    const purge = handler.indexOf('purgeMemoryScriptFrame(frame);');
    expect(firstReturnAfterFailure).toBeGreaterThan(-1);
    expect(firstReturnAfterFailure).toBeLessThan(purge);
  });

  it('never writes activeModule — the module survives the conversion', () => {
    expect(handler).not.toContain('activeModule.value');
    expect(handler).not.toContain('activeModule.peek() !==');
    expect(handler).not.toContain('activeModule.peek() === \'watercolor\')');
  });
});

// 261025-d3r revision: the dark canvas-region background is a deselect
// target, so a canvas full of strokes is never a selection trap.
describe('261025-d3r canvas-region deselect', () => {
  it('clears the Move/Select selection on a plain background click outside the canvas', () => {
    expect(studioView).toContain('onPointerDown={handleCanvasRegionPointerDown}');
    expect(studioView).toContain('if (scriptSelectedStrokeIds.peek().size === 0) return;');
    expect(studioView).toContain('shouldClearSelectionOnCanvasRegionPointerDown(event, target)');
    expect(studioView).toContain('clearScriptStrokeSelection();');
  });
});
