import {useRef, useEffect} from 'preact/hooks';
import {effect} from '@preact/signals';
import {TimelineRenderer, invalidateColorCache} from './TimelineRenderer';
import {TimelineInteraction} from './TimelineInteraction';
import {timelineStore} from '../../stores/timelineStore';
import {trackLayouts, fxTrackLayouts, audioTrackLayouts} from '../../lib/frameMap';
import {imageStore} from '../../stores/imageStore';
import {layerStore} from '../../stores/layerStore';
import {sequenceStore} from '../../stores/sequenceStore';
import {keyframeStore} from '../../stores/keyframeStore';
import {audioStore} from '../../stores/audioStore';
// isFxLayer removed: FX layers now support keyframes
import {currentTheme} from '../../lib/themeManager';
import {isFullSpeed} from '../../lib/playbackEngine';
import {isolationStore} from '../../stores/isolationStore';
import {uiStore} from '../../stores/uiStore';

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
    const resizeObserver = new ResizeObserver((entries) => {
      renderer.resize();
      for (const entry of entries) {
        timelineStore.setViewportWidth(entry.contentRect.width);
        timelineStore.setViewportHeight(entry.contentRect.height);
      }
    });
    resizeObserver.observe(canvas.parentElement ?? canvas);

    // Effect: invalidate cached colors when theme changes, trigger redraw
    const disposeTheme = effect(() => {
      currentTheme.value; // subscribe to theme signal
      invalidateColorCache();
      if (rendererRef.current && rendererRef.current === renderer) {
        // Force redraw with new colors on next animation frame
        requestAnimationFrame(() => {
          if (rendererRef.current) {
            rendererRef.current.resize();
          }
        });
      }
    });

    // Effect: subscribe to all timeline signals and redraw on changes
    const dispose = effect(() => {
      const frame = timelineStore.currentFrame.value;
      const zoom = timelineStore.zoom.value;
      const scrollX = timelineStore.scrollX.value;
      const scrollY = timelineStore.scrollY.value;
      const tracks = trackLayouts.value;
      const totalFrames = timelineStore.totalFrames.value;
      const fxTracks = fxTrackLayouts.value;
      const isolatedIds = isolationStore.isolatedSequenceIds.value;
      const selectedTransitionVal = uiStore.selectedTransition.value;

      // Map selected layer ID to FX/content-overlay sequence ID for timeline highlight
      const selectedLayerId = layerStore.selectedLayerId.value;
      let selectedFxSequenceId: string | null = null;
      if (selectedLayerId) {
        for (const seq of sequenceStore.sequences.value) {
          if ((seq.kind === 'fx' || seq.kind === 'content-overlay') && seq.layers.some(l => l.id === selectedLayerId)) {
            selectedFxSequenceId = seq.id;
            break;
          }
        }
      }

      // Read active sequence ID for content track highlight
      const selectedContentSequenceId = sequenceStore.activeSequenceId.value;

      // Keyframe diamond data for selected content layer
      // Subscribe to keyframeStore signals for reactive redraws
      const selectedKfFrames = keyframeStore.selectedKeyframeFrames.value;
      const activeKfs = keyframeStore.activeLayerKeyframes.value;

      let selectedLayerKeyframes: { frame: number; easing: string }[] | undefined;
      let selectedLayerSequenceId: string | null = null;

      if (selectedLayerId) {
        for (const seq of sequenceStore.sequences.value) {
          const layer = seq.layers.find(l => l.id === selectedLayerId);
          if (layer && layer.keyframes && layer.keyframes.length > 0 && !layer.isBase) {
            selectedLayerKeyframes = layer.keyframes.map(kf => ({ frame: kf.frame, easing: kf.easing }));
            selectedLayerSequenceId = seq.id;
            break;
          }
        }
      }

      // Use activeKfs to ensure this effect re-runs when keyframes are added/removed/moved
      void activeKfs;

      renderer.draw({
        frame,
        zoom,
        scrollX,
        scrollY,
        tracks,
        fxTracks,
        imageStore,
        totalFrames,
        selectedFxSequenceId,
        selectedContentSequenceId,
        selectedLayerKeyframes,
        selectedKeyframeFrames: selectedKfFrames,
        selectedLayerSequenceId,
        hidePlayhead: isFullSpeed.value,
        isolatedSequenceIds: isolatedIds,
        selectedTransition: selectedTransitionVal,
        audioTracks: audioTrackLayouts.value,
        selectedAudioTrackId: audioStore.selectedTrackId.value,
        beatMarkersVisible: audioStore.beatMarkersVisible.value,
        snapToBeatsEnabled: audioStore.snapToBeatsEnabled.value,
      });
    });

    return () => {
      disposeTheme();
      dispose();
      interaction.detach();
      renderer.destroy();
      resizeObserver.disconnect();
      rendererRef.current = null;
      interactionRef.current = null;
    };
  }, []);

  return (
    <div class="flex-1 min-h-0 overflow-hidden relative" data-interactive>
      <canvas ref={canvasRef} class="w-full h-full" />
    </div>
  );
}
