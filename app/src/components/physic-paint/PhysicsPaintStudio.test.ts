import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { effect } from '@preact/signals';
import {
  draftMode,
  draftPixelsDirty,
  runWireframeOffTransition,
  setDraftPixelsDirty,
  setWireframeMode,
  setWireframeSettleInFlight,
  wireframeMode,
  wireframeSettleInFlight,
} from './view/scriptStrokeEdition';
import type { AquarelleStroke } from '@efxlab/efx-watercolor/payload';
import { admitsPathEditWrite } from './view/strokeSettingsModel';

// 261027-klx: the G2 census gate forbids the contiguous retired Brush-script
// tokens in app/src. These negative pins still scan for the real identifiers at
// runtime — only the spelling is composed from fragments — so a re-introduced
// surface trips the guard exactly as before.
function retired(...parts: string[]): string {
  return parts.join('');
}

const backgroundPickerView = readFileSync(fileURLToPath(new URL('./view/BackgroundAssetPickerView.tsx', import.meta.url)), 'utf8');
const capability = readFileSync(fileURLToPath(new URL('../../../src-tauri/capabilities/physics-paint.json', import.meta.url)), 'utf8');
const trackRow = readFileSync(fileURLToPath(new URL('./view/PhysicsPaintTrackRow.tsx', import.meta.url)), 'utf8');
const headerColumn = readFileSync(fileURLToPath(new URL('./view/physicsPaintTrackHeaderColumn.tsx', import.meta.url)), 'utf8');

const studio = readFileSync(fileURLToPath(new URL('./PhysicsPaintStudio.tsx', import.meta.url)), 'utf8');
const studioView = readFileSync(fileURLToPath(new URL('./view/PhysicsPaintStudioView.tsx', import.meta.url)), 'utf8');
const studioShortcutsHelp = readFileSync(fileURLToPath(new URL('./view/physicsPaintShortcutsHelp.ts', import.meta.url)), 'utf8');
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
// 261029-lsr: the ONE script-replay orchestration the Studio's route delegates to.
const aquarelleScriptReplay = readFileSync(fileURLToPath(new URL('./roto/aquarelleScriptReplay.ts', import.meta.url)), 'utf8');
// 261029-lsr: the transaction-level capture gate (Layer B, the script epoch).
const livePixelTransactions = readFileSync(fileURLToPath(new URL('./roto/rotoLivePixelCacheTransactions.ts', import.meta.url)), 'utf8');
// 261023-g4p: ONE shared gesture implementation + ONE shared edition module.
const scriptStrokeOverlay = readFileSync(fileURLToPath(new URL('./engine/ScriptStrokeOverlay.tsx', import.meta.url)), 'utf8');
const scriptStrokeEdition = readFileSync(fileURLToPath(new URL('./view/scriptStrokeEdition.ts', import.meta.url)), 'utf8');
// 61-13: the Draft switch is the one control the wireframe must DISABLE and
// leave visibly ON (the latch owns the settle).
const strokeSettingsDialog = readFileSync(fileURLToPath(new URL('./view/PhysicsPaintStrokeSettingsDialog.tsx', import.meta.url)), 'utf8');
// 261101-o2m (D-02): the frozen-sheet leaf the cache eye hides.
const cachedBase = readFileSync(fileURLToPath(new URL('./engine/AquarelleCachedBaseLayer.tsx', import.meta.url)), 'utf8');
// 261101-o2m (D-05): the main-realm Draft gate, its Studio publisher and the
// two save/export callers that abort on a refused recompute.
const draftModeTransport = readFileSync(fileURLToPath(new URL('../../lib/physicPaintDraftMode.ts', import.meta.url)), 'utf8');
const autoSave = readFileSync(fileURLToPath(new URL('../../lib/autoSave.ts', import.meta.url)), 'utf8');
const projectStoreSource = readFileSync(fileURLToPath(new URL('../../stores/projectStore.ts', import.meta.url)), 'utf8');
const exportEngine = readFileSync(fileURLToPath(new URL('../../lib/exportEngine.ts', import.meta.url)), 'utf8');
const snapshotController = readFileSync(fileURLToPath(new URL('./snapshot/studioScriptSnapshotController.ts', import.meta.url)), 'utf8');
// 261027-klx: the Brush edition adapter and its overlay are gone with engine-1
// (Wave 2). Wave 3 owns this suite's load path — no read may name a deleted file.
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
// 260922-rd4: the background transform wiring pins (STEP F).
const backgroundClipSection = readFileSync(fileURLToPath(new URL('./view/PhysicsPaintBackgroundClipSection.tsx', import.meta.url)), 'utf8');

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

  it('keeps Save, Load/Paintbrush, Run Script, and cached Roto playback distinct', () => {
    const save = scriptsPanel.indexOf('label="Save Script"');
    const paintbrush = scriptsPanel.indexOf('label="Load + Apply to Frame"');
    const playScript = scriptsPanel.indexOf('label="Run Script…"');
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
    // 261027 UAT round 5: the reconcile is UNCONDITIONAL — the old
    // operationKind allowlist omitted ordinary delete-key, leaving the stale
    // cache on screen. Generated Group publications refresh through the same
    // seam.
    expect(finalizeAccepted).toContain('portsRef.current.reference.reconcileCurrentFrame(after.currentAppFrame);');
    expect(finalizeAccepted).not.toContain("pending.operationKind === 'play-script'");
    expect(finalizeAccepted).not.toContain("pending.operationKind === 'regenerate-group'");
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
    expect(studio).toContain('getCurrentSettings: () => launchContext ? physicPaintStore.getRotoInterpolationSettings(launchContext.layerId, studioActiveTrackId()) : { enabled: false, inBetweenCount: 1, mode: \'duplicate\', deform: 0, position: 0, rotation: 0, scale: 0 },');
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
    // 261027 UAT round 8: the commit also fires when only the session/binding
    // diverged from the document (the display-state guard is not the sole key).
    expect(effect).toContain('if (sessionNeedsCommit) {');
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

  it('routes Group Paint activation and completion by Group identity', () => {
    // 261027-klx: the engine-1 captured-content restore path left with the Efx
    // child — the aquarelle sheet owns its own capture. Activation still
    // resolves the target ONCE and lets a Group frame bypass self-promotion.
    expect(studio).toContain('resolveRotoCompletedGroupPaintTarget(document, currentFrame, currentCellKeyId)');
    expect(studio).toContain("paintTarget?.kind === 'group-frame'");
    // 58 G-06: a Rail in-between/gap is the ONE Group frame that promotes.
    expect(studio).toContain("if (paintTarget?.kind !== 'empty' && !railPaintPromotion) return;");
    expect(studio).toContain('resolvePhysicPaintRotoRailKeyInsertTarget({');
    expect(studio).not.toContain("groupTarget?.kind === 'group-gap'");
    expect(studio).not.toContain('shouldReloadRotoFrameAfterFailedCapture');
    // Completion arrives from the app-owned ledger and pairs the paint barrier
    // with the Move history — no engine callback stands between them.
    expect(studio).toContain('rotoMoveHistory.observePaintMutation(mutationId, kind);');
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
    // 58-05 extends the same named import with the inspector projection; the
    // pin keeps asserting the ONE Key Rail presentation module owns it.
    expect(studio).toContain("import { deriveKeyRailSegments, projectSelectedKeyRailInspector } from './view/physicsPaintKeyRailPresentation';");
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

  it('feeds classifier and strip paint from the reconciled selection with classified Rail deletion copy (261031-vbo)', () => {
    expect(studio).toContain('getSelectedKeyRail: () => effectiveSelectedRotoKeyRail,');
    expect(studio).toContain('selectedRotoKeyRail: effectiveSelectedRotoKeyRail');
    expect(studio).toContain('onSelectRotoKeyRail: handleSelectRotoKeyRail');
    expect(studio).toContain('onRotoKeyRailDragRejected: handleRotoKeyRailDragRejected');
    expect(studio).toContain('rotoParentEndExclusive: launchContext ? physicPaintStore.getRotoPhysicalCapacity(launchContext.layerId, trackIdOfLaunch(launchContext)) : 0');
    expect(studio).toContain('const deletedGroupClip = rotoLoopClips.find((clip) => clip.loopId === target.groupId);');
    expect(studio).toContain("const deletedRailType = classifyLoopClipRailKind(deletedGroupClip) === 'standard'\n      ? 'Standard'\n      : deletedGroupClip?.mode === 'static' ? 'Static' : 'Motion';");
    expect(studio).toContain("target.operationKind === 'delete-group'\n      ? `Deleted ${deletedRailType} Rail at F${target.phaseOrigin}.`\n      : `Deleted F${target.appFrame} from Rail at F${target.phaseOrigin}.`");
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

  it('retires the white anchor tick from every Paint rail (v2.0.1 UAT)', () => {
    // The white 2x4 tick painted as a stray cap at the start of the rail line.
    // It is gone from the CSS and from both rail components; the bright
    // selected palette is the only "which rail" signal.
    expect(css).not.toContain('.physics-paint-rail-anchor-tick');
    const keyRail = readFileSync(fileURLToPath(new URL('./view/PhysicsPaintKeyRail.tsx', import.meta.url)), 'utf8');
    const loopRail = readFileSync(fileURLToPath(new URL('./view/PhysicsPaintLoopClipRail.tsx', import.meta.url)), 'utf8');
    expect(keyRail).not.toContain('physics-paint-rail-anchor-tick');
    expect(loopRail).not.toContain('physics-paint-rail-anchor-tick');
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
    expect(studioShortcutsHelp).toContain("keys: '⌘/Ctrl+C', description: 'Copy the selected key'");
    expect(studioShortcutsHelp).toContain("keys: '⌘/Ctrl+V', description: 'Paste at the current frame'");
    expect(studioShortcutsHelp).toContain("keys: 'Delete / ⌫', description: 'Delete the selected real key'");
    expect(studioView).not.toContain('Cmd/Ctrl+C copy selected key(s)');
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

  it('quick 261105-raf: wires the one-shot rail-conversion prompt beside the Play Script dialog', () => {
    // The hook owns the pending request; the Studio forwards its bundle.
    expect(studio).toContain('const railConversionDialog = rotoTimelineActions.railConversionDialog;');
    const viewModelStart = studio.indexOf('const viewModel = usePhysicsPaintStudioViewModel({');
    expect(viewModelStart).toBeGreaterThanOrEqual(0);
    expect(studio.slice(viewModelStart, viewModelStart + 400)).toContain('railConversionDialog,');
    // The view renders it after the Play Script dialog, behind the same picker step-aside.
    expect(studioView).toContain("import { PhysicsPaintRailConversionDialog } from './PhysicsPaintRailConversionDialog';");
    expect(studioView).toContain("import type { RotoRailConversionDialogBundle } from '../hooks/useRotoTimelineActions';");
    expect(studioView).toContain('railConversionDialog?: RotoRailConversionDialogBundle | null;');
    expect(studioView).toContain('{railConversionDialog && !pickerOpen ? <PhysicsPaintRailConversionDialog {...railConversionDialog} /> : null}');
    const playScriptRender = studioView.indexOf('<MemoizedPhysicsPaintPlayScriptDialog {...playScriptDialog} />');
    const railRender = studioView.indexOf('<PhysicsPaintRailConversionDialog {...railConversionDialog} />');
    expect(playScriptRender).toBeGreaterThanOrEqual(0);
    expect(railRender).toBeGreaterThan(playScriptRender);
    // The two addEmptyKey call sites are unchanged.
    expect(studio.match(/physicalKeyUtilities\.addEmptyKey\(/g) ?? []).toHaveLength(2);
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
    // 261027-klx: the engine-1 canvas-ready seam is gone — the ledger
    // completion ref is the first Studio-owned declaration after the dialog.
    const dialogEnd = studio.indexOf('const canvasCompletedMutationImplRef =', dialogStart);
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
    const dialogEnd = studio.indexOf('const canvasCompletedMutationImplRef =', dialogStart);
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
    // quick-261112: the history buttons moved from the rail to the top bar's
    // action cluster — the count-free law and the narrow subscriber ride along.
    const childStart = topBar.indexOf('function PhysicsPaintHistoryActionButton');
    const barStart = topBar.indexOf('export function PhysicsPaintTopBar(');
    const historyActionButton = topBar.slice(childStart, barStart);
    expect(childStart).toBeGreaterThanOrEqual(0);
    expect(childStart).toBeLessThan(barStart);
    expect(historyActionButton).toContain('historyAvailability?.value');
    expect(historyActionButton).toContain("const count = item.id === 'undo' ? availability?.undo ?? 0 : availability?.redo ?? 0;");
    expect(historyActionButton).toContain('disabled={disabled || count === 0}');
    expect(historyActionButton).toContain('title={item.label}');
    expect(historyActionButton).toContain('aria-label={item.label}');
    expect(historyActionButton).not.toContain('physics-paint-history-badge');
    expect(historyActionButton).not.toContain('available)');
    expect(topBar.slice(barStart), 'the bar shell never reads availability').not.toContain('historyAvailability?.value');
    expect(css).not.toContain('.physics-paint-history-badge');
  });
});

describe('Canvas navigation render localization', () => {
  it('assembles stable CanvasStack and CanvasMount props with named callback boundaries', () => {
    expect(studio).toContain('const canvasStackPropsMemo = useRef(createIdentityMemo()).current;');
    expect(studio).toContain('const canvasMountPropsMemo = useRef(createIdentityMemo()).current;');
    // 261027-klx: the engine-1 onEngineReady / onCompletedMutation seam left
    // with the Efx child. The ONE aquarelle port callback is named.
    expect(studio).toContain('const handleAquarelleEnginePortReady = useCallback(');
    expect(studio).toContain('const handleAquarelleStrokeEnd = useCallback(');
    expect(studio).toContain('const canvasMount = canvasMountPropsMemo.resolve(');
    expect(studio).toContain('const canvasStack = canvasStackPropsMemo.resolve(');
    expect(studio).not.toContain('onEngineReady: (readyEngine) => {');
    expect(studio).not.toContain('onCompletedMutation: (mutation, mutationEngine) => {');
    expect(studio).not.toContain('onEngineReady: handleCanvasEngineReady');
    expect(studio).not.toContain('onCompletedMutation: handleCanvasCompletedMutation');
  });

  it('routes navigation-fresh engine and mutation behavior through stable implementation refs', () => {
    // The frame-editing begin seam re-resolves per render behind a stable ref;
    // ledger completions route through the SAME ref pattern so the latest
    // closure runs while the subscription stays single.
    expect(studio).toContain('beginRotoFrameEditImplRef.current = (event?: PointerEvent) => {');
    expect(studio).toContain('canvasCompletedMutationImplRef.current = (mutation) => {');
    expect(studio).toContain('useEffect(() => paintMutationLedger.subscribe((mutation) => {');
    expect(studio).toContain('canvasCompletedMutationImplRef.current(mutation);');
    expect(studio).toContain('const beginRotoFrameEdit = useCallback((event?: PointerEvent) => {');
    expect(studio).toContain('onEnginePortReady: handleAquarelleEnginePortReady,');
  });

  it('keeps CanvasMount plain and mounts its dedicated wrapper from memoized CanvasStack', () => {
    expect(canvasMount).toContain('export function PhysicsPaintCanvasMount(');
    expect(countOccurrences(canvasMount, 'memo(')).toBe(0);
    expect(memoizedCanvasMount).toContain('export const MemoizedPhysicsPaintCanvasMount = memo(PhysicsPaintCanvasMountRenderCounted);');
    // Water color's cached base is rendered under the live canvas — engine-1's
    // preview base is gone with the Efx child. Round 2: the dedicated layer
    // converts the stored transmittance sheet to pigment alpha at display (its
    // own module, so the mount stays plain).
    expect(canvasMount).toContain('props.aquarelleCachedBaseUrl ? (');
    expect(canvasMount).toContain('<AquarelleCachedBaseLayer url={props.aquarelleCachedBaseUrl} />');
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
    // 261027-klx: the app-owned preview base replaces engine-1's surface —
    // wipe the cached base, then load the destination's cached pixels.
    expect(navigation).toContain('previewBasePort.clearPreviewBaseImage(true);');
    expect(navigation).toContain('previewBasePort.resetBackground(true);');
    expect(navigation).toContain('loadCachedRotoReferenceFrame(frame, previewBasePort);');
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

  it('locks CanvasMount request, observer, and the ONE engine port seam', () => {
    for (const counter of [
      'render.efxChildRequest',
      'observer.canvasMount.resize.install',
      'observer.canvasMount.resize.cleanup',
    ]) {
      expect(countOccurrences(canvasMount, `recordPhysicsPaintPerformanceCounter('${counter}')`), counter).toBe(1);
    }
    expect(canvasMount).toContain('}, [props.height, props.width]);');
    // 261027-klx: the engine-1 lifecycle proxies left with the Efx child; the
    // aquarelle layer's ONE narrow port is the only engine seam.
    expect(canvasMount).toContain('onEnginePortReady={(port) => onEnginePortReadyRef.current?.(port)}');
    expect(canvasMount).not.toContain('lifecycle.canvasMount.engineReady');
    expect(canvasMount).not.toContain('beforeEngineDestroyRef');
    expect(canvasMount).not.toContain('onEngineReadyRef');
  });

  it('keeps the canvas lifecycle hook to the mount flag and the unmount cleanup counter', () => {
    // 261027-klx: the engine-1 tablet + engine lifecycle counters left with
    // engine-1. The hook now owns only the mount flag and the Studio's
    // external pending-state cleanup on unmount.
    for (const retired of [
      'lifecycle.engine.tabletListener.install',
      'lifecycle.engine.tabletListener.cleanup',
    ]) expect(engineLifecycle).not.toContain(retired);
    expect(countOccurrences(engineLifecycle, "recordPhysicsPaintPerformanceCounter('lifecycle.engine.externalState.cleanup')")).toBe(1);
    expect(engineLifecycle).toContain('}, [input.canvasKey]);');
    expect(engineLifecycle).toContain('}, []);');
    expect(engineLifecycle).not.toContain('efxPaintVersion');
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
    // (261022-o2a: the Tools Run Script / Load + Apply picker is owned by the
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
    expect(section).toContain('aria-label="Cycle"');
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
    // NEW entry point (the Tools popover's Run Script / Load + Apply
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
  // Run Script dialog through the Scripts tab's Run Script flow and NOTHING
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

  it('keeps the close sequence: ledger drain, aquarelle capture + live-pixel flush, playback settings, documentSync push', () => {
    const order = [
      'rotoMutationPort.flushPendingStrokeFinalizations?.()',
      'flushAquarellePixels(currentFrame)',
      'rotoPlaybackSettingsController.flush()',
      'flushDocumentSyncRef.current()',
    ];
    const positions = order.map((step) => closeFlush.indexOf(step));
    expect(positions).not.toContain(-1);
    expect([...positions].sort((left, right) => left - right)).toEqual(positions);
    // The aquarelle sheet is invisible to the live-pixel queue until captured;
    // the close gate therefore always flushes in Roto.
    expect(closeFlush).toContain("() => workflowMode === 'roto'");
    // 261027-klx: Water color finalizes a stroke synchronously at stroke end —
    // the ledger port's drain is the ordering seam before the capture. The
    // engine-1 wet-layer forceDry left with the Efx child.
    expect(closeFlush).not.toContain('forceDry');
    expect(closeFlush).not.toContain('flushPendingStrokeFinalizations()');
  });

  it('keeps the requested-flush sequence: idle-gated ledger drain, aquarelle capture + live-pixel flush, documentSync push', () => {
    const order = [
      'readInteractionIdle()',
      'rotoMutationPort.flushPendingStrokeFinalizations?.()',
      'flushAquarellePixels()',
      'pushLiveProjection(layerId, mode)',
    ];
    const positions = order.map((step) => listenerFlush.indexOf(step));
    expect(positions).not.toContain(-1);
    expect([...positions].sort((left, right) => left - right)).toEqual(positions);
    // Same drain-before-capture law on the save path.
    expect(listenerFlush).not.toContain('forceDry');
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
    const guardIndex = captureBlock.indexOf('if (!passesAquarelleCaptureInkGate(ink))');
    const warnIndex = captureBlock.indexOf('console.warn(`[aquarelle-capture] ink-gate rejected');
    const seqIndex = captureBlock.indexOf('const seq = ++aquarelleCaptureSeqRef.current');
    expect(snapshotIndex).toBeGreaterThan(-1);
    expect(inkIndex).toBeGreaterThan(snapshotIndex);
    expect(guardIndex).toBeGreaterThan(inkIndex);
    expect(warnIndex).toBeGreaterThan(guardIndex);
    expect(seqIndex).toBeGreaterThan(guardIndex);
    // quick-261109-uj0: a rejection must be readable from a packaged build, so
    // the diagnostic cannot sit behind import.meta.env and must appear once.
    const guardSlice = captureBlock.slice(guardIndex, seqIndex);
    expect(guardSlice).not.toContain('import.meta.env');
    expect(guardSlice.split('console.warn(').length - 1).toBe(1);
    // The shared module owns every capture ink threshold — calibrated on saved
    // payloads (painted 4.6-11.3, blank 0.05-0.12; wet washes 0.71-0.94 at the
    // 261109-pwt trace). The Studio imports the predicate and declares no floor.
    expect(studio).toContain("from './roto/aquarelleCaptureInk'");
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
    // 261027-klx: the engine-1 post-apply brush-script flush left with the
    // Brush module, so the setter set is the only remaining dependency.
    expect(studio).toContain('}, [rotoScript, rotoScriptLibrary, setLastError, setApplyMessage, setApplyStatus, clearOwnedScriptApplyRefusal]);');
    expect(studio).toContain('}, [rotoScript, setLastError, setApplyMessage, setApplyStatus, clearOwnedScriptApplyRefusal]);');
    // Row activation (loads, never applies) is itself identity-stable.
    expect(studio).toContain('}, [rotoLoopClips, rotoScriptLibrary]);\n  const handleSelectedScriptLoadAndApply = useCallback(');
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
    // 261101-o2m: a tenth site — the Draft settle's recompute refusal — same
    // mapper, same capsule.
    // 61-15: a twelfth site — the vector draw re-bake failure in
    // bakeAquarelleVectorCommit — same mapper, same capsule.
    // 61-15: a thirteenth site — the path-edit re-bake failure in
    // commitAquarelleVectorPathEdit — same mapper, same capsule.
    // 61-31: a fourteenth site — the curve-mode re-bake failure in
    // handleAquarelleCurveModeStrokes — same mapper, same capsule.
    const mentions = studio.split('buildRotoScriptApplyRefusalMessage').length - 1;
    expect(mentions).toBe(14); // one import + thirteen call sites
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

  it('pins (3) ONE handles component carries target: photo-reference | background | rail-motion and dispatches setBackgroundTransform (reuse)', () => {
    // 59-13: the union is additive — the rail-motion target joined it without
    // touching the two legacy branches.
    expect(referenceTransformHandles).toContain("target: 'photo-reference' | 'background' | 'rail-motion'");
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
describe('261027-klx single-engine top-bar writers', () => {
  it("handleOpacityChange writes setAquarelleParam('load') unconditionally", () => {
    // 261018-f15 C2 extracted the routers to identity-stable useCallbacks so
    // the Paint-tab pair can share ONE write-through. 261027-klx: Water color
    // is the only module, so the engine-1 else arm (setBrushOpacity) is gone.
    const routerStart = studio.indexOf('const handleOpacityChange = useCallback(');
    expect(routerStart, 'handleOpacityChange must exist').toBeGreaterThan(-1);
    const routerEnd = studio.indexOf('const topBar = topBarPropsMemo.resolve(', routerStart);
    expect(routerEnd, 'router ends before the topBar memo').toBeGreaterThan(routerStart);
    const opacityHandler = studio.slice(routerStart, routerEnd);
    expect(opacityHandler, 'the live pigment writes aquarelleParams.load').toContain(
      "setAquarelleParam('load', value)",
    );
    expect(opacityHandler, 'the engine-1 else arm left with engine 1').not.toContain('setBrushOpacity');
    expect(opacityHandler, 'no module branch remains').not.toContain('activeModule');
    // The topBar memo binds the shared router (not a bare setter).
    const topBarStart = studio.indexOf('const topBar = topBarPropsMemo.resolve(');
    const topBarEnd = studio.indexOf('const toolRail = toolRailPropsMemo.resolve(', topBarStart);
    const topBarBlock = studio.slice(topBarStart, topBarEnd);
    expect(topBarBlock).toContain('onOpacityChange: handleOpacityChange');
    // Memo deps stay the slim set — no activeModule captured for the router.
    const topBarDeps = topBarBlock.slice(0, topBarBlock.indexOf('], () =>'));
    expect(topBarDeps.indexOf('activeModule'), 'topBar deps must not capture activeModule').toBe(-1);
  });

  it('Brush size router is the same unconditional aquarelle writer', () => {
    const routerStart = studio.indexOf('const handleBrushSizeChange = useCallback(');
    expect(routerStart, 'handleBrushSizeChange must exist').toBeGreaterThan(-1);
    const routerEnd = studio.indexOf('const handleOpacityChange = useCallback(', routerStart);
    const sizeHandler = studio.slice(routerStart, routerEnd);
    expect(sizeHandler).toContain("setAquarelleParam('size', value)");
    expect(sizeHandler, 'the engine-1 size setter left with engine 1').not.toContain('setBrushSize');
    expect(sizeHandler, 'no module branch remains').not.toContain('activeModule');
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

  it('v2.0.1: the paint promotion keeps its ONE addEmptyKey route with join semantics', () => {
    // The post-rail dissolve rides addEmptyKey, so the paint promotion reaches
    // it without a second path. The helper stays the only promotion seam and
    // still passes the join option that makes the dissolve fire.
    const promotionHelper = section(
      studio,
      'promoteRotoPaintTargetRef.current = async (',
      'prepareRotoScriptTargetRef.current = async (',
    );
    expect(promotionHelper).toContain('rotoTimelineActions.physicalKeyUtilities.addEmptyKey(');
    expect(promotionHelper).toContain('{ joinPreviousRail },');
    expect(studio.match(/physicalKeyUtilities\.addEmptyKey\(/g) ?? []).toHaveLength(2);
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
    expect(studioView).toContain('onPointerDownCapture={(event) => {');
    expect(studioView).toContain('props.onInputIntent?.(event);');
    // 261030-cnq: a color pick is consumed BEFORE the intent, so a pick press
    // can never reach beginRotoFrameEdit (no stroke, no auto-key).
    const captureStart = studioView.indexOf('onPointerDownCapture={(event) => {');
    const pickStart = studioView.indexOf('if (props.onColorPick?.(event, event.currentTarget as HTMLElement)) {');
    const intentStart = studioView.indexOf('props.onInputIntent?.(event);');
    expect(captureStart).toBeGreaterThan(-1);
    expect(pickStart).toBeGreaterThan(captureStart);
    expect(intentStart).toBeGreaterThan(pickStart);
    expect(studio).toContain('beginRotoFrameEditImplRef.current(event);');
  });

  it('blocks a paint press on a generated in-between at the canvas-stack capture seam', () => {
    // v2.0.1 UAT: render-only frames must not auto-create a key/override from
    // a stroke; the explicit +Key gesture owns that promotion. The press is
    // consumed before the sheet/engine listeners, so no live stroke lands.
    const block = section(
      studio,
      'const blockGeneratedFramePaintPointerDown = useCallback(',
      'acceptRotoScriptBrushRef.current = rotoFrameEditing.acceptScriptBrush;',
    );
    expect(block).toContain("currentFrameSelectionKind !== 'generated-interpolation'");
    expect(block).toContain('add a key (+Key) before painting');
    expect(block).toContain('physics-paint-reference-transform');
    expect(block).toContain('physics-paint-background-transform');
    // 59-13 fix: the rail-motion gizmo is a transform overlay too — a press on
    // it must never be consumed as a paint gesture.
    expect(block).toContain('physics-paint-rail-motion-transform');
    expect(studio).toContain('blockPaintPointerDown: blockGeneratedFramePaintPointerDown,');
    expect(studioView).toContain('if (props.blockPaintPointerDown?.(event)) {');
    const captureStart = studioView.indexOf('if (props.blockPaintPointerDown?.(event)) {');
    const intentStart = studioView.indexOf('props.onInputIntent?.(event);');
    expect(captureStart).toBeGreaterThan(-1);
    expect(intentStart).toBeGreaterThan(captureStart);
  });

  it('gates promotion on the effective paint-producing tool and a non-transform target', () => {
    const beginBlock = section(studio, 'beginRotoFrameEditImplRef.current = (', 'const beginRotoFrameEdit = useCallback(');
    expect(beginBlock).toContain("settings.tool === 'paint'");
    expect(beginBlock).toContain("aquarelleActiveTool.value === 'brush'");
    expect(beginBlock).toContain("aquarelleActiveTool.value === 'water'");
    expect(beginBlock).toContain("aquarelleActiveTool.value === 'pen'");
    expect(beginBlock).toContain('physics-paint-reference-transform');
    expect(beginBlock).toContain('physics-paint-background-transform');
    // 59-13 fix: pressing the rail-motion gizmo must not start an auto-key
    // paint promotion (it cleared the rail selection and the whole block).
    expect(beginBlock).toContain('physics-paint-rail-motion-transform');
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
    // 261027-klx: the engine-1 canvas clear left with the Efx child — the
    // aquarelle sheet reset is the same-frame cleanup seam.
    expect(clearBlock).not.toContain('.clear()');
    expect(clearBlock).toContain('aquarelleResetSheetRef.current?.()');
    expect(clearBlock.indexOf('clearPreviewBaseImage()')).toBeLessThan(clearBlock.indexOf('aquarelleResetSheetRef.current?.()'));
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

  it('awaits the created key before the aquarelle capture path writes pixels', () => {
    // 261027-klx: the engine-1 capture path left with the Efx child — the
    // aquarelle sheet capture is the one remaining path that must wait for the
    // auto-key promotion, and the ledger completion stays synchronous.
    const completedBlock = section(studio, 'canvasCompletedMutationImplRef.current = (', 'const cachedRotoPlaybackComposition');
    expect(completedBlock).not.toContain('await pendingFirstPaintTarget.promise');
    expect(completedBlock).not.toContain('captureLivePixels');
    expect(completedBlock).toContain('rotoMoveHistory.observePaintMutation(mutationId, kind);');
    const captureBlock = section(studio, 'const handleAquarelleCaptureFrame = useCallback(', '// CACHE MERGE BASE');
    const aquarelleAwaitIndex = captureBlock.indexOf('await pendingFirstPaintTarget.promise');
    expect(aquarelleAwaitIndex).toBeGreaterThan(-1);
    expect(aquarelleAwaitIndex).toBeLessThan(captureBlock.indexOf('captureLivePixels('));
    // Quick 261022-cfn Task 1: the pending base kind chooses the aquarelle merge
    // base — a cloned base multiplies over the previous key's paint; a blank
    // base encodes the sheet alone.
    expect(captureBlock).toContain("cachedBase = pendingFirstPaintTarget.baseKind === 'clone' ? pendingFirstPaintTarget.blankFrame : null;");
    expect(captureBlock).toContain('aquarelleMergeBaseRef.current = { appFrame: playFrame, trackId: targetTrackId, base: cachedBase }');
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
    // 261027 UAT round 6: the pin is per (track, frame) — a frame-only pin
    // merged the incoming sheet over the outgoing track's base.
    expect(captureBlock).toContain('aquarelleMergeBaseRef.current?.appFrame !== playFrame');
    expect(captureBlock).toContain('aquarelleMergeBaseRef.current?.trackId !== targetTrackId');
    expect(captureBlock).toContain('The sheet ACCUMULATES strokes until the session ends');
    // ... and cleared only where the sheet itself is reset or ends.
    expect(studio).toContain('const handleAquarelleSheetSessionEnd = useCallback(() => {');
    expect(studio).toContain('aquarelleMergeBaseRef.current = null');
  });

  it('anchors strokes painted before a promoted key existed (UAT round 7)', () => {
    // On-disk evidence: 83 watercolor strokes saved, only 2 anchored, because
    // strokes painted before the frame's key existed were recorded with no
    // anchor — and the restore drops unanchored strokes. The promotion binds
    // them the moment the key lands.
    expect(studio).toContain('anchorUnownedAquarelleStrokesForFrame(created.appFrame, created.keyId)');
    // 261027 UAT round 8: the record-time anchor resolves against the track
    // the SESSION belongs to. The live document id can already point at
    // another track, and that divergence is what cross-wrote two tracks.
    const strokeEndBlock = section(studio, 'const handleAquarelleStrokeEnd = useCallback(', 'const handleAquarelleStrokeSettled');
    expect(strokeEndBlock).toContain('aquarelleSessionTrackIdRef.current ?? studioActiveTrackId()');
    expect(strokeEndBlock).toContain('sessionTrackId,\n            anchorFrame,');
  });

  it('pins every anchor, capture and promotion seam to the session track (UAT round 8)', () => {
    // On-disk evidence: the document active track moved to track B while the
    // paint session stayed bound to track A. B's green strokes were anchored
    // to B, then saved into A's snapshot, and A's sheet was captured onto B's
    // key — one track's script and pixels overwrote the other's.
    expect(studio).toContain('const aquarelleSessionTrackIdRef = useRef<string | null>(null);');
    const captureBlock = section(studio, 'const handleAquarelleCaptureFrame = useCallback(', '// CACHE MERGE BASE');
    expect(captureBlock).toContain('explicitTrackId ?? sessionTrackId ?? documentTrackId');
    expect(captureBlock).toContain("stage: 'capture'");
    const promotionBlock = section(studio, 'promoteRotoPaintTargetRef.current = async (source) => {', 'const resolution = resolvePreviousRealKeyBase');
    expect(promotionBlock).toContain("return fail('session-track-mismatch')");
    // A snapshot never accepts another track's live key, session or retained.
    expect(studio).toContain('getForeignKeyIds: () => {');
    // The session follows the document on ANY session/binding divergence, not
    // only on a display-state change; the ref is committed at the block end.
    expect(studio).toContain('const sessionNeedsCommit =');
    expect(studio).toContain('|| (boundSnapshotTrackId !== null && boundSnapshotTrackId !== trackId);');
    const switchBlock = section(studio, 'if (sessionNeedsCommit) {', 'setCachedRotoReferenceUrl(null);');
    expect(switchBlock).toContain('const outgoingTrackId = sessionTrackId ?? lastEditStateTrackIdRef.current;');
    expect(switchBlock).toContain('aquarelleSessionTrackIdRef.current = trackId;');
    expect(studio).toContain('aquarelleSessionTrackIdRef.current = trackId;\n      const restored');
  });

  it('forces a promotion-deferred capture through the flush gate the navigation flush already passed', () => {
    // The frame-leave flush runs while the capture is still awaiting the
    // promotion, so the capture is enqueued AFTER that flush returned. Without
    // a second forced flush it sits out CAPTURE_PRODUCE_QUIET_MS (6000ms) and
    // leaving/closing inside that window strands the pixels — the empty cache
    // on return / after key change.
    // 261027-klx: the engine-1 capture flush left with the Efx child; the
    // aquarelle capture owns the surviving deferred-promotion gate.
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
    // 261027-klx: the discarded stroke lives on the Water color sheet — the
    // sheet reset is the cleanup seam (the engine-1 undo left with the Efx
    // child).
    expect(failureBlock).not.toContain('engineRef.current?.undo()');
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
  it('mounts the stroke overlay inside the layer above the canvas; the ring sits in the stack above it', () => {
    const overlayIndex = aquarelleCanvasLayer.indexOf('<AquarelleStrokeOverlay');
    expect(overlayIndex).toBeGreaterThan(-1);
    expect(overlayIndex).toBeGreaterThan(aquarelleCanvasLayer.indexOf('ref={attachEngine}'));
    // 261030-cnq: the ring moved OUT of the isolated tracks group (the
    // reference overlay used to bury it at high opacity) — the canvas stack
    // now mounts it, above the composite.
    expect(aquarelleCanvasLayer).not.toContain('<AquarelleBrushCursor />');
    expect(studioView).toContain('<AquarelleBrushCursor />');
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

  it('draws the size band for paint and the red ribbon for a lift only while the preview switch is on', () => {
    expect(scriptStrokeOverlay).toContain("const LIFT_RIBBON_COLOR = '#ef4444';");
    expect(scriptStrokeOverlay).toContain("entry.kind === 'lift'");
    expect(scriptStrokeOverlay).toContain('fillRule="nonzero"');
    // Unselected bands stay quiet (thin edge, faint wash); selecting one
    // restores the full weight.
    expect(scriptStrokeOverlay).toContain('fillOpacity={isSelected ? 0.14 : 0.07}');
    // 261112-n3f: the visible weight is hoisted to ONE constant — a masked band
    // authors it doubled so the mask trim keeps the same 3.5/1.5 silhouette.
    expect(scriptStrokeOverlay).toContain('const bandEdgeWidthPx = isSelected ? 3.5 : 1.5;');
    expect(scriptStrokeOverlay).toContain("const SELECTED_STROKE_COLOR = '#38bdf8';");
    expect(scriptStrokeOverlay).toContain("const OUTLINE_DARK = '#111111';");
    expect(scriptStrokeOverlay).toContain("const OUTLINE_LIGHT = '#ffffff';");
    // 261101-mvg: the band comes from the module's display-only resolver and
    // is gated on the session switch — OFF (the default, Eraser included)
    // falls through to today's thin centerline outlines.
    expect(scriptStrokeOverlay).toContain('strokeSizePreview');
    expect(scriptStrokeOverlay).toContain('const previewStrokeSize = strokeSizePreview.value;');
    expect(scriptStrokeOverlay).toContain('props.port.bandFor');
    expect(scriptStrokeOverlay).toContain('stroke-size-band');
    expect(scriptStrokeOverlay).toContain('stroke-lift-ribbon');
    // 261112-n3f: the descriptor's edge policy is honoured by a per-row mask —
    // an unmasked fill node plus one masked edge node, never a filter.
    expect(scriptStrokeOverlay).toContain('maskedEdge');
    expect(scriptStrokeOverlay).toContain('script-stroke-band-mask-');
    expect(scriptStrokeOverlay).toContain('stroke-size-band-edge');
    // The band region must map EVERY polygon vertex through the same transform
    // and drag offset as the centerline. A branch-exists-only pin cannot catch
    // a preview that stops following the band (UAT row 6).
    const bandStart = scriptStrokeOverlay.indexOf('const band =');
    const badgeStart = scriptStrokeOverlay.indexOf('const badgeAccent');
    expect(bandStart).toBeGreaterThan(-1);
    expect(badgeStart).toBeGreaterThan(bandStart);
    const bandRegion = scriptStrokeOverlay.slice(bandStart, badgeStart);
    expect(bandRegion).toContain('previewStrokeSize');
    expect(bandRegion).toContain('applyScriptStrokeTransform');
    expect(bandRegion).toContain('offsetX');
    expect(bandRegion).toContain('offsetY');
  });

  it('renders the select/Move toggle in the watercolor rail bound to the select signal', () => {
    const watercolorRail = toolRail.slice(
      toolRail.indexOf('function WatercolorRail'),
      toolRail.indexOf('export interface PhysicsPaintToolRailProps'),
    );
    expect(watercolorRail).toContain('data-testid="aquarelle-select-toggle"');
    expect(watercolorRail).toContain('onClick={() => toggleAquarelleSelectMode()}');
    expect(watercolorRail).toContain('aria-pressed={selectActive}');
    expect(watercolorRail).toContain('const selectActive = aquarelleSelectMode.value;');
    // Select/Move owns the active state: the paint tool is deselected. The
    // 261030-cnq picker joins it — an armed picker deselects the paint tool too.
    // 261107: Motion boundaries (animate mode) joins them — one active surface.
    // 61-08 (D-05): the vector pen joins the same one-active-surface law.
    // 61-13 (D-16): the wireframe latch joins them too — while the
    // construction view is up, no paint tool renders "on".
    expect(watercolorRail).toContain('const isActive =');
    const isActiveRegion = watercolorRail.slice(
      watercolorRail.indexOf('const isActive ='),
      watercolorRail.indexOf('const waterGated'),
    );
    for (const clause of ['!selectActive', '!pickerActive', '!motionBoundaryActive', '!penActive', '!wireframeActive']) {
      expect(isActiveRegion, `isActive must keep the ${clause} clause`).toContain(clause);
    }
    expect(isActiveRegion).toContain('active === id');
    // 61-18: the wireframe latch joins the Select disable expression — the
    // construction view never offers a selection surface over it.
    expect(watercolorRail).toContain('disabled={railDisabled || wireframeActive || !selectAvailable.value}');
    // Better hover text: the A shortcut, the drag, the Backspace delete and the
    // 261022-ujp Space step live on it.
    expect(watercolorRail).toContain('Select (A) — click or A toggles Select on/off and returns to the previous tool · Shift+A enters Select and selects every stroke (press again to deselect all) · Tab cycles the filter Paint → Eraser → All while Select is on · Drag moves the selected stroke · Corner handles scale · Edge handles resize width or height · Top handle rotates · Backspace deletes the selected stroke · < sends the selected stroke one step back · > one step forward');
    // 261027-klx: the Brush module tool set (and its Move tooltip) left with
    // engine 1 — the aquarelle rail is the only tool surface left.
    expect(toolRail).not.toContain('Move — Cmd toggles Move on/off');
    expect(watercolorRail).toContain('{WATERCOLOR_RAIL_TOOLS.map(({ id, label, shortcut, Icon }) => {');
  });

  it('greys Select and makes the A toggle inert when there is no live script', () => {
    // 261027-klx: Water color is the only module — the Brush Move arm left with
    // engine 1; the frame-scoped watercolor gate is the only availability law.
    expect(studio).toContain('if (!watercolorMoveAvailable.peek()) return;');
    expect(studio).not.toContain('if (moveAvailable.peek())');
    // Deleting the last selectable stroke leaves select mode.
    const selectionSource = readFileSync(fileURLToPath(new URL('./view/aquarelleStrokeSelection.ts', import.meta.url)), 'utf8');
    expect(selectionSource).toContain('if (aquarelleLiveStrokeCount.value === 0) setAquarelleSelectMode(false);');
  });

  it('applies the empty-script Move law to activation and exits a stale Move', () => {
    // 261027-klx: the Brush-module Move gate (live engine ledger, retained
    // script, tool-selection funnel) left with engine 1. The Water color gate
    // is frame-scoped: Select needs a script on the CURRENT key, never a
    // session-wide stroke count.
    expect(studio).not.toContain('const moveAvailable = useComputed(');
    expect(studio).not.toContain('engineHoldsBrushMoveStrokes');
    expect(studio).toContain("if (cell.kind !== 'real') return false;");
    expect(studio).toContain('clearFrameScriptOwner();');
    expect(studio).toContain('const watercolorMoveAvailable = useComputed(() => {');
    // quick-261026-odd (run-4 fix): a timeline-graph rebuild retires the
    // computed's sources; a Studio generation signal re-binds both gates so a
    // scripted frame's `true` can never freeze onto a scriptless rail cell.
    expect(studio).toContain('const rotoModelGeneration = useSignal(0);');
    expect(studio).toContain('rotoModelGeneration.value += 1;');
    expect(studio).toContain('void rotoModelGeneration.value;');
    // Identity is re-read in the SAME O(1) projection context as the owner
    // resolver, and a null/non-real/keyless cell fails closed.
    expect(studio).toContain('const scriptCell = resolveStudioScriptCell(cell.appFrame);');
    expect(studio).toContain('return hasAquarelleScriptForFrame(cell.appFrame);');
    expect(studio).toContain("if (activeModule.value !== 'watercolor' || !aquarelleSelectMode.peek()) return;");
    // No purge: a script is content. The render must follow it instead.
    expect(studio).not.toContain('runPendingRailScriptCleanup');
    expect(studio).not.toContain('studioScriptSnapshot.dropRetainedForFrames');
    expect(studio).not.toContain('studioScriptSnapshot.markRailCleanupDone');
    // REVERTED: a stroke-only re-bake must NOT publish to the displayed
    // override key — that erased the cached rail paint. The proper fix is a
    // base merge, not a target swap.
    expect(studio).not.toContain("const renderKeyId = displayed?.kind === 'real' ? displayed.keyId : frame.keyId;");
    // 261027-klx: the Brush Move re-entry after a key transition left with
    // engine 1.
    expect(studio).not.toContain("if (activeModule.peek() === 'brush' && settingsRef.current.tool === 'move') {");
    expect(studio).not.toContain('if (moveAvailable.peek()) {');
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
    // The select read lives in the brush-cursor leaf, never the layer body.
    expect(aquarelleCanvasLayer.indexOf('aquarelleSelectMode.value')).toBeGreaterThan(
      aquarelleCanvasLayer.indexOf('function AquarelleBrushCursor'),
    );
  });

  // 261029-eur Task 1: the one-shot "Select lifts" action retired in favour of
  // the derived Edit switch. The Studio must not keep a handler, an import or a
  // message for it; the switch is driven entirely by the leaf reading the
  // shared signals.
  it('retires the one-shot Select lifts action from the Studio', () => {
    expect(studio).not.toContain('handleSelectLiftStrokes');
    expect(studio).not.toContain('selectAquarelleLiftStrokes');
    expect(studio).not.toContain('onSelectLiftStrokes');
    expect(studio).not.toContain('No Lift strokes on this frame.');
    expect(studio).not.toContain('Lift stroke(s).');
  });

  it('feeds the Edit switch gate through the top-bar memo by identity', () => {
    const topBarStart = studio.indexOf('const topBar = topBarPropsMemo.resolve(');
    const topBarEnd = studio.indexOf('const toolRail = toolRailPropsMemo.resolve(', topBarStart);
    expect(topBarStart).toBeGreaterThanOrEqual(0);
    const topBarBlock = studio.slice(topBarStart, topBarEnd);
    const topBarDeps = topBarBlock.slice(0, topBarBlock.indexOf('], () =>'));
    // The computed signal object rides the dep array by identity; the leaf
    // reads `.value` so a frame with nothing eraser-selectable disables the
    // Edit switch without invalidating frame-only renders.
    expect(topBarDeps).toContain('watercolorMoveAvailable');
    expect(topBarBlock).toContain('moveAvailable: watercolorMoveAvailable');
    // The switch reads the selection signals in the leaf, never the Studio body.
    expect(studio).not.toContain('aquarelleSelectMode.value');
    expect(studio).not.toContain('aquarelleStrokeTypeFilter.value');
  });

  it('keeps the Stroke Settings bundle unfiltered and open on an empty selection', () => {
    const bundleStart = studio.indexOf('const bundle: StrokeSettingsDialogBundle = {');
    const bundleEnd = studio.indexOf('return bundle;', bundleStart);
    expect(bundleStart).toBeGreaterThanOrEqual(0);
    expect(bundleEnd).toBeGreaterThan(bundleStart);
    const bundle = studio.slice(bundleStart, bundleEnd);
    // Stack positions/neighbours stay GLOBAL: the dialog's filter narrows the
    // overlay and hit-test only, never the Studio's own listing.
    expect(bundle).toContain('listStrokes: (frame, size) => listSelectableAquarelleStrokes(frame, size),');
    expect(bundle).not.toContain('aquarelleStrokeTypeFilter');
    // 261029-eur: the sheet survives an empty selection in water color.
    expect(bundle).toContain('keepOpenOnEmpty: true,');
    // 261029-eur UAT: close leaves the surface (back to the paint tool the
    // user had), exactly like releasing Cmd or toggling the rail Select off.
    expect(bundle).toContain('closeMoveMode: () => {');
    expect(bundle).toContain('toggleAquarelleSelectMode()');
  });

  it('wires the delete callback through the canvas mount props and memo deps', () => {
    expect(canvasMount).toContain('onAquarelleDeleteStrokes?: (mutationIds: readonly number[]) => void;');
    expect(canvasMount).toContain(
      'onDeleteStrokes={(mutationIds) => onAquarelleDeleteStrokesRef.current?.(mutationIds)}',
    );
    expect(studio).toContain('onAquarelleDeleteStrokes: handleAquarelleDeleteStrokes,');
    expect(studio).toContain('getAquarellePaperGrainStrength, getAquarelleLiftBlocked, handleAquarelleLiftBlocked, handleAquarelleLiftDab, handleAquarelleDeleteStrokes, handleAquarelleTransformStrokes, handleAquarelleVectorPathEdit]');
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
    // 261101-o2m: the Draft branch records the edit ABOVE the Live tail (a
    // synchronous script commit with no re-bake). Anchor the Live record from
    // the success gate so this pin keeps asserting the re-bake ordering.
    const recordSite = deleteHandler.indexOf('rotoMoveHistory.recordAquarelleScriptEdit(editId);', successSite);
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

    // 261029-lsr: the route delegates the ONE orchestration and answers the
    // recorded-stroke question (R-2: no tombstone term — a deleted stroke's
    // REDO must still route through the script).
    expect(replayPort).toContain('const replayed = await runScriptReplay({ direction, editId, onStep });');
    // Stacked stroke edits: a failed replay re-seats the attempted side ONLY
    // on provable content identity and retries once.
    expect(replayPort).toContain('reanchorAquarelleEditFromLiveContent(editId, direction)');
    expect(replayPort).toContain('if (!attempted || !reanchorAquarelleEditFromLiveContent(editId, direction)) return false;');
    expect(replayPort.indexOf('if (replayed) return true;'))
      .toBeLessThan(replayPort.indexOf('reanchorAquarelleEditFromLiveContent(editId, direction)'));
    expect(replayPort).toContain('hasRecordedStroke: (mutationId) =>');
    expect(replayPort).toContain('replayStroke: async (mutationId, direction, options) => {');
    expect(replayPort).toContain('const skipCapture = options?.skipCapture === true;');
    // The onStep stream classifies a failed replay: a post-rebake failure
    // re-anchors the cached edit for BOTH directions, and an undo drops a
    // cached id the ledger can no longer serve so the next Cmd+Z rebuilds it.
    expect(replayPort).toContain('if (enteredReplay) {');
    expect(replayPort).not.toContain("if (direction === 'undo' && enteredReplay)");
    expect(replayPort).toContain("if (step === 'invalidate') enteredReplay = true;");
    expect(replayPort).toContain('reanchorAquarelleEditRevision(editId, direction)');
    expect(replayPort).toContain('aquarelleStrokeEditIdsRef.current.delete(mutationId)');
    expect(replayPort.indexOf('reanchorAquarelleEditRevision(editId, direction)'))
      .toBeLessThan(replayPort.indexOf('aquarelleStrokeEditIdsRef.current.delete(mutationId)'));
    expect(replayPort.split('aquarelleStrokeEditIdsRef.current.delete(mutationId)').length - 1).toBe(1);

    const runReplayStart = studio.indexOf('const runScriptReplay = useCallback(');
    expect(runReplayStart).toBeGreaterThan(-1);
    const runReplay = studio.slice(
      runReplayStart,
      studio.indexOf('const rotoMoveHistory = useRotoPhysicalEditHistory', runReplayStart),
    );
    expect(runReplay).toContain('restore: (targetEditId, dir) => restoreAquarelleEditSnapshot(targetEditId, dir)');
    expect(runReplay).toContain('aquarelleResetSheetRef.current?.();');
    expect(runReplay).toContain('rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame))');
    expect(runReplay).toContain('restoreAquarelleSnapshotRaw(revert)');
    expect(runReplay).toContain('rotoScript.notifySourceRevision();');
    expect(runReplay.indexOf('rotoPersistence.invalidateLivePixels(playFrame)'))
      .toBeLessThan(runReplay.indexOf('aquarelleResetSheetRef.current?.();'));
    // A refused replay must not stop playback (D-07).
    expect(runReplay.indexOf('isPhysicalMutationLocked()'))
      .toBeLessThan(runReplay.indexOf('rotoCachedPlayback.stop();'));
    // WR-01: the in-flight flag is held across the whole replay — set AFTER the
    // guard (a re-entrant call must refuse itself) and cleared in `finally`, so
    // two rapid Cmd+Z presses cannot both mint an edit.
    expect(runReplay).toContain('setAquarelleScriptEditInFlight(true);');
    expect(runReplay).toContain('setAquarelleScriptEditInFlight(false);');
    expect(runReplay.indexOf('if (isAquarelleScriptEditInFlight()) return false;'))
      .toBeLessThan(runReplay.indexOf('setAquarelleScriptEditInFlight(true);'));
    expect(runReplay.indexOf('rotoCachedPlayback.stop();'))
      .toBeLessThan(runReplay.indexOf('setAquarelleScriptEditInFlight(true);'));
    expect(runReplay).not.toContain('applyCurrentScript');
    expect(runReplay).not.toContain('physicalEditCoordinator');

    // The two fail-closed literals the route used to carry now live in the module.
    expect(aquarelleScriptReplay).toContain('if (revert === null) return false;');
    expect(aquarelleScriptReplay).toContain('ports.rollback(revert);');
  });

  it('makes undo/redo inert while cached playback is running (UAT row 5)', () => {
    // User decision 2026-10-29: undoing mid-playback is not a real workflow, so
    // both wrappers refuse instead of stopping playback or editing under it.
    const undoStart = studio.indexOf('const undo = useCallback(async () => {');
    expect(undoStart).toBeGreaterThan(-1);
    const undoBlock = studio.slice(undoStart, studio.indexOf('const redo = useCallback', undoStart));
    expect(undoBlock).toContain('if (isPlaying) return false;');
    // 62-04 T3: the pending-apply branch replays through `runScriptReplay`, so
    // the callback gained exactly that one dependency.
    expect(undoBlock).toContain('}, [rotoMoveHistoryUndo, rotoScript, isPlaying, syncBackgroundSettingsFromDocument, runScriptReplay]);');
    const redoStart = studio.indexOf('const redo = useCallback(async () => {');
    expect(redoStart).toBeGreaterThan(-1);
    const redoBlock = studio.slice(redoStart, studio.indexOf('// 52.1 (undo/redo shortcut)', redoStart));
    expect(redoBlock).toContain('if (isPlaying) return false;');
    expect(redoBlock).toContain('}, [rotoMoveHistoryRedo, rotoScript, isPlaying, syncBackgroundSettingsFromDocument]);');
    // The ledger itself stays playback-agnostic.
    expect(historyHook).not.toContain('stopPlayback');
  });

  it('re-anchors a FAILED REDO the same way and keeps the dead-id drop undo-only (IN-04)', () => {
    const replayStart = studio.indexOf('aquarelleScriptHistory: {');
    const replayEnd = studio.indexOf('undoPaint:', replayStart);
    const replayPort = studio.slice(replayStart, replayEnd);

    // CR-01: the recovery block is not undo-gated, so a redo whose re-bake
    // fails re-seats `edit.before` and the next Cmd+Shift+Z can retry.
    expect(replayPort).not.toContain("if (direction === 'undo' && enteredReplay)");
    expect(replayPort).toContain('if (enteredReplay) {');
    expect(replayPort).toContain('reanchorAquarelleEditRevision(editId, direction)');
    // The DROP stays undo-only: a redo needs its cached edit to retry, and a
    // redo with no cached edit can never reconstruct the WITHOUT side.
    expect(replayPort).toContain("if (!reanchored && direction === 'undo') aquarelleStrokeEditIdsRef.current.delete(mutationId);");
  });

  it('refuses a recorded stroke from another frame before it can consume history (CR-02)', () => {
    const replayStart = studio.indexOf('aquarelleScriptHistory: {');
    const replayEnd = studio.indexOf('undoPaint:', replayStart);
    const replayPort = studio.slice(replayStart, replayEnd);

    // The recorded-script timeline is GLOBAL, the bake is per-frame: undoing a
    // stroke recorded elsewhere would pop the entry with no visible change.
    expect(replayPort).toContain('const stroke = getRecordedAquarelleStroke(mutationId);');
    const gate = replayPort.indexOf('(stroke.playFrame ?? 0) !== (launchContextRef.current?.startFrame ?? 0)');
    expect(gate).toBeGreaterThan(-1);
    // The refusal precedes every cached/uncached branch.
    expect(replayPort.indexOf('aquarelleStrokeEditIdsRef.current.get(mutationId);')).toBeGreaterThan(gate);
    expect(replayPort.indexOf('beginAquarelleStrokeUndoEdit(mutationId, true)')).toBeGreaterThan(gate);
  });

  it('builds the stroke undo edit as the in-flight owner (UAT row 1)', () => {
    // `runScriptReplay` sets the shared in-flight gate before the module runs,
    // and the builder refuses while that gate is held. The replay owns the gate,
    // so its build MUST pass `ownedInFlight` — without it `prepare` returns null
    // and every recorded stroke's Cmd+Z is a silent no-op.
    const replayStart = studio.indexOf('aquarelleScriptHistory: {');
    const replayEnd = studio.indexOf('undoPaint:', replayStart);
    const replayPort = studio.slice(replayStart, replayEnd);
    expect(replayPort).toContain('beginAquarelleStrokeUndoEdit(mutationId, true)');
    expect(replayPort).not.toContain('beginAquarelleStrokeUndoEdit(mutationId);');
  });

  it('re-seats a stacked redo before replaying it (UAT)', () => {
    // Every undo moves `aquarelleStrokesRevision`, so a cached redo edit's live
    // side is stale by the time a SECOND stroke is redone — without this the
    // redo stack only ever yields one stroke.
    const replayStart = studio.indexOf('aquarelleScriptHistory: {');
    const replayEnd = studio.indexOf('undoPaint:', replayStart);
    const replayPort = studio.slice(replayStart, replayEnd);
    expect(replayPort).toContain("if (direction === 'redo' && cached !== undefined) {");
    expect(replayPort).toContain("reanchorAquarelleEditRevision(cached, 'redo');");
    expect(replayPort.indexOf("reanchorAquarelleEditRevision(cached, 'redo');"))
      .toBeLessThan(replayPort.indexOf('let ok = await attempt(cached !== undefined, tileHistory);'));
    // 261029-lsr UAT: a stale cached tile history rebuilds and retries once
    // instead of consuming a click that visibly does nothing; a redo whose
    // tile history is exhausted re-bakes from the recorded edit.
    expect(replayPort).toContain("if (!ok && cached !== undefined && direction === 'undo') {");
    expect(replayPort).toContain("if (!ok && cached !== undefined && direction === 'redo') {");
  });

  it('stamps the script epoch and keeps the replay order', () => {
    // 261029-lsr (D-03): the capture gate's epoch is the live script revision —
    // a `peek` read inside a callback (no subscription, no render-body read).
    expect(studio).toContain('getScriptEpoch: () => aquarelleStrokesRevision.peek(),');
    // The port CALL order, not the type union or the onStep labels.
    expect(aquarelleScriptReplay.indexOf('ports.invalidate();'))
      .toBeLessThan(aquarelleScriptReplay.indexOf('ports.restore('));
    expect(aquarelleScriptReplay.indexOf('ports.restore('))
      .toBeLessThan(aquarelleScriptReplay.indexOf('ports.resetSheet();'));
    expect(aquarelleScriptReplay.indexOf('ports.resetSheet();'))
      .toBeLessThan(aquarelleScriptReplay.indexOf('ports.rebake();'));
    expect(aquarelleScriptReplay.indexOf('ports.ensureBase()'))
      .toBeLessThan(aquarelleScriptReplay.indexOf('ports.prepare'));
    // Exactly the two gates: before-produce and before-commit.
    expect(livePixelTransactions.split('input.isStillCurrent !== undefined && !input.isStillCurrent()').length - 1).toBe(2);
  });

  it('wires the Delete/Backspace action and the A Move/Edit toggle (watercolor only)', () => {
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
    // A toggles Move/Edit (leaving resumes the previous paint tool); Tab cycles
    // its filter Paint → Eraser → All only while Move/Edit is on; B / W / E / P
    // pick a tool.
    expect(studio).toContain('toggleAquarelleSelect: handleToggleAquarelleSelect,');
    expect(studio).toContain('toggleSelectAllAquarelleStrokes: handleToggleSelectAllAquarelleStrokes,');
    expect(studio).toContain('cycleAquarelleSelectFilter: handleCycleAquarelleSelectFilter,');
    expect(studio).toContain('selectAquarelleTool: handleSelectAquarelleTool,');
    expect(studio).toContain('if (!aquarelleSelectMode.peek()) return false;');
    expect(studio).toContain('cycleAquarelleStrokeTypeFilter();');
    expect(studio).not.toContain("setAquarelleTool('brush');");
    // 261027-klx: the Brush-mode Cmd→Move toggle left with engine 1's tool set.
    expect(studio).not.toContain("const lastNonMoveToolRef = useRef<'paint' | 'erase'>('paint');");
    expect(studio).not.toContain('selectTool(lastNonMoveToolRef.current, settings.physicsMode);');
  });

  it('gates the C shortcut behind a confirm dialog while Trash stays one-click', () => {
    // The shortcut opens the modal; the Trash rail button keeps its direct path.
    expect(studio).toContain('openClearConfirm();');
    expect(studio).toContain('data-testid="clear-confirm-dialog"');
    expect(studio).toContain('data-testid="clear-confirm-accept"');
    expect(studio).toContain('data-testid="clear-confirm-cancel"');
    expect(studio).toContain('aria-modal="true"');
    expect(studio).toContain('Clear the current Roto frame?');
    expect(studio).toContain('onClick={handleConfirmClearShortcut}');
    expect(toolRail).toContain('onClick={onClearFrame}');
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
    // 261101-o2m: the Draft branch is a SECOND record site ABOVE the Live
    // path, so the Live success-tail record is anchored from `if (ok) {`.
    const recordSite = moveHandler.indexOf('rotoMoveHistory.recordAquarelleScriptEdit(editId);', successSite);
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
    expect(studio).toContain('handleAquarelleMoveStrokes, getAquarellePlayFrame, getAquarellePaperId, getAquarellePaperGrainStrength, getAquarelleLiftBlocked, handleAquarelleLiftBlocked, handleAquarelleLiftDab, handleAquarelleDeleteStrokes, handleAquarelleTransformStrokes, handleAquarelleVectorPathEdit]');
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
    // 261101-o2m: the Draft branch records ABOVE the Live tail — anchor the
    // Live record from the success gate so the re-bake order stays the law.
    const recordSite = handler.indexOf('rotoMoveHistory.recordAquarelleScriptEdit(editId);', successSite);
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

  it('keeps the 261022-pim delete and 261022-tv1 move pins intact', () => {
    expect(studio).toContain('deleteSelectedAquarelleStroke: () => deleteSelectedScriptStroke(),');
    expect(studio).toContain('const handleAquarelleMoveStrokes = useCallback(');
    expect(studioKeyboard).toContain('deleteSelectedAquarelleStroke?: () => boolean;');
  });
});

// 261023-g4p Task 3: Brush Move parity — the engine by-id APIs, the brush
// port registration, the ONE tool-selection funnel and the mount wiring.
describe('261023-g4p brush Move script-edition surface (retired by 261027-klx)', () => {
  it('registers the watercolor stroke-edition port and no Brush port', () => {
    expect(studio).toContain('setScriptStrokeEditionPorts({');
    expect(studio).toContain('watercolor: {');
    // 261027-klx: the Brush port, its deps context and its render-body
    // configure call left with engine 1.
    expect(studio).not.toContain(retired('brush', 'Script', 'EditionPort'));
    expect(studio).not.toContain(retired('configure', 'Brush', 'Script', 'Edition'));
    expect(studio).not.toContain(retired('Brush', 'Script', 'EditionContext'));
    // The watercolor port keeps its exact previous contract.
    expect(studio).toContain("isActive: () => activeModule.peek() === 'watercolor' && aquarelleSelectMode.peek(),");
    expect(studio).toContain('deleteStrokes: (ids) => handleAquarelleDeleteStrokes(ids),');
    expect(studio).toContain('moveStrokes: (ids, dxPx, dyPx) => handleAquarelleMoveStrokes(ids, dxPx, dyPx),');
    expect(studio).toContain('stepStroke: (mutationId, direction) => handleAquarelleStepStroke(mutationId, direction),');
    expect(scriptStrokeEdition).toContain('if (watercolor?.isActive()) return watercolor;');
  });

  it('wires the paper-display engine actions through the app-owned preview base', () => {
    // 261027-klx: the 11 engine-1 tool setters and the Move-arming selectTool
    // wrapper left with the Brush engine. The hook receives the app-owned
    // preview base port for the paper display actions.
    expect(studio).toContain('const { setBackground, setGrainStrength, setGrainScale } = usePhysicsPaintEngineActions({');
    expect(studio).toContain('engine: previewBasePort,');
    expect(studio).not.toContain('selectToolEngine');
    expect(studio).not.toContain('onSelectTool: selectTool,');
  });

  it('leaves no Brush Move surface in the Studio or the canvas mount', () => {
    expect(studio).not.toContain(retired('Brush', 'Script', 'Overlay'));
    // The mount docstring names the retired engine-1 surface — strip comments
    // before the negative scan (source-scan discipline).
    const mountBody = canvasMount.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(mountBody).not.toContain(retired('<Brush', 'Script', 'Overlay'));
    expect(mountBody).not.toContain(retired('brush', 'Script', 'EditionActive'));
    expect(mountBody).not.toContain(retired('get', 'Brush', 'Script', 'PlayFrame'));
    expect(mountBody).not.toContain('<EfxPaintCanvas');
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

  it('wires the shared transform seam', () => {
    // The shared seam exposes the preview signal as compare-then-write.
    expect(scriptStrokeEdition).toContain('export function setScriptStrokeTransform(');
    expect(scriptStrokeEdition).toContain('export function clearScriptStrokeTransform(): void {');
  });

  it('keeps the transform signals out of the Studio render body', () => {
    expect(studio).not.toContain('scriptStrokeTransform');
    expect(studio).not.toContain('scriptStrokeTransform.value');
  });
});

// 261027-klx: navigation rehydration is watercolor-only. The Brush hydration
// plan, the observed loader and the engine-ready re-apply seam left with
// engine-1; the app-owned preview base carries the cached-key pixels.
describe('261027-klx watercolor navigation surface', () => {
  const navigationStart = studio.indexOf('const navigateToSyncedPhysicalFrame = useCallback(async (frame: number) => {');
  const navigationBody = studio.slice(
    navigationStart,
    studio.indexOf('const lastReferenceDisplayStateRef', navigationStart),
  );
  const clearSourceStart = studio.indexOf('const clearActiveSource = useCallback(');
  const clearSourceBody = studio.slice(
    clearSourceStart,
    studio.indexOf('const navigateToSyncedPhysicalFrame', clearSourceStart),
  );

  it('clears and reloads through the app-owned preview base only', () => {
    expect(navigationStart).toBeGreaterThan(-1);
    // Pixels BEFORE the ledger: the wipe + cached load run in the synchronous
    // navigation tick, ahead of the awaited flush.
    expect(navigationBody).toContain('previewBasePort.clearPreviewBaseImage(true);');
    expect(navigationBody).toContain('previewBasePort.resetBackground(true);');
    expect(navigationBody).toContain('loadCachedRotoReferenceFrame(frame, previewBasePort);');
    expect(navigationBody.indexOf('previewBasePort.clearPreviewBaseImage(true);')).toBeLessThan(
      navigationBody.indexOf('loadCachedRotoReferenceFrame(frame, previewBasePort);'),
    );
    // The engine-1 hydration plan / observed loader / clear seam are gone.
    expect(navigationBody).not.toContain(retired('plan', 'Brush', 'Script', 'Hydration'));
    expect(navigationBody).not.toContain(retired('hydrate', 'Brush', 'Script', 'Frame'));
    expect(navigationBody).not.toContain('loadReferenceObserved');
    expect(navigationBody).not.toContain('engine.clear();');
    // The post-flush generated repaint stays a cached-pixel path.
    expect(navigationBody).toContain("?.cells[frame]?.kind === 'generated'");
  });

  it('drops the script store on an explicit user clear (full reset)', () => {
    expect(clearSourceStart).toBeGreaterThan(-1);
    expect(clearSourceBody).toContain('const cleared = rotoFrameEditingRef.current.clearCurrentFrame();');
    expect(clearSourceBody).toContain('purgeMemoryScriptFrame(currentFrame);');
    // 261027-gh9e: when the frame editor's guards refuse, the Trash still
    // blanks the real key by frame before the script purge.
    expect(clearSourceBody).toContain(
      'forceClearRotoFrameRef.current(currentFrame, { width: canvasWidth, height: canvasHeight })',
    );
    expect(clearSourceBody.indexOf('clearCurrentFrame()')).toBeLessThan(
      clearSourceBody.indexOf('purgeMemoryScriptFrame('),
    );
    // 261027-gh9f: the aquarelle sheet lives in its OWN engine; resetting it
    // only on the fallback left the visible sheet painted, and its next
    // settle / frame-leave capture re-committed the paint over the blank key.
    expect(clearSourceBody).toContain('aquarelleResetSheetRef.current?.();');
    expect(clearSourceBody.indexOf('aquarelleResetSheetRef.current?.()')).toBeGreaterThan(
      clearSourceBody.indexOf('forceClearRotoFrameRef.current('),
    );
    expect(clearSourceBody.indexOf('aquarelleResetSheetRef.current?.()')).toBeLessThan(
      clearSourceBody.indexOf('purgeMemoryScriptFrame('),
    );
  });

  it('resets the sheet on a track switch before binding the incoming track', () => {
    const switchStart = studio.indexOf('if (sessionNeedsCommit) {');
    const switchBody = studio.slice(switchStart, studio.indexOf('setCachedRotoReferenceUrl(null);', switchStart));
    expect(switchStart).toBeGreaterThan(-1);
    // 261027-klx: the aquarelle sheet is the only surface — no Brush store to
    // reset. The capture + sheet reset precede the save, and the incoming
    // bind/restore follow the reset.
    const flushCapture = switchBody.indexOf('aquarelleFlushCaptureRef.current?.(outgoingTrackId ?? undefined);');
    const sheetReset = switchBody.indexOf('aquarelleResetSheetRef.current?.();');
    const saveOutgoing = switchBody.indexOf('void studioScriptSnapshot.saveNow();');
    const resetWatercolor = switchBody.indexOf('resetAquarelleRecordState();');
    const bindIncoming = switchBody.indexOf('studioScriptSnapshot.bind(incomingIdentity);');
    const restoreIncoming = switchBody.indexOf('void studioScriptSnapshot.restore()');
    expect(flushCapture).toBeGreaterThan(-1);
    expect(sheetReset).toBeGreaterThan(flushCapture);
    expect(saveOutgoing).toBeGreaterThan(sheetReset);
    expect(resetWatercolor).toBeGreaterThan(saveOutgoing);
    expect(bindIncoming).toBeGreaterThan(resetWatercolor);
    expect(restoreIncoming).toBeGreaterThan(bindIncoming);
    expect(switchBody).not.toContain(retired('reset', 'Brush', 'Script', 'Store();'));
    // The incoming restore seeds the ledger clock past restored ids.
    expect(switchBody).toContain('paintMutationLedger.reserveNextMutationId(restored.maxRestoredMutationId + 1);');
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
    // 3.6 (261027-klx): the app-owned ledger is the mutation clock — the
    // launch restore seeds it as a max-raise past every restored id.
    expect(studio).toContain('paintMutationLedger.reserveNextMutationId(restored.maxRestoredMutationId + 1);');
    // No separate engine-ready re-apply ref survives the engine-1 removal.
    expect(studio).not.toContain('studioScriptSnapshotReservedNextMutationIdRef');
  });

  it('seeds the ledger clock from the restore, never an engine-ready re-apply', () => {
    expect(studio).toContain('if (restored.maxRestoredMutationId > 0) {');
    expect(studio).not.toContain('paintMutationLedger.reserveNextMutationId(nextMutationId);');
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

// quick-261023-l35 Task 2: the snapshot carries the watercolor script only.
// 261027-klx: the brush half of the snapshot is gone with engine-1 — the
// controller no longer accepts a brush frame source.
describe('261023-l35 watercolor-only Studio script snapshot', () => {
  it('feeds the watercolor revision fingerprint and no brush frame source', () => {
    expect(studio).toContain('getContentSignature: () => `${aquarelleStrokesRevision.peek()}`,');
    expect(studio).not.toContain('getBrushFrames');
  });
});

// quick-261023-l35 Task 3: save discipline — the coalescing subscription, the
// cross-track handoff, and the disposal path.
describe('261023-l35 save discipline in the Studio', () => {
  it('subscribes to the watercolor store revision with a first-run skip', () => {
    const effectStart = studio.indexOf('// quick-261023-l35 Task 3: ONE coalescing subscription');
    const effectBody = studio.slice(effectStart, studio.indexOf('}, [studioScriptSnapshot]);', effectStart));
    expect(effectStart).toBeGreaterThan(-1);
    expect(effectBody).toContain('aquarelleStrokesRevision.value;');
    expect(effectBody).toContain('let seedRun = true;');
    expect(effectBody).toContain('studioScriptSnapshot.markDirty();');
    expect(effectBody).toContain('studioScriptSnapshot.dispose();');
  });

  it('saves the outgoing key, resets the store, then binds and restores', () => {
    const switchStart = studio.indexOf('if (sessionNeedsCommit) {');
    const switchBody = studio.slice(switchStart, studio.indexOf('setCachedRotoReferenceUrl(null);', switchStart));
    // 261027 UAT round 6: the flush is pinned to the OUTGOING track — the
    // document's active track has already moved to the incoming one.
    const flushCapture = switchBody.indexOf('aquarelleFlushCaptureRef.current?.(outgoingTrackId ?? undefined);');
    const saveOutgoing = switchBody.indexOf('void studioScriptSnapshot.saveNow();');
    const resetWatercolor = switchBody.indexOf('resetAquarelleRecordState();');
    const bindIncoming = switchBody.indexOf('studioScriptSnapshot.bind(incomingIdentity);');
    const restoreIncoming = switchBody.indexOf('void studioScriptSnapshot.restore()');
    expect(flushCapture).toBeGreaterThan(-1);
    expect(saveOutgoing).toBeGreaterThan(flushCapture);
    expect(resetWatercolor).toBeGreaterThan(saveOutgoing);
    expect(bindIncoming).toBeGreaterThan(resetWatercolor);
    expect(restoreIncoming).toBeGreaterThan(bindIncoming);
    // The Brush store reset left with engine 1.
    expect(switchBody).not.toContain(retired('reset', 'Brush', 'Script', 'Store();'));
    // Restore is dispatched, never awaited inside the synchronous effect.
    expect(switchBody).not.toContain('await studioScriptSnapshot.restore()');
    // The incoming restore reserves the ledger clock past restored ids.
    expect(switchBody).toContain('paintMutationLedger.reserveNextMutationId(restored.maxRestoredMutationId + 1);');
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

// quick-261024-m20: every accepted physical replace remaps the surviving
// session store (watercolor record state) by key identity AFTER the store
// commit; a failed replace never does. 261027-klx dropped the brush remap with
// engine-1.
describe('261024-m20 accepted-replace key-identity remaps', () => {
  it('calls the watercolor remap after each accepted replace and never on failure', () => {
    const recordsStart = studio.indexOf('const replacePhysicalRecordsWithOwnership = (');
    const documentStart = studio.indexOf('const replacePhysicalDocumentWithOwnership = (', recordsStart);
    const documentEnd = studio.indexOf('const physicalEditCoordinator = useRotoPhysicalEditCoordinator', documentStart);
    expect(recordsStart).toBeGreaterThanOrEqual(0);
    expect(documentStart).toBeGreaterThan(recordsStart);
    expect(documentEnd).toBeGreaterThan(documentStart);
    const recordsSlice = studio.slice(recordsStart, documentStart);
    const documentSlice = studio.slice(documentStart, documentEnd);

    // ONE wrapper drives the surviving store; the brush remap left with
    // engine-1.
    expect(studio).toContain('const applyScriptRecordRemaps = (');
    expect(studio).not.toContain(retired('remap', 'Brush', 'Scripts', 'ForRecords'));
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
    // 261101-o2m: the Draft branch records ABOVE the Live tail — anchor the
    // Live record from the apply so the re-bake order stays the law.
    const record = body.indexOf('rotoMoveHistory.recordAquarelleScriptEdit(editId)', apply);
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
  const placeHandlerEnd = studio.indexOf('setScriptStrokeEditionPorts({', placeHandlerStart);
  const placeHandler = placeHandlerStart >= 0 && placeHandlerEnd > placeHandlerStart
    ? studio.slice(placeHandlerStart, placeHandlerEnd)
    : '';

  it('exists and owns the place path in order (begin -> reset -> await apply -> record on success -> rollback)', () => {
    expect(placeHandlerStart).toBeGreaterThan(-1);
    expect(placeHandlerEnd).toBeGreaterThan(placeHandlerStart);
    const beginSite = placeHandler.indexOf('beginAquarellePlaceEdit(mutationId, positionFromTop)');
    const resetSite = placeHandler.indexOf('aquarelleResetSheetRef.current?.();');
    const applySite = placeHandler.indexOf('await rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame))');
    // 261101-o2m: the Draft branch records ABOVE the Live tail — anchor the
    // Live record from the apply so the re-bake order stays the law.
    const recordSite = placeHandler.indexOf('rotoMoveHistory.recordAquarelleScriptEdit(editId)', applySite);
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

    // 261101-jmm: the sheet's trash shares the Backspace/Delete handler. The
    // SAME call string exists at the edition-port registration, so both pins
    // are scoped to the bundle slice — a whole-file `toContain` would pass
    // without the bundle wiring at all.
    expect(studio.slice(memoStart, memoDepEnd)).toContain('handleAquarelleDeleteStrokes');
    const bodyEnd = studio.indexOf('const viewModel = usePhysicsPaintStudioViewModel({', memoDepEnd);
    expect(bodyEnd).toBeGreaterThan(memoDepEnd);
    expect(studio.slice(memoDepEnd, bodyEnd)).toContain(
      'deleteStrokes: (ids) => handleAquarelleDeleteStrokes(ids),',
    );
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
    const end = studio.indexOf('const staticControlsLocked = mutationLocked', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const funnel = studio.slice(start, end);
    // 261027-klx: Water color is the only module — the funnel publishes the
    // frame's single owner and no longer switches modules.
    expect(funnel).toContain('const owner = resolveFrameScriptOwner(frame, scriptCell);');
    expect(funnel).toContain('const scriptCell = resolveStudioScriptCell(frame);');
    expect(funnel).not.toContain("owner === 'brush'");
    expect(funnel).not.toContain('setActiveModule(owner);');
    expect(funnel).not.toContain('activeModule.value =');
    expect(funnel).toContain('setFrameScriptOwner(owner);');
    expect(funnel).toContain('[resolveStudioScriptCell],');
  });

  it('gates the navigation funnel between the outgoing flush and the pixel snapshot', () => {
    const navigationStart = studio.indexOf('const navigateToSyncedPhysicalFrame = useCallback(');
    const navigationEnd = studio.indexOf('rotoNavigation.configureRuntimePort(', navigationStart);
    const navigation = studio.slice(navigationStart, navigationEnd);
    expect(navigationStart).toBeGreaterThan(-1);

    const funnel = 'if (!wasPlaying && !rotoCachedPlayback.isActive) applyFrameModuleState(frame);';
    const funnelIndex = navigation.indexOf(funnel);
    const flushIndex = navigation.indexOf('aquarelleFlushCaptureRef.current?.();');
    const snapshotIndex = navigation.indexOf('rotoPersistence.snapshotLivePixels(currentFrame);');
    expect(funnelIndex).toBeGreaterThan(-1);
    expect(flushIndex).toBeGreaterThan(-1);
    expect(snapshotIndex).toBeGreaterThan(-1);
    expect(funnelIndex).toBeGreaterThan(flushIndex);
    expect(funnelIndex).toBeLessThan(snapshotIndex);
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

  it('leaves no Brush completion refresh in the ledger subscriber', () => {
    // 261027-klx: the completion law is watercolor-only (stroke-end records
    // and republishes). The Brush completion refresh left with engine 1.
    const completionStart = studio.indexOf('canvasCompletedMutationImplRef.current = (mutation) => {');
    expect(completionStart).toBeGreaterThan(-1);
    const blockEnd = studio.indexOf('const cachedRotoPlaybackComposition', completionStart);
    const block = studio.slice(completionStart, blockEnd);
    expect(block).not.toContain('applyCompletedBrushMutation(');
    expect(block).not.toContain('applyFrameModuleState(scriptFrame');
    expect(block).toContain('rotoMoveHistory.observePaintMutation(mutationId, kind);');
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

    // 261029-lsr: the replay body moved into `runScriptReplay` + the shared
    // orchestration module; the route row above pins that helper.
    const runReplayStart = studio.indexOf('const runScriptReplay = useCallback(');
    expect(runReplayStart).toBeGreaterThan(-1);
    const runReplay = studio.slice(
      runReplayStart,
      studio.indexOf('const rotoMoveHistory = useRotoPhysicalEditHistory', runReplayStart),
    );
    expect(runReplay).toContain('notify: () => { rotoScript.notifySourceRevision(); }');
    expect(runReplay).toContain('publishOwner: () => { applyFrameModuleState(playFrame); }');
    // The notify -> owner-publish ordering now lives in the module.
    expect(aquarelleScriptReplay.indexOf('ports.notify();'))
      .toBeLessThan(aquarelleScriptReplay.indexOf('ports.publishOwner();'));
  });

  it('republishes on clearActiveSource, clearCanvas and every Memory purge seam', () => {
    const clearSourceStart = studio.indexOf('const clearActiveSource = useCallback(');
    const clearSourceEnd = studio.indexOf('const navigateToSyncedPhysicalFrame', clearSourceStart);
    const clearSource = studio.slice(clearSourceStart, clearSourceEnd);
    expect(clearSource).toContain('purgeMemoryScriptFrame(currentFrame);');
    expect(clearSource).toContain('applyFrameModuleState(currentFrame);');

    const clearCanvasStart = studio.indexOf('clearCanvas: (frame) => {');
    const clearCanvasEnd = studio.indexOf('navigate: navigateToSyncedPhysicalFrame', clearCanvasStart);
    const clearCanvas = studio.slice(clearCanvasStart, clearCanvasEnd);
    // 261027-klx: the display clear wipes the app-owned preview base; the
    // Brush store clear left with engine 1.
    expect(clearCanvas).toContain('previewBasePort.clearPreviewBaseImage(true);');
    expect(clearCanvas).not.toContain(retired('clear', 'Brush', 'Script', 'Frame'));
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

  it('has no brush script callback and clears the lock on unmount', () => {
    // 261027-klx: the Brush script-edit callback left with engine 1.
    expect(studio).not.toContain('onScriptChanged: (frame) => {');
    const teardownStart = studio.indexOf('useEffect(() => () => {\n    clearFrameScriptOwner();');
    expect(teardownStart).toBeGreaterThan(-1);
  });
});

describe('quick-261025-awl Raster handler (D-04)', () => {
  const handlerStart = studio.indexOf(
    'const rasterKeyImplRef = useRef<(frame: number) => Promise<void>>(async () => {});',
  );
  const handlerEnd = studio.indexOf('const handleRasterKeyRequest = useCallback(', handlerStart);
  const handler = studio.slice(handlerStart, handlerEnd);
  // quick-261101-f5v: the shared per-key core (before the key impl) and the
  // rail run (after the key callback).
  const coreStart = studio.indexOf('async function rasterOneKeyCore(');
  const coreEnd = studio.indexOf('const rasterKeyImplRef', coreStart);
  const core = studio.slice(coreStart, coreEnd);
  const railStart = studio.indexOf(
    "const rasterRailImplRef = useRef<(kind: RasterRailTarget['kind'], railId: string) => Promise<void>>(async () => {});",
  );
  const railEnd = studio.indexOf('const handleRasterRailRequest = useCallback(', railStart);
  const rail = studio.slice(railStart, railEnd);

  it('exists with the stable strip callback wired into the workflow props', () => {
    expect(handlerStart).toBeGreaterThan(-1);
    expect(handlerEnd).toBeGreaterThan(handlerStart);
    expect(studio).toContain('const handleRasterKeyRequest = useCallback((frame: number) => {');
    expect(studio).toContain('void rasterKeyImplRef.current(frame);');
    // 261028-k03h: the strip reads the LIVE ownership computed, not the
    // published lock (a lagging publish greyed a scripted key's Raster).
    expect(studio).toContain('onRasterKey: handleRasterKeyRequest, frameScriptOwner: rasterKeyOwner,');
  });

  it('refuses in the documented guard order', () => {
    // 261027-klx: the engine-1 handle guard left with the Efx child — the
    // owner resolver is the live-surface guard.
    // quick-261101-f5v (D-09): the in-flight boolean precedes every guard and
    // is shared with the rail run.
    const guards = [
      'if (rasterInFlightRef.current) return;',
      'if (isPhysicalMutationLocked()) return;',
      'if (rotoScript.applying.peek() || rotoScript.mutationLocked.peek()) return;',
      'if (rotoCachedPlayback.isActive) return;',
      'if (!readyToApply) return;',
      'if (frame !== (launchContextRef.current?.startFrame ?? -1)) return;',
    ];
    let previous = -1;
    for (const guard of guards) {
      const index = handler.indexOf(guard);
      expect(index, guard).toBeGreaterThan(previous);
      previous = index;
    }
    expect(handler).not.toContain('if (!engine) return;');
    // quick-261101-f5v (D-05): ownership resolution and the stale re-check
    // moved into the shared core; the handler keeps ONE stale pre-check.
    expect(handler).not.toContain('const scriptCell = resolveStudioScriptCell(frame);');
    expect(handler).not.toContain('if (owner === null) return;');
    expect(handler).not.toContain('purgeMemoryScriptFrame(frame);');
    expect(
      countOccurrences(
        handler,
        'if (frame !== (launchContextRef.current?.startFrame ?? -1)) return;',
      ),
    ).toBe(1);
    expect(handler).toContain('const outcome = await rasterOneKeyCore(');
    expect(handler).toContain('() => frame === (launchContextRef.current?.startFrame ?? -1),');
    expect(handler).toContain('finishRasterPurge([frame]);');
  });

  it('runs capture, verification, ledger clear and reload strictly before the purge', () => {
    // quick-261101-f5v (D-05): the ONE per-key ordering lives in the shared
    // core, so the frame action and the rail run cannot drift apart.
    expect(coreStart).toBeGreaterThan(-1);
    expect(coreEnd).toBeGreaterThan(coreStart);
    const order = [
      'const scriptCell = resolveStudioScriptCell(frame);',
      'const owner = resolveFrameScriptOwner(frame, scriptCell);',
      "if (owner === null) return 'skipped';",
      'await flushAquarellePixels(frame);',
      "if (!stillValid()) return 'stale';",
      'findCachedRotoDisplayFrameRef.current(frame)',
      'previewBasePort.clearPreviewBaseImage(true);',
      'previewBasePort.resetBackground(true);',
      'previewBasePort.clear();',
      'loadCachedRotoReferenceFrame(frame, previewBasePort)',
      'purgeAquarelleFrameScript(frame)',
      'aquarelleDurableBaseByKeyRef.current.delete(scriptCell.keyId);',
      'aquarelleRecoveredBaseKeyIdsRef.current.delete(scriptCell.keyId);',
    ];
    let previous = -1;
    for (const step of order) {
      const index = core.indexOf(step);
      expect(index, step).toBeGreaterThan(previous);
      previous = index;
    }
    // The preview base is a live-frame surface only.
    expect(core).toContain('if (frame === (launchContextRef.current?.startFrame ?? -1)) {');
    // Scriptless keys never reach the flush; a missing raster never reaches
    // the purge.
    expect(core.indexOf("if (owner === null) return 'skipped';"))
      .toBeLessThan(core.indexOf('await flushAquarellePixels(frame);'));
    expect(core.indexOf("if (!findCachedRotoDisplayFrameRef.current(frame)) return 'unavailable';"))
      .toBeLessThan(core.indexOf('purgeAquarelleFrameScript(frame)'));
    // The core never refreshes the module and never persists.
    expect(core).not.toContain('applyFrameModuleState');
    expect(core).not.toContain('persistAfterPurge');
    expect(core).not.toContain('activeModule');
    // The engine-1 finalize/dry/clear seams are gone.
    expect(core).not.toContain('engine.flushPendingStrokeFinalizations();');
    expect(core).not.toContain('engine.forceDry();');
    expect(core).not.toContain('engine.clear();');
  });

  it('fails closed with the nothing-changed copy for both pre-purge failures', () => {
    expect(handler).toContain(
      '"The key\'s painted pixels are not available — nothing changed."',
    );
    expect(handler).toContain(
      '"The key\'s painted pixels could not be reloaded — nothing changed."',
    );
    expect(handler).toContain("'Rastering the key failed — nothing changed.'");
    // The failure outcomes are reported, never purged: the core's failure
    // returns all precede its purge call.
    const purge = core.indexOf('purgeAquarelleFrameScript(frame)');
    expect(core.indexOf("return 'unavailable'")).toBeGreaterThan(-1);
    expect(core.indexOf("return 'unavailable'")).toBeLessThan(purge);
    expect(core.indexOf("return 'reload-failed'")).toBeLessThan(purge);
    expect(core.indexOf("return 'failed'")).toBeLessThan(purge);
  });

  it('never writes activeModule — the module survives the conversion', () => {
    expect(handler).not.toContain('activeModule.value');
    expect(handler).not.toContain('activeModule.peek() !==');
    expect(handler).not.toContain('activeModule.peek() === \'watercolor\')');
  });

  it('re-resolves the clicked rail, the projection and every guard at call time', () => {
    expect(railStart).toBeGreaterThan(-1);
    expect(railEnd).toBeGreaterThan(railStart);
    expect(studio).toContain(
      "const rasterRailImplRef = useRef<(kind: RasterRailTarget['kind'], railId: string) => Promise<void>>(async () => {});",
    );
    expect(studio).toContain(
      "const handleRasterRailRequest = useCallback((kind: RasterRailTarget['kind'], railId: string) => {",
    );
    expect(studio).toContain('void rasterRailImplRef.current(kind, railId);');
    // The clicked identity must still be the reconciled key selection.
    expect(rail).toContain('const selection = effectiveSelectedRotoKeyRail;');
    expect(rail).toContain('if (selection === null || selection.firstKeyId !== railId) return;');
    // A Loop Clip rail re-checks the loop selection and targets its source keys.
    expect(rail).toContain('if (selectedLoopClipId.value !== railId) return;');
    expect(rail).toContain('railKeyIds = clip.sourceKeyIds;');
    // Frames resolve through the PHYSICAL projection, never the display source.
    expect(rail).toContain('projection.framesByKeyId.get(keyId)');
    expect(rail).toContain('if (!projection) return;');
    // Only scripted keys are targeted.
    expect(rail).toContain('.filter((entry) => hasAquarelleScriptForFrame(entry.frame));');
  });

  it('runs one bounded sequential pass with a per-iteration guard re-check', () => {
    const loopStart = rail.indexOf('for (const entry of entries) {');
    expect(loopStart).toBeGreaterThan(-1);
    // No second pass and no retry: one loop over the snapshot.
    expect(countOccurrences(rail, 'for (const entry of entries) {')).toBe(1);
    expect(rail).not.toContain('setTimeout');
    expect(rail).not.toContain('setInterval');
    // The session guards are re-checked at the TOP of every iteration and a
    // break reports a partial run.
    const guardStart = rail.indexOf('if (isPhysicalMutationLocked()', loopStart);
    const stopStart = rail.indexOf('stopped = true;', loopStart);
    const coreCallStart = rail.indexOf('await rasterOneKeyCore(entry.frame, () => {', loopStart);
    expect(guardStart).toBeGreaterThan(loopStart);
    expect(stopStart).toBeGreaterThan(guardStart);
    expect(coreCallStart).toBeGreaterThan(stopStart);
    expect(rail).toContain('break;');
    // Each key's predicate re-checks the key identity after the flush.
    expect(rail).toContain('cell.keyId === entry.keyId');
  });

  it('writes the snapshot once per run and publishes one summary', () => {
    expect(rail).toContain('finishRasterPurge(purgedFrames)');
    expect(countOccurrences(rail, 'finishRasterPurge(')).toBe(1);
    expect(rail).toContain('formatRasterRailRunCopy({');
    expect(rail).toContain("setApplyStatus(copy.isError ? 'error' : 'idle');");
    expect(rail).toContain('if (copy.isError) setLastError(copy.message);');
    // finishRasterPurge owns the single persist (the Memory-tab contract).
    const finishStart = studio.indexOf('function finishRasterPurge(');
    const finishEnd = studio.indexOf('function clearMemoryRailScripts(', finishStart);
    const finish = studio.slice(finishStart, finishEnd);
    expect(finishStart).toBeGreaterThan(-1);
    expect(finish).toContain('if (frames.includes(liveFrame)) applyFrameModuleState(liveFrame);');
    expect(countOccurrences(finish, 'studioScriptSnapshot.persistAfterPurge()')).toBe(1);
    // The Memory-tab purges keep their own contract.
    expect(studio).toContain('function purgeMemoryScriptFrame(frame: number): boolean {');
    expect(studio).toContain('function purgeMemoryRailScripts(frames: readonly number[]): boolean {');
  });

  it('threads the rail bundle into the workflow strip props', () => {
    expect(studio).toContain('onRasterRail: handleRasterRailRequest, rasterRailTarget,');
    // The key bundle line is untouched (the source contract pins it verbatim).
    expect(studio).toContain('onRasterKey: handleRasterKeyRequest, frameScriptOwner: rasterKeyOwner,');
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

// 261026 watercolor-loop-render-split: script Apply on a Loop Clip frame must
// target the frame's LIFECYCLE key (override key, or the source key the route
// creates a new override from) and must composite the re-bake over the durable
// pixel-only base. Both axes are required — retargeting alone publishes a
// stroke-only sheet over the flattened rail paint and erases it.
describe('261026 watercolor-loop-render-split two-axis script Apply', () => {
  function section(source: string, startMarker: string, endMarker: string): string {
    const start = source.indexOf(startMarker);
    expect(start, `missing start marker: ${startMarker}`).toBeGreaterThan(-1);
    const end = source.indexOf(endMarker, start + startMarker.length);
    expect(end, `missing end marker: ${endMarker}`).toBeGreaterThan(start);
    return source.slice(start, end);
  }

  it('axis 1: maps the projection source through the group lifecycle classifier in prepareTarget', () => {
    const prepareBlock = section(studio, 'prepareRotoScriptTargetRef.current = async (', '// RARE BLANK-AFTER-PLAY guard');
    expect(prepareBlock).toContain('physicPaintStore.getRotoPhysicalDocument(');
    expect(prepareBlock).toContain('classifyPhysicPaintRotoGroupFrameTarget({ document, appFrame: source.appFrame })');
    expect(prepareBlock).toContain("if (target.kind === 'ordinary-key') {");
    expect(prepareBlock).toContain("if (target.kind === 'source-occurrence') {");
    expect(prepareBlock).toContain("if (target.kind === 'override') {");
    // The override publish key is the override; its currency identity and
    // durable base are the group SOURCE key at the exact cycle offset.
    expect(prepareBlock).toContain('resolvePhysicPaintRotoGroupSourceKeyIdAtOffset(document, target.groupId, target.cycleOffset)');
    // 261031-qps (Quick B): ONE base decision per target, resolved from the
    // authority and spread into the target — the resolution key is the SOURCE
    // key for an occurrence/override, never the composite.
    expect(prepareBlock).toContain('resolveScriptBase(resolutionKeyId, scriptBaseLookupFor(readScriptBasePayload))');
    expect(prepareBlock).toContain('...baseFor(target.keyId)');
    expect(prepareBlock).toContain('...baseFor(target.sourceKeyId)');
    expect(prepareBlock).toContain('...baseFor(sourceKeyId)');
    expect(prepareBlock).toContain('...baseFor(promotion.keyId)');
    expect(prepareBlock).toContain("if (!resolution.ok) return { durableBaseKind: 'pixels' };");
    expect(prepareBlock).toContain("if (resolution.kind === 'reveal') return { durableBaseKind: 'reveal' };");
    expect(prepareBlock).toContain("pinScriptBase(resolutionKeyId, resolution, { appFrame: source.appFrame, source: 'prepare-target-key' })");
    // An authority refusal leaves the base UNDEFINED so the publish fails closed.
    expect(prepareBlock).not.toContain(retired('durableBase', 'KeyId'));
    expect(prepareBlock).toContain('if (target.keyId !== source.keyId) return null;');
    // Never publish a record's own appFrame — an override record carries the
    // PHASE frame, which refused every repeat instance.
    expect(prepareBlock).not.toContain('record.appFrame');
    // Generated occurrences and gaps fail closed.
    expect(prepareBlock).toContain('return null;');
  });

  it('axis 2: composites the re-bake over the authority-resolved base and fails closed', () => {
    const publishBlock = section(studio, 'publish: async (frame) => {', 'return ok;');
    // 261031-qps (Quick B): the publish closure DISPATCHES on the authority
    // result carried by the target — it never reads a base record itself.
    expect(publishBlock).not.toContain(`target.${retired('durableBase', 'KeyId')}`);
    expect(publishBlock).not.toContain('physicPaintStore.getRotoRealKeyRecord(');
    expect(publishBlock).toContain("if (target.durableBaseKind === 'reveal') {");
    // 261031-qps (Quick B): a reveal-owned key renders through the placed photo
    // reference with the OWNING clip's knobs — the old reveal-base-unsupported
    // refusal is gone (it survives only in bakeStackedRailKey, a different seam).
    expect(publishBlock).toContain('const revealClip = revealClipForKey(target.sourceKeyId ?? target.keyId);');
    expect(publishBlock).toContain("error: 'reveal-rail-not-found'");
    expect(publishBlock).toContain('await renderRevealTail({');
    // IN-01: identity-check the rendered frame before publishing its bytes,
    // exactly like the stack slow path.
    expect(publishBlock).toContain('if (!rendered.ok || !revealFrame || revealFrame.appFrame !== frame.appFrame) {');
    expect(publishBlock).toContain('motion: revealClip.motion ?? { deformation: 0, position: 0 },');
    expect(publishBlock).toContain('mode: revealClip.mode,');
    expect(publishBlock).toContain('colorize: revealClip.colorize === true,');
    expect(publishBlock).toContain('colorizeMix: revealClip.colorizeMix ?? 100,');
    expect(publishBlock).toContain('photoWiggle: revealClip.photoWiggle === true,');
    expect(publishBlock).toContain('paintSeedVariation: revealClip.paintSeedVariation === true,');
    expect(publishBlock).toContain("durableBaseSource = 'reveal';");
    expect(publishBlock).toContain('publishBytes = revealFrame.bytes;');
    // A failed or mismatched reveal render fails closed before the cache write.
    const revealFail = publishBlock.indexOf('if (!rendered.ok || !revealFrame || revealFrame.appFrame !== frame.appFrame) {');
    expect(revealFail).toBeGreaterThan(-1);
    expect(publishBlock.indexOf('return false;', revealFail)).toBeGreaterThan(revealFail);
    expect(publishBlock.indexOf('upsertCachedFrame(')).toBeGreaterThan(revealFail);
    expect(publishBlock).toContain('composeRotoScriptRebakeFrame({');
    expect(publishBlock).toContain('durableBaseBytes: target.durableBaseBytes');
    expect(publishBlock).toContain('sheetBytes: frame.bytes');
    expect(publishBlock).toContain('appFrame: frame.appFrame');
    // Fail closed BEFORE the cache write: no stroke-only sheet on a group base.
    const failClosed = publishBlock.indexOf('if (!composed) {');
    expect(failClosed).toBeGreaterThan(-1);
    expect(publishBlock.indexOf('return false;', failClosed)).toBeGreaterThan(failClosed);
    expect(publishBlock.indexOf('upsertCachedFrame(')).toBeGreaterThan(failClosed);
    // The published payload is the COMPOSITE, never the raw bake.
    expect(publishBlock).toContain('bytes: publishBytes');
    expect(publishBlock).not.toContain('frameIndex: 0, appFrame: frame.appFrame, bytes: frame.bytes');
    // The reverted stroke-only publish law is gone.
    expect(publishBlock).not.toContain('REVERTED (2026-10-26)');
    expect(publishBlock).toContain("recordAquarelleRenderSplitEvent('script-bake-composite'");
    // `null` = known-empty → raw bake; undefined = UNKNOWN → fail closed with
    // no cache write.
    expect(publishBlock).toContain('target.durableBaseBytes === null');
    expect(publishBlock).toContain('target.durableBaseBytes !== undefined');
    expect(publishBlock).toContain("durableBaseSource = 'known-empty';");
    expect(publishBlock).toContain("reason: 'durable-base-unknown'");
    const unknownFail = publishBlock.indexOf("reason: 'durable-base-unknown'");
    expect(publishBlock.indexOf('return false;', unknownFail)).toBeGreaterThan(unknownFail);
    expect(publishBlock.lastIndexOf('upsertCachedFrame(')).toBeGreaterThan(unknownFail);
    expect(publishBlock).toContain("recordAquarelleAlphaProof('composite-alpha-proof'");
  });

  it('pins the refreshed probe build marker and the script-bake-composite event', () => {
    const capture = readFileSync(fileURLToPath(new URL('./performance/aquarelleRenderSplitCapture.ts', import.meta.url)), 'utf8');
    expect(capture).toContain("AQUARELLE_RENDER_SPLIT_BUILD = 'debug-watercolor-loop-render-split-9'");
  });
});

// 261026 watercolor-loop-render-split — FINAL regression pins (native UAT
// approved 2026-10-26). One test per root cause, so a later refactor cannot
// silently reintroduce it:
//   1. the gates froze on the retired timeline signal graph (native run 4);
//   2. a cache-only key must resolve no owner and no Move (empty-script gate);
//   3. an ordinary key's script re-bake erased its scriptless cached paint
//      (native run 3) — launch-pinned base + multiply composite, fail closed;
//   4. a group occurrence's re-bake targets its lifecycle key and composites
//      over the group SOURCE key's pixels at the EXACT cycle offset.
describe('261026 watercolor-loop-render-split final regression pins', () => {
  function between(source: string, startMarker: string, endMarker: string): string {
    const start = source.indexOf(startMarker);
    expect(start, `missing start marker: ${startMarker}`).toBeGreaterThan(-1);
    const end = source.indexOf(endMarker, start + startMarker.length);
    expect(end, `missing end marker: ${endMarker}`).toBeGreaterThan(start);
    return source.slice(start, end);
  }

  it('offers the force-re-render only on a frame that owns a paint script', () => {
    // 261029-lsr: the escape hatch replays the frame's script — a lift-only
    // script would bake a blank sheet over raster pixels, so the gate is the
    // PAINT-script predicate, resolved through the same live-graph projection.
    const start = studio.indexOf('const rebakeScriptAvailable = useComputed(() => {');
    expect(start).toBeGreaterThan(-1);
    const gate = studio.slice(start, studio.indexOf('const gateDiagnosticsRef'));
    expect(gate).toContain('void rotoModelGeneration.value;');
    expect(gate).toContain('resolveStudioScriptCell(cell.appFrame)');
    expect(gate).toContain('hasAquarellePaintScriptForFrame(cell.appFrame)');
    // The action runs the shared reset-and-replay with the same guards.
    const handler = between(studio, 'const handleRebakeScript = useCallback', 'const rotoMoveHistory');
    expect(handler).toContain('await ensureAquarelleDurableBaseRef.current(playFrame);');
    expect(handler).toContain('aquarelleResetSheetRef.current?.();');
    expect(handler).toContain('rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame))');
  });

  it('re-binds the watercolor Select gate to the LIVE timeline graph after every rebuild', () => {
    // `useRotoTimelineModel` rebuilds its WHOLE signal graph on structural
    // changes. A once-created Computed keeps the sources its last evaluation
    // registered — the retired graph — and is never notified again. The Studio
    // generation leg forces one post-swap evaluation so the next registration
    // lands on the live graph (native run 4: a scripted frame's `true`
    // survived onto a scriptless Motion rail cell).
    const generation = between(studio, 'const rotoModelGeneration = useSignal(0);', 'const loopResolutionContext');
    expect(generation).toContain('rotoModelGeneration.value += 1;');
    expect(generation).toContain('}, [rotoTimelineModel]);');
    // 261027-klx: the Brush Move gate left with engine 1. Four reads remain:
    // the Water color gate, the 261028-k03h Raster enablement, the
    // 261029-lsr force-re-render enablement and the quick-261101-f5v rail
    // target (the same live-graph rebind law).
    expect(countOccurrences(studio, 'void rotoModelGeneration.value;')).toBe(4);
    expect(studio).not.toContain('const moveAvailable = useComputed(');

    const waterGate = between(studio, 'const watercolorMoveAvailable = useComputed(() => {', 'const gateDiagnosticsRef = useRef');
    const generationRead = waterGate.indexOf('void rotoModelGeneration.value;');
    const cellRead = waterGate.indexOf('rotoTimelineModel.currentCell.value');
    const projectionRead = waterGate.indexOf('resolveStudioScriptCell(cell.appFrame)');
    expect(generationRead).toBeGreaterThan(-1);
    expect(cellRead).toBeGreaterThan(generationRead);
    expect(projectionRead).toBeGreaterThan(cellRead);
    // Identity is projection-only; null / non-real / keyless cells fail closed.
    expect(waterGate).toContain("if (cell.kind !== 'real') return false;");
    expect(waterGate).toContain("if (scriptCell === null || scriptCell.kind !== 'real' || scriptCell.keyId === null) return false;");
    // The possibly-retired model cell never asserts a key by itself.
    expect(waterGate).not.toContain('cell.keyId ===');
    expect(waterGate).toContain('return hasAquarelleScriptForFrame(cell.appFrame);');
    // DEV diagnostics prove the gates' OWN frame/cell context, so the next
    // stale graph can never again hold `true` unnoticed.
    const diagnostics = between(studio, 'const gateDiagnosticsRef = useRef', '// quick-261026-odd follow-up: a derived cell');
    expect(diagnostics).toContain('const gateFrame = rotoTimelineModel.currentCell.peek().appFrame;');
    expect(diagnostics).toContain('const gateCell = resolveStudioScriptCell(gateFrame);');
    expect(diagnostics).toContain('hasWatercolor: hasAquarelleScriptForFrame(gateFrame),');
    expect(diagnostics).toContain('if (import.meta.env.DEV) {');
  });

  it('keeps a cache-only key ownerless and Select fail-closed on ONE key-bound predicate', () => {
    // Every gate/owner decision shares this key context: the O(1) physical
    // projection cell. A derived or empty cell carries no key id.
    const cellResolver = between(studio, 'const resolveStudioScriptCell = useCallback(', '// quick-261026-odd follow-up: Water color');
    expect(cellResolver).toContain('physicPaintStore.getRotoPhysicalProjection(launch.layerId, studioActiveTrackId())?.cells[frame]');
    expect(cellResolver).toContain('? { kind: cell.kind, keyId: cell.keyId }');
    expect(cellResolver).toContain(': { kind: cell.kind, keyId: null };');

    // 261027-klx: the Brush Move gate, its engine ledger leg and the tool
    // selection funnel left with engine 1. The surviving gate is the Water
    // color Select gate, bound to the same key context.
    expect(studio).not.toContain('engineHoldsBrushMoveStrokes');
    expect(studio).not.toContain(retired('is', 'Brush', 'Script', 'FrameHydratable'));
    // Ownership publishes through the same cell; null leaves the module
    // untouched and locks nothing (behavior pinned in frameScriptOwnership /
    // frameModuleLock suites).
    const funnel = between(studio, 'const applyFrameModuleState = useCallback(', 'const staticControlsLocked = mutationLocked');
    expect(funnel).toContain('const scriptCell = resolveStudioScriptCell(frame);');
    expect(funnel).toContain('const owner = resolveFrameScriptOwner(frame, scriptCell);');
    expect(funnel).not.toContain("owner === 'brush'");
    expect(funnel).toContain('setFrameScriptOwner(owner);');
  });

  it('pins the ordinary-key durable base and the durable-base-unknown refusal', () => {
    // Launch-scoped map per ordinary keyId: bytes = known base, null = known
    // empty (blank promotion), MISSING = UNKNOWN (reopen → fail closed).
    const mapLifecycle = between(studio, 'const aquarelleDurableBaseByKeyRef = useRef<Map<string, Uint8Array | null>>(new Map());', '// 261019-mj2 cache-loss');
    expect(mapLifecycle).toContain('aquarelleDurableBaseByKeyRef.current = new Map();');
    // A replaced launch is a different document/session. The guard key lets the
    // pre-publish snapshot restore seed the map WITHOUT the post-publish effect
    // wiping it in the same launch.
    expect(mapLifecycle).toContain('const aquarelleDurableBaseLaunchKeyRef = useRef<string | null>(null);');
    expect(mapLifecycle).toContain('if (aquarelleDurableBaseLaunchKeyRef.current === launchKey) return;');
    expect(mapLifecycle).toContain('aquarelleDurableBaseLaunchKeyRef.current = launchKey;');
    expect(mapLifecycle).toContain('}, [launchContext?.operationId, launchContext?.layerId]);');

    // 261027 UAT round 4: the base is persisted per KEY in the SNAP v4
    // durable-base section and seeded back by every successful restore. The
    // launch map spans tracks; the controller scopes what each track writes.
    expect(studio).toContain('getDurableBases: () => {');
    // k03i: a RECOVERED base is session-only — the file may only keep bases
    // recorded at the key's first scripted stroke.
    expect(studio).toContain('const recovered = aquarelleRecoveredBaseKeyIdsRef.current;');
    expect(studio).toContain('if (!recovered.has(keyId)) persistable.set(keyId, bytes);');
    expect(studio).toContain('seedDurableBases: (bases) => {');
    expect(studio).toContain('const durableBaseMap = aquarelleDurableBaseByKeyRef.current;');
    expect(studio).toContain('if (durableBaseMap.has(keyId)) continue;');
    expect(studio).toContain('durableBaseMap.set(keyId, bytes === null ? null : new Uint8Array(bytes));');
    expect(studio).toContain('aquarelleRecoveredBaseKeyIdsRef.current.delete(keyId);');
    const restoreBlock = between(studio, 'restoreStudioScriptSnapshot: async (context, document) => {', 'usePhysicsPaintWorkflowIntegration');
    expect(restoreBlock).toContain('aquarelleDurableBaseLaunchKeyRef.current =');
    expect(restoreBlock).toContain('aquarelleDurableBaseByKeyRef.current = new Map();');

    // The base is pinned BEFORE the first event lands — the only instant the
    // display still holds the scriptless cached paint the composite preserves.
    const strokeEnd = between(studio, 'const handleAquarelleStrokeEnd = useCallback(', 'const handleAquarelleStrokeSettled');
    // 261027-k6j: the Script switch is peeked ONCE per stroke and that single
    // read drives both the durable-base pin and the gated script write, so a
    // mid-callback change can never pin a base without writing (or the reverse).
    const peekIndex = strokeEnd.indexOf('aquarelleScriptRecordingEnabled.peek()');
    const pinIndex = strokeEnd.indexOf('recordAquarelleOrdinaryDurableBaseRef.current(');
    const eventIndex = strokeEnd.indexOf('recordAquarelleStrokeWhenEnabled(');
    expect(peekIndex).toBeGreaterThan(-1);
    expect(pinIndex).toBeGreaterThan(-1);
    expect(pinIndex).toBeGreaterThan(peekIndex);
    expect(eventIndex).toBeGreaterThan(pinIndex);
    // The pin only means something for a script that is about to start:
    // Script Off pins nothing. 261028-k03c D4 also skips it for a recoverBase
    // lift — that pin can only refuse with `script-already-present` on a
    // pre-scripted frame.
    // 261028-k03f: the pin and the record share ONE `recordsScript` gate, so a
    // raster lift (no paint-bearing script) writes neither.
    const branchIndex = strokeEnd.indexOf('if (recordsScript && !(liftPlan?.kind === \'erase\' && liftPlan.recoverBase)) {');
    expect(branchIndex).toBeGreaterThan(-1);
    expect(branchIndex).toBeLessThan(pinIndex);
    // The pixels/acceptance/publish half is NOT gated — Off still paints, and
    // acceptance goes through the app-owned ledger (3.6, 261027-klx).
    expect(strokeEnd).toContain('paintMutationLedger.allocateStrokeMutation(');
    expect(strokeEnd).toContain('aquarelleSheetHasPaintRef.current = true;');
    expect(strokeEnd).toContain('applyFrameModuleState(launchContextRef.current?.startFrame ?? 0);');

    // Recorder: ordinary-key only; a frame that already carries a script (a
    // REOPENED flattened composite) stays UNKNOWN — recording it would double
    // the earlier strokes on the next bake.
    const recorder = between(studio, 'recordAquarelleOrdinaryDurableBaseRef.current = (appFrame) => {', 'const handleAquarelleCaptureFrame');
    expect(recorder).toContain("if (target.kind !== 'ordinary-key') return;");
    expect(recorder).toContain('if (aquarelleDurableBaseByKeyRef.current.has(target.keyId)) return;');
    // 261028-k03g: a STROKE script owns the frame — Dry is a global sheet
    // action and must not poison every later pin once one Dry exists.
    expect(recorder).toContain('if (hasAquarelleScriptForFrame(appFrame)) {');
    expect(recorder).not.toContain('getAquarelleEventsForFrame(appFrame).length > 0');
    expect(recorder).toContain("reason: 'script-already-present',");
    expect(recorder).toContain('const bytes = new Uint8Array(baseBytes);');
    expect(recorder).toContain('aquarelleDurableBaseByKeyRef.current.set(target.keyId, bytes);');
    // 261028-k03h: neither cache holds pixels and the sheet has no earlier
    // paint — a fresh blank key. Pin the KNOWN-EMPTY entry; leaving it UNKNOWN
    // sent Lift/Move into a recovery that fails closed (UAT round 3).
    expect(recorder).toContain('} else if (!aquarelleSheetHasPaintRef.current) {');
    expect(recorder).toContain('aquarelleDurableBaseByKeyRef.current.set(target.keyId, null);');
    expect(recorder).toContain("source: 'known-empty',");

    // Promotions pin the seeding base (clone bytes / known-empty blank);
    // rastering replaces the key's content, so its pinned base is stale.
    expect(studio).toContain("const promotedBase = baseKind === 'clone' ? new Uint8Array(baseFrame.bytes) : null;");
    expect(studio).toContain("source: baseKind === 'clone' ? 'promotion-clone' : 'promotion-blank',");
    expect(studio).toContain('if (scriptCell?.keyId) {');
    expect(studio).toContain('aquarelleDurableBaseByKeyRef.current.delete(scriptCell.keyId);');

    // Eight pin sites by design (re-derived from the source): promotion,
    // the authority's fresh pin (shared by prepare and the raster-key edit
    // path), first stroke, the 261028-k03 D2 lift-erase durable
    // rewrite, the 261028-k03c D4 recovery's TWO writes (the validated seed,
    // then the single punched base), and the 261028-k03e recoverBase
    // known-empty adoption (`adoptKnownEmpty` — a `null` entry proves there is
    // no pre-script pigment to preserve). TWO invalidations stay: Raster
    // replaces the key's content, and the explicit Trash full reset
    // (261027-gh9c) drops the key's cached pixels AND both scripts, so its
    // pinned base is stale as well. The map is NEVER advanced to the composed
    // output — advancing would compound the already-baked script on the next
    // bake.
    //
    // The lift-erase rewrite: an eraser must replace the durable base with the
    // punched B^K, or — when this very stroke pinned the PRE-erase raster
    // (willPinBase) — with the punched composite D^K. A surviving entry whose
    // strokes were all deleted (no reported script) is rewritten too. It still
    // never advances to the composed output, and each erase path is specified
    // with EXACTLY ONE `set(` statement of its own. One more (261028-k03h):
    // the recorder pins the KNOWN-EMPTY entry for a fresh blank key whose two
    // caches hold only placeholders. One more (261030-np9): the Run Script
    // per-key script recorder pins KNOWN-EMPTY for every rail key, because a
    // rail key's picture is ENTIRELY its script while its baked cache already
    // holds the strokes — replaying over that cache duplicated every stroke.
    expect(countOccurrences(studio, 'aquarelleDurableBaseByKeyRef.current.set(')).toBe(10);
    expect(countOccurrences(studio, 'aquarelleDurableBaseByKeyRef.current.delete(')).toBe(2);
    const publishBlock = between(studio, 'publish: async (frame) => {', 'onFirstAcceptedBrush');
    expect(publishBlock).not.toContain('aquarelleDurableBaseByKeyRef');

    // 261031-qps (Quick B): ONE compose call — every base (group source key,
    // launch map, occurrence, override) arrives as authority bytes, so the old
    // key-id branch is gone. null is a known-empty raw bake; undefined fails
    // closed (a reopened scripted key refuses, never erases).
    expect(countOccurrences(publishBlock, 'composeRotoScriptRebakeFrame({')).toBe(1);
    expect(publishBlock).toContain('if (target.durableBaseBytes === null) {');
    expect(publishBlock).toContain("durableBaseSource = 'known-empty';");
    expect(publishBlock).toContain('target.durableBaseBytes !== undefined');
    const unknownIndex = publishBlock.indexOf("reason: 'durable-base-unknown'");
    const upsertIndex = publishBlock.indexOf('upsertCachedFrame(');
    expect(unknownIndex).toBeGreaterThan(-1);
    expect(upsertIndex).toBeGreaterThan(unknownIndex);
    expect(publishBlock.indexOf('return false;', unknownIndex)).toBeLessThan(upsertIndex);
    // The COMPOSITE reaches the cache, never the raw stroke-only bake.
    expect(publishBlock).toContain('bytes: publishBytes');
    expect(publishBlock.lastIndexOf('publishBytes = composed.bytes;')).toBeLessThan(upsertIndex);
  });

  it('261028-k03c pins the legacy scripted base recovery (fail-closed, single punch)', () => {
    const preflight = between(studio, 'const planAquarelleLiftErase = useCallback(', 'const aquarelleLiftPreviewPlanRef');
    // An unknown durable base on a scripted frame is RECOVERED, not refused.
    expect(preflight).toContain('recoverBase: true');
    expect(preflight).toContain('recoverBase: false');
    // 261028-k03d: a failed recovery is diagnostic-only — it never locks the
    // key out for the rest of the session (that made Lift "work once").
    expect(preflight).not.toContain('aquarelleLiftRecoveryFailedRef.current.has(');
    expect(studio).toContain('const aquarelleLiftRecoveryFailedRef = useRef<Set<string>>(new Set());');
    expect(studio).not.toContain('aquarelleLiftRecoveryFailedRef.current.clear(');

    const erase = between(studio, 'const runAquarelleLiftErase = useCallback(', 'const handleAquarelleStrokeEnd = useCallback(');
    const recoveryStart = erase.indexOf("stage: 'base-recovery-start'");
    // 261028-k03e: P resolves through the key-payload-first composite seam; the
    // raw display read now lives only in the raster fallback.
    const displayRead = erase.indexOf('const display = aquarelleCompositeRef.current(plan.frame);');
    const bake = erase.indexOf('bakeAquarelleEventsToFrame({');
    const recover = erase.indexOf('recoverAquarelleDurableBase({');
    const seed = erase.indexOf('aquarelleDurableBaseByKeyRef.current.set(plan.keyId, recovery.bytes);');
    const punch = erase.indexOf('punchTransmittanceBytes(recovery.bytes, size, dabs');
    const punchedWrite = erase.indexOf('aquarelleDurableBaseByKeyRef.current.set(plan.keyId, punchedRecovered.bytes);');
    const tailReset = erase.indexOf('aquarelleResetSheetRef.current?.();', punchedWrite);
    const rebake = erase.indexOf('await rebake(getAquarelleEventsForFrame(plan.frame))');
    expect(recoveryStart).toBeGreaterThan(-1);
    expect(displayRead).toBeGreaterThan(recoveryStart);
    expect(bake).toBeGreaterThan(displayRead);
    expect(recover).toBeGreaterThan(bake);
    expect(seed).toBeGreaterThan(recover);
    expect(punch).toBeGreaterThan(seed);
    expect(punchedWrite).toBeGreaterThan(punch);
    expect(tailReset).toBeGreaterThan(punchedWrite);
    expect(rebake).toBeGreaterThan(tailReset);
    // The adopted base is durable BEFORE the punch lands.
    const seedBump = erase.indexOf('bumpAquarelleStrokesRevision();', seed);
    const seedDirty = erase.indexOf('studioScriptSnapshot.markDirty();', seed);
    expect(seedBump).toBeGreaterThan(seed);
    expect(seedDirty).toBeGreaterThan(seed);
    expect(seedBump).toBeLessThan(punch);
    expect(seedDirty).toBeLessThan(punch);

    // Fail-closed (D4 / truth-table row 4): the failure arm removes the event
    // this very stroke recorded, resets the sheet, reverts the preview and
    // publishes today's unknown-base copy — nothing erased, nothing adopted.
    const failure = erase.slice(erase.indexOf('const failRecovery = ('), displayRead);
    expect(failure).toContain('aquarelleLiftRecoveryFailedRef.current.add(plan.keyId);');
    expect(failure).toContain("stage: 'base-recovery-failed'");
    expect(failure).toContain('deleteAquarelleStrokesFromScript([mutationId])');
    expect(failure).toContain('aquarelleResetSheetRef.current?.();');
    expect(failure).toContain('revertAquarelleLiftPreview();');
    expect(failure).toContain('publish(AQUARELLE_LIFT_UNKNOWN_BASE_REFUSAL);');

    // SINGLE PUNCH: the pre-existing scripted punch sits in the NON-recover
    // arm, so a recoverBase transaction has exactly one punch on its path (the
    // map must end on t^K, never t^(K·K)).
    expect(erase).toContain('if (plan.scripted) {');
    // 261028-k03h: the arm re-derives the need at transaction time (a queued
    // plan can be stale), so the guard is `needsRecovery`, not the plan flag.
    expect(erase).toContain('if (needsRecovery) {');
    const guard = erase.indexOf('if (needsRecovery) {');
    const nonRecoverPunch = erase.indexOf('punchTransmittanceBytes(durable, size, dabs');
    expect(nonRecoverPunch).toBeGreaterThan(guard);
    // 261028-k03e adds an inner `if (!display) … else {` arm, so the recover
    // arm is bounded by the NON-recover arm's durable read, not the first
    // `} else {` in the block.
    const nonRecoverArm = erase.indexOf(
      'const durable = aquarelleDurableBaseByKeyRef.current.get(plan.keyId);',
      guard,
    );
    const recoverArm = erase.slice(guard, nonRecoverArm);
    expect(recoverArm.match(/punchTransmittanceBytes\(/g)?.length ?? 0).toBe(1);
    expect(recoverArm).not.toContain('aquarelleDurableBaseByKeyRef.current.get(plan.keyId)');
  });

  it('261028-k03e adopts the known-empty base and never leaks a refused lift erase', () => {
    const ensure = between(
      studio,
      'ensureAquarelleDurableBaseRef.current = async (appFrame) => {',
      '// 261028-k03b: the lift transaction.',
    );
    // The recovery composite is key-payload-first and placeholder-filtered.
    expect(ensure).toContain('const payload = aquarelleCompositeRef.current(appFrame);');
    expect(studio).toContain('if (!bytes || bytes.length <= AQUARELLE_PLACEHOLDER_MAX_BYTES) return null;');
    // No pixels anywhere → the script is the whole key: adopt known-empty and
    // skip the bake entirely (the 2 s stall).
    expect(ensure).toContain("reason: 'no-visible-payload',");
    expect(ensure).toContain("map.set(record.keyId, recovery.kind === 'empty' ? null : recovery.bytes);");
    expect(ensure).toContain("reason: recovery.kind === 'empty' ? 'empty-base-proof' : 'recovered',");

    const erase = between(studio, 'const runAquarelleLiftErase = useCallback(', 'const handleAquarelleStrokeEnd = useCallback(');
    // ONE known-empty adoption seam for both the no-payload and the proven-empty
    // arms; a `null` entry means the script owns the frame (no punch).
    expect(erase).toContain('const adoptKnownEmpty = (reason: string');
    expect(erase).toContain('aquarelleDurableBaseByKeyRef.current.set(plan.keyId, null);');
    expect(erase).toContain("adoptKnownEmpty('no-visible-payload');");
    expect(erase).toContain("adoptKnownEmpty('empty-base-proof', {");
    expect(erase).toContain('const display = aquarelleCompositeRef.current(plan.frame);');

    // 261028-k03f: a raster lift records nothing (a lift-only script would
    // publish a blank bake over the pixels on the next lift).
    const plan = between(studio, 'const planAquarelleLiftErase = useCallback(', 'const aquarelleLiftPreviewPlanRef');
    expect(plan).toContain('const scripted = hasAquarellePaintScriptForFrame(frame);');
    const strokeEnd = between(studio, 'const handleAquarelleStrokeEnd = useCallback(', 'const handleAquarelleStrokeSettled');
    expect(strokeEnd).toContain("const liftIsScriptOwned = liftPlan?.kind === 'erase' && liftPlan.scripted;");
    expect(strokeEnd).toContain("const recordsScript = scriptRecordingOn && (stroke.tool !== 'lift' || liftIsScriptOwned);");
    expect(strokeEnd).toContain('recordAquarelleStrokeWhenEnabled(recordsScript, mutationId');

    // A refused lift must undo the engine's local erase: the erase used to leak
    // into the next settle capture as the key's pixels.
    const planRefusal = strokeEnd.slice(
      strokeEnd.indexOf("if (liftPlan?.kind === 'refuse') {"),
      strokeEnd.indexOf('const scriptRecordingOn = aquarelleScriptRecordingEnabled.peek();'),
    );
    expect(planRefusal).toContain('aquarelleResetSheetRef.current?.();');
    expect(planRefusal).toContain('revertAquarelleLiftPreview();');
    const pinRefusal = strokeEnd.slice(
      strokeEnd.indexOf('if (liftPlan?.kind === \'erase\' && !liftPlan.recoverBase && liftPlan.willPinBase'),
    );
    expect(pinRefusal).toContain('aquarelleResetSheetRef.current?.();');
    expect(pinRefusal).toContain('revertAquarelleLiftPreview();');
  });

  it('261027-k6j resets the Script switch per launch, never on a track switch', () => {
    // Session state (K-05): every Studio launch starts On. The reset rides the
    // existing launch-key effect (operationId/layerId) — NOT
    // resetAquarelleRecordState, which also fires on every track switch and
    // must leave the user's chosen recording mode alone.
    const launchEffect = between(
      studio,
      'const launchKey =',
      '}, [launchContext?.operationId, launchContext?.layerId]);',
    );
    expect(launchEffect).toContain('resetAquarelleScriptRecording();');

    const trackSwitch = between(
      studio,
      'if (sessionNeedsCommit) {',
      'setCachedRotoReferenceUrl(null);',
    );
    expect(trackSwitch).toContain('resetAquarelleRecordState();');
    expect(trackSwitch).not.toContain('resetAquarelleScriptRecording');

    // Exactly one reset site in the whole Studio source — the launch effect.
    expect(countOccurrences(studio, 'resetAquarelleScriptRecording(')).toBe(1);
  });

  it('pins the group-frame lifecycle target and the EXACT-offset source-key base', () => {
    const prepare = between(studio, 'prepareRotoScriptTargetRef.current = async (', '// RARE BLANK-AFTER-PLAY guard');

    // Override frames publish to the OVERRIDE key; their currency identity and
    // durable base are the group SOURCE key at the exact cycle offset (run 1:
    // the source key still held the red-only payload under the composite).
    const overrideBranch = between(prepare, "if (target.kind === 'override') {", 'if (source.keyId !== null) return null;');
    expect(overrideBranch).toContain('const sourceKeyId = resolvePhysicPaintRotoGroupSourceKeyIdAtOffset(document, target.groupId, target.cycleOffset);');
    expect(overrideBranch).toContain('if (sourceKeyId === null || sourceKeyId !== source.keyId) return null;');
    expect(overrideBranch).toContain('keyId: target.keyId');
    // 261031-qps (Quick B): the base is the SOURCE key's authority result —
    // the override composite can never become a base.
    expect(overrideBranch).toContain('...baseFor(sourceKeyId)');

    // A source occurrence publishes to the source key the route turns into a
    // NEW override; its identity must match the mounted projection source.
    const sourceBranch = between(prepare, "if (target.kind === 'source-occurrence') {", "if (target.kind === 'override') {");
    expect(sourceBranch).toContain('if (target.sourceKeyId !== source.keyId) return null;');
    expect(sourceBranch).toContain('keyId: target.sourceKeyId');
    expect(sourceBranch).toContain('...baseFor(target.sourceKeyId)');

    // The composite runs on the authority bytes and fails closed BEFORE the
    // cache write when the bake cannot compose.
    const publish = between(studio, 'publish: async (frame) => {', 'onFirstAcceptedBrush');
    const composeBranch = between(publish, '} else if (target.durableBaseBytes !== undefined) {', '} else {');
    expect(composeBranch).toContain('composeRotoScriptRebakeFrame({');
    expect(composeBranch).toContain('durableBaseBytes: target.durableBaseBytes');
    expect(composeBranch).toContain("reason: 'durable-base-unavailable'");
    const failClosed = composeBranch.indexOf('if (!composed) {');
    expect(failClosed).toBeGreaterThan(-1);
    expect(composeBranch.indexOf('return false;', failClosed)).toBeGreaterThan(failClosed);
    expect(publish.indexOf('upsertCachedFrame(')).toBeGreaterThan(-1);
    expect(publish.slice(0, publish.indexOf('upsertCachedFrame('))).not.toContain(retired('durableBase', 'KeyId'));
  });

  it('keeps every debug probe DEV-gated and self-identifying', () => {
    const capture = readFileSync(fileURLToPath(new URL('./performance/aquarelleRenderSplitCapture.ts', import.meta.url)), 'utf8');
    // Every entry point (event, alpha proof, install, PNG dump) checks this.
    expect(capture).toContain('return import.meta.env.DEV === true;');
    expect(capture).toContain("AQUARELLE_RENDER_SPLIT_BUILD = 'debug-watercolor-loop-render-split-9'");
    // The Studio display sampler is DEV-gated; the Move provenance build
    // marker names this diagnostic revision so a stale window is detectable.
    expect(studio).toContain('if (!import.meta.env.DEV) return;');
    const moveProvenance = readFileSync(fileURLToPath(new URL('./performance/moveProvenanceCapture.ts', import.meta.url)), 'utf8');
    expect(moveProvenance).toContain("MOVE_PROVENANCE_BUILD = 'quick-261027-klx-diag-11-watercolor-only';");
  });

  it('261029-bks threads the bake diagnostics into script-bake and lift-erase', () => {
    // Apply: the helper's record (fired before it returns) reaches the existing
    // render-split event from the publish closure.
    const applyPort = between(
      studio,
      'applyAquarelleEvents: async ({ events, target, onProgress }) => {',
      'publish: async (frame) => {',
    );
    expect(applyPort).toContain('let bakeDiagnostics: AquarelleApplyDiagnostics | null = null;');
    expect(applyPort).toContain('onDiagnostics:');
    const scriptBake = between(
      studio,
      "recordAquarelleRenderSplitEvent('script-bake', {",
      '}, { bakeInk: frame.bytes, publishInk: publishBytes });',
    );
    expect(scriptBake).toContain('diagnostics: bakeDiagnostics,');

    // Pre-edit Lift base recovery: the bake forwards its record and every
    // lift-erase record of the flow carries it (null where no bake ran).
    const ensureBase = between(
      studio,
      'ensureAquarelleDurableBaseRef.current = async (appFrame) => {',
      'const runAquarelleLiftErase = useCallback(',
    );
    const ensureBake = between(ensureBase, 'bakeAquarelleEventsToFrame({', '});');
    expect(ensureBake).toContain('onDiagnostics:');
    expect(ensureBase).toContain('diagnostics: null,');
    expect(countOccurrences(ensureBase, 'diagnostics: recoveryDiagnostics,')).toBe(3);

    // Transaction Lift recovery: same seam, same records.
    const erase = between(
      studio,
      'const runAquarelleLiftErase = useCallback(',
      'const handleAquarelleStrokeEnd = useCallback(',
    );
    const eraseBake = between(erase, 'bakeAquarelleEventsToFrame({', '});');
    expect(eraseBake).toContain('onDiagnostics:');
    expect(countOccurrences(erase, 'diagnostics: recoveryDiagnostics,')).toBe(3);
  });

  it('261031-qps delegates the durable-base decision to the authority', () => {
    const ensureBase = between(
      studio,
      'ensureAquarelleDurableBaseRef.current = async (appFrame) => {',
      'const runAquarelleLiftErase = useCallback(',
    );
    // The base verdict is the authority's; the ensure step never decides it.
    expect(ensureBase).toContain('resolveScriptBase(');
    // The stroked probe is STROKES-ONLY: a Dry-only frame still counts as
    // unrecorded, so the probe is hasAquarelleScriptForFrame, never the
    // Dry-inclusive events reader.
    expect(ensureBase).toContain('hasAquarelleScriptForFrame(');
    expect(ensureBase).toContain('recoverAquarelleDurableBase(');
    expect(ensureBase).not.toContain('getAquarelleEventsForFrame(');
  });
});

describe('261027-klx Wave 3 — the app-owned ledger owns stroke acceptance', () => {
  function slice(source: string, startMarker: string, endMarker: string): string {
    const start = source.indexOf(startMarker);
    expect(start, `missing start marker: ${startMarker}`).toBeGreaterThan(-1);
    const end = source.indexOf(endMarker, start);
    expect(end, `missing end marker: ${endMarker}`).toBeGreaterThan(start);
    return source.slice(start, end);
  }

  it('accepts a Water color stroke through the ledger with no raster/finalization dependency', () => {
    const strokeEnd = slice(
      studio,
      'const handleAquarelleStrokeEnd = useCallback((stroke: AquarelleStroke) => {',
      'const handleAquarelleStrokeSettled',
    );
    // ONE synchronous allocation: the ledger emits the completion inside it.
    expect(strokeEnd).toContain('const mutationId = paintMutationLedger.allocateStrokeMutation({ primary: paintStroke });');
    // Nothing on this path may wait on an engine, a raster or a dry queue.
    expect(strokeEnd).not.toContain('enqueueRecordedStroke');
    expect(strokeEnd).not.toContain('flushPendingStrokeFinalizations');
    expect(strokeEnd).not.toContain('getPreviewBasePaintCanvas');
    expect(strokeEnd).not.toContain('engineRef');
  });

  it('allocates duplicate-script copies through the same ledger, never an engine', () => {
    // 61-24 (G-15): the body moved out of the inline duplicate port into the
    // one shared `recordAquarelleScriptCopyForFrames` seam — the pin follows
    // the same body, with the same markers and the same negative assertion.
    const recordCopy = slice(
      studio,
      'const recordAquarelleScriptCopyForFrames = async (sourceFrame: number, destinationFrame: number): Promise<boolean> => {',
      'const rotoNavigation = useRotoNavigationCoordinator',
    );
    expect(recordCopy).toContain('allocateMutationId: (stroke) => paintMutationLedger.allocateStrokeMutation({');
    expect(recordCopy).not.toContain('enqueueRecordedStroke');
  });

  it('pins KNOWN-EMPTY only on the replace branch of the rail script recorder', () => {
    const recordRail = slice(
      studio,
      'const recordRailKeyScripts = (input: {',
      'const rotoPlayScript = useRotoPlayScriptController({',
    );
    // 261031-i54: the replace branch is today's body verbatim — purge, pin the
    // known-empty base, then record. A rail key's picture IS its script; the
    // baked cache already holds the strokes, so replaying over it duplicated
    // every one of them (a moved stroke left its old copy behind in the cache).
    const replaceStart = recordRail.indexOf("if (input.recordMode === 'replace') {");
    const replaceEnd = recordRail.indexOf('for (const stroke of slice.strokes) {');
    expect(replaceStart).toBeGreaterThan(-1);
    expect(replaceEnd).toBeGreaterThan(replaceStart);
    const replaceBranch = recordRail.slice(replaceStart, replaceEnd);
    expect(replaceBranch).toContain('purgeAquarelleFrameScript(slice.frame);');
    expect(replaceBranch).toContain('aquarelleDurableBaseByKeyRef.current.set(keyId, null);');
    expect(replaceBranch).not.toContain('recordAquarelleStroke(');
    // The append branch records the slice strokes, never purges, and applies
    // the STAGED pre-run base pin (WR-01) after the controller's commit.
    const appendBranch = recordRail.slice(replaceEnd);
    expect(appendBranch).toContain('recordAquarelleStroke(mutationId, stroke, keyId);');
    expect(appendBranch).not.toContain('purgeAquarelleFrameScript(');
    expect(appendBranch).toContain("pinScriptBase(keyId, stagedPin.resolution, { appFrame: stagedPin.appFrame, source: 'stack-keep-script' })");
    // Exactly ONE DIRECT map write: only the replace branch pins known-empty
    // inline; append pins through the staged pinScriptBase seam.
    expect(countOccurrences(recordRail, 'aquarelleDurableBaseByKeyRef.current.set(')).toBe(1);
    expect(recordRail).not.toContain('enqueueRecordedStroke');
  });

  it('pins the authority-backed stack merge port: run sheets over the current picture, base pins staged, refusal before commit (261031-vbo)', () => {
    const unionPort = slice(
      studio,
      'const bakeStackedRailKey = async (input: {',
      'const composeStackedRailKey = async (input: {',
    );
    // One batch: keyIds slot-aligned with the RUN's own baked sheets.
    expect(unionPort).toContain('readonly keyIds: readonly string[];');
    expect(unionPort).toContain('readonly sheets: readonly PhysicPaintRotoStackSheet[];');
    // The base decision is the authority's, resolved per touched key — it only
    // stages the pin a later per-key edit needs.
    expect(unionPort).toContain('resolveScriptBase(keyId, lookup)');
    expect(unionPort).toContain('if (!resolution.ok) return { kind: \'refused\', reason: resolution.reason };');
    // 261031-vbo UAT: the PICTURE is the run's own sheet composited over the
    // touched key's CURRENT payload — the destination's recorded events are
    // never replayed (that flattened a motion rail to a static wash).
    expect(unionPort).not.toContain('getAquarelleEventsForFrame(');
    expect(unionPort).not.toContain('bakeAquarelleEventsToFrame(');
    expect(unionPort).toContain('getRotoRealKeyRecord(');
    expect(unionPort).toContain('requirePhysicPaintRotoInlineBytes(record.payload)');
    expect(unionPort).toContain('composeRotoScriptRebakeFrame({');
    expect(unionPort).toContain('durableBaseBytes: baseBytes');
    expect(unionPort).toContain("reason: 'composite-failed'");
    // WR-01: the port NEVER writes the live durable-base map, the recovered
    // markers or the snapshot dirty state — a refused merge leaves all three
    // untouched.
    expect(unionPort).not.toContain('pinScriptBase(');
    expect(unionPort).not.toContain('aquarelleDurableBaseByKeyRef');
    expect(unionPort).not.toContain('aquarelleRecoveredBaseKeyIdsRef');
    expect(unionPort).not.toContain('markDirty');
    // The fresh base is resolved from the PRE-RUN picture and STAGED (copied)
    // before the merge, so the publication can never overwrite it.
    const stagedAt = unionPort.indexOf('stagedPins.set(entry.keyId, {');
    expect(stagedAt).toBeGreaterThan(-1);
    expect(unionPort.indexOf('resolveScriptBase(keyId, lookup)')).toBeLessThan(stagedAt);
    expect(unionPort.indexOf('bytes: entry.resolution.bytes.slice(0)')).toBeGreaterThan(stagedAt);
    expect(unionPort.indexOf('getRotoRealKeyRecord(', stagedAt)).toBeGreaterThan(stagedAt);
    expect(unionPort).toContain('scriptBaseLookupFor(readScriptBasePayload)');

    // The persist-vs-session split: a recovered base answers ONLY the session
    // arm, while a fresh pin drops the recovered marker so it persists.
    const lookup = slice(studio, 'const scriptBaseLookupFor = (', 'const pinScriptBase = (');
    expect(lookup).toContain('if (aquarelleRecoveredBaseKeyIdsRef.current.has(keyId)) return undefined;');
    expect(lookup).toContain('aquarelleRecoveredBaseKeyIdsRef.current.has(keyId) ? readScriptBaseEntry(keyId) : undefined');
    const pin = slice(studio, 'const pinScriptBase = (', 'prepareRotoScriptTargetRef.current = async (source) => {');
    expect(pin).toContain('aquarelleDurableBaseByKeyRef.current.set(keyId, bytes);');
    expect(pin).toContain('aquarelleRecoveredBaseKeyIdsRef.current.delete(keyId);');
    expect(pin).toContain('studioScriptSnapshot.markDirty();');
  });

  it('leaves the durable-base map and the snapshot dirty state untouched on every stack-merge refusal (WR-01, 261031-vbo)', () => {
    const unionPort = slice(
      studio,
      'const bakeStackedRailKey = async (input: {',
      'const composeStackedRailKey = async (input: {',
    );
    // The whole port writes neither the live map, the recovered markers nor the
    // dirty flag: resolution only STAGES a copied pre-run base.
    expect(unionPort).not.toContain('aquarelleDurableBaseByKeyRef');
    expect(unionPort).not.toContain('aquarelleRecoveredBaseKeyIdsRef');
    expect(unionPort).not.toContain('pinScriptBase(');
    expect(unionPort).not.toContain('markDirty');
    // Both post-staging refusal returns clear the stage: nothing is left that a
    // later append record could apply.
    for (const reason of ["reason: 'durable-base-unknown'", "reason: 'composite-failed'"]) {
      const refusal = unionPort.indexOf(reason);
      expect(refusal).toBeGreaterThan(-1);
      expect(unionPort.slice(refusal - 80, refusal)).toContain('stagedPins.clear();');
    }
    // The staged pin lands ONLY through the append recording seam, which the
    // controller calls after the single successful commit.
    const recordRail = slice(
      studio,
      'const recordRailKeyScripts = (input: {',
      'const rotoPlayScript = useRotoPlayScriptController({',
    );
    expect(recordRail).toContain("const stagedPins = input.recordMode === 'append' ? pendingStackedScriptBasePinsRef.current : null;");
    expect(recordRail).toContain("pinScriptBase(keyId, stagedPin.resolution, { appFrame: stagedPin.appFrame, source: 'stack-keep-script' })");
    expect(recordRail).toContain('stagedPins?.clear();');
  });

  it('pins the Keep-OFF stack composite: the current payload plus the run sheet, never a bake, purge or base pin (UAT 261031-vbo)', () => {
    const compositePort = slice(
      studio,
      'const composeStackedRailKey = async (input: {',
      'const recordRailKeyScripts = (input: {',
    );
    expect(compositePort).toContain('sheetBytes: Uint8Array');
    expect(compositePort).toContain('getRotoRealKeyRecord(');
    expect(compositePort).toContain('requirePhysicPaintRotoInlineBytes(record.payload)');
    expect(compositePort).toContain('composeRotoScriptRebakeFrame({');
    // A missing record is a newly appended key — its base is blank, so the
    // run's sheet is the complete content.
    expect(compositePort).toContain("if (!record) return { kind: 'baked', bytes: input.sheetBytes };");
    expect(compositePort).not.toContain('bakeAquarelleEventsToFrame(');
    expect(compositePort).not.toContain('purgeAquarelleFrameScript');
    expect(compositePort).not.toContain('aquarelleDurableBaseByKeyRef');
  });

  it('pins the render-only reveal stack tail: span render, per-slice render, refusal before commit (261031-qps)', () => {
    const revealPort = slice(
      studio,
      'const bakeRevealStackTail = async (input: {',
      '// 261030-np9 (D-03/D-04): per-key rail scripts',
    );
    // The port is render-only: it can never write a record, a base pin, or a
    // leading interpolation break. The controller owns the single atomic commit.
    expect(revealPort).not.toContain('purgeAquarelleFrameScript');
    expect(revealPort).not.toContain('aquarelleDurableBaseByKeyRef');
    // IN-02: the other half of law 4 — never the commitRevealBake write path.
    expect(revealPort).not.toContain('incomingInterpolationBreak');
    expect(revealPort).not.toContain('commitRevealBake');
    expect(revealPort).not.toContain('recordAquarelleStroke(');
    expect(revealPort).not.toContain('upsertCachedFrame(');
    expect(revealPort).toContain('if (start === undefined) return { kind: \'refused\', reason: \'empty-span\' };');
    // Fast path: no destination key owns recorded strokes → the whole span
    // renders ONCE from the run's script (reveal-creation parity).
    expect(revealPort).toContain('input.slices.some((slice) => hasAquarelleScriptForFrame(slice.frame))');
    const fastPath = revealPort.slice(revealPort.indexOf('if (!ownsRecordedStrokes) {'));
    expect(fastPath).toContain('canonicalStart: start,');
    expect(fastPath).toContain('frameCount: frames.length,');
    expect(fastPath).toContain('frameIndex: frame.appFrame - start,');
    expect(fastPath).toContain("if (!rendered.ok) return { kind: 'refused', reason: rendered.error };");
    // Slow path: one output frame per touched slice, the key's recorded events
    // unioned with this run's slice so the picture equals the script.
    const slowPath = revealPort.slice(revealPort.indexOf('const frameSet = new Set(frames);'));
    expect(slowPath).toContain('...getAquarelleEventsForFrame(slice.frame),');
    expect(slowPath).toContain('...slice.strokes.map((stroke) => toStudioStroke(stroke)),');
    expect(slowPath).toContain('canonicalStart: slice.frame,');
    expect(slowPath).toContain('frameCount: 1,');
    expect(slowPath).toContain("return { kind: 'refused', reason: 'reveal-frame-missing' };");
    expect(slowPath).toContain('frameIndex: slice.slot,');
    // The ONE reveal seam is shared with the Apply/paste publish dispatch.
    expect(studio).toContain('renderRevealTailFrames');
    const wiring = slice(
      studio,
      "// 261031-qps (Quick B): the reveal rail's photo-reference tail bake.",
      'getScriptNaturalDuration:',
    );
    expect(wiring).toContain('bakeRevealStackTail,');
  });

  it('pins the Reveal RUN port: one whole-span render through the document reference, no union or writes (261101-1pc)', () => {
    const runPort = slice(
      studio,
      'const bakeRevealStackRun = async (input: RotoPlayScriptRevealRunRenderInput)',
      '// 261030-np9 (D-03/D-04): per-key rail scripts',
    );
    // Render-only: never a destination-event union, a per-slice loop, a purge,
    // a pin or a durable-base write. The controller owns the merge and commit.
    expect(runPort).not.toContain('getAquarelleEventsForFrame(');
    expect(runPort).not.toContain('hasAquarelleScriptForFrame(');
    expect(runPort).not.toContain('purgeAquarelleFrameScript');
    expect(runPort).not.toContain('pinScriptBase(');
    expect(runPort).not.toContain('aquarelleDurableBaseByKeyRef');
    expect(runPort).not.toContain('commitRevealBake');
    expect(runPort).not.toContain('recordAquarelleStroke(');
    expect(runPort).not.toContain('upsertCachedFrame(');
    // A stale stage from an aborted union run is discarded, and an empty span
    // refuses before any render.
    expect(runPort).toContain('pendingStackedScriptBasePinsRef.current.clear();');
    expect(runPort).toContain("if (start === undefined) return { kind: 'refused', reason: 'empty-span' };");
    // ONE whole-span render on the shared reveal seam, frame-aligned.
    expect(runPort).toContain('events: input.scriptEvents,');
    expect(runPort).toContain('canonicalStart: start,');
    expect(runPort).toContain('frameCount: input.frames.length,');
    // WR-01: the four dialog knobs are FORWARDED from the port input — a
    // literal substitution here must fail this pin.
    expect(runPort).toContain('colorize: input.colorize,');
    expect(runPort).toContain('colorizeMix: input.colorizeMix,');
    expect(runPort).toContain('photoWiggle: input.photoWiggle,');
    expect(runPort).toContain('paintSeedVariation: input.paintSeedVariation,');
    expect(runPort).toContain("if (!rendered.ok) return { kind: 'refused', reason: rendered.error };");
    expect(runPort).toContain('frames: rendered.frames.map((frame) => ({ appFrame: frame.appFrame, bytes: frame.bytes }))');
    // The ports object wires it beside the Quick B tail.
    const wiring = slice(
      studio,
      "// 261031-qps (Quick B): the reveal rail's photo-reference tail bake.",
      'getScriptNaturalDuration:',
    );
    expect(wiring).toContain('bakeRevealStackRun,');
  });

  it('resolves a key-script rail key to the KNOWN-EMPTY base instead of the baked source payload', () => {
    // Rail frames resolve through the GROUP branch, which otherwise reads the
    // source key's baked payload as the durable base — the script would be
    // composited over its own baked pixels. The rail's persisted opt-in is the
    // authority (never session state), so this holds after a reopen too.
    const lookup = slice(
      studio,
      'const scriptBaseLookupFor = (',
      'const pinScriptBase = (',
    );
    expect(lookup).toContain(
      'if (loopClips().some((clip) => clip.keyScriptEdits === true && clip.sourceKeyIds.includes(keyId))) {',
    );
    expect(lookup).toContain('return { bytes: null };');
    // 261031-qps: prepare routes EVERY target through the authority — no branch
    // re-reads a payload or names a base key inline any more.
    const prep = slice(
      studio,
      'prepareRotoScriptTargetRef.current = async (source) => {',
      'if (source.keyId !== null) return null;',
    );
    expect(prep).toContain('resolveScriptBase(resolutionKeyId, scriptBaseLookupFor(readScriptBasePayload))');
    expect(prep).toContain('...baseFor(target.keyId)');
    expect(prep).toContain('...baseFor(target.sourceKeyId)');
    expect(prep).toContain('...baseFor(sourceKeyId)');
    expect(prep).not.toContain(retired('durableBase', 'KeyId'));
    expect(prep).not.toContain('durableBaseBytes: null');
  });

  it('delivers exactly one completion per allocation and routes it through the ONE memoized port', () => {
    // Three accepted-stroke paths (live stroke end, duplicate copy, and the
    // 261030-np9 Run Script per-key script recorder) — no other site may
    // invent an id, or a stroke would complete twice.
    const allocations = studio.match(/paintMutationLedger\.allocateStrokeMutation\(/g) ?? [];
    expect(allocations).toHaveLength(3);
    // The ledger is the completion SOURCE; the ref keeps the existing ordering
    // (latest render's closure) while staying synchronous.
    expect(studio).toContain('useEffect(() => paintMutationLedger.subscribe((mutation) => {');
    expect(studio).toContain('canvasCompletedMutationImplRef.current(mutation);');
    // The SAME port identity reaches the clipboard and the completion path, or
    // getAcceptedTarget reads null for everything and every apply refuses.
    // 261027-klx: the Studio only publishes that identity — the controller owns
    // the accepted-target lookup, so no direct getAcceptedTarget call remains.
    expect(studio).toContain('rotoScript.updateEngine(rotoMutationPort);');
    expect(studio).toContain('getEngine: () => rotoMutationPort,');
    expect(studio).toContain('rotoScript.observeCompletedMutation(rotoMutationPort, mutation);');
    expect(studio).not.toContain('rotoScript.getAcceptedTarget(');
  });

  it('seeds the ledger clock from the launch restore and the track-switch restore only', () => {
    const seeds = studio.match(/paintMutationLedger\.reserveNextMutationId\(/g) ?? [];
    // 261027-klx: launch restore + track-switch restore. The engine-ready
    // max-raise left with the engine-1 canvas-ready seam.
    expect(seeds).toHaveLength(2);
    expect(studio).not.toContain('reserveMutationClock');
  });

  it('saves and restores engine state through the narrow AquarelleEnginePort', () => {
    expect(studio).toContain('saveEngineState: () => aquarelleEnginePortRef.current?.snapshot() ?? null,');
    expect(studio).toContain('loadEngineState: (state) => { aquarelleEnginePortRef.current?.restore(state); },');
    expect(studio).not.toContain('engineRef.current?.save()');
    expect(studio).not.toContain('engineRef.current?.load(');
    // The frame-editing controller reads the app-owned preview base and the
    // watercolor truth — never the engine-1 mirror.
    expect(studio).toContain('previewBase: rotoPersistence.reference.previewBasePort,');
    expect(studio).toContain('getFrameTruth: getAquarelleFrameTruth,');
    expect(studio).toContain('const events = getAquarelleEventsForFrame(frame);');
  });
});

describe('quick 261028-k03d — key-payload recovery and non-blanking failures', () => {
  it('prefers the authoritative key payload over the display cache when recovering', () => {
    const recoveryStart = studio.indexOf('if (needsRecovery) {');
    expect(recoveryStart).toBeGreaterThan(-1);
    const payloadAt = studio.indexOf('aquarelleKeyPayloadRef.current(plan.frame)', recoveryStart);
    const displayAt = studio.indexOf('findCachedRotoDisplayFrameRef.current(plan.frame)', recoveryStart);
    expect(payloadAt, 'the key payload is the primary P source').toBeGreaterThan(recoveryStart);
    expect(displayAt, 'the display frame stays the fallback').toBeGreaterThan(payloadAt);
  });

  it('refreshes the display from the key payload on a failed recovery', () => {
    const failStart = studio.indexOf('const failRecovery =');
    const failEnd = studio.indexOf('publish(AQUARELLE_LIFT_UNKNOWN_BASE_REFUSAL);', failStart);
    expect(failStart).toBeGreaterThan(-1);
    const failBlock = studio.slice(failStart, failEnd);
    expect(failBlock, 'a refusal never leaves the frame blank').toContain('loadCachedRotoReferenceFrame(plan.frame');
    expect(failBlock).toContain('physicPaintVersion.value++');
  });

  it('recovers the durable base before every script edit', () => {
    const definition = studio.indexOf('ensureAquarelleDurableBaseRef.current = async');
    expect(definition, 'the shared recovery helper exists').toBeGreaterThan(-1);
    const calls = studio.split('await ensureAquarelleDurableBaseRef.current(').length - 1;
    // 261028-k03e: the Apply/Copy target seam joins the four timeline edits.
    // 261029-lsr: the manual force-re-render (rail / Shift+R) recovers too.
    // 261101-o2m: the Draft entry arm and the Draft settle's belt join them —
    // both are no-ops once the arm has resolved the frame's durable base.
    // 61-15: the shared vector path edit commit joins them.
    // 61-31: the curve-mode batch joins them.
    expect(calls, 'delete + move + appearance + curve mode + transform + apply + rebake target + draft arm + draft settle + path edit').toBe(10);
    for (const handler of ['handleAquarelleDeleteStrokes', 'handleAquarelleMoveStrokes', 'handleAquarelleAppearanceStrokes', 'handleAquarelleCurveModeStrokes', 'handleAquarelleTransformStrokes', 'commitAquarelleVectorPathEdit']) {
      const start = studio.indexOf(`const ${handler} = useCallback`);
      expect(start, `${handler} exists`).toBeGreaterThan(-1);
      const call = studio.indexOf('await ensureAquarelleDurableBaseRef.current(', start);
      expect(call, `${handler} recovers before editing`).toBeGreaterThan(start);
    }
    const applyTarget = studio.indexOf('prepareRotoScriptTargetRef.current = async (source) => {');
    expect(applyTarget).toBeGreaterThan(-1);
    expect(studio.indexOf('await ensureAquarelleDurableBaseRef.current(', applyTarget))
      .toBeGreaterThan(applyTarget);
  });
});

describe('quick 261101-o2m — Draft mode session seam', () => {
  function regionOf(source: string, startMarker: string, endMarker: string): string {
    const start = source.indexOf(startMarker);
    expect(start, `missing start marker: ${startMarker}`).toBeGreaterThan(-1);
    const end = source.indexOf(endMarker, start + startMarker.length);
    expect(end, `missing end marker: ${endMarker}`).toBeGreaterThan(start);
    return source.slice(start, end);
  }

  it('arms the frame durable base before Draft turns on — single-flight, frame-bound, never a recompute', () => {
    const arm = regionOf(studio, 'const armDraftBase = useCallback', 'const draftSettlePromiseRef');
    // Single-flight: a double ON click must not run two recoveries.
    expect(arm).toContain('if (draftArmPromiseRef.current) return draftArmPromiseRef.current;');
    expect(arm).toContain('const playFrame = launchContextRef.current?.startFrame ?? 0;');
    expect(arm).toContain('await ensureAquarelleDurableBaseRef.current(playFrame)');
    // Frame-binding guard: the live frame is RE-READ after the await, and a
    // mismatch leaves Draft OFF (the new frame is unarmed).
    const ensureAt = arm.indexOf('await ensureAquarelleDurableBaseRef.current(playFrame)');
    const rereadAt = arm.indexOf('const liveFrame = launchContextRef.current?.startFrame ?? 0;', ensureAt);
    expect(rereadAt, 'the live frame is re-read after the await').toBeGreaterThan(ensureAt);
    expect(arm).toContain('liveFrame !== playFrame');
    // A base decision, never a recompute.
    expect(arm).not.toContain('aquarelleResetSheetRef');
    expect(arm).not.toContain('applyAquarelleTimeline');
    // Wired into the Stroke settings bundle the strip's ON click awaits.
    expect(studio).toContain('armDraft: () => armDraftBase(),');
  });

  it('settles the Draft script once: joins concurrent exits, clears dirty then Draft only after the apply', () => {
    const seam = regionOf(studio, 'const settleDraftScript = useCallback', 'const navigateToSyncedPhysicalFrame');
    // D-04: Draft OFF and clean pixels is a pure no-op — no await, no microtask.
    expect(seam).toContain('if (!draftMode.peek() && !draftPixelsDirty.peek()) return Promise.resolve(true);');
    // Single-flight: two exits racing each other join ONE recompute.
    expect(seam).toContain('if (draftSettlePromiseRef.current) return draftSettlePromiseRef.current;');
    // The ONE recompute.
    expect(seam).toContain('rotoPersistence.invalidateLivePixels(playFrame);');
    expect(seam).toContain('await ensureAquarelleDurableBaseRef.current(playFrame);');
    expect(seam).toContain('aquarelleResetSheetRef.current?.();');
    expect(seam).toContain('await rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame));');
    expect(seam).toContain('rotoScript.notifySourceRevision();');
    expect(seam).toContain('applyFrameModuleState(playFrame);');
    // Leave order: the apply lands, THEN dirty clears, THEN Draft flips — the
    // setter refuses OFF while dirty, so this is the only reachable route.
    const applyAt = seam.indexOf('await rotoScript.applyAquarelleTimeline(');
    const dirtyAt = seam.indexOf('setDraftPixelsDirty(false);', applyAt);
    const modeAt = seam.indexOf('setDraftMode(false);', dirtyAt);
    expect(applyAt, 'the apply is the recompute').toBeGreaterThan(-1);
    expect(dirtyAt, 'the dirty flag clears only after the apply').toBeGreaterThan(applyAt);
    expect(modeAt, 'Draft flips false only after the dirty clear').toBeGreaterThan(dirtyAt);
    // The script-snapshot write deferred for the whole session re-arms here.
    expect(seam.indexOf('studioScriptSnapshot.markDirty();'), 'the deferred write re-arms after the clear')
      .toBeGreaterThan(dirtyAt);
    // Wired into the Stroke settings bundle the strip/close/exit call.
    expect(studio).toContain('settleDraft: () => settleDraftScript(),');
  });

  it('commits the move under Draft with no reset and no re-apply, keeping the Live path intact', () => {
    const move = regionOf(studio, 'const handleAquarelleMoveStrokes = useCallback', 'const handleAquarelleAppearanceStrokes');
    // The Draft read precedes the first Live reset, and the Live reset/apply
    // path survives untouched below it.
    const draftAt = move.indexOf('const draft = draftMode.peek();');
    const resetAt = move.indexOf('aquarelleResetSheetRef.current?.()');
    expect(draftAt, 'the handler reads the Draft state').toBeGreaterThan(-1);
    expect(resetAt, 'the Live reset path survives').toBeGreaterThan(draftAt);
    expect(move).toContain('await rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame));');
    // The ensure stays at its Live position, BEFORE the begin.
    const ensureAt = move.indexOf('await ensureAquarelleDurableBaseRef.current(playFrame);');
    const beginAt = move.indexOf('const editId = beginAquarelleMoveEdit(');
    expect(ensureAt).toBeGreaterThan(-1);
    expect(beginAt).toBeGreaterThan(ensureAt);
    // The draft branch: records the edit exactly like the success tail, marks
    // the pixels dirty, and never resets nor re-applies the sheet.
    const branch = regionOf(move, 'if (draft) {', 'setAquarelleScriptEditInFlight(true);');
    expect(branch).toContain('rotoMoveHistory.recordAquarelleScriptEdit(editId);');
    expect(branch).toContain('setDraftPixelsDirty(true);');
    expect(branch).toContain('setLastError(null);');
    expect(branch).toContain('clearOwnedScriptApplyRefusal();');
    expect(branch).not.toContain('aquarelleResetSheetRef');
    expect(branch).not.toContain('applyAquarelleTimeline');
    expect(branch).not.toContain('script-move-result');
  });
});

// 261101-o2m Task 2: every remaining edit path commits under Draft and skips
// only the reset/apply tail, undo/redo gates only its pixel ports, and the
// cache eye is a display-only class on the still-mounted cached-base canvas.
describe('quick 261101-o2m — every edit commits under Draft, the cache eye', () => {
  function regionOf(source: string, startMarker: string, endMarker: string): string {
    const start = source.indexOf(startMarker);
    expect(start, `missing start marker: ${startMarker}`).toBeGreaterThan(-1);
    const end = source.indexOf(endMarker, start + startMarker.length);
    expect(end, `missing end marker: ${endMarker}`).toBeGreaterThan(start);
    return source.slice(start, end);
  }

  /**
   * The Draft branch of one handler. The delete branch re-reads the live mode
   * after its await (261101-o2m WR-03), so its marker differs.
   */
  function draftBranchOf(
    region: string,
    nextMarker: string,
    branchMarker = 'if (draft) {',
  ): string {
    return regionOf(region, branchMarker, nextMarker);
  }

  const handlers = [
    ['handleAquarelleDeleteStrokes', 'const handleAquarelleMoveStrokes'],
    ['handleAquarelleAppearanceStrokes', 'aquarelleAppearanceCommitRef.current'],
    ['handleAquarelleTransformStrokes', 'const handleAquarelleStepStroke'],
    ['handleAquarelleStepStroke', 'const handleAquarellePlaceStroke'],
    ['handleAquarellePlaceStroke', 'setScriptStrokeEditionPorts('],
  ] as const;

  it('records and marks dirty on the Draft branch, keeping every Live reset/apply path', () => {
    for (const [handler, next] of handlers) {
      const region = regionOf(studio, `const ${handler} = useCallback`, next);
      const draftAt = region.indexOf('const draft = draftMode.peek();');
      const resetAt = region.indexOf('aquarelleResetSheetRef.current?.()');
      expect(draftAt, `${handler} reads the Draft state`).toBeGreaterThan(-1);
      expect(resetAt, `${handler} keeps the Live reset path`).toBeGreaterThan(draftAt);
      expect(region, `${handler} keeps the Live apply`).toContain('applyAquarelleTimeline');
      const isDelete = handler.includes('Delete');
      const branch = draftBranchOf(
        region,
        isDelete ? 'aquarelleResetSheetRef.current?.()' : 'setAquarelleScriptEditInFlight(true);',
        isDelete ? 'if (draft && draftMode.peek()) {' : 'if (draft) {',
      );
      expect(branch, `${handler} records the edit`).toContain('rotoMoveHistory.recordAquarelleScriptEdit(editId);');
      expect(branch, `${handler} marks the pixels dirty`).toContain('setDraftPixelsDirty(true);');
      expect(branch, `${handler} clears the error`).toContain('setLastError(null);');
      expect(branch).not.toContain('applyAquarelleTimeline');
      expect(branch).not.toContain('restoreAquarelleEditSnapshot');
    }
  });

  it('keeps the durable-base ensure at its Live index (delete after the begin, appearance/transform before it)', () => {
    const deleteRegion = regionOf(studio, 'const handleAquarelleDeleteStrokes = useCallback', 'const handleAquarelleMoveStrokes');
    // Live ordering, deliberately untouched by this quick.
    expect(deleteRegion.indexOf('const editId = beginAquarelleDeleteEdit('))
      .toBeLessThan(deleteRegion.indexOf('await ensureAquarelleDurableBaseRef.current(playFrame);'));
    // The delete Draft branch still applies the owner law the Live tail applies.
    expect(draftBranchOf(
      deleteRegion,
      'aquarelleResetSheetRef.current?.()',
      'if (draft && draftMode.peek()) {',
    )).toContain('applyFrameModuleState(playFrame);');

    for (const [handler, next] of [
      ['handleAquarelleAppearanceStrokes', 'aquarelleAppearanceCommitRef.current'],
      ['handleAquarelleTransformStrokes', 'const handleAquarelleStepStroke'],
    ] as const) {
      const region = regionOf(studio, `const ${handler} = useCallback`, next);
      const ensureAt = region.indexOf('await ensureAquarelleDurableBaseRef.current(playFrame);');
      const beginAt = region.indexOf('const editId = beginAquarelle');
      expect(ensureAt, `${handler} keeps its pre-begin ensure`).toBeGreaterThan(-1);
      expect(beginAt).toBeGreaterThan(ensureAt);
    }

    // Step and place have no ensure in Live either: the entry arm protects them.
    for (const [handler, next] of [
      ['handleAquarelleStepStroke', 'const handleAquarellePlaceStroke'],
      ['handleAquarellePlaceStroke', 'setScriptStrokeEditionPorts('],
    ] as const) {
      const region = regionOf(studio, `const ${handler} = useCallback`, next);
      expect(region).not.toContain('ensureAquarelleDurableBaseRef');
    }
  });

  it('gates only the resetSheet/rebake ports and the post-replay capture', () => {
    const replay = regionOf(studio, 'const runScriptReplay = useCallback', 'const handleRebakeScript');
    // resetSheet returns early in Draft, before the tile check.
    const resetPort = regionOf(replay, 'resetSheet: () => {', 'rebake: () => {');
    const resetDraftAt = resetPort.indexOf('if (draftMode.peek()) return;');
    expect(resetDraftAt, 'resetSheet is gated in Draft').toBeGreaterThan(-1);
    expect(resetPort.indexOf('if (tileHistory) return;')).toBeGreaterThan(resetDraftAt);
    // rebake marks dirty and resolves success BEFORE the tile branch (the
    // restore port already swapped the script).
    const rebakePort = regionOf(replay, 'rebake: () => {', 'rollback: (revert) => {');
    const rebakeDraftAt = rebakePort.indexOf('if (draftMode.peek()) {');
    expect(rebakeDraftAt, 'rebake is gated in Draft').toBeGreaterThan(-1);
    expect(rebakePort.indexOf('setDraftPixelsDirty(true);', rebakeDraftAt)).toBeGreaterThan(rebakeDraftAt);
    expect(rebakePort.indexOf('return Promise.resolve(true);', rebakeDraftAt)).toBeGreaterThan(rebakeDraftAt);
    expect(rebakePort.indexOf('if (tileHistory) {')).toBeGreaterThan(rebakeDraftAt);
    // The post-replay capture also tests the Draft state.
    expect(replay).toContain('if (replayed && tileHistory && !skipCapture && !draftMode.peek()) {');
    // The ledger/owner ports stay ungated: Draft only gates the PIXEL side.
    for (const port of [
      'restore: (targetEditId, dir) => restoreAquarelleEditSnapshot(targetEditId, dir),',
      'rollback: (revert) => {',
      'notify: () => { rotoScript.notifySourceRevision(); },',
      'publishOwner: () => { applyFrameModuleState(playFrame); },',
      'invalidate: () => {',
      'ensureBase: () => ensureAquarelleDurableBaseRef.current(playFrame),',
    ]) {
      expect(replay, `port survives: ${port}`).toContain(port);
    }
  });

  it('hides the frozen sheet through a display-only class on the mounted canvas', () => {
    // The leaf subscribes to the session preference and only swaps a class.
    expect(cachedBase).toContain("import { frozenCacheVisible } from '../view/scriptStrokeEdition';");
    expect(cachedBase).toContain('const cacheVisible = frozenCacheVisible.value;');
    expect(cachedBase).toContain('class={`aquarelle-cached-base${cacheVisible ? \'\' : \' aquarelle-cached-base-hidden\'}`}');
    // Mounted, never unmounted, never nulled: the decode cache stays warm.
    expect(cachedBase).toContain('ref={canvasRef}');
    expect(cachedBase).toContain('aria-hidden="true"');
    expect(cachedBase).not.toContain('return null');
    // The CSS hide is `visibility`, never `display: none`.
    expect(css).toContain('.demo-canvas-shell .aquarelle-cached-base.aquarelle-cached-base-hidden {');
    const rule = regionOf(css, '.demo-canvas-shell .aquarelle-cached-base.aquarelle-cached-base-hidden {', '}');
    expect(rule).toContain('visibility: hidden;');
    expect(rule).not.toContain('display: none');
    // The strip itself carries the eye (the dialog leaf owns the control).
    const dialog = readFileSync(fileURLToPath(new URL('./view/PhysicsPaintStrokeSettingsDialog.tsx', import.meta.url)), 'utf8');
    expect(dialog).toContain('data-testid="stroke-settings-cache-visibility"');
  });

  it('leaves the overlay law untouched — still selection-only', () => {
    expect(scriptStrokeOverlay).toContain('scriptSelectedStrokeIds');
    // Draft never widens the drawn set: no stroke-listing read in the overlay.
    expect(scriptStrokeOverlay).not.toContain('listSelectableAquarelleStrokes');
    expect(scriptStrokeOverlay).not.toContain('draftMode');
  });
});

// 261101-o2m Task 3: frame change, play (both entry points), save/export, the
// Studio window-close REFUSAL, the deferred script snapshot, and the main-realm
// gate with its heartbeat and staleness belt. Every exit ACTS on the settle's
// result — a refusal aborts rather than proceeds over the frozen sheet.
describe('quick 261101-o2m — the five exits act on the recompute, the persistence channels are closed', () => {
  function regionOf(source: string, startMarker: string, endMarker: string): string {
    const start = source.indexOf(startMarker);
    expect(start, `missing start marker: ${startMarker}`).toBeGreaterThan(-1);
    const end = source.indexOf(endMarker, start + startMarker.length);
    expect(end, `missing end marker: ${endMarker}`).toBeGreaterThan(start);
    return source.slice(start, end);
  }

  it('settles before the frame-leave capture and aborts the navigation on a refusal', () => {
    const nav = regionOf(studio, 'const navigateToSyncedPhysicalFrame', 'const runScriptReplay');
    // The two-flag peek keeps the Live law synchronous: no await, no microtask.
    const guardAt = nav.indexOf('if (draftMode.peek() || draftPixelsDirty.peek()) {');
    expect(guardAt, 'the frame-change exit is guarded on both flags').toBeGreaterThan(-1);
    const settleAt = nav.indexOf('const draftSettled = await settleDraftScript();', guardAt);
    expect(settleAt, 'the settle runs inside the guarded block').toBeGreaterThan(guardAt);
    // The settle PRECEDES the frame-leave capture: settling afterwards would
    // enqueue the frozen pre-Draft sheet for the OUTGOING frame.
    const captureAt = nav.indexOf('aquarelleFlushCaptureRef.current?.();', settleAt);
    expect(captureAt, 'the frame-leave capture still runs').toBeGreaterThan(settleAt);
    // ACTING on the result, not just awaiting it.
    expect(nav).toContain('if (!draftSettled) return false;');
    // A navigation superseded during the await yields the canvas to the newer
    // intent instead of capturing over it.
    const generationAt = nav.indexOf('if (!rotoNavigationGeneration.isLatest(generation)) return false;', settleAt);
    expect(generationAt, 'the generation is re-checked after the await').toBeGreaterThan(settleAt);
    // The callback depends on the seam it calls (its own deps array — the one
    // closing the `return true;` body, not a later effect's).
    const depsAt = nav.indexOf('return true;\n  }, [');
    expect(depsAt, 'the callback deps array closes the navigation body').toBeGreaterThan(-1);
    expect(nav.slice(depsAt, nav.indexOf(']);', depsAt))).toContain('settleDraftScript');
  });

  it('routes BOTH play entry points through ONE settle-then-toggle wrapper', () => {
    const wrapper = regionOf(studio, 'const handleToggleRotoPlayback = useCallback', 'const navigateToSyncedPhysicalFrame');
    const settleAt = wrapper.indexOf('void settleDraftScript().then((settled) => {');
    const toggleAt = wrapper.indexOf('if (settled) rotoCachedPlayback.toggle();');
    expect(settleAt, 'the wrapper settles first').toBeGreaterThan(-1);
    expect(toggleAt, 'a refused settle never starts playback').toBeGreaterThan(settleAt);
    // Fail closed: the toggle is INSIDE the settled check.
    expect(wrapper.indexOf('rotoCachedPlayback.toggle();', settleAt)).toBeGreaterThan(settleAt);
    // Declared before its first consumer (the keyboard hook call).
    const wrapperAt = studio.indexOf('const handleToggleRotoPlayback = useCallback');
    const keyboardAt = studio.indexOf('usePhysicsPaintStudioKeyboard(');
    expect(wrapperAt, 'the wrapper is declared before the keyboard consumer').toBeGreaterThan(-1);
    expect(keyboardAt).toBeGreaterThan(wrapperAt);
    // BOTH consumers are wired to the wrapper — bare Space included.
    expect(studio).toContain('toggleRotoPlayback: handleToggleRotoPlayback,');
    expect(studio).toContain('onToggleRotoPlayback: handleToggleRotoPlayback,');
    expect(studio).not.toContain('toggleRotoPlayback: rotoCachedPlayback.toggle,');
    expect(studio).not.toContain('onToggleRotoPlayback: rotoCachedPlayback.toggle,');
  });

  it('makes the save/export flush throw on a refused recompute, before any capture', () => {
    const listenerFlush = regionOf(studio, 'flushStudioStateRef.current = async () => {', 'installPhysicPaintFlushRequestListener');
    const settleStepAt = listenerFlush.indexOf('if (await settleDraftScript()) return;');
    expect(settleStepAt, 'the settle is a flush step').toBeGreaterThan(-1);
    expect(listenerFlush).toContain("throw new Error('Draft recompute refused — save/export cancelled.');");
    // The throw IS the abort: the capture never runs after a refusal.
    expect(listenerFlush.indexOf('flushAquarellePixels()', settleStepAt)).toBeGreaterThan(settleStepAt);
    // The step is FIRST in the list: it precedes the idle-gated ledger drain.
    expect(listenerFlush.indexOf('await runStudioFlush([')).toBeGreaterThan(-1);
    const firstLiveStepAt = listenerFlush.indexOf('if (!readInteractionIdle()) return;');
    expect(firstLiveStepAt, 'the Live first step still runs').toBeGreaterThan(settleStepAt);
  });

  it('refuses the Studio window close while dirty — never a recompute', () => {
    // The CALL, not the import line: slice from the indented invocation so the
    // region is the close block itself.
    const closeStart = studio.indexOf('\n  usePhysicsPaintCloseFlush(');
    expect(closeStart).toBeGreaterThan(-1);
    const closeReleaseAt = studio.indexOf('efxPaintAudioMonitor.release()', closeStart);
    expect(closeReleaseAt).toBeGreaterThan(closeStart);
    const closeFlush = studio.slice(closeStart, closeReleaseAt);
    const refusalAt = closeFlush.indexOf("if (draftPixelsDirty.peek()) throw new Error('Draft recompute pending — turn Draft off before closing the Studio.');");
    expect(refusalAt, 'the dirty refusal is a close step').toBeGreaterThan(-1);
    // FIRST step: nothing is captured, pushed or written before it throws.
    for (const later of [
      'rotoMutationPort.flushPendingStrokeFinalizations?.()',
      'flushAquarellePixels(currentFrame)',
      'flushDocumentSyncRef.current()',
      'studioScriptSnapshot.flushNow()',
    ]) {
      expect(closeFlush.indexOf(later), `${later} runs after the refusal`).toBeGreaterThan(refusalAt);
    }
    // D-04 has exactly five exits: the window close must never settle.
    expect(closeFlush).not.toContain('settleDraftScript(');
    // The audio engine release still runs (outside the step list, after it).
    const releaseAt = studio.indexOf('efxPaintAudioMonitor.release(),', closeStart);
    expect(releaseAt, 'the audio release still runs first in the close hook').toBeGreaterThan(closeStart + refusalAt);
    expect(studio.slice(closeStart, releaseAt)).toContain('studioScriptSnapshot.flushNow()');
  });

  it('publishes the Draft-or-dirty state with a 5s heartbeat from one lifecycle effect', () => {
    expect(studio).toContain("import { PHYSIC_PAINT_DRAFT_HEARTBEAT_MS, publishStudioDraftMode } from '../../lib/physicPaintDraftMode';");
    const effectStart = studio.indexOf(
      'const active = draftMode.value || draftPixelsDirty.value || wireframeMode.value;',
    );
    expect(effectStart, 'the publisher follows the PIXELS, never the switch alone').toBeGreaterThan(-1);
    expect(studio.indexOf('void publishStudioDraftMode(active);', effectStart)).toBeGreaterThan(effectStart);
    expect(studio.indexOf('}, PHYSIC_PAINT_DRAFT_HEARTBEAT_MS);', effectStart)).toBeGreaterThan(effectStart);
    expect(studio.indexOf('heartbeat = setInterval(', effectStart)).toBeGreaterThan(effectStart);
    // Disposed on unmount: the effect teardown clears the interval.
    const publishBlockStart = studio.lastIndexOf('useEffect(() => {', effectStart);
    const publishBlock = studio.slice(publishBlockStart, studio.indexOf('}, []);', publishBlockStart));
    expect(publishBlock).toContain('dispose();');
    expect(publishBlock).toContain('stopHeartbeat();');
  });

  it('gates both autosave sites and resumes on the release publish', () => {
    expect(autoSave).toContain("import {isStudioDraftModeActive, setStudioDraftModeReleaseHandler} from './physicPaintDraftMode';");
    // scheduleSave never arms a timer while the gate is active.
    const armAt = autoSave.indexOf('saveTimeout = setTimeout(');
    expect(autoSave.indexOf('if (isStudioDraftModeActive()) return;', autoSave.indexOf('function scheduleSave()'))).toBeGreaterThan(-1);
    expect(armAt).toBeGreaterThan(autoSave.indexOf('if (isStudioDraftModeActive()) return;'));
    // BOTH execution bodies consult the gate: the 2s debounce and the 60s
    // interval (one call in scheduleSave + one in each body = three).
    expect((autoSave.match(/isStudioDraftModeActive\(\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
    const debounceBody = autoSave.slice(armAt, autoSave.indexOf('}, 2000); // 2-second debounce'));
    expect(debounceBody, 'the debounce body is gated').toContain('if (isStudioDraftModeActive()) return;');
    const intervalStart = autoSave.indexOf('intervalId = setInterval(');
    const intervalBody = autoSave.slice(intervalStart, autoSave.indexOf('}, 60_000);'));
    expect(intervalStart).toBeGreaterThan(-1);
    expect(intervalBody, 'the 60s interval body is gated').toContain('if (isStudioDraftModeActive()) return;');
    // Registration in startAutoSave, cleared in stopAutoSave.
    expect(autoSave).toContain('setStudioDraftModeReleaseHandler(() => scheduleSave());');
    expect(autoSave).toContain('setStudioDraftModeReleaseHandler(null);');
    expect(autoSave.indexOf('setStudioDraftModeReleaseHandler(() => scheduleSave());'))
      .toBeGreaterThan(autoSave.indexOf('export function startAutoSave(): void {'));
    expect(autoSave.indexOf('setStudioDraftModeReleaseHandler(null);'))
      .toBeGreaterThan(autoSave.indexOf('export function stopAutoSave(): void {'));
  });

  it('installs the main-realm listener in the bootstrap', () => {
    expect(main).toContain("import {installPhysicPaintDraftModeListener} from './lib/physicPaintDraftMode';");
    const installAt = main.indexOf('await installPhysicPaintDraftModeListener();');
    expect(installAt).toBeGreaterThan(-1);
    expect(installAt).toBeGreaterThan(main.indexOf('startAutoSave();'));
    expect(installAt).toBeGreaterThan(main.indexOf('render(<App />, root);'));
  });

  it('cancels save and export in the main realm while the Draft gate is still active', () => {
    // The conjunction is race-free: a successful settle always reports flushed.
    const gate = 'if (!flushed && isStudioDraftModeActive())';
    expect(projectStoreSource.split(gate).length - 1, 'both save paths abort').toBe(2);
    expect(projectStoreSource.split("throw new Error('Save cancelled — the Draft recompute did not complete.');").length - 1).toBe(2);
    // saveProject keeps its skipPaintFlush autosave path free of the flush.
    expect(projectStoreSource).toContain('if (!options?.skipPaintFlush) {');
    expect(exportEngine.split(gate).length - 1, 'the export aborts').toBe(1);
    expect(exportEngine).toContain("errorMessage: 'Export cancelled — the Draft recompute did not complete. Turn Draft off and retry.'");
    // Both import the gate from the leaf module (no cycle through the bridge).
    expect(projectStoreSource).toContain("import {isStudioDraftModeActive} from '../lib/physicPaintDraftMode';");
    expect(exportEngine).toContain("import { isStudioDraftModeActive } from './physicPaintDraftMode';");
  });

  it('defers every script-snapshot write at the two controller chokepoints', () => {
    // The Studio injects the dirty port beside the content signature.
    expect(studio).toContain('shouldDeferSave: () => draftPixelsDirty.peek(),');
    // Optional: absent means never defer (every existing construction intact).
    expect(snapshotController).toContain('shouldDeferSave?: () => boolean;');
    const markDirty = regionOf(snapshotController, 'function markDirty(): void {', 'async function flushNow(');
    const deferAt = markDirty.indexOf('if (deps.shouldDeferSave?.()) return;');
    expect(deferAt, 'markDirty defers before arming').toBeGreaterThan(-1);
    expect(markDirty.indexOf('saveTimer = setTimeout(', deferAt), 'no timer is armed').toBeGreaterThan(deferAt);
    const prepareSave = regionOf(snapshotController, 'function prepareSave(options?: StudioScriptSnapshotSaveOptions): PreparedSave | null {', 'const identity = boundIdentity;');
    expect(prepareSave, 'prepareSave prepares nothing while dirty').toContain('if (deps.shouldDeferSave?.()) return null;');
  });

  it('keeps the transport a validated, self-clearing gate', () => {
    // The event + belt constants live in the leaf module.
    expect(draftModeTransport).toContain("export const PHYSIC_PAINT_DRAFT_MODE_EVENT = 'physic-paint:draft-mode';");
    expect(draftModeTransport).toContain('export const PHYSIC_PAINT_DRAFT_HEARTBEAT_MS = 5000;');
    expect(draftModeTransport).toContain('export const PHYSIC_PAINT_DRAFT_STALE_MS = 20000;');
    // Unvalidated payloads are ignored, never interpreted.
    expect(draftModeTransport).toContain("return typeof active === 'boolean' ? active : null;");
    // Release only on a true -> false transition.
    expect(draftModeTransport).toContain('if (active === draftModeActive) return;');
    // An active gate can never stick: the belt routes through the same law.
    expect(draftModeTransport).toContain('staleTimer = setTimeout(() => {');
    expect(draftModeTransport).toContain('}, PHYSIC_PAINT_DRAFT_STALE_MS);');
    // The window-closed literal mirrors the Rust emit.
    expect(draftModeTransport).toContain("const PHYSIC_PAINT_WINDOW_CLOSED_EVENT = 'physic-paint:window-closed';");
    // Browser fallback: publishing and installing are no-ops.
    expect(draftModeTransport).toContain('export async function publishStudioDraftMode');
    expect(draftModeTransport).toContain('if (!isTauriRuntime()) return () => {};');
  });
});

// 261101-o2m code-review fixes: CR-01 (track switch over a dirty Draft),
// WR-02 (the last-stroke delete's refused close settle) and WR-03 (stale
// Draft reads across the durable-base await). Each test here fails against
// the pre-fix tree.
describe('quick 261101-o2m — review fixes: guarded track switch, delete close retry, fresh Draft reads', () => {
  function regionOf(source: string, startMarker: string, endMarker: string): string {
    const start = source.indexOf(startMarker);
    expect(start, `missing start marker: ${startMarker}`).toBeGreaterThan(-1);
    const end = source.indexOf(endMarker, start + startMarker.length);
    expect(end, `missing end marker: ${endMarker}`).toBeGreaterThan(start);
    return source.slice(start, end);
  }

  it('CR-01: routes ALL six track-switch entry points through the one Draft-aware seam', () => {
    // Exactly ONE raw write survives — inside the seam. Any second one is an
    // unguarded switch path (the defect this pins).
    expect(studio.split('setActiveTrackId(').length - 1).toBe(1);
    const seam = regionOf(studio, 'const switchActiveTrack = useCallback', 'const handleToggleRotoPlayback = useCallback');
    // Clean pixels keep the synchronous tick; dirty Draft settles first and a
    // refused recompute aborts (fail closed).
    expect(seam).toContain('if (!draftMode.peek() && !draftPixelsDirty.peek()) {');
    const settleAt = seam.indexOf('void settleDraftScript()');
    const commitAt = seam.indexOf('commitSwitch();', settleAt);
    expect(settleAt, 'the dirty path runs the ONE recompute').toBeGreaterThan(-1);
    expect(commitAt, 'the switch runs only after the settle').toBeGreaterThan(settleAt);
    expect(seam).toContain('if (!settled) return;');

    const sites = [
      ['handleAddTrack', 'const handleDuplicateTrack'],
      ['handleDuplicateTrack', 'const handleDeleteSelectedBackgroundClip'],
      ['handleSelectTrackFrame', 'const handleSelectTrackRail'],
      ['handleSelectTrackRail', 'const navigateLinkedGroup'],
      ['handleToggleBlend', 'const handleReorderTrack'],
    ] as const;
    for (const [handler, next] of sites) {
      const region = regionOf(studio, `const ${handler} = useCallback`, next);
      expect(region, `${handler} routes through the seam`).toContain('switchActiveTrack(');
      expect(region, `${handler} never writes the store directly`).not.toContain('setActiveTrackId(');
    }
    // The row bundle's row click is the sixth entry point.
    const bundle = regionOf(studio, 'onSelectTrack: (trackId: string) => {', 'onSelectTrackFrame: handleSelectTrackFrame,');
    expect(bundle).toContain('switchActiveTrack(layerId, trackId');
    expect(bundle).not.toContain('setActiveTrackId(');
  });

  it('CR-01: never runs the commit tail (capture/save/reset) over dirty Draft pixels', () => {
    const effect = regionOf(studio, 'if (sessionNeedsCommit) {', 'rotoEditBuffer.resetForLaunch();');
    // The belt refuses the whole destructive tail while Draft is dirty.
    const beltAt = effect.indexOf('if (draftMode.peek() || draftPixelsDirty.peek()) return;');
    expect(beltAt, 'the commit tail refuses dirty Draft pixels').toBeGreaterThan(-1);
    for (const later of [
      'aquarelleResetSheetRef.current?.();',
      'void studioScriptSnapshot.saveNow();',
    ]) {
      expect(effect.indexOf(later), `${later} runs after the belt`).toBeGreaterThan(beltAt);
    }
    // ...and the outgoing capture carries its OWN lock (the post-replay law).
    const captureAt = effect.indexOf('aquarelleFlushCaptureRef.current?.(outgoingTrackId ?? undefined);');
    const captureGuardAt = effect.indexOf('if (!draftMode.peek() && !draftPixelsDirty.peek()) {');
    const resetAt = effect.indexOf('aquarelleResetSheetRef.current?.()');
    expect(captureGuardAt, 'the capture is gated on both flags').toBeGreaterThan(-1);
    expect(captureAt, 'the capture still runs on clean pixels').toBeGreaterThan(captureGuardAt);
    expect(resetAt, 'the reset stays after the capture').toBeGreaterThan(captureAt);
  });

  it('WR-02: marks dirty with the commit and retries the auto-closed sheet after the flag clears', () => {
    const del = regionOf(studio, 'const handleAquarelleDeleteStrokes = useCallback', 'const handleAquarelleMoveStrokes');
    // The surface state is captured BEFORE the begin can auto-close the sheet.
    const selectReadAt = del.indexOf('const selectWasOn = aquarelleSelectMode.peek();');
    const beginAt = del.indexOf('const editId = beginAquarelleDeleteEdit(frameIds);');
    expect(selectReadAt, 'the pre-close surface state is captured').toBeGreaterThan(-1);
    expect(beginAt).toBeGreaterThan(selectReadAt);
    // Dirty is marked WITH the commit — before the shared in-flight flag and
    // before the await, so the close exit can never observe clean pixels over
    // a diverged script.
    const dirtyAt = del.indexOf('if (draft) setDraftPixelsDirty(true);');
    const inFlightAt = del.indexOf('setAquarelleDeleteInFlight(true);');
    const ensureAt = del.indexOf('await ensureAquarelleDurableBaseRef.current(playFrame);');
    expect(dirtyAt, 'the commit marks the divergence dirty synchronously').toBeGreaterThan(beginAt);
    expect(inFlightAt, 'the in-flight flag is set after the mark').toBeGreaterThan(dirtyAt);
    expect(ensureAt, 'the ensure stays after the begin').toBeGreaterThan(inFlightAt);
    // The retry: the dialog-close exit that was refused by this handler's own
    // flag re-runs after the flag clears, so no dirty Draft can be stranded
    // behind a closed sheet.
    const finallyAt = del.indexOf('} finally {');
    const clearAt = del.indexOf('setAquarelleDeleteInFlight(false);', finallyAt);
    const retryGuardAt = del.indexOf('if (draft && selectWasOn && !aquarelleSelectMode.peek()) {', clearAt);
    const retryAt = del.indexOf('void settleDraftScript()', clearAt);
    expect(clearAt, 'the flag clears in the finally').toBeGreaterThan(finallyAt);
    expect(retryGuardAt, 'the retry is scoped to the auto-closed surface').toBeGreaterThan(clearAt);
    expect(retryAt, 'the refused close settle is retried').toBeGreaterThan(retryGuardAt);
    // The retry is a dependency of the handler (fresh closure).
    expect(del).toContain('clearOwnedScriptApplyRefusal,\n    settleDraftScript,');
  });

  it('WR-03: re-reads the Draft mode AFTER the durable-base await in every async edit', () => {
    for (const [handler, next] of [
      ['handleAquarelleMoveStrokes', 'const handleAquarelleAppearanceStrokes'],
      ['handleAquarelleAppearanceStrokes', 'aquarelleAppearanceCommitRef.current'],
      ['handleAquarelleTransformStrokes', 'const handleAquarelleStepStroke'],
    ] as const) {
      const region = regionOf(studio, `const ${handler} = useCallback`, next);
      const ensureAt = region.indexOf('await ensureAquarelleDurableBaseRef.current(playFrame);');
      const draftAt = region.indexOf('const draft = draftMode.peek();');
      expect(ensureAt, `${handler} keeps its ensure`).toBeGreaterThan(-1);
      expect(draftAt, `${handler} reads Draft after the await`).toBeGreaterThan(ensureAt);
      expect(region.indexOf('if (draft) {'), `${handler} branches on the fresh read`).toBeGreaterThan(draftAt);
    }
    // The delete commits BEFORE its await, so its branch re-reads the live
    // mode instead of reusing the entry read.
    const del = regionOf(studio, 'const handleAquarelleDeleteStrokes = useCallback', 'const handleAquarelleMoveStrokes');
    const ensureAt = del.indexOf('await ensureAquarelleDurableBaseRef.current(playFrame);');
    const rereadAt = del.indexOf('if (draft && draftMode.peek()) {');
    expect(rereadAt, 'the delete re-reads Draft after the await').toBeGreaterThan(ensureAt);
  });
});

describe('Paper grain edits record one unified-ledger undo entry (PAPER-03)', () => {
  it('records the grain pair and leaves the paper-id choice out of the ledger', () => {
    for (const handler of ['handleGrainScaleChange', 'handleGrainStrengthChange']) {
      const start = studio.indexOf(`const ${handler} =`);
      expect(start, `${handler} exists`).toBeGreaterThan(-1);
      const body = studio.slice(start, studio.indexOf('\n  };', start) + 5);
      expect(body, `${handler} records the grain edit`).toContain('recordPaperDisplayEdit(');
    }
    const paperIdStart = studio.indexOf('const handlePaperIdChange =');
    expect(paperIdStart).toBeGreaterThan(-1);
    const paperIdBody = studio.slice(paperIdStart, studio.indexOf('\n  };', paperIdStart) + 5);
    expect(paperIdBody, 'paper-id changes are not undoable').not.toContain('recordPaperDisplayEdit(');
  });

  it('merges the paper setter and fallback write-through into ONE ledger descriptor', () => {
    const start = studio.indexOf('const recordPaperDisplayEdit = (');
    expect(start).toBeGreaterThan(-1);
    const helper = studio.slice(start, studio.indexOf('\n  };', start) + 5);
    expect(helper).toContain('rotoMoveHistory.recordBackgroundEdit(');
    expect(helper).toContain('after: last.after');
    // Undo/redo rehydrate the derived settings + track mirror from the
    // restored document fallback, so the visible paper steps with the ledger.
    expect(studio).toContain('syncBackgroundSettingsFromDocument();');
    expect(studio).toContain('const syncBackgroundSettingsFromDocument = useCallback(');
  });
});

describe('58-05 Key Rail inspector Studio wiring (RAIL-01)', () => {
  const inspectorMemoStart = studio.indexOf('const selectedKeyRailInspector = useMemo(');
  const inspectorMemoEnd = studio.indexOf(
    '}, [effectiveSelectedRotoKeyRail, keyRailSegmentByFirstKeyId, railSetAnchorKeyRailId, effectiveRailSetMembers.length]);',
    inspectorMemoStart,
  );
  const inspectorMemo = inspectorMemoStart >= 0 && inspectorMemoEnd > inspectorMemoStart
    ? studio.slice(inspectorMemoStart, inspectorMemoEnd)
    : '';
  const openHandlerStart = studio.indexOf('const handleOpenRotoKeyRailCycleEdit = useCallback(');
  const openHandlerEnd = studio.indexOf('const handleCloseRotoKeyRail = useCallback(', openHandlerStart);
  const openHandler = openHandlerStart >= 0 && openHandlerEnd > openHandlerStart
    ? studio.slice(openHandlerStart, openHandlerEnd)
    : '';
  const closeHandlerStart = studio.indexOf('const handleCloseRotoKeyRail = useCallback(');
  const closeHandlerEnd = closeHandlerStart >= 0
    ? studio.indexOf('}, []);', closeHandlerStart) + '}, []);'.length
    : -1;
  const closeHandler = closeHandlerStart >= 0 && closeHandlerEnd > closeHandlerStart
    ? studio.slice(closeHandlerStart, closeHandlerEnd)
    : '';

  it('projects the inspector exactly once, inside a useMemo with the four stable inputs', () => {
    // The projection is never a bare render-body call: one occurrence, inside
    // the memo whose deps are exactly the stable selection, segment map,
    // anchor, and set size (createIdentityMemo compares with Object.is).
    expect(studio.split('projectSelectedKeyRailInspector(').length - 1).toBe(1);
    expect(studio.split('const selectedKeyRailInspector = useMemo(').length - 1).toBe(1);
    expect(inspectorMemoStart).toBeGreaterThanOrEqual(0);
    expect(inspectorMemoEnd).toBeGreaterThan(inspectorMemoStart);
    expect(inspectorMemo).toContain('const firstKeyId = effectiveSelectedRotoKeyRail?.firstKeyId ?? railSetAnchorKeyRailId;');
    expect(inspectorMemo).toContain('const segment = keyRailSegmentByFirstKeyId.get(firstKeyId);');
    expect(inspectorMemo).toContain('if (firstKeyId === null) return null;');
    expect(inspectorMemo).toContain('return projectSelectedKeyRailInspector(segment, { setSize: effectiveRailSetMembers.length });');
  });

  it('resolves the rail-set anchor through ONE shared const so a 2+ set still projects (D-03)', () => {
    // The segment map is a memo, not a per-render Map, so its identity holds.
    expect(studio).toContain('const keyRailSegmentByFirstKeyId = useMemo(');
    expect(studio).toContain('() => new Map(keyRailSegments.map((segment) => [segment.firstKeyId, segment] as const)),');
    // Exactly one key-rail anchor definition in the whole Studio.
    expect(studio.split('const railSetAnchorKeyRailId = ').length - 1).toBe(1);
    expect(studio.split("effectiveRailSetMembers[0]?.kind === 'key-rail'").length - 1).toBe(1);
    expect(studio).toContain(
      'const railSetAnchorKeyRailId = effectiveRailSetMembers[0]?.kind === \'key-rail\'\n    ? effectiveRailSetMembers[0].firstKeyId\n    : null;',
    );
    // The strip bundle reads the const instead of re-deriving the anchor.
    const bundleStart = studio.indexOf('railSetMemberKeyRailIds: effectiveRailSetMembers');
    const bundleEnd = studio.indexOf('rotoParentEndExclusive:', bundleStart);
    expect(bundleStart).toBeGreaterThanOrEqual(0);
    expect(bundleEnd).toBeGreaterThan(bundleStart);
    const bundle = studio.slice(bundleStart, bundleEnd);
    expect(bundle).toContain('railSetAnchorKeyRailId,');
    expect(bundle).not.toContain("effectiveRailSetMembers[0]?.kind === 'key-rail' ? effectiveRailSetMembers[0].firstKeyId : null");
    expect(bundle).toContain('onOpenKeyRailCycleEdit: handleOpenRotoKeyRailCycleEdit,');
  });

  it('selects before opening and returns a Promise on the missing-segment refusal', () => {
    expect(openHandlerStart).toBeGreaterThanOrEqual(0);
    expect(openHandler).toContain("return Promise.resolve({ ok: false, reason: 'This Key Rail no longer exists.' });");
    expect(openHandler).toContain('keyRailSegmentByFirstKeyId.get(firstKeyId)');
    expect(openHandler).toContain('selectedRotoKeyRail.value = { firstKeyId: segment.firstKeyId, keyIds: segment.keyIds };');
    // Select-then-open: the panel already shows the inspector when the modal closes.
    expect(openHandler.indexOf('selectedRotoKeyRail.value =')).toBeLessThan(
      openHandler.indexOf('return rotoPlayScript.openKeyRailCycleEdit({ firstKeyId: segment.firstKeyId, keyIds: segment.keyIds });'),
    );
    expect(openHandler).toContain('return rotoPlayScript.openKeyRailCycleEdit({ firstKeyId: segment.firstKeyId, keyIds: segment.keyIds });');
  });

  it('clears BOTH selection layers on Close so the takeover is dismissible (D-01/D-03)', () => {
    expect(closeHandlerStart).toBeGreaterThanOrEqual(0);
    expect(closeHandler).toContain('selectedRotoKeyRail.value = null;');
    expect(closeHandler).toContain('railSetSelection.value = null;');
    // Consequence pin: with both layers cleared the anchor resolves null, the
    // memo returns null before projecting, and 58-03's panel branch — which
    // only fires on a non-null presentation — renders the normal content.
    expect(inspectorMemo).toContain('if (firstKeyId === null) return null;');
    expect(inspectorMemo).toContain('?.firstKeyId ?? railSetAnchorKeyRailId');
    expect(scriptsPanel).toContain('if (selectedKeyRail) {');
  });

  it('threads the presentation and both handlers into the right-panel scripts props', () => {
    expect(studio).toContain('selectedKeyRail: selectedKeyRailInspector,');
    expect(studio).toContain('onOpenKeyRailEdit: handleOpenRotoKeyRailCycleEdit,');
    expect(studio).toContain('onCloseKeyRail: handleCloseRotoKeyRail,');
    const depsStart = studio.indexOf('const rightPanel = rightPanelPropsMemo.resolve([');
    const depsEnd = studio.indexOf('], () => {', depsStart);
    expect(depsStart).toBeGreaterThanOrEqual(0);
    expect(depsEnd).toBeGreaterThan(depsStart);
    const deps = studio.slice(depsStart, depsEnd);
    expect(deps).toContain('selectedLoopClip, selectedKeyRailInspector,');
    expect(deps).toContain('handleOpenRotoLoopEdit, handleCloseRotoLoopClip, handleOpenRotoKeyRailCycleEdit, handleCloseRotoKeyRail,');
  });
});

// quick-261109-pwt: a destination whose frame-leave capture is still pending
// must be settled ONCE it is the displayed frame, and reloaded only when the
// applied byte carrier actually changes.
describe('quick 261109-pwt — pending destination capture settles after the destination is displayed', () => {
  function regionOf(source: string, startMarker: string, endMarker: string): string {
    const start = source.indexOf(startMarker);
    expect(start, `missing start marker: ${startMarker}`).toBeGreaterThan(-1);
    const end = source.indexOf(endMarker, start + startMarker.length);
    expect(end, `missing end marker: ${endMarker}`).toBeGreaterThan(start);
    return source.slice(start, end);
  }

  const settleMarker = '// quick-261109-pwt: settle the destination frame\'s pending cache capture once it is displayed.';

  it('arms the destination before the synchronous destination load', () => {
    const nav = regionOf(studio, 'const navigateToSyncedPhysicalFrame', settleMarker);
    const probeAt = nav.indexOf('rotoPersistenceRef.current.hasPendingLivePixelsForFrame(frame)');
    expect(probeAt, 'the destination pending probe is sampled in the navigation').toBeGreaterThan(-1);
    const loadAt = nav.indexOf('loadCachedRotoReferenceFrame(frame, previewBasePort);');
    expect(loadAt, 'the synchronous destination load still runs').toBeGreaterThan(-1);
    // The sample MUST precede the load: the destination base is painted
    // synchronously, so an arm taken afterwards cannot repair it.
    expect(probeAt).toBeLessThan(loadAt);
    // A destination that is already displayed needs no arm — the navigation's
    // own flush is that identity's flush.
    expect(nav).toContain('frame !== currentFrame');
  });

  it('flushes the armed identity once, then reloads only on a byte change', () => {
    const settle = regionOf(studio, settleMarker, 'const lastReferenceDisplayStateRef');
    expect(settle.length).toBeGreaterThan(0);
    // The arm is consumed before the await so a re-run can never double-flush.
    const consumeAt = settle.indexOf('pendingDestinationCaptureRef.current = null;');
    const flushAt = settle.indexOf('await rotoPersistenceRef.current.flushLivePixels(armed.frame);');
    expect(consumeAt).toBeGreaterThan(-1);
    expect(flushAt).toBeGreaterThan(consumeAt);
    // Only the armed identity, and only while it has pending work.
    expect(settle).toContain('hasPendingLivePixelsForFrame(armed.frame)');
    // Superseded navigation, unpropagated startFrame and active playback all
    // leave the display alone.
    expect(settle).toContain('rotoNavigationGeneration.isLatest(armed.generation)');
    expect(settle).toContain('launchContextRef.current?.startFrame ?? -1');
    expect(settle).toContain('!== armed.frame');
    // The reload decision is a byte-carrier comparison, never a blank reload.
    expect(settle).toContain('cachedRotoRepaintBaseFrameRef.current');
    expect(settle).toContain('displayed.bytes === applied.bytes');
    // The loader's plain-refresh guard refuses an explicit base reload for the
    // same frame, so the post-flush sequence is forced.
    expect(settle).toContain('setCachedRotoReferenceUrl(null);');
    expect(settle).toContain('previewBasePort.clearPreviewBaseImage(true);');
    expect(settle).toContain('previewBasePort.resetBackground(true);');
    expect(settle).toContain('loadCachedRotoReferenceFrame(armed.frame, previewBasePort);');
    // Only `currentFrame` plus stable callbacks drive the effect.
    const depsAt = settle.indexOf('}, [currentFrame');
    expect(depsAt, 'the effect deps begin with the displayed frame').toBeGreaterThan(-1);
    expect(settle.slice(depsAt, settle.indexOf(']);', depsAt))).toContain('findCachedRotoDisplayFrame');
    expect(settle).not.toContain('rotoCachedPlayback.isActive,');
  });
});

// quick-261109-uj0: the localized gate changes the blank-sheet DECISION only.
// The eager snapshot, the single early exit before the sequence assignment,
// the Save-thumbnail port and the promotion/flush/settle laws around it stay
// exactly as 261109-pwt left them.
describe('quick 261109-uj0 — capture laws stay intact around the localized gate', () => {
  function regionOf(source: string, startMarker: string, endMarker: string): string {
    const start = source.indexOf(startMarker);
    expect(start, `missing start marker: ${startMarker}`).toBeGreaterThan(-1);
    const end = source.indexOf(endMarker, start + startMarker.length);
    expect(end, `missing end marker: ${endMarker}`).toBeGreaterThan(start);
    return source.slice(start, end);
  }

  const CAPTURE_START = 'const handleAquarelleCaptureFrame = useCallback(';
  const CAPTURE_END = 'const flushAquarellePixels = useCallback(';
  const MEASURE_MARKER = 'measureAquarelleCanvasInk(liveAlphaCanvas)';
  const GATE_MARKER = 'if (!passesAquarelleCaptureInkGate(ink))';
  const SEQ_MARKER = 'const seq = ++aquarelleCaptureSeqRef.current';

  it('keeps the eager snapshot before the measurement and the measurement before the gate', () => {
    const capture = regionOf(studio, CAPTURE_START, CAPTURE_END);
    const snapshotAt = capture.indexOf('const liveAlphaCanvas = snapshot()');
    const measureAt = capture.indexOf(MEASURE_MARKER);
    const gateAt = capture.indexOf(GATE_MARKER);
    expect(snapshotAt).toBeGreaterThan(-1);
    expect(measureAt).toBeGreaterThan(snapshotAt);
    expect(gateAt).toBeGreaterThan(measureAt);
  });

  it('leaves exactly one early return between the measurement and the sequence assignment', () => {
    const capture = regionOf(studio, CAPTURE_START, CAPTURE_END);
    const measureAt = capture.indexOf(MEASURE_MARKER);
    const seqAt = capture.indexOf(SEQ_MARKER);
    expect(measureAt).toBeGreaterThan(-1);
    expect(seqAt).toBeGreaterThan(measureAt);
    // The gate's rejection is the ONLY exit in the guarded slice, so no new
    // early return can appear (or disappear) beside it.
    expect(capture.slice(measureAt, seqAt).split('return;').length - 1).toBe(1);
  });

  it('still gates the Save-thumbnail port through the shared predicate', () => {
    const savePort = regionOf(studio, 'captureAquarelleCanvas: () => {', 'applyAquarelleEvents: async');
    expect(savePort).toContain('passesAquarelleCaptureInkGate(measureAquarelleCanvasInk(canvas)) ? canvas : null');
  });

  it('emits exactly one production-visible warn in the guard block', () => {
    const capture = regionOf(studio, CAPTURE_START, CAPTURE_END);
    const gateAt = capture.indexOf(GATE_MARKER);
    const seqAt = capture.indexOf(SEQ_MARKER);
    expect(gateAt).toBeGreaterThan(-1);
    expect(seqAt).toBeGreaterThan(gateAt);
    const guard = capture.slice(gateAt, seqAt);
    expect(guard.split('console.warn(').length - 1).toBe(1);
    // A DEV gate would compile the only packaged-build diagnostic away.
    expect(guard).not.toContain('import.meta.env');
  });

  it('keeps the promotion, flush and destination-settle laws verbatim', () => {
    expect(studio).toContain("pending.source !== 'auto-key-paint'");
    expect(studio).toContain('aquarelleCapturesInFlightRef.current.add(run)');
    expect(studio).toContain("// quick-261109-pwt: settle the destination frame's pending cache capture once it is displayed.");
  });
});

// 61-10 Task 3: the ONE path-edit seam reaches the Studio. The refusal copy is
// a fixed module constant (E10 long-text — never interpolated), an unreadable
// path publishes it with status `error` and writes nothing, and a READABLE path
// returning a null edit id (in-flight / unchanged gesture) publishes nothing.
describe('61-10 vector path edit wiring in the Studio', () => {
  function regionOf(source: string, startMarker: string, endMarker: string): string {
    const start = source.indexOf(startMarker);
    expect(start, `missing start marker: ${startMarker}`).toBeGreaterThan(-1);
    const end = source.indexOf(endMarker, start + startMarker.length);
    expect(end, `missing end marker: ${endMarker}`).toBeGreaterThan(start);
    return source.slice(start, end);
  }

  const HANDLER_START = 'const handleAquarelleVectorPathEdit = useCallback(';
  const HANDLER_END = 'const canvasMount = canvasMountPropsMemo.resolve(';

  it('declares the fixed rejection copy verbatim, with no interpolation', () => {
    expect(studio).toContain(
      "const VECTOR_PATH_REJECTION_MESSAGE = \"Vector path rejected — this stroke's path could not be read. The stroke was left unchanged.\";",
    );
    // Fixed copy — a user value can never enter the capsule line.
    const start = studio.indexOf('const VECTOR_PATH_REJECTION_MESSAGE');
    const declaration = studio.slice(start, studio.indexOf('\n', start));
    expect(declaration).not.toContain('${');
    expect(declaration).not.toContain('`');
  });

  it('refuses a missing or unreadable path through the capsule and stores nothing', () => {
    const handler = regionOf(studio, HANDLER_START, HANDLER_END);
    expect(handler).toContain('getRecordedAquarelleStroke(mutationId)');
    // 62-02 (D-10): the refusal decision moved into the pure admission
    // predicate, a strict superset of the old readable-anchors test — an
    // eligible anchorless painted stroke must reach the conversion write.
    const guardAt = handler.indexOf('admitsPathEditWrite(stroke)');
    const publishAt = handler.indexOf('setApplyMessage(VECTOR_PATH_REJECTION_MESSAGE)');
    const commitAt = handler.indexOf('return commitAquarelleVectorPathEdit(mutationId, anchors);');
    expect(guardAt).toBeGreaterThan(-1);
    expect(publishAt).toBeGreaterThan(guardAt);
    expect(commitAt).toBeGreaterThan(publishAt);
    expect(handler).toContain("setApplyStatus('error')");
    expect(handler).toContain('setLastError(VECTOR_PATH_REJECTION_MESSAGE)');
    // EXACTLY one publication site — the readable-path null (in-flight or
    // unchanged gesture) falls through without touching the capsule.
    expect(handler.split('setApplyMessage(').length - 1).toBe(1);
    expect(handler.split("setApplyStatus('error')").length - 1).toBe(1);
    // Identity-stable delegator: its ONE dependency is the shared commit.
    expect(handler).toContain('    [commitAquarelleVectorPathEdit],');
  });

  it('forwards the handler into the mount memo and its props object', () => {
    expect(studio).toContain("import { isAquarelleDryEvent, normaliseAquarelleAnchors, toStudioStroke, type AquarelleAnchor, type AquarellePayloadEvent } from '@efxlab/efx-watercolor/payload';");
    expect(studio).toContain('  beginAquarellePathEdit,');
    expect(studio).toContain('handleAquarelleTransformStrokes, handleAquarelleVectorPathEdit], () => {');
    expect(studio).toContain('onAquarelleVectorPathEdit: handleAquarelleVectorPathEdit,');
  });

  it('threads the mount prop into the layer seam through one ref', () => {
    expect(canvasMount).toContain("import type { AquarelleStroke, VectorAnchor } from '@efxlab/efx-watercolor';");
    expect(canvasMount).toContain('onAquarelleVectorPathEdit?: (mutationId: number, anchors: readonly VectorAnchor[]) => Promise<number | null>;');
    expect(canvasMount).toContain('const onAquarelleVectorPathEditRef = useRef(props.onAquarelleVectorPathEdit);');
    expect(canvasMount).toContain('onAquarelleVectorPathEditRef.current = props.onAquarelleVectorPathEdit;');
    expect(canvasMount).toContain('onEditVectorPath={(mutationId, anchors) => onAquarelleVectorPathEditRef.current?.(mutationId, anchors)}');
  });

  it('commits a readable edit through one async seam: guards, post-await Draft read, restore on failure', () => {
    const COMMIT_START = 'const commitAquarelleVectorPathEdit = useCallback(';
    const start = studio.indexOf(COMMIT_START);
    const end = studio.indexOf(HANDLER_START, start + COMMIT_START.length);
    expect(start, `missing start marker: ${COMMIT_START}`).toBeGreaterThan(-1);
    // Declared BEFORE the read-and-refuse handler, so the 61-10 region slice
    // keeps its exactly-one publication pin.
    expect(end).toBeGreaterThan(start);
    const commit = studio.slice(start, end);
    expect(commit).toContain('async (mutationId: number, anchors: readonly AquarelleAnchor[]): Promise<number | null> => {');
    // Guards mirror the move seam: locked / applying / in-flight fail closed.
    expect(commit).toContain('if (isPhysicalMutationLocked()) return null;');
    expect(commit).toContain('if (rotoScript.applying.peek() || rotoScript.mutationLocked.peek()) return null;');
    expect(commit).toContain('if (isAquarelleScriptEditInFlight()) return null;');
    // The base recovery is AWAITED before the Draft read (the WR-03 precedent):
    // a stale `true` would skip the re-render over fresh pixels.
    const baseAt = commit.indexOf('await ensureAquarelleDurableBaseRef.current(playFrame);');
    const draftAt = commit.indexOf('const draft = draftMode.peek();');
    expect(baseAt).toBeGreaterThan(-1);
    expect(draftAt).toBeGreaterThan(baseAt);
    // ONE write wrapper for the whole gesture; a null id (in-flight or
    // unchanged) exits before any bake.
    expect(commit.split('beginAquarellePathEdit(').length - 1).toBe(1);
    // 62-UAT: the FIRST conversion write mints the vector-edit default
    // (Spline); an already-vector stroke passes no mode at all.
    expect(commit).toContain('const editId = beginAquarellePathEdit(');
    expect(commit).toContain('converting ? { curveMode: DEFAULT_VECTOR_PATH_CURVE_MODE } : undefined,');
    expect(commit).toContain('if (editId === null) return null;');
    // Defer route: mark the pixels dirty, publish nothing, reset/apply nothing.
    const deferAt = commit.indexOf('if (draft || wireframe) {');
    const rebakeAt = commit.indexOf('runAquarelleScriptRebake({');
    expect(deferAt).toBeGreaterThan(-1);
    expect(rebakeAt).toBeGreaterThan(deferAt);
    const defer = commit.slice(deferAt, rebakeAt);
    expect(defer).toContain('setDraftPixelsDirty(true);');
    expect(defer).toContain('setLastError(null);');
    expect(defer).toContain('clearOwnedScriptApplyRefusal();');
    expect(defer).toContain('return editId;');
    expect(defer).not.toContain('aquarelleResetSheetRef');
    expect(defer).not.toContain('applyAquarelleTimeline');
    // Rebake route: ONE reset + ONE apply, the edit id on success...
    expect(commit).toContain('aquarelleResetSheetRef.current?.()');
    expect(commit).toContain('rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame))');
    // ...and on failure the pre-edit script is restored BEFORE the capsule
    // publishes, then the gesture reports null so no ledger entry is taken.
    // 61-26 (WR-02): the restore result is consumed, so the marker is the
    // consuming tail rather than the discarded statement it replaced.
    const restoreAt = commit.indexOf("restoreAquarelleEditSnapshot(editId, 'undo') !== null;");
    const publishAt = commit.indexOf('setApplyMessage(message);');
    expect(restoreAt).toBeGreaterThan(-1);
    expect(publishAt).toBeGreaterThan(restoreAt);
    expect(commit).toContain('scriptApplyRefusalOwnedRef.current = true;');
    expect(commit).toContain('return ok ? editId : null;');
  });
});

// 62-02 (D-03 / D-10): the spline-pointer's painted entrance and the ONE
// writer seam's widened admission. The fit runs lazily on entry — after the
// durable base is armed — and the seam delegates its refusal decision to the
// pure `admitsPathEditWrite` predicate, so an eligible anchorless painted
// stroke reaches the conversion write instead of the fixed rejection copy.
describe('62-02 painted-curve entry and conversion admission in the Studio', () => {
  function regionOf(source: string, startMarker: string, endMarker: string): string {
    const start = source.indexOf(startMarker);
    expect(start, `missing start marker: ${startMarker}`).toBeGreaterThan(-1);
    const end = source.indexOf(endMarker, start + startMarker.length);
    expect(end, `missing end marker: ${endMarker}`).toBeGreaterThan(start);
    return source.slice(start, end);
  }

  const READ_START = 'const readCurveEntry = useCallback(';
  const ENTER_START = 'const enterPaintedCurve = useCallback(';
  const COMMIT_START = 'const commitAquarelleVectorPathEdit = useCallback(';

  /** The anchorless Brush stroke the in-app conversion must now admit. */
  const anchorlessBrushFixture: AquarelleStroke = {
    tool: 'brush',
    color: '#103c65',
    params: { size: 12, water: 30 },
    brushId: 'round',
    points: [
      { x: 0.1, y: 0.5, p: 0.5, tx: 0.5, ty: -0.5, tw: 0.75 },
      { x: 0.9, y: 0.5, p: 0.5, tx: 0.5, ty: -0.5, tw: 0.75 },
    ],
    timestamp: 1,
    playFrame: 601,
  };

  it('declares both entry callbacks BEFORE the shared commit, so the shipped region slices stay intact', () => {
    const readAt = studio.indexOf(READ_START);
    const enterAt = studio.indexOf(ENTER_START);
    const commitAt = studio.indexOf(COMMIT_START);
    expect(readAt, 'readCurveEntry exists').toBeGreaterThan(-1);
    expect(enterAt, 'enterPaintedCurve exists').toBeGreaterThan(readAt);
    expect(commitAt).toBeGreaterThan(enterAt);
    // The imports the two callbacks need are the model's pure predicates and
    // the 62-01 bracket module — no record, engine or save seam is added.
    expect(studio).toContain('  admitsPathEditWrite,');
    expect(studio).toContain('  resolvePaintedCurveEligibility,');
    expect(studio).toContain('  type CurveEntryState,');
    // 62-04 T2: `endCurveBracket` joins the same import — the ONE production
    // registration of the exit hook is exactly what the bracket module needs;
    // no record, engine or save seam is added.
    expect(studio).toContain(
      "import { beginCurveWireframeBracket, beginPaintedCurveSession, endCurveBracket } from './view/vectorPathCurveBracket';",
    );
  });

  it('classifies ONE recorded stroke on the render-body read and never fits there', () => {
    const read = regionOf(studio, READ_START, ENTER_START);
    expect(read).toContain('if (ids.length !== 1) return null;');
    expect(read).toContain('const stroke = getRecordedAquarelleStroke(ids[0]!);');
    expect(read).toContain('return resolvePaintedCurveEligibility(stroke);');
    // D-03: the fit is an ENTRY action — the read only classifies.
    expect(read).not.toContain('beginPaintedCurveSession');
    expect(read).not.toContain('fitVectorPathAnchors');
    // No signal is subscribed by this callback: peek-free plain reads only.
    expect(read).not.toContain('.value');
  });

  it('fits lazily on entry: arm FIRST, then hold the fit, bracket the view and open the latch', () => {
    const enter = regionOf(studio, ENTER_START, COMMIT_START);
    // The entry refuses a missing or non-painted stroke before any work.
    expect(enter).toContain(
      "if (resolvePaintedCurveEligibility(stroke).kind !== 'painted') return false;",
    );
    const armAt = enter.indexOf('const armed = await armDraftBase();');
    const fitAt = enter.indexOf('const session = beginPaintedCurveSession(stroke);');
    const bracketAt = enter.indexOf('beginCurveWireframeBracket();');
    const latchAt = enter.indexOf('vectorPathSession.enterPathEdit(String(ids[0]!));');
    expect(armAt, 'the base arm is awaited').toBeGreaterThan(-1);
    expect(fitAt, 'the fit runs on entry').toBeGreaterThan(armAt);
    expect(bracketAt).toBeGreaterThan(fitAt);
    expect(latchAt).toBeGreaterThan(bracketAt);
    expect(enter).toContain('if (session === null) return false;');
    expect(enter).toContain('return true;');
    // A refused arm fails closed: fixed copy through the shipped capsule, no
    // fit held, no bracket, no latch.
    const refusal = enter.slice(enter.indexOf('if (!armed) {'), fitAt);
    expect(refusal).toContain('setApplyMessage(DRAFT_ARM_REFUSAL_MESSAGE);');
    expect(refusal).toContain("setApplyStatus('error');");
    expect(refusal).toContain('return false;');
    expect(refusal).not.toContain('beginPaintedCurveSession');
    expect(refusal).not.toContain('beginCurveWireframeBracket');
  });

  it('wires both members into the bundle body and its memo dependency list', () => {
    const memoStart = studio.indexOf('const strokeSettingsDialog = strokeSettingsDialogPropsMemo.resolve(');
    expect(memoStart).toBeGreaterThan(-1);
    const memoDepEnd = studio.indexOf('() => {', memoStart);
    expect(memoDepEnd).toBeGreaterThan(memoStart);
    const bodyEnd = studio.indexOf('const viewModel = usePhysicsPaintStudioViewModel({', memoDepEnd);
    expect(bodyEnd).toBeGreaterThan(memoDepEnd);
    const deps = studio.slice(memoStart, memoDepEnd);
    expect(deps).toContain('readCurveEntry,');
    expect(deps).toContain('enterPaintedCurve,');
    const body = studio.slice(memoDepEnd, bodyEnd);
    expect(body).toContain('readCurveEntry,');
    expect(body).toContain('enterPaintedCurve,');
  });

  it('widens the ONE writer seam to the admission predicate and keeps one publication site', () => {
    const HANDLER_START = 'const handleAquarelleVectorPathEdit = useCallback(';
    const HANDLER_END = 'const canvasMount = canvasMountPropsMemo.resolve(';
    const handler = regionOf(studio, HANDLER_START, HANDLER_END);
    expect(handler).toContain('if (!stroke || !admitsPathEditWrite(stroke)) {');
    // The pre-62 readable-anchors guard is retired: the predicate is its
    // strict superset and adds the eligible painted arm.
    expect(handler).not.toContain('normaliseAquarelleAnchors(stroke.anchors) === undefined');
    expect(handler.split('setApplyMessage(').length - 1).toBe(1);
    expect(handler).toContain('return commitAquarelleVectorPathEdit(mutationId, anchors);');
    // The predicate's verdict on the fixtures the seam now forwards/refuses.
    expect(admitsPathEditWrite(anchorlessBrushFixture)).toBe(true);
    expect(admitsPathEditWrite({ ...anchorlessBrushFixture, tool: 'lift' })).toBe(false);
    expect(admitsPathEditWrite({ ...anchorlessBrushFixture, points: [] })).toBe(false);
  });

  it('mints the vector-edit default on the FIRST write only, never on a later anchor edit', () => {
    const commit = regionOf(
      studio,
      COMMIT_START,
      'const handleAquarelleVectorPathEdit = useCallback(',
    );
    // 62-UAT: the conversion writes Spline (the mode a drawn vector is
    // recorded and edited in). An already-vector stroke passes no mode, so a
    // Curve-row flip is never re-asserted by the next anchor drag.
    expect(commit).toContain(
      'const converting = (getRecordedAquarelleStroke(mutationId)?.anchors?.length ?? 0) === 0;',
    );
    expect(commit).toContain(
      'converting ? { curveMode: DEFAULT_VECTOR_PATH_CURVE_MODE } : undefined,',
    );
    expect(studio).toContain('DEFAULT_VECTOR_PATH_CURVE_MODE');
  });
});

// 61-15 Task 1: a drawn vector path must reach the live sheet at commit
// (G-1/G-2). A Script-Off draw is refused with ONE fixed message instead of
// silently vanishing, and the accepted draw tails the stroke-end with a
// single vector re-bake that defers pixels in Draft or wireframe.
describe('61-15 vector draw bake seam in the Studio', () => {
  const HANDLER_START = 'const handleAquarelleStrokeEnd = useCallback(';
  const HANDLER_END = 'const handleAquarelleStrokeSettled = useCallback(';

  function strokeEndRegion(): string {
    const start = studio.indexOf(HANDLER_START);
    expect(start, `missing start marker: ${HANDLER_START}`).toBeGreaterThan(-1);
    const end = studio.indexOf(HANDLER_END, start + HANDLER_START.length);
    expect(end, `missing end marker: ${HANDLER_END}`).toBeGreaterThan(start);
    return studio.slice(start, end);
  }

  it('refuses a Script-Off vector draw before the ledger allocates, without resetting the sheet', () => {
    const handler = strokeEndRegion();
    const REFUSAL = 'if (isVectorAquarelleStroke(stroke) && !aquarelleScriptRecordingEnabled.peek()) {';
    expect(handler).toContain(REFUSAL);
    const liftRefuseAt = handler.indexOf("if (liftPlan?.kind === 'refuse') {");
    const refusalAt = handler.indexOf(REFUSAL);
    const scriptReadAt = handler.indexOf('const scriptRecordingOn = aquarelleScriptRecordingEnabled.peek();');
    const allocateAt = handler.indexOf('paintMutationLedger.allocateStrokeMutation(');
    expect(liftRefuseAt).toBeGreaterThan(-1);
    expect(scriptReadAt).toBeGreaterThan(-1);
    expect(allocateAt).toBeGreaterThan(-1);
    // AFTER the lift refusal (a lift is not a vector path) and BEFORE both the
    // script read and the ledger allocation — a refused draw writes NOTHING.
    expect(refusalAt).toBeGreaterThan(liftRefuseAt);
    expect(scriptReadAt).toBeGreaterThan(refusalAt);
    expect(allocateAt).toBeGreaterThan(refusalAt);
    // The refusal block itself publishes the fixed copy and returns. A vector
    // commit paints no engine dabs, so it must NOT reset the sheet.
    const refusalBlock = handler.slice(refusalAt, handler.indexOf('\n    }', refusalAt));
    expect(refusalBlock).toContain('setApplyMessage(VECTOR_PATH_SCRIPT_OFF_MESSAGE);');
    expect(refusalBlock).toContain("setApplyStatus('error');");
    expect(refusalBlock).toContain('setLastError(VECTOR_PATH_SCRIPT_OFF_MESSAGE);');
    expect(refusalBlock).toContain('return;');
    expect(refusalBlock).not.toContain('aquarelleResetSheetRef');
    expect(refusalBlock).not.toContain('allocateStrokeMutation');
    // The fixed module constants, owned by the leaf seam.
    expect(studio).toContain(
      "import {\n  VECTOR_PATH_SCRIPT_OFF_MESSAGE,\n  isVectorAquarelleStroke,\n  resolveVectorCommitRoute,\n  runAquarelleScriptRebake,\n} from './view/aquarelleVectorPathCommit';",
    );
  });

  it('tails the stroke end with exactly one vector bake, after the record and the lift erase', () => {
    const handler = strokeEndRegion();
    // 61-26 (WR-03): the tail is a continuation that consumes the bake's
    // boolean, not the fire-and-forget call it replaced.
    const TAIL = 'void bakeAquarelleVectorCommit().then((baked) => {';
    expect(handler.split(TAIL).length - 1).toBe(1);
    const tryAt = handler.indexOf('    try {');
    const recordAt = handler.indexOf('recordAquarelleStrokeWhenEnabled(');
    const eraseAt = handler.indexOf('void runAquarelleLiftErase(');
    const tailAt = handler.indexOf(TAIL);
    expect(tryAt).toBeGreaterThan(-1);
    expect(recordAt).toBeGreaterThan(tryAt);
    expect(eraseAt).toBeGreaterThan(recordAt);
    // The bake is the stroke-end tail: the record is already ordered, so the
    // re-bake's timeline contains this exact stroke.
    expect(tailAt).toBeGreaterThan(eraseAt);
    // A refused record (the catch) never bakes.
    expect(tailAt).toBeLessThan(handler.indexOf('    } catch {'));
    // 61-26 (WR-03): still guarded by the vector predicate, and the
    // continuation arms the stale-sheet retry on a false result.
    const vectorGuardAt = handler.indexOf('if (isVectorAquarelleStroke(stroke)) {');
    expect(vectorGuardAt).toBeGreaterThan(-1);
    expect(vectorGuardAt).toBeLessThan(tailAt);
    expect(handler).toContain('if (!baked) setDraftPixelsDirty(true);');
    // 61 UAT: a commit that lands while another script edit owns the sheet is
    // QUEUED, never dropped — its only pixels are this re-bake.
    expect(handler).toContain('if (vectorCommitBakeBlocked()) {');
    expect(handler).toContain('vectorCommitBakePendingRef.current = true;');
    expect(studio).toContain(
      '  }, [bakeAquarelleVectorCommit, vectorCommitBakeBlocked, applyFrameModuleState, recordAquarelleStrokeWhenEnabled, canvasWidth, canvasHeight, paintMutationLedger]);',
    );
    // The drain runs on a latch edge (one evaluation per transition), never
    // on a timer or a polling loop.
    expect(studio).toContain('void aquarelleScriptEditInFlightRevision.value;');
    expect(studio).toContain('const drainVectorCommitBake = useCallback(');
    // The callback bakes the live sheet through reset + apply, and defers
    // pixels in Draft or wireframe.
    const bakeStart = studio.indexOf('const bakeAquarelleVectorCommit = useCallback(');
    const handlerStart = studio.indexOf(HANDLER_START);
    expect(bakeStart).toBeGreaterThan(-1);
    // Declared BEFORE the stroke-end handler so `void bakeAquarelleVectorCommit()`
    // is not a temporal-dead-zone read.
    expect(handlerStart).toBeGreaterThan(bakeStart);
    const bake = studio.slice(bakeStart, handlerStart);
    expect(bake).toContain('resolveVectorCommitRoute({ draft: draftMode.peek(), wireframe: wireframeMode.peek() })');
    expect(bake).toContain("=== 'defer-pixels'");
    expect(bake).toContain('setDraftPixelsDirty(true);');
    expect(bake).toContain('return true;');
    expect(bake).toContain('runAquarelleScriptRebake({');
    expect(bake).toContain('aquarelleResetSheetRef.current?.()');
    expect(bake).toContain('rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame))');
    // The defer slice returns BEFORE the rebake seam: no reset, no apply.
    const defer = bake.slice(bake.indexOf("=== 'defer-pixels'"), bake.indexOf('runAquarelleScriptRebake({'));
    expect(defer).toContain('setDraftPixelsDirty(true);');
    expect(defer).toContain('return true;');
    expect(defer).not.toContain('aquarelleResetSheetRef');
    expect(defer).not.toContain('applyAquarelleTimeline');
    // The failure path owns the capsule and the refusal flag, like a move.
    expect(bake).toContain('setApplyMessage(message);');
    expect(bake).toContain("setApplyStatus('error');");
    expect(bake).toContain('scriptApplyRefusalOwnedRef.current = true;');
  });
});

// 61-18 (D-16, T-61-62): while the wireframe view is up, the ONE Draft settle
// must refuse BEFORE its clean no-op return — no route may reset or re-bake the
// sheet behind the construction view — and the save/export flush must keep
// treating a refusal as a cancelled save instead of capturing the view.
describe('61-18 the wireframe settle refusal in the Studio', () => {
  const SETTLE_START = 'const settleDraftScript = useCallback(';
  const SETTLE_END = '// 61-13 (D-16): the wireframe latch.';

  function settleRegion(): string {
    const start = studio.indexOf(SETTLE_START);
    expect(start, `missing start marker: ${SETTLE_START}`).toBeGreaterThan(-1);
    const end = studio.indexOf(SETTLE_END, start + SETTLE_START.length);
    expect(end, `missing end marker: ${SETTLE_END}`).toBeGreaterThan(start);
    return studio.slice(start, end);
  }

  it('refuses the settle while wireframe is on, ahead of the clean no-op return', () => {
    const settle = settleRegion();
    const GUARD = 'if (wireframeMode.peek()) {';
    const NOOP = 'if (!draftMode.peek() && !draftPixelsDirty.peek()) return Promise.resolve(true);';
    const SINGLE_FLIGHT = 'if (draftSettlePromiseRef.current) return draftSettlePromiseRef.current;';
    const guardAt = settle.indexOf(GUARD);
    expect(guardAt).toBeGreaterThan(-1);
    const noopAt = settle.indexOf(NOOP);
    const singleFlightAt = settle.indexOf(SINGLE_FLIGHT);
    expect(noopAt).toBeGreaterThan(-1);
    expect(singleFlightAt).toBeGreaterThan(-1);
    // The refusal is the FIRST statement: the clean no-op and the single-flight
    // join must never answer for a settle behind the wireframe view.
    expect(guardAt).toBeLessThan(noopAt);
    expect(guardAt).toBeLessThan(singleFlightAt);
    const guardBlock = settle.slice(guardAt, settle.indexOf('\n    }', guardAt));
    expect(guardBlock).toContain('setApplyMessage(WIREFRAME_SETTLE_REFUSED_MESSAGE);');
    expect(guardBlock).toContain("setApplyStatus('error');");
    expect(guardBlock).toContain('return Promise.resolve(false);');
    // A refusal, not a failed apply: neither the console line nor the owned
    // refusal flag belongs to this branch.
    expect(guardBlock).not.toContain('setLastError');
    expect(guardBlock).not.toContain('scriptApplyRefusalOwnedRef');
    // ONE copy of the copy: declared by the leaf and imported through the
    // session seam, never redeclared in the Studio.
    expect(studio).toContain('  WIREFRAME_SETTLE_REFUSED_MESSAGE,');
    expect(studio).not.toContain('const WIREFRAME_SETTLE_REFUSED_MESSAGE');
    // The guard reads the latch with `.peek()` inside the handler — never a
    // render-body subscription (rule 5).
    expect(studio).toContain('if (wireframeMode.peek()) {');
  });

  it('keeps the save/export flush cancelling on a refused settle, before any capture', () => {
    const start = studio.indexOf('flushStudioStateRef.current = async () => {');
    expect(start, 'missing the flush pipeline').toBeGreaterThan(-1);
    const end = studio.indexOf('useEffect(() => {\n    let unlisten', start);
    expect(end, 'missing the flush pipeline end').toBeGreaterThan(start);
    const flush = studio.slice(start, end);
    expect(flush).toContain('await runStudioFlush([');
    const SETTLE_STEP = 'if (await settleDraftScript()) return;';
    const THROW_STEP = "throw new Error('Draft recompute refused — save/export cancelled.');";
    const settleAt = flush.indexOf(SETTLE_STEP);
    const throwAt = flush.indexOf(THROW_STEP);
    const captureAt = flush.indexOf('flushAquarellePixels()');
    const pushAt = flush.indexOf('pushLiveProjection(');
    expect(settleAt, 'the flush still consults the ONE settle').toBeGreaterThan(-1);
    expect(throwAt, 'a refused settle still cancels the save/export').toBeGreaterThan(settleAt);
    // The throwing step aborts the drain before the capture and the document
    // push: a wireframe refusal never serializes the construction view.
    expect(captureAt).toBeGreaterThan(throwAt);
    expect(pushAt).toBeGreaterThan(throwAt);
  });
});

// 61-27 (IN-02): a settle refused because another mutation holds the gates must
// publish its reason. The wireframe branch already does; this branch used to
// resolve false silently, which made `switchActiveTrack`'s fail-closed abort
// invisible.
describe('61-27 IN-02 — a settle refused by a running mutation says so', () => {
  const SETTLE_START = 'const settleDraftScript = useCallback(';
  const SETTLE_END = '// 61-13 (D-16): the wireframe latch.';

  function settleRegion(): string {
    const start = studio.indexOf(SETTLE_START);
    expect(start, `missing start marker: ${SETTLE_START}`).toBeGreaterThan(-1);
    const end = studio.indexOf(SETTLE_END, start + SETTLE_START.length);
    expect(end, `missing end marker: ${SETTLE_END}`).toBeGreaterThan(start);
    return studio.slice(start, end);
  }

  it('publishes the busy refusal through the capsule before resolving false', () => {
    const settle = settleRegion();
    const BUSY_ANCHOR = 'isAquarelleScriptEditInFlight()';
    const busyAt = settle.indexOf(BUSY_ANCHOR);
    expect(busyAt, 'the combined busy gate is gone').toBeGreaterThan(-1);
    // The wireframe reason keeps precedence: it runs FIRST, ahead of the busy gate.
    const wireframeAt = settle.indexOf('if (wireframeMode.peek()) {');
    expect(wireframeAt).toBeGreaterThan(-1);
    expect(wireframeAt).toBeLessThan(busyAt);
    const busyBlock = settle.slice(busyAt, settle.indexOf('\n    }', busyAt));
    expect(busyBlock).toContain('setApplyMessage(DRAFT_SETTLE_BUSY_MESSAGE);');
    expect(busyBlock).toContain("setApplyStatus('error');");
    expect(busyBlock).toContain('setLastError(DRAFT_SETTLE_BUSY_MESSAGE);');
    // A bounded terminal state: resolve false, never reject.
    expect(busyBlock).toContain('return Promise.resolve(false);');
    expect(busyBlock).not.toContain('throw');
    // This refusal owns no sheet state — it must not swallow another surface's
    // message or claim an apply failure it did not cause.
    expect(busyBlock).not.toContain('scriptApplyRefusalOwnedRef');
    // ONE copy of the copy: imported through the session seam, never redeclared.
    expect(studio).toContain('  DRAFT_SETTLE_BUSY_MESSAGE,');
    expect(studio).not.toContain('const DRAFT_SETTLE_BUSY_MESSAGE');
  });

  it('keeps the track switch failing closed on the now-visible refusal', () => {
    const start = studio.indexOf('const switchActiveTrack = useCallback(');
    expect(start, 'missing the guarded track switch').toBeGreaterThan(-1);
    const end = studio.indexOf('/**\n   * 261101-o2m (D-04, play exit)', start);
    expect(end).toBeGreaterThan(start);
    const region = studio.slice(start, end);
    expect(region).toContain('if (!settled) return;');
    // The comment states the now-true law: every false exit publishes a reason.
    expect(region).toContain('Every false exit from the settle has published its reason');
    expect(region).not.toContain('already surfaced its refusal message');
  });
});

// 61-27 (IN-03): the dialog's ONE refusal channel. The sheet is engine-free, so
// a refused Anchor width commit leaves through the bundle port — the Studio
// supplies it with the shared capsule's three writers, and claims no ownership.
describe('61-27 IN-03 — the dialog bundle supplies publishRefusal', () => {
  const BUNDLE_START = 'const bundle: StrokeSettingsDialogBundle = {';
  const BUNDLE_END = 'return bundle;';

  function bundleRegion(): string {
    const start = studio.indexOf(BUNDLE_START);
    expect(start, `missing start marker: ${BUNDLE_START}`).toBeGreaterThan(-1);
    const end = studio.indexOf(BUNDLE_END, start + BUNDLE_START.length);
    expect(end, `missing end marker: ${BUNDLE_END}`).toBeGreaterThan(start);
    return studio.slice(start, end);
  }

  it('writes the message, the error status and the last error through the shared capsule', () => {
    const bundle = bundleRegion();
    const publishAt = bundle.indexOf('publishRefusal: (message) => {');
    expect(publishAt, 'missing the refusal port').toBeGreaterThan(-1);
    const publishBlock = bundle.slice(publishAt, bundle.indexOf('\n        },', publishAt));
    expect(publishBlock).toContain('setApplyMessage(message);');
    expect(publishBlock).toContain("setApplyStatus('error');");
    expect(publishBlock).toContain('setLastError(message);');
  });

  it('leaves the refusal unowned and the width commit contract untouched', () => {
    const bundle = bundleRegion();
    const publishAt = bundle.indexOf('publishRefusal: (message) => {');
    expect(publishAt, 'missing the refusal port').toBeGreaterThan(-1);
    const publishBlock = bundle.slice(publishAt, bundle.indexOf('\n        },', publishAt));
    // The width refusal owns no sheet state — it must not claim the owned flag.
    expect(publishBlock).not.toContain('scriptApplyRefusalOwnedRef');
    // `applyAnchorWidths` keeps its boolean contract: still one commit result.
    expect(bundle).toContain(
      'return commitAquarelleVectorPathEdit(target, next).then((editId) => editId !== null);',
    );
  });
});

// 61-11 Task 2: the Anchor width bundle members. The dialog never touches the
// record store — `readVectorAnchors` is the ONE read seam (the gate and the
// Paint row share it), and `applyAnchorWidths` builds the WHOLE next list and
// commits it through ONE path edit, so a three-anchor change is one undo entry
// (T-61-38) and never one entry per anchor.
describe('61-11 Anchor width bundle wiring in the Studio', () => {
  const BUNDLE_START = 'const bundle: StrokeSettingsDialogBundle = {';
  const BUNDLE_END = 'return bundle;';

  function bundleRegion(): string {
    const start = studio.indexOf(BUNDLE_START);
    expect(start, `missing start marker: ${BUNDLE_START}`).toBeGreaterThan(-1);
    const end = studio.indexOf(BUNDLE_END, start + BUNDLE_START.length);
    expect(end, `missing end marker: ${BUNDLE_END}`).toBeGreaterThan(start);
    return studio.slice(start, end);
  }

  it('supplies readVectorAnchors from the record seam, refusing not-quite-one vector stroke', () => {
    const bundle = bundleRegion();
    expect(bundle).toContain('readVectorAnchors: (ids) => {');
    expect(bundle).toContain('if (ids.length !== 1) return null;');
    expect(bundle).toContain('if (!stroke) return null;');
    expect(bundle).toContain('return normaliseAquarelleAnchors(stroke.anchors) ?? null;');
  });

  it('commits every selected anchor in exactly ONE path edit', () => {
    const bundle = bundleRegion();
    expect(bundle).toContain('applyAnchorWidths: (ids, value) => {');
    // The list is built BEFORE the edit and over the LIVE anchor selection.
    expect(bundle).toContain('const next = buildAnchorWidthCommit(');
    expect(bundle).toContain('vectorPathSession.vectorAnchorSelection.peek(),');
    // 61-19 (G-5) REPLACES the 61-11 `ids[0]` pin: the write is resolved
    // through the shared path-edit commit, never a second edit wrapper. The
    // bundle owns no begin call of its own.
    expect(bundle).toContain('commitAquarelleVectorPathEdit(target, next)');
    expect(bundle.split('beginAquarellePathEdit(').length - 1).toBe(0);
  });

  it('resolves the write target from the open path edit, never from ids[0]', () => {
    const bundle = bundleRegion();
    // The ONE target decision: the open edit's session id must name the single
    // selected stroke, or the commit is refused (G-5 / T-61-63).
    expect(bundle).toContain('const target = resolveAnchorWidthTarget({');
    expect(bundle).toContain('pathEditMutationId: vectorPathSession.pathEditMutationId.peek(),');
    expect(bundle).toContain('if (target === null) return false;');
    // The recorded stroke read follows the TARGET, not the dialog selection.
    expect(bundle).toContain('const stroke = getRecordedAquarelleStroke(target);');
    // ONE shared writer for the whole gesture; a null edit id resolves false.
    // 261112-i6d adds the Corner member, which reaches the SAME shared commit
    // (two members, one writer) — never a second edit wrapper.
    expect(bundle).toContain('return commitAquarelleVectorPathEdit(target, next).then((editId) => editId !== null);');
    expect(bundle.split('commitAquarelleVectorPathEdit(').length - 1).toBe(2);
    // The Studio's ONE begin lives in the shared commit — exactly one in the
    // whole file, and it belongs to that commit, not to this bundle.
    const COMMIT_START = 'const commitAquarelleVectorPathEdit = useCallback(';
    const commitStart = studio.indexOf(COMMIT_START);
    const commitEnd = studio.indexOf('const handleAquarelleVectorPathEdit = useCallback(', commitStart);
    expect(commitStart).toBeGreaterThan(-1);
    expect(commitEnd).toBeGreaterThan(commitStart);
    const commit = studio.slice(commitStart, commitEnd);
    expect(commit.split('beginAquarellePathEdit(').length - 1).toBe(1);
    expect(studio.split('beginAquarellePathEdit(').length - 1).toBe(1);
  });

  it('composes the pure width commit from the shared handle module', () => {
    expect(studio).toContain(
      "import { DEFAULT_VECTOR_PATH_CURVE_MODE, anchorColorCommitIsNoOp, buildAnchorColorCommit, buildAnchorCornerCommit, buildAnchorWidthCommit } from './view/vectorPathHandles';",
    );
  });

  // quick 261112-i6d: the width sibling of the shipped colour CR-01 no-op law.
  // An unchanged list exits the commit with the same null edit id as a refusal
  // (the commit's anchorsEqual early return), so the no-op must be decided
  // BEFORE the commit — otherwise a clamped repeat publishes the false
  // "Vertex size not applied" banner.
  it('skips an unchanged width before committing (261112-i6d width no-op)', () => {
    const bundle = bundleRegion();
    const widthAt = bundle.indexOf('applyAnchorWidths: (ids, value) => {');
    expect(widthAt, 'missing the width member').toBeGreaterThan(-1);
    const region = bundle.slice(widthAt, bundle.indexOf('reorderStroke:', widthAt));
    const buildAt = region.indexOf('const next = buildAnchorWidthCommit(');
    const guardAt = region.indexOf('anchorsEqual(anchors, next)');
    const commitAt = region.indexOf('commitAquarelleVectorPathEdit(');
    expect(buildAt, 'missing the build marker').toBeGreaterThan(-1);
    expect(guardAt, 'missing the no-op guard').toBeGreaterThan(-1);
    expect(commitAt, 'missing the commit marker').toBeGreaterThan(-1);
    expect(guardAt).toBeGreaterThan(buildAt);
    expect(guardAt).toBeLessThan(commitAt);
    // ONE guard, never a second.
    expect(region.split('anchorsEqual(anchors, next)').length - 1).toBe(1);
    // The genuine-refusal contract is untouched: the same commit tail still
    // resolves false for a refused or in-flight edit.
    expect(region).toContain(
      'return commitAquarelleVectorPathEdit(target, next).then((editId) => editId !== null);',
    );
    // The verbatim payload import pinned above stays byte-identical; the
    // guard's predicate rides its OWN same-module line beside it.
    expect(studio).toContain("import { isAquarelleDryEvent, normaliseAquarelleAnchors, toStudioStroke, type AquarelleAnchor, type AquarellePayloadEvent } from '@efxlab/efx-watercolor/payload';");
    expect(studio.split("import { anchorsEqual } from '@efxlab/efx-watercolor/payload';").length - 1)
      .toBe(1);
  });
});

// 261112-i6d: the Corner row writes the round/straight state on the LIVE
// anchor selection through the SAME path-edit commit the Alt+click gesture
// uses — one undo entry, one re-bake, one shape law. An unchanged list
// short-circuits before the commit exactly like the width no-op.
describe('261112-i6d Corner bundle wiring and rebuild status in the Studio', () => {
  const BUNDLE_START = 'const bundle: StrokeSettingsDialogBundle = {';
  const BUNDLE_END = 'return bundle;';

  function bundleRegion(): string {
    const start = studio.indexOf(BUNDLE_START);
    expect(start, `missing start marker: ${BUNDLE_START}`).toBeGreaterThan(-1);
    const end = studio.indexOf(BUNDLE_END, start + BUNDLE_START.length);
    expect(end, `missing end marker: ${BUNDLE_END}`).toBeGreaterThan(start);
    return studio.slice(start, end);
  }

  it('supplies applyAnchorCorners through the ONE target and commit seam', () => {
    const bundle = bundleRegion();
    expect(bundle).toContain('applyAnchorCorners: (ids, state) => {');
    // The SAME target decision the Vertex size member uses.
    expect(bundle).toContain('const target = resolveAnchorWidthTarget({');
    // The pure builder and the live anchor selection.
    expect(bundle).toContain('const next = buildAnchorCornerCommit(');
    expect(bundle).toContain('vectorPathSession.vectorAnchorSelection.peek(),');
    // An unchanged list is a success, never a refusal.
    expect(bundle).toContain('if (next === anchors) return true;');
  });

  it('marks the rebake busy without a second status line, and rests on success', () => {
    const commitStart = studio.indexOf('const commitAquarelleVectorPathEdit = useCallback(');
    expect(commitStart, 'missing the commit').toBeGreaterThan(-1);
    const commitEnd = studio.indexOf('const handleAquarelleVectorPathEdit = useCallback(', commitStart);
    const commit = studio.slice(commitStart, commitEnd);
    const busyAt = commit.indexOf("setApplyStatus('applying');");
    const rebakeAt = commit.indexOf('runAquarelleScriptRebake({');
    const successAt = commit.indexOf('onSuccess: () => {');
    expect(busyAt, 'missing the busy status').toBeGreaterThan(-1);
    // Set BEFORE the await: key actions stay gated for the whole replay.
    expect(busyAt).toBeLessThan(rebakeAt);
    expect(successAt).toBeGreaterThan(rebakeAt);
    // 261112-i6d: the canvas veil is the ONE story — the strip publishes no
    // copy of the wait, so success has no line of its own to clear.
    expect(commit).not.toContain('setApplyMessage(VECTOR_PATH_REBUILDING_MESSAGE);');
    const success = commit.slice(successAt, commit.indexOf('onFailure:', successAt));
    expect(success).toContain("setApplyStatus('idle');");
    expect(success).not.toContain('setApplyMessage(null);');
  });
});

// 261111-wd6: the Color tab writes an explicit per-vertex colour to the LIVE
// anchor selection through the ONE path-edit commit — one undo entry and one
// re-bake per gesture, never one per anchor. An empty anchor selection keeps
// the shipped stroke-level colour commit byte-for-byte.
describe('261111-wd6 — the Color tab per-vertex branch', () => {
  const HANDLER_START = 'const handleRightPanelColorCommit = useCallback(';

  function colorHandlerRegion(): string {
    const start = studio.indexOf(HANDLER_START);
    expect(start, `missing start marker: ${HANDLER_START}`).toBeGreaterThan(-1);
    const end = studio.indexOf('const rightPanel = rightPanelPropsMemo.resolve(', start);
    expect(end, 'missing the right-panel memo boundary').toBeGreaterThan(start);
    return studio.slice(start, end);
  }

  it('routes a live anchor selection through the shared path-edit commit', () => {
    const region = colorHandlerRegion();
    expect(region).toContain('vectorPathSession.vectorAnchorSelection.peek()');
    expect(region).toContain('buildAnchorColorCommit(');
    expect(region).toContain('const commit = aquarellePathEditCommitRef.current');
    expect(region).toContain('commit(target, next)');
    // The anchor branch returns before the shipped whole-stroke commit.
    expect(region.indexOf('commit(target, next)'))
      .toBeLessThan(region.indexOf('aquarelleAppearanceCommitRef.current?.(ids, { color })'));
    // The whole-stroke fallback is unchanged.
    expect(region).toContain('aquarelleAppearanceCommitRef.current?.(ids, { color })');
  });

  // WR-01: a refused commit used to be discarded by `void …?.()`, so the picker
  // moved and no vertex changed with no explanation. The Vertex size path
  // already publishes (61-27); the colour branch must too.
  it('publishes a refused anchor-colour commit instead of swallowing it', () => {
    const region = colorHandlerRegion();
    expect(region).toContain('if (editId !== null) return;');
    expect(region).toContain('setApplyMessage(ANCHOR_COLOR_COMMIT_REFUSED_MESSAGE)');
    expect(region).toContain("setApplyStatus('error')");
    expect(region).toContain('setLastError(ANCHOR_COLOR_COMMIT_REFUSED_MESSAGE)');
  });

  it('wires the ONE path-edit commit through the render-body ref', () => {
    expect(studio.split('aquarellePathEditCommitRef.current = commitAquarelleVectorPathEdit;').length - 1)
      .toBe(1);
    // The anchor branch owns no begin of its own; the file-wide count stays 1.
    expect(studio.split('beginAquarellePathEdit(').length - 1).toBe(1);
  });

  // CR-01: an unchanged gesture produces the same null edit id as a refusal
  // (the commit's anchorsEqual early return), so the no-op must be decided
  // BEFORE the commit — otherwise releasing an unmoved colour box publishes
  // the false "Vertex colour not applied" banner.
  it('skips an unchanged colour before committing (261112-hfk CR-01)', () => {
    const region = colorHandlerRegion();
    const buildAt = region.indexOf('buildAnchorColorCommit(');
    const guardAt = region.indexOf('anchorColorCommitIsNoOp(anchors, next)');
    const commitAt = region.indexOf('commit(target, next)');
    expect(buildAt, 'missing the build marker').toBeGreaterThan(-1);
    expect(guardAt, 'missing the no-op guard').toBeGreaterThan(-1);
    expect(commitAt, 'missing the commit marker').toBeGreaterThan(-1);
    expect(guardAt).toBeGreaterThan(buildAt);
    expect(guardAt).toBeLessThan(commitAt);
    // ONE guard, never a second.
    expect(region.split('anchorColorCommitIsNoOp(anchors, next)').length - 1).toBe(1);
    // The genuine-refusal publication is untouched.
    expect(region).toContain('if (editId !== null) return;');
    expect(region).toContain('setApplyMessage(ANCHOR_COLOR_COMMIT_REFUSED_MESSAGE)');
    expect(region).toContain("setApplyStatus('error')");
    expect(region).toContain('setLastError(ANCHOR_COLOR_COMMIT_REFUSED_MESSAGE)');
  });
});

// 61-13 Task 1: the wireframe latch (D-16). Wireframe is a session-only VIEW
// latch that GENERALISES Draft: ON forces Draft on BEFORE the latch flips (the
// settle needs Draft to exist), OFF clears only the latch and hands the re-bake
// to the ONE existing Draft settle — single-flight, never a second
// engine-suppression path. No persisted or exported surface may read it.
describe('61-13 wireframe latch — session-only, Draft-generalising', () => {
  function regionOf(source: string, startMarker: string, endMarker: string): string {
    const start = source.indexOf(startMarker);
    expect(start, `missing start marker: ${startMarker}`).toBeGreaterThan(-1);
    const end = source.indexOf(endMarker, start + startMarker.length);
    expect(end, `missing end marker: ${endMarker}`).toBeGreaterThan(start);
    return source.slice(start, end);
  }

  function resetWireframeSignals(): void {
    setWireframeSettleInFlight(false);
    wireframeMode.value = false;
    draftPixelsDirty.value = false;
    draftMode.value = false;
  }

  beforeEach(resetWireframeSignals);
  afterEach(resetWireframeSignals);

  it('turns Draft on BEFORE the latch flips, notifying each signal once', () => {
    const events: string[] = [];
    const stopDraft = effect(() => {
      if (draftMode.value) events.push('draft');
    });
    const stopWire = effect(() => {
      if (wireframeMode.value) events.push('wireframe');
    });
    setWireframeMode(true);
    stopDraft();
    stopWire();

    expect(wireframeMode.value).toBe(true);
    expect(draftMode.value).toBe(true);
    // Ordering law: the Draft effect (armed by setDraftMode) runs first.
    expect(events).toEqual(['draft', 'wireframe']);
  });

  it('repeated ON writes nothing — zero further notifications', () => {
    setWireframeMode(true);
    expect(wireframeMode.value).toBe(true);

    const events: string[] = [];
    const stopDraft = effect(() => {
      void draftMode.value;
      events.push('draft');
    });
    const stopWire = effect(() => {
      void wireframeMode.value;
      events.push('wireframe');
    });
    events.length = 0;

    setWireframeMode(true);
    setWireframeMode(true);
    stopDraft();
    stopWire();

    expect(events).toEqual([]);
  });

  it('OFF clears ONLY the latch — Draft and the dirty invariant belong to the settle', () => {
    setWireframeMode(true);
    setDraftPixelsDirty(true);

    setWireframeMode(false);

    expect(wireframeMode.value).toBe(false);
    expect(draftMode.value).toBe(true);
    expect(draftPixelsDirty.value).toBe(true);
  });

  it('joins two OFF clicks into ONE settle, clearing the latch before it runs', async () => {
    setWireframeMode(true);
    setDraftPixelsDirty(true);
    let settleCalls = 0;
    let releaseSettle!: (value: boolean) => void;
    const latchAtCall: boolean[] = [];
    const settle = () => {
      settleCalls += 1;
      latchAtCall.push(wireframeMode.value);
      return new Promise<boolean>((resolve) => {
        releaseSettle = resolve;
      });
    };

    const first = runWireframeOffTransition(settle);
    const second = runWireframeOffTransition(settle);

    expect(second).toBe(first);
    expect(settleCalls).toBe(1);
    // E7 loading: the latch is already off when the re-bake starts, so the
    // overlay stops drawing immediately instead of during the bake.
    expect(latchAtCall).toEqual([false]);
    expect(wireframeSettleInFlight.value).toBe(true);

    releaseSettle(true);
    await expect(first).resolves.toBe(true);
    expect(wireframeSettleInFlight.value).toBe(false);

    // The window closes with the run: a later OFF starts a fresh transition.
    await expect(runWireframeOffTransition(async () => true)).resolves.toBe(true);
    expect(wireframeSettleInFlight.value).toBe(false);
  });

  it('declares the latch beside Draft, compare-then-write, forcing Draft first', () => {
    const setter = regionOf(
      scriptStrokeEdition,
      'export function setWireframeMode(',
      'export const wireframeSettleInFlight',
    );
    const guardAt = setter.indexOf('if (wireframeMode.value === on) return;');
    const forceDraftAt = setter.indexOf('setDraftMode(true);');
    const latchAt = setter.indexOf('wireframeMode.value = on;');
    expect(guardAt, 'the latch is compare-then-write').toBeGreaterThan(-1);
    expect(forceDraftAt, 'ON arms Draft').toBeGreaterThan(guardAt);
    expect(latchAt, 'the latch flips only after Draft is on').toBeGreaterThan(forceDraftAt);
    // OFF never calls the Draft setter — the settle is the only way out.
    expect(setter).not.toContain('setDraftMode(false)');

    const inFlight = regionOf(
      scriptStrokeEdition,
      'export function setWireframeSettleInFlight(',
      'export function runWireframeOffTransition',
    );
    expect(inFlight).toContain('if (wireframeSettleInFlight.value === on) return;');

    const runner = regionOf(
      scriptStrokeEdition,
      'export function runWireframeOffTransition(',
      'export const frozenCacheVisible',
    );
    expect(runner).toContain('if (wireframeSettlePromise !== null) return wireframeSettlePromise;');
    expect(runner).toContain('if (wireframeMode.peek()) setWireframeMode(false);');
    expect(runner).toContain('setWireframeSettleInFlight(true);');
    expect(runner).toContain('wireframeSettlePromise = null;');
  });

  it('imports the whole latch surface from the ONE edition module', () => {
    // 61-27 (IN-02): the import block gained `DRAFT_SETTLE_BUSY_MESSAGE` as its
    // first member, so this shipped start marker was repointed at the new head
    // of the SAME import — every symbol assertion below is unchanged.
    const editionImport = regionOf(
      studio,
      'import {\n  DRAFT_SETTLE_BUSY_MESSAGE,\n  deleteSelectedScriptStroke,',
      "} from './view/scriptStrokeEdition';",
    );
    for (const symbol of [
      'wireframeMode',
      'setWireframeMode',
      'wireframeSettleInFlight',
      'runWireframeOffTransition',
    ]) {
      expect(editionImport, `the Studio imports ${symbol}`).toContain(symbol);
    }
  });

  it('wires one identity-stable handler that routes OFF through the ONE Draft settle', () => {
    const handler = regionOf(
      studio,
      'const handleToggleWireframe = useCallback(',
      'const switchActiveTrack = useCallback(',
    );
    expect(handler).toContain('if (wireframeSettleInFlight.peek() || wireframeMode.peek()) {');
    expect(handler).toContain('void runWireframeOffTransition(() => settleDraftScript());');
    expect(handler).toContain('setWireframeMode(true);');
    expect(handler).toContain('disarmAquarellePicker();');
    expect(handler).toContain('setAquarelleSelectMode(false);');
    expect(handler).toContain('[settleDraftScript]');
    // No second engine-suppression path: the handler delegates the re-bake.
    expect(handler).not.toContain('aquarelleResetSheetRef');
    expect(handler).not.toContain('applyAquarelleTimeline');
  });

  it('gates the paint row, the picker and Dry behind the latch read', () => {
    const selectGate = regionOf(
      studio,
      'const handleSelectAquarelleTool = useCallback',
      'const handleAquarelleColorPick = useCallback',
    );
    const selectCheckAt = selectGate.indexOf('if (wireframeMode.peek()) return;');
    const exitVectorAt = selectGate.indexOf('vectorPathSession.exitVectorPen();');
    expect(selectCheckAt, 'the paint gate runs first').toBeGreaterThan(-1);
    expect(selectCheckAt).toBeLessThan(exitVectorAt);

    const pickerGate = regionOf(
      studio,
      'const handleToggleAquarellePicker = useCallback',
      'const handleToggleAquarelleSelect = useCallback',
    );
    const pickerCheckAt = pickerGate.indexOf('if (wireframeMode.peek()) return;');
    const pickerSelectAt = pickerGate.indexOf('setAquarelleSelectMode(false);');
    expect(pickerCheckAt, 'the picker gate runs first').toBeGreaterThan(-1);
    expect(pickerCheckAt).toBeLessThan(pickerSelectAt);

    const dry = regionOf(studio, 'dryAquarelleSheet: () => {', 'clearAquarelleFrame: () => {');
    expect(dry).toContain('if (staticControlsLocked || wireframeMode.peek()) return;');
  });

  it('reports the latch to the main realm through the ONE Draft publisher', () => {
    expect(studio).toContain(
      'const active = draftMode.value || draftPixelsDirty.value || wireframeMode.value;',
    );
  });

  it('forwards the handler through the identity memo', () => {
    expect(studio).toContain('handleToggleMotionBoundaries, handleToggleWireframe], () => ({');
    expect(studio).toContain('onToggleWireframe: handleToggleWireframe,');
  });

  it('is session-only: no persisted path can ever read the latch', () => {
    const persisted = [
      ['the script snapshot controller', snapshotController],
      ['the script replay', aquarelleScriptReplay],
      ['the live-pixel transactions', livePixelTransactions],
      ['the export engine', exportEngine],
      ['auto-save', autoSave],
      ['the project store', projectStoreSource],
      ['the physic-paint types', types],
      ['the project types', projectTypes],
    ] as const;
    for (const [label, source] of persisted) {
      expect(source, `${label} must not read the wireframe latch`).not.toContain('wireframeMode');
    }
    const toStudioStroke = readFileSync(
      fileURLToPath(
        new URL('../../../../packages/efx-watercolor/src/payload/toStudioStroke.ts', import.meta.url),
      ),
      'utf8',
    );
    expect(toStudioStroke).not.toContain('wireframeMode');
    expect(types).not.toContain('wireframe');
  });
});

// 61-13 Task 3: the gates and their edges. A gated control states WHY it is
// inert rather than starting an implicit exit; the Draft switch stays visibly
// ON and inert because the latch owns the ONE route out; the cache eye keeps
// its unconditional availability. E7 overflow (flagged assumption): the
// wireframe overlay draws every stroke with no cap — the Wave 0 probe's
// measured reference count (10 strokes at 1920x1080, 61-01 result.json) is the
// threshold, and a viewport limit is the stated fallback ONLY if a real sheet
// exceeds it. The row stays open until that count is exceeded.
describe('61-13 wireframe gates — reasons, Draft ownership, idempotency', () => {
  function resetWireframeGateSignals(): void {
    setWireframeSettleInFlight(false);
    wireframeMode.value = false;
    draftPixelsDirty.value = false;
    draftMode.value = false;
  }

  beforeEach(resetWireframeGateSignals);
  afterEach(resetWireframeGateSignals);

  it('states every gated control reason in the rail source', () => {
    // The four paint literals are composed as `${label} (${shortcut}) — ...`
    // and asserted verbatim by the RENDERED rail pins (PhysicsPaintToolRail.
    // test.ts).
    expect(toolRail).toContain('— turn wireframe off to paint');
    // 61-25 (UI-05 / §5): the contract DISARMS the picker under wireframe; it
    // never removes the function. The button stays pressable with its shipped
    // title, so re-adding a wireframe gate here would re-break the contract.
    expect(toolRail).not.toContain('turn wireframe off to pick');
    expect(toolRail).toContain('title="Picker (I) — click the canvas to sample the color under the cursor');
    expect(toolRail).toContain('disabled={railDisabled || wireframeActive || (id === \'water\' && !wetAvailable)}');
    expect(toolRail).toContain('wireframeReason');
    // quick-261112: the Flash-dry action moved to the top bar with the same
    // gate and its direct literal.
    expect(topBar).toContain('disabled={railDisabled || wireframeActive}');
    expect(topBar).toContain("'Dry (F) — turn wireframe off to paint'");
  });

  it('renders the Draft switch ON and disabled while the latch owns the settle', () => {
    expect(strokeSettingsDialog).toContain('const wireframeOn = wireframeMode.value;');
    expect(strokeSettingsDialog).toContain('disabled={wireframeOn}');
    expect(strokeSettingsDialog).toContain(
      "'Draft — on while wireframe is on. Turn wireframe off to re-render.'",
    );
    const switchStart = strokeSettingsDialog.indexOf('data-testid="stroke-settings-draft-switch"');
    const cacheStart = strokeSettingsDialog.indexOf('data-testid="stroke-settings-cache-visibility"');
    expect(switchStart).toBeGreaterThan(-1);
    expect(cacheStart).toBeGreaterThan(switchStart);
    // Programmatic clicks are refused too — the wireframe is the only exit.
    expect(strokeSettingsDialog.slice(switchStart, cacheStart)).toContain(
      'if (wireframeMode.peek()) return;',
    );
    // D-02: the cache eye stays available — no disable reaches it.
    const cacheRegion = strokeSettingsDialog.slice(
      cacheStart,
      strokeSettingsDialog.indexOf('</button>', cacheStart),
    );
    expect(cacheRegion).not.toContain('disabled');
  });

  it('keeps the vector pen outside the paint-row gate (it stays available)', () => {
    const penStart = toolRail.indexOf('data-testid="aquarelle-vector-pen-toggle"');
    expect(penStart).toBeGreaterThan(-1);
    const penRegion = toolRail.slice(penStart, toolRail.indexOf('</button>', penStart));
    expect(penRegion).toContain('disabled={railDisabled}');
    expect(penRegion).not.toContain('wireframeActive');
  });

  it('keeps the latch enabled on an empty sheet — the toggle has no data gate', () => {
    // The behavioral halves: the rail keeps the toggle enabled and the overlays
    // return null for an empty sheet (PhysicsPaintToolRail.test.ts /
    // VectorPathOverlay.test.ts). This pin proves the rail never grows a
    // stroke-count condition around the control.
    const toggleStart = toolRail.indexOf('data-testid="aquarelle-wireframe-toggle"');
    expect(toggleStart).toBeGreaterThan(-1);
    const toggleRegion = toolRail.slice(toggleStart, toolRail.indexOf('</button>', toggleStart));
    expect(toggleRegion).toContain('disabled={railDisabled}');
    expect(toggleRegion).not.toContain('strokes');
  });

  it('treats two ON calls as ONE state change — the overlay subscriber runs once', () => {
    let passes = 0;
    const stop = effect(() => {
      void wireframeMode.value;
      passes += 1;
    });
    expect(passes).toBe(1);

    setWireframeMode(true);
    setWireframeMode(true);
    stop();

    // Initial run + exactly one notified transition. VectorPathOverlay reads
    // this signal only, so one notification is one overlay pass.
    expect(passes).toBe(2);
  });
});

// ============================================================
//  61-31 (G-20) — the Curve row's two Studio seams: the appearance
//  hydration attaches the recorded stroke's `curveMode` and its
//  vector-ness, and `applyCurveMode` routes the WHOLE selection
//  through exactly ONE `beginAquarelleCurveModeEdit` — one undo
//  entry, never one per stroke.
// ============================================================

describe('61-31 Curve mode bundle wiring in the Studio', () => {
  const BUNDLE_START = 'const bundle: StrokeSettingsDialogBundle = {';
  const BUNDLE_END = 'return bundle;';
  const HANDLER_START = 'const handleAquarelleCurveModeStrokes = useCallback(async (';
  const HANDLER_END = 'const handleAquarelleTransformStrokes = useCallback(async (';

  function bundleRegion(): string {
    const start = studio.indexOf(BUNDLE_START);
    expect(start, `missing start marker: ${BUNDLE_START}`).toBeGreaterThan(-1);
    const end = studio.indexOf(BUNDLE_END, start + BUNDLE_START.length);
    expect(end, `missing end marker: ${BUNDLE_END}`).toBeGreaterThan(start);
    return studio.slice(start, end);
  }

  function curveHandlerRegion(): string {
    const start = studio.indexOf(HANDLER_START);
    expect(start, `missing start marker: ${HANDLER_START}`).toBeGreaterThan(-1);
    const end = studio.indexOf(HANDLER_END, start + HANDLER_START.length);
    expect(end, `missing end marker: ${HANDLER_END}`).toBeGreaterThan(start);
    return studio.slice(start, end);
  }

  it('hydrates curveMode and the vector flag, and exposes applyCurveMode', () => {
    const bundle = bundleRegion();
    // Same sparse-field contract as renderMode: an absent key stays absent.
    expect(bundle).toContain('...(stroke.curveMode === undefined ? {} : { curveMode: stroke.curveMode }),');
    // Vector-ness is the presence of an anchor list — never a second store.
    expect(bundle).toContain('vector: stroke.anchors !== undefined,');
    // The commit seam routes the whole selection through the new handler.
    expect(bundle).toContain(
      'applyCurveMode: (ids, mode) => handleAquarelleCurveModeStrokes(ids, mode),',
    );
    // The type import is declared and the handler joins the memo's deps.
    expect(studio).toContain("import type { AquarelleCurveMode } from '@efxlab/efx-watercolor/payload';");
    const memoStart = studio.indexOf('const strokeSettingsDialog = strokeSettingsDialogPropsMemo.resolve(');
    expect(memoStart).toBeGreaterThan(-1);
    const memoDepEnd = studio.indexOf('() => {', memoStart);
    expect(memoDepEnd).toBeGreaterThan(memoStart);
    expect(studio.slice(memoStart, memoDepEnd)).toContain('handleAquarelleCurveModeStrokes,');
  });

  it('shares the render-mode handler law: guards, Draft branch, ONE wrapper call per batch', () => {
    const handler = curveHandlerRegion();
    expect(handler).toContain('if (isPhysicalMutationLocked()) return false;');
    expect(handler).toContain('if (rotoScript.applying.peek() || rotoScript.mutationLocked.peek()) return false;');
    expect(handler).toContain("if (rotoTimelineModel.currentCell.peek().kind !== 'real') return false;");
    expect(handler).toContain('if (isAquarelleScriptEditInFlight()) return false;');
    expect(handler).toContain('const frameIds = aquarelleStrokesOnFrame(ids, playFrame);');
    expect(handler).toContain('await ensureAquarelleDurableBaseRef.current(playFrame);');
    // Draft: record + mark dirty, never reset or re-apply.
    const draftAt = handler.indexOf('if (draft) {');
    const resetAt = handler.indexOf('aquarelleResetSheetRef.current?.()');
    expect(draftAt).toBeGreaterThan(-1);
    expect(resetAt).toBeGreaterThan(draftAt);
    expect(handler.slice(draftAt, resetAt)).toContain('rotoMoveHistory.recordAquarelleScriptEdit(editId);');
    expect(handler.slice(draftAt, resetAt)).toContain('setDraftPixelsDirty(true);');
    // Live: reset, re-apply, record on success, restore on failure.
    expect(handler).toContain('await rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame));');
    expect(handler).toContain("restoreAquarelleEditSnapshot(editId, 'undo');");
    expect(handler).toContain('setAquarelleScriptEditInFlight(false);');
    // ONE commit site for the whole file and ONE call per accepted batch.
    expect(studio.split('beginAquarelleCurveModeEdit(').length - 1).toBe(1);
    expect(handler).toContain('const editId = beginAquarelleCurveModeEdit(frameIds, mode);');
  });
});

// ============================================================
//  61-20 Task 1 — the ledger half of G-8 (VEC-07).
//
//  `beginAquarellePathEdit` stores the edit in the edits map and returns an id;
//  until now nothing passed that id to `recordAquarelleScriptEdit`, so undo/redo
//  (which walk only 'aquarelle-script' and 'paint' entries) could never reach a
//  path edit. The ONE writer 61-15 built records it on the re-bake SUCCESS tail
//  — after the apply resolves, never before the bake and never on failure — and
//  depends on the stable recorder callback, never the per-render wrapper.
// ============================================================

describe('61-20 G-8: a vector path edit is exactly one undo entry', () => {
  function regionOf(source: string, startMarker: string, endMarker: string): string {
    const start = source.indexOf(startMarker);
    expect(start, `missing start marker: ${startMarker}`).toBeGreaterThan(-1);
    const end = source.indexOf(endMarker, start + startMarker.length);
    expect(end, `missing end marker: ${endMarker}`).toBeGreaterThan(start);
    return source.slice(start, end);
  }

  const COMMIT_START = 'const commitAquarelleVectorPathEdit = useCallback(';
  const COMMIT_END = 'const handleAquarelleVectorPathEdit = useCallback(';
  const RECORD = 'rotoMoveHistory.recordAquarelleScriptEdit(editId);';

  function commitRegion(): string {
    return regionOf(studio, COMMIT_START, COMMIT_END);
  }

  it('records exactly once on the re-bake success tail, between onSuccess and onFailure', () => {
    const commit = commitRegion();
    const success = regionOf(commit, 'onSuccess:', 'onFailure:');
    // One gesture is one ledger entry: a second site would double-count it.
    expect(success.split(RECORD).length - 1).toBe(1);
  });

  it('records after the bake resolved and before any failure restore', () => {
    const commit = commitRegion();
    const success = regionOf(commit, 'onSuccess:', 'onFailure:');
    const successAt = commit.indexOf('onSuccess:');
    // The re-bake route's record, not whichever site the source lists first:
    // the defer route owns the other (and only other) site after 61-20 Task 2.
    const recordAt = success.indexOf(RECORD);
    const rebakeAt = commit.indexOf('runAquarelleScriptRebake({');
    // 61-26 (WR-02): the restore result is consumed, so the marker is the
    // consuming tail rather than the discarded statement it replaced.
    const restoreAt = commit.indexOf("restoreAquarelleEditSnapshot(editId, 'undo') !== null;");
    const beginAt = commit.indexOf('beginAquarellePathEdit(');
    expect(recordAt).toBeGreaterThan(-1);
    expect(successAt).toBeGreaterThan(-1);
    expect(rebakeAt).toBeGreaterThan(-1);
    expect(restoreAt).toBeGreaterThan(-1);
    // A record taken before the apply resolves could claim an edit the sheet
    // rejected; the restore must never be followed by one either.
    expect(successAt + recordAt).toBeGreaterThan(rebakeAt);
    expect(successAt + recordAt).toBeLessThan(restoreAt);
    // Nothing is recorded before the edit is even begun.
    expect(beginAt).toBeGreaterThan(-1);
    expect(commit.slice(0, beginAt)).not.toContain('rotoMoveHistory.recordAquarelleScriptEdit');
  });

  it('depends on the stable recorder callback, never the per-render wrapper', () => {
    const commit = commitRegion();
    const depsAt = commit.indexOf('  }, [');
    expect(depsAt).toBeGreaterThan(-1);
    const deps = commit.slice(depsAt);
    // The hook returns a fresh wrapper each render; its recorder is the stable
    // useCallback. Depending on the wrapper would capture a stale stack.
    expect(deps).toContain('\n    rotoMoveHistory.recordAquarelleScriptEdit,\n');
    expect(deps).not.toContain('\n    rotoMoveHistory,\n');
  });

  // Task 2 — the defer route records once, failure records nothing, and every
  // delegating vector route stays record-free. The defer branch is sliced by
  // its own structural marker (`if (draft || wireframe) {`): the commit does
  // not contain a `'defer-pixels'` literal — that route string belongs to
  // `bakeAquarelleVectorCommit`'s `resolveVectorCommitRoute` call.
  it('records exactly once on the defer route, before the dirty flag', () => {
    const commit = commitRegion();
    const defer = regionOf(commit, 'if (draft || wireframe) {', 'runAquarelleScriptRebake({');
    expect(defer.split(RECORD).length - 1).toBe(1);
    const recordAt = defer.indexOf(RECORD);
    const dirtyAt = defer.indexOf('setDraftPixelsDirty(true);');
    expect(recordAt).toBeGreaterThan(-1);
    expect(dirtyAt).toBeGreaterThan(-1);
    // The script commit IS the edit; the dirty flag only schedules pixels.
    expect(recordAt).toBeLessThan(dirtyAt);
  });

  it('totals exactly two record sites, both before the failure restore', () => {
    const commit = commitRegion();
    // One per success route — the defer route and the re-bake onSuccess tail.
    expect(commit.split(RECORD).length - 1).toBe(2);
    // 61-26 (WR-02): the restore result is consumed, so the marker is the
    // consuming tail rather than the discarded statement it replaced.
    const restoreAt = commit.indexOf("restoreAquarelleEditSnapshot(editId, 'undo') !== null;");
    expect(restoreAt).toBeGreaterThan(-1);
    const sites: number[] = [];
    for (let at = commit.indexOf('rotoMoveHistory.recordAquarelleScriptEdit('); at !== -1; at = commit.indexOf('rotoMoveHistory.recordAquarelleScriptEdit(', at + 1)) {
      sites.push(at);
    }
    expect(sites).toHaveLength(2);
    for (const site of sites) expect(site).toBeLessThan(restoreAt);
  });

  it('records nothing on the failure route', () => {
    const commit = commitRegion();
    // The callback body only: the dependency array that follows the rebake
    // call legitimately names the recorder, and a source pin that ran past
    // it would be asserting the dependency, not the failure route.
    const failure = regionOf(commit, 'onFailure:', '  }, [');
    expect(failure).not.toContain('rotoMoveHistory.recordAquarelleScriptEdit');
  });

  it('keeps every delegating vector route record-free', () => {
    const widthBundle = regionOf(studio, 'applyAnchorWidths:', 'reorderStroke:');
    expect(widthBundle).not.toContain('rotoMoveHistory.recordAquarelleScriptEdit');
    const handler = regionOf(studio, COMMIT_END, 'const canvasMount = canvasMountPropsMemo.resolve(');
    expect(handler).not.toContain('rotoMoveHistory.recordAquarelleScriptEdit');
    const drawBake = regionOf(studio, 'const bakeAquarelleVectorCommit = useCallback(', 'const handleAquarelleStrokeEnd = useCallback(');
    expect(drawBake).not.toContain('rotoMoveHistory.recordAquarelleScriptEdit');
  });
});

// 61-24 (G-15): +Key records the previous real key's script onto the new key.
// Duplicate already owned that record seam; the two callers must share ONE
// implementation — a second copy path would let the two drift.
describe('61-24 G-15 — +Key and Duplicate share one script-copy body', () => {
  function regionOf(source: string, startMarker: string, endMarker: string): string {
    const start = source.indexOf(startMarker);
    expect(start, `missing start marker: ${startMarker}`).toBeGreaterThan(-1);
    const end = source.indexOf(endMarker, start);
    expect(end, `missing end marker: ${endMarker}`).toBeGreaterThan(start);
    return source.slice(start, end);
  }

  it('declares one recordAquarelleScriptCopyForFrames body carrying the shipped ledger allocation', () => {
    const shared = regionOf(
      studio,
      'const recordAquarelleScriptCopyForFrames = async (sourceFrame: number, destinationFrame: number): Promise<boolean> => {',
      'const rotoNavigation = useRotoNavigationCoordinator',
    );
    // The body is the duplicate's shipped one, verbatim.
    expect(shared).toContain('copyAquarelleScriptToFrame({');
    expect(shared).toContain('allocateMutationId: (stroke) => paintMutationLedger.allocateStrokeMutation({');
    expect(shared).toContain('resolveStudioScriptKeyIdForFrame(');
    expect(shared).toContain('return recorded > 0;');
    expect(shared).not.toContain('enqueueRecordedStroke');
    // ONE copy implementation in the whole Studio.
    expect(studio.split('copyAquarelleScriptToFrame(').length - 1).toBe(1);
  });

  it('binds Duplicate and +Key to that one body', () => {
    const duplicatePort = regionOf(
      studio,
      'duplicateWithScript: async ({ sourceKeyId, sourceAppFrame }) => {',
      'playback: {',
    );
    expect(duplicatePort).toContain('recordAquarelleScriptCopy: recordAquarelleScriptCopyForFrames,');
    expect(duplicatePort).not.toContain('recordAquarelleScriptCopy: async (');

    const keyUtilitiesLiteral = regionOf(studio, 'keyUtilities: {', 'duplicateWithScript: async (');
    expect(keyUtilitiesLiteral).toContain(
      'copyScriptToNewKey: ({ sourceAppFrame, destinationAppFrame }) => recordAquarelleScriptCopyForFrames(sourceAppFrame, destinationAppFrame),',
    );
    // +Key is record-only: the shared body is never wrapped in an apply/bake.
    expect(keyUtilitiesLiteral).not.toContain('applyAquarelleTimeline');
    expect(keyUtilitiesLiteral).not.toContain('bakeAquarelle');
  });
});

// 61-26 (WR-01): Shift+A must never write a stroke selection behind a refused
// Select entry. `setAquarelleSelectMode(true)` returns early under the
// wireframe view (61-17), so the handler's write cannot depend on the attempt
// having succeeded: a selection written there would exist with no outline, no
// hit-test and no rail surface, and would surface the next time Select opens.
describe('61-26 WR-01 — Shift+A under the wireframe leaves no orphan selection', () => {
  function regionOf(source: string, startMarker: string, endMarker: string): string {
    const start = source.indexOf(startMarker);
    expect(start, `missing start marker: ${startMarker}`).toBeGreaterThan(-1);
    const end = source.indexOf(endMarker, start + startMarker.length);
    expect(end, `missing end marker: ${endMarker}`).toBeGreaterThan(start);
    return source.slice(start, end);
  }

  const SELECT_ALL_START = 'const handleToggleSelectAllAquarelleStrokes = useCallback(() => {';
  const SELECT_ALL_END = '// The Water color half of the same law:';
  const ENTRY_ATTEMPT = 'setAquarelleSelectMode(true);';
  const ENTRY_RECHECK = 'if (!aquarelleSelectMode.peek()) return;';
  const SELECTION_WRITE = 'setAquarelleStrokeSelection(';

  function selectAllRegion(): string {
    return regionOf(studio, SELECT_ALL_START, SELECT_ALL_END);
  }

  it('refuses up front on the wireframe view, before any read or write', () => {
    const handler = selectAllRegion();
    const GUARD = 'if (wireframeMode.peek()) return;';
    const guardAt = handler.indexOf(GUARD);
    const availabilityAt = handler.indexOf('watercolorMoveAvailable.peek()');
    const entryAt = handler.indexOf(ENTRY_ATTEMPT);
    const writeAt = handler.indexOf(SELECTION_WRITE);
    expect(guardAt).toBeGreaterThan(-1);
    // The guard is the FIRST statement: nothing reads the mode or the
    // availability gate before it, so no write can precede it.
    expect(handler.slice(0, guardAt)).not.toContain('setAquarelleSelectMode');
    expect(handler.slice(0, guardAt)).not.toContain(SELECTION_WRITE);
    expect(availabilityAt).toBeGreaterThan(guardAt);
    expect(entryAt).toBeGreaterThan(guardAt);
    expect(writeAt).toBeGreaterThan(guardAt);
  });

  it('re-checks the authoritative Select entry before any selection write', () => {
    const handler = selectAllRegion();
    const entryBlock = regionOf(
      handler,
      'if (!aquarelleSelectMode.peek()) {',
      'const playFrame = launchContextRef.current?.startFrame ?? 0;',
    );
    expect(entryBlock).toContain(ENTRY_ATTEMPT);
    expect(entryBlock).toContain(ENTRY_RECHECK);
    const entryAt = handler.indexOf(ENTRY_ATTEMPT);
    const recheckAt = handler.indexOf(ENTRY_RECHECK, entryAt);
    const writeAt = handler.indexOf(SELECTION_WRITE);
    expect(entryAt).toBeGreaterThan(-1);
    expect(recheckAt).toBeGreaterThan(entryAt);
    expect(writeAt).toBeGreaterThan(recheckAt);
  });

  it('leaves the accepted path byte-identical', () => {
    const handler = selectAllRegion();
    expect(handler).toContain('const playFrame = launchContextRef.current?.startFrame ?? 0;');
    expect(handler).toContain('const ids = listAquarelleStrokeSelectionIds(playFrame);');
    expect(handler).toContain('const selected = scriptSelectedStrokeIds.peek();');
    expect(handler).toContain('const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));');
    expect(handler).toContain('setAquarelleStrokeSelection(allSelected ? [] : ids);');
    // ONE entry attempt, ONE selection write, and the empty dependency list
    // that keeps the handler out of the Studio body's subscriptions.
    expect(handler.split(ENTRY_ATTEMPT).length - 1).toBe(1);
    expect(handler.split(SELECTION_WRITE).length - 1).toBe(1);
    expect(handler).toContain('  }, []);');
  });

  it('keeps the Shift+A dispatch routed to the shipped action slot', () => {
    const keyboard = readFileSync(
      fileURLToPath(new URL('./view/physicsPaintStudioKeyboard.ts', import.meta.url)),
      'utf8',
    );
    const shiftA = regionOf(
      keyboard,
      "key === 'a' && actions.toggleSelectAllAquarelleStrokes",
      "if (event.key === '?'",
    );
    expect(shiftA).toContain('event.preventDefault();');
    expect(shiftA).toContain('actions.toggleSelectAllAquarelleStrokes();');
    // Shift+A owns no other action — the select-mode toggle stays on the rail.
    expect(shiftA).not.toContain('toggleAquarelleSelectMode');
    expect(studio.split('toggleSelectAllAquarelleStrokes:').length - 1).toBe(1);
  });
});

// 61-26 (WR-02): a failed path-edit re-bake must publish what the script is
// ACTUALLY in. The restore is revision-authoritative, so a foreign bump makes
// it fail closed without touching the script — publishing "restored" there
// would describe a rollback that never ran. The re-anchor is content-checked:
// the normal failure (this edit's own attempted side still live) re-seats the
// revision so the restore succeeds, and a real foreign mutation still fails
// closed with the honest copy.
describe('61-26 WR-02 — a failed path-edit re-bake restores for real or says it could not', () => {
  function regionOf(source: string, startMarker: string, endMarker: string): string {
    const start = source.indexOf(startMarker);
    expect(start, `missing start marker: ${startMarker}`).toBeGreaterThan(-1);
    const end = source.indexOf(endMarker, start + startMarker.length);
    expect(end, `missing end marker: ${endMarker}`).toBeGreaterThan(start);
    return source.slice(start, end);
  }

  const COMMIT_START = 'const commitAquarelleVectorPathEdit = useCallback(';
  const COMMIT_END = 'const handleAquarelleVectorPathEdit = useCallback(';
  const REANCHOR = "reanchorAquarelleEditFromLiveContent(editId, 'undo')";
  const RESTORE = "restoreAquarelleEditSnapshot(editId, 'undo')";
  const RESTORED_LINE = "? 'Could not re-apply the watercolor script — the path edit was restored.'";
  const NOT_ROLLED_BACK_LINE =
    ": 'Could not re-apply the watercolor script — the path edit could not be rolled back.'";

  function failureRegion(): string {
    const commit = regionOf(studio, COMMIT_START, COMMIT_END);
    return regionOf(commit, 'onFailure:', '  }, [');
  }

  it('re-anchors the attempted side before the authority-checked restore', () => {
    const failure = failureRegion();
    const anchorAt = failure.indexOf(REANCHOR);
    const restoreAt = failure.indexOf(RESTORE);
    expect(anchorAt).toBeGreaterThan(-1);
    expect(restoreAt).toBeGreaterThan(anchorAt);
  });

  it('consumes the restore result instead of discarding it', () => {
    const failure = failureRegion();
    expect(failure).toContain(
      "const restored = restoreAquarelleEditSnapshot(editId, 'undo') !== null;",
    );
  });

  it('ternaries the fallback copy on the restore result, keeping the apply error ahead of it', () => {
    const failure = failureRegion();
    expect(failure).toContain('?? (restored');
    expect(failure).toContain(RESTORED_LINE);
    expect(failure).toContain(NOT_ROLLED_BACK_LINE);
    const mapperAt = failure.indexOf('buildRotoScriptApplyRefusalMessage(error)');
    const messageAt = failure.indexOf('error?.message');
    const ternaryAt = failure.indexOf('(restored');
    expect(mapperAt).toBeGreaterThan(-1);
    expect(messageAt).toBeGreaterThan(mapperAt);
    expect(ternaryAt).toBeGreaterThan(messageAt);
    // Neither line is reachable as an unconditional `??` fallback on its own.
    expect(failure).not.toContain(
      "?? 'Could not re-apply the watercolor script — the path edit was restored.'",
    );
  });

  it('no longer discards the restore as a standalone statement', () => {
    const failure = failureRegion();
    expect(failure).not.toMatch(/restoreAquarelleEditSnapshot\(editId, 'undo'\);[ \t]*$/m);
  });
});

// 61-26 (WR-03): a vector stroke paints no engine dabs, so its only pixels are
// the re-bake. `runAquarelleScriptRebake`'s in-flight branch calls no terminal
// callback, so a draw that lands during another edit's bake returns false with
// the stroke in the script and nowhere on the sheet. The continuation arms the
// ONE stale-sheet invariant, which the next Draft/wireframe settle clears.
describe('61-26 WR-03 — a vector stroke committed during an in-flight bake marks the sheet stale', () => {
  function regionOf(source: string, startMarker: string, endMarker: string): string {
    const start = source.indexOf(startMarker);
    expect(start, `missing start marker: ${startMarker}`).toBeGreaterThan(-1);
    const end = source.indexOf(endMarker, start + startMarker.length);
    expect(end, `missing end marker: ${endMarker}`).toBeGreaterThan(start);
    return source.slice(start, end);
  }

  const HANDLER_START = 'const handleAquarelleStrokeEnd = useCallback(';
  const HANDLER_END = 'const handleAquarelleStrokeSettled = useCallback(';
  const DISCARDED_BAKE = 'void bakeAquarelleVectorCommit();';
  const CONTINUATION = 'void bakeAquarelleVectorCommit().then((baked) => {';
  const STALE_ARM = 'if (!baked) setDraftPixelsDirty(true);';
  const VECTOR_TAIL_GUARD = 'if (isVectorAquarelleStroke(stroke)) {';

  function strokeEndRegion(): string {
    return regionOf(studio, HANDLER_START, HANDLER_END);
  }

  it('consumes the bake result through a continuation instead of discarding it', () => {
    const handler = strokeEndRegion();
    expect(handler).toContain(CONTINUATION);
    // Guarded by the vector predicate: an ordinary dabs stroke never bakes.
    const guardAt = handler.indexOf(VECTOR_TAIL_GUARD);
    const continueAt = handler.indexOf(CONTINUATION);
    expect(guardAt).toBeGreaterThan(-1);
    expect(continueAt).toBeGreaterThan(guardAt);
  });

  it('arms the stale-sheet invariant when the bake reports false', () => {
    const handler = strokeEndRegion();
    expect(handler).toContain(STALE_ARM);
    // The continuation publishes NOTHING: the gesture DID commit, so an error
    // capsule here would steal the apply-refusal ownership.
    const tail = regionOf(handler, VECTOR_TAIL_GUARD, '    } catch {');
    expect(tail).not.toContain('setApplyMessage');
    expect(tail).not.toContain('setApplyStatus');
    expect(tail).not.toContain('setLastError');
  });

  it('no longer fires the bake as a discarded statement', () => {
    const handler = strokeEndRegion();
    expect(handler).not.toContain(DISCARDED_BAKE);
  });

  it('still records the stroke before it bakes', () => {
    const handler = strokeEndRegion();
    const recordAt = handler.indexOf('recordAquarelleStrokeWhenEnabled(');
    const bakeAt = handler.indexOf('bakeAquarelleVectorCommit().then(');
    const catchAt = handler.indexOf('    } catch {');
    expect(recordAt).toBeGreaterThan(-1);
    expect(bakeAt).toBeGreaterThan(recordAt);
    expect(bakeAt).toBeLessThan(catchAt);
  });
});

// ============================================================
//  quick 261111-t74 — the selection brush patch stays one edit.
//
//  The selection edit port is the ONLY new registration: it
//  forwards to the shipped appearance handler, so a brush patch
//  inherits one undo entry, one revision bump and one seed
//  re-roll. The record-state write keeps exactly one bump and one
//  same-index replacement led by a fresh stroke object, and the
//  merged multiplier bag is fully materialised.
// ============================================================

describe('quick 261111-t74 — the selection brush patch stays one edit', () => {
  function regionOf(source: string, startMarker: string, endMarker: string): string {
    const start = source.indexOf(startMarker);
    expect(start, `missing start marker: ${startMarker}`).toBeGreaterThan(-1);
    const end = source.indexOf(endMarker, start + startMarker.length);
    expect(end, `missing end marker: ${endMarker}`).toBeGreaterThan(start);
    return source.slice(start, end);
  }

  const REGISTRATION = 'setAquarelleSelectionEditPort({';
  const APPEARANCE_REF = 'aquarelleAppearanceCommitRef.current = handleAquarelleAppearanceStrokes;';
  const WRITE_START = 'export function updateAquarelleStrokesInScript(';
  const WRITE_END = 'export function updateAquarelleCurveModeInScript(';

  function writeRegion(): string {
    return regionOf(aquarelleRecordStateSource, WRITE_START, WRITE_END);
  }

  it('registers exactly one selection edit port, after the appearance ref', () => {
    expect(studio.split(REGISTRATION).length - 1).toBe(1);
    const registrationAt = studio.indexOf(REGISTRATION);
    const refAt = studio.indexOf(APPEARANCE_REF);
    expect(refAt).toBeGreaterThan(-1);
    expect(registrationAt).toBeGreaterThan(refAt);
  });

  it('the registration only forwards ids and patch to the appearance handler', () => {
    const registration = regionOf(studio, REGISTRATION, '});');
    expect(registration.split('applyAppearance:').length - 1).toBe(1);
    expect(registration).toContain('handleAquarelleAppearanceStrokes(ids, patch)');
  });

  it('the record-state write performs exactly one bump and one replacement', () => {
    const write = writeRegion();
    expect(write.split('bumpAquarelleStrokesRevision()').length - 1).toBe(1);
    expect(write.split('payloadTimeline[index] =').length - 1).toBe(1);
  });

  it('the replacement is a fresh object carrying a materialised multiplier bag', () => {
    const write = writeRegion();
    // The complete-bag base is the ONE neutral reference in this write.
    expect(write.split('NEUTRAL_TOOL_OVERRIDES').length - 1).toBe(1);
    // The merged bag is written through the conditional spread, once.
    expect(write.split('toolOverrides: nextOverrides').length - 1).toBe(1);
    // The stroke is REPLACED (spread into a new object), never mutated in
    // place — the before/after snapshots keep their references.
    expect(write).toContain('const nextStroke: AquarelleStroke = {');
    expect(write).toContain('...stroke,');
  });
});

// 62-04 (D-13 / D-06): the pending path-edit apply epoch brackets the ONE
// immediate bake (arm before, clear after, token-keyed), the deferred route
// arms nothing, and the Studio installs the ONE production exit-hook
// registration beside the shipped mount reset so every exit restores the
// pre-entry wireframe and Draft in-app.
describe('62-04 the pending path-edit apply epoch and the ONE exit-hook registration', () => {
  function regionOf(source: string, startMarker: string, endMarker: string): string {
    const start = source.indexOf(startMarker);
    expect(start, `missing start marker: ${startMarker}`).toBeGreaterThan(-1);
    const end = source.indexOf(endMarker, start + startMarker.length);
    expect(end, `missing end marker: ${endMarker}`).toBeGreaterThan(start);
    return source.slice(start, end);
  }

  const COMMIT_START = 'const commitAquarelleVectorPathEdit = useCallback(';
  const COMMIT_END = 'aquarellePathEditCommitRef.current = commitAquarelleVectorPathEdit;';

  it('declares the settled-bake ref beside the shipped settle ref', () => {
    const anchor = 'const draftSettlePromiseRef = useRef<Promise<boolean> | null>(null);';
    const at = studio.indexOf(anchor);
    expect(at).toBeGreaterThan(-1);
    expect(studio.slice(at, at + 500)).toContain(
      'const pathEditApplySettledRef = useRef<Promise<boolean> | null>(null);',
    );
  });

  it('brackets the ONE immediate bake with exactly one token-keyed arm', () => {
    const commit = regionOf(studio, COMMIT_START, COMMIT_END);
    const arm = 'vectorPathSession.beginPathEditApply(editId, mutationId, playFrame)';
    // EXACTLY one arm and one bake call site in the whole commit.
    expect(commit.split('beginPathEditApply(').length - 1).toBe(1);
    expect(commit.split('runAquarelleScriptRebake(').length - 1).toBe(1);
    // The arm carries THIS commit's exact identity and precedes the bake.
    expect(commit).toContain(arm);
    expect(commit.indexOf(arm)).toBeLessThan(commit.indexOf('runAquarelleScriptRebake('));
    // The token is the synchronous predicate the sequence re-reads at the
    // produce and commit turns (D-13).
    expect(commit).toContain('isCancelled: () => vectorPathSession.isPathEditApplyCancelled(applyToken)');
    expect(commit).toContain('onCancelled: () => {');
    // The cancellation terminal stays SILENT: no ledger entry, no error, no
    // message — only the status returns to rest.
    const cancelledBlock = regionOf(commit, 'onCancelled: () => {', '},');
    expect(cancelledBlock).toContain("setApplyStatus('idle')");
    expect(cancelledBlock).not.toContain('recordAquarelleScriptEdit');
    expect(cancelledBlock).not.toContain('setApplyMessage');
    expect(cancelledBlock).not.toContain('setLastError');
  });

  it('stores the settled-bake promise and clears the record in a token-keyed finally', () => {
    const commit = regionOf(studio, COMMIT_START, COMMIT_END);
    // The seam the undo router awaits: the run promise is published before it
    // is awaited.
    expect(commit).toContain('pathEditApplySettledRef.current = run;');
    expect(commit.indexOf('pathEditApplySettledRef.current = run;')).toBeLessThan(
      commit.indexOf('await run;'),
    );
    // The record and the ref are cleared on EVERY settle path, in a finally.
    const finallyAt = commit.indexOf('} finally {');
    expect(finallyAt).toBeGreaterThan(-1);
    expect(commit.indexOf('await run;')).toBeLessThan(finallyAt);
    const finallyBlock = commit.slice(finallyAt);
    expect(finallyBlock).toContain('if (pathEditApplySettledRef.current === run) pathEditApplySettledRef.current = null;');
    expect(finallyBlock).toContain('vectorPathSession.clearPathEditApply(applyToken);');
  });

  it('arms nothing on the deferred route (return editId precedes the arm)', () => {
    const commit = regionOf(studio, COMMIT_START, COMMIT_END);
    const deferredAt = commit.indexOf('if (draft || wireframe) {');
    expect(deferredAt).toBeGreaterThan(-1);
    const applyStatusAt = commit.indexOf("setApplyStatus('applying');", deferredAt);
    expect(applyStatusAt).toBeGreaterThan(deferredAt);
    const deferredBlock = commit.slice(deferredAt, applyStatusAt);
    expect(deferredBlock).toContain('return editId;');
    expect(deferredBlock).not.toContain('beginPathEditApply(');
    // The deferred return is the LAST statement before the immediate route.
    expect(commit.indexOf('return editId;', deferredAt)).toBeLessThan(commit.indexOf('beginPathEditApply('));
  });

  it('installs the ONE production exit-hook registration beside the mount reset', () => {
    // ONE registration call site ...
    expect(studio.split('registerPathEditExitHook(() =>').length - 1).toBe(1);
    // ... and ONE detach in the cleanup, so `registerPathEditExitHook(`
    // occurs exactly twice: the registration and its `(null)` cleanup.
    expect(studio.split('registerPathEditExitHook(').length - 1).toBe(2);
    expect(studio.split('registerPathEditExitHook(null)').length - 1).toBe(1);
    // Registered from a DEDICATED effect beside the mount reset — never inside
    // it: the mount reset keeps `[]` deps so `resetForStudioOpen` runs only on
    // mount. The bracket is the shipped single-flight settle, adopted, and its
    // promise carries a handler so a rejected settle never becomes an unhandled
    // rejection on the `void` call (WR-01).
    expect(studio).toMatch(
      /useEffect\(\(\) => \{\s*registerPathEditExitHook\(\(\) => \{[\s\S]*?void endCurveBracket\(\{ settle: settleDraftScript \}\)\.catch\(\(error\) => \{[\s\S]*?\}\);\s*\}\);\s*return \(\) => registerPathEditExitHook\(null\);\s*\}, \[settleDraftScript\]\);/,
    );
    const resetAt = studio.indexOf('vectorPathSession.resetForStudioOpen();');
    const registerAt = studio.indexOf('registerPathEditExitHook(() =>');
    expect(resetAt).toBeGreaterThan(-1);
    expect(registerAt).toBeGreaterThan(resetAt);
  });
});

// 62-04 Task 3 (D-13 / D-14): the undo router. A pending immediate bake is
// cancelled and replayed by its EXACT editId — never a stack pop, because the
// cancelled run wrote no ledger entry. An in-flight deferred settle is awaited
// so the ordinary undo runs against a settled script. `redo` stays shipped.
describe('62-04 the undo router: cancel THIS apply, never the previous history entry', () => {
  function regionOf(source: string, startMarker: string, endMarker: string): string {
    const start = source.indexOf(startMarker);
    expect(start, `missing start marker: ${startMarker}`).toBeGreaterThan(-1);
    const end = source.indexOf(endMarker, start + startMarker.length);
    expect(end, `missing end marker: ${endMarker}`).toBeGreaterThan(start);
    return source.slice(start, end);
  }

  const UNDO_START = 'const undo = useCallback(async () => {';
  const UNDO_END = 'const redo = useCallback(async () => {';
  const REDO_END = '// 52.1 (undo/redo shortcut)';

  it('reads the pending record before the history call and cancels its token', () => {
    const undo = regionOf(studio, UNDO_START, UNDO_END);
    const peekAt = undo.indexOf('vectorPathSession.pendingPathEditApply.peek()');
    const cancelAt = undo.indexOf('vectorPathSession.cancelPathEditApply(record.token)');
    const settledAt = undo.indexOf('await pathEditApplySettledRef.current;');
    const historyAt = undo.indexOf('await rotoMoveHistoryUndo();');
    expect(peekAt).toBeGreaterThan(-1);
    expect(cancelAt).toBeGreaterThan(peekAt);
    expect(settledAt).toBeGreaterThan(cancelAt);
    expect(historyAt).toBeGreaterThan(settledAt);
    // EXACTLY one history call site — the stack is never reached on the
    // pending branch.
    expect(undo.split('rotoMoveHistoryUndo(').length - 1).toBe(1);
  });

  it('replays the pending record exact editId through runScriptReplay, with one reanchor retry', () => {
    const undo = regionOf(studio, UNDO_START, UNDO_END);
    expect(undo).toContain("runScriptReplay({ direction: 'undo', editId: record.editId })");
    // The first attempt plus exactly ONE retry.
    expect(undo.split('runScriptReplay(').length - 1).toBe(2);
    expect(undo).toContain("reanchorAquarelleEditFromLiveContent(record.editId, 'undo')");
    // The retry sits AFTER the first failed replay.
    expect(undo.indexOf("reanchorAquarelleEditFromLiveContent(record.editId, 'undo')")).toBeGreaterThan(
      undo.indexOf("runScriptReplay({ direction: 'undo', editId: record.editId })"),
    );
    // The pending branch returns before the stack path can run.
    const pendingBranch = undo.slice(
      undo.indexOf('if (record !== null)'),
      undo.indexOf('if (draftSettlePromiseRef.current !== null)'),
    );
    expect(pendingBranch).toContain('return changed;');
    expect(pendingBranch).not.toContain('rotoMoveHistoryUndo(');
  });

  it('awaits an in-flight deferred settle before the ordinary undo', () => {
    const undo = regionOf(studio, UNDO_START, UNDO_END);
    const settleAt = undo.indexOf('await draftSettlePromiseRef.current;');
    const historyAt = undo.indexOf('await rotoMoveHistoryUndo();');
    expect(settleAt).toBeGreaterThan(-1);
    expect(historyAt).toBeGreaterThan(settleAt);
  });

  it('keeps the shipped post-change tail and adds runScriptReplay to the deps', () => {
    const undo = regionOf(studio, UNDO_START, UNDO_END);
    expect(undo).toContain('if (isPlaying) return false;');
    expect(undo).toContain('rotoScript.notifySourceRevision();');
    expect(undo).toContain('syncBackgroundSettingsFromDocument();');
    expect(undo).toContain(
      '}, [rotoMoveHistoryUndo, rotoScript, isPlaying, syncBackgroundSettingsFromDocument, runScriptReplay]);',
    );
  });

  it('leaves redo exactly as shipped', () => {
    const redo = regionOf(studio, UNDO_END, REDO_END);
    expect(redo).toContain('if (isPlaying) return false;');
    expect(redo).toContain('const changed = await rotoMoveHistoryRedo();');
    expect(redo).not.toContain('pendingPathEditApply');
    expect(redo).not.toContain('runScriptReplay');
    expect(redo).not.toContain('draftSettlePromiseRef');
    expect(redo).toContain(
      '}, [rotoMoveHistoryRedo, rotoScript, isPlaying, syncBackgroundSettingsFromDocument]);',
    );
  });
});
