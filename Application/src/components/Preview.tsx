import {useRef, useEffect} from 'preact/hooks';
import {effect} from '@preact/signals';
import {timelineStore} from '../stores/timelineStore';
import {sequenceStore} from '../stores/sequenceStore';
import {blurStore} from '../stores/blurStore';
import {frameMap} from '../lib/frameMap';
import {PreviewRenderer} from '../lib/previewRenderer';
import {interpolateAt} from '../lib/keyframeEngine';
import {isFxLayer} from '../types/layer';

export function Preview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasContent = sequenceStore.sequences.value.some(s => s.kind === 'content' && s.keyPhotos.length > 0) || sequenceStore.getFxSequences().length > 0;

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

      // Apply keyframe interpolation to content layers before rendering
      const interpolatedLayers = seq.layers.map(layer => {
        if (!layer.keyframes || layer.keyframes.length === 0) return layer;
        if (isFxLayer(layer) || layer.isBase) return layer;

        const values = interpolateAt(layer.keyframes, localFrame);
        if (!values) return layer;

        return {
          ...layer,
          opacity: values.opacity,
          transform: {
            ...layer.transform,
            x: values.x,
            y: values.y,
            scaleX: values.scaleX,
            scaleY: values.scaleY,
            rotation: values.rotation,
          },
          blur: values.blur,
        };
      });

      renderer.renderFrame(interpolatedLayers, localFrame, seqFrames, seq.fps);

      // Composite FX sequences: reverse order so top-of-timeline renders last
      // (higher FX layers affect/blur everything beneath them)
      const fxSeqs = allSeqs.filter(s => s.kind === 'fx' && s.visible !== false);
      for (let i = fxSeqs.length - 1; i >= 0; i--) {
        const fxSeq = fxSeqs[i];
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

    // Pre-load effect: preload all content frames from frameMap since cursor can be in any sequence
    const disposePreload = effect(() => {
      const frames = frameMap.value;
      const imageIds = [...new Set(frames.map((f) => f.imageId))];
      renderer.preloadImages(imageIds);
    });

    // Render effect: redraw on scrub/seek/step and property changes.
    // Uses displayFrame (not currentFrame) so it does NOT fire during playback —
    // the rAF tick loop below handles playback rendering.
    // Uses frameMap to determine which sequence owns the cursor frame, so selecting
    // a different sequence in the sidebar does not change what is rendered.
    const disposeRender = effect(() => {
      // Skip render during timeline drags (playhead scrub, FX drag, keyframe drag).
      // The effect subscribes to timelineDragging; when it transitions false->true
      // we early-return, and when it transitions true->false the effect re-runs
      // and performs the render with current state.
      const isDragging = timelineStore.timelineDragging.value;
      if (isDragging) return;

      const globalFrame = timelineStore.displayFrame.value;
      const fm = frameMap.value;
      // Subscribe to all sequence data so we re-render on layer property changes
      const allSeqs = sequenceStore.sequences.value;
      // Subscribe to blur store signals so toggling HQ/bypass triggers a re-render.
      // These reads create reactive subscriptions; the renderer reads actual values
      // via .peek() (non-reactive) which is correct for the render loop.
      void blurStore.hqPreview.value;
      void blurStore.bypassBlur.value;

      if (globalFrame < 0 || globalFrame >= fm.length) return;

      const entry = fm[globalFrame];
      if (!entry) return;

      const seq = allSeqs.find((s) => s.id === entry.sequenceId);
      if (!seq || seq.kind === 'fx') return;

      // Compute sequence start frame and local frame from frameMap
      let seqStart = globalFrame;
      while (seqStart > 0 && fm[seqStart - 1]?.sequenceId === entry.sequenceId) seqStart--;
      const seqFrames = fm.filter((e) => e.sequenceId === entry.sequenceId);
      const localFrame = globalFrame - seqStart;

      // Apply keyframe interpolation to content layers before rendering
      const interpolatedLayers = seq.layers.map(layer => {
        if (!layer.keyframes || layer.keyframes.length === 0) return layer;
        if (isFxLayer(layer) || layer.isBase) return layer;

        const values = interpolateAt(layer.keyframes, localFrame);
        if (!values) return layer;

        return {
          ...layer,
          opacity: values.opacity,
          transform: {
            ...layer.transform,
            x: values.x,
            y: values.y,
            scaleX: values.scaleX,
            scaleY: values.scaleY,
            rotation: values.rotation,
          },
          blur: values.blur,
        };
      });

      renderer.renderFrame(interpolatedLayers, localFrame, seqFrames, seq.fps);

      // Composite FX sequences: reverse order so top-of-timeline renders last
      // (higher FX layers affect/blur everything beneath them)
      const fxSeqs = allSeqs.filter(s => s.kind === 'fx' && s.visible !== false);
      for (let i = fxSeqs.length - 1; i >= 0; i--) {
        const fxSeq = fxSeqs[i];
        if (fxSeq.inFrame != null && globalFrame < fxSeq.inFrame) continue;
        if (fxSeq.outFrame != null && globalFrame >= fxSeq.outFrame) continue;
        const fxLayers = fxSeq.layers.filter((l) => l.visible);
        if (fxLayers.length > 0) {
          renderer.renderFrame(fxLayers, localFrame, seqFrames, seq.fps, false);
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
    <div class="absolute inset-0">
      <canvas
        ref={canvasRef}
        class="absolute inset-0 w-full h-full"
      />
      {!hasContent && (
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="text-[var(--color-text-secondary)] text-sm">
            No frames to preview
          </span>
        </div>
      )}
    </div>
  );
}
