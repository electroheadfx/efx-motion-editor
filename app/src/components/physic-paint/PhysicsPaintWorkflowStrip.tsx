import { ChevronFirst, ChevronLast, ChevronsLeft, ChevronsRight, Play, Square } from 'lucide-preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  PHYSIC_PAINT_DEFAULT_APPLY_FRAMES,
  PHYSIC_PAINT_MAX_APPLY_FRAMES,
  PHYSIC_PAINT_MIN_APPLY_FRAMES,
  PLAY_TO_ROTO_MISSING_FRAMES_MESSAGE,
  clampOnionCount,
  getActivePrimaryActionLabel,
  getPlayRangeMarker,
  type PhysicsPaintOnionState,
  type PhysicsPaintWorkflowMode,
} from './physicsPaintWorkflowState';
import { clampPhysicPaintFrameCount } from '../../types/physicPaint';

const SAVE_ROTO_FRAME_LABEL = 'Save roto frame';
const SAVE_PLAY_LABEL = 'Save play';
const CONVERT_PLAY_TO_ROTO_LABEL = 'Convert Play to Roto?';
const CONVERT_ROTO_TO_PLAY_LABEL = 'Convert Roto to Play?';
const MISSING_PLAY_TO_ROTO_COPY = 'Save or regenerate Play output before converting it to roto frames.';

export interface PhysicsPaintWorkflowStripFrameMarker {
  frame: number;
  saved?: boolean;
  label?: string;
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
  playPublicationSummary?: string | null;
  statusMessage?: string | null;
  sameModeReplacementMessage?: string | null;
  onion: PhysicsPaintOnionState;
  onionPreviewFrames?: PhysicsPaintWorkflowOnionPreviewFrame[];
  showOnionHiddenDuringPreview?: boolean;
  missingPlayFramesForConversion?: boolean;
  onModeChange: (mode: PhysicsPaintWorkflowMode) => void;
  onSaveRotoFrame: () => void;
  onSavePlay: () => void;
  onSaveState: () => void;
  onLoadState: (event: Event) => void;
  onPlayPreview: (frameCount: number) => void;
  onStopPreview: () => void;
  onFrameCountChange: (frameCount: number) => void;
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
const PLAY_TIMELINE_TICK_WIDTH = 45;
const PLAY_TIMELINE_ORIGIN_OFFSET = 4;

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

function buildPlayRuler(frameCount: number): { ticks: number[]; endFrame: number; step: number; frameWidth: number; width: number } {
  const safeFrameCount = clampPhysicPaintFrameCount(frameCount || PHYSIC_PAINT_DEFAULT_APPLY_FRAMES);
  const step = getPlayRulerStep(safeFrameCount);
  const endFrame = safeFrameCount <= 6 ? safeFrameCount : Math.ceil((safeFrameCount + step) / step) * step;
  return {
    ticks: Array.from({ length: Math.floor(endFrame / step) + 1 }, (_, index) => index * step),
    endFrame,
    step,
    frameWidth: PLAY_TIMELINE_TICK_WIDTH / step,
    width: Math.max(180, (Math.floor(endFrame / step) + 1) * PLAY_TIMELINE_TICK_WIDTH),
  };
}

function isOccupiedFrame(frames: number[] | undefined, frame: number): boolean {
  return Boolean(frames?.includes(frame));
}

function isSavedFrame(markers: PhysicsPaintWorkflowStripFrameMarker[] | undefined, frame: number): boolean {
  return Boolean(markers?.some(marker => marker.frame === frame && marker.saved !== false));
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
  const rotoRulerTicks = useMemo(() => buildRulerTicks(frameCells), [frameCells]);
  const safeFrameCount = clampPhysicPaintFrameCount(props.frameCount || PHYSIC_PAINT_DEFAULT_APPLY_FRAMES);
  const playRuler = useMemo(() => buildPlayRuler(safeFrameCount), [safeFrameCount]);
  const rulerTicks = props.mode === 'play' ? playRuler.ticks : rotoRulerTicks;
  const rulerWidth = props.mode === 'play' ? playRuler.width : 1800;
  const playStartOffset = PLAY_TIMELINE_ORIGIN_OFFSET;
  const playEndOffset = playStartOffset + safeFrameCount * playRuler.frameWidth;
  const primaryActionLabel = getActivePrimaryActionLabel(props.mode) === SAVE_PLAY_LABEL ? SAVE_PLAY_LABEL : SAVE_ROTO_FRAME_LABEL;
  const onionCount = clampOnionCount(props.onion.count);
  const visibleOnionPreviewFrames = props.isPlaying || !props.onion.enabled
    ? []
    : (props.onionPreviewFrames ?? []).filter(frame => (
        frame.distance <= onionCount &&
        ((frame.direction === 'previous' && props.onion.previous) || (frame.direction === 'next' && props.onion.next))
      ));

  function handlePrimaryAction() {
    if (props.mode === 'play') {
      props.onSavePlay();
      return;
    }
    props.onSaveRotoFrame();
  }

  function handleFrameCountInput(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    props.onFrameCountChange(clampPhysicPaintFrameCount(Number(input.value)));
  }

  function handlePlayRangeClick(event: MouseEvent) {
    if (props.mode !== 'play') return;
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const ratio = rect.width > 0 ? Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) : 0;
    const frame = playRange.startFrame + Math.round(ratio * Math.max(0, playRange.frameCount - 1));
    props.onInspectPlayFrame(frame);
  }

  function getConfirmationCopy(kind: PhysicsPaintWorkflowConfirmation): string {
    if (kind === 'convert-play-to-roto') {
      return `Convert Play to Roto? This turns ${playRange.frameCount} rendered Play frames into roto frames and deletes the editable Play source for this range.`;
    }
    return `Convert Roto to Play? This replaces roto frames ${playRange.startFrame}–${playRange.endFrame} with one Play canvas source and removes those roto images.`;
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
        <div class="physics-paint-workflow-tabs" role="tablist" aria-label="Physics Paint source mode">
          <button
            class={`physics-paint-workflow-segment ${props.mode === 'roto' ? 'active' : ''}`}
            role="tab"
            aria-selected={props.mode === 'roto'}
            onClick={() => props.onModeChange('roto')}
          >
            Roto canvas
          </button>
          <button
            class={`physics-paint-workflow-segment ${props.mode === 'play' ? 'active' : ''}`}
            role="tab"
            aria-selected={props.mode === 'play'}
            onClick={() => props.onModeChange('play')}
          >
            Play canvas
          </button>
        </div>

        <div class="physics-paint-workflow-animation">
          {props.mode === 'roto' ? (
            <div class="physics-paint-mode-controls">
              <button type="button" class="physics-paint-nav-button" aria-label="Go to first frame" onClick={props.onGoToFirstFrame}><ChevronFirst size={15} /></button>
              <button type="button" class="physics-paint-nav-button" aria-label="Go to previous frame" onClick={props.onGoToPreviousFrame}><ChevronsLeft size={15} /></button>
              <output class="physics-paint-current-frame">{props.currentFrame}</output>
              <button type="button" class="physics-paint-nav-button" aria-label="Go to next frame" onClick={props.onGoToNextFrame}><ChevronsRight size={15} /></button>
              <button type="button" class="physics-paint-nav-button" aria-label="Go to last frame" onClick={props.onGoToLastFrame}><ChevronLast size={15} /></button>
            </div>
          ) : (
            <div class="physics-paint-mode-controls physics-paint-play-controls">
              <label class="physics-paint-play-frame-count">
                <span>Duray</span>
                <input
                  type="number"
                  min={PHYSIC_PAINT_MIN_APPLY_FRAMES}
                  max={PHYSIC_PAINT_MAX_APPLY_FRAMES}
                  value={safeFrameCount}
                  onInput={handleFrameCountInput}
                  aria-label="Play canvas frame count"
                />
              </label>
              <button type="button" class="physics-paint-nav-button" aria-label="Go to first frame" onClick={props.onGoToFirstFrame}><ChevronFirst size={15} /></button>
              <button type="button" class="physics-paint-nav-button" aria-label="Go to previous frame" onClick={props.onGoToPreviousFrame}><ChevronsLeft size={15} /></button>
              <button type="button" class="physics-paint-nav-button" aria-label="Play preview" disabled={props.ready === false} onClick={() => props.onPlayPreview(safeFrameCount)}><Play size={15} /></button>
              <button type="button" class="physics-paint-nav-button" aria-label="Stop preview" disabled={!props.isPlaying} onClick={props.onStopPreview}><Square size={15} /></button>
              <button class="physics-paint-primary-action" disabled={props.ready === false} onClick={handlePrimaryAction}>Save play</button>
            </div>
          )}
          {props.mode === 'roto' ? (
            <button class="physics-paint-primary-action" disabled={props.ready === false} onClick={handlePrimaryAction}>
              {primaryActionLabel}
            </button>
          ) : null}
        </div>

        <div class="physics-paint-state-actions">
          <button class="physics-paint-text-button" onClick={props.onSaveState}>Save state</button>
          <label class="physics-paint-text-button physics-paint-load-state">
            Load state
            <input type="file" accept=".json" onChange={props.onLoadState} />
          </label>
        </div>
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
                {frameCells.map(frame => (
                  <button
                    key={frame}
                    class={`physics-paint-roto-cell ${isOccupiedFrame(props.occupiedRotoFrames, frame) ? 'occupied' : ''} ${isSavedFrame(props.savedRotoFrames, frame) ? 'saved' : ''} ${frame === props.currentFrame ? 'current' : ''}`}
                    aria-label={`Roto frame ${frame}`}
                    onClick={() => props.onNavigateToSyncedFrame(frame)}
                  >
                    <span>{frame}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div class="physics-paint-lane physics-paint-play-lane" style={{ width: `${rulerWidth}px`, minWidth: `${rulerWidth}px` }}>
              <div class="physics-paint-play-track" style={{ width: `${rulerWidth}px` }}>
                <button
                  class="physics-paint-play-range"
                  style={{ width: `${playEndOffset}px` }}
                  onClick={handlePlayRangeClick}
                  aria-label={`Inspect Play canvas frames ${playRange.startFrame} through ${playRange.endFrame}`}
                >
                  <span class="physics-paint-play-range-fill" style={{ left: `${playStartOffset}px`, width: `${playEndOffset - playStartOffset}px` }} />
                  <span class="physics-paint-play-range-point start" style={{ left: `${playStartOffset}px` }} />
                  <span class="physics-paint-play-range-point end" style={{ left: `${playEndOffset}px` }} />
                </button>
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
              <p class="physics-paint-confirmation-warning">Missing rendered frames for Play→Roto. {PLAY_TO_ROTO_MISSING_FRAMES_MESSAGE === MISSING_PLAY_TO_ROTO_COPY ? MISSING_PLAY_TO_ROTO_COPY : PLAY_TO_ROTO_MISSING_FRAMES_MESSAGE}</p>
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
