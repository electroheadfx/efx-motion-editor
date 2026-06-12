import { useMemo, useState } from 'preact/hooks';
import {
  PHYSIC_PAINT_DEFAULT_APPLY_FRAMES,
  PHYSIC_PAINT_MAX_APPLY_FRAMES,
  PHYSIC_PAINT_MIN_APPLY_FRAMES,
  getActivePrimaryActionLabel,
  getPlayRangeMarker,
  type PhysicsPaintPlayRange,
  type PhysicsPaintWorkflowMode,
} from './physicsPaintWorkflowState';
import { clampPhysicPaintFrameCount } from '../../types/physicPaint';

const SAVE_ROTO_FRAME_LABEL = 'Save roto frame';
const SAVE_PLAY_LABEL = 'Save play';

export interface PhysicsPaintWorkflowStripFrameMarker {
  frame: number;
  saved?: boolean;
  label?: string;
}

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
  const playRange = useMemo(
    () => getPlayRangeMarker(props.startFrame, props.frameCount, props.currentFrame),
    [props.currentFrame, props.frameCount, props.startFrame]
  );
  const frameCells = useMemo(() => buildFrameCells(playRange, props.currentFrame), [playRange, props.currentFrame]);
  const primaryActionLabel = getActivePrimaryActionLabel(props.mode) === SAVE_PLAY_LABEL ? SAVE_PLAY_LABEL : SAVE_ROTO_FRAME_LABEL;
  const safeFrameCount = clampPhysicPaintFrameCount(props.frameCount || PHYSIC_PAINT_DEFAULT_APPLY_FRAMES);
  const status = props.statusMessage ?? localStatus ?? props.sameModeReplacementMessage ?? props.playPublicationSummary;

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
        {status ? <span class="physics-paint-publication-summary">{status}</span> : null}
      </div>

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
    </section>
  );
}
