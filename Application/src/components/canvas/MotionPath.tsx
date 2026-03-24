import type {Keyframe} from '../../types/layer';
import {interpolateAt} from '../../lib/keyframeEngine';
import {keyframeStore} from '../../stores/keyframeStore';
import {timelineStore} from '../../stores/timelineStore';
import {canvasStore} from '../../stores/canvasStore';
import {projectStore} from '../../stores/projectStore';
import {layerStore} from '../../stores/layerStore';
import {sequenceStore} from '../../stores/sequenceStore';
import {trackLayouts} from '../../lib/frameMap';
import type {KeyframeCircle} from './motionPathHitTest';

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Returns true if any keyframe has a different x or y from the first keyframe.
 * If fewer than 2 keyframes, returns false (no motion path to show).
 */
export function hasMotion(keyframes: Keyframe[]): boolean {
  if (keyframes.length < 2) return false;
  const first = keyframes[0].values;
  for (let i = 1; i < keyframes.length; i++) {
    if (keyframes[i].values.x !== first.x || keyframes[i].values.y !== first.y) {
      return true;
    }
  }
  return false;
}

/**
 * Sample one dot per frame between the first and last keyframe.
 * Returns an array of {x, y, frame} in project-space coordinates.
 */
export function sampleMotionDots(
  keyframes: Keyframe[],
  canvasW: number,
  canvasH: number,
): {x: number; y: number; frame: number}[] {
  if (keyframes.length < 2) return [];

  const firstFrame = keyframes[0].frame;
  const lastFrame = keyframes[keyframes.length - 1].frame;
  const dots: {x: number; y: number; frame: number}[] = [];

  for (let frame = firstFrame; frame <= lastFrame; frame++) {
    const vals = interpolateAt(keyframes, frame);
    if (vals) {
      dots.push({
        x: vals.x + canvasW / 2,
        y: vals.y + canvasH / 2,
        frame,
      });
    }
  }

  return dots;
}

// ---------------------------------------------------------------------------
// Internal helper: find the global start frame of the sequence owning a layer
// ---------------------------------------------------------------------------

function findLayerStartFrame(layerId: string): number {
  const seqs = sequenceStore.sequences.peek();
  const layouts = trackLayouts.peek();
  for (const seq of seqs) {
    if (seq.layers.some((l) => l.id === layerId)) {
      if (seq.kind === 'fx' || seq.kind === 'content-overlay') {
        return seq.inFrame ?? 0;
      }
      const layout = layouts.find((t) => t.sequenceId === seq.id);
      return layout?.startFrame ?? 0;
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** High-frame threshold for polyline optimization */
const POLYLINE_THRESHOLD = 300;

export function MotionPath() {
  // --- Read all signals ---
  const keyframes = keyframeStore.activeLayerKeyframes.value;
  const selectedFrames = keyframeStore.selectedKeyframeFrames.value;
  const isPlaying = timelineStore.isPlaying.value;
  const displayFrame = timelineStore.displayFrame.value;
  const zoom = canvasStore.zoom.value;
  const canvasW = projectStore.width.value;
  const canvasH = projectStore.height.value;
  const selectedLayerId = layerStore.selectedLayerId.value;

  // --- Early returns ---
  if (isPlaying) return null;
  if (!selectedLayerId) return null;
  if (keyframes.length < 2) return null;
  if (!hasMotion(keyframes)) return null;

  // --- Sample dots ---
  const dots = sampleMotionDots(keyframes, canvasW, canvasH);
  if (dots.length === 0) return null;

  // --- Counter-scaled sizes ---
  const dotRadius = 2 / zoom;
  const kfCircleRadius = 5 / zoom;
  const kfStrokeWidth = 1.5 / zoom;
  const highlightRadius = 4 / zoom;

  // --- Build keyframe circle positions ---
  const kfCircles: KeyframeCircle[] = keyframes.map((kf) => ({
    x: kf.values.x + canvasW / 2,
    y: kf.values.y + canvasH / 2,
    frame: kf.frame,
  }));

  // --- Find current frame dot ---
  const startFrame = findLayerStartFrame(selectedLayerId);
  const localFrame = displayFrame - startFrame;
  const firstKfFrame = keyframes[0].frame;
  const lastKfFrame = keyframes[keyframes.length - 1].frame;
  const currentDot =
    localFrame >= firstKfFrame && localFrame <= lastKfFrame
      ? dots.find((d) => d.frame === localFrame) ?? null
      : null;

  // --- Determine rendering strategy ---
  const totalDots = dots.length;
  const usePolyline = totalDots > POLYLINE_THRESHOLD;

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'visible',
        pointerEvents: 'none',
      }}
    >
      {/* Trail dots / polyline */}
      {usePolyline ? (
        <polyline
          points={dots.map((d) => `${d.x},${d.y}`).join(' ')}
          fill="none"
          stroke="var(--color-accent)"
          stroke-width={kfStrokeWidth}
          stroke-dasharray={`${dotRadius * 2} ${dotRadius * 3}`}
          opacity={0.35}
        />
      ) : (
        dots.map((dot) => (
          <circle
            key={dot.frame}
            cx={dot.x}
            cy={dot.y}
            r={dotRadius}
            fill="var(--color-accent)"
            opacity={0.35}
          />
        ))
      )}

      {/* Current frame highlight */}
      {currentDot && (
        <circle
          cx={currentDot.x}
          cy={currentDot.y}
          r={highlightRadius}
          fill="var(--color-accent)"
          opacity={0.9}
        />
      )}

      {/* Keyframe circles */}
      {kfCircles.map((kf) => {
        const selected = selectedFrames.has(kf.frame);
        return (
          <circle
            key={`kf-${kf.frame}`}
            cx={kf.x}
            cy={kf.y}
            r={kfCircleRadius}
            fill={selected ? 'var(--color-accent)' : 'none'}
            stroke="var(--color-accent)"
            stroke-width={kfStrokeWidth}
            data-kf-frame={kf.frame}
          />
        );
      })}
    </svg>
  );
}
