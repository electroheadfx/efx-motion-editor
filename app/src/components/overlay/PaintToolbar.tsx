import {useState} from 'preact/hooks';
import {Pen, Eraser, Pipette, PaintBucket, Minus, Square, Circle, MousePointer2, Eye, EyeOff, PenTool, Spline} from 'lucide-preact';
import {paintStore} from '../../stores/paintStore';
import {timelineStore} from '../../stores/timelineStore';
import {layerStore} from '../../stores/layerStore';
import {pushAction} from '../../lib/history';
import {ColorPickerModal} from '../shared/ColorPickerModal';
import type {PaintToolType, PaintStroke} from '../../types/paint';

const TOOLS: {type: PaintToolType; Icon: typeof Pen; label: string}[] = [
  {type: 'select', Icon: MousePointer2, label: 'Select'},
  {type: 'pen', Icon: PenTool, label: 'Pen (Edit Path)'},
  {type: 'brush', Icon: Pen, label: 'Brush'},
  {type: 'eraser', Icon: Eraser, label: 'Eraser'},
  {type: 'eyedropper', Icon: Pipette, label: 'Eyedropper'},
  {type: 'fill', Icon: PaintBucket, label: 'Fill'},
  {type: 'line', Icon: Minus, label: 'Line'},
  {type: 'rect', Icon: Square, label: 'Rectangle'},
  {type: 'ellipse', Icon: Circle, label: 'Ellipse'},
];

/**
 * Compact floating toolbar shown on the canvas when paint mode is active.
 * Provides quick access to tool selection, brush size, color, and opacity.
 * Reads from the same paintStore signals as PaintProperties (stays in sync).
 */
export function PaintToolbar() {
  const activeTool = paintStore.activeTool.value;
  const brushSizeVal = paintStore.brushSize.value;
  const brushColorVal = paintStore.brushColor.value;
  const brushOpacityVal = paintStore.brushOpacity.value;
  const [showColorPicker, setShowColorPicker] = useState(false);

  return (
    <div
      class="flex items-center gap-1.5 px-2 py-1.5 rounded-lg"
      style={{
        background: 'var(--color-bg-menu)',
        border: '1px solid var(--color-border-subtle)',
      }}
    >
      {/* Tool buttons */}
      {TOOLS.map(({type, Icon, label}) => {
        const isActive = activeTool === type;
        return (
          <button
            key={type}
            class={`flex items-center justify-center rounded cursor-pointer transition-colors ${
              isActive
                ? 'bg-(--color-accent) text-white'
                : 'text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-(--color-border-subtle)'
            }`}
            style={{width: '24px', height: '24px', padding: '3px'}}
            title={label}
            onClick={() => paintStore.setTool(type)}
          >
            <Icon size={14} />
          </button>
        );
      })}

      {/* Simplify button — visible when pen tool is editing a stroke */}
      {activeTool === 'pen' && paintStore.selectedStrokeIds.value.size === 1 && (() => {
        const selectedId = [...paintStore.selectedStrokeIds.value][0];
        const layerId = layerStore.selectedLayerId.value;
        if (!layerId) return null;
        const frame = timelineStore.currentFrame.value;
        const pf = paintStore.getFrame(layerId, frame);
        if (!pf) return null;
        const el = pf.elements.filter(e => e.id === selectedId)[0];
        if (!el || (el.tool !== 'brush' && el.tool !== 'eraser')) return null;
        const stroke = el as PaintStroke;
        if (!stroke.anchors) return null;
        const anchorCount = stroke.anchors.length;
        return (
          <>
            <div class="w-px h-5 mx-0.5" style={{backgroundColor: 'var(--color-border-subtle)'}} />
            <button
              class="flex items-center gap-1 px-1.5 h-6 rounded text-[10px] cursor-pointer transition-colors text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-(--color-border-subtle)"
              title={`Simplify path (${anchorCount} points)`}
              onClick={() => {
                const before = structuredClone(stroke.anchors);
                paintStore.simplifyBezier(layerId, frame, selectedId);
                const after = structuredClone(stroke.anchors);
                pushAction({
                  id: crypto.randomUUID(),
                  description: 'Simplify bezier path',
                  timestamp: Date.now(),
                  undo: () => { stroke.anchors = structuredClone(before); paintStore._notifyVisualChange(layerId, frame); },
                  redo: () => { stroke.anchors = structuredClone(after); paintStore._notifyVisualChange(layerId, frame); },
                });
              }}
            >
              <Spline size={12} />
              <span>{anchorCount}pts</span>
            </button>
          </>
        );
      })()}

      {/* Divider */}
      <div class="w-px h-5 mx-0.5" style={{backgroundColor: 'var(--color-border-subtle)'}} />

      {/* Brush size display with +/- buttons */}
      <div class="flex items-center gap-0.5">
        <button
          class="flex items-center justify-center w-4 h-4 rounded text-(--color-text-secondary) hover:text-(--color-text-primary) cursor-pointer"
          onClick={() => paintStore.setBrushSize(brushSizeVal - 1)}
          title="Decrease size"
        >
          <span class="text-[10px] font-bold leading-none">-</span>
        </button>
        <span
          class="text-[10px] font-mono min-w-[24px] text-center"
          style={{color: 'var(--color-text-primary)'}}
          title="Brush size"
        >
          {brushSizeVal}
        </span>
        <button
          class="flex items-center justify-center w-4 h-4 rounded text-(--color-text-secondary) hover:text-(--color-text-primary) cursor-pointer"
          onClick={() => paintStore.setBrushSize(brushSizeVal + 1)}
          title="Increase size"
        >
          <span class="text-[10px] font-bold leading-none">+</span>
        </button>
      </div>

      {/* Divider */}
      <div class="w-px h-5 mx-0.5" style={{backgroundColor: 'var(--color-border-subtle)'}} />

      {/* Color swatch — opens app ColorPickerModal */}
      <button
        class="rounded border cursor-pointer"
        style={{
          width: '20px',
          height: '20px',
          backgroundColor: brushColorVal,
          borderColor: 'var(--color-border-subtle)',
        }}
        title="Brush color"
        onClick={() => setShowColorPicker(true)}
      />

      {/* Opacity display */}
      <span
        class="text-[10px] font-mono"
        style={{color: 'var(--color-text-secondary)'}}
        title="Brush opacity"
      >
        {Math.round(brushOpacityVal * 100)}%
      </span>

      {/* Divider */}
      <div class="w-px h-5 mx-0.5" style={{backgroundColor: 'var(--color-border-subtle)'}} />

      {/* Flat/FX preview toggle */}
      <button
        class={`flex items-center justify-center rounded cursor-pointer transition-colors ${
          paintStore.showFlatPreview.value
            ? 'bg-amber-500 text-black'
            : 'text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-(--color-border-subtle)'
        }`}
        style={{width: '24px', height: '24px', padding: '3px'}}
        title={paintStore.showFlatPreview.value ? 'Show FX render (F)' : 'Show flat preview (F)'}
        onClick={() => paintStore.toggleFlatPreview()}
      >
        {paintStore.showFlatPreview.value ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>

      {/* Color Picker Modal */}
      {showColorPicker && (
        <ColorPickerModal
          color={brushColorVal}
          onLiveChange={(c) => paintStore.setBrushColor(c)}
          onCommit={(c) => {
            paintStore.setBrushColor(c);
            setShowColorPicker(false);
          }}
          onClose={() => setShowColorPicker(false)}
        />
      )}
    </div>
  );
}
