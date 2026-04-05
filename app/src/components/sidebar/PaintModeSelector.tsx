import {paintStore} from '../../stores/paintStore';
import {layerStore} from '../../stores/layerStore';
import {timelineStore} from '../../stores/timelineStore';
import type {PaintStroke, PaintMode, BrushStyle} from '../../types/paint';
import {DEFAULT_BRUSH_FX_PARAMS} from '../../types/paint';

/**
 * Convert all strokes in a frame between flat and FX modes.
 * Updates each stroke's brushStyle, brushParams, and fxState in-place.
 */
function convertFrame(
  layerId: string,
  targetFrame: number,
  from: PaintMode,
  to: PaintMode,
  selectedFxStyle: BrushStyle
): void {
  const paintFrame = paintStore.getFrame(layerId, targetFrame);
  if (!paintFrame) return;

  for (const el of paintFrame.elements) {
    if (el.tool !== 'brush') continue;
    const stroke = el as PaintStroke;

    if (from === 'flat' && to === 'fx-paint') {
      // Flat -> FX: apply selected FX style to all flat strokes
      stroke.brushStyle = selectedFxStyle;
      stroke.brushParams = { ...DEFAULT_BRUSH_FX_PARAMS[selectedFxStyle] };
      stroke.fxState = 'fx-applied';
    } else if (from === 'fx-paint' && to === 'flat') {
      // FX -> Flat: revert to flat rendering
      stroke.brushStyle = 'flat';
      stroke.brushParams = {};
      stroke.fxState = 'flat';
    }
  }

  // Ensure persistence and cache regeneration
  paintStore.markDirty(layerId, targetFrame);
  paintStore._notifyVisualChange(layerId, targetFrame);
  paintStore.invalidateFrameFxCache(layerId, targetFrame);
  paintStore.refreshFrameFx(layerId, targetFrame);
  paintStore.paintVersion.value++;
}

/**
 * Handle a full mode conversion: convert strokes, set active mode, set brush tool.
 */
export function handleConvert(from: PaintMode, to: PaintMode, selectedFxStyle: BrushStyle): void {
  const layerId = layerStore.selectedLayerId.peek();
  if (!layerId) return;
  const frame = timelineStore.currentFrame.peek();

  // Convert strokes first (before setActivePaintMode resets brush)
  convertFrame(layerId, frame, from, to, selectedFxStyle);

  // Set active mode (resets brush tool to match)
  paintStore.setActivePaintMode(to);

  // If converting TO fx-paint, also set brush to the selected FX style
  if (to === 'fx-paint') {
    paintStore.setBrushStyle(selectedFxStyle);
  }
}

/** PaintModeSelector UI component: shows current mode and convert button */
export function PaintModeSelector() {
  const currentMode = paintStore.activePaintMode.value;
  const currentBrushStyle = paintStore.brushStyle.value;

  // Determine a sensible default FX style for conversion
  const defaultFxStyle: BrushStyle = (currentBrushStyle !== 'flat') ? currentBrushStyle : 'watercolor';

  const canConvertToFx = currentMode === 'flat';
  const canConvertToFlat = currentMode === 'fx-paint';

  return (
    <div class="flex items-center gap-2 py-1">
      <span class="text-[10px] shrink-0" style={{ color: 'var(--sidebar-text-secondary)' }}>
        Mode:
      </span>
      <span class="text-[10px] font-medium" style={{ color: 'var(--sidebar-text-primary)' }}>
        {currentMode === 'flat' ? 'Flat' : 'FX Paint'}
      </span>
      {canConvertToFx && (
        <button
          class="text-[9px] px-1.5 py-0.5 rounded paint-action-btn cursor-pointer"
          onClick={() => handleConvert('flat', 'fx-paint', defaultFxStyle)}
          title="Convert flat strokes to FX style"
        >
          Convert to FX
        </button>
      )}
      {canConvertToFlat && (
        <button
          class="text-[9px] px-1.5 py-0.5 rounded paint-action-btn cursor-pointer"
          onClick={() => handleConvert('fx-paint', 'flat', 'flat')}
          title="Convert FX strokes back to flat"
        >
          Convert to Flat
        </button>
      )}
    </div>
  );
}
