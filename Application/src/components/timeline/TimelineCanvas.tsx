import {useRef, useEffect} from 'preact/hooks';
import {effect} from '@preact/signals';
import {TimelineRenderer} from './TimelineRenderer';
import {TimelineInteraction} from './TimelineInteraction';
import {timelineStore} from '../../stores/timelineStore';
import {trackLayouts, fxTrackLayouts} from '../../lib/frameMap';
import {imageStore} from '../../stores/imageStore';

/**
 * TimelineCanvas: Preact component wrapping a canvas element with signal subscriptions.
 *
 * Creates TimelineRenderer (drawing) and TimelineInteraction (events),
 * subscribes to timeline signals, and triggers redraws on changes.
 */
export function TimelineCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<TimelineRenderer | null>(null);
  const interactionRef = useRef<TimelineInteraction | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create renderer and interaction handler
    const renderer = new TimelineRenderer(canvas);
    const interaction = new TimelineInteraction();

    rendererRef.current = renderer;
    interactionRef.current = interaction;

    interaction.attach(canvas, renderer);

    // ResizeObserver to handle container size changes
    const resizeObserver = new ResizeObserver(() => {
      renderer.resize();
    });
    resizeObserver.observe(canvas.parentElement ?? canvas);

    // Effect: subscribe to all timeline signals and redraw on changes
    const dispose = effect(() => {
      const frame = timelineStore.currentFrame.value;
      const zoom = timelineStore.zoom.value;
      const scrollX = timelineStore.scrollX.value;
      const tracks = trackLayouts.value;
      const totalFrames = timelineStore.totalFrames.value;

      renderer.draw({
        frame,
        zoom,
        scrollX,
        tracks,
        fxTracks: fxTrackLayouts.value,
        imageStore,
        totalFrames,
      });
    });

    return () => {
      dispose();
      interaction.detach();
      renderer.destroy();
      resizeObserver.disconnect();
      rendererRef.current = null;
      interactionRef.current = null;
    };
  }, []);

  return (
    <div class="flex-1 min-h-0 overflow-hidden">
      <canvas ref={canvasRef} class="w-full h-full" />
    </div>
  );
}
