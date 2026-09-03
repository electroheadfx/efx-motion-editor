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
    const save = scriptsPanel.indexOf('label="Save Action"');
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
    expect(studio).toContain('const record = physicPaintStore.getRotoRealKeyRecord(launch.layerId, studioActiveTrackId(), accepted.after.selectedKeyId);');
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
    expect(studio).toContain("if (mode !== 'Tauri' && mode !== 'Browser fallback') return;");
    expect(studio).toContain('// eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [launchContext?.layerId, efxPaintVersion.value]);');
    expect(main).toContain('installPhysicPaintEfxPaintDocumentListener()');
    // The main-window listener is fail-closed (canonical parser) and
    // idempotency-guarded by document revision (the launch push is a no-op).
    expect(bridge).toContain("PHYSIC_PAINT_EFX_PAINT_DOCUMENT_EVENT = 'physic-paint:efx-paint-document'");
    expect(bridge).toContain('installPhysicPaintEfxPaintDocumentListener');
    expect(bridge).toContain('parseEfxPaintDocument(incoming.document ?? payload)');
    expect(bridge).toContain('buildEfxPaintDocumentRevision(current) === buildEfxPaintDocumentRevision(document)');
    // 49-06 (UAT round 11): the child carries its runtime background source
    // bytes with the sync (the main window's registry is only hydrated at
    // project load), and the listener registers them BEFORE the revision guard.
    expect(studio).toContain('getBackgroundSourceImageDataUrl(ref)');
    expect(bridge).toContain('registerBackgroundSourceImage(ref, dataUrl)');
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
    // whole Studio per paint event.
    expect(studio).toContain('const rotoLoopClips = useMemo(() => launchContext ? physicPaintStore.getRotoPhysicalLoopClips(launchContext.layerId, studioActiveTrackId()) : PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY, [launchContext?.layerId, throttledPaintRevision.value, efxPaintVersion.value]);');
    expect(studio).toContain('getRotoPhysicalDocument: (layerId, trackId) => physicPaintStore.getRotoPhysicalDocument(layerId, trackId),');
    expect(studio).toContain('getRotoPhysicalRenderSource: (layerId, trackId, appFrame) => physicPaintStore.getRotoPhysicalRenderSource(layerId, trackId, appFrame),');
    expect(studio).toContain('getRenderSource: (appFrame) => launchContext ? physicPaintStore.getRotoPhysicalRenderSource(launchContext.layerId, trackIdOfLaunch(launchContext), appFrame) : null,');

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
    expect(studio).toContain('[launchContext?.layerId, throttledPaintRevision.value, efxPaintVersion.value]');
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
    expect(selection).toContain('physicPaintStore.setRotoPhysicalSelection(\n        launchContext.layerId,\n        trackIdOfLaunch(launchContext),\n        null,\n        currentFrame,\n      );');
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
    expect(selectAll).toContain('physicPaintStore.setRotoPhysicalSelection(\n        launchContext.layerId,\n        trackIdOfLaunch(launchContext),\n        null,\n        currentFrame,\n      );');
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
    // 43.6-06 (D-14): collapsing the set also disarms an armed Solo — the
    // set collapse is a rail-selection change.
    expect(collapse).toContain('if (railSetSelection.value !== null) {\n          railSetSelection.value = null;\n          // 43.6-06 (D-14): collapsing the set is a rail-selection change.\n          disarmSolo();\n          return;\n        }');
    expect(collapse).toContain('if (selectedKeyIds.value.length <= 1) return;');
  });

  it('gates the solo playback window on the armed signal so a plain rail selection never filters playback (43.6-09)', () => {
    const portStart = studio.indexOf('getSoloWindow: () => {');
    const portEnd = studio.indexOf('onStart: (frameCount)', portStart);
    const port = studio.slice(portStart, portEnd);
    expect(portStart).toBeGreaterThanOrEqual(0);
    // 43.6-09: a disarmed solo must return null BEFORE member derivation so
    // the playback enumeration stays byte-identical (43.6-06 D-17) even when
    // a rail is selected — otherwise selecting a rail after disarm plays only
    // that rail, as if solo were still active.
    expect(port).toContain('if (!isSoloArmed()) return null;');
    expect(port.indexOf('if (!isSoloArmed()) return null;')).toBeLessThan(port.indexOf('const members: RailSetIdentity[]'));
  });

  it('disarms an armed Solo when a plain Loop Rail click changes the selection (43.6-11)', () => {
    // REVIEW-WR-01 regression: the plain-click success branch of
    // handleSelectRotoLoopClip is the only rail-selection change path that used
    // to skip disarmSolo() — an armed Solo would silently retarget to the newly
    // plain-clicked Loop rail via the getSoloWindow single-rail fallback.
    const handlerStart = studio.indexOf('const handleSelectRotoLoopClip = useCallback((');
    const handlerEnd = studio.indexOf('const handleOpenRotoLoopEdit', handlerStart);
    const handler = studio.slice(handlerStart, handlerEnd);
    expect(handlerStart).toBeGreaterThanOrEqual(0);
    // The plain-click branch runs from the collapse comment (unique inside the
    // Loop handler slice — the Key Rail handler's identical comment sits
    // outside it) to the end of the handler.
    const branchStart = handler.indexOf('// Plain click collapses the set into the single-rail path (D-04).');
    expect(branchStart).toBeGreaterThanOrEqual(0);
    const branch = handler.slice(branchStart);
    // 43.6-06 (D-14): a plain Loop Rail click is a rail-selection change, so an
    // armed Solo must disarm BEFORE the new selection is written — the armed
    // getSoloWindow gate (L1153) then returns null for the new selection.
    expect(branch).toContain('disarmSolo();');
    expect(branch.indexOf('disarmSolo();')).toBeLessThan(
      branch.indexOf('selectedLoopClipIds.value = next.selectedLoopClipIds;'),
    );
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
    expect(studio).toContain('This is the Rail’s only frame. Delete Frame will remove the whole Rail and its uniquely owned data. The Action is kept.');
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
// (CMP-01): Studio playback availability now derives from the FLATTENED path —
// getFlattenedFrame returns a record whenever the document resolves the frame,
// so a placeholder frame plays transparent (the 48-03 D-09 missing-source
// report carries the reason) instead of being excluded from availability. The
// frame is still never offered as real key content (key identity derives from
// the projection cell only).
describe('Physics Paint Studio loop placeholder contract (D-28, flattened-sourced)', () => {
  it('sources the playback availability memo from the flattened path so Studio playback and the program monitor never diverge from the main editor', () => {
    expect(studio).toContain('physicPaintStore.getFlattenedFrame(rotoPlaybackLayerId, appFrame)');
    // The flattened path has no render-source switch: a record is available,
    // null (pending decode) is not — never a per-track active-track probe.
    expect(studio).toContain("return [{ appFrame, frame: record.renderedFrame }];");
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
    expect(memoizedCanvasMount).toContain('export const MemoizedPhysicsPaintCanvasMount = memo(PhysicsPaintCanvasMount);');
    expect(studioView).toContain('const MemoizedPhysicsPaintCanvasStack = memo(PhysicsPaintCanvasStackImpl);');
    expect(studioView).toContain('<MemoizedPhysicsPaintCanvasMount key={props.canvasKey} {...props.mount} />');
    expect(studioView).not.toContain('<PhysicsPaintCanvasMount key={canvas.canvasKey} {...canvas.mount} />');
  });
});

describe('Workflow navigation render localization', () => {
  it('assembles Workflow with named stable callbacks instead of inline action closures', () => {
    for (const handler of [
      'handleRotoInterpolationEnabledChange',
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
    expect(workflowBlock).not.toContain('onRotoInterpolationEnabledChange: (');
    expect(workflowBlock).not.toContain('onNavigateToSyncedFrame: (');
    expect(workflowBlock).toContain('onRotoInterpolationEnabledChange: handleRotoInterpolationEnabledChange');
    expect(workflowBlock).toContain('onNavigateToSyncedFrame: handleNavigateToSyncedFrame');
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
    // The strip props carry the scrub lifecycle: armed sets the flag, release
    // clears it and stops the snippet at the final frame.
    expect(studio).toContain('onScrubStart: () => { scrubActiveRef.current = true; }');
    expect(studio).toContain('onScrubEnd: (frame) => { scrubActiveRef.current = false; rotoCachedPlayback.scrubEnd(frame); }');
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
    expect(engineLifecycle).toContain('}, [engine, input.launchContext?.document?.background?.fallback]);');
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
    // canvasMount, referenceDialog (50-UAT modal redesign).
    expect(countOccurrences(studio, 'PropsMemo.resolve(')).toBe(8);
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
    expect(studio).toContain('const handleBackgroundChange = (mode: BgMode) => {');
    expect(studio).toContain('setBackground(mode);');
    expect(studio).toContain('setBackgroundFallback(layerId, backgroundModeToFallback(mode, settings));');
    // The topBar consumes the wrapper, and the memo re-resolves with the new
    // handler identity (not the raw setBackground action).
    expect(studio).toContain('onBackgroundChange: handleBackgroundChange,');
    expect(studio).toContain('handleBackgroundChange, setPaperGrain, setGrainStrength]');
  });
});

describe('Physics Paint scoped background asset picker (49-04, S2)', () => {
  it('wires the signal-driven picker controller to the image-library bridge consumer and imageStore import path', () => {
    expect(studio).toContain('useBackgroundAssetPickerController({');
    expect(studio).toContain('requestLibrary: () => requestImageLibrary()');
    expect(studio).toContain('importFiles: (paths: string[], projectDir: string) => imageStore.importFiles(paths, projectDir)');
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
    expect(studioView).toContain('<MemoizedPhysicsPaintCanvasMount key={props.canvasKey} {...props.mount} />');
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
    expect(rightPanel).toContain('aria-label="Track options"');
    expect(rightPanel).toContain('Track: {trackName}');
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
    expect(studio).toContain('referenceTransformHandles: programMonitorLayerId ? {');
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
    expect(referenceTransform).toContain('imageWidth * zoom');
    expect(referenceTransform).toContain('transform.rotation');
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
    expect(studio).toContain('setTransformLocked: (layerId: string, locked: boolean) => setPhotoReferenceTransformLocked(layerId, locked)');
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
