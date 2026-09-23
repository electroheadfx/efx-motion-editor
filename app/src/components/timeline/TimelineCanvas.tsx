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

  /** Commit the open inline FX rename (Enter/blur): trim, nonempty, changed →
   *  sequenceStore.rename, then clear the edit signal. Reads the signal via
   *  peek() so a double-fire (Enter then blur) can never rename twice (260923-kcs). */
  const commitFxRename = () => {
    const edit = timelineStore.fxRenameEdit.peek();
    if (!edit) return;
    const trimmed = edit.value.trim();
    if (trimmed && trimmed !== edit.original) {
      sequenceStore.rename(edit.sequenceId, trimmed);
    }
    timelineStore.fxRenameEdit.value = null;
  };

  const renameEdit = timelineStore.fxRenameEdit.value;

  return (
    <div class="flex-1 min-h-0 overflow-hidden relative" data-interactive>
      <canvas ref={canvasRef} class="w-full h-full" />
      {renameEdit && (
        <input
          type="text"
          class="absolute z-10 box-border px-1 bg-(--color-bg-input) text-(--color-text-primary) border border-(--color-border-subtle) rounded-sm outline-none"
          style={{
            left: `${renameEdit.x}px`,
            top: `${renameEdit.y}px`,
            width: `${renameEdit.width}px`,
            height: `${renameEdit.height}px`,
            fontSize: '9px',
            fontFamily: 'system-ui',
          }}
          ref={(el) => {
            if (el && document.activeElement !== el) el.focus();
          }}
          value={renameEdit.value}
          onInput={(e) => {
            const current = timelineStore.fxRenameEdit.peek();
            if (!current) return;
            timelineStore.fxRenameEdit.value = { ...current, value: e.currentTarget.value };
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitFxRename();
            } else if (e.key === 'Escape') {
              timelineStore.fxRenameEdit.value = null;
            }
          }}
          onBlur={() => commitFxRename()}
        />
      )}
    </div>
  );
}
