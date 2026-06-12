import { useMemo, useState } from 'preact/hooks';
import {
  PHYSIC_PAINT_DEFAULT_APPLY_FRAMES,
  PHYSIC_PAINT_MAX_APPLY_FRAMES,
  PHYSIC_PAINT_MIN_APPLY_FRAMES,
  PLAY_TO_ROTO_MISSING_FRAMES_MESSAGE,
  clampOnionCount,
  getActivePrimaryActionLabel,
  getPlayRangeMarker,
  type PhysicsPaintOnionState,
  type PhysicsPaintPlayRange,
  type PhysicsPaintWorkflowMode,
} from './physicsPaintWorkflowState';
import { clampPhysicPaintFrameCount } from '../../types/physicPaint';

const SAVE_ROTO_FRAME_LABEL = 'Save roto frame';
const SAVE_PLAY_LABEL = 'Save play';
const CLEAR_PLAY_CANVAS_RANGE_LABEL = 'Clear Play canvas range';
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

export type PhysicsPaintWorkflowConfirmation = 'clear-play-range' | 'convert-play-to-roto' | 'convert-roto-to-play';

export interface PhysicsPaintWorkflowStripProps {
  mode: PhysicsPaintWorkflowMode;
  currentFrame: number;
  startFrame: number;
  frameCount: number;
  isPlaying: boolean;
  ready?: boolean;
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
  onInspectPlayFrame: (frame: number) => void;
  onOnionChange: (onion: PhysicsPaintOnionState) => void;
  onClearRotoFrame?: (frame: number) => void;
  onClearPlayRange?: () => void;
  onConvertPlayToRoto?: () => void;
  onConvertRotoToPlay?: () => void;
}

function buildFrameCells(range: PhysicsPaintPlayRange, currentFrame: number): number[] {
  const visibleCount = Math.min(48, Math.max(range.frameCount, 12));
  const start = Math.max(0, Math.min(range.startFrame, currentFrame - Math.floor(visibleCount / 2)));
  return Array.from({ length: visibleCount }, (_, index) => start + index);
}

function isSavedFrame(markers: PhysicsPaintWorkflowStripFrameMarker[] | undefined, frame: number): boolean {
  return Boolean(markers?.some(marker => marker.frame === frame && marker.saved !== false));
}

export function PhysicsPaintWorkflowStrip(props: PhysicsPaintWorkflowStripProps) {
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<PhysicsPaintWorkflowConfirmation | null>(null);
  const playRange = useMemo(
    () => getPlayRangeMarker(props.startFrame, props.frameCount, props.currentFrame),
    [props.currentFrame, props.frameCount, props.startFrame]
  );
  const frameCells = useMemo(() => buildFrameCells(playRange, props.currentFrame), [playRange, props.currentFrame]);
  const primaryActionLabel = getActivePrimaryActionLabel(props.mode) === SAVE_PLAY_LABEL ? SAVE_PLAY_LABEL : SAVE_ROTO_FRAME_LABEL;
  const safeFrameCount = clampPhysicPaintFrameCount(props.frameCount || PHYSIC_PAINT_DEFAULT_APPLY_FRAMES);
  const status = props.statusMessage ?? localStatus ?? props.sameModeReplacementMessage ?? props.playPublicationSummary;
  const onionCount = clampOnionCount(props.onion.count);
  const onionControlsDisabled = props.isPlaying;
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

  function handleClearRotoFrame() {
    props.onClearRotoFrame?.(props.currentFrame);
    setLocalStatus(`Cleared roto frame ${props.currentFrame}.`);
  }

  function updateOnion(next: Partial<PhysicsPaintOnionState>) {
    props.onOnionChange({ ...props.onion, ...next, count: clampOnionCount(next.count ?? props.onion.count) });
  }

  function getConfirmationCopy(kind: PhysicsPaintWorkflowConfirmation): string {
    if (kind === 'clear-play-range') {
      return `This clears the Play canvas source for frames ${playRange.startFrame}–${playRange.endFrame}. Rendered frames for that range will be replaced or removed. Continue?`;
    }
    if (kind === 'convert-play-to-roto') {
      return `Convert Play to Roto? This turns ${playRange.frameCount} rendered Play frames into roto frames and deletes the editable Play source for this range.`;
    }
    return `Convert Roto to Play? This replaces roto frames ${playRange.startFrame}–${playRange.endFrame} with one Play canvas source and removes those roto images.`;
  }

  function getConfirmationTitle(kind: PhysicsPaintWorkflowConfirmation): string {
    if (kind === 'clear-play-range') return CLEAR_PLAY_CANVAS_RANGE_LABEL;
    if (kind === 'convert-play-to-roto') return CONVERT_PLAY_TO_ROTO_LABEL;
    return CONVERT_ROTO_TO_PLAY_LABEL;
  }

  function confirmDestructiveAction() {
    if (confirmation === 'clear-play-range') {
      props.onClearPlayRange?.();
      setLocalStatus(`Cleared Play canvas range ${playRange.startFrame}–${playRange.endFrame}.`);
    } else if (confirmation === 'convert-play-to-roto') {
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
            class={`physics-paint-workflow-tab ${props.mode === 'roto' ? 'active' : ''}`}
            role="tab"
            aria-selected={props.mode === 'roto'}
            onClick={() => props.onModeChange('roto')}
          >
            Roto canvas
          </button>
          <button
            class={`physics-paint-workflow-tab ${props.mode === 'play' ? 'active' : ''}`}
            role="tab"
            aria-selected={props.mode === 'play'}
            onClick={() => props.onModeChange('play')}
          >
            Play canvas
          </button>
        </div>

        <div class="physics-paint-workflow-actions">
          <button class="physics-paint-primary-action" disabled={props.ready === false} onClick={handlePrimaryAction}>
            {primaryActionLabel}
          </button>
          <button class="physics-paint-text-button" disabled={props.mode !== 'play'} onClick={() => props.onPlayPreview(safeFrameCount)}>
            {props.isPlaying ? 'Play' : 'Play'}
          </button>
          <button class="physics-paint-text-button" disabled={!props.isPlaying} onClick={props.onStopPreview}>Stop</button>
          <button class="physics-paint-text-button" onClick={props.onSaveState}>Save state</button>
          <button class="physics-paint-text-button destructive" disabled={props.mode !== 'play'} onClick={() => setConfirmation('clear-play-range')}>{CLEAR_PLAY_CANVAS_RANGE_LABEL}</button>
          <button class="physics-paint-text-button destructive" onClick={() => setConfirmation('convert-play-to-roto')}>Convert Play to Roto?</button>
          <button class="physics-paint-text-button destructive" onClick={() => setConfirmation('convert-roto-to-play')}>Convert Roto to Play?</button>
          <label class="physics-paint-text-button physics-paint-load-state">
            Load state
            <input type="file" accept=".json" onChange={props.onLoadState} />
          </label>
        </div>
      </div>

      <div class="physics-paint-workflow-options">
        <label>
          Frames
          <input
            type="number"
            min={PHYSIC_PAINT_MIN_APPLY_FRAMES}
            max={PHYSIC_PAINT_MAX_APPLY_FRAMES}
            value={safeFrameCount}
            onInput={handleFrameCountInput}
          />
        </label>
        {props.mode === 'roto' ? (
          <button class="physics-paint-text-button destructive" onClick={handleClearRotoFrame}>Clear current Roto frame</button>
        ) : null}
        {props.isPlaying ? <span class="physics-paint-preview-status">Preview only — use Save play to publish this range.</span> : null}
        {props.isPlaying && props.showOnionHiddenDuringPreview ? <span class="physics-paint-preview-status">Onion skin hidden during preview</span> : null}
        {status ? <span class="physics-paint-publication-summary">{status}</span> : null}
      </div>

      {props.mode === 'roto' ? (
        <div class={`physics-paint-onion-controls ${onionControlsDisabled ? 'disabled-control' : ''}`} aria-label="Onion skin controls">
          <label><input type="checkbox" checked={props.onion.enabled} disabled={onionControlsDisabled} onChange={(event) => updateOnion({ enabled: (event.currentTarget as HTMLInputElement).checked })} /> Onion skin</label>
          <label><input type="checkbox" checked={props.onion.previous} disabled={onionControlsDisabled} onChange={(event) => updateOnion({ previous: (event.currentTarget as HTMLInputElement).checked })} /> Previous</label>
          <label><input type="checkbox" checked={props.onion.next} disabled={onionControlsDisabled} onChange={(event) => updateOnion({ next: (event.currentTarget as HTMLInputElement).checked })} /> Next</label>
          <label>
            Count
            <input type="number" min={1} max={3} value={onionCount} disabled={onionControlsDisabled} onInput={(event) => updateOnion({ count: Number((event.currentTarget as HTMLInputElement).value) })} />
          </label>
          <span class="physics-paint-onion-legend physics-paint-onion-prev">Previous cyan/blue</span>
          <span class="physics-paint-onion-legend physics-paint-onion-next">Next orange/yellow</span>
        </div>
      ) : null}

      <div class="physics-paint-timeline" aria-label="Physics Paint timeline">
        <div class={`physics-paint-lane ${props.mode !== 'roto' ? 'disabled-control' : ''}`}>
          <span class="physics-paint-lane-label">Roto frames</span>
          <div class="physics-paint-roto-cells" role="row">
            {frameCells.map(frame => (
              <button
                key={frame}
                class={`physics-paint-roto-cell ${frame === props.currentFrame ? 'current' : ''} ${isSavedFrame(props.savedRotoFrames, frame) ? 'saved' : ''}`}
                disabled={props.mode !== 'roto'}
                aria-label={`Roto frame ${frame}`}
                onClick={() => props.onNavigateToSyncedFrame(frame)}
              >
                <span>{frame}</span>
              </button>
            ))}
          </div>
        </div>

        <div class={`physics-paint-lane ${props.mode !== 'play' ? 'disabled-control' : ''}`}>
          <span class="physics-paint-lane-label">Play canvas</span>
          <div class="physics-paint-play-track">
            <span class="physics-paint-play-start-square" aria-label={`Play canvas starts at frame ${playRange.startFrame}`} />
            <button
              class="physics-paint-play-range"
              disabled={props.mode !== 'play'}
              onClick={handlePlayRangeClick}
              aria-label={`Inspect Play canvas frames ${playRange.startFrame} through ${playRange.endFrame}`}
            >
              <span class="physics-paint-play-range-fill" />
              <span class="physics-paint-play-marker" style={{ left: `${playRange.markerRatio * 100}%` }}>
                {playRange.currentFrame}
              </span>
              <span class="physics-paint-play-range-label start">[{playRange.startFrame}]</span>
              <span class="physics-paint-play-range-label end">[{playRange.endFrame}]</span>
            </button>
          </div>
        </div>
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
