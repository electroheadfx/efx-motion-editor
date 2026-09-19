import {useRef, useEffect} from 'preact/hooks';
import {effect, signal, computed, type ReadonlySignal} from '@preact/signals';
import {timelineStore} from '../stores/timelineStore';
import {sequenceStore} from '../stores/sequenceStore';
import {blurStore} from '../stores/blurStore';
import {paintStore} from '../stores/paintStore';
import {physicPaintVersion} from '../stores/physicPaintStore';
import {physicPaintLaunchActive} from '../lib/physicPaintBridge';
import {soloStore} from '../stores/soloStore';
import {frameMap, crossDissolveOverlaps} from '../lib/frameMap';
import {PreviewRenderer} from '../lib/previewRenderer';
import {renderGlobalFrame} from '../lib/exportRenderer';

// 52.1 (GPU-queue contention): the main-window Preview re-composited on EVERY
// physicPaintVersion bump — one flatten (LRU-miss decode + full-1080p draws)
// per captured stroke, streaming ~1s of serialized vm_copy work through the
// GPU-process queue shared with the Studio. The Studio's synchronous pixel
// readbacks queue behind that pile and park on their ~1s IPC timeout — the
// 2nd-stroke freeze. Trailing-throttle the subscription: while strokes stream
// in, the Preview holds its last frame; 400ms after the burst ends it renders
// once. Playback's rAF path is independent and unaffected.
function useTrailingThrottledSignal(source: ReadonlySignal<number>, delayMs: number): ReadonlySignal<number> {
  const throttled = useRef(signal(source.peek()));
  const latestRef = useRef(source.peek());
  const timerRef = useRef<number | null>(null);
  useEffect(() => {
    const dispose = effect(() => {
      const next = source.value;
      if (next === latestRef.current) return;
      latestRef.current = next;
      if (timerRef.current !== null) return;
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        throttled.current.value = latestRef.current;
      }, delayMs);
    });
    return () => {
      dispose();
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [source, delayMs]);
  return throttled.current;
}

// 52.1: frameMap recomputes on every physicPaintVersion bump (it reads it for
// roto loop ranges), producing a new array identity each time — subscribing to
// frameMap.value would bypass the paint throttle. The map's structural change
// signal at constant content is its LENGTH; equal lengths never notify. Layer
// edits still reach the effects via sequenceStore.sequences.
const frameMapLength = computed(() => frameMap.value.length);

export function Preview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const throttledPhysicPaintRevision = useTrailingThrottledSignal(physicPaintVersion, 400);
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
      renderGlobalFrame(renderer, canvas, globalFrame, fm, allSeqs, overlaps, soloStore.soloEnabled.value);
    }

    // When an image finishes loading, re-render with current values
    renderer.onImageLoaded = () => renderFromFrameMap(timelineStore.currentFrame.peek());

    // Pre-load effect: preload all content frames from frameMap since cursor can be in any sequence.
    // frameMapLength, not frameMap: a paint-burst recompute at equal length must
    // not retrigger image/texture preloads mid-gesture.
    const disposePreload = effect(() => {
      void frameMapLength.value;
      const frames = frameMap.peek();
      const sequences = sequenceStore.sequences.value;
      const imageIds = [...new Set(frames.flatMap((f) => f.kind === 'content' ? [f.imageId] : []))];
      renderer.preloadImages(imageIds);
      renderer.preloadPaperTextures(renderer.collectRotoPaperTextures(sequences));
    });

    // Render effect: redraw on scrub/seek/step and property changes.
    // Uses displayFrame (not currentFrame) so it does NOT fire during playback —
    // the rAF tick loop below handles playback rendering.
    // Reads reactive signals to establish subscriptions, then delegates to renderFromFrameMap.
    const disposeRender = effect(() => {
      const globalFrame = timelineStore.displayFrame.value;
      // Subscribe to all sequence data so we re-render on layer property changes
      void sequenceStore.sequences.value;
      // Subscribe to frameMap LENGTH so we re-render when timeline shortens/expands —
      // without re-firing on paint-burst recomputes at constant length (52.1).
      void frameMapLength.value;
      // Subscribe to blur bypass signal so toggling bypass triggers a re-render.
      void blurStore.bypassBlur.value;
      // Subscribe to paint data mutations so strokes appear after drawing.
      void paintStore.paintVersion.value;
      // Subscribe to physics paint rendered-output mutations so apply-back appears.
      // Throttled: one re-composite per paint burst, not per captured stroke.
      void throttledPhysicPaintRevision.value;
      // 52.1: while a Standalone paint child is open, its synchronous pixel
      // readbacks share this webview's GPU process; the main canvas re-flatten +
      // decode + full-frame upload on every child push saturates that channel
      // and freezes the child's next stroke. Hold the last frame for the whole
      // child session (the child owns the paint surface); clear the gate on
      // window close and the main re-renders the settled composite once.
      if (physicPaintLaunchActive.value) return;

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
