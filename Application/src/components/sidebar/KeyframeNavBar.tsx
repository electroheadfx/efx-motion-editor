import { ChevronLeft, ChevronRight, Plus, RefreshCw, Trash2 } from 'lucide-preact';
import { keyframeStore } from '../../stores/keyframeStore';
import { timelineStore } from '../../stores/timelineStore';
import { sequenceStore } from '../../stores/sequenceStore';
import { trackLayouts } from '../../lib/frameMap';
import { playbackEngine } from '../../lib/playbackEngine';
import { getKeyframeNav } from '../../lib/keyframeNav';
import type { Layer } from '../../types/layer';

interface KeyframeNavBarProps {
  layer: Layer;
}

/** Get the sequence-local frame for a layer (uses .peek() since caller subscribes to currentFrame) */
function getLocalFrameForLayer(layerId: string, globalFrame: number): number {
  const seqs = sequenceStore.sequences.peek();
  const layouts = trackLayouts.peek();
  for (const seq of seqs) {
    if (seq.kind === 'fx') continue;
    if (seq.layers.some((l) => l.id === layerId)) {
      const layout = layouts.find((t) => t.sequenceId === seq.id);
      const startFrame = layout?.startFrame ?? 0;
      return globalFrame - startFrame;
    }
  }
  return 0;
}

/** Get the global start frame for the sequence containing this layer */
function getSequenceStartFrame(layerId: string): number {
  const seqs = sequenceStore.sequences.peek();
  const layouts = trackLayouts.peek();
  for (const seq of seqs) {
    if (seq.kind === 'fx') continue;
    if (seq.layers.some((l) => l.id === layerId)) {
      const layout = layouts.find((t) => t.sequenceId === seq.id);
      return layout?.startFrame ?? 0;
    }
  }
  return 0;
}

export function KeyframeNavBar({ layer }: KeyframeNavBarProps) {
  const keyframes = keyframeStore.activeLayerKeyframes.value;
  const globalFrame = timelineStore.displayFrame.value;
  const localFrame = getLocalFrameForLayer(layer.id, globalFrame);
  const nav = getKeyframeNav(keyframes, localFrame);
  const isOnKf = nav.isOnKf;

  // Debug: log navigation state to diagnose prev/next button issues
  console.warn('[KfNav] globalFrame:', globalFrame, 'localFrame:', localFrame,
    'kfFrames:', keyframes.map(k => k.frame),
    'nav:', { prev: nav.prevFrame, next: nav.nextFrame, isOnKf: nav.isOnKf, canPrev: nav.canPrev, canNext: nav.canNext });

  const btnBase = 'w-6 h-6 flex items-center justify-center rounded transition-colors';
  const btnEnabled = 'hover:bg-[var(--sidebar-input-bg)]';
  const btnDisabled = 'opacity-40 cursor-default';

  const handlePrev = () => {
    if (nav.canPrev && nav.prevFrame !== null) {
      const startFrame = getSequenceStartFrame(layer.id);
      playbackEngine.seekToFrame(startFrame + nav.prevFrame);
    }
  };

  const handleNext = () => {
    if (nav.canNext && nav.nextFrame !== null) {
      const startFrame = getSequenceStartFrame(layer.id);
      playbackEngine.seekToFrame(startFrame + nav.nextFrame);
    }
  };

  const handleAddOrUpdate = () => {
    const globalFrame = timelineStore.currentFrame.peek();
    keyframeStore.addKeyframe(layer.id, globalFrame);
  };

  const handleDelete = () => {
    if (!isOnKf) return;
    const lf = getLocalFrameForLayer(layer.id, timelineStore.currentFrame.peek());
    keyframeStore.removeKeyframes(layer.id, [lf]);
  };

  return (
    <div class="flex items-center gap-1" style={{ color: 'var(--sidebar-text-button)' }}>
      {/* Previous keyframe */}
      <button
        class={`${btnBase} ${nav.canPrev ? btnEnabled : btnDisabled}`}
        onClick={handlePrev}
        disabled={!nav.canPrev}
        title="Previous keyframe"
      >
        <ChevronLeft size={14} />
      </button>

      {/* Add / Update keyframe */}
      <button
        class={`${btnBase} ${btnEnabled}`}
        onClick={handleAddOrUpdate}
        title={isOnKf ? 'Update keyframe' : 'Add keyframe'}
      >
        {isOnKf ? <RefreshCw size={14} /> : <Plus size={14} />}
      </button>

      {/* Delete keyframe */}
      <button
        class={`${btnBase} ${isOnKf ? btnEnabled : btnDisabled}`}
        onClick={handleDelete}
        disabled={!isOnKf}
        title="Delete keyframe"
        style={isOnKf ? { color: 'var(--color-error-text)' } : undefined}
      >
        <Trash2 size={14} />
      </button>

      {/* Next keyframe */}
      <button
        class={`${btnBase} ${nav.canNext ? btnEnabled : btnDisabled}`}
        onClick={handleNext}
        disabled={!nav.canNext}
        title="Next keyframe"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}
