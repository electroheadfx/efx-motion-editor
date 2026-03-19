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
  const hasContent = sequenceStore.sequences.value.some(s => s.kind === 'content' && s.keyPhotos.length > 0)
    || sequenceStore.sequences.value.some(s => s.kind !== 'content');

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

      // Composite overlay sequences (FX + content overlays): reverse order so top-of-timeline renders last
      const overlaySeqs = allSeqs.filter(s => s.kind !== 'content' && s.visible !== false);
      for (let i = overlaySeqs.length - 1; i >= 0; i--) {
        const overlaySeq = overlaySeqs[i];
        if (overlaySeq.inFrame != null && globalFrame < overlaySeq.inFrame) continue;
        if (overlaySeq.outFrame != null && globalFrame >= overlaySeq.outFrame) continue;

        if (overlaySeq.kind === 'content-overlay') {
          // Content overlay: compute local frame relative to inFrame, apply keyframe interpolation
          const overlayLocalFrame = globalFrame - (overlaySeq.inFrame ?? 0);
          const overlayLayers = overlaySeq.layers.filter(l => l.visible).map(layer => {
            if (!layer.keyframes || layer.keyframes.length === 0) return layer;
            const values = interpolateAt(layer.keyframes, overlayLocalFrame);
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
          if (overlayLayers.length > 0) {
            renderer.renderFrame(overlayLayers, overlayLocalFrame, seqFrames, seq.fps, false);
          }
        } else {
          // FX sequence (existing behavior)
          const fxLayers = overlaySeq.layers.filter((l) => l.visible);
          if (fxLayers.length > 0) {
            renderer.renderFrame(fxLayers, localFrame, seqFrames, seq.fps, false);
          }
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
      const globalFrame = timelineStore.displayFrame.value;
      const fm = frameMap.value;
      // Subscribe to all sequence data so we re-render on layer property changes
      const allSeqs = sequenceStore.sequences.value;
      // Subscribe to blur bypass signal so toggling bypass triggers a re-render.
      // This read creates a reactive subscription; the renderer reads the actual value
      // via .peek() (non-reactive) which is correct for the render loop.
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

      // Composite overlay sequences (FX + content overlays): reverse order so top-of-timeline renders last
      const overlaySeqs = allSeqs.filter(s => s.kind !== 'content' && s.visible !== false);
      for (let i = overlaySeqs.length - 1; i >= 0; i--) {
        const overlaySeq = overlaySeqs[i];
        if (overlaySeq.inFrame != null && globalFrame < overlaySeq.inFrame) continue;
        if (overlaySeq.outFrame != null && globalFrame >= overlaySeq.outFrame) continue;

        if (overlaySeq.kind === 'content-overlay') {
          // Content overlay: compute local frame relative to inFrame, apply keyframe interpolation
          const overlayLocalFrame = globalFrame - (overlaySeq.inFrame ?? 0);
          const overlayLayers = overlaySeq.layers.filter(l => l.visible).map(layer => {
            if (!layer.keyframes || layer.keyframes.length === 0) return layer;
            const values = interpolateAt(layer.keyframes, overlayLocalFrame);
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
          if (overlayLayers.length > 0) {
            renderer.renderFrame(overlayLayers, overlayLocalFrame, seqFrames, seq.fps, false);
          }
        } else {
          // FX sequence (existing behavior)
          const fxLayers = overlaySeq.layers.filter((l) => l.visible);
          if (fxLayers.length > 0) {
            renderer.renderFrame(fxLayers, localFrame, seqFrames, seq.fps, false);
          }
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
