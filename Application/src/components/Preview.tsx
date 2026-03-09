import {useRef, useEffect} from 'preact/hooks';
import {effect} from '@preact/signals';
import {timelineStore} from '../stores/timelineStore';
import {layerStore} from '../stores/layerStore';
import {sequenceStore} from '../stores/sequenceStore';
import {activeSequenceFrames, activeSequenceStartFrame} from '../lib/frameMap';
import {PreviewRenderer} from '../lib/previewRenderer';

export function Preview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasLayers = layerStore.layers.value.length > 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new PreviewRenderer(canvas);

    /** Render using current signal values (peek to avoid subscriptions in callbacks) */
    function renderCurrent() {
      const globalFrame = timelineStore.currentFrame.peek();
      const startFrame = activeSequenceStartFrame.peek();
      const localFrame = globalFrame - startFrame;
      const layers = layerStore.layers.peek();
      const frames = activeSequenceFrames.peek();
      const fps = sequenceStore.getActiveSequence()?.fps ?? 24;
      renderer.renderFrame(layers, localFrame, frames, fps);
    }

    // When an image finishes loading, re-render with current values
    renderer.onImageLoaded = renderCurrent;

    // Pre-load effect: when active sequence frames change, pre-load all images
    const disposePreload = effect(() => {
      const frames = activeSequenceFrames.value;
      const imageIds = [...new Set(frames.map((f) => f.imageId))];
      renderer.preloadImages(imageIds);
    });

    // Render effect: redraw on frame/layer/sequence changes
    const disposeRender = effect(() => {
      const globalFrame = timelineStore.currentFrame.value;
      const startFrame = activeSequenceStartFrame.value;
      const localFrame = globalFrame - startFrame;
      const layers = layerStore.layers.value;
      const frames = activeSequenceFrames.value;
      const fps = sequenceStore.getActiveSequence()?.fps ?? 24;
      renderer.renderFrame(layers, localFrame, frames, fps);
    });

    // rAF render loop: ensures preview stays in sync during playback
    let rafId: number;
    let lastRenderedFrame = -1;

    function tick() {
      if (timelineStore.isPlaying.peek()) {
        const currentFrame = timelineStore.currentFrame.peek();
        if (currentFrame !== lastRenderedFrame) {
          lastRenderedFrame = currentFrame;
          renderCurrent();
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
