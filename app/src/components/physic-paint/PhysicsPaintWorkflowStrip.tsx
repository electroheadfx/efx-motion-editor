import { ChevronFirst, ChevronLast, ChevronsLeft, ChevronsRight, Play as PlayIcon, Square } from 'lucide-preact';

// Source contract: a one-frame Play gap opened at frame 11 yields buildPlayFrameCells(11, 1) === [11].
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  PHYSIC_PAINT_DEFAULT_APPLY_FRAMES,
  PHYSIC_PAINT_MAX_APPLY_FRAMES,
  PHYSIC_PAINT_MIN_APPLY_FRAMES,
  PLAY_TO_ROTO_MISSING_FRAMES_MESSAGE,
  clampOnionCount,
  getPhysicsPaintSourceLabel,
  getPlayRangeMarker,
  getRotoCellFill,
  getRotoInterpolationSpanFrames,
  getRotoPendingLabel,
  type PhysicsPaintOnionState,
  type PhysicsPaintWorkflowMode,
  type RotoInterpolationSettings,
} from './physicsPaintWorkflowState';
import { clampPhysicPaintFrameCount, type PhysicPaintRotoCacheFrame } from '../../types/physicPaint';

const RENDER_ACTION_LABEL = 'Render play';
const RENDER_ACTION_HELP = 'Preview cached Play frames, or render and save the Play cache when it is stale.';
const CONVERT_PLAY_TO_ROTO_LABEL = 'Convert Play to Roto?';
const CONVERT_ROTO_TO_PLAY_LABEL = 'Convert Roto to Play?';

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
  rotoInterpolationSettings?: RotoInterpolationSettings;
  playPublicationSummary?: string | null;
  statusMessage?: string | null;
  sameModeReplacementMessage?: string | null;
  onion: PhysicsPaintOnionState;
  onionPreviewFrames?: PhysicsPaintWorkflowOnionPreviewFrame[];
  showOnionHiddenDuringPreview?: boolean;
  missingPlayFramesForConversion?: boolean;
  rotoCachedPlaybackAvailable?: boolean;
  rotoCachedPlaybackStatus?: string | null;
  onToggleRotoPlayback?: () => void;
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

function getRotoInterpolationStatusCopy(realKeyCount: number, enabled: boolean, generatedCount: number): string {
  if (realKeyCount < 2) return 'Interpolation needs two real Roto keys.';
  if (!enabled) return 'Enable interpolation to generate render-only in-betweens between real keys.';
  if (generatedCount > 0) return 'Generated in-betweens are render-only; connector lines mark interpolation spans.';
  return 'Generated in-betweens stay render-only, not editable targets.';
}

export function PhysicsPaintWorkflowStrip(props: PhysicsPaintWorkflowStripProps) {
  const [confirmation, setConfirmation] = useState<PhysicsPaintWorkflowConfirmation | null>(null);
  const [scrollbar, setScrollbar] = useState({ left: 0, width: 0, visible: false });
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const playRange = useMemo(
    () => getPlayRangeMarker(props.startFrame, props.frameCount, props.currentFrame),
    [props.currentFrame, props.frameCount, props.startFrame]
  );
  const frameCells = useMemo(() => buildFrameCells(props.currentFrame), [props.currentFrame]);
  const realRotoFrames = useMemo(() => getRealRotoFrames(props.occupiedRotoFrames, props.savedRotoFrames, props.cachedRotoFrames), [props.cachedRotoFrames, props.occupiedRotoFrames, props.savedRotoFrames]);
  const interpolationConnectors = useMemo(() => getRotoInterpolationSpanFrames(realRotoFrames, props.rotoInterpolationSettings ?? { enabled: false, inBetweenCount: 0, mode: 'duplicate' }), [props.rotoInterpolationSettings, realRotoFrames]);
  const rotoRulerTicks = useMemo(() => buildRulerTicks(frameCells), [frameCells]);
  const getMaxFrameCount = useCallback(() => (
    props.maxPlayFrameCount !== undefined
      ? Math.min(PHYSIC_PAINT_MAX_APPLY_FRAMES, props.maxPlayFrameCount)
      : PHYSIC_PAINT_MAX_APPLY_FRAMES
  ), [props.maxPlayFrameCount]);
  const maxFrameCount = getMaxFrameCount();
  const safeFrameCount = Math.min(clampPhysicPaintFrameCount(props.frameCount || PHYSIC_PAINT_DEFAULT_APPLY_FRAMES), maxFrameCount);
  const playFrameCells = useMemo(() => buildPlayFrameCells(props.startFrame, safeFrameCount), [props.startFrame, safeFrameCount]);
  const realCachedRotoFrames = useMemo(() => (props.cachedRotoFrames ?? []).filter(frame => frame.source === 'real-key'), [props.cachedRotoFrames]);
  const pendingRotoFrameSet = useMemo(() => new Set(props.pendingRotoFrames ?? []), [props.pendingRotoFrames]);
  const hasPendingRotoFrames = pendingRotoFrameSet.size > 0;
  const currentRotoFill = getRotoCellFill(props.currentFrame, realCachedRotoFrames, props.editableRotoFrames);
  const rotoPendingLabel = getRotoPendingLabel(hasPendingRotoFrames, Boolean(props.rotoSaveInFlight));
  const interpolationSettings = props.rotoInterpolationSettings ?? { enabled: false, inBetweenCount: 0, mode: 'duplicate' as const, deform: 0, position: 0 };
  const interpolationEnabled = interpolationSettings.enabled === true;
  const interpolationCount = Math.max(0, Math.trunc(Number(interpolationSettings.inBetweenCount ?? 0) || 0));
  const interpolationMode = interpolationSettings.mode === 'blend' ? 'blend' : 'duplicate';
  const interpolationDeform = Math.max(0, Math.trunc(Number(interpolationSettings.deform ?? 0) || 0));
  const interpolationPosition = Math.max(0, Math.trunc(Number(interpolationSettings.position ?? 0) || 0));
  const generatedRotoFrameCount = (props.cachedRotoFrames ?? []).filter(frame => frame.source === 'generated-interpolation').length;
  const interpolationStatusCopy = getRotoInterpolationStatusCopy(realRotoFrames.length, interpolationEnabled, generatedRotoFrameCount);
  const currentRotoUtilityTargetIsRealKey = realRotoFrames.includes(props.currentFrame);
  const playRulerStep = getPlayRulerStep(safeFrameCount);
  const playRulerTicks = playFrameCells.filter((_, index) => index % playRulerStep === 0 || index === playFrameCells.length - 1);
  const rulerTicks = props.mode === 'play' ? playRulerTicks : rotoRulerTicks;
  const rulerWidth = props.mode === 'play' ? Math.max(180, safeFrameCount * PLAY_TIMELINE_CELL_WIDTH) : 1800;
  const clampedPreviewFrame = Math.max(0, Math.min(safeFrameCount - 1, Math.trunc(props.currentPreviewFrame ?? 0)));
  const playLimitMessage = props.maxPlayFrameCount !== undefined
    ? props.maxPlayFrameCountReason ?? `Play duration limited to ${props.maxPlayFrameCount} frames before the next saved Play script.`
    : null;
  const onionCount = clampOnionCount(props.onion.count);
  const visibleOnionPreviewFrames = props.isPlaying || !props.onion.enabled
    ? []
    : (props.onionPreviewFrames ?? []).filter(frame => (
        frame.distance <= onionCount &&
        ((frame.direction === 'previous' && props.onion.previous) || (frame.direction === 'next' && props.onion.next))
      ));

  function handlePrimaryAction() {
    if (props.mode === 'play') {
      renderPlayFrames();
      return;
    }
    props.onSavePendingRotoFrames();
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
              <output class="physics-paint-current-frame">{props.currentFrame}</output>
              <button type="button" class="physics-paint-nav-button" aria-label="Go to next frame" onClick={props.onGoToNextFrame}><ChevronsRight size={15} /></button>
              <button type="button" class="physics-paint-nav-button" aria-label="Go to last frame" onClick={props.onGoToLastFrame}><ChevronLast size={15} /></button>
              <button
                type="button"
                class={`physics-paint-roto-transport ${props.isRotoCachedPlaybackActive ? 'active' : ''}`}
                aria-label={props.isRotoCachedPlaybackActive ? 'Stop cached Roto playback' : 'Play cached Roto frames'}
                title="Play cached Roto frames only. Missing frames play transparent/background."
                disabled={props.ready === false || !props.rotoCachedPlaybackAvailable || !props.onToggleRotoPlayback}
                onClick={props.onToggleRotoPlayback}
              >
                {props.isRotoCachedPlaybackActive ? <Square size={13} /> : <PlayIcon size={13} />}
                <span>{props.isRotoCachedPlaybackActive ? 'Stop' : 'Play'}</span>
              </button>
              <span class="physics-paint-roto-playback-status" role="status">
                {props.rotoCachedPlaybackStatus ?? 'Missing frames play transparent/background'}
              </span>
              <div class="physics-paint-roto-key-utilities" aria-label="Roto key utility controls">
                <button type="button" class="physics-paint-roto-key-button" disabled={props.ready === false || !currentRotoUtilityTargetIsRealKey} onClick={props.onDuplicateRotoKey}>Duplicate key</button>
                <button type="button" class="physics-paint-roto-key-button" disabled={props.ready === false || !currentRotoUtilityTargetIsRealKey} onClick={props.onInsertRotoFrame}>Insert frame</button>
                <button type="button" class="physics-paint-roto-key-button destructive" disabled={props.ready === false || !currentRotoUtilityTargetIsRealKey} onClick={props.onDeleteRotoFrame}>Delete frame</button>
                <button type="button" class="physics-paint-roto-key-button" disabled={props.ready === false || !currentRotoUtilityTargetIsRealKey} onClick={props.onCopyRotoFrame}>Copy frame</button>
                <button type="button" class="physics-paint-roto-key-button" disabled={props.ready === false || !currentRotoUtilityTargetIsRealKey || !props.hasCopiedRotoKey} onClick={props.onPasteRotoFrame}>Paste frame</button>
              </div>
              <div class="physics-paint-roto-interpolation-controls" aria-label="Roto interpolation controls">
                <label class="physics-paint-roto-interpolation-toggle">
                  <input
                    type="checkbox"
                    checked={interpolationEnabled}
                    disabled={props.ready === false}
                    onChange={(event) => props.onRotoInterpolationEnabledChange?.((event.currentTarget as HTMLInputElement).checked)}
                  />
                  <span>Interpolation</span>
                </label>
                <label class="physics-paint-roto-interpolation-count" for="physics-roto-interpolation-count">
                  <span>In-betweens</span>
                  <input
                    id="physics-roto-interpolation-count"
                    type="number"
                    min={0}
                    value={interpolationCount}
                    disabled={props.ready === false || !interpolationEnabled}
                    onInput={(event) => props.onRotoInterpolationCountChange?.(Math.max(0, Math.trunc(Number((event.currentTarget as HTMLInputElement).value) || 0)))}
                  />
                </label>
                <select
                  class="physics-paint-roto-interpolation-select"
                  aria-label="Roto interpolation mode"
                  value={interpolationMode}
                  disabled={props.ready === false || !interpolationEnabled}
                  onChange={(event) => props.onRotoInterpolationModeChange?.((event.currentTarget as HTMLSelectElement).value === 'blend' ? 'blend' : 'duplicate')}
                >
                  <option value="duplicate">Duplicate</option>
                  <option value="blend">Blend</option>
                </select>
                <button
                  type="button"
                  class={`physics-paint-roto-motion-toggle ${interpolationDeform > 0 ? 'active' : ''}`}
                  aria-pressed={interpolationDeform > 0}
                  disabled={props.ready === false || !interpolationEnabled}
                  onClick={() => props.onRotoInterpolationMotionChange?.({ deform: interpolationDeform > 0 ? 0 : 50, position: interpolationPosition })}
                >
                  Deform
                </button>
                <button
                  type="button"
                  class={`physics-paint-roto-motion-toggle ${interpolationPosition > 0 ? 'active' : ''}`}
                  aria-pressed={interpolationPosition > 0}
                  disabled={props.ready === false || !interpolationEnabled}
                  onClick={() => props.onRotoInterpolationMotionChange?.({ deform: interpolationDeform, position: interpolationPosition > 0 ? 0 : 50 })}
                >
                  Position
                </button>
              </div>
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
            <button class="physics-paint-render-action" title="Flush unsaved Roto frame changes" aria-label={hasPendingRotoFrames ? 'Save pending' : 'Save current'} disabled={props.ready === false || !hasPendingRotoFrames || props.rotoSaveInFlight} onClick={handlePrimaryAction}>
              {hasPendingRotoFrames ? 'Save pending' : 'Save current'}
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
                  const fill = getRotoCellFill(frame, realCachedRotoFrames, props.editableRotoFrames);
                  return (
                    <button
                      key={frame}
                      class={`physics-paint-roto-cell ${getRotoFillClass(fill)} ${isOccupiedFrame(props.occupiedRotoFrames, frame) ? 'occupied' : ''} ${isSavedFrame(props.savedRotoFrames, frame) ? 'saved' : ''} ${pendingRotoFrameSet.has(frame) ? 'pending' : ''} ${frame === props.currentFrame ? 'current' : ''}`}
                      aria-label={`Roto frame ${frame}`}
                      onClick={() => props.onNavigateToSyncedFrame(frame)}
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
        <p class="physics-paint-roto-interpolation-status">
          {rotoPendingLabel ?? (currentRotoFill === 'cached-only' ? 'Cached reference: repaintable, not stroke-editable. ' : '')}{interpolationStatusCopy}
        </p>
      ) : null}

      {visibleOnionPreviewFrames.length > 0 ? (
        <div class="physics-paint-onion-overlay" aria-hidden="true">
          {visibleOnionPreviewFrames.map(frame => (
            <img
              key={`${frame.direction}-${frame.source}-${frame.frame}-${frame.distance}`}
              class={`physics-paint-onion-frame ${frame.direction === 'previous' ? 'physics-paint-onion-prev' : 'physics-paint-onion-next'}`}
              src={frame.dataUrl}
              style={{ opacity: Math.max(0.18, 0.62 - frame.distance * 0.14) }}
              alt=""
            />
          ))}
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
