import {useState} from 'preact/hooks';
import {Pen, Eraser, Pipette, PaintBucket, Minus, Square, Circle, MousePointer2, Eye, EyeOff, PenTool} from 'lucide-preact';
import {paintStore} from '../../stores/paintStore';
import {ColorPickerModal} from '../shared/ColorPickerModal';
import type {PaintToolType} from '../../types/paint';

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
