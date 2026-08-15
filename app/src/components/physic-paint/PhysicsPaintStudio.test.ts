import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const studio = readFileSync(fileURLToPath(new URL('./PhysicsPaintStudio.tsx', import.meta.url)), 'utf8');
const studioView = readFileSync(fileURLToPath(new URL('./view/PhysicsPaintStudioView.tsx', import.meta.url)), 'utf8');
const main = readFileSync(fileURLToPath(new URL('../../main.tsx', import.meta.url)), 'utf8');
const scriptsPanel = readFileSync(fileURLToPath(new URL('./view/PhysicsPaintScriptsPanel.tsx', import.meta.url)), 'utf8');
const workflowStrip = readFileSync(fileURLToPath(new URL('./view/PhysicsPaintWorkflowStrip.tsx', import.meta.url)), 'utf8');
const rightPanel = readFileSync(fileURLToPath(new URL('./view/PhysicsPaintRightPanel.tsx', import.meta.url)), 'utf8');
const toolRail = readFileSync(fileURLToPath(new URL('./view/PhysicsPaintToolRail.tsx', import.meta.url)), 'utf8');
const topBar = readFileSync(fileURLToPath(new URL('./view/PhysicsPaintTopBar.tsx', import.meta.url)), 'utf8');
const playScriptDialog = readFileSync(fileURLToPath(new URL('./view/PhysicsPaintPlayScriptDialog.tsx', import.meta.url)), 'utf8');
const navigationCoordinator = readFileSync(fileURLToPath(new URL('./hooks/useRotoNavigationCoordinator.ts', import.meta.url)), 'utf8');
const physicalEditCoordinator = readFileSync(fileURLToPath(new URL('./hooks/useRotoPhysicalEditCoordinator.ts', import.meta.url)), 'utf8');
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

  it('keeps Save, Load/Paintbrush, Create Group, and cached Roto playback distinct', () => {
    const save = scriptsPanel.indexOf('label="Save Action"');
    const paintbrush = scriptsPanel.indexOf('label="Load + Apply to Frame"');
    const playScript = scriptsPanel.indexOf('label="Create Group…"');
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

  it('extends Studio cached playback through the loop-aware physical end frame', () => {
    expect(studio).toContain('getEndFrame: () => launchContext ? physicPaintStore.getRotoPhysicalEndFrame(launchContext.layerId) : null,');
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
    expect(studio).toContain('physicPaintStore.getRotoPhysicalDocument(launchContext.layerId)');
    expect(studio).toContain('const layerEndExclusive = launchContext.rotoPhysical?.layerEndExclusive;');
    expect(studio).toContain('layerEndExclusive,');
    expect(studio).toContain('remainingCapacity: Math.max(0, layerEndExclusive - placementStart)');
    expect(studio).toContain('rotoParentEndExclusive: launchContext?.rotoPhysical?.layerEndExclusive ?? 0,');
    expect(studio).not.toContain('rotoParentEndExclusive: rotoPhysicalCapacity');
    expect(studio).not.toContain('layerEndExclusive: physicalCapacity');
    expect(studio).toContain('onOpenLoopEdit: handleOpenRotoLoopEdit,');
    expect(studio).toContain('onOpenRotoLoopEdit: handleOpenRotoLoopEdit,');
    expect(studio).toContain('onCloseLoopClip: handleCloseRotoLoopClip,');
    expect(studio).toContain('selectedLoopClipId.value = null;');
    expect(scriptsPanel).toContain('void onOpenLoopEdit(selectedLoopClip.loopId);');
    expect(scriptsPanel).not.toContain('onOpenLoopEdit?.');
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
    expect(studio).toContain('const rotoLoopClips = useMemo(() => launchContext ? physicPaintStore.getRotoPhysicalLoopClips(launchContext.layerId) : PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY, [launchContext?.layerId, physicPaintVersion.value]);');
    expect(studio).toContain('getRotoPhysicalDocument: (layerId) => physicPaintStore.getRotoPhysicalDocument(layerId),');
    expect(studio).toContain('getRotoPhysicalRenderSource: (layerId, appFrame) => physicPaintStore.getRotoPhysicalRenderSource(layerId, appFrame),');
    expect(studio).toContain('getRenderSource: (appFrame) => launchContext ? physicPaintStore.getRotoPhysicalRenderSource(launchContext.layerId, appFrame) : null,');

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
    expect(studio).toContain('if (!await capture) {');
    expect(studio).toContain('engineRef.current as PreviewBackgroundEngine | null,\n          undefined,\n          true,');
  });

  it('stamps records-only ownership rebuilds with the complete canonical revision', () => {
    const replacementStart = studio.indexOf('const replacePhysicalRecordsWithOwnership = (');
    const replacementEnd = studio.indexOf('const replacePhysicalDocumentWithOwnership = (', replacementStart);
    const replacement = studio.slice(replacementStart, replacementEnd);
    expect(replacementStart).toBeGreaterThanOrEqual(0);
    expect(replacement).toContain('getRotoPhysicalLoopClips(layerId)');
    expect(replacement).toContain('getRotoPhysicalIncomingInterpolationBreakKeyIds(layerId)');
    expect(replacement).toContain('getRotoGroupOverrideRecords(layerId)');
    expect(replacement).toContain('records,\n      interpolation,\n      currentLoopClips,\n      currentIncomingBreaks,\n      currentGroupOverrides,');
    expect(replacement).toContain('contentRevision: nextRevision');
  });

  it('keeps deferred Group and Action editing surfaces absent from the accepted Studio UI', () => {
    const production = [studio, studioView, scriptsPanel, workflowStrip, rightPanel, toolRail, topBar, playScriptDialog].join('\n');
    for (const deferredSurface of [
      'Update Action from Group Frame',
      'Relink Group',
      'Push Right',
      'Push Left',
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
    expect(studio).toContain('[launchContext?.layerId, physicPaintVersion.value]');
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
    expect(selection).toContain('physicPaintStore.setRotoPhysicalSelection(\n        launchContext.layerId,\n        null,\n        currentFrame,\n      );');
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
    expect(selectAll).toContain('physicPaintStore.setRotoPhysicalSelection(\n        launchContext.layerId,\n        null,\n        currentFrame,\n      );');
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
    expect(snapshot).toContain('physicPaintStore.getRotoRealKeyRecords(layerId)');
    expect(snapshot).toContain('physicPaintStore.getRotoGroupOverrideRecords(layerId)');
    expect(snapshot).toContain('physicPaintStore.getRotoPhysicalLoopClips(layerId)');
    expect(snapshot).toContain('physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(layerId)');
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
    expect(studio).toContain('const handleClearRotoKeySelection = useCallback(() => {\n    selectedKeyIds.value = [];\n    selectionAnchorKeyId.value = null;');
    expect(studio).toContain('onClearRotoKeySelection: handleClearRotoKeySelection');
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
    expect(studio).toContain('This is the Group’s only frame. Delete Frame will remove the whole Group and its uniquely owned data. The Action is kept.');
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

// Phase 43 Plan 09 Task 3 (D-28, audit finding 6): the Studio consumes the
// 'loop-placeholder' render-source variant explicitly — the playback
// availability path excludes it without blocking, the display path falls back
// to the established non-blocking clear, and the frame is never offered as
// real key content.
describe('Physics Paint Studio loop placeholder contract (D-28)', () => {
  it('handles the placeholder variant explicitly in the playback availability memo', () => {
    expect(studio).toContain("case 'loop-placeholder':");
    // The placeholder frame never contributes playback payload.
    expect(studio).not.toContain("source.kind !== 'loop-placeholder' ? [{ appFrame, frame: source.renderedFrame }]");
  });

  it('keeps the never-fallback exhaustiveness arm so a future render-source variant is a compile-time error', () => {
    expect(studio).toContain('Unhandled Roto physical render-source kind');
    expect(studio).toContain('const exhaustive: never = source');
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
    expect(studio).toContain("import { useComputed, useSignal } from '@preact/signals';");
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
    expect(engineLifecycle).toContain('}, [engine, input.launchContext?.rotoPhysical?.background]);');
  });

  it('retains Plan 09 wrappers while adding the Plan 11 CanvasStack memo and two Studio identity resolves', () => {
    expect(countOccurrences(toolRail, 'memo(')).toBe(1);
    expect(countOccurrences(rightPanel, 'memo(')).toBe(0);
    expect(countOccurrences(memoizedTopBar, 'memo(')).toBe(1);
    expect(countOccurrences(memoizedPlayScriptDialog, 'memo(')).toBe(1);
    expect(countOccurrences(rightPanelRegion, 'memo(')).toBe(1);
    expect(countOccurrences(studioView, 'memo(')).toBe(1);
    expect(countOccurrences(canvasMount, 'memo(')).toBe(0);
    expect(countOccurrences(studio, 'PropsMemo.resolve(')).toBe(7);
    expect(studioView).toContain('}, []);');
    expect(canvasMount).toContain('}, [props.height, props.width]);');
  });
});
