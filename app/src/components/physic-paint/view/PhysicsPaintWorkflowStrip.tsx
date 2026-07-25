import { AlignHorizontalSpaceAround, BetweenVerticalStart, Blend, ChevronFirst, ChevronLast, ChevronsLeft, ChevronsRight, Clipboard, ClipboardCopy, ClipboardPaste, ClipboardPen, CopyPlus, Play, RotateCcw, Square, Trash2, X } from 'lucide-preact';

import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { PhysicsPaintStyledTooltip, useStyledTooltip } from './PhysicsPaintStyledTooltip';
import {
  collectRotoDragVacatedAppFrames,
  getRotoCellFill, getRotoCellViewModel,
  getMissingRotoFrameStatusLabel,
  getRotoDragPreviewViewModel,
  type PhysicsPaintOnionState,
  type RotoCellViewModel, type RotoMissingFrameStatusKind,
  type RotoDragPreviewViewModel,
} from './physicsPaintWorkflowPresentation';
import type { PhysicPaintRotoCacheFrame } from '../../../types/physicPaint';
import type { RotoKeyUtilityActionState } from '../roto/physicsPaintRotoKeyController';
import type { RotoScriptClipboardController } from '../roto/physicsPaintRotoScriptClipboard';
import type {
  PhysicPaintRotoInterpolationState,
  PhysicPaintRotoRealKeyRecord,
} from '../roto/physicsPaintRotoPhysicalModel';
import type { RotoPhysicalTimelineCell } from '../roto/rotoPhysicalTimelinePorts';
import type {
  RotoDragPublication,
  RotoDragPreparationResult,
  RotoDragTarget,
  RotoDragTargetSignature,
  RotoPhysicalTimelineActionBundle,
} from '../hooks/useRotoTimelineActions';

const GENERATED_ROTO_TITLE_TEMPLATE = 'Generated frame {frame} — render-only.';
const GENERATED_ROTO_DISABLED_STATUS_TEMPLATE = 'Generated frame {frame} is render-only. Use timeline navigation or playback; edit a real Roto key to paint.';
const INTERPOLATION_ENABLED_STATUS = 'Generated in-betweens on — render-only frames refresh from real keys.';
const INTERPOLATION_DISABLED_STATUS = 'Generated in-betweens off — real Roto keys only.';
const ROTO_KEY_BUSY_STATUS_TEMPLATE = 'Finish the current key action before using key tools.';
type RotoKeyUtilityAction = 'insert' | 'duplicate' | 'copy' | 'paste' | 'delete';
export interface PhysicsPaintWorkflowRotoKeyState {
  actionAvailability: RotoKeyUtilityActionState;
  hasCopiedRotoKey: boolean;
}

export type PhysicsPaintWorkflowRotoScriptState = Pick<RotoScriptClipboardController,
  | 'availability'
  | 'hasCopiedScript'
  | 'copiedAppFrame'
  | 'copiedStrokeCount'
  | 'applying'
  | 'applyProgress'
  | 'status'
  | 'error'
>;
const ROTO_CELL_LEGEND_ITEMS = [
  { label: 'Empty', className: 'roto-fill-empty' },
  { label: 'Cached', className: 'roto-fill-cached' },
  { label: 'Generated', className: 'roto-fill-generated' },
  { label: 'Background only', className: 'roto-fill-background-only' },
];

export interface PhysicsPaintWorkflowStripFrameMarker {
  frame: number;
  saved?: boolean;
  label?: string;
  source?: 'real-key' | 'generated-interpolation';
}

export interface PhysicsPaintWorkflowOnionPreviewFrame {
  frame: number;
  dataUrl: string;
  direction: 'previous' | 'next';
  distance: number;
  source: 'roto';
  kind?: 'stroke-preview' | 'cached-composite';
}

export interface PhysicsPaintWorkflowStripProps {
  workflowLabel?: string;
  currentFrame: number;
  isPlaying: boolean;
  ready?: boolean;
  occupiedRotoFrames?: number[];
  savedRotoFrames?: PhysicsPaintWorkflowStripFrameMarker[];
  cachedRotoFrames?: PhysicPaintRotoCacheFrame[];
  rotoInterpolationEnabled?: boolean;
  rotoInterpolationMode?: PhysicPaintRotoInterpolationState['mode'];
  rotoInterpolationPending?: boolean;
  statusMessage?: string | null;
  rotoMissingFrameStatusKind?: RotoMissingFrameStatusKind | null;
  onion: PhysicsPaintOnionState;
  onionPreviewFrames?: PhysicsPaintWorkflowOnionPreviewFrame[];
  showOnionHiddenDuringPreview?: boolean;
  rotoCachedPlaybackAvailable?: boolean;
  rotoCachedPlaybackStatus?: string | null;
  rotoCachedPlaybackLoop?: boolean;
  rotoCachedPlaybackFps?: number;
  projectFps?: number;
  onToggleRotoPlayback?: () => void;
  onRotoPlaybackLoopChange?: (loop: boolean) => void;
  onRotoPlaybackFpsChange?: (fps: number) => void;
  isRotoCachedPlaybackActive?: boolean;
  onRotoInterpolationEnabledChange?: (enabled: boolean) => void;
  onRotoInterpolationModeChange?: (mode: PhysicPaintRotoInterpolationState['mode']) => void;
  onDuplicateRotoKey?: () => void;
  onInsertRotoFrame?: () => void;
  onDeleteRotoFrame?: () => void;
  /** Stable physical timeline action bundle (D-05/D-06/D-09). */
  rotoPhysicalActions?: RotoPhysicalTimelineActionBundle;
  onCopyRotoFrame?: () => void;
  onPasteRotoFrame?: () => void;
  /** Physical real-key records for identity-based Drag targeting (D-01/D-07). */
  rotoKeyRecords?: readonly PhysicPaintRotoRealKeyRecord[];
  /** Reactive physical timeline cells (D-10) for vacated-cell diffing during Drag preview. */
  rotoPhysicalCells?: readonly RotoPhysicalTimelineCell[];
  rotoDragContextKey?: string;
  hasCopiedRotoKey?: boolean;
  keyActionInFlight?: boolean;
  mutationLocked?: boolean;
  rotoKeyState?: PhysicsPaintWorkflowRotoKeyState;
  rotoScript?: PhysicsPaintWorkflowRotoScriptState;
  onCopyRotoScript?: () => void;
  onApplyRotoScript?: () => void;
  /** Header Close affordance — Studio routes through the guarded close-flush path. */
  onClose?: () => void;
  onNavigateToSyncedFrame: (frame: number) => void;
  onGoToFirstFrame: () => void;
  onGoToPreviousFrame: () => void;
  onGoToNextFrame: () => void;
  onGoToLastFrame: () => void;
  onOnionChange: (onion: PhysicsPaintOnionState) => void;
}

const VIRTUAL_TIMELINE_FRAME_COUNT = 120;
const RULER_STEP = 3;

export function buildPhysicsPaintRotoFrameCells(currentFrame: number): number[] {
  const visibleCount = VIRTUAL_TIMELINE_FRAME_COUNT;
  const maxStart = Math.max(0, currentFrame - Math.floor(visibleCount / 2));
  const start = Math.max(0, Math.min(maxStart, currentFrame));
  return Array.from({ length: visibleCount }, (_, index) => start + index);
}

function buildRulerTicks(frameCells: number[]): number[] {
  return frameCells.filter((frame) => frame % RULER_STEP === 0);
}



function isSavedFrame(markers: PhysicsPaintWorkflowStripFrameMarker[] | undefined, frame: number): boolean {
  return Boolean(markers?.some(marker => marker.frame === frame && marker.saved !== false && marker.source !== 'generated-interpolation'));
}

function getRotoFillClass(fill: ReturnType<typeof getRotoCellFill>): string {
  return fill === 'cached-only' ? 'roto-fill-cached-only' : 'roto-fill-empty';
}

type RotoDragCandidateKind = 'empty' | 'real-key' | 'generated' | 'outside' | 'locked';
interface RotoDragPreviewState {
  movedKeyId: string;
  sourceAppFrame: number;
  publication: RotoDragPublication | null;
  candidateKind: RotoDragCandidateKind;
  candidateValid: boolean;
  error: string | null;
  pending: boolean;
}

interface RotoDragGestureSession {
  pointerId: number;
  movedKeyId: string;
  sourceAppFrame: number;
  sourceElement: HTMLButtonElement;
  originX: number;
  originY: number;
  latestX: number;
  latestY: number;
  started: boolean;
  candidateTarget: RotoDragTarget | null;
  candidateKind: RotoDragCandidateKind;
  candidateValid: boolean;
  candidateError: string | null;
  publication: RotoDragPublication | null;
  rafId: number | null;
  lastRafTime: number | null;
  validityKey: string;
  cleanup: () => void;
}

const ROTO_DRAG_THRESHOLD_PX = 6;
const ROTO_EDGE_SCROLL_ZONE_PX = 32;
const ROTO_EDGE_SCROLL_MIN_PX_PER_SECOND = 40;
const ROTO_EDGE_SCROLL_MAX_PX_PER_SECOND = 160;

/**
 * Identity-based target signature equality (D-09). Two targets are equal when
 * their kind, resolved appFrame (for physical-cell), and targetKeyId (for
 * before-key/after-key) all match. The strip uses this to require that the
 * pointer-up release target matches the retained publication's target
 * signature before committing — preventing stale or sliding-target commits.
 */
function targetSignaturesEqual(
  target: RotoDragTarget,
  signature: RotoDragTargetSignature,
): boolean {
  if (target.kind !== signature.kind) return false;
  if (target.kind === 'physical-cell') {
    if (signature.kind !== 'physical-cell') return false;
    return (target.appFrame ?? null) === (signature.appFrame ?? null);
  }
  // before-key / after-key
  if (signature.kind === 'physical-cell') return false;
  return (target.targetKeyId ?? null) === (signature.targetKeyId ?? null);
}

/**
 * Escape a keyId or other string for safe use inside a CSS attribute selector.
 * keyIds are opaque strings from the resolver; they may contain characters
 * that need escaping in CSS. We escape conservatively per CSS-string rules.
 */
function cssEscape(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}

function getRotoDragFeedback(preview: RotoDragPreviewState | null): string | null {
  if (!preview) return null;
  if (preview.pending) {
    return preview.publication
      ? getRotoDragPreviewViewModel(preview.publication.proposal, { committing: true }).conciseStatus
      : 'Committing Roto key move...';
  }
  if (!preview.candidateValid || !preview.publication) return preview.error;
  return getRotoDragPreviewViewModel(preview.publication.proposal).conciseStatus;
}

export function PhysicsPaintWorkflowStrip(props: PhysicsPaintWorkflowStripProps) {
  const [scrollbar, setScrollbar] = useState({ left: 0, width: 0, visible: false });
  const [rotoDragPreview, setRotoDragPreview] = useState<RotoDragPreviewState | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const rotoDragGestureRef = useRef<RotoDragGestureSession | null>(null);
  const suppressNextRotoClickRef = useRef(false);
  const mountedRef = useRef(true);
  const interpolationEnabled = props.rotoInterpolationEnabled === true;
  const interpolationMode = props.rotoInterpolationMode ?? 'duplicate';
  const currentPhysicalCells = props.rotoPhysicalCells ?? [];
  const physicalCellByAppFrame = useMemo(
    () => new Map(currentPhysicalCells.map((cell) => [cell.appFrame, cell])),
    [currentPhysicalCells],
  );
  const generatedRotoFrames = useMemo(
    () => currentPhysicalCells.filter((cell) => cell.kind === 'generated').map((cell) => cell.appFrame),
    [currentPhysicalCells],
  );
  const cachedRotoFrames = props.cachedRotoFrames ?? [];
  const realCachedRotoFrames = useMemo(
    () => cachedRotoFrames.filter((frame) => frame.source === 'real-key'),
    [cachedRotoFrames],
  );
  const frameCells = useMemo(() => buildPhysicsPaintRotoFrameCells(props.currentFrame), [props.currentFrame]);
  const rotoRulerTicks = useMemo(() => buildRulerTicks(frameCells), [frameCells]);
  const hasGeneratedInBetweens = generatedRotoFrames.length > 0;
  const interpolationStatus = interpolationEnabled
    ? hasGeneratedInBetweens
      ? INTERPOLATION_ENABLED_STATUS
      : 'Generated in-betweens on — save at least two real Roto keys.'
    : INTERPOLATION_DISABLED_STATUS;
  const currentSemanticCell = physicalCellByAppFrame.get(props.currentFrame) ?? null;
  const currentCellFrames = currentSemanticCell?.kind === 'generated'
    ? [...cachedRotoFrames, { frameIndex: 0, appFrame: props.currentFrame, dataUrl: 'data:image/png;base64,', source: 'generated-interpolation' as const }]
    : cachedRotoFrames;
  const currentRotoCell = getRotoCellViewModel({ frame: props.currentFrame, currentFrame: props.currentFrame, cachedFrames: currentCellFrames });
  const rotoMissingStatusLabel = props.rotoMissingFrameStatusKind ? getMissingRotoFrameStatusLabel({ frame: props.currentFrame, kind: props.rotoMissingFrameStatusKind }) : null;
  const currentRotoFill = getRotoCellFill(props.currentFrame, realCachedRotoFrames);
  const isCurrentRealRotoKey = currentSemanticCell?.kind === 'real';
  const sessionKeyAvailability = props.rotoKeyState?.actionAvailability;
  const physicalActions = props.rotoPhysicalActions;
  const physicalInsertAvailable = physicalActions?.canInsertFrame.value ?? false;
  const physicalDeleteAvailable = physicalActions?.canDeleteFrame.value ?? false;
  const physicalInsertDisabledReason = physicalActions?.insertDisabledReason.value ?? null;
  const physicalDeleteDisabledReason = physicalActions?.deleteDisabledReason.value ?? null;
  const forceSpacingInput = physicalActions?.forceSpacingInput.value ?? '1';
  const forceSpacingAvailable = physicalActions?.canApplyForceSpacing.value ?? false;
  const forceSpacingDisabledReason = physicalActions?.forceSpacingDisabledReason.value ?? null;
  const scriptAvailability = props.rotoScript?.availability.value;
  const scriptStatus = props.rotoScript?.status.value ?? null;
  const keyUtilitiesDisabledByBusyState = props.ready === false || Boolean(props.mutationLocked) || Boolean(props.keyActionInFlight) || Boolean(sessionKeyAvailability?.busy) || Boolean(rotoDragPreview?.pending);
  const interpolationControlsDisabled = props.ready === false || Boolean(props.mutationLocked) || Boolean(props.rotoInterpolationPending);
  const canUseSourceRotoKey = isCurrentRealRotoKey && !keyUtilitiesDisabledByBusyState;
  const canInsertRotoKey = physicalActions ? physicalInsertAvailable && props.ready !== false : (sessionKeyAvailability ? (sessionKeyAvailability.canInsert || canUseSourceRotoKey) && props.ready !== false : canUseSourceRotoKey);
  const canDuplicateRotoKey = sessionKeyAvailability ? (sessionKeyAvailability.canDuplicate || canUseSourceRotoKey) && props.ready !== false : canUseSourceRotoKey;
  const canCopyRotoKey = sessionKeyAvailability ? (sessionKeyAvailability.canCopy || canUseSourceRotoKey) && props.ready !== false : canUseSourceRotoKey;
  const canPasteRotoKey = sessionKeyAvailability ? sessionKeyAvailability.canPaste && props.ready !== false : Boolean(props.hasCopiedRotoKey) && !keyUtilitiesDisabledByBusyState;
  const canDeleteRotoKey = physicalActions ? physicalDeleteAvailable && props.ready !== false : (sessionKeyAvailability ? (sessionKeyAvailability.canDelete || canUseSourceRotoKey) && props.ready !== false : canUseSourceRotoKey);
  const physicalDragAvailable = physicalActions?.canDragKey.value ?? false;
  const rotoDragLocked = keyUtilitiesDisabledByBusyState || !physicalActions || !physicalDragAvailable;
  // Guarded-icon-action availability reasons (D-12): verbatim controller ports
  // via getRotoKeyUtilityDisabledMessage (which defers to physicalActions /
  // sessionKeyAvailability reasons) and scriptAvailability reason ports. The
  // view never shortens, re-derives, or infers these reasons.
  const insertRotoKeyDisabledReason = canInsertRotoKey ? null : getRotoKeyUtilityDisabledMessage('insert');
  const duplicateRotoKeyDisabledReason = canDuplicateRotoKey ? null : getRotoKeyUtilityDisabledMessage('duplicate');
  const copyRotoKeyDisabledReason = canCopyRotoKey ? null : getRotoKeyUtilityDisabledMessage('copy');
  const pasteRotoKeyDisabledReason = canPasteRotoKey ? null : getRotoKeyUtilityDisabledMessage('paste');
  const deleteRotoKeyDisabledReason = canDeleteRotoKey ? null : getRotoKeyUtilityDisabledMessage('delete');
  const canCopyRotoScript = Boolean(scriptAvailability?.canCopy);
  const canApplyRotoScript = Boolean(scriptAvailability?.canApply);
  const copyRotoScriptDisabledReason = canCopyRotoScript ? null : scriptAvailability?.copyDisabledReason ?? null;
  const applyRotoScriptDisabledReason = canApplyRotoScript ? null : scriptAvailability?.applyDisabledReason ?? null;
  const insertKeyTooltip = useStyledTooltip();
  const duplicateKeyTooltip = useStyledTooltip();
  const copyKeyTooltip = useStyledTooltip();
  const pasteKeyTooltip = useStyledTooltip();
  const deleteKeyTooltip = useStyledTooltip();
  const copyScriptTooltip = useStyledTooltip();
  const applyScriptTooltip = useStyledTooltip();
  const closeTooltip = useStyledTooltip();
  const rotoKeyRecords = props.rotoKeyRecords ?? [];
  const keyIdByAppFrame = useMemo(() => {
    const map = new Map<number, string>();
    for (const record of rotoKeyRecords) map.set(record.appFrame, record.keyId);
    return map;
  }, [rotoKeyRecords]);
  const rotoDragValidityKey = `${props.rotoDragContextKey ?? 'none'}:${frameCells[0] ?? -1}:${frameCells[frameCells.length - 1] ?? -1}:${currentPhysicalCells.map((cell) => `${cell.kind}@${cell.appFrame}`).join(',')}:${rotoDragLocked ? 1 : 0}:${rotoKeyRecords.map((record) => `${record.keyId}@${record.appFrame}`).join(',')}`;
  const rotoDragFeedback = getRotoDragFeedback(rotoDragPreview);
  const resolverApprovedGeneratedTarget = Boolean(rotoDragPreview?.candidateValid && rotoDragPreview.candidateKind === 'generated');
  const rotoDragPreviewViewModel: RotoDragPreviewViewModel | null = rotoDragPreview?.publication
    ? getRotoDragPreviewViewModel(rotoDragPreview.publication.proposal, { committing: rotoDragPreview.pending })
    : null;
  const rotoDragVacatedAppFrames = useMemo(() => {
    if (!rotoDragPreview?.publication) return new Set<number>();
    return collectRotoDragVacatedAppFrames(currentPhysicalCells, rotoDragPreview.publication.proposal);
  }, [currentPhysicalCells, rotoDragPreview]);
  function handleRotoPlaybackFpsInput(event: Event) {
    const value = Number((event.currentTarget as HTMLInputElement).value);
    if (Number.isFinite(value)) props.onRotoPlaybackFpsChange?.(value);
  }

  function handleForceSpacingInput(event: Event) {
    physicalActions?.setForceSpacingInput((event.currentTarget as HTMLInputElement).value);
  }

  function handleForceSpacingSubmit(event: Event) {
    event.preventDefault();
    if (props.ready === false || props.mutationLocked || !forceSpacingAvailable) return;
    void physicalActions?.applyForceSpacing();
  }

  function handleInterpolationModeChange(event: Event) {
    const mode = (event.currentTarget as HTMLSelectElement).value;
    if (mode !== 'duplicate' && mode !== 'blend') return;
    props.onRotoInterpolationModeChange?.(mode);
  }

  function handleRotoCellClick(frame: number, vm: RotoCellViewModel) {
    if (suppressNextRotoClickRef.current) {
      suppressNextRotoClickRef.current = false;
      return;
    }
    if (vm.baseMeaning === 'generated' || vm.isEditableTarget === false) {
      props.onNavigateToSyncedFrame(frame);
      return;
    }
    props.onNavigateToSyncedFrame(frame);
  }

  function getGeneratedRotoTitle(frame: number): string {
    return GENERATED_ROTO_TITLE_TEMPLATE.replace('{frame}', String(frame));
  }

  function getGeneratedRotoDisabledStatus(frame: number): string {
    return GENERATED_ROTO_DISABLED_STATUS_TEMPLATE.replace('{frame}', String(frame));
  }

  function getRotoKeyBusyStatus(frame: number): string {
    return ROTO_KEY_BUSY_STATUS_TEMPLATE.replace('{frame}', String(frame));
  }

  function getRotoKeyUtilityDisabledMessage(action: RotoKeyUtilityAction): string {
    if (action === 'insert' && physicalActions) return physicalInsertDisabledReason ?? 'Insert is unavailable.';
    if (action === 'delete' && physicalActions) return physicalDeleteDisabledReason ?? 'Delete is unavailable.';
    if (sessionKeyAvailability?.busy) return sessionKeyAvailability.disabledReason ?? 'Finish the current key action before using key tools.'.replace('{frame}', String(props.currentFrame));
    if (keyUtilitiesDisabledByBusyState) return 'Finish the current key action before using key tools.'.replace('{frame}', String(props.currentFrame));
    if (currentRotoCell.baseMeaning === 'generated' || currentRotoCell.isEditableTarget === false) return 'Generated frame {frame} is render-only. Use timeline navigation or playback; edit a real Roto key to paint.'.replace('{frame}', String(currentRotoCell.frame));
    if (action === 'paste') return sessionKeyAvailability?.pasteDisabledReason ?? 'Copy a real Roto key before pasting.';
    if (action === 'insert') return 'Select a real Roto key to insert.';
    if (action === 'duplicate') return 'Select a real Roto key to duplicate.';
    if (action === 'copy') return 'Select a real Roto key to copy.';
    return 'Select a real Roto key to delete.';
  }

  const updateScrollbar = useCallback(() => {
    const el = timelineScrollRef.current;
    if (!el) return;
    const { clientWidth, scrollLeft, scrollWidth } = el;
    const visible = scrollWidth > clientWidth + 1;
    if (!visible) {
      setScrollbar({ left: 0, width: 0, visible: false });
      return;
    }
    const thumbWidth = Math.max(120, (clientWidth / scrollWidth) * clientWidth);
    const thumbRange = clientWidth - thumbWidth;
    const scrollRange = scrollWidth - clientWidth;
    setScrollbar({
      left: scrollRange > 0 ? (scrollLeft / scrollRange) * thumbRange : 0,
      width: thumbWidth,
      visible,
    });
  }, []);

  const classifyRotoDragTarget = useCallback((clientX: number, clientY: number, movedKeyId: string, sourceAppFrame: number): {
    target: RotoDragTarget | null;
    kind: RotoDragCandidateKind;
    valid: boolean;
    error: string | null;
  } => {
    const invalid = (kind: RotoDragCandidateKind, error: string): { target: null; kind: RotoDragCandidateKind; valid: false; error: string | null } => ({ target: null, kind, valid: false, error });
    const scroller = timelineScrollRef.current;
    if (!scroller || rotoDragLocked) return invalid('locked', physicalActions?.dragDisabledReason.value ?? 'Finish the current key action before moving a Roto key.');
    const rect = scroller.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return invalid('outside', 'Move the Roto key onto a visible timeline frame.');
    const hit = document.elementFromPoint(clientX, clientY);
    const cell = hit instanceof Element ? hit.closest<HTMLElement>('[data-roto-app-frame]') : null;
    if (!cell || !scroller.contains(cell)) return invalid('outside', 'Move the Roto key onto a visible timeline frame.');
    const appFrameAttr = cell.dataset.rotoAppFrame;
    const appFrame = Number(appFrameAttr);
    if (!Number.isInteger(appFrame) || appFrame < 0) return invalid('outside', 'Move the Roto key onto a visible timeline frame.');
    const cellKind = cell.dataset.rotoKind === 'generated' ? 'generated' : cell.dataset.rotoKind === 'real-key' ? 'real-key' : 'empty';
    if (cellKind === 'real-key') {
      const targetKeyId = cell.dataset.rotoKeyId;
      if (!targetKeyId) return invalid('real-key', 'The occupied Roto key identity is unavailable.');
      if (targetKeyId === movedKeyId) {
        // Self-target: resolver would return changed:false; do not publish.
        return invalid('real-key', 'Move the Roto key to a different position.');
      }
      // Occupied before/after boundary (D-07/D-21): compare pointer X with
      // the cell's midpoint to choose the boundary direction. The resolver
      // resolves the final insertion frame after cutting the moved identity.
      const cellRect = cell.getBoundingClientRect();
      const midpoint = cellRect.left + cellRect.width / 2;
      const boundary: 'before-key' | 'after-key' = clientX <= midpoint ? 'before-key' : 'after-key';
      return {
        target: { kind: boundary, targetKeyId },
        kind: 'real-key',
        valid: true,
        error: null,
      };
    }
    // Empty/generated whole-cell target (D-23).
    if (appFrame === sourceAppFrame) {
      // Self-target via physical-cell: resolver would return changed:false.
      return invalid('empty', 'Move the Roto key to a different position.');
    }
    return {
      target: { kind: 'physical-cell', appFrame },
      kind: cellKind === 'generated' ? 'generated' : 'empty',
      valid: true,
      error: null,
    };
  }, [frameCells, keyIdByAppFrame, physicalActions, rotoDragLocked]);

  const updateRotoDragCandidate = useCallback((session: RotoDragGestureSession) => {
    const candidate = classifyRotoDragTarget(session.latestX, session.latestY, session.movedKeyId, session.sourceAppFrame);
    session.candidateTarget = candidate.target;
    session.candidateKind = candidate.kind;
    session.candidateValid = candidate.valid;
    session.candidateError = candidate.valid ? null : candidate.error;
    session.publication = null;
    if (candidate.valid && candidate.target && physicalActions) {
      const preparation: RotoDragPreparationResult = physicalActions.prepareRotoKeyDrag(session.movedKeyId, candidate.target);
      if (preparation.ok) {
        session.publication = preparation.publication;
      } else {
        session.candidateValid = false;
        session.candidateError = preparation.reason;
      }
    }
    if (!session.started) return;
    setRotoDragPreview({
      movedKeyId: session.movedKeyId,
      sourceAppFrame: session.sourceAppFrame,
      publication: session.publication,
      candidateKind: session.candidateKind,
      candidateValid: session.candidateValid,
      error: session.candidateError,
      pending: false,
    });
  }, [classifyRotoDragTarget, physicalActions]);

  const startRotoEdgeScroll = useCallback((session: RotoDragGestureSession) => {
    if (session.rafId !== null) return;
    const tick = (timestamp: number) => {
      const active = rotoDragGestureRef.current;
      if (!active || active !== session || !active.started) return;
      const scroller = timelineScrollRef.current;
      if (!scroller) {
        active.cleanup();
        return;
      }
      const rect = scroller.getBoundingClientRect();
      const leftDepth = Math.max(0, Math.min(ROTO_EDGE_SCROLL_ZONE_PX, rect.left + ROTO_EDGE_SCROLL_ZONE_PX - active.latestX));
      const rightDepth = Math.max(0, Math.min(ROTO_EDGE_SCROLL_ZONE_PX, active.latestX - (rect.right - ROTO_EDGE_SCROLL_ZONE_PX)));
      const direction = leftDepth > 0 ? -1 : rightDepth > 0 ? 1 : 0;
      const depth = Math.max(leftDepth, rightDepth);
      const previousTime = active.lastRafTime ?? timestamp;
      active.lastRafTime = timestamp;
      if (direction !== 0 && depth > 0) {
        const ratio = depth / ROTO_EDGE_SCROLL_ZONE_PX;
        const speed = ROTO_EDGE_SCROLL_MIN_PX_PER_SECOND + (ROTO_EDGE_SCROLL_MAX_PX_PER_SECOND - ROTO_EDGE_SCROLL_MIN_PX_PER_SECOND) * ratio;
        const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
        const nextScroll = Math.max(0, Math.min(maxScroll, scroller.scrollLeft + direction * speed * Math.min(0.05, (timestamp - previousTime) / 1000)));
        if (nextScroll !== scroller.scrollLeft) {
          scroller.scrollLeft = nextScroll;
          updateScrollbar();
          updateRotoDragCandidate(active);
        }
      }
      active.rafId = window.requestAnimationFrame(tick);
    };
    session.rafId = window.requestAnimationFrame(tick);
  }, [updateRotoDragCandidate, updateScrollbar]);

  const handleRotoCellPointerDown = useCallback((event: PointerEvent, sourceAppFrame: number, movedKeyId: string) => {
    if (!event.isPrimary || event.button !== 0 || rotoDragLocked || !physicalActions || rotoDragGestureRef.current) return;
    const sourceElement = event.currentTarget as HTMLButtonElement;
    let active = true;
    const session: RotoDragGestureSession = {
      pointerId: event.pointerId,
      movedKeyId,
      sourceAppFrame,
      sourceElement,
      originX: event.clientX,
      originY: event.clientY,
      latestX: event.clientX,
      latestY: event.clientY,
      started: false,
      candidateTarget: null,
      candidateKind: 'outside',
      candidateValid: false,
      candidateError: null,
      publication: null,
      rafId: null,
      lastRafTime: null,
      validityKey: rotoDragValidityKey,
      cleanup: () => {},
    };
    const clearSuppressionSoon = () => window.setTimeout(() => { suppressNextRotoClickRef.current = false; }, 0);
    // Focus restoration helpers (D-24). On cancellation or failed settlement,
    // restore focus to the source keyId when it still exists after rollback;
    // if it no longer exists (launch replaced), leave focus on the timeline
    // container rather than guessing a nearest frame.
    const restoreSourceFocus = () => {
      if (!mountedRef.current) return;
      const scroller = timelineScrollRef.current;
      if (!scroller) return;
      const selector = `[data-roto-key-id="${cssEscape(session.movedKeyId)}"]`;
      const sourceCell = scroller.querySelector<HTMLElement>(selector);
      if (sourceCell) {
        sourceCell.focus();
      } else {
        // Source identity no longer mounted (launch replaced/disposed). Leave
        // focus on the stable timeline container rather than guessing.
        scroller.focus();
      }
    };
    const cleanup = () => {
      if (!active) return;
      active = false;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
      window.removeEventListener('keydown', handleEscape, true);
      sourceElement.removeEventListener('lostpointercapture', handleLostPointerCapture);
      if (session.rafId !== null) window.cancelAnimationFrame(session.rafId);
      session.rafId = null;
      if (sourceElement.hasPointerCapture(session.pointerId)) sourceElement.releasePointerCapture(session.pointerId);
      if (rotoDragGestureRef.current === session) rotoDragGestureRef.current = null;
      // Always clear the transient preview on cleanup. The valid-release
      // pointer-up path sets its pending preview AFTER cleanup so the
      // committing state survives. Every other path (invalid release,
      // Escape, pointercancel, lostpointercapture, validity-key change,
      // unmount) clears the preview here. Idempotent across repeat calls.
      if (mountedRef.current) setRotoDragPreview(null);
    };
    const beginDrag = () => {
      if (session.started) return;
      session.started = true;
      try {
        sourceElement.setPointerCapture(session.pointerId);
      } catch {
        session.started = false;
        cleanup();
        return;
      }
      suppressNextRotoClickRef.current = true;
      updateRotoDragCandidate(session);
      startRotoEdgeScroll(session);
    };
    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== session.pointerId || rotoDragGestureRef.current !== session) return;
      session.latestX = moveEvent.clientX;
      session.latestY = moveEvent.clientY;
      if (!session.started && Math.hypot(session.latestX - session.originX, session.latestY - session.originY) >= ROTO_DRAG_THRESHOLD_PX) beginDrag();
      if (session.started) {
        moveEvent.preventDefault();
        updateRotoDragCandidate(session);
      }
    };
    const handlePointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== session.pointerId || rotoDragGestureRef.current !== session) return;
      session.latestX = upEvent.clientX;
      session.latestY = upEvent.clientY;
      if (!session.started) {
        cleanup();
        return;
      }
      upEvent.preventDefault();
      // Re-hit-test the release target and require signature equality with
      // the retained publication (D-09). A changed, missing, invalid, or
      // stale release target cancels rather than committing an unseen
      // proposal.
      const release = classifyRotoDragTarget(session.latestX, session.latestY, session.movedKeyId, session.sourceAppFrame);
      const retainedPublication = session.publication;
      const releaseMatchesRetained = release.valid && release.target !== null && retainedPublication !== null && targetSignaturesEqual(release.target, retainedPublication.targetSignature);
      if (!releaseMatchesRetained) {
        cleanup();
        clearSuppressionSoon();
        // Restore focus to the source identity (D-24). No coordinator call.
        restoreSourceFocus();
        return;
      }
      // Keep the exact complete proposal visible as committing while the
      // coordinator acknowledges the mutation (D-09/D-24). Set the pending
      // preview AFTER cleanup so it survives cleanup's preview clear.
      cleanup();
      if (mountedRef.current) {
        setRotoDragPreview({
          movedKeyId: session.movedKeyId,
          sourceAppFrame: session.sourceAppFrame,
          publication: retainedPublication,
          candidateKind: session.candidateKind,
          candidateValid: true,
          error: null,
          pending: true,
        });
      }
      clearSuppressionSoon();
      void physicalActions!.commitRotoKeyDrag(retainedPublication!).then((accepted) => {
        if (!mountedRef.current) return;
        setRotoDragPreview(null);
        if (!accepted) {
          // Failed settlement: restore focus to the source identity after
          // complete rollback (D-24). No history command is recorded.
          restoreSourceFocus();
          return;
        }
        // Focus follows the moved identity at its accepted appFrame (D-24).
        // The proposal IS the accepted state (coordinator revalidates and
        // accepts it unchanged), so proposal.mapping is authoritative.
        const movedAppFrame = retainedPublication!.proposal.mapping.get(session.movedKeyId) ?? null;
        if (movedAppFrame === null) return;
        const selector = `[data-roto-key-id="${cssEscape(session.movedKeyId)}"]`;
        const targetCell = timelineScrollRef.current?.querySelector<HTMLElement>(selector) ?? null;
        if (targetCell) {
          targetCell.focus();
        } else {
          // Fallback: focus the cell at the accepted appFrame.
          timelineScrollRef.current?.querySelector<HTMLElement>(`[data-roto-app-frame="${movedAppFrame}"]`)?.focus();
        }
      }).catch(() => {
        if (mountedRef.current) {
          setRotoDragPreview(null);
          restoreSourceFocus();
        }
      });
    };
    const handlePointerCancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId !== session.pointerId) return;
      cleanup();
      clearSuppressionSoon();
      // pointercancel is a non-committing cancellation (D-24).
      restoreSourceFocus();
    };
    const handleLostPointerCapture = () => {
      if (rotoDragGestureRef.current !== session) return;
      cleanup();
      clearSuppressionSoon();
      // lostpointercapture is a non-committing cancellation (D-24).
      restoreSourceFocus();
    };
    const handleEscape = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key !== 'Escape' || rotoDragGestureRef.current !== session || !session.started) return;
      keyEvent.preventDefault();
      keyEvent.stopImmediatePropagation();
      cleanup();
      clearSuppressionSoon();
      // Escape is a non-committing cancellation (D-24).
      restoreSourceFocus();
    };
    session.cleanup = cleanup;
    rotoDragGestureRef.current = session;
    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    window.addEventListener('keydown', handleEscape, true);
    sourceElement.addEventListener('lostpointercapture', handleLostPointerCapture);
  }, [classifyRotoDragTarget, physicalActions, rotoDragLocked, rotoDragValidityKey, startRotoEdgeScroll, updateRotoDragCandidate]);

  useEffect(() => {
    const active = rotoDragGestureRef.current;
    if (active && active.validityKey !== rotoDragValidityKey) active.cleanup();
  }, [rotoDragValidityKey]);

  useEffect(() => () => {
    mountedRef.current = false;
    rotoDragGestureRef.current?.cleanup();
  }, []);

  useEffect(() => {
    const el = timelineScrollRef.current;
    if (!el) return;
    updateScrollbar();
    const observer = new ResizeObserver(updateScrollbar);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [frameCells, updateScrollbar]);

  function handleTimelineScrollbarPointerDown(event: PointerEvent) {
    const el = timelineScrollRef.current;
    const target = event.currentTarget as HTMLElement;
    if (!el) return;
    const rect = target.getBoundingClientRect();
    const thumbLeft = scrollbar.left;
    const thumbRight = scrollbar.left + scrollbar.width;
    const pointerX = event.clientX - rect.left;
    const thumbOffset = pointerX >= thumbLeft && pointerX <= thumbRight ? pointerX - thumbLeft : scrollbar.width / 2;
    const scrollFromPointer = (clientX: number) => {
      const x = Math.max(0, Math.min(rect.width - scrollbar.width, clientX - rect.left - thumbOffset));
      const maxScroll = el.scrollWidth - el.clientWidth;
      const maxThumb = rect.width - scrollbar.width;
      el.scrollLeft = maxThumb > 0 ? (x / maxThumb) * maxScroll : 0;
      updateScrollbar();
    };
    target.setPointerCapture(event.pointerId);
    scrollFromPointer(event.clientX);
    const handlePointerMove = (moveEvent: PointerEvent) => scrollFromPointer(moveEvent.clientX);
    const handlePointerUp = (upEvent: PointerEvent) => {
      target.releasePointerCapture(upEvent.pointerId);
      target.removeEventListener('pointermove', handlePointerMove);
      target.removeEventListener('pointerup', handlePointerUp);
      target.removeEventListener('pointercancel', handlePointerUp);
    };
    target.addEventListener('pointermove', handlePointerMove);
    target.addEventListener('pointerup', handlePointerUp);
    target.addEventListener('pointercancel', handlePointerUp);
  }

  return (
    <section class="physics-paint-workflow-strip" aria-label="Physics Paint workflow strip">
      <div class="physics-paint-workflow-header">
        <div class="physics-paint-mode-label" aria-label="Selected Physics Paint mode">
          {props.workflowLabel ?? 'PPaint'}
        </div>

        <div class="physics-paint-pill physics-paint-pill--navigation physics-paint-roto-navigation-controls" role="group" aria-label="Roto frame navigation">
          <button type="button" class="physics-paint-nav-button" aria-label="Go to first frame" onClick={props.onGoToFirstFrame}><ChevronFirst size={15} /></button>
          <button type="button" class="physics-paint-nav-button" aria-label="Go to previous frame" onClick={props.onGoToPreviousFrame}><ChevronsLeft size={15} /></button>
          <button type="button" class={`physics-paint-nav-button physics-paint-roto-transport ${props.isRotoCachedPlaybackActive ? 'active' : ''}`} aria-label={props.isRotoCachedPlaybackActive ? 'Stop cached Roto playback' : 'Play cached Roto frames'} disabled={props.ready === false || !props.rotoCachedPlaybackAvailable || !props.onToggleRotoPlayback} onClick={props.onToggleRotoPlayback}>{props.isRotoCachedPlaybackActive ? <Square size={15} /> : <Play size={15} />}</button>
          <output class="physics-paint-current-frame">{props.currentFrame}</output>
          <button type="button" class="physics-paint-nav-button" aria-label="Go to next frame" onClick={props.onGoToNextFrame}><ChevronsRight size={15} /></button>
          <button type="button" class="physics-paint-nav-button" aria-label="Go to last frame" onClick={props.onGoToLastFrame}><ChevronLast size={15} /></button>
        </div>

        <div class="physics-paint-header-capsule-slot" aria-hidden="true" />

        {props.onRotoInterpolationEnabledChange ? (
          <div
            class="physics-paint-pill physics-paint-pill--interpolation physics-paint-roto-interpolation-controls"
            role="group"
            aria-label="Roto interpolation settings"
            data-enabled={interpolationEnabled ? 'true' : 'false'}
            data-pending={props.rotoInterpolationPending ? 'true' : 'false'}
            title={interpolationStatus}
          >
            <button
              type="button"
              class={`physics-paint-roto-interpolation-toggle ${interpolationEnabled ? 'active' : ''}`}
              aria-label={interpolationEnabled ? 'Disable generated in-betweens' : 'Enable generated in-betweens'}
              aria-pressed={interpolationEnabled}
              aria-busy={props.rotoInterpolationPending ? 'true' : undefined}
              disabled={interpolationControlsDisabled}
              onClick={() => {
                if (props.mutationLocked || props.rotoInterpolationPending) return;
                props.onRotoInterpolationEnabledChange?.(!interpolationEnabled);
              }}
            >
              <Blend size={15} aria-hidden="true" />
            </button>
            <label class="physics-paint-roto-interpolation-mode">
              <select
                class="physics-paint-roto-interpolation-select"
                value={interpolationMode}
                aria-label="Interpolation mode"
                disabled={interpolationControlsDisabled || !props.onRotoInterpolationModeChange}
                onChange={handleInterpolationModeChange}
              >
                <option value="duplicate">Duplicate</option>
                <option value="blend">Blend</option>
              </select>
            </label>
          </div>
        ) : null}

        <div class="physics-paint-pill physics-paint-pill--playback physics-paint-roto-playback-controls" role="group" aria-label="Roto playback settings">
          <button type="button" class={`physics-paint-nav-button physics-paint-roto-loop-toggle ${props.rotoCachedPlaybackLoop ? 'active' : ''}`} aria-label="Loop cached Roto playback" aria-pressed={Boolean(props.rotoCachedPlaybackLoop)} disabled={props.ready === false || !props.onRotoPlaybackLoopChange} onClick={() => props.onRotoPlaybackLoopChange?.(!props.rotoCachedPlaybackLoop)}><RotateCcw size={15} /></button>
          <label class="physics-paint-roto-fps-control">
            <span>fps</span>
            <input type="number" min="1" max="60" step="0.5" value={props.rotoCachedPlaybackFps ?? props.projectFps ?? 1} aria-label="Cached Roto playback frames per second" disabled={props.ready === false} onInput={handleRotoPlaybackFpsInput} />
          </label>
        </div>

        {physicalActions ? (
          <form class="physics-paint-pill physics-paint-pill--apply-spacing physics-paint-roto-force-spacing-controls" title={forceSpacingDisabledReason ?? 'Set empty physical frames between real Roto keys'} onSubmit={handleForceSpacingSubmit}>
            <AlignHorizontalSpaceAround size={15} aria-hidden="true" />
            <input type="number" min="0" step="1" value={forceSpacingInput} aria-label="Empty frames between real keys" disabled={interpolationControlsDisabled || !forceSpacingAvailable} onInput={handleForceSpacingInput} />
            <button
              type="submit"
              class="physics-paint-roto-force-spacing-apply"
              aria-label="Apply force spacing"
              disabled={interpolationControlsDisabled || !forceSpacingAvailable}
            >Apply</button>
          </form>
        ) : null}

        <div class="physics-paint-state-actions">
          <span class="physics-paint-roto-key-icon-action" onPointerEnter={closeTooltip.onPointerEnter} onPointerLeave={closeTooltip.onPointerLeave}>
            <button
              type="button"
              class="physics-paint-roto-key-icon-button"
              aria-label="Close"
              onFocus={closeTooltip.onFocus}
              onBlur={closeTooltip.onBlur}
              onClick={() => {
                closeTooltip.hide();
                props.onClose?.();
              }}
            >
              <X size={15} aria-hidden="true" />
            </button>
            <PhysicsPaintStyledTooltip visible={closeTooltip.visible}>Close</PhysicsPaintStyledTooltip>
          </span>
        </div>
      </div>

      <div class="physics-paint-timeline" aria-label="Physics Paint timeline">
        <div ref={timelineScrollRef} class="physics-paint-timeline-scroll" onScroll={updateScrollbar}>
          <div class="physics-paint-ruler" style={{ width: '1800px', minWidth: '1800px' }} aria-hidden="true">
            {rotoRulerTicks.map(frame => (
              <span key={frame} class="physics-paint-ruler-tick">{frame}</span>
            ))}
          </div>

            <div class="physics-paint-lane">
              <div class="physics-paint-roto-cells" role="row">
                {frameCells.map(frame => {
                  const semanticCell = physicalCellByAppFrame.get(frame) ?? null;
                  const isGenerated = semanticCell?.kind === 'generated';
                  const cachedFramesForCell = isGenerated && !cachedRotoFrames.some((candidate) => candidate.appFrame === frame)
                    ? [...cachedRotoFrames, { frameIndex: 0, appFrame: frame, dataUrl: 'data:image/png;base64,', source: 'generated-interpolation' as const }]
                    : cachedRotoFrames;
                  const vm = getRotoCellViewModel({
                    frame,
                    currentFrame: props.currentFrame,
                    cachedFrames: cachedFramesForCell,
                  });
                  const fill = getRotoCellFill(frame, realCachedRotoFrames);
                  const isPhysicalRealKey = semanticCell?.kind === 'real';
                  const fillClass = isPhysicalRealKey
                    ? 'roto-fill-cached'
                    : `${getRotoFillClass(fill)} ${vm.fillClass}`;
                  const isOccupiedRealKey = isPhysicalRealKey;
                  const semanticKind = isGenerated ? 'generated' : isOccupiedRealKey ? 'real-key' : 'empty';
                  const generatedTitle = isGenerated ? getGeneratedRotoTitle(frame) : null;
                  const cellKeyId = semanticCell?.kind === 'real' ? semanticCell.keyId : keyIdByAppFrame.get(frame) ?? null;
                  const dragEligible = isPhysicalRealKey && !rotoDragLocked;
                  // Identity-based Drag preview (D-07/D-21/D-22/D-23/D-24).
                  const previewCell = rotoDragPreviewViewModel?.cellsByAppFrame.get(frame) ?? null;
                  const isDragSource = rotoDragPreview?.sourceAppFrame === frame && rotoDragPreview?.movedKeyId === cellKeyId;
                  const isDragMoved = previewCell?.role === 'moved';
                  const isDragShifted = previewCell?.role === 'shifted';
                  const isDragTarget = previewCell?.role === 'target';
                  const isDragGenerated = previewCell?.role === 'generated';
                  const isDragVacated = rotoDragVacatedAppFrames.has(frame);
                  const isDragCommitting = Boolean(rotoDragPreview?.pending && rotoDragPreviewViewModel);
                  const hasTargetFeedback = Boolean(rotoDragFeedback && (isDragMoved || isDragShifted || isDragTarget || isDragGenerated || isDragVacated || isDragSource));
                  const dragLabel = hasTargetFeedback
                    ? (previewCell?.ariaLabel ?? rotoDragFeedback ?? vm.ariaLabel)
                    : dragEligible ? `${vm.ariaLabel} Drag this real Roto key to an empty frame.` : generatedTitle ?? vm.ariaLabel;
                  const dragTitle = hasTargetFeedback
                    ? (previewCell?.title ?? rotoDragFeedback ?? vm.title)
                    : dragEligible ? `${vm.title} Drag to move this real Roto key.` : generatedTitle ?? vm.title;
                  const cellClass = `physics-paint-roto-cell ${fillClass} ${isOccupiedRealKey ? 'occupied' : ''} ${isPhysicalRealKey || isSavedFrame(props.savedRotoFrames, frame) ? 'saved' : ''} ${vm.overlays.includes('dirty') ? 'dirty' : ''} ${vm.overlays.includes('pending') ? 'pending' : ''} ${vm.overlays.includes('current') ? 'current' : ''} ${dragEligible ? 'roto-drag-eligible' : ''} ${isDragSource ? 'roto-drag-source' : ''} ${isDragMoved ? 'roto-drag-moved' : ''} ${isDragShifted ? 'roto-drag-shifted' : ''} ${isDragTarget ? 'roto-drag-target' : ''} ${isDragGenerated ? 'roto-drag-generated' : ''} ${isDragVacated ? 'roto-drag-vacated' : ''} ${isDragTarget && previewCell?.targetBoundary === 'before' ? 'roto-drag-target-before' : ''} ${isDragTarget && previewCell?.targetBoundary === 'after' ? 'roto-drag-target-after' : ''} ${rotoDragPreview && !rotoDragPreview.candidateValid && rotoDragPreview.publication === null && (isDragMoved || isDragSource) ? 'roto-drag-target-invalid' : ''} ${isDragCommitting ? 'roto-drag-committing' : ''}`;
                  return (
                    <button
                      key={frame}
                      class={cellClass}
                      data-roto-app-frame={frame}
                      data-roto-kind={semanticKind}
                      data-roto-key-id={cellKeyId ?? undefined}
                      aria-label={dragLabel}
                      title={dragTitle}
                      onPointerDown={dragEligible && cellKeyId ? (event) => handleRotoCellPointerDown(event as unknown as PointerEvent, frame, cellKeyId) : undefined}
                      onClick={() => handleRotoCellClick(frame, vm)}
                    >
                      <span>{frame}</span>
                    </button>
                  );
                })}
              </div>
              <div class="physics-paint-roto-key-utilities" role="group" aria-label={`Roto key utilities for frame ${props.currentFrame}`}>
                <span class="physics-paint-roto-key-context" aria-hidden="true">Key {props.currentFrame}</span>
                <span class="physics-paint-roto-key-icon-action" onPointerEnter={insertKeyTooltip.onPointerEnter} onPointerLeave={insertKeyTooltip.onPointerLeave}>
                  <button
                    type="button"
                    class="physics-paint-roto-key-icon-button"
                    aria-label="Insert key before"
                    aria-disabled={!canInsertRotoKey ? 'true' : undefined}
                    aria-describedby={!canInsertRotoKey && insertRotoKeyDisabledReason ? 'roto-key-action-reason-insert' : undefined}
                    onFocus={insertKeyTooltip.onFocus}
                    onBlur={insertKeyTooltip.onBlur}
                    onClick={() => {
                      insertKeyTooltip.hide();
                      if (!canInsertRotoKey) return;
                      props.onInsertRotoFrame?.();
                    }}
                    onKeyDown={(event) => {
                      if ((event.key === 'Enter' || event.key === ' ') && !canInsertRotoKey) event.preventDefault();
                    }}
                  >
                    <BetweenVerticalStart size={15} aria-hidden="true" />
                  </button>
                  {!canInsertRotoKey && insertRotoKeyDisabledReason ? (
                    <span id="roto-key-action-reason-insert" class="physics-paint-sr-only">{insertRotoKeyDisabledReason}</span>
                  ) : null}
                  <PhysicsPaintStyledTooltip visible={insertKeyTooltip.visible}>
                    {!canInsertRotoKey && insertRotoKeyDisabledReason ? `Insert key before — unavailable: ${insertRotoKeyDisabledReason}` : 'Insert key before'}
                  </PhysicsPaintStyledTooltip>
                </span>
                <span class="physics-paint-roto-key-icon-action" onPointerEnter={duplicateKeyTooltip.onPointerEnter} onPointerLeave={duplicateKeyTooltip.onPointerLeave}>
                  <button
                    type="button"
                    class="physics-paint-roto-key-icon-button"
                    aria-label="Duplicate key"
                    aria-disabled={!canDuplicateRotoKey ? 'true' : undefined}
                    aria-describedby={!canDuplicateRotoKey && duplicateRotoKeyDisabledReason ? 'roto-key-action-reason-duplicate' : undefined}
                    onFocus={duplicateKeyTooltip.onFocus}
                    onBlur={duplicateKeyTooltip.onBlur}
                    onClick={() => {
                      duplicateKeyTooltip.hide();
                      if (!canDuplicateRotoKey) return;
                      props.onDuplicateRotoKey?.();
                    }}
                    onKeyDown={(event) => {
                      if ((event.key === 'Enter' || event.key === ' ') && !canDuplicateRotoKey) event.preventDefault();
                    }}
                  >
                    <CopyPlus size={15} aria-hidden="true" />
                  </button>
                  {!canDuplicateRotoKey && duplicateRotoKeyDisabledReason ? (
                    <span id="roto-key-action-reason-duplicate" class="physics-paint-sr-only">{duplicateRotoKeyDisabledReason}</span>
                  ) : null}
                  <PhysicsPaintStyledTooltip visible={duplicateKeyTooltip.visible}>
                    {!canDuplicateRotoKey && duplicateRotoKeyDisabledReason ? `Duplicate key — unavailable: ${duplicateRotoKeyDisabledReason}` : 'Duplicate key'}
                  </PhysicsPaintStyledTooltip>
                </span>
                <span class="physics-paint-roto-key-icon-action" onPointerEnter={copyKeyTooltip.onPointerEnter} onPointerLeave={copyKeyTooltip.onPointerLeave}>
                  <button
                    type="button"
                    class="physics-paint-roto-key-icon-button"
                    aria-label="Copy key"
                    aria-disabled={!canCopyRotoKey ? 'true' : undefined}
                    aria-describedby={!canCopyRotoKey && copyRotoKeyDisabledReason ? 'roto-key-action-reason-copy' : undefined}
                    onFocus={copyKeyTooltip.onFocus}
                    onBlur={copyKeyTooltip.onBlur}
                    onClick={() => {
                      copyKeyTooltip.hide();
                      if (!canCopyRotoKey) return;
                      props.onCopyRotoFrame?.();
                    }}
                    onKeyDown={(event) => {
                      if ((event.key === 'Enter' || event.key === ' ') && !canCopyRotoKey) event.preventDefault();
                    }}
                  >
                    <ClipboardCopy size={15} aria-hidden="true" />
                  </button>
                  {!canCopyRotoKey && copyRotoKeyDisabledReason ? (
                    <span id="roto-key-action-reason-copy" class="physics-paint-sr-only">{copyRotoKeyDisabledReason}</span>
                  ) : null}
                  <PhysicsPaintStyledTooltip visible={copyKeyTooltip.visible}>
                    {!canCopyRotoKey && copyRotoKeyDisabledReason ? `Copy key — unavailable: ${copyRotoKeyDisabledReason}` : 'Copy key'}
                  </PhysicsPaintStyledTooltip>
                </span>
                <span class="physics-paint-roto-key-icon-action" onPointerEnter={pasteKeyTooltip.onPointerEnter} onPointerLeave={pasteKeyTooltip.onPointerLeave}>
                  <button
                    type="button"
                    class="physics-paint-roto-key-icon-button"
                    aria-label="Paste key"
                    aria-disabled={!canPasteRotoKey ? 'true' : undefined}
                    aria-describedby={!canPasteRotoKey && pasteRotoKeyDisabledReason ? 'roto-key-action-reason-paste' : undefined}
                    onFocus={pasteKeyTooltip.onFocus}
                    onBlur={pasteKeyTooltip.onBlur}
                    onClick={() => {
                      pasteKeyTooltip.hide();
                      if (!canPasteRotoKey) return;
                      props.onPasteRotoFrame?.();
                    }}
                    onKeyDown={(event) => {
                      if ((event.key === 'Enter' || event.key === ' ') && !canPasteRotoKey) event.preventDefault();
                    }}
                  >
                    <ClipboardPaste size={15} aria-hidden="true" />
                  </button>
                  {!canPasteRotoKey && pasteRotoKeyDisabledReason ? (
                    <span id="roto-key-action-reason-paste" class="physics-paint-sr-only">{pasteRotoKeyDisabledReason}</span>
                  ) : null}
                  <PhysicsPaintStyledTooltip visible={pasteKeyTooltip.visible}>
                    {!canPasteRotoKey && pasteRotoKeyDisabledReason ? `Paste key — unavailable: ${pasteRotoKeyDisabledReason}` : 'Paste key'}
                  </PhysicsPaintStyledTooltip>
                </span>
                <span class="physics-paint-roto-key-icon-action" onPointerEnter={deleteKeyTooltip.onPointerEnter} onPointerLeave={deleteKeyTooltip.onPointerLeave}>
                  <button
                    type="button"
                    class="physics-paint-roto-key-icon-button destructive"
                    aria-label="Delete key"
                    aria-disabled={!canDeleteRotoKey ? 'true' : undefined}
                    aria-describedby={!canDeleteRotoKey && deleteRotoKeyDisabledReason ? 'roto-key-action-reason-delete' : undefined}
                    onFocus={deleteKeyTooltip.onFocus}
                    onBlur={deleteKeyTooltip.onBlur}
                    onClick={() => {
                      deleteKeyTooltip.hide();
                      if (!canDeleteRotoKey) return;
                      props.onDeleteRotoFrame?.();
                    }}
                    onKeyDown={(event) => {
                      if ((event.key === 'Enter' || event.key === ' ') && !canDeleteRotoKey) event.preventDefault();
                    }}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                  {!canDeleteRotoKey && deleteRotoKeyDisabledReason ? (
                    <span id="roto-key-action-reason-delete" class="physics-paint-sr-only">{deleteRotoKeyDisabledReason}</span>
                  ) : null}
                  <PhysicsPaintStyledTooltip visible={deleteKeyTooltip.visible}>
                    {!canDeleteRotoKey && deleteRotoKeyDisabledReason ? `Delete key — unavailable: ${deleteRotoKeyDisabledReason}` : 'Delete key'}
                  </PhysicsPaintStyledTooltip>
                </span>
                <span class="physics-paint-roto-key-icon-action" onPointerEnter={copyScriptTooltip.onPointerEnter} onPointerLeave={copyScriptTooltip.onPointerLeave}>
                  <button
                    type="button"
                    class="physics-paint-roto-key-icon-button script-action"
                    aria-label="Copy Script"
                    aria-disabled={!canCopyRotoScript ? 'true' : undefined}
                    aria-describedby={!canCopyRotoScript && copyRotoScriptDisabledReason ? 'roto-key-action-reason-copy-script' : undefined}
                    onFocus={copyScriptTooltip.onFocus}
                    onBlur={copyScriptTooltip.onBlur}
                    onClick={() => {
                      copyScriptTooltip.hide();
                      if (!canCopyRotoScript) return;
                      props.onCopyRotoScript?.();
                    }}
                    onKeyDown={(event) => {
                      if ((event.key === 'Enter' || event.key === ' ') && !canCopyRotoScript) event.preventDefault();
                    }}
                  >
                    <Clipboard size={15} aria-hidden="true" />
                  </button>
                  {!canCopyRotoScript && copyRotoScriptDisabledReason ? (
                    <span id="roto-key-action-reason-copy-script" class="physics-paint-sr-only">{copyRotoScriptDisabledReason}</span>
                  ) : null}
                  <PhysicsPaintStyledTooltip visible={copyScriptTooltip.visible}>
                    {!canCopyRotoScript && copyRotoScriptDisabledReason ? `Copy Script — unavailable: ${copyRotoScriptDisabledReason}` : 'Copy Script'}
                  </PhysicsPaintStyledTooltip>
                </span>
                <span class="physics-paint-roto-key-icon-action" onPointerEnter={applyScriptTooltip.onPointerEnter} onPointerLeave={applyScriptTooltip.onPointerLeave}>
                  <button
                    type="button"
                    class="physics-paint-roto-key-icon-button script-action"
                    aria-label="Apply Script"
                    aria-disabled={!canApplyRotoScript ? 'true' : undefined}
                    aria-describedby={!canApplyRotoScript && applyRotoScriptDisabledReason ? 'roto-key-action-reason-apply-script' : undefined}
                    onFocus={applyScriptTooltip.onFocus}
                    onBlur={applyScriptTooltip.onBlur}
                    onClick={() => {
                      applyScriptTooltip.hide();
                      if (!canApplyRotoScript) return;
                      props.onApplyRotoScript?.();
                    }}
                    onKeyDown={(event) => {
                      if ((event.key === 'Enter' || event.key === ' ') && !canApplyRotoScript) event.preventDefault();
                    }}
                  >
                    <ClipboardPen size={15} aria-hidden="true" />
                  </button>
                  {!canApplyRotoScript && applyRotoScriptDisabledReason ? (
                    <span id="roto-key-action-reason-apply-script" class="physics-paint-sr-only">{applyRotoScriptDisabledReason}</span>
                  ) : null}
                  <PhysicsPaintStyledTooltip visible={applyScriptTooltip.visible}>
                    {!canApplyRotoScript && applyRotoScriptDisabledReason ? `Apply Script — unavailable: ${applyRotoScriptDisabledReason}` : 'Apply Script'}
                  </PhysicsPaintStyledTooltip>
                </span>
              </div>
            </div>
        </div>
        {scrollbar.visible ? (
          <div class="physics-paint-timeline-scrollbar" onPointerDown={(event) => handleTimelineScrollbarPointerDown(event as unknown as PointerEvent)}>
            <span
              class="physics-paint-timeline-scrollbar-thumb"
              style={{ left: `${scrollbar.left}px`, width: `${scrollbar.width}px` }}
            />
          </div>
        ) : null}
      </div>

        <div class="physics-paint-roto-status-stack">
          <div class="physics-paint-roto-cell-legend" aria-label="Roto cell states">
            <span class="physics-paint-roto-cell-legend-title">Roto cell states</span>
            {ROTO_CELL_LEGEND_ITEMS.map(item => (
              <span key={item.label} class="physics-paint-roto-cell-legend-item">
                <span class={`physics-paint-roto-cell-swatch ${item.className}`} aria-hidden="true" />
                <span>{item.label}</span>
              </span>
            ))}
          </div>
          <p class="physics-paint-roto-status">{rotoMissingStatusLabel ?? currentRotoCell.label}</p>
          {rotoDragFeedback ? <p class="physics-paint-roto-interpolation-status" role="status" aria-live="polite">{rotoDragFeedback}</p> : null}
          {props.onRotoInterpolationEnabledChange ? <p class="physics-paint-roto-interpolation-status">{interpolationStatus}</p> : null}
          {!resolverApprovedGeneratedTarget ? <p class="physics-paint-roto-interpolation-status">{'Generated frame {frame} is render-only. Completed real-key paint is cached automatically.'}</p> : null}
          {!resolverApprovedGeneratedTarget && (currentRotoCell.baseMeaning === 'generated' || currentRotoCell.isEditableTarget === false) ? <p class="physics-paint-roto-key-status">{getGeneratedRotoDisabledStatus(currentRotoCell.frame)}</p> : null}
          {keyUtilitiesDisabledByBusyState ? <p class="physics-paint-roto-key-status">{getRotoKeyBusyStatus(props.currentFrame)}</p> : null}
          {currentRotoFill === 'cached-only' ? (
            <>
              <p class="physics-paint-roto-key-status">Cached reference</p>
              <p class="physics-paint-roto-interpolation-status">Cached reference: repaintable, not stroke-editable.</p>
            </>
          ) : null}
          {props.statusMessage ? <p class="physics-paint-roto-interpolation-status">{props.statusMessage}</p> : null}
          {scriptStatus ? <p class="physics-paint-roto-interpolation-status">{scriptStatus}</p> : null}
          {props.rotoCachedPlaybackStatus ? <p class="physics-paint-roto-playback-status">{props.rotoCachedPlaybackStatus}</p> : null}
        </div>

   </section>
  );
}
