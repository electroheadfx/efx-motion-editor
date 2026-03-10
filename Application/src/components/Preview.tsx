import {useRef, useEffect} from 'preact/hooks';
import {effect} from '@preact/signals';
import {timelineStore} from '../stores/timelineStore';
import {layerStore} from '../stores/layerStore';
import {sequenceStore} from '../stores/sequenceStore';
import {frameMap, activeSequenceFrames, activeSequenceStartFrame} from '../lib/frameMap';
import {PreviewRenderer} from '../lib/previewRenderer';

export function Preview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasLayers = layerStore.layers.value.length > 0 || sequenceStore.getFxSequences().length > 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new PreviewRenderer(canvas);

    /**
     * Render for a given global frame using frameMap-derived data.
     * Independent of activeSequenceId — works correctly during playback
     * even when active sequence tracking is deferred.
     */
    function renderFromFrameMap(globalFrame: number) {
      const fm = frameMap.peek();
      if (globalFrame < 0 || globalFrame >= fm.length) return;

      const entry = fm[globalFrame];
      if (!entry) return;

      const allSeqs = sequenceStore.sequences.peek();
      const seq = allSeqs.find((s) => s.id === entry.sequenceId);
      if (!seq || seq.kind === 'fx') return;

      // Compute sequence start frame and local frame from frameMap
      let seqStart = globalFrame;
      while (seqStart > 0 && fm[seqStart - 1]?.sequenceId === entry.sequenceId) seqStart--;
      const seqFrames = fm.filter((e) => e.sequenceId === entry.sequenceId);
      const localFrame = globalFrame - seqStart;

      renderer.renderFrame(seq.layers, localFrame, seqFrames, seq.fps);

      // Composite FX sequences on top of content (without clearing the canvas)
      for (const fxSeq of allSeqs) {
        if (fxSeq.kind !== 'fx') continue;
        if (fxSeq.visible === false) continue;
        if (fxSeq.inFrame != null && globalFrame < fxSeq.inFrame) continue;
        if (fxSeq.outFrame != null && globalFrame >= fxSeq.outFrame) continue;
        const fxLayers = fxSeq.layers.filter((l) => l.visible);
        if (fxLayers.length > 0) {
          renderer.renderFrame(fxLayers, localFrame, seqFrames, seq.fps, false);
        }
      }
    }

    // When an image finishes loading, re-render with current values
    renderer.onImageLoaded = () => renderFromFrameMap(timelineStore.currentFrame.peek());

    // Pre-load effect: when active sequence frames change, pre-load all images
    const disposePreload = effect(() => {
      const frames = activeSequenceFrames.value;
      const imageIds = [...new Set(frames.map((f) => f.imageId))];
      renderer.preloadImages(imageIds);
    });

    // Render effect: redraw on scrub/seek/step and property changes.
    // Uses displayFrame (not currentFrame) so it does NOT fire during playback —
    // the rAF tick loop below handles playback rendering.
    const disposeRender = effect(() => {
      const globalFrame = timelineStore.displayFrame.value;
      const startFrame = activeSequenceStartFrame.value;
      const localFrame = globalFrame - startFrame;
      const layers = layerStore.layers.value;
      const frames = activeSequenceFrames.value;
      const fps = sequenceStore.getActiveSequence()?.fps ?? 24;
      renderer.renderFrame(layers, localFrame, frames, fps);

      // Composite FX sequences on top of content (without clearing the canvas)
      // Accessing sequences.value here subscribes the effect to FX seq changes
      const fxSequences = sequenceStore.sequences.value.filter((s) => s.kind === 'fx');
      for (const fxSeq of fxSequences) {
        if (fxSeq.visible === false) continue;
        if (fxSeq.inFrame != null && globalFrame < fxSeq.inFrame) continue;
        if (fxSeq.outFrame != null && globalFrame >= fxSeq.outFrame) continue;
        const fxLayers = fxSeq.layers.filter((l) => l.visible);
        if (fxLayers.length > 0) {
          renderer.renderFrame(fxLayers, localFrame, frames, fps, false);
        }
      }
    });

    // rAF render loop: renders during playback using frameMap-derived data
    let rafId: number;
    let lastRenderedFrame = -1;

    function tick() {
      if (timelineStore.isPlaying.peek()) {
        const currentFrame = timelineStore.currentFrame.peek();
        if (currentFrame !== lastRenderedFrame) {
          lastRenderedFrame = currentFrame;
          renderFromFrameMap(currentFrame);
        }
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      disposePreload();
      disposeRender();
      renderer.dispose();
    };
  }, []);

  return (
    <div class="relative w-full">
      <div class="relative w-full aspect-video bg-black rounded overflow-hidden">
        <canvas
          ref={canvasRef}
          class="absolute inset-0 w-full h-full"
          style={{objectFit: 'contain'}}
        />
        {!hasLayers && (
          <div class="absolute inset-0 flex items-center justify-center">
            <span class="text-[var(--color-text-secondary)] text-sm">
              No frames to preview
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
