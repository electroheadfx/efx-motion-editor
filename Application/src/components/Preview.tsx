import {useRef, useEffect} from 'preact/hooks';
import {timelineStore} from '../stores/timelineStore';
import {layerStore} from '../stores/layerStore';
import {sequenceStore} from '../stores/sequenceStore';
import {frameMap} from '../lib/frameMap';
import {PreviewRenderer} from '../lib/previewRenderer';

export function Preview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<PreviewRenderer | null>(null);

  // Initialize renderer when canvas mounts
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new PreviewRenderer(canvas);
    rendererRef.current = renderer;

    // When an image finishes loading, trigger a re-render
    renderer.onImageLoaded = () => {
      const frame = timelineStore.currentFrame.peek();
      const layers = layerStore.layers.peek();
      const frames = frameMap.peek();
      const fps = sequenceStore.getActiveSequence()?.fps ?? 24;
      renderer.renderFrame(layers, frame, frames, fps);
    };

    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  // Re-render on frame change, layer changes, or frameMap changes
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    const frame = timelineStore.currentFrame.value;
    const layers = layerStore.layers.value;
    const frames = frameMap.value;
    const fps = sequenceStore.getActiveSequence()?.fps ?? 24;

    renderer.renderFrame(layers, frame, frames, fps);
  });

  const hasLayers = layerStore.layers.value.length > 0;

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
