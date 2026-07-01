import { ChevronFirst, ChevronLast, ChevronsLeft, ChevronsRight, Play, RotateCcw, Square } from 'lucide-preact';

// Source contract: a one-frame Play gap opened at frame 11 yields buildPlayFrameCells(11, 1) === [11].
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  PHYSIC_PAINT_DEFAULT_APPLY_FRAMES,
  PHYSIC_PAINT_MAX_APPLY_FRAMES,
  PHYSIC_PAINT_MIN_APPLY_FRAMES,
  PLAY_TO_ROTO_MISSING_FRAMES_MESSAGE,
  getPhysicsPaintSourceLabel,
  getPlayRangeMarker,
  getExpandedRotoRealKeyFrames,
  getRotoCellFill,
  getRotoCellViewModel,
  getRotoInterpolationSpanFrames,
  getRotoPendingLabel,
  getMissingRotoFrameStatusLabel,
  type PhysicsPaintOnionState,
  type PhysicsPaintWorkflowMode,
  type RotoCellViewModel,
  type RotoInterpolationSettings,
  type RotoMissingFrameStatusKind,
} from './physicsPaintWorkflowState';
import { clampPhysicPaintFrameCount, type PhysicPaintRotoCacheFrame } from '../../types/physicPaint';
import type { RotoKeyUtilityActionState } from './physicsPaintRotoKeyController';

const RENDER_ACTION_LABEL = 'Render play';
const RENDER_ACTION_HELP = 'Preview cached Play frames, or render and save the Play cache when it is stale.';
const CONVERT_PLAY_TO_ROTO_LABEL = 'Convert Play to Roto?';
const CONVERT_ROTO_TO_PLAY_LABEL = 'Convert Roto to Play?';
const GENERATED_ROTO_TITLE_TEMPLATE = 'Generated frame {frame} — render-only.';
const GENERATED_ROTO_DISABLED_STATUS_TEMPLATE = 'Generated frame {frame} is render-only. Use timeline navigation or playback; edit a real Roto key to paint.';
const INTERPOLATION_ENABLED_STATUS = 'Interpolation on — generated render-only in-betweens refresh from real keys.';
const INTERPOLATION_DISABLED_STATUS = 'Interpolation off — real Roto keys only.';
const ROTO_KEY_BUSY_STATUS_TEMPLATE = 'Finish saving frame {frame} before using key tools.';
type RotoKeyUtilityAction = 'insert' | 'duplicate' | 'copy' | 'paste' | 'delete';
export interface PhysicsPaintWorkflowRotoKeyState {
  actionAvailability: RotoKeyUtilityActionState;
  hasCopiedRotoKey: boolean;
}
const ROTO_CELL_LEGEND_ITEMS = [
  { label: 'Empty', className: 'roto-fill-empty' },
  { label: 'Cached', className: 'roto-fill-cached' },
  { label: 'Current', className: 'roto-fill-editable-current current' },
  { label: 'Generated', className: 'roto-fill-generated' },
  { label: 'Background only', className: 'roto-fill-background-only' },
  { label: 'Unsaved', className: 'roto-fill-cached dirty' },
  { label: 'Saving', className: 'roto-fill-cached pending' },
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
  source: 'roto' | 'play';
  kind?: 'stroke-preview' | 'cached-composite';
}

export type PhysicsPaintWorkflowConfirmation = 'convert-play-to-roto' | 'convert-roto-to-play';

export interface PhysicsPaintWorkflowStripProps {
  mode: PhysicsPaintWorkflowMode;
  currentFrame: number;
  startFrame: number;
  frameCount: number;
  isPlaying: boolean;
  ready?: boolean;
  occupiedRotoFrames?: number[];
  savedRotoFrames?: PhysicsPaintWorkflowStripFrameMarker[];
  cachedRotoFrames?: PhysicPaintRotoCacheFrame[];
  editableRotoFrames?: number[];
  pendingRotoFrames?: number[];
  rotoSaveInFlight?: boolean;
  rotoSavingFrame?: number | null;
  rotoInterpolationSettings?: RotoInterpolationSettings;
  playPublicationSummary?: string | null;
  statusMessage?: string | null;
  sameModeReplacementMessage?: string | null;
  rotoMissingFrameStatusKind?: RotoMissingFrameStatusKind | null;
  onion: PhysicsPaintOnionState;
  onionPreviewFrames?: PhysicsPaintWorkflowOnionPreviewFrame[];
  showOnionHiddenDuringPreview?: boolean;
  missingPlayFramesForConversion?: boolean;
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
  onRotoInterpolationCountChange?: (count: number) => void;
  onRotoInterpolationModeChange?: (mode: NonNullable<RotoInterpolationSettings['mode']>) => void;
  onRotoInterpolationMotionChange?: (motion: Pick<RotoInterpolationSettings, 'deform' | 'position'>) => void;
  onDuplicateRotoKey?: () => void;
  onInsertRotoFrame?: () => void;
  onDeleteRotoFrame?: () => void;
  onCopyRotoFrame?: () => void;
  onPasteRotoFrame?: () => void;
  hasCopiedRotoKey?: boolean;
  keyActionInFlight?: boolean;
  rotoKeyState?: PhysicsPaintWorkflowRotoKeyState;
  onSaveRotoFrame: () => void;
  onSavePendingRotoFrames: () => void;
  onSavePlay: () => void;
  onUpdatePlayOptions?: () => void;
  currentPreviewFrame?: number;
  maxPlayFrameCount?: number;
  maxPlayFrameCountReason?: string;
  playCacheStatus?: 'cached' | 'stale' | 'missing' | null;
  onPlayLimit?: (message: string) => void;
  onFrameCountChange: (frameCount: number) => void;
  onPlayPreview: (frameCount: number) => void;
  onStopPreview: () => void;
  onPreviewPlayFrame?: (frame: number) => void;
  onNavigateToSyncedFrame: (frame: number) => void;
  onGoToFirstFrame: () => void;
  onGoToPreviousFrame: () => void;
  onGoToNextFrame: () => void;
  onGoToLastFrame: () => void;
  onInspectPlayFrame: (frame: number) => void;
  onOnionChange: (onion: PhysicsPaintOnionState) => void;
  onConvertPlayToRoto?: () => void;
  onConvertRotoToPlay?: () => void;
}

const VIRTUAL_TIMELINE_FRAME_COUNT = 120;
const RULER_STEP = 3;
const PLAY_TIMELINE_CELL_WIDTH = 15;

function buildFrameCells(currentFrame: number): number[] {
  const visibleCount = VIRTUAL_TIMELINE_FRAME_COUNT;
  const maxStart = Math.max(0, currentFrame - Math.floor(visibleCount / 2));
  const start = Math.max(0, Math.min(maxStart, currentFrame));
  return Array.from({ length: visibleCount }, (_, index) => start + index);
}

function buildRulerTicks(frameCells: number[]): number[] {
  return frameCells.filter((frame) => frame % RULER_STEP === 0);
}

function getPlayRulerStep(frameCount: number): number {
  if (frameCount <= 6) return 1;
  if (frameCount <= 12) return 2;
  if (frameCount <= 24) return 4;
  return 6;
}

function buildPlayFrameCells(startFrame: number, frameCount: number): number[] {
  const safeStartFrame = Number.isInteger(startFrame) && startFrame >= 0 ? startFrame : 0;
  const safeFrameCount = clampPhysicPaintFrameCount(frameCount || PHYSIC_PAINT_DEFAULT_APPLY_FRAMES);
  return Array.from({ length: safeFrameCount }, (_, index) => safeStartFrame + index);
}

function isOccupiedFrame(frames: number[] | undefined, frame: number): boolean {
  return Boolean(frames?.includes(frame));
}

function isSavedFrame(markers: PhysicsPaintWorkflowStripFrameMarker[] | undefined, frame: number): boolean {
  return Boolean(markers?.some(marker => marker.frame === frame && marker.saved !== false && marker.source !== 'generated-interpolation'));
}

function getRealRotoFrames(occupiedFrames: number[] | undefined, savedFrames: PhysicsPaintWorkflowStripFrameMarker[] | undefined, cachedFrames: PhysicPaintRotoCacheFrame[] | undefined): number[] {
  return Array.from(new Set([
    ...(occupiedFrames ?? []),
    ...(savedFrames ?? []).filter(marker => marker.source !== 'generated-interpolation').map(marker => marker.frame),
    ...(cachedFrames ?? []).filter(marker => marker.source !== 'generated-interpolation').map(marker => marker.appFrame),
  ])).filter(frame => Number.isInteger(frame) && frame >= 0).sort((a, b) => a - b);
}

function getRotoFillClass(fill: ReturnType<typeof getRotoCellFill>): string {
  if (fill === 'empty') return 'roto-fill-empty';
  if (fill === 'cached-only') return 'roto-fill-cached-only';
  return 'roto-fill-editable-session';
}

export function PhysicsPaintWorkflowStrip(props: PhysicsPaintWorkflowStripProps) {
  const [confirmation, setConfirmation] = useState<PhysicsPaintWorkflowConfirmation | null>(null);
  const [pressedRotoKeyAction, setPressedRotoKeyAction] = useState<RotoKeyUtilityAction | null>(null);
  const [scrollbar, setScrollbar] = useState({ left: 0, width: 0, visible: false });
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const playRange = useMemo(
    () => getPlayRangeMarker(props.startFrame, props.frameCount, props.currentFrame),
    [props.currentFrame, props.frameCount, props.startFrame]
  );
  const interpolationSettings = props.rotoInterpolationSettings ?? { enabled: false, inBetweenCount: 0, mode: 'blend' as const, deform: 0, position: 0 };
  const materializedGeneratedRotoFrames = useMemo(() => (props.cachedRotoFrames ?? []).filter(frame => frame.source === 'generated-interpolation').map(frame => frame.appFrame), [props.cachedRotoFrames]);
  const hasMaterializedGeneratedRotoFrames = materializedGeneratedRotoFrames.length > 0;
  const realCachedRotoFrames = useMemo(() => (props.cachedRotoFrames ?? []).filter(frame => frame.source === 'real-key'), [props.cachedRotoFrames]);
  const realCachedRotoFrameNumbers = useMemo(() => realCachedRotoFrames.map(frame => frame.appFrame), [realCachedRotoFrames]);
  const realRotoFrames = useMemo(() => hasMaterializedGeneratedRotoFrames ? realCachedRotoFrameNumbers : getRealRotoFrames(props.occupiedRotoFrames, props.savedRotoFrames, props.cachedRotoFrames), [hasMaterializedGeneratedRotoFrames, props.cachedRotoFrames, props.occupiedRotoFrames, props.savedRotoFrames, realCachedRotoFrameNumbers]);
  const expandedRealRotoFrames = useMemo(() => hasMaterializedGeneratedRotoFrames ? realRotoFrames.map(frame => ({ sourceFrame: frame, frame })) : getExpandedRotoRealKeyFrames(realRotoFrames, interpolationSettings), [hasMaterializedGeneratedRotoFrames, interpolationSettings, realRotoFrames]);
  const interpolationConnectors = useMemo(() => hasMaterializedGeneratedRotoFrames ? [] : getRotoInterpolationSpanFrames(realRotoFrames, interpolationSettings), [hasMaterializedGeneratedRotoFrames, interpolationSettings, realRotoFrames]);
  const generatedRotoFrames = useMemo(() => hasMaterializedGeneratedRotoFrames ? materializedGeneratedRotoFrames : interpolationConnectors.map(connector => connector.frame), [hasMaterializedGeneratedRotoFrames, interpolationConnectors, materializedGeneratedRotoFrames]);
  const expandedCurrentFrame = expandedRealRotoFrames.find(key => key.sourceFrame === props.currentFrame)?.frame ?? props.currentFrame;
  const frameCells = useMemo(() => buildFrameCells(expandedCurrentFrame), [expandedCurrentFrame]);
  const rotoRulerTicks = useMemo(() => buildRulerTicks(frameCells), [frameCells]);
  const getMaxFrameCount = useCallback(() => (
    props.maxPlayFrameCount !== undefined
      ? Math.min(PHYSIC_PAINT_MAX_APPLY_FRAMES, props.maxPlayFrameCount)
      : PHYSIC_PAINT_MAX_APPLY_FRAMES
  ), [props.maxPlayFrameCount]);
  const maxFrameCount = getMaxFrameCount();
  const safeFrameCount = Math.min(clampPhysicPaintFrameCount(props.frameCount || PHYSIC_PAINT_DEFAULT_APPLY_FRAMES), maxFrameCount);
  const playFrameCells = useMemo(() => buildPlayFrameCells(props.startFrame, safeFrameCount), [props.startFrame, safeFrameCount]);
  const pendingRotoFrameSet = useMemo(() => new Set(props.pendingRotoFrames ?? []), [props.pendingRotoFrames]);
  const hasPendingRotoFrames = pendingRotoFrameSet.size > 0;
  const currentRotoCell = getRotoCellViewModel({
    frame: props.currentFrame,
    currentFrame: props.currentFrame,
    cachedFrames: props.cachedRotoFrames,
    editableFrames: props.editableRotoFrames,
    pendingFrames: props.pendingRotoFrames,
    isSaving: Boolean(props.rotoSaveInFlight),
  });
  const rotoMissingStatusLabel = props.rotoMissingFrameStatusKind
    ? getMissingRotoFrameStatusLabel({ frame: props.currentFrame, kind: props.rotoMissingFrameStatusKind })
    : null;
  const currentRotoFill = getRotoCellFill(props.currentFrame, realCachedRotoFrames, props.editableRotoFrames);
  const isCurrentRealRotoKey = realRotoFrames.includes(props.currentFrame) && currentRotoCell.isEditableTarget !== false;
  const sessionKeyAvailability = props.rotoKeyState?.actionAvailability;
  const keyUtilitiesDisabledByBusyState = props.ready === false || Boolean(props.rotoSaveInFlight) || Boolean(props.keyActionInFlight) || Boolean(sessionKeyAvailability?.busy);
  const canUseSourceRotoKey = isCurrentRealRotoKey && !keyUtilitiesDisabledByBusyState;
  const canUseVisibleSourceRotoKey = canUseSourceRotoKey || (Boolean(sessionKeyAvailability) && isCurrentRealRotoKey && !keyUtilitiesDisabledByBusyState);
  const canInsertRotoKey = sessionKeyAvailability ? (sessionKeyAvailability.canInsert || canUseVisibleSourceRotoKey) && props.ready !== false : canUseSourceRotoKey;
  const canDuplicateRotoKey = sessionKeyAvailability ? (sessionKeyAvailability.canDuplicate || canUseVisibleSourceRotoKey) && props.ready !== false : canUseSourceRotoKey;
  const canCopyRotoKey = sessionKeyAvailability ? (sessionKeyAvailability.canCopy || canUseVisibleSourceRotoKey) && props.ready !== false : canUseSourceRotoKey;
  const canPasteRotoKey = sessionKeyAvailability ? sessionKeyAvailability.canPaste && props.ready !== false : Boolean(props.hasCopiedRotoKey) && !keyUtilitiesDisabledByBusyState;
  const canDeleteRotoKey = sessionKeyAvailability ? (sessionKeyAvailability.canDelete || canUseVisibleSourceRotoKey) && props.ready !== false : canUseSourceRotoKey;
  const rotoPendingLabel = getRotoPendingLabel(hasPendingRotoFrames, Boolean(props.rotoSaveInFlight), props.rotoSavingFrame);
  const playRulerStep = getPlayRulerStep(safeFrameCount);
  const playRulerTicks = playFrameCells.filter((_, index) => index % playRulerStep === 0 || index === playFrameCells.length - 1);
  const rulerTicks = props.mode === 'play' ? playRulerTicks : rotoRulerTicks;
  const rulerWidth = props.mode === 'play' ? Math.max(180, safeFrameCount * PLAY_TIMELINE_CELL_WIDTH) : 1800;
  const clampedPreviewFrame = Math.max(0, Math.min(safeFrameCount - 1, Math.trunc(props.currentPreviewFrame ?? 0)));
  const playLimitMessage = props.maxPlayFrameCount !== undefined
    ? props.maxPlayFrameCountReason ?? `Play duration limited to ${props.maxPlayFrameCount} frames before the next saved Play script.`
    : null;
  const visibleInBetweenCount = Math.max(0, Math.trunc(Number(interpolationSettings.inBetweenCount) || 0));
  const hasGeneratedInBetweens = interpolationConnectors.length > 0;
  const interpolationStatus = interpolationSettings.enabled
    ? hasGeneratedInBetweens
      ? INTERPOLATION_ENABLED_STATUS
      : 'Interpolation on — set In-betweens above 0 and save at least two real Roto keys.'
    : INTERPOLATION_DISABLED_STATUS;
  function handlePrimaryAction() {
    if (props.mode === 'play') {
      renderPlayFrames();
      return;
    }
    props.onSaveRotoFrame();
  }

  function renderPlayFrames() {
    if (props.playCacheStatus === 'cached') props.onPlayPreview(safeFrameCount);
    else props.onSavePlay();
  }

  function handleFrameCountInput(event: Event) {
    const value = Number((event.currentTarget as HTMLInputElement).value);
    const clampedFrameCount = Math.min(clampPhysicPaintFrameCount(value), maxFrameCount);
    if (Number.isFinite(value) && value > maxFrameCount && playLimitMessage) {
      props.onPlayLimit?.(playLimitMessage);
    }
    props.onFrameCountChange(clampedFrameCount);
  }

  function previewPlayFrame(frame: number) {
    const nextFrame = Math.max(0, Math.min(safeFrameCount - 1, Math.trunc(frame)));
    props.onPreviewPlayFrame?.(nextFrame);
    props.onInspectPlayFrame(nextFrame);
  }

  function handleRotoPlaybackFpsInput(event: Event) {
    const value = Number((event.currentTarget as HTMLInputElement).value);
    if (Number.isFinite(value)) props.onRotoPlaybackFpsChange?.(value);
  }

  function handleRotoInterpolationCountInput(event: Event) {
    const value = Number((event.currentTarget as HTMLInputElement).value);
    if (Number.isFinite(value)) props.onRotoInterpolationCountChange?.(Math.max(0, Math.min(PHYSIC_PAINT_MAX_APPLY_FRAMES, Math.trunc(value))));
  }

  function handleRotoInterpolationModeInput(event: Event) {
    const value = (event.currentTarget as HTMLSelectElement).value;
    if (value === 'duplicate' || value === 'blend') props.onRotoInterpolationModeChange?.(value);
  }

  function handleRotoCellClick(frame: number, vm: RotoCellViewModel) {
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
    if (sessionKeyAvailability?.busy) return sessionKeyAvailability.disabledReason ?? 'Finish saving frame {frame} before using key tools.'.replace('{frame}', String(props.rotoSavingFrame ?? props.currentFrame));
    if (keyUtilitiesDisabledByBusyState) return 'Finish saving frame {frame} before using key tools.'.replace('{frame}', String(props.rotoSavingFrame ?? props.currentFrame));
    if (currentRotoCell.baseMeaning === 'generated' || currentRotoCell.isEditableTarget === false) return 'Generated frame {frame} is render-only. Use timeline navigation or playback; edit a real Roto key to paint.'.replace('{frame}', String(currentRotoCell.frame));
    if (action === 'paste') return sessionKeyAvailability?.pasteDisabledReason ?? 'Copy a real Roto key before pasting.';
    if (action === 'insert') return 'Select a real Roto key to insert.';
    if (action === 'duplicate') return 'Select a real Roto key to duplicate.';
    if (action === 'copy') return 'Select a real Roto key to copy.';
    return 'Select a real Roto key to delete.';
  }

  function runRotoKeyUtilityAction(action: RotoKeyUtilityAction, enabled: boolean, callback: (() => void) | undefined) {
    if (enabled) {
      callback?.();
      return;
    }
    if (!props.statusMessage) {
      // Disabled native buttons do not emit clicks; keep this copy source near the buttons
      // so the existing status stack can mirror the same reason when Studio supplies it.
      getRotoKeyUtilityDisabledMessage(action);
    }
  }

  function endRotoKeyPress(action: RotoKeyUtilityAction) {
    setTimeout(() => setPressedRotoKeyAction((pressed) => pressed === action ? null : pressed), 120);
  }

  function getRotoKeyButtonPressProps(action: RotoKeyUtilityAction) {
    return {
      'data-pressed': pressedRotoKeyAction === action,
      onPointerDown: () => setPressedRotoKeyAction(action),
      onPointerUp: () => endRotoKeyPress(action),
      onPointerCancel: () => endRotoKeyPress(action),
      onPointerLeave: () => endRotoKeyPress(action),
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key === ' ' || event.key === 'Enter') setPressedRotoKeyAction(action);
      },
      onKeyUp: (event: KeyboardEvent) => {
        if (event.key === ' ' || event.key === 'Enter') endRotoKeyPress(action);
      },
    };
  }

  function getConfirmationCopy(kind: PhysicsPaintWorkflowConfirmation): string {
    if (kind === 'convert-play-to-roto') {
      return `Convert Play to Roto? This turns ${playRange.frameCount} rendered Play frames into roto frames and deletes the editable Play source for this range.`;
    }
    return `Convert Roto to Play? This replaces roto frames ${playRange.startFrame}–${playRange.endFrame} with one Play paint source and removes those roto images.`;
  }

  function getConfirmationTitle(kind: PhysicsPaintWorkflowConfirmation): string {
    if (kind === 'convert-play-to-roto') return CONVERT_PLAY_TO_ROTO_LABEL;
    return CONVERT_ROTO_TO_PLAY_LABEL;
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

  useEffect(() => {
    const el = timelineScrollRef.current;
    if (!el) return;
    updateScrollbar();
    const observer = new ResizeObserver(updateScrollbar);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [frameCells, props.mode, updateScrollbar]);

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

  function confirmDestructiveAction() {
    if (confirmation === 'convert-play-to-roto') {
      if (!props.missingPlayFramesForConversion) props.onConvertPlayToRoto?.();
    } else if (confirmation === 'convert-roto-to-play') {
      props.onConvertRotoToPlay?.();
    }
    setConfirmation(null);
  }

  return (
    <section class="physics-paint-workflow-strip" aria-label="Physics Paint workflow strip">
      <div class="physics-paint-workflow-header">
        <div class="physics-paint-mode-label" aria-label="Selected Physics Paint mode">
          {getPhysicsPaintSourceLabel(props.mode)}
        </div>

        <div class="physics-paint-workflow-animation">
          {props.mode === 'roto' ? (
            <div class="physics-paint-mode-controls">
              <button type="button" class="physics-paint-nav-button" aria-label="Go to first frame" onClick={props.onGoToFirstFrame}><ChevronFirst size={15} /></button>
              <button type="button" class="physics-paint-nav-button" aria-label="Go to previous frame" onClick={props.onGoToPreviousFrame}><ChevronsLeft size={15} /></button>
              <button type="button" class={`physics-paint-nav-button physics-paint-roto-transport ${props.isRotoCachedPlaybackActive ? 'active' : ''}`} aria-label={props.isRotoCachedPlaybackActive ? 'Stop cached Roto playback' : 'Play cached Roto frames'} disabled={props.ready === false || !props.rotoCachedPlaybackAvailable || !props.onToggleRotoPlayback} onClick={props.onToggleRotoPlayback}>{props.isRotoCachedPlaybackActive ? <Square size={15} /> : <Play size={15} />}</button>
              <output class="physics-paint-current-frame">{props.currentFrame}</output>
              <button type="button" class="physics-paint-nav-button" aria-label="Go to next frame" onClick={props.onGoToNextFrame}><ChevronsRight size={15} /></button>
              <button type="button" class="physics-paint-nav-button" aria-label="Go to last frame" onClick={props.onGoToLastFrame}><ChevronLast size={15} /></button>
              {props.onRotoInterpolationEnabledChange ? (
                <div class="physics-paint-roto-interpolation-controls" title={interpolationStatus}>
                  <label class="physics-paint-roto-interpolation-toggle">
                    <input type="checkbox" aria-label="Interpolation" checked={Boolean(interpolationSettings.enabled)} disabled={props.ready === false} onChange={(event) => props.onRotoInterpolationEnabledChange?.((event.currentTarget as HTMLInputElement).checked)} />
                    <span>Interpolation</span>
                  </label>
                  <label class="physics-paint-roto-interpolation-count">
                    <span>In-betweens</span>
                    <input type="number" min="0" max={PHYSIC_PAINT_MAX_APPLY_FRAMES} step="1" value={visibleInBetweenCount} aria-label="Interpolation frames per real-key pair" disabled={props.ready === false || !interpolationSettings.enabled} onInput={handleRotoInterpolationCountInput} />
                  </label>
                  <label class="physics-paint-roto-interpolation-mode">
                    <span>Interpolation mode</span>
                    <select class="physics-paint-roto-interpolation-select" aria-label="Interpolation mode" value={interpolationSettings.mode === 'duplicate' || interpolationSettings.mode === 'hold' ? 'duplicate' : 'blend'} disabled={props.ready === false || !interpolationSettings.enabled || !props.onRotoInterpolationModeChange} onInput={handleRotoInterpolationModeInput}>
                      <option value="duplicate">Duplicate / hold</option>
                      <option value="blend">Alpha blend</option>
                    </select>
                  </label>
                  <span class="physics-paint-roto-interpolation-copy">Per adjacent real-key pair</span>
                </div>
              ) : null}
              <button type="button" class={`physics-paint-nav-button physics-paint-roto-loop-toggle ${props.rotoCachedPlaybackLoop ? 'active' : ''}`} aria-label="Loop cached Roto playback" aria-pressed={Boolean(props.rotoCachedPlaybackLoop)} disabled={props.ready === false || !props.onRotoPlaybackLoopChange} onClick={() => props.onRotoPlaybackLoopChange?.(!props.rotoCachedPlaybackLoop)}><RotateCcw size={15} /></button>
              <label class="physics-paint-roto-fps-control">
                <span>fps</span>
                <input type="number" min="1" max="60" step="0.5" value={props.rotoCachedPlaybackFps ?? props.projectFps ?? 1} aria-label="Cached Roto playback frames per second" disabled={props.ready === false} onInput={handleRotoPlaybackFpsInput} />
              </label>
            </div>
          ) : (
            <div class="physics-paint-mode-controls physics-paint-play-controls">
              <label class="physics-paint-play-frame-count" for="physics-play-duration">
                <span>Duration</span>
                <input
                  id="physics-play-duration"
                  type="number"
                  min={PHYSIC_PAINT_MIN_APPLY_FRAMES}
                  max={PHYSIC_PAINT_MAX_APPLY_FRAMES}
                  value={safeFrameCount}
                  aria-label="Play frame count"
                  onInput={handleFrameCountInput}
                />
                <output>{safeFrameCount}</output>
              </label>
              <button type="button" class="physics-paint-nav-button" aria-label="Go to first frame" onClick={() => previewPlayFrame(0)}><ChevronFirst size={15} /></button>
              <button type="button" class="physics-paint-nav-button" aria-label="Go to previous frame" onClick={() => previewPlayFrame(Math.max(0, clampedPreviewFrame - 1))}><ChevronsLeft size={15} /></button>
              <button type="button" class="physics-paint-nav-button" aria-label="Go to next frame" onClick={() => previewPlayFrame(Math.min(safeFrameCount - 1, clampedPreviewFrame + 1))}><ChevronsRight size={15} /></button>
              <button type="button" class="physics-paint-nav-button" aria-label="Go to last frame" onClick={() => previewPlayFrame(safeFrameCount - 1)}><ChevronLast size={15} /></button>
              <button type="button" class="physics-paint-primary-action" title={RENDER_ACTION_HELP} aria-label="Render play" disabled={props.ready === false || props.isPlaying} onClick={renderPlayFrames}>{RENDER_ACTION_LABEL}</button>
              <button type="button" class="physics-paint-render-action" aria-label="Update Play options" disabled={props.ready === false || props.isPlaying || !props.onUpdatePlayOptions} onClick={props.onUpdatePlayOptions}>Update</button>
              <button type="button" class="physics-paint-nav-button" aria-label="Stop preview" disabled={!props.isPlaying} onClick={props.onStopPreview}><Square size={15} /></button>
            </div>
          )}
          {props.mode === 'roto' ? (
            <button class="physics-paint-render-action" title="Save the current Roto frame" aria-label="Save current" disabled={props.ready === false || !hasPendingRotoFrames || props.rotoSaveInFlight} onClick={handlePrimaryAction}>
              Save current
            </button>
          ) : null}
        </div>

        <div class="physics-paint-state-actions" aria-hidden="true" />
      </div>

      <div class="physics-paint-timeline" aria-label="Physics Paint timeline">
        <div ref={timelineScrollRef} class="physics-paint-timeline-scroll" onScroll={updateScrollbar}>
          <div class="physics-paint-ruler" style={{ width: `${rulerWidth}px`, minWidth: `${rulerWidth}px` }} aria-hidden="true">
            {rulerTicks.map(frame => (
              <span key={frame} class="physics-paint-ruler-tick">{frame}</span>
            ))}
          </div>

          {props.mode === 'roto' ? (
            <div class="physics-paint-lane">
              <div class="physics-paint-roto-cells" role="row">
                {frameCells.map(frame => {
                  const syntheticGeneratedFrame = generatedRotoFrames.includes(frame)
                    ? [{ frameIndex: 0, appFrame: frame, dataUrl: 'data:image/png;base64,', source: 'generated-interpolation' as const }]
                    : [];
                  const cachedFramesForDisplay = syntheticGeneratedFrame.length > 0 && !props.cachedRotoFrames?.some(candidate => candidate.appFrame === frame) ? syntheticGeneratedFrame : props.cachedRotoFrames;
                  const vm = getRotoCellViewModel({
                    frame,
                    currentFrame: expandedCurrentFrame,
                    cachedFrames: cachedFramesForDisplay,
                    editableFrames: props.editableRotoFrames,
                    pendingFrames: props.pendingRotoFrames,
                    isSaving: Boolean(props.rotoSaveInFlight),
                  });
                  const fill = getRotoCellFill(frame, realCachedRotoFrames, props.editableRotoFrames);
                  const isDisplayRealKey = realCachedRotoFrameNumbers.includes(frame);
                  const generatedTitle = vm.baseMeaning === 'generated' || vm.isEditableTarget === false ? getGeneratedRotoTitle(frame) : null;
                  return (
                    <button
                      key={frame}
                      class={`physics-paint-roto-cell ${getRotoFillClass(fill)} ${vm.fillClass} ${isDisplayRealKey || isOccupiedFrame(props.occupiedRotoFrames, frame) ? 'occupied' : ''} ${isDisplayRealKey || isSavedFrame(props.savedRotoFrames, frame) ? 'saved' : ''} ${vm.overlays.includes('dirty') ? 'dirty' : ''} ${vm.overlays.includes('pending') ? 'pending' : ''} ${vm.overlays.includes('current') ? 'current' : ''}`}
                      aria-label={generatedTitle ?? vm.ariaLabel}
                      title={generatedTitle ?? vm.title}
                      onClick={() => handleRotoCellClick(frame, vm)}
                    >
                      <span>{frame}</span>
                    </button>
                  );
                })}
                {interpolationConnectors.map(connector => (
                  <span
                    key={`${connector.fromFrame}-${connector.toFrame}-${connector.ordinal}`}
                    class={`physics-paint-roto-interpolation-connector connector-count-${connector.total}`}
                    data-from-frame={connector.fromFrame}
                    data-to-frame={connector.toFrame}
                    data-generated-frame={connector.frame}
                    aria-hidden="true"
                  />
                ))}

              </div>
              <div class="physics-paint-roto-key-utilities" role="group" aria-label={`Roto key utilities for frame ${props.currentFrame}`}>
                <span class="physics-paint-roto-key-context" aria-hidden="true">Key {props.currentFrame}</span>
                <button type="button" class="physics-paint-roto-key-button" aria-label={`Insert blank Roto key before frame ${props.currentFrame}`} disabled={!canInsertRotoKey} {...getRotoKeyButtonPressProps('insert')} onClick={() => runRotoKeyUtilityAction('insert', canInsertRotoKey, props.onInsertRotoFrame)}>Insert</button>
                <button type="button" class="physics-paint-roto-key-button" aria-label={`Duplicate Roto key at frame ${props.currentFrame}`} disabled={!canDuplicateRotoKey} {...getRotoKeyButtonPressProps('duplicate')} onClick={() => runRotoKeyUtilityAction('duplicate', canDuplicateRotoKey, props.onDuplicateRotoKey)}>Dup</button>
                <button type="button" class="physics-paint-roto-key-button" aria-label={`Copy Roto key at frame ${props.currentFrame}`} disabled={!canCopyRotoKey} {...getRotoKeyButtonPressProps('copy')} onClick={() => runRotoKeyUtilityAction('copy', canCopyRotoKey, props.onCopyRotoFrame)}>Copy</button>
                <button type="button" class="physics-paint-roto-key-button" aria-label={`Paste Roto key to frame ${props.currentFrame}`} disabled={!canPasteRotoKey} {...getRotoKeyButtonPressProps('paste')} onClick={() => runRotoKeyUtilityAction('paste', canPasteRotoKey, props.onPasteRotoFrame)}>Paste</button>
                <button type="button" class="physics-paint-roto-key-button destructive" aria-label={`Delete Roto key at frame ${props.currentFrame}`} disabled={!canDeleteRotoKey} {...getRotoKeyButtonPressProps('delete')} onClick={() => runRotoKeyUtilityAction('delete', canDeleteRotoKey, props.onDeleteRotoFrame)}>Delete</button>
              </div>
            </div>
          ) : (
            <div class="physics-paint-lane physics-paint-play-lane" style={{ width: `${rulerWidth}px`, minWidth: `${rulerWidth}px` }}>
              <div class="physics-paint-roto-cells physics-paint-play-cells" role="row" style={{ gridTemplateColumns: `repeat(${playFrameCells.length}, 13px)` }}>
                {playFrameCells.map((frame, index) => (
                  <button
                    key={frame}
                    class={`physics-paint-roto-cell physics-paint-play-cell ${props.playCacheStatus === 'cached' ? 'cached' : ''} ${props.playCacheStatus === 'stale' ? 'stale' : ''} ${index === clampedPreviewFrame ? 'current' : ''}`}
                    aria-label={`Play frame ${frame}`}
                    onClick={() => previewPlayFrame(index)}
                  >
                    <span>{frame}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
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

      {props.mode === 'roto' ? (
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
          {props.onRotoInterpolationEnabledChange ? <p class="physics-paint-roto-interpolation-status">{interpolationStatus}</p> : null}
          <p class="physics-paint-roto-interpolation-status">Dirty frames save when leaving.</p>
          {currentRotoCell.baseMeaning === 'generated' || currentRotoCell.isEditableTarget === false ? <p class="physics-paint-roto-key-status">{getGeneratedRotoDisabledStatus(currentRotoCell.frame)}</p> : null}
          {keyUtilitiesDisabledByBusyState ? <p class="physics-paint-roto-key-status">{getRotoKeyBusyStatus(props.rotoSavingFrame ?? props.currentFrame)}</p> : null}
          {rotoPendingLabel ? <p class="physics-paint-roto-key-status">{rotoPendingLabel}</p> : null}
          {currentRotoFill === 'cached-only' ? (
            <>
              <p class="physics-paint-roto-key-status">Cached reference</p>
              <p class="physics-paint-roto-interpolation-status">Cached reference: repaintable, not stroke-editable.</p>
            </>
          ) : null}
          {props.playPublicationSummary ? <p class="physics-paint-roto-interpolation-status">{props.playPublicationSummary}</p> : null}
          {props.statusMessage ? <p class="physics-paint-roto-interpolation-status">{props.statusMessage}</p> : null}
          {props.rotoCachedPlaybackStatus ? <p class="physics-paint-roto-playback-status">{props.rotoCachedPlaybackStatus}</p> : null}
        </div>
      ) : null}

      {confirmation ? (
        <div class="physics-paint-confirmation" role="dialog" aria-modal="true" aria-labelledby="physics-paint-confirmation-title">
          <div class="physics-paint-confirmation-card">
            <h2 id="physics-paint-confirmation-title">{getConfirmationTitle(confirmation)}</h2>
            {confirmation === 'convert-play-to-roto' && props.missingPlayFramesForConversion ? (
              <p class="physics-paint-confirmation-warning">Missing rendered frames for Play→Roto. {PLAY_TO_ROTO_MISSING_FRAMES_MESSAGE}</p>
            ) : (
              <p>{getConfirmationCopy(confirmation)}</p>
            )}
            <div class="physics-paint-confirmation-actions">
              <button class="physics-paint-text-button" onClick={() => setConfirmation(null)}>Cancel</button>
              <button class="physics-paint-text-button destructive" disabled={confirmation === 'convert-play-to-roto' && props.missingPlayFramesForConversion} onClick={confirmDestructiveAction}>Continue</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
