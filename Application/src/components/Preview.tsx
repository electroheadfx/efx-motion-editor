import {useRef, useEffect} from 'preact/hooks';
import {effect} from '@preact/signals';
import {timelineStore} from '../stores/timelineStore';
import {sequenceStore} from '../stores/sequenceStore';
import {blurStore} from '../stores/blurStore';
import {frameMap, crossDissolveOverlaps} from '../lib/frameMap';
import {PreviewRenderer} from '../lib/previewRenderer';
import {renderGlobalFrame} from '../lib/exportRenderer';

export function Preview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasContent = sequenceStore.sequences.value.some(s => s.kind === 'content' && s.keyPhotos.length > 0)
    || sequenceStore.sequences.value.some(s => s.kind !== 'content');

  useEffect(() => {
    const canvas = canvasRef.current!;
    if (!canvas) return;

    const renderer = new PreviewRenderer(canvas);

    /**
     * Render for a given global frame using frameMap-derived data.
     * Delegates to the shared renderGlobalFrame from exportRenderer.ts.
     * Independent of activeSequenceId — works correctly during playback
     * even when active sequence tracking is deferred.
     */
    function renderFromFrameMap(globalFrame: number) {
      const fm = frameMap.peek();
      const allSeqs = sequenceStore.sequences.peek();
      const overlaps = crossDissolveOverlaps.peek();
      renderGlobalFrame(renderer, canvas, globalFrame, fm, allSeqs, overlaps);
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
    // Reads reactive signals to establish subscriptions, then delegates to renderFromFrameMap.
    const disposeRender = effect(() => {
      const globalFrame = timelineStore.displayFrame.value;
      // Subscribe to all sequence data so we re-render on layer property changes
      void sequenceStore.sequences.value;
      // Subscribe to frameMap so we re-render when timeline shortens/expands
      void frameMap.value;
      // Subscribe to blur bypass signal so toggling bypass triggers a re-render.
      void blurStore.bypassBlur.value;

      renderFromFrameMap(globalFrame);
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
          <span class="text-(--color-text-secondary) text-sm">
            No frames to preview
          </span>
        </div>
      )}
    </div>
  );
}
