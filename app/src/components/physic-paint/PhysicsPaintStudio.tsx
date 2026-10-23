import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { effect, signal, useComputed, useSignal, type ReadonlySignal } from '@preact/signals';
import type { CompletedPaintMutation, EfxPaintDocument, EfxPaintEngine, PaintHistoryAvailability, PaintPerformanceSample, ToolType } from '@efxlab/efx-physic-paint';
import type { BlendMode, DocumentSoundClip, FrameLoopClipRepeat, FrameLoopClipScale } from '../../efx-paint/document/efxPaintDocument';
import type { SoundBandGesturePatch } from './view/soundBandGeometry';
import type { PhysicPaintApplyResult, PhysicPaintAudioAssetRef, PhysicPaintLaunchContext, PhysicPaintRotoBackgroundMetadata, PhysicPaintRotoCacheFrame, PhysicPaintRotoPlaybackSettings, RailSetDeleteMember } from '../../types/physicPaint';
import type { MceImageRef } from '../../types/project';
import type { MissingRotoFrameDrawInstruction } from '../../lib/rotoFrameDraw';
import { physicPaintRotoPhysicalOperationLeaseVersion, physicPaintStore, physicPaintVersion, rotoPhysicalRevision, resolveContentToken, hydrateBackgroundSourceImagesFromLibrary, hydrateReferenceSourceImagesFromLibrary, prefetchNeighborFrames, type PhysicPaintRotoPhysicalOperationLeaseToken } from '../../stores/physicPaintStore';
import {
  _setEfxPaintRevealScriptLoader,
  _setEfxPaintTrackScriptDeleteCallback,
  addBackgroundClip,
  addTrack,
  commitDeleteTrack,
  createRevealRail,
  duplicateTrack,
  efxPaintVersion,
  getDocument as getEfxPaintDocument,
  renameTrack,
  reorderTrack,
  requestDeleteTrack,
  serializeRuntimeIntoDocument,
  setActiveTrackId,
  setBackgroundClipRepeat,
  setBackgroundClipScale,
  setBackgroundClipSource,
  setBackgroundFallback,
  setPhotoReferenceSource,
  setPhotoReferenceVisible,
  setPhotoReferenceOpacity,
  setPhotoReferenceTransformLocked,
  setBackgroundTransformLocked,
  patchDocumentSound,
  addDocumentSound,
  clearPhotoReference,
  setTrackBlend,
  setTrackOpacity,
  setTrackVisible,
  deleteBackgroundClip,
  type TrackMutationResult,
} from '../../stores/efxPaintStore';
import { buildPhysicPaintRotoPhysicalRevision, PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED, PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY, type PhysicPaintRotoInterpolationState, type PhysicPaintRotoLoopClip, type PhysicPaintRotoPhysicalDocument, type PhysicPaintRotoRealKeyRecord } from './roto/physicsPaintRotoPhysicalModel';
import { resolvePhysicPaintTrackVisibility } from '../../lib/previewRenderer';
import { collectDiscardableRotoGroupOwnedFrames, rebuildRotoPhysicalOwnership } from './roto/rotoPhysicalOwnership';
import { selectAllRotoKeyIds, collapseRotoKeySelection, toggleRotoKeySelection, extendRotoKeySelectionRange, resolvePostAcceptanceRotoStudioSelection } from './roto/physicsPaintRotoMultiSelection';
import {
  extendPhysicsPaintRotoSpacingProxyRange,
  reconcilePhysicsPaintRotoLoopClipSelection,
  reconcilePhysicsPaintRotoSpacingSelection,
  selectPhysicsPaintRotoSpacingProxyPlain,
  togglePhysicsPaintRotoSpacingProxy,
  updatePhysicsPaintRotoLoopClipSelection,
  type PhysicsPaintRotoSpacingProxy,
  type PhysicsPaintRotoSpacingSelection,
  type PhysicsPaintRotoSpacingSelectionGesture,
} from './roto/physicsPaintRotoSpacingSelection';
import {
  clearRailSetSnapshots,
  deriveEffectiveRailSetMembers,
  deriveRailSetOrder,
  reconcileRailSetSelection,
  recordRailSetSnapshot,
  resolveRailSetPostAcceptance,
  seedRailSetSelection,
  updatePhysicsPaintRotoRailSetSelection,
  type RailSetIdentity,
  type RailSetSelectionState,
} from './roto/physicsPaintRotoRailSetSelection';
import type { PhysicPaintRailSetMoveMember } from './roto/physicsPaintRotoPhysicalResolver';
import { deriveRotoSelectionPlaybackWindow, type RotoSelectionPlaybackWindow } from './roto/physicsPaintRotoSelectionPlaybackWindow';
import { paintStore } from '../../stores/paintStore';
import { clampOnionCount, type PhysicsPaintOnionState } from './view/physicsPaintWorkflowPresentation';
import { applyAquarelleEventsToKey, mapRevealRailRejectionReason } from './roto/physicsPaintRotoPlayScriptController';
import { PhysicsPaintStudioView } from './view/PhysicsPaintStudioView';
import type { EfxPaintProgramMonitorMissingSummary } from './view/PhysicsPaintProgramMonitor';
import type { TrackRowRailSelection } from './view/PhysicsPaintTrackRow';
import { findAdjacentRealKeyFrame, isPhysicsPaintShortcutTarget } from './view/physicsPaintStudioKeyboard';
import {
  mountPhysicsPaintTemporaryErase,
  resolveEffectiveTool,
  syncTemporaryErase,
  temporaryErase,
  temporaryMove,
  type TemporaryEraseDeps,
} from './view/physicsPaintTemporaryErase';
import { aquarelleActiveTool } from './view/aquarelleRecordState';
import type { RotoPhysicalEditAcceptedOutput, RotoPhysicalEditSnapshot } from './roto/rotoCoordinatorPorts';
import { disarmPushTool, isPushCommitInFlight } from './view/physicsPaintPushArmedTool';
import { disarmSolo } from './view/physicsPaintSoloArm';
import { usePhysicsPaintStudioKeyboard } from './hooks/usePhysicsPaintStudioKeyboard';
import { createIdentityMemo, usePhysicsPaintStudioViewModel } from './hooks/usePhysicsPaintStudioViewModel';
import { useRotoTimelineActions, type RotoGroupLifecycleDeleteTarget, type RotoKeyRailSelection } from './hooks/useRotoTimelineActions';
import { useRotoTimelineModel } from './hooks/useRotoTimelineModel';
import { selectRealCachedRotoSourceFrameNumbers } from './roto/rotoTimelineSelectors';
import { useRotoNavigationCoordinator } from './hooks/useRotoNavigationCoordinator';
import { getFrameBlobUrl } from './hooks/useRotoReferenceController';
import { recordsAsRuntimeFramesToleratingReferences, resolveRotoCompletedGroupPaintTarget, shouldReloadRotoFrameAfterFailedCapture, useRotoFramePersistenceCoordinator } from './hooks/useRotoFramePersistenceCoordinator';
import { getCarriedRotoPhysical } from './roto/rotoLaunchHydration';
import { useRotoFrameEditingController } from './hooks/useRotoFrameEditingController';
import { useRotoPhysicalEditCoordinator, type RotoGroupFramePaintExecuteInput, type RotoGroupLifecycleDeleteExecuteInput, type RotoPhysicalEditCoordinatorExecuteInput, type RotoRailSetDeleteExecuteInput, type RotoRailSetPasteExecuteInput } from './hooks/useRotoPhysicalEditCoordinator';
import { DEFAULT_PHYSICS_PAINT_CANVAS_HEIGHT, DEFAULT_PHYSICS_PAINT_CANVAS_WIDTH, getPhysicsPaintWorkingSize } from './engine/physicsPaintCanvasSizing';
import { usePhysicsPaintEngineLifecycle } from './engine/usePhysicsPaintEngineLifecycle';
import { usePhysicsPaintEngineActions } from './engine/usePhysicsPaintEngineActions';
import { aquarelleEnginePixelDeltaToUv, aquarelleStrokeToPaintStroke } from './engine/aquarelleStrokeBridge';
import { useRotoBackgroundMetadataSync } from './hooks/useRotoBackgroundMetadataSync';
import { getOnionFrameOpacity, projectRotoOnionPreviewFrames } from './roto/rotoOnionPreview';
import { selectPhysicsPaintMissingConditions, selectRotoPlaybackAvailable } from './view/physicsPaintStudioSelectors';
import { projectPhysicsPaintLoopClipPresentation } from './view/physicsPaintLoopClipPresentation';
import { deriveKeyRailSegments } from './view/physicsPaintKeyRailPresentation';
import type { KeyRailSegment } from './view/physicsPaintKeyRailPresentation';
import { applyBackgroundFallbackToSettings, backgroundModeToFallback, buildRotoBackgroundMetadata, makeInitialPhysicsPaintStudioSettings, type PhysicsPaintStudioSettings, type StudioBackgroundMode } from './engine/physicsPaintStudioSettings';
import { parsePhysicsPaintLaunchContext } from './bridge/physicsPaintLaunchContext';
import { createPhysicPaintThumbnailNativeEncoder, sendEfxPaintDocumentSync, sendPhysicPaintApplyPayload, sendPhysicPaintAudioOwnership, sendPhysicPaintFrameSyncMessage, writeEfxPaintSessionDocumentCheckpoint } from './bridge/physicsPaintBridgeTransport';
import { createDocumentSyncPushDecision, createDocumentSyncPushGuard, type DocumentSyncPushGuard } from './bridge/documentSyncPushGuard';
import { beginInteraction, endInteraction, interactionIdle, markInteractionActive, readInteractionIdle, readLastInteractionAt } from './bridge/gestureIdleScheduler';
import { installPhysicPaintFlushRequestListener } from '../../lib/physicPaintFlush';
import { createFlushPipeline, type FlushStep, type FlushPipeline } from './pilot/flushPipeline';
import { efxPaintAudioOwnership } from './audio/efxPaintAudioOwnership';
import { efxPaintAudioMonitor } from './audio/efxPaintAudioMonitor';
import { audioPreviewEnabled, setAudioPreviewEnabled } from './audio/efxPaintAudioPreviewStore';
import { buildBlankRotoFrame, type RenderedFramePayload } from './roto/rotoCanvasFrames';
import { resolvePreviousRealKeyBase } from './roto/physicsPaintRotoPreviousKeyBase';
import { detectPhysicsPaintBridgeMode, usePhysicsPaintBridgeMode, usePhysicsPaintCloseFlush } from './bridge/usePhysicsPaintParentBridge';
import { usePhysicsPaintLaunchIntegration } from './hooks/usePhysicsPaintLaunchIntegration';
import { usePhysicsPaintApplyResultController } from './hooks/usePhysicsPaintApplyResultController';
import { isPhysicsPaintProfilingEnabled, recordPhysicsPaintPerformance, recordPhysicsPaintPerformanceCounter } from './performance/physicsPaintPerformanceTrace';
import { installDh1CaptureHook } from './performance/depositSpeckleCapture';
import { installLookDeltaCapture } from './performance/lookDeltaCapture';
import { installScriptMemoryProbe } from './performance/scriptMemoryProbe';
import {
  readStudioScriptMemorySnapshot,
  type StudioScriptMemorySectionPorts,
} from './performance/studioScriptMemoryGauge';
import { isRotoSessionCopiedRailSet } from './roto/physicsPaintRotoSession';
import {
  buildRotoRailSetOperationResult,
  type RotoRailSetCopyPayload,
  type RotoRailSetCopyPlacementMode,
  type RotoRailSetOperationResultMember,
  type RotoRailSetPasteIdentity,
} from './roto/physicsPaintRotoRailSetCopy';
import { usePhysicsPaintWorkflowIntegration } from './hooks/usePhysicsPaintWorkflowIntegration';
import { useRotoPlaybackSettingsController } from './hooks/useRotoPlaybackSettingsController';
import { useRotoScriptClipboardController } from './hooks/useRotoScriptClipboardController';
import { normalizeLogicalBrushes, type RotoScriptPhysicalTarget, type RotoScriptSourceSnapshot } from './roto/physicsPaintRotoScriptClipboard';
import { copyAquarelleScriptToFrame, runRotoDuplicateWithScript, waitForRotoDuplicateSourceFrame } from './roto/physicsPaintRotoDuplicateScript';
import { buildRotoScriptApplyRefusalMessage } from './roto/physicsPaintRotoScriptApplyRefusal';
import { buildReplayProposal, snapshotRevision, useRotoPhysicalEditHistory } from './hooks/useRotoPhysicalEditHistory';
import { useRotoScriptLibraryController } from './hooks/useRotoScriptLibraryController';
import { createRotoNavigationGeneration, createRotoUiFlushScheduler } from './hooks/rotoUiFlushScheduler';
import { armRotoCompletionPaintGuard } from './hooks/rotoCompletionPaintGuard';
import { useRotoPlayScriptController } from './hooks/useRotoPlayScriptController';
import { useBackgroundAssetPickerController } from './view/BackgroundAssetPickerView';
import { buildDuplicatedSoundClip, usePhysicsPaintAudioController, type PhysicsPaintAudioController } from './view/physicsPaintAudioController';
import { getTimelineViewportFrames } from './view/PhysicsPaintWorkflowStrip';
import {
  createStudioScriptSnapshotController,
  type StudioScriptSnapshotController,
} from './snapshot/studioScriptSnapshotController';
// quick-261023-ors Task 3: the committed rail delete cascades to that rail's
// persisted snapshot on BOTH legs (package + cache).
import { createStudioScriptSnapshotTrackDelete } from './snapshot/studioScriptSnapshotTrackDelete';
import type { StudioScriptSnapshotIdentity } from './performance/studioScriptSnapshotCodec';
import type { AudioSectionPorts } from './view/PhysicsPaintAudioListSection';
import { AUDIO_IMPORT_CTA } from './view/PhysicsPaintAudioModalView';
// 52.5-01b: the Document sound import flow reuses the EXISTING decode/peaks
// machinery (D-04 — no new decode path): assetUrl fetch → audioEngine.decode →
// audioPeaksCache (the task-3 stain reads peaks keyed by sourceId).
import {
  assetUrl,
  ipcStudioScriptSnapshotDelete,
  ipcStudioScriptSnapshotRead,
  ipcStudioScriptSnapshotWrite,
} from '../../lib/ipc';
import { isSoundSourceMissing, collectMissingSoundSourcePaths } from '../../lib/documentSoundMissing';
import { audioEngine } from '../../lib/audioEngine';
import { computeWaveformPeaks } from '../../lib/audioWaveform';
import { audioPeaksCache } from '../../lib/audioPeaksCache';
import { efxPaintDocumentAudioStore } from './audio/efxPaintDocumentAudioStore';
import { encodeSourceBytesForDocumentSync, requestImageImport, requestImageLibrary, requestPhysicPaintProjectContext } from '../../lib/physicPaintBridge';
import { sortImagesByOriginalFilename } from '../../efx-paint/utils/naturalFilenameSort';
import { imageStore } from '../../stores/imageStore';
import { open as openNativeImageDialog } from '@tauri-apps/plugin-dialog';
import { createRotoScriptThumbnail } from './roto/physicsPaintRotoScriptThumbnail';
import { activeModule } from '../shared/activeModule';
import {
  adoptBrushScriptFrameAsComplete,
  brushScriptRevision,
  clearBrushScriptFrame,
  computeBrushScriptPruneFrame,
  flushBrushScriptFrame,
  getBrushScriptFrameEntries,
  noteBrushScriptArrivalBase,
  pruneBrushScriptsFromFrame,
  purgeAllBrushScriptFrames,
  purgeBrushScriptFrame,
  resetBrushScriptStore,
} from './view/brushScriptRecordState';
import {
  applyCompletedBrushMutation,
  attemptBrushScriptHydration,
  engineHoldsBrushScriptFrame,
  planBrushScriptHydration,
  type BrushHydrationRequest,
} from './view/brushScriptHydration';
import {
  aquarelleStrokesRevision,
  getAquarelleEventsForFrame,
  getRecordedAquarellePayloadTimeline,
  purgeAllAquarelleKeyScripts,
  purgeAquarelleFrameScript,
  recordAquarelleStroke,
  resetAquarelleRecordState,
  setAquarelleParam,
  setAquarelleStrokeDiffusionFrames,
} from './view/aquarelleRecordState';
import {
  aquarelleLiveStrokeCount,
  aquarelleScriptStrokeEditionPort,
  aquarelleSelectMode,
  beginAquarelleDeleteEdit,
  beginAquarelleMoveEdit,
  beginAquarelleReorderEdit,
  isAquarelleDeleteInFlight,
  isAquarelleScriptEditInFlight,
  restoreAquarelleEditSnapshot,
  restoreAquarelleSnapshotRaw,
  setAquarelleDeleteInFlight,
  setAquarelleScriptEditInFlight,
  toggleAquarelleSelectMode,
} from './view/aquarelleStrokeSelection';
import {
  deleteSelectedScriptStroke,
  setScriptStrokeEditionPorts,
  stepSelectedScriptStroke,
} from './view/scriptStrokeEdition';
import {
  brushScriptEditionPort,
  configureBrushScriptEdition,
  type BrushScriptEditionContext,
} from './view/brushScriptEditionPort';
import type { AquarelleStroke } from '@efxlab/efx-watercolor';
import { isAquarelleDryEvent } from '@efxlab/efx-watercolor/payload';
import './physicsPaintStudio.css';
const DEFAULT_ONION_STATE: Omit<PhysicsPaintOnionState, 'opacity'> = { enabled: false, previous: true, next: false, count: 1 };
// quick-261023-l35 (T-261023-l35-05): the close path waits at most this long
// for the script snapshot write before closing anyway.
const STUDIO_SCRIPT_SNAPSHOT_CLOSE_BUDGET_MS = 2000;
type ApplyStatus = 'idle' | 'applying' | 'success' | 'error';
type GroupLifecycleDeleteTarget = Readonly<Omit<RotoGroupLifecycleDeleteTarget, 'mode'> & {
  operationKind: 'delete-group-frame' | 'delete-group';
}>;
type SoleOccurrenceDeleteTarget = Readonly<GroupLifecycleDeleteTarget & {
  operationKind: 'delete-group-frame';
}>;
type PreviewBackgroundEngine = EfxPaintEngine & { setBackgroundImageUrl: (dataUrl: string) => void; resetBackground: (skipRedraw?: boolean) => void; setPreviewBaseImageUrl: (dataUrl: string) => void; clearPreviewBaseImage: (skipRedraw?: boolean) => void };

// Quick 261019-mj2 Task 3: the ONE direct-paint promotion seam. A non-real
// cell (empty or generated/interpolated) paints immediately while the blank
// real key is created in parallel; the stroke's capture awaits this result and
// attaches to the created key. Never a buffer/replay path.
type RotoPaintPromotionSource = 'auto-key-paint';
interface RotoPaintPromotionSuccess {
  readonly ok: true;
  readonly keyId: string;
  readonly appFrame: number;
  readonly blankFrame: RenderedFramePayload;
}
interface RotoPaintPromotionFailure {
  readonly ok: false;
  readonly error: string;
  /** Underlying reason for the LOG (the capsule keeps the friendly copy). */
  readonly diagnostic?: string;
  /** The accepted command's prior snapshot — replayed when the parent created
   *  a key the child could no longer validate (no silent blank key). */
  readonly acceptedBefore?: RotoPhysicalEditSnapshot<EfxPaintDocument>;
  /** The accepted command identity + its after revision, needed for the replay
   *  provenance (undo = after → before). */
  readonly acceptedOperationId?: string;
  readonly acceptedSourceRevision?: string;
}
type RotoPaintPromotionResult = RotoPaintPromotionSuccess | RotoPaintPromotionFailure;
interface PendingRotoFirstPaintTarget {
  readonly launchOperationId: string;
  readonly layerId: string;
  readonly appFrame: number;
  readonly source: RotoPaintPromotionSource;
  /** Resolved by the helper BEFORE dispatch — the accepted-key reload
   *  suppression pins this as the frame's repaint base. */
  blankFrame: RenderedFramePayload | null;
  /** Quick 261022-cfn Task 1: which base `blankFrame` holds. A cloned base
   *  multiplies an aquarelle sheet over the previous key's paint; a blank base
   *  encodes the sheet alone. Assigned with `blankFrame`, before dispatch. */
  baseKind: 'clone' | 'blank';
  readonly promise: Promise<RotoPaintPromotionResult>;
  /** Set by the completed-mutation seam so the failure policy knows whether a
   *  stroke already landed on the live canvas. */
  completedMutationObserved: boolean;
}
const ROTO_AUTO_KEY_PROMOTION_ERROR = 'Could not create a Roto key on this frame — the stroke was discarded.';

/**
 * 49-03 (D-11 consumption half): bridge the store's resolved fond instruction
 * (the document-fallback authority) to the view's `PhysicPaintRotoBackgroundMetadata`
 * fond-layer prop. The round-trip is lossless for the two fallback arms: a solid
 * fallback maps to the White metadata (the selector's only solid arm, color
 * carried), a paper fallback maps to its texture with the grain controls. The
 * view re-resolves the metadata through `subscribeRotoPlaybackBackground` and
 * draws the same pixels the flattened path draws.
 */
function fondInstructionToFondMetadata(
  instruction: Extract<MissingRotoFrameDrawInstruction, { kind: 'background-only' }>,
): PhysicPaintRotoBackgroundMetadata {
  if (instruction.paperTexture) {
    return {
      background: instruction.paperTexture as PhysicPaintRotoBackgroundMetadata['background'],
      grainStrength: instruction.grainStrength ?? 0,
      grainScale: instruction.grainScale ?? 1,
    };
  }
  return {
    background: 'white',
    grainStrength: 0,
    grainScale: 1,
    color: instruction.color,
  };
}

function getLinkedRotoGroupsForAction(
  loopClips: readonly PhysicPaintRotoLoopClip[],
  actionId: string | null,
): readonly PhysicPaintRotoLoopClip[] {
  if (!actionId) return [];
  const groupsById = new Map<string, PhysicPaintRotoLoopClip>();
  for (const loopClip of loopClips
    .filter((loopClip) => loopClip.scriptId === actionId)
    .sort((left, right) => left.placementStart - right.placementStart || left.loopId.localeCompare(right.loopId))) {
    if (!groupsById.has(loopClip.loopId)) groupsById.set(loopClip.loopId, loopClip);
  }
  return [...groupsById.values()];
}

function chooseCursorRelativeLinkedGroup(
  linkedGroups: readonly PhysicPaintRotoLoopClip[],
  cursorFrame: number,
): PhysicPaintRotoLoopClip | null {
  return linkedGroups.find((group) => group.placementStart >= cursorFrame)
    ?? linkedGroups[linkedGroups.length - 1]
    ?? null;
}

function reconcileRotoKeyRailSelection(
  selection: RotoKeyRailSelection | null,
  segments: readonly KeyRailSegment[],
): RotoKeyRailSelection | null {
  if (!selection) return null;
  return segments.some((segment) => (
    selection.firstKeyId === segment.firstKeyId
    && selection.keyIds.length === segment.keyIds.length
    && selection.keyIds.every((keyId, index) => keyId === segment.keyIds[index])
  )) ? selection : null;
}

/**
 * 43.6-08 (quick 260820-bjw): builds the session rail-set selection from the
 * accepted paste impact's ordered fresh identities — key-rail members keyed by
 * the fresh firstKeyId, loop members by the fresh loopId, anchor = first pasted
 * rail (RED 4). The identities are authoritative (fresh, guaranteed present in
 * the accepted document), so no reconcile is needed here.
 */
function buildPastedRailSetFromImpact(identities: readonly RotoRailSetPasteIdentity[]): RailSetSelectionState {
  const members: RailSetIdentity[] = identities.map((identity) => (
    identity.kind === 'loop'
      ? { kind: 'loop', loopId: identity.id }
      : { kind: 'key-rail', firstKeyId: identity.id }
  ));
  return Object.freeze({
    members: Object.freeze(members),
    anchor: members[0] ?? null,
  });
}

/** Resolve a set's members to visible intervals for the operation-result copy
 *  (UAT-3): key-rail via its segment, loop via its resolution range. Mirrors the
 *  strip's set-copy interval derivation. */
function resolveSetOperationIntervals(
  members: readonly RailSetIdentity[],
  keyRailSegments: readonly { firstKeyId: string; firstKeyFrame: number; lastKeyFrame: number }[],
  loopRanges: readonly { loopId: string; placementStart: number; effectiveEnd: number }[],
): RotoRailSetOperationResultMember[] {
  const intervals: RotoRailSetOperationResultMember[] = [];
  for (const member of members) {
    if (member.kind === 'key-rail') {
      const segment = keyRailSegments.find((candidate) => candidate.firstKeyId === member.firstKeyId);
      if (segment) {
        intervals.push({ kind: 'key-rail', firstFrame: segment.firstKeyFrame, effectiveEndExclusive: segment.lastKeyFrame + 1 });
      }
    } else {
      const range = loopRanges.find((candidate) => candidate.loopId === member.loopId);
      if (range) intervals.push({ kind: 'loop', firstFrame: range.placementStart, effectiveEndExclusive: range.effectiveEnd });
    }
  }
  return intervals;
}

/** Resolve a delete impact's members to visible intervals from the accepted
 *  BEFORE snapshot (robust after the rails are gone from the store): key-rail
 *  members resolve their keyIds to frames; loop members use their clip's source
 *  key frames, falling back to the placement anchor. */
function resolveDeleteOperationIntervals(
  members: readonly RailSetDeleteMember[],
  before: Readonly<{
    records: readonly { keyId: string; appFrame: number }[];
    loopClips: readonly { loopId: string; placementStart: number; sourceKeyIds: readonly string[] }[];
  }>,
): RotoRailSetOperationResultMember[] {
  const frameByKeyId = new Map(before.records.map((record) => [record.keyId, record.appFrame]));
  const intervals: RotoRailSetOperationResultMember[] = [];
  for (const member of members) {
    if (member.kind === 'key-rail') {
      const frames = member.keyIds
        .map((keyId) => frameByKeyId.get(keyId))
        .filter((frame): frame is number => typeof frame === 'number');
      intervals.push({
        kind: 'key-rail',
        firstFrame: frames.length > 0 ? Math.min(...frames) : 0,
        effectiveEndExclusive: frames.length > 0 ? Math.max(...frames) + 1 : 1,
      });
    } else {
      const clip = before.loopClips.find((candidate) => candidate.loopId === member.loopId);
      const frames = (clip?.sourceKeyIds ?? [])
        .map((keyId) => frameByKeyId.get(keyId))
        .filter((frame): frame is number => typeof frame === 'number');
      const anchor = frames.length > 0 ? Math.min(...frames) : (clip?.placementStart ?? 0);
      intervals.push({ kind: 'loop', firstFrame: anchor, effectiveEndExclusive: anchor + 1 });
    }
  }
  return intervals;
}

/**
 * 47-01 UAT round 8: collapse a burst of source revisions into ONE trailing
 * flush. The Studio's strip subscriptions re-render the whole component on
 * every paint event (physicPaintVersion bumps per stroke mutation, and the
 * strip rebuilds 600+ cell class strings per render) — the start-paint
 * stutter the user reported. A trailing throttle freezes the chrome while a
 * stroke is in flight and refreshes it shortly after the burst ends.
 */
function useTrailingThrottledRevision(source: ReadonlySignal<number>, delayMs: number): ReadonlySignal<number> {
  const throttled = useRef(signal(source.peek()));
  const timerRef = useRef<number | null>(null);
  const latestRef = useRef(source.peek());
  useEffect(() => {
    const flush = () => {
      timerRef.current = null;
      // 52.1: the chrome rebuild (600+ strip cells — the JS commit is ~130ms
      // but the layer rasterization storm it queues chokes the shared GPU
      // process for ~600ms) must never fire inside a paint cadence. Require
      // 1s of REAL quiet, not merely "idle at timer expiry": an inter-stroke
      // gap of 400ms+ flips interactionIdle while the user is about to press
      // the next stroke.
      const quietFor = performance.now() - readLastInteractionAt();
      if (!readInteractionIdle() || quietFor < delayMs) {
        timerRef.current = window.setTimeout(flush, 300);
        return;
      }
      throttled.current.value = latestRef.current;
    };
    const unsubscribe = effect(() => {
      const next = source.value;
      if (next === latestRef.current) return;
      latestRef.current = next;
      if (timerRef.current === null) {
        // 52.1: idle changes (e.g. a +Key click) must show promptly; only a
        // change arriving mid-gesture (paste-key at stroke start on a virgin
        // frame) waits for the long quiet window.
        const idleDelay = readInteractionIdle() && performance.now() - readLastInteractionAt() >= delayMs ? 150 : delayMs;
        timerRef.current = window.setTimeout(flush, idleDelay);
      }
    });
    return () => {
      unsubscribe();
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);
  return throttled.current;
}

/**
 * 47 leak fix: module-level (identity-stable) active-track reader for the
 * background-metadata sync effect. An inline arrow here got a new identity
 * every Studio render, re-firing the effect every render — combined with the
 * store's unconditional revision bump that formed a self-sustaining ~65/s
 * render loop.
 */
function readDocumentActiveTrackId(layerId: string): string {
  return getEfxPaintDocument(layerId)?.activeTrackId ?? '';
}

// 52.1: the gesture-path documentSync flush must wait for real quiet, not the
// 400ms idle flip (which lands between two strokes). The full-document push
// (4.4MB) + main-window decode re-saturates the shared GPU process; at 1s of
// quiet that still fired inside a ~1.5s inter-stroke gap and froze the very
// next stroke ("always the 2nd stroke" on a fresh key). 2500ms puts the push +
// decode at a genuine stop. Matches CAPTURE_PRODUCE_QUIET_MS.
const DOCUMENT_SYNC_GESTURE_QUIET_MS = 2500;

// 260921-e21: how many AUTOMATIC re-flushes a failed document push may arm.
// The reference selection, the background image keyframes and the tracks added
// with (+) reach the main realm ONLY through this push, so a failed send must
// not consume the change — but the 2s debounce must never become an unbounded
// retry loop either. Past the budget the change stays owed and the close flush
// (user-driven, one-shot) is the last attempt.
const DOCUMENT_SYNC_MAX_AUTO_RETRIES = 3;

// 52.1 (fresh-frame first-paint freeze): a newly-activated frame's canvas
// surfaces are cold — the first paint's synchronous readback flushes them
// mid-stroke (the ~380ms rAF gaps on the fast-chained 2nd stroke). The
// user-validated recipe is "+key then wait ~1s"; this gate holds the pen that
// long (in idle) so the GPU settles before the first stroke, with a visible cue.
const FRESH_FRAME_WARM_MS = 1000;

/**
 * 49-04 (Task 2): merges the main-webview library (authoritative imageStore)
 * with the Studio realm's own imageStore. quick-260921-bjm: the AUTHORITY
 * statement changed — a picker import is now performed by the MAIN realm and
 * the main realm's library record is the persisted one (`buildMceProject` →
 * manifest `images`), so the child copy is a LAUNCH-SNAPSHOT FALLBACK only:
 * it holds whatever the last launch hydration pushed in, never a new import.
 * The merge stays for that stale copy's sake and dedupes by asset id — the
 * same file imported once is never duplicated.
 */
function mergeImageLibraries(main: readonly MceImageRef[], studio: readonly MceImageRef[]): MceImageRef[] {
  const byId = new Map<string, MceImageRef>();
  for (const image of [...main, ...studio]) byId.set(image.id, image);
  return [...byId.values()];
}

// 261019-mj2 cache-loss: aquarelle MODE.transparent is OPAQUE transmittance
// (white = no pigment). A sheet captured after the engine was cleared is a
// near-uniform white texture that still encodes to tens of KB, so byte length
// cannot distinguish paint from a blank sheet. Sample a downscaled copy and
// measure ink against the white point; painted sheets measured 4.6-11.3 on
// this scale, blank textured sheets 0.05-0.12. Anything below the floor is a
// blank capture — committing it would overwrite real pixels.
const AQUARELLE_MIN_CAPTURE_INK = 1;
function measureAquarelleCanvasInk(canvas: HTMLCanvasElement): number {
  try {
    const sample = document.createElement('canvas');
    sample.width = 48;
    sample.height = 48;
    const context = sample.getContext('2d', { willReadFrequently: true });
    if (!context) return Number.POSITIVE_INFINITY;
    context.drawImage(canvas, 0, 0, 48, 48);
    const data = context.getImageData(0, 0, 48, 48).data;
    let ink = 0;
    for (let index = 0; index < data.length; index += 4) {
      const luminance = 0.2126 * data[index]! + 0.7152 * data[index + 1]! + 0.0722 * data[index + 2]!;
      ink += Math.max(0, 248 - luminance);
    }
    return (ink / (255 * (data.length / 4))) * 1000;
  } catch {
    // Measurement must never block a legitimate capture.
    return Number.POSITIVE_INFINITY;
  }
}

export function PhysicsPaintStudio() {
  recordPhysicsPaintPerformanceCounter('render.studio');
  const profilePerformance = isPhysicsPaintProfilingEnabled();
  const recordEnginePerformance = (sample: PaintPerformanceSample) => {
    if (profilePerformance) recordPhysicsPaintPerformance(sample);
  };
  const [isPlaying, setIsPlaying] = useState(false);
  // 38.1-D-01/D-08: the playback per-tick surface is signal-backed — written
  // by onStart/onFrame per tick and read ONLY via .peek() (statusMessage) or
  // by the narrow sanctioned live surfaces (playback canvas image, nav-pill
  // current-frame indicator). Never .value-read in the Studio render body or
  // the view-model literal: that would re-subscribe the whole Studio per tick.
  const rotoPlaybackFrameIndex = useSignal(0);
  const rotoPlaybackFrameCount = useSignal(0);
  // 49-05 Task 2 (S4): the selected Background clip — a click on a Bg clip rail
  // routes here; the right-panel `Background Clip` section (49-06) consumes it.
  const selectedBackgroundClipId = useSignal<string | null>(null);
  // 49-06 (UAT round 7): the Replace-image target clip — set when the section's
  // Replace button opens the picker; the confirm path swaps that clip's source
  // instead of adding a new clip. Cleared on confirm/cancel.
  const backgroundReplaceTargetClipId = useSignal<string | null>(null);
  // 49-06 (UAT round 2): the placement-target frame — clicking an empty Bg row
  // cell selects it; the Import control then lands the new clip AT that frame
  // (import-at-playhead alone was undiscoverable — the frame click is the
  // placement gesture).
  const backgroundPlacementFrame = useSignal<number | null>(null);
  // 49-06 (UAT round 2): the right-panel tool tab. The Studio owns it so a Paint
  // track selection returns the panel to Track option and a Bg rail selection
  // opens the Background option tab (selection-driven, never stuck on the clip).
  const rightPanelToolTab = useSignal<'paint' | 'track' | 'background' | 'audio'>('paint');
  /* ---------------------------------------------------------------------------
   * 52.5-01b (D-02/D-03/D-05) + 261008-ig1 Task 2 + 261008-ryq: the Document
   * sound signals. They live HERE, ABOVE the keyboard hook — its state object
   * reads `selectedSoundId`, so a declaration further down would hit the TDZ on
   * first render. The controller (:usePhysicsPaintAudioController below) and
   * every handler stay where they are: only lazy arrows / event handlers reach
   * them, never the memo factory itself.
   * - `selectedSoundId` — the Studio-owned selection (D-01): handlers are the
   *   ONLY writers (band press, list-row click, dblclick, reveal, remove).
   * - `audioModalTarget` — clipId | '' | null: the modal's open target
   *   (261008-ryq: the clip LIST lives in the sidebar Audio tab — '' opens on
   *   the zero-clip empty state, a clipId opens the single-clip editor,
   *   null = closed (Escape/X clear it)).
   * - `audioImportMode` — the intent the last onImportRequest carried
   *   ('append' = fresh clip, 'replace' = selected clip's source).
   * - `revealRequest` — {frame, nonce} one-shot viewport positioning for a
   *   selected/revealed clip (the strip rides the qad math per nonce).
   * - `missingAudioSourcePaths` — 261009-ofk disk-based missing-file probe:
   *   the set of sourcePath values whose file does not resolve on disk.
   *   null = not probed yet and the probe reports "present" (no false-missing
   *   flash at boot); refreshed on mount and after every in-gallery import.
   * ------------------------------------------------------------------------- */
  const selectedSoundId = useSignal<string | null>(null);
  const audioModalTarget = useSignal<string | null>(null);
  const audioImportMode = useSignal<'append' | 'replace'>('append');
  const revealRequest = useSignal<{ frame: number; nonce: number } | null>(null);
  const missingAudioSourcePaths = useSignal<ReadonlySet<string> | null>(null);
  // UAT round 5: the gallery probe also carries the project directory, which
  // is the fallback root for the reopen peaks-ensure when no documentAudio
  // section is routed (see the effect below).
  const audioProjectDir = useSignal<string | null>(null);
  // 50-UAT (modal redesign): the floating Photo Reference dialog — a Studio-owned
  // signal so the strip camera icon opens it and the dialog self-closes. The
  // dialog stays open behind the full-area reference picker so an Import/
  // Replace confirm updates it in place.
  const referenceDialogOpen = useSignal(false);
  // 261022-o2a: the Tools Scripts actions (Load + Apply / Create Rail) open the
  // floating Script picker instead of acting on the sidebar selection. The
  // signal carries the intent so one dialog serves both actions; null = closed.
  const scriptPickerIntent = useSignal<'load-apply' | 'create-rail' | null>(null);
  const [launchContext, setLaunchContextState] = useState<PhysicPaintLaunchContext | null>(() => parsePhysicsPaintLaunchContext(window.location));
  const launchContextRef = useRef<PhysicPaintLaunchContext | null>(launchContext);
  launchContextRef.current = launchContext;
  // 47-01 UAT round 8: the strip data subscriptions below re-render the whole
  // Studio on every paint event; a trailing throttle collapses a stroke
  // burst into one flush so the chrome freezes while painting (the user's
  // start-paint stutter). 52.1: delay raised 150ms → 1000ms and the flush is
  // idle-gated — the strip only rebuilds after a real pause, so a paint cadence
  // with sub-second gaps never lands a rebuild between strokes. The canvas and
  // the push effect keep the RAW physicPaintVersion — only the strip chrome
  // reads the throttled revision.
  const throttledPaintRevision = useTrailingThrottledRevision(physicPaintVersion, 1000);
  // 52.1: key creation on a virgin frame bumps efxPaintVersion (structural)
  // mid-stroke — the raw subscription above rebuilt the 626-cell strip DURING
  // stroke 1 (measured 131ms) and flooded the shared GPU process right before
  // stroke 2 landed. The strip data memos read a throttled copy instead;
  // engine-facing effects (canvasMount/canvasStack/documentSync) keep the raw
  // signal. When idle (a +Key click), the flush below still lands in ~150ms.
  const throttledEfxRevision = useTrailingThrottledRevision(efxPaintVersion, 1000);
  // regression-refresh-multi-paint Layer 2: the completion reconcile paints at
  // the ACCEPTED document's CONTENT token (monotonic, content-derived) instead
  // of a content-agnostic session generation. The reconcile ceiling keeps the
  // engine's applied gate in the content-token space so a stale frame (older
  // content revision — e.g. the pixel-cache retry or the frame-editing effect
  // re-issuing a PARTIAL render) is dropped by the engine's preview-base seam.
  // Navigation still supersedes by clearing the base first, and the reconcile
  // itself always paints: max(acceptedToken, applied) is never below the applied
  // gate, and the accepted token is the newest content-derived token assigned.
  // 46-01: the ACTIVE track identity for a launch (the launch IS the document —
  // D-03 — so the carried activeTrackId is the identity authority). The
  // document field is typed optional for legacy parsing tolerance; at runtime
  // every v1.0 launch carries it, and the store rejects writes to unknown
  // tracks, so a missing document fails closed.
  const trackIdOfLaunch = (lc: PhysicPaintLaunchContext | null | undefined): string => lc?.document?.activeTrackId ?? '';
  // 47-01 (TML-03): the routing authority follows the DOCUMENT's current active
  // track — row click / addTrack / duplicateTrack switch it through
  // setActiveTrackId, and every mutation, lane read, and canvas token
  // re-resolves the live id. The launch snapshot is only the fallback for
  // legacy parsing tolerance.
  const studioActiveTrackId = (): string => {
    const lc = launchContextRef.current;
    if (!lc?.layerId) return '';
    return getEfxPaintDocument(lc.layerId)?.activeTrackId ?? trackIdOfLaunch(lc);
  };
  const rotoPreviewBaseContentToken = () => physicPaintStore.getContentToken(launchContextRef.current?.layerId ?? '', studioActiveTrackId());
  const selectedKeyId = useSignal<string | null>(getCarriedRotoPhysical(launchContext)?.selectedKeyId ?? null);
  // 47 close-out: a one-click cross-track selection is applied SYNCHRONOUSLY
  // in the click handler — the deferred seam effect ran after the paint, so
  // the first click's selection was never visible (the 2-click bug). This ref
  // is a "don't reseed" guard for the track-switch reset effect: the click
  // handler sets it, and the reset effect consumes it on the switch commit.
  const crossTrackSelectionPendingRef = useRef(false);
  const selectedLoopClipId = useSignal<string | null>(null);
  const selectedLoopClipIds = useSignal<readonly string[]>([]);
  // Session-local Key Rail selection: exact first-key plus ordered members,
  // never persisted and never sent across the bridge.
  const selectedRotoKeyRail = useSignal<RotoKeyRailSelection | null>(null);
  const loopSelectionAnchorId = useSignal<string | null>(null);
  const activeLinkedLoopClipId = useSignal<string | null>(null);
  // Session-local multi-selection (Pattern 5; D-02/D-05): keyId-only, never
  // persisted, never sent across the bridge — only selectedKeyId persists.
  const selectedKeyIds = useSignal<readonly string[]>([]);
  const selectionAnchorKeyId = useSignal<string | null>(null);
  const rotoSpacingSelection = useSignal<PhysicsPaintRotoSpacingSelection | null>(null);
  // Session-local multi-rail selection SET (Pattern 5; D-01/D-05): cross-type
  // identities only, never persisted, never sent across the bridge — null when
  // empty (an empty set is a valid no-rail-selection scope).
  const railSetSelection = useSignal<RailSetSelectionState | null>(null);
  const [soleOccurrenceDeleteTarget, setSoleOccurrenceDeleteTarget] = useState<SoleOccurrenceDeleteTarget | null>(null);
  const [soleOccurrenceDeleteError, setSoleOccurrenceDeleteError] = useState<string | null>(null);
  const soleOccurrenceDeleteCancelRef = useRef<HTMLButtonElement>(null);
  const soleOccurrenceDeleteDialogRef = useRef<HTMLDivElement>(null);
  const soleOccurrenceDeleteReturnFocusRef = useRef<HTMLElement | null>(null);
  const groupLifecycleDeleteExecuteRef = useRef<(target: GroupLifecycleDeleteTarget) => Promise<boolean>>(async () => false);
  const railSetDeleteExecuteRef = useRef<(target: Readonly<{
    operationKind: 'delete-rails';
    members: readonly RailSetDeleteMember[];
  }>) => Promise<boolean>>(async () => false);
  // 43.6-08 (quick 260820-bjw): rail-set Paste/Duplicate execute + session
  // rail-set clipboard slot. The execute ref mirrors railSetDeleteExecuteRef;
  // the clipboard read/write refs bridge the timeline-actions input ports to
  // the session slot (assigned after rotoKeyUtilities exists, since the
  // session lives there — same deferred-ref pattern as the execute refs).
  const railSetPasteExecuteRef = useRef<(input: Readonly<{
    operationKind: 'paste';
    placementMode: RotoRailSetCopyPlacementMode;
    destinationAppFrame?: number;
    payload: RotoRailSetCopyPayload;
  }>) => Promise<boolean>>(async () => false);
  const railSetClipboardReadRef = useRef<() => RotoRailSetCopyPayload | null>(() => null);
  const railSetClipboardWriteRef = useRef<(payload: RotoRailSetCopyPayload | null) => void>(() => {});
  const initialCarried = launchContext ? getCarriedRotoPhysical(launchContext) : null;
  // debug studio-reopen-empty-boot: the launch SEED is tolerant — a record whose
  // bytes could not be materialized at the launch door (reported loudly there)
  // boots as missing content instead of bricking the Studio. The publish path
  // keeps the strict projection.
  const latestRotoFramesRef = useRef<PhysicPaintRotoCacheFrame[]>(initialCarried ? recordsAsRuntimeFramesToleratingReferences(initialCarried) : []);
  // 47 close-out UAT round 9: which track latestRotoFramesRef currently holds.
  const latestRotoFramesTrackRef = useRef<string>(trackIdOfLaunch(launchContext));
  // studio-realm-divergence (nature: contract): which structural revision
  // latestRotoFramesRef currently holds. A move/cut/paste changes a track's
  // frames WITHOUT changing the active track, so a track-switch-only reseed
  // left the OLD frames in the ref — and those painted as green cells next to
  // the just-landed keys ("phantom keys from the dragged rail").
  const latestRotoFramesRevisionRef = useRef<number>(-1);
  const setLaunchContext = useCallback((update: PhysicPaintLaunchContext | null | ((current: PhysicPaintLaunchContext | null) => PhysicPaintLaunchContext | null)) => {
    setLaunchContextState((current) => {
      const next = typeof update === 'function' ? update(current) : update;
      launchContextRef.current = next;
      if (next?.operationId !== current?.operationId || next?.layerId !== current?.layerId) {
        const carried = next ? getCarriedRotoPhysical(next) : null;
        // debug studio-reopen-empty-boot: THE production throw site — this
        // updater runs synchronously inside the setter, so a strict assertion
        // here aborted the whole launch replacement handoff and froze the
        // Studio at its pre-launch shell. Tolerant seed: skip, never brick.
        latestRotoFramesRef.current = carried ? recordsAsRuntimeFramesToleratingReferences(carried) : [];
        selectedKeyId.value = carried?.selectedKeyId ?? null;
        // Launch replacement resets the multi-selection exactly like the
        // single selection (Pattern 5): a replaced launch never inherits a
        // stale set or anchor.
        selectedKeyIds.value = selectedKeyId.value === null ? [] : [selectedKeyId.value];
        selectionAnchorKeyId.value = selectedKeyId.value;
        rotoSpacingSelection.value = null;
        railSetSelection.value = null;
        // 43.6-06 (D-14): a replaced launch starts solo disarmed — the
        // session-only arm never survives a launch replacement.
        disarmSolo();
        // 43.6 D-06: a replaced launch prunes the session-only snapshot
        // side-channel alongside the set itself (T-43.6-03).
        clearRailSetSnapshots();
        selectedLoopClipId.value = null;
        selectedLoopClipIds.value = [];
        selectedRotoKeyRail.value = null;
        loopSelectionAnchorId.value = null;
        activeLinkedLoopClipId.value = null;
      } else if (next && next.startFrame !== current?.startFrame) {
        // 48-06 (R-2click): reseed against the LIVE document's active track —
        // the launch snapshot's activeTrackId still points at the track that
        // was active at the last launch replacement, so after a track switch
        // the rAF startFrame propagation looked up the key on the WRONG track,
        // found nothing, and cleared the synchronous click selection (the
        // first click selected, the reseed cleared, only the second click on
        // the same frame survived — startFrame unchanged, no reseed branch).
        const liveTrackId = getEfxPaintDocument(next.layerId)?.activeTrackId ?? trackIdOfLaunch(next);
        // studio-realm-divergence probe: startFrame landed (propagation made
        // it through) — record where the document cursor stood BEFORE this
        // reseed closes the gap.
        selectedKeyId.value = physicPaintStore.getRotoRealKeyRecordByAppFrame(next.layerId, liveTrackId, next.startFrame)?.keyId ?? null;
        physicPaintStore.setRotoPhysicalSelection(next.layerId, liveTrackId, selectedKeyId.value, next.startFrame);
        const spacingSelection = rotoSpacingSelection.peek();
        selectedKeyIds.value = spacingSelection?.selectedSourceKeyIds
          ?? (selectedKeyId.value === null ? [] : [selectedKeyId.value]);
        selectionAnchorKeyId.value = spacingSelection
          ? spacingSelection.sourceKeyIds[spacingSelection.anchorSourceIndex] ?? null
          : selectedKeyId.value;
      }
      return next;
    });
  }, []);
  // 38.1 D-04/D-05: one rAF UI flush scheduler and one navigation generation
  // counter per Studio instance (never module scope — two Studio windows must
  // not share navigation generations). The scheduler caps startFrame-driven
  // Studio renders at one per animation frame with latest-state-at-fire-time;
  // the generation counter skips canvas paints superseded by a newer
  // navigation while a never-superseded (discrete-click) generation always
  // paints. The mount-scoped cleanup revokes any pending rAF so an unmounted
  // Studio never flushes (external-sync disposal, not an effect chain).
  const rotoUiFlushScheduler = useMemo(() => createRotoUiFlushScheduler(), []);
  const rotoNavigationGeneration = useMemo(() => createRotoNavigationGeneration(), []);
  useEffect(() => () => { rotoUiFlushScheduler.dispose(); }, [rotoUiFlushScheduler]);
  // 38-11: per-Studio identity memos backing the memo-wrapped tool rail and
  // right panel (never module scope — two Studio windows must not share
  // caches). A startFrame-only Studio render feeds Object.is-identical deps,
  // resolve returns the cached props object, and preact/compat memo's default
  // shallow compare skips the subtree. Deps enumerate exactly the values each
  // build references — never the Studio's frame cursor.
  const layoutPropsMemo = useRef(createIdentityMemo()).current;
  const topBarPropsMemo = useRef(createIdentityMemo()).current;
  const toolRailPropsMemo = useRef(createIdentityMemo()).current;
  const rightPanelPropsMemo = useRef(createIdentityMemo()).current;
  const playScriptDialogPropsMemo = useRef(createIdentityMemo()).current;
  const referenceDialogPropsMemo = useRef(createIdentityMemo()).current;
  // 261022-o2a: the picker bundle memo sits beside the reference dialog memo —
  // the dialog re-resolves only when its visibility/intent changes.
  const scriptPickerDialogPropsMemo = useRef(createIdentityMemo()).current;
  const canvasStackPropsMemo = useRef(createIdentityMemo()).current;
  const canvasMountPropsMemo = useRef(createIdentityMemo()).current;
  const scheduleRotoStartFramePropagation = useCallback((frame: number) => {
    rotoUiFlushScheduler.schedule(() => {
      const propagationStartedAtMs = performance.now();
      setLaunchContext((current) => current ? { ...current, startFrame: frame } : current);
      requestAnimationFrame(() => {
        recordPhysicsPaintPerformance({ stage: 'studio.startFramePropagation', category: 'async-elapsed', durationMs: performance.now() - propagationStartedAtMs, timestamp: performance.now(), sourceFrame: frame });
      });
    });
  }, [rotoUiFlushScheduler, setLaunchContext]);
  const handleRequestSoleOccurrenceDeleteWarning = useCallback((target: SoleOccurrenceDeleteTarget) => {
    soleOccurrenceDeleteReturnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setSoleOccurrenceDeleteError(null);
    setSoleOccurrenceDeleteTarget(target);
    queueMicrotask(() => { soleOccurrenceDeleteCancelRef.current?.focus(); });
  }, []);
  const closeSoleOccurrenceDeleteDialog = useCallback(() => {
    setSoleOccurrenceDeleteError(null);
    setSoleOccurrenceDeleteTarget(null);
    queueMicrotask(() => {
      soleOccurrenceDeleteReturnFocusRef.current?.focus();
      soleOccurrenceDeleteReturnFocusRef.current = null;
    });
  }, []);
  const handleSoleOccurrenceDeleteDialogKeyDown = useCallback((event: KeyboardEvent) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSoleOccurrenceDeleteDialog();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusables = Array.from(
      soleOccurrenceDeleteDialogRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [],
    );
    if (focusables.length === 0) return;
    const currentIndex = focusables.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex = event.shiftKey
      ? (currentIndex <= 0 ? focusables.length - 1 : currentIndex - 1)
      : (currentIndex >= focusables.length - 1 ? 0 : currentIndex + 1);
    event.preventDefault();
    focusables[nextIndex]?.focus();
  }, [closeSoleOccurrenceDeleteDialog]);
  const handleConfirmSoleOccurrenceDelete = useCallback(async () => {
    if (soleOccurrenceDeleteTarget === null) return;
    setSoleOccurrenceDeleteError(null);
    const accepted = await groupLifecycleDeleteExecuteRef.current(soleOccurrenceDeleteTarget);
    if (!accepted) {
      setSoleOccurrenceDeleteError('Delete rejected because the Rail changed. Review the current frame and try again.');
      return;
    }
    closeSoleOccurrenceDeleteDialog();
  }, [closeSoleOccurrenceDeleteDialog, soleOccurrenceDeleteTarget]);
  const bridgeMode = usePhysicsPaintBridgeMode();
  const bridgeModeRef = useRef(bridgeMode);
  bridgeModeRef.current = bridgeMode;
  // studio-realm-divergence (nature: contract): declared here (not with the
  // other document-sync state further down) so the coordinator's bridge ports
  // can flush the pending sync before every physical-edit send.
  const flushDocumentSyncRef = useRef<() => Promise<void>>(async () => {});
  // 41-04 (D-05): the audio ownership guard sends its claim/release events
  // through the dual-transport sender with the live bridge mode. The guard
  // module is transport-agnostic (session state only); this effect is the
  // single wiring point, cleaned up on Studio unmount.
  useEffect(() => {
    efxPaintAudioOwnership.configure({
      claimSender: (claim) => {
        void sendPhysicPaintAudioOwnership(claim, bridgeModeRef.current).catch((error) => {
          console.warn('[PhysicsPaintStudio] audio ownership event failed', error);
        });
      },
    });
    return () => efxPaintAudioOwnership.configure({ claimSender: null });
  }, []);
  // 41-04 (D-14): the Audio Preview toggle intent flips the session signal;
  // the immediate mid-playback effect (stop/resume at the live cursor) routes
  // through the monitor funnel inside setAudioPreviewEnabled.
  const handleAudioPreviewToggle = useCallback(() => {
    setAudioPreviewEnabled(!audioPreviewEnabled.peek());
  }, []);
  // Physical selection state (D-01/D-10): selectedKeyId is the stable real-key
  // identity, rotoKeyRecords and rotoInterpolationState are derived from the
  // store's validated physical records and canonical interpolation state.
  // 47-01 (TML-03): the active-track reads resolve the LIVE document id and
  // subscribe to efxPaintVersion too — setActiveTrackId bumps only the
  // document clock, so a row click / add / duplicate must re-resolve these
  // residuals against the newly active track ("the Studio re-reads on
  // efxPaintVersion").
  //
  // studio-realm-divergence (nature: contract): the live active-track id is a
  // memo key, not just a body read. multiTrackRowBundle subscribes to the RAW
  // efxPaintVersion, so setActiveTrackId re-renders the Studio and swaps the
  // rich lane onto the new row immediately — but these memos were keyed only
  // on the THROTTLED revisions (1s quiet + 300ms retries). The lane therefore
  // painted the PREVIOUS track's keys at the NEW row for 1-2s: the phantom-key
  // window after a track switch, and the "source keys duplicated onto the
  // destination" look after a cross-track drag (the destination row updates
  // instantly through its own track revision while the lane kept the source's
  // records). Content churn stays throttled; only an identity change — which
  // is rare and already re-rendered the component — recomputes these.
  //
  // studio-realm-divergence (nature: contract): `rotoPhysicalRevision` is the
  // STRUCTURAL clock — it bumps on record/loop/break replacement (move, cut,
  // paste, +Key) and NOT on per-stroke frame writes. Keying these memos on it
  // makes a structural edit repaint the lane immediately instead of sitting in
  // the 1s stroke-throttle window, where a completed move still drew the old
  // keys ("phantom keys") and the just-landed copy read as a duplicate.
  const activeTrackIdForReads = studioActiveTrackId();
  const rotoKeyRecords = useMemo(() => launchContext ? physicPaintStore.getRotoRealKeyRecords(launchContext.layerId, activeTrackIdForReads) : [], [launchContext?.layerId, activeTrackIdForReads, rotoPhysicalRevision.value, throttledPaintRevision.value, throttledEfxRevision.value]);
  const rotoIncomingInterpolationBreakKeyIds = useMemo(
    () => launchContext ? physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(launchContext.layerId, activeTrackIdForReads) : [],
    [launchContext?.layerId, activeTrackIdForReads, rotoPhysicalRevision.value, throttledPaintRevision.value, throttledEfxRevision.value],
  );
  const rotoInterpolationState = useMemo(() => launchContext ? physicPaintStore.getRotoPhysicalInterpolationState(launchContext.layerId, activeTrackIdForReads) : PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED, [launchContext?.layerId, activeTrackIdForReads, rotoPhysicalRevision.value, throttledPaintRevision.value, throttledEfxRevision.value]);
  const rotoLoopClips = useMemo(() => launchContext ? physicPaintStore.getRotoPhysicalLoopClips(launchContext.layerId, activeTrackIdForReads) : PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY, [launchContext?.layerId, activeTrackIdForReads, rotoPhysicalRevision.value, throttledPaintRevision.value, throttledEfxRevision.value]);
  const keyRailGroupOwnedKeyIds = useMemo(() => {
    const owned = new Set<string>();
    for (const clip of rotoLoopClips) {
      clip.sourceKeyIds.forEach((keyId) => owned.add(keyId));
      (clip.frameOverrides ?? []).forEach((override) => owned.add(override.keyId));
    }
    return owned;
  }, [rotoLoopClips]);
  const keyRailSegments = useMemo(() => deriveKeyRailSegments({
    orderedRealKeys: [...rotoKeyRecords].sort((left, right) => (
      left.appFrame - right.appFrame || left.keyId.localeCompare(right.keyId)
    )),
    incomingInterpolationBreakKeyIds: new Set(rotoIncomingInterpolationBreakKeyIds),
    groupOwnedKeyIds: keyRailGroupOwnedKeyIds,
  }), [keyRailGroupOwnedKeyIds, rotoIncomingInterpolationBreakKeyIds, rotoKeyRecords]);
  const effectiveSelectedRotoKeyRail = reconcileRotoKeyRailSelection(
    selectedRotoKeyRail.value,
    keyRailSegments,
  );
  if (selectedRotoKeyRail.peek() !== null
    && (effectiveSelectedRotoKeyRail === null || selectedKeyId.value !== null || selectedKeyIds.value.length > 0)) {
    selectedRotoKeyRail.value = null;
  }
  const orderedRotoLoopClipIds = useMemo(() => [...rotoLoopClips]
    .sort((left, right) => left.placementStart - right.placementStart || left.loopId.localeCompare(right.loopId))
    .map((loopClip) => loopClip.loopId), [rotoLoopClips]);
  const effectiveRotoLoopClipSelection = reconcilePhysicsPaintRotoLoopClipSelection(
    selectedLoopClipIds.value.length > 0 && loopSelectionAnchorId.value !== null && selectedLoopClipId.value !== null
      ? {
        selectedLoopClipIds: selectedLoopClipIds.value,
        anchorLoopClipId: loopSelectionAnchorId.value,
        primaryLoopClipId: selectedLoopClipId.value,
      }
      : null,
    orderedRotoLoopClipIds,
  );
  const effectiveSelectedLoopClipIds = effectiveRotoLoopClipSelection?.selectedLoopClipIds ?? [];
  const effectiveRotoSpacingSelection = reconcilePhysicsPaintRotoSpacingSelection(
    rotoSpacingSelection.value,
    rotoLoopClips
      .filter((loopClip) => loopClip.sourceKeyIds.every((keyId) => rotoKeyRecords.some((record) => record.keyId === keyId)))
      .map((loopClip) => ({ sourceKeyIds: loopClip.sourceKeyIds })),
  );
  // 38.1 D-07: the legacy interpolation settings read MUST be memoized on the
  // same structural inputs (physicPaintVersion + layerId) as the records
  // above — the store getter returns a fresh clone per call, and an unstable
  // identity here defeats the useRotoTimelineModel structural memo, forcing a
  // full signal-graph rebuild on every Studio render.
  const rotoLegacyInterpolationSettings = useMemo(() => launchContext ? physicPaintStore.getRotoInterpolationSettings(launchContext.layerId, activeTrackIdForReads) : undefined, [launchContext?.layerId, activeTrackIdForReads, rotoPhysicalRevision.value, throttledPaintRevision.value, throttledEfxRevision.value]);
  const currentFrame = launchContext?.startFrame ?? 0;
  // UAT-3: persisted operation-result capsule line. An operation publishes its
  // outcome here (survives the operation's own selection aftermath); only a NEW
  // explicit user navigation/selection gesture or the next operation clears it.
  const operationResult = useSignal<string | null>(null);
  const publishOperationResult = useCallback((message: string | null) => {
    operationResult.value = message;
  }, [operationResult]);
  // Single Select All entry point (D-03): shared by the Cmd/Ctrl+A dispatcher
  // branch and the future strip icon (plan 37-04). Store-ordered real-key
  // identities guarantee physical-frame order and real-key-only membership.
  const selectAllRotoKeys = useCallback(() => {
    publishOperationResult(null);
    const orderedRealKeyIds = rotoKeyRecords.map((record) => record.keyId);
    if (orderedRealKeyIds.length === 0) return;
    selectedKeyId.value = null;
    if (launchContext) {
      physicPaintStore.setRotoPhysicalSelection(
        launchContext.layerId,
        studioActiveTrackId(),
        null,
        currentFrame,
      );
    }
    const next = selectAllRotoKeyIds(
      orderedRealKeyIds,
      null,
    );
    rotoSpacingSelection.value = null;
    // 43.6 D-04: Select All is a key selection — it clears the rail set.
    railSetSelection.value = null;
    selectedLoopClipIds.value = [];
    loopSelectionAnchorId.value = null;
    selectedLoopClipId.value = null;
    selectedRotoKeyRail.value = null;
    selectedKeyIds.value = next.selectedKeyIds;
    selectionAnchorKeyId.value = next.anchorKeyId;
    // UI-SPEC status contract: one feedback line per successful invocation,
    // shared by the Cmd/Ctrl+A route and the 37-04 icon route through the
    // same setApplyMessage publisher the bundle's publishStatus uses (36.15
    // D-15 single-owner capsule arbitration). Selection-only gestures
    // (toggle/range/collapse) publish nothing.
    setApplyMessage('All keys selected');
  }, [currentFrame, launchContext, rotoKeyRecords, publishOperationResult]);
  const [, setLastError] = useState<string | null>(null);
  const [applyStatus, setApplyStatus] = useState<ApplyStatus>('idle');
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  // quick-261023-l35/o3n: the Studio script snapshot lives INSIDE the .mce
  // package when the project is saved (app cache only as the unsaved-project /
  // missing-package fallback). The controller is a plain object in a
  // render-body ref: Preact state setters are identity-stable, and every other
  // port reads through refs, so it is created once (identity-stable deps — no
  // new closure per render, no render-body signal read).
  const studioScriptSnapshotIdentityRef = useRef<StudioScriptSnapshotIdentity | null>(null);
  // quick-261023-o3n: the OPAQUE package capability (`scriptLibraryAuthority`).
  // A plain ref — no signal, no state, no render-body write. It is set from the
  // INCOMING settled launch context before the restore (the launchContextRef
  // still holds the PREVIOUS context at that moment) and refreshed by every
  // project-context republish, so a save-as rebind is followed live.
  const studioScriptSnapshotAuthorityRef = useRef<string | null>(null);
  const studioScriptSnapshotControllerRef = useRef<StudioScriptSnapshotController | null>(null);
  if (studioScriptSnapshotControllerRef.current === null) {
    studioScriptSnapshotControllerRef.current = createStudioScriptSnapshotController({
      getIdentity: () => studioScriptSnapshotIdentityRef.current,
      getWatercolorEvents: () => getRecordedAquarellePayloadTimeline(),
      getBrushFrames: () => getBrushScriptFrameEntries(),
      // Both store revisions form the content fingerprint: each bumps on every
      // record/capture/restore/delete, so a save can never miss a mutation —
      // and a stroke that completes without a bump is the one silent-loss case
      // this signature is chosen to rule out (recordAquarelleStroke and the
      // brush capture path both bump).
      getContentSignature: () =>
        `${aquarelleStrokesRevision.peek()}:${brushScriptRevision.peek()}`,
      // Live real-key app frames for the bound track. An empty set disables
      // pruning in the controller (unknown ≠ empty), so a launch whose key
      // records are not loaded yet can never wipe the restored script.
      getLiveFrames: () => {
        const identity = studioScriptSnapshotIdentityRef.current;
        if (!identity) return null;
        const records = physicPaintStore.getRotoRealKeyRecords(identity.layerId, identity.trackId);
        return new Set(records.map((record) => record.appFrame));
      },
      // Read LIVE (never frozen at launch): the controller asks at prepare and
      // restore time, so a save-as rebind retargets the next package write.
      getAuthority: () => studioScriptSnapshotAuthorityRef.current,
      // Status channel: the EXISTING capsule trio — a status without a moving
      // applyStatus is filtered out by the capsule's success arbitration.
      report: (message) => {
        setApplyStatus('error');
        setApplyMessage(message);
        setLastError(message);
      },
      write: (identity, bytes, authority) => ipcStudioScriptSnapshotWrite(
        identity.projectId,
        identity.layerId,
        identity.trackId,
        bytes,
        authority,
      ),
      read: (identity, authority) => ipcStudioScriptSnapshotRead(
        identity.projectId,
        identity.layerId,
        identity.trackId,
        authority,
      ),
      // quick-261023-ors: the delete leg. `cache` is the purge's post-rewrite
      // cleanup; `both` is the rail-deletion cascade. An absent authority
      // deletes the cache only (unsaved project); Rust refuses a stale one.
      remove: (identity, authority, scope) => ipcStudioScriptSnapshotDelete(
        identity.projectId,
        identity.layerId,
        identity.trackId,
        authority,
        scope,
      ),
    });
  }
  const studioScriptSnapshot = studioScriptSnapshotControllerRef.current;
  // Highest restored watercolor mutationId + 1. Re-applied at the engine-ready
  // seam so a recreated engine (crash-recovery reload) cannot reuse a restored
  // id and silently overwrite the restored registry entry.
  const studioScriptSnapshotReservedNextMutationIdRef = useRef(0);
  // quick-261023-l35 Task 3: ONE coalescing subscription lives HERE, never in
  // the controller module. `aquarelleStrokesRevision` and `brushScriptRevision`
  // are the only inputs — recordAquarelleStroke and every brush
  // capture/clear/prune bump them, so a completed stroke can never be lost
  // silently. The first run is the seed read at mount (no mutation yet). The
  // effect body writes no signal; the controller instance comes from a
  // render-body ref, so the deps are identity-stable.
  useEffect(() => {
    let seedRun = true;
    const disposeSubscription = effect(() => {
      aquarelleStrokesRevision.value;
      brushScriptRevision.value;
      if (seedRun) {
        seedRun = false;
        return;
      }
      studioScriptSnapshot.markDirty();
    });
    return () => {
      disposeSubscription();
      // Teardown clears the pending debounce timer; no later write occurs.
      studioScriptSnapshot.dispose();
    };
  }, [studioScriptSnapshot]);
  // quick-261023-ors Task 3: a committed `commitDeleteTrack` must also delete
  // that rail's persisted snapshot. The store calls this ONE registered hook
  // with the committed (layerId, trackId); the factory owns the fail-closed
  // key law and runs `clearBinding` BEFORE dispatching the delete, so no
  // pending debounce / in-flight restore / prepared save can rewrite the key
  // the cascade is about to remove. Registration is identity-stable (the
  // controller instance lives in a ref); teardown unregisters.
  useEffect(() => {
    const cascade = createStudioScriptSnapshotTrackDelete({
      getIdentity: () => studioScriptSnapshotIdentityRef.current,
      getAuthority: () => studioScriptSnapshotAuthorityRef.current,
      clearBinding: () => {
        studioScriptSnapshotIdentityRef.current = null;
        studioScriptSnapshot.bind(null);
      },
      remove: (identity, authority, scope) => ipcStudioScriptSnapshotDelete(
        identity.projectId,
        identity.layerId,
        identity.trackId,
        authority,
        scope,
      ),
      // The EXISTING capsule trio, exactly as the controller's own report.
      report: (message) => {
        setApplyStatus('error');
        setApplyMessage(message);
        setLastError(message);
      },
    });
    _setEfxPaintTrackScriptDeleteCallback(cascade);
    return () => _setEfxPaintTrackScriptDeleteCallback(null);
  }, [studioScriptSnapshot]);
  // 52.1 (warm progress): 0..100 while a blank key's settle gate holds the pen
  // (FRESH_FRAME_WARM_MS); the capsule renders a thin bar so the artist knows
  // when the canvas is released. 0 = idle, 100 = released.
  const warmProgress = useSignal(0);
  // 49-04 (UAT fix): the document fallback is the single authority on open —
  // hydrate the selector mode (and the paper arm's grain controls) from it so
  // the selector, engine, and monitor fond agree before the first click. The
  // launch context carries the document (D-03), so the fallback is available at
  // init time.
  const [settings, setSettings] = useState<PhysicsPaintStudioSettings>(() => {
    const fallback = launchContext?.document?.background?.fallback;
    return fallback ? applyBackgroundFallbackToSettings(fallback) : makeInitialPhysicsPaintStudioSettings();
  });
  const workflowMode = 'roto' as const;
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const handleSetRightPanelCollapsed = useCallback((collapsed: boolean) => {
    setRightPanelCollapsed(collapsed);
  }, []);
  const playButtonRef = useRef<HTMLButtonElement>(null);
  const historyAvailability = useSignal<PaintHistoryAvailability>({ undo: 0, redo: 0 });
  // quick 261004-dn5: the Move rail icon is enabled only while a stroke script
  // is in memory (the engine has at least one recorded entry to translate).
  // Written from the EXISTING history-availability listener below — that one
  // fires on attach and on every allActions change (load/accept/undo/redo/
  // clear/erase), so it needs no second listener. Signal, never useState.
  const strokeScriptInMemory = useSignal(false);
  const [onion, setOnionState] = useState<PhysicsPaintOnionState>(() => ({
    ...DEFAULT_ONION_STATE,
    opacity: Math.round(paintStore.onionSkinOpacity.value * 100),
  }));
  const setOnion = useCallback((next: PhysicsPaintOnionState | ((current: PhysicsPaintOnionState) => PhysicsPaintOnionState)) => {
    setOnionState((current) => {
      const resolved = typeof next === 'function' ? next(current) : next;
      paintStore.onionSkinOpacity.value = resolved.opacity / 100;
      return resolved;
    });
  }, []);
  const resetRotoKeySessionRef = useRef<(options?: { clearClipboard?: boolean }) => void>(() => {});
  const groupFramePaintExecuteRef = useRef<(input: RotoGroupFramePaintExecuteInput) => Promise<boolean>>(async () => false);
  const rotoPersistence = useRotoFramePersistenceCoordinator({
    workflowMode,
    backgroundMode: settings.background,
    launchContext,
    latestFramesRef: latestRotoFramesRef,
    setLaunchContext,
    // 47-01: the coordinator resolves the DOCUMENT's live active track — the
    // launch snapshot is stale after an in-place track switch (row click /
    // add / duplicate), and every paint capture/identity check must target the
    // track the user is actually editing.
    getActiveTrackId: (layerId) => getEfxPaintDocument(layerId)?.activeTrackId ?? '',
    store: {
      // 46-01: the persistence port is track-scoped; the coordinator resolves
      // the launch's ACTIVE track itself, so the port passes it straight through.
      getRotoPhysicalDocument: (layerId, trackId) => physicPaintStore.getRotoPhysicalDocument(layerId, trackId),
      getRotoPhysicalContentRevision: (layerId, trackId) => physicPaintStore.getRotoPhysicalContentRevision(layerId, trackId),
      resolveContentToken: (contentRevision) => resolveContentToken(contentRevision),
      getRotoRealKeyRecord: (layerId, trackId, keyId) => physicPaintStore.getRotoRealKeyRecord(layerId, trackId, keyId),
      getRotoRealKeyRecordByAppFrame: (layerId, trackId, appFrame) => physicPaintStore.getRotoRealKeyRecordByAppFrame(layerId, trackId, appFrame),
      getRotoPhysicalRenderSource: (layerId, trackId, appFrame) => physicPaintStore.getRotoPhysicalRenderSource(layerId, trackId, appFrame),
      updateRotoPhysicalRealKeyPayload: (layerId, trackId, keyId, revision, payload, diagnostics) => physicPaintStore.updateRotoPhysicalRealKeyPayload(layerId, trackId, keyId, revision, payload, diagnostics),
    },
    syncPending: () => resetRotoKeySessionRef.current(),
    getBackgroundMetadata: () => buildRotoBackgroundMetadata(settings),
    sendCachePayload: async (payload) => sendPhysicPaintApplyPayload(
      payload,
      bridgeMode === 'Unavailable' ? await detectPhysicsPaintBridgeMode() : bridgeMode,
    ),
    executePhysicalEdit: (executeInput) => groupFramePaintExecuteRef.current(executeInput),
    setApplyMessage,
  });
  const rotoEditBuffer = rotoPersistence.editBuffer;
  const rotoEditableFramesRef = useRef<number[]>(rotoEditBuffer.editableFrames);
  rotoEditableFramesRef.current = rotoEditBuffer.editableFrames;
  const rotoPreviewFramesRef = { get current() { return rotoEditBuffer.bufferRef.current.previewFrames; }, set current(frames) { rotoEditBuffer.replacePreviewFrames(frames); } };
  const dirtyRotoFramesRef = { get current() { return rotoEditBuffer.bufferRef.current.dirtyFrames; }, set current(frames) { rotoEditBuffer.replaceDirtyFrames(frames); } };
  const [shortcutsVisible, setShortcutsVisible] = useState(false);
  const pendingRotoKeyActionMessageRef = useRef<string | null>(null);
  const pendingFrameSyncRef = useRef<number | null>(null);
  // D-02 amendment (audible scrub): true while the ruler scrub gesture is armed
  // (past the 4px threshold). navigateToSyncedPhysicalFrame routes the audio
  // funnel to scrub (audible snippet) vs seek (silent re-anchor) by this flag.
  const scrubActiveRef = useRef(false);
  // I-09 belt: a scrub that never fired onScrubEnd (pointer capture lost,
  // a throw in the release seek) used to leave scrubActiveRef armed forever —
  // every later frame click was swallowed into scrub-only mode. A window-level
  // pointerup/pointercancel always disarms the flag; onScrubEnd remains the
  // braces that fires the release-settle navigation.
  useEffect(() => {
    const disarm = () => { scrubActiveRef.current = false; };
    window.addEventListener('pointerup', disarm);
    window.addEventListener('pointercancel', disarm);
    return () => {
      window.removeEventListener('pointerup', disarm);
      window.removeEventListener('pointercancel', disarm);
    };
  }, []);
  // G-52-9 drag-gate: non-null ONLY while the ruler scrub gesture is armed.
  // The strip's playhead bar subscribes to this feed as a narrow leaf — during
  // a drag it is the ONLY UI that moves. No startFrame propagation, no flush,
  // no canvas repaint, no selection reseed, and no main-window frame sync run
  // mid-drag; the full settle navigation fires once on release (onScrubEnd).
  const rotoScrubFrameSignal = useSignal<number | null>(null);
  // Release settle catch-up: the scrub feed stays sticky at the final dragged
  // frame so the playhead never jumps back to the drag origin while the
  // release navigation's startFrame propagation is in flight. Once the
  // propagated startFrame matches the feed they render identically, and the
  // feed clears here with zero visual change.
  useEffect(() => {
    const scrubFrame = rotoScrubFrameSignal.peek();
    if (scrubFrame !== null && launchContext?.startFrame === scrubFrame) {
      rotoScrubFrameSignal.value = null;
    }
  }, [launchContext?.startFrame, rotoScrubFrameSignal]);
  const resetRotoNavigationForLaunchRef = useRef<(settings: PhysicPaintRotoPlaybackSettings) => void>(() => {});
  const acceptRotoScriptBrushRef = useRef<() => void>(() => {});
  const prepareRotoScriptTargetRef = useRef<(source: RotoScriptSourceSnapshot) => Promise<RotoScriptPhysicalTarget | null>>(async () => null);
  // Quick 261023-cxc: Duplicate's script path navigates through the SAME
  // coordinator every other navigation uses. The keyUtilities literal is an
  // ARGUMENT to that coordinator call, so it cannot reference the returned
  // requestNavigation — the port is late-bound here right after the call.
  const requestDuplicateNavigationRef = useRef<(frame: number) => Promise<boolean>>(async () => false);
  const promoteRotoPaintTargetRef = useRef<(source: {
    appFrame: number;
    selectionKind: 'real-key' | 'generated-interpolation' | 'empty';
    source: RotoPaintPromotionSource;
  }) => Promise<RotoPaintPromotionResult>>(async () => ({ ok: false, error: ROTO_AUTO_KEY_PROMOTION_ERROR }));
  const pendingFirstPaintTargetRef = useRef<PendingRotoFirstPaintTarget | null>(null);
  // Quick 261019-mj2 Task 3: TRUE while a pointer/button self-promotion owns the
  // canvas warm-up. It exempts ONLY `rotoInputDisabled` from `mutationLocked`
  // so the fast second stroke keeps flowing while the physical edit settles.
  const autoKeyPromotionPaintExempt = useSignal(false);
  // Quick 261019-mj2 UAT: the promotion's generic failure copy hid WHY the key
  // could not be created. Record the last status message published by the
  // timeline/coordinator seam and surface it as the LOG diagnostic.
  const lastRotoStatusMessageRef = useRef<string | null>(null);
  const aquarelleResetSheetRef = useRef<(() => void) | null>(null);
  const aquarelleMergeBaseRef = useRef<{ appFrame: number; base: RenderedFramePayload | null } | null>(null);
  // 261019-mj2 cache-loss: the aquarelle sheet lives outside the engine-1
  // stroke/capture queues, so the close/save flush gate cannot see its paint.
  // The sheet records its own dirty state; the close gate must consult it or a
  // wet sheet closes without ever being captured (blank key persisted).
  const aquarelleSheetHasPaintRef = useRef(false);
  // Captures can suspend on the auto-key promotion before they enqueue. The
  // save/close flush must wait for those enqueues, otherwise it drains an empty
  // queue and the sheet's pixels are serialized as the blank key payload.
  const aquarelleCapturesInFlightRef = useRef<Set<Promise<void>>>(new Set());
  const syncPendingRotoFrames = useCallback(() => {
    resetRotoKeySessionRef.current({ clearClipboard: false });
  }, []);
  const physicalEditCoordinatorRouteRef = useRef<{ consumeBridgeApplyResult: (detail: PhysicPaintApplyResult | null | undefined) => 'ignore' | 'mismatch' | 'accepted' } | null>(null);
  const playbackSettingsRouteRef = useRef<{ consumeBridgeApplyResult: (detail: PhysicPaintApplyResult | null | undefined) => boolean } | null>(null);
  const applyResultController = usePhysicsPaintApplyResultController({
    bridgeMode,
    general: { pendingKeyActionMessageRef: pendingRotoKeyActionMessageRef, setApplyStatus, setApplyMessage, setLastError },
    physicalEditCoordinator: { consumeBridgeApplyResult: (detail) => physicalEditCoordinatorRouteRef.current?.consumeBridgeApplyResult(detail) ?? 'ignore' },
    playbackSettings: { consumeBridgeApplyResult: (detail) => playbackSettingsRouteRef.current?.consumeBridgeApplyResult(detail) ?? false },
    timeout: {
      onTimeout: (message) => {
        setApplyStatus('error');
        setApplyMessage(message);
        setLastError(message);
        pendingRotoKeyActionMessageRef.current = null;
      },
    },
  });
  const {
    activeOperationIdRef,
    pendingApplyRef,
  } = applyResultController;
  const projectCanvasWidth = launchContext?.width ?? DEFAULT_PHYSICS_PAINT_CANVAS_WIDTH;
  const projectCanvasHeight = launchContext?.height ?? DEFAULT_PHYSICS_PAINT_CANVAS_HEIGHT;
  const workingCanvasSize = getPhysicsPaintWorkingSize(projectCanvasWidth, projectCanvasHeight);
  const canvasWidth = workingCanvasSize.width;
  const canvasHeight = workingCanvasSize.height;
  const paperTextureScale = canvasWidth / projectCanvasWidth;
  const canvasKey = `${canvasWidth}x${canvasHeight}`;
  const { engine, engineRef, canvasMounted, setCanvasMounted, handleEngineReady, handleNativePenInputReady } = usePhysicsPaintEngineLifecycle({
    canvasKey,
    canvasWidth,
    canvasHeight,
    launchContext,
    setLastError,
    clearExternalState: () => {
      pendingFrameSyncRef.current = null;
      pendingFirstPaintTargetRef.current = null;
    },
  });
  const previewFps = launchContext?.fps && launchContext.fps > 0 ? launchContext.fps : 12;
  const initialRotoPlaybackSettings = launchContext?.rotoPlayback ?? {
    loop: false,
    fps: Math.max(1, Math.min(60, previewFps)),
  };
  const rotoPhysicalCapacity = launchContext ? physicPaintStore.getRotoPhysicalCapacity(launchContext.layerId, studioActiveTrackId()) : 1;
  // 47 close-out UAT round 9: the lane's cached-frame fills are track-scoped —
  // reseed the ref SYNCHRONOUSLY when the active track changes, before the
  // model below reads it. The post-render reseed effect let the previous
  // track's cells paint for one render (the stale-keys flash the user saw).
  // Guarded compare-then-write; refs never notify.
  //
  // studio-realm-divergence (nature: contract): reseed on a STRUCTURAL
  // revision change too. A move/cut/paste rewrites a track's frames with no
  // active-track change, so the track-switch-only guard kept the pre-move
  // frames and they painted as green phantom cells beside the landed keys.
  if (launchContext?.layerId) {
    const activeTrackIdNow = studioActiveTrackId();
    if (latestRotoFramesTrackRef.current !== activeTrackIdNow
      || latestRotoFramesRevisionRef.current !== rotoPhysicalRevision.value) {
      const physicalDocument = physicPaintStore.getRotoPhysicalDocument(launchContext.layerId, activeTrackIdNow);
      if (physicalDocument) {
        // debug studio-reopen-empty-boot: reseed is a SEED — same tolerance as
        // the launch seed (a residual unreadable frame is missing content).
        latestRotoFramesRef.current = recordsAsRuntimeFramesToleratingReferences(physicalDocument);
        latestRotoFramesTrackRef.current = activeTrackIdNow;
        latestRotoFramesRevisionRef.current = rotoPhysicalRevision.value;
      }
    }
  }
  const rotoTimelineModel = useRotoTimelineModel({
    cachedRotoFrames: latestRotoFramesRef.current,
    interpolationSettings: rotoLegacyInterpolationSettings,
    currentFrame,
    rotoKeyRecords,
    rotoInterpolationState,
    capacity: rotoPhysicalCapacity,
    selectedKeyId: selectedKeyId.value,
    incomingInterpolationBreakKeyIds: rotoIncomingInterpolationBreakKeyIds,
    rotoLoopClips,
    rotoParentEndExclusive: launchContext ? physicPaintStore.getRotoPhysicalCapacity(launchContext.layerId, studioActiveTrackId()) : 0,
  });
  const loopResolutionContext = rotoTimelineModel.loopResolutionContext.value;
  // The single canonical cross-type rail ordering authority (D-01): gestures,
  // copy, and focus all consume this same ordered identity list.
  const orderedRailSetIdentities = useMemo(
    () => deriveRailSetOrder({
      keyRailSegments,
      loopRanges: loopResolutionContext?.ranges ?? [],
    }),
    [keyRailSegments, loopResolutionContext],
  );
  // 43.6 D-01 Pitfall 2: the set reconciles against the fresh canonical
  // ordering on every render — an accepted physical revision, the
  // Interpolation Off/On toggle, or any external edit that deletes/retimes a
  // member clears the invalid set instead of inventing a fallback scope
  // (UI-SPEC M1 error). Same render-phase pattern as effectiveSelectedRotoKeyRail.
  const effectiveRailSetSelection = reconcileRailSetSelection(
    railSetSelection.value,
    orderedRailSetIdentities,
  );
  if (railSetSelection.peek() !== null && effectiveRailSetSelection === null) {
    railSetSelection.value = null;
  }
  // 43.6-08 (quick 260820-bjw fix): the ONE shared dynamic-scope classifier.
  // A single rail selected via plain click is a set of one (43.6 Solo
  // precedent); the active multi-rail set wins. Copy/Duplicate/Paste routing,
  // availability, and the strip overlay all consume this same authority.
  const effectiveRailSetMembers = useMemo(
    () => deriveEffectiveRailSetMembers(
      effectiveRailSetSelection,
      effectiveSelectedRotoKeyRail?.firstKeyId ?? null,
      effectiveSelectedLoopClipIds,
    ),
    [effectiveRailSetSelection, effectiveSelectedRotoKeyRail, effectiveSelectedLoopClipIds],
  );
  const hasEffectiveRailSetScope = effectiveRailSetMembers.length > 0;
  // 43.6-03: the explicit set members in Plan 01 canonical order, resolved to
  // the exact segment keyIds the resolver validates (D-17 — membership is
  // never re-derived in the view; the strip consumes this list opaquely).
  const railSetMoveMembers = useMemo<readonly PhysicPaintRailSetMoveMember[]>(() => {
    const members = effectiveRailSetSelection?.members ?? [];
    const resolved: PhysicPaintRailSetMoveMember[] = [];
    for (const member of members) {
      if (member.kind === 'key-rail') {
        const segment = keyRailSegments.find((candidate) => candidate.firstKeyId === member.firstKeyId);
        if (segment) {
          resolved.push({ kind: 'key-rail', firstKeyId: segment.firstKeyId, keyIds: segment.keyIds });
        }
      } else {
        resolved.push({ kind: 'loop', loopId: member.loopId });
      }
    }
    return resolved;
  }, [effectiveRailSetSelection, keyRailSegments]);
  const timelineOccupiedRotoFrames = rotoTimelineModel.occupiedRotoFrames.value;
  const timelineSavedRotoFrames = rotoTimelineModel.savedRotoFrames.value;
  const timelineCachedRotoFrames = rotoTimelineModel.cachedRotoFrames.value;
  const currentPhysicalCell = rotoTimelineModel.currentCell.value;
  const currentFrameSelectionKind = currentPhysicalCell.kind === 'real'
    ? 'real-key' as const
    : currentPhysicalCell.kind === 'generated'
      ? 'generated-interpolation' as const
      : 'empty' as const;
  const currentCellKeyId = currentPhysicalCell.kind === 'real' ? currentPhysicalCell.keyId : null;
  const [rotoScriptNavigationLocked, setRotoScriptNavigationLocked] = useState(false);
  const { cachedRotoReferenceUrl, cachedRotoRepaintBaseFrame, setCachedRotoReferenceUrl, setCachedRotoRepaintBaseFrame, clearCachedRotoReferenceUrl, resetCachedRotoReference, findCachedRotoDisplayFrame, findAcceptedRotoReferenceFrame, loadCachedRotoReferenceFrame } = rotoPersistence.reference;
  const cachedRotoReferenceUrlRef = useRef(cachedRotoReferenceUrl);
  const cachedRotoRepaintBaseFrameRef = useRef(cachedRotoRepaintBaseFrame);
  cachedRotoReferenceUrlRef.current = cachedRotoReferenceUrl;
  cachedRotoRepaintBaseFrameRef.current = cachedRotoRepaintBaseFrame;
  const rotoScript = useRotoScriptClipboardController({
    getEngine: () => engineRef.current,
    getSource: () => ({
      selectionKind: currentFrameSelectionKind,
      layerId: launchContext?.layerId ?? null,
      keyId: currentPhysicalCell.kind === 'real' ? currentPhysicalCell.keyId : null,
      appFrame: currentFrame,
    }),
    getMotion: () => ({
      deformation: launchContext ? physicPaintStore.getRotoInterpolationSettings(launchContext.layerId, trackIdOfLaunch(launchContext)).deform : 0,
      position: launchContext ? physicPaintStore.getRotoInterpolationSettings(launchContext.layerId, trackIdOfLaunch(launchContext)).position : 0,
    }),
    getPublicationIdentity: () => launchContext ? {
      operationId: launchContext.operationId,
      layerId: launchContext.layerId,
      cachedBase: cachedRotoRepaintBaseFrame,
      background: buildRotoBackgroundMetadata(settings),
    } : null,
    prepareTarget: (source) => prepareRotoScriptTargetRef.current(source),
    flushSourcePublication: (appFrame) => rotoPersistence.flushLivePixels(appFrame),
    // 261018: aquarelle Apply — replay through the fluid engine and publish
    // the wash onto the target key (engine-1 draws only the guide line).
    applyAquarelleEvents: async ({ events, target, onProgress }) => {
      const bgMeta = buildRotoBackgroundMetadata(settings);
      return applyAquarelleEventsToKey({
        events,
        target,
        onStrokeFed: onProgress,
        size: { width: canvasWidth, height: canvasHeight },
        paper: {
          paperId: bgMeta.background,
          grainStrength: bgMeta.grainStrength,
          grainScale: bgMeta.grainScale ?? 1,
        },
        publish: async (frame) => {
          const ok = await rotoPersistence.upsertCachedFrame(
            { frameIndex: 0, appFrame: frame.appFrame, bytes: frame.bytes, width: frame.width, height: frame.height },
            false,
            undefined,
            undefined,
            launchContext?.layerId,
            undefined,
            launchContext?.operationId,
            bgMeta,
            frame.keyId,
          );
          // aquarelle-apply-invisible: a cache-only publish never reaches the
          // display — the live aquarelle sheet is empty and the engine-1
          // preview base still holds the pre-Apply bytes. Force the same
          // content-token reconcile the completion path uses.
          if (ok && launchContextRef.current?.startFrame === frame.appFrame) {
            const generation = Math.max(
              rotoPreviewBaseContentToken(),
              engineRef.current?.getAppliedPreviewBaseContentToken?.() ?? 0,
            );
            loadCachedRotoReferenceFrame(
              frame.appFrame,
              engineRef.current as PreviewBackgroundEngine | null,
              undefined,
              true,
              generation,
            );
            physicPaintVersion.value++;
          }
          return ok;
        },
      });
    },
    onFirstAcceptedBrush: () => acceptRotoScriptBrushRef.current(),
    setNavigationLocked: setRotoScriptNavigationLocked,
  });
  rotoScript.updateEngine(engineRef.current);
  rotoScript.updateSource({
    selectionKind: currentFrameSelectionKind,
    layerId: launchContext?.layerId ?? null,
    keyId: currentPhysicalCell.kind === 'real' ? currentPhysicalCell.keyId : null,
    appFrame: currentFrame,
  });
  const rotoScriptLibrary = useRotoScriptLibraryController({
    request: async () => { throw new Error('Bridge request adapter is installed by the library hook.'); },
    capturePersistence: rotoScript.captureScriptForPersistence,
    captureThumbnail: async (scriptAlphaCanvas) => {
      const currentBridgeMode = bridgeMode === 'Unavailable' ? await detectPhysicsPaintBridgeMode() : bridgeMode;
      return createRotoScriptThumbnail({
        scriptAlphaCanvas,
        sourceWidth: projectCanvasWidth,
        sourceHeight: projectCanvasHeight,
        background: buildRotoBackgroundMetadata(settings),
        ...(currentBridgeMode === 'Tauri' ? { nativeEncoder: createPhysicPaintThumbnailNativeEncoder() } : {}),
      });
    },
    replaceClipboard: rotoScript.replaceClipboardFromPersisted,
    getLaunchContext: () => launchContext,
    // 260925-iy6 UAT round 6 ("no work, no log, fail in silent"): the status
    // capsule renders `applyStatus !== 'success' ? applyMessage : null`, so a
    // message written while a prior apply left `applyStatus === 'success'` was
    // stored and then filtered out. Every log must move applyStatus too, or a
    // failure looks like a dead control.
    log: (message, isError) => { setApplyMessage(message); setApplyStatus(isError ? 'error' : 'idle'); if (isError) setLastError(message); },
    // quick-260922-al1: the Studio supplies the OUTBOUND scope edge explicitly
    // (the adapter's default would serve just as well, but naming it here keeps
    // the one remaining port that leaves this realm visible at the wiring site).
    publishScriptScope: (scope) => { void requestPhysicPaintProjectContext(scope); },
  }, bridgeMode);
  // 52-04 (D-10): the reveal bake loads the library script snapshot by id — the
  // rail references the library script, never a copy. Wire the store's reveal
  // script loader to the SCRIPTS library's loadSnapshot so createRevealRail
  // (Plan 01) can resolve the script for the bake.
  useEffect(() => {
    _setEfxPaintRevealScriptLoader((scriptId) => rotoScriptLibrary.loadSnapshot(scriptId));
    return () => _setEfxPaintRevealScriptLoader(null);
  }, [rotoScriptLibrary]);
  const physicalMutationAvailable = useComputed(() => {
    physicPaintRotoPhysicalOperationLeaseVersion.value;
    // 47-01: re-resolve the lease for the currently active track — the active
    // track can change without any lease activity (row click / add / dup).
    efxPaintVersion.value;
    const projectContextId = launchContext?.project?.contextId;
    return !launchContext || (
      !!projectContextId
      && physicPaintStore.isRotoPhysicalOperationAvailable(
        projectContextId,
        launchContext.layerId,
        studioActiveTrackId(),
      )
    );
  });
  const mutationLocked = rotoScript.mutationLocked.value || !physicalMutationAvailable.value;
  const isPhysicalMutationLocked = useCallback(
    () => rotoScript.mutationLocked.peek() || !physicalMutationAvailable.peek(),
    [physicalMutationAvailable, rotoScript.mutationLocked],
  );
  // 43.5-05 (D-18): entering a mutation-locked state disarms an armed Push
  // tool; the unmount cleanup guarantees the session-only armed state never
  // survives a Studio reopen (D-19). A push tool mid-commit is exempt (smoke
  // 3): its own mutation must not disarm it, so the tool stays armed for the
  // next chained push.
  // 261022-mne: a mutation lock never ends an armed Solo — frame navigation
  // rides the same lock (prepareNavigation begins a script operation), so the
  // lock effect keeps push-tool behavior only.
  useEffect(() => {
    if (mutationLocked && !isPushCommitInFlight()) disarmPushTool();
    return () => {
      if (!isPushCommitInFlight()) disarmPushTool();
    };
  }, [mutationLocked]);
  // 261022-mne: the session Solo arm survives the whole Studio session — frame
  // navigation, playback, selection changes and mutation locks never end it.
  // Only a re-click of the pill, the keyboard Escape layer, a launch
  // replacement, or this unmount do.
  useEffect(() => () => {
    disarmSolo();
  }, []);
  // 261023-g4p: Studio disposal clears the per-frame brush script store so a
  // recreated engine/session can never inherit another session's frames, and
  // detaches the brush edition port from the dead session. Teardown only — no
  // selection work, no signal read.
  useEffect(() => () => {
    resetBrushScriptStore();
    configureBrushScriptEdition(null);
    // quick-261023-l35: drop the bound snapshot identity and the dirty
    // baseline with the realm — a dead session must never be read as dirty.
    studioScriptSnapshot.reset();
  }, [studioScriptSnapshot]);
  // quick-261003-vos: Alt = temporary erase — ONE module signal plus gated
  // window listeners (physicsPaintTemporaryErase). The deps live behind a
  // render-body ref (canvasEngineReadyImplRef precedent) so the
  // once-installed listeners always read the LATEST settings/tool,
  // engineRef, mutation lock and shortcut target — never the first render's
  // closures. No useState, no new UI, no edit to selectTool or the dispatcher.
  const temporaryEraseDepsRef = useRef<TemporaryEraseDeps>({
    getSelectedTool: () => 'paint',
    getEngine: () => null,
    isMutationLocked: () => true,
    isShortcutTarget: () => false,
  });
  // 261022-pim: the Brush-mode Cmd toggle returns to the last non-Move tool
  // (Paint or Erase). Render-body ref write, same family as settingsRef.
  const lastNonMoveToolRef = useRef<'paint' | 'erase'>('paint');
  if (settings.tool !== 'move') lastNonMoveToolRef.current = settings.tool;
  temporaryEraseDepsRef.current = {
    // 261022-pim: in Water color mode a held Cmd arms the select overlay
    // (temporaryMove is the held-Meta arm signal), never the engine-1 Move.
    getSelectedTool: () => (activeModule.peek() === 'watercolor' ? 'paint' : settings.tool),
    getEngine: () => engineRef.current,
    isMutationLocked: isPhysicalMutationLocked,
    isShortcutTarget: isPhysicsPaintShortcutTarget,
    // 261022-pim: a Cmd TAP (no chord) toggles the persistent tool. Water
    // color: select overlay. Brush: the Move tool becomes the SELECTED tool
    // (the previous tool is deselected in the rail); a second tap or picking
    // any tool leaves Move. Enter only from Paint — the dual-arm rule never
    // flips Erase — and only when the rail's Move gate is open.
    onMetaTap: () => {
      if (activeModule.peek() === 'watercolor') {
        toggleAquarelleSelectMode();
        return;
      }
      if (settings.tool === 'move') {
        selectTool(lastNonMoveToolRef.current, settings.physicsMode);
        return;
      }
      if (settings.tool === 'paint' && strokeScriptInMemory.peek()) {
        selectTool('move', settings.physicsMode);
      }
    },
    // 261022-pim: no live script (cooked/baked sheet, or a fresh session) →
    // Move is greyed in the rail and Cmd is inert in both modes.
    isMoveAvailable: () => (activeModule.peek() === 'watercolor'
      ? aquarelleLiveStrokeCount.peek() > 0
      : strokeScriptInMemory.peek()),
  };
  // Listener lifecycle: mounted once, torn down (disarm) on unmount. The deps
  // getter reads the ref at event time (ref-read deps). Window-level because
  // the dispatcher is element-level and the keydown target can be `body` when
  // the canvas has focus.
  useEffect(
    () => mountPhysicsPaintTemporaryErase({ window, document }, () => temporaryEraseDepsRef.current),
    [],
  );
  // 261023-g4p: the brush script-edition port reads the live Studio seams at
  // event time through this render-body ref (temporaryEraseDepsRef precedent)
  // — never the first render's closures. The port gates every op on the
  // physical-mutation lock; the frame is the Studio's current frame because
  // brush strokes carry no playFrame metadata.
  const brushScriptEditionDepsRef = useRef<BrushScriptEditionContext>({
    getEngine: () => null,
    getPlayFrame: () => 0,
    isActive: () => false,
    isLocked: () => true,
  });
  brushScriptEditionDepsRef.current = {
    getEngine: () => engineRef.current,
    getPlayFrame: () => launchContextRef.current?.startFrame ?? 0,
    isActive: () => activeModule.peek() === 'brush' && settings.tool === 'move',
    isLocked: () => isPhysicalMutationLocked(),
  };
  // Armed-guarded re-apply: engine re-create or a rail tool switch while an
  // arm is held must land the EFFECTIVE tool (force bypasses the last-applied
  // dedupe — selectTool and the canvas mount write the engine behind our
  // back). Disarmed = byte-identical no-op for every existing flow, including
  // engine re-creation which force-sets 'paint' at PhysicsPaintCanvasMount:104.
  // Both arms are peeked, never subscribed — no render path changes.
  useEffect(() => {
    if (!temporaryErase.peek() && !temporaryMove.peek()) return;
    syncTemporaryErase(temporaryEraseDepsRef.current, { force: true });
  }, [engine, settings.tool]);
  // Navigation already locks the engine input and navigation coordinator. Keep
  // the static Studio controls keyed only to real script mutations so the
  // navigation lock's true/false pulse cannot invalidate their memo props.
  const staticControlsLocked = mutationLocked && !rotoScriptNavigationLocked;
  const loopScriptRows = rotoScriptLibrary.rows.value;
  // quick-260922-al1 (code review CR-01): ownership of the refusal line the two
  // apply sites publish. `applyStatus` never reaches 'success' on this path, so
  // the capsule would keep showing a stale refusal after a later apply
  // succeeds — clearing is gated on this flag so only the publisher clears it.
  const scriptApplyRefusalOwnedRef = useRef(false);
  const clearOwnedScriptApplyRefusal = useCallback(() => {
    if (!scriptApplyRefusalOwnedRef.current) return;
    scriptApplyRefusalOwnedRef.current = false;
    setApplyMessage(null);
    setApplyStatus('idle');
  }, [setApplyMessage, setApplyStatus]);
  // 261023-j5b follow-up: an engine-1 Apply lands its strokes in the LIVE
  // engine. Both the Move overlay and the frame-editing reload gate read the
  // session store, so capture the applied frame the moment the apply settles.
  // Without this, applying (or duplicating) a script while Move is armed leaves
  // the canvas in paint with NO script handles until a tool refresh.
  const flushBrushScriptAfterApply = useCallback(() => {
    if (activeModule.peek() === 'watercolor') return;
    const activeEngine = engineRef.current;
    if (!activeEngine) return;
    const strokes = activeEngine.getStrokes();
    if (strokes.length === 0) return;
    flushBrushScriptFrame(
      launchContextRef.current?.startFrame ?? rotoScript.source.peek().appFrame,
      strokes,
      activeEngine.getFramePaintSettings() ?? activeEngine.getPaintRenderSettings(),
    );
  }, [rotoScript]);
  const handleScriptRowActivate = useCallback(async (id: string) => {
    const loaded = await rotoScriptLibrary.activateAndLoad(id);
    if (!loaded) return;
    const linkedGroups = getLinkedRotoGroupsForAction(rotoLoopClips, id);
    const selectedGroupId = selectedLoopClipId.peek();
    const preservedGroup = linkedGroups.find((group) => group.loopId === selectedGroupId) ?? null;
    const cursorFrame = launchContextRef.current?.startFrame ?? 0;
    activeLinkedLoopClipId.value = (
      preservedGroup ?? chooseCursorRelativeLinkedGroup(linkedGroups, cursorFrame)
    )?.loopId ?? null;
  }, [rotoLoopClips, rotoScriptLibrary]);
  const handleSelectedScriptLoadAndApply = useCallback(async () => {
    const selectedId = rotoScriptLibrary.selectedId.peek();
    if (!selectedId) return;
    const preparation = rotoScript.prepareScriptLoadAndApply();
    if (!preparation) return;
    try {
      const loaded = await rotoScriptLibrary.activateAndLoad(selectedId, preparation);
      if (!loaded) {
        // 55-06 (D-09/D-11): a refused library row must name what went wrong
        // on the EXISTING owned-refusal surface — no second error channel.
        // The host yields codes; this mapper names them. The library's raw
        // `Refused script: <code>` log is not the user-facing line.
        const row = rotoScriptLibrary.rows.value.find((candidate) => candidate.id === selectedId);
        const refusal = row && 'refusal' in row ? (row.refusal as string | undefined) : undefined;
        if (refusal) {
          const message = buildRotoScriptApplyRefusalMessage({ code: refusal });
          if (message) {
            setLastError(message);
            setApplyMessage(message);
            setApplyStatus('error');
            scriptApplyRefusalOwnedRef.current = true;
          }
        }
        return;
      }
      const applied = await rotoScript.applyPreparedScript(preparation);
      if (applied) {
        flushBrushScriptAfterApply();
        setLastError(null);
        clearOwnedScriptApplyRefusal();
      } else {
        // quick-260922-al1 (Task 3): a refused apply surfaces through the
        // EXISTING status capsule — the same route the rail-set rejections
        // already take (useRotoPhysicalEditCoordinator.ts:1909-1912), since the
        // `setLastError` value alone is discarded by its empty destructure. The
        // refusal copy wins where the code has one; every unaffected code keeps
        // the clipboard's own message.
        const error = rotoScript.error.peek();
        const message = buildRotoScriptApplyRefusalMessage(error) ?? error?.message ?? null;
        if (message) {
          setLastError(message);
          setApplyMessage(message);
          setApplyStatus('error');
          scriptApplyRefusalOwnedRef.current = true;
        }
      }
    } finally {
      rotoScript.cancelPreparedScriptLoadAndApply(preparation);
    }
  }, [rotoScript, rotoScriptLibrary, setLastError, setApplyMessage, setApplyStatus, clearOwnedScriptApplyRefusal, flushBrushScriptAfterApply]);
  // 260905-dso: the relocated buffer Apply/Clear handlers — identity-stable
  // useCallbacks wired into the workflow memo (the Tools popover Actions
  // section). Bodies moved verbatim from the rightPanel scripts props.
  const handleApplyScript = useCallback(() => {
    void (async () => {
      const success = await rotoScript.applyScript();
      if (success) {
        flushBrushScriptAfterApply();
        setLastError(null);
        clearOwnedScriptApplyRefusal();
      } else {
        // quick-260922-al1 (Task 3): the same explicit refusal surface as
        // handleSelectedScriptLoadAndApply above — one route for both apply
        // entry points, and nothing else about Apply changes.
        const error = rotoScript.error.peek();
        const message = buildRotoScriptApplyRefusalMessage(error) ?? error?.message ?? null;
        if (message) {
          setLastError(message);
          setApplyMessage(message);
          setApplyStatus('error');
          scriptApplyRefusalOwnedRef.current = true;
        }
      }
    })();
  }, [rotoScript, setLastError, setApplyMessage, setApplyStatus, clearOwnedScriptApplyRefusal, flushBrushScriptAfterApply]);
  const handleDiscardScript = useCallback(() => {
    rotoScript.discardScript();
    setLastError(null);
  }, [rotoScript, setLastError]);
  // Quick 261019-mj2 (D-01): non-real cells no longer disable canvas input —
  // the pointerdown self-promotes a blank key while the stroke paints on the
  // warm canvas. The only remaining canvas lock is the physical mutation lease;
  // a live self-promotion is exempt from it so the fast second stroke flows.
  const rotoInputDisabled = mutationLocked && !autoKeyPromotionPaintExempt.value;
  const {
    selectTool: selectToolEngine,
    setBrushColor,
    setBrushSize,
    setBrushOpacity,
    setBackground,
    setGrainStrength,
    setGrainScale,
    setEdgeDetail,
    setPickup,
    setSpread,
    setSmoothing,
    setEraseStrength,
  } = usePhysicsPaintEngineActions({ engine, settings, setSettings, isMutationLocked: isPhysicalMutationLocked });
  // 261023-g4p: the ONE tool-selection funnel for the rail and the Cmd tap.
  // Entering Move in Brush mode arms the shared script-edition overlay; the
  // engine keeps tool 'move' (stepStrokeInStack requires it) but its own stack
  // badges and brush cursor stand down so the overlay is the only visible
  // script surface. Leaving Move restores both. Water color and a refused
  // selection (no engine / physical lock) are byte-identical passthroughs —
  // the hook's own selectTool remains the only engine writer. Identity is
  // stable per engine+lock because selectToolEngine is the hook's useMemo.
  const selectTool = useCallback((tool: ToolType, physicsMode?: 'local' | null) => {
    const activeEngine = engineRef.current;
    if (!activeEngine || isPhysicalMutationLocked()) {
      selectToolEngine(tool, physicsMode);
      return;
    }
    if (activeModule.peek() === 'brush' && tool === 'move') {
      // 261023-j5b: Move entry is a capture point — carry the frame's paint
      // globals so the faithful rebake reproduces the painted look.
      flushBrushScriptFrame(
        launchContextRef.current?.startFrame ?? 0,
        activeEngine.getStrokes(),
        activeEngine.getFramePaintSettings() ?? activeEngine.getPaintRenderSettings(),
      );
      selectToolEngine(tool, physicsMode);
      activeEngine.setStrokeLabelsSuppressed(true);
      activeEngine.setCursorVisible(false);
      return;
    }
    activeEngine.setStrokeLabelsSuppressed(false);
    activeEngine.setCursorVisible(true);
    selectToolEngine(tool, physicsMode);
  }, [selectToolEngine, isPhysicalMutationLocked]);
  // 49-04 UAT fix: the swatch click must ALSO write the document fallback so
  // the monitor fond layer resolves the paper/solid/transparent record. The
  // 49-03 S6 write-through helper (backgroundModeToFallback) existed but the
  // click path never invoked it — the document fallback stayed transparent and
  // the monitor showed black. 'photo' is reserved for Phase 50 and has no
  // fallback record, so it is excluded from the write-through.
  const handleBackgroundChange = (mode: StudioBackgroundMode) => {
    setBackground(mode);
    const layerId = launchContext?.layerId;
    if (layerId && mode !== 'photo') {
      setBackgroundFallback(layerId, backgroundModeToFallback(mode, settings));
    }
  };
  // 260923-bcm: one synchronous action — settings + track mirror + document
  // fallback — so the scale reaches playback/fond the same render and survives
  // reopen (settings hydrate only from document.background.fallback). No engine
  // call: visible background is suppressed at PhysicsPaintCanvasMount.
  // 261017-vcn I-04 remainder: the surviving grain pair also writes the
  // paper-display record (setPaper*) so the paper-display record and the
  // document fallback / track metadata stay in sync in the same turn. The
  // paper-only pair is gone — one pair only (Q6).
  const handleGrainScaleChange = (scale: number) => {
    const layerId = launchContext?.layerId;
    const nextSettings = { ...settings, grainScale: scale };
    setGrainScale(scale);
    if (layerId) {
      physicPaintStore.setPaperScale(layerId, scale);
      physicPaintStore.setRotoBackgroundMetadata(layerId, studioActiveTrackId(), buildRotoBackgroundMetadata(nextSettings));
    }
    if (layerId && settings.background !== 'photo') {
      setBackgroundFallback(layerId, backgroundModeToFallback(settings.background, nextSettings));
    }
  };
  // 260925-iy6 UAT follow-up: same synchronous write-through as the scale —
  // the strength must clear both flattened memos and bump the version clock in
  // the same turn, not wait for the deferred useRotoBackgroundMetadataSync.
  const handleGrainStrengthChange = (strength: number) => {
    const layerId = launchContext?.layerId;
    const nextSettings = { ...settings, grainStrength: strength };
    setGrainStrength(strength);
    if (layerId) {
      physicPaintStore.setPaperStrength(layerId, strength);
      physicPaintStore.setRotoBackgroundMetadata(layerId, studioActiveTrackId(), buildRotoBackgroundMetadata(nextSettings));
    }
    if (layerId && settings.background !== 'photo') {
      setBackgroundFallback(layerId, backgroundModeToFallback(settings.background, nextSettings));
    }
  };
  // 56-05 (PAPER-03 / D-10): the shared-panel Paper section's paper-id port —
  // display-class edit through the store's paper-id setter (fond + change
  // token). Transparent / White route through handleBackgroundChange.
  const handlePaperIdChange = (paperId: string) => {
    const layerId = launchContext?.layerId;
    if (layerId) physicPaintStore.setPaperId(layerId, paperId);
    setBackground(paperId as StudioBackgroundMode);
  };
  // 261023-g4p: the brush store follows the physical key lifecycle — a
  // successful accepted replace prunes every frame at/after the first
  // divergent record position (fail closed, never remapped).
  const pruneBrushScriptsForRecords = (
    beforeRecords: readonly { keyId: string; appFrame: number }[],
    nextRecords: readonly { keyId: string; appFrame: number }[],
  ) => {
    const pruneFrame = computeBrushScriptPruneFrame(beforeRecords, nextRecords);
    if (pruneFrame !== null) pruneBrushScriptsFromFrame(pruneFrame);
  };
  const replacePhysicalRecordsWithOwnership = (
    layerId: string,
    records: readonly PhysicPaintRotoRealKeyRecord[],
    interpolation: PhysicPaintRotoInterpolationState,
  ) => {
    const beforeRecords = physicPaintStore.getRotoRealKeyRecords(layerId, studioActiveTrackId());
    const currentLoopClips = physicPaintStore.getRotoPhysicalLoopClips(layerId, studioActiveTrackId());
    const currentIncomingBreaks = physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(layerId, studioActiveTrackId());
    const currentGroupOverrides = physicPaintStore.getRotoGroupOverrideRecords(layerId, studioActiveTrackId());
    const nextRevision = buildPhysicPaintRotoPhysicalRevision(
      records,
      interpolation,
      currentLoopClips,
      currentIncomingBreaks,
      currentGroupOverrides,
    );
    if (buildPhysicPaintRotoPhysicalRevision(
      beforeRecords,
      physicPaintStore.getRotoPhysicalInterpolationState(layerId, studioActiveTrackId()),
      currentLoopClips,
      currentIncomingBreaks,
      currentGroupOverrides,
    ) === nextRevision) {
      const identicalRevisionResult = physicPaintStore.replaceRotoPhysicalRecords(layerId, studioActiveTrackId(), records, interpolation, physicPaintStore.getRotoPhysicalCapacity(layerId, studioActiveTrackId()));
      if (identicalRevisionResult.ok) pruneBrushScriptsForRecords(beforeRecords, records);
      return identicalRevisionResult;
    }
    const repaintBase = cachedRotoRepaintBaseFrameRef.current;
    const realKeyOwnedReference = repaintBase && beforeRecords.some((record) => record.appFrame === repaintBase.appFrame)
      ? { url: cachedRotoReferenceUrlRef.current, cachedRepaintBase: repaintBase }
      : { url: null, cachedRepaintBase: null };
    const ownership = rebuildRotoPhysicalOwnership({
      beforeRecords,
      afterRecords: records,
      contentRevision: nextRevision,
      snapshot: {
        frameStates: rotoEditBuffer.bufferRef.current.frameStates,
        previewFrames: rotoEditBuffer.bufferRef.current.previewFrames,
        capturedFrames: rotoEditBuffer.bufferRef.current.capturedFrames,
        confirmedFrames: rotoPersistence.confirmedFramesRef.current,
        dirtyFrames: rotoEditBuffer.bufferRef.current.dirtyFrames,
        liveOverlayActionCounts: rotoEditBuffer.bufferRef.current.liveOverlayActionCounts,
        editableFrames: rotoEditableFramesRef.current,
        reference: realKeyOwnedReference,
      },
    });
    if (!ownership.ok) return { ok: false as const, error: ownership.error };
    const result = physicPaintStore.replaceRotoPhysicalRecords(layerId, studioActiveTrackId(), records, interpolation, physicPaintStore.getRotoPhysicalCapacity(layerId, studioActiveTrackId()));
    if (!result.ok) return result;
    pruneBrushScriptsForRecords(beforeRecords, records);
    const next = ownership.value;
    rotoEditBuffer.replaceFrameStates(next.frameStates);
    rotoEditBuffer.replacePreviewFrames(next.previewFrames);
    rotoEditBuffer.bufferRef.current.capturedFrames = next.capturedFrames;
    rotoEditBuffer.replaceDirtyFrames(next.dirtyFrames);
    rotoEditBuffer.bufferRef.current.liveOverlayActionCounts = next.liveOverlayActionCounts;
    rotoEditableFramesRef.current = next.editableFrames;
    rotoEditBuffer.setEditableFrameList(() => next.editableFrames);
    rotoPersistence.confirmedFramesRef.current = next.confirmedFrames;
    cachedRotoReferenceUrlRef.current = next.reference.url;
    cachedRotoRepaintBaseFrameRef.current = next.reference.cachedRepaintBase;
    setCachedRotoReferenceUrl(next.reference.url);
    setCachedRotoRepaintBaseFrame(next.reference.cachedRepaintBase);
    return result;
  };
  const replacePhysicalDocumentWithOwnership = (
    layerId: string,
    document: PhysicPaintRotoPhysicalDocument,
    leaseToken: PhysicPaintRotoPhysicalOperationLeaseToken,
  ) => {
    const beforeDocument = physicPaintStore.getRotoPhysicalDocument(layerId, studioActiveTrackId());
    const beforeRecords = beforeDocument?.realKeyRecords ?? physicPaintStore.getRotoRealKeyRecords(layerId, studioActiveTrackId());
    // Direct auto-paint creates the key while the empty frame is already
    // dirty/live-overlay in the child. That provisional state cannot be remapped
    // by pre-state identity; the accepted key owns the frame now.
    const beforeFrames = new Set(beforeRecords.map((record) => record.appFrame));
    const addedKeyFrames = document.realKeyRecords
      .filter((record) => !beforeFrames.has(record.appFrame))
      .map((record) => record.appFrame);
    const repaintBase = cachedRotoRepaintBaseFrameRef.current;
    const realKeyOwnedReference = repaintBase && beforeRecords.some((record) => record.appFrame === repaintBase.appFrame)
      ? { url: cachedRotoReferenceUrlRef.current, cachedRepaintBase: repaintBase }
      : { url: null, cachedRepaintBase: null };
    const snapshotFrames = [
      ...rotoEditBuffer.bufferRef.current.frameStates.keys(),
      ...rotoEditBuffer.bufferRef.current.previewFrames.keys(),
      ...rotoEditBuffer.bufferRef.current.capturedFrames.keys(),
      ...rotoPersistence.confirmedFramesRef.current.keys(),
      ...rotoEditBuffer.bufferRef.current.dirtyFrames,
      ...rotoEditBuffer.bufferRef.current.liveOverlayActionCounts.keys(),
      ...rotoEditableFramesRef.current,
      ...(repaintBase ? [repaintBase.appFrame] : []),
    ];
    const ownership = rebuildRotoPhysicalOwnership({
      beforeRecords,
      afterRecords: document.realKeyRecords,
      contentRevision: document.revision,
      discardUnownedAppFrames: [
        ...(beforeDocument
          ? collectDiscardableRotoGroupOwnedFrames({
              beforeDocument,
              afterDocument: document,
              snapshotFrames,
            })
          : []),
        ...addedKeyFrames,
      ],
      snapshot: {
        frameStates: rotoEditBuffer.bufferRef.current.frameStates,
        previewFrames: rotoEditBuffer.bufferRef.current.previewFrames,
        capturedFrames: rotoEditBuffer.bufferRef.current.capturedFrames,
        confirmedFrames: rotoPersistence.confirmedFramesRef.current,
        dirtyFrames: rotoEditBuffer.bufferRef.current.dirtyFrames,
        liveOverlayActionCounts: rotoEditBuffer.bufferRef.current.liveOverlayActionCounts,
        editableFrames: rotoEditableFramesRef.current,
        reference: realKeyOwnedReference,
      },
    });
    if (!ownership.ok) return { ok: false as const, error: ownership.error };
    const result = physicPaintStore.replaceRotoPhysicalDocument(layerId, studioActiveTrackId(), document, leaseToken);
    if (!result.ok) return result;
    pruneBrushScriptsForRecords(beforeRecords, document.realKeyRecords);
    const next = ownership.value;
    rotoEditBuffer.replaceFrameStates(next.frameStates);
    rotoEditBuffer.replacePreviewFrames(next.previewFrames);
    rotoEditBuffer.bufferRef.current.capturedFrames = next.capturedFrames;
    rotoEditBuffer.replaceDirtyFrames(next.dirtyFrames);
    rotoEditBuffer.bufferRef.current.liveOverlayActionCounts = next.liveOverlayActionCounts;
    rotoEditableFramesRef.current = next.editableFrames;
    rotoEditBuffer.setEditableFrameList(() => next.editableFrames);
    rotoPersistence.confirmedFramesRef.current = next.confirmedFrames;
    cachedRotoReferenceUrlRef.current = next.reference.url;
    cachedRotoRepaintBaseFrameRef.current = next.reference.cachedRepaintBase;
    setCachedRotoReferenceUrl(next.reference.url);
    setCachedRotoRepaintBaseFrame(next.reference.cachedRepaintBase);
    return result;
  };
  const physicalEditCoordinator = useRotoPhysicalEditCoordinator<EfxPaintDocument>({
    engine,
    records: {
      getRecords: (layerId) => physicPaintStore.getRotoRealKeyRecords(layerId, studioActiveTrackId()),
      getDocument: (layerId) => physicPaintStore.getRotoPhysicalDocument(layerId, studioActiveTrackId()),
      replaceDocument: replacePhysicalDocumentWithOwnership,
      getInterpolation: (layerId) => physicPaintStore.getRotoPhysicalInterpolationState(layerId, studioActiveTrackId()),
      getCapacity: (layerId) => physicPaintStore.getRotoPhysicalCapacity(layerId, studioActiveTrackId()),
      // Quick 261019-mj2: child-realm only. The coordinator raises this mirror
      // just far enough to stage a gap insert that opens a tail slot; the
      // parent bridge owns the FX span extension and the parent mirror.
      raiseCapacity: (layerId, capacity) => physicPaintStore.setRotoPhysicalCapacity(
        layerId,
        studioActiveTrackId(),
        capacity,
      ),
      getLoopClips: (layerId) => physicPaintStore.getRotoPhysicalLoopClips(layerId, studioActiveTrackId()),
      getIncomingInterpolationBreakKeyIds: (layerId) => physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(layerId, studioActiveTrackId()),
      replaceIncomingInterpolationBreakKeyIds: (layerId, keyIds) => (
        physicPaintStore.replaceRotoPhysicalIncomingInterpolationBreakKeyIds(layerId, studioActiveTrackId(), keyIds)
      ),
      replaceLoopClips: (layerId, loopClips) => physicPaintStore.replaceRotoPhysicalLoopClips(layerId, studioActiveTrackId(), loopClips),
      replaceRecords: replacePhysicalRecordsWithOwnership,
    },
    buffer: {
      get frameStates() { return rotoEditBuffer.bufferRef.current.frameStates; },
      get previewFrames() { return rotoEditBuffer.bufferRef.current.previewFrames; },
      get capturedFrames() { return rotoEditBuffer.bufferRef.current.capturedFrames; },
      get confirmedFrames() { return rotoPersistence.confirmedFramesRef.current; },
      get dirtyFrames() { return rotoEditBuffer.bufferRef.current.dirtyFrames; },
      get liveOverlayActionCounts() { return rotoEditBuffer.bufferRef.current.liveOverlayActionCounts; },
      get editableFrames() { return rotoEditableFramesRef.current; },
      replaceFrameStates: (frames) => { rotoEditBuffer.replaceFrameStates(frames as Map<number, EfxPaintDocument>); },
      replacePreviewFrames: (frames) => { rotoEditBuffer.replacePreviewFrames(frames as Map<number, RenderedFramePayload>); },
      replaceCapturedFrames: (frames) => { rotoEditBuffer.bufferRef.current.capturedFrames = new Map(frames) as Map<number, RenderedFramePayload>; },
      replaceConfirmedFrames: (frames) => { rotoPersistence.confirmedFramesRef.current = new Map(frames) as Map<number, RenderedFramePayload>; },
      replaceDirtyFrames: (frames) => { rotoEditBuffer.replaceDirtyFrames(new Set(frames)); },
      replaceLiveOverlayActionCounts: (counts) => { rotoEditBuffer.bufferRef.current.liveOverlayActionCounts = new Map(counts); },
      setEditableFrameList: (frames) => { rotoEditableFramesRef.current = [...frames]; rotoEditBuffer.setEditableFrameList(() => [...frames]); },
      evictAcceptedFrames: (frames) => {
        const affected = new Set(frames);
        for (const frame of affected) {
          rotoEditBuffer.bufferRef.current.frameStates.delete(frame);
          rotoEditBuffer.bufferRef.current.previewFrames.delete(frame);
          rotoEditBuffer.bufferRef.current.capturedFrames.delete(frame);
          rotoEditBuffer.bufferRef.current.dirtyFrames.delete(frame);
          rotoEditBuffer.bufferRef.current.liveOverlayActionCounts.delete(frame);
          rotoPersistence.confirmedFramesRef.current.delete(frame);
        }
        rotoEditableFramesRef.current = rotoEditableFramesRef.current.filter((frame) => !affected.has(frame));
        rotoEditBuffer.setEditableFrameList((editable) => editable.filter((frame) => !affected.has(frame)));
      },
    },
    selection: {
      getSelectedKeyId: () => selectedKeyId.value,
      setSelectedKeyId: (keyId) => { selectedKeyId.value = keyId; },
      getCurrentAppFrame: () => currentFrame,
      setCurrentAppFrame: (frame) => {
        const launch = launchContextRef.current;
        if (launch) physicPaintStore.setRotoPhysicalSelection(launch.layerId, studioActiveTrackId(), selectedKeyId.value, frame);
        setLaunchContext((current) => current ? { ...current, startFrame: frame } : current);
      },
    },
    reference: {
      getCachedReference: () => ({ url: cachedRotoReferenceUrlRef.current, cachedRepaintBase: cachedRotoRepaintBaseFrameRef.current }),
      setCachedReference: (reference) => {
        cachedRotoReferenceUrlRef.current = reference.url;
        cachedRotoRepaintBaseFrameRef.current = reference.cachedRepaintBase;
        setCachedRotoReferenceUrl(reference.url);
        setCachedRotoRepaintBaseFrame(reference.cachedRepaintBase);
      },
      reconcileCurrentFrame: (appFrame) => {
        // Direct-paint auto-key (261021 first-stroke loss): the promoted key is
        // BLANK while the stroke that triggered the promotion still owns the
        // canvas. Painting that base here runs engine.clear(true) and the
        // atomic dry clear when the blank image lands — the first stroke
        // vanished the moment the key appeared. Keep the live engine; pin the
        // blank frame as the capture merge base so the stroke is merged onto
        // it. The accepted-settlement branch re-pins the same base.
        const pendingPromotion = pendingFirstPaintTargetRef.current;
        const launchForPromotion = launchContextRef.current;
        if (
          pendingPromotion?.source === 'auto-key-paint'
          && launchForPromotion
          && pendingPromotion.launchOperationId === launchForPromotion.operationId
          && pendingPromotion.layerId === launchForPromotion.layerId
          && pendingPromotion.appFrame === appFrame
        ) {
          if (pendingPromotion.blankFrame) {
            cachedRotoRepaintBaseFrameRef.current = pendingPromotion.blankFrame;
            setCachedRotoRepaintBaseFrame(pendingPromotion.blankFrame);
          }
          return;
        }
        // regression-refresh-multi-paint: the acceptance paint is the FINAL
        // preview-base paint of the completion. It is tagged with the ACCEPTED
        // document's CONTENT token (Layer 2), so a stale async decode/apply —
        // or a later-issued paint of OLDER content (a stale frame) — can never
        // paint over it: the engine's preview-base seam drops any settle whose
        // token is below the applied one. Its cache-miss decode can still be
        // superseded inside the decode window (wide for many-stroke PNGs) with
        // no later paint issued — the canvas would keep the pre-apply image
        // until an unrelated repaint. The generation-aware guard repairs
        // exactly that outcome, and ONLY while the newest token has not landed.
        // The reconcile ALWAYS paints: max(acceptedToken, applied) is never
        // below the applied gate, and the accepted token is the newest
        // content-derived token assigned (equal re-issues re-paint the same
        // content idempotently).
        const acceptedContentToken = rotoPreviewBaseContentToken();
        const currentAppliedGeneration = engineRef.current?.getAppliedPreviewBaseContentToken?.() ?? null;
        const generation = Math.max(acceptedContentToken, currentAppliedGeneration ?? 0);
        // Synchronous on purpose (52.1): the reconcile is ALSO what refreshes
        // cachedRotoRepaintBaseFrame, which the next stroke's live-pixel
        // capture needs as its merge base. Deferring it left the base stale and
        // every fresh-key stroke re-encoded the full frame (base=no, 390-511ms)
        // instead of a ~4ms merge. The GPU-heavy engine upload is bounded by the
        // base apply once; the mid-train capture/encode floods are held out by
        // the capture+documentSync quiet windows instead.
        loadCachedRotoReferenceFrame(
          appFrame,
          engineRef.current as PreviewBackgroundEngine | null,
          undefined,
          true,
          generation,
        );
        const intendedFrame = findAcceptedRotoReferenceFrame(appFrame);
        armRotoCompletionPaintGuard({
          engine: engineRef.current as PreviewBackgroundEngine | null,
          appFrame,
          intendedDataUrl: intendedFrame ? (getFrameBlobUrl(intendedFrame.bytes) || null) : null,
          intendedBytes: intendedFrame?.bytes ?? new Uint8Array(0),
          intendedGeneration: generation,
          getCurrentAppFrame: () => launchContextRef.current?.startFrame ?? 0,
          reload: (frame, bytes, paintGeneration) => {
            // Repair re-applies ONLY the intended (newest) image at its own
            // generation — never whatever the frame lookup resolves to later.
            // The engine generation gate turns this into a no-op if a newer
            // generation painted between arm and repair.
            loadCachedRotoReferenceFrame(frame, engineRef.current as PreviewBackgroundEngine | null, undefined, true, paintGeneration, bytes);
          },
          log: (message) => { console.error('[PhysicsPaintStudio] physical edit:', message); },
        });
      },
    },
    engineState: {
      saveEngineState: () => engineRef.current?.save() ?? null,
      loadEngineState: (state) => { engineRef.current?.load(state); },
    },
    launch: {
      getLaunchContext: () => launchContextRef.current,
      getActiveTrackId: (layerId) => getEfxPaintDocument(layerId)?.activeTrackId ?? '',
      setLaunchContextStartFrame: (frame) => { setLaunchContext((current) => current ? { ...current, startFrame: frame } : current); },
      setLaunchContextCachedFrames: (_frames, options) => {
        rotoPersistence.syncCurrentPhysicalDocument(options);
      },
    },
    paint: {
      flushPendingStrokeFinalizations: () => { engineRef.current?.flushPendingStrokeFinalizations(); },
      flushLivePixels: (appFrame) => rotoPersistence.flushLivePixels(appFrame),
    },
    lease: {
      acquire: (projectContextId, layerId) => (
        physicPaintStore.acquireRotoPhysicalOperationLease(projectContextId, layerId, studioActiveTrackId())
      ),
      release: (token) => physicPaintStore.releaseRotoPhysicalOperationLease(token),
      transferToRecovery: (token) => (
        physicPaintStore.transferRotoPhysicalOperationLeaseToRecovery(token)
      ),
    },
    bridge: {
      getBridgeMode: () => bridgeModeRef.current,
      // studio-realm-divergence (nature: contract): push the pending structural
      // document sync BEFORE the physical edit's revision gate runs on the main
      // window. A structural change (track create, paint, rename) only sets the
      // child's sync-dirty flag; the push itself is debounced. Without this
      // flush the main window validates `expectedRevision` against a state that
      // predates the change and rejects every edit with "Roto physical revision
      // became stale before commit" — until some unrelated action (a cross-track
      // move's publishDocumentSync) happens to push first.
      sendPhysicalEditPayload: async (payload) => {
        await flushDocumentSyncRef.current();
        await sendPhysicPaintApplyPayload(payload, bridgeModeRef.current);
      },
    },
    settlement: {
      registerPendingSettlement: () => {},
      clearPendingSettlement: () => {},
    },
    status: {
      setApplyStatus,
      setConciseMessage: (message) => {
        setApplyMessage(message);
      },
      setLastError,
      logDiagnostic: (message) => {
        console.error('[PhysicsPaintStudio] physical edit:', message);
      },
    },
  });
  groupFramePaintExecuteRef.current = (executeInput) => (
    physicalEditCoordinator.executePhysicalEdit(executeInput as unknown as RotoPhysicalEditCoordinatorExecuteInput<EfxPaintDocument>)
  );
  groupLifecycleDeleteExecuteRef.current = async (target) => {
    const launch = launchContextRef.current;
    if (!launch) return false;
    const executeInput: RotoGroupLifecycleDeleteExecuteInput = {
      operationKind: target.operationKind,
      expectedLaunch: {
        operationId: launch.operationId,
        layerId: launch.layerId,
      },
      groupId: target.groupId,
      appFrame: target.appFrame,
    };
    const accepted = await dispatchAndWaitForAcceptedRotoPhysicalEdit(
      physicalEditCoordinator.pendingOperationId,
      physicalEditCoordinator.acceptedOutput,
      () => physicalEditCoordinator.executePhysicalEdit(executeInput),
    );
    if (accepted === null) return false;

    selectedLoopClipIds.value = target.operationKind === 'delete-group' || target.onlyOccurrence
      ? selectedLoopClipIds.peek().filter((groupId) => groupId !== target.groupId)
      : selectedLoopClipIds.peek();
    if (selectedLoopClipIds.value.length === 0) loopSelectionAnchorId.value = null;
    const deletedGroupMode = rotoLoopClips.find((clip) => clip.loopId === target.groupId)?.mode
      ?? 'progressive';
    setApplyMessage(target.operationKind === 'delete-group'
      ? deletedGroupMode === 'static'
        ? `Deleted Static Rail at F${target.phaseOrigin}.`
        : `Deleted Motion Rail at F${target.phaseOrigin}.`
      : `Deleted F${target.appFrame} from Rail at F${target.phaseOrigin}.`);
    return accepted !== null;
  };
  railSetDeleteExecuteRef.current = async (target) => {
    const launch = launchContextRef.current;
    if (!launch) return false;
    const executeInput: RotoRailSetDeleteExecuteInput = {
      operationKind: 'delete-rails',
      expectedLaunch: {
        operationId: launch.operationId,
        layerId: launch.layerId,
      },
      members: target.members,
    };
    const accepted = await dispatchAndWaitForAcceptedRotoPhysicalEdit(
      physicalEditCoordinator.pendingOperationId,
      physicalEditCoordinator.acceptedOutput,
      () => physicalEditCoordinator.executePhysicalEdit(executeInput),
    );
    return accepted !== null;
  };
  // 43.6-08 (quick 260820-bjw): the child submits the frozen copy payload via
  // the SAME coordinator; the shared pure `proposeRails` reproduces the exact
  // proposal on the child side (and the parent bridge recomputes from the
  // `paste` semantic delta). 'duplicate' derives its destination from document
  // facts, so no destination is carried — mirror railSetDeleteExecuteRef.
  railSetPasteExecuteRef.current = async (input) => {
    const launch = launchContextRef.current;
    if (!launch) return false;
    const executeInput: RotoRailSetPasteExecuteInput = {
      operationKind: 'paste',
      expectedLaunch: {
        operationId: launch.operationId,
        layerId: launch.layerId,
      },
      payload: input.payload,
      placementMode: input.placementMode,
      ...(input.destinationAppFrame !== undefined
        ? { destinationAppFrame: input.destinationAppFrame }
        : {}),
    };
    const accepted = await dispatchAndWaitForAcceptedRotoPhysicalEdit(
      physicalEditCoordinator.pendingOperationId,
      physicalEditCoordinator.acceptedOutput,
      () => physicalEditCoordinator.executePhysicalEdit(executeInput),
    );
    return accepted !== null;
  };

  const rotoTimelineActions = useRotoTimelineActions({
    getModel: () => rotoTimelineModel.view.value.model,
    getStoreRealKeyFrames: () => launchContext ? selectRealCachedRotoSourceFrameNumbers(latestRotoFramesRef.current) : [],
    getCurrentSettings: () => launchContext ? physicPaintStore.getRotoInterpolationSettings(launchContext.layerId, studioActiveTrackId()) : { enabled: false, inBetweenCount: 1, mode: 'duplicate', deform: 0, position: 0 },
    setInterpolationSettings: (settings) => {
      if (!launchContext) return settings;
      physicPaintStore.setRotoInterpolationSettings(launchContext.layerId, studioActiveTrackId(), settings);
      return physicPaintStore.getRotoInterpolationSettings(launchContext.layerId, studioActiveTrackId());
    },
    getStoreRotoFrames: () => launchContext ? physicPaintStore.getRotoCacheFrames(launchContext.layerId, studioActiveTrackId()) : [],
    getFailureStatus: () => launchContext ? physicPaintStore.getRotoInterpolationFailureStatus(launchContext.layerId, studioActiveTrackId()) : null,
    getRotoKeyRecords: () => rotoKeyRecords,
    getRotoInterpolationState: () => rotoInterpolationState,
    getRotoLoopClips: () => launchContext ? physicPaintStore.getRotoPhysicalLoopClips(launchContext.layerId, studioActiveTrackId()) : [],
    getPhysicalCells: () => rotoTimelineModel.physicalCells.value,
    getSelectedKeyId: () => selectedKeyId.value,
    getSelectedKeyIds: () => selectedKeyIds.value,
    getSelectedKeyRail: () => effectiveSelectedRotoKeyRail,
    getSelectedLoopClipIds: () => effectiveRotoLoopClipSelection?.selectedLoopClipIds ?? [],
    getRailSetMembers: () => effectiveRailSetMembers,
    getSelectedLoopRailDisplayName: (loopId) => {
      const range = rotoTimelineModel.loopResolutionContext.value?.ranges.find((candidate) => candidate.loopId === loopId);
      const clip = rotoLoopClips.find((candidate) => candidate.loopId === loopId);
      if (!range || !clip) return null;
      const sourceScriptName = clip.scriptId
        ? loopScriptRows.find((row) => row.id === clip.scriptId)?.name ?? null
        : null;
      return projectPhysicsPaintLoopClipPresentation(range, clip, sourceScriptName).displayName;
    },
    getRotoSpacingSelection: () => reconcilePhysicsPaintRotoSpacingSelection(
      rotoSpacingSelection.peek(),
      (launchContextRef.current ? physicPaintStore.getRotoPhysicalLoopClips(launchContextRef.current.layerId, studioActiveTrackId()) : [])
        .filter((loopClip) => {
          const currentKeyIds = new Set(launchContextRef.current ? physicPaintStore.getRotoRealKeyRecords(launchContextRef.current.layerId, studioActiveTrackId()).map((record) => record.keyId) : []);
          return loopClip.sourceKeyIds.every((keyId) => currentKeyIds.has(keyId));
        })
        .map((loopClip) => ({ sourceKeyIds: loopClip.sourceKeyIds })),
    ),
    getCurrentAppFrame: () => currentFrame,
    getLaunchContext: () => launchContextRef.current,
    getCapacity: () => launchContext ? physicPaintStore.getRotoPhysicalCapacity(launchContext.layerId, studioActiveTrackId()) : 1,
    getParentEndExclusive: () => launchContext
      ? physicPaintStore.getRotoPhysicalCapacity(launchContext.layerId, studioActiveTrackId())
      : 0,
    getIncomingInterpolationBreakKeyIds: () => launchContext
      ? physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(launchContext.layerId, studioActiveTrackId())
      : [],
    executePhysicalEdit: (executeInput) => physicalEditCoordinator.executePhysicalEdit(executeInput as RotoPhysicalEditCoordinatorExecuteInput<EfxPaintDocument>),
    pendingOperationId: physicalEditCoordinator.pendingOperationId,
    executeGroupLifecycleDelete: (target) => groupLifecycleDeleteExecuteRef.current(target),
    executeRailSetDelete: (target) => railSetDeleteExecuteRef.current(target),
    getRailSetClipboard: () => railSetClipboardReadRef.current(),
    setRailSetClipboard: (payload) => railSetClipboardWriteRef.current(payload),
    executeRailSetPaste: (input) => railSetPasteExecuteRef.current(input),
    requestSoleOccurrenceDeleteWarning: handleRequestSoleOccurrenceDeleteWarning,
    publishStatus: (message) => {
      lastRotoStatusMessageRef.current = message;
      setApplyMessage(message);
    },
    setApplyStatus,
    publishDiagnostic: (message) => { console.error('[PhysicsPaintStudio] physical edit:', message); },
  });
  const rotoPhysicalActions = rotoTimelineActions.physicalActions;
  // Quick 261019-mj2 Task 3 (D-01): the ONE promotion seam used by script
  // targets and the pointerdown self-promotion. It
  // builds the blank payload, assigns it to the pending entry BEFORE dispatch,
  // creates the key through addEmptyKey (persistent incoming interpolation
  // break), and only reports success for a live record created on this frame.
  promoteRotoPaintTargetRef.current = async (source) => {
    const launch = launchContextRef.current;
    // Quick 261019-mj2 UAT: never fail silently behind one generic sentence.
    // The LOG diagnostic names the failing branch plus the coordinator/status
    // reason that caused it.
    const fail = (
      branch: string,
      extra?: Omit<RotoPaintPromotionFailure, 'ok' | 'error' | 'diagnostic'>,
    ): RotoPaintPromotionFailure => {
      const failure = physicalEditCoordinator.failureOutput.peek();
      const presentation = physicalEditCoordinator.presentation.peek();
      const diagnostic = [
        branch,
        failure ? `reason=${failure.reason}` : null,
        presentation?.conciseMessage ?? null,
        lastRotoStatusMessageRef.current,
      ].filter((part): part is string => typeof part === 'string' && part.length > 0).join(' · ');
      console.error('[PhysicsPaintStudio] auto-key promotion failed:', diagnostic);
      return { ok: false, error: ROTO_AUTO_KEY_PROMOTION_ERROR, diagnostic, ...extra };
    };
    if (!launch || source.appFrame !== launch.startFrame) {
      return fail('launch-mismatch');
    }
    if (source.selectionKind === 'real-key') {
      return fail('real-key-source');
    }

    // Quick 261022-cfn Task 1: the ONE previous-real-key resolver shared with
    // + Key. A generated/interpolated cell clones the nearest previous real
    // key's paint and joins its rail; an empty cell starts blank but still
    // joins; unusable previous-key bytes on a generated cell fail closed.
    const resolution = resolvePreviousRealKeyBase({
      records: physicPaintStore.getRotoRealKeyRecords(launch.layerId, studioActiveTrackId()),
      cachedRotoFrames: latestRotoFramesRef.current,
    }, source.appFrame);
    if (source.selectionKind === 'generated-interpolation' && resolution.kind === 'unavailable') {
      return fail('previous-key-bytes-unavailable');
    }

    let baseFrame: RenderedFramePayload;
    let baseKind: 'clone' | 'blank';
    if (source.selectionKind === 'generated-interpolation' && resolution.kind === 'clone') {
      // Relabel only appFrame; frameIndex/bytes/width/height come from the
      // cloned previous real key, never from the displayed interpolated pixels.
      baseFrame = {
        frameIndex: resolution.payload.frameIndex,
        appFrame: source.appFrame,
        bytes: resolution.payload.bytes,
        ...(resolution.payload.width !== undefined ? { width: resolution.payload.width } : {}),
        ...(resolution.payload.height !== undefined ? { height: resolution.payload.height } : {}),
      };
      baseKind = 'clone';
    } else {
      try {
        baseFrame = await buildBlankRotoFrame(canvasWidth, canvasHeight, source.appFrame);
      } catch (error) {
        return fail(`blank-frame-failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      baseKind = 'blank';
    }
    // A previous real key (cloned or unavailable-on-empty) continues its rail;
    // only the no-previous-key blank case opens a new segment.
    const joinPreviousRail = resolution.kind !== 'blank';
    const pendingEntry = pendingFirstPaintTargetRef.current;
    if (
      pendingEntry
      && pendingEntry.launchOperationId === launch.operationId
      && pendingEntry.layerId === launch.layerId
      && pendingEntry.appFrame === source.appFrame
    ) {
      // The reload suppression and the capture both read this as the frame's
      // repaint base — pin the base and its kind before the parent can accept.
      pendingEntry.blankFrame = baseFrame;
      pendingEntry.baseKind = baseKind;
    }

    let accepted: RotoPhysicalEditAcceptedOutput<EfxPaintDocument> | null;
    try {
      accepted = await dispatchAndWaitForAcceptedRotoPhysicalEdit(
        physicalEditCoordinator.pendingOperationId,
        physicalEditCoordinator.acceptedOutput,
        // Quick 260816-tv7: paint-on-empty promotion routes through addEmptyKey
        // so the new key owns a persistent incoming interpolation break
        // (broken-key contract) instead of a connected key.
        () => rotoTimelineActions.physicalKeyUtilities.addEmptyKey(
          source.appFrame,
          {
            frameIndex: baseFrame.frameIndex,
            appFrame: source.appFrame,
            bytes: baseFrame.bytes,
            ...(baseFrame.width !== undefined ? { width: baseFrame.width } : {}),
            ...(baseFrame.height !== undefined ? { height: baseFrame.height } : {}),
          },
          { joinPreviousRail },
        ),
      );
    } catch (error) {
      return fail(`dispatch-threw: ${error instanceof Error ? error.message : String(error)}`);
    }
    const currentLaunch = launchContextRef.current;
    if (!currentLaunch || currentLaunch.operationId !== launch.operationId) {
      return fail('launch-changed');
    }
    if (!accepted) return fail('no-acceptance');
    if (accepted.operationKind !== 'paste-key' || accepted.after.layerId !== launch.layerId) {
      return fail(`acceptance-shape: ${accepted.operationKind}`, {
        acceptedBefore: accepted.before,
        acceptedOperationId: accepted.operationId,
        acceptedSourceRevision: accepted.acceptedRevision,
      });
    }
    // The accepted document is the authority for "did a key land here" — the
    // live selection port can lag the acceptance, so never require
    // selectedAppFrame/selectedKeyId to agree before recognizing the key.
    const created = accepted.after.records.find((record) => record.appFrame === source.appFrame);
    const existedBefore = accepted.before.records.some((record) => record.appFrame === source.appFrame);
    if (!created || existedBefore) {
      return fail('created-key-missing', {
        acceptedBefore: accepted.before,
        acceptedOperationId: accepted.operationId,
        acceptedSourceRevision: accepted.acceptedRevision,
      });
    }
    return { ok: true, keyId: created.keyId, appFrame: created.appFrame, blankFrame: baseFrame };
  };

  // Quick 261019-mj2 Task 3 (D-16): a promotion that yields no usable key must
  // never leave orphan paint or a silent blank key. Discard the completed
  // stroke once, reset a Water color sheet, replay the accepted command's
  // `before` snapshot when the child could not validate it, and surface the
  // error on the status capsule.
  const handleRotoPaintPromotionFailure = useCallback((
    result: RotoPaintPromotionFailure,
    pending: PendingRotoFirstPaintTarget,
  ) => {
    if (pendingFirstPaintTargetRef.current === pending) pendingFirstPaintTargetRef.current = null;
    autoKeyPromotionPaintExempt.value = false;
    // D-14: a rejected/failed promotion must never leave a held acceptance in
    // the composite ledger — the key is being discarded (replayed below).
    rotoMoveHistory.cancelAutoKeyPaintGroup();
    if (pending.completedMutationObserved) {
      engineRef.current?.undo();
      if (engineRef.current?.getStrokeCount() === 0) engineRef.current?.clear();
    }
    if (activeModule.value === 'watercolor') {
      aquarelleResetSheetRef.current?.();
      aquarelleMergeBaseRef.current = null;
    }
    setApplyStatus('error');
    setApplyMessage(result.error);
    setLastError(result.diagnostic ?? result.error);
    const acceptedBefore = result.acceptedBefore;
    const acceptedOperationId = result.acceptedOperationId;
    const acceptedSourceRevision = result.acceptedSourceRevision;
    const launch = launchContextRef.current;
    if (
      acceptedBefore
      && acceptedOperationId
      && acceptedSourceRevision
      && launch
      && launch.operationId === acceptedBefore.launchOperationId
      && launch.layerId === acceptedBefore.layerId
    ) {
      // Undo replay of the just-accepted key: the parent ledger still owns the
      // command, so the replay is authorized and restores the exact before set.
      void physicalEditCoordinator.executePhysicalEdit({
        proposal: buildReplayProposal(acceptedBefore as unknown as RotoPhysicalEditSnapshot<unknown>),
        expectedLaunch: { operationId: launch.operationId, layerId: launch.layerId },
        operationKind: 'undo',
        selectedKeyId: acceptedBefore.selectedKeyId,
        selectedAppFrame: acceptedBefore.selectedAppFrame,
        replayTargetSnapshot: acceptedBefore,
        historyProvenance: {
          historyCommandId: acceptedOperationId,
          historyDirection: 'undo',
          sourceRevision: acceptedSourceRevision,
          targetRevision: snapshotRevision(acceptedBefore),
        },
      }).catch((error) => {
        console.error('[PhysicsPaintStudio] Auto-key promotion replay failed', error);
      });
    }
  }, [physicalEditCoordinator, setApplyMessage, setApplyStatus, setLastError]);

  // Starts the promotion and owns the pending entry consumed by both capture
  // paths. The promise resolves exactly once; the exemption clears on settle.
  const startRotoPaintPromotion = (input: {
    source: RotoPaintPromotionSource;
    appFrame: number;
    selectionKind: 'empty' | 'generated-interpolation';
  }): Promise<RotoPaintPromotionResult> => {
    const launch = launchContextRef.current;
    if (!launch) return Promise.resolve({ ok: false, error: ROTO_AUTO_KEY_PROMOTION_ERROR });
    let resolvePending!: (result: RotoPaintPromotionResult) => void;
    const promise = new Promise<RotoPaintPromotionResult>((resolve) => { resolvePending = resolve; });
    const pending: PendingRotoFirstPaintTarget = {
      launchOperationId: launch.operationId,
      layerId: launch.layerId,
      appFrame: input.appFrame,
      source: input.source,
      blankFrame: null,
      baseKind: 'blank',
      promise,
      completedMutationObserved: false,
    };
    pendingFirstPaintTargetRef.current = pending;
    autoKeyPromotionPaintExempt.value = true;
    void promoteRotoPaintTargetRef.current(input)
      .then(resolvePending)
      .catch(() => resolvePending({ ok: false, error: ROTO_AUTO_KEY_PROMOTION_ERROR }));
    void promise.then((result) => {
      autoKeyPromotionPaintExempt.value = false;
      if (!result.ok) {
        handleRotoPaintPromotionFailure(result, pending);
        return;
      }
      // SUCCESS: the capture paths already captured this entry by closure (they
      // await the same promise), so releasing the ref here is safe — and it is
      // REQUIRED for the Create key button, whose promotion has no stroke to
      // trigger a capture-side cleanup. A later stroke on the now-real key must
      // never await this settled promotion and merge onto its blank base.
      if (pendingFirstPaintTargetRef.current === pending) pendingFirstPaintTargetRef.current = null;
    });
    return promise;
  };

  prepareRotoScriptTargetRef.current = async (source) => {
    const launch = launchContextRef.current;
    if (
      !launch
      || source.layerId !== launch.layerId
      || source.appFrame !== launch.startFrame
    ) return null;

    if (source.selectionKind === 'real-key') {
      if (!source.keyId) return null;
      const record = physicPaintStore.getRotoRealKeyRecord(launch.layerId, studioActiveTrackId(), source.keyId);
      return record?.appFrame === source.appFrame
        ? { keyId: record.keyId, appFrame: record.appFrame }
        : null;
    }
    if (source.keyId !== null) return null;

    // Empty AND generated/interpolated cells promote through the same seam.
    // The displayed interpolated pixels are never accepted as key content.
    const promotion = await promoteRotoPaintTargetRef.current({
      appFrame: source.appFrame,
      selectionKind: source.selectionKind,
      source: 'auto-key-paint',
    });
    return promotion.ok
      ? { keyId: promotion.keyId, appFrame: promotion.appFrame }
      : null;
  };

  // JQ0 (261022-jq0): map the three existing rail-selection authorities to the
  // ONE contiguous playback RANGE consumed at Play press. The active rail set
  // wins; otherwise the single Key Rail plus EVERY selected loop id (the shared
  // dynamic-scope classifier is NOT used here — it drops multi-loop
  // selections). Range only: no per-frame hiding, no attribution, and the
  // global Solo arm (a composite-path track focus) is never read.
  const resolveRotoSelectionPlaybackWindow = useCallback((): RotoSelectionPlaybackWindow | null => {
    const members: RailSetIdentity[] = [];
    if (effectiveRailSetSelection !== null) {
      members.push(...effectiveRailSetSelection.members);
    } else {
      if (effectiveSelectedRotoKeyRail !== null) {
        members.push({ kind: 'key-rail', firstKeyId: effectiveSelectedRotoKeyRail.firstKeyId });
      }
      for (const loopId of effectiveSelectedLoopClipIds) {
        members.push({ kind: 'loop', loopId });
      }
    }
    if (members.length === 0) return null;
    const layerId = launchContext?.layerId;
    if (layerId === undefined) return null;
    const capacity = physicPaintStore.getRotoPhysicalCompositeEndFrame(layerId);
    if (capacity === null || !Number.isInteger(capacity) || capacity <= 0) return null;
    return deriveRotoSelectionPlaybackWindow({
      members,
      keyRailSegments,
      loopRanges: loopResolutionContext?.ranges ?? [],
      capacity,
    });
  }, [
    effectiveRailSetSelection,
    effectiveSelectedLoopClipIds,
    effectiveSelectedRotoKeyRail,
    keyRailSegments,
    launchContext?.layerId,
    loopResolutionContext,
  ]);

  // RARE BLANK-AFTER-PLAY guard (user report 2026-10-19): one playback session
  // ended with every key surface blank until a full Studio close/reopen.
  // Playback itself only reads; the stop transition is the single place the
  // editing surfaces take back over. Bump the paint clock so every paint
  // subscriber redraws when it lands.
  const handleRotoPlaybackPlaying = useCallback((playing: boolean) => {
    setIsPlaying(playing);
    if (playing) return;
    physicPaintVersion.value++;
  }, []);

  const rotoNavigation = useRotoNavigationCoordinator<RenderedFramePayload>({
    workflowMode,
    beforeNavigation: rotoScript.prepareNavigation,
    afterNavigation: rotoScript.completeNavigation,
    // 52.1-04 (D-10): neighbor prewarm on playhead advance — decode N+1, N+2,
    // N-1 into the single 512 MB LRU so scrub cold-misses are covered (D-03).
    prefetchNeighbors: (appFrame) => {
      if (!launchContext) return;
      const prefetchStartedAtMs = performance.now();
      prefetchNeighborFrames(launchContext.layerId, appFrame);
      recordPhysicsPaintPerformance({ stage: 'nav.prefetchNeighbors', category: 'sync-cpu', durationMs: performance.now() - prefetchStartedAtMs, timestamp: performance.now(), sourceFrame: appFrame });
    },
    keyUtilities: {
      currentFrame,
      currentKeyId: currentPhysicalCell.kind === 'real' ? currentPhysicalCell.keyId : null,
      physicalKeyUtilities: rotoTimelineActions.physicalKeyUtilities,
      getSelectedKeyIds: () => selectedKeyIds.value,
      getRotoKeyRecords: () => launchContext ? physicPaintStore.getRotoRealKeyRecords(launchContext.layerId, studioActiveTrackId()) : [],
      canvasSize: { width: canvasWidth, height: canvasHeight },
      realKeyFrames: rotoKeyRecords.flatMap((record): PhysicPaintRotoCacheFrame[] => {
        // debug studio-reopen-empty-boot: render-body twin of the launch seed.
        // A reference-only record (its bytes unresolvable at the launch door,
        // reported loudly there) is missing content — skipped here, never a
        // mid-render assertion that would crash the Studio.
        const bytes = record.payload.bytes;
        if (bytes === undefined) return [];
        return [{ ...record.payload, bytes, source: 'real-key' }];
      }),
      cachedRotoFrames: latestRotoFramesRef.current,
      dirtyFrames: dirtyRotoFramesRef.current,
      applyStatus,
      flushInFlight: false,
      buildBlankRotoFrame: async (frame): Promise<PhysicPaintRotoCacheFrame> => ({ ...(await buildBlankRotoFrame(canvasWidth, canvasHeight, frame)), source: 'real-key' }),
      setDirtyFrames: (frames) => { dirtyRotoFramesRef.current = frames; },
      syncPendingRotoFrames,
      showCachedReference: (frame) => setCachedRotoReferenceUrl(getFrameBlobUrl(frame.bytes) || null),
      clearGeneratedFrame: (frame) => { if (launchContext) physicPaintStore.removeFrameRange(launchContext.layerId, studioActiveTrackId(), frame, 1); },
      clearDeletedFrame: (frame) => { if (launchContext) physicPaintStore.removeRealRotoKeyFrame(launchContext.layerId, studioActiveTrackId(), frame); },
      setApplyMessage,
      setApplyStatus,
      setLastError,
      // Quick 261023-bxm: Duplicate settles the SOURCE key's displayed paint
      // before cloning when the record carries no inline bytes. The display
      // authority is the same cached-first lookup the canvas renders from
      // (dirty preview for a real-key frame, else the accepted render source);
      // only non-empty bytes qualify, and the keyId guard lives in the pure
      // resolver so paint belonging to another key can never be published.
      resolveDisplayedKeyPaint: (appFrame) => {
        const displayed = findCachedRotoDisplayFrame(appFrame);
        if (!displayed || !(displayed.bytes instanceof Uint8Array) || displayed.bytes.byteLength === 0) return null;
        const displayedKeyId = (displayed as { keyId?: string }).keyId;
        return {
          ...(displayedKeyId !== undefined ? { keyId: displayedKeyId } : {}),
          bytes: displayed.bytes,
          ...(displayed.width !== undefined ? { width: displayed.width } : {}),
          ...(displayed.height !== undefined ? { height: displayed.height } : {}),
        };
      },
      // The aquarelle Apply publish seam, verbatim: an explicit expectedKeyId
      // makes this a pixel settlement on the source key, not a history
      // command. A rejected settlement simply leaves the record unsettled and
      // the duplicate fails closed after the re-read.
      bakeRotoKeyPaint: async ({ keyId, appFrame, bytes, width, height }) => {
        if (!launchContext) return false;
        return rotoPersistence.upsertCachedFrame(
          { frameIndex: 0, appFrame, bytes, width, height },
          false,
          undefined,
          undefined,
          launchContext.layerId,
          undefined,
          launchContext.operationId,
          buildRotoBackgroundMetadata(settings),
          keyId,
        );
      },
      // Quick 261023-cxc: the script-aware Duplicate. Only a REAL source key
      // whose next cell is EMPTY and inside capacity is eligible — the script
      // then paints the BLANK key promoteRotoPaintTargetRef creates, so no
      // raster clone is ever involved and Move/Select can edit the duplicate.
      // Everything else returns `fallback` and the hook runs the unchanged
      // 261023-bxm settle-then-clone in the same click.
      duplicateWithScript: async ({ sourceKeyId, sourceAppFrame }) => {
        const outcome = await runRotoDuplicateWithScript(
          { sourceKeyId, sourceAppFrame },
          {
            getSource: () => {
              const source = rotoScript.source.peek();
              return source.selectionKind === 'real-key' && source.keyId !== null
                ? { keyId: source.keyId, appFrame: source.appFrame }
                : null;
            },
            getDestination: (destinationFrame) => {
              const launch = launchContextRef.current;
              if (!launch) return 'out-of-capacity';
              const kind = physicPaintStore
                .getRotoPhysicalProjection(launch.layerId, studioActiveTrackId())
                ?.cells[destinationFrame]?.kind;
              return kind === 'real' || kind === 'generated' || kind === 'empty'
                ? kind
                : 'out-of-capacity';
            },
            getCapacity: () => {
              const launch = launchContextRef.current;
              return launch ? physicPaintStore.getRotoPhysicalCapacity(launch.layerId, studioActiveTrackId()) : 0;
            },
            getModule: () => (activeModule.peek() === 'watercolor' ? 'watercolor' : 'brush'),
            getBrushStrokeCount: () => engineRef.current?.getStrokeCount() ?? 0,
            getAquarelleStrokeEventCount: (appFrame) => {
              let count = 0;
              for (const event of getAquarelleEventsForFrame(appFrame)) {
                if (!isAquarelleDryEvent(event)) count += 1;
              }
              return count;
            },
            captureBrushScript: () => {
              const engine = engineRef.current;
              if (!engine) return null;
              // normalizeLogicalBrushes is the SAME engine-strokes projection
              // every script capture uses (clones points/params, groups
              // continuations) — the duplicate starts from the authored script.
              const brushes = normalizeLogicalBrushes(engine.getStrokes());
              if (brushes.length === 0) return null;
              const launch = launchContextRef.current;
              return {
                provenance: {
                  sessionId: `roto-duplicate-${launch?.operationId ?? 'unlaunched'}`,
                  layerId: launch?.layerId ?? 'unmounted-layer',
                  sourceFrame: sourceAppFrame,
                },
                sourceFrame: sourceAppFrame,
                sourceDisplayFrame: sourceAppFrame,
                sourceRevision: 0,
                brushes,
              };
            },
            getAquarelleEvents: (appFrame) => getAquarelleEventsForFrame(appFrame),
            navigateTo: (frame) => requestDuplicateNavigationRef.current(frame),
            waitForSourceFrame: (frame) => waitForRotoDuplicateSourceFrame(rotoScript.source, {
              originFrame: sourceAppFrame,
              targetFrame: frame,
            }),
            applyBrushScript: async (script) => {
              const applied = await rotoScript.applyProvidedScript(script);
              // 261023-j5b follow-up: the decision table only reaches this
              // path for an EMPTY destination, so the promoted key is blank and
              // the applied script IS the whole frame. Adopt it as complete and
              // capture it NOW: Move (already armed by the duplicate click)
              // reads the store, not the live engine, for its handles.
              if (applied) {
                const engine = engineRef.current;
                if (engine) {
                  adoptBrushScriptFrameAsComplete(
                    rotoScript.source.peek().appFrame,
                    engine.getStrokes(),
                    engine.getFramePaintSettings() ?? engine.getPaintRenderSettings(),
                  );
                }
              }
              return applied;
            },
            applyAquarelleEvents: (events) => rotoScript.applyAquarelleTimeline(events),
            recordAquarelleScriptCopy: async (sourceFrame, destinationFrame) => {
              const engine = engineRef.current;
              const launch = launchContextRef.current;
              if (!engine || !launch) return false;
              // Fresh ids through the SAME pair the live stroke-end path uses
              // (enqueueRecordedStroke + recordAquarelleStroke): the duplicate
              // is what Move / Delete / stack-step edit, never the source.
              const recorded = copyAquarelleScriptToFrame({
                events: getAquarelleEventsForFrame(sourceFrame),
                destinationFrame,
                allocateMutationId: (stroke) => engine.enqueueRecordedStroke({
                  primary: aquarelleStrokeToPaintStroke(stroke, { width: canvasWidth, height: canvasHeight }),
                }),
                record: (mutationId, stroke) => { recordAquarelleStroke(mutationId, stroke); },
              });
              return recorded > 0;
            },
          },
        );
        if (outcome.outcome === 'aborted') {
          setApplyStatus('error');
          setApplyMessage(outcome.message);
          setLastError(outcome.message);
        }
        return outcome.outcome;
      },
    },
    playback: {
      initialSettings: initialRotoPlaybackSettings,
      // 48-06 (UAT-D): the playback range is the COMPOSITE's content extent —
      // the max end across every Paint track, never the launch track's alone
      // (a sibling track's longer rail must play in full).
      getEndFrame: () => launchContext ? physicPaintStore.getRotoPhysicalCompositeEndFrame(launchContext.layerId) : null,
      getFrame: findCachedRotoDisplayFrame,
      // D-01 (260902-cfa amendment): Play re-anchors at the shared
      // application-frame cursor — an idle seek to frame N resumes there, never
      // the range start.
      getCurrentAppFrame: () => currentFrame,
      // JQ0 (261022-jq0): the rail-selection RANGE only — resolved lazily at
      // Play press. The global Solo stays a composite-path track focus and is
      // never read here; with no rail selection (or a failed-closed
      // derivation) this returns null and Play keeps the play-from-cursor law
      // over the full composite range.
      getPlaybackWindow: () => resolveRotoSelectionPlaybackWindow(),
      onStart: (frameCount) => { rotoPlaybackFrameCount.value = frameCount; },
      onFrame: (frameIndex) => {
        rotoPlaybackFrameIndex.value = frameIndex;
      },
      setIsPlaying: handleRotoPlaybackPlaying,
    },
  });
  // Quick 261023-cxc: late-bind the Duplicate navigation port (the literal
  // above is an argument to the call, so it cannot reference the return).
  requestDuplicateNavigationRef.current = rotoNavigation.requestNavigation;
  const rotoKeyUtilities = rotoNavigation.keyUtilities;
  const rotoSession = rotoKeyUtilities.session;
  const addRotoKey = rotoKeyUtilities.addKey;
  // 43.6-08 (quick 260820-bjw): the rail-set clipboard slot lives in the
  // session clipboard union (one-slot contract). Wire the timeline-actions
  // clipboard ports to the session slot once the utilities exist; a null write
  // clears the slot without publishing (the actions hook only writes real
  // payloads, null is defensive).
  railSetClipboardReadRef.current = () => {
    const copied = rotoSession.copiedKey.value;
    return isRotoSessionCopiedRailSet(copied) ? copied.payload : null;
  };
  railSetClipboardWriteRef.current = (payload) => {
    if (payload === null) {
      rotoSession.copiedKey.value = null;
      return;
    }
    rotoKeyUtilities.copyRailSet(payload);
  };
  // Routing wrappers (43.6-08): an active rail-set scope (multi-rail set OR a
  // single rail as a set of one) routes Copy/Duplicate to the set actions;
  // Paste routes on the clipboard variant (a copied rail set pastes as a set
  // even after the set collapses). Without a rail scope / rail clipboard the
  // single-key and key-group paths stay byte-identical.
  const duplicateRotoKey = useCallback(() => {
    if (hasEffectiveRailSetScope) {
      void rotoPhysicalActions.duplicateRailSet();
      return;
    }
    rotoKeyUtilities.duplicateKey();
  }, [hasEffectiveRailSetScope, rotoPhysicalActions, rotoKeyUtilities]);
  const copyRotoFrame = useCallback(() => {
    if (hasEffectiveRailSetScope) {
      const copiedMembers = effectiveRailSetMembers;
      void rotoPhysicalActions.copyRailSet().then((ok) => {
        if (!ok) return;
        // UAT-3: persist the Copy operation result (survives the set's own
        // active-selection projection until the next gesture/operation).
        const copiedResult = buildRotoRailSetOperationResult(
          'Copied',
          resolveSetOperationIntervals(copiedMembers, keyRailSegments, loopResolutionContext?.ranges ?? []),
        );
        if (copiedResult !== null) publishOperationResult(copiedResult);
      });
      return;
    }
    rotoKeyUtilities.copyKey();
  }, [hasEffectiveRailSetScope, rotoPhysicalActions, rotoKeyUtilities, effectiveRailSetMembers, keyRailSegments, loopResolutionContext, publishOperationResult]);
  // Cut (quick 260731-9l0): enabled only when BOTH copy and delete
  // availability hold; the delete half is re-checked here so the keyboard
  // entry point enforces the same rule as the strip button.
  const cutRotoFrame = useCallback(() => {
    if (!rotoPhysicalActions.canDeleteFrame.value) {
      setApplyMessage(rotoPhysicalActions.deleteDisabledReason.value ?? 'Deleting the selected Roto keys is unavailable.');
      return;
    }
    rotoKeyUtilities.cutKey(rotoPhysicalActions.deleteRotoFrame);
  }, [rotoPhysicalActions, rotoKeyUtilities]);
  const pasteRotoFrame = useCallback(() => {
    const copied = rotoSession.copiedKey.value;
    if (isRotoSessionCopiedRailSet(copied)) {
      void rotoPhysicalActions.pasteRailSet();
      return;
    }
    rotoKeyUtilities.pasteKey();
  }, [rotoSession, rotoPhysicalActions, rotoKeyUtilities]);
  const rotoCachedPlayback = rotoNavigation.playback;
  const rotoPlaybackSettingsController = useRotoPlaybackSettingsController({
    initialContext: launchContext ? { context: launchContext, settings: initialRotoPlaybackSettings } : null,
    send: async (payload) => {
      const mode = bridgeModeRef.current === 'Unavailable'
        ? await detectPhysicsPaintBridgeMode()
        : bridgeModeRef.current;
      await sendPhysicPaintApplyPayload(payload, mode);
    },
    applyLocalSettings: rotoCachedPlayback.replaceSettings,
    setError: (message) => {
      setLastError(message);
      if (message) setApplyMessage(message);
    },
  });
  playbackSettingsRouteRef.current = {
    consumeBridgeApplyResult: rotoPlaybackSettingsController.handleApplyResult,
  };
  const setRotoPlaybackLoop = useCallback((loop: boolean) => {
    rotoCachedPlayback.setLoop(loop);
    rotoPlaybackSettingsController.enqueue(rotoCachedPlayback.getSettings());
  }, [rotoCachedPlayback, rotoPlaybackSettingsController]);
  const setRotoPlaybackFps = useCallback((fps: number) => {
    rotoCachedPlayback.updateFps(fps);
    rotoPlaybackSettingsController.enqueue(rotoCachedPlayback.getSettings());
  }, [rotoCachedPlayback, rotoPlaybackSettingsController]);
  // 52.1 (background sync on close): the documentSync push is idle-gated, so a
  // non-stroke change (e.g. a background select) can be pending when the window
  // closes. The close flush used to gate on strokes/pixels/playback only — a
  // bare document change was dropped and the main window kept the old document.
  // These refs are assigned after documentSyncDirty/pushLiveProjection are built.
  const pendingDocumentSyncRef = useRef<() => boolean>(() => false);
  // 52.2-15 (D-16, sensitivity-map rows 2 and 4): ONE flush pipeline owns both
  // Studio flush paths. The requested-flush listener and the close block hand
  // it their existing step sequences, so a close landing while a requested
  // flush is in flight JOINS that drain instead of starting a second sequence
  // and pushing the document twice (T-52.2-54). The queue port dereferences the
  // live coordinator through a ref — the hook's closures are rebuilt per render.
  const rotoPersistenceRef = useRef(rotoPersistence);
  rotoPersistenceRef.current = rotoPersistence;
  const flushPipelineRef = useRef<FlushPipeline | null>(null);
  if (flushPipelineRef.current === null) {
    flushPipelineRef.current = createFlushPipeline({
      queue: {
        drain: () => rotoPersistenceRef.current.drainLivePixelQueue(),
        interrupt: () => rotoPersistenceRef.current.interruptLivePixels(),
      },
    });
  }
  const flushPipeline = flushPipelineRef.current;
  // The pipeline never rejects (a failed drain is an outcome), so the shared
  // runner rethrows for the callers whose contract is a rejection: the facade's
  // fail-closed catch and the close hook's error path both depend on it.
  const runStudioFlush = async (steps: ReadonlyArray<FlushStep>): Promise<void> => {
    const outcome = await flushPipeline.flush({ steps });
    if (outcome.status === 'flushed') return;
    throw outcome.error ?? new Error(`Physics Paint flush did not complete (${outcome.status})`);
  };
  usePhysicsPaintCloseFlush(
    // ALWAYS flush in Roto. The aquarelle sheet's paint is invisible to the
    // engine-1 stroke counter and the live-pixel queue until it is captured; a
    // gate that misses it closes the window with the pixels never enqueued (the
    // blank key persisted). A no-op flush is cheap; a skipped one loses paint.
    // quick-261023-l35: a dirty script snapshot must also keep the window open
    // long enough to save — otherwise a close that has no pixel work destroys
    // the realm with the script never written.
    () => workflowMode === 'roto' || studioScriptSnapshot.isDirty(),
    async () => {
      // The steps and their order are unchanged; the pipeline owns the drain
      // they run inside and the outcome-to-rejection translation. Per-step
      // gates replace the old whole-chain `return`, so a dirty non-roto
      // session still reaches the snapshot save.
      await runStudioFlush([
        () => {
          if (workflowMode !== 'roto') return;
          // Brush: copyLiveAlphaCanvas composites the dry canvas PLUS the live
          // wet display. The settle capture reads after that cosmetic wet look
          // has evaporated; closing right after a stroke forced the capture
          // early and baked the fluorescent wet appearance into the cache.
          // Bake the wet layer dry first so the durable payload is the settled
          // colour the user sees once the stroke dries.
          if (activeModule.value === 'watercolor') engineRef.current?.flushPendingStrokeFinalizations();
          else engineRef.current?.forceDry();
        },
        () => {
          if (workflowMode !== 'roto') return;
          // The close path had no aquarelle capture at all: closing while the
          // sheet was wet destroyed the engine with the paint never enqueued,
          // so the durable key stayed the blank payload.
          return flushAquarellePixels(currentFrame);
        },
        () => rotoPlaybackSettingsController.flush(),
        () => flushDocumentSyncRef.current(),
        // quick-261023-l35: the per-frame brush ledger is captured only at
        // frame leave / Move entry / an explicit edit, so closing right after
        // a stroke would save a snapshot missing the CURRENT frame. Capture it
        // with the same call the frame-leave path uses, BEFORE the write.
        // Watercolor mode has its own capture step above.
        () => {
          if (activeModule.peek() === 'watercolor') return;
          flushBrushScriptFrame(
            currentFrame,
            engineRef.current?.getStrokes() ?? null,
            engineRef.current?.getFramePaintSettings() ?? engineRef.current?.getPaintRenderSettings() ?? null,
          );
        },
        // quick-261023-l35 (T-261023-l35-05): the script snapshot save runs
        // LAST and is time-bounded — a hung disk write can never hold the
        // window open. Task 3: flushNow() clears the debounce timer, waits out
        // the in-flight write and then writes once if still dirty; it never
        // rejects, and this race is the second belt.
        () => Promise.race([
          studioScriptSnapshot.flushNow(),
          new Promise<void>((resolve) => {
            window.setTimeout(resolve, STUDIO_SCRIPT_SNAPSHOT_CLOSE_BUDGET_MS);
          }),
        ]),
      ]);
    },
    // 41-05 (D-08): audio engine release runs unconditionally on close,
    // before the hasPending gate — closing the window always stops and
    // releases monitoring, even with nothing to flush.
    () => efxPaintAudioMonitor.release(),
  );
  // 41-05 (D-08): release the audio engine on Studio unmount as well — the
  // close-requested hook above covers the window-close path; this covers
  // unmount. Double-firing is absorbed by release() idempotency.
  useEffect(() => () => { efxPaintAudioMonitor.release(); }, []);
  // Header Close intent routes through getCurrentWindow().close() so the
  // onCloseRequested flush above always runs (T-36.15-06); the browser bridge
  // falls back to window.close() when the Tauri window API is unavailable.
  const handleWorkflowClose = useCallback(() => {
    void import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => getCurrentWindow().close())
      .catch(() => { window.close(); });
  }, []);
  const rotoPlayScript = useRotoPlayScriptController({
    library: rotoScriptLibrary,
    getLaunchContext: () => launchContext,
    getActiveTrackId: (layerId) => getEfxPaintDocument(layerId)?.activeTrackId ?? '',
    getSelection: () => ({
      kind: currentFrameSelectionKind,
      keyId: currentPhysicalCell.kind === 'real' ? currentPhysicalCell.keyId : null,
      appFrame: currentFrame,
    }),
    getMotion: () => launchContext ? {
      deformation: physicPaintStore.getRotoInterpolationSettings(launchContext.layerId, studioActiveTrackId()).deform,
      position: physicPaintStore.getRotoInterpolationSettings(launchContext.layerId, studioActiveTrackId()).position,
    } : { deformation: 0, position: 0 },
    // D-08R/D-18: read-only live brush-color port — setBrushColor remains the sole writer;
    // the controller only observes and snapshots settings.color at confirm time.
    getBrushColor: () => settings.color,
    getBackgroundMetadata: () => buildRotoBackgroundMetadata(settings),
    getOperationLocked: () => isPhysicalMutationLocked() || rotoScriptNavigationLocked,
    getSize: () => ({ width: canvasWidth, height: canvasHeight }),
    // 43-06: the durable Loop Clip collection the loop-edit/source-edit modes
    // and the atomic loop ops operate on (43-05 port, wired here).
    getRotoLoopClips: () => (launchContext ? physicPaintStore.getRotoPhysicalLoopClips(launchContext.layerId, studioActiveTrackId()) : PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY),
    // 43-11: opening Loop Edit reads the already-accepted child document
    // synchronously. Mutation commits still request fresh parent authority.
    getLoopEditSnapshot: (placementStart) => {
      if (!launchContext) return null;
      const document = physicPaintStore.getRotoPhysicalDocument(launchContext.layerId, studioActiveTrackId());
      const layerEndExclusive = physicPaintStore.getRotoPhysicalCapacity(launchContext.layerId, studioActiveTrackId());
      if (!document) return null;
      return {
        identities: document.realKeyRecords.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
        physicalCapacity: layerEndExclusive,
        layerEndExclusive,
        remainingCapacity: Math.max(0, layerEndExclusive - placementStart),
        interpolationEnabled: document.interpolation.enabled,
      };
    },
    getPhysicalDocument: () => (
      launchContext
        ? physicPaintStore.getRotoPhysicalDocument(launchContext.layerId, studioActiveTrackId())
        : null
    ),
    // 52-05 (G-52-3): the Reveal Photo Rail tab ports. The D-12 guard is
    // proactive — no reference → the Photo Reference modal opens directly so the
    // user places a source and returns to the Create Rail dialog. The create
    // port routes through the SAME create-reveal-rail mutation as every reveal
    // path (creation IS the first bake — D-11) and records the unified-ledger
    // undo entry by reference (CR-01).
    hasPhotoReference: () => {
      const document = launchContext ? getEfxPaintDocument(launchContext.layerId) : undefined;
      const reference = document?.photoReference;
      return Boolean(reference && reference.sourceFrameRefs.length > 0);
    },
    photoReferenceRevision: efxPaintVersion,
    openPhotoReference: () => { referenceDialogOpen.value = true; },
    createReveal: async (input) => {
      const result = await createRevealRail(input.layerId, input);
      if (result.ok) {
        if (result.descriptor) rotoMoveHistory.recordBackgroundEdit(result.descriptor);
        return { ok: true };
      }
      return { ok: false, reason: mapRevealRailRejectionReason(result.reason) };
    },
    // D-20: the script's natural duration — the progressive schedule builds the
    // drawing stroke by stroke, so one frame per brush is the natural span.
    getScriptNaturalDuration: (scriptId) => rotoScriptLibrary.rows.value.find((row) => row.id === scriptId)?.brushCount ?? null,
    executePhysicalEdit: physicalEditCoordinator.executePhysicalEdit,
    pendingOperationId: physicalEditCoordinator.pendingOperationId,
    acceptedOutput: physicalEditCoordinator.acceptedOutput,
    failureOutput: physicalEditCoordinator.failureOutput,
    stopPlayback: rotoCachedPlayback.stop,
    // 260925-iy6 UAT round 6 ("no work, no log, fail in silent"): the status
    // capsule renders `applyStatus !== 'success' ? applyMessage : null`, so a
    // message written while a prior apply left `applyStatus === 'success'` was
    // stored and then filtered out. Every log must move applyStatus too, or a
    // failure looks like a dead control.
    log: (message, isError) => { setApplyMessage(message); setApplyStatus(isError ? 'error' : 'idle'); if (isError) setLastError(message); },
  }, bridgeMode);
  // 261022-ne3/261022-o2a: the cloned Tools-popover Scripts / Living Script
  // handlers — identity-stable useCallbacks wired into the workflow memo.
  // Bodies mirror the right-panel Scripts-toolbar callbacks so both surfaces
  // behave identically; Load + Apply and Create Rail route through the picker.
  const handleSaveScript = useCallback(() => {
    void rotoScriptLibrary.saveActiveFrame();
  }, [rotoScriptLibrary]);
  // 261022-o2a: the Tools picker intent. Opening stores the intent; picking a
  // row selects that Script in the library FIRST, then runs the intent that
  // opened the picker. The `.peek()` read after `select()` is deliberate:
  // `select` writes `selectedId`, and the play controller's `disabledReason` /
  // the library's `selected` are computeds that recompute synchronously on the
  // next read. A refusal is routed to the existing error channel — the picker
  // never forces the action past a controller guard.
  const openScriptPicker = useCallback((intent: 'load-apply' | 'create-rail') => {
    scriptPickerIntent.value = intent;
  }, []);
  const closeScriptPicker = useCallback(() => {
    scriptPickerIntent.value = null;
  }, []);
  const handleScriptPickerPick = useCallback((id: string) => {
    const intent = scriptPickerIntent.peek();
    scriptPickerIntent.value = null;
    rotoScriptLibrary.select(id);
    if (intent === 'create-rail') {
      const refusal = rotoPlayScript.disabledReason.peek();
      if (refusal) {
        setLastError(refusal);
        return;
      }
      void rotoPlayScript.openConfirmation();
      return;
    }
    if (intent === 'load-apply') void handleSelectedScriptLoadAndApply();
  }, [rotoScriptLibrary, rotoPlayScript, handleSelectedScriptLoadAndApply, setLastError]);
  const handleCopyScript = useCallback(() => {
    void rotoScript.copyScript().then((success) => {
      if (success) setLastError(null);
      else {
        const message = rotoScript.error.peek()?.message;
        if (message) setLastError(message);
      }
    });
  }, [rotoScript, setLastError]);
  const clearRotoLoopSelection = useCallback(() => {
    // 261022-mne: rail-selection clears never end the session Solo — it follows
    // the active track instead. This clear is also reached by every frame-cell
    // click (handleSelectTrackFrame), which must not disarm.
    selectedLoopClipIds.value = [];
    loopSelectionAnchorId.value = null;
    selectedLoopClipId.value = null;
  }, []);
  const handleSelectRotoKeyRail = useCallback((
    selection: RotoKeyRailSelection,
    gesture: PhysicsPaintRotoSpacingSelectionGesture = 'plain',
  ) => {
    publishOperationResult(null);
    if (gesture === 'toggle' || gesture === 'range' || gesture === 'union') {
      // Modifier gestures route through the rail-set reducer (D-01): a Key Rail
      // can join, anchor, and leave the set exactly like a Loop Rail.
      // 43.6-08 (M1): a plain-selected rail seeds the set when no set is
      // active, so the first modifier gesture carries it instead of dropping it.
      const target: RailSetIdentity = { kind: 'key-rail', firstKeyId: selection.firstKeyId };
      // 43.6-10 (WR-01): the seed comes from whichever single-rail signal is
      // live — a plain click on either type nulls the other type's signal, so
      // exactly one can be live and the key-rail-first order is deterministic.
      const singleIdentity: RailSetIdentity | null = selectedRotoKeyRail.value !== null
        ? { kind: 'key-rail', firstKeyId: selectedRotoKeyRail.value.firstKeyId }
        : selectedLoopClipId.value !== null
          ? { kind: 'loop', loopId: selectedLoopClipId.value }
          : null;
      const currentSet = seedRailSetSelection(railSetSelection.peek(), singleIdentity);
      const next = updatePhysicsPaintRotoRailSetSelection(currentSet,
        orderedRailSetIdentities,
        target,
        gesture,
      );
      if (next === null) {
        clearRotoLoopSelection();
        railSetSelection.value = null;
        selectedRotoKeyRail.value = null;
        return;
      }
      clearRotoLoopSelection();
      selectedRotoKeyRail.value = null;
      selectedKeyId.value = null;
      selectedKeyIds.value = [];
      selectionAnchorKeyId.value = null;
      rotoSpacingSelection.value = null;
      if (launchContext) {
        physicPaintStore.setRotoPhysicalSelection(
          launchContext.layerId,
          studioActiveTrackId(),
          null,
          currentFrame,
        );
      }
      railSetSelection.value = next;
      return;
    }
    // Plain click collapses the set into the single-rail path (D-04).
    railSetSelection.value = null;
    clearRotoLoopSelection();
    selectedKeyId.value = null;
    selectedKeyIds.value = [];
    selectionAnchorKeyId.value = null;
    rotoSpacingSelection.value = null;
    if (launchContext) {
      physicPaintStore.setRotoPhysicalSelection(
        launchContext.layerId,
        studioActiveTrackId(),
        null,
        currentFrame,
      );
    }
    selectedRotoKeyRail.value = selection;
  }, [clearRotoLoopSelection, currentFrame, launchContext, orderedRailSetIdentities, publishOperationResult, selectedLoopClipId, selectedRotoKeyRail]);
  const handleSelectRotoLoopClip = useCallback((
    loopId: string | null,
    gesture: PhysicsPaintRotoSpacingSelectionGesture = 'plain',
  ) => {
    publishOperationResult(null);
    if (loopId === null) {
      clearRotoLoopSelection();
      railSetSelection.value = null;
      return;
    }
    if (gesture === 'toggle' || gesture === 'range' || gesture === 'union') {
      // Modifier gestures route through the rail-set reducer (D-01): the set is
      // the active scope while non-null; the single-rail signals stay clear.
      // 43.6-08 (M1): a plain-selected rail seeds the set when no set is
      // active, so the first modifier gesture carries it instead of dropping it.
      const target: RailSetIdentity = { kind: 'loop', loopId };
      // 43.6-10 (WR-01): the seed comes from whichever single-rail signal is
      // live — a plain click on either type nulls the other type's signal, so
      // exactly one can be live and the key-rail-first order is deterministic.
      const singleIdentity: RailSetIdentity | null = selectedRotoKeyRail.value !== null
        ? { kind: 'key-rail', firstKeyId: selectedRotoKeyRail.value.firstKeyId }
        : selectedLoopClipId.value !== null
          ? { kind: 'loop', loopId: selectedLoopClipId.value }
          : null;
      const currentSet = seedRailSetSelection(railSetSelection.peek(), singleIdentity);
      const next = updatePhysicsPaintRotoRailSetSelection(currentSet,
        orderedRailSetIdentities,
        target,
        gesture,
      );
      if (next === null) {
        clearRotoLoopSelection();
        railSetSelection.value = null;
        return;
      }
      clearRotoLoopSelection();
      selectedRotoKeyRail.value = null;
      selectedKeyId.value = null;
      selectedKeyIds.value = [];
      selectionAnchorKeyId.value = null;
      rotoSpacingSelection.value = null;
      if (launchContext) {
        physicPaintStore.setRotoPhysicalSelection(
          launchContext.layerId,
          studioActiveTrackId(),
          null,
          currentFrame,
        );
      }
      railSetSelection.value = next;
      return;
    }
    // Plain click collapses the set into the single-rail path (D-04).
    railSetSelection.value = null;
    const currentIds = selectedLoopClipIds.peek();
    const currentAnchor = loopSelectionAnchorId.peek();
    const currentPrimary = selectedLoopClipId.peek();
    const next = updatePhysicsPaintRotoLoopClipSelection(
      currentIds.length > 0 && currentAnchor !== null && currentPrimary !== null
        ? {
          selectedLoopClipIds: currentIds,
          anchorLoopClipId: currentAnchor,
          primaryLoopClipId: currentPrimary,
        }
        : null,
      orderedRotoLoopClipIds,
      loopId,
      gesture,
    );
    if (next === null) {
      clearRotoLoopSelection();
      return;
    }
    selectedRotoKeyRail.value = null;
    selectedKeyId.value = null;
    selectedKeyIds.value = [];
    selectionAnchorKeyId.value = null;
    rotoSpacingSelection.value = null;
    if (launchContext) {
      physicPaintStore.setRotoPhysicalSelection(
        launchContext.layerId,
        studioActiveTrackId(),
        null,
        currentFrame,
      );
    }
    selectedLoopClipIds.value = next.selectedLoopClipIds;
    loopSelectionAnchorId.value = next.anchorLoopClipId;
    selectedLoopClipId.value = next.primaryLoopClipId;
    const selectedGroup = rotoLoopClips.find((loopClip) => loopClip.loopId === next.primaryLoopClipId);
    if (selectedGroup?.scriptId && loopScriptRows.some((row) => row.id === selectedGroup.scriptId)) {
      rotoScriptLibrary.select(selectedGroup.scriptId);
      activeLinkedLoopClipId.value = selectedGroup.loopId;
    }
  }, [clearRotoLoopSelection, currentFrame, launchContext, loopScriptRows, orderedRailSetIdentities, orderedRotoLoopClipIds, publishOperationResult, rotoLoopClips, rotoScriptLibrary, selectedLoopClipId, selectedRotoKeyRail]);
  const handleOpenRotoLoopEdit = useCallback(
    (loopId: string) => {
      selectedLoopClipId.value = loopId;
      return rotoPlayScript.openLoopEdit(loopId);
    },
    [rotoPlayScript],
  );
  const handleCloseRotoLoopClip = useCallback(() => {
    clearRotoLoopSelection();
  }, [clearRotoLoopSelection]);
  const loopPresentations = useMemo(() => {
    const clipsById = new Map(rotoLoopClips.map((clip) => [clip.loopId, clip]));
    const scriptsById = new Map(loopScriptRows.map((row) => [row.id, row]));
    // 52-03 (D-12/D-13/D-24): the reveal rail's Replay disabled reason needs
    // the reference + script state the presentation cannot see on its own.
    const referencePlaced = launchContext
      ? (getEfxPaintDocument(launchContext.layerId)?.photoReference !== null)
      : undefined;
    return new Map((loopResolutionContext?.ranges ?? []).map((range) => {
      const clip = clipsById.get(range.loopId);
      const sourceScriptName = clip?.scriptId ? scriptsById.get(clip.scriptId)?.name ?? null : null;
      return [
        range.loopId,
        projectPhysicsPaintLoopClipPresentation(range, clip, sourceScriptName, {
          referencePlaced,
          scriptExists: clip?.scriptId ? scriptsById.has(clip.scriptId) : undefined,
        }),
      ] as const;
    }));
  }, [loopResolutionContext, loopScriptRows, rotoLoopClips, launchContext, efxPaintVersion.value]);
  const selectedActionId = rotoScriptLibrary.selectedId.value;
  const selectedAction = selectedActionId === null
    ? null
    : loopScriptRows.find((row) => row.id === selectedActionId) ?? null;
  const linkedRotoGroups = useMemo(
    () => getLinkedRotoGroupsForAction(rotoLoopClips, selectedActionId),
    [rotoLoopClips, selectedActionId],
  );
  const effectiveLinkedGroup = linkedRotoGroups.find((group) => group.loopId === activeLinkedLoopClipId.value)
    ?? chooseCursorRelativeLinkedGroup(linkedRotoGroups, currentFrame);
  const effectiveLinkedGroupIndex = effectiveLinkedGroup
    ? linkedRotoGroups.findIndex((group) => group.loopId === effectiveLinkedGroup.loopId)
    : -1;
  const selectedLoopClip = selectedLoopClipId.value === null
    ? null
    : loopPresentations.get(selectedLoopClipId.value) ?? null;
  const resetRotoSpacingSelectionSession = useCallback((options?: { clearClipboard?: boolean }) => {
    rotoSpacingSelection.value = null;
    selectedRotoKeyRail.value = null;
    clearRotoLoopSelection();
    rotoKeyUtilities.resetSession(options);
  }, [clearRotoLoopSelection, rotoKeyUtilities]);
  resetRotoKeySessionRef.current = resetRotoSpacingSelectionSession;
  resetRotoNavigationForLaunchRef.current = rotoNavigation.resetForLaunch;
  // 261023-h9v: ONE observed arrival seam. Every cached-pixel load records
  // whether a base actually arrived, so a later capture of this frame stays
  // PARTIAL and navigation can never replace those pixels with a script.
  // Defined BEFORE the frame-editing controller (it is wired as its loader).
  const loadReferenceObserved = useCallback(
    (frame: number, targetEngine: PreviewBackgroundEngine | null): boolean => {
      const loaded = loadCachedRotoReferenceFrame(frame, targetEngine);
      noteBrushScriptArrivalBase(frame, loaded || findCachedRotoDisplayFrame(frame) !== null);
      return loaded;
    },
    [findCachedRotoDisplayFrame, loadCachedRotoReferenceFrame],
  );
  // The frame-change effect must never reload cached pixels over a hydrated
  // baseline — the engine already holds the whole script.
  const loadReferenceForFrameEditing = useCallback(
    (frame: number, targetEngine: PreviewBackgroundEngine | null): boolean => {
      if (engineHoldsBrushScriptFrame(targetEngine, frame)) return true;
      return loadReferenceObserved(frame, targetEngine);
    },
    [loadReferenceObserved],
  );
  // Stable hydration seam for the navigation callback (identity-stable deps).
  const hydrateBrushScriptFrame = useCallback(
    (targetEngine: EfxPaintEngine, request: BrushHydrationRequest): boolean =>
      attemptBrushScriptHydration(targetEngine, request),
    [],
  );
  // 261023-h9v: the engine's deferred undo pops history WITHOUT a completed
  // mutation. Re-run the ONE completion law after a successful controller
  // undo/redo so the retained script and the Move overlay stay fresh.
  const refreshBrushScriptAfterHistory = useCallback((kind: 'undo' | 'redo') => {
    applyCompletedBrushMutation(kind, launchContextRef.current?.startFrame ?? 0, engineRef.current);
  }, []);
  const rotoFrameEditing = useRotoFrameEditingController({
    workflowMode, currentFrame, currentFrameSelectionKind,
    canvasSize: { width: canvasWidth, height: canvasHeight }, engine, launchContext,
    selectedKeyId: selectedKeyId.value,
    selectedRealKey: rotoTimelineModel.selectedRealKey.value,
    currentCell: rotoTimelineModel.currentCell.value,
    editBuffer: {
      dirtyFramesRef: dirtyRotoFramesRef, markDirty: rotoEditBuffer.markDirty,
      undoOverlay: rotoEditBuffer.undoOverlay, redoOverlay: rotoEditBuffer.redoOverlay, clearCachedOverlay: rotoEditBuffer.clearCachedOverlay,
      clearFrame: rotoEditBuffer.clearFrame, snapshotFrame: rotoEditBuffer.snapshotFrame,
    },
    session: { markLiveOverlayDirty: rotoSession.markLiveOverlayDirty, markLiveOverlayEmpty: rotoSession.markLiveOverlayEmpty },
    reference: {
      cachedReferenceUrl: cachedRotoReferenceUrl, cachedRepaintBaseFrame: cachedRotoRepaintBaseFrame,
      // Water color: engine-1 is hidden, so the DOM multiply base IS the
      // visible cached paint beneath the live sheet. Clearing it on the first
      // dirty stroke erased the key's existing paint for the whole stroke and
      // only the next clean frame-enter brought the composite back.
      clearReference: () => {
        if (activeModule.value === 'watercolor') return;
        clearCachedRotoReferenceUrl();
      },
      resetReference: resetCachedRotoReference, setReferenceUrl: setCachedRotoReferenceUrl,
      loadReferenceFrame: loadReferenceForFrameEditing,
    },
    clearCachedFrame: rotoPersistence.clearCurrentFrame,
    playback: { stop: rotoCachedPlayback.stop }, syncPendingFrames: syncPendingRotoFrames,
    status: { setApplyStatus, setApplyMessage },
    isMutationLocked: isPhysicalMutationLocked,
  });
  const beginRotoFrameEditImplRef = useRef<(event?: PointerEvent) => void>(() => {});
  // NAV FLUSH (paint-cache-empty-frame-on-key): the aquarelle layer registers a
  // synchronous flush-capture here; navigateToSyncedPhysicalFrame calls it BEFORE
  // flushLivePixels so the frame-leave capture is queued in time (the rAF poll's
  // capture runs one rAF after the flush has already drained).
  const aquarelleFlushCaptureRef = useRef<(() => void) | null>(null);
  // Quick 261019-mj2 Task 3: the aquarelle layer registers a same-frame sheet
  // reset (frame-change branch minus the lastPlayFrame update). Generated-cell
  // self-promotion calls it synchronously before dispatch.
  const clearGeneratedRotoDisplayForPaint = useCallback(() => {
    const previewEngine = engineRef.current as PreviewBackgroundEngine | null;
    previewEngine?.clearPreviewBaseImage();
    previewEngine?.resetBackground();
    previewEngine?.clear();
    aquarelleResetSheetRef.current?.();
    aquarelleMergeBaseRef.current = null;
  }, []);
  beginRotoFrameEditImplRef.current = (event?: PointerEvent) => {
    const launch = launchContextRef.current;
    const document = launch ? physicPaintStore.getRotoPhysicalDocument(launch.layerId, studioActiveTrackId()) : null;
    const paintTarget = document
      ? resolveRotoCompletedGroupPaintTarget(document, currentFrame, currentCellKeyId)
      : null;
    const isNonRealCell = currentFrameSelectionKind === 'empty'
      || currentFrameSelectionKind === 'generated-interpolation';
    if (!launch || !isNonRealCell || paintTarget?.kind === 'group-frame') {
      pendingFirstPaintTargetRef.current = null;
      rotoFrameEditing.beginFrameEdit();
      return;
    }
    if (paintTarget?.kind !== 'empty') return;
    if (workflowMode !== 'roto' || isPlaying) return;
    if (event) {
      // Never intercept: the engine's own pointerdown starts the stroke on the
      // warm canvas untouched.
      if (event.button !== 0) return;
      const target = event.target;
      if (typeof Element !== 'undefined'
        && target instanceof Element
        && target.closest('.physics-paint-reference-transform, .physics-paint-background-transform')) return;
      if (activeModule.value === 'watercolor') {
        // lift is erase-like and Dry is a separate action — neither may create
        // a key on a non-real cell.
        if (!(
          aquarelleActiveTool.value === 'brush'
          || aquarelleActiveTool.value === 'water'
          || aquarelleActiveTool.value === 'pen'
        )) return;
      } else {
        // Cmd-move / Alt-erase resolve away from paint; a selected move tool
        // never promotes either.
        const effectiveToolIsPaint = resolveEffectiveTool(settings.tool) === 'paint';
        if (!effectiveToolIsPaint) return;
      }
    }
    const pending = pendingFirstPaintTargetRef.current;
    if (
      pending
      && pending.launchOperationId === launch.operationId
      && pending.layerId === launch.layerId
      && pending.appFrame === currentFrame
    ) return;
    // Mark the frame dirty WITHOUT markCurrentFrameDirty (it refuses generated
    // frames and would reset the background we are about to clear ourselves).
    rotoEditBuffer.markDirty(currentFrame);
    rotoSession.markLiveOverlayDirty(currentFrame);
    syncPendingRotoFrames();
    if (currentFrameSelectionKind === 'generated-interpolation') clearGeneratedRotoDisplayForPaint();
    // D-14: reserve the NEXT accepted command (no pre-minted operationId) for
    // the composite auto-key undo step, immediately before dispatch.
    rotoMoveHistory.beginAutoKeyPaintGroup();
    void startRotoPaintPromotion({
      source: 'auto-key-paint',
      appFrame: currentFrame,
      selectionKind: currentFrameSelectionKind === 'generated-interpolation' ? 'generated-interpolation' : 'empty',
    });
  };
  // 261022-cfn follow-up: the single-purpose + Rail action (no dropdown) —
  // create a BLANK key that deliberately starts a NEW rail on the current
  // frame. Motion/Static/Reveal rail kinds stay in the sidebar Scripts tab's
  // Create Rail dialog. The strip greys the button on generated in-betweens and
  // linked repeats; this guard repeats the real-key check defensively.
  const handleCreateRotoKeyRail = useCallback(() => {
    const launch = launchContextRef.current;
    if (!launch || workflowMode !== 'roto' || isPlaying) return;
    if (currentFrameSelectionKind === 'real-key') return;
    const appFrame = launch.startFrame;
    void (async () => {
      try {
        const blank = await buildBlankRotoFrame(canvasWidth, canvasHeight, appFrame);
        const ok = await rotoTimelineActions.physicalKeyUtilities.addEmptyKey(
          appFrame,
          {
            frameIndex: blank.frameIndex,
            appFrame,
            bytes: blank.bytes,
            ...(blank.width !== undefined ? { width: blank.width } : {}),
            ...(blank.height !== undefined ? { height: blank.height } : {}),
          },
          { forceNewSegment: true },
        );
        if (!ok) {
          setApplyStatus('error');
          setApplyMessage('Could not create a new Roto rail key.');
        }
      } catch (error) {
        setApplyStatus('error');
        setApplyMessage('Could not create a new Roto rail key.');
        setLastError(error instanceof Error ? error.message : String(error));
      }
    })();
  }, [canvasHeight, canvasWidth, currentFrameSelectionKind, isPlaying, rotoTimelineActions, setApplyMessage, setApplyStatus, setLastError, workflowMode]);
  const beginRotoFrameEdit = useCallback((event?: PointerEvent) => {
    beginRotoFrameEditImplRef.current(event);
  }, []);
  acceptRotoScriptBrushRef.current = rotoFrameEditing.acceptScriptBrush;
  // 38-11: rotoFrameEditing's wrapper object is rebuilt per render (its inner
  // callbacks close over a per-render input literal), so callbacks that must
  // stay referentially stable reach it through a ref instead of a hook dep.
  const rotoFrameEditingRef = useRef(rotoFrameEditing);
  rotoFrameEditingRef.current = rotoFrameEditing;
  useRotoBackgroundMetadataSync({
    launchContext,
    settings,
    getActiveTrackId: readDocumentActiveTrackId,
  });
  // 38.1 D-08 link 3: playback availability without a per-render O(N) array
  // build. Equivalence with selectRotoPlaybackAvailable (some-style boolean):
  // no launch -> false; empty list -> false; all-missing -> false; mixed ->
  // true iff any frame resolves.
  // G-52-8 (FIX 2): availability is STRUCTURAL, not pixel-level. The 48-05
  // version flattened EVERY playback frame to answer it — each flatten
  // composites (and, pre-FIX-4, PNG-encoded) a photo-weight raster — 15
  // photo-weight encode storms at every Studio mount and every frame-list
  // change. The flattened raster always exists when the layer document does,
  // so document-presence over the structural frame list answers the same
  // question with zero compositing; the per-tick playback draw still flattens
  // the one frame it shows (program monitor), so no surface loses anything.
  // The memo's return shape and the selectRotoPlaybackAvailable consumer
  // contract are unchanged; recomputes only when the structural frame list or
  // launch identity changes, never on a pure Studio render.
  const rotoPlaybackFrameNumbers = rotoSession.playbackFrameNumbers.value;
  const rotoPlaybackLayerId = launchContext?.layerId ?? null;
  const rotoCachedPlaybackAvailableFrames = useMemo(() => {
    if (rotoPlaybackLayerId === null) return [];
    if (!getEfxPaintDocument(rotoPlaybackLayerId)) return [];
    return rotoPlaybackFrameNumbers.map((appFrame) => ({ appFrame, frame: true }));
  }, [rotoPlaybackLayerId, rotoPlaybackFrameNumbers]);
  const missingConditions = selectPhysicsPaintMissingConditions({
    engineReady: Boolean(engine),
    canvasMounted,
    hasLaunchContext: Boolean(launchContext),
    bridgeMode,
    applyStatus,
    isPlaying,
    rotoPlaybackActive: rotoCachedPlayback.isActive,
  });
  const readyToApply = missingConditions.length === 0;
  // 38-11: launchContext identity changes on every navigation (startFrame
  // propagation) and rotoFrameEditing is rebuilt per render — both route
  // through refs so this callback keeps a stable identity across
  // startFrame-only renders. The guards read the exact same live values.
  const clearActiveSource = useCallback(() => {
    if (isPhysicalMutationLocked() || !engine || !launchContextRef.current) return;
    if (rotoFrameEditingRef.current.clearCurrentFrame()) {
      // 261023-h9v: a USER clear drops the retained script. The completion
      // listener no longer reacts to 'clear' (engine.clear() notifies on every
      // navigation), so this is the ONE explicit drop site outside prune /
      // launch teardown. Water color owns its own record store.
      if (activeModule.peek() === 'brush') clearBrushScriptFrame(currentFrame);
      rotoScript.notifySourceRevision();
    }
  }, [currentFrame, engine, rotoScript]);
  const navigateToSyncedPhysicalFrame = useCallback(async (frame: number) => {
    if (!Number.isInteger(frame) || frame < 0) return false;
    const navigationSyncStartedAtMs = performance.now();
    const destinationKind = launchContext
      ? physicPaintStore.getRotoPhysicalProjection(launchContext.layerId, studioActiveTrackId())?.cells[frame]?.kind ?? 'none'
      : 'no-launch';
    // A new navigation resets the status capsule: the previous operation's
    // rejection/success text no longer applies once the playhead moves, so the
    // capsule falls back to the ambient frame context ("Empty frame • Frame N").
    setApplyStatus('idle');
    setApplyMessage(null);
    // 260902-cfa (D-02): a seek-while-playing navigation keeps the playback
    // timer running through the flush and re-anchors audio at the new cursor
    // (rotoCachedPlayback.seek below); an idle seek keeps the current no-op
    // stop (the monitor stop funnel is idempotent).
    const wasPlaying = rotoCachedPlayback.isActive;
    if (!wasPlaying) {
      rotoCachedPlayback.stop();
    }
    // 38.1 D-05: begin the navigation generation BEFORE any await so a newer
    // navigation started during the flush supersedes this one.
    const generation = rotoNavigationGeneration.begin();
    if (launchContext) {
      // 47 close-out: set the primary key selection SYNCHRONOUSLY, before the
      // flush — the post-flush write ran after the paint, so the first click's
      // selection was never visible (the 2-click bug) and a second click
      // superseded the first navigation. The store read is synchronous; a
      // superseded navigation re-sets it for the newer frame.
      const selectedRecord = physicPaintStore.getRotoRealKeyRecordByAppFrame(launchContext.layerId, studioActiveTrackId(), frame);
      const nextSelectedKeyId = selectedRecord?.keyId ?? null;
      if (selectedKeyId.peek() !== nextSelectedKeyId) selectedKeyId.value = nextSelectedKeyId;
      physicPaintStore.setRotoPhysicalSelection(launchContext.layerId, studioActiveTrackId(), selectedKeyId.value, frame);
      const flushFinalizationsStartedAtMs = performance.now();
      engine?.flushPendingStrokeFinalizations();
      recordPhysicsPaintPerformance({ stage: 'nav.flushStrokeFinalizations', category: 'sync-cpu', durationMs: performance.now() - flushFinalizationsStartedAtMs, timestamp: performance.now(), sourceFrame: frame });
      // 52.1 (paint-loss fix + scrub regression): snapshot the live canvas
      // SYNCHRONOUSLY before engine.clear() so the flush's produce (which runs
      // on the microtask) reuses this copy instead of re-reading the cleared
      // canvas. The canvas paint below stays in the navigation intent tick —
      // it must NOT block on the flush's encode + parent push, or the scrub
      // release settle stalls (the "image scrub no work" regression).
      const snapshotStartedAtMs = performance.now();
      // NAV FLUSH: force the aquarelle frame-leave capture BEFORE the live-pixel
      // flush — the rAF poll would queue it one rAF after scheduleRotoStartFramePropagation,
      // i.e. after this flush has already drained (the empty-frame-on-return race).
      aquarelleFlushCaptureRef.current?.();
      // 261023-g4p: retain the outgoing brush frame BEFORE engine.clear()
      // (engine-1 owns the visible brush script; navigation drops it).
      if (activeModule.peek() !== 'watercolor') {
        // 261023-j5b: the frame-leave capture carries the visit's paint globals
        // (the first-edit faithful rebake replays with them).
        flushBrushScriptFrame(
          currentFrame,
          engine ? engine.getStrokes() : null,
          engine ? engine.getFramePaintSettings() ?? engine.getPaintRenderSettings() : null,
        );
      }
      rotoPersistence.snapshotLivePixels(currentFrame);
      recordPhysicsPaintPerformance({ stage: 'nav.snapshotLivePixels', category: 'sync-cpu', durationMs: performance.now() - snapshotStartedAtMs, timestamp: performance.now(), sourceFrame: frame });
      const flushPromise = rotoPersistence.flushLivePixels(currentFrame);
      setCachedRotoReferenceUrl(null);
      const clearAndLoadStartedAtMs = performance.now();
      if (engine) {
        (engine as PreviewBackgroundEngine).clearPreviewBaseImage(true);
        (engine as PreviewBackgroundEngine).resetBackground(true);
        engine.clear();
        // 261023-j5b LAZY ATTACH: pixels FIRST, ledger SECOND. The retained
        // script is proof that the cached pixels already show this content, so
        // navigation never replays it — the attach is a silent ledger install
        // and the expensive faithful rebake belongs to the first edit. Order
        // is load-bearing: loadCachedRotoReferenceFrame() internally calls
        // engine.clear(), which would wipe an earlier attach.
        // Every refusal is fail-closed: record the arrival base and keep
        // today's pixels — a PARTIAL script must never replace them.
        const hydrationRequest: BrushHydrationRequest = {
          frame,
          destinationKind,
          brushModuleActive: activeModule.peek() !== 'watercolor',
          wasPlaying: wasPlaying || rotoCachedPlayback.isActive,
          scrubActive: scrubActiveRef.current,
        };
        const hydrationPlan = planBrushScriptHydration(hydrationRequest);
        if (hydrationPlan.hydrate) {
          const loaded = loadCachedRotoReferenceFrame(frame, engine as PreviewBackgroundEngine);
          if (hydrateBrushScriptFrame(engine, hydrationRequest)) {
            // Attach success: NO arrival-base note — the cached pixels render
            // the same script, so the entry stays COMPLETE for future visits.
            if (!loaded) {
              // No cached pixels exist anywhere for this key (a pruned or
              // never-flushed display frame): repaint the script now so the
              // frame is not blank. 261023-j5b Task 2 upgrades this stand-in
              // to rebakeStrokesFaithfully (live deposit semantics).
              engine.restoreStrokesBaseline(
                hydrationPlan.entry.groups,
                hydrationPlan.entry.paintSettings ?? null,
              );
            }
          } else {
            // The engine refused the attach (malformed groups): fall back to
            // today's observed loader semantics without loading twice.
            noteBrushScriptArrivalBase(frame, loaded || findCachedRotoDisplayFrame(frame) !== null);
          }
        } else {
          loadReferenceObserved(frame, engine as PreviewBackgroundEngine);
        }
      }
      recordPhysicsPaintPerformance({ stage: 'nav.engineClearLoad', category: 'sync-cpu', durationMs: performance.now() - clearAndLoadStartedAtMs, timestamp: performance.now(), sourceFrame: frame, branch: destinationKind });
      recordPhysicsPaintPerformance({ stage: 'nav.preAwait', category: 'sync-cpu', durationMs: performance.now() - navigationSyncStartedAtMs, timestamp: performance.now(), sourceFrame: frame, branch: destinationKind });
      try {
        await flushPromise;
      } catch {
        // studio-realm-divergence probe: the doc cursor was ALREADY written to
        // `frame` above, but this abort skips the startFrame propagation below
        // — the two cursors diverge for the rest of the session.
        setApplyStatus('error');
        setApplyMessage(`Could not save Roto frame ${currentFrame} before navigation.`);
        return false;
      }
      // 38.1 D-05: superseded navigation — a newer intent owns the canvas. The
      // paint above already happened, but a superseded navigation never
      // propagates and never repaints.
      if (!rotoNavigationGeneration.isLatest(generation)) {
        return false;
      }
      // 38.1-07: post-flush neighbor pickup — a generated destination repaints
      // once so it picks up the just-flushed neighbor key pixels. The kind
      // check reads the O(1) cached projection — never
      // getRotoPhysicalRenderSource, which would run the interpolation render.
      // 47 close-out UAT round 9: read the LIVE active track — after a track
      // switch the launch snapshot still points at the previous track.
      if (engine && physicPaintStore.getRotoPhysicalProjection(launchContext.layerId, studioActiveTrackId())?.cells[frame]?.kind === 'generated') {
        const postFlushRepaintStartedAtMs = performance.now();
        setCachedRotoReferenceUrl(null);
        (engine as PreviewBackgroundEngine).clearPreviewBaseImage(true);
        (engine as PreviewBackgroundEngine).resetBackground(true);
        engine.clear();
        loadCachedRotoReferenceFrame(frame, engine as PreviewBackgroundEngine);
        recordPhysicsPaintPerformance({ stage: 'nav.postFlushRepaint', category: 'sync-cpu', durationMs: performance.now() - postFlushRepaintStartedAtMs, timestamp: performance.now(), sourceFrame: frame });
      }
    }
    // 38.1 D-04: the startFrame update — the full-Studio-render driver via
    // currentFrame — is rAF-batched so a click burst coalesces to at most one
    // Studio render per animation frame showing the LATEST frame.
    scheduleRotoStartFramePropagation(frame);
    pendingFrameSyncRef.current = frame;
    const frameSyncStartedAtMs = performance.now();
    await sendPhysicPaintFrameSyncMessage(frame, bridgeMode);
    recordPhysicsPaintPerformance({ stage: 'nav.frameSync', category: 'async-elapsed', durationMs: performance.now() - frameSyncStartedAtMs, timestamp: performance.now(), sourceFrame: frame });
    // 260902-cfa (D-02): the single audio funnel for the seek path — active →
    // re-anchor + playAtCursor full audio seek-restart at the new cursor;
    // idle → positionedAt silent re-anchor. D-02 amendment: while the ruler
    // scrub gesture is armed, the idle case routes to scrub (audible snippet
    // through the monitor) instead of the silent seek. No other audio wiring
    // lives here.
    if (scrubActiveRef.current) {
      rotoCachedPlayback.scrub(frame);
    } else {
      rotoCachedPlayback.seek(frame);
    }
    return true;
  }, [bridgeMode, currentFrame, engine, findCachedRotoDisplayFrame, hydrateBrushScriptFrame, launchContext, loadCachedRotoReferenceFrame, loadReferenceObserved, rotoCachedPlayback, rotoNavigationGeneration, rotoPersistence, rotoKeyRecords, scheduleRotoStartFramePropagation, setCachedRotoReferenceUrl, selectedKeyId]);
  // 47-01 (TML-03): the canvas reference image is track-scoped. The document's
  // active track can change with no runtime content mutation (row click,
  // addTrack, duplicateTrack) and its visibility can flip through
  // setTrackVisible — both change the displayed frame without touching the
  // runtime content revisions. This effect re-resolves the reference for the
  // new display state (active track + hide/solo truth table); plain store
  // mutations (rename, opacity) hit the same clock but keep the display state
  // and no-op. The mount run no-ops on the engine: the engine-ready path loads
  // the current frame through the live active track.
  const lastReferenceDisplayStateRef = useRef<string | null>(null);
  // 48-06 (UAT-A): the last track the frame-indexed edit state was built for.
  const lastEditStateTrackIdRef = useRef<string | null>(null);
  useEffect(() => {
    const lc = launchContextRef.current;
    if (!lc?.layerId) return;
    const trackId = studioActiveTrackId();
    if (!trackId) return;
    const visible = resolvePhysicPaintTrackVisibility(lc.layerId, trackId);
    const displayState = `${trackId}:${visible ? 'visible' : 'hidden'}`;
    if (displayState === lastReferenceDisplayStateRef.current) return;
    lastReferenceDisplayStateRef.current = displayState;
    // 48-06 (UAT-A): the frame-indexed edit state (frameStates, preview/captured/
    // confirmed frames, dirty/editable sets, live-overlay counts, cached repaint
    // base) holds TRACK-scoped content in studio-wide buffers. An in-place
    // active-track switch (row click, cross-track click, add, duplicate) must
    // reset it exactly like a launch replacement does — otherwise the next
    // physical edit's ownership rebuild reads the previous track's frames as
    // unowned and fails closed ("Frame-indexed child state is not completely
    // owned by the pre-state real-key identities"), and the failed edit's
    // recovery lease then disables every paint tool. A visibility flip of the
    // SAME track keeps the buffers (same content authority, same track).
    if (lastEditStateTrackIdRef.current !== trackId) {
      const hadPreviousTrack = lastEditStateTrackIdRef.current !== null;
      lastEditStateTrackIdRef.current = trackId;
      if (hadPreviousTrack) {
        // quick-261023-l35 Task 3 (T-261023-l35-03/-07): the outgoing
        // track's script is captured and SAVED BEFORE any reset — without
        // this, the module stores would hold the outgoing track's strokes
        // and the next save would write them under the incoming key, the
        // exact cross-track mix the brief forbids.
        aquarelleFlushCaptureRef.current?.();
        const outgoingEngine = engineRef.current;
        flushBrushScriptFrame(
          currentFrame,
          outgoingEngine?.getStrokes() ?? null,
          outgoingEngine?.getFramePaintSettings() ?? outgoingEngine?.getPaintRenderSettings() ?? null,
        );
        void studioScriptSnapshot.saveNow();
        rotoEditBuffer.resetForLaunch();
        rotoPersistence.confirmedFramesRef.current = new Map();
        rotoEditableFramesRef.current = [];
        cachedRotoReferenceUrlRef.current = null;
        cachedRotoRepaintBaseFrameRef.current = null;
        setCachedRotoRepaintBaseFrame(null);
        // 261023-h9v: the brush script is track-scoped session content — a
        // cross-track switch must drop it fail-closed so no previous-track
        // entry can hydrate or draw outlines on the new track.
        resetBrushScriptStore();
        // quick-261023-l35: the watercolor timeline is track-scoped too.
        resetAquarelleRecordState();
        // Bind the incoming key and restore it. Never awaited: this effect is
        // synchronous, and the controller's generation guard — bumped by every
        // bind — discards an earlier in-flight decode on a rapid double
        // switch. The incoming restore prunes to the incoming track's
        // getRotoRealKeyRecords frames.
        const incomingProjectId = lc.project?.projectId ?? '';
        if (incomingProjectId) {
          const incomingIdentity: StudioScriptSnapshotIdentity = {
            projectId: incomingProjectId,
            layerId: lc.layerId,
            trackId,
          };
          studioScriptSnapshotIdentityRef.current = incomingIdentity;
          studioScriptSnapshot.bind(incomingIdentity);
          void studioScriptSnapshot.restore().then((restored) => {
            if (restored.maxRestoredMutationId <= 0) return;
            const nextMutationId = Math.max(
              studioScriptSnapshotReservedNextMutationIdRef.current,
              restored.maxRestoredMutationId + 1,
            );
            studioScriptSnapshotReservedNextMutationIdRef.current = nextMutationId;
            engineRef.current?.reserveMutationClock(nextMutationId);
          });
        } else {
          studioScriptSnapshotIdentityRef.current = null;
          studioScriptSnapshot.bind(null);
        }
      }
    }
    const engine = engineRef.current as PreviewBackgroundEngine | null;
    setCachedRotoReferenceUrl(null);
    if (engine) {
      (engine as PreviewBackgroundEngine).clearPreviewBaseImage(true);
      engine.resetBackground(true);
      engine.clear();
    }
    // A hidden active track stays a blank canvas (hide/solo truth table); any
    // other switch reloads the current frame through the newly active track.
    // 261023-h9v: the observed loader records base presence for the frame.
    if (visible) {
      loadReferenceObserved(currentFrame, engine);
    }
    // studio-realm-divergence probe: at every real track-switch commit record
    // the armed cross-track guard, the document cursor and the launch cursor —
    // the stale-doc barrier compares exactly these two cursors, and this is
    // the ONE place they are re-synchronized on a switch.    // Re-seed the studio selection on the newly active track at the cursor —
    // the same resets the launch-replacement path applies, for an in-place
    // track switch (a stale key/rail selection must never leak across tracks).
    // 47 close-out: a cross-track click applied its selection synchronously in
    // the click handler — reseeding to the OLD cursor would overwrite it, so
    // the ref guard skips the reseed for exactly this switch commit.
    if (crossTrackSelectionPendingRef.current) {
      crossTrackSelectionPendingRef.current = false;      return;
    }
    const selectedRecord = physicPaintStore.getRotoRealKeyRecordByAppFrame(lc.layerId, trackId, currentFrame);
    const nextSelectedKeyId = selectedRecord?.keyId ?? null;
    if (selectedKeyId.peek() !== nextSelectedKeyId) selectedKeyId.value = nextSelectedKeyId;
    physicPaintStore.setRotoPhysicalSelection(lc.layerId, trackId, selectedKeyId.value, currentFrame);    selectedKeyIds.value = selectedKeyId.value === null ? [] : [selectedKeyId.value];
    selectionAnchorKeyId.value = selectedKeyId.value;
    rotoSpacingSelection.value = null;
    railSetSelection.value = null;
    selectedLoopClipId.value = null;
    selectedLoopClipIds.value = [];
    selectedRotoKeyRail.value = null;
    loopSelectionAnchorId.value = null;
    activeLinkedLoopClipId.value = null;
    // The lane's cached-frame fills are track-scoped too: the synchronous
    // guard above useRotoTimelineModel owns latestRotoFramesRef on the switch
    // render (47 close-out UAT round 9 — no one-render stale paint).
  }, [efxPaintVersion.value, currentFrame, loadReferenceObserved, setCachedRotoReferenceUrl]);
  rotoNavigation.configureRuntimePort({ navigateToSyncedFrame: navigateToSyncedPhysicalFrame });
  rotoNavigation.configureDisplayPort({
    restoreFrame: (effect) => {
      const frame = effect.restore.frame;
      // 38.1 D-03/D-04: canvas paint first within this flow; the startFrame
      // update propagates through the same rAF scheduler as navigation.
      if (engine && (effect.restore.kind === 'load-real-key' || effect.restore.kind === 'blank-real-key')) {
        // 261023-h9v: the observed loader records the arrival base for the
        // display-driven real-key loads too.
        loadReferenceObserved(frame, engine as PreviewBackgroundEngine);
        // 52.1 fresh-frame warm: after the applied base's decode+drawImage lands,
        // drain the cold surface upload in the idle so the first stroke never
        // flushes it mid-paint (the fast-chained 2nd-stroke ~380ms freeze).
        const warmThenUnlock = async () => {
          await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          (engine as unknown as { warmCanvasSurfaces?: () => void }).warmCanvasSurfaces?.();
          // Blank (just-activated) keys are cold — hold the pen so the first
          // stroke doesn't flush the fresh surfaces mid-paint (user's "+key then
          // wait" recipe for the paint-without-wait case).
          if (effect.restore.kind === 'blank-real-key') {
            setApplyMessage('Préparation du canevas…');
            warmProgress.value = 0;
            const warmStartedAt = performance.now();
            const warmTick = () => {
              const elapsed = performance.now() - warmStartedAt;
              const next = Math.min(100, Math.round((elapsed / FRESH_FRAME_WARM_MS) * 100));
              warmProgress.value = next;
              if (next < 100) requestAnimationFrame(warmTick);
            };
            requestAnimationFrame(warmTick);
            await (engine as unknown as { lockInputForWarm?: (ms: number) => Promise<void> }).lockInputForWarm?.(FRESH_FRAME_WARM_MS);
            warmProgress.value = 100;
            setApplyMessage(null);
            window.setTimeout(() => { if (warmProgress.peek() === 100) warmProgress.value = 0; }, 300);
          }
        };
        void warmThenUnlock();
      }
      else if (engine && effect.restore.kind === 'clear-blank') {
        (engine as PreviewBackgroundEngine).clearPreviewBaseImage(true);
        (engine as PreviewBackgroundEngine).resetBackground(true);
        engine.clear();
      }
      scheduleRotoStartFramePropagation(frame);
    },
    clearCanvas: (frame) => {
      if (!engine || frame !== currentFrame) return;
      (engine as PreviewBackgroundEngine).clearPreviewBaseImage(true);
      (engine as PreviewBackgroundEngine).resetBackground(true);
      engine.clear();
      // 261023-h9v: a cleared canvas and a retained script cannot both be
      // true — an explicit display clear drops the frame's script.
      clearBrushScriptFrame(frame);
    },
    navigate: navigateToSyncedPhysicalFrame,
    clearCachedReferenceFrame: rotoPersistence.removeCachedFrame,
  });
  const rotoMoveHistory = useRotoPhysicalEditHistory<EfxPaintDocument>({
    identity: launchContext ? {
      launchOperationId: launchContext.operationId,
      layerId: launchContext.layerId,
      projectContextId: launchContext.project?.contextId ?? null,
      capacity: rotoPhysicalCapacity,
      trackId: studioActiveTrackId(),
    } : null,
    availability: historyAvailability,
    coordinator: {
      executePhysicalEdit: physicalEditCoordinator.executePhysicalEdit,
      pendingOperationId: physicalEditCoordinator.pendingOperationId,
      acceptedOutput: physicalEditCoordinator.acceptedOutput,
    },
    recordsPort: {
      getRecords: (layerId) => physicPaintStore.getRotoRealKeyRecords(layerId, studioActiveTrackId()),
      getInterpolation: (layerId) => physicPaintStore.getRotoPhysicalInterpolationState(layerId, studioActiveTrackId()),
      getCapacity: (layerId) => physicPaintStore.getRotoPhysicalCapacity(layerId, studioActiveTrackId()),
      raiseCapacity: (layerId, capacity) => physicPaintStore.setRotoPhysicalCapacity(
        layerId,
        studioActiveTrackId(),
        capacity,
      ),
      getLoopClips: (layerId) => physicPaintStore.getRotoPhysicalLoopClips(layerId, studioActiveTrackId()),
      getIncomingInterpolationBreakKeyIds: (layerId) => physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(layerId, studioActiveTrackId()),
      replaceIncomingInterpolationBreakKeyIds: (layerId, keyIds) => (
        physicPaintStore.replaceRotoPhysicalIncomingInterpolationBreakKeyIds(layerId, studioActiveTrackId(), keyIds)
      ),
      replaceLoopClips: (layerId, loopClips) => physicPaintStore.replaceRotoPhysicalLoopClips(layerId, studioActiveTrackId(), loopClips),
      replaceRecords: replacePhysicalRecordsWithOwnership,
    },
    getLiveSourceSnapshot: () => {
      const liveLaunch = launchContextRef.current;
      const layerId = liveLaunch?.layerId ?? '';
      const records = layerId ? physicPaintStore.getRotoRealKeyRecords(layerId, studioActiveTrackId()) : [];
      const liveSelectedKeyId = selectedKeyId.peek();
      const selectedRecord = liveSelectedKeyId === null
        ? null
        : records.find((record) => record.keyId === liveSelectedKeyId) ?? null;
      return {
        launchOperationId: liveLaunch?.operationId ?? '',
        layerId,
        projectContextId: liveLaunch?.project?.contextId ?? null,
        records,
        groupOverrideRecords: layerId
          ? physicPaintStore.getRotoGroupOverrideRecords(layerId, studioActiveTrackId())
          : [],
        interpolation: layerId
          ? physicPaintStore.getRotoPhysicalInterpolationState(layerId, studioActiveTrackId())
          : PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED,
        loopClips: layerId
          ? physicPaintStore.getRotoPhysicalLoopClips(layerId, studioActiveTrackId())
          : PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY,
        incomingInterpolationBreakKeyIds: layerId
          ? physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(layerId, studioActiveTrackId())
          : [],
        capacity: layerId ? physicPaintStore.getRotoPhysicalCapacity(layerId, studioActiveTrackId()) : 0,
        selectedKeyId: selectedRecord?.keyId ?? null,
        selectedAppFrame: selectedRecord?.appFrame ?? null,
        currentAppFrame: liveLaunch?.startFrame ?? 0,
      };
    },
    referencedActionHistory: rotoScriptLibrary.referencedActionHistory,
    // 261022-pim: one watercolor delete + re-bake is one ledger command. The
    // snapshot swap is revision-authoritative (a newer script mutation fails
    // closed), and the re-bake runs through the SAME shared Apply path.
    aquarelleScriptHistory: {
      replay: async (editId, direction) => {
        const revert = restoreAquarelleEditSnapshot(editId, direction);
        if (revert === null) return false;
        const playFrame = launchContextRef.current?.startFrame ?? 0;
        aquarelleResetSheetRef.current?.();
        const ok = await rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame));
        if (!ok) {
          restoreAquarelleSnapshotRaw(revert);
          return false;
        }
        rotoScript.notifySourceRevision();
        return true;
      },
    },
    // 261023-h9v: after a successful controller undo/redo, refresh the
    // retained brush script — the deferred undo path emits no completion.
    undoPaint: () => {
      const undone = rotoFrameEditing.undo();
      if (undone) refreshBrushScriptAfterHistory('undo');
      return undone;
    },
    redoPaint: () => {
      const redone = rotoFrameEditing.redo();
      if (redone) refreshBrushScriptAfterHistory('redo');
      return redone;
    },
  });

  // 38-11: the history hook returns a fresh wrapper object per render, but
  // its inner undo/redo callbacks are stable (useCallback over the stable
  // publishAvailability). Depending on the inner callbacks keeps these
  // wrappers referentially stable across startFrame-only renders; behavior
  // is byte-identical.
  const rotoMoveHistoryUndo = rotoMoveHistory.undo;
  const rotoMoveHistoryRedo = rotoMoveHistory.redo;
  const undo = useCallback(async () => {
    const changed = await rotoMoveHistoryUndo();
    if (changed) rotoScript.notifySourceRevision();
    return changed;
  }, [rotoMoveHistoryUndo, rotoScript]);
  const redo = useCallback(async () => {
    const changed = await rotoMoveHistoryRedo();
    if (changed) rotoScript.notifySourceRevision();
    return changed;
  }, [rotoMoveHistoryRedo, rotoScript]);

  // 52.1 (undo/redo shortcut): Cmd+Z / Cmd+Shift+Z are intercepted by the native
  // macOS menu at the Cocoa layer and emitted as menu:undo / menu:redo events —
  // the Studio's onKeyDown never sees them. Listen for those events and route to
  // the Studio's own undo/redo, gated on document.hasFocus() so the main window's
  // listener (which also receives the broadcast) never double-fires.
  useEffect(() => {
    let disposed = false;
    let unlistenUndo: (() => void) | undefined;
    let unlistenRedo: (() => void) | undefined;
    const cleanup = () => {
      unlistenUndo?.();
      unlistenRedo?.();
      unlistenUndo = undefined;
      unlistenRedo = undefined;
    };
    const install = async () => {
      try {
        const eventApi = await import('@tauri-apps/api/event');
        if (typeof eventApi.listen !== 'function') return;
        unlistenUndo = await eventApi.listen('menu:undo', () => { if (document.hasFocus()) void undo(); });
        unlistenRedo = await eventApi.listen('menu:redo', () => { if (document.hasFocus()) void redo(); });
        if (disposed) cleanup();
      } catch {
        // menu events are macOS-only; ignore elsewhere
      }
    };
    void install();
    return () => {
      disposed = true;
      cleanup();
    };
  }, [undo, redo]);

  const requestRotoFrameNavigation = rotoNavigation.requestNavigation;
  const { getStrokeMetadata } = usePhysicsPaintLaunchIntegration({
    engineRef,
    lifecycle: {
      pendingFrameSyncRef,
      pendingApplyRef,
      activeOperationIdRef,
      prepareScriptLaunchReplacement: rotoScript.prepareLaunchReplacement,
      preparePlaybackSettingsLaunchReplacement: () => rotoPlaybackSettingsController.hasPending()
        ? rotoPlaybackSettingsController.flush()
        : Promise.resolve(),
      completeScriptLaunchReplacement: rotoScript.completeLaunchReplacement,
      cancelPhysicalEditForLaunch: () => { physicalEditCoordinator.cancelPhysicalEdit('launch-replacement'); },
      disposePhysicalEditSettlement: () => { physicalEditCoordinator.cancelPhysicalEdit('disposal'); },
    },
    state: {
      setLaunchContext, setSettings, setApplyStatus, setApplyMessage, setLastError,
    },
    peekLaunchContext: () => launchContext,
    resetPersistenceForLaunch: rotoPersistence.resetForLaunch,
    resetNavigationForLaunchRef: resetRotoNavigationForLaunchRef,
    hydratePlaybackSettingsForLaunch: rotoPlaybackSettingsController.hydrateForLaunch,
    resetCachedReference: resetCachedRotoReference,
    loadCachedReferenceFrame: (frame, readyEngine) => { loadCachedRotoReferenceFrame(frame, readyEngine ?? null); },
    onSettledLaunchContext: (context) => {
      // quick-261023-o3n: every settled project-context republish is the
      // save-as / rebind seam — refresh the live capability BEFORE the script
      // library consumes the context, so the NEXT snapshot write targets the
      // new package instead of the previous one.
      studioScriptSnapshotAuthorityRef.current = context.project?.scriptLibraryAuthority ?? null;
      void rotoScriptLibrary.updateProjectContext(context);
    },
    // quick-261023-l35/o3n: restore the Studio script BEFORE the launch context
    // is published, so the first frame render already sees the restored
    // timeline instead of flashing an empty script. The package copy is read
    // first through the authority; the app cache is only the missing-copy
    // fallback. Awaited by the launch integration; never rejects.
    restoreStudioScriptSnapshot: async (context, document) => {
      // The incoming settled context is the only correct authority source
      // here: `launchContextRef` still holds the PREVIOUS launch context at
      // this moment. Set BEFORE the identity guard and the restore.
      studioScriptSnapshotAuthorityRef.current = context.project?.scriptLibraryAuthority ?? null;
      const carriedTrackId = (document as { activeTrackId?: unknown } | null | undefined)?.activeTrackId;
      const projectId = context.project?.projectId ?? '';
      const layerId = context.layerId ?? '';
      const trackId = typeof carriedTrackId === 'string' ? carriedTrackId : '';
      if (!projectId || !layerId || !trackId) {
        // No durable project identity (legacy parse tolerance) or no active
        // track: the launch cannot key a cache. Bind nothing rather than
        // guess a key — a wrong key would mix projects or layers.
        studioScriptSnapshotIdentityRef.current = null;
        studioScriptSnapshot.bind(null);
        return;
      }
      const identity: StudioScriptSnapshotIdentity = { projectId, layerId, trackId };
      studioScriptSnapshotIdentityRef.current = identity;
      studioScriptSnapshot.bind(identity);
      const restored = await studioScriptSnapshot.restore();
      if (restored.maxRestoredMutationId > 0) {
        const nextMutationId = Math.max(
          studioScriptSnapshotReservedNextMutationIdRef.current,
          restored.maxRestoredMutationId + 1,
        );
        studioScriptSnapshotReservedNextMutationIdRef.current = nextMutationId;
        // The engine usually does not exist yet at launch restore; the
        // engine-ready seam re-applies this reservation.
        engineRef.current?.reserveMutationClock(nextMutationId);
      }
    },
  });
  usePhysicsPaintWorkflowIntegration({
    session: {
      engine, canvasSize: { width: canvasWidth, height: canvasHeight }, launchContext, currentFrame,
      setLaunchContext, setApplyStatus, setApplyMessage, setLastError,
      isMutationLocked: isPhysicalMutationLocked,
    },
  });
  physicalEditCoordinatorRouteRef.current = {
    consumeBridgeApplyResult: (detail) => {
      const transition = physicalEditCoordinator.consumeBridgeApplyResult(detail);
      const accepted = physicalEditCoordinator.acceptedOutput.peek();
      try {
        if (transition === 'accepted' && accepted) {
          // D-17 post-acceptance selection aftermath: group-aware kinds keep
          // the set (move re-anchors to the grabbed key; force-spacing keyIds
          // survive retiming; paste-key-group selects the pasted set with the
          // earliest pasted key as anchor); group delete and every other kind
          // collapse to the accepted selectedKeyId.
          // acceptedAddedKeyIds derives ONLY from the accepted before/after
          // record keyId diff (38-DOWNSTREAM-PARITY — no store/session reads);
          // after.records is appFrame-sorted by resolver contract, so the list
          // is ordered earliest-first with no additional sort.
          const beforeKeyIds = new Set(accepted.before.records.map((record) => record.keyId));
          const acceptedAddedKeyIds = accepted.after.records
            .filter((record) => !beforeKeyIds.has(record.keyId))
            .map((record) => record.keyId);
          const nextSelection = resolvePostAcceptanceRotoStudioSelection({
            selectedLoopClipIds: selectedLoopClipIds.peek(),
            selectedLoopClipId: selectedLoopClipId.peek(),
            operationKind: accepted.operationKind,
            acceptedSelectedKeyId: accepted.after.selectedKeyId,
            keySelection: { selectedKeyIds: selectedKeyIds.peek(), anchorKeyId: selectionAnchorKeyId.peek() },
            currentKeyId: accepted.after.selectedKeyId,
            acceptedAddedKeyIds,
          });
          selectedLoopClipIds.value = nextSelection.selectedLoopClipIds;
          selectedLoopClipId.value = nextSelection.selectedLoopClipId;
          selectedKeyIds.value = nextSelection.keySelection.selectedKeyIds;
          selectionAnchorKeyId.value = nextSelection.keySelection.anchorKeyId;
        }
        if (transition === 'accepted' && accepted) {
          // 43.6-03 D-06/RSET-03: the rail-set aftermath. The pre-command set is
          // recorded keyed by the accepted operationId BEFORE the resolver runs,
          // so undo/redo can restore the exact before/after set (identities are
          // move-stable, so before and after are the same identity list);
          // 'move-rails' keeps the current set, 'delete-rails' clears it (and
          // records an EMPTY after set so redo clears it again — D-06), and
          // every other kind leaves it unchanged (Pitfall 6 — reconcile stays
          // the stale authority). Undo/redo lookups use the ORIGINAL command id
          // from the replay provenance, never the replay command's own id.
          // 43.6-08 (quick 260820-bjw): 'paste' records the AFTER set built from
          // the accepted impact's ordered fresh identities (anchor = first pasted
          // rail), so undo restores the pre-paste set and redo re-selects the
          // pasted set.
          const beforeSet = railSetSelection.peek();
          const pastedSet = accepted.semanticDelta?.kind === 'paste'
            ? buildPastedRailSetFromImpact(accepted.semanticDelta.identities)
            : null;
          // UAT-3: publish the persisted operation-result line. The operation's
          // own selection aftermath (below) must not clobber it — it only lands in
          // the dedicated operationResult slot, cleared by a NEW explicit gesture.
          if (accepted.semanticDelta?.kind === 'paste') {
            const pastedResult = buildRotoRailSetOperationResult(
              accepted.semanticDelta.placementMode === 'duplicate' ? 'Duplicated' : 'Pasted',
              accepted.semanticDelta.identities.map((identity) => ({
                kind: identity.kind,
                firstFrame: identity.firstFrame,
                effectiveEndExclusive: identity.effectiveEndExclusive,
              })),
            );
            if (pastedResult !== null) publishOperationResult(pastedResult);
          } else if (accepted.semanticDelta?.kind === 'delete-rails') {
            const deletedResult = buildRotoRailSetOperationResult(
              'Deleted',
              resolveDeleteOperationIntervals(accepted.semanticDelta.members, accepted.before),
            );
            if (deletedResult !== null) publishOperationResult(deletedResult);
          } else {
            // Any other accepted operation (move/insert/delete-key/undo/redo) is
            // a new operation: it replaces the persisted result (the capsule falls
            // back to its selection echo).
            publishOperationResult(null);
          }
          recordRailSetSnapshot(
            accepted.operationId,
            beforeSet,
            accepted.operationKind === 'delete-rails' ? null : pastedSet ?? beforeSet,
          );
          railSetSelection.value = resolveRailSetPostAcceptance({
            operationKind: accepted.operationKind,
            operationId: accepted.historyProvenance?.historyCommandId ?? accepted.operationId,
            current: railSetSelection.peek(),
          });
          // UAT-4 (Defect 2): the pasted set becomes the ACTIVE selection, so the
          // pre-paste single-rail/key selection signals must clear. Otherwise the
          // original rail stays painted selected alongside the pasted set
          // (selection paint must always equal the selection model), and the live
          // selection no longer matches the recorded replay snapshot.
          if (accepted.operationKind === 'paste' || accepted.operationKind === 'delete-rails') {
            selectedRotoKeyRail.value = null;
            selectedKeyId.value = null;
            selectedKeyIds.value = [];
            selectionAnchorKeyId.value = null;
            selectedLoopClipId.value = null;
            selectedLoopClipIds.value = [];
          }
        }
        const currentLaunch = launchContextRef.current;
        const currentEngine = engineRef.current;
        const acceptedSelectedKeyId = accepted?.after.selectedKeyId ?? null;
        const acceptedSelectedAppFrame = accepted?.after.selectedAppFrame ?? null;
        // 261019-mj2 Task 3: a direct-paint auto-key promotes a blank key WHILE
        // the stroke paints on the live canvas. When
        // that promotion is accepted, the accepted key carries NO pixels yet —
        // reloading its baked reference here would race the in-flight stroke and
        // double it on the merge base. Detect the self-promotion so the reload is
        // suppressed and the blank frame is pinned as the repaint/merge base.
        const pendingSelfPromotion = (() => {
          const pending = pendingFirstPaintTargetRef.current;
          if (pending === null) return null;
          if (pending.source !== 'auto-key-paint') return null;
          if (accepted === null || accepted === undefined) return null;
          if (accepted.operationKind !== 'paste-key') return null;
          if (accepted.operationId !== detail?.operationId) return null;
          if (acceptedSelectedAppFrame === null) return null;
          if (pending.launchOperationId !== accepted.after.launchOperationId) return null;
          if (pending.appFrame !== acceptedSelectedAppFrame) return null;
          return pending;
        })();
        const acceptedSelfPromotion = transition === 'accepted' && pendingSelfPromotion !== null;
        const createdSelectedDestination = (accepted?.operationKind === 'paste-key' || accepted?.operationKind === 'paste-key-group')
          && acceptedSelectedKeyId !== null
          && acceptedSelectedAppFrame !== null
          && !accepted.before.records.some((record) => record.keyId === acceptedSelectedKeyId)
          && accepted.after.records.some((record) => record.keyId === acceptedSelectedKeyId && record.appFrame === acceptedSelectedAppFrame);
        if (
          transition === 'accepted'
          && accepted?.operationId === detail?.operationId
          && createdSelectedDestination
          && currentLaunch?.operationId === accepted.after.launchOperationId
          && currentLaunch.layerId === accepted.after.layerId
          && currentLaunch.startFrame === acceptedSelectedAppFrame
          && currentEngine
        ) {
          if (!acceptedSelfPromotion) {
            // Synchronous (52.1): this reload is also what refreshes the cached
            // repaint base the next stroke's capture merges onto — deferring it
            // stranded the base and forced a full-frame re-encode per stroke.
            loadCachedRotoReferenceFrame(acceptedSelectedAppFrame, currentEngine as PreviewBackgroundEngine);
          } else if (pendingSelfPromotion.blankFrame !== null && acceptedSelectedAppFrame !== null) {
            setCachedRotoRepaintBaseFrame(pendingSelfPromotion.blankFrame);
            cachedRotoRepaintBaseFrameRef.current = pendingSelfPromotion.blankFrame;
            // A cloned base multiplies the opaque transmittance sheet over the
            // previous key's paint; a blank base would multiply over a
            // transparent frame and blank the capture, so it encodes the sheet
            // alone for this whole sheet session — the sheet already
            // accumulates every stroke, so the base must not advance to its
            // own commits.
            aquarelleMergeBaseRef.current = {
              appFrame: acceptedSelectedAppFrame,
              base: pendingSelfPromotion.baseKind === 'clone' ? pendingSelfPromotion.blankFrame : null,
            };
          }
        }
      } catch (error) {
        // The parent already committed: the aftermath is bookkeeping. Never let
        // it swallow the settlement ack (the finally below releases the lease)
        // or escape into the bridge listener.
        console.error('[PhysicsPaintStudio] physical settlement aftermath failed:', error);
      } finally {
        // The settlement ACK is the LAST settlement statement on EVERY path.
        // It releases the exclusive store lease; a stranded lease keeps
        // physicalMutationAvailable false, which locks the canvas stack
        // (pointer-events: none) while the key already exists.
        if (transition === 'accepted' && accepted && accepted.operationId === detail?.operationId) {
          const released = physicalEditCoordinator.acknowledgePhysicalEditSettlement(accepted.operationId, 'release');
          if (!released) {
            console.error('[PhysicsPaintStudio] physical settlement ack did not release the lease:', accepted.operationId);
          }
        }
      }
      return transition;
    },
  };
  // 47-03 Task 2: track CRUD handlers the keyboard shortcuts share with the
  // pointer paths (strip '+' button / duplicate icon). Each routes through its
  // store op fail-closed on the layer; refusals publish to the status capsule
  // (47-02 publishStatus channel) so the user sees why the timeline did not
  // change. Newly added / duplicated tracks become active so they are
  // immediately visible in the preview.
  const handleAddTrack = useCallback(() => {
    const layerId = launchContext?.layerId;
    if (!layerId) return;
    const result = addTrack(layerId);    if (result.ok) setActiveTrackId(layerId, result.trackId);
    // 47-03 Task 2: the keyboard shortcut path (Cmd/Ctrl+Shift+N) routes
    // through the same handle — failures must reach the status capsule just
    // like the strip's rename/delete rejections (47-02 publishStatus channel).
    else setApplyMessage(result.error);
  }, [launchContext?.layerId]);
  const handleDuplicateTrack = useCallback((trackId: string) => {
    const layerId = launchContext?.layerId;
    if (!layerId) return;
    const result = duplicateTrack(layerId, trackId);
    if (result.ok) setActiveTrackId(layerId, result.trackId);
    else setApplyMessage(result.error);
  }, [launchContext?.layerId]);
  // 49-06 UAT: the timeline delete path for a selected Background clip — the
  // Delete/Backspace shortcut AND the selected-rail trash button route here.
  // Mirrors the section's dialog-free D-08 delete: call the store op, clear
  // the selection on success so the Track section is reachable again.
  const handleDeleteSelectedBackgroundClip = useCallback(() => {
    const layerId = launchContext?.layerId;
    const clipId = selectedBackgroundClipId.peek();
    if (!layerId || clipId === null) return;
    const result = deleteBackgroundClip(layerId, clipId);
    if (result.ok) {
      // 49-06 UAT: the delete is one unified-ledger undo step (BKG-08, D-08) —
      // Cmd/Ctrl+Z restores the clip by reference, Cmd/Ctrl+Shift+Z re-deletes.
      if (result.descriptor) rotoMoveHistory.recordBackgroundEdit(result.descriptor);
      selectedBackgroundClipId.value = null;
      rightPanelToolTab.value = 'track';
    } else {
      setApplyMessage(result.reason === 'clip-not-found' ? "Couldn't delete the clip." : result.reason);
    }
  }, [launchContext?.layerId]);
  const handlePhysicsPaintKeyDown = usePhysicsPaintStudioKeyboard({
    state: {
      currentFrame,
      isPlaying,
      mutationLocked,
      // 43.4 defect 9: selection-gated real-key cycling activates only when a
      // real key is in the primary selection.
      hasSelectedRotoKey: selectedKeyId.value !== null,
      // 49-06 UAT: a selected Bg rail owns Delete/Backspace (selection-driven).
      hasSelectedBackgroundClip: selectedBackgroundClipId.value !== null,
      // 261008-ryq: a selected sound clip owns Delete/Backspace after the Bg
      // branch (Bg wins when both are selected) — safe: the signal declaration
      // sits above this hook call (TDZ law).
      hasSelectedSoundClip: selectedSoundId.value !== null,
    },
    savedRotoFrames: timelineSavedRotoFrames,
    actions: {
      undo,
      redo,
      // 47-03 Task 2: guarded track CRUD shortcuts — addTrack is the shared
      // pointer-path handler; duplicateTrack reads the ACTIVE track from the
      // document (the shortcut carries no trackId) and reuses the pointer-path
      // handler so both surfaces publish identically.
      addTrack: handleAddTrack,
      duplicateTrack: () => {
        const layerId = launchContext?.layerId;
        const trackId = layerId ? getEfxPaintDocument(layerId)?.activeTrackId : undefined;
        if (layerId && trackId) handleDuplicateTrack(trackId);
      },
      selectAdjacentRotoKey: (direction) => {
        const layerId = launchContext?.layerId;
        const currentKeyId = selectedKeyId.peek();
        if (!layerId || currentKeyId === null) return;
        const currentRecord = physicPaintStore.getRotoRealKeyRecord(layerId, studioActiveTrackId(), currentKeyId);
        if (!currentRecord) return;
        const adjacent = findAdjacentRealKeyFrame(
          physicPaintStore.getRotoRealKeyRecords(layerId, studioActiveTrackId()).map((record) => record.appFrame),
          currentRecord.appFrame,
          direction,
        );
        if (adjacent !== null) void requestRotoFrameNavigation(adjacent);
      },
      copyRotoKey: copyRotoFrame,
      cutRotoKey: cutRotoFrame,
      pasteRotoKey: pasteRotoFrame,
      swapFgBg: () => {
        paintStore.swapFgBg();
        setBrushColor(paintStore.foregroundColor.peek(), settings.opacity);
      },
      deleteRotoKey: rotoPhysicalActions.deleteRotoFrame,
      // 261023-g4p: both modules share ONE consume law (registered port
      // active + a selected stroke). The helpers read `.peek()` only, so the
      // Studio render body never subscribes the edition signals; false
      // everywhere else so the key/clip branches keep their bindings.
      deleteSelectedAquarelleStroke: () => deleteSelectedScriptStroke(),
      // 261022-ujp / 261023-g4p: '<' / '>' step the targeted stroke one paint
      // position through the same shared seam. Once a concrete target holds,
      // the key is consumed even when the operation is refused (physical
      // lock, end of the stack).
      stepSelectedStroke: (direction) => stepSelectedScriptStroke(direction),
      // 49-06 UAT: a selected Bg clip owns Delete/Backspace (selection-driven).
      deleteBackgroundClip: handleDeleteSelectedBackgroundClip,
      // 261008-ryq: one-shot keyboard removal of the selected sound clip —
      // MUST stay an arrow (audioModalController is declared further down and
      // is only touched at keydown time).
      removeSelectedSound: () => audioModalController.removeSelected(),
      selectAllRotoKeys,
      disarmPushTool,
      // 43.6-06 (D-04): the solo disarm layer sits between the push disarm
      // layer and selection collapse in the Escape chain.
      disarmSolo,
      // 50-05 (Task 3, D-13): Escape re-locks the reference transform from
      // anywhere in reference-transform mode. Returns true ONLY when the
      // transform was actually unlocked (one Escape handles at most one layer).
      relockReferenceTransform: () => {
        const layerId = launchContext?.layerId;
        if (!layerId) return false;
        const document = getEfxPaintDocument(layerId);
        const track = document?.photoReference;
        if (!track || track.transformLocked) return false;
        setPhotoReferenceTransformLocked(layerId, true);
        return true;
      },
      // 260922-rd4: Escape re-locks the BACKGROUND transform — chained AFTER
      // the reference relock so one Escape still consumes at most one layer
      // (Pitfall 2). Returns true ONLY when the background was actually
      // unlocked.
      relockBackgroundTransform: () => {
        const layerId = launchContext?.layerId;
        if (!layerId) return false;
        const document = getEfxPaintDocument(layerId);
        if (!document || document.background.transformLocked) return false;
        setBackgroundTransformLocked(layerId, true);
        return true;
      },
      collapseRotoSelection: () => {
        // 43.6 D-04: the rail-set is the top selection layer — one Escape
        // collapses the set without touching the key selection (Pitfall 2).
        // Chain order (43.5 one-Escape-one-layer): popover dismiss, push
        // disarm, solo disarm, set collapse, key-selection collapse. The Solo
        // layer itself lives in the keyboard dispatcher (261022-mne): a
        // pointer-driven collapse here must not end the session arm.
        if (railSetSelection.value !== null) {
          railSetSelection.value = null;
          return;
        }
        // D-02: collapse only an active multi-selection; a single-key
        // selection is already collapsed and stays untouched.
        if (selectedKeyIds.value.length <= 1) return;
        const next = collapseRotoKeySelection(selectedKeyId.peek());
        selectedKeyIds.value = next.selectedKeyIds;
        selectionAnchorKeyId.value = next.anchorKeyId;
      },
      toggleShortcuts: () => setShortcutsVisible((visible) => !visible),
      toggleRotoPlayback: rotoCachedPlayback.toggle,
      navigateRotoFrame: (frame) => { void requestRotoFrameNavigation(frame); },
      toggleOnion: () => setOnion((current) => ({ ...current, enabled: !current.enabled })),
      adjustOnionCount: (delta) => setOnion((current) => ({ ...current, count: clampOnionCount(current.count + delta) })),
    },
  });
  // 38.1 D-08 link 3: onion projection behind structural memoization — the
  // dependency array enumerates exactly its real inputs, so the projection
  // re-runs on every genuine input change (including currentFrame) but stops
  // re-running on unrelated Studio renders. What it computes is unchanged.
  const rotoOnionPreviewFrames = rotoPreviewFramesRef.current;
  const rotoOnionDirtyFrames = dirtyRotoFramesRef.current;
  // studio-onion-skinning: render sources resolve on the LIVE active track
  // (activeTrackIdForReads, a memo key) — the same authority rotoKeyRecords
  // reads. The launch snapshot's trackIdOfLaunch froze the seam at the
  // launch-time track, so after an in-Studio track switch (row click / add /
  // duplicate) every candidate failed the keyId match in rotoOnionPreview and
  // the projection dropped to []. Same rule as navigation (47 close-out: live
  // active track, never the launch snapshot).
  const onionPreviewFrames = useMemo(() => projectRotoOnionPreviewFrames({
    currentFrame,
    isPlaying,
    onion,
    realKeyRecords: rotoKeyRecords,
    getRenderSource: (appFrame) => launchContext ? physicPaintStore.getRotoPhysicalRenderSource(launchContext.layerId, activeTrackIdForReads, appFrame) : null,
    previewFrames: rotoOnionPreviewFrames,
    dirtyFrames: rotoOnionDirtyFrames,
  }), [currentFrame, isPlaying, onion, rotoKeyRecords, activeTrackIdForReads, launchContext, rotoOnionPreviewFrames, rotoOnionDirtyFrames]);
  const rotoCachedPlaybackAvailable = selectRotoPlaybackAvailable({
    workflowMode,
    hasLaunchContext: Boolean(launchContext),
    frames: rotoCachedPlaybackAvailableFrames,
  });
  const requestRotoFrameNavigationRef = useRef(requestRotoFrameNavigation);
  requestRotoFrameNavigationRef.current = requestRotoFrameNavigation;
  const rotoKeyRecordsRef = useRef(rotoKeyRecords);
  rotoKeyRecordsRef.current = rotoKeyRecords;
  // 260911-s1j: the Tools popover's mode dropdown writes every track's
  // physical interpolation state (each track's own enabled flag preserved)
  // through the same direct store op the per-row blend button uses; the old
  // active-track coordinator path and the popover's on/off toggle are retired
  // (the row button owns on/off). 260911-s1j follow-up: the dropdown itself is
  // REMOVED from the Tools popover (mode fixed on Frame duplicate — the store
  // coerces every blend state to duplicate); this handler and its wiring stay
  // retained for the re-introduction.
  const handleRotoInterpolationModeChange = useCallback((mode: PhysicPaintRotoInterpolationState['mode']) => {
    const layerId = launchContext?.layerId;
    if (!layerId) return;
    if (physicalEditCoordinator.pendingOperationId.value !== null) return;
    const document = getEfxPaintDocument(layerId);
    if (!document) return;
    for (const track of document.tracks) {
      const current = physicPaintStore.getRotoPhysicalInterpolationState(layerId, track.id);
      if (current.mode === mode) continue;
      physicPaintStore.setRotoPhysicalInterpolationState(layerId, track.id, { enabled: current.enabled, mode });
    }
  }, [launchContext?.layerId]);
  const handleSelectRotoSpacingProxy = useCallback((
    proxy: PhysicsPaintRotoSpacingProxy,
    gesture: PhysicsPaintRotoSpacingSelectionGesture,
  ) => {
    publishOperationResult(null);
    selectedRotoKeyRail.value = null;
    // 43.6 D-04: spacing selection is a key selection — it clears the set.
    railSetSelection.value = null;
    clearRotoLoopSelection();
    const current = rotoSpacingSelection.peek();
    const next = gesture === 'toggle'
      ? togglePhysicsPaintRotoSpacingProxy(current, proxy)
      : gesture === 'range'
        ? extendPhysicsPaintRotoSpacingProxyRange(current, proxy)
        : selectPhysicsPaintRotoSpacingProxyPlain(current, proxy);
    rotoSpacingSelection.value = next;
    selectedKeyIds.value = next?.selectedSourceKeyIds ?? [];
    selectionAnchorKeyId.value = next
      ? next.sourceKeyIds[next.anchorSourceIndex] ?? null
      : null;
  }, [clearRotoLoopSelection, publishOperationResult]);
  const handleClearRotoSpacingSelection = useCallback(() => {
    publishOperationResult(null);
    rotoSpacingSelection.value = null;
  }, [publishOperationResult]);
  const handleClearRotoKeySelection = useCallback(() => {
    publishOperationResult(null);
    selectedKeyIds.value = [];
    selectionAnchorKeyId.value = null;
    clearRotoLoopSelection();
  }, [clearRotoLoopSelection, publishOperationResult]);
  const handleToggleRotoKeySelection = useCallback((keyId: string) => {
    publishOperationResult(null);
    selectedRotoKeyRail.value = null;
    clearRotoLoopSelection();
    const result = toggleRotoKeySelection(
      { selectedKeyIds: selectedKeyIds.peek(), anchorKeyId: selectionAnchorKeyId.peek() },
      rotoKeyRecordsRef.current.map((record) => record.keyId),
      keyId,
      selectedKeyId.peek(),
    );
    selectedKeyIds.value = result.state.selectedKeyIds;
    selectionAnchorKeyId.value = result.state.anchorKeyId;
    selectedKeyId.value = result.currentKeyId;
  }, [clearRotoLoopSelection, publishOperationResult]);
  const handleCollapseRotoSelectionToKey = useCallback((keyId: string) => {
    publishOperationResult(null);
    selectedRotoKeyRail.value = null;
    clearRotoLoopSelection();
    const next = collapseRotoKeySelection(keyId);
    selectedKeyIds.value = next.selectedKeyIds;
    selectionAnchorKeyId.value = next.anchorKeyId;
  }, [clearRotoLoopSelection, publishOperationResult]);
  const handleExtendRotoKeySelection = useCallback((keyId: string) => {
    publishOperationResult(null);
    selectedRotoKeyRail.value = null;
    clearRotoLoopSelection();
    const result = extendRotoKeySelectionRange(
      { selectedKeyIds: selectedKeyIds.peek(), anchorKeyId: selectionAnchorKeyId.peek() ?? selectedKeyId.peek() },
      rotoKeyRecordsRef.current.map((record) => record.keyId),
      keyId,
    );
    selectedKeyIds.value = result.state.selectedKeyIds;
    selectionAnchorKeyId.value = result.state.anchorKeyId;
    if (result.currentKeyId !== null) selectedKeyId.value = result.currentKeyId;
  }, [clearRotoLoopSelection, publishOperationResult]);
  const handleRotoGroupDragRejected = useCallback((reason: string, detail: string) => {
    setApplyMessage(reason);
    console.error('[PhysicsPaintStudio] physical edit:', detail);
  }, []);
  const handleRotoKeyRailDragRejected = useCallback((reason?: string, detail?: string) => {
    const message = reason ?? 'Key Rail move unavailable.';
    setApplyMessage(message);
    console.error('[PhysicsPaintStudio] physical edit:', detail ?? message);
  }, []);
  const handleRotoPushDragRejected = useCallback((reason?: string, detail?: string) => {
    const message = reason ?? 'Push unavailable.';
    setApplyMessage(message);
    console.error('[PhysicsPaintStudio] physical edit:', detail ?? message);
  }, []);
  const handleRotoRailSetMoveRejected = useCallback((reason?: string, detail?: string) => {
    const message = reason ?? 'Rail set move unavailable.';
    setApplyMessage(message);
    console.error('[PhysicsPaintStudio] physical edit:', detail ?? message);
  }, []);
  const rotoCachedScrub = rotoCachedPlayback.scrub;
  const handleNavigateToSyncedFrame = useCallback((frame: number) => {
    // G-52-9 scrub drag-gate: while the ruler scrub gesture is armed, a seek
    // moves ONLY the playhead feed (the strip's playhead bar leaf) plus the
    // audible scrub snippet. The flush, canvas repaint, startFrame propagation
    // (the full-Studio render), selection reseed, and the main-window frame
    // sync all wait for the release settle in onScrubEnd — a mid-drag seek
    // never re-renders the Studio/strip and never touches the main timeline.
    if (scrubActiveRef.current) {
      rotoScrubFrameSignal.value = frame;
      rotoCachedScrub(frame);
      // Realtime image preview: paint the cached frame for the scrubbed cell
      // WITHOUT the save-before-leave flush (that stays on the release settle).
      // The pointer-down seek already snapshotted + flushed the origin frame's
      // paint, so this clear cannot drop it.
      loadCachedRotoReferenceFrame(frame, engineRef.current as PreviewBackgroundEngine | null);
      return;
    }
    // Non-scrub navigation clears any settled scrub feed left sticky while the
    // release-settle propagation caught up (see the startFrame effect below).
    if (rotoScrubFrameSignal.peek() !== null) rotoScrubFrameSignal.value = null;
    publishOperationResult(null);
    // I-09 belt: a refused navigation is never silent. The old `void request…`
    // dropped a resolved `false` from prepareNavigation's busy/activeApply
    // gate, so every click looked dead with no console error.
    void requestRotoFrameNavigationRef.current(frame).then((navigated) => {
      if (!navigated) {
        setApplyMessage('Frame change is busy — try again.');
      }
    });
  }, [publishOperationResult, rotoCachedScrub, rotoScrubFrameSignal, loadCachedRotoReferenceFrame]);
  // 47 close-out: ONE-click cross-track selection. Clicking a frame/key cell
  // or a rail on a NON-active row activates the track and selects the target
  // in the SAME click. The selection is applied SYNCHRONOUSLY in the click
  // handler — the deferred seam effect ran after the paint, so the first
  // click's selection was never visible (the 2-click bug). The ref guard
  // keeps the track-switch reset effect from reseeding over it.
  const handleSelectTrackFrame = useCallback((trackId: string, frame: number) => {
    const layerId = launchContext?.layerId;
    if (!layerId) return;
    // studio-realm-divergence probe: which route armed the cross-track guard,
    // and did it actually change the active track (a same-track arm is never
    // consumed until a LATER switch's display-state change).
    setActiveTrackId(layerId, trackId);
    crossTrackSelectionPendingRef.current = true;
    handleNavigateToSyncedFrame(frame);
    railSetSelection.value = null;
    clearRotoLoopSelection();
    selectedRotoKeyRail.value = null;
    rotoSpacingSelection.value = null;
    const key = physicPaintStore.getRotoRealKeyRecordByAppFrame(layerId, trackId, frame);
    selectedKeyId.value = key?.keyId ?? null;
    selectedKeyIds.value = key ? [key.keyId] : [];
    selectionAnchorKeyId.value = key?.keyId ?? null;
    physicPaintStore.setRotoPhysicalSelection(layerId, trackId, key?.keyId ?? null, frame);
  }, [clearRotoLoopSelection, handleNavigateToSyncedFrame, launchContext?.layerId, railSetSelection, rotoSpacingSelection, selectedKeyIds, selectedKeyId, selectedRotoKeyRail, selectionAnchorKeyId]);
  const handleSelectTrackRail = useCallback((trackId: string, rail: TrackRowRailSelection) => {
    const layerId = launchContext?.layerId;
    if (!layerId) return;    setActiveTrackId(layerId, trackId);
    crossTrackSelectionPendingRef.current = true;
    if (rail.kind === 'key') {
      handleSelectRotoKeyRail({ firstKeyId: rail.firstKeyId, keyIds: rail.keyIds }, 'plain');
      return;
    }
    // Loop rail: apply the plain single-rail selection directly. The canonical
    // handler validates the loopId against the ACTIVE track's loop clips, but
    // the click just switched the track — the loopId comes from this row's own
    // loop line, so it is guaranteed present on the newly active track.
    railSetSelection.value = null;
    selectedRotoKeyRail.value = null;
    selectedKeyId.value = null;
    selectedKeyIds.value = [];
    selectionAnchorKeyId.value = null;
    rotoSpacingSelection.value = null;
    if (launchContext) {
      physicPaintStore.setRotoPhysicalSelection(launchContext.layerId, trackId, null, currentFrame);
    }
    selectedLoopClipIds.value = [rail.loopId];
    loopSelectionAnchorId.value = rail.loopId;
    selectedLoopClipId.value = rail.loopId;
  }, [clearRotoLoopSelection, handleSelectRotoKeyRail, launchContext?.layerId, loopSelectionAnchorId, railSetSelection, rotoSpacingSelection, selectedKeyIds, selectedKeyId, selectedLoopClipId, selectedLoopClipIds, selectedRotoKeyRail, selectionAnchorKeyId]);
  const navigateLinkedGroup = useCallback((targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= linkedRotoGroups.length) return;
    const target = linkedRotoGroups[targetIndex];
    if (!target) return;
    handleSelectRotoLoopClip(target.loopId);
    activeLinkedLoopClipId.value = target.loopId;
    handleNavigateToSyncedFrame(target.placementStart);
  }, [handleNavigateToSyncedFrame, handleSelectRotoLoopClip, linkedRotoGroups]);
  const handlePreviousLinkedGroup = useCallback(() => {
    navigateLinkedGroup(effectiveLinkedGroupIndex - 1);
  }, [effectiveLinkedGroupIndex, navigateLinkedGroup]);
  const handleNextLinkedGroup = useCallback(() => {
    navigateLinkedGroup(effectiveLinkedGroupIndex + 1);
  }, [effectiveLinkedGroupIndex, navigateLinkedGroup]);
  const handleGoToLinkedGroup = useCallback(() => {
    navigateLinkedGroup(effectiveLinkedGroupIndex);
  }, [effectiveLinkedGroupIndex, navigateLinkedGroup]);
  const rotoNavigationActions = rotoNavigation.createNavigationActions({
    currentFrame,
    framesToApply: 1,
    savedFrames: timelineSavedRotoFrames,
    playFrames: [],
  });
  const rotoNavigationActionsRef = useRef(rotoNavigationActions);
  rotoNavigationActionsRef.current = rotoNavigationActions;
  const handleGoToFirstFrame = useCallback(() => { publishOperationResult(null); rotoNavigationActionsRef.current.goToFirstFrame(); }, [publishOperationResult]);
  const handleGoToPreviousFrame = useCallback(() => { publishOperationResult(null); rotoNavigationActionsRef.current.goToPreviousFrame(); }, [publishOperationResult]);
  const handleGoToNextFrame = useCallback(() => { publishOperationResult(null); rotoNavigationActionsRef.current.goToNextFrame(); }, [publishOperationResult]);
  const handleGoToLastFrame = useCallback(() => { publishOperationResult(null); rotoNavigationActionsRef.current.goToLastFrame(); }, [publishOperationResult]);
  // Script Motion (D-04): deform/position remain a separate store/controller
  // contract, never merged into interpolation enabled state.
  // 38-11: stable identity via launchContextRef — launchContext identity
  // changes on every navigation while the live values read are identical.
  const updatePanelMotion = useCallback((motion: { strokeDeformation: number; strokePosition: number }) => {
    const launch = launchContextRef.current;
    if (!launch) return;
    const current = physicPaintStore.getRotoInterpolationSettings(launch.layerId, studioActiveTrackId());
    physicPaintStore.setRotoInterpolationSettings(launch.layerId, studioActiveTrackId(), { ...current, deform: motion.strokeDeformation, position: motion.strokePosition });
  }, []);
  const layout = layoutPropsMemo.resolve([rightPanelCollapsed, handlePhysicsPaintKeyDown, handleSetRightPanelCollapsed], () => ({
    rightPanelCollapsed,
    onKeyDown: handlePhysicsPaintKeyDown,
    onSetRightPanelCollapsed: handleSetRightPanelCollapsed,
  }));
  // 261018-f15 C2: ONE write-through pair for Brush size + Opacity — the top
  // bar and the Paint-tab duplicate both call these routers. Routed at call
  // time (activeModule is a signal, never a memo dep).
  const handleBrushSizeChange = useCallback((value: number) => {
    if (activeModule.value === 'watercolor') setAquarelleParam('size', value);
    else setBrushSize(value);
  }, [setBrushSize]);
  const handleOpacityChange = useCallback((value: number) => {
    if (activeModule.value === 'watercolor') setAquarelleParam('load', value);
    else setBrushOpacity(value);
  }, [setBrushOpacity]);
  const topBar = topBarPropsMemo.resolve([settings.size, settings.opacity, readyToApply, staticControlsLocked, handleBrushSizeChange, handleOpacityChange], () => ({
    brushSize: settings.size,
    opacity: settings.opacity,
    ready: readyToApply,
    disabled: staticControlsLocked,
    // UI checklist row 3: one shared Size slider. In Water color mode the
    // top-bar Brush size drives aquarelleParams.size; in Brush mode it stays
    // on settings.size.
    onBrushSizeChange: handleBrushSizeChange,
    // 261017-w4x I-05 (Q3): Opacity is top-bar only for every paint mode. Same
    // call-time module router as Brush size — watercolor drives
    // aquarelleParams.load (Pigment); Brush mode drives settings.opacity.
    onOpacityChange: handleOpacityChange,
  }));
  // 38-11: the tool rail props assemble behind the identity memo — the
  // single-line deps array below enumerates exactly the values the build
  // references (38.1 onion-projection idiom); it contains no frame-derived
  // input, so a startFrame-only Studio render returns the cached object and
  // the memo-wrapped rail skips its render. Signal objects pass through by
  // identity (never .value-cached), so signal-driven updates keep flowing.
  const toolRail = toolRailPropsMemo.resolve([settings.tool, settings.physicsMode, settings.opacity, historyAvailability, engine, staticControlsLocked, selectTool, undo, redo, clearActiveSource, strokeScriptInMemory, setBrushColor], () => ({
    activeTool: settings.tool,
    physicsMode: settings.physicsMode,
    historyAvailability,
    strokeScriptInMemory,
    disabled: !engine || staticControlsLocked,
    onSelectTool: selectTool,
    onUndo: undo,
    onRedo: redo,
    onClearFrame: clearActiveSource,
    onActiveColorChanged: (color: string) => setBrushColor(color, settings.opacity),
  }));
  // 38-11: the right panel props assemble behind the identity memo — the
  // single-line deps array below enumerates exactly the values the build
  // references (38.1 onion-projection idiom); it contains no frame-derived
  // input, so a startFrame-only Studio render returns the cached object and
  // the memo-wrapped panel skips its render. playWiggle reads through the
  // memoized rotoLegacyInterpolationSettings (WR-02, b74ac80a) — never a
  // fresh per-render getRotoInterpolationSettings clone. Signal-backed
  // controllers pass through by identity so their signal subscriptions
  // (ScriptsPanel rows/busy/selection) keep flowing independent of the memo.
  // 49-06 (S5): the Background Clip section ports are identity-stable — the
  // store ops and the imageStore resolver never change, so the ref is created
  // once and the memo deps only need the selection signal (a rail click flips
  // the section through the 38-11 signal-bypasses-memo subscription).
  const backgroundClipSectionPortsRef = useRef({
    getDocument: (layerId: string) => getEfxPaintDocument(layerId) ?? undefined,
    setRepeat: (layerId: string, clipId: string, repeat: FrameLoopClipRepeat) => setBackgroundClipRepeat(layerId, clipId, repeat),
    // 49-06 (UAT round 9): the resize % control — contain-fit scale percentages.
    setScale: (layerId: string, clipId: string, scale: FrameLoopClipScale) => setBackgroundClipScale(layerId, clipId, scale),
    // 260922-rd4: the background transform lock — unlocking LOCKS the photo
    // reference (mutual exclusion: only one handle set active).
    setTransformLocked: (layerId: string, locked: boolean) => {
      const result = setBackgroundTransformLocked(layerId, locked);
      if (result.ok && !locked) setPhotoReferenceTransformLocked(layerId, true);
      return result;
    },
    deleteClip: (layerId: string, clipId: string) => {
      // 49-06 UAT: the sidebar trash delete rides the same unified-ledger
      // undo step as the Delete/Backspace shortcut (BKG-08, D-08).
      const result = deleteBackgroundClip(layerId, clipId);
      if (result.ok && result.descriptor) rotoMoveHistory.recordBackgroundEdit(result.descriptor);
      return result;
    },
    // 49-06 (UAT round 7): Replace opens the picker targeting the selected clip.
    replaceSource: (_layerId: string, clipId: string) => {
      backgroundReplaceTargetClipId.value = clipId;
      void backgroundPicker.openPicker();
    },
    resolveFilename: (sourceRef: string) => imageStore.getById(sourceRef)?.original_path,
  });
  // 261008-ryq Task 1: the sidebar Audio-tab ports (audioSectionPortsRef —
  // backgroundClipSectionPortsRef precedent). The controller instance is
  // rebuilt every render (fresh audios/selection facts), so `getController`
  // resolves it through a ref: the ports object keeps ONE identity for the
  // rightPanel memo while the arrow always yields the LATEST controller at
  // child-render time. The other members are lazy arrows too — they only run
  // on a row click / Import press, never inside the memo factory (the
  // controller, picker and reveal handlers are declared further down).
  const audioModalControllerRef = useRef<PhysicsPaintAudioController | null>(null);
  const audioSectionPortsRef = useRef<AudioSectionPorts>({
    getController: () => audioModalControllerRef.current!,
    onSelectClip: (clipId: string) => {
      // Row click does all three effects IN the handler (never a deferred
      // effect): select + reveal + open the modal on that clip.
      const controller = audioModalControllerRef.current;
      const clip = controller?.audios.find((entry) => entry.id === clipId);
      if (!controller || !clip) return;
      controller.disarmRemove();
      selectedSoundId.value = clip.id;
      revealSoundClip(clip);
      audioModalTarget.value = clip.id;
    },
    onImportRequest: (mode: 'append' | 'replace') => {
      audioImportMode.value = mode;
      void audioPicker.openPicker();
    },
  });
  // 50-UAT (modal redesign): the Photo Reference dialog ports are identity-
  // stable — the store ops and the imageStore resolver never change, so the ref
  // is created once and the dialog memo deps stay small (the dialog re-resolves
  // through efxPaintVersion on every document mutation).
  const photoReferenceSectionPortsRef = useRef({
    getDocument: (layerId: string) => getEfxPaintDocument(layerId) ?? undefined,
    setOpacity: (layerId: string, opacity: number) => setPhotoReferenceOpacity(layerId, opacity),
    // 260922-rd4 MUTUAL EXCLUSION: unlocking the reference LOCKS the
    // background at this unlock port (never deep in the component).
    setTransformLocked: (layerId: string, locked: boolean) => {
      const result = setPhotoReferenceTransformLocked(layerId, locked);
      if (result.ok && !locked) setBackgroundTransformLocked(layerId, true);
      return result;
    },
    setVisible: (layerId: string, visible: boolean) => setPhotoReferenceVisible(layerId, visible),
    clearReference: (layerId: string) => {
      const result = clearPhotoReference(layerId);
      if (result.ok && result.descriptor) rotoMoveHistory.recordBackgroundEdit(result.descriptor);
      return result;
    },
    resolveFilename: (sourceRef: string) => imageStore.getById(sourceRef)?.original_path,
  });
  // quick-261023-ors: the Memory-tab frame + ports. The frame rides a signal so
  // the tab marks the current row without adding `currentFrame` to the
  // right-panel memo deps (38-11 law); the write happens in an effect, never in
  // the render body.
  const memoryFrame = useSignal(0);
  useEffect(() => {
    memoryFrame.value = currentFrame;
  }, [currentFrame, memoryFrame]);
  // Identity-stable ports (the audioSectionPortsRef precedent): `read` resolves
  // the live engine and launch frame at call time, never captured here. The
  // purge functions are hoisted declarations below — a false return means
  // nothing was removed, never an error.
  const memorySectionPortsRef = useRef<StudioScriptMemorySectionPorts>({
    read: () => readStudioScriptMemorySnapshot({
      engine: engineRef.current,
      frame: launchContextRef.current?.startFrame ?? 0,
    }),
    purgeFrame: (frame: number) => purgeMemoryScriptFrame(frame),
    clearRail: () => clearMemoryRailScripts(),
  });
  // Second stable ref: the panel prop object never changes identity, so the
  // right-panel memo keeps returning the cached props (signal reads bypass it
  // inside RightPanelMemoryTab).
  const memorySectionRef = useRef({ ports: memorySectionPortsRef.current, frame: memoryFrame });
  // quick-261023-ors Task 2: the two confirmed purges. Both remove ONLY the
  // script (the engine's pixels and ledger are never touched), and a successful
  // purge dispatches the snapshot cleanup immediately: the controller rewrites
  // the authoritative leg with the pruned payload, then deletes the stale
  // cache fallback. A false return means nothing was removed — never an error.
  function purgeMemoryScriptFrame(frame: number): boolean {
    const removedWatercolor = purgeAquarelleFrameScript(frame);
    // Marking the brush frame purged is meaningful even when no entry existed
    // (it stops a frame-leave flush from capturing the engine's stale strokes),
    // but the return value counts only actual removals.
    const removedBrush = purgeBrushScriptFrame(frame);
    const total = removedWatercolor + (removedBrush ? 1 : 0);
    if (total === 0) return false;
    void studioScriptSnapshot.persistAfterPurge();
    return true;
  }
  function clearMemoryRailScripts(): boolean {
    const removedWatercolor = purgeAllAquarelleKeyScripts();
    const removedBrush = purgeAllBrushScriptFrames(launchContextRef.current?.startFrame ?? null);
    if (removedWatercolor + removedBrush === 0) return false;
    void studioScriptSnapshot.persistAfterPurge();
    return true;
  }
  const rightPanel = rightPanelPropsMemo.resolve([settings.tool, settings.color, settings.opacity, settings.size, settings.edgeDetail, settings.pickup, settings.spread, settings.smoothing, settings.eraseStrength, settings.physicsMode, settings.background, settings.grainStrength, settings.grainScale, onion, isPlaying, staticControlsLocked, rotoLegacyInterpolationSettings, setBrushColor, setEdgeDetail, setPickup, setSpread, setSmoothing, setEraseStrength, setOnion, updatePanelMotion, rotoScriptLibrary, rotoPlayScript, rotoScript, playButtonRef, selectedLoopClip, effectiveLinkedGroupIndex, linkedRotoGroups.length, handlePreviousLinkedGroup, handleNextLinkedGroup, handleGoToLinkedGroup, handleOpenRotoLoopEdit, handleCloseRotoLoopClip, handleScriptRowActivate, handleSelectedScriptLoadAndApply, setLastError, launchContext?.layerId, efxPaintVersion.value, setApplyMessage, selectedBackgroundClipId, backgroundClipSectionPortsRef, audioSectionPortsRef, rightPanelToolTab, handlePaperIdChange, handleBackgroundChange, handleGrainStrengthChange, handleGrainScaleChange, handleBrushSizeChange, handleOpacityChange, undo, redo, clearActiveSource, memorySectionRef], () => {
    // 47-03 TML-04: the Track section always shows the ACTIVE track — the
    // document's activeTrackId authority (not the launch track) — so a
    // row-header click re-resolves the memo through efxPaintVersion and the
    // panel re-renders to the new track's name/opacity/blend.
    const document = launchContext?.layerId ? getEfxPaintDocument(launchContext.layerId) : undefined;
    const activeTrack = document?.tracks.find((track) => track.id === document.activeTrackId);
    const commitTrackDisplay = (mutate: (layerId: string, trackId: string) => TrackMutationResult) => {
      const layerId = launchContext?.layerId;
      const trackId = layerId ? getEfxPaintDocument(layerId)?.activeTrackId : undefined;
      if (!layerId || !trackId) return;
      const result = mutate(layerId, trackId);
      if (!result.ok) setApplyMessage(result.error);
    };
    return {
    activeTool: settings.tool,
    color: settings.color,
    opacity: settings.opacity,
    // 261018-f15 C2: the Paint-tab size/opacity pair rides the same routers
    // the top bar uses — one write-through pair, never a second setter.
    brushSize: settings.size,
    onBrushSizeChange: handleBrushSizeChange,
    onOpacityChange: handleOpacityChange,
    edgeDetail: settings.edgeDetail,
    pickup: settings.pickup,
    spread: settings.spread,
    smoothing: settings.smoothing,
    eraseStrength: settings.eraseStrength,
    physicsMode: settings.physicsMode,
    onion,
    onionDisabled: isPlaying,
    engineControlsDisabled: staticControlsLocked,
    playWiggle: rotoLegacyInterpolationSettings
      ? { strokeDeformation: rotoLegacyInterpolationSettings.deform, strokePosition: rotoLegacyInterpolationSettings.position }
      : { strokeDeformation: 0, strokePosition: 0 },
    trackName: activeTrack?.name ?? 'Paint 1',
    trackOpacity: activeTrack?.opacity ?? 1,
    trackBlendMode: activeTrack?.blendMode ?? 'normal',
    onTrackOpacityChange: (opacity: number) => commitTrackDisplay((layerId, trackId) => setTrackOpacity(layerId, trackId, opacity)),
    onTrackBlendChange: (mode: BlendMode) => commitTrackDisplay((layerId, trackId) => setTrackBlend(layerId, trackId, mode)),
    // 49-06 (S5): the Background Clip section props — the selection signal is
    // read by the right panel (38-11 signal-bypasses-memo) to flip the Track
    // tab; the ports are identity-stable so the memo stays cacheable.
    backgroundClipSection: launchContext?.layerId
      ? { layerId: launchContext.layerId, selectedBackgroundClipId, ports: backgroundClipSectionPortsRef.current }
      : undefined,
    // 261008-ryq Task 1: the sidebar Audio-tab ports — identity-stable ref;
    // the factory only ever reads `.current` (getController runs at
    // child-render time, never here). efxPaintVersion is already a memo dep,
    // so a document edit re-runs the factory and the rows refresh.
    audioSectionPorts: launchContext?.layerId ? audioSectionPortsRef.current : undefined,
    // quick-261023-ors: the Memory tab ports — identity-stable ref; the tab
    // reads the live stores on its own debounce/cache interval.
    memorySection: memorySectionRef.current,
    // 49-06 (UAT round 2): the Studio-owned tool tab signal — the right panel
    // reads it (38-11 signal-bypasses-memo) so a Paint track selection returns
    // to Track option and a Bg rail selection opens the Background option tab.
    toolTab: rightPanelToolTab,
    // 56-05 (D-09..D-12) + 261017-vcn I-04 remainder: shared-panel Paper
    // section ports — paper + background + the one grain pair.
    paperId: settings.background.startsWith('paper/') ? settings.background : 'paper/cold-press',
    background: settings.background,
    grainStrength: settings.grainStrength,
    grainScale: settings.grainScale,
    onPaperIdChange: handlePaperIdChange,
    onBackgroundChange: handleBackgroundChange,
    onGrainStrengthChange: handleGrainStrengthChange,
    onGrainScaleChange: handleGrainScaleChange,
    onColorChange: (color: string, opacity: number) => {
      setBrushColor(color, opacity);
      paintStore.setForeground(color);
    },
    onEdgeDetailChange: setEdgeDetail,
    onPickupChange: setPickup,
    onSpreadChange: setSpread,
    onSmoothingChange: setSmoothing,
    onEraseStrengthChange: setEraseStrength,
    onOnionChange: setOnion,
    onPlayWiggleChange: updatePanelMotion,
    // UI checklist row 6 Actions tab: Undo | Redo | Clear frame — required by
    // PhysicsPaintRightPanel's props interface (I-09: they were missing and
    // the Actions tab buttons called undefined).
    onUndo: undo,
    onRedo: redo,
    onClearFrame: clearActiveSource,
    scripts: {
      library: rotoScriptLibrary,
      playScript: rotoPlayScript,
      rotoScript,
      playButtonRef,
      selectedLoopClip,
      linkedGroupNavigation: linkedRotoGroups.length === 0 || effectiveLinkedGroupIndex < 0
        ? null
        : {
          currentIndex: effectiveLinkedGroupIndex,
          total: linkedRotoGroups.length,
          onPrevious: handlePreviousLinkedGroup,
          onNext: handleNextLinkedGroup,
          onGoToGroup: handleGoToLinkedGroup,
        },
      onOpenLoopEdit: handleOpenRotoLoopEdit,
      onCloseLoopClip: handleCloseRotoLoopClip,
      onSave: () => { void rotoScriptLibrary.saveActiveFrame(); },
      onActivateRow: (id: string) => { void handleScriptRowActivate(id); },
      onLoadAndApply: () => { void handleSelectedScriptLoadAndApply(); },
      onRefresh: () => { void rotoScriptLibrary.refresh(); },
    },
    };
  });
  const playScriptConfirmationOpen = rotoPlayScript.confirmationOpen.value;
  const playScriptDialog = playScriptDialogPropsMemo.resolve([rotoPlayScript, playScriptConfirmationOpen, playButtonRef, settings.color], () => ({
    playScript: rotoPlayScript,
    confirmationOpen: playScriptConfirmationOpen,
    // D-08R: live brush color prop — the dialog re-renders on right-panel picks (settings.color
    // identity change re-resolves the memo) while reading the single setBrushColor-owned source.
    brushColor: settings.color,
    returnFocusRef: playButtonRef,
  }));
  const canvasEngineReadyImplRef = useRef<(readyEngine: EfxPaintEngine) => void>(() => {});
  canvasEngineReadyImplRef.current = (readyEngine) => {
    readyEngine.setHistoryAvailabilityListener((availability) => {
      rotoMoveHistory.reconcilePaintBarriers(availability);
      rotoScript.notifySourceRevision();
      // quick 261004-dn5: same listener drives the Move icon's enable gate —
      // it fires on attach and on every allActions change, so no second
      // listener is needed to know a script is in memory.
      strokeScriptInMemory.value = readyEngine.getStrokeCount() > 0;
    });
    // 260925-iy6 UAT round 8: the preview base lands on its own async decode.
    // Bump here so the program monitor recomposites the atomic base swap
    // (new base + dropped dry) the moment it applies — otherwise the monitor
    // holds the pre-swap pixels until the next stroke.
    readyEngine.onPreviewBaseSettled(() => {
      physicPaintVersion.value++;
    });
    // quick-261023-l35: a fresh engine restarts its mutation counter at 1, so
    // the first new stroke would reuse a restored id and silently overwrite
    // that registry entry. Re-apply the reservation at every engine-ready: the
    // launch restore usually runs before this engine exists, and a
    // crash-recovery reload creates a brand-new one.
    const reservedMutationId = studioScriptSnapshotReservedNextMutationIdRef.current;
    if (reservedMutationId > 0) readyEngine.reserveMutationClock(reservedMutationId);
    handleEngineReady(readyEngine);
    rotoScript.updateEngine(readyEngine);
    // 261023-h9v: the observed loader records base presence for this arrival.
    if (workflowMode === 'roto') loadReferenceObserved(currentFrame, readyEngine as PreviewBackgroundEngine);
    // quick 260928-dh1 (DEV ONLY): one-shot deposit speckle capture —
    // window.__EFX_DH1_CAPTURE__('red' | 'green'). Measurement-only pixel
    // reader (see depositSpeckleCapture.ts header for the 260925-dso
    // exemption); installs nothing in a production build. Wired in the
    // engine-ready seam like the __EFX_PHYSICS_PAINT_PROFILE__ precedent —
    // no effect, no signal, no component state.
    if (import.meta.env.DEV) installDh1CaptureHook(readyEngine);
    // quick 261023-f9c (DEV ONLY): read-only script-memory measurement —
    // window.__EFX_SCRIPT_MEMORY__.snapshot(). Installs nothing in a production
    // build; no effect, no signal, no component state.
    if (import.meta.env.DEV) installScriptMemoryProbe(readyEngine, () => launchContextRef.current?.startFrame ?? 0);
    // 261023-g4p: a recreated engine must re-enter the brush script-edition
    // surface. The overlay is MOUNTED independently, but the engine defaults
    // are fresh (labels + cursor on) — re-apply the suppression and project
    // the current frame so the first click-select sees a script. Read the
    // deferred settingsRef here only (this callback runs after mount).
    if (activeModule.peek() === 'brush' && settingsRef.current.tool === 'move') {
      readyEngine.setTool('move');
      readyEngine.setStrokeLabelsSuppressed(true);
      readyEngine.setCursorVisible(false);
      // 261023-h9v: never flush an EMPTY fresh engine over a retained entry.
      if (readyEngine.getStrokes().length > 0) {
        flushBrushScriptFrame(
          launchContextRef.current?.startFrame ?? 0,
          readyEngine.getStrokes(),
          readyEngine.getFramePaintSettings() ?? readyEngine.getPaintRenderSettings(),
        );
      }
    }
    // 261002 look-delta (MEASURE-ONLY): read-only Studio-paint-canvas probe —
    // one pinned pixel at m1 ribbon / m2 outline / m3 settled / m4 +2s /
    // m5 on-return, written to /tmp/efx-look-delta.json. No product change.
    installLookDeltaCapture(readyEngine);
  };
  const handleCanvasEngineReady = useCallback((readyEngine: EfxPaintEngine) => {
    canvasEngineReadyImplRef.current(readyEngine);
  }, []);
  const canvasCompletedMutationImplRef = useRef<(mutation: CompletedPaintMutation, mutationEngine: EfxPaintEngine) => void>(() => {});
  canvasCompletedMutationImplRef.current = (mutation, mutationEngine) => {
    // 260925-iy6 UAT follow-up: bump the paint version SYNCHRONOUSLY at finalize
    // so the program monitor redraws its live-overlay composite in the same
    // paint cycle as the engine's wet→dry handoff (no 1-frame hole). The async
    // capture pipeline below still runs on its own quiet-window schedule.
    physicPaintVersion.value++;
    rotoScript.observeCompletedMutation(mutationEngine, mutation);
    const { kind, isEmpty, mutationId } = mutation;
    // 261023-h9v: ONE completion law. paint/move/erase/physics only MARK the
    // frame (O(1) — no projection); undo/redo flush from the completing
    // engine; 'clear' never writes — engine.clear() fires it on every
    // navigation, right after the navigation flush recorded the frame.
    if (activeModule.peek() !== 'watercolor') {
      const scriptFrame = launchContextRef.current?.startFrame ?? 0;
      applyCompletedBrushMutation(kind, scriptFrame, mutationEngine);
    }
    rotoMoveHistory.observePaintMutation(mutationId, kind);
    const acceptedTarget = rotoScript.getAcceptedTarget(mutationEngine, mutationId);
    const publicationIdentity = acceptedTarget?.publicationIdentity;
    const canPublishCapturedApply = Boolean(publicationIdentity);
    const appFrame = acceptedTarget?.appFrame ?? currentFrame;
    const pendingFirstPaintTarget = pendingFirstPaintTargetRef.current;
    // Quick 261019-mj2 Task 3: a generated cell is paintable while its
    // self-promotion is in flight — the capture below attaches to the key that
    // promotion creates. Real-key/empty paths are unchanged.
    const pendingSelfPromotionForCompletedFrame = Boolean(
      pendingFirstPaintTarget
      && launchContext
      && pendingFirstPaintTarget.launchOperationId === launchContext.operationId
      && pendingFirstPaintTarget.layerId === launchContext.layerId
      && pendingFirstPaintTarget.appFrame === appFrame,
    );
    if (pendingSelfPromotionForCompletedFrame && pendingFirstPaintTarget !== null && kind !== 'clear') {
      pendingFirstPaintTarget.completedMutationObserved = true;
    }
    const canPublishCurrentEngine = mutationEngine === engineRef.current
      && workflowMode === 'roto'
      && (currentFrameSelectionKind !== 'generated-interpolation' || pendingSelfPromotionForCompletedFrame)
      && Boolean(launchContext);
    if (kind === 'clear' || (!canPublishCapturedApply && !canPublishCurrentEngine) || !launchContext) return;
    if (acceptedTarget && !acceptedTarget.publishPixels) return;
    // 56-12 CACHE WRITE: while Water color is live, the aquarelle sheet owns
    // the cache pixels. engine-1 still observes the enqueued stroke for the
    // script path above, but its hidden surface must never overwrite the
    // aquarelle WebP.
    if (activeModule.value === 'watercolor') return;
    const document = physicPaintStore.getRotoPhysicalDocument(launchContext.layerId, studioActiveTrackId());
    const completedTarget = acceptedTarget?.keyId
      ? { kind: 'ordinary-key' as const, keyId: acceptedTarget.keyId, appFrame }
      : document
        ? resolveRotoCompletedGroupPaintTarget(document, appFrame, currentCellKeyId)
        : { kind: 'blocked' as const };
    if (completedTarget.kind === 'blocked') return;
    const initialKeyId = completedTarget.kind === 'ordinary-key'
      ? completedTarget.keyId
      : completedTarget.kind === 'group-frame'
        ? completedTarget.expectedKeyId
        : null;
    // 52.1 (2nd-stroke freeze): do NOT snapshot the engine canvas here — the
    // eager copyLiveAlphaCanvas() synchronously flushes every pending stroke
    // finalization (~500-1900ms full-raster drain) at the very moment the user
    // starts the next stroke. Pass a factory instead; the capture resolve it
    // inside its settled/idle produce, where the bounded rAF finalize loop has
    // already applied the pending rasters (queue empty -> fast).
    const liveAlphaCanvas = isEmpty ? null : (() => mutationEngine.copyLiveAlphaCanvas());
    // 261019-mj2 cache-loss: navigating away flushes captures BEFORE the
    // promotion promise resolves, so this capture enqueues after that flush
    // returned and would wait out CAPTURE_PRODUCE_QUIET_MS (6 s). Track the
    // deferral and force the transaction gate open once the capture submits.
    let deferredPromotionCapture = false;
    void (async () => {
      let keyId = initialKeyId;
      if (!keyId && completedTarget.kind === 'empty') {
        if (
          !pendingFirstPaintTarget
          || pendingFirstPaintTarget.launchOperationId !== launchContext.operationId
          || pendingFirstPaintTarget.layerId !== launchContext.layerId
          || pendingFirstPaintTarget.appFrame !== appFrame
        ) return;
        deferredPromotionCapture = true;
        const firstPaintTarget = await pendingFirstPaintTarget.promise;
        if (!firstPaintTarget.ok || firstPaintTarget.appFrame !== appFrame) return;
        keyId = firstPaintTarget.keyId;
      }

      const currentLaunch = launchContextRef.current;
      if (
        !currentLaunch
        || currentLaunch.operationId !== launchContext.operationId
        || currentLaunch.layerId !== launchContext.layerId
      ) return;
      // Read the merge base through the ref AFTER the await: the state value
      // captured in this closure can predate the promotion's blank-frame pin.
      const cachedRepaintBase = cachedRotoRepaintBaseFrameRef.current;
      const cachedBaseAppFrame = cachedRepaintBase?.appFrame ?? null;
      if (isEmpty) {
        if (cachedRepaintBase && cachedBaseAppFrame === appFrame) {
          rotoPersistence.invalidateLivePixels(appFrame);
          rotoPersistence.upsertCachedFrame(cachedRepaintBase, false);
        } else {
          // 261003-erase-uat (C): engine-empty ≠ key-empty. `kind === 'clear'`
          // already early-returns above, so an isEmpty here is an undo/erase
          // that emptied allActions — the persisted cache may still hold the
          // base paint. Never destroy it from this path.
          rotoPersistence.invalidateLivePixels(appFrame);
        }
        return;
      }
      if (!liveAlphaCanvas) return;
      // 261023-j5b: a faithful rebake that cleared the duplicate cached base
      // leaves the WHOLE frame on the live canvas. Merging the frame's cached
      // base again would bake a second copy of every stroke into the cache —
      // the phantom survives the edit and reappears on every revisit.
      const liveCanvasWholeFrame = mutationEngine.isLiveCanvasWholeFrame();
      const capturedBase = publicationIdentity?.cachedBase ?? null;
      const capturedBaseAppFrame = capturedBase?.appFrame ?? null;
      const cachedBase = liveCanvasWholeFrame
        ? null
        : publicationIdentity
          ? capturedBaseAppFrame === appFrame ? capturedBase : null
          : cachedBaseAppFrame === appFrame ? cachedRepaintBase : null;
      const snapshotStartedAt = profilePerformance ? performance.now() : 0;
      const capture = rotoPersistence.captureLivePixels({
        layerId: publicationIdentity?.layerId ?? currentLaunch.layerId,
        operationId: publicationIdentity?.operationId,
        keyId: keyId ?? undefined,
        appFrame,
        liveAlphaCanvas,
        cachedBase,
        // 261003-erase-uat (B): a pixel erase punches the engine's copy of the
        // cached paint — merge against that, never the original cached bytes.
        // A cleared-base visit has no duplicated base left to merge at all.
        baseCanvas: liveCanvasWholeFrame
          ? null
          : (mutationEngine as EfxPaintEngine & { getPreviewBasePaintCanvas?: () => HTMLCanvasElement | null }).getPreviewBasePaintCanvas?.() ?? null,
        background: publicationIdentity?.background,
        size: { width: canvasWidth, height: canvasHeight },
        mutationId,
      });
      if (profilePerformance) recordPhysicsPaintPerformance({ stage: 'snapshot-handoff', category: 'sync-cpu', durationMs: performance.now() - snapshotStartedAt, timestamp: performance.now(), mutationId, sourceFrame: appFrame });
      if (deferredPromotionCapture) {
        // The navigation/leave flush already ran while this capture was still
        // awaiting the promotion, so it never saw the work item. Flush again
        // now that the transaction is pending; otherwise a leave inside the
        // 6 s quiet window loses the painted pixels (empty cache on return).
        void rotoPersistence.flushLivePixels(appFrame).catch((error) => {
          console.error('[PhysicsPaintStudio] Deferred promotion cache flush failed', error);
        });
      }
      // Layer 1: a failed/superseded capture must never fall back to reloading the
      // stale cache — that re-serves a partial over the newer settled base. The
      // authoritative frame is captured by the sequence's own capture at the settled
      // revision; the superseded capture is dropped (COW-gated, no stale commit).
      if (!await capture && shouldReloadRotoFrameAfterFailedCapture()) {
        loadCachedRotoReferenceFrame(
          appFrame,
          engineRef.current as PreviewBackgroundEngine | null,
          undefined,
          true,
        );
      }
    })().catch((error) => {
      console.error('[PhysicsPaintStudio] Automatic Roto pixel cache failed', error);
    }).finally(() => {
      if (pendingFirstPaintTargetRef.current === pendingFirstPaintTarget) {
        pendingFirstPaintTargetRef.current = null;
      }
    });
  };
  const handleCanvasCompletedMutation = useCallback((mutation: CompletedPaintMutation, mutationEngine: EfxPaintEngine) => {
    canvasCompletedMutationImplRef.current(mutation, mutationEngine);
  }, []);
  const handleCanvasInputActivity = useCallback((kind: 'down' | 'move' | 'up' | 'cancel', pointerId: number) => {
    if (kind === 'down') beginInteraction(pointerId);
    else if (kind === 'move') markInteractionActive();
    else endInteraction(pointerId);
  }, []);
  const cachedRotoPlaybackComposition = useMemo(() => launchContext ? {
    width: projectCanvasWidth,
    height: projectCanvasHeight,
    background: buildRotoBackgroundMetadata(settings),
  } : null, [launchContext?.operationId, projectCanvasWidth, projectCanvasHeight, settings.background, settings.grainStrength, settings.grainScale]);
  const onionOverlayUrlsRef = useRef<string[]>([]);
  const onionOverlay = useMemo(() => {
    onionOverlayUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    onionOverlayUrlsRef.current = [];
    if (!onion.enabled || onionPreviewFrames.length === 0) return null;
    return onionPreviewFrames.map((frame) => {
      const url = URL.createObjectURL(new Blob([frame.bytes as Uint8Array<ArrayBuffer>], { type: 'image/webp' }));
      onionOverlayUrlsRef.current.push(url);
      return (
        <img key={`${frame.direction}-${frame.source}-${frame.frame}-${frame.distance}`} class={`physics-paint-onion-frame ${frame.kind === 'cached-composite' ? 'physics-paint-onion-cached-composite' : frame.direction === 'previous' ? 'physics-paint-onion-prev' : 'physics-paint-onion-next'}`} src={url} style={{ opacity: getOnionFrameOpacity(frame.distance, onion.opacity) }} alt="" />
      );
    });
  }, [onion.enabled, onion.opacity, onionPreviewFrames]);
  useEffect(() => () => {
    onionOverlayUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    onionOverlayUrlsRef.current = [];
  }, []);
  const rotoInputDisabledMessage = mutationLocked
    ? 'Finish the current Roto script operation.'
    : undefined;
  // 56-11: stroke-end record seam for Water color. The live aquarelle
  // surface owns rendering; this callback persists the full AquarelleStroke
  // (points + params) and enqueues a PaintStroke so the Roto script path
  // still sees the mark. Supersedes the params-only mutation-completion seam.
  //
  // script-playback-draws-nothing: the two engines disagree about point
  // space (aquarelle = document UV y-up, engine-1 = canvas pixels y-down).
  // aquarelleStrokeToPaintStroke is the ONE crossing — without it the saved
  // script stores 0..1 in a pixel slot and Play draws at the origin.
  // PLAY FIDELITY: the live layer reports the measured settle window on the
  // SAME stroke instance it recorded — this map resolves it to its mutation id
  // so the recorded cuisson can be replaced with the real one.
  const aquarelleStrokeMutationIdsRef = useRef(new WeakMap<AquarelleStroke, number>());
  const handleAquarelleStrokeEnd = useCallback((stroke: AquarelleStroke) => {
    const mutationEngine = engineRef.current;
    if (!mutationEngine) return;
    const paintStroke = aquarelleStrokeToPaintStroke(stroke, { width: canvasWidth, height: canvasHeight });
    try {
      const mutationId = mutationEngine.enqueueRecordedStroke({ primary: paintStroke });
      aquarelleStrokeMutationIdsRef.current.set(stroke, mutationId);
      recordAquarelleStroke(mutationId, { ...stroke, mutationId });
      // The sheet now holds paint that no queue can see until it is captured;
      // the close/save flush gate reads this flag.
      aquarelleSheetHasPaintRef.current = true;
    } catch {
      // A malformed recorded stroke must not kill the live surface — drop it.
    }
  }, [recordAquarelleStroke, canvasWidth, canvasHeight]);
  const handleAquarelleStrokeSettled = useCallback((stroke: AquarelleStroke, ticks: number) => {
    const mutationId = aquarelleStrokeMutationIdsRef.current.get(stroke);
    if (mutationId !== undefined) setAquarelleStrokeDiffusionFrames(mutationId, ticks);
  }, []);

  // 261022-pim: Alt+click delete. The stroke leaves the recorded script, the
  // live sheet resets, and the whole current-frame script re-applies through
  // the shared Apply pipeline (same bake, pill, publish, display reconcile).
  // Guards are peek-only: the handler must not subscribe the Studio body.
  const handleAquarelleDeleteStroke = useCallback((mutationId: number) => {
    if (isPhysicalMutationLocked()) return;
    if (rotoScript.applying.peek() || rotoScript.mutationLocked.peek()) return;
    if (rotoTimelineModel.currentCell.peek().kind !== 'real') return;
    if (isAquarelleDeleteInFlight()) return;
    // One delete = one edit with before/after script snapshots. The ledger
    // records it only after the re-bake succeeds (Task 3).
    const editId = beginAquarelleDeleteEdit(mutationId);
    if (editId === null) return;
    setAquarelleDeleteInFlight(true);
    void (async () => {
      try {
        // The recorded timeline IS the script: replay it directly so a delete
        // keeps working after an Apply refresh clears the engine guide strokes.
        const playFrame = launchContextRef.current?.startFrame ?? 0;
        aquarelleResetSheetRef.current?.();
        const ok = await rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame));
        if (ok) {
          rotoMoveHistory.recordAquarelleScriptEdit(editId);
          setLastError(null);
          clearOwnedScriptApplyRefusal();
          return;
        }
        // Failed re-bake: put the pre-delete script back exactly so the next
        // Apply cannot bake a script the sheet never showed.
        restoreAquarelleEditSnapshot(editId, 'undo');
        const error = rotoScript.error.peek();
        // The apply controller has silent refusal paths (busy, stale launch)
        // that leave `error` null. Surface a message anyway — a delete that
        // vanishes without a word is the one outcome this flow must never
        // produce.
        const message = buildRotoScriptApplyRefusalMessage(error)
          ?? error?.message
          ?? 'Could not re-apply the watercolor script — the stroke was restored.';
        setLastError(message);
        setApplyMessage(message);
        setApplyStatus('error');
        scriptApplyRefusalOwnedRef.current = true;
      } finally {
        setAquarelleDeleteInFlight(false);
      }
    })();
  }, [
    isPhysicalMutationLocked,
    rotoScript,
    rotoTimelineModel,
    // The hook returns a fresh wrapper each render; its recorder is the
    // stable useCallback — depend on it, never the wrapper object.
    rotoMoveHistory.recordAquarelleScriptEdit,
    setLastError,
    setApplyMessage,
    setApplyStatus,
    clearOwnedScriptApplyRefusal,
  ]);

  // 261022-tv1: Cmd+drag stroke move. The overlay wrote only the ghost drag
  // signal during the gesture; this release path translates the recorded
  // stroke + its payload-timeline entry, resets the sheet, and re-applies the
  // current frame's script through the SAME shared Apply pipeline as delete.
  // One move + its re-bake = ONE `aquarelle-script` ledger entry. Guards are
  // peek-only: the handler must not subscribe the Studio body.
  const handleAquarelleMoveStroke = useCallback((mutationId: number, dxPx: number, dyPx: number) => {
    if (isPhysicalMutationLocked()) return;
    if (rotoScript.applying.peek() || rotoScript.mutationLocked.peek()) return;
    if (rotoTimelineModel.currentCell.peek().kind !== 'real') return;
    if (isAquarelleScriptEditInFlight()) return;
    // The delta crosses from canvas pixels to document UV exactly once.
    const delta = aquarelleEnginePixelDeltaToUv(
      { x: dxPx, y: dyPx },
      { width: canvasWidth, height: canvasHeight },
    );
    // One move = one edit with before/after script snapshots. The ledger
    // records it only after the re-bake succeeds.
    const editId = beginAquarelleMoveEdit(mutationId, delta.x, delta.y);
    if (editId === null) return;
    setAquarelleScriptEditInFlight(true);
    void (async () => {
      try {
        // The recorded timeline IS the script (same replay source as delete).
        const playFrame = launchContextRef.current?.startFrame ?? 0;
        aquarelleResetSheetRef.current?.();
        const ok = await rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame));
        if (ok) {
          rotoMoveHistory.recordAquarelleScriptEdit(editId);
          setLastError(null);
          clearOwnedScriptApplyRefusal();
          return;
        }
        // Failed re-bake: put the pre-move script back exactly.
        restoreAquarelleEditSnapshot(editId, 'undo');
        const error = rotoScript.error.peek();
        const message = buildRotoScriptApplyRefusalMessage(error)
          ?? error?.message
          ?? 'Could not re-apply the watercolor script — the stroke was restored.';
        setLastError(message);
        setApplyMessage(message);
        setApplyStatus('error');
        scriptApplyRefusalOwnedRef.current = true;
      } finally {
        setAquarelleScriptEditInFlight(false);
      }
    })();
  }, [
    isPhysicalMutationLocked,
    rotoScript,
    rotoTimelineModel,
    // The hook returns a fresh wrapper each render; its recorder is the
    // stable useCallback — depend on it, never the wrapper object.
    rotoMoveHistory.recordAquarelleScriptEdit,
    setLastError,
    setApplyMessage,
    setApplyStatus,
    clearOwnedScriptApplyRefusal,
    canvasWidth,
    canvasHeight,
  ]);

  // 261022-ujp: '<' / '>' stack step. The reorder swaps the recorded stroke
  // one payload position, resets the sheet, and re-applies the current frame's
  // script through the SAME shared Apply pipeline as delete/move. Reorder +
  // re-bake = ONE `aquarelle-script` ledger entry. Guards are peek-only and
  // mirror the move handler's order: the handler must not subscribe the Studio
  // body.
  const handleAquarelleStepStroke = useCallback((mutationId: number, direction: 'back' | 'forward') => {
    if (isPhysicalMutationLocked()) return;
    if (rotoScript.applying.peek() || rotoScript.mutationLocked.peek()) return;
    if (rotoTimelineModel.currentCell.peek().kind !== 'real') return;
    if (isAquarelleScriptEditInFlight()) return;
    const editId = beginAquarelleReorderEdit(mutationId, direction);
    if (editId === null) return;
    setAquarelleScriptEditInFlight(true);
    void (async () => {
      try {
        // The recorded timeline IS the script (same replay source as delete).
        const playFrame = launchContextRef.current?.startFrame ?? 0;
        aquarelleResetSheetRef.current?.();
        const ok = await rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame));
        if (ok) {
          rotoMoveHistory.recordAquarelleScriptEdit(editId);
          setLastError(null);
          clearOwnedScriptApplyRefusal();
          return;
        }
        // Failed re-bake: put the pre-step order back exactly.
        restoreAquarelleEditSnapshot(editId, 'undo');
        const error = rotoScript.error.peek();
        const message = buildRotoScriptApplyRefusalMessage(error)
          ?? error?.message
          ?? 'Could not re-apply the watercolor script — the stroke order was restored.';
        setLastError(message);
        setApplyMessage(message);
        setApplyStatus('error');
        scriptApplyRefusalOwnedRef.current = true;
      } finally {
        setAquarelleScriptEditInFlight(false);
      }
    })();
  }, [
    isPhysicalMutationLocked,
    rotoScript,
    rotoTimelineModel,
    // The hook returns a fresh wrapper each render; its recorder is the
    // stable useCallback — depend on it, never the wrapper object.
    rotoMoveHistory.recordAquarelleScriptEdit,
    setLastError,
    setApplyMessage,
    setApplyStatus,
    clearOwnedScriptApplyRefusal,
  ]);

  // 261023-g4p: register BOTH module ports. This is a render-body write of a
  // plain module variable (temporaryEraseDepsRef precedent) — no signal, no
  // subscription. The keyboard helpers resolve the port whose surface is
  // active, so rail gestures, Alt+click and Backspace can never diverge. The
  // brush port reads the live Studio seams through brushScriptEditionDepsRef.
  setScriptStrokeEditionPorts({
    watercolor: {
      isActive: () => activeModule.peek() === 'watercolor' && aquarelleSelectMode.peek(),
      ...aquarelleScriptStrokeEditionPort,
      deleteStroke: (mutationId) => handleAquarelleDeleteStroke(mutationId),
      moveStroke: (mutationId, dxPx, dyPx) => handleAquarelleMoveStroke(mutationId, dxPx, dyPx),
      stepStroke: (mutationId, direction) => handleAquarelleStepStroke(mutationId, direction),
    },
    brush: brushScriptEditionPort,
  });
  configureBrushScriptEdition(brushScriptEditionDepsRef.current);

  // 56-12 CACHE WRITE: the aquarelle sheet lands in the SAME WebP durability
  // class as engine-1 frames. Invoked by the live layer at stroke end, once Dry
  // has settled, and on frame-leave.
  //
  // The snapshot is resolved EAGERLY here (not deferred like engine-1's 52.1
  // factory). Aquarelle has no pending-finalization drain — exportCanvas is a
  // GPU readback — and the live layer calls this right before engine.clear().
  // A deferred factory would read the wiped sheet and commit empty.
  //
  // watercolor-clears-cached-paint: the sheet is frame-scoped opaque
  // transmittance and does NOT carry the key's earlier paint (engine-1 or a
  // prior aquarelle session). Merge it over the SESSION BASE (cache as of this
  // sheet's start) with MULTIPLY so the transmittance glazes the existing
  // paint. The base is snapshotted once per sheet — repeat captures (dry
  // settle + frame-leave) stay idempotent and never double-apply the sheet
  // onto a cache that already includes it.
  // (declared with the other promotion refs: the failure policy and the
  // accepted-key suppression both pin the merge base synchronously.)
  // aquarelle-cache-lost-on-return: the latest capture sequence per frame — a
  // retry only runs when no newer capture (new session, Dry, second leave)
  // has taken ownership of that frame's cache.
  const aquarelleCaptureSeqRef = useRef(0);
  const aquarelleLatestCaptureSeqByFrameRef = useRef<Map<number, number>>(new Map());
  const findCachedRotoDisplayFrameRef = useRef(findCachedRotoDisplayFrame);
  findCachedRotoDisplayFrameRef.current = findCachedRotoDisplayFrame;
  const handleAquarelleCaptureFrame = useCallback((playFrame: number, snapshot: () => HTMLCanvasElement | null) => {
    const launch = launchContextRef.current;
    if (!launch) return;
    // The snapshot must stay EAGER: the live layer clears the sheet on frame
    // leave, so a deferred read would commit empty. Awaiting the promotion
    // below therefore happens AFTER the copy.
    const liveAlphaCanvas = snapshot();
    if (!liveAlphaCanvas) return;
    // A cleared sheet still exports an opaque, near-uniform white texture tens
    // of KB large. Never let such a capture take ownership of the frame's cache.
    const ink = measureAquarelleCanvasInk(liveAlphaCanvas);
    if (ink < AQUARELLE_MIN_CAPTURE_INK) return;
    const operationId = launch.operationId;
    const seq = ++aquarelleCaptureSeqRef.current;
    aquarelleLatestCaptureSeqByFrameRef.current.set(playFrame, seq);
    // 261019-mj2 Task 3: when this sheet's first stroke self-promoted a blank
    // key, the accepted key does not exist at stroke-end time. Writing pixels
    // now loses the capture gate; await the promotion, then persist onto the
    // created key with the BLANK frame as the multiply base (the generated
    // cell's pre-promotion cache must not bleed into the new key).
    const pendingFirstPaintTarget = (() => {
      const pending = pendingFirstPaintTargetRef.current;
      if (pending === null) return null;
      if (pending.source !== 'auto-key-paint') return null;
      if (pending.launchOperationId !== operationId) return null;
      if (pending.appFrame !== playFrame) return null;
      return pending;
    })();
    const runCapture = async () => {
      let cachedBase: RenderedFramePayload | null;
      if (pendingFirstPaintTarget !== null) {
        const promotion = await pendingFirstPaintTarget.promise;
        // Failure policy: the stroke was discarded — never persist it.
        if (!promotion.ok) return;
        // A cloned base multiplies the opaque transmittance sheet over the
        // previous key's paint. A blank base must encode the sheet alone:
        // multiply over a transparent base would erase it.
        cachedBase = pendingFirstPaintTarget.baseKind === 'clone' ? pendingFirstPaintTarget.blankFrame : null;
        aquarelleMergeBaseRef.current = { appFrame: playFrame, base: cachedBase };
      } else {
        if (aquarelleMergeBaseRef.current?.appFrame !== playFrame) {
          aquarelleMergeBaseRef.current = {
            appFrame: playFrame,
            base: findCachedRotoDisplayFrameRef.current(playFrame),
          };
        }
        cachedBase = aquarelleMergeBaseRef.current?.base ?? null;
        // The sheet ACCUMULATES strokes until the session ends, so the base
        // must stay the frame cache as of SHEET START. Advancing it to the
        // just-committed payload would multiply the same sheet over itself on
        // every re-capture (settle → frame-leave → close) and compound the
        // pigment density — the darker-on-reopen cache.
      }
      const currentLaunch = launchContextRef.current;
      if (!currentLaunch || currentLaunch.operationId !== operationId) return;
      // The snapshot is an eager canvas copy, so a retry can reuse it after the
      // live sheet was cleared by the frame change.
      const enqueue = () => rotoPersistenceRef.current.captureLivePixels({
        layerId: launch.layerId,
        appFrame: playFrame,
        liveAlphaCanvas,
        cachedBase,
        // A5: MODE.transparent is opaque transmittance. Multiply matches the
        // live CSS seam — white (no pigment) leaves the base untouched, pigment
        // tints it. Source-over would cover the base with the full sheet.
        mergeBlend: 'multiply',
        size: { width: canvasWidth, height: canvasHeight },
      });
      const work = enqueue();
      // 261019-mj2 cache-loss: the frame-leave flush runs BEFORE the promotion
      // promise resolves, so a promotion-deferred capture enqueues after that
      // flush returned and would sit out CAPTURE_PRODUCE_QUIET_MS (6 s).
      // Force the transaction gate open right after each deferred enqueue;
      // non-deferred captures already ride the navigation flush.
      const flushDeferredPromotionCapture = () => {
        if (pendingFirstPaintTarget === null) return;
        void rotoPersistenceRef.current.flushLivePixels(playFrame).catch((error) => {
          console.error('[PhysicsPaintStudio] Aquarelle deferred capture flush failed', error);
        });
      };
      flushDeferredPromotionCapture();
      await work.then((ok) => {
        // Never advance the merge base here: the live sheet still contains the
        // committed paint, and the next capture would multiply it over itself.
        if (ok) return;
        // aquarelle-cache-lost-on-return: the stroke's own recorded physical
        // edit can advance the content revision between enqueue and commit, so
        // the capture gate treats the sheet as stale. The snapshot still holds
        // the frame's paint — retry once against the current revision, unless a
        // newer capture for this frame already owns its cache.
        if (aquarelleLatestCaptureSeqByFrameRef.current.get(playFrame) !== seq) return;
        const retryLaunch = launchContextRef.current;
        if (!retryLaunch || retryLaunch.operationId !== operationId) return;
        const retriedWork = enqueue();
        flushDeferredPromotionCapture();
        void retriedWork.catch((error) => {
          console.error('[PhysicsPaintStudio] Aquarelle cache retry failed', error);
        });
      }).catch((error) => {
        console.error('[PhysicsPaintStudio] Aquarelle cache write failed', error);
      });
    };
    const run = runCapture().catch((error) => {
      console.error('[PhysicsPaintStudio] Aquarelle cache capture failed', error);
    });
    aquarelleCapturesInFlightRef.current.add(run);
    void run.finally(() => { aquarelleCapturesInFlightRef.current.delete(run); });
  }, [canvasWidth, canvasHeight]);

  // Save/close flush: force the sheet capture NOW (the snapshot is eager, so a
  // later engine.clear() cannot blank it), wait for captures suspended on an
  // auto-key promotion to enqueue, then drain the live-pixel transactions. The
  // engine-1 flush alone drained an empty queue while the sheet was still wet.
  const flushAquarellePixels = useCallback(async (appFrame?: number): Promise<void> => {
    try {
      aquarelleFlushCaptureRef.current?.();
    } catch {
      // A stale/unmounted sheet must never fail the save/close flush.
    }
    const inFlight = [...aquarelleCapturesInFlightRef.current];
    if (inFlight.length > 0) await Promise.allSettled(inFlight);
    await rotoPersistenceRef.current.flushLivePixels(appFrame);
  }, []);

  // CACHE MERGE BASE (aquarelle-cache-lost-on-return): a frame change clears
  // the sheet, so the next session's first capture must re-read the cache as
  // its multiply base. Keeping the previous session's base drops that paint.
  const handleAquarelleSheetSessionEnd = useCallback(() => {
    aquarelleMergeBaseRef.current = null;
    aquarelleSheetHasPaintRef.current = false;
  }, []);

  // NAV FLUSH (paint-cache-empty-frame-on-key): registration callback for the
  // aquarelle layer's synchronous flush-capture (see navigateToSyncedPhysicalFrame).
  const handleAquarelleFlushCaptureReady = useCallback((flushCapture: (() => void) | null) => {
    aquarelleFlushCaptureRef.current = flushCapture;
    if (flushCapture === null) return;
    // A fresh sheet (module enter / remount) starts a new merge session — the
    // next capture re-reads the cache as its base so a later session never
    // resurrects a stale one.
    aquarelleMergeBaseRef.current = null;
    aquarelleSheetHasPaintRef.current = false;
  }, []);

  // Quick 261019-mj2 Task 3: same-frame sheet reset registration for the
  // generated-cell self-promotion (the Studio calls it synchronously).
  const handleAquarelleResetSheetReady = useCallback((resetSheet: () => void) => {
    aquarelleResetSheetRef.current = resetSheet;
    aquarelleMergeBaseRef.current = null;
    aquarelleSheetHasPaintRef.current = false;
  }, []);

  // FRAME SCOPE: identity-stable getter so the canvas-mount memo never
  // invalidates on frame navigation (the persistent Efx child contract).
  const getAquarellePlayFrame = useCallback(
    () => launchContextRef.current?.startFrame ?? 0,
    [],
  );

  // 261023-g4p: same identity-stable frame getter for the brush script
  // overlay — frame navigation must not invalidate the mount memo.
  const getBrushScriptPlayFrame = useCallback(
    () => launchContextRef.current?.startFrame ?? 0,
    [],
  );

  // F3 (R2.3): Studio paper → the aquarelle engine's deposit-grain preset.
  // Identity-stable getter — paper changes must not invalidate the mount memo.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const getAquarellePaperId = useCallback(
    () => settingsRef.current.background,
    [],
  );

  const canvasMount = canvasMountPropsMemo.resolve([canvasWidth, canvasHeight, paperTextureScale, handleCanvasEngineReady, setCanvasMounted, handleNativePenInputReady, handleCanvasCompletedMutation, handleCanvasInputActivity, recordEnginePerformance, rotoScript.prepareEngineDisposal, getStrokeMetadata, launchContext?.layerId, efxPaintVersion.value, activeModule.value, settings.color, settings.tool, getBrushScriptPlayFrame, handleAquarelleStrokeEnd, handleAquarelleStrokeSettled, handleAquarelleCaptureFrame, handleAquarelleSheetSessionEnd, handleAquarelleResetSheetReady, handleAquarelleMoveStroke, getAquarellePlayFrame, getAquarellePaperId, handleAquarelleDeleteStroke], () => {
    // 48-06 (N2/N3): the active track's opacity/blend (D-01) ride the engine
    // shell as CSS group opacity/mix-blend — the D-05 exclusion keeps the
    // active track out of the monitor's composite, so without this the Studio
    // never shows the edited track's display properties. efxPaintVersion in
    // the deps re-resolves the memo on setTrackOpacity/setTrackBlend.
    const mountLayerId = launchContext?.layerId;
    const mountDocument = mountLayerId ? getEfxPaintDocument(mountLayerId) : null;
    const mountActiveTrack = mountDocument?.tracks.find((track) => track.id === mountDocument.activeTrackId);
    return {
      width: canvasWidth,
      height: canvasHeight,
      paperTextureScale,
      onEngineReady: handleCanvasEngineReady,
      onCanvasMounted: setCanvasMounted,
      onNativePenInputReady: handleNativePenInputReady,
      onCompletedMutation: handleCanvasCompletedMutation,
      onPerformanceSample: recordEnginePerformance,
      onInputActivity: handleCanvasInputActivity,
      beforeEngineDestroy: rotoScript.prepareEngineDisposal,
      getStrokeMetadata,
      trackOpacity: mountActiveTrack?.opacity ?? 1,
      trackBlendMode: mountActiveTrack?.blendMode ?? 'normal',
      aquarelleActive: activeModule.value === 'watercolor',
      // 261023-g4p: the Brush Move tool arms the shared script-edition
      // overlay. The mount additionally gates on !aquarelleActive, so Water
      // color's own surface is never covered.
      brushScriptEditionActive: settings.tool === 'move',
      getBrushScriptPlayFrame,
      color: settings.color,
      // FRAME SCOPE: identity-stable getter — the sheet previews the live
      // edit frame without invalidating the mount memo on navigation.
      getAquarellePlayFrame,
      getAquarellePaperId,
      onAquarelleStrokeEnd: handleAquarelleStrokeEnd,
      onAquarelleStrokeSettled: handleAquarelleStrokeSettled,
      onAquarelleCaptureFrame: handleAquarelleCaptureFrame,
      onAquarelleFlushCaptureReady: handleAquarelleFlushCaptureReady,
      onAquarelleSheetSessionEnd: handleAquarelleSheetSessionEnd,
      onAquarelleResetSheetReady: handleAquarelleResetSheetReady,
      onAquarelleDeleteStroke: handleAquarelleDeleteStroke,
      onAquarelleMoveStroke: handleAquarelleMoveStroke,
    };
  });
  // 48-05 (D-09): the missing-source capsule publication handler — maps the
  // program monitor's compare-then-write summary to the existing red-warning
  // status-capsule surface (the statusMessage/statusIsError bundle), naming the
  // document track when resolvable and the id otherwise. A null summary restores
  // the idle capsule. 48-06 (UAT-E): the monitor only ever publishes GENUINE
  // dangling sources (non-empty missingRefs) — a track that merely has no
  // content at the frame (normal end of rail) never raises the capsule. The
  // monitor already dedupes steady/cleared state, so every call here is a
  // genuine state transition (idempotent setter law; never a render-body write).
  // Identity-stable per launch context — navigation re-runs the monitor's
  // publish effect against the new document, which is a no-op when the missing
  // state is unchanged.
  const handleProgramMonitorMissingChange = useCallback((summary: EfxPaintProgramMonitorMissingSummary | null) => {
    if (summary === null) {
      setApplyStatus('idle');
      setApplyMessage(null);
      return;
    }
    const layerId = launchContext?.layerId ?? null;
    const trackName = layerId
      ? getEfxPaintDocument(layerId)?.tracks.find((track) => track.id === summary.firstTrackId)?.name
      : undefined;
    setApplyStatus('error');
    setApplyMessage(`Missing source on ${summary.missingCount} track(s) — first: ${trackName ?? summary.firstTrackId}`);
  }, [launchContext, setApplyStatus, setApplyMessage]);
  // 50-04 (S3): the reference missing-source capsule publication handler — maps
  // the ghost layer's compare-then-write boolean to the existing red-warning
  // status-capsule surface (D-04, Phase 48 D-09 family). A missing reference
  // source (a track exists but the resolved source frame is null) raises the
  // fixed copy; a resolved source or no track restores the idle capsule. The
  // report is INDEPENDENT of the visibility preference — fail-closed reporting
  // fires even when the overlay toggle is off. The ghost layer already dedupes
  // steady/cleared state, so every call here is a genuine state transition
  // (idempotent setter law; never a render-body write).
  const handleReferenceMissingSourceChange = useCallback((missing: boolean) => {
    if (missing) {
      setApplyStatus('error');
      setApplyMessage('Missing reference source — use Replace source to re-link.');
    } else {
      setApplyStatus('idle');
      setApplyMessage(null);
    }
  }, [setApplyStatus, setApplyMessage]);
  const canvasStack = canvasStackPropsMemo.resolve([cachedRotoReferenceUrl, rotoCachedPlayback.playbackTick, rotoCachedPlayback.isActive, cachedRotoPlaybackComposition, rotoInputDisabled, rotoInputDisabledMessage, beginRotoFrameEdit, onionOverlay, canvasKey, canvasMount, engine, engine?.getAppliedPreviewBaseContentToken(), launchContext?.layerId, currentFrame, settings.background, settings.grainScale, isPlaying, efxPaintVersion.value, physicPaintVersion.value, canvasWidth, canvasHeight, paperTextureScale, activeModule.value], () => {
    // 48-05 (D-05): the program monitor config — concrete values only. The
    // monitor subscribes to the store version clocks in its OWN effect; this
    // memo re-resolves on document changes (efxPaintVersion.value) so a
    // row-click active-track switch re-targets the editing base promptly.
    // 49-04 (UAT fix): settings.background is a dep so the checkerboard verdict
    // re-resolves when the engine-side background mode changes.
    const programMonitorLayerId = launchContext?.layerId ?? null;
    const programMonitorActiveTrackId = programMonitorLayerId
      ? getEfxPaintDocument(programMonitorLayerId)?.activeTrackId ?? null
      : null;
    // 260922-rd4: lock state for the mutual-exclusion handle gates (read here
    // so efxPaintVersion — already a memo dep — re-resolves the mounts).
    const stackDocument = programMonitorLayerId
      ? getEfxPaintDocument(programMonitorLayerId)
      : undefined;
    // 48-06 (UAT-B): a hidden active track blanks the engine canvas by law
    // (261022-iff: Solo never hides its own target, so hide is the only
    // trigger), but the cleared engine surface can still carry the engine's own
    // background paint and would occlude the program monitor beneath — the
    // monitor owns the remaining visible tracks + the document
    // fond. The flag mirrors the cached-roto-playback treatment: the engine
    // canvases step aside (visibility: hidden) so the monitor owns the surface.
    const engineSurfaceHidden = programMonitorLayerId !== null
      && programMonitorActiveTrackId !== null
      && !resolvePhysicPaintTrackVisibility(programMonitorLayerId, programMonitorActiveTrackId);
    // 49-03 (D-11 consumption half): the monitor fond is the DOCUMENT FALLBACK —
    // the same resolved instruction the flattened path uses (one authority, two
    // consumers, Pitfall 1). The per-track roto background metadata fond walk is
    // gone; the store resolves the fallback record to the fond instruction and
    // this memo bridges it to the fond-layer metadata. The monitor reads the
    // fond-LESS composite; this layer draws the paper beneath the isolated
    // tracks group so the active track's CSS blend never meets it.
    const fondInstruction = programMonitorLayerId
      ? physicPaintStore.getDocumentFondInstruction(programMonitorLayerId)
      : null;
    const fondBackground = fondInstruction ? fondInstructionToFondMetadata(fondInstruction) : null;
    // 49-03 (D-12): the transparency checkerboard shows ONLY when the effective
    // fond is fully transparent for the current frame — transparent fallback
    // (no fond instruction) AND the engine-side active background mode is
    // transparent (settings.background — the fond=fallback mapping is not fully
    // wired yet, so a paper/solid engine mode must suppress the checkerboard
    // even while the document fallback is still transparent) AND no clip
    // covering the frame (the gap verdict, consumed from the store's
    // already-resolved background-frame plumbing, not a re-resolution). With a
    // solid or paper fallback active the fond shows as today and the
    // checkerboard layer is absent.
    const showTransparencyCheckerboard = programMonitorLayerId !== null
      && fondInstruction === null
      && settings.background === 'transparent'
      && physicPaintStore.getBackgroundFrameVerdict(programMonitorLayerId, currentFrame) === 'gap';
    return {
      cachedRotoReferenceUrl,
      cachedRotoPlaybackTick: rotoCachedPlayback.playbackTick,
      cachedRotoPlaybackActive: rotoCachedPlayback.isActive,
      cachedRotoPlaybackComposition,
      inputDisabled: rotoInputDisabled,
      inputDisabledMessage: rotoInputDisabledMessage,
      onInputIntent: beginRotoFrameEdit,
      onionOverlay,
      canvasKey,
      mount: canvasMount,
      engineSurfaceHidden,
      fondBackground,
      showTransparencyCheckerboard,
      programMonitor: programMonitorLayerId ? {
        layerId: programMonitorLayerId,
        currentFrame,
        isPlaying,
        activeTrackId: programMonitorActiveTrackId,
        width: canvasWidth,
        height: canvasHeight,
        playbackTick: rotoCachedPlayback.playbackTick,
        onMissingSourcesChange: handleProgramMonitorMissingChange,
        // Water color: the aquarelle canvas IS the active track's live pixels.
        // The engine-1 baked canvas holds the same strokes re-drawn by the
        // script-record bridge — a thinner duplicate line under the wash that
        // the final bake never contains. Never show it in this module.
        liveOverlay: engineSurfaceHidden || activeModule.value === 'watercolor'
          ? null
          : (engine?.getAppliedPreviewBaseContentToken() != null ? engine.getBakedCanvas() : null),
        // 56-12: the live aquarelle canvas SUPPLIES the active track's pixels.
        // Including them here too double-composites (the "micro flash" when the
        // cache write lands) and over-saturates the live look.
        excludeActive: activeModule.value === 'watercolor'
          || engineSurfaceHidden
          || (engine != null && engine.getAppliedPreviewBaseContentToken() != null),
      } : null,
      // 50-04 (S3): the reference ghost monitor-paint layer — concrete values
      // only. The ghost layer subscribes to the store version clocks in its OWN
      // effect; this memo re-resolves on document changes (efxPaintVersion.value)
      // so a source/opacity/transform/visibility change re-targets the draw. The
      // zoom is the project→working scale (paperTextureScale) so the reference
      // image (project resolution) fits the working canvas.
      referenceGhost: programMonitorLayerId ? {
        layerId: programMonitorLayerId,
        currentFrame,
        isPlaying,
        width: canvasWidth,
        height: canvasHeight,
        zoom: paperTextureScale,
        onMissingSourceChange: handleReferenceMissingSourceChange,
      } : null,
      // 50-05 (Task 2, S4): the reference transform handles overlay — concrete
      // values only. The handles component subscribes to the store version
      // clocks in its OWN effect; this memo re-resolves on document changes
      // (efxPaintVersion.value) so a transform/lock change re-targets the
      // overlay. The zoom is the project→working scale (paperTextureScale) so
      // the handles overlay the ghost exactly (D-13). 260922-rd4 MUTUAL
      // EXCLUSION: both handle sets mount only while their own lock is open —
      // never two active sets at once (unlocking one locks the other at the
      // Studio unlock ports).
      referenceTransformHandles: programMonitorLayerId
        && stackDocument?.photoReference?.transformLocked === false
        ? {
          layerId: programMonitorLayerId,
          target: 'photo-reference' as const,
          currentFrame,
          isPlaying,
          width: canvasWidth,
          height: canvasHeight,
          zoom: paperTextureScale,
        } : null,
      // 260922-rd4: the BACKGROUND transform handles — the same envelope
      // (zoom = paperTextureScale) with target="background", gated on the
      // background's own lock.
      backgroundTransformHandles: programMonitorLayerId
        && stackDocument?.background.transformLocked === false
        ? {
          layerId: programMonitorLayerId,
          target: 'background' as const,
          currentFrame,
          isPlaying,
          width: canvasWidth,
          height: canvasHeight,
          zoom: paperTextureScale,
        } : null,
    };
  });
  // 43.6-08 (quick 260820-bjw): set-aware rotoKeyState overlay. With an active
  // rail set the strip's Copy/Duplicate/Paste buttons reflect SET scope —
  // Copy and Duplicate enable on the EFFECTIVE rail-set scope (a single rail is
  // a set of one, 43.6 Solo; Duplicate builds its payload fresh at click time and
  // is never clipboard-gated), Paste enables on the rail-set clipboard — so the
  // buttons/tooltips stop describing single-key scope. Without a set the overlay
  // is the exact session availability (byte-identical single-key path).
  const sessionKeyAvailability = rotoSession.actionAvailability.value;
  const effectiveRotoKeyState = hasEffectiveRailSetScope
    ? {
        actionAvailability: {
          ...sessionKeyAvailability,
          canCopy: rotoPhysicalActions.canCopyRailSet.value,
          canDuplicate: rotoPhysicalActions.canDuplicateRailSet.value,
          canPaste: rotoPhysicalActions.canPasteRailSet.value,
          pasteDisabledReason: rotoPhysicalActions.pasteRailSetDisabledReason.value
            ?? sessionKeyAvailability.pasteDisabledReason,
        },
        hasCopiedRotoKey: rotoSession.copiedKey.value !== null,
      }
    : { actionAvailability: sessionKeyAvailability, hasCopiedRotoKey: rotoSession.copiedKey.value !== null };
  // 47-01 mockup redesign: track CRUD + visibility intents (the add/duplicate
  // handlers moved up to the keyboard wiring — the pointer paths and the
  // guarded shortcuts share them). Each routes through its store op
  // fail-closed on the layer; refusals publish to the status capsule so the
  // user sees why the timeline did not change.
  const handleToggleTrackVisible = useCallback((trackId: string, visible: boolean) => {
    const layerId = launchContext?.layerId;
    if (!layerId) return;
    const result = setTrackVisible(layerId, trackId, visible);
    if (!result.ok) setApplyMessage(result.error);
  }, [launchContext?.layerId]);
  const handleRenameTrack = useCallback((trackId: string, name: string) => {
    const layerId = launchContext?.layerId;
    if (!layerId) return;
    const result = renameTrack(layerId, trackId, name);
    if (!result.ok) setApplyMessage(result.error);
  }, [launchContext?.layerId]);
  const handleDeleteTrack = useCallback((trackId: string) => {
    const layerId = launchContext?.layerId;
    if (!layerId) return;
    const preview = requestDeleteTrack(layerId, trackId);
    if (!preview) { setApplyMessage('Could not delete track.'); return; }
    if (preview.isLastTrack) {
      setApplyMessage('A document must always have at least one Paint track.');
      return;
    }
    const result = commitDeleteTrack(layerId, trackId, true);
    if (!result.ok) setApplyMessage(result.error);
  }, [launchContext?.layerId, currentFrame]);
  // 47-02 Task 2: header-drag reorder routing — writes ONLY the order field,
  // never the stable UUID (Pitfall 1). 261022-iff: the per-track solo route is
  // retired; the ONE solo is the session focus in the playback pill.
  // 47 UAT + quick-260913-52r (D): the per-row frame-blending toggle flips the
  // track's canonical interpolation state THROUGH THE PHYSICAL COORDINATOR —
  // the only path that reaches the parent runtime (the apply/save authority)
  // and therefore the save. The old direct physicPaint-store write shipped
  // nowhere: the 52.1 push keys on efxPaintVersion (document structure), and
  // the doc-sync mirror refuses the reference-shaped wire document (canonical
  // revision mismatch). The interpolation op is active-track-scoped, so a
  // non-active row's toggle focuses that row first (one synchronous store
  // switch). Skipped while a physical edit is pending, like the toolbox
  // toggle.
  const handleToggleBlend = useCallback((trackId: string) => {
    const layerId = launchContext?.layerId;
    if (!layerId) return;
    if (physicalEditCoordinator.pendingOperationId.value !== null) return;
    const document = getEfxPaintDocument(layerId);
    if (!document) return;
    if (document.activeTrackId !== trackId) setActiveTrackId(layerId, trackId);
    const trackDocument = physicPaintStore.getRotoPhysicalDocument(layerId, trackId);
    const current = physicPaintStore.getRotoPhysicalInterpolationState(layerId, trackId);
    const selectedKeyId = trackDocument?.selectedKeyId ?? null;
    void physicalEditCoordinator.executePhysicalEdit({
      operationKind: 'set-interpolation-enabled',
      expectedLaunch: { operationId: launchContext.operationId, layerId },
      records: physicPaintStore.getRotoRealKeyRecords(layerId, trackId),
      targetInterpolation: { enabled: !current.enabled, mode: current.mode },
      selectedKeyId,
      selectedAppFrame: selectedKeyId === null ? null : (trackDocument?.cursorAppFrame ?? null),
    });
  }, [launchContext, physicalEditCoordinator]);
  const handleReorderTrack = useCallback((trackId: string, newOrder: number) => {
    const layerId = launchContext?.layerId;
    if (!layerId) return;
    const result = reorderTrack(layerId, trackId, newOrder);
    if (!result.ok) setApplyMessage(result.error);
  }, [launchContext?.layerId]);
  // 47-01: the multi-track row bundle is document-derived. Reading
  // `efxPaintVersion.value` subscribes the bundle to every store mutation
  // (setActiveTrackId included) so a row-header click flips the active row.
  const multiTrackRowBundle = useMemo(() => {
    const layerId = launchContext?.layerId;
    if (!layerId) return {
      layerId: undefined, tracks: undefined, activeTrackId: undefined, background: undefined, photoReference: undefined,
      onSelectTrack: undefined, onAddTrack: undefined, onToggleTrackVisible: undefined,
      onToggleBlend: undefined, onRenameTrack: undefined,
      onDuplicateTrack: undefined, onDeleteTrack: undefined, onReorderTrack: undefined,
      onSelectTrackFrame: undefined, onSelectTrackRail: undefined, onSelectBackgroundClip: undefined, onSelectBackgroundFrame: undefined,
      selectedBackgroundClipId: null, backgroundPlacementFrame: null,
    };
    const document = getEfxPaintDocument(layerId);
    if (!document) return {
      layerId, tracks: undefined, activeTrackId: undefined, background: undefined, photoReference: undefined,
      onSelectTrack: undefined, onAddTrack: undefined, onToggleTrackVisible: undefined,
      onToggleBlend: undefined, onRenameTrack: undefined,
      onDuplicateTrack: undefined, onDeleteTrack: undefined, onReorderTrack: undefined,
      onSelectTrackFrame: undefined, onSelectTrackRail: undefined, onSelectBackgroundClip: undefined, onSelectBackgroundFrame: undefined,
      selectedBackgroundClipId: null, backgroundPlacementFrame: null,
    };
    return {
      layerId,
      tracks: document.tracks,
      activeTrackId: document.activeTrackId,
      background: document.background,
      photoReference: document.photoReference,
      // 49-06 (UAT round 2): selecting a Paint track returns the right panel to
      // Track option — it clears any selected Bg clip (the Background tab
      // disappears) and switches the tool tab to Track.
      onSelectTrack: (trackId: string) => {
        setActiveTrackId(layerId, trackId);
        selectedBackgroundClipId.value = null;
        rightPanelToolTab.value = 'track';
      },
      onSelectTrackFrame: handleSelectTrackFrame,
      onSelectTrackRail: handleSelectTrackRail,
      // 49-06 (UAT round 2): a Bg rail click opens the Background option tab
      // (a THIRD tab — it never replaces Track option). Same-clip re-click
      // toggles the selection off and returns to Track option.
      onSelectBackgroundClip: (clipId: string) => {
        const next = selectedBackgroundClipId.value === clipId ? null : clipId;
        selectedBackgroundClipId.value = next;
        rightPanelToolTab.value = next === null ? 'track' : 'background';
      },
      // 49-06 (UAT round 2): the placement gesture — clicking an empty Bg cell
      // selects the target frame (the Import control lands there) and clears
      // any selected clip so the Track section stays reachable.
      onSelectBackgroundFrame: (frame: number) => {
        backgroundPlacementFrame.value = frame;
        selectedBackgroundClipId.value = null;
        rightPanelToolTab.value = 'track';
      },
      selectedBackgroundClipId: selectedBackgroundClipId.value,
      backgroundPlacementFrame: backgroundPlacementFrame.value,
      onAddTrack: handleAddTrack,
      onToggleTrackVisible: handleToggleTrackVisible,
      onToggleBlend: handleToggleBlend,
      onRenameTrack: handleRenameTrack,
      onDuplicateTrack: handleDuplicateTrack,
      onDeleteTrack: handleDeleteTrack,
      onReorderTrack: handleReorderTrack,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launchContext?.layerId, efxPaintVersion.value, selectedBackgroundClipId.value, backgroundPlacementFrame.value]);
  // 47-01: the Studio window owns its own efxPaintStore instance — track CRUD
  // mutates the CHILD document only. Push it to the main window on every
  // document mutation so the main window's save path serializes the same
  // track list (idempotency is guarded by document revision on the main
  // side). The push fires for the launch registration too — both windows
  // already hold that document, so it is a revision no-op.
  // 47-01 UAT round 7: push the LIVE runtime projection (serializeRuntimeIntoDocument)
  // instead of the raw document — the raw document never re-projects the
  // child's runtime, so Track 1's rotoPhysical stayed at launch state and the
  // main window's runtime mirror + save path diverged from the child's live
  // records (delete rejections, keys lost on save).
  // 52.1 (Part 1): the push fires ONLY on document-structure changes
  // (efxPaintVersion). Physical edits (drag/paint) are excluded — they ship
  // their result via the applyPayload bridge, and the main window's save path
  // re-projects frames/rotoPhysical from its own runtime (updated by
  // applyPayload), so a document sync on every paint event was redundant (the
  // 52.1 slowdown: a full 10MB document re-serialized + base64-encoded twice
  // per action). The round-8 physicPaintVersion debounce is retired.
  // 52.1 (Fix A): the push's serialize bumps efxPaintVersion, which re-fires
  // the immediate push effect — the same document would cross the bridge twice
  // per gesture. The guard skips the duplicate; its hasPushed latch keeps the
  // launch/crash-recovery mount push alive.
  const documentSyncPushGuardRef = useRef<DocumentSyncPushGuard | null>(null);
  if (documentSyncPushGuardRef.current === null) {
    documentSyncPushGuardRef.current = createDocumentSyncPushGuard();
  }
  // quick-260921-ffh: the decision is the hoisted guard link (the guard read +
  // the duplicate check). It is created here, once per render, exactly where
  // the render used to read the ref into a local. It consults the REF at
  // decision time, so the retry armed by the failure path below (:3981) is
  // decided against the guard that path installed — not against the one every
  // earlier push latch made look like a duplicate.
  const documentSyncPushDecision = createDocumentSyncPushDecision(
    documentSyncPushGuardRef,
    () => efxPaintVersion.peek(),
  );
  // 260921-e21 (T-260921-e21-03): the guard latches its fingerprint BEFORE the
  // send resolves, so a failed send would suppress the same content for the
  // rest of the session unless the guard is re-armed. This counts the automatic
  // re-flushes already armed for the current failure streak; a landed push
  // resets it.
  const documentSyncPushFailuresRef = useRef(0);
  const pushLiveProjection = (layerId: string, mode: 'Tauri' | 'Browser fallback'): Promise<void> | null => {
    const pushStartedAtMs = performance.now();
    const document = documentSyncPushDecision.decide(() => {
      try {
        return serializeRuntimeIntoDocument(layerId);
      } catch {
        return getEfxPaintDocument(layerId);
      }
    });
    recordPhysicsPaintPerformance({
      stage: 'bridge.docSyncSerialize',
      category: 'sync-cpu',
      durationMs: performance.now() - pushStartedAtMs,
      timestamp: performance.now(),
    });
    if (!document) return null;
    // 49-06 (UAT round 11): carry the runtime background source bytes to the
    // main window — ITS registry is only hydrated at project load, so a clip
    // added during the child session (the Bg-picker import) resolves 'missing'
    // in the main composite without this transfer. Only the refs this
    // document's clips use, and only those with registered bytes.
    const backgroundSources: Record<string, string> = {};
    for (const clip of document.background.clips) {
      for (const ref of clip.sourceFrameRefs) {
        if (backgroundSources[ref]) continue;
        const bytes = physicPaintStore.getBackgroundSourceImageBytes(ref);
        if (bytes !== null) backgroundSources[ref] = encodeSourceBytesForDocumentSync(bytes);
      }
    }
    // Crash-recovery checkpoint: the compositor-death watchdog reloads the
    // child when the window goes black. sessionStorage survives the reload, so
    // the Studio rehydrates from THIS document instead of the stale launch
    // context — the session survives (bounded by the push debounce). The
    // checkpoint is bound to this launch's operationId (quick-260913-52r H):
    // a checkpoint left by an earlier Studio session is never substituted.
    const checkpointStartedAtMs = performance.now();
    const checkpointOperationId = launchContextRef.current?.operationId;
    if (checkpointOperationId) writeEfxPaintSessionDocumentCheckpoint(checkpointOperationId, document);
    recordPhysicsPaintPerformance({
      stage: 'bridge.docSyncCheckpoint',
      category: 'sync-cpu',
      durationMs: performance.now() - checkpointStartedAtMs,
      timestamp: performance.now(),
    });
    return sendEfxPaintDocumentSync(
      document,
      mode,
      Object.keys(backgroundSources).length > 0 ? backgroundSources : undefined,
    ).then(() => {
      // The document reached the main realm: the failure streak is over and the
      // retry budget re-arms. The pending flag is left as the caller set it —
      // clearing it here would swallow a mutation that landed DURING the send.
      documentSyncPushFailuresRef.current = 0;
    }).catch((error) => {
      // 260921-e21 (T-260921-e21-03): a failed send must not swallow the change
      // that was riding it. Re-arm the guard (its fingerprint is latched for
      // this exact content, so the next attempt would be skipped silently) and
      // keep the change owed for a bounded number of automatic re-flushes.
      documentSyncPushGuardRef.current = createDocumentSyncPushGuard();
      if (documentSyncPushFailuresRef.current < DOCUMENT_SYNC_MAX_AUTO_RETRIES) {
        documentSyncPushFailuresRef.current += 1;
        documentSyncDirty.value = true;
      }
      console.warn('[PhysicsPaintStudio] EFX Paint document sync failed:', error);
    }).finally(() => {
      recordPhysicsPaintPerformance({
        stage: 'bridge.docSyncTotal',
        category: 'async-elapsed',
        durationMs: performance.now() - pushStartedAtMs,
        timestamp: performance.now(),
      });
    });
  };
  // 52.1 (gesture-idle scheduler): STRUCTURAL mutations only SET a dirty flag;
  // the serialize + documentSync runs ONCE on the idle transition (gesture
  // path) or on a 2s debounce (non-gesture edits while already idle). Physical
  // edits are excluded (see Part 1 above) — they ship via applyPayload.
  const documentSyncDirtyRef = useRef(signal(false));
  const documentSyncDirty = documentSyncDirtyRef.current;
  useEffect(() => {
    documentSyncDirty.value = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [efxPaintVersion.value]);
  // 52.1 (background sync on close): wire the close-flush refs to the live dirty
  // flag + push so a bare non-stroke document change survives window close.
  // 260921-e21 (T-260921-e21-04): a change stays OWED until a push was actually
  // attempted — the close gate reports a still-unpushed change (the retry
  // budget did not consume it), so the last flush of the session is never
  // skipped over a flag that a failed push left false.
  pendingDocumentSyncRef.current = () => documentSyncDirty.peek() || documentSyncPushFailuresRef.current > 0;
  flushDocumentSyncRef.current = async () => {
    if (!documentSyncDirty.peek() && documentSyncPushFailuresRef.current === 0) return;
    const layerId = launchContext?.layerId;
    const mode = bridgeModeRef.current;
    // 260921-e21: the pending change is consumed ONLY here, once the push mode
    // is confirmed and the send is about to be attempted. Clearing it while the
    // bridge mode is still unresolved (usePhysicsPaintBridgeMode starts
    // 'Unavailable') dropped it with no push and no retry — the reference
    // selection, the background keyframes and the (+) track all travel only
    // through this push, so one clear here lost the whole session's structure.
    if (layerId && (mode === 'Tauri' || mode === 'Browser fallback')) {
      documentSyncDirty.value = false;
      await pushLiveProjection(layerId, mode);
    }
  };
  // Non-gesture path: a mutation while already idle flushes on a 2s debounce.
  // 52.1: also require 1s of real quiet at fire time — a 2s timer can still
  // land inside a short pause mid-train (idle flips after 400ms of silence).
  useEffect(() => {
    if (!documentSyncDirty.value) return;
    let timer: number | null = null;
    const tryFlush = () => {
      timer = null;
      if (!readInteractionIdle() || !documentSyncDirty.peek()) return;
      const quietMs = performance.now() - readLastInteractionAt();
      if (quietMs < DOCUMENT_SYNC_GESTURE_QUIET_MS) {
        timer = window.setTimeout(tryFlush, DOCUMENT_SYNC_GESTURE_QUIET_MS - quietMs);
        return;
      }
      const layerId = launchContext?.layerId;
      const mode = bridgeModeRef.current;
      // 260921-e21 (T-260921-e21-04): consumed only once the push mode is
      // confirmed — an unresolved mode must leave the change pending for the
      // next flush instead of clearing it into nothing.
      if (layerId && (mode === 'Tauri' || mode === 'Browser fallback')) {
        documentSyncDirty.value = false;
        void pushLiveProjection(layerId, mode);
      }
    };
    timer = window.setTimeout(tryFlush, 2000);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentSyncDirty.value, launchContext?.layerId]);
  // Gesture path: the idle transition flushes any pending dirty state once.
  // 52.1: the gesture flush must wait for 1s of REAL quiet, not the 400ms
  // idle flip — that flip lands in the gap between two strokes, and on a
  // virgin frame the full-document serialize + push + main-window cold decode
  // saturate the shared GPU process exactly there (the felt 2nd-stroke
  // glitch). Re-arm until the gesture train has been silent for a full second.
  useEffect(() => {
    if (!interactionIdle.value) return;
    if (!documentSyncDirty.peek()) return;
    let timer: number | null = null;
    const tryFlush = () => {
      timer = null;
      if (!readInteractionIdle() || !documentSyncDirty.peek()) return;
      const quietMs = performance.now() - readLastInteractionAt();
      if (quietMs < DOCUMENT_SYNC_GESTURE_QUIET_MS) {
        timer = window.setTimeout(tryFlush, DOCUMENT_SYNC_GESTURE_QUIET_MS - quietMs);
        return;
      }
      const layerId = launchContext?.layerId;
      const mode = bridgeModeRef.current;
      // 260921-e21 (T-260921-e21-04): same contract as the debounced path — the
      // idle transition must not consume a change no push can carry yet.
      if (layerId && (mode === 'Tauri' || mode === 'Browser fallback')) {
        documentSyncDirty.value = false;
        void pushLiveProjection(layerId, mode);
      }
    };
    tryFlush();
    return () => {
      if (timer !== null) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactionIdle.value, launchContext?.layerId]);
  // 52.1 (flush-before-save/export): the main window requests a synchronous
  // drain of the Studio's queued post-gesture work before it serializes the
  // project. The flush settles the engine, drains the Roto capture queue, and
  // pushes the document ONLY when a structural change is pending
  // (documentSyncDirty) — physical edits already ship via applyPayload, so a
  // document push on every auto-save was redundant (the 52.1 slowdown: the
  // auto-save → flush → documentSync path re-serialized the full document on
  // every paint/drag).
  const flushStudioStateRef = useRef<() => Promise<void>>(() => Promise.resolve());
  flushStudioStateRef.current = async () => {
    // 52.1: mid-gesture the unbounded finalize drain synchronously rasters the
    // previous stroke (~1.3s at 1080p) inside the user's current stroke — the
    // 2nd-stroke freeze. Completed strokes already carry their pixels through
    // the capture queue (copied at stroke end), and the interactive finalizer
    // drains the queue cooperatively once the gesture ends, so skip the drain
    // whenever a gesture is in flight; idle flushes keep the full contract.
    //
    // 52.2-15 (D-16): the steps below are unchanged; they now run inside the
    // Studio's one flush pipeline, which first waits out the gesture's queued
    // captures (the drain cannot race a capture still producing) and hands the
    // same drain to a concurrent close instead of running a second sequence.
    await runStudioFlush([
      () => {
        if (!readInteractionIdle()) return;
        // Brush: force the cosmetic wet layer dry before the capture — the
        // durable payload must be the settled colour, never the fluorescent
        // wet look (copyLiveAlphaCanvas composites the wet display on top).
        if (activeModule.value === 'watercolor') engineRef.current?.flushPendingStrokeFinalizations();
        else engineRef.current?.forceDry();
      },
      // Save must also flush the watercolor sheet. Without this the flush
      // drained an empty queue while the sheet was still wet and the package
      // serializer wrote the blank key payload (proven live: project saved at
      // 12:02:33, capture committed at 12:02:43, saved key was 88 bytes).
      () => flushAquarellePixels(),
      async () => {
        if (!documentSyncDirty.peek()) return;
        const layerId = launchContext?.layerId;
        const mode = bridgeModeRef.current;
        if (layerId && (mode === 'Tauri' || mode === 'Browser fallback')) {
          await pushLiveProjection(layerId, mode);
        }
      },
    ]);
  };
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void installPhysicPaintFlushRequestListener(() => flushStudioStateRef.current()).then((unsub) => {
      unlisten = unsub;
    });
    return () => unlisten?.();
  }, []);
  // 49-04 (Task 2): the scoped full-area asset picker (S2). The Studio realm's
  // imageStore is empty (Pitfall 2), so the picker populates its grid from the
  // main webview via the image-library bridge pair and imports new images
  // through the native dialog (capability dialog:allow-open, Task 1). The
  // controller is signal-driven (no useState — efx-preact-reactivity).
  // 50-03 (S2): the reference picker reuses the SAME controller + view as the
  // Bg picker (D-01) — only the title and the Confirm handler differ. The four
  // bridge/imageStore ports are shared; each controller keeps its own
  // refreshLibrary closure so the self-referencing projectDir peek stays
  // instance-local.
  const sharedPickerPorts = {
    requestLibrary: () => requestImageLibrary(),
    // quick-260921-bjm: the import is performed by the MAIN realm — the realm
    // that owns the library record the manifest persists. This used to call the
    // child realm's own imageStore import HERE, in the Studio webview: a
    // different module instance from the main webview's, so the record never
    // reached `buildMceProject().images` and the next launch showed an empty
    // gallery. The dialog-selected directory is deliberately unused (the main
    // realm resolves its own); the controller's pre-flight guard still runs
    // first.
    importFiles: async (paths: string[], _projectDir: string) => {
      const result = await requestImageImport(paths);
      if (!result.ok) throw new Error(result.error ?? 'Image import failed');
    },
    openDialog: async () => {
      const selected = await openNativeImageDialog({
        multiple: true,
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'tiff', 'tif', 'heic', 'heif'] }],
      });
      if (!selected) return null;
      return Array.isArray(selected) ? selected : [selected];
    },
    sortImages: (images: readonly MceImageRef[]) => sortImagesByOriginalFilename(images, (image) => image.original_filename),
  };
  const backgroundPicker = useBackgroundAssetPickerController({
    ...sharedPickerPorts,
    refreshLibrary: async () => {
      const result = await requestImageLibrary();
      const dir = backgroundPicker.projectDir.peek();
      const studioImages = dir ? imageStore.toMceImages(dir) : [];
      return mergeImageLibraries(result.ok ? result.images : [], studioImages);
    },
  });
  const referencePicker = useBackgroundAssetPickerController({
    ...sharedPickerPorts,
    refreshLibrary: async () => {
      const result = await requestImageLibrary();
      const dir = referencePicker.projectDir.peek();
      const studioImages = dir ? imageStore.toMceImages(dir) : [];
      return mergeImageLibraries(result.ok ? result.images : [], studioImages);
    },
  });
  // 49-04 (Task 2): temporary dev hook for the native checkpoint (Task 3) —
  // the S1 Import control lands in 49-05 and becomes the real opener. Exposed
  // as window.__openBackgroundPicker() so the user can invoke the picker from
  // the Studio console during UAT.
  const backgroundPickerOpenHookRef = useRef<(() => Promise<void>) | null>(null);
  backgroundPickerOpenHookRef.current = () => backgroundPicker.openPicker();
  useEffect(() => {
    (window as unknown as { __openBackgroundPicker?: () => void }).__openBackgroundPicker = () => {
      void backgroundPickerOpenHookRef.current?.();
    };
    return () => {
      delete (window as unknown as { __openBackgroundPicker?: () => void }).__openBackgroundPicker;
    };
  }, []);
  // 49-05 (Task 1): Confirm creates the Background clip at the CURRENT playhead
  // frame — read at Confirm time from the live cursor position (launchContext
  // startFrame updates on every navigation), never cached at picker-open time
  // (BKG-02/D-03). The natural-sorted reference order is the clip's source-frame
  // cycle order (D-02); the repeat defaults to finite 1. A playhead strictly
  // inside an existing clip rejects through the capsule with the locked import
  // copy (BKG-03/D-04) and the picker STAYS open so the selection survives;
  // success closes the picker and the rail reflects the accepted state via the
  // existing reactive plumbing.
  const handleConfirmBackgroundPicker = (sortedIds: string[]) => {
    const layerId = launchContext?.layerId;
    if (!layerId || sortedIds.length === 0) return;
    // 49-06 (UAT round 7): Replace mode — the section's Replace button set the
    // target clip; the confirmed refs swap that clip's source instead of adding
    // a new clip. The clip keeps its id/startFrame/repeat; only the source
    // cycle changes.
    const replaceTarget = backgroundReplaceTargetClipId.value;
    const landingFrame = backgroundPlacementFrame.value ?? currentFrame;
    const result = replaceTarget
      ? setBackgroundClipSource(layerId, replaceTarget, sortedIds)
      : addBackgroundClip(layerId, {
          startFrame: landingFrame,
          sourceFrameRefs: sortedIds,
          repeat: { mode: 'finite', count: 1 },
        });
    if (!result.ok) {
      if (result.reason === 'start-collision') {
        setApplyStatus('error');
        setApplyMessage("Couldn't place the clip here. The playhead is inside an existing clip. Nothing changed.");
      }
      return;
    }
    // 49-06 (UAT): the compositor only renders a clip once its source bytes are
    // in the runtime registry (`_backgroundSourceImages` → knownSources) — the
    // reopened-path hydration (49-02 BKG-09) is the SOLE production writer of
    // that registry, and the freshly imported clip was never passed through it.
    // Run it on the accepted document so the rail's cover frames resolve
    // 'content' instead of 'missing' (the monitor paper fond symptom). For a
    // replace, this re-hydrates the NEW refs (the document now carries them).
    const accepted = getEfxPaintDocument(layerId);
    if (accepted) {
      // 49-06 (UAT round 3): resolve the confirmed refs from the picker's OWN
      // image list as a fallback — the launch-time library load can miss a
      // freshly imported image (it only reaches the Studio realm's imageStore
      // on the next launch), and the picker's merged list is authoritative for
      // exactly the ids being confirmed.
      const pickerImages = backgroundPicker.images.peek();
      const pickerDir = backgroundPicker.projectDir.peek();
      void hydrateBackgroundSourceImagesFromLibrary(
        accepted,
        pickerDir ? { images: pickerImages, projectDir: pickerDir } : undefined,
      ).then((result) => {
        // 49-06 (UAT round 4/5): surface the hydration outcome — a clip whose
        // source bytes never reached the runtime registry stays paper fond, and
        // the reason (asset miss vs decode failure) is the diagnostic the user
        // reports back. When the hydration SUCCEEDED but the composite is still
        // paper, probe the render path so the exact failure point is named.
        if (result.missing.length > 0) {
          const first = result.missing[0];
          setApplyStatus('error');
          setApplyMessage(
            first.reason === 'asset-not-found'
              ? `Background source not found in the library (${first.ref}). The clip can't render.`
              : `Background source failed to load (${first.ref}). The clip can't render.`,
          );
          return;
        }
        const record = physicPaintStore.getFlattenedFrame(layerId, landingFrame, false);
        if (!record) {
          setApplyStatus('error');
          setApplyMessage('Background source decoded, but the composite is still pending. If this persists, the image may be too large to decode.');
          return;
        }
        const bgMissing = record.missing.find((entry) => entry.trackId === accepted.background.id);
        if (bgMissing) {
          setApplyStatus('error');
          setApplyMessage(`Background still missing at frame ${landingFrame}: ${bgMissing.missingRefs.join(', ')}.`);
        }
      });
    }
    // The placement marker is consumed — a stale target would collide with the
    // just-created clip on the next import. The replace target is consumed too.
    backgroundPlacementFrame.value = null;
    backgroundReplaceTargetClipId.value = null;
    backgroundPicker.cancel();
  };
  // 49-06 (UAT round 7): cancelling the picker must also clear the replace
  // target — a stale target would swap the wrong clip on the next confirm.
  const handleCancelBackgroundPicker = () => {
    backgroundReplaceTargetClipId.value = null;
    backgroundPicker.cancel();
  };
  // 50-03 (S2): Confirm REPLACES the reference source in one undoable operation
  // (D-03). The confirmed ids are already natural-sorted by the picker's
  // buildConfirmedImageIds (D-02 — never asset UUID or click order); the store
  // call bumps the source revision (REF-04) and records one undo entry. The
  // reference source bytes hydrate through the library path so the ghost draw
  // (Plan 50-04) resolves them. Success announces the replacement capsule note.
  const handleConfirmReferencePicker = (sortedIds: string[]) => {
    const layerId = launchContext?.layerId;
    if (!layerId || sortedIds.length === 0) return;
    const result = setPhotoReferenceSource(layerId, sortedIds);
    if (!result.ok) {
      setApplyStatus('error');
      setApplyMessage(result.reason === 'invalid-source-refs'
        ? "Couldn't set the reference source. The selection is invalid."
        : "Couldn't set the reference source.");
      return;
    }
    // G-52-5: record the unified-ledger undo entry the 50-03 contract promises
    // (one undoable operation, D-03). Dropping the descriptor left an
    // unrecorded document replacement in the chain — every entry recorded
    // BEFORE a reference placement/replacement failed the live-authority guard
    // forever, killing undo/redo for the session.
    if (result.descriptor) rotoMoveHistory.recordBackgroundEdit(result.descriptor);
    // Warm the reference registry with the freshly confirmed refs (mirrors the
    // Bg picker's hydration — the reopened path is the sole production writer,
    // and a fresh import never passed through it).
    const accepted = getEfxPaintDocument(layerId);
    if (accepted) {
      const pickerImages = referencePicker.images.peek();
      const pickerDir = referencePicker.projectDir.peek();
      void hydrateReferenceSourceImagesFromLibrary(
        accepted,
        pickerDir ? { images: pickerImages, projectDir: pickerDir } : undefined,
      );
    }
    publishOperationResult('Reference source replaced.');
    referencePicker.cancel();
  };
  // 50-03 (S2): Cancel returns to the Studio untouched — no source change, no
  // document mutation.
  const handleCancelReferencePicker = () => {
    referencePicker.cancel();
  };
  /* ---------------------------------------------------------------------------
   * 52.5-01b (D-02/D-03/D-05) + 261008-ig1 Task 2: the Document sound flow.
   * The signal declarations moved UP beside `rightPanelToolTab` (the keyboard
   * hook's state reads `selectedSoundId` — TDZ law). What lives HERE: the
   * controller instance — the gallery Confirm flow drives the SAME signal
   * instance the modal renders (beginReading → decode → applyImportedSource /
   * applyReplacedSource → endReading) — and the handlers below it.
   * ------------------------------------------------------------------------- */
  const refreshAudioAssets = async (): Promise<PhysicPaintAudioAssetRef[]> => {
    const result = await requestImageLibrary('audio');
    const assets = result.ok ? result.audioAssets ?? [] : [];
    audioProjectDir.value = result.ok && result.projectDir.length > 0 ? result.projectDir : null;
    return assets;
  };
  // 261009-ofk: disk-based missing probe — the file at sourcePath must resolve.
  const refreshMissingAudioPaths = async (): Promise<void> => {
    const layerId = launchContext?.layerId;
    if (!layerId) return;
    const audios = getEfxPaintDocument(layerId)?.audios ?? [];
    const sourcePaths = audios.map((clip) => clip.sourcePath);
    const missing = await collectMissingSoundSourcePaths(sourcePaths, async (p) => {
      try {
        const r = await fetch(assetUrl(p));
        void r.body?.cancel();
        return r.ok;
      } catch {
        return false;
      }
    });
    missingAudioSourcePaths.value = missing;
  };
  useEffect(() => {
    void refreshAudioAssets();
    void refreshMissingAudioPaths();
    return undefined;
  }, []);
  const audioModalController = usePhysicsPaintAudioController({
    layerId: launchContext?.layerId ?? '',
    // 261008-ig1 Task 2: the controller resolves the edited clip from THIS
    // selection (never the list head) — same signal the band + modal bind.
    selectedSoundId,
    ports: {
      getDocument: (layerId) => getEfxPaintDocument(layerId) ?? undefined,
      // addSound/patchSound/removeSound default to the per-clip store doors
      // (no slot shim — 261008-ig1 Task 2).
      getFps: () => launchContext?.fps ?? efxPaintDocumentAudioStore.getFps(),
      isSoundMissing: (sound) => isSoundSourceMissing(missingAudioSourcePaths.value, sound.sourcePath),
      // 261010-ht0 F5: Fit to view reads the strip-registered viewport getter
      // (module-level, no per-scroll signal).
      getTimelineViewport: () => getTimelineViewportFrames(),
    },
  });
  // 261008-ryq: publish the LATEST controller to the identity-stable ports ref
  // (render-body ref write — launchContextRef precedent, not a signal).
  audioModalControllerRef.current = audioModalController;
  // 52.5-01b (D-02/D-03): the ONE shared gallery in kind 'audio' mode — same
  // controller, same region-swap view; only the listing target, the dialog
  // filter and the import kind differ (never a second picker, never a new
  // file-dialog path). Audio filter = the D-04 format list + the main app's
  // extra containers (m4a/aif/aiff decode through the same audioEngine path).
  const audioPicker = useBackgroundAssetPickerController(
    {
      requestLibrary: () => requestImageLibrary('audio'),
      importFiles: async (paths: string[], _projectDir: string) => {
        const result = await requestImageImport(paths, 'audio');
        if (!result.ok) throw new Error(result.error ?? 'Audio import failed');
      },
      openDialog: async () => {
        const selected = await openNativeImageDialog({
          multiple: true,
          filters: [{ name: 'Audio', extensions: ['wav', 'mp3', 'aac', 'flac', 'm4a', 'aif', 'aiff'] }],
        });
        if (!selected) return null;
        return Array.isArray(selected) ? selected : [selected];
      },
      sortImages: (images: readonly MceImageRef[]) => sortImagesByOriginalFilename(images, (image) => image.original_filename),
      // Audio mode never lists image rows (stub keeps the shared ports type).
      refreshLibrary: async () => [],
      // Post-import refresh doubles as the missing-probe set refresh.
      refreshAudioLibrary: refreshAudioAssets,
    },
    'audio',
  );
  // 52.5-01b: gallery Confirm — close FIRST (the step-aside lifts, so the
  // modal's `Reading audio…` / error states are visible during the decode),
  // then fetch + decode the confirmed ref through the EXISTING machinery
  // (assetUrl fetch → audioEngine.decode — D-04 no new decode path), cache
  // its peaks keyed by sourceId (the task-3 stain reads them), and commit
  // through the controller: 'append' = applyImportedSource (ALWAYS a fresh
  // clip, D-01), 'replace' = applyReplacedSource (the SELECTED clip's source,
  // position/in-out preserved). A successful commit reveals the edited clip.
  const handleConfirmAudioPicker = (sortedIds: string[]) => {
    const layerId = launchContext?.layerId;
    const assetId = sortedIds[0];
    const projectDir = audioPicker.projectDir.peek();
    if (!layerId || !assetId || !projectDir) return;
    const asset = audioPicker.audioAssets.peek().find((entry) => entry.id === assetId);
    if (!asset) return;
    audioPicker.cancel();
    void (async () => {
      audioModalController.beginReading();
      try {
        const response = await fetch(assetUrl(asset.sourcePath));
        if (!response.ok) throw new Error(`efxasset fetch failed (status ${response.status})`);
        const bytes = await response.arrayBuffer();
        const buffer = await audioEngine.decode(asset.id, bytes);
        // UAT round 4: the source frame count powers the band's trim window.
        audioPeaksCache.set(asset.id, computeWaveformPeaks(buffer), Math.max(1, Math.ceil(buffer.duration * (launchContext?.fps ?? efxPaintDocumentAudioStore.getFps()))));
        const source = {
          sourceId: asset.id,
          sourcePath: asset.sourcePath,
          durationSec: buffer.duration,
        };
        const mode = audioImportMode.peek();
        const result = mode === 'replace'
          ? audioModalController.applyReplacedSource(source)
          : audioModalController.applyImportedSource(source);
        audioModalController.endReading();
        if (result.ok) {
          audioModalController.clearError();
          // 261009-ofk: re-probe after a successful import/replace commit.
          void refreshMissingAudioPaths();
          // Reveal the edited clip on the strip (select + fresh nonce).
          const placedId = selectedSoundId.peek();
          const placed = placedId !== null
            ? getEfxPaintDocument(layerId)?.audios.find((clip) => clip.id === placedId)
            : undefined;
          if (placed) revealSoundClip(placed);
        }
      } catch {
        // E1/E10: decode failure surfaces the contracted error copy and
        // re-enables the CTA (busy cleared, prior clip/empty state retained).
        audioModalController.reportDecodeError();
      }
    })();
  };
  const audioModal = {
    open: audioModalTarget.value !== null,
    controller: audioModalController,
    onClose: () => { audioModalTarget.value = null; },
    // The modal NEVER talks to a file dialog itself (D-02/D-03): the intent
    // leaves through this port WITH its mode (append = fresh clip, replace =
    // the selected clip's source) and opens the shared gallery in audio mode.
    onImportRequest: (mode: 'append' | 'replace') => {
      audioImportMode.value = mode;
      void audioPicker.openPicker();
    },
    // 261009-6ee one-switch law: the modal carries no preview props anymore.
    // The main-app-audio preview surface is the STRIP's Audio Preview toggle
    // (audioPreviewEnabled / handleAudioPreviewToggle passed to the workflow
    // strip below) — same session signal, untouched here.
  };
  /* ---- 52.5-01b Task 3 (D-04/E3): peaks ensure on reopen ----------------
     Peaks are cached at import (handleConfirmAudioPicker); after save/reopen
     the cache is cold and the band must still draw (E3 populated on reopen).
     This re-derives them through the EXISTING machinery — assetUrl fetch →
     audioEngine.decode → computeWaveformPeaks, keyed by sourceId (D-04: no
     new decode path; a clipId-keyed buffer from monitor prepare is reused when
     present). 261008-ig1: runs for EVERY distinct sourceId in `audios[]` —
     duplicates share one cached decode (source-keyed law, never clip-keyed).
     Fail-closed: any failure leaves the cache empty → no stain, and the modal
     carries the error copy. Termination: one in-flight ensure per sourceId
     (Set ref guard), early return on cache hit / missing URL; the effect
     re-runs only on launch/document/section identity changes — never a loop. ---- */
  const soundPeaksEnsureRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!launchContext) return undefined;
    const audios = getEfxPaintDocument(launchContext.layerId)?.audios ?? [];
    // One ensure per distinct source — the peaks cache is source-keyed.
    const pendingSources = [...new Set(audios.map((clip) => clip.sourceId))]
      .filter((sourceId) => audioPeaksCache.get(sourceId) === undefined
        && !soundPeaksEnsureRef.current.has(sourceId));
    if (pendingSources.length === 0) return undefined;
    // UAT round 5 (reopen): the routed documentAudio section is the preferred
    // URL source, but it is not the ONLY one. After a project close/reopen the
    // clip and its gallery entry survive while the section may never be routed
    // to this child window — the band then stayed empty until a manual Replace
    // re-warmed the cache. Fall back to the bare sourcePath (261009-ofk: the
    // absolute disk path, resolved through assetUrl — no projectRoot join).
    const section = efxPaintDocumentAudioStore.section.value;
    for (const sourceId of pendingSources) soundPeaksEnsureRef.current.add(sourceId);
    void (async () => {
      try {
        for (const sourceId of pendingSources) {
          const clip = audios.find((entry) => entry.sourceId === sourceId);
          if (!clip) continue;
          const sectionEntry = section?.clips.find((ref) => ref.clipId === clip.id) ?? null;
          const sectionUrl = sectionEntry ? sectionEntry.assetUrl : null;
          // 261009-ofk: sourcePath is absolute — the bare path is the URL.
          const fallbackUrl = assetUrl(clip.sourcePath);
          const sourceUrl = sectionUrl ?? fallbackUrl;
          if (sourceUrl === null) continue;
          try {
            let buffer = audioEngine.getBuffer(sourceId) ?? audioEngine.getBuffer(clip.id);
            if (!buffer) {
              const response = await fetch(sourceUrl);
              if (!response.ok) throw new Error(`efxasset fetch failed (status ${response.status})`);
              buffer = await audioEngine.decode(sourceId, await response.arrayBuffer());
            }
            if (audioPeaksCache.get(sourceId) === undefined) {
              audioPeaksCache.set(sourceId, computeWaveformPeaks(buffer), Math.max(1, Math.ceil(buffer.duration * (launchContext?.fps ?? efxPaintDocumentAudioStore.getFps()))));
            }
          } catch {
            // E3 error state: fail-closed — cache stays empty, band stays plain.
          }
        }
      } finally {
        for (const sourceId of pendingSources) soundPeaksEnsureRef.current.delete(sourceId);
      }
    })();
    return undefined;
  }, [launchContext, efxPaintVersion.value, efxPaintDocumentAudioStore.section.value, audioProjectDir.value]);
  /** Gesture settle port for the band (D-08/D-09): dragged start/in/out land
   *  through the per-clip store door every modal commit uses (T-52.5-12/13).
   *  Returns whether the door accepted the write — rejected or identical
   *  values leave the prior accepted span authoritative (the strip restores
   *  its preview in that case). */
  const handleDocumentSoundGestureSettle = (patch: SoundBandGesturePatch): boolean => {
    const layerId = launchContext?.layerId;
    if (!layerId) return false;
    // 261008-ig1 Task 2: route by the gesture session's clipId — NEVER the
    // list head (D-01/D-02). Fail-closed on an unknown id.
    const current = getEfxPaintDocument(layerId)?.audios.find((clip) => clip.id === patch.clipId);
    if (!current) return false;
    if (patch.kind === 'duplicate') {
      // 261008-ig1 Task 3 (D-03): the bare-alt clone append — a FRESH id over
      // the SAME sourceId (peaks + gallery stay source-keyed: no second bytes
      // copy / gallery row / audio/ path), geometry+settings copied with the
      // dragged startFrame applied, the ORIGINAL never touched. The user is
      // now manipulating the new clip, so selection lands on it (handler
      // write; the commit itself is settle-on-release, never mid-drag).
      const duplicate = { ...buildDuplicatedSoundClip(current), startFrame: patch.startFrame ?? current.startFrame };
      const appended = addDocumentSound(layerId, duplicate);
      if (appended.ok) selectedSoundId.value = duplicate.id;
      return appended.ok;
    }
    // Move/trim keep the Task 2 routing untouched: a geometry patch on the
    // gesture's own clip.
    return patchDocumentSound(layerId, patch.clipId, {
      startFrame: patch.startFrame ?? current.startFrame,
      inFrame: patch.inFrame ?? current.inFrame,
      outFrame: patch.outFrame ?? current.outFrame,
    }).ok;
  };
  /** Band/launcher resolution — the render-body version read subscribes the
   *  Studio to sound-member edits (efx-preact-reactivity rule 5: rare,
   *  meaningful bumps — never per frame). 261008-ig1 Task 2: the FULL clip
   *  list (D-01, array order canonical). */
  const resolveDocumentAudios = (): readonly DocumentSoundClip[] => {
    efxPaintVersion.value;
    if (!launchContext) return [];
    return getEfxPaintDocument(launchContext.layerId)?.audios ?? [];
  };
  /** Reveal a clip band: select it and issue one {frame, nonce} positioning —
   *  the strip repositions once per nonce on the qad math and never snaps a
   *  manual scroll back (261008-ig1 Task 2). */
  const revealSoundClip = (clip: DocumentSoundClip): void => {
    selectedSoundId.value = clip.id;
    const previous = revealRequest.peek();
    revealRequest.value = {
      frame: clip.startFrame,
      nonce: (previous?.nonce ?? 0) + 1,
    };
  };
  // 50-UAT (modal redesign): the floating Photo Reference dialog bundle — the
  // dialog reads the document through the SAME identity-stable store ports and
  // re-resolves on every document mutation (efxPaintVersion) so its controls
  // always reflect accepted state. The camera icon opens it; Escape/X close it;
  // the Import/Replace source button opens the reference picker behind it.
  const referenceDialog = referenceDialogPropsMemo.resolve(
    [referenceDialogOpen.value, launchContext?.layerId, efxPaintVersion.value, photoReferenceSectionPortsRef.current, referencePicker],
    () => ({
      open: referenceDialogOpen.value,
      layerId: launchContext?.layerId ?? null,
      ports: photoReferenceSectionPortsRef.current,
      onClose: () => { referenceDialogOpen.value = false; },
      onImportSource: () => referencePicker.openPicker(),
    }),
  );
  // 261022-o2a: the floating Script picker bundle. `open` is derived from the
  // intent signal; the intent itself travels as a plain value (a null intent
  // resolves the harmless default while the dialog stays closed). The picker
  // reads the library live, so only visibility/intent re-resolve the memo.
  const scriptPickerDialog = scriptPickerDialogPropsMemo.resolve(
    [scriptPickerIntent.value, rotoScriptLibrary],
    () => ({
      open: scriptPickerIntent.value !== null,
      intent: scriptPickerIntent.peek() ?? 'load-apply',
      library: rotoScriptLibrary,
      onPick: handleScriptPickerPick,
      onClose: closeScriptPicker,
    }),
  );
  const viewModel = usePhysicsPaintStudioViewModel({
    layout,
    topBar,
    toolRail,
    canvas: canvasStack,
    rightPanel,
    playScriptDialog,
    referenceDialog,
    scriptPickerDialog,
    workflow: {
        layerId: multiTrackRowBundle.layerId,
        tracks: multiTrackRowBundle.tracks,
        activeTrackId: multiTrackRowBundle.activeTrackId,
        background: multiTrackRowBundle.background,
        // 50-UAT (modal redesign): the photo/reference camera icon opens the
        // floating Photo Reference dialog (the dialog owns Import/Replace/
        // Remove and every setting — no X badge on the icon, 50-UAT round 2).
        photoReference: multiTrackRowBundle.photoReference,
        onOpenReference: () => { referenceDialogOpen.value = true; },
        // 52.5-01b Task 3 (D-02/D-06/D-07/D-08) + 261008-ig1 Task 2: the
        // sound band + launcher — the full clip list (resolveDocumentAudios
        // subscribes this bundle to sound-member edits), the header launcher
        // opens the LIST chooser (a single-clip document resolves straight
        // onto that clip), a band dblclick targets THAT clip, reveals ride
        // the nonce-keyed positioning, and the gesture settle routes every
        // dragged start/in/out through the per-clip store door.
        documentAudios: resolveDocumentAudios(),
        selectedSoundId,
        onOpenDocumentSound: () => {
          // 261008-ryq: the LIST lives in the sidebar Audio tab — the launcher
          // opens the single-clip editor. Auto-select the first clip when
          // nothing (valid) is selected; zero clips opens on the empty state
          // ('' target — the open test is `!== null`).
          const audios = resolveDocumentAudios();
          if (audios.length === 0) {
            audioModalTarget.value = '';
          } else {
            const current = selectedSoundId.peek();
            if (current === null || !audios.some((clip) => clip.id === current)) {
              selectedSoundId.value = audios[0].id;
            }
            audioModalTarget.value = selectedSoundId.peek() ?? '';
          }
        },
        onDocumentSoundDblClick: (clipId: string) => {
          selectedSoundId.value = clipId;
          audioModalTarget.value = clipId;
        },
        onDocumentSoundSettle: handleDocumentSoundGestureSettle,
        revealRequest: revealRequest.value,
        onSelectTrack: multiTrackRowBundle.onSelectTrack,
        onAddTrack: multiTrackRowBundle.onAddTrack,
        onToggleTrackVisible: multiTrackRowBundle.onToggleTrackVisible,
        onToggleBlend: multiTrackRowBundle.onToggleBlend,
        onRenameTrack: multiTrackRowBundle.onRenameTrack,
        onDuplicateTrack: multiTrackRowBundle.onDuplicateTrack,
        onDeleteTrack: multiTrackRowBundle.onDeleteTrack,
        onReorderTrack: multiTrackRowBundle.onReorderTrack,
        // 49-05 (Task 1, S1): the locked Bg row's Import control opens the
        // 49-04 picker swap — the engine canvas stays mounted underneath.
        onImportBackground: () => backgroundPicker.openPicker(),
        // 49-05 (Task 2, S4): a click on a Bg clip rail routes clip selection
        // to the right-panel `Background Clip` section (consumed by 49-06).
        onSelectBackgroundClip: multiTrackRowBundle.onSelectBackgroundClip,
        // 49-06 (UAT round 9): the selected Bg clip id + placement frame MUST
        // be forwarded here too — the strip/row read them to paint the orange
        // selected rail and the placement marker. Dropping them (as rounds 1-8
        // did) makes the rail never render selected no matter how the user
        // clicks, drags, or resizes.
        onSelectBackgroundFrame: multiTrackRowBundle.onSelectBackgroundFrame,
        selectedBackgroundClipId: multiTrackRowBundle.selectedBackgroundClipId,
        backgroundPlacementFrame: multiTrackRowBundle.backgroundPlacementFrame,
        // 47 close-out UAT round 7: the one-click cross-track selection intents
        // — an EXPLICIT field list, so a bundle field that isn't forwarded here
        // silently dies (rounds 5-7's intents were computed but dropped, and
        // rail clicks were swallowed by the wrapper's stopPropagation).
        onSelectTrackFrame: multiTrackRowBundle.onSelectTrackFrame,
        onSelectTrackRail: multiTrackRowBundle.onSelectTrackRail,
        workflowLabel: launchContext?.workflowLabel,
        currentFrame, timelineOpenFrame: launchContext?.startFrame ?? null, isPlaying, ready: readyToApply, occupiedRotoFrames: timelineOccupiedRotoFrames, savedRotoFrames: timelineSavedRotoFrames, cachedRotoFrames: timelineCachedRotoFrames,
        keyActionInFlight: rotoKeyUtilities.keyActionInFlight || rotoScriptNavigationLocked, mutationLocked, rotoCachedPlaybackAvailable, rotoCachedPlaybackStatus: rotoCachedPlayback.status, rotoCachedPlaybackLoop: rotoCachedPlayback.loop, rotoCachedPlaybackFps: rotoCachedPlayback.fps, projectFps: previewFps, isRotoCachedPlaybackActive: rotoCachedPlayback.isActive,
        // 38.1-D-01: the per-tick playback signal passes through as a signal
        // reference (never .value-read here); only the nav-pill current-frame
        // output child subscribes to it, during active playback only.
        rotoCachedPlaybackTick: rotoCachedPlayback.playbackTick,
        onToggleRotoPlayback: rotoCachedPlayback.toggle, onRotoPlaybackLoopChange: setRotoPlaybackLoop, onRotoPlaybackFpsChange: setRotoPlaybackFps, rotoInterpolationEnabled: rotoInterpolationState.enabled, rotoInterpolationMode: rotoInterpolationState.mode, rotoInterpolationPending: physicalEditCoordinator.pendingOperationId.value !== null,
        // 41-04 (D-12..D-14): session-local Audio Preview toggle. The .value
        // read subscribes this bundle like the sibling signal reads above; the
        // intent routes through the monitor funnel for immediate effect.
        audioPreviewEnabled: audioPreviewEnabled.value, onAudioPreviewToggle: handleAudioPreviewToggle,
        onRotoInterpolationModeChange: handleRotoInterpolationModeChange,
        onDuplicateRotoKey: duplicateRotoKey, onAddRotoKey: addRotoKey, onCreateRotoKeyRail: handleCreateRotoKeyRail, onInsertRotoFrame: rotoPhysicalActions.insertRotoFrame, onDeleteRotoFrame: rotoPhysicalActions.deleteRotoFrame, rotoPhysicalActions, publishDocumentSync: async () => {
          documentSyncDirty.value = true;
          await flushDocumentSyncRef.current();
        }, onCopyRotoFrame: copyRotoFrame, onCutRotoFrame: cutRotoFrame, onScissorKeyRail: rotoPhysicalActions.scissorKeyRail, onPasteRotoFrame: pasteRotoFrame, rotoKeyRecords, rotoLoopClips, rotoIncomingInterpolationBreakKeyIds, rotoPhysicalCells: rotoTimelineModel.physicalCells.value, rotoLoopResolutionContext: loopResolutionContext, rotoLoopPresentations: loopPresentations, selectedRotoLoopClipIds: effectiveSelectedLoopClipIds, railSetMemberLoopIds: effectiveRailSetMembers
          .filter((member): member is { kind: 'loop'; loopId: string } => member.kind === 'loop')
          .map((member) => member.loopId), railSetAnchorLoopId: effectiveRailSetMembers[0]?.kind === 'loop' ? effectiveRailSetMembers[0].loopId : null, railSetMemberKeyRailIds: effectiveRailSetMembers
          .filter((member): member is { kind: 'key-rail'; firstKeyId: string } => member.kind === 'key-rail')
          .map((member) => member.firstKeyId), railSetAnchorKeyRailId: effectiveRailSetMembers[0]?.kind === 'key-rail' ? effectiveRailSetMembers[0].firstKeyId : null, selectedRotoKeyRail: effectiveSelectedRotoKeyRail, linkedRotoLoopClipIds: linkedRotoGroups.map((group) => group.loopId), linkedRotoActionName: selectedAction?.name ?? null, onSelectRotoLoopClip: handleSelectRotoLoopClip, onSelectRotoKeyRail: handleSelectRotoKeyRail, onOpenRotoLoopEdit: handleOpenRotoLoopEdit, onRotoKeyRailDragRejected: handleRotoKeyRailDragRejected, rotoParentEndExclusive: launchContext ? physicPaintStore.getRotoPhysicalCapacity(launchContext.layerId, trackIdOfLaunch(launchContext)) : 0, rotoDragContextKey: launchContext ? `${launchContext.layerId}:${launchContext.operationId}` : 'none', hasCopiedRotoKey: rotoSession.copiedKey.value !== null, rotoKeyState: effectiveRotoKeyState,
        // Multi-selection gestures (37-04; D-01/D-02): keyId intents routed
        // through the pure 37-02 reducers over the store-ordered identity
        // list. Selection-only changes publish no status entry (UI-SPEC).
        rotoSelectedKeyIds: selectedKeyIds.value,
        rotoPrimarySelectedKeyId: selectedKeyId.value,
        rotoSpacingSelection: effectiveRotoSpacingSelection,
        onSelectRotoSpacingProxy: handleSelectRotoSpacingProxy,
        onClearRotoSpacingSelection: handleClearRotoSpacingSelection,
        onClearRotoKeySelection: handleClearRotoKeySelection,
        onToggleRotoKeySelection: handleToggleRotoKeySelection,
        onCollapseRotoSelectionToKey: handleCollapseRotoSelectionToKey,
        // Shift-click range selection (37-04; D-01): contiguous real-key range
        // from the anchor to the clicked key through the 37-02 range reducer.
        // Anchor fallback: a null anchor resolves to the current editing key.
        // The clicked key becomes current (flagged for 37-05 native UAT).
        onExtendRotoKeySelection: handleExtendRotoKeySelection,
        onSelectAllRotoKeys: selectAllRotoKeys,
        // Release-time group-drag reject publication (37-04; D-26): concise
        // UI-SPEC copy to the capsule (36.15 D-15 single-owner arbitration),
        // full resolver detail to the surviving diagnostic channel, mirroring
        // the coordinator's logDiagnostic console style.
        onRotoGroupDragRejected: handleRotoGroupDragRejected,
        // 43.5-05: push rejection copy publisher — the same status channel the
        // Key Rail / Group rejections use.
        onRotoPushDragRejected: handleRotoPushDragRejected,
        // 43.6-03: batch Move rejection copy publisher + the explicit set
        // members in Plan 01 canonical order (D-17 — the strip never re-derives
        // membership).
        onRotoRailSetMoveRejected: handleRotoRailSetMoveRejected,
        railSetMoveMembers,
        rotoScript,
        // 260905-dso: the relocated buffer Apply/Clear ports — identity-stable
        // useCallbacks plus the library mutation-lock signal reference (the
        // strip reads .value in render, so the memo stays cacheable).
        onApplyScript: handleApplyScript,
        onDiscardScript: handleDiscardScript,
        rotoScriptActionMutationDisabledReason: rotoScriptLibrary.actionMutationDisabledReason,
        // 261022-ne3/261022-o2a: the cloned Tools-popover Scripts + Living
        // Script ports — stable callbacks plus signal references read in the
        // strip's render body. Delete/Refresh are not cloned here anymore.
        onSaveScript: handleSaveScript,
        // 261022-o2a: Tools Load + Apply / Create Rail open the floating Script
        // picker; the picker rows are the UNFILTERED project Script library.
        onOpenScriptPicker: openScriptPicker,
        rotoScriptLibraryRows: rotoScriptLibrary.rows,
        onCopyScript: handleCopyScript,
        rotoScriptLibraryAvailability: rotoScriptLibrary.availability,
        statusMessage: isPlaying ? `Previewing ${rotoPlaybackFrameIndex.peek() + 1} / ${rotoPlaybackFrameCount.peek()}` : (applyStatus !== 'success' ? applyMessage : null), statusIsError: applyStatus === 'error', operationResult: operationResult.peek(), warmProgress, onion, onionPreviewFrames, showOnionHiddenDuringPreview: onion.enabled && isPlaying,
        onNavigateToSyncedFrame: handleNavigateToSyncedFrame, onGoToFirstFrame: handleGoToFirstFrame, onGoToPreviousFrame: handleGoToPreviousFrame, onGoToNextFrame: handleGoToNextFrame, onGoToLastFrame: handleGoToLastFrame, onOnionChange: setOnion, onClose: handleWorkflowClose,
        // D-02 amendment (audible scrub): the ruler scrub lifecycle — armed
        // routes the navigation audio funnel to scrub; release stops the
        // snippet and re-anchors at the final frame. G-52-9 drag-gate: the
        // release ALSO runs the single settle navigation (flush, canvas
        // repaint, startFrame propagation, selection, one main-window frame
        // sync) that mid-drag seeks deliberately skip. The scrub feed stays
        // sticky at the final frame (no playhead jump-back) until the
        // startFrame catch-up effect below clears it.
        onScrubStart: () => { scrubActiveRef.current = true; rotoScrubFrameSignal.value = null; },
        onScrubEnd: (frame) => {
          scrubActiveRef.current = false;
          rotoCachedPlayback.scrubEnd(frame);
          publishOperationResult(null);
          void requestRotoFrameNavigationRef.current(frame);
        },
        rotoScrubFrame: rotoScrubFrameSignal,
      },
    status: { shortcutsVisible },
    backgroundPicker: {
      open: backgroundPicker.open.value,
      images: backgroundPicker.images.value,
      projectDir: backgroundPicker.projectDir.value,
      selectedIds: backgroundPicker.selectedIds.value,
      status: backgroundPicker.status.value,
      importing: backgroundPicker.importing.value,
      onToggleSelect: backgroundPicker.toggleSelect,
      onConfirm: handleConfirmBackgroundPicker,
      onCancel: handleCancelBackgroundPicker,
      onImport: backgroundPicker.importImages,
    },
    // 50-03 (S2): the reference picker reuses the same full-area region swap
    // (D-01) with reference-specific copy and a replace-on-confirm handler.
    referencePicker: {
      open: referencePicker.open.value,
      images: referencePicker.images.value,
      projectDir: referencePicker.projectDir.value,
      selectedIds: referencePicker.selectedIds.value,
      status: referencePicker.status.value,
      importing: referencePicker.importing.value,
      onToggleSelect: referencePicker.toggleSelect,
      onConfirm: handleConfirmReferencePicker,
      onCancel: handleCancelReferencePicker,
      onImport: referencePicker.importImages,
      title: 'Import reference images',
    },
    // 52.5-01b (D-02/D-03): the SAME shared gallery opened with kind 'audio'
    // for the Document sound modal — single Confirm emit, audio dialog filter,
    // filename tiles. The modal rides the pickerOpen step-aside in the view.
    audioPicker: {
      open: audioPicker.open.value,
      images: audioPicker.images.value,
      audioAssets: audioPicker.audioAssets.value,
      projectDir: audioPicker.projectDir.value,
      selectedIds: audioPicker.selectedIds.value,
      status: audioPicker.status.value,
      importing: audioPicker.importing.value,
      onToggleSelect: audioPicker.toggleSelect,
      onConfirm: handleConfirmAudioPicker,
      onCancel: () => audioPicker.cancel(),
      onImport: audioPicker.importImages,
      kind: 'audio' as const,
      title: AUDIO_IMPORT_CTA,
    },
    audioModal,
  });
  const soleOccurrenceDeleteDialog = soleOccurrenceDeleteTarget === null
    ? null
    : {
        ...soleOccurrenceDeleteTarget,
        groupName: `Group at F${soleOccurrenceDeleteTarget.phaseOrigin}`,
      };
  return (
    <>
      <PhysicsPaintStudioView {...viewModel} />
      {soleOccurrenceDeleteDialog ? (
        <div class="physics-paint-group-delete-overlay">
          <div
            ref={soleOccurrenceDeleteDialogRef}
            class="physics-paint-group-delete-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="physics-paint-group-delete-title"
            onKeyDown={handleSoleOccurrenceDeleteDialogKeyDown}
          >
            <header class="physics-paint-group-delete-header">
              <h2 id="physics-paint-group-delete-title">Delete the only frame in “{soleOccurrenceDeleteDialog.groupName}”?</h2>
              <p>This is the Rail’s only frame. Delete Frame will remove the whole Rail and its uniquely owned data. The Script is kept.</p>
            </header>
            {soleOccurrenceDeleteError ? <p class="physics-paint-group-delete-error" role="alert">{soleOccurrenceDeleteError}</p> : null}
            <footer class="physics-paint-group-delete-footer">
              <button ref={soleOccurrenceDeleteCancelRef} type="button" onClick={closeSoleOccurrenceDeleteDialog}>Cancel</button>
              <button type="button" class="destructive" onClick={() => { void handleConfirmSoleOccurrenceDelete(); }}>Delete Frame</button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}

async function dispatchAndWaitForAcceptedRotoPhysicalEdit<T extends { operationId: string }>(
  pendingOperationId: {
    peek: () => string | null;
    subscribe: (listener: (operationId: string | null) => void) => () => void;
  },
  acceptedOutput: { peek: () => T | null },
  dispatch: () => Promise<boolean>,
): Promise<T | null> {
  let expectedOperationId = pendingOperationId.peek();
  const unsubscribe = pendingOperationId.subscribe((operationId) => {
    if (expectedOperationId === null && operationId !== null) expectedOperationId = operationId;
  });
  try {
    if (!await dispatch() || expectedOperationId === null) return null;
    const deadline = performance.now() + 5_500;
    while (performance.now() < deadline) {
      const accepted = acceptedOutput.peek();
      if (accepted?.operationId === expectedOperationId) return accepted;
      if (pendingOperationId.peek() === null) return null;
      await new Promise<void>((resolve) => window.setTimeout(resolve, 16));
    }
    const accepted = acceptedOutput.peek();
    return accepted?.operationId === expectedOperationId ? accepted : null;
  } finally {
    unsubscribe();
  }
}
