import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { effect, signal, useComputed, useSignal, type ReadonlySignal } from '@preact/signals';
import type { CompletedPaintMutation, EfxPaintDocument, EfxPaintEngine, PaintHistoryAvailability, PaintPerformanceSample } from '@efxlab/efx-physic-paint';
import type { BlendMode, EfxPaintDocument as EfxPaintDocumentModel } from '../../efx-paint/document/efxPaintDocument';
import type { PhysicPaintApplyResult, PhysicPaintLaunchContext, PhysicPaintRotoCacheFrame, PhysicPaintRotoPlaybackSettings, RailSetDeleteMember } from '../../types/physicPaint';
import { physicPaintRotoPhysicalOperationLeaseVersion, physicPaintStore, physicPaintVersion, resolveContentToken, type PhysicPaintRotoPhysicalOperationLeaseToken } from '../../stores/physicPaintStore';
import {
  addTrack,
  commitDeleteTrack,
  duplicateTrack,
  efxPaintVersion,
  getDocument as getEfxPaintDocument,
  renameTrack,
  reorderTrack,
  requestDeleteTrack,
  serializeRuntimeIntoDocument,
  setActiveTrackId,
  setTrackBlend,
  setTrackOpacity,
  setTrackSolo,
  setTrackVisible,
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
import { paintStore } from '../../stores/paintStore';
import { clampOnionCount, type PhysicsPaintOnionState } from './view/physicsPaintWorkflowPresentation';
import { PhysicsPaintStudioView } from './view/PhysicsPaintStudioView';
import { findAdjacentRealKeyFrame } from './view/physicsPaintStudioKeyboard';
import { disarmPushTool, isPushCommitInFlight } from './view/physicsPaintPushArmedTool';
import { disarmSolo, isSoloArmed } from './view/physicsPaintSoloArm';
import { deriveSoloPlaybackWindow } from './roto/physicsPaintRotoSoloWindow';
import { usePhysicsPaintStudioKeyboard } from './hooks/usePhysicsPaintStudioKeyboard';
import { createIdentityMemo, usePhysicsPaintStudioViewModel } from './hooks/usePhysicsPaintStudioViewModel';
import { useRotoTimelineActions, type RotoGroupLifecycleDeleteTarget, type RotoKeyRailSelection } from './hooks/useRotoTimelineActions';
import { useRotoTimelineModel } from './hooks/useRotoTimelineModel';
import { selectRealCachedRotoSourceFrameNumbers } from './roto/rotoTimelineSelectors';
import { useRotoNavigationCoordinator } from './hooks/useRotoNavigationCoordinator';
import { recordsAsRuntimeFrames, resolveRotoCompletedGroupPaintTarget, shouldReloadRotoFrameAfterFailedCapture, useRotoFramePersistenceCoordinator } from './hooks/useRotoFramePersistenceCoordinator';
import { getCarriedRotoPhysical } from './roto/rotoLaunchHydration';
import { useRotoFrameEditingController } from './hooks/useRotoFrameEditingController';
import { useRotoPhysicalEditCoordinator, type RotoGroupFramePaintExecuteInput, type RotoGroupLifecycleDeleteExecuteInput, type RotoPhysicalEditCoordinatorExecuteInput, type RotoRailSetDeleteExecuteInput, type RotoRailSetPasteExecuteInput } from './hooks/useRotoPhysicalEditCoordinator';
import { DEFAULT_PHYSICS_PAINT_CANVAS_HEIGHT, DEFAULT_PHYSICS_PAINT_CANVAS_WIDTH, getPhysicsPaintWorkingSize } from './engine/physicsPaintCanvasSizing';
import { usePhysicsPaintEngineLifecycle } from './engine/usePhysicsPaintEngineLifecycle';
import { usePhysicsPaintEngineActions } from './engine/usePhysicsPaintEngineActions';
import { useRotoBackgroundMetadataSync } from './hooks/useRotoBackgroundMetadataSync';
import { getOnionFrameOpacity, projectRotoOnionPreviewFrames } from './roto/rotoOnionPreview';
import { selectPhysicsPaintMissingConditions, selectRotoPlaybackAvailable } from './view/physicsPaintStudioSelectors';
import { projectPhysicsPaintLoopClipPresentation } from './view/physicsPaintLoopClipPresentation';
import { deriveKeyRailSegments } from './view/physicsPaintKeyRailPresentation';
import type { KeyRailSegment } from './view/physicsPaintKeyRailPresentation';
import { buildRotoBackgroundMetadata, makeInitialPhysicsPaintStudioSettings, type PhysicsPaintStudioSettings } from './engine/physicsPaintStudioSettings';
import { parsePhysicsPaintLaunchContext } from './bridge/physicsPaintLaunchContext';
import { createPhysicPaintThumbnailNativeEncoder, sendEfxPaintDocumentSync, sendPhysicPaintApplyPayload, sendPhysicPaintAudioOwnership, sendPhysicPaintFrameSyncMessage } from './bridge/physicsPaintBridgeTransport';
import { efxPaintAudioOwnership } from './audio/efxPaintAudioOwnership';
import { efxPaintAudioMonitor } from './audio/efxPaintAudioMonitor';
import { audioPreviewEnabled, setAudioPreviewEnabled } from './audio/efxPaintAudioPreviewStore';
import { buildBlankRotoFrame, type RenderedFramePayload } from './roto/rotoCanvasFrames';
import { detectPhysicsPaintBridgeMode, usePhysicsPaintBridgeMode, usePhysicsPaintCloseFlush } from './bridge/usePhysicsPaintParentBridge';
import { usePhysicsPaintLaunchIntegration } from './hooks/usePhysicsPaintLaunchIntegration';
import { usePhysicsPaintApplyResultController } from './hooks/usePhysicsPaintApplyResultController';
import { isPhysicsPaintProfilingEnabled, recordPhysicsPaintPerformance, recordPhysicsPaintPerformanceCounter } from './performance/physicsPaintPerformanceTrace';
import { isRotoSessionCopiedRailSet } from './roto/physicsPaintRotoSession';
import {
  buildRotoRailSetOperationResult,
  type RotoRailSetCopyPayload,
  type RotoRailSetCopyPlacementMode,
  type RotoRailSetOperationResultMember,
  type RotoRailSetPasteIdentity,
} from './roto/physicsPaintRotoRailSetCopy';
import { usePhysicsPaintWorkflowIntegration } from './hooks/usePhysicsPaintWorkflowIntegration';
import { useRotoInterpolationController } from './hooks/useRotoInterpolationController';
import { useRotoPlaybackSettingsController } from './hooks/useRotoPlaybackSettingsController';
import { useRotoScriptClipboardController } from './hooks/useRotoScriptClipboardController';
import type { RotoScriptPhysicalTarget, RotoScriptSourceSnapshot } from './roto/physicsPaintRotoScriptClipboard';
import { useRotoPhysicalEditHistory } from './hooks/useRotoPhysicalEditHistory';
import { useRotoScriptLibraryController } from './hooks/useRotoScriptLibraryController';
import { createRotoNavigationGeneration, createRotoUiFlushScheduler } from './hooks/rotoUiFlushScheduler';
import { armRotoCompletionPaintGuard } from './hooks/rotoCompletionPaintGuard';
import { useRotoPlayScriptController } from './hooks/useRotoPlayScriptController';
import { createRotoScriptThumbnail } from './roto/physicsPaintRotoScriptThumbnail';
import './physicsPaintStudio.css';
const DEFAULT_ONION_STATE: Omit<PhysicsPaintOnionState, 'opacity'> = { enabled: false, previous: true, next: false, count: 1 };
type ApplyStatus = 'idle' | 'applying' | 'success' | 'error';
type GroupLifecycleDeleteTarget = Readonly<Omit<RotoGroupLifecycleDeleteTarget, 'mode'> & {
  operationKind: 'delete-group-frame' | 'delete-group';
}>;
type SoleOccurrenceDeleteTarget = Readonly<GroupLifecycleDeleteTarget & {
  operationKind: 'delete-group-frame';
}>;
type PreviewBackgroundEngine = EfxPaintEngine & { setBackgroundImageUrl: (dataUrl: string) => void; resetBackground: () => void; setPreviewBaseImageUrl: (dataUrl: string) => void; clearPreviewBaseImage: () => void };

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
    const unsubscribe = effect(() => {
      const next = source.value;
      if (next === latestRef.current) return;
      latestRef.current = next;
      if (timerRef.current === null) {
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          throttled.current.value = latestRef.current;
        }, delayMs);
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

export function PhysicsPaintStudio() {
  recordPhysicsPaintPerformanceCounter('render.studio');
  const profilePerformance = isPhysicsPaintProfilingEnabled();
  const recordEnginePerformance = profilePerformance
    ? (sample: PaintPerformanceSample) => recordPhysicsPaintPerformance(sample)
    : undefined;
  const [isPlaying, setIsPlaying] = useState(false);
  // 38.1-D-01/D-08: the playback per-tick surface is signal-backed — written
  // by onStart/onFrame per tick and read ONLY via .peek() (statusMessage) or
  // by the narrow sanctioned live surfaces (playback canvas image, nav-pill
  // current-frame indicator). Never .value-read in the Studio render body or
  // the view-model literal: that would re-subscribe the whole Studio per tick.
  const rotoPlaybackFrameIndex = useSignal(0);
  const rotoPlaybackFrameCount = useSignal(0);
  const [launchContext, setLaunchContextState] = useState<PhysicPaintLaunchContext | null>(() => parsePhysicsPaintLaunchContext(window.location));
  const launchContextRef = useRef<PhysicPaintLaunchContext | null>(launchContext);
  launchContextRef.current = launchContext;
  // 47-01 UAT round 8: the strip data subscriptions below re-render the whole
  // Studio on every paint event; a trailing 150ms throttle collapses a stroke
  // burst into one flush so the chrome freezes while painting (the user's
  // start-paint stutter). The canvas and the push effect keep the RAW
  // physicPaintVersion — only the strip chrome reads the throttled revision.
  const throttledPaintRevision = useTrailingThrottledRevision(physicPaintVersion, 150);
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
  const latestRotoFramesRef = useRef<PhysicPaintRotoCacheFrame[]>(initialCarried ? recordsAsRuntimeFrames(initialCarried) : []);
  const setLaunchContext = useCallback((update: PhysicPaintLaunchContext | null | ((current: PhysicPaintLaunchContext | null) => PhysicPaintLaunchContext | null)) => {
    setLaunchContextState((current) => {
      const next = typeof update === 'function' ? update(current) : update;
      launchContextRef.current = next;
      if (next?.operationId !== current?.operationId || next?.layerId !== current?.layerId) {
        const carried = next ? getCarriedRotoPhysical(next) : null;
        latestRotoFramesRef.current = carried ? recordsAsRuntimeFrames(carried) : [];
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
        selectedKeyId.value = physicPaintStore.getRotoRealKeyRecordByAppFrame(next.layerId, trackIdOfLaunch(next), next.startFrame)?.keyId ?? null;
        physicPaintStore.setRotoPhysicalSelection(next.layerId, trackIdOfLaunch(next), selectedKeyId.value, next.startFrame);
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
  const canvasStackPropsMemo = useRef(createIdentityMemo()).current;
  const canvasMountPropsMemo = useRef(createIdentityMemo()).current;
  const scheduleRotoStartFramePropagation = useCallback((frame: number) => {
    rotoUiFlushScheduler.schedule(() => {
      setLaunchContext((current) => current ? { ...current, startFrame: frame } : current);
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
      setSoleOccurrenceDeleteError('Delete rejected because the Group changed. Review the current frame and try again.');
      return;
    }
    closeSoleOccurrenceDeleteDialog();
  }, [closeSoleOccurrenceDeleteDialog, soleOccurrenceDeleteTarget]);
  const bridgeMode = usePhysicsPaintBridgeMode();
  const bridgeModeRef = useRef(bridgeMode);
  bridgeModeRef.current = bridgeMode;
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
  const rotoKeyRecords = useMemo(() => launchContext ? physicPaintStore.getRotoRealKeyRecords(launchContext.layerId, studioActiveTrackId()) : [], [launchContext?.layerId, throttledPaintRevision.value, efxPaintVersion.value]);
  const rotoIncomingInterpolationBreakKeyIds = useMemo(
    () => launchContext ? physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(launchContext.layerId, studioActiveTrackId()) : [],
    [launchContext?.layerId, throttledPaintRevision.value, efxPaintVersion.value],
  );
  const rotoInterpolationState = useMemo(() => launchContext ? physicPaintStore.getRotoPhysicalInterpolationState(launchContext.layerId, studioActiveTrackId()) : PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED, [launchContext?.layerId, throttledPaintRevision.value, efxPaintVersion.value]);
  const rotoLoopClips = useMemo(() => launchContext ? physicPaintStore.getRotoPhysicalLoopClips(launchContext.layerId, studioActiveTrackId()) : PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY, [launchContext?.layerId, throttledPaintRevision.value, efxPaintVersion.value]);
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
  const rotoLegacyInterpolationSettings = useMemo(() => launchContext ? physicPaintStore.getRotoInterpolationSettings(launchContext.layerId, studioActiveTrackId()) : undefined, [launchContext?.layerId, throttledPaintRevision.value, efxPaintVersion.value]);
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
        trackIdOfLaunch(launchContext),
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
    // 43.6-06 (D-14): Select All is a rail-selection change — it disarms solo.
    disarmSolo();
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
  const [settings, setSettings] = useState<PhysicsPaintStudioSettings>(() => makeInitialPhysicsPaintStudioSettings());
  const workflowMode = 'roto' as const;
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const handleSetRightPanelCollapsed = useCallback((collapsed: boolean) => {
    setRightPanelCollapsed(collapsed);
  }, []);
  const playButtonRef = useRef<HTMLButtonElement>(null);
  const historyAvailability = useSignal<PaintHistoryAvailability>({ undo: 0, redo: 0 });
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
  const resetRotoNavigationForLaunchRef = useRef<(settings: PhysicPaintRotoPlaybackSettings) => void>(() => {});
  const acceptRotoScriptBrushRef = useRef<() => void>(() => {});
  const prepareRotoScriptTargetRef = useRef<(source: RotoScriptSourceSnapshot) => Promise<RotoScriptPhysicalTarget | null>>(async () => null);
  const pendingFirstPaintTargetRef = useRef<{
    launchOperationId: string;
    layerId: string;
    appFrame: number;
    promise: Promise<RotoScriptPhysicalTarget | null>;
  } | null>(null);
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
  const currentFrameIsGeneratedRoto = workflowMode === 'roto' && currentFrameSelectionKind === 'generated-interpolation';
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
    log: (message, isError) => { setApplyMessage(message); if (isError) setLastError(message); },
  }, bridgeMode);
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
  // 43.6-06 (D-14): mutation-lock entry also disarms an armed Solo — solo
  // never gates mutations, disarm-on-lock only. No commit-in-flight guard:
  // solo is not a mutation tool.
  useEffect(() => {
    if (mutationLocked && !isPushCommitInFlight()) disarmPushTool();
    if (mutationLocked) disarmSolo();
    return () => {
      if (!isPushCommitInFlight()) disarmPushTool();
      disarmSolo();
    };
  }, [mutationLocked]);
  // Navigation already locks the engine input and navigation coordinator. Keep
  // the static Studio controls keyed only to real script mutations so the
  // navigation lock's true/false pulse cannot invalidate their memo props.
  const staticControlsLocked = mutationLocked && !rotoScriptNavigationLocked;
  const loopScriptRows = rotoScriptLibrary.rows.value;
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
      if (!loaded) return;
      const applied = await rotoScript.applyPreparedScript(preparation);
      if (applied) setLastError(null);
      else {
        const message = rotoScript.error.peek()?.message;
        if (message) setLastError(message);
      }
    } finally {
      rotoScript.cancelPreparedScriptLoadAndApply(preparation);
    }
  }, [rotoScript, rotoScriptLibrary]);
  const rotoInputDisabled = currentFrameIsGeneratedRoto || mutationLocked;
  const {
    selectTool,
    setBrushColor,
    setBrushSize,
    setBrushOpacity,
    setBackground,
    setPaperGrain,
    setGrainStrength,
    setEdgeDetail,
    setPickup,
    setSpread,
    setSmoothing,
    setEraseStrength,
    startPhysics,
    stopPhysics,
  } = usePhysicsPaintEngineActions({ engine, settings, setSettings, isMutationLocked: isPhysicalMutationLocked });
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
      return physicPaintStore.replaceRotoPhysicalRecords(layerId, studioActiveTrackId(), records, interpolation, physicPaintStore.getRotoPhysicalCapacity(layerId, studioActiveTrackId()));
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
      discardUnownedAppFrames: beforeDocument
        ? collectDiscardableRotoGroupOwnedFrames({
            beforeDocument,
            afterDocument: document,
            snapshotFrames,
          })
        : [],
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
        loadCachedRotoReferenceFrame(
          appFrame,
          engineRef.current as PreviewBackgroundEngine | null,
          undefined,
          true,
          generation,
        );
        armRotoCompletionPaintGuard({
          engine: engineRef.current as PreviewBackgroundEngine | null,
          appFrame,
          intendedDataUrl: findAcceptedRotoReferenceFrame(appFrame)?.dataUrl ?? null,
          intendedGeneration: generation,
          getCurrentAppFrame: () => launchContextRef.current?.startFrame ?? 0,
          reload: (frame, dataUrl, paintGeneration) => {
            // Repair re-applies ONLY the intended (newest) image at its own
            // generation — never whatever the frame lookup resolves to later.
            // The engine generation gate turns this into a no-op if a newer
            // generation painted between arm and repair.
            loadCachedRotoReferenceFrame(frame, engineRef.current as PreviewBackgroundEngine | null, undefined, true, paintGeneration, dataUrl);
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
      sendPhysicalEditPayload: async (payload) => { await sendPhysicPaintApplyPayload(payload, bridgeModeRef.current); },
    },
    settlement: {
      registerPendingSettlement: () => {},
      clearPendingSettlement: () => {},
    },
    status: {
      setApplyStatus,
      setConciseMessage: (message) => { setApplyMessage(message); },
      setLastError,
      logDiagnostic: (message) => { console.error('[PhysicsPaintStudio] physical edit:', message); },
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
      : `Deleted F${target.appFrame} from Group at F${target.phaseOrigin}.`);
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
    buildBlankRotoFrame: (frame) => ({
      ...buildBlankRotoFrame(canvasWidth, canvasHeight, frame),
      source: 'real-key',
    }),
    executePhysicalEdit: (executeInput) => physicalEditCoordinator.executePhysicalEdit(executeInput as RotoPhysicalEditCoordinatorExecuteInput<EfxPaintDocument>),
    pendingOperationId: physicalEditCoordinator.pendingOperationId,
    executeGroupLifecycleDelete: (target) => groupLifecycleDeleteExecuteRef.current(target),
    executeRailSetDelete: (target) => railSetDeleteExecuteRef.current(target),
    getRailSetClipboard: () => railSetClipboardReadRef.current(),
    setRailSetClipboard: (payload) => railSetClipboardWriteRef.current(payload),
    executeRailSetPaste: (input) => railSetPasteExecuteRef.current(input),
    requestSoleOccurrenceDeleteWarning: handleRequestSoleOccurrenceDeleteWarning,
    publishStatus: (message) => { setApplyMessage(message); },
    setApplyStatus,
    publishDiagnostic: (message) => { console.error('[PhysicsPaintStudio] physical edit:', message); },
  });
  const rotoPhysicalActions = rotoTimelineActions.physicalActions;
  prepareRotoScriptTargetRef.current = async (source) => {
    const launch = launchContextRef.current;
    if (
      !launch
      || source.layerId !== launch.layerId
      || source.appFrame !== launch.startFrame
      || source.selectionKind === 'generated-interpolation'
    ) return null;

    if (source.selectionKind === 'real-key') {
      if (!source.keyId) return null;
      const record = physicPaintStore.getRotoRealKeyRecord(launch.layerId, studioActiveTrackId(), source.keyId);
      return record?.appFrame === source.appFrame
        ? { keyId: record.keyId, appFrame: record.appFrame }
        : null;
    }
    if (source.keyId !== null) return null;

    const blank = buildBlankRotoFrame(canvasWidth, canvasHeight, source.appFrame);
    const accepted = await dispatchAndWaitForAcceptedRotoPhysicalEdit(
      physicalEditCoordinator.pendingOperationId,
      physicalEditCoordinator.acceptedOutput,
      // Quick 260816-tv7: paint-on-empty promotion routes through addEmptyKey
      // so the new key owns a persistent incoming interpolation break
      // (broken-key contract) instead of a connected key.
      () => rotoTimelineActions.physicalKeyUtilities.addEmptyKey(
        source.appFrame,
        {
          frameIndex: blank.frameIndex,
          appFrame: source.appFrame,
          dataUrl: blank.dataUrl,
          ...(blank.width !== undefined ? { width: blank.width } : {}),
          ...(blank.height !== undefined ? { height: blank.height } : {}),
        },
      ),
    );
    if (
      accepted?.operationKind !== 'paste-key'
      || accepted.after.layerId !== launch.layerId
      || accepted.after.selectedAppFrame !== source.appFrame
      || !accepted.after.selectedKeyId
    ) return null;
    const record = physicPaintStore.getRotoRealKeyRecord(launch.layerId, studioActiveTrackId(), accepted.after.selectedKeyId);
    return record?.appFrame === source.appFrame
      ? { keyId: record.keyId, appFrame: record.appFrame }
      : null;
  };

  const rotoNavigation = useRotoNavigationCoordinator<RenderedFramePayload>({
    workflowMode,
    beforeNavigation: rotoScript.prepareNavigation,
    afterNavigation: rotoScript.completeNavigation,
    keyUtilities: {
      currentFrame,
      currentKeyId: currentPhysicalCell.kind === 'real' ? currentPhysicalCell.keyId : null,
      physicalKeyUtilities: rotoTimelineActions.physicalKeyUtilities,
      getSelectedKeyIds: () => selectedKeyIds.value,
      getRotoKeyRecords: () => launchContext ? physicPaintStore.getRotoRealKeyRecords(launchContext.layerId, studioActiveTrackId()) : [],
      canvasSize: { width: canvasWidth, height: canvasHeight },
      realKeyFrames: rotoKeyRecords.map((record): PhysicPaintRotoCacheFrame => ({
        ...record.payload,
        source: 'real-key',
      })),
      cachedRotoFrames: latestRotoFramesRef.current,
      dirtyFrames: dirtyRotoFramesRef.current,
      applyStatus,
      flushInFlight: false,
      buildBlankRotoFrame: (frame): PhysicPaintRotoCacheFrame => ({ ...buildBlankRotoFrame(canvasWidth, canvasHeight, frame), source: 'real-key' }),
      setDirtyFrames: (frames) => { dirtyRotoFramesRef.current = frames; },
      syncPendingRotoFrames,
      showCachedReference: (frame) => setCachedRotoReferenceUrl(frame.dataUrl),
      clearGeneratedFrame: (frame) => { if (launchContext) physicPaintStore.removeFrameRange(launchContext.layerId, studioActiveTrackId(), frame, 1); },
      clearDeletedFrame: (frame) => { if (launchContext) physicPaintStore.removeRealRotoKeyFrame(launchContext.layerId, studioActiveTrackId(), frame); },
      setApplyMessage,
      setApplyStatus,
      setLastError,
    },
    playback: {
      initialSettings: initialRotoPlaybackSettings,
      getEndFrame: () => launchContext ? physicPaintStore.getRotoPhysicalEndFrame(launchContext.layerId, trackIdOfLaunch(launchContext)) : null,
      getFrame: findCachedRotoDisplayFrame,
      // 43.6-06 (D-19): the solo window derives from the Plan 01 set, or the
      // single-rail selection as a set of one (D-15), through the Task 1 pure
      // derivation — the ONLY solo filter seam (the getFrames enumeration).
      // Wiring only: no derivation logic lives in the Studio body.
      getSoloWindow: () => {
        // 43.6-09 (D-14/D-17): the solo filter is active ONLY while armed.
        // Disarmed must return null before any member derivation so the
        // playback enumeration stays byte-identical to pre-solo playback even
        // when a rail is selected — otherwise selecting a rail after disarm
        // plays only that rail, as if solo were still active.
        if (!isSoloArmed()) return null;
        const members: RailSetIdentity[] = [];
        for (const member of effectiveRailSetSelection?.members ?? []) members.push(member);
        if (members.length === 0) {
          if (effectiveSelectedRotoKeyRail) {
            members.push({ kind: 'key-rail', firstKeyId: effectiveSelectedRotoKeyRail.firstKeyId });
          }
          for (const loopId of effectiveSelectedLoopClipIds) members.push({ kind: 'loop', loopId });
        }
        if (members.length === 0) return null;
        const cells = rotoTimelineModel.physicalCells.value;
        return deriveSoloPlaybackWindow({
          members,
          keyRailSegments,
          loopRanges: loopResolutionContext?.ranges ?? [],
          cells,
          capacity: cells.length,
        });
      },
      onStart: (frameCount) => { rotoPlaybackFrameCount.value = frameCount; },
      onFrame: (frameIndex) => {
        rotoPlaybackFrameIndex.value = frameIndex;
      },
      setIsPlaying,
    },
  });
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
  usePhysicsPaintCloseFlush(
    () => workflowMode === 'roto' && Boolean(engineRef.current?.getStrokeCount() || rotoPersistence.hasPendingLivePixels() || rotoPlaybackSettingsController.hasPending()),
    async () => {
      if (workflowMode !== 'roto') return;
      engineRef.current?.flushPendingStrokeFinalizations();
      await rotoPersistence.flushLivePixels(currentFrame);
      await rotoPlaybackSettingsController.flush();
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
    executePhysicalEdit: physicalEditCoordinator.executePhysicalEdit,
    pendingOperationId: physicalEditCoordinator.pendingOperationId,
    acceptedOutput: physicalEditCoordinator.acceptedOutput,
    failureOutput: physicalEditCoordinator.failureOutput,
    stopPlayback: rotoCachedPlayback.stop,
    log: (message, isError) => { setApplyMessage(message); if (isError) setLastError(message); },
  }, bridgeMode);
  const clearRotoLoopSelection = useCallback(() => {
    // 43.6-06 (D-14): every rail-selection setter routes through this clear —
    // ANY rail-selection change/clear disarms an armed Solo.
    disarmSolo();
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
          trackIdOfLaunch(launchContext),
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
        trackIdOfLaunch(launchContext),
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
          trackIdOfLaunch(launchContext),
          null,
          currentFrame,
        );
      }
      railSetSelection.value = next;
      return;
    }
    // Plain click collapses the set into the single-rail path (D-04).
    railSetSelection.value = null;
    // 43.6-06 (D-14): a plain Loop Rail click is a rail-selection change — an
    // armed Solo disarms before the new selection is applied. Direct call, NOT
    // clearRotoLoopSelection(), because that helper would clobber the selection
    // this branch is about to write.
    disarmSolo();
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
        trackIdOfLaunch(launchContext),
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
    return new Map((loopResolutionContext?.ranges ?? []).map((range) => {
      const clip = clipsById.get(range.loopId);
      const sourceScriptName = clip?.scriptId ? scriptsById.get(clip.scriptId)?.name ?? null : null;
      return [
        range.loopId,
        projectPhysicsPaintLoopClipPresentation(range, clip, sourceScriptName),
      ] as const;
    }));
  }, [loopResolutionContext, loopScriptRows, rotoLoopClips]);
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
      clearReference: clearCachedRotoReferenceUrl, resetReference: resetCachedRotoReference, setReferenceUrl: setCachedRotoReferenceUrl,
      loadReferenceFrame: loadCachedRotoReferenceFrame,
    },
    clearCachedFrame: rotoPersistence.clearCurrentFrame,
    playback: { stop: rotoCachedPlayback.stop }, syncPendingFrames: syncPendingRotoFrames,
    status: { setApplyStatus, setApplyMessage },
    isMutationLocked: isPhysicalMutationLocked,
  });
  const beginRotoFrameEditImplRef = useRef<() => void>(() => {});
  beginRotoFrameEditImplRef.current = () => {
    const launch = launchContextRef.current;
    const document = launch ? physicPaintStore.getRotoPhysicalDocument(launch.layerId, studioActiveTrackId()) : null;
    const paintTarget = document
      ? resolveRotoCompletedGroupPaintTarget(document, currentFrame, currentCellKeyId)
      : null;
    if (currentFrameSelectionKind !== 'empty' || !launch || paintTarget?.kind === 'group-frame') {
      pendingFirstPaintTargetRef.current = null;
      rotoFrameEditing.beginFrameEdit();
      return;
    }
    if (pendingFirstPaintTargetRef.current) return;

    const request = prepareRotoScriptTargetRef.current({
      selectionKind: 'empty',
      layerId: launch.layerId,
      keyId: null,
      appFrame: currentFrame,
    });
    const pending = {
      launchOperationId: launch.operationId,
      layerId: launch.layerId,
      appFrame: currentFrame,
      promise: request,
    };
    pendingFirstPaintTargetRef.current = pending;
    void request.then((target) => {
      if (pendingFirstPaintTargetRef.current !== pending) return;
      if (!target) {
        pendingFirstPaintTargetRef.current = null;
        return;
      }
      rotoFrameEditing.beginFrameEdit();
    }).catch((error) => {
      if (pendingFirstPaintTargetRef.current === pending) pendingFirstPaintTargetRef.current = null;
      console.error('[PhysicsPaintStudio] Could not create the first Roto key', error);
    });
  };
  const beginRotoFrameEdit = useCallback(() => {
    beginRotoFrameEditImplRef.current();
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
    getActiveTrackId: (layerId) => getEfxPaintDocument(layerId)?.activeTrackId ?? '',
  });
  // 38.1 D-08 link 3: playback availability without a per-render O(N) array
  // build. Equivalence with selectRotoPlaybackAvailable (some-style boolean):
  // no launch -> false; empty list -> false; all-missing -> false; mixed ->
  // true iff any frame resolves — the physical-input branch reads the same
  // getRenderSource truth loadCachedRotoReferenceFrame and findCachedRotoDisplayFrame
  // consult, so availability cannot diverge from the frames the canvas would
  // actually paint. Recomputes only when the structural frame list or launch
  // identity changes, never on a pure Studio render.
  const rotoPlaybackFrameNumbers = rotoSession.playbackFrameNumbers.value;
  const rotoPlaybackLayerId = launchContext?.layerId ?? null;
  const rotoCachedPlaybackAvailableFrames = useMemo(() => {
    if (rotoPlaybackLayerId === null) return [];
    return rotoPlaybackFrameNumbers.flatMap((appFrame) => {
      const source = physicPaintStore.getRotoPhysicalRenderSource(rotoPlaybackLayerId, trackIdOfLaunch(launchContext), appFrame);
      if (!source) return [];
      // Phase 43 (D-28, audit finding 6): the loop placeholder never
      // contributes playback payload — the preview surface renders it as the
      // marked placeholder and Studio playback continues past it without
      // blocking. A future render-source variant is a compile-time error at
      // this consumer (Pitfall 7 never-fallback convention).
      switch (source.kind) {
        case 'loop-placeholder':
          return [];
        case 'real':
        case 'generated':
          return [{ appFrame, frame: source.renderedFrame }];
        default: {
          const exhaustive: never = source;
          throw new Error(`Unhandled Roto physical render-source kind: ${JSON.stringify(exhaustive)}`);
        }
      }
    });
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
    if (rotoFrameEditingRef.current.clearCurrentFrame()) rotoScript.notifySourceRevision();
  }, [engine, rotoScript]);
  const dryPaint = useCallback(() => {
    if (isPhysicalMutationLocked()) return;
    engine?.forceDry();
  }, [engine, rotoScript]);
  const navigateToSyncedPhysicalFrame = useCallback(async (frame: number) => {
    if (!Number.isInteger(frame) || frame < 0) return false;
    // A new navigation resets the status capsule: the previous operation's
    // rejection/success text no longer applies once the playhead moves, so the
    // capsule falls back to the ambient frame context ("Empty frame • Frame N").
    setApplyStatus('idle');
    setApplyMessage(null);
    rotoCachedPlayback.stop();
    // 38.1 D-05: begin the navigation generation BEFORE any await so a newer
    // navigation started during the flush supersedes this one.
    const generation = rotoNavigationGeneration.begin();
    if (launchContext) {
      engine?.flushPendingStrokeFinalizations();
      // 38.1-07 D-03 (strengthened): INITIATE the save-before-leave flush
      // WITHOUT awaiting. The flush operates on ALREADY-CAPTURED live-pixel
      // transaction buffers and parent deliveries — it captures no engine
      // pixels at await time, so the engine.clear() below cannot corrupt it.
      // The flush is always initiated and always awaited afterward with the
      // verbatim error path — never skipped, never weakened (save-before-leave,
      // RESEARCH Pitfall 5).
      const flushPromise = rotoPersistence.flushLivePixels(currentFrame);
      // 38.1 D-03 canvas-first: the engine paint issues NOW, in the navigation
      // intent tick — zero intervening awaits since begin(), so the generation
      // cannot be superseded before this paint (no pre-paint isLatest recheck).
      setCachedRotoReferenceUrl(null);
      if (engine) {
        engine.clearPreviewBaseImage();
        (engine as PreviewBackgroundEngine).resetBackground();
        engine.clear();
        loadCachedRotoReferenceFrame(frame, engine as PreviewBackgroundEngine);
      }
      try {
        await flushPromise;
      } catch {
        setApplyStatus('error');
        setApplyMessage(`Could not save Roto frame ${currentFrame} before navigation.`);
        return false;
      }
      // 38.1 D-05: superseded navigation — a newer intent owns the canvas. The
      // same-tick paint above already happened (the approved D-03 trade), but
      // a superseded navigation never propagates and never repaints.
      if (!rotoNavigationGeneration.isLatest(generation)) return false;
      // 38.1-07: post-flush neighbor pickup — a generated destination repaints
      // once so it picks up the just-flushed neighbor key pixels. The kind
      // check reads the O(1) cached projection — never
      // getRotoPhysicalRenderSource, which would run the interpolation render.
      if (engine && physicPaintStore.getRotoPhysicalProjection(launchContext.layerId, trackIdOfLaunch(launchContext))?.cells[frame]?.kind === 'generated') {
        setCachedRotoReferenceUrl(null);
        engine.clearPreviewBaseImage();
        (engine as PreviewBackgroundEngine).resetBackground();
        engine.clear();
        loadCachedRotoReferenceFrame(frame, engine as PreviewBackgroundEngine);
      }
    }
    if (launchContext) {
      const selectedRecord = physicPaintStore.getRotoRealKeyRecordByAppFrame(launchContext.layerId, studioActiveTrackId(), frame);
      const nextSelectedKeyId = selectedRecord?.keyId ?? null;
      if (selectedKeyId.peek() !== nextSelectedKeyId) selectedKeyId.value = nextSelectedKeyId;
      physicPaintStore.setRotoPhysicalSelection(launchContext.layerId, studioActiveTrackId(), selectedKeyId.value, frame);
    }
    // 38.1 D-04: the startFrame update — the full-Studio-render driver via
    // currentFrame — is rAF-batched so a click burst coalesces to at most one
    // Studio render per animation frame showing the LATEST frame.
    scheduleRotoStartFramePropagation(frame);
    pendingFrameSyncRef.current = frame;
    await sendPhysicPaintFrameSyncMessage(frame, bridgeMode);
    return true;
  }, [bridgeMode, currentFrame, engine, launchContext, loadCachedRotoReferenceFrame, rotoCachedPlayback, rotoNavigationGeneration, rotoPersistence, scheduleRotoStartFramePropagation, setCachedRotoReferenceUrl, selectedKeyId]);
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
  useEffect(() => {
    const lc = launchContextRef.current;
    if (!lc?.layerId) return;
    const trackId = studioActiveTrackId();
    if (!trackId) return;
    const visible = resolvePhysicPaintTrackVisibility(lc.layerId, trackId);
    const displayState = `${trackId}:${visible ? 'visible' : 'hidden'}`;
    if (displayState === lastReferenceDisplayStateRef.current) return;
    lastReferenceDisplayStateRef.current = displayState;
    const engine = engineRef.current as PreviewBackgroundEngine | null;
    setCachedRotoReferenceUrl(null);
    if (engine) {
      engine.clearPreviewBaseImage();
      engine.resetBackground();
      engine.clear();
    }
    // A hidden active track stays a blank canvas (hide/solo truth table); any
    // other switch reloads the current frame through the newly active track.
    if (visible) {
      loadCachedRotoReferenceFrame(currentFrame, engine);
    }
    // Re-seed the studio selection on the newly active track at the cursor —
    // the same resets the launch-replacement path applies, for an in-place
    // track switch (a stale key/rail selection must never leak across tracks).
    const selectedRecord = physicPaintStore.getRotoRealKeyRecordByAppFrame(lc.layerId, trackId, currentFrame);
    const nextSelectedKeyId = selectedRecord?.keyId ?? null;
    if (selectedKeyId.peek() !== nextSelectedKeyId) selectedKeyId.value = nextSelectedKeyId;
    physicPaintStore.setRotoPhysicalSelection(lc.layerId, trackId, selectedKeyId.value, currentFrame);
    selectedKeyIds.value = selectedKeyId.value === null ? [] : [selectedKeyId.value];
    selectionAnchorKeyId.value = selectedKeyId.value;
    rotoSpacingSelection.value = null;
    railSetSelection.value = null;
    selectedLoopClipId.value = null;
    selectedLoopClipIds.value = [];
    selectedRotoKeyRail.value = null;
    loopSelectionAnchorId.value = null;
    activeLinkedLoopClipId.value = null;
    // The lane's cached-frame fills are track-scoped too: re-resolve the newly
    // active track's runtime frames so the lane never shows the previous
    // track's cached cells (the "addTrack looks like a duplicate" symptom).
    const physicalDocument = physicPaintStore.getRotoPhysicalDocument(lc.layerId, trackId);
    if (physicalDocument) {
      latestRotoFramesRef.current = recordsAsRuntimeFrames(physicalDocument);
    }
  }, [efxPaintVersion.value, currentFrame, loadCachedRotoReferenceFrame, setCachedRotoReferenceUrl]);
  rotoNavigation.configureRuntimePort({ navigateToSyncedFrame: navigateToSyncedPhysicalFrame });
  rotoNavigation.configureDisplayPort({
    restoreFrame: (effect) => {
      const frame = effect.restore.frame;
      // 38.1 D-03/D-04: canvas paint first within this flow; the startFrame
      // update propagates through the same rAF scheduler as navigation.
      if (engine && (effect.restore.kind === 'load-real-key' || effect.restore.kind === 'blank-real-key')) loadCachedRotoReferenceFrame(frame, engine as PreviewBackgroundEngine);
      else if (engine && effect.restore.kind === 'clear-blank') {
        engine.clearPreviewBaseImage();
        (engine as PreviewBackgroundEngine).resetBackground();
        engine.clear();
      }
      scheduleRotoStartFramePropagation(frame);
    },
    clearCanvas: (frame) => {
      if (!engine || frame !== currentFrame) return;
      engine.clearPreviewBaseImage();
      (engine as PreviewBackgroundEngine).resetBackground();
      engine.clear();
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
    undoPaint: rotoFrameEditing.undo,
    redoPaint: rotoFrameEditing.redo,
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
    onSettledLaunchContext: (context) => { void rotoScriptLibrary.updateProjectContext(context); },
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
        loadCachedRotoReferenceFrame(acceptedSelectedAppFrame, currentEngine as PreviewBackgroundEngine);
      }
      if (transition === 'accepted' && accepted && accepted.operationId === detail?.operationId) {
        physicalEditCoordinator.acknowledgePhysicalEditSettlement(accepted.operationId, 'release');
      }
      return transition;
    },
  };
  const handlePhysicsPaintKeyDown = usePhysicsPaintStudioKeyboard({
    state: {
      currentFrame,
      isPlaying,
      mutationLocked,
      // 43.4 defect 9: selection-gated real-key cycling activates only when a
      // real key is in the primary selection.
      hasSelectedRotoKey: selectedKeyId.value !== null,
    },
    savedRotoFrames: timelineSavedRotoFrames,
    actions: {
      undo,
      redo,
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
      deleteRotoKey: rotoPhysicalActions.deleteRotoFrame,
      selectAllRotoKeys,
      disarmPushTool,
      // 43.6-06 (D-04): the solo disarm layer sits between the push disarm
      // layer and selection collapse in the Escape chain.
      disarmSolo,
      collapseRotoSelection: () => {
        // 43.6 D-04: the rail-set is the top selection layer — one Escape
        // collapses the set without touching the key selection (Pitfall 2).
        // Chain order (43.5 one-Escape-one-layer): popover dismiss, push
        // disarm, solo disarm, set collapse, key-selection collapse.
        if (railSetSelection.value !== null) {
          railSetSelection.value = null;
          // 43.6-06 (D-14): collapsing the set is a rail-selection change.
          disarmSolo();
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
  const onionPreviewFrames = useMemo(() => projectRotoOnionPreviewFrames({
    currentFrame,
    isPlaying,
    onion,
    realKeyRecords: rotoKeyRecords,
    getRenderSource: (appFrame) => launchContext ? physicPaintStore.getRotoPhysicalRenderSource(launchContext.layerId, trackIdOfLaunch(launchContext), appFrame) : null,
    previewFrames: rotoOnionPreviewFrames,
    dirtyFrames: rotoOnionDirtyFrames,
  }), [currentFrame, isPlaying, onion, rotoKeyRecords, launchContext, rotoOnionPreviewFrames, rotoOnionDirtyFrames]);
  const rotoCachedPlaybackAvailable = selectRotoPlaybackAvailable({
    workflowMode,
    hasLaunchContext: Boolean(launchContext),
    frames: rotoCachedPlaybackAvailableFrames,
  });
  const { updateRotoInterpolationSettings } = useRotoInterpolationController({
    launchContext,
    interpolation: rotoInterpolationState,
    records: rotoKeyRecords,
    selectedKeyId: selectedKeyId.value,
    selectedAppFrame: selectedKeyId.value === null ? null : currentFrame,
    pendingOperationId: physicalEditCoordinator.pendingOperationId,
    executePhysicalEdit: physicalEditCoordinator.executePhysicalEdit,
    isMutationLocked: isPhysicalMutationLocked,
  });
  const updateRotoInterpolationSettingsRef = useRef(updateRotoInterpolationSettings);
  updateRotoInterpolationSettingsRef.current = updateRotoInterpolationSettings;
  const requestRotoFrameNavigationRef = useRef(requestRotoFrameNavigation);
  requestRotoFrameNavigationRef.current = requestRotoFrameNavigation;
  const rotoKeyRecordsRef = useRef(rotoKeyRecords);
  rotoKeyRecordsRef.current = rotoKeyRecords;
  const handleRotoInterpolationEnabledChange = useCallback((enabled: boolean) => {
    void updateRotoInterpolationSettingsRef.current({ enabled });
  }, []);
  const handleRotoInterpolationModeChange = useCallback((mode: PhysicPaintRotoInterpolationState['mode']) => {
    void updateRotoInterpolationSettingsRef.current({ mode });
  }, []);
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
  const handleNavigateToSyncedFrame = useCallback((frame: number) => {
    publishOperationResult(null);
    void requestRotoFrameNavigationRef.current(frame);
  }, [publishOperationResult]);
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
  const topBar = topBarPropsMemo.resolve([settings.size, settings.opacity, settings.background, settings.paperGrain, settings.grainStrength, readyToApply, staticControlsLocked, setBrushSize, setBrushOpacity, setBackground, setPaperGrain, setGrainStrength], () => ({
    brushSize: settings.size,
    opacity: settings.opacity,
    background: settings.background,
    paperGrain: settings.paperGrain,
    grainStrength: settings.grainStrength,
    ready: readyToApply,
    disabled: staticControlsLocked,
    onBrushSizeChange: setBrushSize,
    onOpacityChange: setBrushOpacity,
    onBackgroundChange: setBackground,
    onPaperGrainChange: setPaperGrain,
    onGrainStrengthChange: setGrainStrength,
  }));
  // 38-11: the tool rail props assemble behind the identity memo — the
  // single-line deps array below enumerates exactly the values the build
  // references (38.1 onion-projection idiom); it contains no frame-derived
  // input, so a startFrame-only Studio render returns the cached object and
  // the memo-wrapped rail skips its render. Signal objects pass through by
  // identity (never .value-cached), so signal-driven updates keep flowing.
  const toolRail = toolRailPropsMemo.resolve([settings.tool, settings.physicsMode, settings.activePhysicsAction, historyAvailability, engine, staticControlsLocked, selectTool, undo, redo, clearActiveSource, startPhysics, stopPhysics, dryPaint], () => ({
    activeTool: settings.tool,
    physicsMode: settings.physicsMode,
    activePhysicsAction: settings.activePhysicsAction,
    historyAvailability,
    disabled: !engine || staticControlsLocked,
    onSelectTool: selectTool,
    onUndo: undo,
    onRedo: redo,
    onClearFrame: clearActiveSource,
    onPhysicsStart: startPhysics,
    onPhysicsStop: stopPhysics,
    onDryPaint: dryPaint,
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
  const rightPanel = rightPanelPropsMemo.resolve([settings.tool, settings.color, settings.opacity, settings.edgeDetail, settings.pickup, settings.spread, settings.smoothing, settings.eraseStrength, settings.physicsMode, onion, isPlaying, staticControlsLocked, rotoLegacyInterpolationSettings, setBrushColor, setEdgeDetail, setPickup, setSpread, setSmoothing, setEraseStrength, setOnion, updatePanelMotion, rotoScriptLibrary, rotoPlayScript, rotoScript, playButtonRef, selectedLoopClip, effectiveLinkedGroupIndex, linkedRotoGroups.length, handlePreviousLinkedGroup, handleNextLinkedGroup, handleGoToLinkedGroup, handleOpenRotoLoopEdit, handleCloseRotoLoopClip, handleScriptRowActivate, handleSelectedScriptLoadAndApply, setLastError, launchContext?.layerId, efxPaintVersion.value, setApplyMessage], () => {
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
    onColorChange: setBrushColor,
    onEdgeDetailChange: setEdgeDetail,
    onPickupChange: setPickup,
    onSpreadChange: setSpread,
    onSmoothingChange: setSmoothing,
    onEraseStrengthChange: setEraseStrength,
    onOnionChange: setOnion,
    onPlayWiggleChange: updatePanelMotion,
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
      onDiscardScript: () => { rotoScript.discardScript(); setLastError(null); },
      onCopyScript: () => { void rotoScript.copyScript().then((success) => { if (success) setLastError(null); else { const message = rotoScript.error.peek()?.message; if (message) setLastError(message); } }); },
      onApplyScript: () => { void rotoScript.applyScript().then((success) => { if (success) setLastError(null); else { const message = rotoScript.error.peek()?.message; if (message) setLastError(message); } }); },
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
    });
    handleEngineReady(readyEngine);
    rotoScript.updateEngine(readyEngine);
    if (workflowMode === 'roto') loadCachedRotoReferenceFrame(currentFrame, readyEngine as PreviewBackgroundEngine);
  };
  const handleCanvasEngineReady = useCallback((readyEngine: EfxPaintEngine) => {
    canvasEngineReadyImplRef.current(readyEngine);
  }, []);
  const canvasCompletedMutationImplRef = useRef<(mutation: CompletedPaintMutation, mutationEngine: EfxPaintEngine) => void>(() => {});
  canvasCompletedMutationImplRef.current = (mutation, mutationEngine) => {
    rotoScript.observeCompletedMutation(mutationEngine, mutation);
    const { kind, isEmpty, mutationId } = mutation;
    rotoMoveHistory.observePaintMutation(mutationId, kind);
    const acceptedTarget = rotoScript.getAcceptedTarget(mutationEngine, mutationId);
    const publicationIdentity = acceptedTarget?.publicationIdentity;
    const canPublishCapturedApply = Boolean(publicationIdentity);
    const canPublishCurrentEngine = mutationEngine === engineRef.current
      && workflowMode === 'roto'
      && currentFrameSelectionKind !== 'generated-interpolation'
      && Boolean(launchContext);
    if (kind === 'clear' || (!canPublishCapturedApply && !canPublishCurrentEngine) || !launchContext) return;
    if (acceptedTarget && !acceptedTarget.publishPixels) return;
    const appFrame = acceptedTarget?.appFrame ?? currentFrame;
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
    const pendingFirstPaintTarget = pendingFirstPaintTargetRef.current;
    const liveAlphaCanvas = isEmpty ? null : mutationEngine.copyLiveAlphaCanvas();
    void (async () => {
      let keyId = initialKeyId;
      if (!keyId && completedTarget.kind === 'empty') {
        if (
          !pendingFirstPaintTarget
          || pendingFirstPaintTarget.launchOperationId !== launchContext.operationId
          || pendingFirstPaintTarget.layerId !== launchContext.layerId
          || pendingFirstPaintTarget.appFrame !== appFrame
        ) return;
        const firstPaintTarget = await pendingFirstPaintTarget.promise;
        if (!firstPaintTarget || firstPaintTarget.appFrame !== appFrame) return;
        keyId = firstPaintTarget.keyId;
      }

      const currentLaunch = launchContextRef.current;
      if (
        !currentLaunch
        || currentLaunch.operationId !== launchContext.operationId
        || currentLaunch.layerId !== launchContext.layerId
      ) return;
      const cachedBaseAppFrame = cachedRotoRepaintBaseFrame?.appFrame ?? null;
      if (isEmpty) {
        if (cachedRotoRepaintBaseFrame && cachedBaseAppFrame === appFrame) {
          rotoPersistence.invalidateLivePixels(appFrame);
          rotoPersistence.upsertCachedFrame(cachedRotoRepaintBaseFrame, false);
        } else {
          rotoPersistence.removeCachedFrame(appFrame);
        }
        return;
      }
      if (!liveAlphaCanvas) return;
      const capturedBase = publicationIdentity?.cachedBase ?? null;
      const capturedBaseAppFrame = capturedBase?.appFrame ?? null;
      const cachedBase = publicationIdentity
        ? capturedBaseAppFrame === appFrame ? capturedBase : null
        : cachedBaseAppFrame === appFrame ? cachedRotoRepaintBaseFrame : null;
      const snapshotStartedAt = profilePerformance ? performance.now() : 0;
      const capture = rotoPersistence.captureLivePixels({
        layerId: publicationIdentity?.layerId ?? currentLaunch.layerId,
        operationId: publicationIdentity?.operationId,
        keyId: keyId ?? undefined,
        appFrame,
        liveAlphaCanvas,
        cachedBase,
        background: publicationIdentity?.background,
        size: { width: canvasWidth, height: canvasHeight },
        mutationId,
      });
      if (profilePerformance) recordPhysicsPaintPerformance({ stage: 'snapshot-handoff', category: 'sync-cpu', durationMs: performance.now() - snapshotStartedAt, timestamp: performance.now(), mutationId, sourceFrame: appFrame });
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
  const cachedRotoPlaybackComposition = useMemo(() => launchContext ? {
    width: projectCanvasWidth,
    height: projectCanvasHeight,
    background: buildRotoBackgroundMetadata(settings),
  } : null, [launchContext?.operationId, projectCanvasWidth, projectCanvasHeight, settings.background, settings.paperGrain, settings.grainStrength]);
  const onionOverlay = useMemo(() => onion.enabled && onionPreviewFrames.length > 0 ? onionPreviewFrames.map((frame) => (
    <img key={`${frame.direction}-${frame.source}-${frame.frame}-${frame.distance}`} class={`physics-paint-onion-frame ${frame.kind === 'cached-composite' ? 'physics-paint-onion-cached-composite' : frame.direction === 'previous' ? 'physics-paint-onion-prev' : 'physics-paint-onion-next'}`} src={frame.dataUrl} style={{ opacity: getOnionFrameOpacity(frame.distance, onion.opacity) }} alt="" />
  )) : null, [onion.enabled, onion.opacity, onionPreviewFrames]);
  const rotoInputDisabledMessage = currentFrameIsGeneratedRoto
    ? `Generated frame ${currentFrame} is render-only.`
    : mutationLocked
      ? 'Finish the current Roto script operation.'
      : undefined;
  const canvasMount = canvasMountPropsMemo.resolve([canvasWidth, canvasHeight, paperTextureScale, handleCanvasEngineReady, setCanvasMounted, handleNativePenInputReady, handleCanvasCompletedMutation, recordEnginePerformance, rotoScript.prepareEngineDisposal, getStrokeMetadata], () => ({
    width: canvasWidth,
    height: canvasHeight,
    paperTextureScale,
    onEngineReady: handleCanvasEngineReady,
    onCanvasMounted: setCanvasMounted,
    onNativePenInputReady: handleNativePenInputReady,
    onCompletedMutation: handleCanvasCompletedMutation,
    onPerformanceSample: recordEnginePerformance,
    beforeEngineDestroy: rotoScript.prepareEngineDisposal,
    getStrokeMetadata,
  }));
  const canvasStack = canvasStackPropsMemo.resolve([cachedRotoReferenceUrl, rotoCachedPlayback.playbackTick, rotoCachedPlayback.isActive, cachedRotoPlaybackComposition, rotoInputDisabled, rotoInputDisabledMessage, beginRotoFrameEdit, onionOverlay, canvasKey, canvasMount], () => ({
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
  }));
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
  // 47-01 mockup redesign: track CRUD + visibility intents. Each routes
  // through its store op fail-closed on the layer; refusals (empty rename,
  // last-track delete) publish to the status capsule so the user sees why the
  // timeline did not change. Newly added / duplicated tracks become active so
  // they are immediately visible in the preview.
  const handleAddTrack = useCallback(() => {
    const layerId = launchContext?.layerId;
    if (!layerId) return;
    const result = addTrack(layerId);
    if (result.ok) setActiveTrackId(layerId, result.trackId);
    // 47-03 Task 2: the keyboard shortcut path (Cmd/Ctrl+Shift+N) routes
    // through the same handle — failures must reach the status capsule just
    // like the strip's rename/delete rejections (47-02 publishStatus channel).
    else setApplyMessage(result.error);
  }, [launchContext?.layerId]);
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
  const handleDuplicateTrack = useCallback((trackId: string) => {
    const layerId = launchContext?.layerId;
    if (!layerId) return;
    const result = duplicateTrack(layerId, trackId);
    if (result.ok) setActiveTrackId(layerId, result.trackId);
    else setApplyMessage(result.error);
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
  }, [launchContext?.layerId]);
  // 47-02 Task 2: 'S' solo toggle and header-drag reorder routing — both write
  // the child document through the 47-01 store ops (setTrackSolo writes the
  // solo display property; reorderTrack writes ONLY the order field, never the
  // stable UUID — Pitfall 1).
  const handleToggleSolo = useCallback((trackId: string, solo: boolean) => {
    const layerId = launchContext?.layerId;
    if (!layerId) return;
    const result = setTrackSolo(layerId, trackId, solo);
    if (!result.ok) setApplyMessage(result.error);
  }, [launchContext?.layerId]);
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
      layerId: undefined, tracks: undefined, activeTrackId: undefined, background: undefined,
      onSelectTrack: undefined, onAddTrack: undefined, onToggleTrackVisible: undefined,
      onToggleSolo: undefined, onRenameTrack: undefined, onDuplicateTrack: undefined,
      onDeleteTrack: undefined, onReorderTrack: undefined,
    };
    const document = getEfxPaintDocument(layerId);
    if (!document) return {
      layerId, tracks: undefined, activeTrackId: undefined, background: undefined,
      onSelectTrack: undefined, onAddTrack: undefined, onToggleTrackVisible: undefined,
      onToggleSolo: undefined, onRenameTrack: undefined, onDuplicateTrack: undefined,
      onDeleteTrack: undefined, onReorderTrack: undefined,
    };
    return {
      layerId,
      tracks: document.tracks,
      activeTrackId: document.activeTrackId,
      background: document.background,
      onSelectTrack: (trackId: string) => setActiveTrackId(layerId, trackId),
      onAddTrack: handleAddTrack,
      onToggleTrackVisible: handleToggleTrackVisible,
      onToggleSolo: handleToggleSolo,
      onRenameTrack: handleRenameTrack,
      onDuplicateTrack: handleDuplicateTrack,
      onDeleteTrack: handleDeleteTrack,
      onReorderTrack: handleReorderTrack,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launchContext?.layerId, efxPaintVersion.value]);
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
  // 47-01 UAT round 8: the push fires IMMEDIATELY on document-structure
  // changes (efxPaintVersion) and on a 500ms DEBOUNCE after paint/roto edits
  // (physicPaintVersion) — round-7 subscribed to every paint event, so every
  // stroke serialized the whole document over the bridge and the parent's
  // mirror marked the project dirty (auto-save storm, corrupted saves, paint
  // slowness). The debounce keeps the parent's runtime eventually consistent
  // with the child's live state without touching the paint hot path.
  const pushLiveProjection = (layerId: string, mode: 'Tauri' | 'Browser fallback') => {
    let document: EfxPaintDocumentModel | null = null;
    try {
      document = serializeRuntimeIntoDocument(layerId);
    } catch {
      document = getEfxPaintDocument(layerId);
    }
    if (!document) return;
    void sendEfxPaintDocumentSync(document, mode).catch((error) => {
      console.warn('[PhysicsPaintStudio] EFX Paint document sync failed:', error);
    });
  };
  useEffect(() => {
    const layerId = launchContext?.layerId;
    if (!layerId) return;
    const mode = bridgeModeRef.current;
    if (mode !== 'Tauri' && mode !== 'Browser fallback') return;
    pushLiveProjection(layerId, mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launchContext?.layerId, efxPaintVersion.value]);
  useEffect(() => {
    const layerId = launchContext?.layerId;
    if (!layerId) return;
    const mode = bridgeModeRef.current;
    if (mode !== 'Tauri' && mode !== 'Browser fallback') return;
    const timer = window.setTimeout(() => pushLiveProjection(layerId, mode), 500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launchContext?.layerId, physicPaintVersion.value]);
  const viewModel = usePhysicsPaintStudioViewModel({
    layout,
    topBar,
    toolRail,
    canvas: canvasStack,
    rightPanel,
    playScriptDialog,
    workflow: {
        layerId: multiTrackRowBundle.layerId,
        tracks: multiTrackRowBundle.tracks,
        activeTrackId: multiTrackRowBundle.activeTrackId,
        background: multiTrackRowBundle.background,
        onSelectTrack: multiTrackRowBundle.onSelectTrack,
        onAddTrack: multiTrackRowBundle.onAddTrack,
        onToggleTrackVisible: multiTrackRowBundle.onToggleTrackVisible,
        onToggleSolo: multiTrackRowBundle.onToggleSolo,
        onRenameTrack: multiTrackRowBundle.onRenameTrack,
        onDuplicateTrack: multiTrackRowBundle.onDuplicateTrack,
        onDeleteTrack: multiTrackRowBundle.onDeleteTrack,
        onReorderTrack: multiTrackRowBundle.onReorderTrack,
        workflowLabel: launchContext?.workflowLabel,
        currentFrame, isPlaying, ready: readyToApply, occupiedRotoFrames: timelineOccupiedRotoFrames, savedRotoFrames: timelineSavedRotoFrames, cachedRotoFrames: timelineCachedRotoFrames,
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
        onRotoInterpolationEnabledChange: handleRotoInterpolationEnabledChange, onRotoInterpolationModeChange: handleRotoInterpolationModeChange,
        onDuplicateRotoKey: duplicateRotoKey, onAddRotoKey: addRotoKey, onInsertRotoFrame: rotoPhysicalActions.insertRotoFrame, onDeleteRotoFrame: rotoPhysicalActions.deleteRotoFrame, rotoPhysicalActions, onCopyRotoFrame: copyRotoFrame, onCutRotoFrame: cutRotoFrame, onScissorKeyRail: rotoPhysicalActions.scissorKeyRail, onPasteRotoFrame: pasteRotoFrame, rotoKeyRecords, rotoLoopClips, rotoIncomingInterpolationBreakKeyIds, rotoPhysicalCells: rotoTimelineModel.physicalCells.value, rotoLoopResolutionContext: loopResolutionContext, rotoLoopPresentations: loopPresentations, selectedRotoLoopClipIds: effectiveSelectedLoopClipIds, railSetMemberLoopIds: effectiveRailSetMembers
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
        statusMessage: isPlaying ? `Previewing ${rotoPlaybackFrameIndex.peek() + 1} / ${rotoPlaybackFrameCount.peek()}` : (applyStatus !== 'success' ? applyMessage : null), statusIsError: applyStatus === 'error', operationResult: operationResult.peek(), onion, onionPreviewFrames, showOnionHiddenDuringPreview: onion.enabled && isPlaying,
        onNavigateToSyncedFrame: handleNavigateToSyncedFrame, onGoToFirstFrame: handleGoToFirstFrame, onGoToPreviousFrame: handleGoToPreviousFrame, onGoToNextFrame: handleGoToNextFrame, onGoToLastFrame: handleGoToLastFrame, onOnionChange: setOnion, onClose: handleWorkflowClose,
      },
    status: { shortcutsVisible },
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
              <p>This is the Group’s only frame. Delete Frame will remove the whole Group and its uniquely owned data. The Action is kept.</p>
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
