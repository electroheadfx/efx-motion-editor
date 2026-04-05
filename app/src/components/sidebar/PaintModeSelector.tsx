import {useState} from 'preact/hooks';
import {Film, Spline} from 'lucide-preact';
import {paintStore} from '../../stores/paintStore';
import {layerStore} from '../../stores/layerStore';
import {timelineStore} from '../../stores/timelineStore';
import type {PaintStroke, BrushStyle} from '../../types/paint';
import {DEFAULT_BRUSH_FX_PARAMS} from '../../types/paint';

const FX_STYLES: {style: BrushStyle; label: string}[] = [
  {style: 'watercolor', label: 'Watercolor'},
  {style: 'ink', label: 'Ink'},
  {style: 'charcoal', label: 'Charcoal'},
  {style: 'pencil', label: 'Pencil'},
  {style: 'marker', label: 'Marker'},
];

/**
 * Convert strokes in a single frame to the target FX style.
 */
function convertFrameStrokes(
  layerId: string,
  targetFrame: number,
  targetStyle: BrushStyle,
): void {
  const paintFrame = paintStore.getFrame(layerId, targetFrame);
  if (!paintFrame) return;

  for (const el of paintFrame.elements) {
    if (el.tool !== 'brush') continue;
    const stroke = el as PaintStroke;
    stroke.brushStyle = targetStyle;
    stroke.brushParams = targetStyle === 'flat' ? {} : { ...DEFAULT_BRUSH_FX_PARAMS[targetStyle] };
    stroke.fxState = targetStyle === 'flat' ? 'flat' : 'fx-applied';
  }

  paintStore.markDirty(layerId, targetFrame);
  paintStore._notifyVisualChange(layerId, targetFrame);
  paintStore.invalidateFrameFxCache(layerId, targetFrame);
  paintStore.refreshFrameFx(layerId, targetFrame);
  paintStore.paintVersion.value++;
}

/**
 * Handle mode conversion from flat → FX.
 */
export function handleConvertToFx(selectedFxStyle: BrushStyle): void {
  const layerId = layerStore.selectedLayerId.peek();
  if (!layerId) return;
  const frame = timelineStore.currentFrame.peek();

  convertFrameStrokes(layerId, frame, selectedFxStyle);

  // FX = white bg, persist on layer
  paintStore.setPaintBgColor('#ffffff');
  layerStore.updateLayer(layerId, { paintBgColor: '#ffffff' });

  paintStore.setActivePaintMode('fx-paint');
  paintStore.setBrushStyle(selectedFxStyle);
}

/**
 * Convert strokes to a new FX style while already in FX mode.
 * scope: 'frame' = current frame only, 'all' = all frames.
 */
function convertFxStrokes(targetStyle: BrushStyle, scope: 'frame' | 'all' | 'selected'): void {
  const layerId = layerStore.selectedLayerId.peek();
  if (!layerId) return;

  if (scope === 'all') {
    const frameNums = paintStore.getFrameNumbers(layerId);
    for (const fn of frameNums) {
      convertFrameStrokes(layerId, fn, targetStyle);
    }
  } else if (scope === 'selected') {
    const frame = timelineStore.currentFrame.peek();
    const paintFrame = paintStore.getFrame(layerId, frame);
    if (!paintFrame) return;
    const sel = paintStore.selectedStrokeIds.peek();
    for (const el of paintFrame.elements) {
      if (el.tool !== 'brush' || !sel.has(el.id)) continue;
      const stroke = el as PaintStroke;
      stroke.brushStyle = targetStyle;
      stroke.brushParams = { ...DEFAULT_BRUSH_FX_PARAMS[targetStyle] };
      stroke.fxState = 'fx-applied';
    }
    paintStore.markDirty(layerId, frame);
    paintStore._notifyVisualChange(layerId, frame);
    paintStore.invalidateFrameFxCache(layerId, frame);
    paintStore.refreshFrameFx(layerId, frame);
    paintStore.paintVersion.value++;
  } else {
    const frame = timelineStore.currentFrame.peek();
    convertFrameStrokes(layerId, frame, targetStyle);
  }

  paintStore.setBrushStyle(targetStyle);
}

/**
 * Handle conversion from FX → flat.
 */
export function handleConvertToFlat(): void {
  const layerId = layerStore.selectedLayerId.peek();
  if (!layerId) return;
  const frame = timelineStore.currentFrame.peek();

  convertFrameStrokes(layerId, frame, 'flat');

  // Flat = transparent bg, persist on layer
  paintStore.setPaintBgColor('transparent');
  layerStore.updateLayer(layerId, { paintBgColor: 'transparent' });

  paintStore.setActivePaintMode('flat');
}

/** PaintModeSelector UI component — mode toggle buttons */
export function PaintModeSelector() {
  const [showFxPicker, setShowFxPicker] = useState(false);
  const currentMode = paintStore.activePaintMode.value;

  const activeStyle = {
    backgroundColor: 'var(--color-accent)',
    color: '#fff',
    border: 'none',
    cursor: 'default',
  };
  const btnStyle = {
    backgroundColor: 'var(--sidebar-input-bg)',
    color: 'var(--sidebar-text-primary)',
    border: 'none',
    cursor: 'pointer',
  };
  const disabledStyle = {
    backgroundColor: 'var(--sidebar-input-bg)',
    color: 'var(--sidebar-text-secondary)',
    border: 'none',
    cursor: 'not-allowed',
    opacity: 0.4,
  };

  return (
    <div class="flex items-center gap-1 py-1 relative">
      {/* Paint (flat) button */}
      <button
        class="text-[10px] px-3 py-1 rounded"
        style={currentMode === 'flat' ? activeStyle : btnStyle}
        onClick={() => { if (currentMode !== 'flat') handleConvertToFlat(); }}
      >
        Paint
      </button>
      {/* FX button */}
      <button
        class="text-[10px] px-3 py-1 rounded"
        style={currentMode === 'fx-paint' ? activeStyle : btnStyle}
        onClick={() => { if (currentMode !== 'fx-paint') setShowFxPicker(true); }}
      >
        FX
      </button>
      {/* Physic button — greyed out */}
      <button
        class="text-[10px] px-3 py-1 rounded"
        style={disabledStyle}
        disabled
        title="Physics paint — coming soon"
      >
        Physic
      </button>

      {/* FX Brush Style Picker — shown on flat→FX conversion */}
      {showFxPicker && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 999 }}
            onClick={() => setShowFxPicker(false)}
          />
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              zIndex: 1000,
              marginTop: '4px',
              backgroundColor: 'var(--sidebar-bg)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: '8px',
              padding: '8px',
              minWidth: '160px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{ fontSize: '10px', color: 'var(--sidebar-text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
              Choose FX Brush
            </div>
            {FX_STYLES.map(({style, label}) => (
              <button
                key={style}
                class="cursor-pointer"
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '5px 8px',
                  fontSize: '11px',
                  color: 'var(--sidebar-text-primary)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = 'var(--sidebar-hover-bg)'; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.backgroundColor = 'transparent'; }}
                onClick={() => {
                  handleConvertToFx(style);
                  setShowFxPicker(false);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * FX Brush convert toolbar — shown in FX mode for brush and select tools.
 * Two scope toggles: Spline (current frame, default) and Film (all frames).
 * Brush style buttons convert strokes in the selected scope.
 * In select tool mode, only selected strokes are converted (handled elsewhere).
 */
export function FxBrushConvertBar({selectedOnly}: {selectedOnly?: boolean} = {}) {
  const [scope, setScope] = useState<'frame' | 'all' | null>(null);
  const currentStyle = paintStore.brushStyle.value;
  const effectiveScope = selectedOnly ? 'selected' : scope;

  return (
    <div class="flex flex-col gap-1.5">
      <div class="flex flex-wrap gap-1 items-center">
        {FX_STYLES.map(({style, label}) => {
          const isActive = currentStyle === style;
          return (
            <button
              key={style}
              class={`text-[10px] px-2 py-1 rounded cursor-pointer transition-colors ${
                isActive ? 'paint-style-btn-active' : 'paint-action-btn'
              }`}
              onClick={() => {
                if (effectiveScope) {
                  convertFxStrokes(style, effectiveScope);
                } else {
                  // No scope selected — just set brush style for new strokes
                  paintStore.setBrushStyle(style);
                }
              }}
            >
              {label}
            </button>
          );
        })}
        {/* Scope toggles — hidden in select tool (selected-only mode) */}
        {!selectedOnly && (
        <div style={{ marginLeft: '4px', display: 'flex', gap: '2px' }}>
          <button
            class="cursor-pointer"
            style={{
              padding: '3px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: scope === 'frame' ? 'var(--color-accent)' : 'transparent',
              color: scope === 'frame' ? '#fff' : 'var(--sidebar-text-secondary)',
              display: 'flex',
              alignItems: 'center',
            }}
            onClick={() => setScope(scope === 'frame' ? null : 'frame')}
            title="Convert current frame strokes"
          >
            <Spline size={12} />
          </button>
          <button
            class="cursor-pointer"
            style={{
              padding: '3px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: scope === 'all' ? 'var(--color-accent)' : 'transparent',
              color: scope === 'all' ? '#fff' : 'var(--sidebar-text-secondary)',
              display: 'flex',
              alignItems: 'center',
            }}
            onClick={() => setScope(scope === 'all' ? null : 'all')}
            title="Convert all frames strokes"
          >
            <Film size={12} />
          </button>
        </div>
        )}
      </div>
    </div>
  );
}
