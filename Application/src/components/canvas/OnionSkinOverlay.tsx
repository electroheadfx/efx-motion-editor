import {useEffect, useRef} from 'preact/hooks';
import {paintStore} from '../../stores/paintStore';
import {layerStore} from '../../stores/layerStore';
import {timelineStore} from '../../stores/timelineStore';
import {projectStore} from '../../stores/projectStore';
import {renderPaintFrame} from '../../lib/paintRenderer';

/**
 * Onion skin overlay for rotoscoping workflow.
 *
 * Renders ghosted paint from adjacent frames when paint mode is active
 * and onion skinning is enabled. Previous and next frames are rendered
 * with opacity falloff based on frame distance.
 *
 * Positioned with pointerEvents: 'none' so clicks pass through to PaintOverlay.
 */
export function OnionSkinOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Re-render when frame, onion skin settings, paint data, or layer selection change
  const currentFrame = timelineStore.currentFrame.value;
  const enabled = paintStore.onionSkinEnabled.value;
  const prevRange = paintStore.onionSkinPrevRange.value;
  const nextRange = paintStore.onionSkinNextRange.value;
  const baseOpacity = paintStore.onionSkinOpacity.value;
  const version = paintStore.paintVersion.value;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = projectStore.width.peek();
    const h = projectStore.height.peek();

    // Ensure canvas matches project size
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    // Clear overlay
    ctx.clearRect(0, 0, w, h);

    if (!enabled) return;

    const layerId = layerStore.selectedLayerId.peek();
    if (!layerId) return;

    // Render previous frames (opacity decreases with distance)
    for (let i = 1; i <= prevRange; i++) {
      const frameNum = currentFrame - i;
      if (frameNum < 0) continue;

      const frameData = paintStore.getFrame(layerId, frameNum);
      if (!frameData || frameData.elements.length === 0) continue;

      const opacity = baseOpacity * (1 - i / (prevRange + 1));
      ctx.save();
      ctx.globalAlpha = opacity;
      renderPaintFrame(ctx, frameData, w, h);
      ctx.restore();
    }

    // Render next frames (opacity decreases with distance)
    for (let i = 1; i <= nextRange; i++) {
      const frameNum = currentFrame + i;

      const frameData = paintStore.getFrame(layerId, frameNum);
      if (!frameData || frameData.elements.length === 0) continue;

      const opacity = baseOpacity * (1 - i / (nextRange + 1));
      ctx.save();
      ctx.globalAlpha = opacity;
      renderPaintFrame(ctx, frameData, w, h);
      ctx.restore();
    }
  }, [currentFrame, enabled, prevRange, nextRange, baseOpacity, version]);

  return (
    <canvas
      ref={canvasRef}
      width={projectStore.width.value}
      height={projectStore.height.value}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
}
